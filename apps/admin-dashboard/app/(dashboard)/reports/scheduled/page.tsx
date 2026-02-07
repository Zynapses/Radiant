'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  Clock, RefreshCw, Plus, Play, Pause, Trash2, FileBarChart,
  BarChart3, Calendar, Settings, AlertTriangle, Check,
} from 'lucide-react';

interface ScheduledReport {
  id: string;
  name: string;
  reportType: string;
  schedule: string;
  enabled: boolean;
  lastRunAt: string | null;
  lastRunStatus: string | null;
  nextRunAt: string | null;
  recipients: string[];
  format: string;
  createdAt: string;
}

interface ReportRun {
  id: string;
  reportId: string;
  status: string;
  startedAt: string;
  completedAt: string | null;
  rowCount: number | null;
  fileSize: number | null;
  error: string | null;
}

const API = '/api/admin/scheduled-reports';

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

export default function ScheduledReportsPage() {
  const [reports, setReports] = useState<ScheduledReport[]>([]);
  const [runs, setRuns] = useState<ReportRun[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'schedules' | 'history'>('schedules');

  const load = useCallback(async () => {
    try {
      const [reportsData, runsData] = await Promise.all([
        fetchApi('/list').catch(() => ({ reports: [] })),
        fetchApi('/runs').catch(() => ({ runs: [] })),
      ]);
      setReports(reportsData.reports || reportsData || []);
      setRuns(runsData.runs || runsData || []);
    } catch (err) {
      console.error('Failed to load', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const toggleReport = async (id: string, enabled: boolean) => {
    try {
      await fetchApi(`/${id}/toggle`, { method: 'POST', body: JSON.stringify({ enabled }) });
      await load();
    } catch (err) {
      alert(`Failed: ${err instanceof Error ? err.message : 'Unknown'}`);
    }
  };

  const runNow = async (id: string) => {
    try {
      await fetchApi(`/${id}/run`, { method: 'POST' });
      alert('Report execution started');
      await load();
    } catch (err) {
      alert(`Failed: ${err instanceof Error ? err.message : 'Unknown'}`);
    }
  };

  if (loading) {
    return <div className="flex items-center justify-center h-64"><RefreshCw className="h-8 w-8 animate-spin text-blue-400" /></div>;
  }

  const enabledCount = reports.filter(r => r.enabled).length;
  const failedCount = runs.filter(r => r.status === 'failed').length;

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-3">
            <Clock className="h-7 w-7 text-blue-400" />
            Scheduled Reports
          </h1>
          <p className="text-sm text-slate-400 mt-1">Automated report generation on configurable schedules</p>
        </div>
        <button onClick={load} className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white text-sm rounded-lg flex items-center gap-2">
          <RefreshCw className="h-4 w-4" /> Refresh
        </button>
      </div>

      <div className="grid grid-cols-4 gap-4">
        <StatCard icon={FileBarChart} label="Total Schedules" value={reports.length} color="text-blue-400" />
        <StatCard icon={Check} label="Enabled" value={enabledCount} color="text-emerald-400" />
        <StatCard icon={BarChart3} label="Total Runs" value={runs.length} color="text-purple-400" />
        <StatCard icon={AlertTriangle} label="Failed Runs" value={failedCount} color="text-red-400" />
      </div>

      <div className="flex gap-1 bg-slate-800/50 rounded-lg p-1">
        {(['schedules', 'history'] as const).map(tab => (
          <button key={tab} onClick={() => setActiveTab(tab)}
            className={`flex-1 px-4 py-2 text-sm rounded-md transition-colors capitalize ${activeTab === tab ? 'bg-slate-700 text-white' : 'text-slate-400 hover:text-white'}`}>
            {tab === 'schedules' ? 'Report Schedules' : 'Run History'}
          </button>
        ))}
      </div>

      {activeTab === 'schedules' && (
        <div className="space-y-2">
          {reports.length === 0 ? (
            <div className="text-center text-slate-500 py-12">No scheduled reports configured.</div>
          ) : reports.map(report => (
            <div key={report.id} className="bg-slate-800/30 border border-slate-700/50 rounded-xl p-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <FileBarChart className={`h-5 w-5 ${report.enabled ? 'text-blue-400' : 'text-slate-600'}`} />
                <div>
                  <span className="font-medium text-white">{report.name}</span>
                  <div className="flex items-center gap-3 mt-1">
                    <span className="text-xs text-slate-500">{report.reportType}</span>
                    <span className="text-xs text-slate-500">Schedule: {report.schedule}</span>
                    <span className="text-xs text-slate-500">Format: {report.format}</span>
                    {report.recipients.length > 0 && (
                      <span className="text-xs text-slate-500">{report.recipients.length} recipients</span>
                    )}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {report.lastRunAt && (
                  <span className="text-xs text-slate-500">Last: {new Date(report.lastRunAt).toLocaleDateString()}</span>
                )}
                {report.nextRunAt && (
                  <span className="text-xs text-slate-500">Next: {new Date(report.nextRunAt).toLocaleDateString()}</span>
                )}
                <button onClick={() => runNow(report.id)} className="px-2 py-1 bg-blue-600 hover:bg-blue-500 text-white text-xs rounded flex items-center gap-1">
                  <Play className="h-3 w-3" /> Run Now
                </button>
                <button onClick={() => toggleReport(report.id, !report.enabled)}
                  className={`px-2 py-1 text-xs rounded flex items-center gap-1 ${report.enabled ? 'bg-emerald-600 hover:bg-emerald-500 text-white' : 'bg-slate-700 hover:bg-slate-600 text-slate-300'}`}>
                  {report.enabled ? <><Pause className="h-3 w-3" /> Enabled</> : <><Play className="h-3 w-3" /> Disabled</>}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {activeTab === 'history' && (
        <div className="bg-slate-800/30 border border-slate-700/50 rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-slate-800/50">
              <tr>
                <th className="text-left p-3 text-slate-400 font-medium">Report</th>
                <th className="text-center p-3 text-slate-400 font-medium">Status</th>
                <th className="text-left p-3 text-slate-400 font-medium">Started</th>
                <th className="text-right p-3 text-slate-400 font-medium">Rows</th>
                <th className="text-right p-3 text-slate-400 font-medium">Size</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-700/50">
              {runs.length === 0 ? (
                <tr><td colSpan={5} className="p-6 text-center text-slate-500">No report runs yet</td></tr>
              ) : runs.map(run => (
                <tr key={run.id} className="hover:bg-slate-800/30">
                  <td className="p-3 text-white font-mono text-xs">{run.reportId}</td>
                  <td className="p-3 text-center">
                    <span className={`text-xs px-2 py-0.5 rounded-full ${run.status === 'completed' ? 'bg-emerald-900/50 text-emerald-300' : run.status === 'failed' ? 'bg-red-900/50 text-red-300' : 'bg-yellow-900/50 text-yellow-300'}`}>
                      {run.status}
                    </span>
                  </td>
                  <td className="p-3 text-slate-300 text-xs">{new Date(run.startedAt).toLocaleString()}</td>
                  <td className="p-3 text-right text-slate-300 text-xs">{run.rowCount?.toLocaleString() ?? '-'}</td>
                  <td className="p-3 text-right text-slate-300 text-xs">{run.fileSize ? `${(run.fileSize / 1024).toFixed(1)} KB` : '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
