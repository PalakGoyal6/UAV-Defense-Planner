import math
import json
import pytest
from scipy.stats import norm

from app.models import (
    Scenario, Asset, CandidateSite, GlobalParameters, Step2LoadOutput
)
from app.solver.geometry import haversine_distance, compute_coverage_matrix
from app.solver.queueing import erlang_b_loss, size_engagement_channels_step
from app.solver.inventory import largest_remainder_round, compute_inventory_step
from app.solver.reserve import compute_reserve_step
from app.solver.location import solve_location_step, run_greedy_mclp
from app.solver.pipeline import run_defense_pipeline

def test_erlang_b_values():
    """Test 1: Erlang-B exact recursion values."""
    # B(1, 1) = 0.5
    assert abs(erlang_b_loss(1, 1.0) - 0.5) < 1e-9

    # B(2, 1) = 0.2
    assert abs(erlang_b_loss(2, 1.0) - 0.2) < 1e-9

    # B(c, 0) = 0 for c >= 1
    for c in [1, 2, 5, 10]:
        assert erlang_b_loss(c, 0.0) == 0.0

    # B(0, a) = 1.0
    assert erlang_b_loss(0, 3.5) == 1.0

    # Recursion matches factorial formula for small c
    # B(3, 2): factorials:
    # (2^3 / 3!) / (1 + 2 + 2^2/2! + 2^3/3!) = (8/6) / (1 + 2 + 2 + 8/6) = (4/3) / (5 + 4/3) = (4/3) / (19/3) = 4/19 = 0.210526...
    assert abs(erlang_b_loss(3, 2.0) - (4.0 / 19.0)) < 1e-7

    # Monotone decreasing in c
    a = 2.5
    probs = [erlang_b_loss(c, a) for c in range(1, 10)]
    for i in range(len(probs) - 1):
        assert probs[i] > probs[i + 1]

def test_channel_sizing():
    """Test 2: Channel sizing returns smallest c meeting alpha, and flags infeasible at max_channels."""
    # Test achievable
    load = Step2LoadOutput(
        site_loads={"S1": 1.0},
        offered_loads={"S1": 1.5},
        total_system_load=1.0
    )
    sites = [
        CandidateSite(id="S1", name="Site 1", cost=20, range_km=5, max_channels=10)
    ]
    # alpha = 0.05
    out = size_engagement_channels_step(load, sites, target_leak_probability=0.05)
    s1_res = out.site_channels["S1"]
    assert s1_res.target_met is True
    assert s1_res.leak_probability <= 0.05
    # Verify smallest c: c-1 must violate alpha
    c = s1_res.channels_allocated
    assert erlang_b_loss(c - 1, 1.5) > 0.05

    # Test infeasible at max_channels
    sites_constrained = [
        CandidateSite(id="S1", name="Site 1", cost=20, range_km=5, max_channels=2)
    ]
    out2 = size_engagement_channels_step(load, sites_constrained, target_leak_probability=0.05)
    s1_res2 = out2.site_channels["S1"]
    assert s1_res2.target_met is False
    assert s1_res2.channels_allocated == 2
    assert "not achievable" in (s1_res2.note or "")

def test_newsvendor_properties():
    """Test 3: Newsvendor CR = 0.5 => Q* = mu_D; z matches norm.ppf."""
    scenario = Scenario(
        name="Test Newsvendor",
        coordinate_mode="grid",
        assets=[],
        sites=[CandidateSite(id="S1", name="S1", cost=10, range_km=5)],
        parameters=GlobalParameters(
            underage_cost=50.0,
            overage_cost=50.0,  # CR = 0.5
            demand_mode="manual",
            manual_mean_demand=20.0,
            manual_sd_demand=4.0
        )
    )
    load = Step2LoadOutput(site_loads={"S1": 1.0}, offered_loads={"S1": 1.0}, total_system_load=1.0)
    from app.models import Step3QueueingOutput, SiteChannelResult
    channels = Step3QueueingOutput(
        site_channels={
            "S1": SiteChannelResult(
                site_id="S1", lambda_rate=1.0, offered_load_erlangs=1.0,
                channels_allocated=4, leak_probability=0.01, target_met=True,
                expected_leaks_per_min=0.01, curve=[]
            )
        },
        total_channels=4,
        system_weighted_leak_prob=0.01,
        worst_site_leak_prob=0.01,
        all_targets_met=True
    )
    inv = compute_inventory_step(scenario, load, channels)
    assert abs(inv.critical_ratio - 0.5) < 1e-6
    assert abs(inv.z_score - 0.0) < 1e-6
    # Q* = ceil(mu_D + 0 * sigma_D) = 20
    assert inv.total_stock_Q_star == 20

def test_littlewood_rule():
    """Test 4: Littlewood: r2/r1 = 0.5 => y1* = ceil(mu1); r2 >= r1 => 0; clamped to <= Q*."""
    scenario = Scenario(
        name="Test Littlewood",
        coordinate_mode="grid",
        assets=[
            Asset(id="A1", name="High", value=100, threat_rate=0.4, priority_class="high"),
            Asset(id="A2", name="Low", value=50, threat_rate=0.2, priority_class="low")
        ],
        sites=[CandidateSite(id="S1", name="S1", cost=10, range_km=5)],
        parameters=GlobalParameters(
            attack_duration_min=10.0,
            shots_per_engagement=1,
            r1_override=100.0,
            r2_override=50.0  # ratio = 0.5 => Phi^-1(1 - 0.5) = Phi^-1(0.5) = 0
        )
    )
    from app.models import Step1LocationOutput, LocationAssignment, Step4InventoryOutput
    location = Step1LocationOutput(
        status="Optimal",
        opened_sites=["S1"],
        site_results=[],
        assignments=[
            LocationAssignment(
                asset_id="A1", asset_name="High", site_id="S1", site_name="S1",
                covered=True, distance_km=1.0, value=100, threat_rate=0.4, priority_class="high"
            ),
            LocationAssignment(
                asset_id="A2", asset_name="Low", site_id="S1", site_name="S1",
                covered=True, distance_km=1.0, value=50, threat_rate=0.2, priority_class="low"
            )
        ],
        total_value_protected=150,
        total_possible_value=150,
        pct_value_protected=100,
        total_site_cost=10,
        budget=50,
        solver_used="cbc",
        uncovered_assets=[],
        solve_time_sec=0.01,
        n_vars=3,
        n_constraints=3
    )
    from app.models import Step3QueueingOutput, SiteChannelResult
    channels = Step3QueueingOutput(
        site_channels={
            "S1": SiteChannelResult(
                site_id="S1", lambda_rate=0.6, offered_load_erlangs=0.6,
                channels_allocated=4, leak_probability=0.0, target_met=True,
                expected_leaks_per_min=0.0, curve=[]
            )
        },
        total_channels=4,
        system_weighted_leak_prob=0.0,
        worst_site_leak_prob=0.0,
        all_targets_met=True
    )
    inventory = Step4InventoryOutput(
        demand_mode="derived", mu_D=6.0, sigma_D=2.45, critical_ratio=0.8,
        z_score=0.84, total_stock_Q_star=15, site_inventory={}, derivation_text=""
    )

    # Ratio = 0.5 => y1* = ceil(mu1)
    # mu1 = k * T * high_threat * (1 - leak) = 1 * 10 * 0.4 * 1 = 4.0
    res = compute_reserve_step(scenario, location, channels, inventory)
    assert abs(res.ratio_r2_r1 - 0.5) < 1e-6
    assert res.reserve_y1_star == 4

    # r2 >= r1 => reserve = 0
    scenario.parameters.r2_override = 120.0
    res_zero = compute_reserve_step(scenario, location, channels, inventory)
    assert res_zero.reserve_y1_star == 0

    # Clamped to <= Q*
    inventory_tiny = inventory.model_copy()
    inventory_tiny.total_stock_Q_star = 2
    scenario.parameters.r2_override = 20.0  # very low r2, high reserve
    res_clamped = compute_reserve_step(scenario, location, channels, inventory_tiny)
    assert res_clamped.reserve_y1_star <= 2

def test_largest_remainder_split():
    """Test 5: Largest-remainder split sums exactly to total."""
    shares = {"S1": 0.35, "S2": 0.45, "S3": 0.20}
    for units in [1, 5, 7, 10, 13, 27, 100, 333]:
        apportionment = largest_remainder_round(units, shares)
        assert sum(apportionment.values()) == units

def test_mclp_vs_brute_force():
    """Test 6: MCLP on the small example equals brute-force enumeration over all 2^6 site subsets."""
    with open("sample_data/air_base.json", "r") as f:
        data = json.load(f)
    scenario = Scenario(**data)
    cov, dist = compute_coverage_matrix(scenario)

    # Brute force 2^6 = 64 subsets
    sites = scenario.sites
    n = len(sites)
    best_bf_val = -1.0
    best_bf_subset = []
    budget = scenario.parameters.budget

    for mask in range(1 << n):
        cost = sum(sites[j].cost for j in range(n) if (mask & (1 << j)))
        if cost > budget:
            continue
        open_site_ids = [sites[j].id for j in range(n) if (mask & (1 << j))]
        val = sum(
            a.value for a in scenario.assets
            if any(cov[a.id].get(sid, 0) == 1 for sid in open_site_ids)
        )
        if val > best_bf_val:
            best_bf_val = val
            best_bf_subset = open_site_ids

    # Run MILP solver
    loc_out, _, _ = solve_location_step(scenario, cov, dist)
    assert abs(loc_out.total_value_protected - best_bf_val) < 1e-6
    assert loc_out.total_site_cost <= budget

def test_greedy_properties():
    """Test 7: Greedy never exceeds the budget; MILP value >= greedy value."""
    with open("sample_data/air_base.json", "r") as f:
        data = json.load(f)
    scenario = Scenario(**data)
    cov, dist = compute_coverage_matrix(scenario)

    loc_out, comps, _ = solve_location_step(scenario, cov, dist)
    greedy_comp = [c for c in comps if c.model_name == "Greedy Heuristic"][0]

    assert greedy_comp.total_cost <= scenario.parameters.budget
    assert loc_out.total_value_protected >= greedy_comp.value_protected

def test_haversine_distance():
    """Test 8: Haversine distance sanity check (known city pair distance within 1%)."""
    # New Delhi (28.6139° N, 77.2090° E) to Mumbai (19.0760° N, 72.8777° E)
    # Known great circle distance ~ 1148 km - 1160 km
    dist = haversine_distance(28.6139, 77.2090, 19.0760, 72.8777)
    assert 1140 < dist < 1170

def test_pipeline_end_to_end_example():
    """Test 9: Pipeline end-to-end on air base returns no errors, and sum(Lambda_j) equals covered threat sum."""
    with open("sample_data/air_base.json", "r") as f:
        data = json.load(f)
    scenario = Scenario(**data)
    plan = run_defense_pipeline(scenario)

    assert plan.location.status in ("Optimal", "Feasible")
    assert plan.location.total_value_protected > 0
    assert plan.channels.total_channels > 0
    assert plan.inventory.total_stock_Q_star > 0

    # Threat sum conservation: sum_j Lambda_j equals sum of covered assets' threat rates
    covered_asset_threats = sum(
        assign.threat_rate for assign in plan.location.assignments if assign.covered
    )
    sum_lambda = sum(plan.load.site_loads.values())
    assert abs(sum_lambda - covered_asset_threats) < 1e-4
