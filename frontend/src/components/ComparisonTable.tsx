import React from 'react';
import { ComparisonResult } from '../types/defense';
import { CheckCircle2, TrendingUp, DollarSign } from 'lucide-react';

interface ComparisonTableProps {
  comparisons: ComparisonResult[];
}

export const ComparisonTable: React.FC<ComparisonTableProps> = ({ comparisons }) => {
  if (!comparisons || comparisons.length === 0) {
    return null;
  }

  return (
    <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-4 shadow-xs space-y-4">
      <div>
        <h4 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
          Optimization Model Benchmarks & Comparison
        </h4>
        <p className="text-xs text-slate-500 dark:text-slate-400">
          Evaluating the primary MILP against Cost-Minimizing Set Cover and the Fast Greedy Heuristic.
        </p>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs border-collapse">
          <thead className="bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300">
            <tr>
              <th className="py-2.5 px-3">Formulation Model</th>
              <th className="py-2.5 px-3">Sites Opened</th>
              <th className="py-2.5 px-3">Deployment Cost (₹)</th>
              <th className="py-2.5 px-3">Value Protected</th>
              <th className="py-2.5 px-3">% Coverage</th>
              <th className="py-2.5 px-3">Optimality Gap</th>
              <th className="py-2.5 px-3 min-w-[200px]">Strategic Notes</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
            {comparisons.map((c, i) => {
              const isPrimary = i === 0;

              return (
                <tr
                  key={c.model_name}
                  className={`transition ${
                    isPrimary
                      ? 'bg-indigo-50/40 dark:bg-indigo-950/20 font-medium'
                      : 'hover:bg-slate-50 dark:hover:bg-slate-800/40'
                  }`}
                >
                  <td className="py-2.5 px-3 font-semibold text-slate-800 dark:text-slate-200">
                    <div className="flex items-center gap-1.5">
                      {isPrimary && <CheckCircle2 className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />}
                      <span>{c.model_name}</span>
                    </div>
                  </td>
                  <td className="py-2.5 px-3 font-mono font-bold">
                    {c.opened_sites.join(', ') || 'None'}
                  </td>
                  <td className="py-2.5 px-3 font-mono">
                    ₹{c.total_cost.toLocaleString()}
                  </td>
                  <td className="py-2.5 px-3 font-mono font-bold">
                    {c.value_protected.toLocaleString()}
                  </td>
                  <td className="py-2.5 px-3">
                    <span className={`px-2 py-0.5 rounded-full text-[11px] font-bold ${
                      c.pct_value_protected >= 95
                        ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300'
                        : 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300'
                    }`}>
                      {c.pct_value_protected}%
                    </span>
                  </td>
                  <td className="py-2.5 px-3 font-mono">
                    {c.optimality_gap_pct !== null && c.optimality_gap_pct !== undefined ? (
                      <span className={c.optimality_gap_pct > 0 ? 'text-amber-600 font-bold' : 'text-emerald-600'}>
                        {c.optimality_gap_pct.toFixed(1)}%
                      </span>
                    ) : (
                      <span className="text-slate-400">-</span>
                    )}
                  </td>
                  <td className="py-2.5 px-3 text-slate-600 dark:text-slate-400 text-[11px]">
                    {c.notes}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};
