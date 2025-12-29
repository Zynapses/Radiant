// RADIANT v4.18.0 - Ethics Framework Presets
// Externalized ethical frameworks - loaded from JSON configuration

import christianPreset from './christian.json';
import secularPreset from './secular.json';

export interface EthicsTeaching {
  text: string;
  source: string;
  category: string;
}

export interface EthicsPrinciple {
  name: string;
  teachingKey: string;
  weight: number;
  isCore: boolean;
}

export interface EthicsPreset {
  presetId: string;
  name: string;
  description: string;
  version: string;
  teachings: Record<string, EthicsTeaching>;
  principles: EthicsPrinciple[];
  categories: string[];
  defaultGuidance: string;
}

// Available presets
export const ETHICS_PRESETS: Record<string, EthicsPreset> = {
  christian: christianPreset as EthicsPreset,
  secular: secularPreset as EthicsPreset,
};

// Default preset
export const DEFAULT_ETHICS_PRESET = 'christian';

/**
 * Get ethics preset by ID
 */
export function getEthicsPreset(presetId: string): EthicsPreset | null {
  return ETHICS_PRESETS[presetId] || null;
}

/**
 * Get all available presets
 */
export function getAllEthicsPresets(): EthicsPreset[] {
  return Object.values(ETHICS_PRESETS);
}

/**
 * Get teachings from a preset as a flat object (for backward compatibility)
 */
export function getTeachingsObject(presetId: string): Record<string, string> {
  const preset = getEthicsPreset(presetId);
  if (!preset) return {};
  
  const result: Record<string, string> = {};
  for (const [key, teaching] of Object.entries(preset.teachings)) {
    result[key] = teaching.text;
  }
  return result;
}

/**
 * Get the default guidance for a preset
 */
export function getDefaultGuidance(presetId: string): string {
  const preset = getEthicsPreset(presetId);
  return preset?.defaultGuidance || 'Act ethically and with consideration for others';
}
