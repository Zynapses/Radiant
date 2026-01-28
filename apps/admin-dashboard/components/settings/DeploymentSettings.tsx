'use client';

import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import {
  Settings,
  Save,
  RefreshCw,
  AlertTriangle,
  Cloud,
  Loader2,
} from 'lucide-react';

interface DeploymentConfig {
  lockStepMode: boolean;
  maxVersionDrift: {
    radiant: number;
    thinktank: number;
  };
  warnOnDrift: boolean;
  autoSnapshot: boolean;
  snapshotRetentionDays: number;
  maintenanceWindowStart: string;
  maintenanceWindowEnd: string;
  healthCheckTimeout: number;
  rollbackOnFailure: boolean;
  notifyOnDeployment: boolean;
  requireApproval: boolean;
}

const defaultConfig: DeploymentConfig = {
  lockStepMode: false,
  maxVersionDrift: {
    radiant: 2,
    thinktank: 3,
  },
  warnOnDrift: true,
  autoSnapshot: true,
  snapshotRetentionDays: 30,
  maintenanceWindowStart: '02:00',
  maintenanceWindowEnd: '06:00',
  healthCheckTimeout: 30,
  rollbackOnFailure: true,
  notifyOnDeployment: true,
  requireApproval: true,
};

export function DeploymentSettings() {
  const queryClient = useQueryClient();
  const [config, setConfig] = useState<DeploymentConfig>(defaultConfig);
  const [hasChanges, setHasChanges] = useState(false);

  const { data: savedConfig, isLoading } = useQuery<DeploymentConfig>({
    queryKey: ['deployment-settings'],
    queryFn: async () => {
      const response = await fetch('/api/admin/settings/deployment');
      if (!response.ok) return defaultConfig;
      return response.json();
    },
  });

  const { data: ssmStatus } = useQuery({
    queryKey: ['ssm-sync-status'],
    queryFn: async () => {
      const response = await fetch('/api/admin/settings/ssm-status');
      if (!response.ok) return { synced: false, lastSync: null };
      return response.json();
    },
    refetchInterval: 60000,
  });

  useEffect(() => {
    if (savedConfig) {
      setConfig(savedConfig);
    }
  }, [savedConfig]);

  const saveMutation = useMutation({
    mutationFn: async (newConfig: DeploymentConfig) => {
      const response = await fetch('/api/admin/settings/deployment', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newConfig),
      });
      if (!response.ok) throw new Error('Failed to save settings');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['deployment-settings'] });
      queryClient.invalidateQueries({ queryKey: ['ssm-sync-status'] });
      setHasChanges(false);
    },
  });

  const syncToSSMMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch('/api/admin/settings/sync-ssm', {
        method: 'POST',
      });
      if (!response.ok) throw new Error('Failed to sync to SSM');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ssm-sync-status'] });
    },
  });

  const updateConfig = (updates: Partial<DeploymentConfig>) => {
    setConfig((prev) => ({ ...prev, ...updates }));
    setHasChanges(true);
  };

  const handleSave = () => {
    saveMutation.mutate(config);
  };

  const handleReset = () => {
    if (savedConfig) {
      setConfig(savedConfig);
      setHasChanges(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <Settings className="h-5 w-5" />
            Deployment Settings
          </h2>
          <p className="text-sm text-muted-foreground">
            Configure deployment behavior and sync with Deployer App
          </p>
        </div>
        <div className="flex items-center gap-2">
          {ssmStatus?.synced ? (
            <Badge className="bg-green-500">
              <Cloud className="h-3 w-3 mr-1" />
              SSM Synced
            </Badge>
          ) : (
            <Badge variant="outline" className="text-amber-500">
              <AlertTriangle className="h-3 w-3 mr-1" />
              SSM Out of Sync
            </Badge>
          )}
          <Button
            variant="outline"
            size="sm"
            onClick={() => syncToSSMMutation.mutate()}
            disabled={syncToSSMMutation.isPending}
          >
            {syncToSSMMutation.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4" />
            )}
          </Button>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Version Control</CardTitle>
            <CardDescription>
              Control component versioning and drift behavior
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>Lock-Step Mode</Label>
                <p className="text-xs text-muted-foreground">
                  Require both components to deploy together
                </p>
              </div>
              <Switch
                checked={config.lockStepMode}
                onCheckedChange={(checked) => updateConfig({ lockStepMode: checked })}
              />
            </div>

            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>Warn on Version Drift</Label>
                <p className="text-xs text-muted-foreground">
                  Show warning when versions diverge
                </p>
              </div>
              <Switch
                checked={config.warnOnDrift}
                onCheckedChange={(checked) => updateConfig({ warnOnDrift: checked })}
              />
            </div>

            <div className="space-y-2">
              <Label>Max Radiant Version Drift</Label>
              <Input
                type="number"
                min={1}
                max={10}
                value={config.maxVersionDrift.radiant}
                onChange={(e) =>
                  updateConfig({
                    maxVersionDrift: {
                      ...config.maxVersionDrift,
                      radiant: parseInt(e.target.value) || 1,
                    },
                  })
                }
              />
            </div>

            <div className="space-y-2">
              <Label>Max Think Tank Version Drift</Label>
              <Input
                type="number"
                min={1}
                max={10}
                value={config.maxVersionDrift.thinktank}
                onChange={(e) =>
                  updateConfig({
                    maxVersionDrift: {
                      ...config.maxVersionDrift,
                      thinktank: parseInt(e.target.value) || 1,
                    },
                  })
                }
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Snapshot & Rollback</CardTitle>
            <CardDescription>
              Configure automatic snapshots and rollback behavior
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>Auto Snapshot</Label>
                <p className="text-xs text-muted-foreground">
                  Create snapshot before each deployment
                </p>
              </div>
              <Switch
                checked={config.autoSnapshot}
                onCheckedChange={(checked) => updateConfig({ autoSnapshot: checked })}
              />
            </div>

            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>Rollback on Failure</Label>
                <p className="text-xs text-muted-foreground">
                  Automatically rollback on deployment failure
                </p>
              </div>
              <Switch
                checked={config.rollbackOnFailure}
                onCheckedChange={(checked) => updateConfig({ rollbackOnFailure: checked })}
              />
            </div>

            <div className="space-y-2">
              <Label>Snapshot Retention (days)</Label>
              <Input
                type="number"
                min={1}
                max={365}
                value={config.snapshotRetentionDays}
                onChange={(e) =>
                  updateConfig({
                    snapshotRetentionDays: parseInt(e.target.value) || 30,
                  })
                }
              />
            </div>

            <div className="space-y-2">
              <Label>Health Check Timeout (seconds)</Label>
              <Input
                type="number"
                min={5}
                max={300}
                value={config.healthCheckTimeout}
                onChange={(e) =>
                  updateConfig({
                    healthCheckTimeout: parseInt(e.target.value) || 30,
                  })
                }
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Maintenance Window</CardTitle>
            <CardDescription>
              Preferred time window for automated deployments
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Start Time (UTC)</Label>
                <Input
                  type="time"
                  value={config.maintenanceWindowStart}
                  onChange={(e) =>
                    updateConfig({ maintenanceWindowStart: e.target.value })
                  }
                />
              </div>
              <div className="space-y-2">
                <Label>End Time (UTC)</Label>
                <Input
                  type="time"
                  value={config.maintenanceWindowEnd}
                  onChange={(e) =>
                    updateConfig({ maintenanceWindowEnd: e.target.value })
                  }
                />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Notifications & Approval</CardTitle>
            <CardDescription>
              Configure deployment notifications and approval requirements
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>Notify on Deployment</Label>
                <p className="text-xs text-muted-foreground">
                  Send notifications for deployment events
                </p>
              </div>
              <Switch
                checked={config.notifyOnDeployment}
                onCheckedChange={(checked) => updateConfig({ notifyOnDeployment: checked })}
              />
            </div>

            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>Require Approval</Label>
                <p className="text-xs text-muted-foreground">
                  Require admin approval for production deployments
                </p>
              </div>
              <Switch
                checked={config.requireApproval}
                onCheckedChange={(checked) => updateConfig({ requireApproval: checked })}
              />
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="flex justify-end gap-2">
        <Button variant="outline" onClick={handleReset} disabled={!hasChanges}>
          Reset
        </Button>
        <Button onClick={handleSave} disabled={!hasChanges || saveMutation.isPending}>
          {saveMutation.isPending ? (
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
          ) : (
            <Save className="h-4 w-4 mr-2" />
          )}
          Save Changes
        </Button>
      </div>
    </div>
  );
}
