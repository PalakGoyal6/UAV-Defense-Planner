import json
import pytest
from fastapi.testclient import TestClient
from app.main import app

def test_api_health():
    with TestClient(app) as client:
        res = client.get("/health")
        assert res.status_code == 200
        assert res.json()["status"] == "ok"

def test_scenario_crud():
    with TestClient(app) as client:
        # List scenarios (should include seeded air base)
        res = client.get("/api/scenarios")
        assert res.status_code == 200
        scenarios = res.json()
        assert len(scenarios) >= 1

        # Get first scenario
        sc_id = scenarios[0]["id"]
        get_res = client.get(f"/api/scenarios/{sc_id}")
        assert get_res.status_code == 200
        sc_data = get_res.json()
        assert sc_data["name"]

        # Duplicate scenario
        dup_res = client.post(f"/api/scenarios/{sc_id}/duplicate")
        assert dup_res.status_code == 200
        dup_id = dup_res.json()["id"]

        # Delete duplicated scenario
        del_res = client.delete(f"/api/scenarios/{dup_id}")
        assert del_res.status_code == 200

def test_solve_endpoint():
    with TestClient(app) as client:
        with open("sample_data/air_base.json", "r") as f:
            data = json.load(f)

        res = client.post("/api/solve", json=data)
        assert res.status_code == 200
        plan = res.json()
        assert plan["location"]["status"] in ("Optimal", "Feasible")
        assert plan["location"]["total_value_protected"] == 360.0
        assert plan["channels"]["total_channels"] == 7
        assert plan["inventory"]["total_stock_Q_star"] == 51
        assert plan["reserve"]["reserve_y1_star"] == 30
        assert len(plan["working"]) == 5

def test_coverage_endpoint():
    with TestClient(app) as client:
        with open("sample_data/air_base.json", "r") as f:
            data = json.load(f)

        res = client.post("/api/coverage", json=data)
        assert res.status_code == 200
        cov_data = res.json()
        assert "coverage" in cov_data
        assert "distances" in cov_data
        assert cov_data["coverage"]["A1"]["S1"] == 1

def test_synthetic_generate_endpoint():
    with TestClient(app) as client:
        req = {
            "num_assets": 8,
            "num_sites": 10,
            "coordinate_mode": "grid"
        }
        res = client.post("/api/generate", json=req)
        assert res.status_code == 200
        gen_data = res.json()
        assert len(gen_data["assets"]) == 8
        assert len(gen_data["sites"]) == 10

def test_geo_states_endpoint():
    with TestClient(app) as client:
        res = client.get("/api/geo/states")
        assert res.status_code == 200
        data = res.json()
        assert data.get("type") == "FeatureCollection"
        features = data.get("features", [])
        assert len(features) >= 36
        state_names = [f["properties"].get("state_name") for f in features]
        assert "Delhi" in state_names
        assert "Maharashtra" in state_names
        assert "Karnataka" in state_names
        assert "Jammu and Kashmir" in state_names or "Ladakh" in state_names
