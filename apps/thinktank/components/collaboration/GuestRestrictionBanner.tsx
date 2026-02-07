'use client';

/**
 * GuestRestrictionBanner
 *
 * Displayed to guest participants when tenant compliance policies restrict
 * certain capabilities (prompt execution, file upload/download, branching).
 * The banner is dismissible but re-appears if the guest attempts a restricted action.
 */

import { useState } from 'react';
import { ShieldAlert, X, Lock, MessageSquareOff, Upload, Download, GitBranch } from 'lucide-react';

export interface GuestRestriction {
  feature: string;
  message: string;
}

export interface GuestRestrictionBannerProps {
  title: string;
  message: string;
  restrictions: GuestRestriction[];
  complianceRestricted: boolean;
  dismissible?: boolean;
  onDismiss?: () => void;
}

const ICON_MAP: Record<string, typeof Lock> = {
  prompt_execution: MessageSquareOff,
  file_upload: Upload,
  file_download: Download,
  branch_create: GitBranch,
};

export function GuestRestrictionBanner({
  title,
  message,
  restrictions,
  complianceRestricted,
  dismissible = true,
  onDismiss,
}: GuestRestrictionBannerProps) {
  const [dismissed, setDismissed] = useState(false);

  if (dismissed) return null;
  if (restrictions.length === 0) return null;

  const handleDismiss = () => {
    setDismissed(true);
    onDismiss?.();
  };

  return (
    <div
      className={`relative mx-4 mt-3 rounded-xl border px-4 py-3 ${
        complianceRestricted
          ? 'bg-amber-500/10 border-amber-500/30'
          : 'bg-slate-500/10 border-slate-500/30'
      }`}
      role="alert"
    >
      <div className="flex items-start gap-3">
        <ShieldAlert
          className={`h-5 w-5 mt-0.5 flex-shrink-0 ${
            complianceRestricted ? 'text-amber-400' : 'text-slate-400'
          }`}
        />
        <div className="flex-1 min-w-0">
          <p
            className={`text-sm font-semibold ${
              complianceRestricted ? 'text-amber-200' : 'text-slate-200'
            }`}
          >
            {title}
          </p>
          <p className="text-xs text-slate-400 mt-0.5">{message}</p>

          <ul className="mt-2 space-y-1">
            {restrictions.map((r) => {
              const Icon = ICON_MAP[r.feature] || Lock;
              return (
                <li key={r.feature} className="flex items-center gap-2 text-xs text-slate-300">
                  <Icon className="h-3.5 w-3.5 text-slate-500 flex-shrink-0" />
                  <span>{r.message}</span>
                </li>
              );
            })}
          </ul>
        </div>

        {dismissible && (
          <button
            onClick={handleDismiss}
            className="flex-shrink-0 p-1 rounded-lg hover:bg-white/10 transition-colors"
            aria-label="Dismiss"
          >
            <X className="h-4 w-4 text-slate-500" />
          </button>
        )}
      </div>
    </div>
  );
}

/**
 * Hook to convert backend restriction notification into GuestRestrictionBanner props.
 */
export function useGuestRestrictions(notification: {
  show: boolean;
  title: string;
  message: string;
  restrictions: string[];
} | null): GuestRestrictionBannerProps | null {
  if (!notification || !notification.show) return null;

  const mapped: GuestRestriction[] = notification.restrictions.map((r) => {
    if (r.includes('prompt')) return { feature: 'prompt_execution', message: r };
    if (r.includes('upload')) return { feature: 'file_upload', message: r };
    if (r.includes('download')) return { feature: 'file_download', message: r };
    if (r.includes('branch')) return { feature: 'branch_create', message: r };
    return { feature: 'general', message: r };
  });

  return {
    title: notification.title,
    message: notification.message,
    restrictions: mapped,
    complianceRestricted: notification.title.includes('Compliance'),
  };
}
