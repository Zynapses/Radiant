/**
 * Cortex v2.0 Admin API Lambda Handler
 * Golden Rules, Stub Nodes, Telemetry, Entrance Exams, Graph Expansion, Model Migration
 */

import { APIGatewayProxyHandler, APIGatewayProxyResult, APIGatewayProxyEvent } from 'aws-lambda';
import { GoldenRulesService } from '../shared/services/cortex/golden-rules.service';
import { StubNodesService } from '../shared/services/cortex/stub-nodes.service';
import { TelemetryService } from '../shared/services/cortex/telemetry.service';
import { EntranceExamService } from '../shared/services/cortex/entrance-exam.service';
import { GraphExpansionService } from '../shared/services/cortex/graph-expansion.service';
import { ModelMigrationService } from '../shared/services/cortex/model-migration.service';
import { getDbClient, getRedisClient } from '../shared/db/connections';
import { extractAuthContext } from '../shared/auth';

const db = getDbClient();
const redis = getRedisClient();

// Create Redis adapter for TelemetryService matching RedisClient interface
const redisAdapter = {
  get: async (key: string): Promise<string | null> => redis.get(key),
  set: async (key: string, value: string, options?: { EX?: number }): Promise<void> => {
    if (options?.EX) {
      await redis.set(key, value, 'EX', options.EX);
    } else {
      await redis.set(key, value);
    }
  },
  hSet: async (key: string, field: string, value: string): Promise<void> => { await redis.hset(key, field, value); },
  hGetAll: async (key: string): Promise<Record<string, string>> => redis.hgetall(key),
};

// Extract auth context from event
function extractTenantId(event: APIGatewayProxyEvent): string {
  try {
    const auth = extractAuthContext(event);
    return auth.tenantId;
  } catch {
    return '';
  }
}
function extractUserId(event: APIGatewayProxyEvent): string {
  try {
    const auth = extractAuthContext(event);
    return auth.userId;
  } catch {
    return '';
  }
}

const goldenRulesService = new GoldenRulesService(db);
const stubNodesService = new StubNodesService(db);
const telemetryService = new TelemetryService(db, redisAdapter);
const entranceExamService = new EntranceExamService(db);
const graphExpansionService = new GraphExpansionService(db);
const modelMigrationService = new ModelMigrationService(db);

export const handler: APIGatewayProxyHandler = async (event): Promise<APIGatewayProxyResult> => {
  const tenantId = extractTenantId(event);
  const userId = extractUserId(event);
  const path = event.path.replace('/api/admin/cortex/v2', '');
  const method = event.httpMethod;

  try {
    // =========================================================================
    // Golden Rules Endpoints
    // =========================================================================
    
    if (path === '/golden-rules' && method === 'GET') {
      const activeOnly = event.queryStringParameters?.activeOnly === 'true';
      const ruleType = event.queryStringParameters?.ruleType as any;
      const rules = await goldenRulesService.listRules(tenantId, { activeOnly, ruleType });
      return jsonResponse(rules);
    }

    if (path === '/golden-rules' && method === 'POST') {
      const body = JSON.parse(event.body || '{}');
      const rule = await goldenRulesService.createRule({ ...body, tenantId }, userId);
      return jsonResponse(rule, 201);
    }

    if (path.match(/^\/golden-rules\/[^/]+$/) && method === 'DELETE') {
      const ruleId = path.split('/')[2];
      const body = JSON.parse(event.body || '{}');
      await goldenRulesService.deactivateRule(tenantId, ruleId, userId, body.reason || 'Deactivated');
      return jsonResponse({ success: true });
    }

    if (path === '/golden-rules/check' && method === 'POST') {
      const body = JSON.parse(event.body || '{}');
      const match = await goldenRulesService.checkMatch(tenantId, body.query, body.entityId);
      return jsonResponse({ match });
    }

    // =========================================================================
    // Chain of Custody Endpoints
    // =========================================================================

    if (path.match(/^\/chain-of-custody\/[^/]+$/) && method === 'GET') {
      const factId = path.split('/')[2];
      const custody = await goldenRulesService.getChainOfCustody(factId, tenantId);
      return jsonResponse({ custody });
    }

    if (path.match(/^\/chain-of-custody\/[^/]+\/verify$/) && method === 'POST') {
      const factId = path.split('/')[2];
      const custody = await goldenRulesService.verifyFact(factId, tenantId, userId);
      return jsonResponse({ custody });
    }

    if (path.match(/^\/chain-of-custody\/[^/]+\/audit-trail$/) && method === 'GET') {
      const factId = path.split('/')[2];
      const trail = await goldenRulesService.getAuditTrail(factId);
      return jsonResponse({ auditTrail: trail });
    }

    // =========================================================================
    // Stub Nodes Endpoints
    // =========================================================================

    if (path === '/stub-nodes' && method === 'GET') {
      const mountId = event.queryStringParameters?.mountId;
      const format = event.queryStringParameters?.format as any;
      const limit = parseInt(event.queryStringParameters?.limit || '50');
      const nodes = await stubNodesService.listStubNodes(tenantId, { mountId, format, limit });
      return jsonResponse(nodes);
    }

    if (path.match(/^\/stub-nodes\/[^/]+$/) && method === 'GET') {
      const stubNodeId = path.split('/')[2];
      const node = await stubNodesService.getStubNode(stubNodeId, tenantId);
      return jsonResponse({ stubNode: node });
    }

    if (path.match(/^\/stub-nodes\/[^/]+\/fetch$/) && method === 'POST') {
      const stubNodeId = path.split('/')[2];
      const body = JSON.parse(event.body || '{}');
      const response = await stubNodesService.fetchContent({
        tenantId,
        stubNodeId,
        range: body.range,
        ttlSeconds: body.ttlSeconds,
      });
      return jsonResponse(response);
    }

    if (path.match(/^\/stub-nodes\/[^/]+\/connect$/) && method === 'POST') {
      const stubNodeId = path.split('/')[2];
      const body = JSON.parse(event.body || '{}');
      await stubNodesService.connectToGraphNodes(stubNodeId, body.graphNodeIds, tenantId);
      return jsonResponse({ success: true });
    }

    if (path.match(/^\/stub-nodes\/[^/]+\/metadata$/) && method === 'POST') {
      const stubNodeId = path.split('/')[2];
      const metadata = await stubNodesService.extractMetadata(stubNodeId, tenantId);
      return jsonResponse({ metadata });
    }

    if (path === '/stub-nodes/scan' && method === 'POST') {
      const body = JSON.parse(event.body || '{}');
      const result = await stubNodesService.scanMount(body.mountId, tenantId);
      return jsonResponse(result);
    }

    // =========================================================================
    // Telemetry Feed Endpoints
    // =========================================================================

    if (path === '/telemetry/feeds' && method === 'GET') {
      const activeOnly = event.queryStringParameters?.activeOnly === 'true';
      const protocol = event.queryStringParameters?.protocol as any;
      const feeds = await telemetryService.listFeeds(tenantId, { activeOnly, protocol });
      return jsonResponse(feeds);
    }

    if (path === '/telemetry/feeds' && method === 'POST') {
      const body = JSON.parse(event.body || '{}');
      const feed = await telemetryService.createFeed({ ...body, tenantId });
      return jsonResponse(feed, 201);
    }

    if (path.match(/^\/telemetry\/feeds\/[^/]+$/) && method === 'GET') {
      const feedId = path.split('/')[3];
      const feed = await telemetryService.getFeed(feedId, tenantId);
      return jsonResponse({ feed });
    }

    if (path.match(/^\/telemetry\/feeds\/[^/]+$/) && method === 'PATCH') {
      const feedId = path.split('/')[3];
      const body = JSON.parse(event.body || '{}');
      const feed = await telemetryService.updateFeed(feedId, tenantId, body);
      return jsonResponse(feed);
    }

    if (path.match(/^\/telemetry\/feeds\/[^/]+$/) && method === 'DELETE') {
      const feedId = path.split('/')[3];
      await telemetryService.deleteFeed(feedId, tenantId);
      return jsonResponse({ success: true });
    }

    if (path.match(/^\/telemetry\/feeds\/[^/]+\/start$/) && method === 'POST') {
      const feedId = path.split('/')[3];
      await telemetryService.startFeed(feedId, tenantId);
      return jsonResponse({ success: true });
    }

    if (path.match(/^\/telemetry\/feeds\/[^/]+\/stop$/) && method === 'POST') {
      const feedId = path.split('/')[3];
      await telemetryService.stopFeed(feedId, tenantId);
      return jsonResponse({ success: true });
    }

    if (path.match(/^\/telemetry\/feeds\/[^/]+\/snapshot$/) && method === 'GET') {
      const feedId = path.split('/')[3];
      const snapshot = await telemetryService.getSnapshot(feedId, tenantId);
      return jsonResponse({ snapshot });
    }

    if (path.match(/^\/telemetry\/feeds\/[^/]+\/history$/) && method === 'GET') {
      const feedId = path.split('/')[3];
      const nodeId = event.queryStringParameters?.nodeId;
      const limit = parseInt(event.queryStringParameters?.limit || '100');
      const history = await telemetryService.getHistory(feedId, tenantId, { nodeId, limit });
      return jsonResponse(history);
    }

    if (path === '/telemetry/context-injection' && method === 'GET') {
      const snapshots = await telemetryService.getContextInjectionData(tenantId);
      return jsonResponse({ snapshots });
    }

    if (path === '/telemetry/data' && method === 'POST') {
      const body = JSON.parse(event.body || '{}');
      await telemetryService.recordDataPoint({ ...body, tenantId });
      return jsonResponse({ success: true }, 201);
    }

    if (path === '/telemetry/data/batch' && method === 'POST') {
      const body = JSON.parse(event.body || '{}');
      const result = await telemetryService.recordBatch(body.dataPoints);
      return jsonResponse(result, 201);
    }

    // =========================================================================
    // Entrance Exam Endpoints
    // =========================================================================

    if (path === '/exams' && method === 'GET') {
      const status = event.queryStringParameters?.status as any;
      const domainId = event.queryStringParameters?.domainId;
      const exams = await entranceExamService.listExams(tenantId, { status, domainId });
      return jsonResponse(exams);
    }

    if (path === '/exams' && method === 'POST') {
      const body = JSON.parse(event.body || '{}');
      const exam = await entranceExamService.generateExam({ ...body, tenantId });
      return jsonResponse(exam, 201);
    }

    if (path.match(/^\/exams\/[^/]+$/) && method === 'GET') {
      const examId = path.split('/')[2];
      const exam = await entranceExamService.getExam(examId, tenantId);
      return jsonResponse({ exam });
    }

    if (path.match(/^\/exams\/[^/]+\/start$/) && method === 'POST') {
      const examId = path.split('/')[2];
      const exam = await entranceExamService.startExam(examId, userId);
      return jsonResponse(exam);
    }

    if (path.match(/^\/exams\/[^/]+\/submit$/) && method === 'POST') {
      const examId = path.split('/')[2];
      const body = JSON.parse(event.body || '{}');
      await entranceExamService.submitAnswer({ examId, ...body });
      return jsonResponse({ success: true });
    }

    if (path.match(/^\/exams\/[^/]+\/complete$/) && method === 'POST') {
      const examId = path.split('/')[2];
      const result = await entranceExamService.completeExam(examId, tenantId, userId);
      return jsonResponse(result);
    }

    // =========================================================================
    // Graph Expansion Endpoints
    // =========================================================================

    if (path === '/graph-expansion/tasks' && method === 'GET') {
      const status = event.queryStringParameters?.status as any;
      const taskType = event.queryStringParameters?.taskType as any;
      const tasks = await graphExpansionService.listTasks(tenantId, { status, taskType });
      return jsonResponse(tasks);
    }

    if (path === '/graph-expansion/tasks' && method === 'POST') {
      const body = JSON.parse(event.body || '{}');
      const task = await graphExpansionService.createTask({ ...body, tenantId });
      return jsonResponse(task, 201);
    }

    if (path.match(/^\/graph-expansion\/tasks\/[^/]+$/) && method === 'GET') {
      const taskId = path.split('/')[3];
      const task = await graphExpansionService.getTask(taskId, tenantId);
      return jsonResponse({ task });
    }

    if (path.match(/^\/graph-expansion\/tasks\/[^/]+\/run$/) && method === 'POST') {
      const taskId = path.split('/')[3];
      const task = await graphExpansionService.runTask(taskId, tenantId);
      return jsonResponse(task);
    }

    if (path === '/graph-expansion/pending-links' && method === 'GET') {
      const limit = parseInt(event.queryStringParameters?.limit || '50');
      const links = await graphExpansionService.getPendingLinks(tenantId, limit);
      return jsonResponse(links);
    }

    if (path.match(/^\/graph-expansion\/links\/[^/]+\/approve$/) && method === 'POST') {
      const linkId = path.split('/')[3];
      await graphExpansionService.approveLink(linkId, tenantId, userId);
      return jsonResponse({ success: true });
    }

    if (path.match(/^\/graph-expansion\/links\/[^/]+\/reject$/) && method === 'POST') {
      const linkId = path.split('/')[3];
      await graphExpansionService.rejectLink(linkId, tenantId);
      return jsonResponse({ success: true });
    }

    if (path === '/graph-expansion/patterns' && method === 'GET') {
      const patternType = event.queryStringParameters?.patternType as any;
      const patterns = await graphExpansionService.getPatterns(tenantId, patternType);
      return jsonResponse(patterns);
    }

    // =========================================================================
    // Model Migration Endpoints
    // =========================================================================

    if (path === '/model-migrations' && method === 'GET') {
      const status = event.queryStringParameters?.status as any;
      const migrations = await modelMigrationService.listMigrations(tenantId, { status });
      return jsonResponse(migrations);
    }

    if (path === '/model-migrations' && method === 'POST') {
      const body = JSON.parse(event.body || '{}');
      const migration = await modelMigrationService.initiateMigration({ ...body, tenantId });
      return jsonResponse(migration, 201);
    }

    if (path === '/model-migrations/supported-models' && method === 'GET') {
      const models = modelMigrationService.getSupportedModels();
      return jsonResponse(models);
    }

    if (path.match(/^\/model-migrations\/[^/]+$/) && method === 'GET') {
      const migrationId = path.split('/')[2];
      const migration = await modelMigrationService.getMigration(migrationId, tenantId);
      return jsonResponse({ migration });
    }

    if (path.match(/^\/model-migrations\/[^/]+\/validate$/) && method === 'POST') {
      const migrationId = path.split('/')[2];
      const validation = await modelMigrationService.validateMigration(migrationId, tenantId);
      return jsonResponse(validation);
    }

    if (path.match(/^\/model-migrations\/[^/]+\/test$/) && method === 'POST') {
      const migrationId = path.split('/')[2];
      const results = await modelMigrationService.runTests(migrationId, tenantId);
      return jsonResponse({ testResults: results });
    }

    if (path.match(/^\/model-migrations\/[^/]+\/execute$/) && method === 'POST') {
      const migrationId = path.split('/')[2];
      const migration = await modelMigrationService.executeMigration(migrationId, tenantId);
      return jsonResponse(migration);
    }

    if (path.match(/^\/model-migrations\/[^/]+\/rollback$/) && method === 'POST') {
      const migrationId = path.split('/')[2];
      const migration = await modelMigrationService.rollbackMigration(migrationId, tenantId);
      return jsonResponse(migration);
    }

    // =========================================================================
    // Not Found
    // =========================================================================

    return errorResponse(404, `Endpoint not found: ${method} ${path}`);

  } catch (error) {
    // Error already logged by handler
    return errorResponse(500, (error as Error).message);
  }
};

function jsonResponse(data: unknown, statusCode = 200): APIGatewayProxyResult {
  return {
    statusCode,
    headers: corsHeaders,
    body: JSON.stringify(data),
  };
}

function errorResponse(statusCode: number, message: string): APIGatewayProxyResult {
  return {
    statusCode,
    headers: corsHeaders,
    body: JSON.stringify({ error: message }),
  };
}

const corsHeaders = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type,Authorization,X-Tenant-ID',
  'Access-Control-Allow-Methods': 'GET,POST,PATCH,DELETE,OPTIONS',
};
