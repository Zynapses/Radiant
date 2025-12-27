'use client';

import { useState, useEffect } from 'react';
import {
  Users, Brain, MessageSquare, GitBranch, Play, Pause, RefreshCw,
  ChevronRight, Circle, ArrowRight, CheckCircle, XCircle, Clock,
  Zap, Target, TrendingUp, Activity, Plus, Settings, Eye
} from 'lucide-react';

interface CognitiveAgent {
  agentId: string;
  role: string;
  name: string;
  description?: string;
  avatarIcon: string;
  avatarColor: string;
  primaryModelId: string;
  capabilities: string[];
  personality: {
    assertiveness: number;
    detailOrientation: number;
    creativity: number;
  };
  totalActivations: number;
  successRate: number;
  avgResponseTimeMs: number;
  isActive: boolean;
}

interface CollaborationSession {
  sessionId: string;
  goal: string;
  collaborationPattern: string;
  participatingAgents: string[];
  status: 'active' | 'completed' | 'failed';
  totalMessages: number;
  totalRounds: number;
  consensusReached?: boolean;
  finalConfidence?: number;
  startedAt: string;
  completedAt?: string;
  durationMs?: number;
}

interface AgentMessage {
  messageId: string;
  fromAgentId?: string;
  fromAgentName?: string;
  messageType: string;
  content: string;
  confidence?: number;
  roundNumber: number;
  createdAt: string;
}

interface AgentStats {
  totalAgents: number;
  activeAgents: number;
  totalSessions: number;
  activeSessions: number;
  avgConsensusRate: number;
  avgSessionDuration: number;
  totalMessages: number;
}

const roleColors: Record<string, string> = {
  planner: '#3b82f6',
  critic: '#ef4444',
  executor: '#10b981',
  verifier: '#8b5cf6',
  researcher: '#f59e0b',
  synthesizer: '#ec4899',
  devils_advocate: '#f97316',
};

const roleIcons: Record<string, string> = {
  planner: 'map',
  critic: 'search',
  executor: 'zap',
  verifier: 'check-circle',
  researcher: 'book-open',
  synthesizer: 'git-merge',
  devils_advocate: 'alert-triangle',
};

const patternLabels: Record<string, string> = {
  debate: 'Structured Debate',
  consensus: 'Consensus Building',
  divide_conquer: 'Divide & Conquer',
  pipeline: 'Sequential Pipeline',
  critical_review: 'Critical Review',
};

export default function AgentsPage() {
  const [agents, setAgents] = useState<CognitiveAgent[]>([]);
  const [sessions, setSessions] = useState<CollaborationSession[]>([]);
  const [stats, setStats] = useState<AgentStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedAgent, setSelectedAgent] = useState<CognitiveAgent | null>(null);
  const [selectedSession, setSelectedSession] = useState<CollaborationSession | null>(null);
  const [sessionMessages, setSessionMessages] = useState<AgentMessage[]>([]);
  const [activeTab, setActiveTab] = useState<'agents' | 'sessions' | 'live'>('agents');

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    if (selectedSession) {
      setSessionMessages(mockMessages.filter(m => true)); // All messages for demo
    }
  }, [selectedSession]);

  async function loadData() {
    setLoading(true);
    try {
      setAgents(mockAgents);
      setSessions(mockSessions);
      setStats(mockStats);
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <Users className="h-7 w-7 text-indigo-600" />
            Multi-Agent Collaboration
          </h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1">
            Cognitive agents with debate, consensus, and emergent intelligence
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={loadData} className="p-2 text-gray-600 hover:text-gray-900 dark:text-gray-400">
            <RefreshCw className="h-5 w-5" />
          </button>
          <button className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 flex items-center gap-2">
            <Play className="h-4 w-4" />
            Start Collaboration
          </button>
        </div>
      </div>

      {/* Stats Cards */}
      {stats && (
        <div className="grid grid-cols-5 gap-4">
          <StatCard title="Total Agents" value={stats.totalAgents} subtitle={`${stats.activeAgents} active`} icon={Users} color="indigo" />
          <StatCard title="Sessions" value={stats.totalSessions} subtitle={`${stats.activeSessions} active`} icon={MessageSquare} color="blue" />
          <StatCard title="Consensus Rate" value={`${(stats.avgConsensusRate * 100).toFixed(0)}%`} icon={CheckCircle} color="green" />
          <StatCard title="Avg Duration" value={`${(stats.avgSessionDuration / 1000).toFixed(1)}s`} icon={Clock} color="orange" />
          <StatCard title="Messages" value={stats.totalMessages} icon={Activity} color="purple" />
        </div>
      )}

      {/* Tab Navigation */}
      <div className="border-b border-gray-200 dark:border-gray-700">
        <nav className="flex space-x-8">
          {(['agents', 'sessions', 'live'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`py-3 px-1 border-b-2 font-medium text-sm transition-colors ${
                activeTab === tab
                  ? 'border-indigo-600 text-indigo-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
              }`}
            >
              {tab === 'agents' && <><Users className="inline h-4 w-4 mr-2" />Agents ({agents.length})</>}
              {tab === 'sessions' && <><MessageSquare className="inline h-4 w-4 mr-2" />Sessions ({sessions.length})</>}
              {tab === 'live' && <><Activity className="inline h-4 w-4 mr-2" />Live View</>}
            </button>
          ))}
        </nav>
      </div>

      {/* Content */}
      <div className="grid grid-cols-3 gap-6">
        {/* Main Content */}
        <div className="col-span-2">
          {activeTab === 'agents' && (
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700">
              <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Cognitive Agents</h2>
                <p className="text-sm text-gray-500">Specialized AI agents with distinct roles and personalities</p>
              </div>
              <div className="divide-y divide-gray-200 dark:divide-gray-700">
                {agents.map((agent) => (
                  <AgentRow
                    key={agent.agentId}
                    agent={agent}
                    selected={selectedAgent?.agentId === agent.agentId}
                    onSelect={() => setSelectedAgent(agent)}
                  />
                ))}
              </div>
            </div>
          )}

          {activeTab === 'sessions' && (
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700">
              <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Collaboration Sessions</h2>
                <p className="text-sm text-gray-500">Multi-agent working sessions with shared context</p>
              </div>
              <div className="divide-y divide-gray-200 dark:divide-gray-700">
                {sessions.map((session) => (
                  <SessionRow
                    key={session.sessionId}
                    session={session}
                    agents={agents}
                    selected={selectedSession?.sessionId === session.sessionId}
                    onSelect={() => setSelectedSession(session)}
                  />
                ))}
              </div>
            </div>
          )}

          {activeTab === 'live' && (
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Live Collaboration Feed</h2>
              <div className="space-y-4">
                {sessionMessages.map((message, i) => (
                  <MessageBubble key={message.messageId} message={message} agents={agents} isLeft={i % 2 === 0} />
                ))}
                {sessionMessages.length === 0 && (
                  <div className="text-center py-12 text-gray-500">
                    <MessageSquare className="h-12 w-12 mx-auto mb-3 opacity-50" />
                    <p>No active collaboration. Start a new session to see live agent communication.</p>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Detail Panel */}
        <div className="space-y-6">
          {/* Selected Agent Details */}
          {selectedAgent && activeTab === 'agents' && (
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700">
              <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
                <div className="flex items-center gap-3">
                  <div className="p-3 rounded-lg" style={{ backgroundColor: `${roleColors[selectedAgent.role]}20`, color: roleColors[selectedAgent.role] }}>
                    <Brain className="h-6 w-6" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-gray-900 dark:text-white">{selectedAgent.name}</h3>
                    <p className="text-sm text-gray-500 capitalize">{selectedAgent.role.replace('_', ' ')}</p>
                  </div>
                </div>
              </div>
              <div className="p-4 space-y-4">
                <div>
                  <label className="text-xs text-gray-500 uppercase tracking-wider">Description</label>
                  <p className="text-sm text-gray-700 dark:text-gray-300 mt-1">{selectedAgent.description}</p>
                </div>
                <div>
                  <label className="text-xs text-gray-500 uppercase tracking-wider">Model</label>
                  <p className="text-sm font-mono text-gray-700 dark:text-gray-300 mt-1">{selectedAgent.primaryModelId}</p>
                </div>
                <div>
                  <label className="text-xs text-gray-500 uppercase tracking-wider">Capabilities</label>
                  <div className="flex flex-wrap gap-1 mt-1">
                    {selectedAgent.capabilities.map((cap, i) => (
                      <span key={i} className="px-2 py-0.5 bg-gray-100 dark:bg-gray-700 rounded text-xs">{cap}</span>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="text-xs text-gray-500 uppercase tracking-wider">Personality</label>
                  <div className="mt-2 space-y-2">
                    <PersonalityBar label="Assertiveness" value={selectedAgent.personality.assertiveness} color="blue" />
                    <PersonalityBar label="Detail Orientation" value={selectedAgent.personality.detailOrientation} color="green" />
                    <PersonalityBar label="Creativity" value={selectedAgent.personality.creativity} color="purple" />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4 pt-4 border-t border-gray-200 dark:border-gray-700">
                  <div>
                    <label className="text-xs text-gray-500 uppercase tracking-wider">Activations</label>
                    <p className="text-xl font-bold text-gray-900 dark:text-white">{selectedAgent.totalActivations.toLocaleString()}</p>
                  </div>
                  <div>
                    <label className="text-xs text-gray-500 uppercase tracking-wider">Success Rate</label>
                    <p className="text-xl font-bold text-green-600">{(selectedAgent.successRate * 100).toFixed(0)}%</p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Selected Session Details */}
          {selectedSession && activeTab === 'sessions' && (
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700">
              <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold text-gray-900 dark:text-white">Session Details</h3>
                  <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                    selectedSession.status === 'completed' ? 'bg-green-100 text-green-700' :
                    selectedSession.status === 'active' ? 'bg-blue-100 text-blue-700' :
                    'bg-red-100 text-red-700'
                  }`}>{selectedSession.status}</span>
                </div>
              </div>
              <div className="p-4 space-y-4">
                <div>
                  <label className="text-xs text-gray-500 uppercase tracking-wider">Goal</label>
                  <p className="text-sm text-gray-700 dark:text-gray-300 mt-1">{selectedSession.goal}</p>
                </div>
                <div>
                  <label className="text-xs text-gray-500 uppercase tracking-wider">Pattern</label>
                  <p className="text-sm font-medium text-gray-900 dark:text-white mt-1">
                    {patternLabels[selectedSession.collaborationPattern] || selectedSession.collaborationPattern}
                  </p>
                </div>
                <div>
                  <label className="text-xs text-gray-500 uppercase tracking-wider">Participating Agents</label>
                  <div className="flex flex-wrap gap-2 mt-2">
                    {selectedSession.participatingAgents.map((agentId) => {
                      const agent = agents.find(a => a.agentId === agentId);
                      return agent ? (
                        <div key={agentId} className="flex items-center gap-1 px-2 py-1 bg-gray-100 dark:bg-gray-700 rounded text-xs">
                          <Circle className="h-2 w-2" fill={roleColors[agent.role]} stroke="none" />
                          {agent.name}
                        </div>
                      ) : null;
                    })}
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs text-gray-500 uppercase tracking-wider">Rounds</label>
                    <p className="text-lg font-bold text-gray-900 dark:text-white">{selectedSession.totalRounds}</p>
                  </div>
                  <div>
                    <label className="text-xs text-gray-500 uppercase tracking-wider">Messages</label>
                    <p className="text-lg font-bold text-gray-900 dark:text-white">{selectedSession.totalMessages}</p>
                  </div>
                </div>
                {selectedSession.consensusReached !== undefined && (
                  <div className="flex items-center gap-2">
                    {selectedSession.consensusReached ? (
                      <CheckCircle className="h-5 w-5 text-green-500" />
                    ) : (
                      <XCircle className="h-5 w-5 text-red-500" />
                    )}
                    <span className="text-sm">
                      {selectedSession.consensusReached ? 'Consensus Reached' : 'No Consensus'}
                    </span>
                    {selectedSession.finalConfidence && (
                      <span className="text-sm text-gray-500">
                        ({(selectedSession.finalConfidence * 100).toFixed(0)}% confidence)
                      </span>
                    )}
                  </div>
                )}
                <button
                  onClick={() => { setActiveTab('live'); setSessionMessages(mockMessages); }}
                  className="w-full px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 flex items-center justify-center gap-2"
                >
                  <Eye className="h-4 w-4" />
                  View Conversation
                </button>
              </div>
            </div>
          )}

          {/* Quick Actions */}
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700">
            <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
              <h3 className="font-semibold text-gray-900 dark:text-white">Quick Collaboration</h3>
            </div>
            <div className="p-4 space-y-3">
              <CollaborationButton pattern="debate" icon={MessageSquare} label="Start Debate" description="Agents debate to find best solution" />
              <CollaborationButton pattern="consensus" icon={CheckCircle} label="Build Consensus" description="Reach agreement through voting" />
              <CollaborationButton pattern="divide_conquer" icon={GitBranch} label="Divide & Conquer" description="Split task among executors" />
              <CollaborationButton pattern="critical_review" icon={Target} label="Critical Review" description="Iterative critique and revision" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function StatCard({ title, value, subtitle, icon: Icon, color }: {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: React.ElementType;
  color: 'indigo' | 'blue' | 'green' | 'orange' | 'purple';
}) {
  const colors = {
    indigo: 'bg-indigo-50 text-indigo-600 dark:bg-indigo-900/20',
    blue: 'bg-blue-50 text-blue-600 dark:bg-blue-900/20',
    green: 'bg-green-50 text-green-600 dark:bg-green-900/20',
    orange: 'bg-orange-50 text-orange-600 dark:bg-orange-900/20',
    purple: 'bg-purple-50 text-purple-600 dark:bg-purple-900/20',
  };
  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl p-4 shadow-sm border border-gray-200 dark:border-gray-700">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-gray-500">{title}</p>
          <p className="text-2xl font-bold text-gray-900 dark:text-white">{value}</p>
          {subtitle && <p className="text-xs text-gray-400">{subtitle}</p>}
        </div>
        <div className={`p-3 rounded-lg ${colors[color]}`}>
          <Icon className="h-5 w-5" />
        </div>
      </div>
    </div>
  );
}

function AgentRow({ agent, selected, onSelect }: { agent: CognitiveAgent; selected: boolean; onSelect: () => void }) {
  const color = roleColors[agent.role] || '#6366f1';
  return (
    <div onClick={onSelect} className={`p-4 cursor-pointer transition-colors ${selected ? 'bg-indigo-50 dark:bg-indigo-900/20' : 'hover:bg-gray-50 dark:hover:bg-gray-700/50'}`}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg" style={{ backgroundColor: `${color}20`, color }}>
            <Brain className="h-5 w-5" />
          </div>
          <div>
            <h4 className="font-medium text-gray-900 dark:text-white">{agent.name}</h4>
            <p className="text-sm text-gray-500">{agent.role.replace('_', ' ')} • {agent.primaryModelId.split('/')[1]}</p>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <div className="text-right">
            <p className="text-sm font-medium">{agent.totalActivations.toLocaleString()}</p>
            <p className="text-xs text-gray-500">{(agent.successRate * 100).toFixed(0)}% success</p>
          </div>
          <div className={`w-2 h-2 rounded-full ${agent.isActive ? 'bg-green-500' : 'bg-gray-300'}`} />
          <ChevronRight className="h-5 w-5 text-gray-400" />
        </div>
      </div>
    </div>
  );
}

function SessionRow({ session, agents, selected, onSelect }: { session: CollaborationSession; agents: CognitiveAgent[]; selected: boolean; onSelect: () => void }) {
  const participantColors = session.participatingAgents.slice(0, 3).map(id => {
    const agent = agents.find(a => a.agentId === id);
    return agent ? roleColors[agent.role] : '#6366f1';
  });

  return (
    <div onClick={onSelect} className={`p-4 cursor-pointer transition-colors ${selected ? 'bg-indigo-50 dark:bg-indigo-900/20' : 'hover:bg-gray-50 dark:hover:bg-gray-700/50'}`}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex -space-x-2">
            {participantColors.map((color, i) => (
              <div key={i} className="w-8 h-8 rounded-full border-2 border-white dark:border-gray-800 flex items-center justify-center" style={{ backgroundColor: color }}>
                <Brain className="h-4 w-4 text-white" />
              </div>
            ))}
            {session.participatingAgents.length > 3 && (
              <div className="w-8 h-8 rounded-full border-2 border-white dark:border-gray-800 bg-gray-200 dark:bg-gray-700 flex items-center justify-center text-xs">
                +{session.participatingAgents.length - 3}
              </div>
            )}
          </div>
          <div>
            <h4 className="font-medium text-gray-900 dark:text-white truncate max-w-md">{session.goal}</h4>
            <p className="text-sm text-gray-500">
              {patternLabels[session.collaborationPattern]} • {session.totalRounds} rounds • {session.totalMessages} messages
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <span className={`px-2 py-0.5 rounded text-xs font-medium ${
            session.status === 'completed' ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' :
            session.status === 'active' ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' :
            'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
          }`}>{session.status}</span>
          <ChevronRight className="h-5 w-5 text-gray-400" />
        </div>
      </div>
    </div>
  );
}

function MessageBubble({ message, agents, isLeft }: { message: AgentMessage; agents: CognitiveAgent[]; isLeft: boolean }) {
  const agent = agents.find(a => a.agentId === message.fromAgentId);
  const color = agent ? roleColors[agent.role] : '#6366f1';

  return (
    <div className={`flex gap-3 ${isLeft ? '' : 'flex-row-reverse'}`}>
      <div className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0" style={{ backgroundColor: `${color}20`, color }}>
        <Brain className="h-5 w-5" />
      </div>
      <div className={`flex-1 max-w-lg ${isLeft ? '' : 'text-right'}`}>
        <div className="flex items-center gap-2 mb-1">
          <span className="text-sm font-medium text-gray-900 dark:text-white">{agent?.name || 'System'}</span>
          <span className="text-xs px-1.5 py-0.5 rounded capitalize" style={{ backgroundColor: `${color}20`, color }}>
            {message.messageType}
          </span>
        </div>
        <div className={`p-3 rounded-lg ${isLeft ? 'bg-gray-100 dark:bg-gray-700' : 'bg-indigo-100 dark:bg-indigo-900/30'}`}>
          <p className="text-sm text-gray-700 dark:text-gray-300">{message.content}</p>
        </div>
        <p className="text-xs text-gray-400 mt-1">
          Round {message.roundNumber} • {message.confidence ? `${(message.confidence * 100).toFixed(0)}% confident` : ''}
        </p>
      </div>
    </div>
  );
}

function PersonalityBar({ label, value, color }: { label: string; value: number; color: 'blue' | 'green' | 'purple' }) {
  const colors = { blue: 'bg-blue-500', green: 'bg-green-500', purple: 'bg-purple-500' };
  return (
    <div>
      <div className="flex justify-between text-xs mb-1">
        <span className="text-gray-500">{label}</span>
        <span className="text-gray-700 dark:text-gray-300">{(value * 100).toFixed(0)}%</span>
      </div>
      <div className="h-1.5 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
        <div className={`h-full ${colors[color]}`} style={{ width: `${value * 100}%` }} />
      </div>
    </div>
  );
}

function CollaborationButton({ pattern, icon: Icon, label, description }: { pattern: string; icon: React.ElementType; label: string; description: string }) {
  return (
    <button className="w-full p-3 text-left rounded-lg border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
      <div className="flex items-center gap-3">
        <div className="p-2 bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 rounded-lg">
          <Icon className="h-5 w-5" />
        </div>
        <div>
          <p className="font-medium text-gray-900 dark:text-white">{label}</p>
          <p className="text-xs text-gray-500">{description}</p>
        </div>
      </div>
    </button>
  );
}

// Mock data
const mockAgents: CognitiveAgent[] = [
  { agentId: '1', role: 'planner', name: 'Strategic Planner', description: 'Decomposes complex goals into actionable plans', avatarIcon: 'map', avatarColor: '#3b82f6', primaryModelId: 'openai/o1', capabilities: ['planning', 'decomposition', 'strategy'], personality: { assertiveness: 0.7, detailOrientation: 0.9, creativity: 0.5 }, totalActivations: 1250, successRate: 0.94, avgResponseTimeMs: 2400, isActive: true },
  { agentId: '2', role: 'critic', name: 'Critical Analyst', description: 'Evaluates plans and outputs for flaws', avatarIcon: 'search', avatarColor: '#ef4444', primaryModelId: 'anthropic/claude-3-5-sonnet-20241022', capabilities: ['critique', 'analysis', 'risk_identification'], personality: { assertiveness: 0.8, detailOrientation: 0.95, creativity: 0.3 }, totalActivations: 2100, successRate: 0.91, avgResponseTimeMs: 1800, isActive: true },
  { agentId: '3', role: 'executor', name: 'Task Executor', description: 'Carries out specific tasks and produces outputs', avatarIcon: 'zap', avatarColor: '#10b981', primaryModelId: 'anthropic/claude-3-5-sonnet-20241022', capabilities: ['execution', 'coding', 'implementation'], personality: { assertiveness: 0.5, detailOrientation: 0.85, creativity: 0.6 }, totalActivations: 3400, successRate: 0.89, avgResponseTimeMs: 2100, isActive: true },
  { agentId: '4', role: 'verifier', name: 'Quality Verifier', description: 'Verifies outputs against requirements', avatarIcon: 'check-circle', avatarColor: '#8b5cf6', primaryModelId: 'anthropic/claude-3-5-sonnet-20241022', capabilities: ['verification', 'testing', 'validation'], personality: { assertiveness: 0.6, detailOrientation: 1.0, creativity: 0.2 }, totalActivations: 1800, successRate: 0.96, avgResponseTimeMs: 1500, isActive: true },
  { agentId: '5', role: 'researcher', name: 'Knowledge Researcher', description: 'Gathers information and synthesizes knowledge', avatarIcon: 'book-open', avatarColor: '#f59e0b', primaryModelId: 'perplexity/llama-3.1-sonar-large', capabilities: ['research', 'exploration', 'synthesis'], personality: { assertiveness: 0.4, detailOrientation: 0.8, creativity: 0.7 }, totalActivations: 890, successRate: 0.88, avgResponseTimeMs: 3200, isActive: true },
  { agentId: '6', role: 'synthesizer', name: 'Solution Synthesizer', description: 'Combines ideas into coherent solutions', avatarIcon: 'git-merge', avatarColor: '#ec4899', primaryModelId: 'anthropic/claude-3-5-sonnet-20241022', capabilities: ['synthesis', 'integration', 'summarization'], personality: { assertiveness: 0.5, detailOrientation: 0.7, creativity: 0.8 }, totalActivations: 650, successRate: 0.92, avgResponseTimeMs: 2000, isActive: true },
  { agentId: '7', role: 'devils_advocate', name: 'Devils Advocate', description: 'Challenges consensus and prevents groupthink', avatarIcon: 'alert-triangle', avatarColor: '#f97316', primaryModelId: 'anthropic/claude-3-5-sonnet-20241022', capabilities: ['challenge', 'alternative_thinking', 'debate'], personality: { assertiveness: 0.9, detailOrientation: 0.6, creativity: 0.9 }, totalActivations: 420, successRate: 0.85, avgResponseTimeMs: 1700, isActive: true },
];

const mockSessions: CollaborationSession[] = [
  { sessionId: 's1', goal: 'Design a scalable API architecture for the new payment system', collaborationPattern: 'debate', participatingAgents: ['1', '2', '7'], status: 'completed', totalMessages: 12, totalRounds: 4, consensusReached: true, finalConfidence: 0.89, startedAt: new Date(Date.now() - 3600000).toISOString(), completedAt: new Date(Date.now() - 3000000).toISOString(), durationMs: 600000 },
  { sessionId: 's2', goal: 'Implement user authentication flow with MFA', collaborationPattern: 'divide_conquer', participatingAgents: ['1', '3', '6', '4'], status: 'completed', totalMessages: 18, totalRounds: 4, consensusReached: true, finalConfidence: 0.92, startedAt: new Date(Date.now() - 7200000).toISOString(), completedAt: new Date(Date.now() - 6000000).toISOString(), durationMs: 1200000 },
  { sessionId: 's3', goal: 'Review and improve database query performance', collaborationPattern: 'critical_review', participatingAgents: ['3', '2', '4'], status: 'active', totalMessages: 6, totalRounds: 2, startedAt: new Date(Date.now() - 900000).toISOString() },
  { sessionId: 's4', goal: 'Choose between microservices vs monolith for new service', collaborationPattern: 'consensus', participatingAgents: ['1', '2', '3', '4'], status: 'completed', totalMessages: 24, totalRounds: 6, consensusReached: false, finalConfidence: 0.68, startedAt: new Date(Date.now() - 14400000).toISOString(), completedAt: new Date(Date.now() - 12000000).toISOString(), durationMs: 2400000 },
];

const mockMessages: AgentMessage[] = [
  { messageId: 'm1', fromAgentId: '1', messageType: 'proposal', content: 'I propose we use a REST API with versioning for the payment system. This provides clear contracts and easy evolution.', confidence: 0.85, roundNumber: 1, createdAt: new Date(Date.now() - 3500000).toISOString() },
  { messageId: 'm2', fromAgentId: '2', messageType: 'critique', content: 'REST is good for simple CRUD, but payment systems need strong consistency guarantees. Have you considered the failure modes?', confidence: 0.78, roundNumber: 1, createdAt: new Date(Date.now() - 3400000).toISOString() },
  { messageId: 'm3', fromAgentId: '7', messageType: 'disagreement', content: 'What about GraphQL? It could reduce over-fetching for mobile clients and provide better schema evolution.', confidence: 0.72, roundNumber: 1, createdAt: new Date(Date.now() - 3300000).toISOString() },
  { messageId: 'm4', fromAgentId: '1', messageType: 'proposal', content: 'Good points. Let me revise: REST for external APIs with idempotency keys, event-driven internally for consistency. GraphQL for mobile gateway.', confidence: 0.88, roundNumber: 2, createdAt: new Date(Date.now() - 3200000).toISOString() },
  { messageId: 'm5', fromAgentId: '2', messageType: 'agreement', content: 'This hybrid approach addresses my consistency concerns while maintaining flexibility. I support this direction.', confidence: 0.91, roundNumber: 2, createdAt: new Date(Date.now() - 3100000).toISOString() },
];

const mockStats: AgentStats = {
  totalAgents: 7,
  activeAgents: 7,
  totalSessions: 4,
  activeSessions: 1,
  avgConsensusRate: 0.75,
  avgSessionDuration: 1200000,
  totalMessages: 60,
};
