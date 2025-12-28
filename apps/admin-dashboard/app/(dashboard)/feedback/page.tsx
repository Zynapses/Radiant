'use client';

import React, { useState, useEffect } from 'react';

interface FeedbackStats { totalFeedback: number; thumbsUp: number; thumbsDown: number; avgRating: number; positiveRatio: number; commentsCount: number; feedbackToday: number; }
interface RecentFeedback { id: string; type: string; thumbs: 'up' | 'down'; rating: number; comment: string | null; model: string; time: string; prompt: string; }
interface ModelFeedback { model: string; total: number; up: number; down: number; ratio: number; }
interface TopIssue { issue: string; count: number; }
interface ThinkTankFeedback { id: string; topic: string; rating: number; thumbs: 'up' | 'down'; bestAI: string; comment: string | null; goalAchieved: boolean; }

export default function FeedbackPage() {
  const [selectedTab, setSelectedTab] = useState<'overview' | 'recent' | 'models' | 'think_tank' | 'issues'>('overview');
  const [filterType, setFilterType] = useState<'all' | 'up' | 'down'>('all');
  const [stats, setStats] = useState<FeedbackStats | null>(null);
  const [recentFeedback, setRecentFeedback] = useState<RecentFeedback[]>([]);
  const [modelFeedback, setModelFeedback] = useState<ModelFeedback[]>([]);
  const [topIssues, setTopIssues] = useState<TopIssue[]>([]);
  const [thinkTankFeedback, setThinkTankFeedback] = useState<ThinkTankFeedback[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => { loadData(); }, []);

  async function loadData() {
    setLoading(true);
    setError(null);
    try {
      const API = process.env.NEXT_PUBLIC_API_URL || '';
      const [statsRes, recentRes, modelsRes, issuesRes, thinkTankRes] = await Promise.all([
        fetch(`${API}/admin/feedback/stats`),
        fetch(`${API}/admin/feedback/recent`),
        fetch(`${API}/admin/feedback/by-model`),
        fetch(`${API}/admin/feedback/issues`),
        fetch(`${API}/admin/feedback/think-tank`),
      ]);
      if (statsRes.ok) { const { data } = await statsRes.json(); setStats(data); }
      else setError('Failed to load feedback data.');
      if (recentRes.ok) { const { data } = await recentRes.json(); setRecentFeedback(data || []); }
      if (modelsRes.ok) { const { data } = await modelsRes.json(); setModelFeedback(data || []); }
      if (issuesRes.ok) { const { data } = await issuesRes.json(); setTopIssues(data || []); }
      if (thinkTankRes.ok) { const { data } = await thinkTankRes.json(); setThinkTankFeedback(data || []); }
    } catch { setError('Failed to connect to feedback service.'); }
    setLoading(false);
  }

  if (loading) return <div className="flex items-center justify-center h-96"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" /></div>;
  if (error) return <div className="flex flex-col items-center justify-center h-96 text-red-500"><p className="text-lg font-medium">Error</p><p className="text-sm">{error}</p><button onClick={loadData} className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg">Retry</button></div>;
  if (!stats) return <div className="flex items-center justify-center h-96 text-gray-500">No feedback data available</div>;

  const filteredFeedback = recentFeedback.filter(f => filterType === 'all' || f.thumbs === filterType);

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Feedback Registry</h1>
          <p className="text-gray-600 dark:text-gray-400">All user feedback for continuous learning</p>
        </div>
        <div className="flex gap-2">
          <button className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors">
            Export Feedback
          </button>
          <button className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
            Run Aggregations
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-4">
        <div className="bg-white dark:bg-gray-800 rounded-lg p-4 shadow">
          <p className="text-xs text-gray-500">Total Feedback</p>
          <p className="text-xl font-bold text-gray-900 dark:text-white">{stats.totalFeedback.toLocaleString()}</p>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-lg p-4 shadow">
          <p className="text-xs text-gray-500">👍 Thumbs Up</p>
          <p className="text-xl font-bold text-green-600">{stats.thumbsUp.toLocaleString()}</p>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-lg p-4 shadow">
          <p className="text-xs text-gray-500">👎 Thumbs Down</p>
          <p className="text-xl font-bold text-red-600">{stats.thumbsDown.toLocaleString()}</p>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-lg p-4 shadow">
          <p className="text-xs text-gray-500">Positive Ratio</p>
          <p className="text-xl font-bold text-blue-600">{Math.round(stats.positiveRatio * 100)}%</p>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-lg p-4 shadow">
          <p className="text-xs text-gray-500">Avg Rating</p>
          <p className="text-xl font-bold text-yellow-600">{stats.avgRating.toFixed(1)} ⭐</p>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-lg p-4 shadow">
          <p className="text-xs text-gray-500">With Comments</p>
          <p className="text-xl font-bold text-purple-600">{stats.commentsCount.toLocaleString()}</p>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-lg p-4 shadow">
          <p className="text-xs text-gray-500">Today</p>
          <p className="text-xl font-bold text-orange-600">{stats.feedbackToday.toLocaleString()}</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200 dark:border-gray-700">
        <nav className="flex gap-4 overflow-x-auto">
          {[
            { key: 'overview', label: 'Overview' },
            { key: 'recent', label: 'Recent Feedback' },
            { key: 'models', label: 'By Model' },
            { key: 'think_tank', label: 'Think Tank' },
            { key: 'issues', label: 'Issues & Tags' },
          ].map(tab => (
            <button
              key={tab.key}
              onClick={() => setSelectedTab(tab.key as typeof selectedTab)}
              className={`py-3 px-1 border-b-2 font-medium text-sm whitespace-nowrap transition-colors ${
                selectedTab === tab.key
                  ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                  : 'border-transparent text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      {/* Overview Tab */}
      {selectedTab === 'overview' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Feedback Distribution */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
            <h2 className="text-lg font-semibold mb-4">Feedback Distribution</h2>
            <div className="flex items-center gap-4 mb-4">
              <div className="flex-1">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm text-green-600 font-medium">Positive</span>
                  <span className="text-sm">{Math.round(stats.positiveRatio * 100)}%</span>
                </div>
                <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-green-500"
                    style={{ width: `${stats.positiveRatio * 100}%` }}
                  />
                </div>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4 mt-6">
              <div className="text-center p-4 bg-green-50 dark:bg-green-900/20 rounded-lg">
                <span className="text-4xl">👍</span>
                <p className="text-2xl font-bold text-green-600 mt-2">{stats.thumbsUp.toLocaleString()}</p>
                <p className="text-sm text-gray-500">Positive</p>
              </div>
              <div className="text-center p-4 bg-red-50 dark:bg-red-900/20 rounded-lg">
                <span className="text-4xl">👎</span>
                <p className="text-2xl font-bold text-red-600 mt-2">{stats.thumbsDown.toLocaleString()}</p>
                <p className="text-sm text-gray-500">Negative</p>
              </div>
            </div>
          </div>

          {/* How Feedback Improves Radiant */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
            <h2 className="text-lg font-semibold mb-4">How Feedback Improves Radiant</h2>
            <div className="space-y-3 text-sm">
              <div className="flex items-start gap-3 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                <span className="text-xl">👍👎</span>
                <div>
                  <p className="font-medium">Thumbs Up/Down</p>
                  <p className="text-gray-500">Updates routing model - learn which AI is best for which tasks</p>
                </div>
              </div>
              <div className="flex items-start gap-3 p-3 bg-purple-50 dark:bg-purple-900/20 rounded-lg">
                <span className="text-xl">💬</span>
                <div>
                  <p className="font-medium">Comments</p>
                  <p className="text-gray-500">Identify specific issues - improve prompts and quality checks</p>
                </div>
              </div>
              <div className="flex items-start gap-3 p-3 bg-green-50 dark:bg-green-900/20 rounded-lg">
                <span className="text-xl">⭐</span>
                <div>
                  <p className="font-medium">Ratings</p>
                  <p className="text-gray-500">Fine-grained quality signals - train better synthesis</p>
                </div>
              </div>
              <div className="flex items-start gap-3 p-3 bg-orange-50 dark:bg-orange-900/20 rounded-lg">
                <span className="text-xl">🏷️</span>
                <div>
                  <p className="font-medium">Issue Tags</p>
                  <p className="text-gray-500">Categorize problems - target specific improvements</p>
                </div>
              </div>
            </div>
          </div>

          {/* Recent Activity */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4 lg:col-span-2">
            <h2 className="text-lg font-semibold mb-4">Recent Feedback Activity</h2>
            <div className="space-y-2">
              {recentFeedback.slice(0, 5).map(fb => (
                <div key={fb.id} className="flex items-center justify-between py-2 border-b border-gray-200 dark:border-gray-700 last:border-0">
                  <div className="flex items-center gap-3">
                    <span className={`text-xl ${fb.thumbs === 'up' ? 'text-green-500' : 'text-red-500'}`}>
                      {fb.thumbs === 'up' ? '👍' : '👎'}
                    </span>
                    <div>
                      <p className="font-medium text-sm truncate max-w-md">{fb.prompt}</p>
                      <p className="text-xs text-gray-500">{fb.model} • {fb.time}</p>
                    </div>
                  </div>
                  {fb.comment && (
                    <span className="text-xs bg-gray-100 dark:bg-gray-700 px-2 py-1 rounded">
                      {fb.comment.substring(0, 30)}...
                    </span>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Recent Feedback Tab */}
      {selectedTab === 'recent' && (
        <div className="space-y-4">
          {/* Filter */}
          <div className="flex gap-2">
            <button 
              onClick={() => setFilterType('all')}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                filterType === 'all' 
                  ? 'bg-blue-600 text-white' 
                  : 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300'
              }`}
            >
              All
            </button>
            <button 
              onClick={() => setFilterType('up')}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                filterType === 'up' 
                  ? 'bg-green-600 text-white' 
                  : 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300'
              }`}
            >
              👍 Positive
            </button>
            <button 
              onClick={() => setFilterType('down')}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                filterType === 'down' 
                  ? 'bg-red-600 text-white' 
                  : 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300'
              }`}
            >
              👎 Negative
            </button>
          </div>

          {/* Feedback List */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden">
            <table className="w-full">
              <thead className="bg-gray-50 dark:bg-gray-900">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Feedback</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Prompt</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Model</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Rating</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Comment</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Time</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                {filteredFeedback.map(fb => (
                  <tr key={fb.id} className="hover:bg-gray-50 dark:hover:bg-gray-900">
                    <td className="px-4 py-3">
                      <span className={`text-2xl ${fb.thumbs === 'up' ? 'text-green-500' : 'text-red-500'}`}>
                        {fb.thumbs === 'up' ? '👍' : '👎'}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <p className="text-sm font-medium truncate max-w-xs">{fb.prompt}</p>
                      <span className="text-xs text-gray-500">{fb.type}</span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-sm">{fb.model}</span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-yellow-500">{'★'.repeat(fb.rating)}{'☆'.repeat(5 - fb.rating)}</span>
                    </td>
                    <td className="px-4 py-3">
                      {fb.comment ? (
                        <span className="text-sm text-gray-600 dark:text-gray-400">{fb.comment}</span>
                      ) : (
                        <span className="text-sm text-gray-400">-</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-500">{fb.time}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* By Model Tab */}
      {selectedTab === 'models' && (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow">
          <div className="p-4 border-b border-gray-200 dark:border-gray-700">
            <h2 className="text-lg font-semibold">Feedback by Model</h2>
            <p className="text-sm text-gray-500">How each model is performing based on user feedback</p>
          </div>
          <div className="p-4">
            <table className="w-full">
              <thead>
                <tr className="text-left text-xs text-gray-500 uppercase">
                  <th className="pb-3">Model</th>
                  <th className="pb-3">Total Feedback</th>
                  <th className="pb-3">👍 Up</th>
                  <th className="pb-3">👎 Down</th>
                  <th className="pb-3">Positive Ratio</th>
                  <th className="pb-3">Distribution</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                {modelFeedback.map(model => (
                  <tr key={model.model}>
                    <td className="py-3 font-medium">{model.model}</td>
                    <td className="py-3">{model.total.toLocaleString()}</td>
                    <td className="py-3 text-green-600">{model.up.toLocaleString()}</td>
                    <td className="py-3 text-red-600">{model.down.toLocaleString()}</td>
                    <td className="py-3">
                      <span className={`font-medium ${model.ratio >= 0.85 ? 'text-green-600' : 'text-yellow-600'}`}>
                        {Math.round(model.ratio * 100)}%
                      </span>
                    </td>
                    <td className="py-3 w-48">
                      <div className="flex h-4 rounded-full overflow-hidden bg-gray-200 dark:bg-gray-700">
                        <div className="bg-green-500" style={{ width: `${model.ratio * 100}%` }} />
                        <div className="bg-red-500" style={{ width: `${(1 - model.ratio) * 100}%` }} />
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Think Tank Tab */}
      {selectedTab === 'think_tank' && (
        <div className="space-y-6">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow">
            <div className="p-4 border-b border-gray-200 dark:border-gray-700">
              <h2 className="text-lg font-semibold">Think Tank Feedback</h2>
              <p className="text-sm text-gray-500">Feedback on multi-AI conversations</p>
            </div>
            <div className="p-4">
              <table className="w-full">
                <thead>
                  <tr className="text-left text-xs text-gray-500 uppercase">
                    <th className="pb-3">Topic</th>
                    <th className="pb-3">Feedback</th>
                    <th className="pb-3">Rating</th>
                    <th className="pb-3">Best AI</th>
                    <th className="pb-3">Goal Achieved</th>
                    <th className="pb-3">Comment</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                  {thinkTankFeedback.map(fb => (
                    <tr key={fb.id}>
                      <td className="py-3 font-medium">{fb.topic}</td>
                      <td className="py-3">
                        <span className={`text-xl ${fb.thumbs === 'up' ? 'text-green-500' : 'text-red-500'}`}>
                          {fb.thumbs === 'up' ? '👍' : '👎'}
                        </span>
                      </td>
                      <td className="py-3">
                        <span className="text-yellow-500">{'★'.repeat(fb.rating)}{'☆'.repeat(5 - fb.rating)}</span>
                      </td>
                      <td className="py-3 text-sm">{fb.bestAI}</td>
                      <td className="py-3">
                        {fb.goalAchieved ? (
                          <span className="text-green-600">✓ Yes</span>
                        ) : (
                          <span className="text-red-600">✗ No</span>
                        )}
                      </td>
                      <td className="py-3 text-sm text-gray-500">{fb.comment || '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-4">
            <h3 className="font-medium text-blue-800 dark:text-blue-200 mb-2">Think Tank Feedback Captures</h3>
            <ul className="text-sm text-blue-700 dark:text-blue-300 space-y-1">
              <li>• Which AI participant was most helpful</li>
              <li>• Whether the collaborative goal was achieved</li>
              <li>• Individual ratings for each AI participant</li>
              <li>• Suggestions for improving multi-AI conversations</li>
            </ul>
          </div>
        </div>
      )}

      {/* Issues Tab */}
      {selectedTab === 'issues' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
            <h2 className="text-lg font-semibold mb-4">Top Issues Reported</h2>
            <div className="space-y-3">
              {topIssues.map((issue, idx) => (
                <div key={issue.issue} className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className="w-6 h-6 bg-red-100 text-red-800 rounded-full flex items-center justify-center text-xs font-bold">
                      {idx + 1}
                    </span>
                    <span className="font-medium">{issue.issue}</span>
                  </div>
                  <span className="text-gray-500">{issue.count} reports</span>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
            <h2 className="text-lg font-semibold mb-4">Feedback Tags Cloud</h2>
            <div className="flex flex-wrap gap-2">
              {[
                { tag: 'accurate', count: 1234, positive: true },
                { tag: 'helpful', count: 1156, positive: true },
                { tag: 'clear', count: 987, positive: true },
                { tag: 'too_long', count: 456, positive: false },
                { tag: 'perfect', count: 423, positive: true },
                { tag: 'fast', count: 398, positive: true },
                { tag: 'incomplete', count: 234, positive: false },
                { tag: 'wrong', count: 189, positive: false },
                { tag: 'creative', count: 167, positive: true },
                { tag: 'confusing', count: 145, positive: false },
              ].map(tag => (
                <span 
                  key={tag.tag}
                  className={`px-3 py-1 rounded-full text-sm ${
                    tag.positive 
                      ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200' 
                      : 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'
                  }`}
                  style={{ fontSize: `${Math.max(12, Math.min(20, 10 + tag.count / 100))}px` }}
                >
                  {tag.tag} ({tag.count})
                </span>
              ))}
            </div>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4 lg:col-span-2">
            <h2 className="text-lg font-semibold mb-4">Issue Resolution Actions</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="p-4 border border-gray-200 dark:border-gray-700 rounded-lg">
                <p className="font-medium">Too Verbose</p>
                <p className="text-sm text-gray-500 mt-1">234 reports</p>
                <p className="text-sm text-blue-600 mt-2">→ Adjust prompts to request concise responses</p>
              </div>
              <div className="p-4 border border-gray-200 dark:border-gray-700 rounded-lg">
                <p className="font-medium">Factual Errors</p>
                <p className="text-sm text-gray-500 mt-1">189 reports</p>
                <p className="text-sm text-blue-600 mt-2">→ Increase verification steps, use o1 for facts</p>
              </div>
              <div className="p-4 border border-gray-200 dark:border-gray-700 rounded-lg">
                <p className="font-medium">Incomplete Answers</p>
                <p className="text-sm text-gray-500 mt-1">156 reports</p>
                <p className="text-sm text-blue-600 mt-2">→ Use synthesis strategy for complex questions</p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
