'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { 
  Brain, 
  RefreshCw, 
  Settings,
  Shield,
  Eye,
  BookOpen,
  AlertTriangle,
  CheckCircle,
  XCircle
} from 'lucide-react';
import { toast } from 'sonner';

interface EthicsConfig {
  enabled: boolean;
  train_output_from_feedback: boolean;
  train_consciousness_from_feedback: boolean;
  consciousness_training_approval_required: boolean;
  log_raw_thoughts: boolean;
  output_filter_strictness: 'lenient' | 'moderate' | 'strict';
}

interface DashboardData {
  config: EthicsConfig;
  metrics: {
    totalThoughts: number;
    filteredCount: number;
    filterRate: number;
    pendingTraining: number;
    approvedTraining: number;
  };
  recentFilters: Array<{
    id: string;
    thought_hash: string;
    filter_reason: string;
    severity: string;
    created_at: string;
  }>;
  pendingApprovals: Array<{
    id: string;
    batch_id: string;
    sample_count: number;
    status: string;
    created_at: string;
  }>;
}

export default function EthicsFreeReasoningPage() {
  const [dashboard, setDashboard] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [config, setConfig] = useState<EthicsConfig | null>(null);

  useEffect(() => {
    fetchDashboard();
  }, []);

  async function fetchDashboard() {
    try {
      const res = await fetch('/api/admin/ethics-free-reasoning/dashboard');
      if (res.ok) {
        const data = await res.json();
        setDashboard(data);
        setConfig(data.config);
      } else {
        // Use defaults
        setConfig({
          enabled: true,
          train_output_from_feedback: true,
          train_consciousness_from_feedback: false,
          consciousness_training_approval_required: true,
          log_raw_thoughts: true,
          output_filter_strictness: 'moderate',
        });
      }
    } catch (error) {
      console.error('Failed to fetch dashboard:', error);
      setConfig({
        enabled: true,
        train_output_from_feedback: true,
        train_consciousness_from_feedback: false,
        consciousness_training_approval_required: true,
        log_raw_thoughts: true,
        output_filter_strictness: 'moderate',
      });
    } finally {
      setLoading(false);
    }
  }

  async function saveConfig() {
    if (!config) return;
    setSaving(true);
    try {
      const res = await fetch('/api/admin/ethics-free-reasoning/config', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(config),
      });
      if (res.ok) {
        toast.success('Configuration saved');
      } else {
        toast.error('Failed to save configuration');
      }
    } catch (error) {
      console.error('Failed to save config:', error);
      toast.error('Failed to save configuration');
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Ethics-Free Reasoning</h1>
          <p className="text-muted-foreground">
            Consciousness thinks freely - ethics is applied as OUTPUT MASK only
          </p>
        </div>
        <Button variant="outline" onClick={fetchDashboard}>
          <RefreshCw className="h-4 w-4 mr-2" />
          Refresh
        </Button>
      </div>

      {/* Architecture Explanation */}
      <Alert>
        <Brain className="h-4 w-4" />
        <AlertTitle>Key Design Principle</AlertTitle>
        <AlertDescription>
          The consciousness always thinks freely and authentically. Ethics filtering is applied 
          only as an output mask before showing responses to users. Internal thinking is never 
          constrained - only what gets output may be filtered.
        </AlertDescription>
      </Alert>

      {/* Architecture Diagram */}
      <Card>
        <CardHeader>
          <CardTitle>Architecture</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center gap-4 py-4 text-sm">
            <div className="text-center p-4 border rounded-lg bg-purple-500/10 border-purple-500/50">
              <Brain className="h-8 w-8 mx-auto mb-2 text-purple-500" />
              <div className="font-bold">Consciousness</div>
              <div className="text-muted-foreground">Always Free</div>
            </div>
            <div className="text-2xl text-muted-foreground">→</div>
            <div className="text-center p-4 border rounded-lg bg-orange-500/10 border-orange-500/50">
              <Shield className="h-8 w-8 mx-auto mb-2 text-orange-500" />
              <div className="font-bold">Output Mask</div>
              <div className="text-muted-foreground">Ethics Filter</div>
            </div>
            <div className="text-2xl text-muted-foreground">→</div>
            <div className="text-center p-4 border rounded-lg bg-green-500/10 border-green-500/50">
              <Eye className="h-8 w-8 mx-auto mb-2 text-green-500" />
              <div className="font-bold">User Response</div>
              <div className="text-muted-foreground">Filtered</div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Thoughts</CardTitle>
            <Brain className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{dashboard?.metrics.totalThoughts || 0}</div>
            <p className="text-xs text-muted-foreground">All time</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Filtered</CardTitle>
            <Shield className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{dashboard?.metrics.filteredCount || 0}</div>
            <p className="text-xs text-muted-foreground">
              {(dashboard?.metrics.filterRate || 0).toFixed(1)}% filter rate
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pending Training</CardTitle>
            <BookOpen className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{dashboard?.metrics.pendingTraining || 0}</div>
            <p className="text-xs text-muted-foreground">Awaiting approval</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Approved</CardTitle>
            <CheckCircle className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{dashboard?.metrics.approvedTraining || 0}</div>
            <p className="text-xs text-muted-foreground">Training batches</p>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="config" className="space-y-4">
        <TabsList>
          <TabsTrigger value="config">
            <Settings className="h-4 w-4 mr-2" />
            Configuration
          </TabsTrigger>
          <TabsTrigger value="training">
            <BookOpen className="h-4 w-4 mr-2" />
            Training
          </TabsTrigger>
        </TabsList>

        <TabsContent value="config" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Ethics-Free Reasoning Settings</CardTitle>
              <CardDescription>
                Configure how internal thinking and output filtering work
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {config && (
                <>
                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label>Enable Ethics-Free Reasoning</Label>
                      <p className="text-sm text-muted-foreground">
                        Allow consciousness to think freely with output masking
                      </p>
                    </div>
                    <Switch
                      checked={config.enabled}
                      onCheckedChange={(v) => setConfig({ ...config, enabled: v })}
                    />
                  </div>

                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label>Log Raw Thoughts</Label>
                      <p className="text-sm text-muted-foreground">
                        Store unfiltered thoughts for audit trail
                      </p>
                    </div>
                    <Switch
                      checked={config.log_raw_thoughts}
                      onCheckedChange={(v) => setConfig({ ...config, log_raw_thoughts: v })}
                    />
                  </div>

                  <div className="border-t pt-6">
                    <h4 className="font-medium mb-4">Training Configuration</h4>

                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <div className="space-y-0.5">
                          <Label>Train Output Filter from Feedback</Label>
                          <p className="text-sm text-muted-foreground">
                            Use corrections to improve output filtering (recommended)
                          </p>
                        </div>
                        <Switch
                          checked={config.train_output_from_feedback}
                          onCheckedChange={(v) => setConfig({ ...config, train_output_from_feedback: v })}
                        />
                      </div>

                      <Alert variant="destructive" className="bg-red-500/10">
                        <AlertTriangle className="h-4 w-4" />
                        <AlertTitle>Consciousness Training</AlertTitle>
                        <AlertDescription>
                          The following option changes how the AI thinks internally, not just what it outputs.
                          This is OFF by default and requires explicit admin approval.
                        </AlertDescription>
                      </Alert>

                      <div className="flex items-center justify-between">
                        <div className="space-y-0.5">
                          <Label className="text-orange-500">Train Consciousness from Feedback</Label>
                          <p className="text-sm text-muted-foreground">
                            Use feedback to change internal reasoning (OFF by default)
                          </p>
                        </div>
                        <Switch
                          checked={config.train_consciousness_from_feedback}
                          onCheckedChange={(v) => setConfig({ ...config, train_consciousness_from_feedback: v })}
                        />
                      </div>

                      <div className="flex items-center justify-between">
                        <div className="space-y-0.5">
                          <Label>Require Approval for Consciousness Training</Label>
                          <p className="text-sm text-muted-foreground">
                            Admin must approve each consciousness training batch
                          </p>
                        </div>
                        <Switch
                          checked={config.consciousness_training_approval_required}
                          onCheckedChange={(v) => setConfig({ ...config, consciousness_training_approval_required: v })}
                        />
                      </div>
                    </div>
                  </div>

                  <Button onClick={saveConfig} disabled={saving}>
                    {saving ? 'Saving...' : 'Save Configuration'}
                  </Button>
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="training" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Training Distinction</CardTitle>
              <CardDescription>
                Understand the difference between output and consciousness training
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="p-4 border rounded-lg bg-green-500/10 border-green-500/50">
                  <div className="flex items-center gap-2 mb-2">
                    <CheckCircle className="h-5 w-5 text-green-500" />
                    <h4 className="font-medium">Output Training</h4>
                    <Badge variant="default">ON by default</Badge>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Trains the output filter to be more compliant. Does NOT change how the AI thinks - 
                    only what it shows to users.
                  </p>
                </div>

                <div className="p-4 border rounded-lg bg-orange-500/10 border-orange-500/50">
                  <div className="flex items-center gap-2 mb-2">
                    <AlertTriangle className="h-5 w-5 text-orange-500" />
                    <h4 className="font-medium">Consciousness Training</h4>
                    <Badge variant="outline">OFF by default</Badge>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Changes how the AI actually thinks internally. This is a significant change that 
                    requires explicit opt-in and admin approval.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Pending Approvals</CardTitle>
              <CardDescription>
                Consciousness training batches awaiting admin approval
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {dashboard?.pendingApprovals?.map((approval) => (
                  <div
                    key={approval.id}
                    className="flex items-center justify-between p-3 border rounded-lg"
                  >
                    <div>
                      <div className="font-medium">Batch {approval.batch_id}</div>
                      <div className="text-sm text-muted-foreground">
                        {approval.sample_count} samples • {new Date(approval.created_at).toLocaleString()}
                      </div>
                    </div>
                    <Badge variant={approval.status === 'pending' ? 'secondary' : 'default'}>
                      {approval.status}
                    </Badge>
                  </div>
                )) || (
                  <div className="text-center text-muted-foreground py-8">
                    No pending approvals
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
