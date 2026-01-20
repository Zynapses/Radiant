// RADIANT v4.18.0 - Time Travel API Handler
// Conversation Forking & State Replay
// Novel UI: "Timeline Scrubber" - horizontal timeline with draggable playhead

import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { timeTravelService, CheckpointType } from '../shared/services/time-travel.service';
import { enhancedLogger as logger } from '../shared/logging/enhanced-logger';

// ============================================================================
// Helpers
// ============================================================================

const getTenantId = (event: APIGatewayProxyEvent): string | null => {
  return (event.requestContext.authorizer as Record<string, string> | null)?.tenantId || null;
};

const getUserId = (event: APIGatewayProxyEvent): string | null => {
  return (event.requestContext.authorizer as Record<string, string> | null)?.userId || null;
};

const jsonResponse = (statusCode: number, body: unknown): APIGatewayProxyResult => ({
  statusCode,
  headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
  body: JSON.stringify(body),
});

// ============================================================================
// Handlers
// ============================================================================

/**
 * GET /api/thinktank/time-travel/timelines
 * List user's timelines
 * Novel UI: "Timeline Gallery" - cards showing timeline thumbnails
 */
export async function listTimelines(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  try {
    const tenantId = getTenantId(event);
    const userId = getUserId(event);
    if (!tenantId) return jsonResponse(401, { error: 'Unauthorized' });

    const params = event.queryStringParameters || {};
    const timelines = await timeTravelService.listTimelines(
      tenantId,
      params.allUsers === 'true' ? undefined : userId || undefined,
      params.conversationId
    );

    return jsonResponse(200, {
      success: true,
      data: timelines.map(t => ({
        ...t,
        statusIcon: getStatusIcon(t.status),
        statusColor: getStatusColor(t.status),
        checkpointLabel: `${t.checkpointCount} checkpoint${t.checkpointCount !== 1 ? 's' : ''}`,
        forkLabel: t.forkCount > 0 ? `${t.forkCount} fork${t.forkCount !== 1 ? 's' : ''}` : null,
      })),
    });
  } catch (error) {
    logger.error('Failed to list timelines', { error });
    return jsonResponse(500, { error: 'Internal server error' });
  }
}

/**
 * POST /api/thinktank/time-travel/timelines
 * Create a new timeline for a conversation
 */
export async function createTimeline(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  try {
    const tenantId = getTenantId(event);
    const userId = getUserId(event);
    if (!tenantId || !userId) return jsonResponse(401, { error: 'Unauthorized' });

    const body = JSON.parse(event.body || '{}');
    const { conversationId, initialState, name } = body;

    if (!conversationId || !initialState) {
      return jsonResponse(400, { error: 'conversationId and initialState are required' });
    }

    const timeline = await timeTravelService.createTimeline(
      tenantId,
      userId,
      conversationId,
      initialState,
      name
    );

    return jsonResponse(201, {
      success: true,
      data: timeline,
      message: '⏱️ Timeline created! You can now travel through time.',
    });
  } catch (error) {
    logger.error('Failed to create timeline', { error });
    return jsonResponse(500, { error: 'Internal server error' });
  }
}

/**
 * GET /api/thinktank/time-travel/timelines/:id
 * Get timeline with full visualization data
 * Novel UI: "Timeline Scrubber" - interactive timeline with checkpoints
 */
export async function getTimeline(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  try {
    const tenantId = getTenantId(event);
    const timelineId = event.pathParameters?.id;
    if (!tenantId) return jsonResponse(401, { error: 'Unauthorized' });
    if (!timelineId) return jsonResponse(400, { error: 'Timeline ID required' });

    const view = await timeTravelService.getTimelineView(tenantId, timelineId);

    // Add visualization helpers
    const scrubberData = {
      ...view,
      checkpoints: view.checkpoints.map(node => ({
        ...node,
        typeIcon: getCheckpointIcon(node.checkpoint.type),
        typeColor: getCheckpointColor(node.checkpoint.type),
        tooltip: node.checkpoint.label || `Checkpoint ${node.checkpoint.sequence}`,
        diffSummary: node.checkpoint.diff ? formatDiff(node.checkpoint.diff) : null,
      })),
      scrubberPosition: view.totalLength > 1
        ? (view.currentPosition / (view.totalLength - 1)) * 100
        : 50,
    };

    return jsonResponse(200, { success: true, data: scrubberData });
  } catch (error) {
    logger.error('Failed to get timeline', { error });
    return jsonResponse(500, { error: 'Internal server error' });
  }
}

/**
 * POST /api/thinktank/time-travel/timelines/:id/checkpoint
 * Create a checkpoint on the timeline
 * Novel UI: "Save Point" - glowing marker on timeline
 */
export async function createCheckpoint(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  try {
    const tenantId = getTenantId(event);
    const timelineId = event.pathParameters?.id;
    if (!tenantId) return jsonResponse(401, { error: 'Unauthorized' });
    if (!timelineId) return jsonResponse(400, { error: 'Timeline ID required' });

    const body = JSON.parse(event.body || '{}');
    const { state, type, label } = body;

    if (!state) {
      return jsonResponse(400, { error: 'state is required' });
    }

    const checkpoint = await timeTravelService.createCheckpoint(
      tenantId,
      timelineId,
      state,
      (type as CheckpointType) || 'manual',
      label
    );

    return jsonResponse(201, {
      success: true,
      data: {
        ...checkpoint,
        typeIcon: getCheckpointIcon(checkpoint.type),
      },
      message: '📍 Checkpoint saved! You can return here anytime.',
    });
  } catch (error) {
    logger.error('Failed to create checkpoint', { error });
    return jsonResponse(500, { error: 'Internal server error' });
  }
}

/**
 * POST /api/thinktank/time-travel/timelines/:id/jump
 * Jump to a specific checkpoint
 * Novel UI: "Time Jump" - whoosh animation, state restoration
 */
export async function jumpToCheckpoint(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  try {
    const tenantId = getTenantId(event);
    const timelineId = event.pathParameters?.id;
    if (!tenantId) return jsonResponse(401, { error: 'Unauthorized' });
    if (!timelineId) return jsonResponse(400, { error: 'Timeline ID required' });

    const body = JSON.parse(event.body || '{}');
    const { checkpointId } = body;

    if (!checkpointId) {
      return jsonResponse(400, { error: 'checkpointId is required' });
    }

    const state = await timeTravelService.jumpToCheckpoint(tenantId, timelineId, checkpointId);

    return jsonResponse(200, {
      success: true,
      data: {
        state,
        restoredAt: new Date().toISOString(),
      },
      message: '⚡ Time jump complete! Conversation restored.',
    });
  } catch (error) {
    logger.error('Failed to jump to checkpoint', { error });
    return jsonResponse(500, { error: 'Internal server error' });
  }
}

/**
 * POST /api/thinktank/time-travel/timelines/:id/fork
 * Fork timeline from a checkpoint
 * Novel UI: "Branch Point" - timeline splits into two paths
 */
export async function forkTimeline(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  try {
    const tenantId = getTenantId(event);
    const userId = getUserId(event);
    const timelineId = event.pathParameters?.id;
    if (!tenantId || !userId) return jsonResponse(401, { error: 'Unauthorized' });
    if (!timelineId) return jsonResponse(400, { error: 'Timeline ID required' });

    const body = JSON.parse(event.body || '{}');
    const { checkpointId, reason, name } = body;

    if (!checkpointId) {
      return jsonResponse(400, { error: 'checkpointId is required' });
    }

    const result = await timeTravelService.fork(
      tenantId,
      userId,
      timelineId,
      checkpointId,
      reason || 'Manual fork',
      name
    );

    return jsonResponse(201, {
      success: true,
      data: result,
      message: '🌿 Timeline forked! Explore a new path.',
    });
  } catch (error) {
    logger.error('Failed to fork timeline', { error });
    return jsonResponse(500, { error: 'Internal server error' });
  }
}

/**
 * POST /api/thinktank/time-travel/timelines/:id/replay
 * Replay a sequence of checkpoints
 * Novel UI: "Playback Mode" - step-by-step animation through states
 */
export async function replayTimeline(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  try {
    const tenantId = getTenantId(event);
    const timelineId = event.pathParameters?.id;
    if (!tenantId) return jsonResponse(401, { error: 'Unauthorized' });
    if (!timelineId) return jsonResponse(400, { error: 'Timeline ID required' });

    const body = JSON.parse(event.body || '{}');
    const { fromCheckpoint, toCheckpoint } = body;

    if (!fromCheckpoint || !toCheckpoint) {
      return jsonResponse(400, { error: 'fromCheckpoint and toCheckpoint are required' });
    }

    const states = await timeTravelService.replay(
      tenantId,
      timelineId,
      fromCheckpoint,
      toCheckpoint
    );

    return jsonResponse(200, {
      success: true,
      data: {
        states,
        stepCount: states.length,
        playbackReady: true,
      },
      message: '🎬 Replay ready! Watch the conversation unfold.',
    });
  } catch (error) {
    logger.error('Failed to replay timeline', { error });
    return jsonResponse(500, { error: 'Internal server error' });
  }
}

/**
 * GET /api/thinktank/time-travel/checkpoints/:id
 * Get a specific checkpoint
 */
export async function getCheckpoint(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  try {
    const tenantId = getTenantId(event);
    const checkpointId = event.pathParameters?.id;
    if (!tenantId) return jsonResponse(401, { error: 'Unauthorized' });
    if (!checkpointId) return jsonResponse(400, { error: 'Checkpoint ID required' });

    const checkpoint = await timeTravelService.getCheckpoint(tenantId, checkpointId);
    if (!checkpoint) return jsonResponse(404, { error: 'Checkpoint not found' });

    return jsonResponse(200, {
      success: true,
      data: {
        ...checkpoint,
        typeIcon: getCheckpointIcon(checkpoint.type),
        typeColor: getCheckpointColor(checkpoint.type),
        diffSummary: checkpoint.diff ? formatDiff(checkpoint.diff) : null,
      },
    });
  } catch (error) {
    logger.error('Failed to get checkpoint', { error });
    return jsonResponse(500, { error: 'Internal server error' });
  }
}

// ============================================================================
// UI Helpers - "Timeline Scrubber" Visualization
// ============================================================================

function getStatusIcon(status: string): string {
  const icons: Record<string, string> = {
    active: '▶️',
    archived: '📁',
    exploring: '🔍',
    replaying: '🎬',
  };
  return icons[status] || '⏱️';
}

function getStatusColor(status: string): string {
  const colors: Record<string, string> = {
    active: '#10B981',
    archived: '#6B7280',
    exploring: '#F59E0B',
    replaying: '#3B82F6',
  };
  return colors[status] || '#6B7280';
}

function getCheckpointIcon(type: CheckpointType): string {
  const icons: Record<CheckpointType, string> = {
    auto: '⚪',
    manual: '📍',
    fork: '🌿',
    merge: '🔀',
    rollback: '⏪',
  };
  return icons[type] || '⚪';
}

function getCheckpointColor(type: CheckpointType): string {
  const colors: Record<CheckpointType, string> = {
    auto: '#6B7280',
    manual: '#3B82F6',
    fork: '#10B981',
    merge: '#8B5CF6',
    rollback: '#F59E0B',
  };
  return colors[type] || '#6B7280';
}

function formatDiff(diff: { messagesAdded: number; messagesRemoved: number; contextChanged: string[]; modelChanged: boolean }): string {
  const parts: string[] = [];
  if (diff.messagesAdded > 0) parts.push(`+${diff.messagesAdded} msg`);
  if (diff.messagesRemoved > 0) parts.push(`-${diff.messagesRemoved} msg`);
  if (diff.contextChanged.length > 0) parts.push(`ctx: ${diff.contextChanged.join(', ')}`);
  if (diff.modelChanged) parts.push('model changed');
  return parts.join(' | ') || 'No changes';
}

// ============================================================================
// Router
// ============================================================================

export async function handler(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  const path = event.path;
  const method = event.httpMethod;

  // List timelines
  if (method === 'GET' && path.endsWith('/time-travel/timelines')) {
    return listTimelines(event);
  }

  // Create timeline
  if (method === 'POST' && path.endsWith('/time-travel/timelines')) {
    return createTimeline(event);
  }

  // Get checkpoint
  if (method === 'GET' && path.match(/\/time-travel\/checkpoints\/[^/]+$/)) {
    return getCheckpoint(event);
  }

  // Timeline actions
  if (method === 'POST' && path.match(/\/time-travel\/timelines\/[^/]+\/checkpoint$/)) {
    return createCheckpoint(event);
  }
  if (method === 'POST' && path.match(/\/time-travel\/timelines\/[^/]+\/jump$/)) {
    return jumpToCheckpoint(event);
  }
  if (method === 'POST' && path.match(/\/time-travel\/timelines\/[^/]+\/fork$/)) {
    return forkTimeline(event);
  }
  if (method === 'POST' && path.match(/\/time-travel\/timelines\/[^/]+\/replay$/)) {
    return replayTimeline(event);
  }

  // Get timeline
  if (method === 'GET' && path.match(/\/time-travel\/timelines\/[^/]+$/)) {
    return getTimeline(event);
  }

  return jsonResponse(404, { error: 'Not found' });
}
