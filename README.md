# UAV Defense Resource Planner

An Operations Research platform for **"Optimizing Resource Planning for UAV (Unmanned Aerial Vehicles) Defense"** (MSL304).

Given a defended site's assets (critical infrastructure, radar, fuel depots), candidate defense unit sites, budget constraints, and expected drone swarm threat profiles, this system formulates and executes a complete, mathematically rigorous defense plan across five chained operations research stages:

```
1. Place units  →  2. Threat load  →  3. Size channels  →  4. Stock up  →  5. Hold a reserve
   (MCLP)           (Λ per site)      (Erlang-B)          (Newsvendor     (Littlewood's rule)
                                                           + reorder pt)
```

Plus **Sensitivity Analysis** (parameter sweeps, knee detection for budget, 2D heatmaps) and **Scaling** (multi-region theater decomposition, coverage matrix pruning, synthetic benchmark generation).

---

## How the Five Steps Connect Mathematically

The output of each operations research step directly forms the mathematical foundation and parameter set for the subsequent stage:

```
[Defended Assets & Sites]
        │
        ▼
┌─────────────────────────────────┐
│ 1. Place Units (MCLP MILP)      │ ──► Optimal site set {j} and binary assignments x_ij
└─────────────────────────────────┘
        │
        ▼
┌─────────────────────────────────┐
│ 2. Threat Load Aggregation      │ ──► Arrival rate Λ_j = Σ_i λ_i x_ij and offered load a_j = Λ_j / μ
└─────────────────────────────────┘
        │
        ▼
┌─────────────────────────────────┐
│ 3. Engagement Sizing (Erlang-B) │ ──► Smallest c_j channels s.t. B(c_j, a_j) ≤ α; leak prob B_j
└─────────────────────────────────┘
        │
        ▼
┌─────────────────────────────────┐
│ 4. Stock & Reorder (Newsvendor) │ ──► Non-leaked demand μ_D, target stock Q*, (s_j, EOQ_j) rules
└─────────────────────────────────┘
        │
        ▼
┌─────────────────────────────────┐
│ 5. Protection Reserve (Littlewd)│ ──► Dedicated interceptor reserve y_1* for high-value targets
└─────────────────────────────────┘
```

### 1. Step 1: Unit Placement (Maximal Covering Location Problem - MCLP)
- **Mathematical Program:**
  $$\max \sum_{i \in \text{Assets}} \sum_{j \in \text{Sites}} w_i \cdot x_{ij}$$
  $$\text{s.t.} \quad x_{ij} \le a_{ij} \cdot y_j \quad \forall i, j \text{ with } a_{ij}=1$$
  $$\sum_j x_{ij} \le 1 \quad \forall i$$
  $$\sum_j c_j \cdot y_j \le B$$
  $$x_{ij}, y_j \in \{0, 1\}$$
- **Benchmarks Generated:**
  - **Cost-Minimizing Set Cover:** $\min \sum_j c_j y_j$ subject to full coverage of feasible assets.
  - **Greedy Heuristic:** Iteratively opens the unopened site with the highest marginal $(\Delta \text{Value}) / c_j$ ratio that fits within the budget. Used as an automated fallback if the MILP hits the solver timeout.

### 2. Step 2: Threat Load Aggregation ($\Lambda_j$ and $a_j$)
- Aggregates the incoming drone threat rate assigned to each open defense site $j$:
  $$\Lambda_j = \sum_{i: x_{ij}=1} \lambda_i \quad (\text{threats / minute})$$
- Computes the offered load in Erlangs given mean engagement service time $1/\mu$:
  $$a_j = \frac{\Lambda_j}{\mu} = \Lambda_j \cdot \text{mean\_engagement\_time} \quad (\text{Erlangs})$$

### 3. Step 3: Channel Sizing (Erlang-B Loss System)
- Sizing simultaneous engagement channels $c_j$ so the drone leak probability $B(c_j, a_j) \le \alpha$.
- **Numerically Stable Erlang-B Recursion:**
  $$B(0, a) = 1.0$$
  $$B(c, a) = \frac{a \cdot B(c - 1, a)}{c + a \cdot B(c - 1, a)}$$
- Produces full sizing curves $c = 1 \dots \text{max\_channels}$, marginal leak reduction $B(c - 1) - B(c)$, and expected leaked threats/min $\Lambda_j \cdot B(c_j, a_j)$.

### 4. Step 4: Interceptor Stocking & Reorder Policy (Newsvendor + $(s, Q)$)
- **Derived Attack Demand:**
  $$\mu_D = k \cdot T \cdot \sum_j \Lambda_j (1 - B(c_j, a_j))$$
  $$\sigma_D = \sqrt{k \cdot \mu_D} \quad (\text{Poisson arrival variance scaling})$$
- **Newsvendor Critical Ratio & Integer Stock:**
  $$CR = \frac{C_u}{C_u + C_o}, \quad z = \Phi^{-1}(CR)$$
  $$Q^* = \lceil \mu_D + z \cdot \sigma_D \rceil$$
  Distributed among sites proportionally to $\Lambda_j$ via **Largest-Remainder (Hamilton-Hare) integer apportionment** so $\sum_j Q_j^* = Q^*$ exactly.
- **Per-Site Replenishment Point ($s_j$):**
  $$L_j = \text{base\_lead\_time} + \frac{\text{depot\_distance}_j}{\text{transport\_speed}}$$
  $$s_j = \lceil \mu_{L_j} + z_{SL} \cdot \sigma_{L_j} \rceil$$
  $$EOQ_j = \left\lceil \sqrt{\frac{2 \cdot \text{daily\_demand}_j \cdot K}{h}} \right\rceil$$

### 5. Step 5: High-Value Asset Protection Reserve (Littlewood's Rule)
- Protects critical infrastructure from interceptor stockouts during saturation attacks:
  $$P(D_1 > y_1^*) = \frac{r_2}{r_1} \implies y_1^* = \lceil \mu_1 + \sigma_1 \cdot \Phi^{-1}(1 - r_2 / r_1) \rceil$$
  clamped to $[0, Q^*]$.
- Output includes the dedicated high-priority reserve $y_1^*$, the low-value booking limit $Q^* - y_1^*$, and plain-English operational rules.

---

## Tech Stack & Architecture

- **Backend:**
  - Python 3.11+ / FastAPI
  - PuLP 2.9.0 (COIN-OR CBC MILP Solver)
  - SciPy 1.16.0 (`scipy.stats.norm`) & NumPy 2.2.2
  - SQLModel & SQLite for scenario persistence
  - Pydantic v2 input and output schema validation
  - Pytest 9.1.1 comprehensive test suite
- **Frontend:**
  - React 19 + TypeScript + Vite
  - Tailwind CSS
  - React-Leaflet (OpenStreetMap geographic view) & HTML5 Canvas / SVG Grid plane
  - Recharts for Erlang-B and sensitivity sweeps
  - PapaParse for CSV import/export
  - Lucide Icons

---

## Monorepo Layout

```
pulkit_project/
├── backend/
│   ├── app/
│   │   ├── __init__.py
│   │   ├── main.py              # FastAPI REST endpoints
│   │   ├── models.py            # Pydantic schemas & SQLModel entities
│   │   ├── db.py                # SQLite database session & seed logic
│   │   └── solver/
│   │       ├── geometry.py      # Haversine & Euclidean distances, a_ij matrix
│   │       ├── location.py      # MCLP MILP, Set Cover, Greedy heuristic
│   │       ├── load.py          # Threat load aggregation (Lambda_j, a_j)
│   │       ├── queueing.py      # Erlang-B recursion & channel sizing
│   │       ├── inventory.py     # Newsvendor, largest-remainder, (s, Q) EOQ
│   │       ├── reserve.py       # Littlewood rule & high-value protection
│   │       ├── pipeline.py      # 5-step pipeline execution & Show Working
│   │       ├── sensitivity.py   # Parameter sweeps & budget knee detection
│   │       └── scaling.py       # Multi-region solver & synthetic generator
│   ├── tests/
│   │   ├── test_solver.py       # 9 core math and OR tests
│   │   └── test_api.py          # FastAPI endpoint and CRUD integration tests
│   ├── Dockerfile
│   └── requirements.txt
├── frontend/
│   ├── src/
│   │   ├── components/          # Tables, MapEditor, StepCards, Charts
│   │   ├── pages/               # Home, DataInput, Results, Sensitivity, Scaling, Export
│   │   ├── services/            # API client
│   │   ├── types/               # TypeScript interfaces
│   │   ├── App.tsx              # Main UI shell
│   │   └── index.css            # Tailwind & Leaflet styles
│   ├── Dockerfile
│   └── package.json
├── sample_data/
│   ├── air_base.json            # Preloaded seed scenario
│   ├── assets_template.csv      # CSV import template for assets
│   └── sites_template.csv       # CSV import template for sites
├── run_pipeline.py              # Root CLI helper script
├── pytest.ini
├── docker-compose.yml
└── README.md
```

---

## Running the Application

### Option A: Local Development

#### 1. Backend
```bash
cd backend
python -m pytest -v
uvicorn app.main:app --reload --port 8000
```
Backend API will be running at `http://127.0.0.1:8000` with interactive Swagger docs at `http://127.0.0.1:8000/docs`.

#### 2. Frontend
```bash
cd frontend
npm install
npm run dev
```
Open `http://localhost:5173` in your browser.

#### 3. CLI Pipeline Test
Run the full 5-stage pipeline directly on the preloaded example from the command line:
```bash
python run_pipeline.py sample_data/air_base.json
```

---

### Option B: Deploy to Vercel (Full-Stack or Frontend)

This project is configured out-of-the-box for **Vercel** with a unified `vercel.json` and Python Serverless entrypoint (`api/index.py`).

#### Method 1: Deploy with Vercel CLI
```bash
# Install Vercel CLI if not already installed
npm install -g vercel

# Deploy directly from the project root
vercel
```

#### Method 2: Deploy via GitHub / Vercel Web Dashboard
1. Push this repository to GitHub.
2. In the [Vercel Dashboard](https://vercel.com/new), import your repository.
3. Keep default settings (Vercel automatically detects `vercel.json`, root `requirements.txt`, and builds the frontend into `frontend/dist`).
4. Click **Deploy**.

> **Note on Serverless Storage:** In Vercel's serverless environment, `/tmp` is used automatically for the SQLite database cache (`/tmp/scenarios.db`) and seeds the default Air Base scenario on startup.

---

### Option C: Docker Compose
```bash
docker-compose up --build
```
- Frontend: `http://localhost:5173`
- Backend API: `http://localhost:8000`

---

## Mathematical Verification & Test Suite

All 14 backend tests pass with full numerical precision:
1. **Erlang-B recursion:** $B(1, 1) = 0.5$, $B(2, 1) = 0.2$, $B(c, 0) = 0$ for $c \ge 1$; matches factorial formula for small $c$; monotone decreasing in $c$.
2. **Channel sizing:** Finds the minimal $c$ satisfying $B(c, a) \le \alpha$, flagging unachievable targets when capped at `max_channels`.
3. **Newsvendor Critical Ratio:** $CR = 0.5 \implies Q^* = \lceil \mu_D \rceil$; $z$-scores match `scipy.stats.norm.ppf`.
4. **Littlewood's Rule:** $r_2 / r_1 = 0.5 \implies y_1^* = \lceil \mu_1 \rceil$; $r_2 \ge r_1 \implies y_1^* = 0$; clamped to $\le Q^*$.
5. **Largest-Remainder Apportionment:** Sum of integer unit allocations equals total stock $Q^*$ exactly.
6. **MCLP Optimum vs Brute Force:** Verified that PuLP CBC solution matches full $2^6 = 64$ subset brute-force search on the air base example.
7. **Greedy Heuristic:** Never violates the budget; MILP protected value $\ge$ Greedy protected value.
8. **Haversine Sanity Check:** Great-circle distance between New Delhi and Mumbai within 1% of true geographic distance.
9. **Pipeline End-to-End Conservation:** $\sum_j \Lambda_j$ strictly equals the sum of threat rates of all covered assets.
10. **FastAPI Endpoints:** Health, scenario persistence CRUD, solve, coverage, and synthetic generation endpoints verified.
