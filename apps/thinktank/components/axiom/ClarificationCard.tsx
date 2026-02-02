'use client';

/**
 * ClarificationCard - CLARION Q&A Interface
 * 
 * Renders question cards with support for:
 * - Single choice (radio buttons)
 * - Multi-select (checkboxes)
 * - Text input
 * - Scale (slider)
 * - Boolean (yes/no)
 * 
 * @version 2.0.0
 * @since RADIANT v6.0.0
 */

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import { MessageCircleQuestion, SkipForward, Send, Loader2 } from 'lucide-react';

type QuestionType = 'choice' | 'multi_select' | 'text' | 'scale' | 'boolean';

interface Question {
  questionId: string;
  type: QuestionType;
  text: { en: string; [locale: string]: string | undefined };
  options?: { en: string[]; [locale: string]: string[] | undefined };
  category: string;
}

interface ClarificationCardProps {
  question: Question;
  questionNumber: number;
  totalQuestions: number;
  onAnswer: (answer: string | string[] | number | boolean) => void;
  onSkip: () => void;
  onSkipAll?: () => void;
  isSubmitting?: boolean;
  locale?: string;
  enableSwipeGestures?: boolean;
  className?: string;
}

export function ClarificationCard({
  question,
  questionNumber,
  totalQuestions,
  onAnswer,
  onSkip,
  onSkipAll,
  isSubmitting = false,
  locale = 'en',
  enableSwipeGestures = true,
  className,
}: ClarificationCardProps) {
  const [selectedChoice, setSelectedChoice] = useState<string | null>(null);
  const [selectedMulti, setSelectedMulti] = useState<string[]>([]);
  const [textInput, setTextInput] = useState('');
  const [scaleValue, setScaleValue] = useState(3);
  const [boolValue, setBoolValue] = useState<boolean | null>(null);
  const [focusedOption, setFocusedOption] = useState(0);
  const [swipeX, setSwipeX] = useState(0);
  const [isSwiping, setIsSwiping] = useState(false);
  
  const containerRef = useRef<HTMLDivElement>(null);
  const firstOptionRef = useRef<HTMLButtonElement>(null);
  const touchStartX = useRef(0);
  const announceRef = useRef<HTMLDivElement>(null);

  const questionText = question.text[locale] || question.text.en;
  const options = question.options?.[locale] || question.options?.en || [];

  // Auto-focus first option when question changes
  useEffect(() => {
    if (firstOptionRef.current) {
      firstOptionRef.current.focus();
    }
    setFocusedOption(0);
  }, [question.questionId]);

  // Announce question change for screen readers
  useEffect(() => {
    if (announceRef.current) {
      announceRef.current.textContent = `Question ${questionNumber} of ${totalQuestions}: ${questionText}`;
    }
  }, [questionNumber, totalQuestions, questionText]);

  // Keyboard navigation for options
  const handleKeyDown = useCallback((e: React.KeyboardEvent, optionIndex: number, totalOptions: number) => {
    switch (e.key) {
      case 'ArrowDown':
      case 'ArrowRight':
        e.preventDefault();
        setFocusedOption((optionIndex + 1) % totalOptions);
        break;
      case 'ArrowUp':
      case 'ArrowLeft':
        e.preventDefault();
        setFocusedOption((optionIndex - 1 + totalOptions) % totalOptions);
        break;
      case 'Enter':
      case ' ':
        e.preventDefault();
        // Selection is handled by onClick
        break;
    }
  }, []);

  // Focus the correct option when focusedOption changes
  useEffect(() => {
    const container = containerRef.current;
    if (container) {
      const buttons = container.querySelectorAll('[data-option-button]');
      const button = buttons[focusedOption] as HTMLButtonElement;
      if (button) {
        button.focus();
      }
    }
  }, [focusedOption]);

  // Touch gesture handlers for swipe-to-skip
  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    if (!enableSwipeGestures) return;
    touchStartX.current = e.touches[0].clientX;
    setIsSwiping(true);
  }, [enableSwipeGestures]);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (!enableSwipeGestures || !isSwiping) return;
    const deltaX = e.touches[0].clientX - touchStartX.current;
    setSwipeX(Math.max(0, deltaX)); // Only allow right swipe
  }, [enableSwipeGestures, isSwiping]);

  const handleTouchEnd = useCallback(() => {
    if (!enableSwipeGestures) return;
    if (swipeX > 100) {
      onSkip();
    }
    setSwipeX(0);
    setIsSwiping(false);
  }, [enableSwipeGestures, swipeX, onSkip]);

  const handleSubmit = () => {
    if (isSubmitting) return;

    switch (question.type) {
      case 'choice':
        if (selectedChoice) onAnswer(selectedChoice);
        break;
      case 'multi_select':
        if (selectedMulti.length > 0) onAnswer(selectedMulti);
        break;
      case 'text':
        if (textInput.trim()) onAnswer(textInput.trim());
        break;
      case 'scale':
        onAnswer(scaleValue);
        break;
      case 'boolean':
        if (boolValue !== null) onAnswer(boolValue);
        break;
    }
  };

  const isValid = () => {
    switch (question.type) {
      case 'choice':
        return selectedChoice !== null;
      case 'multi_select':
        return selectedMulti.length > 0;
      case 'text':
        return textInput.trim().length > 0;
      case 'scale':
        return true;
      case 'boolean':
        return boolValue !== null;
      default:
        return false;
    }
  };

  return (
    <motion.div
      ref={containerRef}
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0, x: swipeX }}
      exit={{ opacity: 0, y: -10 }}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      className={cn(
        'rounded-xl bg-white/5 border border-white/10 overflow-hidden',
        isSwiping && swipeX > 50 && 'border-indigo-500/50',
        className
      )}
      role="region"
      aria-label={`Clarification question ${questionNumber} of ${totalQuestions}`}
    >
      {/* Screen reader announcement */}
      <div ref={announceRef} aria-live="polite" aria-atomic="true" className="sr-only" />
      {/* Header */}
      <div className="px-5 py-3 bg-white/5 border-b border-white/10 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <MessageCircleQuestion className="w-4 h-4 text-indigo-400" />
          <span className="text-sm text-white/60">
            Question {questionNumber} of {totalQuestions}
          </span>
        </div>
        <span className="text-xs px-2 py-0.5 rounded bg-white/10 text-white/50 capitalize">
          {question.category}
        </span>
      </div>

      {/* Question */}
      <div className="p-5">
        <h4 id="question-label" className="text-lg font-medium text-white mb-4">{questionText}</h4>

        {/* Choice Input */}
        {question.type === 'choice' && (
          <div className="space-y-2" role="radiogroup" aria-labelledby="question-label">
            {options.map((option, idx) => (
              <button
                key={idx}
                ref={idx === 0 ? firstOptionRef : undefined}
                data-option-button
                role="radio"
                aria-checked={selectedChoice === option}
                tabIndex={idx === focusedOption ? 0 : -1}
                onClick={() => setSelectedChoice(option)}
                onKeyDown={(e) => handleKeyDown(e, idx, options.length)}
                disabled={isSubmitting}
                className={cn(
                  'w-full px-4 py-3 rounded-lg text-left transition-all',
                  'border hover:border-indigo-500/50',
                  selectedChoice === option
                    ? 'bg-indigo-500/20 border-indigo-500/50 text-white'
                    : 'bg-white/5 border-white/10 text-white/80 hover:bg-white/10'
                )}
              >
                <div className="flex items-center gap-3">
                  <div
                    className={cn(
                      'w-4 h-4 rounded-full border-2 flex items-center justify-center',
                      selectedChoice === option
                        ? 'border-indigo-400 bg-indigo-500'
                        : 'border-white/30'
                    )}
                  >
                    {selectedChoice === option && (
                      <div className="w-1.5 h-1.5 rounded-full bg-white" />
                    )}
                  </div>
                  <span>{option}</span>
                </div>
              </button>
            ))}
          </div>
        )}

        {/* Multi-Select Input */}
        {question.type === 'multi_select' && (
          <div className="space-y-2" role="group" aria-labelledby="question-label">
            {options.map((option, idx) => {
              const isSelected = selectedMulti.includes(option);
              return (
                <button
                  key={idx}
                  ref={idx === 0 ? firstOptionRef : undefined}
                  data-option-button
                  role="checkbox"
                  aria-checked={isSelected}
                  tabIndex={idx === focusedOption ? 0 : -1}
                  onKeyDown={(e) => handleKeyDown(e, idx, options.length)}
                  onClick={() => {
                    if (isSelected) {
                      setSelectedMulti(selectedMulti.filter(o => o !== option));
                    } else {
                      setSelectedMulti([...selectedMulti, option]);
                    }
                  }}
                  disabled={isSubmitting}
                  className={cn(
                    'w-full px-4 py-3 rounded-lg text-left transition-all',
                    'border hover:border-indigo-500/50',
                    isSelected
                      ? 'bg-indigo-500/20 border-indigo-500/50 text-white'
                      : 'bg-white/5 border-white/10 text-white/80 hover:bg-white/10'
                  )}
                >
                  <div className="flex items-center gap-3">
                    <div
                      className={cn(
                        'w-4 h-4 rounded border-2 flex items-center justify-center',
                        isSelected
                          ? 'border-indigo-400 bg-indigo-500'
                          : 'border-white/30'
                      )}
                    >
                      {isSelected && (
                        <svg className="w-2.5 h-2.5 text-white" fill="currentColor" viewBox="0 0 12 12">
                          <path d="M10.28 2.28L4.5 8.06 1.72 5.28l-.94.94 3.22 3.22.47.47.47-.47 6.25-6.25-.94-.94z" />
                        </svg>
                      )}
                    </div>
                    <span>{option}</span>
                  </div>
                </button>
              );
            })}
          </div>
        )}

        {/* Text Input */}
        {question.type === 'text' && (
          <textarea
            value={textInput}
            onChange={(e) => setTextInput(e.target.value)}
            disabled={isSubmitting}
            placeholder="Type your answer..."
            className={cn(
              'w-full px-4 py-3 rounded-lg bg-white/5 border border-white/10',
              'text-white placeholder-white/30 resize-none',
              'focus:outline-none focus:border-indigo-500/50 focus:ring-1 focus:ring-indigo-500/20',
              'disabled:opacity-50'
            )}
            rows={3}
          />
        )}

        {/* Scale Input */}
        {question.type === 'scale' && (
          <div className="space-y-4">
            <input
              type="range"
              min="1"
              max="5"
              value={scaleValue}
              onChange={(e) => setScaleValue(parseInt(e.target.value))}
              disabled={isSubmitting}
              className="w-full accent-indigo-500"
            />
            <div className="flex justify-between text-sm text-white/50">
              <span>1 - Simple</span>
              <span className="text-indigo-400 font-medium">{scaleValue}</span>
              <span>5 - Expert</span>
            </div>
          </div>
        )}

        {/* Boolean Input */}
        {question.type === 'boolean' && (
          <div className="flex gap-4">
            <button
              onClick={() => setBoolValue(true)}
              disabled={isSubmitting}
              className={cn(
                'flex-1 px-4 py-3 rounded-lg transition-all',
                'border hover:border-green-500/50',
                boolValue === true
                  ? 'bg-green-500/20 border-green-500/50 text-green-300'
                  : 'bg-white/5 border-white/10 text-white/80 hover:bg-white/10'
              )}
            >
              Yes
            </button>
            <button
              onClick={() => setBoolValue(false)}
              disabled={isSubmitting}
              className={cn(
                'flex-1 px-4 py-3 rounded-lg transition-all',
                'border hover:border-red-500/50',
                boolValue === false
                  ? 'bg-red-500/20 border-red-500/50 text-red-300'
                  : 'bg-white/5 border-white/10 text-white/80 hover:bg-white/10'
              )}
            >
              No
            </button>
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="px-5 py-3 bg-white/5 border-t border-white/10 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <button
            onClick={onSkip}
            disabled={isSubmitting}
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm text-white/50 hover:text-white/80 hover:bg-white/5 transition-colors"
            aria-label="Skip this question"
          >
            <SkipForward className="w-4 h-4" />
            Skip
          </button>
          {onSkipAll && (
            <button
              onClick={onSkipAll}
              disabled={isSubmitting}
              className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm text-white/30 hover:text-white/60 hover:bg-white/5 transition-colors"
              aria-label="Skip all remaining questions"
            >
              Skip All
            </button>
          )}
        </div>
        <button
          onClick={handleSubmit}
          disabled={!isValid() || isSubmitting}
          className={cn(
            'flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium',
            'transition-all duration-200',
            isValid() && !isSubmitting
              ? 'bg-indigo-500 hover:bg-indigo-400 text-white'
              : 'bg-white/10 text-white/30 cursor-not-allowed'
          )}
        >
          {isSubmitting ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              Submitting...
            </>
          ) : (
            <>
              <Send className="w-4 h-4" />
              Continue
            </>
          )}
        </button>
      </div>

      {/* Swipe indicator */}
      {enableSwipeGestures && isSwiping && swipeX > 20 && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: swipeX > 50 ? 1 : 0.5 }}
          className="absolute inset-y-0 left-0 w-1 bg-indigo-500 rounded-l-xl"
        />
      )}
    </motion.div>
  );
}
