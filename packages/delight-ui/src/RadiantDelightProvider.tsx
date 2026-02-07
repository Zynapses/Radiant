'use client';

/**
 * @radiant/delight-ui - RadiantDelightProvider
 *
 * Universal Delight provider for ALL RADIANT user-facing apps.
 * Wraps any app with personality-aware UX touches:
 *   - Pre-execution: greetings, encouragement
 *   - During execution: progress acknowledgments
 *   - Post-execution: celebrations, milestones
 *   - Error recovery: empathetic, helpful messages
 *   - Idle: ambient personality
 *
 * Usage:
 *   <RadiantDelightProvider config={{ appId: 'curator', appName: 'Curator' }}>
 *     <App />
 *   </RadiantDelightProvider>
 */

import {
  createContext,
  useContext,
  useState,
  useCallback,
  useMemo,
  useEffect,
  type ReactNode,
} from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Sparkles, Check, AlertTriangle, Trophy, Zap } from 'lucide-react';
import type {
  PersonalityMode,
  InjectionPoint,
  DisplayStyle,
  AppDelightConfig,
  RadiantDelightContextValue,
  DelightToastData,
} from './types';
import { playSynthSound } from './sounds';

// =============================================================================
// Default Messages (fallback when API is unavailable)
// =============================================================================

const DEFAULT_MESSAGES: Record<InjectionPoint, Record<PersonalityMode, string[]>> = {
  page_load: {
    auto: ['Welcome back.', 'Ready when you are.', 'Let\'s get to work.'],
    professional: ['Dashboard loaded.', 'System ready.', 'All systems operational.'],
    subtle: ['Hey.', 'Ready.', 'Here we go.'],
    expressive: ['Great to see you!', 'Let\'s make something happen!', 'Your workspace is ready!'],
    playful: ['The gang\'s all here!', 'Plot twist: you showed up!', 'Adventure awaits!'],
  },
  session_start: {
    auto: ['New session started.', 'Fresh start.'],
    professional: ['Session initialized.', 'Workspace ready.'],
    subtle: ['Starting up.', 'Here we go.'],
    expressive: ['New session, new possibilities!', 'Let\'s dive in!'],
    playful: ['Round one... fight!', 'New quest unlocked!'],
  },
  pre_execution: {
    auto: ['Working on it...', 'Processing...', 'One moment...'],
    professional: ['Executing request.', 'Processing.', 'In progress.'],
    subtle: ['On it.', 'Working...'],
    expressive: ['Let me work my magic!', 'Spinning up the engines!', 'Here we go!'],
    playful: ['Hold my coffee...', 'Watch this!', 'Engaging hyperdrive!'],
  },
  during_execution: {
    auto: ['Still working...', 'Almost there...', 'Making progress...'],
    professional: ['Processing continues.', 'Execution in progress.'],
    subtle: ['Working...', 'Moment...'],
    expressive: ['Getting closer!', 'The gears are turning!'],
    playful: ['Crunching numbers furiously...', 'Teaching hamsters to run faster...'],
  },
  post_execution: {
    auto: ['Done.', 'Complete.', 'All set.'],
    professional: ['Operation completed successfully.', 'Task complete.'],
    subtle: ['Done.', 'Finished.'],
    expressive: ['Nailed it!', 'All done!', 'That went well!'],
    playful: ['Boom! Done!', 'Another one bites the dust!', 'Easy peasy!'],
  },
  action_complete: {
    auto: ['Saved.', 'Updated.', 'Applied.'],
    professional: ['Changes saved successfully.', 'Update applied.'],
    subtle: ['Saved.', 'Done.'],
    expressive: ['Changes locked in!', 'Looking good!'],
    playful: ['Saved like a pro!', 'And the crowd goes wild!'],
  },
  error_recovery: {
    auto: ['Something went wrong. Let\'s try again.', 'An error occurred. Don\'t worry, we can fix this.'],
    professional: ['An error occurred. Please retry or contact support.', 'Operation failed. See details below.'],
    subtle: ['Error. Retry?', 'That didn\'t work.'],
    expressive: ['Oops! Don\'t worry, these things happen. Let\'s try again!', 'Hit a snag, but we\'ve got this!'],
    playful: ['Well, that was unexpected! Let\'s give it another shot.', 'Plot twist! But don\'t worry, we\'ll figure this out.'],
  },
  idle: {
    auto: [],
    professional: [],
    subtle: [],
    expressive: ['Need anything?', 'I\'m here if you need me.'],
    playful: ['*twiddles thumbs*', 'So... nice weather, huh?'],
  },
  milestone: {
    auto: ['Milestone reached!', 'Great progress!'],
    professional: ['Milestone achieved.', 'Progress checkpoint reached.'],
    subtle: ['Milestone.', 'Nice.'],
    expressive: ['You\'re on fire!', 'Incredible progress!', 'What a milestone!'],
    playful: ['Achievement unlocked!', 'Level up!', 'You absolute legend!'],
  },
  onboarding: {
    auto: ['Welcome! Let me show you around.', 'First time here? Let\'s get you set up.'],
    professional: ['Welcome. Follow the setup guide to begin.', 'Initial configuration required.'],
    subtle: ['Welcome. Let\'s set up.', 'New here? Quick setup ahead.'],
    expressive: ['Welcome aboard! I\'m so excited to show you everything!', 'Your journey starts here!'],
    playful: ['Welcome to the cool kids\' club!', 'Tutorial time! Don\'t worry, it\'s painless.'],
  },
  session_end: {
    auto: ['Session complete. Good work.', 'See you next time.'],
    professional: ['Session concluded. Summary available.', 'Work saved. Session ended.'],
    subtle: ['Done for now.', 'See you.'],
    expressive: ['Great session! You accomplished a lot!', 'Until next time!'],
    playful: ['That\'s a wrap!', 'Same time tomorrow?', 'Mic drop. Exit stage left.'],
  },
};

const ICONS: Record<InjectionPoint, string> = {
  page_load: '👋',
  session_start: '🚀',
  pre_execution: '⚡',
  during_execution: '⏳',
  post_execution: '✅',
  action_complete: '💾',
  error_recovery: '🔧',
  idle: '💤',
  milestone: '🏆',
  onboarding: '🎓',
  session_end: '👋',
};

// =============================================================================
// Context
// =============================================================================

const RadiantDelightContext = createContext<RadiantDelightContextValue | null>(null);

// =============================================================================
// Provider
// =============================================================================

interface RadiantDelightProviderProps {
  children: ReactNode;
  config: AppDelightConfig;
  /** Override initial personality mode */
  initialPersonalityMode?: PersonalityMode;
  /** Override initial sound setting */
  initialSoundEnabled?: boolean;
}

export function RadiantDelightProvider({
  children,
  config,
  initialPersonalityMode,
  initialSoundEnabled = false,
}: RadiantDelightProviderProps) {
  // Tenant-level controls
  const tenantEnabled = config.tenantDelightEnabled !== false;
  const tenantAllowOverride = config.tenantAllowUserOverride !== false;

  const resolveInitialMode = (): PersonalityMode => {
    if (!tenantEnabled) return 'professional';
    if (!tenantAllowOverride && config.tenantDefaultMode) return config.tenantDefaultMode;
    return initialPersonalityMode ?? config.defaultPersonalityMode ?? 'auto';
  };

  const [personalityMode, setPersonalityModeInternal] = useState<PersonalityMode>(resolveInitialMode());
  const [soundEnabled, setSoundEnabled] = useState(
    tenantEnabled ? (initialSoundEnabled ?? config.defaultSoundEnabled ?? false) : false
  );

  // Wrap setPersonalityMode to enforce tenant lock
  const setPersonalityMode = useCallback((mode: PersonalityMode) => {
    if (!tenantEnabled) return;
    if (!tenantAllowOverride && config.tenantDefaultMode) return;
    setPersonalityModeInternal(mode);
  }, [tenantEnabled, tenantAllowOverride, config.tenantDefaultMode]);
  const [toasts, setToasts] = useState<DelightToastData[]>([]);

  // Persist personality preference
  useEffect(() => {
    try {
      const stored = localStorage.getItem(`radiant-delight-${config.appId}`);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (parsed.personalityMode) setPersonalityMode(parsed.personalityMode);
        if (parsed.soundEnabled !== undefined) setSoundEnabled(parsed.soundEnabled);
      }
    } catch {
      // Ignore localStorage errors
    }
  }, [config.appId]);

  useEffect(() => {
    try {
      localStorage.setItem(
        `radiant-delight-${config.appId}`,
        JSON.stringify({ personalityMode, soundEnabled })
      );
    } catch {
      // Ignore localStorage errors
    }
  }, [personalityMode, soundEnabled, config.appId]);

  const showDelightToast = useCallback(
    (message: string, icon = '✨', style: DisplayStyle = 'toast') => {
      const id = Date.now() + Math.random();
      setToasts((prev) => [...prev.slice(-4), { id, message, icon, style }]);
      const duration = style === 'celebration' ? 4000 : style === 'subtle' ? 1500 : 2500;
      setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== id));
      }, duration);
    },
    []
  );

  const playSound = useCallback(
    (type: 'success' | 'error' | 'milestone' | 'subtle') => {
      if (!soundEnabled) return;
      try {
        playSynthSound(personalityMode, type, 0.25);
      } catch {
        // Ignore audio errors
      }
    },
    [soundEnabled, personalityMode]
  );

  const selectMessage = useCallback(
    (injectionPoint: InjectionPoint): { message: string; icon: string } | null => {
      // Check app-specific overrides first
      const appMessages = getAppMessages(config, injectionPoint);
      if (appMessages && appMessages.length > 0) {
        return {
          message: appMessages[Math.floor(Math.random() * appMessages.length)],
          icon: ICONS[injectionPoint] || '✨',
        };
      }

      // Check custom injection points
      if (config.customInjectionPoints?.[injectionPoint]) {
        const custom = config.customInjectionPoints[injectionPoint];
        return {
          message: custom[Math.floor(Math.random() * custom.length)],
          icon: ICONS[injectionPoint] || '✨',
        };
      }

      // Fall back to default messages based on personality mode
      const modeMessages = DEFAULT_MESSAGES[injectionPoint]?.[personalityMode];
      if (!modeMessages || modeMessages.length === 0) return null;

      return {
        message: modeMessages[Math.floor(Math.random() * modeMessages.length)],
        icon: ICONS[injectionPoint] || '✨',
      };
    },
    [config, personalityMode]
  );

  const triggerDelight = useCallback(
    (injectionPoint: InjectionPoint, _metadata?: Record<string, unknown>) => {
      // Tenant-level kill switch: suppress all output
      if (!tenantEnabled) return;

      // In professional mode, suppress most non-essential messages
      if (personalityMode === 'professional' && ['idle', 'session_start'].includes(injectionPoint)) {
        return;
      }

      const selected = selectMessage(injectionPoint);
      if (!selected) return;

      const style: DisplayStyle =
        injectionPoint === 'milestone' ? 'celebration' :
        injectionPoint === 'error_recovery' ? 'banner' :
        ['idle'].includes(injectionPoint) ? 'subtle' :
        'toast';

      showDelightToast(selected.message, selected.icon, style);

      // Play sounds for key moments
      if (soundEnabled) {
        if (['post_execution', 'action_complete'].includes(injectionPoint)) playSound('success');
        else if (injectionPoint === 'error_recovery') playSound('error');
        else if (injectionPoint === 'milestone') playSound('milestone');
      }
    },
    [tenantEnabled, personalityMode, selectMessage, showDelightToast, soundEnabled, playSound]
  );

  const value = useMemo<RadiantDelightContextValue>(
    () => ({
      personalityMode,
      setPersonalityMode,
      soundEnabled,
      setSoundEnabled,
      triggerDelight,
      showDelightToast,
      playSound,
      config,
    }),
    [personalityMode, soundEnabled, triggerDelight, showDelightToast, playSound, config]
  );

  return (
    <RadiantDelightContext.Provider value={value}>
      {children}
      <DelightToastContainer toasts={toasts} />
    </RadiantDelightContext.Provider>
  );
}

// =============================================================================
// Hook
// =============================================================================

export function useRadiantDelight(): RadiantDelightContextValue {
  const context = useContext(RadiantDelightContext);
  if (!context) {
    throw new Error(
      'useRadiantDelight must be used within a <RadiantDelightProvider>. ' +
      'Wrap your app with <RadiantDelightProvider config={...}>.'
    );
  }
  return context;
}

/**
 * Safe version that returns null instead of throwing when outside provider.
 * Useful for shared components that may or may not be in a Delight context.
 */
export function useRadiantDelightOptional(): RadiantDelightContextValue | null {
  return useContext(RadiantDelightContext);
}

// =============================================================================
// Toast Container
// =============================================================================

function DelightToastContainer({ toasts }: { toasts: DelightToastData[] }) {
  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[9999] flex flex-col items-center gap-2 pointer-events-none">
      <AnimatePresence mode="popLayout">
        {toasts.map((toast) => (
          <DelightToastItem key={toast.id} toast={toast} />
        ))}
      </AnimatePresence>
    </div>
  );
}

function DelightToastItem({ toast }: { toast: DelightToastData }) {
  const bgClass =
    toast.style === 'celebration'
      ? 'bg-gradient-to-r from-amber-500/20 via-yellow-500/20 to-amber-500/20 border-amber-500/30'
      : toast.style === 'banner'
        ? 'bg-rose-500/15 border-rose-500/30'
        : toast.style === 'subtle'
          ? 'bg-white/5 border-white/10'
          : 'bg-white/10 border-white/20';

  const IconComponent =
    toast.style === 'celebration' ? Trophy :
    toast.style === 'banner' ? AlertTriangle :
    toast.icon === '⚡' ? Zap :
    toast.icon === '✅' ? Check :
    Sparkles;

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 30, scale: 0.9 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -15, scale: 0.9 }}
      transition={{ type: 'spring', stiffness: 400, damping: 30 }}
      className={`flex items-center gap-2.5 px-4 py-2.5 backdrop-blur-xl border rounded-full shadow-lg ${bgClass}`}
    >
      {toast.icon ? (
        <span className="text-base leading-none">{toast.icon}</span>
      ) : (
        <IconComponent className="h-4 w-4 text-white/70" />
      )}
      <span className="text-sm font-medium text-white/90 whitespace-nowrap">{toast.message}</span>
    </motion.div>
  );
}

// =============================================================================
// Helpers
// =============================================================================

function getAppMessages(config: AppDelightConfig, injectionPoint: InjectionPoint): string[] | undefined {
  switch (injectionPoint) {
    case 'pre_execution':
      return config.preExecutionMessages;
    case 'during_execution':
      return config.duringExecutionMessages;
    case 'post_execution':
      return config.postExecutionMessages;
    case 'error_recovery':
      return config.errorRecoveryMessages;
    case 'page_load':
    case 'session_start':
      return config.greetingMessages;
    case 'milestone':
      return config.milestoneMessages;
    default:
      return undefined;
  }
}
