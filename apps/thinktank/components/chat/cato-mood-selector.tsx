'use client';

/**
 * Cato Mood Selector Component for Think Tank Consumer App
 * Allows users to select Cato's personality mood
 */

import { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Smile, 
  Compass, 
  BookOpen, 
  Sparkles, 
  Heart,
  ChevronDown,
  Check
} from 'lucide-react';
import { cn } from '@/lib/utils';

export type CatoMood = 'balanced' | 'scout' | 'sage' | 'spark' | 'guide';

interface MoodConfig {
  id: CatoMood;
  name: string;
  description: string;
  icon: React.ReactNode;
  color: string;
  bgColor: string;
}

const moods: MoodConfig[] = [
  {
    id: 'balanced',
    name: 'Balanced',
    description: 'Neutral and adaptive personality',
    icon: <Smile className="w-5 h-5" />,
    color: 'text-blue-500',
    bgColor: 'bg-blue-500/10 hover:bg-blue-500/20',
  },
  {
    id: 'scout',
    name: 'Scout',
    description: 'Curious and exploratory',
    icon: <Compass className="w-5 h-5" />,
    color: 'text-green-500',
    bgColor: 'bg-green-500/10 hover:bg-green-500/20',
  },
  {
    id: 'sage',
    name: 'Sage',
    description: 'Thoughtful and analytical',
    icon: <BookOpen className="w-5 h-5" />,
    color: 'text-purple-500',
    bgColor: 'bg-purple-500/10 hover:bg-purple-500/20',
  },
  {
    id: 'spark',
    name: 'Spark',
    description: 'Creative and energetic',
    icon: <Sparkles className="w-5 h-5" />,
    color: 'text-orange-500',
    bgColor: 'bg-orange-500/10 hover:bg-orange-500/20',
  },
  {
    id: 'guide',
    name: 'Guide',
    description: 'Supportive and encouraging',
    icon: <Heart className="w-5 h-5" />,
    color: 'text-pink-500',
    bgColor: 'bg-pink-500/10 hover:bg-pink-500/20',
  },
];

interface CatoMoodSelectorProps {
  value: CatoMood;
  onChange: (mood: CatoMood) => void;
  className?: string;
  disabled?: boolean;
  variant?: 'dropdown' | 'inline' | 'compact';
}

export function CatoMoodSelector({
  value,
  onChange,
  className,
  disabled = false,
  variant = 'dropdown',
}: CatoMoodSelectorProps) {
  const [isOpen, setIsOpen] = useState(false);
  const selectedMood = moods.find(m => m.id === value) || moods[0];

  const handleSelect = useCallback((mood: CatoMood) => {
    onChange(mood);
    setIsOpen(false);
  }, [onChange]);

  if (variant === 'inline') {
    return (
      <div className={cn('flex flex-wrap gap-2', className)}>
        {moods.map((mood) => (
          <button
            key={mood.id}
            onClick={() => handleSelect(mood.id)}
            disabled={disabled}
            className={cn(
              'flex items-center gap-2 px-3 py-2 rounded-lg transition-all',
              mood.bgColor,
              mood.id === value && 'ring-2 ring-offset-2 ring-offset-white dark:ring-offset-zinc-900',
              mood.id === value && mood.color.replace('text-', 'ring-'),
              disabled && 'opacity-50 cursor-not-allowed'
            )}
          >
            <span className={mood.color}>{mood.icon}</span>
            <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
              {mood.name}
            </span>
          </button>
        ))}
      </div>
    );
  }

  if (variant === 'compact') {
    return (
      <div className={cn('relative', className)}>
        <button
          onClick={() => setIsOpen(!isOpen)}
          disabled={disabled}
          className={cn(
            'flex items-center gap-2 px-3 py-2 rounded-lg transition-all',
            selectedMood.bgColor,
            disabled && 'opacity-50 cursor-not-allowed'
          )}
        >
          <span className={selectedMood.color}>{selectedMood.icon}</span>
          <ChevronDown className={cn(
            'w-4 h-4 text-zinc-400 transition-transform',
            isOpen && 'rotate-180'
          )} />
        </button>

        <AnimatePresence>
          {isOpen && (
            <motion.div
              initial={{ opacity: 0, y: -10, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -10, scale: 0.95 }}
              className="absolute top-full left-0 mt-2 w-48 bg-white dark:bg-zinc-900 rounded-xl shadow-xl border border-zinc-200 dark:border-zinc-800 overflow-hidden z-50"
            >
              {moods.map((mood) => (
                <button
                  key={mood.id}
                  onClick={() => handleSelect(mood.id)}
                  className={cn(
                    'w-full flex items-center gap-3 px-4 py-3 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors',
                    mood.id === value && 'bg-zinc-50 dark:bg-zinc-800'
                  )}
                >
                  <span className={mood.color}>{mood.icon}</span>
                  <div className="flex-1 text-left">
                    <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
                      {mood.name}
                    </p>
                  </div>
                  {mood.id === value && (
                    <Check className="w-4 h-4 text-blue-500" />
                  )}
                </button>
              ))}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    );
  }

  // Default dropdown variant
  return (
    <div className={cn('relative', className)}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        disabled={disabled}
        className={cn(
          'w-full flex items-center justify-between gap-3 px-4 py-3 rounded-xl transition-all',
          'bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800',
          'hover:bg-zinc-100 dark:hover:bg-zinc-800',
          disabled && 'opacity-50 cursor-not-allowed'
        )}
      >
        <div className="flex items-center gap-3">
          <div className={cn('p-2 rounded-lg', selectedMood.bgColor)}>
            <span className={selectedMood.color}>{selectedMood.icon}</span>
          </div>
          <div className="text-left">
            <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
              {selectedMood.name}
            </p>
            <p className="text-xs text-zinc-500">
              {selectedMood.description}
            </p>
          </div>
        </div>
        <ChevronDown className={cn(
          'w-5 h-5 text-zinc-400 transition-transform',
          isOpen && 'rotate-180'
        )} />
      </button>

      <AnimatePresence>
        {isOpen && (
          <>
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-40"
              onClick={() => setIsOpen(false)}
            />
            
            {/* Dropdown */}
            <motion.div
              initial={{ opacity: 0, y: -10, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -10, scale: 0.95 }}
              className="absolute top-full left-0 right-0 mt-2 bg-white dark:bg-zinc-900 rounded-xl shadow-xl border border-zinc-200 dark:border-zinc-800 overflow-hidden z-50"
            >
              {moods.map((mood) => (
                <button
                  key={mood.id}
                  onClick={() => handleSelect(mood.id)}
                  className={cn(
                    'w-full flex items-center gap-4 px-4 py-3 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors',
                    mood.id === value && 'bg-zinc-50 dark:bg-zinc-800'
                  )}
                >
                  <div className={cn('p-2 rounded-lg', mood.bgColor)}>
                    <span className={mood.color}>{mood.icon}</span>
                  </div>
                  <div className="flex-1 text-left">
                    <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
                      {mood.name}
                    </p>
                    <p className="text-xs text-zinc-500">
                      {mood.description}
                    </p>
                  </div>
                  {mood.id === value && (
                    <Check className="w-5 h-5 text-blue-500" />
                  )}
                </button>
              ))}
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}

export default CatoMoodSelector;
