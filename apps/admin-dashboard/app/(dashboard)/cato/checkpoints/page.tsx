'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { AlertCircle, CheckCircle, Clock, XCircle, RefreshCw, Eye, Shield, Settings, Save } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';

interface CheckpointDecision {
  id: string;
  pipelineId: string;
  checkpointType: string;
  checkpointName: string;
  status: string;
  triggerReason: string;
  presentedData: Record<string, unknown>;
  deadline: string;
  decision?: string;
  decidedBy?: string;
  decisionTimeMs?: number;
}

interface CheckpointConfig {
  preset: 'COWBOY' | 'BALANCED' | 'PARANOID';
  checkpoints: Record<string, { mode: string; triggerOn: string[]; timeoutSeconds: number }>;
  defaultTimeoutSeconds: number;
  timeoutAction: string;
}

const presetDescriptions = {
  COWBOY: { emoji: '🚀', name: 'Cowboy', desc: 'Maximum autonomy, minimal checkpoints. Trust the AI.', vetoThreshold: 0.95, autoExecute: 0.7 },
  BALANCED: { emoji: '⚖️', name: 'Balanced', desc: 'Conditional checkpoints for high-risk decisions.', vetoThreshold: 0.85, autoExecute: 0.5 },
  PARANOID: { emoji: '🛡️', name: 'Paranoid', desc: 'Full human oversight at every decision point.', vetoThreshold: 0.60, autoExecute: 0.2 },
};

const checkpointTypes = [
  { id: 'CP1', name: 'Context Gate', desc: 'Ambiguous intent, missing context' },
  { id: 'CP2', name: 'Plan Gate', desc: 'High cost, irreversible actions' },
  { id: 'CP3', name: 'Review Gate', desc: 'Objections raised, low consensus' },
  { id: 'CP4', name: 'Execution Gate', desc: 'Risk above threshold' },
  { id: 'CP5', name: 'Post-Mortem Gate', desc: 'Execution completed (audit)' },
];

const modeOptions = ['DISABLED', 'AUTO', 'CONDITIONAL', 'MANUAL'];

export default function CatoCheckpointsPage() {
  const { toast } = useToast();
  const [pendingCheckpoints, setPendingCheckpoints] = useState<CheckpointDecision[]>([]);
  const [recentDecisions, setRecentDecisions] = useState<CheckpointDecision[]>([]);
  const [config, setConfig] = useState<CheckpointConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedCheckpoint, setSelectedCheckpoint] = useState<CheckpointDecision | null>(null);
  const [feedback, setFeedback] = useState('');
  const [saving, setSaving] = useState(false);
  const [localConfig, setLocalConfig] = useState<CheckpointConfig | null>(null);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 10000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (config) setLocalConfig({ ...config });
  }, [config]);

  const fetchData = async () => {
    try {
      const [pendingRes, recentRes, configRes] = await Promise.all([
        fetch('/api/admin/cato/checkpoints/pending'),
        fetch('/api/admin/cato/checkpoints/recent'),
        fetch('/api/admin/cato/checkpoints/config'),
      ]);

      if (pendingRes.ok) {
        const pending = await pendingRes.json();
        setPendingCheckpoints(pending);
      }
      if (recentRes.ok) {
        const recent = await recentRes.json();
        setRecentDecisions(recent);
      }
      if (configRes.ok) {
        const cfg = await configRes.json();
        setConfig(cfg);
      }
      setLoading(false);
    } catch (error) {
      console.error('Failed to fetch:', error);
      setLoading(false);
    }
  };

  const handleDecision = async (checkpointId: string, decision: string) => {
    try {
      const response = await fetch(`/api/admin/cato/checkpoints/${checkpointId}/resolve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ decision, feedback }),
      });
      if (!response.ok) throw new Error('Failed to submit decision');
      toast({ title: 'Decision submitted', description: `Checkpoint ${decision.toLowerCase()} successfully.` });
      setSelectedCheckpoint(null);
      setFeedback('');
      fetchData();
    } catch (error) {
      toast({ title: 'Error', description: error instanceof Error ? error.message : 'Failed to submit decision', variant: 'destructive' });
    }
  };

  const handlePresetChange = (preset: 'COWBOY' | 'BALANCED' | 'PARANOID') => {
    if (!localConfig) return;
    const modes: Record<string, string> = {
      COWBOY: 'DISABLED',
      BALANCED: 'CONDITIONAL',
      PARANOID: 'MANUAL',
    };
    const newCheckpoints = { ...localConfig.checkpoints };
    Object.keys(newCheckpoints).forEach(cp => {
      if (cp !== 'CP5') newCheckpoints[cp].mode = modes[preset];
    });
    setLocalConfig({ ...localConfig, preset, checkpoints: newCheckpoints });
  };

  const handleSaveConfig = async () => {
    if (!localConfig) return;
    setSaving(true);
    try {
      const response = await fetch('/api/admin/cato/checkpoints/config', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(localConfig),
      });
      if (!response.ok) throw new Error('Failed to save configuration');
      setConfig(localConfig);
      toast({ title: 'Configuration saved', description: 'Checkpoint configuration updated successfully.' });
    } catch (error) {
      toast({ title: 'Error', description: error instanceof Error ? error.message : 'Failed to save configuration', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const getTimeRemaining = (deadline: string) => {
    const ms = new Date(deadline).getTime() - Date.now();
    if (ms <= 0) return 'Expired';
    const mins = Math.floor(ms / 60000);
    if (mins < 60) return `${mins}m`;
    return `${Math.floor(mins / 60)}h ${mins % 60}m`;
  };

  if (loading) {
    return <div className="flex items-center justify-center h-64"><RefreshCw className="h-8 w-8 animate-spin" /></div>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Cato Checkpoints</h1>
        <p className="text-muted-foreground">Human-in-the-loop approval gates and governance configuration</p>
      </div>

      {pendingCheckpoints.length > 0 && (
        <Card className="border-yellow-500">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-yellow-600">
              <AlertCircle className="h-5 w-5" /> Pending Approvals ({pendingCheckpoints.length})
            </CardTitle>
            <CardDescription>These checkpoints require human decision</CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Checkpoint</TableHead>
                  <TableHead>Pipeline</TableHead>
                  <TableHead>Trigger Reason</TableHead>
                  <TableHead>Time Remaining</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pendingCheckpoints.map(cp => (
                  <TableRow key={cp.id}>
                    <TableCell>
                      <div>
                        <p className="font-medium">{cp.checkpointName}</p>
                        <Badge variant="outline">{cp.checkpointType}</Badge>
                      </div>
                    </TableCell>
                    <TableCell className="font-mono text-xs">{cp.pipelineId}</TableCell>
                    <TableCell className="max-w-xs truncate">{cp.triggerReason}</TableCell>
                    <TableCell>
                      <Badge variant={getTimeRemaining(cp.deadline) === 'Expired' ? 'destructive' : 'secondary'}>
                        <Clock className="h-3 w-3 mr-1" />
                        {getTimeRemaining(cp.deadline)}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-2">
                        <Button size="sm" variant="outline" onClick={() => setSelectedCheckpoint(cp)}>
                          <Eye className="h-4 w-4 mr-1" /> Review
                        </Button>
                        <Button size="sm" variant="destructive" onClick={() => handleDecision(cp.id, 'REJECTED')}>
                          <XCircle className="h-4 w-4" />
                        </Button>
                        <Button size="sm" onClick={() => handleDecision(cp.id, 'APPROVED')}>
                          <CheckCircle className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      <Tabs defaultValue="config">
        <TabsList>
          <TabsTrigger value="config">Configuration</TabsTrigger>
          <TabsTrigger value="history">Decision History</TabsTrigger>
        </TabsList>

        <TabsContent value="config" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><Settings className="h-5 w-5" /> Governance Preset</CardTitle>
              <CardDescription>Choose a preset or customize individual checkpoint behavior</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-3 gap-4">
                {(Object.entries(presetDescriptions) as [keyof typeof presetDescriptions, typeof presetDescriptions.COWBOY][]).map(([key, preset]) => (
                  <Card key={key} className={`cursor-pointer transition-all ${localConfig?.preset === key ? 'ring-2 ring-primary' : 'hover:bg-muted/50'}`} onClick={() => handlePresetChange(key)}>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-lg">{preset.emoji} {preset.name}</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <p className="text-sm text-muted-foreground mb-3">{preset.desc}</p>
                      <div className="text-xs space-y-1">
                        <p>Veto: {(preset.vetoThreshold * 100).toFixed(0)}%</p>
                        <p>Auto-Execute: {(preset.autoExecute * 100).toFixed(0)}%</p>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>

              <div className="space-y-4">
                <h3 className="font-semibold">Checkpoint Configuration</h3>
                {checkpointTypes.map(cp => (
                  <div key={cp.id} className="flex items-center justify-between p-4 border rounded-lg">
                    <div className="flex-1">
                      <p className="font-medium">{cp.id}: {cp.name}</p>
                      <p className="text-sm text-muted-foreground">{cp.desc}</p>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="w-40">
                        <Label className="text-xs">Mode</Label>
                        <Select value={localConfig?.checkpoints[cp.id]?.mode || 'CONDITIONAL'} onValueChange={(v) => {
                          if (!localConfig) return;
                          const newCps = { ...localConfig.checkpoints };
                          newCps[cp.id] = { ...newCps[cp.id], mode: v };
                          setLocalConfig({ ...localConfig, checkpoints: newCps });
                        }}>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            {modeOptions.map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="w-32">
                        <Label className="text-xs">Timeout (sec)</Label>
                        <Input type="number" value={localConfig?.checkpoints[cp.id]?.timeoutSeconds || 3600} onChange={(e) => {
                          if (!localConfig) return;
                          const newCps = { ...localConfig.checkpoints };
                          newCps[cp.id] = { ...newCps[cp.id], timeoutSeconds: parseInt(e.target.value) || 3600 };
                          setLocalConfig({ ...localConfig, checkpoints: newCps });
                        }} />
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              <div className="flex justify-end">
                <Button onClick={handleSaveConfig} disabled={saving}>
                  {saving ? <RefreshCw className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
                  Save Configuration
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="history" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Recent Decisions</CardTitle>
              <CardDescription>History of checkpoint approvals and rejections</CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Checkpoint</TableHead>
                    <TableHead>Pipeline</TableHead>
                    <TableHead>Decision</TableHead>
                    <TableHead>Decided By</TableHead>
                    <TableHead>Decision Time</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {recentDecisions.map(cp => (
                    <TableRow key={cp.id}>
                      <TableCell>
                        <div>
                          <p className="font-medium">{cp.checkpointName}</p>
                          <Badge variant="outline">{cp.checkpointType}</Badge>
                        </div>
                      </TableCell>
                      <TableCell className="font-mono text-xs">{cp.pipelineId}</TableCell>
                      <TableCell>
                        <Badge variant={cp.decision === 'APPROVED' ? 'default' : 'destructive'}>
                          {cp.decision === 'APPROVED' ? <CheckCircle className="h-3 w-3 mr-1" /> : <XCircle className="h-3 w-3 mr-1" />}
                          {cp.decision}
                        </Badge>
                      </TableCell>
                      <TableCell>{cp.decidedBy}</TableCell>
                      <TableCell>{cp.decisionTimeMs ? `${(cp.decisionTimeMs / 1000).toFixed(0)}s` : '-'}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {selectedCheckpoint && (
        <Dialog open={!!selectedCheckpoint} onOpenChange={() => setSelectedCheckpoint(null)}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>{selectedCheckpoint.checkpointName} ({selectedCheckpoint.checkpointType})</DialogTitle>
              <DialogDescription>Pipeline: {selectedCheckpoint.pipelineId}</DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="p-4 bg-muted rounded-lg">
                <p className="font-medium mb-2">Trigger Reason</p>
                <p>{selectedCheckpoint.triggerReason}</p>
              </div>
              <div className="p-4 bg-muted rounded-lg">
                <p className="font-medium mb-2">Presented Data</p>
                <pre className="text-xs overflow-auto max-h-40">{JSON.stringify(selectedCheckpoint.presentedData, null, 2)}</pre>
              </div>
              <div>
                <Label>Feedback (optional)</Label>
                <Textarea value={feedback} onChange={(e) => setFeedback(e.target.value)} placeholder="Provide context for your decision..." />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setSelectedCheckpoint(null)}>Cancel</Button>
              <Button variant="destructive" onClick={() => handleDecision(selectedCheckpoint.id, 'REJECTED')}>
                <XCircle className="h-4 w-4 mr-2" /> Reject
              </Button>
              <Button onClick={() => handleDecision(selectedCheckpoint.id, 'APPROVED')}>
                <CheckCircle className="h-4 w-4 mr-2" /> Approve
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
