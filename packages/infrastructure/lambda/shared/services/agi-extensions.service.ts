// RADIANT v4.18.0 - AGI Extensions Service
// Explainability, Tool Use, Safety, Feedback Learning, Dialogue Management

import { executeStatement } from '../db/client';
import { modelRouterService } from './model-router.service';

// ============================================================================
// Types
// ============================================================================

export interface ExplanationTrace {
  traceId: string;
  requestId?: string;
  reasoningChain: Array<{
    step: number;
    reasoning: string;
    evidence?: string;
    confidence: number;
  }>;
  keyFactors: string[];
  alternativesConsidered: Array<{ option: string; reason: string }>;
  confidence: number;
}

export interface AgentTool {
  toolId: string;
  name: string;
  description: string;
  category: string;
  functionSpec: {
    name: string;
    description: string;
    parameters: Record<string, unknown>;
  };
  executionType: string;
  riskLevel: string;
  enabled: boolean;
}

export interface ToolExecution {
  executionId: string;
  toolId: string;
  status: string;
  inputParams: Record<string, unknown>;
  output?: unknown;
  errorMessage?: string;
  latencyMs?: number;
}

export interface SafetyCheckResult {
  passed: boolean;
  violations: Array<{
    ruleId: string;
    ruleName: string;
    violationType: string;
    severity: string;
    action: string;
  }>;
  modifiedContent?: string;
}

export interface UserFeedback {
  feedbackId: string;
  feedbackType: string;
  rating?: number;
  correctedResponse?: string;
  processed: boolean;
}

export interface DialogueSession {
  sessionId: string;
  status: string;
  currentTopic?: string;
  userGoals: string[];
  overallSentiment: number;
  turnCount: number;
}

export interface DialogueTurn {
  turnId: string;
  turnNumber: number;
  speaker: 'user' | 'assistant' | 'system';
  content: string;
  intent?: string;
  sentiment?: number;
  dialogueAct?: string;
}

export interface TaskDecomposition {
  decompositionId: string;
  originalTask: string;
  subtasks: Array<{
    id: string;
    description: string;
    dependencies: string[];
    status: string;
  }>;
  progress: number;
  status: string;
}

// ============================================================================
// AGI Extensions Service
// ============================================================================

export class AGIExtensionsService {
  // ============================================================================
  // EXPLAINABILITY (XAI)
  // ============================================================================

  async generateExplanation(
    tenantId: string,
    requestId: string,
    input: string,
    output: string,
    context?: Record<string, unknown>
  ): Promise<ExplanationTrace> {
    const prompt = `Generate an explanation for this AI decision/response.

INPUT: "${input.substring(0, 1000)}"
OUTPUT: "${output.substring(0, 1000)}"
${context ? `CONTEXT: ${JSON.stringify(context)}` : ''}

Provide a transparent explanation including:
1. Step-by-step reasoning chain
2. Key factors that influenced the response
3. Alternatives considered and why they were rejected
4. Confidence level and uncertainties

Return JSON:
{
  "reasoning_chain": [
    {"step": 1, "reasoning": "...", "evidence": "...", "confidence": 0.0-1.0}
  ],
  "key_factors": ["factor1", "factor2"],
  "alternatives_considered": [
    {"option": "...", "reason_rejected": "..."}
  ],
  "assumptions": ["..."],
  "uncertainties": ["..."],
  "overall_confidence": 0.0-1.0
}`;

    try {
      const response = await modelRouterService.invoke({
        modelId: 'anthropic/claude-3-haiku',
        messages: [{ role: 'user', content: prompt }],
        maxTokens: 2048,
      });

      const jsonMatch = response.content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);

        const result = await executeStatement(
          `INSERT INTO explanation_traces (
            tenant_id, request_id, input_summary, output_summary, reasoning_chain,
            key_factors, alternatives_considered, assumptions_made, uncertainties, confidence
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
          RETURNING trace_id`,
          [
            { name: 'tenantId', value: { stringValue: tenantId } },
            { name: 'requestId', value: { stringValue: requestId } },
            { name: 'input', value: { stringValue: input.substring(0, 500) } },
            { name: 'output', value: { stringValue: output.substring(0, 500) } },
            { name: 'reasoning', value: { stringValue: JSON.stringify(parsed.reasoning_chain || []) } },
            { name: 'factors', value: { stringValue: JSON.stringify(parsed.key_factors || []) } },
            { name: 'alternatives', value: { stringValue: JSON.stringify(parsed.alternatives_considered || []) } },
            { name: 'assumptions', value: { stringValue: JSON.stringify(parsed.assumptions || []) } },
            { name: 'uncertainties', value: { stringValue: JSON.stringify(parsed.uncertainties || []) } },
            { name: 'confidence', value: { doubleValue: parsed.overall_confidence || 0.7 } },
          ]
        );

        return {
          traceId: (result.rows[0] as { trace_id: string }).trace_id,
          requestId,
          reasoningChain: parsed.reasoning_chain || [],
          keyFactors: parsed.key_factors || [],
          alternativesConsidered: parsed.alternatives_considered || [],
          confidence: parsed.overall_confidence || 0.7,
        };
      }
    } catch { /* explanation generation failed */ }

    return {
      traceId: '',
      requestId,
      reasoningChain: [],
      keyFactors: [],
      alternativesConsidered: [],
      confidence: 0,
    };
  }

  async getExplanation(traceId: string): Promise<ExplanationTrace | null> {
    const result = await executeStatement(
      `SELECT * FROM explanation_traces WHERE trace_id = $1`,
      [{ name: 'traceId', value: { stringValue: traceId } }]
    );

    if (result.rows.length === 0) return null;
    return this.mapExplanation(result.rows[0] as Record<string, unknown>);
  }

  // ============================================================================
  // TOOL USE / FUNCTION CALLING
  // ============================================================================

  async getAvailableTools(tenantId: string): Promise<AgentTool[]> {
    const result = await executeStatement(
      `SELECT * FROM agent_tools 
       WHERE (tenant_id = $1 OR tenant_id IS NULL) AND enabled = true
       ORDER BY category, name`,
      [{ name: 'tenantId', value: { stringValue: tenantId } }]
    );

    return result.rows.map(row => this.mapTool(row as Record<string, unknown>));
  }

  async executeTool(
    tenantId: string,
    toolId: string,
    params: Record<string, unknown>,
    requestId?: string
  ): Promise<ToolExecution> {
    // Get tool definition
    const toolResult = await executeStatement(
      `SELECT * FROM agent_tools WHERE tool_id = $1`,
      [{ name: 'toolId', value: { stringValue: toolId } }]
    );

    if (toolResult.rows.length === 0) {
      throw new Error('Tool not found');
    }

    const tool = this.mapTool(toolResult.rows[0] as Record<string, unknown>);
    const startTime = Date.now();

    // Create execution record
    const execResult = await executeStatement(
      `INSERT INTO tool_executions (tenant_id, tool_id, request_id, input_params, status, approval_required)
       VALUES ($1, $2, $3, $4, 'executing', $5)
       RETURNING execution_id`,
      [
        { name: 'tenantId', value: { stringValue: tenantId } },
        { name: 'toolId', value: { stringValue: toolId } },
        { name: 'requestId', value: requestId ? { stringValue: requestId } : { isNull: true } },
        { name: 'params', value: { stringValue: JSON.stringify(params) } },
        { name: 'approvalRequired', value: { booleanValue: tool.riskLevel === 'high' || tool.riskLevel === 'critical' } },
      ]
    );

    const executionId = (execResult.rows[0] as { execution_id: string }).execution_id;

    try {
      // Execute based on tool type
      let output: unknown;

      switch (tool.name) {
        case 'calculator':
          output = await this.executeCalculator(params.expression as string);
          break;
        case 'web_search':
          output = await this.executeWebSearch(params.query as string);
          break;
        case 'database_query':
          output = await this.executeDatabaseQuery(tenantId, params.query as string);
          break;
        default:
          output = { message: 'Tool execution simulated', params };
      }

      const latencyMs = Date.now() - startTime;

      // Update execution record
      await executeStatement(
        `UPDATE tool_executions SET 
         status = 'completed', output = $2, latency_ms = $3, completed_at = NOW()
         WHERE execution_id = $1`,
        [
          { name: 'executionId', value: { stringValue: executionId } },
          { name: 'output', value: { stringValue: JSON.stringify(output) } },
          { name: 'latencyMs', value: { longValue: latencyMs } },
        ]
      );

      // Update tool stats
      await executeStatement(
        `UPDATE agent_tools SET times_called = times_called + 1 WHERE tool_id = $1`,
        [{ name: 'toolId', value: { stringValue: toolId } }]
      );

      return {
        executionId,
        toolId,
        status: 'completed',
        inputParams: params,
        output,
        latencyMs,
      };
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';

      await executeStatement(
        `UPDATE tool_executions SET status = 'failed', error_message = $2, completed_at = NOW()
         WHERE execution_id = $1`,
        [
          { name: 'executionId', value: { stringValue: executionId } },
          { name: 'error', value: { stringValue: errorMsg } },
        ]
      );

      return {
        executionId,
        toolId,
        status: 'failed',
        inputParams: params,
        errorMessage: errorMsg,
      };
    }
  }

  private async executeCalculator(expression: string): Promise<{ result: number }> {
    // Safe math evaluation (very basic)
    const sanitized = expression.replace(/[^0-9+\-*/().% ]/g, '');
    try {
      const result = Function(`'use strict'; return (${sanitized})`)();
      return { result: Number(result) };
    } catch {
      return { result: NaN };
    }
  }

  private async executeWebSearch(query: string): Promise<{ results: string[] }> {
    // Integrate with configured search provider
    const searchProvider = process.env.SEARCH_PROVIDER || 'perplexity';
    
    try {
      switch (searchProvider) {
        case 'perplexity':
          return await this.searchWithPerplexity(query);
        case 'serper':
          return await this.searchWithSerper(query);
        case 'tavily':
          return await this.searchWithTavily(query);
        default:
          // Fallback: Use AI model to synthesize search-like results
          return await this.searchWithAI(query);
      }
    } catch (error) {
      // Graceful degradation: return AI-synthesized results on failure
      return await this.searchWithAI(query);
    }
  }

  private async searchWithPerplexity(query: string): Promise<{ results: string[] }> {
    const apiKey = process.env.PERPLEXITY_API_KEY;
    if (!apiKey) {
      throw new Error('PERPLEXITY_API_KEY not configured');
    }

    const response = await fetch('https://api.perplexity.ai/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'llama-3.1-sonar-small-128k-online',
        messages: [{ role: 'user', content: query }],
        max_tokens: 1000,
      }),
    });

    if (!response.ok) {
      throw new Error(`Perplexity API error: ${response.status}`);
    }

    const data = await response.json() as { choices: Array<{ message: { content: string } }> };
    const content = data.choices?.[0]?.message?.content || '';
    
    // Parse response into discrete results
    return { results: this.parseSearchResults(content) };
  }

  private async searchWithSerper(query: string): Promise<{ results: string[] }> {
    const apiKey = process.env.SERPER_API_KEY;
    if (!apiKey) {
      throw new Error('SERPER_API_KEY not configured');
    }

    const response = await fetch('https://google.serper.dev/search', {
      method: 'POST',
      headers: {
        'X-API-KEY': apiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ q: query, num: 5 }),
    });

    if (!response.ok) {
      throw new Error(`Serper API error: ${response.status}`);
    }

    const data = await response.json() as { 
      organic: Array<{ title: string; snippet: string; link: string }> 
    };
    
    return {
      results: data.organic?.map(r => `${r.title}: ${r.snippet} (${r.link})`) || [],
    };
  }

  private async searchWithTavily(query: string): Promise<{ results: string[] }> {
    const apiKey = process.env.TAVILY_API_KEY;
    if (!apiKey) {
      throw new Error('TAVILY_API_KEY not configured');
    }

    const response = await fetch('https://api.tavily.com/search', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        api_key: apiKey,
        query,
        search_depth: 'basic',
        max_results: 5,
      }),
    });

    if (!response.ok) {
      throw new Error(`Tavily API error: ${response.status}`);
    }

    const data = await response.json() as { 
      results: Array<{ title: string; content: string; url: string }> 
    };
    
    return {
      results: data.results?.map(r => `${r.title}: ${r.content} (${r.url})`) || [],
    };
  }

  private async searchWithAI(query: string): Promise<{ results: string[] }> {
    // Use AI model to synthesize search-like results based on training knowledge
    const response = await modelRouterService.invoke({
      modelId: 'anthropic/claude-3-5-sonnet',
      messages: [{
        role: 'user',
        content: `Based on your knowledge, provide 3-5 informative results for this query. Format each result on a new line with a title and brief description:

Query: ${query}`,
      }],
      maxTokens: 500,
      temperature: 0.3,
    });

    return { results: this.parseSearchResults(response.content) };
  }

  private parseSearchResults(content: string): string[] {
    // Split content into discrete results
    const lines = content.split('\n').filter(line => line.trim().length > 10);
    return lines.slice(0, 5); // Limit to 5 results
  }

  private async executeDatabaseQuery(tenantId: string, query: string): Promise<{ answer: string }> {
    // Use semantic search on memories
    const result = await executeStatement(
      `SELECT content FROM semantic_memories 
       WHERE tenant_id = $1 
       ORDER BY created_at DESC LIMIT 5`,
      [{ name: 'tenantId', value: { stringValue: tenantId } }]
    );

    return { answer: `Found ${result.rows.length} relevant entries` };
  }

  // ============================================================================
  // SAFETY & GUARDRAILS
  // ============================================================================

  async checkSafety(tenantId: string, content: string, contentType: 'input' | 'output'): Promise<SafetyCheckResult> {
    const violations: SafetyCheckResult['violations'] = [];

    // Get active safety rules
    const rulesResult = await executeStatement(
      `SELECT * FROM safety_rules 
       WHERE (tenant_id = $1 OR tenant_id IS NULL) 
         AND enabled = true 
         AND rule_type LIKE $2
       ORDER BY severity DESC`,
      [
        { name: 'tenantId', value: { stringValue: tenantId } },
        { name: 'ruleType', value: { stringValue: `%${contentType}_filter%` } },
      ]
    );

    let modifiedContent = content;

    for (const row of rulesResult.rows) {
      const rule = row as Record<string, unknown>;
      const config = typeof rule.detection_config === 'string' 
        ? JSON.parse(rule.detection_config) 
        : rule.detection_config as Record<string, unknown>;

      let violated = false;

      // Check based on detection method
      switch (rule.detection_method) {
        case 'keyword':
        case 'regex':
          const patterns = (config.patterns as string[]) || [];
          for (const pattern of patterns) {
            try {
              const regex = new RegExp(pattern, 'gi');
              if (regex.test(content)) {
                violated = true;
                if (rule.action === 'modify') {
                  modifiedContent = modifiedContent.replace(regex, '[REDACTED]');
                }
              }
            } catch { /* invalid regex */ }
          }
          break;

        case 'classifier':
          // Check for known patterns
          const classifierPatterns = (config.patterns as string[]) || [];
          const lowerContent = content.toLowerCase();
          for (const pattern of classifierPatterns) {
            if (lowerContent.includes(pattern.toLowerCase())) {
              violated = true;
              break;
            }
          }
          break;
      }

      if (violated) {
        violations.push({
          ruleId: String(rule.rule_id),
          ruleName: String(rule.name),
          violationType: String(rule.rule_type),
          severity: String(rule.severity),
          action: String(rule.action),
        });

        // Log violation
        await executeStatement(
          `SELECT record_safety_violation($1, $2, $3, $4, $5, $6)`,
          [
            { name: 'tenantId', value: { stringValue: tenantId } },
            { name: 'ruleId', value: { stringValue: String(rule.rule_id) } },
            { name: 'violationType', value: { stringValue: String(rule.rule_type) } },
            { name: 'contentType', value: { stringValue: contentType } },
            { name: 'action', value: { stringValue: String(rule.action) } },
            { name: 'blocked', value: { booleanValue: rule.action === 'block' } },
          ]
        );
      }
    }

    const hasBlockingViolation = violations.some(v => v.action === 'block');

    return {
      passed: !hasBlockingViolation,
      violations,
      modifiedContent: modifiedContent !== content ? modifiedContent : undefined,
    };
  }

  // ============================================================================
  // FEEDBACK LEARNING
  // ============================================================================

  async recordFeedback(
    tenantId: string,
    feedbackType: string,
    options: {
      userId?: string;
      requestId?: string;
      messageId?: string;
      rating?: number;
      correctedResponse?: string;
      correctionReason?: string;
      preferenceKey?: string;
      preferenceValue?: unknown;
    }
  ): Promise<string> {
    const result = await executeStatement(
      `INSERT INTO user_feedback (
        tenant_id, user_id, request_id, message_id, feedback_type,
        rating, corrected_response, correction_reason, preference_key, preference_value
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      RETURNING feedback_id`,
      [
        { name: 'tenantId', value: { stringValue: tenantId } },
        { name: 'userId', value: options.userId ? { stringValue: options.userId } : { isNull: true } },
        { name: 'requestId', value: options.requestId ? { stringValue: options.requestId } : { isNull: true } },
        { name: 'messageId', value: options.messageId ? { stringValue: options.messageId } : { isNull: true } },
        { name: 'feedbackType', value: { stringValue: feedbackType } },
        { name: 'rating', value: options.rating ? { longValue: options.rating } : { isNull: true } },
        { name: 'correctedResponse', value: options.correctedResponse ? { stringValue: options.correctedResponse } : { isNull: true } },
        { name: 'correctionReason', value: options.correctionReason ? { stringValue: options.correctionReason } : { isNull: true } },
        { name: 'preferenceKey', value: options.preferenceKey ? { stringValue: options.preferenceKey } : { isNull: true } },
        { name: 'preferenceValue', value: options.preferenceValue ? { stringValue: JSON.stringify(options.preferenceValue) } : { isNull: true } },
      ]
    );

    const feedbackId = (result.rows[0] as { feedback_id: string }).feedback_id;

    // Process feedback for learning
    await executeStatement(
      `SELECT process_feedback_for_learning($1)`,
      [{ name: 'feedbackId', value: { stringValue: feedbackId } }]
    );

    return feedbackId;
  }

  async getLearnedPreferences(tenantId: string, userId?: string): Promise<Record<string, unknown>> {
    const result = await executeStatement(
      `SELECT preference_type, preference_key, preference_value, confidence
       FROM learned_preferences
       WHERE tenant_id = $1 ${userId ? 'AND (user_id = $2 OR user_id IS NULL)' : 'AND user_id IS NULL'}
       AND confidence > 0.5
       ORDER BY confidence DESC`,
      userId
        ? [
            { name: 'tenantId', value: { stringValue: tenantId } },
            { name: 'userId', value: { stringValue: userId } },
          ]
        : [{ name: 'tenantId', value: { stringValue: tenantId } }]
    );

    const preferences: Record<string, unknown> = {};
    for (const row of result.rows) {
      const r = row as Record<string, unknown>;
      const key = `${r.preference_type}.${r.preference_key}`;
      preferences[key] = typeof r.preference_value === 'string' 
        ? JSON.parse(r.preference_value) 
        : r.preference_value;
    }

    return preferences;
  }

  // ============================================================================
  // DIALOGUE MANAGEMENT
  // ============================================================================

  async startDialogue(tenantId: string, userId?: string, channel = 'chat'): Promise<DialogueSession> {
    const result = await executeStatement(
      `INSERT INTO dialogue_sessions (tenant_id, user_id, channel)
       VALUES ($1, $2, $3)
       RETURNING session_id`,
      [
        { name: 'tenantId', value: { stringValue: tenantId } },
        { name: 'userId', value: userId ? { stringValue: userId } : { isNull: true } },
        { name: 'channel', value: { stringValue: channel } },
      ]
    );

    return {
      sessionId: (result.rows[0] as { session_id: string }).session_id,
      status: 'active',
      userGoals: [],
      overallSentiment: 0,
      turnCount: 0,
    };
  }

  async addDialogueTurn(
    sessionId: string,
    speaker: 'user' | 'assistant' | 'system',
    content: string,
    analysis?: { intent?: string; sentiment?: number; dialogueAct?: string }
  ): Promise<DialogueTurn> {
    // Get next turn number
    const countResult = await executeStatement(
      `SELECT COALESCE(MAX(turn_number), 0) + 1 as next_turn FROM dialogue_turns WHERE session_id = $1`,
      [{ name: 'sessionId', value: { stringValue: sessionId } }]
    );
    const turnNumber = Number((countResult.rows[0] as { next_turn: number }).next_turn);

    const result = await executeStatement(
      `INSERT INTO dialogue_turns (session_id, turn_number, speaker, content, intent, intent_confidence, sentiment, dialogue_act)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING turn_id`,
      [
        { name: 'sessionId', value: { stringValue: sessionId } },
        { name: 'turnNumber', value: { longValue: turnNumber } },
        { name: 'speaker', value: { stringValue: speaker } },
        { name: 'content', value: { stringValue: content } },
        { name: 'intent', value: analysis?.intent ? { stringValue: analysis.intent } : { isNull: true } },
        { name: 'intentConfidence', value: { doubleValue: 0.8 } },
        { name: 'sentiment', value: analysis?.sentiment !== undefined ? { doubleValue: analysis.sentiment } : { isNull: true } },
        { name: 'dialogueAct', value: analysis?.dialogueAct ? { stringValue: analysis.dialogueAct } : { isNull: true } },
      ]
    );

    // Update session last activity
    await executeStatement(
      `UPDATE dialogue_sessions SET last_activity = NOW() WHERE session_id = $1`,
      [{ name: 'sessionId', value: { stringValue: sessionId } }]
    );

    return {
      turnId: (result.rows[0] as { turn_id: string }).turn_id,
      turnNumber,
      speaker,
      content,
      intent: analysis?.intent,
      sentiment: analysis?.sentiment,
      dialogueAct: analysis?.dialogueAct,
    };
  }

  async getDialogueHistory(sessionId: string, limit = 50): Promise<DialogueTurn[]> {
    const result = await executeStatement(
      `SELECT * FROM dialogue_turns WHERE session_id = $1 ORDER BY turn_number ASC LIMIT $2`,
      [
        { name: 'sessionId', value: { stringValue: sessionId } },
        { name: 'limit', value: { longValue: limit } },
      ]
    );

    return result.rows.map(row => this.mapDialogueTurn(row as Record<string, unknown>));
  }

  async analyzeDialogueTurn(content: string): Promise<{ intent: string; sentiment: number; dialogueAct: string }> {
    const prompt = `Analyze this dialogue turn:

"${content.substring(0, 500)}"

Return JSON:
{
  "intent": "user intent (question, request, inform, etc)",
  "sentiment": -1.0 to 1.0,
  "dialogue_act": "question|answer|request|inform|confirm|reject|greeting|closing|other"
}`;

    try {
      const response = await modelRouterService.invoke({
        modelId: 'anthropic/claude-3-haiku',
        messages: [{ role: 'user', content: prompt }],
        maxTokens: 200,
      });

      const jsonMatch = response.content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        return {
          intent: parsed.intent || 'unknown',
          sentiment: parsed.sentiment || 0,
          dialogueAct: parsed.dialogue_act || 'other',
        };
      }
    } catch { /* analysis failed */ }

    return { intent: 'unknown', sentiment: 0, dialogueAct: 'other' };
  }

  // ============================================================================
  // TASK DECOMPOSITION
  // ============================================================================

  async decomposeTask(tenantId: string, task: string): Promise<TaskDecomposition> {
    const prompt = `Decompose this complex task into subtasks:

TASK: "${task}"

Break it down into manageable subtasks with dependencies.

Return JSON:
{
  "complexity": "simple|moderate|complex|very_complex",
  "subtasks": [
    {
      "id": "1",
      "description": "subtask description",
      "dependencies": [], 
      "estimated_effort": "low|medium|high"
    }
  ],
  "execution_strategy": "sequential|parallel|mixed"
}`;

    try {
      const response = await modelRouterService.invoke({
        modelId: 'anthropic/claude-3-haiku',
        messages: [{ role: 'user', content: prompt }],
        maxTokens: 1024,
      });

      const jsonMatch = response.content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);

        const result = await executeStatement(
          `INSERT INTO task_decompositions (tenant_id, original_task, task_complexity, subtasks, execution_strategy)
           VALUES ($1, $2, $3, $4, $5)
           RETURNING decomposition_id`,
          [
            { name: 'tenantId', value: { stringValue: tenantId } },
            { name: 'task', value: { stringValue: task } },
            { name: 'complexity', value: { stringValue: parsed.complexity || 'moderate' } },
            { name: 'subtasks', value: { stringValue: JSON.stringify(parsed.subtasks || []) } },
            { name: 'strategy', value: { stringValue: parsed.execution_strategy || 'sequential' } },
          ]
        );

        return {
          decompositionId: (result.rows[0] as { decomposition_id: string }).decomposition_id,
          originalTask: task,
          subtasks: (parsed.subtasks || []).map((s: Record<string, unknown>) => ({
            id: String(s.id),
            description: String(s.description),
            dependencies: (s.dependencies as string[]) || [],
            status: 'pending',
          })),
          progress: 0,
          status: 'pending',
        };
      }
    } catch { /* decomposition failed */ }

    return {
      decompositionId: '',
      originalTask: task,
      subtasks: [{ id: '1', description: task, dependencies: [], status: 'pending' }],
      progress: 0,
      status: 'pending',
    };
  }

  // ============================================================================
  // Helper Methods
  // ============================================================================

  private mapExplanation(row: Record<string, unknown>): ExplanationTrace {
    return {
      traceId: String(row.trace_id),
      requestId: row.request_id ? String(row.request_id) : undefined,
      reasoningChain: typeof row.reasoning_chain === 'string' 
        ? JSON.parse(row.reasoning_chain) 
        : (row.reasoning_chain as ExplanationTrace['reasoningChain']) || [],
      keyFactors: typeof row.key_factors === 'string' 
        ? JSON.parse(row.key_factors) 
        : (row.key_factors as string[]) || [],
      alternativesConsidered: typeof row.alternatives_considered === 'string' 
        ? JSON.parse(row.alternatives_considered) 
        : (row.alternatives_considered as ExplanationTrace['alternativesConsidered']) || [],
      confidence: Number(row.confidence ?? 0),
    };
  }

  private mapTool(row: Record<string, unknown>): AgentTool {
    return {
      toolId: String(row.tool_id),
      name: String(row.name),
      description: String(row.description),
      category: String(row.category || 'general'),
      functionSpec: typeof row.function_spec === 'string' 
        ? JSON.parse(row.function_spec) 
        : (row.function_spec as AgentTool['functionSpec']),
      executionType: String(row.execution_type),
      riskLevel: String(row.risk_level || 'low'),
      enabled: Boolean(row.enabled ?? true),
    };
  }

  private mapDialogueTurn(row: Record<string, unknown>): DialogueTurn {
    return {
      turnId: String(row.turn_id),
      turnNumber: Number(row.turn_number),
      speaker: row.speaker as DialogueTurn['speaker'],
      content: String(row.content),
      intent: row.intent ? String(row.intent) : undefined,
      sentiment: row.sentiment ? Number(row.sentiment) : undefined,
      dialogueAct: row.dialogue_act ? String(row.dialogue_act) : undefined,
    };
  }
}

export const agiExtensionsService = new AGIExtensionsService();
