import React, { useState } from 'react';
import { Scenario, FullPlanResponse } from '../types/defense';
import { PlanSummaryCards } from '../components/PlanSummaryCards';
import { DeploymentMapView } from '../components/DeploymentMapView';
import { StepCards } from '../components/StepCards';
import { ChannelCurvesChart } from '../components/ChannelCurvesChart';
import { ComparisonTable } from '../components/ComparisonTable';
import { Layers, Map as MapIcon, BarChart2, GitCompare, Play, AlertTriangle } from 'lucide-react';

interface ResultsPageProps {
  scenario: Scenario;
  plan: FullPlanResponse | null;
  onRunPlan: () => void;
  isRunning: boolean;
}

export const ResultsPage: React.FC<ResultsPageProps> = ({
  scenario,
  plan,
  onRunPlan,
  isRunning
}) => {
  const [activeSubTab, setActiveSubTab] = useState<'plan' | 'map' | 'curves' | 'comparison'>('plan');

  if (!plan) {
    return (
      <div className="p-12 text-center border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-3xl bg-white dark:bg-slate-900 max-w-2xl mx-auto space-y-4">
        <div className="w-12 h-12 rounded-2xl bg-indigo-50 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-400 flex items-center justify-center mx-auto">
          <Play className="w-6 h-6 ml-0.5" />
        </div>
        <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100">
          No Defense Plan Calculated Yet
        </h3>
        <p className="text-xs text-slate-500 dark:text-slate-400 max-w-md mx-auto">
          Execute the 5-step optimization pipeline to determine unit placements, channel capacities, inventory stock levels, and Littlewood reserves.
        </p>
        <button
          onClick={onRunPlan}
          disabled={isRunning}
          className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white rounded-xl text-xs font-semibold shadow-md transition"
        >
          {isRunning ? 'Solving Plan...' : 'Run Defense Plan Now'}
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Top Warnings Banner if any */}
      {plan.warnings && plan.warnings.length > 0 && (
        <div className="p-3.5 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/40 rounded-xl space-y-1 text-xs text-amber-800 dark:text-amber-200">
          <div className="font-semibold flex items-center gap-1.5">
            <AlertTriangle className="w-4 h-4 text-amber-600" />
            <span>Solver Warnings & Strategic Notices:</span>
          </div>
          {plan.warnings.map((w, idx) => (
            <div key={idx} className="pl-5 text-[11px]">&bull; {w}</div>
          ))}
        </div>
      )}

      {/* Plan Executive Cards & KPIs */}
      <PlanSummaryCards plan={plan} />

      {/* Sub-Navigation Tabs */}
      <div className="flex border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 rounded-2xl px-2 shadow-xs">
        <button
          onClick={() => setActiveSubTab('plan')}
          className={`flex items-center gap-2 py-3 px-4 font-semibold text-xs transition border-b-2 ${
            activeSubTab === 'plan'
              ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400'
              : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
          }`}
        >
          <Layers className="w-4 h-4" />
          <span>5-Step Execution Breakdown</span>
        </button>

        <button
          onClick={() => setActiveSubTab('map')}
          className={`flex items-center gap-2 py-3 px-4 font-semibold text-xs transition border-b-2 ${
            activeSubTab === 'map'
              ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400'
              : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
          }`}
        >
          <MapIcon className="w-4 h-4" />
          <span>Deployment Map & Assignments</span>
        </button>

        <button
          onClick={() => setActiveSubTab('curves')}
          className={`flex items-center gap-2 py-3 px-4 font-semibold text-xs transition border-b-2 ${
            activeSubTab === 'curves'
              ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400'
              : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
          }`}
        >
          <BarChart2 className="w-4 h-4" />
          <span>Erlang-B Sizing Curves</span>
        </button>

        <button
          onClick={() => setActiveSubTab('comparison')}
          className={`flex items-center gap-2 py-3 px-4 font-semibold text-xs transition border-b-2 ${
            activeSubTab === 'comparison'
              ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400'
              : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
          }`}
        >
          <GitCompare className="w-4 h-4" />
          <span>Model Comparison (MCLP vs Set Cover vs Greedy)</span>
        </button>
      </div>

      {/* Sub-Tab Contents */}
      <div className="pt-1">
        {activeSubTab === 'plan' && <StepCards plan={plan} />}
        {activeSubTab === 'map' && <DeploymentMapView scenario={scenario} plan={plan} />}
        {activeSubTab === 'curves' && (
          <ChannelCurvesChart
            queueingOutput={plan.channels}
            targetLeakProbability={scenario.parameters.target_leak_probability}
          />
        )}
        {activeSubTab === 'comparison' && <ComparisonTable comparisons={plan.comparison} />}
      </div>
    </div>
  );
};
