import React, { useState, useEffect } from 'react';
import { Scenario, FullPlanResponse, CoordinateMode } from '../types/defense';
import { solveMultiRegion, generateSyntheticApi } from '../services/api';
import { PlanSummaryCards } from '../components/PlanSummaryCards';
import { DeploymentMapView } from '../components/DeploymentMapView';
import { Sparkles, MapPin, Layers, Clock, Cpu, CheckCircle, RefreshCw, AlertCircle, Check } from 'lucide-react';
import { getLoadedIndiaGeoJson } from '../utils/geo';

interface ScalingPageProps {
  scenario: Scenario;
  onApplyGeneratedScenario: (scenario: Scenario) => void;
}

export const ScalingPage: React.FC<ScalingPageProps> = ({
  scenario,
  onApplyGeneratedScenario
}) => {
  // Multi-Region State
  const [regionalBudgets, setRegionalBudgets] = useState<Record<string, number>>({});
  const [solvingRegions, setSolvingRegions] = useState<boolean>(false);
  const [multiRegionPlan, setMultiRegionPlan] = useState<FullPlanResponse | null>(null);
  const [regionError, setRegionError] = useState<string | null>(null);

  // Available States
  const [availableStates, setAvailableStates] = useState<string[]>([]);
  const [selectedStates, setSelectedStates] = useState<string[]>(['Punjab', 'Rajasthan']);
  const [spreadAllStates, setSpreadAllStates] = useState<boolean>(false);

  useEffect(() => {
    getLoadedIndiaGeoJson()
      .then((gj) => {
        if (gj && gj.features) {
          const names: string[] = gj.features
            .map((f: any) => f.properties?.state_name)
            .filter(Boolean)
            .sort((a: string, b: string) => a.localeCompare(b));
          setAvailableStates(names);
        }
      })
      .catch(() => {});
  }, []);

  // Synthetic Generator State
  const [numAssets, setNumAssets] = useState<number>(20);
  const [numSites, setNumSites] = useState<number>(25);
  const [coordMode, setCoordMode] = useState<CoordinateMode>(scenario.coordinate_mode || 'geo');
  const [valueMin, setValueMin] = useState<number>(20);
  const [valueMax, setValueMax] = useState<number>(120);
  const [threatMin, setThreatMin] = useState<number>(0.1);
  const [threatMax, setThreatMax] = useState<number>(0.6);
  const [costMin, setCostMin] = useState<number>(15);
  const [costMax, setCostMax] = useState<number>(50);
  const [rangeMin, setRangeMin] = useState<number>(3);
  const [rangeMax, setRangeMax] = useState<number>(7);
  const [customBudget, setCustomBudget] = useState<number | ''>('');
  const [generating, setGenerating] = useState<boolean>(false);

  // Extract distinct regions in scenario
  const distinctRegions = Array.from(new Set(scenario.assets.map(a => a.region || 'DefaultRegion')));

  const handleSolveMultiRegion = async () => {
    setSolvingRegions(true);
    setRegionError(null);
    try {
      const res = await solveMultiRegion(scenario, regionalBudgets);
      setMultiRegionPlan(res);
    } catch (err: any) {
      setRegionError(err.message || 'Multi-region solving failed');
    } finally {
      setSolvingRegions(false);
    }
  };

  const handleGenerateSynthetic = async () => {
    setGenerating(true);
    try {
      const req: any = {
        num_assets: Number(numAssets),
        num_sites: Number(numSites),
        coordinate_mode: coordMode,
        selected_states: coordMode === 'geo' && !spreadAllStates ? selectedStates : undefined,
        spread_all_states: coordMode === 'geo' ? spreadAllStates : false,
        value_min: Number(valueMin),
        value_max: Number(valueMax),
        threat_min: Number(threatMin),
        threat_max: Number(threatMax),
        cost_min: Number(costMin),
        cost_max: Number(costMax),
        range_min: Number(rangeMin),
        range_max: Number(rangeMax),
        budget: customBudget ? Number(customBudget) : undefined
      };
      const newScenario = await generateSyntheticApi(req);
      onApplyGeneratedScenario(newScenario);
    } catch (err: any) {
      alert(`Synthetic generation failed: ${err.message}`);
    } finally {
      setGenerating(false);
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Scaling Header Banner */}
      <div className="p-5 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs space-y-2">
        <div className="flex items-center gap-2 text-indigo-600 dark:text-indigo-400 font-bold text-sm">
          <Layers className="w-4 h-4" />
          <span>Regional Decomposition & Synthetic Scaling Engine</span>
        </div>
        <p className="text-xs text-slate-500 dark:text-slate-400">
          Scale from single-base grids (~5 assets) up to regional sectors (~50 assets) and multi-region theaters (hundreds of assets) with automated coverage pruning and budget partitioning.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Panel 1: Multi-Region Theater Solver */}
        <div className="p-5 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs space-y-4">
          <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-800">
            <div className="flex items-center gap-2 font-bold text-sm text-slate-900 dark:text-slate-100">
              <MapPin className="w-4 h-4 text-emerald-500" />
              <span>Multi-Region Theater Decomposition</span>
            </div>
            <span className="text-xs px-2.5 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-mono">
              {distinctRegions.length} Detected Region(s)
            </span>
          </div>

          <p className="text-xs text-slate-500 dark:text-slate-400">
            Decomposes the global scenario into independent regional sub-problems, optimizes each region within its allocated budget, and merges the resulting deployment.
          </p>

          <div className="space-y-3 text-xs">
            <div className="font-semibold text-slate-700 dark:text-slate-300">
              Regional Budget Allocation:
            </div>
            <div className="space-y-2 max-h-48 overflow-y-auto">
              {distinctRegions.map(reg => {
                const regAssets = scenario.assets.filter(a => (a.region || 'DefaultRegion') === reg);
                const regSites = scenario.sites.filter(s => (s.region || 'DefaultRegion') === reg);
                const regVal = regAssets.reduce((sum, a) => sum + a.value, 0);

                return (
                  <div key={reg} className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl flex items-center justify-between gap-3">
                    <div>
                      <div className="font-bold text-slate-800 dark:text-slate-200">{reg}</div>
                      <div className="text-[10px] text-slate-400">
                        {regAssets.length} assets (Val: {regVal}) &bull; {regSites.length} sites
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className="text-slate-400">₹</span>
                      <input
                        type="number"
                        placeholder="Auto"
                        value={regionalBudgets[reg] ?? ''}
                        onChange={(e) => setRegionalBudgets({
                          ...regionalBudgets,
                          [reg]: e.target.value ? parseFloat(e.target.value) : undefined as any
                        })}
                        className="w-24 px-2 py-1 rounded border border-slate-200 dark:border-slate-700 dark:bg-slate-800 font-mono text-xs"
                      />
                    </div>
                  </div>
                );
              })}
            </div>

            <button
              onClick={handleSolveMultiRegion}
              disabled={solvingRegions}
              className="w-full py-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white rounded-xl text-xs font-semibold shadow-md transition flex items-center justify-center gap-1.5"
            >
              {solvingRegions ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  Solving Independent Regions...
                </>
              ) : (
                <>
                  <CheckCircle className="w-3.5 h-3.5" />
                  Solve Multi-Region Scenario
                </>
              )}
            </button>
          </div>

          {regionError && (
            <div className="p-3 bg-rose-50 text-rose-700 rounded-lg text-xs flex items-center gap-1.5">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{regionError}</span>
            </div>
          )}
        </div>

        {/* Panel 2: Synthetic Data Generator */}
        <div className="p-5 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs space-y-4">
          <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-800">
            <div className="flex items-center gap-2 font-bold text-sm text-slate-900 dark:text-slate-100">
              <Sparkles className="w-4 h-4 text-purple-500" />
              <span>Synthetic Benchmark Generator</span>
            </div>
            <span className="text-[10px] text-amber-600 dark:text-amber-400 font-medium">
              Non-sensitive placeholder data
            </span>
          </div>

          <p className="text-xs text-slate-500 dark:text-slate-400">
            Instantly generates random or regional benchmark instances for performance stress-testing. Never uses real military positions.
          </p>

          <div className="space-y-3 text-xs">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-slate-500 font-medium mb-1">Coordinate System</label>
                <select
                  value={coordMode}
                  onChange={(e) => setCoordMode(e.target.value as CoordinateMode)}
                  className="w-full px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 dark:bg-slate-800"
                >
                  <option value="geo">Geographic (Real India States)</option>
                  <option value="grid">Grid (km plane)</option>
                </select>
              </div>

              {coordMode === 'geo' && (
                <div className="flex flex-col justify-end">
                  <label className="flex items-center gap-2 cursor-pointer pb-2 font-medium text-slate-700 dark:text-slate-300">
                    <input
                      type="checkbox"
                      checked={spreadAllStates}
                      onChange={(e) => setSpreadAllStates(e.target.checked)}
                      className="rounded text-indigo-600 w-4 h-4"
                    />
                    <span>Spread across all 36 States/UTs</span>
                  </label>
                </div>
              )}
            </div>

            {coordMode === 'geo' && !spreadAllStates && (
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-slate-500 font-medium">Select Target Indian States:</label>
                  <span className="text-[11px] text-indigo-600 font-mono">
                    {selectedStates.length} selected
                  </span>
                </div>
                <div className="max-h-28 overflow-y-auto border border-slate-200 dark:border-slate-700 rounded-lg p-2 bg-slate-50/50 dark:bg-slate-800/50 flex flex-wrap gap-1.5">
                  {availableStates.map((st) => {
                    const isSelected = selectedStates.includes(st);
                    return (
                      <button
                        key={st}
                        type="button"
                        onClick={() => {
                          if (isSelected) {
                            if (selectedStates.length > 1) {
                              setSelectedStates(selectedStates.filter((s) => s !== st));
                            }
                          } else {
                            setSelectedStates([...selectedStates, st]);
                          }
                        }}
                        className={`px-2 py-0.5 rounded-md text-[11px] font-medium transition ${
                          isSelected
                            ? 'bg-indigo-600 text-white shadow-xs'
                            : 'bg-white dark:bg-slate-700 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-600 hover:border-indigo-400'
                        }`}
                      >
                        {st}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-slate-500 font-medium mb-1">Number of Assets</label>
                <input
                  type="number"
                  min="2"
                  max="200"
                  value={numAssets}
                  onChange={(e) => setNumAssets(parseInt(e.target.value, 10) || 10)}
                  className="w-full px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 dark:bg-slate-800 font-mono"
                />
              </div>

              <div>
                <label className="block text-slate-500 font-medium mb-1">Number of Candidate Sites</label>
                <input
                  type="number"
                  min="2"
                  max="200"
                  value={numSites}
                  onChange={(e) => setNumSites(parseInt(e.target.value, 10) || 12)}
                  className="w-full px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 dark:bg-slate-800 font-mono"
                />
              </div>
            </div>

            <div>
              <label className="block text-slate-500 font-medium mb-1">Value Range (wᵢ)</label>
              <div className="flex items-center gap-1">
                <input
                  type="number"
                  value={valueMin}
                  onChange={(e) => setValueMin(parseFloat(e.target.value) || 10)}
                  className="w-full px-2 py-1 rounded border border-slate-200 dark:border-slate-700 dark:bg-slate-800 font-mono text-xs"
                />
                <span>-</span>
                <input
                  type="number"
                  value={valueMax}
                  onChange={(e) => setValueMax(parseFloat(e.target.value) || 100)}
                  className="w-full px-2 py-1 rounded border border-slate-200 dark:border-slate-700 dark:bg-slate-800 font-mono text-xs"
                />
              </div>
            </div>

            <div>
              <label className="block text-slate-500 font-medium mb-1">Threat Range (λ/min)</label>
              <div className="flex items-center gap-1">
                <input
                  type="number"
                  step="0.05"
                  value={threatMin}
                  onChange={(e) => setThreatMin(parseFloat(e.target.value) || 0.1)}
                  className="w-full px-2 py-1 rounded border border-slate-200 dark:border-slate-700 dark:bg-slate-800 font-mono text-xs"
                />
                <span>-</span>
                <input
                  type="number"
                  step="0.05"
                  value={threatMax}
                  onChange={(e) => setThreatMax(parseFloat(e.target.value) || 0.5)}
                  className="w-full px-2 py-1 rounded border border-slate-200 dark:border-slate-700 dark:bg-slate-800 font-mono text-xs"
                />
              </div>
            </div>
          </div>

          <button
            onClick={handleGenerateSynthetic}
            disabled={generating}
            className="w-full py-2 bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white rounded-xl text-xs font-semibold shadow-md transition flex items-center justify-center gap-1.5"
          >
            {generating ? (
              <>
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                Generating Synthetic Defense Grid...
              </>
            ) : (
              <>
                <Sparkles className="w-3.5 h-3.5" />
                Generate & Replace Current Scenario
              </>
            )}
          </button>
        </div>
      </div>

      {/* Merged Multi-Region Plan Result */}
      {multiRegionPlan && (
        <div className="space-y-4 pt-4 border-t border-slate-200 dark:border-slate-800">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">
              Merged Multi-Region Solution Plan
            </h3>
            <div className="flex items-center gap-3 text-xs text-slate-500">
              <span className="flex items-center gap-1">
                <Clock className="w-3.5 h-3.5" /> {multiRegionPlan.meta.pipeline_total_time_ms}ms total solve time
              </span>
              <span className="flex items-center gap-1">
                <Cpu className="w-3.5 h-3.5" /> {multiRegionPlan.location.n_vars} vars &bull; {multiRegionPlan.location.n_constraints} constraints
              </span>
            </div>
          </div>

          <PlanSummaryCards plan={multiRegionPlan} />
          <DeploymentMapView scenario={scenario} plan={multiRegionPlan} />
        </div>
      )}
    </div>
  );
};
