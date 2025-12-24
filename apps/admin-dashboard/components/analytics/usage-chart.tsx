'use client';

import { useMemo } from 'react';

interface UsageDataPoint {
  date: string;
  requests: number;
  tokens: number;
  cost: number;
}

interface UsageChartProps {
  data: UsageDataPoint[];
  metric: 'requests' | 'tokens' | 'cost';
  title: string;
}

export function UsageChart({ data, metric, title }: UsageChartProps) {
  const { maxValue, chartData } = useMemo(() => {
    const values = data.map(d => d[metric]);
    const max = Math.max(...values, 1);
    
    return {
      maxValue: max,
      chartData: data.map(d => ({
        ...d,
        percentage: (d[metric] / max) * 100,
      })),
    };
  }, [data, metric]);

  const formatValue = (value: number): string => {
    if (metric === 'cost') {
      return `$${value.toFixed(2)}`;
    }
    if (value >= 1000000) {
      return `${(value / 1000000).toFixed(1)}M`;
    }
    if (value >= 1000) {
      return `${(value / 1000).toFixed(1)}K`;
    }
    return value.toString();
  };

  const total = data.reduce((sum, d) => sum + d[metric], 0);
  const average = total / (data.length || 1);

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <div className="flex justify-between items-start mb-4">
        <div>
          <h3 className="text-lg font-semibold text-gray-900">{title}</h3>
          <p className="text-sm text-gray-500">Last {data.length} days</p>
        </div>
        <div className="text-right">
          <p className="text-2xl font-bold text-gray-900">{formatValue(total)}</p>
          <p className="text-sm text-gray-500">Avg: {formatValue(average)}/day</p>
        </div>
      </div>

      <div className="h-48 flex items-end space-x-1">
        {chartData.map((point, index) => (
          <div
            key={point.date}
            className="flex-1 flex flex-col items-center group"
          >
            <div className="relative w-full">
              <div
                className="w-full bg-blue-500 rounded-t transition-all duration-200 hover:bg-blue-600"
                style={{ height: `${Math.max(point.percentage, 2)}%`, minHeight: '4px' }}
              />
              
              {/* Tooltip */}
              <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 hidden group-hover:block z-10">
                <div className="bg-gray-900 text-white text-xs rounded px-2 py-1 whitespace-nowrap">
                  <div className="font-semibold">{point.date}</div>
                  <div>{formatValue(point[metric])}</div>
                </div>
              </div>
            </div>
            
            {/* X-axis label (show every few) */}
            {(index === 0 || index === chartData.length - 1 || index % 7 === 0) && (
              <span className="text-xs text-gray-400 mt-1 truncate w-full text-center">
                {new Date(point.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
              </span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

interface ModelUsageProps {
  data: Array<{
    model: string;
    requests: number;
    tokens: number;
    cost: number;
  }>;
}

export function ModelUsageBreakdown({ data }: ModelUsageProps) {
  const sortedData = useMemo(() => {
    return [...data].sort((a, b) => b.requests - a.requests);
  }, [data]);

  const totalRequests = sortedData.reduce((sum, d) => sum + d.requests, 0);
  const totalCost = sortedData.reduce((sum, d) => sum + d.cost, 0);

  const colors = [
    'bg-blue-500',
    'bg-green-500',
    'bg-yellow-500',
    'bg-purple-500',
    'bg-pink-500',
    'bg-indigo-500',
    'bg-red-500',
    'bg-orange-500',
  ];

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <h3 className="text-lg font-semibold text-gray-900 mb-4">Usage by Model</h3>
      
      {/* Progress bar */}
      <div className="h-4 rounded-full overflow-hidden flex mb-4">
        {sortedData.map((model, index) => (
          <div
            key={model.model}
            className={`${colors[index % colors.length]} transition-all`}
            style={{ width: `${(model.requests / totalRequests) * 100}%` }}
            title={`${model.model}: ${model.requests} requests`}
          />
        ))}
      </div>

      {/* Legend */}
      <div className="space-y-2">
        {sortedData.slice(0, 5).map((model, index) => (
          <div key={model.model} className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <div className={`w-3 h-3 rounded ${colors[index % colors.length]}`} />
              <span className="text-sm text-gray-700">{model.model}</span>
            </div>
            <div className="text-right">
              <span className="text-sm font-medium text-gray-900">
                {model.requests.toLocaleString()} requests
              </span>
              <span className="text-sm text-gray-500 ml-2">
                ${model.cost.toFixed(2)}
              </span>
            </div>
          </div>
        ))}
        
        {sortedData.length > 5 && (
          <div className="text-sm text-gray-500">
            +{sortedData.length - 5} more models
          </div>
        )}
      </div>

      <div className="mt-4 pt-4 border-t">
        <div className="flex justify-between text-sm">
          <span className="text-gray-500">Total</span>
          <span className="font-medium">{totalRequests.toLocaleString()} requests • ${totalCost.toFixed(2)}</span>
        </div>
      </div>
    </div>
  );
}

interface StatsCardProps {
  title: string;
  value: string | number;
  change?: number;
  icon?: React.ReactNode;
}

export function StatsCard({ title, value, change, icon }: StatsCardProps) {
  return (
    <div className="bg-white rounded-lg shadow p-6">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-gray-500">{title}</p>
          <p className="text-2xl font-bold text-gray-900 mt-1">{value}</p>
          {change !== undefined && (
            <p className={`text-sm mt-1 ${change >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              {change >= 0 ? '↑' : '↓'} {Math.abs(change)}% from last period
            </p>
          )}
        </div>
        {icon && (
          <div className="p-3 bg-blue-100 rounded-lg text-blue-600">
            {icon}
          </div>
        )}
      </div>
    </div>
  );
}
