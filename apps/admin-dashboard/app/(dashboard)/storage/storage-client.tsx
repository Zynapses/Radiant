'use client';

import { useState } from 'react';
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query';
import { 
  HardDrive, 
  Database, 
  Cloud, 
  Archive,
  RefreshCw,
  AlertTriangle,
  TrendingUp,
  Settings,
  Trash2,
  FileText,
  Brain,
  MessageSquare,
  BookOpen,
  Zap,
  CheckCircle2,
  XCircle,
  Save
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from '@/components/ui/table';
import { Switch } from '@/components/ui/switch';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { useToast } from '@/components/ui/use-toast';
import { apiClient } from '@/lib/api';

interface StorageUsage {
  storageType: string;
  bytesUsed: number;
  bytesQuota: number | null;
  pricePerGbCents: number;
  includedGb: number;
  totalCostCents: number;
  isOverQuota: boolean;
}

interface StorageEvent {
  id: string;
  event_type: string;
  storage_type: string;
  bytes_delta: number;
  resource_id: string;
  created_at: string;
}

interface S3OffloadingStats {
  total_objects: number;
  total_size_bytes: number;
  total_size_mb: number;
  total_size_gb: number;
  by_table: Record<string, {
    count: number;
    size_bytes: number;
    size_mb: number;
    compressed_count: number;
    avg_size_bytes: number;
  }>;
  pending_deletion: number;
  orphan_queue: {
    pending: number;
    processing: number;
    completed_today: number;
    failed: number;
  };
  dedup_savings: {
    unique_hashes: number;
    total_references: number;
    savings_percent: number;
  };
}

interface S3OffloadingConfig {
  id?: string;
  tenant_id: string;
  offloading_enabled: boolean;
  auto_offload_on_insert: boolean;
  auto_offload_threshold_bytes: number;
  offload_messages: boolean;
  offload_memories: boolean;
  offload_episodes: boolean;
  offload_training_data: boolean;
  compression_enabled: boolean;
  compression_algorithm: string;
  compression_threshold_bytes: number;
  orphan_grace_period_hours: number;
  auto_cleanup_enabled: boolean;
  content_bucket: string;
  content_prefix: string;
}

interface S3DashboardData {
  stats: S3OffloadingStats;
  config: S3OffloadingConfig | null;
  tables: Array<{ name: string; display: string; description: string }>;
}

const TABLE_ICONS: Record<string, React.ElementType> = {
  thinktank_messages: MessageSquare,
  memories: BookOpen,
  learning_episodes: Brain,
  rejected_prompt_archive: FileText,
  shadow_learning_log: Zap,
};

export function StorageClient() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [configForm, setConfigForm] = useState<S3OffloadingConfig | null>(null);

  const { data: usage, isLoading: _isLoading } = useQuery<StorageUsage[]>({
    queryKey: ['storage', 'usage'],
    queryFn: async () => {
      const res = await apiClient.get<{ usage: StorageUsage[] }>('/storage/usage');
      return res.usage;
    },
  });

  const { data: events } = useQuery<StorageEvent[]>({
    queryKey: ['storage', 'events'],
    queryFn: async () => {
      const res = await apiClient.get<{ events: StorageEvent[] }>('/storage/events');
      return res.events;
    },
  });

  const { data: s3Dashboard, isLoading: _s3Loading } = useQuery<S3DashboardData>({
    queryKey: ['storage', 's3-dashboard'],
    queryFn: async () => {
      const res = await apiClient.get<S3DashboardData>('/admin/s3-storage/dashboard');
      return res;
    },
  });

  const updateConfigMutation = useMutation({
    mutationFn: async (config: S3OffloadingConfig) => {
      await apiClient.put('/admin/s3-storage/config', config);
    },
    onSuccess: () => {
      toast({ title: 'Configuration saved', description: 'S3 offloading settings updated successfully.' });
      queryClient.invalidateQueries({ queryKey: ['storage', 's3-dashboard'] });
    },
    onError: () => {
      toast({ title: 'Error', description: 'Failed to save configuration.', variant: 'destructive' });
    },
  });

  const triggerCleanupMutation = useMutation({
    mutationFn: async () => {
      const res = await apiClient.post<{ deleted: number; failed: number }>('/admin/s3-storage/trigger-cleanup', {});
      return res;
    },
    onSuccess: (data) => {
      toast({ 
        title: 'Cleanup complete', 
        description: `Deleted ${data.deleted} orphans. ${data.failed > 0 ? `${data.failed} failed.` : ''}` 
      });
      queryClient.invalidateQueries({ queryKey: ['storage', 's3-dashboard'] });
    },
    onError: () => {
      toast({ title: 'Error', description: 'Failed to trigger cleanup.', variant: 'destructive' });
    },
  });

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const formatCurrency = (cents: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(cents / 100);
  };

  const getStorageIcon = (type: string) => {
    switch (type) {
      case 's3': return Cloud;
      case 'database': return Database;
      case 'backup': return Archive;
      default: return HardDrive;
    }
  };

  const getUsagePercent = (item: StorageUsage) => {
    if (!item.bytesQuota) return 0;
    return Math.min((item.bytesUsed / item.bytesQuota) * 100, 100);
  };

  const totalCost = usage?.reduce((sum, u) => sum + u.totalCostCents, 0) ?? 0;
  const totalUsed = usage?.reduce((sum, u) => sum + u.bytesUsed, 0) ?? 0;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Storage</h1>
          <p className="text-muted-foreground">
            Monitor storage usage and costs
          </p>
        </div>
        <Button variant="outline" onClick={() => queryClient.invalidateQueries({ queryKey: ['storage'] })}>
          <RefreshCw className="mr-2 h-4 w-4" />
          Refresh
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Usage</CardTitle>
            <HardDrive className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatBytes(totalUsed)}</div>
            <p className="text-xs text-muted-foreground">Across all storage types</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Monthly Cost</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(totalCost)}</div>
            <p className="text-xs text-muted-foreground">Current billing period</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Alerts</CardTitle>
            <AlertTriangle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {usage?.filter(u => u.isOverQuota).length ?? 0}
            </div>
            <p className="text-xs text-muted-foreground">Over quota warnings</p>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="usage">
        <TabsList>
          <TabsTrigger value="usage">Usage</TabsTrigger>
          <TabsTrigger value="s3-offloading">S3 Offloading</TabsTrigger>
          <TabsTrigger value="events">Events</TabsTrigger>
        </TabsList>

        <TabsContent value="usage" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            {usage?.map((item) => {
              const Icon = getStorageIcon(item.storageType);
              const usagePercent = getUsagePercent(item);
              
              return (
                <Card key={item.storageType}>
                  <CardHeader>
                    <CardTitle className="flex items-center justify-between">
                      <span className="flex items-center gap-2">
                        <Icon className="h-5 w-5" />
                        {item.storageType.toUpperCase()}
                      </span>
                      {item.isOverQuota && (
                        <Badge variant="destructive">Over Quota</Badge>
                      )}
                    </CardTitle>
                    <CardDescription>
                      {formatCurrency(item.pricePerGbCents)} per GB • {item.includedGb} GB included
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="space-y-2">
                      <div className="flex justify-between text-sm">
                        <span>{formatBytes(item.bytesUsed)}</span>
                        <span>{item.bytesQuota ? formatBytes(item.bytesQuota) : 'Unlimited'}</span>
                      </div>
                      <Progress 
                        value={usagePercent} 
                        className={item.isOverQuota ? 'bg-red-200' : ''}
                      />
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Cost this period</span>
                      <span className="font-medium">{formatCurrency(item.totalCostCents)}</span>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </TabsContent>

        <TabsContent value="s3-offloading" className="space-y-6">
          {/* S3 Stats Overview */}
          <div className="grid gap-4 md:grid-cols-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">S3 Objects</CardTitle>
                <Cloud className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{s3Dashboard?.stats.total_objects.toLocaleString() ?? 0}</div>
                <p className="text-xs text-muted-foreground">
                  {s3Dashboard?.stats.total_size_gb.toFixed(2) ?? 0} GB total
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Dedup Savings</CardTitle>
                <Zap className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-green-600">
                  {s3Dashboard?.stats.dedup_savings.savings_percent.toFixed(1) ?? 0}%
                </div>
                <p className="text-xs text-muted-foreground">
                  {s3Dashboard?.stats.dedup_savings.unique_hashes ?? 0} unique / {s3Dashboard?.stats.dedup_savings.total_references ?? 0} refs
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Orphan Queue</CardTitle>
                <Trash2 className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{s3Dashboard?.stats.orphan_queue.pending ?? 0}</div>
                <p className="text-xs text-muted-foreground">
                  {s3Dashboard?.stats.orphan_queue.completed_today ?? 0} cleaned today
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Cleanup Status</CardTitle>
                {(s3Dashboard?.stats.orphan_queue.failed ?? 0) > 0 ? (
                  <XCircle className="h-4 w-4 text-red-500" />
                ) : (
                  <CheckCircle2 className="h-4 w-4 text-green-500" />
                )}
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-2">
                  <Button 
                    size="sm" 
                    variant="outline"
                    onClick={() => triggerCleanupMutation.mutate()}
                    disabled={triggerCleanupMutation.isPending}
                  >
                    {triggerCleanupMutation.isPending ? 'Running...' : 'Run Cleanup'}
                  </Button>
                </div>
                {(s3Dashboard?.stats.orphan_queue.failed ?? 0) > 0 && (
                  <p className="text-xs text-red-500 mt-1">
                    {s3Dashboard?.stats.orphan_queue.failed} failed
                  </p>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Storage by Category */}
          <Card>
            <CardHeader>
              <CardTitle>Storage by Category</CardTitle>
              <CardDescription>S3 storage usage broken down by content type</CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Category</TableHead>
                    <TableHead>Description</TableHead>
                    <TableHead className="text-right">Objects</TableHead>
                    <TableHead className="text-right">Size</TableHead>
                    <TableHead className="text-right">Compressed</TableHead>
                    <TableHead className="text-right">Avg Size</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {s3Dashboard?.tables.map((table) => {
                    const stats = s3Dashboard.stats.by_table[table.name];
                    const Icon = TABLE_ICONS[table.name] || FileText;
                    
                    return (
                      <TableRow key={table.name}>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Icon className="h-4 w-4 text-muted-foreground" />
                            <span className="font-medium">{table.display}</span>
                          </div>
                        </TableCell>
                        <TableCell className="text-muted-foreground">{table.description}</TableCell>
                        <TableCell className="text-right">{stats?.count.toLocaleString() ?? 0}</TableCell>
                        <TableCell className="text-right">{formatBytes(stats?.size_bytes ?? 0)}</TableCell>
                        <TableCell className="text-right">
                          {stats?.count ? `${((stats.compressed_count / stats.count) * 100).toFixed(0)}%` : '0%'}
                        </TableCell>
                        <TableCell className="text-right">{formatBytes(stats?.avg_size_bytes ?? 0)}</TableCell>
                      </TableRow>
                    );
                  })}
                  {(!s3Dashboard?.tables || s3Dashboard.tables.length === 0) && (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center text-muted-foreground">
                        No offloaded content yet
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          {/* Configuration */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Settings className="h-5 w-5" />
                Offloading Configuration
              </CardTitle>
              <CardDescription>Configure S3 content offloading settings</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {s3Dashboard?.config && (
                <>
                  <div className="grid gap-6 md:grid-cols-2">
                    {/* Feature Toggles */}
                    <div className="space-y-4">
                      <h4 className="font-medium">Feature Toggles</h4>
                      
                      <div className="flex items-center justify-between">
                        <Label htmlFor="offloading_enabled">Offloading Enabled</Label>
                        <Switch
                          id="offloading_enabled"
                          checked={configForm?.offloading_enabled ?? s3Dashboard.config.offloading_enabled}
                          onCheckedChange={(checked) => setConfigForm(prev => ({
                            ...(prev ?? s3Dashboard.config!),
                            offloading_enabled: checked,
                          }))}
                        />
                      </div>

                      <div className="flex items-center justify-between">
                        <Label htmlFor="compression_enabled">Compression Enabled</Label>
                        <Switch
                          id="compression_enabled"
                          checked={configForm?.compression_enabled ?? s3Dashboard.config.compression_enabled}
                          onCheckedChange={(checked) => setConfigForm(prev => ({
                            ...(prev ?? s3Dashboard.config!),
                            compression_enabled: checked,
                          }))}
                        />
                      </div>

                      <div className="flex items-center justify-between">
                        <Label htmlFor="auto_cleanup_enabled">Auto Cleanup</Label>
                        <Switch
                          id="auto_cleanup_enabled"
                          checked={configForm?.auto_cleanup_enabled ?? s3Dashboard.config.auto_cleanup_enabled}
                          onCheckedChange={(checked) => setConfigForm(prev => ({
                            ...(prev ?? s3Dashboard.config!),
                            auto_cleanup_enabled: checked,
                          }))}
                        />
                      </div>
                    </div>

                    {/* Content Type Toggles */}
                    <div className="space-y-4">
                      <h4 className="font-medium">Content Types</h4>
                      
                      <div className="flex items-center justify-between">
                        <Label htmlFor="offload_messages">Offload Messages</Label>
                        <Switch
                          id="offload_messages"
                          checked={configForm?.offload_messages ?? s3Dashboard.config.offload_messages}
                          onCheckedChange={(checked) => setConfigForm(prev => ({
                            ...(prev ?? s3Dashboard.config!),
                            offload_messages: checked,
                          }))}
                        />
                      </div>

                      <div className="flex items-center justify-between">
                        <Label htmlFor="offload_memories">Offload Memories</Label>
                        <Switch
                          id="offload_memories"
                          checked={configForm?.offload_memories ?? s3Dashboard.config.offload_memories}
                          onCheckedChange={(checked) => setConfigForm(prev => ({
                            ...(prev ?? s3Dashboard.config!),
                            offload_memories: checked,
                          }))}
                        />
                      </div>

                      <div className="flex items-center justify-between">
                        <Label htmlFor="offload_episodes">Offload Episodes</Label>
                        <Switch
                          id="offload_episodes"
                          checked={configForm?.offload_episodes ?? s3Dashboard.config.offload_episodes}
                          onCheckedChange={(checked) => setConfigForm(prev => ({
                            ...(prev ?? s3Dashboard.config!),
                            offload_episodes: checked,
                          }))}
                        />
                      </div>

                      <div className="flex items-center justify-between">
                        <Label htmlFor="offload_training_data">Offload Training Data</Label>
                        <Switch
                          id="offload_training_data"
                          checked={configForm?.offload_training_data ?? s3Dashboard.config.offload_training_data}
                          onCheckedChange={(checked) => setConfigForm(prev => ({
                            ...(prev ?? s3Dashboard.config!),
                            offload_training_data: checked,
                          }))}
                        />
                      </div>
                    </div>
                  </div>

                  <Separator />

                  <div className="grid gap-6 md:grid-cols-3">
                    {/* Thresholds */}
                    <div className="space-y-2">
                      <Label htmlFor="threshold">Offload Threshold (bytes)</Label>
                      <Input
                        id="threshold"
                        type="number"
                        value={configForm?.auto_offload_threshold_bytes ?? s3Dashboard.config.auto_offload_threshold_bytes}
                        onChange={(e) => setConfigForm(prev => ({
                          ...(prev ?? s3Dashboard.config!),
                          auto_offload_threshold_bytes: parseInt(e.target.value, 10),
                        }))}
                      />
                      <p className="text-xs text-muted-foreground">Content larger than this is offloaded</p>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="compression_threshold">Compression Threshold (bytes)</Label>
                      <Input
                        id="compression_threshold"
                        type="number"
                        value={configForm?.compression_threshold_bytes ?? s3Dashboard.config.compression_threshold_bytes}
                        onChange={(e) => setConfigForm(prev => ({
                          ...(prev ?? s3Dashboard.config!),
                          compression_threshold_bytes: parseInt(e.target.value, 10),
                        }))}
                      />
                      <p className="text-xs text-muted-foreground">Compress if larger than this</p>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="grace_period">Orphan Grace Period (hours)</Label>
                      <Input
                        id="grace_period"
                        type="number"
                        value={configForm?.orphan_grace_period_hours ?? s3Dashboard.config.orphan_grace_period_hours}
                        onChange={(e) => setConfigForm(prev => ({
                          ...(prev ?? s3Dashboard.config!),
                          orphan_grace_period_hours: parseInt(e.target.value, 10),
                        }))}
                      />
                      <p className="text-xs text-muted-foreground">Wait before deleting orphans</p>
                    </div>
                  </div>

                  <div className="grid gap-6 md:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="compression_algorithm">Compression Algorithm</Label>
                      <Select
                        value={configForm?.compression_algorithm ?? s3Dashboard.config.compression_algorithm}
                        onValueChange={(value) => setConfigForm(prev => ({
                          ...(prev ?? s3Dashboard.config!),
                          compression_algorithm: value,
                        }))}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="gzip">gzip</SelectItem>
                          <SelectItem value="lz4">lz4</SelectItem>
                          <SelectItem value="none">none</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="content_bucket">S3 Bucket</Label>
                      <Input
                        id="content_bucket"
                        value={configForm?.content_bucket ?? s3Dashboard.config.content_bucket}
                        onChange={(e) => setConfigForm(prev => ({
                          ...(prev ?? s3Dashboard.config!),
                          content_bucket: e.target.value,
                        }))}
                      />
                    </div>
                  </div>

                  <div className="flex justify-end">
                    <Button
                      onClick={() => {
                        if (configForm) {
                          updateConfigMutation.mutate(configForm);
                        }
                      }}
                      disabled={!configForm || updateConfigMutation.isPending}
                    >
                      <Save className="mr-2 h-4 w-4" />
                      {updateConfigMutation.isPending ? 'Saving...' : 'Save Configuration'}
                    </Button>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="events" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Recent Storage Events</CardTitle>
              <CardDescription>Upload, delete, and quota events</CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Storage</TableHead>
                    <TableHead>Resource</TableHead>
                    <TableHead className="text-right">Change</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {events?.map((event) => (
                    <TableRow key={event.id}>
                      <TableCell>{new Date(event.created_at).toLocaleString()}</TableCell>
                      <TableCell>
                        <Badge variant={event.event_type === 'upload' ? 'default' : 'secondary'}>
                          {event.event_type}
                        </Badge>
                      </TableCell>
                      <TableCell>{event.storage_type}</TableCell>
                      <TableCell className="font-mono text-xs">
                        {event.resource_id || '-'}
                      </TableCell>
                      <TableCell className="text-right">
                        <span className={event.bytes_delta >= 0 ? 'text-green-600' : 'text-red-600'}>
                          {event.bytes_delta >= 0 ? '+' : ''}{formatBytes(Math.abs(event.bytes_delta))}
                        </span>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
