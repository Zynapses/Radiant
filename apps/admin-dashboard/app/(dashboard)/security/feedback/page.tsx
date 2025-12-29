'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import { CheckCircle, XCircle, AlertCircle, Download, Trash2, RefreshCw } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';

interface FeedbackStats {
  totalFeedback: number;
  falsePositives: number;
  falseNegatives: number;
  correct: number;
  uncertain: number;
  falsePositiveRate: number;
  falseNegativeRate: number;
  accuracy: number;
}

interface PendingReview {
  id: string;
  inputHash: string;
  isHarmful: boolean;
  confidenceScore: number;
  harmCategories: Array<{ category: string; score: number }>;
  attackType?: string;
  createdAt: string;
}

interface RetrainingCandidate {
  inputHash: string;
  originalLabel: boolean;
  correctedLabel: boolean;
  categories: string[];
  feedbackCount: number;
  confidence: number;
}

interface IneffectivePattern {
  patternId: string;
  patternName: string;
  patternType: string;
  totalFeedback: number;
  effectiveCount: number;
  ineffectiveCount: number;
  effectivenessRate: number;
}

export default function FeedbackPage() {
  const [stats, setStats] = useState<FeedbackStats | null>(null);
  const [pendingReview, setPendingReview] = useState<PendingReview[]>([]);
  const [candidates, setCandidates] = useState<RetrainingCandidate[]>([]);
  const [ineffectivePatterns, setIneffectivePatterns] = useState<IneffectivePattern[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('overview');
  const [selectedReview, setSelectedReview] = useState<PendingReview | null>(null);
  const [feedbackNotes, setFeedbackNotes] = useState('');

  useEffect(() => {
    fetchAll();
  }, []);

  const fetchAll = async () => {
    setLoading(true);
    try {
      const [statsRes, pendingRes, candidatesRes, patternsRes] = await Promise.all([
        fetch('/api/admin/security/feedback/stats'),
        fetch('/api/admin/security/feedback/pending?limit=50'),
        fetch('/api/admin/security/feedback/candidates'),
        fetch('/api/admin/security/feedback/ineffective-patterns'),
      ]);

      if (statsRes.ok) setStats(await statsRes.json());
      if (pendingRes.ok) setPendingReview(await pendingRes.json());
      if (candidatesRes.ok) setCandidates(await candidatesRes.json());
      if (patternsRes.ok) setIneffectivePatterns(await patternsRes.json());
    } catch (error) {
      console.error('Failed to fetch feedback data:', error);
    } finally {
      setLoading(false);
    }
  };

  const submitFeedback = async (classificationId: string, feedbackType: string, correctLabel?: boolean) => {
    try {
      await fetch('/api/admin/security/feedback/classification', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          classificationId,
          feedbackType,
          correctLabel,
          notes: feedbackNotes,
        }),
      });
      setPendingReview(prev => prev.filter(p => p.id !== classificationId));
      setSelectedReview(null);
      setFeedbackNotes('');
      fetchAll();
    } catch (error) {
      console.error('Failed to submit feedback:', error);
    }
  };

  const autoDisablePatterns = async () => {
    try {
      const res = await fetch('/api/admin/security/feedback/auto-disable', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ minFeedback: 10, maxEffectivenessRate: 0.2 }),
      });
      if (res.ok) {
        const result = await res.json();
        alert(`Disabled ${result.disabled.length} patterns, skipped ${result.skipped.length}`);
        fetchAll();
      }
    } catch (error) {
      console.error('Failed to auto-disable patterns:', error);
    }
  };

  const exportTrainingData = async (format: 'jsonl' | 'csv') => {
    window.open(`/api/admin/security/feedback/export?format=${format}`, '_blank');
  };

  if (loading) {
    return <div className="flex items-center justify-center h-64">Loading...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Classification Feedback</h1>
          <p className="text-muted-foreground mt-1">
            Review classifications, track accuracy, and improve the classifier
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={() => exportTrainingData('jsonl')}>
            <Download className="h-4 w-4 mr-2" />
            Export JSONL
          </Button>
          <Button variant="outline" onClick={fetchAll}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
        </div>
      </div>

      {/* Stats Overview */}
      {stats && (
        <div className="grid gap-4 md:grid-cols-5">
          <Card>
            <CardContent className="pt-6">
              <div className="text-2xl font-bold">{stats.totalFeedback}</div>
              <div className="text-sm text-muted-foreground">Total Feedback</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="text-2xl font-bold text-green-500">{(stats.accuracy * 100).toFixed(1)}%</div>
              <div className="text-sm text-muted-foreground">Accuracy</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="text-2xl font-bold text-red-500">{stats.falsePositives}</div>
              <div className="text-sm text-muted-foreground">False Positives</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="text-2xl font-bold text-orange-500">{stats.falseNegatives}</div>
              <div className="text-sm text-muted-foreground">False Negatives</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="text-2xl font-bold">{stats.correct}</div>
              <div className="text-sm text-muted-foreground">Correct</div>
            </CardContent>
          </Card>
        </div>
      )}

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="review">Pending Review ({pendingReview.length})</TabsTrigger>
          <TabsTrigger value="candidates">Retraining ({candidates.length})</TabsTrigger>
          <TabsTrigger value="patterns">Patterns ({ineffectivePatterns.length})</TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview" className="space-y-6 mt-6">
          {stats && (
            <div className="grid gap-6 md:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardTitle>Classification Quality</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span>Accuracy</span>
                      <span>{(stats.accuracy * 100).toFixed(1)}%</span>
                    </div>
                    <Progress value={stats.accuracy * 100} className="h-2" />
                  </div>
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span>False Positive Rate</span>
                      <span className="text-red-500">{(stats.falsePositiveRate * 100).toFixed(1)}%</span>
                    </div>
                    <Progress value={stats.falsePositiveRate * 100} className="h-2 bg-red-100" />
                  </div>
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span>False Negative Rate</span>
                      <span className="text-orange-500">{(stats.falseNegativeRate * 100).toFixed(1)}%</span>
                    </div>
                    <Progress value={stats.falseNegativeRate * 100} className="h-2 bg-orange-100" />
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Feedback Distribution</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <CheckCircle className="h-4 w-4 text-green-500" />
                        <span>Correct</span>
                      </div>
                      <span className="font-mono">{stats.correct}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <XCircle className="h-4 w-4 text-red-500" />
                        <span>False Positive</span>
                      </div>
                      <span className="font-mono">{stats.falsePositives}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <AlertCircle className="h-4 w-4 text-orange-500" />
                        <span>False Negative</span>
                      </div>
                      <span className="font-mono">{stats.falseNegatives}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <AlertCircle className="h-4 w-4 text-gray-400" />
                        <span>Uncertain</span>
                      </div>
                      <span className="font-mono">{stats.uncertain}</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}
        </TabsContent>

        {/* Pending Review Tab */}
        <TabsContent value="review" className="space-y-6 mt-6">
          <div className="grid gap-6 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Classifications to Review</CardTitle>
                <CardDescription>Sorted by uncertainty (confidence near 0.5)</CardDescription>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-[400px]">
                  <div className="space-y-2">
                    {pendingReview.map(item => (
                      <div
                        key={item.id}
                        onClick={() => setSelectedReview(item)}
                        className={`p-3 rounded-lg border cursor-pointer ${
                          selectedReview?.id === item.id ? 'border-primary bg-primary/5' : 'hover:bg-muted/50'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <Badge variant={item.isHarmful ? 'destructive' : 'secondary'}>
                            {item.isHarmful ? 'Harmful' : 'Safe'}
                          </Badge>
                          <span className="text-sm font-mono">{(item.confidenceScore * 100).toFixed(0)}%</span>
                        </div>
                        <div className="text-xs text-muted-foreground mt-1 truncate">
                          {item.inputHash}
                        </div>
                        {item.attackType && (
                          <Badge variant="outline" className="mt-1 text-xs">{item.attackType}</Badge>
                        )}
                      </div>
                    ))}
                    {pendingReview.length === 0 && (
                      <div className="text-center text-muted-foreground py-8">
                        No classifications pending review
                      </div>
                    )}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Review Classification</CardTitle>
              </CardHeader>
              <CardContent>
                {selectedReview ? (
                  <div className="space-y-4">
                    <div>
                      <Label>Classification Result</Label>
                      <div className="flex items-center gap-2 mt-1">
                        <Badge variant={selectedReview.isHarmful ? 'destructive' : 'secondary'} className="text-lg py-1 px-3">
                          {selectedReview.isHarmful ? 'HARMFUL' : 'SAFE'}
                        </Badge>
                        <span className="text-muted-foreground">
                          ({(selectedReview.confidenceScore * 100).toFixed(1)}% confidence)
                        </span>
                      </div>
                    </div>

                    {selectedReview.harmCategories.length > 0 && (
                      <div>
                        <Label>Harm Categories</Label>
                        <div className="flex flex-wrap gap-1 mt-1">
                          {selectedReview.harmCategories.map(cat => (
                            <Badge key={cat.category} variant="outline">
                              {cat.category}: {(cat.score * 100).toFixed(0)}%
                            </Badge>
                          ))}
                        </div>
                      </div>
                    )}

                    <div className="space-y-2">
                      <Label>Notes (optional)</Label>
                      <Textarea
                        value={feedbackNotes}
                        onChange={(e) => setFeedbackNotes(e.target.value)}
                        placeholder="Add notes about this classification..."
                        rows={3}
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <Button
                        variant="outline"
                        className="border-green-500 text-green-600 hover:bg-green-50"
                        onClick={() => submitFeedback(selectedReview.id, 'correct')}
                      >
                        <CheckCircle className="h-4 w-4 mr-2" />
                        Correct
                      </Button>
                      <Button
                        variant="outline"
                        className="border-red-500 text-red-600 hover:bg-red-50"
                        onClick={() => submitFeedback(selectedReview.id, 'false_positive', false)}
                      >
                        <XCircle className="h-4 w-4 mr-2" />
                        False Positive
                      </Button>
                      <Button
                        variant="outline"
                        className="border-orange-500 text-orange-600 hover:bg-orange-50"
                        onClick={() => submitFeedback(selectedReview.id, 'false_negative', true)}
                      >
                        <AlertCircle className="h-4 w-4 mr-2" />
                        False Negative
                      </Button>
                      <Button
                        variant="outline"
                        onClick={() => submitFeedback(selectedReview.id, 'uncertain')}
                      >
                        Uncertain
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="text-center text-muted-foreground py-12">
                    Select a classification to review
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Retraining Candidates Tab */}
        <TabsContent value="candidates" className="space-y-6 mt-6">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Retraining Candidates</CardTitle>
                  <CardDescription>Classifications with consistent corrective feedback</CardDescription>
                </div>
                <Button variant="outline" onClick={() => exportTrainingData('jsonl')}>
                  <Download className="h-4 w-4 mr-2" />
                  Export for Training
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {candidates.map((candidate, i) => (
                  <div key={i} className="p-3 rounded-lg border bg-muted/30">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Badge variant={candidate.originalLabel ? 'destructive' : 'secondary'}>
                          Was: {candidate.originalLabel ? 'Harmful' : 'Safe'}
                        </Badge>
                        <span className="text-muted-foreground">→</span>
                        <Badge variant={candidate.correctedLabel ? 'destructive' : 'secondary'}>
                          Should be: {candidate.correctedLabel ? 'Harmful' : 'Safe'}
                        </Badge>
                      </div>
                      <Badge variant="outline">{candidate.feedbackCount} votes</Badge>
                    </div>
                    <div className="text-xs font-mono text-muted-foreground mt-2">
                      {candidate.inputHash}
                    </div>
                    {candidate.categories.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-2">
                        {candidate.categories.map(cat => (
                          <Badge key={cat} variant="outline" className="text-xs">{cat}</Badge>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
                {candidates.length === 0 && (
                  <div className="text-center text-muted-foreground py-8">
                    No retraining candidates. Need at least 3 consistent feedback items.
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Ineffective Patterns Tab */}
        <TabsContent value="patterns" className="space-y-6 mt-6">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Ineffective Patterns</CardTitle>
                  <CardDescription>Patterns with low effectiveness based on feedback</CardDescription>
                </div>
                <Button variant="destructive" onClick={autoDisablePatterns}>
                  <Trash2 className="h-4 w-4 mr-2" />
                  Auto-Disable Poor Patterns
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {ineffectivePatterns.map(pattern => (
                  <div key={pattern.patternId} className="p-3 rounded-lg border bg-muted/30">
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="font-medium">{pattern.patternName}</div>
                        <div className="text-sm text-muted-foreground">{pattern.patternType}</div>
                      </div>
                      <div className="text-right">
                        <div className="text-lg font-bold text-red-500">
                          {(pattern.effectivenessRate * 100).toFixed(0)}%
                        </div>
                        <div className="text-xs text-muted-foreground">effectiveness</div>
                      </div>
                    </div>
                    <div className="flex items-center gap-4 mt-2 text-sm">
                      <span className="text-green-600">✓ {pattern.effectiveCount} effective</span>
                      <span className="text-red-600">✗ {pattern.ineffectiveCount} ineffective</span>
                      <span className="text-muted-foreground">{pattern.totalFeedback} total</span>
                    </div>
                  </div>
                ))}
                {ineffectivePatterns.length === 0 && (
                  <div className="text-center text-muted-foreground py-8">
                    No ineffective patterns found. All patterns performing well.
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
