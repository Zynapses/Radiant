'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Progress } from '@/components/ui/progress';
import { Loader2 } from 'lucide-react';

interface ImprovementIdea {
  ideaId: string; ideaCode: string; title: string; description: string; category: string; priority: string;
  status: string; version: number; isDeprecated: boolean; deprecationReason?: string;
  confidenceScore: number; impactScore: number; feasibilityScore: number; compositeScore: number;
  createdAt: string; evolutionCount: number;
}
interface Notification { id: string; type: string; title: string; message: string; priority: string; read: boolean; createdAt: string; }
interface SelfAwareness { capability: string; strength: number; weakness: number; actual: number; trend: string; }
interface Stats { totalIdeas: number; activeIdeas: number; deprecatedIdeas: number; implementedIdeas: number; pendingReview: number; recentAnalyses: number; unreadNotifications: number; }


const defaultStats: Stats = { totalIdeas: 0, activeIdeas: 0, deprecatedIdeas: 0, implementedIdeas: 0, pendingReview: 0, recentAnalyses: 0, unreadNotifications: 0 };

export default function SelfImprovementPage() {
  const [selectedTab, setSelectedTab] = useState<'overview' | 'ideas' | 'awareness' | 'notifications' | 'history'>('overview');
  const [ideas, setIdeas] = useState<ImprovementIdea[]>([]);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [selfAwareness, setSelfAwareness] = useState<SelfAwareness[]>([]);
  const [stats, setStats] = useState<Stats>(defaultStats);
  const [selectedIdea, setSelectedIdea] = useState<ImprovementIdea | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadData() {
      setLoading(true);
      setError(null);
      try {
        const API = process.env.NEXT_PUBLIC_API_URL || '';
        const [ideasRes, notificationsRes, awarenessRes, statsRes] = await Promise.all([
          fetch(`${API}/api/admin/self-improvement/ideas`),
          fetch(`${API}/api/admin/self-improvement/notifications`),
          fetch(`${API}/api/admin/self-improvement/awareness`),
          fetch(`${API}/api/admin/self-improvement/stats`),
        ]);
        if (ideasRes.ok) { const { data } = await ideasRes.json(); setIdeas(data || []); }
        else setError('Failed to load self-improvement data.');
        if (notificationsRes.ok) { const { data } = await notificationsRes.json(); setNotifications(data || []); }
        if (awarenessRes.ok) { const { data } = await awarenessRes.json(); setSelfAwareness(data || []); }
        if (statsRes.ok) { const { data } = await statsRes.json(); setStats(data || defaultStats); }
      } catch { setError('Failed to connect to self-improvement service.'); }
      setLoading(false);
    }
    loadData();
  }, []);

  if (loading) return <div className="flex items-center justify-center h-96"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  if (error) return <div className="flex flex-col items-center justify-center h-96 text-destructive"><p className="text-lg font-medium">Error</p><p className="text-sm">{error}</p></div>;

  const filteredIdeas = ideas.filter((idea: ImprovementIdea) => {
    if (statusFilter !== 'all' && idea.status !== statusFilter) return false;
    if (categoryFilter !== 'all' && idea.category !== categoryFilter) return false;
    return true;
  });

  const getStatusVariant = (status: string): 'default' | 'secondary' | 'destructive' | 'outline' => {
    switch (status) {
      case 'proposed': return 'outline';
      case 'under_review': return 'secondary';
      case 'approved': return 'default';
      case 'implementing': return 'default';
      case 'implemented': return 'default';
      case 'deprecated': return 'secondary';
      default: return 'outline';
    }
  };

  const getPriorityVariant = (priority: string): 'default' | 'secondary' | 'destructive' | 'outline' => {
    switch (priority) {
      case 'critical': return 'destructive';
      case 'high': return 'default';
      case 'medium': return 'secondary';
      case 'low': return 'outline';
      default: return 'outline';
    }
  };

  const getTrendIcon = (trend: string) => {
    switch (trend) {
      case 'improving': return '↑';
      case 'declining': return '↓';
      default: return '→';
    }
  };

  const getTrendColor = (trend: string) => {
    switch (trend) {
      case 'improving': return 'text-green-500';
      case 'declining': return 'text-red-500';
      default: return 'text-muted-foreground';
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">AGI Self-Improvement Registry</h1>
          <p className="text-muted-foreground">Monitor and manage AGI self-awareness and improvement proposals</p>
        </div>
        <div className="flex gap-2">
          <Button>Run Self-Analysis</Button>
          <Button variant="outline">Export Report</Button>
        </div>
      </div>

      <Tabs value={selectedTab} onValueChange={(v) => setSelectedTab(v as typeof selectedTab)}>
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="ideas">Ideas</TabsTrigger>
          <TabsTrigger value="awareness">Awareness</TabsTrigger>
          <TabsTrigger value="notifications" className="relative">
            Notifications
            {stats.unreadNotifications > 0 && (
              <Badge variant="destructive" className="ml-2 h-5 px-1.5 text-xs">
                {stats.unreadNotifications}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="history">History</TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview" className="space-y-6">
          {/* Stats Grid */}
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-4">
            {[
              { label: 'Total Ideas', value: stats.totalIdeas },
              { label: 'Active', value: stats.activeIdeas },
              { label: 'Deprecated', value: stats.deprecatedIdeas },
              { label: 'Implemented', value: stats.implementedIdeas },
              { label: 'Pending Review', value: stats.pendingReview },
              { label: 'Recent Analyses', value: stats.recentAnalyses },
              { label: 'Notifications', value: stats.unreadNotifications },
            ].map((stat) => (
              <Card key={stat.label}>
                <CardContent className="pt-4 pb-4">
                  <p className="text-sm text-muted-foreground">{stat.label}</p>
                  <p className="text-2xl font-bold">{stat.value}</p>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Top Ideas by Score */}
          <Card>
            <CardHeader>
              <CardTitle>Top Improvement Ideas (by Composite Score)</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {ideas
                  .filter(i => !i.isDeprecated)
                  .sort((a, b) => b.compositeScore - a.compositeScore)
                  .slice(0, 5)
                  .map((idea) => (
                    <div key={idea.ideaId} className="flex items-center justify-between p-3 bg-muted rounded-lg">
                      <div className="flex items-center gap-3">
                        <span className="font-mono text-sm text-muted-foreground">{idea.ideaCode}</span>
                        <span className="font-medium">{idea.title}</span>
                        <Badge variant={getStatusVariant(idea.status)}>
                          {idea.status.replace('_', ' ')}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-4">
                        <Badge variant={getPriorityVariant(idea.priority)}>
                          {idea.priority}
                        </Badge>
                        <Progress value={idea.compositeScore * 100} className="w-24" />
                        <span className="text-sm font-medium text-muted-foreground w-12">
                          {(idea.compositeScore * 100).toFixed(0)}%
                        </span>
                      </div>
                    </div>
                  ))}
              </div>
            </CardContent>
          </Card>

          {/* Recent Notifications */}
          <Card>
            <CardHeader>
              <CardTitle>Recent Notifications</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {notifications.slice(0, 3).map((notif) => (
                  <div key={notif.id} className={`p-3 rounded-lg ${notif.read ? 'bg-muted' : 'bg-primary/5'}`}>
                    <div className="flex items-center justify-between">
                      <span className="font-medium">{notif.title}</span>
                      <span className="text-xs text-muted-foreground">{new Date(notif.createdAt).toLocaleDateString()}</span>
                    </div>
                    <p className="text-sm text-muted-foreground">{notif.message}</p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Ideas Tab */}
        <TabsContent value="ideas" className="space-y-4">
          {/* Filters */}
          <div className="flex gap-4">
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="All Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="proposed">Proposed</SelectItem>
                <SelectItem value="under_review">Under Review</SelectItem>
                <SelectItem value="approved">Approved</SelectItem>
                <SelectItem value="implementing">Implementing</SelectItem>
                <SelectItem value="implemented">Implemented</SelectItem>
                <SelectItem value="deprecated">Deprecated</SelectItem>
              </SelectContent>
            </Select>
            <Select value={categoryFilter} onValueChange={setCategoryFilter}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="All Categories" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Categories</SelectItem>
                <SelectItem value="reasoning">Reasoning</SelectItem>
                <SelectItem value="memory">Memory</SelectItem>
                <SelectItem value="safety">Safety</SelectItem>
                <SelectItem value="performance">Performance</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Ideas List */}
          <Card>
            <CardContent className="p-0">
              <table className="w-full">
                <thead>
                  <tr className="border-b">
                    <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase">Code</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase">Title</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase">Category</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase">Priority</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase">Status</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase">Version</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase">Score</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {filteredIdeas.map((idea) => (
                    <tr
                      key={idea.ideaId}
                      className={`hover:bg-muted/50 ${idea.isDeprecated ? 'opacity-60' : ''}`}
                    >
                      <td className="px-4 py-3 font-mono text-sm">{idea.ideaCode}</td>
                      <td className="px-4 py-3">
                        <Button
                          variant="link"
                          className="p-0 h-auto text-left"
                          onClick={() => setSelectedIdea(idea)}
                        >
                          {idea.title}
                        </Button>
                      </td>
                      <td className="px-4 py-3 capitalize">{idea.category}</td>
                      <td className="px-4 py-3">
                        <Badge variant={getPriorityVariant(idea.priority)}>
                          {idea.priority}
                        </Badge>
                      </td>
                      <td className="px-4 py-3">
                        <Badge variant={getStatusVariant(idea.status)}>
                          {idea.status.replace('_', ' ')}
                        </Badge>
                      </td>
                      <td className="px-4 py-3">
                        v{idea.version}
                        {idea.evolutionCount > 0 && (
                          <span className="ml-1 text-xs text-muted-foreground">({idea.evolutionCount} evolutions)</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <Progress value={idea.compositeScore * 100} className="w-16" />
                          <span className="text-sm">{(idea.compositeScore * 100).toFixed(0)}%</span>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex gap-2">
                          {!idea.isDeprecated && (
                            <>
                              <Button size="sm" variant="outline" className="text-xs h-7">
                                Approve
                              </Button>
                              <Button size="sm" variant="ghost" className="text-xs h-7">
                                Deprecate
                              </Button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Self-Awareness Tab */}
        <TabsContent value="awareness" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Performance Self-Awareness</CardTitle>
              <p className="text-sm text-muted-foreground">AGI&apos;s self-assessment vs actual measured performance</p>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {selfAwareness.map((item) => (
                  <div key={item.capability} className="p-4 bg-muted rounded-lg">
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-medium">{item.capability}</span>
                      <span className={`text-lg font-bold ${getTrendColor(item.trend)}`}>
                        {getTrendIcon(item.trend)} {item.trend}
                      </span>
                    </div>
                    <div className="grid grid-cols-3 gap-4">
                      <div>
                        <p className="text-xs text-muted-foreground mb-1">Self-Assessed Strength</p>
                        <div className="flex items-center gap-2">
                          <Progress value={item.strength * 100} className="flex-1" />
                          <span className="text-sm font-medium">{(item.strength * 100).toFixed(0)}%</span>
                        </div>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground mb-1">Actual Performance</p>
                        <div className="flex items-center gap-2">
                          <Progress value={item.actual * 100} className="flex-1" />
                          <span className="text-sm font-medium">{(item.actual * 100).toFixed(0)}%</span>
                        </div>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground mb-1">Calibration Accuracy</p>
                        <div className="flex items-center gap-2">
                          <Progress value={(1 - Math.abs(item.strength - item.actual)) * 100} className="flex-1" />
                          <span className="text-sm font-medium">
                            {((1 - Math.abs(item.strength - item.actual)) * 100).toFixed(0)}%
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Notifications Tab */}
        <TabsContent value="notifications">
          <Card>
            <CardHeader className="flex-row items-center justify-between">
              <CardTitle>Notifications</CardTitle>
              <Button variant="link" size="sm">Mark all as read</Button>
            </CardHeader>
            <CardContent className="p-0">
              <div className="divide-y">
                {notifications.map((notif) => (
                  <div
                    key={notif.id}
                    className={`p-4 ${notif.read ? '' : 'bg-primary/5'}`}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          {!notif.read && <span className="w-2 h-2 bg-primary rounded-full" />}
                          <span className="font-medium">{notif.title}</span>
                          <Badge variant={
                            notif.priority === 'high' ? 'destructive' :
                            notif.priority === 'normal' ? 'secondary' :
                            'outline'
                          }>
                            {notif.priority}
                          </Badge>
                        </div>
                        <p className="text-sm text-muted-foreground mt-1">{notif.message}</p>
                      </div>
                      <span className="text-xs text-muted-foreground whitespace-nowrap ml-4">
                        {new Date(notif.createdAt).toLocaleString()}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* History Tab */}
        <TabsContent value="history">
          <Card>
            <CardHeader>
              <CardTitle>Evolution History</CardTitle>
              <p className="text-sm text-muted-foreground">Track how improvement ideas evolve over time</p>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="border-l-2 border-primary pl-4 py-2">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-sm text-muted-foreground">SI-0003</span>
                    <Badge variant="secondary">expansion</Badge>
                  </div>
                  <p className="font-medium">v2 → v3: Added medical domain specialization</p>
                  <p className="text-sm text-muted-foreground">Expanded scope to include medical terminology verification</p>
                  <p className="text-xs text-muted-foreground mt-1">2024-12-25 14:30</p>
                </div>
                <div className="border-l-2 border-yellow-500 pl-4 py-2">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-sm text-muted-foreground">SI-0005</span>
                    <Badge variant="outline">deprecation</Badge>
                  </div>
                  <p className="font-medium">Deprecated: Superseded by SI-0008</p>
                  <p className="text-sm text-muted-foreground">More comprehensive approach developed</p>
                  <p className="text-xs text-muted-foreground mt-1">2024-12-24 10:00</p>
                </div>
                <div className="border-l-2 border-green-500 pl-4 py-2">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-sm text-muted-foreground">SI-0001</span>
                    <Badge variant="secondary">refinement</Badge>
                  </div>
                  <p className="font-medium">v1 → v2: Refined calibration approach</p>
                  <p className="text-sm text-muted-foreground">Added domain-specific calibration curves</p>
                  <p className="text-xs text-muted-foreground mt-1">2024-12-23 16:45</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Idea Detail Dialog */}
      <Dialog open={!!selectedIdea} onOpenChange={(open) => !open && setSelectedIdea(null)}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <span className="font-mono text-sm text-muted-foreground">{selectedIdea?.ideaCode}</span>
            <DialogTitle>{selectedIdea?.title}</DialogTitle>
          </DialogHeader>
          {selectedIdea && (
            <div className="space-y-4">
              <div className="flex gap-2 flex-wrap">
                <Badge variant={getStatusVariant(selectedIdea.status)}>
                  {selectedIdea.status.replace('_', ' ')}
                </Badge>
                <Badge variant="secondary">
                  {selectedIdea.category}
                </Badge>
                <Badge variant={getPriorityVariant(selectedIdea.priority)}>
                  {selectedIdea.priority} priority
                </Badge>
                <Badge variant="outline">
                  v{selectedIdea.version}
                </Badge>
              </div>

              <div>
                <h3 className="font-medium mb-1">Description</h3>
                <p className="text-muted-foreground">{selectedIdea.description}</p>
              </div>

              {selectedIdea.isDeprecated && (
                <div className="p-3 bg-yellow-500/10 border border-yellow-500/20 rounded-lg">
                  <p className="text-sm font-medium text-yellow-600 dark:text-yellow-400">⚠️ Deprecated</p>
                  <p className="text-sm text-yellow-600/80 dark:text-yellow-400/80">{selectedIdea.deprecationReason}</p>
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-muted-foreground">Confidence Score</p>
                  <div className="flex items-center gap-2">
                    <Progress value={selectedIdea.confidenceScore * 100} className="flex-1" />
                    <span className="font-medium">{(selectedIdea.confidenceScore * 100).toFixed(0)}%</span>
                  </div>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Impact Score</p>
                  <div className="flex items-center gap-2">
                    <Progress value={(selectedIdea.impactScore || 0) * 100} className="flex-1" />
                    <span className="font-medium">{((selectedIdea.impactScore || 0) * 100).toFixed(0)}%</span>
                  </div>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Feasibility Score</p>
                  <div className="flex items-center gap-2">
                    <Progress value={(selectedIdea.feasibilityScore || 0) * 100} className="flex-1" />
                    <span className="font-medium">{((selectedIdea.feasibilityScore || 0) * 100).toFixed(0)}%</span>
                  </div>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Composite Score</p>
                  <div className="flex items-center gap-2">
                    <Progress value={selectedIdea.compositeScore * 100} className="flex-1" />
                    <span className="font-medium">{(selectedIdea.compositeScore * 100).toFixed(0)}%</span>
                  </div>
                </div>
              </div>

              <div className="flex gap-2 pt-4 border-t">
                {!selectedIdea.isDeprecated && (
                  <>
                    <Button>Approve</Button>
                    <Button variant="secondary">Evolve Idea</Button>
                    <Button variant="outline">Deprecate</Button>
                  </>
                )}
                <Button
                  variant="ghost"
                  onClick={() => setSelectedIdea(null)}
                  className="ml-auto"
                >
                  Close
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
