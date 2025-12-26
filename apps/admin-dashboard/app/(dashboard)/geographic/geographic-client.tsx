'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Globe, TrendingUp, Activity, DollarSign, RefreshCw } from 'lucide-react';
import type { RegionStats } from '@/lib/api/types';

interface RegionDisplayData {
  code: string;
  name: string;
  requests: number;
  tokens: number;
  cost: number;
  growth: number;
}

function formatNumber(num: number): string {
  if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
  if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
  return num.toString();
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount);
}

export function GeographicClient() {
  const [timeRange, setTimeRange] = useState('30d');

  const { data: regionData = [], isLoading } = useQuery<RegionDisplayData[]>({
    queryKey: ['geographic-regions', timeRange],
    queryFn: async () => {
      const response = await fetch(`/api/geographic/regions?period=${timeRange}`);
      if (!response.ok) throw new Error('Failed to fetch regions');
      const regions: RegionStats[] = await response.json();
      return regions.map((r: RegionStats) => ({
        code: r.region.substring(0, 2).toUpperCase(),
        name: r.displayName,
        requests: timeRange === '7d' ? r.requests.last7d : r.requests.last24h,
        tokens: 0, // Will be populated from usage endpoint
        cost: 0, // Will be populated from billing endpoint
        growth: 0, // Will be calculated from historical data
      }));
    },
  });

  const totalRequests = regionData.reduce((sum: number, r: RegionDisplayData) => sum + r.requests, 0);
  const totalTokens = regionData.reduce((sum: number, r: RegionDisplayData) => sum + r.tokens, 0);
  const totalCost = regionData.reduce((sum: number, r: RegionDisplayData) => sum + r.cost, 0);

  if (isLoading) {
    return (
      <div className="flex justify-center py-8">
        <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Geographic Overview</h1>
          <p className="text-muted-foreground">
            Usage distribution across regions
          </p>
        </div>
        <Select value={timeRange} onValueChange={setTimeRange}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Select time range" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="7d">Last 7 days</SelectItem>
            <SelectItem value="30d">Last 30 days</SelectItem>
            <SelectItem value="90d">Last 90 days</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Requests</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatNumber(totalRequests)}</div>
            <p className="text-xs text-muted-foreground">Across {regionData.length} regions</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Tokens</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatNumber(totalTokens)}</div>
            <p className="text-xs text-muted-foreground">Input + Output tokens</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Revenue</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(totalCost)}</div>
            <p className="text-xs text-muted-foreground">Billed amount</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Globe className="h-5 w-5" />
            World Map
          </CardTitle>
          <CardDescription>
            Click on a region to view detailed analytics
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="h-[400px] flex items-center justify-center border rounded-lg bg-muted/20">
            <div className="text-center text-muted-foreground">
              <Globe className="h-16 w-16 mx-auto mb-4 opacity-50" />
              <p>Interactive world map visualization</p>
              <p className="text-sm">Requires react-simple-maps integration</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Regional Breakdown</CardTitle>
          <CardDescription>Usage statistics by country</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {regionData.map((region: RegionDisplayData) => (
              <div key={region.code} className="flex items-center justify-between p-4 border rounded-lg">
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center font-bold text-sm">
                    {region.code}
                  </div>
                  <div>
                    <p className="font-medium">{region.name}</p>
                    <p className="text-sm text-muted-foreground">
                      {formatNumber(region.requests)} requests
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-8 text-right">
                  <div>
                    <p className="font-medium">{formatNumber(region.tokens)}</p>
                    <p className="text-sm text-muted-foreground">tokens</p>
                  </div>
                  <div>
                    <p className="font-medium">{formatCurrency(region.cost)}</p>
                    <p className="text-sm text-muted-foreground">revenue</p>
                  </div>
                  <div className={`text-sm font-medium ${region.growth >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {region.growth >= 0 ? '+' : ''}{region.growth}%
                  </div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
