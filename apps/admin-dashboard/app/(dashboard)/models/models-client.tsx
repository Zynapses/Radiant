'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { 
  Cpu, 
  Search, 
  RefreshCw,
  Zap,
  DollarSign,
  Activity,
  Settings,
  Power,
  PowerOff,
  Edit,
  Server,
  Cloud,
  Thermometer,
  Shield,
  CheckCircle,
  XCircle,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { apiClient } from '@/lib/api';

interface Model {
  id: string;
  name: string;
  displayName: string;
  provider: string;
  category: string;
  status: string;
  inputCostPer1k: number;
  outputCostPer1k: number;
  maxTokens: number;
  contextWindow: number;
  isEnabled: boolean;
  // Specialty metadata
  hostingType: 'external' | 'self_hosted';
  specialty?: string;
  capabilities: string[];
  inputModalities: string[];
  outputModalities: string[];
  primaryMode: string;
  license?: string;
  commercialUseAllowed: boolean;
  thermalState?: 'HOT' | 'WARM' | 'COLD';
  warmupTimeSeconds?: number;
  minTier: number;
}

export function ModelsClient() {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedModel, setSelectedModel] = useState<Model | null>(null);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const queryClient = useQueryClient();

  const { data: models, isLoading } = useQuery({
    queryKey: ['models'],
    queryFn: async (): Promise<Model[]> => {
      return apiClient.get<Model[]>('/admin/models');
    },
  });

  const toggleModelMutation = useMutation({
    mutationFn: async ({ id, isEnabled }: { id: string; isEnabled: boolean }) => {
      await apiClient.put(`/admin/models/${id}`, { isEnabled });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['models'] });
    },
  });

  const updateModelMutation = useMutation({
    mutationFn: async (model: Partial<Model> & { id: string }) => {
      await apiClient.put(`/admin/models/${model.id}`, model);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['models'] });
      setShowEditDialog(false);
      setSelectedModel(null);
    },
  });

  const handleEditModel = (model: Model) => {
    setSelectedModel(model);
    setShowEditDialog(true);
  };

  const filteredModels = models?.filter(model =>
    model.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    model.displayName.toLowerCase().includes(searchQuery.toLowerCase()) ||
    model.provider.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'active':
        return <Badge className="bg-green-500">Active</Badge>;
      case 'warming':
        return <Badge className="bg-yellow-500">Warming</Badge>;
      case 'cold':
        return <Badge variant="secondary">Cold</Badge>;
      case 'disabled':
        return <Badge variant="outline">Disabled</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const getCategoryBadge = (category: string) => {
    const colors: Record<string, string> = {
      'chat': 'bg-blue-500',
      'code': 'bg-purple-500',
      'vision': 'bg-green-500',
      'embedding': 'bg-orange-500',
      'audio': 'bg-pink-500',
      'scientific': 'bg-cyan-500',
      'medical': 'bg-red-500',
      'geospatial': 'bg-emerald-500',
      '3d': 'bg-indigo-500',
      'llm': 'bg-violet-500',
      'video': 'bg-rose-500',
      'video_generation': 'bg-rose-500',
      'image': 'bg-amber-500',
      'image_generation': 'bg-amber-500',
    };
    return <Badge className={colors[category] || 'bg-gray-500'}>{category}</Badge>;
  };

  const getHostingBadge = (hostingType: string) => {
    if (hostingType === 'self_hosted') {
      return <Badge variant="outline" className="border-orange-500 text-orange-500"><Server className="h-3 w-3 mr-1" />Self-Hosted</Badge>;
    }
    return <Badge variant="outline" className="border-blue-500 text-blue-500"><Cloud className="h-3 w-3 mr-1" />External</Badge>;
  };

  const getThermalBadge = (thermalState?: string) => {
    switch (thermalState) {
      case 'HOT':
        return <Badge className="bg-red-500"><Thermometer className="h-3 w-3 mr-1" />Hot</Badge>;
      case 'WARM':
        return <Badge className="bg-yellow-500"><Thermometer className="h-3 w-3 mr-1" />Warm</Badge>;
      case 'COLD':
        return <Badge variant="secondary"><Thermometer className="h-3 w-3 mr-1" />Cold</Badge>;
      default:
        return null;
    }
  };

  const formatCost = (cost: number) => `$${cost.toFixed(4)}`;

  const activeModels = models?.filter(m => m.status === 'active').length ?? 0;
  const totalModels = models?.length ?? 0;
  const selfHostedModels = models?.filter(m => m.hostingType === 'self_hosted').length ?? 0;
  const externalModels = models?.filter(m => m.hostingType === 'external').length ?? 0;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Models</h1>
          <p className="text-muted-foreground">
            Manage AI models and their configurations
          </p>
        </div>
        <Button variant="outline" onClick={() => queryClient.invalidateQueries({ queryKey: ['models'] })}>
          <RefreshCw className="mr-2 h-4 w-4" />
          Refresh
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Models</CardTitle>
            <Cpu className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalModels}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active</CardTitle>
            <Activity className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{activeModels}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Providers</CardTitle>
            <Zap className="h-4 w-4 text-yellow-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {new Set(models?.map(m => m.provider)).size}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Self-Hosted</CardTitle>
            <Server className="h-4 w-4 text-orange-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{selfHostedModels}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">External</CardTitle>
            <Cloud className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{externalModels}</div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>All Models</CardTitle>
              <CardDescription>Configure model availability and pricing</CardDescription>
            </div>
            <div className="relative">
              <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search models..."
                value={searchQuery}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSearchQuery(e.target.value)}
                className="pl-8 w-64"
              />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Model</TableHead>
                <TableHead>Provider</TableHead>
                <TableHead>Hosting</TableHead>
                <TableHead>Category</TableHead>
                <TableHead>Specialty</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Thermal</TableHead>
                <TableHead>License</TableHead>
                <TableHead>Context</TableHead>
                <TableHead>Enabled</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredModels?.map((model) => (
                <TableRow key={model.id}>
                  <TableCell>
                    <div>
                      <p className="font-medium">{model.displayName}</p>
                      <p className="text-xs text-muted-foreground font-mono">{model.name}</p>
                      {model.capabilities?.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-1">
                          {model.capabilities.slice(0, 3).map((cap) => (
                            <Badge key={cap} variant="outline" className="text-xs">{cap}</Badge>
                          ))}
                          {model.capabilities.length > 3 && (
                            <Badge variant="outline" className="text-xs">+{model.capabilities.length - 3}</Badge>
                          )}
                        </div>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>{model.provider}</TableCell>
                  <TableCell>{getHostingBadge(model.hostingType)}</TableCell>
                  <TableCell>{getCategoryBadge(model.category)}</TableCell>
                  <TableCell>
                    {model.specialty ? (
                      <Badge variant="secondary">{model.specialty}</Badge>
                    ) : (
                      <span className="text-muted-foreground">-</span>
                    )}
                  </TableCell>
                  <TableCell>{getStatusBadge(model.status)}</TableCell>
                  <TableCell>{getThermalBadge(model.thermalState)}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      {model.commercialUseAllowed ? (
                        <CheckCircle className="h-4 w-4 text-green-500" />
                      ) : (
                        <XCircle className="h-4 w-4 text-red-500" />
                      )}
                      <span className="text-xs">{model.license || '-'}</span>
                    </div>
                  </TableCell>
                  <TableCell>{model.contextWindow ? `${(model.contextWindow / 1000).toFixed(0)}k` : '-'}</TableCell>
                  <TableCell>
                    <Switch
                      checked={model.isEnabled}
                      onCheckedChange={(checked: boolean) => 
                        toggleModelMutation.mutate({ id: model.id, isEnabled: checked })
                      }
                    />
                  </TableCell>
                  <TableCell className="text-right">
                    <Button variant="ghost" size="sm" onClick={() => handleEditModel(model)}>
                      <Edit className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Edit Model Dialog */}
      <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Model: {selectedModel?.displayName}</DialogTitle>
            <DialogDescription>
              Update specialty metadata for this model
            </DialogDescription>
          </DialogHeader>
          
          {selectedModel && (
            <div className="space-y-4">
              {/* Basic Info */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Model ID</Label>
                  <Input value={selectedModel.name} disabled className="bg-muted" />
                </div>
                <div>
                  <Label>Provider</Label>
                  <Input value={selectedModel.provider} disabled className="bg-muted" />
                </div>
              </div>

              {/* Hosting & Thermal */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Hosting Type</Label>
                  <div className="mt-1">{getHostingBadge(selectedModel.hostingType)}</div>
                </div>
                {selectedModel.hostingType === 'self_hosted' && (
                  <div>
                    <Label>Thermal State</Label>
                    <div className="mt-1">{getThermalBadge(selectedModel.thermalState)}</div>
                    {selectedModel.warmupTimeSeconds && (
                      <p className="text-xs text-muted-foreground mt-1">
                        Warmup: {selectedModel.warmupTimeSeconds}s
                      </p>
                    )}
                  </div>
                )}
              </div>

              {/* Category & Specialty */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="category">Category</Label>
                  <Input 
                    id="category"
                    value={selectedModel.category} 
                    onChange={(e) => setSelectedModel({...selectedModel, category: e.target.value})}
                  />
                </div>
                <div>
                  <Label htmlFor="specialty">Specialty</Label>
                  <Input 
                    id="specialty"
                    value={selectedModel.specialty || ''} 
                    onChange={(e) => setSelectedModel({...selectedModel, specialty: e.target.value})}
                    placeholder="e.g., classification, detection, protein_folding"
                  />
                </div>
              </div>

              {/* Primary Mode & Min Tier */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="primaryMode">Primary Mode</Label>
                  <Input 
                    id="primaryMode"
                    value={selectedModel.primaryMode} 
                    onChange={(e) => setSelectedModel({...selectedModel, primaryMode: e.target.value})}
                    placeholder="e.g., chat, inference, embedding"
                  />
                </div>
                <div>
                  <Label htmlFor="minTier">Minimum Tier</Label>
                  <Input 
                    id="minTier"
                    type="number"
                    min={1}
                    max={5}
                    value={selectedModel.minTier} 
                    onChange={(e) => setSelectedModel({...selectedModel, minTier: parseInt(e.target.value) || 1})}
                  />
                </div>
              </div>

              {/* Capabilities */}
              <div>
                <Label htmlFor="capabilities">Capabilities (comma-separated)</Label>
                <Input 
                  id="capabilities"
                  value={selectedModel.capabilities?.join(', ') || ''} 
                  onChange={(e) => setSelectedModel({
                    ...selectedModel, 
                    capabilities: e.target.value.split(',').map(c => c.trim()).filter(Boolean)
                  })}
                  placeholder="e.g., chat, vision, function_calling"
                />
              </div>

              {/* Input/Output Modalities */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="inputModalities">Input Modalities (comma-separated)</Label>
                  <Input 
                    id="inputModalities"
                    value={selectedModel.inputModalities?.join(', ') || ''} 
                    onChange={(e) => setSelectedModel({
                      ...selectedModel, 
                      inputModalities: e.target.value.split(',').map(c => c.trim()).filter(Boolean)
                    })}
                    placeholder="e.g., text, image, audio"
                  />
                </div>
                <div>
                  <Label htmlFor="outputModalities">Output Modalities (comma-separated)</Label>
                  <Input 
                    id="outputModalities"
                    value={selectedModel.outputModalities?.join(', ') || ''} 
                    onChange={(e) => setSelectedModel({
                      ...selectedModel, 
                      outputModalities: e.target.value.split(',').map(c => c.trim()).filter(Boolean)
                    })}
                    placeholder="e.g., text, json, image"
                  />
                </div>
              </div>

              {/* License */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="license">License</Label>
                  <Input 
                    id="license"
                    value={selectedModel.license || ''} 
                    onChange={(e) => setSelectedModel({...selectedModel, license: e.target.value})}
                    placeholder="e.g., Apache-2.0, MIT, Llama-3.3"
                  />
                </div>
                <div>
                  <Label>Commercial Use</Label>
                  <div className="flex items-center space-x-2 mt-2">
                    <Switch
                      id="commercialUse"
                      checked={selectedModel.commercialUseAllowed}
                      onCheckedChange={(checked) => setSelectedModel({...selectedModel, commercialUseAllowed: checked})}
                    />
                    <Label htmlFor="commercialUse" className="font-normal">
                      {selectedModel.commercialUseAllowed ? 'Allowed' : 'Not Allowed'}
                    </Label>
                  </div>
                </div>
              </div>

              {/* Context Window */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="contextWindow">Context Window</Label>
                  <Input 
                    id="contextWindow"
                    type="number"
                    value={selectedModel.contextWindow || ''} 
                    onChange={(e) => setSelectedModel({...selectedModel, contextWindow: parseInt(e.target.value) || 0})}
                    placeholder="e.g., 128000"
                  />
                </div>
                <div>
                  <Label htmlFor="maxTokens">Max Output Tokens</Label>
                  <Input 
                    id="maxTokens"
                    type="number"
                    value={selectedModel.maxTokens || ''} 
                    onChange={(e) => setSelectedModel({...selectedModel, maxTokens: parseInt(e.target.value) || 0})}
                    placeholder="e.g., 4096"
                  />
                </div>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowEditDialog(false)}>
              Cancel
            </Button>
            <Button 
              onClick={() => selectedModel && updateModelMutation.mutate(selectedModel)}
              disabled={updateModelMutation.isPending}
            >
              {updateModelMutation.isPending ? 'Saving...' : 'Save Changes'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
