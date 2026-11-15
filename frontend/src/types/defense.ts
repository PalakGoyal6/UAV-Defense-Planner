export type CoordinateMode = 'grid' | 'geo';
export type PriorityClass = 'high' | 'low';
export type DemandMode = 'derived' | 'manual';

export interface Asset {
  id: string;
  name: string;
  x?: number | null;
  y?: number | null;
  lat?: number | null;
  lon?: number | null;
  value: number;
  priority_class?: PriorityClass | null;
  threat_rate: number;
  region?: string | null;
}

export interface CandidateSite {
  id: string;
  name: string;
  x?: number | null;
  y?: number | null;
  lat?: number | null;
  lon?: number | null;
  cost: number;
  range_km: number;
  max_channels: number;
  channel_cost: number;
  depot_distance_km?: number | null;
  region?: string | null;
}

export interface GlobalParameters {
  budget: number;
  mean_engagement_time_min: number;
  target_leak_probability: number;
  attack_duration_min: number;
  shots_per_engagement: number;
  underage_cost: number;
  overage_cost: number;
  interceptor_unit_cost: number;
  demand_mode: DemandMode;
  manual_mean_demand?: number | null;
  manual_sd_demand?: number | null;
  daily_demand_mean?: number | null;
  daily_demand_sd?: number | null;
  target_service_level: number;
  base_lead_time_days: number;
  transport_speed_km_per_day: number;
  depot_x?: number | null;
  depot_y?: number | null;
  depot_lat?: number | null;
  depot_lon?: number | null;
  order_setup_cost: number;
  holding_cost_per_unit_per_day: number;
  high_value_threshold: number;
  r1_override?: number | null;
  r2_override?: number | null;
  solver_time_limit_sec: number;
  assignment_mode: 'single';
}

export interface Scenario {
  id?: string | null;
  name: string;
  notes?: string | null;
  coordinate_mode: CoordinateMode;
  assets: Asset[];
  sites: CandidateSite[];
  parameters: GlobalParameters;
  coverage_overrides: Record<string, number>;
}

export interface ScenarioListItem {
  id: string;
  name: string;
  notes?: string;
  coordinate_mode: CoordinateMode;
  num_assets: number;
  num_sites: number;
  budget: number;
  created_at?: string;
  updated_at?: string;
}

export interface LocationAssignment {
  asset_id: string;
  asset_name: string;
  site_id?: string | null;
  site_name?: string | null;
  covered: boolean;
  distance_km?: number | null;
  value: number;
  threat_rate: number;
  priority_class: string;
}

export interface SiteLocationResult {
  site_id: string;
  site_name: string;
  opened: boolean;
  cost: number;
  assigned_assets: string[];
  total_assigned_value: number;
}

export interface Step1LocationOutput {
  status: string;
  opened_sites: string[];
  site_results: SiteLocationResult[];
  assignments: LocationAssignment[];
  total_value_protected: number;
  total_possible_value: number;
  pct_value_protected: number;
  total_site_cost: number;
  budget: number;
  channel_cost_total: number;
  total_cost_with_channels: number;
  budget_exceeded: boolean;
  solver_used: string;
  uncovered_assets: string[];
  solve_time_sec: number;
  n_vars: number;
  n_constraints: number;
}

export interface Step2LoadOutput {
  site_loads: Record<string, number>;
  offered_loads: Record<string, number>;
  total_system_load: number;
}

export interface ChannelCurvePoint {
  channels: number;
  leak_probability: number;
  marginal_reduction: number;
}

export interface SiteChannelResult {
  site_id: string;
  lambda_rate: number;
  offered_load_erlangs: number;
  channels_allocated: number;
  leak_probability: number;
  target_met: boolean;
  expected_leaks_per_min: number;
  curve: ChannelCurvePoint[];
  note?: string | null;
}

export interface Step3QueueingOutput {
  site_channels: Record<string, SiteChannelResult>;
  total_channels: number;
  system_weighted_leak_prob: number;
  worst_site_leak_prob: number;
  all_targets_met: boolean;
}

export interface SiteInventoryResult {
  site_id: string;
  lambda_share: number;
  allocated_stock_Q: number;
  depot_distance_km: number;
  lead_time_days: number;
  reorder_point_s: number;
  suggested_order_qty_EOQ: number;
  plain_english_rule: string;
}

export interface Step4InventoryOutput {
  demand_mode: string;
  mu_D: number;
  sigma_D: number;
  critical_ratio: number;
  z_score: number;
  total_stock_Q_star: number;
  site_inventory: Record<string, SiteInventoryResult>;
  derivation_text: string;
}

export interface Step5ReserveOutput {
  high_priority_asset_ids: string[];
  mu_1: number;
  sigma_1: number;
  r1: number;
  r2: number;
  ratio_r2_r1: number;
  reserve_y1_star: number;
  booking_limit_low_value: number;
  site_reserves: Record<string, number>;
  plain_english_rule: string;
  explanation: string;
}

export interface ComparisonResult {
  model_name: string;
  opened_sites: string[];
  total_cost: number;
  value_protected: number;
  pct_value_protected: number;
  notes: string;
  optimality_gap_pct?: number | null;
}

export interface WorkingStep {
  step_number: number;
  title: string;
  details: string[];
}

export interface FullPlanResponse {
  scenario_id?: string | null;
  scenario_name: string;
  location: Step1LocationOutput;
  load: Step2LoadOutput;
  channels: Step3QueueingOutput;
  inventory: Step4InventoryOutput;
  reserve: Step5ReserveOutput;
  comparison: ComparisonResult[];
  working: WorkingStep[];
  warnings: string[];
  meta: Record<string, any>;
}

export interface SensitivityPoint {
  param_value: number;
  value_protected: number;
  pct_value_protected: number;
  total_channels: number;
  total_stock_Q_star: number;
  reserve_y1_star: number;
  total_cost: number;
  worst_leak_prob: number;
}

export interface SensitivityResponse {
  param: string;
  points: SensitivityPoint[];
  knee_point?: number | null;
  knee_message?: string | null;
  heatmap?: Array<Record<string, any>> | null;
}
