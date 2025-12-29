'use client';

import React, { useState, useEffect } from 'react';
import { Heart, AlertTriangle, CheckCircle, XCircle, BookOpen, Shield, RefreshCw, ExternalLink, Award, Scale, Cpu, Globe, FileWarning, Building } from 'lucide-react';

interface EthicalEvaluation {
  evaluationId: string;
  action: string;
  principlesApplied: string[];
  ethicalScore: number;
  concerns: string[];
  recommendations: string[];
  approved: boolean;
  reasoning: string;
  createdAt: string;
}

interface EthicalStats {
  totalEvaluations: number;
  approved: number;
  rejected: number;
  averageScore: number;
  evaluationsToday: number;
}

interface StandardSource {
  code: string;
  name: string;
  fullName: string;
  organization: string;
  section?: string;
  requirement?: string;
  url?: string;
  isMandatory: boolean;
}

interface EthicalPrinciple {
  principleId: string;
  name: string;
  teaching: string;
  source: string;
  category: string;
  weight: number;
  standards?: StandardSource[];
}

interface AIEthicsStandard {
  code: string;
  name: string;
  fullName: string;
  version?: string;
  organization: string;
  organizationType: string;
  description?: string;
  url?: string;
  publicationDate?: string;
  isMandatory: boolean;
  icon?: string;
}

const CATEGORY_COLORS: Record<string, string> = {
  love: 'bg-pink-100 text-pink-700',
  mercy: 'bg-purple-100 text-purple-700',
  truth: 'bg-blue-100 text-blue-700',
  service: 'bg-green-100 text-green-700',
  humility: 'bg-yellow-100 text-yellow-700',
  peace: 'bg-cyan-100 text-cyan-700',
  forgiveness: 'bg-orange-100 text-orange-700',
};

const STANDARD_ICONS: Record<string, React.ElementType> = {
  Shield, Award, Scale, Cpu, Globe, FileWarning, Building, Heart, AlertTriangle, BookOpen,
};

const ORG_TYPE_COLORS: Record<string, string> = {
  government: 'bg-blue-100 text-blue-700',
  iso: 'bg-green-100 text-green-700',
  industry: 'bg-purple-100 text-purple-700',
  academic: 'bg-amber-100 text-amber-700',
  religious: 'bg-pink-100 text-pink-700',
};

export default function EthicsPage() {
  const [evaluations, setEvaluations] = useState<EthicalEvaluation[]>([]);
  const [stats, setStats] = useState<EthicalStats | null>(null);
  const [principles, setPrinciples] = useState<EthicalPrinciple[]>([]);
  const [standards, setStandards] = useState<AIEthicsStandard[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<'violations' | 'all' | 'principles' | 'standards'>('violations');

  useEffect(() => { loadData(); }, [tab]); // eslint-disable-line react-hooks/exhaustive-deps

  const [error, setError] = useState<string | null>(null);

  async function loadData() {
    setLoading(true);
    setError(null);
    try {
      const [evalRes, statsRes, principlesRes, standardsRes] = await Promise.all([
        fetch(`${process.env.NEXT_PUBLIC_API_URL || ''}/admin/ethics/${tab === 'violations' ? 'violations' : 'evaluations'}`),
        fetch(`${process.env.NEXT_PUBLIC_API_URL || ''}/admin/ethics/stats`),
        fetch(`${process.env.NEXT_PUBLIC_API_URL || ''}/admin/ethics/principles`),
        fetch(`${process.env.NEXT_PUBLIC_API_URL || ''}/admin/ethics/standards`),
      ]);
      if (evalRes.ok) { const d = await evalRes.json(); setEvaluations(d.evaluations || d.violations || []); }
      else setError('Failed to load ethical evaluations.');
      if (statsRes.ok) setStats(await statsRes.json());
      if (principlesRes.ok) { const d = await principlesRes.json(); setPrinciples(d.principles || []); }
      if (standardsRes.ok) { const d = await standardsRes.json(); setStandards(d.standards || []); }
    } catch { setError('Failed to connect to ethics service.'); }
    setLoading(false);
  }

  if (loading) return <div className="flex items-center justify-center h-96"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600" /></div>;
  if (error) return <div className="flex flex-col items-center justify-center h-96 text-red-500"><p className="text-lg font-medium">Error</p><p className="text-sm">{error}</p><button onClick={loadData} className="mt-4 px-4 py-2 bg-purple-600 text-white rounded-lg">Retry</button></div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2"><Heart className="h-7 w-7 text-pink-500" /> Ethical Conscience Monitor</h1>
          <p className="text-sm text-gray-500 mt-1">Guided by the teachings of Jesus Christ</p>
        </div>
        <button onClick={loadData} className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700">
          <RefreshCw className="h-4 w-4" /> Refresh
        </button>
      </div>

      {/* Stats Cards */}
      {stats && (
        <div className="grid grid-cols-5 gap-4">
          <StatCard title="Total Evaluations" value={stats.totalEvaluations} icon={Shield} color="blue" />
          <StatCard title="Approved" value={stats.approved} icon={CheckCircle} color="green" />
          <StatCard title="Violations" value={stats.rejected} icon={XCircle} color="red" />
          <StatCard title="Avg Score" value={`${(stats.averageScore * 100).toFixed(0)}%`} icon={Heart} color="pink" />
          <StatCard title="Today" value={stats.evaluationsToday} icon={BookOpen} color="purple" />
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-2 border-b">
        {(['violations', 'all', 'principles', 'standards'] as const).map(t => (
          <button key={t} onClick={() => setTab(t)} className={`px-4 py-2 font-medium ${tab === t ? 'border-b-2 border-purple-500 text-purple-600' : 'text-gray-500 hover:text-gray-700'}`}>
            {t === 'violations' ? '⚠️ Violations' : t === 'all' ? '📋 All Evaluations' : t === 'principles' ? '📖 Principles' : '📜 Standards'}
          </button>
        ))}
      </div>

      {/* Content */}
      {tab === 'standards' ? (
        <div className="space-y-4">
          <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-4 mb-4">
            <p className="text-sm text-blue-700 dark:text-blue-300">
              These are the AI ethics standards and frameworks that inform our ethical principles. 
              Each principle is mapped to relevant sections of these standards.
            </p>
          </div>
          <div className="grid grid-cols-1 gap-4">
            {standards.map(s => {
              const IconComponent = STANDARD_ICONS[s.icon || 'Shield'] || Shield;
              return (
                <div key={s.code} className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border p-5">
                  <div className="flex items-start gap-4">
                    <div className={`p-3 rounded-lg ${ORG_TYPE_COLORS[s.organizationType] || 'bg-gray-100'}`}>
                      <IconComponent className="h-6 w-6" />
                    </div>
                    <div className="flex-1">
                      <div className="flex items-start justify-between">
                        <div>
                          <h3 className="font-semibold text-lg">{s.name}</h3>
                          <p className="text-sm text-gray-500">{s.fullName}</p>
                        </div>
                        <div className="flex items-center gap-2">
                          {s.isMandatory && (
                            <span className="px-2 py-1 bg-red-100 text-red-700 rounded-full text-xs font-medium">Required</span>
                          )}
                          <span className={`px-2 py-1 rounded-full text-xs font-medium ${ORG_TYPE_COLORS[s.organizationType] || 'bg-gray-100'}`}>
                            {s.organizationType}
                          </span>
                        </div>
                      </div>
                      <p className="text-sm text-gray-600 dark:text-gray-300 mt-2">{s.description}</p>
                      <div className="flex items-center gap-4 mt-3 text-sm text-gray-500">
                        <span>{s.organization}</span>
                        {s.version && <span>Version: {s.version}</span>}
                        {s.publicationDate && <span>Published: {new Date(s.publicationDate).toLocaleDateString()}</span>}
                      </div>
                      {s.url && (
                        <a 
                          href={s.url} 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 mt-3 text-sm text-purple-600 hover:text-purple-700"
                        >
                          View Standard <ExternalLink className="h-3 w-3" />
                        </a>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ) : tab === 'principles' ? (
        <div className="grid grid-cols-2 gap-4">
          {principles.map(p => (
            <div key={p.principleId} className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border p-4">
              <div className="flex items-start justify-between mb-2">
                <h3 className="font-semibold text-lg">{p.name}</h3>
                <span className={`px-2 py-1 rounded-full text-xs font-medium ${CATEGORY_COLORS[p.category] || 'bg-gray-100'}`}>{p.category}</span>
              </div>
              <p className="text-gray-600 dark:text-gray-300 italic mb-2">&ldquo;{p.teaching}&rdquo;</p>
              <p className="text-sm text-gray-500 mb-3">{p.source}</p>
              {p.standards && p.standards.length > 0 && (
                <div className="border-t pt-3 mt-3">
                  <p className="text-xs font-medium text-gray-500 mb-2">Derived from / Aligned with:</p>
                  <div className="flex flex-wrap gap-2">
                    {p.standards.map(std => (
                      <span 
                        key={std.code} 
                        className="inline-flex items-center gap-1 px-2 py-1 bg-gray-100 dark:bg-gray-700 rounded text-xs"
                        title={`${std.fullName}${std.section ? ` - ${std.section}` : ''}`}
                      >
                        {std.name}
                        {std.section && <span className="text-gray-400">({std.section})</span>}
                        {std.isMandatory && <span className="text-red-500">*</span>}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      ) : (
        <div className="space-y-3">
          {evaluations.length === 0 ? (
            <div className="text-center py-12 text-gray-500">
              <CheckCircle className="h-12 w-12 mx-auto mb-3 text-green-500" />
              <p>No {tab === 'violations' ? 'violations' : 'evaluations'} found</p>
            </div>
          ) : (
            evaluations.map(e => (
              <div key={e.evaluationId} className={`bg-white dark:bg-gray-800 rounded-xl shadow-sm border p-4 ${!e.approved ? 'border-l-4 border-l-red-500' : ''}`}>
                <div className="flex items-start justify-between mb-2">
                  <div className="flex items-center gap-2">
                    {e.approved ? <CheckCircle className="h-5 w-5 text-green-500" /> : <AlertTriangle className="h-5 w-5 text-red-500" />}
                    <span className="font-medium">{e.action}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${e.approved ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                      {(e.ethicalScore * 100).toFixed(0)}%
                    </span>
                    <span className="text-xs text-gray-500">{new Date(e.createdAt).toLocaleString()}</span>
                  </div>
                </div>
                {e.concerns.length > 0 && (
                  <div className="mt-2 p-2 bg-red-50 dark:bg-red-900/20 rounded-lg">
                    <p className="text-sm font-medium text-red-700 dark:text-red-400">Concerns:</p>
                    <ul className="text-sm text-red-600 dark:text-red-300 list-disc list-inside">
                      {e.concerns.map((c, i) => <li key={i}>{c}</li>)}
                    </ul>
                  </div>
                )}
                {e.recommendations.length > 0 && (
                  <div className="mt-2 p-2 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                    <p className="text-sm font-medium text-blue-700 dark:text-blue-400">Guidance:</p>
                    <ul className="text-sm text-blue-600 dark:text-blue-300">
                      {e.recommendations.map((r, i) => <li key={i} className="italic">&ldquo;{r}&rdquo;</li>)}
                    </ul>
                  </div>
                )}
                <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">{e.reasoning}</p>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}

function StatCard({ title, value, icon: Icon, color }: { title: string; value: number | string; icon: React.ElementType; color: string }) {
  const colors: Record<string, string> = { blue: 'bg-blue-100 text-blue-600', green: 'bg-green-100 text-green-600', red: 'bg-red-100 text-red-600', pink: 'bg-pink-100 text-pink-600', purple: 'bg-purple-100 text-purple-600' };
  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border p-4">
      <div className="flex items-center gap-3">
        <div className={`p-2 rounded-lg ${colors[color]}`}><Icon className="h-5 w-5" /></div>
        <div><p className="text-sm text-gray-500">{title}</p><p className="text-xl font-bold">{value}</p></div>
      </div>
    </div>
  );
}

