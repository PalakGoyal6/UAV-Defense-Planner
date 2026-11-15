import React from 'react';
import { FullPlanResponse } from '../types/defense';
import { ShieldCheck, Crosshair, Radio, Package, Award, AlertOctagon, DollarSign } from 'lucide-react';

interface PlanSummaryCardsProps {
  plan: FullPlanResponse;
}

export const PlanSummaryCards: React.FC<PlanSummaryCardsProps> = ({ plan }) => {
  const loc = plan.location;
  const chan = plan.channels;
  const inv = plan.inventory;
  const res = plan.reserve;

  return (
    <div className="space-y-4">
      {/* Executive Plain English Banner */}
      <div className="p-4 bg-linear-to-r from-indigo-500/10 via-purple-500/10 to-emerald-500/10 border border-indigo-200/60 dark:border-indigo-800/40 rounded-2xl">
        <div className="flex items-center gap-2 mb-1.5">
          <Award className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
          <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100 uppercase tracking-wide">
            Optimal Defense Plan Recommendation
          </h2>
          <span className="ml-auto text-xs px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 font-semibold font-mono">
            {loc.solver_used.toUpperCase()} &bull; {loc.status}
          </span>
        </div>
        <p className="text-xs text-slate-700 dark:text-slate-200 leading-relaxed">
          Open defense units at <strong className="text-indigo-600 dark:text-indigo-400">{loc.opened_sites.join(', ')}</strong> deploying a total of <strong>{chan.total_channels} engagement channels</strong> (costing ₹{loc.total_site_cost.toLocaleString()} of ₹{loc.budget.toLocaleString()} budget) to protect <strong className="text-emerald-600 dark:text-emerald-400">{loc.pct_value_protected}%</strong> of asset value. Stock <strong>{inv.total_stock_Q_star} interceptors</strong>, reserving <strong>{res.reserve_y1_star} units strictly for high-value assets</strong>.
        </p>
      </div>

      {/* 6 Key KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        {/* Card 1: Value Protected */}
        <div className="p-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-xs">
          <div className="flex items-center justify-between text-slate-400 mb-1">
            <span className="text-[11px] font-medium">Value Protected</span>
            <ShieldCheck className="w-4 h-4 text-emerald-500" />
          </div>
          <div className="text-lg font-bold text-slate-900 dark:text-slate-100 font-mono">
            {loc.total_value_protected.toFixed(0)} <span className="text-xs text-slate-400 font-normal">/ {loc.total_possible_value}</span>
          </div>
          <div className="text-[11px] text-emerald-600 dark:text-emerald-400 font-semibold">
            {loc.pct_value_protected}% coverage
          </div>
        </div>

        {/* Card 2: Sites Opened */}
        <div className="p-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-xs">
          <div className="flex items-center justify-between text-slate-400 mb-1">
            <span className="text-[11px] font-medium">Sites Opened</span>
            <Crosshair className="w-4 h-4 text-blue-500" />
          </div>
          <div className="text-lg font-bold text-slate-900 dark:text-slate-100 font-mono">
            {loc.opened_sites.length} <span className="text-xs text-slate-400 font-normal">sites</span>
          </div>
          <div className="text-[11px] text-blue-600 dark:text-blue-400 truncate" title={loc.opened_sites.join(', ')}>
            {loc.opened_sites.join(', ') || 'None'}
          </div>
        </div>

        {/* Card 3: Capital Cost */}
        <div className="p-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-xs">
          <div className="flex items-center justify-between text-slate-400 mb-1">
            <span className="text-[11px] font-medium">Total Cost</span>
            <DollarSign className="w-4 h-4 text-indigo-500" />
          </div>
          <div className="text-lg font-bold text-slate-900 dark:text-slate-100 font-mono">
            ₹{loc.total_site_cost.toLocaleString()}
          </div>
          <div className="text-[11px] text-slate-400">
            of ₹{loc.budget.toLocaleString()} budget
          </div>
        </div>

        {/* Card 4: Channels */}
        <div className="p-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-xs">
          <div className="flex items-center justify-between text-slate-400 mb-1">
            <span className="text-[11px] font-medium">Engagement Channels</span>
            <Radio className="w-4 h-4 text-emerald-500" />
          </div>
          <div className="text-lg font-bold text-slate-900 dark:text-slate-100 font-mono">
            {chan.total_channels}
          </div>
          <div className="text-[11px] text-emerald-600 dark:text-emerald-400">
            Erlang-B sized
          </div>
        </div>

        {/* Card 5: Inventory Stock Q* */}
        <div className="p-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-xs">
          <div className="flex items-center justify-between text-slate-400 mb-1">
            <span className="text-[11px] font-medium">Stock Target (Q*)</span>
            <Package className="w-4 h-4 text-purple-500" />
          </div>
          <div className="text-lg font-bold text-slate-900 dark:text-slate-100 font-mono">
            {inv.total_stock_Q_star} <span className="text-xs text-slate-400 font-normal">units</span>
          </div>
          <div className="text-[11px] text-purple-600 dark:text-purple-400">
            CR = {inv.critical_ratio.toFixed(2)}
          </div>
        </div>

        {/* Card 6: Littlewood Reserve */}
        <div className="p-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-xs">
          <div className="flex items-center justify-between text-slate-400 mb-1">
            <span className="text-[11px] font-medium">High Reserve (y₁*)</span>
            <AlertOctagon className="w-4 h-4 text-amber-500" />
          </div>
          <div className="text-lg font-bold text-slate-900 dark:text-slate-100 font-mono">
            {res.reserve_y1_star} <span className="text-xs text-slate-400 font-normal">units</span>
          </div>
          <div className="text-[11px] text-amber-600 dark:text-amber-400">
            Low limit: {res.booking_limit_low_value}
          </div>
        </div>
      </div>
    </div>
  );
};
