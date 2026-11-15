import math
from typing import Dict, List
from scipy.stats import norm
from app.models import (
    Scenario, Step1LocationOutput, Step3QueueingOutput,
    Step4InventoryOutput, Step5ReserveOutput
)
from app.solver.inventory import largest_remainder_round

def compute_reserve_step(
    scenario: Scenario,
    location_output: Step1LocationOutput,
    queueing_output: Step3QueueingOutput,
    inventory_output: Step4InventoryOutput
) -> Step5ReserveOutput:
    """
    Step 5: Littlewood's rule for high-value protection reserve.
    y_1* = mu_1 + sigma_1 * Phi^-1(1 - r2 / r1), rounded up, clamped to [0, Q*].
    """
    params = scenario.parameters
    k = params.shots_per_engagement
    T = params.attack_duration_min
    Q_star = inventory_output.total_stock_Q_star

    # Group covered assets
    high_priority_covered: List[str] = []
    low_priority_covered: List[str] = []
    high_threat_by_site: Dict[str, float] = {s_id: 0.0 for s_id in queueing_output.site_channels}

    # Map asset_id to threat and value
    asset_dict = {a.id: a for a in scenario.assets}

    for assign in location_output.assignments:
        if not assign.covered or not assign.site_id:
            continue
        a = asset_dict[assign.asset_id]
        if assign.priority_class == "high":
            high_priority_covered.append(a.id)
            high_threat_by_site[assign.site_id] = high_threat_by_site.get(assign.site_id, 0.0) + a.threat_rate
        else:
            low_priority_covered.append(a.id)

    # Compute high-class mean non-leaked demand mu_1
    mu_1 = 0.0
    for s_id, high_lam in high_threat_by_site.items():
        leak_p = queueing_output.site_channels[s_id].leak_probability
        mu_1 += k * T * high_lam * (1.0 - leak_p)

    sigma_1 = math.sqrt(max(0.0, k * mu_1))

    # Compute r1 and r2 (weighted average asset value or overrides)
    if params.r1_override is not None and params.r1_override > 0:
        r1 = float(params.r1_override)
    else:
        # High value class assets
        high_assets = [a for a in scenario.assets if (a.priority_class == "high" or a.id in high_priority_covered)]
        sum_w_lam_high = sum(a.value * a.threat_rate for a in high_assets)
        sum_lam_high = sum(a.threat_rate for a in high_assets)
        r1 = (sum_w_lam_high / sum_lam_high) if sum_lam_high > 0 else (
            sum(a.value for a in high_assets) / max(1, len(high_assets)) if high_assets else 100.0
        )

    if params.r2_override is not None and params.r2_override > 0:
        r2 = float(params.r2_override)
    else:
        low_assets = [a for a in scenario.assets if (a.priority_class == "low" or a.id in low_priority_covered)]
        sum_w_lam_low = sum(a.value * a.threat_rate for a in low_assets)
        sum_lam_low = sum(a.threat_rate for a in low_assets)
        r2 = (sum_w_lam_low / sum_lam_low) if sum_lam_low > 0 else (
            sum(a.value for a in low_assets) / max(1, len(low_assets)) if low_assets else 30.0
        )

    ratio = r2 / r1 if r1 > 0 else 1.0

    if ratio >= 1.0 or r1 <= 0 or mu_1 <= 0:
        y1_star = 0
        booking_limit = Q_star
        explanation = (
            f"Protection value of low-priority class (r2 = {r2:.2f}) meets or exceeds high-priority class "
            f"(r1 = {r1:.2f}) or zero high-priority demand; no interceptors reserved exclusively."
        )
    else:
        # Littlewood calculation: P(D_1 > y1*) = r2 / r1 => y1* = mu1 + sigma1 * Phi^-1(1 - r2 / r1)
        z_reserve = float(norm.ppf(1.0 - ratio))
        raw_y1 = mu_1 + z_reserve * sigma_1
        # Round up and clamp to [0, Q*]
        y1_star = min(Q_star, max(0, int(math.ceil(raw_y1))))
        booking_limit = max(0, Q_star - y1_star)
        explanation = (
            f"Littlewood target: P(D_1 > y_1*) = r2/r1 = {ratio:.4f}. "
            f"With mu_1 = {mu_1:.2f}, sigma_1 = {sigma_1:.2f}, z = {z_reserve:.4f} => "
            f"Reserve {y1_star} units for high-value assets."
        )

    # Split reserve per site in proportion to each site's high-value threat load
    site_reserves = largest_remainder_round(y1_star, high_threat_by_site)

    # High-value asset names
    high_names = [asset_dict[aid].name for aid in high_priority_covered]
    high_names_str = ", ".join(high_names) if high_names else "High-value assets"

    plain_english = (
        f"Keep {y1_star} interceptor(s) back for {high_names_str}; "
        f"low-value threats can use at most {booking_limit}."
    )

    return Step5ReserveOutput(
        high_priority_asset_ids=high_priority_covered,
        mu_1=round(mu_1, 4),
        sigma_1=round(sigma_1, 4),
        r1=round(r1, 2),
        r2=round(r2, 2),
        ratio_r2_r1=round(ratio, 4),
        reserve_y1_star=y1_star,
        booking_limit_low_value=booking_limit,
        site_reserves=site_reserves,
        plain_english_rule=plain_english,
        explanation=explanation
    )
