'use client';

/**
 * FeedbackCapture - Component for capturing user feedback on AXIOM sessions
 * 
 * Provides UI for users to rate and provide feedback on:
 * - Domain classification accuracy
 * - Question relevance
 * - Prompt quality
 * - Model selection
 * 
 * @version 1.0.0
 * @since RADIANT v6.0.0
 */

import { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ThumbsUp,
  ThumbsDown,
  MessageSquare,
  Star,
  Send,
  ChevronDown,
  ChevronUp,
  Sparkles,
  Target,
  HelpCircle,
  Zap,
} from 'lucide-react';

export type FeedbackType = 
  | 'domain_accuracy'
  | 'question_relevance'
  | 'prompt_quality'
  | 'model_selection'
  | 'overall';

export type FeedbackSignal = 'positive' | 'negative' | 'neutral';

interface FeedbackData {
  type: FeedbackType;
  signal: FeedbackSignal;
  rating?: number;
  comment?: string;
  targetId?: string;
}

interface FeedbackCaptureProps {
  sessionId: string;
  onSubmit: (feedback: FeedbackData) => Promise<void>;
  compact?: boolean;
  showDetailedFeedback?: boolean;
  className?: string;
}

interface QuickFeedbackProps {
  label: string;
  icon: React.ReactNode;
  type: FeedbackType;
  onFeedback: (type: FeedbackType, signal: FeedbackSignal) => void;
  disabled?: boolean;
}

function QuickFeedback({ label, icon, type, onFeedback, disabled }: QuickFeedbackProps) {
  const [selected, setSelected] = useState<FeedbackSignal | null>(null);

  const handleClick = (signal: FeedbackSignal) => {
    if (disabled) return;
    setSelected(signal);
    onFeedback(type, signal);
  };

  return (
    <div className="flex items-center justify-between py-2 border-b border-border/50 last:border-0">
      <div className="flex items-center gap-2 text-sm">
        {icon}
        <span>{label}</span>
      </div>
      <div className="flex items-center gap-1">
        <button
          onClick={() => handleClick('positive')}
          disabled={disabled}
          className={`p-1.5 rounded-md transition-colors ${
            selected === 'positive'
              ? 'bg-green-500/20 text-green-500'
              : 'hover:bg-muted text-muted-foreground hover:text-foreground'
          } ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
          aria-label={`${label} was helpful`}
        >
          <ThumbsUp className="h-4 w-4" />
        </button>
        <button
          onClick={() => handleClick('negative')}
          disabled={disabled}
          className={`p-1.5 rounded-md transition-colors ${
            selected === 'negative'
              ? 'bg-red-500/20 text-red-500'
              : 'hover:bg-muted text-muted-foreground hover:text-foreground'
          } ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
          aria-label={`${label} needs improvement`}
        >
          <ThumbsDown className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}

export function FeedbackCapture({
  sessionId,
  onSubmit,
  compact = false,
  showDetailedFeedback = true,
  className = '',
}: FeedbackCaptureProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [overallRating, setOverallRating] = useState<number>(0);
  const [comment, setComment] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [quickFeedback, setQuickFeedback] = useState<Map<FeedbackType, FeedbackSignal>>(new Map());

  const handleQuickFeedback = useCallback(async (type: FeedbackType, signal: FeedbackSignal) => {
    setQuickFeedback(prev => new Map(prev).set(type, signal));
    
    try {
      await onSubmit({
        type,
        signal,
        targetId: sessionId,
      });
    } catch (error) {
      console.error('Failed to submit feedback:', error);
    }
  }, [sessionId, onSubmit]);

  const handleDetailedSubmit = useCallback(async () => {
    if (isSubmitting || (!overallRating && !comment)) return;

    setIsSubmitting(true);
    try {
      await onSubmit({
        type: 'overall',
        signal: overallRating >= 4 ? 'positive' : overallRating >= 2 ? 'neutral' : 'negative',
        rating: overallRating,
        comment: comment || undefined,
        targetId: sessionId,
      });
      setSubmitted(true);
    } catch (error) {
      console.error('Failed to submit detailed feedback:', error);
    } finally {
      setIsSubmitting(false);
    }
  }, [sessionId, overallRating, comment, isSubmitting, onSubmit]);

  if (submitted) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className={`bg-green-500/10 border border-green-500/20 rounded-lg p-4 text-center ${className}`}
      >
        <Sparkles className="h-6 w-6 text-green-500 mx-auto mb-2" />
        <p className="text-sm text-green-600 dark:text-green-400">
          Thank you for your feedback!
        </p>
      </motion.div>
    );
  }

  if (compact) {
    return (
      <div className={`flex items-center gap-2 ${className}`}>
        <span className="text-xs text-muted-foreground">Was this helpful?</span>
        <button
          onClick={() => handleQuickFeedback('overall', 'positive')}
          className={`p-1 rounded transition-colors ${
            quickFeedback.get('overall') === 'positive'
              ? 'bg-green-500/20 text-green-500'
              : 'hover:bg-muted text-muted-foreground'
          }`}
        >
          <ThumbsUp className="h-3.5 w-3.5" />
        </button>
        <button
          onClick={() => handleQuickFeedback('overall', 'negative')}
          className={`p-1 rounded transition-colors ${
            quickFeedback.get('overall') === 'negative'
              ? 'bg-red-500/20 text-red-500'
              : 'hover:bg-muted text-muted-foreground'
          }`}
        >
          <ThumbsDown className="h-3.5 w-3.5" />
        </button>
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className={`bg-card border border-border rounded-lg overflow-hidden ${className}`}
    >
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center justify-between p-3 hover:bg-muted/50 transition-colors"
      >
        <div className="flex items-center gap-2">
          <MessageSquare className="h-4 w-4 text-purple-500" />
          <span className="text-sm font-medium">Rate this AXIOM session</span>
        </div>
        {isExpanded ? (
          <ChevronUp className="h-4 w-4 text-muted-foreground" />
        ) : (
          <ChevronDown className="h-4 w-4 text-muted-foreground" />
        )}
      </button>

      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="p-4 pt-0 space-y-4">
              <div className="space-y-1">
                <QuickFeedback
                  label="Domain Classification"
                  icon={<Target className="h-4 w-4 text-blue-500" />}
                  type="domain_accuracy"
                  onFeedback={handleQuickFeedback}
                />
                <QuickFeedback
                  label="Questions Relevance"
                  icon={<HelpCircle className="h-4 w-4 text-amber-500" />}
                  type="question_relevance"
                  onFeedback={handleQuickFeedback}
                />
                <QuickFeedback
                  label="Prompt Quality"
                  icon={<Sparkles className="h-4 w-4 text-purple-500" />}
                  type="prompt_quality"
                  onFeedback={handleQuickFeedback}
                />
                <QuickFeedback
                  label="Model Selection"
                  icon={<Zap className="h-4 w-4 text-green-500" />}
                  type="model_selection"
                  onFeedback={handleQuickFeedback}
                />
              </div>

              {showDetailedFeedback && (
                <>
                  <div className="pt-2 border-t border-border">
                    <label className="text-sm text-muted-foreground block mb-2">
                      Overall Rating
                    </label>
                    <div className="flex items-center gap-1">
                      {[1, 2, 3, 4, 5].map((star) => (
                        <button
                          key={star}
                          onClick={() => setOverallRating(star)}
                          className="p-0.5 transition-transform hover:scale-110"
                        >
                          <Star
                            className={`h-6 w-6 transition-colors ${
                              star <= overallRating
                                ? 'fill-amber-400 text-amber-400'
                                : 'text-muted-foreground/30'
                            }`}
                          />
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="text-sm text-muted-foreground block mb-2">
                      Additional Comments (optional)
                    </label>
                    <textarea
                      value={comment}
                      onChange={(e) => setComment(e.target.value)}
                      placeholder="Tell us how we can improve..."
                      className="w-full h-20 px-3 py-2 text-sm bg-background border border-input rounded-md resize-none focus:outline-none focus:ring-2 focus:ring-ring"
                    />
                  </div>

                  <button
                    onClick={handleDetailedSubmit}
                    disabled={isSubmitting || (!overallRating && !comment)}
                    className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    {isSubmitting ? (
                      <>
                        <motion.div
                          animate={{ rotate: 360 }}
                          transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                        >
                          <Send className="h-4 w-4" />
                        </motion.div>
                        Submitting...
                      </>
                    ) : (
                      <>
                        <Send className="h-4 w-4" />
                        Submit Feedback
                      </>
                    )}
                  </button>
                </>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

export default FeedbackCapture;
