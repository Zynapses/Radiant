// RADIANT v4.18.0 - Policy Framework API Handler
// Strategic Intelligence & Regulatory Stance Configuration
// Novel UI: "Stance Compass" - radial selector for policy positions

import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { policyFrameworkService, PolicyDomain, StancePosition, PresetProfileType } from '../shared/services/policy-framework.service';
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
// Compass View Handler
// ============================================================================

/**
 * GET /api/thinktank/policy/compass
 * Get compass visualization of current policy stance
 * Novel UI: "Stance Compass" - radial chart with domain positions
 */
export async function getCompass(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  try {
    const tenantId = getTenantId(event);
    if (!tenantId) return jsonResponse(401, { error: 'Unauthorized' });

    const compass = await policyFrameworkService.getCompassView(tenantId);

    // Add visualization helpers
    const compassData = {
      ...compass,
      domains: compass.domains.map(d => ({
        ...d,
        positionLabel: getPositionLabel(d.position),
        strengthLabel: `${d.radius}%`,
        x: 50 + (d.radius / 100) * 40 * Math.cos((d.angle - 90) * Math.PI / 180),
        y: 50 + (d.radius / 100) * 40 * Math.sin((d.angle - 90) * Math.PI / 180),
      })),
      needleAngle: compass.overallPosition.angle - 90,
      needleLength: compass.overallPosition.magnitude * 0.4,
    };

    return jsonResponse(200, { success: true, data: compassData });
  } catch (error) {
    logger.error('Failed to get compass', { error });
    return jsonResponse(500, { error: 'Internal server error' });
  }
}

// ============================================================================
// Stance Handlers
// ============================================================================

/**
 * GET /api/thinktank/policy/stances
 * List all policy stances
 */
export async function listStances(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  try {
    const tenantId = getTenantId(event);
    if (!tenantId) return jsonResponse(401, { error: 'Unauthorized' });

    const stances = await policyFrameworkService.listStances(tenantId);

    return jsonResponse(200, {
      success: true,
      data: stances.map(s => ({
        ...s,
        domainIcon: getDomainIcon(s.domain),
        domainColor: getDomainColor(s.domain),
        positionIcon: getPositionIcon(s.position),
        strengthBar: s.strength,
      })),
    });
  } catch (error) {
    logger.error('Failed to list stances', { error });
    return jsonResponse(500, { error: 'Internal server error' });
  }
}

/**
 * GET /api/thinktank/policy/stances/:domain
 * Get stance for a specific domain
 */
export async function getStance(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  try {
    const tenantId = getTenantId(event);
    const domain = event.pathParameters?.domain as PolicyDomain;
    if (!tenantId) return jsonResponse(401, { error: 'Unauthorized' });
    if (!domain) return jsonResponse(400, { error: 'Domain required' });

    const stance = await policyFrameworkService.getStance(tenantId, domain);

    if (!stance) {
      // Return default stance
      return jsonResponse(200, {
        success: true,
        data: {
          domain,
          position: 'balanced',
          strength: 70,
          isDefault: true,
          domainIcon: getDomainIcon(domain),
          domainColor: getDomainColor(domain),
        },
      });
    }

    return jsonResponse(200, {
      success: true,
      data: {
        ...stance,
        domainIcon: getDomainIcon(stance.domain),
        domainColor: getDomainColor(stance.domain),
        positionIcon: getPositionIcon(stance.position),
      },
    });
  } catch (error) {
    logger.error('Failed to get stance', { error });
    return jsonResponse(500, { error: 'Internal server error' });
  }
}

/**
 * POST /api/thinktank/policy/stances
 * Create or update a policy stance
 */
export async function createStance(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  try {
    const tenantId = getTenantId(event);
    const userId = getUserId(event);
    if (!tenantId || !userId) return jsonResponse(401, { error: 'Unauthorized' });

    const body = JSON.parse(event.body || '{}');
    const { domain, position, strength, rationale, sources, implications } = body;

    if (!domain || !position) {
      return jsonResponse(400, { error: 'domain and position are required' });
    }

    const stance = await policyFrameworkService.createStance(tenantId, {
      domain,
      position,
      strength: strength || 70,
      rationale: rationale || '',
      sources: sources || [],
      implications: implications || [],
      enabled: true,
      createdBy: userId,
    });

    return jsonResponse(201, {
      success: true,
      data: stance,
      message: `🧭 Policy stance for ${getDomainLabel(domain)} updated.`,
    });
  } catch (error) {
    logger.error('Failed to create stance', { error });
    return jsonResponse(500, { error: 'Internal server error' });
  }
}

/**
 * PUT /api/thinktank/policy/stances/:id
 * Update a policy stance
 */
export async function updateStance(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  try {
    const tenantId = getTenantId(event);
    const stanceId = event.pathParameters?.id;
    if (!tenantId) return jsonResponse(401, { error: 'Unauthorized' });
    if (!stanceId) return jsonResponse(400, { error: 'Stance ID required' });

    const body = JSON.parse(event.body || '{}');
    const stance = await policyFrameworkService.updateStance(tenantId, stanceId, body);

    if (!stance) return jsonResponse(404, { error: 'Stance not found' });

    return jsonResponse(200, { success: true, data: stance });
  } catch (error) {
    logger.error('Failed to update stance', { error });
    return jsonResponse(500, { error: 'Internal server error' });
  }
}

// ============================================================================
// Profile Handlers
// ============================================================================

/**
 * GET /api/thinktank/policy/profiles
 * List all policy profiles
 */
export async function listProfiles(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  try {
    const tenantId = getTenantId(event);
    if (!tenantId) return jsonResponse(401, { error: 'Unauthorized' });

    const profiles = await policyFrameworkService.listProfiles(tenantId);

    return jsonResponse(200, {
      success: true,
      data: profiles.map(p => ({
        ...p,
        stanceCount: Object.keys(p.stances).length,
        statusIcon: p.isDefault ? '✅' : '⚪',
      })),
    });
  } catch (error) {
    logger.error('Failed to list profiles', { error });
    return jsonResponse(500, { error: 'Internal server error' });
  }
}

/**
 * GET /api/thinktank/policy/profiles/active
 * Get the active policy profile
 */
export async function getActiveProfile(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  try {
    const tenantId = getTenantId(event);
    if (!tenantId) return jsonResponse(401, { error: 'Unauthorized' });

    const profile = await policyFrameworkService.getActiveProfile(tenantId);

    return jsonResponse(200, {
      success: true,
      data: {
        ...profile,
        stancesSummary: Object.entries(profile?.stances || {}).map(([domain, stance]) => ({
          domain,
          ...stance,
          icon: getDomainIcon(domain as PolicyDomain),
          color: getDomainColor(domain as PolicyDomain),
        })),
      },
    });
  } catch (error) {
    logger.error('Failed to get active profile', { error });
    return jsonResponse(500, { error: 'Internal server error' });
  }
}

/**
 * POST /api/thinktank/policy/profiles
 * Create a policy profile
 */
export async function createProfile(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  try {
    const tenantId = getTenantId(event);
    const userId = getUserId(event);
    if (!tenantId || !userId) return jsonResponse(401, { error: 'Unauthorized' });

    const body = JSON.parse(event.body || '{}');
    const { name, description, stances, isDefault } = body;

    if (!name || !stances) {
      return jsonResponse(400, { error: 'name and stances are required' });
    }

    const profile = await policyFrameworkService.createProfile(tenantId, {
      name,
      description: description || '',
      stances,
      isDefault: isDefault || false,
      createdBy: userId,
    });

    return jsonResponse(201, {
      success: true,
      data: profile,
      message: `📋 Policy profile "${name}" created.`,
    });
  } catch (error) {
    logger.error('Failed to create profile', { error });
    return jsonResponse(500, { error: 'Internal server error' });
  }
}

/**
 * POST /api/thinktank/policy/profiles/preset
 * Create a preset profile
 */
export async function createPresetProfile(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  try {
    const tenantId = getTenantId(event);
    const userId = getUserId(event);
    if (!tenantId || !userId) return jsonResponse(401, { error: 'Unauthorized' });

    const body = JSON.parse(event.body || '{}');
    const { preset } = body;

    if (!preset || !['conservative', 'balanced', 'innovative'].includes(preset)) {
      return jsonResponse(400, { error: 'Valid preset required: conservative, balanced, or innovative' });
    }

    const profile = await policyFrameworkService.createPresetProfile(tenantId, preset as PresetProfileType, userId);

    return jsonResponse(201, {
      success: true,
      data: profile,
      message: `📋 ${profile.name} profile created.`,
    });
  } catch (error) {
    logger.error('Failed to create preset profile', { error });
    return jsonResponse(500, { error: 'Internal server error' });
  }
}

/**
 * PUT /api/thinktank/policy/profiles/:id/activate
 * Set a profile as the default
 */
export async function activateProfile(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  try {
    const tenantId = getTenantId(event);
    const profileId = event.pathParameters?.id;
    if (!tenantId) return jsonResponse(401, { error: 'Unauthorized' });
    if (!profileId) return jsonResponse(400, { error: 'Profile ID required' });

    await policyFrameworkService.setDefaultProfile(tenantId, profileId);

    return jsonResponse(200, {
      success: true,
      message: '✅ Profile activated as default.',
    });
  } catch (error) {
    logger.error('Failed to activate profile', { error });
    return jsonResponse(500, { error: 'Internal server error' });
  }
}

// ============================================================================
// Recommendations & Compliance Handlers
// ============================================================================

/**
 * GET /api/thinktank/policy/recommendations
 * Get policy recommendations
 * Novel UI: "Policy Advisor" - cards with suggested improvements
 */
export async function getRecommendations(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  try {
    const tenantId = getTenantId(event);
    if (!tenantId) return jsonResponse(401, { error: 'Unauthorized' });

    const recommendations = await policyFrameworkService.getRecommendations(tenantId);

    return jsonResponse(200, {
      success: true,
      data: recommendations.map(r => ({
        ...r,
        domainIcon: getDomainIcon(r.domain),
        domainColor: getDomainColor(r.domain),
        urgencyIcon: getUrgencyIcon(r.urgency),
        urgencyColor: getUrgencyColor(r.urgency),
        currentIcon: getPositionIcon(r.currentPosition),
        recommendedIcon: getPositionIcon(r.recommendedPosition),
      })),
    });
  } catch (error) {
    logger.error('Failed to get recommendations', { error });
    return jsonResponse(500, { error: 'Internal server error' });
  }
}

/**
 * GET /api/thinktank/policy/compliance
 * Check compliance status
 * Novel UI: "Compliance Dashboard" - checklist with status indicators
 */
export async function checkCompliance(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  try {
    const tenantId = getTenantId(event);
    if (!tenantId) return jsonResponse(401, { error: 'Unauthorized' });

    const compliance = await policyFrameworkService.checkCompliance(tenantId);

    // Calculate overall compliance
    const compliantCount = compliance.filter(c => c.status === 'compliant').length;
    const partialCount = compliance.filter(c => c.status === 'partial').length;
    const totalCount = compliance.length;

    const overallStatus = compliantCount === totalCount ? 'compliant'
      : compliantCount + partialCount >= totalCount * 0.7 ? 'partial'
      : 'non_compliant';

    return jsonResponse(200, {
      success: true,
      data: {
        overall: {
          status: overallStatus,
          compliantCount,
          partialCount,
          totalCount,
          percentage: Math.round((compliantCount / totalCount) * 100),
          statusIcon: getComplianceIcon(overallStatus),
          statusColor: getComplianceColor(overallStatus),
        },
        domains: compliance.map(c => ({
          ...c,
          domainIcon: getDomainIcon(c.domain),
          domainColor: getDomainColor(c.domain),
          statusIcon: getComplianceIcon(c.status),
          statusColor: getComplianceColor(c.status),
          requirementsMet: c.requirements.filter(r => r.status === 'met').length,
          requirementsTotal: c.requirements.length,
        })),
      },
    });
  } catch (error) {
    logger.error('Failed to check compliance', { error });
    return jsonResponse(500, { error: 'Internal server error' });
  }
}

/**
 * GET /api/thinktank/policy/domains
 * Get available policy domains
 */
export async function getDomains(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  try {
    const tenantId = getTenantId(event);
    if (!tenantId) return jsonResponse(401, { error: 'Unauthorized' });

    const domains: PolicyDomain[] = [
      'ai_safety', 'data_privacy', 'content_moderation', 'accessibility',
      'sustainability', 'security', 'transparency', 'ethics', 'compliance', 'innovation',
    ];

    return jsonResponse(200, {
      success: true,
      data: domains.map(d => ({
        id: d,
        label: getDomainLabel(d),
        description: getDomainDescription(d),
        icon: getDomainIcon(d),
        color: getDomainColor(d),
      })),
    });
  } catch (error) {
    logger.error('Failed to get domains', { error });
    return jsonResponse(500, { error: 'Internal server error' });
  }
}

/**
 * GET /api/thinktank/policy/positions
 * Get available stance positions
 */
export async function getPositions(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  try {
    const tenantId = getTenantId(event);
    if (!tenantId) return jsonResponse(401, { error: 'Unauthorized' });

    const positions: StancePosition[] = ['restrictive', 'cautious', 'balanced', 'permissive', 'adaptive'];

    return jsonResponse(200, {
      success: true,
      data: positions.map(p => ({
        id: p,
        label: getPositionLabel(p),
        description: getPositionDescription(p),
        icon: getPositionIcon(p),
        color: getPositionColor(p),
      })),
    });
  } catch (error) {
    logger.error('Failed to get positions', { error });
    return jsonResponse(500, { error: 'Internal server error' });
  }
}

// ============================================================================
// UI Helpers - "Stance Compass" Visualization
// ============================================================================

function getDomainIcon(domain: PolicyDomain): string {
  const icons: Record<PolicyDomain, string> = {
    ai_safety: '🤖', data_privacy: '🔒', content_moderation: '📝', accessibility: '♿',
    sustainability: '🌱', security: '🛡️', transparency: '👁️', ethics: '⚖️',
    compliance: '📋', innovation: '💡',
  };
  return icons[domain] || '📌';
}

function getDomainColor(domain: PolicyDomain): string {
  const colors: Record<PolicyDomain, string> = {
    ai_safety: '#EF4444', data_privacy: '#8B5CF6', content_moderation: '#F59E0B', accessibility: '#10B981',
    sustainability: '#22C55E', security: '#DC2626', transparency: '#3B82F6', ethics: '#EC4899',
    compliance: '#6366F1', innovation: '#06B6D4',
  };
  return colors[domain] || '#6B7280';
}

function getDomainLabel(domain: PolicyDomain): string {
  const labels: Record<PolicyDomain, string> = {
    ai_safety: 'AI Safety', data_privacy: 'Data Privacy', content_moderation: 'Content Moderation',
    accessibility: 'Accessibility', sustainability: 'Sustainability', security: 'Security',
    transparency: 'Transparency', ethics: 'Ethics', compliance: 'Compliance', innovation: 'Innovation',
  };
  return labels[domain] || domain;
}

function getDomainDescription(domain: PolicyDomain): string {
  const descriptions: Record<PolicyDomain, string> = {
    ai_safety: 'AI alignment, safety measures, and risk mitigation',
    data_privacy: 'Data protection, user consent, and privacy compliance',
    content_moderation: 'Content policies, filtering, and safety measures',
    accessibility: 'WCAG compliance and inclusive design',
    sustainability: 'Environmental impact and sustainable practices',
    security: 'Cybersecurity posture and threat protection',
    transparency: 'AI decision explainability and openness',
    ethics: 'Ethical AI principles and responsible development',
    compliance: 'Regulatory compliance and audit readiness',
    innovation: 'Balance between safety and experimentation',
  };
  return descriptions[domain] || '';
}

function getPositionIcon(position: StancePosition): string {
  const icons: Record<StancePosition, string> = {
    restrictive: '🔴', cautious: '🟠', balanced: '🟡', permissive: '🟢', adaptive: '🔵',
  };
  return icons[position] || '⚪';
}

function getPositionColor(position: StancePosition): string {
  const colors: Record<StancePosition, string> = {
    restrictive: '#EF4444', cautious: '#F97316', balanced: '#F59E0B', permissive: '#10B981', adaptive: '#3B82F6',
  };
  return colors[position] || '#6B7280';
}

function getPositionLabel(position: StancePosition): string {
  const labels: Record<StancePosition, string> = {
    restrictive: 'Restrictive', cautious: 'Cautious', balanced: 'Balanced', permissive: 'Permissive', adaptive: 'Adaptive',
  };
  return labels[position] || position;
}

function getPositionDescription(position: StancePosition): string {
  const descriptions: Record<StancePosition, string> = {
    restrictive: 'Maximum restrictions and safety measures',
    cautious: 'Conservative approach with strong safeguards',
    balanced: 'Middle ground between safety and flexibility',
    permissive: 'Minimal restrictions, maximum flexibility',
    adaptive: 'Context-dependent, adjusts based on situation',
  };
  return descriptions[position] || '';
}

function getUrgencyIcon(urgency: string): string {
  const icons: Record<string, string> = { low: '🟢', medium: '🟡', high: '🔴' };
  return icons[urgency] || '⚪';
}

function getUrgencyColor(urgency: string): string {
  const colors: Record<string, string> = { low: '#10B981', medium: '#F59E0B', high: '#EF4444' };
  return colors[urgency] || '#6B7280';
}

function getComplianceIcon(status: string): string {
  const icons: Record<string, string> = { compliant: '✅', partial: '⚠️', non_compliant: '❌', unknown: '❓' };
  return icons[status] || '❓';
}

function getComplianceColor(status: string): string {
  const colors: Record<string, string> = { compliant: '#10B981', partial: '#F59E0B', non_compliant: '#EF4444', unknown: '#6B7280' };
  return colors[status] || '#6B7280';
}

// ============================================================================
// Router
// ============================================================================

export async function handler(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  const path = event.path;
  const method = event.httpMethod;

  // Compass
  if (method === 'GET' && path.endsWith('/policy/compass')) {
    return getCompass(event);
  }

  // Domains & Positions
  if (method === 'GET' && path.endsWith('/policy/domains')) {
    return getDomains(event);
  }
  if (method === 'GET' && path.endsWith('/policy/positions')) {
    return getPositions(event);
  }

  // Recommendations & Compliance
  if (method === 'GET' && path.endsWith('/policy/recommendations')) {
    return getRecommendations(event);
  }
  if (method === 'GET' && path.endsWith('/policy/compliance')) {
    return checkCompliance(event);
  }

  // Stances
  if (method === 'GET' && path.endsWith('/policy/stances')) {
    return listStances(event);
  }
  if (method === 'POST' && path.endsWith('/policy/stances')) {
    return createStance(event);
  }
  if (method === 'GET' && path.match(/\/policy\/stances\/[^/]+$/)) {
    return getStance(event);
  }
  if (method === 'PUT' && path.match(/\/policy\/stances\/[^/]+$/)) {
    return updateStance(event);
  }

  // Profiles
  if (method === 'GET' && path.endsWith('/policy/profiles')) {
    return listProfiles(event);
  }
  if (method === 'GET' && path.endsWith('/policy/profiles/active')) {
    return getActiveProfile(event);
  }
  if (method === 'POST' && path.endsWith('/policy/profiles')) {
    return createProfile(event);
  }
  if (method === 'POST' && path.endsWith('/policy/profiles/preset')) {
    return createPresetProfile(event);
  }
  if (method === 'PUT' && path.match(/\/policy\/profiles\/[^/]+\/activate$/)) {
    return activateProfile(event);
  }

  return jsonResponse(404, { error: 'Not found' });
}
