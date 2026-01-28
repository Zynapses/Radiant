'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Shield,
  AlertTriangle,
  Lock,
  Key,
  Globe,
  Users,
  Activity,
  RefreshCw,
  CheckCircle,
  XCircle,
} from 'lucide-react';

interface SecurityAnomaly {
  id: string;
  tenantId: string;
  anomalyType: 'geographic' | 'session_hijack' | 'brute_force' | 'rate_limit' | 'credential_stuffing';
  severity: 'critical' | 'high' | 'medium' | 'low';
  userId?: string;
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

interface FailedLogin {
  id: string;
  userId: string;
  ipAddress: string;
  attemptCount: number;
  lastAttempt: string;
  isBlocked: boolean;
}

const severityColors = {
  critical: 'bg-red-500',
  high: 'bg-orange-500',
  medium: 'bg-yellow-500',
  low: 'bg-blue-500',
};

const anomalyTypeIcons = {
  geographic: Globe,
  session_hijack: Users,
  brute_force: Lock,
  rate_limit: Activity,
  credential_stuffing: Key,
};

export function SecurityDashboard() {
  const [product, setProduct] = useState<string>('combined');
  const [timeRange, setTimeRange] = useState<string>('24h');

  const { data: metrics, isLoading: _metricsLoading } = useQuery<SecurityMetrics>({
    queryKey: ['security-metrics', product, timeRange],
    queryFn: () => fetch(`/api/security/metrics?product=${product}&range=${timeRange}`).then((r) => r.json()),
  });

  const { data: anomalies, refetch: refetchAnomalies } = useQuery<SecurityAnomaly[]>({
    queryKey: ['security-anomalies', product],
    queryFn: () => fetch(`/api/security/anomalies?product=${product}`).then((r) => r.json()),
  });

  const { data: failedLogins } = useQuery<FailedLogin[]>({
    queryKey: ['failed-logins', product],
    queryFn: () => fetch(`/api/security/failed-logins?product=${product}`).then((r) => r.json()),
  });

  const activeAnomalies = anomalies?.filter((a) => !a.isResolved) || [];
  const criticalAnomalies = activeAnomalies.filter((a) => a.severity === 'critical');

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold">Security Dashboard</h2>
          <p className="text-muted-foreground">Monitor security events and anomalies</p>
        </div>
        <div className="flex gap-2">
          <Select value={product} onValueChange={setProduct}>
            <SelectTrigger className="w-40">
              <SelectValue placeholder="Product" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="combined">Combined</SelectItem>
              <SelectItem value="radiant">Radiant</SelectItem>
              <SelectItem value="thinktank">Think Tank</SelectItem>
            </SelectContent>
          </Select>
          <Select value={timeRange} onValueChange={setTimeRange}>
            <SelectTrigger className="w-32">
              <SelectValue placeholder="Time Range" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="1h">Last Hour</SelectItem>
              <SelectItem value="24h">Last 24h</SelectItem>
              <SelectItem value="7d">Last 7 Days</SelectItem>
              <SelectItem value="30d">Last 30 Days</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" size="icon" onClick={() => refetchAnomalies()}>
            <RefreshCw className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Critical Alert Banner */}
      {criticalAnomalies.length > 0 && (
        <div className="bg-red-500/10 border border-red-500 rounded-lg p-4 flex items-center gap-3">
          <AlertTriangle className="h-6 w-6 text-red-500" />
          <div>
            <h3 className="font-semibold text-red-500">
              {criticalAnomalies.length} Critical Security Alert{criticalAnomalies.length > 1 ? 's' : ''}
            </h3>
            <p className="text-sm text-muted-foreground">Immediate attention required</p>
          </div>
          <Button variant="destructive" className="ml-auto">View Alerts</Button>
        </div>
      )}

      {/* Metrics Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Total Anomalies (24h)</CardDescription>
            <CardTitle className="text-3xl">{metrics?.totalAnomalies24h || 0}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2 text-sm">
              <Shield className="h-4 w-4 text-muted-foreground" />
              <span className="text-muted-foreground">Detected threats</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Critical / High</CardDescription>
            <CardTitle className="text-3xl">
              <span className="text-red-500">{metrics?.criticalCount || 0}</span>
              {' / '}
              <span className="text-orange-500">{metrics?.highCount || 0}</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2 text-sm">
              <AlertTriangle className="h-4 w-4 text-red-500" />
              <span className="text-muted-foreground">Severity breakdown</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Blocked IPs</CardDescription>
            <CardTitle className="text-3xl">{metrics?.blockedIps || 0}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2 text-sm">
              <Lock className="h-4 w-4 text-muted-foreground" />
              <span className="text-muted-foreground">Auto-blocked</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Suspicious Logins</CardDescription>
            <CardTitle className="text-3xl">{metrics?.suspiciousLogins || 0}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2 text-sm">
              <Users className="h-4 w-4 text-muted-foreground" />
              <span className="text-muted-foreground">Flagged attempts</span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tabs for different security views */}
      <Tabs defaultValue="anomalies">
        <TabsList>
          <TabsTrigger value="anomalies">Active Anomalies</TabsTrigger>
          <TabsTrigger value="failed-auth">Failed Authentications</TabsTrigger>
          <TabsTrigger value="api-keys">API Key Activity</TabsTrigger>
          <TabsTrigger value="sessions">Session Hijacking</TabsTrigger>
        </TabsList>

        <TabsContent value="anomalies" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Active Security Anomalies</CardTitle>
              <CardDescription>Unresolved security events requiring attention</CardDescription>
            </CardHeader>
            <CardContent>
              {activeAnomalies.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <CheckCircle className="h-12 w-12 mx-auto mb-2 text-green-500" />
                  <p>No active anomalies detected</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {activeAnomalies.map((anomaly) => {
                    const Icon = anomalyTypeIcons[anomaly.anomalyType];
                    return (
                      <div key={anomaly.id} className="flex items-center gap-4 p-3 border rounded-lg">
                        <div className={`p-2 rounded-full ${severityColors[anomaly.severity]}/20`}>
                          <Icon className={`h-5 w-5 ${severityColors[anomaly.severity].replace('bg-', 'text-')}`} />
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <span className="font-medium capitalize">
                              {anomaly.anomalyType.replace('_', ' ')}
                            </span>
                            <Badge variant={anomaly.severity === 'critical' ? 'destructive' : 'secondary'}>
                              {anomaly.severity}
                            </Badge>
                          </div>
                          <div className="text-sm text-muted-foreground">
                            IP: {anomaly.ipAddress} • {new Date(anomaly.detectedAt).toLocaleString()}
                          </div>
                        </div>
                        <Button variant="outline" size="sm">Investigate</Button>
                        <Button variant="ghost" size="sm">Resolve</Button>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="failed-auth" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Failed Authentication Attempts</CardTitle>
              <CardDescription>Recent failed login attempts by user</CardDescription>
            </CardHeader>
            <CardContent>
              {!failedLogins || failedLogins.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <CheckCircle className="h-12 w-12 mx-auto mb-2 text-green-500" />
                  <p>No suspicious login activity</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {failedLogins.map((login) => (
                    <div key={login.id} className="flex items-center gap-4 p-3 border rounded-lg">
                      <div className={`p-2 rounded-full ${login.isBlocked ? 'bg-red-500/20' : 'bg-yellow-500/20'}`}>
                        {login.isBlocked ? (
                          <XCircle className="h-5 w-5 text-red-500" />
                        ) : (
                          <AlertTriangle className="h-5 w-5 text-yellow-500" />
                        )}
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <span className="font-medium">{login.userId}</span>
                          {login.isBlocked && <Badge variant="destructive">Blocked</Badge>}
                        </div>
                        <div className="text-sm text-muted-foreground">
                          {login.attemptCount} attempts • IP: {login.ipAddress} • Last: {new Date(login.lastAttempt).toLocaleString()}
                        </div>
                      </div>
                      {!login.isBlocked && (
                        <Button variant="destructive" size="sm">Block IP</Button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="api-keys" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>API Key Activity</CardTitle>
              <CardDescription>Monitor API key usage patterns</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-center py-8 text-muted-foreground">
                <Key className="h-12 w-12 mx-auto mb-2" />
                <p>API key activity monitoring</p>
                <p className="text-sm">Track unusual API usage patterns</p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="sessions" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Session Hijacking Detection</CardTitle>
              <CardDescription>Monitor for session anomalies</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-center py-8 text-muted-foreground">
                <Users className="h-12 w-12 mx-auto mb-2" />
                <p>Session hijacking detection</p>
                <p className="text-sm">Detect sessions used from multiple IPs</p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
