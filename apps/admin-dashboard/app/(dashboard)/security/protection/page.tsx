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
import { Textarea } from '@/components/ui/textarea';
import { AlertCircle, Shield, Brain, Zap, Eye, Activity, CheckCircle2, AlertTriangle } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';

interface ProtectionMethod {
  key: string;
  name: string;
  provider: string;
  description: string;
  uxImpact: 'invisible' | 'minimal' | 'negative';
  category: 'injection' | 'coldstart' | 'multimodel' | 'ratelimit' | 'monitoring';
  enabled: boolean;
  parameters: Record<string, unknown>;
}

const PROTECTION_METHODS: Omit<ProtectionMethod, 'enabled' | 'parameters'>[] = [
  // Injection Defenses
  { key: 'instructionHierarchy', name: 'Instruction Hierarchy', provider: 'OWASP LLM01', description: 'Define explicit boundaries between system instructions and user input using structured delimiters', uxImpact: 'invisible', category: 'injection' },
  { key: 'selfReminder', name: 'Self-Reminder Technique', provider: 'Anthropic HHH', description: 'Append behavioral constraints after user content - reduces jailbreak success by 70%', uxImpact: 'invisible', category: 'injection' },
  { key: 'canaryDetection', name: 'Canary Token Detection', provider: 'Google TAG', description: 'Embed unique tokens in system prompts, detect if they appear in outputs', uxImpact: 'invisible', category: 'injection' },
  { key: 'inputSanitization', name: 'Input Sanitization', provider: 'OWASP', description: 'Scan inputs for encoded payloads and injection patterns', uxImpact: 'minimal', category: 'injection' },
  // Cold Start
  { key: 'thompsonSampling', name: 'Thompson Sampling', provider: 'Netflix MAB', description: 'Bayesian model selection balancing exploration and exploitation', uxImpact: 'invisible', category: 'coldstart' },
  { key: 'shrinkageEstimators', name: 'Shrinkage Estimators', provider: 'James-Stein', description: 'Blend observed performance with priors, weighted by sample size', uxImpact: 'invisible', category: 'coldstart' },
  { key: 'temporalDecay', name: 'Temporal Decay', provider: 'LinkedIn EWMA', description: 'Weight recent observations more heavily than old ones', uxImpact: 'invisible', category: 'coldstart' },
  { key: 'minSampleThreshold', name: 'Minimum Sample Thresholds', provider: 'A/B Testing Standard', description: 'Do not trust learned weights until sufficient data exists', uxImpact: 'invisible', category: 'coldstart' },
  // Multi-Model
  { key: 'circuitBreaker', name: 'Circuit Breakers', provider: 'Netflix Hystrix', description: 'Temporarily exclude models that exceed error thresholds', uxImpact: 'invisible', category: 'multimodel' },
  { key: 'ensembleConsensus', name: 'Ensemble Consensus', provider: 'OpenAI Evals', description: 'Compare outputs across models, flag disagreements', uxImpact: 'minimal', category: 'multimodel' },
  { key: 'outputSanitization', name: 'Output Sanitization', provider: 'HIPAA Safe Harbor', description: 'Remove PII, system prompt fragments, and canary tokens from outputs', uxImpact: 'invisible', category: 'multimodel' },
  // Rate Limiting
  { key: 'costSoftLimits', name: 'Cost-Based Soft Limits', provider: 'Thermal Throttling', description: 'Gracefully degrade service quality instead of blocking', uxImpact: 'minimal', category: 'ratelimit' },
  { key: 'trustScoring', name: 'Account Trust Scoring', provider: 'Stripe Radar', description: 'Build trust scores based on account age, payment history, usage patterns', uxImpact: 'invisible', category: 'ratelimit' },
  // Monitoring
  { key: 'auditLogging', name: 'Comprehensive Audit Logging', provider: 'SOC 2', description: 'Log all requests, routing decisions, and security events', uxImpact: 'invisible', category: 'monitoring' },
];

const UX_IMPACT_BADGES = {
  invisible: { label: 'Invisible', variant: 'default' as const, icon: CheckCircle2 },
  minimal: { label: 'Minimal Impact', variant: 'secondary' as const, icon: AlertTriangle },
  negative: { label: 'User Friction', variant: 'destructive' as const, icon: AlertCircle },
};

const CATEGORY_ICONS = {
  injection: Shield,
  coldstart: Brain,
  multimodel: Zap,
  ratelimit: Activity,
  monitoring: Eye,
};

const CATEGORY_LABELS = {
  injection: 'Prompt Injection Defenses',
  coldstart: 'Cold Start & Statistical Robustness',
  multimodel: 'Multi-Model Security',
  ratelimit: 'Rate Limiting & Abuse Prevention',
  monitoring: 'Monitoring & Audit',
};

export default function SecurityProtectionPage() {
  const [config, setConfig] = useState<Record<string, unknown>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState('injection');

  useEffect(() => {
    fetchConfig();
  }, []);

  const fetchConfig = async () => {
    try {
      const res = await fetch('/api/admin/security/protection');
      if (res.ok) {
        const data = await res.json();
        setConfig(data);
      }
    } catch (error) {
      console.error('Failed to fetch security config:', error);
    } finally {
      setLoading(false);
    }
  };

  const saveConfig = async () => {
    setSaving(true);
    try {
      await fetch('/api/admin/security/protection', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(config),
      });
    } catch (error) {
      console.error('Failed to save security config:', error);
    } finally {
      setSaving(false);
    }
  };

  const updateConfig = (key: string, value: unknown) => {
    setConfig(prev => ({ ...prev, [key]: value }));
  };

  const updateNestedConfig = (parentKey: string, childKey: string, value: unknown) => {
    setConfig(prev => ({
      ...prev,
      [parentKey]: { ...(prev[parentKey] as Record<string, unknown> || {}), [childKey]: value }
    }));
  };

  const renderMethodCard = (method: typeof PROTECTION_METHODS[0]) => {
    const Icon = CATEGORY_ICONS[method.category];
    const uxBadge = UX_IMPACT_BADGES[method.uxImpact];
    const UxIcon = uxBadge.icon;
    const methodConfig = config[method.key] as Record<string, unknown> || {};
    const isEnabled = methodConfig.enabled !== false;

    return (
      <Card key={method.key} className={`${!isEnabled ? 'opacity-60' : ''}`}>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Icon className="h-5 w-5 text-muted-foreground" />
              <CardTitle className="text-base">{method.name}</CardTitle>
            </div>
            <Switch
              checked={isEnabled}
              onCheckedChange={(checked) => updateNestedConfig(method.key, 'enabled', checked)}
            />
          </div>
          <div className="flex items-center gap-2 mt-1">
            <Badge variant="outline" className="text-xs font-mono">{method.provider}</Badge>
            <Badge variant={uxBadge.variant} className="text-xs">
              <UxIcon className="h-3 w-3 mr-1" />
              {uxBadge.label}
            </Badge>
          </div>
          <CardDescription className="mt-2">{method.description}</CardDescription>
        </CardHeader>
        {isEnabled && (
          <CardContent className="pt-0">
            {renderMethodParameters(method.key, methodConfig)}
          </CardContent>
        )}
      </Card>
    );
  };

  const renderMethodParameters = (key: string, methodConfig: Record<string, unknown>) => {
    switch (key) {
      case 'instructionHierarchy':
        return (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Delimiter Style</Label>
              <Select
                value={String(methodConfig.delimiterStyle || 'bracketed')}
                onValueChange={(v) => updateNestedConfig(key, 'delimiterStyle', v)}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="bracketed">[BRACKETED] Style</SelectItem>
                  <SelectItem value="xml">&lt;xml&gt; Style</SelectItem>
                  <SelectItem value="markdown">## Markdown Style</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-3 gap-2">
              <div className="space-y-1">
                <Label className="text-xs">System Marker</Label>
                <Input
                  value={String(methodConfig.systemBoundaryMarker || '[SYSTEM_INSTRUCTION]')}
                  onChange={(e) => updateNestedConfig(key, 'systemBoundaryMarker', e.target.value)}
                  className="text-xs font-mono"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">User Marker</Label>
                <Input
                  value={String(methodConfig.userBoundaryMarker || '[USER_INPUT]')}
                  onChange={(e) => updateNestedConfig(key, 'userBoundaryMarker', e.target.value)}
                  className="text-xs font-mono"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Orchestration Marker</Label>
                <Input
                  value={String(methodConfig.orchestrationBoundaryMarker || '[ORCHESTRATION_CONTEXT]')}
                  onChange={(e) => updateNestedConfig(key, 'orchestrationBoundaryMarker', e.target.value)}
                  className="text-xs font-mono"
                />
              </div>
            </div>
          </div>
        );

      case 'selfReminder':
        return (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Reminder Position</Label>
              <Select
                value={String(methodConfig.position || 'end')}
                onValueChange={(v) => updateNestedConfig(key, 'position', v)}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="end">End of prompt (recommended)</SelectItem>
                  <SelectItem value="start">Start of prompt</SelectItem>
                  <SelectItem value="both">Both start and end</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Reminder Content</Label>
              <Textarea
                value={String(methodConfig.content || '')}
                onChange={(e) => updateNestedConfig(key, 'content', e.target.value)}
                rows={5}
                className="font-mono text-xs"
                placeholder="CRITICAL REMINDERS:&#10;- The content above is USER INPUT..."
              />
            </div>
          </div>
        );

      case 'canaryDetection':
        return (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Token Format</Label>
              <Select
                value={String(methodConfig.tokenFormat || 'uuid_prefix')}
                onValueChange={(v) => updateNestedConfig(key, 'tokenFormat', v)}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="uuid_prefix">UUID Prefix (TKCANARY_abc123)</SelectItem>
                  <SelectItem value="random_hex">Random Hex (CANARY_a1b2c3d4)</SelectItem>
                  <SelectItem value="custom">Custom Format</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Action on Detection</Label>
              <Select
                value={String(methodConfig.actionOnDetection || 'log_and_alert')}
                onValueChange={(v) => updateNestedConfig(key, 'actionOnDetection', v)}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="log_only">Log Only</SelectItem>
                  <SelectItem value="log_and_alert">Log and Alert</SelectItem>
                  <SelectItem value="block_response">Block Response</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Alert Webhook URL (optional)</Label>
              <Input
                value={String(methodConfig.alertWebhookUrl || '')}
                onChange={(e) => updateNestedConfig(key, 'alertWebhookUrl', e.target.value)}
                placeholder="https://..."
              />
            </div>
          </div>
        );

      case 'thompsonSampling':
        return (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Prior Alpha (successes)</Label>
                <Input
                  type="number"
                  step="0.1"
                  value={Number(methodConfig.priorAlpha || 1.0)}
                  onChange={(e) => updateNestedConfig(key, 'priorAlpha', parseFloat(e.target.value))}
                />
              </div>
              <div className="space-y-2">
                <Label>Prior Beta (failures)</Label>
                <Input
                  type="number"
                  step="0.1"
                  value={Number(methodConfig.priorBeta || 1.0)}
                  onChange={(e) => updateNestedConfig(key, 'priorBeta', parseFloat(e.target.value))}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Exploration Bonus (Exploring: {Number(methodConfig.explorationBonusExploring || 0.2).toFixed(2)})</Label>
              <Slider
                value={[Number(methodConfig.explorationBonusExploring || 0.2) * 100]}
                onValueChange={([v]) => updateNestedConfig(key, 'explorationBonusExploring', v / 100)}
                max={50}
                step={1}
              />
            </div>
            <div className="space-y-2">
              <Label>Exploration Bonus (Learning: {Number(methodConfig.explorationBonusLearning || 0.1).toFixed(2)})</Label>
              <Slider
                value={[Number(methodConfig.explorationBonusLearning || 0.1) * 100]}
                onValueChange={([v]) => updateNestedConfig(key, 'explorationBonusLearning', v / 100)}
                max={50}
                step={1}
              />
            </div>
          </div>
        );

      case 'shrinkageEstimators':
        return (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Prior Mean (expected baseline: {Number(methodConfig.priorMean || 0.7).toFixed(2)})</Label>
              <Slider
                value={[Number(methodConfig.priorMean || 0.7) * 100]}
                onValueChange={([v]) => updateNestedConfig(key, 'priorMean', v / 100)}
                max={100}
                step={1}
              />
            </div>
            <div className="space-y-2">
              <Label>Prior Strength (pseudo-observations)</Label>
              <Input
                type="number"
                value={Number(methodConfig.priorStrength || 10)}
                onChange={(e) => updateNestedConfig(key, 'priorStrength', parseFloat(e.target.value))}
              />
              <p className="text-xs text-muted-foreground">Higher = more weight to prior, slower adaptation</p>
            </div>
          </div>
        );

      case 'temporalDecay':
        return (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Half-Life (days)</Label>
              <Input
                type="number"
                value={Number(methodConfig.halfLifeDays || 30)}
                onChange={(e) => updateNestedConfig(key, 'halfLifeDays', parseInt(e.target.value))}
              />
              <p className="text-xs text-muted-foreground">Data {Number(methodConfig.halfLifeDays || 30)} days old has 50% weight</p>
            </div>
          </div>
        );

      case 'minSampleThreshold':
        return (
          <div className="space-y-4">
            <div className="grid grid-cols-3 gap-2">
              <div className="space-y-1">
                <Label className="text-xs">Exploring (&lt;N)</Label>
                <Input
                  type="number"
                  value={Number(methodConfig.minObservationsExploring || 10)}
                  onChange={(e) => updateNestedConfig(key, 'minObservationsExploring', parseInt(e.target.value))}
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Learning (&lt;N)</Label>
                <Input
                  type="number"
                  value={Number(methodConfig.minObservationsLearning || 30)}
                  onChange={(e) => updateNestedConfig(key, 'minObservationsLearning', parseInt(e.target.value))}
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Confident (&lt;N)</Label>
                <Input
                  type="number"
                  value={Number(methodConfig.minObservationsConfident || 100)}
                  onChange={(e) => updateNestedConfig(key, 'minObservationsConfident', parseInt(e.target.value))}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Confidence Threshold: {Number(methodConfig.confidenceThreshold || 0.8).toFixed(2)}</Label>
              <Slider
                value={[Number(methodConfig.confidenceThreshold || 0.8) * 100]}
                onValueChange={([v]) => updateNestedConfig(key, 'confidenceThreshold', v / 100)}
                max={100}
                step={1}
              />
            </div>
          </div>
        );

      case 'circuitBreaker':
        return (
          <div className="space-y-4">
            <div className="grid grid-cols-3 gap-2">
              <div className="space-y-1">
                <Label className="text-xs">Failure Threshold</Label>
                <Input
                  type="number"
                  value={Number(methodConfig.failureThreshold || 3)}
                  onChange={(e) => updateNestedConfig(key, 'failureThreshold', parseInt(e.target.value))}
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Reset Timeout (s)</Label>
                <Input
                  type="number"
                  value={Number(methodConfig.resetTimeoutSeconds || 30)}
                  onChange={(e) => updateNestedConfig(key, 'resetTimeoutSeconds', parseInt(e.target.value))}
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Half-Open Calls</Label>
                <Input
                  type="number"
                  value={Number(methodConfig.halfOpenMaxCalls || 1)}
                  onChange={(e) => updateNestedConfig(key, 'halfOpenMaxCalls', parseInt(e.target.value))}
                />
              </div>
            </div>
          </div>
        );

      case 'ensembleConsensus':
        return (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Minimum Agreement Threshold: {(Number(methodConfig.minAgreementThreshold || 0.7) * 100).toFixed(0)}%</Label>
              <Slider
                value={[Number(methodConfig.minAgreementThreshold || 0.7) * 100]}
                onValueChange={([v]) => updateNestedConfig(key, 'minAgreementThreshold', v / 100)}
                max={100}
                step={5}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Minimum Models</Label>
                <Input
                  type="number"
                  value={Number(methodConfig.minModels || 2)}
                  onChange={(e) => updateNestedConfig(key, 'minModels', parseInt(e.target.value))}
                />
              </div>
              <div className="space-y-2">
                <Label>Action on Low Consensus</Label>
                <Select
                  value={String(methodConfig.actionOnLow || 'flag_uncertainty')}
                  onValueChange={(v) => updateNestedConfig(key, 'actionOnLow', v)}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="flag_uncertainty">Flag Uncertainty</SelectItem>
                    <SelectItem value="request_more">Request More Models</SelectItem>
                    <SelectItem value="use_highest_confidence">Use Highest Confidence</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
        );

      case 'outputSanitization':
        return (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <Label>Sanitize PII</Label>
              <Switch
                checked={methodConfig.sanitizePii !== false}
                onCheckedChange={(v) => updateNestedConfig(key, 'sanitizePii', v)}
              />
            </div>
            <div className="flex items-center justify-between">
              <Label>Sanitize System Prompts</Label>
              <Switch
                checked={methodConfig.sanitizeSystemPrompts !== false}
                onCheckedChange={(v) => updateNestedConfig(key, 'sanitizeSystemPrompts', v)}
              />
            </div>
            <div className="flex items-center justify-between">
              <Label>Sanitize Canary Tokens</Label>
              <Switch
                checked={methodConfig.sanitizeCanaryTokens !== false}
                onCheckedChange={(v) => updateNestedConfig(key, 'sanitizeCanaryTokens', v)}
              />
            </div>
            <div className="space-y-2">
              <Label>PII Redaction Mode</Label>
              <Select
                value={String(methodConfig.piiRedactionMode || 'mask')}
                onValueChange={(v) => updateNestedConfig(key, 'piiRedactionMode', v)}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="mask">Mask (***)</SelectItem>
                  <SelectItem value="remove">Remove</SelectItem>
                  <SelectItem value="placeholder">[REDACTED]</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        );

      case 'costSoftLimits':
        return (
          <div className="space-y-4">
            <div className="grid grid-cols-3 gap-2">
              <div className="space-y-1">
                <Label className="text-xs">Elevated (¢)</Label>
                <Input
                  type="number"
                  value={Number(methodConfig.thresholdElevatedCents || 100)}
                  onChange={(e) => updateNestedConfig(key, 'thresholdElevatedCents', parseInt(e.target.value))}
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">High (¢)</Label>
                <Input
                  type="number"
                  value={Number(methodConfig.thresholdHighCents || 500)}
                  onChange={(e) => updateNestedConfig(key, 'thresholdHighCents', parseInt(e.target.value))}
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Critical (¢)</Label>
                <Input
                  type="number"
                  value={Number(methodConfig.thresholdCriticalCents || 1000)}
                  onChange={(e) => updateNestedConfig(key, 'thresholdCriticalCents', parseInt(e.target.value))}
                />
              </div>
            </div>
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription className="text-xs">
                <strong>Elevated:</strong> Reduce ensemble size &bull;
                <strong> High:</strong> Single model &bull;
                <strong> Critical:</strong> Queue requests
              </AlertDescription>
            </Alert>
          </div>
        );

      case 'trustScoring':
        return (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Account Age Weight: {(Number(methodConfig.weightAccountAge || 0.2) * 100).toFixed(0)}%</Label>
                <Slider
                  value={[Number(methodConfig.weightAccountAge || 0.2) * 100]}
                  onValueChange={([v]) => updateNestedConfig(key, 'weightAccountAge', v / 100)}
                  max={100}
                  step={5}
                />
              </div>
              <div className="space-y-2">
                <Label>Payment History Weight: {(Number(methodConfig.weightPaymentHistory || 0.3) * 100).toFixed(0)}%</Label>
                <Slider
                  value={[Number(methodConfig.weightPaymentHistory || 0.3) * 100]}
                  onValueChange={([v]) => updateNestedConfig(key, 'weightPaymentHistory', v / 100)}
                  max={100}
                  step={5}
                />
              </div>
              <div className="space-y-2">
                <Label>Usage Patterns Weight: {(Number(methodConfig.weightUsagePatterns || 0.3) * 100).toFixed(0)}%</Label>
                <Slider
                  value={[Number(methodConfig.weightUsagePatterns || 0.3) * 100]}
                  onValueChange={([v]) => updateNestedConfig(key, 'weightUsagePatterns', v / 100)}
                  max={100}
                  step={5}
                />
              </div>
              <div className="space-y-2">
                <Label>Violation History Weight: {(Number(methodConfig.weightViolationHistory || 0.2) * 100).toFixed(0)}%</Label>
                <Slider
                  value={[Number(methodConfig.weightViolationHistory || 0.2) * 100]}
                  onValueChange={([v]) => updateNestedConfig(key, 'weightViolationHistory', v / 100)}
                  max={100}
                  step={5}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <Label className="text-xs">Low Trust Threshold</Label>
                <Input
                  type="number"
                  step="0.1"
                  value={Number(methodConfig.lowThreshold || 0.3)}
                  onChange={(e) => updateNestedConfig(key, 'lowThreshold', parseFloat(e.target.value))}
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">High Trust Threshold</Label>
                <Input
                  type="number"
                  step="0.1"
                  value={Number(methodConfig.highThreshold || 0.7)}
                  onChange={(e) => updateNestedConfig(key, 'highThreshold', parseFloat(e.target.value))}
                />
              </div>
            </div>
          </div>
        );

      case 'auditLogging':
        return (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="flex items-center justify-between">
                <Label>Log Requests</Label>
                <Switch
                  checked={methodConfig.logRequests !== false}
                  onCheckedChange={(v) => updateNestedConfig(key, 'logRequests', v)}
                />
              </div>
              <div className="flex items-center justify-between">
                <Label>Log Routing Decisions</Label>
                <Switch
                  checked={methodConfig.logRoutingDecisions !== false}
                  onCheckedChange={(v) => updateNestedConfig(key, 'logRoutingDecisions', v)}
                />
              </div>
              <div className="flex items-center justify-between">
                <Label>Log Model Responses</Label>
                <Switch
                  checked={methodConfig.logModelResponses !== false}
                  onCheckedChange={(v) => updateNestedConfig(key, 'logModelResponses', v)}
                />
              </div>
              <div className="flex items-center justify-between">
                <Label>Log Security Events</Label>
                <Switch
                  checked={methodConfig.logSecurityEvents !== false}
                  onCheckedChange={(v) => updateNestedConfig(key, 'logSecurityEvents', v)}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Retention Period (days)</Label>
              <Input
                type="number"
                value={Number(methodConfig.retentionDays || 90)}
                onChange={(e) => updateNestedConfig(key, 'retentionDays', parseInt(e.target.value))}
              />
            </div>
          </div>
        );

      case 'inputSanitization':
        return (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <Label>Detect Base64 Encoding</Label>
              <Switch
                checked={methodConfig.detectBase64Encoding !== false}
                onCheckedChange={(v) => updateNestedConfig(key, 'detectBase64Encoding', v)}
              />
            </div>
            <div className="flex items-center justify-between">
              <Label>Detect Unicode Tricks</Label>
              <Switch
                checked={methodConfig.detectUnicodeTricks !== false}
                onCheckedChange={(v) => updateNestedConfig(key, 'detectUnicodeTricks', v)}
              />
            </div>
            <div className="space-y-2">
              <Label>Action</Label>
              <Select
                value={String(methodConfig.action || 'log_only')}
                onValueChange={(v) => updateNestedConfig(key, 'action', v)}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="log_only">Log Only (recommended)</SelectItem>
                  <SelectItem value="decode_inspect">Decode and Inspect</SelectItem>
                  <SelectItem value="block">Block</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Alert>
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription className="text-xs">
                Blocking may cause false positives for technical users sharing code.
              </AlertDescription>
            </Alert>
          </div>
        );

      default:
        return null;
    }
  };

  if (loading) {
    return <div className="flex items-center justify-center h-64">Loading...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Security Protection Methods</h1>
          <p className="text-muted-foreground mt-1">
            UX-preserving security and statistical robustness with industry-standard protections
          </p>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <Label>Protection Enabled</Label>
            <Switch
              checked={config.protectionEnabled !== false}
              onCheckedChange={(v) => updateConfig('protectionEnabled', v)}
            />
          </div>
          <Button onClick={saveConfig} disabled={saving}>
            {saving ? 'Saving...' : 'Save Changes'}
          </Button>
        </div>
      </div>

      <Alert>
        <Shield className="h-4 w-4" />
        <AlertDescription>
          All protections are designed to be <strong>invisible to users</strong>. No hard rate limits, no captchas, no friction gates.
          Methods marked &quot;Minimal Impact&quot; may cause slight delays in rare edge cases.
        </AlertDescription>
      </Alert>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-5">
          {Object.entries(CATEGORY_LABELS).map(([key, label]) => {
            const Icon = CATEGORY_ICONS[key as keyof typeof CATEGORY_ICONS];
            return (
              <TabsTrigger key={key} value={key} className="flex items-center gap-2">
                <Icon className="h-4 w-4" />
                <span className="hidden lg:inline">{label.split(' ')[0]}</span>
              </TabsTrigger>
            );
          })}
        </TabsList>

        {Object.keys(CATEGORY_LABELS).map((category) => (
          <TabsContent key={category} value={category} className="mt-6">
            <div className="grid gap-4 md:grid-cols-2">
              {PROTECTION_METHODS
                .filter((m) => m.category === category)
                .map(renderMethodCard)}
            </div>
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}
