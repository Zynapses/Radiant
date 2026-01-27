/**
 * RADIANT v5.43.0 - DIA Engine Miner Service
 * 
 * Core extraction engine that transforms conversations into Decision Intelligence Artifacts.
 * Maps claims to evidence, detects dissent, tags volatile queries, and generates metrics.
 */

import { v4 as uuidv4 } from 'uuid';
import { createHash } from 'crypto';
import { BedrockRuntimeClient, InvokeModelCommand } from '@aws-sdk/client-bedrock-runtime';
import { executeStatement, stringParam, longParam, boolParam } from '../../db/client';
import { logger } from '../../logging/enhanced-logger';
import { generateHeatmapSegments } from './heatmap-generator';
import { detectCompliance } from './compliance-detector';
import {
  DecisionArtifact,
  DecisionArtifactContent,
  Claim,
  EvidenceLink,
  DissentEvent,
  RejectedAlternative,
  VolatileQuery,
  ExecutableAction,
  ArtifactMetrics,
  HeatmapSegment,
  ComplianceMetadata,
  DIAVerificationStatus,
  VolatilityCategory,
} from '@radiant/shared';

const bedrockClient = new BedrockRuntimeClient({});

const EXTRACTION_MODEL = 'anthropic.claude-3-5-sonnet-20241022-v2:0';
const MAX_MESSAGES = 500;

const VOLATILE_TOOLS: Record<string, VolatilityCategory> = {
  'web_search': 'daily',
  'get_stock_price': 'real-time',
  'get_weather': 'real-time',
  'query_database': 'daily',
  'get_exchange_rate': 'real-time',
  'fetch_news': 'daily',
  'get_market_data': 'real-time',
  'search_documents': 'weekly',
  'get_analytics': 'daily',
};

const DISSENT_KEYWORDS = [
  'disagree', 'however', 'risk', 'concern', 'warning',
  'alternatively', 'caution', 'but', 'although', 'despite',
  'overruled', 'rejected', 'incorrect', 'reconsider', 'caveat',
  'limitation', 'uncertainty', 'contradict', 'conflict',
];

interface ConversationMessage {
  id: string;
  role: string;
  content: string;
  model?: string;
  metadata?: Record<string, unknown>;
  created_at: string;
}

interface ToolCall {
  id: string;
  messageId: string;
  toolName: string;
  input: unknown;
  output: unknown;
  timestamp: Date;
  modelId?: string;
}

interface ExtractionContext {
  conversationId: string;
  messages: ConversationMessage[];
  assistantMessages: ConversationMessage[];
  toolCalls: ToolCall[];
  reasoningTraces: Array<{ messageId: string; trace: string; modelId?: string }>;
  primaryDomain?: string;
}

interface GenerateArtifactParams {
  conversationId: string;
  userId: string;
  tenantId: string;
  title?: string;
  templateId?: string;
}

/**
 * Main entry point - generates Decision Artifact from conversation
 */
export async function generateArtifact(
  params: GenerateArtifactParams
): Promise<DecisionArtifact> {
  const { conversationId, userId, tenantId, title } = params;

  // Phase 1: Extract conversation data
  const context = await extractConversationData(conversationId, tenantId);

  // Phase 2: Map claims to evidence using LLM
  const claims = await mapClaimsToEvidence(context);

  // Phase 3: Detect dissent patterns
  const { dissentEvents, rejectedAlternatives } = await analyzeDissentPatterns(context, claims);

  // Phase 4: Tag volatile queries
  const volatileQueries = tagVolatileQueries(context, claims);

  // Phase 5: Calculate document positions
  const positionedClaims = calculateDocumentPositions(claims);

  // Phase 6: Generate heatmap
  const heatmapSegments = generateHeatmapSegments(positionedClaims);

  // Phase 7: Detect compliance
  const compliance = await detectCompliance(context, positionedClaims);

  // Phase 8: Extract actions
  const actions = extractExecutableActions(positionedClaims);

  // Phase 9: Calculate metrics
  const metrics = calculateMetrics(
    positionedClaims,
    dissentEvents,
    rejectedAlternatives,
    volatileQueries,
    context
  );

  // Phase 10: Build artifact content
  const artifactContent: DecisionArtifactContent = {
    schema_version: '2.0',
    claims: positionedClaims,
    dissent_events: dissentEvents,
    rejected_alternatives: rejectedAlternatives,
    volatile_queries: volatileQueries,
    executable_actions: actions,
    compliance,
    metrics,
    heatmap_segments: heatmapSegments,
  };

  // Phase 11: Persist to database
  const artifactId = uuidv4();
  const artifactTitle = title || generateTitle(positionedClaims);

  await executeStatement(
    `INSERT INTO decision_artifacts (
      id, conversation_id, user_id, tenant_id,
      title, artifact_content, miner_model, extraction_confidence,
      heatmap_data, compliance_frameworks, phi_detected, pii_detected,
      primary_domain
    ) VALUES (
      $1, $2, $3, $4,
      $5, $6::jsonb, $7, $8,
      $9::jsonb, $10, $11, $12,
      $13
    )`,
    [
      stringParam('id', artifactId),
      stringParam('conversationId', conversationId),
      stringParam('userId', userId),
      stringParam('tenantId', tenantId),
      stringParam('title', artifactTitle),
      stringParam('artifactContent', JSON.stringify(artifactContent)),
      stringParam('minerModel', EXTRACTION_MODEL),
      stringParam('extractionConfidence', metrics.overall_confidence.toString()),
      stringParam('heatmapData', JSON.stringify(heatmapSegments)),
      stringParam('complianceFrameworks', `{${compliance.frameworks_applicable.join(',')}}`),
      boolParam('phiDetected', compliance.hipaa?.phi_present || false),
      boolParam('piiDetected', compliance.gdpr?.pii_present || false),
      stringParam('primaryDomain', context.primaryDomain || ''),
    ]
  );

  // Log access for audit
  await logArtifactAccess(artifactId, tenantId, userId, 'created');

  return {
    id: artifactId,
    conversationId,
    userId,
    tenantId,
    title: artifactTitle,
    status: 'active',
    version: 1,
    artifactContent,
    minerModel: EXTRACTION_MODEL,
    extractionConfidence: metrics.overall_confidence,
    extractionTimestamp: new Date().toISOString(),
    validationStatus: 'fresh',
    stalenessThresholdDays: 7,
    heatmapData: heatmapSegments,
    complianceFrameworks: compliance.frameworks_applicable,
    phiDetected: compliance.hipaa?.phi_present || false,
    piiDetected: compliance.gdpr?.pii_present || false,
    dataClassification: compliance.hipaa?.phi_present ? 'confidential' : 'internal',
    primaryDomain: context.primaryDomain,
    secondaryDomains: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

/**
 * Extract conversation data from database
 */
async function extractConversationData(
  conversationId: string,
  tenantId: string
): Promise<ExtractionContext> {
  // Fetch messages from conversation
  const messagesResult = await executeStatement<ConversationMessage>(
    `SELECT m.id, m.role, m.content, m.model, m.metadata, m.created_at
     FROM thinktank_messages m
     JOIN thinktank_conversations c ON m.conversation_id = c.id
     WHERE m.conversation_id = $1
       AND c.tenant_id = $2
     ORDER BY m.created_at ASC
     LIMIT $3`,
    [
      stringParam('conversationId', conversationId),
      stringParam('tenantId', tenantId),
      longParam('limit', MAX_MESSAGES),
    ]
  );

  const messages = messagesResult.rows;

  // Get conversation metadata
  const convResult = await executeStatement<{ domain_mode: string }>(
    `SELECT domain_mode FROM thinktank_conversations WHERE id = $1`,
    [stringParam('conversationId', conversationId)]
  );

  const primaryDomain = convResult.rows[0]?.domain_mode;

  // Extract tool calls from message metadata
  const toolCalls: ToolCall[] = [];
  const reasoningTraces: Array<{ messageId: string; trace: string; modelId?: string }> = [];

  for (const message of messages) {
    if (message.metadata) {
      const metadata = typeof message.metadata === 'string' 
        ? JSON.parse(message.metadata) 
        : message.metadata;

      // Extract tool calls
      if (metadata.tool_calls && Array.isArray(metadata.tool_calls)) {
        for (const tc of metadata.tool_calls) {
          toolCalls.push({
            id: tc.id || uuidv4(),
            messageId: message.id,
            toolName: tc.name || tc.tool_name,
            input: tc.input || tc.arguments,
            output: tc.output || tc.result,
            timestamp: new Date(message.created_at),
            modelId: message.model,
          });
        }
      }

      // Extract reasoning traces (extended thinking)
      if (metadata.reasoning_trace || metadata.thinking) {
        reasoningTraces.push({
          messageId: message.id,
          trace: metadata.reasoning_trace || metadata.thinking,
          modelId: message.model,
        });
      }
    }
  }

  return {
    conversationId,
    messages,
    assistantMessages: messages.filter((m) => m.role === 'assistant'),
    toolCalls,
    reasoningTraces,
    primaryDomain,
  };
}

/**
 * Use LLM to extract and map claims to evidence
 */
async function mapClaimsToEvidence(context: ExtractionContext): Promise<Claim[]> {
  const prompt = buildClaimExtractionPrompt(context);

  const requestBody = {
    anthropic_version: 'bedrock-2023-05-31',
    max_tokens: 4096,
    messages: [{ role: 'user', content: prompt }],
  };

  const command = new InvokeModelCommand({
    modelId: EXTRACTION_MODEL,
    contentType: 'application/json',
    accept: 'application/json',
    body: JSON.stringify(requestBody),
  });

  const response = await bedrockClient.send(command);
  const responseBody = JSON.parse(new TextDecoder().decode(response.body));
  const content = responseBody.content?.[0]?.text || '{"claims":[]}';

  // Parse JSON from response (handle markdown code blocks)
  let extracted: { claims: unknown[] };
  try {
    const jsonMatch = content.match(/```json\s*([\s\S]*?)\s*```/) || 
                      content.match(/\{[\s\S]*\}/);
    const jsonStr = jsonMatch ? (jsonMatch[1] || jsonMatch[0]) : content;
    extracted = JSON.parse(jsonStr);
  } catch {
    logger.error('Failed to parse claim extraction response', { content });
    extracted = { claims: [] };
  }

  return (extracted.claims || []).map((claim: unknown) =>
    enrichClaimWithEvidence(claim as Record<string, unknown>, context)
  );
}

/**
 * Build the prompt for claim extraction
 */
function buildClaimExtractionPrompt(context: ExtractionContext): string {
  const messagesText = context.assistantMessages
    .map((m) => `[MSG-${m.id}] ${m.content.slice(0, 2000)}`)
    .join('\n\n');

  const toolCallsText = context.toolCalls
    .map((tc) => `[TC-${tc.id}] ${tc.toolName}: ${JSON.stringify(tc.input).slice(0, 200)}`)
    .join('\n');

  return `You are a forensic analyst extracting structured decision data from an AI conversation.

TASK: Identify all claims, conclusions, findings, recommendations, and warnings in the assistant's responses.
For each claim, identify which tool calls (if any) provide supporting evidence.

RULES:
1. Extract SPECIFIC claims, not general summaries
2. Each claim must reference tool_call_ids where evidence exists
3. Mark claims without tool evidence as "unverified"
4. Identify contested or qualified claims (hedged language, caveats)
5. Detect any PHI (health info) or PII (personal info)

ASSISTANT MESSAGES:
${messagesText}

TOOL CALLS AVAILABLE:
${toolCallsText || '(none)'}

OUTPUT FORMAT (JSON only, no markdown):
{
  "claims": [
    {
      "claim_text": "The specific claim or conclusion text",
      "claim_type": "conclusion|finding|recommendation|warning|fact",
      "confidence": 0.95,
      "source_model": "model-name",
      "contributing_models": [],
      "is_contested": false,
      "source_message_ids": ["MSG-xxx"],
      "evidence_references": [{"tool_call_id": "TC-xxx", "tool_name": "name", "relevance": "why this supports the claim"}],
      "contains_phi": false,
      "contains_pii": false
    }
  ]
}`;
}

/**
 * Enrich extracted claim with full evidence links
 */
function enrichClaimWithEvidence(
  extractedClaim: Record<string, unknown>,
  context: ExtractionContext
): Claim {
  const evidenceRefs = (extractedClaim.evidence_references || []) as Array<{
    tool_call_id: string;
    tool_name: string;
  }>;

  const evidenceLinks: EvidenceLink[] = evidenceRefs
    .map((ref) => {
      const tc = context.toolCalls.find((t) => `TC-${t.id}` === ref.tool_call_id || t.id === ref.tool_call_id);
      if (!tc) return null;

      const volatility = VOLATILE_TOOLS[tc.toolName] || 'stable';

      return {
        evidence_id: `ev-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
        evidence_type: 'tool_call' as const,
        tool_call_id: tc.id,
        message_id: tc.messageId,
        evidence_snapshot: {
          tool_name: tc.toolName,
          input_summary: JSON.stringify(tc.input).slice(0, 200),
          output_summary: JSON.stringify(tc.output).slice(0, 500),
          raw_output: tc.output,
          timestamp: tc.timestamp.toISOString(),
        },
        is_volatile: volatility !== 'stable',
        volatility_category: volatility as VolatilityCategory,
      };
    })
    .filter((e): e is any => e !== null) as EvidenceLink[];

  const verificationStatus: DIAVerificationStatus =
    evidenceLinks.length === 0
      ? 'unverified'
      : (extractedClaim.is_contested as boolean)
        ? 'contested'
        : 'verified';

  const confidence = (extractedClaim.confidence as number) || 0.5;

  return {
    claim_id: `claim-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
    text: (extractedClaim.claim_text as string) || '',
    claim_type: (extractedClaim.claim_type as Claim['claim_type']) || 'finding',
    supporting_evidence: evidenceLinks,
    verification_status: verificationStatus,
    confidence_score: confidence,
    volatility_score: evidenceLinks.filter((e) => e.is_volatile).length / Math.max(evidenceLinks.length, 1),
    risk_score: (extractedClaim.is_contested as boolean) ? 0.7 : 0.2,
    primary_model: (extractedClaim.source_model as string) || 'unknown',
    contributing_models: (extractedClaim.contributing_models as string[]) || [],
    document_position: { start_fraction: 0, end_fraction: 0 },
    source_message_ids: ((extractedClaim.source_message_ids as string[]) || []).map(
      (id) => id.replace('MSG-', '')
    ),
    text_spans: [],
    is_stale: false,
    contains_phi: (extractedClaim.contains_phi as boolean) || false,
    contains_pii: (extractedClaim.contains_pii as boolean) || false,
    sensitivity_level: (extractedClaim.contains_phi as boolean)
      ? 'high'
      : (extractedClaim.contains_pii as boolean)
        ? 'medium'
        : 'low',
  };
}

/**
 * Analyze reasoning traces for dissent patterns
 */
async function analyzeDissentPatterns(
  context: ExtractionContext,
  claims: Claim[]
): Promise<{ dissentEvents: DissentEvent[]; rejectedAlternatives: RejectedAlternative[] }> {
  const dissentEvents: DissentEvent[] = [];
  const rejectedAlternatives: RejectedAlternative[] = [];

  for (const trace of context.reasoningTraces) {
    const hasDissentSignal = DISSENT_KEYWORDS.some((kw) =>
      trace.trace.toLowerCase().includes(kw)
    );

    if (hasDissentSignal) {
      // Simple dissent detection without additional LLM call
      dissentEvents.push({
        dissent_id: `dissent-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
        contested_claim_id: undefined,
        contested_position: extractDissentPosition(trace.trace),
        dissenting_model: trace.modelId || 'unknown',
        dissent_reason: 'Dissent keywords detected in reasoning trace',
        dissent_severity: 'minor',
        resolution: 'unresolved',
        source_message_id: trace.messageId,
        reasoning_trace_excerpt: trace.trace.slice(0, 500),
        is_primary_dissent: false,
      });
    }
  }

  // Mark primary dissent (first/highest severity)
  if (dissentEvents.length > 0) {
    dissentEvents.sort((a, b) => {
      const rank = { significant: 3, moderate: 2, minor: 1 };
      return (rank[b.dissent_severity] || 0) - (rank[a.dissent_severity] || 0);
    });
    dissentEvents[0].is_primary_dissent = true;
    dissentEvents[0].ghost_path_data = {
      branch_point_position: 0.5,
      alternate_outcome: dissentEvents[0].contested_position,
    };
  }

  return { dissentEvents, rejectedAlternatives };
}

/**
 * Extract dissent position from trace text
 */
function extractDissentPosition(trace: string): string {
  // Look for common dissent patterns
  const patterns = [
    /however[,\s]+(.{20,100})/i,
    /but[,\s]+(.{20,100})/i,
    /alternatively[,\s]+(.{20,100})/i,
    /risk[:\s]+(.{20,100})/i,
    /concern[:\s]+(.{20,100})/i,
  ];

  for (const pattern of patterns) {
    const match = trace.match(pattern);
    if (match) {
      return match[1].trim();
    }
  }

  return 'Detected uncertainty or alternative consideration in reasoning';
}

/**
 * Tag volatile queries based on tool type
 */
function tagVolatileQueries(context: ExtractionContext, claims: Claim[]): VolatileQuery[] {
  return context.toolCalls
    .filter((tc) => VOLATILE_TOOLS[tc.toolName] && VOLATILE_TOOLS[tc.toolName] !== 'stable')
    .map((tc) => {
      const volatility = VOLATILE_TOOLS[tc.toolName];
      const thresholdHours =
        volatility === 'real-time' ? 1 : volatility === 'daily' ? 24 : 168;

      return {
        query_id: `vq-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
        tool_name: tc.toolName,
        original_query: tc.input,
        original_result_hash: createHash('sha256')
          .update(JSON.stringify(tc.output))
          .digest('hex'),
        last_verified_at: tc.timestamp.toISOString(),
        dependent_claim_ids: claims
          .filter((c) => c.supporting_evidence.some((e) => e.tool_call_id === tc.id))
          .map((c) => c.claim_id),
        staleness_threshold_hours: thresholdHours,
        volatility_category: volatility,
      };
    });
}

/**
 * Calculate document positions for claims
 */
function calculateDocumentPositions(claims: Claim[]): Claim[] {
  if (claims.length === 0) return [];

  const totalLength = claims.reduce((sum, c) => sum + c.text.length, 0);
  let currentPosition = 0;

  return claims.map((claim) => {
    const startFraction = currentPosition / totalLength;
    currentPosition += claim.text.length;
    return {
      ...claim,
      document_position: {
        start_fraction: startFraction,
        end_fraction: currentPosition / totalLength,
      },
    };
  });
}

/**
 * Extract executable actions from claims
 */
function extractExecutableActions(claims: Claim[]): ExecutableAction[] {
  // Basic actions - could be expanded with more sophisticated detection
  const actions: ExecutableAction[] = [
    {
      action_id: `action-continue-${Date.now()}`,
      label: 'Continue Discussion',
      description: 'Start a new conversation referencing this decision record',
      action_type: 'new_conversation',
      signed_token: '',
      token_expires_at: '',
      action_payload: {},
      requires_confirmation: false,
    },
  ];

  // Add recommendation-based actions
  const recommendations = claims.filter((c) => c.claim_type === 'recommendation');
  for (const rec of recommendations.slice(0, 3)) {
    actions.push({
      action_id: `action-rec-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
      label: `Review: ${rec.text.slice(0, 30)}...`,
      description: rec.text,
      action_type: 'new_conversation',
      signed_token: '',
      token_expires_at: '',
      action_payload: { recommendation_claim_id: rec.claim_id },
      requires_confirmation: false,
    });
  }

  return actions;
}

/**
 * Calculate artifact metrics
 */
function calculateMetrics(
  claims: Claim[],
  dissentEvents: DissentEvent[],
  rejectedAlternatives: RejectedAlternative[],
  volatileQueries: VolatileQuery[],
  context: ExtractionContext
): ArtifactMetrics {
  const verified = claims.filter((c) => c.verification_status === 'verified').length;
  const unverified = claims.filter((c) => c.verification_status === 'unverified').length;
  const contested = claims.filter((c) => c.verification_status === 'contested').length;

  const avgConfidence =
    claims.length > 0
      ? claims.reduce((sum, c) => sum + c.confidence_score, 0) / claims.length
      : 0;

  const avgVolatility =
    claims.length > 0
      ? claims.reduce((sum, c) => sum + c.volatility_score, 0) / claims.length
      : 0;

  const avgRisk =
    claims.length > 0
      ? claims.reduce((sum, c) => sum + c.risk_score, 0) / claims.length
      : 0;

  return {
    total_claims: claims.length,
    verified_claims: verified,
    unverified_claims: unverified,
    contested_claims: contested,
    total_evidence_links: claims.reduce((sum, c) => sum + c.supporting_evidence.length, 0),
    dissent_events_count: dissentEvents.length,
    rejected_alternatives_count: rejectedAlternatives.length,
    volatile_data_points: volatileQueries.length,
    overall_confidence: avgConfidence,
    overall_volatility: avgVolatility,
    overall_risk: avgRisk,
    models_involved: [
      ...new Set(
        claims.flatMap((c) => [c.primary_model, ...c.contributing_models])
      ),
    ].filter(Boolean),
    orchestration_methods_used: [],
    primary_domains: context.primaryDomain ? [context.primaryDomain] : [],
    extraction_quality: {
      fact_coverage: verified / Math.max(claims.length, 1),
      dissent_capture: dissentEvents.length > 0 ? 1 : 0,
      volatility_detection: volatileQueries.length > 0 ? 1 : 0,
    },
  };
}

/**
 * Generate a title from claims
 */
function generateTitle(claims: Claim[]): string {
  const conclusions = claims.filter((c) => c.claim_type === 'conclusion');
  if (conclusions.length > 0) {
    return conclusions[0].text.slice(0, 100);
  }
  const findings = claims.filter((c) => c.claim_type === 'finding');
  if (findings.length > 0) {
    return findings[0].text.slice(0, 100);
  }
  return `Decision Record - ${new Date().toLocaleDateString()}`;
}

/**
 * Log artifact access for audit trail
 */
async function logArtifactAccess(
  artifactId: string,
  tenantId: string,
  userId: string,
  action: string
): Promise<void> {
  await executeStatement(
    `INSERT INTO decision_artifact_access_log (artifact_id, tenant_id, user_id, action)
     VALUES ($1, $2, $3, $4)`,
    [
      stringParam('artifactId', artifactId),
      stringParam('tenantId', tenantId),
      stringParam('userId', userId),
      stringParam('action', action),
    ]
  );
}
