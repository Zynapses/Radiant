// RADIANT v4.18.0 - Council of Rivals API Handler
// Adversarial Consensus System (Multi-Model Debate)
// Novel UI: "Debate Arena" - amphitheater with model avatars debating

import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { councilOfRivalsService, PresetCouncilType } from '../shared/services/council-of-rivals.service';
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
// Council Handlers
// ============================================================================

/**
 * GET /api/thinktank/council
 * List all councils
 * Novel UI: "Arena Gallery" - cards showing council compositions
 */
export async function listCouncils(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  try {
    const tenantId = getTenantId(event);
    if (!tenantId) return jsonResponse(401, { error: 'Unauthorized' });

    const councils = await councilOfRivalsService.listCouncils(tenantId);

    return jsonResponse(200, {
      success: true,
      data: councils.map(c => ({
        ...c,
        statusIcon: getStatusIcon(c.status),
        statusColor: getStatusColor(c.status),
        memberAvatars: c.members.map(m => m.avatar).join(' '),
        memberCount: c.members.length,
      })),
    });
  } catch (error) {
    logger.error('Failed to list councils', { error });
    return jsonResponse(500, { error: 'Internal server error' });
  }
}

/**
 * POST /api/thinktank/council
 * Create a new council
 * Novel UI: "Summon Council" - wizard to select members
 */
export async function createCouncil(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  try {
    const tenantId = getTenantId(event);
    const userId = getUserId(event);
    if (!tenantId || !userId) return jsonResponse(401, { error: 'Unauthorized' });

    const body = JSON.parse(event.body || '{}');
    const { name, description, members, moderator, rules } = body;

    if (!name || !members || members.length < 2) {
      return jsonResponse(400, { error: 'name and at least 2 members are required' });
    }

    const council = await councilOfRivalsService.createCouncil(tenantId, {
      name,
      description: description || '',
      members,
      moderator: moderator || { model: 'gpt-4o', style: 'facilitator', maxRounds: 3, consensusThreshold: 0.7, timeoutMs: 30000 },
      rules: rules || { minArguments: 1, maxArguments: 3, requireEvidence: false, allowRebuttals: true, votingMethod: 'majority', tieBreaker: 'synthesize' },
      createdBy: userId,
    });

    return jsonResponse(201, {
      success: true,
      data: council,
      message: '⚔️ The Council has been summoned!',
    });
  } catch (error) {
    logger.error('Failed to create council', { error });
    return jsonResponse(500, { error: 'Internal server error' });
  }
}

/**
 * POST /api/thinktank/council/preset
 * Create a preset council
 */
export async function createPresetCouncil(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  try {
    const tenantId = getTenantId(event);
    const userId = getUserId(event);
    if (!tenantId || !userId) return jsonResponse(401, { error: 'Unauthorized' });

    const body = JSON.parse(event.body || '{}');
    const { preset } = body;

    if (!preset || !['balanced', 'technical', 'creative'].includes(preset)) {
      return jsonResponse(400, { error: 'Valid preset required: balanced, technical, or creative' });
    }

    const council = await councilOfRivalsService.createPresetCouncil(tenantId, preset as PresetCouncilType, userId);

    return jsonResponse(201, {
      success: true,
      data: council,
      message: `🏛️ ${council.name} has been assembled!`,
    });
  } catch (error) {
    logger.error('Failed to create preset council', { error });
    return jsonResponse(500, { error: 'Internal server error' });
  }
}

/**
 * GET /api/thinktank/council/:id
 * Get a council with full details
 * Novel UI: "Council Chamber" - circular arrangement of members
 */
export async function getCouncil(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  try {
    const tenantId = getTenantId(event);
    const councilId = event.pathParameters?.id;
    if (!tenantId) return jsonResponse(401, { error: 'Unauthorized' });
    if (!councilId) return jsonResponse(400, { error: 'Council ID required' });

    const council = await councilOfRivalsService.getCouncil(tenantId, councilId);
    if (!council) return jsonResponse(404, { error: 'Council not found' });

    // Add visualization data for arena UI
    const arenaLayout = council.members.map((member, index) => {
      const angle = (index / council.members.length) * 2 * Math.PI - Math.PI / 2;
      const radius = 40; // Percent from center
      return {
        ...member,
        roleIcon: getRoleIcon(member.role),
        position: {
          x: 50 + radius * Math.cos(angle),
          y: 50 + radius * Math.sin(angle),
        },
      };
    });

    return jsonResponse(200, {
      success: true,
      data: {
        ...council,
        arenaLayout,
        statusIcon: getStatusIcon(council.status),
        moderatorIcon: getModeratorIcon(council.moderator.style),
      },
    });
  } catch (error) {
    logger.error('Failed to get council', { error });
    return jsonResponse(500, { error: 'Internal server error' });
  }
}

/**
 * PUT /api/thinktank/council/:id
 * Update a council
 */
export async function updateCouncil(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  try {
    const tenantId = getTenantId(event);
    const councilId = event.pathParameters?.id;
    if (!tenantId) return jsonResponse(401, { error: 'Unauthorized' });
    if (!councilId) return jsonResponse(400, { error: 'Council ID required' });

    const body = JSON.parse(event.body || '{}');
    const council = await councilOfRivalsService.updateCouncil(tenantId, councilId, body);

    if (!council) return jsonResponse(404, { error: 'Council not found' });

    return jsonResponse(200, { success: true, data: council });
  } catch (error) {
    logger.error('Failed to update council', { error });
    return jsonResponse(500, { error: 'Internal server error' });
  }
}

/**
 * DELETE /api/thinktank/council/:id
 * Delete a council
 */
export async function deleteCouncil(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  try {
    const tenantId = getTenantId(event);
    const councilId = event.pathParameters?.id;
    if (!tenantId) return jsonResponse(401, { error: 'Unauthorized' });
    if (!councilId) return jsonResponse(400, { error: 'Council ID required' });

    const deleted = await councilOfRivalsService.deleteCouncil(tenantId, councilId);
    if (!deleted) return jsonResponse(404, { error: 'Council not found' });

    return jsonResponse(200, {
      success: true,
      message: '🏛️ The Council has been disbanded.',
    });
  } catch (error) {
    logger.error('Failed to delete council', { error });
    return jsonResponse(500, { error: 'Internal server error' });
  }
}

// ============================================================================
// Debate Handlers
// ============================================================================

/**
 * POST /api/thinktank/council/:id/debate
 * Start a new debate
 * Novel UI: "Open the Floor" - topic appears in center of arena
 */
export async function startDebate(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  try {
    const tenantId = getTenantId(event);
    const councilId = event.pathParameters?.id;
    if (!tenantId) return jsonResponse(401, { error: 'Unauthorized' });
    if (!councilId) return jsonResponse(400, { error: 'Council ID required' });

    const body = JSON.parse(event.body || '{}');
    const { topic, context } = body;

    if (!topic) {
      return jsonResponse(400, { error: 'topic is required' });
    }

    const debate = await councilOfRivalsService.startDebate(tenantId, councilId, topic, context || '');

    return jsonResponse(201, {
      success: true,
      data: debate,
      message: '📢 The debate has begun! Council members, present your arguments.',
    });
  } catch (error) {
    logger.error('Failed to start debate', { error });
    return jsonResponse(500, { error: 'Internal server error' });
  }
}

/**
 * GET /api/thinktank/council/debate/:id
 * Get debate details
 * Novel UI: "Debate Timeline" - rounds displayed as phases
 */
export async function getDebate(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  try {
    const tenantId = getTenantId(event);
    const debateId = event.pathParameters?.id;
    if (!tenantId) return jsonResponse(401, { error: 'Unauthorized' });
    if (!debateId) return jsonResponse(400, { error: 'Debate ID required' });

    const debate = await councilOfRivalsService.getDebate(tenantId, debateId);
    if (!debate) return jsonResponse(404, { error: 'Debate not found' });

    const council = await councilOfRivalsService.getCouncil(tenantId, debate.councilId);

    // Build visualization data
    const roundsWithUI = debate.rounds.map(round => ({
      ...round,
      phaseIcon: getPhaseIcon(round.phase),
      arguments: round.arguments.map(arg => {
        const member = council?.members.find(m => m.id === arg.memberId);
        return {
          ...arg,
          memberName: member?.name || 'Unknown',
          memberAvatar: member?.avatar || '👤',
          memberColor: member?.color || '#6B7280',
          confidenceBar: Math.round(arg.confidence * 100),
        };
      }),
      rebuttals: round.rebuttals.map(reb => {
        const member = council?.members.find(m => m.id === reb.memberId);
        return {
          ...reb,
          memberName: member?.name || 'Unknown',
          memberAvatar: member?.avatar || '👤',
          strengthBar: Math.round(reb.strength * 100),
        };
      }),
    }));

    return jsonResponse(200, {
      success: true,
      data: {
        ...debate,
        rounds: roundsWithUI,
        statusIcon: getDebateStatusIcon(debate.status),
        verdictDisplay: debate.verdict ? formatVerdict(debate.verdict) : null,
      },
    });
  } catch (error) {
    logger.error('Failed to get debate', { error });
    return jsonResponse(500, { error: 'Internal server error' });
  }
}

/**
 * POST /api/thinktank/council/debate/:id/argument
 * Submit an argument
 * Novel UI: "Take the Podium" - member avatar highlighted
 */
export async function submitArgument(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  try {
    const tenantId = getTenantId(event);
    const debateId = event.pathParameters?.id;
    if (!tenantId) return jsonResponse(401, { error: 'Unauthorized' });
    if (!debateId) return jsonResponse(400, { error: 'Debate ID required' });

    const body = JSON.parse(event.body || '{}');
    const { memberId, position, reasoning, evidence, confidence } = body;

    if (!memberId || !position || !reasoning) {
      return jsonResponse(400, { error: 'memberId, position, and reasoning are required' });
    }

    const debate = await councilOfRivalsService.submitArgument(tenantId, debateId, memberId, {
      position,
      reasoning,
      evidence,
      confidence: confidence || 0.8,
    });

    return jsonResponse(200, {
      success: true,
      data: debate,
      message: '🎤 Argument submitted to the council.',
    });
  } catch (error) {
    logger.error('Failed to submit argument', { error });
    return jsonResponse(500, { error: 'Internal server error' });
  }
}

/**
 * POST /api/thinktank/council/debate/:id/rebuttal
 * Submit a rebuttal
 * Novel UI: "Challenge!" - crossing swords animation
 */
export async function submitRebuttal(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  try {
    const tenantId = getTenantId(event);
    const debateId = event.pathParameters?.id;
    if (!tenantId) return jsonResponse(401, { error: 'Unauthorized' });
    if (!debateId) return jsonResponse(400, { error: 'Debate ID required' });

    const body = JSON.parse(event.body || '{}');
    const { memberId, targetArgumentId, counterpoint, strength } = body;

    if (!memberId || !targetArgumentId || !counterpoint) {
      return jsonResponse(400, { error: 'memberId, targetArgumentId, and counterpoint are required' });
    }

    const debate = await councilOfRivalsService.submitRebuttal(tenantId, debateId, memberId, {
      targetArgumentId,
      counterpoint,
      strength: strength || 0.7,
    });

    return jsonResponse(200, {
      success: true,
      data: debate,
      message: '⚔️ Rebuttal delivered!',
    });
  } catch (error) {
    logger.error('Failed to submit rebuttal', { error });
    return jsonResponse(500, { error: 'Internal server error' });
  }
}

/**
 * POST /api/thinktank/council/debate/:id/vote
 * Conduct voting and conclude debate
 * Novel UI: "Call the Vote" - voting animation, verdict reveal
 */
export async function conductVoting(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  try {
    const tenantId = getTenantId(event);
    const debateId = event.pathParameters?.id;
    if (!tenantId) return jsonResponse(401, { error: 'Unauthorized' });
    if (!debateId) return jsonResponse(400, { error: 'Debate ID required' });

    const verdict = await councilOfRivalsService.conductVoting(tenantId, debateId);

    return jsonResponse(200, {
      success: true,
      data: {
        verdict,
        display: formatVerdict(verdict),
      },
      message: getVerdictMessage(verdict.outcome),
    });
  } catch (error) {
    logger.error('Failed to conduct voting', { error });
    return jsonResponse(500, { error: 'Internal server error' });
  }
}

/**
 * GET /api/thinktank/council/presets
 * Get available preset councils
 */
export async function getPresets(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  try {
    const tenantId = getTenantId(event);
    if (!tenantId) return jsonResponse(401, { error: 'Unauthorized' });

    const presets = [
      {
        id: 'balanced',
        name: 'Balanced Council',
        description: 'A balanced council with diverse perspectives - advocate, critic, and synthesizer',
        icon: '⚖️',
        color: '#3B82F6',
        memberCount: 3,
        recommendedFor: ['General decisions', 'Brainstorming', 'Problem solving'],
      },
      {
        id: 'technical',
        name: 'Technical Review Board',
        description: 'Expert council for technical decisions - architect, pragmatist, and skeptic',
        icon: '🔧',
        color: '#10B981',
        memberCount: 3,
        recommendedFor: ['Code reviews', 'Architecture decisions', 'Technical trade-offs'],
      },
      {
        id: 'creative',
        name: 'Creative Council',
        description: 'Diverse voices for creative exploration - visionary, craftsman, and audience',
        icon: '🎨',
        color: '#8B5CF6',
        memberCount: 3,
        recommendedFor: ['Creative writing', 'Design decisions', 'Marketing strategies'],
      },
    ];

    return jsonResponse(200, { success: true, data: presets });
  } catch (error) {
    logger.error('Failed to get presets', { error });
    return jsonResponse(500, { error: 'Internal server error' });
  }
}

// ============================================================================
// UI Helpers - "Debate Arena" Visualization
// ============================================================================

function getStatusIcon(status: string): string {
  const icons: Record<string, string> = {
    idle: '😴',
    deliberating: '🗣️',
    voting: '🗳️',
    concluded: '✅',
  };
  return icons[status] || '❓';
}

function getStatusColor(status: string): string {
  const colors: Record<string, string> = {
    idle: '#6B7280',
    deliberating: '#F59E0B',
    voting: '#3B82F6',
    concluded: '#10B981',
  };
  return colors[status] || '#6B7280';
}

function getRoleIcon(role: string): string {
  const icons: Record<string, string> = {
    advocate: '📣',
    critic: '🔍',
    synthesizer: '🔮',
    specialist: '🎓',
    contrarian: '😈',
  };
  return icons[role] || '👤';
}

function getModeratorIcon(style: string): string {
  const icons: Record<string, string> = {
    strict: '⚖️',
    facilitator: '🤝',
    socratic: '🤔',
    democratic: '🗳️',
  };
  return icons[style] || '👨‍⚖️';
}

function getPhaseIcon(phase: string): string {
  const icons: Record<string, string> = {
    opening: '🎬',
    arguments: '🎤',
    rebuttals: '⚔️',
    closing: '🏁',
  };
  return icons[phase] || '📍';
}

function getDebateStatusIcon(status: string): string {
  const icons: Record<string, string> = {
    setup: '⏳',
    active: '🔥',
    voting: '🗳️',
    concluded: '🏆',
    deadlocked: '🔒',
  };
  return icons[status] || '❓';
}

function formatVerdict(verdict: { outcome: string; summary: string; winningPosition?: string; confidence: number; synthesizedAnswer?: string }): {
  outcomeIcon: string;
  outcomeColor: string;
  confidencePercent: number;
  displayText: string;
} {
  const outcomeIcons: Record<string, string> = {
    consensus: '🤝',
    majority: '✋',
    split: '⚖️',
    deadlock: '🔒',
    synthesized: '🔮',
  };

  const outcomeColors: Record<string, string> = {
    consensus: '#10B981',
    majority: '#3B82F6',
    split: '#F59E0B',
    deadlock: '#EF4444',
    synthesized: '#8B5CF6',
  };

  return {
    outcomeIcon: outcomeIcons[verdict.outcome] || '❓',
    outcomeColor: outcomeColors[verdict.outcome] || '#6B7280',
    confidencePercent: Math.round(verdict.confidence * 100),
    displayText: verdict.synthesizedAnswer || verdict.winningPosition || verdict.summary,
  };
}

function getVerdictMessage(outcome: string): string {
  const messages: Record<string, string> = {
    consensus: '🤝 The Council has reached unanimous consensus!',
    majority: '✋ A majority decision has been reached.',
    split: '⚖️ The Council remains divided.',
    deadlock: '🔒 The Council has reached a deadlock.',
    synthesized: '🔮 A synthesized answer emerges from the debate!',
  };
  return messages[outcome] || 'Deliberation complete.';
}

// ============================================================================
// Router
// ============================================================================

export async function handler(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  const path = event.path;
  const method = event.httpMethod;

  // Presets
  if (method === 'GET' && path.endsWith('/council/presets')) {
    return getPresets(event);
  }
  if (method === 'POST' && path.endsWith('/council/preset')) {
    return createPresetCouncil(event);
  }

  // Debate actions
  if (method === 'POST' && path.match(/\/council\/debate\/[^/]+\/argument$/)) {
    return submitArgument(event);
  }
  if (method === 'POST' && path.match(/\/council\/debate\/[^/]+\/rebuttal$/)) {
    return submitRebuttal(event);
  }
  if (method === 'POST' && path.match(/\/council\/debate\/[^/]+\/vote$/)) {
    return conductVoting(event);
  }
  if (method === 'GET' && path.match(/\/council\/debate\/[^/]+$/) && !path.includes('/council/debate/preset')) {
    return getDebate(event);
  }

  // Council actions
  if (method === 'POST' && path.match(/\/council\/[^/]+\/debate$/)) {
    return startDebate(event);
  }

  // Council CRUD
  if (method === 'GET' && path.endsWith('/council')) {
    return listCouncils(event);
  }
  if (method === 'POST' && path.endsWith('/council')) {
    return createCouncil(event);
  }
  if (method === 'GET' && path.match(/\/council\/[^/]+$/) && !path.includes('/debate')) {
    return getCouncil(event);
  }
  if (method === 'PUT' && path.match(/\/council\/[^/]+$/)) {
    return updateCouncil(event);
  }
  if (method === 'DELETE' && path.match(/\/council\/[^/]+$/)) {
    return deleteCouncil(event);
  }

  return jsonResponse(404, { error: 'Not found' });
}
