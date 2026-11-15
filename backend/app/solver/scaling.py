import random
import uuid
import time
from typing import Dict, List, Optional
from app.models import (
    Asset, CandidateSite, GlobalParameters, Scenario,
    SyntheticGenerateRequest, FullPlanResponse, Step1LocationOutput,
    Step2LoadOutput, Step3QueueingOutput, Step4InventoryOutput,
    Step5ReserveOutput, WorkingStep
)
from app.solver.pipeline import run_defense_pipeline

INDIAN_REGION_PRESETS = {
    "punjab": {
        "name": "Punjab Border Sector (Synthetic)",
        "min_lat": 30.5, "max_lat": 32.2, "min_lon": 74.3, "max_lon": 75.9
    },
    "rajasthan": {
        "name": "Rajasthan Desert Sector (Synthetic)",
        "min_lat": 26.2, "max_lat": 28.5, "min_lon": 70.8, "max_lon": 73.2
    },
    "ladakh": {
        "name": "Ladakh Mountain Sector (Synthetic)",
        "min_lat": 33.8, "max_lat": 35.2, "min_lon": 77.2, "max_lon": 79.1
    },
    "gujarat": {
        "name": "Gujarat Coastal Sector (Synthetic)",
        "min_lat": 22.0, "max_lat": 24.1, "min_lon": 68.8, "max_lon": 71.0
    }
}

def generate_synthetic_scenario(req: SyntheticGenerateRequest) -> Scenario:
    """
    Generates a synthetic scenario for scaling and benchmarking.
    Labels all data clearly as non-sensitive synthetic placeholders.
    """
    coord_mode = req.coordinate_mode
    scenario_id = str(uuid.uuid4())[:8]

    if coord_mode == "geo":
        preset = INDIAN_REGION_PRESETS.get(req.preset_region or "punjab", INDIAN_REGION_PRESETS["punjab"])
        min_lat = req.bbox.get("min_lat", preset["min_lat"]) if req.bbox else preset["min_lat"]
        max_lat = req.bbox.get("max_lat", preset["max_lat"]) if req.bbox else preset["max_lat"]
        min_lon = req.bbox.get("min_lon", preset["min_lon"]) if req.bbox else preset["min_lon"]
        max_lon = req.bbox.get("max_lon", preset["max_lon"]) if req.bbox else preset["max_lon"]
        name = f"Synthetic Defense - {preset['name']}"
    else:
        min_x = req.bbox.get("min_x", 0.0) if req.bbox else 0.0
        max_x = req.bbox.get("max_x", 50.0) if req.bbox else 50.0
        min_y = req.bbox.get("min_y", 0.0) if req.bbox else 0.0
        max_y = req.bbox.get("max_y", 50.0) if req.bbox else 50.0
        name = f"Synthetic Grid Sector ({req.num_assets} assets, {req.num_sites} sites)"

    # Asset generation
    assets: List[Asset] = []
    asset_types = ["Communication Relay", "Fuel Reserve", "Command Post", "Radar Array", "Power Station", "Hangar"]
    for i in range(1, req.num_assets + 1):
        a_val = round(random.uniform(req.value_min, req.value_max), 1)
        a_lam = round(random.uniform(req.threat_min, req.threat_max), 2)
        a_name = f"{random.choice(asset_types)} #{i}"

        if coord_mode == "geo":
            lat = round(random.uniform(min_lat, max_lat), 4)
            lon = round(random.uniform(min_lon, max_lon), 4)
            assets.append(
                Asset(
                    id=f"A{i}",
                    name=a_name,
                    lat=lat,
                    lon=lon,
                    value=a_val,
                    threat_rate=a_lam,
                    region=req.preset_region
                )
            )
        else:
            x = round(random.uniform(min_x, max_x), 2)
            y = round(random.uniform(min_y, max_y), 2)
            assets.append(
                Asset(
                    id=f"A{i}",
                    name=a_name,
                    x=x,
                    y=y,
                    value=a_val,
                    threat_rate=a_lam,
                    region=req.preset_region
                )
            )

    # Site generation
    sites: List[CandidateSite] = []
    for j in range(1, req.num_sites + 1):
        cost = round(random.uniform(req.cost_min, req.cost_max), 1)
        r_km = round(random.uniform(req.range_min, req.range_max), 1)

        if coord_mode == "geo":
            lat = round(random.uniform(min_lat, max_lat), 4)
            lon = round(random.uniform(min_lon, max_lon), 4)
            sites.append(
                CandidateSite(
                    id=f"S{j}",
                    name=f"Candidate Site #{j}",
                    lat=lat,
                    lon=lon,
                    cost=cost,
                    range_km=r_km,
                    max_channels=12,
                    channel_cost=0.0,
                    region=req.preset_region
                )
            )
        else:
            x = round(random.uniform(min_x, max_x), 2)
            y = round(random.uniform(min_y, max_y), 2)
            sites.append(
                CandidateSite(
                    id=f"S{j}",
                    name=f"Candidate Site #{j}",
                    x=x,
                    y=y,
                    cost=cost,
                    range_km=r_km,
                    max_channels=12,
                    channel_cost=0.0,
                    region=req.preset_region
                )
            )

    # Budget default: roughly 50% of total site costs if not specified
    tot_cost = sum(s.cost for s in sites)
    calc_budget = req.budget if req.budget is not None else round(tot_cost * 0.45, 1)

    params = GlobalParameters(
        budget=calc_budget,
        mean_engagement_time_min=1.5,
        target_leak_probability=0.05,
        attack_duration_min=30.0,
        shots_per_engagement=1,
        underage_cost=50.0,
        overage_cost=5.0,
        interceptor_unit_cost=2.0,
        high_value_threshold=round((req.value_min + req.value_max) / 2.0, 1)
    )

    return Scenario(
        id=scenario_id,
        name=name,
        notes="Synthetic, non-sensitive benchmark scenario generated for Operations Research testing.",
        coordinate_mode=coord_mode,
        assets=assets,
        sites=sites,
        parameters=params
    )

def solve_multi_region_scenario(
    scenario: Scenario,
    custom_region_budgets: Optional[Dict[str, float]] = None
) -> FullPlanResponse:
    """
    Decomposes a multi-region scenario into independent regional sub-problems,
    solves each region within its allocated budget, and merges the resulting plans.
    Budget allocation defaults to proportional to total asset value in each region.
    """
    start_time = time.time()
    # Group assets and sites by region
    regions: Dict[str, List[Asset]] = {}
    for a in scenario.assets:
        reg = a.region or "DefaultRegion"
        regions.setdefault(reg, []).append(a)

    sites_by_reg: Dict[str, List[CandidateSite]] = {}
    for s in scenario.sites:
        reg = s.region or "DefaultRegion"
        sites_by_reg.setdefault(reg, []).append(s)

    # Allocate budget
    total_budget = scenario.parameters.budget
    total_asset_val = sum(a.value for a in scenario.assets)

    regional_budgets: Dict[str, float] = {}
    for reg, reg_assets in regions.items():
        if custom_region_budgets and reg in custom_region_budgets:
            regional_budgets[reg] = custom_region_budgets[reg]
        else:
            reg_val = sum(a.value for a in reg_assets)
            ratio = (reg_val / total_asset_val) if total_asset_val > 0 else (1.0 / len(regions))
            regional_budgets[reg] = round(total_budget * ratio, 2)

    # Solve each region
    regional_plans: Dict[str, FullPlanResponse] = {}
    all_warnings: List[str] = []

    for reg, reg_assets in regions.items():
        reg_sites = sites_by_reg.get(reg, [])
        reg_params = scenario.parameters.model_copy(deep=True)
        reg_params.budget = regional_budgets[reg]

        sub_scenario = Scenario(
            name=f"{scenario.name} - Region {reg}",
            coordinate_mode=scenario.coordinate_mode,
            assets=reg_assets,
            sites=reg_sites,
            parameters=reg_params
        )

        sub_plan = run_defense_pipeline(sub_scenario)
        regional_plans[reg] = sub_plan
        for w in sub_plan.warnings:
            all_warnings.append(f"[{reg}] {w}")

    # Merge results
    merged_opened_sites: List[str] = []
    merged_site_results = []
    merged_assignments = []
    total_val_prot = 0.0
    total_site_cost = 0.0
    merged_uncovered = []
    merged_site_loads = {}
    merged_offered_loads = {}
    merged_site_channels = {}
    total_channels = 0
    worst_leak = 0.0
    merged_site_inventory = {}
    total_stock = 0
    merged_site_reserves = {}
    total_reserve = 0
    high_priority_covered = []

    for reg, plan in regional_plans.items():
        merged_opened_sites.extend(plan.location.opened_sites)
        merged_site_results.extend(plan.location.site_results)
        merged_assignments.extend(plan.location.assignments)
        total_val_prot += plan.location.total_value_protected
        total_site_cost += plan.location.total_site_cost
        merged_uncovered.extend(plan.location.uncovered_assets)

        merged_site_loads.update(plan.load.site_loads)
        merged_offered_loads.update(plan.load.offered_loads)

        merged_site_channels.update(plan.channels.site_channels)
        total_channels += plan.channels.total_channels
        if plan.channels.worst_site_leak_prob > worst_leak:
            worst_leak = plan.channels.worst_site_leak_prob

        merged_site_inventory.update(plan.inventory.site_inventory)
        total_stock += plan.inventory.total_stock_Q_star

        merged_site_reserves.update(plan.reserve.site_reserves)
        total_reserve += plan.reserve.reserve_y1_star
        high_priority_covered.extend(plan.reserve.high_priority_asset_ids)

    elapsed = time.time() - start_time

    # Merged location output
    pct_val = (total_val_prot / total_asset_val * 100.0) if total_asset_val > 0 else 0.0
    merged_location = Step1LocationOutput(
        status="MultiRegionOptimal",
        opened_sites=merged_opened_sites,
        site_results=merged_site_results,
        assignments=merged_assignments,
        total_value_protected=round(total_val_prot, 2),
        total_possible_value=total_asset_val,
        pct_value_protected=round(pct_val, 2),
        total_site_cost=round(total_site_cost, 2),
        budget=total_budget,
        channel_cost_total=0.0,
        total_cost_with_channels=round(total_site_cost, 2),
        budget_exceeded=False,
        solver_used="multi_region_decomposition",
        uncovered_assets=merged_uncovered,
        solve_time_sec=round(elapsed, 4),
        n_vars=sum(p.location.n_vars for p in regional_plans.values()),
        n_constraints=sum(p.location.n_constraints for p in regional_plans.values())
    )

    merged_load = Step2LoadOutput(
        site_loads=merged_site_loads,
        offered_loads=merged_offered_loads,
        total_system_load=round(sum(merged_site_loads.values()), 4)
    )

    merged_channels = Step3QueueingOutput(
        site_channels=merged_site_channels,
        total_channels=total_channels,
        system_weighted_leak_prob=round(worst_leak, 4),
        worst_site_leak_prob=round(worst_leak, 4),
        all_targets_met=all(p.channels.all_targets_met for p in regional_plans.values())
    )

    merged_inventory = Step4InventoryOutput(
        demand_mode="derived",
        mu_D=sum(p.inventory.mu_D for p in regional_plans.values()),
        sigma_D=sum(p.inventory.sigma_D for p in regional_plans.values()),
        critical_ratio=scenario.parameters.underage_cost / (scenario.parameters.underage_cost + scenario.parameters.overage_cost),
        z_score=0.0,
        total_stock_Q_star=total_stock,
        site_inventory=merged_site_inventory,
        derivation_text=f"Multi-region aggregation across {len(regional_plans)} regions."
    )

    booking_lim = max(0, total_stock - total_reserve)
    merged_reserve = Step5ReserveOutput(
        high_priority_asset_ids=high_priority_covered,
        mu_1=sum(p.reserve.mu_1 for p in regional_plans.values()),
        sigma_1=sum(p.reserve.sigma_1 for p in regional_plans.values()),
        r1=100.0,
        r2=30.0,
        ratio_r2_r1=0.3,
        reserve_y1_star=total_reserve,
        booking_limit_low_value=booking_lim,
        site_reserves=merged_site_reserves,
        plain_english_rule=f"Keep {total_reserve} interceptors back across all regions for high-value assets; low-value threats can use at most {booking_lim}.",
        explanation=f"Aggregated Littlewood reserve across {len(regional_plans)} regional sub-problems."
    )

    meta = {
        "pipeline_total_time_ms": round(elapsed * 1000.0, 2),
        "multi_region": True,
        "region_count": len(regional_plans),
        "regional_budgets": regional_budgets,
        "solver_status": "MultiRegionOptimal"
    }

    working = [
        WorkingStep(
            step_number=1,
            title="Multi-Region Problem Decomposition",
            details=[
                f"Split into {len(regional_plans)} regions: {', '.join(regional_plans.keys())}.",
                f"Total budget ₹{total_budget:,.2f} partitioned by asset value."
            ] + [f"Region {r}: Budget = ₹{b:,.2f}, Sites opened = {len(p.location.opened_sites)}" for r, b in regional_budgets.items() for p in [regional_plans[r]]]
        )
    ]

    return FullPlanResponse(
        scenario_id=scenario.id,
        scenario_name=f"{scenario.name} (Multi-Region Merged)",
        location=merged_location,
        load=merged_load,
        channels=merged_channels,
        inventory=merged_inventory,
        reserve=merged_reserve,
        comparison=[],
        working=working,
        warnings=all_warnings,
        meta=meta
    )
