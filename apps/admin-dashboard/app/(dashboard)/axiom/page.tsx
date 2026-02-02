'use client';

/**
 * AXIOM Admin Dashboard Page
 * 
 * Provides management capabilities for the AXIOM/CLARION subsystem:
 * - View and edit domain taxonomy with Axiom configurations
 * - Monitor learning health metrics across all tenants
 * - Review and approve/reject Cato-proposed pattern changes
 * - Configure global Axiom parameters (thresholds, weights)
 * - A/B test management for prompt variants
 * - Manual pattern injection for new domains
 * 
 * @version 2.0.0
 * @since RADIANT v6.0.0
 */

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { 
  Sparkles, 
  Brain, 
  MessageSquareQuestion,
  FlaskConical,
  Settings,
  TrendingUp,
  Check,
  X,
  Plus,
  RefreshCw,
  AlertTriangle,
  Building2,
  Flag,
  FileText,
} from 'lucide-react';

// API base
const API_BASE = '/api/admin/axiom';

// Types
interface DashboardData {
  overview: {
    totalSessions: number;
    activeSessions: number;
    completedSessions: number;
    averageConfidence: number;
    averageQuestionsAsked: number;
  };
  patterns: {
    totalPatterns: number;
    humanCurated: number;
    evolved: number;
    invented: number;
    pendingApproval: number;
    averageSuccessRate: number;
  };
  questions: {
    totalQuestions: number;
    activeQuestions: number;
    averageInformationGain: number;
    averageSkipRate: number;
  };
  tenants: {
    totalTenants: number;
    tenantsWithCustomConfig: number;
    tenantsUsingAxiom: number;
  };
  recentSessions: Array<{
    session_id: string;
    tenant_id: string;
    domain: string;
    status: string;
    current_confidence: number;
    created_at: string;
  }>;
  pendingPatterns: Array<{
    pattern_id: string;
    domain_id: string;
    pattern_type: string;
    origin: string;
    fitness_score?: number;
  }>;
}

interface GlobalConfig {
  maxQuestions: number;
  confidenceThreshold: number;
  minInformationGain: number;
  sessionTimeoutMinutes: number;
  maxPatternsRetrieved: number;
  minPatternScore: number;
  compilationTimeoutMs: number;
  variantGenerationCount: number;
  enableNeuralScoring: boolean;
  enableCatoLearning: boolean;
}

interface ABTest {
  test_id: string;
  name: string;
  domain_id: string;
  variants: any[];
  traffic_split: { control: number; variant: number };
  status: string;
  created_at: string;
}

export default function AxiomAdminPage() {
  const [activeTab, setActiveTab] = useState('overview');
  const [dashboard, setDashboard] = useState<DashboardData | null>(null);
  const [config, setConfig] = useState<GlobalConfig | null>(null);
  const [abTests, setAbTests] = useState<ABTest[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Load initial data
  useEffect(() => {
    loadDashboard();
    loadConfig();
    loadABTests();
  }, []);

  const loadDashboard = async () => {
    try {
      const res = await fetch(`${API_BASE}/dashboard`);
      const data = await res.json();
      setDashboard(data);
    } catch (error) {
      console.error('Failed to load dashboard:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadConfig = async () => {
    try {
      const res = await fetch(`${API_BASE}/config`);
      const data = await res.json();
      setConfig(data.config);
    } catch (error) {
      console.error('Failed to load config:', error);
    }
  };

  const loadABTests = async () => {
    try {
      const res = await fetch(`${API_BASE}/ab-tests`);
      const data = await res.json();
      setAbTests(data.tests || []);
    } catch (error) {
      console.error('Failed to load A/B tests:', error);
    }
  };

  const saveConfig = async () => {
    if (!config) return;
    setSaving(true);
    try {
      await fetch(`${API_BASE}/config`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(config),
      });
    } catch (error) {
      console.error('Failed to save config:', error);
    } finally {
      setSaving(false);
    }
  };

  const approvePattern = async (patternId: string) => {
    try {
      await fetch(`${API_BASE}/patterns/${patternId}/approve`, { method: 'POST' });
      loadDashboard();
    } catch (error) {
      console.error('Failed to approve pattern:', error);
    }
  };

  const rejectPattern = async (patternId: string) => {
    try {
      await fetch(`${API_BASE}/patterns/${patternId}/reject`, { method: 'POST' });
      loadDashboard();
    } catch (error) {
      console.error('Failed to reject pattern:', error);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <RefreshCw className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="container mx-auto py-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-indigo-500/10">
            <Sparkles className="w-6 h-6 text-indigo-500" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">AXIOM Management</h1>
            <p className="text-sm text-muted-foreground">
              Adaptive prompt optimization and CLARION questioning system
            </p>
          </div>
        </div>
        <Button onClick={loadDashboard} variant="outline" size="sm">
          <RefreshCw className="w-4 h-4 mr-2" />
          Refresh
        </Button>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="overview" className="flex items-center gap-2">
            <TrendingUp className="w-4 h-4" />
            Overview
          </TabsTrigger>
          <TabsTrigger value="patterns" className="flex items-center gap-2">
            <FileText className="w-4 h-4" />
            Patterns
          </TabsTrigger>
          <TabsTrigger value="questions" className="flex items-center gap-2">
            <MessageSquareQuestion className="w-4 h-4" />
            Questions
          </TabsTrigger>
          <TabsTrigger value="ab-tests" className="flex items-center gap-2">
            <FlaskConical className="w-4 h-4" />
            A/B Tests
          </TabsTrigger>
          <TabsTrigger value="config" className="flex items-center gap-2">
            <Settings className="w-4 h-4" />
            Configuration
          </TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview" className="space-y-6">
          {/* Metrics Cards */}
          <div className="grid grid-cols-4 gap-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Total Sessions
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {dashboard?.overview.totalSessions.toLocaleString()}
                </div>
                <p className="text-xs text-muted-foreground">
                  {dashboard?.overview.activeSessions} active
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Avg Confidence
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {((dashboard?.overview.averageConfidence || 0) * 100).toFixed(1)}%
                </div>
                <p className="text-xs text-muted-foreground">
                  {(dashboard?.overview.averageQuestionsAsked || 0).toFixed(1)} avg questions
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Total Patterns
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {dashboard?.patterns.totalPatterns.toLocaleString()}
                </div>
                <p className="text-xs text-muted-foreground">
                  {dashboard?.patterns.pendingApproval} pending approval
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Tenants Using AXIOM
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {dashboard?.tenants.tenantsUsingAxiom}
                </div>
                <p className="text-xs text-muted-foreground">
                  {dashboard?.tenants.tenantsWithCustomConfig} with custom config
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Pattern Origin Breakdown */}
          <div className="grid grid-cols-2 gap-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Pattern Origins</CardTitle>
                <CardDescription>How patterns were created</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-sm">Human Curated</span>
                    <Badge variant="secondary">{dashboard?.patterns.humanCurated}</Badge>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm">CATO Evolved</span>
                    <Badge variant="secondary">{dashboard?.patterns.evolved}</Badge>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm">CATO Invented</span>
                    <Badge variant="secondary">{dashboard?.patterns.invented}</Badge>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm">Avg Success Rate</span>
                    <Badge variant="outline">
                      {((dashboard?.patterns.averageSuccessRate || 0) * 100).toFixed(1)}%
                    </Badge>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Question Stats</CardTitle>
                <CardDescription>CLARION question performance</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-sm">Total Questions</span>
                    <Badge variant="secondary">{dashboard?.questions.totalQuestions}</Badge>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm">Active Questions</span>
                    <Badge variant="secondary">{dashboard?.questions.activeQuestions}</Badge>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm">Avg Information Gain</span>
                    <Badge variant="outline">
                      {((dashboard?.questions.averageInformationGain || 0) * 100).toFixed(1)}%
                    </Badge>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm">Avg Skip Rate</span>
                    <Badge variant="outline">
                      {((dashboard?.questions.averageSkipRate || 0) * 100).toFixed(1)}%
                    </Badge>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Recent Sessions */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Recent Sessions</CardTitle>
              <CardDescription>Latest AXIOM optimization sessions</CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Session ID</TableHead>
                    <TableHead>Tenant</TableHead>
                    <TableHead>Domain</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Confidence</TableHead>
                    <TableHead>Created</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {dashboard?.recentSessions.map((session) => (
                    <TableRow key={session.session_id}>
                      <TableCell className="font-mono text-sm">
                        {session.session_id.slice(0, 8)}...
                      </TableCell>
                      <TableCell>{session.tenant_id}</TableCell>
                      <TableCell>{session.domain}</TableCell>
                      <TableCell>
                        <Badge
                          variant={
                            session.status === 'completed'
                              ? 'default'
                              : session.status === 'active'
                              ? 'secondary'
                              : 'outline'
                          }
                        >
                          {session.status}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {(session.current_confidence * 100).toFixed(0)}%
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {new Date(session.created_at).toLocaleString()}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Patterns Tab */}
        <TabsContent value="patterns" className="space-y-6">
          {/* Pending Approval */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <AlertTriangle className="w-5 h-5 text-yellow-500" />
                    Pending Approval
                  </CardTitle>
                  <CardDescription>
                    CATO-evolved patterns requiring human review
                  </CardDescription>
                </div>
                <InjectPatternDialog onSuccess={loadDashboard} />
              </div>
            </CardHeader>
            <CardContent>
              {dashboard?.pendingPatterns.length === 0 ? (
                <p className="text-muted-foreground text-center py-8">
                  No patterns pending approval
                </p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Pattern ID</TableHead>
                      <TableHead>Domain</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Origin</TableHead>
                      <TableHead>Fitness Score</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {dashboard?.pendingPatterns.map((pattern) => (
                      <TableRow key={pattern.pattern_id}>
                        <TableCell className="font-mono text-sm">
                          {pattern.pattern_id.slice(0, 12)}...
                        </TableCell>
                        <TableCell>{pattern.domain_id}</TableCell>
                        <TableCell>{pattern.pattern_type}</TableCell>
                        <TableCell>
                          <Badge variant="secondary">{pattern.origin}</Badge>
                        </TableCell>
                        <TableCell>
                          {pattern.fitness_score
                            ? `${(pattern.fitness_score * 100).toFixed(1)}%`
                            : 'N/A'}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => approvePattern(pattern.pattern_id)}
                            >
                              <Check className="w-4 h-4 text-green-500" />
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => rejectPattern(pattern.pattern_id)}
                            >
                              <X className="w-4 h-4 text-red-500" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Questions Tab */}
        <TabsContent value="questions" className="space-y-6">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-lg">CLARION Questions</CardTitle>
                  <CardDescription>
                    Manage adaptive questioning system
                  </CardDescription>
                </div>
                <CreateQuestionDialog onSuccess={loadDashboard} />
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground text-center py-8">
                Question management interface - view, create, and edit CLARION questions
              </p>
            </CardContent>
          </Card>
        </TabsContent>

        {/* A/B Tests Tab */}
        <TabsContent value="ab-tests" className="space-y-6">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-lg">A/B Tests</CardTitle>
                  <CardDescription>
                    Manage prompt variant experiments
                  </CardDescription>
                </div>
                <CreateABTestDialog onSuccess={loadABTests} />
              </div>
            </CardHeader>
            <CardContent>
              {abTests.length === 0 ? (
                <p className="text-muted-foreground text-center py-8">
                  No A/B tests configured
                </p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Domain</TableHead>
                      <TableHead>Traffic Split</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Created</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {abTests.map((test) => (
                      <TableRow key={test.test_id}>
                        <TableCell className="font-medium">{test.name}</TableCell>
                        <TableCell>{test.domain_id}</TableCell>
                        <TableCell>
                          {test.traffic_split.control}% / {test.traffic_split.variant}%
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant={test.status === 'active' ? 'default' : 'secondary'}
                          >
                            {test.status}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {new Date(test.created_at).toLocaleDateString()}
                        </TableCell>
                        <TableCell>
                          <Button size="sm" variant="ghost">
                            View
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Configuration Tab */}
        <TabsContent value="config" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Global Configuration</CardTitle>
              <CardDescription>
                Configure AXIOM/CLARION system parameters
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {config && (
                <>
                  {/* Session Settings */}
                  <div className="space-y-4">
                    <h3 className="text-sm font-medium">Session Settings</h3>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>Max Questions</Label>
                        <Input
                          type="number"
                          value={config.maxQuestions}
                          onChange={(e) =>
                            setConfig({ ...config, maxQuestions: parseInt(e.target.value) })
                          }
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Session Timeout (minutes)</Label>
                        <Input
                          type="number"
                          value={config.sessionTimeoutMinutes}
                          onChange={(e) =>
                            setConfig({
                              ...config,
                              sessionTimeoutMinutes: parseInt(e.target.value),
                            })
                          }
                        />
                      </div>
                    </div>
                  </div>

                  {/* Confidence Settings */}
                  <div className="space-y-4">
                    <h3 className="text-sm font-medium">Confidence Thresholds</h3>
                    <div className="space-y-4">
                      <div className="space-y-2">
                        <div className="flex justify-between">
                          <Label>Confidence Threshold</Label>
                          <span className="text-sm text-muted-foreground">
                            {(config.confidenceThreshold * 100).toFixed(0)}%
                          </span>
                        </div>
                        <Slider
                          value={[config.confidenceThreshold * 100]}
                          onValueChange={([v]) =>
                            setConfig({ ...config, confidenceThreshold: v / 100 })
                          }
                          max={100}
                          step={5}
                        />
                      </div>
                      <div className="space-y-2">
                        <div className="flex justify-between">
                          <Label>Min Information Gain</Label>
                          <span className="text-sm text-muted-foreground">
                            {(config.minInformationGain * 100).toFixed(0)}%
                          </span>
                        </div>
                        <Slider
                          value={[config.minInformationGain * 100]}
                          onValueChange={([v]) =>
                            setConfig({ ...config, minInformationGain: v / 100 })
                          }
                          max={100}
                          step={5}
                        />
                      </div>
                    </div>
                  </div>

                  {/* Pattern Settings */}
                  <div className="space-y-4">
                    <h3 className="text-sm font-medium">Pattern Settings</h3>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>Max Patterns Retrieved</Label>
                        <Input
                          type="number"
                          value={config.maxPatternsRetrieved}
                          onChange={(e) =>
                            setConfig({
                              ...config,
                              maxPatternsRetrieved: parseInt(e.target.value),
                            })
                          }
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Variant Generation Count</Label>
                        <Input
                          type="number"
                          value={config.variantGenerationCount}
                          onChange={(e) =>
                            setConfig({
                              ...config,
                              variantGenerationCount: parseInt(e.target.value),
                            })
                          }
                        />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <div className="flex justify-between">
                        <Label>Min Pattern Score</Label>
                        <span className="text-sm text-muted-foreground">
                          {(config.minPatternScore * 100).toFixed(0)}%
                        </span>
                      </div>
                      <Slider
                        value={[config.minPatternScore * 100]}
                        onValueChange={([v]) =>
                          setConfig({ ...config, minPatternScore: v / 100 })
                        }
                        max={100}
                        step={5}
                      />
                    </div>
                  </div>

                  {/* Feature Toggles */}
                  <div className="space-y-4">
                    <h3 className="text-sm font-medium">Feature Toggles</h3>
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <Label>Neural Scoring</Label>
                          <p className="text-xs text-muted-foreground">
                            Use CORTEX networks for question/model scoring
                          </p>
                        </div>
                        <Switch
                          checked={config.enableNeuralScoring}
                          onCheckedChange={(v) =>
                            setConfig({ ...config, enableNeuralScoring: v })
                          }
                        />
                      </div>
                      <div className="flex items-center justify-between">
                        <div>
                          <Label>CATO Learning</Label>
                          <p className="text-xs text-muted-foreground">
                            Allow CATO to evolve and invent patterns
                          </p>
                        </div>
                        <Switch
                          checked={config.enableCatoLearning}
                          onCheckedChange={(v) =>
                            setConfig({ ...config, enableCatoLearning: v })
                          }
                        />
                      </div>
                    </div>
                  </div>

                  {/* Save Button */}
                  <div className="flex justify-end">
                    <Button onClick={saveConfig} disabled={saving}>
                      {saving ? (
                        <>
                          <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                          Saving...
                        </>
                      ) : (
                        'Save Configuration'
                      )}
                    </Button>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

// =============================================================================
// Dialog Components
// =============================================================================

function InjectPatternDialog({ onSuccess }: { onSuccess: () => void }) {
  const [open, setOpen] = useState(false);
  const [domainId, setDomainId] = useState('');
  const [type, setType] = useState('system');
  const [content, setContent] = useState('');

  const handleSubmit = async () => {
    try {
      await fetch(`${API_BASE}/patterns`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ domainId, type, content }),
      });
      setOpen(false);
      onSuccess();
    } catch (error) {
      console.error('Failed to inject pattern:', error);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm">
          <Plus className="w-4 h-4 mr-2" />
          Inject Pattern
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Inject New Pattern</DialogTitle>
          <DialogDescription>
            Manually add a human-curated pattern for a domain
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Domain ID</Label>
            <Input
              placeholder="e.g., technology.software.web"
              value={domainId}
              onChange={(e) => setDomainId(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label>Pattern Type</Label>
            <Input
              placeholder="e.g., system, user, context"
              value={type}
              onChange={(e) => setType(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label>Content</Label>
            <textarea
              className="w-full min-h-[100px] p-2 border rounded-md"
              placeholder="Pattern content..."
              value={content}
              onChange={(e) => setContent(e.target.value)}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button onClick={handleSubmit}>Inject Pattern</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function CreateQuestionDialog({ onSuccess }: { onSuccess: () => void }) {
  const [open, setOpen] = useState(false);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm">
          <Plus className="w-4 h-4 mr-2" />
          Create Question
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create New Question</DialogTitle>
          <DialogDescription>
            Add a new CLARION question to the system
          </DialogDescription>
        </DialogHeader>
        <p className="text-muted-foreground text-center py-8">
          Question creation form - coming soon
        </p>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function CreateABTestDialog({ onSuccess }: { onSuccess: () => void }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [domainId, setDomainId] = useState('');

  const handleSubmit = async () => {
    try {
      await fetch(`${API_BASE}/ab-tests`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          domainId,
          variants: [
            { id: 'control', name: 'Control', weight: 50 },
            { id: 'variant', name: 'Variant', weight: 50 },
          ],
        }),
      });
      setOpen(false);
      onSuccess();
    } catch (error) {
      console.error('Failed to create A/B test:', error);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm">
          <Plus className="w-4 h-4 mr-2" />
          Create Test
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create A/B Test</DialogTitle>
          <DialogDescription>
            Set up a new prompt variant experiment
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Test Name</Label>
            <Input
              placeholder="e.g., System prompt v2 test"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label>Domain ID</Label>
            <Input
              placeholder="e.g., technology.software.web"
              value={domainId}
              onChange={(e) => setDomainId(e.target.value)}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button onClick={handleSubmit}>Create Test</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
