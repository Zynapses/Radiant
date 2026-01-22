'use client';

/**
 * RADIANT v5.44.0 - Memory Palace UI
 * Navigable 3D knowledge topology with freshness fog and discovery hotspots
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { 
  Brain, Sparkles, Search, ZoomIn, ZoomOut, RotateCcw,
  Clock, Link2, Eye, Layers, Filter, Plus, RefreshCw
} from 'lucide-react';

// =============================================================================
// TYPES
// =============================================================================

interface KnowledgeNode {
  id: string;
  label: string;
  domain: string;
  content: string;
  confidence: number;
  freshnessScore: number;
  lastAccessed: string;
  connectionCount: number;
  position: { x: number; y: number; z: number };
  size: number;
}

interface MemoryConnection {
  id: string;
  sourceId: string;
  targetId: string;
  strength: number;
  type: 'semantic' | 'temporal' | 'causal' | 'reference';
}

interface MemoryRoom {
  id: string;
  name: string;
  domain: string;
  nodeCount: number;
  avgFreshness: number;
  color: string;
}

interface DiscoveryHotspot {
  id: string;
  position: { x: number; y: number };
  intensity: number;
  potentialInsights: string[];
}

// =============================================================================
// STYLES
// =============================================================================

const palaceStyles = `
  @keyframes node-pulse {
    0%, 100% { transform: scale(1); }
    50% { transform: scale(1.1); }
  }
  @keyframes connection-flow {
    0% { stroke-dashoffset: 20; }
    100% { stroke-dashoffset: 0; }
  }
  @keyframes hotspot-beacon {
    0%, 100% { opacity: 0.3; transform: scale(1); }
    50% { opacity: 0.8; transform: scale(1.5); }
  }
  @keyframes fog-drift {
    0%, 100% { opacity: 0.1; }
    50% { opacity: 0.3; }
  }
`;

// =============================================================================
// KNOWLEDGE NODE COMPONENT
// =============================================================================

function KnowledgeNodeView({ 
  node, 
  isSelected,
  onSelect 
}: { 
  node: KnowledgeNode;
  isSelected: boolean;
  onSelect: () => void;
}) {
  const freshnessColor = node.freshnessScore > 0.7 
    ? '#22c55e' 
    : node.freshnessScore > 0.4 
      ? '#f59e0b' 
      : '#6b7280';

  const opacity = 0.4 + (node.freshnessScore * 0.6);

  return (
    <g 
      transform={`translate(${node.position.x}, ${node.position.y})`}
      onClick={onSelect}
      style={{ cursor: 'pointer' }}
    >
      {/* Freshness fog around stale nodes */}
      {node.freshnessScore < 0.5 && (
        <circle
          r={node.size * 2}
          fill={`rgba(107, 114, 128, ${0.3 - node.freshnessScore * 0.3})`}
          style={{ animation: 'fog-drift 4s ease-in-out infinite' }}
        />
      )}
      
      {/* Main node */}
      <circle
        r={node.size}
        fill={freshnessColor}
        opacity={opacity}
        stroke={isSelected ? '#3b82f6' : 'transparent'}
        strokeWidth={isSelected ? 3 : 0}
        style={{
          animation: node.confidence > 0.8 ? 'node-pulse 3s ease-in-out infinite' : 'none',
          filter: `drop-shadow(0 0 ${node.connectionCount}px ${freshnessColor})`,
        }}
      />
      
      {/* Label */}
      <text
        y={node.size + 12}
        textAnchor="middle"
        fill="white"
        fontSize={10}
        fontWeight={node.confidence > 0.7 ? 500 : 400}
        opacity={opacity}
      >
        {node.label.length > 15 ? node.label.substring(0, 15) + '...' : node.label}
      </text>
    </g>
  );
}

// =============================================================================
// CONNECTION COMPONENT
// =============================================================================

function ConnectionLine({ 
  connection, 
  sourceNode, 
  targetNode 
}: { 
  connection: MemoryConnection;
  sourceNode: KnowledgeNode;
  targetNode: KnowledgeNode;
}) {
  const typeColors: Record<string, string> = {
    semantic: '#3b82f6',
    temporal: '#8b5cf6',
    causal: '#f59e0b',
    reference: '#6b7280',
  };

  return (
    <line
      x1={sourceNode.position.x}
      y1={sourceNode.position.y}
      x2={targetNode.position.x}
      y2={targetNode.position.y}
      stroke={typeColors[connection.type]}
      strokeWidth={connection.strength * 2}
      strokeOpacity={0.3 + connection.strength * 0.4}
      strokeDasharray={connection.type === 'temporal' ? '5,5' : 'none'}
      style={{ animation: 'connection-flow 2s linear infinite' }}
    />
  );
}

// =============================================================================
// DISCOVERY HOTSPOT COMPONENT
// =============================================================================

function HotspotBeacon({ hotspot }: { hotspot: DiscoveryHotspot }) {
  return (
    <g transform={`translate(${hotspot.position.x}, ${hotspot.position.y})`}>
      <circle
        r={15 + hotspot.intensity * 10}
        fill="none"
        stroke="#f59e0b"
        strokeWidth={2}
        style={{ animation: 'hotspot-beacon 2s ease-in-out infinite' }}
      />
      <circle
        r={5}
        fill="#f59e0b"
      />
    </g>
  );
}

// =============================================================================
// ROOM SELECTOR
// =============================================================================

function RoomSelector({ 
  rooms, 
  selectedRoom, 
  onSelect 
}: { 
  rooms: MemoryRoom[];
  selectedRoom: string | null;
  onSelect: (roomId: string) => void;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {rooms.map(room => (
        <button
          key={room.id}
          onClick={() => onSelect(room.id)}
          className={`px-3 py-2 rounded-lg text-sm flex items-center gap-2 transition-all ${
            selectedRoom === room.id
              ? 'bg-blue-600 text-white'
              : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
          }`}
        >
          <div 
            className="w-3 h-3 rounded-full"
            style={{ backgroundColor: room.color }}
          />
          <span>{room.name}</span>
          <span className="text-xs opacity-60">({room.nodeCount})</span>
        </button>
      ))}
    </div>
  );
}

// =============================================================================
// NODE DETAIL PANEL
// =============================================================================

function NodeDetailPanel({ node, onClose }: { node: KnowledgeNode; onClose: () => void }) {
  const freshnessPercent = Math.round(node.freshnessScore * 100);
  const confidencePercent = Math.round(node.confidence * 100);

  return (
    <div className="p-4 bg-slate-800 rounded-xl border border-slate-700">
      <div className="flex items-start justify-between mb-4">
        <div>
          <h3 className="font-semibold text-white">{node.label}</h3>
          <p className="text-xs text-slate-400">{node.domain}</p>
        </div>
        <button onClick={onClose} className="text-slate-400 hover:text-white">×</button>
      </div>

      <p className="text-sm text-slate-300 mb-4">{node.content}</p>

      <div className="grid grid-cols-2 gap-4 mb-4">
        <div>
          <p className="text-xs text-slate-500">Freshness</p>
          <div className="flex items-center gap-2">
            <div className="flex-1 h-2 bg-slate-700 rounded-full overflow-hidden">
              <div 
                className="h-full rounded-full"
                style={{ 
                  width: `${freshnessPercent}%`,
                  backgroundColor: freshnessPercent > 70 ? '#22c55e' : freshnessPercent > 40 ? '#f59e0b' : '#ef4444'
                }}
              />
            </div>
            <span className="text-xs text-white">{freshnessPercent}%</span>
          </div>
        </div>
        <div>
          <p className="text-xs text-slate-500">Confidence</p>
          <div className="flex items-center gap-2">
            <div className="flex-1 h-2 bg-slate-700 rounded-full overflow-hidden">
              <div 
                className="h-full bg-blue-500 rounded-full"
                style={{ width: `${confidencePercent}%` }}
              />
            </div>
            <span className="text-xs text-white">{confidencePercent}%</span>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-4 text-xs text-slate-400">
        <span className="flex items-center gap-1">
          <Link2 className="w-3 h-3" />
          {node.connectionCount} connections
        </span>
        <span className="flex items-center gap-1">
          <Clock className="w-3 h-3" />
          {new Date(node.lastAccessed).toLocaleDateString()}
        </span>
      </div>
    </div>
  );
}

// =============================================================================
// MAIN COMPONENT
// =============================================================================

export default function MemoryPalacePage() {
  const [nodes, setNodes] = useState<KnowledgeNode[]>([]);
  const [connections, setConnections] = useState<MemoryConnection[]>([]);
  const [rooms, setRooms] = useState<MemoryRoom[]>([]);
  const [hotspots, setHotspots] = useState<DiscoveryHotspot[]>([]);
  const [selectedRoom, setSelectedRoom] = useState<string | null>(null);
  const [selectedNode, setSelectedNode] = useState<KnowledgeNode | null>(null);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const svgRef = useRef<SVGSVGElement>(null);

  // Load data from API
  useEffect(() => {
    async function loadPalaceData() {
      try {
        const response = await fetch('/api/thinktank/living-parchment/memory-palace');
        if (response.ok) {
          const data = await response.json();
          setNodes(data.nodes || []);
          setConnections(data.connections || []);
          setRooms(data.rooms || []);
          setHotspots(data.hotspots || []);
        } else {
          // Generate initial data if API not available
          generateInitialData();
        }
      } catch {
        generateInitialData();
      }
      setLoading(false);
    }

    loadPalaceData();
  }, []);

  function generateInitialData() {
    const domains = ['Technology', 'Business', 'Science', 'Legal', 'Finance'];
    const generatedRooms: MemoryRoom[] = domains.map((domain, i) => ({
      id: `room-${i}`,
      name: domain,
      domain,
      nodeCount: 5 + Math.floor(Math.random() * 10),
      avgFreshness: 0.5 + Math.random() * 0.5,
      color: ['#3b82f6', '#22c55e', '#8b5cf6', '#f59e0b', '#ef4444'][i],
    }));

    const generatedNodes: KnowledgeNode[] = [];
    const generatedConnections: MemoryConnection[] = [];

    generatedRooms.forEach((room, roomIndex) => {
      for (let i = 0; i < room.nodeCount; i++) {
        const nodeId = `node-${roomIndex}-${i}`;
        const angle = (i / room.nodeCount) * 2 * Math.PI;
        const radius = 100 + Math.random() * 100;
        const centerX = 300 + roomIndex * 150;
        const centerY = 250;

        generatedNodes.push({
          id: nodeId,
          label: `${room.domain} Concept ${i + 1}`,
          domain: room.domain,
          content: `Knowledge about ${room.domain.toLowerCase()} topic ${i + 1}. This represents accumulated understanding from multiple sources.`,
          confidence: 0.5 + Math.random() * 0.5,
          freshnessScore: Math.random(),
          lastAccessed: new Date(Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000).toISOString(),
          connectionCount: Math.floor(Math.random() * 5) + 1,
          position: {
            x: centerX + Math.cos(angle) * radius,
            y: centerY + Math.sin(angle) * radius,
            z: Math.random() * 50,
          },
          size: 8 + Math.random() * 8,
        });

        // Create some connections
        if (i > 0 && Math.random() > 0.3) {
          generatedConnections.push({
            id: `conn-${roomIndex}-${i}`,
            sourceId: nodeId,
            targetId: `node-${roomIndex}-${i - 1}`,
            strength: 0.3 + Math.random() * 0.7,
            type: ['semantic', 'temporal', 'causal', 'reference'][Math.floor(Math.random() * 4)] as any,
          });
        }
      }
    });

    // Generate hotspots
    const generatedHotspots: DiscoveryHotspot[] = [
      { id: 'h1', position: { x: 400, y: 200 }, intensity: 0.8, potentialInsights: ['Cross-domain pattern detected'] },
      { id: 'h2', position: { x: 600, y: 300 }, intensity: 0.6, potentialInsights: ['Knowledge gap identified'] },
    ];

    setRooms(generatedRooms);
    setNodes(generatedNodes);
    setConnections(generatedConnections);
    setHotspots(generatedHotspots);
  }

  const handleZoomIn = () => setZoom(z => Math.min(z * 1.2, 3));
  const handleZoomOut = () => setZoom(z => Math.max(z / 1.2, 0.5));
  const handleReset = () => { setZoom(1); setPan({ x: 0, y: 0 }); };

  const filteredNodes = selectedRoom 
    ? nodes.filter(n => rooms.find(r => r.id === selectedRoom)?.domain === n.domain)
    : nodes;

  const searchedNodes = searchQuery
    ? filteredNodes.filter(n => 
        n.label.toLowerCase().includes(searchQuery.toLowerCase()) ||
        n.content.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : filteredNodes;

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-white p-6">
      <style>{palaceStyles}</style>

      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-3">
            <Brain className="w-7 h-7 text-cyan-500" />
            Memory Palace
          </h1>
          <p className="text-slate-400 mt-1">Navigable knowledge topology</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Search knowledge..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 pr-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-white placeholder-slate-400 focus:outline-none focus:border-blue-500"
            />
          </div>
          <button onClick={handleZoomIn} className="p-2 bg-slate-800 rounded-lg hover:bg-slate-700">
            <ZoomIn className="w-4 h-4" />
          </button>
          <button onClick={handleZoomOut} className="p-2 bg-slate-800 rounded-lg hover:bg-slate-700">
            <ZoomOut className="w-4 h-4" />
          </button>
          <button onClick={handleReset} className="p-2 bg-slate-800 rounded-lg hover:bg-slate-700">
            <RotateCcw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Room selector */}
      <div className="mb-6">
        <RoomSelector 
          rooms={rooms} 
          selectedRoom={selectedRoom} 
          onSelect={(id) => setSelectedRoom(selectedRoom === id ? null : id)} 
        />
      </div>

      <div className="grid grid-cols-12 gap-6">
        {/* Main visualization */}
        <div className="col-span-9">
          <div className="bg-slate-900 rounded-xl border border-slate-800 overflow-hidden">
            <svg
              ref={svgRef}
              width="100%"
              height="500"
              viewBox={`${-pan.x} ${-pan.y} ${900 / zoom} ${500 / zoom}`}
              className="bg-slate-900"
            >
              {/* Connections */}
              {connections.map(conn => {
                const source = nodes.find(n => n.id === conn.sourceId);
                const target = nodes.find(n => n.id === conn.targetId);
                if (!source || !target) return null;
                return (
                  <ConnectionLine
                    key={conn.id}
                    connection={conn}
                    sourceNode={source}
                    targetNode={target}
                  />
                );
              })}

              {/* Hotspots */}
              {hotspots.map(hotspot => (
                <HotspotBeacon key={hotspot.id} hotspot={hotspot} />
              ))}

              {/* Nodes */}
              {searchedNodes.map(node => (
                <KnowledgeNodeView
                  key={node.id}
                  node={node}
                  isSelected={selectedNode?.id === node.id}
                  onSelect={() => setSelectedNode(node)}
                />
              ))}
            </svg>
          </div>

          {/* Legend */}
          <div className="mt-4 flex items-center gap-6 text-xs text-slate-400">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-green-500" />
              <span>Fresh (70%+)</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-amber-500" />
              <span>Aging (40-70%)</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-gray-500" />
              <span>Stale (&lt;40%)</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-amber-500 animate-pulse" />
              <span>Discovery Hotspot</span>
            </div>
          </div>
        </div>

        {/* Side panel */}
        <div className="col-span-3 space-y-4">
          {/* Stats */}
          <div className="p-4 bg-slate-900 rounded-xl border border-slate-800">
            <h3 className="text-sm font-medium text-slate-300 mb-3">Palace Statistics</h3>
            <div className="space-y-3">
              <div className="flex justify-between">
                <span className="text-xs text-slate-500">Total Nodes</span>
                <span className="text-sm font-medium text-white">{nodes.length}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-xs text-slate-500">Connections</span>
                <span className="text-sm font-medium text-white">{connections.length}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-xs text-slate-500">Avg Freshness</span>
                <span className="text-sm font-medium text-white">
                  {Math.round(nodes.reduce((sum, n) => sum + n.freshnessScore, 0) / nodes.length * 100)}%
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-xs text-slate-500">Discovery Hotspots</span>
                <span className="text-sm font-medium text-amber-400">{hotspots.length}</span>
              </div>
            </div>
          </div>

          {/* Selected node detail */}
          {selectedNode && (
            <NodeDetailPanel 
              node={selectedNode} 
              onClose={() => setSelectedNode(null)} 
            />
          )}

          {/* Quick actions */}
          <div className="p-4 bg-slate-900 rounded-xl border border-slate-800">
            <h3 className="text-sm font-medium text-slate-300 mb-3">Actions</h3>
            <div className="space-y-2">
              <button className="w-full py-2 px-3 bg-blue-600 hover:bg-blue-500 rounded-lg text-sm flex items-center justify-center gap-2">
                <RefreshCw className="w-4 h-4" />
                Refresh Stale Nodes
              </button>
              <button className="w-full py-2 px-3 bg-slate-700 hover:bg-slate-600 rounded-lg text-sm flex items-center justify-center gap-2">
                <Sparkles className="w-4 h-4" />
                Explore Hotspots
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
