'use client';

/**
 * The Grimoire Admin Page
 * RADIANT v5.0.2 - System Evolution
 * 
 * Admin interface for managing procedural memory (heuristics).
 */

import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from '@/components/ui/table';
import { 
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { 
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { useToast } from '@/components/ui/use-toast';
import { 
  BookOpen, 
  Plus, 
  Trash2, 
  RefreshCw, 
  ThumbsUp, 
  ThumbsDown,
  Search,
  Filter,
  Download,
  Upload,
  TrendingUp,
  AlertTriangle,
  CheckCircle2,
  Clock
} from 'lucide-react';

interface Heuristic {
  id: string;
  domain: string;
  heuristic_text: string;
  confidence_score: number;
  source_execution_id: string | null;
  created_at: string;
  updated_at: string;
  expires_at: string;
}

interface GrimoireStats {
  total_heuristics: number;
  total_high_confidence: number;
  total_expiring_soon: number;
  by_domain: Record<string, {
    total: number;
    avg_confidence: number;
    high_confidence: number;
    expiring_soon: number;
    last_added: string | null;
  }>;
  domain_count: number;
}

const DOMAINS = ['general', 'medical', 'financial', 'legal', 'technical', 'creative'];

export default function GrimoirePage() {
  const { toast } = useToast();
  const [heuristics, setHeuristics] = useState<Heuristic[]>([]);
  const [stats, setStats] = useState<GrimoireStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedDomain, setSelectedDomain] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [newHeuristic, setNewHeuristic] = useState({ domain: 'general', text: '' });

  const fetchHeuristics = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (selectedDomain !== 'all') params.set('domain', selectedDomain);
      if (searchQuery) params.set('search', searchQuery);
      
      const response = await fetch(`/api/thinktank/grimoire/heuristics?${params}`);
      if (!response.ok) throw new Error('Failed to fetch heuristics');
      const data = await response.json();
      setHeuristics(data.heuristics || []);
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to load heuristics',
        variant: 'destructive'
      });
    }
  }, [selectedDomain, searchQuery, toast]);

  const fetchStats = useCallback(async () => {
    try {
      const response = await fetch('/api/thinktank/grimoire/stats');
      if (!response.ok) throw new Error('Failed to fetch stats');
      const data = await response.json();
      setStats(data);
    } catch (error) {
      console.error('Failed to fetch grimoire stats:', error);
    }
  }, []);

  useEffect(() => {
    Promise.all([fetchHeuristics(), fetchStats()]).finally(() => setLoading(false));
  }, [fetchHeuristics, fetchStats]);

  const handleAddHeuristic = async () => {
    if (!newHeuristic.text.trim()) {
      toast({ title: 'Error', description: 'Heuristic text is required', variant: 'destructive' });
      return;
    }

    try {
      const response = await fetch('/api/thinktank/grimoire/heuristics', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          domain: newHeuristic.domain,
          heuristic_text: newHeuristic.text
        })
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to add heuristic');
      }

      toast({ title: 'Success', description: 'Heuristic added successfully' });
      setIsAddDialogOpen(false);
      setNewHeuristic({ domain: 'general', text: '' });
      fetchHeuristics();
      fetchStats();
    } catch (error: any) {
      toast({ 
        title: 'Error', 
        description: error.message || 'Failed to add heuristic', 
        variant: 'destructive' 
      });
    }
  };

  const handleDeleteHeuristic = async (id: string) => {
    try {
      const response = await fetch(`/api/thinktank/grimoire/heuristics/${id}`, {
        method: 'DELETE'
      });

      if (!response.ok) throw new Error('Failed to delete heuristic');

      toast({ title: 'Success', description: 'Heuristic deleted' });
      fetchHeuristics();
      fetchStats();
    } catch (error) {
      toast({ title: 'Error', description: 'Failed to delete heuristic', variant: 'destructive' });
    }
  };

  const handleReinforce = async (id: string, positive: boolean) => {
    try {
      const response = await fetch(`/api/thinktank/grimoire/heuristics/${id}/reinforce`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ positive })
      });

      if (!response.ok) throw new Error('Failed to update heuristic');

      toast({ 
        title: 'Success', 
        description: positive ? 'Confidence increased' : 'Confidence decreased' 
      });
      fetchHeuristics();
    } catch (error) {
      toast({ title: 'Error', description: 'Failed to update heuristic', variant: 'destructive' });
    }
  };

  const getConfidenceBadge = (score: number) => {
    if (score >= 0.8) return <Badge className="bg-green-500">High ({(score * 100).toFixed(0)}%)</Badge>;
    if (score >= 0.5) return <Badge className="bg-yellow-500">Medium ({(score * 100).toFixed(0)}%)</Badge>;
    return <Badge className="bg-red-500">Low ({(score * 100).toFixed(0)}%)</Badge>;
  };

  const getDomainBadge = (domain: string) => {
    const colors: Record<string, string> = {
      medical: 'bg-red-100 text-red-800',
      financial: 'bg-green-100 text-green-800',
      legal: 'bg-purple-100 text-purple-800',
      technical: 'bg-blue-100 text-blue-800',
      creative: 'bg-pink-100 text-pink-800',
      general: 'bg-gray-100 text-gray-800'
    };
    return <Badge className={colors[domain] || colors.general}>{domain}</Badge>;
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
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <BookOpen className="h-8 w-8" />
            The Grimoire
          </h1>
          <p className="text-muted-foreground mt-1">
            Self-optimizing procedural memory for AI agents
          </p>
        </div>
        <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Add Heuristic
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add Manual Heuristic</DialogTitle>
              <DialogDescription>
                Add a new heuristic that AI agents will use for similar tasks.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>Domain</Label>
                <Select 
                  value={newHeuristic.domain} 
                  onValueChange={(v) => setNewHeuristic({ ...newHeuristic, domain: v })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {DOMAINS.map(d => (
                      <SelectItem key={d} value={d}>{d.charAt(0).toUpperCase() + d.slice(1)}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Heuristic</Label>
                <Textarea
                  placeholder="When [condition], always [action]..."
                  value={newHeuristic.text}
                  onChange={(e) => setNewHeuristic({ ...newHeuristic, text: e.target.value })}
                  rows={4}
                />
                <p className="text-xs text-muted-foreground">
                  Format: &quot;When [specific condition], always [specific action]&quot;
                </p>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsAddDialogOpen(false)}>Cancel</Button>
              <Button onClick={handleAddHeuristic}>Add Heuristic</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Statistics Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Heuristics</CardTitle>
            <BookOpen className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.total_heuristics || 0}</div>
            <p className="text-xs text-muted-foreground">
              Across {stats?.domain_count || 0} domains
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">High Confidence</CardTitle>
            <CheckCircle2 className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.total_high_confidence || 0}</div>
            <p className="text-xs text-muted-foreground">
              Confidence ≥ 80%
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Expiring Soon</CardTitle>
            <Clock className="h-4 w-4 text-yellow-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.total_expiring_soon || 0}</div>
            <p className="text-xs text-muted-foreground">
              Within 7 days
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Learning Rate</CardTitle>
            <TrendingUp className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {stats?.total_heuristics ? '+' + Math.round(stats.total_heuristics / 30) : 0}/day
            </div>
            <p className="text-xs text-muted-foreground">
              Average new heuristics
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Domain Statistics */}
      {stats?.by_domain && Object.keys(stats.by_domain).length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Heuristics by Domain</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-3 lg:grid-cols-6">
              {Object.entries(stats.by_domain).map(([domain, data]) => (
                <div key={domain} className="p-4 border rounded-lg">
                  {getDomainBadge(domain)}
                  <div className="mt-2 text-2xl font-bold">{data.total}</div>
                  <div className="text-xs text-muted-foreground">
                    Avg: {(data.avg_confidence * 100).toFixed(0)}%
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Heuristics Table */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Heuristics</CardTitle>
            <div className="flex items-center gap-2">
              <div className="relative">
                <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search heuristics..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-8 w-64"
                />
              </div>
              <Select value={selectedDomain} onValueChange={setSelectedDomain}>
                <SelectTrigger className="w-36">
                  <Filter className="h-4 w-4 mr-2" />
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Domains</SelectItem>
                  {DOMAINS.map(d => (
                    <SelectItem key={d} value={d}>{d.charAt(0).toUpperCase() + d.slice(1)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button variant="outline" size="icon" onClick={() => fetchHeuristics()}>
                <RefreshCw className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Domain</TableHead>
                <TableHead className="w-[50%]">Heuristic</TableHead>
                <TableHead>Confidence</TableHead>
                <TableHead>Created</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {heuristics.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                    No heuristics found. The Grimoire will learn from successful AI executions.
                  </TableCell>
                </TableRow>
              ) : (
                heuristics.map((h) => (
                  <TableRow key={h.id}>
                    <TableCell>{getDomainBadge(h.domain)}</TableCell>
                    <TableCell className="font-mono text-sm">{h.heuristic_text}</TableCell>
                    <TableCell>{getConfidenceBadge(h.confidence_score)}</TableCell>
                    <TableCell className="text-muted-foreground text-sm">
                      {new Date(h.created_at).toLocaleDateString()}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button 
                          variant="ghost" 
                          size="icon"
                          onClick={() => handleReinforce(h.id, true)}
                          title="Increase confidence"
                        >
                          <ThumbsUp className="h-4 w-4 text-green-500" />
                        </Button>
                        <Button 
                          variant="ghost" 
                          size="icon"
                          onClick={() => handleReinforce(h.id, false)}
                          title="Decrease confidence"
                        >
                          <ThumbsDown className="h-4 w-4 text-red-500" />
                        </Button>
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button variant="ghost" size="icon">
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Delete Heuristic?</AlertDialogTitle>
                              <AlertDialogDescription>
                                This will permanently remove this heuristic from The Grimoire.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancel</AlertDialogCancel>
                              <AlertDialogAction onClick={() => handleDeleteHeuristic(h.id)}>
                                Delete
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
