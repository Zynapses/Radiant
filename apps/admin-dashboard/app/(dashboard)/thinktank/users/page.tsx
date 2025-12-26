'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
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
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import {
  Search,
  Download,
  UserX,
  Mail,
  Users,
  TrendingUp,
  DollarSign,
  Crown,
  MoreHorizontal,
  Eye,
  Ban,
  RefreshCw,
  Filter,
  UserCheck,
  Clock,
  Activity,
  ChevronRight,
} from 'lucide-react';
import { formatDistanceToNow, format } from 'date-fns';

interface ThinkTankUser {
  id: string;
  email: string;
  display_name: string | null;
  language: string;
  subscription_tier: 'free' | 'pro' | 'team' | 'enterprise';
  conversation_count: number;
  total_tokens_used: number;
  total_spent: number;
  last_active_at: string | null;
  status: 'active' | 'suspended' | 'inactive';
}

interface UserStats {
  totalUsers: number;
  activeUsers7d: number;
  paidUsers: number;
  totalRevenue: number;
}

const tierConfig: Record<string, { bg: string; text: string; icon: string }> = {
  free: { bg: 'bg-slate-100 dark:bg-slate-800', text: 'text-slate-700 dark:text-slate-300', icon: '🆓' },
  pro: { bg: 'bg-blue-100 dark:bg-blue-900/50', text: 'text-blue-700 dark:text-blue-300', icon: '⭐' },
  team: { bg: 'bg-purple-100 dark:bg-purple-900/50', text: 'text-purple-700 dark:text-purple-300', icon: '👥' },
  enterprise: { bg: 'bg-amber-100 dark:bg-amber-900/50', text: 'text-amber-700 dark:text-amber-300', icon: '👑' },
};

const statusConfig: Record<string, { bg: string; text: string }> = {
  active: { bg: 'bg-emerald-100 dark:bg-emerald-900/50', text: 'text-emerald-700 dark:text-emerald-300' },
  inactive: { bg: 'bg-slate-100 dark:bg-slate-800', text: 'text-slate-600 dark:text-slate-400' },
  suspended: { bg: 'bg-red-100 dark:bg-red-900/50', text: 'text-red-700 dark:text-red-300' },
};

export default function ThinkTankUsersPage() {
  const [search, setSearch] = useState('');

  const { data: users, isLoading } = useQuery({
    queryKey: ['thinktank-users', search],
    queryFn: () =>
      fetch(`/api/admin/thinktank/users?search=${search}`).then((r) => r.json()),
  });

  const { data: stats } = useQuery<UserStats>({
    queryKey: ['thinktank-user-stats'],
    queryFn: () => fetch('/api/admin/thinktank/users/stats').then((r) => r.json()),
  });

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold">Think Tank Users</h1>
          <p className="text-muted-foreground">
            Manage Think Tank consumer users
          </p>
        </div>
        <Button variant="outline">
          <Download className="h-4 w-4 mr-2" />
          Export
        </Button>
      </div>

      {/* Stats Cards - Enhanced with icons and visual hierarchy */}
      <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="relative overflow-hidden">
          <CardContent className="p-6">
            <div className="flex items-start justify-between">
              <div className="space-y-2">
                <p className="text-sm font-medium text-muted-foreground">Total Users</p>
                <p className="text-3xl font-bold tabular-nums">
                  {stats?.totalUsers?.toLocaleString() || 0}
                </p>
                <p className="text-xs text-emerald-600 flex items-center gap-1">
                  <TrendingUp className="h-3 w-3" />
                  +15% from last month
                </p>
              </div>
              <div className="p-3 rounded-xl bg-blue-100 dark:bg-blue-900/30">
                <Users className="h-6 w-6 text-blue-600 dark:text-blue-400" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="relative overflow-hidden">
          <CardContent className="p-6">
            <div className="flex items-start justify-between">
              <div className="space-y-2">
                <p className="text-sm font-medium text-muted-foreground">Active (7d)</p>
                <p className="text-3xl font-bold tabular-nums">
                  {stats?.activeUsers7d?.toLocaleString() || 0}
                </p>
                <p className="text-xs text-muted-foreground">Weekly active users</p>
              </div>
              <div className="p-3 rounded-xl bg-emerald-100 dark:bg-emerald-900/30">
                <Activity className="h-6 w-6 text-emerald-600 dark:text-emerald-400" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="relative overflow-hidden">
          <CardContent className="p-6">
            <div className="flex items-start justify-between">
              <div className="space-y-2">
                <p className="text-sm font-medium text-muted-foreground">Pro+ Subscribers</p>
                <p className="text-3xl font-bold tabular-nums">
                  {stats?.paidUsers?.toLocaleString() || 0}
                </p>
                <p className="text-xs text-emerald-600 flex items-center gap-1">
                  <TrendingUp className="h-3 w-3" />
                  +8% conversion rate
                </p>
              </div>
              <div className="p-3 rounded-xl bg-purple-100 dark:bg-purple-900/30">
                <Crown className="h-6 w-6 text-purple-600 dark:text-purple-400" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="relative overflow-hidden">
          <CardContent className="p-6">
            <div className="flex items-start justify-between">
              <div className="space-y-2">
                <p className="text-sm font-medium text-muted-foreground">Total Revenue</p>
                <p className="text-3xl font-bold tabular-nums">
                  ${stats?.totalRevenue?.toLocaleString() || 0}
                </p>
                <p className="text-xs text-emerald-600 flex items-center gap-1">
                  <TrendingUp className="h-3 w-3" />
                  +22% MRR growth
                </p>
              </div>
              <div className="p-3 rounded-xl bg-green-100 dark:bg-green-900/30">
                <DollarSign className="h-6 w-6 text-green-600 dark:text-green-400" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Search & Table */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-4">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by email or name..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>User</TableHead>
                <TableHead>Tier</TableHead>
                <TableHead className="text-right">Conversations</TableHead>
                <TableHead className="text-right">Tokens</TableHead>
                <TableHead className="text-right">Spent</TableHead>
                <TableHead>Last Active</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-10"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-12">
                    <div className="flex flex-col items-center gap-2">
                      <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
                      <span className="text-sm text-muted-foreground">Loading users...</span>
                    </div>
                  </TableCell>
                </TableRow>
              ) : (users?.data || []).length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-12">
                    <div className="flex flex-col items-center gap-2">
                      <Users className="h-8 w-8 text-muted-foreground/50" />
                      <span className="text-sm text-muted-foreground">No users found</span>
                      <span className="text-xs text-muted-foreground">Try adjusting your search</span>
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                (users?.data || []).map((user: ThinkTankUser) => {
                  const tier = tierConfig[user.subscription_tier] || tierConfig.free;
                  const status = statusConfig[user.status] || statusConfig.inactive;
                  return (
                    <TableRow key={user.id} className="group">
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <Avatar className="h-9 w-9">
                            <AvatarFallback className="bg-primary/10 text-primary text-xs">
                              {user.email.slice(0, 2).toUpperCase()}
                            </AvatarFallback>
                          </Avatar>
                          <div>
                            <div className="font-medium">{user.display_name || user.email.split('@')[0]}</div>
                            <div className="text-xs text-muted-foreground">{user.email}</div>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge className={cn(tier.bg, tier.text, 'font-medium')}>
                          {tier.icon} {user.subscription_tier}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {(user.conversation_count || 0).toLocaleString()}
                      </TableCell>
                      <TableCell className="text-right tabular-nums font-mono text-sm">
                        {(user.total_tokens_used || 0).toLocaleString()}
                      </TableCell>
                      <TableCell className="text-right tabular-nums font-medium">
                        ${(user.total_spent || 0).toFixed(2)}
                      </TableCell>
                      <TableCell>
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <div className="flex items-center gap-1 text-sm">
                                <Clock className="h-3 w-3 text-muted-foreground" />
                                {user.last_active_at
                                  ? formatDistanceToNow(new Date(user.last_active_at), { addSuffix: true })
                                  : 'Never'}
                              </div>
                            </TooltipTrigger>
                            <TooltipContent>
                              {user.last_active_at
                                ? format(new Date(user.last_active_at), 'PPpp')
                                : 'No activity recorded'}
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      </TableCell>
                      <TableCell>
                        <Badge className={cn(status.bg, status.text)}>
                          {user.status}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity"
                            >
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem>
                              <Eye className="h-4 w-4 mr-2" />
                              View Details
                            </DropdownMenuItem>
                            <DropdownMenuItem>
                              <Mail className="h-4 w-4 mr-2" />
                              Send Email
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem className="text-destructive">
                              <Ban className="h-4 w-4 mr-2" />
                              Suspend User
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
