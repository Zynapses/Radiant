'use client';

import React, { useState, useEffect } from 'react';
import { DollarSign, TrendingUp, BarChart3, PieChart, RefreshCw, ArrowUpRight, ArrowDownRight } from 'lucide-react';

interface ServiceCost { serviceName: string; cost: number; percentage: number; trend: 'up' | 'down' | 'stable'; }
interface DailyCost { date: string; cost: number; }
interface CostReport {
  summary: { totalCost: number; forecastedMonthEnd: number; percentChange: number; periodStart: string; periodEnd: string; };
  serviceBreakdown: ServiceCost[];
  dailyCosts: DailyCost[];
  lastUpdated: string;
}

const COLORS: Record<string, string> = { 'Amazon Bedrock': '#8B5CF6', 'AWS Lambda': '#F59E0B', 'Amazon RDS': '#3B82F6', 'Amazon S3': '#10B981', 'Amazon API Gateway': '#EC4899' };

export default function CostsPage() {
  const [report, setReport] = useState<CostReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [days, setDays] = useState(30);

  useEffect(() => { loadData(); }, [days]); // eslint-disable-line react-hooks/exhaustive-deps

  const [error, setError] = useState<string | null>(null);

  async function loadData() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || ''}/admin/costs/report?days=${days}`);
      if (res.ok) setReport(await res.json());
      else setError('Failed to load cost data. Please check API configuration.');
    } catch (e) { setError('Failed to connect to cost monitoring service.'); }
    setLoading(false);
  }

  if (loading) return <div className="flex items-center justify-center h-96"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600" /></div>;
  if (error) return <div className="flex flex-col items-center justify-center h-96 text-red-500"><p className="text-lg font-medium">Error</p><p className="text-sm">{error}</p><button onClick={loadData} className="mt-4 px-4 py-2 bg-purple-600 text-white rounded-lg">Retry</button></div>;
  if (!report) return <div className="flex items-center justify-center h-96 text-gray-500">No cost data available</div>;

  const maxCost = Math.max(...report.dailyCosts.map(d => d.cost));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">AWS Cost Monitor</h1>
          <p className="text-sm text-gray-500">Real-time expense tracking • Updated: {new Date(report.lastUpdated).toLocaleString()}</p>
        </div>
        <div className="flex gap-3">
          <select value={days} onChange={e => setDays(+e.target.value)} className="px-3 py-2 bg-white dark:bg-gray-800 border rounded-lg text-sm">
            <option value={7}>7 days</option><option value={30}>30 days</option><option value={90}>90 days</option>
          </select>
          <button onClick={loadData} className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700">
            <RefreshCw className="h-4 w-4" /> Refresh
          </button>
        </div>
      </div>

      <div className="grid grid-cols-4 gap-6">
        <Card title="Total Spend" value={`$${report.summary.totalCost.toFixed(2)}`} icon={DollarSign} color="purple" />
        <Card title="Forecast" value={`$${report.summary.forecastedMonthEnd.toFixed(2)}`} icon={TrendingUp} color="blue" />
        <Card title="vs Previous" value={`${report.summary.percentChange >= 0 ? '+' : ''}${report.summary.percentChange.toFixed(1)}%`} icon={report.summary.percentChange >= 0 ? ArrowUpRight : ArrowDownRight} color={report.summary.percentChange >= 0 ? 'red' : 'green'} />
        <Card title="Daily Avg" value={`$${(report.summary.totalCost / days).toFixed(2)}`} icon={BarChart3} color="indigo" />
      </div>

      <div className="grid grid-cols-3 gap-6">
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border p-4">
          <h2 className="text-lg font-semibold mb-4 flex items-center gap-2"><PieChart className="h-5 w-5 text-purple-500" /> By Service</h2>
          {report.serviceBreakdown.slice(0, 6).map((s, i) => (
            <div key={i} className="flex items-center justify-between py-2 border-b last:border-0">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full" style={{ backgroundColor: COLORS[s.serviceName] || '#6B7280' }} />
                <span className="text-sm truncate max-w-32">{s.serviceName}</span>
              </div>
              <div className="text-right">
                <span className="font-medium">${s.cost.toFixed(2)}</span>
                <span className="text-xs text-gray-500 ml-2">{s.percentage.toFixed(1)}%</span>
              </div>
            </div>
          ))}
        </div>

        <div className="col-span-2 bg-white dark:bg-gray-800 rounded-xl shadow-sm border p-4">
          <h2 className="text-lg font-semibold mb-4 flex items-center gap-2"><BarChart3 className="h-5 w-5 text-blue-500" /> Daily Trend</h2>
          <div className="h-48 flex items-end gap-1">
            {report.dailyCosts.map((d, i) => (
              <div key={i} className="flex-1 group relative" title={`${d.date}: $${d.cost.toFixed(2)}`}>
                <div className="w-full bg-gradient-to-t from-purple-600 to-purple-400 rounded-t hover:from-purple-700" style={{ height: `${(d.cost / maxCost) * 100}%`, minHeight: 4 }} />
              </div>
            ))}
          </div>
          <div className="flex justify-between text-xs text-gray-500 mt-2">
            <span>{report.dailyCosts[0]?.date}</span><span>{report.dailyCosts[report.dailyCosts.length - 1]?.date}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

function Card({ title, value, icon: Icon, color }: { title: string; value: string; icon: React.ElementType; color: string }) {
  const colors: Record<string, string> = { purple: 'bg-purple-100 text-purple-600', blue: 'bg-blue-100 text-blue-600', red: 'bg-red-100 text-red-600', green: 'bg-green-100 text-green-600', indigo: 'bg-indigo-100 text-indigo-600' };
  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border p-4">
      <div className="flex items-center gap-3">
        <div className={`p-2 rounded-lg ${colors[color]}`}><Icon className="h-5 w-5" /></div>
        <div><p className="text-sm text-gray-500">{title}</p><p className="text-xl font-bold">{value}</p></div>
      </div>
    </div>
  );
}

