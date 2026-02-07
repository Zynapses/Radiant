'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  Shield, RefreshCw, Save, Lock, Key, Fingerprint,
  Clock, Check, AlertTriangle, Users,
} from 'lucide-react';

interface SecurityConfig {
  mfaRequired: boolean;
  mfaMethod: string;
  sessionTimeoutMinutes: number;
  maxLoginAttempts: number;
  lockoutDurationMinutes: number;
  passwordMinLength: number;
  passwordRequireUppercase: boolean;
  passwordRequireNumber: boolean;
  passwordRequireSpecial: boolean;
  ipWhitelistEnabled: boolean;
  ipWhitelist: string[];
  ssoEnabled: boolean;
  ssoProvider: string;
}

interface SecurityEvent {
  id: string;
  type: string;
  userId: string;
  userEmail: string;
  ipAddress: string;
  success: boolean;
  timestamp: string;
  details: string;
}

const API = '/api/tenant-admin/security';

async function fetchApi(path: string, options?: RequestInit) {
  const res = await fetch(`${API}${path}`, { headers: { 'Content-Type': 'application/json' }, ...options });
  if (!res.ok) throw new Error(`API error: ${res.status}`);
  return res.json();
}

export default function TenantSecurityPage() {
  const [config, setConfig] = useState<SecurityConfig>({
    mfaRequired: false,
    mfaMethod: 'totp',
    sessionTimeoutMinutes: 60,
    maxLoginAttempts: 5,
    lockoutDurationMinutes: 30,
    passwordMinLength: 8,
    passwordRequireUppercase: true,
    passwordRequireNumber: true,
    passwordRequireSpecial: false,
    ipWhitelistEnabled: false,
    ipWhitelist: [],
    ssoEnabled: false,
    ssoProvider: '',
  });
  const [events, setEvents] = useState<SecurityEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [activeTab, setActiveTab] = useState<'config' | 'events'>('config');

  const load = useCallback(async () => {
    try {
      const [configData, eventsData] = await Promise.all([
        fetchApi('/config').catch(() => ({})),
        fetchApi('/events').catch(() => ({ events: [] })),
      ]);
      if (configData.mfaRequired !== undefined) setConfig(configData);
      else if (configData.config) setConfig(configData.config);
      setEvents(eventsData.events || eventsData || []);
    } catch (err) {
      console.error('Failed to load', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const saveConfig = async () => {
    setSaving(true);
    setSaved(false);
    try {
      await fetchApi('/config', { method: 'PUT', body: JSON.stringify(config) });
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

  const failedLogins = events.filter(e => e.type === 'login' && !e.success).length;

  return (
    <div className="space-y-6 p-6 max-w-6xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-3">
            <Shield className="h-7 w-7 text-emerald-400" />
            Security
          </h1>
          <p className="text-sm text-slate-400 mt-1">Authentication, access control, and security event monitoring</p>
        </div>
        <div className="flex gap-2">
          {activeTab === 'config' && (
            <button onClick={saveConfig} disabled={saving}
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-sm rounded-lg flex items-center gap-2">
              {saved ? <><Check className="h-4 w-4" /> Saved</> : saving ? <><RefreshCw className="h-4 w-4 animate-spin" /> Saving...</> : <><Save className="h-4 w-4" /> Save</>}
            </button>
          )}
          <button onClick={load} className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white text-sm rounded-lg flex items-center gap-2">
            <RefreshCw className="h-4 w-4" /> Refresh
          </button>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-2"><Lock className="h-4 w-4 text-emerald-400" /><span className="text-xs text-slate-400">MFA Status</span></div>
          <div className="text-2xl font-bold text-white">{config.mfaRequired ? 'Required' : 'Optional'}</div>
        </div>
        <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-2"><Clock className="h-4 w-4 text-blue-400" /><span className="text-xs text-slate-400">Session Timeout</span></div>
          <div className="text-2xl font-bold text-white">{config.sessionTimeoutMinutes}m</div>
        </div>
        <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-2"><AlertTriangle className="h-4 w-4 text-red-400" /><span className="text-xs text-slate-400">Failed Logins (Recent)</span></div>
          <div className="text-2xl font-bold text-white">{failedLogins}</div>
        </div>
      </div>

      <div className="flex gap-1 bg-slate-800/50 rounded-lg p-1">
        {(['config', 'events'] as const).map(tab => (
          <button key={tab} onClick={() => setActiveTab(tab)}
            className={`flex-1 px-4 py-2 text-sm rounded-md transition-colors ${activeTab === tab ? 'bg-slate-700 text-white' : 'text-slate-400 hover:text-white'}`}>
            {tab === 'config' ? 'Security Settings' : 'Security Events'}
          </button>
        ))}
      </div>

      {activeTab === 'config' && (
        <div className="space-y-6">
          <div className="bg-slate-800/30 border border-slate-700/50 rounded-xl p-6 space-y-4">
            <h3 className="text-sm font-semibold text-white flex items-center gap-2"><Fingerprint className="h-4 w-4 text-violet-400" /> Multi-Factor Authentication</h3>
            <div className="grid grid-cols-2 gap-4">
              <div className="flex items-center justify-between col-span-2">
                <div>
                  <p className="text-sm text-white">Require MFA for All Users</p>
                  <p className="text-xs text-slate-500">Force all users to set up MFA on next login</p>
                </div>
                <button onClick={() => setConfig({ ...config, mfaRequired: !config.mfaRequired })}
                  className={`w-12 h-6 rounded-full transition-colors ${config.mfaRequired ? 'bg-emerald-600' : 'bg-slate-600'}`}>
                  <div className={`w-5 h-5 rounded-full bg-white transition-transform ${config.mfaRequired ? 'translate-x-6' : 'translate-x-0.5'}`} />
                </button>
              </div>
              <div>
                <label className="text-xs text-slate-400">MFA Method</label>
                <select value={config.mfaMethod} onChange={e => setConfig({ ...config, mfaMethod: e.target.value })}
                  className="w-full mt-1 bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-white text-sm">
                  <option value="totp">TOTP (Authenticator App)</option>
                  <option value="sms">SMS</option>
                  <option value="email">Email</option>
                </select>
              </div>
            </div>
          </div>

          <div className="bg-slate-800/30 border border-slate-700/50 rounded-xl p-6 space-y-4">
            <h3 className="text-sm font-semibold text-white flex items-center gap-2"><Clock className="h-4 w-4 text-blue-400" /> Session & Lockout</h3>
            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="text-xs text-slate-400">Session Timeout (minutes)</label>
                <input type="number" value={config.sessionTimeoutMinutes} onChange={e => setConfig({ ...config, sessionTimeoutMinutes: parseInt(e.target.value) || 60 })}
                  className="w-full mt-1 bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-white text-sm" />
              </div>
              <div>
                <label className="text-xs text-slate-400">Max Login Attempts</label>
                <input type="number" value={config.maxLoginAttempts} onChange={e => setConfig({ ...config, maxLoginAttempts: parseInt(e.target.value) || 5 })}
                  className="w-full mt-1 bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-white text-sm" />
              </div>
              <div>
                <label className="text-xs text-slate-400">Lockout Duration (minutes)</label>
                <input type="number" value={config.lockoutDurationMinutes} onChange={e => setConfig({ ...config, lockoutDurationMinutes: parseInt(e.target.value) || 30 })}
                  className="w-full mt-1 bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-white text-sm" />
              </div>
            </div>
          </div>

          <div className="bg-slate-800/30 border border-slate-700/50 rounded-xl p-6 space-y-4">
            <h3 className="text-sm font-semibold text-white flex items-center gap-2"><Key className="h-4 w-4 text-yellow-400" /> Password Policy</h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-xs text-slate-400">Minimum Length</label>
                <input type="number" value={config.passwordMinLength} onChange={e => setConfig({ ...config, passwordMinLength: parseInt(e.target.value) || 8 })}
                  className="w-full mt-1 bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-white text-sm" />
              </div>
              <div className="space-y-2 pt-5">
                {[
                  { key: 'passwordRequireUppercase' as const, label: 'Require uppercase letter' },
                  { key: 'passwordRequireNumber' as const, label: 'Require number' },
                  { key: 'passwordRequireSpecial' as const, label: 'Require special character' },
                ].map(rule => (
                  <label key={rule.key} className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" checked={config[rule.key]} onChange={() => setConfig({ ...config, [rule.key]: !config[rule.key] })}
                      className="rounded border-slate-600 bg-slate-800 text-violet-600" />
                    <span className="text-sm text-slate-300">{rule.label}</span>
                  </label>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'events' && (
        <div className="bg-slate-800/30 border border-slate-700/50 rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-slate-800/50">
              <tr>
                <th className="text-left p-3 text-slate-400 font-medium">Event</th>
                <th className="text-left p-3 text-slate-400 font-medium">User</th>
                <th className="text-left p-3 text-slate-400 font-medium">IP Address</th>
                <th className="text-center p-3 text-slate-400 font-medium">Result</th>
                <th className="text-left p-3 text-slate-400 font-medium">Time</th>
                <th className="text-left p-3 text-slate-400 font-medium">Details</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-700/50">
              {events.length === 0 ? (
                <tr><td colSpan={6} className="p-6 text-center text-slate-500">No security events recorded</td></tr>
              ) : events.map(event => (
                <tr key={event.id} className="hover:bg-slate-800/30">
                  <td className="p-3">
                    <span className={`text-xs px-2 py-0.5 rounded ${event.type === 'login' ? 'bg-blue-900/50 text-blue-300' : event.type === 'mfa' ? 'bg-purple-900/50 text-purple-300' : 'bg-slate-700 text-slate-300'}`}>
                      {event.type}
                    </span>
                  </td>
                  <td className="p-3 text-slate-300 text-xs">{event.userEmail}</td>
                  <td className="p-3 text-slate-400 font-mono text-xs">{event.ipAddress}</td>
                  <td className="p-3 text-center">
                    {event.success
                      ? <Check className="h-4 w-4 text-emerald-400 mx-auto" />
                      : <AlertTriangle className="h-4 w-4 text-red-400 mx-auto" />}
                  </td>
                  <td className="p-3 text-slate-400 text-xs">{new Date(event.timestamp).toLocaleString()}</td>
                  <td className="p-3 text-slate-500 text-xs truncate max-w-[200px]">{event.details}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
