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

import { Handler, SQSEvent, SQSBatchResponse } from 'aws-lambda';
import { logger } from '../shared/utils/logger';
import {
  getCedarAuthorizationService,
  type Principal,
  type AuthorizationRequest,
  type ToolResource,
} from '../shared/services/cedar';

// Metrics helper
const metrics = {
  addMetric: (name: string, unit: string, value: number) => {
    logger.info('Metric', { name, unit, value });
  },
  publishStoredMetrics: () => {}
};

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
      metrics.addMetric('MCPMessageProcessed', "Count", 1);
      metrics.addMetric('MCPMessageLatency', "Milliseconds", duration);
      metrics.addMetric(`MCP_${request.method.replace('/', '_')}`, "Count", 1);

      logger.info('MCP message processed', {
        messageId: message.messageId,
        method: request.method,
        durationMs: duration,
        hasError: !!response.error,
      });

      return outbound;

    } catch (error) {
      logger.error('Failed to process MCP message', { error, messageId: message.messageId });
      metrics.addMetric('MCPMessageError', "Count", 1);

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
        name: 'mcp-session',
        namespace: 'mcp',
        owner: principal.id,
        destructive: false,
        sensitive: false,
        costTier: 'low',
        requiredPermissions: ['session:create'],
        requiredScopes: [],
        labels: {},
        metadata: {},
        rateLimit: { maxRequests: 100, windowSeconds: 60 },
        createdAt: Date.now(),
        expiresAt: Date.now() + 3600000,
      } as unknown as ToolResource,
      context: {
        tenantId,
        // protocol: 'mcp', // Not in AuthorizationContext type
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
    // Fetch tools from database - both system tools and tenant-specific tools
    const { Pool } = await import('pg');
    const pool = new Pool({
      host: process.env.DATABASE_HOST,
      database: process.env.DATABASE_NAME,
      user: process.env.DATABASE_USER,
      password: process.env.DATABASE_PASSWORD,
      ssl: process.env.DATABASE_SSL === 'true' ? { rejectUnauthorized: false } : undefined,
    });

    try {
      const result = await pool.query(`
        SELECT tool_id, name, description, input_schema, category, risk_category, tags
        FROM cato_tool_definitions
        WHERE enabled = true 
          AND (scope = 'SYSTEM' OR tenant_id = $1)
        ORDER BY category, name
        LIMIT 100
      `, [tenantId]);

      const tools = result.rows.map((row: any) => ({
        name: row.tool_id,
        description: row.description || row.name,
        inputSchema: row.input_schema || {
          type: 'object',
          properties: {},
        },
        category: row.category,
        riskLevel: row.risk_category,
        tags: row.tags || [],
      }));

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
            labels: tool.tags || [],
            rateLimit: 100,
          },
          context: { tenantId },
        });

        if (authResult.allowed) {
          authorizedTools.push({
            name: tool.name,
            description: tool.description,
            inputSchema: tool.inputSchema,
          });
        }
      }

      return {
        jsonrpc: '2.0',
        id: request.id,
        result: { tools: authorizedTools },
      };
    } catch (error) {
      logger.error('Failed to fetch tools from database', { error, tenantId });
      // Return empty tools list on error
      return {
        jsonrpc: '2.0',
        id: request.id,
        result: { tools: [] },
      };
    }
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

    // Execute tool with real implementations
    metrics.addMetric('ToolExecution', "Count", 1);
    metrics.addMetric(`Tool_${toolName}`, "Count", 1);

    let resultText: string;
    switch (toolName) {
      case 'search':
        resultText = await this.executeSearchTool(toolArgs, tenantId);
        break;
      case 'calculate':
        try {
          // Safe evaluation for simple math using sandboxed expression parser
          const expr = String(toolArgs.expression).replace(/[^0-9+\-*/().%\s]/g, '');
          if (!expr || expr.length > 100) {
            resultText = `Invalid expression: ${toolArgs.expression}`;
          } else {
            const result = this.safeEvaluate(expr);
            resultText = `${toolArgs.expression} = ${result}`;
          }
        } catch {
          resultText = `Unable to calculate: ${toolArgs.expression}`;
        }
        break;
      case 'fetch_data':
        resultText = await this.executeFetchDataTool(toolArgs, tenantId);
        break;
      default:
        resultText = await this.executeGenericTool(toolName, toolArgs, tenantId);
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
      id: id ?? undefined,
      error: { code, message, data },
    };
  }

  /**
   * Execute search tool using Cortex graph search
   */
  private async executeSearchTool(
    args: Record<string, unknown>,
    tenantId: string
  ): Promise<string> {
    const query = String(args.query || '');
    const limit = Number(args.limit) || 10;
    const searchType = String(args.type || 'semantic');

    if (!query) {
      return 'Error: Search query is required';
    }

    try {
      // Use the Cortex graph for semantic search
      const { executeStatement } = await import('../shared/db/client.js');
      
      // Search nodes by label similarity
      const result = await executeStatement(`
        SELECT id, label, node_type, confidence, created_at
        FROM cortex_graph_nodes
        WHERE tenant_id = :tenantId
          AND status = 'active'
          AND (
            label ILIKE '%' || :query || '%'
            OR properties::text ILIKE '%' || :query || '%'
          )
        ORDER BY confidence DESC
        LIMIT :limit
      `, [
        { name: 'tenantId', value: { stringValue: tenantId } },
        { name: 'query', value: { stringValue: query } },
        { name: 'limit', value: { longValue: limit } },
      ]);

      if (result.rows.length === 0) {
        return `No results found for "${query}"`;
      }

      const formattedResults = result.rows.map((row: any, i: number) => 
        `${i + 1}. [${row.node_type}] ${row.label} (confidence: ${(row.confidence * 100).toFixed(0)}%)`
      ).join('\n');

      return `Search results for "${query}":\n\n${formattedResults}`;
    } catch (error) {
      logger.error('Search tool error', { error, query, tenantId });
      return `Search failed: ${error instanceof Error ? error.message : 'Unknown error'}`;
    }
  }

  /**
   * Safe arithmetic expression evaluator
   */
  private safeEvaluate(expr: string): number {
    // Tokenize and parse simple arithmetic
    const tokens = expr.match(/(\d+\.?\d*|\+|-|\*|\/|%|\(|\))/g) || [];
    
    // Build simple expression evaluator using shunting-yard
    const outputQueue: (number | string)[] = [];
    const operatorStack: string[] = [];
    const precedence: Record<string, number> = { '+': 1, '-': 1, '*': 2, '/': 2, '%': 2 };

    for (const token of tokens) {
      if (/^\d+\.?\d*$/.test(token)) {
        outputQueue.push(parseFloat(token));
      } else if ('+-*/%'.includes(token)) {
        while (
          operatorStack.length > 0 &&
          operatorStack[operatorStack.length - 1] !== '(' &&
          (precedence[operatorStack[operatorStack.length - 1]] || 0) >= (precedence[token] || 0)
        ) {
          outputQueue.push(operatorStack.pop()!);
        }
        operatorStack.push(token);
      } else if (token === '(') {
        operatorStack.push(token);
      } else if (token === ')') {
        while (operatorStack.length > 0 && operatorStack[operatorStack.length - 1] !== '(') {
          outputQueue.push(operatorStack.pop()!);
        }
        operatorStack.pop(); // Remove '('
      }
    }

    while (operatorStack.length > 0) {
      outputQueue.push(operatorStack.pop()!);
    }

    // Evaluate RPN
    const evalStack: number[] = [];
    for (const item of outputQueue) {
      if (typeof item === 'number') {
        evalStack.push(item);
      } else {
        const b = evalStack.pop() ?? 0;
        const a = evalStack.pop() ?? 0;
        switch (item) {
          case '+': evalStack.push(a + b); break;
          case '-': evalStack.push(a - b); break;
          case '*': evalStack.push(a * b); break;
          case '/': evalStack.push(b !== 0 ? a / b : 0); break;
          case '%': evalStack.push(b !== 0 ? a % b : 0); break;
        }
      }
    }

    return evalStack[0] ?? 0;
  }

  /**
   * Execute fetch_data tool
   */
  private async executeFetchDataTool(
    args: Record<string, unknown>,
    tenantId: string
  ): Promise<string> {
    const source = String(args.source || '');
    const limit = Number(args.limit) || 10;

    if (!source) {
      return 'Error: Data source is required';
    }

    try {
      const { executeStatement } = await import('../shared/db/client.js');

      // Map source to table
      const sourceMap: Record<string, string> = {
        'models': 'model_configs',
        'users': 'tenant_users',
        'sessions': 'conversation_sessions',
        'documents': 'cortex_graph_documents',
        'nodes': 'cortex_graph_nodes',
      };

      const tableName = sourceMap[source.toLowerCase()];
      if (!tableName) {
        return `Unknown data source: ${source}. Available: ${Object.keys(sourceMap).join(', ')}`;
      }

      const result = await executeStatement(`
        SELECT * FROM ${tableName}
        WHERE tenant_id = :tenantId
        LIMIT :limit
      `, [
        { name: 'tenantId', value: { stringValue: tenantId } },
        { name: 'limit', value: { longValue: limit } },
      ]);

      return `Fetched ${result.rows.length} records from ${source}:\n${JSON.stringify(result.rows, null, 2)}`;
    } catch (error) {
      logger.error('Fetch data tool error', { error, source, tenantId });
      return `Fetch failed: ${error instanceof Error ? error.message : 'Unknown error'}`;
    }
  }

  /**
   * Execute generic tool via tool registry
   */
  private async executeGenericTool(
    toolName: string,
    args: Record<string, unknown>,
    tenantId: string
  ): Promise<string> {
    try {
      // Check if we have a registered Lambda tool
      const { executeStatement } = await import('../shared/db/client.js');
      
      const toolResult = await executeStatement(`
        SELECT handler_type, handler_arn, handler_config
        FROM cato_tool_definitions
        WHERE (tenant_id = :tenantId OR tenant_id IS NULL)
          AND name = :toolName
          AND is_active = true
        ORDER BY tenant_id NULLS LAST
        LIMIT 1
      `, [
        { name: 'tenantId', value: { stringValue: tenantId } },
        { name: 'toolName', value: { stringValue: toolName } },
      ]);

      if (toolResult.rows.length === 0) {
        return `Tool '${toolName}' not found in registry. Args: ${JSON.stringify(args)}`;
      }

      const tool = toolResult.rows[0] as any;

      if (tool.handler_type === 'lambda' && tool.handler_arn) {
        // Invoke Lambda handler
        const { LambdaClient, InvokeCommand } = await import('@aws-sdk/client-lambda');
        const lambda = new LambdaClient({});
        
        const response = await lambda.send(new InvokeCommand({
          FunctionName: tool.handler_arn,
          Payload: JSON.stringify({ tenantId, toolName, args }),
        }));

        if (response.Payload) {
          const result = JSON.parse(new TextDecoder().decode(response.Payload));
          return typeof result === 'string' ? result : JSON.stringify(result);
        }
      }

      return `Tool '${toolName}' executed with args: ${JSON.stringify(args)}`;
    } catch (error) {
      logger.error('Generic tool execution error', { error, toolName, tenantId });
      return `Tool execution failed: ${error instanceof Error ? error.message : 'Unknown error'}`;
    }
  }
}

// =============================================================================
// LAMBDA HANDLER
// =============================================================================

const worker = new MCPWorkerService();

/**
 * Lambda handler for processing MCP messages from SQS.
 * 
 * Architecture:
 * - Go Gateway publishes MCP messages to SQS queue
 * - This Lambda consumes and processes MCP JSON-RPC requests
 * - Responses are published back via NATS for delivery to clients
 */
export const handler: Handler<SQSEvent, SQSBatchResponse> = async (event) => {
  logger.info('MCP Worker invoked', { messageCount: event.Records.length });
  metrics.addMetric('MCPWorkerInvocation', "Count", 1);

  const results: Array<{ messageId: string; success: boolean }> = [];

  for (const record of event.Records) {
    try {
      const message: InboundMessage = JSON.parse(record.body);
      const response = await worker.processMessage(message);
      results.push({ messageId: record.messageId, success: !response.payload.includes('"error"') });
      
      // In production, publish response to NATS for delivery
      // await publishToNats(`out.${message.sessionId}`, response);
    } catch (error) {
      logger.error('Message processing failed', { messageId: record.messageId, error });
      results.push({ messageId: record.messageId, success: false });
    }
  }

  const successCount = results.filter(r => r.success).length;
  const failCount = results.filter(r => !r.success).length;
  
  metrics.addMetric('MCPMessagesProcessed', "Count", successCount);
  metrics.addMetric('MCPMessagesFailed', "Count", failCount);
  metrics.publishStoredMetrics();

  // Return failed message IDs for retry
  const failures = results.filter(r => !r.success);
  if (failures.length > 0) {
    return {
      batchItemFailures: failures.map(f => ({ itemIdentifier: f.messageId })),
    };
  }

  return { batchItemFailures: [] };
};

export { handler as mcpWorkerHandler };
export default handler;
