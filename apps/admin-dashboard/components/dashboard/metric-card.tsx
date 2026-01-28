'use client';

import { Card, CardContent } from '@/components/ui/card';
import { formatCurrency, formatCompactNumber } from '@/lib/utils';
import { LucideIcon, TrendingUp, TrendingDown } from 'lucide-react';

interface MetricCardProps {
  title: string;
  value: number;
  change?: number;
  icon: LucideIcon;
  loading?: boolean;
  format?: 'number' | 'currency' | 'compact';
}

export function MetricCard({
  title,
  value,
  change,
  icon: Icon,
  loading,
  format = 'compact',
}: MetricCardProps) {
  const formattedValue = format === 'currency' 
    ? formatCurrency(value)
    : formatCompactNumber(value);

  const isPositive = change && change > 0;
  const isNegative = change && change < 0;

  return (
    <Card>
      <CardContent className="p-6">
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <p className="text-sm text-muted-foreground">{title}</p>
            {loading ? (
              <div className="h-8 w-24 bg-muted animate-pulse rounded" />
            ) : (
              <p className="text-2xl font-bold">{formattedValue}</p>
            )}
            {change !== undefined && !loading && (
              <div className="flex items-center gap-1 text-xs">
                {isPositive && (
                  <>
                    <TrendingUp className="h-3 w-3 text-green-500" />
                    <span className="text-green-500">+{change.toFixed(1)}%</span>
                  </>
                )}
                {isNegative && (
                  <>
                    <TrendingDown className="h-3 w-3 text-red-500" />
                    <span className="text-red-500">{change.toFixed(1)}%</span>
                  </>
                )}
                {!isPositive && !isNegative && (
                  <span className="text-muted-foreground">0%</span>
                )}
                <span className="text-muted-foreground">vs last period</span>
              </div>
            )}
          </div>
          <div className="rounded-full bg-radiant-100 dark:bg-radiant-900 p-3">
            <Icon className="h-6 w-6 text-radiant-600 dark:text-radiant-400" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
