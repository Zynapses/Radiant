'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  FileBarChart, RefreshCw, Plus, Play, Download, Trash2, Eye,
  BarChart3, Settings, Database, Filter, Table,
} from 'lucide-react';

interface DynamicReport {
  id: string;
  name: string;
  description: string;
  dataSource: string;
  columns: string[];
  filters: Array<{ field: string; operator: string; value: string }>;
  groupBy: string[];
  orderBy: string[];
  limit: number;
  createdAt: string;
  lastRunAt: string | null;
  rowCount: number | null;
}

const API = '/api/admin/dynamic-reports';

async function fetchApi(path: string, options?: RequestInit) {
  const res = await fetch(`${API}${path}`, { headers: { 'Content-Type': 'application/json' }, ...options });
  if (!res.ok) throw new Error(`API error: ${res.status}`);
  return res.json();
}

function StatCard({ icon: Icon, label, value, color }: { icon: React.ElementType; label: string; value: string | number; color: string }) {
  return (
    <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-4">
      <div className="flex items-center gap-2 mb-2">
        <Icon className={`h-4 w-4 ${color}`} />
        <span className="text-xs text-slate-400">{label}</span>
      </div>
      <div className="text-2xl font-bold text-white">{value}</div>
    </div>
  );
}

export default function DynamicReportsPage() {
  const [reports, setReports] = useState<DynamicReport[]>([]);
  const [dataSources, setDataSources] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'reports' | 'builder'>('reports');
  const [newReport, setNewReport] = useState({ name: '', description: '', dataSource: '', columns: '', limit: 100 });

  const load = useCallback(async () => {
    try {
      const [reportsData, sourcesData] = await Promise.all([
        fetchApi('/list').catch(() => ({ reports: [] })),
        fetchApi('/data-sources').catch(() => ({ sources: [] })),
      ]);
      setReports(reportsData.reports || reportsData || []);
      setDataSources(sourcesData.sources || sourcesData || []);
    } catch (err) {
      console.error('Failed to load', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const runReport = async (id: string) => {
    try {
      const result = await fetchApi(`/${id}/run`, { method: 'POST' });
      alert(`Report complete: ${result.rowCount || 0} rows`);
      await load();
    } catch (err) {
      alert(`Failed: ${err instanceof Error ? err.message : 'Unknown'}`);
    }
  };

  const createReport = async () => {
    try {
      await fetchApi('', {
        method: 'POST',
        body: JSON.stringify({
          ...newReport,
          columns: newReport.columns.split(',').map(c => c.trim()).filter(Boolean),
        }),
      });
      setNewReport({ name: '', description: '', dataSource: '', columns: '', limit: 100 });
      setActiveTab('reports');
      await load();
    } catch (err) {
      alert(`Failed: ${err instanceof Error ? err.message : 'Unknown'}`);
    }
  };

  if (loading) {
    return <div className="flex items-center justify-center h-64"><RefreshCw className="h-8 w-8 animate-spin text-indigo-400" /></div>;
  }

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-3">
            <FileBarChart className="h-7 w-7 text-indigo-400" />
            Dynamic Reports
          </h1>
          <p className="text-sm text-slate-400 mt-1">Schema-adaptive report builder — query any data source with custom columns and filters</p>
        </div>
        <button onClick={load} className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white text-sm rounded-lg flex items-center gap-2">
          <RefreshCw className="h-4 w-4" /> Refresh
        </button>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <StatCard icon={FileBarChart} label="Saved Reports" value={reports.length} color="text-indigo-400" />
        <StatCard icon={Database} label="Data Sources" value={dataSources.length} color="text-blue-400" />
        <StatCard icon={Table} label="Total Rows Generated" value={reports.reduce((s, r) => s + (r.rowCount || 0), 0).toLocaleString()} color="text-emerald-400" />
      </div>

      <div className="flex gap-1 bg-slate-800/50 rounded-lg p-1">
        {(['reports', 'builder'] as const).map(tab => (
          <button key={tab} onClick={() => setActiveTab(tab)}
            className={`flex-1 px-4 py-2 text-sm rounded-md transition-colors ${activeTab === tab ? 'bg-slate-700 text-white' : 'text-slate-400 hover:text-white'}`}>
            {tab === 'reports' ? 'Saved Reports' : 'Report Builder'}
          </button>
        ))}
      </div>

      {activeTab === 'reports' && (
        <div className="space-y-2">
          {reports.length === 0 ? (
            <div className="text-center text-slate-500 py-12">No reports yet. Use the Report Builder to create one.</div>
          ) : reports.map(report => (
            <div key={report.id} className="bg-slate-800/30 border border-slate-700/50 rounded-xl p-4 flex items-center justify-between">
              <div>
                <span className="font-medium text-white">{report.name}</span>
                <div className="flex items-center gap-3 mt-1">
                  <span className="text-xs text-slate-500">Source: {report.dataSource}</span>
                  <span className="text-xs text-slate-500">{report.columns.length} columns</span>
                  {report.filters?.length > 0 && <span className="text-xs text-slate-500">{report.filters.length} filters</span>}
                  {report.lastRunAt && <span className="text-xs text-slate-500">Last run: {new Date(report.lastRunAt).toLocaleDateString()}</span>}
                  {report.rowCount != null && <span className="text-xs text-emerald-400">{report.rowCount.toLocaleString()} rows</span>}
                </div>
              </div>
              <div className="flex gap-2">
                <button onClick={() => runReport(report.id)} className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white text-xs rounded-lg flex items-center gap-1">
                  <Play className="h-3 w-3" /> Run
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {activeTab === 'builder' && (
        <div className="bg-slate-800/30 border border-slate-700/50 rounded-xl p-6 space-y-4">
          <h3 className="text-sm font-semibold text-white">Create New Report</h3>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs text-slate-400">Report Name</label>
              <input type="text" value={newReport.name} onChange={e => setNewReport({ ...newReport, name: e.target.value })}
                className="w-full mt-1 bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-white text-sm" placeholder="Monthly Usage Summary" />
            </div>
            <div>
              <label className="text-xs text-slate-400">Data Source</label>
              <select value={newReport.dataSource} onChange={e => setNewReport({ ...newReport, dataSource: e.target.value })}
                className="w-full mt-1 bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-white text-sm">
                <option value="">Select a data source...</option>
                {dataSources.map(ds => <option key={ds} value={ds}>{ds}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label className="text-xs text-slate-400">Description</label>
            <input type="text" value={newReport.description} onChange={e => setNewReport({ ...newReport, description: e.target.value })}
              className="w-full mt-1 bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-white text-sm" placeholder="Optional description" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs text-slate-400">Columns (comma-separated)</label>
              <input type="text" value={newReport.columns} onChange={e => setNewReport({ ...newReport, columns: e.target.value })}
                className="w-full mt-1 bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-white text-sm" placeholder="id, name, created_at, status" />
            </div>
            <div>
              <label className="text-xs text-slate-400">Row Limit</label>
              <input type="number" value={newReport.limit} onChange={e => setNewReport({ ...newReport, limit: parseInt(e.target.value) || 100 })}
                className="w-full mt-1 bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-white text-sm" />
            </div>
          </div>
          <div className="flex justify-end">
            <button onClick={createReport} disabled={!newReport.name || !newReport.dataSource}
              className="px-6 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-sm rounded-lg flex items-center gap-2">
              <Plus className="h-4 w-4" /> Create Report
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
