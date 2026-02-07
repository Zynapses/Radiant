'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';
import { Separator } from '@/components/ui/separator';
import {
  Camera,
  Clock,
  Database,
  Download,
  HardDrive,
  Key,
  Loader2,
  Play,
  RefreshCw,
  Settings,
  Shield,
  Trash2,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Calendar,
  CloudOff,
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

interface AWSSnapshot {
  id: string;
  environment: string;
  createdAt: string;
  completedAt?: string;
  expiresAt: string;
  type: 'scheduled' | 'manual' | 'pre-deployment' | 'pre-sync';
  trigger: 'automatic' | 'user' | 'system';
  triggeredBy?: string;
  status: 'pending' | 'in_progress' | 'completed' | 'failed' | 'expired' | 'deleted';
  progress: {
    phase: string;
    percentComplete: number;
  };
  components: {
    type: string;
    name: string;
    status: string;
    sizeBytes: number;
  }[];
  totalSizeBytes: number;
  estimatedMonthlyCostUSD: number;
  restoreCount: number;
  errors: { code: string; message: string }[];
}

interface SnapshotConfig {
  enabled: boolean;
  scheduleType: 'interval' | 'cron';
  intervalHours: number;
  cronExpression?: string;
  timezone: string;
  snapshotRDS: boolean;
  snapshotS3: boolean;
  snapshotSecrets: boolean;
  snapshotDynamoDB: boolean;
  retentionDays: number;
  storageClass: string;
  crossRegionReplication: boolean;
  replicationRegion?: string;
  notifyOnSuccess: boolean;
  notifyOnFailure: boolean;
  notificationChannels: string[];
}

const DEFAULT_CONFIG: SnapshotConfig = {
  enabled: true,
  scheduleType: 'cron',
  intervalHours: 24,
  cronExpression: '0 10 * * *',
  timezone: 'America/Los_Angeles',
  snapshotRDS: true,
  snapshotS3: true,
  snapshotSecrets: true,
  snapshotDynamoDB: true,
  retentionDays: 30,
  storageClass: 'STANDARD',
  crossRegionReplication: false,
  notifyOnSuccess: false,
  notifyOnFailure: true,
  notificationChannels: ['email'],
};

export function SnapshotsClient() {
  const [snapshots, setSnapshots] = useState<AWSSnapshot[]>([]);
  const [config, setConfig] = useState<SnapshotConfig>(DEFAULT_CONFIG);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [restoring, setRestoring] = useState<string | null>(null);
  const [selectedSnapshot, setSelectedSnapshot] = useState<AWSSnapshot | null>(null);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [createDescription, setCreateDescription] = useState('');

  const fetchSnapshots = useCallback(async () => {
    try {
      const response = await fetch('/api/admin/snapshots');
      if (response.ok) {
        const data = await response.json();
        setSnapshots(data.snapshots || []);
      }
    } catch (error) {
      console.error('Failed to fetch snapshots:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchConfig = useCallback(async () => {
    try {
      const response = await fetch('/api/admin/snapshots/config');
      if (response.ok) {
        const data = await response.json();
        setConfig(data.config || DEFAULT_CONFIG);
      }
    } catch (error) {
      console.error('Failed to fetch config:', error);
    }
  }, []);

  useEffect(() => {
    fetchSnapshots();
    fetchConfig();
  }, [fetchSnapshots, fetchConfig]);

  const createSnapshot = async () => {
    setCreating(true);
    try {
      const response = await fetch('/api/admin/snapshots', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          description: createDescription || `Manual snapshot - ${new Date().toLocaleString()}`,
          createdBy: 'admin:dashboard',
        }),
      });
      if (response.ok) {
        setShowCreateDialog(false);
        setCreateDescription('');
        fetchSnapshots();
      }
    } catch (error) {
      console.error('Failed to create snapshot:', error);
    } finally {
      setCreating(false);
    }
  };

  const restoreSnapshot = async (snapshotId: string) => {
    setRestoring(snapshotId);
    try {
      const response = await fetch(`/api/admin/snapshots/${snapshotId}/restore`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          createNewCluster: true,
          newClusterSuffix: '-restored',
          validateBeforeRestore: true,
          restoredBy: 'admin:dashboard',
        }),
      });
      if (response.ok) {
        fetchSnapshots();
      }
    } catch (error) {
      console.error('Failed to restore snapshot:', error);
    } finally {
      setRestoring(null);
    }
  };

  const deleteSnapshot = async (snapshotId: string) => {
    try {
      const response = await fetch(`/api/admin/snapshots/${snapshotId}`, {
        method: 'DELETE',
      });
      if (response.ok) {
        fetchSnapshots();
      }
    } catch (error) {
      console.error('Failed to delete snapshot:', error);
    }
  };

  const saveConfig = async () => {
    try {
      const response = await fetch('/api/admin/snapshots/config', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(config),
      });
      if (response.ok) {
        fetchConfig();
      }
    } catch (error) {
      console.error('Failed to save config:', error);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'completed':
        return <Badge className="bg-green-500"><CheckCircle2 className="w-3 h-3 mr-1" />Completed</Badge>;
      case 'in_progress':
        return <Badge className="bg-blue-500"><Loader2 className="w-3 h-3 mr-1 animate-spin" />In Progress</Badge>;
      case 'failed':
        return <Badge variant="destructive"><XCircle className="w-3 h-3 mr-1" />Failed</Badge>;
      case 'expired':
        return <Badge variant="secondary"><Clock className="w-3 h-3 mr-1" />Expired</Badge>;
      case 'pending':
        return <Badge variant="outline"><Clock className="w-3 h-3 mr-1" />Pending</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">AWS Snapshots</h1>
          <p className="text-muted-foreground">
            Automated infrastructure snapshots for disaster recovery
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={fetchSnapshots}>
            <RefreshCw className="w-4 h-4 mr-2" />
            Refresh
          </Button>
          <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
            <DialogTrigger asChild>
              <Button>
                <Camera className="w-4 h-4 mr-2" />
                Create Snapshot
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Create Manual Snapshot</DialogTitle>
                <DialogDescription>
                  Create a point-in-time snapshot of all AWS infrastructure. This includes RDS, S3, Secrets, and DynamoDB.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label>Description (optional)</Label>
                  <Input
                    placeholder="Pre-deployment backup..."
                    value={createDescription}
                    onChange={(e) => setCreateDescription(e.target.value)}
                  />
                </div>
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <AlertTriangle className="w-4 h-4" />
                  <span>Snapshots do NOT cause downtime for users</span>
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setShowCreateDialog(false)}>
                  Cancel
                </Button>
                <Button onClick={createSnapshot} disabled={creating}>
                  {creating && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                  Create Snapshot
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <Tabs defaultValue="snapshots">
        <TabsList>
          <TabsTrigger value="snapshots">Snapshots</TabsTrigger>
          <TabsTrigger value="configuration">Configuration</TabsTrigger>
        </TabsList>

        <TabsContent value="snapshots" className="space-y-4">
          {/* Summary Cards */}
          <div className="grid gap-4 md:grid-cols-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Snapshots</CardTitle>
                <Camera className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{snapshots.length}</div>
                <p className="text-xs text-muted-foreground">
                  {snapshots.filter(s => s.status === 'completed').length} completed
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Size</CardTitle>
                <HardDrive className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {formatBytes(snapshots.reduce((sum, s) => sum + s.totalSizeBytes, 0))}
                </div>
                <p className="text-xs text-muted-foreground">Across all snapshots</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Est. Monthly Cost</CardTitle>
                <Shield className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  ${snapshots.reduce((sum, s) => sum + s.estimatedMonthlyCostUSD, 0).toFixed(2)}
                </div>
                <p className="text-xs text-muted-foreground">For storage</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Next Scheduled</CardTitle>
                <Calendar className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">2:00 AM</div>
                <p className="text-xs text-muted-foreground">Pacific Time (daily)</p>
              </CardContent>
            </Card>
          </div>

          {/* Snapshots Table */}
          <Card>
            <CardHeader>
              <CardTitle>Snapshot History</CardTitle>
              <CardDescription>
                All AWS infrastructure snapshots with restore options
              </CardDescription>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
                </div>
              ) : snapshots.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
                  <CloudOff className="w-12 h-12 mb-4" />
                  <p>No snapshots found</p>
                  <p className="text-sm">Create your first snapshot to enable disaster recovery</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>ID</TableHead>
                      <TableHead>Created</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Components</TableHead>
                      <TableHead>Size</TableHead>
                      <TableHead>Expires</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {snapshots.map((snapshot) => (
                      <TableRow key={snapshot.id}>
                        <TableCell className="font-mono text-xs">
                          {snapshot.id.slice(0, 16)}...
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-col">
                            <span>{new Date(snapshot.createdAt).toLocaleDateString()}</span>
                            <span className="text-xs text-muted-foreground">
                              {formatDistanceToNow(new Date(snapshot.createdAt), { addSuffix: true })}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">{snapshot.type}</Badge>
                        </TableCell>
                        <TableCell>{getStatusBadge(snapshot.status)}</TableCell>
                        <TableCell>
                          <div className="flex gap-1">
                            {snapshot.components.some(c => c.type === 'rds_cluster') && (
                              <span title="RDS"><Database className="w-4 h-4 text-blue-500" /></span>
                            )}
                            {snapshot.components.some(c => c.type === 's3_bucket') && (
                              <span title="S3"><HardDrive className="w-4 h-4 text-green-500" /></span>
                            )}
                            {snapshot.components.some(c => c.type === 'secret') && (
                              <span title="Secrets"><Key className="w-4 h-4 text-yellow-500" /></span>
                            )}
                            {snapshot.components.some(c => c.type === 'dynamodb_table') && (
                              <span title="DynamoDB"><Database className="w-4 h-4 text-orange-500" /></span>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>{formatBytes(snapshot.totalSizeBytes)}</TableCell>
                        <TableCell>
                          <span className="text-xs text-muted-foreground">
                            {new Date(snapshot.expiresAt).toLocaleDateString()}
                          </span>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex gap-1 justify-end">
                            {snapshot.status === 'completed' && (
                              <AlertDialog>
                                <AlertDialogTrigger asChild>
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    disabled={restoring === snapshot.id}
                                  >
                                    {restoring === snapshot.id ? (
                                      <Loader2 className="w-4 h-4 animate-spin" />
                                    ) : (
                                      <Download className="w-4 h-4" />
                                    )}
                                  </Button>
                                </AlertDialogTrigger>
                                <AlertDialogContent>
                                  <AlertDialogHeader>
                                    <AlertDialogTitle>Restore Snapshot?</AlertDialogTitle>
                                    <AlertDialogDescription>
                                      This will create a new RDS cluster from the snapshot. The restore process takes approximately 5-15 minutes. Your current data will NOT be affected.
                                    </AlertDialogDescription>
                                  </AlertDialogHeader>
                                  <AlertDialogFooter>
                                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                                    <AlertDialogAction onClick={() => restoreSnapshot(snapshot.id)}>
                                      Restore
                                    </AlertDialogAction>
                                  </AlertDialogFooter>
                                </AlertDialogContent>
                              </AlertDialog>
                            )}
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <Button variant="outline" size="sm">
                                  <Trash2 className="w-4 h-4 text-red-500" />
                                </Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle>Delete Snapshot?</AlertDialogTitle>
                                  <AlertDialogDescription>
                                    This will permanently delete the snapshot and all associated AWS resources. This action cannot be undone.
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                                  <AlertDialogAction
                                    className="bg-red-500 hover:bg-red-600"
                                    onClick={() => deleteSnapshot(snapshot.id)}
                                  >
                                    Delete
                                  </AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="configuration" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Settings className="w-5 h-5" />
                Snapshot Schedule
              </CardTitle>
              <CardDescription>
                Configure automated snapshot schedule and retention
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Enable/Disable */}
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Enable Automated Snapshots</Label>
                  <p className="text-sm text-muted-foreground">
                    Automatically create snapshots on the configured schedule
                  </p>
                </div>
                <Switch
                  checked={config.enabled}
                  onCheckedChange={(checked) => setConfig({ ...config, enabled: checked })}
                />
              </div>

              <Separator />

              {/* Schedule */}
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label>Schedule Type</Label>
                  <Select
                    value={config.scheduleType}
                    onValueChange={(value) => setConfig({ ...config, scheduleType: value as 'interval' | 'cron' })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="interval">Interval (every N hours)</SelectItem>
                      <SelectItem value="cron">Cron Expression (specific time)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {config.scheduleType === 'interval' ? (
                  <div className="space-y-2">
                    <Label>Interval (hours)</Label>
                    <Input
                      type="number"
                      min={1}
                      max={168}
                      value={config.intervalHours}
                      onChange={(e) => setConfig({ ...config, intervalHours: parseInt(e.target.value) })}
                    />
                  </div>
                ) : (
                  <div className="space-y-2">
                    <Label>Time (24-hour format)</Label>
                    <Input
                      placeholder="02:00"
                      value={config.cronExpression?.split(' ')[1] ? `${config.cronExpression.split(' ')[1].padStart(2, '0')}:00` : '02:00'}
                      onChange={(e) => {
                        const [hour] = e.target.value.split(':');
                        setConfig({ ...config, cronExpression: `0 ${parseInt(hour)} * * *` });
                      }}
                    />
                    <p className="text-xs text-muted-foreground">
                      Snapshot will run daily at this time (Pacific Time)
                    </p>
                  </div>
                )}
              </div>

              <Separator />

              {/* Retention */}
              <div className="space-y-2">
                <Label>Retention Period (days)</Label>
                <Input
                  type="number"
                  min={1}
                  max={365}
                  value={config.retentionDays}
                  onChange={(e) => setConfig({ ...config, retentionDays: parseInt(e.target.value) })}
                />
                <p className="text-sm text-muted-foreground">
                  Snapshots older than {config.retentionDays} days will be automatically deleted
                </p>
              </div>

              <Separator />

              {/* Components */}
              <div className="space-y-4">
                <Label>Components to Snapshot</Label>
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="flex items-center justify-between p-3 border rounded-lg">
                    <div className="flex items-center gap-2">
                      <Database className="w-4 h-4 text-blue-500" />
                      <span>Aurora PostgreSQL (RDS)</span>
                    </div>
                    <Switch
                      checked={config.snapshotRDS}
                      onCheckedChange={(checked) => setConfig({ ...config, snapshotRDS: checked })}
                    />
                  </div>
                  <div className="flex items-center justify-between p-3 border rounded-lg">
                    <div className="flex items-center gap-2">
                      <HardDrive className="w-4 h-4 text-green-500" />
                      <span>S3 Buckets</span>
                    </div>
                    <Switch
                      checked={config.snapshotS3}
                      onCheckedChange={(checked) => setConfig({ ...config, snapshotS3: checked })}
                    />
                  </div>
                  <div className="flex items-center justify-between p-3 border rounded-lg">
                    <div className="flex items-center gap-2">
                      <Key className="w-4 h-4 text-yellow-500" />
                      <span>Secrets Manager</span>
                    </div>
                    <Switch
                      checked={config.snapshotSecrets}
                      onCheckedChange={(checked) => setConfig({ ...config, snapshotSecrets: checked })}
                    />
                  </div>
                  <div className="flex items-center justify-between p-3 border rounded-lg">
                    <div className="flex items-center gap-2">
                      <Database className="w-4 h-4 text-orange-500" />
                      <span>DynamoDB Tables</span>
                    </div>
                    <Switch
                      checked={config.snapshotDynamoDB}
                      onCheckedChange={(checked) => setConfig({ ...config, snapshotDynamoDB: checked })}
                    />
                  </div>
                </div>
              </div>

              <Separator />

              {/* Notifications */}
              <div className="space-y-4">
                <Label>Notifications</Label>
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm">Notify on success</span>
                    <Switch
                      checked={config.notifyOnSuccess}
                      onCheckedChange={(checked) => setConfig({ ...config, notifyOnSuccess: checked })}
                    />
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm">Notify on failure</span>
                    <Switch
                      checked={config.notifyOnFailure}
                      onCheckedChange={(checked) => setConfig({ ...config, notifyOnFailure: checked })}
                    />
                  </div>
                </div>
              </div>

              <div className="flex justify-end">
                <Button onClick={saveConfig}>
                  Save Configuration
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Info Card */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Shield className="w-5 h-5" />
                Disaster Recovery Information
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="p-4 bg-green-50 dark:bg-green-950 rounded-lg">
                  <h4 className="font-semibold text-green-700 dark:text-green-300">Zero Downtime</h4>
                  <p className="text-sm text-green-600 dark:text-green-400">
                    AWS snapshots are created at the storage level without affecting application availability. Users experience no downtime during snapshot creation.
                  </p>
                </div>
                <div className="p-4 bg-blue-50 dark:bg-blue-950 rounded-lg">
                  <h4 className="font-semibold text-blue-700 dark:text-blue-300">Restore Time</h4>
                  <p className="text-sm text-blue-600 dark:text-blue-400">
                    RDS restore creates a new cluster in 5-15 minutes. S3 and DynamoDB restore is nearly instant. DNS switch completes the process.
                  </p>
                </div>
                <div className="p-4 bg-purple-50 dark:bg-purple-950 rounded-lg">
                  <h4 className="font-semibold text-purple-700 dark:text-purple-300">Protection Level</h4>
                  <p className="text-sm text-purple-600 dark:text-purple-400">
                    AWS snapshots provide isolation from application-level bugs. Even if data is accidentally deleted via the app, snapshots remain intact.
                  </p>
                </div>
                <div className="p-4 bg-orange-50 dark:bg-orange-950 rounded-lg">
                  <h4 className="font-semibold text-orange-700 dark:text-orange-300">Cost Estimate</h4>
                  <p className="text-sm text-orange-600 dark:text-orange-400">
                    RDS snapshots: ~$0.02/GB-month. DynamoDB backups: ~$0.10/GB-month. Storage costs scale with retained data.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
