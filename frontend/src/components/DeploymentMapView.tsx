import React from 'react';
import { Scenario, FullPlanResponse } from '../types/defense';
import { MapContainer, TileLayer, Marker, Circle, Polyline, Popup } from 'react-leaflet';
import L from 'leaflet';

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

interface DeploymentMapViewProps {
  scenario: Scenario;
  plan: FullPlanResponse;
}

export const DeploymentMapView: React.FC<DeploymentMapViewProps> = ({ scenario, plan }) => {
  const coordMode = scenario.coordinate_mode;
  const openedSitesSet = new Set(plan.location.opened_sites);
  const assetMap = new Map(scenario.assets.map(a => [a.id, a]));
  const siteMap = new Map(scenario.sites.map(s => [s.id, s]));

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
        </div>
      </div>

      {coordMode === 'grid' ? (
        <div className="flex justify-center items-center overflow-auto select-none py-2">
          <svg viewBox={`0 0 ${svgWidth} ${svgHeight}`} className="w-full max-w-[650px] aspect-square">
            <rect width={svgWidth} height={svgHeight} className="fill-slate-50 dark:fill-slate-950" />

            {/* Grid Lines */}
            {Array.from({ length: Math.ceil(maxX) + 1 }).map((_, i) => (
              <g key={`dl-x-${i}`}>
                <line x1={toSvgX(i)} y1={padding} x2={toSvgX(i)} y2={svgHeight - padding} className="stroke-slate-200 dark:stroke-slate-800" strokeDasharray="2,2" />
                <text x={toSvgX(i)} y={svgHeight - padding + 15} textAnchor="middle" className="text-[10px] fill-slate-400 font-mono">{i}</text>
              </g>
            ))}
            {Array.from({ length: Math.ceil(maxY) + 1 }).map((_, i) => (
              <g key={`dl-y-${i}`}>
                <line x1={padding} y1={toSvgY(i)} x2={svgWidth - padding} y2={toSvgY(i)} className="stroke-slate-200 dark:stroke-slate-800" strokeDasharray="2,2" />
                <text x={padding - 10} y={toSvgY(i) + 3} textAnchor="end" className="text-[10px] fill-slate-400 font-mono">{i}</text>
              </g>
            ))}

            {/* Range Circles for Open Sites */}
            {scenario.sites.map(s => {
              const isOpen = openedSitesSet.has(s.id);
              if (!isOpen) return null;
              return (
                <circle
                  key={`open-range-${s.id}`}
                  cx={toSvgX(s.x ?? 0)}
                  cy={toSvgY(s.y ?? 0)}
                  r={scaleRadius(s.range_km)}
                  fill="rgba(16, 185, 129, 0.08)"
                  stroke="#10b981"
                  strokeWidth="1.5"
                  strokeDasharray="4 2"
                />
              );
            })}

            {/* Assignment Connection Lines from Asset to Site */}
            {plan.location.assignments.map(assign => {
              if (!assign.covered || !assign.site_id) return null;
              const a = assetMap.get(assign.asset_id);
              const s = siteMap.get(assign.site_id);
              if (!a || !s) return null;

              return (
                <line
                  key={`line-${a.id}-${s.id}`}
                  x1={toSvgX(a.x ?? 0)}
                  y1={toSvgY(a.y ?? 0)}
                  x2={toSvgX(s.x ?? 0)}
                  y2={toSvgY(s.y ?? 0)}
                  stroke="#3b82f6"
                  strokeWidth="2"
                  strokeDasharray="3 3"
                  opacity="0.8"
                />
              );
            })}

            {/* Sites (Open vs Closed) */}
            {scenario.sites.map(s => {
              const isOpen = openedSitesSet.has(s.id);
              const sx = toSvgX(s.x ?? 0);
              const sy = toSvgY(s.y ?? 0);

              return (
                <g key={`dep-site-${s.id}`}>
                  <polygon
                    points={`${sx},${sy - 12} ${sx + 11},${sy + 9} ${sx - 11},${sy + 9}`}
                    className={`${isOpen ? 'fill-emerald-600 stroke-emerald-200' : 'fill-slate-400 stroke-slate-200'} stroke-2 drop-shadow-sm`}
                  />
                  <text x={sx} y={sy + 22} textAnchor="middle" className={`text-[10px] font-bold font-mono ${isOpen ? 'fill-emerald-700 dark:fill-emerald-300' : 'fill-slate-400'}`}>
                    {s.id}
                  </text>
                </g>
              );
            })}

            {/* Assets (Covered vs Uncovered) */}
            {scenario.assets.map(a => {
              const isCovered = plan.location.assignments.find(as => as.asset_id === a.id)?.covered;
              const ax = toSvgX(a.x ?? 0);
              const ay = toSvgY(a.y ?? 0);

              return (
                <g key={`dep-asset-${a.id}`}>
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
        /* Geographic Leaflet Mode */
        <div className="h-[500px] w-full rounded-xl overflow-hidden">
          <MapContainer
            center={[
              scenario.assets[0]?.lat ?? scenario.sites[0]?.lat ?? 28.6139,
              scenario.assets[0]?.lon ?? scenario.sites[0]?.lon ?? 77.2090
            ]}
            zoom={10}
            style={{ height: '100%', width: '100%' }}
          >
            <TileLayer
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              attribution='&copy; OpenStreetMap'
            />

            {/* Connection Polylines */}
            {plan.location.assignments.map(assign => {
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

            {/* Open Sites with Circles */}
            {scenario.sites.map(s => {
              const isOpen = openedSitesSet.has(s.id);
              if (s.lat == null || s.lon == null) return null;

              return (
                <React.Fragment key={`dep-geo-site-${s.id}`}>
                  {isOpen && (
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
                        <div>Status: {isOpen ? 'OPENED' : 'Closed'}</div>
                        <div>Cost: ₹{s.cost}</div>
                      </div>
                    </Popup>
                  </Marker>
                </React.Fragment>
              );
            })}

            {/* Assets */}
            {scenario.assets.map(a => {
              const isCovered = plan.location.assignments.find(as => as.asset_id === a.id)?.covered;
              if (a.lat == null || a.lon == null) return null;

              return (
                <Marker key={`dep-geo-asset-${a.id}`} position={[a.lat, a.lon]} icon={isCovered ? coveredAssetIcon : uncoveredAssetIcon}>
                  <Popup>
                    <div className="text-xs">
                      <strong>{a.name} ({a.id})</strong>
                      <div>Value: {a.value}</div>
                      <div>Status: {isCovered ? 'Covered' : 'UNCOVERED'}</div>
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
