import React from 'react';
import { GlobalParameters, CoordinateMode } from '../types/defense';
import { RotateCcw, HelpCircle, Shield, Radio, Package, Repeat, Layers } from 'lucide-react';

interface ParametersFormProps {
  parameters: GlobalParameters;
  onChange: (parameters: GlobalParameters) => void;
  coordinateMode: CoordinateMode;
}

const DEFAULT_PARAMS: GlobalParameters = {
  budget: 80.0,
  mean_engagement_time_min: 1.5,
  target_leak_probability: 0.05,
  attack_duration_min: 30.0,
  shots_per_engagement: 1,
  underage_cost: 50.0,
  overage_cost: 5.0,
  interceptor_unit_cost: 2.0,
  demand_mode: 'derived',
  manual_mean_demand: null,
  manual_sd_demand: null,
  daily_demand_mean: null,
  daily_demand_sd: null,
  target_service_level: 0.95,
  base_lead_time_days: 2.0,
  transport_speed_km_per_day: 300.0,
  depot_x: 0.0,
  depot_y: 0.0,
  depot_lat: 28.6139,
  depot_lon: 77.2090,
  order_setup_cost: 20.0,
  holding_cost_per_unit_per_day: 0.01,
  high_value_threshold: 75.0,
  r1_override: null,
  r2_override: null,
  solver_time_limit_sec: 60,
  assignment_mode: 'single'
};

export const ParametersForm: React.FC<ParametersFormProps> = ({
  parameters,
  onChange,
  coordinateMode
}) => {
  const updateField = (field: keyof GlobalParameters, value: any) => {
    onChange({ ...parameters, [field]: value });
  };

  const handleReset = () => {
    onChange({ ...DEFAULT_PARAMS });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100">
            System & Operations Research Parameters
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Fine-tune budget limits, Erlang-B channel sizing targets, Newsvendor penalties, and Littlewood protection rules.
          </p>
        </div>
        <button
          onClick={handleReset}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-750 transition"
        >
          <RotateCcw className="w-3.5 h-3.5" /> Reset to Defaults
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Section 1: Location & Placement */}
        <div className="p-5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl space-y-4 shadow-xs">
          <div className="flex items-center gap-2 pb-2 border-b border-slate-100 dark:border-slate-800 text-slate-800 dark:text-slate-200 font-semibold text-sm">
            <Shield className="w-4 h-4 text-indigo-500" />
            <span>1. Unit Placement & Budget (MCLP)</span>
          </div>

          <div className="space-y-3 text-xs">
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="font-medium text-slate-700 dark:text-slate-300">Defense Budget (B)</label>
                <span className="text-[11px] text-slate-400 flex items-center gap-1" title="Constraint: Σ cⱼ yⱼ ≤ B">
                  Σ cⱼ yⱼ ≤ B <HelpCircle className="w-3 h-3 text-slate-400" />
                </span>
              </div>
              <div className="relative">
                <span className="absolute left-3 top-2 text-slate-400">₹</span>
                <input
                  type="number"
                  min="0"
                  step="5"
                  value={parameters.budget}
                  onChange={(e) => updateField('budget', parseFloat(e.target.value) || 0)}
                  className="w-full pl-7 pr-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 dark:bg-slate-800 font-mono text-xs font-semibold"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">Solver Timeout (sec)</label>
                <input
                  type="number"
                  min="5"
                  max="300"
                  value={parameters.solver_time_limit_sec}
                  onChange={(e) => updateField('solver_time_limit_sec', parseInt(e.target.value, 10) || 60)}
                  className="w-full px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 dark:bg-slate-800 font-mono text-xs"
                />
              </div>
              <div>
                <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">Assignment Mode</label>
                <select
                  value={parameters.assignment_mode}
                  onChange={(e) => updateField('assignment_mode', e.target.value)}
                  className="w-full px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 dark:bg-slate-800 text-xs"
                >
                  <option value="single">Single (1 site/asset)</option>
                </select>
              </div>
            </div>
          </div>
        </div>

        {/* Section 2: Queueing & Engagement Channels */}
        <div className="p-5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl space-y-4 shadow-xs">
          <div className="flex items-center gap-2 pb-2 border-b border-slate-100 dark:border-slate-800 text-slate-800 dark:text-slate-200 font-semibold text-sm">
            <Radio className="w-4 h-4 text-emerald-500" />
            <span>2. Engagement Channels & Queueing (Erlang-B)</span>
          </div>

          <div className="grid grid-cols-2 gap-3 text-xs">
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="font-medium text-slate-700 dark:text-slate-300">Target Leak Prob (α)</label>
                <span title="Smallest c with B(c, a) ≤ α" className="text-[10px] text-slate-400">B(c, a) ≤ α</span>
              </div>
              <input
                type="number"
                min="0.001"
                max="0.5"
                step="0.01"
                value={parameters.target_leak_probability}
                onChange={(e) => updateField('target_leak_probability', parseFloat(e.target.value) || 0.05)}
                className="w-full px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 dark:bg-slate-800 font-mono text-xs font-semibold"
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="font-medium text-slate-700 dark:text-slate-300">Mean Engagement (1/µ)</label>
                <span title="Offered load a = Λ × (1/µ)" className="text-[10px] text-slate-400">mins/drone</span>
              </div>
              <input
                type="number"
                min="0.1"
                step="0.1"
                value={parameters.mean_engagement_time_min}
                onChange={(e) => updateField('mean_engagement_time_min', parseFloat(e.target.value) || 1.5)}
                className="w-full px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 dark:bg-slate-800 font-mono text-xs"
              />
            </div>

            <div>
              <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">Attack Window T (mins)</label>
              <input
                type="number"
                min="5"
                step="5"
                value={parameters.attack_duration_min}
                onChange={(e) => updateField('attack_duration_min', parseFloat(e.target.value) || 30.0)}
                className="w-full px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 dark:bg-slate-800 font-mono text-xs"
              />
            </div>

            <div>
              <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">Shots Per Engagement (k)</label>
              <input
                type="number"
                min="1"
                max="5"
                value={parameters.shots_per_engagement}
                onChange={(e) => updateField('shots_per_engagement', parseInt(e.target.value, 10) || 1)}
                className="w-full px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 dark:bg-slate-800 font-mono text-xs"
              />
            </div>
          </div>
        </div>

        {/* Section 3: Inventory & Newsvendor */}
        <div className="p-5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl space-y-4 shadow-xs">
          <div className="flex items-center gap-2 pb-2 border-b border-slate-100 dark:border-slate-800 text-slate-800 dark:text-slate-200 font-semibold text-sm">
            <Package className="w-4 h-4 text-purple-500" />
            <span>3. Interceptor Stocking (Newsvendor)</span>
          </div>

          <div className="space-y-3 text-xs">
            <div className="grid grid-cols-3 gap-2">
              <div>
                <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">Underage Cost (Cu)</label>
                <input
                  type="number"
                  min="1"
                  step="5"
                  value={parameters.underage_cost}
                  onChange={(e) => updateField('underage_cost', parseFloat(e.target.value) || 50)}
                  className="w-full px-2 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 dark:bg-slate-800 font-mono text-xs"
                />
              </div>
              <div>
                <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">Overage Cost (Co)</label>
                <input
                  type="number"
                  min="0.1"
                  step="1"
                  value={parameters.overage_cost}
                  onChange={(e) => updateField('overage_cost', parseFloat(e.target.value) || 5)}
                  className="w-full px-2 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 dark:bg-slate-800 font-mono text-xs"
                />
              </div>
              <div>
                <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">Unit Cost (₹)</label>
                <input
                  type="number"
                  min="0"
                  step="0.5"
                  value={parameters.interceptor_unit_cost}
                  onChange={(e) => updateField('interceptor_unit_cost', parseFloat(e.target.value) || 2)}
                  className="w-full px-2 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 dark:bg-slate-800 font-mono text-xs"
                />
              </div>
            </div>

            <div className="p-2.5 rounded-lg bg-slate-50 dark:bg-slate-800/50 border border-slate-200/60 dark:border-slate-700/60">
              <div className="flex items-center justify-between mb-2">
                <span className="font-medium text-slate-700 dark:text-slate-300">Demand Mode:</span>
                <div className="flex items-center gap-2">
                  <label className="inline-flex items-center gap-1 cursor-pointer">
                    <input
                      type="radio"
                      name="demand_mode"
                      value="derived"
                      checked={parameters.demand_mode === 'derived'}
                      onChange={() => updateField('demand_mode', 'derived')}
                      className="text-indigo-600"
                    />
                    <span>Derived (Poisson)</span>
                  </label>
                  <label className="inline-flex items-center gap-1 cursor-pointer">
                    <input
                      type="radio"
                      name="demand_mode"
                      value="manual"
                      checked={parameters.demand_mode === 'manual'}
                      onChange={() => updateField('demand_mode', 'manual')}
                      className="text-indigo-600"
                    />
                    <span>Manual Override</span>
                  </label>
                </div>
              </div>

              {parameters.demand_mode === 'manual' && (
                <div className="grid grid-cols-2 gap-2 mt-2 pt-2 border-t border-slate-200 dark:border-slate-700">
                  <div>
                    <label className="block text-[11px] text-slate-500 mb-1">Manual Mean (µ_D)</label>
                    <input
                      type="number"
                      step="1"
                      value={parameters.manual_mean_demand ?? ''}
                      onChange={(e) => updateField('manual_mean_demand', e.target.value ? parseFloat(e.target.value) : null)}
                      className="w-full px-2 py-1 rounded border border-slate-200 dark:border-slate-700 dark:bg-slate-800 font-mono text-xs"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] text-slate-500 mb-1">Manual StdDev (σ_D)</label>
                    <input
                      type="number"
                      step="0.5"
                      value={parameters.manual_sd_demand ?? ''}
                      onChange={(e) => updateField('manual_sd_demand', e.target.value ? parseFloat(e.target.value) : null)}
                      className="w-full px-2 py-1 rounded border border-slate-200 dark:border-slate-700 dark:bg-slate-800 font-mono text-xs"
                    />
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Section 4: Replenishment & Reorder (s, Q) */}
        <div className="p-5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl space-y-4 shadow-xs">
          <div className="flex items-center gap-2 pb-2 border-b border-slate-100 dark:border-slate-800 text-slate-800 dark:text-slate-200 font-semibold text-sm">
            <Repeat className="w-4 h-4 text-cyan-500" />
            <span>4. Logistics & (s, Q) Reorder Policy</span>
          </div>

          <div className="grid grid-cols-2 gap-3 text-xs">
            <div>
              <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">Target Service Level</label>
              <input
                type="number"
                min="0.5"
                max="0.999"
                step="0.01"
                value={parameters.target_service_level}
                onChange={(e) => updateField('target_service_level', parseFloat(e.target.value) || 0.95)}
                className="w-full px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 dark:bg-slate-800 font-mono text-xs"
              />
            </div>

            <div>
              <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">Base Lead Time (days)</label>
              <input
                type="number"
                min="0.5"
                step="0.5"
                value={parameters.base_lead_time_days}
                onChange={(e) => updateField('base_lead_time_days', parseFloat(e.target.value) || 2.0)}
                className="w-full px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 dark:bg-slate-800 font-mono text-xs"
              />
            </div>

            <div>
              <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">Transport Speed (km/day)</label>
              <input
                type="number"
                min="50"
                step="50"
                value={parameters.transport_speed_km_per_day}
                onChange={(e) => updateField('transport_speed_km_per_day', parseFloat(e.target.value) || 300.0)}
                className="w-full px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 dark:bg-slate-800 font-mono text-xs"
              />
            </div>

            <div>
              <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">Order Setup Cost K (₹)</label>
              <input
                type="number"
                min="1"
                step="5"
                value={parameters.order_setup_cost}
                onChange={(e) => updateField('order_setup_cost', parseFloat(e.target.value) || 20.0)}
                className="w-full px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 dark:bg-slate-800 font-mono text-xs"
              />
            </div>

            <div>
              <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">Holding Cost h (₹/unit/day)</label>
              <input
                type="number"
                min="0.001"
                step="0.005"
                value={parameters.holding_cost_per_unit_per_day}
                onChange={(e) => updateField('holding_cost_per_unit_per_day', parseFloat(e.target.value) || 0.01)}
                className="w-full px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 dark:bg-slate-800 font-mono text-xs"
              />
            </div>

            <div>
              <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">
                Depot Location ({coordinateMode === 'grid' ? 'X, Y' : 'Lat, Lon'})
              </label>
              <div className="grid grid-cols-2 gap-1">
                {coordinateMode === 'grid' ? (
                  <>
                    <input
                      type="number"
                      placeholder="X"
                      value={parameters.depot_x ?? 0}
                      onChange={(e) => updateField('depot_x', parseFloat(e.target.value) || 0)}
                      className="px-2 py-1.5 rounded border border-slate-200 dark:border-slate-700 dark:bg-slate-800 font-mono text-xs"
                    />
                    <input
                      type="number"
                      placeholder="Y"
                      value={parameters.depot_y ?? 0}
                      onChange={(e) => updateField('depot_y', parseFloat(e.target.value) || 0)}
                      className="px-2 py-1.5 rounded border border-slate-200 dark:border-slate-700 dark:bg-slate-800 font-mono text-xs"
                    />
                  </>
                ) : (
                  <>
                    <input
                      type="number"
                      placeholder="Lat"
                      value={parameters.depot_lat ?? 28.6}
                      onChange={(e) => updateField('depot_lat', parseFloat(e.target.value) || 0)}
                      className="px-2 py-1.5 rounded border border-slate-200 dark:border-slate-700 dark:bg-slate-800 font-mono text-xs"
                    />
                    <input
                      type="number"
                      placeholder="Lon"
                      value={parameters.depot_lon ?? 77.2}
                      onChange={(e) => updateField('depot_lon', parseFloat(e.target.value) || 0)}
                      className="px-2 py-1.5 rounded border border-slate-200 dark:border-slate-700 dark:bg-slate-800 font-mono text-xs"
                    />
                  </>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Section 5: High-Value Asset Reserve (Littlewood) */}
        <div className="p-5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl space-y-4 shadow-xs md:col-span-2">
          <div className="flex items-center gap-2 pb-2 border-b border-slate-100 dark:border-slate-800 text-slate-800 dark:text-slate-200 font-semibold text-sm">
            <Layers className="w-4 h-4 text-amber-500" />
            <span>5. High-Value Asset Protection Reserve (Littlewood's Rule)</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
            <div>
              <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">High-Value Threshold</label>
              <input
                type="number"
                min="1"
                step="5"
                value={parameters.high_value_threshold}
                onChange={(e) => updateField('high_value_threshold', parseFloat(e.target.value) || 75)}
                className="w-full px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 dark:bg-slate-800 font-mono text-xs font-semibold"
              />
              <span className="text-[10px] text-slate-400 mt-0.5 block">Assets with value ≥ this default to High priority</span>
            </div>

            <div>
              <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">r₁ Override (High-Class Value)</label>
              <input
                type="number"
                placeholder="Auto-derived"
                value={parameters.r1_override ?? ''}
                onChange={(e) => updateField('r1_override', e.target.value ? parseFloat(e.target.value) : null)}
                className="w-full px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 dark:bg-slate-800 font-mono text-xs"
              />
              <span className="text-[10px] text-slate-400 mt-0.5 block">Default: λ-weighted mean of high-value assets</span>
            </div>

            <div>
              <label className="block font-medium text-slate-700 dark:text-slate-300 mb-1">r₂ Override (Low-Class Value)</label>
              <input
                type="number"
                placeholder="Auto-derived"
                value={parameters.r2_override ?? ''}
                onChange={(e) => updateField('r2_override', e.target.value ? parseFloat(e.target.value) : null)}
                className="w-full px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 dark:bg-slate-800 font-mono text-xs"
              />
              <span className="text-[10px] text-slate-400 mt-0.5 block">Default: λ-weighted mean of low-value assets</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
