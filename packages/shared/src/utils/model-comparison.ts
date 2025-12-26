/**
 * Model Comparison Utility
 * 
 * Compare responses from multiple AI models for evaluation and selection
 */

export interface ModelComparisonRequest {
  prompt: string;
  systemPrompt?: string;
  models: string[];
  parameters?: {
    temperature?: number;
    maxTokens?: number;
  };
  evaluationCriteria?: EvaluationCriteria[];
}

export interface ModelComparisonResult {
  prompt: string;
  responses: ModelResponse[];
  evaluations?: Evaluation[];
  summary: ComparisonSummary;
  metadata: {
    timestamp: string;
    totalDuration: number;
    totalCost: number;
    totalTokens: number;
  };
}

export interface ModelResponse {
  model: string;
  content: string;
  tokens: {
    prompt: number;
    completion: number;
    total: number;
  };
  latency: number;
  cost: number;
  finishReason: string;
}

export interface EvaluationCriteria {
  name: string;
  description: string;
  weight: number;
}

export interface Evaluation {
  model: string;
  scores: Record<string, number>;
  totalScore: number;
  notes?: string;
}

export interface ComparisonSummary {
  winner: string;
  fastestModel: string;
  cheapestModel: string;
  mostTokensUsed: string;
  rankings: Array<{ model: string; rank: number; reason: string }>;
}

/**
 * Default evaluation criteria for model comparison
 */
export const DEFAULT_CRITERIA: EvaluationCriteria[] = [
  { name: 'accuracy', description: 'Factual correctness of the response', weight: 0.3 },
  { name: 'relevance', description: 'How well the response addresses the prompt', weight: 0.25 },
  { name: 'clarity', description: 'Clarity and readability of the response', weight: 0.2 },
  { name: 'completeness', description: 'How thoroughly the response covers the topic', weight: 0.15 },
  { name: 'creativity', description: 'Originality and creative problem-solving', weight: 0.1 },
];

/**
 * Model pricing (per 1K tokens)
 */
export const MODEL_PRICING: Record<string, { input: number; output: number }> = {
  'gpt-4o': { input: 0.005, output: 0.015 },
  'gpt-4o-mini': { input: 0.00015, output: 0.0006 },
  'gpt-4-turbo': { input: 0.01, output: 0.03 },
  'gpt-3.5-turbo': { input: 0.0005, output: 0.0015 },
  'claude-3-opus': { input: 0.015, output: 0.075 },
  'claude-3-sonnet': { input: 0.003, output: 0.015 },
  'claude-3-haiku': { input: 0.00025, output: 0.00125 },
  'gemini-pro': { input: 0.00025, output: 0.0005 },
  'llama-3-70b': { input: 0.0007, output: 0.0009 },
  'mistral-large': { input: 0.004, output: 0.012 },
};

/**
 * Calculate cost for a model response
 */
export function calculateCost(
  model: string,
  promptTokens: number,
  completionTokens: number
): number {
  const pricing = MODEL_PRICING[model] || { input: 0.001, output: 0.002 };
  const inputCost = (promptTokens / 1000) * pricing.input;
  const outputCost = (completionTokens / 1000) * pricing.output;
  return inputCost + outputCost;
}

/**
 * Generate comparison summary from responses
 */
export function generateSummary(
  responses: ModelResponse[],
  evaluations?: Evaluation[]
): ComparisonSummary {
  // Find fastest
  const fastestModel = responses.reduce((a, b) => 
    a.latency < b.latency ? a : b
  ).model;

  // Find cheapest
  const cheapestModel = responses.reduce((a, b) => 
    a.cost < b.cost ? a : b
  ).model;

  // Find most tokens
  const mostTokensUsed = responses.reduce((a, b) => 
    a.tokens.total > b.tokens.total ? a : b
  ).model;

  // Determine winner and rankings
  let winner: string;
  let rankings: Array<{ model: string; rank: number; reason: string }>;

  if (evaluations && evaluations.length > 0) {
    // Sort by evaluation score
    const sorted = [...evaluations].sort((a, b) => b.totalScore - a.totalScore);
    winner = sorted[0].model;
    rankings = sorted.map((e, i) => ({
      model: e.model,
      rank: i + 1,
      reason: `Score: ${e.totalScore.toFixed(2)}`,
    }));
  } else {
    // Default to cost-effectiveness ranking
    const costPerToken = responses.map(r => ({
      model: r.model,
      efficiency: r.cost / r.tokens.total,
    })).sort((a, b) => a.efficiency - b.efficiency);

    winner = costPerToken[0].model;
    rankings = costPerToken.map((c, i) => ({
      model: c.model,
      rank: i + 1,
      reason: `Cost efficiency: $${(c.efficiency * 1000).toFixed(4)}/1K tokens`,
    }));
  }

  return {
    winner,
    fastestModel,
    cheapestModel,
    mostTokensUsed,
    rankings,
  };
}

/**
 * Format comparison result as markdown
 */
export function formatAsMarkdown(result: ModelComparisonResult): string {
  const lines: string[] = [
    '# Model Comparison Report',
    '',
    `**Prompt:** ${result.prompt.substring(0, 100)}${result.prompt.length > 100 ? '...' : ''}`,
    '',
    '## Summary',
    '',
    `- **Winner:** ${result.summary.winner}`,
    `- **Fastest:** ${result.summary.fastestModel}`,
    `- **Cheapest:** ${result.summary.cheapestModel}`,
    '',
    '## Rankings',
    '',
  ];

  for (const rank of result.summary.rankings) {
    lines.push(`${rank.rank}. **${rank.model}** - ${rank.reason}`);
  }

  lines.push('', '## Responses', '');

  for (const response of result.responses) {
    lines.push(
      `### ${response.model}`,
      '',
      `- **Latency:** ${response.latency}ms`,
      `- **Tokens:** ${response.tokens.total} (${response.tokens.prompt} + ${response.tokens.completion})`,
      `- **Cost:** $${response.cost.toFixed(6)}`,
      '',
      '```',
      response.content.substring(0, 500) + (response.content.length > 500 ? '...' : ''),
      '```',
      ''
    );
  }

  if (result.evaluations) {
    lines.push('## Evaluations', '');
    for (const evaluation of result.evaluations) {
      lines.push(`### ${evaluation.model}`, '');
      for (const [criterion, score] of Object.entries(evaluation.scores)) {
        lines.push(`- **${criterion}:** ${score}/10`);
      }
      lines.push(`- **Total:** ${evaluation.totalScore.toFixed(2)}`, '');
    }
  }

  lines.push(
    '## Metadata',
    '',
    `- **Timestamp:** ${result.metadata.timestamp}`,
    `- **Total Duration:** ${result.metadata.totalDuration}ms`,
    `- **Total Cost:** $${result.metadata.totalCost.toFixed(6)}`,
    `- **Total Tokens:** ${result.metadata.totalTokens}`,
  );

  return lines.join('\n');
}

/**
 * Format comparison result as CSV
 */
export function formatAsCsv(result: ModelComparisonResult): string {
  const headers = ['model', 'latency_ms', 'prompt_tokens', 'completion_tokens', 'total_tokens', 'cost', 'rank'];
  const rows = result.responses.map(r => {
    const rank = result.summary.rankings.find(rank => rank.model === r.model)?.rank || 0;
    return [
      r.model,
      r.latency,
      r.tokens.prompt,
      r.tokens.completion,
      r.tokens.total,
      r.cost.toFixed(6),
      rank,
    ].join(',');
  });

  return [headers.join(','), ...rows].join('\n');
}
