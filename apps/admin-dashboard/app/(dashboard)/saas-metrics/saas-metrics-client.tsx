'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';
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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  AreaChart,
  Area,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  ComposedChart,
} from 'recharts';
import {
  DollarSign,
  TrendingUp,
  TrendingDown,
  Users,
  CreditCard,
  Activity,
  Download,
  RefreshCw,
  Loader2,
  BarChart3,
  PieChart as PieChartIcon,
  Target,
  Percent,
  ArrowUpRight,
  ArrowDownRight,
  Calendar,
  FileSpreadsheet,
  FileText,
  Building2,
  Zap,
  Server,
  Cloud,
  Clock,
  CheckCircle,
  AlertTriangle,
} from 'lucide-react';

// Color palette for charts
const CHART_COLORS = {
  primary: '#3b82f6',
  secondary: '#8b5cf6',
  success: '#22c55e',
  warning: '#f59e0b',
  danger: '#ef4444',
  info: '#06b6d4',
  muted: '#6b7280',
};

const PIE_COLORS = ['#3b82f6', '#8b5cf6', '#22c55e', '#f59e0b', '#ef4444', '#06b6d4', '#ec4899', '#14b8a6'];

// Types
interface SaaSMetrics {
  // Revenue Metrics
  mrr: number;
  mrrGrowth: number;
  arr: number;
  arrGrowth: number;
  totalRevenue: number;
  revenueGrowth: number;
  
  // Cost Metrics
  totalCost: number;
  costGrowth: number;
  grossProfit: number;
  grossMargin: number;
  
  // Customer Metrics
  totalCustomers: number;
  newCustomers: number;
  churnedCustomers: number;
  churnRate: number;
  customerGrowth: number;
  
  // Usage Metrics
  activeUsers: number;
  totalRequests: number;
  requestsGrowth: number;
  avgRequestsPerUser: number;
  
  // Unit Economics
  arpu: number;
  arpuGrowth: number;
  ltv: number;
  cac: number;
  ltvCacRatio: number;
  
  // Revenue Breakdown
  revenueBySource: Array<{ name: string; value: number; color: string }>;
  revenueByTier: Array<{ tier: string; revenue: number; customers: number }>;
  revenueByProduct: Array<{ product: string; revenue: number; percentage: number }>;
  
  // Cost Breakdown
  costByCategory: Array<{ category: string; amount: number; percentage: number }>;
  
  // Time Series
  revenueTrend: Array<{ date: string; revenue: number; cost: number; profit: number }>;
  customerTrend: Array<{ date: string; total: number; new: number; churned: number }>;
  usageTrend: Array<{ date: string; requests: number; activeUsers: number }>;
  mrrTrend: Array<{ date: string; mrr: number; newMrr: number; churnMrr: number; expansionMrr: number }>;
  
  // Top Tenants
  topTenants: Array<{
    id: string;
    name: string;
    revenue: number;
    users: number;
    requests: number;
    tier: string;
  }>;
  
  // Model Performance
  modelMetrics: Array<{
    model: string;
    requests: number;
    revenue: number;
    cost: number;
    profit: number;
    margin: number;
  }>;
}

// Sample data generator
function generateSampleData(period: string): SaaSMetrics {
  const multiplier = period === '7d' ? 0.25 : period === '30d' ? 1 : period === '90d' ? 3 : 12;
  
  return {
    mrr: 89500 * (1 + Math.random() * 0.1),
    mrrGrowth: 12.5 + Math.random() * 5,
    arr: 1074000 * (1 + Math.random() * 0.1),
    arrGrowth: 15.2 + Math.random() * 5,
    totalRevenue: 89500 * multiplier,
    revenueGrowth: 18.3 + Math.random() * 5,
    
    totalCost: 42000 * multiplier,
    costGrowth: 8.5 + Math.random() * 3,
    grossProfit: 47500 * multiplier,
    grossMargin: 53.1 + Math.random() * 5,
    
    totalCustomers: 342,
    newCustomers: Math.floor(28 * multiplier / 4),
    churnedCustomers: Math.floor(8 * multiplier / 4),
    churnRate: 2.3 + Math.random(),
    customerGrowth: 5.8 + Math.random() * 2,
    
    activeUsers: 2847,
    totalRequests: Math.floor(1250000 * multiplier),
    requestsGrowth: 24.5 + Math.random() * 10,
    avgRequestsPerUser: 439,
    
    arpu: 261.70 + Math.random() * 20,
    arpuGrowth: 8.2 + Math.random() * 3,
    ltv: 3140.40 + Math.random() * 200,
    cac: 450 + Math.random() * 50,
    ltvCacRatio: 6.98 + Math.random(),
    
    revenueBySource: [
      { name: 'Subscriptions', value: 62500, color: CHART_COLORS.primary },
      { name: 'Credit Purchases', value: 12500, color: CHART_COLORS.secondary },
      { name: 'AI Markup (External)', value: 9800, color: CHART_COLORS.success },
      { name: 'AI Markup (Self-Hosted)', value: 4200, color: CHART_COLORS.warning },
      { name: 'Storage', value: 500, color: CHART_COLORS.info },
    ],
    
    revenueByTier: [
      { tier: 'Enterprise', revenue: 45000, customers: 12 },
      { tier: 'Business', revenue: 28500, customers: 45 },
      { tier: 'Pro', revenue: 12800, customers: 128 },
      { tier: 'Starter', revenue: 3200, customers: 157 },
    ],
    
    revenueByProduct: [
      { product: 'Think Tank', revenue: 58000, percentage: 64.8 },
      { product: 'Radiant API', revenue: 24500, percentage: 27.4 },
      { product: 'Self-Hosted Models', revenue: 7000, percentage: 7.8 },
    ],
    
    costByCategory: [
      { category: 'External AI Providers', amount: 18500, percentage: 44.0 },
      { category: 'AWS Compute', amount: 12800, percentage: 30.5 },
      { category: 'AWS Database', amount: 4200, percentage: 10.0 },
      { category: 'AWS Storage', amount: 2100, percentage: 5.0 },
      { category: 'Platform Fees', amount: 2600, percentage: 6.2 },
      { category: 'Other Infrastructure', amount: 1800, percentage: 4.3 },
    ],
    
    revenueTrend: Array.from({ length: 30 }, (_, i) => ({
      date: new Date(Date.now() - (29 - i) * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      revenue: 2500 + Math.random() * 1500 + i * 30,
      cost: 1200 + Math.random() * 400 + i * 10,
      profit: 1300 + Math.random() * 700 + i * 20,
    })),
    
    customerTrend: Array.from({ length: 12 }, (_, i) => ({
      date: new Date(Date.now() - (11 - i) * 30 * 24 * 60 * 60 * 1000).toLocaleDateString('en-US', { month: 'short' }),
      total: 280 + i * 8 + Math.floor(Math.random() * 10),
      new: 20 + Math.floor(Math.random() * 15),
      churned: 5 + Math.floor(Math.random() * 5),
    })),
    
    usageTrend: Array.from({ length: 30 }, (_, i) => ({
      date: new Date(Date.now() - (29 - i) * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      requests: 35000 + Math.random() * 15000 + i * 500,
      activeUsers: 2500 + Math.random() * 500 + i * 10,
    })),
    
    mrrTrend: Array.from({ length: 12 }, (_, i) => ({
      date: new Date(Date.now() - (11 - i) * 30 * 24 * 60 * 60 * 1000).toLocaleDateString('en-US', { month: 'short' }),
      mrr: 65000 + i * 2200 + Math.random() * 1000,
      newMrr: 4500 + Math.random() * 2000,
      churnMrr: 1200 + Math.random() * 800,
      expansionMrr: 1800 + Math.random() * 1200,
    })),
    
    topTenants: [
      { id: '1', name: 'Acme Corporation', revenue: 8500, users: 145, requests: 125000, tier: 'Enterprise' },
      { id: '2', name: 'TechStart Inc', revenue: 6200, users: 89, requests: 98000, tier: 'Enterprise' },
      { id: '3', name: 'Global Solutions', revenue: 4800, users: 67, requests: 78000, tier: 'Business' },
      { id: '4', name: 'InnovateCo', revenue: 3900, users: 52, requests: 65000, tier: 'Business' },
      { id: '5', name: 'DataDrive Ltd', revenue: 3200, users: 41, requests: 52000, tier: 'Business' },
    ],
    
    modelMetrics: [
      { model: 'GPT-4o', requests: 425000, revenue: 12750, cost: 8500, profit: 4250, margin: 33.3 },
      { model: 'Claude 3.5 Sonnet', requests: 312000, revenue: 9360, cost: 6240, profit: 3120, margin: 33.3 },
      { model: 'GPT-4o-mini', requests: 285000, revenue: 2850, cost: 1425, profit: 1425, margin: 50.0 },
      { model: 'Self-Hosted Llama', requests: 156000, revenue: 4680, cost: 2340, profit: 2340, margin: 50.0 },
      { model: 'Gemini 1.5 Pro', requests: 72000, revenue: 3600, cost: 2400, profit: 1200, margin: 33.3 },
    ],
  };
}

// Utility functions
function formatCurrency(value: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
}

function formatNumber(value: number): string {
  if (value >= 1000000) return `${(value / 1000000).toFixed(1)}M`;
  if (value >= 1000) return `${(value / 1000).toFixed(1)}K`;
  return value.toFixed(0);
}

function formatPercent(value: number, showSign = true): string {
  const sign = showSign && value >= 0 ? '+' : '';
  return `${sign}${value.toFixed(1)}%`;
}

// Metric Card Component
function MetricCard({
  title,
  value,
  change,
  changeLabel = 'vs last period',
  icon: Icon,
  trend,
  format = 'currency',
  subtitle,
  color = 'blue',
}: {
  title: string;
  value: number;
  change?: number;
  changeLabel?: string;
  icon: React.ElementType;
  trend?: 'up' | 'down' | 'neutral';
  format?: 'currency' | 'number' | 'percent';
  subtitle?: string;
  color?: 'blue' | 'green' | 'purple' | 'amber' | 'red' | 'cyan';
}) {
  const colorClasses = {
    blue: 'bg-blue-100 text-blue-600 dark:bg-blue-900/30',
    green: 'bg-green-100 text-green-600 dark:bg-green-900/30',
    purple: 'bg-purple-100 text-purple-600 dark:bg-purple-900/30',
    amber: 'bg-amber-100 text-amber-600 dark:bg-amber-900/30',
    red: 'bg-red-100 text-red-600 dark:bg-red-900/30',
    cyan: 'bg-cyan-100 text-cyan-600 dark:bg-cyan-900/30',
  };

  const formattedValue = format === 'currency' 
    ? formatCurrency(value) 
    : format === 'percent' 
    ? `${value.toFixed(1)}%` 
    : formatNumber(value);

  const isPositive = change !== undefined && change >= 0;
  const trendDirection = trend || (isPositive ? 'up' : 'down');

  return (
    <Card className="relative overflow-hidden">
      <CardContent className="pt-6">
        <div className="flex items-start justify-between">
          <div className="space-y-1">
            <p className="text-sm font-medium text-muted-foreground">{title}</p>
            <p className="text-3xl font-bold tracking-tight">{formattedValue}</p>
            {subtitle && (
              <p className="text-xs text-muted-foreground">{subtitle}</p>
            )}
            {change !== undefined && (
              <div className="flex items-center gap-1 text-sm">
                {trendDirection === 'up' ? (
                  <ArrowUpRight className="h-4 w-4 text-green-500" />
                ) : (
                  <ArrowDownRight className="h-4 w-4 text-red-500" />
                )}
                <span className={trendDirection === 'up' ? 'text-green-500' : 'text-red-500'}>
                  {formatPercent(change)}
                </span>
                <span className="text-muted-foreground">{changeLabel}</span>
              </div>
            )}
          </div>
          <div className={`p-3 rounded-xl ${colorClasses[color]}`}>
            <Icon className="h-6 w-6" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// Export functionality
async function exportToExcel(data: SaaSMetrics, period: string) {
  // Generate CSV content for Excel
  const sections = [];
  
  // Summary Section
  sections.push('RADIANT SaaS Metrics Report');
  sections.push(`Period: ${period}`);
  sections.push(`Generated: ${new Date().toISOString()}`);
  sections.push('');
  
  // Revenue Summary
  sections.push('=== REVENUE SUMMARY ===');
  sections.push('Metric,Value,Growth');
  sections.push(`MRR,$${data.mrr.toFixed(2)},${data.mrrGrowth.toFixed(1)}%`);
  sections.push(`ARR,$${data.arr.toFixed(2)},${data.arrGrowth.toFixed(1)}%`);
  sections.push(`Total Revenue,$${data.totalRevenue.toFixed(2)},${data.revenueGrowth.toFixed(1)}%`);
  sections.push(`Gross Profit,$${data.grossProfit.toFixed(2)},`);
  sections.push(`Gross Margin,${data.grossMargin.toFixed(1)}%,`);
  sections.push('');
  
  // Cost Summary
  sections.push('=== COST BREAKDOWN ===');
  sections.push('Category,Amount,Percentage');
  data.costByCategory.forEach(c => {
    sections.push(`${c.category},$${c.amount.toFixed(2)},${c.percentage.toFixed(1)}%`);
  });
  sections.push(`Total Cost,$${data.totalCost.toFixed(2)},100%`);
  sections.push('');
  
  // Customer Metrics
  sections.push('=== CUSTOMER METRICS ===');
  sections.push('Metric,Value');
  sections.push(`Total Customers,${data.totalCustomers}`);
  sections.push(`New Customers,${data.newCustomers}`);
  sections.push(`Churned Customers,${data.churnedCustomers}`);
  sections.push(`Churn Rate,${data.churnRate.toFixed(1)}%`);
  sections.push(`Active Users,${data.activeUsers}`);
  sections.push('');
  
  // Unit Economics
  sections.push('=== UNIT ECONOMICS ===');
  sections.push('Metric,Value');
  sections.push(`ARPU,$${data.arpu.toFixed(2)}`);
  sections.push(`LTV,$${data.ltv.toFixed(2)}`);
  sections.push(`CAC,$${data.cac.toFixed(2)}`);
  sections.push(`LTV:CAC Ratio,${data.ltvCacRatio.toFixed(2)}x`);
  sections.push('');
  
  // Revenue by Source
  sections.push('=== REVENUE BY SOURCE ===');
  sections.push('Source,Revenue');
  data.revenueBySource.forEach(s => {
    sections.push(`${s.name},$${s.value.toFixed(2)}`);
  });
  sections.push('');
  
  // Revenue by Tier
  sections.push('=== REVENUE BY TIER ===');
  sections.push('Tier,Revenue,Customers');
  data.revenueByTier.forEach(t => {
    sections.push(`${t.tier},$${t.revenue.toFixed(2)},${t.customers}`);
  });
  sections.push('');
  
  // Top Tenants
  sections.push('=== TOP TENANTS ===');
  sections.push('Name,Revenue,Users,Requests,Tier');
  data.topTenants.forEach(t => {
    sections.push(`${t.name},$${t.revenue.toFixed(2)},${t.users},${t.requests},${t.tier}`);
  });
  sections.push('');
  
  // Model Performance
  sections.push('=== MODEL PERFORMANCE ===');
  sections.push('Model,Requests,Revenue,Cost,Profit,Margin');
  data.modelMetrics.forEach(m => {
    sections.push(`${m.model},${m.requests},$${m.revenue.toFixed(2)},$${m.cost.toFixed(2)},$${m.profit.toFixed(2)},${m.margin.toFixed(1)}%`);
  });
  sections.push('');
  
  // Revenue Trend
  sections.push('=== DAILY REVENUE TREND ===');
  sections.push('Date,Revenue,Cost,Profit');
  data.revenueTrend.forEach(d => {
    sections.push(`${d.date},$${d.revenue.toFixed(2)},$${d.cost.toFixed(2)},$${d.profit.toFixed(2)}`);
  });
  
  const csvContent = sections.join('\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `radiant-saas-metrics-${period}-${new Date().toISOString().split('T')[0]}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

async function exportToJSON(data: SaaSMetrics, period: string) {
  const exportData = {
    reportType: 'SaaS Metrics',
    period,
    generatedAt: new Date().toISOString(),
    metrics: data,
  };
  
  const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `radiant-saas-metrics-${period}-${new Date().toISOString().split('T')[0]}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

export function SaaSMetricsClient() {
  const [period, setPeriod] = useState('30d');
  const [activeTab, setActiveTab] = useState('overview');
  const [isExporting, setIsExporting] = useState(false);

  const { data: metrics, isLoading, refetch } = useQuery<SaaSMetrics>({
    queryKey: ['saas-metrics', period],
    queryFn: async () => {
      // In production, fetch from API
      // const res = await fetch(`/api/admin/saas-metrics?period=${period}`);
      // return res.json();
      return generateSampleData(period);
    },
  });

  const handleExport = async (format: 'excel' | 'json') => {
    if (!metrics) return;
    setIsExporting(true);
    try {
      if (format === 'excel') {
        await exportToExcel(metrics, period);
      } else {
        await exportToJSON(metrics, period);
      }
    } finally {
      setIsExporting(false);
    }
  };

  if (isLoading || !metrics) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
            <BarChart3 className="h-8 w-8 text-blue-600" />
            SaaS Metrics Dashboard
          </h1>
          <p className="text-muted-foreground">
            Comprehensive view of revenue, costs, and business metrics
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Select value={period} onValueChange={setPeriod}>
            <SelectTrigger className="w-[140px]">
              <Calendar className="h-4 w-4 mr-2" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="7d">Last 7 days</SelectItem>
              <SelectItem value="30d">Last 30 days</SelectItem>
              <SelectItem value="90d">Last 90 days</SelectItem>
              <SelectItem value="12m">Last 12 months</SelectItem>
            </SelectContent>
          </Select>
          
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" disabled={isExporting}>
                {isExporting ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Download className="mr-2 h-4 w-4" />
                )}
                Export
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => handleExport('excel')}>
                <FileSpreadsheet className="mr-2 h-4 w-4 text-green-600" />
                Export to Excel (CSV)
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleExport('json')}>
                <FileText className="mr-2 h-4 w-4 text-blue-600" />
                Export to JSON
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          
          <Button variant="outline" onClick={() => refetch()}>
            <RefreshCw className="mr-2 h-4 w-4" />
            Refresh
          </Button>
        </div>
      </div>

      {/* Key Metrics Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
        <MetricCard
          title="MRR"
          value={metrics.mrr}
          change={metrics.mrrGrowth}
          icon={DollarSign}
          color="green"
        />
        <MetricCard
          title="ARR"
          value={metrics.arr}
          change={metrics.arrGrowth}
          icon={TrendingUp}
          color="blue"
        />
        <MetricCard
          title="Gross Margin"
          value={metrics.grossMargin}
          format="percent"
          icon={Percent}
          color="purple"
        />
        <MetricCard
          title="Customers"
          value={metrics.totalCustomers}
          change={metrics.customerGrowth}
          format="number"
          icon={Users}
          color="cyan"
        />
        <MetricCard
          title="Churn Rate"
          value={metrics.churnRate}
          format="percent"
          icon={AlertTriangle}
          color="amber"
          trend="down"
        />
        <MetricCard
          title="LTV:CAC"
          value={metrics.ltvCacRatio}
          format="number"
          subtitle={`${metrics.ltvCacRatio.toFixed(1)}x ratio`}
          icon={Target}
          color="green"
        />
      </div>

      {/* Main Content Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="revenue">Revenue</TabsTrigger>
          <TabsTrigger value="costs">Costs</TabsTrigger>
          <TabsTrigger value="customers">Customers</TabsTrigger>
          <TabsTrigger value="models">Models</TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview" className="space-y-6">
          {/* Revenue & Profit Trend */}
          <Card>
            <CardHeader>
              <CardTitle>Revenue, Cost & Profit Trend</CardTitle>
              <CardDescription>Daily breakdown over the selected period</CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={350}>
                <ComposedChart data={metrics.revenueTrend}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis 
                    dataKey="date" 
                    tick={{ fontSize: 12 }}
                    tickFormatter={(value) => new Date(value).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                  />
                  <YAxis 
                    tick={{ fontSize: 12 }}
                    tickFormatter={(value) => `$${(value / 1000).toFixed(0)}k`}
                  />
                  <Tooltip 
                    formatter={(value: number) => formatCurrency(value)}
                    labelFormatter={(label) => new Date(label).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
                  />
                  <Legend />
                  <Area
                    type="monotone"
                    dataKey="revenue"
                    fill={CHART_COLORS.primary}
                    fillOpacity={0.1}
                    stroke={CHART_COLORS.primary}
                    strokeWidth={2}
                    name="Revenue"
                  />
                  <Area
                    type="monotone"
                    dataKey="cost"
                    fill={CHART_COLORS.danger}
                    fillOpacity={0.1}
                    stroke={CHART_COLORS.danger}
                    strokeWidth={2}
                    name="Cost"
                  />
                  <Line
                    type="monotone"
                    dataKey="profit"
                    stroke={CHART_COLORS.success}
                    strokeWidth={3}
                    dot={false}
                    name="Profit"
                  />
                </ComposedChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* Quick Stats Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {/* Revenue by Source Pie */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <PieChartIcon className="h-5 w-5" />
                  Revenue by Source
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={250}>
                  <PieChart>
                    <Pie
                      data={metrics.revenueBySource}
                      dataKey="value"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      outerRadius={80}
                      innerRadius={50}
                      label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                      labelLine={false}
                    >
                      {metrics.revenueBySource.map((entry, index) => (
                        <Cell key={entry.name} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(value: number) => formatCurrency(value)} />
                  </PieChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            {/* Revenue by Tier */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <CreditCard className="h-5 w-5" />
                  Revenue by Tier
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={250}>
                  <BarChart data={metrics.revenueByTier} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                    <XAxis type="number" tickFormatter={(value) => `$${(value / 1000).toFixed(0)}k`} />
                    <YAxis type="category" dataKey="tier" width={80} tick={{ fontSize: 12 }} />
                    <Tooltip formatter={(value: number) => formatCurrency(value)} />
                    <Bar dataKey="revenue" fill={CHART_COLORS.primary} radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            {/* Cost Breakdown */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Server className="h-5 w-5" />
                  Cost Breakdown
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {metrics.costByCategory.map((cat, index) => (
                    <div key={cat.category} className="space-y-1">
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">{cat.category}</span>
                        <span className="font-medium">{formatCurrency(cat.amount)}</span>
                      </div>
                      <Progress 
                        value={cat.percentage} 
                        className="h-2"
                        style={{ 
                          // @ts-ignore
                          '--progress-color': PIE_COLORS[index % PIE_COLORS.length] 
                        }}
                      />
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Top Tenants */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Building2 className="h-5 w-5" />
                Top Tenants by Revenue
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Tenant</TableHead>
                    <TableHead>Tier</TableHead>
                    <TableHead className="text-right">Revenue</TableHead>
                    <TableHead className="text-right">Users</TableHead>
                    <TableHead className="text-right">Requests</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {metrics.topTenants.map((tenant, index) => (
                    <TableRow key={tenant.id}>
                      <TableCell className="font-medium">
                        <div className="flex items-center gap-2">
                          <span className="flex items-center justify-center w-6 h-6 rounded-full bg-muted text-xs font-bold">
                            {index + 1}
                          </span>
                          {tenant.name}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant={tenant.tier === 'Enterprise' ? 'default' : 'secondary'}>
                          {tenant.tier}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right font-medium text-green-600">
                        {formatCurrency(tenant.revenue)}
                      </TableCell>
                      <TableCell className="text-right">{tenant.users}</TableCell>
                      <TableCell className="text-right">{formatNumber(tenant.requests)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Revenue Tab */}
        <TabsContent value="revenue" className="space-y-6">
          <div className="grid grid-cols-4 gap-4">
            <MetricCard
              title="Total Revenue"
              value={metrics.totalRevenue}
              change={metrics.revenueGrowth}
              icon={DollarSign}
              color="green"
            />
            <MetricCard
              title="MRR"
              value={metrics.mrr}
              change={metrics.mrrGrowth}
              icon={TrendingUp}
              color="blue"
            />
            <MetricCard
              title="ARPU"
              value={metrics.arpu}
              change={metrics.arpuGrowth}
              icon={Users}
              color="purple"
            />
            <MetricCard
              title="LTV"
              value={metrics.ltv}
              icon={Target}
              color="cyan"
            />
          </div>

          {/* MRR Movement Chart */}
          <Card>
            <CardHeader>
              <CardTitle>MRR Movement</CardTitle>
              <CardDescription>New, Churned, and Expansion MRR over time</CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={350}>
                <BarChart data={metrics.mrrTrend}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis dataKey="date" />
                  <YAxis tickFormatter={(value) => `$${(value / 1000).toFixed(0)}k`} />
                  <Tooltip formatter={(value: number) => formatCurrency(value)} />
                  <Legend />
                  <Bar dataKey="newMrr" name="New MRR" fill={CHART_COLORS.success} stackId="stack" />
                  <Bar dataKey="expansionMrr" name="Expansion MRR" fill={CHART_COLORS.primary} stackId="stack" />
                  <Bar dataKey="churnMrr" name="Churned MRR" fill={CHART_COLORS.danger} stackId="stack" />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* Revenue by Product */}
          <Card>
            <CardHeader>
              <CardTitle>Revenue by Product</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {metrics.revenueByProduct.map((product) => (
                  <div key={product.product} className="space-y-2">
                    <div className="flex justify-between items-center">
                      <span className="font-medium">{product.product}</span>
                      <div className="text-right">
                        <span className="font-bold text-lg">{formatCurrency(product.revenue)}</span>
                        <span className="text-muted-foreground ml-2">({product.percentage}%)</span>
                      </div>
                    </div>
                    <Progress value={product.percentage} className="h-3" />
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Costs Tab */}
        <TabsContent value="costs" className="space-y-6">
          <div className="grid grid-cols-4 gap-4">
            <MetricCard
              title="Total COGS"
              value={metrics.totalCost}
              change={metrics.costGrowth}
              icon={Server}
              color="red"
              trend="down"
            />
            <MetricCard
              title="Gross Profit"
              value={metrics.grossProfit}
              icon={TrendingUp}
              color="green"
            />
            <MetricCard
              title="Gross Margin"
              value={metrics.grossMargin}
              format="percent"
              icon={Percent}
              color="purple"
            />
            <MetricCard
              title="CAC"
              value={metrics.cac}
              icon={CreditCard}
              color="amber"
            />
          </div>

          <div className="grid grid-cols-2 gap-6">
            {/* Cost Breakdown Pie */}
            <Card>
              <CardHeader>
                <CardTitle>Cost Distribution</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie
                      data={metrics.costByCategory}
                      dataKey="amount"
                      nameKey="category"
                      cx="50%"
                      cy="50%"
                      outerRadius={100}
                      innerRadius={60}
                      label={({ category, percentage }) => `${percentage.toFixed(0)}%`}
                    >
                      {metrics.costByCategory.map((entry, index) => (
                        <Cell key={entry.category} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(value: number) => formatCurrency(value)} />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            {/* Cost Details */}
            <Card>
              <CardHeader>
                <CardTitle>Cost Breakdown</CardTitle>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Category</TableHead>
                      <TableHead className="text-right">Amount</TableHead>
                      <TableHead className="text-right">%</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {metrics.costByCategory.map((cat) => (
                      <TableRow key={cat.category}>
                        <TableCell>{cat.category}</TableCell>
                        <TableCell className="text-right font-medium text-red-600">
                          {formatCurrency(cat.amount)}
                        </TableCell>
                        <TableCell className="text-right">{cat.percentage.toFixed(1)}%</TableCell>
                      </TableRow>
                    ))}
                    <TableRow className="font-bold border-t-2">
                      <TableCell>Total</TableCell>
                      <TableCell className="text-right text-red-600">
                        {formatCurrency(metrics.totalCost)}
                      </TableCell>
                      <TableCell className="text-right">100%</TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Customers Tab */}
        <TabsContent value="customers" className="space-y-6">
          <div className="grid grid-cols-4 gap-4">
            <MetricCard
              title="Total Customers"
              value={metrics.totalCustomers}
              change={metrics.customerGrowth}
              format="number"
              icon={Users}
              color="blue"
            />
            <MetricCard
              title="New Customers"
              value={metrics.newCustomers}
              format="number"
              icon={TrendingUp}
              color="green"
            />
            <MetricCard
              title="Churned"
              value={metrics.churnedCustomers}
              format="number"
              icon={TrendingDown}
              color="red"
            />
            <MetricCard
              title="Churn Rate"
              value={metrics.churnRate}
              format="percent"
              icon={AlertTriangle}
              color="amber"
            />
          </div>

          {/* Customer Trend */}
          <Card>
            <CardHeader>
              <CardTitle>Customer Growth Trend</CardTitle>
              <CardDescription>Total, new, and churned customers over time</CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={350}>
                <ComposedChart data={metrics.customerTrend}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis dataKey="date" />
                  <YAxis yAxisId="left" />
                  <YAxis yAxisId="right" orientation="right" />
                  <Tooltip />
                  <Legend />
                  <Area
                    yAxisId="left"
                    type="monotone"
                    dataKey="total"
                    fill={CHART_COLORS.primary}
                    fillOpacity={0.2}
                    stroke={CHART_COLORS.primary}
                    strokeWidth={2}
                    name="Total Customers"
                  />
                  <Bar yAxisId="right" dataKey="new" fill={CHART_COLORS.success} name="New" />
                  <Bar yAxisId="right" dataKey="churned" fill={CHART_COLORS.danger} name="Churned" />
                </ComposedChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* Usage Trend */}
          <Card>
            <CardHeader>
              <CardTitle>Usage Metrics</CardTitle>
              <CardDescription>API requests and active users over time</CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={metrics.usageTrend}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis 
                    dataKey="date"
                    tickFormatter={(value) => new Date(value).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                  />
                  <YAxis yAxisId="left" tickFormatter={(value) => formatNumber(value)} />
                  <YAxis yAxisId="right" orientation="right" />
                  <Tooltip 
                    formatter={(value: number, name: string) => [formatNumber(value), name]}
                    labelFormatter={(label) => new Date(label).toLocaleDateString()}
                  />
                  <Legend />
                  <Line
                    yAxisId="left"
                    type="monotone"
                    dataKey="requests"
                    stroke={CHART_COLORS.primary}
                    strokeWidth={2}
                    dot={false}
                    name="Requests"
                  />
                  <Line
                    yAxisId="right"
                    type="monotone"
                    dataKey="activeUsers"
                    stroke={CHART_COLORS.secondary}
                    strokeWidth={2}
                    dot={false}
                    name="Active Users"
                  />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Models Tab */}
        <TabsContent value="models" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Zap className="h-5 w-5" />
                Model Performance & Profitability
              </CardTitle>
              <CardDescription>
                Revenue, cost, and profit by AI model
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Model</TableHead>
                    <TableHead className="text-right">Requests</TableHead>
                    <TableHead className="text-right">Revenue</TableHead>
                    <TableHead className="text-right">Cost</TableHead>
                    <TableHead className="text-right">Profit</TableHead>
                    <TableHead className="text-right">Margin</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {metrics.modelMetrics.map((model) => (
                    <TableRow key={model.model}>
                      <TableCell className="font-medium">
                        <div className="flex items-center gap-2">
                          {model.model.includes('Self-Hosted') ? (
                            <Server className="h-4 w-4 text-orange-500" />
                          ) : (
                            <Cloud className="h-4 w-4 text-blue-500" />
                          )}
                          {model.model}
                        </div>
                      </TableCell>
                      <TableCell className="text-right">{formatNumber(model.requests)}</TableCell>
                      <TableCell className="text-right text-green-600 font-medium">
                        {formatCurrency(model.revenue)}
                      </TableCell>
                      <TableCell className="text-right text-red-600">
                        {formatCurrency(model.cost)}
                      </TableCell>
                      <TableCell className="text-right font-bold">
                        {formatCurrency(model.profit)}
                      </TableCell>
                      <TableCell className="text-right">
                        <Badge variant={model.margin >= 40 ? 'default' : 'secondary'}>
                          {model.margin.toFixed(1)}%
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          {/* Model Revenue Chart */}
          <Card>
            <CardHeader>
              <CardTitle>Model Revenue vs Cost</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={metrics.modelMetrics} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis type="number" tickFormatter={(value) => `$${(value / 1000).toFixed(0)}k`} />
                  <YAxis type="category" dataKey="model" width={120} tick={{ fontSize: 12 }} />
                  <Tooltip formatter={(value: number) => formatCurrency(value)} />
                  <Legend />
                  <Bar dataKey="revenue" name="Revenue" fill={CHART_COLORS.success} />
                  <Bar dataKey="cost" name="Cost" fill={CHART_COLORS.danger} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
