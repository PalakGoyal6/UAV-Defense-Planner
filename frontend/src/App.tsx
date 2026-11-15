import React, { useState, useEffect } from 'react';
import {
  Scenario, ScenarioListItem, FullPlanResponse,
  CoordinateMode, GlobalParameters
} from './types/defense';
import {
  fetchScenarios, fetchScenario, createScenario,
  updateScenario, deleteScenario, duplicateScenario,
  solvePlan, fetchCoverageMatrix, importScenarioApi, generateSyntheticApi
} from './services/api';

import { HomePage } from './pages/HomePage';
import { DataInputPage } from './pages/DataInputPage';
import { ResultsPage } from './pages/ResultsPage';
import { SensitivityPage } from './pages/SensitivityPage';
import { ScalingPage } from './pages/ScalingPage';
import { ExportReportPage } from './pages/ExportReportPage';

import {
  Shield, Database, LayoutDashboard, Play, Save, Copy,
  Moon, Sun, BarChart2, Layers, Download, CheckCircle,
  AlertTriangle, RefreshCw, Plus, Sparkles
} from 'lucide-react';

const DEFAULT_BLANK_SCENARIO: Scenario = {
  name: 'New Scenario',
  notes: 'Custom defense scenario',
  coordinate_mode: 'grid',
  assets: [
    { id: 'A1', name: 'Command Center', x: 5.0, y: 5.0, value: 100, threat_rate: 0.40, priority_class: 'high' },
    { id: 'A2', name: 'Logistics Hub', x: 8.0, y: 4.0, value: 70, threat_rate: 0.25, priority_class: 'low' }
  ],
  sites: [
    { id: 'S1', name: 'Site North', x: 5.0, y: 5.0, cost: 30, range_km: 3.0, max_channels: 8, channel_cost: 0 },
    { id: 'S2', name: 'Site East', x: 7.5, y: 4.5, cost: 25, range_km: 3.0, max_channels: 8, channel_cost: 0 }
  ],
  parameters: {
    budget: 60.0,
    mean_engagement_time_min: 1.5,
    target_leak_probability: 0.05,
    attack_duration_min: 30.0,
    shots_per_engagement: 1,
    underage_cost: 50.0,
    overage_cost: 5.0,
    interceptor_unit_cost: 2.0,
    demand_mode: 'derived',
    target_service_level: 0.95,
    base_lead_time_days: 2.0,
    transport_speed_km_per_day: 300.0,
    depot_x: 0.0,
    depot_y: 0.0,
    order_setup_cost: 20.0,
    holding_cost_per_unit_per_day: 0.01,
    high_value_threshold: 75.0,
    solver_time_limit_sec: 60,
    assignment_mode: 'single'
  },
  coverage_overrides: {}
};

export function App() {
  const [currentPage, setCurrentPage] = useState<'home' | 'input' | 'results' | 'sensitivity' | 'scaling' | 'export'>('home');
  const [darkMode, setDarkMode] = useState<boolean>(false);

  // Scenario States
  const [scenariosList, setScenariosList] = useState<ScenarioListItem[]>([]);
  const [currentScenario, setCurrentScenario] = useState<Scenario>(DEFAULT_BLANK_SCENARIO);
  const [currentScenarioId, setCurrentScenarioId] = useState<string | null>(null);

  // Coverage Data for health check
  const [coverageData, setCoverageData] = useState<Record<string, Record<string, number>> | null>(null);
  const [distanceData, setDistanceData] = useState<Record<string, Record<string, number>> | null>(null);

  // Plan State
  const [currentPlan, setCurrentPlan] = useState<FullPlanResponse | null>(null);
  const [isRunningPlan, setIsRunningPlan] = useState<boolean>(false);
  const [saveStatus, setSaveStatus] = useState<string | null>(null);

  // Modal State for Synthetic Generator
  const [newScenarioModalOpen, setNewScenarioModalOpen] = useState<boolean>(false);
  const [newScName, setNewScName] = useState<string>('My UAV Scenario');
  const [newScCoord, setNewScCoord] = useState<CoordinateMode>('grid');

  // Toggle Dark Mode
  useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [darkMode]);

  // Initial load: fetch scenarios
  useEffect(() => {
    loadScenarios();
  }, []);

  const loadScenarios = async () => {
    try {
      const list = await fetchScenarios();
      setScenariosList(list);
      if (list.length > 0 && !currentScenarioId) {
        selectScenario(list[0].id);
      }
    } catch (e) {
      console.error('Failed to load scenarios list:', e);
    }
  };

  const selectScenario = async (id: string) => {
    try {
      const sc = await fetchScenario(id);
      setCurrentScenario(sc);
      setCurrentScenarioId(id);
      setCurrentPlan(null);
      refreshCoverage(sc);
    } catch (e) {
      console.error('Failed to load scenario details:', e);
    }
  };

  const refreshCoverage = async (sc: Scenario = currentScenario) => {
    try {
      const covRes = await fetchCoverageMatrix(sc);
      setCoverageData(covRes.coverage);
      setDistanceData(covRes.distances);
    } catch (e) {
      console.error('Failed to compute coverage matrix:', e);
    }
  };

  const handleSaveScenario = async () => {
    try {
      setSaveStatus('Saving...');
      if (currentScenarioId) {
        await updateScenario(currentScenarioId, currentScenario);
        setSaveStatus('Saved!');
      } else {
        const res = await createScenario(currentScenario);
        setCurrentScenarioId(res.id);
        setSaveStatus('Created!');
      }
      loadScenarios();
      setTimeout(() => setSaveStatus(null), 2500);
    } catch (err: any) {
      setSaveStatus('Error saving');
      setTimeout(() => setSaveStatus(null), 3000);
    }
  };

  const handleDuplicate = async () => {
    if (!currentScenarioId) return;
    try {
      const dup = await duplicateScenario(currentScenarioId);
      await loadScenarios();
      selectScenario(dup.id!);
      setSaveStatus('Duplicated!');
      setTimeout(() => setSaveStatus(null), 2000);
    } catch (err: any) {
      alert(`Duplicate failed: ${err.message}`);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this scenario?')) return;
    try {
      await deleteScenario(id);
      if (currentScenarioId === id) {
        setCurrentScenarioId(null);
      }
      loadScenarios();
    } catch (err: any) {
      alert(`Delete failed: ${err.message}`);
    }
  };

  const handleRunPlan = async () => {
    setIsRunningPlan(true);
    try {
      const plan = await solvePlan(currentScenario);
      setCurrentPlan(plan);
      setCurrentPage('results');
    } catch (err: any) {
      alert(`Solver failed: ${err.message}`);
    } finally {
      setIsRunningPlan(false);
    }
  };

  const handleImportJson = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (evt) => {
      try {
        const parsed = JSON.parse(evt.target?.result as string);
        const imported = await importScenarioApi(parsed);
        await loadScenarios();
        selectScenario(imported.id!);
        alert(`Scenario "${imported.name}" imported successfully!`);
      } catch (err: any) {
        alert(`Failed to import JSON: ${err.message}`);
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const handleCreateNewBlank = () => {
    const newSc: Scenario = {
      ...DEFAULT_BLANK_SCENARIO,
      name: newScName || 'New Blank Scenario',
      coordinate_mode: newScCoord,
      assets: [],
      sites: []
    };
    setCurrentScenario(newSc);
    setCurrentScenarioId(null);
    setCurrentPlan(null);
    setCoverageData(null);
    setNewScenarioModalOpen(false);
    setCurrentPage('input');
  };

  const handleNewFromExample = () => {
    const airBase = scenariosList.find(s => s.id === 'air-base-small' || s.name.toLowerCase().includes('air base'));
    if (airBase) {
      selectScenario(airBase.id);
      setCurrentPage('input');
    } else {
      loadScenarios();
    }
  };

  let statusText = 'Not Run';
  let statusColor = 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300';
  if (currentPlan) {
    if (currentPlan.location.solver_used === 'greedy_fallback') {
      statusText = 'Greedy Fallback';
      statusColor = 'bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300';
    } else if (currentPlan.location.status === 'Optimal' || currentPlan.location.status === 'Feasible') {
      statusText = 'Optimal (MILP)';
      statusColor = 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300';
    } else {
      statusText = 'Infeasible';
      statusColor = 'bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300';
    }
  }

  return (
    <div className="flex h-screen bg-slate-50 dark:bg-slate-950 text-slate-800 dark:text-slate-100 overflow-hidden font-sans">
      {/* Sidebar Navigation */}
      <aside className="print:hidden w-64 bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800 flex flex-col justify-between shrink-0">
        <div className="p-4 space-y-6">
          {/* Logo & App Brand */}
          <div className="flex items-center gap-2.5 px-2">
            <div className="w-9 h-9 rounded-xl bg-linear-to-tr from-indigo-600 to-purple-600 text-white flex items-center justify-center shadow-md">
              <Shield className="w-5 h-5" />
            </div>
            <div>
              <div className="font-extrabold text-sm tracking-tight text-slate-900 dark:text-slate-100">
                UAV Defense
              </div>
              <div className="text-[10px] text-slate-400 font-mono">
                Resource Planner &bull; MSL304
              </div>
            </div>
          </div>

          {/* Navigation Links */}
          <nav className="space-y-1">
            <button
              onClick={() => setCurrentPage('home')}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-semibold transition ${
                currentPage === 'home'
                  ? 'bg-indigo-50 text-indigo-700 dark:bg-indigo-950/50 dark:text-indigo-300'
                  : 'text-slate-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800'
              }`}
            >
              <Database className="w-4 h-4" />
              <span>Scenarios & Home</span>
            </button>

            <button
              onClick={() => setCurrentPage('input')}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-semibold transition ${
                currentPage === 'input'
                  ? 'bg-indigo-50 text-indigo-700 dark:bg-indigo-950/50 dark:text-indigo-300'
                  : 'text-slate-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800'
              }`}
            >
              <LayoutDashboard className="w-4 h-4" />
              <span>Data Input & Map</span>
            </button>

            <button
              onClick={() => setCurrentPage('results')}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-semibold transition ${
                currentPage === 'results'
                  ? 'bg-indigo-50 text-indigo-700 dark:bg-indigo-950/50 dark:text-indigo-300'
                  : 'text-slate-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800'
              }`}
            >
              <CheckCircle className="w-4 h-4" />
              <span>Defense Plan & Results</span>
              {currentPlan && (
                <span className="ml-auto w-2 h-2 rounded-full bg-emerald-500"></span>
              )}
            </button>

            <button
              onClick={() => setCurrentPage('sensitivity')}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-semibold transition ${
                currentPage === 'sensitivity'
                  ? 'bg-indigo-50 text-indigo-700 dark:bg-indigo-950/50 dark:text-indigo-300'
                  : 'text-slate-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800'
              }`}
            >
              <BarChart2 className="w-4 h-4" />
              <span>Sensitivity Analysis</span>
            </button>

            <button
              onClick={() => setCurrentPage('scaling')}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-semibold transition ${
                currentPage === 'scaling'
                  ? 'bg-indigo-50 text-indigo-700 dark:bg-indigo-950/50 dark:text-indigo-300'
                  : 'text-slate-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800'
              }`}
            >
              <Layers className="w-4 h-4" />
              <span>Scaling & Regions</span>
            </button>

            <button
              onClick={() => setCurrentPage('export')}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-semibold transition ${
                currentPage === 'export'
                  ? 'bg-indigo-50 text-indigo-700 dark:bg-indigo-950/50 dark:text-indigo-300'
                  : 'text-slate-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800'
              }`}
            >
              <Download className="w-4 h-4" />
              <span>Export & PDF Report</span>
            </button>
          </nav>
        </div>

        {/* Sidebar Footer */}
        <div className="p-4 border-t border-slate-200 dark:border-slate-800 space-y-3">
          <div className="flex items-center justify-between text-xs text-slate-500">
            <span>Dark Appearance</span>
            <button
              onClick={() => setDarkMode(!darkMode)}
              className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 transition"
            >
              {darkMode ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            </button>
          </div>
          <div className="text-[10px] text-slate-400 text-center font-mono">
            FastAPI &bull; PuLP CBC &bull; v1.0
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Top Header Bar */}
        <header className="print:hidden h-16 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 px-6 flex items-center justify-between gap-4 shrink-0 shadow-xs">
          <div className="flex items-center gap-3 min-w-0">
            <span className="text-xs text-slate-400 font-medium hidden sm:inline">Scenario:</span>
            <select
              value={currentScenarioId || ''}
              onChange={(e) => selectScenario(e.target.value)}
              className="px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs font-bold text-slate-800 dark:text-slate-100 max-w-xs truncate"
            >
              {scenariosList.map(sc => (
                <option key={sc.id} value={sc.id}>
                  {sc.name} ({sc.coordinate_mode.toUpperCase()})
                </option>
              ))}
              {!currentScenarioId && <option value="">Custom Unsaved Scenario</option>}
            </select>

            <button
              onClick={() => setNewScenarioModalOpen(true)}
              className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300"
              title="Create New Blank Scenario"
            >
              <Plus className="w-4 h-4" />
            </button>
          </div>

          <div className="flex items-center gap-3">
            <span className={`px-2.5 py-1 rounded-full text-xs font-semibold flex items-center gap-1.5 ${statusColor}`}>
              <span className="w-2 h-2 rounded-full bg-current opacity-80"></span>
              <span>{statusText}</span>
            </span>

            <button
              onClick={handleSaveScenario}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-750 text-xs font-semibold text-slate-700 dark:text-slate-200 shadow-xs transition"
            >
              <Save className="w-3.5 h-3.5" />
              <span>{saveStatus || 'Save'}</span>
            </button>

            {currentScenarioId && (
              <button
                onClick={handleDuplicate}
                className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 text-xs font-semibold text-slate-700 dark:text-slate-200 transition"
              >
                <Copy className="w-3.5 h-3.5" />
                <span>Duplicate</span>
              </button>
            )}

            <button
              onClick={handleRunPlan}
              disabled={isRunningPlan}
              className="flex items-center gap-1.5 px-4 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-xs font-bold shadow-md transition"
            >
              {isRunningPlan ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  <span>Solving...</span>
                </>
              ) : (
                <>
                  <Play className="w-3.5 h-3.5 fill-current" />
                  <span>Run Plan</span>
                </>
              )}
            </button>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto p-6">
          {currentPage === 'home' && (
            <HomePage
              scenarios={scenariosList}
              currentScenarioId={currentScenarioId}
              onSelectScenario={(id) => {
                selectScenario(id);
                setCurrentPage('input');
              }}
              onNewScenario={() => setNewScenarioModalOpen(true)}
              onNewFromExample={handleNewFromExample}
              onDuplicateScenario={duplicateScenario}
              onDeleteScenario={handleDelete}
              onImportJson={handleImportJson}
              onOpenSyntheticModal={() => setCurrentPage('scaling')}
            />
          )}

          {currentPage === 'input' && (
            <DataInputPage
              scenario={currentScenario}
              onUpdateScenario={setCurrentScenario}
              coverageData={coverageData}
              distanceData={distanceData}
              onRefreshCoverage={() => refreshCoverage(currentScenario)}
            />
          )}

          {currentPage === 'results' && (
            <ResultsPage
              scenario={currentScenario}
              plan={currentPlan}
              onRunPlan={handleRunPlan}
              isRunning={isRunningPlan}
            />
          )}

          {currentPage === 'sensitivity' && (
            <SensitivityPage scenario={currentScenario} />
          )}

          {currentPage === 'scaling' && (
            <ScalingPage
              scenario={currentScenario}
              onApplyGeneratedScenario={(newSc) => {
                setCurrentScenario(newSc);
                setCurrentScenarioId(null);
                refreshCoverage(newSc);
                setCurrentPage('input');
              }}
            />
          )}

          {currentPage === 'export' && (
            <ExportReportPage
              scenario={currentScenario}
              plan={currentPlan}
            />
          )}
        </main>
      </div>

      {newScenarioModalOpen && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-md w-full p-6 shadow-xl space-y-4">
            <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">
              Create New Defense Scenario
            </h3>
            <div className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-500 font-medium mb-1">Scenario Name</label>
                <input
                  type="text"
                  value={newScName}
                  onChange={(e) => setNewScName(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 dark:bg-slate-800 font-medium"
                />
              </div>

              <div>
                <label className="block text-slate-500 font-medium mb-1">Coordinate Reference Mode</label>
                <select
                  value={newScCoord}
                  onChange={(e) => setNewScCoord(e.target.value as CoordinateMode)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 dark:bg-slate-800 font-medium"
                >
                  <option value="grid">Grid (km plane - hand checkable)</option>
                  <option value="geo">Geographic (Latitude / Longitude / OSM)</option>
                </select>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => setNewScenarioModalOpen(false)}
                className="px-4 py-2 rounded-xl text-xs font-semibold bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200"
              >
                Cancel
              </button>
              <button
                onClick={handleCreateNewBlank}
                className="px-4 py-2 rounded-xl text-xs font-semibold bg-indigo-600 hover:bg-indigo-700 text-white"
              >
                Create Scenario
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
