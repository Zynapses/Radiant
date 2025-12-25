'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  DollarSign,
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  Lightbulb,
  RefreshCw,
  Bell,
  BarChart3,
} from 'lucide-react';

interface CostInsight {
  id: string;
  title: string;
  description: string;
  impact: 'high' | 'medium' | 'low';
  estimatedSavings: number;
  action: string;
}

interface CostAlert {
  id: string;
  alertType: string;
  threshold: number;
  isTriggered: boolean;
}

interface CostSummary {
  totalSpend: number;
  totalSpendChange: number;
  estimatedMonthly: number;
  averageDaily: number;
  requestCount: number;
  topModel: string;
  topModelSpend: number;
  byProvider: Record<string, number>;
  byModel: Record<string, number>;
}

export function CostClient() {
  const [timePeriod, setTimePeriod] = useState('30d');

  const { data: summary, isLoading: summaryLoading } = useQuery({
    queryKey: ['cost-summary', timePeriod],
    queryFn: () => fetch('/api/cost/summary').then(r => r.json()),
  });

  const { data: alerts } = useQuery({
    queryKey: ['cost-alerts'],
    queryFn: () => fetch('/api/cost/alerts').then(r => r.json()),
  });

  const { data: insights } = useQuery({
    queryKey: ['cost-insights'],
    queryFn: () => fetch('/api/cost/insights').then(r => r.json()),
  });

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <DollarSign className="h-6 w-6" />
            Cost Analytics
          </h2>
          <p className="text-muted-foreground">Monitor and optimize AI spending</p>
        </div>
        <Select value={timePeriod} onValueChange={setTimePeriod}>
          <SelectTrigger className="w-[150px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="7d">Last 7 days</SelectItem>
            <SelectItem value="30d">Last 30 days</SelectItem>
            <SelectItem value="90d">Last 90 days</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Total Spend</CardDescription>
            <CardTitle className="text-3xl">
              ${summary?.totalSpend?.toLocaleString() || '0'}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-1 text-sm">
              {(summary?.totalSpendChange || 0) > 0 ? (
                <TrendingUp className="h-4 w-4 text-red-500" />
              ) : (
                <TrendingDown className="h-4 w-4 text-green-500" />
              )}
              <span className={(summary?.totalSpendChange || 0) > 0 ? 'text-red-500' : 'text-green-500'}>
                {Math.abs(summary?.totalSpendChange || 0)}%
              </span>
              <span className="text-muted-foreground">vs last period</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Estimated Monthly</CardDescription>
            <CardTitle className="text-3xl">
              ${summary?.estimatedMonthly?.toLocaleString() || '0'}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-1 text-sm text-muted-foreground">
              <BarChart3 className="h-4 w-4" />
              Based on current usage
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Average Daily</CardDescription>
            <CardTitle className="text-3xl">
              ${summary?.averageDaily?.toFixed(2) || '0'}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-1 text-sm text-muted-foreground">
              {summary?.requestCount?.toLocaleString() || 0} requests
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Top Model</CardDescription>
            <CardTitle className="text-lg">{summary?.topModel || '-'}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-sm text-muted-foreground">
              ${summary?.topModelSpend?.toFixed(2) || '0'} ({summary?.topModel ? Math.round((summary.topModelSpend / summary.totalSpend) * 100) : 0}%)
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="insights">
        <TabsList>
          <TabsTrigger value="insights">AI Insights</TabsTrigger>
          <TabsTrigger value="alerts">Alerts</TabsTrigger>
          <TabsTrigger value="breakdown">Breakdown</TabsTrigger>
        </TabsList>

        <TabsContent value="insights" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Lightbulb className="h-5 w-5 text-yellow-500" />
                Cost Optimization Insights
              </CardTitle>
              <CardDescription>AI-powered recommendations to reduce costs</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4" data-testid="cost-alerts">
                {insights?.map((insight: CostInsight) => (
                  <div key={insight.id} className="flex items-start gap-4 p-4 border rounded-lg">
                    <div className={`p-2 rounded-full ${
                      insight.impact === 'high' ? 'bg-green-100' : 'bg-yellow-100'
                    }`}>
                      <Lightbulb className={`h-5 w-5 ${
                        insight.impact === 'high' ? 'text-green-600' : 'text-yellow-600'
                      }`} />
                    </div>
                    <div className="flex-1">
                      <h4 className="font-medium">{insight.title}</h4>
                      <p className="text-sm text-muted-foreground mt-1">{insight.description}</p>
                      <div className="flex items-center gap-4 mt-2">
                        <Badge variant="outline" className="text-green-600">
                          Save ~${insight.estimatedSavings}/mo
                        </Badge>
                        <Button variant="link" className="h-auto p-0 text-sm">
                          {insight.action} →
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="alerts" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Bell className="h-5 w-5" />
                Cost Alerts
              </CardTitle>
              <CardDescription>Configured spending alerts and thresholds</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {alerts?.map((alert: CostAlert) => (
                  <div key={alert.id} className="flex items-center justify-between p-4 border rounded-lg">
                    <div className="flex items-center gap-3">
                      {alert.isTriggered ? (
                        <AlertTriangle className="h-5 w-5 text-red-500" />
                      ) : (
                        <Bell className="h-5 w-5 text-muted-foreground" />
                      )}
                      <div>
                        <p className="font-medium capitalize">{alert.alertType} Alert</p>
                        <p className="text-sm text-muted-foreground">
                          Threshold: ${alert.threshold.toLocaleString()}
                        </p>
                      </div>
                    </div>
                    <Badge variant={alert.isTriggered ? 'destructive' : 'secondary'}>
                      {alert.isTriggered ? 'Triggered' : 'Active'}
                    </Badge>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="breakdown" className="mt-4">
          <div className="grid grid-cols-2 gap-4">
            <Card>
              <CardHeader>
                <CardTitle>By Provider</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {summary?.byProvider && Object.entries(summary.byProvider).map(([provider, cost]) => (
                    <div key={provider} className="flex items-center justify-between">
                      <span className="capitalize">{provider}</span>
                      <span className="font-medium">${(cost as number).toFixed(2)}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>By Model</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {summary?.byModel && Object.entries(summary.byModel).map(([model, cost]) => (
                    <div key={model} className="flex items-center justify-between">
                      <span className="text-sm">{model}</span>
                      <span className="font-medium">${(cost as number).toFixed(2)}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
