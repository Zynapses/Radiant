'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import {
  ZoomIn,
  ZoomOut,
  Maximize2,
  Filter,
  Download,
  Search,
  PenTool,
  CheckCircle2,
  AlertTriangle,
  Eye,
  FileText,
  ExternalLink,
  Clock,
  User,
  Lock,
  Link2,
  History,
  Crown,
  X,
  Loader2,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { GlassCard } from '@/components/ui/glass-card';
import { toast } from 'sonner';

interface GraphNode {
  id: string;
  label: string;
  type: 'concept' | 'fact' | 'procedure' | 'entity';
  status: 'verified' | 'pending' | 'overridden';
  x: number;
  y: number;
  connections: string[];
  content?: string;
  sourceDocumentId?: string;
  sourceDocumentName?: string;
  sourcePage?: number;
  confidence?: number;
  verifiedAt?: string;
  verifiedBy?: string;
  overrideValue?: string;
  overrideReason?: string;
  overrideAt?: string;
  overrideBy?: string;
  chainOfCustodyId?: string;
}

const defaultNodes: GraphNode[] = [];

function getNodeColor(type: string) {
  switch (type) {
    case 'concept': return '#D4AF37';
    case 'fact': return '#50C878';
    case 'procedure': return '#0F52BA';
    case 'entity': return '#CD7F32';
    default: return '#888';
  }
}

function getStatusIcon(status: string) {
  switch (status) {
    case 'verified': return <CheckCircle2 className="h-3 w-3 text-curator-emerald" />;
    case 'pending': return <AlertTriangle className="h-3 w-3 text-curator-gold" />;
    case 'overridden': return <PenTool className="h-3 w-3 text-curator-sapphire" />;
    default: return null;
  }
}

export default function GraphPage() {
  const [nodes, setNodes] = useState<GraphNode[]>(defaultNodes);
  const [selectedNode, setSelectedNode] = useState<GraphNode | null>(null);
  const [zoom, setZoom] = useState(1);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState<string | null>(null);
  const [showOverrideDialog, setShowOverrideDialog] = useState(false);
  const [overrideValue, setOverrideValue] = useState('');
  const [overrideReason, setOverrideReason] = useState('');
  const [overridePriority, setOverridePriority] = useState(100);
  const [overrideLoading, setOverrideLoading] = useState(false);
  const [showChainOfCustody, setShowChainOfCustody] = useState(false);
  const [chainOfCustody, setChainOfCustody] = useState<any>(null);
  const canvasRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    async function fetchNodes() {
      try {
        const res = await fetch('/api/curator/nodes');
        if (res.ok) {
          const data = await res.json();
          setNodes(data.nodes || []);
        }
      } catch (error) {
        console.error('Failed to fetch graph nodes:', error);
      }
    }
    fetchNodes();
  }, []);

  const handleOverride = async () => {
    if (!selectedNode || !overrideValue || !overrideReason) {
      toast.error('Error', { description: 'Please fill in all required fields.' });
      return;
    }
    setOverrideLoading(true);
    try {
      const res = await fetch(`/api/curator/nodes/${selectedNode.id}/override`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          overrideValue,
          reason: overrideReason,
          priority: overridePriority,
        }),
      });
      if (res.ok) {
        setNodes((prev) =>
          prev.map((n) =>
            n.id === selectedNode.id
              ? { ...n, status: 'overridden', overrideValue, overrideReason }
              : n
          )
        );
        toast.success('Override Applied', {
          description: 'Golden Rule created with Chain of Custody tracking.',
        });
        setShowOverrideDialog(false);
        setOverrideValue('');
        setOverrideReason('');
        setOverridePriority(100);
      } else {
        throw new Error('Failed to override');
      }
    } catch (error) {
      toast.error('Error', { description: 'Failed to apply override. Please try again.' });
    } finally {
      setOverrideLoading(false);
    }
  };

  const fetchChainOfCustody = async (nodeId: string) => {
    try {
      const res = await fetch(`/api/curator/chain-of-custody/${nodeId}`);
      if (res.ok) {
        const data = await res.json();
        setChainOfCustody(data);
        setShowChainOfCustody(true);
      }
    } catch (error) {
      toast.error('Error', { description: 'Failed to fetch Chain of Custody.' });
    }
  };

  const filteredNodes = nodes.filter((node) => {
    if (filterType && node.type !== filterType) return false;
    if (searchQuery && !node.label.toLowerCase().includes(searchQuery.toLowerCase())) return false;
    return true;
  });

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold">Knowledge Graph</h1>
          <p className="text-muted-foreground mt-1">
            Visualize and manage relationships between knowledge nodes.
          </p>
        </div>
      </div>

      {/* Toolbar */}
      <div className="flex items-center justify-between gap-4 p-3 bg-card border rounded-lg">
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search nodes..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 pr-4 py-2 text-sm border rounded-md bg-background w-64"
            />
          </div>
          <select
            value={filterType || ''}
            onChange={(e) => setFilterType(e.target.value || null)}
            className="px-3 py-2 text-sm border rounded-md bg-background"
          >
            <option value="">All Types</option>
            <option value="concept">Concepts</option>
            <option value="fact">Facts</option>
            <option value="procedure">Procedures</option>
            <option value="entity">Entities</option>
          </select>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={() => setZoom((z) => Math.max(0.5, z - 0.1))}
            className="p-2 hover:bg-accent rounded-md"
            title="Zoom Out"
          >
            <ZoomOut className="h-4 w-4" />
          </button>
          <span className="text-sm text-muted-foreground w-16 text-center">
            {Math.round(zoom * 100)}%
          </span>
          <button
            onClick={() => setZoom((z) => Math.min(2, z + 0.1))}
            className="p-2 hover:bg-accent rounded-md"
            title="Zoom In"
          >
            <ZoomIn className="h-4 w-4" />
          </button>
          <div className="w-px h-6 bg-border mx-2" />
          <button className="p-2 hover:bg-accent rounded-md" title="Fit to Screen">
            <Maximize2 className="h-4 w-4" />
          </button>
          <button className="p-2 hover:bg-accent rounded-md" title="Export Graph">
            <Download className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-4">
        {/* Graph Canvas */}
        <div className="lg:col-span-3">
          <div
            ref={canvasRef}
            className="knowledge-graph bg-card border rounded-xl h-[600px] relative"
            style={{ transform: `scale(${zoom})`, transformOrigin: 'top left' }}
          >
            {/* SVG for edges */}
            <svg className="absolute inset-0 w-full h-full pointer-events-none">
              {filteredNodes.map((node) =>
                node.connections.map((targetId) => {
                  const target = nodes.find((n) => n.id === targetId);
                  if (!target || !filteredNodes.includes(target)) return null;
                  return (
                    <line
                      key={`${node.id}-${targetId}`}
                      x1={node.x}
                      y1={node.y}
                      x2={target.x}
                      y2={target.y}
                      className="graph-edge"
                    />
                  );
                })
              )}
            </svg>

            {/* Nodes */}
            {filteredNodes.map((node) => (
              <button
                key={node.id}
                onClick={() => setSelectedNode(node)}
                className={cn(
                  'graph-node absolute flex flex-col items-center gap-1 p-3 rounded-lg border bg-card shadow-sm',
                  `graph-node ${node.status}`,
                  selectedNode?.id === node.id && 'ring-2 ring-primary'
                )}
                style={{
                  left: node.x - 60,
                  top: node.y - 30,
                  minWidth: 120,
                }}
              >
                <div className="flex items-center gap-1">
                  <div
                    className="w-2 h-2 rounded-full"
                    style={{ backgroundColor: getNodeColor(node.type) }}
                  />
                  {getStatusIcon(node.status)}
                </div>
                <span className="text-xs font-medium text-center line-clamp-2">
                  {node.label}
                </span>
              </button>
            ))}
          </div>

          {/* Legend */}
          <div className="flex items-center justify-center gap-6 mt-4 text-xs text-muted-foreground">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-curator-gold" />
              <span>Concept</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-curator-emerald" />
              <span>Fact</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-curator-sapphire" />
              <span>Procedure</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-curator-bronze" />
              <span>Entity</span>
            </div>
          </div>
        </div>

        {/* Detail Panel - Traceability Inspector */}
        <div className="lg:col-span-1">
          {selectedNode ? (
            <GlassCard variant="elevated" padding="md" className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold">Traceability Inspector</h3>
                {selectedNode.status === 'overridden' && (
                  <div className="flex items-center gap-1 px-2 py-0.5 bg-curator-gold/10 rounded-full">
                    <Lock className="h-3 w-3 text-curator-gold" />
                    <span className="text-xs text-curator-gold font-medium">God Mode</span>
                  </div>
                )}
              </div>

              {/* Content */}
              <div className="p-3 bg-muted/50 rounded-lg">
                <p className="text-sm">{selectedNode.content || selectedNode.label}</p>
                {selectedNode.overrideValue && (
                  <div className="mt-2 p-2 bg-curator-gold/10 border border-curator-gold/20 rounded">
                    <p className="text-xs text-curator-gold font-medium">Override Value:</p>
                    <p className="text-sm">{selectedNode.overrideValue}</p>
                  </div>
                )}
              </div>

              <div className="space-y-3">
                <div>
                  <label className="text-xs text-muted-foreground uppercase">Type</label>
                  <div className="flex items-center gap-2 mt-1">
                    <div
                      className="w-3 h-3 rounded-full"
                      style={{ backgroundColor: getNodeColor(selectedNode.type) }}
                    />
                    <span className="capitalize">{selectedNode.type}</span>
                  </div>
                </div>
                <div>
                  <label className="text-xs text-muted-foreground uppercase">Status</label>
                  <div className="flex items-center gap-2 mt-1">
                    {getStatusIcon(selectedNode.status)}
                    <span className="capitalize">{selectedNode.status}</span>
                  </div>
                </div>
                {selectedNode.confidence !== undefined && (
                  <div>
                    <label className="text-xs text-muted-foreground uppercase">Confidence</label>
                    <div className="flex items-center gap-2 mt-1">
                      <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                        <div
                          className={cn(
                            'h-full rounded-full',
                            selectedNode.confidence >= 90 ? 'bg-curator-emerald' :
                            selectedNode.confidence >= 70 ? 'bg-curator-gold' : 'bg-destructive'
                          )}
                          style={{ width: `${selectedNode.confidence}%` }}
                        />
                      </div>
                      <span className="text-sm font-medium">{selectedNode.confidence}%</span>
                    </div>
                  </div>
                )}
                <div>
                  <label className="text-xs text-muted-foreground uppercase">Connections</label>
                  <p className="text-sm">{selectedNode.connections.length} related nodes</p>
                </div>
              </div>

              {/* Source Document */}
              {selectedNode.sourceDocumentName && (
                <div className="pt-3 border-t">
                  <label className="text-xs text-muted-foreground uppercase">Source Document</label>
                  <div className="flex items-center justify-between mt-1 p-2 bg-muted/50 rounded">
                    <div className="flex items-center gap-2">
                      <FileText className="h-4 w-4 text-muted-foreground" />
                      <div>
                        <p className="text-sm font-medium">{selectedNode.sourceDocumentName}</p>
                        {selectedNode.sourcePage && (
                          <p className="text-xs text-muted-foreground">Page {selectedNode.sourcePage}</p>
                        )}
                      </div>
                    </div>
                    <button className="p-1 hover:bg-accent rounded" title="View Source">
                      <ExternalLink className="h-4 w-4 text-muted-foreground" />
                    </button>
                  </div>
                </div>
              )}

              {/* Verification / Override Info */}
              {selectedNode.status === 'verified' && selectedNode.verifiedAt && (
                <div className="pt-3 border-t space-y-2">
                  <label className="text-xs text-muted-foreground uppercase">Verified</label>
                  <div className="flex items-center gap-2 text-sm">
                    <User className="h-4 w-4 text-muted-foreground" />
                    <span>{selectedNode.verifiedBy || 'System'}</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    <Clock className="h-4 w-4 text-muted-foreground" />
                    <span>{new Date(selectedNode.verifiedAt).toLocaleString()}</span>
                  </div>
                </div>
              )}

              {selectedNode.status === 'overridden' && selectedNode.overrideAt && (
                <div className="pt-3 border-t space-y-2">
                  <label className="text-xs text-muted-foreground uppercase">Override Info</label>
                  <p className="text-sm text-muted-foreground">{selectedNode.overrideReason}</p>
                  <div className="flex items-center gap-2 text-sm">
                    <User className="h-4 w-4 text-muted-foreground" />
                    <span>{selectedNode.overrideBy || 'Admin'}</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    <Clock className="h-4 w-4 text-muted-foreground" />
                    <span>{new Date(selectedNode.overrideAt).toLocaleString()}</span>
                  </div>
                </div>
              )}

              {/* Actions */}
              <div className="pt-4 border-t space-y-2">
                <button
                  onClick={() => setShowOverrideDialog(true)}
                  className="w-full flex items-center justify-center gap-2 py-2 px-4 bg-curator-gold text-white rounded-lg text-sm font-medium hover:bg-curator-gold/90"
                >
                  <Crown className="h-4 w-4" />
                  {selectedNode.status === 'overridden' ? 'Edit Override' : 'Force Override'}
                </button>
                <div className="grid grid-cols-2 gap-2">
                  {selectedNode.sourceDocumentId && (
                    <button className="flex items-center justify-center gap-2 py-2 px-3 border rounded-lg text-sm hover:bg-accent">
                      <Eye className="h-4 w-4" />
                      View Source
                    </button>
                  )}
                  <button
                    onClick={() => fetchChainOfCustody(selectedNode.id)}
                    className="flex items-center justify-center gap-2 py-2 px-3 border rounded-lg text-sm hover:bg-accent"
                  >
                    <History className="h-4 w-4" />
                    Audit Trail
                  </button>
                </div>
              </div>
            </GlassCard>
          ) : (
            <GlassCard variant="default" padding="lg" className="flex flex-col items-center justify-center text-center h-[300px]">
              <Filter className="h-8 w-8 text-muted-foreground/50 mb-3" />
              <p className="text-sm text-muted-foreground">
                Click a node to view traceability details
              </p>
            </GlassCard>
          )}

          {/* Quick Stats */}
          <GlassCard variant="default" padding="md" className="mt-4 space-y-3">
            <h3 className="font-semibold text-sm">Graph Stats</h3>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <p className="text-muted-foreground">Total Nodes</p>
                <p className="text-xl font-bold">{nodes.length}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Verified</p>
                <p className="text-xl font-bold text-curator-emerald">
                  {nodes.filter((n) => n.status === 'verified').length}
                </p>
              </div>
              <div>
                <p className="text-muted-foreground">Pending</p>
                <p className="text-xl font-bold text-curator-gold">
                  {nodes.filter((n) => n.status === 'pending').length}
                </p>
              </div>
              <div>
                <p className="text-muted-foreground">Overridden</p>
                <p className="text-xl font-bold text-curator-sapphire">
                  {nodes.filter((n) => n.status === 'overridden').length}
                </p>
              </div>
            </div>
          </GlassCard>
        </div>
      </div>

      {/* Override Dialog */}
      {showOverrideDialog && selectedNode && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-card rounded-xl border shadow-lg p-6 max-w-lg w-full mx-4">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-curator-gold/10 rounded-lg">
                  <Crown className="h-5 w-5 text-curator-gold" />
                </div>
                <div>
                  <h2 className="text-lg font-semibold">Force Override</h2>
                  <p className="text-sm text-muted-foreground">"God Mode" - Supersedes AI</p>
                </div>
              </div>
              <button onClick={() => setShowOverrideDialog(false)} className="p-1 hover:bg-accent rounded">
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-4">
              <div className="p-3 bg-muted/50 rounded-lg">
                <p className="text-xs text-muted-foreground mb-1">Current Value</p>
                <p className="text-sm">{selectedNode.content || selectedNode.label}</p>
              </div>

              <div>
                <label className="text-sm font-medium">Override Value</label>
                <textarea
                  value={overrideValue}
                  onChange={(e) => setOverrideValue(e.target.value)}
                  className="w-full mt-1 px-3 py-2 border rounded-md bg-background h-20"
                  placeholder="Enter the correct value..."
                />
              </div>

              <div>
                <label className="text-sm font-medium">Justification</label>
                <textarea
                  value={overrideReason}
                  onChange={(e) => setOverrideReason(e.target.value)}
                  className="w-full mt-1 px-3 py-2 border rounded-md bg-background h-20"
                  placeholder="Why is this override necessary?"
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-sm font-medium">Priority</label>
                  <span className="text-sm text-curator-gold">{overridePriority}</span>
                </div>
                <input
                  type="range"
                  min="1"
                  max="100"
                  value={overridePriority}
                  onChange={(e) => setOverridePriority(parseInt(e.target.value))}
                  className="w-full accent-curator-gold"
                />
              </div>

              <div className="flex items-start gap-2 p-3 bg-curator-gold/5 border border-curator-gold/20 rounded-lg">
                <Lock className="h-4 w-4 text-curator-gold shrink-0 mt-0.5" />
                <p className="text-xs text-muted-foreground">
                  This will create a cryptographically signed Chain of Custody record.
                </p>
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  onClick={() => setShowOverrideDialog(false)}
                  className="flex-1 py-2 border rounded-lg hover:bg-accent"
                >
                  Cancel
                </button>
                <button
                  onClick={handleOverride}
                  disabled={!overrideValue || !overrideReason || overrideLoading}
                  className="flex-1 py-2 bg-curator-gold text-white rounded-lg hover:bg-curator-gold/90 disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {overrideLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Crown className="h-4 w-4" />}
                  Apply Override
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Chain of Custody Modal */}
      {showChainOfCustody && chainOfCustody && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-card rounded-xl border shadow-lg p-6 max-w-lg w-full mx-4 max-h-[80vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <History className="h-5 w-5 text-curator-gold" />
                <h2 className="text-lg font-semibold">Chain of Custody</h2>
              </div>
              <button onClick={() => setShowChainOfCustody(false)} className="p-1 hover:bg-accent rounded">
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-4">
              {chainOfCustody.events?.length > 0 ? (
                <div className="space-y-3">
                  {chainOfCustody.events.map((event: any, idx: number) => (
                    <div key={idx} className="flex gap-3">
                      <div className="flex flex-col items-center">
                        <div className={cn(
                          'w-3 h-3 rounded-full',
                          event.type === 'create' ? 'bg-curator-emerald' :
                          event.type === 'verify' ? 'bg-curator-sapphire' :
                          event.type === 'override' ? 'bg-curator-gold' : 'bg-muted'
                        )} />
                        {idx < chainOfCustody.events.length - 1 && (
                          <div className="w-px h-full bg-border" />
                        )}
                      </div>
                      <div className="pb-4">
                        <p className="text-sm font-medium capitalize">{event.type}</p>
                        <p className="text-xs text-muted-foreground">{event.description}</p>
                        <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                          <span className="flex items-center gap-1">
                            <User className="h-3 w-3" />
                            {event.actor}
                          </span>
                          <span className="flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            {new Date(event.timestamp).toLocaleString()}
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground text-center py-4">
                  No audit trail available for this node.
                </p>
              )}

              {chainOfCustody.signature && (
                <div className="p-3 bg-muted/50 rounded-lg">
                  <p className="text-xs text-muted-foreground mb-1">Cryptographic Signature</p>
                  <p className="text-xs font-mono break-all">{chainOfCustody.signature}</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
