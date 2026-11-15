from typing import Dict, List
from app.models import LocationAssignment, Step2LoadOutput

def compute_threat_load_step(
    assignments: List[LocationAssignment],
    opened_sites: List[str],
    mean_engagement_time_min: float
) -> Step2LoadOutput:
    """
    Step 2: Threat load per site.
    Formula:
      Lambda_j = sum_{i: x_ij=1} lambda_i  (threats/minute)
      Offered load a_j = Lambda_j / mu = Lambda_j * mean_engagement_time_min (Erlangs)
    """
    site_loads: Dict[str, float] = {s_id: 0.0 for s_id in opened_sites}
    offered_loads: Dict[str, float] = {s_id: 0.0 for s_id in opened_sites}

    for assign in assignments:
        if assign.covered and assign.site_id in site_loads:
            site_loads[assign.site_id] += assign.threat_rate

    # Round appropriately
    for s_id in opened_sites:
        load = site_loads[s_id]
        site_loads[s_id] = round(load, 4)
        offered_loads[s_id] = round(load * mean_engagement_time_min, 4)

    total_load = round(sum(site_loads.values()), 4)

    return Step2LoadOutput(
        site_loads=site_loads,
        offered_loads=offered_loads,
        total_system_load=total_load
    )
