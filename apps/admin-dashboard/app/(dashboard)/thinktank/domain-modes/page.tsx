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
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Slider } from '@/components/ui/slider';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import {
  Stethoscope,
  Scale,
  Code2,
  Lightbulb,
  GraduationCap,
  PenTool,
  FlaskConical,
  Save,
  LucideIcon,
  Settings2,
  Sparkles,
  Info,
  CheckCircle2,
  AlertCircle,
  Loader2,
} from 'lucide-react';

interface DomainMode {
  id: string;
  name: string;
  icon: LucideIcon;
  description: string;
}

interface ModeConfig {
  enabled: boolean;
  defaultModel: string;
  temperature: number;
  systemPrompt: string;
}

interface DomainModesConfig {
  modes: Record<string, ModeConfig>;
}

interface Model {
  id: string;
  display_name: string;
}

const DOMAIN_MODES: (DomainMode & { color: string })[] = [
  {
    id: 'general',
    name: 'General',
    icon: Lightbulb,
    description: 'Default mode for general queries',
    color: 'bg-amber-100 dark:bg-amber-900/30 text-amber-600',
  },
  {
    id: 'medical',
    name: 'Medical',
    icon: Stethoscope,
    description: 'Healthcare and medical topics',
    color: 'bg-red-100 dark:bg-red-900/30 text-red-600',
  },
  {
    id: 'legal',
    name: 'Legal',
    icon: Scale,
    description: 'Legal research and analysis',
    color: 'bg-slate-100 dark:bg-slate-800 text-slate-600',
  },
  {
    id: 'code',
    name: 'Code',
    icon: Code2,
    description: 'Programming and development',
    color: 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600',
  },
  {
    id: 'academic',
    name: 'Academic',
    icon: GraduationCap,
    description: 'Research and education',
    color: 'bg-blue-100 dark:bg-blue-900/30 text-blue-600',
  },
  {
    id: 'creative',
    name: 'Creative',
    icon: PenTool,
    description: 'Writing and content creation',
    color: 'bg-purple-100 dark:bg-purple-900/30 text-purple-600',
  },
  {
    id: 'scientific',
    name: 'Scientific',
    icon: FlaskConical,
    description: 'Scientific research',
    color: 'bg-cyan-100 dark:bg-cyan-900/30 text-cyan-600',
  },
];

export default function DomainModesPage() {
  const queryClient = useQueryClient();

  const { data: config } = useQuery<DomainModesConfig>({
    queryKey: ['domain-modes-config'],
    queryFn: () =>
      fetch('/api/admin/thinktank/domain-modes').then((r) => r.json()),
  });

  const { data: models } = useQuery({
    queryKey: ['available-models'],
    queryFn: () =>
      fetch('/api/admin/models?enabled=true').then((r) => r.json()),
  });

  const updateMutation = useMutation({
    mutationFn: (data: DomainModesConfig) =>
      fetch('/api/admin/thinktank/domain-modes', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      }).then((r) => r.json()),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['domain-modes-config'] });
      toast.success('Domain mode configuration saved');
    },
  });

  const [localConfig, setLocalConfig] = useState<DomainModesConfig>({
    modes: {},
  });

  useEffect(() => {
    if (config) {
      setLocalConfig(config);
    }
  }, [config]);

  const getModeConfig = (modeId: string): ModeConfig => {
    return (
      localConfig?.modes?.[modeId] || {
        enabled: true,
        defaultModel: 'auto',
        temperature: 0.7,
        systemPrompt: '',
      }
    );
  };

  const updateModeConfig = (modeId: string, updates: Partial<ModeConfig>) => {
    setLocalConfig({
      ...localConfig,
      modes: {
        ...localConfig.modes,
        [modeId]: { ...getModeConfig(modeId), ...updates },
      },
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
          <p className="text-muted-foreground">
            Configure specialized AI modes for different use cases
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Badge variant="outline" className="font-normal">
            {enabledCount}/{DOMAIN_MODES.length} modes enabled
          </Badge>
          <Button 
            onClick={() => updateMutation.mutate(localConfig)}
            disabled={updateMutation.isPending}
          >
            {updateMutation.isPending ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Save className="h-4 w-4 mr-2" />
            )}
            Save Changes
          </Button>
        </div>
      </div>

      {/* Summary Card */}
      <Card className="bg-gradient-to-r from-violet-50 to-purple-50 dark:from-violet-950/20 dark:to-purple-950/20 border-violet-200 dark:border-violet-800">
        <CardContent className="p-6">
          <div className="flex items-start gap-4">
            <div className="p-3 rounded-xl bg-violet-100 dark:bg-violet-900/50">
              <Sparkles className="h-6 w-6 text-violet-600" />
            </div>
            <div>
              <h3 className="font-semibold mb-1">Domain-Specific AI Assistance</h3>
              <p className="text-sm text-muted-foreground">
                Each domain mode optimizes the AI&apos;s behavior with specialized system prompts, 
                recommended models, and temperature settings tailored for specific use cases.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4">
        {DOMAIN_MODES.map((mode) => {
          const ModeIcon = mode.icon;
          const modeConfig = getModeConfig(mode.id);
          const isEnabled = modeConfig.enabled !== false;

          return (
            <Card 
              key={mode.id}
              className={cn(
                'transition-all duration-200',
                !isEnabled && 'opacity-60'
              )}
            >
              <CardHeader className="pb-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className={cn('p-2.5 rounded-xl', mode.color)}>
                      <ModeIcon className="h-5 w-5" />
                    </div>
                    <div>
                      <CardTitle className="text-lg flex items-center gap-2">
                        {mode.name}
                        {isEnabled ? (
                          <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-400 dark:border-emerald-800">
                            <CheckCircle2 className="h-3 w-3 mr-1" />
                            Active
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="text-muted-foreground">
                            Disabled
                          </Badge>
                        )}
                      </CardTitle>
                      <CardDescription>{mode.description}</CardDescription>
                    </div>
                  </div>
                  <Switch
                    checked={isEnabled}
                    onCheckedChange={(checked) =>
                      updateModeConfig(mode.id, { enabled: checked })
                    }
                  />
                </div>
              </CardHeader>
              {isEnabled && (
                <CardContent className="space-y-6 pt-0">
                  <div className="grid gap-6 md:grid-cols-2">
                    <div className="space-y-2">
                      <Label className="flex items-center gap-2">
                        Default Model
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger>
                              <Info className="h-3.5 w-3.5 text-muted-foreground" />
                            </TooltipTrigger>
                            <TooltipContent>
                              <p className="max-w-xs">The model used when users select this domain mode. Auto lets RADIANT Brain choose optimally.</p>
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      </Label>
                      <Select
                        value={modeConfig.defaultModel || 'auto'}
                        onValueChange={(value) =>
                          updateModeConfig(mode.id, { defaultModel: value })
                        }
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Auto (RADIANT Brain)" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="auto">
                            <span className="flex items-center gap-2">
                              <Sparkles className="h-4 w-4 text-violet-500" />
                              Auto (RADIANT Brain)
                            </span>
                          </SelectItem>
                          {(models?.data || []).map((model: Model) => (
                            <SelectItem key={model.id} value={model.id}>
                              {model.display_name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-3">
                      <Label className="flex items-center justify-between">
                        <span className="flex items-center gap-2">
                          Temperature
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger>
                                <Info className="h-3.5 w-3.5 text-muted-foreground" />
                              </TooltipTrigger>
                              <TooltipContent>
                                <p className="max-w-xs">Controls randomness. Lower = more focused, Higher = more creative.</p>
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        </span>
                        <span className="text-sm font-mono text-muted-foreground">
                          {(modeConfig.temperature || 0.7).toFixed(1)}
                        </span>
                      </Label>
                      <Slider
                        value={[modeConfig.temperature || 0.7]}
                        onValueChange={([value]) =>
                          updateModeConfig(mode.id, { temperature: value })
                        }
                        min={0}
                        max={2}
                        step={0.1}
                        className="w-full"
                      />
                      <div className="flex justify-between text-xs text-muted-foreground">
                        <span>Focused</span>
                        <span>Balanced</span>
                        <span>Creative</span>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label className="flex items-center gap-2">
                      System Prompt Override
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger>
                            <Info className="h-3.5 w-3.5 text-muted-foreground" />
                          </TooltipTrigger>
                          <TooltipContent>
                            <p className="max-w-xs">Custom instructions prepended to all conversations in this mode.</p>
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    </Label>
                    <Textarea
                      placeholder="Optional: Custom system prompt for this mode. Leave empty to use default behavior."
                      value={modeConfig.systemPrompt || ''}
                      onChange={(e) =>
                        updateModeConfig(mode.id, { systemPrompt: e.target.value })
                      }
                      rows={3}
                      className="resize-none"
                    />
                    {modeConfig.systemPrompt && (
                      <p className="text-xs text-muted-foreground">
                        {modeConfig.systemPrompt.length} characters
                      </p>
                    )}
                  </div>
                </CardContent>
              )}
            </Card>
          );
        })}
      </div>
    </div>
  );
}
