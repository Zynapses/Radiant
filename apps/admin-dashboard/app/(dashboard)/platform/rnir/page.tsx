'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Progress } from '@/components/ui/progress';
import { useToast } from '@/components/ui/use-toast';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { 
  Code, FileCode, Cpu, Zap, RefreshCw, Play, CheckCircle, 
  XCircle, Clock, HardDrive, Layers, Brain
} from 'lucide-react';

interface RNIRDashboard {
  totalDocuments: number;
  totalExamples: number;
  byDomain: Record<string, number>;
  compilationStats: {
    pending: number;
    inProgress: number;
    completed: number;
    failed: number;
  };
  recentCompilations: RNIRCompilationJob[];
  artifactsByTarget: Record<string, number>;
  storageUsedBytes: number;
}

interface RNIRCompilationJob {
  id: string;
  tenantId: string;
  request: {
    cartridgeId: string;
    target: string;
    modelFamily: string;
  };
  status: string;
  progress: number;
  currentStep?: string;
  artifacts: RNIRCompiledArtifact[];
  startedAt?: string;
  completedAt?: string;
  error?: string;
  createdAt: string;
}

interface RNIRCompiledArtifact {
  id: string;
  target: string;
  modelFamily: string;
  artifactPath: string;
  sizeBytes: number;
  status: string;
  completedAt?: string;
}

interface RNIRDocumentPreview {
  cartridgeId: string;
  cartridgeName: string;
  domain: string;
  exampleCount: number;
  sampleExamples: Array<{ user: string; assistant: string }>;
  hasLoraArtifact: boolean;
  hasPromptArtifact: boolean;
  lastCompiled?: string;
}

const statusColors: Record<string, string> = {
  pending: 'bg-yellow-100 text-yellow-800',
  queued: 'bg-blue-100 text-blue-800',
  compiling: 'bg-purple-100 text-purple-800',
  completed: 'bg-green-100 text-green-800',
  failed: 'bg-red-100 text-red-800',
  cancelled: 'bg-gray-100 text-gray-800',
};

const statusIcons: Record<string, React.ReactNode> = {
  pending: <Clock className="h-4 w-4" />,
  queued: <Clock className="h-4 w-4" />,
  compiling: <Cpu className="h-4 w-4 animate-spin" />,
  completed: <CheckCircle className="h-4 w-4" />,
  failed: <XCircle className="h-4 w-4" />,
};

const targetIcons: Record<string, React.ReactNode> = {
  lora: <Brain className="h-4 w-4" />,
  system_prompt: <FileCode className="h-4 w-4" />,
  few_shot: <Layers className="h-4 w-4" />,
  rag_chunks: <HardDrive className="h-4 w-4" />,
};

export default function RNIRPage() {
  const [dashboard, setDashboard] = useState<RNIRDashboard | null>(null);
  const [jobs, setJobs] = useState<RNIRCompilationJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCompileDialog, setShowCompileDialog] = useState(false);
  const [compileForm, setCompileForm] = useState({
    cartridgeId: '',
    target: 'system_prompt',
    modelFamily: 'universal',
  });
  const { toast } = useToast();

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [dashRes, jobsRes] = await Promise.all([
        fetch('/api/admin/rnir/dashboard'),
        fetch('/api/admin/rnir/jobs'),
      ]);
      
      if (dashRes.ok) {
        setDashboard(await dashRes.json());
      }
      if (jobsRes.ok) {
        const data = await jobsRes.json();
        setJobs(data.jobs || []);
      }
    } catch (error) {
      toast({ title: 'Error', description: 'Failed to load RNIR data', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleStartCompilation = async () => {
    try {
      const res = await fetch('/api/admin/rnir/compile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(compileForm),
      });
      
      if (res.ok) {
        toast({ title: 'Success', description: 'Compilation job started' });
        setShowCompileDialog(false);
        fetchData();
      } else {
        throw new Error('Failed to start compilation');
      }
    } catch (error) {
      toast({ title: 'Error', description: 'Failed to start compilation', variant: 'destructive' });
    }
  };

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">RNIR Compiler</h1>
          <p className="text-muted-foreground">
            Radiant Neural Intermediate Representation - Model-agnostic cognitive source code
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={fetchData}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
          <Dialog open={showCompileDialog} onOpenChange={setShowCompileDialog}>
            <DialogTrigger asChild>
              <Button>
                <Play className="h-4 w-4 mr-2" />
                New Compilation
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Start RNIR Compilation</DialogTitle>
                <DialogDescription>
                  Compile RNIR source code to LoRA weights or system prompts
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label htmlFor="cartridgeId">Cartridge ID</Label>
                  <Input
                    id="cartridgeId"
                    placeholder="Enter cartridge UUID"
                    value={compileForm.cartridgeId}
                    onChange={(e) => setCompileForm({ ...compileForm, cartridgeId: e.target.value })}
                  />
                </div>
                <div>
                  <Label htmlFor="target">Compilation Target</Label>
                  <Select
                    value={compileForm.target}
                    onValueChange={(v) => setCompileForm({ ...compileForm, target: v })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="system_prompt">System Prompt</SelectItem>
                      <SelectItem value="few_shot">Few-Shot Examples</SelectItem>
                      <SelectItem value="lora">LoRA Weights</SelectItem>
                      <SelectItem value="rag_chunks">RAG Chunks</SelectItem>
                      <SelectItem value="all">All Formats</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="modelFamily">Model Family</Label>
                  <Select
                    value={compileForm.modelFamily}
                    onValueChange={(v) => setCompileForm({ ...compileForm, modelFamily: v })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="universal">Universal</SelectItem>
                      <SelectItem value="llama">Llama</SelectItem>
                      <SelectItem value="qwen">Qwen</SelectItem>
                      <SelectItem value="mistral">Mistral</SelectItem>
                      <SelectItem value="claude">Claude</SelectItem>
                      <SelectItem value="gpt">GPT</SelectItem>
                      <SelectItem value="gemini">Gemini</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setShowCompileDialog(false)}>Cancel</Button>
                <Button onClick={handleStartCompilation} disabled={!compileForm.cartridgeId}>
                  Start Compilation
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Dashboard Stats */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">RNIR Documents</CardTitle>
            <FileCode className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{dashboard?.totalDocuments || 0}</div>
            <p className="text-xs text-muted-foreground">
              {dashboard?.totalExamples || 0} total examples
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Active Compilations</CardTitle>
            <Cpu className="h-4 w-4 text-purple-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {(dashboard?.compilationStats.pending || 0) + (dashboard?.compilationStats.inProgress || 0)}
            </div>
            <p className="text-xs text-muted-foreground">
              {dashboard?.compilationStats.completed || 0} completed
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Compiled Artifacts</CardTitle>
            <Zap className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {Object.values(dashboard?.artifactsByTarget || {}).reduce((a, b) => a + b, 0)}
            </div>
            <div className="flex gap-1 mt-1">
              {Object.entries(dashboard?.artifactsByTarget || {}).map(([target, count]) => (
                count > 0 && (
                  <Badge key={target} variant="secondary" className="text-xs">
                    {target}: {count}
                  </Badge>
                )
              ))}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Storage Used</CardTitle>
            <HardDrive className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatBytes(dashboard?.storageUsedBytes || 0)}</div>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="jobs" className="space-y-4">
        <TabsList>
          <TabsTrigger value="jobs">Compilation Jobs</TabsTrigger>
          <TabsTrigger value="domains">By Domain</TabsTrigger>
        </TabsList>

        <TabsContent value="jobs">
          <Card>
            <CardHeader>
              <CardTitle>Compilation Jobs</CardTitle>
              <CardDescription>
                Track RNIR compilation progress and results
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Cartridge</TableHead>
                    <TableHead>Target</TableHead>
                    <TableHead>Model</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Progress</TableHead>
                    <TableHead>Created</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {jobs.map((job) => (
                    <TableRow key={job.id}>
                      <TableCell className="font-mono text-sm">
                        {job.request.cartridgeId.substring(0, 8)}...
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="gap-1">
                          {targetIcons[job.request.target]}
                          {job.request.target.replace('_', ' ')}
                        </Badge>
                      </TableCell>
                      <TableCell>{job.request.modelFamily}</TableCell>
                      <TableCell>
                        <Badge className={statusColors[job.status]}>
                          <span className="mr-1">{statusIcons[job.status]}</span>
                          {job.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="w-32">
                        <div className="flex items-center gap-2">
                          <Progress value={job.progress} className="h-2" />
                          <span className="text-xs text-muted-foreground">{job.progress}%</span>
                        </div>
                      </TableCell>
                      <TableCell>{new Date(job.createdAt).toLocaleString()}</TableCell>
                    </TableRow>
                  ))}
                  {jobs.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center text-muted-foreground">
                        No compilation jobs. Click New Compilation to start one.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="domains">
          <Card>
            <CardHeader>
              <CardTitle>Examples by Domain</CardTitle>
              <CardDescription>
                Distribution of RNIR training examples across domains
              </CardDescription>
            </CardHeader>
            <CardContent>
              {Object.keys(dashboard?.byDomain || {}).length > 0 ? (
                <div className="space-y-4">
                  {Object.entries(dashboard?.byDomain || {}).map(([domain, count]) => (
                    <div key={domain} className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Code className="h-4 w-4 text-muted-foreground" />
                        <span className="font-medium capitalize">{domain}</span>
                      </div>
                      <div className="flex items-center gap-4">
                        <Progress 
                          value={(count / (dashboard?.totalExamples || 1)) * 100} 
                          className="w-32 h-2" 
                        />
                        <span className="text-sm text-muted-foreground w-16 text-right">
                          {count} examples
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-center text-muted-foreground py-8">
                  No RNIR documents found. Generate RNIR from Curator knowledge first.
                </p>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
