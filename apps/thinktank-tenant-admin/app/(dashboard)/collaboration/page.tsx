'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  Users2, RefreshCw, Save, Check, ShieldAlert, ShieldCheck, ShieldX,
  MessageSquare, Upload, Download, GitBranch, DollarSign, Clock,
  AlertTriangle, Info, Lock, Unlock, Percent, UserPlus,
} from 'lucide-react';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface CollaborationSettings {
  guestAccessEnabled: boolean;
  guestPromptExecutionEnabled: boolean;
  guestFileUploadEnabled: boolean;
  guestFileDownloadEnabled: boolean;
  complianceAutoRestrict: boolean;
  guestCostAttribution: 'inviting_user' | 'session_owner' | 'tenant_pool';
  crossTenantGuestEnabled: boolean;
  crossTenantCostSplitEnabled: boolean;
  crossTenantCostSplitPercent: number;
  guestMaxPromptsPerSession: number | null;
  guestMaxTokensPerSession: number | null;
  guestSessionTimeoutMinutes: number | null;
  notifyGuestOnRestriction: boolean;
  restrictionMessage: string;
}

interface ComplianceLicense {
  key: string;
  name: string;
  active: boolean;
}

const DEFAULT_SETTINGS: CollaborationSettings = {
  guestAccessEnabled: true,
  guestPromptExecutionEnabled: false,
  guestFileUploadEnabled: false,
  guestFileDownloadEnabled: true,
  complianceAutoRestrict: true,
  guestCostAttribution: 'inviting_user',
  crossTenantGuestEnabled: true,
  crossTenantCostSplitEnabled: false,
  crossTenantCostSplitPercent: 50,
  guestMaxPromptsPerSession: 20,
  guestMaxTokensPerSession: 50000,
  guestSessionTimeoutMinutes: 120,
  notifyGuestOnRestriction: true,
  restrictionMessage: 'Some features are restricted by your organization\'s compliance policies.',
};

const COMPLIANCE_LICENSES: ComplianceLicense[] = [
  { key: 'hipaa', name: 'HIPAA', active: false },
  { key: 'hipaa_retention', name: 'HIPAA Retention', active: false },
  { key: 'gdpr', name: 'GDPR', active: false },
  { key: 'soc2', name: 'SOC 2', active: false },
  { key: 'ccpa', name: 'CCPA', active: false },
  { key: 'iso27001', name: 'ISO 27001', active: false },
  { key: 'pci_dss', name: 'PCI DSS', active: false },
  { key: 'fedramp', name: 'FedRAMP', active: false },
  { key: 'hitrust', name: 'HITRUST', active: false },
  { key: 'eu_ai_act', name: 'EU AI Act', active: false },
];

const API = '/api/tenant-admin/collaboration';

async function fetchApi(path: string, options?: RequestInit) {
  const res = await fetch(`${API}${path}`, { headers: { 'Content-Type': 'application/json' }, ...options });
  if (!res.ok) throw new Error(`API error: ${res.status}`);
  return res.json();
}

// ---------------------------------------------------------------------------
// Components
// ---------------------------------------------------------------------------

function Toggle({ enabled, onChange, disabled }: { enabled: boolean; onChange: (v: boolean) => void; disabled?: boolean }) {
  return (
    <button
      onClick={() => !disabled && onChange(!enabled)}
      disabled={disabled}
      className={`w-12 h-6 rounded-full transition-colors flex-shrink-0 ${
        disabled ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer'
      } ${enabled ? 'bg-violet-600' : 'bg-slate-600'}`}
    >
      <div className={`w-5 h-5 rounded-full bg-white transition-transform ${enabled ? 'translate-x-6' : 'translate-x-0.5'}`} />
    </button>
  );
}

function ComplianceBlockedBanner({ licenses, feature }: { licenses: ComplianceLicense[]; feature: string }) {
  const active = licenses.filter(l => l.active);
  if (active.length === 0) return null;

  return (
    <div className="flex items-start gap-2 mt-1.5 px-2.5 py-2 rounded-lg bg-amber-500/10 border border-amber-500/20">
      <ShieldAlert className="h-4 w-4 text-amber-400 mt-0.5 flex-shrink-0" />
      <div className="text-[11px] text-amber-300/90 leading-relaxed">
        <span className="font-semibold">Cannot enable {feature}</span> — your organization has active compliance
        {active.length === 1 ? ' license' : ' licenses'}: {active.map(l => l.name).join(', ')}.
        {' '}When <span className="font-medium">Compliance Auto-Restrict</span> is on, this feature is
        force-disabled for all guests to protect regulated data. To override, disable Compliance Auto-Restrict
        below (requires compliance officer approval).
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function CollaborationSettingsPage() {
  const [settings, setSettings] = useState<CollaborationSettings>(DEFAULT_SETTINGS);
  const [licenses, setLicenses] = useState<ComplianceLicense[]>(COMPLIANCE_LICENSES);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const activeComplianceLicenses = licenses.filter(l => l.active);
  const hasCompliance = activeComplianceLicenses.length > 0;
  const complianceBlocks = hasCompliance && settings.complianceAutoRestrict;

  const load = useCallback(async () => {
    try {
      const data = await fetchApi('');
      if (data.settings) setSettings({ ...DEFAULT_SETTINGS, ...data.settings });
      if (data.complianceLicenses) setLicenses(data.complianceLicenses);
    } catch (err) {
      console.error('Failed to load collaboration settings', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const saveSettings = async () => {
    setSaving(true);
    setSaved(false);
    try {
      await fetchApi('', { method: 'PUT', body: JSON.stringify(settings) });
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (err) {
      alert(`Failed: ${err instanceof Error ? err.message : 'Unknown'}`);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div className="flex items-center justify-center h-64"><RefreshCw className="h-8 w-8 animate-spin text-violet-400" /></div>;
  }

  return (
    <div className="space-y-6 p-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-3">
            <Users2 className="h-7 w-7 text-violet-400" />
            Guest Collaboration Policy
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Control what external guests can do in collaborative sessions
          </p>
        </div>
        <button onClick={saveSettings} disabled={saving}
          className="px-4 py-2 bg-violet-600 hover:bg-violet-500 disabled:opacity-50 text-white text-sm rounded-lg flex items-center gap-2">
          {saved ? <><Check className="h-4 w-4" /> Saved</> : saving ? <><RefreshCw className="h-4 w-4 animate-spin" /> Saving...</> : <><Save className="h-4 w-4" /> Save Changes</>}
        </button>
      </div>

      {/* Active compliance licenses banner */}
      {hasCompliance && (
        <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-4">
          <div className="flex items-start gap-3">
            <ShieldCheck className="h-5 w-5 text-amber-400 mt-0.5" />
            <div>
              <p className="text-sm font-semibold text-amber-200">Compliance Licenses Active</p>
              <p className="text-xs text-amber-300/80 mt-0.5">
                Your organization has {activeComplianceLicenses.length} active compliance
                {activeComplianceLicenses.length === 1 ? ' license' : ' licenses'}:{' '}
                <span className="font-medium">{activeComplianceLicenses.map(l => l.name).join(', ')}</span>.
                Guest capabilities are automatically restricted to protect regulated data.
                Controls marked with <ShieldX className="inline h-3.5 w-3.5 text-amber-400" /> are
                force-disabled while Compliance Auto-Restrict is on.
              </p>
            </div>
          </div>
        </div>
      )}

      <div className="space-y-6">
        {/* ─── Guest Access ────────────────────────────────────────────── */}
        <div className="bg-slate-800/30 border border-slate-700/50 rounded-xl p-6 space-y-4">
          <h3 className="text-sm font-semibold text-white flex items-center gap-2">
            <UserPlus className="h-4 w-4 text-blue-400" /> Guest Access
          </h3>

          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-white">Enable Guest Collaboration</p>
              <p className="text-xs text-slate-500">Allow team members to invite external guests into collaborative sessions</p>
            </div>
            <Toggle enabled={settings.guestAccessEnabled} onChange={v => setSettings({ ...settings, guestAccessEnabled: v })} />
          </div>

          {settings.guestAccessEnabled && (
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-white">Allow Cross-Tenant Guests</p>
                <p className="text-xs text-slate-500">Guests who are users of another Think Tank tenant</p>
              </div>
              <Toggle enabled={settings.crossTenantGuestEnabled} onChange={v => setSettings({ ...settings, crossTenantGuestEnabled: v })} />
            </div>
          )}
        </div>

        {/* ─── Guest Capabilities ──────────────────────────────────────── */}
        {settings.guestAccessEnabled && (
          <div className="bg-slate-800/30 border border-slate-700/50 rounded-xl p-6 space-y-4">
            <h3 className="text-sm font-semibold text-white flex items-center gap-2">
              <MessageSquare className="h-4 w-4 text-emerald-400" /> Guest Capabilities
            </h3>
            <p className="text-xs text-slate-500">
              These controls apply to guests with <span className="font-medium text-slate-300">editor</span> permission.
              Viewers can only read; commenters can only add comments.
            </p>

            {/* Prompt Execution */}
            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  {complianceBlocks && <ShieldX className="h-4 w-4 text-amber-400" />}
                  <div>
                    <p className={`text-sm ${complianceBlocks ? 'text-slate-500' : 'text-white'}`}>
                      Allow Guest Prompt Execution
                    </p>
                    <p className="text-xs text-slate-500">
                      Guests with editor permission can run AI prompts. Costs are tracked against the inviting user.
                    </p>
                  </div>
                </div>
                <Toggle
                  enabled={settings.guestPromptExecutionEnabled && !complianceBlocks}
                  onChange={v => setSettings({ ...settings, guestPromptExecutionEnabled: v })}
                  disabled={complianceBlocks}
                />
              </div>
              {complianceBlocks && <ComplianceBlockedBanner licenses={licenses} feature="guest prompt execution" />}
            </div>

            {/* File Upload */}
            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  {complianceBlocks && <ShieldX className="h-4 w-4 text-amber-400" />}
                  <div>
                    <p className={`text-sm ${complianceBlocks ? 'text-slate-500' : 'text-white'}`}>
                      Allow Guest File Uploads
                    </p>
                    <p className="text-xs text-slate-500">Guests with editor permission can upload files into collaborative sessions</p>
                  </div>
                </div>
                <Toggle
                  enabled={settings.guestFileUploadEnabled && !complianceBlocks}
                  onChange={v => setSettings({ ...settings, guestFileUploadEnabled: v })}
                  disabled={complianceBlocks}
                />
              </div>
              {complianceBlocks && <ComplianceBlockedBanner licenses={licenses} feature="guest file uploads" />}
            </div>

            {/* File Download */}
            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  {complianceBlocks && <ShieldX className="h-4 w-4 text-amber-400" />}
                  <div>
                    <p className={`text-sm ${complianceBlocks ? 'text-slate-500' : 'text-white'}`}>
                      Allow Guest File Downloads
                    </p>
                    <p className="text-xs text-slate-500">Guests can download files and attachments from the session</p>
                  </div>
                </div>
                <Toggle
                  enabled={settings.guestFileDownloadEnabled && !complianceBlocks}
                  onChange={v => setSettings({ ...settings, guestFileDownloadEnabled: v })}
                  disabled={complianceBlocks}
                />
              </div>
              {complianceBlocks && <ComplianceBlockedBanner licenses={licenses} feature="guest file downloads" />}
            </div>
          </div>
        )}

        {/* ─── Session Limits ──────────────────────────────────────────── */}
        {settings.guestAccessEnabled && (
          <div className="bg-slate-800/30 border border-slate-700/50 rounded-xl p-6 space-y-4">
            <h3 className="text-sm font-semibold text-white flex items-center gap-2">
              <Clock className="h-4 w-4 text-orange-400" /> Guest Session Limits
            </h3>
            <p className="text-xs text-slate-500">
              Per-session caps for guest participants. When a limit is reached the guest is notified and the action is blocked.
            </p>
            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="text-xs text-slate-400">Max Prompts / Session</label>
                <input
                  type="number" min={1} max={1000}
                  value={settings.guestMaxPromptsPerSession ?? ''}
                  onChange={e => setSettings({ ...settings, guestMaxPromptsPerSession: e.target.value ? parseInt(e.target.value) : null })}
                  className="w-full mt-1 bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-white text-sm"
                  placeholder="No limit"
                />
              </div>
              <div>
                <label className="text-xs text-slate-400">Max Tokens / Session</label>
                <input
                  type="number" min={1000} step={1000}
                  value={settings.guestMaxTokensPerSession ?? ''}
                  onChange={e => setSettings({ ...settings, guestMaxTokensPerSession: e.target.value ? parseInt(e.target.value) : null })}
                  className="w-full mt-1 bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-white text-sm"
                  placeholder="No limit"
                />
              </div>
              <div>
                <label className="text-xs text-slate-400">Session Timeout (minutes)</label>
                <input
                  type="number" min={5} max={1440}
                  value={settings.guestSessionTimeoutMinutes ?? ''}
                  onChange={e => setSettings({ ...settings, guestSessionTimeoutMinutes: e.target.value ? parseInt(e.target.value) : null })}
                  className="w-full mt-1 bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-white text-sm"
                  placeholder="No limit"
                />
              </div>
            </div>
          </div>
        )}

        {/* ─── Cost Attribution ────────────────────────────────────────── */}
        {settings.guestAccessEnabled && (
          <div className="bg-slate-800/30 border border-slate-700/50 rounded-xl p-6 space-y-4">
            <h3 className="text-sm font-semibold text-white flex items-center gap-2">
              <DollarSign className="h-4 w-4 text-green-400" /> Cost Attribution
            </h3>
            <p className="text-xs text-slate-500">
              When a guest runs an AI prompt, who should the token cost be attributed to?
              Costs are always tracked per-user and aggregated to the tenant billing total.
            </p>

            <div>
              <label className="text-xs text-slate-400">Attribution Mode</label>
              <select
                value={settings.guestCostAttribution}
                onChange={e => setSettings({ ...settings, guestCostAttribution: e.target.value as CollaborationSettings['guestCostAttribution'] })}
                className="w-full mt-1 bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-white text-sm"
              >
                <option value="inviting_user">Inviting User — costs billed to whoever created the invite</option>
                <option value="session_owner">Session Owner — costs billed to the session creator</option>
                <option value="tenant_pool">Tenant Pool — costs go to shared organization pool</option>
              </select>
            </div>

            {settings.crossTenantGuestEnabled && (
              <div className="space-y-3 pt-2 border-t border-slate-700/50">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-white flex items-center gap-2">
                      <Percent className="h-3.5 w-3.5 text-slate-400" />
                      Cross-Tenant Cost Splitting
                    </p>
                    <p className="text-xs text-slate-500">
                      When a guest is a user from another tenant, split the cost between both organizations
                    </p>
                  </div>
                  <Toggle
                    enabled={settings.crossTenantCostSplitEnabled}
                    onChange={v => setSettings({ ...settings, crossTenantCostSplitEnabled: v })}
                  />
                </div>
                {settings.crossTenantCostSplitEnabled && (
                  <div>
                    <label className="text-xs text-slate-400">Your Organization Pays (%)</label>
                    <div className="flex items-center gap-3 mt-1">
                      <input
                        type="range" min={0} max={100} step={5}
                        value={settings.crossTenantCostSplitPercent}
                        onChange={e => setSettings({ ...settings, crossTenantCostSplitPercent: parseInt(e.target.value) })}
                        className="flex-1 accent-violet-500"
                      />
                      <span className="text-sm text-white font-mono w-12 text-right">{settings.crossTenantCostSplitPercent}%</span>
                    </div>
                    <p className="text-[10px] text-slate-600 mt-1">
                      Guest&apos;s tenant pays {100 - settings.crossTenantCostSplitPercent}%
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* ─── Compliance Controls ─────────────────────────────────────── */}
        <div className="bg-slate-800/30 border border-slate-700/50 rounded-xl p-6 space-y-4">
          <h3 className="text-sm font-semibold text-white flex items-center gap-2">
            <ShieldAlert className="h-4 w-4 text-amber-400" /> Compliance & Restrictions
          </h3>

          {!hasCompliance && (
            <div className="flex items-start gap-2 px-3 py-2.5 rounded-lg bg-slate-700/30 border border-slate-600/30">
              <Info className="h-4 w-4 text-slate-400 mt-0.5 flex-shrink-0" />
              <p className="text-xs text-slate-400">
                No compliance licenses are active for your organization. Guest features operate without
                regulatory restrictions. If your organization needs HIPAA, GDPR, SOC 2, or other compliance,
                contact Think Tank support at <span className="text-violet-400">support@thinktank.app</span>.
              </p>
            </div>
          )}

          {hasCompliance && (
            <>
              <div className="flex flex-wrap gap-2">
                {activeComplianceLicenses.map(l => (
                  <span key={l.key} className="px-2.5 py-1 rounded-full bg-amber-500/20 border border-amber-500/30 text-xs font-medium text-amber-300">
                    <ShieldCheck className="inline h-3 w-3 mr-1" />{l.name}
                  </span>
                ))}
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-white flex items-center gap-2">
                    {settings.complianceAutoRestrict ? <Lock className="h-4 w-4 text-amber-400" /> : <Unlock className="h-4 w-4 text-red-400" />}
                    Compliance Auto-Restrict
                  </p>
                  <p className="text-xs text-slate-500">
                    When enabled, automatically disables sensitive guest features (prompt execution, file transfers, branching)
                    to comply with {activeComplianceLicenses.map(l => l.name).join(', ')} requirements
                  </p>
                </div>
                <Toggle enabled={settings.complianceAutoRestrict} onChange={v => setSettings({ ...settings, complianceAutoRestrict: v })} />
              </div>

              {!settings.complianceAutoRestrict && (
                <div className="flex items-start gap-2 px-3 py-2.5 rounded-lg bg-red-500/10 border border-red-500/30">
                  <AlertTriangle className="h-4 w-4 text-red-400 mt-0.5 flex-shrink-0" />
                  <p className="text-xs text-red-300">
                    <span className="font-semibold">Warning:</span> Compliance Auto-Restrict is OFF.
                    Guest features are no longer automatically restricted by your compliance licenses.
                    This may violate {activeComplianceLicenses.map(l => l.name).join(', ')} requirements.
                    Ensure your compliance officer has approved this override.
                  </p>
                </div>
              )}
            </>
          )}

          <div className="flex items-center justify-between pt-2 border-t border-slate-700/50">
            <div>
              <p className="text-sm text-white">Notify Guests of Restrictions</p>
              <p className="text-xs text-slate-500">Show a banner to guests explaining which features are disabled and why</p>
            </div>
            <Toggle enabled={settings.notifyGuestOnRestriction} onChange={v => setSettings({ ...settings, notifyGuestOnRestriction: v })} />
          </div>

          {settings.notifyGuestOnRestriction && (
            <div>
              <label className="text-xs text-slate-400">Restriction Message</label>
              <textarea
                value={settings.restrictionMessage}
                onChange={e => setSettings({ ...settings, restrictionMessage: e.target.value })}
                rows={2}
                className="w-full mt-1 bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-white text-sm resize-none"
                placeholder="Message shown to guests when features are restricted..."
              />
            </div>
          )}
        </div>

        {/* ─── Capability Summary ──────────────────────────────────────── */}
        {settings.guestAccessEnabled && (
          <div className="bg-slate-800/30 border border-slate-700/50 rounded-xl p-6 space-y-3">
            <h3 className="text-sm font-semibold text-white">Effective Guest Capabilities</h3>
            <p className="text-xs text-slate-500">
              Summary of what guests can do right now based on the settings above.
            </p>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-slate-700/50">
                    <th className="text-left py-2 px-2 text-slate-400 font-medium">Permission</th>
                    <th className="text-center py-2 px-1 text-slate-400 font-medium">View</th>
                    <th className="text-center py-2 px-1 text-slate-400 font-medium">Comment</th>
                    <th className="text-center py-2 px-1 text-slate-400 font-medium">Edit</th>
                    <th className="text-center py-2 px-1 text-slate-400 font-medium">Prompts</th>
                    <th className="text-center py-2 px-1 text-slate-400 font-medium">Upload</th>
                    <th className="text-center py-2 px-1 text-slate-400 font-medium">Download</th>
                    <th className="text-center py-2 px-1 text-slate-400 font-medium">Branch</th>
                  </tr>
                </thead>
                <tbody>
                  {(['viewer', 'commenter', 'editor'] as const).map(perm => {
                    const canComment = perm === 'commenter' || perm === 'editor';
                    const canEdit = perm === 'editor';
                    const canPrompt = canEdit && settings.guestPromptExecutionEnabled && !complianceBlocks;
                    const canUpload = canEdit && settings.guestFileUploadEnabled && !complianceBlocks;
                    const canDownload = settings.guestFileDownloadEnabled && !complianceBlocks;
                    const canBranch = canEdit && !complianceBlocks;

                    const cell = (ok: boolean) => (
                      <td className="text-center py-1.5 px-1">
                        <span className={ok ? 'text-emerald-400' : 'text-slate-600'}>{ok ? '✓' : '✗'}</span>
                      </td>
                    );

                    return (
                      <tr key={perm} className="border-b border-slate-800/50">
                        <td className="py-1.5 px-2 text-slate-300 font-medium capitalize">{perm}</td>
                        {cell(true)}
                        {cell(canComment)}
                        {cell(canEdit)}
                        {cell(canPrompt)}
                        {cell(canUpload)}
                        {cell(canDownload)}
                        {cell(canBranch)}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
