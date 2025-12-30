'use client';

import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import { 
  Settings2, 
  Play, 
  BarChart3, 
  Code2, 
  MessageSquare,
  Search,
  Filter,
  ChevronRight,
  Clock,
  DollarSign,
  Zap,
  RefreshCw,
  Save,
  AlertCircle,
  CheckCircle2,
  Layers
} from 'lucide-react';

interface OrchestrationMethod {
  methodId: string;
  methodCode: string;
  methodName: string;
  description: string;
  methodCategory: string;
  defaultParameters: Record<string, unknown>;
  parameterSchema: Record<string, unknown>;
  implementationType: 'prompt' | 'code' | 'composite' | 'external';
  promptTemplate?: string;
  modelRole: string;
  recommendedModels: string[];
  isEnabled: boolean;
}

interface MethodMetrics {
  methodCode: string;
  executionCount: number;
  avgLatencyMs: number;
  avgCostCents: number;
  avgQualityScore: number;
  successRate: number;
  last24hExecutions: number;
}

interface MethodExecution {
  executionId: string;
  methodCode: string;
  workflowCode: string;
  modelUsed: string;
  latencyMs: number;
  costCents: number;
  qualityScore: number;
  status: 'success' | 'failed';
  createdAt: string;
  inputTokens: number;
  outputTokens: number;
}

const CATEGORY_ICONS: Record<string, React.ReactNode> = {
  generation: <MessageSquare className="h-4 w-4" />,
  evaluation: <CheckCircle2 className="h-4 w-4" />,
  synthesis: <Layers className="h-4 w-4" />,
  routing: <Zap className="h-4 w-4" />,
  reasoning: <Code2 className="h-4 w-4" />,
  aggregation: <BarChart3 className="h-4 w-4" />,
  verification: <AlertCircle className="h-4 w-4" />,
};

const CATEGORY_COLORS: Record<string, string> = {
  generation: 'bg-blue-500/10 text-blue-500',
  evaluation: 'bg-amber-500/10 text-amber-500',
  synthesis: 'bg-purple-500/10 text-purple-500',
  routing: 'bg-green-500/10 text-green-500',
  reasoning: 'bg-cyan-500/10 text-cyan-500',
  aggregation: 'bg-pink-500/10 text-pink-500',
  verification: 'bg-orange-500/10 text-orange-500',
};

export default function OrchestrationMethodsPage() {
  const [methods, setMethods] = useState<OrchestrationMethod[]>([]);
  const [metrics, setMetrics] = useState<Record<string, MethodMetrics>>({});
  const [executions, setExecutions] = useState<MethodExecution[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedMethod, setSelectedMethod] = useState<OrchestrationMethod | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [editedParams, setEditedParams] = useState<Record<string, unknown>>({});
  const [saving, setSaving] = useState(false);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [methodsRes, metricsRes, executionsRes] = await Promise.all([
        fetch('/api/admin/orchestration/methods'),
        fetch('/api/admin/orchestration/metrics'),
        fetch('/api/admin/orchestration/executions?limit=50'),
      ]);

      if (methodsRes.ok) {
        const data = await methodsRes.json();
        setMethods(data.methods || getMockMethods());
      } else {
        setMethods(getMockMethods());
      }

      if (metricsRes.ok) {
        const data = await metricsRes.json();
        const metricsMap: Record<string, MethodMetrics> = {};
        (data.metrics || []).forEach((m: MethodMetrics) => {
          metricsMap[m.methodCode] = m;
        });
        setMetrics(metricsMap);
      }

      if (executionsRes.ok) {
        const data = await executionsRes.json();
        setExecutions(data.executions || []);
      }
    } catch (err) {
      console.error('Failed to load orchestration methods', err);
      setMethods(getMockMethods());
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleSelectMethod = (method: OrchestrationMethod) => {
    setSelectedMethod(method);
    setEditedParams({ ...method.defaultParameters });
  };

  const handleParamChange = (key: string, value: unknown) => {
    setEditedParams(prev => ({ ...prev, [key]: value }));
  };

  const handleSaveParams = async () => {
    if (!selectedMethod) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/admin/orchestration/methods/${selectedMethod.methodCode}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ defaultParameters: editedParams }),
      });
      if (res.ok) {
        setMethods(prev => prev.map(m => 
          m.methodCode === selectedMethod.methodCode 
            ? { ...m, defaultParameters: editedParams }
            : m
        ));
        setSelectedMethod(prev => prev ? { ...prev, defaultParameters: editedParams } : null);
      }
    } catch (err) {
      console.error('Failed to save parameters', err);
    } finally {
      setSaving(false);
    }
  };

  const filteredMethods = methods.filter(m => {
    const matchesSearch = m.methodName.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         m.methodCode.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         m.description.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = categoryFilter === 'all' || m.methodCategory === categoryFilter;
    return matchesSearch && matchesCategory;
  });

  const categories = Array.from(new Set(methods.map(m => m.methodCategory)));

  const methodMetrics = selectedMethod ? metrics[selectedMethod.methodCode] : null;
  const methodExecutions = selectedMethod 
    ? executions.filter(e => e.methodCode === selectedMethod.methodCode).slice(0, 10)
    : [];

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
          <h1 className="text-3xl font-bold tracking-tight">Orchestration Methods</h1>
          <p className="text-muted-foreground">
            Configure and monitor the {methods.length} reusable methods that power AI workflows
          </p>
        </div>
        <Button onClick={loadData} variant="outline" size="sm">
          <RefreshCw className="h-4 w-4 mr-2" />
          Refresh
        </Button>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Methods</CardTitle>
            <Settings2 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{methods.length}</div>
            <p className="text-xs text-muted-foreground">
              {methods.filter(m => m.isEnabled).length} enabled
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Executions (24h)</CardTitle>
            <Play className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {Object.values(metrics).reduce((sum, m) => sum + (m.last24hExecutions || 0), 0).toLocaleString()}
            </div>
            <p className="text-xs text-muted-foreground">
              Across all methods
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Avg Latency</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {Math.round(Object.values(metrics).reduce((sum, m) => sum + (m.avgLatencyMs || 0), 0) / Math.max(1, Object.keys(metrics).length))}ms
            </div>
            <p className="text-xs text-muted-foreground">
              Per method execution
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Avg Quality</CardTitle>
            <BarChart3 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {(Object.values(metrics).reduce((sum, m) => sum + (m.avgQualityScore || 0), 0) / Math.max(1, Object.keys(metrics).length) * 100).toFixed(1)}%
            </div>
            <p className="text-xs text-muted-foreground">
              Auto-assessed score
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Methods List */}
        <div className="lg:col-span-1 space-y-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg">Methods</CardTitle>
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search methods..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-8"
                  />
                </div>
              </div>
              <div className="flex gap-1 flex-wrap pt-2">
                <Badge 
                  variant={categoryFilter === 'all' ? 'default' : 'outline'}
                  className="cursor-pointer"
                  onClick={() => setCategoryFilter('all')}
                >
                  All
                </Badge>
                {categories.map(cat => (
                  <Badge
                    key={cat}
                    variant={categoryFilter === cat ? 'default' : 'outline'}
                    className={`cursor-pointer ${categoryFilter === cat ? '' : CATEGORY_COLORS[cat]}`}
                    onClick={() => setCategoryFilter(cat)}
                  >
                    {cat}
                  </Badge>
                ))}
              </div>
            </CardHeader>
            <CardContent className="max-h-[600px] overflow-auto">
              <div className="space-y-2">
                {filteredMethods.map(method => (
                  <div
                    key={method.methodCode}
                    className={`p-3 rounded-lg border cursor-pointer transition-colors ${
                      selectedMethod?.methodCode === method.methodCode
                        ? 'bg-accent border-primary'
                        : 'hover:bg-accent/50'
                    }`}
                    onClick={() => handleSelectMethod(method)}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        {CATEGORY_ICONS[method.methodCategory]}
                        <span className="font-medium text-sm">{method.methodName}</span>
                      </div>
                      <ChevronRight className="h-4 w-4 text-muted-foreground" />
                    </div>
                    <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                      {method.description}
                    </p>
                    <div className="flex gap-2 mt-2">
                      <Badge variant="outline" className={`text-xs ${CATEGORY_COLORS[method.methodCategory]}`}>
                        {method.methodCategory}
                      </Badge>
                      <Badge variant="outline" className="text-xs">
                        {method.implementationType}
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Method Details */}
        <div className="lg:col-span-2">
          {selectedMethod ? (
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      {CATEGORY_ICONS[selectedMethod.methodCategory]}
                      {selectedMethod.methodName}
                    </CardTitle>
                    <CardDescription className="mt-1">
                      <code className="text-xs bg-muted px-1 py-0.5 rounded">{selectedMethod.methodCode}</code>
                    </CardDescription>
                  </div>
                  <div className="flex items-center gap-2">
                    <Switch checked={selectedMethod.isEnabled} />
                    <span className="text-sm">{selectedMethod.isEnabled ? 'Enabled' : 'Disabled'}</span>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <Tabs defaultValue="parameters" className="space-y-4">
                  <TabsList>
                    <TabsTrigger value="parameters">Parameters</TabsTrigger>
                    <TabsTrigger value="parallel">Parallel & Streams</TabsTrigger>
                    <TabsTrigger value="template">Template</TabsTrigger>
                    <TabsTrigger value="metrics">Metrics</TabsTrigger>
                    <TabsTrigger value="executions">Executions</TabsTrigger>
                  </TabsList>

                  <TabsContent value="parameters" className="space-y-4">
                    <p className="text-sm text-muted-foreground">{selectedMethod.description}</p>
                    
                    <div className="border rounded-lg p-4 space-y-4">
                      <h4 className="font-medium">Default Parameters</h4>
                      {Object.entries(editedParams).map(([key, value]) => (
                        <div key={key} className="space-y-2">
                          <Label htmlFor={key} className="capitalize">
                            {key.replace(/_/g, ' ')}
                          </Label>
                          {typeof value === 'boolean' ? (
                            <div className="flex items-center gap-2">
                              <Switch
                                id={key}
                                checked={value as boolean}
                                onCheckedChange={(v) => handleParamChange(key, v)}
                              />
                              <span className="text-sm text-muted-foreground">
                                {value ? 'Enabled' : 'Disabled'}
                              </span>
                            </div>
                          ) : typeof value === 'number' ? (
                            <div className="space-y-2">
                              <div className="flex items-center gap-4">
                                <Slider
                                  id={key}
                                  value={[value as number]}
                                  onValueChange={([v]) => handleParamChange(key, v)}
                                  max={key.includes('temperature') ? 2 : key.includes('tokens') ? 16384 : 100}
                                  min={0}
                                  step={key.includes('temperature') ? 0.1 : 1}
                                  className="flex-1"
                                />
                                <Input
                                  type="number"
                                  value={value as number}
                                  onChange={(e) => handleParamChange(key, parseFloat(e.target.value))}
                                  className="w-24"
                                />
                              </div>
                            </div>
                          ) : Array.isArray(value) ? (
                            <Input
                              id={key}
                              value={(value as string[]).join(', ')}
                              onChange={(e) => handleParamChange(key, e.target.value.split(',').map(s => s.trim()))}
                              placeholder="Comma-separated values"
                            />
                          ) : (
                            <Input
                              id={key}
                              value={String(value)}
                              onChange={(e) => handleParamChange(key, e.target.value)}
                            />
                          )}
                        </div>
                      ))}
                      <Button onClick={handleSaveParams} disabled={saving}>
                        <Save className="h-4 w-4 mr-2" />
                        {saving ? 'Saving...' : 'Save Parameters'}
                      </Button>
                    </div>

                    <div className="border rounded-lg p-4">
                      <h4 className="font-medium mb-2">Recommended Models</h4>
                      <div className="flex flex-wrap gap-2">
                        {selectedMethod.recommendedModels.map(model => (
                          <Badge key={model} variant="secondary">{model}</Badge>
                        ))}
                      </div>
                      <p className="text-xs text-muted-foreground mt-2">
                        Model Role: <code>{selectedMethod.modelRole}</code>
                      </p>
                    </div>
                  </TabsContent>

                  <TabsContent value="parallel" className="space-y-4">
                    <div className="border rounded-lg p-4 space-y-4">
                      <h4 className="font-medium">Multi-Model Parallel Execution</h4>
                      <p className="text-sm text-muted-foreground">
                        Configure how this method runs across multiple AI models simultaneously.
                      </p>
                      
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label>Execution Mode</Label>
                          <select className="w-full p-2 border rounded-md text-sm">
                            <option value="all">All - Wait for all models</option>
                            <option value="race">Race - First response wins</option>
                            <option value="quorum">Quorum - Majority consensus</option>
                          </select>
                          <p className="text-xs text-muted-foreground">
                            How to handle multiple model responses
                          </p>
                        </div>
                        
                        <div className="space-y-2">
                          <Label>Synthesis Strategy</Label>
                          <select className="w-full p-2 border rounded-md text-sm">
                            <option value="best_of">Best Of - Highest confidence</option>
                            <option value="merge">Merge - Combine all responses</option>
                            <option value="vote">Vote - Majority answer</option>
                            <option value="weighted">Weighted - By confidence</option>
                          </select>
                          <p className="text-xs text-muted-foreground">
                            How to combine multi-model results
                          </p>
                        </div>
                      </div>
                    </div>

                    <div className="border rounded-lg p-4 space-y-4 bg-gradient-to-r from-blue-500/5 to-purple-500/5">
                      <div className="flex items-center gap-2">
                        <Layers className="h-5 w-5 text-blue-500" />
                        <h4 className="font-medium">Output Stream Configuration</h4>
                        <Badge variant="outline" className="ml-auto">NEW</Badge>
                      </div>
                      <p className="text-sm text-muted-foreground">
                        Control how many output streams this method produces when using multiple models.
                      </p>
                      
                      <div className="space-y-3">
                        <Label>Output Mode</Label>
                        <div className="grid grid-cols-2 gap-3">
                          <div className="border rounded-lg p-3 cursor-pointer hover:bg-accent/50 transition-colors">
                            <div className="flex items-center gap-2 mb-1">
                              <div className="w-3 h-3 rounded-full bg-blue-500" />
                              <span className="font-medium text-sm">Single</span>
                            </div>
                            <p className="text-xs text-muted-foreground">
                              1 synthesized stream → <code className="text-xs">{'{{response}}'}</code>
                            </p>
                          </div>
                          <div className="border rounded-lg p-3 cursor-pointer hover:bg-accent/50 transition-colors">
                            <div className="flex items-center gap-2 mb-1">
                              <div className="flex gap-0.5">
                                <div className="w-2 h-3 rounded-sm bg-green-500" />
                                <div className="w-2 h-3 rounded-sm bg-green-500" />
                                <div className="w-2 h-3 rounded-sm bg-green-500" />
                              </div>
                              <span className="font-medium text-sm">All</span>
                            </div>
                            <p className="text-xs text-muted-foreground">
                              N streams (one per model) → <code className="text-xs">{'{{responses}}'}</code>
                            </p>
                          </div>
                          <div className="border rounded-lg p-3 cursor-pointer hover:bg-accent/50 transition-colors">
                            <div className="flex items-center gap-2 mb-1">
                              <div className="flex gap-0.5">
                                <div className="w-2 h-3 rounded-sm bg-amber-500" />
                                <div className="w-2 h-3 rounded-sm bg-amber-500" />
                              </div>
                              <span className="font-medium text-sm">Top N</span>
                            </div>
                            <p className="text-xs text-muted-foreground">
                              Best N by confidence → <code className="text-xs">{'{{responses}}'}</code>
                            </p>
                          </div>
                          <div className="border rounded-lg p-3 cursor-pointer hover:bg-accent/50 transition-colors">
                            <div className="flex items-center gap-2 mb-1">
                              <div className="flex gap-0.5">
                                <div className="w-2 h-3 rounded-sm bg-purple-500" />
                                <div className="w-2 h-3 rounded-sm bg-purple-300" />
                              </div>
                              <span className="font-medium text-sm">Threshold</span>
                            </div>
                            <p className="text-xs text-muted-foreground">
                              Only ≥ confidence threshold → <code className="text-xs">{'{{responses}}'}</code>
                            </p>
                          </div>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-4 pt-2">
                        <div className="space-y-2">
                          <Label htmlFor="outputTopN">Top N Count</Label>
                          <div className="flex items-center gap-2">
                            <Slider
                              id="outputTopN"
                              value={[2]}
                              min={1}
                              max={5}
                              step={1}
                              className="flex-1"
                            />
                            <span className="text-sm font-mono w-8">2</span>
                          </div>
                          <p className="text-xs text-muted-foreground">For Top N mode</p>
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="outputThreshold">Confidence Threshold</Label>
                          <div className="flex items-center gap-2">
                            <Slider
                              id="outputThreshold"
                              value={[70]}
                              min={0}
                              max={100}
                              step={5}
                              className="flex-1"
                            />
                            <span className="text-sm font-mono w-12">70%</span>
                          </div>
                          <p className="text-xs text-muted-foreground">For Threshold mode</p>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 pt-2">
                        <Switch id="preserveModelAttribution" />
                        <Label htmlFor="preserveModelAttribution" className="text-sm">
                          Preserve Model Attribution
                        </Label>
                        <span className="text-xs text-muted-foreground ml-auto">
                          Include model ID with each stream
                        </span>
                      </div>
                    </div>

                    <div className="border rounded-lg p-4 bg-muted/30">
                      <h4 className="font-medium mb-2">Stream Flow Diagram</h4>
                      <div className="font-mono text-xs space-y-1 text-muted-foreground">
                        <div>3 Models with outputMode=&apos;all&apos;:</div>
                        <div className="pl-4">
                          <div>┌─────────┐ ┌─────────┐ ┌─────────┐</div>
                          <div>│ Model 1 │ │ Model 2 │ │ Model 3 │</div>
                          <div>└────┬────┘ └────┬────┘ └────┬────┘</div>
                          <div>     └──────────┼──────────┘</div>
                          <div>                ▼</div>
                          <div>   {'{{responses}}'} = [stream1, stream2, stream3]</div>
                          <div>                │</div>
                          <div>                ▼</div>
                          <div>        ┌─────────────────┐</div>
                          <div>        │   Next Step     │</div>
                          <div>        │ (receives all 3)│</div>
                          <div>        └─────────────────┘</div>
                        </div>
                      </div>
                    </div>
                  </TabsContent>

                  <TabsContent value="template">
                    {selectedMethod.implementationType === 'prompt' && selectedMethod.promptTemplate ? (
                      <div className="space-y-4">
                        <div className="border rounded-lg p-4 bg-muted/50">
                          <h4 className="font-medium mb-2">Prompt Template</h4>
                          <pre className="text-sm whitespace-pre-wrap font-mono">
                            {selectedMethod.promptTemplate}
                          </pre>
                        </div>
                        <div className="border rounded-lg p-4">
                          <h4 className="font-medium mb-2">Available Variables</h4>
                          <div className="grid grid-cols-2 gap-2 text-sm">
                            <div><code>{'{{prompt}}'}</code> - Original user prompt</div>
                            <div><code>{'{{context}}'}</code> - Additional context</div>
                            <div><code>{'{{response}}'}</code> - Previous step output</div>
                            <div><code>{'{{responses}}'}</code> - Multiple outputs</div>
                            <div><code>{'{{original_prompt}}'}</code> - Unchanged prompt</div>
                            <div><code>{'{{feedback}}'}</code> - Critique output</div>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="border rounded-lg p-4">
                        <h4 className="font-medium mb-2">Code Implementation</h4>
                        <p className="text-sm text-muted-foreground">
                          This method uses code-based implementation:
                        </p>
                        <code className="text-sm mt-2 block">{selectedMethod.promptTemplate || 'N/A'}</code>
                      </div>
                    )}
                  </TabsContent>

                  <TabsContent value="metrics">
                    {methodMetrics ? (
                      <div className="grid grid-cols-2 gap-4">
                        <Card>
                          <CardHeader className="pb-2">
                            <CardTitle className="text-sm">Total Executions</CardTitle>
                          </CardHeader>
                          <CardContent>
                            <div className="text-2xl font-bold">{methodMetrics.executionCount.toLocaleString()}</div>
                            <p className="text-xs text-muted-foreground">
                              {methodMetrics.last24hExecutions} in last 24h
                            </p>
                          </CardContent>
                        </Card>
                        <Card>
                          <CardHeader className="pb-2">
                            <CardTitle className="text-sm">Avg Latency</CardTitle>
                          </CardHeader>
                          <CardContent>
                            <div className="text-2xl font-bold">{Math.round(methodMetrics.avgLatencyMs)}ms</div>
                          </CardContent>
                        </Card>
                        <Card>
                          <CardHeader className="pb-2">
                            <CardTitle className="text-sm">Avg Cost</CardTitle>
                          </CardHeader>
                          <CardContent>
                            <div className="text-2xl font-bold">${(methodMetrics.avgCostCents / 100).toFixed(4)}</div>
                            <p className="text-xs text-muted-foreground">Per execution</p>
                          </CardContent>
                        </Card>
                        <Card>
                          <CardHeader className="pb-2">
                            <CardTitle className="text-sm">Quality Score</CardTitle>
                          </CardHeader>
                          <CardContent>
                            <div className="text-2xl font-bold">{(methodMetrics.avgQualityScore * 100).toFixed(1)}%</div>
                            <p className="text-xs text-muted-foreground">
                              {(methodMetrics.successRate * 100).toFixed(0)}% success rate
                            </p>
                          </CardContent>
                        </Card>
                      </div>
                    ) : (
                      <div className="text-center py-8 text-muted-foreground">
                        No metrics available for this method
                      </div>
                    )}
                  </TabsContent>

                  <TabsContent value="executions">
                    {methodExecutions.length > 0 ? (
                      <div className="space-y-2">
                        {methodExecutions.map(exec => (
                          <div key={exec.executionId} className="border rounded-lg p-3 text-sm">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                {exec.status === 'success' ? (
                                  <CheckCircle2 className="h-4 w-4 text-green-500" />
                                ) : (
                                  <AlertCircle className="h-4 w-4 text-red-500" />
                                )}
                                <span className="font-mono text-xs">{exec.workflowCode}</span>
                              </div>
                              <span className="text-muted-foreground text-xs">
                                {new Date(exec.createdAt).toLocaleString()}
                              </span>
                            </div>
                            <div className="flex gap-4 mt-2 text-xs text-muted-foreground">
                              <span>Model: {exec.modelUsed}</span>
                              <span>{exec.latencyMs}ms</span>
                              <span>${(exec.costCents / 100).toFixed(4)}</span>
                              <span>{exec.inputTokens + exec.outputTokens} tokens</span>
                              <span>Quality: {(exec.qualityScore * 100).toFixed(0)}%</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-center py-8 text-muted-foreground">
                        No recent executions
                      </div>
                    )}
                  </TabsContent>
                </Tabs>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-16">
                <Settings2 className="h-12 w-12 text-muted-foreground mb-4" />
                <h3 className="text-lg font-medium">Select a Method</h3>
                <p className="text-sm text-muted-foreground text-center max-w-md mt-2">
                  Choose a method from the list to view its parameters, template, metrics, and recent executions.
                </p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}

function getMockMethods(): OrchestrationMethod[] {
  return [
    {
      methodId: '1',
      methodCode: 'GENERATE_RESPONSE',
      methodName: 'Generate Response',
      description: 'Generate a response to a prompt using specified model',
      methodCategory: 'generation',
      defaultParameters: { temperature: 0.7, max_tokens: 4096 },
      parameterSchema: {},
      implementationType: 'prompt',
      promptTemplate: 'Generate a response to: {{prompt}}\n\nContext: {{context}}',
      modelRole: 'generator',
      recommendedModels: ['anthropic/claude-3-5-sonnet-20241022', 'openai/gpt-4o'],
      isEnabled: true,
    },
    {
      methodId: '2',
      methodCode: 'GENERATE_WITH_COT',
      methodName: 'Generate with Chain-of-Thought',
      description: 'Generate response using chain-of-thought reasoning',
      methodCategory: 'generation',
      defaultParameters: { temperature: 0.3, max_tokens: 8192, thinking_budget: 2000 },
      parameterSchema: {},
      implementationType: 'prompt',
      promptTemplate: 'Think through this step-by-step before answering:\n\n{{prompt}}\n\nShow your reasoning, then provide your answer.',
      modelRole: 'generator',
      recommendedModels: ['openai/o1', 'deepseek/deepseek-reasoner'],
      isEnabled: true,
    },
    {
      methodId: '3',
      methodCode: 'CRITIQUE_RESPONSE',
      methodName: 'Critique Response',
      description: 'Critically evaluate a response for flaws and improvements',
      methodCategory: 'evaluation',
      defaultParameters: { focus_areas: ['accuracy', 'completeness', 'clarity', 'logic'], severity_threshold: 'medium' },
      parameterSchema: {},
      implementationType: 'prompt',
      promptTemplate: 'Critically evaluate this response...',
      modelRole: 'critic',
      recommendedModels: ['openai/o1', 'anthropic/claude-3-5-sonnet-20241022'],
      isEnabled: true,
    },
    {
      methodId: '4',
      methodCode: 'JUDGE_RESPONSES',
      methodName: 'Judge Multiple Responses',
      description: 'Compare and judge multiple responses to select the best',
      methodCategory: 'evaluation',
      defaultParameters: { evaluation_mode: 'pairwise', criteria: ['accuracy', 'helpfulness', 'clarity', 'completeness'] },
      parameterSchema: {},
      implementationType: 'prompt',
      promptTemplate: 'Judge these responses to the question...',
      modelRole: 'judge',
      recommendedModels: ['openai/o1', 'anthropic/claude-3-5-sonnet-20241022'],
      isEnabled: true,
    },
    {
      methodId: '5',
      methodCode: 'SYNTHESIZE_RESPONSES',
      methodName: 'Synthesize Multiple Responses',
      description: 'Combine best parts from multiple responses',
      methodCategory: 'synthesis',
      defaultParameters: { combination_strategy: 'best_parts', conflict_resolution: 'majority' },
      parameterSchema: {},
      implementationType: 'prompt',
      promptTemplate: 'Synthesize these responses into one superior response...',
      modelRole: 'synthesizer',
      recommendedModels: ['anthropic/claude-3-5-sonnet-20241022', 'openai/gpt-4o'],
      isEnabled: true,
    },
    {
      methodId: '6',
      methodCode: 'VERIFY_FACTS',
      methodName: 'Verify Factual Claims',
      description: 'Extract and verify factual claims in a response',
      methodCategory: 'verification',
      defaultParameters: { extraction_method: 'explicit', verification_depth: 'thorough' },
      parameterSchema: {},
      implementationType: 'prompt',
      promptTemplate: 'Extract all factual claims from this response and verify each...',
      modelRole: 'verifier',
      recommendedModels: ['openai/o1', 'anthropic/claude-3-5-sonnet-20241022'],
      isEnabled: true,
    },
    {
      methodId: '7',
      methodCode: 'DECOMPOSE_PROBLEM',
      methodName: 'Decompose Problem',
      description: 'Break down a complex problem into sub-problems',
      methodCategory: 'reasoning',
      defaultParameters: { max_subproblems: 5, decomposition_strategy: 'functional' },
      parameterSchema: {},
      implementationType: 'prompt',
      promptTemplate: 'Decompose this problem into smaller sub-problems...',
      modelRole: 'reasoner',
      recommendedModels: ['openai/o1', 'anthropic/claude-3-5-sonnet-20241022'],
      isEnabled: true,
    },
    {
      methodId: '8',
      methodCode: 'SELF_REFLECT',
      methodName: 'Self Reflect',
      description: 'AI reflects on its own response to identify improvements',
      methodCategory: 'evaluation',
      defaultParameters: { reflection_depth: 'thorough', aspects: ['accuracy', 'completeness', 'clarity'] },
      parameterSchema: {},
      implementationType: 'prompt',
      promptTemplate: 'Reflect on your response...',
      modelRole: 'critic',
      recommendedModels: ['anthropic/claude-3-5-sonnet-20241022', 'openai/o1'],
      isEnabled: true,
    },
    {
      methodId: '9',
      methodCode: 'DETECT_TASK_TYPE',
      methodName: 'Detect Task Type',
      description: 'Analyze prompt to determine task type and complexity',
      methodCategory: 'routing',
      defaultParameters: { task_categories: ['coding', 'reasoning', 'creative', 'factual', 'math', 'research'] },
      parameterSchema: {},
      implementationType: 'prompt',
      promptTemplate: 'Analyze this prompt and classify it...',
      modelRole: 'router',
      recommendedModels: ['openai/gpt-4o-mini', 'anthropic/claude-3-5-haiku-20241022'],
      isEnabled: true,
    },
    {
      methodId: '10',
      methodCode: 'MAJORITY_VOTE',
      methodName: 'Majority Vote',
      description: 'Select the most common answer from multiple responses',
      methodCategory: 'aggregation',
      defaultParameters: { vote_method: 'exact_match', tie_breaker: 'first' },
      parameterSchema: {},
      implementationType: 'code',
      modelRole: 'aggregator',
      recommendedModels: [],
      isEnabled: true,
    },
  ];
}
