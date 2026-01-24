'use client';

import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Progress } from '@/components/ui/progress';
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
  Wand2,
  Search,
  TrendingUp,
  Clock,
  CheckCircle2,
  XCircle,
  Loader2,
  Code,
  FileText,
  BarChart3,
  MessageSquare,
  Zap,
  ThumbsUp,
  ThumbsDown,
} from 'lucide-react';

interface AIRequest {
  id: string;
  timestamp: string;
  user: string;
  type: 'code' | 'analysis' | 'summary' | 'query' | 'other';
  prompt: string;
  status: 'completed' | 'failed' | 'processing';
  duration: number;
  tokens: number;
  rating: number | null;
}

const defaultRequests: AIRequest[] = [];

const typeConfig = {
  code: { icon: Code, color: 'bg-purple-500', label: 'Code' },
  analysis: { icon: BarChart3, color: 'bg-blue-500', label: 'Analysis' },
  summary: { icon: FileText, color: 'bg-green-500', label: 'Summary' },
  query: { icon: Search, color: 'bg-amber-500', label: 'Query' },
  other: { icon: MessageSquare, color: 'bg-gray-500', label: 'Other' },
};

const statusConfig = {
  completed: { icon: CheckCircle2, color: 'text-green-500', label: 'Completed' },
  failed: { icon: XCircle, color: 'text-red-500', label: 'Failed' },
  processing: { icon: Loader2, color: 'text-blue-500', label: 'Processing' },
};

export default function SovereignMeshAIHelperPage() {
  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState<string>('all');

  const { data: requests = defaultRequests } = useQuery<AIRequest[]>({
    queryKey: ['sovereign-mesh', 'ai-helper'],
    queryFn: async () => {
      const res = await fetch('/api/thinktank-admin/sovereign-mesh/ai-helper/requests');
      if (!res.ok) return defaultRequests;
      return res.json();
    },
  });

  const filteredRequests = requests.filter(req => {
    if (searchQuery && !req.prompt.toLowerCase().includes(searchQuery.toLowerCase()) && 
        !req.user.toLowerCase().includes(searchQuery.toLowerCase())) {
      return false;
    }
    if (typeFilter !== 'all' && req.type !== typeFilter) return false;
    return true;
  });

  const stats = {
    total: requests.length,
    completed: requests.filter(r => r.status === 'completed').length,
    avgDuration: Math.round(requests.filter(r => r.status === 'completed').reduce((sum, r) => sum + r.duration, 0) / requests.filter(r => r.status === 'completed').length),
    totalTokens: requests.reduce((sum, r) => sum + r.tokens, 0),
    avgRating: requests.filter(r => r.rating !== null).reduce((sum, r) => sum + (r.rating || 0), 0) / requests.filter(r => r.rating !== null).length,
  };

  const formatDate = (date: string) => {
    return new Date(date).toLocaleString('en-US', {
      month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
    });
  };

  const formatDuration = (ms: number) => {
    if (ms === 0) return '-';
    if (ms < 1000) return `${ms}ms`;
    return `${(ms / 1000).toFixed(1)}s`;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Wand2 className="h-6 w-6" />
            AI Helper
          </h1>
          <p className="text-muted-foreground">
            Monitor AI assistance requests and performance across the mesh
          </p>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-5 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-lg bg-purple-100 dark:bg-purple-900/30">
                <Wand2 className="h-5 w-5 text-purple-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.total}</p>
                <p className="text-sm text-muted-foreground">Total Requests</p>
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
                <p className="text-2xl font-bold">{Math.round((stats.completed / stats.total) * 100)}%</p>
                <p className="text-sm text-muted-foreground">Success Rate</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-lg bg-blue-100 dark:bg-blue-900/30">
                <Clock className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{formatDuration(stats.avgDuration)}</p>
                <p className="text-sm text-muted-foreground">Avg Duration</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-lg bg-amber-100 dark:bg-amber-900/30">
                <Zap className="h-5 w-5 text-amber-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.totalTokens.toLocaleString()}</p>
                <p className="text-sm text-muted-foreground">Tokens Used</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-lg bg-pink-100 dark:bg-pink-900/30">
                <ThumbsUp className="h-5 w-5 text-pink-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.avgRating.toFixed(1)}/5</p>
                <p className="text-sm text-muted-foreground">Avg Rating</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Request Type Distribution */}
      <div className="grid grid-cols-5 gap-4">
        {Object.entries(typeConfig).map(([key, config]) => {
          const count = requests.filter(r => r.type === key).length;
          const percentage = (count / requests.length) * 100;
          return (
            <Card key={key} className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => setTypeFilter(key === typeFilter ? 'all' : key)}>
              <CardContent className="pt-6">
                <div className="flex items-center justify-between mb-2">
                  <div className={`p-2 rounded-lg ${config.color} text-white`}>
                    <config.icon className="h-4 w-4" />
                  </div>
                  <span className="text-lg font-bold">{count}</span>
                </div>
                <p className="text-sm font-medium">{config.label}</p>
                <Progress value={percentage} className="h-1 mt-2" />
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Requests Table */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Recent Requests</CardTitle>
              <CardDescription>All AI helper requests from users</CardDescription>
            </div>
            <div className="relative w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search requests..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Time</TableHead>
                <TableHead>User</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Prompt</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Duration</TableHead>
                <TableHead>Tokens</TableHead>
                <TableHead>Rating</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredRequests.map((request) => {
                const type = typeConfig[request.type];
                const status = statusConfig[request.status];
                return (
                  <TableRow key={request.id}>
                    <TableCell className="whitespace-nowrap text-sm">
                      {formatDate(request.timestamp)}
                    </TableCell>
                    <TableCell className="text-sm">{request.user}</TableCell>
                    <TableCell>
                      <Badge className={type.color}>
                        <type.icon className="h-3 w-3 mr-1" />
                        {type.label}
                      </Badge>
                    </TableCell>
                    <TableCell className="max-w-xs truncate text-sm">{request.prompt}</TableCell>
                    <TableCell>
                      <div className={`flex items-center gap-1 ${status.color}`}>
                        <status.icon className={`h-4 w-4 ${request.status === 'processing' ? 'animate-spin' : ''}`} />
                        <span className="text-sm">{status.label}</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-sm">{formatDuration(request.duration)}</TableCell>
                    <TableCell className="text-sm">{request.tokens.toLocaleString()}</TableCell>
                    <TableCell>
                      {request.rating !== null ? (
                        <div className="flex items-center gap-1">
                          {[1, 2, 3, 4, 5].map((star) => (
                            <div
                              key={star}
                              className={`w-2 h-2 rounded-full ${star <= request.rating! ? 'bg-amber-400' : 'bg-gray-200'}`}
                            />
                          ))}
                        </div>
                      ) : (
                        <span className="text-muted-foreground text-sm">-</span>
                      )}
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
