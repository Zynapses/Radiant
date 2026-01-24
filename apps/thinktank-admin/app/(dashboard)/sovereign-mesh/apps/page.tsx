'use client';

import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  AppWindow,
  Search,
  Plus,
  ExternalLink,
  Settings,
  Activity,
  Users,
  Clock,
  CheckCircle2,
  AlertTriangle,
  Pause,
  Play,
  MoreVertical,
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

interface App {
  id: string;
  name: string;
  description: string;
  status: 'running' | 'stopped' | 'deploying' | 'error';
  version: string;
  instances: number;
  users: number;
  lastDeployed: string;
  url: string;
}

const defaultApps: App[] = [];

const statusConfig = {
  running: { color: 'bg-green-500', label: 'Running' },
  stopped: { color: 'bg-gray-500', label: 'Stopped' },
  deploying: { color: 'bg-blue-500', label: 'Deploying' },
  error: { color: 'bg-red-500', label: 'Error' },
};

export default function SovereignMeshAppsPage() {
  const [searchQuery, setSearchQuery] = useState('');

  const { data: apps = defaultApps } = useQuery<App[]>({
    queryKey: ['sovereign-mesh', 'apps'],
    queryFn: async () => {
      const res = await fetch('/api/thinktank-admin/sovereign-mesh/apps');
      if (!res.ok) return defaultApps;
      return res.json();
    },
  });

  const filteredApps = apps.filter(app =>
    app.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    app.description.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const stats = {
    total: apps.length,
    running: apps.filter(a => a.status === 'running').length,
    totalInstances: apps.reduce((sum, a) => sum + a.instances, 0),
    totalUsers: apps.reduce((sum, a) => sum + a.users, 0),
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <AppWindow className="h-6 w-6" />
            Sovereign Mesh Apps
          </h1>
          <p className="text-muted-foreground">
            Deploy and manage applications in your mesh network
          </p>
        </div>
        <Button>
          <Plus className="h-4 w-4 mr-2" />
          Deploy New App
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-2xl font-bold">{stats.total}</p>
                <p className="text-sm text-muted-foreground">Total Apps</p>
              </div>
              <AppWindow className="h-8 w-8 text-muted-foreground" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-2xl font-bold text-green-600">{stats.running}</p>
                <p className="text-sm text-muted-foreground">Running</p>
              </div>
              <CheckCircle2 className="h-8 w-8 text-green-500" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-2xl font-bold">{stats.totalInstances}</p>
                <p className="text-sm text-muted-foreground">Instances</p>
              </div>
              <Activity className="h-8 w-8 text-muted-foreground" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-2xl font-bold">{stats.totalUsers}</p>
                <p className="text-sm text-muted-foreground">Active Users</p>
              </div>
              <Users className="h-8 w-8 text-muted-foreground" />
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
              placeholder="Search apps..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>
        </CardContent>
      </Card>

      {/* Apps Grid */}
      <div className="grid grid-cols-3 gap-4">
        {filteredApps.map((app) => {
          const status = statusConfig[app.status];
          return (
            <Card key={app.id} className="hover:shadow-md transition-shadow">
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-muted">
                      <AppWindow className="h-5 w-5" />
                    </div>
                    <div>
                      <CardTitle className="text-base">{app.name}</CardTitle>
                      <CardDescription className="text-sm">{app.description}</CardDescription>
                    </div>
                  </div>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon">
                        <MoreVertical className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      {app.url && (
                        <DropdownMenuItem onClick={() => window.open(app.url, '_blank')}>
                          <ExternalLink className="h-4 w-4 mr-2" />
                          Open App
                        </DropdownMenuItem>
                      )}
                      <DropdownMenuItem>
                        <Settings className="h-4 w-4 mr-2" />
                        Configure
                      </DropdownMenuItem>
                      <DropdownMenuItem>
                        <Activity className="h-4 w-4 mr-2" />
                        View Metrics
                      </DropdownMenuItem>
                      {app.status === 'running' ? (
                        <DropdownMenuItem>
                          <Pause className="h-4 w-4 mr-2" />
                          Stop
                        </DropdownMenuItem>
                      ) : app.status === 'stopped' && (
                        <DropdownMenuItem>
                          <Play className="h-4 w-4 mr-2" />
                          Start
                        </DropdownMenuItem>
                      )}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <Badge className={status.color}>{status.label}</Badge>
                    <Badge variant="outline">{app.version}</Badge>
                  </div>
                  <div className="grid grid-cols-3 gap-2 text-sm">
                    <div className="text-center p-2 rounded bg-muted">
                      <p className="font-medium">{app.instances}</p>
                      <p className="text-xs text-muted-foreground">Instances</p>
                    </div>
                    <div className="text-center p-2 rounded bg-muted">
                      <p className="font-medium">{app.users}</p>
                      <p className="text-xs text-muted-foreground">Users</p>
                    </div>
                    <div className="text-center p-2 rounded bg-muted">
                      <p className="font-medium text-xs">{app.lastDeployed}</p>
                      <p className="text-xs text-muted-foreground">Deployed</p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
