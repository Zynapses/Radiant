'use client';

import { useState } from 'react';
import {
  useGlobalBrainStats,
  useGlobalBrainEnrollment,
  useUpdateEnrollment,
  useGlobalBrainContributions,
} from '@/lib/hooks/use-global-brain';
import {
  Brain,
  Globe,
  Shield,
  Activity,
  Users,
  Database,
  CheckCircle2,
  XCircle,
  Loader2,
} from 'lucide-react';

function StatCard({ icon: Icon, label, value, sub }: {
  icon: React.ElementType;
  label: string;
  value: string | number;
  sub?: string;
}) {
  return (
    <div className="rounded-lg border bg-card p-4">
      <div className="flex items-center gap-2 text-muted-foreground mb-1">
        <Icon className="h-4 w-4" />
        <span className="text-xs font-medium uppercase tracking-wide">{label}</span>
      </div>
      <div className="text-2xl font-bold">{value}</div>
      {sub && <div className="text-xs text-muted-foreground mt-0.5">{sub}</div>}
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const colors: Record<string, string> = {
    collecting: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
    aggregating: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200',
    completed: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
    failed: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
    cancelled: 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200',
    uploaded: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
    aggregated: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
    expired: 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200',
    scheduled: 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200',
    publishing: 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900 dark:text-indigo-200',
  };
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${colors[status] || 'bg-gray-100 text-gray-800'}`}>
      {status}
    </span>
  );
}

function EnrollmentSection() {
  const { data: enrollment, isLoading } = useGlobalBrainEnrollment();
  const updateEnrollment = useUpdateEnrollment();

  if (isLoading) return <div className="flex items-center gap-2 text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Loading enrollment...</div>;

  const enrolled = enrollment?.enrolled ?? false;

  return (
    <div className="rounded-lg border bg-card p-6">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Shield className="h-5 w-5 text-primary" />
          <h3 className="text-lg font-semibold">Enrollment Status</h3>
        </div>
        <button
          onClick={() => updateEnrollment.mutate({ enrolled: !enrolled })}
          disabled={updateEnrollment.isPending}
          className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
            enrolled
              ? 'bg-red-100 text-red-700 hover:bg-red-200 dark:bg-red-900 dark:text-red-200'
              : 'bg-green-100 text-green-700 hover:bg-green-200 dark:bg-green-900 dark:text-green-200'
          }`}
        >
          {updateEnrollment.isPending ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : enrolled ? 'Unenroll' : 'Enroll in Global Brain'}
        </button>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <span className="text-sm text-muted-foreground">Status</span>
          <div className="flex items-center gap-1.5 mt-0.5">
            {enrolled ? (
              <><CheckCircle2 className="h-4 w-4 text-green-500" /> <span className="text-sm font-medium text-green-700 dark:text-green-400">Enrolled</span></>
            ) : (
              <><XCircle className="h-4 w-4 text-gray-400" /> <span className="text-sm font-medium text-gray-500">Not Enrolled</span></>
            )}
          </div>
        </div>
        <div>
          <span className="text-sm text-muted-foreground">Total Contributions</span>
          <div className="text-sm font-medium mt-0.5">{enrollment?.total_contributions ?? 0}</div>
        </div>
        <div>
          <span className="text-sm text-muted-foreground">Quality Score</span>
          <div className="text-sm font-medium mt-0.5">{((enrollment?.contribution_quality_score ?? 0) * 100).toFixed(0)}%</div>
        </div>
        <div>
          <span className="text-sm text-muted-foreground">Last Contribution</span>
          <div className="text-sm font-medium mt-0.5">
            {enrollment?.last_contribution ? new Date(enrollment.last_contribution).toLocaleDateString() : 'Never'}
          </div>
        </div>
      </div>

      {enrollment?.data_consent && (
        <div className="mt-4 pt-4 border-t">
          <span className="text-sm font-medium text-muted-foreground">Data Consent</span>
          <div className="grid grid-cols-3 gap-2 mt-2">
            {Object.entries(enrollment.data_consent).map(([key, val]) => (
              <div key={key} className="flex items-center gap-1.5 text-xs">
                {val ? <CheckCircle2 className="h-3 w-3 text-green-500" /> : <XCircle className="h-3 w-3 text-gray-400" />}
                <span className="text-muted-foreground">{key.replace(/_/g, ' ')}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {enrollment?.privacy_config && (
        <div className="mt-4 pt-4 border-t">
          <span className="text-sm font-medium text-muted-foreground">Privacy Parameters (DP-SGD)</span>
          <div className="grid grid-cols-3 gap-2 mt-2">
            <div className="text-xs"><span className="text-muted-foreground">Epsilon:</span> <span className="font-mono">{enrollment.privacy_config.dp_epsilon}</span></div>
            <div className="text-xs"><span className="text-muted-foreground">Delta:</span> <span className="font-mono">{enrollment.privacy_config.dp_delta}</span></div>
            <div className="text-xs"><span className="text-muted-foreground">Clip Norm:</span> <span className="font-mono">{enrollment.privacy_config.dp_clip_norm}</span></div>
            <div className="text-xs"><span className="text-muted-foreground">Noise Multiplier:</span> <span className="font-mono">{enrollment.privacy_config.noise_multiplier}</span></div>
            <div className="text-xs"><span className="text-muted-foreground">Retention:</span> <span className="font-mono">{enrollment.privacy_config.gradient_retention_days}d</span></div>
          </div>
        </div>
      )}
    </div>
  );
}

function ContributionsTable() {
  const { data: contributions, isLoading } = useGlobalBrainContributions();

  if (isLoading) return <div className="flex items-center gap-2 text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Loading contributions...</div>;
  if (!contributions || contributions.length === 0) return <div className="text-sm text-muted-foreground">No contributions yet</div>;

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b">
            <th className="text-left py-2 px-3 text-xs font-medium text-muted-foreground uppercase">Type</th>
            <th className="text-left py-2 px-3 text-xs font-medium text-muted-foreground uppercase">Status</th>
            <th className="text-left py-2 px-3 text-xs font-medium text-muted-foreground uppercase">Size</th>
            <th className="text-left py-2 px-3 text-xs font-medium text-muted-foreground uppercase">Quality</th>
            <th className="text-left py-2 px-3 text-xs font-medium text-muted-foreground uppercase">DP Noise</th>
            <th className="text-left py-2 px-3 text-xs font-medium text-muted-foreground uppercase">Uploaded</th>
          </tr>
        </thead>
        <tbody>
          {contributions.map((c) => (
            <tr key={c.id} className="border-b last:border-0 hover:bg-muted/50">
              <td className="py-2 px-3 font-mono text-xs">{c.gradient_type}</td>
              <td className="py-2 px-3"><StatusBadge status={c.status} /></td>
              <td className="py-2 px-3 text-muted-foreground">{(c.size_bytes / 1024).toFixed(1)} KB</td>
              <td className="py-2 px-3">{c.quality_score != null ? `${(c.quality_score * 100).toFixed(0)}%` : '—'}</td>
              <td className="py-2 px-3">
                {c.dp_noise_applied ? (
                  <span className="text-green-600 dark:text-green-400">Yes (ε={c.dp_epsilon_used})</span>
                ) : (
                  <span className="text-muted-foreground">No</span>
                )}
              </td>
              <td className="py-2 px-3 text-muted-foreground">{new Date(c.uploaded_at).toLocaleDateString()}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function GlobalBrainPage() {
  const { data: stats, isLoading: statsLoading } = useGlobalBrainStats();
  const [tab, setTab] = useState<'overview' | 'contributions'>('overview');

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Brain className="h-6 w-6 text-primary" />
          Global Brain
        </h1>
        <p className="text-muted-foreground mt-1">
          Federated learning across all tenant brains. Privacy-safe gradient aggregation and base cartridge generation.
        </p>
      </div>

      {/* Stats Overview */}
      {statsLoading ? (
        <div className="flex items-center gap-2 text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Loading stats...</div>
      ) : stats ? (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatCard
            icon={Users}
            label="Enrolled Tenants"
            value={stats.enrollment.enrolled_count}
            sub={`of ${stats.enrollment.total_count} total`}
          />
          <StatCard
            icon={Activity}
            label="Gradients (30d)"
            value={stats.gradients.total_gradients}
            sub={`${stats.gradients.unique_contributors} contributors`}
          />
          <StatCard
            icon={Globe}
            label="Completed Rounds"
            value={stats.rounds.completed}
            sub={stats.rounds.active > 0 ? `${stats.rounds.active} active` : 'None active'}
          />
          <StatCard
            icon={Database}
            label="Cartridge Pipelines"
            value={stats.pipelines.completed}
            sub={stats.pipelines.scheduled > 0 ? `${stats.pipelines.scheduled} scheduled` : 'None scheduled'}
          />
        </div>
      ) : null}

      {/* Tabs */}
      <div className="flex gap-1 border-b">
        <button
          onClick={() => setTab('overview')}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
            tab === 'overview' ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'
          }`}
        >
          Enrollment & Privacy
        </button>
        <button
          onClick={() => setTab('contributions')}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
            tab === 'contributions' ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'
          }`}
        >
          Contributions
        </button>
      </div>

      {/* Tab Content */}
      {tab === 'overview' && <EnrollmentSection />}
      {tab === 'contributions' && (
        <div className="rounded-lg border bg-card p-6">
          <h3 className="text-lg font-semibold mb-4">Contribution History</h3>
          <ContributionsTable />
        </div>
      )}
    </div>
  );
}
