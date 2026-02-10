'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import { 
  Server, 
  Wrench, 
  Sparkles, 
  Cpu, 
  Ghost, 
  DollarSign,
  RefreshCw,
  Plus,
  Search,
  Activity,
  CheckCircle,
  XCircle,
  AlertCircle,
  Brain,
  Zap,
  Cloud,
  Monitor,
  Globe
} from 'lucide-react';

interface MCPServer {
  serverId: string;
  name: string;
  description: string;
  transport: string;
  url?: string;
  healthStatus: 'healthy' | 'degraded' | 'unhealthy' | 'unknown';
  avgLatencyMs: number;
  errorRate: number;
  totalCallsToday: number;
  domainAffinity: string[];
}

interface ToolSchema {
  toolId: string;
  name: string;
  description: string;
  category: string;
  successRate: number;
  avgExecutionMs: number;
  usageCount: number;
  primaryDomain: string;
}

interface DashboardData {
  overview: {
    mcpServers: { total: number; healthy: number; unhealthy: number };
    tools: { total: number; byCategory: Record<string, number> };
    compute: { recentDecisions: number; locationDistribution: Record<string, number> };
    ghost: { totalSimulations: number; avgConfidence: number };
    economic: { budgetUtilization: number; negotiationStrategy: string } | null;
  };
}

export default function OrganismPage() {
  const [activeTab, setActiveTab] = useState('overview');
  const [dashboard, setDashboard] = useState<DashboardData | null>(null);
  const [servers, setServers] = useState<MCPServer[]>([]);
  const [tools, setTools] = useState<ToolSchema[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    fetchDashboard();
    fetchServers();
    fetchTools();
  }, []);

  const fetchDashboard = async () => {
    try {
      const res = await fetch('/api/admin/organism/dashboard');
      if (res.ok) {
        const data = await res.json();
        setDashboard(data);
      }
    } catch (error) {
      console.error('Failed to fetch dashboard:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchServers = async () => {
    try {
      const res = await fetch('/api/admin/organism/mcp-servers');
      if (res.ok) {
        const data = await res.json();
        setServers(data.servers || []);
      }
    } catch (error) {
      console.error('Failed to fetch servers:', error);
    }
  };

  const fetchTools = async () => {
    try {
      const res = await fetch('/api/admin/organism/tools');
      if (res.ok) {
        const data = await res.json();
        setTools(data.tools || []);
      }
    } catch (error) {
      console.error('Failed to fetch tools:', error);
    }
  };

  const getHealthIcon = (status: string) => {
    switch (status) {
      case 'healthy': return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'degraded': return <AlertCircle className="h-4 w-4 text-yellow-500" />;
      case 'unhealthy': return <XCircle className="h-4 w-4 text-red-500" />;
      default: return <AlertCircle className="h-4 w-4 text-gray-500" />;
    }
  };

  const getLocationIcon = (location: string) => {
    switch (location) {
      case 'browser': return <Monitor className="h-4 w-4" />;
      case 'local': return <Cpu className="h-4 w-4" />;
      case 'edge': return <Globe className="h-4 w-4" />;
      case 'cloud': return <Cloud className="h-4 w-4" />;
      default: return <Server className="h-4 w-4" />;
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="container mx-auto py-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Autonomous Organism</h1>
          <p className="text-muted-foreground">
            Project Metamorphosis - Self-evolving AI orchestration system
          </p>
        </div>
        <Button onClick={() => { fetchDashboard(); fetchServers(); fetchTools(); }}>
          <RefreshCw className="h-4 w-4 mr-2" />
          Refresh
        </Button>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid grid-cols-6 w-full max-w-3xl">
          <TabsTrigger value="overview" className="flex items-center gap-2">
            <Activity className="h-4 w-4" />
            Overview
          </TabsTrigger>
          <TabsTrigger value="mcp-servers" className="flex items-center gap-2">
            <Server className="h-4 w-4" />
            MCP Servers
          </TabsTrigger>
          <TabsTrigger value="tools" className="flex items-center gap-2">
            <Wrench className="h-4 w-4" />
            Tools
          </TabsTrigger>
          <TabsTrigger value="tool-forge" className="flex items-center gap-2">
            <Sparkles className="h-4 w-4" />
            Tool Forge
          </TabsTrigger>
          <TabsTrigger value="compute" className="flex items-center gap-2">
            <Cpu className="h-4 w-4" />
            Compute
          </TabsTrigger>
          <TabsTrigger value="ghost" className="flex items-center gap-2">
            <Ghost className="h-4 w-4" />
            Ghost
          </TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview" className="space-y-6">
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">MCP Servers</CardTitle>
                <Server className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{dashboard?.overview.mcpServers.total || 0}</div>
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <span className="text-green-500">{dashboard?.overview.mcpServers.healthy || 0} healthy</span>
                  <span className="text-red-500">{dashboard?.overview.mcpServers.unhealthy || 0} unhealthy</span>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Tool Schemas</CardTitle>
                <Wrench className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{dashboard?.overview.tools.total || 0}</div>
                <p className="text-xs text-muted-foreground">
                  Registered across all servers
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Ghost Simulations</CardTitle>
                <Ghost className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{dashboard?.overview.ghost?.totalSimulations || 0}</div>
                <p className="text-xs text-muted-foreground">
                  Avg confidence: {((dashboard?.overview.ghost?.avgConfidence || 0) * 100).toFixed(0)}%
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Economic Cortex</CardTitle>
                <DollarSign className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {dashboard?.overview.economic?.negotiationStrategy || 'N/A'}
                </div>
                <p className="text-xs text-muted-foreground">
                  Strategy mode
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Compute Location Distribution */}
          <Card>
            <CardHeader>
              <CardTitle>Compute Location Distribution</CardTitle>
              <CardDescription>Where AI tasks are executed</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-4 gap-4">
                {['browser', 'local', 'edge', 'cloud'].map((location) => (
                  <div key={location} className="flex items-center gap-3 p-4 border rounded-lg">
                    {getLocationIcon(location)}
                    <div>
                      <div className="font-medium capitalize">{location}</div>
                      <div className="text-2xl font-bold">
                        {dashboard?.overview.compute?.locationDistribution?.[location] || 0}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Tool Categories */}
          <Card>
            <CardHeader>
              <CardTitle>Tools by Category</CardTitle>
              <CardDescription>Distribution of registered tool schemas</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-5 gap-2">
                {Object.entries(dashboard?.overview.tools?.byCategory || {}).map(([category, count]) => (
                  <div key={category} className="p-3 border rounded-lg text-center">
                    <div className="text-xs text-muted-foreground capitalize">
                      {category.replace('_', ' ')}
                    </div>
                    <div className="text-xl font-bold">{count}</div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* MCP Servers Tab */}
        <TabsContent value="mcp-servers" className="space-y-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Search className="h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search servers..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-64"
              />
            </div>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Add Server
            </Button>
          </div>

          <div className="grid gap-4">
            {servers
              .filter(s => s.name.toLowerCase().includes(searchQuery.toLowerCase()))
              .map((server) => (
                <Card key={server.serverId}>
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        {getHealthIcon(server.healthStatus)}
                        <div>
                          <CardTitle className="text-lg">{server.name}</CardTitle>
                          <CardDescription>{server.description}</CardDescription>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant="outline">{server.transport}</Badge>
                        <Badge variant={server.healthStatus === 'healthy' ? 'default' : 'destructive'}>
                          {server.healthStatus}
                        </Badge>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-4 gap-4 text-sm">
                      <div>
                        <div className="text-muted-foreground">Avg Latency</div>
                        <div className="font-medium">{server.avgLatencyMs.toFixed(0)}ms</div>
                      </div>
                      <div>
                        <div className="text-muted-foreground">Error Rate</div>
                        <div className="font-medium">{(server.errorRate * 100).toFixed(1)}%</div>
                      </div>
                      <div>
                        <div className="text-muted-foreground">Calls Today</div>
                        <div className="font-medium">{server.totalCallsToday}</div>
                      </div>
                      <div>
                        <div className="text-muted-foreground">Domains</div>
                        <div className="flex gap-1 flex-wrap">
                          {server.domainAffinity.slice(0, 3).map((d) => (
                            <Badge key={d} variant="secondary" className="text-xs">{d}</Badge>
                          ))}
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
          </div>
        </TabsContent>

        {/* Tools Tab */}
        <TabsContent value="tools" className="space-y-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Search className="h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search tools..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-64"
              />
            </div>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Register Tool
            </Button>
          </div>

          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {tools
              .filter(t => t.name.toLowerCase().includes(searchQuery.toLowerCase()))
              .map((tool) => (
                <Card key={tool.toolId}>
                  <CardHeader className="pb-2">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-base">{tool.name}</CardTitle>
                      <Badge variant="outline">{tool.category.replace('_', ' ')}</Badge>
                    </div>
                    <CardDescription className="line-clamp-2">{tool.description}</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Success Rate</span>
                        <span className="font-medium">{(tool.successRate * 100).toFixed(0)}%</span>
                      </div>
                      <Progress value={tool.successRate * 100} className="h-1" />
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Avg Execution</span>
                        <span className="font-medium">{tool.avgExecutionMs.toFixed(0)}ms</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Usage Count</span>
                        <span className="font-medium">{tool.usageCount}</span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
          </div>
        </TabsContent>

        {/* Tool Forge Tab */}
        <TabsContent value="tool-forge" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Sparkles className="h-5 w-5" />
                Tool Forge Pipeline
              </CardTitle>
              <CardDescription>
                Generate new tools on-demand from API documentation
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4">
                <div className="space-y-2">
                  <Label>Target Service URL</Label>
                  <Input placeholder="https://api.example.com" />
                </div>
                <div className="space-y-2">
                  <Label>Capability Description</Label>
                  <Input placeholder="What should the tool do?" />
                </div>
                <div className="space-y-2">
                  <Label>Natural Language Specification</Label>
                  <textarea 
                    className="w-full min-h-[100px] rounded-md border border-input bg-background px-3 py-2 text-sm"
                    placeholder="Describe the tool's purpose and expected behavior in detail..."
                  />
                </div>
                <Button className="w-full">
                  <Zap className="h-4 w-4 mr-2" />
                  Generate Tool
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Recent Generation Requests</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-center py-8 text-muted-foreground">
                No recent tool generation requests
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Compute Tab */}
        <TabsContent value="compute" className="space-y-6">
          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Monitor className="h-5 w-5" />
                  Browser Capabilities
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex justify-between">
                  <span>WASM Support</span>
                  <Badge variant="default">Enabled</Badge>
                </div>
                <div className="flex justify-between">
                  <span>WebGPU Support</span>
                  <Badge variant="secondary">Disabled</Badge>
                </div>
                <div className="flex justify-between">
                  <span>Max Memory</span>
                  <span className="font-medium">2048 MB</span>
                </div>
                <div className="flex justify-between">
                  <span>Compute Score</span>
                  <span className="font-medium">0.5</span>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Cpu className="h-5 w-5" />
                  Local Capabilities
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex justify-between">
                  <span>Platform</span>
                  <Badge variant="outline">macOS</Badge>
                </div>
                <div className="flex justify-between">
                  <span>GPU Available</span>
                  <Badge variant="secondary">No</Badge>
                </div>
                <div className="flex justify-between">
                  <span>Memory</span>
                  <span className="font-medium">16 GB</span>
                </div>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Sensitivity Location Rules</CardTitle>
              <CardDescription>Where different sensitivity levels can execute</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {[
                  { level: 'public', locations: ['browser', 'local', 'edge', 'cloud'] },
                  { level: 'internal', locations: ['local', 'edge', 'cloud'] },
                  { level: 'confidential', locations: ['local', 'cloud'] },
                  { level: 'restricted', locations: ['local'] },
                ].map((rule) => (
                  <div key={rule.level} className="flex items-center justify-between p-3 border rounded-lg">
                    <Badge variant="outline" className="capitalize">{rule.level}</Badge>
                    <div className="flex gap-2">
                      {rule.locations.map((loc) => (
                        <div key={loc} className="flex items-center gap-1 text-sm">
                          {getLocationIcon(loc)}
                          <span className="capitalize">{loc}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Ghost Tab */}
        <TabsContent value="ghost" className="space-y-6">
          <div className="grid gap-4 md:grid-cols-3">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Total Simulations</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold">
                  {dashboard?.overview.ghost?.totalSimulations || 0}
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Average Confidence</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold">
                  {((dashboard?.overview.ghost?.avgConfidence || 0) * 100).toFixed(0)}%
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Prediction Accuracy</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold">--%</div>
                <p className="text-xs text-muted-foreground">Requires calibration data</p>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Brain className="h-5 w-5" />
                Run Ghost Simulation
              </CardTitle>
              <CardDescription>
                Predict user reaction or outcome before execution
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label>Simulation Type</Label>
                  <select className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm">
                    <option value="user_reaction">User Reaction</option>
                    <option value="outcome_prediction">Outcome Prediction</option>
                    <option value="safety_check">Safety Check</option>
                    <option value="cost_estimation">Cost Estimation</option>
                    <option value="latency_estimation">Latency Estimation</option>
                  </select>
                </div>
                <div className="space-y-2">
                  <Label>Tool ID (optional)</Label>
                  <Input placeholder="Tool to simulate" />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Proposed Action</Label>
                <textarea 
                  className="w-full min-h-[80px] rounded-md border border-input bg-background px-3 py-2 text-sm"
                  placeholder="Describe the action to simulate..."
                />
              </div>
              <Button className="w-full">
                <Ghost className="h-4 w-4 mr-2" />
                Run Simulation
              </Button>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
