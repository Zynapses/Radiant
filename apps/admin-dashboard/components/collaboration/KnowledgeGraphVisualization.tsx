'use client';

import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Network,
  Plus,
  Minus,
  Maximize2,
  RotateCcw,
  Download,
  Filter,
  Search,
  Eye,
  EyeOff,
  Sparkles,
  Link2,
  Circle,
  Square,
  Triangle,
  Hexagon,
  ChevronRight,
  X,
  ZoomIn,
  ZoomOut,
  Move,
  MousePointer,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';

interface KnowledgeNode {
  id: string;
  label: string;
  type: 'concept' | 'question' | 'decision' | 'insight' | 'action' | 'person';
  description?: string;
  x?: number;
  y?: number;
  weight?: number;
  createdAt: Date;
  createdBy?: string;
  relatedMessages?: string[];
}

interface KnowledgeEdge {
  id: string;
  sourceId: string;
  targetId: string;
  label?: string;
  type: 'relates_to' | 'leads_to' | 'contradicts' | 'supports' | 'defines' | 'questions';
  weight?: number;
}

interface KnowledgeGraph {
  id: string;
  sessionId: string;
  nodes: KnowledgeNode[];
  edges: KnowledgeEdge[];
  lastUpdated: Date;
}

interface KnowledgeGraphVisualizationProps {
  graph: KnowledgeGraph;
  onAddNode: (node: Partial<KnowledgeNode>) => void;
  onAddEdge: (edge: Partial<KnowledgeEdge>) => void;
  onDeleteNode: (nodeId: string) => void;
  onDeleteEdge: (edgeId: string) => void;
  onSelectNode: (node: KnowledgeNode | null) => void;
}

const nodeTypeConfig = {
  concept: { icon: Circle, color: '#3b82f6', label: 'Concept' },
  question: { icon: Circle, color: '#f59e0b', label: 'Question' },
  decision: { icon: Square, color: '#10b981', label: 'Decision' },
  insight: { icon: Sparkles, color: '#8b5cf6', label: 'Insight' },
  action: { icon: Triangle, color: '#ef4444', label: 'Action' },
  person: { icon: Circle, color: '#ec4899', label: 'Person' },
};

const edgeTypeConfig = {
  relates_to: { color: '#94a3b8', label: 'Relates to', dashed: false },
  leads_to: { color: '#22c55e', label: 'Leads to', dashed: false },
  contradicts: { color: '#ef4444', label: 'Contradicts', dashed: true },
  supports: { color: '#3b82f6', label: 'Supports', dashed: false },
  defines: { color: '#8b5cf6', label: 'Defines', dashed: false },
  questions: { color: '#f59e0b', label: 'Questions', dashed: true },
};

export function KnowledgeGraphVisualization({
  graph,
  onAddNode,
  onAddEdge,
  onDeleteNode,
  onDeleteEdge,
  onSelectNode,
}: KnowledgeGraphVisualizationProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  
  // View state
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [tool, setTool] = useState<'select' | 'pan' | 'add_node' | 'add_edge'>('select');
  
  // Selection state
  const [selectedNode, setSelectedNode] = useState<KnowledgeNode | null>(null);
  const [hoveredNode, setHoveredNode] = useState<KnowledgeNode | null>(null);
  const [edgeSource, setEdgeSource] = useState<string | null>(null);
  
  // Filter state
  const [searchQuery, setSearchQuery] = useState('');
  const [visibleTypes, setVisibleTypes] = useState<Set<string>>(new Set(Object.keys(nodeTypeConfig)));
  const [showLabels, setShowLabels] = useState(true);
  const [showEdgeLabels, setShowEdgeLabels] = useState(false);

  // Calculate node positions using force-directed layout
  const positionedNodes = useMemo(() => {
    const nodes = [...graph.nodes];
    const width = 800;
    const height = 600;
    const centerX = width / 2;
    const centerY = height / 2;

    // Simple circular layout if no positions
    nodes.forEach((node, i) => {
      if (node.x === undefined || node.y === undefined) {
        const angle = (2 * Math.PI * i) / nodes.length;
        const radius = Math.min(width, height) * 0.35;
        node.x = centerX + radius * Math.cos(angle);
        node.y = centerY + radius * Math.sin(angle);
      }
    });

    return nodes;
  }, [graph.nodes]);

  // Filter nodes based on search and type
  const filteredNodes = useMemo(() => {
    return positionedNodes.filter((node) => {
      if (!visibleTypes.has(node.type)) return false;
      if (searchQuery && !node.label.toLowerCase().includes(searchQuery.toLowerCase())) return false;
      return true;
    });
  }, [positionedNodes, visibleTypes, searchQuery]);

  // Filter edges based on visible nodes
  const filteredEdges = useMemo(() => {
    const visibleNodeIds = new Set(filteredNodes.map((n) => n.id));
    return graph.edges.filter(
      (edge) => visibleNodeIds.has(edge.sourceId) && visibleNodeIds.has(edge.targetId)
    );
  }, [graph.edges, filteredNodes]);

  // Draw the graph
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    ctx.scale(dpr, dpr);

    // Clear
    ctx.clearRect(0, 0, rect.width, rect.height);

    // Apply transforms
    ctx.save();
    ctx.translate(pan.x + rect.width / 2, pan.y + rect.height / 2);
    ctx.scale(zoom, zoom);
    ctx.translate(-rect.width / 2, -rect.height / 2);

    // Draw edges
    filteredEdges.forEach((edge) => {
      const source = filteredNodes.find((n) => n.id === edge.sourceId);
      const target = filteredNodes.find((n) => n.id === edge.targetId);
      if (!source || !target) return;

      const config = edgeTypeConfig[edge.type];
      ctx.beginPath();
      ctx.strokeStyle = config.color;
      ctx.lineWidth = (edge.weight || 1) * 1.5;
      if (config.dashed) {
        ctx.setLineDash([5, 5]);
      } else {
        ctx.setLineDash([]);
      }

      ctx.moveTo(source.x!, source.y!);
      ctx.lineTo(target.x!, target.y!);
      ctx.stroke();

      // Draw arrow
      const angle = Math.atan2(target.y! - source.y!, target.x! - source.x!);
      const arrowSize = 8;
      const endX = target.x! - 20 * Math.cos(angle);
      const endY = target.y! - 20 * Math.sin(angle);

      ctx.beginPath();
      ctx.moveTo(endX, endY);
      ctx.lineTo(
        endX - arrowSize * Math.cos(angle - Math.PI / 6),
        endY - arrowSize * Math.sin(angle - Math.PI / 6)
      );
      ctx.lineTo(
        endX - arrowSize * Math.cos(angle + Math.PI / 6),
        endY - arrowSize * Math.sin(angle + Math.PI / 6)
      );
      ctx.closePath();
      ctx.fillStyle = config.color;
      ctx.fill();

      // Draw edge label
      if (showEdgeLabels && edge.label) {
        const midX = (source.x! + target.x!) / 2;
        const midY = (source.y! + target.y!) / 2;
        ctx.font = '10px Inter, sans-serif';
        ctx.fillStyle = '#64748b';
        ctx.textAlign = 'center';
        ctx.fillText(edge.label, midX, midY - 5);
      }
    });

    // Draw nodes
    filteredNodes.forEach((node) => {
      const config = nodeTypeConfig[node.type];
      const isSelected = selectedNode?.id === node.id;
      const isHovered = hoveredNode?.id === node.id;
      const radius = (node.weight || 1) * 15 + 5;

      // Node circle
      ctx.beginPath();
      ctx.arc(node.x!, node.y!, radius, 0, 2 * Math.PI);
      ctx.fillStyle = isSelected || isHovered ? config.color : `${config.color}cc`;
      ctx.fill();

      // Border
      if (isSelected) {
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 3;
        ctx.stroke();
        ctx.strokeStyle = config.color;
        ctx.lineWidth = 1;
        ctx.stroke();
      }

      // Label
      if (showLabels) {
        ctx.font = `${isSelected ? 'bold ' : ''}12px Inter, sans-serif`;
        ctx.fillStyle = '#1e293b';
        ctx.textAlign = 'center';
        ctx.fillText(node.label, node.x!, node.y! + radius + 14);
      }
    });

    ctx.restore();
  }, [filteredNodes, filteredEdges, zoom, pan, selectedNode, hoveredNode, showLabels, showEdgeLabels]);

  // Mouse handlers
  const getCanvasCoords = useCallback((e: React.MouseEvent) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    
    const rect = canvas.getBoundingClientRect();
    const x = (e.clientX - rect.left - pan.x - rect.width / 2) / zoom + rect.width / 2;
    const y = (e.clientY - rect.top - pan.y - rect.height / 2) / zoom + rect.height / 2;
    return { x, y };
  }, [zoom, pan]);

  const findNodeAt = useCallback((x: number, y: number) => {
    for (const node of filteredNodes) {
      const radius = (node.weight || 1) * 15 + 5;
      const dx = x - node.x!;
      const dy = y - node.y!;
      if (dx * dx + dy * dy <= radius * radius) {
        return node;
      }
    }
    return null;
  }, [filteredNodes]);

  const handleMouseDown = (e: React.MouseEvent) => {
    const coords = getCanvasCoords(e);
    const node = findNodeAt(coords.x, coords.y);

    if (tool === 'pan' || (tool === 'select' && !node)) {
      setIsDragging(true);
      setDragStart({ x: e.clientX - pan.x, y: e.clientY - pan.y });
    } else if (tool === 'select' && node) {
      setSelectedNode(node);
      onSelectNode(node);
    } else if (tool === 'add_edge' && node) {
      if (!edgeSource) {
        setEdgeSource(node.id);
      } else if (edgeSource !== node.id) {
        onAddEdge({ sourceId: edgeSource, targetId: node.id, type: 'relates_to' });
        setEdgeSource(null);
      }
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (isDragging) {
      setPan({
        x: e.clientX - dragStart.x,
        y: e.clientY - dragStart.y,
      });
    } else {
      const coords = getCanvasCoords(e);
      const node = findNodeAt(coords.x, coords.y);
      setHoveredNode(node);
    }
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  const handleDoubleClick = (e: React.MouseEvent) => {
    if (tool === 'add_node') {
      const coords = getCanvasCoords(e);
      onAddNode({
        label: 'New Node',
        type: 'concept',
        x: coords.x,
        y: coords.y,
      });
    }
  };

  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? 0.9 : 1.1;
    setZoom((z) => Math.max(0.1, Math.min(3, z * delta)));
  };

  const resetView = () => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
  };

  const toggleType = (type: string) => {
    setVisibleTypes((prev) => {
      const next = new Set(prev);
      if (next.has(type)) {
        next.delete(type);
      } else {
        next.add(type);
      }
      return next;
    });
  };

  return (
    <div className="h-full flex flex-col">
      {/* Toolbar */}
      <div className="p-3 border-b flex items-center justify-between bg-background">
        <div className="flex items-center gap-2">
          <TooltipProvider>
            {/* Tool Selection */}
            <div className="flex items-center border rounded-lg p-1 gap-0.5">
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant={tool === 'select' ? 'secondary' : 'ghost'}
                    size="icon"
                    className="h-8 w-8"
                    onClick={() => setTool('select')}
                  >
                    <MousePointer className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Select (V)</TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant={tool === 'pan' ? 'secondary' : 'ghost'}
                    size="icon"
                    className="h-8 w-8"
                    onClick={() => setTool('pan')}
                  >
                    <Move className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Pan (H)</TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant={tool === 'add_node' ? 'secondary' : 'ghost'}
                    size="icon"
                    className="h-8 w-8"
                    onClick={() => setTool('add_node')}
                  >
                    <Plus className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Add Node (N)</TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant={tool === 'add_edge' ? 'secondary' : 'ghost'}
                    size="icon"
                    className="h-8 w-8"
                    onClick={() => setTool('add_edge')}
                  >
                    <Link2 className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Add Edge (E)</TooltipContent>
              </Tooltip>
            </div>

            {/* Zoom Controls */}
            <div className="flex items-center border rounded-lg p-1 gap-0.5">
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setZoom((z) => Math.min(3, z * 1.2))}>
                    <ZoomIn className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Zoom In</TooltipContent>
              </Tooltip>
              <span className="text-xs w-12 text-center">{Math.round(zoom * 100)}%</span>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setZoom((z) => Math.max(0.1, z / 1.2))}>
                    <ZoomOut className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Zoom Out</TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-8 w-8" onClick={resetView}>
                    <RotateCcw className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Reset View</TooltipContent>
              </Tooltip>
            </div>
          </TooltipProvider>
        </div>

        <div className="flex items-center gap-2">
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search nodes..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-8 w-48 h-8"
            />
          </div>

          {/* Filters */}
          <Sheet>
            <SheetTrigger asChild>
              <Button variant="outline" size="sm" className="gap-1">
                <Filter className="h-4 w-4" />
                Filters
              </Button>
            </SheetTrigger>
            <SheetContent>
              <SheetHeader>
                <SheetTitle>Graph Filters</SheetTitle>
              </SheetHeader>
              <div className="mt-6 space-y-6">
                {/* Node Types */}
                <div>
                  <Label className="text-sm font-medium mb-3 block">Node Types</Label>
                  <div className="space-y-2">
                    {Object.entries(nodeTypeConfig).map(([type, config]) => (
                      <div key={type} className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <div
                            className="w-3 h-3 rounded-full"
                            style={{ backgroundColor: config.color }}
                          />
                          <span className="text-sm">{config.label}</span>
                        </div>
                        <Switch
                          checked={visibleTypes.has(type)}
                          onCheckedChange={() => toggleType(type)}
                        />
                      </div>
                    ))}
                  </div>
                </div>

                {/* Display Options */}
                <div>
                  <Label className="text-sm font-medium mb-3 block">Display</Label>
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-sm">Show node labels</span>
                      <Switch checked={showLabels} onCheckedChange={setShowLabels} />
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm">Show edge labels</span>
                      <Switch checked={showEdgeLabels} onCheckedChange={setShowEdgeLabels} />
                    </div>
                  </div>
                </div>
              </div>
            </SheetContent>
          </Sheet>

          <Button variant="outline" size="icon" className="h-8 w-8">
            <Download className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Edge creation hint */}
      <AnimatePresence>
        {edgeSource && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="px-4 py-2 bg-primary/10 border-b text-sm text-primary"
          >
            Click another node to create an edge, or press Escape to cancel
          </motion.div>
        )}
      </AnimatePresence>

      {/* Canvas */}
      <div ref={containerRef} className="flex-1 relative bg-slate-50 dark:bg-slate-900/50">
        <canvas
          ref={canvasRef}
          className="absolute inset-0 w-full h-full cursor-crosshair"
          style={{ cursor: tool === 'pan' ? 'grab' : tool === 'add_node' ? 'crosshair' : 'default' }}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
          onDoubleClick={handleDoubleClick}
          onWheel={handleWheel}
        />

        {/* Legend */}
        <div className="absolute bottom-4 left-4 bg-background/90 backdrop-blur border rounded-lg p-3 text-xs">
          <p className="font-medium mb-2">Legend</p>
          <div className="grid grid-cols-2 gap-x-4 gap-y-1">
            {Object.entries(nodeTypeConfig).map(([type, config]) => (
              <div key={type} className="flex items-center gap-2">
                <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: config.color }} />
                <span>{config.label}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Stats */}
        <div className="absolute top-4 right-4 bg-background/90 backdrop-blur border rounded-lg px-3 py-2 text-xs">
          <span className="text-muted-foreground">
            {filteredNodes.length} nodes • {filteredEdges.length} edges
          </span>
        </div>
      </div>

      {/* Node Details Panel */}
      <AnimatePresence>
        {selectedNode && (
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 20 }}
            className="absolute right-0 top-14 bottom-0 w-80 bg-background border-l shadow-lg"
          >
            <div className="p-4">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold">Node Details</h3>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => {
                    setSelectedNode(null);
                    onSelectNode(null);
                  }}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>

              <div className="space-y-4">
                <div>
                  <Label className="text-xs text-muted-foreground">Label</Label>
                  <p className="font-medium">{selectedNode.label}</p>
                </div>

                <div>
                  <Label className="text-xs text-muted-foreground">Type</Label>
                  <Badge
                    style={{ backgroundColor: nodeTypeConfig[selectedNode.type].color }}
                    className="text-white"
                  >
                    {nodeTypeConfig[selectedNode.type].label}
                  </Badge>
                </div>

                {selectedNode.description && (
                  <div>
                    <Label className="text-xs text-muted-foreground">Description</Label>
                    <p className="text-sm">{selectedNode.description}</p>
                  </div>
                )}

                <div>
                  <Label className="text-xs text-muted-foreground">Connections</Label>
                  <p className="text-sm">
                    {graph.edges.filter(
                      (e) => e.sourceId === selectedNode.id || e.targetId === selectedNode.id
                    ).length}{' '}
                    edges
                  </p>
                </div>

                <div className="pt-4 border-t">
                  <Button
                    variant="destructive"
                    size="sm"
                    className="w-full"
                    onClick={() => {
                      onDeleteNode(selectedNode.id);
                      setSelectedNode(null);
                      onSelectNode(null);
                    }}
                  >
                    Delete Node
                  </Button>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
