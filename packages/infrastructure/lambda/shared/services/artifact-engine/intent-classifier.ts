// ============================================================================
// RADIANT Artifact Engine - Intent Classifier Service
// packages/infrastructure/lambda/shared/services/artifact-engine/intent-classifier.ts
// Version: 4.19.0
// ============================================================================

import { query } from '../../db/pool-manager';
import { callLiteLLM } from '../litellm.service';
import {
  ArtifactIntentType,
  ArtifactGenerationPlan,
  ArtifactCodePatternRow,
} from './types';

export class IntentClassifierService {
  /**
   * Classify user intent and generate execution plan
   */
  async classifyAndPlan(
    prompt: string,
    mood: string = 'balanced'
  ): Promise<ArtifactGenerationPlan> {
    // Step 1: Classify intent with fast model
    const classificationPrompt = `
You are an artifact intent classifier. Analyze the user's request and classify it.

User Request: "${prompt}"

Classify into ONE of these categories:
- calculator: Mathematical computations, converters, estimators, unit conversion
- chart: Data visualization, graphs, plots, analytics dashboards
- form: Input forms, surveys, data entry, wizards
- table: Data tables, grids, lists, sortable/filterable data
- dashboard: Multi-widget layouts, metrics displays, KPI panels
- game: Interactive games, puzzles, simulations
- visualization: Animations, diagrams, infographics, flowcharts
- utility: Tools, helpers, formatters, converters
- custom: Doesn't fit other categories

Consider complexity:
- simple: Single component, basic logic, <100 lines
- moderate: Multiple sub-components, some state, 100-300 lines
- complex: Many components, complex state/logic, >300 lines

Respond in JSON format only:
{
    "intent": "<category>",
    "complexity": "simple|moderate|complex",
    "keyFeatures": ["feature1", "feature2"],
    "suggestedDependencies": ["dep1", "dep2"],
    "estimatedLines": <number>
}`;

    const classificationResponse = await callLiteLLM({
      model: 'anthropic/claude-3-5-haiku-20241022',
      messages: [{ role: 'user', content: classificationPrompt }],
      temperature: 0.1,
      max_tokens: 500,
    });

    let classification: {
      intent: ArtifactIntentType;
      complexity: 'simple' | 'moderate' | 'complex';
      keyFeatures: string[];
      suggestedDependencies: string[];
      estimatedLines: number;
    };

    try {
      const content = classificationResponse.content;
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      classification = JSON.parse(jsonMatch ? jsonMatch[0] : content);
    } catch {
      classification = {
        intent: 'custom',
        complexity: 'moderate',
        keyFeatures: [],
        suggestedDependencies: ['lucide-react'],
        estimatedLines: 150,
      };
    }

    // Step 2: Find similar patterns
    const similarPatterns = await this.findSimilarPatterns(
      prompt,
      classification.intent
    );

    // Step 3: Select model based on complexity and mood
    const suggestedModel = this.selectModel(classification.complexity, mood);

    // Step 4: Generate execution steps
    const steps = this.generateSteps(classification.intent, classification.complexity);

    // Step 5: Estimate tokens
    const estimatedTokens = this.estimateTokens(classification.complexity);

    return {
      intent: classification.intent,
      complexity: classification.complexity,
      steps,
      estimatedTokens,
      suggestedModel,
      similarPatterns,
      dependencies: classification.suggestedDependencies,
    };
  }

  /**
   * Find similar code patterns using vector similarity
   */
  private async findSimilarPatterns(
    prompt: string,
    intent: ArtifactIntentType
  ): Promise<Array<{ patternId: string; similarity: number; patternName: string }>> {
    // First try exact type match
    const typeMatchResult = await query<ArtifactCodePatternRow>(
      `SELECT id, pattern_name, pattern_type
       FROM artifact_code_patterns
       WHERE pattern_type = $1 AND is_active = TRUE
       ORDER BY usage_count DESC, success_rate DESC
       LIMIT 3`,
      [intent]
    );

    if (typeMatchResult.rows.length > 0) {
      return typeMatchResult.rows.map((row, index) => ({
        patternId: row.id,
        similarity: 0.9 - index * 0.1,
        patternName: row.pattern_name,
      }));
    }

    // Fallback to any active patterns
    const fallbackResult = await query<ArtifactCodePatternRow>(
      `SELECT id, pattern_name, pattern_type
       FROM artifact_code_patterns
       WHERE is_active = TRUE
       ORDER BY usage_count DESC
       LIMIT 3`
    );

    return fallbackResult.rows.map((row, index) => ({
      patternId: row.id,
      similarity: 0.5 - index * 0.1,
      patternName: row.pattern_name,
    }));
  }

  /**
   * Select model based on complexity and mood
   */
  private selectModel(
    complexity: 'simple' | 'moderate' | 'complex',
    mood: string
  ): string {
    // Spark mood = more creative, use better model even for simple tasks
    if (mood === 'spark') {
      return 'anthropic/claude-sonnet-4-20250514';
    }

    // Complex tasks always use Sonnet
    if (complexity === 'complex') {
      return 'anthropic/claude-sonnet-4-20250514';
    }

    // Simple tasks use Haiku for speed/cost
    if (complexity === 'simple') {
      return 'anthropic/claude-3-5-haiku-20241022';
    }

    // Moderate defaults to Sonnet for quality
    return 'anthropic/claude-sonnet-4-20250514';
  }

  /**
   * Generate execution steps based on intent and complexity
   */
  private generateSteps(
    intent: ArtifactIntentType,
    complexity: 'simple' | 'moderate' | 'complex'
  ): string[] {
    const baseSteps = [
      'Analyze requirements',
      'Design component structure',
      'Implement core logic',
      'Add styling with Tailwind',
      'Validate against CBFs',
    ];

    if (complexity === 'complex') {
      return [
        'Analyze requirements',
        'Design component hierarchy',
        'Define state management',
        'Implement sub-components',
        'Implement main component',
        'Add interactivity',
        'Add styling with Tailwind',
        'Optimize performance',
        'Validate against CBFs',
      ];
    }

    if (intent === 'chart' || intent === 'visualization') {
      return [
        'Analyze data structure',
        'Select visualization type',
        'Import charting library',
        'Configure chart options',
        'Add responsiveness',
        'Validate against CBFs',
      ];
    }

    if (intent === 'form') {
      return [
        'Analyze form requirements',
        'Define form schema',
        'Implement validation logic',
        'Build form UI',
        'Add error handling',
        'Add success state',
        'Validate against CBFs',
      ];
    }

    return baseSteps;
  }

  /**
   * Estimate token usage based on complexity
   */
  private estimateTokens(complexity: 'simple' | 'moderate' | 'complex'): number {
    const estimates: Record<string, number> = {
      simple: 1500,
      moderate: 3000,
      complex: 6000,
    };
    return estimates[complexity] || 3000;
  }

  /**
   * Get pattern template by ID
   */
  async getPatternTemplate(patternId: string): Promise<string | null> {
    const result = await query<ArtifactCodePatternRow>(
      `SELECT template_code FROM artifact_code_patterns WHERE id = $1`,
      [patternId]
    );
    return result.rows.length > 0 ? result.rows[0].template_code : null;
  }
}

export const intentClassifierService = new IntentClassifierService();
