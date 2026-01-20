/**
 * RADIANT v4.18.0 - Enhanced Collaboration Service
 * Handles all novel collaboration features
 */

import { Pool } from 'pg';
import { S3Client, PutObjectCommand, DeleteObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { v4 as uuidv4 } from 'uuid';
import {
  GuestInvite,
  CollaborationGuest,
  CreateGuestInviteRequest,
  JoinAsGuestRequest,
  FacilitatorConfig,
  EnableFacilitatorRequest,
  FacilitatorIntervention,
  InterventionType,
  ConversationBranch,
  CreateBranchRequest,
  BranchMergeRequest,
  CreateMergeRequestRequest,
  SessionRecording,
  SessionMediaNote,
  CreateMediaNoteRequest,
  AsyncAnnotation,
  AIRoundtable,
  CreateRoundtableRequest,
  RoundtableContribution,
  ModelParticipant,
  KnowledgeGraph,
  KnowledgeNode,
  KnowledgeEdge,
  CreateNodeRequest,
  CreateEdgeRequest,
  CollaborationAttachment,
  EnhancedCollaborativeSession,
} from '@radiant/shared';

const s3Client = new S3Client({ region: process.env.AWS_REGION || 'us-east-1' });
const COLLABORATION_BUCKET = process.env.COLLABORATION_BUCKET || 'radiant-collaboration-assets';

export class EnhancedCollaborationService {
  constructor(private pool: Pool) {}

  // ============================================================================
  // CROSS-TENANT GUEST ACCESS
  // ============================================================================

  async createGuestInvite(
    tenantId: string,
    userId: string,
    request: CreateGuestInviteRequest
  ): Promise<GuestInvite> {
    const result = await this.pool.query(
      `INSERT INTO collaboration_guest_invites 
       (session_id, invite_type, guest_email, guest_name, permission, expires_at, max_uses, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING *`,
      [
        request.sessionId,
        request.inviteType,
        request.guestEmail,
        request.guestName,
        request.permission || 'commenter',
        request.expiresAt,
        request.maxUses || 1,
        userId,
      ]
    );
    return this.mapGuestInvite(result.rows[0]);
  }

  async getInviteByToken(token: string): Promise<GuestInvite | null> {
    const result = await this.pool.query(
      `SELECT * FROM collaboration_guest_invites WHERE invite_token = $1`,
      [token]
    );
    return result.rows[0] ? this.mapGuestInvite(result.rows[0]) : null;
  }

  async joinAsGuest(request: JoinAsGuestRequest): Promise<CollaborationGuest> {
    const invite = await this.getInviteByToken(request.inviteToken);
    if (!invite) throw new Error('Invalid invite token');
    if (invite.expiresAt && new Date(invite.expiresAt) < new Date()) {
      throw new Error('Invite has expired');
    }
    if (invite.maxUses > 0 && invite.currentUses >= invite.maxUses) {
      throw new Error('Invite has reached maximum uses');
    }

    const colors = ['#ef4444', '#f97316', '#eab308', '#22c55e', '#14b8a6', '#3b82f6', '#8b5cf6', '#ec4899'];
    const color = colors[Math.floor(Math.random() * colors.length)];

    const result = await this.pool.query(
      `INSERT INTO collaboration_guests 
       (invite_id, session_id, display_name, email, permission, color, is_online)
       VALUES ($1, $2, $3, $4, $5, $6, true)
       RETURNING *`,
      [invite.id, invite.sessionId, request.displayName, request.email, invite.permission, color]
    );

    await this.pool.query(
      `UPDATE collaboration_guest_invites 
       SET current_uses = current_uses + 1, last_used_at = NOW() 
       WHERE id = $1`,
      [invite.id]
    );

    return this.mapCollaborationGuest(result.rows[0]);
  }

  async getSessionGuests(sessionId: string): Promise<CollaborationGuest[]> {
    const result = await this.pool.query(
      `SELECT * FROM collaboration_guests WHERE session_id = $1 ORDER BY joined_at DESC`,
      [sessionId]
    );
    return result.rows.map(this.mapCollaborationGuest);
  }

  async updateGuestPresence(guestToken: string, isOnline: boolean): Promise<void> {
    await this.pool.query(
      `UPDATE collaboration_guests 
       SET is_online = $1, last_seen_at = NOW(), updated_at = NOW() 
       WHERE guest_token = $2`,
      [isOnline, guestToken]
    );
  }

  // ============================================================================
  // AI FACILITATOR MODE
  // ============================================================================

  async enableFacilitator(
    tenantId: string,
    userId: string,
    request: EnableFacilitatorRequest
  ): Promise<FacilitatorConfig> {
    const agenda = request.agenda?.map((item, i) => ({
      id: uuidv4(),
      title: item.title,
      description: item.description,
      durationMinutes: item.durationMinutes,
      status: i === 0 ? 'active' : 'pending',
    })) || [];

    const result = await this.pool.query(
      `INSERT INTO collaboration_facilitators 
       (session_id, facilitator_model, facilitator_persona, session_objective, session_agenda,
        auto_summarize, auto_action_items, ensure_participation, keep_on_topic,
        time_box_enabled, time_box_minutes, silence_threshold_seconds,
        tangent_detection_enabled, conflict_mediation_enabled)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
       ON CONFLICT (session_id) DO UPDATE SET
         facilitator_model = EXCLUDED.facilitator_model,
         facilitator_persona = EXCLUDED.facilitator_persona,
         session_objective = EXCLUDED.session_objective,
         session_agenda = EXCLUDED.session_agenda,
         is_enabled = true,
         updated_at = NOW()
       RETURNING *`,
      [
        request.sessionId,
        request.model || 'claude-3-5-sonnet',
        request.persona || 'professional',
        request.objective,
        JSON.stringify(agenda),
        request.settings?.autoSummarize ?? true,
        request.settings?.autoActionItems ?? true,
        request.settings?.ensureParticipation ?? true,
        request.settings?.keepOnTopic ?? true,
        request.settings?.timeBoxEnabled ?? false,
        request.settings?.timeBoxMinutes,
        request.settings?.silenceThresholdSeconds ?? 120,
        request.settings?.tangentDetectionEnabled ?? true,
        request.settings?.conflictMediationEnabled ?? true,
      ]
    );

    const config = this.mapFacilitatorConfig(result.rows[0]);
    
    await this.createIntervention(request.sessionId, config.id, 'welcome', {
      objective: request.objective,
      participantCount: await this.getParticipantCount(request.sessionId),
    });

    return config;
  }

  async disableFacilitator(sessionId: string): Promise<void> {
    await this.pool.query(
      `UPDATE collaboration_facilitators SET is_enabled = false, updated_at = NOW() WHERE session_id = $1`,
      [sessionId]
    );
  }

  async getFacilitatorConfig(sessionId: string): Promise<FacilitatorConfig | null> {
    const result = await this.pool.query(
      `SELECT * FROM collaboration_facilitators WHERE session_id = $1`,
      [sessionId]
    );
    return result.rows[0] ? this.mapFacilitatorConfig(result.rows[0]) : null;
  }

  async createIntervention(
    sessionId: string,
    facilitatorId: string,
    type: InterventionType,
    triggerData: Record<string, unknown>
  ): Promise<FacilitatorIntervention> {
    const message = await this.generateInterventionMessage(sessionId, type, triggerData);
    
    const result = await this.pool.query(
      `INSERT INTO facilitator_interventions 
       (session_id, facilitator_id, intervention_type, message_content, trigger_reason, trigger_data)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [sessionId, facilitatorId, type, message, this.getInterventionReason(type), JSON.stringify(triggerData)]
    );

    return this.mapIntervention(result.rows[0]);
  }

  private async generateInterventionMessage(
    sessionId: string,
    type: InterventionType,
    data: Record<string, unknown>
  ): Promise<string> {
    const templates: Record<InterventionType, string> = {
      welcome: `Welcome everyone! ${data.objective ? `Today's objective: ${data.objective}` : 'Let\'s have a productive discussion.'} I'll be here to help keep us on track and ensure everyone's voice is heard.`,
      summarize: 'Let me summarize what we\'ve discussed so far...',
      prompt_participation: `I notice some of you haven't had a chance to share yet. ${data.targetName ? `@${data.targetName}, what are your thoughts?` : 'Would anyone else like to add their perspective?'}`,
      redirect_topic: 'That\'s an interesting point! To keep us focused, let\'s bring it back to our main topic...',
      mediate_conflict: 'I can see there are different perspectives here. Let\'s take a moment to understand each viewpoint...',
      suggest_break: 'We\'ve been at this for a while. How about a quick 5-minute break?',
      time_check: `Quick time check: We have ${data.remainingMinutes || 'some'} minutes left for this topic.`,
      action_items: 'Based on our discussion, here are the action items I\'ve captured...',
      synthesize_viewpoints: 'Let me synthesize the different viewpoints shared...',
      ask_clarification: 'Could you elaborate on that point? I want to make sure everyone understands.',
      encourage: 'Great insight! Building on that...',
      wrap_up: 'We\'re coming to the end of our session. Let me summarize our key takeaways and next steps...',
    };
    return templates[type];
  }

  private getInterventionReason(type: InterventionType): string {
    const reasons: Record<InterventionType, string> = {
      welcome: 'Session started',
      summarize: 'Periodic summary',
      prompt_participation: 'Low participation detected',
      redirect_topic: 'Off-topic detected',
      mediate_conflict: 'Conflict detected',
      suggest_break: 'Extended session duration',
      time_check: 'Time milestone reached',
      action_items: 'Action items identified',
      synthesize_viewpoints: 'Multiple perspectives shared',
      ask_clarification: 'Ambiguous statement',
      encourage: 'Positive contribution',
      wrap_up: 'Session ending',
    };
    return reasons[type];
  }

  // ============================================================================
  // BRANCH & MERGE
  // ============================================================================

  async createBranch(
    tenantId: string,
    participantId: string,
    request: CreateBranchRequest
  ): Promise<ConversationBranch> {
    const colors = ['#ef4444', '#f97316', '#22c55e', '#3b82f6', '#8b5cf6', '#ec4899'];
    const color = request.branchColor || colors[Math.floor(Math.random() * colors.length)];

    const result = await this.pool.query(
      `INSERT INTO conversation_branches 
       (session_id, branch_name, branch_description, branch_color, parent_branch_id, 
        fork_point_message_id, created_by, exploration_hypothesis)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING *`,
      [
        request.sessionId,
        request.branchName,
        request.branchDescription,
        color,
        request.parentBranchId,
        request.forkPointMessageId,
        participantId,
        request.explorationHypothesis,
      ]
    );

    return this.mapBranch(result.rows[0]);
  }

  async getBranches(sessionId: string): Promise<ConversationBranch[]> {
    const result = await this.pool.query(
      `SELECT b.*, 
              COUNT(m.id) as message_count,
              ARRAY_AGG(DISTINCT m.participant_id) FILTER (WHERE m.participant_id IS NOT NULL) as participants
       FROM conversation_branches b
       LEFT JOIN session_messages m ON m.branch_id = b.id
       WHERE b.session_id = $1
       GROUP BY b.id
       ORDER BY b.created_at`,
      [sessionId]
    );
    return result.rows.map(this.mapBranch);
  }

  async mergeBranch(
    branchId: string,
    targetBranchId: string,
    participantId: string,
    conclusion?: string
  ): Promise<ConversationBranch> {
    const result = await this.pool.query(
      `UPDATE conversation_branches 
       SET status = 'merged', merged_into_id = $1, merged_at = NOW(), 
           merged_by = $2, exploration_conclusion = $3, updated_at = NOW()
       WHERE id = $4
       RETURNING *`,
      [targetBranchId, participantId, conclusion, branchId]
    );
    return this.mapBranch(result.rows[0]);
  }

  async createMergeRequest(
    tenantId: string,
    participantId: string,
    request: CreateMergeRequestRequest
  ): Promise<BranchMergeRequest> {
    const result = await this.pool.query(
      `INSERT INTO branch_merge_requests 
       (session_id, source_branch_id, target_branch_id, title, description, key_insights, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [
        request.sessionId,
        request.sourceBranchId,
        request.targetBranchId,
        request.title,
        request.description,
        JSON.stringify(request.keyInsights || []),
        participantId,
      ]
    );
    return this.mapMergeRequest(result.rows[0]);
  }

  async approveMergeRequest(mergeRequestId: string, participantId: string): Promise<BranchMergeRequest> {
    const result = await this.pool.query(
      `UPDATE branch_merge_requests 
       SET approvals = array_append(approvals, $1::uuid), updated_at = NOW()
       WHERE id = $2
       RETURNING *`,
      [participantId, mergeRequestId]
    );
    return this.mapMergeRequest(result.rows[0]);
  }

  // ============================================================================
  // TIME-SHIFTED PLAYBACK
  // ============================================================================

  async startRecording(sessionId: string): Promise<SessionRecording> {
    const result = await this.pool.query(
      `INSERT INTO session_recordings (session_id, recording_type, start_time, events)
       VALUES ($1, 'full', NOW(), '[]')
       RETURNING *`,
      [sessionId]
    );
    return this.mapRecording(result.rows[0]);
  }

  async addRecordingEvent(
    recordingId: string,
    eventType: string,
    participantId: string | null,
    data: Record<string, unknown>
  ): Promise<void> {
    await this.pool.query(
      `UPDATE session_recordings 
       SET events = events || $1::jsonb
       WHERE id = $2`,
      [
        JSON.stringify([{
          timestamp: new Date().toISOString(),
          type: eventType,
          participantId,
          data,
        }]),
        recordingId,
      ]
    );
  }

  async stopRecording(recordingId: string): Promise<SessionRecording> {
    const result = await this.pool.query(
      `UPDATE session_recordings 
       SET end_time = NOW(), 
           duration_seconds = EXTRACT(EPOCH FROM (NOW() - start_time))::INTEGER
       WHERE id = $1
       RETURNING *`,
      [recordingId]
    );
    return this.mapRecording(result.rows[0]);
  }

  async uploadMediaNote(
    tenantId: string,
    participantId: string,
    sessionId: string,
    messageId: string | undefined,
    mediaType: 'voice' | 'video' | 'screen',
    fileBuffer: Buffer,
    mimeType: string,
    durationSeconds?: number
  ): Promise<SessionMediaNote> {
    const key = `${tenantId}/sessions/${sessionId}/media/${uuidv4()}`;
    
    await s3Client.send(new PutObjectCommand({
      Bucket: COLLABORATION_BUCKET,
      Key: key,
      Body: fileBuffer,
      ContentType: mimeType,
    }));

    const result = await this.pool.query(
      `INSERT INTO session_media_notes 
       (session_id, message_id, participant_id, media_type, s3_bucket, s3_key, 
        file_size_bytes, duration_seconds, transcription_status)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'pending')
       RETURNING *`,
      [sessionId, messageId, participantId, mediaType, COLLABORATION_BUCKET, key, fileBuffer.length, durationSeconds]
    );

    return this.mapMediaNote(result.rows[0]);
  }

  async getMediaNoteUrl(noteId: string): Promise<string> {
    const result = await this.pool.query(
      `SELECT s3_bucket, s3_key FROM session_media_notes WHERE id = $1`,
      [noteId]
    );
    if (!result.rows[0]) throw new Error('Media note not found');

    const command = new GetObjectCommand({
      Bucket: result.rows[0].s3_bucket,
      Key: result.rows[0].s3_key,
    });
    return getSignedUrl(s3Client, command, { expiresIn: 3600 });
  }

  async createAnnotation(
    sessionId: string,
    targetType: 'message' | 'branch' | 'recording' | 'summary',
    targetId: string,
    annotationType: string,
    content: string | undefined,
    participantId: string | undefined,
    guestId: string | undefined
  ): Promise<AsyncAnnotation> {
    const result = await this.pool.query(
      `INSERT INTO async_annotations 
       (session_id, target_type, target_id, annotation_type, content, participant_id, guest_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [sessionId, targetType, targetId, annotationType, content, participantId, guestId]
    );
    return this.mapAnnotation(result.rows[0]);
  }

  // ============================================================================
  // AI ROUNDTABLE
  // ============================================================================

  async createRoundtable(
    tenantId: string,
    participantId: string,
    request: CreateRoundtableRequest
  ): Promise<AIRoundtable> {
    const colors = ['#ef4444', '#f97316', '#22c55e', '#3b82f6', '#8b5cf6', '#ec4899', '#14b8a6', '#eab308'];
    const models: ModelParticipant[] = request.models.map((m, i) => ({
      ...m,
      color: colors[i % colors.length],
    }));

    const result = await this.pool.query(
      `INSERT INTO ai_roundtables 
       (session_id, topic, context, models, moderator_model, debate_style, max_rounds, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING *`,
      [
        request.sessionId,
        request.topic,
        request.context,
        JSON.stringify(models),
        request.moderatorModel,
        request.debateStyle || 'collaborative',
        request.maxRounds || 5,
        participantId,
      ]
    );

    return this.mapRoundtable(result.rows[0]);
  }

  async addRoundtableContribution(
    roundtableId: string,
    sessionId: string,
    modelId: string,
    roundNumber: number,
    content: string,
    respondingToId?: string,
    tokensUsed?: number,
    latencyMs?: number
  ): Promise<RoundtableContribution> {
    const roundtable = await this.getRoundtable(roundtableId);
    const model = roundtable?.models.find(m => m.modelId === modelId);

    const result = await this.pool.query(
      `INSERT INTO roundtable_contributions 
       (roundtable_id, session_id, model_id, model_persona, model_role, round_number, 
        content, responding_to_id, tokens_used, latency_ms)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       RETURNING *`,
      [
        roundtableId,
        sessionId,
        modelId,
        model?.persona,
        model?.role,
        roundNumber,
        content,
        respondingToId,
        tokensUsed,
        latencyMs,
      ]
    );

    await this.pool.query(
      `UPDATE ai_roundtables SET current_round = $1, updated_at = NOW() WHERE id = $2`,
      [roundNumber, roundtableId]
    );

    return this.mapContribution(result.rows[0]);
  }

  async getRoundtable(roundtableId: string): Promise<AIRoundtable | null> {
    const result = await this.pool.query(
      `SELECT * FROM ai_roundtables WHERE id = $1`,
      [roundtableId]
    );
    return result.rows[0] ? this.mapRoundtable(result.rows[0]) : null;
  }

  async getRoundtableContributions(roundtableId: string): Promise<RoundtableContribution[]> {
    const result = await this.pool.query(
      `SELECT * FROM roundtable_contributions WHERE roundtable_id = $1 ORDER BY round_number, created_at`,
      [roundtableId]
    );
    return result.rows.map(this.mapContribution);
  }

  async completeRoundtable(
    roundtableId: string,
    synthesis: string,
    consensusPoints: string[],
    disagreementPoints: string[],
    recommendations: string[]
  ): Promise<AIRoundtable> {
    const result = await this.pool.query(
      `UPDATE ai_roundtables 
       SET status = 'completed', synthesis = $1, consensus_points = $2, 
           disagreement_points = $3, action_recommendations = $4, updated_at = NOW()
       WHERE id = $5
       RETURNING *`,
      [
        synthesis,
        JSON.stringify(consensusPoints),
        JSON.stringify(disagreementPoints),
        JSON.stringify(recommendations),
        roundtableId,
      ]
    );
    return this.mapRoundtable(result.rows[0]);
  }

  // ============================================================================
  // KNOWLEDGE GRAPH
  // ============================================================================

  async getOrCreateKnowledgeGraph(sessionId: string): Promise<KnowledgeGraph> {
    let result = await this.pool.query(
      `SELECT * FROM session_knowledge_graphs WHERE session_id = $1`,
      [sessionId]
    );

    if (!result.rows[0]) {
      result = await this.pool.query(
        `INSERT INTO session_knowledge_graphs (session_id) VALUES ($1) RETURNING *`,
        [sessionId]
      );
    }

    const graph = this.mapKnowledgeGraph(result.rows[0]);
    
    const nodesResult = await this.pool.query(
      `SELECT * FROM knowledge_graph_nodes WHERE graph_id = $1`,
      [graph.id]
    );
    graph.nodes = nodesResult.rows.map(this.mapNode);

    const edgesResult = await this.pool.query(
      `SELECT * FROM knowledge_graph_edges WHERE graph_id = $1`,
      [graph.id]
    );
    graph.edges = edgesResult.rows.map(this.mapEdge);

    return graph;
  }

  async addNode(
    participantId: string,
    request: CreateNodeRequest
  ): Promise<KnowledgeNode> {
    const graphResult = await this.pool.query(
      `SELECT session_id FROM session_knowledge_graphs WHERE id = $1`,
      [request.graphId]
    );
    const sessionId = graphResult.rows[0]?.session_id;

    const colors: Record<string, string> = {
      concept: '#3b82f6',
      fact: '#22c55e',
      question: '#f97316',
      decision: '#8b5cf6',
      action_item: '#ef4444',
      person: '#14b8a6',
      resource: '#eab308',
    };

    const result = await this.pool.query(
      `INSERT INTO knowledge_graph_nodes 
       (graph_id, session_id, node_type, label, description, color, x, y, source_message_id, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       RETURNING *`,
      [
        request.graphId,
        sessionId,
        request.nodeType,
        request.label,
        request.description,
        colors[request.nodeType] || '#6366f1',
        request.x,
        request.y,
        request.sourceMessageId,
        participantId,
      ]
    );

    await this.pool.query(
      `UPDATE session_knowledge_graphs SET version = version + 1, updated_at = NOW() WHERE id = $1`,
      [request.graphId]
    );

    return this.mapNode(result.rows[0]);
  }

  async addEdge(participantId: string, request: CreateEdgeRequest): Promise<KnowledgeEdge> {
    const result = await this.pool.query(
      `INSERT INTO knowledge_graph_edges 
       (graph_id, source_node_id, target_node_id, relationship_type, label, created_by)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [
        request.graphId,
        request.sourceNodeId,
        request.targetNodeId,
        request.relationshipType,
        request.label,
        participantId,
      ]
    );

    await this.pool.query(
      `UPDATE session_knowledge_graphs SET version = version + 1, updated_at = NOW() WHERE id = $1`,
      [request.graphId]
    );

    return this.mapEdge(result.rows[0]);
  }

  async updateNodePosition(nodeId: string, x: number, y: number): Promise<void> {
    await this.pool.query(
      `UPDATE knowledge_graph_nodes SET x = $1, y = $2, updated_at = NOW() WHERE id = $3`,
      [x, y, nodeId]
    );
  }

  // ============================================================================
  // ATTACHMENTS
  // ============================================================================

  async uploadAttachment(
    tenantId: string,
    sessionId: string,
    participantId: string | undefined,
    guestId: string | undefined,
    messageId: string | undefined,
    fileName: string,
    fileType: string,
    fileBuffer: Buffer
  ): Promise<CollaborationAttachment> {
    const key = `${tenantId}/sessions/${sessionId}/attachments/${uuidv4()}/${fileName}`;

    await s3Client.send(new PutObjectCommand({
      Bucket: COLLABORATION_BUCKET,
      Key: key,
      Body: fileBuffer,
      ContentType: fileType,
    }));

    const result = await this.pool.query(
      `INSERT INTO collaboration_attachments 
       (session_id, message_id, participant_id, guest_id, file_name, file_type, 
        file_size_bytes, s3_bucket, s3_key, processing_status)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'ready')
       RETURNING *`,
      [sessionId, messageId, participantId, guestId, fileName, fileType, fileBuffer.length, COLLABORATION_BUCKET, key]
    );

    return this.mapAttachment(result.rows[0]);
  }

  async getAttachmentUrl(attachmentId: string): Promise<string> {
    const result = await this.pool.query(
      `UPDATE collaboration_attachments 
       SET download_count = download_count + 1, last_accessed_at = NOW()
       WHERE id = $1
       RETURNING s3_bucket, s3_key`,
      [attachmentId]
    );
    if (!result.rows[0]) throw new Error('Attachment not found');

    const command = new GetObjectCommand({
      Bucket: result.rows[0].s3_bucket,
      Key: result.rows[0].s3_key,
    });
    return getSignedUrl(s3Client, command, { expiresIn: 3600 });
  }

  // ============================================================================
  // ENHANCED SESSION
  // ============================================================================

  async getEnhancedSession(sessionId: string): Promise<EnhancedCollaborativeSession | null> {
    const sessionResult = await this.pool.query(
      `SELECT cs.*, 
              (SELECT COUNT(*) FROM session_participants sp WHERE sp.session_id = cs.id AND sp.is_online = true) +
              (SELECT COUNT(*) FROM collaboration_guests cg WHERE cg.session_id = cs.id AND cg.is_online = true) as online_count
       FROM collaborative_sessions cs
       WHERE cs.id = $1`,
      [sessionId]
    );

    if (!sessionResult.rows[0]) return null;

    const session = sessionResult.rows[0];

    const [facilitator, branches, roundtables, recordings, participants, guests, graph] = await Promise.all([
      this.getFacilitatorConfig(sessionId),
      this.getBranches(sessionId),
      this.pool.query(`SELECT * FROM ai_roundtables WHERE session_id = $1`, [sessionId]),
      this.pool.query(`SELECT * FROM session_recordings WHERE session_id = $1 ORDER BY created_at DESC`, [sessionId]),
      this.pool.query(`SELECT sp.*, u.full_name as name, u.avatar_url 
                       FROM session_participants sp 
                       LEFT JOIN users u ON u.id = sp.user_id 
                       WHERE sp.session_id = $1`, [sessionId]),
      this.getSessionGuests(sessionId),
      this.getOrCreateKnowledgeGraph(sessionId),
    ]);

    return {
      id: session.id,
      tenantId: session.tenant_id,
      conversationId: session.conversation_id,
      ownerId: session.owner_id,
      name: session.name,
      description: session.description,
      color: session.color,
      accessType: session.access_type,
      linkToken: session.link_token,
      defaultPermission: session.default_permission,
      isActive: session.is_active,
      maxParticipants: session.max_participants,
      allowAnonymous: session.allow_anonymous,
      requireApproval: session.require_approval,
      createdAt: session.created_at,
      updatedAt: session.updated_at,
      lastActivityAt: session.last_activity_at,
      facilitator: facilitator || undefined,
      branches,
      roundtables: roundtables.rows.map(this.mapRoundtable),
      recordings: recordings.rows.map(this.mapRecording),
      participants: participants.rows.map(this.mapParticipant),
      guests,
      onlineCount: parseInt(session.online_count) || 0,
      knowledgeGraph: graph,
    };
  }

  // ============================================================================
  // HELPERS
  // ============================================================================

  private async getParticipantCount(sessionId: string): Promise<number> {
    const result = await this.pool.query(
      `SELECT COUNT(*) as count FROM session_participants WHERE session_id = $1`,
      [sessionId]
    );
    return parseInt(result.rows[0]?.count) || 0;
  }

  private mapGuestInvite(row: any): GuestInvite {
    return {
      id: row.id,
      sessionId: row.session_id,
      inviteToken: row.invite_token,
      inviteType: row.invite_type,
      guestEmail: row.guest_email,
      guestName: row.guest_name,
      permission: row.permission,
      expiresAt: row.expires_at,
      maxUses: row.max_uses,
      currentUses: row.current_uses,
      createdBy: row.created_by,
      createdAt: row.created_at,
      lastUsedAt: row.last_used_at,
      referralCode: row.referral_code,
      signupsFromInvite: row.signups_from_invite,
    };
  }

  private mapCollaborationGuest(row: any): CollaborationGuest {
    return {
      id: row.id,
      inviteId: row.invite_id,
      sessionId: row.session_id,
      guestToken: row.guest_token,
      displayName: row.display_name,
      email: row.email,
      avatarUrl: row.avatar_url,
      linkedUserId: row.linked_user_id,
      linkedTenantId: row.linked_tenant_id,
      permission: row.permission,
      isOnline: row.is_online,
      lastSeenAt: row.last_seen_at,
      color: row.color,
      joinedAt: row.joined_at,
      leftAt: row.left_at,
    };
  }

  private mapFacilitatorConfig(row: any): FacilitatorConfig {
    return {
      id: row.id,
      sessionId: row.session_id,
      isEnabled: row.is_enabled,
      facilitatorModel: row.facilitator_model,
      facilitatorPersona: row.facilitator_persona,
      autoSummarize: row.auto_summarize,
      autoActionItems: row.auto_action_items,
      ensureParticipation: row.ensure_participation,
      keepOnTopic: row.keep_on_topic,
      timeBoxEnabled: row.time_box_enabled,
      timeBoxMinutes: row.time_box_minutes,
      silenceThresholdSeconds: row.silence_threshold_seconds,
      tangentDetectionEnabled: row.tangent_detection_enabled,
      conflictMediationEnabled: row.conflict_mediation_enabled,
      sessionObjective: row.session_objective,
      sessionAgenda: row.session_agenda || [],
    };
  }

  private mapIntervention(row: any): FacilitatorIntervention {
    return {
      id: row.id,
      sessionId: row.session_id,
      facilitatorId: row.facilitator_id,
      interventionType: row.intervention_type,
      messageContent: row.message_content,
      targetParticipants: row.target_participants || [],
      triggerReason: row.trigger_reason,
      triggerData: row.trigger_data || {},
      wasHelpful: row.was_helpful,
      participantReactions: row.participant_reactions || {},
      createdAt: row.created_at,
    };
  }

  private mapBranch(row: any): ConversationBranch {
    return {
      id: row.id,
      sessionId: row.session_id,
      branchName: row.branch_name,
      branchDescription: row.branch_description,
      branchColor: row.branch_color,
      parentBranchId: row.parent_branch_id,
      forkPointMessageId: row.fork_point_message_id,
      createdBy: row.created_by,
      status: row.status,
      mergedIntoId: row.merged_into_id,
      mergedAt: row.merged_at,
      mergedBy: row.merged_by,
      explorationHypothesis: row.exploration_hypothesis,
      explorationConclusion: row.exploration_conclusion,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      messageCount: row.message_count ? parseInt(row.message_count) : undefined,
      participants: row.participants?.filter(Boolean),
    };
  }

  private mapMergeRequest(row: any): BranchMergeRequest {
    return {
      id: row.id,
      sessionId: row.session_id,
      sourceBranchId: row.source_branch_id,
      targetBranchId: row.target_branch_id,
      title: row.title,
      description: row.description,
      keyInsights: row.key_insights || [],
      status: row.status,
      reviewers: row.reviewers || [],
      approvals: row.approvals || [],
      aiMergeSummary: row.ai_merge_summary,
      aiConflictAnalysis: row.ai_conflict_analysis,
      createdBy: row.created_by,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  private mapRecording(row: any): SessionRecording {
    return {
      id: row.id,
      sessionId: row.session_id,
      recordingType: row.recording_type,
      title: row.title,
      startTime: row.start_time,
      endTime: row.end_time,
      durationSeconds: row.duration_seconds,
      events: row.events || [],
      aiSummary: row.ai_summary,
      aiKeyMoments: row.ai_key_moments || [],
      playbackSpeedOptions: row.playback_speed_options || [0.5, 1, 1.5, 2],
      createdAt: row.created_at,
    };
  }

  private mapMediaNote(row: any): SessionMediaNote {
    return {
      id: row.id,
      sessionId: row.session_id,
      messageId: row.message_id,
      participantId: row.participant_id,
      mediaType: row.media_type,
      s3Bucket: row.s3_bucket,
      s3Key: row.s3_key,
      s3Region: row.s3_region,
      fileSizeBytes: row.file_size_bytes,
      durationSeconds: row.duration_seconds,
      transcription: row.transcription,
      transcriptionStatus: row.transcription_status,
      thumbnailS3Key: row.thumbnail_s3_key,
      waveformData: row.waveform_data,
      createdAt: row.created_at,
    };
  }

  private mapAnnotation(row: any): AsyncAnnotation {
    return {
      id: row.id,
      sessionId: row.session_id,
      targetType: row.target_type,
      targetId: row.target_id,
      annotationType: row.annotation_type,
      content: row.content,
      participantId: row.participant_id,
      guestId: row.guest_id,
      createdAt: row.created_at,
    };
  }

  private mapRoundtable(row: any): AIRoundtable {
    return {
      id: row.id,
      sessionId: row.session_id,
      topic: row.topic,
      context: row.context,
      models: row.models || [],
      moderatorModel: row.moderator_model,
      debateStyle: row.debate_style,
      maxRounds: row.max_rounds,
      currentRound: row.current_round,
      status: row.status,
      synthesis: row.synthesis,
      consensusPoints: row.consensus_points || [],
      disagreementPoints: row.disagreement_points || [],
      actionRecommendations: row.action_recommendations || [],
      createdBy: row.created_by,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  private mapContribution(row: any): RoundtableContribution {
    return {
      id: row.id,
      roundtableId: row.roundtable_id,
      sessionId: row.session_id,
      modelId: row.model_id,
      modelPersona: row.model_persona,
      modelRole: row.model_role,
      roundNumber: row.round_number,
      content: row.content,
      respondingToId: row.responding_to_id,
      tokensUsed: row.tokens_used,
      latencyMs: row.latency_ms,
      humanReactions: row.human_reactions || {},
      humanVotes: row.human_votes,
      createdAt: row.created_at,
    };
  }

  private mapKnowledgeGraph(row: any): KnowledgeGraph {
    return {
      id: row.id,
      sessionId: row.session_id,
      title: row.title,
      description: row.description,
      nodes: [],
      edges: [],
      layoutType: row.layout_type,
      layoutConfig: row.layout_config || {},
      aiGaps: row.ai_gaps || [],
      aiSuggestions: row.ai_suggestions || [],
      aiSummary: row.ai_summary,
      version: row.version,
      lastUpdatedBy: row.last_updated_by,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  private mapNode(row: any): KnowledgeNode {
    return {
      id: row.id,
      graphId: row.graph_id,
      sessionId: row.session_id,
      nodeType: row.node_type,
      label: row.label,
      description: row.description,
      color: row.color,
      icon: row.icon,
      size: row.size,
      x: row.x,
      y: row.y,
      sourceMessageId: row.source_message_id,
      sourceBranchId: row.source_branch_id,
      confidence: row.confidence,
      importance: row.importance,
      createdBy: row.created_by,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  private mapEdge(row: any): KnowledgeEdge {
    return {
      id: row.id,
      graphId: row.graph_id,
      sourceNodeId: row.source_node_id,
      targetNodeId: row.target_node_id,
      relationshipType: row.relationship_type,
      label: row.label,
      weight: row.weight,
      color: row.color,
      style: row.style,
      createdBy: row.created_by,
      createdAt: row.created_at,
    };
  }

  private mapParticipant(row: any): any {
    return {
      id: row.id,
      sessionId: row.session_id,
      userId: row.user_id,
      anonymousId: row.anonymous_id,
      anonymousName: row.anonymous_name,
      permission: row.permission,
      invitedBy: row.invited_by,
      invitedAt: row.invited_at,
      joinedAt: row.joined_at,
      status: row.status,
      isOnline: row.is_online,
      lastSeenAt: row.last_seen_at,
      cursorPosition: row.cursor_position,
      color: row.color,
      name: row.name || row.anonymous_name,
      avatarUrl: row.avatar_url,
    };
  }
}
