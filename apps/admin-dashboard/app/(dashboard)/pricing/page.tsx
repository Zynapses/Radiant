'use client';

import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { toast } from 'sonner';
import { 
  DollarSign, 
  TrendingUp, 
  RefreshCw, 
  Save,
  Percent,
  Clock,
  Bell,
  Cpu,
  Cloud,
} from 'lucide-react';

interface PricingConfig {
  externalDefaultMarkup: number;
  selfHostedDefaultMarkup: number;
  minimumChargePerRequest: number;
  priceIncreaseGracePeriodHours: number;
  autoUpdateFromProviders: boolean;
  autoUpdateFrequency: string;
  lastAutoUpdate?: string;
  notifyOnPriceChange: boolean;
  notifyThresholdPercent: number;
}

interface ModelPricing {
  model_id: string;
  display_name: string;
  provider_id: string;
  is_novel: boolean;
  category: string;
  base_input_price: number;
  base_output_price: number;
  effective_markup: number;
  user_input_price: number;
  user_output_price: number;
  has_override: boolean;
}

async function fetchPricingConfig(): Promise<PricingConfig> {
  const res = await fetch('/api/admin/pricing/config');
  if (!res.ok) throw new Error('Failed to fetch pricing config');
  return res.json();
}

async function fetchModelPricing(): Promise<ModelPricing[]> {
  const res = await fetch('/api/admin/pricing/models');
  if (!res.ok) throw new Error('Failed to fetch model pricing');
  const data = await res.json();
  return data.models || [];
}

async function updatePricingConfig(config: Partial<PricingConfig>): Promise<void> {
  const res = await fetch('/api/admin/pricing/config', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(config),
  });
  if (!res.ok) throw new Error('Failed to update pricing config');
}

export default function PricingPage() {
  const queryClient = useQueryClient();
  const [editedConfig, setEditedConfig] = useState<PricingConfig | null>(null);

  const { data: config, isLoading: configLoading } = useQuery({
    queryKey: ['pricing-config'],
    queryFn: fetchPricingConfig,
  });

  const { data: models = [], isLoading: modelsLoading } = useQuery({
    queryKey: ['model-pricing'],
    queryFn: fetchModelPricing,
  });

  const updateMutation = useMutation({
    mutationFn: updatePricingConfig,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pricing-config'] });
      toast.success('Pricing configuration saved');
    },
    onError: () => {
      toast.error('Failed to save pricing configuration');
    },
  });

  useEffect(() => {
    if (config && !editedConfig) {
      setEditedConfig(config);
    }
  }, [config, editedConfig]);

  const handleSave = () => {
    if (editedConfig) {
      updateMutation.mutate(editedConfig);
    }
  };

  const formatPrice = (price: number) => {
    return `$${price.toFixed(6)}`;
  };

  if (configLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <DollarSign className="h-8 w-8" />
            Pricing Configuration
          </h1>
          <p className="text-muted-foreground mt-1">
            Configure credit pricing, markups, and model-specific overrides
          </p>
        </div>
        <Button onClick={handleSave} disabled={updateMutation.isPending}>
          <Save className="h-4 w-4 mr-2" />
          Save Changes
        </Button>
      </div>

      <Tabs defaultValue="config" className="space-y-4">
        <TabsList>
          <TabsTrigger value="config">Configuration</TabsTrigger>
          <TabsTrigger value="models">Model Pricing</TabsTrigger>
          <TabsTrigger value="notifications">Notifications</TabsTrigger>
        </TabsList>

        <TabsContent value="config" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Cloud className="h-5 w-5" />
                  External Model Markup
                </CardTitle>
                <CardDescription>
                  Default markup for external provider models (OpenAI, Anthropic, etc.)
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>Markup Percentage</Label>
                  <div className="flex items-center gap-2">
                    <Input
                      type="number"
                      step="0.01"
                      min="0"
                      max="10"
                      value={editedConfig?.externalDefaultMarkup ?? 0.4}
                      onChange={(e) => setEditedConfig(prev => prev ? {
                        ...prev,
                        externalDefaultMarkup: parseFloat(e.target.value) || 0
                      } : null)}
                      className="w-32"
                    />
                    <span className="text-muted-foreground">
                      ({((editedConfig?.externalDefaultMarkup ?? 0.4) * 100).toFixed(0)}%)
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Cpu className="h-5 w-5" />
                  Self-Hosted Model Markup
                </CardTitle>
                <CardDescription>
                  Default markup for self-hosted models (includes infrastructure costs)
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>Markup Percentage</Label>
                  <div className="flex items-center gap-2">
                    <Input
                      type="number"
                      step="0.01"
                      min="0"
                      max="10"
                      value={editedConfig?.selfHostedDefaultMarkup ?? 0.75}
                      onChange={(e) => setEditedConfig(prev => prev ? {
                        ...prev,
                        selfHostedDefaultMarkup: parseFloat(e.target.value) || 0
                      } : null)}
                      className="w-32"
                    />
                    <span className="text-muted-foreground">
                      ({((editedConfig?.selfHostedDefaultMarkup ?? 0.75) * 100).toFixed(0)}%)
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Percent className="h-5 w-5" />
                  Minimum Charge
                </CardTitle>
                <CardDescription>
                  Minimum credit charge per API request
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>Minimum Per Request</Label>
                  <div className="flex items-center gap-2">
                    <span className="text-muted-foreground">$</span>
                    <Input
                      type="number"
                      step="0.0001"
                      min="0"
                      value={editedConfig?.minimumChargePerRequest ?? 0.001}
                      onChange={(e) => setEditedConfig(prev => prev ? {
                        ...prev,
                        minimumChargePerRequest: parseFloat(e.target.value) || 0
                      } : null)}
                      className="w-32"
                    />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Clock className="h-5 w-5" />
                  Price Update Settings
                </CardTitle>
                <CardDescription>
                  Configure automatic price updates from providers
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <Label>Auto-Update Prices</Label>
                  <Switch
                    checked={editedConfig?.autoUpdateFromProviders ?? true}
                    onCheckedChange={(checked) => setEditedConfig(prev => prev ? {
                      ...prev,
                      autoUpdateFromProviders: checked
                    } : null)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Update Frequency</Label>
                  <Select
                    value={editedConfig?.autoUpdateFrequency ?? 'daily'}
                    onValueChange={(value) => setEditedConfig(prev => prev ? {
                      ...prev,
                      autoUpdateFrequency: value
                    } : null)}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="hourly">Hourly</SelectItem>
                      <SelectItem value="daily">Daily</SelectItem>
                      <SelectItem value="weekly">Weekly</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Grace Period (hours)</Label>
                  <Input
                    type="number"
                    min="0"
                    max="168"
                    value={editedConfig?.priceIncreaseGracePeriodHours ?? 24}
                    onChange={(e) => setEditedConfig(prev => prev ? {
                      ...prev,
                      priceIncreaseGracePeriodHours: parseInt(e.target.value) || 0
                    } : null)}
                  />
                  <p className="text-xs text-muted-foreground">
                    Time before price increases take effect
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="models" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5" />
                Model Pricing Overview
              </CardTitle>
              <CardDescription>
                View and manage per-model pricing. Prices shown per 1M tokens.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {modelsLoading ? (
                <div className="flex justify-center py-8">
                  <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Model</TableHead>
                      <TableHead>Provider</TableHead>
                      <TableHead>Category</TableHead>
                      <TableHead className="text-right">Base Input</TableHead>
                      <TableHead className="text-right">Base Output</TableHead>
                      <TableHead className="text-right">Markup</TableHead>
                      <TableHead className="text-right">User Input</TableHead>
                      <TableHead className="text-right">User Output</TableHead>
                      <TableHead>Override</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {models.slice(0, 20).map((model) => (
                      <TableRow key={model.model_id}>
                        <TableCell className="font-medium">
                          {model.display_name}
                          {model.is_novel && (
                            <Badge variant="secondary" className="ml-2">New</Badge>
                          )}
                        </TableCell>
                        <TableCell>{model.provider_id}</TableCell>
                        <TableCell>
                          <Badge variant="outline">{model.category}</Badge>
                        </TableCell>
                        <TableCell className="text-right font-mono text-sm">
                          {formatPrice(model.base_input_price)}
                        </TableCell>
                        <TableCell className="text-right font-mono text-sm">
                          {formatPrice(model.base_output_price)}
                        </TableCell>
                        <TableCell className="text-right">
                          {(model.effective_markup * 100).toFixed(0)}%
                        </TableCell>
                        <TableCell className="text-right font-mono text-sm text-green-600">
                          {formatPrice(model.user_input_price)}
                        </TableCell>
                        <TableCell className="text-right font-mono text-sm text-green-600">
                          {formatPrice(model.user_output_price)}
                        </TableCell>
                        <TableCell>
                          {model.has_override ? (
                            <Badge>Custom</Badge>
                          ) : (
                            <Badge variant="outline">Default</Badge>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="notifications" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Bell className="h-5 w-5" />
                Price Change Notifications
              </CardTitle>
              <CardDescription>
                Configure alerts for when provider prices change
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <Label>Notify on Price Changes</Label>
                  <p className="text-sm text-muted-foreground">
                    Receive alerts when provider prices change
                  </p>
                </div>
                <Switch
                  checked={editedConfig?.notifyOnPriceChange ?? true}
                  onCheckedChange={(checked) => setEditedConfig(prev => prev ? {
                    ...prev,
                    notifyOnPriceChange: checked
                  } : null)}
                />
              </div>
              <div className="space-y-2">
                <Label>Notification Threshold</Label>
                <div className="flex items-center gap-2">
                  <Input
                    type="number"
                    min="1"
                    max="100"
                    value={editedConfig?.notifyThresholdPercent ?? 10}
                    onChange={(e) => setEditedConfig(prev => prev ? {
                      ...prev,
                      notifyThresholdPercent: parseInt(e.target.value) || 0
                    } : null)}
                    className="w-24"
                  />
                  <span className="text-muted-foreground">% change</span>
                </div>
                <p className="text-xs text-muted-foreground">
                  Only notify when price changes exceed this threshold
                </p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
