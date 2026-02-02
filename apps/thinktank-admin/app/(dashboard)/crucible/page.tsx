'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  Flame,
  Settings,
  Users,
  Save,
  RotateCcw,
  AlertTriangle,
  Info,
  ChevronRight,
  Eye,
  EyeOff,
  Zap,
} from 'lucide-react';

interface SystemConfig {
  defaultMaxQuestions: number;
  questionTimeoutSeconds: number;
  sessionTimeoutSeconds: number;
  minLlmsForCrucible: number;
  defaultCostMode: string;
  costModeQuestionLimits: Record<string, number>;
  circularCitationPenalty: number;
  allowTenantOverride: boolean;
  allowUserOverride: boolean;
}

interface TenantConfig {
  tenantId: string;
  maxQuestionsOverride?: number;
  questionTimeoutOverride?: number;
  sessionTimeoutOverride?: number;
  minLlmsOverride?: number;
  costModeOverride?: string;
  costModeLimitsOverride?: Record<string, number>;
  circularPenaltyOverride?: number;
  allowUserOverride: boolean;
  showDeliberationToUsers: boolean;
  autoEnableForMultiLlm: boolean;
}

interface ConfigData {
  system: SystemConfig;
  tenant: TenantConfig | null;
  effective: {
    maxQuestions: number;
    questionTimeoutSeconds: number;
    sessionTimeoutSeconds: number;
    minLlmsForCrucible: number;
    costMode: string;
    costModeQuestionLimits: Record<string, number>;
    circularCitationPenalty: number;
    allowUserOverride: boolean;
    showDeliberationToUsers: boolean;
    autoEnableForMultiLlm: boolean;
  };
  canOverride: boolean;
}

export default function CrucibleConfigPage() {
  const [config, setConfig] = useState<ConfigData | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasChanges, setHasChanges] = useState(false);

  // Editable state
  const [maxQuestions, setMaxQuestions] = useState<number | null>(null);
  const [costMode, setCostMode] = useState<string | null>(null);
  const [costModeLimits, setCostModeLimits] = useState<Record<string, number> | null>(null);
  const [circularPenalty, setCircularPenalty] = useState<number | null>(null);
  const [allowUserOverride, setAllowUserOverride] = useState(true);
  const [showToUsers, setShowToUsers] = useState(true);
  const [autoEnable, setAutoEnable] = useState(true);

  const fetchConfig = useCallback(async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/thinktank-admin/crucible/config');
      if (!response.ok) throw new Error('Failed to fetch config');
      const data: ConfigData = await response.json();
      setConfig(data);

      // Initialize editable state from tenant overrides
      setMaxQuestions(data.tenant?.maxQuestionsOverride ?? null);
      setCostMode(data.tenant?.costModeOverride ?? null);
      setCostModeLimits(data.tenant?.costModeLimitsOverride ?? null);
      setCircularPenalty(data.tenant?.circularPenaltyOverride ?? null);
      setAllowUserOverride(data.tenant?.allowUserOverride ?? true);
      setShowToUsers(data.tenant?.showDeliberationToUsers ?? true);
      setAutoEnable(data.tenant?.autoEnableForMultiLlm ?? true);

      setError(null);
      setHasChanges(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchConfig();
  }, [fetchConfig]);

  const saveConfig = async () => {
    try {
      setSaving(true);
      const response = await fetch('/api/thinktank-admin/crucible/config', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          maxQuestions,
          costMode,
          costModeQuestionLimits: costModeLimits,
          circularCitationPenalty: circularPenalty,
          allowUserOverride,
          showDeliberationToUsers: showToUsers,
          autoEnableForMultiLlm: autoEnable,
        }),
      });
      if (!response.ok) throw new Error('Failed to save config');
      await fetchConfig();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  const resetField = async (field: string) => {
    try {
      const response = await fetch(`/api/thinktank-admin/crucible/config/${field}`, {
        method: 'DELETE',
      });
      if (!response.ok) throw new Error('Failed to reset field');
      await fetchConfig();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to reset');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin w-8 h-8 border-4 border-orange-500 border-t-transparent rounded-full" />
      </div>
    );
  }

  if (!config?.canOverride) {
    return (
      <div className="p-6">
        <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-xl p-6">
          <div className="flex items-center gap-3">
            <AlertTriangle className="w-6 h-6 text-yellow-600" />
            <div>
              <h3 className="font-semibold text-yellow-800 dark:text-yellow-200">
                Tenant Overrides Disabled
              </h3>
              <p className="text-yellow-700 dark:text-yellow-300 text-sm">
                The system administrator has disabled tenant-level configuration for The Crucible.
                Please contact your Radiant administrator if you need to customize these settings.
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-gradient-to-br from-orange-500 to-red-600 rounded-xl shadow-lg">
            <Flame className="w-8 h-8 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
              The Crucible Configuration
            </h1>
            <p className="text-gray-500 dark:text-gray-400">
              Configure competitive multi-LLM deliberation for your tenant
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={fetchConfig}
            className="px-4 py-2 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg"
          >
            <RotateCcw className="w-5 h-5" />
          </button>
          <button
            onClick={saveConfig}
            disabled={saving || !hasChanges}
            className={`px-4 py-2 rounded-lg flex items-center gap-2 ${
              hasChanges
                ? 'bg-orange-500 text-white hover:bg-orange-600'
                : 'bg-gray-200 text-gray-400 cursor-not-allowed dark:bg-gray-700'
            }`}
          >
            <Save className="w-5 h-5" />
            {saving ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
          <p className="text-red-600 dark:text-red-400">{error}</p>
        </div>
      )}

      {/* System Defaults Info */}
      <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-xl p-4">
        <div className="flex items-start gap-3">
          <Info className="w-5 h-5 text-blue-500 mt-0.5" />
          <div className="text-sm text-blue-700 dark:text-blue-300">
            <p className="font-medium">System Defaults</p>
            <p>
              Max Questions: <strong>{config?.system.defaultMaxQuestions}</strong> |
              Cost Mode: <strong>{config?.system.defaultCostMode}</strong> |
              Min LLMs: <strong>{config?.system.minLlmsForCrucible}</strong>
            </p>
            <p className="text-xs mt-1 opacity-75">
              Override these values below. Leave empty to use system defaults.
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Deliberation Settings */}
        <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm border border-gray-200 dark:border-gray-700">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
            <Settings className="w-5 h-5 text-orange-500" />
            Deliberation Settings
          </h3>

          <div className="space-y-4">
            <ConfigField
              label="Default Max Questions"
              description="Maximum questions per deliberation session"
              systemDefault={config?.system.defaultMaxQuestions}
              value={maxQuestions}
              onChange={(v) => { setMaxQuestions(typeof v === 'number' ? v : null); setHasChanges(true); }}
              onReset={() => resetField('max_questions')}
              type="number"
              min={1}
              max={10}
            />

            <ConfigField
              label="Cost Mode"
              description="Default cost/quality tradeoff"
              systemDefault={config?.system.defaultCostMode}
              value={costMode}
              onChange={(v) => { setCostMode(typeof v === 'string' ? v : null); setHasChanges(true); }}
              onReset={() => resetField('cost_mode')}
              type="select"
              options={['economy', 'balanced', 'thorough']}
            />

            <ConfigField
              label="Circular Citation Penalty"
              description="Score penalty for circular reasoning (0-50%)"
              systemDefault={`${(config?.system.circularCitationPenalty ?? 0.15) * 100}%`}
              value={circularPenalty !== null ? circularPenalty * 100 : null}
              onChange={(v) => { setCircularPenalty(typeof v === 'number' ? v / 100 : null); setHasChanges(true); }}
              onReset={() => resetField('circular_penalty')}
              type="number"
              min={0}
              max={50}
              suffix="%"
            />
          </div>
        </div>

        {/* User Access Settings */}
        <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm border border-gray-200 dark:border-gray-700">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
            <Users className="w-5 h-5 text-purple-500" />
            User Access Settings
          </h3>

          <div className="space-y-4">
            <ToggleField
              label="Allow User Overrides"
              description="Let users set their own max questions per method"
              checked={allowUserOverride}
              onChange={(v) => { setAllowUserOverride(v); setHasChanges(true); }}
              icon={<Zap className="w-4 h-4" />}
            />

            <ToggleField
              label="Show Deliberation to Users"
              description="Users can see live deliberation Q&A during execution"
              checked={showToUsers}
              onChange={(v) => { setShowToUsers(v); setHasChanges(true); }}
              icon={showToUsers ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
            />

            <ToggleField
              label="Auto-Enable for Multi-LLM"
              description="Automatically trigger Crucible when multiple LLMs are assigned"
              checked={autoEnable}
              onChange={(v) => { setAutoEnable(v); setHasChanges(true); }}
              icon={<Flame className="w-4 h-4" />}
            />
          </div>
        </div>

        {/* Cost Mode Limits */}
        <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm border border-gray-200 dark:border-gray-700 lg:col-span-2">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
            Cost Mode Question Limits
          </h3>
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
            Override the number of questions allowed per cost mode. Leave empty to use system defaults.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {['economy', 'balanced', 'thorough'].map((mode) => (
              <div key={mode} className="p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                <div className="flex items-center justify-between mb-2">
                  <span className="font-medium text-gray-900 dark:text-white capitalize">{mode}</span>
                  <span className="text-sm text-gray-500">
                    System: {config?.system.costModeQuestionLimits[mode]}
                  </span>
                </div>
                <input
                  type="number"
                  min={1}
                  max={10}
                  placeholder={String(config?.system.costModeQuestionLimits[mode])}
                  value={costModeLimits?.[mode] ?? ''}
                  onChange={(e) => {
                    const val = e.target.value ? parseInt(e.target.value) : config?.system.costModeQuestionLimits[mode] ?? 5;
                    setCostModeLimits(prev => ({
                      ...config?.system.costModeQuestionLimits,
                      ...prev,
                      [mode]: val,
                    }));
                    setHasChanges(true);
                  }}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                />
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Current Effective Config */}
      <div className="bg-gray-50 dark:bg-gray-800/50 rounded-xl p-6 border border-gray-200 dark:border-gray-700">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
          Effective Configuration
        </h3>
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
          These values are what your users will experience (after applying your overrides).
        </p>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <EffectiveValue label="Max Questions" value={config?.effective.maxQuestions} />
          <EffectiveValue label="Cost Mode" value={config?.effective.costMode} />
          <EffectiveValue label="Min LLMs" value={config?.effective.minLlmsForCrucible} />
          <EffectiveValue 
            label="Circular Penalty" 
            value={`${((config?.effective.circularCitationPenalty ?? 0.15) * 100).toFixed(0)}%`} 
          />
        </div>
      </div>
    </div>
  );
}

function ConfigField({
  label,
  description,
  systemDefault,
  value,
  onChange,
  onReset,
  type,
  min,
  max,
  suffix,
  options,
}: {
  label: string;
  description: string;
  systemDefault: number | string | undefined;
  value: number | string | null;
  onChange: (value: number | string | null) => void;
  onReset: () => void;
  type: 'number' | 'select';
  min?: number;
  max?: number;
  suffix?: string;
  options?: string[];
}) {
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between">
        <label className="text-sm font-medium text-gray-700 dark:text-gray-300">{label}</label>
        <span className="text-xs text-gray-500">System: {systemDefault}{suffix}</span>
      </div>
      <p className="text-xs text-gray-500 dark:text-gray-400">{description}</p>
      <div className="flex items-center gap-2">
        {type === 'number' ? (
          <input
            type="number"
            min={min}
            max={max}
            placeholder={String(systemDefault)}
            value={value ?? ''}
            onChange={(e) => onChange(e.target.value ? Number(e.target.value) : null)}
            className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
          />
        ) : (
          <select
            value={value ?? ''}
            onChange={(e) => onChange(e.target.value || null)}
            className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
          >
            <option value="">Use system default</option>
            {options?.map((opt) => (
              <option key={opt} value={opt}>{opt}</option>
            ))}
          </select>
        )}
        {value !== null && (
          <button
            onClick={onReset}
            className="p-2 text-gray-400 hover:text-orange-500"
            title="Reset to system default"
          >
            <RotateCcw className="w-4 h-4" />
          </button>
        )}
      </div>
    </div>
  );
}

function ToggleField({
  label,
  description,
  checked,
  onChange,
  icon,
}: {
  label: string;
  description: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  icon: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
      <div className="flex items-center gap-3">
        <div className={`p-2 rounded-lg ${checked ? 'bg-orange-100 text-orange-600' : 'bg-gray-200 text-gray-500'}`}>
          {icon}
        </div>
        <div>
          <p className="font-medium text-gray-900 dark:text-white">{label}</p>
          <p className="text-xs text-gray-500 dark:text-gray-400">{description}</p>
        </div>
      </div>
      <button
        onClick={() => onChange(!checked)}
        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
          checked ? 'bg-orange-500' : 'bg-gray-300 dark:bg-gray-600'
        }`}
      >
        <span
          className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
            checked ? 'translate-x-6' : 'translate-x-1'
          }`}
        />
      </button>
    </div>
  );
}

function EffectiveValue({ label, value }: { label: string; value: number | string | undefined }) {
  return (
    <div className="p-3 bg-white dark:bg-gray-700 rounded-lg">
      <p className="text-xs text-gray-500 dark:text-gray-400">{label}</p>
      <p className="text-lg font-semibold text-gray-900 dark:text-white capitalize">{value}</p>
    </div>
  );
}
