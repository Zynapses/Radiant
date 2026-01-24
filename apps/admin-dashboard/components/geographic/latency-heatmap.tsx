'use client';

/**
 * RADIANT v5.52.1 - Latency Heatmap Component
 * 
 * Geographic latency visualization showing response times across regions.
 * Used in infrastructure monitoring and geographic routing dashboards.
 */

import React, { useMemo } from 'react';
import { motion } from 'framer-motion';
import { Globe, Zap, AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

export interface RegionLatency {
  region: string;
  regionCode: string;
  latencyMs: number;
  requestCount: number;
  errorRate: number;
  status: 'healthy' | 'degraded' | 'critical';
}

export interface LatencyHeatmapProps {
  regions: RegionLatency[];
  title?: string;
  onRegionClick?: (region: RegionLatency) => void;
  className?: string;
}

const REGION_POSITIONS: Record<string, { x: number; y: number }> = {
  'us-east-1': { x: 25, y: 35 },
  'us-east-2': { x: 23, y: 38 },
  'us-west-1': { x: 12, y: 38 },
  'us-west-2': { x: 10, y: 32 },
  'eu-west-1': { x: 45, y: 28 },
  'eu-west-2': { x: 47, y: 25 },
  'eu-central-1': { x: 52, y: 28 },
  'eu-north-1': { x: 55, y: 18 },
  'ap-southeast-1': { x: 75, y: 55 },
  'ap-southeast-2': { x: 85, y: 75 },
  'ap-northeast-1': { x: 85, y: 35 },
  'ap-northeast-2': { x: 82, y: 38 },
  'ap-south-1': { x: 68, y: 48 },
  'sa-east-1': { x: 32, y: 72 },
  'ca-central-1': { x: 22, y: 28 },
  'me-south-1': { x: 60, y: 45 },
  'af-south-1': { x: 55, y: 70 },
};

function getLatencyColor(latencyMs: number): string {
  if (latencyMs < 50) return '#22c55e';
  if (latencyMs < 100) return '#84cc16';
  if (latencyMs < 200) return '#eab308';
  if (latencyMs < 500) return '#f97316';
  return '#ef4444';
}

function getLatencyLabel(latencyMs: number): string {
  if (latencyMs < 50) return 'Excellent';
  if (latencyMs < 100) return 'Good';
  if (latencyMs < 200) return 'Fair';
  if (latencyMs < 500) return 'Slow';
  return 'Critical';
}

export function LatencyHeatmap({
  regions,
  title = 'Global Latency',
  onRegionClick,
  className,
}: LatencyHeatmapProps) {
  const avgLatency = useMemo(() => {
    if (regions.length === 0) return 0;
    return Math.round(regions.reduce((sum, r) => sum + r.latencyMs, 0) / regions.length);
  }, [regions]);

  const healthyCount = regions.filter(r => r.status === 'healthy').length;
  const degradedCount = regions.filter(r => r.status === 'degraded').length;
  const criticalCount = regions.filter(r => r.status === 'critical').length;

  return (
    <Card className={cn('bg-card border-border', className)}>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Globe className="h-5 w-5 text-primary" />
            {title}
          </CardTitle>
          <div className="flex items-center gap-2">
            {criticalCount > 0 && (
              <Badge variant="destructive" className="text-xs">
                <AlertTriangle className="h-3 w-3 mr-1" />
                {criticalCount} Critical
              </Badge>
            )}
            <Badge variant="outline" className="text-xs">
              <Zap className="h-3 w-3 mr-1" />
              Avg: {avgLatency}ms
            </Badge>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {/* World Map Container */}
        <div className="relative w-full aspect-[2/1] bg-slate-900/50 rounded-lg overflow-hidden border border-slate-700/50">
          {/* Simplified world map outline */}
          <svg
            viewBox="0 0 100 50"
            className="absolute inset-0 w-full h-full"
            preserveAspectRatio="xMidYMid slice"
          >
            {/* Grid lines */}
            <defs>
              <pattern id="grid" width="10" height="10" patternUnits="userSpaceOnUse">
                <path d="M 10 0 L 0 0 0 10" fill="none" stroke="rgba(100,116,139,0.1)" strokeWidth="0.1"/>
              </pattern>
            </defs>
            <rect width="100" height="50" fill="url(#grid)" />
            
            {/* Equator */}
            <line x1="0" y1="25" x2="100" y2="25" stroke="rgba(100,116,139,0.2)" strokeWidth="0.1" strokeDasharray="1,1" />
          </svg>

          {/* Region markers */}
          {regions.map((region, idx) => {
            const pos = REGION_POSITIONS[region.regionCode] || { x: 50, y: 50 };
            const color = getLatencyColor(region.latencyMs);
            const size = Math.max(8, Math.min(20, region.requestCount / 1000));

            return (
              <motion.div
                key={region.regionCode}
                initial={{ opacity: 0, scale: 0 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: idx * 0.05 }}
                className={cn(
                  'absolute transform -translate-x-1/2 -translate-y-1/2',
                  onRegionClick && 'cursor-pointer'
                )}
                style={{
                  left: `${pos.x}%`,
                  top: `${pos.y}%`,
                }}
                onClick={() => onRegionClick?.(region)}
              >
                {/* Pulse animation for critical regions */}
                {region.status === 'critical' && (
                  <div
                    className="absolute inset-0 rounded-full animate-ping"
                    style={{ backgroundColor: color, opacity: 0.3 }}
                  />
                )}
                
                {/* Main marker */}
                <div
                  className="relative rounded-full flex items-center justify-center text-[8px] font-bold text-white shadow-lg transition-transform hover:scale-125"
                  style={{
                    width: size,
                    height: size,
                    backgroundColor: color,
                    boxShadow: `0 0 ${size}px ${color}40`,
                  }}
                >
                  {region.latencyMs < 100 && '✓'}
                </div>

                {/* Tooltip on hover */}
                <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 opacity-0 hover:opacity-100 pointer-events-none transition-opacity z-10">
                  <div className="bg-slate-800 text-white text-xs rounded px-2 py-1 whitespace-nowrap shadow-lg">
                    <div className="font-medium">{region.region}</div>
                    <div className="text-slate-300">{region.latencyMs}ms • {region.requestCount.toLocaleString()} req</div>
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>

        {/* Legend */}
        <div className="flex items-center justify-between mt-4 text-xs text-muted-foreground">
          <div className="flex items-center gap-4">
            {[
              { label: 'Excellent (<50ms)', color: '#22c55e' },
              { label: 'Good (<100ms)', color: '#84cc16' },
              { label: 'Fair (<200ms)', color: '#eab308' },
              { label: 'Slow (<500ms)', color: '#f97316' },
              { label: 'Critical (>500ms)', color: '#ef4444' },
            ].map(({ label, color }) => (
              <div key={label} className="flex items-center gap-1">
                <div className="w-2 h-2 rounded-full" style={{ backgroundColor: color }} />
                <span>{label}</span>
              </div>
            ))}
          </div>
          <div className="flex items-center gap-2">
            <span className="text-green-500">{healthyCount} healthy</span>
            {degradedCount > 0 && <span className="text-yellow-500">{degradedCount} degraded</span>}
            {criticalCount > 0 && <span className="text-red-500">{criticalCount} critical</span>}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default LatencyHeatmap;
