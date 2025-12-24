'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { 
  Settings, 
  Save, 
  RefreshCw, 
  History,
  AlertTriangle,
  Lock,
  Unlock
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
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
import { apiClient } from '@/lib/api';

interface ConfigCategory {
  id: string;
  name: string;
  description: string;
  icon: string;
}

interface ConfigValue {
  key: string;
  value: unknown;
  valueType: string;
  displayName: string;
  description?: string;
  unit?: string;
  isOverridden: boolean;
}

interface AuditEntry {
  id: string;
  config_key: string;
  action: string;
  new_value: unknown;
  changed_by: string;
  created_at: string;
}

export default function ConfigurationPage() {
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [editingConfig, setEditingConfig] = useState<ConfigValue | null>(null);
  const [editValue, setEditValue] = useState<string>('');
  const queryClient = useQueryClient();

  const { data: categories } = useQuery<ConfigCategory[]>({
    queryKey: ['configuration', 'categories'],
    queryFn: async () => {
      const res = await apiClient.get<{ categories: ConfigCategory[] }>('/configuration/categories');
      return res.data.categories;
    },
  });

  const { data: configs, isLoading: configsLoading } = useQuery<ConfigValue[]>({
    queryKey: ['configuration', 'category', selectedCategory],
    queryFn: async () => {
      if (!selectedCategory) return [];
      const res = await apiClient.get<{ configs: ConfigValue[] }>(`/configuration/category/${selectedCategory}`);
      return res.data.configs;
    },
    enabled: !!selectedCategory,
  });

  const { data: auditLog } = useQuery<AuditEntry[]>({
    queryKey: ['configuration', 'audit'],
    queryFn: async () => {
      const res = await apiClient.get<{ auditLog: AuditEntry[] }>('/configuration/audit');
      return res.data.auditLog;
    },
  });

  const updateConfig = useMutation({
    mutationFn: async ({ key, value }: { key: string; value: unknown }) => {
      await apiClient.put(`/configuration/${key}`, { value });
    },
    onSuccess: () => {
      console.log('Configuration updated');
      queryClient.invalidateQueries({ queryKey: ['configuration'] });
      setEditingConfig(null);
    },
    onError: () => {
      console.error('Failed to update configuration');
    },
  });

  const handleEdit = (config: ConfigValue) => {
    setEditingConfig(config);
    setEditValue(String(config.value));
  };

  const handleSave = () => {
    if (!editingConfig) return;
    
    let parsedValue: unknown = editValue;
    if (editingConfig.valueType === 'integer' || editingConfig.valueType === 'duration') {
      parsedValue = parseInt(editValue, 10);
    } else if (editingConfig.valueType === 'decimal' || editingConfig.valueType === 'percentage') {
      parsedValue = parseFloat(editValue);
    } else if (editingConfig.valueType === 'boolean') {
      parsedValue = editValue === 'true';
    } else if (editingConfig.valueType === 'json') {
      parsedValue = JSON.parse(editValue);
    }

    updateConfig.mutate({ key: editingConfig.key, value: parsedValue });
  };

  const formatValue = (config: ConfigValue) => {
    if (config.valueType === 'percentage') {
      return `${(Number(config.value) * 100).toFixed(0)}%`;
    }
    if (config.valueType === 'duration') {
      return `${config.value} ${config.unit || 'seconds'}`;
    }
    return String(config.value);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Configuration</h1>
          <p className="text-muted-foreground">
            Manage system configuration and tenant overrides
          </p>
        </div>
        <Button variant="outline" onClick={() => queryClient.invalidateQueries({ queryKey: ['configuration'] })}>
          <RefreshCw className="mr-2 h-4 w-4" />
          Refresh
        </Button>
      </div>

      <Tabs defaultValue="settings">
        <TabsList>
          <TabsTrigger value="settings">Settings</TabsTrigger>
          <TabsTrigger value="audit">Audit Log</TabsTrigger>
        </TabsList>

        <TabsContent value="settings" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-4">
            <Card className="md:col-span-1">
              <CardHeader>
                <CardTitle className="text-lg">Categories</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {categories?.map((cat) => (
                  <Button
                    key={cat.id}
                    variant={selectedCategory === cat.id ? 'default' : 'ghost'}
                    className="w-full justify-start"
                    onClick={() => setSelectedCategory(cat.id)}
                  >
                    <Settings className="mr-2 h-4 w-4" />
                    {cat.name}
                  </Button>
                ))}
              </CardContent>
            </Card>

            <Card className="md:col-span-3">
              <CardHeader>
                <CardTitle>
                  {categories?.find(c => c.id === selectedCategory)?.name || 'Select a category'}
                </CardTitle>
                <CardDescription>
                  {categories?.find(c => c.id === selectedCategory)?.description}
                </CardDescription>
              </CardHeader>
              <CardContent>
                {selectedCategory ? (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Setting</TableHead>
                        <TableHead>Value</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {configs?.map((config) => (
                        <TableRow key={config.key}>
                          <TableCell>
                            <div>
                              <p className="font-medium">{config.displayName}</p>
                              <p className="text-xs text-muted-foreground">{config.key}</p>
                            </div>
                          </TableCell>
                          <TableCell>
                            <code className="px-2 py-1 bg-muted rounded text-sm">
                              {formatValue(config)}
                            </code>
                          </TableCell>
                          <TableCell>
                            {config.isOverridden ? (
                              <Badge variant="secondary">
                                <Lock className="mr-1 h-3 w-3" />
                                Overridden
                              </Badge>
                            ) : (
                              <Badge variant="outline">
                                <Unlock className="mr-1 h-3 w-3" />
                                Default
                              </Badge>
                            )}
                          </TableCell>
                          <TableCell className="text-right">
                            <Button variant="ghost" size="sm" onClick={() => handleEdit(config)}>
                              Edit
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                ) : (
                  <p className="text-muted-foreground text-center py-8">
                    Select a category to view settings
                  </p>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="audit" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <History className="h-5 w-5" />
                Configuration Audit Log
              </CardTitle>
              <CardDescription>History of all configuration changes</CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Key</TableHead>
                    <TableHead>Action</TableHead>
                    <TableHead>New Value</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {auditLog?.map((entry) => (
                    <TableRow key={entry.id}>
                      <TableCell>{new Date(entry.created_at).toLocaleString()}</TableCell>
                      <TableCell><code className="text-sm">{entry.config_key}</code></TableCell>
                      <TableCell>
                        <Badge variant="outline">{entry.action}</Badge>
                      </TableCell>
                      <TableCell>
                        <code className="text-sm">{JSON.stringify(entry.new_value)}</code>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <Dialog open={!!editingConfig} onOpenChange={() => setEditingConfig(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Configuration</DialogTitle>
            <DialogDescription>
              {editingConfig?.displayName} ({editingConfig?.key})
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Value ({editingConfig?.valueType})</Label>
              {editingConfig?.valueType === 'boolean' ? (
                <div className="flex items-center space-x-2">
                  <Switch
                    checked={editValue === 'true'}
                    onCheckedChange={(checked: boolean) => setEditValue(String(checked))}
                  />
                  <span>{editValue === 'true' ? 'Enabled' : 'Disabled'}</span>
                </div>
              ) : (
                <Input
                  value={editValue}
                  onChange={(e) => setEditValue(e.target.value)}
                  type={editingConfig?.valueType === 'integer' || editingConfig?.valueType === 'decimal' ? 'number' : 'text'}
                />
              )}
              {editingConfig?.unit && (
                <p className="text-xs text-muted-foreground">Unit: {editingConfig.unit}</p>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingConfig(null)}>Cancel</Button>
            <Button onClick={handleSave} disabled={updateConfig.isPending}>
              <Save className="mr-2 h-4 w-4" />
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
