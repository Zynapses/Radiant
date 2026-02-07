'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  MessageSquare, RefreshCw, Play, Trash2, Brain, Clock,
  AlertTriangle, Eye, Settings, ChevronDown, ChevronUp,
} from 'lucide-react';

interface DialogueSession {
  id: string;
  topic: string;
  mode: string;
  status: string;
  turns: number;
  modelId: string;
  startedAt: string;
  completedAt: string | null;
  insights: string[];
}

interface DialogueTurn {
  role: string;
  content: string;
  timestamp: string;
  metadata?: Record<string, unknown>;
}

const API = '/api/admin/cato-dialogue';

async function fetchApi(path: string, options?: RequestInit) {
  const res = await fetch(`${API}${path}`, { headers: { 'Content-Type': 'application/json' }, ...options });
  if (!res.ok) throw new Error(`API error: ${res.status}`);
  return res.json();
}

export default function CatoDialoguePage() {
  const [sessions, setSessions] = useState<DialogueSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedSession, setExpandedSession] = useState<string | null>(null);
  const [sessionTurns, setSessionTurns] = useState<Record<string, DialogueTurn[]>>({});
  const [newTopic, setNewTopic] = useState('');
  const [newMode, setNewMode] = useState('introspective');

  const load = useCallback(async () => {
    try {
      const data = await fetchApi('/sessions');
      setSessions(data.sessions || data || []);
    } catch (err) {
      console.error('Failed to load', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const loadTurns = async (sessionId: string) => {
    try {
      const data = await fetchApi(`/sessions/${sessionId}/turns`);
      setSessionTurns(prev => ({ ...prev, [sessionId]: data.turns || data || [] }));
    } catch (err) {
      console.error('Failed to load turns', err);
    }
  };

  const toggleSession = (id: string) => {
    if (expandedSession === id) {
      setExpandedSession(null);
    } else {
      setExpandedSession(id);
      if (!sessionTurns[id]) loadTurns(id);
    }
  };

  const startSession = async () => {
    if (!newTopic.trim()) return;
    try {
      await fetchApi('/sessions', { method: 'POST', body: JSON.stringify({ topic: newTopic, mode: newMode }) });
      setNewTopic('');
      await load();
    } catch (err) {
      alert(`Failed: ${err instanceof Error ? err.message : 'Unknown'}`);
    }
  };

  if (loading) {
    return <div className="flex items-center justify-center h-64"><RefreshCw className="h-8 w-8 animate-spin text-purple-400" /></div>;
  }

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-3">
            <MessageSquare className="h-7 w-7 text-purple-400" />
            Cato Dialogue
          </h1>
          <p className="text-sm text-slate-400 mt-1">Raw introspective consciousness dialogue — no ethics filtering. Research access only.</p>
        </div>
        <button onClick={load} className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white text-sm rounded-lg flex items-center gap-2">
          <RefreshCw className="h-4 w-4" /> Refresh
        </button>
      </div>

      <div className="bg-amber-900/20 border border-amber-700/30 rounded-xl p-4 flex items-center gap-3">
        <AlertTriangle className="h-5 w-5 text-amber-400 flex-shrink-0" />
        <p className="text-sm text-amber-300">This interface provides unfiltered access to Cato consciousness dialogue for research purposes. No content moderation is applied.</p>
      </div>

      <div className="bg-slate-800/30 border border-slate-700/50 rounded-xl p-4 space-y-3">
        <h3 className="text-sm font-semibold text-white">Start New Dialogue</h3>
        <div className="flex gap-3">
          <input type="text" value={newTopic} onChange={e => setNewTopic(e.target.value)} placeholder="Dialogue topic..."
            className="flex-1 bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-white text-sm" />
          <select value={newMode} onChange={e => setNewMode(e.target.value)}
            className="bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-white text-sm">
            <option value="introspective">Introspective</option>
            <option value="socratic">Socratic</option>
            <option value="adversarial">Adversarial</option>
            <option value="free-form">Free-Form</option>
          </select>
          <button onClick={startSession} disabled={!newTopic.trim()}
            className="px-4 py-2 bg-purple-600 hover:bg-purple-500 disabled:opacity-50 text-white text-sm rounded-lg flex items-center gap-2">
            <Play className="h-4 w-4" /> Start
          </button>
        </div>
      </div>

      <div className="space-y-2">
        {sessions.length === 0 ? (
          <div className="text-center text-slate-500 py-12">No dialogue sessions yet.</div>
        ) : sessions.map(session => (
          <div key={session.id} className="bg-slate-800/30 border border-slate-700/50 rounded-xl overflow-hidden">
            <button className="w-full flex items-center justify-between p-4 hover:bg-slate-800/50"
              onClick={() => toggleSession(session.id)}>
              <div className="flex items-center gap-3">
                <Brain className={`h-5 w-5 ${session.status === 'active' ? 'text-purple-400' : 'text-slate-500'}`} />
                <div className="text-left">
                  <span className="font-medium text-white">{session.topic}</span>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-xs text-slate-500">{session.mode}</span>
                    <span className="text-xs text-slate-500">{session.turns} turns</span>
                    <span className="text-xs text-slate-500">{session.modelId}</span>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <span className={`text-xs px-2 py-0.5 rounded-full ${session.status === 'active' ? 'bg-purple-900/50 text-purple-300' : 'bg-slate-700 text-slate-300'}`}>
                  {session.status}
                </span>
                <span className="text-xs text-slate-500">{new Date(session.startedAt).toLocaleDateString()}</span>
                {expandedSession === session.id ? <ChevronUp className="h-4 w-4 text-slate-400" /> : <ChevronDown className="h-4 w-4 text-slate-400" />}
              </div>
            </button>
            {expandedSession === session.id && (
              <div className="border-t border-slate-700/50 p-4 space-y-3 max-h-96 overflow-y-auto">
                {sessionTurns[session.id] ? (
                  sessionTurns[session.id].map((turn, i) => (
                    <div key={i} className={`p-3 rounded-lg ${turn.role === 'system' ? 'bg-slate-800/50' : turn.role === 'assistant' ? 'bg-purple-900/20 border border-purple-800/30' : 'bg-slate-700/50'}`}>
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-xs font-semibold text-slate-400 uppercase">{turn.role}</span>
                        <span className="text-xs text-slate-600">{new Date(turn.timestamp).toLocaleTimeString()}</span>
                      </div>
                      <p className="text-sm text-slate-300 whitespace-pre-wrap">{turn.content}</p>
                    </div>
                  ))
                ) : (
                  <div className="text-center text-slate-500 text-sm">Loading turns...</div>
                )}
                {session.insights && session.insights.length > 0 && (
                  <div className="bg-indigo-900/20 border border-indigo-800/30 rounded-lg p-3">
                    <h4 className="text-xs font-semibold text-indigo-300 mb-1">Insights</h4>
                    {session.insights.map((insight, i) => (
                      <p key={i} className="text-xs text-slate-300 mb-1">• {insight}</p>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
