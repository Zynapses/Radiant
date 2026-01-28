'use client';

/**
 * MindMap View (Scout Mode - Infinite Canvas)
 * 
 * PROMPT-41 Polymorphic UI
 * 
 * Research and exploration view with visual mapping.
 * Shows ideas as sticky notes clustered by topic with conflict lines.
 */

import React, { useState, useRef, useCallback, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Map, Plus, ZoomIn, ZoomOut, Lightbulb, AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { ViewComponentProps } from '../view-router';

interface MindMapNode {
  id: string;
  content: string;
  topic: string;
  position: { x: number; y: number };
  color: string;
  source?: string;
  confidence?: number;
  isConflict?: boolean;
  connectedTo?: string[];
}

interface MindMapConnection {
  from: string;
  to: string;
  type: 'support' | 'conflict' | 'related';
}

const TOPIC_COLORS: Record<string, string> = {
  'strategy': 'bg-blue-500/20 border-blue-500/40',
  'technical': 'bg-green-500/20 border-green-500/40',
  'market': 'bg-purple-500/20 border-purple-500/40',
  'risk': 'bg-red-500/20 border-red-500/40',
  'opportunity': 'bg-yellow-500/20 border-yellow-500/40',
  'default': 'bg-zinc-500/20 border-zinc-500/40',
};

export function MindMapView({ 
  data, 
  projectId: _projectId,
  sessionId: _sessionId, 
  mode: _mode, 
  onUpdateView: _onUpdateView,
  onEscalate: _onEscalate 
}: ViewComponentProps) {
  void _projectId; void _sessionId; void _mode; void _onUpdateView; void _onEscalate;
  const [nodes, setNodes] = useState<MindMapNode[]>([]);
  const [connections, setConnections] = useState<MindMapConnection[]>([]);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [selectedNode, setSelectedNode] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const canvasRef = useRef<HTMLDivElement>(null);

  // Initialize from data payload
  useEffect(() => {
    if (data.nodes && Array.isArray(data.nodes)) {
      setNodes(data.nodes as MindMapNode[]);
    }
    if (data.connections && Array.isArray(data.connections)) {
      setConnections(data.connections as MindMapConnection[]);
    }
    
    // Demo data if empty
    if (!data.nodes || (data.nodes as MindMapNode[]).length === 0) {
      setNodes([
        { id: '1', content: 'Central Topic', topic: 'strategy', position: { x: 400, y: 300 }, color: 'strategy' },
        { id: '2', content: 'Market Analysis needed', topic: 'market', position: { x: 200, y: 200 }, color: 'market', confidence: 0.8 },
        { id: '3', content: 'Technical feasibility', topic: 'technical', position: { x: 600, y: 200 }, color: 'technical', confidence: 0.9 },
        { id: '4', content: 'Potential risk factor', topic: 'risk', position: { x: 300, y: 450 }, color: 'risk', isConflict: true },
        { id: '5', content: 'Growth opportunity', topic: 'opportunity', position: { x: 500, y: 450 }, color: 'opportunity' },
      ]);
      setConnections([
        { from: '1', to: '2', type: 'related' },
        { from: '1', to: '3', type: 'support' },
        { from: '1', to: '4', type: 'conflict' },
        { from: '1', to: '5', type: 'support' },
        { from: '4', to: '5', type: 'conflict' },
      ]);
    }
  }, [data]);

  const handleZoomIn = () => setZoom(z => Math.min(z + 0.1, 2));
  const handleZoomOut = () => setZoom(z => Math.max(z - 0.1, 0.5));

  const handleCanvasMouseDown = (e: React.MouseEvent) => {
    if (e.target === canvasRef.current) {
      setIsDragging(true);
      setDragStart({ x: e.clientX - pan.x, y: e.clientY - pan.y });
      setSelectedNode(null);
    }
  };

  const handleCanvasMouseMove = (e: React.MouseEvent) => {
    if (isDragging) {
      setPan({ x: e.clientX - dragStart.x, y: e.clientY - dragStart.y });
    }
  };

  const handleCanvasMouseUp = () => {
    setIsDragging(false);
  };

  const handleNodeDrag = useCallback((nodeId: string, newPosition: { x: number; y: number }) => {
    setNodes(prev => prev.map(node => 
      node.id === nodeId ? { ...node, position: newPosition } : node
    ));
  }, []);

  const addNode = () => {
    const newNode: MindMapNode = {
      id: crypto.randomUUID(),
      content: 'New idea...',
      topic: 'default',
      position: { x: 400 + Math.random() * 100, y: 300 + Math.random() * 100 },
      color: 'default',
    };
    setNodes(prev => [...prev, newNode]);
  };

  return (
    <div className="flex flex-col h-full bg-zinc-50 dark:bg-zinc-900">
      {/* Toolbar */}
      <div className="flex items-center justify-between px-4 py-2 border-b bg-white dark:bg-zinc-900/50">
        <div className="flex items-center gap-2">
          <Map className="w-4 h-4 text-purple-500" />
          <span className="text-sm font-medium">Scout Mode - Infinite Canvas</span>
          <Badge variant="outline" className="text-xs bg-purple-500/10 text-purple-600 dark:text-purple-400">
            {nodes.length} ideas
          </Badge>
        </div>
        
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={handleZoomOut}>
            <ZoomOut className="w-4 h-4" />
          </Button>
          <span className="text-xs text-muted-foreground w-12 text-center">
            {Math.round(zoom * 100)}%
          </span>
          <Button variant="outline" size="sm" onClick={handleZoomIn}>
            <ZoomIn className="w-4 h-4" />
          </Button>
          <div className="w-px h-4 bg-border mx-2" />
          <Button variant="outline" size="sm" onClick={addNode}>
            <Plus className="w-4 h-4 mr-1" />
            Add Idea
          </Button>
        </div>
      </div>

      {/* Canvas */}
      <div 
        ref={canvasRef}
        className="flex-1 overflow-hidden cursor-grab active:cursor-grabbing relative"
        onMouseDown={handleCanvasMouseDown}
        onMouseMove={handleCanvasMouseMove}
        onMouseUp={handleCanvasMouseUp}
        onMouseLeave={handleCanvasMouseUp}
      >
        {/* Grid Background */}
        <div 
          className="absolute inset-0 pointer-events-none"
          style={{
            backgroundImage: 'radial-gradient(circle, hsl(var(--muted-foreground) / 0.15) 1px, transparent 1px)',
            backgroundSize: `${20 * zoom}px ${20 * zoom}px`,
            backgroundPosition: `${pan.x}px ${pan.y}px`,
          }}
        />

        {/* SVG for connections */}
        <svg 
          className="absolute inset-0 pointer-events-none"
          style={{ transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})` }}
        >
          {connections.map((conn, idx) => {
            const fromNode = nodes.find(n => n.id === conn.from);
            const toNode = nodes.find(n => n.id === conn.to);
            if (!fromNode || !toNode) return null;
            
            return (
              <line
                key={idx}
                x1={fromNode.position.x + 80}
                y1={fromNode.position.y + 40}
                x2={toNode.position.x + 80}
                y2={toNode.position.y + 40}
                stroke={conn.type === 'conflict' ? '#ef4444' : conn.type === 'support' ? '#22c55e' : '#6b7280'}
                strokeWidth={2}
                strokeDasharray={conn.type === 'conflict' ? '5,5' : undefined}
                opacity={0.5}
              />
            );
          })}
        </svg>

        {/* Nodes */}
        <div 
          className="absolute inset-0"
          style={{ transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})` }}
        >
          {nodes.map((node) => (
            <Card
              key={node.id}
              className={cn(
                "absolute w-40 cursor-move transition-shadow hover:shadow-lg",
                TOPIC_COLORS[node.color] || TOPIC_COLORS.default,
                selectedNode === node.id && "ring-2 ring-primary",
                node.isConflict && "border-red-500"
              )}
              style={{ left: node.position.x, top: node.position.y }}
              onClick={() => setSelectedNode(node.id)}
              draggable
              onDragEnd={(e) => {
                const rect = canvasRef.current?.getBoundingClientRect();
                if (rect) {
                  handleNodeDrag(node.id, {
                    x: (e.clientX - rect.left - pan.x) / zoom,
                    y: (e.clientY - rect.top - pan.y) / zoom,
                  });
                }
              }}
            >
              <CardContent className="p-3">
                <div className="flex items-start gap-2 mb-2">
                  {node.isConflict ? (
                    <AlertTriangle className="w-4 h-4 text-red-500 shrink-0" />
                  ) : (
                    <Lightbulb className="w-4 h-4 text-yellow-500 shrink-0" />
                  )}
                  <span className="text-xs font-medium capitalize text-muted-foreground">
                    {node.topic}
                  </span>
                </div>
                <p className="text-sm">{node.content}</p>
                {node.confidence !== undefined && (
                  <div className="mt-2 flex items-center gap-1">
                    <div className="flex-1 h-1 bg-zinc-200 dark:bg-zinc-700 rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-green-500" 
                        style={{ width: `${node.confidence * 100}%` }} 
                      />
                    </div>
                    <span className="text-[10px] text-muted-foreground">
                      {Math.round(node.confidence * 100)}%
                    </span>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      {/* Legend */}
      <div className="flex items-center justify-center gap-4 px-4 py-2 border-t bg-white dark:bg-zinc-900/50 text-xs text-muted-foreground">
        <div className="flex items-center gap-1">
          <div className="w-4 h-0.5 bg-green-500" />
          <span>Supports</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-4 h-0.5 bg-red-500 border-dashed" style={{ borderStyle: 'dashed' }} />
          <span>Conflicts</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-4 h-0.5 bg-zinc-500" />
          <span>Related</span>
        </div>
      </div>
    </div>
  );
}
