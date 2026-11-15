import React from 'react';
import { Scenario } from '../types/defense';
import { ShieldAlert, ShieldCheck, AlertTriangle } from 'lucide-react';

interface DataHealthBoxProps {
  scenario: Scenario;
  coverageData?: Record<string, Record<string, number>> | null;
}

export const DataHealthBox: React.FC<DataHealthBoxProps> = ({ scenario, coverageData }) => {
  const numAssets = scenario.assets.length;
  const numSites = scenario.sites.length;
  const totalValue = scenario.assets.reduce((sum, a) => sum + (Number(a.value) || 0), 0);
  const totalCost = scenario.sites.reduce((sum, s) => sum + (Number(s.cost) || 0), 0);

  // Compute uncoverable assets and useless sites from coverageData if available
  let uncoverableCount = 0;
  let uselessSitesCount = 0;

  if (coverageData) {
    uncoverableCount = scenario.assets.filter(a => {
      const row = coverageData[a.id];
      if (!row) return true;
      return !Object.values(row).some(v => v === 1);
    }).length;

    uselessSitesCount = scenario.sites.filter(s => {
      return !scenario.assets.some(a => coverageData[a.id]?.[s.id] === 1);
    }).length;
  }

  const hasIssues = uncoverableCount > 0 || uselessSitesCount > 0 || numAssets === 0 || numSites === 0;

  return (
    <div className={`p-4 rounded-xl border transition-all ${
      hasIssues 
        ? 'bg-amber-50/70 border-amber-200 dark:bg-amber-950/20 dark:border-amber-800/40 text-amber-900 dark:text-amber-200' 
        : 'bg-emerald-50/70 border-emerald-200 dark:bg-emerald-950/20 dark:border-emerald-800/40 text-emerald-900 dark:text-emerald-200'
    }`}>
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2 font-semibold text-sm">
          {hasIssues ? <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400" /> : <ShieldCheck className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />}
          <span>Data Health & Readiness</span>
        </div>
        <span className="text-xs px-2 py-0.5 rounded-full bg-white/60 dark:bg-black/40 font-mono">
          Mode: {scenario.coordinate_mode.toUpperCase()}
        </span>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-3 text-xs">
        <div className="bg-white/80 dark:bg-slate-800/80 p-2.5 rounded-lg border border-slate-200/60 dark:border-slate-700/60">
          <div className="text-slate-500 dark:text-slate-400">Total Assets</div>
          <div className="text-base font-bold text-slate-800 dark:text-slate-100">{numAssets}</div>
          <div className="text-[10px] text-slate-400">Val: {totalValue.toLocaleString()}</div>
        </div>

        <div className="bg-white/80 dark:bg-slate-800/80 p-2.5 rounded-lg border border-slate-200/60 dark:border-slate-700/60">
          <div className="text-slate-500 dark:text-slate-400">Candidate Sites</div>
          <div className="text-base font-bold text-slate-800 dark:text-slate-100">{numSites}</div>
          <div className="text-[10px] text-slate-400">Cost: ₹{totalCost.toLocaleString()}</div>
        </div>

        <div className="bg-white/80 dark:bg-slate-800/80 p-2.5 rounded-lg border border-slate-200/60 dark:border-slate-700/60">
          <div className="text-slate-500 dark:text-slate-400">Available Budget</div>
          <div className="text-base font-bold text-indigo-600 dark:text-indigo-400">₹{scenario.parameters.budget.toLocaleString()}</div>
          <div className="text-[10px] text-slate-400">Capital Cap</div>
        </div>

        <div className="bg-white/80 dark:bg-slate-800/80 p-2.5 rounded-lg border border-slate-200/60 dark:border-slate-700/60">
          <div className="text-slate-500 dark:text-slate-400">Uncoverable Assets</div>
          <div className={`text-base font-bold ${uncoverableCount > 0 ? 'text-rose-600 dark:text-rose-400' : 'text-slate-700 dark:text-slate-300'}`}>
            {uncoverableCount}
          </div>
          <div className="text-[10px] text-slate-400">Out of range of all sites</div>
        </div>

        <div className="bg-white/80 dark:bg-slate-800/80 p-2.5 rounded-lg border border-slate-200/60 dark:border-slate-700/60">
          <div className="text-slate-500 dark:text-slate-400">Sites Covering 0</div>
          <div className={`text-base font-bold ${uselessSitesCount > 0 ? 'text-amber-600 dark:text-amber-400' : 'text-slate-700 dark:text-slate-300'}`}>
            {uselessSitesCount}
          </div>
          <div className="text-[10px] text-slate-400">Will be pruned in MILP</div>
        </div>
      </div>
    </div>
  );
};
