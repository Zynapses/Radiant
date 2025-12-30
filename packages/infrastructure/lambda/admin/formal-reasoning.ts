/**
 * Formal Reasoning Admin API Handler
 * 
 * Admin endpoints for managing the 8 formal reasoning libraries integrated
 * with the consciousness engine. Provides configuration, monitoring,
 * testing, and cost tracking capabilities.
 * 
 * Libraries:
 * 1. Z3 Theorem Prover - SMT solving, constraint verification
 * 2. PyArg - Structured argumentation semantics
 * 3. PyReason - Temporal graph reasoning
 * 4. RDFLib - Semantic web stack, SPARQL
 * 5. OWL-RL - Ontological inference
 * 6. pySHACL - Graph constraint validation
 * 7. Logic Tensor Networks - Differentiable FOL
 * 8. DeepProbLog - Probabilistic logic programming
 * 
 * Base path: /api/admin/formal-reasoning
 * 
 * @see docs/THINKTANK-ADMIN-GUIDE.md Section: Formal Reasoning
 */

import { APIGatewayProxyHandler, APIGatewayProxyResult } from 'aws-lambda';
import { formalReasoningService } from '../shared/services/formal-reasoning.service';
import { executeStatement } from '../shared/db/client';
import { logger } from '../shared/logger';
import {
  FormalReasoningLibrary,
  FormalReasoningTenantConfig,
  FormalReasoningRequest,
  ArgumentationFramework,
  PyReasonRule,
  SHACLShape,
  RDFTriple,
} from '@radiant/shared';

/**
 * Create JSON response helper.
 */
function jsonResponse(statusCode: number, body: unknown): APIGatewayProxyResult {
  return {
    statusCode,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
    },
    body: JSON.stringify(body),
  };
}

/**
 * Extract tenant ID from request context.
 */
function getTenantId(event: { requestContext?: { authorizer?: { tenantId?: string } } }): string {
  const tenantId = event.requestContext?.authorizer?.tenantId;
  if (!tenantId) {
    throw new Error('Tenant ID not found in request context');
  }
  return tenantId;
}

/**
 * Main handler - routes requests to appropriate handlers.
 */
export const handler: APIGatewayProxyHandler = async (event) => {
  const path = event.path.replace('/api/admin/formal-reasoning', '');
  const method = event.httpMethod;

  logger.info('Formal reasoning admin request', { path, method });

  try {
    const tenantId = getTenantId(event);

    // ========================================================================
    // Dashboard & Overview
    // ========================================================================

    // GET /dashboard - Full dashboard data
    if (path === '/dashboard' && method === 'GET') {
      const dashboard = await formalReasoningService.getDashboard(tenantId);
      return jsonResponse(200, dashboard);
    }

    // GET /libraries - Get all library info
    if (path === '/libraries' && method === 'GET') {
      const libraries = formalReasoningService.getLibraryRegistry();
      return jsonResponse(200, { libraries });
    }

    // GET /libraries/:id - Get specific library info
    if (path.match(/^\/libraries\/[\w-]+$/) && method === 'GET') {
      const libraryId = path.split('/')[2] as FormalReasoningLibrary;
      const library = formalReasoningService.getLibraryInfo(libraryId);
      if (!library) {
        return jsonResponse(404, { error: 'Library not found' });
      }
      return jsonResponse(200, library);
    }

    // ========================================================================
    // Configuration
    // ========================================================================

    // GET /config - Get tenant configuration
    if (path === '/config' && method === 'GET') {
      const config = await formalReasoningService.getTenantConfig(tenantId);
      return jsonResponse(200, config);
    }

    // PUT /config - Update tenant configuration
    if (path === '/config' && method === 'PUT') {
      const body = JSON.parse(event.body || '{}') as Partial<FormalReasoningTenantConfig>;
      await formalReasoningService.updateTenantConfig({ ...body, tenantId });
      const config = await formalReasoningService.getTenantConfig(tenantId);
      return jsonResponse(200, config);
    }

    // PUT /config/:library - Update library-specific config
    if (path.match(/^\/config\/[\w-]+$/) && method === 'PUT') {
      const libraryId = path.split('/')[2] as FormalReasoningLibrary;
      const body = JSON.parse(event.body || '{}');
      
      const currentConfig = await formalReasoningService.getTenantConfig(tenantId);
      const updatedConfig = { ...currentConfig, [libraryId]: body };
      await formalReasoningService.updateTenantConfig(updatedConfig);
      
      return jsonResponse(200, { success: true, library: libraryId });
    }

    // ========================================================================
    // Statistics & Metrics
    // ========================================================================

    // GET /stats?period=day|week|month
    if (path === '/stats' && method === 'GET') {
      const period = (event.queryStringParameters?.period || 'day') as 'hour' | 'day' | 'week' | 'month';
      const stats = await formalReasoningService.getStats(tenantId, period);
      return jsonResponse(200, stats);
    }

    // GET /invocations?limit=20
    if (path === '/invocations' && method === 'GET') {
      const limit = parseInt(event.queryStringParameters?.limit || '20', 10);
      const invocations = await formalReasoningService.getRecentInvocations(tenantId, limit);
      return jsonResponse(200, { invocations });
    }

    // GET /health - Get library health status
    if (path === '/health' && method === 'GET') {
      const health = await formalReasoningService.getLibraryHealth(tenantId);
      return jsonResponse(200, health);
    }

    // GET /costs?start=date&end=date
    if (path === '/costs' && method === 'GET') {
      const startDate = event.queryStringParameters?.start || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
      const endDate = event.queryStringParameters?.end || new Date().toISOString().split('T')[0];
      
      const result = await executeStatement(
        `SELECT date, library, invocation_count, total_cost_usd, avg_latency_ms
         FROM formal_reasoning_cost_aggregates
         WHERE tenant_id = $1 AND date BETWEEN $2 AND $3
         ORDER BY date DESC, library`,
        [
          { name: 'tenantId', value: { stringValue: tenantId } },
          { name: 'start', value: { stringValue: startDate } },
          { name: 'end', value: { stringValue: endDate } },
        ]
      );
      
      return jsonResponse(200, { costs: result.rows || [] });
    }

    // ========================================================================
    // Testing & Execution
    // ========================================================================

    // POST /test - Test a formal reasoning operation
    if (path === '/test' && method === 'POST') {
      const body = JSON.parse(event.body || '{}') as {
        library: FormalReasoningLibrary;
        taskType: string;
        input: unknown;
      };

      const request: FormalReasoningRequest = {
        id: `test-${Date.now()}`,
        tenantId,
        library: body.library,
        taskType: body.taskType as FormalReasoningRequest['taskType'],
        input: body.input,
        priority: 'high',
      };

      const result = await formalReasoningService.execute(request);
      return jsonResponse(200, result);
    }

    // POST /test/z3 - Test Z3 constraint solving
    if (path === '/test/z3' && method === 'POST') {
      const body = JSON.parse(event.body || '{}') as {
        constraints: Array<{ expression: string; variables: Array<{ name: string; type: string }> }>;
        type?: 'solve' | 'prove' | 'optimize';
      };

      const request: FormalReasoningRequest = {
        id: `test-z3-${Date.now()}`,
        tenantId,
        library: 'z3',
        taskType: 'constraint_satisfaction',
        input: {
          type: body.type || 'solve',
          constraints: body.constraints.map((c, i) => ({
            id: `c${i}`,
            ...c,
          })),
        },
      };

      const result = await formalReasoningService.execute(request);
      return jsonResponse(200, result);
    }

    // POST /test/pyarg - Test PyArg argumentation
    if (path === '/test/pyarg' && method === 'POST') {
      const body = JSON.parse(event.body || '{}') as {
        framework: ArgumentationFramework;
        semantics?: string;
      };

      const request: FormalReasoningRequest = {
        id: `test-pyarg-${Date.now()}`,
        tenantId,
        library: 'pyarg',
        taskType: 'argumentation',
        input: body,
      };

      const result = await formalReasoningService.execute(request);
      return jsonResponse(200, result);
    }

    // POST /test/sparql - Test RDFLib SPARQL query
    if (path === '/test/sparql' && method === 'POST') {
      const body = JSON.parse(event.body || '{}') as {
        query: string;
        type?: 'SELECT' | 'CONSTRUCT' | 'ASK' | 'DESCRIBE';
      };

      const request: FormalReasoningRequest = {
        id: `test-sparql-${Date.now()}`,
        tenantId,
        library: 'rdflib',
        taskType: 'sparql_query',
        input: {
          type: 'query',
          query: {
            query: body.query,
            type: body.type || 'SELECT',
          },
        },
      };

      const result = await formalReasoningService.execute(request);
      return jsonResponse(200, result);
    }

    // POST /test/shacl - Test pySHACL validation
    if (path === '/test/shacl' && method === 'POST') {
      const body = JSON.parse(event.body || '{}') as {
        data: RDFTriple[] | string;
        shapes: SHACLShape[] | string;
      };

      const request: FormalReasoningRequest = {
        id: `test-shacl-${Date.now()}`,
        tenantId,
        library: 'pyshacl',
        taskType: 'schema_validation',
        input: body,
      };

      const result = await formalReasoningService.execute(request);
      return jsonResponse(200, result);
    }

    // ========================================================================
    // Knowledge Graph Management (RDFLib)
    // ========================================================================

    // GET /triples?graph=default&limit=100
    if (path === '/triples' && method === 'GET') {
      const graphId = event.queryStringParameters?.graph || 'default';
      const limit = parseInt(event.queryStringParameters?.limit || '100', 10);
      
      const result = await executeStatement(
        `SELECT * FROM formal_reasoning_triples
         WHERE tenant_id = $1 AND graph_id = $2
         ORDER BY created_at DESC
         LIMIT $3`,
        [
          { name: 'tenantId', value: { stringValue: tenantId } },
          { name: 'graphId', value: { stringValue: graphId } },
          { name: 'limit', value: { longValue: limit } },
        ]
      );
      
      return jsonResponse(200, { triples: result.rows || [] });
    }

    // POST /triples - Add triples
    if (path === '/triples' && method === 'POST') {
      const body = JSON.parse(event.body || '{}') as {
        triples: RDFTriple[];
        graphId?: string;
      };

      const graphId = body.graphId || 'default';
      let insertedCount = 0;

      for (const triple of body.triples) {
        await executeStatement(
          `INSERT INTO formal_reasoning_triples 
           (tenant_id, graph_id, subject, predicate, object, object_type, datatype, language, source)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'admin')`,
          [
            { name: 'tenantId', value: { stringValue: tenantId } },
            { name: 'graphId', value: { stringValue: graphId } },
            { name: 'subject', value: { stringValue: triple.subject } },
            { name: 'predicate', value: { stringValue: triple.predicate } },
            { name: 'object', value: { stringValue: triple.object } },
            { name: 'objectType', value: { stringValue: triple.objectType || 'uri' } },
            { name: 'datatype', value: triple.datatype ? { stringValue: triple.datatype } : { isNull: true } },
            { name: 'language', value: triple.language ? { stringValue: triple.language } : { isNull: true } },
          ]
        );
        insertedCount++;
      }
      
      return jsonResponse(201, { inserted: insertedCount });
    }

    // DELETE /triples?graph=default - Clear graph
    if (path === '/triples' && method === 'DELETE') {
      const graphId = event.queryStringParameters?.graph || 'default';
      
      await executeStatement(
        `DELETE FROM formal_reasoning_triples WHERE tenant_id = $1 AND graph_id = $2`,
        [
          { name: 'tenantId', value: { stringValue: tenantId } },
          { name: 'graphId', value: { stringValue: graphId } },
        ]
      );
      
      return jsonResponse(200, { deleted: true, graph: graphId });
    }

    // ========================================================================
    // Argumentation Frameworks (PyArg)
    // ========================================================================

    // GET /frameworks
    if (path === '/frameworks' && method === 'GET') {
      const result = await executeStatement(
        `SELECT * FROM formal_reasoning_af WHERE tenant_id = $1 ORDER BY updated_at DESC`,
        [{ name: 'tenantId', value: { stringValue: tenantId } }]
      );
      return jsonResponse(200, { frameworks: result.rows || [] });
    }

    // POST /frameworks
    if (path === '/frameworks' && method === 'POST') {
      const body = JSON.parse(event.body || '{}') as ArgumentationFramework;
      const id = body.id || `af-${Date.now()}`;
      
      await executeStatement(
        `INSERT INTO formal_reasoning_af (id, tenant_id, name, description, arguments, attacks)
         VALUES ($1, $2, $3, $4, $5::jsonb, $6::jsonb)
         ON CONFLICT (id) DO UPDATE SET
           name = EXCLUDED.name,
           description = EXCLUDED.description,
           arguments = EXCLUDED.arguments,
           attacks = EXCLUDED.attacks,
           version = formal_reasoning_af.version + 1,
           updated_at = NOW()`,
        [
          { name: 'id', value: { stringValue: id } },
          { name: 'tenantId', value: { stringValue: tenantId } },
          { name: 'name', value: { stringValue: body.id || 'Unnamed Framework' } },
          { name: 'description', value: { isNull: true } },
          { name: 'arguments', value: { stringValue: JSON.stringify(body.arguments) } },
          { name: 'attacks', value: { stringValue: JSON.stringify(body.attacks) } },
        ]
      );
      
      return jsonResponse(201, { id });
    }

    // DELETE /frameworks/:id
    if (path.match(/^\/frameworks\/[\w-]+$/) && method === 'DELETE') {
      const frameworkId = path.split('/')[2];
      await executeStatement(
        `DELETE FROM formal_reasoning_af WHERE id = $1 AND tenant_id = $2`,
        [
          { name: 'id', value: { stringValue: frameworkId } },
          { name: 'tenantId', value: { stringValue: tenantId } },
        ]
      );
      return jsonResponse(200, { deleted: true });
    }

    // ========================================================================
    // Temporal Rules (PyReason)
    // ========================================================================

    // GET /rules
    if (path === '/rules' && method === 'GET') {
      const result = await executeStatement(
        `SELECT * FROM formal_reasoning_rules WHERE tenant_id = $1 ORDER BY priority DESC, created_at DESC`,
        [{ name: 'tenantId', value: { stringValue: tenantId } }]
      );
      return jsonResponse(200, { rules: result.rows || [] });
    }

    // POST /rules
    if (path === '/rules' && method === 'POST') {
      const body = JSON.parse(event.body || '{}') as PyReasonRule;
      const id = body.id || `rule-${Date.now()}`;
      
      await executeStatement(
        `INSERT INTO formal_reasoning_rules (id, tenant_id, name, head, body, annotation_lower, annotation_upper, immediate, priority)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
         ON CONFLICT (id) DO UPDATE SET
           name = EXCLUDED.name,
           head = EXCLUDED.head,
           body = EXCLUDED.body,
           annotation_lower = EXCLUDED.annotation_lower,
           annotation_upper = EXCLUDED.annotation_upper,
           immediate = EXCLUDED.immediate,
           priority = EXCLUDED.priority,
           updated_at = NOW()`,
        [
          { name: 'id', value: { stringValue: id } },
          { name: 'tenantId', value: { stringValue: tenantId } },
          { name: 'name', value: { stringValue: body.name } },
          { name: 'head', value: { stringValue: body.head } },
          { name: 'body', value: { stringValue: body.body } },
          { name: 'annotationLower', value: { doubleValue: body.annotation?.[0] || 0 } },
          { name: 'annotationUpper', value: { doubleValue: body.annotation?.[1] || 1 } },
          { name: 'immediate', value: { booleanValue: body.immediateRule || false } },
          { name: 'priority', value: { longValue: 0 } },
        ]
      );
      
      return jsonResponse(201, { id });
    }

    // PUT /rules/:id/enabled
    if (path.match(/^\/rules\/[\w-]+\/enabled$/) && method === 'PUT') {
      const ruleId = path.split('/')[2];
      const body = JSON.parse(event.body || '{}') as { enabled: boolean };
      
      await executeStatement(
        `UPDATE formal_reasoning_rules SET enabled = $3, updated_at = NOW() WHERE id = $1 AND tenant_id = $2`,
        [
          { name: 'id', value: { stringValue: ruleId } },
          { name: 'tenantId', value: { stringValue: tenantId } },
          { name: 'enabled', value: { booleanValue: body.enabled } },
        ]
      );
      
      return jsonResponse(200, { success: true });
    }

    // DELETE /rules/:id
    if (path.match(/^\/rules\/[\w-]+$/) && method === 'DELETE') {
      const ruleId = path.split('/')[2];
      await executeStatement(
        `DELETE FROM formal_reasoning_rules WHERE id = $1 AND tenant_id = $2`,
        [
          { name: 'id', value: { stringValue: ruleId } },
          { name: 'tenantId', value: { stringValue: tenantId } },
        ]
      );
      return jsonResponse(200, { deleted: true });
    }

    // ========================================================================
    // SHACL Shapes (pySHACL)
    // ========================================================================

    // GET /shapes
    if (path === '/shapes' && method === 'GET') {
      const result = await executeStatement(
        `SELECT * FROM formal_reasoning_shapes WHERE tenant_id = $1 ORDER BY created_at DESC`,
        [{ name: 'tenantId', value: { stringValue: tenantId } }]
      );
      return jsonResponse(200, { shapes: result.rows || [] });
    }

    // POST /shapes
    if (path === '/shapes' && method === 'POST') {
      const body = JSON.parse(event.body || '{}') as {
        id?: string;
        name: string;
        description?: string;
        shapeTurtle?: string;
        shapeJson?: SHACLShape;
        targetClass?: string;
        severity?: string;
      };
      
      const id = body.id || `shape-${Date.now()}`;
      
      await executeStatement(
        `INSERT INTO formal_reasoning_shapes (id, tenant_id, name, description, shape_turtle, shape_json, target_class, severity)
         VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7, $8)
         ON CONFLICT (id) DO UPDATE SET
           name = EXCLUDED.name,
           description = EXCLUDED.description,
           shape_turtle = EXCLUDED.shape_turtle,
           shape_json = EXCLUDED.shape_json,
           target_class = EXCLUDED.target_class,
           severity = EXCLUDED.severity,
           updated_at = NOW()`,
        [
          { name: 'id', value: { stringValue: id } },
          { name: 'tenantId', value: { stringValue: tenantId } },
          { name: 'name', value: { stringValue: body.name } },
          { name: 'description', value: body.description ? { stringValue: body.description } : { isNull: true } },
          { name: 'shapeTurtle', value: body.shapeTurtle ? { stringValue: body.shapeTurtle } : { isNull: true } },
          { name: 'shapeJson', value: body.shapeJson ? { stringValue: JSON.stringify(body.shapeJson) } : { isNull: true } },
          { name: 'targetClass', value: body.targetClass ? { stringValue: body.targetClass } : { isNull: true } },
          { name: 'severity', value: { stringValue: body.severity || 'Violation' } },
        ]
      );
      
      return jsonResponse(201, { id });
    }

    // DELETE /shapes/:id
    if (path.match(/^\/shapes\/[\w-]+$/) && method === 'DELETE') {
      const shapeId = path.split('/')[2];
      await executeStatement(
        `DELETE FROM formal_reasoning_shapes WHERE id = $1 AND tenant_id = $2`,
        [
          { name: 'id', value: { stringValue: shapeId } },
          { name: 'tenantId', value: { stringValue: tenantId } },
        ]
      );
      return jsonResponse(200, { deleted: true });
    }

    // ========================================================================
    // Ontologies (OWL-RL)
    // ========================================================================

    // GET /ontologies
    if (path === '/ontologies' && method === 'GET') {
      const result = await executeStatement(
        `SELECT id, tenant_id, name, description, original_triple_count, inferred_triple_count, 
                enabled, last_inference_at, created_at, updated_at
         FROM formal_reasoning_ontologies WHERE tenant_id = $1 ORDER BY created_at DESC`,
        [{ name: 'tenantId', value: { stringValue: tenantId } }]
      );
      return jsonResponse(200, { ontologies: result.rows || [] });
    }

    // POST /ontologies
    if (path === '/ontologies' && method === 'POST') {
      const body = JSON.parse(event.body || '{}') as {
        id?: string;
        name: string;
        description?: string;
        ontologyTurtle: string;
      };
      
      const id = body.id || `ont-${Date.now()}`;
      
      await executeStatement(
        `INSERT INTO formal_reasoning_ontologies (id, tenant_id, name, description, ontology_turtle)
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT (id) DO UPDATE SET
           name = EXCLUDED.name,
           description = EXCLUDED.description,
           ontology_turtle = EXCLUDED.ontology_turtle,
           updated_at = NOW()`,
        [
          { name: 'id', value: { stringValue: id } },
          { name: 'tenantId', value: { stringValue: tenantId } },
          { name: 'name', value: { stringValue: body.name } },
          { name: 'description', value: body.description ? { stringValue: body.description } : { isNull: true } },
          { name: 'ontologyTurtle', value: { stringValue: body.ontologyTurtle } },
        ]
      );
      
      return jsonResponse(201, { id });
    }

    // POST /ontologies/:id/infer - Run OWL-RL inference
    if (path.match(/^\/ontologies\/[\w-]+\/infer$/) && method === 'POST') {
      const ontologyId = path.split('/')[2];
      
      // Get ontology
      const ontResult = await executeStatement(
        `SELECT ontology_turtle FROM formal_reasoning_ontologies WHERE id = $1 AND tenant_id = $2`,
        [
          { name: 'id', value: { stringValue: ontologyId } },
          { name: 'tenantId', value: { stringValue: tenantId } },
        ]
      );
      
      if (!ontResult.rows?.length) {
        return jsonResponse(404, { error: 'Ontology not found' });
      }

      // Run inference
      const request: FormalReasoningRequest = {
        id: `infer-${ontologyId}-${Date.now()}`,
        tenantId,
        library: 'owlrl',
        taskType: 'ontology_inference',
        input: {
          triples: [],
          ontology: (ontResult.rows[0] as Record<string, unknown>).ontology_turtle,
        },
      };

      const result = await formalReasoningService.execute(request);
      
      // Update ontology with inference results
      if (result.status !== 'error') {
        const inferResult = result.result as { originalTripleCount?: number; inferredTripleCount?: number };
        await executeStatement(
          `UPDATE formal_reasoning_ontologies 
           SET original_triple_count = $3, inferred_triple_count = $4, last_inference_at = NOW()
           WHERE id = $1 AND tenant_id = $2`,
          [
            { name: 'id', value: { stringValue: ontologyId } },
            { name: 'tenantId', value: { stringValue: tenantId } },
            { name: 'originalCount', value: { longValue: inferResult.originalTripleCount || 0 } },
            { name: 'inferredCount', value: { longValue: inferResult.inferredTripleCount || 0 } },
          ]
        );
      }
      
      return jsonResponse(200, result);
    }

    // ========================================================================
    // Beliefs (Verified Reasoning)
    // ========================================================================

    // GET /beliefs
    if (path === '/beliefs' && method === 'GET') {
      const status = event.queryStringParameters?.status || 'active';
      const verified = event.queryStringParameters?.verified;
      
      let query = `SELECT * FROM formal_reasoning_beliefs WHERE tenant_id = $1 AND status = $2`;
      const params: Array<{ name: string; value: unknown }> = [
        { name: 'tenantId', value: { stringValue: tenantId } },
        { name: 'status', value: { stringValue: status } },
      ];
      
      if (verified !== undefined) {
        query += ` AND verified = $3`;
        params.push({ name: 'verified', value: { booleanValue: verified === 'true' } });
      }
      
      query += ` ORDER BY confidence DESC, created_at DESC LIMIT 100`;
      
      const result = await executeStatement(query, params);
      return jsonResponse(200, { beliefs: result.rows || [] });
    }

    // POST /beliefs - Add a belief
    if (path === '/beliefs' && method === 'POST') {
      const body = JSON.parse(event.body || '{}') as {
        claim: string;
        confidence: number;
        source?: string;
        verify?: boolean;
      };
      
      const id = `belief-${Date.now()}`;
      let verified = false;
      let verificationResult = null;
      
      // Optionally verify the belief using Z3
      if (body.verify) {
        const verifyRequest: FormalReasoningRequest = {
          id: `verify-belief-${Date.now()}`,
          tenantId,
          library: 'z3',
          taskType: 'belief_verification',
          input: {
            type: 'prove',
            theorem: body.claim,
            axioms: [],
          },
        };
        
        const verifyResult = await formalReasoningService.execute(verifyRequest);
        verified = verifyResult.status === 'valid' || verifyResult.status === 'sat';
        verificationResult = verifyResult;
      }
      
      await executeStatement(
        `INSERT INTO formal_reasoning_beliefs (id, tenant_id, claim, confidence, verified, verifier_library, verification_result, source)
         VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb, $8)`,
        [
          { name: 'id', value: { stringValue: id } },
          { name: 'tenantId', value: { stringValue: tenantId } },
          { name: 'claim', value: { stringValue: body.claim } },
          { name: 'confidence', value: { doubleValue: body.confidence } },
          { name: 'verified', value: { booleanValue: verified } },
          { name: 'verifierLibrary', value: body.verify ? { stringValue: 'z3' } : { isNull: true } },
          { name: 'verificationResult', value: verificationResult ? { stringValue: JSON.stringify(verificationResult) } : { isNull: true } },
          { name: 'source', value: body.source ? { stringValue: body.source } : { stringValue: 'admin' } },
        ]
      );
      
      return jsonResponse(201, { id, verified, verificationResult });
    }

    // POST /beliefs/:id/verify - Verify a belief
    if (path.match(/^\/beliefs\/[\w-]+\/verify$/) && method === 'POST') {
      const beliefId = path.split('/')[2];
      
      // Get belief
      const beliefResult = await executeStatement(
        `SELECT claim FROM formal_reasoning_beliefs WHERE id = $1 AND tenant_id = $2`,
        [
          { name: 'id', value: { stringValue: beliefId } },
          { name: 'tenantId', value: { stringValue: tenantId } },
        ]
      );
      
      if (!beliefResult.rows?.length) {
        return jsonResponse(404, { error: 'Belief not found' });
      }
      
      const claim = (beliefResult.rows[0] as Record<string, unknown>).claim as string;
      
      // Verify using Z3
      const verifyRequest: FormalReasoningRequest = {
        id: `verify-belief-${Date.now()}`,
        tenantId,
        library: 'z3',
        taskType: 'belief_verification',
        input: {
          type: 'prove',
          theorem: claim,
          axioms: [],
        },
      };
      
      const verifyResult = await formalReasoningService.execute(verifyRequest);
      const verified = verifyResult.status === 'valid' || verifyResult.status === 'sat';
      
      // Update belief
      await executeStatement(
        `UPDATE formal_reasoning_beliefs 
         SET verified = $3, verifier_library = 'z3', verification_result = $4::jsonb, updated_at = NOW()
         WHERE id = $1 AND tenant_id = $2`,
        [
          { name: 'id', value: { stringValue: beliefId } },
          { name: 'tenantId', value: { stringValue: tenantId } },
          { name: 'verified', value: { booleanValue: verified } },
          { name: 'verificationResult', value: { stringValue: JSON.stringify(verifyResult) } },
        ]
      );
      
      return jsonResponse(200, { verified, result: verifyResult });
    }

    // PUT /beliefs/:id/status - Update belief status
    if (path.match(/^\/beliefs\/[\w-]+\/status$/) && method === 'PUT') {
      const beliefId = path.split('/')[2];
      const body = JSON.parse(event.body || '{}') as { status: 'active' | 'revised' | 'retracted' };
      
      await executeStatement(
        `UPDATE formal_reasoning_beliefs SET status = $3, updated_at = NOW() WHERE id = $1 AND tenant_id = $2`,
        [
          { name: 'id', value: { stringValue: beliefId } },
          { name: 'tenantId', value: { stringValue: tenantId } },
          { name: 'status', value: { stringValue: body.status } },
        ]
      );
      
      return jsonResponse(200, { success: true });
    }

    // ========================================================================
    // Budget Management
    // ========================================================================

    // GET /budget
    if (path === '/budget' && method === 'GET') {
      const config = await formalReasoningService.getTenantConfig(tenantId);
      const dashboard = await formalReasoningService.getDashboard(tenantId);
      
      return jsonResponse(200, {
        limits: config.budgetLimits,
        usage: dashboard.budgetUsage,
      });
    }

    // PUT /budget
    if (path === '/budget' && method === 'PUT') {
      const body = JSON.parse(event.body || '{}') as {
        dailyInvocations?: number;
        dailyCostUsd?: number;
        monthlyInvocations?: number;
        monthlyCostUsd?: number;
      };
      
      const config = await formalReasoningService.getTenantConfig(tenantId);
      const newLimits = { ...config.budgetLimits, ...body };
      
      await formalReasoningService.updateTenantConfig({
        tenantId,
        budgetLimits: newLimits,
      });
      
      return jsonResponse(200, { limits: newLimits });
    }

    // ========================================================================
    // 404 - Not Found
    // ========================================================================

    return jsonResponse(404, { error: `Unknown endpoint: ${method} ${path}` });

  } catch (error) {
    logger.error(`Formal reasoning admin error: ${String(error)}`);
    return jsonResponse(500, { error: String(error) });
  }
};
