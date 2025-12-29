'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Database, Server, Cloud, Zap, DollarSign, AlertTriangle, Check, RefreshCw } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';

interface StorageTierConfig {
  id: string;
  tierLevel: number;
  tierName: string;
  storageType: 'aurora' | 'fargate_postgres' | 'dynamodb';
  storageConfig: Record<string, unknown>;
  estimatedMonthlyCostMin: number;
  estimatedMonthlyCostMax: number;
  adminOverride: boolean;
  overrideReason?: string;
  overrideBy?: string;
  overrideAt?: string;
}

const STORAGE_TYPE_INFO = {
  aurora: {
    name: 'Aurora Serverless v2',
    icon: Cloud,
    description: 'Fully managed, auto-scaling PostgreSQL. Best for production workloads.',
    pros: ['Auto-scaling', 'High availability', 'Managed backups'],
    cons: ['Higher minimum cost (~$45/mo)', 'May be overkill for dev'],
  },
  fargate_postgres: {
    name: 'Fargate PostgreSQL',
    icon: Server,
    description: 'Container-based PostgreSQL on ECS Fargate. Cost-effective for lower tiers.',
    pros: ['Low minimum cost (~$5/mo)', 'Good for dev/staging', 'Predictable pricing'],
    cons: ['Manual scaling', 'Less managed features'],
  },
  dynamodb: {
    name: 'DynamoDB',
    icon: Zap,
    description: 'NoSQL database with on-demand pricing. Best for simple key-value workloads.',
    pros: ['Pay per request', 'No minimum cost', 'Infinite scale'],
    cons: ['NoSQL only', 'Query limitations', 'Schema changes harder'],
  },
};

const TIER_RECOMMENDATIONS: Record<number, 'aurora' | 'fargate_postgres' | 'dynamodb'> = {
  1: 'fargate_postgres',
  2: 'fargate_postgres',
  3: 'aurora',
  4: 'aurora',
  5: 'aurora',
};

export default function StorageConfigPage() {
  const [configs, setConfigs] = useState<StorageTierConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<number | null>(null);
  const [editingTier, setEditingTier] = useState<number | null>(null);
  const [overrideReason, setOverrideReason] = useState('');
  const { toast } = useToast();

  useEffect(() => {
    fetchConfigs();
  }, []);

  const fetchConfigs = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/admin/storage-config');
      if (response.ok) {
        const data = await response.json();
        setConfigs(data.configs || []);
      }
    } catch (error) {
      console.error('Failed to fetch storage configs:', error);
      // Use defaults if API fails
      setConfigs([
        { id: '1', tierLevel: 1, tierName: 'SEED', storageType: 'fargate_postgres', storageConfig: { cpu: 256, memory: 512 }, estimatedMonthlyCostMin: 5, estimatedMonthlyCostMax: 15, adminOverride: false },
        { id: '2', tierLevel: 2, tierName: 'STARTUP', storageType: 'fargate_postgres', storageConfig: { cpu: 512, memory: 1024 }, estimatedMonthlyCostMin: 20, estimatedMonthlyCostMax: 50, adminOverride: false },
        { id: '3', tierLevel: 3, tierName: 'GROWTH', storageType: 'aurora', storageConfig: { min_capacity: 2, max_capacity: 8 }, estimatedMonthlyCostMin: 100, estimatedMonthlyCostMax: 300, adminOverride: false },
        { id: '4', tierLevel: 4, tierName: 'SCALE', storageType: 'aurora', storageConfig: { min_capacity: 4, max_capacity: 32 }, estimatedMonthlyCostMin: 300, estimatedMonthlyCostMax: 800, adminOverride: false },
        { id: '5', tierLevel: 5, tierName: 'ENTERPRISE', storageType: 'aurora', storageConfig: { min_capacity: 8, max_capacity: 128, multi_az: true }, estimatedMonthlyCostMin: 800, estimatedMonthlyCostMax: 2500, adminOverride: false },
      ]);
    }
    setLoading(false);
  };

  const handleStorageTypeChange = async (tierLevel: number, newType: string) => {
    const config = configs.find(c => c.tierLevel === tierLevel);
    if (!config) return;

    const recommended = TIER_RECOMMENDATIONS[tierLevel];
    if (newType !== recommended && !config.adminOverride) {
      setEditingTier(tierLevel);
      return;
    }

    await saveConfig(tierLevel, newType as 'aurora' | 'fargate_postgres' | 'dynamodb', overrideReason);
  };

  const handleOverrideToggle = async (tierLevel: number, enabled: boolean) => {
    const config = configs.find(c => c.tierLevel === tierLevel);
    if (!config) return;

    if (!enabled) {
      // Reset to recommended
      const recommended = TIER_RECOMMENDATIONS[tierLevel];
      await saveConfig(tierLevel, recommended, '');
    }
    
    setConfigs(prev => prev.map(c => 
      c.tierLevel === tierLevel ? { ...c, adminOverride: enabled } : c
    ));
  };

  const saveConfig = async (tierLevel: number, storageType: string, reason: string) => {
    setSaving(tierLevel);
    try {
      const response = await fetch('/api/admin/storage-config', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tierLevel,
          storageType,
          overrideReason: reason,
          adminOverride: storageType !== TIER_RECOMMENDATIONS[tierLevel],
        }),
      });

      if (response.ok) {
        toast({
          title: 'Configuration saved',
          description: `Tier ${tierLevel} storage updated to ${storageType}`,
        });
        await fetchConfigs();
      } else {
        throw new Error('Failed to save');
      }
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to save storage configuration',
        variant: 'destructive',
      });
    }
    setSaving(null);
    setEditingTier(null);
    setOverrideReason('');
  };

  const getStorageIcon = (type: string) => {
    const info = STORAGE_TYPE_INFO[type as keyof typeof STORAGE_TYPE_INFO];
    if (!info) return Database;
    return info.icon;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Adaptive Storage Configuration</h1>
        <p className="text-muted-foreground mt-2">
          Configure storage backends per deployment tier. Lower tiers use cost-effective options by default.
        </p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Aurora Tiers</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {configs.filter(c => c.storageType === 'aurora').length}
            </div>
            <p className="text-xs text-muted-foreground">Production-grade storage</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Fargate Postgres Tiers</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {configs.filter(c => c.storageType === 'fargate_postgres').length}
            </div>
            <p className="text-xs text-muted-foreground">Cost-optimized storage</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Admin Overrides</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {configs.filter(c => c.adminOverride).length}
            </div>
            <p className="text-xs text-muted-foreground">Custom configurations</p>
          </CardContent>
        </Card>
      </div>

      {/* Tier Configurations */}
      <div className="space-y-4">
        {configs.map(config => {
          const StorageIcon = getStorageIcon(config.storageType);
          const recommended = TIER_RECOMMENDATIONS[config.tierLevel];
          const isRecommended = config.storageType === recommended;
          const typeInfo = STORAGE_TYPE_INFO[config.storageType];

          return (
            <Card key={config.tierLevel} className={config.adminOverride ? 'border-amber-500' : ''}>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className={`p-2 rounded-lg ${
                      config.storageType === 'aurora' ? 'bg-blue-100 text-blue-700' :
                      config.storageType === 'fargate_postgres' ? 'bg-green-100 text-green-700' :
                      'bg-purple-100 text-purple-700'
                    }`}>
                      <StorageIcon className="h-5 w-5" />
                    </div>
                    <div>
                      <CardTitle className="flex items-center gap-2">
                        Tier {config.tierLevel}: {config.tierName}
                        {config.adminOverride && (
                          <Badge variant="outline" className="text-amber-600 border-amber-600">
                            <AlertTriangle className="h-3 w-3 mr-1" />
                            Override
                          </Badge>
                        )}
                        {isRecommended && !config.adminOverride && (
                          <Badge variant="outline" className="text-green-600 border-green-600">
                            <Check className="h-3 w-3 mr-1" />
                            Recommended
                          </Badge>
                        )}
                      </CardTitle>
                      <CardDescription>
                        {typeInfo?.name} · ${config.estimatedMonthlyCostMin}-${config.estimatedMonthlyCostMax}/mo
                      </CardDescription>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="flex items-center gap-2">
                      <Label htmlFor={`override-${config.tierLevel}`} className="text-sm">
                        Admin Override
                      </Label>
                      <Switch
                        id={`override-${config.tierLevel}`}
                        checked={config.adminOverride}
                        onCheckedChange={(checked) => handleOverrideToggle(config.tierLevel, checked)}
                      />
                    </div>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label>Storage Type</Label>
                    <Select
                      value={config.storageType}
                      onValueChange={(value) => handleStorageTypeChange(config.tierLevel, value)}
                      disabled={saving === config.tierLevel}
                    >
                      <SelectTrigger className="mt-1">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {Object.entries(STORAGE_TYPE_INFO).map(([key, info]) => (
                          <SelectItem key={key} value={key}>
                            <div className="flex items-center gap-2">
                              <info.icon className="h-4 w-4" />
                              {info.name}
                              {key === recommended && (
                                <Badge variant="secondary" className="ml-2 text-xs">
                                  Recommended
                                </Badge>
                              )}
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {typeInfo && (
                      <p className="text-xs text-muted-foreground mt-2">{typeInfo.description}</p>
                    )}
                  </div>
                  <div>
                    <Label>Configuration</Label>
                    <pre className="mt-1 p-3 bg-muted rounded-md text-xs overflow-auto">
                      {JSON.stringify(config.storageConfig, null, 2)}
                    </pre>
                  </div>
                </div>

                {config.adminOverride && config.overrideReason && (
                  <div className="mt-4 p-3 bg-amber-50 rounded-md">
                    <p className="text-sm text-amber-800">
                      <strong>Override Reason:</strong> {config.overrideReason}
                    </p>
                    {config.overrideAt && (
                      <p className="text-xs text-amber-600 mt-1">
                        Overridden at {new Date(config.overrideAt).toLocaleString()}
                      </p>
                    )}
                  </div>
                )}

                {editingTier === config.tierLevel && (
                  <div className="mt-4 p-4 border rounded-lg bg-muted/50">
                    <Label>Override Reason (Required)</Label>
                    <Textarea
                      value={overrideReason}
                      onChange={(e) => setOverrideReason(e.target.value)}
                      placeholder="Explain why you're overriding the recommended storage type..."
                      className="mt-2"
                    />
                    <div className="flex gap-2 mt-3">
                      <Button
                        onClick={() => saveConfig(config.tierLevel, config.storageType, overrideReason)}
                        disabled={!overrideReason.trim() || saving === config.tierLevel}
                      >
                        {saving === config.tierLevel ? 'Saving...' : 'Confirm Override'}
                      </Button>
                      <Button
                        variant="outline"
                        onClick={() => {
                          setEditingTier(null);
                          setOverrideReason('');
                        }}
                      >
                        Cancel
                      </Button>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Storage Type Reference */}
      <Card>
        <CardHeader>
          <CardTitle>Storage Type Reference</CardTitle>
          <CardDescription>
            Compare storage options to make informed decisions
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {Object.entries(STORAGE_TYPE_INFO).map(([key, info]) => (
              <div key={key} className="p-4 border rounded-lg">
                <div className="flex items-center gap-2 mb-2">
                  <info.icon className="h-5 w-5" />
                  <h4 className="font-semibold">{info.name}</h4>
                </div>
                <p className="text-sm text-muted-foreground mb-3">{info.description}</p>
                <div className="space-y-2">
                  <div>
                    <p className="text-xs font-medium text-green-600">Pros:</p>
                    <ul className="text-xs text-muted-foreground">
                      {info.pros.map((pro, i) => (
                        <li key={i}>• {pro}</li>
                      ))}
                    </ul>
                  </div>
                  <div>
                    <p className="text-xs font-medium text-red-600">Cons:</p>
                    <ul className="text-xs text-muted-foreground">
                      {info.cons.map((con, i) => (
                        <li key={i}>• {con}</li>
                      ))}
                    </ul>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
