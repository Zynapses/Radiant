'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  FileText, RefreshCw, Download, BarChart3, Users, Clock,
  MessageSquare, CreditCard, TrendingUp, Calendar,
} from 'lucide-react';

interface ReportSummary {
  id: string;
  name: string;
  type: string;
  period: string;
  generatedAt: string;
  downloadUrl: string | null;
  status: string;
}

interface UsageStats {
  totalConversations: number;
  totalMessages: number;
  activeUsers: number;
  tokensUsed: number;
  estimatedCost: number;
  periodStart: string;
  periodEnd: string;
}

const API = '/api/tenant-admin/reports';

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

export default function TenantReportsPage() {
  const [reports, setReports] = useState<ReportSummary[]>([]);
  const [stats, setStats] = useState<UsageStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'overview' | 'reports'>('overview');
  const [generating, setGenerating] = useState(false);

  const load = useCallback(async () => {
    try {
      const [reportsData, statsData] = await Promise.all([
        fetchApi('/list').catch(() => ({ reports: [] })),
        fetchApi('/usage-stats').catch(() => ({ stats: null })),
      ]);
      setReports(reportsData.reports || reportsData || []);
      setStats(statsData.stats || statsData || null);
    } catch (err) {
      console.error('Failed to load', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const generateReport = async (type: string) => {
    setGenerating(true);
    try {
      await fetchApi('/generate', { method: 'POST', body: JSON.stringify({ type, period: 'last_30_days' }) });
      await load();
    } catch (err) {
      alert(`Failed: ${err instanceof Error ? err.message : 'Unknown'}`);
    } finally {
      setGenerating(false);
    }
  };

  if (loading) {
    return <div className="flex items-center justify-center h-64"><RefreshCw className="h-8 w-8 animate-spin text-violet-400" /></div>;
  }

  return (
    <div className="space-y-6 p-6 max-w-6xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-3">
            <FileText className="h-7 w-7 text-violet-400" />
            Reports
          </h1>
          <p className="text-sm text-slate-400 mt-1">Usage reports and analytics for your organization</p>
        </div>
        <button onClick={load} className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white text-sm rounded-lg flex items-center gap-2">
          <RefreshCw className="h-4 w-4" /> Refresh
        </button>
      </div>

      {stats && (
        <div className="grid grid-cols-5 gap-4">
          <StatCard icon={MessageSquare} label="Conversations" value={stats.totalConversations.toLocaleString()} color="text-blue-400" />
          <StatCard icon={BarChart3} label="Messages" value={stats.totalMessages.toLocaleString()} color="text-purple-400" />
          <StatCard icon={Users} label="Active Users" value={stats.activeUsers} color="text-emerald-400" />
          <StatCard icon={TrendingUp} label="Tokens Used" value={`${(stats.tokensUsed / 1000).toFixed(0)}K`} color="text-orange-400" />
          <StatCard icon={CreditCard} label="Est. Cost" value={`$${stats.estimatedCost.toFixed(2)}`} color="text-red-400" />
        </div>
      )}

      <div className="flex gap-1 bg-slate-800/50 rounded-lg p-1">
        {(['overview', 'reports'] as const).map(tab => (
          <button key={tab} onClick={() => setActiveTab(tab)}
            className={`flex-1 px-4 py-2 text-sm rounded-md transition-colors capitalize ${activeTab === tab ? 'bg-slate-700 text-white' : 'text-slate-400 hover:text-white'}`}>
            {tab === 'overview' ? 'Usage Overview' : 'Generated Reports'}
          </button>
        ))}
      </div>

      {activeTab === 'overview' && (
        <div className="space-y-4">
          <h3 className="text-sm font-semibold text-white">Generate a Report</h3>
          <div className="grid grid-cols-3 gap-4">
            {[
              { type: 'usage', label: 'Usage Report', desc: 'Conversations, messages, tokens, and costs', icon: BarChart3 },
              { type: 'users', label: 'User Activity', desc: 'User engagement and activity patterns', icon: Users },
              { type: 'billing', label: 'Billing Summary', desc: 'Cost breakdown by model and user', icon: CreditCard },
            ].map(report => (
              <div key={report.type} className="bg-slate-800/30 border border-slate-700/50 rounded-xl p-4">
                <div className="flex items-center gap-2 mb-2">
                  <report.icon className="h-5 w-5 text-violet-400" />
                  <span className="font-medium text-white">{report.label}</span>
                </div>
                <p className="text-xs text-slate-400 mb-3">{report.desc}</p>
                <button onClick={() => generateReport(report.type)} disabled={generating}
                  className="w-full px-3 py-1.5 bg-violet-600 hover:bg-violet-500 disabled:opacity-50 text-white text-xs rounded-lg flex items-center justify-center gap-1">
                  <Download className="h-3 w-3" /> {generating ? 'Generating...' : 'Generate'}
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {activeTab === 'reports' && (
        <div className="bg-slate-800/30 border border-slate-700/50 rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-slate-800/50">
              <tr>
                <th className="text-left p-3 text-slate-400 font-medium">Report</th>
                <th className="text-left p-3 text-slate-400 font-medium">Type</th>
                <th className="text-left p-3 text-slate-400 font-medium">Period</th>
                <th className="text-center p-3 text-slate-400 font-medium">Status</th>
                <th className="text-left p-3 text-slate-400 font-medium">Generated</th>
                <th className="text-right p-3 text-slate-400 font-medium">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-700/50">
              {reports.length === 0 ? (
                <tr><td colSpan={6} className="p-6 text-center text-slate-500">No reports generated yet. Use the Overview tab to create one.</td></tr>
              ) : reports.map(report => (
                <tr key={report.id} className="hover:bg-slate-800/30">
                  <td className="p-3 text-white">{report.name}</td>
                  <td className="p-3"><span className="text-xs bg-slate-700 text-slate-300 px-2 py-0.5 rounded">{report.type}</span></td>
                  <td className="p-3 text-slate-300 text-xs">{report.period}</td>
                  <td className="p-3 text-center">
                    <span className={`text-xs px-2 py-0.5 rounded-full ${report.status === 'completed' ? 'bg-emerald-900/50 text-emerald-300' : 'bg-yellow-900/50 text-yellow-300'}`}>
                      {report.status}
                    </span>
                  </td>
                  <td className="p-3 text-slate-400 text-xs">{new Date(report.generatedAt).toLocaleString()}</td>
                  <td className="p-3 text-right">
                    {report.downloadUrl && (
                      <a href={report.downloadUrl} className="text-xs text-violet-400 hover:text-violet-300 flex items-center justify-end gap-1">
                        <Download className="h-3 w-3" /> Download
                      </a>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
