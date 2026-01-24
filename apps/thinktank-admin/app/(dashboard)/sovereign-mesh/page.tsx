'use client';

import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import {
  Network,
  Bot,
  AppWindow,
  Eye,
  Wand2,
  ClipboardCheck,
  Activity,
  Zap,
  Shield,
  TrendingUp,
  Clock,
  Users,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
} from 'lucide-react';
import Link from 'next/link';

interface MeshStats {
  totalAgents: number;
  activeAgents: number;
  totalApps: number;
  activeApps: number;
  pendingApprovals: number;
  transparencyScore: number;
  aiHelperRequests: number;
  healthScore: number;
}

const defaultStats: MeshStats = {
  totalAgents: 0,
  activeAgents: 0,
  totalApps: 0,
  activeApps: 0,
  pendingApprovals: 0,
  transparencyScore: 0,
  aiHelperRequests: 0,
  healthScore: 0,
};

const quickLinks = [
  { name: 'Agents', href: '/sovereign-mesh/agents', icon: Bot, description: 'Manage AI agents', count: 24 },
  { name: 'Apps', href: '/sovereign-mesh/apps', icon: AppWindow, description: 'View deployed apps', count: 12 },
  { name: 'Transparency', href: '/sovereign-mesh/transparency', icon: Eye, description: 'Audit trail & logs', count: null },
  { name: 'AI Helper', href: '/sovereign-mesh/ai-helper', icon: Wand2, description: 'AI assistance requests', count: 156 },
  { name: 'Approvals', href: '/sovereign-mesh/approvals', icon: ClipboardCheck, description: 'Pending approvals', count: 3 },
];

export default function SovereignMeshPage() {
  const { data: stats = defaultStats } = useQuery({
    queryKey: ['sovereign-mesh', 'overview'],
    queryFn: async () => {
      const res = await fetch('/api/thinktank-admin/sovereign-mesh/overview');
      if (!res.ok) return defaultStats;
      return res.json();
    },
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Network className="h-6 w-6" />
          Sovereign Mesh Overview
        </h1>
        <p className="text-muted-foreground">
          Monitor and manage your decentralized AI agent network
        </p>
      </div>

      {/* Stats Grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-lg bg-blue-100 dark:bg-blue-900/30">
                <Bot className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.activeAgents}/{stats.totalAgents}</p>
                <p className="text-sm text-muted-foreground">Active Agents</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-lg bg-green-100 dark:bg-green-900/30">
                <AppWindow className="h-5 w-5 text-green-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.activeApps}/{stats.totalApps}</p>
                <p className="text-sm text-muted-foreground">Active Apps</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-lg bg-amber-100 dark:bg-amber-900/30">
                <ClipboardCheck className="h-5 w-5 text-amber-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.pendingApprovals}</p>
                <p className="text-sm text-muted-foreground">Pending Approvals</p>
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
                <p className="text-2xl font-bold">{stats.healthScore}%</p>
                <p className="text-sm text-muted-foreground">Health Score</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Quick Links */}
      <div className="grid grid-cols-5 gap-4">
        {quickLinks.map((link) => (
          <Link key={link.name} href={link.href}>
            <Card className="hover:shadow-md transition-shadow cursor-pointer h-full">
              <CardContent className="pt-6">
                <div className="flex flex-col items-center text-center gap-3">
                  <div className="p-3 rounded-lg bg-muted">
                    <link.icon className="h-6 w-6" />
                  </div>
                  <div>
                    <p className="font-medium">{link.name}</p>
                    <p className="text-xs text-muted-foreground">{link.description}</p>
                  </div>
                  {link.count !== null && (
                    <Badge variant="secondary">{link.count}</Badge>
                  )}
                </div>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>

      {/* Transparency & Health */}
      <div className="grid grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Eye className="h-5 w-5" />
              Transparency Score
            </CardTitle>
            <CardDescription>Overall system transparency rating</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-3xl font-bold">{stats.transparencyScore}%</span>
                <Badge variant="default" className="bg-green-500">Excellent</Badge>
              </div>
              <Progress value={stats.transparencyScore} className="h-2" />
              <div className="grid grid-cols-3 gap-4 pt-4 border-t">
                <div className="text-center">
                  <CheckCircle2 className="h-5 w-5 mx-auto text-green-500 mb-1" />
                  <p className="text-sm font-medium">Audit Logs</p>
                  <p className="text-xs text-muted-foreground">Complete</p>
                </div>
                <div className="text-center">
                  <CheckCircle2 className="h-5 w-5 mx-auto text-green-500 mb-1" />
                  <p className="text-sm font-medium">Decision Trail</p>
                  <p className="text-xs text-muted-foreground">Tracked</p>
                </div>
                <div className="text-center">
                  <CheckCircle2 className="h-5 w-5 mx-auto text-green-500 mb-1" />
                  <p className="text-sm font-medium">Data Access</p>
                  <p className="text-xs text-muted-foreground">Logged</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Wand2 className="h-5 w-5" />
              AI Helper Activity
            </CardTitle>
            <CardDescription>Recent AI assistance requests</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-3xl font-bold">{stats.aiHelperRequests}</span>
                <Badge variant="secondary">This Week</Badge>
              </div>
              <div className="space-y-2">
                {[
                  { task: 'Code generation', count: 45, trend: '+12%' },
                  { task: 'Data analysis', count: 38, trend: '+8%' },
                  { task: 'Document summary', count: 32, trend: '+15%' },
                  { task: 'Query optimization', count: 28, trend: '+5%' },
                ].map((item) => (
                  <div key={item.task} className="flex items-center justify-between py-2 border-b last:border-0">
                    <span className="text-sm">{item.task}</span>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium">{item.count}</span>
                      <span className="text-xs text-green-600">{item.trend}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Recent Activity */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5" />
            Recent Mesh Activity
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {[
              { icon: Bot, text: 'Agent "DataProcessor" completed task batch', time: '2 min ago', type: 'success' },
              { icon: ClipboardCheck, text: 'New deployment approval requested', time: '15 min ago', type: 'warning' },
              { icon: AppWindow, text: 'App "Analytics Dashboard" scaled up', time: '32 min ago', type: 'info' },
              { icon: Shield, text: 'Security scan completed - no issues', time: '1 hour ago', type: 'success' },
              { icon: Users, text: 'New user granted mesh access', time: '2 hours ago', type: 'info' },
            ].map((activity, i) => (
              <div key={i} className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
                <activity.icon className={`h-5 w-5 ${
                  activity.type === 'success' ? 'text-green-500' :
                  activity.type === 'warning' ? 'text-amber-500' : 'text-blue-500'
                }`} />
                <div className="flex-1">
                  <p className="text-sm">{activity.text}</p>
                </div>
                <span className="text-xs text-muted-foreground">{activity.time}</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
