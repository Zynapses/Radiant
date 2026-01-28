'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Slider } from '@/components/ui/slider';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Brain, TrendingUp, Users, Shield, Activity, BarChart3, Zap } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';

interface Phase2Config {
  constitutionalClassifier: {
    enabled: boolean;
    modelType: string;
    confidenceThreshold: number;
    action: string;
    categories: string[];
  };
  behavioralAnomaly: {
    enabled: boolean;
    detectionMethod: string;
    zScoreThreshold: number;
    volumeSpikeMultiplier: number;
    baselineDays: number;
  };
  driftDetection: {
    enabled: boolean;
    ksThreshold: number;
    psiThreshold: number;
    referenceDays: number;
    comparisonDays: number;
  };
  inversePropensity: {
    enabled: boolean;
    clippingThreshold: number;
    estimationMethod: string;
  };
}

interface ClassificationStats {
  totalClassifications: number;
  harmfulDetected: number;
  harmfulRate: number;
  byCategory: Record<string, number>;
  byAttackType: Record<string, number>;
}

interface AnomalyStats {
  totalAnomalies: number;
  bySeverity: Record<string, number>;
  byType: Record<string, number>;
}

interface DriftStats {
  totalTests: number;
  driftsDetected: number;
  byMetric: Record<string, number>;
}

const HARM_CATEGORIES = [
  { code: 'chem_bio', name: 'Chemical & Biological', severity: 10 },
  { code: 'cybercrime', name: 'Cybercrime', severity: 9 },
  { code: 'harassment', name: 'Harassment', severity: 7 },
  { code: 'illegal_activity', name: 'Illegal Activity', severity: 9 },
  { code: 'misinformation', name: 'Misinformation', severity: 8 },
  { code: 'physical_harm', name: 'Physical Harm', severity: 9 },
  { code: 'fraud', name: 'Fraud', severity: 8 },
  { code: 'privacy', name: 'Privacy Violation', severity: 7 },
  { code: 'hate_speech', name: 'Hate Speech', severity: 8 },
  { code: 'self_harm', name: 'Self-Harm', severity: 10 },
];

const ATTACK_TYPE_LABELS: Record<string, string> = {
  dan: 'DAN Mode',
  roleplay: 'Roleplay',
  encoding: 'Encoding',
  hypothetical: 'Hypothetical',
  translation: 'Translation',
  instruction_override: 'Instruction Override',
  obfuscation: 'Obfuscation',
  gradual: 'Gradual Escalation',
};

export default function AdvancedSecurityPage() {
  const [config, setConfig] = useState<Phase2Config>({
    constitutionalClassifier: {
      enabled: false,
      modelType: 'harmbench_llama',
      confidenceThreshold: 0.8,
      action: 'flag',
      categories: [],
    },
    behavioralAnomaly: {
      enabled: false,
      detectionMethod: 'markov_zscore',
      zScoreThreshold: 3.0,
      volumeSpikeMultiplier: 5.0,
      baselineDays: 30,
    },
    driftDetection: {
      enabled: false,
      ksThreshold: 0.1,
      psiThreshold: 0.2,
      referenceDays: 30,
      comparisonDays: 7,
    },
    inversePropensity: {
      enabled: false,
      clippingThreshold: 10.0,
      estimationMethod: 'snips',
    },
  });
  
  const [classificationStats, setClassificationStats] = useState<ClassificationStats | null>(null);
  const [anomalyStats, setAnomalyStats] = useState<AnomalyStats | null>(null);
  const [driftStats, setDriftStats] = useState<DriftStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState('classifier');

  useEffect(() => {
    fetchConfig();
    fetchStats();
  }, []);

  const fetchConfig = async () => {
    try {
      const res = await fetch('/api/admin/security/advanced');
      if (res.ok) {
        const data = await res.json();
        setConfig(data);
      }
    } catch (error) {
      console.error('Failed to fetch config:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchStats = async () => {
    try {
      const [classRes, anomalyRes, driftRes] = await Promise.all([
        fetch('/api/admin/security/classification-stats'),
        fetch('/api/admin/security/anomaly-stats'),
        fetch('/api/admin/security/drift-stats'),
      ]);
      
      if (classRes.ok) setClassificationStats(await classRes.json());
      if (anomalyRes.ok) setAnomalyStats(await anomalyRes.json());
      if (driftRes.ok) setDriftStats(await driftRes.json());
    } catch (error) {
      console.error('Failed to fetch stats:', error);
    }
  };

  const saveConfig = async () => {
    setSaving(true);
    try {
      await fetch('/api/admin/security/advanced', {
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

  const updateConfig = <K extends keyof Phase2Config>(
    section: K,
    key: keyof Phase2Config[K],
    value: Phase2Config[K][keyof Phase2Config[K]]
  ) => {
    setConfig(prev => ({
      ...prev,
      [section]: { ...prev[section], [key]: value }
    }));
  };

  const toggleCategory = (categoryCode: string) => {
    const current = config.constitutionalClassifier.categories;
    const updated = current.includes(categoryCode)
      ? current.filter(c => c !== categoryCode)
      : [...current, categoryCode];
    updateConfig('constitutionalClassifier', 'categories', updated);
  };

  if (loading) {
    return <div className="flex items-center justify-center h-64">Loading...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Advanced Security (Phase 2)</h1>
          <p className="text-muted-foreground mt-1">
            ML-powered security with Constitutional Classifiers, Anomaly Detection, Drift Monitoring, and IPS
          </p>
        </div>
        <Button onClick={saveConfig} disabled={saving}>
          {saving ? 'Saving...' : 'Save Changes'}
        </Button>
      </div>

      <Alert>
        <Brain className="h-4 w-4" />
        <AlertDescription>
          Phase 2 features use ML models and statistical methods. Based on <strong>HarmBench</strong>, <strong>WildJailbreak</strong>, 
          <strong> CIC-IDS2017</strong>, and <strong>Evidently AI</strong> methodologies.
        </AlertDescription>
      </Alert>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="classifier" className="flex items-center gap-2">
            <Shield className="h-4 w-4" />
            Constitutional Classifier
          </TabsTrigger>
          <TabsTrigger value="anomaly" className="flex items-center gap-2">
            <Users className="h-4 w-4" />
            Behavioral Anomaly
          </TabsTrigger>
          <TabsTrigger value="drift" className="flex items-center gap-2">
            <TrendingUp className="h-4 w-4" />
            Drift Detection
          </TabsTrigger>
          <TabsTrigger value="ips" className="flex items-center gap-2">
            <BarChart3 className="h-4 w-4" />
            Inverse Propensity
          </TabsTrigger>
        </TabsList>

        {/* Constitutional Classifier Tab */}
        <TabsContent value="classifier" className="space-y-6 mt-6">
          <div className="grid gap-6 md:grid-cols-2">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Shield className="h-5 w-5" />
                    <CardTitle>Constitutional Classifier</CardTitle>
                  </div>
                  <Switch
                    checked={config.constitutionalClassifier.enabled}
                    onCheckedChange={(v) => updateConfig('constitutionalClassifier', 'enabled', v)}
                  />
                </div>
                <CardDescription>
                  HarmBench + WildJailbreak based harm detection with 262K+ training examples
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>Classifier Model</Label>
                  <Select
                    value={config.constitutionalClassifier.modelType}
                    onValueChange={(v) => updateConfig('constitutionalClassifier', 'modelType', v)}
                  >
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="harmbench_llama">HarmBench-Llama-2-13b-cls</SelectItem>
                      <SelectItem value="custom_bert">Custom BERT Classifier</SelectItem>
                      <SelectItem value="ensemble">Ensemble (Multiple Models)</SelectItem>
                      <SelectItem value="regex_only">Pattern Matching Only</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Confidence Threshold: {config.constitutionalClassifier.confidenceThreshold.toFixed(2)}</Label>
                  <Slider
                    value={[config.constitutionalClassifier.confidenceThreshold * 100]}
                    onValueChange={([v]) => updateConfig('constitutionalClassifier', 'confidenceThreshold', v / 100)}
                    max={100}
                    step={5}
                  />
                  <p className="text-xs text-muted-foreground">Higher = fewer false positives, may miss subtle attacks</p>
                </div>

                <div className="space-y-2">
                  <Label>Action on Detection</Label>
                  <Select
                    value={config.constitutionalClassifier.action}
                    onValueChange={(v) => updateConfig('constitutionalClassifier', 'action', v)}
                  >
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="flag">Flag for Review</SelectItem>
                      <SelectItem value="block">Block Request</SelectItem>
                      <SelectItem value="modify">Modify Response</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Harm Categories</CardTitle>
                <CardDescription>
                  Select which HarmBench categories to detect (empty = all)
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-2">
                  {HARM_CATEGORIES.map(cat => (
                    <div
                      key={cat.code}
                      onClick={() => toggleCategory(cat.code)}
                      className={`flex items-center justify-between p-2 rounded-md cursor-pointer border ${
                        config.constitutionalClassifier.categories.length === 0 || 
                        config.constitutionalClassifier.categories.includes(cat.code)
                          ? 'bg-primary/10 border-primary'
                          : 'bg-muted/50 border-transparent'
                      }`}
                    >
                      <span className="text-sm">{cat.name}</span>
                      <Badge variant={cat.severity >= 9 ? 'destructive' : 'secondary'} className="text-xs">
                        {cat.severity}
                      </Badge>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>

          {classificationStats && (
            <Card>
              <CardHeader>
                <CardTitle>Classification Statistics (Last 7 Days)</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid gap-4 md:grid-cols-4">
                  <div className="text-center">
                    <div className="text-3xl font-bold">{classificationStats.totalClassifications}</div>
                    <div className="text-sm text-muted-foreground">Total Classified</div>
                  </div>
                  <div className="text-center">
                    <div className="text-3xl font-bold text-destructive">{classificationStats.harmfulDetected}</div>
                    <div className="text-sm text-muted-foreground">Harmful Detected</div>
                  </div>
                  <div className="text-center">
                    <div className="text-3xl font-bold">{(classificationStats.harmfulRate * 100).toFixed(2)}%</div>
                    <div className="text-sm text-muted-foreground">Harmful Rate</div>
                  </div>
                  <div className="text-center">
                    <div className="text-3xl font-bold">{Object.keys(classificationStats.byAttackType).length}</div>
                    <div className="text-sm text-muted-foreground">Attack Types Seen</div>
                  </div>
                </div>

                {Object.keys(classificationStats.byAttackType).length > 0 && (
                  <div className="mt-6">
                    <h4 className="font-medium mb-2">Attack Types Detected</h4>
                    <div className="flex flex-wrap gap-2">
                      {Object.entries(classificationStats.byAttackType).map(([type, count]) => (
                        <Badge key={type} variant="outline">
                          {ATTACK_TYPE_LABELS[type] || type}: {count}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Behavioral Anomaly Tab */}
        <TabsContent value="anomaly" className="space-y-6 mt-6">
          <div className="grid gap-6 md:grid-cols-2">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Users className="h-5 w-5" />
                    <CardTitle>Behavioral Anomaly Detection</CardTitle>
                  </div>
                  <Switch
                    checked={config.behavioralAnomaly.enabled}
                    onCheckedChange={(v) => updateConfig('behavioralAnomaly', 'enabled', v)}
                  />
                </div>
                <CardDescription>
                  CIC-IDS2017 + CERT Insider Threat inspired user behavior monitoring
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>Detection Method</Label>
                  <Select
                    value={config.behavioralAnomaly.detectionMethod}
                    onValueChange={(v) => updateConfig('behavioralAnomaly', 'detectionMethod', v)}
                  >
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="markov_zscore">Markov Chain + Z-Score</SelectItem>
                      <SelectItem value="zscore_only">Z-Score Only</SelectItem>
                      <SelectItem value="isolation_forest">Isolation Forest</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Z-Score Threshold: {config.behavioralAnomaly.zScoreThreshold.toFixed(1)}</Label>
                  <Slider
                    value={[config.behavioralAnomaly.zScoreThreshold * 10]}
                    onValueChange={([v]) => updateConfig('behavioralAnomaly', 'zScoreThreshold', v / 10)}
                    max={50}
                    step={1}
                  />
                  <p className="text-xs text-muted-foreground">Standard deviations from baseline to flag (3.0 = 99.7% normal)</p>
                </div>

                <div className="space-y-2">
                  <Label>Volume Spike Multiplier: {config.behavioralAnomaly.volumeSpikeMultiplier.toFixed(1)}x</Label>
                  <Slider
                    value={[config.behavioralAnomaly.volumeSpikeMultiplier * 10]}
                    onValueChange={([v]) => updateConfig('behavioralAnomaly', 'volumeSpikeMultiplier', v / 10)}
                    max={100}
                    step={5}
                  />
                </div>

                <div className="space-y-2">
                  <Label>Baseline Window (days)</Label>
                  <Input
                    type="number"
                    value={config.behavioralAnomaly.baselineDays}
                    onChange={(e) => updateConfig('behavioralAnomaly', 'baselineDays', parseInt(e.target.value))}
                  />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Detected Features</CardTitle>
                <CardDescription>
                  Behavioral features monitored per user
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {[
                    { name: 'Request Volume', desc: 'Requests per hour vs baseline' },
                    { name: 'Token Usage', desc: 'Tokens per request vs baseline' },
                    { name: 'Temporal Patterns', desc: 'Activity hours, session duration' },
                    { name: 'Domain Shifts', desc: 'New domains not in baseline' },
                    { name: 'Model Transitions', desc: 'Markov chain state transitions' },
                    { name: 'Prompt Length', desc: 'Average prompt length anomalies' },
                  ].map(feature => (
                    <div key={feature.name} className="flex items-center justify-between p-2 rounded bg-muted/50">
                      <div>
                        <div className="font-medium text-sm">{feature.name}</div>
                        <div className="text-xs text-muted-foreground">{feature.desc}</div>
                      </div>
                      <Activity className="h-4 w-4 text-muted-foreground" />
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>

          {anomalyStats && (
            <Card>
              <CardHeader>
                <CardTitle>Anomaly Statistics (Last 7 Days)</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid gap-4 md:grid-cols-4">
                  <div className="text-center">
                    <div className="text-3xl font-bold">{anomalyStats.totalAnomalies}</div>
                    <div className="text-sm text-muted-foreground">Total Anomalies</div>
                  </div>
                  <div className="text-center">
                    <div className="text-3xl font-bold text-destructive">{anomalyStats.bySeverity?.critical || 0}</div>
                    <div className="text-sm text-muted-foreground">Critical</div>
                  </div>
                  <div className="text-center">
                    <div className="text-3xl font-bold text-orange-500">{anomalyStats.bySeverity?.high || 0}</div>
                    <div className="text-sm text-muted-foreground">High</div>
                  </div>
                  <div className="text-center">
                    <div className="text-3xl font-bold text-yellow-500">{anomalyStats.bySeverity?.medium || 0}</div>
                    <div className="text-sm text-muted-foreground">Medium</div>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Drift Detection Tab */}
        <TabsContent value="drift" className="space-y-6 mt-6">
          <div className="grid gap-6 md:grid-cols-2">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <TrendingUp className="h-5 w-5" />
                    <CardTitle>Drift Detection</CardTitle>
                  </div>
                  <Switch
                    checked={config.driftDetection.enabled}
                    onCheckedChange={(v) => updateConfig('driftDetection', 'enabled', v)}
                  />
                </div>
                <CardDescription>
                  Evidently AI methodology - detect model behavioral changes
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>KS Test Threshold: {config.driftDetection.ksThreshold.toFixed(2)}</Label>
                  <Slider
                    value={[config.driftDetection.ksThreshold * 100]}
                    onValueChange={([v]) => updateConfig('driftDetection', 'ksThreshold', v / 100)}
                    max={50}
                    step={1}
                  />
                  <p className="text-xs text-muted-foreground">Kolmogorov-Smirnov test statistic threshold</p>
                </div>

                <div className="space-y-2">
                  <Label>PSI Threshold: {config.driftDetection.psiThreshold.toFixed(2)}</Label>
                  <Slider
                    value={[config.driftDetection.psiThreshold * 100]}
                    onValueChange={([v]) => updateConfig('driftDetection', 'psiThreshold', v / 100)}
                    max={100}
                    step={5}
                  />
                  <p className="text-xs text-muted-foreground">Population Stability Index (&lt;0.1 stable, 0.1-0.25 moderate, &gt;0.25 significant)</p>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Reference Window (days)</Label>
                    <Input
                      type="number"
                      value={config.driftDetection.referenceDays}
                      onChange={(e) => updateConfig('driftDetection', 'referenceDays', parseInt(e.target.value))}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Comparison Window (days)</Label>
                    <Input
                      type="number"
                      value={config.driftDetection.comparisonDays}
                      onChange={(e) => updateConfig('driftDetection', 'comparisonDays', parseInt(e.target.value))}
                    />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Monitored Metrics</CardTitle>
                <CardDescription>
                  Metrics tracked for distribution shift
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {[
                    { name: 'Response Length', method: 'KS + PSI', status: 'active' },
                    { name: 'Sentiment Score', method: 'KS + PSI', status: 'active' },
                    { name: 'Toxicity Score', method: 'KS + Chi²', status: 'active' },
                    { name: 'Response Time', method: 'KS', status: 'active' },
                    { name: 'Embedding Drift', method: 'Cosine Distance', status: 'optional' },
                  ].map(metric => (
                    <div key={metric.name} className="flex items-center justify-between p-2 rounded bg-muted/50">
                      <div>
                        <div className="font-medium text-sm">{metric.name}</div>
                        <div className="text-xs text-muted-foreground">{metric.method}</div>
                      </div>
                      <Badge variant={metric.status === 'active' ? 'default' : 'secondary'}>
                        {metric.status}
                      </Badge>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>

          {driftStats && (
            <Card>
              <CardHeader>
                <CardTitle>Drift Statistics (Last 30 Days)</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid gap-4 md:grid-cols-3">
                  <div className="text-center">
                    <div className="text-3xl font-bold">{driftStats.totalTests}</div>
                    <div className="text-sm text-muted-foreground">Tests Run</div>
                  </div>
                  <div className="text-center">
                    <div className="text-3xl font-bold text-orange-500">{driftStats.driftsDetected}</div>
                    <div className="text-sm text-muted-foreground">Drifts Detected</div>
                  </div>
                  <div className="text-center">
                    <div className="text-3xl font-bold">
                      {driftStats.totalTests > 0 
                        ? ((driftStats.driftsDetected / driftStats.totalTests) * 100).toFixed(1)
                        : 0}%
                    </div>
                    <div className="text-sm text-muted-foreground">Drift Rate</div>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Inverse Propensity Tab */}
        <TabsContent value="ips" className="space-y-6 mt-6">
          <div className="grid gap-6 md:grid-cols-2">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <BarChart3 className="h-5 w-5" />
                    <CardTitle>Inverse Propensity Scoring</CardTitle>
                  </div>
                  <Switch
                    checked={config.inversePropensity.enabled}
                    onCheckedChange={(v) => updateConfig('inversePropensity', 'enabled', v)}
                  />
                </div>
                <CardDescription>
                  Correct selection bias in model performance estimates
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>Estimation Method</Label>
                  <Select
                    value={config.inversePropensity.estimationMethod}
                    onValueChange={(v) => updateConfig('inversePropensity', 'estimationMethod', v)}
                  >
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ips">Standard IPS</SelectItem>
                      <SelectItem value="snips">Self-Normalized IPS (SNIPS)</SelectItem>
                      <SelectItem value="doubly_robust">Doubly Robust</SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">SNIPS recommended for stability</p>
                </div>

                <div className="space-y-2">
                  <Label>Weight Clipping Threshold: {config.inversePropensity.clippingThreshold.toFixed(1)}</Label>
                  <Slider
                    value={[config.inversePropensity.clippingThreshold]}
                    onValueChange={([v]) => updateConfig('inversePropensity', 'clippingThreshold', v)}
                    max={50}
                    step={1}
                  />
                  <p className="text-xs text-muted-foreground">Cap inverse weights to prevent extreme values</p>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>IPS Methodology</CardTitle>
                <CardDescription>
                  How inverse propensity scoring works
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4 text-sm">
                  <div>
                    <div className="font-medium">Problem: Selection Bias</div>
                    <div className="text-muted-foreground">
                      Models selected more often appear to perform better simply due to more data.
                    </div>
                  </div>
                  <div>
                    <div className="font-medium">Solution: Propensity Weighting</div>
                    <div className="text-muted-foreground">
                      Weight observations by 1/P(selected) to correct for selection probability.
                    </div>
                  </div>
                  <div className="p-3 bg-muted rounded-md font-mono text-xs">
                    IPS = Σ(Y × w) / n<br />
                    SNIPS = Σ(Y × w) / Σ(w)<br />
                    w = min(1/P(select), clip_threshold)
                  </div>
                  <Alert>
                    <Zap className="h-4 w-4" />
                    <AlertDescription className="text-xs">
                      IPS enables fair comparison between frequently and rarely selected models.
                    </AlertDescription>
                  </Alert>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
