'use client';

import React, { useState, useEffect } from 'react';
import { Brain, Play, Pause, Settings, DollarSign, Clock, Calendar, TrendingUp, Zap } from 'lucide-react';

type ThrottleLevel = 'off' | 'minimal' | 'low' | 'medium' | 'high' | 'maximum';

interface LearningCosts { currentHour: number; currentDay: number; currentMonth: number; currentYear: number; }
interface LearningConfig { enabled: boolean; throttleLevel: ThrottleLevel; maxHourlyCostCents: number; maxDailyCostCents: number; maxMonthlyCostCents: number; batchSize: number; }
interface LearningStatus { isRunning: boolean; currentThrottle: ThrottleLevel; lastLearningAt?: string; samplesProcessedToday: number; costs: LearningCosts; config: LearningConfig; }

const THROTTLE_LABELS: Record<ThrottleLevel, { label: string; color: string; desc: string }> = {
  off: { label: 'Off', color: 'bg-gray-500', desc: 'Learning disabled' },
  minimal: { label: 'Minimal', color: 'bg-blue-400', desc: '10% capacity' },
  low: { label: 'Low', color: 'bg-green-500', desc: '25% capacity' },
  medium: { label: 'Medium', color: 'bg-yellow-500', desc: '50% capacity' },
  high: { label: 'High', color: 'bg-orange-500', desc: '75% capacity' },
  maximum: { label: 'Maximum', color: 'bg-red-500', desc: '100% capacity' },
};

export default function AGILearningPage() {
  const [status, setStatus] = useState<LearningStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => { loadStatus(); const i = setInterval(loadStatus, 30000); return () => clearInterval(i); }, []);

  const [error, setError] = useState<string | null>(null);

  async function loadStatus() {
    setError(null);
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || ''}/admin/agi-learning/status`);
      if (res.ok) setStatus(await res.json());
      else setError('Failed to load AGI learning status.');
    } catch { setError('Failed to connect to AGI learning service.'); }
    setLoading(false);
  }

  async function updateThrottle(level: ThrottleLevel) {
    setSaving(true);
    try {
      await fetch(`${process.env.NEXT_PUBLIC_API_URL || ''}/admin/agi-learning/throttle`, { method: 'PUT', body: JSON.stringify({ level }), headers: { 'Content-Type': 'application/json' } });
      await loadStatus();
    } catch { /* ignore */ }
    setSaving(false);
  }

  async function toggleLearning() {
    const endpoint = status?.isRunning ? 'stop' : 'start';
    await fetch(`${process.env.NEXT_PUBLIC_API_URL || ''}/admin/agi-learning/${endpoint}`, { method: 'POST' });
    await loadStatus();
  }

  async function updateConfig(updates: Partial<LearningConfig>) {
    setSaving(true);
    await fetch(`${process.env.NEXT_PUBLIC_API_URL || ''}/admin/agi-learning/config`, { method: 'PUT', body: JSON.stringify(updates), headers: { 'Content-Type': 'application/json' } });
    await loadStatus();
    setSaving(false);
  }

  if (loading) return <div className="flex items-center justify-center h-96"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600" /></div>;
  if (error) return <div className="flex flex-col items-center justify-center h-96 text-red-500"><p className="text-lg font-medium">Error</p><p className="text-sm">{error}</p><button onClick={loadStatus} className="mt-4 px-4 py-2 bg-purple-600 text-white rounded-lg">Retry</button></div>;
  if (!status) return <div className="flex items-center justify-center h-96 text-gray-500">No learning status available</div>;

  const costs = status.costs;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2"><Brain className="h-7 w-7 text-purple-500" /> AGI Background Learning</h1>
          <p className="text-sm text-gray-500 mt-1">Monitor and control continuous learning with cost throttling</p>
        </div>
        <button onClick={toggleLearning} className={`flex items-center gap-2 px-4 py-2 rounded-lg text-white ${status.isRunning ? 'bg-red-600 hover:bg-red-700' : 'bg-green-600 hover:bg-green-700'}`}>
          {status.isRunning ? <><Pause className="h-4 w-4" /> Pause Learning</> : <><Play className="h-4 w-4" /> Start Learning</>}
        </button>
      </div>

      {/* Status Banner */}
      <div className={`p-4 rounded-xl ${status.isRunning ? 'bg-green-50 border border-green-200 dark:bg-green-900/20' : 'bg-gray-50 border border-gray-200 dark:bg-gray-800'}`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className={`h-3 w-3 rounded-full ${status.isRunning ? 'bg-green-500 animate-pulse' : 'bg-gray-400'}`} />
            <span className="font-medium">{status.isRunning ? 'Learning Active' : 'Learning Paused'}</span>
            <span className="text-sm text-gray-500">• Throttle: {THROTTLE_LABELS[status.currentThrottle].label}</span>
          </div>
          {status.lastLearningAt && <span className="text-sm text-gray-500">Last activity: {new Date(status.lastLearningAt).toLocaleString()}</span>}
        </div>
      </div>

      {/* Cost Cards */}
      <div className="grid grid-cols-4 gap-4">
        <CostCard title="This Hour" value={costs.currentHour} limit={status.config.maxHourlyCostCents} icon={Clock} />
        <CostCard title="Today" value={costs.currentDay} limit={status.config.maxDailyCostCents} icon={Calendar} />
        <CostCard title="This Month" value={costs.currentMonth} limit={status.config.maxMonthlyCostCents} icon={TrendingUp} />
        <CostCard title="This Year" value={costs.currentYear} limit={null} icon={DollarSign} />
      </div>

      {/* Throttle Control */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border p-6">
        <h2 className="text-lg font-semibold mb-4 flex items-center gap-2"><Zap className="h-5 w-5 text-yellow-500" /> Learning Throttle</h2>
        <div className="grid grid-cols-6 gap-2">
          {(Object.keys(THROTTLE_LABELS) as ThrottleLevel[]).map(level => (
            <button key={level} onClick={() => updateThrottle(level)} disabled={saving}
              className={`p-3 rounded-lg border-2 transition-all ${status.currentThrottle === level ? 'border-purple-500 bg-purple-50 dark:bg-purple-900/30' : 'border-gray-200 hover:border-gray-300'}`}>
              <div className={`h-2 rounded-full mb-2 ${THROTTLE_LABELS[level].color}`} />
              <div className="font-medium text-sm">{THROTTLE_LABELS[level].label}</div>
              <div className="text-xs text-gray-500">{THROTTLE_LABELS[level].desc}</div>
            </button>
          ))}
        </div>
      </div>

      {/* Cost Limits */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border p-6">
        <h2 className="text-lg font-semibold mb-4 flex items-center gap-2"><Settings className="h-5 w-5 text-gray-500" /> Cost Limits</h2>
        <div className="grid grid-cols-3 gap-6">
          <LimitInput label="Max Hourly (¢)" value={status.config.maxHourlyCostCents} onChange={v => updateConfig({ maxHourlyCostCents: v })} />
          <LimitInput label="Max Daily (¢)" value={status.config.maxDailyCostCents} onChange={v => updateConfig({ maxDailyCostCents: v })} />
          <LimitInput label="Max Monthly (¢)" value={status.config.maxMonthlyCostCents} onChange={v => updateConfig({ maxMonthlyCostCents: v })} />
        </div>
      </div>
    </div>
  );
}

function CostCard({ title, value, limit, icon: Icon }: { title: string; value: number; limit: number | null; icon: React.ElementType }) {
  const pct = limit ? (value / limit) * 100 : 0;
  const color = pct > 80 ? 'text-red-500' : pct > 50 ? 'text-yellow-500' : 'text-green-500';
  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border p-4">
      <div className="flex items-center gap-2 mb-2"><Icon className="h-4 w-4 text-gray-400" /><span className="text-sm text-gray-500">{title}</span></div>
      <div className="text-2xl font-bold">${(value / 100).toFixed(2)}</div>
      {limit && (
        <div className="mt-2">
          <div className="flex justify-between text-xs mb-1"><span className={color}>{pct.toFixed(0)}% used</span><span className="text-gray-400">/${(limit / 100).toFixed(2)}</span></div>
          <div className="h-1.5 bg-gray-200 rounded-full"><div className={`h-full rounded-full ${pct > 80 ? 'bg-red-500' : pct > 50 ? 'bg-yellow-500' : 'bg-green-500'}`} style={{ width: `${Math.min(pct, 100)}%` }} /></div>
        </div>
      )}
    </div>
  );
}

function LimitInput({ label, value, onChange }: { label: string; value: number; onChange: (v: number) => void }) {
  const [v, setV] = useState(value);
  return (
    <div>
      <label className="block text-sm font-medium mb-1">{label}</label>
      <div className="flex gap-2">
        <input type="number" value={v} onChange={e => setV(+e.target.value)} className="flex-1 px-3 py-2 border rounded-lg" />
        <button onClick={() => onChange(v)} className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700">Save</button>
      </div>
    </div>
  );
}

