'use client';

import React, { useState, useEffect } from 'react';
import { Brain, Play, Pause, Settings, DollarSign, Clock, Calendar, TrendingUp, Zap, Loader2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

type ThrottleLevel = 'off' | 'minimal' | 'low' | 'medium' | 'high' | 'maximum';

interface LearningCosts { currentHour: number; currentDay: number; currentMonth: number; currentYear: number; }
interface LearningConfig { enabled: boolean; throttleLevel: ThrottleLevel; maxHourlyCostCents: number; maxDailyCostCents: number; maxMonthlyCostCents: number; batchSize: number; }
interface LearningStatus { isRunning: boolean; currentThrottle: ThrottleLevel; lastLearningAt?: string; samplesProcessedToday: number; costs: LearningCosts; config: LearningConfig; }

const THROTTLE_LABELS: Record<ThrottleLevel, { label: string; color: string; desc: string }> = {
  off: { label: 'Off', color: 'bg-muted-foreground/50', desc: 'Learning disabled' },
  minimal: { label: 'Minimal', color: 'bg-blue-400', desc: '10% capacity' },
  low: { label: 'Low', color: 'bg-emerald-500', desc: '25% capacity' },
  medium: { label: 'Medium', color: 'bg-amber-500', desc: '50% capacity' },
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

  if (loading) return (
    <div className="flex items-center justify-center h-96">
      <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
    </div>
  );

  if (error) return (
    <div className="flex flex-col items-center justify-center h-96 text-destructive">
      <p className="text-lg font-medium">Error</p>
      <p className="text-sm text-muted-foreground">{error}</p>
      <Button onClick={loadStatus} className="mt-4">Retry</Button>
    </div>
  );

  if (!status) return (
    <div className="flex items-center justify-center h-96 text-muted-foreground">No learning status available</div>
  );

  const costs = status.costs;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
            <Brain className="h-7 w-7 text-primary" />
            AGI Background Learning
          </h1>
          <p className="text-muted-foreground mt-1">Monitor and control continuous learning with cost throttling</p>
        </div>
        <Button
          variant={status.isRunning ? 'destructive' : 'default'}
          onClick={toggleLearning}
        >
          {status.isRunning ? <><Pause className="h-4 w-4 mr-2" /> Pause Learning</> : <><Play className="h-4 w-4 mr-2" /> Start Learning</>}
        </Button>
      </div>

      {/* Status Banner */}
      <Card className={status.isRunning ? 'border-emerald-500/30 bg-emerald-500/5' : ''}>
        <CardContent className="py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className={`h-3 w-3 rounded-full ${status.isRunning ? 'bg-emerald-500 animate-pulse' : 'bg-muted-foreground/30'}`} />
              <span className="font-medium">{status.isRunning ? 'Learning Active' : 'Learning Paused'}</span>
              <Badge variant="secondary">{THROTTLE_LABELS[status.currentThrottle].label}</Badge>
            </div>
            {status.lastLearningAt && (
              <span className="text-sm text-muted-foreground">
                Last activity: {new Date(status.lastLearningAt).toLocaleString()}
              </span>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Cost Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <CostCard title="This Hour" value={costs.currentHour} limit={status.config.maxHourlyCostCents} icon={Clock} />
        <CostCard title="Today" value={costs.currentDay} limit={status.config.maxDailyCostCents} icon={Calendar} />
        <CostCard title="This Month" value={costs.currentMonth} limit={status.config.maxMonthlyCostCents} icon={TrendingUp} />
        <CostCard title="This Year" value={costs.currentYear} limit={null} icon={DollarSign} />
      </div>

      {/* Throttle Control */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Zap className="h-5 w-5 text-amber-500" />
            Learning Throttle
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
            {(Object.keys(THROTTLE_LABELS) as ThrottleLevel[]).map(level => (
              <button
                key={level}
                onClick={() => updateThrottle(level)}
                disabled={saving}
                className={`p-3 rounded-lg border-2 transition-all text-left ${
                  status.currentThrottle === level
                    ? 'border-primary bg-primary/5'
                    : 'border-border hover:border-primary/30'
                }`}
              >
                <div className={`h-2 rounded-full mb-2 ${THROTTLE_LABELS[level].color}`} />
                <div className="font-medium text-sm">{THROTTLE_LABELS[level].label}</div>
                <div className="text-xs text-muted-foreground">{THROTTLE_LABELS[level].desc}</div>
              </button>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Cost Limits */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5 text-muted-foreground" />
            Cost Limits
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
            <LimitInput label="Max Hourly (¢)" value={status.config.maxHourlyCostCents} onChange={v => updateConfig({ maxHourlyCostCents: v })} />
            <LimitInput label="Max Daily (¢)" value={status.config.maxDailyCostCents} onChange={v => updateConfig({ maxDailyCostCents: v })} />
            <LimitInput label="Max Monthly (¢)" value={status.config.maxMonthlyCostCents} onChange={v => updateConfig({ maxMonthlyCostCents: v })} />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function CostCard({ title, value, limit, icon: Icon }: { title: string; value: number; limit: number | null; icon: React.ElementType }) {
  const pct = limit ? (value / limit) * 100 : 0;
  const color = pct > 80 ? 'text-red-500' : pct > 50 ? 'text-amber-500' : 'text-emerald-500';
  const barColor = pct > 80 ? 'bg-red-500' : pct > 50 ? 'bg-amber-500' : 'bg-emerald-500';
  return (
    <Card>
      <CardContent className="pt-6">
        <div className="flex items-center gap-2 mb-2">
          <Icon className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm text-muted-foreground">{title}</span>
        </div>
        <div className="text-2xl font-bold">${(value / 100).toFixed(2)}</div>
        {limit && (
          <div className="mt-2">
            <div className="flex justify-between text-xs mb-1">
              <span className={color}>{pct.toFixed(0)}% used</span>
              <span className="text-muted-foreground">/${(limit / 100).toFixed(2)}</span>
            </div>
            <div className="h-1.5 bg-muted rounded-full overflow-hidden">
              <div className={`h-full rounded-full ${barColor}`} style={{ width: `${Math.min(pct, 100)}%` }} />
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function LimitInput({ label, value, onChange }: { label: string; value: number; onChange: (v: number) => void }) {
  const [v, setV] = useState(value);
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <div className="flex gap-2">
        <Input type="number" value={v} onChange={e => setV(+e.target.value)} />
        <Button onClick={() => onChange(v)}>Save</Button>
      </div>
    </div>
  );
}

