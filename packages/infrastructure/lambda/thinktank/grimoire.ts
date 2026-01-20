// RADIANT v4.18.0 - Grimoire API Handler
// Procedural Memory & Self-Correction Spell Book
// Novel UI: "Spell Book" - magical tome with spell cards, schools of magic, casting history

import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { grimoireService, SpellCategory, SpellSchool, SpellStatus } from '../shared/services/grimoire.service';
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
// Spell CRUD Handlers
// ============================================================================

/**
 * GET /api/thinktank/grimoire/spells
 * List spells with filtering
 * Novel UI: "Spell Library" - grid of spell cards with school colors
 */
export async function listSpells(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  try {
    const tenantId = getTenantId(event);
    if (!tenantId) return jsonResponse(401, { error: 'Unauthorized' });

    const params = event.queryStringParameters || {};
    const { spells, total } = await grimoireService.querySpells(tenantId, {
      search: params.search,
      category: params.category as SpellCategory,
      school: params.school as SpellSchool,
      status: params.status as SpellStatus || 'active',
      minPowerLevel: params.minPower ? parseInt(params.minPower, 10) : undefined,
      maxPowerLevel: params.maxPower ? parseInt(params.maxPower, 10) : undefined,
      isCantrip: params.cantripsOnly === 'true' ? true : undefined,
      isRitual: params.ritualsOnly === 'true' ? true : undefined,
      limit: parseInt(params.limit || '50', 10),
      offset: parseInt(params.offset || '0', 10),
    });

    return jsonResponse(200, {
      success: true,
      data: {
        spells: spells.map(s => ({
          ...s,
          schoolColor: getSchoolColor(s.school),
          categoryIcon: getCategoryIcon(s.category),
          powerStars: '⭐'.repeat(Math.min(s.powerLevel, 10)),
        })),
        total,
      },
    });
  } catch (error) {
    logger.error('Failed to list spells', { error });
    return jsonResponse(500, { error: 'Internal server error' });
  }
}

/**
 * GET /api/thinktank/grimoire/spells/:id
 * Get a specific spell
 * Novel UI: "Spell Card" - detailed view with components, effects, history
 */
export async function getSpell(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  try {
    const tenantId = getTenantId(event);
    const spellId = event.pathParameters?.id;
    if (!tenantId) return jsonResponse(401, { error: 'Unauthorized' });
    if (!spellId) return jsonResponse(400, { error: 'Spell ID required' });

    const spell = await grimoireService.getSpell(tenantId, spellId);
    if (!spell) return jsonResponse(404, { error: 'Spell not found' });

    return jsonResponse(200, {
      success: true,
      data: {
        ...spell,
        schoolColor: getSchoolColor(spell.school),
        categoryIcon: getCategoryIcon(spell.category),
        powerStars: '⭐'.repeat(Math.min(spell.powerLevel, 10)),
        successGrade: getSuccessGrade(spell.successRate),
      },
    });
  } catch (error) {
    logger.error('Failed to get spell', { error });
    return jsonResponse(500, { error: 'Internal server error' });
  }
}

/**
 * POST /api/thinktank/grimoire/spells
 * Create a new spell
 * Novel UI: "Spell Forge" - wizard form to define spell components
 */
export async function createSpell(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  try {
    const tenantId = getTenantId(event);
    const userId = getUserId(event);
    if (!tenantId || !userId) return jsonResponse(401, { error: 'Unauthorized' });

    const body = JSON.parse(event.body || '{}');
    const {
      name, description, category, incantation, components, effect,
      powerLevel, manaRequired, school, prerequisites, sideEffects,
      counters, isCantrip, isRitual, tags, metadata,
    } = body;

    if (!name || !category || !incantation || !school) {
      return jsonResponse(400, { error: 'name, category, incantation, and school are required' });
    }

    const spell = await grimoireService.createSpell(tenantId, {
      name,
      description: description || '',
      category,
      incantation,
      components: components || [],
      effect: effect || '',
      powerLevel: powerLevel || 5,
      manaRequired: manaRequired || 100,
      school,
      prerequisites: prerequisites || [],
      sideEffects: sideEffects || [],
      counters: counters || [],
      isCantrip: isCantrip || false,
      isRitual: isRitual || false,
      createdBy: userId,
      status: 'draft',
      tags: tags || [],
      metadata: metadata || {},
    });

    return jsonResponse(201, { success: true, data: spell });
  } catch (error) {
    logger.error('Failed to create spell', { error });
    return jsonResponse(500, { error: 'Internal server error' });
  }
}

/**
 * PUT /api/thinktank/grimoire/spells/:id
 * Update a spell
 */
export async function updateSpell(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  try {
    const tenantId = getTenantId(event);
    const spellId = event.pathParameters?.id;
    if (!tenantId) return jsonResponse(401, { error: 'Unauthorized' });
    if (!spellId) return jsonResponse(400, { error: 'Spell ID required' });

    const body = JSON.parse(event.body || '{}');
    const spell = await grimoireService.updateSpell(tenantId, spellId, body);

    if (!spell) return jsonResponse(404, { error: 'Spell not found' });
    return jsonResponse(200, { success: true, data: spell });
  } catch (error) {
    logger.error('Failed to update spell', { error });
    return jsonResponse(500, { error: 'Internal server error' });
  }
}

/**
 * DELETE /api/thinktank/grimoire/spells/:id
 * Delete a spell
 */
export async function deleteSpell(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  try {
    const tenantId = getTenantId(event);
    const spellId = event.pathParameters?.id;
    if (!tenantId) return jsonResponse(401, { error: 'Unauthorized' });
    if (!spellId) return jsonResponse(400, { error: 'Spell ID required' });

    const deleted = await grimoireService.deleteSpell(tenantId, spellId);
    if (!deleted) return jsonResponse(404, { error: 'Spell not found' });

    return jsonResponse(200, { success: true });
  } catch (error) {
    logger.error('Failed to delete spell', { error });
    return jsonResponse(500, { error: 'Internal server error' });
  }
}

// ============================================================================
// Spell Casting Handlers
// ============================================================================

/**
 * POST /api/thinktank/grimoire/spells/:id/cast
 * Cast a spell with components
 * Novel UI: "Casting Circle" - animated spell execution with progress
 */
export async function castSpell(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  try {
    const tenantId = getTenantId(event);
    const userId = getUserId(event);
    const spellId = event.pathParameters?.id;
    if (!tenantId || !userId) return jsonResponse(401, { error: 'Unauthorized' });
    if (!spellId) return jsonResponse(400, { error: 'Spell ID required' });

    const body = JSON.parse(event.body || '{}');
    const { components } = body;

    const cast = await grimoireService.castSpell(tenantId, spellId, userId, components || {});

    return jsonResponse(200, {
      success: true,
      data: {
        ...cast,
        sparkles: cast.result.success ? '✨' : '💨',
        message: cast.result.success ? 'Spell cast successfully!' : 'Spell fizzled...',
      },
    });
  } catch (error) {
    logger.error('Failed to cast spell', { error });
    const message = error instanceof Error ? error.message : 'Internal server error';
    return jsonResponse(500, { error: message });
  }
}

/**
 * POST /api/thinktank/grimoire/match
 * Find a spell matching a pattern
 * Novel UI: "Spell Divination" - searches for matching spells
 */
export async function matchSpell(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  try {
    const tenantId = getTenantId(event);
    if (!tenantId) return jsonResponse(401, { error: 'Unauthorized' });

    const body = JSON.parse(event.body || '{}');
    const { pattern } = body;

    if (!pattern) return jsonResponse(400, { error: 'Pattern required' });

    const spell = await grimoireService.findSpellByPattern(tenantId, pattern);

    return jsonResponse(200, {
      success: true,
      data: {
        found: !!spell,
        spell: spell ? {
          ...spell,
          schoolColor: getSchoolColor(spell.school),
          categoryIcon: getCategoryIcon(spell.category),
        } : null,
      },
    });
  } catch (error) {
    logger.error('Failed to match spell', { error });
    return jsonResponse(500, { error: 'Internal server error' });
  }
}

// ============================================================================
// Grimoire (Personal Spell Book) Handlers
// ============================================================================

/**
 * GET /api/thinktank/grimoire
 * Get user's grimoire (spell book overview)
 * Novel UI: "My Grimoire" - ornate book cover with stats and achievements
 */
export async function getGrimoire(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  try {
    const tenantId = getTenantId(event);
    const userId = getUserId(event);
    if (!tenantId) return jsonResponse(401, { error: 'Unauthorized' });

    const grimoire = await grimoireService.getGrimoire(tenantId, userId || undefined);

    // Calculate mastery level
    const totalMastery = Object.values(grimoire.schoolMastery).reduce((a, b) => a + b, 0);
    const masteryLevel = getMasteryLevel(totalMastery);

    return jsonResponse(200, {
      success: true,
      data: {
        ...grimoire,
        masteryLevel,
        title: getMasteryTitle(masteryLevel),
        schoolColors: Object.fromEntries(
          Object.keys(grimoire.schoolMastery).map(s => [s, getSchoolColor(s as SpellSchool)])
        ),
      },
    });
  } catch (error) {
    logger.error('Failed to get grimoire', { error });
    return jsonResponse(500, { error: 'Internal server error' });
  }
}

/**
 * GET /api/thinktank/grimoire/schools
 * Get schools of magic with mastery levels
 * Novel UI: "Schools of Magic" - eight school icons in a circle
 */
export async function getSchools(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  try {
    const tenantId = getTenantId(event);
    if (!tenantId) return jsonResponse(401, { error: 'Unauthorized' });

    const grimoire = await grimoireService.getGrimoire(tenantId);

    const schools: SpellSchool[] = ['code', 'data', 'text', 'analysis', 'design', 'integration', 'automation', 'universal'];
    const schoolData = schools.map(school => ({
      id: school,
      name: getSchoolName(school),
      description: getSchoolDescription(school),
      icon: getSchoolIcon(school),
      color: getSchoolColor(school),
      mastery: grimoire.schoolMastery[school] || 0,
      masteryPercent: Math.min(100, ((grimoire.schoolMastery[school] || 0) / 10) * 100),
    }));

    return jsonResponse(200, { success: true, data: schoolData });
  } catch (error) {
    logger.error('Failed to get schools', { error });
    return jsonResponse(500, { error: 'Internal server error' });
  }
}

/**
 * GET /api/thinktank/grimoire/categories
 * Get spell categories
 * Novel UI: "Spell Types" - cards showing category icons
 */
export async function getCategories(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  try {
    const tenantId = getTenantId(event);
    if (!tenantId) return jsonResponse(401, { error: 'Unauthorized' });

    const categories: SpellCategory[] = [
      'transformation', 'divination', 'conjuration', 'abjuration',
      'enchantment', 'illusion', 'necromancy', 'evocation',
    ];

    const categoryData = categories.map(cat => ({
      id: cat,
      name: getCategoryName(cat),
      description: getCategoryDescription(cat),
      icon: getCategoryIcon(cat),
      color: getCategoryColor(cat),
    }));

    return jsonResponse(200, { success: true, data: categoryData });
  } catch (error) {
    logger.error('Failed to get categories', { error });
    return jsonResponse(500, { error: 'Internal server error' });
  }
}

/**
 * POST /api/thinktank/grimoire/promote
 * Promote a successful pattern to a spell
 * Novel UI: "Spell Inscription" - animated quill writing new spell
 */
export async function promoteToSpell(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  try {
    const tenantId = getTenantId(event);
    const userId = getUserId(event);
    if (!tenantId || !userId) return jsonResponse(401, { error: 'Unauthorized' });

    const body = JSON.parse(event.body || '{}');
    const { name, description, incantation, category, school } = body;

    if (!name || !incantation || !category || !school) {
      return jsonResponse(400, { error: 'name, incantation, category, and school are required' });
    }

    const spell = await grimoireService.promoteToSpell(tenantId, userId, {
      name,
      description: description || '',
      incantation,
      category,
      school,
    });

    return jsonResponse(201, {
      success: true,
      data: spell,
      message: '📜 New spell inscribed in your Grimoire!',
    });
  } catch (error) {
    logger.error('Failed to promote to spell', { error });
    return jsonResponse(500, { error: 'Internal server error' });
  }
}

/**
 * POST /api/thinktank/grimoire/spells/:id/learn
 * Record a learning from spell failure (reflexion)
 */
export async function learnFromFailure(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  try {
    const tenantId = getTenantId(event);
    const spellId = event.pathParameters?.id;
    if (!tenantId) return jsonResponse(401, { error: 'Unauthorized' });
    if (!spellId) return jsonResponse(400, { error: 'Spell ID required' });

    const body = JSON.parse(event.body || '{}');
    const { issue, correction } = body;

    if (!issue || !correction) {
      return jsonResponse(400, { error: 'issue and correction are required' });
    }

    await grimoireService.learnFromFailure(tenantId, spellId, issue, correction);

    return jsonResponse(200, {
      success: true,
      message: '📚 Wisdom recorded in the Grimoire margins.',
    });
  } catch (error) {
    logger.error('Failed to learn from failure', { error });
    return jsonResponse(500, { error: 'Internal server error' });
  }
}

// ============================================================================
// UI Helpers - "Spell Book" Visualization
// ============================================================================

function getSchoolColor(school: SpellSchool): string {
  const colors: Record<SpellSchool, string> = {
    code: '#3B82F6',       // Blue - logic, structure
    data: '#10B981',       // Green - growth, processing
    text: '#F59E0B',       // Amber - knowledge, wisdom
    analysis: '#8B5CF6',   // Purple - insight, mystery
    design: '#EC4899',     // Pink - creativity, beauty
    integration: '#06B6D4', // Cyan - connection, flow
    automation: '#F97316', // Orange - energy, action
    universal: '#6366F1',  // Indigo - all-encompassing
  };
  return colors[school] || '#6B7280';
}

function getSchoolIcon(school: SpellSchool): string {
  const icons: Record<SpellSchool, string> = {
    code: '💻',
    data: '📊',
    text: '📝',
    analysis: '🔍',
    design: '🎨',
    integration: '🔗',
    automation: '⚙️',
    universal: '🌟',
  };
  return icons[school] || '✨';
}

function getSchoolName(school: SpellSchool): string {
  const names: Record<SpellSchool, string> = {
    code: 'School of Code',
    data: 'School of Data',
    text: 'School of Text',
    analysis: 'School of Analysis',
    design: 'School of Design',
    integration: 'School of Integration',
    automation: 'School of Automation',
    universal: 'Universal Magic',
  };
  return names[school] || school;
}

function getSchoolDescription(school: SpellSchool): string {
  const descriptions: Record<SpellSchool, string> = {
    code: 'Programming patterns and code transformations',
    data: 'Data manipulation and structure management',
    text: 'Text processing and content generation',
    analysis: 'Analytical methods and insight extraction',
    design: 'UI/UX patterns and visual creation',
    integration: 'API and system integration spells',
    automation: 'Workflow automation and orchestration',
    universal: 'Cross-domain spells that transcend schools',
  };
  return descriptions[school] || '';
}

function getCategoryIcon(category: SpellCategory): string {
  const icons: Record<SpellCategory, string> = {
    transformation: '🔄',
    divination: '🔮',
    conjuration: '✨',
    abjuration: '🛡️',
    enchantment: '⚡',
    illusion: '🎭',
    necromancy: '💀',
    evocation: '🔥',
  };
  return icons[category] || '📜';
}

function getCategoryName(category: SpellCategory): string {
  return category.charAt(0).toUpperCase() + category.slice(1);
}

function getCategoryDescription(category: SpellCategory): string {
  const descriptions: Record<SpellCategory, string> = {
    transformation: 'Change data from one form to another',
    divination: 'Retrieve and discover information',
    conjuration: 'Create new content from nothing',
    abjuration: 'Validate, protect, and secure',
    enchantment: 'Enhance and optimize existing work',
    illusion: 'Format and present beautifully',
    necromancy: 'Recover and restore lost work',
    evocation: 'Execute direct actions immediately',
  };
  return descriptions[category] || '';
}

function getCategoryColor(category: SpellCategory): string {
  const colors: Record<SpellCategory, string> = {
    transformation: '#3B82F6',
    divination: '#8B5CF6',
    conjuration: '#10B981',
    abjuration: '#F59E0B',
    enchantment: '#06B6D4',
    illusion: '#EC4899',
    necromancy: '#6B7280',
    evocation: '#EF4444',
  };
  return colors[category] || '#6B7280';
}

function getSuccessGrade(rate: number): string {
  if (rate >= 0.95) return 'S';
  if (rate >= 0.85) return 'A';
  if (rate >= 0.70) return 'B';
  if (rate >= 0.50) return 'C';
  if (rate >= 0.30) return 'D';
  return 'F';
}

function getMasteryLevel(total: number): number {
  if (total >= 100) return 10;
  if (total >= 80) return 9;
  if (total >= 60) return 8;
  if (total >= 45) return 7;
  if (total >= 32) return 6;
  if (total >= 21) return 5;
  if (total >= 12) return 4;
  if (total >= 6) return 3;
  if (total >= 2) return 2;
  if (total >= 1) return 1;
  return 0;
}

function getMasteryTitle(level: number): string {
  const titles = [
    'Novice', 'Apprentice', 'Journeyman', 'Adept', 'Expert',
    'Master', 'Grandmaster', 'Archon', 'Sage', 'Archmage', 'Transcendent',
  ];
  return titles[level] || 'Novice';
}

// ============================================================================
// Router
// ============================================================================

export async function handler(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  const path = event.path;
  const method = event.httpMethod;

  // Grimoire overview
  if (method === 'GET' && path.endsWith('/grimoire') && !path.includes('/spells')) {
    return getGrimoire(event);
  }
  if (method === 'GET' && path.endsWith('/grimoire/schools')) {
    return getSchools(event);
  }
  if (method === 'GET' && path.endsWith('/grimoire/categories')) {
    return getCategories(event);
  }
  if (method === 'POST' && path.endsWith('/grimoire/promote')) {
    return promoteToSpell(event);
  }
  if (method === 'POST' && path.endsWith('/grimoire/match')) {
    return matchSpell(event);
  }

  // Spell CRUD
  if (method === 'GET' && path.endsWith('/grimoire/spells')) {
    return listSpells(event);
  }
  if (method === 'POST' && path.endsWith('/grimoire/spells')) {
    return createSpell(event);
  }
  if (method === 'GET' && path.match(/\/grimoire\/spells\/[^/]+$/) && !path.endsWith('/cast') && !path.endsWith('/learn')) {
    return getSpell(event);
  }
  if (method === 'PUT' && path.match(/\/grimoire\/spells\/[^/]+$/)) {
    return updateSpell(event);
  }
  if (method === 'DELETE' && path.match(/\/grimoire\/spells\/[^/]+$/)) {
    return deleteSpell(event);
  }

  // Spell actions
  if (method === 'POST' && path.match(/\/grimoire\/spells\/[^/]+\/cast$/)) {
    return castSpell(event);
  }
  if (method === 'POST' && path.match(/\/grimoire\/spells\/[^/]+\/learn$/)) {
    return learnFromFailure(event);
  }

  return jsonResponse(404, { error: 'Not found' });
}
