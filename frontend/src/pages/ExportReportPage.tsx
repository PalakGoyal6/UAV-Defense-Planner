import React from 'react';
import { Scenario, FullPlanResponse } from '../types/defense';
import Papa from 'papaparse';
import { Download, Printer, FileText, FileSpreadsheet, Shield } from 'lucide-react';

interface ExportReportPageProps {
  scenario: Scenario;
  plan: FullPlanResponse | null;
}

export const ExportReportPage: React.FC<ExportReportPageProps> = ({
  scenario,
  plan
}) => {
  const downloadJson = (obj: any, filename: string) => {
    const jsonStr = JSON.stringify(obj, null, 2);
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const downloadCsv = (data: any[], filename: string) => {
    const csv = Papa.unparse(data);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      {/* Action Header (Hidden during browser print) */}
      <div className="print:hidden p-5 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs flex flex-wrap items-center justify-between gap-4">
        <div>
          <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">
            Export Data & Printable Course Project Report
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Generate formal PDF reports for sign-off or export clean CSV and JSON datasets.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={handlePrint}
            className="flex items-center gap-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-semibold shadow-md transition"
          >
            <Printer className="w-4 h-4" /> Print / Save as PDF
          </button>
          <button
            onClick={() => downloadJson(scenario, `${scenario.name.toLowerCase().replace(/\s+/g, '_')}_scenario.json`)}
            className="flex items-center gap-1.5 px-3 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-xl text-xs font-medium transition"
          >
            <FileText className="w-4 h-4" /> Scenario JSON
          </button>
          {plan && (
            <button
              onClick={() => downloadJson(plan, `${scenario.name.toLowerCase().replace(/\s+/g, '_')}_results.json`)}
              className="flex items-center gap-1.5 px-3 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-xl text-xs font-medium transition"
            >
              <FileSpreadsheet className="w-4 h-4" /> Results JSON
            </button>
          )}
        </div>
      </div>

      {/* CSV Quick Download Buttons */}
      <div className="print:hidden grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
        <button
          onClick={() => downloadCsv(scenario.assets, 'assets.csv')}
          className="p-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-left hover:border-indigo-400 transition"
        >
          <div className="font-semibold text-slate-800 dark:text-slate-200 flex items-center justify-between">
            <span>Assets CSV</span>
            <Download className="w-3.5 h-3.5 text-slate-400" />
          </div>
          <div className="text-[10px] text-slate-400 mt-0.5">{scenario.assets.length} items</div>
        </button>

        <button
          onClick={() => downloadCsv(scenario.sites, 'candidate_sites.csv')}
          className="p-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-left hover:border-indigo-400 transition"
        >
          <div className="font-semibold text-slate-800 dark:text-slate-200 flex items-center justify-between">
            <span>Sites CSV</span>
            <Download className="w-3.5 h-3.5 text-slate-400" />
          </div>
          <div className="text-[10px] text-slate-400 mt-0.5">{scenario.sites.length} items</div>
        </button>

        {plan && (
          <>
            <button
              onClick={() => downloadCsv(plan.location.assignments, 'assignments.csv')}
              className="p-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-left hover:border-indigo-400 transition"
            >
              <div className="font-semibold text-slate-800 dark:text-slate-200 flex items-center justify-between">
                <span>Assignments CSV</span>
                <Download className="w-3.5 h-3.5 text-slate-400" />
              </div>
              <div className="text-[10px] text-slate-400 mt-0.5">Asset assignments</div>
            </button>

            <button
              onClick={() => downloadCsv(Object.values(plan.inventory.site_inventory), 'inventory_rules.csv')}
              className="p-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-left hover:border-indigo-400 transition"
            >
              <div className="font-semibold text-slate-800 dark:text-slate-200 flex items-center justify-between">
                <span>Inventory Rules CSV</span>
                <Download className="w-3.5 h-3.5 text-slate-400" />
              </div>
              <div className="text-[10px] text-slate-400 mt-0.5">Reorder points & EOQ</div>
            </button>
          </>
        )}
      </div>

      {/* Printable Report Document */}
      <div className="bg-white text-slate-900 p-8 md:p-12 rounded-2xl border border-slate-200 shadow-sm print:shadow-none print:border-none print:p-0 space-y-8">
        {/* Report Header */}
        <div className="border-b border-slate-300 pb-6 flex items-start justify-between">
          <div>
            <div className="text-xs font-bold text-indigo-700 uppercase tracking-wider mb-1 flex items-center gap-1.5">
              <Shield className="w-4 h-4" /> Operations Research Project MSL304
            </div>
            <h1 className="text-2xl font-black tracking-tight text-slate-900">
              UAV Defense Resource Optimization Plan
            </h1>
            <div className="text-xs text-slate-500 mt-1">
              Scenario: <strong>{scenario.name}</strong> &bull; Generated: {new Date().toLocaleDateString()}
            </div>
          </div>
          <div className="text-right text-xs text-slate-500 font-mono">
            <div>Mode: {scenario.coordinate_mode.toUpperCase()}</div>
            <div>Budget: ₹{scenario.parameters.budget.toLocaleString()}</div>
          </div>
        </div>

        {/* Executive Plan Summary */}
        {plan ? (
          <div className="space-y-6">
            <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
              <h2 className="text-xs font-bold text-slate-900 uppercase tracking-wide">
                1. Executive Directive & Strategy Summary
              </h2>
              <p className="text-xs text-slate-800 leading-relaxed">
                Deploy defense units at candidate sites <strong>{plan.location.opened_sites.join(', ')}</strong> at an opening cost of ₹{plan.location.total_site_cost.toLocaleString()} (within budget ₹{plan.location.budget.toLocaleString()}), safeguarding <strong>{plan.location.pct_value_protected}%</strong> (score: {plan.location.total_value_protected} / {plan.location.total_possible_value}) of defended asset value.
              </p>
              <p className="text-xs text-slate-800 leading-relaxed">
                Install <strong>{plan.channels.total_channels} engagement channels</strong> to guarantee drone leak probability remains below α = {scenario.parameters.target_leak_probability}. Stock <strong>{plan.inventory.total_stock_Q_star} interceptors</strong>, reserving <strong>{plan.reserve.reserve_y1_star} units exclusively for high-value assets</strong>.
              </p>
            </div>

            {/* Key Metric Summary Table */}
            <div className="space-y-2">
              <h2 className="text-xs font-bold text-slate-900 uppercase tracking-wide">
                2. Key Performance Indicators
              </h2>
              <table className="w-full text-left text-xs border border-slate-200">
                <thead className="bg-slate-100 font-bold">
                  <tr>
                    <th className="p-2 border">Value Protected</th>
                    <th className="p-2 border">Sites Opened</th>
                    <th className="p-2 border">Total Cost</th>
                    <th className="p-2 border">Channels</th>
                    <th className="p-2 border">Stock Q*</th>
                    <th className="p-2 border">Reserve y₁*</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td className="p-2 border font-bold text-emerald-700">{plan.location.pct_value_protected}% ({plan.location.total_value_protected})</td>
                    <td className="p-2 border font-mono">{plan.location.opened_sites.join(', ')}</td>
                    <td className="p-2 border font-mono">₹{plan.location.total_site_cost.toLocaleString()}</td>
                    <td className="p-2 border font-mono">{plan.channels.total_channels}</td>
                    <td className="p-2 border font-mono">{plan.inventory.total_stock_Q_star}</td>
                    <td className="p-2 border font-mono font-bold text-amber-700">{plan.reserve.reserve_y1_star}</td>
                  </tr>
                </tbody>
              </table>
            </div>

            {/* Operational Reorder & Defense Rules */}
            <div className="space-y-2">
              <h2 className="text-xs font-bold text-slate-900 uppercase tracking-wide">
                3. Operational Directives & Reorder Policy
              </h2>
              <div className="space-y-1.5 text-xs text-slate-800">
                <div className="p-2 bg-slate-50 border rounded-lg">
                  <strong>High-Value Reserve:</strong> {plan.reserve.plain_english_rule}
                </div>
                {Object.values(plan.inventory.site_inventory).map(inv => (
                  <div key={inv.site_id} className="p-2 bg-slate-50 border rounded-lg font-mono text-[11px]">
                    <strong>Site {inv.site_id}:</strong> {inv.plain_english_rule} (Stock: {inv.allocated_stock_Q} units, Lead Time: {inv.lead_time_days} days).
                  </div>
                ))}
              </div>
            </div>

            {/* Show Working Traces */}
            <div className="space-y-2 pt-2">
              <h2 className="text-xs font-bold text-slate-900 uppercase tracking-wide">
                4. Mathematical Traces & Show Working
              </h2>
              <div className="space-y-3">
                {plan.working.map(w => (
                  <div key={w.step_number} className="p-3 bg-slate-50 border border-slate-200 rounded-lg text-xs font-mono">
                    <div className="font-bold text-slate-900 mb-1">{w.title}</div>
                    {w.details.map((d, i) => (
                      <div key={i} className="text-slate-700">&bull; {d}</div>
                    ))}
                  </div>
                ))}
              </div>
            </div>
          </div>
        ) : (
          <div className="text-center py-12 text-slate-400 text-xs">
            Plan not yet computed. Click "Run Defense Plan" to generate results.
          </div>
        )}
      </div>
    </div>
  );
};
