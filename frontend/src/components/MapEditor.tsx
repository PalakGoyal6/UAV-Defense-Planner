import React, { useState, useRef } from 'react';
import { Asset, CandidateSite, CoordinateMode } from '../types/defense';
import { MapContainer, TileLayer, Marker, Circle, Popup, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import { PlusCircle, Target, Shield, Edit3, X, Move } from 'lucide-react';

// Leaflet default icon fix
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

interface MapEditorProps {
  coordinateMode: CoordinateMode;
  assets: Asset[];
  sites: CandidateSite[];
  onUpdateAsset: (index: number, asset: Asset) => void;
  onUpdateSite: (index: number, site: CandidateSite) => void;
  onAddAsset: (asset: Asset) => void;
  onAddSite: (site: CandidateSite) => void;
}

// Leaflet map click listener
const MapClickHandler: React.FC<{
  addMode: 'none' | 'asset' | 'site';
  onAddAsset: (lat: number, lon: number) => void;
  onAddSite: (lat: number, lon: number) => void;
}> = ({ addMode, onAddAsset, onAddSite }) => {
  useMapEvents({
    click(e) {
      if (addMode === 'asset') {
        onAddAsset(Number(e.latlng.lat.toFixed(4)), Number(e.latlng.lng.toFixed(4)));
      } else if (addMode === 'site') {
        onAddSite(Number(e.latlng.lat.toFixed(4)), Number(e.latlng.lng.toFixed(4)));
      }
    }
  });
  return null;
};

export const MapEditor: React.FC<MapEditorProps> = ({
  coordinateMode,
  assets,
  sites,
  onUpdateAsset,
  onUpdateSite,
  onAddAsset,
  onAddSite
}) => {
  const [addMode, setAddMode] = useState<'none' | 'asset' | 'site'>('none');
  const [selectedItem, setSelectedItem] = useState<{ type: 'asset' | 'site'; index: number } | null>(null);

  // Grid SVG interaction states
  const svgRef = useRef<SVGSVGElement | null>(null);
  const [draggingItem, setDraggingItem] = useState<{ type: 'asset' | 'site'; index: number } | null>(null);

  // Compute Grid bounds
  const allX = [...assets.map(a => a.x ?? 0), ...sites.map(s => s.x ?? 0), 0];
  const allY = [...assets.map(a => a.y ?? 0), ...sites.map(s => s.y ?? 0), 0];
  const maxX = Math.max(...allX, 10) + 2;
  const maxY = Math.max(...allY, 10) + 2;

  // Grid Coordinate Transform: viewBox 0 0 600 600
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

  // Grid Click Add
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
        threat_rate: 0.25
      });
    } else if (addMode === 'site') {
      const idx = sites.length + 1;
      onAddSite({
        id: `S${idx}`,
        name: `Site ${idx}`,
        x: xVal,
        y: yVal,
        cost: 25,
        range_km: 3.0,
        max_channels: 8,
        channel_cost: 0
      });
    }
  };

  const handleSvgMouseMove = (e: React.MouseEvent<SVGSVGElement>) => {
    if (!draggingItem || !svgRef.current) return;
    const rect = svgRef.current.getBoundingClientRect();
    const curX = fromSvgX(e.clientX - rect.left);
    const curY = fromSvgY(e.clientY - rect.top);

    if (draggingItem.type === 'asset') {
      const asset = assets[draggingItem.index];
      onUpdateAsset(draggingItem.index, { ...asset, x: curX, y: curY });
    } else {
      const site = sites[draggingItem.index];
      onUpdateSite(draggingItem.index, { ...site, x: curX, y: curY });
    }
  };

  const handleSvgMouseUp = () => {
    setDraggingItem(null);
  };

  return (
    <div className="space-y-4">
      {/* Map Mode & Tool Selector */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-white dark:bg-slate-900 p-3 rounded-xl border border-slate-200 dark:border-slate-800">
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Map Mode:</span>
          <span className="text-xs px-2.5 py-1 rounded-md bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 font-bold">
            {coordinateMode === 'grid' ? 'Grid Plane (km)' : 'Geographic (OSM / Haversine)'}
          </span>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-500 font-medium">Click to place:</span>
          <button
            onClick={() => setAddMode(addMode === 'asset' ? 'none' : 'asset')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition ${
              addMode === 'asset'
                ? 'bg-rose-600 text-white shadow-sm ring-2 ring-rose-400'
                : 'bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300'
            }`}
          >
            <Target className="w-3.5 h-3.5 text-rose-400" />
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
          {addMode !== 'none' && (
            <button
              onClick={() => setAddMode('none')}
              className="text-xs text-slate-400 hover:text-slate-600 underline ml-1"
            >
              Cancel tool
            </button>
          )}
        </div>
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
                {/* Background Grid */}
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

                {/* Axis Labels */}
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

                {/* Site Range Circles */}
                {sites.map((s, idx) => {
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
                {sites.map((s, idx) => {
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
                      <polygon
                        points={`${sx},${sy - 12} ${sx + 10},${sy + 8} ${sx - 10},${sy + 8}`}
                        className={`${isSelected ? 'fill-blue-600 stroke-blue-200' : 'fill-blue-500 stroke-white dark:stroke-slate-900'} stroke-2 drop-shadow-sm`}
                      />
                      <text x={sx} y={sy + 20} textAnchor="middle" className="text-[10px] font-bold fill-blue-700 dark:fill-blue-300 font-mono">
                        {s.id}
                      </text>
                    </g>
                  );
                })}

                {/* Asset Markers */}
                {assets.map((a, idx) => {
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
                        r={isSelected ? 9 : 7}
                        className={`${isSelected ? 'fill-rose-600 stroke-white' : 'fill-rose-500 stroke-white dark:stroke-slate-900'} stroke-2 drop-shadow-sm`}
                      />
                      <text x={ax} y={ay - 11} textAnchor="middle" className="text-[10px] font-bold fill-rose-700 dark:fill-rose-300 font-mono">
                        {a.id}
                      </text>
                    </g>
                  );
                })}
              </svg>
            </div>
          ) : (
            /* OpenStreetMap Leaflet Container */
            <div className="h-[550px] w-full rounded-xl overflow-hidden">
              <MapContainer
                center={[
                  assets[0]?.lat ?? sites[0]?.lat ?? 28.6139,
                  assets[0]?.lon ?? sites[0]?.lon ?? 77.2090
                ]}
                zoom={10}
                style={{ height: '100%', width: '100%' }}
              >
                <TileLayer
                  url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                  attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                />
                <MapClickHandler
                  addMode={addMode}
                  onAddAsset={(lat, lon) => {
                    const idx = assets.length + 1;
                    onAddAsset({
                      id: `A${idx}`,
                      name: `Asset ${idx}`,
                      lat,
                      lon,
                      value: 60,
                      threat_rate: 0.25
                    });
                  }}
                  onAddSite={(lat, lon) => {
                    const idx = sites.length + 1;
                    onAddSite({
                      id: `S${idx}`,
                      name: `Site ${idx}`,
                      lat,
                      lon,
                      cost: 25,
                      range_km: 15.0,
                      max_channels: 8,
                      channel_cost: 0
                    });
                  }}
                />

                {/* Site Circles and Markers */}
                {sites.map((s, idx) => (
                  <React.Fragment key={`geo-site-${s.id}`}>
                    <Circle
                      center={[s.lat ?? 0, s.lon ?? 0]}
                      radius={(s.range_km || 5) * 1000}
                      pathOptions={{ color: '#2563eb', fillColor: '#3b82f6', fillOpacity: 0.1, dashArray: '4,4' }}
                    />
                    <Marker
                      position={[s.lat ?? 0, s.lon ?? 0]}
                      icon={siteIcon}
                      draggable={true}
                      eventHandlers={{
                        dragend: (e) => {
                          const marker = e.target;
                          const pos = marker.getLatLng();
                          onUpdateSite(idx, { ...s, lat: Number(pos.lat.toFixed(4)), lon: Number(pos.lng.toFixed(4)) });
                        },
                        click: () => setSelectedItem({ type: 'site', index: idx })
                      }}
                    >
                      <Popup>
                        <div className="text-xs font-sans">
                          <strong>{s.name} ({s.id})</strong>
                          <div>Cost: ₹{s.cost}</div>
                          <div>Range: {s.range_km} km</div>
                        </div>
                      </Popup>
                    </Marker>
                  </React.Fragment>
                ))}

                {/* Asset Markers */}
                {assets.map((a, idx) => (
                  <Marker
                    key={`geo-asset-${a.id}`}
                    position={[a.lat ?? 0, a.lon ?? 0]}
                    icon={assetIcon}
                    draggable={true}
                    eventHandlers={{
                      dragend: (e) => {
                        const marker = e.target;
                        const pos = marker.getLatLng();
                        onUpdateAsset(idx, { ...a, lat: Number(pos.lat.toFixed(4)), lon: Number(pos.lng.toFixed(4)) });
                      },
                      click: () => setSelectedItem({ type: 'asset', index: idx })
                    }}
                  >
                    <Popup>
                      <div className="text-xs font-sans">
                        <strong>{a.name} ({a.id})</strong>
                        <div>Value: {a.value}</div>
                        <div>Threat: {a.threat_rate}/min</div>
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
                  <span>Edit {selectedItem.type === 'asset' ? 'Asset' : 'Site'}</span>
                </div>
                <button
                  onClick={() => setSelectedItem(null)}
                  className="p-1 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-md text-slate-400"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>

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
                            onChange={(e) => onUpdateAsset(selectedItem.index, { ...assets[selectedItem.index], lat: parseFloat(e.target.value) || 0 })}
                            className="w-full px-2 py-1 rounded border border-slate-200 dark:border-slate-700 dark:bg-slate-800 font-mono"
                          />
                        </div>
                        <div>
                          <label className="block text-slate-500 font-medium mb-1">Lon</label>
                          <input
                            type="number"
                            step="0.001"
                            value={assets[selectedItem.index].lon ?? 0}
                            onChange={(e) => onUpdateAsset(selectedItem.index, { ...assets[selectedItem.index], lon: parseFloat(e.target.value) || 0 })}
                            className="w-full px-2 py-1 rounded border border-slate-200 dark:border-slate-700 dark:bg-slate-800 font-mono"
                          />
                        </div>
                      </>
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
            </div>
          ) : (
            <div className="text-center py-12 text-slate-400 text-xs">
              <Move className="w-8 h-8 mx-auto mb-2 text-slate-300 dark:text-slate-700" />
              <p className="font-medium text-slate-600 dark:text-slate-300">No element selected</p>
              <p className="mt-1">Click or drag any asset or site marker on the map to modify coordinates & properties.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
