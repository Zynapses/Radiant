'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Shield, BookOpen, Scale, Heart, Eye, Lock, AlertTriangle, Check, RefreshCw } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';

interface EthicsPreset {
  id: string;
  presetCode: string;
  presetName: string;
  description: string;
  presetType: 'secular' | 'religious' | 'corporate' | 'legal';
  isDefault: boolean;
  isEnabled: boolean;
  principles: Array<{
    code: string;
    name: string;
    description: string;
  }>;
  frameworkReferences: Array<{
    standard?: string;
    source?: string;
    text?: string;
    sections?: string[];
  }>;
}

interface TenantEthicsConfig {
  id: string;
  tenantId: string;
  presetId: string;
  strictMode: boolean;
  logEthicsDecisions: boolean;
}

const PRESET_TYPE_INFO = {
  secular: {
    icon: Scale,
    color: 'blue',
    description: 'Based on NIST, ISO, and EU AI Act standards',
  },
  religious: {
    icon: BookOpen,
    color: 'amber',
    description: 'Incorporates faith-based ethical principles',
  },
  corporate: {
    icon: Shield,
    color: 'green',
    description: 'Corporate governance and compliance focused',
  },
  legal: {
    icon: Lock,
    color: 'purple',
    description: 'Regulatory and legal compliance focused',
  },
};

export default function EthicsConfigPage() {
  const [presets, setPresets] = useState<EthicsPreset[]>([]);
  const [tenantConfig, setTenantConfig] = useState<TenantEthicsConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [presetsRes, configRes] = await Promise.all([
        fetch('/api/admin/ethics/presets'),
        fetch('/api/admin/ethics/config'),
      ]);

      if (presetsRes.ok) {
        const data = await presetsRes.json();
        setPresets(data.presets || []);
      }

      if (configRes.ok) {
        const data = await configRes.json();
        setTenantConfig(data.config);
      }
    } catch (error) {
      console.error('Failed to fetch ethics config:', error);
      // Use defaults
      setPresets([
        {
          id: '1',
          presetCode: 'secular_default',
          presetName: 'Secular AI Ethics (NIST/ISO)',
          description: 'Default ethics framework based on NIST AI RMF and ISO 42001',
          presetType: 'secular',
          isDefault: true,
          isEnabled: true,
          principles: [
            { code: 'beneficence', name: 'Beneficence', description: 'AI should benefit users and society' },
            { code: 'non_maleficence', name: 'Non-Maleficence', description: 'AI should not cause harm' },
            { code: 'autonomy', name: 'Respect for Autonomy', description: 'AI should respect user autonomy' },
            { code: 'justice', name: 'Justice', description: 'AI should be fair and non-discriminatory' },
            { code: 'explicability', name: 'Explicability', description: 'AI decisions should be explainable' },
          ],
          frameworkReferences: [
            { standard: 'NIST AI RMF', sections: ['1.1', '2.3', '3.1'] },
            { standard: 'ISO 42001', sections: ['5.2', '6.1', '7.3'] },
          ],
        },
        {
          id: '2',
          presetCode: 'christian_ethics',
          presetName: 'Christian AI Ethics',
          description: 'Ethics framework incorporating Christian principles alongside secular standards',
          presetType: 'religious',
          isDefault: false,
          isEnabled: false,
          principles: [
            { code: 'love_neighbor', name: 'Love Your Neighbor', description: 'AI should serve others with compassion' },
            { code: 'truth', name: 'Truth', description: 'AI should be truthful and not deceive' },
            { code: 'stewardship', name: 'Stewardship', description: 'AI should be used responsibly' },
          ],
          frameworkReferences: [
            { source: 'Matthew 22:39', text: 'Love your neighbor as yourself' },
            { source: 'John 8:32', text: 'The truth will set you free' },
          ],
        },
      ]);
    }
    setLoading(false);
  };

  const handlePresetToggle = async (presetId: string, enabled: boolean) => {
    setSaving(true);
    try {
      const response = await fetch(`/api/admin/ethics/presets/${presetId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isEnabled: enabled }),
      });

      if (response.ok) {
        setPresets(prev => prev.map(p => 
          p.id === presetId ? { ...p, isEnabled: enabled } : p
        ));
        toast({
          title: enabled ? 'Preset enabled' : 'Preset disabled',
          description: `Ethics preset has been ${enabled ? 'enabled' : 'disabled'}`,
        });
      }
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to update preset',
        variant: 'destructive',
      });
    }
    setSaving(false);
  };

  const handleSelectPreset = async (presetId: string) => {
    setSaving(true);
    try {
      const response = await fetch('/api/admin/ethics/config', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ presetId }),
      });

      if (response.ok) {
        setTenantConfig(prev => prev ? { ...prev, presetId } : null);
        toast({
          title: 'Preset selected',
          description: 'Ethics preset has been applied to your tenant',
        });
      }
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to select preset',
        variant: 'destructive',
      });
    }
    setSaving(false);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const activePreset = presets.find(p => p.id === tenantConfig?.presetId) || presets.find(p => p.isDefault);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">AI Ethics Configuration</h1>
        <p className="text-muted-foreground mt-2">
          Configure ethics frameworks for AI decision-making. Religious presets are disabled by default but can be enabled by administrators.
        </p>
      </div>

      {/* Current Configuration */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            Active Ethics Framework
          </CardTitle>
          <CardDescription>
            Currently applied ethics configuration for your tenant
          </CardDescription>
        </CardHeader>
        <CardContent>
          {activePreset && (
            <div className="flex items-start gap-4">
              <div className={`p-3 rounded-lg bg-${PRESET_TYPE_INFO[activePreset.presetType].color}-100`}>
                {(() => {
                  const Icon = PRESET_TYPE_INFO[activePreset.presetType].icon;
                  return <Icon className={`h-6 w-6 text-${PRESET_TYPE_INFO[activePreset.presetType].color}-700`} />;
                })()}
              </div>
              <div className="flex-1">
                <h3 className="font-semibold flex items-center gap-2">
                  {activePreset.presetName}
                  {activePreset.isDefault && (
                    <Badge variant="secondary">Default</Badge>
                  )}
                </h3>
                <p className="text-sm text-muted-foreground">{activePreset.description}</p>
                <div className="flex gap-2 mt-2">
                  {activePreset.principles.slice(0, 4).map(p => (
                    <Badge key={p.code} variant="outline">{p.name}</Badge>
                  ))}
                  {activePreset.principles.length > 4 && (
                    <Badge variant="outline">+{activePreset.principles.length - 4} more</Badge>
                  )}
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Available Presets */}
      <Tabs defaultValue="all">
        <TabsList>
          <TabsTrigger value="all">All Presets</TabsTrigger>
          <TabsTrigger value="secular">Secular</TabsTrigger>
          <TabsTrigger value="religious">Religious</TabsTrigger>
        </TabsList>

        <TabsContent value="all" className="space-y-4">
          {presets.map(preset => (
            <PresetCard
              key={preset.id}
              preset={preset}
              isActive={activePreset?.id === preset.id}
              onToggle={(enabled) => handlePresetToggle(preset.id, enabled)}
              onSelect={() => handleSelectPreset(preset.id)}
              saving={saving}
            />
          ))}
        </TabsContent>

        <TabsContent value="secular" className="space-y-4">
          {presets.filter(p => p.presetType === 'secular').map(preset => (
            <PresetCard
              key={preset.id}
              preset={preset}
              isActive={activePreset?.id === preset.id}
              onToggle={(enabled) => handlePresetToggle(preset.id, enabled)}
              onSelect={() => handleSelectPreset(preset.id)}
              saving={saving}
            />
          ))}
        </TabsContent>

        <TabsContent value="religious" className="space-y-4">
          <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg mb-4">
            <div className="flex items-start gap-2">
              <AlertTriangle className="h-5 w-5 text-amber-600 mt-0.5" />
              <div>
                <h4 className="font-medium text-amber-800">Religious Ethics Presets</h4>
                <p className="text-sm text-amber-700">
                  Religious ethics presets are disabled by default. Enabling them will incorporate faith-based principles
                  into AI decision-making. Ensure this aligns with your organization&apos;s policies and user expectations.
                </p>
              </div>
            </div>
          </div>
          {presets.filter(p => p.presetType === 'religious').map(preset => (
            <PresetCard
              key={preset.id}
              preset={preset}
              isActive={activePreset?.id === preset.id}
              onToggle={(enabled) => handlePresetToggle(preset.id, enabled)}
              onSelect={() => handleSelectPreset(preset.id)}
              saving={saving}
            />
          ))}
        </TabsContent>
      </Tabs>
    </div>
  );
}

function PresetCard({ 
  preset, 
  isActive, 
  onToggle, 
  onSelect,
  saving 
}: { 
  preset: EthicsPreset;
  isActive: boolean;
  onToggle: (enabled: boolean) => void;
  onSelect: () => void;
  saving: boolean;
}) {
  const typeInfo = PRESET_TYPE_INFO[preset.presetType];
  const Icon = typeInfo.icon;

  return (
    <Card className={isActive ? 'border-primary' : ''}>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className={`p-2 rounded-lg bg-${typeInfo.color}-100`}>
              <Icon className={`h-5 w-5 text-${typeInfo.color}-700`} />
            </div>
            <div>
              <CardTitle className="flex items-center gap-2">
                {preset.presetName}
                {preset.isDefault && <Badge variant="secondary">Default</Badge>}
                {isActive && <Badge className="bg-primary">Active</Badge>}
                {!preset.isEnabled && <Badge variant="outline" className="text-muted-foreground">Disabled</Badge>}
              </CardTitle>
              <CardDescription>{preset.description}</CardDescription>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <Label htmlFor={`enable-${preset.id}`} className="text-sm">
                {preset.presetType === 'religious' ? 'Enable Religious Preset' : 'Enabled'}
              </Label>
              <Switch
                id={`enable-${preset.id}`}
                checked={preset.isEnabled}
                onCheckedChange={onToggle}
                disabled={saving || preset.isDefault}
              />
            </div>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <h4 className="font-medium mb-2 flex items-center gap-1">
              <Heart className="h-4 w-4" /> Principles
            </h4>
            <ScrollArea className="h-32">
              <ul className="space-y-1">
                {preset.principles.map(p => (
                  <li key={p.code} className="text-sm">
                    <span className="font-medium">{p.name}:</span>{' '}
                    <span className="text-muted-foreground">{p.description}</span>
                  </li>
                ))}
              </ul>
            </ScrollArea>
          </div>
          <div>
            <h4 className="font-medium mb-2 flex items-center gap-1">
              <BookOpen className="h-4 w-4" /> Framework References
            </h4>
            <ScrollArea className="h-32">
              <ul className="space-y-1">
                {preset.frameworkReferences.map((ref, i) => (
                  <li key={i} className="text-sm">
                    {ref.standard && (
                      <>
                        <span className="font-medium">{ref.standard}</span>
                        {ref.sections && (
                          <span className="text-muted-foreground"> §{ref.sections.join(', ')}</span>
                        )}
                      </>
                    )}
                    {ref.source && (
                      <>
                        <span className="font-medium">{ref.source}:</span>{' '}
                        <span className="text-muted-foreground italic">&ldquo;{ref.text}&rdquo;</span>
                      </>
                    )}
                  </li>
                ))}
              </ul>
            </ScrollArea>
          </div>
        </div>

        {preset.isEnabled && !isActive && (
          <div className="mt-4 pt-4 border-t">
            <Button onClick={onSelect} disabled={saving}>
              <Check className="h-4 w-4 mr-2" />
              Apply This Preset
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
