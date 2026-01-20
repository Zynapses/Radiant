/**
 * RADIANT MCP Worker Lambda
 * 
 * Production NATS consumer for MCP (Model Context Protocol) messages.
 * Consumes from JetStream INBOX, processes MCP JSON-RPC, and dual-publishes responses.
 * 
 * Architecture:
 * - Triggered by: EventBridge schedule or NATS consumer (via custom runtime)
 * - Consumes: in.mcp.{tenant}.{agent} from JetStream INBOX stream
 * - Publishes: out.{session_id} (Core NATS) + history.{session_id} (JetStream)
 * - Authorization: Cedar policies via CedarAuthorizationService
 */

import { Logger } from '@aws-lambda-powertools/logger';
import { Tracer } from '@aws-lambda-powertools/tracer';
import { Metrics, MetricUnits } from '@aws-lambda-powertools/metrics';
import {
  getCedarAuthorizationService,
  type Principal,
  type AuthorizationRequest,
  type ToolResource,
} from '../shared/services/cedar';

const logger = new Logger({ serviceName: 'mcp-worker' });
const tracer = new Tracer({ serviceName: 'mcp-worker' });
const metrics = new Metrics({ namespace: 'RADIANT/Gateway', serviceName: 'mcp-worker' });

// =============================================================================
// TYPES
// =============================================================================

interface InboundMessage {
  messageId: string;
  sessionId: string;
  connectionId: string;
  tenantId: string;
  securityContext: {
    principal_id: string;
    principal_type: 'user' | 'agent' | 'service';
    tenant_id: string;
    scopes?: string[];
    labels?: string[];
    namespace?: string;
    role?: string;
    tier?: string;
  };
  protocol: string;
  protocolVersion: string;
  payload: Uint8Array | string;
  receivedAt: string;
}

interface OutboundMessage {
  messageId: string;
  sessionId: string;
  payload: string;
  seqNum: number;
  isPartial: boolean;
  isFinal: boolean;
  serverTimestamp?: number;
}

interface MCPRequest {
  jsonrpc: '2.0';
  id?: string | number;
  method: string;
  params?: Record<string, unknown>;
}

interface MCPResponse {
  jsonrpc: '2.0';
  id?: string | number;
  result?: unknown;
  error?: {
    code: number;
    message: string;
    data?: unknown;
  };
}

// =============================================================================
// MCP WORKER SERVICE
// =============================================================================

export class MCPWorkerService {
  private readonly cedarService = getCedarAuthorizationService({ strictMode: true });
  private seqCounter = 0;

  /**
   * Process an inbound MCP message from NATS.
   */
  async processMessage(message: InboundMessage): Promise<OutboundMessage> {
    const startTime = Date.now();
    
    logger.info('Processing MCP message', {
      messageId: message.messageId,
      sessionId: message.sessionId,
      tenantId: message.tenantId,
      protocol: message.protocol,
    });

    try {
      // Parse payload
      const payloadStr = typeof message.payload === 'string' 
        ? message.payload 
        : Buffer.from(message.payload).toString('utf-8');
      
      const request: MCPRequest = JSON.parse(payloadStr);

      // Build principal from security context
      const principal = this.buildPrincipal(message.securityContext);

      // Route to appropriate handler
      let response: MCPResponse;
      
      switch (request.method) {
        case 'initialize':
          response = await this.handleInitialize(request, principal, message.tenantId);
          break;
        case 'ping':
          response = this.handlePing(request);
          break;
        case 'tools/list':
          response = await this.handleToolsList(request, principal, message.tenantId);
          break;
        case 'tools/call':
          response = await this.handleToolsCall(request, principal, message.tenantId);
          break;
        case 'resources/list':
          response = await this.handleResourcesList(request, principal, message.tenantId);
          break;
        case 'resources/read':
          response = await this.handleResourcesRead(request, principal, message.tenantId);
          break;
        case 'prompts/list':
          response = await this.handlePromptsList(request, principal, message.tenantId);
          break;
        case 'prompts/get':
          response = await this.handlePromptsGet(request, principal, message.tenantId);
          break;
        default:
          response = this.createError(request.id, -32601, `Method not found: ${request.method}`);
      }

      this.seqCounter++;

      const outbound: OutboundMessage = {
        messageId: `resp_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
        sessionId: message.sessionId,
        payload: JSON.stringify(response),
        seqNum: this.seqCounter,
        isPartial: false,
        isFinal: true,
        serverTimestamp: Date.now(),
      };

      // Record metrics
      const duration = Date.now() - startTime;
      metrics.addMetric('MCPMessageProcessed', MetricUnits.Count, 1);
      metrics.addMetric('MCPMessageLatency', MetricUnits.Milliseconds, duration);
      metrics.addMetric(`MCP_${request.method.replace('/', '_')}`, MetricUnits.Count, 1);

      logger.info('MCP message processed', {
        messageId: message.messageId,
        method: request.method,
        durationMs: duration,
        hasError: !!response.error,
      });

      return outbound;

    } catch (error) {
      logger.error('Failed to process MCP message', { error, messageId: message.messageId });
      metrics.addMetric('MCPMessageError', MetricUnits.Count, 1);

      this.seqCounter++;
      
      return {
        messageId: `err_${Date.now()}`,
        sessionId: message.sessionId,
        payload: JSON.stringify(this.createError(null, -32603, 'Internal error')),
        seqNum: this.seqCounter,
        isPartial: false,
        isFinal: true,
        serverTimestamp: Date.now(),
      };
    }
  }

  // ===========================================================================
  // MCP HANDLERS
  // ===========================================================================

  private async handleInitialize(
    request: MCPRequest,
    principal: Principal,
    tenantId: string
  ): Promise<MCPResponse> {
    // Authorize session creation
    const authResult = await this.cedarService.authorize({
      principal,
      action: 'session:create',
      resource: {
        type: 'Session',
        id: 'new',
        protocol: 'mcp',
        createdAt: Date.now(),
        expiresAt: Date.now() + 3600000, // 1 hour
      },
      context: {
        tenantId,
        protocol: 'mcp',
        clientIP: '0.0.0.0', // Would come from gateway
      },
    });

    if (!authResult.allowed) {
      return this.createError(request.id, -32001, 'Authorization denied', {
        decision: authResult.decision,
        policies: authResult.matchedPolicies,
      });
    }

    return {
      jsonrpc: '2.0',
      id: request.id,
      result: {
        protocolVersion: '2025-03-26',
        capabilities: {
          tools: { listChanged: true },
          resources: { subscribe: true, listChanged: true },
          prompts: { listChanged: true },
          logging: {},
        },
        serverInfo: {
          name: 'radiant-gateway',
          version: '5.28.0',
        },
      },
    };
  }

  private handlePing(request: MCPRequest): MCPResponse {
    return {
      jsonrpc: '2.0',
      id: request.id,
      result: {},
    };
  }

  private async handleToolsList(
    request: MCPRequest,
    principal: Principal,
    tenantId: string
  ): Promise<MCPResponse> {
    // In production, fetch tools from database
    // For now, return sample tools
    const tools = [
      {
        name: 'search',
        description: 'Search for information',
        inputSchema: {
          type: 'object',
          properties: {
            query: { type: 'string', description: 'Search query' },
            limit: { type: 'number', description: 'Max results' },
          },
          required: ['query'],
        },
      },
      {
        name: 'calculate',
        description: 'Perform calculations',
        inputSchema: {
          type: 'object',
          properties: {
            expression: { type: 'string', description: 'Math expression' },
          },
          required: ['expression'],
        },
      },
      {
        name: 'fetch_data',
        description: 'Fetch data from a source',
        inputSchema: {
          type: 'object',
          properties: {
            source: { type: 'string', description: 'Data source' },
            limit: { type: 'number', description: 'Max records' },
          },
          required: ['source'],
        },
      },
    ];

    // Filter tools based on authorization
    const authorizedTools = [];
    for (const tool of tools) {
      const authResult = await this.cedarService.authorize({
        principal,
        action: 'tool:read',
        resource: {
          type: 'Tool',
          id: tool.name,
          name: tool.name,
          namespace: 'public',
          owner: 'system',
          destructive: false,
          sensitive: false,
          requiredScopes: ['tool:read'],
          labels: [],
          rateLimit: 100,
        },
        context: { tenantId },
      });

      if (authResult.allowed) {
        authorizedTools.push(tool);
      }
    }

    return {
      jsonrpc: '2.0',
      id: request.id,
      result: { tools: authorizedTools },
    };
  }

  private async handleToolsCall(
    request: MCPRequest,
    principal: Principal,
    tenantId: string
  ): Promise<MCPResponse> {
    const params = request.params as { name: string; arguments?: Record<string, unknown> } | undefined;
    
    if (!params?.name) {
      return this.createError(request.id, -32602, 'Missing tool name');
    }

    const toolName = params.name;
    const toolArgs = params.arguments || {};

    // Build tool resource for authorization
    const toolResource: ToolResource = {
      type: 'Tool',
      id: toolName,
      name: toolName,
      namespace: 'public',
      owner: 'system',
      destructive: false,
      sensitive: false,
      requiredScopes: ['tool:execute'],
      labels: [],
      rateLimit: 100,
    };

    // Authorize tool execution
    const authResult = await this.cedarService.authorize({
      principal,
      action: 'tool:execute',
      resource: toolResource,
      context: {
        tenantId,
        parameters: JSON.stringify(toolArgs),
      },
    });

    if (!authResult.allowed) {
      logger.warn('Tool execution denied', {
        toolName,
        principal: principal.id,
        decision: authResult.decision,
        policies: authResult.matchedPolicies,
      });

      return this.createError(request.id, -32001, 'Authorization denied', {
        tool: toolName,
        decision: authResult.decision,
        diagnostics: authResult.diagnostics,
      });
    }

    // Execute tool (in production, this would call actual tool implementations)
    metrics.addMetric('ToolExecution', MetricUnits.Count, 1);
    metrics.addMetric(`Tool_${toolName}`, MetricUnits.Count, 1);

    let resultText: string;
    switch (toolName) {
      case 'search':
        resultText = `Search results for "${toolArgs.query}": [Mock results would appear here]`;
        break;
      case 'calculate':
        try {
          // Safe evaluation for simple math (in production, use proper parser)
          const expr = String(toolArgs.expression).replace(/[^0-9+\-*/().]/g, '');
          const result = Function(`"use strict"; return (${expr})`)();
          resultText = `${toolArgs.expression} = ${result}`;
        } catch {
          resultText = `Unable to calculate: ${toolArgs.expression}`;
        }
        break;
      case 'fetch_data':
        resultText = `Fetched ${toolArgs.limit || 10} records from ${toolArgs.source}`;
        break;
      default:
        resultText = `Tool '${toolName}' executed with args: ${JSON.stringify(toolArgs)}`;
    }

    return {
      jsonrpc: '2.0',
      id: request.id,
      result: {
        content: [{ type: 'text', text: resultText }],
      },
    };
  }

  private async handleResourcesList(
    request: MCPRequest,
    principal: Principal,
    tenantId: string
  ): Promise<MCPResponse> {
    // Sample resources
    return {
      jsonrpc: '2.0',
      id: request.id,
      result: {
        resources: [
          {
            uri: 'radiant://config/tenant',
            name: 'Tenant Configuration',
            mimeType: 'application/json',
          },
          {
            uri: 'radiant://models/available',
            name: 'Available Models',
            mimeType: 'application/json',
          },
        ],
      },
    };
  }

  private async handleResourcesRead(
    request: MCPRequest,
    principal: Principal,
    tenantId: string
  ): Promise<MCPResponse> {
    const params = request.params as { uri: string } | undefined;
    
    if (!params?.uri) {
      return this.createError(request.id, -32602, 'Missing resource URI');
    }

    // Return mock resource content
    return {
      jsonrpc: '2.0',
      id: request.id,
      result: {
        contents: [{
          uri: params.uri,
          mimeType: 'application/json',
          text: JSON.stringify({ tenantId, resource: params.uri, data: {} }),
        }],
      },
    };
  }

  private async handlePromptsList(
    request: MCPRequest,
    principal: Principal,
    tenantId: string
  ): Promise<MCPResponse> {
    return {
      jsonrpc: '2.0',
      id: request.id,
      result: {
        prompts: [
          {
            name: 'analyze',
            description: 'Analyze a topic in depth',
            arguments: [
              { name: 'topic', description: 'Topic to analyze', required: true },
            ],
          },
        ],
      },
    };
  }

  private async handlePromptsGet(
    request: MCPRequest,
    principal: Principal,
    tenantId: string
  ): Promise<MCPResponse> {
    const params = request.params as { name: string; arguments?: Record<string, string> } | undefined;
    
    if (!params?.name) {
      return this.createError(request.id, -32602, 'Missing prompt name');
    }

    return {
      jsonrpc: '2.0',
      id: request.id,
      result: {
        description: `Prompt: ${params.name}`,
        messages: [
          {
            role: 'user',
            content: {
              type: 'text',
              text: `Please analyze: ${params.arguments?.topic || 'the requested topic'}`,
            },
          },
        ],
      },
    };
  }

  // ===========================================================================
  // HELPERS
  // ===========================================================================

  private buildPrincipal(securityContext: InboundMessage['securityContext']): Principal {
    const type = securityContext.principal_type === 'user' ? 'User' 
      : securityContext.principal_type === 'agent' ? 'Agent' 
      : 'Service';

    return {
      type,
      id: securityContext.principal_id,
      tenantId: securityContext.tenant_id,
      role: securityContext.role,
      tier: securityContext.tier,
      scopes: securityContext.scopes || ['tool:read', 'tool:execute', 'model:invoke'],
      labels: securityContext.labels || [],
      namespace: securityContext.namespace,
      active: true,
    };
  }

  private createError(
    id: string | number | null | undefined,
    code: number,
    message: string,
    data?: unknown
  ): MCPResponse {
    return {
      jsonrpc: '2.0',
      id: id ?? null,
      error: { code, message, data },
    };
  }
}

// =============================================================================
// LAMBDA HANDLER
// =============================================================================

const worker = new MCPWorkerService();

/**
 * Lambda handler for processing MCP messages.
 * 
 * In production, this would be invoked by:
 * 1. A custom NATS consumer runtime, or
 * 2. An EventBridge pipe from NATS to Lambda, or
 * 3. A polling mechanism via EventBridge scheduler
 */
export async function handler(event: {
  messages: InboundMessage[];
}): Promise<{
  responses: OutboundMessage[];
  failed: string[];
}> {
  const segment = tracer.getSegment();
  
  logger.info('MCP Worker invoked', { messageCount: event.messages.length });
  metrics.addMetric('MCPWorkerInvocation', MetricUnits.Count, 1);

  const responses: OutboundMessage[] = [];
  const failed: string[] = [];

  for (const message of event.messages) {
    try {
      const response = await worker.processMessage(message);
      responses.push(response);
    } catch (error) {
      logger.error('Message processing failed', { messageId: message.messageId, error });
      failed.push(message.messageId);
    }
  }

  metrics.addMetric('MCPMessagesProcessed', MetricUnits.Count, responses.length);
  metrics.addMetric('MCPMessagesFailed', MetricUnits.Count, failed.length);
  metrics.publishStoredMetrics();

  return { responses, failed };
}

export default handler;
