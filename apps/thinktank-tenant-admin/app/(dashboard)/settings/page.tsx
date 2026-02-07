'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  Settings, RefreshCw, Save, Globe, Bell, Palette, Clock,
  Check, AlertTriangle, Sparkles,
} from 'lucide-react';

interface TenantSettings {
  organizationName: string;
  timezone: string;
  defaultLanguage: string;
  notificationsEnabled: boolean;
  emailDigest: string;
  theme: string;
  maxConversationLength: number;
  retentionDays: number;
  allowFileUploads: boolean;
  maxUploadSizeMb: number;
  delightEnabled: boolean;
  delightDefaultMode: string;
  delightAllowUserOverride: boolean;
}

const API = '/api/tenant-admin/settings';

async function fetchApi(path: string, options?: RequestInit) {
  const res = await fetch(`${API}${path}`, { headers: { 'Content-Type': 'application/json' }, ...options });
  if (!res.ok) throw new Error(`API error: ${res.status}`);
  return res.json();
}

export default function TenantSettingsPage() {
  const [settings, setSettings] = useState<TenantSettings>({
    organizationName: '',
    timezone: 'UTC',
    defaultLanguage: 'en',
    notificationsEnabled: true,
    emailDigest: 'weekly',
    theme: 'system',
    maxConversationLength: 100,
    retentionDays: 365,
    allowFileUploads: true,
    maxUploadSizeMb: 25,
    delightEnabled: true,
    delightDefaultMode: 'auto',
    delightAllowUserOverride: true,
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const load = useCallback(async () => {
    try {
      const data = await fetchApi('');
      if (data.settings) setSettings(data.settings);
      else if (data.organizationName) setSettings(data);
    } catch (err) {
      console.error('Failed to load settings', err);
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
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-3">
            <Settings className="h-7 w-7 text-violet-400" />
            Organization Settings
          </h1>
          <p className="text-sm text-slate-400 mt-1">Configure preferences for your organization</p>
        </div>
        <button onClick={saveSettings} disabled={saving}
          className="px-4 py-2 bg-violet-600 hover:bg-violet-500 disabled:opacity-50 text-white text-sm rounded-lg flex items-center gap-2">
          {saved ? <><Check className="h-4 w-4" /> Saved</> : saving ? <><RefreshCw className="h-4 w-4 animate-spin" /> Saving...</> : <><Save className="h-4 w-4" /> Save Changes</>}
        </button>
      </div>

      <div className="space-y-6">
        <div className="bg-slate-800/30 border border-slate-700/50 rounded-xl p-6 space-y-4">
          <h3 className="text-sm font-semibold text-white flex items-center gap-2"><Globe className="h-4 w-4 text-blue-400" /> General</h3>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs text-slate-400">Organization Name</label>
              <input type="text" value={settings.organizationName} onChange={e => setSettings({ ...settings, organizationName: e.target.value })}
                className="w-full mt-1 bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-white text-sm" />
            </div>
            <div>
              <label className="text-xs text-slate-400">Timezone</label>
              <select value={settings.timezone} onChange={e => setSettings({ ...settings, timezone: e.target.value })}
                className="w-full mt-1 bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-white text-sm">
                <option value="UTC">UTC</option>
                <option value="America/New_York">Eastern</option>
                <option value="America/Chicago">Central</option>
                <option value="America/Denver">Mountain</option>
                <option value="America/Los_Angeles">Pacific</option>
                <option value="Europe/London">London</option>
                <option value="Europe/Berlin">Berlin</option>
                <option value="Asia/Tokyo">Tokyo</option>
              </select>
            </div>
            <div>
              <label className="text-xs text-slate-400">Default Language</label>
              <select value={settings.defaultLanguage} onChange={e => setSettings({ ...settings, defaultLanguage: e.target.value })}
                className="w-full mt-1 bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-white text-sm">
                <option value="en">English</option>
                <option value="es">Spanish</option>
                <option value="fr">French</option>
                <option value="de">German</option>
                <option value="ja">Japanese</option>
                <option value="zh">Chinese</option>
              </select>
            </div>
            <div>
              <label className="text-xs text-slate-400">Theme</label>
              <select value={settings.theme} onChange={e => setSettings({ ...settings, theme: e.target.value })}
                className="w-full mt-1 bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-white text-sm">
                <option value="system">System Default</option>
                <option value="dark">Dark</option>
                <option value="light">Light</option>
              </select>
            </div>
          </div>
        </div>

        <div className="bg-slate-800/30 border border-slate-700/50 rounded-xl p-6 space-y-4">
          <h3 className="text-sm font-semibold text-white flex items-center gap-2"><Bell className="h-4 w-4 text-yellow-400" /> Notifications</h3>
          <div className="grid grid-cols-2 gap-4">
            <div className="flex items-center justify-between col-span-2">
              <div>
                <p className="text-sm text-white">Enable Notifications</p>
                <p className="text-xs text-slate-500">Receive email notifications for important events</p>
              </div>
              <button onClick={() => setSettings({ ...settings, notificationsEnabled: !settings.notificationsEnabled })}
                className={`w-12 h-6 rounded-full transition-colors ${settings.notificationsEnabled ? 'bg-violet-600' : 'bg-slate-600'}`}>
                <div className={`w-5 h-5 rounded-full bg-white transition-transform ${settings.notificationsEnabled ? 'translate-x-6' : 'translate-x-0.5'}`} />
              </button>
            </div>
            <div>
              <label className="text-xs text-slate-400">Email Digest Frequency</label>
              <select value={settings.emailDigest} onChange={e => setSettings({ ...settings, emailDigest: e.target.value })}
                className="w-full mt-1 bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-white text-sm">
                <option value="daily">Daily</option>
                <option value="weekly">Weekly</option>
                <option value="monthly">Monthly</option>
                <option value="never">Never</option>
              </select>
            </div>
          </div>
        </div>

        <div className="bg-slate-800/30 border border-slate-700/50 rounded-xl p-6 space-y-4">
          <h3 className="text-sm font-semibold text-white flex items-center gap-2"><Clock className="h-4 w-4 text-emerald-400" /> Data & Limits</h3>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs text-slate-400">Max Conversation Length (messages)</label>
              <input type="number" value={settings.maxConversationLength} onChange={e => setSettings({ ...settings, maxConversationLength: parseInt(e.target.value) || 100 })}
                className="w-full mt-1 bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-white text-sm" />
            </div>
            <div>
              <label className="text-xs text-slate-400">Data Retention (days)</label>
              <input type="number" value={settings.retentionDays} onChange={e => setSettings({ ...settings, retentionDays: parseInt(e.target.value) || 365 })}
                className="w-full mt-1 bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-white text-sm" />
            </div>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-white">Allow File Uploads</p>
                <p className="text-xs text-slate-500">Let users upload files in conversations</p>
              </div>
              <button onClick={() => setSettings({ ...settings, allowFileUploads: !settings.allowFileUploads })}
                className={`w-12 h-6 rounded-full transition-colors ${settings.allowFileUploads ? 'bg-violet-600' : 'bg-slate-600'}`}>
                <div className={`w-5 h-5 rounded-full bg-white transition-transform ${settings.allowFileUploads ? 'translate-x-6' : 'translate-x-0.5'}`} />
              </button>
            </div>
            {settings.allowFileUploads && (
              <div>
                <label className="text-xs text-slate-400">Max Upload Size (MB)</label>
                <input type="number" value={settings.maxUploadSizeMb} onChange={e => setSettings({ ...settings, maxUploadSizeMb: parseInt(e.target.value) || 25 })}
                  className="w-full mt-1 bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-white text-sm" />
              </div>
            )}
          </div>
        </div>
        <div className="bg-slate-800/30 border border-slate-700/50 rounded-xl p-6 space-y-4">
          <h3 className="text-sm font-semibold text-white flex items-center gap-2"><Sparkles className="h-4 w-4 text-yellow-400" /> Delight UX System</h3>
          <p className="text-xs text-slate-500">Control personality-aware micro-interactions, sounds, and animations for your organization</p>
          <div className="grid grid-cols-2 gap-4">
            <div className="flex items-center justify-between col-span-2">
              <div>
                <p className="text-sm text-white">Enable Delight System</p>
                <p className="text-xs text-slate-500">Master toggle — when off, all personality messages, sounds, and animations are suppressed org-wide</p>
              </div>
              <button onClick={() => setSettings({ ...settings, delightEnabled: !settings.delightEnabled })}
                className={`w-12 h-6 rounded-full transition-colors ${settings.delightEnabled ? 'bg-violet-600' : 'bg-slate-600'}`}>
                <div className={`w-5 h-5 rounded-full bg-white transition-transform ${settings.delightEnabled ? 'translate-x-6' : 'translate-x-0.5'}`} />
              </button>
            </div>
            {settings.delightEnabled && (
              <>
                <div>
                  <label className="text-xs text-slate-400">Default Personality Mode</label>
                  <select value={settings.delightDefaultMode} onChange={e => setSettings({ ...settings, delightDefaultMode: e.target.value })}
                    className="w-full mt-1 bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-white text-sm">
                    <option value="auto">Auto (adapts to context)</option>
                    <option value="professional">Professional (minimal, enterprise-grade)</option>
                    <option value="subtle">Subtle (light touches only)</option>
                    <option value="expressive">Expressive (moderate personality)</option>
                    <option value="playful">Playful (full personality, sounds, animations)</option>
                  </select>
                  <p className="text-[10px] text-slate-600 mt-1">Professional is recommended for legal, medical, and regulated industries</p>
                </div>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-white">Allow User Override</p>
                    <p className="text-xs text-slate-500">When off, all users are locked to the default mode above</p>
                  </div>
                  <button onClick={() => setSettings({ ...settings, delightAllowUserOverride: !settings.delightAllowUserOverride })}
                    className={`w-12 h-6 rounded-full transition-colors ${settings.delightAllowUserOverride ? 'bg-violet-600' : 'bg-slate-600'}`}>
                    <div className={`w-5 h-5 rounded-full bg-white transition-transform ${settings.delightAllowUserOverride ? 'translate-x-6' : 'translate-x-0.5'}`} />
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
