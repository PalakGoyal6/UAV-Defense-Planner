import React from 'react';
import { Scenario } from '../types/defense';
import { Check, X, RotateCcw, AlertTriangle } from 'lucide-react';

interface CoverageMatrixViewProps {
  scenario: Scenario;
  coverageData: Record<string, Record<string, number>>;
  distanceData: Record<string, Record<string, number>>;
  onToggleOverride: (assetId: string, siteId: string) => void;
  onClearOverrides: () => void;
}

export const CoverageMatrixView: React.FC<CoverageMatrixViewProps> = ({
  scenario,
  coverageData,
  distanceData,
  onToggleOverride,
  onClearOverrides
}) => {
  const overrides = scenario.coverage_overrides || {};
  const overrideCount = Object.keys(overrides).length;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100">
            Interactive Coverage Matrix (aᵢⱼ)
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Auto-computed where distance(i, j) ≤ range_km. Click any cell to manually toggle coverage (e.g. terrain/LOS block).
          </p>
        </div>

        {overrideCount > 0 && (
          <div className="flex items-center gap-2">
            <span className="text-xs px-2.5 py-1 rounded-full bg-amber-100 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300 font-medium flex items-center gap-1">
              <AlertTriangle className="w-3.5 h-3.5" />
              {overrideCount} manual override(s) active
            </span>
            <button
              onClick={onClearOverrides}
              className="flex items-center gap-1 px-3 py-1 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs text-slate-600 dark:text-slate-300 hover:bg-slate-50 transition"
            >
              <RotateCcw className="w-3 h-3" /> Reset Overrides
            </button>
          </div>
        )}
      </div>

      <div className="overflow-x-auto border border-slate-200 dark:border-slate-800 rounded-xl bg-white dark:bg-slate-900 shadow-sm">
        <table className="w-full text-center text-xs border-collapse">
          <thead>
            <tr className="bg-slate-50 dark:bg-slate-800/70 border-b border-slate-200 dark:border-slate-800">
              <th className="py-2.5 px-3 text-left font-semibold text-slate-600 dark:text-slate-300 sticky left-0 bg-slate-50 dark:bg-slate-800 z-10 w-44">
                Asset \ Site (Range)
              </th>
              {scenario.sites.map(s => (
                <th key={s.id} className="py-2.5 px-3 min-w-[90px] border-l border-slate-200 dark:border-slate-800">
                  <div className="font-bold text-slate-800 dark:text-slate-200">{s.id}</div>
                  <div className="text-[10px] text-slate-400 font-mono">{s.range_km} km</div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
            {scenario.assets.map(a => {
              const aRow = coverageData[a.id] || {};
              const distRow = distanceData[a.id] || {};
              const coveredAny = Object.values(aRow).some(v => v === 1);

              return (
                <tr key={a.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition">
                  <td className="py-2 px-3 text-left font-medium text-slate-800 dark:text-slate-200 sticky left-0 bg-white dark:bg-slate-900 z-10 border-r border-slate-200 dark:border-slate-800">
                    <div className="flex items-center justify-between">
                      <span className="font-bold font-mono text-indigo-600 dark:text-indigo-400">{a.id}</span>
                      <span className="truncate max-w-[100px] text-slate-500 text-[11px]">{a.name}</span>
                    </div>
                  </td>

                  {scenario.sites.map(s => {
                    const isCovered = (aRow[s.id] ?? 0) === 1;
                    const dist = distRow[s.id] !== undefined ? distRow[s.id] : null;
                    const overrideKey = `${a.id}_${s.id}`;
                    const isOverridden = overrideKey in overrides;

                    return (
                      <td
                        key={s.id}
                        onClick={() => onToggleOverride(a.id, s.id)}
                        className={`py-2 px-2 border-l border-slate-200 dark:border-slate-800 cursor-pointer select-none transition-all group relative ${
                          isOverridden
                            ? 'bg-amber-100/60 dark:bg-amber-950/40 ring-1 ring-inset ring-amber-400'
                            : isCovered
                            ? 'bg-emerald-50 dark:bg-emerald-950/20'
                            : 'bg-white dark:bg-slate-900'
                        }`}
                        title={`Click to toggle coverage. Distance: ${dist} km (Site range: ${s.range_km} km)`}
                      >
                        <div className="flex flex-col items-center justify-center">
                          <span className={`inline-flex items-center justify-center w-5 h-5 rounded-full text-xs font-bold ${
                            isCovered
                              ? 'bg-emerald-500 text-white shadow-xs'
                              : 'bg-slate-100 text-slate-400 dark:bg-slate-800 dark:text-slate-500'
                          }`}>
                            {isCovered ? <Check className="w-3 h-3" /> : <X className="w-3 h-3" />}
                          </span>
                          {dist !== null && (
                            <span className="text-[10px] text-slate-400 font-mono mt-0.5">
                              {dist.toFixed(1)} km
                            </span>
                          )}
                          {isOverridden && (
                            <span className="text-[9px] font-semibold text-amber-700 dark:text-amber-300">
                              Override
                            </span>
                          )}
                        </div>
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};
