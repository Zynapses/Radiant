'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  Archive, RefreshCw, ShieldCheck, ShieldAlert, ShieldX, AlertTriangle,
  Database, HardDrive, Snowflake, Clock, FileText, Lock, Unlock,
  ChevronDown, ChevronRight, CheckCircle2, XCircle, Info, Server,
  Activity, MessageSquare, DollarSign, Shield, Cpu, Users2, Layers,
  BarChart3, Settings, Save, Check, Search, Download, Upload, Trash2,
  Play, Eye, FileBarChart, Link2, Hash, Fingerprint, RotateCcw,
  Plus, ExternalLink, StopCircle, Loader2, Copy, ArrowUpDown,
} from 'lucide-react';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type LogCategory = 'audit' | 'security' | 'ai_model' | 'compliance' | 'billing' | 'infrastructure' | 'application' | 'collaboration';
type StorageTier = 'hot' | 'warm' | 'cold' | 'deep_archive';

interface EffectiveRetention {
  category: LogCategory;
  retentionDays: number;
  hotDays: number;
  warmDays: number;
  maxRetentionDays: number | null;
  immutable: boolean;
  tamperEvident: boolean;
  drivingCompliance: string;
  drivingRegulation: string | null;
  hasOverride: boolean;
  overrideRetentionDays: number | null;
  conflictWithGdpr: boolean;
}

interface ComplianceIssue {
  severity: 'critical' | 'warning' | 'info';
  category: LogCategory;
  issue: string;
  complianceKey: string;
  regulation: string | null;
  recommendation: string;
}

interface StorageBreakdown {
  tier: StorageTier;
  totalBytes: number;
  totalEntries: number;
  oldestEntry: string | null;
  newestEntry: string | null;
}

interface SourcesSummary {
  totalSources: number;
  activeSources: number;
  enforcedSources: number;
  unenforced: number;
  byCategory: Record<LogCategory, number>;
}

interface Dashboard {
  tenantId: string;
  activeComplianceLicenses: string[];
  effectiveRetention: EffectiveRetention[];
  storageBreakdown: StorageBreakdown[];
  sourcesSummary: SourcesSummary;
  complianceIssues: ComplianceIssue[];
}

interface LogReport {
  id: string;
  tenantId: string;
  reportType: string;
  title: string;
  description: string | null;
  status: string;
  startedAt: string | null;
  completedAt: string | null;
  durationMs: number | null;
  summary: Record<string, unknown> | null;
  findings: unknown[];
  recommendations: unknown[];
  fileSizeBytes: number | null;
  generatedBy: string;
  createdAt: string;
}

interface RestoreJob {
  id: string;
  restoreType: string;
  categories: LogCategory[];
  retrievalTier: string;
  status: string;
  totalArchives: number;
  restoredArchives: number;
  failedArchives: number;
  totalBytes: number;
  restoredBytes: number;
  progressPct: number;
  estimatedReadyAt: string | null;
  completedAt: string | null;
  requestedBy: string;
  requestReason: string | null;
  createdAt: string;
}

interface ExportJob {
  id: string;
  exportName: string;
  categories: LogCategory[];
  dateRangeStart: string | null;
  dateRangeEnd: string | null;
  includeAllTime: boolean;
  format: string;
  status: string;
  totalEntries: number;
  exportedEntries: number;
  progressPct: number;
  downloadUrl: string | null;
  downloadExpiresAt: string | null;
  fileSizeBytes: number | null;
  includesHot: boolean;
  includesWarm: boolean;
  includesCold: boolean;
  includesDeep: boolean;
  durationMs: number | null;
  requestedBy: string;
  createdAt: string;
}

interface MerkleChainStatus {
  chainLength: number;
  latestSequence: number;
  latestMerkleRoot: string | null;
  oldestEntry: string | null;
  newestEntry: string | null;
  unverifiedCount: number;
  tamperedCount: number;
  validCount: number;
  byCategory: Record<string, number>;
}

interface ErasureRequest {
  id: string;
  tenantId: string;
  targetUserId: string | null;
  categories: LogCategory[];
  exemptCategories: LogCategory[];
  exemptionReasons: Record<string, string>;
  status: string;
  totalEntries: number;
  erasedEntries: number;
  exemptEntries: number;
  progressPct: number;
  erasureCertificateHash: string | null;
  approvedBy: string | null;
  approvedAt: string | null;
  rejectionReason: string | null;
  requestedBy: string;
  createdAt: string;
}

interface SearchResult {
  id: string;
  tenantId: string | null;
  category: LogCategory;
  timestamp: string;
  level: string;
  service: string;
  message: string;
  requestId: string | null;
  userId: string | null;
  metadata: Record<string, unknown>;
}

type TabKey = 'retention' | 'sources' | 'storage' | 'compliance' | 'search' | 'reports' | 'restore' | 'export' | 'verification' | 'erasure';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const CATEGORY_META: Record<LogCategory, { label: string; icon: typeof Archive; color: string; description: string }> = {
  audit:          { label: 'Audit',          icon: FileText,       color: 'text-blue-400',    description: 'User actions, admin changes, data access' },
  security:       { label: 'Security',       icon: Shield,         color: 'text-red-400',     description: 'Auth events, MFA, failed logins, permission denials' },
  ai_model:       { label: 'AI / Model',     icon: Cpu,            color: 'text-purple-400',  description: 'Prompt execution, token usage, model selection' },
  compliance:     { label: 'Compliance',      icon: ShieldCheck,    color: 'text-amber-400',   description: 'PHI access, data exports, erasure, consent' },
  billing:        { label: 'Billing',         icon: DollarSign,     color: 'text-green-400',   description: 'Usage events, cost attribution, guest costs' },
  infrastructure: { label: 'Infrastructure',  icon: Server,         color: 'text-slate-400',   description: 'Lambda execution, CDK deploys, health checks' },
  application:    { label: 'Application',     icon: Activity,       color: 'text-cyan-400',    description: 'API calls, errors, warnings, cold starts' },
  collaboration:  { label: 'Collaboration',   icon: Users2,         color: 'text-pink-400',    description: 'Guest joins, session events, restriction enforcement' },
};

const TIER_META: Record<StorageTier, { label: string; icon: typeof Database; color: string }> = {
  hot:          { label: 'Hot (Aurora)',           icon: Database,  color: 'text-orange-400' },
  warm:         { label: 'Warm (S3 Standard)',     icon: HardDrive, color: 'text-yellow-400' },
  cold:         { label: 'Cold (Glacier)',         icon: Snowflake, color: 'text-blue-400' },
  deep_archive: { label: 'Deep Archive (Glacier)', icon: Archive,   color: 'text-slate-500' },
};

const COMPLIANCE_LABELS: Record<string, string> = {
  none: 'Default', hipaa: 'HIPAA', hipaa_retention: 'HIPAA Retention', gdpr: 'GDPR',
  soc2: 'SOC 2', ccpa: 'CCPA', iso27001: 'ISO 27001', pci_dss: 'PCI DSS',
  fedramp: 'FedRAMP', hitrust: 'HITRUST', eu_ai_act: 'EU AI Act',
};

const API = '/api/admin/log-retention';

async function fetchApi(path: string, options?: RequestInit) {
  const res = await fetch(`${API}${path}`, { headers: { 'Content-Type': 'application/json' }, ...options });
  if (!res.ok) throw new Error(`API error: ${res.status}`);
  return res.json();
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return `${(bytes / Math.pow(1024, i)).toFixed(1)} ${units[i]}`;
}

function formatDays(days: number): string {
  if (days >= 365) { const y = days / 365; return y === Math.floor(y) ? `${y} yr` : `${y.toFixed(1)} yr`; }
  return `${days}d`;
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function LogRetentionPage() {
  const [dashboard, setDashboard] = useState<Dashboard | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedTenant, setSelectedTenant] = useState<string>('');
  const [expandedCategory, setExpandedCategory] = useState<LogCategory | null>(null);
  const [activeTab, setActiveTab] = useState<TabKey>('retention');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const tenantParam = selectedTenant ? `?tenantId=${selectedTenant}` : '';
      const data = await fetchApi(`/dashboard${tenantParam}`);
      setDashboard(data.dashboard || data);
    } catch (err) {
      console.error('Failed to load log retention dashboard', err);
    } finally {
      setLoading(false);
    }
  }, [selectedTenant]);

  useEffect(() => { load(); }, [load]);

  if (loading || !dashboard) {
    return <div className="flex items-center justify-center h-64"><RefreshCw className="h-8 w-8 animate-spin text-violet-400" /></div>;
  }

  const hasCompliance = dashboard.activeComplianceLicenses.length > 0;
  const criticalIssues = dashboard.complianceIssues.filter(i => i.severity === 'critical');
  const warningIssues = dashboard.complianceIssues.filter(i => i.severity === 'warning');

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-3">
            <Archive className="h-7 w-7 text-violet-400" />
            Log Retention & Compliance
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Manage log retention policies, storage tiers, and regulatory compliance across all log categories
          </p>
        </div>
        <button onClick={load} className="px-3 py-2 bg-slate-700 hover:bg-slate-600 text-white text-sm rounded-lg flex items-center gap-2">
          <RefreshCw className="h-4 w-4" /> Refresh
        </button>
      </div>

      {/* Compliance License Banner */}
      {hasCompliance && (
        <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-4">
          <div className="flex items-start gap-3">
            <ShieldCheck className="h-5 w-5 text-amber-400 mt-0.5" />
            <div>
              <p className="text-sm font-semibold text-amber-200">Active Compliance Licenses</p>
              <div className="flex flex-wrap gap-2 mt-2">
                {dashboard.activeComplianceLicenses.map(l => (
                  <span key={l} className="px-2.5 py-1 rounded-full bg-amber-500/20 border border-amber-500/30 text-xs font-medium text-amber-300">
                    {COMPLIANCE_LABELS[l] || l}
                  </span>
                ))}
              </div>
              <p className="text-xs text-amber-300/70 mt-2">
                These licenses enforce minimum retention periods, immutability requirements, and tamper-evident logging.
                Retention cannot be reduced below compliance minimums.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Critical Issues */}
      {criticalIssues.length > 0 && (
        <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4 space-y-2">
          <p className="text-sm font-semibold text-red-300 flex items-center gap-2">
            <AlertTriangle className="h-4 w-4" /> {criticalIssues.length} Critical Compliance Issue{criticalIssues.length > 1 ? 's' : ''}
          </p>
          {criticalIssues.map((issue, i) => (
            <div key={i} className="flex items-start gap-2 text-xs text-red-300/80">
              <XCircle className="h-3.5 w-3.5 mt-0.5 flex-shrink-0 text-red-400" />
              <div>
                <span className="font-medium">{CATEGORY_META[issue.category].label}:</span>{' '}
                {issue.issue}
                <span className="block text-red-400/60 mt-0.5">{issue.recommendation}</span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Summary Cards */}
      <div className="grid grid-cols-4 gap-4">
        <div className="bg-slate-800/30 border border-slate-700/50 rounded-xl p-4">
          <p className="text-xs text-slate-400">Log Sources</p>
          <p className="text-2xl font-bold text-white mt-1">{dashboard.sourcesSummary.totalSources}</p>
          <div className="flex items-center gap-2 mt-2 text-xs">
            <span className="text-emerald-400">{dashboard.sourcesSummary.enforcedSources} enforced</span>
            {dashboard.sourcesSummary.unenforced > 0 && (
              <span className="text-amber-400">{dashboard.sourcesSummary.unenforced} unenforced</span>
            )}
          </div>
        </div>
        <div className="bg-slate-800/30 border border-slate-700/50 rounded-xl p-4">
          <p className="text-xs text-slate-400">Total Archived</p>
          <p className="text-2xl font-bold text-white mt-1">
            {formatBytes(dashboard.storageBreakdown.reduce((sum, s) => sum + s.totalBytes, 0))}
          </p>
          <p className="text-xs text-slate-500 mt-2">
            {dashboard.storageBreakdown.reduce((sum, s) => sum + s.totalEntries, 0).toLocaleString()} index entries
          </p>
        </div>
        <div className="bg-slate-800/30 border border-slate-700/50 rounded-xl p-4">
          <p className="text-xs text-slate-400">Log Categories</p>
          <p className="text-2xl font-bold text-white mt-1">8</p>
          <p className="text-xs text-slate-500 mt-2">
            {dashboard.effectiveRetention.filter(r => r.immutable).length} immutable
          </p>
        </div>
        <div className="bg-slate-800/30 border border-slate-700/50 rounded-xl p-4">
          <p className="text-xs text-slate-400">Compliance Issues</p>
          <p className={`text-2xl font-bold mt-1 ${criticalIssues.length > 0 ? 'text-red-400' : warningIssues.length > 0 ? 'text-amber-400' : 'text-emerald-400'}`}>
            {dashboard.complianceIssues.length}
          </p>
          <p className="text-xs text-slate-500 mt-2">
            {criticalIssues.length} critical, {warningIssues.length} warnings
          </p>
        </div>
      </div>

      {/* Tabs — two rows for 10 tabs */}
      <div className="border-b border-slate-700/50">
        <div className="flex gap-1 flex-wrap">
          {([
            { key: 'retention' as TabKey, label: 'Retention', icon: Clock },
            { key: 'sources' as TabKey, label: 'Sources', icon: Server },
            { key: 'storage' as TabKey, label: 'Storage', icon: Layers },
            { key: 'compliance' as TabKey, label: 'Compliance', icon: ShieldCheck },
            { key: 'search' as TabKey, label: 'Log Search', icon: Search },
            { key: 'reports' as TabKey, label: 'Reports', icon: FileBarChart },
            { key: 'restore' as TabKey, label: 'Glacier Restore', icon: RotateCcw },
            { key: 'export' as TabKey, label: 'Export', icon: Download },
            { key: 'verification' as TabKey, label: 'Verification', icon: Fingerprint },
            { key: 'erasure' as TabKey, label: 'GDPR Erasure', icon: Trash2 },
          ]).map(tab => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`px-3 py-2 text-xs font-medium flex items-center gap-1.5 border-b-2 transition-colors ${
                activeTab === tab.key
                  ? 'border-violet-500 text-violet-300'
                  : 'border-transparent text-slate-400 hover:text-slate-300'
              }`}
            >
              <tab.icon className="h-3.5 w-3.5" /> {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Tab Content */}
      {activeTab === 'retention' && (
        <RetentionPoliciesTab
          retention={dashboard.effectiveRetention}
          hasCompliance={hasCompliance}
          expandedCategory={expandedCategory}
          onToggleExpand={(c) => setExpandedCategory(expandedCategory === c ? null : c)}
        />
      )}
      {activeTab === 'sources' && <LogSourcesTab summary={dashboard.sourcesSummary} />}
      {activeTab === 'storage' && <StorageTiersTab breakdown={dashboard.storageBreakdown} />}
      {activeTab === 'compliance' && (
        <ComplianceMatrixTab
          retention={dashboard.effectiveRetention}
          issues={dashboard.complianceIssues}
          licenses={dashboard.activeComplianceLicenses}
        />
      )}
      {activeTab === 'search' && <LogSearchTab />}
      {activeTab === 'reports' && <ReportsTab />}
      {activeTab === 'restore' && <GlacierRestoreTab />}
      {activeTab === 'export' && <ExportTab />}
      {activeTab === 'verification' && <VerificationTab />}
      {activeTab === 'erasure' && <GdprErasureTab />}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Tab: Retention Policies
// ---------------------------------------------------------------------------

function RetentionPoliciesTab({
  retention,
  hasCompliance,
  expandedCategory,
  onToggleExpand,
}: {
  retention: EffectiveRetention[];
  hasCompliance: boolean;
  expandedCategory: LogCategory | null;
  onToggleExpand: (c: LogCategory) => void;
}) {
  return (
    <div className="space-y-3">
      {retention.map(ret => {
        const meta = CATEGORY_META[ret.category];
        const Icon = meta.icon;
        const expanded = expandedCategory === ret.category;

        return (
          <div key={ret.category} className="bg-slate-800/30 border border-slate-700/50 rounded-xl overflow-hidden">
            <button
              onClick={() => onToggleExpand(ret.category)}
              className="w-full px-5 py-4 flex items-center justify-between hover:bg-slate-700/20 transition-colors"
            >
              <div className="flex items-center gap-4">
                <Icon className={`h-5 w-5 ${meta.color}`} />
                <div className="text-left">
                  <p className="text-sm font-semibold text-white flex items-center gap-2">
                    {meta.label}
                    {ret.immutable && <span title="Immutable — cannot be deleted"><Lock className="h-3 w-3 text-amber-400" /></span>}
                    {ret.tamperEvident && <span title="Tamper-evident logging required"><ShieldCheck className="h-3 w-3 text-blue-400" /></span>}
                    {ret.conflictWithGdpr && <span title="GDPR retention conflict"><AlertTriangle className="h-3 w-3 text-red-400" /></span>}
                  </p>
                  <p className="text-xs text-slate-500">{meta.description}</p>
                </div>
              </div>

              <div className="flex items-center gap-6">
                {/* Retention bar visualization */}
                <div className="flex items-center gap-1">
                  <div className="w-16 h-2 rounded-full bg-orange-500/40" title={`Hot: ${ret.hotDays}d`}>
                    <div className="h-full rounded-full bg-orange-400" style={{ width: `${Math.min(100, (ret.hotDays / ret.retentionDays) * 100)}%` }} />
                  </div>
                  <div className="w-16 h-2 rounded-full bg-yellow-500/40" title={`Warm: ${ret.warmDays}d`}>
                    <div className="h-full rounded-full bg-yellow-400" style={{ width: `${Math.min(100, (ret.warmDays / ret.retentionDays) * 100)}%` }} />
                  </div>
                  <div className="w-16 h-2 rounded-full bg-blue-500/40" title="Cold + Archive">
                    <div className="h-full rounded-full bg-blue-400" style={{ width: '100%' }} />
                  </div>
                </div>

                <div className="text-right min-w-[80px]">
                  <p className="text-sm font-bold text-white">{formatDays(ret.retentionDays)}</p>
                  <p className="text-[10px] text-slate-500">
                    {ret.drivingCompliance !== 'none'
                      ? COMPLIANCE_LABELS[ret.drivingCompliance] || ret.drivingCompliance
                      : 'Default'}
                  </p>
                </div>

                {expanded ? <ChevronDown className="h-4 w-4 text-slate-500" /> : <ChevronRight className="h-4 w-4 text-slate-500" />}
              </div>
            </button>

            {expanded && (
              <div className="px-5 pb-4 pt-1 border-t border-slate-700/30 space-y-3">
                <div className="grid grid-cols-4 gap-4">
                  <div>
                    <p className="text-[10px] text-slate-500 uppercase tracking-wider">Total Retention</p>
                    <p className="text-sm text-white font-semibold">{formatDays(ret.retentionDays)}</p>
                  </div>
                  <div>
                    <p className="text-[10px] text-slate-500 uppercase tracking-wider">Hot (Queryable)</p>
                    <p className="text-sm text-orange-300">{formatDays(ret.hotDays)}</p>
                  </div>
                  <div>
                    <p className="text-[10px] text-slate-500 uppercase tracking-wider">Warm (S3)</p>
                    <p className="text-sm text-yellow-300">{formatDays(ret.warmDays)}</p>
                  </div>
                  <div>
                    <p className="text-[10px] text-slate-500 uppercase tracking-wider">Cold + Archive</p>
                    <p className="text-sm text-blue-300">{formatDays(Math.max(0, ret.retentionDays - ret.hotDays - ret.warmDays))}</p>
                  </div>
                </div>

                {/* Compliance driver */}
                <div className="flex items-start gap-2 px-3 py-2 rounded-lg bg-slate-700/30">
                  <Info className="h-3.5 w-3.5 text-slate-400 mt-0.5 flex-shrink-0" />
                  <div className="text-xs text-slate-400">
                    <span className="font-medium text-slate-300">Driving requirement:</span>{' '}
                    {ret.drivingCompliance !== 'none'
                      ? `${COMPLIANCE_LABELS[ret.drivingCompliance]} ${ret.drivingRegulation || ''}`
                      : 'Default platform policy (no compliance license active)'}
                    {ret.maxRetentionDays != null && (
                      <span className="block mt-1 text-amber-400/80">
                        GDPR caps maximum retention at {formatDays(ret.maxRetentionDays)}.
                        {ret.conflictWithGdpr && ' This conflicts with the minimum required by another compliance license. HIPAA minimum takes precedence — document the justification.'}
                      </span>
                    )}
                  </div>
                </div>

                {/* Properties */}
                <div className="flex flex-wrap gap-3">
                  {ret.immutable && (
                    <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-amber-500/15 border border-amber-500/25 text-xs text-amber-300">
                      <Lock className="h-3 w-3" /> Immutable
                    </span>
                  )}
                  {ret.tamperEvident && (
                    <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-blue-500/15 border border-blue-500/25 text-xs text-blue-300">
                      <ShieldCheck className="h-3 w-3" /> Tamper-Evident
                    </span>
                  )}
                  {ret.hasOverride && (
                    <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-violet-500/15 border border-violet-500/25 text-xs text-violet-300">
                      <Settings className="h-3 w-3" /> Override: {formatDays(ret.overrideRetentionDays!)}
                    </span>
                  )}
                </div>

                {/* Why can't this be reduced? */}
                {hasCompliance && ret.drivingCompliance !== 'none' && (
                  <div className="flex items-start gap-2 px-3 py-2 rounded-lg bg-amber-500/10 border border-amber-500/20">
                    <ShieldAlert className="h-3.5 w-3.5 text-amber-400 mt-0.5 flex-shrink-0" />
                    <p className="text-[11px] text-amber-300/90">
                      <span className="font-semibold">Cannot reduce below {formatDays(ret.retentionDays)}</span> —
                      required by <span className="font-medium">{COMPLIANCE_LABELS[ret.drivingCompliance]}</span>
                      {ret.drivingRegulation && <> ({ret.drivingRegulation})</>}.
                      Retention can only be increased above this minimum, or the compliance license must be removed.
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Tab: Log Sources
// ---------------------------------------------------------------------------

function LogSourcesTab({ summary }: { summary: SourcesSummary }) {
  const categories = Object.entries(summary.byCategory).sort((a, b) => b[1] - a[1]);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-slate-800/30 border border-slate-700/50 rounded-xl p-4 text-center">
          <p className="text-xs text-slate-400">Active Sources</p>
          <p className="text-3xl font-bold text-white mt-1">{summary.activeSources}</p>
        </div>
        <div className="bg-slate-800/30 border border-emerald-700/30 rounded-xl p-4 text-center">
          <p className="text-xs text-slate-400">Logging Enforced</p>
          <p className="text-3xl font-bold text-emerald-400 mt-1">{summary.enforcedSources}</p>
          <p className="text-xs text-emerald-400/60 mt-1">{summary.totalSources > 0 ? Math.round((summary.enforcedSources / summary.totalSources) * 100) : 0}% coverage</p>
        </div>
        <div className={`bg-slate-800/30 border rounded-xl p-4 text-center ${summary.unenforced > 0 ? 'border-amber-700/30' : 'border-slate-700/50'}`}>
          <p className="text-xs text-slate-400">Unenforced</p>
          <p className={`text-3xl font-bold mt-1 ${summary.unenforced > 0 ? 'text-amber-400' : 'text-slate-500'}`}>{summary.unenforced}</p>
          {summary.unenforced > 0 && <p className="text-xs text-amber-400/60 mt-1">Needs attention</p>}
        </div>
      </div>

      <div className="bg-slate-800/30 border border-slate-700/50 rounded-xl p-5">
        <h3 className="text-sm font-semibold text-white mb-4">Sources by Category</h3>
        <div className="space-y-3">
          {categories.map(([cat, count]) => {
            const meta = CATEGORY_META[cat as LogCategory];
            const Icon = meta.icon;
            const pct = summary.totalSources > 0 ? (count / summary.totalSources) * 100 : 0;
            return (
              <div key={cat} className="flex items-center gap-3">
                <Icon className={`h-4 w-4 ${meta.color} flex-shrink-0`} />
                <span className="text-xs text-slate-300 w-28">{meta.label}</span>
                <div className="flex-1 h-2 bg-slate-700/50 rounded-full overflow-hidden">
                  <div className="h-full bg-violet-500/60 rounded-full" style={{ width: `${pct}%` }} />
                </div>
                <span className="text-xs text-slate-400 w-8 text-right">{count}</span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Tab: Storage Tiers
// ---------------------------------------------------------------------------

function StorageTiersTab({ breakdown }: { breakdown: StorageBreakdown[] }) {
  const totalBytes = breakdown.reduce((s, b) => s + b.totalBytes, 0);

  return (
    <div className="space-y-4">
      {(['hot', 'warm', 'cold', 'deep_archive'] as const).map(tier => {
        const data = breakdown.find(b => b.tier === tier);
        const meta = TIER_META[tier];
        const Icon = meta.icon;
        const bytes = data?.totalBytes ?? 0;
        const entries = data?.totalEntries ?? 0;
        const pct = totalBytes > 0 ? (bytes / totalBytes) * 100 : 0;

        return (
          <div key={tier} className="bg-slate-800/30 border border-slate-700/50 rounded-xl p-5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Icon className={`h-5 w-5 ${meta.color}`} />
                <div>
                  <p className="text-sm font-semibold text-white">{meta.label}</p>
                  <p className="text-xs text-slate-500">
                    {entries.toLocaleString()} entries • {formatBytes(bytes)}
                    {totalBytes > 0 && <> • {pct.toFixed(1)}% of total</>}
                  </p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-lg font-bold text-white">{formatBytes(bytes)}</p>
                {data?.oldestEntry && (
                  <p className="text-[10px] text-slate-500">
                    {new Date(data.oldestEntry).toLocaleDateString()} — {data.newestEntry ? new Date(data.newestEntry).toLocaleDateString() : 'now'}
                  </p>
                )}
              </div>
            </div>
            <div className="mt-3 h-2 bg-slate-700/50 rounded-full overflow-hidden">
              <div className={`h-full rounded-full ${
                tier === 'hot' ? 'bg-orange-400' : tier === 'warm' ? 'bg-yellow-400' : tier === 'cold' ? 'bg-blue-400' : 'bg-slate-500'
              }`} style={{ width: `${Math.max(pct, 1)}%` }} />
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Tab: Compliance Matrix
// ---------------------------------------------------------------------------

function ComplianceMatrixTab({
  retention,
  issues,
  licenses,
}: {
  retention: EffectiveRetention[];
  issues: ComplianceIssue[];
  licenses: string[];
}) {
  return (
    <div className="space-y-4">
      {/* Matrix Table */}
      <div className="bg-slate-800/30 border border-slate-700/50 rounded-xl p-5 overflow-x-auto">
        <h3 className="text-sm font-semibold text-white mb-4">Effective Retention by Category</h3>
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-slate-700/50">
              <th className="text-left py-2 px-2 text-slate-400 font-medium">Category</th>
              <th className="text-center py-2 px-2 text-slate-400 font-medium">Retention</th>
              <th className="text-center py-2 px-2 text-slate-400 font-medium">Hot</th>
              <th className="text-center py-2 px-2 text-slate-400 font-medium">Warm</th>
              <th className="text-center py-2 px-2 text-slate-400 font-medium">Immutable</th>
              <th className="text-center py-2 px-2 text-slate-400 font-medium">Tamper-Evident</th>
              <th className="text-left py-2 px-2 text-slate-400 font-medium">Driver</th>
              <th className="text-left py-2 px-2 text-slate-400 font-medium">Regulation</th>
            </tr>
          </thead>
          <tbody>
            {retention.map(ret => {
              const meta = CATEGORY_META[ret.category];
              const Icon = meta.icon;
              return (
                <tr key={ret.category} className="border-b border-slate-800/50">
                  <td className="py-2 px-2">
                    <span className="flex items-center gap-2">
                      <Icon className={`h-3.5 w-3.5 ${meta.color}`} />
                      <span className="text-slate-300 font-medium">{meta.label}</span>
                    </span>
                  </td>
                  <td className="text-center py-2 px-2 text-white font-semibold">{formatDays(ret.retentionDays)}</td>
                  <td className="text-center py-2 px-2 text-orange-300">{formatDays(ret.hotDays)}</td>
                  <td className="text-center py-2 px-2 text-yellow-300">{formatDays(ret.warmDays)}</td>
                  <td className="text-center py-2 px-2">
                    {ret.immutable
                      ? <CheckCircle2 className="h-4 w-4 text-amber-400 inline" />
                      : <span className="text-slate-600">—</span>}
                  </td>
                  <td className="text-center py-2 px-2">
                    {ret.tamperEvident
                      ? <CheckCircle2 className="h-4 w-4 text-blue-400 inline" />
                      : <span className="text-slate-600">—</span>}
                  </td>
                  <td className="py-2 px-2 text-slate-300">
                    {ret.drivingCompliance !== 'none'
                      ? <span className="px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300">{COMPLIANCE_LABELS[ret.drivingCompliance]}</span>
                      : <span className="text-slate-600">Default</span>}
                  </td>
                  <td className="py-2 px-2 text-slate-500 font-mono">{ret.drivingRegulation || '—'}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* All Issues */}
      {issues.length > 0 && (
        <div className="bg-slate-800/30 border border-slate-700/50 rounded-xl p-5 space-y-3">
          <h3 className="text-sm font-semibold text-white">Compliance Issues</h3>
          {issues.map((issue, i) => (
            <div key={i} className={`flex items-start gap-3 px-3 py-2.5 rounded-lg border ${
              issue.severity === 'critical' ? 'bg-red-500/10 border-red-500/20' :
              issue.severity === 'warning' ? 'bg-amber-500/10 border-amber-500/20' :
              'bg-slate-700/30 border-slate-600/20'
            }`}>
              {issue.severity === 'critical' && <XCircle className="h-4 w-4 text-red-400 mt-0.5 flex-shrink-0" />}
              {issue.severity === 'warning' && <AlertTriangle className="h-4 w-4 text-amber-400 mt-0.5 flex-shrink-0" />}
              {issue.severity === 'info' && <Info className="h-4 w-4 text-slate-400 mt-0.5 flex-shrink-0" />}
              <div className="text-xs">
                <p className={`font-medium ${
                  issue.severity === 'critical' ? 'text-red-300' :
                  issue.severity === 'warning' ? 'text-amber-300' : 'text-slate-300'
                }`}>
                  [{CATEGORY_META[issue.category].label}] {issue.issue}
                </p>
                <p className="text-slate-500 mt-0.5">{issue.recommendation}</p>
                {issue.regulation && <p className="text-slate-600 mt-0.5 font-mono">{COMPLIANCE_LABELS[issue.complianceKey]} {issue.regulation}</p>}
              </div>
            </div>
          ))}
        </div>
      )}

      {issues.length === 0 && (
        <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-xl p-4 flex items-center gap-3">
          <CheckCircle2 className="h-5 w-5 text-emerald-400" />
          <p className="text-sm text-emerald-300">No compliance issues detected. All log categories meet retention requirements.</p>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Tab: Log Search (full-text search across hot-tier logs)
// ---------------------------------------------------------------------------

function LogSearchTab() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [categoryFilter, setCategoryFilter] = useState<string>('');
  const [levelFilter, setLevelFilter] = useState<string>('');
  const [total, setTotal] = useState(0);

  const doSearch = async () => {
    if (!query.trim()) return;
    setSearching(true);
    try {
      const params = new URLSearchParams({ q: query, limit: '100' });
      if (categoryFilter) params.set('category', categoryFilter);
      if (levelFilter) params.set('level', levelFilter);
      const data = await fetchApi(`/search?${params}`);
      setResults(data.results || []);
      setTotal(data.total || 0);
    } catch { setResults([]); } finally { setSearching(false); }
  };

  return (
    <div className="space-y-4">
      <div className="flex gap-3">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
          <input
            value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && doSearch()}
            placeholder="Search logs... (full-text across hot-tier)"
            className="w-full pl-10 pr-4 py-2.5 bg-slate-800/50 border border-slate-700/50 rounded-lg text-sm text-white placeholder-slate-500 focus:border-violet-500 focus:outline-none"
          />
        </div>
        <select value={categoryFilter} onChange={e => setCategoryFilter(e.target.value)}
          className="px-3 py-2 bg-slate-800/50 border border-slate-700/50 rounded-lg text-sm text-slate-300">
          <option value="">All categories</option>
          {Object.entries(CATEGORY_META).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
        </select>
        <select value={levelFilter} onChange={e => setLevelFilter(e.target.value)}
          className="px-3 py-2 bg-slate-800/50 border border-slate-700/50 rounded-lg text-sm text-slate-300">
          <option value="">All levels</option>
          {['debug','info','warn','error','fatal'].map(l => <option key={l} value={l}>{l.toUpperCase()}</option>)}
        </select>
        <button onClick={doSearch} disabled={searching}
          className="px-4 py-2 bg-violet-600 hover:bg-violet-500 text-white text-sm rounded-lg flex items-center gap-2 disabled:opacity-50">
          {searching ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />} Search
        </button>
      </div>

      {results.length > 0 && (
        <p className="text-xs text-slate-500">{total} results found</p>
      )}

      <div className="space-y-1 max-h-[600px] overflow-y-auto">
        {results.map(r => {
          const meta = CATEGORY_META[r.category];
          const Icon = meta?.icon || Activity;
          const levelColor = r.level === 'error' || r.level === 'fatal' ? 'text-red-400' :
            r.level === 'warn' ? 'text-amber-400' : r.level === 'debug' ? 'text-slate-500' : 'text-slate-300';
          return (
            <div key={r.id} className="flex items-start gap-2 px-3 py-2 bg-slate-800/20 border border-slate-700/30 rounded-lg text-xs font-mono">
              <Icon className={`h-3.5 w-3.5 mt-0.5 flex-shrink-0 ${meta?.color || 'text-slate-400'}`} />
              <span className="text-slate-600 w-40 flex-shrink-0">{new Date(r.timestamp).toLocaleString()}</span>
              <span className={`w-12 flex-shrink-0 uppercase font-bold ${levelColor}`}>{r.level}</span>
              <span className="text-violet-400 w-36 flex-shrink-0 truncate">{r.service}</span>
              <span className="text-slate-300 flex-1 break-all">{r.message}</span>
              {r.requestId && <span className="text-slate-600 flex-shrink-0" title={r.requestId}>{r.requestId.substring(0, 8)}</span>}
            </div>
          );
        })}
        {results.length === 0 && !searching && query && (
          <div className="text-center py-8 text-slate-500 text-sm">No results found for &quot;{query}&quot;</div>
        )}
        {!query && (
          <div className="text-center py-12 text-slate-500">
            <Search className="h-8 w-8 mx-auto mb-3 text-slate-600" />
            <p className="text-sm">Search across hot-tier logs (last 30 days)</p>
            <p className="text-xs mt-1">Full-text search with category and level filters</p>
          </div>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Tab: Reports (generated reports list, create new)
// ---------------------------------------------------------------------------

function ReportsTab() {
  const [reports, setReports] = useState<LogReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [selectedType, setSelectedType] = useState('compliance_summary');
  const [viewingReport, setViewingReport] = useState<LogReport | null>(null);

  const loadReports = useCallback(async () => {
    setLoading(true);
    try {
      const data = await fetchApi('/reports');
      setReports(data.reports || []);
    } catch { /* */ } finally { setLoading(false); }
  }, []);

  useEffect(() => { loadReports(); }, [loadReports]);

  const generateReport = async () => {
    setGenerating(true);
    try {
      await fetchApi('/reports', {
        method: 'POST',
        body: JSON.stringify({ reportType: selectedType }),
      });
      await loadReports();
    } catch { /* */ } finally { setGenerating(false); }
  };

  const downloadReport = async (reportId: string) => {
    try {
      const data = await fetchApi(`/reports/${reportId}/download`);
      if (data.url) window.open(data.url, '_blank');
    } catch { /* */ }
  };

  const REPORT_TYPES: Record<string, { label: string; desc: string }> = {
    compliance_summary: { label: 'Compliance Summary', desc: 'Retention posture vs active compliance licenses' },
    retention_audit: { label: 'Retention Audit', desc: 'What\'s stored, where, expiry dates, overrides' },
    storage_forecast: { label: 'Storage Forecast', desc: 'Cost/capacity projections based on growth rates' },
    source_coverage: { label: 'Source Coverage', desc: 'Which services are logging, which are not' },
    gdpr_data_map: { label: 'GDPR Data Map', desc: 'GDPR Article 30 data inventory' },
  };

  const STATUS_COLORS: Record<string, string> = {
    completed: 'text-emerald-400 bg-emerald-500/15', generating: 'text-blue-400 bg-blue-500/15',
    pending: 'text-slate-400 bg-slate-500/15', failed: 'text-red-400 bg-red-500/15',
  };

  if (viewingReport) {
    return (
      <div className="space-y-4">
        <button onClick={() => setViewingReport(null)} className="text-xs text-violet-400 hover:text-violet-300 flex items-center gap-1">
          &larr; Back to reports
        </button>
        <div className="bg-slate-800/30 border border-slate-700/50 rounded-xl p-5 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-semibold text-white">{viewingReport.title}</h3>
              <p className="text-xs text-slate-500">{REPORT_TYPES[viewingReport.reportType]?.label} • Generated {new Date(viewingReport.createdAt).toLocaleString()} • {viewingReport.generatedBy}</p>
            </div>
            <div className="flex gap-2">
              <button onClick={() => downloadReport(viewingReport.id)} className="px-3 py-1.5 bg-violet-600 hover:bg-violet-500 text-white text-xs rounded-lg flex items-center gap-1.5">
                <Download className="h-3.5 w-3.5" /> Download
              </button>
            </div>
          </div>
          {viewingReport.summary && (
            <div className="bg-slate-700/30 rounded-lg p-4">
              <h4 className="text-xs font-semibold text-slate-400 uppercase mb-2">Summary</h4>
              <pre className="text-xs text-slate-300 overflow-x-auto whitespace-pre-wrap">{JSON.stringify(viewingReport.summary, null, 2)}</pre>
            </div>
          )}
          {viewingReport.findings.length > 0 && (
            <div className="bg-slate-700/30 rounded-lg p-4">
              <h4 className="text-xs font-semibold text-slate-400 uppercase mb-2">Findings ({viewingReport.findings.length})</h4>
              <pre className="text-xs text-slate-300 overflow-x-auto whitespace-pre-wrap max-h-64 overflow-y-auto">{JSON.stringify(viewingReport.findings, null, 2)}</pre>
            </div>
          )}
          {viewingReport.recommendations.length > 0 && (
            <div className="bg-amber-500/10 border border-amber-500/20 rounded-lg p-4">
              <h4 className="text-xs font-semibold text-amber-400 uppercase mb-2">Recommendations ({viewingReport.recommendations.length})</h4>
              <pre className="text-xs text-amber-300/80 overflow-x-auto whitespace-pre-wrap">{JSON.stringify(viewingReport.recommendations, null, 2)}</pre>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-white">Generated Reports</h3>
        <div className="flex items-center gap-2">
          <select value={selectedType} onChange={e => setSelectedType(e.target.value)}
            className="px-3 py-1.5 bg-slate-800/50 border border-slate-700/50 rounded-lg text-xs text-slate-300">
            {Object.entries(REPORT_TYPES).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
          </select>
          <button onClick={generateReport} disabled={generating}
            className="px-3 py-1.5 bg-violet-600 hover:bg-violet-500 text-white text-xs rounded-lg flex items-center gap-1.5 disabled:opacity-50">
            {generating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />} Generate
          </button>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-violet-400" /></div>
      ) : reports.length === 0 ? (
        <div className="text-center py-12 text-slate-500">
          <FileBarChart className="h-8 w-8 mx-auto mb-3 text-slate-600" />
          <p className="text-sm">No reports generated yet</p>
          <p className="text-xs mt-1">Generate a compliance summary, retention audit, or storage forecast report</p>
        </div>
      ) : (
        <div className="space-y-2">
          {reports.map(r => (
            <div key={r.id} className="flex items-center justify-between px-4 py-3 bg-slate-800/30 border border-slate-700/50 rounded-xl hover:bg-slate-700/20 transition-colors">
              <div className="flex items-center gap-3 flex-1 min-w-0">
                <FileBarChart className="h-4 w-4 text-violet-400 flex-shrink-0" />
                <div className="min-w-0">
                  <p className="text-sm font-medium text-white truncate">{r.title}</p>
                  <p className="text-xs text-slate-500">{REPORT_TYPES[r.reportType]?.label} • {new Date(r.createdAt).toLocaleDateString()} • {r.generatedBy}</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${STATUS_COLORS[r.status] || 'text-slate-400 bg-slate-500/15'}`}>
                  {r.status}
                </span>
                {r.fileSizeBytes && <span className="text-xs text-slate-500">{formatBytes(r.fileSizeBytes)}</span>}
                {r.durationMs && <span className="text-xs text-slate-600">{(r.durationMs / 1000).toFixed(1)}s</span>}
                {r.status === 'completed' && (
                  <>
                    <button onClick={() => setViewingReport(r)} className="p-1 hover:bg-slate-600/50 rounded" title="View">
                      <Eye className="h-3.5 w-3.5 text-slate-400" />
                    </button>
                    <button onClick={() => downloadReport(r.id)} className="p-1 hover:bg-slate-600/50 rounded" title="Download">
                      <Download className="h-3.5 w-3.5 text-slate-400" />
                    </button>
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Tab: Glacier Restore
// ---------------------------------------------------------------------------

function GlacierRestoreTab() {
  const [jobs, setJobs] = useState<RestoreJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({ restoreType: 'date_range', categories: [] as string[], dateStart: '', dateEnd: '', tier: 'Standard', reason: '' });

  const loadJobs = useCallback(async () => {
    setLoading(true);
    try { const data = await fetchApi('/restore/jobs'); setJobs(data.jobs || []); } catch { /* */ } finally { setLoading(false); }
  }, []);

  useEffect(() => { loadJobs(); }, [loadJobs]);

  const createJob = async () => {
    setCreating(true);
    try {
      await fetchApi('/restore/jobs', {
        method: 'POST',
        body: JSON.stringify({
          restoreType: form.restoreType,
          categories: form.categories.length > 0 ? form.categories : undefined,
          dateRangeStart: form.dateStart || undefined,
          dateRangeEnd: form.dateEnd || undefined,
          retrievalTier: form.tier,
          requestReason: form.reason || undefined,
        }),
      });
      setShowCreate(false);
      await loadJobs();
    } catch { /* */ } finally { setCreating(false); }
  };

  const processJob = async (jobId: string) => {
    try { await fetchApi(`/restore/jobs/${jobId}/process`, { method: 'POST' }); await loadJobs(); } catch { /* */ }
  };

  const TIER_INFO: Record<string, { label: string; eta: string; cost: string }> = {
    Expedited: { label: 'Expedited', eta: '1-5 minutes', cost: 'Highest' },
    Standard: { label: 'Standard', eta: '3-5 hours', cost: 'Medium' },
    Bulk: { label: 'Bulk', eta: '5-12 hours', cost: 'Lowest' },
  };

  const STATUS_COLORS: Record<string, string> = {
    completed: 'text-emerald-400 bg-emerald-500/15', in_progress: 'text-blue-400 bg-blue-500/15',
    pending: 'text-amber-400 bg-amber-500/15', failed: 'text-red-400 bg-red-500/15', cancelled: 'text-slate-400 bg-slate-500/15',
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-white">Glacier Restore Jobs</h3>
          <p className="text-xs text-slate-500">Restore archived logs from Glacier for viewing or export</p>
        </div>
        <button onClick={() => setShowCreate(!showCreate)}
          className="px-3 py-1.5 bg-violet-600 hover:bg-violet-500 text-white text-xs rounded-lg flex items-center gap-1.5">
          <Plus className="h-3.5 w-3.5" /> New Restore
        </button>
      </div>

      {showCreate && (
        <div className="bg-slate-800/50 border border-violet-500/30 rounded-xl p-5 space-y-4">
          <h4 className="text-sm font-semibold text-violet-300">Create Restore Job</h4>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs text-slate-400 block mb-1">Restore Type</label>
              <select value={form.restoreType} onChange={e => setForm({ ...form, restoreType: e.target.value })}
                className="w-full px-3 py-2 bg-slate-700/50 border border-slate-600/50 rounded-lg text-sm text-white">
                <option value="date_range">Date Range</option>
                <option value="category">By Category</option>
                <option value="full">Full Archive</option>
              </select>
            </div>
            <div>
              <label className="text-xs text-slate-400 block mb-1">Retrieval Speed</label>
              <select value={form.tier} onChange={e => setForm({ ...form, tier: e.target.value })}
                className="w-full px-3 py-2 bg-slate-700/50 border border-slate-600/50 rounded-lg text-sm text-white">
                {Object.entries(TIER_INFO).map(([k, v]) => <option key={k} value={k}>{v.label} — {v.eta} ({v.cost} cost)</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs text-slate-400 block mb-1">Start Date</label>
              <input type="date" value={form.dateStart} onChange={e => setForm({ ...form, dateStart: e.target.value })}
                className="w-full px-3 py-2 bg-slate-700/50 border border-slate-600/50 rounded-lg text-sm text-white" />
            </div>
            <div>
              <label className="text-xs text-slate-400 block mb-1">End Date</label>
              <input type="date" value={form.dateEnd} onChange={e => setForm({ ...form, dateEnd: e.target.value })}
                className="w-full px-3 py-2 bg-slate-700/50 border border-slate-600/50 rounded-lg text-sm text-white" />
            </div>
          </div>
          <div>
            <label className="text-xs text-slate-400 block mb-1">Reason (for audit)</label>
            <input value={form.reason} onChange={e => setForm({ ...form, reason: e.target.value })} placeholder="e.g., Compliance audit request"
              className="w-full px-3 py-2 bg-slate-700/50 border border-slate-600/50 rounded-lg text-sm text-white placeholder-slate-500" />
          </div>
          <div className="flex gap-2">
            <button onClick={createJob} disabled={creating}
              className="px-4 py-2 bg-violet-600 hover:bg-violet-500 text-white text-sm rounded-lg flex items-center gap-2 disabled:opacity-50">
              {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : <RotateCcw className="h-4 w-4" />} Start Restore
            </button>
            <button onClick={() => setShowCreate(false)} className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white text-sm rounded-lg">Cancel</button>
          </div>
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-violet-400" /></div>
      ) : jobs.length === 0 ? (
        <div className="text-center py-12 text-slate-500">
          <RotateCcw className="h-8 w-8 mx-auto mb-3 text-slate-600" />
          <p className="text-sm">No restore jobs</p>
          <p className="text-xs mt-1">Create a restore job to retrieve logs from Glacier archives</p>
        </div>
      ) : (
        <div className="space-y-2">
          {jobs.map(j => (
            <div key={j.id} className="px-4 py-3 bg-slate-800/30 border border-slate-700/50 rounded-xl space-y-2">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-white">{j.restoreType} restore — {j.totalArchives} archives ({formatBytes(j.totalBytes)})</p>
                  <p className="text-xs text-slate-500">{j.retrievalTier} tier • {new Date(j.createdAt).toLocaleString()} • {j.requestedBy}</p>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${STATUS_COLORS[j.status] || 'text-slate-400'}`}>{j.status}</span>
                  {j.status === 'pending' && (
                    <button onClick={() => processJob(j.id)} className="px-2 py-1 bg-blue-600 hover:bg-blue-500 text-white text-[10px] rounded flex items-center gap-1">
                      <Play className="h-3 w-3" /> Process
                    </button>
                  )}
                </div>
              </div>
              {(j.status === 'in_progress' || j.status === 'completed') && (
                <div className="space-y-1">
                  <div className="flex justify-between text-[10px] text-slate-500">
                    <span>{j.restoredArchives}/{j.totalArchives} restored{j.failedArchives > 0 && `, ${j.failedArchives} failed`}</span>
                    <span>{j.progressPct.toFixed(0)}%</span>
                  </div>
                  <div className="h-1.5 bg-slate-700/50 rounded-full overflow-hidden">
                    <div className={`h-full rounded-full transition-all ${j.status === 'completed' ? 'bg-emerald-500' : 'bg-blue-500'}`}
                      style={{ width: `${j.progressPct}%` }} />
                  </div>
                  {j.estimatedReadyAt && j.status !== 'completed' && (
                    <p className="text-[10px] text-slate-600">Estimated ready: {new Date(j.estimatedReadyAt).toLocaleString()}</p>
                  )}
                </div>
              )}
              {j.requestReason && <p className="text-[10px] text-slate-600 italic">{j.requestReason}</p>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Tab: Export (bulk export with download)
// ---------------------------------------------------------------------------

function ExportTab() {
  const [jobs, setJobs] = useState<ExportJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({ name: '', format: 'json_lines', allTime: true, dateStart: '', dateEnd: '', includesCold: false, includesDeep: false });

  const loadJobs = useCallback(async () => {
    setLoading(true);
    try { const data = await fetchApi('/export/jobs'); setJobs(data.jobs || []); } catch { /* */ } finally { setLoading(false); }
  }, []);

  useEffect(() => { loadJobs(); }, [loadJobs]);

  const createExport = async () => {
    setCreating(true);
    try {
      await fetchApi('/export/jobs', {
        method: 'POST',
        body: JSON.stringify({
          exportName: form.name || undefined,
          format: form.format,
          includeAllTime: form.allTime,
          dateRangeStart: !form.allTime && form.dateStart ? form.dateStart : undefined,
          dateRangeEnd: !form.allTime && form.dateEnd ? form.dateEnd : undefined,
          includesCold: form.includesCold,
          includesDeep: form.includesDeep,
        }),
      });
      setShowCreate(false);
      await loadJobs();
    } catch { /* */ } finally { setCreating(false); }
  };

  const downloadExport = async (jobId: string) => {
    try {
      const data = await fetchApi(`/export/jobs/${jobId}/download`);
      if (data.url) window.open(data.url, '_blank');
    } catch { /* */ }
  };

  const STATUS_COLORS: Record<string, string> = {
    completed: 'text-emerald-400 bg-emerald-500/15', in_progress: 'text-blue-400 bg-blue-500/15',
    pending: 'text-amber-400 bg-amber-500/15', failed: 'text-red-400 bg-red-500/15',
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-white">Log Exports</h3>
          <p className="text-xs text-slate-500">Export all logs or a date range — JSON, CSV, or JSON Lines format with pre-signed download links</p>
        </div>
        <button onClick={() => setShowCreate(!showCreate)}
          className="px-3 py-1.5 bg-violet-600 hover:bg-violet-500 text-white text-xs rounded-lg flex items-center gap-1.5">
          <Plus className="h-3.5 w-3.5" /> New Export
        </button>
      </div>

      {showCreate && (
        <div className="bg-slate-800/50 border border-violet-500/30 rounded-xl p-5 space-y-4">
          <h4 className="text-sm font-semibold text-violet-300">Create Export</h4>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs text-slate-400 block mb-1">Export Name</label>
              <input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="Optional name"
                className="w-full px-3 py-2 bg-slate-700/50 border border-slate-600/50 rounded-lg text-sm text-white placeholder-slate-500" />
            </div>
            <div>
              <label className="text-xs text-slate-400 block mb-1">Format</label>
              <select value={form.format} onChange={e => setForm({ ...form, format: e.target.value })}
                className="w-full px-3 py-2 bg-slate-700/50 border border-slate-600/50 rounded-lg text-sm text-white">
                <option value="json_lines">JSON Lines (.jsonl.gz)</option>
                <option value="json">JSON (.json.gz)</option>
                <option value="csv">CSV (.csv.gz)</option>
              </select>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <label className="flex items-center gap-2 text-sm text-slate-300 cursor-pointer">
              <input type="checkbox" checked={form.allTime} onChange={e => setForm({ ...form, allTime: e.target.checked })}
                className="rounded border-slate-600" /> All time
            </label>
          </div>
          {!form.allTime && (
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-xs text-slate-400 block mb-1">Start Date</label>
                <input type="date" value={form.dateStart} onChange={e => setForm({ ...form, dateStart: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-700/50 border border-slate-600/50 rounded-lg text-sm text-white" />
              </div>
              <div>
                <label className="text-xs text-slate-400 block mb-1">End Date</label>
                <input type="date" value={form.dateEnd} onChange={e => setForm({ ...form, dateEnd: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-700/50 border border-slate-600/50 rounded-lg text-sm text-white" />
              </div>
            </div>
          )}
          <div className="flex items-center gap-4">
            <label className="flex items-center gap-2 text-xs text-slate-400 cursor-pointer">
              <input type="checkbox" checked={form.includesCold} onChange={e => setForm({ ...form, includesCold: e.target.checked })}
                className="rounded border-slate-600" /> Include Cold (Glacier) — requires prior restore
            </label>
            <label className="flex items-center gap-2 text-xs text-slate-400 cursor-pointer">
              <input type="checkbox" checked={form.includesDeep} onChange={e => setForm({ ...form, includesDeep: e.target.checked })}
                className="rounded border-slate-600" /> Include Deep Archive — requires prior restore
            </label>
          </div>
          <div className="flex gap-2">
            <button onClick={createExport} disabled={creating}
              className="px-4 py-2 bg-violet-600 hover:bg-violet-500 text-white text-sm rounded-lg flex items-center gap-2 disabled:opacity-50">
              {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />} Start Export
            </button>
            <button onClick={() => setShowCreate(false)} className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white text-sm rounded-lg">Cancel</button>
          </div>
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-violet-400" /></div>
      ) : jobs.length === 0 ? (
        <div className="text-center py-12 text-slate-500">
          <Download className="h-8 w-8 mx-auto mb-3 text-slate-600" />
          <p className="text-sm">No exports yet</p>
          <p className="text-xs mt-1">Export logs for compliance officers, auditors, or archival</p>
        </div>
      ) : (
        <div className="space-y-2">
          {jobs.map(j => (
            <div key={j.id} className="flex items-center justify-between px-4 py-3 bg-slate-800/30 border border-slate-700/50 rounded-xl">
              <div className="flex items-center gap-3 flex-1 min-w-0">
                <Download className="h-4 w-4 text-violet-400 flex-shrink-0" />
                <div className="min-w-0">
                  <p className="text-sm font-medium text-white truncate">{j.exportName}</p>
                  <p className="text-xs text-slate-500">
                    {j.format.toUpperCase()} • {j.includeAllTime ? 'All time' : `${j.dateRangeStart?.split('T')[0]} → ${j.dateRangeEnd?.split('T')[0]}`}
                    • {j.totalEntries.toLocaleString()} entries
                    • {new Date(j.createdAt).toLocaleDateString()}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${STATUS_COLORS[j.status] || 'text-slate-400'}`}>{j.status}</span>
                {j.fileSizeBytes && <span className="text-xs text-slate-500">{formatBytes(j.fileSizeBytes)}</span>}
                {j.status === 'in_progress' && (
                  <div className="w-16 h-1.5 bg-slate-700 rounded-full overflow-hidden">
                    <div className="h-full bg-blue-500 rounded-full" style={{ width: `${j.progressPct}%` }} />
                  </div>
                )}
                {j.status === 'completed' && j.downloadUrl && (
                  <button onClick={() => downloadExport(j.id)} className="px-2 py-1 bg-emerald-600 hover:bg-emerald-500 text-white text-[10px] rounded flex items-center gap-1">
                    <ExternalLink className="h-3 w-3" /> Download
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Tab: Tamper-Evident Verification
// ---------------------------------------------------------------------------

function VerificationTab() {
  const [chainStatus, setChainStatus] = useState<MerkleChainStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [verifying, setVerifying] = useState(false);
  const [verifyResult, setVerifyResult] = useState<{ status: string; entriesChecked: number; entriesValid: number; entriesTampered: number; chainIntegrity: boolean } | null>(null);

  const loadStatus = useCallback(async () => {
    setLoading(true);
    try { const data = await fetchApi('/verification/status'); setChainStatus(data.chainStatus || data); } catch { /* */ } finally { setLoading(false); }
  }, []);

  useEffect(() => { loadStatus(); }, [loadStatus]);

  const verifyChain = async () => {
    setVerifying(true);
    try {
      const data = await fetchApi('/verification/verify-full', { method: 'POST' });
      setVerifyResult(data.result || data);
      await loadStatus();
    } catch { /* */ } finally { setVerifying(false); }
  };

  if (loading || !chainStatus) return <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-violet-400" /></div>;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-white">Tamper-Evident Merkle Verification</h3>
          <p className="text-xs text-slate-500">SHA-256 hash chain over immutable log archives — proves logs have not been modified</p>
        </div>
        <button onClick={verifyChain} disabled={verifying}
          className="px-3 py-1.5 bg-violet-600 hover:bg-violet-500 text-white text-xs rounded-lg flex items-center gap-1.5 disabled:opacity-50">
          {verifying ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Fingerprint className="h-3.5 w-3.5" />} Verify Full Chain
        </button>
      </div>

      <div className="grid grid-cols-4 gap-4">
        <div className="bg-slate-800/30 border border-slate-700/50 rounded-xl p-4">
          <p className="text-xs text-slate-400">Chain Length</p>
          <p className="text-2xl font-bold text-white mt-1">{chainStatus.chainLength.toLocaleString()}</p>
          <p className="text-[10px] text-slate-600 mt-1">entries in hash chain</p>
        </div>
        <div className={`bg-slate-800/30 border rounded-xl p-4 ${chainStatus.tamperedCount > 0 ? 'border-red-500/30' : 'border-emerald-500/30'}`}>
          <p className="text-xs text-slate-400">Integrity</p>
          <p className={`text-2xl font-bold mt-1 ${chainStatus.tamperedCount > 0 ? 'text-red-400' : 'text-emerald-400'}`}>
            {chainStatus.tamperedCount > 0 ? `${chainStatus.tamperedCount} TAMPERED` : 'VALID'}
          </p>
          <p className="text-[10px] text-slate-600 mt-1">{chainStatus.validCount} verified valid</p>
        </div>
        <div className="bg-slate-800/30 border border-slate-700/50 rounded-xl p-4">
          <p className="text-xs text-slate-400">Unverified</p>
          <p className="text-2xl font-bold text-amber-400 mt-1">{chainStatus.unverifiedCount}</p>
          <p className="text-[10px] text-slate-600 mt-1">entries awaiting verification</p>
        </div>
        <div className="bg-slate-800/30 border border-slate-700/50 rounded-xl p-4">
          <p className="text-xs text-slate-400">Latest Root</p>
          <p className="text-xs font-mono text-violet-400 mt-2 break-all">{chainStatus.latestMerkleRoot?.substring(0, 24) || 'N/A'}...</p>
          <p className="text-[10px] text-slate-600 mt-1">seq #{chainStatus.latestSequence}</p>
        </div>
      </div>

      {chainStatus.latestMerkleRoot && (
        <div className="bg-slate-800/30 border border-slate-700/50 rounded-xl p-4">
          <h4 className="text-xs font-semibold text-slate-400 uppercase mb-2">Full Merkle Root Hash</h4>
          <div className="flex items-center gap-2">
            <code className="text-xs font-mono text-violet-300 bg-slate-700/50 px-3 py-1.5 rounded-lg flex-1 break-all">{chainStatus.latestMerkleRoot}</code>
            <button onClick={() => navigator.clipboard.writeText(chainStatus.latestMerkleRoot || '')} className="p-1.5 hover:bg-slate-600/50 rounded" title="Copy">
              <Copy className="h-3.5 w-3.5 text-slate-400" />
            </button>
          </div>
          <p className="text-[10px] text-slate-600 mt-2">
            Range: {chainStatus.oldestEntry ? new Date(chainStatus.oldestEntry).toLocaleDateString() : 'N/A'} — {chainStatus.newestEntry ? new Date(chainStatus.newestEntry).toLocaleDateString() : 'N/A'}
          </p>
        </div>
      )}

      {verifyResult && (
        <div className={`border rounded-xl p-4 ${verifyResult.chainIntegrity ? 'bg-emerald-500/10 border-emerald-500/30' : 'bg-red-500/10 border-red-500/30'}`}>
          <div className="flex items-center gap-3">
            {verifyResult.chainIntegrity ? <CheckCircle2 className="h-5 w-5 text-emerald-400" /> : <XCircle className="h-5 w-5 text-red-400" />}
            <div>
              <p className={`text-sm font-semibold ${verifyResult.chainIntegrity ? 'text-emerald-300' : 'text-red-300'}`}>
                {verifyResult.chainIntegrity ? 'Chain Integrity Verified' : 'CHAIN INTEGRITY COMPROMISED'}
              </p>
              <p className="text-xs text-slate-400">
                {verifyResult.entriesChecked} entries checked • {verifyResult.entriesValid} valid • {verifyResult.entriesTampered} tampered
              </p>
            </div>
          </div>
        </div>
      )}

      {Object.keys(chainStatus.byCategory).length > 0 && (
        <div className="bg-slate-800/30 border border-slate-700/50 rounded-xl p-4">
          <h4 className="text-xs font-semibold text-slate-400 uppercase mb-3">Chain Entries by Category</h4>
          <div className="grid grid-cols-4 gap-3">
            {Object.entries(chainStatus.byCategory).map(([cat, count]) => {
              const meta = CATEGORY_META[cat as LogCategory];
              const Icon = meta?.icon || Activity;
              return (
                <div key={cat} className="flex items-center gap-2 text-xs">
                  <Icon className={`h-3.5 w-3.5 ${meta?.color || 'text-slate-400'}`} />
                  <span className="text-slate-300">{meta?.label || cat}</span>
                  <span className="text-slate-500 ml-auto">{count}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Tab: GDPR Erasure
// ---------------------------------------------------------------------------

function GdprErasureTab() {
  const [requests, setRequests] = useState<ErasureRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({ targetUserId: '', categories: [] as string[], dateStart: '', dateEnd: '', legalBasis: 'Right to erasure (Article 17)' });

  const loadRequests = useCallback(async () => {
    setLoading(true);
    try { const data = await fetchApi('/erasure/requests'); setRequests(data.requests || []); } catch { /* */ } finally { setLoading(false); }
  }, []);

  useEffect(() => { loadRequests(); }, [loadRequests]);

  const createRequest = async () => {
    setCreating(true);
    try {
      await fetchApi('/erasure/requests', {
        method: 'POST',
        body: JSON.stringify({
          targetUserId: form.targetUserId || undefined,
          categories: form.categories.length > 0 ? form.categories : Object.keys(CATEGORY_META),
          dateRangeStart: form.dateStart || undefined,
          dateRangeEnd: form.dateEnd || undefined,
          legalBasis: form.legalBasis,
        }),
      });
      setShowCreate(false);
      await loadRequests();
    } catch { /* */ } finally { setCreating(false); }
  };

  const approveRequest = async (id: string) => {
    try { await fetchApi(`/erasure/requests/${id}/approve`, { method: 'POST' }); await loadRequests(); } catch { /* */ }
  };
  const executeRequest = async (id: string) => {
    try { await fetchApi(`/erasure/requests/${id}/execute`, { method: 'POST' }); await loadRequests(); } catch { /* */ }
  };

  const STATUS_COLORS: Record<string, string> = {
    completed: 'text-emerald-400 bg-emerald-500/15', in_progress: 'text-blue-400 bg-blue-500/15',
    requested: 'text-amber-400 bg-amber-500/15', approved: 'text-violet-400 bg-violet-500/15',
    failed: 'text-red-400 bg-red-500/15', rejected: 'text-red-400 bg-red-500/15',
  };

  const toggleCategory = (cat: string) => {
    setForm(f => ({
      ...f,
      categories: f.categories.includes(cat) ? f.categories.filter(c => c !== cat) : [...f.categories, cat],
    }));
  };

  return (
    <div className="space-y-4">
      <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-4">
        <div className="flex items-start gap-3">
          <Shield className="h-5 w-5 text-red-400 mt-0.5" />
          <div>
            <p className="text-sm font-semibold text-red-300">GDPR Right to Erasure (Article 17)</p>
            <p className="text-xs text-red-300/70 mt-1">
              Erasure requests delete log data for a specific user or tenant. <strong>Immutable categories</strong> (e.g., audit logs under HIPAA)
              <strong> cannot be erased</strong> and are automatically exempted with documented legal basis. Erasure is irreversible.
            </p>
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-white">Erasure Requests</h3>
        <button onClick={() => setShowCreate(!showCreate)}
          className="px-3 py-1.5 bg-red-600 hover:bg-red-500 text-white text-xs rounded-lg flex items-center gap-1.5">
          <Plus className="h-3.5 w-3.5" /> New Request
        </button>
      </div>

      {showCreate && (
        <div className="bg-slate-800/50 border border-red-500/30 rounded-xl p-5 space-y-4">
          <h4 className="text-sm font-semibold text-red-300">Create Erasure Request</h4>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs text-slate-400 block mb-1">Target User ID (optional)</label>
              <input value={form.targetUserId} onChange={e => setForm({ ...form, targetUserId: e.target.value })} placeholder="Leave empty for all tenant logs"
                className="w-full px-3 py-2 bg-slate-700/50 border border-slate-600/50 rounded-lg text-sm text-white placeholder-slate-500" />
            </div>
            <div>
              <label className="text-xs text-slate-400 block mb-1">Legal Basis</label>
              <input value={form.legalBasis} onChange={e => setForm({ ...form, legalBasis: e.target.value })}
                className="w-full px-3 py-2 bg-slate-700/50 border border-slate-600/50 rounded-lg text-sm text-white" />
            </div>
          </div>
          <div>
            <label className="text-xs text-slate-400 block mb-2">Categories to Erase</label>
            <div className="flex flex-wrap gap-2">
              {Object.entries(CATEGORY_META).map(([k, v]) => {
                const Icon = v.icon;
                const selected = form.categories.includes(k);
                return (
                  <button key={k} onClick={() => toggleCategory(k)}
                    className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs border transition-colors ${
                      selected ? 'bg-violet-500/20 border-violet-500/40 text-violet-300' : 'bg-slate-700/30 border-slate-600/30 text-slate-400 hover:text-slate-300'
                    }`}>
                    <Icon className="h-3 w-3" /> {v.label}
                  </button>
                );
              })}
            </div>
            <p className="text-[10px] text-slate-600 mt-1">Leave empty to request all categories (exempt categories will be auto-detected)</p>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs text-slate-400 block mb-1">Start Date (optional)</label>
              <input type="date" value={form.dateStart} onChange={e => setForm({ ...form, dateStart: e.target.value })}
                className="w-full px-3 py-2 bg-slate-700/50 border border-slate-600/50 rounded-lg text-sm text-white" />
            </div>
            <div>
              <label className="text-xs text-slate-400 block mb-1">End Date (optional)</label>
              <input type="date" value={form.dateEnd} onChange={e => setForm({ ...form, dateEnd: e.target.value })}
                className="w-full px-3 py-2 bg-slate-700/50 border border-slate-600/50 rounded-lg text-sm text-white" />
            </div>
          </div>
          <div className="flex gap-2">
            <button onClick={createRequest} disabled={creating}
              className="px-4 py-2 bg-red-600 hover:bg-red-500 text-white text-sm rounded-lg flex items-center gap-2 disabled:opacity-50">
              {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />} Submit Request
            </button>
            <button onClick={() => setShowCreate(false)} className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white text-sm rounded-lg">Cancel</button>
          </div>
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-violet-400" /></div>
      ) : requests.length === 0 ? (
        <div className="text-center py-12 text-slate-500">
          <Trash2 className="h-8 w-8 mx-auto mb-3 text-slate-600" />
          <p className="text-sm">No erasure requests</p>
          <p className="text-xs mt-1">Create an erasure request to remove log data under GDPR Article 17</p>
        </div>
      ) : (
        <div className="space-y-2">
          {requests.map(r => (
            <div key={r.id} className="px-4 py-3 bg-slate-800/30 border border-slate-700/50 rounded-xl space-y-2">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-white">
                    Erasure — {r.categories.length} categories • {r.totalEntries} entries
                    {r.targetUserId && <span className="text-slate-500"> • User: {r.targetUserId.substring(0, 8)}...</span>}
                  </p>
                  <p className="text-xs text-slate-500">{new Date(r.createdAt).toLocaleString()} • {r.requestedBy}</p>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${STATUS_COLORS[r.status] || 'text-slate-400'}`}>{r.status}</span>
                  {r.status === 'requested' && (
                    <button onClick={() => approveRequest(r.id)} className="px-2 py-1 bg-violet-600 hover:bg-violet-500 text-white text-[10px] rounded">Approve</button>
                  )}
                  {r.status === 'approved' && (
                    <button onClick={() => executeRequest(r.id)} className="px-2 py-1 bg-red-600 hover:bg-red-500 text-white text-[10px] rounded flex items-center gap-1">
                      <Play className="h-3 w-3" /> Execute
                    </button>
                  )}
                </div>
              </div>

              {r.exemptCategories.length > 0 && (
                <div className="flex items-start gap-2 px-3 py-2 bg-amber-500/10 border border-amber-500/20 rounded-lg">
                  <Lock className="h-3.5 w-3.5 text-amber-400 mt-0.5 flex-shrink-0" />
                  <div className="text-[11px] text-amber-300/80">
                    <span className="font-semibold">Exempt from erasure:</span>{' '}
                    {r.exemptCategories.map(c => CATEGORY_META[c]?.label || c).join(', ')}
                    {Object.values(r.exemptionReasons).length > 0 && (
                      <span className="block text-amber-400/60 mt-0.5">{Object.values(r.exemptionReasons)[0]}</span>
                    )}
                  </div>
                </div>
              )}

              {(r.status === 'in_progress' || r.status === 'completed') && (
                <div className="space-y-1">
                  <div className="flex justify-between text-[10px] text-slate-500">
                    <span>{r.erasedEntries} erased • {r.exemptEntries} exempt</span>
                    <span>{r.progressPct.toFixed(0)}%</span>
                  </div>
                  <div className="h-1.5 bg-slate-700/50 rounded-full overflow-hidden">
                    <div className={`h-full rounded-full ${r.status === 'completed' ? 'bg-emerald-500' : 'bg-red-500'}`}
                      style={{ width: `${r.progressPct}%` }} />
                  </div>
                </div>
              )}

              {r.erasureCertificateHash && (
                <div className="flex items-center gap-2 text-[10px] text-slate-600">
                  <Hash className="h-3 w-3" />
                  <span>Erasure certificate: {r.erasureCertificateHash.substring(0, 32)}...</span>
                  <button onClick={() => navigator.clipboard.writeText(r.erasureCertificateHash || '')} className="hover:text-slate-400">
                    <Copy className="h-3 w-3" />
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
