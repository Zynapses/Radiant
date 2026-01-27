'use client';

import { useState, useEffect } from 'react';
import { useToast } from '@/components/ui/use-toast';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { AlertTriangle, CheckCircle, Clock, RefreshCw, Play, GitMerge, User } from 'lucide-react';

interface Conflict {
  id: string;
  factA: string;
  factB: string;
  sourceA: string;
  sourceB: string;
  dateA: string;
  dateB: string;
  status: 'pending' | 'resolved' | 'escalated';
  resolution?: {
    winner: 'A' | 'B' | 'BOTH_VALID' | 'MERGED';
    reason: string;
    resolvedBy: 'basic_rules' | 'llm' | 'human';
    confidence: number;
  };
  escalationReason?: string;
}

interface ConflictStats {
  pending: number;
  resolved: number;
  escalated: number;
  byTier: {
    basic: number;
    llm: number;
    human: number;
  };
}

export default function CortexConflictsPage() {
  const { toast } = useToast();
  const [conflicts, setConflicts] = useState<Conflict[]>([]);
  const [stats, setStats] = useState<ConflictStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [resolving, setResolving] = useState(false);
  const [selectedConflict, setSelectedConflict] = useState<Conflict | null>(null);
  const [manualResolution, setManualResolution] = useState({
    winner: '' as 'A' | 'B' | 'BOTH_VALID' | 'MERGED' | '',
    reason: '',
    mergedFact: '',
  });

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [conflictsRes, statsRes] = await Promise.all([
        fetch('/api/admin/cortex/graph/conflicts'),
        fetch('/api/admin/cortex/v2/graph-expansion/conflict-stats'),
      ]);

      if (conflictsRes.ok) {
        const data = await conflictsRes.json();
        setConflicts(data.conflicts || []);
      }

      if (statsRes.ok) {
        const data = await statsRes.json();
        setStats(data);
      }
    } catch (error) {
      console.error('Failed to fetch conflicts:', error);
    } finally {
      setLoading(false);
    }
  };

  const runAutoResolution = async () => {
    setResolving(true);
    try {
      const res = await fetch('/api/admin/cortex/v2/graph-expansion/resolve-conflicts', {
        method: 'POST',
      });
      if (res.ok) {
        const result = await res.json();
        toast({
          title: 'Auto-Resolution Complete',
          description: `Resolved: ${result.resolved}, Escalated: ${result.escalated}.`,
        });
        fetchData();
      } else {
        toast({
          title: 'Auto-Resolution Failed',
          description: 'Failed to run auto-resolution.',
          variant: 'destructive',
        });
      }
    } catch (error) {
      console.error('Auto-resolution failed:', error);
      toast({
        title: 'Auto-Resolution Failed',
        description: 'An error occurred during auto-resolution.',
        variant: 'destructive',
      });
    } finally {
      setResolving(false);
    }
  };

  const resolveManually = async () => {
    if (!selectedConflict || !manualResolution.winner) return;

    try {
      const res = await fetch(`/api/admin/cortex/v2/graph-expansion/conflicts/${selectedConflict.id}/resolve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          winner: manualResolution.winner,
          reason: manualResolution.reason,
          mergedFact: manualResolution.winner === 'MERGED' ? manualResolution.mergedFact : undefined,
        }),
      });

      if (res.ok) {
        setSelectedConflict(null);
        setManualResolution({ winner: '', reason: '', mergedFact: '' });
        fetchData();
      }
    } catch (error) {
      console.error('Manual resolution failed:', error);
    }
  };

  const getStatusBadge = (status: Conflict['status']) => {
    switch (status) {
      case 'pending':
        return <Badge variant="outline"><Clock className="mr-1 h-3 w-3" /> Pending</Badge>;
      case 'resolved':
        return <Badge variant="default"><CheckCircle className="mr-1 h-3 w-3" /> Resolved</Badge>;
      case 'escalated':
        return <Badge variant="destructive"><AlertTriangle className="mr-1 h-3 w-3" /> Escalated</Badge>;
    }
  };

  const getTierBadge = (tier: string) => {
    switch (tier) {
      case 'basic_rules':
        return <Badge variant="secondary">Basic Rules</Badge>;
      case 'llm':
        return <Badge variant="outline">LLM</Badge>;
      case 'human':
        return <Badge variant="default"><User className="mr-1 h-3 w-3" /> Human</Badge>;
      default:
        return <Badge variant="outline">{tier}</Badge>;
    }
  };

  const pendingConflicts = conflicts.filter(c => c.status === 'pending');
  const resolvedConflicts = conflicts.filter(c => c.status === 'resolved');
  const escalatedConflicts = conflicts.filter(c => c.status === 'escalated');

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Conflict Resolution</h1>
          <p className="text-muted-foreground">
            Manage knowledge graph conflicts with hybrid 3-tier resolution (Basic → LLM → Human)
          </p>
        </div>
        <div className="flex gap-2">
          <Button onClick={fetchData} variant="outline" disabled={loading}>
            <RefreshCw className={`mr-2 h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
          <Button onClick={runAutoResolution} disabled={resolving || pendingConflicts.length === 0}>
            <Play className={`mr-2 h-4 w-4 ${resolving ? 'animate-pulse' : ''}`} />
            Run Auto-Resolution
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-6">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Pending</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-yellow-600">{stats?.pending || 0}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Resolved</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{stats?.resolved || 0}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Escalated</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">{stats?.escalated || 0}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">By Basic Rules</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.byTier?.basic || 0}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">By LLM</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.byTier?.llm || 0}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">By Human</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.byTier?.human || 0}</div>
          </CardContent>
        </Card>
      </div>

      {/* Conflicts Table */}
      <Tabs defaultValue="escalated">
        <TabsList>
          <TabsTrigger value="escalated">
            Escalated ({escalatedConflicts.length})
          </TabsTrigger>
          <TabsTrigger value="pending">
            Pending ({pendingConflicts.length})
          </TabsTrigger>
          <TabsTrigger value="resolved">
            Resolved ({resolvedConflicts.length})
          </TabsTrigger>
        </TabsList>

        {['escalated', 'pending', 'resolved'].map((tab) => {
          const list = tab === 'escalated' ? escalatedConflicts 
            : tab === 'pending' ? pendingConflicts 
            : resolvedConflicts;

          return (
            <TabsContent key={tab} value={tab}>
              <Card>
                <CardContent className="pt-6">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Fact A</TableHead>
                        <TableHead>Fact B</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Resolution</TableHead>
                        <TableHead>Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {list.map((conflict) => (
                        <TableRow key={conflict.id}>
                          <TableCell>
                            <div className="max-w-[200px]">
                              <p className="truncate font-medium">{conflict.factA}</p>
                              <p className="text-xs text-muted-foreground">
                                {conflict.sourceA} • {new Date(conflict.dateA).toLocaleDateString()}
                              </p>
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="max-w-[200px]">
                              <p className="truncate font-medium">{conflict.factB}</p>
                              <p className="text-xs text-muted-foreground">
                                {conflict.sourceB} • {new Date(conflict.dateB).toLocaleDateString()}
                              </p>
                            </div>
                          </TableCell>
                          <TableCell>{getStatusBadge(conflict.status)}</TableCell>
                          <TableCell>
                            {conflict.resolution ? (
                              <div className="space-y-1">
                                <Badge variant="outline">Winner: {conflict.resolution.winner}</Badge>
                                {getTierBadge(conflict.resolution.resolvedBy)}
                              </div>
                            ) : conflict.escalationReason ? (
                              <span className="text-xs text-muted-foreground">{conflict.escalationReason}</span>
                            ) : (
                              '-'
                            )}
                          </TableCell>
                          <TableCell>
                            {(conflict.status === 'pending' || conflict.status === 'escalated') && (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => setSelectedConflict(conflict)}
                              >
                                <GitMerge className="mr-1 h-3 w-3" />
                                Resolve
                              </Button>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                      {list.length === 0 && (
                        <TableRow>
                          <TableCell colSpan={5} className="text-center text-muted-foreground">
                            No {tab} conflicts
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </TabsContent>
          );
        })}
      </Tabs>

      {/* Manual Resolution Dialog */}
      <Dialog open={!!selectedConflict} onOpenChange={() => setSelectedConflict(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Resolve Conflict Manually</DialogTitle>
            <DialogDescription>
              Review the conflicting facts and select a resolution.
            </DialogDescription>
          </DialogHeader>

          {selectedConflict && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm">Fact A</CardTitle>
                    <CardDescription>{selectedConflict.sourceA}</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm">{selectedConflict.factA}</p>
                    <p className="text-xs text-muted-foreground mt-2">
                      {new Date(selectedConflict.dateA).toLocaleString()}
                    </p>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm">Fact B</CardTitle>
                    <CardDescription>{selectedConflict.sourceB}</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm">{selectedConflict.factB}</p>
                    <p className="text-xs text-muted-foreground mt-2">
                      {new Date(selectedConflict.dateB).toLocaleString()}
                    </p>
                  </CardContent>
                </Card>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Resolution</label>
                <Select
                  value={manualResolution.winner}
                  onValueChange={(v) => setManualResolution({ ...manualResolution, winner: v as any })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select winner..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="A">Fact A is correct</SelectItem>
                    <SelectItem value="B">Fact B is correct</SelectItem>
                    <SelectItem value="BOTH_VALID">Both are valid (context-dependent)</SelectItem>
                    <SelectItem value="MERGED">Merge into single fact</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {manualResolution.winner === 'MERGED' && (
                <div className="space-y-2">
                  <label className="text-sm font-medium">Merged Fact</label>
                  <Textarea
                    placeholder="Enter the merged/corrected fact..."
                    value={manualResolution.mergedFact}
                    onChange={(e) => setManualResolution({ ...manualResolution, mergedFact: e.target.value })}
                  />
                </div>
              )}

              <div className="space-y-2">
                <label className="text-sm font-medium">Reason</label>
                <Textarea
                  placeholder="Explain your reasoning..."
                  value={manualResolution.reason}
                  onChange={(e) => setManualResolution({ ...manualResolution, reason: e.target.value })}
                />
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setSelectedConflict(null)}>
              Cancel
            </Button>
            <Button
              onClick={resolveManually}
              disabled={!manualResolution.winner || !manualResolution.reason}
            >
              Resolve
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
