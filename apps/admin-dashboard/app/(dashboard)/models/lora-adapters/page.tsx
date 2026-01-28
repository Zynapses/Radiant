'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Slider } from '@/components/ui/slider';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { 
  Layers, 
  RefreshCw, 
  Settings,
  Zap,
  Pin,
  User,
  Globe,
  Trash2,
  CheckCircle,
  XCircle,
  Clock
} from 'lucide-react';
import { toast } from 'sonner';

interface LoraConfig {
  enabled: boolean;
  use_global_adapter: boolean;
  use_user_adapter: boolean;
  global_scale: number;
  user_scale: number;
  auto_selection_enabled: boolean;
  rollback_enabled: boolean;
  warmup_enabled: boolean;
  warmup_interval_minutes: number;
  max_adapters_in_memory: number;
  lru_eviction_enabled: boolean;
}

interface AdapterInfo {
  adapter_id: string;
  adapter_name: string;
  adapter_layer: 'global' | 'user' | 'domain';
  base_model: string;
  s3_key: string;
  is_pinned: boolean;
  is_active: boolean;
  scale: number;
  load_count: number;
  last_used_at: string;
  created_at: string;
  invocation_count?: number;
}

interface DashboardData {
  config: LoraConfig;
  layerCounts: Record<string, { count: number; active: number; pinned: number }>;
  usage: {
    totalInvocations: number;
    uniqueAdapters: number;
    avgLatency: number;
    successRate: string;
  };
  topAdapters: AdapterInfo[];
  recentWarmups: Array<{
    id: string;
    trigger_type: string;
    status: string;
    created_at: string;
  }>;
}

export default function LoraAdaptersPage() {
  const [dashboard, setDashboard] = useState<DashboardData | null>(null);
  const [adapters, setAdapters] = useState<AdapterInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [config, setConfig] = useState<LoraConfig | null>(null);
  const [selectedLayer, setSelectedLayer] = useState<string>('all');

  useEffect(() => {
    fetchDashboard();
    fetchAdapters();
  }, []);

  async function fetchDashboard() {
    try {
      const res = await fetch('/api/admin/lora/dashboard');
      const data = await res.json();
      setDashboard(data);
      setConfig(data.config);
    } catch (error) {
      console.error('Failed to fetch dashboard:', error);
      toast.error('Failed to load dashboard');
    } finally {
      setLoading(false);
    }
  }

  async function fetchAdapters(layer?: string) {
    try {
      const url = layer && layer !== 'all' 
        ? `/api/admin/lora/adapters?layer=${layer}`
        : '/api/admin/lora/adapters';
      const res = await fetch(url);
      const data = await res.json();
      setAdapters(data.adapters || []);
    } catch (error) {
      console.error('Failed to fetch adapters:', error);
    }
  }

  async function saveConfig() {
    if (!config) return;
    setSaving(true);
    try {
      const res = await fetch('/api/admin/lora/config', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(config),
      });
      if (res.ok) {
        toast.success('Configuration saved');
      } else {
        toast.error('Failed to save configuration');
      }
    } catch (error) {
      console.error('Failed to save config:', error);
      toast.error('Failed to save configuration');
    } finally {
      setSaving(false);
    }
  }

  async function triggerWarmup() {
    try {
      const res = await fetch('/api/admin/lora/warmup', { method: 'POST' });
      if (res.ok) {
        toast.success('Warmup triggered - global adapters loading');
        fetchDashboard();
      } else {
        toast.error('Failed to trigger warmup');
      }
    } catch (error) {
      console.error('Failed to trigger warmup:', error);
      toast.error('Failed to trigger warmup');
    }
  }

  async function toggleAdapter(adapterId: string, isActive: boolean) {
    try {
      const res = await fetch(`/api/admin/lora/adapters/${adapterId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_active: isActive }),
      });
      if (res.ok) {
        toast.success(isActive ? 'Adapter activated' : 'Adapter deactivated');
        fetchAdapters(selectedLayer);
      } else {
        toast.error('Failed to update adapter');
      }
    } catch (error) {
      console.error('Failed to toggle adapter:', error);
      toast.error('Failed to update adapter');
    }
  }

  async function deleteAdapter(adapterId: string) {
    try {
      const res = await fetch(`/api/admin/lora/adapters/${adapterId}`, { method: 'DELETE' });
      if (res.ok) {
        toast.success('Adapter deleted');
        fetchAdapters(selectedLayer);
        fetchDashboard();
      } else {
        const data = await res.json();
        toast.error(data.error || 'Failed to delete adapter');
      }
    } catch (error) {
      console.error('Failed to delete adapter:', error);
      toast.error('Failed to delete adapter');
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const globalCount = dashboard?.layerCounts?.global?.count || 0;
  const userCount = dashboard?.layerCounts?.user?.count || 0;
  const _domainCount = dashboard?.layerCounts?.domain?.count || 0;
  void _domainCount; // Reserved for domain stats display

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">LoRA Adapters</h1>
          <p className="text-muted-foreground">
            Tri-Layer Architecture: Genesis → Cato (Global) → User (Personal)
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={() => { fetchDashboard(); fetchAdapters(selectedLayer); }}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
          <Button onClick={triggerWarmup}>
            <Zap className="h-4 w-4 mr-2" />
            Warm Up Global
          </Button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Global Adapters</CardTitle>
            <Globe className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{globalCount}</div>
            <p className="text-xs text-muted-foreground">
              {dashboard?.layerCounts?.global?.pinned || 0} pinned (never evicted)
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">User Adapters</CardTitle>
            <User className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{userCount}</div>
            <p className="text-xs text-muted-foreground">
              {dashboard?.layerCounts?.user?.active || 0} active
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Invocations (24h)</CardTitle>
            <Zap className="h-4 w-4 text-yellow-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{dashboard?.usage.totalInvocations || 0}</div>
            <p className="text-xs text-muted-foreground">
              {dashboard?.usage.successRate}% success rate
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Avg Latency</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{(dashboard?.usage.avgLatency || 0).toFixed(0)}ms</div>
            <p className="text-xs text-muted-foreground">
              {dashboard?.usage.uniqueAdapters || 0} unique adapters used
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Tri-Layer Architecture Diagram */}
      <Card>
        <CardHeader>
          <CardTitle>Tri-Layer Adapter Stacking</CardTitle>
          <CardDescription>
            W_Final = W_Genesis + (scale × W_Cato) + (scale × W_User)
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center gap-4 py-4">
            <div className="text-center p-4 border rounded-lg bg-muted/50">
              <div className="text-xs text-muted-foreground mb-1">Layer 0</div>
              <div className="font-bold">Genesis</div>
              <div className="text-sm text-muted-foreground">Base Model</div>
              <Badge variant="outline" className="mt-2">Frozen</Badge>
            </div>
            <div className="text-2xl text-muted-foreground">+</div>
            <div className="text-center p-4 border rounded-lg border-blue-500/50 bg-blue-500/10">
              <div className="text-xs text-muted-foreground mb-1">Layer 1</div>
              <div className="font-bold text-blue-600">Cato</div>
              <div className="text-sm text-muted-foreground">Global Constitution</div>
              <Badge className="mt-2 bg-blue-500">
                <Pin className="h-3 w-3 mr-1" />
                Pinned
              </Badge>
            </div>
            <div className="text-2xl text-muted-foreground">+</div>
            <div className="text-center p-4 border rounded-lg border-green-500/50 bg-green-500/10">
              <div className="text-xs text-muted-foreground mb-1">Layer 2</div>
              <div className="font-bold text-green-600">User</div>
              <div className="text-sm text-muted-foreground">Personal Context</div>
              <Badge variant="secondary" className="mt-2">LRU Eviction</Badge>
            </div>
          </div>
        </CardContent>
      </Card>

      <Tabs defaultValue="config" className="space-y-4">
        <TabsList>
          <TabsTrigger value="config">
            <Settings className="h-4 w-4 mr-2" />
            Configuration
          </TabsTrigger>
          <TabsTrigger value="adapters">
            <Layers className="h-4 w-4 mr-2" />
            Adapters
          </TabsTrigger>
          <TabsTrigger value="warmup">
            <Zap className="h-4 w-4 mr-2" />
            Warmup
          </TabsTrigger>
        </TabsList>

        <TabsContent value="config" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>LoRA Settings</CardTitle>
              <CardDescription>
                Configure adapter stacking behavior
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {config && (
                <>
                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label>Enable LoRA Adapters</Label>
                      <p className="text-sm text-muted-foreground">
                        Use adapter stacking for personalized responses
                      </p>
                    </div>
                    <Switch
                      checked={config.enabled}
                      onCheckedChange={(v) => setConfig({ ...config, enabled: v })}
                    />
                  </div>

                  <div className="grid gap-6 md:grid-cols-2">
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <Label>Use Global Adapter (Cato)</Label>
                        <Switch
                          checked={config.use_global_adapter}
                          onCheckedChange={(v) => setConfig({ ...config, use_global_adapter: v })}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Global Scale: {config.global_scale.toFixed(2)}</Label>
                        <Slider
                          value={[config.global_scale]}
                          onValueChange={([v]) => setConfig({ ...config, global_scale: v })}
                          min={0}
                          max={2}
                          step={0.1}
                        />
                      </div>
                    </div>

                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <Label>Use User Adapter</Label>
                        <Switch
                          checked={config.use_user_adapter}
                          onCheckedChange={(v) => setConfig({ ...config, use_user_adapter: v })}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>User Scale: {config.user_scale.toFixed(2)}</Label>
                        <Slider
                          value={[config.user_scale]}
                          onValueChange={([v]) => setConfig({ ...config, user_scale: v })}
                          min={0}
                          max={2}
                          step={0.1}
                        />
                      </div>
                    </div>
                  </div>

                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="maxAdapters">Max Adapters in Memory</Label>
                      <Input
                        id="maxAdapters"
                        type="number"
                        value={config.max_adapters_in_memory}
                        onChange={(e) => setConfig({ ...config, max_adapters_in_memory: parseInt(e.target.value) || 50 })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="warmupInterval">Warmup Interval (minutes)</Label>
                      <Input
                        id="warmupInterval"
                        type="number"
                        value={config.warmup_interval_minutes}
                        onChange={(e) => setConfig({ ...config, warmup_interval_minutes: parseInt(e.target.value) || 15 })}
                      />
                    </div>
                  </div>

                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <div className="space-y-0.5">
                        <Label>Auto Selection</Label>
                        <p className="text-sm text-muted-foreground">
                          Automatically select best adapter for task
                        </p>
                      </div>
                      <Switch
                        checked={config.auto_selection_enabled}
                        onCheckedChange={(v) => setConfig({ ...config, auto_selection_enabled: v })}
                      />
                    </div>

                    <div className="flex items-center justify-between">
                      <div className="space-y-0.5">
                        <Label>Rollback Enabled</Label>
                        <p className="text-sm text-muted-foreground">
                          Fall back to base model if adapter fails
                        </p>
                      </div>
                      <Switch
                        checked={config.rollback_enabled}
                        onCheckedChange={(v) => setConfig({ ...config, rollback_enabled: v })}
                      />
                    </div>

                    <div className="flex items-center justify-between">
                      <div className="space-y-0.5">
                        <Label>LRU Eviction</Label>
                        <p className="text-sm text-muted-foreground">
                          Evict least-recently-used adapters when at capacity
                        </p>
                      </div>
                      <Switch
                        checked={config.lru_eviction_enabled}
                        onCheckedChange={(v) => setConfig({ ...config, lru_eviction_enabled: v })}
                      />
                    </div>
                  </div>

                  <Button onClick={saveConfig} disabled={saving}>
                    {saving ? 'Saving...' : 'Save Configuration'}
                  </Button>
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="adapters" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Adapter Registry</CardTitle>
                  <CardDescription>
                    Manage LoRA adapters by layer
                  </CardDescription>
                </div>
                <Select value={selectedLayer} onValueChange={(v) => { setSelectedLayer(v); fetchAdapters(v); }}>
                  <SelectTrigger className="w-[150px]">
                    <SelectValue placeholder="Filter by layer" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Layers</SelectItem>
                    <SelectItem value="global">Global (Cato)</SelectItem>
                    <SelectItem value="user">User</SelectItem>
                    <SelectItem value="domain">Domain</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {adapters.map((adapter) => (
                  <div
                    key={adapter.adapter_id}
                    className="flex items-center justify-between p-4 border rounded-lg"
                  >
                    <div className="flex items-center gap-4">
                      {adapter.adapter_layer === 'global' && <Globe className="h-5 w-5 text-blue-500" />}
                      {adapter.adapter_layer === 'user' && <User className="h-5 w-5 text-green-500" />}
                      {adapter.adapter_layer === 'domain' && <Layers className="h-5 w-5 text-purple-500" />}
                      <div>
                        <div className="font-medium">{adapter.adapter_name}</div>
                        <div className="text-sm text-muted-foreground">
                          {adapter.base_model} • Scale: {adapter.scale}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      {adapter.is_pinned && (
                        <Badge variant="secondary">
                          <Pin className="h-3 w-3 mr-1" />
                          Pinned
                        </Badge>
                      )}
                      <Badge variant={adapter.is_active ? 'default' : 'outline'}>
                        {adapter.is_active ? 'Active' : 'Inactive'}
                      </Badge>
                      <Switch
                        checked={adapter.is_active}
                        onCheckedChange={(v) => toggleAdapter(adapter.adapter_id, v)}
                      />
                      {!adapter.is_pinned && (
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => deleteAdapter(adapter.adapter_id)}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
                {adapters.length === 0 && (
                  <div className="text-center text-muted-foreground py-8">
                    No adapters found
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="warmup" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Warmup History</CardTitle>
              <CardDescription>
                Recent adapter warmup events
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {dashboard?.recentWarmups.map((warmup) => (
                  <div
                    key={warmup.id}
                    className="flex items-center justify-between p-3 border rounded-lg"
                  >
                    <div className="flex items-center gap-3">
                      {warmup.status === 'completed' && <CheckCircle className="h-5 w-5 text-green-500" />}
                      {warmup.status === 'pending' && <Clock className="h-5 w-5 text-yellow-500" />}
                      {warmup.status === 'failed' && <XCircle className="h-5 w-5 text-red-500" />}
                      <div>
                        <div className="font-medium capitalize">{warmup.trigger_type} Warmup</div>
                        <div className="text-sm text-muted-foreground">
                          {new Date(warmup.created_at).toLocaleString()}
                        </div>
                      </div>
                    </div>
                    <Badge variant={warmup.status === 'completed' ? 'default' : warmup.status === 'pending' ? 'secondary' : 'destructive'}>
                      {warmup.status}
                    </Badge>
                  </div>
                ))}
                {(!dashboard?.recentWarmups || dashboard.recentWarmups.length === 0) && (
                  <div className="text-center text-muted-foreground py-8">
                    No warmup events yet
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
