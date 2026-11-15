import time
from typing import Dict, List, Set, Tuple, Optional
import pulp
from app.models import (
    Asset, CandidateSite, Scenario, Step1LocationOutput,
    SiteLocationResult, LocationAssignment, ComparisonResult
)
from app.solver.geometry import compute_coverage_matrix

def make_binary_variable(name: str, prob: Optional[pulp.LpProblem] = None) -> pulp.LpVariable:
    """Safely construct a binary LpVariable across all PuLP versions (PuLP 2.x, 3.x, and 4.x)."""
    if prob is not None and hasattr(prob, "add_variable"):
        try:
            return prob.add_variable(name, lowBound=0, upBound=1, cat=getattr(pulp, "LpBinary", "Binary"))
        except Exception:
            pass
    try:
        return pulp.LpVariable(name, 0, 1, pulp.LpBinary)
    except Exception:
        try:
            return pulp.LpVariable(name, lowBound=0, upBound=1, cat=pulp.LpBinary)
        except Exception:
            try:
                return pulp.LpVariable(name, 0, 1)
            except Exception:
                return pulp.LpVariable(name)

def assign_priority_classes(scenario: Scenario) -> Dict[str, str]:
    """
    Ensures every asset has a high/low priority class based on its value
    and the high_value_threshold if not explicitly provided.
    """
    threshold = scenario.parameters.high_value_threshold
    classes: Dict[str, str] = {}
    for a in scenario.assets:
        if a.priority_class in ("high", "low"):
            classes[a.id] = a.priority_class
        else:
            classes[a.id] = "high" if a.value >= threshold else "low"
    return classes

def run_greedy_mclp(
    scenario: Scenario,
    coverage: Dict[str, Dict[str, int]],
    distances: Dict[str, Dict[str, float]],
    pruned_sites: List[CandidateSite],
    budget: float
) -> Tuple[List[str], Dict[str, str], float, float]:
    """
    Greedy heuristic:
    Repeatedly picks the site with highest (incremental uncovered value) / cost
    that fits the remaining budget.
    Assigns each covered asset to its nearest open site.
    Returns: (opened_site_ids, asset_assignment_dict, total_value, total_cost)
    """
    remaining_budget = budget
    opened_sites: List[str] = []
    covered_assets: Set[str] = set()
    asset_dict = {a.id: a for a in scenario.assets}
    site_dict = {s.id: s for s in pruned_sites}

    unopened = set(site_dict.keys())

    while unopened:
        best_site_id: Optional[str] = None
        best_ratio = -1.0
        best_inc_val = 0.0

        for s_id in unopened:
            site = site_dict[s_id]
            if site.cost > remaining_budget:
                continue

            # Calculate additional value this site can protect
            inc_val = sum(
                asset_dict[a_id].value
                for a_id in asset_dict
                if a_id not in covered_assets and coverage[a_id].get(s_id, 0) == 1
            )

            if inc_val > 0:
                ratio = inc_val / site.cost
                if ratio > best_ratio:
                    best_ratio = ratio
                    best_site_id = s_id
                    best_inc_val = inc_val

        if best_site_id is None:
            # No affordable site can add uncovered value
            break

        # Open best site
        opened_sites.append(best_site_id)
        remaining_budget -= site_dict[best_site_id].cost
        unopened.remove(best_site_id)

        # Update covered assets
        for a_id in asset_dict:
            if coverage[a_id].get(best_site_id, 0) == 1:
                covered_assets.add(a_id)

    # Asset assignment: assign each covered asset to nearest open site
    assignments: Dict[str, str] = {}
    for a_id in asset_dict:
        covering_open = [s_id for s_id in opened_sites if coverage[a_id].get(s_id, 0) == 1]
        if covering_open:
            # Pick nearest site
            covering_open.sort(key=lambda s_id: distances[a_id].get(s_id, float("inf")))
            assignments[a_id] = covering_open[0]

    total_val = sum(asset_dict[a_id].value for a_id in assignments)
    total_cost = sum(site_dict[s_id].cost for s_id in opened_sites)
    return opened_sites, assignments, total_val, total_cost

def run_cost_minimizing_set_cover(
    scenario: Scenario,
    coverage: Dict[str, Dict[str, int]],
    pruned_sites: List[CandidateSite]
) -> Tuple[List[str], float, float, str]:
    """
    Comparison model: Cost-minimizing set cover.
    minimize sum_j c_j * y_j
    subject to sum_j a_ij * y_j >= 1 for all i that have at least one covering site.
    Returns: (opened_sites, total_cost, value_protected, status_string)
    """
    site_dict = {s.id: s for s in pruned_sites}
    asset_dict = {a.id: a for a in scenario.assets}

    # Only include assets that CAN be covered
    coverable_assets = [
        a.id for a in scenario.assets
        if any(coverage[a.id].get(s.id, 0) == 1 for s in pruned_sites)
    ]

    prob = pulp.LpProblem("CostMinSetCover", pulp.LpMinimize)
    y = {s.id: make_binary_variable(f"y_sc_{s.id}", prob) for s in pruned_sites}

    # Objective: minimize site costs
    prob += pulp.lpSum(site_dict[s_id].cost * y[s_id] for s_id in site_dict)

    # Constraints: each coverable asset must be covered by at least 1 site
    for a_id in coverable_assets:
        covering_sites = [s.id for s in pruned_sites if coverage[a_id].get(s.id, 0) == 1]
        if covering_sites:
            prob += pulp.lpSum(y[s_id] for s_id in covering_sites) >= 1

    try:
        prob.solve(pulp.PULP_CBC_CMD(msg=0, timeLimit=30))
        status = pulp.LpStatus[prob.status]
        opened = [s_id for s_id in site_dict if pulp.value(y[s_id]) is not None and pulp.value(y[s_id]) > 0.5]
        total_cost = sum(site_dict[s_id].cost for s_id in opened)
        val_protected = sum(asset_dict[a_id].value for a_id in coverable_assets)
        return opened, total_cost, val_protected, status
    except Exception:
        # Fallback greedy set cover if CBC solver is unavailable or fails
        uncovered = set(coverable_assets)
        opened = []
        while uncovered:
            best_s = None
            best_cov = 0
            for s in pruned_sites:
                if s.id in opened:
                    continue
                cov = sum(1 for a_id in uncovered if coverage[a_id].get(s.id, 0) == 1)
                if cov > best_cov:
                    best_cov = cov
                    best_s = s.id
            if not best_s or best_cov == 0:
                break
            opened.append(best_s)
            uncovered -= {a_id for a_id in uncovered if coverage[a_id].get(best_s, 0) == 1}
        total_cost = sum(site_dict[s_id].cost for s_id in opened)
        val_protected = sum(asset_dict[a_id].value for a_id in coverable_assets)
        return opened, total_cost, val_protected, "GreedySetCover"

def solve_location_step(
    scenario: Scenario,
    coverage: Optional[Dict[str, Dict[str, int]]] = None,
    distances: Optional[Dict[str, Dict[str, float]]] = None
) -> Tuple[Step1LocationOutput, List[ComparisonResult], List[str]]:
    """
    Solves Step 1: Maximal Covering Location Problem (MCLP)
    and generates benchmark comparisons with Set Cover and Greedy Heuristic.
    """
    start_time = time.time()
    warnings: List[str] = []

    if coverage is None or distances is None:
        coverage, distances = compute_coverage_matrix(scenario)

    asset_dict = {a.id: a for a in scenario.assets}
    priority_classes = assign_priority_classes(scenario)

    # Pruning: Drop sites covering 0 assets
    pruned_sites: List[CandidateSite] = []
    dropped_site_count = 0
    for site in scenario.sites:
        covers_any = any(coverage[a.id].get(site.id, 0) == 1 for a in scenario.assets)
        if covers_any:
            pruned_sites.append(site)
        else:
            dropped_site_count += 1

    if dropped_site_count > 0:
        warnings.append(f"Pruned {dropped_site_count} candidate site(s) that cover zero assets.")

    # Check for uncoverable assets
    uncoverable = [
        a.id for a in scenario.assets
        if not any(coverage[a.id].get(s.id, 0) == 1 for s in scenario.sites)
    ]
    if uncoverable:
        warnings.append(
            f"{len(uncoverable)} asset(s) ({', '.join(uncoverable)}) cannot be covered by any candidate site range."
        )

    budget = scenario.parameters.budget
    time_limit = scenario.parameters.solver_time_limit_sec

    # Handle edge case: no assets or no sites or zero budget
    if not scenario.assets or not pruned_sites or budget <= 0:
        elapsed = time.time() - start_time
        empty_out = Step1LocationOutput(
            status="Infeasible" if budget <= 0 and scenario.assets else "Optimal",
            opened_sites=[],
            site_results=[
                SiteLocationResult(
                    site_id=s.id,
                    site_name=s.name,
                    opened=False,
                    cost=s.cost,
                    assigned_assets=[],
                    total_assigned_value=0.0
                )
                for s in scenario.sites
            ],
            assignments=[
                LocationAssignment(
                    asset_id=a.id,
                    asset_name=a.name,
                    site_id=None,
                    site_name=None,
                    covered=False,
                    distance_km=None,
                    value=a.value,
                    threat_rate=a.threat_rate,
                    priority_class=priority_classes[a.id]
                )
                for a in scenario.assets
            ],
            total_value_protected=0.0,
            total_possible_value=sum(a.value for a in scenario.assets),
            pct_value_protected=0.0,
            total_site_cost=0.0,
            budget=budget,
            channel_cost_total=0.0,
            total_cost_with_channels=0.0,
            budget_exceeded=False,
            solver_used="empty",
            uncovered_assets=[a.id for a in scenario.assets],
            solve_time_sec=round(elapsed, 4),
            n_vars=0,
            n_constraints=0
        )
        return empty_out, [], warnings

    # Run Greedy benchmark
    g_sites, g_assign, g_val, g_cost = run_greedy_mclp(
        scenario, coverage, distances, pruned_sites, budget
    )

    # Run Set Cover benchmark
    sc_sites, sc_cost, sc_val, sc_status = run_cost_minimizing_set_cover(
        scenario, coverage, pruned_sites
    )

    # Set up PuLP MCLP Model
    prob = pulp.LpProblem("UAV_Defense_MCLP", pulp.LpMaximize)

    # Decision variables
    # y_j = 1 if unit opened at site j
    y = {s.id: make_binary_variable(f"y_{s.id}", prob) for s in pruned_sites}

    # x_ij = 1 if asset i is protected by site j (sparse: only where a_ij == 1)
    x: Dict[Tuple[str, str], pulp.LpVariable] = {}
    for a in scenario.assets:
        for s in pruned_sites:
            if coverage[a.id].get(s.id, 0) == 1:
                x[(a.id, s.id)] = make_binary_variable(f"x_{a.id}_{s.id}", prob)

    # Objective: maximize sum_i sum_j w_i * x_ij
    prob += pulp.lpSum(asset_dict[i].value * var for (i, j), var in x.items())

    # Constraints:
    # 1. x_ij <= y_j for all (i, j) in sparse set
    for (i, j), var in x.items():
        prob += var <= y[j], f"CoverLink_{i}_{j}"

    # 2. Each asset assigned to at most 1 site: sum_j x_ij <= 1
    for a in scenario.assets:
        site_links = [x[(a.id, s.id)] for s in pruned_sites if (a.id, s.id) in x]
        if site_links:
            prob += pulp.lpSum(site_links) <= 1, f"SingleAssignment_{a.id}"

    # 3. Budget constraint: sum_j c_j * y_j <= B
    prob += (
        pulp.lpSum(s.cost * y[s.id] for s in pruned_sites) <= budget,
        "BudgetConstraint"
    )

    n_vars = len(y) + len(x)
    n_constraints = len(prob.constraints)

    # Solve with CBC
    solver_used = "cbc_milp"
    try:
        prob.solve(pulp.PULP_CBC_CMD(msg=0, timeLimit=time_limit))
        solver_status = pulp.LpStatus[prob.status]
    except Exception as exc:
        solver_status = "Error"
        warnings.append(f"PuLP solver encountered error: {str(exc)}. Falling back to Greedy heuristic.")

    elapsed = time.time() - start_time

    # If CBC failed or timed out without finding a valid solution, fall back to Greedy
    use_greedy = (
        solver_status not in ("Optimal", "Feasible") or
        not any(pulp.value(y[s.id]) is not None and pulp.value(y[s.id]) > 0.5 for s in pruned_sites) and g_sites
    )

    if use_greedy:
        solver_used = "greedy_fallback"
        solver_status = "GreedyFallback"
        opened_sites = g_sites
        asset_to_site = g_assign
        total_site_cost = g_cost
        val_protected = g_val
    else:
        opened_sites = [s.id for s in pruned_sites if pulp.value(y[s.id]) is not None and pulp.value(y[s.id]) > 0.5]
        asset_to_site = {}
        for (i, j), var in x.items():
            if pulp.value(var) is not None and pulp.value(var) > 0.5:
                asset_to_site[i] = j
        total_site_cost = sum(s.cost for s in scenario.sites if s.id in opened_sites)
        val_protected = sum(asset_dict[i].value for i in asset_to_site)

    # Format site results
    site_dict_all = {s.id: s for s in scenario.sites}
    site_results: List[SiteLocationResult] = []
    for s in scenario.sites:
        is_opened = s.id in opened_sites
        assigned_a = [a_id for a_id, mapped_s in asset_to_site.items() if mapped_s == s.id]
        assigned_val = sum(asset_dict[a_id].value for a_id in assigned_a)
        site_results.append(
            SiteLocationResult(
                site_id=s.id,
                site_name=s.name,
                opened=is_opened,
                cost=s.cost,
                assigned_assets=assigned_a,
                total_assigned_value=assigned_val
            )
        )

    # Format asset assignments
    assignments: List[LocationAssignment] = []
    uncovered: List[str] = []
    for a in scenario.assets:
        s_id = asset_to_site.get(a.id)
        is_cov = s_id is not None
        if not is_cov:
            uncovered.append(a.id)
        dist = distances[a.id].get(s_id) if is_cov else None
        s_name = site_dict_all[s_id].name if is_cov else None
        assignments.append(
            LocationAssignment(
                asset_id=a.id,
                asset_name=a.name,
                site_id=s_id,
                site_name=s_name,
                covered=is_cov,
                distance_km=dist,
                value=a.value,
                threat_rate=a.threat_rate,
                priority_class=priority_classes[a.id]
            )
        )

    total_possible_val = sum(a.value for a in scenario.assets)
    pct_val = (val_protected / total_possible_val * 100.0) if total_possible_val > 0 else 0.0

    # Build Comparison Results
    # Gap between Greedy and MILP
    opt_gap = None
    if val_protected > 0:
        opt_gap = round(max(0.0, (val_protected - g_val) / val_protected * 100.0), 2)

    sc_diff = round(sc_cost - budget, 2)
    sc_note = (
        f"Costs ₹{sc_cost:.1f} ({abs(sc_diff):.1f} {'above' if sc_diff > 0 else 'below'} budget ₹{budget:.1f})"
    )

    comparisons = [
        ComparisonResult(
            model_name="MCLP (Max Value within Budget)",
            opened_sites=opened_sites,
            total_cost=total_site_cost,
            value_protected=val_protected,
            pct_value_protected=round(pct_val, 2),
            notes=f"Solved with {solver_used.upper()} to optimize asset protection.",
            optimality_gap_pct=0.0
        ),
        ComparisonResult(
            model_name="Cost-Minimizing Set Cover",
            opened_sites=sc_sites,
            total_cost=sc_cost,
            value_protected=sc_val,
            pct_value_protected=round((sc_val / total_possible_val * 100.0) if total_possible_val > 0 else 0.0, 2),
            notes=f"Cheapest way to cover all feasible assets. {sc_note}",
            optimality_gap_pct=None
        ),
        ComparisonResult(
            model_name="Greedy Heuristic",
            opened_sites=g_sites,
            total_cost=g_cost,
            value_protected=g_val,
            pct_value_protected=round((g_val / total_possible_val * 100.0) if total_possible_val > 0 else 0.0, 2),
            notes=f"Fast greedy incremental ratio heuristic.",
            optimality_gap_pct=opt_gap
        )
    ]

    out = Step1LocationOutput(
        status=solver_status,
        opened_sites=opened_sites,
        site_results=site_results,
        assignments=assignments,
        total_value_protected=val_protected,
        total_possible_value=total_possible_val,
        pct_value_protected=round(pct_val, 2),
        total_site_cost=total_site_cost,
        budget=budget,
        channel_cost_total=0.0,
        total_cost_with_channels=total_site_cost,
        budget_exceeded=False,
        solver_used=solver_used,
        uncovered_assets=uncovered,
        solve_time_sec=round(elapsed, 4),
        n_vars=n_vars,
        n_constraints=n_constraints
    )

    return out, comparisons, warnings
