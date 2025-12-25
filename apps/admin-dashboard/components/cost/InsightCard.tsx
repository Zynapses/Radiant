'use client';

import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Lightbulb,
  TrendingDown,
  CheckCircle,
  X,
  AlertTriangle,
  Loader2,
} from 'lucide-react';

export interface CostInsight {
  id: string;
  insightType: 'model_switch' | 'batch_optimization' | 'caching' | 'rate_limit' | 'unused_capacity';
  title: string;
  description: string;
  estimatedSavings: number;
  estimatedSavingsPercent: number;
  confidence: number;
  recommendation: string;
  affectedModels?: string[];
  status: 'active' | 'applied' | 'dismissed';
  createdAt: string;
  product: 'radiant' | 'thinktank' | 'combined';
}

interface InsightCardProps {
  insight: CostInsight;
  onApply?: (id: string) => void;
  onDismiss?: (id: string) => void;
}

export function InsightCard({ insight, onApply, onDismiss }: InsightCardProps) {
  const [isApplying, setIsApplying] = useState(false);
  const queryClient = useQueryClient();

  const applyMutation = useMutation({
    mutationFn: async (id: string) => {
      const response = await fetch(`/api/cost/insights/${id}/apply`, {
        method: 'POST',
      });
      if (!response.ok) throw new Error('Failed to apply insight');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cost-insights'] });
      onApply?.(insight.id);
    },
  });

  const dismissMutation = useMutation({
    mutationFn: async (id: string) => {
      const response = await fetch(`/api/cost/insights/${id}/dismiss`, {
        method: 'POST',
      });
      if (!response.ok) throw new Error('Failed to dismiss insight');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cost-insights'] });
      onDismiss?.(insight.id);
    },
  });

  const handleApply = async () => {
    setIsApplying(true);
    try {
      await applyMutation.mutateAsync(insight.id);
    } finally {
      setIsApplying(false);
    }
  };

  const getInsightIcon = () => {
    switch (insight.insightType) {
      case 'model_switch':
        return <TrendingDown className="h-5 w-5 text-green-500" />;
      case 'batch_optimization':
        return <Lightbulb className="h-5 w-5 text-amber-500" />;
      case 'caching':
        return <Lightbulb className="h-5 w-5 text-blue-500" />;
      default:
        return <Lightbulb className="h-5 w-5 text-purple-500" />;
    }
  };

  const getConfidenceBadge = () => {
    if (insight.confidence >= 0.8) {
      return <Badge className="bg-green-500">High Confidence</Badge>;
    } else if (insight.confidence >= 0.5) {
      return <Badge className="bg-amber-500">Medium Confidence</Badge>;
    } else {
      return <Badge className="bg-red-500">Low Confidence</Badge>;
    }
  };

  const getProductBadge = () => {
    switch (insight.product) {
      case 'radiant':
        return <Badge variant="outline">Radiant</Badge>;
      case 'thinktank':
        return <Badge variant="outline">Think Tank</Badge>;
      default:
        return <Badge variant="outline">Combined</Badge>;
    }
  };

  if (insight.status !== 'active') {
    return null;
  }

  return (
    <Card className="border-l-4 border-l-amber-500">
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-2">
            {getInsightIcon()}
            <CardTitle className="text-base">{insight.title}</CardTitle>
          </div>
          <div className="flex items-center gap-2">
            {getProductBadge()}
            {getConfidenceBadge()}
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-muted-foreground mb-3">{insight.description}</p>

        <div className="bg-muted/50 rounded-lg p-3 mb-3">
          <div className="flex items-center gap-2 text-sm font-medium mb-1">
            <TrendingDown className="h-4 w-4 text-green-500" />
            Estimated Savings
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-bold text-green-600">
              ${insight.estimatedSavings.toFixed(2)}
            </span>
            <span className="text-sm text-muted-foreground">
              ({insight.estimatedSavingsPercent.toFixed(1)}% reduction)
            </span>
          </div>
        </div>

        <div className="bg-blue-50 dark:bg-blue-950 rounded-lg p-3 mb-4">
          <div className="text-sm font-medium mb-1">Recommendation</div>
          <p className="text-sm">{insight.recommendation}</p>
        </div>

        {insight.affectedModels && insight.affectedModels.length > 0 && (
          <div className="mb-4">
            <div className="text-sm font-medium mb-1">Affected Models</div>
            <div className="flex flex-wrap gap-1">
              {insight.affectedModels.map((model) => (
                <Badge key={model} variant="secondary" className="text-xs">
                  {model}
                </Badge>
              ))}
            </div>
          </div>
        )}

        <div className="flex items-center justify-between pt-2 border-t">
          <div className="flex items-center gap-1 text-xs text-muted-foreground">
            <AlertTriangle className="h-3 w-3" />
            Requires human approval
          </div>
          <div className="flex gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => dismissMutation.mutate(insight.id)}
              disabled={dismissMutation.isPending}
            >
              <X className="h-4 w-4 mr-1" />
              Dismiss
            </Button>
            <Button
              size="sm"
              onClick={handleApply}
              disabled={isApplying || applyMutation.isPending}
            >
              {isApplying ? (
                <Loader2 className="h-4 w-4 mr-1 animate-spin" />
              ) : (
                <CheckCircle className="h-4 w-4 mr-1" />
              )}
              Apply
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export function InsightsList({ insights }: { insights: CostInsight[] }) {
  const activeInsights = insights.filter((i) => i.status === 'active');

  if (activeInsights.length === 0) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-muted-foreground">
          <Lightbulb className="h-8 w-8 mx-auto mb-2 opacity-50" />
          <p>No active cost optimization insights</p>
          <p className="text-sm">Neural Engine will analyze your usage patterns</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">AI Recommendations</h3>
        <Badge variant="secondary">{activeInsights.length} active</Badge>
      </div>
      {activeInsights.map((insight) => (
        <InsightCard key={insight.id} insight={insight} />
      ))}
    </div>
  );
}
