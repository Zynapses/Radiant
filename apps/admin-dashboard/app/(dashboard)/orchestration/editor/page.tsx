'use client';

import React, { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';
import {
  Play,
  Pause,
  Square,
  Save,
  Undo,
  Redo,
  ZoomIn,
  ZoomOut,
  Maximize2,
  Grid3X3,
  Settings,
  Plus,
  Trash2,
  Copy,
  GitBranch,
  MessageSquare,
  Code,
  Database,
  Globe,
  Mail,
  Clock,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  ArrowRight,
  ArrowDown,
  Loader2,
  MoreVertical,
  GripVertical,
  Search,
  FileJson,
  Eye,
  Download,
  Upload,
  Sparkles,
  Zap,
  Box,
  CircleDot,
  Diamond,
  Hexagon,
} from 'lucide-react';

// Node types for the workflow
type NodeType = 'start' | 'end' | 'action' | 'condition' | 'loop' | 'parallel' | 'ai' | 'api' | 'database' | 'notification' | 'delay' | 'transform';

interface WorkflowNode {
  id: string;
  type: NodeType;
  label: string;
  description?: string;
  x: number;
  y: number;
  config: Record<string, unknown>;
  inputs: string[];
  outputs: string[];
}

interface WorkflowEdge {
  id: string;
  source: string;
  target: string;
  label?: string;
  condition?: string;
}

interface Workflow {
  id: string;
  name: string;
  description: string;
  version: string;
  nodes: WorkflowNode[];
  edges: WorkflowEdge[];
  variables: Record<string, unknown>;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

// Node palette items
const NODE_PALETTE: { type: NodeType; label: string; icon: React.ReactNode; color: string; description: string }[] = [
  { type: 'start', label: 'Start', icon: <CircleDot className="h-4 w-4" />, color: 'bg-green-500', description: 'Workflow entry point' },
  { type: 'end', label: 'End', icon: <Square className="h-4 w-4" />, color: 'bg-red-500', description: 'Workflow exit point' },
  { type: 'action', label: 'Action', icon: <Box className="h-4 w-4" />, color: 'bg-blue-500', description: 'Execute a custom action' },
  { type: 'condition', label: 'Condition', icon: <Diamond className="h-4 w-4" />, color: 'bg-amber-500', description: 'Branch based on condition' },
  { type: 'loop', label: 'Loop', icon: <GitBranch className="h-4 w-4" />, color: 'bg-purple-500', description: 'Iterate over items' },
  { type: 'parallel', label: 'Parallel', icon: <Hexagon className="h-4 w-4" />, color: 'bg-cyan-500', description: 'Execute in parallel' },
  { type: 'ai', label: 'AI Model', icon: <Sparkles className="h-4 w-4" />, color: 'bg-violet-500', description: 'Call AI model' },
  { type: 'api', label: 'API Call', icon: <Globe className="h-4 w-4" />, color: 'bg-indigo-500', description: 'Make HTTP request' },
  { type: 'database', label: 'Database', icon: <Database className="h-4 w-4" />, color: 'bg-emerald-500', description: 'Database operation' },
  { type: 'notification', label: 'Notify', icon: <Mail className="h-4 w-4" />, color: 'bg-pink-500', description: 'Send notification' },
  { type: 'delay', label: 'Delay', icon: <Clock className="h-4 w-4" />, color: 'bg-slate-500', description: 'Wait for duration' },
  { type: 'transform', label: 'Transform', icon: <Code className="h-4 w-4" />, color: 'bg-orange-500', description: 'Transform data' },
];

// Node component for the canvas
function WorkflowNodeComponent({
  node,
  isSelected,
  onSelect,
  onDelete,
  onDuplicate,
}: {
  node: WorkflowNode;
  isSelected: boolean;
  onSelect: () => void;
  onDelete: () => void;
  onDuplicate: () => void;
}) {
  const palette = NODE_PALETTE.find(p => p.type === node.type);

  return (
    <div
      className={cn(
        'absolute cursor-pointer transition-all duration-150',
        isSelected && 'z-10'
      )}
      style={{ left: node.x, top: node.y }}
      onClick={(e) => { e.stopPropagation(); onSelect(); }}
    >
      <div
        className={cn(
          'relative group rounded-xl border-2 bg-background shadow-sm transition-all',
          isSelected ? 'border-primary shadow-lg ring-2 ring-primary/20' : 'border-border hover:border-primary/50 hover:shadow-md'
        )}
      >
        {/* Node header */}
        <div className={cn('flex items-center gap-2 px-3 py-2 rounded-t-lg', palette?.color, 'text-white')}>
          {palette?.icon}
          <span className="font-medium text-sm">{node.label}</span>
        </div>
        
        {/* Node body */}
        <div className="px-3 py-2 min-w-[160px]">
          {node.description && (
            <p className="text-xs text-muted-foreground truncate max-w-[140px]">
              {node.description}
            </p>
          )}
          {!node.description && (
            <p className="text-xs text-muted-foreground italic">No description</p>
          )}
        </div>

        {/* Connection points */}
        {node.type !== 'start' && (
          <div className="absolute -top-2 left-1/2 -translate-x-1/2 w-4 h-4 rounded-full bg-primary border-2 border-background" />
        )}
        {node.type !== 'end' && (
          <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 w-4 h-4 rounded-full bg-primary border-2 border-background" />
        )}

        {/* Actions overlay */}
        <div className="absolute -right-2 -top-2 opacity-0 group-hover:opacity-100 transition-opacity">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button size="icon" variant="secondary" className="h-6 w-6 rounded-full shadow-md">
                <MoreVertical className="h-3 w-3" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={onDuplicate}>
                <Copy className="h-4 w-4 mr-2" />
                Duplicate
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={onDelete} className="text-destructive">
                <Trash2 className="h-4 w-4 mr-2" />
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </div>
  );
}

// Node configuration panel
function NodeConfigPanel({
  node,
  onUpdate,
  onClose,
}: {
  node: WorkflowNode;
  onUpdate: (updates: Partial<WorkflowNode>) => void;
  onClose: () => void;
}) {
  const palette = NODE_PALETTE.find(p => p.type === node.type);

  return (
    <Card className="h-full">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className={cn('p-2 rounded-lg', palette?.color, 'text-white')}>
              {palette?.icon}
            </div>
            <div>
              <CardTitle className="text-lg">{node.label}</CardTitle>
              <CardDescription>{palette?.description}</CardDescription>
            </div>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <XCircle className="h-4 w-4" />
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="general" className="w-full">
          <TabsList className="w-full">
            <TabsTrigger value="general" className="flex-1">General</TabsTrigger>
            <TabsTrigger value="config" className="flex-1">Config</TabsTrigger>
            <TabsTrigger value="advanced" className="flex-1">Advanced</TabsTrigger>
          </TabsList>

          <TabsContent value="general" className="space-y-4 mt-4">
            <div className="space-y-2">
              <Label>Label</Label>
              <Input
                value={node.label}
                onChange={(e) => onUpdate({ label: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>Description</Label>
              <Textarea
                value={node.description || ''}
                onChange={(e) => onUpdate({ description: e.target.value })}
                placeholder="Describe what this node does..."
                rows={3}
              />
            </div>
          </TabsContent>

          <TabsContent value="config" className="space-y-4 mt-4">
            {node.type === 'ai' && (
              <>
                <div className="space-y-2">
                  <Label>Model</Label>
                  <Select
                    value={String(node.config.model || 'claude-3-5-sonnet')}
                    onValueChange={(v) => onUpdate({ config: { ...node.config, model: v } })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="claude-3-5-sonnet">Claude 3.5 Sonnet</SelectItem>
                      <SelectItem value="claude-3-opus">Claude 3 Opus</SelectItem>
                      <SelectItem value="gpt-4o">GPT-4o</SelectItem>
                      <SelectItem value="gpt-4-turbo">GPT-4 Turbo</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Prompt Template</Label>
                  <Textarea
                    value={String(node.config.prompt || '')}
                    onChange={(e) => onUpdate({ config: { ...node.config, prompt: e.target.value } })}
                    placeholder="Enter your prompt template..."
                    rows={5}
                  />
                </div>
              </>
            )}

            {node.type === 'api' && (
              <>
                <div className="space-y-2">
                  <Label>Method</Label>
                  <Select
                    value={String(node.config.method || 'GET')}
                    onValueChange={(v) => onUpdate({ config: { ...node.config, method: v } })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="GET">GET</SelectItem>
                      <SelectItem value="POST">POST</SelectItem>
                      <SelectItem value="PUT">PUT</SelectItem>
                      <SelectItem value="DELETE">DELETE</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>URL</Label>
                  <Input
                    value={String(node.config.url || '')}
                    onChange={(e) => onUpdate({ config: { ...node.config, url: e.target.value } })}
                    placeholder="https://api.example.com/endpoint"
                  />
                </div>
              </>
            )}

            {node.type === 'condition' && (
              <div className="space-y-2">
                <Label>Condition Expression</Label>
                <Textarea
                  value={String(node.config.condition || '')}
                  onChange={(e) => onUpdate({ config: { ...node.config, condition: e.target.value } })}
                  placeholder="e.g., {{input.value}} > 10"
                  rows={3}
                />
              </div>
            )}

            {node.type === 'delay' && (
              <div className="space-y-2">
                <Label>Duration (seconds)</Label>
                <Input
                  type="number"
                  value={Number(node.config.duration || 0)}
                  onChange={(e) => onUpdate({ config: { ...node.config, duration: Number(e.target.value) } })}
                  min={0}
                />
              </div>
            )}

            {node.type === 'notification' && (
              <>
                <div className="space-y-2">
                  <Label>Channel</Label>
                  <Select
                    value={String(node.config.channel || 'email')}
                    onValueChange={(v) => onUpdate({ config: { ...node.config, channel: v } })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="email">Email</SelectItem>
                      <SelectItem value="slack">Slack</SelectItem>
                      <SelectItem value="webhook">Webhook</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Message Template</Label>
                  <Textarea
                    value={String(node.config.message || '')}
                    onChange={(e) => onUpdate({ config: { ...node.config, message: e.target.value } })}
                    placeholder="Enter notification message..."
                    rows={3}
                  />
                </div>
              </>
            )}

            {!['ai', 'api', 'condition', 'delay', 'notification'].includes(node.type) && (
              <div className="text-center py-8 text-muted-foreground">
                <Settings className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p>No additional configuration for this node type</p>
              </div>
            )}
          </TabsContent>

          <TabsContent value="advanced" className="space-y-4 mt-4">
            <div className="space-y-2">
              <Label>Retry on failure</Label>
              <div className="flex items-center gap-2">
                <Switch
                  checked={Boolean(node.config.retry)}
                  onCheckedChange={(v) => onUpdate({ config: { ...node.config, retry: v } })}
                />
                <span className="text-sm text-muted-foreground">
                  {node.config.retry ? 'Enabled' : 'Disabled'}
                </span>
              </div>
            </div>
            {Boolean(node.config.retry) && (
              <div className="space-y-2">
                <Label>Max retries</Label>
                <Input
                  type="number"
                  value={Number(node.config.maxRetries || 3)}
                  onChange={(e) => onUpdate({ config: { ...node.config, maxRetries: Number(e.target.value) } })}
                  min={1}
                  max={10}
                />
              </div>
            )}
            <div className="space-y-2">
              <Label>Timeout (seconds)</Label>
              <Input
                type="number"
                value={Number(node.config.timeout || 30)}
                onChange={(e) => onUpdate({ config: { ...node.config, timeout: Number(e.target.value) } })}
                min={1}
              />
            </div>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}

// Main Workflow Editor Component
export default function WorkflowEditorPage() {
  const searchParams = useSearchParams();
  const workflowId = searchParams.get('id');
  const queryClient = useQueryClient();
  
  const [workflow, setWorkflow] = useState<Workflow>({
    id: 'new',
    name: 'Untitled Workflow',
    description: '',
    version: '1.0.0',
    nodes: [
      { id: 'start-1', type: 'start', label: 'Start', x: 100, y: 100, config: {}, inputs: [], outputs: ['edge-1'] },
    ],
    edges: [],
    variables: {},
    isActive: false,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  });

  // Load workflow if editing existing
  const { isLoading: isLoadingWorkflow } = useQuery({
    queryKey: ['workflow', workflowId],
    queryFn: async () => {
      if (!workflowId || workflowId === 'new') return null;
      const res = await fetch(`/api/admin/orchestration/workflows/${workflowId}`);
      if (!res.ok) throw new Error('Failed to load workflow');
      return res.json();
    },
    enabled: !!workflowId && workflowId !== 'new',
  });

  // Save workflow mutation
  const saveMutation = useMutation({
    mutationFn: async (data: Workflow) => {
      const isNew = data.id === 'new';
      const url = isNew 
        ? '/api/admin/orchestration/workflows'
        : `/api/admin/orchestration/workflows/${data.id}`;
      const res = await fetch(url, {
        method: isNew ? 'POST' : 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error('Failed to save workflow');
      return res.json();
    },
    onSuccess: (data) => {
      setWorkflow(prev => ({ ...prev, id: data.id }));
      queryClient.invalidateQueries({ queryKey: ['orchestration-workflows'] });
      toast.success('Workflow saved successfully');
    },
    onError: () => {
      toast.error('Failed to save workflow');
    },
  });

  // Run workflow mutation
  const runMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/admin/orchestration/workflows/${workflow.id}/execute`, {
        method: 'POST',
      });
      if (!res.ok) throw new Error('Failed to run workflow');
      return res.json();
    },
    onSuccess: () => {
      toast.success('Workflow execution started');
    },
    onError: () => {
      toast.error('Failed to run workflow');
    },
  });

  const handleSave = useCallback(() => {
    saveMutation.mutate(workflow);
  }, [workflow, saveMutation]);

  const handleRun = useCallback(() => {
    if (workflow.id === 'new') {
      toast.error('Please save the workflow first');
      return;
    }
    runMutation.mutate();
  }, [workflow.id, runMutation]);

  const [selectedNode, setSelectedNode] = useState<string | null>(null);
  const [zoom, setZoom] = useState(1);
  const [isPanning, setIsPanning] = useState(false);
  const [panOffset, setPanOffset] = useState({ x: 0, y: 0 });
  const [showSettings, setShowSettings] = useState(false);
  const [isRunning, setIsRunning] = useState(false);
  const canvasRef = useRef<HTMLDivElement>(null);

  const selectedNodeData = useMemo(() => {
    return workflow.nodes.find(n => n.id === selectedNode);
  }, [workflow.nodes, selectedNode]);

  const handleAddNode = (type: NodeType) => {
    // Calculate position based on existing nodes to avoid overlap
    const existingNodes = workflow.nodes.length;
    const gridCol = existingNodes % 3;
    const gridRow = Math.floor(existingNodes / 3);
    const newNode: WorkflowNode = {
      id: `${type}-${Date.now()}`,
      type,
      label: NODE_PALETTE.find(p => p.type === type)?.label || type,
      x: 200 + gridCol * 220,
      y: 150 + gridRow * 150,
      config: {},
      inputs: [],
      outputs: [],
    };
    setWorkflow(prev => ({
      ...prev,
      nodes: [...prev.nodes, newNode],
    }));
    setSelectedNode(newNode.id);
  };

  const handleDeleteNode = (nodeId: string) => {
    setWorkflow(prev => ({
      ...prev,
      nodes: prev.nodes.filter(n => n.id !== nodeId),
      edges: prev.edges.filter(e => e.source !== nodeId && e.target !== nodeId),
    }));
    if (selectedNode === nodeId) {
      setSelectedNode(null);
    }
  };

  const handleDuplicateNode = (nodeId: string) => {
    const node = workflow.nodes.find(n => n.id === nodeId);
    if (node) {
      const newNode: WorkflowNode = {
        ...node,
        id: `${node.type}-${Date.now()}`,
        x: node.x + 50,
        y: node.y + 50,
        inputs: [],
        outputs: [],
      };
      setWorkflow(prev => ({
        ...prev,
        nodes: [...prev.nodes, newNode],
      }));
      setSelectedNode(newNode.id);
    }
  };

  const handleUpdateNode = (updates: Partial<WorkflowNode>) => {
    if (!selectedNode) return;
    setWorkflow(prev => ({
      ...prev,
      nodes: prev.nodes.map(n =>
        n.id === selectedNode ? { ...n, ...updates } : n
      ),
    }));
  };

  return (
    <div className="h-[calc(100vh-6rem)] flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b bg-background">
        <div className="flex items-center gap-4">
          <div>
            <Input
              value={workflow.name}
              onChange={(e) => setWorkflow(prev => ({ ...prev, name: e.target.value }))}
              className="text-lg font-semibold border-0 p-0 h-auto focus-visible:ring-0"
            />
            <p className="text-sm text-muted-foreground">
              Version {workflow.version} • {workflow.nodes.length} nodes
            </p>
          </div>
          <Badge variant={workflow.isActive ? 'default' : 'secondary'}>
            {workflow.isActive ? 'Active' : 'Draft'}
          </Badge>
        </div>
        <div className="flex items-center gap-2">
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="outline" size="icon" disabled>
                  <Undo className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Undo</TooltipContent>
            </Tooltip>
          </TooltipProvider>
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="outline" size="icon" disabled>
                  <Redo className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Redo</TooltipContent>
            </Tooltip>
          </TooltipProvider>
          <Separator orientation="vertical" className="h-6" />
          <Button variant="outline" onClick={() => setShowSettings(true)}>
            <Settings className="h-4 w-4 mr-2" />
            Settings
          </Button>
          <Button variant="outline">
            <Eye className="h-4 w-4 mr-2" />
            Preview
          </Button>
          <Button
            variant={isRunning ? 'destructive' : 'default'}
            onClick={handleRun}
            disabled={isRunning}
          >
            {isRunning ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Running...
              </>
            ) : (
              <>
                <Play className="h-4 w-4 mr-2" />
                Test Run
              </>
            )}
          </Button>
          <Button onClick={handleSave} disabled={saveMutation.isPending}>
            {saveMutation.isPending ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <Save className="h-4 w-4 mr-2" />
                Save
              </>
            )}
          </Button>
        </div>
      </div>

      {/* Main Editor Area */}
      <div className="flex-1 flex overflow-hidden">
        {/* Node Palette */}
        <div className="w-64 border-r bg-muted/30 p-4">
          <div className="mb-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Search nodes..." className="pl-9" />
            </div>
          </div>
          <ScrollArea className="h-[calc(100vh-16rem)]">
            <div className="space-y-2">
              {NODE_PALETTE.map((item) => (
                <button
                  key={item.type}
                  onClick={() => handleAddNode(item.type)}
                  className="w-full flex items-center gap-3 p-3 rounded-lg border bg-background hover:bg-muted transition-colors text-left"
                >
                  <div className={cn('p-2 rounded-lg', item.color, 'text-white')}>
                    {item.icon}
                  </div>
                  <div>
                    <div className="font-medium text-sm">{item.label}</div>
                    <div className="text-xs text-muted-foreground">{item.description}</div>
                  </div>
                </button>
              ))}
            </div>
          </ScrollArea>
        </div>

        {/* Canvas */}
        <div className="flex-1 relative overflow-hidden bg-[radial-gradient(#e5e7eb_1px,transparent_1px)] dark:bg-[radial-gradient(#374151_1px,transparent_1px)] [background-size:20px_20px]">
          {/* Zoom controls */}
          <div className="absolute top-4 right-4 flex items-center gap-2 z-20">
            <Button variant="outline" size="icon" onClick={() => setZoom(z => Math.max(0.5, z - 0.1))}>
              <ZoomOut className="h-4 w-4" />
            </Button>
            <span className="text-sm font-mono w-12 text-center">{Math.round(zoom * 100)}%</span>
            <Button variant="outline" size="icon" onClick={() => setZoom(z => Math.min(2, z + 0.1))}>
              <ZoomIn className="h-4 w-4" />
            </Button>
            <Button variant="outline" size="icon" onClick={() => { setZoom(1); setPanOffset({ x: 0, y: 0 }); }}>
              <Maximize2 className="h-4 w-4" />
            </Button>
          </div>

          {/* Canvas content */}
          <div
            ref={canvasRef}
            className="absolute inset-0"
            style={{
              transform: `scale(${zoom}) translate(${panOffset.x}px, ${panOffset.y}px)`,
              transformOrigin: 'center center',
            }}
            onClick={() => setSelectedNode(null)}
          >
            {/* Nodes */}
            {workflow.nodes.map((node) => (
              <WorkflowNodeComponent
                key={node.id}
                node={node}
                isSelected={selectedNode === node.id}
                onSelect={() => setSelectedNode(node.id)}
                onDelete={() => handleDeleteNode(node.id)}
                onDuplicate={() => handleDuplicateNode(node.id)}
              />
            ))}

            {/* Empty state */}
            {workflow.nodes.length <= 1 && (
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <div className="text-center">
                  <Zap className="h-12 w-12 mx-auto mb-4 text-muted-foreground/50" />
                  <h3 className="text-lg font-medium text-muted-foreground">Start building your workflow</h3>
                  <p className="text-sm text-muted-foreground/70">Drag nodes from the palette or click to add</p>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Config Panel */}
        {selectedNodeData && (
          <div className="w-80 border-l">
            <NodeConfigPanel
              node={selectedNodeData}
              onUpdate={handleUpdateNode}
              onClose={() => setSelectedNode(null)}
            />
          </div>
        )}
      </div>

      {/* Settings Dialog */}
      <Dialog open={showSettings} onOpenChange={setShowSettings}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Workflow Settings</DialogTitle>
            <DialogDescription>
              Configure workflow execution settings and metadata
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Workflow Name</Label>
              <Input
                value={workflow.name}
                onChange={(e) => setWorkflow(prev => ({ ...prev, name: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label>Description</Label>
              <Textarea
                value={workflow.description}
                onChange={(e) => setWorkflow(prev => ({ ...prev, description: e.target.value }))}
                rows={3}
              />
            </div>
            <div className="space-y-2">
              <Label>Version</Label>
              <Input
                value={workflow.version}
                onChange={(e) => setWorkflow(prev => ({ ...prev, version: e.target.value }))}
              />
            </div>
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>Active</Label>
                <p className="text-sm text-muted-foreground">Enable this workflow for execution</p>
              </div>
              <Switch
                checked={workflow.isActive}
                onCheckedChange={(v) => setWorkflow(prev => ({ ...prev, isActive: v }))}
              />
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
