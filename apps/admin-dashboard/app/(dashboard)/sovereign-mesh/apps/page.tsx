'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useToast } from '@/components/ui/use-toast';
import Image from 'next/image';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  AppWindow,
  Search,
  RefreshCw,
  CheckCircle,
  AlertTriangle,
  XCircle,
  Link,
  ExternalLink,
  Clock,
  Zap,
} from 'lucide-react';

interface App {
  id: string;
  name: string;
  display_name: string;
  description: string;
  logo_url: string;
  source: string;
  auth_type: string;
  health_status: string;
  usage_count_30d: number;
  is_featured: boolean;
  is_active: boolean;
}

interface SyncLog {
  id: string;
  source: string;
  status: string;
  apps_added: number;
  apps_updated: number;
  apps_failed: number;
  sync_started_at: string;
  sync_completed_at: string;
}

export default function AppsPage() {
  const { toast } = useToast();
  const [apps, setApps] = useState<App[]>([]);
  const [syncLogs, setSyncLogs] = useState<SyncLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [sourceFilter, setSourceFilter] = useState<string>('all');
  const [total, setTotal] = useState(0);
  const [offset, setOffset] = useState(0);
  const limit = 24;

  const loadApps = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        limit: limit.toString(),
        offset: offset.toString(),
      });
      if (searchQuery) params.set('search', searchQuery);
      if (sourceFilter !== 'all') params.set('source', sourceFilter);

      const response = await fetch(`/api/admin/sovereign-mesh/apps?${params}`);
      if (response.ok) {
        const data = await response.json();
        setApps(data.apps || []);
        setTotal(data.total || 0);
      }
    } catch (error) {
      console.error('Failed to load apps:', error);
    } finally {
      setLoading(false);
    }
  }, [sourceFilter, offset, searchQuery]);

  const loadSyncLogs = useCallback(async () => {
    try {
      const response = await fetch('/api/admin/sovereign-mesh/apps/sync/status');
      if (response.ok) {
        const data = await response.json();
        setSyncLogs(data.logs || []);
      }
    } catch (error) {
      console.error('Failed to load sync logs:', error);
    }
  }, []);

  useEffect(() => {
    loadApps();
  }, [loadApps]);

  useEffect(() => {
    loadSyncLogs();
  }, [loadSyncLogs]);

  const handleSearch = () => {
    setOffset(0);
    loadApps();
  };

  const handleTriggerSync = async () => {
    try {
      const response = await fetch('/api/admin/sovereign-mesh/apps/sync/trigger', {
        method: 'POST',
      });
      if (response.ok) {
        toast({
          title: 'Sync Triggered',
          description: 'App registry sync has been started.',
        });
        loadSyncLogs();
      } else {
        toast({
          title: 'Sync Failed',
          description: 'Failed to trigger app registry sync.',
          variant: 'destructive',
        });
      }
    } catch (error) {
      console.error('Failed to trigger sync:', error);
      toast({
        title: 'Sync Failed',
        description: 'An error occurred while triggering sync.',
        variant: 'destructive',
      });
    }
  };

  const getHealthIcon = (status: string) => {
    switch (status) {
      case 'healthy':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'degraded':
        return <AlertTriangle className="h-4 w-4 text-yellow-500" />;
      case 'unhealthy':
        return <XCircle className="h-4 w-4 text-red-500" />;
      default:
        return <Clock className="h-4 w-4 text-gray-400" />;
    }
  };

  const getSourceColor = (source: string) => {
    const colors: Record<string, string> = {
      activepieces: 'bg-purple-100 text-purple-800',
      n8n: 'bg-orange-100 text-orange-800',
      native: 'bg-blue-100 text-blue-800',
      custom: 'bg-gray-100 text-gray-800',
    };
    return colors[source] || colors.custom;
  };

  if (loading && apps.length === 0) {
    return (
      <div className="flex items-center justify-center h-96">
        <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">App Registry</h1>
          <p className="text-muted-foreground">
            Browse and manage 3,000+ app integrations
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="text-lg px-3 py-1">
            {total.toLocaleString()} apps
          </Badge>
          <Button variant="outline" onClick={handleTriggerSync}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Trigger Sync
          </Button>
        </div>
      </div>

      <Tabs defaultValue="browse">
        <TabsList>
          <TabsTrigger value="browse">Browse Apps</TabsTrigger>
          <TabsTrigger value="sync">Sync Status</TabsTrigger>
        </TabsList>

        <TabsContent value="browse" className="space-y-4">
          <div className="flex items-center gap-4">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search apps..."
                className="pl-10"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
              />
            </div>
            <Select value={sourceFilter} onValueChange={setSourceFilter}>
              <SelectTrigger className="w-48">
                <SelectValue placeholder="All sources" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Sources</SelectItem>
                <SelectItem value="activepieces">Activepieces</SelectItem>
                <SelectItem value="n8n">n8n</SelectItem>
                <SelectItem value="native">Native</SelectItem>
                <SelectItem value="custom">Custom</SelectItem>
              </SelectContent>
            </Select>
            <Button onClick={handleSearch}>Search</Button>
          </div>

          <div className="grid gap-4 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
            {apps.map((app) => (
              <Card key={app.id} className="hover:shadow-md transition-shadow cursor-pointer">
                <CardHeader className="p-4 pb-2">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-2">
                      {app.logo_url ? (
                        <Image src={app.logo_url} alt={app.display_name} width={32} height={32} className="w-8 h-8 rounded" />
                      ) : (
                        <div className="w-8 h-8 rounded bg-muted flex items-center justify-center">
                          <AppWindow className="h-4 w-4" />
                        </div>
                      )}
                      {getHealthIcon(app.health_status)}
                    </div>
                    {app.is_featured && <Zap className="h-4 w-4 text-yellow-500" />}
                  </div>
                  <CardTitle className="text-sm mt-2 line-clamp-1">{app.display_name}</CardTitle>
                </CardHeader>
                <CardContent className="p-4 pt-0">
                  <CardDescription className="text-xs line-clamp-2 mb-2 min-h-[32px]">
                    {app.description || 'No description'}
                  </CardDescription>
                  <div className="flex items-center justify-between">
                    <Badge className={`text-xs ${getSourceColor(app.source)}`}>
                      {app.source}
                    </Badge>
                    <span className="text-xs text-muted-foreground">
                      {app.usage_count_30d || 0} uses
                    </span>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {apps.length === 0 && !loading && (
            <div className="text-center py-12 text-muted-foreground">
              <AppWindow className="h-12 w-12 mx-auto mb-3 opacity-50" />
              <p className="font-medium">No apps found</p>
              <p className="text-sm">Try adjusting your search or filters</p>
            </div>
          )}

          {total > limit && (
            <div className="flex items-center justify-center gap-2">
              <Button
                variant="outline"
                disabled={offset === 0}
                onClick={() => setOffset(Math.max(0, offset - limit))}
              >
                Previous
              </Button>
              <span className="text-sm text-muted-foreground">
                {offset + 1} - {Math.min(offset + limit, total)} of {total}
              </span>
              <Button
                variant="outline"
                disabled={offset + limit >= total}
                onClick={() => setOffset(offset + limit)}
              >
                Next
              </Button>
            </div>
          )}
        </TabsContent>

        <TabsContent value="sync" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Sync History</CardTitle>
              <CardDescription>Recent app registry sync operations</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {syncLogs.map((log) => (
                  <div key={log.id} className="flex items-center justify-between p-3 rounded-lg border">
                    <div className="flex items-center gap-4">
                      <Badge className={getSourceColor(log.source)}>{log.source}</Badge>
                      <div>
                        <p className="font-medium">
                          {log.status === 'completed' ? (
                            <span className="text-green-600">Completed</span>
                          ) : log.status === 'running' ? (
                            <span className="text-blue-600">Running</span>
                          ) : (
                            <span className="text-red-600">Failed</span>
                          )}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          {new Date(log.sync_started_at).toLocaleString()}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-4 text-sm">
                      <span className="text-green-600">+{log.apps_added} added</span>
                      <span className="text-blue-600">{log.apps_updated} updated</span>
                      {log.apps_failed > 0 && (
                        <span className="text-red-600">{log.apps_failed} failed</span>
                      )}
                    </div>
                  </div>
                ))}
                {syncLogs.length === 0 && (
                  <p className="text-center text-muted-foreground py-4">No sync history</p>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
