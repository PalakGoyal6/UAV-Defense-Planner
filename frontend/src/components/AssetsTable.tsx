import React, { useState } from 'react';
import { Asset, CoordinateMode, PriorityClass } from '../types/defense';
import Papa from 'papaparse';
import { Plus, Trash2, Upload, Download, Clipboard, AlertCircle, AlertTriangle } from 'lucide-react';
import { getStateForPoint } from '../utils/geo';

interface AssetsTableProps {
  assets: Asset[];
  onChange: (assets: Asset[]) => void;
  coordinateMode: CoordinateMode;
  highValueThreshold: number;
}

export const AssetsTable: React.FC<AssetsTableProps> = ({
  assets,
  onChange,
  coordinateMode,
  highValueThreshold
}) => {
  const [pasteModalOpen, setPasteModalOpen] = useState(false);
  const [pasteText, setPasteText] = useState('');

  // Validation
  const idCounts = assets.reduce((acc, a) => {
    acc[a.id] = (acc[a.id] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const handleUpdate = (index: number, field: keyof Asset, value: any) => {
    const updated = [...assets];
    const item = { ...updated[index], [field]: value };

    // Auto-assign region on coordinate change in geo mode if not overridden
    if (coordinateMode === 'geo' && (field === 'lat' || field === 'lon')) {
      if (!item.is_region_overridden) {
        item.region = getStateForPoint(item.lat, item.lon);
      }
    }

    // Flag manual override when region field is edited directly
    if (field === 'region') {
      item.is_region_overridden = true;
    }

    updated[index] = item;
    onChange(updated);
  };

  const handleAddRow = () => {
    const nextIdx = assets.length + 1;
    const defaultLat = coordinateMode === 'geo' ? 28.6139 : null;
    const defaultLon = coordinateMode === 'geo' ? 77.2090 : null;
    const defaultRegion = coordinateMode === 'geo' ? getStateForPoint(defaultLat, defaultLon) : '';

    const newAsset: Asset = {
      id: `A${nextIdx}`,
      name: `Asset ${nextIdx}`,
      x: coordinateMode === 'grid' ? 5.0 : null,
      y: coordinateMode === 'grid' ? 5.0 : null,
      lat: defaultLat,
      lon: defaultLon,
      value: 50.0,
      priority_class: null,
      threat_rate: 0.25,
      region: defaultRegion,
      is_region_overridden: false
    };
    onChange([...assets, newAsset]);
  };

  const handleDeleteRow = (index: number) => {
    const updated = assets.filter((_, i) => i !== index);
    onChange(updated);
  };

  const handleCsvUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      dynamicTyping: true,
      complete: (results) => {
        const parsedAssets: Asset[] = results.data.map((row: any, idx: number) => {
          const lat = row.lat !== undefined && row.lat !== null ? Number(row.lat) : null;
          const lon = row.lon !== undefined && row.lon !== null ? Number(row.lon) : null;
          const userRegion = row.region ? String(row.region).trim() : null;
          const autoRegion = (coordinateMode === 'geo' && lat != null && lon != null) ? getStateForPoint(lat, lon) : null;

          return {
            id: String(row.id || `A${idx + 1}`).trim(),
            name: String(row.name || `Asset ${idx + 1}`).trim(),
            x: row.x !== undefined && row.x !== null ? Number(row.x) : null,
            y: row.y !== undefined && row.y !== null ? Number(row.y) : null,
            lat,
            lon,
            value: Math.max(1, Number(row.value) || 50),
            priority_class: (row.priority_class === 'high' || row.priority_class === 'low') ? row.priority_class : null,
            threat_rate: Math.max(0, Number(row.threat_rate) || 0.1),
            region: userRegion || autoRegion,
            is_region_overridden: !!userRegion
          };
        });
        if (parsedAssets.length > 0) {
          onChange(parsedAssets);
        }
      }
    });
    e.target.value = '';
  };

  const handleExportCsv = () => {
    const csv = Papa.unparse(assets);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', 'assets.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleApplyPaste = () => {
    if (!pasteText.trim()) return;
    const parsed = Papa.parse(pasteText.trim(), {
      header: false,
      skipEmptyLines: true,
      delimiter: '\t',
      dynamicTyping: true
    });

    const newAssets: Asset[] = parsed.data.map((row: any, i: number) => {
      // Expecting: id, name, coord1, coord2, value, class, threat, region
      const id = String(row[0] || `A${assets.length + i + 1}`).trim();
      const name = String(row[1] || `Asset ${assets.length + i + 1}`).trim();
      const coord1 = Number(row[2]) || 0;
      const coord2 = Number(row[3]) || 0;
      const val = Math.max(1, Number(row[4]) || 50);
      const pClass = (row[5] === 'high' || row[5] === 'low') ? row[5] : null;
      const threat = Math.max(0, Number(row[6]) || 0.2);
      const region = row[7] ? String(row[7]).trim() : null;

      return {
        id,
        name,
        x: coordinateMode === 'grid' ? coord1 : null,
        y: coordinateMode === 'grid' ? coord2 : null,
        lat: coordinateMode === 'geo' ? coord1 : null,
        lon: coordinateMode === 'geo' ? coord2 : null,
        value: val,
        priority_class: pClass,
        threat_rate: threat,
        region
      };
    });

    if (newAssets.length > 0) {
      onChange([...assets, ...newAssets]);
      setPasteText('');
      setPasteModalOpen(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Action Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <button
            onClick={handleAddRow}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-medium transition shadow-sm"
          >
            <Plus className="w-4 h-4" /> Add Asset
          </button>
          <button
            onClick={() => setPasteModalOpen(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-lg text-xs font-medium transition"
          >
            <Clipboard className="w-4 h-4" /> Bulk Paste TSV/Excel
          </button>
        </div>

        <div className="flex items-center gap-2">
          <label className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-lg text-xs font-medium cursor-pointer transition">
            <Upload className="w-4 h-4" /> Import CSV
            <input type="file" accept=".csv" onChange={handleCsvUpload} className="hidden" />
          </label>
          <button
            onClick={handleExportCsv}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-lg text-xs font-medium transition"
          >
            <Download className="w-4 h-4" /> Export CSV
          </button>
        </div>
      </div>

      {/* Table Container */}
      <div className="overflow-x-auto border border-slate-200 dark:border-slate-800 rounded-xl bg-white dark:bg-slate-900 shadow-sm">
        <table className="w-full text-left text-xs">
          <thead className="bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300">
            <tr>
              <th className="py-2.5 px-3 w-16">ID</th>
              <th className="py-2.5 px-3 min-w-[140px]">Name</th>
              {coordinateMode === 'grid' ? (
                <>
                  <th className="py-2.5 px-3 w-24">X (km)</th>
                  <th className="py-2.5 px-3 w-24">Y (km)</th>
                </>
              ) : (
                <>
                  <th className="py-2.5 px-3 w-28">Lat (deg)</th>
                  <th className="py-2.5 px-3 w-28">Lon (deg)</th>
                </>
              )}
              <th className="py-2.5 px-3 w-28">Value (wᵢ)</th>
              <th className="py-2.5 px-3 w-32">Priority Class</th>
              <th className="py-2.5 px-3 w-32">Threat Rate (λᵢ/min)</th>
              <th className="py-2.5 px-3 w-24">Region</th>
              <th className="py-2.5 px-3 w-12 text-center">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
            {assets.length === 0 ? (
              <tr>
                <td colSpan={9} className="py-8 text-center text-slate-400">
                  No assets defined. Click "Add Asset" or import a CSV.
                </td>
              </tr>
            ) : (
              assets.map((a, i) => {
                const isDuplicate = (idCounts[a.id] || 0) > 1;
                const isValueInvalid = Number(a.value) <= 0 || isNaN(Number(a.value));
                const isThreatInvalid = Number(a.threat_rate) < 0 || isNaN(Number(a.threat_rate));
                const autoHigh = (a.priority_class === 'high') || (!a.priority_class && a.value >= highValueThreshold);

                return (
                  <tr key={i} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/40 transition">
                    {/* ID */}
                    <td className="py-2 px-3">
                      <div className="relative">
                        <input
                          type="text"
                          value={a.id}
                          onChange={(e) => handleUpdate(i, 'id', e.target.value)}
                          className={`w-full px-2 py-1 rounded border font-mono font-bold text-xs ${
                            isDuplicate ? 'border-rose-500 bg-rose-50 dark:bg-rose-950/30' : 'border-slate-200 dark:border-slate-700 dark:bg-slate-800'
                          }`}
                        />
                        {isDuplicate && (
                          <span title="Duplicate ID" className="absolute right-1.5 top-2 text-rose-500">
                            <AlertCircle className="w-3.5 h-3.5" />
                          </span>
                        )}
                      </div>
                    </td>

                    {/* Name */}
                    <td className="py-2 px-3">
                      <input
                        type="text"
                        value={a.name}
                        onChange={(e) => handleUpdate(i, 'name', e.target.value)}
                        className="w-full px-2 py-1 rounded border border-slate-200 dark:border-slate-700 dark:bg-slate-800 text-xs"
                      />
                    </td>

                    {/* Coordinates */}
                    {coordinateMode === 'grid' ? (
                      <>
                        <td className="py-2 px-3">
                          <input
                            type="number"
                            step="0.1"
                            value={a.x ?? ''}
                            onChange={(e) => handleUpdate(i, 'x', parseFloat(e.target.value) || 0)}
                            className="w-full px-2 py-1 rounded border border-slate-200 dark:border-slate-700 dark:bg-slate-800 text-xs font-mono"
                          />
                        </td>
                        <td className="py-2 px-3">
                          <input
                            type="number"
                            step="0.1"
                            value={a.y ?? ''}
                            onChange={(e) => handleUpdate(i, 'y', parseFloat(e.target.value) || 0)}
                            className="w-full px-2 py-1 rounded border border-slate-200 dark:border-slate-700 dark:bg-slate-800 text-xs font-mono"
                          />
                        </td>
                      </>
                    ) : (
                      <>
                        <td className="py-2 px-3">
                          <input
                            type="number"
                            step="0.0001"
                            value={a.lat ?? ''}
                            onChange={(e) => handleUpdate(i, 'lat', parseFloat(e.target.value) || 0)}
                            className="w-full px-2 py-1 rounded border border-slate-200 dark:border-slate-700 dark:bg-slate-800 text-xs font-mono"
                          />
                        </td>
                        <td className="py-2 px-3">
                          <input
                            type="number"
                            step="0.0001"
                            value={a.lon ?? ''}
                            onChange={(e) => handleUpdate(i, 'lon', parseFloat(e.target.value) || 0)}
                            className="w-full px-2 py-1 rounded border border-slate-200 dark:border-slate-700 dark:bg-slate-800 text-xs font-mono"
                          />
                        </td>
                      </>
                    )}

                    {/* Value */}
                    <td className="py-2 px-3">
                      <input
                        type="number"
                        min="1"
                        step="1"
                        value={a.value}
                        onChange={(e) => handleUpdate(i, 'value', parseFloat(e.target.value) || 0)}
                        className={`w-full px-2 py-1 rounded border font-mono text-xs ${
                          isValueInvalid ? 'border-rose-500 bg-rose-50' : 'border-slate-200 dark:border-slate-700 dark:bg-slate-800'
                        }`}
                      />
                    </td>

                    {/* Priority Class */}
                    <td className="py-2 px-3">
                      <select
                        value={a.priority_class || 'auto'}
                        onChange={(e) => handleUpdate(i, 'priority_class', e.target.value === 'auto' ? null : (e.target.value as PriorityClass))}
                        className={`w-full px-2 py-1 rounded border text-xs font-medium ${
                          autoHigh 
                            ? 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-800' 
                            : 'bg-slate-50 text-slate-700 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700'
                        }`}
                      >
                        <option value="auto">Auto ({autoHigh ? 'High' : 'Low'})</option>
                        <option value="high">High</option>
                        <option value="low">Low</option>
                      </select>
                    </td>

                    {/* Threat Rate */}
                    <td className="py-2 px-3">
                      <input
                        type="number"
                        min="0"
                        step="0.05"
                        value={a.threat_rate}
                        onChange={(e) => handleUpdate(i, 'threat_rate', parseFloat(e.target.value) || 0)}
                        className={`w-full px-2 py-1 rounded border font-mono text-xs ${
                          isThreatInvalid ? 'border-rose-500 bg-rose-50' : 'border-slate-200 dark:border-slate-700 dark:bg-slate-800'
                        }`}
                      />
                    </td>

                    {/* Region */}
                    <td className="py-2 px-3">
                      <div className="relative flex items-center">
                        <input
                          type="text"
                          placeholder="Region"
                          value={a.region || ''}
                          onChange={(e) => handleUpdate(i, 'region', e.target.value || null)}
                          className={`w-full px-2 py-1 rounded border text-xs ${
                            a.region === 'Outside India'
                              ? 'border-rose-400 bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300'
                              : 'border-slate-200 dark:border-slate-700 dark:bg-slate-800'
                          } ${a.is_region_overridden ? 'italic font-medium text-indigo-700 dark:text-indigo-400' : ''}`}
                          title={a.is_region_overridden ? 'Manual override' : undefined}
                        />
                        {a.region === 'Outside India' && (
                          <span
                            className="absolute right-1 text-rose-500"
                            title="Point is outside India boundaries"
                          >
                            <AlertTriangle className="w-3.5 h-3.5" />
                          </span>
                        )}
                        {a.is_region_overridden && a.region !== 'Outside India' && (
                          <span
                            className="absolute right-1 text-[9px] px-1 bg-indigo-100 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-300 rounded font-mono"
                            title="Region manually overridden"
                          >
                            override
                          </span>
                        )}
                      </div>
                    </td>

                    {/* Action */}
                    <td className="py-2 px-3 text-center">
                      <button
                        onClick={() => handleDeleteRow(i)}
                        className="p-1 hover:text-rose-600 dark:hover:text-rose-400 text-slate-400 transition"
                        title="Delete asset"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Bulk Paste Modal */}
      {pasteModalOpen && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-lg w-full p-6 shadow-xl">
            <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100 mb-2">
              Bulk Paste Assets (TSV / Excel)
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mb-3">
              Paste rows copied directly from Excel. Columns expected:
              <br />
              <code className="text-indigo-600 dark:text-indigo-400">ID &bull; Name &bull; Coord1 &bull; Coord2 &bull; Value &bull; Priority(high/low) &bull; ThreatRate &bull; Region</code>
            </p>
            <textarea
              rows={6}
              value={pasteText}
              onChange={(e) => setPasteText(e.target.value)}
              placeholder="A1	Radar Station	5.0	4.5	100	high	0.35	Sector1"
              className="w-full p-3 font-mono text-xs border border-slate-200 dark:border-slate-700 dark:bg-slate-800 rounded-xl mb-4 focus:ring-2 focus:ring-indigo-500 focus:outline-hidden"
            />
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setPasteModalOpen(false)}
                className="px-4 py-2 rounded-lg text-xs font-medium bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200"
              >
                Cancel
              </button>
              <button
                onClick={handleApplyPaste}
                className="px-4 py-2 rounded-lg text-xs font-medium bg-indigo-600 hover:bg-indigo-700 text-white"
              >
                Append Rows
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
