/**
 * NLI Scorer Service
 * 
 * Provides Natural Language Inference scoring for Cato.
 * Evaluates logical relationships between text pairs.
 */

export type NLILabel = 'entailment' | 'contradiction' | 'neutral';

export interface NLIResult {
  id: string;
  premise: string;
  hypothesis: string;
  label: NLILabel;
  confidence: number;
  scores: {
    entailment: number;
    contradiction: number;
    neutral: number;
  };
  timestamp: Date;
}

export interface NLIBatchResult {
  results: NLIResult[];
  averageConfidence: number;
  dominantLabel: NLILabel;
}

class NLIScorerService {
  private results: NLIResult[] = [];

  async score(premise: string, hypothesis: string): Promise<NLIResult> {
    // Use LLM for NLI scoring
    const scores = await this.computeScoresWithLLM(premise, hypothesis);
    const label = this.getLabel(scores);
    
    const result: NLIResult = {
      id: `nli_${Date.now()}`,
      premise,
      hypothesis,
      label,
      confidence: Math.max(scores.entailment, scores.contradiction, scores.neutral),
      scores,
      timestamp: new Date(),
    };

    this.results.push(result);
    return result;
  }

  async scoreBatch(pairs: Array<{ premise: string; hypothesis: string }>): Promise<NLIBatchResult> {
    const results: NLIResult[] = [];
    
    for (const pair of pairs) {
      const result = await this.score(pair.premise, pair.hypothesis);
      results.push(result);
    }

    const avgConfidence = results.reduce((sum, r) => sum + r.confidence, 0) / results.length;
    const labelCounts: Record<NLILabel, number> = { entailment: 0, contradiction: 0, neutral: 0 };
    results.forEach(r => labelCounts[r.label]++);
    
    const dominantLabel = (Object.entries(labelCounts) as [NLILabel, number][])
      .sort((a, b) => b[1] - a[1])[0][0];

    return {
      results,
      averageConfidence: avgConfidence,
      dominantLabel,
    };
  }

  async checkContradiction(statements: string[]): Promise<Array<{ pair: [string, string]; isContradiction: boolean; confidence: number }>> {
    const contradictions: Array<{ pair: [string, string]; isContradiction: boolean; confidence: number }> = [];

    for (let i = 0; i < statements.length; i++) {
      for (let j = i + 1; j < statements.length; j++) {
        const result = await this.score(statements[i], statements[j]);
        contradictions.push({
          pair: [statements[i], statements[j]],
          isContradiction: result.label === 'contradiction',
          confidence: result.label === 'contradiction' ? result.confidence : 1 - result.scores.contradiction,
        });
      }
    }

    return contradictions;
  }

  async getHistory(limit = 100): Promise<NLIResult[]> {
    return this.results.slice(-limit);
  }

  async classify(tenantIdOrPremise: string = 'default', textOrHypothesis?: string): Promise<{ label: string; confidence: number; entailment: number; contradiction: number; neutral: number }> {
    const premise = textOrHypothesis ? tenantIdOrPremise : '';
    const hypothesis = textOrHypothesis || tenantIdOrPremise;
    const scores = this.computeScores(premise, hypothesis);
    const maxScore = Math.max(scores.entailment, scores.contradiction, scores.neutral);
    const label = scores.entailment === maxScore ? 'entailment' : scores.contradiction === maxScore ? 'contradiction' : 'neutral';
    return { 
      label, 
      confidence: maxScore,
      entailment: scores.entailment,
      contradiction: scores.contradiction,
      neutral: scores.neutral,
    };
  }

  private async computeScoresWithLLM(premise: string, hypothesis: string): Promise<{ entailment: number; contradiction: number; neutral: number }> {
    try {
      const { callLiteLLM } = await import('../litellm.service.js');
      
      const response = await callLiteLLM({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: `You are an NLI (Natural Language Inference) classifier. Given a premise and hypothesis, determine the relationship.
Output JSON only: {"entailment": 0.0-1.0, "contradiction": 0.0-1.0, "neutral": 0.0-1.0}
The three scores must sum to 1.0.
- entailment: hypothesis follows from premise
- contradiction: hypothesis contradicts premise  
- neutral: neither entailment nor contradiction`,
          },
          {
            role: 'user',
            content: `Premise: "${premise}"\nHypothesis: "${hypothesis}"`,
          },
        ],
        temperature: 0.1,
        max_tokens: 100,
      });

      const jsonMatch = response.content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const scores = JSON.parse(jsonMatch[0]);
        return {
          entailment: Number(scores.entailment) || 0.33,
          contradiction: Number(scores.contradiction) || 0.33,
          neutral: Number(scores.neutral) || 0.34,
        };
      }
    } catch (error) {
      // Fall back to heuristic scoring on error
    }
    return this.computeScores(premise, hypothesis);
  }

  private computeScores(premise: string, hypothesis: string): { entailment: number; contradiction: number; neutral: number } {
    // Heuristic fallback scoring
    const premiseWords = new Set(premise.toLowerCase().split(/\s+/));
    const hypothesisWords = hypothesis.toLowerCase().split(/\s+/);
    
    let overlap = 0;
    let negation = false;
    
    for (const word of hypothesisWords) {
      if (premiseWords.has(word)) overlap++;
      if (['not', 'never', 'no', "n't", 'cannot'].includes(word)) negation = true;
    }

    const overlapRatio = hypothesisWords.length > 0 ? overlap / hypothesisWords.length : 0;

    if (negation && overlapRatio > 0.3) {
      return { entailment: 0.1, contradiction: 0.7, neutral: 0.2 };
    } else if (overlapRatio > 0.5) {
      return { entailment: 0.7, contradiction: 0.1, neutral: 0.2 };
    } else {
      return { entailment: 0.2, contradiction: 0.2, neutral: 0.6 };
    }
  }

  private getLabel(scores: { entailment: number; contradiction: number; neutral: number }): NLILabel {
    if (scores.entailment >= scores.contradiction && scores.entailment >= scores.neutral) {
      return 'entailment';
    } else if (scores.contradiction >= scores.neutral) {
      return 'contradiction';
    }
    return 'neutral';
  }
}

export const nliScorerService = new NLIScorerService();
