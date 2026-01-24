'use client';

/**
 * RADIANT v5.52.1 - Generic Heatmap Component
 * 
 * 2D visualization component for displaying intensity data in a grid format.
 * Used for CBF violations, correlation matrices, and time-based patterns.
 */

import React, { useMemo } from 'react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';

export interface HeatmapCell {
  row: string;
  col: string;
  value: number;
  label?: string;
}

export interface HeatmapProps {
  data: HeatmapCell[];
  rows: string[];
  cols: string[];
  colorScheme?: 'blue' | 'red' | 'green' | 'purple' | 'diverging';
  showValues?: boolean;
  showLabels?: boolean;
  cellSize?: 'sm' | 'md' | 'lg';
  title?: string;
  onCellClick?: (cell: HeatmapCell) => void;
  className?: string;
}

const COLOR_SCHEMES = {
  blue: ['#1e3a5f', '#2563eb', '#3b82f6', '#60a5fa', '#93c5fd'],
  red: ['#450a0a', '#b91c1c', '#dc2626', '#ef4444', '#fca5a5'],
  green: ['#14532d', '#15803d', '#22c55e', '#4ade80', '#86efac'],
  purple: ['#3b0764', '#7c3aed', '#8b5cf6', '#a78bfa', '#c4b5fd'],
  diverging: ['#1e40af', '#3b82f6', '#f3f4f6', '#ef4444', '#991b1b'],
};

const CELL_SIZES = {
  sm: 'w-8 h-8 text-[10px]',
  md: 'w-12 h-12 text-xs',
  lg: 'w-16 h-16 text-sm',
};

function getColorForValue(
  value: number,
  min: number,
  max: number,
  scheme: keyof typeof COLOR_SCHEMES
): string {
  if (max === min) return COLOR_SCHEMES[scheme][2];
  
  const normalized = (value - min) / (max - min);
  const colors = COLOR_SCHEMES[scheme];
  const index = Math.min(Math.floor(normalized * colors.length), colors.length - 1);
  return colors[index];
}

export function Heatmap({
  data,
  rows,
  cols,
  colorScheme = 'blue',
  showValues = true,
  showLabels = true,
  cellSize = 'md',
  title,
  onCellClick,
  className,
}: HeatmapProps) {
  const dataMap = useMemo(() => {
    const map = new Map<string, HeatmapCell>();
    data.forEach((cell) => {
      map.set(`${cell.row}|${cell.col}`, cell);
    });
    return map;
  }, [data]);

  const { min, max } = useMemo(() => {
    if (data.length === 0) return { min: 0, max: 1 };
    const values = data.map((d) => d.value);
    return { min: Math.min(...values), max: Math.max(...values) };
  }, [data]);

  return (
    <div className={cn('space-y-3', className)}>
      {title && (
        <h3 className="text-sm font-medium text-foreground">{title}</h3>
      )}
      
      <div className="overflow-x-auto">
        <div className="inline-block">
          {/* Column headers */}
          {showLabels && (
            <div className="flex">
              <div className={cn(CELL_SIZES[cellSize], 'shrink-0')} />
              {cols.map((col) => (
                <div
                  key={col}
                  className={cn(
                    CELL_SIZES[cellSize],
                    'flex items-end justify-center pb-1 text-muted-foreground font-medium truncate'
                  )}
                  title={col}
                >
                  <span className="rotate-[-45deg] origin-bottom-left whitespace-nowrap">
                    {col.length > 8 ? `${col.slice(0, 8)}…` : col}
                  </span>
                </div>
              ))}
            </div>
          )}

          {/* Rows */}
          {rows.map((row, rowIdx) => (
            <div key={row} className="flex">
              {/* Row label */}
              {showLabels && (
                <div
                  className={cn(
                    CELL_SIZES[cellSize],
                    'flex items-center justify-end pr-2 text-muted-foreground font-medium truncate shrink-0'
                  )}
                  title={row}
                >
                  {row.length > 10 ? `${row.slice(0, 10)}…` : row}
                </div>
              )}

              {/* Cells */}
              {cols.map((col, colIdx) => {
                const cell = dataMap.get(`${row}|${col}`);
                const value = cell?.value ?? 0;
                const bgColor = getColorForValue(value, min, max, colorScheme);

                return (
                  <motion.div
                    key={`${row}|${col}`}
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: (rowIdx * cols.length + colIdx) * 0.01 }}
                    className={cn(
                      CELL_SIZES[cellSize],
                      'flex items-center justify-center border border-background/20 transition-all',
                      onCellClick && 'cursor-pointer hover:ring-2 hover:ring-primary/50'
                    )}
                    style={{ backgroundColor: bgColor }}
                    onClick={() => cell && onCellClick?.(cell)}
                    title={cell?.label || `${row} × ${col}: ${value}`}
                  >
                    {showValues && (
                      <span className="text-white font-medium drop-shadow-sm">
                        {value.toFixed(value < 10 ? 1 : 0)}
                      </span>
                    )}
                  </motion.div>
                );
              })}
            </div>
          ))}
        </div>
      </div>

      {/* Legend */}
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <span>Low</span>
        <div className="flex h-3 rounded overflow-hidden">
          {COLOR_SCHEMES[colorScheme].map((color, i) => (
            <div key={i} className="w-6" style={{ backgroundColor: color }} />
          ))}
        </div>
        <span>High</span>
      </div>
    </div>
  );
}

export default Heatmap;
