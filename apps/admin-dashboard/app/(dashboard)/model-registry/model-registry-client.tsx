'use client';

import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { RefreshCw, Play, Pause, Trash2, Plus, Search, Flame, Snowflake, Sun, Power, AlertCircle, CheckCircle, Clock, XCircle } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';

// Types
interface ModelVersion {
  id: string;
  modelId: string;
  family: string;
  version: string;
  displayName?: string;
  thermalState: 'hot' | 'warm' | 'cold' | 'off';
  downloadStatus: 'pending' | 'downloading' | 'completed' | 'failed';
  deploymentStatus: 'not_deployed' | 'deploying' | 'deployed' | 'failed';
  isActive: boolean;
  storageSizeBytes?: number;
  totalRequests: number;
  createdAt: string;
}

interface WatchlistItem {
  id: string;
  family: string;
  isEnabled: boolean;
  autoDownload: boolean;
  huggingfaceOrg?: string;
  lastCheckedAt?: string;
  versionsFound: number;
}

interface DeletionQueueItem {
  id: string;
  modelVersionId: string;
  modelId: string;
  family: string;
  version: string;
  status: 'pending' | 'blocked' | 'processing' | 'completed' | 'cancelled';
  queuedAt: string;
  reason?: string;
  activeSessionsCount: number;
}

interface DiscoveryJob {
  id: string;
  jobType: 'scheduled' | 'manual';
  status: 'pending' | 'running' | 'completed' | 'failed';
  startedAt?: string;
  completedAt?: string;
  modelsDiscovered: number;
  modelsAdded: number;
}

interface Dashboard {
  totalVersions: number;
  activeVersions: number;
  downloadedVersions: number;
  deployedVersions: number;
  thermalBreakdown: { hot: number; warm: number; cold: number; off: number };
  deletionQueueSummary: { pending: number; blocked: number; processing: number };
  totalStorageBytes: number;
}

const API_BASE = '/api/admin/model-registry';

export function ModelRegistryClient() {
  const [activeTab, setActiveTab] = useState('overview');
  const [dashboard, setDashboard] = useState<Dashboard | null>(null);
  const [versions, setVersions] = useState<ModelVersion[]>([]);
  const [watchlist, setWatchlist] = useState<WatchlistItem[]>([]);
  const [deletionQueue, setDeletionQueue] = useState<DeletionQueueItem[]>([]);
  const [discoveryJobs, setDiscoveryJobs] = useState<DiscoveryJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [familyFilter, setFamilyFilter] = useState<string>('');
  const [thermalFilter, setThermalFilter] = useState<string>('');
  const { toast } = useToast();

  const fetchDashboard = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/dashboard`);
      if (res.ok) setDashboard(await res.json());
    } catch (error) {
      console.error('Failed to fetch dashboard', error);
    }
  }, []);

  const fetchVersions = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (familyFilter) params.set('family', familyFilter);
      if (thermalFilter) params.set('thermalState', thermalFilter);
      const res = await fetch(`${API_BASE}/versions?${params}`);
      if (res.ok) {
        const data = await res.json();
        setVersions(data.versions || []);
      }
    } catch (error) {
      console.error('Failed to fetch versions', error);
    }
  }, [familyFilter, thermalFilter]);

  const fetchWatchlist = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/watchlist`);
      if (res.ok) {
        const data = await res.json();
        setWatchlist(data.items || []);
      }
    } catch (error) {
      console.error('Failed to fetch watchlist', error);
    }
  }, []);

  const fetchDeletionQueue = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/deletion-queue`);
      if (res.ok) {
        const data = await res.json();
        setDeletionQueue(data.items || []);
      }
    } catch (error) {
      console.error('Failed to fetch deletion queue', error);
    }
  }, []);

  const fetchDiscoveryJobs = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/discovery/jobs`);
      if (res.ok) {
        const data = await res.json();
        setDiscoveryJobs(data.jobs || []);
      }
    } catch (error) {
      console.error('Failed to fetch discovery jobs', error);
    }
  }, []);

  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      await Promise.all([
        fetchDashboard(),
        fetchVersions(),
        fetchWatchlist(),
        fetchDeletionQueue(),
        fetchDiscoveryJobs(),
      ]);
      setLoading(false);
    };
    loadData();
  }, [fetchDashboard, fetchVersions, fetchWatchlist, fetchDeletionQueue, fetchDiscoveryJobs]);

  const runDiscovery = async () => {
    try {
      const res = await fetch(`${API_BASE}/discovery/run`, { method: 'POST' });
      if (res.ok) {
        toast({ title: 'Discovery Started', description: 'Model discovery job has been started.' });
        fetchDiscoveryJobs();
      }
    } catch (error) {
      toast({ title: 'Error', description: 'Failed to start discovery', variant: 'destructive' });
    }
  };

  const setThermalState = async (id: string, state: string) => {
    try {
      const res = await fetch(`${API_BASE}/versions/${id}/thermal`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ thermalState: state }),
      });
      if (res.ok) {
        toast({ title: 'Thermal State Updated' });
        fetchVersions();
      }
    } catch (error) {
      toast({ title: 'Error', description: 'Failed to update thermal state', variant: 'destructive' });
    }
  };

  const queueForDeletion = async (modelVersionId: string, reason: string) => {
    try {
      const res = await fetch(`${API_BASE}/deletion-queue`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ modelVersionId, reason }),
      });
      if (res.ok) {
        toast({ title: 'Queued for Deletion' });
        fetchDeletionQueue();
        fetchVersions();
      }
    } catch (error) {
      toast({ title: 'Error', description: 'Failed to queue for deletion', variant: 'destructive' });
    }
  };

  const cancelDeletion = async (id: string) => {
    try {
      const res = await fetch(`${API_BASE}/deletion-queue/${id}/cancel`, { method: 'POST' });
      if (res.ok) {
        toast({ title: 'Deletion Cancelled' });
        fetchDeletionQueue();
        fetchVersions();
      }
    } catch (error) {
      toast({ title: 'Error', description: 'Failed to cancel deletion', variant: 'destructive' });
    }
  };

  const toggleWatchlist = async (family: string, enabled: boolean) => {
    try {
      const res = await fetch(`${API_BASE}/watchlist/${family}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isEnabled: enabled }),
      });
      if (res.ok) {
        toast({ title: enabled ? 'Watchlist Enabled' : 'Watchlist Disabled' });
        fetchWatchlist();
      }
    } catch (error) {
      toast({ title: 'Error', description: 'Failed to update watchlist', variant: 'destructive' });
    }
  };

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const ThermalIcon = ({ state }: { state: string }) => {
    switch (state) {
      case 'hot': return <Flame className="h-4 w-4 text-red-500" />;
      case 'warm': return <Sun className="h-4 w-4 text-orange-500" />;
      case 'cold': return <Snowflake className="h-4 w-4 text-blue-500" />;
      default: return <Power className="h-4 w-4 text-gray-500" />;
    }
  };

  const StatusBadge = ({ status }: { status: string }) => {
    const variants: Record<string, { variant: 'default' | 'secondary' | 'destructive' | 'outline'; icon: React.ReactNode }> = {
      completed: { variant: 'default', icon: <CheckCircle className="h-3 w-3 mr-1" /> },
      running: { variant: 'secondary', icon: <RefreshCw className="h-3 w-3 mr-1 animate-spin" /> },
      pending: { variant: 'outline', icon: <Clock className="h-3 w-3 mr-1" /> },
      blocked: { variant: 'destructive', icon: <AlertCircle className="h-3 w-3 mr-1" /> },
      failed: { variant: 'destructive', icon: <XCircle className="h-3 w-3 mr-1" /> },
      cancelled: { variant: 'outline', icon: <XCircle className="h-3 w-3 mr-1" /> },
    };
    const config = variants[status] || variants.pending;
    return (
      <Badge variant={config.variant} className="flex items-center">
        {config.icon}
        {status}
      </Badge>
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Model Registry</h1>
          <p className="text-muted-foreground">Manage model versions, discovery, and deletion queue</p>
        </div>
        <div className="flex gap-2">
          <Button onClick={runDiscovery} variant="outline">
            <Search className="h-4 w-4 mr-2" />
            Run Discovery
          </Button>
          <Button onClick={() => { fetchDashboard(); fetchVersions(); }} variant="outline">
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="versions">Versions</TabsTrigger>
          <TabsTrigger value="watchlist">Watchlist</TabsTrigger>
          <TabsTrigger value="deletion">Deletion Queue</TabsTrigger>
          <TabsTrigger value="discovery">Discovery Jobs</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          {dashboard && (
            <>
              <div className="grid gap-4 md:grid-cols-4">
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium">Total Versions</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{dashboard.totalVersions}</div>
                    <p className="text-xs text-muted-foreground">{dashboard.activeVersions} active</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium">Downloaded</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{dashboard.downloadedVersions}</div>
                    <p className="text-xs text-muted-foreground">{formatBytes(dashboard.totalStorageBytes)} total</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium">Deployed</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{dashboard.deployedVersions}</div>
                    <p className="text-xs text-muted-foreground">Ready to serve</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium">Deletion Queue</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{dashboard.deletionQueueSummary.pending}</div>
                    <p className="text-xs text-muted-foreground">{dashboard.deletionQueueSummary.blocked} blocked</p>
                  </CardContent>
                </Card>
              </div>

              <Card>
                <CardHeader>
                  <CardTitle>Thermal Distribution</CardTitle>
                  <CardDescription>Current thermal state of all model versions</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="flex gap-8">
                    <div className="flex items-center gap-2">
                      <Flame className="h-5 w-5 text-red-500" />
                      <span className="font-medium">{dashboard.thermalBreakdown.hot} Hot</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Sun className="h-5 w-5 text-orange-500" />
                      <span className="font-medium">{dashboard.thermalBreakdown.warm} Warm</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Snowflake className="h-5 w-5 text-blue-500" />
                      <span className="font-medium">{dashboard.thermalBreakdown.cold} Cold</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Power className="h-5 w-5 text-gray-500" />
                      <span className="font-medium">{dashboard.thermalBreakdown.off} Off</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </>
          )}
        </TabsContent>

        <TabsContent value="versions" className="space-y-4">
          <div className="flex gap-4">
            <Select value={familyFilter} onValueChange={setFamilyFilter}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="All Families" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">All Families</SelectItem>
                <SelectItem value="llama">Llama</SelectItem>
                <SelectItem value="qwen">Qwen</SelectItem>
                <SelectItem value="deepseek">DeepSeek</SelectItem>
                <SelectItem value="mistral">Mistral</SelectItem>
              </SelectContent>
            </Select>
            <Select value={thermalFilter} onValueChange={setThermalFilter}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="All Thermal States" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">All States</SelectItem>
                <SelectItem value="hot">Hot</SelectItem>
                <SelectItem value="warm">Warm</SelectItem>
                <SelectItem value="cold">Cold</SelectItem>
                <SelectItem value="off">Off</SelectItem>
              </SelectContent>
            </Select>
            <Button onClick={fetchVersions} variant="outline" size="icon">
              <RefreshCw className="h-4 w-4" />
            </Button>
          </div>

          <Card>
            <ScrollArea className="h-[600px]">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Model</TableHead>
                    <TableHead>Family</TableHead>
                    <TableHead>Version</TableHead>
                    <TableHead>Thermal</TableHead>
                    <TableHead>Download</TableHead>
                    <TableHead>Deployment</TableHead>
                    <TableHead>Storage</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {versions.map((v) => (
                    <TableRow key={v.id}>
                      <TableCell className="font-medium">{v.displayName || v.modelId}</TableCell>
                      <TableCell><Badge variant="outline">{v.family}</Badge></TableCell>
                      <TableCell>{v.version}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <ThermalIcon state={v.thermalState} />
                          {v.thermalState}
                        </div>
                      </TableCell>
                      <TableCell><StatusBadge status={v.downloadStatus} /></TableCell>
                      <TableCell><StatusBadge status={v.deploymentStatus} /></TableCell>
                      <TableCell>{v.storageSizeBytes ? formatBytes(v.storageSizeBytes) : '-'}</TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          <Select onValueChange={(s) => setThermalState(v.id, s)}>
                            <SelectTrigger className="w-[100px] h-8">
                              <SelectValue placeholder="Thermal" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="hot">Hot</SelectItem>
                              <SelectItem value="warm">Warm</SelectItem>
                              <SelectItem value="cold">Cold</SelectItem>
                              <SelectItem value="off">Off</SelectItem>
                            </SelectContent>
                          </Select>
                          <Button
                            size="sm"
                            variant="destructive"
                            onClick={() => queueForDeletion(v.id, 'Admin requested deletion')}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </ScrollArea>
          </Card>
        </TabsContent>

        <TabsContent value="watchlist" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Model Family Watchlist</CardTitle>
              <CardDescription>Families monitored for new versions on HuggingFace</CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Family</TableHead>
                    <TableHead>HuggingFace Org</TableHead>
                    <TableHead>Enabled</TableHead>
                    <TableHead>Auto Download</TableHead>
                    <TableHead>Versions Found</TableHead>
                    <TableHead>Last Checked</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {watchlist.map((w) => (
                    <TableRow key={w.id}>
                      <TableCell className="font-medium">{w.family}</TableCell>
                      <TableCell>{w.huggingfaceOrg || '-'}</TableCell>
                      <TableCell>
                        <Switch
                          checked={w.isEnabled}
                          onCheckedChange={(checked) => toggleWatchlist(w.family, checked)}
                        />
                      </TableCell>
                      <TableCell>
                        <Badge variant={w.autoDownload ? 'default' : 'outline'}>
                          {w.autoDownload ? 'Yes' : 'No'}
                        </Badge>
                      </TableCell>
                      <TableCell>{w.versionsFound}</TableCell>
                      <TableCell>
                        {w.lastCheckedAt ? new Date(w.lastCheckedAt).toLocaleString() : 'Never'}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="deletion" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Deletion Queue</CardTitle>
              <CardDescription>Models queued for deletion when not in use</CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Model</TableHead>
                    <TableHead>Family</TableHead>
                    <TableHead>Version</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Active Sessions</TableHead>
                    <TableHead>Queued At</TableHead>
                    <TableHead>Reason</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {deletionQueue.map((d) => (
                    <TableRow key={d.id}>
                      <TableCell className="font-medium">{d.modelId}</TableCell>
                      <TableCell><Badge variant="outline">{d.family}</Badge></TableCell>
                      <TableCell>{d.version}</TableCell>
                      <TableCell><StatusBadge status={d.status} /></TableCell>
                      <TableCell>
                        {d.activeSessionsCount > 0 ? (
                          <Badge variant="destructive">{d.activeSessionsCount}</Badge>
                        ) : (
                          <Badge variant="outline">0</Badge>
                        )}
                      </TableCell>
                      <TableCell>{new Date(d.queuedAt).toLocaleString()}</TableCell>
                      <TableCell className="max-w-[200px] truncate">{d.reason || '-'}</TableCell>
                      <TableCell>
                        {d.status !== 'completed' && d.status !== 'cancelled' && (
                          <Button size="sm" variant="outline" onClick={() => cancelDeletion(d.id)}>
                            Cancel
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="discovery" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Discovery Jobs</CardTitle>
              <CardDescription>History of model discovery runs</CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Job ID</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Started</TableHead>
                    <TableHead>Completed</TableHead>
                    <TableHead>Models Discovered</TableHead>
                    <TableHead>Models Added</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {discoveryJobs.map((j) => (
                    <TableRow key={j.id}>
                      <TableCell className="font-mono text-sm">{j.id.slice(0, 8)}...</TableCell>
                      <TableCell>
                        <Badge variant={j.jobType === 'manual' ? 'default' : 'secondary'}>
                          {j.jobType}
                        </Badge>
                      </TableCell>
                      <TableCell><StatusBadge status={j.status} /></TableCell>
                      <TableCell>{j.startedAt ? new Date(j.startedAt).toLocaleString() : '-'}</TableCell>
                      <TableCell>{j.completedAt ? new Date(j.completedAt).toLocaleString() : '-'}</TableCell>
                      <TableCell>{j.modelsDiscovered}</TableCell>
                      <TableCell>{j.modelsAdded}</TableCell>
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
