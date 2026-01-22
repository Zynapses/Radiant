'use client';

import { useState, useEffect, useRef } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Progress } from '@/components/ui/progress';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Swords,
  RefreshCw,
  AlertTriangle,
  Play,
  Pause,
  SkipForward,
  Users,
  MessageSquare,
  Award,
  Clock,
  Zap,
  Brain,
  Shield,
  Lightbulb,
  Scale,
  ThumbsUp,
  ThumbsDown,
  History,
} from 'lucide-react';

type DebateStatus = 'setup' | 'active' | 'voting' | 'concluded' | 'deadlocked';
type MemberRole = 'advocate' | 'critic' | 'synthesizer' | 'specialist' | 'contrarian';
type VerdictOutcome = 'consensus' | 'majority' | 'split' | 'deadlock' | 'synthesized';

interface CouncilMember {
  id: string;
  name: string;
  model: string;
  role: MemberRole;
  avatar: string;
  color: string;
  personality: string;
}

interface Argument {
  id: string;
  memberId: string;
  position: string;
  reasoning: string;
  evidence?: string[];
  confidence: number;
  timestamp: string;
}

interface Rebuttal {
  id: string;
  memberId: string;
  targetArgumentId: string;
  counterpoint: string;
  strength: number;
  timestamp: string;
}

interface DebateRound {
  number: number;
  phase: string;
  arguments: Argument[];
  rebuttals: Rebuttal[];
}

interface Verdict {
  outcome: VerdictOutcome;
  summary: string;
  winningPosition?: string;
  confidence: number;
  synthesizedAnswer?: string;
}

interface Debate {
  id: string;
  councilId: string;
  topic: string;
  context: string;
  rounds: DebateRound[];
  currentRound: number;
  status: DebateStatus;
  verdict?: Verdict;
  startedAt: string;
  completedAt?: string;
}

interface Council {
  id: string;
  name: string;
  description: string;
  members: CouncilMember[];
  status: string;
}

const ROLE_ICONS: Record<MemberRole, React.ReactNode> = {
  advocate: <ThumbsUp className="h-4 w-4" />,
  critic: <ThumbsDown className="h-4 w-4" />,
  synthesizer: <Brain className="h-4 w-4" />,
  specialist: <Lightbulb className="h-4 w-4" />,
  contrarian: <Zap className="h-4 w-4" />,
};

const ROLE_COLORS: Record<MemberRole, string> = {
  advocate: 'bg-green-500',
  critic: 'bg-red-500',
  synthesizer: 'bg-purple-500',
  specialist: 'bg-blue-500',
  contrarian: 'bg-orange-500',
};

const STATUS_BADGES: Record<DebateStatus, { color: string; label: string }> = {
  setup: { color: 'bg-gray-500', label: 'Setting Up' },
  active: { color: 'bg-green-500', label: 'In Progress' },
  voting: { color: 'bg-yellow-500', label: 'Voting' },
  concluded: { color: 'bg-blue-500', label: 'Concluded' },
  deadlocked: { color: 'bg-red-500', label: 'Deadlocked' },
};

export default function WarRoomPage() {
  const [loading, setLoading] = useState(true);
  const [councils, setCouncils] = useState<Council[]>([]);
  const [activeDebate, setActiveDebate] = useState<Debate | null>(null);
  const [recentDebates, setRecentDebates] = useState<Debate[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [newTopic, setNewTopic] = useState('');
  const [newContext, setNewContext] = useState('');
  const [selectedCouncil, setSelectedCouncil] = useState<string | null>(null);
  const [isLive, setIsLive] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [councilsRes, debatesRes] = await Promise.all([
        fetch('/api/admin/council/list'),
        fetch('/api/admin/council/debates/recent'),
      ]);

      if (councilsRes.ok) {
        setCouncils(await councilsRes.json());
      }
      if (debatesRes.ok) {
        const debates = await debatesRes.json();
        setRecentDebates(debates);
        const active = debates.find((d: Debate) => d.status === 'active');
        if (active) setActiveDebate(active);
      }
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load war room data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  useEffect(() => {
    if (!isLive || !activeDebate?.id) return;
    
    const debateId = activeDebate.id;
    const interval = setInterval(async () => {
      try {
        const res = await fetch(`/api/admin/council/debates/${debateId}`);
        if (res.ok) {
          setActiveDebate(await res.json());
        }
      } catch {
        // Ignore polling errors
      }
    }, 2000);
    return () => clearInterval(interval);
  }, [isLive, activeDebate?.id]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [activeDebate?.rounds]);

  const startDebate = async () => {
    if (!selectedCouncil || !newTopic) return;

    try {
      const res = await fetch('/api/admin/council/debates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          councilId: selectedCouncil,
          topic: newTopic,
          context: newContext,
        }),
      });

      if (res.ok) {
        const debate = await res.json();
        setActiveDebate(debate);
        setIsLive(true);
        setNewTopic('');
        setNewContext('');
      }
    } catch (err) {
      setError('Failed to start debate');
    }
  };

  const advanceDebate = async () => {
    if (!activeDebate) return;

    try {
      const res = await fetch(`/api/admin/council/debates/${activeDebate.id}/advance`, {
        method: 'POST',
      });

      if (res.ok) {
        setActiveDebate(await res.json());
      }
    } catch (err) {
      setError('Failed to advance debate');
    }
  };

  const getMemberById = (memberId: string): CouncilMember | undefined => {
    const council = councils.find(c => c.id === activeDebate?.councilId);
    return council?.members.find(m => m.id === memberId);
  };

  if (loading && councils.length === 0) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-3">
            <Swords className="h-8 w-8 text-orange-500" />
            War Room
          </h1>
          <p className="text-muted-foreground">
            Council of Rivals - Multi-Agent Adversarial Debate Arena
          </p>
        </div>
        <div className="flex items-center gap-2">
          {activeDebate && (
            <Button
              variant={isLive ? 'default' : 'outline'}
              onClick={() => setIsLive(!isLive)}
            >
              {isLive ? <Pause className="h-4 w-4 mr-2" /> : <Play className="h-4 w-4 mr-2" />}
              {isLive ? 'Pause Live' : 'Go Live'}
            </Button>
          )}
          <Button variant="outline" onClick={fetchData} disabled={loading}>
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Debate Arena - Main View */}
        <div className="lg:col-span-2 space-y-4">
          {activeDebate ? (
            <Card className="border-2 border-orange-500/30">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      <Swords className="h-5 w-5 text-orange-500" />
                      {activeDebate.topic}
                    </CardTitle>
                    <CardDescription>{activeDebate.context}</CardDescription>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge className={STATUS_BADGES[activeDebate.status].color}>
                      {STATUS_BADGES[activeDebate.status].label}
                    </Badge>
                    <Badge variant="outline">
                      Round {activeDebate.currentRound}
                    </Badge>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {/* Amphitheater Layout */}
                <div className="relative mb-4">
                  <div className="flex justify-center gap-4 mb-6">
                    {councils
                      .find(c => c.id === activeDebate.councilId)
                      ?.members.map((member, i) => (
                        <div
                          key={member.id}
                          className="flex flex-col items-center"
                          style={{
                            transform: `translateY(${Math.abs(i - 2) * 10}px)`,
                          }}
                        >
                          <div
                            className={`w-12 h-12 rounded-full flex items-center justify-center text-white ${ROLE_COLORS[member.role]}`}
                          >
                            {ROLE_ICONS[member.role]}
                          </div>
                          <span className="text-xs mt-1 font-medium">{member.name}</span>
                          <span className="text-xs text-muted-foreground">{member.role}</span>
                        </div>
                      ))}
                  </div>

                  {/* Center podium */}
                  <div className="flex justify-center">
                    <div className="w-24 h-2 bg-gradient-to-r from-transparent via-orange-500/50 to-transparent rounded-full" />
                  </div>
                </div>

                {/* Debate Transcript */}
                <ScrollArea className="h-[400px] border rounded-lg p-4" ref={scrollRef}>
                  {activeDebate.rounds.map((round) => (
                    <div key={round.number} className="mb-6">
                      <div className="flex items-center gap-2 mb-3">
                        <Badge variant="outline">Round {round.number}</Badge>
                        <span className="text-sm text-muted-foreground capitalize">
                          {round.phase}
                        </span>
                      </div>

                      {/* Arguments */}
                      {round.arguments.map((arg) => {
                        const member = getMemberById(arg.memberId);
                        return (
                          <div
                            key={arg.id}
                            className="mb-3 p-3 rounded-lg bg-muted/50 border-l-4"
                            style={{ borderColor: member?.color || '#666' }}
                          >
                            <div className="flex items-center gap-2 mb-1">
                              <span className="font-medium">{member?.name || 'Unknown'}</span>
                              <Badge variant="secondary" className="text-xs">
                                {member?.role}
                              </Badge>
                              <span className="text-xs text-muted-foreground ml-auto">
                                {new Date(arg.timestamp).toLocaleTimeString()}
                              </span>
                            </div>
                            <p className="text-sm font-medium mb-1">{arg.position}</p>
                            <p className="text-sm text-muted-foreground">{arg.reasoning}</p>
                            {arg.evidence && arg.evidence.length > 0 && (
                              <div className="mt-2 flex flex-wrap gap-1">
                                {arg.evidence.map((e, i) => (
                                  <Badge key={i} variant="outline" className="text-xs">
                                    {e}
                                  </Badge>
                                ))}
                              </div>
                            )}
                            <div className="mt-2">
                              <Progress value={arg.confidence * 100} className="h-1" />
                              <span className="text-xs text-muted-foreground">
                                Confidence: {(arg.confidence * 100).toFixed(0)}%
                              </span>
                            </div>
                          </div>
                        );
                      })}

                      {/* Rebuttals */}
                      {round.rebuttals.map((reb) => {
                        const member = getMemberById(reb.memberId);
                        return (
                          <div
                            key={reb.id}
                            className="mb-3 ml-6 p-3 rounded-lg bg-red-500/10 border-l-4 border-red-500"
                          >
                            <div className="flex items-center gap-2 mb-1">
                              <Swords className="h-3 w-3 text-red-500" />
                              <span className="font-medium">{member?.name || 'Unknown'}</span>
                              <span className="text-xs text-muted-foreground">rebuts</span>
                            </div>
                            <p className="text-sm">{reb.counterpoint}</p>
                            <div className="mt-1">
                              <span className="text-xs text-muted-foreground">
                                Strength: {(reb.strength * 100).toFixed(0)}%
                              </span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ))}

                  {/* Verdict */}
                  {activeDebate.verdict && (
                    <div className="mt-4 p-4 rounded-lg bg-gradient-to-r from-purple-500/20 to-blue-500/20 border border-purple-500/30">
                      <div className="flex items-center gap-2 mb-2">
                        <Award className="h-5 w-5 text-purple-500" />
                        <span className="font-bold">Verdict: {activeDebate.verdict.outcome}</span>
                        <Badge variant="default">
                          {(activeDebate.verdict.confidence * 100).toFixed(0)}% confidence
                        </Badge>
                      </div>
                      <p className="text-sm mb-2">{activeDebate.verdict.summary}</p>
                      {activeDebate.verdict.synthesizedAnswer && (
                        <div className="mt-2 p-2 bg-background rounded border">
                          <span className="text-xs font-medium text-muted-foreground">
                            Synthesized Answer:
                          </span>
                          <p className="text-sm">{activeDebate.verdict.synthesizedAnswer}</p>
                        </div>
                      )}
                    </div>
                  )}
                </ScrollArea>

                {/* Controls */}
                {activeDebate.status === 'active' && (
                  <div className="flex justify-center mt-4">
                    <Button onClick={advanceDebate}>
                      <SkipForward className="h-4 w-4 mr-2" />
                      Advance Round
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardHeader>
                <CardTitle>Start a New Debate</CardTitle>
                <CardDescription>
                  Select a council and enter a topic for adversarial review
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-4 md:grid-cols-2">
                  {councils.map((council) => (
                    <Card
                      key={council.id}
                      className={`cursor-pointer transition-all ${
                        selectedCouncil === council.id
                          ? 'ring-2 ring-primary'
                          : 'hover:bg-accent'
                      }`}
                      onClick={() => setSelectedCouncil(council.id)}
                    >
                      <CardHeader className="pb-2">
                        <CardTitle className="text-lg flex items-center gap-2">
                          <Users className="h-4 w-4" />
                          {council.name}
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <p className="text-sm text-muted-foreground mb-2">
                          {council.description}
                        </p>
                        <div className="flex flex-wrap gap-1">
                          {council.members.map((m) => (
                            <Badge
                              key={m.id}
                              variant="secondary"
                              className="text-xs"
                            >
                              {m.name}
                            </Badge>
                          ))}
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>

                <div className="space-y-3">
                  <Input
                    placeholder="Debate topic (e.g., 'Should we use microservices for this feature?')"
                    value={newTopic}
                    onChange={(e) => setNewTopic(e.target.value)}
                  />
                  <Textarea
                    placeholder="Additional context (optional)"
                    value={newContext}
                    onChange={(e) => setNewContext(e.target.value)}
                    rows={3}
                  />
                  <Button
                    className="w-full"
                    disabled={!selectedCouncil || !newTopic}
                    onClick={startDebate}
                  >
                    <Swords className="h-4 w-4 mr-2" />
                    Start Debate
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Sidebar */}
        <div className="space-y-4">
          {/* Council Members */}
          {activeDebate && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-lg flex items-center gap-2">
                  <Users className="h-4 w-4" />
                  Council Members
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {councils
                    .find(c => c.id === activeDebate.councilId)
                    ?.members.map((member) => (
                      <div
                        key={member.id}
                        className="flex items-center gap-3 p-2 rounded-lg bg-muted/50"
                      >
                        <div
                          className={`w-8 h-8 rounded-full flex items-center justify-center text-white ${ROLE_COLORS[member.role]}`}
                        >
                          {ROLE_ICONS[member.role]}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-sm truncate">{member.name}</p>
                          <p className="text-xs text-muted-foreground truncate">
                            {member.model}
                          </p>
                        </div>
                        <Badge variant="secondary" className="text-xs capitalize">
                          {member.role}
                        </Badge>
                      </div>
                    ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Recent Debates */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-lg flex items-center gap-2">
                <History className="h-4 w-4" />
                Recent Debates
              </CardTitle>
            </CardHeader>
            <CardContent>
              {recentDebates.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">
                  No recent debates
                </p>
              ) : (
                <div className="space-y-2">
                  {recentDebates.slice(0, 5).map((debate) => (
                    <div
                      key={debate.id}
                      className="p-2 rounded-lg bg-muted/50 cursor-pointer hover:bg-muted"
                      onClick={() => setActiveDebate(debate)}
                    >
                      <p className="text-sm font-medium truncate">{debate.topic}</p>
                      <div className="flex items-center gap-2 mt-1">
                        <Badge
                          variant="secondary"
                          className={`text-xs ${STATUS_BADGES[debate.status].color} text-white`}
                        >
                          {STATUS_BADGES[debate.status].label}
                        </Badge>
                        <span className="text-xs text-muted-foreground">
                          {new Date(debate.startedAt).toLocaleDateString()}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Stats */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-lg flex items-center gap-2">
                <Scale className="h-4 w-4" />
                Debate Statistics
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-3">
                <div className="text-center p-3 bg-muted/50 rounded-lg">
                  <p className="text-2xl font-bold">{recentDebates.length}</p>
                  <p className="text-xs text-muted-foreground">Total Debates</p>
                </div>
                <div className="text-center p-3 bg-green-500/10 rounded-lg">
                  <p className="text-2xl font-bold text-green-600">
                    {recentDebates.filter(d => d.verdict?.outcome === 'consensus').length}
                  </p>
                  <p className="text-xs text-muted-foreground">Consensus</p>
                </div>
                <div className="text-center p-3 bg-yellow-500/10 rounded-lg">
                  <p className="text-2xl font-bold text-yellow-600">
                    {recentDebates.filter(d => d.verdict?.outcome === 'majority').length}
                  </p>
                  <p className="text-xs text-muted-foreground">Majority</p>
                </div>
                <div className="text-center p-3 bg-red-500/10 rounded-lg">
                  <p className="text-2xl font-bold text-red-600">
                    {recentDebates.filter(d => d.status === 'deadlocked').length}
                  </p>
                  <p className="text-xs text-muted-foreground">Deadlocked</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
