'use client';

/**
 * RADIANT v6.0.4 - Dream Monitor Page
 * Monitor and manage Twilight Dreaming memory consolidation
 */

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Moon,
  RefreshCw,
  AlertTriangle,
  CheckCircle,
  Clock,
  Play,
  ChevronLeft,
  Loader2,
  XCircle,
  Zap,
} from 'lucide-react';
import Link from 'next/link';

interface DreamQueueStatus {
  pendingJobs: number;
  runningJobs: number;
  completedToday: number;
  failedToday: number;
  avgDurationMs: number;
  oldestPendingAt: string | null;
}

interface TenantDreamSchedule {
  tenantId: string;
  timezone: string;
  lastDreamAt: string | null;
  nextScheduledDream: string | null;
  hoursSinceDream: number;
  eligibleForTwilight: boolean;
  eligibleForStarvation: boolean;
}

export default function DreamMonitorPage() {
  const [queueStatus, setQueueStatus] = useState<DreamQueueStatus | null>(null);
  const [schedules, setSchedules] = useState<TenantDreamSchedule[]>([]);
  const [loading, setLoading] = useState(true);
  const [triggerTenantId, setTriggerTenantId] = useState('');
  const [triggering, setTriggering] = useState(false);
  const [triggerResult, setTriggerResult] = useState<string | null>(null);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [queueRes, schedulesRes] = await Promise.all([
        fetch('/api/admin/brain/dreams/queue'),
        fetch('/api/admin/brain/dreams/schedules?limit=50'),
      ]);

      if (queueRes.ok) {
        setQueueStatus(await queueRes.json());
      }
      if (schedulesRes.ok) {
        const data = await schedulesRes.json();
        setSchedules(data.schedules || []);
      }
    } catch (err) {
      console.error('Failed to load dream data:', err);
    } finally {
      setLoading(false);
    }
  };

  const triggerDream = async () => {
    if (!triggerTenantId) return;
    setTriggering(true);
    setTriggerResult(null);
    try {
      const response = await fetch('/api/admin/brain/dreams/trigger', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tenantId: triggerTenantId }),
      });
      const data = await response.json();
      if (response.ok) {
        setTriggerResult(`Dream scheduled successfully: ${data.job?.id}`);
        fetchData();
      } else {
        setTriggerResult(`Error: ${data.error}`);
      }
    } catch (err) {
      setTriggerResult(`Error: ${String(err)}`);
    } finally {
      setTriggering(false);
    }
  };

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 30000);
    return () => clearInterval(interval);
  }, []);

  if (loading && !queueStatus) {
    return <DreamSkeleton />;
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/brain">
            <Button variant="ghost" size="sm">
              <ChevronLeft className="h-4 w-4 mr-1" />
              Back
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Moon className="h-6 w-6 text-blue-600" />
              Dream Monitor
            </h1>
            <p className="text-muted-foreground">
              Twilight Dreaming - Memory consolidation status
            </p>
          </div>
        </div>
        <Button onClick={fetchData} variant="outline" size="sm" disabled={loading}>
          <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      {/* Queue Status */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <Clock className="h-5 w-5 text-amber-500" />
              <span className="text-2xl font-bold">{queueStatus?.pendingJobs || 0}</span>
            </div>
            <p className="text-sm text-muted-foreground mt-2">Pending</p>
          </CardContent>
        </Card>
        <Card className={queueStatus?.runningJobs ? 'border-blue-300 bg-blue-50' : ''}>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <Loader2 className={`h-5 w-5 text-blue-500 ${queueStatus?.runningJobs ? 'animate-spin' : ''}`} />
              <span className="text-2xl font-bold">{queueStatus?.runningJobs || 0}</span>
            </div>
            <p className="text-sm text-muted-foreground mt-2">Running</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <CheckCircle className="h-5 w-5 text-green-500" />
              <span className="text-2xl font-bold">{queueStatus?.completedToday || 0}</span>
            </div>
            <p className="text-sm text-muted-foreground mt-2">Completed Today</p>
          </CardContent>
        </Card>
        <Card className={queueStatus?.failedToday ? 'border-red-300 bg-red-50' : ''}>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <XCircle className="h-5 w-5 text-red-500" />
              <span className="text-2xl font-bold">{queueStatus?.failedToday || 0}</span>
            </div>
            <p className="text-sm text-muted-foreground mt-2">Failed Today</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <Zap className="h-5 w-5 text-purple-500" />
              <span className="text-2xl font-bold">
                {queueStatus?.avgDurationMs ? `${(queueStatus.avgDurationMs / 1000).toFixed(1)}s` : '-'}
              </span>
            </div>
            <p className="text-sm text-muted-foreground mt-2">Avg Duration</p>
          </CardContent>
        </Card>
      </div>

      {/* Manual Trigger */}
      <Card>
        <CardHeader>
          <CardTitle>Manual Dream Trigger</CardTitle>
          <CardDescription>
            Manually trigger a dream cycle for a specific tenant
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex gap-4">
            <Input
              placeholder="Enter tenant ID"
              value={triggerTenantId}
              onChange={(e) => setTriggerTenantId(e.target.value)}
              className="max-w-md"
            />
            <Button onClick={triggerDream} disabled={!triggerTenantId || triggering}>
              {triggering ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Play className="h-4 w-4 mr-2" />
              )}
              Trigger Dream
            </Button>
          </div>
          {triggerResult && (
            <p className={`mt-2 text-sm ${triggerResult.startsWith('Error') ? 'text-red-600' : 'text-green-600'}`}>
              {triggerResult}
            </p>
          )}
        </CardContent>
      </Card>

      {/* Tenant Schedules */}
      <Card>
        <CardHeader>
          <CardTitle>Tenant Dream Schedules</CardTitle>
          <CardDescription>
            Dream eligibility by tenant. Starvation triggers after 30h without dreaming.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Tenant ID</TableHead>
                <TableHead>Timezone</TableHead>
                <TableHead>Last Dream</TableHead>
                <TableHead>Hours Since</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {schedules.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-muted-foreground">
                    No tenant schedules found
                  </TableCell>
                </TableRow>
              ) : (
                schedules.map((schedule) => (
                  <TableRow key={schedule.tenantId}>
                    <TableCell className="font-mono text-sm">
                      {schedule.tenantId.substring(0, 8)}...
                    </TableCell>
                    <TableCell>{schedule.timezone}</TableCell>
                    <TableCell>
                      {schedule.lastDreamAt
                        ? new Date(schedule.lastDreamAt).toLocaleString()
                        : 'Never'}
                    </TableCell>
                    <TableCell>
                      <span className={schedule.hoursSinceDream > 30 ? 'text-red-600 font-bold' : ''}>
                        {schedule.hoursSinceDream.toFixed(1)}h
                      </span>
                    </TableCell>
                    <TableCell>
                      {schedule.eligibleForStarvation ? (
                        <Badge variant="destructive">
                          <AlertTriangle className="h-3 w-3 mr-1" />
                          Starvation
                        </Badge>
                      ) : schedule.eligibleForTwilight ? (
                        <Badge variant="outline" className="bg-blue-50 text-blue-600 border-blue-200">
                          <Moon className="h-3 w-3 mr-1" />
                          Twilight Ready
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="bg-green-50 text-green-600 border-green-200">
                          <CheckCircle className="h-3 w-3 mr-1" />
                          OK
                        </Badge>
                      )}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

function DreamSkeleton() {
  return (
    <div className="p-6 space-y-6">
      <Skeleton className="h-10 w-64" />
      <div className="grid grid-cols-5 gap-4">
        {[1, 2, 3, 4, 5].map((i) => (
          <Skeleton key={i} className="h-24" />
        ))}
      </div>
      <Skeleton className="h-32" />
      <Skeleton className="h-96" />
    </div>
  );
}
