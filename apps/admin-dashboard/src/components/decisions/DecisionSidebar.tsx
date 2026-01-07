'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { formatDistanceToNow, parseISO } from 'date-fns';
import {
  AlertCircle,
  CheckCircle,
  Clock,
  XCircle,
  AlertTriangle,
  Stethoscope,
  DollarSign,
  Scale,
  MessageSquare,
  ChevronRight,
  RefreshCw,
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

interface DashboardStats {
  pendingCount: number;
  resolvedToday: number;
  expiredToday: number;
  escalatedToday: number;
  avgResolutionTimeMs: number;
  byDomain: Record<string, number>;
  byUrgency: Record<string, number>;
}

interface DecisionSidebarProps {
  onDecisionSelect?: (decision: PendingDecision) => void;
  selectedDecisionId?: string;
}

// ============================================================================
// HELPER COMPONENTS
// ============================================================================

const DomainIcon: React.FC<{ domain: string; className?: string }> = ({ domain, className = 'w-4 h-4' }) => {
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

const UrgencyBadge: React.FC<{ urgency: string }> = ({ urgency }) => {
  const colors: Record<string, string> = {
    critical: 'bg-red-100 text-red-800 border-red-200',
    high: 'bg-orange-100 text-orange-800 border-orange-200',
    normal: 'bg-blue-100 text-blue-800 border-blue-200',
    low: 'bg-gray-100 text-gray-800 border-gray-200',
  };

  return (
    <span className={`px-2 py-0.5 text-xs font-medium rounded-full border ${colors[urgency] || colors.normal}`}>
      {urgency.charAt(0).toUpperCase() + urgency.slice(1)}
    </span>
  );
};

const StatusIcon: React.FC<{ status: string; className?: string }> = ({ status, className = 'w-4 h-4' }) => {
  switch (status) {
    case 'pending':
      return <Clock className={`${className} text-yellow-500`} />;
    case 'resolved':
      return <CheckCircle className={`${className} text-green-500`} />;
    case 'expired':
      return <XCircle className={`${className} text-red-500`} />;
    case 'escalated':
      return <AlertTriangle className={`${className} text-orange-500`} />;
    default:
      return <AlertCircle className={`${className} text-gray-500`} />;
  }
};

const TimeRemaining: React.FC<{ expiresAt: string }> = ({ expiresAt }) => {
  const [timeLeft, setTimeLeft] = useState<string>('');
  const [isUrgent, setIsUrgent] = useState(false);

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      const expires = parseISO(expiresAt);
      const diffMs = expires.getTime() - now.getTime();

      if (diffMs <= 0) {
        setTimeLeft('Expired');
        setIsUrgent(true);
        return;
      }

      const diffSeconds = Math.floor(diffMs / 1000);
      const minutes = Math.floor(diffSeconds / 60);
      const seconds = diffSeconds % 60;

      if (minutes > 0) {
        setTimeLeft(`${minutes}m ${seconds}s`);
      } else {
        setTimeLeft(`${seconds}s`);
      }

      setIsUrgent(diffSeconds < 60);
    };

    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, [expiresAt]);

  return (
    <span className={`font-mono text-sm ${isUrgent ? 'text-red-600 font-bold animate-pulse' : 'text-gray-600'}`}>
      {timeLeft}
    </span>
  );
};

// ============================================================================
// DECISION CARD
// ============================================================================

interface DecisionCardProps {
  decision: PendingDecision;
  isSelected: boolean;
  onClick: () => void;
}

const DecisionCard: React.FC<DecisionCardProps> = ({ decision, isSelected, onClick }) => {
  return (
    <div
      onClick={onClick}
      className={`
        p-4 border rounded-lg cursor-pointer transition-all duration-200
        ${isSelected 
          ? 'border-blue-500 bg-blue-50 shadow-md' 
          : 'border-gray-200 bg-white hover:border-gray-300 hover:shadow-sm'}
        ${decision.urgency === 'critical' ? 'border-l-4 border-l-red-500' : ''}
      `}
    >
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="flex items-center gap-2">
          <DomainIcon domain={decision.domain} />
          <UrgencyBadge urgency={decision.urgency} />
        </div>
        <StatusIcon status={decision.status} />
      </div>

      <p className="text-sm text-gray-900 line-clamp-2 mb-2">
        {decision.question.substring(0, 150)}
        {decision.question.length > 150 ? '...' : ''}
      </p>

      <div className="flex items-center justify-between text-xs text-gray-500">
        <span>{formatDistanceToNow(parseISO(decision.createdAt), { addSuffix: true })}</span>
        {decision.status === 'pending' && <TimeRemaining expiresAt={decision.expiresAt} />}
      </div>

      {isSelected && (
        <div className="mt-2 flex items-center text-xs text-blue-600">
          <span>View details</span>
          <ChevronRight className="w-3 h-3 ml-1" />
        </div>
      )}
    </div>
  );
};

// ============================================================================
// STATS PANEL
// ============================================================================

interface StatsPanelProps {
  stats: DashboardStats | null;
  loading: boolean;
}

const StatsPanel: React.FC<StatsPanelProps> = ({ stats, loading }) => {
  if (loading || !stats) {
    return (
      <div className="grid grid-cols-4 gap-4 p-4 bg-gray-50 rounded-lg animate-pulse">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="h-16 bg-gray-200 rounded" />
        ))}
      </div>
    );
  }

  const statItems = [
    { label: 'Pending', value: stats.pendingCount, color: 'text-yellow-600', bgColor: 'bg-yellow-50' },
    { label: 'Resolved Today', value: stats.resolvedToday, color: 'text-green-600', bgColor: 'bg-green-50' },
    { label: 'Expired Today', value: stats.expiredToday, color: 'text-red-600', bgColor: 'bg-red-50' },
    { label: 'Escalated', value: stats.escalatedToday, color: 'text-orange-600', bgColor: 'bg-orange-50' },
  ];

  return (
    <div className="grid grid-cols-4 gap-4 p-4 bg-gray-50 rounded-lg">
      {statItems.map((item) => (
        <div key={item.label} className={`p-3 rounded-lg ${item.bgColor}`}>
          <p className="text-xs text-gray-600">{item.label}</p>
          <p className={`text-2xl font-bold ${item.color}`}>{item.value}</p>
        </div>
      ))}
    </div>
  );
};

// ============================================================================
// MAIN SIDEBAR
// ============================================================================

export const DecisionSidebar: React.FC<DecisionSidebarProps> = ({
  onDecisionSelect,
  selectedDecisionId,
}) => {
  const [decisions, setDecisions] = useState<PendingDecision[]>([]);
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<{
    status: string;
    domain: string;
  }>({
    status: 'pending',
    domain: '',
  });

  const fetchDecisions = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (filter.status) params.set('status', filter.status);
      if (filter.domain) params.set('domain', filter.domain);

      const response = await fetch(`/api/mission-control/decisions?${params.toString()}`, {
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (response.ok) {
        const data = await response.json();
        setDecisions(data);
      }
    } catch (error) {
      console.error('Failed to fetch decisions:', error);
    }
  }, [filter]);

  const fetchStats = useCallback(async () => {
    try {
      const response = await fetch('/api/mission-control/stats', {
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (response.ok) {
        const data = await response.json();
        setStats(data);
      }
    } catch (error) {
      console.error('Failed to fetch stats:', error);
    }
  }, []);

  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      await Promise.all([fetchDecisions(), fetchStats()]);
      setLoading(false);
    };

    loadData();

    const interval = setInterval(() => {
      fetchDecisions();
      fetchStats();
    }, 10000);

    return () => clearInterval(interval);
  }, [fetchDecisions, fetchStats]);

  const handleRefresh = async () => {
    setLoading(true);
    await Promise.all([fetchDecisions(), fetchStats()]);
    setLoading(false);
  };

  return (
    <div className="flex flex-col h-full bg-white border-r border-gray-200">
      <div className="p-4 border-b border-gray-200">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-900">Mission Control</h2>
          <button
            onClick={handleRefresh}
            disabled={loading}
            className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>

        <StatsPanel stats={stats} loading={loading} />
      </div>

      <div className="p-4 border-b border-gray-200">
        <div className="flex gap-2">
          <select
            value={filter.status}
            onChange={(e) => setFilter((f) => ({ ...f, status: e.target.value }))}
            className="flex-1 px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          >
            <option value="">All Status</option>
            <option value="pending">Pending</option>
            <option value="resolved">Resolved</option>
            <option value="expired">Expired</option>
            <option value="escalated">Escalated</option>
          </select>

          <select
            value={filter.domain}
            onChange={(e) => setFilter((f) => ({ ...f, domain: e.target.value }))}
            className="flex-1 px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          >
            <option value="">All Domains</option>
            <option value="medical">Medical</option>
            <option value="financial">Financial</option>
            <option value="legal">Legal</option>
            <option value="general">General</option>
          </select>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {loading && decisions.length === 0 ? (
          <div className="space-y-3">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="h-24 bg-gray-100 rounded-lg animate-pulse" />
            ))}
          </div>
        ) : decisions.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-gray-500">
            <CheckCircle className="w-12 h-12 mb-4 text-gray-300" />
            <p className="text-sm font-medium">No decisions found</p>
            <p className="text-xs mt-1">All caught up!</p>
          </div>
        ) : (
          decisions.map((decision) => (
            <DecisionCard
              key={decision.id}
              decision={decision}
              isSelected={decision.id === selectedDecisionId}
              onClick={() => onDecisionSelect?.(decision)}
            />
          ))
        )}
      </div>
    </div>
  );
};

export default DecisionSidebar;
