'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { 
  RefreshCw, 
  Globe,
  Server,
  CheckCircle,
  AlertTriangle,
  Clock,
  Zap,
} from 'lucide-react';

interface SyncStatus {
  region: string;
  status: 'synced' | 'syncing' | 'error';
  last_sync: string;
  models_synced: number;
  pending_updates: number;
}

interface SyncConfig {
  auto_sync_enabled: boolean;
  sync_interval_minutes: number;
  sync_on_model_update: boolean;
  primary_region: string;
}

async function fetchSyncStatus(): Promise<SyncStatus[]> {
  const res = await fetch('/api/admin/model-coordination/status');
  if (!res.ok) throw new Error('Failed to fetch status');
  const data = await res.json();
  return data.regions || [];
}

async function fetchSyncConfig(): Promise<SyncConfig> {
  const res = await fetch('/api/admin/model-coordination/config');
  if (!res.ok) throw new Error('Failed to fetch config');
  return res.json();
}

export default function ModelCoordinationPage() {
  const { data: regions = [], isLoading } = useQuery({
    queryKey: ['model-sync-status'],
    queryFn: fetchSyncStatus,
  });

  const { data: config } = useQuery({
    queryKey: ['model-sync-config'],
    queryFn: fetchSyncConfig,
  });

  const syncedRegions = regions.filter(r => r.status === 'synced').length;
  const totalPending = regions.reduce((s, r) => s + r.pending_updates, 0);

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'synced': return <Badge className="bg-green-500"><CheckCircle className="h-3 w-3 mr-1" />Synced</Badge>;
      case 'syncing': return <Badge className="bg-blue-500"><RefreshCw className="h-3 w-3 mr-1 animate-spin" />Syncing</Badge>;
      default: return <Badge variant="destructive"><AlertTriangle className="h-3 w-3 mr-1" />Error</Badge>;
    }
  };

  if (isLoading) {
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
            <Globe className="h-8 w-8" />
            Model Coordination
          </h1>
          <p className="text-muted-foreground mt-1">
            Multi-region model synchronization and coordination
          </p>
        </div>
        <Button>
          <RefreshCw className="h-4 w-4 mr-2" />
          Sync All Regions
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Regions</CardDescription>
            <CardTitle className="text-3xl">{regions.length}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Synced</CardDescription>
            <CardTitle className="text-3xl text-green-500">{syncedRegions}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Pending Updates</CardDescription>
            <CardTitle className="text-3xl text-orange-500">{totalPending}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Primary Region</CardDescription>
            <CardTitle className="text-xl">{config?.primary_region || 'us-east-1'}</CardTitle>
          </CardHeader>
        </Card>
      </div>

      <Tabs defaultValue="status" className="space-y-4">
        <TabsList>
          <TabsTrigger value="status">Sync Status</TabsTrigger>
          <TabsTrigger value="config">Configuration</TabsTrigger>
        </TabsList>

        <TabsContent value="status" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Region Sync Status</CardTitle>
              <CardDescription>Model synchronization across all regions</CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Region</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Models Synced</TableHead>
                    <TableHead>Pending</TableHead>
                    <TableHead>Last Sync</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {regions.map((region) => (
                    <TableRow key={region.region}>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Server className="h-4 w-4 text-muted-foreground" />
                          <span className="font-medium">{region.region}</span>
                        </div>
                      </TableCell>
                      <TableCell>{getStatusBadge(region.status)}</TableCell>
                      <TableCell>{region.models_synced}</TableCell>
                      <TableCell>
                        {region.pending_updates > 0 ? (
                          <Badge variant="secondary">{region.pending_updates}</Badge>
                        ) : (
                          <span className="text-muted-foreground">0</span>
                        )}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {new Date(region.last_sync).toLocaleString()}
                      </TableCell>
                      <TableCell>
                        <Button variant="outline" size="sm">
                          <Zap className="h-3 w-3 mr-1" />
                          Sync
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="config" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Sync Configuration</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <Label>Auto-Sync Enabled</Label>
                  <p className="text-sm text-muted-foreground">Automatically sync models</p>
                </div>
                <Switch checked={config?.auto_sync_enabled} />
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <Label>Sync on Model Update</Label>
                  <p className="text-sm text-muted-foreground">Trigger sync when models change</p>
                </div>
                <Switch checked={config?.sync_on_model_update} />
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
