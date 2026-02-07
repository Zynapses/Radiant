'use client';

/**
 * LIVS-M 2.0 Policy Settings Component
 * 
 * Allows admins to select the governance "Defcon" mode:
 * - Brainstorming (RAPID_PROTO): "Yes, and..." - accepts stubs, focuses on speed
 * - Standard (ENGINEERING): "Trust but Verify" - code must run, stubs rejected if breaking
 * - Strict Audit (STRICT_AUDIT): "Zero Trust" - no stubs, mandatory tests, sycophancy triggers chaos
 */

import React, { useState, useEffect } from 'react';
import {
  Lightbulb,
  Wrench,
  ShieldCheck,
  AlertTriangle,
  CheckCircle,
  RefreshCw,
  Info,
  Zap,
  Scale,
  Lock,
} from 'lucide-react';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
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
import { Separator } from '@/components/ui/separator';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';

export type LIVSMPolicyMode = 'RAPID_PROTO' | 'ENGINEERING' | 'STRICT_AUDIT';

export interface LIVSMPolicyConfig {
  mode: LIVSMPolicyMode;
  enableSycophancyDetection: boolean;
  enableStubRejection: boolean;
  enableChaosInjection: boolean;
  maxConsensusVelocity: number;
  allowMockData: boolean;
}

interface LIVSMPolicySettingsProps {
  tenantId?: string;
  initialConfig?: Partial<LIVSMPolicyConfig>;
  onConfigChange?: (config: LIVSMPolicyConfig) => void;
  compact?: boolean;
  showAdvanced?: boolean;
}

const POLICY_MODES: Record<LIVSMPolicyMode, {
  icon: React.ReactNode;
  displayName: string;
  shortName: string;
  description: string;
  behavior: string;
  useCase: string;
  color: string;
  bgColor: string;
  borderColor: string;
  defaults: Partial<LIVSMPolicyConfig>;
}> = {
  RAPID_PROTO: {
    icon: <Lightbulb className="h-6 w-6" />,
    displayName: 'Brainstorming',
    shortName: 'Brainstorming',
    description: '"Yes, and..." mode',
    behavior: 'The AI accepts partial code, stubs (TODO), and rough ideas. It focuses on speed and creativity. Warnings are logged but don\'t stop the work.',
    useCase: 'Hackathons, MVP planning, early drafting',
    color: 'text-amber-600',
    bgColor: 'bg-amber-50 dark:bg-amber-950',
    borderColor: 'border-amber-200 dark:border-amber-800',
    defaults: {
      enableSycophancyDetection: false,
      enableStubRejection: false,
      enableChaosInjection: false,
      maxConsensusVelocity: 10,
      allowMockData: true,
    },
  },
  ENGINEERING: {
    icon: <Wrench className="h-6 w-6" />,
    displayName: 'Standard',
    shortName: 'Standard',
    description: '"Trust but Verify" mode',
    behavior: 'Code must run. Stubs are rejected if they break functionality. Tests are encouraged but not mandatory for every single function.',
    useCase: 'Daily development, Sprint work',
    color: 'text-blue-600',
    bgColor: 'bg-blue-50 dark:bg-blue-950',
    borderColor: 'border-blue-200 dark:border-blue-800',
    defaults: {
      enableSycophancyDetection: true,
      enableStubRejection: true,
      enableChaosInjection: false,
      maxConsensusVelocity: 2,
      allowMockData: false,
    },
  },
  STRICT_AUDIT: {
    icon: <ShieldCheck className="h-6 w-6" />,
    displayName: 'Strict Audit',
    shortName: 'Strict',
    description: '"Zero Trust" mode',
    behavior: 'The AI rejects anything that isn\'t perfect. No stubs. No mocked data. Mandatory test coverage. Sycophancy (agreeing too fast) triggers an automatic "Devil\'s Advocate" intervention.',
    useCase: 'Production releases, medical/legal queries, security patches',
    color: 'text-red-600',
    bgColor: 'bg-red-50 dark:bg-red-950',
    borderColor: 'border-red-200 dark:border-red-800',
    defaults: {
      enableSycophancyDetection: true,
      enableStubRejection: true,
      enableChaosInjection: true,
      maxConsensusVelocity: 1,
      allowMockData: false,
    },
  },
};

const DEFAULT_CONFIG: LIVSMPolicyConfig = {
  mode: 'ENGINEERING',
  enableSycophancyDetection: true,
  enableStubRejection: true,
  enableChaosInjection: false,
  maxConsensusVelocity: 2,
  allowMockData: false,
};

export function LIVSMPolicySettings({
  tenantId,
  initialConfig,
  onConfigChange,
  compact = false,
  showAdvanced = false,
}: LIVSMPolicySettingsProps) {
  const [config, setConfig] = useState<LIVSMPolicyConfig>({
    ...DEFAULT_CONFIG,
    ...initialConfig,
  });
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [showAdvancedOptions, setShowAdvancedOptions] = useState(showAdvanced);

  useEffect(() => {
    const loadConfig = async () => {
      if (!tenantId) return;
      
      setLoading(true);
      try {
        const response = await fetch(`/api/admin/livs/policy-registry?tenantId=${tenantId}`);
        if (response.ok) {
          const data = await response.json();
          if (data.meta_config?.environment_mode) {
            setConfig(prev => ({
              ...prev,
              mode: data.meta_config.environment_mode as LIVSMPolicyMode,
              maxConsensusVelocity: data.global_directives?.max_consensus_velocity ?? prev.maxConsensusVelocity,
              allowMockData: data.global_directives?.allow_mock_data ?? prev.allowMockData,
            }));
          }
        }
      } catch (err) {
        console.error('Failed to fetch LIVS-M config:', err);
      } finally {
        setLoading(false);
      }
    };
    
    loadConfig();
  }, [tenantId]);

  const fetchConfig = async () => {
    if (!tenantId) return;
    
    setLoading(true);
    try {
      const response = await fetch(`/api/admin/livs/policy-registry?tenantId=${tenantId}`);
      if (response.ok) {
        const data = await response.json();
        if (data.meta_config?.environment_mode) {
          setConfig(prev => ({
            ...prev,
            mode: data.meta_config.environment_mode as LIVSMPolicyMode,
            maxConsensusVelocity: data.global_directives?.max_consensus_velocity ?? prev.maxConsensusVelocity,
            allowMockData: data.global_directives?.allow_mock_data ?? prev.allowMockData,
          }));
        }
      }
    } catch (err) {
      console.error('Failed to fetch LIVS-M config:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleModeChange = async (newMode: LIVSMPolicyMode) => {
    const modeDefaults = POLICY_MODES[newMode].defaults;
    const newConfig: LIVSMPolicyConfig = {
      ...config,
      mode: newMode,
      ...modeDefaults,
    };
    
    setConfig(newConfig);
    onConfigChange?.(newConfig);

    if (tenantId) {
      await saveConfig(newConfig);
    }
  };

  const handleAdvancedChange = (key: keyof LIVSMPolicyConfig, value: boolean | number) => {
    const newConfig = { ...config, [key]: value };
    setConfig(newConfig);
    onConfigChange?.(newConfig);
  };

  const saveConfig = async (configToSave: LIVSMPolicyConfig) => {
    if (!tenantId) return;

    setSaving(true);
    setError(null);
    setSuccess(null);

    try {
      const response = await fetch('/api/admin/livs/policy-registry', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tenantId,
          meta_config: {
            environment_mode: configToSave.mode,
          },
          global_directives: {
            max_consensus_velocity: configToSave.maxConsensusVelocity,
            allow_mock_data: configToSave.allowMockData,
          },
        }),
      });

      if (!response.ok) throw new Error('Failed to save configuration');

      setSuccess(`Switched to ${POLICY_MODES[configToSave.mode].displayName} mode`);
      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  const currentMode = POLICY_MODES[config.mode];

  if (compact) {
    return (
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <Label className="text-sm font-medium">LIVS-M Policy Mode</Label>
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Info className="h-4 w-4 text-muted-foreground cursor-help" />
              </TooltipTrigger>
              <TooltipContent className="max-w-xs">
                <p>Controls how strictly the AI governance system enforces code quality and prevents sycophancy.</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
        <Select
          value={config.mode}
          onValueChange={(v) => handleModeChange(v as LIVSMPolicyMode)}
          disabled={loading || saving}
        >
          <SelectTrigger className="w-full">
            <SelectValue>
              <div className="flex items-center gap-2">
                <span className={currentMode.color}>{currentMode.icon}</span>
                <span>{currentMode.shortName}</span>
              </div>
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            {(Object.keys(POLICY_MODES) as LIVSMPolicyMode[]).map((mode) => {
              const modeConfig = POLICY_MODES[mode];
              return (
                <SelectItem key={mode} value={mode}>
                  <div className="flex items-center gap-2">
                    <span className={modeConfig.color}>{modeConfig.icon}</span>
                    <span>{modeConfig.shortName}</span>
                    <span className="text-xs text-muted-foreground">- {modeConfig.description}</span>
                  </div>
                </SelectItem>
              );
            })}
          </SelectContent>
        </Select>
        {success && (
          <p className="text-xs text-green-600 flex items-center gap-1">
            <CheckCircle className="h-3 w-3" />
            {success}
          </p>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {error && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {success && (
        <Alert className="border-green-500 bg-green-50 dark:bg-green-950">
          <CheckCircle className="h-4 w-4 text-green-500" />
          <AlertTitle>Success</AlertTitle>
          <AlertDescription>{success}</AlertDescription>
        </Alert>
      )}

      {/* Mode Selection Cards */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Scale className="h-5 w-5" />
                LIVS-M Policy Mode
              </CardTitle>
              <CardDescription>
                Select the governance "Defcon" level for AI agent behavior
              </CardDescription>
            </div>
            {loading && <RefreshCw className="h-4 w-4 animate-spin text-muted-foreground" />}
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-3">
            {(Object.keys(POLICY_MODES) as LIVSMPolicyMode[]).map((mode) => {
              const modeConfig = POLICY_MODES[mode];
              const isActive = config.mode === mode;

              return (
                <Card
                  key={mode}
                  className={`cursor-pointer transition-all hover:shadow-md ${
                    isActive ? `ring-2 ring-primary ${modeConfig.borderColor}` : ''
                  } ${modeConfig.bgColor}`}
                  onClick={() => handleModeChange(mode)}
                >
                  <CardHeader className="pb-2">
                    <div className="flex items-center justify-between">
                      <div className={modeConfig.color}>{modeConfig.icon}</div>
                      {isActive && (
                        <Badge variant="default">Active</Badge>
                      )}
                    </div>
                    <CardTitle className="text-lg">{modeConfig.displayName}</CardTitle>
                    <p className="text-sm font-medium text-muted-foreground">{modeConfig.description}</p>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    <p className="text-sm">{modeConfig.behavior}</p>
                    <Separator />
                    <p className="text-xs text-muted-foreground">
                      <strong>Best for:</strong> {modeConfig.useCase}
                    </p>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Current Mode Summary */}
      <Card className={currentMode.bgColor}>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <span className={currentMode.color}>{currentMode.icon}</span>
            Current Mode: {currentMode.displayName}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-4 text-sm">
            <div className="flex items-center gap-2">
              <Zap className={`h-4 w-4 ${config.enableSycophancyDetection ? 'text-green-500' : 'text-gray-400'}`} />
              <span>Sycophancy Detection: {config.enableSycophancyDetection ? 'ON' : 'OFF'}</span>
            </div>
            <div className="flex items-center gap-2">
              <Lock className={`h-4 w-4 ${config.enableStubRejection ? 'text-green-500' : 'text-gray-400'}`} />
              <span>Stub Rejection: {config.enableStubRejection ? 'ON' : 'OFF'}</span>
            </div>
            <div className="flex items-center gap-2">
              <AlertTriangle className={`h-4 w-4 ${config.enableChaosInjection ? 'text-amber-500' : 'text-gray-400'}`} />
              <span>Chaos Injection: {config.enableChaosInjection ? 'ON' : 'OFF'}</span>
            </div>
            <div className="flex items-center gap-2">
              <Scale className="h-4 w-4 text-blue-500" />
              <span>Max Consensus Velocity: {config.maxConsensusVelocity}</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Advanced Options */}
      <Card>
        <CardHeader>
          <div 
            className="flex items-center justify-between cursor-pointer"
            onClick={() => setShowAdvancedOptions(!showAdvancedOptions)}
          >
            <CardTitle className="text-sm">Advanced Options</CardTitle>
            <Button variant="ghost" size="sm">
              {showAdvancedOptions ? 'Hide' : 'Show'}
            </Button>
          </div>
        </CardHeader>
        {showAdvancedOptions && (
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <Label>Sycophancy Detection</Label>
                <p className="text-xs text-muted-foreground">
                  Detect when agents agree too quickly without critical thinking
                </p>
              </div>
              <Switch
                checked={config.enableSycophancyDetection}
                onCheckedChange={(v) => handleAdvancedChange('enableSycophancyDetection', v)}
              />
            </div>
            
            <div className="flex items-center justify-between">
              <div>
                <Label>Stub Rejection</Label>
                <p className="text-xs text-muted-foreground">
                  Automatically reject outputs containing TODO, placeholder, or stub code
                </p>
              </div>
              <Switch
                checked={config.enableStubRejection}
                onCheckedChange={(v) => handleAdvancedChange('enableStubRejection', v)}
              />
            </div>
            
            <div className="flex items-center justify-between">
              <div>
                <Label>Chaos Injection</Label>
                <p className="text-xs text-muted-foreground">
                  Inject Devil&apos;s Advocate challenges when sycophancy is detected
                </p>
              </div>
              <Switch
                checked={config.enableChaosInjection}
                onCheckedChange={(v) => handleAdvancedChange('enableChaosInjection', v)}
              />
            </div>
            
            <div className="flex items-center justify-between">
              <div>
                <Label>Allow Mock Data</Label>
                <p className="text-xs text-muted-foreground">
                  Permit use of mock/sample data in outputs
                </p>
              </div>
              <Switch
                checked={config.allowMockData}
                onCheckedChange={(v) => handleAdvancedChange('allowMockData', v)}
              />
            </div>

            <div className="space-y-2">
              <Label>Max Consensus Velocity</Label>
              <p className="text-xs text-muted-foreground">
                Maximum interaction turns before agents can agree (lower = stricter)
              </p>
              <Select
                value={String(config.maxConsensusVelocity)}
                onValueChange={(v) => handleAdvancedChange('maxConsensusVelocity', parseInt(v))}
              >
                <SelectTrigger className="w-32">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="1">1 (Strictest)</SelectItem>
                  <SelectItem value="2">2 (Standard)</SelectItem>
                  <SelectItem value="5">5 (Relaxed)</SelectItem>
                  <SelectItem value="10">10 (Permissive)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {tenantId && (
              <Button 
                onClick={() => saveConfig(config)} 
                disabled={saving}
                className="w-full"
              >
                {saving ? (
                  <>
                    <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                    Saving...
                  </>
                ) : (
                  'Save Advanced Settings'
                )}
              </Button>
            )}
          </CardContent>
        )}
      </Card>
    </div>
  );
}

export default LIVSMPolicySettings;
