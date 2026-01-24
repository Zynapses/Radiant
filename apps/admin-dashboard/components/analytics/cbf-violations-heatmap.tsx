'use client';

/**
 * RADIANT v5.52.1 - CBF Violations Heatmap
 * 
 * Heatmap showing which Content Boundary Framework rules trigger most.
 * Used in analytics dashboards to identify problematic content patterns.
 */

import React, { useMemo } from 'react';
import { motion } from 'framer-motion';
import { Shield, AlertTriangle, TrendingUp } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

export interface CBFViolation {
  ruleId: string;
  ruleName: string;
  category: string;
  count: number;
  severity: 'low' | 'medium' | 'high' | 'critical';
  trend: 'up' | 'down' | 'stable';
}

export interface CBFViolationsHeatmapProps {
  violations: CBFViolation[];
  timeRange?: string;
  onRuleClick?: (violation: CBFViolation) => void;
  className?: string;
}

const SEVERITY_COLORS = {
  low: { bg: 'bg-blue-500/20', text: 'text-blue-400', border: 'border-blue-500/30' },
  medium: { bg: 'bg-yellow-500/20', text: 'text-yellow-400', border: 'border-yellow-500/30' },
  high: { bg: 'bg-orange-500/20', text: 'text-orange-400', border: 'border-orange-500/30' },
  critical: { bg: 'bg-red-500/20', text: 'text-red-400', border: 'border-red-500/30' },
};

const CATEGORY_ICONS: Record<string, string> = {
  'content_safety': '🛡️',
  'data_privacy': '🔒',
  'pii_detection': '👤',
  'harmful_content': '⚠️',
  'bias_detection': '⚖️',
  'copyright': '©️',
  'misinformation': '📰',
  'toxic_language': '💬',
  'jailbreak': '🔓',
  'prompt_injection': '💉',
};

function getIntensityColor(count: number, maxCount: number): string {
  if (maxCount === 0) return 'rgba(239, 68, 68, 0.1)';
  const intensity = Math.min(count / maxCount, 1);
  const alpha = 0.1 + intensity * 0.7;
  return `rgba(239, 68, 68, ${alpha})`;
}

export function CBFViolationsHeatmap({
  violations,
  timeRange = 'Last 7 days',
  onRuleClick,
  className,
}: CBFViolationsHeatmapProps) {
  const groupedByCategory = useMemo(() => {
    const groups = new Map<string, CBFViolation[]>();
    violations.forEach((v) => {
      const existing = groups.get(v.category) || [];
      existing.push(v);
      groups.set(v.category, existing);
    });
    return Array.from(groups.entries()).sort((a, b) => {
      const aTotal = a[1].reduce((sum, v) => sum + v.count, 0);
      const bTotal = b[1].reduce((sum, v) => sum + v.count, 0);
      return bTotal - aTotal;
    });
  }, [violations]);

  const maxCount = useMemo(() => 
    Math.max(...violations.map(v => v.count), 1), 
    [violations]
  );

  const totalViolations = useMemo(() => 
    violations.reduce((sum, v) => sum + v.count, 0),
    [violations]
  );

  const criticalCount = violations.filter(v => v.severity === 'critical').length;

  return (
    <Card className={cn('bg-card border-border', className)}>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Shield className="h-5 w-5 text-red-400" />
              CBF Violations Heatmap
            </CardTitle>
            <CardDescription>{timeRange}</CardDescription>
          </div>
          <div className="flex items-center gap-2">
            {criticalCount > 0 && (
              <Badge variant="destructive" className="text-xs">
                <AlertTriangle className="h-3 w-3 mr-1" />
                {criticalCount} Critical
              </Badge>
            )}
            <Badge variant="outline" className="text-xs">
              {totalViolations.toLocaleString()} total
            </Badge>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {violations.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
            <Shield className="h-12 w-12 mb-4 opacity-50" />
            <p>No violations detected</p>
            <p className="text-sm">All content passed CBF checks</p>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Heatmap Grid by Category */}
            {groupedByCategory.map(([category, categoryViolations], catIdx) => (
              <motion.div
                key={category}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: catIdx * 0.1 }}
                className="space-y-2"
              >
                <div className="flex items-center gap-2 text-sm font-medium text-foreground">
                  <span>{CATEGORY_ICONS[category] || '📋'}</span>
                  <span className="capitalize">{category.replace(/_/g, ' ')}</span>
                  <Badge variant="secondary" className="text-xs ml-auto">
                    {categoryViolations.reduce((sum, v) => sum + v.count, 0).toLocaleString()}
                  </Badge>
                </div>
                
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2">
                  {categoryViolations
                    .sort((a, b) => b.count - a.count)
                    .map((violation, idx) => {
                      const colors = SEVERITY_COLORS[violation.severity];
                      return (
                        <motion.div
                          key={violation.ruleId}
                          initial={{ opacity: 0, scale: 0.9 }}
                          animate={{ opacity: 1, scale: 1 }}
                          transition={{ delay: (catIdx * 5 + idx) * 0.02 }}
                          className={cn(
                            'relative p-3 rounded-lg border transition-all',
                            colors.bg,
                            colors.border,
                            onRuleClick && 'cursor-pointer hover:scale-105'
                          )}
                          style={{
                            background: `linear-gradient(135deg, ${getIntensityColor(violation.count, maxCount)}, transparent)`,
                          }}
                          onClick={() => onRuleClick?.(violation)}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium text-foreground truncate" title={violation.ruleName}>
                                {violation.ruleName}
                              </p>
                              <p className="text-2xl font-bold text-foreground mt-1">
                                {violation.count.toLocaleString()}
                              </p>
                            </div>
                            <div className="flex flex-col items-end gap-1">
                              <Badge 
                                variant="outline" 
                                className={cn('text-[10px] px-1.5', colors.text, colors.border)}
                              >
                                {violation.severity}
                              </Badge>
                              {violation.trend !== 'stable' && (
                                <TrendingUp 
                                  className={cn(
                                    'h-3 w-3',
                                    violation.trend === 'up' ? 'text-red-400' : 'text-green-400 rotate-180'
                                  )} 
                                />
                              )}
                            </div>
                          </div>
                        </motion.div>
                      );
                    })}
                </div>
              </motion.div>
            ))}

            {/* Severity Legend */}
            <div className="flex items-center justify-between pt-4 border-t border-border text-xs text-muted-foreground">
              <div className="flex items-center gap-4">
                {(['low', 'medium', 'high', 'critical'] as const).map((severity) => {
                  const colors = SEVERITY_COLORS[severity];
                  return (
                    <div key={severity} className="flex items-center gap-1">
                      <div className={cn('w-3 h-3 rounded', colors.bg, colors.border, 'border')} />
                      <span className="capitalize">{severity}</span>
                    </div>
                  );
                })}
              </div>
              <div className="flex items-center gap-2">
                <TrendingUp className="h-3 w-3 text-red-400" />
                <span>Increasing</span>
                <TrendingUp className="h-3 w-3 text-green-400 rotate-180 ml-2" />
                <span>Decreasing</span>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default CBFViolationsHeatmap;
