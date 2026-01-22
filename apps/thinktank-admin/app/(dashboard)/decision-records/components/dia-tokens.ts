/**
 * RADIANT v5.43.0 - DIA Engine Design Tokens
 * 
 * Visual design system for the Living Parchment interface.
 * These tokens define the "2029 Vision" sensory design language.
 */

export const DIAColors = {
  // Heatmap colors (THE MOAT - trust topology visualization)
  heatmapVerified: '#10B981',    // Emerald - verified claims
  heatmapUnverified: '#F59E0B',  // Amber - unverified claims
  heatmapContested: '#EF4444',   // Red - contested claims
  heatmapStale: '#8B5CF6',       // Violet - stale data
  
  // Living Ink
  inkFresh: '#FFFFFF',
  inkStale: '#9CA3AF',
  
  // Ghost Paths (alternate timelines)
  ghostPath: 'rgba(255, 255, 255, 0.15)',
  ghostPathHover: 'rgba(255, 255, 255, 0.4)',
  ghostPathGlow: '#F59E0B',
  
  // Control Island
  islandBackground: 'rgba(31, 31, 35, 0.95)',
  islandBorder: 'rgba(255, 255, 255, 0.1)',
  islandActiveTab: '#6366F1',
  
  // Hold-to-Confirm
  confirmFill: '#10B981',
  confirmGlow: 'rgba(16, 185, 129, 0.4)',
  
  // Canvas backgrounds
  canvasBackground: '#0A0A0D',
  parchmentBackground: '#111114',
  surfaceElevated: '#1A1A1F',
  
  // Text
  textPrimary: '#FFFFFF',
  textSecondary: 'rgba(255, 255, 255, 0.7)',
  textMuted: 'rgba(255, 255, 255, 0.4)',
} as const;

export const SegmentTypeColors: Record<string, string> = {
  verified: DIAColors.heatmapVerified,
  unverified: DIAColors.heatmapUnverified,
  contested: DIAColors.heatmapContested,
  stale: DIAColors.heatmapStale,
};

export const DIAShadows = {
  // Elevation shadows (NO BORDERS - depth defines areas)
  elevated: '0 4px 12px rgba(0, 0, 0, 0.4)',
  elevatedHigh: '0 8px 24px rgba(0, 0, 0, 0.5)',
  inset: 'inset 0 2px 4px rgba(0, 0, 0, 0.3)',
  
  // Glow effects
  verified: '0 0 12px rgba(16, 185, 129, 0.3)',
  contested: '0 0 12px rgba(239, 68, 68, 0.3)',
  stale: '0 0 12px rgba(139, 92, 246, 0.3)',
};

export const DIAAnimations = {
  // Breathing rates (per the spec)
  breathingVerified: {
    duration: 10, // 6 BPM = 10s cycle
    amplitude: 0.05, // ±5% opacity
  },
  breathingContested: {
    duration: 5, // 12 BPM = 5s cycle  
    amplitude: 0.12, // ±12% opacity
  },
  breathingDefault: {
    duration: 7.5,
    amplitude: 0.08,
  },
  
  // Validation wave
  validationWave: {
    duration: 2,
    easing: 'cubic-bezier(0.4, 0, 0.2, 1)',
  },
  
  // Hold-to-confirm
  holdDuration: 1500, // 1.5 seconds
};

export const DIATypography = {
  // Font weights for confidence indication
  minWeight: 350,
  maxWeight: 500,
  
  // Map confidence (0-1) to font weight
  getConfidenceWeight: (confidence: number): number => {
    return Math.round(
      DIATypography.minWeight + 
      confidence * (DIATypography.maxWeight - DIATypography.minWeight)
    );
  },
};

export const DIALenses = {
  read: {
    id: 'read',
    label: 'Read',
    icon: 'FileText',
    description: 'Standard reading view',
  },
  xray: {
    id: 'xray',
    label: 'X-Ray',
    icon: 'Eye',
    description: 'Evidence links visible',
  },
  risk: {
    id: 'risk',
    label: 'Risk',
    icon: 'AlertTriangle',
    description: 'Contested areas and ghost paths',
  },
  compliance: {
    id: 'compliance',
    label: 'Compliance',
    icon: 'Shield',
    description: 'Regulatory coverage',
  },
} as const;

export type DIALensType = keyof typeof DIALenses;
