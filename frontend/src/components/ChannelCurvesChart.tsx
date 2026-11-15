import React, { useState } from 'react';
import { Step3QueueingOutput } from '../types/defense';
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer, ReferenceLine
} from 'recharts';

interface ChannelCurvesChartProps {
  queueingOutput: Step3QueueingOutput;
  targetLeakProbability: number;
}

export const ChannelCurvesChart: React.FC<ChannelCurvesChartProps> = ({
  queueingOutput,
  targetLeakProbability
}) => {
  const siteIds = Object.keys(queueingOutput.site_channels);
  const [selectedSiteId, setSelectedSiteId] = useState<string>(siteIds[0] || '');

  if (siteIds.length === 0) {
    return (
      <div className="p-8 text-center text-slate-400 text-xs">
        No defense units opened. Sizing curves unavailable.
      </div>
    );
  }

  const activeSiteResult = queueingOutput.site_channels[selectedSiteId] || queueingOutput.site_channels[siteIds[0]];
  const chartData = activeSiteResult?.curve || [];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h4 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
            Erlang-B Sizing Curve & Marginal Diminishing Returns
          </h4>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Offered load a = {activeSiteResult?.offered_load_erlangs.toFixed(3)} Erl &bull; Sized to {activeSiteResult?.channels_allocated} channels
          </p>
        </div>

        <div className="flex items-center gap-2">
          <label className="text-xs text-slate-500 font-medium">Select Site:</label>
          <select
            value={selectedSiteId}
            onChange={(e) => setSelectedSiteId(e.target.value)}
            className="px-2.5 py-1 text-xs rounded-lg border border-slate-200 dark:border-slate-700 dark:bg-slate-800 font-mono font-bold"
          >
            {siteIds.map(sId => (
              <option key={sId} value={sId}>
                Site {sId} ({queueingOutput.site_channels[sId].channels_allocated} channels)
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Line Chart: Leak Probability B(c, a) vs c */}
        <div className="p-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-xs">
          <div className="text-xs font-semibold text-slate-700 dark:text-slate-300 mb-2">
            Leak Probability B(c, a) vs Channels
          </div>
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData} margin={{ top: 10, right: 20, left: -10, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-slate-100 dark:stroke-slate-800" />
                <XAxis dataKey="channels" label={{ value: 'Channels (c)', position: 'insideBottomRight', offset: -5 }} textAnchor="end" className="text-[10px]" />
                <YAxis domain={[0, 1]} className="text-[10px]" />
                <Tooltip
                  formatter={(val: any) => [Number(val).toFixed(4), 'Leak Probability']}
                  labelFormatter={(c) => `${c} Channel(s)`}
                />
                <ReferenceLine
                  y={targetLeakProbability}
                  stroke="#ef4444"
                  strokeDasharray="4 4"
                  label={{ value: `α = ${targetLeakProbability}`, fill: '#ef4444', fontSize: 10, position: 'insideTopRight' }}
                />
                <Line
                  type="monotone"
                  dataKey="leak_probability"
                  stroke="#3b82f6"
                  strokeWidth={2.5}
                  dot={{ r: 3 }}
                  activeDot={{ r: 5 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Bar Chart: Marginal Leak Reduction per Channel */}
        <div className="p-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-xs">
          <div className="text-xs font-semibold text-slate-700 dark:text-slate-300 mb-2">
            Marginal Leak Reduction: B(c - 1) - B(c)
          </div>
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} margin={{ top: 10, right: 20, left: -10, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-slate-100 dark:stroke-slate-800" />
                <XAxis dataKey="channels" label={{ value: 'Channel (c)', position: 'insideBottomRight', offset: -5 }} textAnchor="end" className="text-[10px]" />
                <YAxis className="text-[10px]" />
                <Tooltip
                  formatter={(val: any) => [Number(val).toFixed(4), 'Marginal Reduction']}
                  labelFormatter={(c) => `Channel ${c}`}
                />
                <Bar dataKey="marginal_reduction" fill="#10b981" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
};
