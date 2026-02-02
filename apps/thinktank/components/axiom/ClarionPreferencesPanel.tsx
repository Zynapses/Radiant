'use client';

/**
 * ClarionPreferencesPanel - User Settings UI for CLARION
 * 
 * Settings panel for CLARION preferences including:
 * - Clarification mode (always/auto/never)
 * - Maximum questions per session
 * - Display options (model scores, confidence meter)
 * - Learning preferences
 * 
 * @version 1.0.0
 * @since RADIANT v6.0.0
 */

import { useState } from 'react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import { useClarionPreferences } from '@/lib/axiom/useClarionPreferences';
import type { ClarificationMode } from '@/lib/axiom/types';
import {
  Settings,
  Sparkles,
  MessageSquare,
  Eye,
  Brain,
  RotateCcw,
  Save,
  Loader2,
  Volume2,
  VolumeX,
  Check,
} from 'lucide-react';

interface ClarionPreferencesPanelProps {
  onClose?: () => void;
  className?: string;
}

interface ToggleProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
}

function Toggle({ checked, onChange, disabled }: ToggleProps) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={cn(
        'relative inline-flex h-6 w-11 items-center rounded-full transition-colors',
        checked ? 'bg-indigo-500' : 'bg-white/20',
        disabled && 'opacity-50 cursor-not-allowed'
      )}
    >
      <span
        className={cn(
          'inline-block h-4 w-4 transform rounded-full bg-white transition-transform',
          checked ? 'translate-x-6' : 'translate-x-1'
        )}
      />
    </button>
  );
}

const CLARIFICATION_MODES: { value: ClarificationMode; label: string; description: string }[] = [
  { value: 'auto', label: 'When helpful', description: 'Ask questions only when needed (recommended)' },
  { value: 'always', label: 'Always ask', description: 'Always show clarification questions' },
  { value: 'never', label: 'Never ask', description: 'Skip questions and proceed directly' },
];

export function ClarionPreferencesPanel({
  onClose,
  className,
}: ClarionPreferencesPanelProps) {
  const {
    preferences,
    isLoading,
    updatePreference,
    resetPreferences,
    saveToServer,
  } = useClarionPreferences();

  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  const handleSave = async () => {
    setIsSaving(true);
    setSaveSuccess(false);
    try {
      await saveToServer();
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 2000);
    } catch {
      // Error already logged in hook
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div className={cn('p-6 flex items-center justify-center', className)}>
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className={cn('space-y-6', className)}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Settings className="h-5 w-5 text-indigo-400" />
          <h3 className="text-lg font-semibold">CLARION Settings</h3>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={resetPreferences}
            className="p-2 text-muted-foreground hover:text-foreground transition-colors rounded-lg hover:bg-white/5"
            title="Reset to defaults"
          >
            <RotateCcw className="h-4 w-4" />
          </button>
          <button
            onClick={handleSave}
            disabled={isSaving}
            className={cn(
              'flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors',
              saveSuccess 
                ? 'bg-green-500/20 text-green-400' 
                : 'bg-indigo-500/20 text-indigo-400 hover:bg-indigo-500/30'
            )}
          >
            {isSaving ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : saveSuccess ? (
              <Check className="h-4 w-4" />
            ) : (
              <Save className="h-4 w-4" />
            )}
            {saveSuccess ? 'Saved' : 'Save'}
          </button>
        </div>
      </div>

      {/* Clarification Mode */}
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <MessageSquare className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-medium">Clarification Questions</span>
        </div>
        <div className="space-y-2">
          {CLARIFICATION_MODES.map((mode) => (
            <button
              key={mode.value}
              onClick={() => updatePreference('clarificationMode', mode.value)}
              className={cn(
                'w-full flex items-center justify-between p-3 rounded-lg border transition-colors text-left',
                preferences.clarificationMode === mode.value
                  ? 'border-indigo-500/50 bg-indigo-500/10'
                  : 'border-white/10 hover:border-white/20 hover:bg-white/5'
              )}
            >
              <div>
                <div className="text-sm font-medium">{mode.label}</div>
                <div className="text-xs text-muted-foreground">{mode.description}</div>
              </div>
              {preferences.clarificationMode === mode.value && (
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  className="h-5 w-5 rounded-full bg-indigo-500 flex items-center justify-center"
                >
                  <Check className="h-3 w-3 text-white" />
                </motion.div>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Max Questions */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm font-medium">Maximum Questions</span>
          </div>
          <span className="text-sm font-mono text-muted-foreground">
            {preferences.maxQuestions}
          </span>
        </div>
        <input
          type="range"
          min={3}
          max={7}
          value={preferences.maxQuestions}
          onChange={(e) => updatePreference('maxQuestions', parseInt(e.target.value))}
          className="w-full h-2 bg-white/10 rounded-full appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-indigo-500"
        />
        <div className="flex justify-between text-xs text-muted-foreground">
          <span>Faster</span>
          <span>More precise</span>
        </div>
      </div>

      {/* Display Options */}
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <Eye className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-medium">Display Options</span>
        </div>
        <div className="space-y-3">
          <SettingRow
            label="Show AI Model Scores"
            description="Display model selection in real-time"
            checked={preferences.showModelScores}
            onChange={(v) => updatePreference('showModelScores', v)}
          />
          <SettingRow
            label="Show Confidence Meter"
            description="Display optimization progress"
            checked={preferences.showConfidenceMeter}
            onChange={(v) => updatePreference('showConfidenceMeter', v)}
          />
          <SettingRow
            label="Show Domain Details"
            description="Display detected domain information"
            checked={preferences.showDomainDetails}
            onChange={(v) => updatePreference('showDomainDetails', v)}
          />
          <SettingRow
            label="Animations"
            description="Enable smooth transitions"
            checked={preferences.animationsEnabled}
            onChange={(v) => updatePreference('animationsEnabled', v)}
          />
          <SettingRow
            label="Sound Effects"
            description="Play sounds for events"
            checked={preferences.soundEnabled}
            onChange={(v) => updatePreference('soundEnabled', v)}
            icon={preferences.soundEnabled ? Volume2 : VolumeX}
          />
        </div>
      </div>

      {/* Learning Options */}
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <Brain className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-medium">Learning & History</span>
        </div>
        <div className="space-y-3">
          <SettingRow
            label="Remember Answers"
            description="Store answers for similar future questions"
            checked={preferences.rememberAnswers}
            onChange={(v) => updatePreference('rememberAnswers', v)}
          />
          <SettingRow
            label="Learn Preferences"
            description="Adapt questions based on your patterns"
            checked={preferences.learnPreferences}
            onChange={(v) => updatePreference('learnPreferences', v)}
          />
          <SettingRow
            label="Auto-Skip Known Answers"
            description="Skip questions with confident predictions"
            checked={preferences.autoSkipKnownAnswers}
            onChange={(v) => updatePreference('autoSkipKnownAnswers', v)}
          />
        </div>
      </div>

      {onClose && (
        <button
          onClick={onClose}
          className="w-full py-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          Close
        </button>
      )}
    </div>
  );
}

interface SettingRowProps {
  label: string;
  description: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  icon?: React.ElementType;
}

function SettingRow({ label, description, checked, onChange, icon: Icon }: SettingRowProps) {
  return (
    <div className="flex items-center justify-between py-1">
      <div className="flex items-center gap-2">
        {Icon && <Icon className="h-4 w-4 text-muted-foreground" />}
        <div>
          <div className="text-sm">{label}</div>
          <div className="text-xs text-muted-foreground">{description}</div>
        </div>
      </div>
      <Toggle checked={checked} onChange={onChange} />
    </div>
  );
}

export default ClarionPreferencesPanel;
