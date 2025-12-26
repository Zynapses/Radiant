'use client';

/**
 * Think Tank Health Card Component
 * Displays Think Tank status in the System Health page
 */

import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import {
  Brain,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Users,
  MessageSquare,
  Zap,
  Eye,
  ExternalLink,
  RefreshCw,
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import Link from 'next/link';

interface ThinkTankHealth {
  status: 'healthy' | 'degraded' | 'unhealthy' | 'offline';
  latencyMs: number;
  lastCheck: string;
  activeUsers: number;
  activeConversations: number;
  errorRate: number;
}

interface ThinkTankStatus {
  installed: boolean;
  version: string | null;
  lastActiveAt: string | null;
  installDate: string | null;
  uninstallDate: string | null;
  dataRetained: boolean;
  health: ThinkTankHealth | null;
}

const statusConfig = {
  healthy: { 
    icon: CheckCircle, 
    color: 'text-green-500', 
    bg: 'bg-green-100 dark:bg-green-900/30',
    badge: 'default' as const,
  },
  degraded: { 
    icon: AlertTriangle, 
    color: 'text-amber-500', 
    bg: 'bg-amber-100 dark:bg-amber-900/30',
    badge: 'secondary' as const,
  },
  unhealthy: { 
    icon: XCircle, 
    color: 'text-red-500', 
    bg: 'bg-red-100 dark:bg-red-900/30',
    badge: 'destructive' as const,
  },
  offline: { 
    icon: XCircle, 
    color: 'text-gray-500', 
    bg: 'bg-gray-100 dark:bg-gray-900/30',
    badge: 'secondary' as const,
  },
};

export function ThinkTankHealthCard() {
  const { data: status, isLoading, refetch } = useQuery<ThinkTankStatus>({
    queryKey: ['thinktank', 'status'],
    queryFn: () => fetch('/api/admin/thinktank/status').then(r => r.json()),
    refetchInterval: 30000,
  });

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Brain className="h-5 w-5 text-muted-foreground" />
            <CardTitle>Think Tank</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-8">
            <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        </CardContent>
      </Card>
    );
  }

  // Not installed and no retained data
  if (!status?.installed && !status?.dataRetained) {
    return (
      <Card className="border-dashed">
        <CardHeader>
          <div className="flex items-center gap-2">
            <Brain className="h-5 w-5 text-muted-foreground" />
            <CardTitle>Think Tank</CardTitle>
          </div>
          <CardDescription>AI Conversation Platform</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-center py-4">
            <p className="text-muted-foreground mb-4">Not installed</p>
            <Button variant="outline" size="sm">
              Install Think Tank
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  // View-only mode (uninstalled but data retained)
  if (!status?.installed && status?.dataRetained) {
    return (
      <Card className="border-amber-200 dark:border-amber-800">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Brain className="h-5 w-5 text-amber-500" />
              <CardTitle>Think Tank</CardTitle>
            </div>
            <Badge variant="secondary">
              <Eye className="h-3 w-3 mr-1" />
              View Only
            </Badge>
          </div>
          <CardDescription>Uninstalled - Data preserved</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Think Tank was uninstalled on{' '}
              {status.uninstallDate 
                ? formatDistanceToNow(new Date(status.uninstallDate), { addSuffix: true })
                : 'unknown date'}.
              All data is preserved and will be available upon reinstallation.
            </p>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" asChild>
                <Link href="/thinktank">
                  View Data
                  <ExternalLink className="h-3 w-3 ml-1" />
                </Link>
              </Button>
              <Button size="sm">
                <RefreshCw className="h-3 w-3 mr-1" />
                Reinstall
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Installed - show health status
  const health = status?.health;
  const config = health ? statusConfig[health.status] : statusConfig.offline;
  const StatusIcon = config.icon;

  return (
    <Card className="cursor-pointer hover:shadow-md transition-shadow">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className={`p-2 rounded-lg ${config.bg}`}>
              <Brain className={`h-5 w-5 ${config.color}`} />
            </div>
            <div>
              <CardTitle className="text-lg">Think Tank</CardTitle>
              <CardDescription>v{status?.version}</CardDescription>
            </div>
          </div>
          <Badge variant={config.badge}>
            <StatusIcon className="h-3 w-3 mr-1" />
            {health?.status || 'Unknown'}
          </Badge>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {/* Metrics Grid */}
          <div className="grid grid-cols-3 gap-4 text-center">
            <div>
              <div className="flex items-center justify-center gap-1 text-muted-foreground mb-1">
                <Users className="h-3 w-3" />
                <span className="text-xs">Users</span>
              </div>
              <p className="font-semibold">{health?.activeUsers || 0}</p>
            </div>
            <div>
              <div className="flex items-center justify-center gap-1 text-muted-foreground mb-1">
                <MessageSquare className="h-3 w-3" />
                <span className="text-xs">Chats</span>
              </div>
              <p className="font-semibold">{health?.activeConversations || 0}</p>
            </div>
            <div>
              <div className="flex items-center justify-center gap-1 text-muted-foreground mb-1">
                <Zap className="h-3 w-3" />
                <span className="text-xs">Latency</span>
              </div>
              <p className="font-semibold">{health?.latencyMs || 0}ms</p>
            </div>
          </div>

          {/* Error Rate */}
          <div>
            <div className="flex items-center justify-between text-sm mb-1">
              <span className="text-muted-foreground">Error Rate</span>
              <span className={health && health.errorRate > 0.05 ? 'text-red-500' : ''}>
                {((health?.errorRate || 0) * 100).toFixed(2)}%
              </span>
            </div>
            <Progress 
              value={(health?.errorRate || 0) * 100} 
              className="h-1"
            />
          </div>

          {/* Last Check */}
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Last Check</span>
            <span>
              {health?.lastCheck 
                ? formatDistanceToNow(new Date(health.lastCheck), { addSuffix: true })
                : 'Never'}
            </span>
          </div>

          {/* Actions */}
          <div className="flex gap-2 pt-2">
            <Button variant="ghost" size="sm" className="flex-1" asChild>
              <Link href="/thinktank/settings">
                Settings
              </Link>
            </Button>
            <Button variant="ghost" size="sm" className="flex-1" asChild>
              <Link href="/thinktank">
                Dashboard
                <ExternalLink className="h-3 w-3 ml-1" />
              </Link>
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
