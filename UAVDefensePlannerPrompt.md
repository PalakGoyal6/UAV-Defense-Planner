# Prompt: Build "UAV Defense Resource Planner" — a full-stack web app

You are building a web app for an Operations Research course project (MSL304): **"Optimizing Resource Planning for UAV (Unmanned Aerial Vehicles) Defense."** A planner describes a defended site (its assets, the candidate places for defense units, a budget and the expected drone threat). The app returns a complete defense plan: **where to put defense units, how many engagement channels each unit needs, how many interceptors to stock (plus a reorder rule), and how many interceptors to hold back for the most valuable assets.**

The method has **5 chained steps**. The output of each step is the input to the next:

```
1. Place units  →  2. Threat load  →  3. Size channels  →  4. Stock up  →  5. Hold a reserve
   (MCLP)           (Λ per site)      (Erlang-B)          (Newsvendor     (Littlewood's rule)
                                                          + reorder pt)
```
Plus **6. Sensitivity analysis** (rerun everything across budgets, threat levels and costs) and **scaling** (small → regional → multi-region).

**The user MUST be able to enter and edit all of their own data** (forms, editable tables, map clicks, CSV/JSON upload). A preloaded example (the air base below) is just a starting point.

Before writing code, restate the plan in a short README section, then build in the phases listed at the end. Don't skip the tests.

---

## 1. Tech stack

- **Backend:** Python 3.11+, **FastAPI**, **PuLP** (CBC solver) for the integer programs, **NumPy/SciPy** (`scipy.stats.norm` for z-values), **Pydantic v2** for input validation. **SQLite + SQLModel** to save scenarios.
- **Frontend:** **React + Vite + TypeScript**, **Tailwind CSS**, **React-Leaflet** (OpenStreetMap tiles) for the map, **Recharts** for charts, **TanStack Table** (or AG Grid community) for editable tables, **PapaParse** for CSV import.
- **Tests:** `pytest` for the backend math, at minimum.
- Monorepo layout:
```
/backend
  app/main.py            # FastAPI routes
  app/models.py          # Pydantic schemas
  app/solver/
     geometry.py         # haversine / euclidean, coverage matrix
     location.py         # MCLP, cost-min set cover, greedy
     load.py             # Λ_j aggregation
     queueing.py         # Erlang-B, channel sizing
     inventory.py        # newsvendor, reorder point, EOQ, split across sites
     reserve.py          # Littlewood protection level
     pipeline.py         # runs steps 1→5, returns full plan + "show working"
     sensitivity.py      # parameter sweeps, knee detection
     scaling.py          # region splitting, pruning, synthetic data generator
  tests/
/frontend
  src/pages/ ...         # see UI section
/sample_data             # air_base.json + CSV templates
```
- Put a single `docker-compose.yml` (or clear `npm run dev` + `uvicorn` instructions) in the README.

---

## 2. Data model (everything user-editable)

### 2.1 Assets (things to protect)
| field | type | notes |
|---|---|---|
| `id` | str | unique, e.g. `A1` |
| `name` | str | "Command Centre" |
| `x`, `y` **or** `lat`, `lon` | float | depends on coordinate mode (see 2.5) |
| `value` (wᵢ) | float > 0 | importance score |
| `priority_class` | `"high"` \| `"low"` | can be set manually or auto-assigned by a value threshold |
| `threat_rate` (λᵢ) | float ≥ 0 | expected threats per minute aimed at this asset during an attack |
| `region` | str, optional | used for multi-region solving |

### 2.2 Candidate sites (places a defense unit could go)
| field | type | notes |
|---|---|---|
| `id`, `name` | str | `S1` … |
| `x`, `y` or `lat`, `lon` | float | |
| `cost` (cⱼ) | float > 0 | cost to open a unit here |
| `range_km` | float > 0 | coverage radius |
| `max_channels` | int, default 10 | upper cap for channel sizing |
| `channel_cost` | float, default 0 | optional cost per extra channel |
| `depot_distance_km` | float, optional | auto-computed from depot location if given; drives lead time |
| `region` | str, optional | |

### 2.3 Global parameters (a form, all fields editable, with tooltips explaining each)
- `budget` (B)
- `mean_engagement_time_min` (1/µ). Service rate µ = 1 / this
- `target_leak_probability` (α), e.g. 0.05
- `attack_duration_min` (T), the length of one attack window
- `shots_per_engagement` (k), interceptors fired per engaged threat (default 1)
- **Newsvendor:** `underage_cost` (Cu, cost per interceptor short), `overage_cost` (Co, holding/waste cost per unused interceptor), `interceptor_unit_cost`
- **Demand mode:** either (a) **manual**: user enters µ_D and σ_D directly, or (b) **derived** (default) from the plan (see 3.4)
- **Reorder:** `daily_demand_mean`, `daily_demand_sd` (or derived), `target_service_level` (e.g. 0.95), `order_setup_cost` (K) and `holding_cost_per_unit_per_day` (h) for EOQ, `base_lead_time_days`, `transport_speed_km_per_day`, `depot` location
- **Reserve (Littlewood):** `r1` (value protected per interceptor used on high-value class) and `r2` (same for low-value class). Default: auto-compute as the λ-weighted average asset value of each class; allow override.
- `high_value_threshold` (auto-classifies assets as high if value ≥ threshold, when the user hasn't set the class manually)
- `solver_time_limit_sec` (default 60), `assignment_mode`: `single` (each asset to ≤1 site, as in the proposal; the default)

### 2.4 Scenario
A scenario = assets + sites + parameters + name + notes. Save/load/duplicate/delete in SQLite. Also export/import as one JSON file.

### 2.5 Coordinate mode
- **Grid (km):** x/y in km on a local plane, Euclidean distance. Used for the small hand-checkable case.
- **Geographic:** lat/lon, haversine distance. Used for the Indian regional cases, shown on the OSM map.
Coverage matrix: **aᵢⱼ = 1 if distance(i, j) ≤ range_km of site j**, else 0. Always computed automatically, never typed in. But let the user **override individual aᵢⱼ cells** (e.g. terrain blocks line of sight) in an editable coverage-matrix view; overrides are stored with the scenario.

---

## 3. The math: implement exactly this

### 3.1 Step 1: Place units (Maximal Covering Location Problem)
Binary variables: yⱼ = 1 if a unit opens at site j; xᵢⱼ = 1 if site j protects asset i.

```
maximize    Σᵢ Σⱼ wᵢ · xᵢⱼ
subject to  xᵢⱼ ≤ aᵢⱼ · yⱼ          ∀ i, j      (only an open site in range can protect)
            Σⱼ xᵢⱼ ≤ 1               ∀ i         (each asset assigned to one site)
            Σⱼ cⱼ · yⱼ (+ channel costs, see note) ≤ B
            xᵢⱼ, yⱼ ∈ {0,1}
```
Only create xᵢⱼ variables where aᵢⱼ = 1 (sparse; essential for the big cases).

**Comparison model: cost-minimizing set cover**
```
minimize    Σⱼ cⱼ · yⱼ
subject to  Σⱼ aᵢⱼ · yⱼ ≥ 1         ∀ i that has at least one covering site
            yⱼ ∈ {0,1}
```
Report any asset that no site can cover (that's infeasible regardless of budget) as a warning. Show both results side by side: "Max value within budget B" vs "Cheapest way to cover everything (costs ₹X, which is Y above/below your budget)".

**Greedy heuristic (fast backup):** repeatedly add the unopened site with the highest *(additional uncovered value it would protect) / cost* that still fits the budget; stop when nothing fits or nothing adds value. Then assign each asset to its in-range open site (pick the nearest one). Show the greedy result vs the MILP optimum and the % optimality gap. Use greedy automatically if the MILP hits the time limit without a solution, and flag it in the UI.

Note on channel costs: by default, the budget covers site-opening costs only (as in the proposal). If any `channel_cost > 0`, report the total including channels separately and warn if it exceeds B. Don't silently change the model.

### 3.2 Step 2: Threat load per site
```
Λⱼ = Σᵢ λᵢ · xᵢⱼ      (threats/min site j must handle)
```
Also compute the **offered load** aⱼ = Λⱼ / µ = Λⱼ × mean_engagement_time (in Erlangs).

### 3.3 Step 3: Size engagement channels (Erlang-B loss system)
A threat arriving when all channels are busy isn't engaged and leaks through. Erlang-B:
```
B(c, a) = (aᶜ / c!) / Σₙ₌₀ᶜ (aⁿ / n!)
```
**Implement with the numerically stable recursion, NOT factorials:**
```
B(0, a) = 1
B(c, a) = a·B(c−1, a) / (c + a·B(c−1, a))
```
For each open site j: choose the **smallest c such that B(c, aⱼ) ≤ α**. If even `max_channels` doesn't reach α, use max_channels and flag the site red ("target leak not achievable").
Also output, per site, the **full curve** B(c, aⱼ) for c = 1…max_channels and the **marginal value of each extra channel** = B(c−1) − B(c) (leak reduction), and the expected leaked threats/min = Λⱼ·B(cⱼ, aⱼ). Sites with Λⱼ = 0 get 0 channels and a note.

### 3.4 Step 4: Stock and reorder rule (inventory)
**Demand per attack (derived mode):** engaged threats at site j per attack ≈ Λⱼ · T · (1 − B(cⱼ, aⱼ)); interceptors needed = k × that. Treat total demand D as approximately Normal with
```
µ_D = k · T · Σⱼ Λⱼ (1 − Bⱼ)
σ_D = sqrt(k² · µ_D / k) = sqrt(k · µ_D)      (Poisson-arrival approximation: Var of count = mean, scaled by k)
```
Show this derivation in the "show working" panel and let manual mode override µ_D, σ_D.

**Newsvendor starting stock:**
```
critical ratio  CR = Cu / (Cu + Co)
z = Φ⁻¹(CR)
Q* = µ_D + z · σ_D       → round UP to an integer
```

**Reorder point** (per site, because lead time depends on distance from the depot):
```
Lⱼ = base_lead_time_days + depot_distance_kmⱼ / transport_speed_km_per_day
µ_Lⱼ = daily_demand_meanⱼ · Lⱼ
σ_Lⱼ = daily_demand_sdⱼ · sqrt(Lⱼ)
z_SL = Φ⁻¹(target_service_level)
sⱼ  = µ_Lⱼ + z_SL · σ_Lⱼ             → round up
```
Daily demand per site defaults to total daily demand split in proportion to Λⱼ (user can override).
**Order quantity:** suggest EOQ = sqrt(2 · D_annual · K / h_annual) per site, labeled "suggested order quantity". Rule shown in plain English: *"When stock at site j falls to sⱼ, order Qⱼ."*

**Split stock across sites in proportion to Λⱼ:** Q*ⱼ = Q* · Λⱼ / ΣΛ, using **largest-remainder rounding** so the integers add up exactly to Q*.

### 3.5 Step 5: Reserve for high-value assets (Littlewood's rule)
Split demand into class 1 (high-value assets) and class 2 (low-value). Class-1 demand D₁ is derived the same way as 3.4 but only using λᵢ of high-priority assets that are covered (µ₁, σ₁). Littlewood's rule:
```
P(D₁ > y₁*) = r₂ / r₁
⇒ y₁* = µ₁ + σ₁ · Φ⁻¹(1 − r₂/r₁)        (Normal approximation), round up
```
- Clamp y₁* to [0, Q*]. If r₂ ≥ r₁, reserve = 0 and explain why.
- Output: **reserve level y₁*** (interceptors never to be spent on low-value threats), and **booking limit for low-value = Q* − y₁***.
- Also split the reserve per site in proportion to each site's high-value load.
- Plain-English output: *"Keep 14 interceptors back for the Command Centre, Fuel Depot and Apron; low-value threats can use at most 26."*

### 3.6 Step 6: Sensitivity analysis
User picks one parameter to sweep (budget, global threat-rate multiplier, α, engagement time, Cu, Co, r₂/r₁), a range and a step count (default 20 points). Rerun the **whole pipeline** at each point and plot: value protected, % of total asset value protected, total channels, Q*, reserve y₁*, total cost.
**Knee detection for budget:** report the budget beyond which the marginal value protected per extra ₹ drops below a user-set ε (default: 1% of the max slope), i.e. *"Above ₹X, extra budget stops adding protection."* Mark it on the chart.
Optional 2-D sweep (budget × threat multiplier) shown as a heatmap of % value protected.

### 3.7 Scaling
- **Small case:** ~5 assets, 6 sites. The "show working" panel must show every intermediate number so it can be checked by hand.
- **Regional case:** ~50 assets, a few hundred sites, one region.
- **Multi-region:** several hundred assets; solve **each region independently** (budget split across regions either proportionally to regional asset value or as user-entered per-region budgets), then merge results.
- **Pruning:** drop any site whose coverage row is all zeros before solving; report how many were dropped.
- **Synthetic data generator** (a button): given a bounding box (or pick a preset Indian state bbox), number of assets, number of candidate sites, value distribution, λ range, cost range and range_km range → generates a scenario. Clearly label generated data as synthetic. Use only public, non-sensitive placeholder data. The app must never ship real military installation coordinates. Users can enter their own.
- Show solve time and problem size (#vars, #constraints) for each run.

---

## 4. Default example: "Air Base (small case)"

Preload this as a scenario called **"Air Base — small example"** in grid mode (km). These numbers are illustrative placeholders. Label them as such in the UI so the user replaces them with their own.

**Assets**
| id | name | x | y | value | class | λ (threats/min) |
|---|---|---|---|---|---|---|
| A1 | Command Centre | 5.0 | 5.0 | 100 | high | 0.40 |
| A2 | Fuel Depot | 8.0 | 3.0 | 90 | high | 0.35 |
| A3 | Aircraft Apron | 3.0 | 8.0 | 80 | high | 0.30 |
| A4 | Power Supply | 9.0 | 8.0 | 60 | low | 0.25 |
| A5 | Stores | 1.0 | 2.0 | 30 | low | 0.15 |

**Candidate sites**
| id | x | y | cost | range_km | max_channels |
|---|---|---|---|---|---|
| S1 | 4.0 | 4.0 | 30 | 3.0 | 8 |
| S2 | 7.0 | 4.0 | 25 | 3.0 | 8 |
| S3 | 4.0 | 7.0 | 25 | 3.0 | 8 |
| S4 | 8.5 | 7.0 | 20 | 2.5 | 8 |
| S5 | 2.0 | 3.0 | 15 | 2.5 | 8 |
| S6 | 6.0 | 6.0 | 40 | 4.5 | 10 |

**Parameters:** B = 80, mean engagement time = 1.5 min, α = 0.05, T = 30 min, k = 1, Cu = 50, Co = 5, interceptor unit cost = 2, service level = 0.95, base lead time = 2 days, speed = 300 km/day, depot at (0, 0) (in grid mode, treat depot distance as ×10 km per grid km, or let the user type it), K = 20, h = 0.01/day, high-value threshold = 75, r₁/r₂ auto.

Also include a **CSV template download** for assets and sites with exactly the column headers above.

---

## 5. UI / pages

Global layout: left sidebar nav, top bar with scenario selector, "Save", "Save as", "Run plan" button, and a status pill (Optimal / Greedy fallback / Infeasible / Not run).

1. **Home / Scenarios:** list saved scenarios (cards), New (blank), New from example, Import JSON, Generate synthetic, Duplicate, Delete.
2. **Data Input**, with tabs:
   - **Assets**: editable table (inline edit, add row, delete row, bulk paste from Excel, CSV import/export). Validation errors are shown inline (negative value, duplicate id, missing coordinates).
   - **Candidate Sites**: same features.
   - **Map editor**: click on the map to add an asset or a site (toggle which), drag markers to move them, click a marker to edit it in a side panel. Range circles drawn around sites. In grid mode, use a plain SVG/canvas grid instead of OSM.
   - **Parameters**: grouped form (Location / Queueing / Inventory / Reserve / Solver) with tooltips showing the formula each field feeds into, and sensible defaults + "reset to default".
   - **Coverage matrix**: auto-computed heatmap/table of aᵢⱼ; click a cell to override (overrides highlighted).
   - All edits update a live "data health" box: #assets, #sites, total value, assets with no covering site, sites covering nothing.
3. **Results / Plan** (after Run):
   - **Summary cards**: value protected (abs + %), sites opened, total cost vs budget, total channels, Q*, reserve y₁*, worst site leak probability.
   - **Map**: open sites highlighted, closed sites greyed, lines from each asset to its assigned site, unprotected assets in red.
   - **Step cards 1–5**, each expandable, with a table + a "Show working" toggle that prints the formula, plugged-in numbers and the result (e.g. `a₂ = 0.65 × 1.5 = 0.975 Erl; B(3, 0.975) = 0.0541 > 0.05; B(4, 0.975) = 0.0130 ≤ 0.05 → c = 4`).
   - **Step 3 chart**: leak probability vs channels per site, with an α line, plus a marginal-value bar chart.
   - **Step 4 table**: per-site Λ share, stock Q*ⱼ, lead time, reorder point sⱼ, order qty.
   - **Step 5 panel**: reserve level, booking limit, per-site reserve, plain-English rule.
   - **Comparison tab**: MCLP vs set-cover vs greedy (sites, cost, value, gap).
   - **Plain-English plan summary** at the top, explainable to whoever signs off.
4. **Sensitivity:** choose parameter + range → run → line charts with knee marker; optional 2-D heatmap. Cancel button for long runs.
5. **Scaling / Regions:** region list with per-region budget, solve-per-region, merged results, timings, pruned-site counts.
6. **Export:** download full results as JSON, each table as CSV, and a printable report page (browser print → PDF) containing the inputs, the plan, the working and the charts.

Design: clean dashboard look, dark/light toggle, responsive enough for a laptop screen. Numbers formatted consistently (leak probability to 4 dp, costs with thousands separators).

---

## 6. API (FastAPI)

- `POST /api/solve`: body = full scenario; returns `{location, load, channels, inventory, reserve, comparison, working, warnings, meta:{solver_status, solve_time, n_vars, n_constraints}}`
- `POST /api/sensitivity`: body = scenario + `{param, start, end, steps}` (or 2-D)
- `POST /api/coverage`: returns the coverage matrix + distances
- `POST /api/generate`: synthetic scenario
- `GET/POST/PUT/DELETE /api/scenarios[/id]`: CRUD
- `POST /api/import` (JSON/CSV), `GET /api/scenarios/{id}/export`
- Validate everything with Pydantic and return clear 422 messages the frontend can show next to the field.
- Every step function must be a **pure function** (input dataclass → output dataclass) so it's testable and the pipeline just chains them.

---

## 7. Tests (must pass)
- Erlang-B: B(1, 1) = 0.5; B(2, 1) = 0.2; B(c, 0) = 0 for c ≥ 1; recursion matches the factorial formula for small c; monotone decreasing in c.
- Channel sizing returns the smallest c meeting α, and flags infeasible at max_channels.
- Newsvendor: CR = 0.5 ⇒ Q* = µ_D; z matches `norm.ppf`.
- Littlewood: r₂/r₁ = 0.5 ⇒ y₁* = µ₁; r₂ ≥ r₁ ⇒ 0; clamped to ≤ Q*.
- Largest-remainder split sums exactly to the total.
- MCLP on the small example equals a **brute-force enumeration over all 2⁶ site subsets**.
- Greedy never exceeds the budget; MILP value ≥ greedy value.
- Haversine sanity check (known city pair distance within 1%).
- Pipeline end-to-end on the example returns no errors, and Σⱼ Λⱼ equals the λ-sum of covered assets.

---

## 8. Build phases (do them in order and tell me when each is done)
1. Backend solver modules + tests (no UI). Print the full plan for the example from a CLI script `python -m app.solver.pipeline sample_data/air_base.json`.
2. FastAPI routes + scenario persistence.
3. Frontend: Data Input (tables, CSV import, parameters form, coverage matrix).
4. Frontend: Results page with step cards, show-working and charts.
5. Map editor (grid + geographic modes).
6. Sensitivity page.
7. Scaling: synthetic generator, regions, pruning, greedy fallback.
8. Export/report, polish, README with screenshots and a "how the five steps connect" explanation.

## 9. Ground rules
- Don't hardcode the example anywhere in the solver. It's just a seed scenario.
- Keep units explicit everywhere (per minute, minutes, days, km, ₹) and show them in table headers.
- Every number on the Results page must be traceable through "show working".
- Handle edge cases gracefully: zero budget, no assets covered, a site with Λ = 0, α ≥ 1, σ = 0, empty tables, duplicate IDs.
- Comment the math code with the formula it implements.