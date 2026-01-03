// ============================================================================
// RADIANT Artifact Engine - Code Generator Service
// packages/infrastructure/lambda/shared/services/artifact-engine/code-generator.ts
// Version: 4.19.0
// ============================================================================

import { query } from '../../db/pool-manager';
import { callLiteLLM, litellmClient } from '../litellm.service';
import {
  ArtifactGenerationPlan,
  ArtifactGenerationRequest,
  StreamingChunk,
  ArtifactCodePatternRow,
  ArtifactDependencyAllowlistRow,
} from './types';

export class CodeGeneratorService {
  /**
   * Generate complete artifact code (non-streaming)
   */
  async generateComplete(
    sessionId: string,
    plan: ArtifactGenerationPlan,
    request: ArtifactGenerationRequest
  ): Promise<string> {
    const systemPrompt = await this.buildSystemPrompt(plan, request.tenantId);
    const userPrompt = this.buildUserPrompt(request.prompt, plan);

    const response = await callLiteLLM({
      model: plan.suggestedModel,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      temperature: 0.3,
      max_tokens: 8000,
    });

    const code = this.extractCode(response.content);

    // Update session with generated code and token count
    const tokensUsed = response.usage?.total_tokens || 0;
    await query(
      `UPDATE artifact_generation_sessions
       SET final_code = $2, tokens_generated = $3, updated_at = NOW()
       WHERE id = $1`,
      [sessionId, code, tokensUsed]
    );

    return code;
  }

  /**
   * Generate artifact code with streaming
   * Note: Currently uses non-streaming generation and simulates chunked delivery
   */
  async *generateWithStreaming(
    sessionId: string,
    plan: ArtifactGenerationPlan,
    request: ArtifactGenerationRequest
  ): AsyncGenerator<StreamingChunk> {
    // Generate complete code first
    const code = await this.generateComplete(sessionId, plan, request);

    // Simulate streaming by yielding chunks
    const chunkSize = 100;
    let chunkIndex = 0;

    for (let i = 0; i < code.length; i += chunkSize) {
      const chunk = code.slice(i, i + chunkSize);
      yield {
        sessionId,
        chunkIndex: chunkIndex++,
        content: chunk,
        isComplete: false,
        totalTokensSoFar: Math.floor(i / 4), // Approximate tokens
      };
    }

    // Final chunk
    yield {
      sessionId,
      chunkIndex,
      content: '',
      isComplete: true,
      totalTokensSoFar: Math.floor(code.length / 4),
    };
  }

  /**
   * Build system prompt with context and constraints
   */
  private async buildSystemPrompt(
    plan: ArtifactGenerationPlan,
    tenantId: string
  ): Promise<string> {
    // Get allowed dependencies
    const allowedDeps = await this.getAllowedDependencies(tenantId);

    // Get reference pattern if available
    let referenceCode = '';
    if (plan.similarPatterns.length > 0) {
      const patternResult = await query<ArtifactCodePatternRow>(
        `SELECT template_code FROM artifact_code_patterns WHERE id = $1`,
        [plan.similarPatterns[0].patternId]
      );
      if (patternResult.rows.length > 0) {
        referenceCode = `

REFERENCE PATTERN (use as style guide):
\`\`\`tsx
${patternResult.rows[0].template_code.substring(0, 2000)}
\`\`\``;
      }
    }

    return `You are a React/TypeScript code generator for RADIANT Think Tank.

TASK: Generate a complete, self-contained React component based on the user's request.

CONSTRAINTS:
1. Output ONLY valid TypeScript/React code
2. Use ONLY these allowed imports: ${allowedDeps.join(', ')}
3. Export a default function component
4. Use Tailwind CSS for all styling
5. Include proper TypeScript types
6. Keep code under 500 lines
7. DO NOT use: eval(), new Function(), document.write, innerHTML assignment
8. DO NOT fetch external URLs or access localStorage/sessionStorage
9. Make the component self-contained with sample data if needed

ARTIFACT TYPE: ${plan.intent}
COMPLEXITY: ${plan.complexity}
SUGGESTED DEPENDENCIES: ${plan.dependencies.join(', ')}
${referenceCode}

OUTPUT FORMAT:
Return ONLY the code wrapped in a single tsx code block. No explanations.`;
  }

  /**
   * Build user prompt with request details
   */
  private buildUserPrompt(prompt: string, plan: ArtifactGenerationPlan): string {
    return `Create a ${plan.intent} component:

USER REQUEST: ${prompt}

EXECUTION STEPS:
${plan.steps.map((step, i) => `${i + 1}. ${step}`).join('\n')}

Generate the complete React/TypeScript code now.`;
  }

  /**
   * Get allowed dependencies for tenant
   */
  private async getAllowedDependencies(tenantId: string): Promise<string[]> {
    const result = await query<ArtifactDependencyAllowlistRow>(
      `SELECT package_name FROM artifact_dependency_allowlist
       WHERE is_active = TRUE AND (tenant_id IS NULL OR tenant_id = $1)`,
      [tenantId]
    );
    return result.rows.map((row) => row.package_name);
  }

  /**
   * Extract code from LLM response
   */
  private extractCode(content: string): string {
    // Try to extract from code block
    const codeBlockMatch = content.match(/```(?:tsx?|jsx?|typescript|javascript)?\s*([\s\S]*?)```/);
    if (codeBlockMatch) {
      return codeBlockMatch[1].trim();
    }

    // If no code block, assume entire content is code
    return content.trim();
  }
}

export const codeGeneratorService = new CodeGeneratorService();
