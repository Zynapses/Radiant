'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Search, Eye, Brain, GitBranch, Shield, Zap, Scale, FileText, CheckCircle, XCircle, RefreshCw } from 'lucide-react';

interface MethodDefinition {
  methodId: string;
  name: string;
  description: string;
  methodType: string;
  version: string;
  capabilities: string[];
  outputTypes: string[];
  typicalPredecessors: string[];
  typicalSuccessors: string[];
  outputSchemaRef?: string;
  estimatedCostCents: number;
  estimatedDurationMs: number;
  riskCategory: string;
  enabled: boolean;
}

interface SchemaDefinition {
  schemaRefId: string;
  schemaName: string;
  version: string;
  usedByOutputTypes: string[];
  scope: string;
}

interface ToolDefinition {
  toolId: string;
  toolName: string;
  description: string;
  mcpServer: string;
  riskCategory: string;
  supportsDeRun: boolean;
  isReversible: boolean;
  estimatedCostCents: number;
  category: string;
  enabled: boolean;
}

const methodTypeIcons: Record<string, React.ReactNode> = {
  OBSERVER: <Eye className="h-4 w-4" />,
  PROPOSER: <GitBranch className="h-4 w-4" />,
  CRITIC: <Shield className="h-4 w-4" />,
  VALIDATOR: <Scale className="h-4 w-4" />,
  EXECUTOR: <Zap className="h-4 w-4" />,
  DECIDER: <Brain className="h-4 w-4" />,
  ROUTER: <RefreshCw className="h-4 w-4" />,
  PLANNER: <FileText className="h-4 w-4" />,
};

const riskColors: Record<string, string> = {
  NONE: 'bg-gray-500',
  LOW: 'bg-green-500',
  MEDIUM: 'bg-yellow-500',
  HIGH: 'bg-orange-500',
  CRITICAL: 'bg-red-500',
};

export default function CatoMethodsPage() {
  const [methods, setMethods] = useState<MethodDefinition[]>([]);
  const [schemas, setSchemas] = useState<SchemaDefinition[]>([]);
  const [tools, setTools] = useState<ToolDefinition[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedMethod, setSelectedMethod] = useState<MethodDefinition | null>(null);
  const [selectedTool, setSelectedTool] = useState<ToolDefinition | null>(null);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [methodsRes, schemasRes, toolsRes] = await Promise.all([
        fetch('/api/admin/cato/pipeline/methods'),
        fetch('/api/admin/cato/pipeline/schemas'),
        fetch('/api/admin/cato/pipeline/tools'),
      ]);

      if (methodsRes.ok) {
        const methodsData = await methodsRes.json();
        setMethods(methodsData);
      }
      if (schemasRes.ok) {
        const schemasData = await schemasRes.json();
        setSchemas(schemasData);
      }
      if (toolsRes.ok) {
        const toolsData = await toolsRes.json();
        setTools(toolsData);
      }
      setLoading(false);
    } catch (error) {
      console.error('Failed to fetch data:', error);
      setLoading(false);
    }
  };

  const filteredMethods = methods.filter(m => 
    m.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    m.methodId.toLowerCase().includes(searchTerm.toLowerCase()) ||
    m.methodType.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const filteredTools = tools.filter(t =>
    t.toolName.toLowerCase().includes(searchTerm.toLowerCase()) ||
    t.toolId.toLowerCase().includes(searchTerm.toLowerCase()) ||
    t.category.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (loading) {
    return <div className="flex items-center justify-center h-64"><RefreshCw className="h-8 w-8 animate-spin" /></div>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Method & Tool Registry</h1>
        <p className="text-muted-foreground">Manage pipeline methods, schemas, and tools</p>
      </div>

      <div className="flex items-center gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search methods, tools..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="pl-10" />
        </div>
        <div className="flex gap-2">
          <Badge variant="secondary">{methods.length} Methods</Badge>
          <Badge variant="secondary">{schemas.length} Schemas</Badge>
          <Badge variant="secondary">{tools.length} Tools</Badge>
        </div>
      </div>

      <Tabs defaultValue="methods">
        <TabsList>
          <TabsTrigger value="methods">Methods</TabsTrigger>
          <TabsTrigger value="schemas">Schemas</TabsTrigger>
          <TabsTrigger value="tools">Tools</TabsTrigger>
        </TabsList>

        <TabsContent value="methods" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Method Definitions</CardTitle>
              <CardDescription>Composable AI methods for pipeline execution</CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Method</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Capabilities</TableHead>
                    <TableHead>Output Types</TableHead>
                    <TableHead>Cost</TableHead>
                    <TableHead>Duration</TableHead>
                    <TableHead>Risk</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredMethods.map(method => (
                    <TableRow key={method.methodId}>
                      <TableCell>
                        <div>
                          <p className="font-medium">{method.name}</p>
                          <p className="text-xs text-muted-foreground font-mono">{method.methodId}</p>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="flex items-center gap-1 w-fit">
                          {methodTypeIcons[method.methodType]}
                          {method.methodType}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1">
                          {method.capabilities.slice(0, 2).map((c, i) => <Badge key={i} variant="secondary" className="text-xs">{c}</Badge>)}
                          {method.capabilities.length > 2 && <Badge variant="secondary" className="text-xs">+{method.capabilities.length - 2}</Badge>}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1">
                          {method.outputTypes.map((t, i) => <Badge key={i} className="text-xs">{t}</Badge>)}
                        </div>
                      </TableCell>
                      <TableCell>${(method.estimatedCostCents / 100).toFixed(2)}</TableCell>
                      <TableCell>{(method.estimatedDurationMs / 1000).toFixed(1)}s</TableCell>
                      <TableCell><Badge className={`${riskColors[method.riskCategory]} text-white text-xs`}>{method.riskCategory}</Badge></TableCell>
                      <TableCell>{method.enabled ? <CheckCircle className="h-4 w-4 text-green-500" /> : <XCircle className="h-4 w-4 text-red-500" />}</TableCell>
                      <TableCell><Button size="sm" variant="ghost" onClick={() => setSelectedMethod(method)}><Eye className="h-4 w-4" /></Button></TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="schemas" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Schema Definitions</CardTitle>
              <CardDescription>JSON Schema definitions for method outputs</CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Schema</TableHead>
                    <TableHead>Version</TableHead>
                    <TableHead>Used By Output Types</TableHead>
                    <TableHead>Scope</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {schemas.map(schema => (
                    <TableRow key={schema.schemaRefId}>
                      <TableCell>
                        <div>
                          <p className="font-medium">{schema.schemaName}</p>
                          <p className="text-xs text-muted-foreground font-mono">{schema.schemaRefId}</p>
                        </div>
                      </TableCell>
                      <TableCell><Badge variant="outline">{schema.version}</Badge></TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1">
                          {schema.usedByOutputTypes.map((t, i) => <Badge key={i}>{t}</Badge>)}
                        </div>
                      </TableCell>
                      <TableCell><Badge variant="secondary">{schema.scope}</Badge></TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="tools" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Tool Definitions</CardTitle>
              <CardDescription>Lambda and MCP tools for method execution</CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Tool</TableHead>
                    <TableHead>Category</TableHead>
                    <TableHead>Server</TableHead>
                    <TableHead>Risk</TableHead>
                    <TableHead>Dry Run</TableHead>
                    <TableHead>Reversible</TableHead>
                    <TableHead>Cost</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredTools.map(tool => (
                    <TableRow key={tool.toolId}>
                      <TableCell>
                        <div>
                          <p className="font-medium">{tool.toolName}</p>
                          <p className="text-xs text-muted-foreground font-mono">{tool.toolId}</p>
                        </div>
                      </TableCell>
                      <TableCell><Badge variant="outline">{tool.category}</Badge></TableCell>
                      <TableCell className="font-mono text-xs">{tool.mcpServer.replace('lambda://', '')}</TableCell>
                      <TableCell><Badge className={`${riskColors[tool.riskCategory]} text-white text-xs`}>{tool.riskCategory}</Badge></TableCell>
                      <TableCell>{tool.supportsDeRun ? <CheckCircle className="h-4 w-4 text-green-500" /> : <XCircle className="h-4 w-4 text-gray-400" />}</TableCell>
                      <TableCell>{tool.isReversible ? <CheckCircle className="h-4 w-4 text-green-500" /> : <XCircle className="h-4 w-4 text-gray-400" />}</TableCell>
                      <TableCell>${(tool.estimatedCostCents / 100).toFixed(2)}</TableCell>
                      <TableCell>{tool.enabled ? <CheckCircle className="h-4 w-4 text-green-500" /> : <XCircle className="h-4 w-4 text-red-500" />}</TableCell>
                      <TableCell><Button size="sm" variant="ghost" onClick={() => setSelectedTool(tool)}><Eye className="h-4 w-4" /></Button></TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {selectedMethod && (
        <Dialog open={!!selectedMethod} onOpenChange={() => setSelectedMethod(null)}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">{methodTypeIcons[selectedMethod.methodType]} {selectedMethod.name}</DialogTitle>
              <DialogDescription>{selectedMethod.description}</DialogDescription>
            </DialogHeader>
            <ScrollArea className="max-h-[60vh]">
              <div className="space-y-4 p-1">
                <div className="grid grid-cols-2 gap-4">
                  <div><p className="text-xs text-muted-foreground">Method ID</p><p className="font-mono text-sm">{selectedMethod.methodId}</p></div>
                  <div><p className="text-xs text-muted-foreground">Version</p><p>{selectedMethod.version}</p></div>
                  <div><p className="text-xs text-muted-foreground">Type</p><Badge variant="outline">{selectedMethod.methodType}</Badge></div>
                  <div><p className="text-xs text-muted-foreground">Risk Category</p><Badge className={`${riskColors[selectedMethod.riskCategory]} text-white`}>{selectedMethod.riskCategory}</Badge></div>
                </div>
                <div><p className="text-xs text-muted-foreground mb-1">Capabilities</p><div className="flex flex-wrap gap-1">{selectedMethod.capabilities.map((c, i) => <Badge key={i} variant="secondary">{c}</Badge>)}</div></div>
                <div><p className="text-xs text-muted-foreground mb-1">Output Schema</p><p className="font-mono text-sm">{selectedMethod.outputSchemaRef}</p></div>
                <div className="grid grid-cols-2 gap-4">
                  <div><p className="text-xs text-muted-foreground mb-1">Typical Predecessors</p>{selectedMethod.typicalPredecessors.length > 0 ? <div className="flex flex-wrap gap-1">{selectedMethod.typicalPredecessors.map((p, i) => <Badge key={i} variant="outline" className="text-xs">{p.split(':')[1]}</Badge>)}</div> : <p className="text-sm text-muted-foreground">None (entry point)</p>}</div>
                  <div><p className="text-xs text-muted-foreground mb-1">Typical Successors</p>{selectedMethod.typicalSuccessors.length > 0 ? <div className="flex flex-wrap gap-1">{selectedMethod.typicalSuccessors.map((s, i) => <Badge key={i} variant="outline" className="text-xs">{s.split(':')[1]}</Badge>)}</div> : <p className="text-sm text-muted-foreground">None (exit point)</p>}</div>
                </div>
              </div>
            </ScrollArea>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
