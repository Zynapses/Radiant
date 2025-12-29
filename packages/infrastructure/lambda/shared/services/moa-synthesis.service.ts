// Mixture of Agents (MoA) Synthesis Service
// Coordinates parallel generation and synthesis for superior results

import { executeStatement, stringParam } from '../db/client';
import type {
  SynthesisSession,
  SynthesisDraft,
  SynthesisResult,
  SynthesisMode,
  SynthesisStatus,
  MoAConfig,
  FactualClaim,
  ConflictResolution,
} from '@radiant/shared';
import crypto from 'crypto';

const DEFAULT_CONFIG: MoAConfig = {
  enabled: false,
  proposerCount: 3,
  defaultProposers: ['gpt-4o', 'claude-3-5-sonnet', 'deepseek-v3'],
  synthesizerModel: 'claude-3-5-sonnet',
  synthesisMode: 'standard',
};

// Synthesizer system prompt
const SYNTHESIZER_SYSTEM_PROMPT = `You are a Chief Editor and Synthesis Expert. Your role is to combine multiple AI-generated drafts into a single, superior response.

Guidelines:
1. Identify the strengths of each draft (accuracy, completeness, clarity, examples)
2. Identify weaknesses or gaps in each draft
3. Resolve factual conflicts by choosing the most well-supported claim
4. Combine the best elements into a coherent, comprehensive response
5. Maintain consistent tone and style throughout
6. Do not simply concatenate - synthesize intelligently
7. If drafts contradict each other on facts, note this and choose the most likely correct answer

Output your synthesis directly without meta-commentary about the process.`;

export interface ProposerResult {
  modelId: string;
  provider: string;
  response: string;
  tokens: number;
  latencyMs: number;
  logprobAvg?: number;
}

export interface SynthesisInput {
  tenantId: string;
  userId: string;
  planId?: string;
  promptText: string;
  mode?: SynthesisMode;
  proposerModels?: string[];
  synthesizerModel?: string;
}

class MoASynthesisService {
  private config: MoAConfig = DEFAULT_CONFIG;

  /**
   * Create a new synthesis session
   */
  async createSession(input: SynthesisInput): Promise<SynthesisSession> {
    const promptHash = crypto.createHash('sha256').update(input.promptText).digest('hex').slice(0, 16);
    const proposers = input.proposerModels || this.config.defaultProposers;
    const synthesizer = input.synthesizerModel || this.config.synthesizerModel;

    const result = await executeStatement({
      sql: `
        INSERT INTO synthesis_sessions (
          tenant_id, user_id, plan_id, prompt_text, prompt_hash,
          synthesis_mode, proposer_models, proposer_count, synthesizer_model, status
        ) VALUES (
          $1::uuid, $2::uuid, $3::uuid, $4, $5,
          $6, $7, $8, $9, 'pending'
        )
        RETURNING *
      `,
      parameters: [
        stringParam('tenantId', input.tenantId),
        stringParam('userId', input.userId),
        stringParam('planId', input.planId || ''),
        stringParam('promptText', input.promptText),
        stringParam('promptHash', promptHash),
        stringParam('mode', input.mode || this.config.synthesisMode),
        stringParam('proposers', `{${proposers.join(',')}}`),
        stringParam('count', String(proposers.length)),
        stringParam('synthesizer', synthesizer),
      ],
    });

    const row = result.rows?.[0];
    return this.mapSessionRow(row);
  }

  /**
   * Record a proposer draft
   */
  async recordDraft(
    sessionId: string,
    proposerResult: ProposerResult,
    draftOrder: number
  ): Promise<SynthesisDraft> {
    // Pre-analyze the draft for synthesis context
    const analysis = this.analyzeDraft(proposerResult.response);

    const result = await executeStatement({
      sql: `
        INSERT INTO synthesis_drafts (
          session_id, model_id, provider, draft_order,
          response_text, response_tokens, strengths, weaknesses,
          unique_insights, factual_claims, latency_ms, logprob_avg
        ) VALUES (
          $1::uuid, $2, $3, $4, $5, $6, $7::jsonb, $8::jsonb, $9, $10::jsonb, $11, $12
        )
        RETURNING *
      `,
      parameters: [
        stringParam('sessionId', sessionId),
        stringParam('modelId', proposerResult.modelId),
        stringParam('provider', proposerResult.provider),
        stringParam('draftOrder', String(draftOrder)),
        stringParam('responseText', proposerResult.response),
        stringParam('tokens', String(proposerResult.tokens)),
        stringParam('strengths', JSON.stringify(analysis.strengths)),
        stringParam('weaknesses', JSON.stringify(analysis.weaknesses)),
        stringParam('insights', `{${analysis.uniqueInsights.map(i => `"${i}"`).join(',')}}`),
        stringParam('claims', JSON.stringify(analysis.factualClaims)),
        stringParam('latencyMs', String(proposerResult.latencyMs)),
        stringParam('logprobAvg', String(proposerResult.logprobAvg || 0)),
      ],
    });

    const row = result.rows?.[0];
    return this.mapDraftRow(row);
  }

  /**
   * Analyze a draft for synthesis context
   */
  private analyzeDraft(response: string): {
    strengths: string[];
    weaknesses: string[];
    uniqueInsights: string[];
    factualClaims: FactualClaim[];
  } {
    const strengths: string[] = [];
    const weaknesses: string[] = [];
    const uniqueInsights: string[] = [];
    const factualClaims: FactualClaim[] = [];

    // Check for code blocks
    const codeBlocks = (response.match(/```[\s\S]*?```/g) || []).length;
    if (codeBlocks > 0) {
      strengths.push(`Contains ${codeBlocks} code example(s)`);
    }

    // Check for structured formatting
    if (response.includes('1.') || response.includes('- ')) {
      strengths.push('Well-structured with lists');
    }

    // Check response length
    if (response.length > 2000) {
      strengths.push('Comprehensive and detailed');
    } else if (response.length < 500) {
      weaknesses.push('May lack detail');
    }

    // Extract factual claims (simplified)
    const claimPatterns = [
      /(\d{4})\s+(?:was|is|were)/gi,
      /(?:is|are|was|were)\s+(\d+(?:\.\d+)?)\s*(?:%|percent|million|billion)/gi,
    ];

    for (const pattern of claimPatterns) {
      let match;
      while ((match = pattern.exec(response)) !== null) {
        factualClaims.push({
          claim: match[0],
          confidence: 0.8,
        });
      }
    }

    return { strengths, weaknesses, uniqueInsights, factualClaims };
  }

  /**
   * Build the synthesis prompt from drafts
   */
  buildSynthesisPrompt(
    originalPrompt: string,
    drafts: SynthesisDraft[]
  ): string {
    const draftSections = drafts.map((draft, i) => {
      const strengthsStr = draft.strengths?.length 
        ? `\nStrengths: ${draft.strengths.join(', ')}`
        : '';
      const weaknessesStr = draft.weaknesses?.length
        ? `\nWeaknesses: ${draft.weaknesses.join(', ')}`
        : '';

      return `
=== DRAFT ${i + 1} (${draft.modelId}) ===
${draft.responseText}
${strengthsStr}${weaknessesStr}
`;
    }).join('\n');

    return `
Original User Query:
${originalPrompt}

You have received ${drafts.length} draft responses from different AI models. Review them and synthesize a single, superior response.

${draftSections}

Now synthesize these drafts into a single, comprehensive response that combines their strengths and addresses their weaknesses. Output only the final synthesized response.`;
  }

  /**
   * Record synthesis result
   */
  async recordSynthesisResult(
    sessionId: string,
    finalResponse: string,
    reasoning: string,
    drafts: SynthesisDraft[],
    conflicts?: ConflictResolution[]
  ): Promise<SynthesisResult> {
    // Calculate contribution weights based on text similarity
    const weights = this.calculateContributionWeights(finalResponse, drafts);
    const primaryDraftId = Object.entries(weights).sort((a, b) => b[1] - a[1])[0]?.[0];

    const result = await executeStatement({
      sql: `
        INSERT INTO synthesis_results (
          session_id, final_response, synthesis_reasoning,
          primary_source_draft_id, contribution_weights,
          conflicts_found, conflicts_resolved
        ) VALUES (
          $1::uuid, $2, $3, $4::uuid, $5::jsonb, $6, $7::jsonb
        )
        RETURNING *
      `,
      parameters: [
        stringParam('sessionId', sessionId),
        stringParam('finalResponse', finalResponse),
        stringParam('reasoning', reasoning),
        stringParam('primaryDraftId', primaryDraftId || ''),
        stringParam('weights', JSON.stringify(weights)),
        stringParam('conflictsFound', String(conflicts?.length || 0)),
        stringParam('conflicts', JSON.stringify(conflicts || [])),
      ],
    });

    // Update session status
    await this.updateSessionStatus(sessionId, 'completed');

    const row = result.rows?.[0];
    return {
      id: row?.id,
      sessionId: row?.session_id,
      finalResponse: row?.final_response,
      synthesisReasoning: row?.synthesis_reasoning,
      primarySourceDraftId: row?.primary_source_draft_id,
      contributionWeights: row?.contribution_weights || {},
      conflictsFound: row?.conflicts_found || 0,
      conflictsResolved: row?.conflicts_resolved,
      createdAt: new Date(row?.created_at),
    };
  }

  /**
   * Calculate how much each draft contributed to final response
   */
  private calculateContributionWeights(
    finalResponse: string,
    drafts: SynthesisDraft[]
  ): Record<string, number> {
    const weights: Record<string, number> = {};
    const finalWords = new Set(finalResponse.toLowerCase().split(/\s+/));

    let totalOverlap = 0;
    const overlaps: Record<string, number> = {};

    for (const draft of drafts) {
      const draftWords = new Set(draft.responseText.toLowerCase().split(/\s+/));
      let overlap = 0;
      
      for (const word of draftWords) {
        if (finalWords.has(word) && word.length > 4) {
          overlap++;
        }
      }
      
      overlaps[draft.id] = overlap;
      totalOverlap += overlap;
    }

    // Normalize to percentages
    for (const [id, overlap] of Object.entries(overlaps)) {
      weights[id] = totalOverlap > 0 ? overlap / totalOverlap : 1 / drafts.length;
    }

    return weights;
  }

  /**
   * Update session status
   */
  async updateSessionStatus(
    sessionId: string,
    status: SynthesisStatus,
    tokens?: { input: number; output: number }
  ): Promise<void> {
    let updateSql = `
      UPDATE synthesis_sessions
      SET status = $1
    `;
    const params = [stringParam('status', status)];

    if (status === 'proposing') {
      updateSql += `, started_at = NOW()`;
    } else if (status === 'synthesizing') {
      updateSql += `, proposers_completed_at = NOW()`;
    } else if (status === 'completed' || status === 'failed') {
      updateSql += `, synthesis_completed_at = NOW()`;
    }

    if (tokens) {
      updateSql += `, total_input_tokens = $2, total_output_tokens = $3`;
      params.push(stringParam('inputTokens', String(tokens.input)));
      params.push(stringParam('outputTokens', String(tokens.output)));
    }

    updateSql += ` WHERE id = $${params.length + 1}::uuid`;
    params.push(stringParam('sessionId', sessionId));

    await executeStatement({ sql: updateSql, parameters: params });
  }

  /**
   * Get session with drafts
   */
  async getSession(sessionId: string): Promise<{
    session: SynthesisSession;
    drafts: SynthesisDraft[];
    result?: SynthesisResult;
  } | null> {
    const sessionResult = await executeStatement({
      sql: `SELECT * FROM synthesis_sessions WHERE id = $1::uuid`,
      parameters: [stringParam('sessionId', sessionId)],
    });

    if (!sessionResult.rows?.length) return null;

    const draftsResult = await executeStatement({
      sql: `SELECT * FROM synthesis_drafts WHERE session_id = $1::uuid ORDER BY draft_order`,
      parameters: [stringParam('sessionId', sessionId)],
    });

    const resultResult = await executeStatement({
      sql: `SELECT * FROM synthesis_results WHERE session_id = $1::uuid`,
      parameters: [stringParam('sessionId', sessionId)],
    });

    return {
      session: this.mapSessionRow(sessionResult.rows[0]),
      drafts: (draftsResult.rows || []).map(r => this.mapDraftRow(r)),
      result: resultResult.rows?.[0] ? {
        id: resultResult.rows[0].id,
        sessionId: resultResult.rows[0].session_id,
        finalResponse: resultResult.rows[0].final_response,
        synthesisReasoning: resultResult.rows[0].synthesis_reasoning,
        contributionWeights: resultResult.rows[0].contribution_weights || {},
        conflictsFound: resultResult.rows[0].conflicts_found || 0,
        createdAt: new Date(resultResult.rows[0].created_at),
      } : undefined,
    };
  }

  private mapSessionRow(row: Record<string, unknown>): SynthesisSession {
    return {
      id: row?.id as string,
      tenantId: row?.tenant_id as string,
      userId: row?.user_id as string,
      planId: row?.plan_id as string,
      promptText: row?.prompt_text as string,
      promptHash: row?.prompt_hash as string,
      synthesisMode: (row?.synthesis_mode || 'standard') as SynthesisMode,
      proposerModels: row?.proposer_models as string[] || [],
      proposerCount: row?.proposer_count as number || 3,
      synthesizerModel: row?.synthesizer_model as string,
      status: (row?.status || 'pending') as SynthesisStatus,
      startedAt: row?.started_at ? new Date(row.started_at as string) : undefined,
      proposersCompletedAt: row?.proposers_completed_at ? new Date(row.proposers_completed_at as string) : undefined,
      synthesisCompletedAt: row?.synthesis_completed_at ? new Date(row.synthesis_completed_at as string) : undefined,
      totalInputTokens: row?.total_input_tokens as number || 0,
      totalOutputTokens: row?.total_output_tokens as number || 0,
      estimatedCostCents: row?.estimated_cost_cents as number,
      createdAt: new Date(row?.created_at as string),
    };
  }

  private mapDraftRow(row: Record<string, unknown>): SynthesisDraft {
    return {
      id: row?.id as string,
      sessionId: row?.session_id as string,
      modelId: row?.model_id as string,
      provider: row?.provider as string,
      draftOrder: row?.draft_order as number,
      responseText: row?.response_text as string,
      responseTokens: row?.response_tokens as number,
      strengths: row?.strengths as string[],
      weaknesses: row?.weaknesses as string[],
      uniqueInsights: row?.unique_insights as string[],
      factualClaims: row?.factual_claims as FactualClaim[],
      latencyMs: row?.latency_ms as number,
      logprobAvg: row?.logprob_avg as number,
      createdAt: new Date(row?.created_at as string),
    };
  }

  getSynthesizerSystemPrompt(): string {
    return SYNTHESIZER_SYSTEM_PROMPT;
  }

  setConfig(config: Partial<MoAConfig>): void {
    this.config = { ...this.config, ...config };
  }

  getConfig(): MoAConfig {
    return { ...this.config };
  }

  isEnabled(): boolean {
    return this.config.enabled;
  }
}

export const moaSynthesisService = new MoASynthesisService();
