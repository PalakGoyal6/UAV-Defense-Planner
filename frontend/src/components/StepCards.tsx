import React, { useState } from 'react';
import { FullPlanResponse, WorkingStep } from '../types/defense';
import { ChevronDown, ChevronUp, FileCode, CheckCircle, AlertCircle, Info } from 'lucide-react';

interface StepCardsProps {
  plan: FullPlanResponse;
}

export const StepCards: React.FC<StepCardsProps> = ({ plan }) => {
  const [expandedSteps, setExpandedSteps] = useState<Record<number, boolean>>({
    1: true,
    2: false,
    3: false,
    4: false,
    5: false
  });

  const [showWorking, setShowWorking] = useState<Record<number, boolean>>({
    1: false,
    2: false,
    3: false,
    4: false,
    5: false
  });

  const toggleExpand = (stepNum: number) => {
    setExpandedSteps(prev => ({ ...prev, [stepNum]: !prev[stepNum] }));
  };

  const toggleWorking = (stepNum: number, e: React.MouseEvent) => {
    e.stopPropagation();
    setShowWorking(prev => ({ ...prev, [stepNum]: !prev[stepNum] }));
  };

  const getWorkingForStep = (stepNum: number): WorkingStep | undefined => {
    return plan.working.find(w => w.step_number === stepNum);
  };

  const loc = plan.location;
  const load = plan.load;
  const chan = plan.channels;
  const inv = plan.inventory;
  const res = plan.reserve;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100">
          5-Stage Operations Research Execution Breakdown
        </h3>
        <span className="text-xs text-slate-400">
          Click any card to expand details & intermediate math
        </span>
      </div>

      {/* Step 1 Card: Place Units (MCLP) */}
      <div className="border border-slate-200 dark:border-slate-800 rounded-2xl bg-white dark:bg-slate-900 overflow-hidden shadow-xs">
        <div
          onClick={() => toggleExpand(1)}
          className="p-4 flex items-center justify-between cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-850 transition"
        >
          <div className="flex items-center gap-3">
            <span className="w-7 h-7 rounded-lg bg-indigo-100 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300 font-bold flex items-center justify-center text-xs">
              1
            </span>
            <div>
              <div className="text-sm font-bold text-slate-800 dark:text-slate-200">
                Step 1: Place Units (Maximal Covering Location Problem)
              </div>
              <div className="text-xs text-slate-500 dark:text-slate-400">
                Opened {loc.opened_sites.length} sites &bull; Protected ₹{loc.total_value_protected.toLocaleString()} ({loc.pct_value_protected}%) &bull; Cost: ₹{loc.total_site_cost.toLocaleString()} / ₹{loc.budget.toLocaleString()}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={(e) => toggleWorking(1, e)}
              className={`flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-mono font-medium border transition ${
                showWorking[1]
                  ? 'bg-indigo-50 border-indigo-300 text-indigo-700 dark:bg-indigo-950 dark:border-indigo-700 dark:text-indigo-300'
                  : 'border-slate-200 dark:border-slate-700 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800'
              }`}
            >
              <FileCode className="w-3.5 h-3.5" /> Show Working
            </button>
            {expandedSteps[1] ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
          </div>
        </div>

        {expandedSteps[1] && (
          <div className="p-4 border-t border-slate-100 dark:border-slate-800 space-y-3 text-xs">
            {showWorking[1] && getWorkingForStep(1) && (
              <div className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl font-mono text-[11px] text-slate-700 dark:text-slate-300 space-y-1 border border-slate-200 dark:border-slate-700">
                <div className="font-bold text-indigo-600 dark:text-indigo-400 mb-1">--- SHOW WORKING: MCLP FORMULATION ---</div>
                {getWorkingForStep(1)?.details.map((d, i) => (
                  <div key={i}>&bull; {d}</div>
                ))}
              </div>
            )}

            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead className="bg-slate-50 dark:bg-slate-800/40 text-slate-600 dark:text-slate-400">
                  <tr>
                    <th className="py-2 px-3">Asset ID</th>
                    <th className="py-2 px-3">Name</th>
                    <th className="py-2 px-3">Assigned Site</th>
                    <th className="py-2 px-3">Distance</th>
                    <th className="py-2 px-3">Value (wᵢ)</th>
                    <th className="py-2 px-3">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {loc.assignments.map(a => (
                    <tr key={a.asset_id}>
                      <td className="py-1.5 px-3 font-mono font-bold">{a.asset_id}</td>
                      <td className="py-1.5 px-3">{a.asset_name}</td>
                      <td className="py-1.5 px-3 font-mono">
                        {a.site_id ? (
                          <span className="font-semibold text-indigo-600 dark:text-indigo-400">{a.site_id} ({a.site_name})</span>
                        ) : (
                          <span className="text-slate-400">None</span>
                        )}
                      </td>
                      <td className="py-1.5 px-3 font-mono">{a.distance_km != null ? `${a.distance_km.toFixed(1)} km` : '-'}</td>
                      <td className="py-1.5 px-3 font-mono font-bold">{a.value}</td>
                      <td className="py-1.5 px-3">
                        {a.covered ? (
                          <span className="inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-400 font-semibold">
                            <CheckCircle className="w-3.5 h-3.5" /> Covered
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-rose-600 dark:text-rose-400 font-semibold">
                            <AlertCircle className="w-3.5 h-3.5" /> Uncovered
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* Step 2 Card: Threat Load per Site */}
      <div className="border border-slate-200 dark:border-slate-800 rounded-2xl bg-white dark:bg-slate-900 overflow-hidden shadow-xs">
        <div
          onClick={() => toggleExpand(2)}
          className="p-4 flex items-center justify-between cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-850 transition"
        >
          <div className="flex items-center gap-3">
            <span className="w-7 h-7 rounded-lg bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300 font-bold flex items-center justify-center text-xs">
              2
            </span>
            <div>
              <div className="text-sm font-bold text-slate-800 dark:text-slate-200">
                Step 2: Threat Load Aggregation (Λⱼ & Offered Load aⱼ)
              </div>
              <div className="text-xs text-slate-500 dark:text-slate-400">
                Total system threat rate: {load.total_system_load.toFixed(3)} threats/min across {loc.opened_sites.length} sites
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={(e) => toggleWorking(2, e)}
              className={`flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-mono font-medium border transition ${
                showWorking[2]
                  ? 'bg-emerald-50 border-emerald-300 text-emerald-700 dark:bg-emerald-950 dark:border-emerald-700 dark:text-emerald-300'
                  : 'border-slate-200 dark:border-slate-700 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800'
              }`}
            >
              <FileCode className="w-3.5 h-3.5" /> Show Working
            </button>
            {expandedSteps[2] ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
          </div>
        </div>

        {expandedSteps[2] && (
          <div className="p-4 border-t border-slate-100 dark:border-slate-800 space-y-3 text-xs">
            {showWorking[2] && getWorkingForStep(2) && (
              <div className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl font-mono text-[11px] text-slate-700 dark:text-slate-300 space-y-1 border border-slate-200 dark:border-slate-700">
                <div className="font-bold text-emerald-600 dark:text-emerald-400 mb-1">--- SHOW WORKING: THREAT LOAD DERIVATION ---</div>
                {getWorkingForStep(2)?.details.map((d, i) => (
                  <div key={i}>&bull; {d}</div>
                ))}
              </div>
            )}

            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead className="bg-slate-50 dark:bg-slate-800/40 text-slate-600 dark:text-slate-400">
                  <tr>
                    <th className="py-2 px-3">Site ID</th>
                    <th className="py-2 px-3">Threat Rate Λⱼ (threats/min)</th>
                    <th className="py-2 px-3">Offered Load aⱼ (Erlangs)</th>
                    <th className="py-2 px-3">Formula Plug-in</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {Object.entries(load.site_loads).map(([sId, lam]) => {
                    const erl = load.offered_loads[sId] ?? 0;
                    return (
                      <tr key={sId}>
                        <td className="py-1.5 px-3 font-mono font-bold text-indigo-600 dark:text-indigo-400">{sId}</td>
                        <td className="py-1.5 px-3 font-mono">{lam.toFixed(4)}</td>
                        <td className="py-1.5 px-3 font-mono font-bold text-emerald-600 dark:text-emerald-400">{erl.toFixed(4)} Erl</td>
                        <td className="py-1.5 px-3 text-slate-500 font-mono text-[11px]">
                          a_{sId} = {lam.toFixed(4)} * 1.50 = {erl.toFixed(4)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* Step 3 Card: Engagement Channels (Erlang-B) */}
      <div className="border border-slate-200 dark:border-slate-800 rounded-2xl bg-white dark:bg-slate-900 overflow-hidden shadow-xs">
        <div
          onClick={() => toggleExpand(3)}
          className="p-4 flex items-center justify-between cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-850 transition"
        >
          <div className="flex items-center gap-3">
            <span className="w-7 h-7 rounded-lg bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300 font-bold flex items-center justify-center text-xs">
              3
            </span>
            <div>
              <div className="text-sm font-bold text-slate-800 dark:text-slate-200">
                Step 3: Size Engagement Channels (Erlang-B Loss Model)
              </div>
              <div className="text-xs text-slate-500 dark:text-slate-400">
                Allocated {chan.total_channels} channels &bull; Worst leak prob: {chan.worst_site_leak_prob.toFixed(4)} &bull; All targets met: {chan.all_targets_met ? 'Yes' : 'No'}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={(e) => toggleWorking(3, e)}
              className={`flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-mono font-medium border transition ${
                showWorking[3]
                  ? 'bg-blue-50 border-blue-300 text-blue-700 dark:bg-blue-950 dark:border-blue-700 dark:text-blue-300'
                  : 'border-slate-200 dark:border-slate-700 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800'
              }`}
            >
              <FileCode className="w-3.5 h-3.5" /> Show Working
            </button>
            {expandedSteps[3] ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
          </div>
        </div>

        {expandedSteps[3] && (
          <div className="p-4 border-t border-slate-100 dark:border-slate-800 space-y-3 text-xs">
            {showWorking[3] && getWorkingForStep(3) && (
              <div className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl font-mono text-[11px] text-slate-700 dark:text-slate-300 space-y-1 border border-slate-200 dark:border-slate-700">
                <div className="font-bold text-blue-600 dark:text-blue-400 mb-1">--- SHOW WORKING: ERLANG-B RECURSION ---</div>
                {getWorkingForStep(3)?.details.map((d, i) => (
                  <div key={i}>&bull; {d}</div>
                ))}
              </div>
            )}

            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead className="bg-slate-50 dark:bg-slate-800/40 text-slate-600 dark:text-slate-400">
                  <tr>
                    <th className="py-2 px-3">Site ID</th>
                    <th className="py-2 px-3">Offered Load (a)</th>
                    <th className="py-2 px-3">Allocated Channels (c)</th>
                    <th className="py-2 px-3">Leak Prob B(c, a)</th>
                    <th className="py-2 px-3">Target Met (≤ α)</th>
                    <th className="py-2 px-3">Expected Leaks/min</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {Object.entries(chan.site_channels).map(([sId, ch]) => (
                    <tr key={sId}>
                      <td className="py-1.5 px-3 font-mono font-bold text-indigo-600 dark:text-indigo-400">{sId}</td>
                      <td className="py-1.5 px-3 font-mono">{ch.offered_load_erlangs.toFixed(4)} Erl</td>
                      <td className="py-1.5 px-3 font-mono font-bold text-blue-600 dark:text-blue-400">{ch.channels_allocated}</td>
                      <td className="py-1.5 px-3 font-mono">{ch.leak_probability.toFixed(4)}</td>
                      <td className="py-1.5 px-3">
                        {ch.target_met ? (
                          <span className="text-emerald-600 font-semibold flex items-center gap-1">
                            <CheckCircle className="w-3.5 h-3.5" /> Met
                          </span>
                        ) : (
                          <span className="text-rose-600 font-semibold flex items-center gap-1">
                            <AlertCircle className="w-3.5 h-3.5" /> Unachievable
                          </span>
                        )}
                      </td>
                      <td className="py-1.5 px-3 font-mono">{ch.expected_leaks_per_min.toFixed(4)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* Step 4 Card: Stock & Reorder Rule (Newsvendor + s, Q) */}
      <div className="border border-slate-200 dark:border-slate-800 rounded-2xl bg-white dark:bg-slate-900 overflow-hidden shadow-xs">
        <div
          onClick={() => toggleExpand(4)}
          className="p-4 flex items-center justify-between cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-850 transition"
        >
          <div className="flex items-center gap-3">
            <span className="w-7 h-7 rounded-lg bg-purple-100 text-purple-700 dark:bg-purple-950 dark:text-purple-300 font-bold flex items-center justify-center text-xs">
              4
            </span>
            <div>
              <div className="text-sm font-bold text-slate-800 dark:text-slate-200">
                Step 4: Stock Up & Reorder Policy (Newsvendor + (s, Q))
              </div>
              <div className="text-xs text-slate-500 dark:text-slate-400">
                Target Stock Q* = {inv.total_stock_Q_star} interceptors (CR = {inv.critical_ratio.toFixed(4)}) &bull; Proportional Largest-Remainder Split
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={(e) => toggleWorking(4, e)}
              className={`flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-mono font-medium border transition ${
                showWorking[4]
                  ? 'bg-purple-50 border-purple-300 text-purple-700 dark:bg-purple-950 dark:border-purple-700 dark:text-purple-300'
                  : 'border-slate-200 dark:border-slate-700 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800'
              }`}
            >
              <FileCode className="w-3.5 h-3.5" /> Show Working
            </button>
            {expandedSteps[4] ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
          </div>
        </div>

        {expandedSteps[4] && (
          <div className="p-4 border-t border-slate-100 dark:border-slate-800 space-y-3 text-xs">
            {showWorking[4] && getWorkingForStep(4) && (
              <div className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl font-mono text-[11px] text-slate-700 dark:text-slate-300 space-y-1 border border-slate-200 dark:border-slate-700">
                <div className="font-bold text-purple-600 dark:text-purple-400 mb-1">--- SHOW WORKING: NEWSVENDOR & REORDER POINT ---</div>
                {getWorkingForStep(4)?.details.map((d, i) => (
                  <div key={i}>&bull; {d}</div>
                ))}
              </div>
            )}

            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead className="bg-slate-50 dark:bg-slate-800/40 text-slate-600 dark:text-slate-400">
                  <tr>
                    <th className="py-2 px-3">Site ID</th>
                    <th className="py-2 px-3">Stock Allocation (Q*ⱼ)</th>
                    <th className="py-2 px-3">Depot Dist</th>
                    <th className="py-2 px-3">Lead Time (days)</th>
                    <th className="py-2 px-3">Reorder Point (sⱼ)</th>
                    <th className="py-2 px-3">Suggested EOQ</th>
                    <th className="py-2 px-3">Plain-English Rule</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {Object.entries(inv.site_inventory).map(([sId, item]) => (
                    <tr key={sId}>
                      <td className="py-1.5 px-3 font-mono font-bold text-indigo-600 dark:text-indigo-400">{sId}</td>
                      <td className="py-1.5 px-3 font-mono font-bold text-purple-600 dark:text-purple-400">
                        {item.allocated_stock_Q} <span className="text-[10px] text-slate-400 font-normal">({(item.lambda_share * 100).toFixed(1)}%)</span>
                      </td>
                      <td className="py-1.5 px-3 font-mono">{item.depot_distance_km.toFixed(1)} km</td>
                      <td className="py-1.5 px-3 font-mono">{item.lead_time_days.toFixed(2)}</td>
                      <td className="py-1.5 px-3 font-mono font-bold text-emerald-600">{item.reorder_point_s}</td>
                      <td className="py-1.5 px-3 font-mono font-bold">{item.suggested_order_qty_EOQ}</td>
                      <td className="py-1.5 px-3 font-medium text-slate-700 dark:text-slate-300 text-[11px] italic">
                        "{item.plain_english_rule}"
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* Step 5 Card: Littlewood's High-Value Reserve */}
      <div className="border border-slate-200 dark:border-slate-800 rounded-2xl bg-white dark:bg-slate-900 overflow-hidden shadow-xs">
        <div
          onClick={() => toggleExpand(5)}
          className="p-4 flex items-center justify-between cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-850 transition"
        >
          <div className="flex items-center gap-3">
            <span className="w-7 h-7 rounded-lg bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300 font-bold flex items-center justify-center text-xs">
              5
            </span>
            <div>
              <div className="text-sm font-bold text-slate-800 dark:text-slate-200">
                Step 5: Hold a Reserve (Littlewood's Rule)
              </div>
              <div className="text-xs text-slate-500 dark:text-slate-400">
                Reserve y₁* = {res.reserve_y1_star} interceptors strictly for high-value assets &bull; Low-value booking limit = {res.booking_limit_low_value}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={(e) => toggleWorking(5, e)}
              className={`flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-mono font-medium border transition ${
                showWorking[5]
                  ? 'bg-amber-50 border-amber-300 text-amber-700 dark:bg-amber-950 dark:border-amber-700 dark:text-amber-300'
                  : 'border-slate-200 dark:border-slate-700 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800'
              }`}
            >
              <FileCode className="w-3.5 h-3.5" /> Show Working
            </button>
            {expandedSteps[5] ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
          </div>
        </div>

        {expandedSteps[5] && (
          <div className="p-4 border-t border-slate-100 dark:border-slate-800 space-y-3 text-xs">
            {showWorking[5] && getWorkingForStep(5) && (
              <div className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl font-mono text-[11px] text-slate-700 dark:text-slate-300 space-y-1 border border-slate-200 dark:border-slate-700">
                <div className="font-bold text-amber-600 dark:text-amber-400 mb-1">--- SHOW WORKING: LITTLEWOOD PROTECTION LEVEL ---</div>
                {getWorkingForStep(5)?.details.map((d, i) => (
                  <div key={i}>&bull; {d}</div>
                ))}
              </div>
            )}

            <div className="p-3 bg-amber-50/60 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800/40 rounded-xl">
              <div className="font-semibold text-amber-900 dark:text-amber-200 mb-1">
                Executive Engagement Directive:
              </div>
              <p className="text-amber-800 dark:text-amber-300 text-xs italic">
                "{res.plain_english_rule}"
              </p>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs pt-2">
              <div className="p-2.5 rounded-lg border border-slate-200 dark:border-slate-700">
                <div className="text-slate-400 text-[10px]">High Class Value (r₁)</div>
                <div className="font-mono font-bold text-sm">₹{res.r1.toFixed(2)}</div>
              </div>
              <div className="p-2.5 rounded-lg border border-slate-200 dark:border-slate-700">
                <div className="text-slate-400 text-[10px]">Low Class Value (r₂)</div>
                <div className="font-mono font-bold text-sm">₹{res.r2.toFixed(2)}</div>
              </div>
              <div className="p-2.5 rounded-lg border border-slate-200 dark:border-slate-700">
                <div className="text-slate-400 text-[10px]">Protection Ratio (r₂/r₁)</div>
                <div className="font-mono font-bold text-sm">{res.ratio_r2_r1.toFixed(4)}</div>
              </div>
              <div className="p-2.5 rounded-lg border border-slate-200 dark:border-slate-700">
                <div className="text-slate-400 text-[10px]">High Demand (µ₁, σ₁)</div>
                <div className="font-mono font-bold text-sm">{res.mu_1.toFixed(1)}, {res.sigma_1.toFixed(1)}</div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
