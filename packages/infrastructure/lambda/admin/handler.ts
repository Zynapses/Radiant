/**
 * Admin Lambda Handler
 */

import type { APIGatewayProxyEvent, APIGatewayProxyResult, Context } from 'aws-lambda';
import { Logger } from '../shared/logger';
import { successResponse, errorResponse } from '../shared/response';
import { UnauthorizedError, NotFoundError, ValidationError, ForbiddenError } from '../shared/errors';
import { notFoundResponse } from '../shared/utils/response';
import { extractAuthContext, requireAdmin } from '../shared/auth';
import { MINIMAL_CONTEXT, NOOP_CALLBACK } from '../shared/lambda-context';
import {
  listTenants,
  getTenantById,
  createTenant,
  listUsersByTenant,
  listAdministrators,
  getAdministratorById,
  listPendingInvitations,
  listPendingApprovalRequests,
  listAuditLogs,
  getUsageStats,
  listModels,
  listProviders,
  createAuditLog,
} from '../shared/db';

const logger = new Logger({ handler: 'admin' });

export async function handler(
  event: APIGatewayProxyEvent,
  context: Context
): Promise<APIGatewayProxyResult> {
  const requestId = event.requestContext.requestId;
  logger.setRequestId(requestId);

  const startTime = Date.now();
  const method = event.httpMethod;
  const path = event.path;

  logger.info('Admin request received', { method, path, requestId });

  try {
    const auth = extractAuthContext(event);
    requireAdmin(auth);
    
    logger.setUserId(auth.userId);

    await createAuditLog({
      actor_id: auth.userId,
      actor_type: 'admin',
      action: `${method} ${path}`,
      resource_type: 'admin_api',
      details: {
        path,
        method,
        ip: event.requestContext.identity?.sourceIp,
      },
      ip_address: event.requestContext.identity?.sourceIp,
      user_agent: event.headers['User-Agent'] || event.headers['user-agent'],
    });

    const result = await routeRequest(event, auth, context);

    logger.info('Admin request completed', {
      method,
      path,
      statusCode: result.statusCode,
      durationMs: Date.now() - startTime,
    });

    return result;
  } catch (error) {
    logger.error('Admin request failed', error as Error, {
      method,
      path,
      durationMs: Date.now() - startTime,
    });

    return errorResponse(error as Error);
  }
}

/**
 * Helper: invoke a legacy callback-style handler consistently.
 * Awaits the result and falls back to 404 if the handler returns void/undefined.
 */
async function invokeLegacy(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  fn: (...args: any[]) => any,
  event: APIGatewayProxyEvent,
): Promise<APIGatewayProxyResult> {
  const result = await fn(event, MINIMAL_CONTEXT, NOOP_CALLBACK);
  return (result || notFoundResponse()) as APIGatewayProxyResult;
}

async function routeRequest(
  event: APIGatewayProxyEvent,
  auth: { userId: string; isSuperAdmin: boolean },
  context: Context
): Promise<APIGatewayProxyResult> {
  const method = event.httpMethod;
  const path = event.path;
  const pathParts = path.split('/').filter(Boolean);

  if (pathParts[1] === 'health') {
    return handleHealth();
  }

  if (pathParts[1] === 'dashboard') {
    return handleDashboard();
  }

  if (pathParts[1] === 'tenants') {
    return handleTenants(event, method, pathParts[2]);
  }

  if (pathParts[1] === 'users') {
    return handleUsers(event, method, pathParts[2]);
  }

  if (pathParts[1] === 'administrators') {
    return handleAdministrators(event, method, pathParts[2]);
  }

  if (pathParts[1] === 'invitations') {
    return handleInvitations(event, method);
  }

  if (pathParts[1] === 'approvals') {
    return handleApprovals(event, method, pathParts[2], pathParts[3]);
  }

  if (pathParts[1] === 'billing') {
    return handleBilling(event, pathParts[2]);
  }

  if (pathParts[1] === 'audit-logs') {
    return handleAuditLogs(event);
  }

  if (pathParts[1] === 'models') {
    return handleModels(event, method, pathParts[2]);
  }

  if (pathParts[1] === 'providers') {
    return handleProviders(event, method, pathParts[2]);
  }

  // Compliance - delegate to dedicated handlers
  if (pathParts[1] === 'compliance') {
    if (pathParts[2] === 'checklists') {
      const { handler: checklistHandler } = await import('./checklist-registry.js');
      return checklistHandler(event);
    }
    if (pathParts[2] === 'regulatory-standards') {
      const mod = await import('./regulatory-standards.js');
      return mod.handler(event, MINIMAL_CONTEXT, NOOP_CALLBACK) as Promise<APIGatewayProxyResult>;
    }
    if (pathParts[2] === 'self-audit') {
      const mod = await import('./self-audit.js');
      const result = await mod.getDashboard(event, MINIMAL_CONTEXT, NOOP_CALLBACK);
      return (result || notFoundResponse()) as APIGatewayProxyResult;
    }
  }

  // Security - delegate to dedicated handlers
  if (pathParts[1] === 'security') {
    if (pathParts[2] === 'schedules') {
      const mod = await import('./security-schedules.js');
      return mod.handler(event, MINIMAL_CONTEXT, NOOP_CALLBACK) as Promise<APIGatewayProxyResult>;
    }
    const mod = await import('./security.js');
    return mod.handler(event, MINIMAL_CONTEXT, NOOP_CALLBACK) as Promise<APIGatewayProxyResult>;
  }

  // System configuration and health
  if (pathParts[1] === 'system') {
    if (pathParts[2] === 'health' || pathParts[2] === 'gateway') {
      const mod = await import('./system-health.js');
      return mod.handler(event) as Promise<APIGatewayProxyResult>;
    }
    if (pathParts[2] === 'config') {
      const mod = await import('./system-config.js');
      return mod.handler(event) as Promise<APIGatewayProxyResult>;
    }
    const mod = await import('./system.js');
    return mod.handler(event) as Promise<APIGatewayProxyResult>;
  }

  // Service API Keys (v5.1.1)
  if (pathParts[1] === 'service-api-keys') {
    const mod = await import('./api-keys-v51.js');
    return mod.handler(event) as Promise<APIGatewayProxyResult>;
  }

  // SSO Connections
  if (pathParts[1] === 'sso-connections') {
    const mod = await import('./sso-connections.js');
    return mod.handler(event) as Promise<APIGatewayProxyResult>;
  }

  // Cortex Graph-RAG
  if (pathParts[1] === 'cortex') {
    const mod = await import('./cortex-graph-rag.js');
    return mod.handler(event) as Promise<APIGatewayProxyResult>;
  }

  // OAuth Apps
  if (pathParts[1] === 'oauth') {
    const mod = await import('./oauth-apps.js');
    return mod.handler(event) as Promise<APIGatewayProxyResult>;
  }

  // Time Machine
  if (pathParts[1] === 'time-machine') {
    const { handler: timeMachineHandler } = await import('./time-machine.js');
    return timeMachineHandler(event);
  }

  // Orchestration methods
  if (pathParts[1] === 'orchestration' && pathParts[2] === 'methods') {
    const { handler: methodsHandler } = await import('./orchestration-methods.js');
    return methodsHandler(event);
  }

  // Pricing
  if (pathParts[1] === 'pricing') {
    const { handler: pricingHandler } = await import('./pricing.js');
    return pricingHandler(event);
  }

  // AWS costs
  if (pathParts[1] === 'aws-costs') {
    const { handler: awsCostsHandler } = await import('./aws-costs.js');
    return awsCostsHandler(event);
  }

  // Spend Governor & Critical Alerts (v7.39.0)
  if (pathParts[1] === 'spend-governor' || pathParts[1] === 'critical-alerts') {
    const { handler: spendGovernorHandler } = await import('./spend-governor.js');
    return spendGovernorHandler(event);
  }

  // Intrusion Detection (v7.40.0 — RIDPS)
  if (pathParts[1] === 'intrusion-detection') {
    const { handleIntrusionDetection } = await import('./intrusion-detection.js');
    return handleIntrusionDetection(event);
  }

  // Data Lake (v7.42.0)
  if (pathParts[1] === 'data-lake') {
    const { handleDataLake } = await import('./data-lake.js');
    return handleDataLake(event);
  }

  // Tenant Settings (v7.43.0 — Unified tenant profile/settings)
  if (pathParts[1] === 'tenant-settings') {
    const { handler: tenantSettingsHandler } = await import('./tenant-settings.js');
    return tenantSettingsHandler(event);
  }

  // Conversation Export (v7.43.0 — Export chat history)
  if (pathParts[1] === 'conversation-export') {
    return await handleConversationExport(event);
  }

  // Ethics
  if (pathParts[1] === 'ethics') {
    const { handler: ethicsHandler } = await import('./ethics.js');
    return ethicsHandler(event);
  }

  // Specialty rankings
  if (pathParts[1] === 'specialty-rankings') {
    const { handler: rankingsHandler } = await import('./specialty-rankings.js');
    return rankingsHandler(event);
  }

  // AGI learning
  if (pathParts[1] === 'agi-learning') {
    const { handler: agiLearningHandler } = await import('./agi-learning.js');
    return agiLearningHandler(event);
  }

  // Internet learning
  if (pathParts[1] === 'internet-learning') {
    const { handler: internetLearningHandler } = await import('./internet-learning.js');
    return internetLearningHandler(event);
  }

  // Enhanced learning
  if (pathParts[1] === 'enhanced-learning') {
    const mod = await import('./enhanced-learning.js');
    const result = await mod.getConfig(event, MINIMAL_CONTEXT, NOOP_CALLBACK);
    return (result || notFoundResponse()) as APIGatewayProxyResult;
  }

  // Logs (AWS logs)
  if (pathParts[1] === 'logs') {
    const { handler: logsHandler } = await import('./logs.js');
    return logsHandler(event);
  }

  // Consciousness
  if (pathParts[1] === 'consciousness') {
    if (pathParts[2] === 'engine') {
      const mod = await import('./consciousness-engine.js');
      const result = await mod.getDashboard(event, MINIMAL_CONTEXT, NOOP_CALLBACK);
      return (result || notFoundResponse()) as APIGatewayProxyResult;
    }
    if (pathParts[2] === 'evolution') {
      const mod = await import('./consciousness-evolution.js');
      const result = await mod.getPredictionMetrics(event, MINIMAL_CONTEXT, NOOP_CALLBACK);
      return (result || notFoundResponse()) as APIGatewayProxyResult;
    }
    const mod = await import('./consciousness.js');
    const result = await mod.getConsciousnessMetrics(event, MINIMAL_CONTEXT, NOOP_CALLBACK);
    return (result || notFoundResponse()) as APIGatewayProxyResult;
  }

  // Ego system
  if (pathParts[1] === 'ego') {
    const mod = await import('./ego.js');
    const result = await mod.getEgoDashboard(event, MINIMAL_CONTEXT, NOOP_CALLBACK);
    return (result || notFoundResponse()) as APIGatewayProxyResult;
  }

  // Formal reasoning
  if (pathParts[1] === 'formal-reasoning') {
    const mod = await import('./formal-reasoning.js');
    return mod.handler(event, MINIMAL_CONTEXT, NOOP_CALLBACK) as Promise<APIGatewayProxyResult>;
  }

  // Domain ethics
  if (pathParts[1] === 'domain-ethics') {
    const mod = await import('./domain-ethics.js');
    const result = await mod.listFrameworks(event, MINIMAL_CONTEXT, NOOP_CALLBACK);
    return (result || notFoundResponse()) as APIGatewayProxyResult;
  }

  // Ethics-free reasoning
  if (pathParts[1] === 'ethics-free-reasoning') {
    const mod = await import('./ethics-free-reasoning.js');
    return mod.handler(event, MINIMAL_CONTEXT, NOOP_CALLBACK) as Promise<APIGatewayProxyResult>;
  }

  // Cato services (unified block — genesis, dialogue, global, and catch-all)
  if (pathParts[1] === 'cato') {
    if (pathParts[2] === 'genesis') {
      const mod = await import('./cato-genesis.js');
      return mod.handler(event, MINIMAL_CONTEXT, NOOP_CALLBACK) as Promise<APIGatewayProxyResult>;
    }
    if (pathParts[2] === 'dialogue') {
      const mod = await import('./cato-dialogue.js');
      const result = await mod.dialogue(event, MINIMAL_CONTEXT, NOOP_CALLBACK);
      return (result || notFoundResponse()) as APIGatewayProxyResult;
    }
    if (pathParts[2] === 'global') {
      const mod = await import('./cato-global.js');
      return mod.handler(event, MINIMAL_CONTEXT, NOOP_CALLBACK) as Promise<APIGatewayProxyResult>;
    }
    if (pathParts[2] === 'governance') {
      const mod = await import('./cato-governance.js');
      return mod.handler(event, MINIMAL_CONTEXT, NOOP_CALLBACK) as Promise<APIGatewayProxyResult>;
    }
    if (pathParts[2] === 'pipeline') {
      const mod = await import('./cato-pipeline.js');
      return mod.handler(event, MINIMAL_CONTEXT, NOOP_CALLBACK) as Promise<APIGatewayProxyResult>;
    }
    if (pathParts[2] === 'twilight') {
      const mod = await import('./cato-twilight.js');
      return invokeLegacy(mod.getDashboard, event);
    }
    if (pathParts[2] === 'council') {
      const mod = await import('./council.js');
      const result = await mod.handler(event, MINIMAL_CONTEXT, NOOP_CALLBACK);
      return (result || notFoundResponse()) as APIGatewayProxyResult;
    }
    // Catch-all for other cato sub-routes
    const mod = await import('./cato.js');
    return mod.handler(event, context) as Promise<APIGatewayProxyResult>;
  }

  // Model Registry v5.52.57 - Model Version Discovery & Lifecycle
  if (pathParts[1] === 'model-registry') {
    const { handler: modelRegistryHandler } = await import('./model-registry.js');
    return modelRegistryHandler(event);
  }

  // Model coordination
  if (pathParts[1] === 'model-coordination') {
    const mod = await import('./model-coordination.js');
    const result = await mod.getSyncConfig(event, MINIMAL_CONTEXT, NOOP_CALLBACK);
    return (result || notFoundResponse()) as APIGatewayProxyResult;
  }

  // Model proficiency
  if (pathParts[1] === 'model-proficiency') {
    const mod = await import('./model-proficiency.js');
    const result = await mod.getAllRankings(event, MINIMAL_CONTEXT, NOOP_CALLBACK);
    return (result || notFoundResponse()) as APIGatewayProxyResult;
  }

  // Infrastructure tier
  if (pathParts[1] === 'infrastructure-tier') {
    const mod = await import('./infrastructure-tier.js');
    return mod.handler(event, MINIMAL_CONTEXT, NOOP_CALLBACK) as Promise<APIGatewayProxyResult>;
  }

  // Library registry
  if (pathParts[1] === 'library-registry') {
    const mod = await import('./library-registry.js');
    return mod.handler(event, MINIMAL_CONTEXT, NOOP_CALLBACK) as Promise<APIGatewayProxyResult>;
  }

  // Inference components
  if (pathParts[1] === 'inference-components') {
    const mod = await import('./inference-components.js');
    const result = await mod.getConfig(event, MINIMAL_CONTEXT, NOOP_CALLBACK);
    return (result || notFoundResponse()) as APIGatewayProxyResult;
  }

  // User Registry - assignments, consent, DSAR, break glass, legal hold
  if (pathParts[1] === 'user-registry') {
    const { handler: userRegistryHandler } = await import('./user-registry.js');
    return userRegistryHandler(event);
  }

  // Brain v6.0.4 - AGI Brain admin
  if (pathParts[1] === 'brain') {
    if (pathParts[2] === 'ecd') {
      const { handler: ecdHandler } = await import('./ecd.js');
      return (await ecdHandler(event, MINIMAL_CONTEXT, NOOP_CALLBACK)) as APIGatewayProxyResult;
    }
    const { handler: brainHandler } = await import('./brain.js');
    return brainHandler(event);
  }

  // Metrics & Learning
  if (pathParts[1] === 'metrics') {
    const { handler: metricsHandler } = await import('./metrics.js');
    return metricsHandler(event);
  }

  // Translation middleware
  if (pathParts[1] === 'translation') {
    const { handler: translationHandler } = await import('./translation.js');
    return translationHandler(event);
  }

  // Localization Registry - Translation management with tenant overrides
  if (pathParts[1] === 'localization') {
    const mod = await import('./localization-registry.js');
    const subRoute = pathParts[2];
    const resourceId = pathParts[3];
    const action = pathParts[4];
    
    // Registry entries
    if (!subRoute || subRoute === 'registry') {
      if (method === 'GET' && !resourceId) {
        return mod.listRegistry(event, MINIMAL_CONTEXT, NOOP_CALLBACK) as Promise<APIGatewayProxyResult>;
      }
      if (method === 'GET' && resourceId) {
        event.pathParameters = { ...event.pathParameters, id: resourceId };
        return mod.getRegistryEntry(event, MINIMAL_CONTEXT, NOOP_CALLBACK) as Promise<APIGatewayProxyResult>;
      }
    }
    
    // Tenant translation overrides
    if (subRoute === 'overrides') {
      if (method === 'GET') {
        return mod.listOverrides(event, MINIMAL_CONTEXT, NOOP_CALLBACK) as Promise<APIGatewayProxyResult>;
      }
      if (method === 'POST') {
        return mod.upsertOverride(event, MINIMAL_CONTEXT, NOOP_CALLBACK) as Promise<APIGatewayProxyResult>;
      }
      if (method === 'DELETE' && resourceId) {
        event.pathParameters = { ...event.pathParameters, id: resourceId };
        return mod.deleteOverride(event, MINIMAL_CONTEXT, NOOP_CALLBACK) as Promise<APIGatewayProxyResult>;
      }
      if (method === 'PATCH' && resourceId && action === 'protection') {
        event.pathParameters = { ...event.pathParameters, id: resourceId };
        return mod.toggleProtection(event, MINIMAL_CONTEXT, NOOP_CALLBACK) as Promise<APIGatewayProxyResult>;
      }
    }
    
    // Translation bundles
    if (subRoute === 'bundle') {
      event.pathParameters = { ...event.pathParameters, languageCode: resourceId || 'en' };
      return mod.getBundle(event, MINIMAL_CONTEXT, NOOP_CALLBACK) as Promise<APIGatewayProxyResult>;
    }
    
    // Tenant localization config
    if (subRoute === 'config') {
      if (method === 'GET') {
        return mod.getConfig(event, MINIMAL_CONTEXT, NOOP_CALLBACK) as Promise<APIGatewayProxyResult>;
      }
      if (method === 'PUT') {
        return mod.updateConfig(event, MINIMAL_CONTEXT, NOOP_CALLBACK) as Promise<APIGatewayProxyResult>;
      }
    }
    
    // Statistics
    if (subRoute === 'stats') {
      return mod.getStats(event, MINIMAL_CONTEXT, NOOP_CALLBACK) as Promise<APIGatewayProxyResult>;
    }
  }

  // Cognition v6.1.0 - Advanced Cognition Services
  if (pathParts[1] === 'cognition') {
    const { handler: cognitionHandler } = await import('./cognition.js');
    return cognitionHandler(event);
  }

  // Empiricism Loop - Reality-testing circuit for consciousness
  if (pathParts[1] === 'empiricism') {
    const { handler: empiricismHandler } = await import('./empiricism-loop.js');
    return empiricismHandler(event);
  }

  // LoRA Adapters - Tri-layer adapter management
  if (pathParts[1] === 'lora') {
    const { handler: loraHandler } = await import('./lora-adapters.js');
    return loraHandler(event);
  }

  // AI Reports v5.42.0 - AI Report Writer
  if (pathParts[1] === 'ai-reports') {
    const { handler: aiReportsHandler } = await import('./ai-reports.js');
    return aiReportsHandler(event);
  }

  // PostgreSQL Scaling - Database infrastructure monitoring
  if (pathParts[1] === 'scaling') {
    const mod = await import('./postgresql-scaling.js');
    const subRoute = pathParts[2];
    const action = pathParts[3];
    
    // Dashboard overview
    if (!subRoute || subRoute === 'dashboard') {
      return mod.getDashboard(event, MINIMAL_CONTEXT, NOOP_CALLBACK) as Promise<APIGatewayProxyResult>;
    }
    
    // Connection pool metrics
    if (subRoute === 'connections') {
      return mod.getConnectionMetrics(event, MINIMAL_CONTEXT, NOOP_CALLBACK) as Promise<APIGatewayProxyResult>;
    }
    
    // Queue status
    if (subRoute === 'queues') {
      if (method === 'GET') {
        return mod.getQueueStatus(event, MINIMAL_CONTEXT, NOOP_CALLBACK) as Promise<APIGatewayProxyResult>;
      }
      if (method === 'POST' && action === 'retry-failed') {
        return mod.retryFailedBatchWrites(event, MINIMAL_CONTEXT, NOOP_CALLBACK) as Promise<APIGatewayProxyResult>;
      }
      if (method === 'DELETE' && action === 'clear-completed') {
        return mod.clearCompletedBatchWrites(event, MINIMAL_CONTEXT, NOOP_CALLBACK) as Promise<APIGatewayProxyResult>;
      }
    }
    
    // Replica health
    if (subRoute === 'replicas') {
      return mod.getReplicaHealth(event, MINIMAL_CONTEXT, NOOP_CALLBACK) as Promise<APIGatewayProxyResult>;
    }
    
    // Partition statistics
    if (subRoute === 'partitions') {
      if (method === 'GET') {
        return mod.getPartitionStats(event, MINIMAL_CONTEXT, NOOP_CALLBACK) as Promise<APIGatewayProxyResult>;
      }
      if (method === 'POST' && action === 'ensure-future') {
        return mod.ensureFuturePartitions(event, MINIMAL_CONTEXT, NOOP_CALLBACK) as Promise<APIGatewayProxyResult>;
      }
    }
    
    // Slow query analysis
    if (subRoute === 'slow-queries') {
      return mod.getSlowQueries(event, MINIMAL_CONTEXT, NOOP_CALLBACK) as Promise<APIGatewayProxyResult>;
    }
    
    // Index health
    if (subRoute === 'indexes') {
      if (action === 'suggestions') {
        return mod.getIndexSuggestions(event, MINIMAL_CONTEXT, NOOP_CALLBACK) as Promise<APIGatewayProxyResult>;
      }
      return mod.getIndexHealth(event, MINIMAL_CONTEXT, NOOP_CALLBACK) as Promise<APIGatewayProxyResult>;
    }
    
    // Materialized views
    if (subRoute === 'materialized-views') {
      if (method === 'GET') {
        return mod.getMaterializedViewStatus(event, MINIMAL_CONTEXT, NOOP_CALLBACK) as Promise<APIGatewayProxyResult>;
      }
      if (method === 'POST' && action === 'refresh') {
        return mod.triggerMaterializedViewRefresh(event, MINIMAL_CONTEXT, NOOP_CALLBACK) as Promise<APIGatewayProxyResult>;
      }
    }
    
    // Table statistics
    if (subRoute === 'tables') {
      return mod.getTableStatistics(event, MINIMAL_CONTEXT, NOOP_CALLBACK) as Promise<APIGatewayProxyResult>;
    }
    
    // Maintenance
    if (subRoute === 'maintenance') {
      if (method === 'POST' && action === 'run') {
        return mod.runMaintenance(event, MINIMAL_CONTEXT, NOOP_CALLBACK) as Promise<APIGatewayProxyResult>;
      }
      if (method === 'GET' && action === 'history') {
        return mod.getMaintenanceHistory(event, MINIMAL_CONTEXT, NOOP_CALLBACK) as Promise<APIGatewayProxyResult>;
      }
    }
    
    // Rate limits
    if (subRoute === 'rate-limits') {
      return mod.getRateLimitStatus(event, MINIMAL_CONTEXT, NOOP_CALLBACK) as Promise<APIGatewayProxyResult>;
    }
  }

  // Sovereign Mesh - multi-agent orchestration
  if (pathParts[1] === 'sovereign-mesh') {
    if (pathParts[2] === 'ai-helper') {
      const { handler: aiHelperHandler } = await import('./admin-ai-helper.js');
      return (await aiHelperHandler(event, MINIMAL_CONTEXT, NOOP_CALLBACK)) as APIGatewayProxyResult;
    }
    if (pathParts[2] === 'performance') {
      const { handler: perfHandler } = await import('./sovereign-mesh-performance.js');
      return (await perfHandler(event, MINIMAL_CONTEXT, NOOP_CALLBACK)) as APIGatewayProxyResult;
    }
    if (pathParts[2] === 'scaling') {
      const { handler: scalingHandler } = await import('./sovereign-mesh-scaling.js');
      return (await scalingHandler(event, MINIMAL_CONTEXT, NOOP_CALLBACK)) as APIGatewayProxyResult;
    }
    const { handler: meshHandler } = await import('./sovereign-mesh.js');
    return meshHandler(event);
  }

  // Platform services
  if (pathParts[1] === 'platform') {
    if (pathParts[2] === 'bedrock' || pathParts[2] === 'bedrock-settings') {
      const { handler: bedrockHandler } = await import('./bedrock-management.js');
      return (await bedrockHandler(event, MINIMAL_CONTEXT, NOOP_CALLBACK)) as APIGatewayProxyResult;
    }
    if (pathParts[2] === 'cartridge-operations') {
      const { handler: cartOpsHandler } = await import('./cartridge-operations.js');
      return cartOpsHandler(event);
    }
    if (pathParts[2] === 'pki') {
      const { handler: pkiHandler } = await import('./cartridge-pki.js');
      return pkiHandler(event);
    }
    if (pathParts[2] === 'rnir') {
      const { handler: rnirHandler } = await import('./cartridge-rnir.js');
      return rnirHandler(event);
    }
    if (pathParts[2] === 'vault') {
      const { handler: vaultHandler } = await import('./cartridge-vault.js');
      return vaultHandler(event);
    }
    if (pathParts[2] === 'system-cartridges') {
      const { handler: sysCartHandler } = await import('./system-cartridges.js');
      return sysCartHandler(event);
    }
    if (pathParts[2] === 'crucible') {
      const { handler: crucibleHandler } = await import('./crucible.js');
      return crucibleHandler(event);
    }
    if (pathParts[2] === 'livs') {
      const { handler: livsHandler } = await import('./livs.js');
      return livsHandler(event);
    }
    if (pathParts[2] === 'organism') {
      const { handler: organismHandler } = await import('./organism.js');
      return organismHandler(event);
    }
    if (pathParts[2] === 'mls') {
      const { handler: mlsHandler } = await import('./mls.js');
      return mlsHandler(event);
    }
    if (pathParts[2] === 'snapshots') {
      const { handler: snapHandler } = await import('./snapshot-storage.js');
      return (await snapHandler(event, MINIMAL_CONTEXT, NOOP_CALLBACK)) as APIGatewayProxyResult;
    }
    if (pathParts[2] === 'state-registry') {
      const { handler: stateHandler } = await import('./state-registry.js');
      return stateHandler(event);
    }
    if (pathParts[2] === 'uds') {
      const { handler: udsHandler } = await import('./uds.js');
      return (await udsHandler(event, MINIMAL_CONTEXT, NOOP_CALLBACK)) as APIGatewayProxyResult;
    }
  }

  // Memory services
  if (pathParts[1] === 'memory') {
    if (pathParts[2] === 'anticipatory') {
      const { handler: anticHandler } = await import('./anticipatory-memory.js');
      return anticHandler(event);
    }
    if (pathParts[2] === 'retention') {
      const { handler: retentionHandler } = await import('./memory-retention.js');
      return retentionHandler(event);
    }
  }

  // Orchestration sub-routes (methods already wired above)
  if (pathParts[1] === 'orchestration') {
    if (pathParts[2] === 'consensus') {
      const { handler: consensusHandler } = await import('./heterogeneous-consensus.js');
      return consensusHandler(event);
    }
    if (pathParts[2] === 'inference-cache') {
      const { handler: cacheHandler } = await import('./inference-cache.js');
      return cacheHandler(event);
    }
    if (pathParts[2] === 'model-weights') {
      const { handler: weightsHandler } = await import('./model-weights.js');
      return (await weightsHandler(event, MINIMAL_CONTEXT, NOOP_CALLBACK)) as APIGatewayProxyResult;
    }
    if (pathParts[2] === 'templates') {
      const { handler: templatesHandler } = await import('./orchestration-user-templates.js');
      return templatesHandler(event);
    }
  }

  // Settings sub-routes
  if (pathParts[1] === 'settings') {
    if (pathParts[2] === 'collaboration') {
      const { handler: collabHandler } = await import('./collaboration-settings.js');
      return collabHandler(event);
    }
    if (pathParts[2] === 'white-label') {
      const { handler: wlHandler } = await import('./white-label.js');
      return wlHandler(event);
    }
  }

  // Cortex (catch-all after cortex-graph-rag was matched above)
  if (pathParts[1] === 'cortex') {
    if (pathParts[2] === 'v2') {
      const { handler: cortexV2Handler } = await import('./cortex-v2.js');
      return (await cortexV2Handler(event, MINIMAL_CONTEXT, NOOP_CALLBACK)) as APIGatewayProxyResult;
    }
    const { handler: cortexHandler } = await import('./cortex.js');
    return cortexHandler(event);
  }

  // Direct route handlers
  if (pathParts[1] === 'axiom') {
    const { handler: axiomHandler } = await import('./axiom-admin.js');
    return axiomHandler(event);
  }
  if (pathParts[1] === 'blackboard') {
    const { handler: bbHandler } = await import('./blackboard.js');
    return bbHandler(event);
  }
  if (pathParts[1] === 'cartridges') {
    const mod = await import('./cartridges.js');
    return invokeLegacy(mod.listCartridges, event);
  }
  if (pathParts[1] === 'code-quality') {
    const { handler: cqHandler } = await import('./code-quality.js');
    return cqHandler(event);
  }
  if (pathParts[1] === 'domain-experts') {
    const mod = await import('./domain-experts.js');
    return invokeLegacy(mod.getDashboard, event);
  }
  if (pathParts[1] === 'dynamic-reports') {
    const { handler: dynReportsHandler } = await import('./dynamic-reports.js');
    return (await dynReportsHandler(event, MINIMAL_CONTEXT, NOOP_CALLBACK)) as APIGatewayProxyResult;
  }
  if (pathParts[1] === 'gateway') {
    const { handler: gatewayHandler } = await import('./gateway.js');
    return (await gatewayHandler(event, MINIMAL_CONTEXT, NOOP_CALLBACK)) as APIGatewayProxyResult;
  }
  if (pathParts[1] === 'ghost-inference') {
    const { handler: ghostHandler } = await import('./ghost-inference.js');
    return ghostHandler(event, context) as Promise<APIGatewayProxyResult>;
  }
  if (pathParts[1] === 'hitl-orchestration') {
    const mod = await import('./hitl-orchestration.js');
    // V2 handler — cast event for compatibility
    const result = await mod.handler(event as any, MINIMAL_CONTEXT, NOOP_CALLBACK);
    return (result || notFoundResponse()) as APIGatewayProxyResult;
  }
  if (pathParts[1] === 'log-retention') {
    const { handler: logRetHandler } = await import('./log-retention.js');
    return logRetHandler(event, context) as Promise<APIGatewayProxyResult>;
  }
  if (pathParts[1] === 'neural-operations') {
    const mod = await import('./neural-operations.js');
    return invokeLegacy(mod.getDashboard, event);
  }
  if (pathParts[1] === 'profile') {
    const { handler: profileHandler } = await import('./profile.js');
    return profileHandler(event);
  }
  if (pathParts[1] === 'raws') {
    const { handler: rawsHandler } = await import('./raws.js');
    return rawsHandler(event);
  }
  if (pathParts[1] === 'reports') {
    const { handler: reportsHandler } = await import('./reports.js');
    return (await reportsHandler(event, MINIMAL_CONTEXT, NOOP_CALLBACK)) as APIGatewayProxyResult;
  }
  if (pathParts[1] === 's3-storage' || pathParts[1] === 'storage') {
    const { handler: storageHandler } = await import('./s3-storage.js');
    return (await storageHandler(event, MINIMAL_CONTEXT, NOOP_CALLBACK)) as APIGatewayProxyResult;
  }
  if (pathParts[1] === 'safety-matrix') {
    const mod = await import('./safety-matrix.js');
    return invokeLegacy(mod.getDashboard, event);
  }
  if (pathParts[1] === 'sentinel') {
    const { handler: sentinelHandler } = await import('./sentinel.js');
    return sentinelHandler(event);
  }
  if (pathParts[1] === 'aws-monitoring') {
    const { handler: awsMonHandler } = await import('./aws-monitoring.js');
    return awsMonHandler(event);
  }
  if (pathParts[1] === 'user-violations') {
    const { handler: violationsHandler } = await import('./user-violations.js');
    return violationsHandler(event);
  }
  if (pathParts[1] === 'security-policies') {
    const { handler: secPolHandler } = await import('./security-policies.js');
    return secPolHandler(event);
  }

  // OMEGA Quantum Architecture (v4.18.0)
  if (pathParts[1] === 'omega') {
    if (pathParts[2] === 'firmware') {
      const { handler: omegaFwHandler } = await import('./omega-firmware.js');
      return omegaFwHandler(event);
    }
    if (pathParts[2] === 'quantum') {
      const { handler: omegaQuantumHandler } = await import('./omega-quantum.js');
      return omegaQuantumHandler(event);
    }
  }

  throw new NotFoundError(`Admin route not found: ${method} ${path}`);
}

async function handleHealth(): Promise<APIGatewayProxyResult> {
  return successResponse({
    status: 'healthy',
    service: 'admin',
    version: process.env.RADIANT_VERSION || 'unknown',
    timestamp: new Date().toISOString(),
  });
}

async function handleDashboard(): Promise<APIGatewayProxyResult> {
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
  const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString();

  const tenants = await listTenants(10, 0);
  const admins = await listAdministrators(10, 0);
  const pendingApprovals = await listPendingApprovalRequests();

  return successResponse({
    stats: {
      tenants_count: tenants.length,
      admins_count: admins.length,
      pending_approvals: pendingApprovals.length,
    },
    recent_tenants: tenants.slice(0, 5),
    pending_approvals: pendingApprovals.slice(0, 5),
  });
}

async function handleTenants(
  event: APIGatewayProxyEvent,
  method: string,
  tenantId?: string
): Promise<APIGatewayProxyResult> {
  if (method === 'GET' && !tenantId) {
    const limit = parseInt(event.queryStringParameters?.limit || '100', 10);
    const offset = parseInt(event.queryStringParameters?.offset || '0', 10);
    const tenants = await listTenants(limit, offset);
    return successResponse({ data: tenants, count: tenants.length });
  }

  if (method === 'GET' && tenantId) {
    const tenant = await getTenantById(tenantId);
    if (!tenant) {
      throw new NotFoundError(`Tenant not found: ${tenantId}`);
    }
    return successResponse(tenant);
  }

  if (method === 'POST') {
    const body = JSON.parse(event.body || '{}');
    if (!body.name) {
      throw new ValidationError('name is required');
    }
    const tenant = await createTenant({
      name: body.name,
      display_name: body.display_name || body.name,
      domain: body.domain,
      settings: body.settings || {},
      status: 'active',
    });
    return successResponse(tenant, 201);
  }

  throw new NotFoundError(`Tenant operation not supported: ${method}`);
}

async function handleUsers(
  event: APIGatewayProxyEvent,
  method: string,
  userId?: string
): Promise<APIGatewayProxyResult> {
  const tenantId = event.queryStringParameters?.tenant_id;
  
  if (method === 'GET' && !userId && tenantId) {
    const limit = parseInt(event.queryStringParameters?.limit || '100', 10);
    const offset = parseInt(event.queryStringParameters?.offset || '0', 10);
    const users = await listUsersByTenant(tenantId, limit, offset);
    return successResponse({ data: users, count: users.length });
  }

  throw new NotFoundError(`User operation not supported: ${method}`);
}

async function handleAdministrators(
  event: APIGatewayProxyEvent,
  method: string,
  adminId?: string
): Promise<APIGatewayProxyResult> {
  if (method === 'GET' && !adminId) {
    const admins = await listAdministrators();
    return successResponse({ data: admins, count: admins.length });
  }

  if (method === 'GET' && adminId) {
    const admin = await getAdministratorById(adminId);
    if (!admin) {
      throw new NotFoundError(`Administrator not found: ${adminId}`);
    }
    return successResponse(admin);
  }

  throw new NotFoundError(`Administrator operation not supported: ${method}`);
}

async function handleInvitations(
  event: APIGatewayProxyEvent,
  method: string
): Promise<APIGatewayProxyResult> {
  if (method === 'GET') {
    const invitations = await listPendingInvitations();
    return successResponse({ data: invitations, count: invitations.length });
  }

  throw new NotFoundError(`Invitation operation not supported: ${method}`);
}

async function handleApprovals(
  event: APIGatewayProxyEvent,
  method: string,
  requestId?: string,
  action?: string
): Promise<APIGatewayProxyResult> {
  if (method === 'GET') {
    const approvals = await listPendingApprovalRequests();
    return successResponse({ data: approvals, count: approvals.length });
  }

  throw new NotFoundError(`Approval operation not supported: ${method}`);
}

async function handleBilling(
  event: APIGatewayProxyEvent,
  resource?: string
): Promise<APIGatewayProxyResult> {
  const tenantId = event.queryStringParameters?.tenant_id;
  
  if (resource === 'usage' && tenantId) {
    const startDate = event.queryStringParameters?.start_date || 
      new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString();
    const endDate = event.queryStringParameters?.end_date || new Date().toISOString();
    
    const stats = await getUsageStats(tenantId, startDate, endDate);
    return successResponse(stats);
  }

  return successResponse({ message: 'Billing endpoint' });
}

async function handleAuditLogs(
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  const filters = {
    tenantId: event.queryStringParameters?.tenant_id,
    actorId: event.queryStringParameters?.actor_id,
    action: event.queryStringParameters?.action,
    resourceType: event.queryStringParameters?.resource_type,
    startDate: event.queryStringParameters?.start_date,
    endDate: event.queryStringParameters?.end_date,
  };
  
  const limit = parseInt(event.queryStringParameters?.limit || '100', 10);
  const offset = parseInt(event.queryStringParameters?.offset || '0', 10);
  
  const logs = await listAuditLogs(filters, limit, offset);
  return successResponse({ data: logs, count: logs.length });
}

async function handleModels(
  event: APIGatewayProxyEvent,
  method: string,
  modelId?: string
): Promise<APIGatewayProxyResult> {
  if (method === 'GET') {
    const category = event.queryStringParameters?.category;
    const status = event.queryStringParameters?.status;
    const models = await listModels(category, status);
    return successResponse({ data: models, count: models.length });
  }

  throw new NotFoundError(`Model operation not supported: ${method}`);
}

async function handleProviders(
  event: APIGatewayProxyEvent,
  method: string,
  providerId?: string
): Promise<APIGatewayProxyResult> {
  if (method === 'GET') {
    const status = event.queryStringParameters?.status;
    const providers = await listProviders(status);
    return successResponse({ data: providers, count: providers.length });
  }

  throw new NotFoundError(`Provider operation not supported: ${method}`);
}

async function handleConversationExport(
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  const method = event.httpMethod;
  const pathParts = event.path.split('/').filter(Boolean);
  const exportId = pathParts[2]; // /admin/conversation-export/:exportId

  try {
    const { conversationExportService } = await import('../shared/services/uds/conversation-export.service.js');

    // POST /admin/conversation-export - Request new export
    if (method === 'POST' && !exportId) {
      const body = JSON.parse(event.body || '{}');
      if (!body.tenantId || !body.userId || !body.conversationId) {
        throw new ValidationError('tenantId, userId, and conversationId are required');
      }
      const result = await conversationExportService.requestExport({
        tenantId: body.tenantId,
        userId: body.userId,
        conversationId: body.conversationId,
        format: body.format || 'json',
        includeAttachments: body.includeAttachments ?? true,
        includeMetadata: body.includeMetadata ?? false,
      });
      return successResponse(result, 201);
    }

    // GET /admin/conversation-export/:exportId - Get export status
    if (method === 'GET' && exportId) {
      const tenantId = event.queryStringParameters?.tenant_id;
      const userId = event.queryStringParameters?.user_id;
      if (!tenantId || !userId) {
        throw new ValidationError('tenant_id and user_id query params are required');
      }
      const result = await conversationExportService.getExportStatus(tenantId, userId, exportId);
      if (!result) {
        throw new NotFoundError(`Export not found: ${exportId}`);
      }
      return successResponse(result);
    }

    // GET /admin/conversation-export?tenant_id=&user_id= - List exports
    if (method === 'GET' && !exportId) {
      const tenantId = event.queryStringParameters?.tenant_id;
      const userId = event.queryStringParameters?.user_id;
      if (!tenantId || !userId) {
        throw new ValidationError('tenant_id and user_id query params are required');
      }
      const limit = parseInt(event.queryStringParameters?.limit || '20', 10);
      const results = await conversationExportService.listExports(tenantId, userId, limit);
      return successResponse({ data: results, count: results.length });
    }

    throw new NotFoundError(`Conversation export operation not supported: ${method}`);
  } catch (error) {
    if (error instanceof NotFoundError || error instanceof ValidationError) throw error;
    throw error;
  }
}
