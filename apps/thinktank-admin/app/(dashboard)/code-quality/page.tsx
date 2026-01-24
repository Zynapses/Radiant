'use client';

import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
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
  FlaskConical,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  TrendingUp,
  TrendingDown,
  Code,
  Shield,
  Zap,
  FileText,
  GitBranch,
  RefreshCw,
} from 'lucide-react';

interface QualityMetric {
  name: string;
  score: number;
  trend: 'up' | 'down' | 'stable';
  issues: number;
}

interface CodeIssue {
  id: string;
  file: string;
  line: number;
  severity: 'error' | 'warning' | 'info';
  rule: string;
  message: string;
}

const defaultMetrics: QualityMetric[] = [];
const defaultIssues: CodeIssue[] = [];

const severityConfig = {
  error: { icon: XCircle, color: 'text-red-500', bg: 'bg-red-100 dark:bg-red-900/30' },
  warning: { icon: AlertTriangle, color: 'text-amber-500', bg: 'bg-amber-100 dark:bg-amber-900/30' },
  info: { icon: CheckCircle2, color: 'text-blue-500', bg: 'bg-blue-100 dark:bg-blue-900/30' },
};

export default function CodeQualityPage() {
  const [isScanning, setIsScanning] = useState(false);

  const { data: metrics = defaultMetrics } = useQuery({
    queryKey: ['code-quality', 'metrics'],
    queryFn: async () => {
      const res = await fetch('/api/thinktank-admin/code-quality/metrics');
      if (!res.ok) return defaultMetrics;
      return res.json();
    },
  });

  const { data: issues = defaultIssues } = useQuery({
    queryKey: ['code-quality', 'issues'],
    queryFn: async () => {
      const res = await fetch('/api/thinktank-admin/code-quality/issues');
      if (!res.ok) return defaultIssues;
      return res.json();
    },
  });

  const overallScore = Math.round(metrics.reduce((sum, m) => sum + m.score, 0) / metrics.length);
  const totalIssues = issues.length;
  const errorCount = issues.filter(i => i.severity === 'error').length;
  const warningCount = issues.filter(i => i.severity === 'warning').length;

  const handleScan = () => {
    setIsScanning(true);
    setTimeout(() => setIsScanning(false), 3000);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <FlaskConical className="h-6 w-6" />
            Code Quality
          </h1>
          <p className="text-muted-foreground">
            Monitor code quality metrics and issues
          </p>
        </div>
        <Button onClick={handleScan} disabled={isScanning}>
          <RefreshCw className={`h-4 w-4 mr-2 ${isScanning ? 'animate-spin' : ''}`} />
          {isScanning ? 'Scanning...' : 'Run Scan'}
        </Button>
      </div>

      {/* Overall Score */}
      <div className="grid grid-cols-4 gap-4">
        <Card className="col-span-1">
          <CardContent className="pt-6">
            <div className="text-center">
              <div className="relative inline-flex items-center justify-center">
                <svg className="w-24 h-24">
                  <circle
                    className="text-muted stroke-current"
                    strokeWidth="8"
                    fill="transparent"
                    r="40"
                    cx="48"
                    cy="48"
                  />
                  <circle
                    className={`${overallScore >= 90 ? 'text-green-500' : overallScore >= 70 ? 'text-amber-500' : 'text-red-500'} stroke-current`}
                    strokeWidth="8"
                    strokeLinecap="round"
                    fill="transparent"
                    r="40"
                    cx="48"
                    cy="48"
                    strokeDasharray={`${overallScore * 2.51} 251`}
                    transform="rotate(-90 48 48)"
                  />
                </svg>
                <span className="absolute text-2xl font-bold">{overallScore}</span>
              </div>
              <p className="text-sm text-muted-foreground mt-2">Overall Score</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-lg bg-red-100 dark:bg-red-900/30">
                <XCircle className="h-5 w-5 text-red-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{errorCount}</p>
                <p className="text-sm text-muted-foreground">Errors</p>
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
                <p className="text-2xl font-bold">{warningCount}</p>
                <p className="text-sm text-muted-foreground">Warnings</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-lg bg-blue-100 dark:bg-blue-900/30">
                <FileText className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{totalIssues}</p>
                <p className="text-sm text-muted-foreground">Total Issues</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Metrics Grid */}
      <div className="grid grid-cols-6 gap-4">
        {metrics.map((metric) => (
          <Card key={metric.name}>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium">{metric.name}</span>
                {metric.trend === 'up' && <TrendingUp className="h-4 w-4 text-green-500" />}
                {metric.trend === 'down' && <TrendingDown className="h-4 w-4 text-red-500" />}
              </div>
              <div className="flex items-center gap-2">
                <span className="text-2xl font-bold">{metric.score}%</span>
              </div>
              <Progress 
                value={metric.score} 
                className={`h-2 mt-2 ${metric.score >= 90 ? '[&>div]:bg-green-500' : metric.score >= 70 ? '[&>div]:bg-amber-500' : '[&>div]:bg-red-500'}`}
              />
              {metric.issues > 0 && (
                <p className="text-xs text-muted-foreground mt-2">{metric.issues} issues</p>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Issues Table */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Code className="h-5 w-5" />
            Code Issues
          </CardTitle>
          <CardDescription>Issues detected in the codebase</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Severity</TableHead>
                <TableHead>File</TableHead>
                <TableHead>Line</TableHead>
                <TableHead>Rule</TableHead>
                <TableHead>Message</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {issues.map((issue) => {
                const severity = severityConfig[issue.severity];
                return (
                  <TableRow key={issue.id}>
                    <TableCell>
                      <div className={`flex items-center gap-2 ${severity.color}`}>
                        <severity.icon className="h-4 w-4" />
                        <span className="capitalize">{issue.severity}</span>
                      </div>
                    </TableCell>
                    <TableCell className="font-mono text-sm">{issue.file}</TableCell>
                    <TableCell className="font-mono text-sm">{issue.line}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className="font-mono text-xs">{issue.rule}</Badge>
                    </TableCell>
                    <TableCell className="text-sm">{issue.message}</TableCell>
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
