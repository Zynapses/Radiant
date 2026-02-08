'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Loader2, Save, RotateCcw, Settings, Database, Shield, Cpu, MessageSquare } from 'lucide-react';

interface TenantSettings {
  tenantId: string;
  tenantName?: string;
  tenantDisplayName?: string;
  chatRetentionDays: number;
  fileRetentionDays: number;
  auditLogRetentionDays: number;
  maxStorageGb: number | null;
  storageTierAutoPromote: boolean;
  hotToWarmHours: number;
  warmToColdDays: number;
  coldToGlacierYears: number;
  defaultModelId: string | null;
  maxTokensPerRequest: number;
  temperatureDefault: number;
  enableStreaming: boolean;
  enableCollaboration: boolean;
  enableFileUpload: boolean;
  enableConversationExport: boolean;
  enableConversationFork: boolean;
  complianceFrameworks: string[];
  dataClassificationDefault: string;
  requireEncryption: boolean;
  updatedAt: string;
  updatedBy: string | null;
}

export default function TenantSettingsPage() {
  const queryClient = useQueryClient();
  const [selectedTenantId, setSelectedTenantId] = useState<string | null>(null);
  const [editValues, setEditValues] = useState<Partial<TenantSettings>>({});
  const [hasChanges, setHasChanges] = useState(false);

  const { data: settingsList, isLoading: isLoadingList } = useQuery({
    queryKey: ['tenant-settings'],
    queryFn: () => api.get('/admin/tenant-settings'),
  });

  const { data: tenantDetail, isLoading: isLoadingDetail } = useQuery<TenantSettings>({
    queryKey: ['tenant-settings', selectedTenantId],
    queryFn: () => api.get(`/admin/tenant-settings/${selectedTenantId}`) as Promise<TenantSettings>,
    enabled: !!selectedTenantId,
  });

  const updateMutation = useMutation({
    mutationFn: (updates: Partial<TenantSettings>) =>
      api.put(`/admin/tenant-settings/${selectedTenantId}`, updates),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tenant-settings'] });
      setHasChanges(false);
      setEditValues({});
    },
  });

  const resetMutation = useMutation({
    mutationFn: () => api.post(`/admin/tenant-settings/${selectedTenantId}/reset`, {}),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tenant-settings'] });
      setHasChanges(false);
      setEditValues({});
    },
  });

  const settings: TenantSettings | null = tenantDetail || null;
  const merged = settings ? { ...settings, ...editValues } : null;

  const handleChange = (field: string, value: unknown) => {
    setEditValues(prev => ({ ...prev, [field]: value }));
    setHasChanges(true);
  };

  const handleSave = () => {
    if (Object.keys(editValues).length > 0) {
      updateMutation.mutate(editValues);
    }
  };

  const tenants = (settingsList as { data?: TenantSettings[] })?.data || [];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Tenant Settings</h1>
          <p className="text-muted-foreground">
            Unified settings for retention, storage, AI, features, and compliance per tenant
          </p>
        </div>
        {selectedTenantId && (
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={() => resetMutation.mutate()}
              disabled={resetMutation.isPending}
            >
              {resetMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <RotateCcw className="h-4 w-4 mr-2" />}
              Reset to Defaults
            </Button>
            <Button
              onClick={handleSave}
              disabled={!hasChanges || updateMutation.isPending}
            >
              {updateMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
              Save Changes
            </Button>
          </div>
        )}
      </div>

      <div className="grid grid-cols-12 gap-6">
        {/* Tenant List */}
        <div className="col-span-3">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Tenants</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {isLoadingList ? (
                <div className="flex items-center justify-center p-4">
                  <Loader2 className="h-4 w-4 animate-spin" />
                </div>
              ) : (
                <div className="max-h-[600px] overflow-y-auto">
                  {tenants.map((t: TenantSettings) => (
                    <button
                      key={t.tenantId}
                      onClick={() => {
                        setSelectedTenantId(t.tenantId);
                        setEditValues({});
                        setHasChanges(false);
                      }}
                      className={`w-full text-left px-4 py-3 border-b hover:bg-muted/50 transition-colors ${
                        selectedTenantId === t.tenantId ? 'bg-muted' : ''
                      }`}
                    >
                      <div className="font-medium text-sm">{t.tenantDisplayName || t.tenantName || t.tenantId.slice(0, 8)}</div>
                      <div className="text-xs text-muted-foreground">
                        Retention: {t.chatRetentionDays}d
                      </div>
                    </button>
                  ))}
                  {tenants.length === 0 && (
                    <div className="p-4 text-sm text-muted-foreground text-center">No tenants found</div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Settings Detail */}
        <div className="col-span-9">
          {!selectedTenantId ? (
            <Card>
              <CardContent className="flex items-center justify-center py-16">
                <div className="text-center text-muted-foreground">
                  <Settings className="h-12 w-12 mx-auto mb-4 opacity-30" />
                  <p>Select a tenant to view and edit settings</p>
                </div>
              </CardContent>
            </Card>
          ) : isLoadingDetail ? (
            <Card>
              <CardContent className="flex items-center justify-center py-16">
                <Loader2 className="h-8 w-8 animate-spin" />
              </CardContent>
            </Card>
          ) : merged ? (
            <Tabs defaultValue="retention">
              <TabsList>
                <TabsTrigger value="retention"><Database className="h-4 w-4 mr-1" /> Retention</TabsTrigger>
                <TabsTrigger value="storage"><Database className="h-4 w-4 mr-1" /> Storage</TabsTrigger>
                <TabsTrigger value="ai"><Cpu className="h-4 w-4 mr-1" /> AI</TabsTrigger>
                <TabsTrigger value="features"><MessageSquare className="h-4 w-4 mr-1" /> Features</TabsTrigger>
                <TabsTrigger value="compliance"><Shield className="h-4 w-4 mr-1" /> Compliance</TabsTrigger>
              </TabsList>

              {/* Retention Tab */}
              <TabsContent value="retention">
                <Card>
                  <CardHeader>
                    <CardTitle>Retention Settings</CardTitle>
                    <CardDescription>
                      Control how long data is retained. Default is 180 days (6 months).
                      Tenants can reduce retention to save storage costs or extend for utility.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    <div className="grid grid-cols-3 gap-6">
                      <div className="space-y-2">
                        <Label htmlFor="chatRetention">Chat Retention (days)</Label>
                        <Input
                          id="chatRetention"
                          type="number"
                          min={7}
                          max={3650}
                          value={merged.chatRetentionDays}
                          onChange={(e) => handleChange('chatRetentionDays', parseInt(e.target.value, 10))}
                        />
                        <p className="text-xs text-muted-foreground">Min: 7 days, Max: 10 years</p>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="fileRetention">File Retention (days)</Label>
                        <Input
                          id="fileRetention"
                          type="number"
                          min={7}
                          max={3650}
                          value={merged.fileRetentionDays}
                          onChange={(e) => handleChange('fileRetentionDays', parseInt(e.target.value, 10))}
                        />
                        <p className="text-xs text-muted-foreground">Attachments and uploaded files</p>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="auditRetention">Audit Log Retention (days)</Label>
                        <Input
                          id="auditRetention"
                          type="number"
                          min={90}
                          max={3650}
                          value={merged.auditLogRetentionDays}
                          onChange={(e) => handleChange('auditLogRetentionDays', parseInt(e.target.value, 10))}
                        />
                        <p className="text-xs text-muted-foreground">Min: 90 days for compliance</p>
                      </div>
                    </div>
                    <div className="rounded-lg bg-muted/50 p-4">
                      <h4 className="text-sm font-medium mb-2">Retention Policy Summary</h4>
                      <div className="grid grid-cols-3 gap-4 text-sm">
                        <div>
                          <span className="text-muted-foreground">Chat Messages:</span>{' '}
                          <Badge variant="outline">{merged.chatRetentionDays} days</Badge>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Files:</span>{' '}
                          <Badge variant="outline">{merged.fileRetentionDays} days</Badge>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Audit Logs:</span>{' '}
                          <Badge variant="outline">{merged.auditLogRetentionDays} days</Badge>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              {/* Storage Tab */}
              <TabsContent value="storage">
                <Card>
                  <CardHeader>
                    <CardTitle>Storage Tier Settings</CardTitle>
                    <CardDescription>Configure automatic data tier transitions</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <Label>Auto-Promote Tiers</Label>
                        <p className="text-xs text-muted-foreground">Automatically move data between storage tiers</p>
                      </div>
                      <Switch
                        checked={merged.storageTierAutoPromote}
                        onCheckedChange={(v) => handleChange('storageTierAutoPromote', v)}
                      />
                    </div>
                    <div className="grid grid-cols-3 gap-6">
                      <div className="space-y-2">
                        <Label>Hot → Warm (hours)</Label>
                        <Input
                          type="number"
                          min={1}
                          max={720}
                          value={merged.hotToWarmHours}
                          onChange={(e) => handleChange('hotToWarmHours', parseInt(e.target.value, 10))}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Warm → Cold (days)</Label>
                        <Input
                          type="number"
                          min={7}
                          max={3650}
                          value={merged.warmToColdDays}
                          onChange={(e) => handleChange('warmToColdDays', parseInt(e.target.value, 10))}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Cold → Glacier (years)</Label>
                        <Input
                          type="number"
                          min={1}
                          max={30}
                          value={merged.coldToGlacierYears}
                          onChange={(e) => handleChange('coldToGlacierYears', parseInt(e.target.value, 10))}
                        />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label>Max Storage (GB)</Label>
                      <Input
                        type="number"
                        min={0}
                        placeholder="No limit"
                        value={merged.maxStorageGb ?? ''}
                        onChange={(e) => handleChange('maxStorageGb', e.target.value ? parseFloat(e.target.value) : null)}
                      />
                      <p className="text-xs text-muted-foreground">Leave empty for unlimited storage</p>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              {/* AI Tab */}
              <TabsContent value="ai">
                <Card>
                  <CardHeader>
                    <CardTitle>AI Settings</CardTitle>
                    <CardDescription>Default AI model configuration for this tenant</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    <div className="space-y-2">
                      <Label>Default Model ID</Label>
                      <Input
                        placeholder="e.g., anthropic/claude-sonnet-4-20250514"
                        value={merged.defaultModelId ?? ''}
                        onChange={(e) => handleChange('defaultModelId', e.target.value || null)}
                      />
                    </div>
                    <div className="grid grid-cols-3 gap-6">
                      <div className="space-y-2">
                        <Label>Max Tokens Per Request</Label>
                        <Input
                          type="number"
                          min={256}
                          max={200000}
                          value={merged.maxTokensPerRequest}
                          onChange={(e) => handleChange('maxTokensPerRequest', parseInt(e.target.value, 10))}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Default Temperature</Label>
                        <Input
                          type="number"
                          min={0}
                          max={2}
                          step={0.1}
                          value={merged.temperatureDefault}
                          onChange={(e) => handleChange('temperatureDefault', parseFloat(e.target.value))}
                        />
                      </div>
                    </div>
                    <div className="flex items-center justify-between">
                      <div>
                        <Label>Enable Streaming</Label>
                        <p className="text-xs text-muted-foreground">Allow streaming responses</p>
                      </div>
                      <Switch
                        checked={merged.enableStreaming}
                        onCheckedChange={(v) => handleChange('enableStreaming', v)}
                      />
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              {/* Features Tab */}
              <TabsContent value="features">
                <Card>
                  <CardHeader>
                    <CardTitle>Feature Flags</CardTitle>
                    <CardDescription>Enable or disable features for this tenant</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {[
                      { key: 'enableCollaboration', label: 'Collaboration', desc: 'Allow users to share conversations' },
                      { key: 'enableFileUpload', label: 'File Upload', desc: 'Allow file uploads in conversations' },
                      { key: 'enableConversationExport', label: 'Conversation Export', desc: 'Allow exporting chat history' },
                      { key: 'enableConversationFork', label: 'Conversation Fork', desc: 'Allow forking conversations' },
                    ].map(({ key, label, desc }) => (
                      <div key={key} className="flex items-center justify-between py-2 border-b last:border-0">
                        <div>
                          <Label>{label}</Label>
                          <p className="text-xs text-muted-foreground">{desc}</p>
                        </div>
                        <Switch
                          checked={(merged as Record<string, unknown>)[key] as boolean}
                          onCheckedChange={(v) => handleChange(key, v)}
                        />
                      </div>
                    ))}
                  </CardContent>
                </Card>
              </TabsContent>

              {/* Compliance Tab */}
              <TabsContent value="compliance">
                <Card>
                  <CardHeader>
                    <CardTitle>Compliance Settings</CardTitle>
                    <CardDescription>Regulatory frameworks and data classification</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    <div className="space-y-2">
                      <Label>Data Classification Default</Label>
                      <Select
                        value={merged.dataClassificationDefault}
                        onValueChange={(v) => handleChange('dataClassificationDefault', v)}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="PUBLIC">Public</SelectItem>
                          <SelectItem value="INTERNAL">Internal</SelectItem>
                          <SelectItem value="CONFIDENTIAL">Confidential</SelectItem>
                          <SelectItem value="RESTRICTED">Restricted</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="flex items-center justify-between">
                      <div>
                        <Label>Require Encryption</Label>
                        <p className="text-xs text-muted-foreground">Enforce encryption for all stored data</p>
                      </div>
                      <Switch
                        checked={merged.requireEncryption}
                        onCheckedChange={(v) => handleChange('requireEncryption', v)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Compliance Frameworks</Label>
                      <div className="flex flex-wrap gap-2">
                        {(merged.complianceFrameworks || []).map((fw: string) => (
                          <Badge key={fw} variant="secondary">{fw}</Badge>
                        ))}
                        {(merged.complianceFrameworks || []).length === 0 && (
                          <span className="text-sm text-muted-foreground">None configured</span>
                        )}
                      </div>
                    </div>
                    <div className="rounded-lg bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 p-4">
                      <p className="text-sm text-amber-800 dark:text-amber-200">
                        Compliance framework changes may require minimum retention periods. HIPAA requires 6-year (2190 day) retention for PHI data.
                      </p>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
          ) : null}
        </div>
      </div>
    </div>
  );
}
