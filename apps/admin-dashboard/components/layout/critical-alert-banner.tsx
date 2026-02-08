'use client';

import { useState, useEffect, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { AlertTriangle, X, ShieldAlert, Info, ExternalLink } from 'lucide-react';
import { api } from '@/lib/api/client';

interface CriticalAlert {
  id: string;
  alertType: string;
  severity: 'critical' | 'warning' | 'info';
  title: string;
  message: string;
  scope: string;
  tenantId: string | null;
  createdAt: string;
}

export function CriticalAlertBanner() {
  const [dismissedIds, setDismissedIds] = useState<Set<string>>(new Set());

  const { data: alerts = [] } = useQuery<CriticalAlert[]>({
    queryKey: ['critical-alerts'],
    queryFn: () => api.get<CriticalAlert[]>('/api/admin/critical-alerts'),
    refetchInterval: 30_000,
    staleTime: 15_000,
  });

  const visibleAlerts = alerts.filter(a => !dismissedIds.has(a.id));

  const handleDismiss = useCallback(async (alertId: string) => {
    setDismissedIds(prev => new Set([...Array.from(prev), alertId]));
    try {
      await api.post(`/api/admin/critical-alerts/${alertId}/dismiss`);
    } catch {
      // Silently fail — UI already dismissed
    }
  }, []);

  if (visibleAlerts.length === 0) return null;

  return (
    <div className="w-full space-y-0">
      {visibleAlerts.map(alert => (
        <AlertRow key={alert.id} alert={alert} onDismiss={handleDismiss} />
      ))}
    </div>
  );
}

function AlertRow({
  alert,
  onDismiss,
}: {
  alert: CriticalAlert;
  onDismiss: (id: string) => void;
}) {
  const config = severityConfig[alert.severity];

  return (
    <div
      className={`flex items-center gap-3 px-4 py-2.5 text-sm font-medium ${config.bg} ${config.text} ${config.border} border-b`}
      role="alert"
    >
      <config.icon className="h-4 w-4 flex-shrink-0" />
      <span className="font-semibold">{alert.title}</span>
      <span className="opacity-80">&mdash;</span>
      <span className="flex-1 opacity-90 truncate">{alert.message}</span>
      {alert.alertType.includes('frozen') || alert.alertType.includes('suspended') ? (
        <a
          href="/spend-governor"
          className={`flex items-center gap-1 text-xs ${config.link} hover:underline flex-shrink-0`}
        >
          View Details <ExternalLink className="h-3 w-3" />
        </a>
      ) : null}
      <button
        onClick={() => onDismiss(alert.id)}
        className={`p-1 rounded hover:bg-black/10 flex-shrink-0 ${config.text}`}
        aria-label="Dismiss alert"
      >
        <X className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}

const severityConfig = {
  critical: {
    bg: 'bg-red-600',
    text: 'text-white',
    border: 'border-red-700',
    link: 'text-red-100',
    icon: ShieldAlert,
  },
  warning: {
    bg: 'bg-amber-500',
    text: 'text-amber-950',
    border: 'border-amber-600',
    link: 'text-amber-900',
    icon: AlertTriangle,
  },
  info: {
    bg: 'bg-blue-500',
    text: 'text-white',
    border: 'border-blue-600',
    link: 'text-blue-100',
    icon: Info,
  },
} as const;
