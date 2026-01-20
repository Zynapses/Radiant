/**
 * RADIANT v4.18.0 - Enhanced Collaboration API Handler
 * Lambda handler for all novel collaboration features
 */

import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { Pool } from 'pg';
import { EnhancedCollaborationService } from '../shared/services/enhanced-collaboration.service';

const pool = new Pool({
  host: process.env.DB_HOST,
  port: parseInt(process.env.DB_PORT || '5432'),
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false,
});

const collaborationService = new EnhancedCollaborationService(pool);

export async function handler(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  const tenantId = event.requestContext.authorizer?.tenantId;
  const userId = event.requestContext.authorizer?.userId;
  const path = event.path.replace('/api/thinktank/collaboration', '');
  const method = event.httpMethod;

  try {
    await pool.query(`SET app.current_tenant_id = '${tenantId}'`);

    // Parse request body
    const body = event.body ? JSON.parse(event.body) : {};

    // =========================================================================
    // ENHANCED SESSION
    // =========================================================================
    
    if (path.match(/^\/sessions\/[^/]+$/) && method === 'GET') {
      const sessionId = path.split('/')[2];
      const session = await collaborationService.getEnhancedSession(sessionId);
      if (!session) {
        return response(404, { error: 'Session not found' });
      }
      return response(200, { data: session });
    }

    // =========================================================================
    // GUEST INVITES
    // =========================================================================

    if (path === '/invites' && method === 'POST') {
      const invite = await collaborationService.createGuestInvite(tenantId, userId, body);
      return response(201, { data: invite });
    }

    if (path.match(/^\/invites\/[^/]+$/) && method === 'GET') {
      const token = path.split('/')[2];
      const invite = await collaborationService.getInviteByToken(token);
      if (!invite) {
        return response(404, { error: 'Invite not found' });
      }
      return response(200, { data: invite });
    }

    if (path === '/guests/join' && method === 'POST') {
      const guest = await collaborationService.joinAsGuest(body);
      return response(201, { data: guest });
    }

    if (path.match(/^\/sessions\/[^/]+\/guests$/) && method === 'GET') {
      const sessionId = path.split('/')[2];
      const guests = await collaborationService.getSessionGuests(sessionId);
      return response(200, { data: guests });
    }

    if (path === '/guests/presence' && method === 'PATCH') {
      await collaborationService.updateGuestPresence(body.guestToken, body.isOnline);
      return response(200, { success: true });
    }

    // =========================================================================
    // AI FACILITATOR
    // =========================================================================

    if (path === '/facilitator/enable' && method === 'POST') {
      const config = await collaborationService.enableFacilitator(tenantId, userId, body);
      return response(201, { data: config });
    }

    if (path.match(/^\/sessions\/[^/]+\/facilitator$/) && method === 'DELETE') {
      const sessionId = path.split('/')[2];
      await collaborationService.disableFacilitator(sessionId);
      return response(200, { success: true });
    }

    if (path.match(/^\/sessions\/[^/]+\/facilitator$/) && method === 'GET') {
      const sessionId = path.split('/')[2];
      const config = await collaborationService.getFacilitatorConfig(sessionId);
      return response(200, { data: config });
    }

    // =========================================================================
    // BRANCHES
    // =========================================================================

    if (path === '/branches' && method === 'POST') {
      const participantId = body.participantId || userId;
      const branch = await collaborationService.createBranch(tenantId, participantId, body);
      return response(201, { data: branch });
    }

    if (path.match(/^\/sessions\/[^/]+\/branches$/) && method === 'GET') {
      const sessionId = path.split('/')[2];
      const branches = await collaborationService.getBranches(sessionId);
      return response(200, { data: branches });
    }

    if (path.match(/^\/branches\/[^/]+\/merge$/) && method === 'POST') {
      const branchId = path.split('/')[2];
      const branch = await collaborationService.mergeBranch(
        branchId,
        body.targetBranchId,
        body.participantId || userId,
        body.conclusion
      );
      return response(200, { data: branch });
    }

    if (path === '/merge-requests' && method === 'POST') {
      const participantId = body.participantId || userId;
      const mr = await collaborationService.createMergeRequest(tenantId, participantId, body);
      return response(201, { data: mr });
    }

    if (path.match(/^\/merge-requests\/[^/]+\/approve$/) && method === 'POST') {
      const mrId = path.split('/')[2];
      const mr = await collaborationService.approveMergeRequest(mrId, body.participantId || userId);
      return response(200, { data: mr });
    }

    // =========================================================================
    // RECORDINGS & MEDIA
    // =========================================================================

    if (path === '/recordings/start' && method === 'POST') {
      const recording = await collaborationService.startRecording(body.sessionId);
      return response(201, { data: recording });
    }

    if (path.match(/^\/recordings\/[^/]+\/stop$/) && method === 'POST') {
      const recordingId = path.split('/')[2];
      const recording = await collaborationService.stopRecording(recordingId);
      return response(200, { data: recording });
    }

    if (path.match(/^\/recordings\/[^/]+\/events$/) && method === 'POST') {
      const recordingId = path.split('/')[2];
      await collaborationService.addRecordingEvent(
        recordingId,
        body.eventType,
        body.participantId,
        body.data
      );
      return response(200, { success: true });
    }

    if (path === '/media-notes' && method === 'POST') {
      // Note: In production, this would handle multipart form data
      // For now, expect base64 encoded content
      const buffer = Buffer.from(body.content, 'base64');
      const note = await collaborationService.uploadMediaNote(
        tenantId,
        body.participantId || userId,
        body.sessionId,
        body.messageId,
        body.mediaType,
        buffer,
        body.mimeType,
        body.durationSeconds
      );
      return response(201, { data: note });
    }

    if (path.match(/^\/media-notes\/[^/]+\/url$/) && method === 'GET') {
      const noteId = path.split('/')[2];
      const url = await collaborationService.getMediaNoteUrl(noteId);
      return response(200, { data: { url } });
    }

    if (path === '/annotations' && method === 'POST') {
      const annotation = await collaborationService.createAnnotation(
        body.sessionId,
        body.targetType,
        body.targetId,
        body.annotationType,
        body.content,
        body.participantId,
        body.guestId
      );
      return response(201, { data: annotation });
    }

    // =========================================================================
    // AI ROUNDTABLE
    // =========================================================================

    if (path === '/roundtables' && method === 'POST') {
      const participantId = body.participantId || userId;
      const roundtable = await collaborationService.createRoundtable(tenantId, participantId, body);
      return response(201, { data: roundtable });
    }

    if (path.match(/^\/roundtables\/[^/]+$/) && method === 'GET') {
      const roundtableId = path.split('/')[2];
      const roundtable = await collaborationService.getRoundtable(roundtableId);
      return response(200, { data: roundtable });
    }

    if (path.match(/^\/roundtables\/[^/]+\/contributions$/) && method === 'GET') {
      const roundtableId = path.split('/')[2];
      const contributions = await collaborationService.getRoundtableContributions(roundtableId);
      return response(200, { data: contributions });
    }

    if (path.match(/^\/roundtables\/[^/]+\/contributions$/) && method === 'POST') {
      const roundtableId = path.split('/')[2];
      const contribution = await collaborationService.addRoundtableContribution(
        roundtableId,
        body.sessionId,
        body.modelId,
        body.roundNumber,
        body.content,
        body.respondingToId,
        body.tokensUsed,
        body.latencyMs
      );
      return response(201, { data: contribution });
    }

    if (path.match(/^\/roundtables\/[^/]+\/complete$/) && method === 'POST') {
      const roundtableId = path.split('/')[2];
      const roundtable = await collaborationService.completeRoundtable(
        roundtableId,
        body.synthesis,
        body.consensusPoints,
        body.disagreementPoints,
        body.recommendations
      );
      return response(200, { data: roundtable });
    }

    // =========================================================================
    // KNOWLEDGE GRAPH
    // =========================================================================

    if (path.match(/^\/sessions\/[^/]+\/knowledge-graph$/) && method === 'GET') {
      const sessionId = path.split('/')[2];
      const graph = await collaborationService.getOrCreateKnowledgeGraph(sessionId);
      return response(200, { data: graph });
    }

    if (path === '/knowledge-graph/nodes' && method === 'POST') {
      const participantId = body.participantId || userId;
      const node = await collaborationService.addNode(participantId, body);
      return response(201, { data: node });
    }

    if (path === '/knowledge-graph/edges' && method === 'POST') {
      const participantId = body.participantId || userId;
      const edge = await collaborationService.addEdge(participantId, body);
      return response(201, { data: edge });
    }

    if (path.match(/^\/knowledge-graph\/nodes\/[^/]+\/position$/) && method === 'PATCH') {
      const nodeId = path.split('/')[3];
      await collaborationService.updateNodePosition(nodeId, body.x, body.y);
      return response(200, { success: true });
    }

    // =========================================================================
    // ATTACHMENTS
    // =========================================================================

    if (path === '/attachments' && method === 'POST') {
      const buffer = Buffer.from(body.content, 'base64');
      const attachment = await collaborationService.uploadAttachment(
        tenantId,
        body.sessionId,
        body.participantId,
        body.guestId,
        body.messageId,
        body.fileName,
        body.fileType,
        buffer
      );
      return response(201, { data: attachment });
    }

    if (path.match(/^\/attachments\/[^/]+\/url$/) && method === 'GET') {
      const attachmentId = path.split('/')[2];
      const url = await collaborationService.getAttachmentUrl(attachmentId);
      return response(200, { data: { url } });
    }

    return response(404, { error: 'Not found' });
  } catch (error: any) {
    console.error('Enhanced collaboration error:', error);
    return response(error.message?.includes('not found') ? 404 : 500, {
      error: error.message || 'Internal server error',
    });
  }
}

function response(statusCode: number, body: any): APIGatewayProxyResult {
  return {
    statusCode,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Content-Type,Authorization',
    },
    body: JSON.stringify(body),
  };
}
