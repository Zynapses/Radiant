'use client';

import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Progress } from '@/components/ui/progress';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Bot,
  Search,
  MoreVertical,
  Play,
  Pause,
  RefreshCw,
  Settings,
  Activity,
  Cpu,
  Clock,
  CheckCircle2,
  AlertTriangle,
  XCircle,
} from 'lucide-react';

interface Agent {
  id: string;
  name: string;
  type: string;
  status: 'active' | 'idle' | 'error' | 'paused';
  cpuUsage: number;
  memoryUsage: number;
  tasksCompleted: number;
  lastActive: string;
  uptime: string;
}

const mockAgents: Agent[] = [
  { id: '1', name: 'DataProcessor', type: 'ETL', status: 'active', cpuUsage: 45, memoryUsage: 62, tasksCompleted: 1234, lastActive: '2 min ago', uptime: '99.9%' },
  { id: '2', name: 'AnalyticsEngine', type: 'Analysis', status: 'active', cpuUsage: 72, memoryUsage: 58, tasksCompleted: 856, lastActive: '1 min ago', uptime: '99.7%' },
  { id: '3', name: 'DocumentParser', type: 'NLP', status: 'idle', cpuUsage: 5, memoryUsage: 20, tasksCompleted: 2341, lastActive: '15 min ago', uptime: '99.8%' },
  { id: '4', name: 'CodeAssistant', type: 'Development', status: 'active', cpuUsage: 38, memoryUsage: 45, tasksCompleted: 567, lastActive: 'Just now', uptime: '99.9%' },
  { id: '5', name: 'SecurityScanner', type: 'Security', status: 'paused', cpuUsage: 0, memoryUsage: 10, tasksCompleted: 789, lastActive: '1 hour ago', uptime: '98.5%' },
  { id: '6', name: 'ImageProcessor', type: 'Vision', status: 'error', cpuUsage: 0, memoryUsage: 0, tasksCompleted: 432, lastActive: '30 min ago', uptime: '95.2%' },
];

const statusConfig = {
  active: { color: 'bg-green-500', icon: CheckCircle2, label: 'Active' },
  idle: { color: 'bg-blue-500', icon: Clock, label: 'Idle' },
  paused: { color: 'bg-amber-500', icon: Pause, label: 'Paused' },
  error: { color: 'bg-red-500', icon: XCircle, label: 'Error' },
};

export default function SovereignMeshAgentsPage() {
  const [searchQuery, setSearchQuery] = useState('');

  const { data: agents = mockAgents } = useQuery({
    queryKey: ['sovereign-mesh', 'agents'],
    queryFn: async () => mockAgents,
  });

  const filteredAgents = agents.filter(agent =>
    agent.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    agent.type.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const stats = {
    total: agents.length,
    active: agents.filter(a => a.status === 'active').length,
    idle: agents.filter(a => a.status === 'idle').length,
    error: agents.filter(a => a.status === 'error').length,
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Bot className="h-6 w-6" />
            Sovereign Mesh Agents
          </h1>
          <p className="text-muted-foreground">
            Monitor and control AI agents in your mesh network
          </p>
        </div>
        <Button>
          <Bot className="h-4 w-4 mr-2" />
          Deploy New Agent
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-2xl font-bold">{stats.total}</p>
                <p className="text-sm text-muted-foreground">Total Agents</p>
              </div>
              <Bot className="h-8 w-8 text-muted-foreground" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-2xl font-bold text-green-600">{stats.active}</p>
                <p className="text-sm text-muted-foreground">Active</p>
              </div>
              <CheckCircle2 className="h-8 w-8 text-green-500" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-2xl font-bold text-blue-600">{stats.idle}</p>
                <p className="text-sm text-muted-foreground">Idle</p>
              </div>
              <Clock className="h-8 w-8 text-blue-500" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-2xl font-bold text-red-600">{stats.error}</p>
                <p className="text-sm text-muted-foreground">Errors</p>
              </div>
              <AlertTriangle className="h-8 w-8 text-red-500" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Search */}
      <Card>
        <CardContent className="py-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search agents..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>
        </CardContent>
      </Card>

      {/* Agents Table */}
      <Card>
        <CardHeader>
          <CardTitle>All Agents</CardTitle>
          <CardDescription>Manage your deployed AI agents</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Agent</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>CPU</TableHead>
                <TableHead>Memory</TableHead>
                <TableHead>Tasks</TableHead>
                <TableHead>Uptime</TableHead>
                <TableHead>Last Active</TableHead>
                <TableHead className="w-12"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredAgents.map((agent) => {
                const status = statusConfig[agent.status];
                return (
                  <TableRow key={agent.id}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Bot className="h-4 w-4" />
                        <span className="font-medium">{agent.name}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">{agent.type}</Badge>
                    </TableCell>
                    <TableCell>
                      <Badge className={status.color}>
                        <status.icon className="h-3 w-3 mr-1" />
                        {status.label}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Progress value={agent.cpuUsage} className="w-16 h-2" />
                        <span className="text-sm">{agent.cpuUsage}%</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Progress value={agent.memoryUsage} className="w-16 h-2" />
                        <span className="text-sm">{agent.memoryUsage}%</span>
                      </div>
                    </TableCell>
                    <TableCell>{agent.tasksCompleted.toLocaleString()}</TableCell>
                    <TableCell>{agent.uptime}</TableCell>
                    <TableCell className="text-muted-foreground">{agent.lastActive}</TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon">
                            <MoreVertical className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem>
                            <Activity className="h-4 w-4 mr-2" />
                            View Metrics
                          </DropdownMenuItem>
                          <DropdownMenuItem>
                            <Settings className="h-4 w-4 mr-2" />
                            Configure
                          </DropdownMenuItem>
                          <DropdownMenuItem>
                            <RefreshCw className="h-4 w-4 mr-2" />
                            Restart
                          </DropdownMenuItem>
                          {agent.status === 'active' ? (
                            <DropdownMenuItem>
                              <Pause className="h-4 w-4 mr-2" />
                              Pause
                            </DropdownMenuItem>
                          ) : (
                            <DropdownMenuItem>
                              <Play className="h-4 w-4 mr-2" />
                              Resume
                            </DropdownMenuItem>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
