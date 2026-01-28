'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { 
  Settings, 
  Save, 
  RefreshCw, 
  History,
  AlertTriangle,
  RotateCcw,
  Shield,
  Database,
  Gauge,
  Clock,
  Copy,
  Brain,
  ChevronRight
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { ScrollArea } from '@/components/ui/scroll-area';
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
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { apiClient } from '@/lib/api';

interface ConfigCategory {
  id: string;
  name: string;
  description?: string;
  icon?: string;
  sortOrder: number;
}

interface ConfigValue {
  id: string;
  category: string;
  key: string;
  value: unknown;
  valueType: string;
  displayName: string;
  description?: string;
  unit?: string;
  minValue?: number;
  maxValue?: number;
  defaultValue?: unknown;
  isSensitive: boolean;
  requiresRestart: boolean;
  sortOrder: number;
}

interface AuditEntry {
  id: string;
  configKey: string;
  oldValue: unknown;
  newValue: unknown;
  changedBy?: string;
  changedByEmail?: string;
  changeReason?: string;
  createdAt: string;
}

const categoryIcons: Record<string, React.ReactNode> = {
  circuit_breaker: <Shield className="h-4 w-4" />,
  connection_pool: <Database className="h-4 w-4" />,
  rate_limiting: <Gauge className="h-4 w-4" />,
  rate_limits: <Gauge className="h-4 w-4" />,
  timeouts: <Clock className="h-4 w-4" />,
  deduplication: <Copy className="h-4 w-4" />,
  ai_providers: <Brain className="h-4 w-4" />,
  ai: <Brain className="h-4 w-4" />,
  logging: <Settings className="h-4 w-4" />,
  error_handling: <AlertTriangle className="h-4 w-4" />,
  request_handling: <Shield className="h-4 w-4" />,
  thermal: <Gauge className="h-4 w-4" />,
  security: <Shield className="h-4 w-4" />,
  billing: <Database className="h-4 w-4" />,
  workflows: <Settings className="h-4 w-4" />,
  notifications: <Settings className="h-4 w-4" />,
  ui: <Settings className="h-4 w-4" />,
  integrations: <Settings className="h-4 w-4" />,
};

export function SystemConfigClient() {
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [editingConfig, setEditingConfig] = useState<ConfigValue | null>(null);
  const [editValue, setEditValue] = useState<string>('');
  const [showAuditLog, setShowAuditLog] = useState(false);
  const queryClient = useQueryClient();

  // Fetch categories
  const { data: categories, isLoading: categoriesLoading } = useQuery<ConfigCategory[]>({
    queryKey: ['system-config', 'categories'],
    queryFn: async () => {
      const res = await apiClient.get<{ data: ConfigCategory[] }>('/api/admin/system-config');
      return res.data || [];
    },
  });

  // Fetch configs for selected category
  const { data: configs, isLoading: configsLoading } = useQuery<ConfigValue[]>({
    queryKey: ['system-config', 'category', selectedCategory],
    queryFn: async () => {
      if (!selectedCategory) return [];
      const res = await apiClient.get<{ data: ConfigValue[] }>(`/api/admin/system-config?category=${selectedCategory}`);
      return res.data || [];
    },
    enabled: !!selectedCategory,
  });

  // Fetch audit log
  const { data: auditLog } = useQuery<AuditEntry[]>({
    queryKey: ['system-config', 'audit'],
    queryFn: async () => {
      const res = await apiClient.get<{ data: AuditEntry[] }>('/api/admin/system-config/audit');
      return res.data || [];
    },
    enabled: showAuditLog,
  });

  // Update config mutation
  const updateConfig = useMutation({
    mutationFn: async ({ category, key, value }: { category: string; key: string; value: unknown }) => {
      await apiClient.put('/api/admin/system-config', { category, key, value });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['system-config'] });
      setEditingConfig(null);
    },
  });

  // Reset to default mutation
  const resetConfig = useMutation({
    mutationFn: async ({ category, key }: { category: string; key: string }) => {
      await apiClient.post('/api/admin/system-config/reset', { category, key });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['system-config'] });
    },
  });

  const handleEdit = (config: ConfigValue) => {
    setEditingConfig(config);
    setEditValue(String(config.value));
  };

  const handleSave = () => {
    if (!editingConfig) return;
    
    let parsedValue: unknown = editValue;
    if (editingConfig.valueType === 'integer') {
      parsedValue = parseInt(editValue, 10);
    } else if (editingConfig.valueType === 'decimal' || editingConfig.valueType === 'percentage') {
      parsedValue = parseFloat(editValue);
    } else if (editingConfig.valueType === 'boolean') {
      parsedValue = editValue === 'true';
    } else if (editingConfig.valueType === 'json') {
      try {
        parsedValue = JSON.parse(editValue);
      } catch {
        return; // Invalid JSON
      }
    }

    updateConfig.mutate({ 
      category: editingConfig.category, 
      key: editingConfig.key, 
      value: parsedValue 
    });
  };

  const formatValue = (config: ConfigValue) => {
    if (config.valueType === 'percentage') {
      return `${(Number(config.value) * 100).toFixed(0)}%`;
    }
    if (config.unit) {
      return `${config.value} ${config.unit}`;
    }
    return String(config.value);
  };

  const isModified = (config: ConfigValue) => {
    return config.defaultValue !== undefined && 
           JSON.stringify(config.value) !== JSON.stringify(config.defaultValue);
  };

  const selectedCategoryData = categories?.find(c => c.id === selectedCategory);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">System Configuration</h1>
          <p className="text-muted-foreground">
            Manage runtime system settings for circuit breakers, connection pools, and more
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setShowAuditLog(true)}>
            <History className="mr-2 h-4 w-4" />
            Audit Log
          </Button>
          <Button variant="outline" onClick={() => queryClient.invalidateQueries({ queryKey: ['system-config'] })}>
            <RefreshCw className="mr-2 h-4 w-4" />
            Refresh
          </Button>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-4">
        {/* Category Sidebar */}
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle className="text-lg">Categories</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <ScrollArea className="h-[500px]">
              {categoriesLoading ? (
                <div className="p-4 text-center text-muted-foreground">Loading...</div>
              ) : (
                <div className="space-y-1 p-2">
                  {categories?.map((category) => (
                    <button
                      key={category.id}
                      onClick={() => setSelectedCategory(category.id)}
                      className={`w-full flex items-center justify-between rounded-lg px-3 py-2 text-left text-sm transition-colors hover:bg-accent ${
                        selectedCategory === category.id ? 'bg-accent' : ''
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        {categoryIcons[category.id] || <Settings className="h-4 w-4" />}
                        <span className="font-medium">{category.name}</span>
                      </div>
                      <ChevronRight className="h-4 w-4 text-muted-foreground" />
                    </button>
                  ))}
                </div>
              )}
            </ScrollArea>
          </CardContent>
        </Card>

        {/* Configuration Panel */}
        <Card className="lg:col-span-3">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>{selectedCategoryData?.name || 'Select a Category'}</CardTitle>
                <CardDescription>
                  {selectedCategoryData?.description || 'Choose a category from the sidebar to view and edit settings'}
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {!selectedCategory ? (
              <div className="flex h-[400px] items-center justify-center text-muted-foreground">
                <div className="text-center">
                  <Settings className="mx-auto h-12 w-12 opacity-50" />
                  <p className="mt-2">Select a category to view configuration</p>
                </div>
              </div>
            ) : configsLoading ? (
              <div className="flex h-[400px] items-center justify-center">
                <RefreshCw className="h-6 w-6 animate-spin" />
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Setting</TableHead>
                    <TableHead>Value</TableHead>
                    <TableHead>Default</TableHead>
                    <TableHead className="w-[100px]">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {configs?.map((config) => (
                    <TableRow key={config.id}>
                      <TableCell>
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <span className="font-medium">{config.displayName}</span>
                            {isModified(config) && (
                              <Badge variant="outline" className="text-xs">Modified</Badge>
                            )}
                            {config.requiresRestart && (
                              <TooltipProvider>
                                <Tooltip>
                                  <TooltipTrigger>
                                    <AlertTriangle className="h-3 w-3 text-yellow-500" />
                                  </TooltipTrigger>
                                  <TooltipContent>Requires restart to take effect</TooltipContent>
                                </Tooltip>
                              </TooltipProvider>
                            )}
                          </div>
                          {config.description && (
                            <p className="text-xs text-muted-foreground">{config.description}</p>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <code className="rounded bg-muted px-2 py-1 text-sm">
                          {formatValue(config)}
                        </code>
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {config.defaultValue !== undefined ? (
                          <code className="text-xs">
                            {config.unit ? `${config.defaultValue} ${config.unit}` : String(config.defaultValue)}
                          </code>
                        ) : '-'}
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleEdit(config)}
                          >
                            Edit
                          </Button>
                          {isModified(config) && (
                            <TooltipProvider>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => resetConfig.mutate({ 
                                      category: config.category, 
                                      key: config.key 
                                    })}
                                  >
                                    <RotateCcw className="h-3 w-3" />
                                  </Button>
                                </TooltipTrigger>
                                <TooltipContent>Reset to default</TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Edit Dialog */}
      <Dialog open={!!editingConfig} onOpenChange={() => setEditingConfig(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit {editingConfig?.displayName}</DialogTitle>
            <DialogDescription>
              {editingConfig?.description}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Value {editingConfig?.unit && `(${editingConfig.unit})`}</Label>
              {editingConfig?.valueType === 'integer' || editingConfig?.valueType === 'decimal' ? (
                <div className="space-y-2">
                  <Input
                    type="number"
                    value={editValue}
                    onChange={(e) => setEditValue(e.target.value)}
                    min={editingConfig?.minValue}
                    max={editingConfig?.maxValue}
                  />
                  {editingConfig?.minValue !== undefined && editingConfig?.maxValue !== undefined && (
                    <Slider
                      value={[parseFloat(editValue) || 0]}
                      onValueChange={([val]) => setEditValue(String(val))}
                      min={editingConfig.minValue}
                      max={editingConfig.maxValue}
                      step={editingConfig.valueType === 'decimal' ? 0.1 : 1}
                    />
                  )}
                  <p className="text-xs text-muted-foreground">
                    Range: {editingConfig?.minValue} - {editingConfig?.maxValue}
                  </p>
                </div>
              ) : editingConfig?.valueType === 'percentage' ? (
                <div className="space-y-2">
                  <Input
                    type="number"
                    value={(parseFloat(editValue) * 100).toFixed(0)}
                    onChange={(e) => setEditValue(String(parseFloat(e.target.value) / 100))}
                    min={(editingConfig?.minValue || 0) * 100}
                    max={(editingConfig?.maxValue || 1) * 100}
                  />
                  <Slider
                    value={[parseFloat(editValue) * 100 || 0]}
                    onValueChange={([val]) => setEditValue(String(val / 100))}
                    min={(editingConfig?.minValue || 0) * 100}
                    max={(editingConfig?.maxValue || 1) * 100}
                  />
                  <p className="text-xs text-muted-foreground">
                    {(parseFloat(editValue) * 100).toFixed(0)}%
                  </p>
                </div>
              ) : (
                <Input
                  value={editValue}
                  onChange={(e) => setEditValue(e.target.value)}
                />
              )}
            </div>
            {editingConfig?.defaultValue !== undefined && (
              <p className="text-sm text-muted-foreground">
                Default: <code>{String(editingConfig.defaultValue)}</code>
              </p>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingConfig(null)}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={updateConfig.isPending}>
              <Save className="mr-2 h-4 w-4" />
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Audit Log Dialog */}
      <Dialog open={showAuditLog} onOpenChange={setShowAuditLog}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>Configuration Audit Log</DialogTitle>
            <DialogDescription>
              Recent changes to system configuration
            </DialogDescription>
          </DialogHeader>
          <ScrollArea className="h-[400px]">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Setting</TableHead>
                  <TableHead>Old Value</TableHead>
                  <TableHead>New Value</TableHead>
                  <TableHead>Changed</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {auditLog?.map((entry) => (
                  <TableRow key={entry.id}>
                    <TableCell className="font-mono text-sm">{entry.configKey}</TableCell>
                    <TableCell>
                      <code className="text-xs">{JSON.stringify(entry.oldValue)}</code>
                    </TableCell>
                    <TableCell>
                      <code className="text-xs">{JSON.stringify(entry.newValue)}</code>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {new Date(entry.createdAt).toLocaleString()}
                    </TableCell>
                  </TableRow>
                ))}
                {(!auditLog || auditLog.length === 0) && (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center text-muted-foreground">
                      No changes recorded
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </ScrollArea>
        </DialogContent>
      </Dialog>
    </div>
  );
}
