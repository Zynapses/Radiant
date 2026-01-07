'use client';

import React, { useState } from 'react';
import { formatDistanceToNow, parseISO, format } from 'date-fns';
import {
  CheckCircle,
  XCircle,
  Edit3,
  Clock,
  AlertTriangle,
  User,
  FileText,
  Send,
  Loader2,
  Stethoscope,
  DollarSign,
  Scale,
  MessageSquare,
} from 'lucide-react';

// ============================================================================
// TYPES
// ============================================================================

interface PendingDecision {
  id: string;
  tenantId: string;
  sessionId: string;
  question: string;
  context: Record<string, unknown>;
  options: unknown[];
  topicTag?: string;
  domain: 'medical' | 'financial' | 'legal' | 'general';
  urgency: 'low' | 'normal' | 'high' | 'critical';
  status: 'pending' | 'resolved' | 'expired' | 'escalated';
  timeoutSeconds: number;
  expiresAt: string;
  flyteExecutionId: string;
  flyteNodeId: string;
  catoEscalationId?: string;
  resolution?: string;
  guidance?: string;
  resolvedBy?: string;
  resolvedAt?: string;
  createdAt: string;
  updatedAt: string;
}

interface DecisionDetailProps {
  decision: PendingDecision;
  onResolve?: (resolution: 'approved' | 'rejected' | 'modified', guidance: string) => Promise<void>;
  onClose?: () => void;
}

// ============================================================================
// HELPER COMPONENTS
// ============================================================================

const DomainIcon: React.FC<{ domain: string; className?: string }> = ({ domain, className = 'w-5 h-5' }) => {
  switch (domain) {
    case 'medical':
      return <Stethoscope className={`${className} text-red-500`} />;
    case 'financial':
      return <DollarSign className={`${className} text-green-500`} />;
    case 'legal':
      return <Scale className={`${className} text-blue-500`} />;
    default:
      return <MessageSquare className={`${className} text-gray-500`} />;
  }
};

const DomainBadge: React.FC<{ domain: string }> = ({ domain }) => {
  const colors: Record<string, string> = {
    medical: 'bg-red-100 text-red-800',
    financial: 'bg-green-100 text-green-800',
    legal: 'bg-blue-100 text-blue-800',
    general: 'bg-gray-100 text-gray-800',
  };

  const labels: Record<string, string> = {
    medical: 'Medical Review',
    financial: 'Financial Review',
    legal: 'Legal Review',
    general: 'General Review',
  };

  return (
    <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full ${colors[domain] || colors.general}`}>
      <DomainIcon domain={domain} className="w-4 h-4" />
      <span className="text-sm font-medium">{labels[domain] || 'Review'}</span>
    </div>
  );
};

const UrgencyIndicator: React.FC<{ urgency: string }> = ({ urgency }) => {
  const config: Record<string, { color: string; label: string; pulse: boolean }> = {
    critical: { color: 'bg-red-500', label: 'Critical', pulse: true },
    high: { color: 'bg-orange-500', label: 'High', pulse: false },
    normal: { color: 'bg-blue-500', label: 'Normal', pulse: false },
    low: { color: 'bg-gray-400', label: 'Low', pulse: false },
  };

  const { color, label, pulse } = config[urgency] || config.normal;

  return (
    <div className="flex items-center gap-2">
      <span className={`w-3 h-3 rounded-full ${color} ${pulse ? 'animate-pulse' : ''}`} />
      <span className="text-sm font-medium text-gray-700">{label} Priority</span>
    </div>
  );
};

const TimeRemaining: React.FC<{ expiresAt: string; status: string }> = ({ expiresAt, status }) => {
  const [timeLeft, setTimeLeft] = React.useState<string>('');
  const [progress, setProgress] = React.useState(100);

  React.useEffect(() => {
    if (status !== 'pending') {
      setTimeLeft('N/A');
      return;
    }

    const updateTime = () => {
      const now = new Date();
      const expires = parseISO(expiresAt);
      const diffMs = expires.getTime() - now.getTime();

      if (diffMs <= 0) {
        setTimeLeft('Expired');
        setProgress(0);
        return;
      }

      const diffSeconds = Math.floor(diffMs / 1000);
      const minutes = Math.floor(diffSeconds / 60);
      const seconds = diffSeconds % 60;

      if (minutes > 0) {
        setTimeLeft(`${minutes}m ${seconds}s remaining`);
      } else {
        setTimeLeft(`${seconds}s remaining`);
      }

      const totalSeconds = 1800;
      setProgress(Math.min(100, (diffSeconds / totalSeconds) * 100));
    };

    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, [expiresAt, status]);

  const progressColor = progress > 50 ? 'bg-green-500' : progress > 20 ? 'bg-yellow-500' : 'bg-red-500';

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between text-sm">
        <span className="text-gray-600">Time Remaining</span>
        <span className={`font-mono font-medium ${progress < 20 ? 'text-red-600' : 'text-gray-900'}`}>
          {timeLeft}
        </span>
      </div>
      {status === 'pending' && (
        <div className="w-full h-2 bg-gray-200 rounded-full overflow-hidden">
          <div
            className={`h-full transition-all duration-1000 ${progressColor}`}
            style={{ width: `${progress}%` }}
          />
        </div>
      )}
    </div>
  );
};

// ============================================================================
// RESOLUTION FORM
// ============================================================================

interface ResolutionFormProps {
  onSubmit: (resolution: 'approved' | 'rejected' | 'modified', guidance: string) => Promise<void>;
  requireGuidance?: boolean;
  loading?: boolean;
}

const ResolutionForm: React.FC<ResolutionFormProps> = ({ onSubmit, requireGuidance = true, loading = false }) => {
  const [guidance, setGuidance] = useState('');
  const [selectedResolution, setSelectedResolution] = useState<'approved' | 'rejected' | 'modified' | null>(null);

  const handleSubmit = async (resolution: 'approved' | 'rejected' | 'modified') => {
    if (requireGuidance && !guidance.trim() && resolution !== 'approved') {
      return;
    }
    setSelectedResolution(resolution);
    await onSubmit(resolution, guidance);
    setSelectedResolution(null);
  };

  return (
    <div className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Guidance for AI {requireGuidance && <span className="text-red-500">*</span>}
        </label>
        <textarea
          value={guidance}
          onChange={(e) => setGuidance(e.target.value)}
          placeholder="Provide guidance for the AI to incorporate..."
          className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-none"
          rows={4}
          disabled={loading}
        />
        <p className="mt-1 text-xs text-gray-500">
          This guidance will be used to refine the AI&apos;s response.
        </p>
      </div>

      <div className="flex gap-3">
        <button
          onClick={() => handleSubmit('approved')}
          disabled={loading}
          className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {loading && selectedResolution === 'approved' ? (
            <Loader2 className="w-5 h-5 animate-spin" />
          ) : (
            <CheckCircle className="w-5 h-5" />
          )}
          <span className="font-medium">Approve</span>
        </button>

        <button
          onClick={() => handleSubmit('modified')}
          disabled={loading || (requireGuidance && !guidance.trim())}
          className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {loading && selectedResolution === 'modified' ? (
            <Loader2 className="w-5 h-5 animate-spin" />
          ) : (
            <Edit3 className="w-5 h-5" />
          )}
          <span className="font-medium">Modify</span>
        </button>

        <button
          onClick={() => handleSubmit('rejected')}
          disabled={loading || (requireGuidance && !guidance.trim())}
          className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {loading && selectedResolution === 'rejected' ? (
            <Loader2 className="w-5 h-5 animate-spin" />
          ) : (
            <XCircle className="w-5 h-5" />
          )}
          <span className="font-medium">Reject</span>
        </button>
      </div>
    </div>
  );
};

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export const DecisionDetail: React.FC<DecisionDetailProps> = ({
  decision,
  onResolve,
  onClose,
}) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleResolve = async (resolution: 'approved' | 'rejected' | 'modified', guidance: string) => {
    if (!onResolve) return;

    setLoading(true);
    setError(null);

    try {
      await onResolve(resolution, guidance);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to resolve decision');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-full bg-white">
      <div className="p-6 border-b border-gray-200">
        <div className="flex items-start justify-between mb-4">
          <DomainBadge domain={decision.domain} />
          <UrgencyIndicator urgency={decision.urgency} />
        </div>

        <TimeRemaining expiresAt={decision.expiresAt} status={decision.status} />
      </div>

      <div className="flex-1 overflow-y-auto p-6 space-y-6">
        <div>
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Question</h3>
          <div className="p-4 bg-gray-50 rounded-lg border border-gray-200">
            <p className="text-gray-800 whitespace-pre-wrap">{decision.question}</p>
          </div>
        </div>

        {Object.keys(decision.context).length > 0 && (
          <div>
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Context</h3>
            <div className="p-4 bg-gray-50 rounded-lg border border-gray-200 space-y-2">
              {Object.entries(decision.context).map(([key, value]) => (
                <div key={key} className="flex items-start gap-2">
                  <span className="text-sm font-medium text-gray-600 min-w-[120px]">{key}:</span>
                  <span className="text-sm text-gray-800">
                    {typeof value === 'object' ? JSON.stringify(value) : String(value)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        <div>
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Metadata</h3>
          <div className="grid grid-cols-2 gap-4">
            <div className="p-3 bg-gray-50 rounded-lg">
              <p className="text-xs text-gray-500 mb-1">Created</p>
              <p className="text-sm font-medium text-gray-900">
                {format(parseISO(decision.createdAt), 'PPpp')}
              </p>
            </div>
            <div className="p-3 bg-gray-50 rounded-lg">
              <p className="text-xs text-gray-500 mb-1">Session ID</p>
              <p className="text-sm font-mono text-gray-900">{decision.sessionId.substring(0, 8)}...</p>
            </div>
            <div className="p-3 bg-gray-50 rounded-lg">
              <p className="text-xs text-gray-500 mb-1">Flyte Execution</p>
              <p className="text-sm font-mono text-gray-900">{decision.flyteExecutionId.substring(0, 12)}...</p>
            </div>
            {decision.catoEscalationId && (
              <div className="p-3 bg-orange-50 rounded-lg">
                <p className="text-xs text-orange-600 mb-1">Cato Escalation</p>
                <p className="text-sm font-mono text-orange-900">{decision.catoEscalationId.substring(0, 8)}...</p>
              </div>
            )}
          </div>
        </div>

        {decision.status === 'resolved' && (
          <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
            <div className="flex items-center gap-2 mb-2">
              <CheckCircle className="w-5 h-5 text-green-600" />
              <h4 className="font-semibold text-green-900">Resolved</h4>
            </div>
            <div className="space-y-2 text-sm">
              <p><span className="text-green-700">Resolution:</span> {decision.resolution}</p>
              {decision.guidance && (
                <p><span className="text-green-700">Guidance:</span> {decision.guidance}</p>
              )}
              {decision.resolvedAt && (
                <p><span className="text-green-700">Resolved at:</span> {format(parseISO(decision.resolvedAt), 'PPpp')}</p>
              )}
            </div>
          </div>
        )}

        {decision.status === 'expired' && (
          <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
            <div className="flex items-center gap-2 mb-2">
              <Clock className="w-5 h-5 text-red-600" />
              <h4 className="font-semibold text-red-900">Expired</h4>
            </div>
            <p className="text-sm text-red-700">This decision timed out without human response.</p>
          </div>
        )}

        {decision.status === 'escalated' && (
          <div className="p-4 bg-orange-50 border border-orange-200 rounded-lg">
            <div className="flex items-center gap-2 mb-2">
              <AlertTriangle className="w-5 h-5 text-orange-600" />
              <h4 className="font-semibold text-orange-900">Escalated</h4>
            </div>
            <p className="text-sm text-orange-700">This decision has been escalated to on-call personnel.</p>
          </div>
        )}
      </div>

      {decision.status === 'pending' && (
        <div className="p-6 border-t border-gray-200 bg-gray-50">
          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
              {error}
            </div>
          )}
          <ResolutionForm
            onSubmit={handleResolve}
            requireGuidance={decision.domain !== 'general'}
            loading={loading}
          />
        </div>
      )}
    </div>
  );
};

export default DecisionDetail;
