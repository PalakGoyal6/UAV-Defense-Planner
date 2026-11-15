import json
import sys
import time
from typing import Dict, List
from app.models import (
    Scenario, FullPlanResponse, WorkingStep, RegionResult
)
from app.solver.geometry import compute_coverage_matrix, find_state_for_point, get_state_geometries
from app.solver.location import solve_location_step
from app.solver.load import compute_threat_load_step
from app.solver.queueing import size_engagement_channels_step
from app.solver.inventory import compute_inventory_step
from app.solver.reserve import compute_reserve_step

def compute_results_by_region(
    scenario: Scenario,
    location,
    channels,
    inventory,
    reserve
) -> Dict[str, RegionResult]:
    """
    Computes regional metrics breakdown.
    Ensures per-region totals add up exactly to the overall totals.
    """
    results_by_region: Dict[str, RegionResult] = {}

    # Initialize all Indian states if in geo mode
    if scenario.coordinate_mode == "geo":
        for st_name, _, _, _ in get_state_geometries():
            results_by_region[st_name] = RegionResult(region_name=st_name)

    # Helper to get effective region
    def get_asset_region(a) -> str:
        if a.region:
            return a.region
        if scenario.coordinate_mode == "geo":
            return find_state_for_point(a.lat, a.lon)
        return "Default"

    def get_site_region(s) -> str:
        if s.region:
            return s.region
        if scenario.coordinate_mode == "geo":
            return find_state_for_point(s.lat, s.lon)
        return "Default"

    # Map assignments by asset_id
    assignment_map = {assign.asset_id: assign for assign in location.assignments}

    # Aggregate assets
    for asset in scenario.assets:
        r_name = get_asset_region(asset)
        if r_name not in results_by_region:
            results_by_region[r_name] = RegionResult(region_name=r_name)
        reg = results_by_region[r_name]
        reg.num_assets += 1
        reg.total_asset_value += asset.value

        assign = assignment_map.get(asset.id)
        if assign and assign.covered:
            reg.value_protected += asset.value
            reg.covered_asset_ids.append(asset.id)
        else:
            reg.uncovered_asset_ids.append(asset.id)

    # Aggregate sites
    opened_set = set(location.opened_sites)
    for site in scenario.sites:
        r_name = get_site_region(site)
        if r_name not in results_by_region:
            results_by_region[r_name] = RegionResult(region_name=r_name)
        reg = results_by_region[r_name]

        if site.id in opened_set:
            reg.opened_sites.append(site.id)
            reg.num_opened_sites += 1
            reg.total_site_cost += site.cost

            ch_res = channels.site_channels.get(site.id)
            if ch_res:
                reg.total_channels += ch_res.channels_allocated
                if ch_res.channels_allocated > 0:
                    reg.worst_leak_probability = max(reg.worst_leak_probability, ch_res.leak_probability)

            inv_res = inventory.site_inventory.get(site.id)
            if inv_res:
                reg.allocated_stock_Q += inv_res.allocated_stock_Q

            site_res = reserve.site_reserves.get(site.id, 0)
            reg.reserve_y1 += site_res

    # Finalize percentage and rounding
    for reg in results_by_region.values():
        reg.total_asset_value = round(reg.total_asset_value, 2)
        reg.value_protected = round(reg.value_protected, 2)
        reg.total_site_cost = round(reg.total_site_cost, 2)
        if reg.total_asset_value > 0:
            reg.pct_value_protected = round((reg.value_protected / reg.total_asset_value) * 100.0, 2)
        else:
            reg.pct_value_protected = 0.0
        reg.worst_leak_probability = round(reg.worst_leak_probability, 4)

    return results_by_region

def build_working_steps(
    scenario: Scenario,
    location,
    load,
    channels,
    inventory,
    reserve
) -> List[WorkingStep]:
    """
    Constructs the step-by-step 'Show Working' breakdown with formulas,
    plugged-in numbers, and resulting decisions.
    """
    steps: List[WorkingStep] = []

    # Step 1: Unit Placement
    s1_details = [
        f"Objective: Maximize total protected asset value subject to Budget B = ₹{scenario.parameters.budget:,.2f}.",
        f"Candidate sites evaluated: {len(scenario.sites)}; Assets: {len(scenario.assets)}.",
        f"Solver used: {location.solver_used.upper()} (status: {location.status}, solve time: {location.solve_time_sec*1000:.1f}ms).",
        f"Open sites chosen: {', '.join(location.opened_sites) if location.opened_sites else 'None'}.",
        f"Total site opening capital cost = ₹{location.total_site_cost:,.2f} / ₹{scenario.parameters.budget:,.2f}.",
        f"Value protected: {location.total_value_protected:.1f} / {location.total_possible_value:.1f} ({location.pct_value_protected:.1f}%)."
    ]
    if location.uncovered_assets:
        s1_details.append(f"Uncovered assets: {', '.join(location.uncovered_assets)}")
    steps.append(WorkingStep(step_number=1, title="Step 1: Unit Placement (MCLP)", details=s1_details))

    # Step 2: Threat Load
    s2_details = [
        f"Engagement service time: 1/mu = {scenario.parameters.mean_engagement_time_min:.2f} min (Service rate mu = {1.0/scenario.parameters.mean_engagement_time_min:.4f}/min)."
    ]
    for s_id, lam in load.site_loads.items():
        erl = load.offered_loads.get(s_id, 0.0)
        s2_details.append(
            f"Site {s_id}: Lambda_{s_id} = {lam:.4f} threats/min; Offered load a_{s_id} = Lambda * (1/mu) = {lam:.4f} * {scenario.parameters.mean_engagement_time_min:.2f} = {erl:.4f} Erlangs."
        )
    s2_details.append(f"Total system threat arrival rate: {load.total_system_load:.4f} threats/min.")
    steps.append(WorkingStep(step_number=2, title="Step 2: Threat Load Aggregation", details=s2_details))

    # Step 3: Sizing Channels
    s3_details = [
        f"Target maximum leak probability alpha = {scenario.parameters.target_leak_probability:.4f}."
    ]
    for s_id, ch_res in channels.site_channels.items():
        if ch_res.channels_allocated == 0:
            s3_details.append(f"Site {s_id}: Offered load = {ch_res.offered_load_erlangs:.4f} Erl -> 0 channels allocated ({ch_res.note}).")
        else:
            c = ch_res.channels_allocated
            b_val = ch_res.leak_probability
            s3_details.append(
                f"Site {s_id}: a = {ch_res.offered_load_erlangs:.4f} Erl; sized to c = {c} channels -> B({c}, {ch_res.offered_load_erlangs:.4f}) = {b_val:.4f} "
                f"({'<=' if ch_res.target_met else '>'} alpha = {scenario.parameters.target_leak_probability:.4f}). Expected leaks = {ch_res.expected_leaks_per_min:.4f}/min."
            )
    s3_details.append(f"Total engagement channels across all sites: {channels.total_channels}.")
    steps.append(WorkingStep(step_number=3, title="Step 3: Engagement Channel Sizing (Erlang-B)", details=s3_details))

    # Step 4: Stocking & Reorder
    s4_details = [
        f"Demand mode: {inventory.demand_mode}.",
        inventory.derivation_text,
        f"Newsvendor Critical Ratio CR = Cu / (Cu + Co) = {scenario.parameters.underage_cost} / ({scenario.parameters.underage_cost} + {scenario.parameters.overage_cost}) = {inventory.critical_ratio:.4f}.",
        f"Standard Normal quantile z = Phi^-1({inventory.critical_ratio:.4f}) = {inventory.z_score:.4f}.",
        f"Target stock Q* = ceil({inventory.mu_D:.2f} + {inventory.z_score:.4f} * {inventory.sigma_D:.2f}) = {inventory.total_stock_Q_star} interceptors."
    ]
    for s_id, inv_res in inventory.site_inventory.items():
        s4_details.append(
            f"Site {s_id}: Stock allocation = {inv_res.allocated_stock_Q} units (share {inv_res.lambda_share*100:.1f}%); "
            f"Depot distance = {inv_res.depot_distance_km:.1f} km; Lead time L = {inv_res.lead_time_days:.2f} days; "
            f"Reorder point s = {inv_res.reorder_point_s}; Suggested order qty EOQ = {inv_res.suggested_order_qty_EOQ}."
        )
    steps.append(WorkingStep(step_number=4, title="Step 4: Stock & Reorder Policy (Newsvendor + s,Q)", details=s4_details))

    # Step 5: Littlewood Reserve
    s5_details = [
        f"High-priority assets covered: {', '.join(reserve.high_priority_asset_ids) if reserve.high_priority_asset_ids else 'None'}.",
        f"High-value threat demand: mu_1 = {reserve.mu_1:.2f}, sigma_1 = {reserve.sigma_1:.2f}.",
        f"Unit value weights: r1 (high) = ₹{reserve.r1:,.2f}, r2 (low) = ₹{reserve.r2:,.2f}; Protection ratio r2/r1 = {reserve.ratio_r2_r1:.4f}.",
        reserve.explanation,
        reserve.plain_english_rule
    ]
    steps.append(WorkingStep(step_number=5, title="Step 5: High-Value Asset Reserve (Littlewood)", details=s5_details))

    return steps

def run_defense_pipeline(scenario: Scenario) -> FullPlanResponse:
    """
    Executes the 5 chained defense planning steps in exact sequence:
    1. Place units (MCLP)
    2. Threat load (Lambda_j, a_j)
    3. Size channels (Erlang-B)
    4. Stock up (Newsvendor + Reorder points)
    5. Hold a reserve (Littlewood's rule)
    """
    total_start = time.time()
    coverage, distances = compute_coverage_matrix(scenario)

    # 1. Place units
    location_out, comparisons, warnings = solve_location_step(scenario, coverage, distances)

    # 2. Threat load
    load_out = compute_threat_load_step(
        assignments=location_out.assignments,
        opened_sites=location_out.opened_sites,
        mean_engagement_time_min=scenario.parameters.mean_engagement_time_min
    )

    # 3. Size channels
    channel_out = size_engagement_channels_step(
        load_output=load_out,
        sites=scenario.sites,
        target_leak_probability=scenario.parameters.target_leak_probability
    )

    # Channel cost accounting
    site_dict = {s.id: s for s in scenario.sites}
    tot_ch_cost = sum(
        site_dict[s_id].channel_cost * res.channels_allocated
        for s_id, res in channel_out.site_channels.items()
    )
    location_out.channel_cost_total = tot_ch_cost
    location_out.total_cost_with_channels = location_out.total_site_cost + tot_ch_cost
    if tot_ch_cost > 0:
        if location_out.total_cost_with_channels > scenario.parameters.budget:
            location_out.budget_exceeded = True
            warnings.append(
                f"Total deployment cost with channels (₹{location_out.total_cost_with_channels:,.2f}) "
                f"exceeds site-opening budget (₹{scenario.parameters.budget:,.2f}) by ₹{(location_out.total_cost_with_channels - scenario.parameters.budget):,.2f}."
            )

    # 4. Stock and reorder rule
    inventory_out = compute_inventory_step(scenario, load_out, channel_out)

    # 5. Littlewood reserve
    reserve_out = compute_reserve_step(scenario, location_out, channel_out, inventory_out)

    # 6. Regional results breakdown
    results_by_region = compute_results_by_region(
        scenario, location_out, channel_out, inventory_out, reserve_out
    )

    # Construct Show Working
    working_steps = build_working_steps(
        scenario, location_out, load_out, channel_out, inventory_out, reserve_out
    )

    total_time = time.time() - total_start

    meta = {
        "pipeline_total_time_ms": round(total_time * 1000.0, 2),
        "coordinate_mode": scenario.coordinate_mode,
        "num_assets": len(scenario.assets),
        "num_sites": len(scenario.sites),
        "num_opened_sites": len(location_out.opened_sites),
        "solver_status": location_out.status,
        "n_vars": location_out.n_vars,
        "n_constraints": location_out.n_constraints
    }

    return FullPlanResponse(
        scenario_id=scenario.id,
        scenario_name=scenario.name,
        location=location_out,
        load=load_out,
        channels=channel_out,
        inventory=inventory_out,
        reserve=reserve_out,
        results_by_region=results_by_region,
        comparison=comparisons,
        working=working_steps,
        warnings=warnings,
        meta=meta
    )

def main():
    if len(sys.argv) < 2:
        print("Usage: python -m app.solver.pipeline <path_to_scenario.json>")
        sys.exit(1)

    json_path = sys.argv[1]
    with open(json_path, "r", encoding="utf-8") as f:
        data = json.load(f)

    scenario = Scenario(**data)
    plan = run_defense_pipeline(scenario)

    print("=" * 80)
    print(f"UAV DEFENSE PLANNER: {plan.scenario_name.upper()}")
    print("=" * 80)
    print(f"\n[SUMMARY]")
    print(f"  • Sites Opened: {plan.location.opened_sites} (Cost: ₹{plan.location.total_site_cost:,.2f} / Budget: ₹{plan.location.budget:,.2f})")
    print(f"  • Asset Value Protected: {plan.location.total_value_protected:.1f} / {plan.location.total_possible_value:.1f} ({plan.location.pct_value_protected:.1f}%)")
    print(f"  • Total Channels Installed: {plan.channels.total_channels}")
    print(f"  • Worst-Site Leak Probability: {plan.channels.worst_site_leak_prob:.4f}")
    print(f"  • Total Interceptors Stocked (Q*): {plan.inventory.total_stock_Q_star}")
    print(f"  • High-Value Reserve (y1*): {plan.reserve.reserve_y1_star}")
    print(f"  • Low-Value Booking Limit: {plan.reserve.booking_limit_low_value}")
    print(f"\n[PLAIN-ENGLISH RULES]")
    print(f"  • Reserve: {plan.reserve.plain_english_rule}")
    for s_id, inv in plan.inventory.site_inventory.items():
        print(f"  • Reorder: {inv.plain_english_rule}")

    print("\n[SHOW WORKING STEPS]")
    for st in plan.working:
        print(f"\n--- {st.title} ---")
        for line in st.details:
            print(f"  {line}")

    if plan.warnings:
        print("\n[WARNINGS]")
        for w in plan.warnings:
            print(f"  ! {w}")

    print("\n" + "=" * 80)

if __name__ == "__main__":
    main()
