'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Progress } from '@/components/ui/progress';
import { useToast } from '@/components/ui/use-toast';
import { 
  Play, Pause, RotateCcw, XCircle, RefreshCw, CheckCircle, 
  Clock, AlertTriangle, Download, Upload, Zap, History,
  ChevronRight, ChevronDown
} from 'lucide-react';

interface CartridgeOperation {
  id: string;
  tenantId: string;
  initiatedBy: string;
  type: string;
  status: string;
  progress: number;
  currentStep?: string;
  cartridgeIds: string[];
  steps: OperationStepStatus[];
  latestCheckpoint?: OperationCheckpoint;
  error?: string;
  createdAt: string;
  startedAt?: string;
  completedAt?: string;
  updatedAt: string;
  estimatedCompletionAt?: string;
}

interface OperationStepStatus {
  stepId: string;
  status: string;
  progress: number;
  startedAt?: string;
  completedAt?: string;
  error?: string;
}

interface OperationCheckpoint {
  id: string;
  stepId: string;
  stepProgress: number;
  createdAt: string;
}

interface OperationsDashboard {
  activeOperations: number;
  pendingOperations: number;
  completedToday: number;
  failedToday: number;
  byType: Record<string, number>;
  byStatus: Record<string, number>;
  recentOperations: CartridgeOperation[];
  avgCompletionTime: Record<string, number>;
  queueDepth: number;
}

const statusColors: Record<string, string> = {
  pending: 'bg-yellow-100 text-yellow-800',
  initializing: 'bg-blue-100 text-blue-800',
  in_progress: 'bg-purple-100 text-purple-800',
  paused: 'bg-orange-100 text-orange-800',
  checkpointing: 'bg-cyan-100 text-cyan-800',
  resuming: 'bg-indigo-100 text-indigo-800',
  completed: 'bg-green-100 text-green-800',
  failed: 'bg-red-100 text-red-800',
  cancelled: 'bg-gray-100 text-gray-800',
  rolled_back: 'bg-pink-100 text-pink-800',
};

const statusIcons: Record<string, React.ReactNode> = {
  pending: <Clock className="h-4 w-4" />,
  initializing: <Zap className="h-4 w-4" />,
  in_progress: <Play className="h-4 w-4" />,
  paused: <Pause className="h-4 w-4" />,
  checkpointing: <History className="h-4 w-4" />,
  resuming: <RotateCcw className="h-4 w-4" />,
  completed: <CheckCircle className="h-4 w-4" />,
  failed: <XCircle className="h-4 w-4" />,
  cancelled: <XCircle className="h-4 w-4" />,
  rolled_back: <RotateCcw className="h-4 w-4" />,
};

const typeIcons: Record<string, React.ReactNode> = {
  import: <Download className="h-4 w-4" />,
  export: <Upload className="h-4 w-4" />,
  compile_rnir: <Zap className="h-4 w-4" />,
  federation_sync: <RefreshCw className="h-4 w-4" />,
  bulk_export: <Upload className="h-4 w-4" />,
  bulk_import: <Download className="h-4 w-4" />,
  migration: <History className="h-4 w-4" />,
  validation: <CheckCircle className="h-4 w-4" />,
};

export default function CartridgeOperationsPage() {
  const [dashboard, setDashboard] = useState<OperationsDashboard | null>(null);
  const [operations, setOperations] = useState<CartridgeOperation[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedOp, setExpandedOp] = useState<string | null>(null);
  const { toast } = useToast();

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [dashRes, opsRes] = await Promise.all([
        fetch('/api/admin/cartridge-operations/dashboard'),
        fetch('/api/admin/cartridge-operations'),
      ]);
      
      if (dashRes.ok) {
        setDashboard(await dashRes.json());
      }
      if (opsRes.ok) {
        const data = await opsRes.json();
        setOperations(data.operations || []);
      }
    } catch (error) {
      toast({ title: 'Error', description: 'Failed to load operations data', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 10000);
    return () => clearInterval(interval);
  }, [fetchData]);

  const handlePause = async (operationId: string) => {
    try {
      const res = await fetch(`/api/admin/cartridge-operations/${operationId}/pause`, {
        method: 'POST',
      });
      if (res.ok) {
        toast({ title: 'Success', description: 'Operation paused' });
        fetchData();
      }
    } catch (error) {
      toast({ title: 'Error', description: 'Failed to pause operation', variant: 'destructive' });
    }
  };

  const handleResume = async (operationId: string) => {
    try {
      const res = await fetch(`/api/admin/cartridge-operations/${operationId}/resume`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      if (res.ok) {
        toast({ title: 'Success', description: 'Operation resumed' });
        fetchData();
      }
    } catch (error) {
      toast({ title: 'Error', description: 'Failed to resume operation', variant: 'destructive' });
    }
  };

  const handleCancel = async (operationId: string) => {
    if (!confirm('Are you sure you want to cancel this operation?')) return;
    
    try {
      const res = await fetch(`/api/admin/cartridge-operations/${operationId}/cancel`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: 'User cancelled' }),
      });
      if (res.ok) {
        toast({ title: 'Success', description: 'Operation cancelled' });
        fetchData();
      }
    } catch (error) {
      toast({ title: 'Error', description: 'Failed to cancel operation', variant: 'destructive' });
    }
  };

  const formatDuration = (seconds: number) => {
    if (seconds < 60) return `${seconds}s`;
    if (seconds < 3600) return `${Math.round(seconds / 60)}m`;
    return `${Math.round(seconds / 3600)}h`;
  };

  if (loading && !dashboard) {
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
          <h1 className="text-3xl font-bold tracking-tight">Cartridge Operations</h1>
          <p className="text-muted-foreground">
            Time Machine integration for long-running cartridge operations
          </p>
        </div>
        <Button variant="outline" onClick={fetchData}>
          <RefreshCw className="h-4 w-4 mr-2" />
          Refresh
        </Button>
      </div>

      {/* Dashboard Stats */}
      <div className="grid gap-4 md:grid-cols-5">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Active</CardTitle>
            <Play className="h-4 w-4 text-purple-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{dashboard?.activeOperations || 0}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Pending</CardTitle>
            <Clock className="h-4 w-4 text-yellow-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{dashboard?.pendingOperations || 0}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Queue Depth</CardTitle>
            <History className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{dashboard?.queueDepth || 0}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Completed Today</CardTitle>
            <CheckCircle className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{dashboard?.completedToday || 0}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Failed Today</CardTitle>
            <AlertTriangle className="h-4 w-4 text-red-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{dashboard?.failedToday || 0}</div>
          </CardContent>
        </Card>
      </div>

      {/* Average Completion Times */}
      {Object.keys(dashboard?.avgCompletionTime || {}).length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Average Completion Time by Type</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-4">
              {Object.entries(dashboard?.avgCompletionTime || {}).map(([type, seconds]) => (
                <div key={type} className="flex items-center gap-2">
                  <span className="text-muted-foreground">{typeIcons[type]}</span>
                  <span className="text-sm font-medium">{type.replace('_', ' ')}:</span>
                  <Badge variant="secondary">{formatDuration(seconds)}</Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <Tabs defaultValue="all" className="space-y-4">
        <TabsList>
          <TabsTrigger value="all">All Operations</TabsTrigger>
          <TabsTrigger value="active">Active</TabsTrigger>
          <TabsTrigger value="completed">Completed</TabsTrigger>
          <TabsTrigger value="failed">Failed</TabsTrigger>
        </TabsList>

        {['all', 'active', 'completed', 'failed'].map((tab) => (
          <TabsContent key={tab} value={tab}>
            <Card>
              <CardHeader>
                <CardTitle>
                  {tab === 'all' ? 'All Operations' : 
                   tab === 'active' ? 'Active Operations' :
                   tab === 'completed' ? 'Completed Operations' : 'Failed Operations'}
                </CardTitle>
                <CardDescription>
                  {tab === 'active' && 'Operations currently in progress with checkpoint support'}
                  {tab === 'completed' && 'Successfully completed operations'}
                  {tab === 'failed' && 'Failed operations that may be resumable'}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-8"></TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Progress</TableHead>
                      <TableHead>Current Step</TableHead>
                      <TableHead>Cartridges</TableHead>
                      <TableHead>Started</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {operations
                      .filter((op) => {
                        if (tab === 'active') return ['pending', 'initializing', 'in_progress', 'paused', 'checkpointing', 'resuming'].includes(op.status);
                        if (tab === 'completed') return op.status === 'completed';
                        if (tab === 'failed') return ['failed', 'cancelled', 'rolled_back'].includes(op.status);
                        return true;
                      })
                      .map((op) => (
                        <React.Fragment key={op.id}>
                          <TableRow className="cursor-pointer" onClick={() => setExpandedOp(expandedOp === op.id ? null : op.id)}>
                            <TableCell>
                              {expandedOp === op.id ? (
                                <ChevronDown className="h-4 w-4" />
                              ) : (
                                <ChevronRight className="h-4 w-4" />
                              )}
                            </TableCell>
                            <TableCell>
                              <Badge variant="outline" className="gap-1">
                                {typeIcons[op.type]}
                                {op.type.replace('_', ' ')}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              <Badge className={statusColors[op.status]}>
                                <span className="mr-1">{statusIcons[op.status]}</span>
                                {op.status.replace('_', ' ')}
                              </Badge>
                            </TableCell>
                            <TableCell className="w-32">
                              <div className="flex items-center gap-2">
                                <Progress value={op.progress} className="h-2" />
                                <span className="text-xs text-muted-foreground">{op.progress}%</span>
                              </div>
                            </TableCell>
                            <TableCell className="text-sm">{op.currentStep || '-'}</TableCell>
                            <TableCell>{op.cartridgeIds.length}</TableCell>
                            <TableCell>
                              {op.startedAt ? new Date(op.startedAt).toLocaleString() : '-'}
                            </TableCell>
                            <TableCell className="text-right">
                              {op.status === 'in_progress' && (
                                <Button variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); handlePause(op.id); }}>
                                  <Pause className="h-4 w-4" />
                                </Button>
                              )}
                              {(op.status === 'paused' || op.status === 'failed') && op.latestCheckpoint && (
                                <Button variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); handleResume(op.id); }}>
                                  <Play className="h-4 w-4" />
                                </Button>
                              )}
                              {['pending', 'in_progress', 'paused'].includes(op.status) && (
                                <Button variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); handleCancel(op.id); }}>
                                  <XCircle className="h-4 w-4 text-red-500" />
                                </Button>
                              )}
                            </TableCell>
                          </TableRow>
                          {expandedOp === op.id && (
                            <TableRow>
                              <TableCell colSpan={8} className="bg-muted/50">
                                <div className="p-4 space-y-4">
                                  <div className="grid grid-cols-3 gap-4 text-sm">
                                    <div>
                                      <span className="text-muted-foreground">Operation ID:</span>
                                      <span className="ml-2 font-mono">{op.id}</span>
                                    </div>
                                    <div>
                                      <span className="text-muted-foreground">Initiated By:</span>
                                      <span className="ml-2">{op.initiatedBy}</span>
                                    </div>
                                    <div>
                                      <span className="text-muted-foreground">Checkpoint:</span>
                                      <span className="ml-2">
                                        {op.latestCheckpoint ? (
                                          <Badge variant="outline" className="bg-cyan-50">
                                            Step {op.latestCheckpoint.stepId} @ {op.latestCheckpoint.stepProgress}%
                                          </Badge>
                                        ) : 'None'}
                                      </span>
                                    </div>
                                  </div>
                                  
                                  {op.error && (
                                    <div className="p-3 bg-red-50 border border-red-200 rounded-md text-sm text-red-800">
                                      <strong>Error:</strong> {op.error}
                                    </div>
                                  )}

                                  {op.steps.length > 0 && (
                                    <div>
                                      <h4 className="text-sm font-medium mb-2">Steps</h4>
                                      <div className="space-y-1">
                                        {op.steps.map((step) => (
                                          <div key={step.stepId} className="flex items-center gap-2 text-sm">
                                            <span className="w-4">
                                              {step.status === 'completed' && <CheckCircle className="h-4 w-4 text-green-500" />}
                                              {step.status === 'in_progress' && <Play className="h-4 w-4 text-purple-500" />}
                                              {step.status === 'failed' && <XCircle className="h-4 w-4 text-red-500" />}
                                              {step.status === 'pending' && <Clock className="h-4 w-4 text-gray-400" />}
                                              {step.status === 'skipped' && <span className="text-gray-400">-</span>}
                                            </span>
                                            <span className={step.status === 'pending' ? 'text-muted-foreground' : ''}>
                                              {step.stepId.replace(/_/g, ' ')}
                                            </span>
                                            {step.status === 'in_progress' && (
                                              <Progress value={step.progress} className="w-20 h-1" />
                                            )}
                                          </div>
                                        ))}
                                      </div>
                                    </div>
                                  )}
                                </div>
                              </TableCell>
                            </TableRow>
                          )}
                        </React.Fragment>
                      ))}
                    {operations.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={8} className="text-center text-muted-foreground">
                          No operations found
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}
