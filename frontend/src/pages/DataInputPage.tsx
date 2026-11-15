import React, { useState } from 'react';
import { Scenario, Asset, CandidateSite, GlobalParameters, CoordinateMode, Depot } from '../types/defense';
import { DataHealthBox } from '../components/DataHealthBox';
import { AssetsTable } from '../components/AssetsTable';
import { SitesTable } from '../components/SitesTable';
import { MapEditor } from '../components/MapEditor';
import { ParametersForm } from '../components/ParametersForm';
import { CoverageMatrixView } from '../components/CoverageMatrixView';
import { Target, Shield, Map as MapIcon, Sliders, Grid } from 'lucide-react';
import { computeNearestDepotDistance } from '../utils/geo';

interface DataInputPageProps {
  scenario: Scenario;
  onUpdateScenario: (scenario: Scenario) => void;
  coverageData?: Record<string, Record<string, number>> | null;
  distanceData?: Record<string, Record<string, number>> | null;
  onRefreshCoverage: () => void;
}

export const DataInputPage: React.FC<DataInputPageProps> = ({
  scenario,
  onUpdateScenario,
  coverageData,
  distanceData,
  onRefreshCoverage
}) => {
  const [activeTab, setActiveTab] = useState<'assets' | 'sites' | 'map' | 'params' | 'coverage'>('assets');

  const updateAssets = (newAssets: Asset[]) => {
    onUpdateScenario({ ...scenario, assets: newAssets });
    setTimeout(onRefreshCoverage, 100);
  };

  const updateSites = (newSites: CandidateSite[]) => {
    onUpdateScenario({ ...scenario, sites: newSites });
    setTimeout(onRefreshCoverage, 100);
  };

  const updateParameters = (newParams: GlobalParameters) => {
    onUpdateScenario({ ...scenario, parameters: newParams });
  };

  const handleToggleCoverageOverride = (assetId: string, siteId: string) => {
    const key = `${assetId}_${siteId}`;
    const overrides = { ...(scenario.coverage_overrides || {}) };
    const currentVal = coverageData?.[assetId]?.[siteId] ?? 0;

    if (key in overrides) {
      // Toggle or remove override
      if (overrides[key] === 1) {
        overrides[key] = 0;
      } else {
        delete overrides[key];
      }
    } else {
      // Create override opposite to current computed
      overrides[key] = currentVal === 1 ? 0 : 1;
    }

    onUpdateScenario({ ...scenario, coverage_overrides: overrides });
    setTimeout(onRefreshCoverage, 50);
  };

  const handleClearOverrides = () => {
    onUpdateScenario({ ...scenario, coverage_overrides: {} });
    setTimeout(onRefreshCoverage, 50);
  };

  return (
    <div className="space-y-5 max-w-7xl mx-auto">
      {/* Live Data Health Header */}
      <DataHealthBox scenario={scenario} coverageData={coverageData} />

      {/* Tabs Bar */}
      <div className="flex border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 rounded-2xl px-2 shadow-xs">
        <button
          onClick={() => setActiveTab('assets')}
          className={`flex items-center gap-2 py-3 px-4 font-semibold text-xs transition border-b-2 ${
            activeTab === 'assets'
              ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400'
              : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
          }`}
        >
          <Target className="w-4 h-4" />
          <span>Defended Assets ({scenario.assets.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('sites')}
          className={`flex items-center gap-2 py-3 px-4 font-semibold text-xs transition border-b-2 ${
            activeTab === 'sites'
              ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400'
              : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
          }`}
        >
          <Shield className="w-4 h-4" />
          <span>Candidate Sites ({scenario.sites.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('map')}
          className={`flex items-center gap-2 py-3 px-4 font-semibold text-xs transition border-b-2 ${
            activeTab === 'map'
              ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400'
              : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
          }`}
        >
          <MapIcon className="w-4 h-4" />
          <span>Interactive Map Editor</span>
        </button>

        <button
          onClick={() => setActiveTab('params')}
          className={`flex items-center gap-2 py-3 px-4 font-semibold text-xs transition border-b-2 ${
            activeTab === 'params'
              ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400'
              : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
          }`}
        >
          <Sliders className="w-4 h-4" />
          <span>Parameters & Sizing Form</span>
        </button>

        <button
          onClick={() => setActiveTab('coverage')}
          className={`flex items-center gap-2 py-3 px-4 font-semibold text-xs transition border-b-2 ${
            activeTab === 'coverage'
              ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400'
              : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
          }`}
        >
          <Grid className="w-4 h-4" />
          <span>Coverage Matrix (aᵢⱼ)</span>
        </button>
      </div>

      {/* Tab Panels */}
      <div className="pt-2">
        {activeTab === 'assets' && (
          <AssetsTable
            assets={scenario.assets}
            onChange={updateAssets}
            coordinateMode={scenario.coordinate_mode}
            highValueThreshold={scenario.parameters.high_value_threshold}
          />
        )}

        {activeTab === 'sites' && (
          <SitesTable
            sites={scenario.sites}
            onChange={updateSites}
            coordinateMode={scenario.coordinate_mode}
            depots={scenario.depots || []}
            fallbackDepot={scenario.parameters}
          />
        )}

        {activeTab === 'map' && (
          <MapEditor
            coordinateMode={scenario.coordinate_mode}
            assets={scenario.assets}
            sites={scenario.sites}
            depots={scenario.depots || []}
            onUpdateAsset={(i, a) => {
              const updated = [...scenario.assets];
              updated[i] = a;
              updateAssets(updated);
            }}
            onUpdateSite={(i, s) => {
              const updated = [...scenario.sites];
              updated[i] = s;
              updateSites(updated);
            }}
            onAddAsset={(a) => updateAssets([...scenario.assets, a])}
            onAddSite={(s) => updateSites([...scenario.sites, s])}
            onUpdateDepot={(i, d) => {
              const updatedDepots = [...(scenario.depots || [])];
              updatedDepots[i] = d;
              const updatedSites = scenario.sites.map(s => ({
                ...s,
                depot_distance_km: computeNearestDepotDistance(
                  { lat: s.lat, lon: s.lon, x: s.x, y: s.y },
                  updatedDepots,
                  scenario.coordinate_mode,
                  scenario.parameters
                )
              }));
              onUpdateScenario({ ...scenario, depots: updatedDepots, sites: updatedSites });
            }}
            onAddDepot={(d) => {
              const updatedDepots = [...(scenario.depots || []), d];
              const updatedSites = scenario.sites.map(s => ({
                ...s,
                depot_distance_km: computeNearestDepotDistance(
                  { lat: s.lat, lon: s.lon, x: s.x, y: s.y },
                  updatedDepots,
                  scenario.coordinate_mode,
                  scenario.parameters
                )
              }));
              onUpdateScenario({ ...scenario, depots: updatedDepots, sites: updatedSites });
            }}
            onDeleteDepot={(i) => {
              const updatedDepots = (scenario.depots || []).filter((_, idx) => idx !== i);
              const updatedSites = scenario.sites.map(s => ({
                ...s,
                depot_distance_km: computeNearestDepotDistance(
                  { lat: s.lat, lon: s.lon, x: s.x, y: s.y },
                  updatedDepots,
                  scenario.coordinate_mode,
                  scenario.parameters
                )
              }));
              onUpdateScenario({ ...scenario, depots: updatedDepots, sites: updatedSites });
            }}
          />
        )}

        {activeTab === 'params' && (
          <ParametersForm
            parameters={scenario.parameters}
            onChange={updateParameters}
            coordinateMode={scenario.coordinate_mode}
          />
        )}

        {activeTab === 'coverage' && coverageData && distanceData && (
          <CoverageMatrixView
            scenario={scenario}
            coverageData={coverageData}
            distanceData={distanceData}
            onToggleOverride={handleToggleCoverageOverride}
            onClearOverrides={handleClearOverrides}
          />
        )}
      </div>
    </div>
  );
};
