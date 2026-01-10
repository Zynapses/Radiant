'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { formatDistanceToNow, parseISO } from 'date-fns';
import {
  CheckCircle,
  XCircle,
  Edit2,
  Trash2,
  RefreshCw,
  Search,
  Filter,
  AlertTriangle,
  Database,
  Clock,
  Users,
  Tag,
} from 'lucide-react';

// ============================================================================
// TYPES
// ============================================================================

interface ResolvedDecision {
  id: string;
  question: string;
  answer: string;
  answerSource: 'user' | 'memory' | 'default' | 'inferred';
  confidence: number;
  isValid: boolean;
  topic?: string;
  timesReused: number;
  createdAt: string;
  expiresAt?: string;
  invalidatedAt?: string;
  invalidationReason?: string;
}

interface FactsPanelProps {
  onEditFact?: (fact: ResolvedDecision) => void;
}

// ============================================================================
// HELPER COMPONENTS
// ============================================================================

const SourceBadge: React.FC<{ source: string }> = ({ source }) => {
  const colors: Record<string, string> = {
    user: 'bg-green-100 text-green-800',
    memory: 'bg-blue-100 text-blue-800',
    default: 'bg-gray-100 text-gray-800',
    inferred: 'bg-purple-100 text-purple-800',
  };

  return (
    <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${colors[source] || colors.default}`}>
      {source}
    </span>
  );
};

const ConfidenceBar: React.FC<{ confidence: number }> = ({ confidence }) => {
  const percentage = confidence * 100;
  let color = 'bg-green-500';
  if (percentage < 70) color = 'bg-yellow-500';
  if (percentage < 50) color = 'bg-red-500';

  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-2 bg-gray-200 rounded-full overflow-hidden">
        <div
          className={`h-full ${color} transition-all duration-300`}
          style={{ width: `${percentage}%` }}
        />
      </div>
      <span className="text-xs text-gray-500 w-10">{percentage.toFixed(0)}%</span>
    </div>
  );
};

// ============================================================================
// FACT CARD
// ============================================================================

interface FactCardProps {
  fact: ResolvedDecision;
  onEdit: () => void;
  onInvalidate: () => void;
}

const FactCard: React.FC<FactCardProps> = ({ fact, onEdit, onInvalidate }) => {
  return (
    <div
      className={`
        p-4 border rounded-lg bg-white transition-all duration-200
        ${fact.isValid ? 'border-gray-200 hover:border-gray-300 hover:shadow-sm' : 'border-red-200 bg-red-50 opacity-75'}
      `}
    >
      <div className="flex items-start justify-between gap-2 mb-3">
        <div className="flex items-center gap-2 flex-wrap">
          <SourceBadge source={fact.answerSource} />
          {fact.topic && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs bg-gray-100 text-gray-600 rounded-full">
              <Tag className="w-3 h-3" />
              {fact.topic}
            </span>
          )}
          {!fact.isValid && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs bg-red-100 text-red-800 rounded-full">
              <XCircle className="w-3 h-3" />
              Invalid
            </span>
          )}
        </div>
        <div className="flex items-center gap-1">
          {fact.isValid && (
            <>
              <button
                onClick={onEdit}
                className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors"
                title="Edit answer"
              >
                <Edit2 className="w-4 h-4" />
              </button>
              <button
                onClick={onInvalidate}
                className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                title="Invalidate (revoke) this fact"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </>
          )}
        </div>
      </div>

      <div className="mb-3">
        <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">Question</p>
        <p className="text-sm text-gray-900">{fact.question}</p>
      </div>

      <div className="mb-3">
        <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">Answer</p>
        <p className="text-sm text-gray-900 font-medium">{fact.answer}</p>
      </div>

      {!fact.isValid && fact.invalidationReason && (
        <div className="mb-3 p-2 bg-red-100 rounded-lg">
          <p className="text-xs text-red-800">
            <strong>Invalidation reason:</strong> {fact.invalidationReason}
          </p>
        </div>
      )}

      <div className="flex items-center justify-between text-xs text-gray-500">
        <div className="flex items-center gap-3">
          <span className="flex items-center gap-1">
            <Clock className="w-3 h-3" />
            {formatDistanceToNow(parseISO(fact.createdAt), { addSuffix: true })}
          </span>
          <span className="flex items-center gap-1">
            <Users className="w-3 h-3" />
            Reused {fact.timesReused}x
          </span>
        </div>
        <ConfidenceBar confidence={fact.confidence} />
      </div>
    </div>
  );
};

// ============================================================================
// EDIT MODAL
// ============================================================================

interface EditModalProps {
  fact: ResolvedDecision;
  mode: 'edit' | 'invalidate';
  onClose: () => void;
  onSubmit: (data: { newAnswer?: string; reason?: string }) => void;
}

const EditModal: React.FC<EditModalProps> = ({ fact, mode, onClose, onSubmit }) => {
  const [newAnswer, setNewAnswer] = useState(fact.answer);
  const [reason, setReason] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    await onSubmit(mode === 'edit' ? { newAnswer, reason } : { reason });
    setLoading(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-lg mx-4">
        <div className="p-6 border-b border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900">
            {mode === 'edit' ? 'Edit Answer' : 'Invalidate Fact'}
          </h3>
          <p className="text-sm text-gray-500 mt-1">
            {mode === 'edit'
              ? 'Update the answer and notify affected agents'
              : 'Mark this fact as invalid. Agents that received this answer will be notified.'}
          </p>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="p-6 space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Question
              </label>
              <p className="text-sm text-gray-900 bg-gray-50 p-3 rounded-lg">
                {fact.question}
              </p>
            </div>

            {mode === 'edit' && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  New Answer
                </label>
                <textarea
                  value={newAnswer}
                  onChange={(e) => setNewAnswer(e.target.value)}
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  required
                />
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {mode === 'edit' ? 'Reason for change' : 'Invalidation reason'}
              </label>
              <textarea
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                rows={2}
                placeholder={mode === 'edit' ? 'Why is this answer being changed?' : 'Why is this fact being invalidated?'}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                required
              />
            </div>

            {mode === 'invalidate' && (
              <div className="flex items-start gap-2 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                <AlertTriangle className="w-5 h-5 text-yellow-600 flex-shrink-0 mt-0.5" />
                <div className="text-sm text-yellow-800">
                  <p className="font-medium">This action will:</p>
                  <ul className="list-disc ml-4 mt-1 space-y-1">
                    <li>Mark this fact as invalid</li>
                    <li>Notify all agents that received this answer</li>
                    <li>Force agents to re-request this information if needed</li>
                  </ul>
                </div>
              </div>
            )}
          </div>

          <div className="p-6 border-t border-gray-200 flex justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className={`
                px-4 py-2 text-sm font-medium text-white rounded-lg transition-colors
                ${mode === 'edit'
                  ? 'bg-blue-600 hover:bg-blue-700'
                  : 'bg-red-600 hover:bg-red-700'}
                ${loading ? 'opacity-50 cursor-not-allowed' : ''}
              `}
            >
              {loading
                ? 'Processing...'
                : mode === 'edit'
                  ? 'Update Answer'
                  : 'Invalidate Fact'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// ============================================================================
// MAIN PANEL
// ============================================================================

export const FactsPanel: React.FC<FactsPanelProps> = ({ onEditFact }) => {
  const [facts, setFacts] = useState<ResolvedDecision[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [topicFilter, setTopicFilter] = useState('');
  const [includeInvalid, setIncludeInvalid] = useState(false);
  const [editingFact, setEditingFact] = useState<ResolvedDecision | null>(null);
  const [editMode, setEditMode] = useState<'edit' | 'invalidate'>('edit');
  const [topics, setTopics] = useState<string[]>([]);

  const fetchFacts = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (topicFilter) params.set('topic', topicFilter);
      if (includeInvalid) params.set('includeInvalid', 'true');

      const response = await fetch(`/api/admin/blackboard/decisions?${params.toString()}`, {
        headers: { 'Content-Type': 'application/json' },
      });

      if (response.ok) {
        const data = await response.json();
        setFacts(data.data?.decisions || []);
        
        // Extract unique topics
        const uniqueTopics = [...new Set(
          data.data?.decisions
            .map((f: ResolvedDecision) => f.topic)
            .filter(Boolean) as string[]
        )];
        setTopics(uniqueTopics);
      }
    } catch (error) {
      console.error('Failed to fetch facts:', error);
    }
  }, [topicFilter, includeInvalid]);

  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      await fetchFacts();
      setLoading(false);
    };
    loadData();
  }, [fetchFacts]);

  const handleEdit = (fact: ResolvedDecision) => {
    setEditingFact(fact);
    setEditMode('edit');
  };

  const handleInvalidate = (fact: ResolvedDecision) => {
    setEditingFact(fact);
    setEditMode('invalidate');
  };

  const handleSubmitEdit = async (data: { newAnswer?: string; reason?: string }) => {
    if (!editingFact) return;

    try {
      const response = await fetch(`/api/admin/blackboard/decisions/${editingFact.id}/invalidate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          reason: data.reason,
          newAnswer: data.newAnswer,
        }),
      });

      if (response.ok) {
        await fetchFacts();
        setEditingFact(null);
      }
    } catch (error) {
      console.error('Failed to update fact:', error);
    }
  };

  const filteredFacts = facts.filter((fact) => {
    if (search) {
      const searchLower = search.toLowerCase();
      return (
        fact.question.toLowerCase().includes(searchLower) ||
        fact.answer.toLowerCase().includes(searchLower)
      );
    }
    return true;
  });

  return (
    <div className="flex flex-col h-full bg-white">
      <div className="p-4 border-b border-gray-200">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Database className="w-5 h-5 text-gray-500" />
            <h2 className="text-lg font-semibold text-gray-900">Resolved Facts</h2>
            <span className="px-2 py-0.5 text-xs bg-gray-100 text-gray-600 rounded-full">
              {facts.length}
            </span>
          </div>
          <button
            onClick={() => fetchFacts()}
            disabled={loading}
            className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>

        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search facts..."
              className="w-full pl-9 pr-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>

          <select
            value={topicFilter}
            onChange={(e) => setTopicFilter(e.target.value)}
            className="px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          >
            <option value="">All Topics</option>
            {topics.map((topic) => (
              <option key={topic} value={topic}>
                {topic}
              </option>
            ))}
          </select>

          <label className="flex items-center gap-2 px-3 py-2 text-sm border border-gray-300 rounded-lg cursor-pointer hover:bg-gray-50">
            <input
              type="checkbox"
              checked={includeInvalid}
              onChange={(e) => setIncludeInvalid(e.target.checked)}
              className="w-4 h-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500"
            />
            <span className="text-gray-700">Show invalid</span>
          </label>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {loading && facts.length === 0 ? (
          <div className="space-y-3">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="h-32 bg-gray-100 rounded-lg animate-pulse" />
            ))}
          </div>
        ) : filteredFacts.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-gray-500">
            <Database className="w-12 h-12 mb-4 text-gray-300" />
            <p className="text-sm font-medium">No facts found</p>
            <p className="text-xs mt-1">
              {search ? 'Try adjusting your search' : 'Facts will appear here when questions are answered'}
            </p>
          </div>
        ) : (
          filteredFacts.map((fact) => (
            <FactCard
              key={fact.id}
              fact={fact}
              onEdit={() => handleEdit(fact)}
              onInvalidate={() => handleInvalidate(fact)}
            />
          ))
        )}
      </div>

      {editingFact && (
        <EditModal
          fact={editingFact}
          mode={editMode}
          onClose={() => setEditingFact(null)}
          onSubmit={handleSubmitEdit}
        />
      )}
    </div>
  );
};

export default FactsPanel;
