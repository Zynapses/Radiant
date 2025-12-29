'use client';

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Switch } from '@/components/ui/switch';
import { Slider } from '@/components/ui/slider';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { 
  Brain, Network, Search, Cpu, Layout, 
  GitBranch, Database, Clock, Zap, Settings,
  AlertTriangle, CheckCircle, Info
} from 'lucide-react';

export default function CognitiveArchitecturePage() {
  const [totConfig, setTotConfig] = useState({
    enabled: true,
    maxDepth: 5,
    branchingFactor: 3,
    pruneThreshold: 0.3,
    selectionStrategy: 'beam',
    beamWidth: 2,
    defaultThinkingTimeMs: 30000,
    maxThinkingTimeMs: 300000,
  });

  const [graphRAGConfig, setGraphRAGConfig] = useState({
    enabled: true,
    maxEntitiesPerDocument: 50,
    maxRelationshipsPerDocument: 100,
    minConfidenceThreshold: 0.7,
    enableHybridSearch: true,
    graphWeight: 0.6,
    vectorWeight: 0.4,
    maxHops: 3,
  });

  const [researchConfig, setResearchConfig] = useState({
    enabled: true,
    maxSources: 50,
    maxDepth: 2,
    maxDurationMs: 1800000,
    parallelRequests: 5,
    requireCredibleSources: true,
    minSourceCredibility: 0.6,
  });

  const [loraConfig, setLoraConfig] = useState({
    enabled: false,
    cacheSize: 5,
    maxLoadTimeMs: 5000,
    fallbackToBase: true,
    autoSelectByDomain: true,
  });

  const [genUIConfig, setGenUIConfig] = useState({
    enabled: true,
    maxComponentsPerResponse: 3,
    autoDetectOpportunities: true,
    defaultTheme: 'auto',
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Cognitive Architecture</h1>
        <p className="text-muted-foreground mt-2">
          Advanced reasoning capabilities that elevate Radiant beyond single-model limitations
        </p>
      </div>

      {/* Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        <Card className={totConfig.enabled ? 'border-green-500/50' : 'border-muted'}>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <GitBranch className="h-4 w-4" />
              Tree of Thoughts
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Badge variant={totConfig.enabled ? 'default' : 'secondary'}>
              {totConfig.enabled ? 'Active' : 'Disabled'}
            </Badge>
          </CardContent>
        </Card>

        <Card className={graphRAGConfig.enabled ? 'border-green-500/50' : 'border-muted'}>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <Network className="h-4 w-4" />
              GraphRAG
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Badge variant={graphRAGConfig.enabled ? 'default' : 'secondary'}>
              {graphRAGConfig.enabled ? 'Active' : 'Disabled'}
            </Badge>
          </CardContent>
        </Card>

        <Card className={researchConfig.enabled ? 'border-green-500/50' : 'border-muted'}>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <Search className="h-4 w-4" />
              Deep Research
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Badge variant={researchConfig.enabled ? 'default' : 'secondary'}>
              {researchConfig.enabled ? 'Active' : 'Disabled'}
            </Badge>
          </CardContent>
        </Card>

        <Card className={loraConfig.enabled ? 'border-green-500/50' : 'border-muted'}>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <Cpu className="h-4 w-4" />
              Dynamic LoRA
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Badge variant={loraConfig.enabled ? 'default' : 'secondary'}>
              {loraConfig.enabled ? 'Active' : 'Disabled'}
            </Badge>
          </CardContent>
        </Card>

        <Card className={genUIConfig.enabled ? 'border-green-500/50' : 'border-muted'}>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <Layout className="h-4 w-4" />
              Generative UI
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Badge variant={genUIConfig.enabled ? 'default' : 'secondary'}>
              {genUIConfig.enabled ? 'Active' : 'Disabled'}
            </Badge>
          </CardContent>
        </Card>
      </div>

      {/* Feature Tabs */}
      <Tabs defaultValue="tot" className="space-y-4">
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="tot" className="flex items-center gap-2">
            <GitBranch className="h-4 w-4" />
            <span className="hidden sm:inline">Tree of Thoughts</span>
          </TabsTrigger>
          <TabsTrigger value="graphrag" className="flex items-center gap-2">
            <Network className="h-4 w-4" />
            <span className="hidden sm:inline">GraphRAG</span>
          </TabsTrigger>
          <TabsTrigger value="research" className="flex items-center gap-2">
            <Search className="h-4 w-4" />
            <span className="hidden sm:inline">Deep Research</span>
          </TabsTrigger>
          <TabsTrigger value="lora" className="flex items-center gap-2">
            <Cpu className="h-4 w-4" />
            <span className="hidden sm:inline">Dynamic LoRA</span>
          </TabsTrigger>
          <TabsTrigger value="genui" className="flex items-center gap-2">
            <Layout className="h-4 w-4" />
            <span className="hidden sm:inline">Generative UI</span>
          </TabsTrigger>
        </TabsList>

        {/* Tree of Thoughts */}
        <TabsContent value="tot">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <GitBranch className="h-5 w-5" />
                Tree of Thoughts (System 2 Reasoning)
              </CardTitle>
              <CardDescription>
                Monte Carlo Tree Search for deliberate, strategic reasoning. Mimics human problem-solving
                by exploring multiple reasoning paths and backtracking from dead ends.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <Label>Enable Tree of Thoughts</Label>
                  <p className="text-sm text-muted-foreground">
                    Activates System 2 reasoning for complex problems
                  </p>
                </div>
                <Switch
                  checked={totConfig.enabled}
                  onCheckedChange={(enabled) => setTotConfig({ ...totConfig, enabled })}
                />
              </div>

              <div className="grid grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Label>Selection Strategy</Label>
                  <Select
                    value={totConfig.selectionStrategy}
                    onValueChange={(value) => setTotConfig({ ...totConfig, selectionStrategy: value })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="beam">Beam Search (Recommended)</SelectItem>
                      <SelectItem value="mcts">Monte Carlo Tree Search</SelectItem>
                      <SelectItem value="greedy">Greedy (Fastest)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Beam Width: {totConfig.beamWidth}</Label>
                  <Slider
                    value={[totConfig.beamWidth]}
                    onValueChange={([value]) => setTotConfig({ ...totConfig, beamWidth: value })}
                    min={1}
                    max={5}
                    step={1}
                  />
                </div>

                <div className="space-y-2">
                  <Label>Max Depth: {totConfig.maxDepth}</Label>
                  <Slider
                    value={[totConfig.maxDepth]}
                    onValueChange={([value]) => setTotConfig({ ...totConfig, maxDepth: value })}
                    min={2}
                    max={10}
                    step={1}
                  />
                </div>

                <div className="space-y-2">
                  <Label>Branching Factor: {totConfig.branchingFactor}</Label>
                  <Slider
                    value={[totConfig.branchingFactor]}
                    onValueChange={([value]) => setTotConfig({ ...totConfig, branchingFactor: value })}
                    min={2}
                    max={5}
                    step={1}
                  />
                </div>

                <div className="space-y-2">
                  <Label>Default Thinking Time: {totConfig.defaultThinkingTimeMs / 1000}s</Label>
                  <Slider
                    value={[totConfig.defaultThinkingTimeMs]}
                    onValueChange={([value]) => setTotConfig({ ...totConfig, defaultThinkingTimeMs: value })}
                    min={10000}
                    max={120000}
                    step={5000}
                  />
                </div>

                <div className="space-y-2">
                  <Label>Prune Threshold: {totConfig.pruneThreshold}</Label>
                  <Slider
                    value={[totConfig.pruneThreshold * 100]}
                    onValueChange={([value]) => setTotConfig({ ...totConfig, pruneThreshold: value / 100 })}
                    min={10}
                    max={50}
                    step={5}
                  />
                </div>
              </div>

              <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-4">
                <div className="flex items-start gap-2">
                  <Info className="h-5 w-5 text-blue-500 mt-0.5" />
                  <div>
                    <p className="font-medium text-blue-500">How it works</p>
                    <p className="text-sm text-muted-foreground mt-1">
                      Instead of generating one linear answer, the system explores multiple reasoning paths
                      like a chess player thinking ahead. If a path scores poorly, it backtracks and tries
                      a different approach. Users can &quot;trade time for intelligence&quot; by allowing more thinking time.
                    </p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* GraphRAG */}
        <TabsContent value="graphrag">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Network className="h-5 w-5" />
                GraphRAG (Structured Knowledge Mapping)
              </CardTitle>
              <CardDescription>
                Knowledge graph-enhanced retrieval that understands relationships between concepts,
                enabling multi-hop reasoning across documents.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <Label>Enable GraphRAG</Label>
                  <p className="text-sm text-muted-foreground">
                    Extract entities and relationships from documents
                  </p>
                </div>
                <Switch
                  checked={graphRAGConfig.enabled}
                  onCheckedChange={(enabled) => setGraphRAGConfig({ ...graphRAGConfig, enabled })}
                />
              </div>

              <div className="grid grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Label>Max Entities per Document: {graphRAGConfig.maxEntitiesPerDocument}</Label>
                  <Slider
                    value={[graphRAGConfig.maxEntitiesPerDocument]}
                    onValueChange={([value]) => setGraphRAGConfig({ ...graphRAGConfig, maxEntitiesPerDocument: value })}
                    min={10}
                    max={100}
                    step={10}
                  />
                </div>

                <div className="space-y-2">
                  <Label>Max Relationships: {graphRAGConfig.maxRelationshipsPerDocument}</Label>
                  <Slider
                    value={[graphRAGConfig.maxRelationshipsPerDocument]}
                    onValueChange={([value]) => setGraphRAGConfig({ ...graphRAGConfig, maxRelationshipsPerDocument: value })}
                    min={20}
                    max={200}
                    step={20}
                  />
                </div>

                <div className="space-y-2">
                  <Label>Max Hops: {graphRAGConfig.maxHops}</Label>
                  <Slider
                    value={[graphRAGConfig.maxHops]}
                    onValueChange={([value]) => setGraphRAGConfig({ ...graphRAGConfig, maxHops: value })}
                    min={1}
                    max={5}
                    step={1}
                  />
                </div>

                <div className="space-y-2">
                  <Label>Confidence Threshold: {(graphRAGConfig.minConfidenceThreshold * 100).toFixed(0)}%</Label>
                  <Slider
                    value={[graphRAGConfig.minConfidenceThreshold * 100]}
                    onValueChange={([value]) => setGraphRAGConfig({ ...graphRAGConfig, minConfidenceThreshold: value / 100 })}
                    min={50}
                    max={95}
                    step={5}
                  />
                </div>
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <Label>Enable Hybrid Search</Label>
                  <p className="text-sm text-muted-foreground">
                    Combine graph traversal with vector similarity
                  </p>
                </div>
                <Switch
                  checked={graphRAGConfig.enableHybridSearch}
                  onCheckedChange={(enabled) => setGraphRAGConfig({ ...graphRAGConfig, enableHybridSearch: enabled })}
                />
              </div>

              {graphRAGConfig.enableHybridSearch && (
                <div className="grid grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <Label>Graph Weight: {(graphRAGConfig.graphWeight * 100).toFixed(0)}%</Label>
                    <Slider
                      value={[graphRAGConfig.graphWeight * 100]}
                      onValueChange={([value]) => setGraphRAGConfig({ 
                        ...graphRAGConfig, 
                        graphWeight: value / 100,
                        vectorWeight: (100 - value) / 100
                      })}
                      min={0}
                      max={100}
                      step={10}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Vector Weight: {(graphRAGConfig.vectorWeight * 100).toFixed(0)}%</Label>
                    <Slider
                      value={[graphRAGConfig.vectorWeight * 100]}
                      onValueChange={([value]) => setGraphRAGConfig({ 
                        ...graphRAGConfig, 
                        vectorWeight: value / 100,
                        graphWeight: (100 - value) / 100
                      })}
                      min={0}
                      max={100}
                      step={10}
                    />
                  </div>
                </div>
              )}

              <div className="bg-purple-500/10 border border-purple-500/20 rounded-lg p-4">
                <div className="flex items-start gap-2">
                  <Database className="h-5 w-5 text-purple-500 mt-0.5" />
                  <div>
                    <p className="font-medium text-purple-500">Multi-hop Reasoning</p>
                    <p className="text-sm text-muted-foreground mt-1">
                      GraphRAG can answer questions like &quot;How does the supplier change in the Q3 report 
                      affect the delayed launch mentioned in the Engineering memo?&quot; by traversing 
                      relationships that vector search would miss entirely.
                    </p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Deep Research */}
        <TabsContent value="research">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Search className="h-5 w-5" />
                Deep Research Agents
              </CardTitle>
              <CardDescription>
                Asynchronous background research that can visit 50+ sources, follow links recursively,
                and synthesize comprehensive briefing documents.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <Label>Enable Deep Research</Label>
                  <p className="text-sm text-muted-foreground">
                    Allow users to dispatch background research jobs
                  </p>
                </div>
                <Switch
                  checked={researchConfig.enabled}
                  onCheckedChange={(enabled) => setResearchConfig({ ...researchConfig, enabled })}
                />
              </div>

              <div className="grid grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Label>Max Sources: {researchConfig.maxSources}</Label>
                  <Slider
                    value={[researchConfig.maxSources]}
                    onValueChange={([value]) => setResearchConfig({ ...researchConfig, maxSources: value })}
                    min={10}
                    max={100}
                    step={10}
                  />
                </div>

                <div className="space-y-2">
                  <Label>Link Depth: {researchConfig.maxDepth}</Label>
                  <Slider
                    value={[researchConfig.maxDepth]}
                    onValueChange={([value]) => setResearchConfig({ ...researchConfig, maxDepth: value })}
                    min={1}
                    max={5}
                    step={1}
                  />
                </div>

                <div className="space-y-2">
                  <Label>Max Duration: {researchConfig.maxDurationMs / 60000} minutes</Label>
                  <Slider
                    value={[researchConfig.maxDurationMs / 60000]}
                    onValueChange={([value]) => setResearchConfig({ ...researchConfig, maxDurationMs: value * 60000 })}
                    min={5}
                    max={60}
                    step={5}
                  />
                </div>

                <div className="space-y-2">
                  <Label>Parallel Requests: {researchConfig.parallelRequests}</Label>
                  <Slider
                    value={[researchConfig.parallelRequests]}
                    onValueChange={([value]) => setResearchConfig({ ...researchConfig, parallelRequests: value })}
                    min={1}
                    max={10}
                    step={1}
                  />
                </div>
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <Label>Require Credible Sources</Label>
                  <p className="text-sm text-muted-foreground">
                    Filter out low-credibility sources
                  </p>
                </div>
                <Switch
                  checked={researchConfig.requireCredibleSources}
                  onCheckedChange={(enabled) => setResearchConfig({ ...researchConfig, requireCredibleSources: enabled })}
                />
              </div>

              <div className="bg-green-500/10 border border-green-500/20 rounded-lg p-4">
                <div className="flex items-start gap-2">
                  <Clock className="h-5 w-5 text-green-500 mt-0.5" />
                  <div>
                    <p className="font-medium text-green-500">Fire-and-Forget Mode</p>
                    <p className="text-sm text-muted-foreground mt-1">
                      Users ask a research question, then go about their day. 30 minutes later, they 
                      receive a notification with a comprehensive briefing document. No single LLM 
                      chat session can process 50 live URLs in real-time.
                    </p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Dynamic LoRA */}
        <TabsContent value="lora">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Cpu className="h-5 w-5" />
                Dynamic LoRA Swapping
              </CardTitle>
              <CardDescription>
                Hot-swappable domain expertise adapters that transform a generalist model into
                a specialist in milliseconds.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <Label>Enable Dynamic LoRA</Label>
                  <p className="text-sm text-muted-foreground">
                    Requires SageMaker Multi-Model Endpoints
                  </p>
                </div>
                <Switch
                  checked={loraConfig.enabled}
                  onCheckedChange={(enabled) => setLoraConfig({ ...loraConfig, enabled })}
                />
              </div>

              {!loraConfig.enabled && (
                <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-lg p-4">
                  <div className="flex items-start gap-2">
                    <AlertTriangle className="h-5 w-5 text-yellow-500 mt-0.5" />
                    <div>
                      <p className="font-medium text-yellow-500">Infrastructure Required</p>
                      <p className="text-sm text-muted-foreground mt-1">
                        Dynamic LoRA requires SageMaker Multi-Model Endpoints and an S3 bucket 
                        for adapter storage. See the deployment guide for setup instructions.
                      </p>
                    </div>
                  </div>
                </div>
              )}

              <div className="grid grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Label>Adapter Cache Size: {loraConfig.cacheSize}</Label>
                  <Slider
                    value={[loraConfig.cacheSize]}
                    onValueChange={([value]) => setLoraConfig({ ...loraConfig, cacheSize: value })}
                    min={1}
                    max={10}
                    step={1}
                    disabled={!loraConfig.enabled}
                  />
                </div>

                <div className="space-y-2">
                  <Label>Max Load Time: {loraConfig.maxLoadTimeMs}ms</Label>
                  <Slider
                    value={[loraConfig.maxLoadTimeMs]}
                    onValueChange={([value]) => setLoraConfig({ ...loraConfig, maxLoadTimeMs: value })}
                    min={1000}
                    max={10000}
                    step={1000}
                    disabled={!loraConfig.enabled}
                  />
                </div>
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <Label>Auto-Select by Domain</Label>
                  <p className="text-sm text-muted-foreground">
                    Automatically load domain-specific adapters
                  </p>
                </div>
                <Switch
                  checked={loraConfig.autoSelectByDomain}
                  onCheckedChange={(enabled) => setLoraConfig({ ...loraConfig, autoSelectByDomain: enabled })}
                  disabled={!loraConfig.enabled}
                />
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <Label>Fallback to Base Model</Label>
                  <p className="text-sm text-muted-foreground">
                    Use base model if adapter loading fails
                  </p>
                </div>
                <Switch
                  checked={loraConfig.fallbackToBase}
                  onCheckedChange={(enabled) => setLoraConfig({ ...loraConfig, fallbackToBase: enabled })}
                  disabled={!loraConfig.enabled}
                />
              </div>

              <div className="bg-orange-500/10 border border-orange-500/20 rounded-lg p-4">
                <div className="flex items-start gap-2">
                  <Zap className="h-5 w-5 text-orange-500 mt-0.5" />
                  <div>
                    <p className="font-medium text-orange-500">Specialist vs Generalist</p>
                    <p className="text-sm text-muted-foreground mt-1">
                      A generalist model (Gemini Ultra) will almost always lose to a specialist 
                      (Radiant + California Property Law LoRA) in deep-domain tasks. Each adapter 
                      is only ~100MB but provides expert-level performance.
                    </p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Generative UI */}
        <TabsContent value="genui">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Layout className="h-5 w-5" />
                Generative UI (App Factory)
              </CardTitle>
              <CardDescription>
                AI that doesn&apos;t just generate text—it generates the interface. Interactive 
                calculators, comparison tables, charts, and more.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <Label>Enable Generative UI</Label>
                  <p className="text-sm text-muted-foreground">
                    Allow AI to generate interactive components
                  </p>
                </div>
                <Switch
                  checked={genUIConfig.enabled}
                  onCheckedChange={(enabled) => setGenUIConfig({ ...genUIConfig, enabled })}
                />
              </div>

              <div className="grid grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Label>Max Components per Response: {genUIConfig.maxComponentsPerResponse}</Label>
                  <Slider
                    value={[genUIConfig.maxComponentsPerResponse]}
                    onValueChange={([value]) => setGenUIConfig({ ...genUIConfig, maxComponentsPerResponse: value })}
                    min={1}
                    max={5}
                    step={1}
                    disabled={!genUIConfig.enabled}
                  />
                </div>

                <div className="space-y-2">
                  <Label>Default Theme</Label>
                  <Select
                    value={genUIConfig.defaultTheme}
                    onValueChange={(value) => setGenUIConfig({ ...genUIConfig, defaultTheme: value })}
                    disabled={!genUIConfig.enabled}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="auto">Auto (System)</SelectItem>
                      <SelectItem value="light">Light</SelectItem>
                      <SelectItem value="dark">Dark</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <Label>Auto-Detect Opportunities</Label>
                  <p className="text-sm text-muted-foreground">
                    Automatically generate UI when appropriate
                  </p>
                </div>
                <Switch
                  checked={genUIConfig.autoDetectOpportunities}
                  onCheckedChange={(enabled) => setGenUIConfig({ ...genUIConfig, autoDetectOpportunities: enabled })}
                  disabled={!genUIConfig.enabled}
                />
              </div>

              <div className="bg-cyan-500/10 border border-cyan-500/20 rounded-lg p-4">
                <div className="flex items-start gap-2">
                  <CheckCircle className="h-5 w-5 text-cyan-500 mt-0.5" />
                  <div>
                    <p className="font-medium text-cyan-500">Beyond Text</p>
                    <p className="text-sm text-muted-foreground mt-1">
                      When a user asks &quot;Compare pricing of GPT-4, Claude 3, and Gemini&quot;, instead of 
                      a static table, Radiant generates an interactive pricing calculator with sliders 
                      for input/output tokens. The AI becomes the application.
                    </p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Save Button */}
      <div className="flex justify-end">
        <Button>
          <Settings className="h-4 w-4 mr-2" />
          Save Configuration
        </Button>
      </div>
    </div>
  );
}
