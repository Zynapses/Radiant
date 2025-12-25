'use client';

import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { TrendingUp, TrendingDown, Minus, DollarSign, Cpu, Zap } from 'lucide-react';
import { useState } from 'react';
import { InsightsList, CostInsight } from '@/components/cost/InsightCard';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
} from 'recharts';

interface CostSummary {
  daily: number;
  weekly: number;
  monthly: number;
  byModel: Record<string, number>;
  byProvider: Record<string, number>;
  trend: 'up' | 'down' | 'stable';
  trendPercent: number;
}

interface CostAlert {
  id: string;
  alertType: 'threshold' | 'spike' | 'budget';
  threshold: number;
  currentValue: number;
  isTriggered: boolean;
}

const COLORS = ['#6366f1', '#8b5cf6', '#a855f7', '#d946ef', '#ec4899', '#f43f5e', '#f97316', '#eab308'];

export function CostAnalytics() {
  const [period, setPeriod] = useState<string>('30');

  const { data: summary } = useQuery<CostSummary>({
    queryKey: ['cost-summary'],
    queryFn: () => fetch('/api/cost/summary').then((r) => r.json()),
  });

  const { data: alerts } = useQuery<CostAlert[]>({
    queryKey: ['cost-alerts'],
    queryFn: () => fetch('/api/cost/alerts').then((r) => r.json()),
  });

  const { data: insights } = useQuery<CostInsight[]>({
    queryKey: ['cost-insights'],
    queryFn: () => fetch('/api/cost/insights').then((r) => r.json()),
  });

  const getTrendIcon = (trend: CostSummary['trend']) => {
    switch (trend) {
      case 'up':
        return <TrendingUp className="h-4 w-4 text-red-500" />;
      case 'down':
        return <TrendingDown className="h-4 w-4 text-green-500" />;
      default:
        return <Minus className="h-4 w-4 text-muted-foreground" />;
    }
  };

  const modelData = summary?.byModel
    ? Object.entries(summary.byModel).map(([name, value]) => ({ name, value }))
    : [];

  const providerData = summary?.byProvider
    ? Object.entries(summary.byProvider).map(([name, value]) => ({ name, value }))
    : [];

  // Mock daily data for chart
  const dailyData = Array.from({ length: 30 }, (_, i) => ({
    day: `Day ${i + 1}`,
    cost: Math.random() * 100 + 50,
    tokens: Math.floor(Math.random() * 100000 + 50000),
  }));

  return (
    <div className="space-y-6">
      {/* Period Selector */}
      <div className="flex justify-between items-center">
        <h2 className="text-lg font-semibold">Cost Analytics</h2>
        <Select value={period} onValueChange={setPeriod}>
          <SelectTrigger className="w-32">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="7">7 Days</SelectItem>
            <SelectItem value="30">30 Days</SelectItem>
            <SelectItem value="90">90 Days</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <DollarSign className="h-4 w-4" />
              Today
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">${summary?.daily?.toFixed(2) || '0.00'}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              This Week
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">${summary?.weekly?.toFixed(2) || '0.00'}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              This Month
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">${summary?.monthly?.toFixed(2) || '0.00'}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Trend
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              {summary && getTrendIcon(summary.trend)}
              <span
                className={`text-2xl font-bold ${
                  summary?.trend === 'up'
                    ? 'text-red-500'
                    : summary?.trend === 'down'
                    ? 'text-green-500'
                    : ''
                }`}
              >
                {summary?.trendPercent?.toFixed(1) || 0}%
              </span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Alerts */}
      {alerts && alerts.some((a) => a.isTriggered) && (
        <Card className="border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-950">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-amber-700 dark:text-amber-300">
              Active Cost Alerts
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {alerts
                .filter((a) => a.isTriggered)
                .map((alert) => (
                  <Badge key={alert.id} variant="outline" className="border-amber-500">
                    {alert.alertType}: ${alert.currentValue.toFixed(2)} / ${alert.threshold.toFixed(2)}
                  </Badge>
                ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Charts */}
      <div className="grid gap-4 md:grid-cols-2">
        {/* Daily Cost Trend */}
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">Daily Cost Trend</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={dailyData}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis dataKey="day" className="text-xs" tick={{ fontSize: 10 }} />
                  <YAxis className="text-xs" tick={{ fontSize: 10 }} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: 'hsl(var(--card))',
                      border: '1px solid hsl(var(--border))',
                    }}
                  />
                  <Line
                    type="monotone"
                    dataKey="cost"
                    stroke="#6366f1"
                    strokeWidth={2}
                    dot={false}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Cost by Provider */}
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">Cost by Provider</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={providerData.length > 0 ? providerData : [{ name: 'No data', value: 1 }]}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={80}
                    paddingAngle={5}
                    dataKey="value"
                  >
                    {providerData.map((_, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(value: number) => [`$${value.toFixed(2)}`, 'Cost']}
                    contentStyle={{
                      backgroundColor: 'hsl(var(--card))',
                      border: '1px solid hsl(var(--border))',
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="flex flex-wrap gap-2 mt-2 justify-center">
              {providerData.map((entry, index) => (
                <div key={entry.name} className="flex items-center gap-1 text-xs">
                  <div
                    className="w-3 h-3 rounded-full"
                    style={{ backgroundColor: COLORS[index % COLORS.length] }}
                  />
                  <span>{entry.name}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Cost by Model */}
        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle className="text-sm font-medium">Cost by Model (Top 10)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={modelData.slice(0, 10)} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis type="number" className="text-xs" tick={{ fontSize: 10 }} />
                  <YAxis
                    dataKey="name"
                    type="category"
                    width={120}
                    className="text-xs"
                    tick={{ fontSize: 10 }}
                  />
                  <Tooltip
                    formatter={(value: number) => [`$${value.toFixed(4)}`, 'Cost']}
                    contentStyle={{
                      backgroundColor: 'hsl(var(--card))',
                      border: '1px solid hsl(var(--border))',
                    }}
                  />
                  <Bar dataKey="value" fill="#6366f1" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* AI Recommendations */}
      {insights && insights.length > 0 && (
        <InsightsList insights={insights} />
      )}
    </div>
  );
}
