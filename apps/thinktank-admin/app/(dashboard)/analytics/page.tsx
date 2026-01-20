'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { BarChart3, Users, MessageSquare, TrendingUp, TrendingDown, Clock, Activity, RefreshCw, Loader2, DollarSign, Zap, Brain } from 'lucide-react';

interface AnalyticsOverview {
  totalUsers: number;
  activeUsers: number;
  totalConversations: number;
  totalMessages: number;
  avgMessagesPerUser: number;
  avgSessionDuration: number;
  totalTokensUsed: number;
  totalCost: number;
}

interface UsageTrend { date: string; users: number; conversations: number; messages: number; tokens: number; cost: number; }
interface ModelUsage { modelId: string; modelName: string; requests: number; tokens: number; cost: number; avgLatency: number; }

interface Analytics { overview: AnalyticsOverview; trends: UsageTrend[]; modelUsage: ModelUsage[]; }

const formatNumber = (num: number) => num >= 1000000 ? `${(num / 1000000).toFixed(1)}M` : num >= 1000 ? `${(num / 1000).toFixed(1)}K` : num.toFixed(0);
const formatCurrency = (num: number) => `$${num.toFixed(2)}`;
const formatDuration = (ms: number) => ms >= 60000 ? `${(ms / 60000).toFixed(1)}m` : `${(ms / 1000).toFixed(1)}s`;

export default function AnalyticsPage() {
  const [timeRange, setTimeRange] = useState('30');

  const { data, isLoading, error, refetch } = useQuery<Analytics>({
    queryKey: ['thinktank-analytics', timeRange],
    queryFn: () => api.get<Analytics>(`/api/admin/thinktank/analytics?days=${timeRange}`),
    refetchInterval: 60000,
  });

  if (isLoading) return <div className="flex items-center justify-center h-64"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>;
  if (error || !data) return <div className="flex flex-col items-center justify-center h-64 gap-4"><p className="text-destructive">Failed to load analytics</p><Button onClick={() => refetch()}><RefreshCw className="mr-2 h-4 w-4" />Retry</Button></div>;

  const { overview, trends, modelUsage } = data;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div><h1 className="text-3xl font-bold flex items-center gap-2"><BarChart3 className="h-8 w-8 text-blue-500" />Analytics</h1><p className="text-muted-foreground mt-1">Think Tank usage metrics and insights</p></div>
        <div className="flex items-center gap-2">
          <Select value={timeRange} onValueChange={setTimeRange}><SelectTrigger className="w-36"><SelectValue placeholder="Time range" /></SelectTrigger><SelectContent><SelectItem value="7">Last 7 days</SelectItem><SelectItem value="30">Last 30 days</SelectItem><SelectItem value="90">Last 90 days</SelectItem></SelectContent></Select>
          <Button onClick={() => refetch()} variant="outline"><RefreshCw className="mr-2 h-4 w-4" />Refresh</Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm font-medium flex items-center gap-2"><Users className="h-4 w-4" />Total Users</CardTitle></CardHeader><CardContent><div className="text-2xl font-bold">{formatNumber(overview.totalUsers)}</div><p className="text-xs text-muted-foreground">{formatNumber(overview.activeUsers)} active</p></CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm font-medium flex items-center gap-2"><MessageSquare className="h-4 w-4" />Conversations</CardTitle></CardHeader><CardContent><div className="text-2xl font-bold">{formatNumber(overview.totalConversations)}</div><p className="text-xs text-muted-foreground">{formatNumber(overview.totalMessages)} messages</p></CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm font-medium flex items-center gap-2"><Zap className="h-4 w-4" />Tokens Used</CardTitle></CardHeader><CardContent><div className="text-2xl font-bold">{formatNumber(overview.totalTokensUsed)}</div><p className="text-xs text-muted-foreground">{overview.avgMessagesPerUser.toFixed(1)} msg/user</p></CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm font-medium flex items-center gap-2"><DollarSign className="h-4 w-4" />Total Cost</CardTitle></CardHeader><CardContent><div className="text-2xl font-bold">{formatCurrency(overview.totalCost)}</div><p className="text-xs text-muted-foreground">Avg session: {formatDuration(overview.avgSessionDuration)}</p></CardContent></Card>
      </div>

      <Tabs defaultValue="trends">
        <TabsList><TabsTrigger value="trends">Usage Trends</TabsTrigger><TabsTrigger value="models">Model Usage</TabsTrigger></TabsList>

        <TabsContent value="trends" className="space-y-4">
          <Card><CardHeader><CardTitle>Daily Usage Trends</CardTitle><CardDescription>Activity over the selected time period</CardDescription></CardHeader><CardContent>
            <div className="space-y-4">
              {trends.length === 0 ? (
                <p className="text-center py-8 text-muted-foreground">No data available for the selected period</p>
              ) : (
                <div className="grid gap-2">
                  <div className="grid grid-cols-6 gap-4 text-sm font-medium text-muted-foreground border-b pb-2"><span>Date</span><span className="text-right">Users</span><span className="text-right">Conversations</span><span className="text-right">Messages</span><span className="text-right">Tokens</span><span className="text-right">Cost</span></div>
                  {trends.slice(0, 14).map((day) => (
                    <div key={day.date} className="grid grid-cols-6 gap-4 text-sm py-2 border-b border-border/50">
                      <span>{new Date(day.date).toLocaleDateString()}</span>
                      <span className="text-right font-mono">{day.users}</span>
                      <span className="text-right font-mono">{day.conversations}</span>
                      <span className="text-right font-mono">{day.messages}</span>
                      <span className="text-right font-mono">{formatNumber(day.tokens)}</span>
                      <span className="text-right font-mono">{formatCurrency(day.cost)}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </CardContent></Card>
        </TabsContent>

        <TabsContent value="models" className="space-y-4">
          <Card><CardHeader><CardTitle>Model Usage Breakdown</CardTitle><CardDescription>Usage statistics by AI model</CardDescription></CardHeader><CardContent>
            <div className="space-y-4">
              {modelUsage.length === 0 ? (
                <p className="text-center py-8 text-muted-foreground">No model usage data available</p>
              ) : (
                <div className="grid gap-2">
                  <div className="grid grid-cols-5 gap-4 text-sm font-medium text-muted-foreground border-b pb-2"><span>Model</span><span className="text-right">Requests</span><span className="text-right">Tokens</span><span className="text-right">Cost</span><span className="text-right">Avg Latency</span></div>
                  {modelUsage.map((model) => (
                    <div key={model.modelId} className="grid grid-cols-5 gap-4 text-sm py-2 border-b border-border/50">
                      <div><span className="font-medium">{model.modelName}</span><span className="text-xs text-muted-foreground block">{model.modelId}</span></div>
                      <span className="text-right font-mono">{formatNumber(model.requests)}</span>
                      <span className="text-right font-mono">{formatNumber(model.tokens)}</span>
                      <span className="text-right font-mono">{formatCurrency(model.cost)}</span>
                      <span className="text-right font-mono">{formatDuration(model.avgLatency)}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </CardContent></Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
