// RADIANT v4.18.0 - Think Tank Domain Modes Lambda Handler
// API endpoints for admin management of domain mode configurations
// Integrated with Domain Taxonomy Service for intelligent domain detection

import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { getPoolClient } from '../shared/db/centralized-pool';
import { enhancedLogger as logger } from '../shared/logging/enhanced-logger';
import { corsHeaders } from '../shared/middleware/api-response';
import { requireAdmin } from '../shared/auth/admin-auth';
import { domainTaxonomyService } from '../shared/services';

interface ModeConfig {
  enabled: boolean;
  defaultModel: string;
  temperature: number;
  systemPrompt: string;
  // Domain taxonomy integration
  taxonomyDomainId?: string;
  proficiencyRequirements?: Record<string, number>;
}

interface DomainModesConfig {
  modes: Record<string, ModeConfig>;
  useTaxonomyDetection?: boolean;  // Enable automatic domain detection
}

// GET /api/admin/thinktank/domain-modes
export async function getDomainModes(
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  try {
    const admin = await requireAdmin(event);
    const client = await getPoolClient();

    try {
      const result = await client.query(
        `
        SELECT config_value 
        FROM dynamic_config 
        WHERE tenant_id = $1 AND config_key = 'thinktank_domain_modes'
        `,
        [admin.tenantId]
      );

      if (result.rows.length === 0) {
        // Return default configuration
        return {
          statusCode: 200,
          headers: corsHeaders,
          body: JSON.stringify({
            modes: {
              general: { enabled: true, defaultModel: 'auto', temperature: 0.7, systemPrompt: '' },
              medical: { enabled: true, defaultModel: 'auto', temperature: 0.3, systemPrompt: '' },
              legal: { enabled: true, defaultModel: 'auto', temperature: 0.3, systemPrompt: '' },
              code: { enabled: true, defaultModel: 'auto', temperature: 0.2, systemPrompt: '' },
              academic: { enabled: true, defaultModel: 'auto', temperature: 0.5, systemPrompt: '' },
              creative: { enabled: true, defaultModel: 'auto', temperature: 0.9, systemPrompt: '' },
              scientific: { enabled: true, defaultModel: 'auto', temperature: 0.4, systemPrompt: '' },
            },
          }),
        };
      }

      return {
        statusCode: 200,
        headers: corsHeaders,
        body: JSON.stringify(result.rows[0].config_value),
      };
    } finally {
      client.release();
    }
  } catch (error) {
    logger.error('Failed to get domain modes', error instanceof Error ? error : undefined);
    return {
      statusCode: 500,
      headers: corsHeaders,
      body: JSON.stringify({ error: 'Failed to load domain modes' }),
    };
  }
}

// PUT /api/admin/thinktank/domain-modes
export async function updateDomainModes(
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  try {
    const admin = await requireAdmin(event);
    const config: DomainModesConfig = JSON.parse(event.body || '{}');
    const client = await getPoolClient();

    try {
      await client.query(
        `
        INSERT INTO dynamic_config (tenant_id, config_key, config_value, updated_by)
        VALUES ($1, 'thinktank_domain_modes', $2, $3)
        ON CONFLICT (tenant_id, config_key) DO UPDATE SET
          config_value = $2,
          updated_by = $3,
          updated_at = NOW()
        `,
        [admin.tenantId, JSON.stringify(config), admin.id]
      );

      return {
        statusCode: 200,
        headers: corsHeaders,
        body: JSON.stringify({ success: true }),
      };
    } finally {
      client.release();
    }
  } catch (error) {
    logger.error('Failed to update domain modes', error instanceof Error ? error : undefined);
    return {
      statusCode: 500,
      headers: corsHeaders,
      body: JSON.stringify({ error: 'Failed to save domain modes' }),
    };
  }
}

// GET /api/admin/thinktank/taxonomy-domains - Get taxonomy domains for mapping
export async function getTaxonomyDomains(
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  try {
    await requireAdmin(event);
    
    const taxonomy = await domainTaxonomyService.getTaxonomy();
    
    // Flatten fields and domains for easy selection
    const domains: Array<{
      fieldId: string;
      fieldName: string;
      fieldIcon: string;
      domainId: string;
      domainName: string;
      domainIcon: string;
      subspecialtyCount: number;
    }> = [];

    for (const field of taxonomy.fields) {
      for (const domain of field.domains) {
        domains.push({
          fieldId: field.field_id,
          fieldName: field.field_name,
          fieldIcon: field.field_icon,
          domainId: domain.domain_id,
          domainName: domain.domain_name,
          domainIcon: domain.domain_icon,
          subspecialtyCount: domain.subspecialties.length,
        });
      }
    }

    return {
      statusCode: 200,
      headers: corsHeaders,
      body: JSON.stringify({
        fields: taxonomy.fields.map(f => ({
          fieldId: f.field_id,
          fieldName: f.field_name,
          fieldIcon: f.field_icon,
          domainCount: f.domains.length,
        })),
        domains,
        metadata: taxonomy.metadata,
      }),
    };
  } catch (error) {
    logger.error('Failed to get taxonomy domains', error instanceof Error ? error : undefined);
    return {
      statusCode: 500,
      headers: corsHeaders,
      body: JSON.stringify({ error: 'Failed to load taxonomy domains' }),
    };
  }
}

// POST /api/admin/thinktank/domain-modes/detect - Detect domain from prompt
export async function detectDomainFromPrompt(
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  try {
    await requireAdmin(event);
    const body = JSON.parse(event.body || '{}');
    
    if (!body.prompt) {
      return {
        statusCode: 400,
        headers: corsHeaders,
        body: JSON.stringify({ error: 'prompt is required' }),
      };
    }

    const detection = await domainTaxonomyService.detectDomain(body.prompt, {
      include_subspecialties: true,
      min_confidence: 0.3,
      max_results: 5,
    });

    // Get matching models for the detected proficiencies
    const matchingModels = await domainTaxonomyService.getMatchingModels(
      detection.merged_proficiencies,
      { max_models: 5, min_match_score: 50 }
    );

    return {
      statusCode: 200,
      headers: corsHeaders,
      body: JSON.stringify({
        detection: {
          primaryField: detection.primary_field ? {
            id: detection.primary_field.field_id,
            name: detection.primary_field.field_name,
            icon: detection.primary_field.field_icon,
          } : null,
          primaryDomain: detection.primary_domain ? {
            id: detection.primary_domain.domain_id,
            name: detection.primary_domain.domain_name,
            icon: detection.primary_domain.domain_icon,
          } : null,
          primarySubspecialty: detection.primary_subspecialty ? {
            id: detection.primary_subspecialty.subspecialty_id,
            name: detection.primary_subspecialty.subspecialty_name,
          } : null,
          confidence: detection.detection_confidence,
          method: detection.detection_method,
        },
        proficiencies: detection.merged_proficiencies,
        recommendedModels: matchingModels.slice(0, 3).map(m => ({
          modelId: m.model_id,
          modelName: m.model_name,
          matchScore: m.match_score,
          isRecommended: m.recommended,
        })),
        processingTimeMs: detection.processing_time_ms,
      }),
    };
  } catch (error) {
    logger.error('Failed to detect domain', error instanceof Error ? error : undefined);
    return {
      statusCode: 500,
      headers: corsHeaders,
      body: JSON.stringify({ error: 'Failed to detect domain' }),
    };
  }
}

// GET /api/admin/thinktank/domain-modes/:domainId/proficiencies - Get proficiencies for a domain
export async function getDomainProficiencies(
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  try {
    await requireAdmin(event);
    const domainId = event.pathParameters?.domainId;
    
    if (!domainId) {
      return {
        statusCode: 400,
        headers: corsHeaders,
        body: JSON.stringify({ error: 'domainId is required' }),
      };
    }

    const taxonomy = await domainTaxonomyService.getTaxonomy();
    
    for (const field of taxonomy.fields) {
      const domain = field.domains.find(d => d.domain_id === domainId);
      if (domain) {
        const merged = domainTaxonomyService.mergeProficiencies(field, domain);
        return {
          statusCode: 200,
          headers: corsHeaders,
          body: JSON.stringify({
            domainId: domain.domain_id,
            domainName: domain.domain_name,
            fieldProficiencies: field.field_proficiencies,
            domainProficiencies: domain.domain_proficiencies,
            mergedProficiencies: merged,
          }),
        };
      }
    }

    return {
      statusCode: 404,
      headers: corsHeaders,
      body: JSON.stringify({ error: 'Domain not found' }),
    };
  } catch (error) {
    logger.error('Failed to get domain proficiencies', error instanceof Error ? error : undefined);
    return {
      statusCode: 500,
      headers: corsHeaders,
      body: JSON.stringify({ error: 'Failed to load domain proficiencies' }),
    };
  }
}

// Lambda handler router
export async function handler(
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  const path = event.path;
  const method = event.httpMethod;

  // Domain modes CRUD
  if (path === '/api/admin/thinktank/domain-modes') {
    if (method === 'GET') return getDomainModes(event);
    if (method === 'PUT') return updateDomainModes(event);
  }

  // Domain taxonomy integration endpoints
  if (path === '/api/admin/thinktank/taxonomy-domains' && method === 'GET') {
    return getTaxonomyDomains(event);
  }

  if (path === '/api/admin/thinktank/domain-modes/detect' && method === 'POST') {
    return detectDomainFromPrompt(event);
  }

  if (path.match(/\/api\/admin\/thinktank\/domain-modes\/[^/]+\/proficiencies/) && method === 'GET') {
    return getDomainProficiencies(event);
  }

  return {
    statusCode: 404,
    headers: corsHeaders,
    body: JSON.stringify({ error: 'Not found' }),
  };
}
