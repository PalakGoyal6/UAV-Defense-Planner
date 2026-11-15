import React, { useState } from 'react';
import { Scenario, SensitivityResponse } from '../types/defense';
import { runSensitivityApi } from '../services/api';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  Legend, ResponsiveContainer, ReferenceLine
} from 'recharts';
import { Play, TrendingUp, Info, AlertCircle, StopCircle, RefreshCw } from 'lucide-react';

interface SensitivityPageProps {
  scenario: Scenario;
}

export const SensitivityPage: React.FC<SensitivityPageProps> = ({ scenario }) => {
  const [param, setParam] = useState<string>('budget');
  const [start, setStart] = useState<number>(20);
  const [end, setEnd] = useState<number>(180);
  const [steps, setSteps] = useState<number>(15);
  const [kneeEpsilon, setKneeEpsilon] = useState<number>(1.0);
  const [is2dEnabled, setIs2dEnabled] = useState<boolean>(false);

  const [loading, setLoading] = useState<boolean>(false);
  const [results, setResults] = useState<SensitivityResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Set default ranges when param changes
  const handleParamChange = (newParam: string) => {
    setParam(newParam);
    if (newParam === 'budget') {
      setStart(20);
      setEnd(180);
    } else if (newParam === 'threat_multiplier') {
      setStart(0.5);
      setEnd(3.0);
    } else if (newParam === 'target_leak_probability') {
      setStart(0.01);
      setEnd(0.20);
    } else if (newParam === 'mean_engagement_time_min') {
      setStart(0.5);
      setEnd(4.0);
    } else if (newParam === 'underage_cost') {
      setStart(10);
      setEnd(150);
    } else if (newParam === 'overage_cost') {
      setStart(1);
      setEnd(25);
    } else if (newParam === 'r2_r1_ratio') {
      setStart(0.1);
      setEnd(1.0);
    }
  };

  const handleRunSweep = async () => {
    setLoading(true);
    setError(null);
    try {
      const payload: any = {
        scenario,
        param,
        start: Number(start),
        end: Number(end),
        steps: Number(steps),
        knee_epsilon_pct: Number(kneeEpsilon)
      };

      if (is2dEnabled && param === 'budget') {
        payload.two_d_param = 'threat_multiplier';
        payload.two_d_start = 0.5;
        payload.two_d_end = 2.5;
        payload.two_d_steps = 5;
      }

      const res = await runSensitivityApi(payload);
      setResults(res);
    } catch (err: any) {
      setError(err.message || 'Sensitivity sweep execution failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Parameter Control Panel */}
      <div className="p-5 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs space-y-4">
        <div>
          <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">
            Multi-Parameter Sensitivity Sweeps & Diminishing Returns Analysis
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Recomputes the entire 5-step defense pipeline across varying operational conditions, detecting the budget efficiency knee point.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-5 gap-3 text-xs">
          <div>
            <label className="block text-slate-500 font-medium mb-1">Parameter to Sweep</label>
            <select
              value={param}
              onChange={(e) => handleParamChange(e.target.value)}
              className="w-full px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 dark:bg-slate-800 font-medium"
            >
              <option value="budget">Defense Budget (B)</option>
              <option value="threat_multiplier">Threat Multiplier (All λᵢ)</option>
              <option value="target_leak_probability">Target Leak Probability (α)</option>
              <option value="mean_engagement_time_min">Mean Engagement Time (1/µ)</option>
              <option value="underage_cost">Underage Cost (Cu)</option>
              <option value="overage_cost">Overage Cost (Co)</option>
              <option value="r2_r1_ratio">Protection Ratio (r₂ / r₁)</option>
            </select>
          </div>

          <div>
            <label className="block text-slate-500 font-medium mb-1">Start Value</label>
            <input
              type="number"
              step="any"
              value={start}
              onChange={(e) => setStart(parseFloat(e.target.value) || 0)}
              className="w-full px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 dark:bg-slate-800 font-mono"
            />
          </div>

          <div>
            <label className="block text-slate-500 font-medium mb-1">End Value</label>
            <input
              type="number"
              step="any"
              value={end}
              onChange={(e) => setEnd(parseFloat(e.target.value) || 0)}
              className="w-full px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 dark:bg-slate-800 font-mono"
            />
          </div>

          <div>
            <label className="block text-slate-500 font-medium mb-1">Resolution (Points)</label>
            <input
              type="number"
              min="5"
              max="40"
              value={steps}
              onChange={(e) => setSteps(parseInt(e.target.value, 10) || 15)}
              className="w-full px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 dark:bg-slate-800 font-mono"
            />
          </div>

          {param === 'budget' && (
            <div>
              <label className="block text-slate-500 font-medium mb-1">Knee Epsilon (% Max Slope)</label>
              <input
                type="number"
                min="0.1"
                max="10"
                step="0.5"
                value={kneeEpsilon}
                onChange={(e) => setKneeEpsilon(parseFloat(e.target.value) || 1.0)}
                className="w-full px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 dark:bg-slate-800 font-mono"
              />
            </div>
          )}
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
          {param === 'budget' && (
            <label className="flex items-center gap-2 text-xs text-slate-600 dark:text-slate-300 cursor-pointer">
              <input
                type="checkbox"
                checked={is2dEnabled}
                onChange={(e) => setIs2dEnabled(e.target.checked)}
                className="rounded border-slate-300 text-indigo-600"
              />
              <span>Generate 2D Sweep Heatmap (Budget &times; Threat Multiplier)</span>
            </label>
          )}

          <button
            onClick={handleRunSweep}
            disabled={loading}
            className="ml-auto flex items-center gap-1.5 px-5 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white rounded-xl text-xs font-semibold shadow-md transition"
          >
            {loading ? (
              <>
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                Executing Parameter Sweep...
              </>
            ) : (
              <>
                <Play className="w-3.5 h-3.5 fill-current" />
                Run Sensitivity Sweep
              </>
            )}
          </button>
        </div>
      </div>

      {error && (
        <div className="p-4 bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-800 rounded-xl text-xs text-rose-700 dark:text-rose-300 flex items-center gap-2">
          <AlertCircle className="w-4 h-4" />
          <span>{error}</span>
        </div>
      )}

      {/* Results View */}
      {results && (
        <div className="space-y-6">
          {/* Knee Point Banner if detected */}
          {results.knee_message && (
            <div className="p-4 bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800/40 rounded-2xl flex items-center gap-3">
              <TrendingUp className="w-5 h-5 text-emerald-600 dark:text-emerald-400 shrink-0" />
              <div>
                <div className="font-bold text-xs text-emerald-900 dark:text-emerald-200 uppercase tracking-wide">
                  Strategic Knee Point Detected
                </div>
                <div className="text-xs text-emerald-800 dark:text-emerald-300 mt-0.5">
                  {results.knee_message}
                </div>
              </div>
            </div>
          )}

          {/* Charts Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Chart 1: Value Protected (% and Abs) */}
            <div className="p-4 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs space-y-2">
              <div className="text-xs font-bold text-slate-800 dark:text-slate-200">
                Asset Value Protected vs {results.param}
              </div>
              <div className="h-64 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={results.points} margin={{ top: 10, right: 20, left: -10, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-slate-100 dark:stroke-slate-800" />
                    <XAxis dataKey="param_value" className="text-[10px]" />
                    <YAxis className="text-[10px]" />
                    <Tooltip formatter={(val: any) => [val, 'Value Protected']} />
                    {results.knee_point != null && (
                      <ReferenceLine
                        x={results.knee_point}
                        stroke="#10b981"
                        strokeDasharray="4 4"
                        label={{ value: `Knee @ ${results.knee_point}`, fill: '#10b981', fontSize: 10, position: 'insideTopLeft' }}
                      />
                    )}
                    <Line type="monotone" dataKey="value_protected" stroke="#6366f1" strokeWidth={2.5} dot={{ r: 2 }} activeDot={{ r: 4 }} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Chart 2: Total Channels Installed */}
            <div className="p-4 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs space-y-2">
              <div className="text-xs font-bold text-slate-800 dark:text-slate-200">
                Total Sized Channels vs {results.param}
              </div>
              <div className="h-64 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={results.points} margin={{ top: 10, right: 20, left: -10, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-slate-100 dark:stroke-slate-800" />
                    <XAxis dataKey="param_value" className="text-[10px]" />
                    <YAxis className="text-[10px]" />
                    <Tooltip formatter={(val: any) => [val, 'Channels']} />
                    <Line type="monotone" dataKey="total_channels" stroke="#10b981" strokeWidth={2.5} dot={{ r: 2 }} activeDot={{ r: 4 }} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Chart 3: Stock Q* & Reserve y1* */}
            <div className="p-4 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs space-y-2">
              <div className="text-xs font-bold text-slate-800 dark:text-slate-200">
                Interceptor Stocking (Q*) & Reserve (y₁*) vs {results.param}
              </div>
              <div className="h-64 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={results.points} margin={{ top: 10, right: 20, left: -10, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-slate-100 dark:stroke-slate-800" />
                    <XAxis dataKey="param_value" className="text-[10px]" />
                    <YAxis className="text-[10px]" />
                    <Tooltip />
                    <Legend wrapperStyle={{ fontSize: '11px' }} />
                    <Line type="monotone" dataKey="total_stock_Q_star" name="Stock Q*" stroke="#a855f7" strokeWidth={2.5} dot={{ r: 2 }} />
                    <Line type="monotone" dataKey="reserve_y1_star" name="Reserve y₁*" stroke="#f59e0b" strokeWidth={2} strokeDasharray="4 2" dot={{ r: 2 }} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Chart 4: Capital Cost vs Budget */}
            <div className="p-4 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs space-y-2">
              <div className="text-xs font-bold text-slate-800 dark:text-slate-200">
                Deployment Capital Cost vs {results.param}
              </div>
              <div className="h-64 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={results.points} margin={{ top: 10, right: 20, left: -10, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-slate-100 dark:stroke-slate-800" />
                    <XAxis dataKey="param_value" className="text-[10px]" />
                    <YAxis className="text-[10px]" />
                    <Tooltip formatter={(val: any) => [`₹${val}`, 'Cost']} />
                    <Line type="monotone" dataKey="total_cost" stroke="#0ea5e9" strokeWidth={2.5} dot={{ r: 2 }} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          {/* 2D Heatmap Table */}
          {results.heatmap && results.heatmap.length > 0 && (
            <div className="p-4 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs space-y-3">
              <div className="text-xs font-bold text-slate-800 dark:text-slate-200">
                2D Sweep Matrix: % Asset Value Protected
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-center text-xs">
                  <thead className="bg-slate-50 dark:bg-slate-800/60">
                    <tr>
                      <th className="py-2 px-3 text-left">Budget \ Threat Multiplier</th>
                      {Array.from(new Set(results.heatmap.map((h: any) => h.threat_multiplier))).map((tm: any) => (
                        <th key={tm} className="py-2 px-3 font-mono">{tm}x</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {Array.from(new Set(results.heatmap.map((h: any) => h.budget))).map((b: any) => (
                      <tr key={b}>
                        <td className="py-2 px-3 text-left font-mono font-bold text-indigo-600">₹{b}</td>
                        {Array.from(new Set(results.heatmap!.map((h: any) => h.threat_multiplier))).map((tm: any) => {
                          const cell = results.heatmap!.find((h: any) => h.budget === b && h.threat_multiplier === tm);
                          const pct = cell ? cell.pct_value_protected : 0;
                          const bg = pct >= 90 ? 'bg-emerald-100 text-emerald-800' : pct >= 60 ? 'bg-amber-100 text-amber-800' : 'bg-rose-100 text-rose-800';

                          return (
                            <td key={tm} className="py-2 px-3 font-mono">
                              <span className={`px-2 py-0.5 rounded-md font-bold text-[11px] ${bg}`}>
                                {pct}%
                              </span>
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
