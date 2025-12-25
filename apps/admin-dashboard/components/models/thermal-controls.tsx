'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { ThermalStateBadge } from './thermal-state-badge';
import { ThermalState } from '@/lib/api/types';
import { Flame, Clock, DollarSign, AlertTriangle } from 'lucide-react';

interface ThermalControlsProps {
  modelId: string;
  modelName: string;
  currentState: ThermalState;
  warmupTimeSeconds: number;
  hourlyInstanceCost: number;
  onStateChange?: (state: ThermalState) => void;
}

export function ThermalControls({
  modelId,
  modelName,
  currentState,
  warmupTimeSeconds,
  hourlyInstanceCost,
  onStateChange,
}: ThermalControlsProps) {
  const [targetState, setTargetState] = useState<ThermalState>(currentState);
  const [autoEnabled, setAutoEnabled] = useState(currentState === 'AUTOMATIC');
  const [warmDurationMinutes, setWarmDurationMinutes] = useState(30);
  const [isUpdating, setIsUpdating] = useState(false);

  const handleStateChange = async (newState: ThermalState) => {
    setIsUpdating(true);
    try {
      setTargetState(newState);
      onStateChange?.(newState);
    } finally {
      setIsUpdating(false);
    }
  };

  const estimatedMonthlyCost = (hourlyInstanceCost * 24 * 30).toFixed(2);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Flame className="h-5 w-5" />
          Thermal State Management
        </CardTitle>
        <CardDescription>
          Control warm-up state for {modelName}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="font-medium">Current State</p>
            <p className="text-sm text-muted-foreground">Model endpoint status</p>
          </div>
          <ThermalStateBadge state={currentState} />
        </div>

        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <Label htmlFor="auto-thermal">Automatic Mode</Label>
              <p className="text-sm text-muted-foreground">
                Let the system manage thermal state based on usage
              </p>
            </div>
            <Switch
              id="auto-thermal"
              checked={autoEnabled}
              onCheckedChange={(checked) => {
                setAutoEnabled(checked);
                if (checked) {
                  handleStateChange('AUTOMATIC');
                }
              }}
            />
          </div>

          {!autoEnabled && (
            <div className="space-y-2">
              <Label>Manual State</Label>
              <Select
                value={targetState}
                onValueChange={(value) => handleStateChange(value as ThermalState)}
                disabled={autoEnabled || isUpdating}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="OFF">Off - Endpoint stopped</SelectItem>
                  <SelectItem value="COLD">Cold - Endpoint on, not loaded</SelectItem>
                  <SelectItem value="WARM">Warm - Model loaded, ready</SelectItem>
                  <SelectItem value="HOT">Hot - Maximum performance</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}

          {autoEnabled && (
            <div className="space-y-4 p-4 rounded-lg bg-muted/50">
              <div className="space-y-2">
                <Label>Warm Duration (minutes)</Label>
                <div className="flex items-center gap-4">
                  <Slider
                    value={[warmDurationMinutes]}
                    onValueChange={([value]) => setWarmDurationMinutes(value)}
                    min={5}
                    max={120}
                    step={5}
                    className="flex-1"
                  />
                  <span className="w-16 text-right font-mono">{warmDurationMinutes}m</span>
                </div>
                <p className="text-xs text-muted-foreground">
                  Keep warm for this duration after last request
                </p>
              </div>
            </div>
          )}
        </div>

        <div className="grid gap-4 md:grid-cols-3 pt-4 border-t">
          <div className="flex items-center gap-2">
            <Clock className="h-4 w-4 text-muted-foreground" />
            <div>
              <p className="text-sm font-medium">{warmupTimeSeconds}s</p>
              <p className="text-xs text-muted-foreground">Warmup time</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <DollarSign className="h-4 w-4 text-muted-foreground" />
            <div>
              <p className="text-sm font-medium">${hourlyInstanceCost.toFixed(2)}/hr</p>
              <p className="text-xs text-muted-foreground">Instance cost</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-muted-foreground" />
            <div>
              <p className="text-sm font-medium">${estimatedMonthlyCost}</p>
              <p className="text-xs text-muted-foreground">If always on</p>
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => setTargetState(currentState)}>
            Reset
          </Button>
          <Button 
            onClick={() => handleStateChange(targetState)}
            disabled={isUpdating || targetState === currentState}
          >
            {isUpdating ? 'Updating...' : 'Apply Changes'}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
