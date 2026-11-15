from __future__ import annotations
from typing import Dict, List, Literal, Optional, Any
from pydantic import BaseModel, Field, model_validator
from sqlmodel import SQLModel, Field as DBField, Column, JSON
import uuid
from datetime import datetime, timezone

CoordinateMode = Literal["grid", "geo"]
PriorityClass = Literal["high", "low"]
DemandMode = Literal["derived", "manual"]

class Asset(BaseModel):
    id: str = Field(..., description="Unique asset identifier (e.g. A1)")
    name: str = Field(..., description="Descriptive asset name")
    x: Optional[float] = Field(None, description="Grid X coordinate in km")
    y: Optional[float] = Field(None, description="Grid Y coordinate in km")
    lat: Optional[float] = Field(None, description="Latitude in decimal degrees")
    lon: Optional[float] = Field(None, description="Longitude in decimal degrees")
    value: float = Field(..., gt=0, description="Asset criticality/importance value score (w_i > 0)")
    priority_class: Optional[PriorityClass] = Field(None, description="Priority classification: high or low")
    threat_rate: float = Field(..., ge=0, description="Expected drone threat rate lambda_i (threats/min)")
    region: Optional[str] = Field(None, description="Optional region name for regional decomposition")
    is_region_overridden: Optional[bool] = Field(False, description="Manual region override flag")

class CandidateSite(BaseModel):
    id: str = Field(..., description="Unique site identifier (e.g. S1)")
    name: str = Field(..., description="Descriptive site name")
    x: Optional[float] = Field(None, description="Grid X coordinate in km")
    y: Optional[float] = Field(None, description="Grid Y coordinate in km")
    lat: Optional[float] = Field(None, description="Latitude in decimal degrees")
    lon: Optional[float] = Field(None, description="Longitude in decimal degrees")
    cost: float = Field(..., gt=0, description="Capital cost to open site (c_j > 0)")
    range_km: float = Field(..., gt=0, description="Interceptor coverage radius in km")
    max_channels: int = Field(10, ge=1, le=50, description="Maximum engagement channels capacity")
    channel_cost: float = Field(0.0, ge=0, description="Optional marginal cost per installed channel")
    depot_distance_km: Optional[float] = Field(None, ge=0, description="Distance to replenishment depot in km")
    region: Optional[str] = Field(None, description="Optional region name")
    is_region_overridden: Optional[bool] = Field(False, description="Manual region override flag")

class Depot(BaseModel):
    id: str = Field(..., description="Unique depot identifier (e.g. D1)")
    name: str = Field(..., description="Descriptive depot name")
    x: Optional[float] = Field(None, description="Grid X coordinate in km")
    y: Optional[float] = Field(None, description="Grid Y coordinate in km")
    lat: Optional[float] = Field(None, description="Latitude in decimal degrees")
    lon: Optional[float] = Field(None, description="Longitude in decimal degrees")

class GlobalParameters(BaseModel):
    budget: float = Field(80.0, ge=0, description="Defense deployment budget (B)")
    mean_engagement_time_min: float = Field(1.5, gt=0, description="Mean duration of one drone engagement (1/mu in minutes)")
    target_leak_probability: float = Field(0.05, gt=0, lt=1, description="Target maximum leak probability alpha")
    attack_duration_min: float = Field(30.0, gt=0, description="Duration of single attack wave (T in minutes)")
    shots_per_engagement: int = Field(1, ge=1, description="Interceptors fired per engaged threat (k)")
    underage_cost: float = Field(50.0, gt=0, description="Cost of stockout per interceptor (Cu)")
    overage_cost: float = Field(5.0, gt=0, description="Cost of excess inventory holding/waste (Co)")
    interceptor_unit_cost: float = Field(2.0, ge=0, description="Unit cost per interceptor")
    demand_mode: DemandMode = Field("derived", description="Demand distribution source: derived or manual")
    manual_mean_demand: Optional[float] = Field(None, ge=0, description="Manual mean demand mu_D")
    manual_sd_demand: Optional[float] = Field(None, ge=0, description="Manual demand standard deviation sigma_D")
    daily_demand_mean: Optional[float] = Field(None, ge=0, description="Mean daily baseline threat volume")
    daily_demand_sd: Optional[float] = Field(None, ge=0, description="Daily demand standard deviation")
    target_service_level: float = Field(0.95, gt=0, lt=1, description="Cycle service level for reorder point (e.g. 0.95)")
    base_lead_time_days: float = Field(2.0, ge=0, description="Fixed handling lead time in days")
    transport_speed_km_per_day: float = Field(300.0, gt=0, description="Logistics fleet transport speed (km/day)")
    depot_x: Optional[float] = Field(0.0, description="Depot grid X coordinate")
    depot_y: Optional[float] = Field(0.0, description="Depot grid Y coordinate")
    depot_lat: Optional[float] = Field(None, description="Depot latitude")
    depot_lon: Optional[float] = Field(None, description="Depot longitude")
    order_setup_cost: float = Field(20.0, ge=0, description="Fixed order setup cost (K)")
    holding_cost_per_unit_per_day: float = Field(0.01, gt=0, description="Unit holding cost per day (h)")
    high_value_threshold: float = Field(75.0, ge=0, description="Threshold above which assets default to high priority")
    r1_override: Optional[float] = Field(None, gt=0, description="Override unit value for high priority class")
    r2_override: Optional[float] = Field(None, gt=0, description="Override unit value for low priority class")
    solver_time_limit_sec: int = Field(60, ge=1, le=600, description="MILP solver timeout in seconds")
    assignment_mode: Literal["single"] = Field("single", description="Asset-to-site assignment mode (single)")

class Scenario(BaseModel):
    id: Optional[str] = Field(None, description="Scenario unique ID")
    name: str = Field(..., min_length=1, description="Scenario name")
    notes: Optional[str] = Field("", description="User notes/description")
    coordinate_mode: CoordinateMode = Field("geo", description="Coordinate reference system (grid or geo)")
    assets: List[Asset] = Field(default_factory=list)
    sites: List[CandidateSite] = Field(default_factory=list)
    depots: List[Depot] = Field(default_factory=list, description="Resupply replenishment depots")
    parameters: GlobalParameters = Field(default_factory=GlobalParameters)
    coverage_overrides: Dict[str, int] = Field(default_factory=dict, description="Manual a_ij overrides: 'assetId_siteId': 0 or 1")

    @model_validator(mode="after")
    def check_unique_ids(self) -> Scenario:
        asset_ids = [a.id for a in self.assets]
        if len(asset_ids) != len(set(asset_ids)):
            raise ValueError("Asset IDs must be unique.")
        site_ids = [s.id for s in self.sites]
        if len(site_ids) != len(set(site_ids)):
            raise ValueError("Site IDs must be unique.")
        return self

# SQLModel Table for Scenario Persistence
class ScenarioRecord(SQLModel, table=True):
    __tablename__ = "scenarios"
    id: str = DBField(default_factory=lambda: str(uuid.uuid4()), primary_key=True)
    name: str = DBField(index=True)
    notes: Optional[str] = DBField(default="")
    coordinate_mode: str = DBField(default="grid")
    data: Dict[str, Any] = DBField(default={}, sa_column=Column(JSON))
    created_at: datetime = DBField(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = DBField(default_factory=lambda: datetime.now(timezone.utc))

# Response Schemas for Solver Pipeline
class LocationAssignment(BaseModel):
    asset_id: str
    asset_name: str
    site_id: Optional[str]
    site_name: Optional[str]
    covered: bool
    distance_km: Optional[float] = None
    value: float
    threat_rate: float
    priority_class: str

class SiteLocationResult(BaseModel):
    site_id: str
    site_name: str
    opened: bool
    cost: float
    assigned_assets: List[str]
    total_assigned_value: float

class Step1LocationOutput(BaseModel):
    status: str
    opened_sites: List[str]
    site_results: List[SiteLocationResult]
    assignments: List[LocationAssignment]
    total_value_protected: float
    total_possible_value: float
    pct_value_protected: float
    total_site_cost: float
    budget: float
    channel_cost_total: float = 0.0
    total_cost_with_channels: float = 0.0
    budget_exceeded: bool = False
    solver_used: str  # "cbc_milp" or "greedy_fallback" or "empty"
    uncovered_assets: List[str]
    solve_time_sec: float
    n_vars: int
    n_constraints: int

class ComparisonResult(BaseModel):
    model_name: str
    opened_sites: List[str]
    total_cost: float
    value_protected: float
    pct_value_protected: float
    notes: str
    optimality_gap_pct: Optional[float] = None

class Step2LoadOutput(BaseModel):
    site_loads: Dict[str, float]  # site_id -> Lambda_j (threats/min)
    offered_loads: Dict[str, float]  # site_id -> a_j (Erlangs)
    total_system_load: float

class ChannelCurvePoint(BaseModel):
    channels: int
    leak_probability: float
    marginal_reduction: float

class SiteChannelResult(BaseModel):
    site_id: str
    lambda_rate: float
    offered_load_erlangs: float
    channels_allocated: int
    leak_probability: float
    target_met: bool
    expected_leaks_per_min: float
    curve: List[ChannelCurvePoint]
    note: Optional[str] = None

class Step3QueueingOutput(BaseModel):
    site_channels: Dict[str, SiteChannelResult]
    total_channels: int
    system_weighted_leak_prob: float
    worst_site_leak_prob: float
    all_targets_met: bool

class SiteInventoryResult(BaseModel):
    site_id: str
    lambda_share: float
    allocated_stock_Q: int
    depot_distance_km: float
    lead_time_days: float
    reorder_point_s: int
    suggested_order_qty_EOQ: int
    plain_english_rule: str

class Step4InventoryOutput(BaseModel):
    demand_mode: str
    mu_D: float
    sigma_D: float
    critical_ratio: float
    z_score: float
    total_stock_Q_star: int
    site_inventory: Dict[str, SiteInventoryResult]
    derivation_text: str

class Step5ReserveOutput(BaseModel):
    high_priority_asset_ids: List[str]
    mu_1: float
    sigma_1: float
    r1: float
    r2: float
    ratio_r2_r1: float
    reserve_y1_star: int
    booking_limit_low_value: int
    site_reserves: Dict[str, int]
    plain_english_rule: str
    explanation: str

class WorkingStep(BaseModel):
    step_number: int
    title: str
    details: List[str]

class RegionResult(BaseModel):
    region_name: str
    num_assets: int = 0
    total_asset_value: float = 0.0
    value_protected: float = 0.0
    pct_value_protected: float = 0.0
    opened_sites: List[str] = Field(default_factory=list)
    num_opened_sites: int = 0
    total_site_cost: float = 0.0
    total_channels: int = 0
    allocated_stock_Q: int = 0
    reserve_y1: int = 0
    worst_leak_probability: float = 0.0
    covered_asset_ids: List[str] = Field(default_factory=list)
    uncovered_asset_ids: List[str] = Field(default_factory=list)

class FullPlanResponse(BaseModel):
    scenario_id: Optional[str] = None
    scenario_name: str
    location: Step1LocationOutput
    load: Step2LoadOutput
    channels: Step3QueueingOutput
    inventory: Step4InventoryOutput
    reserve: Step5ReserveOutput
    results_by_region: Dict[str, RegionResult] = Field(default_factory=dict)
    comparison: List[ComparisonResult]
    working: List[WorkingStep]
    warnings: List[str]
    meta: Dict[str, Any]

class SensitivityRequest(BaseModel):
    scenario: Scenario
    param: Literal[
        "budget",
        "threat_multiplier",
        "target_leak_probability",
        "mean_engagement_time_min",
        "underage_cost",
        "overage_cost",
        "r2_r1_ratio"
    ]
    start: float
    end: float
    steps: int = Field(20, ge=2, le=50)
    knee_epsilon_pct: float = Field(1.0, description="Epsilon threshold for knee detection (% of max slope)")
    two_d_param: Optional[str] = None
    two_d_start: Optional[float] = None
    two_d_end: Optional[float] = None
    two_d_steps: Optional[int] = None

class SensitivityPoint(BaseModel):
    param_value: float
    value_protected: float
    pct_value_protected: float
    total_channels: int
    total_stock_Q_star: int
    reserve_y1_star: int
    total_cost: float
    worst_leak_prob: float

class SensitivityResponse(BaseModel):
    param: str
    points: List[SensitivityPoint]
    knee_point: Optional[float] = None
    knee_message: Optional[str] = None
    heatmap: Optional[List[Dict[str, Any]]] = None

class SyntheticGenerateRequest(BaseModel):
    num_assets: int = Field(10, ge=2, le=200)
    num_sites: int = Field(12, ge=2, le=200)
    coordinate_mode: CoordinateMode = "geo"
    bbox: Optional[Dict[str, float]] = None  # {min_x, max_x, min_y, max_y} or {min_lat, max_lat, min_lon, max_lon}
    preset_region: Optional[str] = None  # e.g., "punjab", "rajasthan", "ladakh", "custom"
    selected_states: Optional[List[str]] = None
    spread_all_states: bool = False
    value_min: float = 20.0
    value_max: float = 120.0
    threat_min: float = 0.1
    threat_max: float = 0.6
    cost_min: float = 15.0
    cost_max: float = 50.0
    range_min: float = 2.0
    range_max: float = 6.0
    budget: Optional[float] = None
