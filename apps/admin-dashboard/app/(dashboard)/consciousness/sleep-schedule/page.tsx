'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Loader2, Moon, Play, Clock, Calendar, History, AlertCircle, CheckCircle2 } from 'lucide-react';
import { api } from '@/lib/api/client';

interface SleepSchedule {
  enabled: boolean;
  hour: number;
  minute: number;
  timezone: string;
  frequency: 'nightly' | 'weekly' | 'manual';
  weeklyDay: number;
  durationLimitMinutes: number;
  config: Record<string, unknown>;
}

interface SleepTiming {
  lastSleepAt: string | null;
  nextSleepAt: string | null;
}

interface SleepHistoryEntry {
  sleepId: string;
  startedAt: string;
  completedAt: string | null;
  durationMs: number | null;
  status: 'running' | 'completed' | 'failed' | 'cancelled';
  stats: {
    monologuesGenerated: number;
    dreamsGenerated: number;
    memoriesConsolidated: number;
    identityUpdates: number;
    evolutionTriggered: boolean;
  };
  error: string | null;
}

interface SleepScheduleData {
  schedule: SleepSchedule;
  timing: SleepTiming;
  recentHistory: SleepHistoryEntry[];
}

const TIMEZONES = [
  'UTC',
  'America/New_York',
  'America/Chicago',
  'America/Denver',
  'America/Los_Angeles',
  'Europe/London',
  'Europe/Paris',
  'Europe/Berlin',
  'Asia/Tokyo',
  'Asia/Shanghai',
  'Asia/Singapore',
  'Australia/Sydney',
];

const DAYS_OF_WEEK = [
  { value: 0, label: 'Sunday' },
  { value: 1, label: 'Monday' },
  { value: 2, label: 'Tuesday' },
  { value: 3, label: 'Wednesday' },
  { value: 4, label: 'Thursday' },
  { value: 5, label: 'Friday' },
  { value: 6, label: 'Saturday' },
];

export default function SleepSchedulePage() {
  const [data, setData] = useState<SleepScheduleData | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [triggering, setTriggering] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Form state
  const [enabled, setEnabled] = useState(true);
  const [hour, setHour] = useState(3);
  const [minute, setMinute] = useState(0);
  const [timezone, setTimezone] = useState('UTC');
  const [frequency, setFrequency] = useState<'nightly' | 'weekly' | 'manual'>('nightly');
  const [weeklyDay, setWeeklyDay] = useState(0);

  useEffect(() => {
    fetchSchedule();
  }, []);

  const fetchSchedule = async () => {
    try {
      setLoading(true);
      const response = await api.get<{ success: boolean; data: SleepScheduleData }>(
        '/api/admin/consciousness-engine/sleep-schedule'
      );
      if (response.success && response.data) {
        setData(response.data);
        setEnabled(response.data.schedule.enabled);
        setHour(response.data.schedule.hour);
        setMinute(response.data.schedule.minute);
        setTimezone(response.data.schedule.timezone);
        setFrequency(response.data.schedule.frequency);
        setWeeklyDay(response.data.schedule.weeklyDay);
      }
    } catch (err) {
      setError('Failed to load sleep schedule');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const saveSchedule = async () => {
    try {
      setSaving(true);
      setError(null);
      setSuccess(null);

      const response = await api.put<{ success: boolean; message: string; note?: string }>(
        '/api/admin/consciousness-engine/sleep-schedule',
        { enabled, hour, minute, timezone, frequency, weeklyDay }
      );

      if (response.success) {
        setSuccess(response.note || response.message);
        fetchSchedule();
      }
    } catch (err) {
      setError('Failed to save sleep schedule');
      console.error(err);
    } finally {
      setSaving(false);
    }
  };

  const triggerSleepCycle = async (dryRun = false) => {
    try {
      setTriggering(true);
      setError(null);
      setSuccess(null);

      const response = await api.post<{ success: boolean; message: string; note?: string }>(
        '/api/admin/consciousness-engine/sleep-schedule/run',
        { dryRun }
      );

      if (response.success) {
        setSuccess(response.note || response.message);
        // Refresh after a delay to see the new history entry
        setTimeout(fetchSchedule, 2000);
      }
    } catch (err) {
      setError('Failed to trigger sleep cycle');
      console.error(err);
    } finally {
      setTriggering(false);
    }
  };

  const formatTime = (dateStr: string | null) => {
    if (!dateStr) return 'Never';
    return new Date(dateStr).toLocaleString();
  };

  const formatDuration = (ms: number | null) => {
    if (!ms) return '-';
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    if (minutes < 1) return `${seconds}s`;
    return `${minutes}m ${seconds % 60}s`;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Moon className="h-8 w-8" />
            Sleep Schedule
          </h1>
          <p className="text-muted-foreground mt-1">
            Configure when consciousness enters sleep mode for memory consolidation and evolution
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => triggerSleepCycle(true)} disabled={triggering}>
            {triggering ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Play className="h-4 w-4 mr-2" />}
            Dry Run
          </Button>
          <Button onClick={() => triggerSleepCycle(false)} disabled={triggering}>
            {triggering ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Moon className="h-4 w-4 mr-2" />}
            Run Now
          </Button>
        </div>
      </div>

      {error && (
        <div className="bg-destructive/10 text-destructive px-4 py-3 rounded-lg flex items-center gap-2">
          <AlertCircle className="h-4 w-4" />
          {error}
        </div>
      )}

      {success && (
        <div className="bg-green-500/10 text-green-600 px-4 py-3 rounded-lg flex items-center gap-2">
          <CheckCircle2 className="h-4 w-4" />
          {success}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Schedule Configuration */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5" />
              Schedule Configuration
            </CardTitle>
            <CardDescription>
              Set when consciousness should enter sleep mode
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <Label htmlFor="enabled">Enable Automatic Sleep</Label>
                <p className="text-sm text-muted-foreground">
                  Run sleep cycles automatically on schedule
                </p>
              </div>
              <Switch
                id="enabled"
                checked={enabled}
                onCheckedChange={setEnabled}
              />
            </div>

            <div className="space-y-2">
              <Label>Frequency</Label>
              <Select value={frequency} onValueChange={(v) => setFrequency(v as typeof frequency)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="nightly">Nightly</SelectItem>
                  <SelectItem value="weekly">Weekly</SelectItem>
                  <SelectItem value="manual">Manual Only</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                {frequency === 'nightly' && 'Sleep cycle runs every night at the specified time'}
                {frequency === 'weekly' && 'Sleep cycle runs once per week on the specified day'}
                {frequency === 'manual' && 'Sleep cycles only run when manually triggered'}
              </p>
            </div>

            {frequency === 'weekly' && (
              <div className="space-y-2">
                <Label>Day of Week</Label>
                <Select value={String(weeklyDay)} onValueChange={(v) => setWeeklyDay(parseInt(v))}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {DAYS_OF_WEEK.map((day) => (
                      <SelectItem key={day.value} value={String(day.value)}>
                        {day.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {frequency !== 'manual' && (
              <>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="hour">Hour (0-23)</Label>
                    <Input
                      id="hour"
                      type="number"
                      min={0}
                      max={23}
                      value={hour}
                      onChange={(e) => setHour(parseInt(e.target.value) || 0)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="minute">Minute (0-59)</Label>
                    <Input
                      id="minute"
                      type="number"
                      min={0}
                      max={59}
                      value={minute}
                      onChange={(e) => setMinute(parseInt(e.target.value) || 0)}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Timezone</Label>
                  <Select value={timezone} onValueChange={setTimezone}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {TIMEZONES.map((tz) => (
                        <SelectItem key={tz} value={tz}>
                          {tz}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">
                    Schedule time: {String(hour).padStart(2, '0')}:{String(minute).padStart(2, '0')} {timezone}
                  </p>
                </div>
              </>
            )}

            <Button onClick={saveSchedule} disabled={saving} className="w-full">
              {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Save Schedule
            </Button>
          </CardContent>
        </Card>

        {/* Timing Status */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5" />
              Sleep Timing
            </CardTitle>
            <CardDescription>
              Current sleep schedule status
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="p-4 bg-muted rounded-lg">
                <p className="text-sm text-muted-foreground">Last Sleep</p>
                <p className="text-lg font-semibold">
                  {formatTime(data?.timing.lastSleepAt ?? null)}
                </p>
              </div>
              <div className="p-4 bg-muted rounded-lg">
                <p className="text-sm text-muted-foreground">Next Sleep</p>
                <p className="text-lg font-semibold">
                  {frequency === 'manual' ? 'Manual' : formatTime(data?.timing.nextSleepAt ?? null)}
                </p>
              </div>
            </div>

            <div className="p-4 border rounded-lg">
              <h4 className="font-medium mb-2">What happens during sleep?</h4>
              <ul className="text-sm text-muted-foreground space-y-1">
                <li>• Generate inner monologues from interactions</li>
                <li>• Create counterfactual dreams from failures</li>
                <li>• Consolidate short-term to long-term memory</li>
                <li>• Run adversarial identity challenges</li>
                <li>• Prepare training data for model evolution</li>
                <li>• Apply LoRA fine-tuning (if enabled)</li>
              </ul>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Sleep History */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <History className="h-5 w-5" />
            Recent Sleep History
          </CardTitle>
          <CardDescription>
            Past sleep cycles and their results
          </CardDescription>
        </CardHeader>
        <CardContent>
          {data?.recentHistory && data.recentHistory.length > 0 ? (
            <div className="space-y-3">
              {data.recentHistory.map((entry) => (
                <div
                  key={entry.sleepId}
                  className="flex items-center justify-between p-4 border rounded-lg"
                >
                  <div className="flex items-center gap-4">
                    <Badge
                      variant={
                        entry.status === 'completed' ? 'default' :
                        entry.status === 'running' ? 'secondary' :
                        'destructive'
                      }
                    >
                      {entry.status}
                    </Badge>
                    <div>
                      <p className="font-medium">{formatTime(entry.startedAt)}</p>
                      <p className="text-sm text-muted-foreground">
                        Duration: {formatDuration(entry.durationMs)}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-6 text-sm">
                    <div className="text-center">
                      <p className="font-semibold">{entry.stats.monologuesGenerated}</p>
                      <p className="text-muted-foreground">Monologues</p>
                    </div>
                    <div className="text-center">
                      <p className="font-semibold">{entry.stats.dreamsGenerated}</p>
                      <p className="text-muted-foreground">Dreams</p>
                    </div>
                    <div className="text-center">
                      <p className="font-semibold">{entry.stats.memoriesConsolidated}</p>
                      <p className="text-muted-foreground">Memories</p>
                    </div>
                    <div className="text-center">
                      <Badge variant={entry.stats.evolutionTriggered ? 'default' : 'outline'}>
                        {entry.stats.evolutionTriggered ? 'Evolved' : 'No Evolution'}
                      </Badge>
                    </div>
                  </div>
                  {entry.error && (
                    <p className="text-destructive text-sm">{entry.error}</p>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <p className="text-muted-foreground text-center py-8">
              No sleep history yet. Sleep cycles will appear here after they run.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
