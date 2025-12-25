'use client';

import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Slider } from '@/components/ui/slider';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from '@/components/ui/dialog';
import { toast } from 'sonner';
import { Save, RefreshCw, DollarSign, Percent, History, Edit2 } from 'lucide-react';

interface PricingConfig {
  externalDefaultMarkup: number;
  selfHostedDefaultMarkup: number;
  minimumChargePerRequest: number;
  priceIncreaseGracePeriodHours: number;
  autoUpdateFromProviders: boolean;
  autoUpdateFrequency: 'hourly' | 'daily' | 'weekly';
  notifyOnPriceChange: boolean;
  notifyThresholdPercent: number;
}

interface ModelPricing {
  modelId: string;
  displayName: string;
  providerId: string;
  isNovel: boolean;
  category: string;
  baseInputPrice: number;
  baseOutputPrice: number;
  effectiveMarkup: number;
  userInputPrice: number;
  userOutputPrice: number;
  hasOverride: boolean;
}

interface PriceHistoryEntry {
  id: string;
  modelId: string;
  previousMarkup: number | null;
  newMarkup: number | null;
  changeSource: string;
  changedByEmail: string | null;
  createdAt: string;
}

export default function ModelPricingPage() {
  const queryClient = useQueryClient();
  const [selectedModel, setSelectedModel] = useState<ModelPricing | null>(null);
  const [bulkMarkup, setBulkMarkup] = useState({ external: 40, selfHosted: 75 });

  const { data: config, isLoading: configLoading } = useQuery<PricingConfig>({
    queryKey: ['pricing-config'],
    queryFn: () => fetch('/api/admin/pricing/config').then((r) => r.json()),
  });

  const { data: models, isLoading: modelsLoading } = useQuery<ModelPricing[]>({
    queryKey: ['model-pricing'],
    queryFn: () => fetch('/api/admin/pricing/models').then((r) => r.json()),
  });

  const updateConfigMutation = useMutation({
    mutationFn: (data: Partial<PricingConfig>) =>
      fetch('/api/admin/pricing/config', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      }).then((r) => r.json()),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pricing-config'] });
      toast.success('Pricing configuration updated');
    },
  });

  const bulkUpdateMutation = useMutation({
    mutationFn: (data: { type: 'external' | 'self_hosted'; markup: number }) =>
      fetch('/api/admin/pricing/bulk-update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      }).then((r) => r.json()),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['model-pricing'] });
      toast.success(
        `All ${variables.type === 'external' ? 'external' : 'self-hosted'} models updated to ${variables.markup}% markup`
      );
    },
  });

  const overrideMutation = useMutation({
    mutationFn: (data: {
      modelId: string;
      markup?: number;
      inputPrice?: number;
      outputPrice?: number;
    }) =>
      fetch(`/api/admin/pricing/models/${data.modelId}/override`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      }).then((r) => r.json()),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['model-pricing'] });
      setSelectedModel(null);
      toast.success('Model pricing override saved');
    },
  });

  const clearOverrideMutation = useMutation({
    mutationFn: (modelId: string) =>
      fetch(`/api/admin/pricing/models/${modelId}/override`, {
        method: 'DELETE',
      }).then((r) => r.json()),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['model-pricing'] });
      toast.success('Pricing override removed');
    },
  });

  const [localConfig, setLocalConfig] = useState<Partial<PricingConfig>>({});

  useEffect(() => {
    if (config) {
      setLocalConfig(config);
    }
  }, [config]);

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold">Model Pricing</h1>
          <p className="text-muted-foreground">
            Configure pricing markups and overrides for all AI models
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => queryClient.invalidateQueries()}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
          <Button onClick={() => updateConfigMutation.mutate(localConfig)}>
            <Save className="h-4 w-4 mr-2" />
            Save Config
          </Button>
        </div>
      </div>

      <Tabs defaultValue="config">
        <TabsList>
          <TabsTrigger value="config">Global Configuration</TabsTrigger>
          <TabsTrigger value="bulk">Bulk Updates</TabsTrigger>
          <TabsTrigger value="models">Individual Models</TabsTrigger>
          <TabsTrigger value="history">Price History</TabsTrigger>
        </TabsList>

        {/* Global Configuration Tab */}
        <TabsContent value="config" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Percent className="h-5 w-5" />
                  Default Markups
                </CardTitle>
                <CardDescription>
                  Global markup percentages applied to all models
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-3">
                  <div className="flex justify-between">
                    <Label>External Provider Markup</Label>
                    <span className="font-mono text-sm">
                      {(
                        (localConfig.externalDefaultMarkup ||
                          config?.externalDefaultMarkup ||
                          0.4) * 100
                      ).toFixed(0)}
                      %
                    </span>
                  </div>
                  <Slider
                    value={[
                      (localConfig.externalDefaultMarkup ||
                        config?.externalDefaultMarkup ||
                        0.4) * 100,
                    ]}
                    min={0}
                    max={200}
                    step={5}
                    onValueChange={([value]) =>
                      setLocalConfig({
                        ...localConfig,
                        externalDefaultMarkup: value / 100,
                      })
                    }
                  />
                  <p className="text-xs text-muted-foreground">
                    Applied to OpenAI, Anthropic, Google, xAI, Mistral, etc.
                  </p>
                </div>

                <div className="space-y-3">
                  <div className="flex justify-between">
                    <Label>Self-Hosted Model Markup</Label>
                    <span className="font-mono text-sm">
                      {(
                        (localConfig.selfHostedDefaultMarkup ||
                          config?.selfHostedDefaultMarkup ||
                          0.75) * 100
                      ).toFixed(0)}
                      %
                    </span>
                  </div>
                  <Slider
                    value={[
                      (localConfig.selfHostedDefaultMarkup ||
                        config?.selfHostedDefaultMarkup ||
                        0.75) * 100,
                    ]}
                    min={0}
                    max={300}
                    step={5}
                    onValueChange={([value]) =>
                      setLocalConfig({
                        ...localConfig,
                        selfHostedDefaultMarkup: value / 100,
                      })
                    }
                  />
                  <p className="text-xs text-muted-foreground">
                    Applied to SageMaker-hosted models (covers compute costs)
                  </p>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <DollarSign className="h-5 w-5" />
                  Pricing Rules
                </CardTitle>
                <CardDescription>Additional pricing configuration</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>Minimum Charge Per Request ($)</Label>
                  <Input
                    type="number"
                    step="0.0001"
                    value={
                      localConfig.minimumChargePerRequest ||
                      config?.minimumChargePerRequest ||
                      0.001
                    }
                    onChange={(e) =>
                      setLocalConfig({
                        ...localConfig,
                        minimumChargePerRequest: parseFloat(e.target.value),
                      })
                    }
                  />
                </div>

                <div className="space-y-2">
                  <Label>Price Increase Grace Period (hours)</Label>
                  <Input
                    type="number"
                    min={0}
                    max={168}
                    value={
                      localConfig.priceIncreaseGracePeriodHours ||
                      config?.priceIncreaseGracePeriodHours ||
                      24
                    }
                    onChange={(e) =>
                      setLocalConfig({
                        ...localConfig,
                        priceIncreaseGracePeriodHours: parseInt(e.target.value),
                      })
                    }
                  />
                  <p className="text-xs text-muted-foreground">
                    Delay before price increases take effect
                  </p>
                </div>

                <div className="flex items-center justify-between">
                  <div>
                    <Label>Auto-Update from Providers</Label>
                    <p className="text-xs text-muted-foreground">
                      Automatically sync base prices from provider APIs
                    </p>
                  </div>
                  <Switch
                    checked={
                      localConfig.autoUpdateFromProviders ??
                      config?.autoUpdateFromProviders ??
                      true
                    }
                    onCheckedChange={(checked) =>
                      setLocalConfig({
                        ...localConfig,
                        autoUpdateFromProviders: checked,
                      })
                    }
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div>
                    <Label>Notify on Price Changes</Label>
                    <p className="text-xs text-muted-foreground">
                      Alert when provider prices change significantly
                    </p>
                  </div>
                  <Switch
                    checked={
                      localConfig.notifyOnPriceChange ??
                      config?.notifyOnPriceChange ??
                      true
                    }
                    onCheckedChange={(checked) =>
                      setLocalConfig({
                        ...localConfig,
                        notifyOnPriceChange: checked,
                      })
                    }
                  />
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Bulk Updates Tab */}
        <TabsContent value="bulk" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>External Providers</CardTitle>
                <CardDescription>
                  Update markup for all external AI providers at once
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-3">
                  <div className="flex justify-between">
                    <Label>Markup Percentage</Label>
                    <span className="font-mono text-sm">{bulkMarkup.external}%</span>
                  </div>
                  <Slider
                    value={[bulkMarkup.external]}
                    min={0}
                    max={200}
                    step={5}
                    onValueChange={([value]) =>
                      setBulkMarkup({ ...bulkMarkup, external: value })
                    }
                  />
                </div>
                <Button
                  className="w-full"
                  onClick={() =>
                    bulkUpdateMutation.mutate({
                      type: 'external',
                      markup: bulkMarkup.external,
                    })
                  }
                  disabled={bulkUpdateMutation.isPending}
                >
                  Apply to All External Models
                </Button>
                <p className="text-xs text-muted-foreground">
                  Affects: OpenAI, Anthropic, Google, xAI, Mistral, Perplexity,
                  DeepSeek, Cohere, etc.
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Self-Hosted Models</CardTitle>
                <CardDescription>
                  Update markup for all SageMaker-hosted models at once
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-3">
                  <div className="flex justify-between">
                    <Label>Markup Percentage</Label>
                    <span className="font-mono text-sm">
                      {bulkMarkup.selfHosted}%
                    </span>
                  </div>
                  <Slider
                    value={[bulkMarkup.selfHosted]}
                    min={0}
                    max={300}
                    step={5}
                    onValueChange={([value]) =>
                      setBulkMarkup({ ...bulkMarkup, selfHosted: value })
                    }
                  />
                </div>
                <Button
                  className="w-full"
                  onClick={() =>
                    bulkUpdateMutation.mutate({
                      type: 'self_hosted',
                      markup: bulkMarkup.selfHosted,
                    })
                  }
                  disabled={bulkUpdateMutation.isPending}
                >
                  Apply to All Self-Hosted Models
                </Button>
                <p className="text-xs text-muted-foreground">
                  Affects: Stable Diffusion, Whisper, SAM 2, YOLO, MusicGen, etc.
                </p>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Individual Models Tab */}
        <TabsContent value="models">
          <Card>
            <CardHeader>
              <CardTitle>Model Pricing Details</CardTitle>
              <CardDescription>
                View and override pricing for individual models
              </CardDescription>
            </CardHeader>
            <CardContent>
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
                    <TableHead></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {modelsLoading ? (
                    <TableRow>
                      <TableCell colSpan={10} className="text-center py-8">
                        Loading...
                      </TableCell>
                    </TableRow>
                  ) : (
                    (models || []).map((model) => (
                      <TableRow key={model.modelId}>
                        <TableCell>
                          <div className="font-medium">{model.displayName}</div>
                          <div className="text-xs text-muted-foreground font-mono">
                            {model.modelId}
                          </div>
                        </TableCell>
                        <TableCell>{model.providerId}</TableCell>
                        <TableCell>
                          <Badge variant={model.isNovel ? 'secondary' : 'outline'}>
                            {model.isNovel ? 'Novel' : 'Standard'}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right font-mono">
                          ${model.baseInputPrice.toFixed(2)}
                        </TableCell>
                        <TableCell className="text-right font-mono">
                          ${model.baseOutputPrice.toFixed(2)}
                        </TableCell>
                        <TableCell className="text-right font-mono">
                          {(model.effectiveMarkup * 100).toFixed(0)}%
                        </TableCell>
                        <TableCell className="text-right font-mono text-green-600">
                          ${model.userInputPrice.toFixed(2)}
                        </TableCell>
                        <TableCell className="text-right font-mono text-green-600">
                          ${model.userOutputPrice.toFixed(2)}
                        </TableCell>
                        <TableCell>
                          {model.hasOverride ? (
                            <Badge variant="default">Custom</Badge>
                          ) : (
                            <Badge variant="outline">Default</Badge>
                          )}
                        </TableCell>
                        <TableCell>
                          <Dialog>
                            <DialogTrigger asChild>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => setSelectedModel(model)}
                              >
                                <Edit2 className="h-4 w-4" />
                              </Button>
                            </DialogTrigger>
                            <DialogContent>
                              <DialogHeader>
                                <DialogTitle>
                                  Edit Pricing: {model.displayName}
                                </DialogTitle>
                              </DialogHeader>
                              <ModelPricingEditor
                                model={model}
                                onSave={(data) =>
                                  overrideMutation.mutate({
                                    modelId: model.modelId,
                                    ...data,
                                  })
                                }
                                onClear={() =>
                                  clearOverrideMutation.mutate(model.modelId)
                                }
                              />
                            </DialogContent>
                          </Dialog>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Price History Tab */}
        <TabsContent value="history">
          <PriceHistoryTable />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function ModelPricingEditor({
  model,
  onSave,
  onClear,
}: {
  model: ModelPricing;
  onSave: (data: {
    markup?: number;
    inputPrice?: number;
    outputPrice?: number;
  }) => void;
  onClear: () => void;
}) {
  const [markup, setMarkup] = useState(model.effectiveMarkup * 100);
  const [inputPrice, setInputPrice] = useState<number | null>(null);
  const [outputPrice, setOutputPrice] = useState<number | null>(null);

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label>Custom Markup (%)</Label>
        <div className="flex items-center gap-4">
          <Slider
            value={[markup]}
            min={0}
            max={200}
            step={5}
            onValueChange={([value]) => setMarkup(value)}
            className="flex-1"
          />
          <span className="font-mono w-16 text-right">{markup}%</span>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>Override Input Price ($/1M tokens)</Label>
          <Input
            type="number"
            step="0.01"
            placeholder={`Default: $${model.baseInputPrice.toFixed(2)}`}
            value={inputPrice ?? ''}
            onChange={(e) =>
              setInputPrice(e.target.value ? parseFloat(e.target.value) : null)
            }
          />
        </div>
        <div className="space-y-2">
          <Label>Override Output Price ($/1M tokens)</Label>
          <Input
            type="number"
            step="0.01"
            placeholder={`Default: $${model.baseOutputPrice.toFixed(2)}`}
            value={outputPrice ?? ''}
            onChange={(e) =>
              setOutputPrice(e.target.value ? parseFloat(e.target.value) : null)
            }
          />
        </div>
      </div>

      <div className="bg-muted p-3 rounded-lg">
        <div className="text-sm font-medium mb-2">Preview User Prices</div>
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            Input:{' '}
            <span className="font-mono text-green-600">
              $
              {(
                (inputPrice ?? model.baseInputPrice) *
                (1 + markup / 100)
              ).toFixed(2)}
              /1M
            </span>
          </div>
          <div>
            Output:{' '}
            <span className="font-mono text-green-600">
              $
              {(
                (outputPrice ?? model.baseOutputPrice) *
                (1 + markup / 100)
              ).toFixed(2)}
              /1M
            </span>
          </div>
        </div>
      </div>

      <DialogFooter className="flex justify-between">
        {model.hasOverride && (
          <Button variant="outline" onClick={onClear}>
            Clear Override
          </Button>
        )}
        <Button
          onClick={() =>
            onSave({ markup: markup / 100, inputPrice: inputPrice ?? undefined, outputPrice: outputPrice ?? undefined })
          }
        >
          Save Override
        </Button>
      </DialogFooter>
    </div>
  );
}

function PriceHistoryTable() {
  const { data: history } = useQuery<PriceHistoryEntry[]>({
    queryKey: ['price-history'],
    queryFn: () =>
      fetch('/api/admin/pricing/history?limit=100').then((r) => r.json()),
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <History className="h-5 w-5" />
          Price Change History
        </CardTitle>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Date</TableHead>
              <TableHead>Model</TableHead>
              <TableHead>Change Type</TableHead>
              <TableHead className="text-right">Previous</TableHead>
              <TableHead className="text-right">New</TableHead>
              <TableHead>Changed By</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {(history || []).map((entry) => (
              <TableRow key={entry.id}>
                <TableCell className="text-sm">
                  {new Date(entry.createdAt).toLocaleString()}
                </TableCell>
                <TableCell className="font-mono text-sm">{entry.modelId}</TableCell>
                <TableCell>
                  <Badge variant="outline">{entry.changeSource}</Badge>
                </TableCell>
                <TableCell className="text-right font-mono text-sm">
                  {entry.previousMarkup
                    ? `${(entry.previousMarkup * 100).toFixed(0)}%`
                    : '-'}
                </TableCell>
                <TableCell className="text-right font-mono text-sm">
                  {entry.newMarkup ? `${(entry.newMarkup * 100).toFixed(0)}%` : '-'}
                </TableCell>
                <TableCell className="text-sm">
                  {entry.changedByEmail || 'System'}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
