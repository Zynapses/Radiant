/**
 * Workflow Editor Components Barrel Export
 * Re-exports UI components and workflow-specific utilities
 */

import React, { useState, useCallback } from 'react';

// Re-export UI components used by workflow editor
export { Card, CardContent } from '@/components/ui/card';
export { Input } from '@/components/ui/input';
export { Label } from '@/components/ui/label';
export { Badge } from '@/components/ui/badge';
export { Textarea } from '@/components/ui/textarea';
export { Switch } from '@/components/ui/switch';
export { ScrollArea } from '@/components/ui/scroll-area';
export { Slider } from '@/components/ui/slider';
export {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
export {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/ui/tabs';
export { Button } from '@/components/ui/button';
export { cn } from '@/lib/utils';

// Workflow-specific components
export const CanvasControls = ({ children, ...props }: React.PropsWithChildren<Record<string, unknown>>) => (
  <div className="flex items-center gap-2" {...props}>{children}</div>
);

export const ConnectionModeIndicator = ({ 
  active,
  isConnecting,
  onCancel,
}: { 
  active?: boolean;
  isConnecting?: boolean;
  onCancel?: () => void;
}) => (
  (active || isConnecting) ? (
    <div className="text-xs text-muted-foreground flex items-center gap-2">
      Connection Mode Active
      {onCancel && <button onClick={onCancel} className="text-xs underline">Cancel</button>}
    </div>
  ) : null
);

export const ConnectionLine = ({ 
  from, 
  to,
  sourceX,
  sourceY,
  targetX,
  targetY,
  isSelected,
  onClick,
}: { 
  from?: { x: number; y: number }; 
  to?: { x: number; y: number };
  sourceX?: number;
  sourceY?: number;
  targetX?: number;
  targetY?: number;
  isSelected?: boolean;
  onClick?: () => void;
}) => {
  const x1 = from?.x ?? sourceX ?? 0;
  const y1 = from?.y ?? sourceY ?? 0;
  const x2 = to?.x ?? targetX ?? 0;
  const y2 = to?.y ?? targetY ?? 0;
  
  return (
    <svg className="absolute inset-0 pointer-events-none" style={{ overflow: 'visible' }}>
      <line 
        x1={x1} 
        y1={y1} 
        x2={x2} 
        y2={y2} 
        stroke={isSelected ? 'hsl(var(--primary))' : 'currentColor'}
        strokeWidth={isSelected ? 3 : 2}
        onClick={onClick}
        style={{ cursor: onClick ? 'pointer' : 'default', pointerEvents: onClick ? 'auto' : 'none' }}
      />
    </svg>
  );
};

export const NodeActionsDropdown = ({ 
  children, 
  onEdit: _onEdit, 
  onDelete: _onDelete, 
  onDuplicate: _onDuplicate 
}: { 
  children?: React.ReactNode;
  onEdit?: () => void;
  onDelete?: () => void;
  onDuplicate?: () => void;
}) => {
  void _onEdit; void _onDelete; void _onDuplicate; // Reserved for action handlers
  return <div className="relative">{children}</div>;
};

export interface ParallelExecutionConfig {
  enabled: boolean;
  maxConcurrent: number;
  failureStrategy: 'fail-fast' | 'continue' | 'rollback';
  models?: string[];
}

export const ParallelExecutionPanel = ({
  config: _config,
  onChange: _onChange,
}: {
  config?: ParallelExecutionConfig;
  onChange?: (config: ParallelExecutionConfig) => void;
}) => {
  void _config; void _onChange; // Reserved for panel configuration
  return (
    <div className="space-y-4">
      <div className="text-sm font-medium">Parallel Execution</div>
      <div className="text-xs text-muted-foreground">
        Configure parallel execution settings
      </div>
    </div>
  );
};

export interface WorkflowNode {
  id: string;
  type: string;
  position: { x: number; y: number };
  data: Record<string, unknown>;
}

export interface WorkflowEdge {
  id: string;
  source: string;
  target: string;
}

export const useWorkflowEditor = () => {
  const [zoom, setZoom] = useState(1);
  const [isConnecting, setIsConnecting] = useState<string | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [isRunning, setIsRunning] = useState(false);
  const [nodes, setNodes] = useState<WorkflowNode[]>([]);
  const [edges, setEdges] = useState<WorkflowEdge[]>([]);
  const [selectedNode, setSelectedNode] = useState<string | null>(null);

  const handleZoomIn = useCallback(() => setZoom(z => Math.min(z + 0.1, 2)), []);
  const handleZoomOut = useCallback(() => setZoom(z => Math.max(z - 0.1, 0.5)), []);
  const handleResetZoom = useCallback(() => setZoom(1), []);
  const handleRun = useCallback(() => {
    setIsRunning(true);
    setTimeout(() => setIsRunning(false), 2000);
  }, []);

  const addNode = useCallback((node: WorkflowNode) => {
    setNodes(prev => [...prev, node]);
  }, []);

  const removeNode = useCallback((id: string) => {
    setNodes(prev => prev.filter(n => n.id !== id));
    setEdges(prev => prev.filter(e => e.source !== id && e.target !== id));
  }, []);

  const updateNode = useCallback((id: string, data: Partial<WorkflowNode>) => {
    setNodes(prev => prev.map(n => n.id === id ? { ...n, ...data } : n));
  }, []);

  const addEdge = useCallback((edge: WorkflowEdge) => {
    setEdges(prev => [...prev, edge]);
  }, []);

  const removeEdge = useCallback((id: string) => {
    setEdges(prev => prev.filter(e => e.id !== id));
  }, []);

  return {
    nodes,
    edges,
    selectedNode,
    setSelectedNode,
    addNode,
    removeNode,
    updateNode,
    addEdge,
    removeEdge,
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
  };
};
