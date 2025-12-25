'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { 
  CreditCard, 
  DollarSign, 
  Users, 
  TrendingUp,
  Package,
  Zap,
  ArrowUpRight,
  ArrowDownRight,
  RefreshCw
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

interface SubscriptionTier {
  id: string;
  displayName: string;
  priceMonthly: number | null;
  priceAnnual: number | null;
  includedCreditsPerUser: number;
  features: Record<string, unknown>;
}

interface Subscription {
  id: string;
  tierId: string;
  status: string;
  billingCycle: string;
  seatsPurchased: number;
  seatsUsed: number;
  currentPeriodEnd: string;
}

interface CreditBalance {
  balance: number;
  lifetimePurchased: number;
  lifetimeUsed: number;
  lifetimeBonus: number;
}

interface Transaction {
  id: string;
  transaction_type: string;
  amount: number;
  balance_after: number;
  description: string;
  created_at: string;
}

export function BillingClient() {
  const [activeTab, setActiveTab] = useState('overview');
  const queryClient = useQueryClient();

  const { data: tiers, isLoading: tiersLoading } = useQuery<SubscriptionTier[]>({
    queryKey: ['billing', 'tiers'],
    queryFn: async () => {
      const res = await apiClient.get<{ tiers: SubscriptionTier[] }>('/billing/tiers');
      return res.tiers;
    },
  });

  const { data: subscription } = useQuery<Subscription | null>({
    queryKey: ['billing', 'subscription'],
    queryFn: async () => {
      const res = await apiClient.get<{ subscription: Subscription | null }>('/billing/subscription');
      return res.subscription;
    },
  });

  const { data: credits } = useQuery<CreditBalance>({
    queryKey: ['billing', 'credits'],
    queryFn: async () => {
      return apiClient.get<CreditBalance>('/billing/credits');
    },
  });

  const { data: transactions } = useQuery<Transaction[]>({
    queryKey: ['billing', 'transactions'],
    queryFn: async () => {
      const res = await apiClient.get<{ transactions: Transaction[] }>('/billing/transactions');
      return res.transactions;
    },
  });

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(value);
  };

  const formatCredits = (value: number) => {
    return value.toLocaleString(undefined, { maximumFractionDigits: 2 });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Billing & Credits</h1>
          <p className="text-muted-foreground">
            Manage subscriptions, credits, and billing
          </p>
        </div>
        <Button variant="outline" onClick={() => queryClient.invalidateQueries({ queryKey: ['billing'] })}>
          <RefreshCw className="mr-2 h-4 w-4" />
          Refresh
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Credit Balance</CardTitle>
            <Zap className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCredits(credits?.balance ?? 0)}</div>
            <p className="text-xs text-muted-foreground">
              Credits available
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Lifetime Purchased</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCredits(credits?.lifetimePurchased ?? 0)}</div>
            <p className="text-xs text-muted-foreground">
              Total credits purchased
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Lifetime Used</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCredits(credits?.lifetimeUsed ?? 0)}</div>
            <p className="text-xs text-muted-foreground">
              Total credits consumed
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Bonus Credits</CardTitle>
            <Package className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCredits(credits?.lifetimeBonus ?? 0)}</div>
            <p className="text-xs text-muted-foreground">
              Earned from volume purchases
            </p>
          </CardContent>
        </Card>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="tiers">Subscription Tiers</TabsTrigger>
          <TabsTrigger value="transactions">Transactions</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Current Subscription</CardTitle>
              <CardDescription>Your active subscription details</CardDescription>
            </CardHeader>
            <CardContent>
              {subscription ? (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium">{subscription.tierId}</p>
                      <p className="text-sm text-muted-foreground">
                        {subscription.billingCycle} billing
                      </p>
                    </div>
                    <Badge variant={subscription.status === 'active' ? 'default' : 'secondary'}>
                      {subscription.status}
                    </Badge>
                  </div>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <p className="text-muted-foreground">Seats Used</p>
                      <p className="font-medium">{subscription.seatsUsed} / {subscription.seatsPurchased}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Period Ends</p>
                      <p className="font-medium">
                        {new Date(subscription.currentPeriodEnd).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                </div>
              ) : (
                <p className="text-muted-foreground">No active subscription</p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="tiers" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {tiers?.map((tier) => (
              <Card key={tier.id} className={subscription?.tierId === tier.id ? 'border-primary' : ''}>
                <CardHeader>
                  <CardTitle className="flex items-center justify-between">
                    {tier.displayName}
                    {subscription?.tierId === tier.id && (
                      <Badge>Current</Badge>
                    )}
                  </CardTitle>
                  <CardDescription>
                    {tier.priceMonthly !== null ? (
                      <span className="text-2xl font-bold">{formatCurrency(tier.priceMonthly)}</span>
                    ) : (
                      <span className="text-lg font-medium">Contact Sales</span>
                    )}
                    {tier.priceMonthly !== null && <span className="text-muted-foreground">/month</span>}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2 text-sm">
                    <div className="flex items-center gap-2">
                      <Zap className="h-4 w-4 text-yellow-500" />
                      <span>{tier.includedCreditsPerUser} credits/user/month</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="transactions" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Transaction History</CardTitle>
              <CardDescription>Recent credit transactions</CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Description</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                    <TableHead className="text-right">Balance</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {transactions?.map((tx) => (
                    <TableRow key={tx.id}>
                      <TableCell>{new Date(tx.created_at).toLocaleDateString()}</TableCell>
                      <TableCell>
                        <Badge variant={tx.amount >= 0 ? 'default' : 'secondary'}>
                          {tx.transaction_type}
                        </Badge>
                      </TableCell>
                      <TableCell>{tx.description || '-'}</TableCell>
                      <TableCell className="text-right">
                        <span className={tx.amount >= 0 ? 'text-green-600' : 'text-red-600'}>
                          {tx.amount >= 0 ? '+' : ''}{formatCredits(tx.amount)}
                        </span>
                      </TableCell>
                      <TableCell className="text-right">{formatCredits(tx.balance_after)}</TableCell>
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
