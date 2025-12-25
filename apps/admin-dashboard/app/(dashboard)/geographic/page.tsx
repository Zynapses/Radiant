'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Globe, TrendingUp, Activity, DollarSign } from 'lucide-react';

interface RegionData {
  code: string;
  name: string;
  requests: number;
  tokens: number;
  cost: number;
  growth: number;
}

const mockRegionData: RegionData[] = [
  { code: 'US', name: 'United States', requests: 1250000, tokens: 45000000, cost: 12500.00, growth: 15.2 },
  { code: 'GB', name: 'United Kingdom', requests: 320000, tokens: 12000000, cost: 3200.00, growth: 8.5 },
  { code: 'DE', name: 'Germany', requests: 280000, tokens: 10500000, cost: 2800.00, growth: 12.3 },
  { code: 'FR', name: 'France', requests: 195000, tokens: 7200000, cost: 1950.00, growth: 6.8 },
  { code: 'JP', name: 'Japan', requests: 175000, tokens: 6500000, cost: 1750.00, growth: 22.1 },
  { code: 'AU', name: 'Australia', requests: 145000, tokens: 5400000, cost: 1450.00, growth: 18.4 },
  { code: 'CA', name: 'Canada', requests: 125000, tokens: 4600000, cost: 1250.00, growth: 9.7 },
  { code: 'BR', name: 'Brazil', requests: 95000, tokens: 3500000, cost: 950.00, growth: 31.2 },
];

function formatNumber(num: number): string {
  if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
  if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
  return num.toString();
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount);
}

export default function GeographicPage() {
  const [timeRange, setTimeRange] = useState('30d');

  const totalRequests = mockRegionData.reduce((sum, r) => sum + r.requests, 0);
  const totalTokens = mockRegionData.reduce((sum, r) => sum + r.tokens, 0);
  const totalCost = mockRegionData.reduce((sum, r) => sum + r.cost, 0);

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
            <p className="text-xs text-muted-foreground">Across {mockRegionData.length} regions</p>
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
            {mockRegionData.map((region) => (
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
