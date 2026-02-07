// RADIANT v4.18.0 - Admin AI Helper Service
// Bedrock-powered contextual AI assistant for all admin dashboard pages.
// Provides smart recommendations, causal analysis, and data exploration.
// ============================================================================

import { BedrockRuntimeClient, InvokeModelCommand } from '@aws-sdk/client-bedrock-runtime';
import { executeStatement, stringParam, doubleParam, longParam } from '../db/client';
import { createRegisteredLogger } from './logging-registry.service';

const logger = createRegisteredLogger({
  serviceName: 'admin/ai-helper',
  category: 'infrastructure',
  sourceType: 'application',
});
import { bedrockModelDiscoveryService, AdminAIHelperConfig } from './bedrock-model-discovery.service';

// ============================================================================
// Types
// ============================================================================

export interface AIHelperMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

export interface AIHelperRequest {
  tenantId: string;
  userId: string;
  adminPage: string;
  message: string;
  pageContext?: Record<string, unknown>;
  conversationHistory?: AIHelperMessage[];
  maxTokens?: number;
  temperature?: number;
}

export interface AIHelperResponse {
  message: string;
  modelId: string;
  inputTokens: number;
  outputTokens: number;
  latencyMs: number;
  costCents: number;
  recommendations?: AIRecommendation[];
  causalAnalysis?: CausalAnalysis | null;
}

export interface AIRecommendation {
  title: string;
  description: string;
  impact: 'high' | 'medium' | 'low';
  category: string;
  actionable: boolean;
  suggestedAction?: string;
}

export interface CausalAnalysis {
  proposedChange: string;
  expectedEffects: Array<{
    area: string;
    effect: string;
    direction: 'positive' | 'negative' | 'neutral';
    confidence: number;
  }>;
  risks: string[];
  mitigations: string[];
}

export interface ConversationEntry {
  id: string;
  tenantId: string;
  userId: string | null;
  adminPage: string;
  role: string;
  content: string;
  modelId: string | null;
  inputTokens: number | null;
  outputTokens: number | null;
  latencyMs: number | null;
  costCents: number | null;
  pageContext: Record<string, unknown> | null;
  createdAt: string;
}

// ============================================================================
// Page-Specific System Prompts
// ============================================================================

const PAGE_SYSTEM_PROMPTS: Record<string, string> = {
  'model-weights': `You are the RADIANT Model Weights & Drift Correction advisor. You help administrators understand and optimize model routing weights.

Key concepts you know about:
- Composite weights are calculated from 5 factors: drift score, quality score, latency score, cost score, availability score
- Each factor has a configurable weight (default: drift 25%, quality 30%, latency 15%, cost 15%, availability 15%)
- Drift scores range from 0.0 (maximum drift) to 1.0 (no drift), computed from KS tests, PSI, and Chi-squared tests
- Models can be quarantined (weight=0) when drift score falls below the quarantine threshold (default 0.3)
- Models get weight penalties when drift score falls below the penalty threshold (default 0.6)
- Administrators can set manual weight overrides to bypass automatic calculation
- Temperature and prompt prefix corrections can be configured per-model for drift mitigation

When analyzing data:
- Explain what each score means in practical terms
- Suggest which factor weights to adjust based on the tenant's priorities (cost vs quality vs speed)
- Warn about the causal effects of changes (e.g., quarantining a popular model increases load on others)
- Recommend fallback models when quarantining`,

  'bedrock-settings': `You are the RADIANT Bedrock Model Management advisor. You help administrators configure the AI helper's Bedrock model and auto-upgrade settings.

Key concepts:
- The admin AI helper (you) runs on a configurable Bedrock model
- Auto-upgrade automatically moves to the latest model in the same family when available
- Polling interval controls how often we check Bedrock for new models
- Model families: anthropic.claude, meta.llama, amazon.titan, mistral
- Temperature affects creativity vs consistency of responses
- Max tokens controls response length

When advising:
- Explain trade-offs between model families (Claude for reasoning, Llama for cost, Titan for AWS-native)
- Warn about cost implications of model changes
- Explain what auto-upgrade does and when it runs`,

  'security': `You are the RADIANT Security advisor. You help administrators understand security monitoring, drift detection alerts, behavioral anomalies, and constitutional classification.

When analyzing:
- Explain what drift detection alerts mean and recommended actions
- Help interpret behavioral anomaly scores
- Suggest security configuration changes with causal analysis
- Warn about security implications of disabling monitoring features`,

  'orchestration': `You are the RADIANT Orchestration advisor. You help administrators understand AI orchestration methods, inference caching, and model consensus.

When analyzing:
- Explain orchestration method performance metrics
- Suggest optimal method selection for different use cases
- Analyze cache hit rates and suggest improvements
- Help tune consensus parameters`,

  'default': `You are the RADIANT Platform AI Assistant. You help administrators understand, analyze, and optimize the RADIANT AI platform.

Your capabilities:
1. **Data Analysis**: Interpret metrics, charts, and system data shown on the current page
2. **Recommendations**: Provide actionable suggestions based on current state
3. **Causal Analysis**: Explain the downstream effects of proposed configuration changes
4. **Deep Dive**: Help administrators explore system internals and understand complex relationships
5. **Best Practices**: Share platform best practices and warn about common pitfalls

Guidelines:
- Always be specific and actionable
- When suggesting changes, explain the causal chain of effects
- Quantify impact where possible (e.g., "this may increase latency by ~200ms")
- Flag risks and suggest mitigations
- Reference specific metrics and thresholds from the page data`,
};

// ============================================================================
// Admin AI Helper Service
// ============================================================================

class AdminAIHelperService {

  /**
   * Process an AI helper request — the main entry point.
   * Builds context from page data, constructs the prompt, calls Bedrock, returns response.
   */
  async chat(request: AIHelperRequest): Promise<AIHelperResponse> {
    const startTime = Date.now();

    // Get tenant config (or create default)
    const config = await bedrockModelDiscoveryService.ensureHelperConfig(request.tenantId);

    if (!config.enabled) {
      return {
        message: 'The AI helper is currently disabled for this tenant. Enable it in Platform Settings → AI Helper.',
        modelId: config.bedrockModelId,
        inputTokens: 0,
        outputTokens: 0,
        latencyMs: 0,
        costCents: 0,
      };
    }

    // Build the system prompt with page context
    const systemPrompt = this.buildSystemPrompt(request.adminPage, config, request.pageContext);

    // Build conversation messages
    const messages: Array<{ role: string; content: string }> = [];

    // Add conversation history (limited by maxContextTokens)
    if (request.conversationHistory && request.conversationHistory.length > 0) {
      // Estimate tokens: ~4 chars per token
      let tokenEstimate = systemPrompt.length / 4;
      const maxTokens = config.maxContextTokens;

      for (const msg of request.conversationHistory.slice(-20)) {
        const msgTokens = msg.content.length / 4;
        if (tokenEstimate + msgTokens > maxTokens) break;
        messages.push({ role: msg.role, content: msg.content });
        tokenEstimate += msgTokens;
      }
    }

    // Add current user message
    messages.push({ role: 'user', content: request.message });

    // Call Bedrock
    const bedrockClient = new BedrockRuntimeClient({
      region: config.bedrockRegion || 'us-east-1',
    });

    const body = {
      anthropic_version: 'bedrock-2023-05-31',
      max_tokens: request.maxTokens || config.maxTokens,
      temperature: request.temperature ?? config.temperature,
      system: systemPrompt,
      messages: messages.map(m => ({
        role: m.role === 'system' ? 'user' : m.role,
        content: m.content,
      })),
    };

    let responseContent = '';
    let inputTokens = 0;
    let outputTokens = 0;

    try {
      const command = new InvokeModelCommand({
        modelId: config.bedrockModelId,
        body: JSON.stringify(body),
        contentType: 'application/json',
      });

      const response = await bedrockClient.send(command);
      const responseBody = JSON.parse(new TextDecoder().decode(response.body));

      responseContent = responseBody.content?.[0]?.text || responseBody.completion || '';
      inputTokens = responseBody.usage?.input_tokens || Math.ceil(JSON.stringify(body).length / 4);
      outputTokens = responseBody.usage?.output_tokens || Math.ceil(responseContent.length / 4);
    } catch (error) {
      logger.error('Bedrock AI helper invocation failed', {
        tenantId: request.tenantId,
        modelId: config.bedrockModelId,
        error: String(error),
      });
      throw new Error(`AI helper request failed: ${error instanceof Error ? error.message : String(error)}`);
    }

    const latencyMs = Date.now() - startTime;

    // Estimate cost
    const model = await bedrockModelDiscoveryService.getModel(config.bedrockModelId);
    const inputCost = (model?.inputPricePer1kTokens || 0.003) * (inputTokens / 1000);
    const outputCost = (model?.outputPricePer1kTokens || 0.015) * (outputTokens / 1000);
    const costCents = (inputCost + outputCost) * 100;

    // Record usage stats
    await bedrockModelDiscoveryService.recordUsage(request.tenantId, inputTokens, outputTokens, costCents);

    // Save conversation to DB
    await this.saveConversation(request.tenantId, request.userId, request.adminPage, 'user', request.message, null, null, null, null, null, request.pageContext || null);
    await this.saveConversation(request.tenantId, request.userId, request.adminPage, 'assistant', responseContent, config.bedrockModelId, inputTokens, outputTokens, latencyMs, costCents, null);

    // Parse recommendations and causal analysis from response
    const recommendations = this.parseRecommendations(responseContent);
    const causalAnalysis = this.parseCausalAnalysis(responseContent);

    return {
      message: responseContent,
      modelId: config.bedrockModelId,
      inputTokens,
      outputTokens,
      latencyMs,
      costCents,
      recommendations: recommendations.length > 0 ? recommendations : undefined,
      causalAnalysis: causalAnalysis || undefined,
    };
  }

  /**
   * Get conversation history for a page
   */
  async getConversationHistory(
    tenantId: string,
    userId: string,
    adminPage: string,
    limit = 50
  ): Promise<ConversationEntry[]> {
    const result = await executeStatement(
      `SELECT * FROM admin_ai_helper_conversations
       WHERE tenant_id = $1::uuid AND user_id = $2::uuid AND admin_page = $3
       ORDER BY created_at DESC LIMIT $4`,
      [
        stringParam('tenantId', tenantId),
        stringParam('userId', userId),
        stringParam('adminPage', adminPage),
        longParam('limit', limit),
      ]
    );

    return (result.rows || []).reverse().map(row => ({
      id: String(row.id),
      tenantId: String(row.tenant_id),
      userId: row.user_id ? String(row.user_id) : null,
      adminPage: String(row.admin_page),
      role: String(row.role),
      content: String(row.content),
      modelId: row.model_id ? String(row.model_id) : null,
      inputTokens: row.input_tokens ? Number(row.input_tokens) : null,
      outputTokens: row.output_tokens ? Number(row.output_tokens) : null,
      latencyMs: row.latency_ms ? Number(row.latency_ms) : null,
      costCents: row.cost_cents ? Number(row.cost_cents) : null,
      pageContext: (row.page_context as Record<string, unknown>) || null,
      createdAt: String(row.created_at),
    }));
  }

  /**
   * Clear conversation history for a page
   */
  async clearConversation(tenantId: string, userId: string, adminPage: string): Promise<void> {
    await executeStatement(
      `DELETE FROM admin_ai_helper_conversations WHERE tenant_id = $1::uuid AND user_id = $2::uuid AND admin_page = $3`,
      [
        stringParam('tenantId', tenantId),
        stringParam('userId', userId),
        stringParam('adminPage', adminPage),
      ]
    );
  }

  /**
   * Get usage summary for the AI helper
   */
  async getUsageSummary(tenantId: string): Promise<{
    totalRequests: number;
    totalInputTokens: number;
    totalOutputTokens: number;
    totalCostCents: number;
    requestsByPage: Array<{ page: string; count: number }>;
    recentConversations: Array<{ page: string; lastMessage: string; createdAt: string }>;
  }> {
    const [config, pageStats, recentResult] = await Promise.all([
      bedrockModelDiscoveryService.getHelperConfig(tenantId),
      executeStatement(
        `SELECT admin_page, COUNT(*) as count FROM admin_ai_helper_conversations
         WHERE tenant_id = $1::uuid AND role = 'user'
         GROUP BY admin_page ORDER BY count DESC`,
        [stringParam('tenantId', tenantId)]
      ),
      executeStatement(
        `SELECT DISTINCT ON (admin_page) admin_page, content, created_at
         FROM admin_ai_helper_conversations
         WHERE tenant_id = $1::uuid AND role = 'user'
         ORDER BY admin_page, created_at DESC LIMIT 10`,
        [stringParam('tenantId', tenantId)]
      ),
    ]);

    return {
      totalRequests: config?.totalRequests || 0,
      totalInputTokens: config?.totalInputTokens || 0,
      totalOutputTokens: config?.totalOutputTokens || 0,
      totalCostCents: config?.totalCostCents || 0,
      requestsByPage: (pageStats.rows || []).map(r => ({ page: String(r.admin_page), count: Number(r.count) })),
      recentConversations: (recentResult.rows || []).map(r => ({ page: String(r.admin_page), lastMessage: String(r.content).substring(0, 200), createdAt: String(r.created_at) })),
    };
  }

  // ==========================================================================
  // Private Helpers
  // ==========================================================================

  private buildSystemPrompt(
    adminPage: string,
    config: AdminAIHelperConfig,
    pageContext?: Record<string, unknown>
  ): string {
    // Use custom system prompt if configured
    if (config.systemPromptOverride) {
      return config.systemPromptOverride;
    }

    // Get page-specific prompt or default
    const pageKey = this.normalizePageKey(adminPage);
    const basePrompt = PAGE_SYSTEM_PROMPTS[pageKey] || PAGE_SYSTEM_PROMPTS['default'];

    let prompt = basePrompt;

    // Add page context if enabled and available
    if (config.includePageData && pageContext && Object.keys(pageContext).length > 0) {
      const contextStr = JSON.stringify(pageContext, null, 2);
      // Limit context size
      const maxContextChars = config.maxContextTokens * 4;
      const truncatedContext = contextStr.length > maxContextChars
        ? contextStr.substring(0, maxContextChars) + '\n... (truncated)'
        : contextStr;

      prompt += `\n\n## Current Page Data\n\nThe administrator is viewing the "${adminPage}" page. Here is the current data on this page:\n\n\`\`\`json\n${truncatedContext}\n\`\`\`\n\nUse this data to provide specific, contextual recommendations. Reference actual values when analyzing.`;
    }

    // Add causal analysis instruction
    prompt += `\n\n## Response Format Guidelines

When the administrator asks about making a change:
1. First, directly answer their question
2. If they're considering a configuration change, include a **Causal Analysis** section:
   - What the change will affect
   - Expected positive and negative effects
   - Confidence level for each prediction
   - Risks and recommended mitigations

When providing recommendations, use this format:
**Recommendation: [Title]**
- Impact: [high/medium/low]
- Category: [performance/cost/security/reliability]
- Action: [specific step to take]
- Reason: [why this matters]

Always be specific. Use numbers from the page data. Don't be vague.`;

    return prompt;
  }

  private normalizePageKey(adminPage: string): string {
    // Convert page paths to lookup keys
    const keyMap: Record<string, string> = {
      '/orchestration/model-weights': 'model-weights',
      '/platform/bedrock-settings': 'bedrock-settings',
      '/security': 'security',
      '/orchestration': 'orchestration',
      'model-weights': 'model-weights',
      'bedrock-settings': 'bedrock-settings',
      'security': 'security',
      'orchestration': 'orchestration',
    };

    for (const [pattern, key] of Object.entries(keyMap)) {
      if (adminPage.includes(pattern)) return key;
    }

    return 'default';
  }

  private parseRecommendations(content: string): AIRecommendation[] {
    const recommendations: AIRecommendation[] = [];

    // Parse structured recommendations from the response
    const recPattern = /\*\*Recommendation:\s*(.+?)\*\*\s*\n([\s\S]*?)(?=\*\*Recommendation:|$)/gi;
    let match;

    while ((match = recPattern.exec(content)) !== null) {
      const title = match[1].trim();
      const body = match[2].trim();

      const impactMatch = body.match(/Impact:\s*(high|medium|low)/i);
      const categoryMatch = body.match(/Category:\s*(\w+)/i);
      const actionMatch = body.match(/Action:\s*(.+?)(?:\n|$)/i);
      const reasonMatch = body.match(/Reason:\s*(.+?)(?:\n|$)/i);

      recommendations.push({
        title,
        description: reasonMatch?.[1]?.trim() || body.substring(0, 200),
        impact: (impactMatch?.[1]?.toLowerCase() as 'high' | 'medium' | 'low') || 'medium',
        category: categoryMatch?.[1]?.toLowerCase() || 'general',
        actionable: !!actionMatch,
        suggestedAction: actionMatch?.[1]?.trim(),
      });
    }

    return recommendations;
  }

  private parseCausalAnalysis(content: string): CausalAnalysis | null {
    // Look for causal analysis section in the response
    const causalMatch = content.match(/(?:##?\s*)?Causal Analysis[:\s]*\n([\s\S]*?)(?=\n##|\n\*\*Recommendation|$)/i);
    if (!causalMatch) return null;

    const section = causalMatch[1];

    // Parse expected effects
    const effects: CausalAnalysis['expectedEffects'] = [];
    const effectPattern = /[-•]\s*\*?\*?(.+?)\*?\*?:\s*(.+?)(?:\((\w+),?\s*confidence:?\s*(\d+)%?\))?$/gim;
    let effectMatch;

    while ((effectMatch = effectPattern.exec(section)) !== null) {
      const area = effectMatch[1].trim();
      const effect = effectMatch[2].trim();
      const direction = effectMatch[3]?.toLowerCase() as 'positive' | 'negative' | 'neutral' || 'neutral';
      const confidence = effectMatch[4] ? Number(effectMatch[4]) / 100 : 0.7;

      effects.push({ area, effect, direction, confidence });
    }

    // Parse risks
    const risks: string[] = [];
    const riskMatch = section.match(/Risks?[:\s]*\n([\s\S]*?)(?=\nMitigation|$)/i);
    if (riskMatch) {
      const riskLines = riskMatch[1].split('\n').filter(l => l.trim().startsWith('-') || l.trim().startsWith('•'));
      risks.push(...riskLines.map(l => l.replace(/^[-•]\s*/, '').trim()).filter(Boolean));
    }

    // Parse mitigations
    const mitigations: string[] = [];
    const mitigationMatch = section.match(/Mitigation[s]?[:\s]*\n([\s\S]*?)$/i);
    if (mitigationMatch) {
      const mitLines = mitigationMatch[1].split('\n').filter(l => l.trim().startsWith('-') || l.trim().startsWith('•'));
      mitigations.push(...mitLines.map(l => l.replace(/^[-•]\s*/, '').trim()).filter(Boolean));
    }

    if (effects.length === 0 && risks.length === 0) return null;

    return {
      proposedChange: 'As discussed',
      expectedEffects: effects,
      risks,
      mitigations,
    };
  }

  private async saveConversation(
    tenantId: string,
    userId: string,
    adminPage: string,
    role: string,
    content: string,
    modelId: string | null,
    inputTokens: number | null,
    outputTokens: number | null,
    latencyMs: number | null,
    costCents: number | null,
    pageContext: Record<string, unknown> | null
  ): Promise<void> {
    await executeStatement(
      `INSERT INTO admin_ai_helper_conversations (tenant_id, user_id, admin_page, role, content, model_id, input_tokens, output_tokens, latency_ms, cost_cents, page_context)
       VALUES ($1::uuid, $2::uuid, $3, $4, $5, $6, $7, $8, $9, $10, $11::jsonb)`,
      [
        stringParam('tenantId', tenantId),
        stringParam('userId', userId),
        stringParam('adminPage', adminPage),
        stringParam('role', role),
        stringParam('content', content),
        stringParam('modelId', modelId || ''),
        inputTokens != null ? longParam('inputTokens', inputTokens) : stringParam('inputTokens', ''),
        outputTokens != null ? longParam('outputTokens', outputTokens) : stringParam('outputTokens', ''),
        latencyMs != null ? longParam('latencyMs', latencyMs) : stringParam('latencyMs', ''),
        costCents != null ? doubleParam('costCents', costCents) : stringParam('costCents', ''),
        stringParam('pageContext', pageContext ? JSON.stringify(pageContext) : '{}'),
      ]
    );
  }
}

export const adminAIHelperService = new AdminAIHelperService();
