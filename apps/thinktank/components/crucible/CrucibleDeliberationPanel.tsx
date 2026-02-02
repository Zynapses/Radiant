'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  Flame,
  MessageSquare,
  Users,
  ChevronDown,
  ChevronUp,
  AlertTriangle,
  Clock,
  Settings,
  Zap,
} from 'lucide-react';

interface DeliberationEvent {
  questionId: string;
  questionNumber: number;
  questionType: string;
  questionText: string;
  qualityScore?: string;
  askedAt: string;
  askerModel: string;
  targetModel: string;
  answer?: {
    answerId: string;
    answerText: string;
    circularCitationDetected: boolean;
    answeredAt: string;
  };
}

interface CrucibleConfig {
  maxQuestions: number;
  costMode: string;
  enabled: boolean;
  visible: boolean;
  source: string;
  canOverride: boolean;
}

interface CrucibleDeliberationPanelProps {
  sessionId?: string;
  methodId: string;
  workflowId?: string;
  isActive?: boolean;
  onConfigChange?: (maxQuestions: number) => void;
}

export function CrucibleDeliberationPanel({
  sessionId,
  methodId,
  workflowId,
  isActive = false,
  onConfigChange,
}: CrucibleDeliberationPanelProps) {
  const [config, setConfig] = useState<CrucibleConfig | null>(null);
  const [events, setEvents] = useState<DeliberationEvent[]>([]);
  const [expanded, setExpanded] = useState(true);
  const [showSettings, setShowSettings] = useState(false);
  const [maxQuestions, setMaxQuestions] = useState<number>(5);
  const [loading, setLoading] = useState(true);

  const fetchConfig = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (methodId) params.set('method_id', methodId);
      if (workflowId) params.set('workflow_id', workflowId);

      const response = await fetch(`/api/thinktank/crucible/config?${params}`);
      if (response.ok) {
        const data = await response.json();
        setConfig(data);
        setMaxQuestions(data.maxQuestions);
      }
    } catch (err) {
      console.error('Failed to fetch Crucible config:', err);
    } finally {
      setLoading(false);
    }
  }, [methodId, workflowId]);

  const fetchEvents = useCallback(async () => {
    if (!sessionId) return;

    try {
      const response = await fetch(`/api/thinktank/crucible/sessions/${sessionId}/stream`);
      if (response.ok) {
        const data = await response.json();
        setEvents(data.events || []);
      }
    } catch (err) {
      console.error('Failed to fetch deliberation events:', err);
    }
  }, [sessionId]);

  useEffect(() => {
    fetchConfig();
  }, [fetchConfig]);

  useEffect(() => {
    if (isActive && sessionId) {
      fetchEvents();
      const interval = setInterval(fetchEvents, 2000);
      return () => clearInterval(interval);
    }
  }, [isActive, sessionId, fetchEvents]);

  const saveMaxQuestions = async (value: number) => {
    try {
      const response = await fetch(`/api/thinktank/crucible/method/${methodId}/questions`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ maxQuestions: value, workflowId }),
      });

      if (response.ok) {
        setMaxQuestions(value);
        onConfigChange?.(value);
        await fetchConfig();
      }
    } catch (err) {
      console.error('Failed to save max questions:', err);
    }
  };

  if (loading) {
    return (
      <div className="p-4 bg-gray-50 dark:bg-gray-800/50 rounded-xl animate-pulse">
        <div className="h-6 bg-gray-200 dark:bg-gray-700 rounded w-1/3" />
      </div>
    );
  }

  if (!config?.visible) {
    return null;
  }

  if (!config?.enabled) {
    return (
      <div className="p-4 bg-gray-50 dark:bg-gray-800/50 rounded-xl border border-gray-200 dark:border-gray-700">
        <div className="flex items-center gap-2 text-gray-500">
          <Flame className="w-5 h-5" />
          <span className="text-sm">Crucible deliberation is disabled for this method</span>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-gradient-to-br from-orange-50 to-red-50 dark:from-orange-900/20 dark:to-red-900/20 rounded-xl border border-orange-200 dark:border-orange-800 overflow-hidden">
      {/* Header */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full px-4 py-3 flex items-center justify-between hover:bg-orange-100/50 dark:hover:bg-orange-900/30 transition-colors"
      >
        <div className="flex items-center gap-3">
          <div className="p-2 bg-gradient-to-br from-orange-500 to-red-600 rounded-lg">
            <Flame className="w-4 h-4 text-white" />
          </div>
          <div className="text-left">
            <h3 className="font-semibold text-gray-900 dark:text-white">The Crucible</h3>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              {isActive ? 'Deliberation in progress...' : `${maxQuestions} questions max`}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {isActive && (
            <span className="flex items-center gap-1 px-2 py-1 bg-orange-500 text-white text-xs rounded-full">
              <span className="w-2 h-2 bg-white rounded-full animate-pulse" />
              Live
            </span>
          )}
          {expanded ? (
            <ChevronUp className="w-5 h-5 text-gray-400" />
          ) : (
            <ChevronDown className="w-5 h-5 text-gray-400" />
          )}
        </div>
      </button>

      {expanded && (
        <div className="px-4 pb-4 space-y-4">
          {/* Settings Toggle */}
          {config.canOverride && (
            <div className="flex items-center justify-between p-3 bg-white dark:bg-gray-800 rounded-lg">
              <div className="flex items-center gap-2">
                <Settings className="w-4 h-4 text-gray-400" />
                <span className="text-sm text-gray-600 dark:text-gray-300">
                  Max Questions: <strong>{maxQuestions}</strong>
                </span>
                <span className="text-xs text-gray-400">
                  (source: {config.source})
                </span>
              </div>
              <button
                onClick={() => setShowSettings(!showSettings)}
                className="text-orange-500 hover:text-orange-600 text-sm"
              >
                {showSettings ? 'Done' : 'Change'}
              </button>
            </div>
          )}

          {/* Settings Panel */}
          {showSettings && config.canOverride && (
            <div className="p-4 bg-white dark:bg-gray-800 rounded-lg space-y-3">
              <p className="text-sm text-gray-600 dark:text-gray-300">
                Set the maximum number of questions for deliberation on this method.
              </p>
              <div className="flex items-center gap-4">
                <input
                  type="range"
                  min={1}
                  max={10}
                  value={maxQuestions}
                  onChange={(e) => setMaxQuestions(parseInt(e.target.value))}
                  className="flex-1 accent-orange-500"
                />
                <span className="text-lg font-bold text-orange-500 w-8 text-center">
                  {maxQuestions}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => saveMaxQuestions(maxQuestions)}
                  className="px-4 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600 text-sm"
                >
                  Save for this method
                </button>
                <button
                  onClick={() => {
                    setMaxQuestions(config.maxQuestions);
                    setShowSettings(false);
                  }}
                  className="px-4 py-2 text-gray-500 hover:text-gray-700 text-sm"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}

          {/* Deliberation Events */}
          {isActive && events.length > 0 && (
            <div className="space-y-2">
              <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 flex items-center gap-2">
                <MessageSquare className="w-4 h-4" />
                Deliberation Log
              </h4>
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {events.map((event) => (
                  <DeliberationEventCard key={event.questionId} event={event} />
                ))}
              </div>
            </div>
          )}

          {/* Waiting State */}
          {isActive && events.length === 0 && (
            <div className="flex items-center justify-center py-8 text-gray-500">
              <div className="flex items-center gap-2">
                <Clock className="w-5 h-5 animate-pulse" />
                <span>Waiting for deliberation to begin...</span>
              </div>
            </div>
          )}

          {/* Info when not active */}
          {!isActive && (
            <div className="text-sm text-gray-600 dark:text-gray-400 space-y-2">
              <p>
                When multiple LLMs work on this method, The Crucible will enable
                competitive deliberation where models question each other.
              </p>
              <div className="flex items-center gap-4 text-xs">
                <span className="flex items-center gap-1">
                  <Users className="w-4 h-4" />
                  Min 2 LLMs
                </span>
                <span className="flex items-center gap-1">
                  <Zap className="w-4 h-4" />
                  {config.costMode} mode
                </span>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function DeliberationEventCard({ event }: { event: DeliberationEvent }) {
  return (
    <div className="p-3 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
      <div className="flex items-center gap-2 mb-2">
        <span className="text-xs font-mono text-gray-400">Q{event.questionNumber}</span>
        <span className="font-medium text-orange-600 dark:text-orange-400 text-sm">
          {event.askerModel}
        </span>
        <span className="text-gray-400">→</span>
        <span className="font-medium text-blue-600 dark:text-blue-400 text-sm">
          {event.targetModel}
        </span>
        <span className="px-1.5 py-0.5 bg-gray-100 dark:bg-gray-700 text-xs rounded">
          {event.questionType}
        </span>
      </div>
      <p className="text-sm text-gray-900 dark:text-white">{event.questionText}</p>
      
      {event.answer && (
        <div className="mt-2 pl-3 border-l-2 border-blue-200 dark:border-blue-800">
          <p className="text-sm text-gray-700 dark:text-gray-300">{event.answer.answerText}</p>
          {event.answer.circularCitationDetected && (
            <p className="text-xs text-red-500 mt-1 flex items-center gap-1">
              <AlertTriangle className="w-3 h-3" />
              Circular citation detected
            </p>
          )}
        </div>
      )}
    </div>
  );
}

export default CrucibleDeliberationPanel;
