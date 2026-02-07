'use client';

/**
 * Memory Retention — Think Tank Admin Dashboard
 * 
 * Tenant-level memory retention override management.
 * Think Tank Admins can override platform defaults for their tenant.
 */

import { useState, useEffect, useCallback } from 'react';

const API_BASE = '/api/admin/memory-retention';

async function fetchApi<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: { 'Content-Type': 'application/json', ...options?.headers },
  });
  if (!res.ok) throw new Error(`API error: ${res.status}`);
  return res.json();
}

function StatCard({ label, value, color = 'blue' }: { label: string; value: string | number; color?: string }) {
  const colors: Record<string, string> = {
    blue: 'bg-blue-50 border-blue-200 text-blue-700',
    green: 'bg-green-50 border-green-200 text-green-700',
    amber: 'bg-amber-50 border-amber-200 text-amber-700',
    purple: 'bg-purple-50 border-purple-200 text-purple-700',
  };
  return (
    <div className={`rounded-lg border p-4 ${colors[color] || colors.blue}`}>
      <p className="text-sm font-medium opacity-70">{label}</p>
      <p className="text-2xl font-bold mt-1">{typeof value === 'number' ? value.toLocaleString() : value}</p>
    </div>
  );
}

function ToggleSwitch({ label, enabled, description, onChange }: {
  label: string; enabled: boolean; description: string; onChange: (v: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between py-3 border-b border-gray-100">
      <div>
        <p className="text-sm font-medium text-gray-900">{label}</p>
        <p className="text-xs text-gray-500">{description}</p>
      </div>
      <button
        onClick={() => onChange(!enabled)}
        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
          enabled ? 'bg-blue-600' : 'bg-gray-300'
        }`}
      >
        <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
          enabled ? 'translate-x-6' : 'translate-x-1'
        }`} />
      </button>
    </div>
  );
}

function NumberInput({ label, value, description, onChange, suffix }: {
  label: string; value: number; description: string; onChange: (v: number) => void; suffix?: string;
}) {
  return (
    <div className="flex items-center justify-between py-3 border-b border-gray-100">
      <div>
        <p className="text-sm font-medium text-gray-900">{label}</p>
        <p className="text-xs text-gray-500">{description}</p>
      </div>
      <div className="flex items-center gap-2">
        <input
          type="number"
          value={value}
          onChange={e => onChange(Number(e.target.value))}
          className="w-24 text-right px-2 py-1 border rounded text-sm"
          min={0}
        />
        {suffix && <span className="text-xs text-gray-500">{suffix}</span>}
      </div>
    </div>
  );
}

export default function ThinkTankAdminMemoryRetentionPage() {
  const [dashboard, setDashboard] = useState<Record<string, unknown> | null>(null);
  const [override, setOverride] = useState<Record<string, unknown>>({});
  const [hasOverride, setHasOverride] = useState(false);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const [dash, tenantOverride] = await Promise.all([
        fetchApi<Record<string, unknown>>('/dashboard'),
        fetchApi<Record<string, unknown>>('/tenant/override'),
      ]);
      setDashboard(dash);
      if (tenantOverride && !('active' in tenantOverride && tenantOverride.active === false)) {
        setOverride(tenantOverride);
        setHasOverride(true);
      }
    } catch (e) {
      setMessage({ type: 'error', text: e instanceof Error ? e.message : 'Failed to load' });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const saveOverride = async () => {
    try {
      setSaving(true);
      await fetchApi('/tenant/override', {
        method: 'PUT',
        body: JSON.stringify({ ...override, targetType: 'all' }),
      });
      setMessage({ type: 'success', text: 'Tenant override saved successfully' });
      setHasOverride(true);
      load();
    } catch (e) {
      setMessage({ type: 'error', text: e instanceof Error ? e.message : 'Failed to save' });
    } finally {
      setSaving(false);
    }
  };

  const removeOverride = async () => {
    try {
      await fetchApi('/tenant/override?targetType=all', { method: 'DELETE' });
      setOverride({});
      setHasOverride(false);
      setMessage({ type: 'success', text: 'Tenant override removed — platform defaults restored' });
      load();
    } catch (e) {
      setMessage({ type: 'error', text: e instanceof Error ? e.message : 'Failed to remove' });
    }
  };

  if (loading) {
    return (
      <div className="p-8">
        <h1 className="text-2xl font-bold text-gray-900">Memory Retention Settings</h1>
        <p className="text-gray-500 mt-1">Loading...</p>
      </div>
    );
  }

  const ep = dashboard?.effectivePolicy as Record<string, unknown> | undefined;
  const usage = dashboard?.usage as Record<string, unknown> | undefined;

  return (
    <div className="p-8 max-w-5xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Memory Retention Settings</h1>
        <p className="text-gray-500 mt-1">
          Configure how long user memories are retained and what features are enabled for your tenant
        </p>
      </div>

      {message && (
        <div className={`mb-4 p-3 rounded-lg text-sm ${
          message.type === 'success' ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-red-50 text-red-700 border border-red-200'
        }`}>
          {message.text}
          <button onClick={() => setMessage(null)} className="float-right text-xs opacity-60">dismiss</button>
        </div>
      )}

      {/* Usage Stats */}
      {usage && (
        <div className="bg-white rounded-xl border p-6 mb-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Current Usage</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <StatCard label="Users with Memory" value={Number(usage.totalUsers || 0)} color="blue" />
            <StatCard label="Total Entries" value={Number(usage.totalEntries || 0)} color="purple" />
            <StatCard label="Avg Storage/User" value={`${Number(usage.avgStorageMb || 0).toFixed(1)}MB`} color="green" />
            <StatCard label="Avg Entries/User" value={Number(usage.avgEntriesPerUser || 0).toFixed(0)} color="amber" />
          </div>
        </div>
      )}

      {/* Effective Policy (read-only) */}
      {ep && (
        <div className="bg-blue-50 rounded-xl border border-blue-200 p-6 mb-6">
          <h3 className="text-sm font-semibold text-blue-800 mb-2">Currently Active Policy</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            <div><span className="text-blue-600">Retention:</span> <span className="font-medium">{ep.retentionDays === 0 ? 'Unlimited' : `${ep.retentionDays} days`}</span></div>
            <div><span className="text-blue-600">Max Storage:</span> <span className="font-medium">{ep.maxStoragePerUserMb === 0 ? 'Unlimited' : `${ep.maxStoragePerUserMb}MB`}</span></div>
            <div><span className="text-blue-600">Session Memory:</span> <span className="font-medium">{ep.sessionToSessionMemoryEnabled ? 'ON' : 'OFF'}</span></div>
            <div><span className="text-blue-600">Auto-Extract:</span> <span className="font-medium">{ep.autoExtractEnabled ? 'ON' : 'OFF'}</span></div>
            <div><span className="text-blue-600">Uploads:</span> <span className="font-medium">{ep.uploadedDocumentsEnabled !== false ? 'ON' : 'OFF'}</span></div>
            <div><span className="text-blue-600">Downloads:</span> <span className="font-medium">{ep.downloadedFilesEnabled !== false ? 'ON' : 'OFF'}</span></div>
          </div>
        </div>
      )}

      {/* Tenant Override Editor */}
      <div className="bg-white rounded-xl border p-6 mb-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-lg font-semibold text-gray-900">Tenant Override</h3>
            <p className="text-sm text-gray-500">Override platform defaults for this tenant. Leave fields unchanged to inherit platform defaults.</p>
          </div>
          {hasOverride && (
            <button onClick={removeOverride} className="px-3 py-1 text-xs text-red-600 border border-red-200 rounded hover:bg-red-50">
              Remove Override
            </button>
          )}
        </div>

        <ToggleSwitch
          label="Session-to-Session Memory"
          enabled={override.sessionToSessionMemoryEnabled !== undefined ? override.sessionToSessionMemoryEnabled as boolean : (ep?.sessionToSessionMemoryEnabled as boolean ?? true)}
          description="Enable persistent memory across all conversations and models"
          onChange={v => setOverride({ ...override, sessionToSessionMemoryEnabled: v })}
        />
        <ToggleSwitch
          label="Conversation History"
          enabled={override.conversationHistoryEnabled !== undefined ? override.conversationHistoryEnabled as boolean : (ep?.conversationHistoryEnabled as boolean ?? true)}
          description="Store full conversation transcripts"
          onChange={v => setOverride({ ...override, conversationHistoryEnabled: v })}
        />
        <ToggleSwitch
          label="Auto-Extract Facts"
          enabled={override.autoExtractEnabled !== undefined ? override.autoExtractEnabled as boolean : (ep?.autoExtractEnabled as boolean ?? true)}
          description="Automatically extract facts and preferences from conversations"
          onChange={v => setOverride({ ...override, autoExtractEnabled: v })}
        />
        <ToggleSwitch
          label="User Can Delete Own Memory"
          enabled={override.userCanDeleteOwnMemory !== undefined ? override.userCanDeleteOwnMemory as boolean : (ep?.userCanDeleteOwnMemory as boolean ?? true)}
          description="Allow users to manage and delete their own memory entries"
          onChange={v => setOverride({ ...override, userCanDeleteOwnMemory: v })}
        />
        <ToggleSwitch
          label="Uploaded Documents in Memory"
          enabled={override.uploadedDocumentsEnabled !== undefined ? override.uploadedDocumentsEnabled as boolean : (ep?.uploadedDocumentsEnabled as boolean ?? true)}
          description="Include uploaded documents (PDFs, images, code, etc.) in user memory profile across all chats"
          onChange={v => setOverride({ ...override, uploadedDocumentsEnabled: v })}
        />
        <ToggleSwitch
          label="Downloaded Files in Memory"
          enabled={override.downloadedFilesEnabled !== undefined ? override.downloadedFilesEnabled as boolean : (ep?.downloadedFilesEnabled as boolean ?? true)}
          description="Include AI-generated and retrieved files in user memory profile across all chats"
          onChange={v => setOverride({ ...override, downloadedFilesEnabled: v })}
        />

        <div className="mt-4">
          <NumberInput
            label="Retention Days"
            value={override.retentionDays !== undefined ? override.retentionDays as number : (ep?.retentionDays as number ?? 0)}
            description="How many days to retain memories (0 = unlimited)"
            onChange={v => setOverride({ ...override, retentionDays: v })}
            suffix="days"
          />
          <NumberInput
            label="Max Storage Per User"
            value={override.maxStoragePerUserMb !== undefined ? override.maxStoragePerUserMb as number : (ep?.maxStoragePerUserMb as number ?? 0)}
            description="Maximum storage per user in MB (0 = unlimited)"
            onChange={v => setOverride({ ...override, maxStoragePerUserMb: v })}
            suffix="MB"
          />
          <NumberInput
            label="Hot Tier Days"
            value={override.hotTierDays !== undefined ? override.hotTierDays as number : (ep?.hotTierDays as number ?? 30)}
            description="Days in fast-access hot storage"
            onChange={v => setOverride({ ...override, hotTierDays: v })}
            suffix="days"
          />
          <NumberInput
            label="Warm Tier Days"
            value={override.warmTierDays !== undefined ? override.warmTierDays as number : (ep?.warmTierDays as number ?? 180)}
            description="Days in warm storage before moving to cold"
            onChange={v => setOverride({ ...override, warmTierDays: v })}
            suffix="days"
          />
          <NumberInput
            label="Max Upload Size"
            value={override.maxUploadSizeMb !== undefined ? override.maxUploadSizeMb as number : (ep?.maxUploadSizeMb as number ?? 100)}
            description="Maximum file upload size per file in MB"
            onChange={v => setOverride({ ...override, maxUploadSizeMb: v })}
            suffix="MB"
          />
        </div>

        <div className="mt-6 flex gap-3">
          <button
            onClick={saveOverride}
            disabled={saving}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
          >
            {saving ? 'Saving...' : 'Save Tenant Override'}
          </button>
        </div>
      </div>
    </div>
  );
}
