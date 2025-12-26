import { BedrockRuntimeClient, InvokeModelCommand } from '@aws-sdk/client-bedrock-runtime';
import { executeStatement } from '../db/client';
import { createHash } from 'crypto';

type EvidenceType = 
  | 'workflow_failure' | 'negative_feedback' | 'manual_override' | 'regenerate_request'
  | 'abandon_session' | 'low_confidence_completion' | 'explicit_request';

type ProposalStatus = 'pending' | 'reviewing' | 'approved' | 'rejected' | 'deferred';

interface EvidenceRecord {
  userId?: string;
  sessionId?: string;
  executionId?: string;
  evidenceType: EvidenceType;
  originalRequest?: string;
  attemptedWorkflowId?: string;
  failureReason?: string;
  userFeedback?: string;
  evidenceData?: Record<string, unknown>;
}

const DEFAULT_EVIDENCE_WEIGHTS: Record<EvidenceType, number> = {
  workflow_failure: 0.40,
  negative_feedback: 0.35,
  manual_override: 0.15,
  regenerate_request: 0.10,
  abandon_session: 0.20,
  low_confidence_completion: 0.15,
  explicit_request: 0.50,
};

const THRESHOLDS = {
  occurrenceCount: 10,
  uniqueUsers: 3,
  totalEvidenceScore: 2.0,
  neuralConfidence: 0.7,
};

export class WorkflowProposalService {
  private bedrock: BedrockRuntimeClient;

  constructor() {
    this.bedrock = new BedrockRuntimeClient({});
  }

  async recordEvidence(tenantId: string, evidence: EvidenceRecord): Promise<string> {
    // Generate pattern signature and hash
    const signature = {
      intent: evidence.originalRequest?.substring(0, 200) || '',
      evidenceType: evidence.evidenceType,
      failureReason: evidence.failureReason,
    };
    const patternHash = createHash('sha256').update(JSON.stringify(signature)).digest('hex');

    // Get or create pattern
    const patternId = await this.getOrCreatePattern(tenantId, patternHash, signature, evidence);

    // Get evidence weight
    const weight = await this.getEvidenceWeight(tenantId, evidence.evidenceType);

    // Record evidence
    await executeStatement(
      `INSERT INTO neural_need_evidence 
       (tenant_id, pattern_id, user_id, session_id, execution_id, evidence_type, evidence_weight,
        evidence_data, original_request, attempted_workflow_id, failure_reason, user_feedback)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
       RETURNING id`,
      [
        { name: 'tenantId', value: { stringValue: tenantId } },
        { name: 'patternId', value: { stringValue: patternId } },
        { name: 'userId', value: evidence.userId ? { stringValue: evidence.userId } : { isNull: true } },
        { name: 'sessionId', value: evidence.sessionId ? { stringValue: evidence.sessionId } : { isNull: true } },
        { name: 'executionId', value: evidence.executionId ? { stringValue: evidence.executionId } : { isNull: true } },
        { name: 'evidenceType', value: { stringValue: evidence.evidenceType } },
        { name: 'evidenceWeight', value: { doubleValue: weight } },
        { name: 'evidenceData', value: { stringValue: JSON.stringify(evidence.evidenceData || {}) } },
        { name: 'originalRequest', value: evidence.originalRequest ? { stringValue: evidence.originalRequest } : { isNull: true } },
        { name: 'attemptedWorkflowId', value: evidence.attemptedWorkflowId ? { stringValue: evidence.attemptedWorkflowId } : { isNull: true } },
        { name: 'failureReason', value: evidence.failureReason ? { stringValue: evidence.failureReason } : { isNull: true } },
        { name: 'userFeedback', value: evidence.userFeedback ? { stringValue: evidence.userFeedback } : { isNull: true } },
      ]
    );

    // Update pattern metrics
    await this.updatePatternMetrics(patternId, weight, evidence.userId);

    // Check if thresholds are met
    await this.checkAndTriggerProposal(patternId, tenantId);

    return patternId;
  }

  async getPendingProposals(tenantId: string): Promise<unknown[]> {
    const result = await executeStatement(
      `SELECT wp.*, nnp.pattern_name, nnp.detected_intent, nnp.evidence_count
       FROM workflow_proposals wp
       JOIN neural_need_patterns nnp ON wp.source_pattern_id = nnp.id
       WHERE wp.tenant_id = $1 AND wp.admin_status = 'pending'
       ORDER BY wp.neural_confidence DESC`,
      [{ name: 'tenantId', value: { stringValue: tenantId } }]
    );
    return result.rows;
  }

  async reviewProposal(
    proposalId: string,
    adminId: string,
    decision: ProposalStatus,
    notes?: string,
    modifications?: Record<string, unknown>
  ): Promise<void> {
    await executeStatement(
      `UPDATE workflow_proposals
       SET admin_status = $2, admin_reviewer_id = $3, admin_review_timestamp = NOW(),
           admin_notes = $4, admin_modifications = $5, updated_at = NOW()
       WHERE id = $1`,
      [
        { name: 'proposalId', value: { stringValue: proposalId } },
        { name: 'decision', value: { stringValue: decision } },
        { name: 'adminId', value: { stringValue: adminId } },
        { name: 'notes', value: notes ? { stringValue: notes } : { isNull: true } },
        { name: 'modifications', value: modifications ? { stringValue: JSON.stringify(modifications) } : { isNull: true } },
      ]
    );

    if (decision === 'approved') {
      // Mark pattern as resolved
      const proposalResult = await executeStatement(
        `SELECT source_pattern_id FROM workflow_proposals WHERE id = $1`,
        [{ name: 'proposalId', value: { stringValue: proposalId } }]
      );

      if (proposalResult.rows.length > 0) {
        const patternId = String((proposalResult.rows[0] as Record<string, unknown>).source_pattern_id);
        await executeStatement(
          `UPDATE neural_need_patterns SET status = 'resolved', updated_at = NOW() WHERE id = $1`,
          [{ name: 'patternId', value: { stringValue: patternId } }]
        );
      }
    }
  }

  async getEvidenceForPattern(patternId: string): Promise<unknown[]> {
    const result = await executeStatement(
      `SELECT * FROM neural_need_evidence WHERE pattern_id = $1 ORDER BY occurred_at DESC`,
      [{ name: 'patternId', value: { stringValue: patternId } }]
    );
    return result.rows;
  }

  private async getOrCreatePattern(
    tenantId: string,
    patternHash: string,
    signature: Record<string, unknown>,
    evidence: EvidenceRecord
  ): Promise<string> {
    const existingResult = await executeStatement(
      `SELECT id FROM neural_need_patterns WHERE tenant_id = $1 AND pattern_hash = $2`,
      [
        { name: 'tenantId', value: { stringValue: tenantId } },
        { name: 'patternHash', value: { stringValue: patternHash } },
      ]
    );

    if (existingResult.rows.length > 0) {
      return String((existingResult.rows[0] as Record<string, unknown>).id);
    }

    // Create new pattern
    const patternName = `Need: ${evidence.evidenceType.replace(/_/g, ' ')}`;
    const detectedIntent = evidence.originalRequest?.substring(0, 500) || 'Unknown intent';

    const result = await executeStatement(
      `INSERT INTO neural_need_patterns 
       (tenant_id, pattern_hash, pattern_signature, pattern_name, detected_intent, existing_workflow_gaps)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id`,
      [
        { name: 'tenantId', value: { stringValue: tenantId } },
        { name: 'patternHash', value: { stringValue: patternHash } },
        { name: 'patternSignature', value: { stringValue: JSON.stringify(signature) } },
        { name: 'patternName', value: { stringValue: patternName } },
        { name: 'detectedIntent', value: { stringValue: detectedIntent } },
        { name: 'existingWorkflowGaps', value: evidence.attemptedWorkflowId ? { stringValue: `{${evidence.attemptedWorkflowId}}` } : { isNull: true } },
      ]
    );

    return String((result.rows[0] as Record<string, unknown>).id);
  }

  private async updatePatternMetrics(patternId: string, weight: number, userId?: string): Promise<void> {
    // Update evidence count and score
    await executeStatement(
      `UPDATE neural_need_patterns
       SET total_evidence_score = total_evidence_score + $2,
           evidence_count = evidence_count + 1,
           last_occurrence = NOW(),
           updated_at = NOW()
       WHERE id = $1`,
      [
        { name: 'patternId', value: { stringValue: patternId } },
        { name: 'weight', value: { doubleValue: weight } },
      ]
    );

    // Update unique users count
    if (userId) {
      const userCount = await executeStatement(
        `SELECT COUNT(DISTINCT user_id) as count FROM neural_need_evidence WHERE pattern_id = $1`,
        [{ name: 'patternId', value: { stringValue: patternId } }]
      );

      const count = parseInt(String((userCount.rows[0] as Record<string, unknown>).count), 10);

      await executeStatement(
        `UPDATE neural_need_patterns SET unique_users_affected = $2 WHERE id = $1`,
        [
          { name: 'patternId', value: { stringValue: patternId } },
          { name: 'count', value: { longValue: count } },
        ]
      );
    }
  }

  private async checkAndTriggerProposal(patternId: string, tenantId: string): Promise<void> {
    const patternResult = await executeStatement(
      `SELECT * FROM neural_need_patterns WHERE id = $1`,
      [{ name: 'patternId', value: { stringValue: patternId } }]
    );

    if (patternResult.rows.length === 0) return;

    const pattern = patternResult.rows[0] as Record<string, unknown>;

    // Check thresholds
    const evidenceCount = parseInt(String(pattern.evidence_count), 10);
    const uniqueUsers = parseInt(String(pattern.unique_users_affected), 10);
    const totalScore = Number(pattern.total_evidence_score);

    const occurrenceMet = evidenceCount >= THRESHOLDS.occurrenceCount;
    const impactMet = uniqueUsers >= THRESHOLDS.uniqueUsers;
    const confidenceMet = totalScore >= THRESHOLDS.totalEvidenceScore;

    // Update threshold flags
    await executeStatement(
      `UPDATE neural_need_patterns
       SET occurrence_threshold_met = $2, impact_threshold_met = $3, confidence_threshold_met = $4
       WHERE id = $1`,
      [
        { name: 'patternId', value: { stringValue: patternId } },
        { name: 'occurrenceMet', value: { booleanValue: occurrenceMet } },
        { name: 'impactMet', value: { booleanValue: impactMet } },
        { name: 'confidenceMet', value: { booleanValue: confidenceMet } },
      ]
    );

    // If all thresholds met and no proposal exists, generate one
    if (occurrenceMet && impactMet && confidenceMet && pattern.status === 'accumulating') {
      await this.generateProposal(patternId, tenantId, pattern);
    }
  }

  private async generateProposal(
    patternId: string,
    tenantId: string,
    pattern: Record<string, unknown>
  ): Promise<void> {
    // Update pattern status
    await executeStatement(
      `UPDATE neural_need_patterns SET status = 'threshold_met' WHERE id = $1`,
      [{ name: 'patternId', value: { stringValue: patternId } }]
    );

    // Generate proposal code
    const year = new Date().getFullYear();
    const countResult = await executeStatement(
      `SELECT COUNT(*) as count FROM workflow_proposals WHERE tenant_id = $1`,
      [{ name: 'tenantId', value: { stringValue: tenantId } }]
    );
    const count = parseInt(String((countResult.rows[0] as Record<string, unknown>).count), 10) + 1;
    const proposalCode = `WP-${year}-${String(count).padStart(3, '0')}`;

    // Create proposal (simplified - in production this would use Neural Engine to generate workflow)
    const proposalName = `Proposed: ${String(pattern.pattern_name).substring(0, 200)}`;
    const reasoning = `Generated based on ${pattern.evidence_count} occurrences from ${pattern.unique_users_affected} users with total evidence score of ${Number(pattern.total_evidence_score).toFixed(2)}.`;

    const result = await executeStatement(
      `INSERT INTO workflow_proposals 
       (tenant_id, proposal_code, proposal_name, proposal_description, source_pattern_id,
        proposed_workflow, neural_confidence, neural_reasoning)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING id`,
      [
        { name: 'tenantId', value: { stringValue: tenantId } },
        { name: 'proposalCode', value: { stringValue: proposalCode } },
        { name: 'proposalName', value: { stringValue: proposalName } },
        { name: 'proposalDescription', value: { stringValue: String(pattern.detected_intent) } },
        { name: 'sourcePatternId', value: { stringValue: patternId } },
        { name: 'proposedWorkflow', value: { stringValue: JSON.stringify({ type: 'generated', source: 'neural_engine' }) } },
        { name: 'neuralConfidence', value: { doubleValue: 0.75 } },
        { name: 'neuralReasoning', value: { stringValue: reasoning } },
      ]
    );

    const proposalId = String((result.rows[0] as Record<string, unknown>).id);

    // Link proposal to pattern
    await executeStatement(
      `UPDATE neural_need_patterns SET status = 'proposal_generated', proposal_id = $2, updated_at = NOW() WHERE id = $1`,
      [
        { name: 'patternId', value: { stringValue: patternId } },
        { name: 'proposalId', value: { stringValue: proposalId } },
      ]
    );
  }

  private async getEvidenceWeight(tenantId: string, evidenceType: EvidenceType): Promise<number> {
    // Check for tenant-specific weight
    const result = await executeStatement(
      `SELECT weight FROM proposal_evidence_weights 
       WHERE (tenant_id = $1 OR tenant_id IS NULL) AND evidence_type = $2
       ORDER BY tenant_id NULLS LAST LIMIT 1`,
      [
        { name: 'tenantId', value: { stringValue: tenantId } },
        { name: 'evidenceType', value: { stringValue: evidenceType } },
      ]
    );

    if (result.rows.length > 0) {
      return Number((result.rows[0] as Record<string, unknown>).weight);
    }

    return DEFAULT_EVIDENCE_WEIGHTS[evidenceType] || 0.1;
  }
}

export const workflowProposalService = new WorkflowProposalService();
