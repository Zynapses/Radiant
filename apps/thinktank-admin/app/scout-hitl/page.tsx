'use client';

import { useState, useEffect } from 'react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Switch } from '@/components/ui/switch';
import { Slider } from '@/components/ui/slider';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Brain,
  Compass,
  MessageCircleQuestion,
  Settings,
  TrendingUp,
  RefreshCw,
  CheckCircle,
  XCircle,
  Clock,
} from 'lucide-react';

interface ScoutConfig {
  enabled: boolean;
  voiThreshold: number;
  maxQuestionsPerSession: number;
  defaultDomain: string;
}

interface ScoutSession {
  sessionId: string;
  userId: string;
  domain: string;
  questionsAsked: number;
  assumptionsMade: number;
  remainingUncertainty: number;
  recommendation: string;
  createdAt: string;
}

interface ScoutStatistics {
  totalSessions: number;
  avgQuestionsPerSession: number;
  avgAssumptionsPerSession: number;
  proceedRate: number;
  waitRate: number;
  abortRate: number;
  byDomain: Record<string, number>;
}

export default function ScoutHITLPage() {
  const [activeTab, setActiveTab] = useState('overview');
  const [config, setConfig] = useState<ScoutConfig>({
    enabled: true,
    voiThreshold: 0.3,
    maxQuestionsPerSession: 3,
    defaultDomain: 'general',
  });
  const [sessions, setSessions] = useState<ScoutSession[]>([]);
  const [stats, setStats] = useState<ScoutStatistics | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchData();
  }, []);

  async function fetchData() {
    setLoading(true);
    try {
      const [configRes, sessionsRes, statsRes] = await Promise.all([
        fetch('/api/admin/cato/scout-hitl/config'),
        fetch('/api/admin/cato/scout-hitl/sessions?limit=10'),
        fetch('/api/admin/cato/scout-hitl/statistics'),
      ]);

      if (configRes.ok) {
        const configData = await configRes.json();
        setConfig(configData);
      }
      if (sessionsRes.ok) {
        const sessionsData = await sessionsRes.json();
        setSessions(sessionsData);
      }
      if (statsRes.ok) {
        const statsData = await statsRes.json();
        setStats(statsData);
      }
    } catch (error) {
      console.error('Failed to fetch Scout HITL data:', error);
      // Fallback to mock data
      setStats({
        totalSessions: 234,
        avgQuestionsPerSession: 1.8,
        avgAssumptionsPerSession: 2.4,
        proceedRate: 78,
        waitRate: 15,
        abortRate: 7,
        byDomain: {
          medical: 45,
          financial: 32,
          legal: 28,
          bioinformatics: 12,
          general: 117,
        },
      });
      setSessions([
        {
          sessionId: 'sess-001',
          userId: 'user-123',
          domain: 'medical',
          questionsAsked: 2,
          assumptionsMade: 3,
          remainingUncertainty: 0.15,
          recommendation: 'proceed',
          createdAt: new Date(Date.now() - 3600000).toISOString(),
        },
        {
          sessionId: 'sess-002',
          userId: 'user-456',
          domain: 'financial',
          questionsAsked: 1,
          assumptionsMade: 4,
          remainingUncertainty: 0.22,
          recommendation: 'proceed',
          createdAt: new Date(Date.now() - 7200000).toISOString(),
        },
      ]);
    }
    setLoading(false);
  }

  async function saveConfig() {
    setSaving(true);
    try {
      const res = await fetch('/api/admin/cato/scout-hitl/config', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(config),
      });
      if (!res.ok) throw new Error('Failed to save');
    } catch (error) {
      console.error('Failed to save Scout HITL config:', error);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex-1 space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Scout HITL Integration</h1>
          <p className="text-muted-foreground">
            Epistemic uncertainty clarification through human-in-the-loop
          </p>
        </div>
        <Button onClick={fetchData} variant="outline" size="sm">
          <RefreshCw className="mr-2 h-4 w-4" />
          Refresh
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Total Sessions</CardTitle>
            <Compass className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.totalSessions || 0}</div>
            <p className="text-xs text-muted-foreground">Scout clarification sessions</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Avg Questions</CardTitle>
            <MessageCircleQuestion className="h-4 w-4 text-purple-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {stats?.avgQuestionsPerSession.toFixed(1) || 0}
            </div>
            <p className="text-xs text-muted-foreground">Per session average</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Proceed Rate</CardTitle>
            <TrendingUp className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{stats?.proceedRate || 0}%</div>
            <p className="text-xs text-muted-foreground">Sessions that proceeded</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Avg Assumptions</CardTitle>
            <Brain className="h-4 w-4 text-amber-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {stats?.avgAssumptionsPerSession.toFixed(1) || 0}
            </div>
            <p className="text-xs text-muted-foreground">Auto-assumed per session</p>
          </CardContent>
        </Card>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="sessions">Recent Sessions</TabsTrigger>
          <TabsTrigger value="config">Configuration</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Session Recommendations</CardTitle>
                <CardDescription>How Scout sessions concluded</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <CheckCircle className="h-4 w-4 text-green-500" />
                      <span>Proceed</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{stats?.proceedRate || 0}%</span>
                      <Progress value={stats?.proceedRate || 0} className="w-24 h-2" />
                    </div>
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Clock className="h-4 w-4 text-amber-500" />
                      <span>Wait</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{stats?.waitRate || 0}%</span>
                      <Progress value={stats?.waitRate || 0} className="w-24 h-2" />
                    </div>
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <XCircle className="h-4 w-4 text-red-500" />
                      <span>Abort</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{stats?.abortRate || 0}%</span>
                      <Progress value={stats?.abortRate || 0} className="w-24 h-2" />
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Sessions by Domain</CardTitle>
                <CardDescription>Distribution across specialized domains</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {stats &&
                    Object.entries(stats.byDomain).map(([domain, count]) => (
                      <div key={domain} className="flex items-center justify-between">
                        <span className="capitalize">{domain}</span>
                        <Badge variant="outline">{count}</Badge>
                      </div>
                    ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="sessions" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Recent Clarification Sessions</CardTitle>
              <CardDescription>Scout persona HITL clarification history</CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Session</TableHead>
                    <TableHead>User</TableHead>
                    <TableHead>Domain</TableHead>
                    <TableHead>Questions</TableHead>
                    <TableHead>Assumptions</TableHead>
                    <TableHead>Result</TableHead>
                    <TableHead>Time</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sessions.map((session) => (
                    <TableRow key={session.sessionId}>
                      <TableCell className="font-mono text-xs">{session.sessionId}</TableCell>
                      <TableCell>{session.userId}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className="capitalize">
                          {session.domain}
                        </Badge>
                      </TableCell>
                      <TableCell>{session.questionsAsked}</TableCell>
                      <TableCell>{session.assumptionsMade}</TableCell>
                      <TableCell>
                        <Badge
                          variant={
                            session.recommendation === 'proceed'
                              ? 'default'
                              : session.recommendation === 'wait'
                              ? 'secondary'
                              : 'destructive'
                          }
                        >
                          {session.recommendation}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-muted-foreground text-xs">
                        {new Date(session.createdAt).toLocaleTimeString()}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="config" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Scout HITL Configuration</CardTitle>
              <CardDescription>Configure how Scout handles epistemic uncertainty</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <Label>Enable Scout HITL</Label>
                  <p className="text-sm text-muted-foreground">
                    Allow Scout to ask clarifying questions
                  </p>
                </div>
                <Switch
                  checked={config.enabled}
                  onCheckedChange={(v) => setConfig((c) => ({ ...c, enabled: v }))}
                />
              </div>

              <div>
                <Label>VOI Threshold</Label>
                <p className="text-sm text-muted-foreground mb-2">
                  Minimum value-of-information to ask a question
                </p>
                <div className="flex items-center gap-4">
                  <Slider
                    value={[config.voiThreshold * 100]}
                    onValueChange={([v]) => setConfig((c) => ({ ...c, voiThreshold: v / 100 }))}
                    min={10}
                    max={90}
                    step={5}
                    className="flex-1"
                  />
                  <span className="w-12 text-right font-medium">
                    {(config.voiThreshold * 100).toFixed(0)}%
                  </span>
                </div>
              </div>

              <div>
                <Label>Max Questions Per Session</Label>
                <p className="text-sm text-muted-foreground mb-2">
                  Maximum clarifications before proceeding with assumptions
                </p>
                <Input
                  type="number"
                  value={config.maxQuestionsPerSession}
                  onChange={(e) =>
                    setConfig((c) => ({
                      ...c,
                      maxQuestionsPerSession: parseInt(e.target.value) || 3,
                    }))
                  }
                  min={1}
                  max={5}
                  className="w-24"
                />
              </div>

              <div>
                <Label>Default Domain</Label>
                <p className="text-sm text-muted-foreground mb-2">
                  Domain to use when not detected automatically
                </p>
                <Select
                  value={config.defaultDomain}
                  onValueChange={(v) => setConfig((c) => ({ ...c, defaultDomain: v }))}
                >
                  <SelectTrigger className="w-48">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="general">General</SelectItem>
                    <SelectItem value="medical">Medical</SelectItem>
                    <SelectItem value="financial">Financial</SelectItem>
                    <SelectItem value="legal">Legal</SelectItem>
                    <SelectItem value="bioinformatics">Bioinformatics</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="flex justify-end pt-4 border-t">
                <Button onClick={saveConfig} disabled={saving}>
                  <Settings className="mr-2 h-4 w-4" />
                  {saving ? 'Saving...' : 'Save Configuration'}
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
