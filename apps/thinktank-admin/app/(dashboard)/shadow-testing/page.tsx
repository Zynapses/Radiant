'use client';

import { useState, useEffect, useCallback } from 'react';
import { api } from '@/lib/api/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { FlaskConical, Play, Pause, Check, TrendingUp, Settings, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';

interface ShadowTest {
  id: string;
  testName: string;
  baselineTemplateName: string;
  candidateTemplateName: string;
  testMode: string;
  trafficPercentage: number;
  minSamples: number;
  samplesCollected: number;
  baselineAvgScore: number | null;
  candidateAvgScore: number | null;
  winner: string | null;
  confidenceLevel: number | null;
  status: string;
  startedAt: string | null;
  completedAt: string | null;
}

interface ShadowSettings {
  defaultTestMode: string;
  autoPromoteThreshold: number;
  autoPromoteConfidence: number;
  maxConcurrentTests: number;
  notifyOnCompletion: boolean;
  notifyOnAutoPromote: boolean;
}

const STATUS_COLORS: Record<string, string> = { pending: 'bg-gray-100 text-gray-800', running: 'bg-blue-100 text-blue-800', completed: 'bg-green-100 text-green-800', promoted: 'bg-purple-100 text-purple-800', rejected: 'bg-red-100 text-red-800' };

export default function ShadowTestingPage() {
  const [tests, setTests] = useState<ShadowTest[]>([]);
  const [settings, setSettings] = useState<ShadowSettings>({ defaultTestMode: 'auto', autoPromoteThreshold: 0.05, autoPromoteConfidence: 0.95, maxConcurrentTests: 3, notifyOnCompletion: true, notifyOnAutoPromote: true });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [testsData, settingsData] = await Promise.all([
        api.get<{ tests: ShadowTest[] }>('/api/admin/shadow-tests').catch(() => ({ tests: [] })),
        api.get<{ settings: ShadowSettings }>('/api/admin/shadow-tests/settings').catch(() => ({ settings: null as unknown as ShadowSettings })),
      ]);
      setTests(testsData.tests || []);
      if (settingsData.settings) setSettings(settingsData.settings);
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleStartTest = async (testId: string) => { setSaving(true); try { await api.post(`/api/admin/shadow-tests/${testId}/start`, {}); toast.success('Test started'); fetchData(); } catch { toast.error('Failed to start test'); } setSaving(false); };
  const handleStopTest = async (testId: string) => { setSaving(true); try { await api.post(`/api/admin/shadow-tests/${testId}/stop`, {}); toast.success('Test stopped'); fetchData(); } catch { toast.error('Failed to stop test'); } setSaving(false); };
  const handlePromoteCandidate = async (testId: string) => { setSaving(true); try { await api.post(`/api/admin/shadow-tests/${testId}/promote`, {}); toast.success('Candidate promoted'); fetchData(); } catch { toast.error('Failed to promote'); } setSaving(false); };
  const handleSaveSettings = async () => { setSaving(true); try { await api.put('/api/admin/shadow-tests/settings', settings); toast.success('Settings saved'); } catch { toast.error('Failed to save settings'); } setSaving(false); };

  const runningTests = tests.filter(t => t.status === 'running');
  const completedTests = tests.filter(t => ['completed', 'promoted', 'rejected'].includes(t.status));

  if (loading) return <div className="flex items-center justify-center h-64"><RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" /></div>;

  return (
    <div className="space-y-6">
      <div><h1 className="text-3xl font-bold">Pre-Prompt Shadow Testing</h1><p className="text-muted-foreground mt-2">A/B test pre-prompt optimizations in the background before promoting to production.</p></div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm font-medium">Active Tests</CardTitle></CardHeader><CardContent><div className="text-2xl font-bold">{runningTests.length}</div><p className="text-xs text-muted-foreground">Running shadow tests</p></CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm font-medium">Total Samples</CardTitle></CardHeader><CardContent><div className="text-2xl font-bold">{runningTests.reduce((sum, t) => sum + t.samplesCollected, 0)}</div><p className="text-xs text-muted-foreground">Collected this session</p></CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm font-medium">Promoted</CardTitle></CardHeader><CardContent><div className="text-2xl font-bold text-green-600">{tests.filter(t => t.status === 'promoted').length}</div><p className="text-xs text-muted-foreground">Successful optimizations</p></CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm font-medium">Test Mode</CardTitle></CardHeader><CardContent><div className="text-2xl font-bold capitalize">{settings.defaultTestMode}</div><p className="text-xs text-muted-foreground">Current default mode</p></CardContent></Card>
      </div>

      <Tabs defaultValue="active">
        <TabsList><TabsTrigger value="active">Active Tests</TabsTrigger><TabsTrigger value="completed">Completed</TabsTrigger><TabsTrigger value="settings">Settings</TabsTrigger></TabsList>

        <TabsContent value="active" className="space-y-4">
          {runningTests.length === 0 ? (
            <Card><CardContent className="py-8 text-center text-muted-foreground">No active shadow tests. Create a new test to start optimizing pre-prompts.</CardContent></Card>
          ) : (
            runningTests.map(test => <TestCard key={test.id} test={test} onStart={() => handleStartTest(test.id)} onStop={() => handleStopTest(test.id)} onPromote={() => handlePromoteCandidate(test.id)} saving={saving} />)
          )}
        </TabsContent>

        <TabsContent value="completed" className="space-y-4">
          {completedTests.length === 0 ? (
            <Card><CardContent className="py-8 text-center text-muted-foreground">No completed tests yet.</CardContent></Card>
          ) : (
            completedTests.map(test => <TestCard key={test.id} test={test} onStart={() => handleStartTest(test.id)} onStop={() => handleStopTest(test.id)} onPromote={() => handlePromoteCandidate(test.id)} saving={saving} />)
          )}
        </TabsContent>

        <TabsContent value="settings">
          <Card>
            <CardHeader><CardTitle className="flex items-center gap-2"><Settings className="h-5 w-5" />Shadow Testing Settings</CardTitle><CardDescription>Configure global settings for pre-prompt shadow testing</CardDescription></CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2"><Label>Default Test Mode</Label><Select value={settings.defaultTestMode} onValueChange={(value) => setSettings({ ...settings, defaultTestMode: value })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="auto">Auto (Recommended)</SelectItem><SelectItem value="manual">Manual</SelectItem><SelectItem value="off">Off</SelectItem></SelectContent></Select></div>
                <div className="space-y-2"><Label>Max Concurrent Tests</Label><Input type="number" min={1} max={10} value={settings.maxConcurrentTests} onChange={(e) => setSettings({ ...settings, maxConcurrentTests: parseInt(e.target.value) || 3 })} /></div>
                <div className="space-y-2"><Label>Auto-Promote Threshold</Label><Input type="number" min={0.01} max={0.5} step={0.01} value={settings.autoPromoteThreshold} onChange={(e) => setSettings({ ...settings, autoPromoteThreshold: parseFloat(e.target.value) || 0.05 })} /></div>
                <div className="space-y-2"><Label>Auto-Promote Confidence</Label><Input type="number" min={0.8} max={0.99} step={0.01} value={settings.autoPromoteConfidence} onChange={(e) => setSettings({ ...settings, autoPromoteConfidence: parseFloat(e.target.value) || 0.95 })} /></div>
              </div>
              <div className="space-y-4 pt-4 border-t">
                <div className="flex items-center justify-between"><div><Label>Notify on Test Completion</Label></div><Switch checked={settings.notifyOnCompletion} onCheckedChange={(checked) => setSettings({ ...settings, notifyOnCompletion: checked })} /></div>
                <div className="flex items-center justify-between"><div><Label>Notify on Auto-Promote</Label></div><Switch checked={settings.notifyOnAutoPromote} onCheckedChange={(checked) => setSettings({ ...settings, notifyOnAutoPromote: checked })} /></div>
              </div>
              <div className="pt-4"><Button onClick={handleSaveSettings} disabled={saving}>{saving ? 'Saving...' : 'Save Settings'}</Button></div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function TestCard({ test, onStart, onStop, onPromote, saving }: { test: ShadowTest; onStart: () => void; onStop: () => void; onPromote: () => void; saving: boolean }) {
  const progress = Math.min(100, (test.samplesCollected / test.minSamples) * 100);
  const improvementPercent = test.baselineAvgScore && test.candidateAvgScore ? ((test.candidateAvgScore - test.baselineAvgScore) / test.baselineAvgScore * 100).toFixed(1) : null;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-purple-100"><FlaskConical className="h-5 w-5 text-purple-700" /></div>
            <div>
              <CardTitle className="flex items-center gap-2">{test.testName}<Badge className={STATUS_COLORS[test.status]}>{test.status}</Badge></CardTitle>
              <CardDescription>Testing {test.candidateTemplateName} vs {test.baselineTemplateName}</CardDescription>
            </div>
          </div>
          <div className="flex gap-2">
            {test.status === 'pending' && <Button size="sm" onClick={onStart} disabled={saving}><Play className="h-4 w-4 mr-1" /> Start</Button>}
            {test.status === 'running' && <Button size="sm" variant="outline" onClick={onStop} disabled={saving}><Pause className="h-4 w-4 mr-1" /> Stop</Button>}
            {test.status === 'completed' && test.winner === 'candidate' && <Button size="sm" onClick={onPromote} disabled={saving}><Check className="h-4 w-4 mr-1" /> Promote Candidate</Button>}
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div><Label className="text-xs text-muted-foreground">Sample Progress</Label><div className="mt-2"><Progress value={progress} className="h-2" /><p className="text-sm mt-1">{test.samplesCollected} / {test.minSamples} samples</p></div></div>
          <div><Label className="text-xs text-muted-foreground">Quality Scores</Label><div className="flex gap-4 mt-2"><div><p className="text-xs text-muted-foreground">Baseline</p><p className="text-lg font-semibold">{test.baselineAvgScore ? (test.baselineAvgScore * 100).toFixed(1) + '%' : '-'}</p></div><div><p className="text-xs text-muted-foreground">Candidate</p><p className={`text-lg font-semibold ${improvementPercent && parseFloat(improvementPercent) > 0 ? 'text-green-600' : ''}`}>{test.candidateAvgScore ? (test.candidateAvgScore * 100).toFixed(1) + '%' : '-'}</p></div>{improvementPercent && <div><p className="text-xs text-muted-foreground">Improvement</p><p className={`text-lg font-semibold flex items-center ${parseFloat(improvementPercent) > 0 ? 'text-green-600' : 'text-red-600'}`}><TrendingUp className="h-4 w-4 mr-1" />{improvementPercent}%</p></div>}</div></div>
          <div><Label className="text-xs text-muted-foreground">Statistical Confidence</Label><div className="mt-2"><p className="text-lg font-semibold">{test.confidenceLevel ? (test.confidenceLevel * 100).toFixed(0) + '%' : '-'}</p>{test.winner && <Badge variant={test.winner === 'candidate' ? 'default' : test.winner === 'baseline' ? 'secondary' : 'outline'}>{test.winner === 'candidate' ? 'Candidate Wins' : test.winner === 'baseline' ? 'Baseline Wins' : 'Inconclusive'}</Badge>}</div></div>
        </div>
        <div className="flex gap-4 mt-4 pt-4 border-t text-xs text-muted-foreground"><span>Mode: {test.testMode}</span><span>Traffic: {test.trafficPercentage}%</span>{test.startedAt && <span>Started: {new Date(test.startedAt).toLocaleDateString()}</span>}</div>
      </CardContent>
    </Card>
  );
}
