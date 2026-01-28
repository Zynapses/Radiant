'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Network, Search, RefreshCw, ArrowRight, Database, GitBranch } from 'lucide-react';

interface GraphNode {
  id: string;
  label: string;
  nodeType: string;
  confidence: number;
  edgeCount: number;
  createdAt: string;
}

interface GraphEdge {
  id: string;
  sourceLabel: string;
  targetLabel: string;
  edgeType: string;
  weight: number;
}

interface GraphStats {
  nodeCount: number;
  edgeCount: number;
  documentCount: number;
  avgConfidence: number;
  topNodeTypes: { type: string; count: number }[];
  topEdgeTypes: { type: string; count: number }[];
}

export default function CortexGraphPage() {
  const [stats, setStats] = useState<GraphStats | null>(null);
  const [nodes, setNodes] = useState<GraphNode[]>([]);
  const [edges, setEdges] = useState<GraphEdge[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [nodeTypeFilter, setNodeTypeFilter] = useState<string>('all');

  useEffect(() => {
    fetchGraphData();
  }, []);

  const fetchGraphData = async () => {
    setLoading(true);
    try {
      const [statsRes, nodesRes] = await Promise.all([
        fetch('/api/admin/cortex/graph/stats'),
        fetch('/api/admin/cortex/graph/explore?limit=50'),
      ]);

      if (statsRes.ok) {
        const statsData = await statsRes.json();
        setStats(statsData);
      }

      if (nodesRes.ok) {
        const nodesData = await nodesRes.json();
        setNodes(nodesData.nodes || []);
        setEdges(nodesData.edges || []);
      }
    } catch (error) {
      console.error('Failed to fetch graph data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = async () => {
    if (!searchQuery.trim()) return;
    
    setLoading(true);
    try {
      const params = new URLSearchParams({
        query: searchQuery,
        ...(nodeTypeFilter !== 'all' && { nodeType: nodeTypeFilter }),
      });
      const res = await fetch(`/api/admin/cortex/graph/explore?${params}`);
      if (res.ok) {
        const data = await res.json();
        setNodes(data.nodes || []);
        setEdges(data.edges || []);
      }
    } catch (error) {
      console.error('Search failed:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Graph Explorer</h1>
          <p className="text-muted-foreground">
            Explore the Cortex knowledge graph - nodes, edges, and relationships
          </p>
        </div>
        <Button onClick={fetchGraphData} disabled={loading}>
          <RefreshCw className={`mr-2 h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Nodes</CardTitle>
            <Database className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.nodeCount?.toLocaleString() || 0}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Edges</CardTitle>
            <GitBranch className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.edgeCount?.toLocaleString() || 0}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Documents</CardTitle>
            <Network className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.documentCount?.toLocaleString() || 0}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Avg Confidence</CardTitle>
            <Network className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {stats?.avgConfidence ? `${(stats.avgConfidence * 100).toFixed(1)}%` : 'N/A'}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Search and Filter */}
      <Card>
        <CardHeader>
          <CardTitle>Search Graph</CardTitle>
          <CardDescription>Search nodes by label, type, or properties</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex gap-4">
            <div className="flex-1">
              <Input
                placeholder="Search nodes..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
              />
            </div>
            <Select value={nodeTypeFilter} onValueChange={setNodeTypeFilter}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Node Type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                <SelectItem value="entity">Entity</SelectItem>
                <SelectItem value="concept">Concept</SelectItem>
                <SelectItem value="document">Document</SelectItem>
                <SelectItem value="person">Person</SelectItem>
                <SelectItem value="equipment">Equipment</SelectItem>
                <SelectItem value="process">Process</SelectItem>
              </SelectContent>
            </Select>
            <Button onClick={handleSearch}>
              <Search className="mr-2 h-4 w-4" />
              Search
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Results */}
      <Tabs defaultValue="nodes">
        <TabsList>
          <TabsTrigger value="nodes">Nodes ({nodes.length})</TabsTrigger>
          <TabsTrigger value="edges">Edges ({edges.length})</TabsTrigger>
          <TabsTrigger value="types">Type Distribution</TabsTrigger>
        </TabsList>

        <TabsContent value="nodes">
          <Card>
            <CardContent className="pt-6">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Label</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Confidence</TableHead>
                    <TableHead>Edges</TableHead>
                    <TableHead>Created</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {nodes.map((node) => (
                    <TableRow key={node.id}>
                      <TableCell className="font-medium">{node.label}</TableCell>
                      <TableCell>
                        <Badge variant="outline">{node.nodeType}</Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant={node.confidence > 0.8 ? 'default' : 'secondary'}>
                          {(node.confidence * 100).toFixed(0)}%
                        </Badge>
                      </TableCell>
                      <TableCell>{node.edgeCount}</TableCell>
                      <TableCell>{new Date(node.createdAt).toLocaleDateString()}</TableCell>
                    </TableRow>
                  ))}
                  {nodes.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center text-muted-foreground">
                        No nodes found. Try searching or adjusting filters.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="edges">
          <Card>
            <CardContent className="pt-6">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Source</TableHead>
                    <TableHead></TableHead>
                    <TableHead>Target</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Weight</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {edges.map((edge) => (
                    <TableRow key={edge.id}>
                      <TableCell className="font-medium">{edge.sourceLabel}</TableCell>
                      <TableCell>
                        <ArrowRight className="h-4 w-4 text-muted-foreground" />
                      </TableCell>
                      <TableCell className="font-medium">{edge.targetLabel}</TableCell>
                      <TableCell>
                        <Badge variant="outline">{edge.edgeType}</Badge>
                      </TableCell>
                      <TableCell>{edge.weight.toFixed(2)}</TableCell>
                    </TableRow>
                  ))}
                  {edges.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center text-muted-foreground">
                        No edges found.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="types">
          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Node Types</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {stats?.topNodeTypes?.map((item) => (
                    <div key={item.type} className="flex items-center justify-between">
                      <span className="font-medium">{item.type}</span>
                      <Badge>{item.count.toLocaleString()}</Badge>
                    </div>
                  )) || <p className="text-muted-foreground">No data available</p>}
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>Edge Types</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {stats?.topEdgeTypes?.map((item) => (
                    <div key={item.type} className="flex items-center justify-between">
                      <span className="font-medium">{item.type}</span>
                      <Badge>{item.count.toLocaleString()}</Badge>
                    </div>
                  )) || <p className="text-muted-foreground">No data available</p>}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
