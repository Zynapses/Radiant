/**
 * Cato Pipeline Admin API Handler
 * 
 * API endpoints for managing pipeline executions, methods, schemas, tools,
 * checkpoints, and compensation.
 */

import { APIGatewayProxyHandler, APIGatewayProxyResult } from 'aws-lambda';
import { Pool } from 'pg';
import { createCatoMethodRegistryService } from '../shared/services/cato-method-registry.service';
import { createCatoSchemaRegistryService } from '../shared/services/cato-schema-registry.service';
import { createCatoToolRegistryService } from '../shared/services/cato-tool-registry.service';
import { createCatoCheckpointService } from '../shared/services/cato-checkpoint.service';
import { createCatoCompensationService } from '../shared/services/cato-compensation.service';
import { createCatoPipelineOrchestratorService } from '../shared/services/cato-pipeline-orchestrator.service';
import { createCatoMerkleService } from '../shared/services/cato-merkle.service';
import { CatoCheckpointDecision } from '@radiant/shared';

const pool = new Pool({
  host: process.env.DB_HOST,
  port: parseInt(process.env.DB_PORT || '5432'),
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false,
});

const schemaRegistry = createCatoSchemaRegistryService(pool);
const methodRegistry = createCatoMethodRegistryService(pool);
const toolRegistry = createCatoToolRegistryService(pool);
const checkpointService = createCatoCheckpointService(pool);
const compensationService = createCatoCompensationService(pool, toolRegistry);
const merkleService = createCatoMerkleService(pool);
const pipelineOrchestrator = createCatoPipelineOrchestratorService(
  pool, methodRegistry, schemaRegistry, toolRegistry, checkpointService, compensationService
);

const corsHeaders = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type,Authorization',
  'Access-Control-Allow-Methods': 'GET,POST,PUT,PATCH,DELETE,OPTIONS',
};

const response = (statusCode: number, body: unknown): APIGatewayProxyResult => ({
  statusCode,
  headers: corsHeaders,
  body: JSON.stringify(body),
});

export const handler: APIGatewayProxyHandler = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return response(200, {});
  }

  const path = event.path.replace('/api/admin/cato/pipeline', '');
  const method = event.httpMethod;
  const tenantId = event.requestContext.authorizer?.tenantId || event.headers['x-tenant-id'] || 'default';

  try {
    // ============ PIPELINE EXECUTIONS ============
    if (path === '/executions' && method === 'GET') {
      const result = await pool.query(
        `SELECT * FROM cato_pipeline_executions WHERE tenant_id = $1 ORDER BY started_at DESC LIMIT 50`,
        [tenantId]
      );
      return response(200, { executions: result.rows });
    }

    if (path === '/executions' && method === 'POST') {
      const body = JSON.parse(event.body || '{}');
      const result = await pipelineOrchestrator.executePipeline({
        tenantId,
        userId: body.userId,
        request: body.request,
        templateId: body.templateId,
        methodChain: body.methodChain,
        governancePreset: body.governancePreset || 'BALANCED',
        config: body.config,
        complianceFrameworks: body.complianceFrameworks,
      });
      return response(201, result);
    }

    if (path.match(/^\/executions\/[^/]+$/) && method === 'GET') {
      const pipelineId = path.split('/')[2];
      const execution = await pipelineOrchestrator.getExecution(pipelineId);
      if (!execution) return response(404, { error: 'Execution not found' });
      return response(200, { execution });
    }

    if (path.match(/^\/executions\/[^/]+\/resume$/) && method === 'POST') {
      const pipelineId = path.split('/')[2];
      const body = JSON.parse(event.body || '{}');
      const result = await pipelineOrchestrator.resumePipeline(
        pipelineId,
        body.checkpointId,
        body.decision as CatoCheckpointDecision
      );
      return response(200, result);
    }

    // ============ METHODS ============
    if (path === '/methods' && method === 'GET') {
      const methods = await methodRegistry.listMethods({ tenantId });
      return response(200, { methods });
    }

    if (path.match(/^\/methods\/[^/]+$/) && method === 'GET') {
      const methodId = decodeURIComponent(path.split('/')[2]);
      const methodDef = await methodRegistry.getMethod(methodId);
      if (!methodDef) return response(404, { error: 'Method not found' });
      return response(200, { method: methodDef });
    }

    if (path === '/methods' && method === 'POST') {
      const body = JSON.parse(event.body || '{}');
      const methodDef = await methodRegistry.createMethod({ ...body, tenantId });
      return response(201, { method: methodDef });
    }

    if (path.match(/^\/methods\/[^/]+$/) && method === 'PUT') {
      const methodId = decodeURIComponent(path.split('/')[2]);
      const body = JSON.parse(event.body || '{}');
      const methodDef = await methodRegistry.updateMethod(methodId, body);
      return response(200, { method: methodDef });
    }

    // ============ SCHEMAS ============
    if (path === '/schemas' && method === 'GET') {
      const schemas = await schemaRegistry.listSchemas({ tenantId });
      return response(200, { schemas });
    }

    if (path.match(/^\/schemas\/[^/]+$/) && method === 'GET') {
      const schemaRefId = decodeURIComponent(path.split('/')[2]);
      const schema = await schemaRegistry.getSchema(schemaRefId);
      if (!schema) return response(404, { error: 'Schema not found' });
      return response(200, { schema });
    }

    if (path === '/schemas/validate' && method === 'POST') {
      const body = JSON.parse(event.body || '{}');
      const result = await schemaRegistry.validatePayload(body.schemaRefId, body.payload);
      return response(200, result);
    }

    // ============ TOOLS ============
    if (path === '/tools' && method === 'GET') {
      const tools = await toolRegistry.listTools({ tenantId });
      return response(200, { tools });
    }

    if (path.match(/^\/tools\/[^/]+$/) && method === 'GET') {
      const toolId = decodeURIComponent(path.split('/')[2]);
      const tool = await toolRegistry.getTool(toolId);
      if (!tool) return response(404, { error: 'Tool not found' });
      return response(200, { tool });
    }

    if (path === '/tools' && method === 'POST') {
      const body = JSON.parse(event.body || '{}');
      const tool = await toolRegistry.createTool({ ...body, tenantId });
      return response(201, { tool });
    }

    if (path === '/tools/validate' && method === 'POST') {
      const body = JSON.parse(event.body || '{}');
      const result = await toolRegistry.validateToolInput(body.toolId, body.input);
      return response(200, result);
    }

    // ============ CHECKPOINTS ============
    if (path === '/checkpoints/pending' && method === 'GET') {
      const checkpoints = await checkpointService.getPendingCheckpoints(tenantId);
      return response(200, { checkpoints });
    }

    if (path.match(/^\/checkpoints\/[^/]+$/) && method === 'GET') {
      const checkpointId = path.split('/')[2];
      const checkpoint = await checkpointService.getCheckpointById(checkpointId);
      if (!checkpoint) return response(404, { error: 'Checkpoint not found' });
      return response(200, { checkpoint });
    }

    if (path.match(/^\/checkpoints\/[^/]+\/resolve$/) && method === 'POST') {
      const checkpointId = path.split('/')[2];
      const body = JSON.parse(event.body || '{}');
      await checkpointService.resolveCheckpoint(
        checkpointId,
        body.decision as CatoCheckpointDecision,
        body.decidedBy || 'admin',
        body.decidedByUserId,
        body.modifications,
        body.feedback
      );
      return response(200, { success: true });
    }

    if (path === '/checkpoints/config' && method === 'GET') {
      const config = await checkpointService.getConfiguration(tenantId);
      return response(200, { config });
    }

    if (path === '/checkpoints/config' && method === 'PUT') {
      const body = JSON.parse(event.body || '{}');
      const config = await checkpointService.createOrUpdateConfiguration(
        tenantId,
        body.preset,
        body.overrides
      );
      return response(200, { config });
    }

    // ============ COMPENSATION ============
    if (path === '/compensation/pending' && method === 'GET') {
      const compensations = await compensationService.getPendingCompensations(tenantId);
      return response(200, { compensations });
    }

    if (path.match(/^\/compensation\/pipeline\/[^/]+$/) && method === 'GET') {
      const pipelineId = path.split('/')[3];
      const compensations = await compensationService.getCompensationsByPipeline(pipelineId);
      return response(200, { compensations });
    }

    if (path.match(/^\/compensation\/execute\/[^/]+$/) && method === 'POST') {
      const pipelineId = path.split('/')[3];
      const result = await compensationService.executeCompensations(pipelineId, tenantId);
      return response(200, result);
    }

    // ============ MERKLE CHAIN ============
    if (path === '/merkle/verify' && method === 'POST') {
      const body = JSON.parse(event.body || '{}');
      const result = await merkleService.verifyChain(tenantId, body.fromSequence, body.toSequence);
      return response(200, result);
    }

    if (path === '/merkle/latest' && method === 'GET') {
      const entry = await merkleService.getLatestEntry(tenantId);
      return response(200, { entry });
    }

    if (path.match(/^\/merkle\/proof\/\d+$/) && method === 'GET') {
      const sequenceNumber = parseInt(path.split('/')[3]);
      const proof = await merkleService.generateProof(tenantId, sequenceNumber);
      if (!proof) return response(404, { error: 'Entry not found' });
      return response(200, { proof });
    }

    // ============ TEMPLATES ============
    if (path === '/templates' && method === 'GET') {
      const result = await pool.query(
        `SELECT * FROM cato_pipeline_templates WHERE (tenant_id = $1 OR scope = 'SYSTEM') AND enabled = true ORDER BY name`,
        [tenantId]
      );
      return response(200, { templates: result.rows });
    }

    if (path === '/templates' && method === 'POST') {
      const body = JSON.parse(event.body || '{}');
      const result = await pool.query(
        `INSERT INTO cato_pipeline_templates (template_id, tenant_id, name, description, method_chain, checkpoint_positions, default_config, category, tags, scope, enabled)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'TENANT', true) RETURNING *`,
        [
          body.templateId || `template:${body.name.toLowerCase().replace(/\s+/g, '-')}`,
          tenantId,
          body.name,
          body.description,
          body.methodChain,
          JSON.stringify(body.checkpointPositions || {}),
          JSON.stringify(body.defaultConfig || {}),
          body.category || 'custom',
          body.tags || [],
        ]
      );
      return response(201, { template: result.rows[0] });
    }

    // ============ ENVELOPES ============
    if (path.match(/^\/envelopes\/pipeline\/[^/]+$/) && method === 'GET') {
      const pipelineId = path.split('/')[3];
      const result = await pool.query(
        `SELECT * FROM cato_pipeline_envelopes WHERE pipeline_id = $1 ORDER BY sequence`,
        [pipelineId]
      );
      return response(200, { envelopes: result.rows });
    }

    if (path.match(/^\/envelopes\/[^/]+$/) && method === 'GET') {
      const envelopeId = path.split('/')[2];
      const result = await pool.query(
        `SELECT * FROM cato_pipeline_envelopes WHERE envelope_id = $1`,
        [envelopeId]
      );
      if (result.rows.length === 0) return response(404, { error: 'Envelope not found' });
      return response(200, { envelope: result.rows[0] });
    }

    // ============ METRICS ============
    if (path === '/metrics' && method === 'GET') {
      const executions = await pool.query(
        `SELECT 
          COUNT(*) as total_executions,
          COUNT(*) FILTER (WHERE status = 'COMPLETED') as completed,
          COUNT(*) FILTER (WHERE status = 'FAILED') as failed,
          COUNT(*) FILTER (WHERE status = 'RUNNING') as running,
          COUNT(*) FILTER (WHERE status = 'CHECKPOINT_WAITING') as checkpoint_waiting,
          SUM(total_cost_cents) as total_cost_cents,
          AVG(total_duration_ms) as avg_duration_ms
         FROM cato_pipeline_executions WHERE tenant_id = $1 AND started_at > NOW() - INTERVAL '24 hours'`,
        [tenantId]
      );
      
      const checkpoints = await pool.query(
        `SELECT 
          COUNT(*) as total_checkpoints,
          COUNT(*) FILTER (WHERE status = 'PENDING') as pending,
          AVG(decision_time_ms) as avg_decision_time_ms
         FROM cato_checkpoint_decisions WHERE tenant_id = $1 AND triggered_at > NOW() - INTERVAL '24 hours'`,
        [tenantId]
      );

      return response(200, {
        executions: executions.rows[0],
        checkpoints: checkpoints.rows[0],
      });
    }

    return response(404, { error: 'Not found' });
  } catch (error) {
    console.error('Cato Pipeline API Error:', error);
    return response(500, { error: error instanceof Error ? error.message : 'Internal server error' });
  }
};
