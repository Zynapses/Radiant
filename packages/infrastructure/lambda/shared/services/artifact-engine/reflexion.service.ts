// ============================================================================
// RADIANT Artifact Engine - Reflexion Service
// packages/infrastructure/lambda/shared/services/artifact-engine/reflexion.service.ts
// Version: 4.19.0
// ============================================================================

import { query } from '../../db/pool-manager';
import { callLiteLLM } from '../litellm.service';
import {
  ReflexionContext,
  ReflexionResult,
  ArtifactValidationResult,
} from './types';

export class ReflexionService {
  /**
   * Attempt to fix validation errors in generated code
   */
  async attemptFix(
    context: ReflexionContext,
    sessionId: string
  ): Promise<ReflexionResult> {
    const fixPrompt = this.buildFixPrompt(context);

    try {
      const response = await callLiteLLM({
        model: 'anthropic/claude-sonnet-4-20250514',
        messages: [
          {
            role: 'system',
            content: `You are a code repair assistant. Fix the validation errors in the React/TypeScript code.
            
RULES:
1. Fix ONLY the specific errors mentioned
2. Preserve all working functionality
3. Output ONLY the fixed code wrapped in a tsx code block
4. Do not add explanations outside the code block`,
          },
          { role: 'user', content: fixPrompt },
        ],
        temperature: 0.2,
        max_tokens: 8000,
      });

      const fixedCode = this.extractCode(response.content);

      // Log the fix attempt
      await query(
        `INSERT INTO artifact_generation_logs (session_id, log_type, message, metadata)
         VALUES ($1, 'reflexion', $2, $3)`,
        [
          sessionId,
          `Attempt ${context.attempt}: Generated fix for ${context.errors.length} errors`,
          JSON.stringify({ errors: context.errors, attempt: context.attempt }),
        ]
      );

      // Update session reflexion count
      await query(
        `UPDATE artifact_generation_sessions
         SET reflexion_attempts = $2, updated_at = NOW()
         WHERE id = $1`,
        [sessionId, context.attempt]
      );

      return {
        success: true,
        fixedCode,
        explanation: `Fixed ${context.errors.length} validation errors on attempt ${context.attempt}`,
      };
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      return {
        success: false,
        fixedCode: context.originalCode,
        explanation: `Fix attempt failed: ${errorMessage}`,
      };
    }
  }

  /**
   * Build the fix prompt with error context
   */
  private buildFixPrompt(context: ReflexionContext): string {
    let prompt = `The following React/TypeScript code has validation errors that must be fixed:

\`\`\`tsx
${context.originalCode}
\`\`\`

VALIDATION ERRORS:
${context.errors.map((e, i) => `${i + 1}. ${e}`).join('\n')}

`;

    if (context.previousAttempts.length > 0) {
      prompt += `
PREVIOUS FIX ATTEMPTS (avoid these mistakes):
${context.previousAttempts
  .map(
    (attempt, i) => `
Attempt ${i + 1} errors: ${attempt.errors.join(', ')}`
  )
  .join('\n')}

`;
    }

    prompt += `
Fix these specific issues and return the complete corrected code.
Do NOT change functionality that is not related to the errors.
Output ONLY the fixed code in a tsx code block.`;

    return prompt;
  }

  /**
   * Extract code from LLM response
   */
  private extractCode(content: string): string {
    const codeBlockMatch = content.match(/```(?:tsx?|jsx?|typescript|javascript)?\s*([\s\S]*?)```/);
    if (codeBlockMatch) {
      return codeBlockMatch[1].trim();
    }
    return content.trim();
  }

  /**
   * Determine if we should escalate to human review
   */
  shouldEscalate(attempt: number, maxAttempts: number): boolean {
    return attempt >= maxAttempts;
  }

  /**
   * Escalate to human review queue
   */
  async escalateToHuman(
    sessionId: string,
    context: ReflexionContext,
    validation: ArtifactValidationResult
  ): Promise<void> {
    // Log the escalation
    await query(
      `INSERT INTO artifact_generation_logs (session_id, log_type, message, metadata)
       VALUES ($1, 'error', $2, $3)`,
      [
        sessionId,
        `Escalated to human review after ${context.maxAttempts} failed attempts`,
        JSON.stringify({
          errors: context.errors,
          attempts: context.attempt,
          failedCBFs: validation.failedCBFs,
        }),
      ]
    );

    // Create human escalation record if cato_human_escalations table exists
    try {
      const sessionResult = await query(
        `SELECT tenant_id FROM artifact_generation_sessions WHERE id = $1`,
        [sessionId]
      );

      if (sessionResult.rows.length > 0) {
        await query(
          `INSERT INTO cato_human_escalations (
             tenant_id, session_id, escalation_reason, recovery_attempts, status
           ) VALUES ($1, $2, $3, $4, 'PENDING')
           ON CONFLICT DO NOTHING`,
          [
            sessionResult.rows[0].tenant_id,
            sessionId,
            `Artifact validation failed: ${validation.failedCBFs.join(', ')}`,
            context.attempt,
          ]
        );
      }
    } catch {
      // Table may not exist, skip escalation record
    }
  }

  /**
   * Get reflexion history for a session
   */
  async getReflexionHistory(
    sessionId: string
  ): Promise<Array<{ attempt: number; errors: string[]; timestamp: Date }>> {
    const result = await query<{
      metadata: { errors: string[]; attempt: number };
      created_at: Date;
    }>(
      `SELECT metadata, created_at
       FROM artifact_generation_logs
       WHERE session_id = $1 AND log_type = 'reflexion'
       ORDER BY created_at ASC`,
      [sessionId]
    );

    return result.rows.map((row) => ({
      attempt: row.metadata.attempt,
      errors: row.metadata.errors,
      timestamp: row.created_at,
    }));
  }
}

export const reflexionService = new ReflexionService();
