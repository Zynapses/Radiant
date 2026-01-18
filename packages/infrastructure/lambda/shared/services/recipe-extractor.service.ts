// RADIANT v5.12.0 - Recipe Extractor Service
// Extracts successful workflow patterns into "Recipe Nodes" for GraphRAG
// If a tool sequence succeeds 3+ times for a user, save as a reusable recipe

import { executeStatement, stringParam, longParam, doubleParam } from '../db/client';
import { enhancedLogger as logger } from '../logging/enhanced-logger';
import { v4 as uuidv4 } from 'uuid';

// ============================================================================
// Types
// ============================================================================

export interface Recipe {
  recipe_id: string;
  tenant_id: string;
  user_id: string;
  recipe_name: string;
  goal_pattern: string;
  tool_sequence: RecipeStep[];
  success_count: number;
  last_success_at: Date;
  confidence: number;
  is_global: boolean;
  metadata: RecipeMetadata;
  created_at: Date;
}

export interface RecipeStep {
  tool_type: string;
  order: number;
  expected_output_type?: string;
  common_args?: Record<string, string>;
}

export interface RecipeMetadata {
  avg_duration_ms: number;
  preferred_model?: string;
  common_context_keys: string[];
  user_preferences: Record<string, string>;
}

export interface RecipeMatch {
  recipe: Recipe;
  match_score: number;
  injection_prompt: string;
}

// ============================================================================
// Recipe Extractor Service
// ============================================================================

class RecipeExtractorService {
  private readonly SUCCESS_THRESHOLD = 3; // Min successes to create recipe
  private readonly CONFIDENCE_THRESHOLD = 0.7;

  /**
   * Check if a completed episode should become a recipe
   */
  async checkAndExtractRecipe(episode: {
    episode_id: string;
    tenant_id: string;
    user_id: string;
    goal_intent: string;
    workflow_trace: Array<{ tool: string; status: string }>;
    outcome_signal: 'positive' | 'negative' | 'neutral';
  }): Promise<Recipe | null> {
    if (episode.outcome_signal !== 'positive') {
      return null;
    }

    const successfulTools = episode.workflow_trace.filter((t) => t.status === 'success');
    if (successfulTools.length < 2) {
      return null; // Need at least 2 tools for a meaningful recipe
    }

    // Generate goal pattern (normalized version of goal)
    const goalPattern = this.normalizeGoalPattern(episode.goal_intent);

    // Check if similar pattern exists
    const existingRecipe = await this.findSimilarRecipe(
      episode.tenant_id,
      episode.user_id,
      goalPattern
    );

    if (existingRecipe) {
      // Increment success count
      await this.incrementRecipeSuccess(existingRecipe.recipe_id);
      return existingRecipe;
    }

    // Check if we have enough similar successes
    const similarSuccesses = await this.countSimilarSuccesses(
      episode.tenant_id,
      episode.user_id,
      goalPattern
    );

    if (similarSuccesses >= this.SUCCESS_THRESHOLD) {
      // Create new recipe
      return this.createRecipe({
        tenant_id: episode.tenant_id,
        user_id: episode.user_id,
        goal_pattern: goalPattern,
        tool_sequence: successfulTools.map((t, i) => ({
          tool_type: t.tool,
          order: i,
        })),
        goal_intent: episode.goal_intent,
      });
    }

    return null;
  }

  /**
   * Find matching recipes for a new task
   */
  async findMatchingRecipes(
    tenantId: string,
    userId: string,
    goalIntent: string,
    limit: number = 3
  ): Promise<RecipeMatch[]> {
    const goalPattern = this.normalizeGoalPattern(goalIntent);
    const goalKeywords = this.extractKeywords(goalIntent);

    // Get user's personal recipes
    const userRecipesResult = await executeStatement(
      `SELECT * FROM workflow_recipes 
       WHERE tenant_id = $1 AND user_id = $2 AND confidence >= $3
       ORDER BY success_count DESC, last_success_at DESC
       LIMIT $4`,
      [
        stringParam('tenantId', tenantId),
        stringParam('userId', userId),
        doubleParam('confidence', this.CONFIDENCE_THRESHOLD),
        longParam('limit', limit * 2),
      ]
    );

    // Get global recipes (high-success patterns)
    const globalRecipesResult = await executeStatement(
      `SELECT * FROM workflow_recipes 
       WHERE is_global = true AND confidence >= $1
       ORDER BY success_count DESC
       LIMIT $2`,
      [
        doubleParam('confidence', this.CONFIDENCE_THRESHOLD),
        longParam('limit', limit),
      ]
    );

    const allRecipes = [
      ...this.parseRecipeRows(userRecipesResult.rows || []),
      ...this.parseRecipeRows(globalRecipesResult.rows || []),
    ];

    // Score and rank recipes
    const matches: RecipeMatch[] = [];

    for (const recipe of allRecipes) {
      const matchScore = this.calculateMatchScore(recipe, goalPattern, goalKeywords);
      if (matchScore > 0.3) {
        matches.push({
          recipe,
          match_score: matchScore,
          injection_prompt: this.generateInjectionPrompt(recipe),
        });
      }
    }

    return matches
      .sort((a, b) => b.match_score - a.match_score)
      .slice(0, limit);
  }

  /**
   * Promote a recipe to global (for Cato learning)
   */
  async promoteToGlobal(recipeId: string): Promise<void> {
    await executeStatement(
      `UPDATE workflow_recipes SET is_global = true, updated_at = NOW() WHERE recipe_id = $1`,
      [stringParam('recipeId', recipeId)]
    );
    logger.info('Recipe promoted to global', { recipeId });
  }

  /**
   * Get user's recipes for admin dashboard
   */
  async getUserRecipes(tenantId: string, userId: string): Promise<Recipe[]> {
    const result = await executeStatement(
      `SELECT * FROM workflow_recipes 
       WHERE tenant_id = $1 AND user_id = $2
       ORDER BY success_count DESC, last_success_at DESC
       LIMIT 50`,
      [
        stringParam('tenantId', tenantId),
        stringParam('userId', userId),
      ]
    );
    return this.parseRecipeRows(result.rows || []);
  }

  /**
   * Run nightly job to promote high-success recipes to global
   */
  async runPromotionJob(): Promise<{ promoted: number }> {
    const result = await executeStatement(
      `UPDATE workflow_recipes 
       SET is_global = true, updated_at = NOW()
       WHERE is_global = false 
       AND success_count >= 10 
       AND confidence >= 0.9
       RETURNING recipe_id`,
      []
    );

    const promoted = result.rows?.length || 0;
    logger.info('Recipe promotion job completed', { promoted });
    return { promoted };
  }

  // ============================================================================
  // Private Methods
  // ============================================================================

  private async createRecipe(input: {
    tenant_id: string;
    user_id: string;
    goal_pattern: string;
    tool_sequence: RecipeStep[];
    goal_intent: string;
  }): Promise<Recipe> {
    const recipeId = uuidv4();
    const recipeName = this.generateRecipeName(input.goal_intent);

    const recipe: Recipe = {
      recipe_id: recipeId,
      tenant_id: input.tenant_id,
      user_id: input.user_id,
      recipe_name: recipeName,
      goal_pattern: input.goal_pattern,
      tool_sequence: input.tool_sequence,
      success_count: this.SUCCESS_THRESHOLD,
      last_success_at: new Date(),
      confidence: 0.7,
      is_global: false,
      metadata: {
        avg_duration_ms: 0,
        common_context_keys: [],
        user_preferences: {},
      },
      created_at: new Date(),
    };

    await executeStatement(
      `INSERT INTO workflow_recipes (
        recipe_id, tenant_id, user_id, recipe_name, goal_pattern,
        tool_sequence, success_count, last_success_at, confidence,
        is_global, metadata, created_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`,
      [
        stringParam('recipeId', recipeId),
        stringParam('tenantId', input.tenant_id),
        stringParam('userId', input.user_id),
        stringParam('recipeName', recipeName),
        stringParam('goalPattern', input.goal_pattern),
        stringParam('toolSequence', JSON.stringify(input.tool_sequence)),
        longParam('successCount', recipe.success_count),
        stringParam('lastSuccessAt', recipe.last_success_at.toISOString()),
        doubleParam('confidence', recipe.confidence),
        stringParam('isGlobal', 'false'),
        stringParam('metadata', JSON.stringify(recipe.metadata)),
        stringParam('createdAt', recipe.created_at.toISOString()),
      ]
    );

    logger.info('Recipe created', { recipeId, recipeName });
    return recipe;
  }

  private async findSimilarRecipe(
    tenantId: string,
    userId: string,
    goalPattern: string
  ): Promise<Recipe | null> {
    const result = await executeStatement(
      `SELECT * FROM workflow_recipes 
       WHERE tenant_id = $1 AND user_id = $2 AND goal_pattern = $3
       LIMIT 1`,
      [
        stringParam('tenantId', tenantId),
        stringParam('userId', userId),
        stringParam('goalPattern', goalPattern),
      ]
    );

    const recipes = this.parseRecipeRows(result.rows || []);
    return recipes[0] || null;
  }

  private async incrementRecipeSuccess(recipeId: string): Promise<void> {
    await executeStatement(
      `UPDATE workflow_recipes 
       SET success_count = success_count + 1, 
           last_success_at = NOW(),
           confidence = LEAST(1.0, confidence + 0.05),
           updated_at = NOW()
       WHERE recipe_id = $1`,
      [stringParam('recipeId', recipeId)]
    );
  }

  private async countSimilarSuccesses(
    tenantId: string,
    userId: string,
    goalPattern: string
  ): Promise<number> {
    const result = await executeStatement(
      `SELECT COUNT(*) as count FROM learning_episodes 
       WHERE tenant_id = $1 AND user_id = $2 
       AND outcome_signal = 'positive'
       AND goal_intent ILIKE $3
       AND created_at > NOW() - INTERVAL '30 days'`,
      [
        stringParam('tenantId', tenantId),
        stringParam('userId', userId),
        stringParam('goalPattern', `%${goalPattern}%`),
      ]
    );

    return Number((result.rows?.[0] as { count: number })?.count || 0);
  }

  private normalizeGoalPattern(goal: string): string {
    return goal
      .toLowerCase()
      .replace(/[^\w\s]/g, '')
      .replace(/\s+/g, ' ')
      .trim()
      .split(' ')
      .filter((w) => w.length > 2)
      .sort()
      .join('_');
  }

  private extractKeywords(text: string): string[] {
    const stopWords = new Set(['the', 'a', 'an', 'to', 'for', 'of', 'in', 'on', 'with', 'and', 'or']);
    return text
      .toLowerCase()
      .replace(/[^\w\s]/g, '')
      .split(/\s+/)
      .filter((w) => w.length > 2 && !stopWords.has(w));
  }

  private calculateMatchScore(
    recipe: Recipe,
    goalPattern: string,
    goalKeywords: string[]
  ): number {
    // Pattern match
    const patternMatch = recipe.goal_pattern === goalPattern ? 1.0 : 0;

    // Keyword overlap
    const recipeKeywords = recipe.goal_pattern.split('_');
    const overlap = goalKeywords.filter((k) => recipeKeywords.includes(k)).length;
    const keywordScore = recipeKeywords.length > 0 ? overlap / recipeKeywords.length : 0;

    // Confidence boost
    const confidenceBoost = recipe.confidence * 0.2;

    return patternMatch * 0.5 + keywordScore * 0.3 + confidenceBoost;
  }

  private generateInjectionPrompt(recipe: Recipe): string {
    const steps = recipe.tool_sequence
      .map((s) => `${s.order + 1}. Use ${s.tool_type}`)
      .join('\n');

    return `Based on your previous successful workflows, here's a recommended approach:

**${recipe.recipe_name}** (${recipe.success_count} successful uses)

Steps:
${steps}

You can follow this pattern or adapt it to your current needs.`;
  }

  private generateRecipeName(goalIntent: string): string {
    // Take first 5 meaningful words
    const words = goalIntent
      .replace(/[^\w\s]/g, '')
      .split(/\s+/)
      .filter((w) => w.length > 2)
      .slice(0, 5);

    return words.map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
  }

  private parseRecipeRows(rows: unknown[]): Recipe[] {
    return rows.map((row: unknown) => {
      const r = row as Record<string, unknown>;
      return {
        recipe_id: r.recipe_id as string,
        tenant_id: r.tenant_id as string,
        user_id: r.user_id as string,
        recipe_name: r.recipe_name as string,
        goal_pattern: r.goal_pattern as string,
        tool_sequence: JSON.parse(r.tool_sequence as string || '[]'),
        success_count: Number(r.success_count || 0),
        last_success_at: new Date(r.last_success_at as string),
        confidence: Number(r.confidence || 0),
        is_global: Boolean(r.is_global),
        metadata: JSON.parse(r.metadata as string || '{}'),
        created_at: new Date(r.created_at as string),
      };
    });
  }
}

export const recipeExtractorService = new RecipeExtractorService();
