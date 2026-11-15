import React from 'react';
import { ScenarioListItem } from '../types/defense';
import { Plus, FolderOpen, Copy, Trash2, Shield, Calendar, Sparkles, Upload } from 'lucide-react';

interface HomePageProps {
  scenarios: ScenarioListItem[];
  currentScenarioId?: string | null;
  onSelectScenario: (id: string) => void;
  onNewScenario: () => void;
  onNewFromExample: () => void;
  onDuplicateScenario: (id: string) => void;
  onDeleteScenario: (id: string) => void;
  onImportJson: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onOpenSyntheticModal: () => void;
}

export const HomePage: React.FC<HomePageProps> = ({
  scenarios,
  currentScenarioId,
  onSelectScenario,
  onNewScenario,
  onNewFromExample,
  onDuplicateScenario,
  onDeleteScenario,
  onImportJson,
  onOpenSyntheticModal
}) => {
  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      {/* Header Hero */}
      <div className="p-6 bg-linear-to-br from-indigo-900 via-slate-900 to-slate-950 text-white rounded-3xl border border-indigo-900/40 shadow-xl relative overflow-hidden">
        <div className="relative z-10 max-w-3xl space-y-2">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-500/20 text-indigo-300 text-xs font-semibold backdrop-blur-xs border border-indigo-500/30">
            <Shield className="w-3.5 h-3.5" />
            MSL304 Operations Research System
          </div>
          <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight">
            Optimizing Resource Planning for UAV Defense
          </h1>
          <p className="text-xs md:text-sm text-slate-300 leading-relaxed">
            Multi-stage operations research platform integrating <strong>MCLP Unit Placement</strong>, <strong>Erlang-B Channel Sizing</strong>, <strong>Newsvendor Interceptor Stocking</strong>, and <strong>Littlewood Yield Protection Reserves</strong>.
          </p>
        </div>

        {/* Quick Action Buttons */}
        <div className="mt-6 flex flex-wrap items-center gap-3 relative z-10">
          <button
            onClick={onNewFromExample}
            className="flex items-center gap-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold rounded-xl transition shadow-md"
          >
            <FolderOpen className="w-4 h-4" /> Load Preloaded Air Base Example
          </button>
          <button
            onClick={onNewScenario}
            className="flex items-center gap-1.5 px-4 py-2 bg-white/10 hover:bg-white/20 text-white text-xs font-semibold rounded-xl backdrop-blur-xs transition border border-white/10"
          >
            <Plus className="w-4 h-4" /> New Blank Scenario
          </button>
          <label className="flex items-center gap-1.5 px-4 py-2 bg-white/10 hover:bg-white/20 text-white text-xs font-semibold rounded-xl backdrop-blur-xs transition border border-white/10 cursor-pointer">
            <Upload className="w-4 h-4" /> Import Scenario JSON
            <input type="file" accept=".json" onChange={onImportJson} className="hidden" />
          </label>
          <button
            onClick={onOpenSyntheticModal}
            className="flex items-center gap-1.5 px-4 py-2 bg-purple-600/80 hover:bg-purple-600 text-white text-xs font-semibold rounded-xl transition shadow-md"
          >
            <Sparkles className="w-4 h-4" /> Generate Synthetic
          </button>
        </div>
      </div>

      {/* Scenarios Grid */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">
            Saved Scenarios ({scenarios.length})
          </h2>
          <span className="text-xs text-slate-400">
            Stored locally in SQLite database
          </span>
        </div>

        {scenarios.length === 0 ? (
          <div className="p-12 text-center border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-2xl bg-white dark:bg-slate-900">
            <p className="text-slate-500 text-sm mb-3">No defense scenarios found.</p>
            <button
              onClick={onNewFromExample}
              className="px-4 py-2 bg-indigo-600 text-white rounded-xl text-xs font-semibold"
            >
              Load Air Base Example
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {scenarios.map((sc) => {
              const isSelected = sc.id === currentScenarioId;

              return (
                <div
                  key={sc.id}
                  onClick={() => onSelectScenario(sc.id)}
                  className={`p-5 rounded-2xl border transition-all cursor-pointer relative group flex flex-col justify-between ${
                    isSelected
                      ? 'bg-white dark:bg-slate-900 border-indigo-500 dark:border-indigo-500 ring-2 ring-indigo-500/20 shadow-md'
                      : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 hover:shadow-xs'
                  }`}
                >
                  <div className="space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <h3 className="font-bold text-sm text-slate-900 dark:text-slate-100 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition">
                        {sc.name}
                      </h3>
                      <span className="text-[10px] px-2 py-0.5 rounded-full font-mono uppercase bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                        {sc.coordinate_mode}
                      </span>
                    </div>

                    {sc.notes && (
                      <p className="text-xs text-slate-500 dark:text-slate-400 line-clamp-2">
                        {sc.notes}
                      </p>
                    )}

                    <div className="grid grid-cols-3 gap-2 pt-2 text-xs">
                      <div className="p-2 rounded-lg bg-slate-50 dark:bg-slate-800/60">
                        <div className="text-[10px] text-slate-400">Assets</div>
                        <div className="font-bold font-mono">{sc.num_assets}</div>
                      </div>
                      <div className="p-2 rounded-lg bg-slate-50 dark:bg-slate-800/60">
                        <div className="text-[10px] text-slate-400">Sites</div>
                        <div className="font-bold font-mono">{sc.num_sites}</div>
                      </div>
                      <div className="p-2 rounded-lg bg-slate-50 dark:bg-slate-800/60">
                        <div className="text-[10px] text-slate-400">Budget</div>
                        <div className="font-bold font-mono text-indigo-600 dark:text-indigo-400">₹{sc.budget}</div>
                      </div>
                    </div>
                  </div>

                  <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs text-slate-400">
                    <span className="flex items-center gap-1 text-[11px]">
                      <Calendar className="w-3 h-3" />
                      {sc.updated_at ? new Date(sc.updated_at).toLocaleDateString() : 'Recent'}
                    </span>

                    <div className="flex items-center gap-1 opacity-80 group-hover:opacity-100" onClick={(e) => e.stopPropagation()}>
                      <button
                        onClick={() => onDuplicateScenario(sc.id)}
                        className="p-1 hover:text-indigo-600 dark:hover:text-indigo-400 transition"
                        title="Duplicate scenario"
                      >
                        <Copy className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => onDeleteScenario(sc.id)}
                        className="p-1 hover:text-rose-600 dark:hover:text-rose-400 transition"
                        title="Delete scenario"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
