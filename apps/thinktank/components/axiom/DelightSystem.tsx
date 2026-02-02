'use client';

/**
 * DelightSystem - CLARION Delight Features
 * 
 * Provides delightful UX touches for the CLARION questioning flow:
 * - Progress acknowledgment messages
 * - Model chemistry moments (score shift toasts)
 * - Domain-aware question framing
 * - Sound effects (optional)
 * 
 * @version 1.0.0
 * @since RADIANT v6.0.0
 */

import { useState, useCallback, useEffect, useMemo, createContext, useContext } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';
import { Sparkles, Zap, Target, TrendingUp, Check } from 'lucide-react';
import type { ModelScore, ChemistryMoment, DelightConfig } from '@/lib/axiom/types';

// =============================================================================
// Default Configuration
// =============================================================================

const DEFAULT_DELIGHT_CONFIG: DelightConfig = {
  progressMessages: {
    afterFirstQuestion: [
      "Got it. This helps narrow things down.",
      "Perfect, that clarifies the context.",
      "Good to know. Let me refine the approach.",
    ],
    afterSecondQuestion: [
      "The picture is getting clearer.",
      "This is shaping up nicely.",
      "Two down, making progress.",
    ],
    nearingCompletion: [
      "Almost there...",
      "Just one more to go.",
      "Final clarification.",
    ],
  },
  chemistryThresholds: {
    significantScoreShift: 0.15,
    strongConsensus: 0.9,
    consensusGap: 0.2,
  },
  domainPhrasing: {
    'legal.contracts': {
      partyRole: "Are you the provider or the customer in this agreement?",
      complexity: "How would you characterize this contract's complexity?",
      jurisdiction: "Which jurisdiction applies to this contract?",
    },
    'medicine.diagnosis': {
      urgency: "How urgently do you need this information?",
      context: "Is this for clinical decision-making or research?",
      patient: "Is this regarding a specific patient case?",
    },
    'engineering.software': {
      scope: "Is this a quick fix or a larger architectural decision?",
      constraints: "Any specific technology constraints I should know about?",
      environment: "What's your target deployment environment?",
    },
    'business.finance': {
      timeframe: "What's your investment timeframe?",
      risk: "What's your risk tolerance?",
      scale: "What scale of resources are we discussing?",
    },
    'creative.writing': {
      tone: "What tone are you aiming for?",
      audience: "Who is your target audience?",
      format: "What format or medium is this for?",
    },
  },
};

// =============================================================================
// Context
// =============================================================================

interface DelightContextValue {
  config: DelightConfig;
  showProgressMessage: (questionNumber: number, totalQuestions: number) => void;
  checkChemistry: (prevScores: ModelScore[], newScores: ModelScore[]) => void;
  getDomainQuestion: (domain: string, questionKey: string) => string | null;
  playSound: (type: 'answer' | 'complete' | 'chemistry') => void;
  soundEnabled: boolean;
  setSoundEnabled: (enabled: boolean) => void;
}

const DelightContext = createContext<DelightContextValue | null>(null);

export function useDelight() {
  const context = useContext(DelightContext);
  if (!context) {
    throw new Error('useDelight must be used within a DelightProvider');
  }
  return context;
}

// =============================================================================
// Provider
// =============================================================================

interface DelightProviderProps {
  children: React.ReactNode;
  config?: Partial<DelightConfig>;
  initialSoundEnabled?: boolean;
}

export function DelightProvider({
  children,
  config: customConfig,
  initialSoundEnabled = false,
}: DelightProviderProps) {
  const [soundEnabled, setSoundEnabled] = useState(initialSoundEnabled);
  const [toast, setToast] = useState<{ message: string; icon: string; id: number } | null>(null);

  const config = useMemo<DelightConfig>(() => ({
    ...DEFAULT_DELIGHT_CONFIG,
    ...customConfig,
    progressMessages: {
      ...DEFAULT_DELIGHT_CONFIG.progressMessages,
      ...customConfig?.progressMessages,
    },
    chemistryThresholds: {
      ...DEFAULT_DELIGHT_CONFIG.chemistryThresholds,
      ...customConfig?.chemistryThresholds,
    },
    domainPhrasing: {
      ...DEFAULT_DELIGHT_CONFIG.domainPhrasing,
      ...customConfig?.domainPhrasing,
    },
  }), [customConfig]);

  const showToast = useCallback((message: string, icon: string) => {
    const id = Date.now();
    setToast({ message, icon, id });
    setTimeout(() => {
      setToast(prev => prev?.id === id ? null : prev);
    }, 2500);
  }, []);

  const showProgressMessage = useCallback((questionNumber: number, totalQuestions: number) => {
    const { progressMessages } = config;
    let messages: string[];
    
    if (questionNumber === 1) {
      messages = progressMessages.afterFirstQuestion;
    } else if (questionNumber === 2) {
      messages = progressMessages.afterSecondQuestion;
    } else if (questionNumber >= totalQuestions - 1) {
      messages = progressMessages.nearingCompletion;
    } else {
      return; // No message for middle questions
    }

    const message = messages[Math.floor(Math.random() * messages.length)];
    showToast(message, '✨');
  }, [config, showToast]);

  const checkChemistry = useCallback((prevScores: ModelScore[], newScores: ModelScore[]) => {
    if (prevScores.length === 0 || newScores.length === 0) return;

    const { significantScoreShift, strongConsensus, consensusGap } = config.chemistryThresholds;

    // Check for significant score shift
    for (const newScore of newScores) {
      const prevScore = prevScores.find(p => p.modelId === newScore.modelId);
      if (prevScore) {
        const delta = Math.abs(newScore.score - prevScore.score);
        if (delta >= significantScoreShift) {
          showToast("That answer changed things significantly.", '⚡');
          return;
        }
      }
    }

    // Check for strong consensus
    const topScore = newScores[0]?.score ?? 0;
    const secondScore = newScores[1]?.score ?? 0;
    
    if (topScore >= strongConsensus && (topScore - secondScore) >= consensusGap) {
      showToast("Strong match found.", '🎯');
      return;
    }

    // Check for new leader
    const prevLeader = prevScores.find(s => s.isLeading)?.modelId;
    const newLeader = newScores.find(s => s.isLeading)?.modelId;
    
    if (prevLeader && newLeader && prevLeader !== newLeader) {
      showToast("New top model emerging.", '📈');
    }
  }, [config.chemistryThresholds, showToast]);

  const getDomainQuestion = useCallback((domain: string, questionKey: string): string | null => {
    const domainConfig = config.domainPhrasing[domain];
    if (domainConfig && domainConfig[questionKey]) {
      return domainConfig[questionKey];
    }
    return null;
  }, [config.domainPhrasing]);

  const playSound = useCallback((type: 'answer' | 'complete' | 'chemistry') => {
    if (!soundEnabled) return;
    
    // Sound URLs would be configured in production
    const sounds: Record<string, string> = {
      answer: '/sounds/clarion-answer.mp3',
      complete: '/sounds/clarion-complete.mp3',
      chemistry: '/sounds/clarion-chemistry.mp3',
    };

    try {
      const audio = new Audio(sounds[type]);
      audio.volume = 0.3;
      audio.play().catch(() => {
        // Ignore audio play errors (e.g., user hasn't interacted yet)
      });
    } catch {
      // Ignore audio errors
    }
  }, [soundEnabled]);

  const value: DelightContextValue = {
    config,
    showProgressMessage,
    checkChemistry,
    getDomainQuestion,
    playSound,
    soundEnabled,
    setSoundEnabled,
  };

  return (
    <DelightContext.Provider value={value}>
      {children}
      <DelightToast toast={toast} />
    </DelightContext.Provider>
  );
}

// =============================================================================
// Toast Component
// =============================================================================

interface DelightToastProps {
  toast: { message: string; icon: string; id: number } | null;
}

function DelightToast({ toast }: DelightToastProps) {
  return (
    <AnimatePresence>
      {toast && (
        <motion.div
          key={toast.id}
          initial={{ opacity: 0, y: 50, scale: 0.9 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -20, scale: 0.9 }}
          className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50"
        >
          <div className="flex items-center gap-2 px-4 py-2 bg-white/10 backdrop-blur-lg border border-white/20 rounded-full shadow-lg">
            <span className="text-lg">{toast.icon}</span>
            <span className="text-sm font-medium text-white">{toast.message}</span>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

// =============================================================================
// Chemistry Moment Component
// =============================================================================

interface ChemistryMomentDisplayProps {
  moment: ChemistryMoment;
  onDismiss?: () => void;
}

export function ChemistryMomentDisplay({ moment, onDismiss }: ChemistryMomentDisplayProps) {
  const Icon = moment.type === 'score_shift' ? Zap :
               moment.type === 'consensus' ? Target :
               moment.type === 'new_leader' ? TrendingUp : Sparkles;

  useEffect(() => {
    if (onDismiss) {
      const timer = setTimeout(onDismiss, 3000);
      return () => clearTimeout(timer);
    }
  }, [onDismiss]);

  return (
    <motion.div
      initial={{ opacity: 0, x: 50 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 50 }}
      className="flex items-center gap-3 px-4 py-3 bg-gradient-to-r from-indigo-500/20 to-purple-500/20 border border-indigo-500/30 rounded-lg"
    >
      <div className="p-2 bg-indigo-500/30 rounded-lg">
        <Icon className="h-5 w-5 text-indigo-300" />
      </div>
      <div>
        <p className="text-sm font-medium text-white">{moment.message}</p>
        {moment.scoreDelta && (
          <p className="text-xs text-indigo-300/80">
            Score changed by {Math.round(moment.scoreDelta * 100)}%
          </p>
        )}
      </div>
    </motion.div>
  );
}

// =============================================================================
// Progress Acknowledgment Component
// =============================================================================

interface ProgressAcknowledgmentProps {
  questionNumber: number;
  totalQuestions: number;
  className?: string;
}

export function ProgressAcknowledgment({
  questionNumber,
  totalQuestions,
  className,
}: ProgressAcknowledgmentProps) {
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    const { progressMessages } = DEFAULT_DELIGHT_CONFIG;
    let messages: string[];
    
    if (questionNumber === 1) {
      messages = progressMessages.afterFirstQuestion;
    } else if (questionNumber === 2) {
      messages = progressMessages.afterSecondQuestion;
    } else if (questionNumber >= totalQuestions - 1) {
      messages = progressMessages.nearingCompletion;
    } else {
      setMessage(null);
      return;
    }

    const selected = messages[Math.floor(Math.random() * messages.length)];
    setMessage(selected);

    const timer = setTimeout(() => setMessage(null), 2000);
    return () => clearTimeout(timer);
  }, [questionNumber, totalQuestions]);

  return (
    <AnimatePresence>
      {message && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          className={cn(
            'flex items-center gap-2 text-sm text-indigo-300',
            className
          )}
        >
          <Check className="h-4 w-4" />
          <span>{message}</span>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

// =============================================================================
// Exports
// =============================================================================

export { DEFAULT_DELIGHT_CONFIG };
