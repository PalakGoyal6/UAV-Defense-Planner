import React, { useState, useEffect, useRef } from 'react';
import { Scenario, FullPlanResponse, RegionResult } from '../types/defense';
import { MapContainer, TileLayer, GeoJSON, useMap } from 'react-leaflet';
import L from 'leaflet';
import {
  Shield, Target, Layers, DollarSign, Activity, Package,
  ExternalLink, X, ChevronRight, AlertTriangle, CheckCircle, Info
} from 'lucide-react';
import { INDIA_CENTER, INDIA_DEFAULT_ZOOM, INDIA_MAX_BOUNDS, getLoadedIndiaGeoJson } from '../utils/geo';

type MetricKey =
  | 'pct_value_protected'
  | 'num_assets'
  | 'num_opened_sites'
  | 'total_site_cost'
  | 'worst_leak_probability';

interface MetricOption {
  key: MetricKey;
  label: string;
  unit: string;
  bins: number[];
  colors: string[];
}

const METRICS: MetricOption[] = [
  {
    key: 'pct_value_protected',
    label: '% Asset Value Protected',
    unit: '%',
    bins: [25, 50, 75, 90],
    colors: ['#fee2e2', '#fde68a', '#a7f3d0', '#34d399', '#059669']
  },
  {
    key: 'num_assets',
    label: 'Number of Assets',
    unit: 'assets',
    bins: [1, 3, 6, 10],
    colors: ['#e0f2fe', '#bae6fd', '#7dd3fc', '#38bdf8', '#0284c7']
  },
  {
    key: 'num_opened_sites',
    label: 'Open Sites',
    unit: 'sites',
    bins: [1, 2, 4, 6],
    colors: ['#ede9fe', '#ddd6fe', '#c4b5fd', '#a78bfa', '#7c3aed']
  },
  {
    key: 'total_site_cost',
    label: 'Total Cost',
    unit: '₹',
    bins: [20, 50, 100, 200],
    colors: ['#ccfbf1', '#99f6e4', '#5eead4', '#2dd4bf', '#0d9488']
  },
  {
    key: 'worst_leak_probability',
    label: 'Worst Leak Probability',
    unit: '',
    bins: [0.01, 0.03, 0.05, 0.10],
    colors: ['#dcfce7', '#fef9c3', '#fed7aa', '#fecaca', '#ef4444']
  }
];

function getFeatureColor(
  metricKey: MetricKey,
  val: number,
  hasAssets: boolean
): string {
  if (!hasAssets) return '#334155'; // Greyed out for states with 0 assets
  const opt = METRICS.find(m => m.key === metricKey)!;
  for (let i = 0; i < opt.bins.length; i++) {
    if (val <= opt.bins[i]) return opt.colors[i];
  }
  return opt.colors[opt.colors.length - 1];
}

interface IndiaOverviewPageProps {
  scenario: Scenario;
  plan: FullPlanResponse | null;
  onOpenInResults: (region?: string) => void;
}

// Controller to zoom to bounds
const ZoomController: React.FC<{ bounds: L.LatLngBounds | null }> = ({ bounds }) => {
  const map = useMap();
  useEffect(() => {
    if (bounds) {
      map.fitBounds(bounds, { padding: [40, 40], maxZoom: 8, animate: true });
    }
  }, [bounds, map]);
  return null;
};

export const IndiaOverviewPage: React.FC<IndiaOverviewPageProps> = ({
  scenario,
  plan,
  onOpenInResults
}) => {
  const [geoJsonData, setGeoJsonData] = useState<any>(null);
  const [selectedMetric, setSelectedMetric] = useState<MetricKey>('pct_value_protected');
  const [selectedRegion, setSelectedRegion] = useState<string | null>(null);
  const [zoomBounds, setZoomBounds] = useState<L.LatLngBounds | null>(null);

  useEffect(() => {
    let mounted = true;
    getLoadedIndiaGeoJson()
      .then(data => {
        if (mounted) setGeoJsonData(data);
      })
      .catch(() => {});
    return () => {
      mounted = false;
    };
  }, []);

  const resultsByRegion = plan?.results_by_region || {};
  const activeMetricOpt = METRICS.find(m => m.key === selectedMetric)!;

  // Selected region result object
  const activeRegionResult: RegionResult | undefined = selectedRegion
    ? resultsByRegion[selectedRegion]
    : undefined;

  // Sites in selected region
  const regionSites = selectedRegion
    ? scenario.sites.filter(s => (s.region || 'Outside India') === selectedRegion)
    : [];

  // Assets in selected region
  const regionAssets = selectedRegion
    ? scenario.assets.filter(a => (a.region || 'Outside India') === selectedRegion)
    : [];

  return (
    <div className="flex flex-col h-full space-y-4 max-w-7xl mx-auto">
      {/* 1. All-India Top Summary Strip */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 shrink-0">
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-3 shadow-xs">
          <div className="text-[11px] text-slate-500 font-medium flex items-center gap-1">
            <Target className="w-3.5 h-3.5 text-indigo-500" /> All-India Protected
          </div>
          <div className="text-xl font-extrabold text-slate-900 dark:text-slate-100 mt-1">
            {plan ? `${plan.location.pct_value_protected}%` : 'N/A'}
          </div>
          <div className="text-[10px] text-slate-400 font-mono mt-0.5">
            {plan ? `₹${plan.location.total_value_protected.toLocaleString()} / ₹${plan.location.total_possible_value.toLocaleString()}` : `${scenario.assets.length} assets`}
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-3 shadow-xs">
          <div className="text-[11px] text-slate-500 font-medium flex items-center gap-1">
            <Shield className="w-3.5 h-3.5 text-emerald-500" /> Sites Opened
          </div>
          <div className="text-xl font-extrabold text-emerald-600 dark:text-emerald-400 mt-1">
            {plan ? plan.location.opened_sites.length : 0}
            <span className="text-xs text-slate-400 font-normal"> / {scenario.sites.length}</span>
          </div>
          <div className="text-[10px] text-slate-400 font-mono mt-0.5">
            {plan ? `Cost ₹${plan.location.total_site_cost} (Budget ₹${plan.location.budget})` : 'Candidate locations'}
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-3 shadow-xs">
          <div className="text-[11px] text-slate-500 font-medium flex items-center gap-1">
            <Layers className="w-3.5 h-3.5 text-blue-500" /> Channels
          </div>
          <div className="text-xl font-extrabold text-blue-600 dark:text-blue-400 mt-1">
            {plan ? plan.channels.total_channels : 0}
          </div>
          <div className="text-[10px] text-slate-400 font-mono mt-0.5">
            Erlang-B multi-server capacity
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-3 shadow-xs">
          <div className="text-[11px] text-slate-500 font-medium flex items-center gap-1">
            <Activity className="w-3.5 h-3.5 text-rose-500" /> Worst Leak Prob
          </div>
          <div className="text-xl font-extrabold text-slate-900 dark:text-slate-100 mt-1">
            {plan ? plan.channels.worst_site_leak_prob.toFixed(4) : 'N/A'}
          </div>
          <div className="text-[10px] text-slate-400 font-mono mt-0.5">
            Target α: {scenario.parameters.target_leak_probability}
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-3 shadow-xs">
          <div className="text-[11px] text-slate-500 font-medium flex items-center gap-1">
            <Package className="w-3.5 h-3.5 text-purple-500" /> Stock Q*
          </div>
          <div className="text-xl font-extrabold text-purple-600 dark:text-purple-400 mt-1">
            {plan ? plan.inventory.total_stock_Q_star : 0}
          </div>
          <div className="text-[10px] text-slate-400 font-mono mt-0.5">
            Newsvendor interceptors
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-3 shadow-xs">
          <div className="text-[11px] text-slate-500 font-medium flex items-center gap-1">
            <Shield className="w-3.5 h-3.5 text-amber-500" /> Reserve y₁*
          </div>
          <div className="text-xl font-extrabold text-amber-600 dark:text-amber-400 mt-1">
            {plan ? plan.reserve.reserve_y1_star : 0}
          </div>
          <div className="text-[10px] text-slate-400 font-mono mt-0.5">
            Littlewood high-value units
          </div>
        </div>
      </div>

      {/* 2. Map Controls Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-white dark:bg-slate-900 p-3 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs shrink-0">
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">
            Choropleth Metric:
          </span>
          <select
            value={selectedMetric}
            onChange={(e) => setSelectedMetric(e.target.value as MetricKey)}
            className="px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 dark:bg-slate-800 text-xs font-semibold text-indigo-700 dark:text-indigo-400 shadow-xs"
          >
            {METRICS.map(m => (
              <option key={m.key} value={m.key}>
                {m.label}
              </option>
            ))}
          </select>
        </div>

        {/* Legend */}
        <div className="flex items-center gap-2 text-xs">
          <span className="text-[11px] text-slate-500 font-medium">Legend:</span>
          <div className="flex items-center gap-1">
            <span className="w-3 h-3 rounded-xs bg-[#334155] opacity-40 inline-block border border-slate-400" />
            <span className="text-[10px] text-slate-400 mr-2">No Assets</span>
            {activeMetricOpt.colors.map((c, i) => (
              <div key={i} className="flex items-center gap-1">
                <span className="w-3.5 h-3 rounded-xs inline-block" style={{ backgroundColor: c }} />
                <span className="text-[10px] text-slate-500 font-mono">
                  {i === 0 ? `≤${activeMetricOpt.bins[0]}` : i === activeMetricOpt.colors.length - 1 ? `>${activeMetricOpt.bins[activeMetricOpt.bins.length - 1]}` : `≤${activeMetricOpt.bins[i]}`}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* 3. Main Full-Screen Map Canvas with Interactive Side-Panel */}
      <div className="flex-1 min-h-[550px] relative rounded-2xl overflow-hidden border border-slate-200 dark:border-slate-800 shadow-xs bg-slate-950">
        <MapContainer
          center={INDIA_CENTER}
          zoom={INDIA_DEFAULT_ZOOM}
          minZoom={4}
          maxBounds={INDIA_MAX_BOUNDS}
          style={{ height: '100%', width: '100%' }}
        >
          <TileLayer
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            attribution='&copy; OpenStreetMap'
            opacity={0.35}
          />

          <ZoomController bounds={zoomBounds} />

          {geoJsonData && (
            <GeoJSON
              key={`india-choropleth-${selectedMetric}`}
              data={geoJsonData}
              style={(feature) => {
                const stName = feature?.properties?.state_name;
                const r = resultsByRegion[stName];
                const hasAssets = (r && r.num_assets > 0);
                const val = r ? (r[selectedMetric as keyof RegionResult] as number) || 0 : 0;
                const fill = getFeatureColor(selectedMetric, val, hasAssets);

                const isSelected = selectedRegion === stName;

                return {
                  fillColor: fill,
                  fillOpacity: hasAssets ? (isSelected ? 0.9 : 0.75) : 0.2,
                  weight: isSelected ? 2.5 : 1.2,
                  opacity: 1,
                  color: isSelected ? '#ffffff' : '#6366f1',
                  dashArray: hasAssets ? undefined : '2,2'
                };
              }}
              onEachFeature={(feature, layer) => {
                const stName = feature.properties?.state_name || 'State';
                const r = resultsByRegion[stName];
                const assetsCount = r?.num_assets ?? 0;
                const sitesOpened = r?.num_opened_sites ?? 0;
                const protPct = r?.pct_value_protected ?? 0;
                const channelsCount = r?.total_channels ?? 0;
                const stockQ = r?.allocated_stock_Q ?? 0;
                const reserveUnits = r?.reserve_y1 ?? 0;

                // Hover Tooltip: assets, sites opened, value protected %, channels, stock, reserve
                layer.bindTooltip(
                  `<div class="p-1 text-xs font-sans">
                    <div class="font-bold text-sm text-indigo-400 mb-1">${stName}</div>
                    <div>&bull; Assets: <b>${assetsCount}</b></div>
                    <div>&bull; Sites Opened: <b>${sitesOpened}</b></div>
                    <div>&bull; Value Protected: <b>${protPct}%</b></div>
                    <div>&bull; Channels: <b>${channelsCount}</b></div>
                    <div>&bull; Stock (Q*): <b>${stockQ}</b></div>
                    <div>&bull; Reserve (y₁*): <b>${reserveUnits}</b></div>
                  </div>`,
                  {
                    sticky: true,
                    className: 'bg-slate-900/95 text-white border border-slate-700 rounded-xl shadow-lg'
                  }
                );

                layer.on({
                  click: (e) => {
                    setSelectedRegion(stName);
                    setZoomBounds(e.target.getBounds());
                  }
                });
              }}
            />
          )}
        </MapContainer>

        {/* 4. Sliding / Floating Side-Panel for Clicked Region */}
        {selectedRegion && (
          <div className="absolute top-3 right-3 bottom-3 w-96 max-w-[90vw] bg-white/95 dark:bg-slate-900/95 backdrop-blur-md rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xl p-4 z-[1000] overflow-y-auto space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <div>
                <h3 className="text-base font-extrabold text-slate-900 dark:text-slate-100">
                  {selectedRegion}
                </h3>
                <span className="text-[11px] text-indigo-600 dark:text-indigo-400 font-medium">
                  Regional Defense Sub-Plan
                </span>
              </div>
              <button
                onClick={() => setSelectedRegion(null)}
                className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl text-slate-400 transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {activeRegionResult && activeRegionResult.num_assets > 0 ? (
              <div className="space-y-4 text-xs">
                {/* Region KPI Grid */}
                <div className="grid grid-cols-2 gap-2">
                  <div className="p-2.5 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-100 dark:border-slate-700">
                    <span className="text-[10px] text-slate-400">Value Protected</span>
                    <div className="text-base font-bold text-emerald-600 dark:text-emerald-400">
                      {activeRegionResult.pct_value_protected}%
                    </div>
                    <span className="text-[9px] text-slate-400 font-mono">
                      ₹{activeRegionResult.value_protected} / ₹{activeRegionResult.total_asset_value}
                    </span>
                  </div>

                  <div className="p-2.5 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-100 dark:border-slate-700">
                    <span className="text-[10px] text-slate-400">Sites Opened</span>
                    <div className="text-base font-bold text-slate-800 dark:text-slate-200">
                      {activeRegionResult.num_opened_sites}
                      <span className="text-xs text-slate-400 font-normal"> / {regionSites.length}</span>
                    </div>
                    <span className="text-[9px] text-slate-400 font-mono">
                      Cost: ₹{activeRegionResult.total_site_cost}
                    </span>
                  </div>

                  <div className="p-2.5 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-100 dark:border-slate-700">
                    <span className="text-[10px] text-slate-400">Channels</span>
                    <div className="text-base font-bold text-blue-600 dark:text-blue-400">
                      {activeRegionResult.total_channels}
                    </div>
                    <span className="text-[9px] text-slate-400 font-mono">
                      Worst Leak: {activeRegionResult.worst_leak_probability}
                    </span>
                  </div>

                  <div className="p-2.5 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-100 dark:border-slate-700">
                    <span className="text-[10px] text-slate-400">Stock & Reserve</span>
                    <div className="text-base font-bold text-purple-600 dark:text-purple-400">
                      {activeRegionResult.allocated_stock_Q} <span className="text-xs text-amber-500 font-normal">(Res: {activeRegionResult.reserve_y1})</span>
                    </div>
                    <span className="text-[9px] text-slate-400 font-mono">
                      Q* units allocated
                    </span>
                  </div>
                </div>

                {/* Step Cards Breakdown for this Region */}
                <div className="space-y-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                  <div className="font-semibold text-slate-700 dark:text-slate-300">
                    Regional Step Details:
                  </div>

                  {/* Step 1 Details */}
                  <div className="p-2.5 bg-indigo-50/50 dark:bg-indigo-950/30 rounded-xl border border-indigo-100 dark:border-indigo-900/50 space-y-1">
                    <div className="font-bold text-indigo-700 dark:text-indigo-300 flex items-center justify-between">
                      <span>Step 1: MCLP Placement</span>
                      <span className="text-[10px] font-mono">{activeRegionResult.opened_sites.length} Opened</span>
                    </div>
                    <div className="text-[11px] text-slate-600 dark:text-slate-400">
                      Sites: {activeRegionResult.opened_sites.join(', ') || 'None'}
                    </div>
                    <div className="text-[11px] text-slate-600 dark:text-slate-400">
                      Covered Assets: {activeRegionResult.covered_asset_ids.join(', ') || 'None'}
                    </div>
                    {activeRegionResult.uncovered_asset_ids.length > 0 && (
                      <div className="text-[11px] text-rose-500 font-medium">
                        Uncovered: {activeRegionResult.uncovered_asset_ids.join(', ')}
                      </div>
                    )}
                  </div>

                  {/* Step 3 Details */}
                  <div className="p-2.5 bg-blue-50/50 dark:bg-blue-950/30 rounded-xl border border-blue-100 dark:border-blue-900/50 space-y-1">
                    <div className="font-bold text-blue-700 dark:text-blue-300">
                      Step 3: Channels & Queueing
                    </div>
                    <div className="text-[11px] text-slate-600 dark:text-slate-400">
                      Installed {activeRegionResult.total_channels} channels across open regional sites.
                    </div>
                  </div>

                  {/* Step 4 & 5 Details */}
                  <div className="p-2.5 bg-purple-50/50 dark:bg-purple-950/30 rounded-xl border border-purple-100 dark:border-purple-900/50 space-y-1">
                    <div className="font-bold text-purple-700 dark:text-purple-300">
                      Step 4 & 5: Inventory & Reserve
                    </div>
                    <div className="text-[11px] text-slate-600 dark:text-slate-400">
                      Stock: {activeRegionResult.allocated_stock_Q} units | Reserve: {activeRegionResult.reserve_y1} high-priority units.
                    </div>
                  </div>
                </div>

                {/* Open in Results Button */}
                <button
                  onClick={() => onOpenInResults(selectedRegion)}
                  className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-semibold shadow-md transition flex items-center justify-center gap-1.5"
                >
                  <span>Open in Results</span>
                  <ExternalLink className="w-3.5 h-3.5" />
                </button>
              </div>
            ) : (
              <div className="py-8 text-center text-slate-400 space-y-2">
                <Info className="w-8 h-8 mx-auto text-slate-300 dark:text-slate-700" />
                <p className="text-xs font-medium text-slate-600 dark:text-slate-300">
                  No Assets Deployed
                </p>
                <p className="text-[11px] text-slate-400">
                  This state currently has no defense assets or candidate sites assigned.
                </p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
