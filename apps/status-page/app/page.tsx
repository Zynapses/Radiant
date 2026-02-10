'use client';

import { useState, useEffect, useCallback } from 'react';
import { 
  CheckCircle2, 
  AlertTriangle, 
  XCircle, 
  Clock, 
  RefreshCw,
  ExternalLink,
  ChevronDown,
  ChevronRight,
  Globe,
  MapPin,
} from 'lucide-react';
import { formatDistanceToNow, format, subDays } from 'date-fns';

// Types (matching server types)
interface PublicSystemHealth {
  generatedAt: string;
  cacheExpiresAt: string;
  platformVersion: string;
  overallStatus: PublicHealthStatus;
  statusMessage: string;
  components: PublicComponentHealth[];
  incidents: PublicIncident[];
  scheduledMaintenance: PublicMaintenance[];
  uptimeHistory: UptimeRecord[];
  uptime: {
    last24Hours: number;
    last7Days: number;
    last30Days: number;
    last90Days: number;
  };
}

type PublicHealthStatus = 
  | 'operational'
  | 'degraded'
  | 'partial_outage'
  | 'major_outage'
  | 'maintenance';

interface PublicComponentHealth {
  name: string;
  description: string;
  status: PublicHealthStatus;
  statusMessage?: string;
  performanceIndicator?: 'normal' | 'slow' | 'very_slow';
  statusChangedAt?: string;
}

interface PublicIncident {
  id: string;
  title: string;
  status: 'investigating' | 'identified' | 'monitoring' | 'resolved';
  severity: 'minor' | 'major' | 'critical';
  affectedComponents: string[];
  createdAt: string;
  updatedAt: string;
  resolvedAt?: string;
  updates: { timestamp: string; status: string; message: string }[];
}

interface PublicMaintenance {
  id: string;
  title: string;
  description: string;
  affectedComponents: string[];
  scheduledStart: string;
  scheduledEnd: string;
  status: 'scheduled' | 'in_progress' | 'completed' | 'cancelled';
}

interface UptimeRecord {
  date: string;
  uptimePercentage: number;
  status: 'operational' | 'incident' | 'maintenance';
  incidentCount: number;
}

// Datacenter definitions
interface Datacenter {
  id: string;
  name: string;
  displayName: string;
  status: PublicHealthStatus;
}

const DATACENTERS: Datacenter[] = [
  { id: 'americas', name: 'Americas', displayName: 'Americas (US)', status: 'operational' },
  { id: 'europe', name: 'Europe', displayName: 'Europe (EU)', status: 'operational' },
  { id: 'asia', name: 'Asia Pacific', displayName: 'Asia Pacific', status: 'operational' },
];

// Configuration
const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || '';
const API_KEY = process.env.NEXT_PUBLIC_STATUS_API_KEY || '';
const COMPANY_NAME = process.env.NEXT_PUBLIC_COMPANY_NAME || 'RADIANT';
const REFRESH_INTERVAL = 60000; // 1 minute

export default function StatusPage() {
  const [health, setHealth] = useState<PublicSystemHealth | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [expandedIncidents, setExpandedIncidents] = useState<Set<string>>(new Set());
  const [selectedDatacenter, setSelectedDatacenter] = useState<string | null>(null);
  const [datacenterHealth, setDatacenterHealth] = useState<Record<string, PublicSystemHealth>>({});

  const fetchStatus = useCallback(async (datacenterId?: string | null) => {
    try {
      // Build URL with optional datacenter parameter
      const url = datacenterId 
        ? `${API_BASE_URL}/api/public/status?datacenter=${datacenterId}`
        : `${API_BASE_URL}/api/public/status`;
      
      const response = await fetch(url, {
        headers: {
          'X-API-Key': API_KEY,
        },
        cache: 'no-store',
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch status: ${response.status}`);
      }

      const data = await response.json();
      if (data.success) {
        if (datacenterId) {
          // Store per-datacenter health
          setDatacenterHealth(prev => ({ ...prev, [datacenterId]: data.data }));
        } else {
          // Store global aggregate health
          setHealth(data.data);
          // Also extract per-datacenter status from response if available
          if (data.data.datacenters) {
            const dcHealth: Record<string, PublicSystemHealth> = {};
            for (const dc of data.data.datacenters) {
              dcHealth[dc.id] = dc;
            }
            setDatacenterHealth(dcHealth);
          }
        }
        setLastUpdated(new Date());
        setError(null);
      } else {
        throw new Error(data.error?.message || 'Unknown error');
      }
    } catch (err) {
      console.error('Failed to fetch status:', err);
      setError(err instanceof Error ? err.message : 'Failed to load status');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStatus(selectedDatacenter);
    const interval = setInterval(() => fetchStatus(selectedDatacenter), REFRESH_INTERVAL);
    return () => clearInterval(interval);
  }, [fetchStatus, selectedDatacenter]);

  const handleDatacenterChange = (datacenterId: string | null) => {
    setSelectedDatacenter(datacenterId);
    setLoading(true);
  };

  // Get the effective health data (either selected datacenter or global)
  const effectiveHealth = selectedDatacenter 
    ? datacenterHealth[selectedDatacenter] 
    : health;

  // Calculate datacenter statuses from health data
  const getDatacenterStatus = (dcId: string): PublicHealthStatus => {
    const dcHealth = datacenterHealth[dcId];
    if (!dcHealth) return 'operational';
    return dcHealth.overallStatus;
  };

  const toggleIncident = (id: string) => {
    setExpandedIncidents(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <RefreshCw className="w-8 h-8 animate-spin mx-auto mb-4 text-indigo-500" />
          <p className="text-gray-600 dark:text-gray-400">Loading status...</p>
        </div>
      </div>
    );
  }

  if (error && !health) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <XCircle className="w-12 h-12 mx-auto mb-4 text-red-500" />
          <h2 className="text-xl font-semibold mb-2">Unable to Load Status</h2>
          <p className="text-gray-600 dark:text-gray-400 mb-4">{error}</p>
          <button
            onClick={() => fetchStatus()}
            className="px-4 py-2 bg-indigo-500 text-white rounded-lg hover:bg-indigo-600"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <main className="max-w-4xl mx-auto px-4 py-8">
      {/* Header */}
      <header className="text-center mb-8">
        <h1 className="text-3xl font-bold mb-2">{COMPANY_NAME} System Status</h1>
        {lastUpdated && (
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Last updated {formatDistanceToNow(lastUpdated, { addSuffix: true })}
            <button
              onClick={() => fetchStatus(selectedDatacenter)}
              className="ml-2 text-indigo-500 hover:text-indigo-600"
              title="Refresh"
            >
              <RefreshCw className="w-4 h-4 inline" />
            </button>
          </p>
        )}
      </header>

      {/* Datacenter Selector */}
      <section className="mb-8">
        <div className="flex items-center justify-center gap-2 mb-4">
          <Globe className="w-5 h-5 text-gray-500" />
          <span className="text-sm font-medium text-gray-600 dark:text-gray-400">Region:</span>
        </div>
        <div className="flex flex-wrap justify-center gap-2">
          <button
            onClick={() => handleDatacenterChange(null)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              selectedDatacenter === null
                ? 'bg-indigo-500 text-white'
                : 'bg-gray-100 dark:bg-slate-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-slate-700'
            }`}
          >
            <Globe className="w-4 h-4 inline mr-1" />
            Global (All Regions)
          </button>
          {DATACENTERS.map(dc => {
            const dcStatus = getDatacenterStatus(dc.id);
            const statusConfig = getStatusConfig(dcStatus);
            return (
              <button
                key={dc.id}
                onClick={() => handleDatacenterChange(dc.id)}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2 ${
                  selectedDatacenter === dc.id
                    ? 'bg-indigo-500 text-white'
                    : 'bg-gray-100 dark:bg-slate-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-slate-700'
                }`}
              >
                <MapPin className="w-4 h-4" />
                {dc.displayName}
                <span className={`w-2 h-2 rounded-full ${statusConfig.dotClass}`} />
              </button>
            );
          })}
        </div>
      </section>

      {effectiveHealth && (
        <>
          {/* Overall Status Banner */}
          <OverallStatusBanner 
            status={effectiveHealth.overallStatus} 
            message={selectedDatacenter 
              ? `${DATACENTERS.find(dc => dc.id === selectedDatacenter)?.displayName || 'Region'} Status`
              : effectiveHealth.statusMessage
            } 
          />

          {/* Active Incidents */}
          {effectiveHealth.incidents.filter(i => i.status !== 'resolved').length > 0 && (
            <section className="mb-8">
              <h2 className="text-lg font-semibold mb-4">Active Incidents</h2>
              <div className="space-y-4">
                {effectiveHealth.incidents
                  .filter(i => i.status !== 'resolved')
                  .map(incident => (
                    <IncidentCard
                      key={incident.id}
                      incident={incident}
                      expanded={expandedIncidents.has(incident.id)}
                      onToggle={() => toggleIncident(incident.id)}
                    />
                  ))}
              </div>
            </section>
          )}

          {/* Scheduled Maintenance */}
          {effectiveHealth.scheduledMaintenance.filter(m => m.status !== 'completed').length > 0 && (
            <section className="mb-8">
              <h2 className="text-lg font-semibold mb-4">Scheduled Maintenance</h2>
              <div className="space-y-4">
                {effectiveHealth.scheduledMaintenance
                  .filter(m => m.status !== 'completed')
                  .map(maintenance => (
                    <MaintenanceCard key={maintenance.id} maintenance={maintenance} />
                  ))}
              </div>
            </section>
          )}

          {/* Component Status */}
          <section className="mb-8">
            <h2 className="text-lg font-semibold mb-4">System Components</h2>
            <div className="bg-white dark:bg-slate-800 rounded-lg shadow-sm border border-gray-200 dark:border-slate-700 overflow-hidden">
              {effectiveHealth.components.map((component, index) => (
                <ComponentRow 
                  key={component.name} 
                  component={component}
                  isLast={index === effectiveHealth.components.length - 1}
                />
              ))}
            </div>
          </section>

          {/* Uptime History */}
          <section className="mb-8">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold">Uptime (Last 90 Days)</h2>
              <div className="text-right">
                <span className="text-2xl font-bold text-green-500">
                  {effectiveHealth.uptime.last90Days.toFixed(2)}%
                </span>
              </div>
            </div>
            <UptimeChart history={effectiveHealth.uptimeHistory} />
            <div className="flex justify-between mt-4 text-sm text-gray-500 dark:text-gray-400">
              <div>
                <span className="font-medium">24h:</span> {effectiveHealth.uptime.last24Hours.toFixed(2)}%
              </div>
              <div>
                <span className="font-medium">7d:</span> {effectiveHealth.uptime.last7Days.toFixed(2)}%
              </div>
              <div>
                <span className="font-medium">30d:</span> {effectiveHealth.uptime.last30Days.toFixed(2)}%
              </div>
              <div>
                <span className="font-medium">90d:</span> {effectiveHealth.uptime.last90Days.toFixed(2)}%
              </div>
            </div>
          </section>

          {/* Past Incidents */}
          {effectiveHealth.incidents.filter(i => i.status === 'resolved').length > 0 && (
            <section className="mb-8">
              <h2 className="text-lg font-semibold mb-4">Past Incidents</h2>
              <div className="space-y-4">
                {effectiveHealth.incidents
                  .filter(i => i.status === 'resolved')
                  .slice(0, 5)
                  .map(incident => (
                    <IncidentCard
                      key={incident.id}
                      incident={incident}
                      expanded={expandedIncidents.has(incident.id)}
                      onToggle={() => toggleIncident(incident.id)}
                    />
                  ))}
              </div>
            </section>
          )}
        </>
      )}

      {/* Footer */}
      <footer className="text-center text-sm text-gray-500 dark:text-gray-400 mt-12 pt-8 border-t border-gray-200 dark:border-slate-700">
        <p>
          © {new Date().getFullYear()} {COMPANY_NAME}. All rights reserved.
        </p>
        <p className="mt-1">
          Platform Version: {health?.platformVersion || 'Unknown'}
        </p>
      </footer>
    </main>
  );
}

// =============================================================================
// Components
// =============================================================================

function OverallStatusBanner({ status, message }: { status: PublicHealthStatus; message: string }) {
  const config = getStatusConfig(status);
  
  return (
    <div className={`rounded-lg p-6 mb-8 ${config.bgClass}`}>
      <div className="flex items-center gap-4">
        <div className={`w-4 h-4 rounded-full ${config.dotClass} ${config.pulseClass}`} />
        <div>
          <h2 className={`text-xl font-semibold ${config.textClass}`}>
            {config.label}
          </h2>
          <p className={`text-sm ${config.textClass} opacity-80`}>{message}</p>
        </div>
      </div>
    </div>
  );
}

function ComponentRow({ component, isLast }: { component: PublicComponentHealth; isLast: boolean }) {
  const config = getStatusConfig(component.status);
  
  return (
    <div className={`flex items-center justify-between p-4 ${!isLast ? 'border-b border-gray-100 dark:border-slate-700' : ''}`}>
      <h3 className="font-medium">{component.name}</h3>
      <span className={`flex items-center gap-1.5 text-sm font-medium px-3 py-1 rounded-full ${config.badgeClass}`}>
        {config.icon}
        {config.statusLabel}
      </span>
    </div>
  );
}

function IncidentCard({ 
  incident, 
  expanded, 
  onToggle 
}: { 
  incident: PublicIncident; 
  expanded: boolean;
  onToggle: () => void;
}) {
  const severityConfig = {
    minor: { bg: 'bg-yellow-50 dark:bg-yellow-900/20', text: 'text-yellow-800 dark:text-yellow-200', badge: 'bg-yellow-100 dark:bg-yellow-900' },
    major: { bg: 'bg-orange-50 dark:bg-orange-900/20', text: 'text-orange-800 dark:text-orange-200', badge: 'bg-orange-100 dark:bg-orange-900' },
    critical: { bg: 'bg-red-50 dark:bg-red-900/20', text: 'text-red-800 dark:text-red-200', badge: 'bg-red-100 dark:bg-red-900' },
  };
  
  const config = severityConfig[incident.severity];
  
  return (
    <div className={`rounded-lg border ${incident.status === 'resolved' ? 'border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800' : `border-transparent ${config.bg}`}`}>
      <button
        onClick={onToggle}
        className="w-full p-4 text-left flex items-start justify-between"
      >
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className={`text-xs font-medium px-2 py-0.5 rounded ${config.badge} ${config.text}`}>
              {incident.severity.toUpperCase()}
            </span>
            <span className="text-xs text-gray-500 dark:text-gray-400">
              {incident.status.replace('_', ' ').toUpperCase()}
            </span>
          </div>
          <h3 className="font-medium">{incident.title}</h3>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Started {formatDistanceToNow(new Date(incident.createdAt), { addSuffix: true })}
            {incident.resolvedAt && ` • Resolved ${formatDistanceToNow(new Date(incident.resolvedAt), { addSuffix: true })}`}
          </p>
        </div>
        {expanded ? <ChevronDown className="w-5 h-5" /> : <ChevronRight className="w-5 h-5" />}
      </button>
      
      {expanded && incident.updates.length > 0 && (
        <div className="px-4 pb-4 border-t border-gray-100 dark:border-slate-700 pt-4">
          <div className="space-y-4">
            {incident.updates.map((update, index) => (
              <div key={index} className="flex gap-4">
                <div className="w-2 h-2 rounded-full bg-gray-300 dark:bg-slate-600 mt-2 flex-shrink-0" />
                <div>
                  <p className="text-sm font-medium">{update.status}</p>
                  <p className="text-sm text-gray-600 dark:text-gray-400">{update.message}</p>
                  <p className="text-xs text-gray-400 dark:text-gray-500">
                    {format(new Date(update.timestamp), 'MMM d, yyyy h:mm a')}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function MaintenanceCard({ maintenance }: { maintenance: PublicMaintenance }) {
  return (
    <div className="rounded-lg border border-blue-200 dark:border-blue-900 bg-blue-50 dark:bg-blue-900/20 p-4">
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs font-medium px-2 py-0.5 rounded bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200">
              {maintenance.status === 'in_progress' ? 'IN PROGRESS' : 'SCHEDULED'}
            </span>
          </div>
          <h3 className="font-medium">{maintenance.title}</h3>
          <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">{maintenance.description}</p>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">
            <Clock className="w-4 h-4 inline mr-1" />
            {format(new Date(maintenance.scheduledStart), 'MMM d, h:mm a')} - {format(new Date(maintenance.scheduledEnd), 'MMM d, h:mm a')}
          </p>
          {maintenance.affectedComponents.length > 0 && (
            <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
              Affects: {maintenance.affectedComponents.join(', ')}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

function UptimeChart({ history }: { history: UptimeRecord[] }) {
  // Fill in missing days with 100% uptime
  const days = 90;
  const filledHistory: UptimeRecord[] = [];
  
  for (let i = 0; i < days; i++) {
    const date = format(subDays(new Date(), days - 1 - i), 'yyyy-MM-dd');
    const existing = history.find(h => h.date === date);
    filledHistory.push(existing || {
      date,
      uptimePercentage: 100,
      status: 'operational',
      incidentCount: 0,
    });
  }

  return (
    <div className="flex gap-0.5 h-8 overflow-hidden">
      {filledHistory.map((day) => (
        <div
          key={day.date}
          className="flex-1 min-w-[3px] rounded-sm transition-colors cursor-pointer hover:opacity-80"
          style={{
            backgroundColor: getUptimeColor(day.uptimePercentage, day.status),
          }}
          title={`${day.date}: ${day.uptimePercentage.toFixed(2)}% uptime${day.incidentCount > 0 ? ` (${day.incidentCount} incident${day.incidentCount > 1 ? 's' : ''})` : ''}`}
        />
      ))}
    </div>
  );
}

// =============================================================================
// Helpers
// =============================================================================

function getStatusConfig(status: PublicHealthStatus) {
  const configs = {
    operational: {
      label: 'All Systems Operational',
      statusLabel: 'Operational',
      bgClass: 'bg-green-50 dark:bg-green-900/20',
      badgeClass: 'bg-green-100 dark:bg-green-900/40 text-green-800 dark:text-green-200',
      textClass: 'text-green-800 dark:text-green-200',
      dotClass: 'bg-green-500',
      pulseClass: 'status-operational',
      icon: <CheckCircle2 className="w-4 h-4" />,
    },
    degraded: {
      label: 'Degraded Performance',
      statusLabel: 'Degraded',
      bgClass: 'bg-yellow-50 dark:bg-yellow-900/20',
      badgeClass: 'bg-yellow-100 dark:bg-yellow-900/40 text-yellow-800 dark:text-yellow-200',
      textClass: 'text-yellow-800 dark:text-yellow-200',
      dotClass: 'bg-yellow-500',
      pulseClass: 'status-degraded',
      icon: <AlertTriangle className="w-4 h-4" />,
    },
    partial_outage: {
      label: 'Partial Outage',
      statusLabel: 'Partial Outage',
      bgClass: 'bg-orange-50 dark:bg-orange-900/20',
      badgeClass: 'bg-orange-100 dark:bg-orange-900/40 text-orange-800 dark:text-orange-200',
      textClass: 'text-orange-800 dark:text-orange-200',
      dotClass: 'bg-orange-500',
      pulseClass: 'status-degraded',
      icon: <AlertTriangle className="w-4 h-4" />,
    },
    major_outage: {
      label: 'Major Outage',
      statusLabel: 'Outage',
      bgClass: 'bg-red-50 dark:bg-red-900/20',
      badgeClass: 'bg-red-100 dark:bg-red-900/40 text-red-800 dark:text-red-200',
      textClass: 'text-red-800 dark:text-red-200',
      dotClass: 'bg-red-500',
      pulseClass: 'status-outage',
      icon: <XCircle className="w-4 h-4" />,
    },
    maintenance: {
      label: 'Under Maintenance',
      statusLabel: 'Maintenance',
      bgClass: 'bg-blue-50 dark:bg-blue-900/20',
      badgeClass: 'bg-blue-100 dark:bg-blue-900/40 text-blue-800 dark:text-blue-200',
      textClass: 'text-blue-800 dark:text-blue-200',
      dotClass: 'bg-blue-500',
      pulseClass: '',
      icon: <Clock className="w-4 h-4" />,
    },
  };
  
  return configs[status] || configs.operational;
}

function getUptimeColor(percentage: number, status: string): string {
  if (status === 'maintenance') return '#60a5fa'; // blue
  if (percentage >= 99.9) return '#22c55e'; // green
  if (percentage >= 99) return '#84cc16'; // lime
  if (percentage >= 95) return '#eab308'; // yellow
  if (percentage >= 90) return '#f97316'; // orange
  return '#ef4444'; // red
}
