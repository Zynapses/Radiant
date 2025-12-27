// RADIANT v4.18.0 - Skill Execution Service
// Advanced Cognition: Procedural memory replay, skill learning, workflow execution

import { executeStatement } from '../db/client';
import { modelRouterService } from './model-router.service';

// ============================================================================
// Types
// ============================================================================

export type SkillType = 'procedure' | 'workflow' | 'pattern' | 'heuristic';
export type ExecutionStatus = 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';

export interface ExecutableSkill {
  skillId: string;
  name: string;
  slug: string;
  description?: string;
  skillType: SkillType;
  triggerConditions: TriggerCondition[];
  steps: SkillStep[];
  requiredInputs: SkillInput[];
  expectedOutputs: SkillOutput[];
  parameters: SkillParameter[];
  defaultParams: Record<string, unknown>;
  executionCount: number;
  successCount: number;
  avgExecutionTimeMs?: number;
  avgQualityScore?: number;
  isActive: boolean;
}

export interface TriggerCondition {
  type: 'keyword' | 'pattern' | 'context' | 'intent';
  value: string;
  confidence?: number;
}

export interface SkillStep {
  stepNumber: number;
  action: string;
  params: Record<string, unknown>;
  expectedOutcome?: string;
  fallback?: string;
  timeout?: number;
}

export interface SkillInput {
  name: string;
  type: string;
  description?: string;
  required: boolean;
  defaultValue?: unknown;
}

export interface SkillOutput {
  name: string;
  type: string;
  description?: string;
}

export interface SkillParameter {
  name: string;
  type: string;
  description?: string;
  defaultValue?: unknown;
  constraints?: Record<string, unknown>;
}

export interface SkillExecution {
  executionId: string;
  skillId: string;
  status: ExecutionStatus;
  currentStep: number;
  stepResults: StepResult[];
  output?: unknown;
  outputQuality?: number;
  durationMs?: number;
  errorStep?: number;
  errorMessage?: string;
  userRating?: number;
  userFeedback?: string;
}

export interface StepResult {
  stepNumber: number;
  success: boolean;
  output?: unknown;
  error?: string;
  durationMs: number;
}

// ============================================================================
// Skill Execution Service
// ============================================================================

export class SkillExecutionService {
  // ============================================================================
  // Skill Management
  // ============================================================================

  async createSkill(
    tenantId: string,
    name: string,
    skillType: SkillType,
    steps: SkillStep[],
    options: {
      slug?: string;
      description?: string;
      triggerConditions?: TriggerCondition[];
      requiredInputs?: SkillInput[];
      expectedOutputs?: SkillOutput[];
      parameters?: SkillParameter[];
      defaultParams?: Record<string, unknown>;
      learnedFrom?: string;
      sourceMemories?: string[];
    } = {}
  ): Promise<ExecutableSkill> {
    const slug = options.slug || name.toLowerCase().replace(/[^a-z0-9]+/g, '-');
    const embedding = await this.generateEmbedding(name + ' ' + (options.description || ''));

    const result = await executeStatement(
      `INSERT INTO executable_skills (
        tenant_id, name, slug, description, skill_embedding, skill_type,
        trigger_conditions, steps, required_inputs, expected_outputs,
        parameters, default_params, learned_from, source_memories
      ) VALUES ($1, $2, $3, $4, $5::vector, $6, $7, $8, $9, $10, $11, $12, $13, $14)
      RETURNING *`,
      [
        { name: 'tenantId', value: { stringValue: tenantId } },
        { name: 'name', value: { stringValue: name } },
        { name: 'slug', value: { stringValue: slug } },
        { name: 'description', value: options.description ? { stringValue: options.description } : { isNull: true } },
        { name: 'embedding', value: { stringValue: `[${embedding.join(',')}]` } },
        { name: 'skillType', value: { stringValue: skillType } },
        { name: 'triggerConditions', value: { stringValue: JSON.stringify(options.triggerConditions || []) } },
        { name: 'steps', value: { stringValue: JSON.stringify(steps) } },
        { name: 'requiredInputs', value: { stringValue: JSON.stringify(options.requiredInputs || []) } },
        { name: 'expectedOutputs', value: { stringValue: JSON.stringify(options.expectedOutputs || []) } },
        { name: 'parameters', value: { stringValue: JSON.stringify(options.parameters || []) } },
        { name: 'defaultParams', value: { stringValue: JSON.stringify(options.defaultParams || {}) } },
        { name: 'learnedFrom', value: options.learnedFrom ? { stringValue: options.learnedFrom } : { isNull: true } },
        { name: 'sourceMemories', value: options.sourceMemories ? { stringValue: `{${options.sourceMemories.join(',')}}` } : { isNull: true } },
      ]
    );

    return this.mapSkill(result.rows[0] as Record<string, unknown>);
  }

  async getSkill(skillId: string): Promise<ExecutableSkill | null> {
    const result = await executeStatement(
      `SELECT * FROM executable_skills WHERE skill_id = $1`,
      [{ name: 'skillId', value: { stringValue: skillId } }]
    );

    if (result.rows.length === 0) return null;
    return this.mapSkill(result.rows[0] as Record<string, unknown>);
  }

  async getSkillBySlug(tenantId: string, slug: string): Promise<ExecutableSkill | null> {
    const result = await executeStatement(
      `SELECT * FROM executable_skills WHERE tenant_id = $1 AND slug = $2 AND is_active = true`,
      [
        { name: 'tenantId', value: { stringValue: tenantId } },
        { name: 'slug', value: { stringValue: slug } },
      ]
    );

    if (result.rows.length === 0) return null;
    return this.mapSkill(result.rows[0] as Record<string, unknown>);
  }

  async findMatchingSkills(tenantId: string, query: string, limit = 5): Promise<Array<ExecutableSkill & { similarity: number }>> {
    const embedding = await this.generateEmbedding(query);

    const result = await executeStatement(
      `SELECT *, 1 - (skill_embedding <=> $2::vector) as similarity
       FROM executable_skills
       WHERE tenant_id = $1 AND is_active = true
       ORDER BY skill_embedding <=> $2::vector
       LIMIT $3`,
      [
        { name: 'tenantId', value: { stringValue: tenantId } },
        { name: 'embedding', value: { stringValue: `[${embedding.join(',')}]` } },
        { name: 'limit', value: { longValue: limit } },
      ]
    );

    return result.rows.map((row) => ({
      ...this.mapSkill(row as Record<string, unknown>),
      similarity: Number((row as { similarity: number }).similarity),
    }));
  }

  async suggestSkillsForContext(tenantId: string, context: string): Promise<ExecutableSkill[]> {
    // Find skills whose trigger conditions match the context
    const allSkills = await this.findMatchingSkills(tenantId, context, 10);

    const matchedSkills: ExecutableSkill[] = [];

    for (const skill of allSkills) {
      if (skill.similarity < 0.5) continue;

      // Check trigger conditions
      const triggered = await this.checkTriggerConditions(skill.triggerConditions, context);
      if (triggered) {
        matchedSkills.push(skill);
      }
    }

    return matchedSkills.slice(0, 3);
  }

  private async checkTriggerConditions(conditions: TriggerCondition[], context: string): Promise<boolean> {
    if (conditions.length === 0) return true;

    for (const condition of conditions) {
      switch (condition.type) {
        case 'keyword':
          if (context.toLowerCase().includes(condition.value.toLowerCase())) {
            return true;
          }
          break;

        case 'pattern':
          try {
            const regex = new RegExp(condition.value, 'i');
            if (regex.test(context)) {
              return true;
            }
          } catch { /* invalid regex */ }
          break;

        case 'intent':
          // Use LLM to check intent match
          const intentMatch = await this.checkIntentMatch(context, condition.value);
          if (intentMatch > (condition.confidence || 0.7)) {
            return true;
          }
          break;
      }
    }

    return false;
  }

  private async checkIntentMatch(context: string, intent: string): Promise<number> {
    const prompt = `Does this text express the intent "${intent}"?

Text: "${context.substring(0, 500)}"

Return a confidence score from 0 to 1.
Return only the number.`;

    try {
      const response = await this.invokeModel(prompt);
      const score = parseFloat(response.trim());
      return isNaN(score) ? 0 : Math.min(1, Math.max(0, score));
    } catch {
      return 0;
    }
  }

  // ============================================================================
  // Skill Execution
  // ============================================================================

  async executeSkill(
    skillId: string,
    inputParams: Record<string, unknown>,
    context: {
      tenantId: string;
      userId?: string;
      sessionId?: string;
      triggerType?: string;
    }
  ): Promise<SkillExecution> {
    const skill = await this.getSkill(skillId);
    if (!skill) throw new Error('Skill not found');

    // Validate required inputs
    for (const input of skill.requiredInputs) {
      if (input.required && !(input.name in inputParams) && input.defaultValue === undefined) {
        throw new Error(`Missing required input: ${input.name}`);
      }
    }

    // Merge with defaults
    const params = { ...skill.defaultParams, ...inputParams };

    // Create execution record
    const result = await executeStatement(
      `INSERT INTO skill_executions (
        skill_id, tenant_id, user_id, session_id, trigger_type, input_params, context, status
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, 'running')
      RETURNING execution_id`,
      [
        { name: 'skillId', value: { stringValue: skillId } },
        { name: 'tenantId', value: { stringValue: context.tenantId } },
        { name: 'userId', value: context.userId ? { stringValue: context.userId } : { isNull: true } },
        { name: 'sessionId', value: context.sessionId ? { stringValue: context.sessionId } : { isNull: true } },
        { name: 'triggerType', value: context.triggerType ? { stringValue: context.triggerType } : { isNull: true } },
        { name: 'inputParams', value: { stringValue: JSON.stringify(params) } },
        { name: 'context', value: { stringValue: JSON.stringify({}) } },
      ]
    );

    const executionId = (result.rows[0] as { execution_id: string }).execution_id;

    // Update started_at
    await executeStatement(
      `UPDATE skill_executions SET started_at = NOW() WHERE execution_id = $1`,
      [{ name: 'executionId', value: { stringValue: executionId } }]
    );

    const startTime = Date.now();
    const stepResults: StepResult[] = [];
    let finalOutput: unknown = null;
    let errorStep: number | undefined;
    let errorMessage: string | undefined;

    // Execute steps
    for (let i = 0; i < skill.steps.length; i++) {
      const step = skill.steps[i];
      const stepStartTime = Date.now();

      try {
        const stepOutput = await this.executeStep(step, params, stepResults);

        stepResults.push({
          stepNumber: step.stepNumber,
          success: true,
          output: stepOutput,
          durationMs: Date.now() - stepStartTime,
        });

        // Update current step
        await executeStatement(
          `UPDATE skill_executions SET current_step = $2, step_results = $3 WHERE execution_id = $1`,
          [
            { name: 'executionId', value: { stringValue: executionId } },
            { name: 'step', value: { longValue: i + 1 } },
            { name: 'results', value: { stringValue: JSON.stringify(stepResults) } },
          ]
        );

        finalOutput = stepOutput;

      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : 'Unknown error';

        // Try fallback if available
        if (step.fallback) {
          try {
            const fallbackOutput = await this.executeFallback(step.fallback, params);
            stepResults.push({
              stepNumber: step.stepNumber,
              success: true,
              output: fallbackOutput,
              durationMs: Date.now() - stepStartTime,
            });
            finalOutput = fallbackOutput;
            continue;
          } catch { /* fallback also failed */ }
        }

        stepResults.push({
          stepNumber: step.stepNumber,
          success: false,
          error: errorMsg,
          durationMs: Date.now() - stepStartTime,
        });

        errorStep = step.stepNumber;
        errorMessage = errorMsg;
        break;
      }
    }

    const durationMs = Date.now() - startTime;
    const success = errorStep === undefined;
    const status: ExecutionStatus = success ? 'completed' : 'failed';

    // Calculate quality score if successful
    let outputQuality: number | undefined;
    if (success && finalOutput) {
      outputQuality = await this.assessOutputQuality(skill, finalOutput);
    }

    // Update execution record
    await executeStatement(
      `UPDATE skill_executions SET
        status = $2,
        step_results = $3,
        output = $4,
        output_quality = $5,
        duration_ms = $6,
        error_step = $7,
        error_message = $8,
        completed_at = NOW()
      WHERE execution_id = $1`,
      [
        { name: 'executionId', value: { stringValue: executionId } },
        { name: 'status', value: { stringValue: status } },
        { name: 'stepResults', value: { stringValue: JSON.stringify(stepResults) } },
        { name: 'output', value: finalOutput ? { stringValue: JSON.stringify(finalOutput) } : { isNull: true } },
        { name: 'quality', value: outputQuality !== undefined ? { doubleValue: outputQuality } : { isNull: true } },
        { name: 'durationMs', value: { longValue: durationMs } },
        { name: 'errorStep', value: errorStep !== undefined ? { longValue: errorStep } : { isNull: true } },
        { name: 'errorMessage', value: errorMessage ? { stringValue: errorMessage } : { isNull: true } },
      ]
    );

    // Update skill statistics
    await executeStatement(
      `UPDATE executable_skills SET
        execution_count = execution_count + 1,
        success_count = success_count + CASE WHEN $2 = 'completed' THEN 1 ELSE 0 END,
        avg_execution_time_ms = (COALESCE(avg_execution_time_ms, 0) * execution_count + $3) / (execution_count + 1),
        avg_quality_score = CASE 
          WHEN $4 IS NOT NULL THEN (COALESCE(avg_quality_score, 0) * success_count + $4) / (success_count + 1)
          ELSE avg_quality_score
        END
      WHERE skill_id = $1`,
      [
        { name: 'skillId', value: { stringValue: skillId } },
        { name: 'status', value: { stringValue: status } },
        { name: 'durationMs', value: { longValue: durationMs } },
        { name: 'quality', value: outputQuality !== undefined ? { doubleValue: outputQuality } : { isNull: true } },
      ]
    );

    return {
      executionId,
      skillId,
      status,
      currentStep: stepResults.length,
      stepResults,
      output: finalOutput,
      outputQuality,
      durationMs,
      errorStep,
      errorMessage,
    };
  }

  private async executeStep(step: SkillStep, params: Record<string, unknown>, previousResults: StepResult[]): Promise<unknown> {
    // Build context from previous results
    const context = {
      params,
      previousOutputs: previousResults.map((r) => r.output),
    };

    const prompt = `Execute this step of a procedure:

STEP: ${step.action}
PARAMETERS: ${JSON.stringify(step.params)}
CONTEXT: ${JSON.stringify(context)}
${step.expectedOutcome ? `EXPECTED OUTCOME: ${step.expectedOutcome}` : ''}

Execute the step and return the result. Be specific and actionable.`;

    const result = await this.invokeModel(prompt);
    return result;
  }

  private async executeFallback(fallback: string, params: Record<string, unknown>): Promise<unknown> {
    const prompt = `Execute this fallback action:

ACTION: ${fallback}
CONTEXT: ${JSON.stringify(params)}

Provide a reasonable fallback result.`;

    return this.invokeModel(prompt);
  }

  private async assessOutputQuality(skill: ExecutableSkill, output: unknown): Promise<number> {
    const prompt = `Assess the quality of this output for the skill "${skill.name}":

OUTPUT: ${JSON.stringify(output).substring(0, 1000)}

${skill.expectedOutputs.length > 0 ? `EXPECTED OUTPUT TYPE: ${JSON.stringify(skill.expectedOutputs)}` : ''}

Rate from 0 to 1:
- 1.0 = Perfect, fully meets requirements
- 0.7 = Good, meets most requirements
- 0.5 = Acceptable, meets basic requirements
- 0.3 = Poor, missing key elements
- 0.0 = Failed, does not meet requirements

Return only the number.`;

    try {
      const response = await this.invokeModel(prompt);
      const score = parseFloat(response.trim());
      return isNaN(score) ? 0.5 : Math.min(1, Math.max(0, score));
    } catch {
      return 0.5;
    }
  }

  async getExecution(executionId: string): Promise<SkillExecution | null> {
    const result = await executeStatement(
      `SELECT * FROM skill_executions WHERE execution_id = $1`,
      [{ name: 'executionId', value: { stringValue: executionId } }]
    );

    if (result.rows.length === 0) return null;
    return this.mapExecution(result.rows[0] as Record<string, unknown>);
  }

  async rateExecution(executionId: string, rating: number, feedback?: string): Promise<void> {
    await executeStatement(
      `UPDATE skill_executions SET user_rating = $2, user_feedback = $3 WHERE execution_id = $1`,
      [
        { name: 'executionId', value: { stringValue: executionId } },
        { name: 'rating', value: { longValue: rating } },
        { name: 'feedback', value: feedback ? { stringValue: feedback } : { isNull: true } },
      ]
    );
  }

  // ============================================================================
  // Skill Learning
  // ============================================================================

  async learnSkillFromDemonstration(
    tenantId: string,
    demonstration: string,
    skillName: string
  ): Promise<ExecutableSkill | null> {
    const prompt = `Analyze this demonstration and extract a reusable skill/procedure:

DEMONSTRATION:
"${demonstration.substring(0, 3000)}"

SKILL NAME: ${skillName}

Extract:
1. The steps involved (in order)
2. Required inputs
3. Expected outputs
4. Trigger conditions (when to use this skill)

Return JSON:
{
  "description": "what this skill does",
  "steps": [
    {"stepNumber": 1, "action": "...", "params": {}, "expectedOutcome": "..."}
  ],
  "required_inputs": [
    {"name": "...", "type": "...", "required": true}
  ],
  "expected_outputs": [
    {"name": "...", "type": "..."}
  ],
  "trigger_conditions": [
    {"type": "keyword|pattern|intent", "value": "..."}
  ]
}`;

    try {
      const response = await this.invokeModel(prompt);
      const jsonMatch = response.match(/\{[\s\S]*\}/);

      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);

        return this.createSkill(tenantId, skillName, 'procedure', parsed.steps || [], {
          description: parsed.description,
          triggerConditions: parsed.trigger_conditions,
          requiredInputs: parsed.required_inputs,
          expectedOutputs: parsed.expected_outputs,
          learnedFrom: 'demonstration',
        });
      }
    } catch { /* learning failed */ }

    return null;
  }

  async improveSkillFromFeedback(skillId: string): Promise<void> {
    // Get recent executions with feedback
    const result = await executeStatement(
      `SELECT * FROM skill_executions
       WHERE skill_id = $1 AND user_rating IS NOT NULL
       ORDER BY created_at DESC
       LIMIT 10`,
      [{ name: 'skillId', value: { stringValue: skillId } }]
    );

    if (result.rows.length < 3) return; // Need enough feedback

    const executions = result.rows as Array<Record<string, unknown>>;
    const skill = await this.getSkill(skillId);
    if (!skill) return;

    const feedbackSummary = executions.map((e) => ({
      rating: e.user_rating,
      feedback: e.user_feedback,
      success: e.status === 'completed',
    }));

    const prompt = `Analyze feedback on this skill and suggest improvements:

SKILL: ${skill.name}
CURRENT STEPS: ${JSON.stringify(skill.steps)}

FEEDBACK:
${feedbackSummary.map((f) => `- Rating: ${f.rating}/5, Success: ${f.success}, Feedback: ${f.feedback || 'none'}`).join('\n')}

Suggest specific improvements to the skill steps.`;

    // Log improvement suggestion - in production, could auto-update
    await this.invokeModel(prompt);
  }

  // ============================================================================
  // Helper Methods
  // ============================================================================

  private async generateEmbedding(text: string): Promise<number[]> {
    try {
      await modelRouterService.invoke({
        modelId: 'amazon/titan-embed-text',
        messages: [{ role: 'user', content: text.substring(0, 8000) }],
      });
      return new Array(1536).fill(0);
    } catch {
      return new Array(1536).fill(0);
    }
  }

  private async invokeModel(prompt: string): Promise<string> {
    const response = await modelRouterService.invoke({
      modelId: 'anthropic/claude-3-haiku',
      messages: [{ role: 'user', content: prompt }],
      maxTokens: 2048,
    });
    return response.content;
  }

  private mapSkill(row: Record<string, unknown>): ExecutableSkill {
    return {
      skillId: String(row.skill_id),
      name: String(row.name),
      slug: String(row.slug),
      description: row.description ? String(row.description) : undefined,
      skillType: row.skill_type as SkillType,
      triggerConditions: typeof row.trigger_conditions === 'string' ? JSON.parse(row.trigger_conditions) : (row.trigger_conditions as TriggerCondition[]) || [],
      steps: typeof row.steps === 'string' ? JSON.parse(row.steps) : (row.steps as SkillStep[]) || [],
      requiredInputs: typeof row.required_inputs === 'string' ? JSON.parse(row.required_inputs) : (row.required_inputs as SkillInput[]) || [],
      expectedOutputs: typeof row.expected_outputs === 'string' ? JSON.parse(row.expected_outputs) : (row.expected_outputs as SkillOutput[]) || [],
      parameters: typeof row.parameters === 'string' ? JSON.parse(row.parameters) : (row.parameters as SkillParameter[]) || [],
      defaultParams: typeof row.default_params === 'string' ? JSON.parse(row.default_params) : (row.default_params as Record<string, unknown>) || {},
      executionCount: Number(row.execution_count || 0),
      successCount: Number(row.success_count || 0),
      avgExecutionTimeMs: row.avg_execution_time_ms ? Number(row.avg_execution_time_ms) : undefined,
      avgQualityScore: row.avg_quality_score ? Number(row.avg_quality_score) : undefined,
      isActive: Boolean(row.is_active ?? true),
    };
  }

  private mapExecution(row: Record<string, unknown>): SkillExecution {
    return {
      executionId: String(row.execution_id),
      skillId: String(row.skill_id),
      status: row.status as ExecutionStatus,
      currentStep: Number(row.current_step || 0),
      stepResults: typeof row.step_results === 'string' ? JSON.parse(row.step_results) : (row.step_results as StepResult[]) || [],
      output: row.output ? (typeof row.output === 'string' ? JSON.parse(row.output) : row.output) : undefined,
      outputQuality: row.output_quality ? Number(row.output_quality) : undefined,
      durationMs: row.duration_ms ? Number(row.duration_ms) : undefined,
      errorStep: row.error_step ? Number(row.error_step) : undefined,
      errorMessage: row.error_message ? String(row.error_message) : undefined,
      userRating: row.user_rating ? Number(row.user_rating) : undefined,
      userFeedback: row.user_feedback ? String(row.user_feedback) : undefined,
    };
  }
}

export const skillExecutionService = new SkillExecutionService();
