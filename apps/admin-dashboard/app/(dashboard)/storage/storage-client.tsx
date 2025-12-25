'use client';

import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { 
  HardDrive, 
  Database, 
  Cloud, 
  Archive,
  RefreshCw,
  AlertTriangle,
  TrendingUp
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

export function StorageClient() {
  const queryClient = useQueryClient();

  const { data: usage, isLoading } = useQuery<StorageUsage[]>({
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
