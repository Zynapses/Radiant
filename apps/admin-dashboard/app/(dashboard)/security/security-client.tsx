'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
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
  Clock,
  Globe,
  Activity,
  Eye,
  ChevronRight,
  FileText,
  Lock,
  Unlock,
  AlertCircle,
  TrendingUp,
  TrendingDown,
  ExternalLink,
  Copy,
  MoreHorizontal,
} from 'lucide-react';
import { formatDistanceToNow, format } from 'date-fns';
import { cn } from '@/lib/utils';

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

interface AnomalyDetail {
  id: string;
  anomalyType: SecurityAnomaly['anomalyType'];
  severity: SecurityAnomaly['severity'];
  userId: string | null;
  userEmail: string | null;
  ipAddress: string;
  country: string;
  city: string;
  isp: string;
  details: Record<string, unknown>;
  isResolved: boolean;
  resolvedBy: string | null;
  resolvedAt: string | null;
  detectedAt: string;
  relatedEvents: Array<{
    id: string;
    type: string;
    timestamp: string;
    description: string;
  }>;
  timeline: Array<{
    action: string;
    actor: string;
    timestamp: string;
  }>;
}

// Drill down detail dialog
function AnomalyDetailDialog({
  anomaly,
  open,
  onClose,
  onResolve,
  onBlockIp,
}: {
  anomaly: AnomalyDetail | null;
  open: boolean;
  onClose: () => void;
  onResolve: (id: string) => void;
  onBlockIp: (ip: string) => void;
}) {
  if (!anomaly) return null;

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'critical': return 'text-red-600 bg-red-100 dark:bg-red-900/30';
      case 'high': return 'text-orange-600 bg-orange-100 dark:bg-orange-900/30';
      case 'medium': return 'text-amber-600 bg-amber-100 dark:bg-amber-900/30';
      default: return 'text-slate-600 bg-slate-100 dark:bg-slate-900/30';
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <div className={cn('p-2 rounded-lg', getSeverityColor(anomaly.severity))}>
              <ShieldAlert className="h-5 w-5" />
            </div>
            <div>
              <DialogTitle className="capitalize">
                {anomaly.anomalyType.replace('_', ' ')} Detected
              </DialogTitle>
              <DialogDescription>
                ID: {anomaly.id} • Detected {formatDistanceToNow(new Date(anomaly.detectedAt), { addSuffix: true })}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <Tabs defaultValue="details" className="flex-1 overflow-hidden">
          <TabsList className="w-full justify-start">
            <TabsTrigger value="details">Details</TabsTrigger>
            <TabsTrigger value="timeline">Timeline</TabsTrigger>
            <TabsTrigger value="related">Related Events</TabsTrigger>
            <TabsTrigger value="raw">Raw Data</TabsTrigger>
          </TabsList>

          <ScrollArea className="flex-1 mt-4">
            <TabsContent value="details" className="space-y-6 m-0">
              {/* Status */}
              <div className="flex items-center justify-between p-4 rounded-lg bg-muted/50">
                <div className="flex items-center gap-3">
                  {anomaly.isResolved ? (
                    <CheckCircle className="h-5 w-5 text-green-500" />
                  ) : (
                    <AlertCircle className="h-5 w-5 text-amber-500" />
                  )}
                  <div>
                    <p className="font-medium">
                      {anomaly.isResolved ? 'Resolved' : 'Open - Requires Attention'}
                    </p>
                    {anomaly.isResolved && anomaly.resolvedBy && (
                      <p className="text-sm text-muted-foreground">
                        Resolved by {anomaly.resolvedBy} on {format(new Date(anomaly.resolvedAt!), 'PPp')}
                      </p>
                    )}
                  </div>
                </div>
                {!anomaly.isResolved && (
                  <div className="flex gap-2">
                    <Button size="sm" variant="outline" onClick={() => onBlockIp(anomaly.ipAddress)}>
                      <Ban className="h-4 w-4 mr-1" />
                      Block IP
                    </Button>
                    <Button size="sm" onClick={() => onResolve(anomaly.id)}>
                      <CheckCircle className="h-4 w-4 mr-1" />
                      Mark Resolved
                    </Button>
                  </div>
                )}
              </div>

              {/* Info Grid */}
              <div className="grid grid-cols-2 gap-4">
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <Globe className="h-4 w-4" />
                      Location
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="font-medium">{anomaly.city}, {anomaly.country}</p>
                    <p className="text-sm text-muted-foreground">ISP: {anomaly.isp}</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <Activity className="h-4 w-4" />
                      IP Address
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-center gap-2">
                      <code className="font-mono">{anomaly.ipAddress}</code>
                      <Button variant="ghost" size="icon" className="h-6 w-6">
                        <Copy className="h-3 w-3" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <User className="h-4 w-4" />
                      User
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    {anomaly.userId ? (
                      <>
                        <p className="font-medium">{anomaly.userEmail || 'Unknown'}</p>
                        <p className="text-sm text-muted-foreground font-mono">{anomaly.userId}</p>
                      </>
                    ) : (
                      <p className="text-muted-foreground">No associated user</p>
                    )}
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <Clock className="h-4 w-4" />
                      Detection Time
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="font-medium">{format(new Date(anomaly.detectedAt), 'PPp')}</p>
                    <p className="text-sm text-muted-foreground">
                      {formatDistanceToNow(new Date(anomaly.detectedAt), { addSuffix: true })}
                    </p>
                  </CardContent>
                </Card>
              </div>

              {/* Threat Details */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm">Threat Analysis</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-3 gap-4 text-center">
                    <div className="p-3 rounded-lg bg-muted">
                      <p className="text-2xl font-bold">{(anomaly.details as any).attempts || 1}</p>
                      <p className="text-sm text-muted-foreground">Attempts</p>
                    </div>
                    <div className="p-3 rounded-lg bg-muted">
                      <p className="text-2xl font-bold">{(anomaly.details as any).riskScore || 85}%</p>
                      <p className="text-sm text-muted-foreground">Risk Score</p>
                    </div>
                    <div className="p-3 rounded-lg bg-muted">
                      <p className="text-2xl font-bold">{(anomaly.details as any).affectedSessions || 1}</p>
                      <p className="text-sm text-muted-foreground">Sessions</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="timeline" className="m-0">
              <div className="space-y-4">
                {(anomaly.timeline || [
                  { action: 'Anomaly detected', actor: 'System', timestamp: anomaly.detectedAt },
                  { action: 'Alert generated', actor: 'System', timestamp: anomaly.detectedAt },
                ]).map((event, i) => (
                  <div key={i} className="flex gap-4">
                    <div className="flex flex-col items-center">
                      <div className="w-2 h-2 rounded-full bg-primary" />
                      {i < (anomaly.timeline?.length || 2) - 1 && (
                        <div className="w-0.5 flex-1 bg-border" />
                      )}
                    </div>
                    <div className="flex-1 pb-4">
                      <p className="font-medium">{event.action}</p>
                      <p className="text-sm text-muted-foreground">
                        {event.actor} • {format(new Date(event.timestamp), 'PPp')}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </TabsContent>

            <TabsContent value="related" className="m-0">
              <div className="space-y-2">
                {(anomaly.relatedEvents || [
                  { id: '1', type: 'login_attempt', timestamp: anomaly.detectedAt, description: 'Failed login from same IP' },
                  { id: '2', type: 'rate_limit', timestamp: anomaly.detectedAt, description: 'Rate limit triggered' },
                ]).map((event) => (
                  <div key={event.id} className="flex items-center justify-between p-3 rounded-lg border">
                    <div>
                      <Badge variant="outline" className="mb-1">{event.type}</Badge>
                      <p className="text-sm">{event.description}</p>
                    </div>
                    <span className="text-xs text-muted-foreground">
                      {format(new Date(event.timestamp), 'HH:mm:ss')}
                    </span>
                  </div>
                ))}
              </div>
            </TabsContent>

            <TabsContent value="raw" className="m-0">
              <pre className="p-4 rounded-lg bg-muted text-sm font-mono overflow-auto">
                {JSON.stringify(anomaly, null, 2)}
              </pre>
            </TabsContent>
          </ScrollArea>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}

export function SecurityDashboardClient() {
  const [search, setSearch] = useState('');
  const [severityFilter, setSeverityFilter] = useState<string>('all');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [selectedAnomaly, setSelectedAnomaly] = useState<AnomalyDetail | null>(null);
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
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-auto p-0 text-left font-normal"
                        onClick={() => setSelectedAnomaly({
                          ...anomaly,
                          userEmail: null,
                          country: 'United States',
                          city: 'New York',
                          isp: 'Example ISP',
                          resolvedBy: null,
                          resolvedAt: null,
                          relatedEvents: [],
                          timeline: [],
                        })}
                      >
                        <div className="text-xs text-muted-foreground truncate flex items-center gap-1">
                          <Eye className="h-3 w-3" />
                          View Details
                        </div>
                      </Button>
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

      {/* Drill-down Detail Dialog */}
      <AnomalyDetailDialog
        anomaly={selectedAnomaly}
        open={!!selectedAnomaly}
        onClose={() => setSelectedAnomaly(null)}
        onResolve={(id) => {
          resolveAnomalyMutation.mutate(id);
          setSelectedAnomaly(null);
        }}
        onBlockIp={(ip) => {
          blockIpMutation.mutate(ip);
        }}
      />
    </div>
  );
}
