'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  Swords, RefreshCw, Plus, Play, Pause, Trash2, Users, Clock, BarChart3,
  ChevronDown, ChevronUp, Settings, MessageSquare, Shield, AlertTriangle,
} from 'lucide-react';

interface Council {
  id: string;
  name: string;
  description: string;
  members: Array<{ role: string; modelId: string; persona: string }>;
  moderator: { modelId: string; strategy: string };
  rules: { maxRounds: number; consensusThreshold: number; timeoutMs: number };
  status: string;
  totalDebates: number;
  avgConsensusRate: number;
  createdAt: string;
}

interface Debate {
  id: string;
  councilId: string;
  topic: string;
  status: string;
  rounds: number;
  consensusReached: boolean;
  verdict: string | null;
  startedAt: string;
  completedAt: string | null;
}

const API = '/api/admin/council';

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

export default function CouncilPage() {
  const [councils, setCouncils] = useState<Council[]>([]);
  const [debates, setDebates] = useState<Debate[]>([]);
  const [presets, setPresets] = useState<Array<{ id: string; name: string; description: string }>>([]);
  const [loading, setLoading] = useState(true);
  const [expandedCouncil, setExpandedCouncil] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'councils' | 'debates' | 'presets'>('councils');

  const load = useCallback(async () => {
    try {
      const [councilData, presetData] = await Promise.all([
        fetchApi('/list'),
        fetchApi('/presets'),
      ]);
      setCouncils(councilData.councils || councilData || []);
      setPresets(presetData.presets || presetData || []);
    } catch (err) {
      console.error('Failed to load councils', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleCreateFromPreset = async (presetId: string) => {
    try {
      await fetchApi('/from-preset', { method: 'POST', body: JSON.stringify({ presetId }) });
      await load();
    } catch (err) {
      alert(`Failed: ${err instanceof Error ? err.message : 'Unknown error'}`);
    }
  };

  const handleStartDebate = async (councilId: string, topic: string) => {
    try {
      const result = await fetchApi(`/${councilId}/debate`, { method: 'POST', body: JSON.stringify({ topic }) });
      setDebates(prev => [result, ...prev]);
    } catch (err) {
      alert(`Failed: ${err instanceof Error ? err.message : 'Unknown error'}`);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="h-8 w-8 animate-spin text-red-400" />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-3">
            <Swords className="h-7 w-7 text-red-400" />
            Council of Rivals
          </h1>
          <p className="text-sm text-slate-400 mt-1">Multi-agent adversarial debates for robust decision-making</p>
        </div>
        <button onClick={load} className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white text-sm rounded-lg flex items-center gap-2">
          <RefreshCw className="h-4 w-4" /> Refresh
        </button>
      </div>

      <div className="grid grid-cols-4 gap-4">
        <StatCard icon={Users} label="Total Councils" value={councils.length} color="text-blue-400" />
        <StatCard icon={MessageSquare} label="Total Debates" value={councils.reduce((s, c) => s + (c.totalDebates || 0), 0)} color="text-purple-400" />
        <StatCard icon={BarChart3} label="Avg Consensus" value={`${(councils.reduce((s, c) => s + (c.avgConsensusRate || 0), 0) / Math.max(councils.length, 1) * 100).toFixed(0)}%`} color="text-emerald-400" />
        <StatCard icon={Shield} label="Presets Available" value={presets.length} color="text-orange-400" />
      </div>

      <div className="flex gap-1 bg-slate-800/50 rounded-lg p-1">
        {(['councils', 'debates', 'presets'] as const).map(tab => (
          <button key={tab} onClick={() => setActiveTab(tab)}
            className={`flex-1 px-4 py-2 text-sm rounded-md transition-colors capitalize ${activeTab === tab ? 'bg-slate-700 text-white' : 'text-slate-400 hover:text-white'}`}>
            {tab}
          </button>
        ))}
      </div>

      {activeTab === 'councils' && (
        <div className="space-y-3">
          {councils.length === 0 ? (
            <div className="text-center text-slate-500 py-12">No councils created yet. Use a preset to get started.</div>
          ) : councils.map(council => (
            <div key={council.id} className="bg-slate-800/30 border border-slate-700/50 rounded-xl overflow-hidden">
              <button className="w-full flex items-center justify-between p-4 hover:bg-slate-800/50"
                onClick={() => setExpandedCouncil(expandedCouncil === council.id ? null : council.id)}>
                <div className="flex items-center gap-3">
                  <Swords className="h-5 w-5 text-red-400" />
                  <div className="text-left">
                    <span className="font-medium text-white">{council.name}</span>
                    <p className="text-xs text-slate-500">{council.description}</p>
                  </div>
                  <span className={`text-xs px-2 py-0.5 rounded-full ${council.status === 'active' ? 'bg-emerald-900/50 text-emerald-300' : 'bg-slate-700 text-slate-300'}`}>
                    {council.status}
                  </span>
                </div>
                <div className="flex items-center gap-4">
                  <span className="text-xs text-slate-400">{council.members?.length || 0} members</span>
                  <span className="text-xs text-slate-400">{council.totalDebates || 0} debates</span>
                  {expandedCouncil === council.id ? <ChevronUp className="h-4 w-4 text-slate-400" /> : <ChevronDown className="h-4 w-4 text-slate-400" />}
                </div>
              </button>
              {expandedCouncil === council.id && (
                <div className="border-t border-slate-700/50 p-4 space-y-4">
                  <div className="grid grid-cols-3 gap-4">
                    <div>
                      <h4 className="text-xs font-semibold text-slate-400 mb-2">Members</h4>
                      {(council.members || []).map((m, i) => (
                        <div key={i} className="flex items-center gap-2 text-sm text-slate-300 mb-1">
                          <Users className="h-3 w-3" />
                          <span className="font-mono text-xs">{m.role}</span> — {m.modelId}
                        </div>
                      ))}
                    </div>
                    <div>
                      <h4 className="text-xs font-semibold text-slate-400 mb-2">Moderator</h4>
                      <div className="text-sm text-slate-300">{council.moderator?.modelId || 'None'}</div>
                      <div className="text-xs text-slate-500">Strategy: {council.moderator?.strategy || 'default'}</div>
                    </div>
                    <div>
                      <h4 className="text-xs font-semibold text-slate-400 mb-2">Rules</h4>
                      <div className="text-sm text-slate-300">Max rounds: {council.rules?.maxRounds || 5}</div>
                      <div className="text-sm text-slate-300">Consensus: {((council.rules?.consensusThreshold || 0.7) * 100).toFixed(0)}%</div>
                      <div className="text-sm text-slate-300">Timeout: {(council.rules?.timeoutMs || 30000) / 1000}s</div>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => handleStartDebate(council.id, 'New debate topic')}
                      className="px-3 py-1.5 bg-red-600 hover:bg-red-500 text-white text-xs rounded-lg flex items-center gap-1">
                      <Play className="h-3 w-3" /> Start Debate
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {activeTab === 'presets' && (
        <div className="grid grid-cols-2 gap-4">
          {presets.map(preset => (
            <div key={preset.id} className="bg-slate-800/30 border border-slate-700/50 rounded-xl p-4">
              <h3 className="font-medium text-white">{preset.name}</h3>
              <p className="text-xs text-slate-400 mt-1">{preset.description}</p>
              <button onClick={() => handleCreateFromPreset(preset.id)}
                className="mt-3 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white text-xs rounded-lg flex items-center gap-1">
                <Plus className="h-3 w-3" /> Create from Preset
              </button>
            </div>
          ))}
        </div>
      )}

      {activeTab === 'debates' && (
        <div className="bg-slate-800/30 border border-slate-700/50 rounded-xl p-6">
          <p className="text-sm text-slate-400">Debate history will appear here when debates are run. Start a debate from a council to begin.</p>
        </div>
      )}
    </div>
  );
}
