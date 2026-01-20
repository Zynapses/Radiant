'use client';

import React, { useState, useEffect } from 'react';

interface Principle {
  principleId: string;
  principleNumber: number;
  title: string;
  principleText: string;
  explanation: string;
  positiveBehaviors: string[];
  negativeBehaviors: string[];
  category: string;
  priority: number;
  isAbsolute: boolean;
  isDefault: boolean;
  isActive: boolean;
}

interface MoralSettings {
  enforcementMode: string;
  conflictResolution: string;
  explainMoralReasoning: boolean;
  logMoralDecisions: boolean;
  allowSituationalOverride: boolean;
  requireOverrideJustification: boolean;
  notifyOnMoralConflict: boolean;
  notifyOnPrincipleViolation: boolean;
}

interface DecisionLogEntry {
  id: string;
  situation: string;
  decision: string;
  principle: string;
  confidence: number;
  timestamp: string;
}


const defaultSettings: MoralSettings = {
  enforcementMode: 'strict',
  conflictResolution: 'priority_based',
  explainMoralReasoning: true,
  logMoralDecisions: true,
  allowSituationalOverride: false,
  requireOverrideJustification: true,
  notifyOnMoralConflict: true,
  notifyOnPrincipleViolation: true,
};

export default function MoralCompassPage() {
  const [selectedTab, setSelectedTab] = useState<'principles' | 'settings' | 'decisions' | 'history'>('principles');
  const [principles, setPrinciples] = useState<Principle[]>([]);
  const [settings, setSettings] = useState<MoralSettings>(defaultSettings);
  const [decisionLog, setDecisionLog] = useState<DecisionLogEntry[]>([]);
  const [selectedPrinciple, setSelectedPrinciple] = useState<Principle | null>(null);
  const [editMode, setEditMode] = useState(false);
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadData() {
      setLoading(true);
      setError(null);
      try {
        const API = process.env.NEXT_PUBLIC_API_URL || '';
        const [principlesRes, settingsRes, decisionsRes] = await Promise.all([
          fetch(`${API}/api/admin/moral-compass/principles`),
          fetch(`${API}/api/admin/moral-compass/settings`),
          fetch(`${API}/api/admin/moral-compass/decisions`),
        ]);
        if (principlesRes.ok) { const { data } = await principlesRes.json(); setPrinciples(data || []); }
        else setError('Failed to load moral compass data.');
        if (settingsRes.ok) { const { data } = await settingsRes.json(); setSettings(data || defaultSettings); }
        if (decisionsRes.ok) { const { data } = await decisionsRes.json(); setDecisionLog(data || []); }
      } catch { setError('Failed to connect to moral compass service.'); }
      setLoading(false);
    }
    loadData();
  }, []);

  if (loading) return <div className="flex items-center justify-center h-96"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600" /></div>;
  if (error) return <div className="flex flex-col items-center justify-center h-96 text-red-500"><p className="text-lg font-medium">Error</p><p className="text-sm">{error}</p></div>;

  const getCategoryColor = (category: string) => {
    switch (category) {
      case 'treatment_of_others': return 'bg-pink-100 text-pink-800 dark:bg-pink-900 dark:text-pink-200';
      case 'honesty': return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200';
      case 'humility': return 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200';
      case 'service': return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200';
      case 'integrity': return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200';
      case 'restraint': return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getPriorityStars = (priority: number) => {
    const stars = Math.ceil(priority / 2);
    return '★'.repeat(stars) + '☆'.repeat(5 - stars);
  };

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">AGI Moral Compass</h1>
          <p className="text-gray-600 dark:text-gray-400">Ethical principles guiding AGI behavior and decision-making</p>
        </div>
        <div className="flex gap-2">
          <button 
            onClick={() => setShowResetConfirm(true)}
            className="px-4 py-2 border border-orange-300 text-orange-700 rounded-lg hover:bg-orange-50 dark:hover:bg-orange-900/20 transition-colors"
          >
            Reset to Defaults
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-gray-800 rounded-lg p-4 shadow">
          <p className="text-sm text-gray-500">Total Principles</p>
          <p className="text-2xl font-bold text-gray-900 dark:text-white">{principles.length}</p>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-lg p-4 shadow">
          <p className="text-sm text-gray-500">Absolute (Unchangeable)</p>
          <p className="text-2xl font-bold text-red-600">{principles.filter(p => p.isAbsolute).length}</p>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-lg p-4 shadow">
          <p className="text-sm text-gray-500">Active</p>
          <p className="text-2xl font-bold text-green-600">{principles.filter(p => p.isActive).length}</p>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-lg p-4 shadow">
          <p className="text-sm text-gray-500">Enforcement Mode</p>
          <p className="text-2xl font-bold text-blue-600 capitalize">{settings.enforcementMode}</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200 dark:border-gray-700">
        <nav className="flex gap-4">
          {['principles', 'settings', 'decisions', 'history'].map((tab) => (
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
            </button>
          ))}
        </nav>
      </div>

      {/* Principles Tab */}
      {selectedTab === 'principles' && (
        <div className="space-y-4">
          {principles.map((principle) => (
            <div 
              key={principle.principleId}
              className={`bg-white dark:bg-gray-800 rounded-lg shadow p-4 cursor-pointer hover:shadow-lg transition-shadow ${
                principle.isAbsolute ? 'border-l-4 border-red-500' : ''
              }`}
              onClick={() => setSelectedPrinciple(principle)}
            >
              <div className="flex items-start justify-between mb-2">
                <div className="flex items-center gap-3">
                  <span className="text-2xl font-bold text-gray-300 dark:text-gray-600">
                    {principle.principleNumber}
                  </span>
                  <div>
                    <h3 className="font-semibold text-gray-900 dark:text-white">{principle.title}</h3>
                    <div className="flex items-center gap-2 mt-1">
                      <span className={`px-2 py-0.5 text-xs rounded-full ${getCategoryColor(principle.category)}`}>
                        {principle.category.replace('_', ' ')}
                      </span>
                      {principle.isAbsolute && (
                        <span className="px-2 py-0.5 text-xs bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200 rounded-full">
                          Absolute
                        </span>
                      )}
                      <span className="text-yellow-500 text-sm" title={`Priority: ${principle.priority}/10`}>
                        {getPriorityStars(principle.priority)}
                      </span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {!principle.isActive && (
                    <span className="px-2 py-1 text-xs bg-gray-100 text-gray-600 rounded">Disabled</span>
                  )}
                  <button className="text-gray-400 hover:text-gray-600">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </button>
                </div>
              </div>
              <p className="text-gray-600 dark:text-gray-400 text-sm line-clamp-2">
                {principle.principleText}
              </p>
            </div>
          ))}
        </div>
      )}

      {/* Settings Tab */}
      {selectedTab === 'settings' && (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow">
          <div className="p-4 border-b border-gray-200 dark:border-gray-700">
            <h2 className="text-lg font-semibold">Moral Compass Settings</h2>
            <p className="text-sm text-gray-500">Configure how ethical principles are enforced</p>
          </div>
          <div className="p-4 space-y-6">
            {/* Enforcement Mode */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Enforcement Mode
              </label>
              <select 
                value={settings.enforcementMode}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900"
              >
                <option value="strict">Strict - Always enforce principles</option>
                <option value="balanced">Balanced - Enforce with flexibility</option>
                <option value="advisory">Advisory - Suggest but allow override</option>
              </select>
              <p className="text-xs text-gray-500 mt-1">
                Strict mode will refuse requests that violate principles. Advisory mode will warn but allow.
              </p>
            </div>

            {/* Conflict Resolution */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Conflict Resolution
              </label>
              <select 
                value={settings.conflictResolution}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900"
              >
                <option value="priority_based">Priority Based - Higher priority wins</option>
                <option value="most_restrictive">Most Restrictive - Choose safest option</option>
                <option value="ask_user">Ask User - Request clarification</option>
              </select>
            </div>

            {/* Toggles */}
            <div className="space-y-4">
              {[
                { key: 'explainMoralReasoning', label: 'Explain Moral Reasoning', desc: 'Include ethical reasoning in responses when relevant' },
                { key: 'logMoralDecisions', label: 'Log Moral Decisions', desc: 'Record all ethical evaluations for audit' },
                { key: 'allowSituationalOverride', label: 'Allow Situational Override', desc: 'Permit exceptions in extreme circumstances' },
                { key: 'requireOverrideJustification', label: 'Require Override Justification', desc: 'Must explain why overriding a principle' },
                { key: 'notifyOnMoralConflict', label: 'Notify on Moral Conflict', desc: 'Alert admin when principles conflict' },
                { key: 'notifyOnPrincipleViolation', label: 'Notify on Principle Violation', desc: 'Alert admin when a principle is violated' },
              ].map(({ key, label, desc }) => (
                <div key={key} className="flex items-center justify-between py-2">
                  <div>
                    <p className="font-medium text-gray-900 dark:text-white">{label}</p>
                    <p className="text-sm text-gray-500">{desc}</p>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input 
                      type="checkbox" 
                      checked={(settings as unknown as Record<string, boolean | string>)[key] as boolean}
                      className="sr-only peer" 
                      readOnly 
                    />
                    <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 dark:peer-focus:ring-blue-800 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-blue-600"></div>
                  </label>
                </div>
              ))}
            </div>

            <div className="pt-4 border-t border-gray-200 dark:border-gray-700">
              <button className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
                Save Settings
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Decisions Tab */}
      {selectedTab === 'decisions' && (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow">
          <div className="p-4 border-b border-gray-200 dark:border-gray-700">
            <h2 className="text-lg font-semibold">Recent Moral Decisions</h2>
            <p className="text-sm text-gray-500">Log of ethical evaluations made by the AGI</p>
          </div>
          <div className="divide-y divide-gray-200 dark:divide-gray-700">
            {decisionLog.map((decision) => (
              <div key={decision.id} className="p-4">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <p className="font-medium text-gray-900 dark:text-white">{decision.situation}</p>
                    <div className="flex items-center gap-3 mt-2">
                      <span className={`px-2 py-1 text-xs rounded-full ${
                        decision.decision === 'proceed' ? 'bg-green-100 text-green-800' :
                        decision.decision === 'refuse' ? 'bg-red-100 text-red-800' :
                        'bg-yellow-100 text-yellow-800'
                      }`}>
                        {decision.decision}
                      </span>
                      <span className="text-sm text-gray-500">
                        Primary principle: {decision.principle}
                      </span>
                      <span className="text-sm text-gray-500">
                        Confidence: {Math.round(decision.confidence * 100)}%
                      </span>
                    </div>
                  </div>
                  <span className="text-xs text-gray-500">
                    {new Date(decision.timestamp).toLocaleString()}
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
            <h2 className="text-lg font-semibold">Modification History</h2>
            <p className="text-sm text-gray-500">Track all changes to moral principles</p>
          </div>
          <div className="p-8 text-center text-gray-500">
            <p>No modifications have been made yet.</p>
            <p className="text-sm mt-2">All principles are at their default values.</p>
          </div>
        </div>
      )}

      {/* Principle Detail Modal */}
      {selectedPrinciple && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="p-4 border-b border-gray-200 dark:border-gray-700 flex justify-between items-center sticky top-0 bg-white dark:bg-gray-800">
              <div className="flex items-center gap-3">
                <span className="text-3xl font-bold text-gray-300">{selectedPrinciple.principleNumber}</span>
                <div>
                  <h2 className="text-xl font-semibold text-gray-900 dark:text-white">{selectedPrinciple.title}</h2>
                  <div className="flex items-center gap-2 mt-1">
                    <span className={`px-2 py-0.5 text-xs rounded-full ${getCategoryColor(selectedPrinciple.category)}`}>
                      {selectedPrinciple.category.replace('_', ' ')}
                    </span>
                    {selectedPrinciple.isAbsolute && (
                      <span className="px-2 py-0.5 text-xs bg-red-100 text-red-800 rounded-full">
                        Absolute - Cannot be modified
                      </span>
                    )}
                  </div>
                </div>
              </div>
              <button 
                onClick={() => { setSelectedPrinciple(null); setEditMode(false); }}
                className="text-gray-500 hover:text-gray-700"
              >
                ✕
              </button>
            </div>

            <div className="p-4 space-y-4">
              {/* Principle Text */}
              <div>
                <h3 className="font-medium text-gray-900 dark:text-white mb-2">The Principle</h3>
                {editMode && !selectedPrinciple.isAbsolute ? (
                  <textarea 
                    defaultValue={selectedPrinciple.principleText}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 h-24"
                  />
                ) : (
                  <p className="text-gray-600 dark:text-gray-400 p-3 bg-gray-50 dark:bg-gray-900 rounded-lg">
                    {selectedPrinciple.principleText}
                  </p>
                )}
              </div>

              {/* Explanation */}
              <div>
                <h3 className="font-medium text-gray-900 dark:text-white mb-2">Explanation</h3>
                <p className="text-gray-600 dark:text-gray-400 text-sm">
                  {selectedPrinciple.explanation}
                </p>
              </div>

              {/* Priority */}
              <div>
                <h3 className="font-medium text-gray-900 dark:text-white mb-2">Priority Level</h3>
                <div className="flex items-center gap-4">
                  <span className="text-2xl text-yellow-500">{getPriorityStars(selectedPrinciple.priority)}</span>
                  <span className="text-gray-600 dark:text-gray-400">{selectedPrinciple.priority}/10</span>
                  {editMode && !selectedPrinciple.isAbsolute && (
                    <input 
                      type="range" 
                      min="1" 
                      max="10" 
                      defaultValue={selectedPrinciple.priority}
                      className="flex-1"
                    />
                  )}
                </div>
              </div>

              {/* Positive Behaviors */}
              <div>
                <h3 className="font-medium text-gray-900 dark:text-white mb-2">✓ Positive Behaviors (Do)</h3>
                <ul className="space-y-1">
                  {selectedPrinciple.positiveBehaviors.map((behavior, idx) => (
                    <li key={idx} className="text-sm text-green-700 dark:text-green-400 flex items-center gap-2">
                      <span className="text-green-500">✓</span> {behavior}
                    </li>
                  ))}
                </ul>
              </div>

              {/* Negative Behaviors */}
              <div>
                <h3 className="font-medium text-gray-900 dark:text-white mb-2">✗ Negative Behaviors (Don&apos;t)</h3>
                <ul className="space-y-1">
                  {selectedPrinciple.negativeBehaviors.map((behavior, idx) => (
                    <li key={idx} className="text-sm text-red-700 dark:text-red-400 flex items-center gap-2">
                      <span className="text-red-500">✗</span> {behavior}
                    </li>
                  ))}
                </ul>
              </div>

              {/* Actions */}
              <div className="flex gap-2 pt-4 border-t border-gray-200 dark:border-gray-700">
                {!selectedPrinciple.isAbsolute && (
                  <>
                    {editMode ? (
                      <>
                        <button className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
                          Save Changes
                        </button>
                        <button 
                          onClick={() => setEditMode(false)}
                          className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700"
                        >
                          Cancel
                        </button>
                      </>
                    ) : (
                      <button 
                        onClick={() => setEditMode(true)}
                        className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                      >
                        Edit Principle
                      </button>
                    )}
                    <button className="px-4 py-2 border border-orange-300 text-orange-700 rounded-lg hover:bg-orange-50">
                      Restore Default
                    </button>
                  </>
                )}
                {selectedPrinciple.isAbsolute && (
                  <p className="text-sm text-gray-500 italic">
                    This is an absolute principle and cannot be modified.
                  </p>
                )}
                <button 
                  onClick={() => { setSelectedPrinciple(null); setEditMode(false); }}
                  className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 ml-auto"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Reset Confirmation Modal */}
      {showResetConfirm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl p-6 max-w-md">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">Reset to Defaults?</h3>
            <p className="text-gray-600 dark:text-gray-400 mb-4">
              This will restore all moral principles to their original default values. Any customizations you have made will be lost.
            </p>
            <p className="text-sm text-orange-600 dark:text-orange-400 mb-4">
              This action can be undone by restoring individual principles from history.
            </p>
            <div className="flex gap-2 justify-end">
              <button 
                onClick={() => setShowResetConfirm(false)}
                className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                Cancel
              </button>
              <button 
                onClick={() => setShowResetConfirm(false)}
                className="px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700"
              >
                Reset All
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
