'use client';

import { useState, useEffect } from 'react';
import {
  Users, Brain, MessageSquare, GitBranch, Play, RefreshCw,
  ChevronRight, Circle, CheckCircle, XCircle, Clock,
  Target, Activity, Eye, Loader2
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

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

  useEffect(() => {
    loadData();
  }, []);

  const [_error, setError] = useState<string | null>(null);
  void _error;

  useEffect(() => {
    if (selectedSession) {
      loadSessionMessages(selectedSession.sessionId);
    }
  }, [selectedSession]);

  async function loadSessionMessages(sessionId: string) {
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || ''}/admin/agents/sessions/${sessionId}/messages`);
      if (res.ok) { const { data } = await res.json(); setSessionMessages(data || []); }
    } catch { /* ignore */ }
  }

  async function loadData() {
    setLoading(true);
    setError(null);
    try {
      const [agentsRes, sessionsRes, statsRes] = await Promise.all([
        fetch(`${process.env.NEXT_PUBLIC_API_URL || ''}/admin/agents`),
        fetch(`${process.env.NEXT_PUBLIC_API_URL || ''}/admin/agents/sessions`),
        fetch(`${process.env.NEXT_PUBLIC_API_URL || ''}/admin/agents/stats`),
      ]);
      if (agentsRes.ok) { const { data } = await agentsRes.json(); setAgents(data || []); }
      else setError('Failed to load agents data.');
      if (sessionsRes.ok) { const { data } = await sessionsRes.json(); setSessions(data || []); }
      if (statsRes.ok) { const { data } = await statsRes.json(); setStats(data); }
    } catch { setError('Failed to connect to agents service.'); }
    setLoading(false);
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
            <Users className="h-7 w-7 text-primary" />
            Multi-Agent Collaboration
          </h1>
          <p className="text-muted-foreground mt-1">
            Cognitive agents with debate, consensus, and emergent intelligence
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" onClick={loadData}>
            <RefreshCw className="h-4 w-4" />
          </Button>
          <Button>
            <Play className="h-4 w-4 mr-2" />
            Start Collaboration
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      {stats && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
          <StatCard title="Total Agents" value={stats.totalAgents} subtitle={`${stats.activeAgents} active`} icon={Users} variant="primary" />
          <StatCard title="Sessions" value={stats.totalSessions} subtitle={`${stats.activeSessions} active`} icon={MessageSquare} variant="primary" />
          <StatCard title="Consensus Rate" value={`${(stats.avgConsensusRate * 100).toFixed(0)}%`} icon={CheckCircle} variant="success" />
          <StatCard title="Avg Duration" value={`${(stats.avgSessionDuration / 1000).toFixed(1)}s`} icon={Clock} variant="warning" />
          <StatCard title="Messages" value={stats.totalMessages} icon={Activity} variant="default" />
        </div>
      )}

      {/* Tabs */}
      <Tabs defaultValue="agents" className="space-y-4">
        <TabsList>
          <TabsTrigger value="agents">
            <Users className="h-4 w-4 mr-2" />
            Agents ({agents.length})
          </TabsTrigger>
          <TabsTrigger value="sessions">
            <MessageSquare className="h-4 w-4 mr-2" />
            Sessions ({sessions.length})
          </TabsTrigger>
          <TabsTrigger value="live">
            <Activity className="h-4 w-4 mr-2" />
            Live View
          </TabsTrigger>
        </TabsList>

        {/* Content */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Content */}
          <div className="lg:col-span-2">
            <TabsContent value="agents" className="mt-0">
              <Card>
                <CardHeader>
                  <CardTitle>Cognitive Agents</CardTitle>
                  <CardDescription>Specialized AI agents with distinct roles and personalities</CardDescription>
                </CardHeader>
                <CardContent className="p-0">
                  <div className="divide-y">
                    {agents.map((agent) => (
                      <AgentRow
                        key={agent.agentId}
                        agent={agent}
                        selected={selectedAgent?.agentId === agent.agentId}
                        onSelect={() => setSelectedAgent(agent)}
                      />
                    ))}
                    {agents.length === 0 && (
                      <div className="text-center py-12 text-muted-foreground">
                        <Users className="h-12 w-12 mx-auto mb-3 opacity-50" />
                        <p className="font-medium">No agents configured</p>
                        <p className="text-sm mt-1">Start a collaboration to create cognitive agents.</p>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="sessions" className="mt-0">
              <Card>
                <CardHeader>
                  <CardTitle>Collaboration Sessions</CardTitle>
                  <CardDescription>Multi-agent working sessions with shared context</CardDescription>
                </CardHeader>
                <CardContent className="p-0">
                  <div className="divide-y">
                    {sessions.map((session) => (
                      <SessionRow
                        key={session.sessionId}
                        session={session}
                        agents={agents}
                        selected={selectedSession?.sessionId === session.sessionId}
                        onSelect={() => setSelectedSession(session)}
                      />
                    ))}
                    {sessions.length === 0 && (
                      <div className="text-center py-12 text-muted-foreground">
                        <MessageSquare className="h-12 w-12 mx-auto mb-3 opacity-50" />
                        <p className="font-medium">No sessions yet</p>
                        <p className="text-sm mt-1">Start a collaboration to create a session.</p>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="live" className="mt-0">
              <Card>
                <CardHeader>
                  <CardTitle>Live Collaboration Feed</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {sessionMessages.map((message, i) => (
                      <MessageBubble key={message.messageId} message={message} agents={agents} isLeft={i % 2 === 0} />
                    ))}
                    {sessionMessages.length === 0 && (
                      <div className="text-center py-12 text-muted-foreground">
                        <MessageSquare className="h-12 w-12 mx-auto mb-3 opacity-50" />
                        <p className="font-medium">No active collaboration</p>
                        <p className="text-sm mt-1">Start a new session to see live agent communication.</p>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </div>

          {/* Detail Panel */}
          <div className="space-y-6">
            {/* Selected Agent Details */}
            {selectedAgent && (
              <Card>
                <CardHeader className="pb-3">
                  <div className="flex items-center gap-3">
                    <div className="p-3 rounded-lg" style={{ backgroundColor: `${roleColors[selectedAgent.role]}20`, color: roleColors[selectedAgent.role] }}>
                      <Brain className="h-6 w-6" />
                    </div>
                    <div>
                      <CardTitle className="text-lg">{selectedAgent.name}</CardTitle>
                      <CardDescription className="capitalize">{selectedAgent.role.replace('_', ' ')}</CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <p className="text-xs text-muted-foreground uppercase tracking-wider">Description</p>
                    <p className="text-sm mt-1">{selectedAgent.description}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground uppercase tracking-wider">Model</p>
                    <p className="text-sm font-mono mt-1">{selectedAgent.primaryModelId}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground uppercase tracking-wider">Capabilities</p>
                    <div className="flex flex-wrap gap-1 mt-1">
                      {selectedAgent.capabilities.map((cap, i) => (
                        <Badge key={i} variant="secondary" className="text-xs">{cap}</Badge>
                      ))}
                    </div>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground uppercase tracking-wider">Personality</p>
                    <div className="mt-2 space-y-2">
                      <PersonalityBar label="Assertiveness" value={selectedAgent.personality.assertiveness} color="bg-blue-500" />
                      <PersonalityBar label="Detail Orientation" value={selectedAgent.personality.detailOrientation} color="bg-emerald-500" />
                      <PersonalityBar label="Creativity" value={selectedAgent.personality.creativity} color="bg-violet-500" />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4 pt-4 border-t">
                    <div>
                      <p className="text-xs text-muted-foreground uppercase tracking-wider">Activations</p>
                      <p className="text-xl font-bold">{selectedAgent.totalActivations.toLocaleString()}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground uppercase tracking-wider">Success Rate</p>
                      <p className="text-xl font-bold text-emerald-500">{(selectedAgent.successRate * 100).toFixed(0)}%</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Selected Session Details */}
            {selectedSession && (
              <Card>
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-lg">Session Details</CardTitle>
                    <Badge
                      variant="outline"
                      className={
                        selectedSession.status === 'completed' ? 'text-emerald-500 border-emerald-500/30' :
                        selectedSession.status === 'active' ? 'text-blue-500 border-blue-500/30' :
                        'text-red-500 border-red-500/30'
                      }
                    >
                      {selectedSession.status}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <p className="text-xs text-muted-foreground uppercase tracking-wider">Goal</p>
                    <p className="text-sm mt-1">{selectedSession.goal}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground uppercase tracking-wider">Pattern</p>
                    <p className="text-sm font-medium mt-1">
                      {patternLabels[selectedSession.collaborationPattern] || selectedSession.collaborationPattern}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground uppercase tracking-wider">Participating Agents</p>
                    <div className="flex flex-wrap gap-2 mt-2">
                      {selectedSession.participatingAgents.map((agentId) => {
                        const agent = agents.find(a => a.agentId === agentId);
                        return agent ? (
                          <Badge key={agentId} variant="secondary" className="text-xs">
                            <Circle className="h-2 w-2 mr-1" fill={roleColors[agent.role]} stroke="none" />
                            {agent.name}
                          </Badge>
                        ) : null;
                      })}
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-xs text-muted-foreground uppercase tracking-wider">Rounds</p>
                      <p className="text-lg font-bold">{selectedSession.totalRounds}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground uppercase tracking-wider">Messages</p>
                      <p className="text-lg font-bold">{selectedSession.totalMessages}</p>
                    </div>
                  </div>
                  {selectedSession.consensusReached !== undefined && (
                    <div className="flex items-center gap-2">
                      {selectedSession.consensusReached ? (
                        <CheckCircle className="h-5 w-5 text-emerald-500" />
                      ) : (
                        <XCircle className="h-5 w-5 text-red-500" />
                      )}
                      <span className="text-sm">
                        {selectedSession.consensusReached ? 'Consensus Reached' : 'No Consensus'}
                      </span>
                      {selectedSession.finalConfidence && (
                        <span className="text-sm text-muted-foreground">
                          ({(selectedSession.finalConfidence * 100).toFixed(0)}% confidence)
                        </span>
                      )}
                    </div>
                  )}
                  <Button
                    className="w-full"
                    onClick={() => { if (selectedSession) loadSessionMessages(selectedSession.sessionId); }}
                  >
                    <Eye className="h-4 w-4 mr-2" />
                    View Conversation
                  </Button>
                </CardContent>
              </Card>
            )}

            {/* Quick Actions */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Quick Collaboration</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <CollaborationButton icon={MessageSquare} label="Start Debate" description="Agents debate to find best solution" />
                <CollaborationButton icon={CheckCircle} label="Build Consensus" description="Reach agreement through voting" />
                <CollaborationButton icon={GitBranch} label="Divide & Conquer" description="Split task among executors" />
                <CollaborationButton icon={Target} label="Critical Review" description="Iterative critique and revision" />
              </CardContent>
            </Card>
          </div>
        </div>
      </Tabs>
    </div>
  );
}

function StatCard({ title, value, subtitle, icon: Icon, variant }: {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: React.ElementType;
  variant: 'default' | 'primary' | 'success' | 'warning' | 'danger';
}) {
  const styles = {
    default: 'bg-muted/50 text-muted-foreground',
    primary: 'bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400',
    success: 'bg-emerald-100 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400',
    warning: 'bg-amber-100 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400',
    danger: 'bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400',
  };
  return (
    <Card>
      <CardContent className="pt-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-muted-foreground">{title}</p>
            <p className="text-2xl font-bold">{value}</p>
            {subtitle && <p className="text-xs text-muted-foreground">{subtitle}</p>}
          </div>
          <div className={`p-3 rounded-lg ${styles[variant]}`}>
            <Icon className="h-5 w-5" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function AgentRow({ agent, selected, onSelect }: { agent: CognitiveAgent; selected: boolean; onSelect: () => void }) {
  const color = roleColors[agent.role] || '#6366f1';
  return (
    <div onClick={onSelect} className={`p-4 cursor-pointer transition-colors ${selected ? 'bg-primary/5' : 'hover:bg-muted/50'}`}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg" style={{ backgroundColor: `${color}20`, color }}>
            <Brain className="h-5 w-5" />
          </div>
          <div>
            <h4 className="font-medium">{agent.name}</h4>
            <p className="text-sm text-muted-foreground">{agent.role.replace('_', ' ')} • {agent.primaryModelId.split('/')[1]}</p>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <div className="text-right">
            <p className="text-sm font-medium">{agent.totalActivations.toLocaleString()}</p>
            <p className="text-xs text-muted-foreground">{(agent.successRate * 100).toFixed(0)}% success</p>
          </div>
          <div className={`w-2 h-2 rounded-full ${agent.isActive ? 'bg-emerald-500' : 'bg-muted-foreground/30'}`} />
          <ChevronRight className="h-5 w-5 text-muted-foreground" />
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
    <div onClick={onSelect} className={`p-4 cursor-pointer transition-colors ${selected ? 'bg-primary/5' : 'hover:bg-muted/50'}`}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex -space-x-2">
            {participantColors.map((color, i) => (
              <div key={i} className="w-8 h-8 rounded-full border-2 border-card flex items-center justify-center" style={{ backgroundColor: color }}>
                <Brain className="h-4 w-4 text-white" />
              </div>
            ))}
            {session.participatingAgents.length > 3 && (
              <div className="w-8 h-8 rounded-full border-2 border-card bg-muted flex items-center justify-center text-xs">
                +{session.participatingAgents.length - 3}
              </div>
            )}
          </div>
          <div>
            <h4 className="font-medium truncate max-w-md">{session.goal}</h4>
            <p className="text-sm text-muted-foreground">
              {patternLabels[session.collaborationPattern]} • {session.totalRounds} rounds • {session.totalMessages} messages
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <Badge
            variant="outline"
            className={
              session.status === 'completed' ? 'text-emerald-500 border-emerald-500/30' :
              session.status === 'active' ? 'text-blue-500 border-blue-500/30' :
              'text-red-500 border-red-500/30'
            }
          >
            {session.status}
          </Badge>
          <ChevronRight className="h-5 w-5 text-muted-foreground" />
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
          <span className="text-sm font-medium">{agent?.name || 'System'}</span>
          <span className="text-xs px-1.5 py-0.5 rounded capitalize" style={{ backgroundColor: `${color}20`, color }}>
            {message.messageType}
          </span>
        </div>
        <div className={`p-3 rounded-lg ${isLeft ? 'bg-muted' : 'bg-primary/10'}`}>
          <p className="text-sm">{message.content}</p>
        </div>
        <p className="text-xs text-muted-foreground mt-1">
          Round {message.roundNumber} • {message.confidence ? `${(message.confidence * 100).toFixed(0)}% confident` : ''}
        </p>
      </div>
    </div>
  );
}

function PersonalityBar({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div>
      <div className="flex justify-between text-xs mb-1">
        <span className="text-muted-foreground">{label}</span>
        <span>{(value * 100).toFixed(0)}%</span>
      </div>
      <div className="h-1.5 bg-muted rounded-full overflow-hidden">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${value * 100}%` }} />
      </div>
    </div>
  );
}

function CollaborationButton({ icon: Icon, label, description }: { icon: React.ElementType; label: string; description: string }) {
  return (
    <Button variant="outline" className="w-full justify-start h-auto p-3" asChild>
      <div className="flex items-center gap-3">
        <div className="p-2 bg-primary/10 text-primary rounded-lg">
          <Icon className="h-5 w-5" />
        </div>
        <div className="text-left">
          <p className="font-medium">{label}</p>
          <p className="text-xs text-muted-foreground font-normal">{description}</p>
        </div>
      </div>
    </Button>
  );
}

