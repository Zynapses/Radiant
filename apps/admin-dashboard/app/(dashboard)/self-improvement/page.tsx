'use client';

import React, { useState, useEffect } from 'react';

interface ImprovementIdea {
  ideaId: string; ideaCode: string; title: string; description: string; category: string; priority: string;
  status: string; version: number; isDeprecated: boolean; deprecationReason?: string;
  confidenceScore: number; impactScore: number; feasibilityScore: number; compositeScore: number;
  createdAt: string; evolutionCount: number;
}
interface Notification { id: string; type: string; title: string; message: string; priority: string; read: boolean; createdAt: string; }
interface SelfAwareness { capability: string; strength: number; weakness: number; actual: number; trend: string; }
interface Stats { totalIdeas: number; activeIdeas: number; deprecatedIdeas: number; implementedIdeas: number; pendingReview: number; recentAnalyses: number; unreadNotifications: number; }


const defaultStats: Stats = { totalIdeas: 0, activeIdeas: 0, deprecatedIdeas: 0, implementedIdeas: 0, pendingReview: 0, recentAnalyses: 0, unreadNotifications: 0 };

export default function SelfImprovementPage() {
  const [selectedTab, setSelectedTab] = useState<'overview' | 'ideas' | 'awareness' | 'notifications' | 'history'>('overview');
  const [ideas, setIdeas] = useState<ImprovementIdea[]>([]);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [selfAwareness, setSelfAwareness] = useState<SelfAwareness[]>([]);
  const [stats, setStats] = useState<Stats>(defaultStats);
  const [selectedIdea, setSelectedIdea] = useState<ImprovementIdea | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadData() {
      setLoading(true);
      setError(null);
      try {
        const API = process.env.NEXT_PUBLIC_API_URL || '';
        const [ideasRes, notificationsRes, awarenessRes, statsRes] = await Promise.all([
          fetch(`${API}/api/admin/self-improvement/ideas`),
          fetch(`${API}/api/admin/self-improvement/notifications`),
          fetch(`${API}/api/admin/self-improvement/awareness`),
          fetch(`${API}/api/admin/self-improvement/stats`),
        ]);
        if (ideasRes.ok) { const { data } = await ideasRes.json(); setIdeas(data || []); }
        else setError('Failed to load self-improvement data.');
        if (notificationsRes.ok) { const { data } = await notificationsRes.json(); setNotifications(data || []); }
        if (awarenessRes.ok) { const { data } = await awarenessRes.json(); setSelfAwareness(data || []); }
        if (statsRes.ok) { const { data } = await statsRes.json(); setStats(data || defaultStats); }
      } catch { setError('Failed to connect to self-improvement service.'); }
      setLoading(false);
    }
    loadData();
  }, []);

  if (loading) return <div className="flex items-center justify-center h-96"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600" /></div>;
  if (error) return <div className="flex flex-col items-center justify-center h-96 text-red-500"><p className="text-lg font-medium">Error</p><p className="text-sm">{error}</p></div>;

  const filteredIdeas = ideas.filter((idea: ImprovementIdea) => {
    if (statusFilter !== 'all' && idea.status !== statusFilter) return false;
    if (categoryFilter !== 'all' && idea.category !== categoryFilter) return false;
    return true;
  });

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'proposed': return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200';
      case 'under_review': return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200';
      case 'approved': return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200';
      case 'implementing': return 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200';
      case 'implemented': return 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200';
      case 'deprecated': return 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'critical': return 'text-red-600 dark:text-red-400';
      case 'high': return 'text-orange-600 dark:text-orange-400';
      case 'medium': return 'text-yellow-600 dark:text-yellow-400';
      case 'low': return 'text-green-600 dark:text-green-400';
      default: return 'text-gray-600';
    }
  };

  const getTrendIcon = (trend: string) => {
    switch (trend) {
      case 'improving': return '↑';
      case 'declining': return '↓';
      default: return '→';
    }
  };

  const getTrendColor = (trend: string) => {
    switch (trend) {
      case 'improving': return 'text-green-500';
      case 'declining': return 'text-red-500';
      default: return 'text-gray-500';
    }
  };

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">AGI Self-Improvement Registry</h1>
          <p className="text-gray-600 dark:text-gray-400">Monitor and manage AGI self-awareness and improvement proposals</p>
        </div>
        <div className="flex gap-2">
          <button className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors">
            Run Self-Analysis
          </button>
          <button className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
            Export Report
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200 dark:border-gray-700">
        <nav className="flex gap-4">
          {['overview', 'ideas', 'awareness', 'notifications', 'history'].map((tab) => (
            <button
              key={tab}
              onClick={() => setSelectedTab(tab as typeof selectedTab)}
              className={`py-3 px-1 border-b-2 font-medium text-sm transition-colors ${
                selectedTab === tab
                  ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                  : 'border-transparent text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
              }`}
            >
              {tab.charAt(0).toUpperCase() + tab.slice(1)}
              {tab === 'notifications' && stats.unreadNotifications > 0 && (
                <span className="ml-2 px-2 py-0.5 text-xs bg-red-500 text-white rounded-full">
                  {stats.unreadNotifications}
                </span>
              )}
            </button>
          ))}
        </nav>
      </div>

      {/* Overview Tab */}
      {selectedTab === 'overview' && (
        <div className="space-y-6">
          {/* Stats Grid */}
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-4">
            <div className="bg-white dark:bg-gray-800 rounded-lg p-4 shadow">
              <p className="text-sm text-gray-500 dark:text-gray-400">Total Ideas</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">{stats.totalIdeas}</p>
            </div>
            <div className="bg-white dark:bg-gray-800 rounded-lg p-4 shadow">
              <p className="text-sm text-gray-500 dark:text-gray-400">Active</p>
              <p className="text-2xl font-bold text-green-600">{stats.activeIdeas}</p>
            </div>
            <div className="bg-white dark:bg-gray-800 rounded-lg p-4 shadow">
              <p className="text-sm text-gray-500 dark:text-gray-400">Deprecated</p>
              <p className="text-2xl font-bold text-gray-500">{stats.deprecatedIdeas}</p>
            </div>
            <div className="bg-white dark:bg-gray-800 rounded-lg p-4 shadow">
              <p className="text-sm text-gray-500 dark:text-gray-400">Implemented</p>
              <p className="text-2xl font-bold text-blue-600">{stats.implementedIdeas}</p>
            </div>
            <div className="bg-white dark:bg-gray-800 rounded-lg p-4 shadow">
              <p className="text-sm text-gray-500 dark:text-gray-400">Pending Review</p>
              <p className="text-2xl font-bold text-yellow-600">{stats.pendingReview}</p>
            </div>
            <div className="bg-white dark:bg-gray-800 rounded-lg p-4 shadow">
              <p className="text-sm text-gray-500 dark:text-gray-400">Recent Analyses</p>
              <p className="text-2xl font-bold text-purple-600">{stats.recentAnalyses}</p>
            </div>
            <div className="bg-white dark:bg-gray-800 rounded-lg p-4 shadow">
              <p className="text-sm text-gray-500 dark:text-gray-400">Notifications</p>
              <p className="text-2xl font-bold text-red-600">{stats.unreadNotifications}</p>
            </div>
          </div>

          {/* Top Ideas by Score */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow">
            <div className="p-4 border-b border-gray-200 dark:border-gray-700">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Top Improvement Ideas (by Composite Score)</h2>
            </div>
            <div className="p-4">
              <div className="space-y-3">
                {ideas
                  .filter(i => !i.isDeprecated)
                  .sort((a, b) => b.compositeScore - a.compositeScore)
                  .slice(0, 5)
                  .map((idea) => (
                    <div key={idea.ideaId} className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-900 rounded-lg">
                      <div className="flex items-center gap-3">
                        <span className="font-mono text-sm text-gray-500">{idea.ideaCode}</span>
                        <span className="font-medium text-gray-900 dark:text-white">{idea.title}</span>
                        <span className={`px-2 py-0.5 text-xs rounded-full ${getStatusColor(idea.status)}`}>
                          {idea.status.replace('_', ' ')}
                        </span>
                      </div>
                      <div className="flex items-center gap-4">
                        <span className={`text-sm font-medium ${getPriorityColor(idea.priority)}`}>
                          {idea.priority}
                        </span>
                        <div className="w-24 bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                          <div 
                            className="bg-blue-600 h-2 rounded-full" 
                            style={{ width: `${idea.compositeScore * 100}%` }}
                          />
                        </div>
                        <span className="text-sm font-medium text-gray-600 dark:text-gray-400 w-12">
                          {(idea.compositeScore * 100).toFixed(0)}%
                        </span>
                      </div>
                    </div>
                  ))}
              </div>
            </div>
          </div>

          {/* Recent Notifications */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow">
            <div className="p-4 border-b border-gray-200 dark:border-gray-700">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Recent Notifications</h2>
            </div>
            <div className="p-4">
              <div className="space-y-2">
                {notifications.slice(0, 3).map((notif) => (
                  <div key={notif.id} className={`p-3 rounded-lg ${notif.read ? 'bg-gray-50 dark:bg-gray-900' : 'bg-blue-50 dark:bg-blue-900/20'}`}>
                    <div className="flex items-center justify-between">
                      <span className="font-medium text-gray-900 dark:text-white">{notif.title}</span>
                      <span className="text-xs text-gray-500">{new Date(notif.createdAt).toLocaleDateString()}</span>
                    </div>
                    <p className="text-sm text-gray-600 dark:text-gray-400">{notif.message}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Ideas Tab */}
      {selectedTab === 'ideas' && (
        <div className="space-y-4">
          {/* Filters */}
          <div className="flex gap-4">
            <select 
              value={statusFilter} 
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800"
            >
              <option value="all">All Status</option>
              <option value="proposed">Proposed</option>
              <option value="under_review">Under Review</option>
              <option value="approved">Approved</option>
              <option value="implementing">Implementing</option>
              <option value="implemented">Implemented</option>
              <option value="deprecated">Deprecated</option>
            </select>
            <select 
              value={categoryFilter} 
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800"
            >
              <option value="all">All Categories</option>
              <option value="reasoning">Reasoning</option>
              <option value="memory">Memory</option>
              <option value="safety">Safety</option>
              <option value="performance">Performance</option>
            </select>
          </div>

          {/* Ideas List */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden">
            <table className="w-full">
              <thead className="bg-gray-50 dark:bg-gray-900">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Code</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Title</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Category</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Priority</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Version</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Score</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                {filteredIdeas.map((idea) => (
                  <tr 
                    key={idea.ideaId} 
                    className={`hover:bg-gray-50 dark:hover:bg-gray-900 ${idea.isDeprecated ? 'opacity-60' : ''}`}
                  >
                    <td className="px-4 py-3 font-mono text-sm">{idea.ideaCode}</td>
                    <td className="px-4 py-3">
                      <button 
                        onClick={() => setSelectedIdea(idea)}
                        className="text-blue-600 hover:text-blue-800 dark:text-blue-400 text-left"
                      >
                        {idea.title}
                      </button>
                    </td>
                    <td className="px-4 py-3 capitalize">{idea.category}</td>
                    <td className={`px-4 py-3 capitalize font-medium ${getPriorityColor(idea.priority)}`}>
                      {idea.priority}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-1 text-xs rounded-full ${getStatusColor(idea.status)}`}>
                        {idea.status.replace('_', ' ')}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      v{idea.version}
                      {idea.evolutionCount > 0 && (
                        <span className="ml-1 text-xs text-gray-500">({idea.evolutionCount} evolutions)</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div className="w-16 bg-gray-200 dark:bg-gray-700 rounded-full h-1.5">
                          <div 
                            className="bg-blue-600 h-1.5 rounded-full" 
                            style={{ width: `${idea.compositeScore * 100}%` }}
                          />
                        </div>
                        <span className="text-sm">{(idea.compositeScore * 100).toFixed(0)}%</span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex gap-2">
                        {!idea.isDeprecated && (
                          <>
                            <button className="text-xs px-2 py-1 bg-green-100 text-green-800 rounded hover:bg-green-200">
                              Approve
                            </button>
                            <button className="text-xs px-2 py-1 bg-gray-100 text-gray-800 rounded hover:bg-gray-200">
                              Deprecate
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Self-Awareness Tab */}
      {selectedTab === 'awareness' && (
        <div className="space-y-6">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow">
            <div className="p-4 border-b border-gray-200 dark:border-gray-700">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Performance Self-Awareness</h2>
              <p className="text-sm text-gray-500">AGI&apos;s self-assessment vs actual measured performance</p>
            </div>
            <div className="p-4">
              <div className="space-y-4">
                {selfAwareness.map((item) => (
                  <div key={item.capability} className="p-4 bg-gray-50 dark:bg-gray-900 rounded-lg">
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-medium text-gray-900 dark:text-white">{item.capability}</span>
                      <span className={`text-lg font-bold ${getTrendColor(item.trend)}`}>
                        {getTrendIcon(item.trend)} {item.trend}
                      </span>
                    </div>
                    <div className="grid grid-cols-3 gap-4">
                      <div>
                        <p className="text-xs text-gray-500 mb-1">Self-Assessed Strength</p>
                        <div className="flex items-center gap-2">
                          <div className="flex-1 bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                            <div 
                              className="bg-blue-500 h-2 rounded-full" 
                              style={{ width: `${item.strength * 100}%` }}
                            />
                          </div>
                          <span className="text-sm font-medium">{(item.strength * 100).toFixed(0)}%</span>
                        </div>
                      </div>
                      <div>
                        <p className="text-xs text-gray-500 mb-1">Actual Performance</p>
                        <div className="flex items-center gap-2">
                          <div className="flex-1 bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                            <div 
                              className="bg-green-500 h-2 rounded-full" 
                              style={{ width: `${item.actual * 100}%` }}
                            />
                          </div>
                          <span className="text-sm font-medium">{(item.actual * 100).toFixed(0)}%</span>
                        </div>
                      </div>
                      <div>
                        <p className="text-xs text-gray-500 mb-1">Calibration Accuracy</p>
                        <div className="flex items-center gap-2">
                          <div className="flex-1 bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                            <div 
                              className={`h-2 rounded-full ${Math.abs(item.strength - item.actual) < 0.05 ? 'bg-green-500' : 'bg-yellow-500'}`}
                              style={{ width: `${(1 - Math.abs(item.strength - item.actual)) * 100}%` }}
                            />
                          </div>
                          <span className="text-sm font-medium">
                            {((1 - Math.abs(item.strength - item.actual)) * 100).toFixed(0)}%
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Notifications Tab */}
      {selectedTab === 'notifications' && (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow">
          <div className="p-4 border-b border-gray-200 dark:border-gray-700 flex justify-between items-center">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Notifications</h2>
            <button className="text-sm text-blue-600 hover:text-blue-800">Mark all as read</button>
          </div>
          <div className="divide-y divide-gray-200 dark:divide-gray-700">
            {notifications.map((notif) => (
              <div 
                key={notif.id} 
                className={`p-4 ${notif.read ? '' : 'bg-blue-50 dark:bg-blue-900/20'}`}
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      {!notif.read && <span className="w-2 h-2 bg-blue-500 rounded-full" />}
                      <span className="font-medium text-gray-900 dark:text-white">{notif.title}</span>
                      <span className={`text-xs px-2 py-0.5 rounded-full ${
                        notif.priority === 'high' ? 'bg-red-100 text-red-800' : 
                        notif.priority === 'normal' ? 'bg-gray-100 text-gray-800' : 
                        'bg-green-100 text-green-800'
                      }`}>
                        {notif.priority}
                      </span>
                    </div>
                    <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">{notif.message}</p>
                  </div>
                  <span className="text-xs text-gray-500 whitespace-nowrap ml-4">
                    {new Date(notif.createdAt).toLocaleString()}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* History Tab */}
      {selectedTab === 'history' && (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow">
          <div className="p-4 border-b border-gray-200 dark:border-gray-700">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Evolution History</h2>
            <p className="text-sm text-gray-500">Track how improvement ideas evolve over time</p>
          </div>
          <div className="p-4">
            <div className="space-y-4">
              <div className="border-l-2 border-blue-500 pl-4 py-2">
                <div className="flex items-center gap-2">
                  <span className="font-mono text-sm text-gray-500">SI-0003</span>
                  <span className="text-xs px-2 py-0.5 bg-purple-100 text-purple-800 rounded">expansion</span>
                </div>
                <p className="font-medium text-gray-900 dark:text-white">v2 → v3: Added medical domain specialization</p>
                <p className="text-sm text-gray-600 dark:text-gray-400">Expanded scope to include medical terminology verification</p>
                <p className="text-xs text-gray-500 mt-1">2024-12-25 14:30</p>
              </div>
              <div className="border-l-2 border-yellow-500 pl-4 py-2">
                <div className="flex items-center gap-2">
                  <span className="font-mono text-sm text-gray-500">SI-0005</span>
                  <span className="text-xs px-2 py-0.5 bg-gray-100 text-gray-800 rounded">deprecation</span>
                </div>
                <p className="font-medium text-gray-900 dark:text-white">Deprecated: Superseded by SI-0008</p>
                <p className="text-sm text-gray-600 dark:text-gray-400">More comprehensive approach developed</p>
                <p className="text-xs text-gray-500 mt-1">2024-12-24 10:00</p>
              </div>
              <div className="border-l-2 border-green-500 pl-4 py-2">
                <div className="flex items-center gap-2">
                  <span className="font-mono text-sm text-gray-500">SI-0001</span>
                  <span className="text-xs px-2 py-0.5 bg-blue-100 text-blue-800 rounded">refinement</span>
                </div>
                <p className="font-medium text-gray-900 dark:text-white">v1 → v2: Refined calibration approach</p>
                <p className="text-sm text-gray-600 dark:text-gray-400">Added domain-specific calibration curves</p>
                <p className="text-xs text-gray-500 mt-1">2024-12-23 16:45</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Idea Detail Modal */}
      {selectedIdea && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="p-4 border-b border-gray-200 dark:border-gray-700 flex justify-between items-center sticky top-0 bg-white dark:bg-gray-800">
              <div>
                <span className="font-mono text-sm text-gray-500">{selectedIdea.ideaCode}</span>
                <h2 className="text-xl font-semibold text-gray-900 dark:text-white">{selectedIdea.title}</h2>
              </div>
              <button 
                onClick={() => setSelectedIdea(null)}
                className="text-gray-500 hover:text-gray-700"
              >
                ✕
              </button>
            </div>
            <div className="p-4 space-y-4">
              <div className="flex gap-2 flex-wrap">
                <span className={`px-2 py-1 text-xs rounded-full ${getStatusColor(selectedIdea.status)}`}>
                  {selectedIdea.status.replace('_', ' ')}
                </span>
                <span className={`px-2 py-1 text-xs rounded-full bg-gray-100 text-gray-800`}>
                  {selectedIdea.category}
                </span>
                <span className={`px-2 py-1 text-xs font-medium ${getPriorityColor(selectedIdea.priority)}`}>
                  {selectedIdea.priority} priority
                </span>
                <span className="px-2 py-1 text-xs bg-gray-100 text-gray-800 rounded-full">
                  v{selectedIdea.version}
                </span>
              </div>

              <div>
                <h3 className="font-medium text-gray-900 dark:text-white mb-1">Description</h3>
                <p className="text-gray-600 dark:text-gray-400">{selectedIdea.description}</p>
              </div>

              {selectedIdea.isDeprecated && (
                <div className="p-3 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg">
                  <p className="text-sm font-medium text-yellow-800 dark:text-yellow-200">⚠️ Deprecated</p>
                  <p className="text-sm text-yellow-700 dark:text-yellow-300">{selectedIdea.deprecationReason}</p>
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-gray-500">Confidence Score</p>
                  <div className="flex items-center gap-2">
                    <div className="flex-1 bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                      <div className="bg-blue-500 h-2 rounded-full" style={{ width: `${selectedIdea.confidenceScore * 100}%` }} />
                    </div>
                    <span className="font-medium">{(selectedIdea.confidenceScore * 100).toFixed(0)}%</span>
                  </div>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Impact Score</p>
                  <div className="flex items-center gap-2">
                    <div className="flex-1 bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                      <div className="bg-green-500 h-2 rounded-full" style={{ width: `${(selectedIdea.impactScore || 0) * 100}%` }} />
                    </div>
                    <span className="font-medium">{((selectedIdea.impactScore || 0) * 100).toFixed(0)}%</span>
                  </div>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Feasibility Score</p>
                  <div className="flex items-center gap-2">
                    <div className="flex-1 bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                      <div className="bg-purple-500 h-2 rounded-full" style={{ width: `${(selectedIdea.feasibilityScore || 0) * 100}%` }} />
                    </div>
                    <span className="font-medium">{((selectedIdea.feasibilityScore || 0) * 100).toFixed(0)}%</span>
                  </div>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Composite Score</p>
                  <div className="flex items-center gap-2">
                    <div className="flex-1 bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                      <div className="bg-orange-500 h-2 rounded-full" style={{ width: `${selectedIdea.compositeScore * 100}%` }} />
                    </div>
                    <span className="font-medium">{(selectedIdea.compositeScore * 100).toFixed(0)}%</span>
                  </div>
                </div>
              </div>

              <div className="flex gap-2 pt-4 border-t border-gray-200 dark:border-gray-700">
                {!selectedIdea.isDeprecated && (
                  <>
                    <button className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700">
                      Approve
                    </button>
                    <button className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
                      Evolve Idea
                    </button>
                    <button className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700">
                      Deprecate
                    </button>
                  </>
                )}
                <button 
                  onClick={() => setSelectedIdea(null)}
                  className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 ml-auto"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
