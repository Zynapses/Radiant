'use client';

import React, { useState } from 'react';
import { BarChart3, LineChart, PieChart, TrendingUp } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

type ChartType = 'bar' | 'line' | 'pie' | 'area';

interface ChartViewProps {
  initialData?: { label: string; value: number }[];
}

const DEFAULT_DATA = [
  { label: 'Jan', value: 400 },
  { label: 'Feb', value: 300 },
  { label: 'Mar', value: 600 },
  { label: 'Apr', value: 800 },
  { label: 'May', value: 500 },
  { label: 'Jun', value: 700 },
];

export function ChartView({ initialData }: ChartViewProps) {
  const [chartType, setChartType] = useState<ChartType>('bar');
  const data = initialData || DEFAULT_DATA;
  const maxValue = Math.max(...data.map(d => d.value));

  return (
    <div className="h-full flex flex-col bg-slate-900/50 p-4">
      <div className="flex items-center gap-2 mb-4">
        <Button
          size="sm"
          variant={chartType === 'bar' ? 'default' : 'outline'}
          onClick={() => setChartType('bar')}
        >
          <BarChart3 className="h-4 w-4 mr-1" /> Bar
        </Button>
        <Button
          size="sm"
          variant={chartType === 'line' ? 'default' : 'outline'}
          onClick={() => setChartType('line')}
        >
          <LineChart className="h-4 w-4 mr-1" /> Line
        </Button>
        <Button
          size="sm"
          variant={chartType === 'pie' ? 'default' : 'outline'}
          onClick={() => setChartType('pie')}
        >
          <PieChart className="h-4 w-4 mr-1" /> Pie
        </Button>
        <Button
          size="sm"
          variant={chartType === 'area' ? 'default' : 'outline'}
          onClick={() => setChartType('area')}
        >
          <TrendingUp className="h-4 w-4 mr-1" /> Area
        </Button>
      </div>

      <div className="flex-1 flex items-end justify-around gap-2 p-4 bg-slate-800/50 rounded-lg">
        {chartType === 'bar' && data.map((item, i) => (
          <div key={i} className="flex flex-col items-center gap-2">
            <div
              className={cn(
                'w-12 rounded-t transition-all duration-500',
                'bg-gradient-to-t from-violet-600 to-violet-400'
              )}
              style={{ height: `${(item.value / maxValue) * 200}px` }}
            />
            <span className="text-xs text-slate-400">{item.label}</span>
            <span className="text-xs text-slate-500">{item.value}</span>
          </div>
        ))}
        {chartType === 'line' && (
          <svg className="w-full h-48" viewBox="0 0 300 100">
            <polyline
              fill="none"
              stroke="rgb(139, 92, 246)"
              strokeWidth="2"
              points={data.map((d, i) => 
                `${(i / (data.length - 1)) * 280 + 10},${100 - (d.value / maxValue) * 80}`
              ).join(' ')}
            />
            {data.map((d, i) => (
              <circle
                key={i}
                cx={(i / (data.length - 1)) * 280 + 10}
                cy={100 - (d.value / maxValue) * 80}
                r="4"
                fill="rgb(139, 92, 246)"
              />
            ))}
          </svg>
        )}
        {chartType === 'pie' && (
          <div className="text-center text-slate-400">
            <PieChart className="h-32 w-32 mx-auto text-violet-500" />
            <p className="mt-2 text-sm">Pie chart visualization</p>
          </div>
        )}
        {chartType === 'area' && (
          <svg className="w-full h-48" viewBox="0 0 300 100">
            <defs>
              <linearGradient id="areaGradient" x1="0%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%" stopColor="rgb(139, 92, 246)" stopOpacity="0.5" />
                <stop offset="100%" stopColor="rgb(139, 92, 246)" stopOpacity="0" />
              </linearGradient>
            </defs>
            <polygon
              fill="url(#areaGradient)"
              points={`10,100 ${data.map((d, i) => 
                `${(i / (data.length - 1)) * 280 + 10},${100 - (d.value / maxValue) * 80}`
              ).join(' ')} 290,100`}
            />
            <polyline
              fill="none"
              stroke="rgb(139, 92, 246)"
              strokeWidth="2"
              points={data.map((d, i) => 
                `${(i / (data.length - 1)) * 280 + 10},${100 - (d.value / maxValue) * 80}`
              ).join(' ')}
            />
          </svg>
        )}
      </div>
    </div>
  );
}
