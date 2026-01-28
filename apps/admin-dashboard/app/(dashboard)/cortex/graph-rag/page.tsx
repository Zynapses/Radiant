'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/components/ui/use-toast';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
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
  DialogTrigger,
} from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { api } from '@/lib/api/client';
import {
  RefreshCw,
  Database,
  Network,
  Search,
  Plus,
  Trash2,
  Activity,
  Brain,
  FileText,
  Users,
  Building,
  MapPin,
  Calendar,
  Tag,
  CheckCircle,
  XCircle,
  AlertTriangle,
} from 'lucide-react';

const ENTITY_TYPES = [
  { value: 'person', label: 'Person', icon: Users },
  { value: 'organization', label: 'Organization', icon: Building },
  { value: 'concept', label: 'Concept', icon: Brain },
  { value: 'event', label: 'Event', icon: Calendar },
  { value: 'location', label: 'Location', icon: MapPin },
  { value: 'document', label: 'Document', icon: FileText },
  { value: 'topic', label: 'Topic', icon: Tag },
];

export default function CortexGraphRagPage() {
  const [selectedTenant, setSelectedTenant] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState('');
  const [entityTypeFilter, setEntityTypeFilter] = useState<string>('');
  const [showCreateEntity, setShowCreateEntity] = useState(false);
  const [newEntity, setNewEntity] = useState({ type: 'concept', name: '', description: '' });
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch dashboard data
  const { data: dashboard, isLoading, error: _error, refetch } = useQuery({
    queryKey: ['cortex-dashboard', selectedTenant],
    queryFn: async () => {
      if (!selectedTenant) return null;
      const response = await api.get<{ data: any }>(`/api/admin/cortex/dashboard?tenantId=${selectedTenant}`);
      return response.data;
    },
    enabled: !!selectedTenant,
    refetchInterval: 30000,
  });

  // Fetch entities
  const { data: entities, isLoading: entitiesLoading } = useQuery({
    queryKey: ['cortex-entities', selectedTenant, entityTypeFilter, searchQuery],
    queryFn: async () => {
      if (!selectedTenant) return { data: [], total: 0 };
      let url = `/api/admin/cortex/entities?tenantId=${selectedTenant}`;
      if (entityTypeFilter) url += `&type=${entityTypeFilter}`;
      if (searchQuery) url += `&search=${encodeURIComponent(searchQuery)}`;
      const response = await api.get<{ data: any[]; total: number }>(url);
      return response;
    },
    enabled: !!selectedTenant,
  });

  // Update config mutation
  const updateConfigMutation = useMutation({
    mutationFn: async (updates: Record<string, any>) => {
      await api.put(`/api/admin/cortex/config?tenantId=${selectedTenant}`, updates);
    },
    onSuccess: () => {
      toast({ title: 'Configuration updated' });
      queryClient.invalidateQueries({ queryKey: ['cortex-dashboard'] });
    },
    onError: (_error: any) => {
      toast({ title: 'Failed to update configuration', variant: 'destructive' });
    },
  });

  // Create entity mutation
  const createEntityMutation = useMutation({
    mutationFn: async (entity: { type: string; name: string; description: string }) => {
      await api.post(`/api/admin/cortex/entities?tenantId=${selectedTenant}`, entity);
    },
    onSuccess: () => {
      toast({ title: 'Entity created' });
      setShowCreateEntity(false);
      setNewEntity({ type: 'concept', name: '', description: '' });
      queryClient.invalidateQueries({ queryKey: ['cortex-entities'] });
      queryClient.invalidateQueries({ queryKey: ['cortex-dashboard'] });
    },
    onError: (_error: any) => {
      toast({ title: 'Failed to create entity', variant: 'destructive' });
    },
  });

  // Delete entity mutation
  const deleteEntityMutation = useMutation({
    mutationFn: async (entityId: string) => {
      await api.delete(`/api/admin/cortex/entities/${entityId}?tenantId=${selectedTenant}`);
    },
    onSuccess: () => {
      toast({ title: 'Entity deleted' });
      queryClient.invalidateQueries({ queryKey: ['cortex-entities'] });
      queryClient.invalidateQueries({ queryKey: ['cortex-dashboard'] });
    },
  });

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'healthy':
      case 'up':
      case 'synced':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'degraded':
      case 'syncing':
        return <AlertTriangle className="h-4 w-4 text-yellow-500" />;
      default:
        return <XCircle className="h-4 w-4 text-red-500" />;
    }
  };

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Cortex Graph-RAG</h1>
          <p className="text-muted-foreground">
            Knowledge graph engine with vector embeddings for intelligent retrieval
          </p>
        </div>
        <div className="flex items-center gap-4">
          <Select value={selectedTenant} onValueChange={setSelectedTenant}>
            <SelectTrigger className="w-[200px]">
              <SelectValue placeholder="Select tenant" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="default">Default Tenant</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isLoading}>
            <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>
      </div>

      {!selectedTenant ? (
        <Card>
          <CardContent className="flex items-center justify-center py-12">
            <p className="text-muted-foreground">Select a tenant to view Cortex dashboard</p>
          </CardContent>
        </Card>
      ) : isLoading ? (
        <div className="grid gap-4 md:grid-cols-4">
          {[1, 2, 3, 4].map((i) => (
            <Card key={i}>
              <CardHeader className="pb-2">
                <Skeleton className="h-4 w-24" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-8 w-16 mb-2" />
                <Skeleton className="h-3 w-32" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : dashboard ? (
        <>
          {/* Stats Cards */}
          <div className="grid gap-4 md:grid-cols-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">Entities</CardTitle>
                <Database className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{dashboard.stats.totalEntities.toLocaleString()}</div>
                <p className="text-xs text-muted-foreground">Knowledge graph nodes</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">Relationships</CardTitle>
                <Network className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{dashboard.stats.totalRelationships.toLocaleString()}</div>
                <p className="text-xs text-muted-foreground">Graph connections</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">Chunks</CardTitle>
                <FileText className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{dashboard.stats.totalChunks.toLocaleString()}</div>
                <p className="text-xs text-muted-foreground">Indexed text segments</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">Queries (24h)</CardTitle>
                <Search className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{dashboard.stats.queriesLast24h}</div>
                <p className="text-xs text-muted-foreground">
                  {dashboard.stats.ingestsLast24h} ingests
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Graph Health */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Graph Health</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-8">
                <div className="flex items-center gap-2">
                  {getStatusIcon(dashboard.graphHealth.status)}
                  <span className="text-sm">Overall: {dashboard.graphHealth.status}</span>
                </div>
                <div className="flex items-center gap-2">
                  {getStatusIcon(dashboard.graphHealth.embeddingServiceStatus)}
                  <span className="text-sm">Embedding Service: {dashboard.graphHealth.embeddingServiceStatus}</span>
                </div>
                <div className="flex items-center gap-2">
                  {getStatusIcon(dashboard.graphHealth.vectorIndexStatus)}
                  <span className="text-sm">Vector Index: {dashboard.graphHealth.vectorIndexStatus}</span>
                </div>
                {dashboard.graphHealth.orphanedEntities > 0 && (
                  <Badge variant="outline" className="text-yellow-500">
                    {dashboard.graphHealth.orphanedEntities} orphaned entities
                  </Badge>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Tabs */}
          <Tabs defaultValue="entities" className="space-y-4">
            <TabsList>
              <TabsTrigger value="entities">Entities</TabsTrigger>
              <TabsTrigger value="activity">Activity</TabsTrigger>
              <TabsTrigger value="config">Configuration</TabsTrigger>
            </TabsList>

            {/* Entities Tab */}
            <TabsContent value="entities" className="space-y-4">
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle>Knowledge Entities</CardTitle>
                    <Dialog open={showCreateEntity} onOpenChange={setShowCreateEntity}>
                      <DialogTrigger asChild>
                        <Button size="sm">
                          <Plus className="h-4 w-4 mr-2" />
                          Add Entity
                        </Button>
                      </DialogTrigger>
                      <DialogContent>
                        <DialogHeader>
                          <DialogTitle>Create Entity</DialogTitle>
                          <DialogDescription>Add a new entity to the knowledge graph</DialogDescription>
                        </DialogHeader>
                        <div className="space-y-4 py-4">
                          <div className="space-y-2">
                            <Label>Type</Label>
                            <Select
                              value={newEntity.type}
                              onValueChange={(v) => setNewEntity({ ...newEntity, type: v })}
                            >
                              <SelectTrigger>
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {ENTITY_TYPES.map((t) => (
                                  <SelectItem key={t.value} value={t.value}>
                                    {t.label}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="space-y-2">
                            <Label>Name</Label>
                            <Input
                              value={newEntity.name}
                              onChange={(e) => setNewEntity({ ...newEntity, name: e.target.value })}
                              placeholder="Entity name"
                            />
                          </div>
                          <div className="space-y-2">
                            <Label>Description</Label>
                            <Textarea
                              value={newEntity.description}
                              onChange={(e) => setNewEntity({ ...newEntity, description: e.target.value })}
                              placeholder="Optional description"
                            />
                          </div>
                        </div>
                        <DialogFooter>
                          <Button variant="outline" onClick={() => setShowCreateEntity(false)}>
                            Cancel
                          </Button>
                          <Button
                            onClick={() => createEntityMutation.mutate(newEntity)}
                            disabled={!newEntity.name || createEntityMutation.isPending}
                          >
                            Create
                          </Button>
                        </DialogFooter>
                      </DialogContent>
                    </Dialog>
                  </div>
                </CardHeader>
                <CardContent>
                  {/* Filters */}
                  <div className="flex gap-4 mb-4">
                    <div className="flex-1">
                      <Input
                        placeholder="Search entities..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="max-w-sm"
                      />
                    </div>
                    <Select value={entityTypeFilter} onValueChange={setEntityTypeFilter}>
                      <SelectTrigger className="w-[180px]">
                        <SelectValue placeholder="All types" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="">All types</SelectItem>
                        {ENTITY_TYPES.map((t) => (
                          <SelectItem key={t.value} value={t.value}>
                            {t.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Entities Table */}
                  {entitiesLoading ? (
                    <div className="space-y-2">
                      {[1, 2, 3].map((i) => (
                        <Skeleton key={i} className="h-12 w-full" />
                      ))}
                    </div>
                  ) : (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Name</TableHead>
                          <TableHead>Type</TableHead>
                          <TableHead>Confidence</TableHead>
                          <TableHead>Access Count</TableHead>
                          <TableHead>Created</TableHead>
                          <TableHead className="w-[100px]">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {entities?.data?.map((entity: any) => {
                          const typeInfo = ENTITY_TYPES.find((t) => t.value === entity.type);
                          const TypeIcon = typeInfo?.icon || Tag;
                          return (
                            <TableRow key={entity.id}>
                              <TableCell>
                                <div className="flex items-center gap-2">
                                  <TypeIcon className="h-4 w-4 text-muted-foreground" />
                                  <span className="font-medium">{entity.name}</span>
                                </div>
                              </TableCell>
                              <TableCell>
                                <Badge variant="outline">{entity.type}</Badge>
                              </TableCell>
                              <TableCell>{(entity.confidence * 100).toFixed(0)}%</TableCell>
                              <TableCell>{entity.accessCount}</TableCell>
                              <TableCell>
                                {new Date(entity.createdAt).toLocaleDateString()}
                              </TableCell>
                              <TableCell>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => deleteEntityMutation.mutate(entity.id)}
                                >
                                  <Trash2 className="h-4 w-4 text-destructive" />
                                </Button>
                              </TableCell>
                            </TableRow>
                          );
                        })}
                        {(!entities?.data || entities.data.length === 0) && (
                          <TableRow>
                            <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                              No entities found
                            </TableCell>
                          </TableRow>
                        )}
                      </TableBody>
                    </Table>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            {/* Activity Tab */}
            <TabsContent value="activity">
              <Card>
                <CardHeader>
                  <CardTitle>Recent Activity</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {dashboard.recentActivity.map((activity: any) => (
                      <div
                        key={activity.id}
                        className="flex items-center gap-4 p-3 rounded-lg border"
                      >
                        <div className="p-2 rounded-full bg-muted">
                          <Activity className="h-4 w-4" />
                        </div>
                        <div className="flex-1">
                          <p className="font-medium">{activity.description}</p>
                          <p className="text-sm text-muted-foreground">
                            {new Date(activity.timestamp).toLocaleString()}
                          </p>
                        </div>
                        <Badge variant="outline">{activity.type}</Badge>
                      </div>
                    ))}
                    {dashboard.recentActivity.length === 0 && (
                      <p className="text-center text-muted-foreground py-8">No recent activity</p>
                    )}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Configuration Tab */}
            <TabsContent value="config">
              <Card>
                <CardHeader>
                  <CardTitle>Graph-RAG Configuration</CardTitle>
                  <CardDescription>Configure the knowledge graph and retrieval settings</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  {/* Feature Toggles */}
                  <div className="space-y-4">
                    <h4 className="font-medium">Features</h4>
                    <div className="grid gap-4 md:grid-cols-2">
                      <div className="flex items-center justify-between p-4 border rounded-lg">
                        <div>
                          <Label>Graph-RAG</Label>
                          <p className="text-sm text-muted-foreground">Enable knowledge graph retrieval</p>
                        </div>
                        <Switch
                          checked={dashboard.config.enableGraphRag}
                          onCheckedChange={(v) => updateConfigMutation.mutate({ enableGraphRag: v })}
                        />
                      </div>
                      <div className="flex items-center justify-between p-4 border rounded-lg">
                        <div>
                          <Label>Entity Extraction</Label>
                          <p className="text-sm text-muted-foreground">Auto-extract entities from content</p>
                        </div>
                        <Switch
                          checked={dashboard.config.enableEntityExtraction}
                          onCheckedChange={(v) => updateConfigMutation.mutate({ enableEntityExtraction: v })}
                        />
                      </div>
                      <div className="flex items-center justify-between p-4 border rounded-lg">
                        <div>
                          <Label>Relationship Inference</Label>
                          <p className="text-sm text-muted-foreground">Auto-infer entity relationships</p>
                        </div>
                        <Switch
                          checked={dashboard.config.enableRelationshipInference}
                          onCheckedChange={(v) => updateConfigMutation.mutate({ enableRelationshipInference: v })}
                        />
                      </div>
                      <div className="flex items-center justify-between p-4 border rounded-lg">
                        <div>
                          <Label>Auto-Merge</Label>
                          <p className="text-sm text-muted-foreground">Merge duplicate entities automatically</p>
                        </div>
                        <Switch
                          checked={dashboard.config.enableAutoMerge}
                          onCheckedChange={(v) => updateConfigMutation.mutate({ enableAutoMerge: v })}
                        />
                      </div>
                    </div>
                  </div>

                  {/* Model Configuration */}
                  <div className="space-y-4">
                    <h4 className="font-medium">Models</h4>
                    <div className="grid gap-4 md:grid-cols-2">
                      <div className="space-y-2">
                        <Label>Embedding Model</Label>
                        <Input value={dashboard.config.embeddingModel} disabled />
                      </div>
                      <div className="space-y-2">
                        <Label>Entity Extraction Model</Label>
                        <Input value={dashboard.config.entityExtractionModel} disabled />
                      </div>
                    </div>
                  </div>

                  {/* Retrieval Settings */}
                  <div className="space-y-4">
                    <h4 className="font-medium">Retrieval Settings</h4>
                    <div className="grid gap-4 md:grid-cols-3">
                      <div className="space-y-2">
                        <Label>Max Results</Label>
                        <Input
                          type="number"
                          value={dashboard.config.defaultMaxResults}
                          onChange={(e) =>
                            updateConfigMutation.mutate({ defaultMaxResults: parseInt(e.target.value) })
                          }
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Max Depth</Label>
                        <Input
                          type="number"
                          value={dashboard.config.defaultMaxDepth}
                          onChange={(e) =>
                            updateConfigMutation.mutate({ defaultMaxDepth: parseInt(e.target.value) })
                          }
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Min Relevance Score</Label>
                        <Input
                          type="number"
                          step="0.1"
                          min="0"
                          max="1"
                          value={dashboard.config.minRelevanceScore}
                          onChange={(e) =>
                            updateConfigMutation.mutate({ minRelevanceScore: parseFloat(e.target.value) })
                          }
                        />
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </>
      ) : null}
    </div>
  );
}
