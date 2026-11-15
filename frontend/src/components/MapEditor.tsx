import React, { useState, useRef, useEffect } from 'react';
import { Asset, CandidateSite, CoordinateMode, Depot } from '../types/defense';
import { MapContainer, TileLayer, Marker, Circle, Popup, GeoJSON, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import { Target, Shield, Edit3, X, Move, Layers, Warehouse, AlertTriangle } from 'lucide-react';
import { INDIA_CENTER, INDIA_DEFAULT_ZOOM, INDIA_MAX_BOUNDS, getLoadedIndiaGeoJson, getStateForPoint, computeNearestDepotDistance } from '../utils/geo';

// Leaflet default icons
const assetIcon = new L.Icon({
  iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-red.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41]
});

const siteIcon = new L.Icon({
  iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-blue.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41]
});

const depotIcon = new L.Icon({
  iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-gold.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41]
});

interface MapEditorProps {
  coordinateMode: CoordinateMode;
  assets: Asset[];
  sites: CandidateSite[];
  depots?: Depot[];
  onUpdateAsset: (index: number, asset: Asset) => void;
  onUpdateSite: (index: number, site: CandidateSite) => void;
  onAddAsset: (asset: Asset) => void;
  onAddSite: (site: CandidateSite) => void;
  onUpdateDepot?: (index: number, depot: Depot) => void;
  onAddDepot?: (depot: Depot) => void;
  onDeleteDepot?: (index: number) => void;
}

// Leaflet map click listener
const MapClickHandler: React.FC<{
  addMode: 'none' | 'asset' | 'site' | 'depot';
  onAddAsset: (lat: number, lon: number) => void;
  onAddSite: (lat: number, lon: number) => void;
  onAddDepot: (lat: number, lon: number) => void;
}> = ({ addMode, onAddAsset, onAddSite, onAddDepot }) => {
  useMapEvents({
    click(e) {
      const lat = Number(e.latlng.lat.toFixed(4));
      const lon = Number(e.latlng.lng.toFixed(4));
      if (addMode === 'asset') {
        onAddAsset(lat, lon);
      } else if (addMode === 'site') {
        onAddSite(lat, lon);
      } else if (addMode === 'depot') {
        onAddDepot(lat, lon);
      }
    }
  });
  return null;
};

export const MapEditor: React.FC<MapEditorProps> = ({
  coordinateMode,
  assets,
  sites,
  depots = [],
  onUpdateAsset,
  onUpdateSite,
  onAddAsset,
  onAddSite,
  onUpdateDepot,
  onAddDepot,
  onDeleteDepot
}) => {
  const [addMode, setAddMode] = useState<'none' | 'asset' | 'site' | 'depot'>('none');
  const [selectedItem, setSelectedItem] = useState<{ type: 'asset' | 'site' | 'depot'; index: number } | null>(null);

  // Layer switches
  const [showOsmTiles, setShowOsmTiles] = useState(true);
  const [showStateBorders, setShowStateBorders] = useState(true);
  const [showAssets, setShowAssets] = useState(true);
  const [showSites, setShowSites] = useState(true);
  const [showCircles, setShowCircles] = useState(true);
  const [showDepots, setShowDepots] = useState(true);
  const [layerDropdownOpen, setLayerDropdownOpen] = useState(false);

  // GeoJSON state
  const [geoJsonData, setGeoJsonData] = useState<any>(null);

  useEffect(() => {
    let mounted = true;
    getLoadedIndiaGeoJson()
      .then((data) => {
        if (mounted) setGeoJsonData(data);
      })
      .catch(() => {});
    return () => {
      mounted = false;
    };
  }, []);

  // Grid SVG interaction states
  const svgRef = useRef<SVGSVGElement | null>(null);
  const [draggingItem, setDraggingItem] = useState<{ type: 'asset' | 'site' | 'depot'; index: number } | null>(null);

  // Compute Grid bounds
  const allX = [...assets.map(a => a.x ?? 0), ...sites.map(s => s.x ?? 0), ...depots.map(d => d.x ?? 0), 0];
  const allY = [...assets.map(a => a.y ?? 0), ...sites.map(s => s.y ?? 0), ...depots.map(d => d.y ?? 0), 0];
  const maxX = Math.max(...allX, 10) + 2;
  const maxY = Math.max(...allY, 10) + 2;

  const svgWidth = 650;
  const svgHeight = 650;
  const padding = 50;
  const plotWidth = svgWidth - 2 * padding;
  const plotHeight = svgHeight - 2 * padding;

  const toSvgX = (x: number) => padding + (x / maxX) * plotWidth;
  const toSvgY = (y: number) => svgHeight - padding - (y / maxY) * plotHeight;
  const fromSvgX = (svgX: number) => Math.max(0, Number((((svgX - padding) / plotWidth) * maxX).toFixed(1)));
  const fromSvgY = (svgY: number) => Math.max(0, Number((((svgHeight - padding - svgY) / plotHeight) * maxY).toFixed(1)));
  const scaleRadius = (rKm: number) => (rKm / maxX) * plotWidth;

  const handleSvgClick = (e: React.MouseEvent<SVGSVGElement>) => {
    if (draggingItem) return;
    if (addMode === 'none') return;

    const rect = svgRef.current?.getBoundingClientRect();
    if (!rect) return;
    const clickX = e.clientX - rect.left;
    const clickY = e.clientY - rect.top;

    const xVal = fromSvgX(clickX);
    const yVal = fromSvgY(clickY);

    if (addMode === 'asset') {
      const idx = assets.length + 1;
      onAddAsset({
        id: `A${idx}`,
        name: `Asset ${idx}`,
        x: xVal,
        y: yVal,
        value: 60,
        threat_rate: 0.25,
        region: 'Sector 1'
      });
    } else if (addMode === 'site') {
      const idx = sites.length + 1;
      const initialDist = computeNearestDepotDistance({ x: xVal, y: yVal }, depots, 'grid');
      onAddSite({
        id: `S${idx}`,
        name: `Site ${idx}`,
        x: xVal,
        y: yVal,
        cost: 25,
        range_km: 3.5,
        max_channels: 8,
        channel_cost: 0,
        depot_distance_km: initialDist,
        region: 'Sector 1'
      });
    } else if (addMode === 'depot' && onAddDepot) {
      const idx = depots.length + 1;
      onAddDepot({
        id: `D${idx}`,
        name: `Depot ${idx}`,
        x: xVal,
        y: yVal
      });
    }
    setAddMode('none');
  };

  const handleSvgMouseMove = (e: React.MouseEvent<SVGSVGElement>) => {
    if (!draggingItem) return;
    const rect = svgRef.current?.getBoundingClientRect();
    if (!rect) return;
    const curX = fromSvgX(e.clientX - rect.left);
    const curY = fromSvgY(e.clientY - rect.top);

    if (draggingItem.type === 'asset') {
      const a = assets[draggingItem.index];
      onUpdateAsset(draggingItem.index, { ...a, x: curX, y: curY });
    } else if (draggingItem.type === 'site') {
      const s = sites[draggingItem.index];
      const dDist = computeNearestDepotDistance({ x: curX, y: curY }, depots, 'grid');
      onUpdateSite(draggingItem.index, { ...s, x: curX, y: curY, depot_distance_km: dDist });
    } else if (draggingItem.type === 'depot' && onUpdateDepot) {
      const d = depots[draggingItem.index];
      onUpdateDepot(draggingItem.index, { ...d, x: curX, y: curY });
    }
  };

  const handleSvgMouseUp = () => {
    setDraggingItem(null);
  };

  return (
    <div className="space-y-4">
      {/* Top Map Action Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-white dark:bg-slate-900 p-3 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs">
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => setAddMode(addMode === 'asset' ? 'none' : 'asset')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition ${
              addMode === 'asset'
                ? 'bg-rose-600 text-white shadow-sm ring-2 ring-rose-400'
                : 'bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300'
            }`}
          >
            <Target className="w-3.5 h-3.5 text-rose-500" />
            + Add Asset
          </button>

          <button
            onClick={() => setAddMode(addMode === 'site' ? 'none' : 'site')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition ${
              addMode === 'site'
                ? 'bg-blue-600 text-white shadow-sm ring-2 ring-blue-400'
                : 'bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300'
            }`}
          >
            <Shield className="w-3.5 h-3.5 text-blue-400" />
            + Add Candidate Site
          </button>

          <button
            onClick={() => setAddMode(addMode === 'depot' ? 'none' : 'depot')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition ${
              addMode === 'depot'
                ? 'bg-amber-600 text-white shadow-sm ring-2 ring-amber-400'
                : 'bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300'
            }`}
          >
            <Warehouse className="w-3.5 h-3.5 text-amber-500" />
            + Add Resupply Depot
          </button>

          {addMode !== 'none' && (
            <button
              onClick={() => setAddMode('none')}
              className="text-xs text-slate-400 hover:text-slate-600 underline ml-1"
            >
              Cancel tool
            </button>
          )}
        </div>

        {/* Layer Controls Dropdown */}
        {coordinateMode === 'geo' && (
          <div className="relative">
            <button
              onClick={() => setLayerDropdownOpen(!layerDropdownOpen)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 transition"
            >
              <Layers className="w-3.5 h-3.5 text-indigo-500" />
              <span>Map Layers</span>
            </button>

            {layerDropdownOpen && (
              <div className="absolute right-0 mt-2 w-52 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-lg p-3 z-50 space-y-2 text-xs">
                <div className="font-semibold text-slate-700 dark:text-slate-200 border-b border-slate-100 dark:border-slate-700 pb-1">
                  Layer Toggles
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
                  <span>India State Boundaries</span>
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

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
        {/* Main Map Canvas Area */}
        <div className="lg:col-span-3 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-2 overflow-hidden shadow-xs relative">
          {coordinateMode === 'grid' ? (
            /* Interactive Grid SVG */
            <div className="flex justify-center items-center overflow-auto select-none">
              <svg
                ref={svgRef}
                viewBox={`0 0 ${svgWidth} ${svgHeight}`}
                className="w-full max-w-[650px] aspect-square cursor-crosshair"
                onClick={handleSvgClick}
                onMouseMove={handleSvgMouseMove}
                onMouseUp={handleSvgMouseUp}
              >
                <rect width={svgWidth} height={svgHeight} className="fill-slate-50 dark:fill-slate-950" />

                {/* Axes and Grid Lines */}
                {Array.from({ length: Math.ceil(maxX) + 1 }).map((_, i) => (
                  <g key={`grid-x-${i}`}>
                    <line
                      x1={toSvgX(i)}
                      y1={padding}
                      x2={toSvgX(i)}
                      y2={svgHeight - padding}
                      className="stroke-slate-200 dark:stroke-slate-800"
                      strokeDasharray={i % 2 === 0 ? undefined : '2,2'}
                      strokeWidth={i === 0 ? 2 : 1}
                    />
                    <text
                      x={toSvgX(i)}
                      y={svgHeight - padding + 15}
                      textAnchor="middle"
                      className="text-[10px] fill-slate-400 font-mono"
                    >
                      {i}
                    </text>
                  </g>
                ))}

                {Array.from({ length: Math.ceil(maxY) + 1 }).map((_, i) => (
                  <g key={`grid-y-${i}`}>
                    <line
                      x1={padding}
                      y1={toSvgY(i)}
                      x2={svgWidth - padding}
                      y2={toSvgY(i)}
                      className="stroke-slate-200 dark:stroke-slate-800"
                      strokeDasharray={i % 2 === 0 ? undefined : '2,2'}
                      strokeWidth={i === 0 ? 2 : 1}
                    />
                    <text
                      x={padding - 10}
                      y={toSvgY(i) + 3}
                      textAnchor="end"
                      className="text-[10px] fill-slate-400 font-mono"
                    >
                      {i}
                    </text>
                  </g>
                ))}

                <text x={svgWidth / 2} y={svgHeight - 15} textAnchor="middle" className="text-xs fill-slate-500 font-semibold">
                  X Coordinate (km)
                </text>
                <text
                  x={15}
                  y={svgHeight / 2}
                  textAnchor="middle"
                  transform={`rotate(-90 15 ${svgHeight / 2})`}
                  className="text-xs fill-slate-500 font-semibold"
                >
                  Y Coordinate (km)
                </text>

                {/* Range Circles */}
                {showCircles && sites.map((s, idx) => {
                  const sx = s.x ?? 0;
                  const sy = s.y ?? 0;
                  const r = scaleRadius(s.range_km);
                  const isSelected = selectedItem?.type === 'site' && selectedItem.index === idx;

                  return (
                    <circle
                      key={`range-${s.id}`}
                      cx={toSvgX(sx)}
                      cy={toSvgY(sy)}
                      r={r}
                      fill="rgba(59, 130, 246, 0.08)"
                      stroke={isSelected ? '#2563eb' : 'rgba(59, 130, 246, 0.4)'}
                      strokeWidth={isSelected ? 2 : 1.2}
                      strokeDasharray="4 2"
                    />
                  );
                })}

                {/* Site Markers */}
                {showSites && sites.map((s, idx) => {
                  const sx = toSvgX(s.x ?? 0);
                  const sy = toSvgY(s.y ?? 0);
                  const isSelected = selectedItem?.type === 'site' && selectedItem.index === idx;

                  return (
                    <g
                      key={`site-${s.id}`}
                      className="cursor-move"
                      onMouseDown={(e) => {
                        e.stopPropagation();
                        setDraggingItem({ type: 'site', index: idx });
                        setSelectedItem({ type: 'site', index: idx });
                      }}
                    >
                      <circle
                        cx={sx}
                        cy={sy}
                        r={11}
                        className={`${isSelected ? 'fill-blue-600 stroke-white ring-2 ring-blue-500' : 'fill-blue-500 stroke-white'} stroke-2 drop-shadow-sm`}
                      />
                      <text x={sx} y={sy + 3.5} textAnchor="middle" className="text-[9px] font-bold fill-white font-mono pointer-events-none">
                        {s.id}
                      </text>
                      <text x={sx} y={sy - 14} textAnchor="middle" className="text-[10px] font-medium fill-slate-700 dark:fill-slate-300 font-sans pointer-events-none">
                        {s.name}
                      </text>
                    </g>
                  );
                })}

                {/* Depots */}
                {showDepots && depots.map((d, idx) => {
                  const dx = toSvgX(d.x ?? 0);
                  const dy = toSvgY(d.y ?? 0);
                  const isSelected = selectedItem?.type === 'depot' && selectedItem.index === idx;

                  return (
                    <g
                      key={`depot-${d.id}`}
                      className="cursor-move"
                      onMouseDown={(e) => {
                        e.stopPropagation();
                        setDraggingItem({ type: 'depot', index: idx });
                        setSelectedItem({ type: 'depot', index: idx });
                      }}
                    >
                      <polygon
                        points={`${dx},${dy - 12} ${dx + 12},${dy} ${dx},${dy + 12} ${dx - 12},${dy}`}
                        className={`${isSelected ? 'fill-amber-600 stroke-white ring-2 ring-amber-400' : 'fill-amber-500 stroke-white'} stroke-2 drop-shadow-sm`}
                      />
                      <text x={dx} y={dy + 3.5} textAnchor="middle" className="text-[9px] font-bold fill-white font-mono pointer-events-none">
                        {d.id}
                      </text>
                      <text x={dx} y={dy - 16} textAnchor="middle" className="text-[10px] font-bold fill-amber-700 dark:fill-amber-300 font-sans pointer-events-none">
                        {d.name}
                      </text>
                    </g>
                  );
                })}

                {/* Asset Markers */}
                {showAssets && assets.map((a, idx) => {
                  const ax = toSvgX(a.x ?? 0);
                  const ay = toSvgY(a.y ?? 0);
                  const isSelected = selectedItem?.type === 'asset' && selectedItem.index === idx;

                  return (
                    <g
                      key={`asset-${a.id}`}
                      className="cursor-move"
                      onMouseDown={(e) => {
                        e.stopPropagation();
                        setDraggingItem({ type: 'asset', index: idx });
                        setSelectedItem({ type: 'asset', index: idx });
                      }}
                    >
                      <circle
                        cx={ax}
                        cy={ay}
                        r={9}
                        className={`${isSelected ? 'fill-rose-600 stroke-white ring-2 ring-rose-500' : 'fill-rose-500 stroke-white'} stroke-2 drop-shadow-sm`}
                      />
                      <text x={ax} y={ay + 3} textAnchor="middle" className="text-[9px] font-bold fill-white font-mono pointer-events-none">
                        {a.id}
                      </text>
                      <text x={ax} y={ay - 12} textAnchor="middle" className="text-[10px] font-medium fill-slate-700 dark:fill-slate-300 font-sans pointer-events-none">
                        {a.name}
                      </text>
                    </g>
                  );
                })}
              </svg>
            </div>
          ) : (
            /* Geographic Leaflet Mode (Opens on India) */
            <div className="h-[550px] w-full rounded-xl overflow-hidden bg-slate-900 relative">
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
                    attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                  />
                )}

                {/* State Boundaries with Hover Tooltip */}
                {showStateBorders && geoJsonData && (
                  <GeoJSON
                    key="india-states-boundaries"
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
                      const stName = feature.properties?.state_name || 'State';
                      layer.bindTooltip(stName, {
                        permanent: false,
                        direction: 'center',
                        className: 'bg-slate-900 text-white text-[11px] font-sans px-2 py-0.5 rounded shadow'
                      });
                    }}
                  />
                )}

                <MapClickHandler
                  addMode={addMode}
                  onAddAsset={(lat, lon) => {
                    const idx = assets.length + 1;
                    const detectedRegion = getStateForPoint(lat, lon, geoJsonData);
                    onAddAsset({
                      id: `A${idx}`,
                      name: `Asset ${idx}`,
                      lat,
                      lon,
                      value: 60,
                      threat_rate: 0.25,
                      region: detectedRegion,
                      is_region_overridden: false
                    });
                    setAddMode('none');
                  }}
                  onAddSite={(lat, lon) => {
                    const idx = sites.length + 1;
                    const detectedRegion = getStateForPoint(lat, lon, geoJsonData);
                    const dDist = computeNearestDepotDistance({ lat, lon }, depots, 'geo');
                    onAddSite({
                      id: `S${idx}`,
                      name: `Site ${idx}`,
                      lat,
                      lon,
                      cost: 25,
                      range_km: 15.0,
                      max_channels: 8,
                      channel_cost: 0,
                      depot_distance_km: dDist,
                      region: detectedRegion,
                      is_region_overridden: false
                    });
                    setAddMode('none');
                  }}
                  onAddDepot={(lat, lon) => {
                    if (onAddDepot) {
                      const idx = depots.length + 1;
                      onAddDepot({
                        id: `D${idx}`,
                        name: `Depot ${idx}`,
                        lat,
                        lon
                      });
                    }
                    setAddMode('none');
                  }}
                />

                {/* Site Circles and Markers */}
                {showSites && sites.map((s, idx) => (
                  <React.Fragment key={`geo-site-${s.id}`}>
                    {showCircles && (
                      <Circle
                        center={[s.lat ?? 0, s.lon ?? 0]}
                        radius={(s.range_km || 5) * 1000}
                        pathOptions={{ color: '#2563eb', fillColor: '#3b82f6', fillOpacity: 0.1, dashArray: '4,4' }}
                      />
                    )}
                    <Marker
                      position={[s.lat ?? 0, s.lon ?? 0]}
                      icon={siteIcon}
                      draggable={true}
                      eventHandlers={{
                        dragend: (e) => {
                          const marker = e.target;
                          const pos = marker.getLatLng();
                          const newLat = Number(pos.lat.toFixed(4));
                          const newLon = Number(pos.lng.toFixed(4));
                          const detected = !s.is_region_overridden ? getStateForPoint(newLat, newLon, geoJsonData) : s.region;
                          const dDist = computeNearestDepotDistance({ lat: newLat, lon: newLon }, depots, 'geo');
                          onUpdateSite(idx, {
                            ...s,
                            lat: newLat,
                            lon: newLon,
                            region: detected,
                            depot_distance_km: dDist
                          });
                        },
                        click: () => setSelectedItem({ type: 'site', index: idx })
                      }}
                    >
                      <Popup>
                        <div className="text-xs font-sans">
                          <strong>{s.name} ({s.id})</strong>
                          <div>Cost: ₹{s.cost}</div>
                          <div>Range: {s.range_km} km</div>
                          <div>Region: <em>{s.region || 'Unassigned'}</em></div>
                          <div>Depot Dist: {s.depot_distance_km ?? 0} km</div>
                        </div>
                      </Popup>
                    </Marker>
                  </React.Fragment>
                ))}

                {/* Resupply Depot Markers */}
                {showDepots && depots.map((d, idx) => (
                  <Marker
                    key={`geo-depot-${d.id}`}
                    position={[d.lat ?? 0, d.lon ?? 0]}
                    icon={depotIcon}
                    draggable={true}
                    eventHandlers={{
                      dragend: (e) => {
                        const marker = e.target;
                        const pos = marker.getLatLng();
                        const newLat = Number(pos.lat.toFixed(4));
                        const newLon = Number(pos.lng.toFixed(4));
                        if (onUpdateDepot) {
                          onUpdateDepot(idx, { ...d, lat: newLat, lon: newLon });
                        }
                      },
                      click: () => setSelectedItem({ type: 'depot', index: idx })
                    }}
                  >
                    <Popup>
                      <div className="text-xs font-sans">
                        <strong className="text-amber-600 font-bold">{d.name} ({d.id})</strong>
                        <div>Resupply Depot</div>
                        <div>Coordinates: {d.lat?.toFixed(3)}, {d.lon?.toFixed(3)}</div>
                      </div>
                    </Popup>
                  </Marker>
                ))}

                {/* Asset Markers */}
                {showAssets && assets.map((a, idx) => (
                  <Marker
                    key={`geo-asset-${a.id}`}
                    position={[a.lat ?? 0, a.lon ?? 0]}
                    icon={assetIcon}
                    draggable={true}
                    eventHandlers={{
                      dragend: (e) => {
                        const marker = e.target;
                        const pos = marker.getLatLng();
                        const newLat = Number(pos.lat.toFixed(4));
                        const newLon = Number(pos.lng.toFixed(4));
                        const detected = !a.is_region_overridden ? getStateForPoint(newLat, newLon, geoJsonData) : a.region;
                        onUpdateAsset(idx, {
                          ...a,
                          lat: newLat,
                          lon: newLon,
                          region: detected
                        });
                      },
                      click: () => setSelectedItem({ type: 'asset', index: idx })
                    }}
                  >
                    <Popup>
                      <div className="text-xs font-sans">
                        <strong>{a.name} ({a.id})</strong>
                        <div>Value: {a.value}</div>
                        <div>Threat: {a.threat_rate}/min</div>
                        <div>Region: <em>{a.region || 'Unassigned'}</em></div>
                      </div>
                    </Popup>
                  </Marker>
                ))}
              </MapContainer>
            </div>
          )}
        </div>

        {/* Selected Marker Edit Side-Panel */}
        <div className="lg:col-span-1 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-4 shadow-xs">
          {selectedItem ? (
            <div className="space-y-4">
              <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-800">
                <div className="flex items-center gap-1.5 font-semibold text-xs text-slate-800 dark:text-slate-200">
                  <Edit3 className="w-3.5 h-3.5 text-indigo-500" />
                  <span>
                    Edit {selectedItem.type === 'asset' ? 'Asset' : selectedItem.type === 'site' ? 'Candidate Site' : 'Depot'}
                  </span>
                </div>
                <button
                  onClick={() => setSelectedItem(null)}
                  className="p-1 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-md text-slate-400"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>

              {/* Asset Edit */}
              {selectedItem.type === 'asset' && assets[selectedItem.index] && (
                <div className="space-y-3 text-xs">
                  <div>
                    <label className="block text-slate-500 font-medium mb-1">ID</label>
                    <input
                      type="text"
                      value={assets[selectedItem.index].id}
                      onChange={(e) => onUpdateAsset(selectedItem.index, { ...assets[selectedItem.index], id: e.target.value })}
                      className="w-full px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 dark:bg-slate-800 font-mono font-bold"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-500 font-medium mb-1">Name</label>
                    <input
                      type="text"
                      value={assets[selectedItem.index].name}
                      onChange={(e) => onUpdateAsset(selectedItem.index, { ...assets[selectedItem.index], name: e.target.value })}
                      className="w-full px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 dark:bg-slate-800"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    {coordinateMode === 'grid' ? (
                      <>
                        <div>
                          <label className="block text-slate-500 font-medium mb-1">X (km)</label>
                          <input
                            type="number"
                            step="0.1"
                            value={assets[selectedItem.index].x ?? 0}
                            onChange={(e) => onUpdateAsset(selectedItem.index, { ...assets[selectedItem.index], x: parseFloat(e.target.value) || 0 })}
                            className="w-full px-2 py-1 rounded border border-slate-200 dark:border-slate-700 dark:bg-slate-800 font-mono"
                          />
                        </div>
                        <div>
                          <label className="block text-slate-500 font-medium mb-1">Y (km)</label>
                          <input
                            type="number"
                            step="0.1"
                            value={assets[selectedItem.index].y ?? 0}
                            onChange={(e) => onUpdateAsset(selectedItem.index, { ...assets[selectedItem.index], y: parseFloat(e.target.value) || 0 })}
                            className="w-full px-2 py-1 rounded border border-slate-200 dark:border-slate-700 dark:bg-slate-800 font-mono"
                          />
                        </div>
                      </>
                    ) : (
                      <>
                        <div>
                          <label className="block text-slate-500 font-medium mb-1">Lat</label>
                          <input
                            type="number"
                            step="0.001"
                            value={assets[selectedItem.index].lat ?? 0}
                            onChange={(e) => {
                              const newLat = parseFloat(e.target.value) || 0;
                              const reg = !assets[selectedItem.index].is_region_overridden
                                ? getStateForPoint(newLat, assets[selectedItem.index].lon, geoJsonData)
                                : assets[selectedItem.index].region;
                              onUpdateAsset(selectedItem.index, { ...assets[selectedItem.index], lat: newLat, region: reg });
                            }}
                            className="w-full px-2 py-1 rounded border border-slate-200 dark:border-slate-700 dark:bg-slate-800 font-mono"
                          />
                        </div>
                        <div>
                          <label className="block text-slate-500 font-medium mb-1">Lon</label>
                          <input
                            type="number"
                            step="0.001"
                            value={assets[selectedItem.index].lon ?? 0}
                            onChange={(e) => {
                              const newLon = parseFloat(e.target.value) || 0;
                              const reg = !assets[selectedItem.index].is_region_overridden
                                ? getStateForPoint(assets[selectedItem.index].lat, newLon, geoJsonData)
                                : assets[selectedItem.index].region;
                              onUpdateAsset(selectedItem.index, { ...assets[selectedItem.index], lon: newLon, region: reg });
                            }}
                            className="w-full px-2 py-1 rounded border border-slate-200 dark:border-slate-700 dark:bg-slate-800 font-mono"
                          />
                        </div>
                      </>
                    )}
                  </div>
                  <div>
                    <label className="block text-slate-500 font-medium mb-1">Region</label>
                    <input
                      type="text"
                      value={assets[selectedItem.index].region || ''}
                      onChange={(e) => onUpdateAsset(selectedItem.index, { ...assets[selectedItem.index], region: e.target.value, is_region_overridden: true })}
                      className={`w-full px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 dark:bg-slate-800 ${
                        assets[selectedItem.index].is_region_overridden ? 'italic font-medium text-indigo-600' : ''
                      }`}
                    />
                    {assets[selectedItem.index].region === 'Outside India' && (
                      <div className="flex items-center gap-1 text-[10px] text-rose-500 mt-1">
                        <AlertTriangle className="w-3 h-3" /> Point is outside India bounds
                      </div>
                    )}
                  </div>
                  <div>
                    <label className="block text-slate-500 font-medium mb-1">Value (wᵢ)</label>
                    <input
                      type="number"
                      value={assets[selectedItem.index].value}
                      onChange={(e) => onUpdateAsset(selectedItem.index, { ...assets[selectedItem.index], value: parseFloat(e.target.value) || 1 })}
                      className="w-full px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 dark:bg-slate-800 font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-500 font-medium mb-1">Threat Rate (λᵢ/min)</label>
                    <input
                      type="number"
                      step="0.05"
                      value={assets[selectedItem.index].threat_rate}
                      onChange={(e) => onUpdateAsset(selectedItem.index, { ...assets[selectedItem.index], threat_rate: parseFloat(e.target.value) || 0 })}
                      className="w-full px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 dark:bg-slate-800 font-mono"
                    />
                  </div>
                </div>
              )}

              {/* Site Edit */}
              {selectedItem.type === 'site' && sites[selectedItem.index] && (
                <div className="space-y-3 text-xs">
                  <div>
                    <label className="block text-slate-500 font-medium mb-1">ID</label>
                    <input
                      type="text"
                      value={sites[selectedItem.index].id}
                      onChange={(e) => onUpdateSite(selectedItem.index, { ...sites[selectedItem.index], id: e.target.value })}
                      className="w-full px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 dark:bg-slate-800 font-mono font-bold"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-500 font-medium mb-1">Name</label>
                    <input
                      type="text"
                      value={sites[selectedItem.index].name}
                      onChange={(e) => onUpdateSite(selectedItem.index, { ...sites[selectedItem.index], name: e.target.value })}
                      className="w-full px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 dark:bg-slate-800"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-slate-500 font-medium mb-1">Cost (₹)</label>
                      <input
                        type="number"
                        value={sites[selectedItem.index].cost}
                        onChange={(e) => onUpdateSite(selectedItem.index, { ...sites[selectedItem.index], cost: parseFloat(e.target.value) || 1 })}
                        className="w-full px-2 py-1 rounded border border-slate-200 dark:border-slate-700 dark:bg-slate-800 font-mono"
                      />
                    </div>
                    <div>
                      <label className="block text-slate-500 font-medium mb-1">Range (km)</label>
                      <input
                        type="number"
                        step="0.5"
                        value={sites[selectedItem.index].range_km}
                        onChange={(e) => onUpdateSite(selectedItem.index, { ...sites[selectedItem.index], range_km: parseFloat(e.target.value) || 1 })}
                        className="w-full px-2 py-1 rounded border border-slate-200 dark:border-slate-700 dark:bg-slate-800 font-mono"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-slate-500 font-medium mb-1">Region</label>
                    <input
                      type="text"
                      value={sites[selectedItem.index].region || ''}
                      onChange={(e) => onUpdateSite(selectedItem.index, { ...sites[selectedItem.index], region: e.target.value, is_region_overridden: true })}
                      className={`w-full px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 dark:bg-slate-800 ${
                        sites[selectedItem.index].is_region_overridden ? 'italic font-medium text-indigo-600' : ''
                      }`}
                    />
                    {sites[selectedItem.index].region === 'Outside India' && (
                      <div className="flex items-center gap-1 text-[10px] text-rose-500 mt-1">
                        <AlertTriangle className="w-3 h-3" /> Point is outside India bounds
                      </div>
                    )}
                  </div>
                  <div>
                    <label className="block text-slate-500 font-medium mb-1">Depot Distance (km)</label>
                    <input
                      type="number"
                      step="0.1"
                      value={sites[selectedItem.index].depot_distance_km ?? 0}
                      onChange={(e) => onUpdateSite(selectedItem.index, { ...sites[selectedItem.index], depot_distance_km: parseFloat(e.target.value) || 0 })}
                      className="w-full px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 dark:bg-slate-800 font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-500 font-medium mb-1">Max Channels</label>
                    <input
                      type="number"
                      value={sites[selectedItem.index].max_channels}
                      onChange={(e) => onUpdateSite(selectedItem.index, { ...sites[selectedItem.index], max_channels: parseInt(e.target.value, 10) || 1 })}
                      className="w-full px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 dark:bg-slate-800 font-mono"
                    />
                  </div>
                </div>
              )}

              {/* Depot Edit */}
              {selectedItem.type === 'depot' && depots[selectedItem.index] && (
                <div className="space-y-3 text-xs">
                  <div>
                    <label className="block text-slate-500 font-medium mb-1">ID</label>
                    <input
                      type="text"
                      value={depots[selectedItem.index].id}
                      onChange={(e) => onUpdateDepot && onUpdateDepot(selectedItem.index, { ...depots[selectedItem.index], id: e.target.value })}
                      className="w-full px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 dark:bg-slate-800 font-mono font-bold"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-500 font-medium mb-1">Depot Name</label>
                    <input
                      type="text"
                      value={depots[selectedItem.index].name}
                      onChange={(e) => onUpdateDepot && onUpdateDepot(selectedItem.index, { ...depots[selectedItem.index], name: e.target.value })}
                      className="w-full px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 dark:bg-slate-800"
                    />
                  </div>
                  {onDeleteDepot && (
                    <button
                      onClick={() => {
                        onDeleteDepot(selectedItem.index);
                        setSelectedItem(null);
                      }}
                      className="w-full py-1.5 mt-2 bg-rose-50 hover:bg-rose-100 text-rose-700 rounded-lg text-xs font-semibold transition border border-rose-200"
                    >
                      Delete Depot
                    </button>
                  )}
                </div>
              )}
            </div>
          ) : (
            <div className="text-center py-12 text-slate-400 text-xs">
              <Move className="w-8 h-8 mx-auto mb-2 text-slate-300 dark:text-slate-700" />
              <p className="font-medium text-slate-600 dark:text-slate-300">No element selected</p>
              <p className="mt-1">Click or drag any asset, site, or depot marker to update coordinates.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
