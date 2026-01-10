// RADIANT v4.18.0 - Admin API for Regulatory Standards Registry
// Manages regulatory standards, requirements, and tenant compliance status

import { APIGatewayProxyHandler, APIGatewayProxyResult } from 'aws-lambda';
import { PoolClient } from 'pg';
import { getPoolClient } from '../shared/db/centralized-pool';
import { enhancedLogger as logger } from '../shared/logging/enhanced-logger';

const headers = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type,Authorization',
};

const response = (statusCode: number, body: unknown): APIGatewayProxyResult => ({
  statusCode,
  headers,
  body: JSON.stringify(body),
});

// ============================================================================
// Types
// ============================================================================

interface RegulatoryStandard {
  id: string;
  code: string;
  name: string;
  fullName: string | null;
  category: string;
  description: string | null;
  jurisdiction: string | null;
  governingBody: string | null;
  websiteUrl: string | null;
  effectiveDate: string | null;
  version: string | null;
  isMandatory: boolean;
  appliesToRadiant: boolean;
  appliesToThinktank: boolean;
  priority: number;
  status: 'active' | 'pending' | 'deprecated' | 'not_applicable';
  notes: string | null;
  createdAt: string;
  updatedAt: string;
  requirementsCount?: number;
  implementedCount?: number;
}

interface RegulatoryRequirement {
  id: string;
  standardId: string;
  requirementCode: string;
  title: string;
  description: string | null;
  category: string | null;
  controlType: 'technical' | 'administrative' | 'physical' | 'procedural' | null;
  isRequired: boolean;
  implementationStatus: 'not_started' | 'in_progress' | 'implemented' | 'verified' | 'not_applicable';
  implementationNotes: string | null;
  evidenceLocation: string | null;
  owner: string | null;
  dueDate: string | null;
  lastReviewedAt: string | null;
  reviewedBy: string | null;
}

interface TenantComplianceStatus {
  id: string;
  tenantId: string;
  standardId: string;
  isEnabled: boolean;
  complianceScore: number;
  status: 'not_assessed' | 'non_compliant' | 'partial' | 'compliant' | 'certified';
  certificationDate: string | null;
  certificationExpiry: string | null;
  certificationBody: string | null;
  lastAuditDate: string | null;
  nextAuditDate: string | null;
  notes: string | null;
}

// ============================================================================
// Helper Functions
// ============================================================================

function mapStandardRow(row: Record<string, unknown>): RegulatoryStandard {
  return {
    id: row.id as string,
    code: row.code as string,
    name: row.name as string,
    fullName: row.full_name as string | null,
    category: row.category as string,
    description: row.description as string | null,
    jurisdiction: row.jurisdiction as string | null,
    governingBody: row.governing_body as string | null,
    websiteUrl: row.website_url as string | null,
    effectiveDate: row.effective_date ? (row.effective_date as Date).toISOString() : null,
    version: row.version as string | null,
    isMandatory: Boolean(row.is_mandatory),
    appliesToRadiant: Boolean(row.applies_to_radiant),
    appliesToThinktank: Boolean(row.applies_to_thinktank),
    priority: parseInt(row.priority as string, 10) || 50,
    status: row.status as RegulatoryStandard['status'],
    notes: row.notes as string | null,
    createdAt: (row.created_at as Date).toISOString(),
    updatedAt: (row.updated_at as Date).toISOString(),
    requirementsCount: row.requirements_count ? parseInt(row.requirements_count as string, 10) : undefined,
    implementedCount: row.implemented_count ? parseInt(row.implemented_count as string, 10) : undefined,
  };
}

function mapRequirementRow(row: Record<string, unknown>): RegulatoryRequirement {
  return {
    id: row.id as string,
    standardId: row.standard_id as string,
    requirementCode: row.requirement_code as string,
    title: row.title as string,
    description: row.description as string | null,
    category: row.category as string | null,
    controlType: row.control_type as RegulatoryRequirement['controlType'],
    isRequired: Boolean(row.is_required),
    implementationStatus: row.implementation_status as RegulatoryRequirement['implementationStatus'],
    implementationNotes: row.implementation_notes as string | null,
    evidenceLocation: row.evidence_location as string | null,
    owner: row.owner as string | null,
    dueDate: row.due_date ? (row.due_date as Date).toISOString() : null,
    lastReviewedAt: row.last_reviewed_at ? (row.last_reviewed_at as Date).toISOString() : null,
    reviewedBy: row.reviewed_by as string | null,
  };
}

// ============================================================================
// GET /admin/regulatory-standards/dashboard
// Get dashboard summary
// ============================================================================
export const getDashboard: APIGatewayProxyHandler = async (event) => {
  let client: PoolClient | null = null;
  try {
    const tenantId = event.requestContext.authorizer?.tenantId || 'default';
    client = await getPoolClient();

    // Get summary stats
    const standardsResult = await client.query(`
      SELECT 
        COUNT(*) as total_standards,
        COUNT(*) FILTER (WHERE status = 'active') as active_standards,
        COUNT(*) FILTER (WHERE is_mandatory = true) as mandatory_standards,
        COUNT(DISTINCT category) as categories
      FROM regulatory_standards
      WHERE status != 'not_applicable'
    `);

    const requirementsResult = await client.query(`
      SELECT 
        COUNT(*) as total_requirements,
        COUNT(*) FILTER (WHERE implementation_status = 'implemented') as implemented,
        COUNT(*) FILTER (WHERE implementation_status = 'verified') as verified,
        COUNT(*) FILTER (WHERE implementation_status = 'in_progress') as in_progress,
        COUNT(*) FILTER (WHERE implementation_status = 'not_started') as not_started
      FROM regulatory_requirements rr
      JOIN regulatory_standards rs ON rr.standard_id = rs.id
      WHERE rs.status = 'active'
    `);

    const tenantComplianceResult = await client.query(`
      SELECT 
        COUNT(*) FILTER (WHERE is_enabled = true) as enabled_standards,
        AVG(compliance_score) FILTER (WHERE is_enabled = true) as avg_score,
        COUNT(*) FILTER (WHERE status = 'compliant') as compliant_count,
        COUNT(*) FILTER (WHERE status = 'certified') as certified_count
      FROM tenant_compliance_status
      WHERE tenant_id = $1
    `, [tenantId]);

    // Get standards by category
    const categoriesResult = await client.query(`
      SELECT 
        category,
        COUNT(*) as count,
        COUNT(*) FILTER (WHERE is_mandatory = true) as mandatory_count
      FROM regulatory_standards
      WHERE status = 'active'
      GROUP BY category
      ORDER BY COUNT(*) DESC
    `);

    // Get top priority standards
    const priorityStandardsResult = await client.query(`
      SELECT 
        rs.*,
        (SELECT COUNT(*) FROM regulatory_requirements WHERE standard_id = rs.id) as requirements_count,
        (SELECT COUNT(*) FROM regulatory_requirements 
         WHERE standard_id = rs.id AND implementation_status IN ('implemented', 'verified')) as implemented_count
      FROM regulatory_standards rs
      WHERE rs.status = 'active' AND rs.is_mandatory = true
      ORDER BY rs.priority DESC
      LIMIT 10
    `);

    const stats = standardsResult.rows[0];
    const reqStats = requirementsResult.rows[0];
    const tenantStats = tenantComplianceResult.rows[0];

    return response(200, {
      success: true,
      data: {
        summary: {
          totalStandards: parseInt(stats.total_standards, 10),
          activeStandards: parseInt(stats.active_standards, 10),
          mandatoryStandards: parseInt(stats.mandatory_standards, 10),
          categories: parseInt(stats.categories, 10),
          totalRequirements: parseInt(reqStats.total_requirements, 10),
          implementedRequirements: parseInt(reqStats.implemented, 10),
          verifiedRequirements: parseInt(reqStats.verified, 10),
          inProgressRequirements: parseInt(reqStats.in_progress, 10),
          notStartedRequirements: parseInt(reqStats.not_started, 10),
          enabledForTenant: parseInt(tenantStats.enabled_standards || '0', 10),
          avgComplianceScore: parseFloat(tenantStats.avg_score || '0'),
          compliantCount: parseInt(tenantStats.compliant_count || '0', 10),
          certifiedCount: parseInt(tenantStats.certified_count || '0', 10),
        },
        categories: categoriesResult.rows.map(r => ({
          name: r.category,
          count: parseInt(r.count, 10),
          mandatoryCount: parseInt(r.mandatory_count, 10),
        })),
        priorityStandards: priorityStandardsResult.rows.map(mapStandardRow),
      },
    });
  } catch (error) {
    logger.error('Error fetching regulatory dashboard', error);
    return response(500, { success: false, error: 'Failed to fetch dashboard' });
  } finally {
    if (client) client.release();
  }
};

// ============================================================================
// GET /admin/regulatory-standards
// List all regulatory standards
// ============================================================================
export const listStandards: APIGatewayProxyHandler = async (event) => {
  let client: PoolClient | null = null;
  try {
    client = await getPoolClient();
    const category = event.queryStringParameters?.category;
    const status = event.queryStringParameters?.status;
    const mandatory = event.queryStringParameters?.mandatory;

    let query = `
      SELECT 
        rs.*,
        (SELECT COUNT(*) FROM regulatory_requirements WHERE standard_id = rs.id) as requirements_count,
        (SELECT COUNT(*) FROM regulatory_requirements 
         WHERE standard_id = rs.id AND implementation_status IN ('implemented', 'verified')) as implemented_count
      FROM regulatory_standards rs
      WHERE 1=1
    `;
    const params: (string | boolean)[] = [];
    let paramIndex = 1;

    if (category) {
      query += ` AND rs.category = $${paramIndex++}`;
      params.push(category);
    }
    if (status) {
      query += ` AND rs.status = $${paramIndex++}`;
      params.push(status);
    }
    if (mandatory !== undefined) {
      query += ` AND rs.is_mandatory = $${paramIndex++}`;
      params.push(mandatory === 'true');
    }

    query += ` ORDER BY rs.priority DESC, rs.name ASC`;

    const result = await client.query(query, params);

    return response(200, {
      success: true,
      data: result.rows.map(mapStandardRow),
      count: result.rows.length,
    });
  } catch (error) {
    logger.error('Error listing regulatory standards', error);
    return response(500, { success: false, error: 'Failed to list standards' });
  } finally {
    if (client) client.release();
  }
};

// ============================================================================
// GET /admin/regulatory-standards/:id
// Get a single standard with its requirements
// ============================================================================
export const getStandard: APIGatewayProxyHandler = async (event) => {
  let client: PoolClient | null = null;
  try {
    const standardId = event.pathParameters?.id;
    if (!standardId) {
      return response(400, { success: false, error: 'Standard ID required' });
    }

    client = await getPoolClient();

    const standardResult = await client.query(`
      SELECT 
        rs.*,
        (SELECT COUNT(*) FROM regulatory_requirements WHERE standard_id = rs.id) as requirements_count,
        (SELECT COUNT(*) FROM regulatory_requirements 
         WHERE standard_id = rs.id AND implementation_status IN ('implemented', 'verified')) as implemented_count
      FROM regulatory_standards rs
      WHERE rs.id = $1 OR rs.code = $1
    `, [standardId]);

    if (standardResult.rows.length === 0) {
      return response(404, { success: false, error: 'Standard not found' });
    }

    const standard = mapStandardRow(standardResult.rows[0] as Record<string, unknown>);

    const requirementsResult = await client.query(`
      SELECT * FROM regulatory_requirements
      WHERE standard_id = $1
      ORDER BY requirement_code ASC
    `, [standard.id]);

    return response(200, {
      success: true,
      data: {
        ...standard,
        requirements: requirementsResult.rows.map(r => mapRequirementRow(r as Record<string, unknown>)),
      },
    });
  } catch (error) {
    logger.error('Error fetching regulatory standard', error);
    return response(500, { success: false, error: 'Failed to fetch standard' });
  } finally {
    if (client) client.release();
  }
};

// ============================================================================
// PUT /admin/regulatory-standards/:id
// Update a regulatory standard
// ============================================================================
export const updateStandard: APIGatewayProxyHandler = async (event) => {
  let client: PoolClient | null = null;
  try {
    const standardId = event.pathParameters?.id;
    if (!standardId) {
      return response(400, { success: false, error: 'Standard ID required' });
    }

    const updates = JSON.parse(event.body || '{}');
    client = await getPoolClient();

    const result = await client.query(`
      UPDATE regulatory_standards SET
        notes = COALESCE($2, notes),
        status = COALESCE($3, status),
        is_mandatory = COALESCE($4, is_mandatory),
        priority = COALESCE($5, priority),
        updated_at = NOW()
      WHERE id = $1
      RETURNING *
    `, [
      standardId,
      updates.notes,
      updates.status,
      updates.isMandatory,
      updates.priority,
    ]);

    if (result.rows.length === 0) {
      return response(404, { success: false, error: 'Standard not found' });
    }

    return response(200, {
      success: true,
      data: mapStandardRow(result.rows[0] as Record<string, unknown>),
    });
  } catch (error) {
    logger.error('Error updating regulatory standard', error);
    return response(500, { success: false, error: 'Failed to update standard' });
  } finally {
    if (client) client.release();
  }
};

// ============================================================================
// GET /admin/regulatory-standards/:id/requirements
// List requirements for a standard
// ============================================================================
export const listRequirements: APIGatewayProxyHandler = async (event) => {
  let client: PoolClient | null = null;
  try {
    const standardId = event.pathParameters?.id;
    if (!standardId) {
      return response(400, { success: false, error: 'Standard ID required' });
    }

    client = await getPoolClient();

    const result = await client.query(`
      SELECT * FROM regulatory_requirements
      WHERE standard_id = $1
      ORDER BY requirement_code ASC
    `, [standardId]);

    return response(200, {
      success: true,
      data: result.rows.map(r => mapRequirementRow(r as Record<string, unknown>)),
      count: result.rows.length,
    });
  } catch (error) {
    logger.error('Error listing requirements', error);
    return response(500, { success: false, error: 'Failed to list requirements' });
  } finally {
    if (client) client.release();
  }
};

// ============================================================================
// PATCH /admin/regulatory-standards/requirements/:id
// Update a requirement's implementation status
// ============================================================================
export const updateRequirement: APIGatewayProxyHandler = async (event) => {
  let client: PoolClient | null = null;
  try {
    const requirementId = event.pathParameters?.id;
    if (!requirementId) {
      return response(400, { success: false, error: 'Requirement ID required' });
    }

    const updates = JSON.parse(event.body || '{}');
    const adminEmail = event.requestContext.authorizer?.email || 'admin';

    client = await getPoolClient();

    const result = await client.query(`
      UPDATE regulatory_requirements SET
        implementation_status = COALESCE($2, implementation_status),
        implementation_notes = COALESCE($3, implementation_notes),
        evidence_location = COALESCE($4, evidence_location),
        owner = COALESCE($5, owner),
        due_date = COALESCE($6, due_date),
        last_reviewed_at = CASE WHEN $7 = true THEN NOW() ELSE last_reviewed_at END,
        reviewed_by = CASE WHEN $7 = true THEN $8 ELSE reviewed_by END,
        updated_at = NOW()
      WHERE id = $1
      RETURNING *
    `, [
      requirementId,
      updates.implementationStatus,
      updates.implementationNotes,
      updates.evidenceLocation,
      updates.owner,
      updates.dueDate,
      updates.markReviewed === true,
      adminEmail,
    ]);

    if (result.rows.length === 0) {
      return response(404, { success: false, error: 'Requirement not found' });
    }

    return response(200, {
      success: true,
      data: mapRequirementRow(result.rows[0] as Record<string, unknown>),
    });
  } catch (error) {
    logger.error('Error updating requirement', error);
    return response(500, { success: false, error: 'Failed to update requirement' });
  } finally {
    if (client) client.release();
  }
};

// ============================================================================
// GET /admin/regulatory-standards/tenant-compliance
// Get tenant's compliance status for all standards
// ============================================================================
export const getTenantCompliance: APIGatewayProxyHandler = async (event) => {
  let client: PoolClient | null = null;
  try {
    const tenantId = event.requestContext.authorizer?.tenantId || 'default';
    client = await getPoolClient();

    const result = await client.query(`
      SELECT 
        rs.id as standard_id,
        rs.code,
        rs.name,
        rs.category,
        rs.is_mandatory,
        COALESCE(tcs.is_enabled, false) as is_enabled,
        COALESCE(tcs.compliance_score, 0) as compliance_score,
        COALESCE(tcs.status, 'not_assessed') as status,
        tcs.certification_date,
        tcs.certification_expiry,
        tcs.last_audit_date,
        tcs.next_audit_date
      FROM regulatory_standards rs
      LEFT JOIN tenant_compliance_status tcs 
        ON rs.id = tcs.standard_id AND tcs.tenant_id = $1
      WHERE rs.status = 'active'
      ORDER BY rs.priority DESC, rs.name ASC
    `, [tenantId]);

    return response(200, {
      success: true,
      data: result.rows.map(row => ({
        standardId: row.standard_id,
        code: row.code,
        name: row.name,
        category: row.category,
        isMandatory: row.is_mandatory,
        isEnabled: row.is_enabled,
        complianceScore: parseInt(row.compliance_score, 10),
        status: row.status,
        certificationDate: row.certification_date,
        certificationExpiry: row.certification_expiry,
        lastAuditDate: row.last_audit_date,
        nextAuditDate: row.next_audit_date,
      })),
    });
  } catch (error) {
    logger.error('Error fetching tenant compliance', error);
    return response(500, { success: false, error: 'Failed to fetch compliance status' });
  } finally {
    if (client) client.release();
  }
};

// ============================================================================
// PUT /admin/regulatory-standards/tenant-compliance/:standardId
// Update tenant's compliance status for a standard
// ============================================================================
export const updateTenantCompliance: APIGatewayProxyHandler = async (event) => {
  let client: PoolClient | null = null;
  try {
    const standardId = event.pathParameters?.standardId;
    const tenantId = event.requestContext.authorizer?.tenantId || 'default';
    if (!standardId) {
      return response(400, { success: false, error: 'Standard ID required' });
    }

    const updates = JSON.parse(event.body || '{}');
    client = await getPoolClient();

    const result = await client.query(`
      INSERT INTO tenant_compliance_status (
        tenant_id, standard_id, is_enabled, compliance_score, status,
        certification_date, certification_expiry, certification_body,
        last_audit_date, next_audit_date, notes
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
      ON CONFLICT (tenant_id, standard_id) DO UPDATE SET
        is_enabled = COALESCE($3, tenant_compliance_status.is_enabled),
        compliance_score = COALESCE($4, tenant_compliance_status.compliance_score),
        status = COALESCE($5, tenant_compliance_status.status),
        certification_date = COALESCE($6, tenant_compliance_status.certification_date),
        certification_expiry = COALESCE($7, tenant_compliance_status.certification_expiry),
        certification_body = COALESCE($8, tenant_compliance_status.certification_body),
        last_audit_date = COALESCE($9, tenant_compliance_status.last_audit_date),
        next_audit_date = COALESCE($10, tenant_compliance_status.next_audit_date),
        notes = COALESCE($11, tenant_compliance_status.notes),
        updated_at = NOW()
      RETURNING *
    `, [
      tenantId,
      standardId,
      updates.isEnabled,
      updates.complianceScore,
      updates.status,
      updates.certificationDate,
      updates.certificationExpiry,
      updates.certificationBody,
      updates.lastAuditDate,
      updates.nextAuditDate,
      updates.notes,
    ]);

    return response(200, { success: true, data: result.rows[0] });
  } catch (error) {
    logger.error('Error updating tenant compliance', error);
    return response(500, { success: false, error: 'Failed to update compliance status' });
  } finally {
    if (client) client.release();
  }
};

// ============================================================================
// GET /admin/regulatory-standards/categories
// Get all unique categories
// ============================================================================
export const getCategories: APIGatewayProxyHandler = async () => {
  let client: PoolClient | null = null;
  try {
    client = await getPoolClient();

    const result = await client.query(`
      SELECT 
        category,
        COUNT(*) as count,
        COUNT(*) FILTER (WHERE is_mandatory = true) as mandatory_count,
        COUNT(*) FILTER (WHERE status = 'active') as active_count
      FROM regulatory_standards
      GROUP BY category
      ORDER BY COUNT(*) DESC
    `);

    return response(200, {
      success: true,
      data: result.rows.map(row => ({
        name: row.category,
        count: parseInt(row.count, 10),
        mandatoryCount: parseInt(row.mandatory_count, 10),
        activeCount: parseInt(row.active_count, 10),
      })),
    });
  } catch (error) {
    logger.error('Error fetching categories', error);
    return response(500, { success: false, error: 'Failed to fetch categories' });
  } finally {
    if (client) client.release();
  }
};

// ============================================================================
// Main Handler - Routes to individual handlers
// ============================================================================
export const handler: APIGatewayProxyHandler = async (event, context, callback): Promise<APIGatewayProxyResult> => {
  const { httpMethod, path } = event;
  const pathParts = path.split('/').filter(Boolean);
  
  // /admin/compliance/regulatory-standards/dashboard
  if (pathParts[3] === 'dashboard' && httpMethod === 'GET') {
    return (await getDashboard(event, context, callback)) || response(500, { success: false, error: 'No response' });
  }
  // /admin/compliance/regulatory-standards/categories
  if (pathParts[3] === 'categories' && httpMethod === 'GET') {
    return (await getCategories(event, context, callback)) || response(500, { success: false, error: 'No response' });
  }
  // /admin/compliance/regulatory-standards/:id/requirements
  if (pathParts[4] === 'requirements') {
    if (httpMethod === 'GET') return (await listRequirements(event, context, callback)) || response(500, { success: false, error: 'No response' });
    if (httpMethod === 'PUT' || httpMethod === 'PATCH') return (await updateRequirement(event, context, callback)) || response(500, { success: false, error: 'No response' });
  }
  // /admin/compliance/regulatory-standards/:id/compliance
  if (pathParts[4] === 'compliance') {
    if (httpMethod === 'GET') return (await getTenantCompliance(event, context, callback)) || response(500, { success: false, error: 'No response' });
    if (httpMethod === 'PUT' || httpMethod === 'PATCH') return (await updateTenantCompliance(event, context, callback)) || response(500, { success: false, error: 'No response' });
  }
  // /admin/compliance/regulatory-standards/:id
  if (pathParts[3] && !pathParts[4]) {
    if (httpMethod === 'GET') return (await getStandard(event, context, callback)) || response(500, { success: false, error: 'No response' });
    if (httpMethod === 'PUT' || httpMethod === 'PATCH') return (await updateStandard(event, context, callback)) || response(500, { success: false, error: 'No response' });
  }
  // /admin/compliance/regulatory-standards
  if (httpMethod === 'GET') return (await listStandards(event, context, callback)) || response(500, { success: false, error: 'No response' });
  
  return response(404, { success: false, error: 'Not found' });
};
