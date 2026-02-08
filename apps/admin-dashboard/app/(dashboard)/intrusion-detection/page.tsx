'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Shield,
  ShieldAlert,
  ShieldBan,
  ShieldCheck,
  Activity,
  AlertTriangle,
  Ban,
  Eye,
  Globe,
  Lock,
  RefreshCw,
  Search,
  Trash2,
  Plus,
  ChevronRight,
  ChevronDown,
  Clock,
  Target,
  Fingerprint,
  Gauge,
  Settings,
  History,
  ExternalLink,
  Filter,
  X,
} from 'lucide-react';
import { api } from '@/lib/api/client';
import Link from 'next/link';

// ============================================================================
// Types
// ============================================================================

interface DashboardStats {
  totalEvents24h: number;
  criticalEvents24h: number;
  blockedIps: number;
  activeIncidents: number;
  topDetectors: Array<{ detectorId: string; count: number }>;
  topSourceIps: Array<{ ip: string; count: number }>;
  engine: {
    signalsProcessed: number;
    detectionsTriggered: number;
    ipsBanned: number;
    alertsSent: number;
    windowCount: number;
    totalEntries: number;
    detectorCount: number;
  };
}

interface IntrusionEvent {
  id: string;
  detectorId: string;
  mitreTechnique?: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  confidence: number;
  sourceIp: string;
  userId?: string;
  requestPath?: string;
  details: Record<string, unknown>;
  responseAction: string;
  createdAt: string;
}

interface Incident {
  id: string;
  title: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  status: string;
  mitreTechniques: string[];
  eventCount: number;
  firstEventAt: string;
  lastEventAt: string;
  sourceIps: string[];
  createdAt: string;
}

interface BlockedIP {
  id: string;
  ipAddress: string;
  reason: string;
  detectorId?: string;
  severity: string;
  source: string;
  blockedAt: string;
  expiresAt?: string;
  isPermanent: boolean;
  hitCount: number;
}

interface DetectorRule {
  detectorId: string;
  enabled: boolean;
  severityOverride: string | null;
  thresholdConfig: Record<string, unknown>;
  responseActions: string[];
  cooldownSeconds: number;
  mitreTechnique: string | null;
  standardRefs: string[];
  description: string | null;
}

interface LockedAccount {
  userId: string;
  email: string;
  displayName: string;
  lockedAt: string;
  lockedUntil: string | null;
  reason: string;
  isPermanent: boolean;
  lockCount: number;
  lastLockoutId: string | null;
}

interface LockoutPolicy {
  tenantId: string | null;
  duration1st: number;
  duration2nd: number;
  duration3rd: number;
  permanentAfter: number;
  offenseWindowDays: number;
  permanentWindowDays: number;
  selfServiceEnabled: boolean;
  selfServiceMaxOffense: number;
  selfServiceMethod: string;
  autoUnlockEnabled: boolean;
  notifyUserOnLock: boolean;
  notifyAdminOnPermanent: boolean;
}

interface LockoutHistoryEntry {
  id: string;
  reasonType: string;
  reasonText: string;
  severity: string;
  detectorId: string | null;
  sourceIp: string | null;
  incidentId: string | null;
  offenseNumber: number;
  durationMinutes: number | null;
  lockedAt: string;
  lockedUntil: string | null;
  isPermanent: boolean;
  status: string;
  resolvedAt: string | null;
  resolvedBy: string | null;
  resolutionNotes: string | null;
}

interface RIDPSConfig {
  enabled: boolean;
  autoBlockEnabled: boolean;
  autoBlockMinSeverity: string;
  autoBlockMinConfidence: number;
  ipBanDurationMinutes: number;
  permanentBanThreshold: number;
  wafSyncEnabled: boolean;
  sentinelEscalationEnabled: boolean;
  baselineLearningDays: number;
  eventRetentionDays: number;
}

// ============================================================================
// Severity badge helper
// ============================================================================

function SeverityBadge({ severity }: { severity: string }) {
  const variants: Record<string, string> = {
    critical: 'bg-red-600 text-white',
    high: 'bg-orange-500 text-white',
    medium: 'bg-yellow-500 text-black',
    low: 'bg-blue-500 text-white',
  };
  return (
    <Badge className={variants[severity] || 'bg-gray-500 text-white'}>
      {severity.toUpperCase()}
    </Badge>
  );
}

function StatusBadge({ status }: { status: string }) {
  const variants: Record<string, string> = {
    open: 'bg-red-100 text-red-800 border-red-300',
    investigating: 'bg-yellow-100 text-yellow-800 border-yellow-300',
    mitigated: 'bg-blue-100 text-blue-800 border-blue-300',
    resolved: 'bg-green-100 text-green-800 border-green-300',
    false_positive: 'bg-gray-100 text-gray-800 border-gray-300',
  };
  return (
    <Badge variant="outline" className={variants[status] || ''}>
      {status.replace('_', ' ')}
    </Badge>
  );
}

// ============================================================================
// Main Page
// ============================================================================

export default function IntrusionDetectionPage() {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState('overview');
  const [blockIpForm, setBlockIpForm] = useState({ ip: '', reason: '', severity: 'high', permanent: false });
  const [sessionKillForm, setSessionKillForm] = useState({ sessionId: '', reason: '' });
  const [accountLockForm, setAccountLockForm] = useState({ userId: '', reason: '' });
  const [accountUnlockForm, setAccountUnlockForm] = useState({ userId: '' });

  // Cross-tab navigation filters
  const [eventsFilter, setEventsFilter] = useState<{ userId?: string; sourceIp?: string }>({});
  const [expandedLockoutUser, setExpandedLockoutUser] = useState<string | null>(null);
  const [lockoutHistoryCache, setLockoutHistoryCache] = useState<Record<string, LockoutHistoryEntry[]>>({});

  // Helper: navigate to Events tab filtered by userId or sourceIp
  const navigateToEvents = (filter: { userId?: string; sourceIp?: string }) => {
    setEventsFilter(filter);
    setActiveTab('events');
  };

  // Helper: navigate to Incidents tab
  const navigateToIncidents = () => {
    setActiveTab('incidents');
  };

  // Helper: fetch lockout history for a user and cache it
  const toggleLockoutHistory = async (userId: string) => {
    if (expandedLockoutUser === userId) {
      setExpandedLockoutUser(null);
      return;
    }
    setExpandedLockoutUser(userId);
    if (!lockoutHistoryCache[userId]) {
      try {
        const data = await api.get(`/admin/intrusion-detection/locked-accounts/${userId}/history`);
        setLockoutHistoryCache(prev => ({ ...prev, [userId]: (data as { history: LockoutHistoryEntry[] }).history }));
      } catch {
        setLockoutHistoryCache(prev => ({ ...prev, [userId]: [] }));
      }
    }
  };

  // --- Queries ---

  const { data: dashboard, isLoading: dashLoading } = useQuery<DashboardStats>({
    queryKey: ['ridps-dashboard'],
    queryFn: () => api.get('/admin/intrusion-detection/dashboard'),
    refetchInterval: 15000,
  });

  const { data: eventsData } = useQuery<{ events: IntrusionEvent[] }>({
    queryKey: ['ridps-events'],
    queryFn: () => api.get('/admin/intrusion-detection/events?limit=50'),
    refetchInterval: 10000,
  });

  const { data: incidentsData } = useQuery<{ incidents: Incident[] }>({
    queryKey: ['ridps-incidents'],
    queryFn: () => api.get('/admin/intrusion-detection/incidents?limit=50'),
    refetchInterval: 15000,
  });

  const { data: blockedData } = useQuery<{ blockedIps: BlockedIP[] }>({
    queryKey: ['ridps-blocked'],
    queryFn: () => api.get('/admin/intrusion-detection/blocked-ips'),
    refetchInterval: 30000,
  });

  const { data: detectorsData } = useQuery<{ detectors: Array<{ id: string; mitre?: string; standards: string[] }>; rules: DetectorRule[] }>({
    queryKey: ['ridps-detectors'],
    queryFn: () => api.get('/admin/intrusion-detection/detectors'),
  });

  const { data: config } = useQuery<RIDPSConfig>({
    queryKey: ['ridps-config'],
    queryFn: () => api.get('/admin/intrusion-detection/config'),
  });

  const { data: lockedAccountsData } = useQuery<{ lockedAccounts: LockedAccount[] }>({
    queryKey: ['ridps-locked-accounts'],
    queryFn: () => api.get('/admin/intrusion-detection/locked-accounts'),
    refetchInterval: 30000,
  });

  const { data: lockoutPolicyData } = useQuery<{ policy: LockoutPolicy | null }>({
    queryKey: ['ridps-lockout-policy'],
    queryFn: () => api.get('/admin/intrusion-detection/lockout-policy'),
  });

  // --- Mutations ---

  const blockIpMutation = useMutation({
    mutationFn: (data: typeof blockIpForm) =>
      api.post('/admin/intrusion-detection/blocked-ips', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ridps-blocked'] });
      queryClient.invalidateQueries({ queryKey: ['ridps-dashboard'] });
      setBlockIpForm({ ip: '', reason: '', severity: 'high', permanent: false });
    },
  });

  const unblockIpMutation = useMutation({
    mutationFn: (ip: string) =>
      api.delete(`/admin/intrusion-detection/blocked-ips/${encodeURIComponent(ip)}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ridps-blocked'] });
      queryClient.invalidateQueries({ queryKey: ['ridps-dashboard'] });
    },
  });

  const updateConfigMutation = useMutation({
    mutationFn: (data: Partial<RIDPSConfig>) =>
      api.put('/admin/intrusion-detection/config', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ridps-config'] });
    },
  });

  const toggleDetectorMutation = useMutation({
    mutationFn: ({ detectorId, enabled }: { detectorId: string; enabled: boolean }) =>
      api.put(`/admin/intrusion-detection/detectors/${detectorId}`, { enabled }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ridps-detectors'] });
    },
  });

  const updateIncidentMutation = useMutation({
    mutationFn: ({ incidentId, status, resolutionNotes }: { incidentId: string; status: string; resolutionNotes?: string }) =>
      api.put(`/admin/intrusion-detection/incidents/${incidentId}`, { status, resolutionNotes }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ridps-incidents'] });
      queryClient.invalidateQueries({ queryKey: ['ridps-dashboard'] });
    },
  });

  const killSessionMutation = useMutation({
    mutationFn: (data: { sessionId: string; reason?: string }) =>
      api.post('/admin/intrusion-detection/sessions/kill', data),
    onSuccess: () => {
      setSessionKillForm({ sessionId: '', reason: '' });
    },
  });

  const lockAccountMutation = useMutation({
    mutationFn: (data: { userId: string; reason?: string }) =>
      api.post('/admin/intrusion-detection/accounts/lock', data),
    onSuccess: () => {
      setAccountLockForm({ userId: '', reason: '' });
    },
  });

  const unlockAccountMutation = useMutation({
    mutationFn: (data: { userId: string }) =>
      api.post('/admin/intrusion-detection/accounts/unlock', data),
    onSuccess: () => {
      setAccountUnlockForm({ userId: '' });
      queryClient.invalidateQueries({ queryKey: ['ridps-locked-accounts'] });
      queryClient.invalidateQueries({ queryKey: ['ridps-dashboard'] });
    },
  });

  const events = eventsData?.events || [];
  const incidents = incidentsData?.incidents || [];
  const blockedIps = blockedData?.blockedIps || [];
  const rules = detectorsData?.rules || [];
  const lockedAccounts = lockedAccountsData?.lockedAccounts || [];
  const lockoutPolicy = lockoutPolicyData?.policy;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
            <Shield className="h-8 w-8 text-blue-600" />
            Intrusion Detection
          </h1>
          <p className="text-muted-foreground mt-1">
            Real-time threat detection and prevention — NIST SP 800-94, MITRE ATT&CK mapped
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => queryClient.invalidateQueries({ queryKey: ['ridps-dashboard'] })}
          >
            <RefreshCw className="h-4 w-4 mr-1" /> Refresh
          </Button>
          {config && (
            <Badge variant={config.enabled ? 'default' : 'destructive'} className="text-sm px-3 py-1">
              {config.enabled ? 'RIDPS Active' : 'RIDPS Disabled'}
            </Badge>
          )}
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Events (24h)</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{dashboard?.totalEvents24h || 0}</div>
            <p className="text-xs text-muted-foreground">
              {dashboard?.criticalEvents24h || 0} critical
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Incidents</CardTitle>
            <ShieldAlert className="h-4 w-4 text-red-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{dashboard?.activeIncidents || 0}</div>
            <p className="text-xs text-muted-foreground">Open or investigating</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Blocked IPs</CardTitle>
            <ShieldBan className="h-4 w-4 text-orange-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{dashboard?.blockedIps || 0}</div>
            <p className="text-xs text-muted-foreground">Active blocks</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Detectors</CardTitle>
            <Fingerprint className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{dashboard?.engine?.detectorCount || 0}</div>
            <p className="text-xs text-muted-foreground">
              {dashboard?.engine?.signalsProcessed || 0} signals processed
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="events">
            Events {events.length > 0 && <Badge variant="secondary" className="ml-1">{events.length}</Badge>}
          </TabsTrigger>
          <TabsTrigger value="incidents">
            Incidents {incidents.filter(i => i.status === 'open').length > 0 && (
              <Badge variant="destructive" className="ml-1">{incidents.filter(i => i.status === 'open').length}</Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="blocked">Blocked IPs</TabsTrigger>
          <TabsTrigger value="locked">
            Locked Accounts {lockedAccounts.length > 0 && (
              <Badge variant="destructive" className="ml-1">{lockedAccounts.length}</Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="response">Response Actions</TabsTrigger>
          <TabsTrigger value="detectors">Detectors</TabsTrigger>
          <TabsTrigger value="settings">Settings</TabsTrigger>
        </TabsList>

        {/* --- Overview Tab --- */}
        <TabsContent value="overview" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Top Detectors (24h)</CardTitle>
              </CardHeader>
              <CardContent>
                {(dashboard?.topDetectors || []).length === 0 ? (
                  <p className="text-sm text-muted-foreground">No detections in last 24 hours</p>
                ) : (
                  <div className="space-y-3">
                    {dashboard?.topDetectors.map(d => (
                      <div key={d.detectorId} className="flex items-center justify-between">
                        <span className="text-sm font-mono">{d.detectorId.replace(/_/g, ' ')}</span>
                        <Badge variant="secondary">{d.count}</Badge>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Top Source IPs (24h)</CardTitle>
              </CardHeader>
              <CardContent>
                {(dashboard?.topSourceIps || []).length === 0 ? (
                  <p className="text-sm text-muted-foreground">No attacks detected</p>
                ) : (
                  <div className="space-y-3">
                    {dashboard?.topSourceIps.map(ip => (
                      <div key={ip.ip} className="flex items-center justify-between">
                        <span className="text-sm font-mono">{ip.ip}</span>
                        <Badge variant="secondary">{ip.count} events</Badge>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Standards Compliance</CardTitle>
              <CardDescription>Implemented security standards and frameworks</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-2 md:grid-cols-3">
                {[
                  { standard: 'NIST SP 800-94', desc: 'IDPS Architecture' },
                  { standard: 'NIST CSF 2.0', desc: 'DE.CM / DE.AE' },
                  { standard: 'MITRE ATT&CK Cloud', desc: 'Technique-mapped detectors' },
                  { standard: 'OWASP ASVS 4.0', desc: 'V7, V11 controls' },
                  { standard: 'CIS Controls v8', desc: 'Controls 8, 13' },
                  { standard: 'SOC 2 CC7.2/CC7.3', desc: 'Monitoring & Anomaly' },
                  { standard: 'ISO 27001 A.8.15/16', desc: 'Logging & Monitoring' },
                  { standard: 'OWASP LLM Top 10', desc: 'AI-specific threats' },
                ].map(s => (
                  <div key={s.standard} className="flex items-center gap-2 p-2 rounded bg-muted/50">
                    <ShieldCheck className="h-4 w-4 text-green-600 shrink-0" />
                    <div>
                      <div className="text-sm font-medium">{s.standard}</div>
                      <div className="text-xs text-muted-foreground">{s.desc}</div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* --- Events Tab --- */}
        <TabsContent value="events">
          <Card>
            <CardHeader>
              <CardTitle>Recent Intrusion Events</CardTitle>
              <CardDescription>Real-time detection events from all 14 detectors</CardDescription>
            </CardHeader>
            <CardContent>
              {/* Active filter bar */}
              {(eventsFilter.userId || eventsFilter.sourceIp) && (
                <div className="flex items-center gap-2 mb-4 p-3 rounded-lg bg-blue-50 border border-blue-200">
                  <Filter className="h-4 w-4 text-blue-600" />
                  <span className="text-sm text-blue-800 font-medium">Filtered:</span>
                  {eventsFilter.userId && (
                    <Badge variant="secondary" className="gap-1">
                      User: {eventsFilter.userId.substring(0, 12)}...
                    </Badge>
                  )}
                  {eventsFilter.sourceIp && (
                    <Badge variant="secondary" className="gap-1">
                      IP: {eventsFilter.sourceIp}
                    </Badge>
                  )}
                  <Button
                    size="sm"
                    variant="ghost"
                    className="ml-auto h-7 text-blue-600"
                    onClick={() => setEventsFilter({})}
                  >
                    <X className="h-3 w-3 mr-1" /> Clear Filter
                  </Button>
                </div>
              )}
              {(() => {
                const filteredEvents = events.filter(evt => {
                  if (eventsFilter.userId && evt.userId !== eventsFilter.userId) return false;
                  if (eventsFilter.sourceIp && evt.sourceIp !== eventsFilter.sourceIp) return false;
                  return true;
                });
                if (filteredEvents.length === 0) {
                  return (
                    <p className="text-sm text-muted-foreground py-8 text-center">
                      {events.length > 0 && (eventsFilter.userId || eventsFilter.sourceIp)
                        ? 'No events match the current filter'
                        : 'No intrusion events detected'}
                    </p>
                  );
                }
                return (
                  <div className="space-y-2">
                    {filteredEvents.map(evt => (
                      <div key={evt.id} className="flex items-center gap-3 p-3 rounded-lg border hover:bg-muted/50">
                        <SeverityBadge severity={evt.severity} />
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-medium truncate">
                            {evt.detectorId.replace(/_/g, ' ')}
                            {evt.mitreTechnique && (
                              <Badge variant="outline" className="ml-2 text-xs">{evt.mitreTechnique}</Badge>
                            )}
                          </div>
                          <div className="text-xs text-muted-foreground flex gap-3 mt-0.5">
                            <button
                              className="font-mono hover:text-blue-600 hover:underline cursor-pointer"
                              onClick={() => setEventsFilter({ sourceIp: evt.sourceIp })}
                              title="Filter events by this IP"
                            >
                              {evt.sourceIp}
                            </button>
                            {evt.userId && (
                              <button
                                className="hover:text-blue-600 hover:underline cursor-pointer"
                                onClick={() => setEventsFilter({ userId: evt.userId })}
                                title="Filter events by this user"
                              >
                                User: {evt.userId.substring(0, 8)}...
                              </button>
                            )}
                            {evt.requestPath && <span>{evt.requestPath}</span>}
                            <span>{(evt.confidence * 100).toFixed(0)}% confidence</span>
                          </div>
                        </div>
                        <div className="text-xs text-muted-foreground whitespace-nowrap">
                          {new Date(evt.createdAt).toLocaleTimeString()}
                        </div>
                        <Badge variant="outline" className="text-xs">{evt.responseAction}</Badge>
                      </div>
                    ))}
                  </div>
                );
              })()}
            </CardContent>
          </Card>
        </TabsContent>

        {/* --- Incidents Tab --- */}
        <TabsContent value="incidents">
          <Card>
            <CardHeader>
              <CardTitle>Security Incidents</CardTitle>
              <CardDescription>Correlated event clusters requiring investigation — click actions to manage</CardDescription>
            </CardHeader>
            <CardContent>
              {incidents.length === 0 ? (
                <p className="text-sm text-muted-foreground py-8 text-center">No active incidents</p>
              ) : (
                <div className="space-y-3">
                  {incidents.map(inc => (
                    <div key={inc.id} className="p-4 rounded-lg border hover:bg-muted/50">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <SeverityBadge severity={inc.severity} />
                          <StatusBadge status={inc.status} />
                          <span className="text-sm font-medium">{inc.title}</span>
                        </div>
                        <span className="text-xs text-muted-foreground">
                          {new Date(inc.createdAt).toLocaleDateString()}
                        </span>
                      </div>
                      <div className="flex gap-4 text-xs text-muted-foreground mb-3">
                        <span>{inc.eventCount} events</span>
                        <span>{inc.sourceIps.length} source IPs</span>
                        {inc.mitreTechniques.length > 0 && (
                          <span>MITRE: {inc.mitreTechniques.join(', ')}</span>
                        )}
                        <span>
                          {new Date(inc.firstEventAt).toLocaleTimeString()} — {new Date(inc.lastEventAt).toLocaleTimeString()}
                        </span>
                      </div>
                      {inc.status !== 'resolved' && inc.status !== 'false_positive' && (
                        <div className="flex gap-2 pt-2 border-t">
                          {inc.status === 'open' && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => updateIncidentMutation.mutate({ incidentId: inc.id, status: 'investigating' })}
                              disabled={updateIncidentMutation.isPending}
                            >
                              <Eye className="h-3 w-3 mr-1" /> Investigate
                            </Button>
                          )}
                          {(inc.status === 'open' || inc.status === 'investigating') && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => updateIncidentMutation.mutate({ incidentId: inc.id, status: 'mitigated' })}
                              disabled={updateIncidentMutation.isPending}
                            >
                              <ShieldCheck className="h-3 w-3 mr-1" /> Mitigate
                            </Button>
                          )}
                          <Button
                            size="sm"
                            variant="default"
                            onClick={() => updateIncidentMutation.mutate({ incidentId: inc.id, status: 'resolved', resolutionNotes: 'Resolved by admin' })}
                            disabled={updateIncidentMutation.isPending}
                          >
                            <ShieldCheck className="h-3 w-3 mr-1" /> Resolve
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => updateIncidentMutation.mutate({ incidentId: inc.id, status: 'false_positive', resolutionNotes: 'Marked as false positive' })}
                            disabled={updateIncidentMutation.isPending}
                          >
                            False Positive
                          </Button>
                          {inc.sourceIps.map(ip => (
                            <Button
                              key={ip}
                              size="sm"
                              variant="destructive"
                              onClick={() => blockIpMutation.mutate({ ip, reason: `Blocked from incident ${inc.id}`, severity: inc.severity, permanent: false })}
                              disabled={blockIpMutation.isPending}
                            >
                              <Ban className="h-3 w-3 mr-1" /> Block {ip}
                            </Button>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* --- Locked Accounts Tab --- */}
        <TabsContent value="locked" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Currently Locked Accounts</CardTitle>
              <CardDescription>
                Accounts locked by RIDPS or admin action. Click a row to view lockout history linked to detections.
                {lockoutPolicy?.autoUnlockEnabled
                  ? ' Timed locks auto-expire. Permanent locks require admin review.'
                  : ' Auto-unlock is disabled — all locks require admin review.'}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {lockedAccounts.length === 0 ? (
                <p className="text-sm text-muted-foreground py-8 text-center">No accounts currently locked</p>
              ) : (
                <div className="space-y-3">
                  {lockedAccounts.map(acct => (
                    <div key={acct.userId} className="rounded-lg border">
                      {/* Account header row */}
                      <div className="p-4 hover:bg-muted/50">
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <Lock className="h-4 w-4 text-red-500" />
                            <span className="text-sm font-medium">{acct.displayName || acct.email}</span>
                            <span className="text-xs text-muted-foreground">{acct.userId.substring(0, 8)}...</span>
                            {acct.isPermanent ? (
                              <Badge variant="destructive">PERMANENT</Badge>
                            ) : (
                              <Badge variant="outline" className="bg-yellow-50 text-yellow-800 border-yellow-300">TIMED</Badge>
                            )}
                            <Badge variant="secondary">#{acct.lockCount} offense{acct.lockCount !== 1 ? 's' : ''}</Badge>
                          </div>
                          <div className="flex items-center gap-2">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => navigateToEvents({ userId: acct.userId })}
                              title="View intrusion events for this user"
                            >
                              <ExternalLink className="h-3 w-3 mr-1" /> View Events
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => navigateToIncidents()}
                              title="View related incidents"
                            >
                              <AlertTriangle className="h-3 w-3 mr-1" /> Incidents
                            </Button>
                            <Button
                              size="sm"
                              variant="default"
                              onClick={() => unlockAccountMutation.mutate({ userId: acct.userId })}
                              disabled={unlockAccountMutation.isPending}
                            >
                              <ShieldCheck className="h-3 w-3 mr-1" /> Unlock
                            </Button>
                          </div>
                        </div>
                        <div className="flex items-center gap-4 text-xs text-muted-foreground">
                          <span>Locked: {new Date(acct.lockedAt).toLocaleString()}</span>
                          {acct.lockedUntil && !acct.isPermanent && (
                            <span>Expires: {new Date(acct.lockedUntil).toLocaleString()}</span>
                          )}
                          <span>Reason: {acct.reason}</span>
                          <button
                            className="ml-auto flex items-center gap-1 text-blue-600 hover:underline cursor-pointer font-medium"
                            onClick={() => toggleLockoutHistory(acct.userId)}
                          >
                            <History className="h-3 w-3" />
                            {expandedLockoutUser === acct.userId ? 'Hide' : 'Show'} Lockout History
                            {expandedLockoutUser === acct.userId
                              ? <ChevronDown className="h-3 w-3" />
                              : <ChevronRight className="h-3 w-3" />}
                          </button>
                        </div>
                      </div>

                      {/* Expandable lockout history */}
                      {expandedLockoutUser === acct.userId && (
                        <div className="border-t bg-muted/30 p-4">
                          <h4 className="text-sm font-medium mb-3 flex items-center gap-1">
                            <History className="h-4 w-4" /> Lockout History for {acct.displayName || acct.email}
                          </h4>
                          {!lockoutHistoryCache[acct.userId] ? (
                            <p className="text-xs text-muted-foreground">Loading history...</p>
                          ) : lockoutHistoryCache[acct.userId].length === 0 ? (
                            <p className="text-xs text-muted-foreground">No lockout history found</p>
                          ) : (
                            <div className="space-y-2">
                              {lockoutHistoryCache[acct.userId].map(entry => (
                                <div key={entry.id} className="p-3 rounded border bg-background text-sm">
                                  <div className="flex items-center gap-2 mb-1">
                                    <SeverityBadge severity={entry.severity} />
                                    <span className="font-medium">
                                      Offense #{entry.offenseNumber}: {entry.reasonType.replace(/_/g, ' ')}
                                    </span>
                                    {entry.detectorId && (
                                      <Badge variant="outline" className="text-xs">
                                        {entry.detectorId.replace(/_/g, ' ')}
                                      </Badge>
                                    )}
                                    <Badge variant={entry.status === 'active' ? 'destructive' : 'secondary'} className="text-xs">
                                      {entry.status.replace(/_/g, ' ')}
                                    </Badge>
                                    {entry.isPermanent && (
                                      <Badge variant="destructive" className="text-xs">PERMANENT</Badge>
                                    )}
                                    {entry.durationMinutes && !entry.isPermanent && (
                                      <span className="text-xs text-muted-foreground">{entry.durationMinutes} min</span>
                                    )}
                                  </div>
                                  <div className="text-xs text-muted-foreground mb-2">{entry.reasonText}</div>
                                  <div className="flex items-center gap-3 text-xs text-muted-foreground flex-wrap">
                                    <span>Locked: {new Date(entry.lockedAt).toLocaleString()}</span>
                                    {entry.lockedUntil && (
                                      <span>Until: {new Date(entry.lockedUntil).toLocaleString()}</span>
                                    )}
                                    {entry.sourceIp && (
                                      <button
                                        className="font-mono text-blue-600 hover:underline cursor-pointer"
                                        onClick={() => navigateToEvents({ sourceIp: entry.sourceIp! })}
                                        title={`Filter events by source IP ${entry.sourceIp}`}
                                      >
                                        IP: {entry.sourceIp}
                                      </button>
                                    )}
                                    {entry.incidentId && (
                                      <button
                                        className="text-blue-600 hover:underline cursor-pointer font-medium"
                                        onClick={() => navigateToIncidents()}
                                        title={`View incident ${entry.incidentId}`}
                                      >
                                        Incident: {entry.incidentId.substring(0, 8)}...
                                      </button>
                                    )}
                                    {entry.resolvedAt && (
                                      <span className="text-green-600">
                                        Resolved: {new Date(entry.resolvedAt).toLocaleString()}
                                        {entry.resolutionNotes && ` — ${entry.resolutionNotes}`}
                                      </span>
                                    )}
                                  </div>
                                  {/* Cross-tab navigation links */}
                                  <div className="flex gap-2 mt-2 pt-2 border-t">
                                    <Button
                                      size="sm"
                                      variant="ghost"
                                      className="h-6 text-xs text-blue-600"
                                      onClick={() => navigateToEvents({ userId: acct.userId })}
                                    >
                                      <Eye className="h-3 w-3 mr-1" /> Events for User
                                    </Button>
                                    {entry.sourceIp && (
                                      <Button
                                        size="sm"
                                        variant="ghost"
                                        className="h-6 text-xs text-blue-600"
                                        onClick={() => navigateToEvents({ sourceIp: entry.sourceIp! })}
                                      >
                                        <Globe className="h-3 w-3 mr-1" /> Events from {entry.sourceIp}
                                      </Button>
                                    )}
                                    <Button
                                      size="sm"
                                      variant="ghost"
                                      className="h-6 text-xs text-blue-600"
                                      onClick={() => navigateToIncidents()}
                                    >
                                      <AlertTriangle className="h-3 w-3 mr-1" /> View Incidents
                                    </Button>
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-base">Lockout Policy</CardTitle>
                  <CardDescription>Progressive lockout durations and auto-unlock settings</CardDescription>
                </div>
                <Link href="/lockout-policy">
                  <Button variant="outline" size="sm">
                    <Settings className="h-3 w-3 mr-1" /> View & Edit Policy
                    <ExternalLink className="h-3 w-3 ml-1" />
                  </Button>
                </Link>
              </div>
            </CardHeader>
            {lockoutPolicy && (
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                  <div className="p-2 rounded bg-muted/50">
                    <p className="text-xs text-muted-foreground">1st</p>
                    <p className="font-medium">{lockoutPolicy.duration1st} min</p>
                  </div>
                  <div className="p-2 rounded bg-muted/50">
                    <p className="text-xs text-muted-foreground">2nd</p>
                    <p className="font-medium">{lockoutPolicy.duration2nd} min</p>
                  </div>
                  <div className="p-2 rounded bg-muted/50">
                    <p className="text-xs text-muted-foreground">3rd</p>
                    <p className="font-medium">{lockoutPolicy.duration3rd} min</p>
                  </div>
                  <div className="p-2 rounded bg-red-50 border border-red-200">
                    <p className="text-xs text-muted-foreground">Permanent</p>
                    <p className="font-medium text-red-700">After {lockoutPolicy.permanentAfter} offenses</p>
                  </div>
                </div>
              </CardContent>
            )}
          </Card>
        </TabsContent>

        {/* --- Response Actions Tab --- */}
        <TabsContent value="response" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Lock className="h-5 w-5" /> Kill Session
              </CardTitle>
              <CardDescription>Immediately revoke an active session by ID</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex gap-3 items-end">
                <div className="flex-1">
                  <Label>Session ID</Label>
                  <Input
                    placeholder="session-uuid"
                    value={sessionKillForm.sessionId}
                    onChange={e => setSessionKillForm(f => ({ ...f, sessionId: e.target.value }))}
                  />
                </div>
                <div className="flex-1">
                  <Label>Reason</Label>
                  <Input
                    placeholder="Suspicious activity"
                    value={sessionKillForm.reason}
                    onChange={e => setSessionKillForm(f => ({ ...f, reason: e.target.value }))}
                  />
                </div>
                <Button
                  variant="destructive"
                  onClick={() => killSessionMutation.mutate(sessionKillForm)}
                  disabled={!sessionKillForm.sessionId || killSessionMutation.isPending}
                >
                  <Lock className="h-4 w-4 mr-1" /> Kill Session
                </Button>
              </div>
              {killSessionMutation.isSuccess && (
                <p className="text-sm text-green-600 mt-2">Session terminated successfully</p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <ShieldBan className="h-5 w-5" /> Lock Account
              </CardTitle>
              <CardDescription>Lock a user account to prevent all access</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex gap-3 items-end">
                <div className="flex-1">
                  <Label>User ID</Label>
                  <Input
                    placeholder="user-uuid"
                    value={accountLockForm.userId}
                    onChange={e => setAccountLockForm(f => ({ ...f, userId: e.target.value }))}
                  />
                </div>
                <div className="flex-1">
                  <Label>Reason</Label>
                  <Input
                    placeholder="Compromised account"
                    value={accountLockForm.reason}
                    onChange={e => setAccountLockForm(f => ({ ...f, reason: e.target.value }))}
                  />
                </div>
                <Button
                  variant="destructive"
                  onClick={() => lockAccountMutation.mutate(accountLockForm)}
                  disabled={!accountLockForm.userId || lockAccountMutation.isPending}
                >
                  <ShieldBan className="h-4 w-4 mr-1" /> Lock Account
                </Button>
              </div>
              {lockAccountMutation.isSuccess && (
                <p className="text-sm text-green-600 mt-2">Account locked successfully</p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <ShieldCheck className="h-5 w-5" /> Unlock Account
              </CardTitle>
              <CardDescription>Restore access to a previously locked account</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex gap-3 items-end">
                <div className="flex-1">
                  <Label>User ID</Label>
                  <Input
                    placeholder="user-uuid"
                    value={accountUnlockForm.userId}
                    onChange={e => setAccountUnlockForm(f => ({ ...f, userId: e.target.value }))}
                  />
                </div>
                <Button
                  variant="default"
                  onClick={() => unlockAccountMutation.mutate(accountUnlockForm)}
                  disabled={!accountUnlockForm.userId || unlockAccountMutation.isPending}
                >
                  <ShieldCheck className="h-4 w-4 mr-1" /> Unlock Account
                </Button>
              </div>
              {unlockAccountMutation.isSuccess && (
                <p className="text-sm text-green-600 mt-2">Account unlocked successfully</p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* --- Blocked IPs Tab --- */}
        <TabsContent value="blocked" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Block IP Address</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex gap-3 items-end">
                <div className="flex-1">
                  <Label>IP Address</Label>
                  <Input
                    placeholder="192.168.1.100"
                    value={blockIpForm.ip}
                    onChange={e => setBlockIpForm(f => ({ ...f, ip: e.target.value }))}
                  />
                </div>
                <div className="flex-1">
                  <Label>Reason</Label>
                  <Input
                    placeholder="Manual block reason"
                    value={blockIpForm.reason}
                    onChange={e => setBlockIpForm(f => ({ ...f, reason: e.target.value }))}
                  />
                </div>
                <div className="w-32">
                  <Label>Severity</Label>
                  <Select value={blockIpForm.severity} onValueChange={v => setBlockIpForm(f => ({ ...f, severity: v }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="low">Low</SelectItem>
                      <SelectItem value="medium">Medium</SelectItem>
                      <SelectItem value="high">High</SelectItem>
                      <SelectItem value="critical">Critical</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <Button
                  onClick={() => blockIpMutation.mutate(blockIpForm)}
                  disabled={!blockIpForm.ip || blockIpMutation.isPending}
                >
                  <Ban className="h-4 w-4 mr-1" /> Block
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Active IP Blocks</CardTitle>
              <CardDescription>{blockedIps.length} IPs currently blocked</CardDescription>
            </CardHeader>
            <CardContent>
              {blockedIps.length === 0 ? (
                <p className="text-sm text-muted-foreground py-4 text-center">No blocked IPs</p>
              ) : (
                <div className="space-y-2">
                  {blockedIps.map(ip => (
                    <div key={ip.id} className="flex items-center gap-3 p-3 rounded-lg border">
                      <SeverityBadge severity={ip.severity} />
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-mono font-medium">{ip.ipAddress}</div>
                        <div className="text-xs text-muted-foreground">{ip.reason}</div>
                      </div>
                      <div className="text-xs text-muted-foreground text-right">
                        <div>{ip.source}</div>
                        <div>{ip.isPermanent ? 'Permanent' : `Expires ${ip.expiresAt ? new Date(ip.expiresAt).toLocaleString() : 'N/A'}`}</div>
                        <div>{ip.hitCount} hits</div>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => unblockIpMutation.mutate(ip.ipAddress)}
                        disabled={unblockIpMutation.isPending}
                      >
                        <Trash2 className="h-4 w-4 text-red-500" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* --- Detectors Tab --- */}
        <TabsContent value="detectors">
          <Card>
            <CardHeader>
              <CardTitle>Detection Rules</CardTitle>
              <CardDescription>14 MITRE ATT&CK-mapped detectors with configurable thresholds</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {rules.map(rule => (
                  <div key={rule.detectorId} className="flex items-center gap-3 p-4 rounded-lg border">
                    <Switch
                      checked={rule.enabled}
                      onCheckedChange={(enabled) =>
                        toggleDetectorMutation.mutate({ detectorId: rule.detectorId, enabled })
                      }
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium">
                          {rule.detectorId.replace(/_/g, ' ')}
                        </span>
                        {rule.mitreTechnique && (
                          <Badge variant="outline" className="text-xs">{rule.mitreTechnique}</Badge>
                        )}
                      </div>
                      <div className="text-xs text-muted-foreground mt-0.5">
                        {rule.description || 'No description'}
                      </div>
                      <div className="flex gap-2 mt-1">
                        {rule.standardRefs.map(ref => (
                          <Badge key={ref} variant="secondary" className="text-xs">{ref}</Badge>
                        ))}
                      </div>
                    </div>
                    <div className="text-xs text-right text-muted-foreground">
                      <div>Actions: {rule.responseActions.join(', ')}</div>
                      <div>Cooldown: {rule.cooldownSeconds}s</div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* --- Settings Tab --- */}
        <TabsContent value="settings">
          {config && (
            <Card>
              <CardHeader>
                <CardTitle>RIDPS Configuration</CardTitle>
                <CardDescription>Global intrusion detection system settings</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <Label>System Enabled</Label>
                      <Switch
                        checked={config.enabled}
                        onCheckedChange={(v) => updateConfigMutation.mutate({ enabled: v })}
                      />
                    </div>
                    <div className="flex items-center justify-between">
                      <Label>Auto-Block Enabled</Label>
                      <Switch
                        checked={config.autoBlockEnabled}
                        onCheckedChange={(v) => updateConfigMutation.mutate({ autoBlockEnabled: v })}
                      />
                    </div>
                    <div className="flex items-center justify-between">
                      <Label>WAF Sync Enabled</Label>
                      <Switch
                        checked={config.wafSyncEnabled}
                        onCheckedChange={(v) => updateConfigMutation.mutate({ wafSyncEnabled: v })}
                      />
                    </div>
                    <div className="flex items-center justify-between">
                      <Label>SENTINEL Escalation</Label>
                      <Switch
                        checked={config.sentinelEscalationEnabled}
                        onCheckedChange={(v) => updateConfigMutation.mutate({ sentinelEscalationEnabled: v })}
                      />
                    </div>
                  </div>
                  <div className="space-y-3">
                    <div>
                      <Label>Auto-Block Min Severity</Label>
                      <Select
                        value={config.autoBlockMinSeverity}
                        onValueChange={(v) => updateConfigMutation.mutate({ autoBlockMinSeverity: v as any })}
                      >
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="low">Low</SelectItem>
                          <SelectItem value="medium">Medium</SelectItem>
                          <SelectItem value="high">High</SelectItem>
                          <SelectItem value="critical">Critical</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label>IP Ban Duration (minutes)</Label>
                      <Input
                        type="number"
                        value={config.ipBanDurationMinutes}
                        onChange={(e) => updateConfigMutation.mutate({ ipBanDurationMinutes: parseInt(e.target.value) })}
                      />
                    </div>
                    <div>
                      <Label>Permanent Ban Threshold (repeat offenses)</Label>
                      <Input
                        type="number"
                        value={config.permanentBanThreshold}
                        onChange={(e) => updateConfigMutation.mutate({ permanentBanThreshold: parseInt(e.target.value) })}
                      />
                    </div>
                    <div>
                      <Label>Event Retention (days)</Label>
                      <Input
                        type="number"
                        value={config.eventRetentionDays}
                        onChange={(e) => updateConfigMutation.mutate({ eventRetentionDays: parseInt(e.target.value) })}
                      />
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
