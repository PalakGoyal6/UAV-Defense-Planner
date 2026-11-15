import React, { useState } from 'react';
import { CandidateSite, CoordinateMode } from '../types/defense';
import Papa from 'papaparse';
import { Plus, Trash2, Upload, Download, Clipboard, AlertCircle } from 'lucide-react';

interface SitesTableProps {
  sites: CandidateSite[];
  onChange: (sites: CandidateSite[]) => void;
  coordinateMode: CoordinateMode;
}

export const SitesTable: React.FC<SitesTableProps> = ({
  sites,
  onChange,
  coordinateMode
}) => {
  const [pasteModalOpen, setPasteModalOpen] = useState(false);
  const [pasteText, setPasteText] = useState('');

  const idCounts = sites.reduce((acc, s) => {
    acc[s.id] = (acc[s.id] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const handleUpdate = (index: number, field: keyof CandidateSite, value: any) => {
    const updated = [...sites];
    updated[index] = { ...updated[index], [field]: value };
    onChange(updated);
  };

  const handleAddRow = () => {
    const nextIdx = sites.length + 1;
    const newSite: CandidateSite = {
      id: `S${nextIdx}`,
      name: `Site ${nextIdx}`,
      x: coordinateMode === 'grid' ? 5.0 : null,
      y: coordinateMode === 'grid' ? 5.0 : null,
      lat: coordinateMode === 'geo' ? 28.5 : null,
      lon: coordinateMode === 'geo' ? 77.2 : null,
      cost: 25.0,
      range_km: 3.5,
      max_channels: 10,
      channel_cost: 0.0,
      depot_distance_km: null,
      region: ''
    };
    onChange([...sites, newSite]);
  };

  const handleDeleteRow = (index: number) => {
    const updated = sites.filter((_, i) => i !== index);
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
        const parsedSites: CandidateSite[] = results.data.map((row: any, idx: number) => {
          return {
            id: String(row.id || `S${idx + 1}`).trim(),
            name: String(row.name || `Site ${idx + 1}`).trim(),
            x: row.x !== undefined && row.x !== null ? Number(row.x) : null,
            y: row.y !== undefined && row.y !== null ? Number(row.y) : null,
            lat: row.lat !== undefined && row.lat !== null ? Number(row.lat) : null,
            lon: row.lon !== undefined && row.lon !== null ? Number(row.lon) : null,
            cost: Math.max(1, Number(row.cost) || 20),
            range_km: Math.max(0.5, Number(row.range_km) || 3.0),
            max_channels: Math.max(1, Number(row.max_channels) || 10),
            channel_cost: Math.max(0, Number(row.channel_cost) || 0),
            depot_distance_km: row.depot_distance_km ? Number(row.depot_distance_km) : null,
            region: row.region ? String(row.region).trim() : null
          };
        });
        if (parsedSites.length > 0) {
          onChange(parsedSites);
        }
      }
    });
    e.target.value = '';
  };

  const handleExportCsv = () => {
    const csv = Papa.unparse(sites);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', 'candidate_sites.csv');
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

    const newSites: CandidateSite[] = parsed.data.map((row: any, i: number) => {
      // Expecting: id, name, coord1, coord2, cost, range_km, max_channels, channel_cost, depot_dist, region
      const id = String(row[0] || `S${sites.length + i + 1}`).trim();
      const name = String(row[1] || `Site ${sites.length + i + 1}`).trim();
      const coord1 = Number(row[2]) || 0;
      const coord2 = Number(row[3]) || 0;
      const cost = Math.max(1, Number(row[4]) || 25);
      const range_km = Math.max(0.5, Number(row[5]) || 3.0);
      const max_channels = Math.max(1, Number(row[6]) || 10);
      const channel_cost = Math.max(0, Number(row[7]) || 0);
      const depot_dist = row[8] ? Number(row[8]) : null;
      const region = row[9] ? String(row[9]).trim() : null;

      return {
        id,
        name,
        x: coordinateMode === 'grid' ? coord1 : null,
        y: coordinateMode === 'grid' ? coord2 : null,
        lat: coordinateMode === 'geo' ? coord1 : null,
        lon: coordinateMode === 'geo' ? coord2 : null,
        cost,
        range_km,
        max_channels,
        channel_cost,
        depot_distance_km: depot_dist,
        region
      };
    });

    if (newSites.length > 0) {
      onChange([...sites, ...newSites]);
      setPasteText('');
      setPasteModalOpen(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <button
            onClick={handleAddRow}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-medium transition shadow-sm"
          >
            <Plus className="w-4 h-4" /> Add Candidate Site
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

      <div className="overflow-x-auto border border-slate-200 dark:border-slate-800 rounded-xl bg-white dark:bg-slate-900 shadow-sm">
        <table className="w-full text-left text-xs">
          <thead className="bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300">
            <tr>
              <th className="py-2.5 px-3 w-16">ID</th>
              <th className="py-2.5 px-3 min-w-[130px]">Name</th>
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
              <th className="py-2.5 px-3 w-28">Cost (cⱼ ₹)</th>
              <th className="py-2.5 px-3 w-28">Range (km)</th>
              <th className="py-2.5 px-3 w-24">Max Channels</th>
              <th className="py-2.5 px-3 w-24">Channel Cost</th>
              <th className="py-2.5 px-3 w-28">Depot Dist (km)</th>
              <th className="py-2.5 px-3 w-20">Region</th>
              <th className="py-2.5 px-3 w-12 text-center">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
            {sites.length === 0 ? (
              <tr>
                <td colSpan={10} className="py-8 text-center text-slate-400">
                  No candidate sites defined. Click "Add Candidate Site" or import a CSV.
                </td>
              </tr>
            ) : (
              sites.map((s, i) => {
                const isDuplicate = (idCounts[s.id] || 0) > 1;
                const isCostInvalid = Number(s.cost) <= 0 || isNaN(Number(s.cost));
                const isRangeInvalid = Number(s.range_km) <= 0 || isNaN(Number(s.range_km));

                return (
                  <tr key={i} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/40 transition">
                    {/* ID */}
                    <td className="py-2 px-3">
                      <div className="relative">
                        <input
                          type="text"
                          value={s.id}
                          onChange={(e) => handleUpdate(i, 'id', e.target.value)}
                          className={`w-full px-2 py-1 rounded border font-mono font-bold text-xs ${
                            isDuplicate ? 'border-rose-500 bg-rose-50' : 'border-slate-200 dark:border-slate-700 dark:bg-slate-800'
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
                        value={s.name}
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
                            value={s.x ?? ''}
                            onChange={(e) => handleUpdate(i, 'x', parseFloat(e.target.value) || 0)}
                            className="w-full px-2 py-1 rounded border border-slate-200 dark:border-slate-700 dark:bg-slate-800 text-xs font-mono"
                          />
                        </td>
                        <td className="py-2 px-3">
                          <input
                            type="number"
                            step="0.1"
                            value={s.y ?? ''}
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
                            value={s.lat ?? ''}
                            onChange={(e) => handleUpdate(i, 'lat', parseFloat(e.target.value) || 0)}
                            className="w-full px-2 py-1 rounded border border-slate-200 dark:border-slate-700 dark:bg-slate-800 text-xs font-mono"
                          />
                        </td>
                        <td className="py-2 px-3">
                          <input
                            type="number"
                            step="0.0001"
                            value={s.lon ?? ''}
                            onChange={(e) => handleUpdate(i, 'lon', parseFloat(e.target.value) || 0)}
                            className="w-full px-2 py-1 rounded border border-slate-200 dark:border-slate-700 dark:bg-slate-800 text-xs font-mono"
                          />
                        </td>
                      </>
                    )}

                    {/* Cost */}
                    <td className="py-2 px-3">
                      <input
                        type="number"
                        min="1"
                        step="1"
                        value={s.cost}
                        onChange={(e) => handleUpdate(i, 'cost', parseFloat(e.target.value) || 0)}
                        className={`w-full px-2 py-1 rounded border font-mono text-xs ${
                          isCostInvalid ? 'border-rose-500 bg-rose-50' : 'border-slate-200 dark:border-slate-700 dark:bg-slate-800'
                        }`}
                      />
                    </td>

                    {/* Range KM */}
                    <td className="py-2 px-3">
                      <input
                        type="number"
                        min="0.1"
                        step="0.5"
                        value={s.range_km}
                        onChange={(e) => handleUpdate(i, 'range_km', parseFloat(e.target.value) || 0)}
                        className={`w-full px-2 py-1 rounded border font-mono text-xs ${
                          isRangeInvalid ? 'border-rose-500 bg-rose-50' : 'border-slate-200 dark:border-slate-700 dark:bg-slate-800'
                        }`}
                      />
                    </td>

                    {/* Max Channels */}
                    <td className="py-2 px-3">
                      <input
                        type="number"
                        min="1"
                        max="50"
                        step="1"
                        value={s.max_channels}
                        onChange={(e) => handleUpdate(i, 'max_channels', parseInt(e.target.value, 10) || 10)}
                        className="w-full px-2 py-1 rounded border border-slate-200 dark:border-slate-700 dark:bg-slate-800 font-mono text-xs"
                      />
                    </td>

                    {/* Channel Cost */}
                    <td className="py-2 px-3">
                      <input
                        type="number"
                        min="0"
                        step="0.5"
                        value={s.channel_cost}
                        onChange={(e) => handleUpdate(i, 'channel_cost', parseFloat(e.target.value) || 0)}
                        className="w-full px-2 py-1 rounded border border-slate-200 dark:border-slate-700 dark:bg-slate-800 font-mono text-xs"
                      />
                    </td>

                    {/* Depot Dist KM (optional) */}
                    <td className="py-2 px-3">
                      <input
                        type="number"
                        placeholder="Auto"
                        value={s.depot_distance_km ?? ''}
                        onChange={(e) => handleUpdate(i, 'depot_distance_km', e.target.value === '' ? null : parseFloat(e.target.value))}
                        className="w-full px-2 py-1 rounded border border-slate-200 dark:border-slate-700 dark:bg-slate-800 font-mono text-xs"
                      />
                    </td>

                    {/* Region */}
                    <td className="py-2 px-3">
                      <input
                        type="text"
                        placeholder="Region"
                        value={s.region || ''}
                        onChange={(e) => handleUpdate(i, 'region', e.target.value || null)}
                        className="w-full px-2 py-1 rounded border border-slate-200 dark:border-slate-700 dark:bg-slate-800 text-xs"
                      />
                    </td>

                    {/* Action */}
                    <td className="py-2 px-3 text-center">
                      <button
                        onClick={() => handleDeleteRow(i)}
                        className="p-1 hover:text-rose-600 dark:hover:text-rose-400 text-slate-400 transition"
                        title="Delete site"
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

      {pasteModalOpen && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-lg w-full p-6 shadow-xl">
            <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100 mb-2">
              Bulk Paste Candidate Sites (TSV / Excel)
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mb-3">
              Paste rows copied directly from Excel. Columns:
              <br />
              <code className="text-indigo-600 dark:text-indigo-400">ID &bull; Name &bull; Coord1 &bull; Coord2 &bull; Cost &bull; RangeKm &bull; MaxChannels &bull; ChannelCost &bull; DepotDist &bull; Region</code>
            </p>
            <textarea
              rows={6}
              value={pasteText}
              onChange={(e) => setPasteText(e.target.value)}
              placeholder="S1	Candidate North	4.0	4.0	30	3.0	8	0		Sector1"
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
