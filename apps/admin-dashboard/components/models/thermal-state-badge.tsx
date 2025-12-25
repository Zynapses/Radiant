'use client';

import { Badge } from '@/components/ui/badge';
import { Flame, Snowflake, Thermometer, Power, Zap } from 'lucide-react';
import { ThermalState, THERMAL_STATE_COLORS } from '@/lib/api/types';

interface ThermalStateBadgeProps {
  state: ThermalState;
  showIcon?: boolean;
  size?: 'sm' | 'default';
}

const stateIcons: Record<ThermalState, React.ElementType> = {
  OFF: Power,
  COLD: Snowflake,
  WARM: Thermometer,
  HOT: Flame,
  AUTOMATIC: Zap,
};

const stateLabels: Record<ThermalState, string> = {
  OFF: 'Off',
  COLD: 'Cold',
  WARM: 'Warm',
  HOT: 'Hot',
  AUTOMATIC: 'Auto',
};

const stateVariants: Record<ThermalState, 'default' | 'secondary' | 'destructive' | 'outline'> = {
  OFF: 'secondary',
  COLD: 'outline',
  WARM: 'default',
  HOT: 'destructive',
  AUTOMATIC: 'default',
};

export function ThermalStateBadge({ state, showIcon = true, size = 'default' }: ThermalStateBadgeProps) {
  const Icon = stateIcons[state];
  const iconSize = size === 'sm' ? 'h-3 w-3' : 'h-4 w-4';

  return (
    <Badge variant={stateVariants[state]} className={size === 'sm' ? 'text-xs px-2 py-0' : ''}>
      {showIcon && <Icon className={`${iconSize} mr-1`} />}
      {stateLabels[state]}
    </Badge>
  );
}

interface ThermalStateIndicatorProps {
  state: ThermalState;
  warmupTimeSeconds?: number;
}

export function ThermalStateIndicator({ state, warmupTimeSeconds }: ThermalStateIndicatorProps) {
  const Icon = stateIcons[state];
  const colorClass = THERMAL_STATE_COLORS[state];

  return (
    <div className="flex items-center gap-2">
      <div className={`w-2 h-2 rounded-full ${colorClass}`} />
      <Icon className="h-4 w-4 text-muted-foreground" />
      <span className="text-sm">{stateLabels[state]}</span>
      {state === 'COLD' && warmupTimeSeconds && (
        <span className="text-xs text-muted-foreground">
          (~{warmupTimeSeconds}s warmup)
        </span>
      )}
    </div>
  );
}
