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
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  DollarSign,
  TrendingUp,
  TrendingDown,
  Download,
  RefreshCw,
  PieChart,
  Loader2,
  Building2,
  Cpu,
  Server,
  Cloud,
  FileSpreadsheet,
  FileJson,
  FileText,
} from 'lucide-react';

// Types
interface RevenueSummary {
  periodStart: string;
  periodEnd: string;
  subscriptionRevenue: number;
  creditPurchaseRevenue: number;
  aiMarkupExternalRevenue: number;
  aiMarkupSelfHostedRevenue: number;
  overageRevenue: number;
  storageRevenue: number;
  otherRevenue: number;
  totalGrossRevenue: number;
  awsComputeCost: number;
  awsStorageCost: number;
  awsNetworkCost: number;
  awsDatabaseCost: number;
  externalAiCost: number;
  infrastructureCost: number;
  platformFeesCost: number;
  totalCost: number;
  grossProfit: number;
  grossMargin: number;
}

interface RevenueTrend {
  date: string;
  grossRevenue: number;
  totalCost: number;
  grossProfit: number;
  subscriptionRevenue: number;
  usageRevenue: number;
}

interface RevenueByTenant {
  tenantId: string;
  tenantName: string;
  subscriptionRevenue: number;
  usageRevenue: number;
  totalRevenue: number;
}

interface RevenueByModel {
  modelId: string;
  modelName: string;
  hostingType: 'external' | 'self_hosted';
  providerCost: number;
  customerCharge: number;
  markup: number;
  markupPercent: number;
  requestCount: number;
}

interface RevenueDashboard {
  summary: RevenueSummary;
  previousPeriodSummary: RevenueSummary;
  trends: RevenueTrend[];
  byTenant: RevenueByTenant[];
  byModel: RevenueByModel[];
  revenueChange: number;
  profitChange: number;
  marginChange: number;
}

type ExportFormat = 'csv' | 'json' | 'quickbooks_iif' | 'xero_csv' | 'sage_csv';

// Utility functions
function formatCurrency(value: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

function formatPercent(value: number): string {
  return `${value >= 0 ? '+' : ''}${value.toFixed(1)}%`;
}

function getDateRange(period: string): { start: Date; end: Date } {
  const end = new Date();
  const start = new Date();
  
  switch (period) {
    case '7d':
      start.setDate(end.getDate() - 7);
      break;
    case '30d':
      start.setDate(end.getDate() - 30);
      break;
    case '90d':
      start.setDate(end.getDate() - 90);
      break;
    case 'ytd':
      start.setMonth(0, 1);
      break;
    case '12m':
      start.setFullYear(end.getFullYear() - 1);
      break;
    default:
      start.setDate(end.getDate() - 30);
  }
  
  return { start, end };
}

export function RevenueClient() {
  const [timePeriod, setTimePeriod] = useState('30d');
  const [activeTab, setActiveTab] = useState('overview');
  const [isExporting, setIsExporting] = useState(false);

  const { start, end } = getDateRange(timePeriod);

  const { data: dashboard, isLoading, refetch } = useQuery<RevenueDashboard>({
    queryKey: ['revenue-dashboard', timePeriod],
    queryFn: async () => {
      const res = await fetch(`/api/admin/revenue/dashboard?periodStart=${start.toISOString()}&periodEnd=${end.toISOString()}&period=day`);
      if (!res.ok) throw new Error('Failed to fetch revenue dashboard');
      return res.json();
    },
  });

  const handleExport = async (format: ExportFormat) => {
    setIsExporting(true);
    try {
      const res = await fetch('/api/admin/revenue/export', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          format,
          periodStart: start.toISOString(),
          periodEnd: end.toISOString(),
          includeDetails: format === 'json',
        }),
      });
      
      if (!res.ok) throw new Error('Export failed');
      
      const data = await res.json();
      
      // Decode base64 and download
      const blob = new Blob([atob(data.data)], { type: data.mimeType });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = data.filename;
      a.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Export failed:', error);
    } finally {
      setIsExporting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const summary = dashboard?.summary;
  const totalAwsCost = (summary?.awsComputeCost || 0) + (summary?.awsStorageCost || 0) + 
    (summary?.awsNetworkCost || 0) + (summary?.awsDatabaseCost || 0);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
            <DollarSign className="h-8 w-8 text-green-600" />
            Revenue Analytics
          </h1>
          <p className="text-muted-foreground">
            Gross revenue, profits, and accounting exports
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Select value={timePeriod} onValueChange={setTimePeriod}>
            <SelectTrigger className="w-[150px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="7d">Last 7 days</SelectItem>
              <SelectItem value="30d">Last 30 days</SelectItem>
              <SelectItem value="90d">Last 90 days</SelectItem>
              <SelectItem value="ytd">Year to Date</SelectItem>
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
              <DropdownMenuItem onClick={() => handleExport('csv')}>
                <FileSpreadsheet className="mr-2 h-4 w-4" />
                CSV (Summary)
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleExport('json')}>
                <FileJson className="mr-2 h-4 w-4" />
                JSON (Full Details)
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleExport('quickbooks_iif')}>
                <FileText className="mr-2 h-4 w-4" />
                QuickBooks IIF
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleExport('xero_csv')}>
                <FileSpreadsheet className="mr-2 h-4 w-4" />
                Xero CSV
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleExport('sage_csv')}>
                <FileSpreadsheet className="mr-2 h-4 w-4" />
                Sage CSV
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          
          <Button variant="outline" onClick={() => refetch()}>
            <RefreshCw className="mr-2 h-4 w-4" />
            Refresh
          </Button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Gross Revenue</CardDescription>
            <CardTitle className="text-3xl text-green-600">
              {formatCurrency(summary?.totalGrossRevenue || 0)}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-1 text-sm">
              {(dashboard?.revenueChange || 0) >= 0 ? (
                <TrendingUp className="h-4 w-4 text-green-500" />
              ) : (
                <TrendingDown className="h-4 w-4 text-red-500" />
              )}
              <span className={(dashboard?.revenueChange || 0) >= 0 ? 'text-green-500' : 'text-red-500'}>
                {formatPercent(dashboard?.revenueChange || 0)}
              </span>
              <span className="text-muted-foreground">vs last period</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Total COGS</CardDescription>
            <CardTitle className="text-3xl text-red-600">
              {formatCurrency(summary?.totalCost || 0)}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-sm text-muted-foreground">
              AWS + External AI + Platform Fees
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Gross Profit</CardDescription>
            <CardTitle className="text-3xl">
              {formatCurrency(summary?.grossProfit || 0)}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-1 text-sm">
              {(dashboard?.profitChange || 0) >= 0 ? (
                <TrendingUp className="h-4 w-4 text-green-500" />
              ) : (
                <TrendingDown className="h-4 w-4 text-red-500" />
              )}
              <span className={(dashboard?.profitChange || 0) >= 0 ? 'text-green-500' : 'text-red-500'}>
                {formatPercent(dashboard?.profitChange || 0)}
              </span>
              <span className="text-muted-foreground">vs last period</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Gross Margin</CardDescription>
            <CardTitle className="text-3xl">
              {(summary?.grossMargin || 0).toFixed(1)}%
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-1 text-sm">
              {(dashboard?.marginChange || 0) >= 0 ? (
                <TrendingUp className="h-4 w-4 text-green-500" />
              ) : (
                <TrendingDown className="h-4 w-4 text-red-500" />
              )}
              <span className={(dashboard?.marginChange || 0) >= 0 ? 'text-green-500' : 'text-red-500'}>
                {formatPercent(dashboard?.marginChange || 0)} pts
              </span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Accounting Note */}
      <Card className="bg-amber-50 border-amber-200">
        <CardContent className="py-3">
          <p className="text-sm text-amber-800">
            <strong>Note:</strong> These figures represent <strong>gross revenue and COGS-level costs only</strong>. 
            Marketing, sales, G&A, and other operating expenses must be subtracted separately in your accounting system 
            to calculate net profit.
          </p>
        </CardContent>
      </Card>

      {/* Main Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="overview">Revenue Breakdown</TabsTrigger>
          <TabsTrigger value="costs">Cost Breakdown</TabsTrigger>
          <TabsTrigger value="models">By Model</TabsTrigger>
          <TabsTrigger value="tenants">By Tenant</TabsTrigger>
        </TabsList>

        {/* Revenue Breakdown Tab */}
        <TabsContent value="overview" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <PieChart className="h-5 w-5" />
                  Revenue by Source
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <RevenueRow 
                    label="Subscription Revenue" 
                    value={summary?.subscriptionRevenue || 0}
                    total={summary?.totalGrossRevenue || 1}
                    color="bg-blue-500"
                  />
                  <RevenueRow 
                    label="Credit Purchases" 
                    value={summary?.creditPurchaseRevenue || 0}
                    total={summary?.totalGrossRevenue || 1}
                    color="bg-green-500"
                  />
                  <RevenueRow 
                    label="AI Markup (External)" 
                    value={summary?.aiMarkupExternalRevenue || 0}
                    total={summary?.totalGrossRevenue || 1}
                    color="bg-purple-500"
                  />
                  <RevenueRow 
                    label="AI Markup (Self-Hosted)" 
                    value={summary?.aiMarkupSelfHostedRevenue || 0}
                    total={summary?.totalGrossRevenue || 1}
                    color="bg-orange-500"
                  />
                  <RevenueRow 
                    label="Overage Charges" 
                    value={summary?.overageRevenue || 0}
                    total={summary?.totalGrossRevenue || 1}
                    color="bg-yellow-500"
                  />
                  <RevenueRow 
                    label="Storage Revenue" 
                    value={summary?.storageRevenue || 0}
                    total={summary?.totalGrossRevenue || 1}
                    color="bg-cyan-500"
                  />
                  <RevenueRow 
                    label="Other" 
                    value={summary?.otherRevenue || 0}
                    total={summary?.totalGrossRevenue || 1}
                    color="bg-gray-500"
                  />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Revenue Metrics</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex justify-between items-center p-3 bg-muted rounded-lg">
                    <span className="text-sm font-medium">Subscription %</span>
                    <span className="text-lg font-bold">
                      {((summary?.subscriptionRevenue || 0) / (summary?.totalGrossRevenue || 1) * 100).toFixed(1)}%
                    </span>
                  </div>
                  <div className="flex justify-between items-center p-3 bg-muted rounded-lg">
                    <span className="text-sm font-medium">Usage Revenue %</span>
                    <span className="text-lg font-bold">
                      {(((summary?.aiMarkupExternalRevenue || 0) + (summary?.aiMarkupSelfHostedRevenue || 0) + 
                        (summary?.overageRevenue || 0)) / (summary?.totalGrossRevenue || 1) * 100).toFixed(1)}%
                    </span>
                  </div>
                  <div className="flex justify-between items-center p-3 bg-muted rounded-lg">
                    <span className="text-sm font-medium">Self-Hosted Revenue Share</span>
                    <span className="text-lg font-bold">
                      {((summary?.aiMarkupSelfHostedRevenue || 0) / 
                        ((summary?.aiMarkupExternalRevenue || 0) + (summary?.aiMarkupSelfHostedRevenue || 1)) * 100).toFixed(1)}%
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Cost Breakdown Tab */}
        <TabsContent value="costs" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Server className="h-5 w-5" />
                  AWS Costs
                </CardTitle>
                <CardDescription>
                  Total: {formatCurrency(totalAwsCost)}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <CostRow label="Compute (EC2, SageMaker, Lambda)" value={summary?.awsComputeCost || 0} />
                  <CostRow label="Storage (S3, EBS)" value={summary?.awsStorageCost || 0} />
                  <CostRow label="Network (Data Transfer, API GW)" value={summary?.awsNetworkCost || 0} />
                  <CostRow label="Database (Aurora, DynamoDB)" value={summary?.awsDatabaseCost || 0} />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Cloud className="h-5 w-5" />
                  External AI Provider Costs
                </CardTitle>
                <CardDescription>
                  Total: {formatCurrency(summary?.externalAiCost || 0)}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <CostRow label="External AI Providers" value={summary?.externalAiCost || 0} />
                  <CostRow label="Infrastructure (Other)" value={summary?.infrastructureCost || 0} />
                  <CostRow label="Platform Fees (Stripe, etc.)" value={summary?.platformFeesCost || 0} />
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* By Model Tab */}
        <TabsContent value="models" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Cpu className="h-5 w-5" />
                Revenue by Model
              </CardTitle>
              <CardDescription>
                Provider cost vs. customer charge with markup
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Model</TableHead>
                    <TableHead>Hosting</TableHead>
                    <TableHead className="text-right">Provider Cost</TableHead>
                    <TableHead className="text-right">Customer Charge</TableHead>
                    <TableHead className="text-right">Markup</TableHead>
                    <TableHead className="text-right">Requests</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {dashboard?.byModel?.map((model) => (
                    <TableRow key={model.modelId}>
                      <TableCell>
                        <div>
                          <p className="font-medium">{model.modelName}</p>
                          <p className="text-xs text-muted-foreground font-mono">{model.modelId}</p>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant={model.hostingType === 'self_hosted' ? 'default' : 'outline'}>
                          {model.hostingType === 'self_hosted' ? (
                            <><Server className="h-3 w-3 mr-1" />Self-Hosted</>
                          ) : (
                            <><Cloud className="h-3 w-3 mr-1" />External</>
                          )}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right text-red-600">
                        {formatCurrency(model.providerCost)}
                      </TableCell>
                      <TableCell className="text-right text-green-600">
                        {formatCurrency(model.customerCharge)}
                      </TableCell>
                      <TableCell className="text-right">
                        <div>
                          <span className="font-medium">{formatCurrency(model.markup)}</span>
                          <span className="text-xs text-muted-foreground ml-1">
                            ({model.markupPercent.toFixed(0)}%)
                          </span>
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        {model.requestCount.toLocaleString()}
                      </TableCell>
                    </TableRow>
                  ))}
                  {(!dashboard?.byModel || dashboard.byModel.length === 0) && (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                        No model revenue data for this period
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* By Tenant Tab */}
        <TabsContent value="tenants" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Building2 className="h-5 w-5" />
                Revenue by Tenant
              </CardTitle>
              <CardDescription>
                Top tenants by total revenue
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Tenant</TableHead>
                    <TableHead className="text-right">Subscription</TableHead>
                    <TableHead className="text-right">Usage</TableHead>
                    <TableHead className="text-right">Total Revenue</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {dashboard?.byTenant?.map((tenant) => (
                    <TableRow key={tenant.tenantId}>
                      <TableCell>
                        <div>
                          <p className="font-medium">{tenant.tenantName}</p>
                          <p className="text-xs text-muted-foreground font-mono">{tenant.tenantId}</p>
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        {formatCurrency(tenant.subscriptionRevenue)}
                      </TableCell>
                      <TableCell className="text-right">
                        {formatCurrency(tenant.usageRevenue)}
                      </TableCell>
                      <TableCell className="text-right font-bold text-green-600">
                        {formatCurrency(tenant.totalRevenue)}
                      </TableCell>
                    </TableRow>
                  ))}
                  {(!dashboard?.byTenant || dashboard.byTenant.length === 0) && (
                    <TableRow>
                      <TableCell colSpan={4} className="text-center text-muted-foreground py-8">
                        No tenant revenue data for this period
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

// Helper Components
function RevenueRow({ 
  label, 
  value, 
  total, 
  color 
}: { 
  label: string; 
  value: number; 
  total: number; 
  color: string;
}) {
  const percent = (value / total) * 100;
  
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-sm">
        <span>{label}</span>
        <span className="font-medium">{formatCurrency(value)}</span>
      </div>
      <div className="h-2 bg-muted rounded-full overflow-hidden">
        <div 
          className={`h-full ${color} rounded-full`} 
          style={{ width: `${Math.min(percent, 100)}%` }}
        />
      </div>
      <div className="text-xs text-muted-foreground text-right">
        {percent.toFixed(1)}%
      </div>
    </div>
  );
}

function CostRow({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex justify-between items-center py-2 border-b last:border-0">
      <span className="text-sm">{label}</span>
      <span className="font-medium text-red-600">{formatCurrency(value)}</span>
    </div>
  );
}
