'use client';

/**
 * Dashboard View - Analytics & Metrics
 * 
 * PROMPT-41 Polymorphic UI
 * 
 * Analytics and metrics visualization for data-focused queries.
 */

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { LayoutDashboard, TrendingUp, TrendingDown, DollarSign, Zap, Users, Clock } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { ViewComponentProps } from '../view-router';

interface MetricCard {
  id: string;
  label: string;
  value: string | number;
  change?: number;
  trend?: 'up' | 'down' | 'neutral';
  icon?: string;
}

export function DashboardView({ 
  data, 
  projectId: _projectId,
  sessionId: _sessionId, 
  mode: _mode, 
  onUpdateView: _onUpdateView,
  onEscalate: _onEscalate 
}: ViewComponentProps) {
  void _projectId; void _sessionId; void _mode; void _onUpdateView; void _onEscalate; // Reserved for view operations
  const [metrics, setMetrics] = useState<MetricCard[]>([]);

  useEffect(() => {
    if (data.metrics && Array.isArray(data.metrics)) {
      setMetrics(data.metrics as MetricCard[]);
    } else {
      // Demo metrics
      setMetrics([
        { id: '1', label: 'Total Queries', value: '1,234', change: 12.5, trend: 'up', icon: 'zap' },
        { id: '2', label: 'Sniper Usage', value: '78%', change: 5.2, trend: 'up', icon: 'zap' },
        { id: '3', label: 'War Room Usage', value: '22%', change: -3.1, trend: 'down', icon: 'users' },
        { id: '4', label: 'Avg. Cost', value: '$0.08', change: -15.3, trend: 'down', icon: 'dollar' },
        { id: '5', label: 'Avg. Latency', value: '340ms', change: -8.2, trend: 'down', icon: 'clock' },
        { id: '6', label: 'Escalations', value: '45', change: 2.1, trend: 'up', icon: 'users' },
      ]);
    }
  }, [data]);

  const getIcon = (iconName?: string) => {
    switch (iconName) {
      case 'zap': return Zap;
      case 'users': return Users;
      case 'dollar': return DollarSign;
      case 'clock': return Clock;
      default: return TrendingUp;
    }
  };

  return (
    <div className="flex flex-col h-full p-4 bg-muted/20">
      <div className="flex items-center gap-2 mb-4">
        <LayoutDashboard className="w-5 h-5 text-blue-500" />
        <h2 className="text-lg font-semibold">Analytics Dashboard</h2>
        <Badge variant="outline" className="ml-auto">Last 24 hours</Badge>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        {metrics.map((metric) => {
          const Icon = getIcon(metric.icon);
          return (
            <Card key={metric.id}>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                  <Icon className="w-4 h-4" />
                  {metric.label}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{metric.value}</div>
                {metric.change !== undefined && (
                  <div className={cn(
                    "flex items-center gap-1 text-xs mt-1",
                    metric.trend === 'up' && "text-green-500",
                    metric.trend === 'down' && "text-red-500",
                    metric.trend === 'neutral' && "text-muted-foreground",
                  )}>
                    {metric.trend === 'up' ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                    {metric.change > 0 ? '+' : ''}{metric.change}%
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
