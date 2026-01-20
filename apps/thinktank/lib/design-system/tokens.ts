/**
 * Think Tank Design System Tokens
 * 
 * Modern 2026+ design system with:
 * - Glassmorphism / Liquid Glass effects
 * - Aurora gradient backgrounds
 * - Depth layers and shadows
 * - Responsive spacing scale
 * - Animation timing functions
 */

// ============================================================================
// Color Palette
// ============================================================================

export const colors = {
  // Base backgrounds (dark theme)
  background: {
    primary: '#0a0a0f',
    secondary: '#0d0d14',
    tertiary: '#12121a',
    elevated: '#16161f',
  },
  
  // Glass effects
  glass: {
    light: 'rgba(255, 255, 255, 0.03)',
    medium: 'rgba(255, 255, 255, 0.06)',
    strong: 'rgba(255, 255, 255, 0.1)',
    border: 'rgba(255, 255, 255, 0.08)',
    borderHover: 'rgba(255, 255, 255, 0.15)',
  },
  
  // Aurora gradients
  aurora: {
    violet: 'linear-gradient(135deg, #7c3aed 0%, #a855f7 50%, #c084fc 100%)',
    fuchsia: 'linear-gradient(135deg, #c026d3 0%, #e879f9 50%, #f0abfc 100%)',
    cyan: 'linear-gradient(135deg, #06b6d4 0%, #22d3ee 50%, #67e8f9 100%)',
    emerald: 'linear-gradient(135deg, #10b981 0%, #34d399 50%, #6ee7b7 100%)',
    amber: 'linear-gradient(135deg, #f59e0b 0%, #fbbf24 50%, #fcd34d 100%)',
  },
  
  // Glow effects
  glow: {
    violet: '0 0 40px rgba(139, 92, 246, 0.3)',
    fuchsia: '0 0 40px rgba(217, 70, 239, 0.3)',
    cyan: '0 0 40px rgba(34, 211, 238, 0.3)',
    emerald: '0 0 40px rgba(52, 211, 153, 0.3)',
  },
  
  // Semantic colors
  semantic: {
    success: '#22c55e',
    warning: '#f59e0b',
    error: '#ef4444',
    info: '#3b82f6',
  },
  
  // Mode colors
  modes: {
    sniper: {
      primary: '#22c55e',
      glow: 'rgba(34, 197, 94, 0.3)',
      bg: 'rgba(34, 197, 94, 0.1)',
    },
    warRoom: {
      primary: '#a855f7',
      glow: 'rgba(168, 85, 247, 0.3)',
      bg: 'rgba(168, 85, 247, 0.1)',
    },
  },
} as const;

// ============================================================================
// Spacing Scale
// ============================================================================

export const spacing = {
  px: '1px',
  0: '0',
  0.5: '0.125rem',  // 2px
  1: '0.25rem',     // 4px
  1.5: '0.375rem',  // 6px
  2: '0.5rem',      // 8px
  2.5: '0.625rem',  // 10px
  3: '0.75rem',     // 12px
  4: '1rem',        // 16px
  5: '1.25rem',     // 20px
  6: '1.5rem',      // 24px
  8: '2rem',        // 32px
  10: '2.5rem',     // 40px
  12: '3rem',       // 48px
  16: '4rem',       // 64px
  20: '5rem',       // 80px
  24: '6rem',       // 96px
} as const;

// ============================================================================
// Border Radius
// ============================================================================

export const radius = {
  none: '0',
  sm: '0.375rem',   // 6px
  md: '0.5rem',     // 8px
  lg: '0.75rem',    // 12px
  xl: '1rem',       // 16px
  '2xl': '1.5rem',  // 24px
  '3xl': '2rem',    // 32px
  full: '9999px',
} as const;

// ============================================================================
// Shadows & Depth
// ============================================================================

export const shadows = {
  // Standard shadows
  sm: '0 1px 2px 0 rgba(0, 0, 0, 0.05)',
  md: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -2px rgba(0, 0, 0, 0.1)',
  lg: '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -4px rgba(0, 0, 0, 0.1)',
  xl: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1)',
  '2xl': '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
  
  // Glass shadows
  glass: '0 8px 32px 0 rgba(0, 0, 0, 0.37)',
  glassHover: '0 8px 32px 0 rgba(0, 0, 0, 0.5)',
  
  // Inset shadows for depth
  inset: 'inset 0 2px 4px 0 rgba(0, 0, 0, 0.05)',
  innerGlow: 'inset 0 0 20px rgba(255, 255, 255, 0.05)',
} as const;

// ============================================================================
// Animation Timing
// ============================================================================

export const animation = {
  // Durations
  duration: {
    instant: '0ms',
    fast: '150ms',
    normal: '250ms',
    slow: '400ms',
    slower: '600ms',
    slowest: '1000ms',
  },
  
  // Easing functions
  easing: {
    default: 'cubic-bezier(0.4, 0, 0.2, 1)',
    linear: 'linear',
    easeIn: 'cubic-bezier(0.4, 0, 1, 1)',
    easeOut: 'cubic-bezier(0, 0, 0.2, 1)',
    easeInOut: 'cubic-bezier(0.4, 0, 0.2, 1)',
    // Special
    bounce: 'cubic-bezier(0.68, -0.55, 0.265, 1.55)',
    elastic: 'cubic-bezier(0.68, -0.6, 0.32, 1.6)',
    spring: 'cubic-bezier(0.175, 0.885, 0.32, 1.275)',
  },
  
  // Spring configs for Framer Motion
  spring: {
    gentle: { type: 'spring', stiffness: 120, damping: 14 },
    wobbly: { type: 'spring', stiffness: 180, damping: 12 },
    stiff: { type: 'spring', stiffness: 300, damping: 20 },
    slow: { type: 'spring', stiffness: 80, damping: 20 },
  },
} as const;

// ============================================================================
// Typography
// ============================================================================

export const typography = {
  fontFamily: {
    sans: 'var(--font-inter), system-ui, -apple-system, sans-serif',
    mono: 'var(--font-mono), ui-monospace, monospace',
  },
  
  fontSize: {
    xs: ['0.75rem', { lineHeight: '1rem' }],
    sm: ['0.875rem', { lineHeight: '1.25rem' }],
    base: ['1rem', { lineHeight: '1.5rem' }],
    lg: ['1.125rem', { lineHeight: '1.75rem' }],
    xl: ['1.25rem', { lineHeight: '1.75rem' }],
    '2xl': ['1.5rem', { lineHeight: '2rem' }],
    '3xl': ['1.875rem', { lineHeight: '2.25rem' }],
    '4xl': ['2.25rem', { lineHeight: '2.5rem' }],
  },
  
  fontWeight: {
    normal: '400',
    medium: '500',
    semibold: '600',
    bold: '700',
  },
} as const;

// ============================================================================
// Z-Index Scale
// ============================================================================

export const zIndex = {
  base: 0,
  dropdown: 10,
  sticky: 20,
  fixed: 30,
  overlay: 40,
  modal: 50,
  popover: 60,
  tooltip: 70,
  toast: 80,
  max: 9999,
} as const;

// ============================================================================
// Blur Values
// ============================================================================

export const blur = {
  none: '0',
  sm: '4px',
  md: '8px',
  lg: '12px',
  xl: '16px',
  '2xl': '24px',
  '3xl': '40px',
  glass: '20px',
} as const;

// ============================================================================
// Export all tokens
// ============================================================================

export const designTokens = {
  colors,
  spacing,
  radius,
  shadows,
  animation,
  typography,
  zIndex,
  blur,
} as const;

export type DesignTokens = typeof designTokens;
