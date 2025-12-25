'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Search, Download, UserX, Mail } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

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

const tierColors: Record<string, string> = {
  free: 'bg-gray-100 text-gray-800',
  pro: 'bg-blue-100 text-blue-800',
  team: 'bg-purple-100 text-purple-800',
  enterprise: 'bg-amber-100 text-amber-800',
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

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total Users
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {stats?.totalUsers?.toLocaleString() || 0}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Active (7d)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {stats?.activeUsers7d?.toLocaleString() || 0}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Pro+ Subscribers
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {stats?.paidUsers?.toLocaleString() || 0}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total Revenue
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              ${stats?.totalRevenue?.toLocaleString() || 0}
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
          <table className="w-full">
            <thead>
              <tr className="border-b">
                <th className="text-left py-2">Email</th>
                <th className="text-left">Display Name</th>
                <th className="text-left">Language</th>
                <th className="text-left">Tier</th>
                <th className="text-right">Conversations</th>
                <th className="text-right">Tokens Used</th>
                <th className="text-right">Total Spent</th>
                <th className="text-left">Last Active</th>
                <th className="text-left">Status</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr>
                  <td colSpan={9} className="text-center py-8">
                    Loading...
                  </td>
                </tr>
              ) : (
                (users?.data || []).map((user: ThinkTankUser) => (
                  <tr key={user.id} className="border-b hover:bg-muted/50">
                    <td className="py-2">
                      <div className="font-medium">{user.email}</div>
                      <div className="text-xs text-muted-foreground">
                        ID: {user.id.slice(0, 8)}...
                      </div>
                    </td>
                    <td>{user.display_name || '-'}</td>
                    <td>
                      <Badge variant="outline">
                        {(user.language || 'EN').toUpperCase()}
                      </Badge>
                    </td>
                    <td>
                      <Badge className={tierColors[user.subscription_tier] || tierColors.free}>
                        {user.subscription_tier}
                      </Badge>
                    </td>
                    <td className="text-right">
                      {(user.conversation_count || 0).toLocaleString()}
                    </td>
                    <td className="text-right">
                      {(user.total_tokens_used || 0).toLocaleString()}
                    </td>
                    <td className="text-right">
                      ${(user.total_spent || 0).toFixed(2)}
                    </td>
                    <td>
                      {user.last_active_at
                        ? formatDistanceToNow(new Date(user.last_active_at), {
                            addSuffix: true,
                          })
                        : 'Never'}
                    </td>
                    <td>
                      <Badge
                        variant={user.status === 'active' ? 'default' : 'destructive'}
                      >
                        {user.status}
                      </Badge>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}
