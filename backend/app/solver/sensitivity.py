import copy
from typing import Dict, List, Optional, Tuple
import numpy as np
from app.models import (
    Scenario, SensitivityRequest, SensitivityResponse,
    SensitivityPoint
)
from app.solver.pipeline import run_defense_pipeline

def detect_budget_knee(
    points: List[SensitivityPoint],
    epsilon_pct: float = 1.0
) -> Tuple[Optional[float], Optional[str]]:
    """
    Detects the 'knee' point where marginal value protected per additional budget unit
    falls below epsilon_pct % of the maximum initial slope.
    """
    if len(points) < 3:
        return None, None

    x_vals = [p.param_value for p in points]
    y_vals = [p.value_protected for p in points]

    slopes: List[float] = []
    for i in range(len(points) - 1):
        dx = x_vals[i + 1] - x_vals[i]
        dy = y_vals[i + 1] - y_vals[i]
        slopes.append(dy / dx if dx > 0 else 0.0)

    max_slope = max(slopes) if slopes else 0.0
    if max_slope <= 1e-6:
        return None, "Value protected does not increase across the evaluated budget range."

    threshold = (epsilon_pct / 100.0) * max_slope

    knee_val: Optional[float] = None
    for i, slope in enumerate(slopes):
        if slope <= threshold:
            knee_val = x_vals[i]
            break

    if knee_val is not None:
        msg = f"Above ₹{knee_val:,.1f}, extra budget yields diminishing protection (< {epsilon_pct}% of peak efficiency)."
    else:
        msg = "Budget continues to yield positive returns across all tested levels."

    return knee_val, msg

def run_sensitivity_analysis(req: SensitivityRequest) -> SensitivityResponse:
    """
    Executes a 1D or 2D parameter sweep across the full 5-step defense optimization pipeline.
    """
    base_scenario = req.scenario
    steps = max(2, min(req.steps, 50))
    val_range = np.linspace(req.start, req.end, steps)

    points: List[SensitivityPoint] = []

    for val in val_range:
        sc = copy.deepcopy(base_scenario)
        param_name = req.param

        if param_name == "budget":
            sc.parameters.budget = float(val)
        elif param_name == "threat_multiplier":
            for a in sc.assets:
                a.threat_rate = float(a.threat_rate * val)
        elif param_name == "target_leak_probability":
            sc.parameters.target_leak_probability = float(val)
        elif param_name == "mean_engagement_time_min":
            sc.parameters.mean_engagement_time_min = float(val)
        elif param_name == "underage_cost":
            sc.parameters.underage_cost = float(val)
        elif param_name == "overage_cost":
            sc.parameters.overage_cost = float(val)
        elif param_name == "r2_r1_ratio":
            # Force r1=100 and r2 = 100 * val
            sc.parameters.r1_override = 100.0
            sc.parameters.r2_override = float(100.0 * val)

        res = run_defense_pipeline(sc)
        points.append(
            SensitivityPoint(
                param_value=round(float(val), 4),
                value_protected=round(res.location.total_value_protected, 2),
                pct_value_protected=round(res.location.pct_value_protected, 2),
                total_channels=res.channels.total_channels,
                total_stock_Q_star=res.inventory.total_stock_Q_star,
                reserve_y1_star=res.reserve.reserve_y1_star,
                total_cost=round(res.location.total_site_cost, 2),
                worst_leak_prob=round(res.channels.worst_site_leak_prob, 4)
            )
        )

    knee_point, knee_msg = None, None
    if req.param == "budget":
        knee_point, knee_msg = detect_budget_knee(points, req.knee_epsilon_pct)

    # Optional 2D Heatmap (e.g. Budget x Threat Multiplier)
    heatmap_data = None
    if req.two_d_param and req.two_d_start is not None and req.two_d_end is not None:
        dim2_steps = req.two_d_steps or 6
        dim2_vals = np.linspace(req.two_d_start, req.two_d_end, dim2_steps)
        heatmap_data = []

        # Subsample param1 to at most 6 for speed
        sub_steps = min(6, steps)
        sub_p1_vals = np.linspace(req.start, req.end, sub_steps)

        for v1 in sub_p1_vals:
            for v2 in dim2_vals:
                sc = copy.deepcopy(base_scenario)
                # Apply param 1
                if req.param == "budget":
                    sc.parameters.budget = float(v1)
                elif req.param == "threat_multiplier":
                    for a in sc.assets:
                        a.threat_rate *= float(v1)

                # Apply param 2
                if req.two_d_param == "threat_multiplier":
                    for a in sc.assets:
                        a.threat_rate *= float(v2)
                elif req.two_d_param == "budget":
                    sc.parameters.budget = float(v2)

                res2d = run_defense_pipeline(sc)
                heatmap_data.append({
                    req.param: round(float(v1), 2),
                    req.two_d_param: round(float(v2), 2),
                    "pct_value_protected": round(res2d.location.pct_value_protected, 2),
                    "channels": res2d.channels.total_channels,
                    "stock": res2d.inventory.total_stock_Q_star
                })

    return SensitivityResponse(
        param=req.param,
        points=points,
        knee_point=knee_point,
        knee_message=knee_msg,
        heatmap=heatmap_data
    )
