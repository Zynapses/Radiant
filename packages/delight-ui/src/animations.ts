/**
 * @radiant/delight-ui - Personality-Aware Animation System
 *
 * Provides animation parameters that adapt to the user's personality mode.
 * Used by the polymorphic UI, liquid morph panel, and all transition effects
 * to ensure the entire UX feels consistent with the user's chosen personality.
 *
 * Professional → crisp, minimal, fast
 * Subtle → fade-only, gentle
 * Expressive → smooth springs with slight overshoot
 * Playful → bouncy, dramatic, particle-worthy
 * Auto → maps to expressive (balanced default)
 */

import type { PersonalityMode } from './types';

export interface PersonalityAnimationConfig {
  /** Framer Motion spring stiffness */
  stiffness: number;
  /** Framer Motion spring damping */
  damping: number;
  /** Base transition duration in seconds */
  duration: number;
  /** Scale amount for enter/exit (1.0 = no scale) */
  scaleEnter: number;
  scaleExit: number;
  /** Y offset for slide animations */
  yEnter: number;
  yExit: number;
  /** Whether to use spring or tween */
  type: 'spring' | 'tween';
  /** Opacity transition duration (can differ from main) */
  opacityDuration: number;
  /** Whether to show particle/confetti effects on milestones */
  showParticles: boolean;
  /** Whether morph transitions get the full-screen overlay */
  showMorphOverlay: boolean;
  /** Easing for tween animations */
  easing: number[];
}

const ANIMATION_CONFIGS: Record<PersonalityMode, PersonalityAnimationConfig> = {
  professional: {
    stiffness: 500,
    damping: 40,
    duration: 0.15,
    scaleEnter: 0.99,
    scaleExit: 0.99,
    yEnter: 4,
    yExit: -4,
    type: 'tween',
    opacityDuration: 0.12,
    showParticles: false,
    showMorphOverlay: false,
    easing: [0.25, 0.1, 0.25, 1],
  },
  subtle: {
    stiffness: 350,
    damping: 35,
    duration: 0.2,
    scaleEnter: 1.0,
    scaleExit: 1.0,
    yEnter: 0,
    yExit: 0,
    type: 'tween',
    opacityDuration: 0.2,
    showParticles: false,
    showMorphOverlay: false,
    easing: [0.4, 0, 0.2, 1],
  },
  expressive: {
    stiffness: 300,
    damping: 25,
    duration: 0.3,
    scaleEnter: 0.97,
    scaleExit: 0.97,
    yEnter: 10,
    yExit: -10,
    type: 'spring',
    opacityDuration: 0.25,
    showParticles: false,
    showMorphOverlay: true,
    easing: [0.34, 1.56, 0.64, 1],
  },
  playful: {
    stiffness: 200,
    damping: 15,
    duration: 0.4,
    scaleEnter: 0.92,
    scaleExit: 0.92,
    yEnter: 20,
    yExit: -15,
    type: 'spring',
    opacityDuration: 0.3,
    showParticles: true,
    showMorphOverlay: true,
    easing: [0.68, -0.55, 0.27, 1.55],
  },
  auto: {
    stiffness: 300,
    damping: 25,
    duration: 0.3,
    scaleEnter: 0.98,
    scaleExit: 0.98,
    yEnter: 10,
    yExit: -10,
    type: 'spring',
    opacityDuration: 0.25,
    showParticles: false,
    showMorphOverlay: true,
    easing: [0.34, 1.56, 0.64, 1],
  },
};

export function getAnimationConfig(mode: PersonalityMode): PersonalityAnimationConfig {
  return ANIMATION_CONFIGS[mode] ?? ANIMATION_CONFIGS.auto;
}

/**
 * Get Framer Motion transition object for the current personality mode.
 * Drop this directly into a motion component's `transition` prop.
 */
export function getMotionTransition(mode: PersonalityMode) {
  const config = getAnimationConfig(mode);
  if (config.type === 'spring') {
    return {
      type: 'spring' as const,
      stiffness: config.stiffness,
      damping: config.damping,
      duration: config.duration,
    };
  }
  return {
    type: 'tween' as const,
    duration: config.duration,
    ease: config.easing,
  };
}

/**
 * Get initial/animate/exit animation states for view morph transitions.
 */
export function getMorphAnimationStates(mode: PersonalityMode) {
  const config = getAnimationConfig(mode);
  return {
    initial: { opacity: 0, scale: config.scaleEnter, y: config.yEnter },
    animate: { opacity: 1, scale: 1, y: 0 },
    exit: { opacity: 0, scale: config.scaleExit, y: config.yExit },
    transition: getMotionTransition(mode),
  };
}

// =============================================================================
// Morph Narration Messages — personality-aware transition text
// =============================================================================

export type MorphTarget =
  | 'chat' | 'terminal' | 'canvas' | 'dashboard'
  | 'diff_editor' | 'decision_cards'
  | 'datagrid' | 'chart' | 'kanban'
  | 'calculator' | 'code_editor' | 'document' | 'custom';

const MORPH_NARRATIONS: Record<PersonalityMode, Record<string, string>> = {
  professional: {
    datagrid: 'Switching to data grid.',
    chart: 'Opening visualization.',
    kanban: 'Loading task board.',
    calculator: 'Opening calculator.',
    code_editor: 'Opening code editor.',
    document: 'Opening document.',
    terminal: 'Entering command mode.',
    canvas: 'Opening canvas.',
    dashboard: 'Loading dashboard.',
    diff_editor: 'Opening verification view.',
    decision_cards: 'Awaiting your decision.',
    custom: 'Loading view.',
    _default: 'Switching view.',
  },
  subtle: {
    datagrid: 'Data grid ready.',
    chart: 'Chart view.',
    kanban: 'Board view.',
    calculator: 'Calculator.',
    code_editor: 'Code editor.',
    document: 'Document.',
    terminal: 'Terminal.',
    canvas: 'Canvas.',
    dashboard: 'Dashboard.',
    diff_editor: 'Diff view.',
    decision_cards: 'Decision point.',
    custom: 'View ready.',
    _default: 'Switching.',
  },
  expressive: {
    datagrid: 'Transforming into a data playground!',
    chart: 'Let\'s visualize this beautifully!',
    kanban: 'Your task board is taking shape!',
    calculator: 'Number crunching mode activated!',
    code_editor: 'Code editor spinning up!',
    document: 'Crafting your document workspace!',
    terminal: 'Command center at your fingertips!',
    canvas: 'Infinite canvas — let your ideas flow!',
    dashboard: 'Your analytics hub is ready!',
    diff_editor: 'Side-by-side verification engaged!',
    decision_cards: 'Your input matters — what\'s the call?',
    custom: 'Something special is loading!',
    _default: 'Transforming your workspace!',
  },
  playful: {
    datagrid: 'Ooh, spreadsheet time! Let\'s crunch some numbers! 📊',
    chart: 'Making data look gorgeous — you\'re welcome! 📈',
    kanban: 'Kanban board incoming! Drag all the things! 🎯',
    calculator: 'Math mode: engaged. *puts on glasses* 🤓',
    code_editor: 'Hack mode activated! 💻',
    document: 'Time to write something legendary! ✍️',
    terminal: 'Welcome to the Matrix. 🟢',
    canvas: 'Infinite canvas! Draw like nobody\'s watching! 🎨',
    dashboard: 'Command center! Feel the power! ⚡',
    diff_editor: 'Spot-the-difference champion mode! 🔍',
    decision_cards: 'Choose wisely, young padawan! 🧙',
    custom: 'Mystery view unlocked! 🎁',
    _default: 'Morphing! This is the cool part! ✨',
  },
  auto: {
    datagrid: 'Morphing to data grid.',
    chart: 'Creating visualization.',
    kanban: 'Opening task board.',
    calculator: 'Opening calculator.',
    code_editor: 'Opening code editor.',
    document: 'Opening document.',
    terminal: 'Entering command mode.',
    canvas: 'Opening canvas.',
    dashboard: 'Loading dashboard.',
    diff_editor: 'Opening verification.',
    decision_cards: 'Decision point.',
    custom: 'Loading view.',
    _default: 'Morphing view.',
  },
};

const MORPH_SUBTITLES: Record<PersonalityMode, string> = {
  professional: 'View transition in progress.',
  subtle: '',
  expressive: 'Chat becomes app. App becomes whatever you need.',
  playful: 'Chat becomes app. App becomes whatever you need. Magic! ✨',
  auto: 'Chat becomes app. App becomes whatever you need.',
};

export function getMorphNarration(mode: PersonalityMode, target: string): string {
  const modeNarrations = MORPH_NARRATIONS[mode] ?? MORPH_NARRATIONS.auto;
  return modeNarrations[target] ?? modeNarrations._default ?? 'Switching view.';
}

export function getMorphSubtitle(mode: PersonalityMode): string {
  return MORPH_SUBTITLES[mode] ?? MORPH_SUBTITLES.auto;
}
