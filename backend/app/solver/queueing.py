from typing import Dict, List, Tuple
from app.models import (
    Step2LoadOutput, CandidateSite, Step3QueueingOutput,
    SiteChannelResult, ChannelCurvePoint
)

def erlang_b_loss(c: int, a: float) -> float:
    """
    Numerically stable recursive Erlang-B loss probability:
      B(0, a) = 1.0
      B(c, a) = (a * B(c - 1, a)) / (c + a * B(c - 1, a))
    For a == 0 and c >= 1, returns 0.0.
    """
    if a <= 0.0:
        return 1.0 if c == 0 else 0.0
    if c <= 0:
        return 1.0

    b = 1.0
    for k in range(1, c + 1):
        b = (a * b) / (k + a * b)
    return b

def compute_channel_curve(max_c: int, a: float) -> List[ChannelCurvePoint]:
    """
    Generates Erlang-B leak probability curve and marginal leak reduction
    for channels 1 to max_c.
    """
    points: List[ChannelCurvePoint] = []
    prev_b = 1.0
    for c in range(1, max_c + 1):
        cur_b = erlang_b_loss(c, a)
        marginal = prev_b - cur_b
        points.append(
            ChannelCurvePoint(
                channels=c,
                leak_probability=round(cur_b, 6),
                marginal_reduction=round(marginal, 6)
            )
        )
        prev_b = cur_b
    return points

def size_engagement_channels_step(
    load_output: Step2LoadOutput,
    sites: List[CandidateSite],
    target_leak_probability: float
) -> Step3QueueingOutput:
    """
    Step 3: Size engagement channels per open site using Erlang-B loss model.
    Chooses smallest c such that B(c, a_j) <= alpha.
    """
    site_dict = {s.id: s for s in sites}
    site_channels: Dict[str, SiteChannelResult] = {}
    total_channels = 0
    total_threats = load_output.total_system_load
    total_leaked_threats = 0.0
    all_met = True
    worst_leak = 0.0

    for s_id, lambda_j in load_output.site_loads.items():
        site = site_dict[s_id]
        a_j = load_output.offered_loads.get(s_id, 0.0)
        max_c = site.max_channels

        curve = compute_channel_curve(max_c, a_j)

        if lambda_j <= 0.0 or a_j <= 0.0:
            site_channels[s_id] = SiteChannelResult(
                site_id=s_id,
                lambda_rate=lambda_j,
                offered_load_erlangs=a_j,
                channels_allocated=0,
                leak_probability=0.0,
                target_met=True,
                expected_leaks_per_min=0.0,
                curve=curve,
                note="No threat load assigned"
            )
            continue

        # Sizing search: smallest c such that B(c, a_j) <= alpha
        allocated_c = max_c
        target_met = False
        leak_p = 1.0

        for pt in curve:
            if pt.leak_probability <= (target_leak_probability + 1e-9):
                allocated_c = pt.channels
                leak_p = pt.leak_probability
                target_met = True
                break

        if not target_met:
            allocated_c = max_c
            leak_p = curve[-1].leak_probability if curve else 1.0
            note = f"Target leak {target_leak_probability:.2f} not achievable within cap of {max_c} channels"
            all_met = False
        else:
            note = None

        if leak_p > worst_leak:
            worst_leak = leak_p

        expected_leaks = lambda_j * leak_p
        total_leaked_threats += expected_leaks
        total_channels += allocated_c

        site_channels[s_id] = SiteChannelResult(
            site_id=s_id,
            lambda_rate=lambda_j,
            offered_load_erlangs=a_j,
            channels_allocated=allocated_c,
            leak_probability=round(leak_p, 6),
            target_met=target_met,
            expected_leaks_per_min=round(expected_leaks, 4),
            curve=curve,
            note=note
        )

    sys_leak_prob = (total_leaked_threats / total_threats) if total_threats > 0 else 0.0

    return Step3QueueingOutput(
        site_channels=site_channels,
        total_channels=total_channels,
        system_weighted_leak_prob=round(sys_leak_prob, 6),
        worst_site_leak_prob=round(worst_leak, 6),
        all_targets_met=all_met
    )
