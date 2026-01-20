'use client';

import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api/client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Slider } from '@/components/ui/slider';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import {
  Stethoscope, Scale, Code2, Lightbulb, GraduationCap, PenTool, FlaskConical,
  Save, LucideIcon, Settings2, Sparkles, Info, CheckCircle2, Loader2, Search, Zap, Brain
} from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

interface ModeConfig {
  enabled: boolean;
  defaultModel: string;
  temperature: number;
  systemPrompt: string;
}

interface DomainModesConfig {
  modes: Record<string, ModeConfig>;
  useTaxonomyDetection?: boolean;
}

const DOMAIN_MODES = [
  { id: 'general', name: 'General', icon: Lightbulb, description: 'Default mode for general queries', color: 'bg-amber-100 dark:bg-amber-900/30 text-amber-600' },
  { id: 'medical', name: 'Medical', icon: Stethoscope, description: 'Healthcare and medical topics', color: 'bg-red-100 dark:bg-red-900/30 text-red-600' },
  { id: 'legal', name: 'Legal', icon: Scale, description: 'Legal research and analysis', color: 'bg-slate-100 dark:bg-slate-800 text-slate-600' },
  { id: 'code', name: 'Code', icon: Code2, description: 'Programming and development', color: 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600' },
  { id: 'academic', name: 'Academic', icon: GraduationCap, description: 'Research and education', color: 'bg-blue-100 dark:bg-blue-900/30 text-blue-600' },
  { id: 'creative', name: 'Creative', icon: PenTool, description: 'Writing and content creation', color: 'bg-purple-100 dark:bg-purple-900/30 text-purple-600' },
  { id: 'scientific', name: 'Scientific', icon: FlaskConical, description: 'Scientific research', color: 'bg-cyan-100 dark:bg-cyan-900/30 text-cyan-600' },
];

export default function DomainModesPage() {
  const queryClient = useQueryClient();
  const [testPrompt, setTestPrompt] = useState('');
  const [isDetecting, setIsDetecting] = useState(false);

  const { data: config } = useQuery<DomainModesConfig>({
    queryKey: ['domain-modes-config'],
    queryFn: () => api.get<DomainModesConfig>('/api/admin/thinktank/domain-modes'),
  });

  const { data: models } = useQuery({
    queryKey: ['available-models'],
    queryFn: () => api.get('/api/admin/models?enabled=true'),
  });

  const updateMutation = useMutation({
    mutationFn: (data: DomainModesConfig) => api.put('/api/admin/thinktank/domain-modes', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['domain-modes-config'] });
      toast.success('Domain mode configuration saved');
    },
  });

  const [localConfig, setLocalConfig] = useState<DomainModesConfig>({ modes: {} });

  useEffect(() => {
    if (config) setLocalConfig(config);
  }, [config]);

  const getModeConfig = (modeId: string): ModeConfig => {
    return localConfig?.modes?.[modeId] || { enabled: true, defaultModel: 'auto', temperature: 0.7, systemPrompt: '' };
  };

  const updateModeConfig = (modeId: string, updates: Partial<ModeConfig>) => {
    setLocalConfig({
      ...localConfig,
      modes: { ...localConfig.modes, [modeId]: { ...getModeConfig(modeId), ...updates } },
    });
  };

  const enabledCount = DOMAIN_MODES.filter(m => getModeConfig(m.id).enabled !== false).length;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Settings2 className="h-6 w-6" />
            Domain Modes
          </h1>
          <p className="text-muted-foreground">Configure specialized AI modes for different use cases</p>
        </div>
        <div className="flex items-center gap-3">
          <Badge variant="outline">{enabledCount}/{DOMAIN_MODES.length} modes enabled</Badge>
          <Button onClick={() => updateMutation.mutate(localConfig)} disabled={updateMutation.isPending}>
            {updateMutation.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
            Save Changes
          </Button>
        </div>
      </div>

      <Tabs defaultValue="modes" className="space-y-6">
        <TabsList>
          <TabsTrigger value="modes">Mode Configuration</TabsTrigger>
          <TabsTrigger value="taxonomy">Taxonomy Integration</TabsTrigger>
        </TabsList>

        <TabsContent value="modes" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {DOMAIN_MODES.map((mode) => {
              const modeConfig = getModeConfig(mode.id);
              const Icon = mode.icon;
              return (
                <Card key={mode.id} className={cn(modeConfig.enabled === false && 'opacity-60')}>
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className={cn('p-2 rounded-lg', mode.color)}><Icon className="h-5 w-5" /></div>
                        <div>
                          <CardTitle className="text-base">{mode.name}</CardTitle>
                          <CardDescription className="text-xs">{mode.description}</CardDescription>
                        </div>
                      </div>
                      <Switch checked={modeConfig.enabled !== false} onCheckedChange={(enabled) => updateModeConfig(mode.id, { enabled })} />
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="space-y-2">
                      <Label className="text-xs">Default Model</Label>
                      <Select value={modeConfig.defaultModel || 'auto'} onValueChange={(value) => updateModeConfig(mode.id, { defaultModel: value })} disabled={modeConfig.enabled === false}>
                        <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="auto"><div className="flex items-center gap-2"><Sparkles className="h-3 w-3" />Auto-select</div></SelectItem>
                          {((models as any)?.data || []).map((model: any) => (
                            <SelectItem key={model.id} value={model.id}>{model.display_name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <Label className="text-xs">Temperature</Label>
                        <span className="text-xs text-muted-foreground">{modeConfig.temperature}</span>
                      </div>
                      <Slider value={[modeConfig.temperature]} onValueChange={([value]) => updateModeConfig(mode.id, { temperature: value })} min={0} max={1} step={0.1} disabled={modeConfig.enabled === false} />
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </TabsContent>

        <TabsContent value="taxonomy" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><Brain className="h-5 w-5" />Taxonomy Detection</CardTitle>
              <CardDescription>Enable automatic domain detection using the RADIANT knowledge taxonomy</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex items-center justify-between p-4 rounded-lg border">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-violet-100 dark:bg-violet-900/30 text-violet-600"><Zap className="h-5 w-5" /></div>
                  <div>
                    <p className="font-medium">Use Taxonomy Detection</p>
                    <p className="text-sm text-muted-foreground">Automatically detect knowledge domain from user prompts</p>
                  </div>
                </div>
                <Switch checked={localConfig.useTaxonomyDetection !== false} onCheckedChange={(checked) => setLocalConfig({ ...localConfig, useTaxonomyDetection: checked })} />
              </div>
              <div className="text-sm text-muted-foreground bg-blue-50 dark:bg-blue-950/30 p-4 rounded-lg border border-blue-200 dark:border-blue-800">
                <div className="flex items-start gap-2">
                  <Info className="h-4 w-4 mt-0.5 text-blue-500" />
                  <p>When taxonomy detection is enabled, RADIANT analyzes user prompts to detect the knowledge domain. This enables automatic model selection based on proficiency dimensions.</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
