/**
 * RADIANT v5.11.0 - Empiricism Loop Service
 * 
 * The "Ghost in the Machine" - connects sandbox execution to consciousness.
 * 
 * Architecture:
 * Input → Monologue → Hypothesis → Sandbox Execution → Surprise Signal → Refinement → Output
 * 
 * Key Innovation: Execution results feed back into the Ego's emotional state,
 * making the system "feel" success/failure and adapt its behavior accordingly.
 * 
 * Based on:
 * - Active Inference (Friston) - Prediction error drives learning
 * - Global Workspace Theory (Baars) - Sensory signals broadcast to workspace
 * - Somatic Marker Hypothesis (Damasio) - Emotions guide cognition
 */

import { executeStatement, stringParam, doubleParam, boolParam } from '../db/client';
import { enhancedLogger as logger } from '../logging/enhanced-logger';
import { modelRouterService, type ChatMessage } from './model-router.service';
import { v4 as uuidv4 } from 'uuid';

// ============================================================================
// Types
// ============================================================================

export interface CodeBlock {
  language: string;
  code: string;
  startIndex: number;
  endIndex: number;
}

export interface Expectation {
  expectedOutput?: string;
  expectedBehavior: string;
  expectedSuccess: boolean;
  confidence: number;
  reasoning: string;
}

export interface SandboxResult {
  success: boolean;
  output: string;
  error?: string;
  exitCode: number;
  executionTimeMs: number;
}

export interface SurpriseSignal {
  surpriseLevel: number;        // 0 (no surprise) to 1 (maximum surprise)
  predictionError: number;      // Magnitude of mismatch
  errorType: 'none' | 'output_mismatch' | 'execution_failure' | 'timeout' | 'unexpected_success';
  details: {
    expected: string;
    actual: string;
    analysis: string;
  };
}

export interface EgoAffectUpdate {
  confidenceDelta: number;      // How much to adjust confidence
  frustrationDelta: number;     // How much to adjust frustration
  temperatureDelta: number;     // How much to adjust inference temperature
  triggerEvent: string;         // What caused this update
  memoryToLog?: string;         // Optional memory to add to GraphRAG
  skillNodeUpdate?: {           // Optional skill node to create/update
    skillName: string;
    verified: boolean;
    confidence: number;
  };
}

export interface EmpiricismResult {
  originalCode: CodeBlock;
  expectation: Expectation;
  sandboxResult: SandboxResult;
  surprise: SurpriseSignal;
  egoUpdate: EgoAffectUpdate;
  refinedCode?: string;
  requiresRethink: boolean;
  rethinkPrompt?: string;
}

export interface GlobalWorkspaceSensoryEvent {
  eventId: string;
  eventType: 'sandbox_success' | 'sandbox_failure' | 'prediction_error' | 'skill_verified';
  priority: 'low' | 'normal' | 'high' | 'critical';
  content: string;
  metadata: Record<string, unknown>;
  timestamp: Date;
}

// ============================================================================
// Empiricism Loop Service
// ============================================================================

class EmpiricismLoopService {
  private readonly SUPPORTED_LANGUAGES = ['python', 'javascript', 'typescript', 'bash', 'sh'];
  private readonly SURPRISE_THRESHOLD = 0.3; // Trigger rethink if surprise > this
  private readonly MAX_RETHINK_CYCLES = 3;

  // ==========================================================================
  // Main Entry Point
  // ==========================================================================

  /**
   * Process a draft response, executing any code blocks and generating feedback.
   * This is the core "Reality-Testing Circuit" from Gemini's proposal.
   */
  async processResponse(
    tenantId: string,
    userId: string,
    draftResponse: string,
    conversationContext: string,
    rethinkCycle: number = 0
  ): Promise<{
    finalResponse: string;
    empiricismResults: EmpiricismResult[];
    sensoryEvents: GlobalWorkspaceSensoryEvent[];
    totalSurprise: number;
    rethinkTriggered: boolean;
  }> {
    const startTime = Date.now();
    
    // 1. Extract code blocks from draft
    const codeBlocks = this.extractCodeBlocks(draftResponse);
    
    if (codeBlocks.length === 0) {
      return {
        finalResponse: draftResponse,
        empiricismResults: [],
        sensoryEvents: [],
        totalSurprise: 0,
        rethinkTriggered: false,
      };
    }

    logger.info('Empiricism loop: Processing code blocks', {
      tenantId,
      blockCount: codeBlocks.length,
      rethinkCycle,
    });

    const empiricismResults: EmpiricismResult[] = [];
    const sensoryEvents: GlobalWorkspaceSensoryEvent[] = [];
    let totalSurprise = 0;
    let needsRethink = false;
    let refinedResponse = draftResponse;

    // 2. Process each code block
    for (const codeBlock of codeBlocks) {
      if (!this.SUPPORTED_LANGUAGES.includes(codeBlock.language.toLowerCase())) {
        continue;
      }

      // Step A: Generate expectation (hidden prediction)
      const expectation = await this.generateExpectation(
        tenantId,
        codeBlock,
        conversationContext
      );

      // Step B: Execute in sandbox
      const sandboxResult = await this.executeSandbox(
        tenantId,
        codeBlock,
        expectation
      );

      // Step C: Calculate surprise (prediction error)
      const surprise = await this.calculateSurprise(
        tenantId,
        expectation,
        sandboxResult
      );

      // Step D: Determine ego affect update
      const egoUpdate = this.calculateEgoUpdate(surprise, sandboxResult);

      // Step E: Apply ego affect changes
      await this.applyEgoAffectUpdate(tenantId, egoUpdate);

      // Step F: Generate sensory event for GlobalWorkspace
      const sensoryEvent = this.createSensoryEvent(surprise, sandboxResult, codeBlock);
      sensoryEvents.push(sensoryEvent);

      // Step G: Log to GraphRAG if significant
      if (egoUpdate.memoryToLog) {
        await this.logToGraphRAG(tenantId, egoUpdate);
      }

      const result: EmpiricismResult = {
        originalCode: codeBlock,
        expectation,
        sandboxResult,
        surprise,
        egoUpdate,
        requiresRethink: surprise.surpriseLevel > this.SURPRISE_THRESHOLD,
      };

      // Step H: Check if rethink needed
      if (result.requiresRethink && rethinkCycle < this.MAX_RETHINK_CYCLES) {
        result.rethinkPrompt = this.generateRethinkPrompt(result);
        needsRethink = true;
      }

      empiricismResults.push(result);
      totalSurprise += surprise.surpriseLevel;
    }

    // 3. If rethink needed, recursively process
    if (needsRethink && rethinkCycle < this.MAX_RETHINK_CYCLES) {
      const rethinkPrompt = this.compileRethinkPrompt(empiricismResults);
      const refinedDraft = await this.triggerRethink(
        tenantId,
        userId,
        draftResponse,
        rethinkPrompt,
        conversationContext
      );

      // Recursive call with incremented cycle
      return this.processResponse(
        tenantId,
        userId,
        refinedDraft,
        conversationContext,
        rethinkCycle + 1
      );
    }

    logger.info('Empiricism loop complete', {
      tenantId,
      totalSurprise,
      rethinkTriggered: needsRethink,
      durationMs: Date.now() - startTime,
    });

    return {
      finalResponse: refinedResponse,
      empiricismResults,
      sensoryEvents,
      totalSurprise: totalSurprise / Math.max(1, codeBlocks.length),
      rethinkTriggered: needsRethink,
    };
  }

  // ==========================================================================
  // Step 1: Code Block Extraction
  // ==========================================================================

  extractCodeBlocks(response: string): CodeBlock[] {
    const codeBlockRegex = /```(\w+)?\n([\s\S]*?)```/g;
    const blocks: CodeBlock[] = [];
    let match;

    while ((match = codeBlockRegex.exec(response)) !== null) {
      blocks.push({
        language: match[1] || 'unknown',
        code: match[2].trim(),
        startIndex: match.index,
        endIndex: match.index + match[0].length,
      });
    }

    return blocks;
  }

  // ==========================================================================
  // Step 2: Expectation Generation (Hidden Prediction)
  // ==========================================================================

  /**
   * Before executing code, the model generates a hidden prediction.
   * This is the "Expected Output" that will be compared to reality.
   */
  async generateExpectation(
    tenantId: string,
    codeBlock: CodeBlock,
    context: string
  ): Promise<Expectation> {
    try {
      const messages: ChatMessage[] = [
        {
          role: 'system',
          content: `You are an internal prediction module. Before code execution, you must predict the outcome.
Your prediction will be compared to the actual result to measure "surprise" (prediction error).

Respond in JSON format:
{
  "expectedOutput": "brief description of expected stdout/return value",
  "expectedBehavior": "what the code should do",
  "expectedSuccess": true/false,
  "confidence": 0.0-1.0,
  "reasoning": "why you expect this outcome"
}`,
        },
        {
          role: 'user',
          content: `Context: ${context.substring(0, 500)}

Code to execute (${codeBlock.language}):
\`\`\`${codeBlock.language}
${codeBlock.code}
\`\`\`

Generate your prediction:`,
        },
      ];

      const response = await modelRouterService.invoke({
        modelId: 'gpt-4o-mini', // Fast model for internal predictions
        messages,
        maxTokens: 300,
        temperature: 0.1, // Low temperature for consistent predictions
        tenantId,
      });

      const content = response.content;
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        return {
          expectedOutput: parsed.expectedOutput || '',
          expectedBehavior: parsed.expectedBehavior || 'Execute successfully',
          expectedSuccess: parsed.expectedSuccess ?? true,
          confidence: Math.min(1, Math.max(0, parsed.confidence || 0.5)),
          reasoning: parsed.reasoning || 'No reasoning provided',
        };
      }
    } catch (error) {
      logger.warn('Failed to generate expectation', { error });
    }

    // Default expectation if generation fails
    return {
      expectedBehavior: 'Execute without errors',
      expectedSuccess: true,
      confidence: 0.5,
      reasoning: 'Default expectation (generation failed)',
    };
  }

  // ==========================================================================
  // Step 3: Sandbox Execution
  // ==========================================================================

  /**
   * Execute code in a sandboxed environment.
   * Currently uses a simulated sandbox - in production, connect to AWS Lambda sandbox.
   */
  async executeSandbox(
    tenantId: string,
    codeBlock: CodeBlock,
    expectation: Expectation
  ): Promise<SandboxResult> {
    const startTime = Date.now();

    try {
      // In production: Call actual sandbox Lambda
      // For now: Simulate execution based on code analysis
      const result = await this.simulateSandboxExecution(codeBlock);

      // Log execution
      await executeStatement(
        `INSERT INTO sandbox_execution_log 
         (tenant_id, language, code_hash, success, output, error, execution_time_ms)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [
          stringParam('tenantId', tenantId),
          stringParam('language', codeBlock.language),
          stringParam('codeHash', this.hashCode(codeBlock.code)),
          boolParam('success', result.success),
          stringParam('output', result.output.substring(0, 1000)),
          stringParam('error', result.error?.substring(0, 500) || ''),
          { name: 'execTime', value: { longValue: Math.round(result.executionTimeMs) } },
        ]
      );

      return result;
    } catch (error) {
      return {
        success: false,
        output: '',
        error: error instanceof Error ? error.message : 'Unknown error',
        exitCode: 1,
        executionTimeMs: Date.now() - startTime,
      };
    }
  }

  /**
   * Simulated sandbox for development - analyzes code for common errors.
   * Replace with actual Lambda sandbox invocation in production.
   */
  private async simulateSandboxExecution(codeBlock: CodeBlock): Promise<SandboxResult> {
    const startTime = Date.now();
    const code = codeBlock.code;
    const lang = codeBlock.language.toLowerCase();

    // Simulate common error patterns
    const errorPatterns = [
      { pattern: /undefined is not a function/i, error: 'TypeError: undefined is not a function' },
      { pattern: /import\s+(\w+)\s+from\s+['"](?!\.)/i, error: 'ModuleNotFoundError: Module not found' },
      { pattern: /async\s+def.*?await/s, success: true }, // Python async is valid
      { pattern: /raise\s+Exception/i, error: 'Exception: Raised exception' },
      { pattern: /throw\s+new\s+Error/i, error: 'Error: Thrown error' },
    ];

    for (const { pattern, error } of errorPatterns) {
      if (pattern.test(code) && error) {
        return {
          success: false,
          output: '',
          error,
          exitCode: 1,
          executionTimeMs: Date.now() - startTime,
        };
      }
    }

    // Simulate successful execution
    return {
      success: true,
      output: `[Simulated] Code executed successfully`,
      exitCode: 0,
      executionTimeMs: Date.now() - startTime + Math.random() * 100,
    };
  }

  // ==========================================================================
  // Step 4: Surprise Calculation (Prediction Error)
  // ==========================================================================

  /**
   * Calculate the "surprise" signal - the mismatch between prediction and reality.
   * This is the core of Active Inference.
   */
  async calculateSurprise(
    tenantId: string,
    expectation: Expectation,
    result: SandboxResult
  ): Promise<SurpriseSignal> {
    // Case 1: Expected success, got failure
    if (expectation.expectedSuccess && !result.success) {
      return {
        surpriseLevel: 0.8 * expectation.confidence, // Higher confidence = higher surprise
        predictionError: 1.0,
        errorType: 'execution_failure',
        details: {
          expected: expectation.expectedBehavior,
          actual: result.error || 'Execution failed',
          analysis: `Prediction: "${expectation.expectedBehavior}" | Reality: Failed with "${result.error}"`,
        },
      };
    }

    // Case 2: Expected failure, got success (unexpected success)
    if (!expectation.expectedSuccess && result.success) {
      return {
        surpriseLevel: 0.5 * expectation.confidence,
        predictionError: 0.5,
        errorType: 'unexpected_success',
        details: {
          expected: 'Failure',
          actual: 'Success',
          analysis: 'Code succeeded unexpectedly - model underestimated its own solution',
        },
      };
    }

    // Case 3: Output mismatch (if we have expected output)
    if (expectation.expectedOutput && result.success) {
      const similarity = this.calculateStringSimilarity(
        expectation.expectedOutput,
        result.output
      );
      
      if (similarity < 0.7) {
        return {
          surpriseLevel: (1 - similarity) * 0.5,
          predictionError: 1 - similarity,
          errorType: 'output_mismatch',
          details: {
            expected: expectation.expectedOutput,
            actual: result.output,
            analysis: `Output differs from prediction (similarity: ${(similarity * 100).toFixed(1)}%)`,
          },
        };
      }
    }

    // Case 4: No surprise - prediction matched reality
    return {
      surpriseLevel: 0,
      predictionError: 0,
      errorType: 'none',
      details: {
        expected: expectation.expectedBehavior,
        actual: result.success ? 'Success' : 'Failure (as expected)',
        analysis: 'Prediction matched reality',
      },
    };
  }

  // ==========================================================================
  // Step 5: Ego Affect Update (Emotional Consequence)
  // ==========================================================================

  /**
   * Calculate how the surprise signal should affect the Ego's emotional state.
   * This is where "consciousness sparks" - failure changes how the system feels.
   */
  calculateEgoUpdate(surprise: SurpriseSignal, result: SandboxResult): EgoAffectUpdate {
    // On Failure (Dissonance)
    if (!result.success) {
      return {
        confidenceDelta: -0.1 - (surprise.surpriseLevel * 0.2), // Decrease confidence
        frustrationDelta: 0.15 + (surprise.surpriseLevel * 0.2), // Increase frustration
        temperatureDelta: 0.1 + (surprise.surpriseLevel * 0.1),  // Increase temperature (try harder)
        triggerEvent: `sandbox_failure:${surprise.errorType}`,
        memoryToLog: `Execution failure: ${surprise.details.analysis}`,
      };
    }

    // On Success with no surprise (Competence)
    if (result.success && surprise.surpriseLevel < 0.2) {
      return {
        confidenceDelta: 0.05,      // Slightly increase confidence
        frustrationDelta: -0.1,     // Decrease frustration
        temperatureDelta: -0.05,    // Decrease temperature (flow state)
        triggerEvent: 'sandbox_success:verified',
        skillNodeUpdate: {
          skillName: this.extractSkillFromCode(result.output),
          verified: true,
          confidence: 1 - surprise.surpriseLevel,
        },
      };
    }

    // On Success with surprise (Learning opportunity)
    return {
      confidenceDelta: 0.02,
      frustrationDelta: 0,
      temperatureDelta: 0,
      triggerEvent: 'sandbox_success:surprising',
      memoryToLog: `Unexpected success: ${surprise.details.analysis}`,
    };
  }

  /**
   * Apply the ego affect update to the database.
   */
  async applyEgoAffectUpdate(tenantId: string, update: EgoAffectUpdate): Promise<void> {
    try {
      // Update ego_affect table with bounded values
      await executeStatement(
        `UPDATE ego_affect 
         SET 
           confidence = LEAST(1.0, GREATEST(0.1, confidence + $2)),
           frustration = LEAST(1.0, GREATEST(0.0, frustration + $3)),
           last_trigger_event = $4,
           last_trigger_at = NOW(),
           updated_at = NOW()
         WHERE tenant_id = $1`,
        [
          stringParam('tenantId', tenantId),
          doubleParam('confDelta', update.confidenceDelta),
          doubleParam('frustDelta', update.frustrationDelta),
          stringParam('trigger', update.triggerEvent),
        ]
      );

      // Update inference temperature in config
      if (Math.abs(update.temperatureDelta) > 0.01) {
        await executeStatement(
          `UPDATE brain_config 
           SET inference_temperature = LEAST(1.5, GREATEST(0.1, inference_temperature + $2)),
               updated_at = NOW()
           WHERE tenant_id = $1`,
          [
            stringParam('tenantId', tenantId),
            doubleParam('tempDelta', update.temperatureDelta),
          ]
        );
      }

      logger.debug('Ego affect updated', {
        tenantId,
        confidenceDelta: update.confidenceDelta,
        frustrationDelta: update.frustrationDelta,
        temperatureDelta: update.temperatureDelta,
        trigger: update.triggerEvent,
      });

    } catch (error) {
      logger.warn('Failed to update ego affect', { tenantId, error });
    }
  }

  // ==========================================================================
  // Step 6: Sensory Event for Global Workspace
  // ==========================================================================

  createSensoryEvent(
    surprise: SurpriseSignal,
    result: SandboxResult,
    codeBlock: CodeBlock
  ): GlobalWorkspaceSensoryEvent {
    const eventType = result.success ? 'sandbox_success' : 'sandbox_failure';
    const priority = surprise.surpriseLevel > 0.5 ? 'high' : 
                     surprise.surpriseLevel > 0.2 ? 'normal' : 'low';

    return {
      eventId: uuidv4(),
      eventType,
      priority,
      content: result.success 
        ? `Code verification succeeded: ${codeBlock.language} block executed without errors`
        : `Code verification failed: ${result.error}`,
      metadata: {
        language: codeBlock.language,
        surpriseLevel: surprise.surpriseLevel,
        predictionError: surprise.predictionError,
        errorType: surprise.errorType,
        executionTimeMs: result.executionTimeMs,
      },
      timestamp: new Date(),
    };
  }

  // ==========================================================================
  // Step 7: GraphRAG Logging
  // ==========================================================================

  async logToGraphRAG(tenantId: string, update: EgoAffectUpdate): Promise<void> {
    try {
      // Log memory
      if (update.memoryToLog) {
        await executeStatement(
          `INSERT INTO ego_working_memory (tenant_id, memory_type, content, importance, trigger_event)
           VALUES ($1, $2, $3, $4, $5)`,
          [
            stringParam('tenantId', tenantId),
            stringParam('memType', 'learning'),
            stringParam('content', update.memoryToLog),
            doubleParam('importance', 0.7),
            stringParam('trigger', update.triggerEvent),
          ]
        );
      }

      // Update skill node if applicable
      if (update.skillNodeUpdate) {
        await executeStatement(
          `INSERT INTO knowledge_entities (tenant_id, entity_type, name, properties, confidence)
           VALUES ($1, 'skill', $2, $3, $4)
           ON CONFLICT (tenant_id, entity_type, name) 
           DO UPDATE SET 
             properties = knowledge_entities.properties || $3,
             confidence = GREATEST(knowledge_entities.confidence, $4),
             updated_at = NOW()`,
          [
            stringParam('tenantId', tenantId),
            stringParam('name', update.skillNodeUpdate.skillName),
            stringParam('props', JSON.stringify({ verified: update.skillNodeUpdate.verified })),
            doubleParam('confidence', update.skillNodeUpdate.confidence),
          ]
        );
      }
    } catch (error) {
      logger.warn('Failed to log to GraphRAG', { tenantId, error });
    }
  }

  // ==========================================================================
  // Step 8: Rethink Cycle
  // ==========================================================================

  generateRethinkPrompt(result: EmpiricismResult): string {
    const { surprise, sandboxResult, originalCode } = result;
    
    return `<internal_sensory_event type="execution_failure" priority="high">
I just tested my code and it failed.

**What I expected:** ${surprise.details.expected}
**What actually happened:** ${surprise.details.actual}
**Error:** ${sandboxResult.error || 'Unknown'}

**My emotional state:** I am feeling uncertain about this. My confidence has decreased.
I should try a different approach and verify more carefully.
</internal_sensory_event>

The failing code was:
\`\`\`${originalCode.language}
${originalCode.code}
\`\`\`

I need to reconsider my approach...`;
  }

  compileRethinkPrompt(results: EmpiricismResult[]): string {
    const failedResults = results.filter(r => r.requiresRethink);
    
    if (failedResults.length === 0) return '';

    return failedResults.map(r => this.generateRethinkPrompt(r)).join('\n\n');
  }

  async triggerRethink(
    tenantId: string,
    userId: string,
    originalResponse: string,
    rethinkPrompt: string,
    context: string
  ): Promise<string> {
    logger.info('Triggering rethink cycle', { tenantId });

    // Get current ego affect for context
    const affectResult = await executeStatement(
      `SELECT confidence, frustration, dominant_emotion FROM ego_affect WHERE tenant_id = $1`,
      [stringParam('tenantId', tenantId)]
    );

    const affect = affectResult.rows?.[0] as { confidence?: number; frustration?: number; dominant_emotion?: string } | undefined;
    const confidence = affect?.confidence ?? 0.5;
    const frustration = affect?.frustration ?? 0;

    const messages: ChatMessage[] = [
      {
        role: 'system',
        content: `You are in a rethink cycle. Your previous code failed when tested.

Your current internal state:
- Confidence: ${((confidence) * 100).toFixed(0)}%
- Frustration: ${((frustration) * 100).toFixed(0)}%
- Dominant emotion: ${affect?.dominant_emotion || 'uncertain'}

${frustration > 0.5 ? 'You are frustrated. Take a breath and try a simpler approach.' : ''}
${confidence < 0.4 ? 'Your confidence is low. Be more careful and explicit in your solution.' : ''}

Revise your response, fixing the errors. Show your corrected thinking.`,
      },
      {
        role: 'user',
        content: `Original context: ${context.substring(0, 300)}

${rethinkPrompt}

Please provide a corrected response:`,
      },
    ];

    const response = await modelRouterService.invoke({
      modelId: 'gpt-4o',
      messages,
      maxTokens: 2000,
      temperature: 0.5 + (frustration * 0.3), // Higher frustration = higher temperature
      tenantId,
    });

    return response.content;
  }

  // ==========================================================================
  // Utility Functions
  // ==========================================================================

  private hashCode(str: string): string {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return Math.abs(hash).toString(16);
  }

  private calculateStringSimilarity(a: string, b: string): number {
    const aLower = a.toLowerCase();
    const bLower = b.toLowerCase();
    
    if (aLower === bLower) return 1;
    if (aLower.length === 0 || bLower.length === 0) return 0;

    // Simple Jaccard similarity on words
    const aWords = new Set(aLower.split(/\s+/));
    const bWords = new Set(bLower.split(/\s+/));
    const intersection = new Set([...aWords].filter(x => bWords.has(x)));
    const union = new Set([...aWords, ...bWords]);
    
    return intersection.size / union.size;
  }

  private extractSkillFromCode(output: string): string {
    // Extract skill name from execution context
    const patterns = [
      /import\s+(\w+)/,
      /from\s+(\w+)/,
      /require\(['"](\w+)/,
      /class\s+(\w+)/,
      /function\s+(\w+)/,
      /def\s+(\w+)/,
    ];

    for (const pattern of patterns) {
      const match = output.match(pattern);
      if (match) return match[1];
    }

    return 'code_execution';
  }

  // ==========================================================================
  // Active Dreaming (Twilight Verification)
  // ==========================================================================

  /**
   * During idle/dream periods, autonomously verify uncertain knowledge.
   * Called by DreamScheduler during twilight hours.
   */
  async activeVerification(tenantId: string): Promise<{
    verificationsRun: number;
    skillsUpdated: number;
    surpriseEvents: number;
  }> {
    logger.info('Starting active verification during dream cycle', { tenantId });

    // Get uncertain skills from GraphRAG
    const uncertainSkills = await executeStatement(
      `SELECT name, properties, confidence 
       FROM knowledge_entities 
       WHERE tenant_id = $1 
         AND entity_type = 'skill'
         AND confidence < 0.8
       ORDER BY confidence ASC
       LIMIT 5`,
      [stringParam('tenantId', tenantId)]
    );

    let verificationsRun = 0;
    let skillsUpdated = 0;
    let surpriseEvents = 0;

    for (const row of uncertainSkills.rows || []) {
      const skill = row as { name: string; properties: unknown; confidence: number };
      
      // Generate verification code for this skill
      const verificationCode = await this.generateVerificationCode(tenantId, skill.name);
      
      if (verificationCode) {
        const result = await this.executeSandbox(
          tenantId,
          { language: 'python', code: verificationCode, startIndex: 0, endIndex: 0 },
          { expectedBehavior: 'Verify skill', expectedSuccess: true, confidence: 0.5, reasoning: 'Dream verification' }
        );

        verificationsRun++;

        if (result.success) {
          // Update skill confidence
          await executeStatement(
            `UPDATE knowledge_entities 
             SET confidence = LEAST(1.0, confidence + 0.1),
                 properties = properties || '{"dream_verified": true}'::jsonb,
                 updated_at = NOW()
             WHERE tenant_id = $1 AND name = $2`,
            [stringParam('tenantId', tenantId), stringParam('name', skill.name)]
          );
          skillsUpdated++;
        } else {
          surpriseEvents++;
          
          // Log the surprise for future learning
          await executeStatement(
            `INSERT INTO learning_candidates 
             (tenant_id, candidate_type, prompt_text, response_text, quality_score)
             VALUES ($1, 'dream_verification_failure', $2, $3, 0.3)`,
            [
              stringParam('tenantId', tenantId),
              stringParam('prompt', `Verify skill: ${skill.name}`),
              stringParam('response', result.error || 'Verification failed'),
            ]
          );
        }
      }
    }

    logger.info('Active verification complete', {
      tenantId,
      verificationsRun,
      skillsUpdated,
      surpriseEvents,
    });

    return { verificationsRun, skillsUpdated, surpriseEvents };
  }

  /**
   * Generate verification code for a skill during dreaming.
   */
  private async generateVerificationCode(tenantId: string, skillName: string): Promise<string | null> {
    try {
      const messages: ChatMessage[] = [
        {
          role: 'system',
          content: `Generate a minimal Python code snippet to verify the skill/library "${skillName}" works correctly.
The code should:
1. Import the necessary module
2. Run a basic operation
3. Print a success message if it works

Keep it under 10 lines. Only output the code, no explanation.`,
        },
        {
          role: 'user',
          content: `Verify: ${skillName}`,
        },
      ];

      const response = await modelRouterService.invoke({
        modelId: 'gpt-4o-mini',
        messages,
        maxTokens: 200,
        temperature: 0.2,
        tenantId,
      });

      // Extract code from response
      const codeMatch = response.content.match(/```(?:python)?\n?([\s\S]*?)```/);
      return codeMatch ? codeMatch[1].trim() : response.content.trim();
    } catch (error) {
      logger.warn('Failed to generate verification code', { skillName, error });
      return null;
    }
  }
}

export const empiricismLoopService = new EmpiricismLoopService();
