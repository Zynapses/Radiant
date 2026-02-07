'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  Database, RefreshCw, Download, Upload, GitCompare, Check,
  AlertTriangle, Clock, Server, Shield, BarChart3, Archive,
  ChevronDown, ChevronUp,
} from 'lucide-react';

interface StateManifest {
  id: string;
  name: string;
  environment: string;
  version: string;
  checksum: string;
  resourceCount: number;
  status: string;
  capturedAt: string;
  capturedBy: string;
}

interface SyncOperation {
  id: string;
  sourceEnv: string;
  targetEnv: string;
  status: string;
  resourcesSynced: number;
  resourcesSkipped: number;
  resourcesFailed: number;
  startedAt: string;
  completedAt: string | null;
}

interface Backup {
  id: string;
  environment: string;
  type: string;
  status: string;
  sizeBytes: number;
  createdAt: string;
  expiresAt: string | null;
}

const API = '/api/admin/state-registry';

async function fetchApi(path: string, options?: RequestInit) {
  const res = await fetch(`${API}${path}`, { headers: { 'Content-Type': 'application/json' }, ...options });
  if (!res.ok) throw new Error(`API error: ${res.status}`);
  return res.json();
}

function StatCard({ icon: Icon, label, value, color }: { icon: React.ElementType; label: string; value: string | number; color: string }) {
  return (
    <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-4">
      <div className="flex items-center gap-2 mb-2">
        <Icon className={`h-4 w-4 ${color}`} />
        <span className="text-xs text-slate-400">{label}</span>
      </div>
      <div className="text-2xl font-bold text-white">{value}</div>
    </div>
  );
}

export default function StateRegistryPage() {
  const [manifests, setManifests] = useState<StateManifest[]>([]);
  const [syncs, setSyncs] = useState<SyncOperation[]>([]);
  const [backups, setBackups] = useState<Backup[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'manifests' | 'syncs' | 'backups'>('manifests');

  const load = useCallback(async () => {
    try {
      const [mData, sData, bData] = await Promise.all([
        fetchApi('/manifests').catch(() => ({ manifests: [] })),
        fetchApi('/syncs').catch(() => ({ operations: [] })),
        fetchApi('/backups').catch(() => ({ backups: [] })),
      ]);
      setManifests(mData.manifests || mData || []);
      setSyncs(sData.operations || sData || []);
      setBackups(bData.backups || bData || []);
    } catch (err) {
      console.error('Failed to load', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const captureManifest = async (environment: string) => {
    try {
      await fetchApi('/manifests/capture', { method: 'POST', body: JSON.stringify({ environment }) });
      alert('Manifest captured');
      await load();
    } catch (err) {
      alert(`Failed: ${err instanceof Error ? err.message : 'Unknown'}`);
    }
  };

  const createBackup = async (environment: string) => {
    try {
      await fetchApi('/backups', { method: 'POST', body: JSON.stringify({ environment }) });
      alert('Backup started');
      await load();
    } catch (err) {
      alert(`Failed: ${err instanceof Error ? err.message : 'Unknown'}`);
    }
  };

  if (loading) {
    return <div className="flex items-center justify-center h-64"><RefreshCw className="h-8 w-8 animate-spin text-teal-400" /></div>;
  }

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-3">
            <Database className="h-7 w-7 text-teal-400" />
            Environment State Registry
          </h1>
          <p className="text-sm text-slate-400 mt-1">Track, compare, sync, and backup environment state manifests</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => captureManifest('production')} className="px-4 py-2 bg-teal-600 hover:bg-teal-500 text-white text-sm rounded-lg flex items-center gap-2">
            <Download className="h-4 w-4" /> Capture Manifest
          </button>
          <button onClick={() => createBackup('production')} className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-sm rounded-lg flex items-center gap-2">
            <Archive className="h-4 w-4" /> Create Backup
          </button>
        </div>
      </div>

      <div className="grid grid-cols-4 gap-4">
        <StatCard icon={Database} label="Manifests" value={manifests.length} color="text-teal-400" />
        <StatCard icon={GitCompare} label="Sync Operations" value={syncs.length} color="text-blue-400" />
        <StatCard icon={Archive} label="Backups" value={backups.length} color="text-purple-400" />
        <StatCard icon={Server} label="Total Resources" value={manifests.reduce((s, m) => s + (m.resourceCount || 0), 0)} color="text-orange-400" />
      </div>

      <div className="flex gap-1 bg-slate-800/50 rounded-lg p-1">
        {(['manifests', 'syncs', 'backups'] as const).map(tab => (
          <button key={tab} onClick={() => setActiveTab(tab)}
            className={`flex-1 px-4 py-2 text-sm rounded-md transition-colors capitalize ${activeTab === tab ? 'bg-slate-700 text-white' : 'text-slate-400 hover:text-white'}`}>
            {tab === 'manifests' ? 'State Manifests' : tab === 'syncs' ? 'Sync Operations' : 'Backups'}
          </button>
        ))}
      </div>

      {activeTab === 'manifests' && (
        <div className="bg-slate-800/30 border border-slate-700/50 rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-slate-800/50">
              <tr>
                <th className="text-left p-3 text-slate-400 font-medium">Name</th>
                <th className="text-left p-3 text-slate-400 font-medium">Environment</th>
                <th className="text-left p-3 text-slate-400 font-medium">Version</th>
                <th className="text-center p-3 text-slate-400 font-medium">Resources</th>
                <th className="text-center p-3 text-slate-400 font-medium">Status</th>
                <th className="text-left p-3 text-slate-400 font-medium">Captured</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-700/50">
              {manifests.length === 0 ? (
                <tr><td colSpan={6} className="p-6 text-center text-slate-500">No manifests captured yet</td></tr>
              ) : manifests.map(m => (
                <tr key={m.id} className="hover:bg-slate-800/30">
                  <td className="p-3 text-white">{m.name}</td>
                  <td className="p-3"><span className="text-xs bg-slate-700 text-slate-300 px-2 py-0.5 rounded">{m.environment}</span></td>
                  <td className="p-3 text-slate-300 font-mono text-xs">{m.version}</td>
                  <td className="p-3 text-center text-slate-300">{m.resourceCount}</td>
                  <td className="p-3 text-center">
                    <span className={`text-xs px-2 py-0.5 rounded-full ${m.status === 'current' ? 'bg-emerald-900/50 text-emerald-300' : 'bg-slate-700 text-slate-300'}`}>{m.status}</span>
                  </td>
                  <td className="p-3 text-slate-400 text-xs">{new Date(m.capturedAt).toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {activeTab === 'syncs' && (
        <div className="bg-slate-800/30 border border-slate-700/50 rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-slate-800/50">
              <tr>
                <th className="text-left p-3 text-slate-400 font-medium">Source → Target</th>
                <th className="text-center p-3 text-slate-400 font-medium">Status</th>
                <th className="text-right p-3 text-slate-400 font-medium">Synced</th>
                <th className="text-right p-3 text-slate-400 font-medium">Skipped</th>
                <th className="text-right p-3 text-slate-400 font-medium">Failed</th>
                <th className="text-left p-3 text-slate-400 font-medium">Started</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-700/50">
              {syncs.length === 0 ? (
                <tr><td colSpan={6} className="p-6 text-center text-slate-500">No sync operations</td></tr>
              ) : syncs.map(s => (
                <tr key={s.id} className="hover:bg-slate-800/30">
                  <td className="p-3 text-white">{s.sourceEnv} → {s.targetEnv}</td>
                  <td className="p-3 text-center">
                    <span className={`text-xs px-2 py-0.5 rounded-full ${s.status === 'completed' ? 'bg-emerald-900/50 text-emerald-300' : s.status === 'failed' ? 'bg-red-900/50 text-red-300' : 'bg-yellow-900/50 text-yellow-300'}`}>{s.status}</span>
                  </td>
                  <td className="p-3 text-right text-emerald-400">{s.resourcesSynced}</td>
                  <td className="p-3 text-right text-slate-400">{s.resourcesSkipped}</td>
                  <td className="p-3 text-right text-red-400">{s.resourcesFailed}</td>
                  <td className="p-3 text-slate-400 text-xs">{new Date(s.startedAt).toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {activeTab === 'backups' && (
        <div className="bg-slate-800/30 border border-slate-700/50 rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-slate-800/50">
              <tr>
                <th className="text-left p-3 text-slate-400 font-medium">Environment</th>
                <th className="text-left p-3 text-slate-400 font-medium">Type</th>
                <th className="text-center p-3 text-slate-400 font-medium">Status</th>
                <th className="text-right p-3 text-slate-400 font-medium">Size</th>
                <th className="text-left p-3 text-slate-400 font-medium">Created</th>
                <th className="text-left p-3 text-slate-400 font-medium">Expires</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-700/50">
              {backups.length === 0 ? (
                <tr><td colSpan={6} className="p-6 text-center text-slate-500">No backups</td></tr>
              ) : backups.map(b => (
                <tr key={b.id} className="hover:bg-slate-800/30">
                  <td className="p-3"><span className="text-xs bg-slate-700 text-slate-300 px-2 py-0.5 rounded">{b.environment}</span></td>
                  <td className="p-3 text-slate-300">{b.type}</td>
                  <td className="p-3 text-center">
                    <span className={`text-xs px-2 py-0.5 rounded-full ${b.status === 'completed' ? 'bg-emerald-900/50 text-emerald-300' : 'bg-yellow-900/50 text-yellow-300'}`}>{b.status}</span>
                  </td>
                  <td className="p-3 text-right text-slate-300 font-mono text-xs">{(b.sizeBytes / 1024 / 1024).toFixed(1)} MB</td>
                  <td className="p-3 text-slate-400 text-xs">{new Date(b.createdAt).toLocaleString()}</td>
                  <td className="p-3 text-slate-400 text-xs">{b.expiresAt ? new Date(b.expiresAt).toLocaleDateString() : 'Never'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
