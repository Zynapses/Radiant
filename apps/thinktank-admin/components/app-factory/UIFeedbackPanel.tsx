'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  ThumbsUp,
  ThumbsDown,
  MessageSquare,
  Wand2,
  Sparkles,
  Send,
  RefreshCw,
  CheckCircle,
  AlertCircle,
  Lightbulb,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface UIFeedbackPanelProps {
  appId: string;
  componentId?: string;
  originalPrompt: string;
  generatedOutput: unknown;
  onImprove?: () => void;
  className?: string;
}

type FeedbackType =
  | 'helpful'
  | 'not_helpful'
  | 'wrong_type'
  | 'missing_data'
  | 'incorrect_data'
  | 'layout_issue'
  | 'functionality'
  | 'improvement'
  | 'feature_request';

const FEEDBACK_TYPES: { value: FeedbackType; label: string; icon: React.ReactNode }[] = [
  { value: 'helpful', label: 'This was helpful', icon: <ThumbsUp className="h-4 w-4" /> },
  { value: 'not_helpful', label: 'Not helpful', icon: <ThumbsDown className="h-4 w-4" /> },
  { value: 'wrong_type', label: 'Wrong component type', icon: <AlertCircle className="h-4 w-4" /> },
  { value: 'missing_data', label: 'Missing data', icon: <AlertCircle className="h-4 w-4" /> },
  { value: 'incorrect_data', label: 'Incorrect data', icon: <AlertCircle className="h-4 w-4" /> },
  { value: 'layout_issue', label: 'Layout/design issue', icon: <AlertCircle className="h-4 w-4" /> },
  { value: 'functionality', label: 'Something broken', icon: <AlertCircle className="h-4 w-4" /> },
  { value: 'improvement', label: 'Suggestion', icon: <Lightbulb className="h-4 w-4" /> },
  { value: 'feature_request', label: 'Feature request', icon: <Sparkles className="h-4 w-4" /> },
];

export function UIFeedbackPanel({
  appId,
  componentId,
  originalPrompt,
  generatedOutput,
  onImprove,
  className,
}: UIFeedbackPanelProps) {
  const [rating, setRating] = useState<'thumbs_up' | 'thumbs_down' | null>(null);
  const [showDetailedFeedback, setShowDetailedFeedback] = useState(false);
  const [feedbackType, setFeedbackType] = useState<FeedbackType>('helpful');
  const [suggestion, setSuggestion] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const submitFeedback = async (data: {
    rating: string;
    feedbackType: string;
    suggestion?: string;
  }) => {
    setIsSubmitting(true);
    try {
      await fetch('/api/thinktank/ui-feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          appId,
          componentId,
          rating: data.rating,
          feedbackType: data.feedbackType,
          originalPrompt,
          generatedOutput,
          improvementSuggestion: data.suggestion,
        }),
      });
      setSubmitted(true);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleQuickFeedback = (vote: 'thumbs_up' | 'thumbs_down') => {
    setRating(vote);
    submitFeedback({
      rating: vote,
      feedbackType: vote === 'thumbs_up' ? 'helpful' : 'not_helpful',
    });
  };

  const handleDetailedSubmit = () => {
    submitFeedback({
      rating: rating || (feedbackType === 'helpful' ? 'thumbs_up' : 'thumbs_down'),
      feedbackType,
      suggestion,
    });
    setShowDetailedFeedback(false);
  };

  if (submitted) {
    return (
      <div className={cn('flex items-center gap-2 text-sm text-green-600', className)}>
        <CheckCircle className="h-4 w-4" />
        <span>Thanks for your feedback!</span>
      </div>
    );
  }

  return (
    <div className={cn('flex items-center gap-2', className)}>
      <div className="flex items-center gap-1 border rounded-lg p-1">
        <Button
          variant="ghost"
          size="sm"
          className={cn(
            'h-8 w-8 p-0',
            rating === 'thumbs_up' && 'bg-green-100 text-green-600'
          )}
          onClick={() => handleQuickFeedback('thumbs_up')}
          disabled={isSubmitting}
        >
          <ThumbsUp className="h-4 w-4" />
        </Button>
        <Button
          variant="ghost"
          size="sm"
          className={cn(
            'h-8 w-8 p-0',
            rating === 'thumbs_down' && 'bg-red-100 text-red-600'
          )}
          onClick={() => handleQuickFeedback('thumbs_down')}
          disabled={isSubmitting}
        >
          <ThumbsDown className="h-4 w-4" />
        </Button>
      </div>

      <Popover open={showDetailedFeedback} onOpenChange={setShowDetailedFeedback}>
        <PopoverTrigger asChild>
          <Button variant="ghost" size="sm" className="h-8">
            <MessageSquare className="h-4 w-4 mr-1" />
            Feedback
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-80" align="end">
          <div className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">What type of feedback?</label>
              <Select value={feedbackType} onValueChange={(v) => setFeedbackType(v as FeedbackType)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {FEEDBACK_TYPES.map((type) => (
                    <SelectItem key={type.value} value={type.value}>
                      <div className="flex items-center gap-2">
                        {type.icon}
                        {type.label}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Your suggestion (optional)</label>
              <Textarea
                placeholder="How could this be improved?"
                value={suggestion}
                onChange={(e) => setSuggestion(e.target.value)}
                rows={3}
              />
            </div>

            <Button
              className="w-full"
              onClick={handleDetailedSubmit}
              disabled={isSubmitting}
            >
              {isSubmitting ? (
                <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Send className="h-4 w-4 mr-2" />
              )}
              Submit Feedback
            </Button>
          </div>
        </PopoverContent>
      </Popover>

      {onImprove && (
        <Button variant="outline" size="sm" className="h-8" onClick={onImprove}>
          <Wand2 className="h-4 w-4 mr-1" />
          Improve
        </Button>
      )}
    </div>
  );
}

interface UIImprovementDialogProps {
  appId: string;
  currentSnapshot: unknown;
  onApplyChanges: (newSnapshot: unknown) => void;
  trigger?: React.ReactNode;
}

export function UIImprovementDialog({
  appId,
  currentSnapshot,
  onApplyChanges,
  trigger,
}: UIImprovementDialogProps) {
  const [open, setOpen] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [userRequest, setUserRequest] = useState('');
  const [iterations, setIterations] = useState<{
    request: string;
    response: { understood: string; explanation: string };
    applied: boolean;
  }[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);

  const startSession = async () => {
    const response = await fetch('/api/thinktank/ui-improvement/start', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ appId, currentSnapshot }),
    });
    const data = await response.json();
    setSessionId(data.sessionId);
  };

  const requestImprovement = async (request: string) => {
    setIsProcessing(true);
    try {
      const response = await fetch('/api/thinktank/ui-improvement/request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId, userRequest: request, currentSnapshot }),
      });
      const data = await response.json();
      setIterations((prev) => [
        ...prev,
        {
          request: userRequest,
          response: data.agiResponse,
          applied: false,
        },
      ]);
      setUserRequest('');
      if (data.newSnapshot) {
        onApplyChanges(data.newSnapshot);
      }
    } finally {
      setIsProcessing(false);
    }
  };

  const handleOpen = () => {
    setOpen(true);
    if (!sessionId) {
      startSession();
    }
  };

  const handleSubmit = () => {
    if (!userRequest.trim()) return;
    requestImprovement(userRequest);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild onClick={handleOpen}>
        {trigger || (
          <Button variant="outline" size="sm">
            <Wand2 className="h-4 w-4 mr-2" />
            Improve UI
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-purple-500" />
            Improve This UI
          </DialogTitle>
          <DialogDescription>
            Tell the AGI what you&apos;d like to change and watch it improve before your eyes.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 mt-4">
          {iterations.length > 0 && (
            <div className="space-y-3">
              {iterations.map((iter, index) => (
                <div key={index} className="border rounded-lg p-3 space-y-2">
                  <div className="flex items-start gap-2">
                    <Badge variant="outline">You</Badge>
                    <p className="text-sm">{iter.request}</p>
                  </div>
                  <div className="flex items-start gap-2 pl-4 border-l-2 border-purple-200">
                    <Badge className="bg-purple-100 text-purple-700">AGI</Badge>
                    <div className="text-sm space-y-1">
                      <p className="font-medium">{iter.response.understood}</p>
                      <p className="text-muted-foreground">{iter.response.explanation}</p>
                    </div>
                  </div>
                  {iter.applied && (
                    <div className="flex items-center gap-1 text-green-600 text-sm">
                      <CheckCircle className="h-4 w-4" />
                      Changes applied
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          <div className="space-y-2">
            <label className="text-sm font-medium">What would you like to improve?</label>
            <Textarea
              placeholder="e.g., 'Add a column for tax rate' or 'Make the chart show percentages'"
              value={userRequest}
              onChange={(e) => setUserRequest(e.target.value)}
              rows={3}
              disabled={isProcessing}
            />
            <div className="flex gap-2">
              <Button
                onClick={handleSubmit}
                disabled={!userRequest.trim() || isProcessing}
                className="flex-1"
              >
                {isProcessing ? (
                  <>
                    <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                    AGI is thinking...
                  </>
                ) : (
                  <>
                    <Wand2 className="h-4 w-4 mr-2" />
                    Improve
                  </>
                )}
              </Button>
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-xs text-muted-foreground">Quick improvements:</label>
            <div className="flex flex-wrap gap-2">
              {[
                'Make it simpler',
                'Add more detail',
                'Fix the calculation',
                'Change the layout',
                'Add a new field',
              ].map((suggestion) => (
                <Button
                  key={suggestion}
                  variant="outline"
                  size="sm"
                  className="text-xs"
                  onClick={() => setUserRequest(suggestion)}
                  disabled={isProcessing}
                >
                  {suggestion}
                </Button>
              ))}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

interface FeedbackStatsBadgeProps {
  appId: string;
  className?: string;
}

export function FeedbackStatsBadge({ className }: FeedbackStatsBadgeProps) {
  const stats = {
    positive: 12,
    negative: 2,
    total: 14,
  };

  const positiveRate = stats.total > 0 ? (stats.positive / stats.total) * 100 : 0;

  return (
    <div className={cn('flex items-center gap-2 text-sm', className)}>
      <div className="flex items-center gap-1">
        <ThumbsUp className="h-3 w-3 text-green-500" />
        <span>{stats.positive}</span>
      </div>
      <div className="flex items-center gap-1">
        <ThumbsDown className="h-3 w-3 text-red-500" />
        <span>{stats.negative}</span>
      </div>
      <Badge variant="outline" className="text-xs">
        {positiveRate.toFixed(0)}% positive
      </Badge>
    </div>
  );
}
