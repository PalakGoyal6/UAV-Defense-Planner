import os
import json
from sqlmodel import SQLModel, create_engine, Session, select
from app.models import ScenarioRecord, Scenario

if os.environ.get("VERCEL") or os.environ.get("AWS_LAMBDA_FUNCTION_NAME"):
    DATABASE_FILE = "/tmp/scenarios.db"
else:
    DATABASE_FILE = os.path.join(os.path.dirname(os.path.dirname(__file__)), "scenarios.db")

sqlite_url = f"sqlite:///{DATABASE_FILE}"
engine = create_engine(sqlite_url, connect_args={"check_same_thread": False})

def find_sample_file(filename: str) -> str | None:
    candidates = [
        os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), "sample_data", filename),
        os.path.join(os.getcwd(), "sample_data", filename),
        f"/var/task/sample_data/{filename}",
        os.path.join(os.path.dirname(__file__), filename)
    ]
    for p in candidates:
        if os.path.exists(p):
            return p
    return None

def find_air_base_sample() -> str | None:
    return find_sample_file("air_base.json")

def find_india_demo_sample() -> str | None:
    return find_sample_file("india_geo_demo.json")

def init_db():
    SQLModel.metadata.create_all(engine)
    with Session(engine) as session:
        # Check if air-base-small exists
        air_base_rec = session.get(ScenarioRecord, "air-base-small")
        if not air_base_rec:
            air_base_path = find_air_base_sample()
            data = None
            if air_base_path:
                try:
                    with open(air_base_path, "r", encoding="utf-8") as f:
                        data = json.load(f)
                except Exception as e:
                    print(f"Warning: Failed to load air_base.json: {e}")

            if not data:
                data = {
                    "name": "Air Base — small example",
                    "notes": "Preloaded illustrative example for an air base defense perimeter in grid coordinates (km).",
                    "coordinate_mode": "grid",
                    "assets": [
                        {"id": "A1", "name": "Command Centre", "x": 5.0, "y": 5.0, "value": 100.0, "priority_class": "high", "threat_rate": 0.40},
                        {"id": "A2", "name": "Fuel Depot", "x": 8.0, "y": 3.0, "value": 90.0, "priority_class": "high", "threat_rate": 0.35},
                        {"id": "A3", "name": "Aircraft Apron", "x": 3.0, "y": 8.0, "value": 80.0, "priority_class": "high", "threat_rate": 0.30},
                        {"id": "A4", "name": "Power Supply", "x": 9.0, "y": 8.0, "value": 60.0, "priority_class": "low", "threat_rate": 0.25},
                        {"id": "A5", "name": "Stores", "x": 1.0, "y": 2.0, "value": 30.0, "priority_class": "low", "threat_rate": 0.15}
                    ],
                    "sites": [
                        {"id": "S1", "name": "Site 1", "x": 4.0, "y": 4.0, "cost": 30.0, "range_km": 3.0, "max_channels": 8, "channel_cost": 0.0},
                        {"id": "S2", "name": "Site 2", "x": 7.0, "y": 4.0, "cost": 25.0, "range_km": 3.0, "max_channels": 8, "channel_cost": 0.0},
                        {"id": "S3", "name": "Site 3", "x": 4.0, "y": 7.0, "cost": 25.0, "range_km": 3.0, "max_channels": 8, "channel_cost": 0.0},
                        {"id": "S4", "name": "Site 4", "x": 8.5, "y": 7.0, "cost": 20.0, "range_km": 2.5, "max_channels": 8, "channel_cost": 0.0},
                        {"id": "S5", "name": "Site 5", "x": 2.0, "y": 3.0, "cost": 15.0, "range_km": 2.5, "max_channels": 8, "channel_cost": 0.0},
                        {"id": "S6", "name": "Site 6", "x": 6.0, "y": 6.0, "cost": 40.0, "range_km": 4.5, "max_channels": 10, "channel_cost": 0.0}
                    ],
                    "parameters": {
                        "budget": 80.0, "mean_engagement_time_min": 1.5, "target_leak_probability": 0.05,
                        "attack_duration_min": 30.0, "shots_per_engagement": 1, "underage_cost": 50.0,
                        "overage_cost": 5.0, "interceptor_unit_cost": 2.0, "demand_mode": "derived",
                        "target_service_level": 0.95, "base_lead_time_days": 2.0, "transport_speed_km_per_day": 300.0,
                        "depot_x": 0.0, "depot_y": 0.0, "order_setup_cost": 20.0, "holding_cost_per_unit_per_day": 0.01,
                        "high_value_threshold": 75.0, "solver_time_limit_sec": 60, "assignment_mode": "single"
                    },
                    "coverage_overrides": {}
                }

            default_rec = ScenarioRecord(
                id="air-base-small",
                name=data.get("name", "Air Base — small example"),
                notes=data.get("notes", "Default seed scenario"),
                coordinate_mode=data.get("coordinate_mode", "grid"),
                data=data
            )
            session.add(default_rec)
            session.commit()

        # Check if india-defense-demo exists
        india_rec = session.get(ScenarioRecord, "india-defense-demo")
        if not india_rec:
            india_path = find_india_demo_sample()
            data_india = None
            if india_path:
                try:
                    with open(india_path, "r", encoding="utf-8") as f:
                        data_india = json.load(f)
                except Exception as e:
                    print(f"Warning: Failed to load india_geo_demo.json: {e}")

            if not data_india:
                data_india = {
                    "name": "India National Defense — Geo Example",
                    "notes": "Preloaded illustrative multi-state scenario covering critical assets across Northern & Western India with Survey of India boundary integration and resupply depots.",
                    "coordinate_mode": "geo",
                    "assets": [
                        {"id": "A1", "name": "Northern Air Command Base (Punjab)", "lat": 31.634, "lon": 74.8723, "region": "Punjab", "value": 120.0, "priority_class": "high", "threat_rate": 0.45},
                        {"id": "A2", "name": "Strategic Communications Center (Delhi)", "lat": 28.6139, "lon": 77.209, "region": "Delhi", "value": 150.0, "priority_class": "high", "threat_rate": 0.50},
                        {"id": "A3", "name": "Desert Border Outpost (Rajasthan)", "lat": 26.9157, "lon": 70.9083, "region": "Rajasthan", "value": 95.0, "priority_class": "high", "threat_rate": 0.35},
                        {"id": "A4", "name": "Western Coastal Radar (Gujarat)", "lat": 23.242, "lon": 69.6669, "region": "Gujarat", "value": 85.0, "priority_class": "low", "threat_rate": 0.25},
                        {"id": "A5", "name": "Central Ammunition Depot (Haryana)", "lat": 30.3782, "lon": 76.7767, "region": "Haryana", "value": 110.0, "priority_class": "high", "threat_rate": 0.30},
                        {"id": "A6", "name": "Naval Air Station (Maharashtra)", "lat": 18.922, "lon": 72.8347, "region": "Maharashtra", "value": 130.0, "priority_class": "high", "threat_rate": 0.40}
                    ],
                    "sites": [
                        {"id": "S1", "name": "Punjab Defense Battery", "lat": 31.326, "lon": 75.5762, "region": "Punjab", "cost": 45.0, "range_km": 160.0, "max_channels": 8, "channel_cost": 0.0},
                        {"id": "S2", "name": "Delhi NCR SAM Battery", "lat": 28.5355, "lon": 77.391, "region": "Delhi", "cost": 50.0, "range_km": 180.0, "max_channels": 10, "channel_cost": 0.0},
                        {"id": "S3", "name": "Rajasthan Forward Site", "lat": 26.2389, "lon": 73.0243, "region": "Rajasthan", "cost": 40.0, "range_km": 280.0, "max_channels": 8, "channel_cost": 0.0},
                        {"id": "S4", "name": "Gujarat Border Defense Unit", "lat": 23.1815, "lon": 70.15, "region": "Gujarat", "cost": 35.0, "range_km": 170.0, "max_channels": 6, "channel_cost": 0.0},
                        {"id": "S5", "name": "Haryana Multi-Layer Battery", "lat": 29.9695, "lon": 76.8783, "region": "Haryana", "cost": 40.0, "range_km": 190.0, "max_channels": 8, "channel_cost": 0.0},
                        {"id": "S6", "name": "Mumbai Coastal Defense Unit", "lat": 19.076, "lon": 72.8777, "region": "Maharashtra", "cost": 45.0, "range_km": 150.0, "max_channels": 8, "channel_cost": 0.0}
                    ],
                    "depots": [
                        {"id": "D1", "name": "Central Depot Ambala", "lat": 30.3782, "lon": 76.7767},
                        {"id": "D2", "name": "Western Depot Pune", "lat": 18.5204, "lon": 73.8567}
                    ],
                    "parameters": {
                        "budget": 200.0, "mean_engagement_time_min": 2.0, "target_leak_probability": 0.05,
                        "attack_duration_min": 45.0, "shots_per_engagement": 1, "underage_cost": 60.0,
                        "overage_cost": 8.0, "interceptor_unit_cost": 3.0, "demand_mode": "derived",
                        "target_service_level": 0.95, "base_lead_time_days": 1.5, "transport_speed_km_per_day": 400.0,
                        "depot_x": 0.0, "depot_y": 0.0, "order_setup_cost": 25.0, "holding_cost_per_unit_per_day": 0.02,
                        "high_value_threshold": 100.0, "solver_time_limit_sec": 60, "assignment_mode": "single"
                    },
                    "coverage_overrides": {}
                }

            geo_rec = ScenarioRecord(
                id="india-defense-demo",
                name=data_india.get("name", "India National Defense — Geo Example"),
                notes=data_india.get("notes", "Default India Geo seed scenario"),
                coordinate_mode=data_india.get("coordinate_mode", "geo"),
                data=data_india
            )
            session.add(geo_rec)
            session.commit()

def get_session():
    init_db()
    with Session(engine) as session:
        yield session
