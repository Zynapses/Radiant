'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Slider } from '@/components/ui/slider';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { 
  Brain, 
  Settings, 
  Clock, 
  TrendingUp, 
  Database,
  Zap,
  Target,
  MessageSquare,
  ThumbsUp,
  ThumbsDown,
  Copy,
  RefreshCw,
  Calendar,
  Activity,
  CheckCircle2,
  AlertCircle,
  Info,
} from 'lucide-react';

// ============================================================================
// Types
// ============================================================================

interface LearningConfig {
  tenantId: string;
  minCandidatesForTraining: number;
  minPositiveCandidates: number;
  minNegativeCandidates: number;
  trainingFrequency: string;
  trainingDayOfWeek: number;
  trainingHourUtc: number | null;
  autoOptimalTime: boolean;
  implicitFeedbackEnabled: boolean;
  negativeLearningEnabled: boolean;
  activeLearningEnabled: boolean;
  domainAdaptersEnabled: boolean;
  patternCachingEnabled: boolean;
  conversationLearningEnabled: boolean;
  copySignalWeight: number;
  followupSignalWeight: number;
  abandonSignalWeight: number;
  rephraseSignalWeight: number;
  activeLearningProbability: number;
  activeLearningUncertaintyThreshold: number;
  patternCacheTtlHours: number;
  patternCacheMinOccurrences: number;
}

interface LearningAnalytics {
  implicitSignalsCaptured: number;
  negativeCandidatesCreated: number;
  activeLearningResponseRate: number;
  patternCacheHitRate: number;
}

interface OptimalTimeData {
  prediction: {
    optimalHourUtc: number;
    optimalDayOfWeek: number;
    activityScore: number;
    confidence: number;
    recommendation: string;
  };
  effectiveTime: {
    hourUtc: number;
    dayOfWeek: number | null;
    isAutoOptimal: boolean;
  };
}

interface TrainingStats {
  readyForTraining: boolean;
  positiveCandidates: number;
  negativeCandidates: number;
  implicitSignalsPending: number;
  highValueConversations: number;
  lastTrainingDate?: string;
  nextScheduledTraining?: string;
  estimatedTrainingTime: string;
}

// ============================================================================
// Component
// ============================================================================

export default function EnhancedLearningPage() {
  const [config, setConfig] = useState<LearningConfig | null>(null);
  const [analytics, setAnalytics] = useState<LearningAnalytics | null>(null);
  const [optimalTime, setOptimalTime] = useState<OptimalTimeData | null>(null);
  const [trainingStats, setTrainingStats] = useState<TrainingStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [configRes, dashboardRes, optimalRes] = await Promise.all([
        fetch('/api/admin/learning/config'),
        fetch('/api/admin/learning/dashboard'),
        fetch('/api/admin/learning/optimal-time'),
      ]);

      if (configRes.ok) {
        const data = await configRes.json();
        setConfig(data.data);
      }
      if (dashboardRes.ok) {
        const data = await dashboardRes.json();
        setAnalytics(data.data.analytics);
        setTrainingStats({
          readyForTraining: data.data.config?.minCandidatesForTraining <= 
            (data.data.analytics?.positiveCandidatesCreated || 0),
          positiveCandidates: data.data.analytics?.positiveCandidatesCreated || 0,
          negativeCandidates: data.data.analytics?.negativeCandidatesCreated || 0,
          implicitSignalsPending: data.data.analytics?.implicitSignalsCaptured || 0,
          highValueConversations: data.data.highValueConversations?.length || 0,
          estimatedTrainingTime: '~30 minutes',
        });
      }
      if (optimalRes.ok) {
        const data = await optimalRes.json();
        setOptimalTime(data.data);
      }
    } catch (err) {
      setError('Failed to load learning configuration');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const saveConfig = async (updates: Partial<LearningConfig>) => {
    setSaving(true);
    try {
      const res = await fetch('/api/admin/learning/config', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates),
      });
      if (res.ok) {
        const data = await res.json();
        setConfig(data.data);
      }
    } catch (err) {
      setError('Failed to save configuration');
    } finally {
      setSaving(false);
    }
  };

  const setAutoOptimalTime = async (useAuto: boolean) => {
    try {
      await fetch('/api/admin/learning/optimal-time/override', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ useAutoOptimal: useAuto }),
      });
      loadData();
    } catch (err) {
      setError('Failed to update training time');
    }
  };

  const formatHour = (hour: number) => {
    const ampm = hour >= 12 ? 'PM' : 'AM';
    const h = hour % 12 || 12;
    return `${h}:00 ${ampm}`;
  };

  const formatDay = (day: number) => {
    const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    return day >= 0 && day < 7 ? days[day] : 'Any day';
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Brain className="h-8 w-8" />
            Enhanced Learning System
          </h1>
          <p className="text-muted-foreground mt-1">
            Configure how the AI learns and improves from user interactions
          </p>
        </div>
        <Button onClick={loadData} variant="outline" size="sm">
          <RefreshCw className="h-4 w-4 mr-2" />
          Refresh
        </Button>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Training Status Card */}
      <Card className="border-2 border-primary/20">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Activity className="h-5 w-5" />
            Training Status
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            <div className="text-center p-4 bg-muted rounded-lg">
              <div className="text-2xl font-bold text-green-600">
                {trainingStats?.positiveCandidates || 0}
              </div>
              <div className="text-sm text-muted-foreground">Positive Candidates</div>
            </div>
            <div className="text-center p-4 bg-muted rounded-lg">
              <div className="text-2xl font-bold text-red-600">
                {trainingStats?.negativeCandidates || 0}
              </div>
              <div className="text-sm text-muted-foreground">Negative Candidates</div>
            </div>
            <div className="text-center p-4 bg-muted rounded-lg">
              <div className="text-2xl font-bold text-blue-600">
                {trainingStats?.implicitSignalsPending || 0}
              </div>
              <div className="text-sm text-muted-foreground">Implicit Signals</div>
            </div>
            <div className="text-center p-4 bg-muted rounded-lg">
              <div className="text-2xl font-bold text-purple-600">
                {trainingStats?.highValueConversations || 0}
              </div>
              <div className="text-sm text-muted-foreground">High-Value Convos</div>
            </div>
            <div className="text-center p-4 bg-muted rounded-lg">
              <div className="flex items-center justify-center gap-2">
                {trainingStats?.readyForTraining ? (
                  <CheckCircle2 className="h-6 w-6 text-green-600" />
                ) : (
                  <Clock className="h-6 w-6 text-yellow-600" />
                )}
              </div>
              <div className="text-sm text-muted-foreground">
                {trainingStats?.readyForTraining ? 'Ready to Train' : 'Collecting Data'}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Tabs defaultValue="features" className="space-y-4">
        <TabsList className="grid grid-cols-4 w-full max-w-2xl">
          <TabsTrigger value="features">Features</TabsTrigger>
          <TabsTrigger value="schedule">Schedule</TabsTrigger>
          <TabsTrigger value="signals">Signal Weights</TabsTrigger>
          <TabsTrigger value="thresholds">Thresholds</TabsTrigger>
        </TabsList>

        {/* Features Tab */}
        <TabsContent value="features" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Feature Cards */}
            <FeatureCard
              icon={<Copy className="h-5 w-5" />}
              title="Implicit Feedback"
              description="Learn from copy, share, abandon signals"
              enabled={config?.implicitFeedbackEnabled || false}
              onToggle={(v) => saveConfig({ implicitFeedbackEnabled: v })}
              saving={saving}
            />
            <FeatureCard
              icon={<ThumbsDown className="h-5 w-5" />}
              title="Negative Learning"
              description="Learn from mistakes (contrastive)"
              enabled={config?.negativeLearningEnabled || false}
              onToggle={(v) => saveConfig({ negativeLearningEnabled: v })}
              saving={saving}
            />
            <FeatureCard
              icon={<MessageSquare className="h-5 w-5" />}
              title="Active Learning"
              description="Proactively request feedback"
              enabled={config?.activeLearningEnabled || false}
              onToggle={(v) => saveConfig({ activeLearningEnabled: v })}
              saving={saving}
            />
            <FeatureCard
              icon={<Target className="h-5 w-5" />}
              title="Domain Adapters"
              description="Train separate adapters per domain"
              enabled={config?.domainAdaptersEnabled || false}
              onToggle={(v) => saveConfig({ domainAdaptersEnabled: v })}
              saving={saving}
            />
            <FeatureCard
              icon={<Zap className="h-5 w-5" />}
              title="Pattern Caching"
              description="Cache successful responses"
              enabled={config?.patternCachingEnabled || false}
              onToggle={(v) => saveConfig({ patternCachingEnabled: v })}
              saving={saving}
            />
            <FeatureCard
              icon={<TrendingUp className="h-5 w-5" />}
              title="Conversation Learning"
              description="Learn from full conversations"
              enabled={config?.conversationLearningEnabled || false}
              onToggle={(v) => saveConfig({ conversationLearningEnabled: v })}
              saving={saving}
            />
          </div>
        </TabsContent>

        {/* Schedule Tab */}
        <TabsContent value="schedule" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Calendar className="h-5 w-5" />
                  Training Frequency
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <Select
                  value={config?.trainingFrequency || 'daily'}
                  onValueChange={(v) => saveConfig({ trainingFrequency: v })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="daily">Daily</SelectItem>
                    <SelectItem value="twice_weekly">Twice Weekly</SelectItem>
                    <SelectItem value="weekly">Weekly</SelectItem>
                    <SelectItem value="biweekly">Biweekly</SelectItem>
                    <SelectItem value="monthly">Monthly</SelectItem>
                  </SelectContent>
                </Select>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Clock className="h-5 w-5" />
                  Optimal Training Time
                </CardTitle>
                <CardDescription>
                  {optimalTime?.effectiveTime.isAutoOptimal 
                    ? 'Auto-detecting best time from activity patterns'
                    : 'Manual override active'}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm">Auto-Optimal Time</span>
                  <Switch
                    checked={optimalTime?.effectiveTime.isAutoOptimal || false}
                    onCheckedChange={setAutoOptimalTime}
                  />
                </div>
                
                {optimalTime && (
                  <div className="p-4 bg-muted rounded-lg space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">Current Schedule</span>
                      <Badge variant="outline">
                        {formatHour(optimalTime.effectiveTime.hourUtc)} UTC
                      </Badge>
                    </div>
                    {optimalTime.effectiveTime.isAutoOptimal && (
                      <>
                        <div className="flex items-center justify-between">
                          <span className="text-sm text-muted-foreground">Confidence</span>
                          <Badge variant={optimalTime.prediction.confidence > 0.7 ? 'default' : 'secondary'}>
                            {Math.round(optimalTime.prediction.confidence * 100)}%
                          </Badge>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-sm text-muted-foreground">Activity Score</span>
                          <span className="text-sm">{optimalTime.prediction.activityScore.toFixed(1)}%</span>
                        </div>
                      </>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Signal Weights Tab */}
        <TabsContent value="signals" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Implicit Signal Weights</CardTitle>
              <CardDescription>
                Configure how much weight each user action carries for learning
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <SignalWeightSlider
                label="Copy Response"
                description="User copied the AI response"
                value={config?.copySignalWeight || 0.8}
                onChange={(v) => saveConfig({ copySignalWeight: v })}
                positive
              />
              <SignalWeightSlider
                label="Follow-up Question"
                description="User asked a follow-up"
                value={config?.followupSignalWeight || 0.3}
                onChange={(v) => saveConfig({ followupSignalWeight: v })}
                positive
              />
              <SignalWeightSlider
                label="Abandon Conversation"
                description="User left without resolution"
                value={config?.abandonSignalWeight || 0.7}
                onChange={(v) => saveConfig({ abandonSignalWeight: v })}
                positive={false}
              />
              <SignalWeightSlider
                label="Rephrase Question"
                description="User rephrased their question"
                value={config?.rephraseSignalWeight || 0.5}
                onChange={(v) => saveConfig({ rephraseSignalWeight: v })}
                positive={false}
              />
            </CardContent>
          </Card>
        </TabsContent>

        {/* Thresholds Tab */}
        <TabsContent value="thresholds" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card>
              <CardHeader>
                <CardTitle>Training Thresholds</CardTitle>
                <CardDescription>
                  Minimum candidates required before training
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <ThresholdInput
                  label="Min Total Candidates"
                  value={config?.minCandidatesForTraining || 25}
                  onChange={(v) => saveConfig({ minCandidatesForTraining: v })}
                  min={10}
                  max={200}
                />
                <ThresholdInput
                  label="Min Positive Candidates"
                  value={config?.minPositiveCandidates || 15}
                  onChange={(v) => saveConfig({ minPositiveCandidates: v })}
                  min={5}
                  max={100}
                />
                <ThresholdInput
                  label="Min Negative Candidates"
                  value={config?.minNegativeCandidates || 5}
                  onChange={(v) => saveConfig({ minNegativeCandidates: v })}
                  min={0}
                  max={50}
                />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Active Learning Settings</CardTitle>
                <CardDescription>
                  Configure proactive feedback requests
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm">Request Probability</span>
                    <span className="text-sm text-muted-foreground">
                      {Math.round((config?.activeLearningProbability || 0.15) * 100)}%
                    </span>
                  </div>
                  <Slider
                    value={[(config?.activeLearningProbability || 0.15) * 100]}
                    onValueChange={([v]) => saveConfig({ activeLearningProbability: v / 100 })}
                    min={0}
                    max={50}
                    step={5}
                  />
                </div>
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm">Uncertainty Threshold</span>
                    <span className="text-sm text-muted-foreground">
                      {Math.round((config?.activeLearningUncertaintyThreshold || 0.6) * 100)}%
                    </span>
                  </div>
                  <Slider
                    value={[(config?.activeLearningUncertaintyThreshold || 0.6) * 100]}
                    onValueChange={([v]) => saveConfig({ activeLearningUncertaintyThreshold: v / 100 })}
                    min={30}
                    max={90}
                    step={5}
                  />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Pattern Cache Settings</CardTitle>
                <CardDescription>
                  Configure successful response caching
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <ThresholdInput
                  label="Cache TTL (hours)"
                  value={config?.patternCacheTtlHours || 168}
                  onChange={(v) => saveConfig({ patternCacheTtlHours: v })}
                  min={24}
                  max={720}
                />
                <ThresholdInput
                  label="Min Occurrences"
                  value={config?.patternCacheMinOccurrences || 3}
                  onChange={(v) => saveConfig({ patternCacheMinOccurrences: v })}
                  min={1}
                  max={10}
                />
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>

      {/* Analytics Summary */}
      {analytics && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Database className="h-5 w-5" />
              7-Day Analytics
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <MetricCard
                label="Implicit Signals"
                value={analytics.implicitSignalsCaptured}
                icon={<Copy className="h-4 w-4" />}
              />
              <MetricCard
                label="Negative Examples"
                value={analytics.negativeCandidatesCreated}
                icon={<ThumbsDown className="h-4 w-4" />}
              />
              <MetricCard
                label="Active Learning Rate"
                value={`${Math.round(analytics.activeLearningResponseRate * 100)}%`}
                icon={<MessageSquare className="h-4 w-4" />}
              />
              <MetricCard
                label="Cache Hit Rate"
                value={`${Math.round(analytics.patternCacheHitRate * 100)}%`}
                icon={<Zap className="h-4 w-4" />}
              />
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// ============================================================================
// Sub-components
// ============================================================================

function FeatureCard({ 
  icon, 
  title, 
  description, 
  enabled, 
  onToggle, 
  saving 
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  enabled: boolean;
  onToggle: (enabled: boolean) => void;
  saving: boolean;
}) {
  return (
    <Card>
      <CardContent className="pt-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className={`p-2 rounded-lg ${enabled ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground'}`}>
              {icon}
            </div>
            <div>
              <h3 className="font-medium">{title}</h3>
              <p className="text-sm text-muted-foreground">{description}</p>
            </div>
          </div>
          <Switch
            checked={enabled}
            onCheckedChange={onToggle}
            disabled={saving}
          />
        </div>
      </CardContent>
    </Card>
  );
}

function SignalWeightSlider({
  label,
  description,
  value,
  onChange,
  positive,
}: {
  label: string;
  description: string;
  value: number;
  onChange: (value: number) => void;
  positive: boolean;
}) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <div>
          <span className="text-sm font-medium">{label}</span>
          <p className="text-xs text-muted-foreground">{description}</p>
        </div>
        <Badge variant={positive ? 'default' : 'destructive'}>
          {positive ? '+' : '-'}{Math.round(value * 100)}%
        </Badge>
      </div>
      <Slider
        value={[value * 100]}
        onValueChange={([v]) => onChange(v / 100)}
        min={0}
        max={100}
        step={5}
        className={positive ? '' : 'accent-red-500'}
      />
    </div>
  );
}

function ThresholdInput({
  label,
  value,
  onChange,
  min,
  max,
}: {
  label: string;
  value: number;
  onChange: (value: number) => void;
  min: number;
  max: number;
}) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-sm">{label}</span>
        <span className="text-sm font-mono bg-muted px-2 py-1 rounded">{value}</span>
      </div>
      <Slider
        value={[value]}
        onValueChange={([v]) => onChange(v)}
        min={min}
        max={max}
        step={1}
      />
    </div>
  );
}

function MetricCard({
  label,
  value,
  icon,
}: {
  label: string;
  value: string | number;
  icon: React.ReactNode;
}) {
  return (
    <div className="p-4 bg-muted rounded-lg">
      <div className="flex items-center gap-2 text-muted-foreground mb-1">
        {icon}
        <span className="text-xs">{label}</span>
      </div>
      <div className="text-2xl font-bold">{value}</div>
    </div>
  );
}
