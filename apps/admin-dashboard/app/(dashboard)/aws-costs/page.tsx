'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  DollarSign, 
  TrendingUp, 
  TrendingDown,
  Server,
  Database,
  Cpu,
  HardDrive,
  RefreshCw,
  AlertTriangle,
  Cloud,
} from 'lucide-react';

interface CostData {
  total_cost: number;
  previous_period_cost: number;
  change_percent: number;
  budget: number;
  forecast: number;
  by_service: {
    service: string;
    cost: number;
    percent_of_total: number;
  }[];
  by_tenant: {
    tenant_id: string;
    tenant_name: string;
    cost: number;
  }[];
  daily_costs: {
    date: string;
    cost: number;
  }[];
}

async function fetchCostData(period: string): Promise<CostData> {
  const res = await fetch(`/api/admin/aws-costs?period=${period}`);
  if (!res.ok) throw new Error('Failed to fetch cost data');
  return res.json();
}

export default function AWSCostsPage() {
  const [period, setPeriod] = useState('30d');

  const { data: costData, isLoading } = useQuery({
    queryKey: ['aws-costs', period],
    queryFn: () => fetchCostData(period),
  });

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
    }).format(amount);
  };

  const getServiceIcon = (service: string) => {
    const lower = service.toLowerCase();
    if (lower.includes('ec2') || lower.includes('sagemaker')) return <Cpu className="h-4 w-4" />;
    if (lower.includes('rds') || lower.includes('aurora')) return <Database className="h-4 w-4" />;
    if (lower.includes('s3')) return <HardDrive className="h-4 w-4" />;
    if (lower.includes('lambda')) return <Server className="h-4 w-4" />;
    return <Cloud className="h-4 w-4" />;
  };

  const budgetUsedPercent = costData ? (costData.total_cost / costData.budget) * 100 : 0;
  const isOverBudget = budgetUsedPercent > 100;
  const isNearBudget = budgetUsedPercent > 80;

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
            <DollarSign className="h-8 w-8" />
            AWS Costs
          </h1>
          <p className="text-muted-foreground mt-1">
            Monitor and analyze AWS infrastructure costs
          </p>
        </div>
        <Select value={period} onValueChange={setPeriod}>
          <SelectTrigger className="w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="7d">Last 7 days</SelectItem>
            <SelectItem value="30d">Last 30 days</SelectItem>
            <SelectItem value="90d">Last 90 days</SelectItem>
            <SelectItem value="mtd">Month to Date</SelectItem>
            <SelectItem value="ytd">Year to Date</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Total Cost</CardDescription>
            <CardTitle className="text-3xl">{formatCurrency(costData?.total_cost || 0)}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-1 text-sm">
              {(costData?.change_percent || 0) > 0 ? (
                <>
                  <TrendingUp className="h-4 w-4 text-red-500" />
                  <span className="text-red-500">+{costData?.change_percent.toFixed(1)}%</span>
                </>
              ) : (
                <>
                  <TrendingDown className="h-4 w-4 text-green-500" />
                  <span className="text-green-500">{costData?.change_percent.toFixed(1)}%</span>
                </>
              )}
              <span className="text-muted-foreground">vs previous period</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Monthly Budget</CardDescription>
            <CardTitle className="text-3xl">{formatCurrency(costData?.budget || 0)}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <Progress 
                value={Math.min(budgetUsedPercent, 100)} 
                className={isOverBudget ? 'bg-red-200' : isNearBudget ? 'bg-orange-200' : ''}
              />
              <div className="flex items-center justify-between text-sm">
                <span className={isOverBudget ? 'text-red-500' : isNearBudget ? 'text-orange-500' : 'text-muted-foreground'}>
                  {budgetUsedPercent.toFixed(1)}% used
                </span>
                {isOverBudget && <AlertTriangle className="h-4 w-4 text-red-500" />}
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Forecast (Month End)</CardDescription>
            <CardTitle className="text-3xl">{formatCurrency(costData?.forecast || 0)}</CardTitle>
          </CardHeader>
          <CardContent>
            {(costData?.forecast || 0) > (costData?.budget || 0) ? (
              <Badge variant="destructive">Over Budget Projection</Badge>
            ) : (
              <Badge className="bg-green-500">Within Budget</Badge>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Daily Average</CardDescription>
            <CardTitle className="text-3xl">
              {formatCurrency((costData?.total_cost || 0) / (period === '7d' ? 7 : period === '30d' ? 30 : 90))}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <span className="text-sm text-muted-foreground">Per day</span>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="services" className="space-y-4">
        <TabsList>
          <TabsTrigger value="services">By Service</TabsTrigger>
          <TabsTrigger value="tenants">By Tenant</TabsTrigger>
          <TabsTrigger value="trends">Cost Trends</TabsTrigger>
        </TabsList>

        <TabsContent value="services" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Cost by AWS Service</CardTitle>
              <CardDescription>Breakdown of costs by service type</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {costData?.by_service?.map((service, i) => (
                  <div key={i} className="space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        {getServiceIcon(service.service)}
                        <span className="font-medium">{service.service}</span>
                      </div>
                      <div className="flex items-center gap-4">
                        <span className="text-sm text-muted-foreground">
                          {service.percent_of_total.toFixed(1)}%
                        </span>
                        <span className="font-medium">{formatCurrency(service.cost)}</span>
                      </div>
                    </div>
                    <Progress value={service.percent_of_total} className="h-2" />
                  </div>
                )) || (
                  <div className="text-center py-8 text-muted-foreground">
                    No service cost data available
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="tenants" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Cost by Tenant</CardTitle>
              <CardDescription>Multi-tenant cost allocation</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {costData?.by_tenant?.map((tenant, i) => {
                  const percent = ((tenant.cost / (costData?.total_cost || 1)) * 100);
                  return (
                    <div key={i} className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="font-medium">{tenant.tenant_name}</span>
                        <div className="flex items-center gap-4">
                          <span className="text-sm text-muted-foreground">
                            {percent.toFixed(1)}%
                          </span>
                          <span className="font-medium">{formatCurrency(tenant.cost)}</span>
                        </div>
                      </div>
                      <Progress value={percent} className="h-2" />
                    </div>
                  );
                }) || (
                  <div className="text-center py-8 text-muted-foreground">
                    No tenant cost data available
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="trends" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Daily Cost Trend</CardTitle>
              <CardDescription>Cost variation over time</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-[300px] flex items-center justify-center text-muted-foreground">
                <div className="text-center">
                  <TrendingUp className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>Cost trend visualization</p>
                  <p className="text-sm">Integrate with recharts for detailed graphs</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
