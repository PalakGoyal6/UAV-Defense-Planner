import React, { useState, useEffect } from 'react';
import { Scenario, FullPlanResponse } from '../types/defense';
import { MapContainer, TileLayer, Marker, Circle, Polyline, Popup, GeoJSON } from 'react-leaflet';
import L from 'leaflet';
import { Layers, Warehouse } from 'lucide-react';
import { INDIA_CENTER, INDIA_DEFAULT_ZOOM, INDIA_MAX_BOUNDS, getLoadedIndiaGeoJson } from '../utils/geo';

const openSiteIcon = new L.Icon({
  iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-green.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41]
});

const closedSiteIcon = new L.Icon({
  iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-grey.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png',
  iconSize: [20, 32],
  iconAnchor: [10, 32],
  popupAnchor: [1, -28],
  shadowSize: [32, 32]
});

const coveredAssetIcon = new L.Icon({
  iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-blue.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png',
  iconSize: [22, 36],
  iconAnchor: [11, 36],
  popupAnchor: [1, -30],
  shadowSize: [36, 36]
});

const uncoveredAssetIcon = new L.Icon({
  iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-red.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png',
  iconSize: [22, 36],
  iconAnchor: [11, 36],
  popupAnchor: [1, -30],
  shadowSize: [36, 36]
});

const depotIcon = new L.Icon({
  iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-gold.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png',
  iconSize: [24, 40],
  iconAnchor: [12, 40],
  popupAnchor: [1, -32],
  shadowSize: [40, 40]
});

interface DeploymentMapViewProps {
  scenario: Scenario;
  plan: FullPlanResponse;
}

export const DeploymentMapView: React.FC<DeploymentMapViewProps> = ({ scenario, plan }) => {
  const coordMode = scenario.coordinate_mode;
  const openedSitesSet = new Set(plan.location.opened_sites);
  const assetMap = new Map(scenario.assets.map(a => [a.id, a]));
  const siteMap = new Map(scenario.sites.map(s => [s.id, s]));

  // Layer switches
  const [showOsmTiles, setShowOsmTiles] = useState(true);
  const [showStateBorders, setShowStateBorders] = useState(true);
  const [showAssets, setShowAssets] = useState(true);
  const [showSites, setShowSites] = useState(true);
  const [showCircles, setShowCircles] = useState(true);
  const [showLines, setShowLines] = useState(true);
  const [showDepots, setShowDepots] = useState(true);
  const [layerDropdownOpen, setLayerDropdownOpen] = useState(false);

  // GeoJSON data
  const [geoJsonData, setGeoJsonData] = useState<any>(null);

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

  // Grid SVG computations
  const allX = [...scenario.assets.map(a => a.x ?? 0), ...scenario.sites.map(s => s.x ?? 0), 0];
  const allY = [...scenario.assets.map(a => a.y ?? 0), ...scenario.sites.map(s => s.y ?? 0), 0];
  const maxX = Math.max(...allX, 10) + 2;
  const maxY = Math.max(...allY, 10) + 2;

  const svgWidth = 650;
  const svgHeight = 650;
  const padding = 50;
  const plotWidth = svgWidth - 2 * padding;
  const plotHeight = svgHeight - 2 * padding;

  const toSvgX = (x: number) => padding + (x / maxX) * plotWidth;
  const toSvgY = (y: number) => svgHeight - padding - (y / maxY) * plotHeight;
  const scaleRadius = (rKm: number) => (rKm / maxX) * plotWidth;

  return (
    <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-4 shadow-xs space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3 pb-2 border-b border-slate-100 dark:border-slate-800">
        <div>
          <h4 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
            Defense Deployment & Protection Map
          </h4>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Green = Open Defense Sites &bull; Grey = Unopened Candidate Sites &bull; Blue = Covered Assets &bull; Red = Uncovered
          </p>
        </div>

        <div className="flex items-center gap-3 text-xs">
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500"></span>
            <span>Open Sites ({plan.location.opened_sites.length})</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-rose-500"></span>
            <span>Uncovered ({plan.location.uncovered_assets.length})</span>
          </div>

          {/* Layer Controls Dropdown */}
          {coordMode === 'geo' && (
            <div className="relative ml-2">
              <button
                onClick={() => setLayerDropdownOpen(!layerDropdownOpen)}
                className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 transition"
              >
                <Layers className="w-3.5 h-3.5 text-indigo-500" />
                <span>Layers</span>
              </button>

              {layerDropdownOpen && (
                <div className="absolute right-0 mt-2 w-52 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-lg p-3 z-50 space-y-2 text-xs">
                  <div className="font-semibold text-slate-700 dark:text-slate-200 border-b border-slate-100 dark:border-slate-700 pb-1">
                    Map Layers
                  </div>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={showOsmTiles}
                      onChange={(e) => setShowOsmTiles(e.target.checked)}
                      className="rounded text-indigo-600"
                    />
                    <span>OSM Base Tiles</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={showStateBorders}
                      onChange={(e) => setShowStateBorders(e.target.checked)}
                      className="rounded text-indigo-600"
                    />
                    <span>State Boundaries</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={showAssets}
                      onChange={(e) => setShowAssets(e.target.checked)}
                      className="rounded text-indigo-600"
                    />
                    <span>Assets</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={showSites}
                      onChange={(e) => setShowSites(e.target.checked)}
                      className="rounded text-indigo-600"
                    />
                    <span>Candidate Sites</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={showCircles}
                      onChange={(e) => setShowCircles(e.target.checked)}
                      className="rounded text-indigo-600"
                    />
                    <span>Coverage Circles</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={showLines}
                      onChange={(e) => setShowLines(e.target.checked)}
                      className="rounded text-indigo-600"
                    />
                    <span>Assignment Lines</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={showDepots}
                      onChange={(e) => setShowDepots(e.target.checked)}
                      className="rounded text-indigo-600"
                    />
                    <span>Resupply Depots</span>
                  </label>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {coordMode === 'grid' ? (
        <div className="flex justify-center items-center overflow-auto select-none py-2">
          <svg viewBox={`0 0 ${svgWidth} ${svgHeight}`} className="w-full max-w-[650px] aspect-square">
            <rect width={svgWidth} height={svgHeight} className="fill-slate-50 dark:fill-slate-950" />

            {/* Grid Lines */}
            {Array.from({ length: Math.ceil(maxX) + 1 }).map((_, i) => (
              <g key={`dl-x-${i}`}>
                <line
                  x1={toSvgX(i)}
                  y1={padding}
                  x2={toSvgX(i)}
                  y2={svgHeight - padding}
                  className="stroke-slate-200 dark:stroke-slate-800"
                  strokeWidth={i === 0 ? 2 : 1}
                />
                <text x={toSvgX(i)} y={svgHeight - padding + 15} textAnchor="middle" className="text-[10px] fill-slate-400 font-mono">
                  {i}
                </text>
              </g>
            ))}

            {Array.from({ length: Math.ceil(maxY) + 1 }).map((_, i) => (
              <g key={`dl-y-${i}`}>
                <line
                  x1={padding}
                  y1={toSvgY(i)}
                  x2={svgWidth - padding}
                  y2={toSvgY(i)}
                  className="stroke-slate-200 dark:stroke-slate-800"
                  strokeWidth={i === 0 ? 2 : 1}
                />
                <text x={padding - 10} y={toSvgY(i) + 3} textAnchor="end" className="text-[10px] fill-slate-400 font-mono">
                  {i}
                </text>
              </g>
            ))}

            {/* Assignment Lines */}
            {plan.location.assignments.map(assign => {
              if (!assign.covered || !assign.site_id) return null;
              const a = assetMap.get(assign.asset_id);
              const s = siteMap.get(assign.site_id);
              if (!a || !s || a.x == null || a.y == null || s.x == null || s.y == null) return null;

              return (
                <line
                  key={`line-${a.id}-${s.id}`}
                  x1={toSvgX(s.x)}
                  y1={toSvgY(s.y)}
                  x2={toSvgX(a.x)}
                  y2={toSvgY(a.y)}
                  stroke="#3b82f6"
                  strokeWidth={1.5}
                  strokeDasharray="4 2"
                  opacity={0.8}
                />
              );
            })}

            {/* Open Sites Range Circles */}
            {scenario.sites.map(s => {
              const isOpen = openedSitesSet.has(s.id);
              if (!isOpen || s.x == null || s.y == null) return null;
              return (
                <circle
                  key={`circ-${s.id}`}
                  cx={toSvgX(s.x)}
                  cy={toSvgY(s.y)}
                  r={scaleRadius(s.range_km)}
                  fill="rgba(16, 185, 129, 0.08)"
                  stroke="#10b981"
                  strokeWidth={1.5}
                  strokeDasharray="4 2"
                />
              );
            })}

            {/* Sites */}
            {scenario.sites.map(s => {
              const isOpen = openedSitesSet.has(s.id);
              const sx = toSvgX(s.x ?? 0);
              const sy = toSvgY(s.y ?? 0);

              return (
                <g key={`site-marker-${s.id}`}>
                  <circle
                    cx={sx}
                    cy={sy}
                    r={10}
                    className={`${isOpen ? 'fill-emerald-500 stroke-white' : 'fill-slate-400 stroke-white'} stroke-2 drop-shadow-sm`}
                  />
                  <text x={sx} y={sy + 3.5} textAnchor="middle" className="text-[9px] font-bold fill-white font-mono">
                    {s.id}
                  </text>
                </g>
              );
            })}

            {/* Depots */}
            {(scenario.depots || []).map(d => {
              const dx = toSvgX(d.x ?? 0);
              const dy = toSvgY(d.y ?? 0);
              return (
                <g key={`depot-marker-${d.id}`}>
                  <polygon
                    points={`${dx},${dy - 10} ${dx + 10},${dy} ${dx},${dy + 10} ${dx - 10},${dy}`}
                    className="fill-amber-500 stroke-white stroke-2 drop-shadow-sm"
                  />
                  <text x={dx} y={dy + 3.5} textAnchor="middle" className="text-[9px] font-bold fill-white font-mono">
                    {d.id}
                  </text>
                </g>
              );
            })}

            {/* Assets */}
            {scenario.assets.map(a => {
              const isCovered = plan.location.assignments.find(as => as.asset_id === a.id)?.covered;
              const ax = toSvgX(a.x ?? 0);
              const ay = toSvgY(a.y ?? 0);

              return (
                <g key={`asset-marker-${a.id}`}>
                  <circle
                    cx={ax}
                    cy={ay}
                    r={8}
                    className={`${isCovered ? 'fill-blue-600 stroke-white' : 'fill-rose-600 stroke-white ring-2 ring-rose-400'} stroke-2 drop-shadow-sm`}
                  />
                  <text x={ax} y={ay - 11} textAnchor="middle" className="text-[10px] font-bold fill-slate-800 dark:fill-slate-200 font-mono">
                    {a.id}
                  </text>
                </g>
              );
            })}
          </svg>
        </div>
      ) : (
        /* Geographic Leaflet Mode (Opens on India) */
        <div className="h-[520px] w-full rounded-xl overflow-hidden bg-slate-900 relative">
          <MapContainer
            center={INDIA_CENTER}
            zoom={INDIA_DEFAULT_ZOOM}
            minZoom={4}
            maxBounds={INDIA_MAX_BOUNDS}
            style={{ height: '100%', width: '100%' }}
          >
            {showOsmTiles && (
              <TileLayer
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                attribution='&copy; OpenStreetMap'
              />
            )}

            {/* State Boundaries with Tooltips */}
            {showStateBorders && geoJsonData && (
              <GeoJSON
                key="india-states-borders-results"
                data={geoJsonData}
                style={() => ({
                  fillColor: '#334155',
                  fillOpacity: showOsmTiles ? 0.05 : 0.35,
                  weight: 1.2,
                  opacity: 0.8,
                  color: '#6366f1',
                  dashArray: '2,2'
                })}
                onEachFeature={(feature, layer) => {
                  const name = feature.properties?.state_name || 'State';
                  layer.bindTooltip(name, {
                    permanent: false,
                    direction: 'center',
                    className: 'bg-slate-900 text-white text-[11px] font-sans px-2 py-0.5 rounded shadow'
                  });
                }}
              />
            )}

            {/* Connection Polylines */}
            {showLines && plan.location.assignments.map(assign => {
              if (!assign.covered || !assign.site_id) return null;
              const a = assetMap.get(assign.asset_id);
              const s = siteMap.get(assign.site_id);
              if (!a || !s || a.lat == null || a.lon == null || s.lat == null || s.lon == null) return null;

              return (
                <Polyline
                  key={`geo-line-${a.id}-${s.id}`}
                  positions={[[a.lat, a.lon], [s.lat, s.lon]]}
                  pathOptions={{ color: '#3b82f6', weight: 2, dashArray: '5,5' }}
                />
              );
            })}

            {/* Open & Closed Sites */}
            {showSites && scenario.sites.map(s => {
              const isOpen = openedSitesSet.has(s.id);
              if (s.lat == null || s.lon == null) return null;

              return (
                <React.Fragment key={`dep-geo-site-${s.id}`}>
                  {isOpen && showCircles && (
                    <Circle
                      center={[s.lat, s.lon]}
                      radius={(s.range_km || 5) * 1000}
                      pathOptions={{ color: '#10b981', fillColor: '#10b981', fillOpacity: 0.1, dashArray: '4,4' }}
                    />
                  )}
                  <Marker position={[s.lat, s.lon]} icon={isOpen ? openSiteIcon : closedSiteIcon}>
                    <Popup>
                      <div className="text-xs">
                        <strong>{s.name} ({s.id})</strong>
                        <div>Status: <span className={isOpen ? 'text-emerald-600 font-bold' : 'text-slate-500'}>{isOpen ? 'OPENED' : 'Closed'}</span></div>
                        <div>Cost: ₹{s.cost}</div>
                        <div>Region: {s.region || 'Unassigned'}</div>
                        {isOpen && plan.channels.site_channels[s.id] && (
                          <div>Channels: {plan.channels.site_channels[s.id].channels_allocated}</div>
                        )}
                        {isOpen && plan.inventory.site_inventory[s.id] && (
                          <div>Stock (Q): {plan.inventory.site_inventory[s.id].allocated_stock_Q} units</div>
                        )}
                      </div>
                    </Popup>
                  </Marker>
                </React.Fragment>
              );
            })}

            {/* Depots */}
            {showDepots && (scenario.depots || []).map(d => {
              if (d.lat == null || d.lon == null) return null;
              return (
                <Marker key={`dep-geo-depot-${d.id}`} position={[d.lat, d.lon]} icon={depotIcon}>
                  <Popup>
                    <div className="text-xs">
                      <strong className="text-amber-600 font-bold">{d.name} ({d.id})</strong>
                      <div>Logistics Resupply Depot</div>
                    </div>
                  </Popup>
                </Marker>
              );
            })}

            {/* Assets */}
            {showAssets && scenario.assets.map(a => {
              const isCovered = plan.location.assignments.find(as => as.asset_id === a.id)?.covered;
              if (a.lat == null || a.lon == null) return null;

              return (
                <Marker key={`dep-geo-asset-${a.id}`} position={[a.lat, a.lon]} icon={isCovered ? coveredAssetIcon : uncoveredAssetIcon}>
                  <Popup>
                    <div className="text-xs">
                      <strong>{a.name} ({a.id})</strong>
                      <div>Value: {a.value}</div>
                      <div>Threat: {a.threat_rate}/min</div>
                      <div>Region: {a.region || 'Unassigned'}</div>
                      <div>Status: <span className={isCovered ? 'text-blue-600 font-bold' : 'text-rose-600 font-bold'}>{isCovered ? 'Covered' : 'UNCOVERED'}</span></div>
                    </div>
                  </Popup>
                </Marker>
              );
            })}
          </MapContainer>
        </div>
      )}
    </div>
  );
};
