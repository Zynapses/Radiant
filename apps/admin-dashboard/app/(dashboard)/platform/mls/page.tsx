'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  Lock, RefreshCw, Plus, Trash2, Users, Key, Shield,
  BarChart3, Clock, AlertTriangle, ChevronDown, ChevronUp, Check,
} from 'lucide-react';

interface MlsGroup {
  id: string;
  name: string;
  cipherSuite: string;
  memberCount: number;
  epochNumber: number;
  status: string;
  createdAt: string;
  lastUpdatedAt: string;
}

interface MlsKeyPackage {
  id: string;
  agentId: string;
  cipherSuite: string;
  isConsumed: boolean;
  createdAt: string;
  expiresAt: string;
}

interface MlsAuditEntry {
  id: string;
  groupId: string;
  action: string;
  agentId: string;
  epoch: number;
  timestamp: string;
}

const API = '/api/admin/mls';

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

export default function MlsPage() {
  const [groups, setGroups] = useState<MlsGroup[]>([]);
  const [keyPackages, setKeyPackages] = useState<MlsKeyPackage[]>([]);
  const [audit, setAudit] = useState<MlsAuditEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'groups' | 'keys' | 'audit'>('groups');
  const [expandedGroup, setExpandedGroup] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const [gData, kData, aData] = await Promise.all([
        fetchApi('/groups').catch(() => ({ groups: [] })),
        fetchApi('/key-packages').catch(() => ({ packages: [] })),
        fetchApi('/audit').catch(() => ({ entries: [] })),
      ]);
      setGroups(gData.groups || gData || []);
      setKeyPackages(kData.packages || kData || []);
      setAudit(aData.entries || aData || []);
    } catch (err) {
      console.error('Failed to load', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const rotateGroupKeys = async (groupId: string) => {
    try {
      await fetchApi(`/groups/${groupId}/rotate`, { method: 'POST' });
      alert('Key rotation initiated');
      await load();
    } catch (err) {
      alert(`Failed: ${err instanceof Error ? err.message : 'Unknown'}`);
    }
  };

  if (loading) {
    return <div className="flex items-center justify-center h-64"><RefreshCw className="h-8 w-8 animate-spin text-emerald-400" /></div>;
  }

  const activeGroups = groups.filter(g => g.status === 'active').length;
  const availableKeys = keyPackages.filter(k => !k.isConsumed).length;

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-3">
            <Lock className="h-7 w-7 text-emerald-400" />
            Message Layer Security (MLS)
          </h1>
          <p className="text-sm text-slate-400 mt-1">RFC 9420-inspired group encryption for agent-to-agent communication</p>
        </div>
        <button onClick={load} className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white text-sm rounded-lg flex items-center gap-2">
          <RefreshCw className="h-4 w-4" /> Refresh
        </button>
      </div>

      <div className="grid grid-cols-4 gap-4">
        <StatCard icon={Users} label="MLS Groups" value={groups.length} color="text-emerald-400" />
        <StatCard icon={Check} label="Active Groups" value={activeGroups} color="text-blue-400" />
        <StatCard icon={Key} label="Available Key Packages" value={availableKeys} color="text-yellow-400" />
        <StatCard icon={Shield} label="Audit Entries" value={audit.length} color="text-purple-400" />
      </div>

      <div className="flex gap-1 bg-slate-800/50 rounded-lg p-1">
        {(['groups', 'keys', 'audit'] as const).map(tab => (
          <button key={tab} onClick={() => setActiveTab(tab)}
            className={`flex-1 px-4 py-2 text-sm rounded-md transition-colors capitalize ${activeTab === tab ? 'bg-slate-700 text-white' : 'text-slate-400 hover:text-white'}`}>
            {tab === 'groups' ? 'Encryption Groups' : tab === 'keys' ? 'Key Packages' : 'Audit Log'}
          </button>
        ))}
      </div>

      {activeTab === 'groups' && (
        <div className="space-y-2">
          {groups.length === 0 ? (
            <div className="text-center text-slate-500 py-12">No MLS groups configured</div>
          ) : groups.map(group => (
            <div key={group.id} className="bg-slate-800/30 border border-slate-700/50 rounded-xl overflow-hidden">
              <button className="w-full flex items-center justify-between p-4 hover:bg-slate-800/50"
                onClick={() => setExpandedGroup(expandedGroup === group.id ? null : group.id)}>
                <div className="flex items-center gap-3">
                  <Lock className={`h-5 w-5 ${group.status === 'active' ? 'text-emerald-400' : 'text-slate-500'}`} />
                  <div className="text-left">
                    <span className="font-medium text-white">{group.name}</span>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-xs text-slate-500">Cipher: {group.cipherSuite}</span>
                      <span className="text-xs text-slate-500">Epoch: {group.epochNumber}</span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-xs text-slate-400">{group.memberCount} members</span>
                  <span className={`text-xs px-2 py-0.5 rounded-full ${group.status === 'active' ? 'bg-emerald-900/50 text-emerald-300' : 'bg-slate-700 text-slate-300'}`}>
                    {group.status}
                  </span>
                  {expandedGroup === group.id ? <ChevronUp className="h-4 w-4 text-slate-400" /> : <ChevronDown className="h-4 w-4 text-slate-400" />}
                </div>
              </button>
              {expandedGroup === group.id && (
                <div className="border-t border-slate-700/50 p-4 space-y-3">
                  <div className="grid grid-cols-3 gap-4 text-sm">
                    <div>
                      <span className="text-xs text-slate-400">Created</span>
                      <p className="text-slate-300">{new Date(group.createdAt).toLocaleString()}</p>
                    </div>
                    <div>
                      <span className="text-xs text-slate-400">Last Updated</span>
                      <p className="text-slate-300">{new Date(group.lastUpdatedAt).toLocaleString()}</p>
                    </div>
                    <div>
                      <span className="text-xs text-slate-400">Group ID</span>
                      <p className="text-slate-300 font-mono text-xs">{group.id}</p>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => rotateGroupKeys(group.id)}
                      className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs rounded-lg flex items-center gap-1">
                      <Key className="h-3 w-3" /> Rotate Keys
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {activeTab === 'keys' && (
        <div className="bg-slate-800/30 border border-slate-700/50 rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-slate-800/50">
              <tr>
                <th className="text-left p-3 text-slate-400 font-medium">Agent ID</th>
                <th className="text-left p-3 text-slate-400 font-medium">Cipher Suite</th>
                <th className="text-center p-3 text-slate-400 font-medium">Status</th>
                <th className="text-left p-3 text-slate-400 font-medium">Created</th>
                <th className="text-left p-3 text-slate-400 font-medium">Expires</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-700/50">
              {keyPackages.length === 0 ? (
                <tr><td colSpan={5} className="p-6 text-center text-slate-500">No key packages</td></tr>
              ) : keyPackages.map(kp => (
                <tr key={kp.id} className="hover:bg-slate-800/30">
                  <td className="p-3 text-white font-mono text-xs">{kp.agentId}</td>
                  <td className="p-3 text-slate-300 text-xs">{kp.cipherSuite}</td>
                  <td className="p-3 text-center">
                    <span className={`text-xs px-2 py-0.5 rounded-full ${kp.isConsumed ? 'bg-slate-700 text-slate-400' : 'bg-emerald-900/50 text-emerald-300'}`}>
                      {kp.isConsumed ? 'Consumed' : 'Available'}
                    </span>
                  </td>
                  <td className="p-3 text-slate-400 text-xs">{new Date(kp.createdAt).toLocaleString()}</td>
                  <td className="p-3 text-slate-400 text-xs">{new Date(kp.expiresAt).toLocaleDateString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {activeTab === 'audit' && (
        <div className="bg-slate-800/30 border border-slate-700/50 rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-slate-800/50">
              <tr>
                <th className="text-left p-3 text-slate-400 font-medium">Action</th>
                <th className="text-left p-3 text-slate-400 font-medium">Group</th>
                <th className="text-left p-3 text-slate-400 font-medium">Agent</th>
                <th className="text-center p-3 text-slate-400 font-medium">Epoch</th>
                <th className="text-left p-3 text-slate-400 font-medium">Timestamp</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-700/50">
              {audit.length === 0 ? (
                <tr><td colSpan={5} className="p-6 text-center text-slate-500">No audit entries</td></tr>
              ) : audit.map(entry => (
                <tr key={entry.id} className="hover:bg-slate-800/30">
                  <td className="p-3">
                    <span className={`text-xs px-2 py-0.5 rounded ${entry.action.includes('rotate') ? 'bg-yellow-900/50 text-yellow-300' : entry.action.includes('add') ? 'bg-emerald-900/50 text-emerald-300' : entry.action.includes('remove') ? 'bg-red-900/50 text-red-300' : 'bg-slate-700 text-slate-300'}`}>
                      {entry.action}
                    </span>
                  </td>
                  <td className="p-3 text-white font-mono text-xs">{entry.groupId}</td>
                  <td className="p-3 text-slate-300 font-mono text-xs">{entry.agentId}</td>
                  <td className="p-3 text-center text-slate-300">{entry.epoch}</td>
                  <td className="p-3 text-slate-400 text-xs">{new Date(entry.timestamp).toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
