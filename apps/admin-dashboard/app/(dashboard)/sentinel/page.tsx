'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  Bell,
  Shield,
  Activity,
  AlertTriangle,
  CheckCircle,
  Clock,
  ExternalLink,
  RefreshCw,
  Server,
  Zap,
  Eye,
  Settings,
  FileText,
  Play,
  XCircle,
  ChevronRight,
  Loader2,
  Volume2,
  ArrowUpRight,
} from 'lucide-react';

// ---------------------------------------------------------------------------
// Types (mirrors sentinel.types.ts for UI)
// ---------------------------------------------------------------------------

type SentinelSeverity = 1 | 2 | 3 | 4 | 5;
type AlertCategory = 'infrastructure' | 'security' | 'compliance' | 'application' | 'ai_model' | 'data' | 'billing' | 'performance' | 'availability' | 'tenant';
type IncidentStatus = 'detected' | 'triaged' | 'investigating' | 'identified' | 'mitigating' | 'resolved' | 'postmortem';
type ServiceHealthStatus = 'healthy' | 'degraded' | 'unhealthy' | 'unknown';
type CircuitBreakerState = 'closed' | 'open' | 'half_open';
type RemediationState = 'shadow' | 'active' | 'manual';

interface Alert {
  alertId: string;
  severity: SentinelSeverity;
  category: AlertCategory;
  status: string;
  service: string;
  region: string;
  title: string;
  message: string;
  source: string;
  occurrenceCount: number;
  complianceContext: string[];
  autoRemediationStatus: string;
  createdAt: string;
  acknowledgedBy?: string;
}

interface Incident {
  id: string;
  severity: SentinelSeverity;
  status: IncidentStatus;
  title: string;
  description?: string;
  category: AlertCategory;
  service: string;
  region?: string;
  complianceContext: string[];
  commanderId?: string;
  alertIds: string[];
  createdAt: string;
  acknowledgedAt?: string;
  resolvedAt?: string;
  durationSeconds?: number;
  rootCause?: string;
  postmortemId?: string;
}

interface TimelineEvent {
  id: string;
  incidentId: string;
  eventType: string;
  actor: string;
  message: string;
  createdAt: string;
}

interface ServiceHealth {
  serviceId: string;
  checkType: string;
  status: ServiceHealthStatus;
  lastCheck: string;
  latencyMs?: number;
  consecutiveFailures: number;
  circuitBreakerState: CircuitBreakerState;
}

interface RemediationRule {
  id: string;
  action: string;
  targetService: string;
  state: RemediationState;
  triggerCondition: string;
  cooldownMinutes: number;
  maxRetries: number;
  shadowModeStartedAt?: string;
  shadowModePromotedAt?: string;
  description: string;
  enabled: boolean;
}

interface ShadowLogEntry {
  id: string;
  ruleId: string;
  alertId: string;
  action: string;
  targetService: string;
  wouldHaveDone: string;
  createdAt: string;
}

interface Postmortem {
  id: string;
  incidentId: string;
  title: string;
  summary: string;
  rootCause: string;
  published: boolean;
  createdAt: string;
}

interface DashboardMetrics {
  totalIncidents24h: number;
  avgMttaMinutes: number;
  avgMttrMinutes: number;
  sev1Count24h: number;
  sev2Count24h: number;
  sev3Count24h: number;
  autoRemediation24h: number;
  activeAlerts: number;
}

type TabKey = 'dashboard' | 'alerts' | 'incidents' | 'oncall' | 'postmortems' | 'settings';

const API_BASE = '/api/admin/sentinel';

const SEVERITY_COLORS: Record<SentinelSeverity, string> = {
  1: 'bg-red-600 text-white',
  2: 'bg-orange-500 text-white',
  3: 'bg-yellow-500 text-black',
  4: 'bg-blue-500 text-white',
  5: 'bg-slate-500 text-white',
};

const SEVERITY_LABELS: Record<SentinelSeverity, string> = {
  1: 'Critical',
  2: 'Major',
  3: 'Moderate',
  4: 'Low',
  5: 'Info',
};

const HEALTH_COLORS: Record<ServiceHealthStatus, string> = {
  healthy: 'bg-green-500',
  degraded: 'bg-yellow-500',
  unhealthy: 'bg-red-500',
  unknown: 'bg-slate-500',
};

const STATUS_COLORS: Record<IncidentStatus, string> = {
  detected: 'bg-red-500',
  triaged: 'bg-orange-500',
  investigating: 'bg-yellow-500',
  identified: 'bg-blue-500',
  mitigating: 'bg-indigo-500',
  resolved: 'bg-green-500',
  postmortem: 'bg-slate-500',
};

const CB_ICONS: Record<CircuitBreakerState, string> = {
  closed: '🟢',
  open: '🔴',
  half_open: '🟡',
};

// ---------------------------------------------------------------------------
// Main Page Component
// ---------------------------------------------------------------------------

export default function SentinelPage() {
  const [activeTab, setActiveTab] = useState<TabKey>('dashboard');
  const [loading, setLoading] = useState(true);
  const [metrics, setMetrics] = useState<DashboardMetrics | null>(null);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [healthMap, setHealthMap] = useState<ServiceHealth[]>([]);
  const [circuitBreakers, setCircuitBreakers] = useState<Array<{ service: string; state: CircuitBreakerState; failureCount: number }>>([]);
  const [remediationRules, setRemediationRules] = useState<RemediationRule[]>([]);
  const [shadowLog, setShadowLog] = useState<ShadowLogEntry[]>([]);
  const [postmortems, setPostmortems] = useState<Postmortem[]>([]);
  const [selectedIncident, setSelectedIncident] = useState<Incident | null>(null);
  const [incidentTimeline, setIncidentTimeline] = useState<TimelineEvent[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  const fetchDashboard = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/dashboard`);
      if (!res.ok) throw new Error('Failed to fetch dashboard');
      const data = await res.json();
      setMetrics(data.metrics);
      setAlerts(data.recentAlerts || []);
      setIncidents(data.activeIncidents || []);
      setHealthMap(data.serviceHealthMap || []);
      setCircuitBreakers(data.circuitBreakers || []);
    } catch (err) {
      console.error('Dashboard fetch error:', err);
      // Use empty state on error
      setMetrics({ totalIncidents24h: 0, avgMttaMinutes: 0, avgMttrMinutes: 0, sev1Count24h: 0, sev2Count24h: 0, sev3Count24h: 0, autoRemediation24h: 0, activeAlerts: 0 });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDashboard();
    const interval = setInterval(fetchDashboard, 30000);
    return () => clearInterval(interval);
  }, [fetchDashboard]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await fetchDashboard();
    setRefreshing(false);
  };

  const fetchIncidentDetail = async (incident: Incident) => {
    setSelectedIncident(incident);
    try {
      const res = await fetch(`${API_BASE}/incidents/${incident.id}`);
      if (res.ok) {
        const data = await res.json();
        setIncidentTimeline(data.timeline || []);
      }
    } catch (err) {
      console.error('Incident detail fetch error:', err);
    }
  };

  const acknowledgeIncident = async (incidentId: string) => {
    try {
      await fetch(`${API_BASE}/incidents/${incidentId}/acknowledge`, { method: 'POST' });
      await fetchDashboard();
    } catch (err) {
      console.error('Acknowledge error:', err);
    }
  };

  const fetchRemediation = async () => {
    try {
      const [rulesRes, shadowRes] = await Promise.all([
        fetch(`${API_BASE}/remediation/rules`),
        fetch(`${API_BASE}/shadow-mode/log`),
      ]);
      if (rulesRes.ok) {
        const data = await rulesRes.json();
        setRemediationRules(data.rules || []);
      }
      if (shadowRes.ok) {
        const data = await shadowRes.json();
        setShadowLog(data.log || []);
      }
    } catch (err) {
      console.error('Remediation fetch error:', err);
    }
  };

  const fetchPostmortems = async () => {
    try {
      const res = await fetch(`${API_BASE}/postmortems`);
      if (res.ok) {
        const data = await res.json();
        setPostmortems(data.postmortems || []);
      }
    } catch (err) {
      console.error('Postmortems fetch error:', err);
    }
  };

  useEffect(() => {
    if (activeTab === 'settings') fetchRemediation();
    if (activeTab === 'postmortems') fetchPostmortems();
  }, [activeTab]);

  const tabs: { key: TabKey; label: string; icon: React.ComponentType<{ className?: string }>; badge?: number }[] = [
    { key: 'dashboard', label: 'Dashboard', icon: Activity, badge: metrics?.activeAlerts },
    { key: 'alerts', label: 'Alerts', icon: Bell, badge: alerts.filter(a => a.status === 'firing').length },
    { key: 'incidents', label: 'Incidents', icon: AlertTriangle, badge: incidents.filter(i => i.status !== 'resolved' && i.status !== 'postmortem').length },
    { key: 'oncall', label: 'On-Call', icon: ExternalLink },
    { key: 'postmortems', label: 'Post-Mortems', icon: FileText },
    { key: 'settings', label: 'Settings', icon: Settings },
  ];

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
        <span className="ml-3 text-lg text-slate-400">Loading SENTINEL...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-white flex items-center gap-3">
            <span className="p-2 bg-blue-600 rounded-lg"><Bell className="h-7 w-7" /></span>
            SENTINEL
          </h1>
          <p className="text-slate-400 mt-1">Alerting, Monitoring & Incident Response</p>
        </div>
        <div className="flex items-center gap-3">
          {metrics && metrics.sev1Count24h > 0 && (
            <div className="flex items-center gap-2 px-3 py-1.5 bg-red-600/20 border border-red-500/30 rounded-lg animate-pulse">
              <Volume2 className="h-4 w-4 text-red-400" />
              <span className="text-red-300 text-sm font-semibold">{metrics.sev1Count24h} SEV 1 (24h)</span>
            </div>
          )}
          <button onClick={handleRefresh} className="flex items-center gap-2 px-4 py-2 bg-slate-700 hover:bg-slate-600 rounded-lg text-sm text-white transition-colors">
            <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-white/10">
        {tabs.map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
              activeTab === tab.key
                ? 'border-blue-500 text-blue-400'
                : 'border-transparent text-slate-400 hover:text-white hover:border-slate-500'
            }`}
          >
            <tab.icon className="h-4 w-4" />
            {tab.label}
            {tab.badge !== undefined && tab.badge > 0 && (
              <span className="ml-1 px-1.5 py-0.5 text-xs bg-red-600 text-white rounded-full">{tab.badge}</span>
            )}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      {activeTab === 'dashboard' && <DashboardTab metrics={metrics} alerts={alerts} incidents={incidents} healthMap={healthMap} circuitBreakers={circuitBreakers} onSelectIncident={fetchIncidentDetail} />}
      {activeTab === 'alerts' && <AlertsTab alerts={alerts} />}
      {activeTab === 'incidents' && <IncidentsTab incidents={incidents} selectedIncident={selectedIncident} timeline={incidentTimeline} onSelectIncident={fetchIncidentDetail} onAcknowledge={acknowledgeIncident} />}
      {activeTab === 'oncall' && <OnCallTab />}
      {activeTab === 'postmortems' && <PostmortemsTab postmortems={postmortems} />}
      {activeTab === 'settings' && <SettingsTab rules={remediationRules} shadowLog={shadowLog} />}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Dashboard Tab
// ---------------------------------------------------------------------------

function DashboardTab({ metrics, alerts, incidents, healthMap, circuitBreakers, onSelectIncident }: {
  metrics: DashboardMetrics | null;
  alerts: Alert[];
  incidents: Incident[];
  healthMap: ServiceHealth[];
  circuitBreakers: Array<{ service: string; state: CircuitBreakerState; failureCount: number }>;
  onSelectIncident: (i: Incident) => void;
}) {
  return (
    <div className="space-y-6">
      {/* Severity Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
        <MetricCard label="Active Alerts" value={metrics?.activeAlerts ?? 0} color="blue" />
        <MetricCard label="SEV 1 (24h)" value={metrics?.sev1Count24h ?? 0} color="red" />
        <MetricCard label="SEV 2 (24h)" value={metrics?.sev2Count24h ?? 0} color="orange" />
        <MetricCard label="Incidents (24h)" value={metrics?.totalIncidents24h ?? 0} color="yellow" />
        <MetricCard label="MTTA (avg)" value={`${(metrics?.avgMttaMinutes ?? 0).toFixed(1)}m`} color="indigo" />
        <MetricCard label="MTTR (avg)" value={`${(metrics?.avgMttrMinutes ?? 0).toFixed(1)}m`} color="green" />
      </div>

      {/* Health Map Grid */}
      <div className="bg-slate-800/50 border border-white/10 rounded-lg p-4">
        <h3 className="text-lg font-semibold text-white mb-3 flex items-center gap-2">
          <Server className="h-5 w-5 text-slate-400" />
          Service Health Map
        </h3>
        {healthMap.length > 0 ? (
          <div className="grid grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
            {healthMap.map(svc => (
              <div key={`${svc.serviceId}-${svc.checkType}`} className="bg-slate-900/50 border border-white/5 rounded-lg p-3 text-center">
                <div className={`w-3 h-3 rounded-full mx-auto mb-2 ${HEALTH_COLORS[svc.status]}`} />
                <div className="text-xs font-medium text-white truncate">{svc.serviceId}</div>
                <div className="text-[10px] text-slate-500">{svc.latencyMs ? `${svc.latencyMs}ms` : svc.status}</div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-8 text-slate-500">
            <Server className="h-8 w-8 mx-auto mb-2 opacity-50" />
            <p className="text-sm">No health check data yet. Run synthetic checks to populate.</p>
          </div>
        )}
      </div>

      {/* Circuit Breakers */}
      {circuitBreakers.length > 0 && (
        <div className="bg-slate-800/50 border border-white/10 rounded-lg p-4">
          <h3 className="text-lg font-semibold text-white mb-3 flex items-center gap-2">
            <Zap className="h-5 w-5 text-yellow-400" />
            Circuit Breakers
          </h3>
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
            {circuitBreakers.map(cb => (
              <div key={cb.service} className="bg-slate-900/50 border border-white/5 rounded-lg p-3 flex items-center gap-2">
                <span>{CB_ICONS[cb.state]}</span>
                <div>
                  <div className="text-xs font-medium text-white">{cb.service}</div>
                  <div className="text-[10px] text-slate-500">{cb.state} ({cb.failureCount} failures)</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Active Incidents */}
      <div className="bg-slate-800/50 border border-white/10 rounded-lg p-4">
        <h3 className="text-lg font-semibold text-white mb-3 flex items-center gap-2">
          <AlertTriangle className="h-5 w-5 text-orange-400" />
          Active Incidents ({incidents.filter(i => i.status !== 'resolved' && i.status !== 'postmortem').length})
        </h3>
        {incidents.filter(i => i.status !== 'resolved' && i.status !== 'postmortem').length > 0 ? (
          <div className="space-y-2">
            {incidents.filter(i => i.status !== 'resolved' && i.status !== 'postmortem').map(inc => (
              <button key={inc.id} onClick={() => onSelectIncident(inc)} className="w-full flex items-center gap-3 p-3 bg-slate-900/50 border border-white/5 rounded-lg hover:bg-slate-900/80 transition-colors text-left">
                <span className={`px-2 py-0.5 text-xs font-bold rounded ${SEVERITY_COLORS[inc.severity]}`}>SEV {inc.severity}</span>
                <span className={`px-2 py-0.5 text-[10px] rounded ${STATUS_COLORS[inc.status]} text-white`}>{inc.status.toUpperCase()}</span>
                <span className="text-sm text-white flex-1 truncate">{inc.title}</span>
                <span className="text-xs text-slate-500">{new Date(inc.createdAt).toLocaleTimeString()}</span>
                <ChevronRight className="h-4 w-4 text-slate-500" />
              </button>
            ))}
          </div>
        ) : (
          <div className="text-center py-6 text-green-400">
            <CheckCircle className="h-8 w-8 mx-auto mb-2" />
            <p className="text-sm font-medium">All clear — no active incidents</p>
          </div>
        )}
      </div>

      {/* Recent Alerts */}
      <div className="bg-slate-800/50 border border-white/10 rounded-lg p-4">
        <h3 className="text-lg font-semibold text-white mb-3 flex items-center gap-2">
          <Bell className="h-5 w-5 text-blue-400" />
          Recent Alerts ({alerts.length})
        </h3>
        {alerts.length > 0 ? (
          <div className="space-y-1 max-h-64 overflow-y-auto">
            {alerts.slice(0, 20).map(alert => (
              <div key={alert.alertId} className="flex items-center gap-3 p-2 text-sm hover:bg-slate-900/50 rounded">
                <span className={`px-1.5 py-0.5 text-[10px] font-bold rounded ${SEVERITY_COLORS[alert.severity]}`}>S{alert.severity}</span>
                <span className="text-slate-400 text-xs w-20 truncate">{alert.category}</span>
                <span className="text-white flex-1 truncate">{alert.title}</span>
                <span className="text-slate-500 text-xs">{alert.occurrenceCount > 1 ? `×${alert.occurrenceCount}` : ''}</span>
                <span className="text-slate-500 text-xs">{new Date(alert.createdAt).toLocaleTimeString()}</span>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-center py-4 text-slate-500 text-sm">No recent alerts</p>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Alerts Tab
// ---------------------------------------------------------------------------

function AlertsTab({ alerts }: { alerts: Alert[] }) {
  const [filter, setFilter] = useState<{ severity?: SentinelSeverity; category?: string }>({});

  const filtered = alerts.filter(a => {
    if (filter.severity && a.severity !== filter.severity) return false;
    if (filter.category && a.category !== filter.category) return false;
    return true;
  });

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex gap-3 flex-wrap">
        <select
          value={filter.severity || ''}
          onChange={e => setFilter(f => ({ ...f, severity: e.target.value ? parseInt(e.target.value) as SentinelSeverity : undefined }))}
          className="bg-slate-800 border border-white/10 rounded-lg px-3 py-2 text-sm text-white"
        >
          <option value="">All Severities</option>
          {([1, 2, 3, 4, 5] as SentinelSeverity[]).map(s => (
            <option key={s} value={s}>SEV {s} — {SEVERITY_LABELS[s]}</option>
          ))}
        </select>
        <select
          value={filter.category || ''}
          onChange={e => setFilter(f => ({ ...f, category: e.target.value || undefined }))}
          className="bg-slate-800 border border-white/10 rounded-lg px-3 py-2 text-sm text-white"
        >
          <option value="">All Categories</option>
          {['infrastructure', 'security', 'compliance', 'application', 'ai_model', 'data', 'billing', 'performance', 'availability', 'tenant'].map(c => (
            <option key={c} value={c}>{c}</option>
          ))}
        </select>
      </div>

      {/* Alert List */}
      <div className="bg-slate-800/50 border border-white/10 rounded-lg divide-y divide-white/5">
        {filtered.length > 0 ? filtered.map(alert => (
          <div key={alert.alertId} className="p-4 hover:bg-slate-900/30 transition-colors">
            <div className="flex items-start gap-3">
              <span className={`px-2 py-0.5 text-xs font-bold rounded mt-0.5 ${SEVERITY_COLORS[alert.severity]}`}>SEV {alert.severity}</span>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-white font-medium text-sm">{alert.title}</span>
                  {alert.occurrenceCount > 1 && (
                    <span className="px-1.5 py-0.5 text-[10px] bg-slate-700 text-slate-300 rounded">×{alert.occurrenceCount}</span>
                  )}
                </div>
                <p className="text-slate-400 text-xs mt-1">{alert.message}</p>
                <div className="flex items-center gap-3 mt-2 text-xs text-slate-500">
                  <span>{alert.service}</span>
                  <span>{alert.category}</span>
                  <span>{alert.region}</span>
                  <span>{alert.source}</span>
                  {alert.complianceContext.length > 0 && alert.complianceContext[0] !== 'none' && (
                    <span className="text-orange-400">{alert.complianceContext.join(', ')}</span>
                  )}
                </div>
              </div>
              <div className="text-xs text-slate-500 whitespace-nowrap">
                {new Date(alert.createdAt).toLocaleString()}
              </div>
            </div>
          </div>
        )) : (
          <div className="p-8 text-center text-slate-500">
            <Bell className="h-8 w-8 mx-auto mb-2 opacity-50" />
            <p className="text-sm">No alerts match your filters</p>
          </div>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Incidents Tab
// ---------------------------------------------------------------------------

function IncidentsTab({ incidents, selectedIncident, timeline, onSelectIncident, onAcknowledge }: {
  incidents: Incident[];
  selectedIncident: Incident | null;
  timeline: TimelineEvent[];
  onSelectIncident: (i: Incident) => void;
  onAcknowledge: (id: string) => void;
}) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
      {/* Incident List */}
      <div className="lg:col-span-1 bg-slate-800/50 border border-white/10 rounded-lg overflow-hidden">
        <div className="p-3 border-b border-white/10">
          <h3 className="text-sm font-semibold text-white">Incidents ({incidents.length})</h3>
        </div>
        <div className="divide-y divide-white/5 max-h-[600px] overflow-y-auto">
          {incidents.map(inc => (
            <button
              key={inc.id}
              onClick={() => onSelectIncident(inc)}
              className={`w-full text-left p-3 hover:bg-slate-900/50 transition-colors ${selectedIncident?.id === inc.id ? 'bg-slate-900/70 border-l-2 border-blue-500' : ''}`}
            >
              <div className="flex items-center gap-2 mb-1">
                <span className={`px-1.5 py-0.5 text-[10px] font-bold rounded ${SEVERITY_COLORS[inc.severity]}`}>S{inc.severity}</span>
                <span className={`px-1.5 py-0.5 text-[10px] rounded ${STATUS_COLORS[inc.status]} text-white`}>{inc.status}</span>
              </div>
              <div className="text-sm text-white truncate">{inc.title}</div>
              <div className="text-xs text-slate-500 mt-1">{inc.service} • {new Date(inc.createdAt).toLocaleString()}</div>
            </button>
          ))}
          {incidents.length === 0 && (
            <div className="p-6 text-center text-slate-500 text-sm">No incidents</div>
          )}
        </div>
      </div>

      {/* Incident Detail */}
      <div className="lg:col-span-2 bg-slate-800/50 border border-white/10 rounded-lg p-4">
        {selectedIncident ? (
          <div className="space-y-4">
            <div className="flex items-start justify-between">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className={`px-2 py-0.5 text-xs font-bold rounded ${SEVERITY_COLORS[selectedIncident.severity]}`}>SEV {selectedIncident.severity}</span>
                  <span className={`px-2 py-0.5 text-xs rounded ${STATUS_COLORS[selectedIncident.status]} text-white`}>{selectedIncident.status.toUpperCase()}</span>
                  {selectedIncident.complianceContext?.length > 0 && selectedIncident.complianceContext[0] !== 'none' && (
                    <span className="px-2 py-0.5 text-xs bg-orange-600/20 text-orange-400 border border-orange-500/30 rounded">{selectedIncident.complianceContext.join(', ')}</span>
                  )}
                </div>
                <h3 className="text-lg font-semibold text-white">{selectedIncident.title}</h3>
                <p className="text-sm text-slate-400 mt-1">{selectedIncident.description}</p>
              </div>
              {selectedIncident.status === 'detected' && (
                <button
                  onClick={() => onAcknowledge(selectedIncident.id)}
                  className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white text-sm rounded-lg transition-colors"
                >
                  Acknowledge
                </button>
              )}
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
              <div className="bg-slate-900/50 rounded p-2">
                <span className="text-slate-500">Service</span>
                <div className="text-white font-medium">{selectedIncident.service}</div>
              </div>
              <div className="bg-slate-900/50 rounded p-2">
                <span className="text-slate-500">Category</span>
                <div className="text-white font-medium">{selectedIncident.category}</div>
              </div>
              <div className="bg-slate-900/50 rounded p-2">
                <span className="text-slate-500">Region</span>
                <div className="text-white font-medium">{selectedIncident.region || 'N/A'}</div>
              </div>
              <div className="bg-slate-900/50 rounded p-2">
                <span className="text-slate-500">Duration</span>
                <div className="text-white font-medium">{selectedIncident.durationSeconds ? `${Math.floor(selectedIncident.durationSeconds / 60)}m` : 'Ongoing'}</div>
              </div>
            </div>

            {/* Timeline */}
            <div>
              <h4 className="text-sm font-semibold text-white mb-2 flex items-center gap-2">
                <Clock className="h-4 w-4 text-slate-400" />
                Timeline
              </h4>
              {timeline.length > 0 ? (
                <div className="space-y-2 max-h-64 overflow-y-auto">
                  {timeline.map(evt => (
                    <div key={evt.id} className="flex items-start gap-3 text-xs">
                      <div className="w-2 h-2 mt-1.5 rounded-full bg-blue-500 flex-shrink-0" />
                      <div className="flex-1">
                        <span className="text-white">{evt.message}</span>
                        <span className="text-slate-500 ml-2">{evt.actor}</span>
                      </div>
                      <span className="text-slate-500 whitespace-nowrap">{new Date(evt.createdAt).toLocaleTimeString()}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-slate-500 text-xs">No timeline events yet</p>
              )}
            </div>
          </div>
        ) : (
          <div className="flex items-center justify-center h-64 text-slate-500">
            <div className="text-center">
              <AlertTriangle className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p className="text-sm">Select an incident to view details</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// On-Call Tab (PagerDuty Link)
// ---------------------------------------------------------------------------

function OnCallTab() {
  return (
    <div className="max-w-lg mx-auto text-center py-12">
      <div className="p-4 bg-green-600/10 border border-green-500/20 rounded-xl mb-6">
        <ExternalLink className="h-12 w-12 text-green-400 mx-auto mb-3" />
        <h3 className="text-xl font-semibold text-white mb-2">On-Call Management</h3>
        <p className="text-slate-400 text-sm mb-4">
          On-call scheduling, shift swaps, and escalation policies are managed through PagerDuty.
          SENTINEL detects issues; PagerDuty wakes humans up.
        </p>
        <a
          href="https://app.pagerduty.com"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 px-6 py-3 bg-green-600 hover:bg-green-500 text-white rounded-lg text-sm font-medium transition-colors"
        >
          Open PagerDuty Schedule
          <ArrowUpRight className="h-4 w-4" />
        </a>
      </div>
      <p className="text-xs text-slate-500">
        Per ratified design: Do Not Build Telephony. PagerDuty handles on-call rotation,
        phone/SMS escalation, and shift management.
      </p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Post-Mortems Tab
// ---------------------------------------------------------------------------

function PostmortemsTab({ postmortems }: { postmortems: Postmortem[] }) {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-white">Post-Mortems</h3>
      </div>

      {postmortems.length > 0 ? (
        <div className="bg-slate-800/50 border border-white/10 rounded-lg divide-y divide-white/5">
          {postmortems.map(pm => (
            <div key={pm.id} className="p-4 hover:bg-slate-900/30 transition-colors">
              <div className="flex items-center gap-3">
                <FileText className="h-5 w-5 text-slate-400" />
                <div className="flex-1">
                  <div className="text-sm text-white font-medium">{pm.title}</div>
                  <p className="text-xs text-slate-400 mt-1 line-clamp-2">{pm.summary}</p>
                  <div className="flex items-center gap-3 mt-2 text-xs text-slate-500">
                    <span>Root cause: {pm.rootCause.substring(0, 80)}...</span>
                  </div>
                </div>
                <div className="text-right">
                  {pm.published ? (
                    <span className="px-2 py-0.5 text-xs bg-green-600/20 text-green-400 rounded">Published</span>
                  ) : (
                    <span className="px-2 py-0.5 text-xs bg-yellow-600/20 text-yellow-400 rounded">Draft</span>
                  )}
                  <div className="text-xs text-slate-500 mt-1">{new Date(pm.createdAt).toLocaleDateString()}</div>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="bg-slate-800/50 border border-white/10 rounded-lg p-12 text-center">
          <CheckCircle className="h-10 w-10 text-green-400 mx-auto mb-3" />
          <p className="text-white font-medium">No post-mortems yet</p>
          <p className="text-slate-400 text-sm mt-1">Post-mortems are created after SEV 1-2 incidents are resolved</p>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Settings Tab (Shadow Mode, Remediation Rules, Preferences)
// ---------------------------------------------------------------------------

function SettingsTab({ rules, shadowLog }: { rules: RemediationRule[]; shadowLog: ShadowLogEntry[] }) {
  return (
    <div className="space-y-6">
      {/* Shadow Mode Banner */}
      <div className="bg-yellow-600/10 border border-yellow-500/20 rounded-lg p-4">
        <div className="flex items-center gap-2 mb-2">
          <Eye className="h-5 w-5 text-yellow-400" />
          <h3 className="text-sm font-semibold text-yellow-300">Shadow Mode</h3>
        </div>
        <p className="text-xs text-slate-400">
          New remediation rules run in Shadow Mode for 14 days (log-only, no execution).
          After 14 days without flapping, an engineer can promote them to Active.
          Stateful services (RDS) are ALWAYS manual — never auto-failover.
        </p>
      </div>

      {/* Remediation Rules */}
      <div className="bg-slate-800/50 border border-white/10 rounded-lg">
        <div className="p-3 border-b border-white/10">
          <h3 className="text-sm font-semibold text-white">Remediation Rules ({rules.length})</h3>
        </div>
        <div className="divide-y divide-white/5">
          {rules.map(rule => (
            <div key={rule.id} className="p-4">
              <div className="flex items-center gap-3">
                <span className={`px-2 py-0.5 text-[10px] font-bold rounded ${
                  rule.state === 'active' ? 'bg-green-600 text-white' :
                  rule.state === 'shadow' ? 'bg-yellow-600 text-white' :
                  'bg-slate-600 text-white'
                }`}>
                  {rule.state.toUpperCase()}
                </span>
                <div className="flex-1">
                  <div className="text-sm text-white font-medium">{rule.description}</div>
                  <div className="text-xs text-slate-500 mt-0.5">
                    {rule.action} → {rule.targetService} | Cooldown: {rule.cooldownMinutes}m | Max retries: {rule.maxRetries}
                  </div>
                </div>
                <span className={`text-xs ${rule.enabled ? 'text-green-400' : 'text-red-400'}`}>
                  {rule.enabled ? 'Enabled' : 'Disabled'}
                </span>
              </div>
              {rule.state === 'shadow' && rule.shadowModeStartedAt && (
                <div className="mt-2 text-xs text-yellow-400/80">
                  Shadow since: {new Date(rule.shadowModeStartedAt).toLocaleDateString()} 
                  ({Math.floor((Date.now() - new Date(rule.shadowModeStartedAt).getTime()) / (1000 * 60 * 60 * 24))} days)
                </div>
              )}
            </div>
          ))}
          {rules.length === 0 && (
            <div className="p-6 text-center text-slate-500 text-sm">No remediation rules configured</div>
          )}
        </div>
      </div>

      {/* Shadow Mode Log */}
      <div className="bg-slate-800/50 border border-white/10 rounded-lg">
        <div className="p-3 border-b border-white/10">
          <h3 className="text-sm font-semibold text-white flex items-center gap-2">
            <Eye className="h-4 w-4 text-yellow-400" />
            Shadow Mode Log ({shadowLog.length})
          </h3>
        </div>
        <div className="divide-y divide-white/5 max-h-64 overflow-y-auto">
          {shadowLog.map(entry => (
            <div key={entry.id} className="p-3 text-xs">
              <div className="flex items-center gap-2">
                <span className="text-yellow-400 font-medium">SHADOW</span>
                <span className="text-white">{entry.wouldHaveDone}</span>
              </div>
              <div className="text-slate-500 mt-1">
                {entry.action} → {entry.targetService} | {new Date(entry.createdAt).toLocaleString()}
              </div>
            </div>
          ))}
          {shadowLog.length === 0 && (
            <div className="p-4 text-center text-slate-500 text-sm">No shadow mode events recorded</div>
          )}
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Metric Card Component
// ---------------------------------------------------------------------------

function MetricCard({ label, value, color }: { label: string; value: number | string; color: string }) {
  const colorMap: Record<string, string> = {
    red: 'border-red-500/30 bg-red-600/10',
    orange: 'border-orange-500/30 bg-orange-600/10',
    yellow: 'border-yellow-500/30 bg-yellow-600/10',
    green: 'border-green-500/30 bg-green-600/10',
    blue: 'border-blue-500/30 bg-blue-600/10',
    indigo: 'border-indigo-500/30 bg-indigo-600/10',
  };
  const textMap: Record<string, string> = {
    red: 'text-red-400',
    orange: 'text-orange-400',
    yellow: 'text-yellow-400',
    green: 'text-green-400',
    blue: 'text-blue-400',
    indigo: 'text-indigo-400',
  };

  return (
    <div className={`border rounded-lg p-3 ${colorMap[color] || colorMap.blue}`}>
      <div className={`text-2xl font-bold ${textMap[color] || textMap.blue}`}>{value}</div>
      <div className="text-xs text-slate-400 mt-1">{label}</div>
    </div>
  );
}
