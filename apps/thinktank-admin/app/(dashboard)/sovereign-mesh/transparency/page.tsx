'use client';

import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
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
import {
  Eye,
  Search,
  Download,
  Filter,
  Clock,
  User,
  Bot,
  Activity,
  Shield,
  FileText,
  Database,
  Network,
  CheckCircle2,
  AlertTriangle,
  Info,
} from 'lucide-react';

interface AuditLog {
  id: string;
  timestamp: string;
  actor: { type: 'user' | 'agent' | 'system'; name: string };
  action: string;
  resource: string;
  details: string;
  severity: 'info' | 'warning' | 'critical';
  outcome: 'success' | 'failure';
}

interface DecisionTrail {
  id: string;
  timestamp: string;
  agent: string;
  decision: string;
  reasoning: string;
  confidence: number;
  inputs: string[];
  outcome: string;
}

const mockAuditLogs: AuditLog[] = [
  { id: '1', timestamp: '2026-01-21T20:45:00Z', actor: { type: 'user', name: 'admin@example.com' }, action: 'DEPLOY_AGENT', resource: 'DataProcessor', details: 'Deployed new agent version v2.1.0', severity: 'info', outcome: 'success' },
  { id: '2', timestamp: '2026-01-21T20:30:00Z', actor: { type: 'agent', name: 'SecurityScanner' }, action: 'SECURITY_SCAN', resource: 'Production Environment', details: 'Completed scheduled security scan', severity: 'info', outcome: 'success' },
  { id: '3', timestamp: '2026-01-21T20:15:00Z', actor: { type: 'system', name: 'AutoScaler' }, action: 'SCALE_UP', resource: 'AnalyticsEngine', details: 'Scaled from 2 to 4 instances due to load', severity: 'warning', outcome: 'success' },
  { id: '4', timestamp: '2026-01-21T20:00:00Z', actor: { type: 'user', name: 'dev@example.com' }, action: 'ACCESS_DATA', resource: 'Customer Database', details: 'Read access to customer records', severity: 'info', outcome: 'success' },
  { id: '5', timestamp: '2026-01-21T19:45:00Z', actor: { type: 'agent', name: 'ImageProcessor' }, action: 'PROCESS_BATCH', resource: 'Image Queue', details: 'Failed to process 3 images due to format error', severity: 'warning', outcome: 'failure' },
  { id: '6', timestamp: '2026-01-21T19:30:00Z', actor: { type: 'system', name: 'HealthMonitor' }, action: 'ALERT_TRIGGERED', resource: 'DataPipeline', details: 'Memory usage exceeded 90% threshold', severity: 'critical', outcome: 'success' },
];

const mockDecisionTrails: DecisionTrail[] = [
  { id: '1', timestamp: '2026-01-21T20:40:00Z', agent: 'CodeAssistant', decision: 'Refactor suggestion', reasoning: 'Detected repeated code pattern in 3 files', confidence: 0.92, inputs: ['code_analysis', 'pattern_detection'], outcome: 'Suggestion accepted' },
  { id: '2', timestamp: '2026-01-21T20:35:00Z', agent: 'DataProcessor', decision: 'Skip invalid records', reasoning: 'Records missing required fields', confidence: 0.98, inputs: ['validation_rules', 'schema_check'], outcome: '12 records skipped' },
  { id: '3', timestamp: '2026-01-21T20:30:00Z', agent: 'AnalyticsEngine', decision: 'Cache refresh', reasoning: 'Cache staleness exceeded 5 minutes', confidence: 0.95, inputs: ['cache_policy', 'data_freshness'], outcome: 'Cache updated' },
];

const severityConfig = {
  info: { color: 'bg-blue-500', icon: Info },
  warning: { color: 'bg-amber-500', icon: AlertTriangle },
  critical: { color: 'bg-red-500', icon: Shield },
};

const actorIcons = {
  user: User,
  agent: Bot,
  system: Network,
};

export default function SovereignMeshTransparencyPage() {
  const [searchQuery, setSearchQuery] = useState('');
  const [severityFilter, setSeverityFilter] = useState<string>('all');
  const [actorFilter, setActorFilter] = useState<string>('all');

  const { data: auditLogs = mockAuditLogs } = useQuery({
    queryKey: ['sovereign-mesh', 'audit-logs'],
    queryFn: async () => mockAuditLogs,
  });

  const { data: decisionTrails = mockDecisionTrails } = useQuery({
    queryKey: ['sovereign-mesh', 'decision-trails'],
    queryFn: async () => mockDecisionTrails,
  });

  const filteredLogs = auditLogs.filter(log => {
    if (searchQuery && !log.action.toLowerCase().includes(searchQuery.toLowerCase()) && 
        !log.resource.toLowerCase().includes(searchQuery.toLowerCase())) {
      return false;
    }
    if (severityFilter !== 'all' && log.severity !== severityFilter) return false;
    if (actorFilter !== 'all' && log.actor.type !== actorFilter) return false;
    return true;
  });

  const formatDate = (date: string) => {
    return new Date(date).toLocaleString('en-US', {
      month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
    });
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Eye className="h-6 w-6" />
            Transparency & Audit
          </h1>
          <p className="text-muted-foreground">
            Complete audit trail and decision transparency for all mesh operations
          </p>
        </div>
        <Button variant="outline">
          <Download className="h-4 w-4 mr-2" />
          Export Logs
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-lg bg-blue-100 dark:bg-blue-900/30">
                <FileText className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{auditLogs.length}</p>
                <p className="text-sm text-muted-foreground">Total Logs</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-lg bg-green-100 dark:bg-green-900/30">
                <CheckCircle2 className="h-5 w-5 text-green-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{auditLogs.filter(l => l.outcome === 'success').length}</p>
                <p className="text-sm text-muted-foreground">Successful</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-lg bg-amber-100 dark:bg-amber-900/30">
                <AlertTriangle className="h-5 w-5 text-amber-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{auditLogs.filter(l => l.severity === 'warning').length}</p>
                <p className="text-sm text-muted-foreground">Warnings</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-lg bg-purple-100 dark:bg-purple-900/30">
                <Activity className="h-5 w-5 text-purple-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{decisionTrails.length}</p>
                <p className="text-sm text-muted-foreground">Decisions Tracked</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="audit" className="space-y-4">
        <TabsList>
          <TabsTrigger value="audit">Audit Logs</TabsTrigger>
          <TabsTrigger value="decisions">Decision Trail</TabsTrigger>
          <TabsTrigger value="data-access">Data Access</TabsTrigger>
        </TabsList>

        <TabsContent value="audit" className="space-y-4">
          {/* Filters */}
          <Card>
            <CardContent className="py-4">
              <div className="flex items-center gap-4">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search logs..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-9"
                  />
                </div>
                <Select value={severityFilter} onValueChange={setSeverityFilter}>
                  <SelectTrigger className="w-40">
                    <SelectValue placeholder="Severity" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Severity</SelectItem>
                    <SelectItem value="info">Info</SelectItem>
                    <SelectItem value="warning">Warning</SelectItem>
                    <SelectItem value="critical">Critical</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={actorFilter} onValueChange={setActorFilter}>
                  <SelectTrigger className="w-40">
                    <SelectValue placeholder="Actor" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Actors</SelectItem>
                    <SelectItem value="user">Users</SelectItem>
                    <SelectItem value="agent">Agents</SelectItem>
                    <SelectItem value="system">System</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>

          {/* Logs Table */}
          <Card>
            <CardContent className="pt-6">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Timestamp</TableHead>
                    <TableHead>Actor</TableHead>
                    <TableHead>Action</TableHead>
                    <TableHead>Resource</TableHead>
                    <TableHead>Details</TableHead>
                    <TableHead>Severity</TableHead>
                    <TableHead>Outcome</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredLogs.map((log) => {
                    const severity = severityConfig[log.severity];
                    const ActorIcon = actorIcons[log.actor.type];
                    return (
                      <TableRow key={log.id}>
                        <TableCell className="whitespace-nowrap">
                          <div className="flex items-center gap-1 text-sm">
                            <Clock className="h-3 w-3" />
                            {formatDate(log.timestamp)}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <ActorIcon className="h-4 w-4" />
                            <span className="text-sm">{log.actor.name}</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">{log.action}</Badge>
                        </TableCell>
                        <TableCell className="text-sm">{log.resource}</TableCell>
                        <TableCell className="text-sm text-muted-foreground max-w-xs truncate">
                          {log.details}
                        </TableCell>
                        <TableCell>
                          <Badge className={severity.color}>
                            <severity.icon className="h-3 w-3 mr-1" />
                            {log.severity}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Badge variant={log.outcome === 'success' ? 'default' : 'destructive'}>
                            {log.outcome}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="decisions" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>AI Decision Trail</CardTitle>
              <CardDescription>Track reasoning and decisions made by AI agents</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {decisionTrails.map((trail) => (
                  <div key={trail.id} className="p-4 rounded-lg border bg-muted/30">
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <Bot className="h-5 w-5" />
                        <span className="font-medium">{trail.agent}</span>
                        <Badge variant="outline">{trail.decision}</Badge>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm text-muted-foreground">{formatDate(trail.timestamp)}</span>
                        <Badge className="bg-green-500">{Math.round(trail.confidence * 100)}% confidence</Badge>
                      </div>
                    </div>
                    <p className="text-sm mb-3">{trail.reasoning}</p>
                    <div className="flex items-center gap-4 text-sm">
                      <div>
                        <span className="text-muted-foreground">Inputs: </span>
                        {trail.inputs.map((input, i) => (
                          <Badge key={i} variant="secondary" className="ml-1">{input}</Badge>
                        ))}
                      </div>
                      <div>
                        <span className="text-muted-foreground">Outcome: </span>
                        <span>{trail.outcome}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="data-access" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Data Access Logs</CardTitle>
              <CardDescription>Track all data access across the mesh</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-center py-12 text-muted-foreground">
                <div className="text-center">
                  <Database className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>Data access logs are tracked in real-time</p>
                  <p className="text-sm">Filter by resource, user, or time range</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
