'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Slider } from '@/components/ui/slider';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { 
  Brain, Zap, Shield, Code, Database, AlertTriangle, 
  RefreshCw, Save, Info, Sparkles, Users, CheckCircle 
} from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';

interface IntelligenceConfig {
  uncertainty: {
    enabled: boolean;
    threshold: number;
    verificationTool: string;
  };
  successMemory: {
    enabled: boolean;
    minRatingForGold: number;
    maxGoldInteractions: number;
    retrievalCount: number;
  };
  moa: {
    enabled: boolean;
    proposerCount: number;
    defaultProposers: string[];
    synthesizerModel: string;
  };
  verification: {
    enabled: boolean;
    modes: string[];
    maxRegenerations: number;
  };
  codeExecution: {
    enabled: boolean;
    languages: string[];
    timeoutSeconds: number;
    memoryMb: number;
  };
}

const DEFAULT_CONFIG: IntelligenceConfig = {
  uncertainty: {
    enabled: true,
    threshold: 0.85,
    verificationTool: 'web_search',
  },
  successMemory: {
    enabled: true,
    minRatingForGold: 4,
    maxGoldInteractions: 1000,
    retrievalCount: 3,
  },
  moa: {
    enabled: false,
    proposerCount: 3,
    defaultProposers: ['gpt-4o', 'claude-3-5-sonnet', 'deepseek-v3'],
    synthesizerModel: 'claude-3-5-sonnet',
  },
  verification: {
    enabled: false,
    modes: ['coding', 'research', 'analysis'],
    maxRegenerations: 2,
  },
  codeExecution: {
    enabled: false,
    languages: ['python', 'javascript'],
    timeoutSeconds: 10,
    memoryMb: 128,
  },
};

const AVAILABLE_MODELS = [
  'gpt-4o', 'gpt-4o-mini', 'gpt-4-turbo',
  'claude-3-5-sonnet', 'claude-3-5-opus', 'claude-3-haiku',
  'deepseek-v3', 'gemini-1.5-pro', 'gemini-1.5-flash',
  'mistral-large', 'llama-3.1-405b',
];

const ORCHESTRATION_MODES = [
  'thinking', 'extended_thinking', 'coding', 'creative',
  'research', 'analysis', 'multi_model', 'chain_of_thought',
];

export default function IntelligenceAggregatorPage() {
  const [config, setConfig] = useState<IntelligenceConfig>(DEFAULT_CONFIG);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    fetchConfig();
  }, []);

  const fetchConfig = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/admin/intelligence/config');
      if (response.ok) {
        const data = await response.json();
        setConfig(data.config || DEFAULT_CONFIG);
      }
    } catch (error) {
      console.error('Failed to fetch config:', error);
    }
    setLoading(false);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const response = await fetch('/api/admin/intelligence/config', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(config),
      });
      if (response.ok) {
        toast({ title: 'Configuration saved', description: 'Intelligence Aggregator settings updated' });
        setHasChanges(false);
      }
    } catch (error) {
      toast({ title: 'Error', description: 'Failed to save configuration', variant: 'destructive' });
    }
    setSaving(false);
  };

  const updateConfig = <K extends keyof IntelligenceConfig>(
    section: K,
    updates: Partial<IntelligenceConfig[K]>
  ) => {
    setConfig(prev => ({
      ...prev,
      [section]: { ...prev[section], ...updates },
    }));
    setHasChanges(true);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const enabledCount = [
    config.uncertainty.enabled,
    config.successMemory.enabled,
    config.moa.enabled,
    config.verification.enabled,
    config.codeExecution.enabled,
  ].filter(Boolean).length;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Brain className="h-8 w-8" />
            Intelligence Aggregator
          </h1>
          <p className="text-muted-foreground mt-2">
            Configure advanced AI capabilities: MoA synthesis, verification, uncertainty detection, and more.
          </p>
        </div>
        <div className="flex items-center gap-4">
          <Badge variant={enabledCount > 0 ? 'default' : 'secondary'}>
            {enabledCount}/5 features enabled
          </Badge>
          {hasChanges && (
            <Button onClick={handleSave} disabled={saving}>
              <Save className="h-4 w-4 mr-2" />
              {saving ? 'Saving...' : 'Save Changes'}
            </Button>
          )}
        </div>
      </div>

      {/* Cost Warning */}
      {(config.moa.enabled || config.verification.enabled) && (
        <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg">
          <div className="flex items-start gap-2">
            <AlertTriangle className="h-5 w-5 text-amber-600 mt-0.5" />
            <div>
              <h4 className="font-medium text-amber-800">Cost Impact</h4>
              <p className="text-sm text-amber-700">
                MoA Synthesis and Cross-Provider Verification significantly increase API costs (3-5x per request).
                Consider enabling only for high-value use cases.
              </p>
            </div>
          </div>
        </div>
      )}

      <Tabs defaultValue="uncertainty">
        <TabsList className="grid grid-cols-5 w-full">
          <TabsTrigger value="uncertainty" className="flex items-center gap-1">
            <Zap className="h-4 w-4" /> Uncertainty
          </TabsTrigger>
          <TabsTrigger value="memory" className="flex items-center gap-1">
            <Database className="h-4 w-4" /> Success Memory
          </TabsTrigger>
          <TabsTrigger value="moa" className="flex items-center gap-1">
            <Users className="h-4 w-4" /> MoA Synthesis
          </TabsTrigger>
          <TabsTrigger value="verification" className="flex items-center gap-1">
            <Shield className="h-4 w-4" /> Verification
          </TabsTrigger>
          <TabsTrigger value="code" className="flex items-center gap-1">
            <Code className="h-4 w-4" /> Code Execution
          </TabsTrigger>
        </TabsList>

        {/* Uncertainty Detection */}
        <TabsContent value="uncertainty">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <Zap className="h-5 w-5" />
                    Uncertainty Detection (Logprobs)
                  </CardTitle>
                  <CardDescription>
                    Monitor token confidence and trigger verification for low-confidence claims
                  </CardDescription>
                </div>
                <Switch
                  checked={config.uncertainty.enabled}
                  onCheckedChange={(enabled) => updateConfig('uncertainty', { enabled })}
                />
              </div>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                <div className="flex items-start gap-2">
                  <Info className="h-5 w-5 text-blue-600 mt-0.5" />
                  <p className="text-sm text-blue-700">
                    Uses logprobs from model APIs to detect when the AI is &ldquo;guessing&rdquo;.
                    Automatically triggers web search or knowledge base lookup for uncertain claims.
                  </p>
                </div>
              </div>

              <div className="space-y-4">
                <div>
                  <Label>Confidence Threshold: {(config.uncertainty.threshold * 100).toFixed(0)}%</Label>
                  <Slider
                    value={[config.uncertainty.threshold * 100]}
                    onValueChange={([value]) => updateConfig('uncertainty', { threshold: value / 100 })}
                    min={50}
                    max={95}
                    step={5}
                    className="mt-2"
                    disabled={!config.uncertainty.enabled}
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    Lower = more sensitive (more verifications). Recommended: 85%
                  </p>
                </div>

                <div>
                  <Label>Verification Tool</Label>
                  <Select
                    value={config.uncertainty.verificationTool}
                    onValueChange={(value) => updateConfig('uncertainty', { verificationTool: value })}
                    disabled={!config.uncertainty.enabled}
                  >
                    <SelectTrigger className="mt-1">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="web_search">Web Search</SelectItem>
                      <SelectItem value="vector_db">Knowledge Base (Vector DB)</SelectItem>
                      <SelectItem value="none">None (Log Only)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Success Memory */}
        <TabsContent value="memory">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <Database className="h-5 w-5" />
                    Success Memory RAG
                  </CardTitle>
                  <CardDescription>
                    Learn from highly-rated interactions as few-shot examples
                  </CardDescription>
                </div>
                <Switch
                  checked={config.successMemory.enabled}
                  onCheckedChange={(enabled) => updateConfig('successMemory', { enabled })}
                />
              </div>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
                <div className="flex items-start gap-2">
                  <Sparkles className="h-5 w-5 text-green-600 mt-0.5" />
                  <p className="text-sm text-green-700">
                    Stores 4-5 star rated interactions and retrieves similar ones as few-shot examples.
                    The model learns user preferences without fine-tuning.
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Minimum Rating for Gold</Label>
                  <Select
                    value={String(config.successMemory.minRatingForGold)}
                    onValueChange={(value) => updateConfig('successMemory', { minRatingForGold: parseInt(value) })}
                    disabled={!config.successMemory.enabled}
                  >
                    <SelectTrigger className="mt-1">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="4">4+ Stars</SelectItem>
                      <SelectItem value="5">5 Stars Only</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label>Max Gold Interactions (per user)</Label>
                  <Input
                    type="number"
                    value={config.successMemory.maxGoldInteractions}
                    onChange={(e) => updateConfig('successMemory', { maxGoldInteractions: parseInt(e.target.value) || 1000 })}
                    disabled={!config.successMemory.enabled}
                    className="mt-1"
                  />
                </div>

                <div>
                  <Label>Retrieval Count</Label>
                  <Input
                    type="number"
                    min={1}
                    max={10}
                    value={config.successMemory.retrievalCount}
                    onChange={(e) => updateConfig('successMemory', { retrievalCount: parseInt(e.target.value) || 3 })}
                    disabled={!config.successMemory.enabled}
                    className="mt-1"
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    Number of similar interactions to inject as examples
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* MoA Synthesis */}
        <TabsContent value="moa">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <Users className="h-5 w-5" />
                    Mixture of Agents (MoA) Synthesis
                    <Badge variant="outline" className="ml-2">Cost: 3-4x</Badge>
                  </CardTitle>
                  <CardDescription>
                    Generate with multiple models and synthesize the best response
                  </CardDescription>
                </div>
                <Switch
                  checked={config.moa.enabled}
                  onCheckedChange={(enabled) => updateConfig('moa', { enabled })}
                />
              </div>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="p-4 bg-purple-50 border border-purple-200 rounded-lg">
                <div className="flex items-start gap-2">
                  <Brain className="h-5 w-5 text-purple-600 mt-0.5" />
                  <p className="text-sm text-purple-700">
                    Sends prompt to multiple models in parallel, then synthesizes responses.
                    Statistically eliminates hallucinations that would only appear in one model.
                  </p>
                </div>
              </div>

              <div className="space-y-4">
                <div>
                  <Label>Number of Proposer Models: {config.moa.proposerCount}</Label>
                  <Slider
                    value={[config.moa.proposerCount]}
                    onValueChange={([value]) => updateConfig('moa', { proposerCount: value })}
                    min={2}
                    max={5}
                    step={1}
                    className="mt-2"
                    disabled={!config.moa.enabled}
                  />
                </div>

                <div>
                  <Label>Default Proposer Models</Label>
                  <div className="flex flex-wrap gap-2 mt-2">
                    {AVAILABLE_MODELS.slice(0, 8).map(model => (
                      <Badge
                        key={model}
                        variant={config.moa.defaultProposers.includes(model) ? 'default' : 'outline'}
                        className="cursor-pointer"
                        onClick={() => {
                          if (!config.moa.enabled) return;
                          const current = config.moa.defaultProposers;
                          const updated = current.includes(model)
                            ? current.filter(m => m !== model)
                            : [...current, model].slice(0, config.moa.proposerCount);
                          updateConfig('moa', { defaultProposers: updated });
                        }}
                      >
                        {model}
                      </Badge>
                    ))}
                  </div>
                </div>

                <div>
                  <Label>Synthesizer Model</Label>
                  <Select
                    value={config.moa.synthesizerModel}
                    onValueChange={(value) => updateConfig('moa', { synthesizerModel: value })}
                    disabled={!config.moa.enabled}
                  >
                    <SelectTrigger className="mt-1">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {AVAILABLE_MODELS.map(model => (
                        <SelectItem key={model} value={model}>{model}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground mt-1">
                    Strong reasoning model recommended (Claude 3.5 Opus, GPT-4o)
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Cross-Provider Verification */}
        <TabsContent value="verification">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <Shield className="h-5 w-5" />
                    Cross-Provider Verification
                    <Badge variant="outline" className="ml-2">Cost: 2x</Badge>
                  </CardTitle>
                  <CardDescription>
                    Adversarial verification using models from different providers
                  </CardDescription>
                </div>
                <Switch
                  checked={config.verification.enabled}
                  onCheckedChange={(enabled) => updateConfig('verification', { enabled })}
                />
              </div>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
                <div className="flex items-start gap-2">
                  <Shield className="h-5 w-5 text-red-600 mt-0.5" />
                  <p className="text-sm text-red-700">
                    A &ldquo;hostile&rdquo; model from a different provider checks for hallucinations,
                    logic gaps, and security issues. Forces regeneration if critical issues found.
                  </p>
                </div>
              </div>

              <div className="space-y-4">
                <div>
                  <Label>Enable for Modes</Label>
                  <div className="flex flex-wrap gap-2 mt-2">
                    {ORCHESTRATION_MODES.map(mode => (
                      <Badge
                        key={mode}
                        variant={config.verification.modes.includes(mode) ? 'default' : 'outline'}
                        className="cursor-pointer"
                        onClick={() => {
                          if (!config.verification.enabled) return;
                          const current = config.verification.modes;
                          const updated = current.includes(mode)
                            ? current.filter(m => m !== mode)
                            : [...current, mode];
                          updateConfig('verification', { modes: updated });
                        }}
                      >
                        {mode}
                      </Badge>
                    ))}
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    Recommended: coding, research, analysis
                  </p>
                </div>

                <div>
                  <Label>Max Regeneration Attempts: {config.verification.maxRegenerations}</Label>
                  <Slider
                    value={[config.verification.maxRegenerations]}
                    onValueChange={([value]) => updateConfig('verification', { maxRegenerations: value })}
                    min={1}
                    max={5}
                    step={1}
                    className="mt-2"
                    disabled={!config.verification.enabled}
                  />
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Code Execution */}
        <TabsContent value="code">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <Code className="h-5 w-5" />
                    Code Execution Sandbox
                    <Badge variant="destructive" className="ml-2">Security Risk</Badge>
                  </CardTitle>
                  <CardDescription>
                    Execute generated code in a sandbox to verify it works
                  </CardDescription>
                </div>
                <Switch
                  checked={config.codeExecution.enabled}
                  onCheckedChange={(enabled) => updateConfig('codeExecution', { enabled })}
                />
              </div>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
                <div className="flex items-start gap-2">
                  <AlertTriangle className="h-5 w-5 text-red-600 mt-0.5" />
                  <div>
                    <h4 className="font-medium text-red-800">Security Warning</h4>
                    <p className="text-sm text-red-700">
                      Code execution carries inherent security risks. Currently runs static analysis only.
                      Full execution requires additional security review before enabling.
                    </p>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Supported Languages</Label>
                  <div className="flex flex-wrap gap-2 mt-2">
                    {['python', 'javascript', 'typescript'].map(lang => (
                      <Badge
                        key={lang}
                        variant={config.codeExecution.languages.includes(lang) ? 'default' : 'outline'}
                        className="cursor-pointer"
                        onClick={() => {
                          if (!config.codeExecution.enabled) return;
                          const current = config.codeExecution.languages;
                          const updated = current.includes(lang)
                            ? current.filter(l => l !== lang)
                            : [...current, lang];
                          updateConfig('codeExecution', { languages: updated });
                        }}
                      >
                        {lang}
                      </Badge>
                    ))}
                  </div>
                </div>

                <div>
                  <Label>Timeout (seconds)</Label>
                  <Input
                    type="number"
                    min={5}
                    max={30}
                    value={config.codeExecution.timeoutSeconds}
                    onChange={(e) => updateConfig('codeExecution', { timeoutSeconds: parseInt(e.target.value) || 10 })}
                    disabled={!config.codeExecution.enabled}
                    className="mt-1"
                  />
                </div>

                <div>
                  <Label>Memory Limit (MB)</Label>
                  <Input
                    type="number"
                    min={64}
                    max={512}
                    value={config.codeExecution.memoryMb}
                    onChange={(e) => updateConfig('codeExecution', { memoryMb: parseInt(e.target.value) || 128 })}
                    disabled={!config.codeExecution.enabled}
                    className="mt-1"
                  />
                </div>
              </div>

              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <CheckCircle className="h-4 w-4 text-green-500" />
                Static analysis (syntax checking) is always active
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
