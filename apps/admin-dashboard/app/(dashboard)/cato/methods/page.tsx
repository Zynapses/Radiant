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
      // Mock data - replace with actual API calls
      setMethods([
        { methodId: 'method:observer:v1', name: 'Observer', description: 'Analyzes incoming requests to classify intent and extract context', methodType: 'OBSERVER', version: '1.0.0', capabilities: ['intent_classification', 'context_extraction', 'domain_detection'], outputTypes: ['CLASSIFICATION', 'ANALYSIS'], typicalPredecessors: [], typicalSuccessors: ['method:router:v1', 'method:proposer:v1'], outputSchemaRef: 'schema:classification:v1', estimatedCostCents: 5, estimatedDurationMs: 2000, riskCategory: 'NONE', enabled: true },
        { methodId: 'method:proposer:v1', name: 'Proposer', description: 'Generates action proposals with reversibility information', methodType: 'PROPOSER', version: '1.0.0', capabilities: ['action_planning', 'tool_selection', 'cost_estimation'], outputTypes: ['PROPOSAL'], typicalPredecessors: ['method:observer:v1'], typicalSuccessors: ['method:critic:security:v1', 'method:validator:v1'], outputSchemaRef: 'schema:proposal:v1', estimatedCostCents: 10, estimatedDurationMs: 5000, riskCategory: 'LOW', enabled: true },
        { methodId: 'method:critic:security:v1', name: 'Security Critic', description: 'Reviews proposals for security vulnerabilities', methodType: 'CRITIC', version: '1.0.0', capabilities: ['security_analysis', 'vulnerability_detection'], outputTypes: ['CRITIQUE'], typicalPredecessors: ['method:proposer:v1'], typicalSuccessors: ['method:decider:v1', 'method:validator:v1'], outputSchemaRef: 'schema:critique:v1', estimatedCostCents: 8, estimatedDurationMs: 4000, riskCategory: 'NONE', enabled: true },
        { methodId: 'method:validator:v1', name: 'Validator (Risk Engine)', description: 'Performs risk assessment with veto logic', methodType: 'VALIDATOR', version: '1.0.0', capabilities: ['risk_assessment', 'triage_decision', 'veto_logic'], outputTypes: ['ASSESSMENT'], typicalPredecessors: ['method:proposer:v1', 'method:critic:security:v1'], typicalSuccessors: ['method:executor:v1'], outputSchemaRef: 'schema:risk-assessment:v1', estimatedCostCents: 5, estimatedDurationMs: 3000, riskCategory: 'NONE', enabled: true },
        { methodId: 'method:executor:v1', name: 'Executor', description: 'Executes approved proposals with compensation logging', methodType: 'EXECUTOR', version: '1.0.0', capabilities: ['tool_invocation', 'compensation_logging', 'rollback'], outputTypes: ['EXECUTION_RESULT'], typicalPredecessors: ['method:validator:v1'], typicalSuccessors: [], outputSchemaRef: 'schema:execution-result:v1', estimatedCostCents: 20, estimatedDurationMs: 10000, riskCategory: 'MEDIUM', enabled: true },
      ]);
      setSchemas([
        { schemaRefId: 'schema:classification:v1', schemaName: 'Classification Output', version: '1.0.0', usedByOutputTypes: ['CLASSIFICATION'], scope: 'SYSTEM' },
        { schemaRefId: 'schema:proposal:v1', schemaName: 'Proposal Output', version: '1.0.0', usedByOutputTypes: ['PROPOSAL'], scope: 'SYSTEM' },
        { schemaRefId: 'schema:critique:v1', schemaName: 'Critique Output', version: '1.0.0', usedByOutputTypes: ['CRITIQUE'], scope: 'SYSTEM' },
        { schemaRefId: 'schema:risk-assessment:v1', schemaName: 'Risk Assessment Output', version: '1.0.0', usedByOutputTypes: ['ASSESSMENT'], scope: 'SYSTEM' },
        { schemaRefId: 'schema:execution-result:v1', schemaName: 'Execution Result Output', version: '1.0.0', usedByOutputTypes: ['EXECUTION_RESULT'], scope: 'SYSTEM' },
      ]);
      setTools([
        { toolId: 'tool:system:echo', toolName: 'Echo', description: 'Simple echo tool for testing', mcpServer: 'lambda://radiant-cato-echo', riskCategory: 'NONE', supportsDeRun: true, isReversible: true, estimatedCostCents: 0, category: 'system', enabled: true },
        { toolId: 'tool:http:request', toolName: 'HTTP Request', description: 'Makes HTTP requests to external APIs', mcpServer: 'lambda://radiant-cato-http', riskCategory: 'MEDIUM', supportsDeRun: true, isReversible: false, estimatedCostCents: 1, category: 'network', enabled: true },
        { toolId: 'tool:file:read', toolName: 'File Read', description: 'Reads content from S3 storage', mcpServer: 'lambda://radiant-cato-file-read', riskCategory: 'LOW', supportsDeRun: true, isReversible: true, estimatedCostCents: 0, category: 'storage', enabled: true },
        { toolId: 'tool:file:write', toolName: 'File Write', description: 'Writes content to S3 storage', mcpServer: 'lambda://radiant-cato-file-write', riskCategory: 'MEDIUM', supportsDeRun: true, isReversible: true, estimatedCostCents: 1, category: 'storage', enabled: true },
        { toolId: 'tool:database:query', toolName: 'Database Query', description: 'Executes read-only SQL queries', mcpServer: 'lambda://radiant-cato-db-query', riskCategory: 'LOW', supportsDeRun: true, isReversible: true, estimatedCostCents: 1, category: 'database', enabled: true },
      ]);
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
