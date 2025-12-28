// RADIANT v4.18.0 - Domain Taxonomy API Handler
// Endpoints for domain detection, model matching, and taxonomy management

import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { domainTaxonomyService } from '../shared/services';
import { extractAuthContext } from '../shared/auth';
import { success, handleError } from '../shared/response';
import { ValidationError, ForbiddenError } from '../shared/errors';
import { createHash } from 'crypto';

export async function handler(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  try {
    const user = extractAuthContext(event);
    const path = event.path;
    const method = event.httpMethod;

    // ========================================================================
    // Public Endpoints (authenticated users)
    // ========================================================================

    // GET /domain-taxonomy - Get full taxonomy structure
    if (method === 'GET' && path.endsWith('/domain-taxonomy')) {
      const taxonomy = await domainTaxonomyService.getTaxonomy();
      return success({
        metadata: taxonomy.metadata,
        fields: taxonomy.fields.map(f => ({
          field_id: f.field_id,
          field_name: f.field_name,
          field_icon: f.field_icon,
          field_color: f.field_color,
          field_description: f.field_description,
          domain_count: f.domains.length,
        })),
      });
    }

    // GET /domain-taxonomy/fields - List all fields
    if (method === 'GET' && path.endsWith('/fields')) {
      const fields = await domainTaxonomyService.listFields();
      return success({ fields });
    }

    // GET /domain-taxonomy/fields/:fieldId/domains - List domains for a field
    if (method === 'GET' && path.includes('/fields/') && path.endsWith('/domains')) {
      const fieldId = path.split('/fields/')[1].split('/domains')[0];
      const domains = await domainTaxonomyService.listDomainsByField(fieldId);
      return success({ domains });
    }

    // GET /domain-taxonomy/full - Get complete taxonomy with all levels
    if (method === 'GET' && path.endsWith('/full')) {
      const taxonomy = await domainTaxonomyService.getTaxonomy();
      return success(taxonomy);
    }

    // POST /domain-taxonomy/detect - Detect domain from prompt
    if (method === 'POST' && path.endsWith('/detect')) {
      const body = JSON.parse(event.body || '{}');

      if (!body.prompt) {
        throw new ValidationError('prompt is required');
      }

      const result = await domainTaxonomyService.detectDomain(body.prompt, {
        include_subspecialties: body.include_subspecialties ?? true,
        min_confidence: body.min_confidence ?? 0.3,
        max_results: body.max_results ?? 5,
        manual_override: body.manual_override,
      });

      return success({
        result,
        taxonomy_version: (await domainTaxonomyService.getTaxonomy()).metadata.version,
      });
    }

    // POST /domain-taxonomy/match-models - Get matching models for detected domain
    if (method === 'POST' && path.endsWith('/match-models')) {
      const body = JSON.parse(event.body || '{}');

      // Either provide proficiencies directly or detect from prompt
      let proficiencies = body.proficiencies;

      if (!proficiencies && body.prompt) {
        const detection = await domainTaxonomyService.detectDomain(body.prompt);
        proficiencies = detection.merged_proficiencies;
      }

      if (!proficiencies && (body.domain_id || body.subspecialty_id)) {
        const taxonomy = await domainTaxonomyService.getTaxonomy();
        
        // Find domain/subspecialty and get proficiencies
        for (const field of taxonomy.fields) {
          for (const domain of field.domains) {
            if (body.subspecialty_id) {
              const sub = domain.subspecialties.find(s => s.subspecialty_id === body.subspecialty_id);
              if (sub) {
                proficiencies = domainTaxonomyService.mergeProficiencies(field, domain, sub);
                break;
              }
            } else if (domain.domain_id === body.domain_id) {
              proficiencies = domainTaxonomyService.mergeProficiencies(field, domain);
              break;
            }
          }
          if (proficiencies) break;
        }
      }

      if (!proficiencies) {
        throw new ValidationError('proficiencies, prompt, domain_id, or subspecialty_id is required');
      }

      const matches = await domainTaxonomyService.getMatchingModels(proficiencies, {
        max_models: body.max_models ?? 10,
        min_match_score: body.min_match_score ?? 50,
        include_self_hosted: body.include_self_hosted ?? true,
      });

      const recommended = matches.find(m => m.recommended);
      const fallbacks = matches.filter(m => !m.recommended && m.ranking <= 3);

      return success({
        matches,
        orchestration_recommendation: {
          primary_model: recommended?.model_id || matches[0]?.model_id || 'anthropic/claude-3-5-sonnet-20241022',
          mode: proficiencies.reasoning_depth >= 8 ? 'extended_thinking' : 'thinking',
          reasoning: recommended 
            ? `Selected ${recommended.model_name} with ${recommended.match_score}% match score`
            : 'Using default model as no strong match found',
        },
        fallback_models: fallbacks.map(m => m.model_id),
      });
    }

    // POST /domain-taxonomy/feedback - Submit detection feedback
    if (method === 'POST' && path.endsWith('/feedback')) {
      const body = JSON.parse(event.body || '{}');

      if (!body.prompt_hash && !body.prompt) {
        throw new ValidationError('prompt_hash or prompt is required');
      }

      const promptHash = body.prompt_hash || createHash('sha256').update(body.prompt).digest('hex').substring(0, 64);

      if (!body.quality_score || body.quality_score < 1 || body.quality_score > 5) {
        throw new ValidationError('quality_score (1-5) is required');
      }

      if (body.domain_accuracy === undefined) {
        throw new ValidationError('domain_accuracy (boolean) is required');
      }

      const feedbackId = await domainTaxonomyService.recordFeedback({
        tenant_id: user.tenantId,
        user_id: user.userId,
        prompt_hash: promptHash,
        detected_domain_id: body.detected_domain_id,
        detected_subspecialty_id: body.detected_subspecialty_id,
        actual_domain_id: body.actual_domain_id,
        actual_subspecialty_id: body.actual_subspecialty_id,
        model_used: body.model_used || 'unknown',
        quality_score: body.quality_score,
        domain_accuracy: body.domain_accuracy,
        proficiency_match_quality: body.proficiency_match_quality,
        feedback_text: body.feedback_text,
      });

      return success({ feedback_id: feedbackId, recorded: true });
    }

    // GET /domain-taxonomy/feedback/:domainId/summary - Get feedback summary for domain
    if (method === 'GET' && path.includes('/feedback/') && path.endsWith('/summary')) {
      const domainId = path.split('/feedback/')[1].split('/summary')[0];
      const summary = await domainTaxonomyService.getFeedbackSummary(domainId);
      return success({ domain_id: domainId, summary });
    }

    // ========================================================================
    // Think Tank / Client App Endpoints
    // ========================================================================

    // GET /domain-taxonomy/domains/:domainId - Get single domain with subspecialties
    if (method === 'GET' && path.includes('/domains/') && !path.includes('/subspecialties')) {
      const domainId = path.split('/domains/')[1];
      const taxonomy = await domainTaxonomyService.getTaxonomy();
      
      for (const field of taxonomy.fields) {
        const domain = field.domains.find(d => d.domain_id === domainId);
        if (domain) {
          return success({
            domain,
            field: {
              field_id: field.field_id,
              field_name: field.field_name,
              field_icon: field.field_icon,
            },
            subspecialty_count: domain.subspecialties.length,
          });
        }
      }
      throw new ValidationError(`Domain not found: ${domainId}`);
    }

    // GET /domain-taxonomy/domains/:domainId/subspecialties - List subspecialties for domain
    if (method === 'GET' && path.includes('/domains/') && path.endsWith('/subspecialties')) {
      const domainId = path.split('/domains/')[1].split('/subspecialties')[0];
      const taxonomy = await domainTaxonomyService.getTaxonomy();
      
      for (const field of taxonomy.fields) {
        const domain = field.domains.find(d => d.domain_id === domainId);
        if (domain) {
          return success({
            domain_id: domainId,
            domain_name: domain.domain_name,
            subspecialties: domain.subspecialties.map(s => ({
              subspecialty_id: s.subspecialty_id,
              subspecialty_name: s.subspecialty_name,
              description: s.description,
              proficiencies: s.subspecialty_proficiencies,
            })),
          });
        }
      }
      throw new ValidationError(`Domain not found: ${domainId}`);
    }

    // GET /domain-taxonomy/search - Search domains and subspecialties
    if (method === 'GET' && path.endsWith('/search')) {
      const query = event.queryStringParameters?.q || '';
      const limit = parseInt(event.queryStringParameters?.limit || '20', 10);
      
      if (!query || query.length < 2) {
        throw new ValidationError('Search query (q) must be at least 2 characters');
      }

      const taxonomy = await domainTaxonomyService.getTaxonomy();
      const results: Array<{
        type: 'field' | 'domain' | 'subspecialty';
        id: string;
        name: string;
        icon?: string;
        parent_id?: string;
        parent_name?: string;
      }> = [];
      const lowerQuery = query.toLowerCase();

      for (const field of taxonomy.fields) {
        if (field.field_name.toLowerCase().includes(lowerQuery)) {
          results.push({
            type: 'field',
            id: field.field_id,
            name: field.field_name,
            icon: field.field_icon,
          });
        }

        for (const domain of field.domains) {
          if (domain.domain_name.toLowerCase().includes(lowerQuery) ||
              domain.detection_keywords.some(k => k.toLowerCase().includes(lowerQuery))) {
            results.push({
              type: 'domain',
              id: domain.domain_id,
              name: domain.domain_name,
              icon: domain.domain_icon,
              parent_id: field.field_id,
              parent_name: field.field_name,
            });
          }

          for (const sub of domain.subspecialties) {
            if (sub.subspecialty_name.toLowerCase().includes(lowerQuery) ||
                sub.detection_keywords.some(k => k.toLowerCase().includes(lowerQuery))) {
              results.push({
                type: 'subspecialty',
                id: sub.subspecialty_id,
                name: sub.subspecialty_name,
                parent_id: domain.domain_id,
                parent_name: domain.domain_name,
              });
            }
          }
        }
      }

      return success({ results: results.slice(0, limit), total: results.length });
    }

    // POST /domain-taxonomy/user-selection - Save user's domain selection
    if (method === 'POST' && path.endsWith('/user-selection')) {
      const body = JSON.parse(event.body || '{}');
      const { executeStatement: exec } = await import('../shared/db/client.js');

      await exec(
        `INSERT INTO domain_taxonomy_selections 
         (tenant_id, user_id, field_id, domain_id, subspecialty_id, session_id, is_default)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [
          { name: 'tenantId', value: { stringValue: user.tenantId } },
          { name: 'userId', value: { stringValue: user.userId } },
          { name: 'fieldId', value: body.field_id ? { stringValue: body.field_id } : { isNull: true } },
          { name: 'domainId', value: body.domain_id ? { stringValue: body.domain_id } : { isNull: true } },
          { name: 'subspecialtyId', value: body.subspecialty_id ? { stringValue: body.subspecialty_id } : { isNull: true } },
          { name: 'sessionId', value: body.session_id ? { stringValue: body.session_id } : { isNull: true } },
          { name: 'isDefault', value: { booleanValue: body.is_default ?? false } },
        ]
      );

      return success({ saved: true });
    }

    // GET /domain-taxonomy/user-selection - Get user's current/default domain selection
    if (method === 'GET' && path.endsWith('/user-selection')) {
      const sessionId = event.queryStringParameters?.session_id;
      const { executeStatement: exec } = await import('../shared/db/client.js');

      let query = `SELECT * FROM domain_taxonomy_selections 
                   WHERE tenant_id = $1 AND user_id = $2`;
      const params = [
        { name: 'tenantId', value: { stringValue: user.tenantId } },
        { name: 'userId', value: { stringValue: user.userId } },
      ];

      if (sessionId) {
        query += ` AND session_id = $3 ORDER BY created_at DESC LIMIT 1`;
        params.push({ name: 'sessionId', value: { stringValue: sessionId } });
      } else {
        query += ` AND is_default = true ORDER BY created_at DESC LIMIT 1`;
      }

      const result = await exec(query, params);
      
      if (result.rows.length === 0) {
        return success({ selection: null });
      }

      const row = result.rows[0] as Record<string, unknown>;
      return success({
        selection: {
          field_id: row.field_id,
          domain_id: row.domain_id,
          subspecialty_id: row.subspecialty_id,
          is_default: row.is_default,
          created_at: row.created_at,
        },
      });
    }

    // DELETE /domain-taxonomy/user-selection - Clear user's domain selection
    if (method === 'DELETE' && path.endsWith('/user-selection')) {
      const { executeStatement: exec } = await import('../shared/db/client.js');
      const sessionId = event.queryStringParameters?.session_id;

      let query = `DELETE FROM domain_taxonomy_selections WHERE tenant_id = $1 AND user_id = $2`;
      const params = [
        { name: 'tenantId', value: { stringValue: user.tenantId } },
        { name: 'userId', value: { stringValue: user.userId } },
      ];

      if (sessionId) {
        query += ` AND session_id = $3`;
        params.push({ name: 'sessionId', value: { stringValue: sessionId } });
      }

      await exec(query, params);
      return success({ cleared: true });
    }

    // GET /domain-taxonomy/proficiencies/:domainId - Get proficiencies for a domain
    if (method === 'GET' && path.includes('/proficiencies/')) {
      const domainId = path.split('/proficiencies/')[1];
      const taxonomy = await domainTaxonomyService.getTaxonomy();

      for (const field of taxonomy.fields) {
        const domain = field.domains.find(d => d.domain_id === domainId);
        if (domain) {
          const merged = domainTaxonomyService.mergeProficiencies(field, domain);
          return success({
            domain_id: domainId,
            domain_name: domain.domain_name,
            field_proficiencies: field.field_proficiencies,
            domain_proficiencies: domain.domain_proficiencies,
            merged_proficiencies: merged,
            proficiency_dimensions: [
              { key: 'reasoning_depth', label: 'Reasoning Depth', value: merged.reasoning_depth },
              { key: 'mathematical_quantitative', label: 'Mathematical', value: merged.mathematical_quantitative },
              { key: 'code_generation', label: 'Code Generation', value: merged.code_generation },
              { key: 'creative_generative', label: 'Creative', value: merged.creative_generative },
              { key: 'research_synthesis', label: 'Research', value: merged.research_synthesis },
              { key: 'factual_recall_precision', label: 'Factual Precision', value: merged.factual_recall_precision },
              { key: 'multi_step_problem_solving', label: 'Problem Solving', value: merged.multi_step_problem_solving },
              { key: 'domain_terminology_handling', label: 'Terminology', value: merged.domain_terminology_handling },
            ],
          });
        }
      }
      throw new ValidationError(`Domain not found: ${domainId}`);
    }

    // POST /domain-taxonomy/recommend-mode - Recommend orchestration mode for domain
    if (method === 'POST' && path.endsWith('/recommend-mode')) {
      const body = JSON.parse(event.body || '{}');
      let proficiencies;

      if (body.prompt) {
        const detection = await domainTaxonomyService.detectDomain(body.prompt);
        proficiencies = detection.merged_proficiencies;
      } else if (body.domain_id) {
        const taxonomy = await domainTaxonomyService.getTaxonomy();
        for (const field of taxonomy.fields) {
          const domain = field.domains.find(d => d.domain_id === body.domain_id);
          if (domain) {
            proficiencies = domainTaxonomyService.mergeProficiencies(field, domain);
            break;
          }
        }
      }

      if (!proficiencies) {
        throw new ValidationError('prompt or domain_id is required');
      }

      // Determine recommended mode based on proficiencies
      let mode = 'thinking';
      let reasoning = 'Standard thinking mode for balanced tasks';

      if (proficiencies.reasoning_depth >= 9 && proficiencies.multi_step_problem_solving >= 9) {
        mode = 'extended_thinking';
        reasoning = 'Complex reasoning required - extended thinking recommended';
      } else if (proficiencies.code_generation >= 8) {
        mode = 'coding';
        reasoning = 'Code-focused task - coding mode recommended';
      } else if (proficiencies.creative_generative >= 8) {
        mode = 'creative';
        reasoning = 'Creative task - creative mode recommended';
      } else if (proficiencies.research_synthesis >= 8) {
        mode = 'research';
        reasoning = 'Research-heavy task - research mode recommended';
      } else if (proficiencies.mathematical_quantitative >= 8) {
        mode = 'analysis';
        reasoning = 'Quantitative analysis required - analysis mode recommended';
      }

      return success({
        recommended_mode: mode,
        reasoning,
        proficiencies,
        available_modes: ['thinking', 'extended_thinking', 'coding', 'creative', 'research', 'analysis'],
      });
    }

    // ========================================================================
    // Admin Endpoints (admin users only)
    // ========================================================================

    // POST /domain-taxonomy/admin/field - Update a field
    if (method === 'POST' && path.endsWith('/admin/field')) {
      if (!user.isAdmin) {
        throw new ForbiddenError('Admin access required');
      }

      const body = JSON.parse(event.body || '{}');
      if (!body.field_id) {
        throw new ValidationError('field_id is required');
      }

      await domainTaxonomyService.updateTaxonomyField(
        body.field_id,
        {
          field_name: body.field_name,
          field_icon: body.field_icon,
          field_color: body.field_color,
          field_description: body.field_description,
          field_proficiencies: body.field_proficiencies,
        },
        user.userId
      );

      return success({ updated: true, field_id: body.field_id });
    }

    // POST /domain-taxonomy/admin/domain - Update a domain
    if (method === 'POST' && path.endsWith('/admin/domain')) {
      if (!user.isAdmin) {
        throw new ForbiddenError('Admin access required');
      }

      const body = JSON.parse(event.body || '{}');
      if (!body.domain_id) {
        throw new ValidationError('domain_id is required');
      }

      await domainTaxonomyService.updateTaxonomyDomain(
        body.domain_id,
        {
          domain_name: body.domain_name,
          domain_icon: body.domain_icon,
          domain_description: body.domain_description,
          detection_keywords: body.detection_keywords,
          domain_proficiencies: body.domain_proficiencies,
        },
        user.userId
      );

      return success({ updated: true, domain_id: body.domain_id });
    }

    // GET /domain-taxonomy/admin/feedback-analytics - Get overall feedback analytics
    if (method === 'GET' && path.endsWith('/admin/feedback-analytics')) {
      if (!user.isAdmin) {
        throw new ForbiddenError('Admin access required');
      }

      // Get top domains by feedback count and accuracy issues
      const { executeStatement } = await import('../shared/db/client.js');
      
      const result = await executeStatement(
        `SELECT 
          COALESCE(actual_domain_id, detected_domain_id) as domain_id,
          COUNT(*) as feedback_count,
          AVG(quality_score) as avg_quality,
          AVG(CASE WHEN domain_accuracy THEN 1.0 ELSE 0.0 END) as accuracy_rate,
          AVG(proficiency_match_quality) as avg_proficiency_match,
          COUNT(CASE WHEN NOT domain_accuracy THEN 1 END) as misclassification_count
        FROM domain_taxonomy_feedback
        WHERE created_at > NOW() - INTERVAL '30 days'
        GROUP BY COALESCE(actual_domain_id, detected_domain_id)
        ORDER BY feedback_count DESC
        LIMIT 20`,
        []
      );

      return success({
        analytics: result.rows.map((row: Record<string, unknown>) => {
          const r = row;
          return {
            domain_id: String(r.domain_id),
            feedback_count: parseInt(String(r.feedback_count || 0), 10),
            avg_quality: parseFloat(String(r.avg_quality || 0)),
            accuracy_rate: parseFloat(String(r.accuracy_rate || 0)),
            avg_proficiency_match: parseFloat(String(r.avg_proficiency_match || 0)),
            misclassification_count: parseInt(String(r.misclassification_count || 0), 10),
          };
        }),
        period: '30 days',
      });
    }

    throw new ValidationError(`Unknown route: ${method} ${path}`);
  } catch (error) {
    return handleError(error);
  }
}
