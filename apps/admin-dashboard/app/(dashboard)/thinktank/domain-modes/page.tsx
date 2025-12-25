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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
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

const DOMAIN_MODES: DomainMode[] = [
  {
    id: 'general',
    name: 'General',
    icon: Lightbulb,
    description: 'Default mode for general queries',
  },
  {
    id: 'medical',
    name: 'Medical',
    icon: Stethoscope,
    description: 'Healthcare and medical topics',
  },
  {
    id: 'legal',
    name: 'Legal',
    icon: Scale,
    description: 'Legal research and analysis',
  },
  {
    id: 'code',
    name: 'Code',
    icon: Code2,
    description: 'Programming and development',
  },
  {
    id: 'academic',
    name: 'Academic',
    icon: GraduationCap,
    description: 'Research and education',
  },
  {
    id: 'creative',
    name: 'Creative',
    icon: PenTool,
    description: 'Writing and content creation',
  },
  {
    id: 'scientific',
    name: 'Scientific',
    icon: FlaskConical,
    description: 'Scientific research',
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

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold">Domain Modes</h1>
          <p className="text-muted-foreground">
            Configure specialized AI modes for different use cases
          </p>
        </div>
        <Button onClick={() => updateMutation.mutate(localConfig)}>
          <Save className="h-4 w-4 mr-2" />
          Save Changes
        </Button>
      </div>

      <div className="grid gap-4">
        {DOMAIN_MODES.map((mode) => {
          const ModeIcon = mode.icon;
          const modeConfig = getModeConfig(mode.id);

          return (
            <Card key={mode.id}>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-primary/10">
                      <ModeIcon className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <CardTitle className="text-lg">{mode.name}</CardTitle>
                      <CardDescription>{mode.description}</CardDescription>
                    </div>
                  </div>
                  <Switch
                    checked={modeConfig.enabled !== false}
                    onCheckedChange={(checked) =>
                      updateModeConfig(mode.id, { enabled: checked })
                    }
                  />
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label>Default Model</Label>
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
                        <SelectItem value="auto">Auto (RADIANT Brain)</SelectItem>
                        {(models?.data || []).map((model: Model) => (
                          <SelectItem key={model.id} value={model.id}>
                            {model.display_name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label>Temperature</Label>
                    <Input
                      type="number"
                      min="0"
                      max="2"
                      step="0.1"
                      value={modeConfig.temperature || 0.7}
                      onChange={(e) =>
                        updateModeConfig(mode.id, {
                          temperature: parseFloat(e.target.value),
                        })
                      }
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>System Prompt Override</Label>
                  <Textarea
                    placeholder="Optional: Custom system prompt for this mode..."
                    value={modeConfig.systemPrompt || ''}
                    onChange={(e) =>
                      updateModeConfig(mode.id, { systemPrompt: e.target.value })
                    }
                    rows={3}
                  />
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
