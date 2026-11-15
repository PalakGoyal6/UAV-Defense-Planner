import math
from typing import Dict, List, Tuple
from scipy.stats import norm
from app.models import (
    CandidateSite, Scenario, Step2LoadOutput, Step3QueueingOutput,
    Step4InventoryOutput, SiteInventoryResult
)
from app.solver.geometry import compute_depot_distance

def largest_remainder_round(total_units: int, shares: Dict[str, float]) -> Dict[str, int]:
    """
    Apportions total_units among keys according to fractional shares
    using the Hare-Niemeyer / Largest Remainder method so that the sum
    of integer apportionments equals total_units exactly.
    """
    if total_units <= 0 or not shares:
        return {k: 0 for k in shares}

    sum_shares = sum(shares.values())
    if sum_shares <= 0:
        # Distribute equally / first
        keys = list(shares.keys())
        base = total_units // len(keys)
        rem = total_units % len(keys)
        res = {k: base for k in keys}
        for i in range(rem):
            res[keys[i]] += 1
        return res

    normalized = {k: v / sum_shares for k, v in shares.items()}
    quotas = {k: total_units * normalized[k] for k in shares}
    floored = {k: int(math.floor(quotas[k])) for k in shares}
    remainders = {k: quotas[k] - floored[k] for k in shares}

    allocated = sum(floored.values())
    shortfall = total_units - allocated

    # Sort keys by largest remainder descending
    sorted_keys = sorted(shares.keys(), key=lambda k: remainders[k], reverse=True)
    for i in range(shortfall):
        floored[sorted_keys[i % len(sorted_keys)]] += 1

    return floored

def compute_inventory_step(
    scenario: Scenario,
    load_output: Step2LoadOutput,
    queueing_output: Step3QueueingOutput
) -> Step4InventoryOutput:
    """
    Step 4: Stock and reorder rule (inventory optimization).
    Newsvendor starting stock Q* + (s, Q) reorder policy per site.
    """
    params = scenario.parameters
    site_dict = {s.id: s for s in scenario.sites}
    opened_sites = list(queueing_output.site_channels.keys())

    # 1. Demand derivation / manual mode
    if params.demand_mode == "manual" and params.manual_mean_demand is not None:
        mu_D = float(params.manual_mean_demand)
        sigma_D = float(params.manual_sd_demand) if params.manual_sd_demand is not None else math.sqrt(max(0.1, mu_D))
        derivation = f"Manual demand specified: mu_D = {mu_D:.2f}, sigma_D = {sigma_D:.2f}"
    else:
        # Derived mode:
        # mu_D = k * T * sum_j Lambda_j * (1 - B(c_j, a_j))
        k = params.shots_per_engagement
        T = params.attack_duration_min
        non_leaked_sum = sum(
            res.lambda_rate * (1.0 - res.leak_probability)
            for res in queueing_output.site_channels.values()
        )
        mu_D = k * T * non_leaked_sum
        sigma_D = math.sqrt(max(0.0, k * mu_D))
        derivation = (
            f"Derived demand: mu_D = k * T * sum(Lambda_j * (1 - B_j)) = "
            f"{k} * {T} * {non_leaked_sum:.4f} = {mu_D:.2f} interceptors; "
            f"sigma_D = sqrt(k * mu_D) = {sigma_D:.2f} (Poisson arrival scaling)."
        )

    # 2. Newsvendor Critical Ratio & Target Stock Q*
    Cu = params.underage_cost
    Co = params.overage_cost
    critical_ratio = Cu / (Cu + Co)
    z_score = float(norm.ppf(critical_ratio))
    raw_Q_star = mu_D + z_score * sigma_D
    total_Q_star = max(0, int(math.ceil(raw_Q_star)))

    # Apportion Q* among sites proportional to Lambda_j
    lambda_shares = {s_id: load_output.site_loads.get(s_id, 0.0) for s_id in opened_sites}
    stock_distribution = largest_remainder_round(total_Q_star, lambda_shares)

    # 3. Reorder point (s_j) and EOQ per site
    site_inventory: Dict[str, SiteInventoryResult] = {}
    sum_lambda = load_output.total_system_load

    # Baseline daily demand: default to mu_D if not explicitly given
    system_daily_mean = params.daily_demand_mean if params.daily_demand_mean is not None else max(1.0, mu_D)
    system_daily_sd = params.daily_demand_sd if params.daily_demand_sd is not None else max(0.5, sigma_D)

    z_SL = float(norm.ppf(params.target_service_level))
    K = params.order_setup_cost
    h = params.holding_cost_per_unit_per_day

    for s_id in opened_sites:
        site = site_dict[s_id]
        lam = load_output.site_loads.get(s_id, 0.0)
        lam_share = (lam / sum_lambda) if sum_lambda > 0 else (1.0 / max(1, len(opened_sites)))

        # Depot distance and Lead Time L_j
        depot_dist = compute_depot_distance(site, scenario)
        lead_time = params.base_lead_time_days + (depot_dist / params.transport_speed_km_per_day)

        # Site daily demand
        site_daily_mean = system_daily_mean * lam_share
        site_daily_sd = system_daily_sd * math.sqrt(max(0.01, lam_share))

        # Lead time demand distribution
        mu_L = site_daily_mean * lead_time
        sigma_L = site_daily_sd * math.sqrt(max(0.01, lead_time))
        s_reorder = max(0, int(math.ceil(mu_L + z_SL * sigma_L)))

        # EOQ = sqrt(2 * D * K / h)
        eoq = int(math.ceil(math.sqrt(max(1.0, 2.0 * site_daily_mean * K / h))))

        plain_rule = f"When stock at site {s_id} falls to {s_reorder}, order {eoq} interceptors."

        site_inventory[s_id] = SiteInventoryResult(
            site_id=s_id,
            lambda_share=round(lam_share, 4),
            allocated_stock_Q=stock_distribution.get(s_id, 0),
            depot_distance_km=round(depot_dist, 2),
            lead_time_days=round(lead_time, 2),
            reorder_point_s=s_reorder,
            suggested_order_qty_EOQ=eoq,
            plain_english_rule=plain_rule
        )

    return Step4InventoryOutput(
        demand_mode=params.demand_mode,
        mu_D=round(mu_D, 4),
        sigma_D=round(sigma_D, 4),
        critical_ratio=round(critical_ratio, 4),
        z_score=round(z_score, 4),
        total_stock_Q_star=total_Q_star,
        site_inventory=site_inventory,
        derivation_text=derivation
    )
