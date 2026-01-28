'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { AlertCircle, CheckCircle, Clock, Play, Pause, XCircle, RefreshCw, Eye, ChevronRight, GitBranch, Shield, Zap, FileText, Scale, Brain } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';

interface PipelineExecution {
  id: string;
  status: string;
  templateId?: string;
  governancePreset: string;
  methodsExecuted: string[];
  currentMethod?: string;
  totalCostCents: number;
  totalDurationMs: number;
  startedAt: string;
  completedAt?: string;
}

interface PipelineTemplate {
  templateId: string;
  name: string;
  description: string;
  methodChain: string[];
  category?: string;
}

interface CheckpointDecision {
  id: string;
  pipelineId: string;
  checkpointType: string;
  checkpointName: string;
  status: string;
  triggerReason: string;
  deadline: string;
}

const statusColors: Record<string, string> = {
  PENDING: 'bg-gray-500',
  RUNNING: 'bg-blue-500',
  CHECKPOINT_WAITING: 'bg-yellow-500',
  COMPLETED: 'bg-green-500',
  FAILED: 'bg-red-500',
  CANCELLED: 'bg-gray-400',
  ROLLED_BACK: 'bg-orange-500',
};

const StatusIcon = ({ status }: { status: string }) => {
  switch (status) {
    case 'COMPLETED': return <CheckCircle className="h-4 w-4 text-green-500" />;
    case 'FAILED': return <XCircle className="h-4 w-4 text-red-500" />;
    case 'RUNNING': return <Play className="h-4 w-4 text-blue-500" />;
    case 'CHECKPOINT_WAITING': return <Pause className="h-4 w-4 text-yellow-500" />;
    case 'ROLLED_BACK': return <RefreshCw className="h-4 w-4 text-orange-500" />;
    default: return <Clock className="h-4 w-4 text-gray-500" />;
  }
};

export default function CatoPipelinePage() {
  const { toast } = useToast();
  const [executions, setExecutions] = useState<PipelineExecution[]>([]);
  const [templates, setTemplates] = useState<PipelineTemplate[]>([]);
  const [pendingCheckpoints, setPendingCheckpoints] = useState<CheckpointDecision[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedExecution, setSelectedExecution] = useState<PipelineExecution | null>(null);
  const [showNewPipeline, setShowNewPipeline] = useState(false);
  const [newPipelineRequest, setNewPipelineRequest] = useState('');
  const [selectedTemplate, setSelectedTemplate] = useState<string>('');
  const [selectedPreset, setSelectedPreset] = useState<string>('BALANCED');
  const [_submitting, setSubmitting] = useState(false);
  void _submitting; // Reserved for submission state

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 5000);
    return () => clearInterval(interval);
  }, []);

  const fetchData = async () => {
    try {
      const [execRes, templatesRes, checkpointsRes] = await Promise.all([
        fetch('/api/admin/cato/pipeline/executions?limit=50'),
        fetch('/api/admin/cato/pipeline/templates'),
        fetch('/api/admin/cato/checkpoints/pending'),
      ]);

      if (execRes.ok) {
        const data = await execRes.json();
        setExecutions(Array.isArray(data) ? data : data.executions || []);
      }
      if (templatesRes.ok) {
        const data = await templatesRes.json();
        setTemplates(Array.isArray(data) ? data : data.templates || []);
      }
      if (checkpointsRes.ok) {
        const data = await checkpointsRes.json();
        setPendingCheckpoints(Array.isArray(data) ? data : []);
      }
      setLoading(false);
    } catch (error) {
      console.error('Failed to fetch data:', error);
      setLoading(false);
    }
  };

  const handleStartPipeline = async () => {
    if (!newPipelineRequest.trim()) {
      toast({ title: 'Error', description: 'Please enter a request', variant: 'destructive' });
      return;
    }
    setSubmitting(true);
    try {
      const response = await fetch('/api/admin/cato/pipeline/executions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          request: newPipelineRequest,
          templateId: selectedTemplate || undefined,
          governancePreset: selectedPreset,
        }),
      });
      if (!response.ok) throw new Error('Failed to start pipeline');
      const data = await response.json();
      toast({ title: 'Pipeline started', description: `Execution ID: ${data.id}` });
      setShowNewPipeline(false);
      setNewPipelineRequest('');
      fetchData();
    } catch (error) {
      toast({ title: 'Error', description: error instanceof Error ? error.message : 'Failed to start pipeline', variant: 'destructive' });
    } finally {
      setSubmitting(false);
    }
  };

  const handleCheckpointDecision = async (checkpointId: string, decision: string) => {
    try {
      const response = await fetch(`/api/admin/cato/checkpoints/${checkpointId}/resolve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ decision }),
      });
      if (!response.ok) throw new Error('Failed to submit decision');
      toast({ title: 'Decision submitted', description: `Checkpoint ${decision.toLowerCase()}` });
      fetchData();
    } catch (error) {
      toast({ title: 'Error', description: error instanceof Error ? error.message : 'Failed to submit decision', variant: 'destructive' });
    }
  };

  const getMethodIcon = (methodId: string) => {
    if (methodId.includes('observer')) return <Eye className="h-4 w-4" />;
    if (methodId.includes('proposer')) return <GitBranch className="h-4 w-4" />;
    if (methodId.includes('critic')) return <Shield className="h-4 w-4" />;
    if (methodId.includes('validator')) return <Scale className="h-4 w-4" />;
    if (methodId.includes('executor')) return <Zap className="h-4 w-4" />;
    if (methodId.includes('decider')) return <Brain className="h-4 w-4" />;
    return <FileText className="h-4 w-4" />;
  };

  if (loading) {
    return <div className="flex items-center justify-center h-64"><RefreshCw className="h-8 w-8 animate-spin" /></div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Cato Pipeline Orchestrator</h1>
          <p className="text-muted-foreground">Manage and monitor method pipeline executions</p>
        </div>
        <Dialog open={showNewPipeline} onOpenChange={setShowNewPipeline}>
          <DialogTrigger asChild>
            <Button><Play className="h-4 w-4 mr-2" /> New Pipeline</Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Start New Pipeline</DialogTitle>
              <DialogDescription>Configure and execute a method pipeline</DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>Request</Label>
                <Textarea placeholder="Describe your request..." value={newPipelineRequest} onChange={(e) => setNewPipelineRequest(e.target.value)} rows={3} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Template</Label>
                  <Select value={selectedTemplate} onValueChange={setSelectedTemplate}>
                    <SelectTrigger><SelectValue placeholder="Select template" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="">Custom</SelectItem>
                      {templates.map(t => <SelectItem key={t.templateId} value={t.templateId}>{t.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Governance Preset</Label>
                  <Select value={selectedPreset} onValueChange={setSelectedPreset}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="COWBOY">🚀 Cowboy (Max Autonomy)</SelectItem>
                      <SelectItem value="BALANCED">⚖️ Balanced (Conditional)</SelectItem>
                      <SelectItem value="PARANOID">🛡️ Paranoid (Full Oversight)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              {selectedTemplate && templates.find(t => t.templateId === selectedTemplate) && (
                <div className="p-3 bg-muted rounded-lg">
                  <p className="text-sm font-medium mb-2">Method Chain:</p>
                  <div className="flex flex-wrap gap-2">
                    {templates.find(t => t.templateId === selectedTemplate)?.methodChain.map((m, i) => (
                      <div key={i} className="flex items-center gap-1">
                        <Badge variant="outline" className="flex items-center gap-1">
                          {getMethodIcon(m)}
                          {m.split(':')[1]}
                        </Badge>
                        {i < (templates.find(t => t.templateId === selectedTemplate)?.methodChain.length || 0) - 1 && <ChevronRight className="h-3 w-3" />}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowNewPipeline(false)}>Cancel</Button>
              <Button onClick={handleStartPipeline} disabled={!newPipelineRequest}>Execute Pipeline</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {pendingCheckpoints.length > 0 && (
        <Card className="border-yellow-500">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-yellow-600">
              <AlertCircle className="h-5 w-5" /> Pending Checkpoints ({pendingCheckpoints.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {pendingCheckpoints.map(cp => (
                <div key={cp.id} className="flex items-center justify-between p-3 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg">
                  <div>
                    <p className="font-medium">{cp.checkpointName} ({cp.checkpointType})</p>
                    <p className="text-sm text-muted-foreground">{cp.triggerReason}</p>
                    <p className="text-xs text-muted-foreground">Deadline: {new Date(cp.deadline).toLocaleString()}</p>
                  </div>
                  <div className="flex gap-2">
                    <Button size="sm" variant="outline" onClick={() => handleCheckpointDecision(cp.id, 'REJECTED')}>Reject</Button>
                    <Button size="sm" onClick={() => handleCheckpointDecision(cp.id, 'APPROVED')}>Approve</Button>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <Tabs defaultValue="executions">
        <TabsList>
          <TabsTrigger value="executions">Executions</TabsTrigger>
          <TabsTrigger value="templates">Templates</TabsTrigger>
        </TabsList>

        <TabsContent value="executions" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Recent Executions</CardTitle>
              <CardDescription>Pipeline execution history and status</CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>ID</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Template</TableHead>
                    <TableHead>Preset</TableHead>
                    <TableHead>Methods</TableHead>
                    <TableHead>Cost</TableHead>
                    <TableHead>Duration</TableHead>
                    <TableHead>Started</TableHead>
                    <TableHead></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {executions.map(exec => (
                    <TableRow key={exec.id}>
                      <TableCell className="font-mono text-xs">{exec.id}</TableCell>
                      <TableCell>
                        <Badge className={`${statusColors[exec.status]} text-white`}>
                          <StatusIcon status={exec.status} />
                          <span className="ml-1">{exec.status}</span>
                        </Badge>
                      </TableCell>
                      <TableCell>{exec.templateId?.split(':')[1] || 'Custom'}</TableCell>
                      <TableCell>
                        <Badge variant="outline">
                          {exec.governancePreset === 'COWBOY' && '🚀'}
                          {exec.governancePreset === 'BALANCED' && '⚖️'}
                          {exec.governancePreset === 'PARANOID' && '🛡️'}
                          {exec.governancePreset}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          {exec.methodsExecuted.slice(0, 3).map((m, i) => (
                            <span key={i} title={m}>{getMethodIcon(m)}</span>
                          ))}
                          {exec.methodsExecuted.length > 3 && <span className="text-xs text-muted-foreground">+{exec.methodsExecuted.length - 3}</span>}
                        </div>
                      </TableCell>
                      <TableCell>${(exec.totalCostCents / 100).toFixed(2)}</TableCell>
                      <TableCell>{(exec.totalDurationMs / 1000).toFixed(1)}s</TableCell>
                      <TableCell className="text-xs">{new Date(exec.startedAt).toLocaleTimeString()}</TableCell>
                      <TableCell>
                        <Button size="sm" variant="ghost" onClick={() => setSelectedExecution(exec)}>
                          <Eye className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="templates" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {templates.map(template => (
              <Card key={template.templateId}>
                <CardHeader>
                  <CardTitle className="text-lg">{template.name}</CardTitle>
                  <CardDescription>{template.description}</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    <div>
                      <p className="text-xs text-muted-foreground mb-1">Method Chain ({template.methodChain.length} methods)</p>
                      <div className="flex flex-wrap gap-1">
                        {template.methodChain.map((m, i) => (
                          <Badge key={i} variant="secondary" className="text-xs">
                            {getMethodIcon(m)}
                            <span className="ml-1">{m.split(':')[1]}</span>
                          </Badge>
                        ))}
                      </div>
                    </div>
                    <Button size="sm" className="w-full" onClick={() => { setSelectedTemplate(template.templateId); setShowNewPipeline(true); }}>
                      <Play className="h-3 w-3 mr-1" /> Use Template
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>
      </Tabs>

      {selectedExecution && (
        <Dialog open={!!selectedExecution} onOpenChange={() => setSelectedExecution(null)}>
          <DialogContent className="max-w-3xl">
            <DialogHeader>
              <DialogTitle>Execution Details</DialogTitle>
              <DialogDescription>Pipeline: {selectedExecution.id}</DialogDescription>
            </DialogHeader>
            <ScrollArea className="max-h-[60vh]">
              <div className="space-y-4 p-1">
                <div className="grid grid-cols-3 gap-4">
                  <div className="p-3 bg-muted rounded-lg">
                    <p className="text-xs text-muted-foreground">Status</p>
                    <Badge className={`${statusColors[selectedExecution.status]} text-white mt-1`}>{selectedExecution.status}</Badge>
                  </div>
                  <div className="p-3 bg-muted rounded-lg">
                    <p className="text-xs text-muted-foreground">Total Cost</p>
                    <p className="text-lg font-bold">${(selectedExecution.totalCostCents / 100).toFixed(2)}</p>
                  </div>
                  <div className="p-3 bg-muted rounded-lg">
                    <p className="text-xs text-muted-foreground">Duration</p>
                    <p className="text-lg font-bold">{(selectedExecution.totalDurationMs / 1000).toFixed(1)}s</p>
                  </div>
                </div>
                <div>
                  <p className="text-sm font-medium mb-2">Method Execution Chain</p>
                  <div className="space-y-2">
                    {selectedExecution.methodsExecuted.map((method, i) => (
                      <div key={i} className="flex items-center gap-2 p-2 bg-muted rounded">
                        <span className="w-6 h-6 rounded-full bg-green-500 text-white text-xs flex items-center justify-center">{i + 1}</span>
                        {getMethodIcon(method)}
                        <span className="font-mono text-sm">{method}</span>
                        <CheckCircle className="h-4 w-4 text-green-500 ml-auto" />
                      </div>
                    ))}
                    {selectedExecution.currentMethod && (
                      <div className="flex items-center gap-2 p-2 bg-blue-50 dark:bg-blue-900/20 rounded border border-blue-200">
                        <span className="w-6 h-6 rounded-full bg-blue-500 text-white text-xs flex items-center justify-center">{selectedExecution.methodsExecuted.length + 1}</span>
                        {getMethodIcon(selectedExecution.currentMethod)}
                        <span className="font-mono text-sm">{selectedExecution.currentMethod}</span>
                        <RefreshCw className="h-4 w-4 text-blue-500 ml-auto animate-spin" />
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </ScrollArea>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
