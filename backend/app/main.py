from contextlib import asynccontextmanager
from typing import Dict, List, Any, Optional
import uuid
from datetime import datetime, timezone

from fastapi import FastAPI, APIRouter, HTTPException, Depends, status
from fastapi.middleware.cors import CORSMiddleware
from sqlmodel import Session, select

from app.db import init_db, get_session
from app.models import (
    Scenario, ScenarioRecord, FullPlanResponse,
    SensitivityRequest, SensitivityResponse,
    SyntheticGenerateRequest
)
from app.solver.pipeline import run_defense_pipeline
from app.solver.geometry import compute_coverage_matrix, get_india_geojson, find_state_for_point
from app.solver.sensitivity import run_sensitivity_analysis
from app.solver.scaling import generate_synthetic_scenario, solve_multi_region_scenario

@asynccontextmanager
async def lifespan(app: FastAPI):
    init_db()
    yield

app = FastAPI(
    title="UAV Defense Resource Planner API",
    description="Operations Research API for optimizing multi-stage UAV defense resource planning",
    version="1.0.0",
    lifespan=lifespan
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

router = APIRouter()

# ----------------- Solver Endpoints -----------------

@router.post("/solve", response_model=FullPlanResponse)
def solve_plan(scenario: Scenario):
    """
    Executes the 5-step defense planning pipeline:
    1. Place units (MCLP)
    2. Threat load aggregation (Lambda_j, a_j)
    3. Size channels (Erlang-B)
    4. Stock and reorder rules (Newsvendor + (s,Q))
    5. Reserve protection level (Littlewood's rule)
    """
    try:
        return run_defense_pipeline(scenario)
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Solver execution error: {str(exc)}"
        )

@router.post("/solve/multi-region", response_model=FullPlanResponse)
def solve_multi_region(
    scenario: Scenario,
    custom_budgets: Optional[Dict[str, float]] = None
):
    """
    Solves a multi-region defense planning scenario via regional decomposition.
    """
    try:
        return solve_multi_region_scenario(scenario, custom_budgets)
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Multi-region solver error: {str(exc)}"
        )

@router.post("/sensitivity", response_model=SensitivityResponse)
def compute_sensitivity(req: SensitivityRequest):
    """
    Executes parameter sweeps and knee detection for budget.
    """
    try:
        return run_sensitivity_analysis(req)
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Sensitivity analysis error: {str(exc)}"
        )

@router.post("/coverage")
def get_coverage_matrix_api(scenario: Scenario):
    """
    Returns the auto-computed coverage matrix (a_ij) and distance matrix (km)
    with any user overrides applied.
    """
    try:
        coverage, distances = compute_coverage_matrix(scenario)
        return {
            "coverage": coverage,
            "distances": distances,
            "coordinate_mode": scenario.coordinate_mode
        }
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Coverage calculation error: {str(exc)}"
        )

@router.get("/geo/states")
def get_india_states():
    """
    Returns the bundled, simplified Survey of India compliant GeoJSON for all 36 States/UTs.
    """
    return get_india_geojson()

@router.post("/generate", response_model=Scenario)
def generate_synthetic(req: SyntheticGenerateRequest):
    """
    Generates a synthetic scenario for scaling or benchmark demonstrations.
    All data is non-sensitive and clearly flagged.
    """
    try:
        return generate_synthetic_scenario(req)
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Synthetic generation error: {str(exc)}"
        )

# ----------------- Scenario CRUD Endpoints -----------------

@router.get("/scenarios", response_model=List[Dict[str, Any]])
def list_scenarios(session: Session = Depends(get_session)):
    """
    Lists all saved scenarios with summary metadata.
    """
    records = session.exec(select(ScenarioRecord).order_by(ScenarioRecord.updated_at.desc())).all()
    out = []
    for r in records:
        data = r.data or {}
        num_assets = len(data.get("assets", []))
        num_sites = len(data.get("sites", []))
        budget = data.get("parameters", {}).get("budget", 0.0)
        out.append({
            "id": r.id,
            "name": r.name,
            "notes": r.notes,
            "coordinate_mode": r.coordinate_mode,
            "num_assets": num_assets,
            "num_sites": num_sites,
            "budget": budget,
            "created_at": r.created_at.isoformat() if r.created_at else None,
            "updated_at": r.updated_at.isoformat() if r.updated_at else None
        })
    return out

@router.post("/scenarios", response_model=Dict[str, Any])
def create_scenario(scenario: Scenario, session: Session = Depends(get_session)):
    """
    Creates and persists a new scenario in SQLite.
    """
    sc_id = scenario.id or str(uuid.uuid4())
    scenario.id = sc_id
    rec = ScenarioRecord(
        id=sc_id,
        name=scenario.name,
        notes=scenario.notes or "",
        coordinate_mode=scenario.coordinate_mode,
        data=scenario.model_dump(),
        created_at=datetime.now(timezone.utc),
        updated_at=datetime.now(timezone.utc)
    )
    session.add(rec)
    session.commit()
    session.refresh(rec)
    return {"id": rec.id, "name": rec.name, "message": "Scenario created successfully"}

@router.get("/scenarios/{scenario_id}", response_model=Scenario)
def get_scenario(scenario_id: str, session: Session = Depends(get_session)):
    """
    Retrieves full scenario details by ID.
    """
    rec = session.get(ScenarioRecord, scenario_id)
    if not rec:
        raise HTTPException(status_code=404, detail="Scenario not found")
    data = rec.data
    data["id"] = rec.id
    data["name"] = rec.name
    data["notes"] = rec.notes
    data["coordinate_mode"] = rec.coordinate_mode
    return Scenario(**data)

@router.put("/scenarios/{scenario_id}", response_model=Dict[str, Any])
def update_scenario(scenario_id: str, scenario: Scenario, session: Session = Depends(get_session)):
    """
    Updates an existing scenario.
    """
    rec = session.get(ScenarioRecord, scenario_id)
    if not rec:
        raise HTTPException(status_code=404, detail="Scenario not found")
    scenario.id = scenario_id
    rec.name = scenario.name
    rec.notes = scenario.notes or ""
    rec.coordinate_mode = scenario.coordinate_mode
    rec.data = scenario.model_dump()
    rec.updated_at = datetime.now(timezone.utc)
    session.add(rec)
    session.commit()
    return {"id": rec.id, "name": rec.name, "message": "Scenario updated successfully"}

@router.delete("/scenarios/{scenario_id}")
def delete_scenario(scenario_id: str, session: Session = Depends(get_session)):
    """
    Deletes a scenario by ID.
    """
    rec = session.get(ScenarioRecord, scenario_id)
    if not rec:
        raise HTTPException(status_code=404, detail="Scenario not found")
    session.delete(rec)
    session.commit()
    return {"message": f"Scenario {scenario_id} deleted successfully"}

@router.post("/scenarios/{scenario_id}/duplicate", response_model=Scenario)
def duplicate_scenario(scenario_id: str, session: Session = Depends(get_session)):
    """
    Duplicates an existing scenario.
    """
    rec = session.get(ScenarioRecord, scenario_id)
    if not rec:
        raise HTTPException(status_code=404, detail="Scenario not found")
    new_id = str(uuid.uuid4())
    new_data = dict(rec.data)
    new_data["id"] = new_id
    new_data["name"] = f"{rec.name} (Copy)"
    new_rec = ScenarioRecord(
        id=new_id,
        name=new_data["name"],
        notes=rec.notes,
        coordinate_mode=rec.coordinate_mode,
        data=new_data,
        created_at=datetime.now(timezone.utc),
        updated_at=datetime.now(timezone.utc)
    )
    session.add(new_rec)
    session.commit()
    session.refresh(new_rec)
    return Scenario(**new_data)

@router.get("/scenarios/{scenario_id}/export")
def export_scenario(scenario_id: str, session: Session = Depends(get_session)):
    """
    Exports full scenario as JSON.
    """
    rec = session.get(ScenarioRecord, scenario_id)
    if not rec:
        raise HTTPException(status_code=404, detail="Scenario not found")
    return rec.data

@router.post("/import", response_model=Scenario)
def import_scenario(data: Dict[str, Any], session: Session = Depends(get_session)):
    """
    Validates and imports a scenario from uploaded JSON data.
    Auto-assigns regions for geographic coordinates if not explicitly overridden.
    """
    try:
        scenario = Scenario(**data)
        if scenario.coordinate_mode == "geo":
            for a in scenario.assets:
                if not a.is_region_overridden and (not a.region or a.region == "Outside India"):
                    a.region = find_state_for_point(a.lat, a.lon)
            for s in scenario.sites:
                if not s.is_region_overridden and (not s.region or s.region == "Outside India"):
                    s.region = find_state_for_point(s.lat, s.lon)
        sc_id = str(uuid.uuid4())
        scenario.id = sc_id
        rec = ScenarioRecord(
            id=sc_id,
            name=scenario.name,
            notes=scenario.notes or "Imported scenario",
            coordinate_mode=scenario.coordinate_mode,
            data=scenario.model_dump(),
            created_at=datetime.now(timezone.utc),
            updated_at=datetime.now(timezone.utc)
        )
        session.add(rec)
        session.commit()
        return scenario
    except Exception as exc:
        raise HTTPException(status_code=422, detail=f"Invalid scenario payload: {str(exc)}")

@router.get("/health")
def health():
    return {"status": "ok", "app": "UAV Defense Resource Planner API"}

# Mount the router both with and without /api prefix for maximum routing compatibility
app.include_router(router, prefix="/api")
app.include_router(router)

@app.get("/")
def root():
    return {"status": "ok", "app": "UAV Defense Resource Planner API"}
