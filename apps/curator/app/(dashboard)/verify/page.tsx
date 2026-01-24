'use client';

import { useState, useEffect } from 'react';
import {
  CheckCircle2,
  XCircle,
  AlertTriangle,
  ChevronRight,
  ThumbsUp,
  ThumbsDown,
  MessageSquare,
  Brain,
  Loader2,
  HelpCircle,
  GitBranch,
  FileText,
  Edit3,
  ExternalLink,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { GlassCard } from '@/components/ui/glass-card';
import { toast } from 'sonner';

type QuizCardType = 'fact_check' | 'logic_check' | 'ambiguity';

interface VerificationItem {
  id: string;
  statement: string;
  source: string;
  sourcePage?: number;
  confidence: number;
  domain: string;
  status: 'pending' | 'verified' | 'rejected' | 'needs_review';
  aiReasoning?: string;
  cardType: QuizCardType;
  optionA?: string;
  optionB?: string;
  inferredRelationship?: string;
}

const defaultVerifications: VerificationItem[] = [];

function getConfidenceColor(confidence: number): 'high' | 'medium' | 'low' {
  if (confidence >= 90) return 'high';
  if (confidence >= 70) return 'medium';
  return 'low';
}

function getCardTypeConfig(cardType: QuizCardType) {
  switch (cardType) {
    case 'fact_check':
      return { icon: CheckCircle2, label: 'Fact Check', color: 'text-curator-emerald', bgColor: 'bg-curator-emerald/10' };
    case 'logic_check':
      return { icon: GitBranch, label: 'Logic Check', color: 'text-curator-sapphire', bgColor: 'bg-curator-sapphire/10' };
    case 'ambiguity':
      return { icon: HelpCircle, label: 'Ambiguity', color: 'text-curator-gold', bgColor: 'bg-curator-gold/10' };
    default:
      return { icon: CheckCircle2, label: 'Fact Check', color: 'text-curator-emerald', bgColor: 'bg-curator-emerald/10' };
  }
}

export default function VerifyPage() {
  const [items, setItems] = useState<VerificationItem[]>(defaultVerifications);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [showCorrectDialog, setShowCorrectDialog] = useState(false);
  const [correction, setCorrection] = useState('');
  const [correctionReason, setCorrectionReason] = useState('');

  useEffect(() => {
    async function fetchVerifications() {
      try {
        const res = await fetch('/api/curator/verification');
        if (res.ok) {
          const data = await res.json();
          // Add default cardType if not present
          const itemsWithType = (data.items || []).map((item: any) => ({
            ...item,
            cardType: item.cardType || 'fact_check',
          }));
          setItems(itemsWithType);
        }
      } catch (error) {
        console.error('Failed to fetch verifications:', error);
      } finally {
        setLoading(false);
      }
    }
    fetchVerifications();
  }, []);
  const [selectedItem, setSelectedItem] = useState<VerificationItem | null>(null);
  const [filter, setFilter] = useState<'all' | 'pending' | 'verified' | 'rejected'>('all');
  const [cardTypeFilter, setCardTypeFilter] = useState<QuizCardType | 'all'>('all');

  const handleVerify = async (id: string) => {
    setActionLoading(id);
    try {
      const res = await fetch(`/api/curator/verification/${id}/approve`, {
        method: 'POST',
      });
      if (res.ok) {
        setItems((prev) =>
          prev.map((item) =>
            item.id === id ? { ...item, status: 'verified' } : item
          )
        );
        toast.success('Fact Verified', {
          description: 'The knowledge has been verified and will be deployed.',
        });
        setSelectedItem(null);
      } else {
        throw new Error('Failed to verify');
      }
    } catch (error) {
      toast.error('Error', {
        description: 'Failed to verify the fact. Please try again.',
      });
    } finally {
      setActionLoading(null);
    }
  };

  const handleReject = async (id: string) => {
    setActionLoading(id);
    try {
      const res = await fetch(`/api/curator/verification/${id}/reject`, {
        method: 'POST',
      });
      if (res.ok) {
        setItems((prev) =>
          prev.map((item) =>
            item.id === id ? { ...item, status: 'rejected' } : item
          )
        );
        toast.success('Fact Rejected', {
          description: 'The knowledge has been rejected and will not be deployed.',
        });
        setSelectedItem(null);
      } else {
        throw new Error('Failed to reject');
      }
    } catch (error) {
      toast.error('Error', {
        description: 'Failed to reject the fact. Please try again.',
      });
    } finally {
      setActionLoading(null);
    }
  };

  const handleCorrect = async (id: string) => {
    if (!correction || !correctionReason) {
      toast.error('Error', { description: 'Please provide both correction and reason.' });
      return;
    }
    setActionLoading(id);
    try {
      const res = await fetch(`/api/curator/verification/${id}/correct`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ correction, reason: correctionReason }),
      });
      if (res.ok) {
        setItems((prev) =>
          prev.map((item) =>
            item.id === id ? { ...item, status: 'verified', statement: correction } : item
          )
        );
        toast.success('Fact Corrected', {
          description: 'Your correction has been saved and a Golden Rule created.',
        });
        setSelectedItem(null);
        setShowCorrectDialog(false);
        setCorrection('');
        setCorrectionReason('');
      } else {
        throw new Error('Failed to correct');
      }
    } catch (error) {
      toast.error('Error', {
        description: 'Failed to save correction. Please try again.',
      });
    } finally {
      setActionLoading(null);
    }
  };

  const handleAmbiguityChoice = async (id: string, choice: 'a' | 'b') => {
    setActionLoading(id);
    try {
      const res = await fetch(`/api/curator/verification/${id}/resolve-ambiguity`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ choice }),
      });
      if (res.ok) {
        setItems((prev) =>
          prev.map((item) =>
            item.id === id ? { ...item, status: 'verified' } : item
          )
        );
        toast.success('Ambiguity Resolved', {
          description: `Option ${choice.toUpperCase()} has been selected as correct.`,
        });
        setSelectedItem(null);
      } else {
        throw new Error('Failed to resolve');
      }
    } catch (error) {
      toast.error('Error', {
        description: 'Failed to resolve ambiguity. Please try again.',
      });
    } finally {
      setActionLoading(null);
    }
  };

  const filteredItems = items.filter((item) => {
    if (filter !== 'all' && item.status !== filter) return false;
    if (cardTypeFilter !== 'all' && item.cardType !== cardTypeFilter) return false;
    return true;
  });

  const pendingCount = items.filter((i) => i.status === 'pending' || i.status === 'needs_review').length;

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold">Verify Knowledge</h1>
          <p className="text-muted-foreground mt-1">
            Review AI understanding and confirm accuracy. The "Entrance Exam" ensures quality.
          </p>
        </div>
        <div className="flex items-center gap-2 bg-curator-gold/10 text-curator-gold px-4 py-2 rounded-lg">
          <AlertTriangle className="h-5 w-5" />
          <span className="font-medium">{pendingCount} items awaiting review</span>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-4">
        <div className="flex gap-2">
          {(['all', 'pending', 'verified', 'rejected'] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={cn(
                'px-4 py-2 rounded-lg text-sm font-medium transition-colors',
                filter === f
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-muted hover:bg-accent'
              )}
            >
              {f.charAt(0).toUpperCase() + f.slice(1)}
            </button>
          ))}
        </div>
        <div className="h-6 w-px bg-border" />
        <div className="flex gap-2">
          {(['all', 'fact_check', 'logic_check', 'ambiguity'] as const).map((ct) => {
            const config = ct === 'all' ? null : getCardTypeConfig(ct);
            return (
              <button
                key={ct}
                onClick={() => setCardTypeFilter(ct)}
                className={cn(
                  'px-3 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2',
                  cardTypeFilter === ct
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-muted hover:bg-accent'
                )}
              >
                {config && <config.icon className="h-4 w-4" />}
                {ct === 'all' ? 'All Types' : config?.label}
              </button>
            );
          })}
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Items List */}
        <div className="space-y-3">
          {filteredItems.map((item) => (
            <button
              key={item.id}
              onClick={() => setSelectedItem(item)}
              className={cn(
                'w-full text-left quiz-card',
                item.status === 'pending' && 'awaiting',
                item.status === 'verified' && 'verified',
                item.status === 'rejected' && 'rejected',
                item.status === 'needs_review' && 'awaiting',
                selectedItem?.id === item.id && 'ring-2 ring-primary'
              )}
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1">
                  <p className="font-medium line-clamp-2">{item.statement}</p>
                  <p className="text-xs text-muted-foreground mt-2">{item.domain}</p>
                </div>
                <div className="flex flex-col items-end gap-2">
                  <div className="confidence-meter w-16">
                    <div
                      className={cn('confidence-fill', getConfidenceColor(item.confidence))}
                      style={{ width: `${item.confidence}%` }}
                    />
                  </div>
                  <span className="text-xs text-muted-foreground">{item.confidence}%</span>
                </div>
              </div>
              <div className="flex items-center justify-between mt-3">
                <span className="text-xs text-muted-foreground truncate max-w-[200px]">
                  {item.source}
                </span>
                <ChevronRight className="h-4 w-4 text-muted-foreground" />
              </div>
            </button>
          ))}
        </div>

        {/* Detail Panel */}
        <div className="lg:sticky lg:top-20">
          {selectedItem ? (
            <GlassCard variant="elevated" padding="lg">
              {/* Card Type Badge */}
              {(() => {
                const cardConfig = getCardTypeConfig(selectedItem.cardType);
                return (
                  <div className={cn('flex items-center gap-2 mb-4 px-3 py-1.5 rounded-full w-fit', cardConfig.bgColor)}>
                    <cardConfig.icon className={cn('h-4 w-4', cardConfig.color)} />
                    <span className={cn('text-sm font-medium', cardConfig.color)}>{cardConfig.label}</span>
                  </div>
                );
              })()}

              <div className="flex items-center gap-2 mb-4">
                <Brain className="h-5 w-5 text-curator-gold" />
                <h3 className="font-semibold">AI Understanding</h3>
              </div>

              {/* Card Type Specific Content */}
              {selectedItem.cardType === 'fact_check' && (
                <div className="bg-muted/50 rounded-lg p-4 mb-6">
                  <p className="text-sm text-muted-foreground mb-2">I extracted:</p>
                  <p className="text-lg font-medium">"{selectedItem.statement}"</p>
                  <p className="text-sm text-muted-foreground mt-2">Is this correct?</p>
                </div>
              )}

              {selectedItem.cardType === 'logic_check' && (
                <div className="bg-muted/50 rounded-lg p-4 mb-6">
                  <p className="text-sm text-muted-foreground mb-2">I inferred:</p>
                  <p className="text-lg font-medium">"{selectedItem.inferredRelationship || selectedItem.statement}"</p>
                  <p className="text-sm text-muted-foreground mt-2">Is this relationship correct?</p>
                </div>
              )}

              {selectedItem.cardType === 'ambiguity' && (
                <div className="space-y-3 mb-6">
                  <p className="text-sm text-muted-foreground">I found conflicting information:</p>
                  <div className="p-3 border border-curator-gold/30 bg-curator-gold/5 rounded-lg">
                    <p className="text-sm font-medium text-curator-gold">Option A:</p>
                    <p className="text-sm mt-1">{selectedItem.optionA || selectedItem.statement}</p>
                  </div>
                  <div className="p-3 border border-curator-sapphire/30 bg-curator-sapphire/5 rounded-lg">
                    <p className="text-sm font-medium text-curator-sapphire">Option B:</p>
                    <p className="text-sm mt-1">{selectedItem.optionB || 'Alternative value from different source'}</p>
                  </div>
                  <p className="text-sm text-muted-foreground">Which is correct?</p>
                </div>
              )}

              <div className="space-y-4 mb-6">
                <div>
                  <label className="text-xs text-muted-foreground uppercase tracking-wide">Source</label>
                  <div className="flex items-center gap-2 mt-1">
                    <FileText className="h-4 w-4 text-muted-foreground" />
                    <p className="text-sm flex-1">{selectedItem.source}</p>
                    {selectedItem.sourcePage && (
                      <span className="text-xs text-muted-foreground">Page {selectedItem.sourcePage}</span>
                    )}
                    <button className="p-1 hover:bg-accent rounded" title="View Source">
                      <ExternalLink className="h-4 w-4 text-muted-foreground" />
                    </button>
                  </div>
                </div>
                <div>
                  <label className="text-xs text-muted-foreground uppercase tracking-wide">Domain</label>
                  <p className="text-sm mt-1">{selectedItem.domain}</p>
                </div>
                <div>
                  <label className="text-xs text-muted-foreground uppercase tracking-wide">AI Reasoning</label>
                  <p className="text-sm mt-1 text-muted-foreground">{selectedItem.aiReasoning || 'No reasoning provided'}</p>
                </div>
                <div>
                  <label className="text-xs text-muted-foreground uppercase tracking-wide">Confidence</label>
                  <div className="flex items-center gap-3 mt-1">
                    <div className="confidence-meter flex-1">
                      <div
                        className={cn('confidence-fill', getConfidenceColor(selectedItem.confidence))}
                        style={{ width: `${selectedItem.confidence}%` }}
                      />
                    </div>
                    <span className="text-sm font-medium">{selectedItem.confidence}%</span>
                  </div>
                </div>
              </div>

              {selectedItem.status === 'pending' || selectedItem.status === 'needs_review' ? (
                <>
                  {/* Ambiguity has special UI */}
                  {selectedItem.cardType === 'ambiguity' ? (
                    <div className="flex gap-3">
                      <button
                        onClick={() => handleAmbiguityChoice(selectedItem.id, 'a')}
                        disabled={actionLoading === selectedItem.id}
                        className="flex-1 flex items-center justify-center gap-2 bg-curator-gold text-white py-3 rounded-lg font-medium hover:bg-curator-gold/90 transition-colors disabled:opacity-50"
                      >
                        {actionLoading === selectedItem.id ? <Loader2 className="h-5 w-5 animate-spin" /> : 'Option A'}
                      </button>
                      <button
                        onClick={() => handleAmbiguityChoice(selectedItem.id, 'b')}
                        disabled={actionLoading === selectedItem.id}
                        className="flex-1 flex items-center justify-center gap-2 bg-curator-sapphire text-white py-3 rounded-lg font-medium hover:bg-curator-sapphire/90 transition-colors disabled:opacity-50"
                      >
                        {actionLoading === selectedItem.id ? <Loader2 className="h-5 w-5 animate-spin" /> : 'Option B'}
                      </button>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      <div className="flex gap-3">
                        <button
                          onClick={() => handleVerify(selectedItem.id)}
                          disabled={actionLoading === selectedItem.id}
                          className="flex-1 flex items-center justify-center gap-2 bg-curator-emerald text-white py-3 rounded-lg font-medium hover:bg-curator-emerald/90 transition-colors disabled:opacity-50"
                        >
                          {actionLoading === selectedItem.id ? (
                            <Loader2 className="h-5 w-5 animate-spin" />
                          ) : (
                            <ThumbsUp className="h-5 w-5" />
                          )}
                          Yes, Correct
                        </button>
                        <button
                          onClick={() => setShowCorrectDialog(true)}
                          disabled={actionLoading === selectedItem.id}
                          className="flex-1 flex items-center justify-center gap-2 bg-curator-gold text-white py-3 rounded-lg font-medium hover:bg-curator-gold/90 transition-colors disabled:opacity-50"
                        >
                          <Edit3 className="h-5 w-5" />
                          Correct It
                        </button>
                      </div>
                      <button
                        onClick={() => handleReject(selectedItem.id)}
                        disabled={actionLoading === selectedItem.id}
                        className="w-full flex items-center justify-center gap-2 border border-destructive text-destructive py-2 rounded-lg font-medium hover:bg-destructive/10 transition-colors disabled:opacity-50"
                      >
                        {actionLoading === selectedItem.id ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <ThumbsDown className="h-4 w-4" />
                        )}
                        Reject Entirely
                      </button>
                    </div>
                  )}
                </>
              ) : (
                <div className="flex items-center justify-center gap-2 py-3 rounded-lg bg-muted">
                  {selectedItem.status === 'verified' ? (
                    <>
                      <CheckCircle2 className="h-5 w-5 text-curator-emerald" />
                      <span className="font-medium text-curator-emerald">Verified</span>
                    </>
                  ) : (
                    <>
                      <XCircle className="h-5 w-5 text-destructive" />
                      <span className="font-medium text-destructive">Rejected</span>
                    </>
                  )}
                </div>
              )}

              <button className="w-full mt-3 flex items-center justify-center gap-2 py-2 text-sm text-muted-foreground hover:text-foreground">
                <MessageSquare className="h-4 w-4" />
                Add Comment
              </button>
            </GlassCard>
          ) : (
            <GlassCard variant="default" padding="lg" className="flex flex-col items-center justify-center text-center h-[400px]">
              <Brain className="h-12 w-12 text-muted-foreground/50 mb-4" />
              <p className="text-muted-foreground">
                Select an item to review AI understanding
              </p>
            </GlassCard>
          )}
        </div>
      </div>

      {/* Correction Dialog */}
      {showCorrectDialog && selectedItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-card rounded-xl border shadow-lg p-6 max-w-lg w-full mx-4">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold">Correct This Fact</h2>
              <button onClick={() => setShowCorrectDialog(false)} className="p-1 hover:bg-accent rounded">
                <XCircle className="h-5 w-5" />
              </button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium">Original (AI extracted)</label>
                <p className="mt-1 p-3 bg-destructive/10 border border-destructive/20 rounded-md text-sm line-through">
                  {selectedItem.statement}
                </p>
              </div>
              <div>
                <label className="text-sm font-medium">Corrected Value</label>
                <input
                  type="text"
                  value={correction}
                  onChange={(e) => setCorrection(e.target.value)}
                  className="w-full mt-1 px-3 py-2 border rounded-md bg-background"
                  placeholder="Enter the correct value..."
                />
              </div>
              <div>
                <label className="text-sm font-medium">Reason for Correction</label>
                <textarea
                  value={correctionReason}
                  onChange={(e) => setCorrectionReason(e.target.value)}
                  className="w-full mt-1 px-3 py-2 border rounded-md bg-background h-20"
                  placeholder="Why is this correction needed? (e.g., Field modification 2024, Updated standard...)"
                />
              </div>
              <p className="text-xs text-muted-foreground">
                This will create a Golden Rule override that supersedes the AI's extraction.
              </p>
              <div className="flex gap-3 pt-2">
                <button
                  onClick={() => setShowCorrectDialog(false)}
                  className="flex-1 py-2 border rounded-lg hover:bg-accent"
                >
                  Cancel
                </button>
                <button
                  onClick={() => handleCorrect(selectedItem.id)}
                  disabled={!correction || !correctionReason || actionLoading === selectedItem.id}
                  className="flex-1 py-2 bg-curator-gold text-white rounded-lg hover:bg-curator-gold/90 disabled:opacity-50"
                >
                  {actionLoading === selectedItem.id ? (
                    <Loader2 className="h-4 w-4 animate-spin mx-auto" />
                  ) : (
                    'Save Correction'
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
