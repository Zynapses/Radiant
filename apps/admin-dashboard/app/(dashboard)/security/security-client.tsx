'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
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
  AlertTriangle,
  Shield,
  ShieldAlert,
  ShieldCheck,
  Search,
  RefreshCw,
  MapPin,
  User,
  Ban,
  CheckCircle,
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

interface SecurityAnomaly {
  id: string;
  anomalyType: 'geographic' | 'session_hijack' | 'brute_force' | 'rate_limit' | 'credential_stuffing';
  severity: 'critical' | 'high' | 'medium' | 'low';
  userId: string | null;
  ipAddress: string;
  details: Record<string, unknown>;
  isResolved: boolean;
  detectedAt: string;
}

interface SecurityMetrics {
  totalAnomalies24h: number;
  criticalCount: number;
  highCount: number;
  blockedIps: number;
  suspiciousLogins: number;
  activeThreats: number;
}

export function SecurityDashboardClient() {
  const [search, setSearch] = useState('');
  const [severityFilter, setSeverityFilter] = useState<string>('all');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const queryClient = useQueryClient();

  const { data: anomalies, isLoading } = useQuery<SecurityAnomaly[]>({
    queryKey: ['security-anomalies', search, severityFilter, typeFilter],
    queryFn: () =>
      fetch(
        `/api/security/anomalies?severity=${severityFilter === 'all' ? '' : severityFilter}&type=${typeFilter === 'all' ? '' : typeFilter}`
      ).then((r) => r.json()),
  });

  const { data: metrics } = useQuery<SecurityMetrics>({
    queryKey: ['security-metrics'],
    queryFn: () => fetch('/api/security/metrics').then((r) => r.json()),
  });

  const runScanMutation = useMutation({
    mutationFn: () =>
      fetch('/api/security/scan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      }).then((r) => r.json()),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['security-anomalies'] });
      queryClient.invalidateQueries({ queryKey: ['security-metrics'] });
    },
  });

  const resolveAnomalyMutation = useMutation({
    mutationFn: (id: string) =>
      fetch(`/api/security/anomalies/${id}/resolve`, {
        method: 'PUT',
      }).then((r) => r.json()),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['security-anomalies'] });
      queryClient.invalidateQueries({ queryKey: ['security-metrics'] });
    },
  });

  const blockIpMutation = useMutation({
    mutationFn: (ipAddress: string) =>
      fetch('/api/security/blocklist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ipAddress }),
      }).then((r) => r.json()),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['security-metrics'] });
    },
  });

  const getSeverityBadge = (severity: SecurityAnomaly['severity']) => {
    switch (severity) {
      case 'critical':
        return <Badge variant="destructive">Critical</Badge>;
      case 'high':
        return <Badge className="bg-orange-500">High</Badge>;
      case 'medium':
        return <Badge className="bg-amber-500">Medium</Badge>;
      case 'low':
        return <Badge variant="secondary">Low</Badge>;
    }
  };

  const getTypeBadge = (type: SecurityAnomaly['anomalyType']) => {
    switch (type) {
      case 'geographic':
        return (
          <Badge variant="outline">
            <MapPin className="h-3 w-3 mr-1" />
            Geographic
          </Badge>
        );
      case 'session_hijack':
        return (
          <Badge variant="outline" className="border-red-500 text-red-500">
            <ShieldAlert className="h-3 w-3 mr-1" />
            Session Hijack
          </Badge>
        );
      case 'brute_force':
        return (
          <Badge variant="outline" className="border-orange-500 text-orange-500">
            <AlertTriangle className="h-3 w-3 mr-1" />
            Brute Force
          </Badge>
        );
      case 'credential_stuffing':
        return (
          <Badge variant="outline" className="border-purple-500 text-purple-500">
            <User className="h-3 w-3 mr-1" />
            Credential Stuffing
          </Badge>
        );
      default:
        return <Badge variant="outline">{type}</Badge>;
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold">Security Dashboard</h1>
          <p className="text-muted-foreground">
            Intrusion detection and anomaly monitoring
          </p>
        </div>
        <Button
          onClick={() => runScanMutation.mutate()}
          disabled={runScanMutation.isPending}
        >
          <RefreshCw
            className={`h-4 w-4 mr-2 ${runScanMutation.isPending ? 'animate-spin' : ''}`}
          />
          Run Security Scan
        </Button>
      </div>

      {/* Metrics Cards */}
      <div className="grid gap-4 md:grid-cols-6">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Anomalies (24h)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{metrics?.totalAnomalies24h || 0}</div>
          </CardContent>
        </Card>
        <Card className="border-red-200 dark:border-red-900">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-red-600">
              Critical
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">
              {metrics?.criticalCount || 0}
            </div>
          </CardContent>
        </Card>
        <Card className="border-orange-200 dark:border-orange-900">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-orange-600">
              High
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-600">
              {metrics?.highCount || 0}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Blocked IPs
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{metrics?.blockedIps || 0}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Suspicious Logins
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{metrics?.suspiciousLogins || 0}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Active Threats
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold flex items-center gap-2">
              {metrics?.activeThreats || 0}
              {(metrics?.activeThreats || 0) === 0 ? (
                <ShieldCheck className="h-5 w-5 text-green-500" />
              ) : (
                <ShieldAlert className="h-5 w-5 text-red-500" />
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Anomalies Table */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-4">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by IP or user..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>
            <Select value={severityFilter} onValueChange={setSeverityFilter}>
              <SelectTrigger className="w-36">
                <SelectValue placeholder="Severity" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Severity</SelectItem>
                <SelectItem value="critical">Critical</SelectItem>
                <SelectItem value="high">High</SelectItem>
                <SelectItem value="medium">Medium</SelectItem>
                <SelectItem value="low">Low</SelectItem>
              </SelectContent>
            </Select>
            <Select value={typeFilter} onValueChange={setTypeFilter}>
              <SelectTrigger className="w-44">
                <SelectValue placeholder="Type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                <SelectItem value="geographic">Geographic</SelectItem>
                <SelectItem value="session_hijack">Session Hijack</SelectItem>
                <SelectItem value="brute_force">Brute Force</SelectItem>
                <SelectItem value="credential_stuffing">Credential Stuffing</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Type</TableHead>
                <TableHead>Severity</TableHead>
                <TableHead>IP Address</TableHead>
                <TableHead>User</TableHead>
                <TableHead>Details</TableHead>
                <TableHead>Detected</TableHead>
                <TableHead>Status</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-8">
                    Loading...
                  </TableCell>
                </TableRow>
              ) : (anomalies || []).length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-8">
                    <div className="flex flex-col items-center gap-2 text-muted-foreground">
                      <ShieldCheck className="h-8 w-8 text-green-500" />
                      <span>No security anomalies detected</span>
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                (anomalies || []).map((anomaly) => (
                  <TableRow key={anomaly.id}>
                    <TableCell>{getTypeBadge(anomaly.anomalyType)}</TableCell>
                    <TableCell>{getSeverityBadge(anomaly.severity)}</TableCell>
                    <TableCell className="font-mono text-sm">
                      {anomaly.ipAddress}
                    </TableCell>
                    <TableCell>
                      {anomaly.userId ? (
                        <span className="text-sm">{anomaly.userId.slice(0, 8)}...</span>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell className="max-w-[200px]">
                      <div className="text-xs text-muted-foreground truncate">
                        {JSON.stringify(anomaly.details).slice(0, 50)}...
                      </div>
                    </TableCell>
                    <TableCell className="text-sm">
                      {formatDistanceToNow(new Date(anomaly.detectedAt), {
                        addSuffix: true,
                      })}
                    </TableCell>
                    <TableCell>
                      {anomaly.isResolved ? (
                        <Badge variant="secondary">
                          <CheckCircle className="h-3 w-3 mr-1" />
                          Resolved
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="border-amber-500 text-amber-500">
                          Open
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        {!anomaly.isResolved && (
                          <>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => resolveAnomalyMutation.mutate(anomaly.id)}
                            >
                              <CheckCircle className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => blockIpMutation.mutate(anomaly.ipAddress)}
                            >
                              <Ban className="h-4 w-4" />
                            </Button>
                          </>
                        )}
                      </div>
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
