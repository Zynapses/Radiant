'use client';

import React, { useState, useMemo, useRef, useEffect } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import {
  CanvasControls,
  ConnectionModeIndicator,
  ConnectionLine,
  NodeActionsDropdown,
  ParallelExecutionPanel,
  useWorkflowEditor,
  ParallelExecutionConfig,
  Card,
  CardContent,
  Input,
  Label,
  Badge,
  Textarea,
  Switch,
  ScrollArea,
  Slider,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
  cn,
  Button,
} from '@/components/workflow-editor';
import { CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { Separator } from '@/components/ui/separator';
import {
  Sparkles,
  MessageSquare,
  Scale,
  Shield,
  GitMerge,
  RefreshCw,
  Brain,
  Target,
  Users,
  Layers,
  Zap,
  XCircle,
  ChevronLeft,
  Undo,
  Redo,
  Settings,
  Loader2,
  Play,
  Save,
  Search,
  Link2,
} from 'lucide-react';

// ============================================================================
// Types
// ============================================================================

type MethodRole = 'generator' | 'critic' | 'judge' | 'verifier' | 'synthesizer' | 'challenger' | 'defender' | 'router' | 'reasoner' | 'aggregator';

interface OrchestrationMethod {
  id: string;
  code: string;
  name: string;
  category: string;
  role: MethodRole;
  description: string;
  defaultParameters: Record<string, unknown>;
}

interface WorkflowStep {
  id: string;
  methodId: string;
  method: OrchestrationMethod;
  x: number;
  y: number;
  stepOrder: number;
  stepName: string;
  parameterOverrides: Record<string, unknown>;
  conditionExpression?: string;
  isIterative: boolean;
  maxIterations: number;
  modelOverride?: string;
  outputVariable?: string;
  dependsOn: string[];
  parallelExecution?: ParallelExecutionConfig;
}

interface WorkflowConnection {
  id: string;
  sourceId: string;
  targetId: string;
  label?: string;
}

interface OrchestrationWorkflow {
  id: string;
  code: string;
  commonName: string;
  formalName: string;
  category: string;
  description: string;
  steps: WorkflowStep[];
  connections: WorkflowConnection[];
  defaultConfig: Record<string, unknown>;
  isEnabled: boolean;
}

// ============================================================================
// Constants
// ============================================================================

const ORCHESTRATION_METHODS: OrchestrationMethod[] = [
  { id: 'm1', code: 'GENERATE_RESPONSE', name: 'Generate Response', category: 'generation', role: 'generator', description: 'Generate a response using AI model', defaultParameters: { temperature: 0.7, maxTokens: 4096 } },
  { id: 'm2', code: 'GENERATE_WITH_COT', name: 'Chain-of-Thought', category: 'generation', role: 'generator', description: 'Generate with step-by-step reasoning', defaultParameters: { temperature: 0.3, thinkingBudget: 2000 } },
  { id: 'm3', code: 'CRITIQUE_RESPONSE', name: 'Critique Response', category: 'evaluation', role: 'critic', description: 'Critically evaluate a response for flaws', defaultParameters: { focusAreas: ['accuracy', 'completeness'] } },
  { id: 'm4', code: 'JUDGE_RESPONSES', name: 'Judge Responses', category: 'evaluation', role: 'judge', description: 'Compare and judge multiple responses', defaultParameters: { evaluationMode: 'pairwise' } },
  { id: 'm5', code: 'VERIFY_FACTS', name: 'Verify Facts', category: 'verification', role: 'verifier', description: 'Extract and verify factual claims', defaultParameters: { verificationDepth: 'thorough' } },
  { id: 'm6', code: 'SYNTHESIZE_RESPONSES', name: 'Synthesize Responses', category: 'synthesis', role: 'synthesizer', description: 'Combine best parts from multiple responses', defaultParameters: { combinationStrategy: 'best_parts' } },
  { id: 'm7', code: 'BUILD_CONSENSUS', name: 'Build Consensus', category: 'synthesis', role: 'synthesizer', description: 'Identify points of agreement', defaultParameters: { consensusThreshold: 0.7 } },
  { id: 'm8', code: 'GENERATE_CHALLENGE', name: 'Generate Challenge', category: 'evaluation', role: 'challenger', description: 'Challenge by arguing opposite position', defaultParameters: { challengeIntensity: 'moderate' } },
  { id: 'm9', code: 'DEFEND_POSITION', name: 'Defend Position', category: 'evaluation', role: 'defender', description: 'Defend response against challenges', defaultParameters: { defenseStrategy: 'address_all' } },
  { id: 'm10', code: 'DETECT_TASK_TYPE', name: 'Detect Task Type', category: 'routing', role: 'router', description: 'Analyze prompt for task type', defaultParameters: { taskCategories: ['coding', 'reasoning'] } },
  { id: 'm11', code: 'SELECT_BEST_MODEL', name: 'Select Best Model', category: 'routing', role: 'router', description: 'Choose optimal model for task', defaultParameters: { considerCost: true } },
  { id: 'm12', code: 'DECOMPOSE_PROBLEM', name: 'Decompose Problem', category: 'reasoning', role: 'reasoner', description: 'Break down complex problems', defaultParameters: { maxSubproblems: 5 } },
  { id: 'm13', code: 'SELF_REFLECT', name: 'Self Reflect', category: 'evaluation', role: 'critic', description: 'AI reflects on own response', defaultParameters: { reflectionDepth: 'thorough' } },
  { id: 'm14', code: 'MAJORITY_VOTE', name: 'Majority Vote', category: 'aggregation', role: 'aggregator', description: 'Select most common answer', defaultParameters: { voteMethod: 'exact_match' } },
  { id: 'm15', code: 'WEIGHTED_AGGREGATE', name: 'Weighted Aggregate', category: 'aggregation', role: 'aggregator', description: 'Combine weighted by confidence', defaultParameters: { weightBy: 'confidence' } },
];

const ROLE_CONFIG: Record<MethodRole, { bgColor: string; icon: React.ReactNode }> = {
  generator: { bgColor: 'bg-blue-500', icon: <Sparkles className="h-4 w-4" /> },
  critic: { bgColor: 'bg-orange-500', icon: <MessageSquare className="h-4 w-4" /> },
  judge: { bgColor: 'bg-purple-500', icon: <Scale className="h-4 w-4" /> },
  verifier: { bgColor: 'bg-green-500', icon: <Shield className="h-4 w-4" /> },
  synthesizer: { bgColor: 'bg-cyan-500', icon: <GitMerge className="h-4 w-4" /> },
  challenger: { bgColor: 'bg-red-500', icon: <Zap className="h-4 w-4" /> },
  defender: { bgColor: 'bg-emerald-500', icon: <Shield className="h-4 w-4" /> },
  router: { bgColor: 'bg-indigo-500', icon: <Target className="h-4 w-4" /> },
  reasoner: { bgColor: 'bg-violet-500', icon: <Brain className="h-4 w-4" /> },
  aggregator: { bgColor: 'bg-pink-500', icon: <Users className="h-4 w-4" /> },
};


// ============================================================================
// Step Node Component
// ============================================================================

function StepNode({
  step,
  isSelected,
  onSelect,
  onDelete,
  onDuplicate,
  onStartConnect,
  onEndConnect,
  isConnecting,
}: {
  step: WorkflowStep;
  isSelected: boolean;
  onSelect: () => void;
  onDelete: () => void;
  onDuplicate: () => void;
  onStartConnect: () => void;
  onEndConnect: () => void;
  isConnecting: boolean;
}) {
  const roleConfig = ROLE_CONFIG[step.method.role];

  return (
    <div
      className={cn('absolute cursor-pointer transition-all duration-150', isSelected && 'z-10')}
      style={{ left: step.x, top: step.y }}
      onClick={(e) => { e.stopPropagation(); onSelect(); }}
    >
      <div className={cn(
        'relative group rounded-xl border-2 bg-background shadow-sm transition-all min-w-[180px]',
        isSelected ? 'border-primary shadow-lg ring-2 ring-primary/20' : 'border-border hover:border-primary/50 hover:shadow-md'
      )}>
        <div className={cn('flex items-center gap-2 px-3 py-2 rounded-t-lg text-white', roleConfig.bgColor)}>
          {roleConfig.icon}
          <span className="font-medium text-sm truncate">{step.stepName}</span>
          {step.isIterative && (
            <Badge variant="secondary" className="ml-auto text-xs bg-white/20">
              <RefreshCw className="h-3 w-3 mr-1" />
              {step.maxIterations}x
            </Badge>
          )}
        </div>
        
        <div className="px-3 py-2">
          <p className="text-xs font-medium text-muted-foreground">{step.method.name}</p>
          <p className="text-xs text-muted-foreground/70 mt-1 truncate">{step.method.description}</p>
          {step.parallelExecution?.enabled && (
            <Badge variant="outline" className="mt-2 text-xs">
              ⚡ {step.parallelExecution.models.length} models
            </Badge>
          )}
        </div>

        <div className="absolute -left-3 -top-3 w-6 h-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xs font-bold shadow">
          {step.stepOrder}
        </div>

        <button
          className={cn(
            'absolute -top-3 left-1/2 -translate-x-1/2 w-5 h-5 rounded-full border-2 border-background transition-all',
            isConnecting ? 'bg-green-500 ring-2 ring-green-500/50' : 'bg-primary hover:scale-125'
          )}
          onClick={(e) => { e.stopPropagation(); onEndConnect(); }}
        />

        <button
          className="absolute -bottom-3 left-1/2 -translate-x-1/2 w-5 h-5 rounded-full border-2 border-background bg-primary hover:scale-125 transition-all"
          onClick={(e) => { e.stopPropagation(); onStartConnect(); }}
        />

        <NodeActionsDropdown onDuplicate={onDuplicate} onDelete={onDelete} />
      </div>
    </div>
  );
}

// ============================================================================
// Step Config Panel
// ============================================================================

function StepConfigPanel({
  step,
  onUpdate,
  onClose,
}: {
  step: WorkflowStep;
  onUpdate: (updates: Partial<WorkflowStep>) => void;
  onClose: () => void;
}) {
  const roleConfig = ROLE_CONFIG[step.method.role];

  return (
    <Card className="h-full">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className={cn('p-2 rounded-lg text-white', roleConfig.bgColor)}>
              {roleConfig.icon}
            </div>
            <div>
              <CardTitle className="text-lg">{step.stepName}</CardTitle>
              <CardDescription>{step.method.name}</CardDescription>
            </div>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <XCircle className="h-4 w-4" />
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <ScrollArea className="h-[calc(100vh-20rem)]">
          <Tabs defaultValue="general" className="w-full">
            <TabsList className="w-full grid grid-cols-4">
              <TabsTrigger value="general">General</TabsTrigger>
              <TabsTrigger value="params">Params</TabsTrigger>
              <TabsTrigger value="parallel">Parallel</TabsTrigger>
              <TabsTrigger value="advanced">Advanced</TabsTrigger>
            </TabsList>

            <TabsContent value="general" className="space-y-4 mt-4">
              <div className="space-y-2">
                <Label>Step Name</Label>
                <Input value={step.stepName} onChange={(e) => onUpdate({ stepName: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>Step Order</Label>
                <Input type="number" value={step.stepOrder} onChange={(e) => onUpdate({ stepOrder: Number(e.target.value) })} min={1} />
              </div>
              <div className="space-y-2">
                <Label>Model Override</Label>
                <Select value={step.modelOverride || 'default'} onValueChange={(v) => onUpdate({ modelOverride: v === 'default' ? undefined : v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="default">Use Default</SelectItem>
                    <SelectItem value="claude-3-5-sonnet">Claude 3.5 Sonnet</SelectItem>
                    <SelectItem value="gpt-4o">GPT-4o</SelectItem>
                    <SelectItem value="o1">OpenAI o1</SelectItem>
                    <SelectItem value="deepseek-chat">DeepSeek Chat</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Output Variable</Label>
                <Input value={step.outputVariable || ''} onChange={(e) => onUpdate({ outputVariable: e.target.value })} placeholder="e.g., response_a" />
              </div>
            </TabsContent>

            <TabsContent value="params" className="space-y-4 mt-4">
              <div className="bg-muted/50 rounded-lg p-3 mb-4">
                <h4 className="text-sm font-medium mb-2">Default Parameters</h4>
                <pre className="text-xs text-muted-foreground overflow-x-auto">
                  {JSON.stringify(step.method.defaultParameters, null, 2)}
                </pre>
              </div>
              <div className="space-y-2">
                <Label>Parameter Overrides (JSON)</Label>
                <Textarea
                  value={JSON.stringify(step.parameterOverrides, null, 2)}
                  onChange={(e) => {
                    try { onUpdate({ parameterOverrides: JSON.parse(e.target.value) }); } catch { /* invalid JSON */ }
                  }}
                  rows={6}
                  className="font-mono text-sm"
                />
              </div>
              {step.method.role === 'generator' && (
                <div className="space-y-2">
                  <Label>Temperature</Label>
                  <div className="flex items-center gap-4">
                    <Slider
                      value={[Number(step.parameterOverrides.temperature || 0.7)]}
                      onValueChange={([v]) => onUpdate({ parameterOverrides: { ...step.parameterOverrides, temperature: v } })}
                      min={0} max={2} step={0.1} className="flex-1"
                    />
                    <span className="text-sm w-12">{Number(step.parameterOverrides.temperature || 0.7).toFixed(1)}</span>
                  </div>
                </div>
              )}
            </TabsContent>

            <TabsContent value="parallel" className="mt-4">
              <ParallelExecutionPanel
                config={step.parallelExecution}
                onUpdate={(config) => onUpdate({ parallelExecution: config })}
              />
            </TabsContent>

            <TabsContent value="advanced" className="space-y-4 mt-4">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Iterative Execution</Label>
                  <p className="text-xs text-muted-foreground">Repeat this step multiple times</p>
                </div>
                <Switch checked={step.isIterative} onCheckedChange={(v) => onUpdate({ isIterative: v })} />
              </div>
              {step.isIterative && (
                <div className="space-y-2">
                  <Label>Max Iterations</Label>
                  <Input type="number" value={step.maxIterations} onChange={(e) => onUpdate({ maxIterations: Number(e.target.value) })} min={1} max={10} />
                </div>
              )}
              <div className="space-y-2">
                <Label>Condition Expression</Label>
                <Textarea value={step.conditionExpression || ''} onChange={(e) => onUpdate({ conditionExpression: e.target.value })} placeholder="e.g., confidence < 0.7" rows={2} />
              </div>
            </TabsContent>
          </Tabs>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}

// ============================================================================
// Main Editor Page
// ============================================================================

// Default empty workflow
const DEFAULT_WORKFLOW: OrchestrationWorkflow = {
  id: '',
  code: '',
  commonName: 'New Workflow',
  formalName: '',
  category: '',
  description: '',
  steps: [],
  connections: [],
  defaultConfig: {},
  isEnabled: true,
};

const API_BASE = process.env.NEXT_PUBLIC_API_URL || '';

export default function OrchestrationPatternEditorPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const patternCode = searchParams.get('pattern') || 'SOD';

  const [workflow, setWorkflow] = useState<OrchestrationWorkflow>(DEFAULT_WORKFLOW);
  const [selectedStep, setSelectedStep] = useState<string | null>(null);
  const [selectedConnection, setSelectedConnection] = useState<string | null>(null);
  const [methodSearch, setMethodSearch] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const canvasRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    async function loadWorkflow() {
      setIsLoading(true);
      try {
        const res = await fetch(`${API_BASE}/api/admin/orchestration-patterns/${patternCode}`);
        if (res.ok) {
          const { data } = await res.json();
          if (data) setWorkflow(data);
        }
      } catch (error) {
        console.error('Failed to load workflow:', error);
      } finally {
        setIsLoading(false);
      }
    }
    loadWorkflow();
  }, [patternCode]);

  const {
    zoom,
    isConnecting,
    setIsConnecting,
    showSettings,
    setShowSettings,
    isRunning,
    handleZoomIn,
    handleZoomOut,
    handleResetZoom,
    handleRun,
  } = useWorkflowEditor();

  const selectedStepData = useMemo(() => workflow.steps.find(s => s.id === selectedStep), [workflow.steps, selectedStep]);

  const filteredMethods = useMemo(() => {
    if (!methodSearch) return ORCHESTRATION_METHODS;
    return ORCHESTRATION_METHODS.filter(m => 
      m.name.toLowerCase().includes(methodSearch.toLowerCase()) ||
      m.code.toLowerCase().includes(methodSearch.toLowerCase())
    );
  }, [methodSearch]);

  const handleAddStep = (method: OrchestrationMethod) => {
    const existingSteps = workflow.steps.length;
    const gridCol = existingSteps % 3;
    const gridRow = Math.floor(existingSteps / 3);
    
    const newStep: WorkflowStep = {
      id: `step-${Date.now()}`,
      methodId: method.id,
      method,
      x: 150 + gridCol * 250,
      y: 100 + gridRow * 180,
      stepOrder: existingSteps + 1,
      stepName: `${method.name} ${existingSteps + 1}`,
      parameterOverrides: {},
      isIterative: false,
      maxIterations: 1,
      dependsOn: [],
    };

    setWorkflow(prev => ({ ...prev, steps: [...prev.steps, newStep] }));
    setSelectedStep(newStep.id);
  };

  const handleDeleteStep = (stepId: string) => {
    setWorkflow(prev => ({
      ...prev,
      steps: prev.steps.filter(s => s.id !== stepId),
      connections: prev.connections.filter(c => c.sourceId !== stepId && c.targetId !== stepId),
    }));
    if (selectedStep === stepId) setSelectedStep(null);
  };

  const handleDuplicateStep = (stepId: string) => {
    const step = workflow.steps.find(s => s.id === stepId);
    if (step) {
      const newStep: WorkflowStep = {
        ...step,
        id: `step-${Date.now()}`,
        x: step.x + 50,
        y: step.y + 50,
        stepOrder: workflow.steps.length + 1,
        stepName: `${step.stepName} (copy)`,
        dependsOn: [],
      };
      setWorkflow(prev => ({ ...prev, steps: [...prev.steps, newStep] }));
      setSelectedStep(newStep.id);
    }
  };

  const handleUpdateStep = (updates: Partial<WorkflowStep>) => {
    if (!selectedStep) return;
    setWorkflow(prev => ({
      ...prev,
      steps: prev.steps.map(s => s.id === selectedStep ? { ...s, ...updates } : s),
    }));
  };

  const handleStartConnect = (stepId: string) => setIsConnecting(stepId);

  const handleEndConnect = (targetId: string) => {
    if (isConnecting && isConnecting !== targetId) {
      const exists = workflow.connections.some(c => c.sourceId === isConnecting && c.targetId === targetId);
      if (!exists) {
        setWorkflow(prev => ({
          ...prev,
          connections: [...prev.connections, { id: `conn-${Date.now()}`, sourceId: isConnecting, targetId }],
        }));
      }
    }
    setIsConnecting(null);
  };

  const handleDeleteConnection = (connId: string) => {
    setWorkflow(prev => ({ ...prev, connections: prev.connections.filter(c => c.id !== connId) }));
    setSelectedConnection(null);
  };

  return (
    <div className="h-[calc(100vh-6rem)] flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b bg-background">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => router.back()}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-lg font-semibold">{workflow.commonName}</span>
              <Badge variant="outline">{workflow.code}</Badge>
            </div>
            <p className="text-sm text-muted-foreground">
              {workflow.category} • {workflow.steps.length} steps • {workflow.connections.length} connections
            </p>
          </div>
          <Badge variant={workflow.isEnabled ? 'default' : 'secondary'}>
            {workflow.isEnabled ? 'Enabled' : 'Disabled'}
          </Badge>
        </div>
        <div className="flex items-center gap-2">
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild><Button variant="outline" size="icon" disabled><Undo className="h-4 w-4" /></Button></TooltipTrigger>
              <TooltipContent>Undo</TooltipContent>
            </Tooltip>
          </TooltipProvider>
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild><Button variant="outline" size="icon" disabled><Redo className="h-4 w-4" /></Button></TooltipTrigger>
              <TooltipContent>Redo</TooltipContent>
            </Tooltip>
          </TooltipProvider>
          <Separator orientation="vertical" className="h-6" />
          <Button variant="outline" onClick={() => setShowSettings(true)}>
            <Settings className="h-4 w-4 mr-2" />Settings
          </Button>
          <Button variant={isRunning ? 'destructive' : 'default'} onClick={handleRun} disabled={isRunning}>
            {isRunning ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Running...</> : <><Play className="h-4 w-4 mr-2" />Test</>}
          </Button>
          <Button><Save className="h-4 w-4 mr-2" />Save</Button>
        </div>
      </div>

      {/* Main Editor */}
      <div className="flex-1 flex overflow-hidden">
        {/* Method Palette */}
        <div className="w-72 border-r bg-muted/30 p-4">
          <div className="mb-4">
            <h3 className="font-semibold mb-2">Methods</h3>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Search methods..." className="pl-9" value={methodSearch} onChange={(e) => setMethodSearch(e.target.value)} />
            </div>
          </div>
          <ScrollArea className="h-[calc(100vh-18rem)]">
            <div className="space-y-2">
              {filteredMethods.map((method) => {
                const roleConfig = ROLE_CONFIG[method.role];
                return (
                  <button
                    key={method.id}
                    onClick={() => handleAddStep(method)}
                    className="w-full flex items-center gap-3 p-3 rounded-lg border bg-background hover:bg-muted transition-colors text-left"
                  >
                    <div className={cn('p-2 rounded-lg text-white', roleConfig.bgColor)}>{roleConfig.icon}</div>
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-sm truncate">{method.name}</div>
                      <div className="text-xs text-muted-foreground truncate">{method.description}</div>
                      <Badge variant="outline" className="mt-1 text-xs">{method.role}</Badge>
                    </div>
                  </button>
                );
              })}
            </div>
          </ScrollArea>
        </div>

        {/* Canvas */}
        <div className="flex-1 relative overflow-hidden bg-[radial-gradient(#e5e7eb_1px,transparent_1px)] dark:bg-[radial-gradient(#374151_1px,transparent_1px)] [background-size:20px_20px]">
          <CanvasControls zoom={zoom} onZoomIn={handleZoomIn} onZoomOut={handleZoomOut} onReset={handleResetZoom} />
          <ConnectionModeIndicator isConnecting={!!isConnecting} onCancel={() => setIsConnecting(null)} />

          <div
            ref={canvasRef}
            className="absolute inset-0"
            style={{ transform: `scale(${zoom})`, transformOrigin: 'center center' }}
            onClick={() => { setSelectedStep(null); setSelectedConnection(null); }}
          >
            <svg className="absolute inset-0 w-full h-full pointer-events-none" style={{ overflow: 'visible' }}>
              {workflow.connections.map((conn) => {
                const sourceStep = workflow.steps.find(s => s.id === conn.sourceId);
                const targetStep = workflow.steps.find(s => s.id === conn.targetId);
                if (!sourceStep || !targetStep) return null;
                return (
                  <ConnectionLine
                    key={conn.id}
                    sourceX={sourceStep.x + 90}
                    sourceY={sourceStep.y + 100}
                    targetX={targetStep.x + 90}
                    targetY={targetStep.y}
                    isSelected={selectedConnection === conn.id}
                    onClick={() => setSelectedConnection(conn.id)}
                  />
                );
              })}
            </svg>

            {workflow.steps.map((step) => (
              <StepNode
                key={step.id}
                step={step}
                isSelected={selectedStep === step.id}
                onSelect={() => setSelectedStep(step.id)}
                onDelete={() => handleDeleteStep(step.id)}
                onDuplicate={() => handleDuplicateStep(step.id)}
                onStartConnect={() => handleStartConnect(step.id)}
                onEndConnect={() => handleEndConnect(step.id)}
                isConnecting={isConnecting !== null}
              />
            ))}

            {workflow.steps.length === 0 && (
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <div className="text-center">
                  <Layers className="h-12 w-12 mx-auto mb-4 text-muted-foreground/50" />
                  <h3 className="text-lg font-medium text-muted-foreground">Start building your pattern</h3>
                  <p className="text-sm text-muted-foreground/70">Click methods from the palette to add steps</p>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Config Panel */}
        {selectedStepData && (
          <div className="w-80 border-l">
            <StepConfigPanel step={selectedStepData} onUpdate={handleUpdateStep} onClose={() => setSelectedStep(null)} />
          </div>
        )}

        {/* Connection Panel */}
        {selectedConnection && (
          <div className="w-80 border-l p-4">
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg">Connection</CardTitle>
                  <Button variant="ghost" size="icon" onClick={() => setSelectedConnection(null)}>
                    <XCircle className="h-4 w-4" />
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>Condition (optional)</Label>
                  <Input placeholder="e.g., confidence > 0.8" />
                </div>
                <Button variant="destructive" className="w-full" onClick={() => handleDeleteConnection(selectedConnection)}>
                  Delete Connection
                </Button>
              </CardContent>
            </Card>
          </div>
        )}
      </div>

      {/* Settings Dialog */}
      <Dialog open={showSettings} onOpenChange={setShowSettings}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Pattern Settings</DialogTitle>
            <DialogDescription>Configure workflow execution settings and defaults</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Pattern Name</Label>
              <Input value={workflow.commonName} onChange={(e) => setWorkflow(prev => ({ ...prev, commonName: e.target.value }))} />
            </div>
            <div className="space-y-2">
              <Label>Formal Name</Label>
              <Input value={workflow.formalName} onChange={(e) => setWorkflow(prev => ({ ...prev, formalName: e.target.value }))} />
            </div>
            <div className="space-y-2">
              <Label>Description</Label>
              <Textarea value={workflow.description} onChange={(e) => setWorkflow(prev => ({ ...prev, description: e.target.value }))} rows={3} />
            </div>
            <div className="space-y-2">
              <Label>Default Configuration (JSON)</Label>
              <Textarea
                value={JSON.stringify(workflow.defaultConfig, null, 2)}
                onChange={(e) => { try { setWorkflow(prev => ({ ...prev, defaultConfig: JSON.parse(e.target.value) })); } catch { /* invalid */ } }}
                rows={4}
                className="font-mono text-sm"
              />
            </div>
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>Enabled</Label>
                <p className="text-sm text-muted-foreground">Allow this pattern to be selected</p>
              </div>
              <Switch checked={workflow.isEnabled} onCheckedChange={(v) => setWorkflow(prev => ({ ...prev, isEnabled: v }))} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowSettings(false)}>Cancel</Button>
            <Button onClick={() => setShowSettings(false)}>Save Settings</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
