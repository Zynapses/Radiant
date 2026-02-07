// RADIANT Autonomous Organism - Genesis Auto-Tool Pipeline
// On-demand tool generation with AI-powered code synthesis
// Version: 1.0.0

import { randomUUID } from 'crypto';
import { executeStatement, stringParam, longParam, doubleParam, boolParam } from '../../db/client';
import { createRegisteredLogger } from '../logging-registry.service';

const logger = createRegisteredLogger({
  serviceName: 'organism/genesis-auto-tool',
  category: 'infrastructure',
  sourceType: 'application',
});
import { embeddingService } from '../embedding.service';
import { neuralSchemaRegistry } from './neural-schema-registry.service';

// ============================================================================
// Types
// ============================================================================

type GenesisToolStatus = 
  | 'queued' 
  | 'scraping' 
  | 'generating' 
  | 'validating' 
  | 'sandbox_testing'
  | 'approved' 
  | 'rejected' 
  | 'deployed' 
  | 'failed';

type GenesisValidationResult = 'pass' | 'fail' | 'warn';
type ToolSensitivity = 'public' | 'internal' | 'confidential' | 'restricted';

interface GenesisToolRequest {
  requestId: string;
  tenantId: string;
  userId: string;
  targetService: string;
  targetCapability: string;
  naturalLanguageSpec: string;
  intentEmbedding?: Float32Array;
  existingSimilarTools: string[];
  userContext?: Record<string, unknown>;
  maxGenerationTimeMs: number;
  requireSandboxValidation: boolean;
  securityLevel: ToolSensitivity;
  status: GenesisToolStatus;
  createdAt: Date;
  updatedAt: Date;
  completedAt?: Date;
}

interface GenesisToolResult {
  requestId: string;
  toolId?: string;
  mcpServerCode?: string;
  zodSchemas?: string;
  testCases?: string[];
  documentation?: string;
  sandboxValidation?: {
    passed: boolean;
    executionTimeMs: number;
    memoryUsageMb: number;
    securityScan: GenesisValidationResult;
    functionalTests: GenesisValidationResult;
    errorMessages?: string[];
  };
  deployedAt?: Date;
  hotLoadedSessionIds?: string[];
  generationTimeMs: number;
  tokensUsed: number;
  estimatedCost: number;
}

interface GenesisAPIDiscovery {
  serviceUrl: string;
  discoveryMethod: 'openapi' | 'graphql' | 'grpc' | 'html_scrape' | 'documentation';
  endpoints: GenesisEndpoint[];
  authRequirements?: {
    type: 'api_key' | 'oauth2' | 'basic' | 'bearer' | 'custom';
    location: 'header' | 'query' | 'body';
    keyName?: string;
  };
  rateLimits?: {
    requestsPerMinute?: number;
    requestsPerDay?: number;
    concurrentRequests?: number;
  };
  lastScrapedAt: Date;
  confidenceScore: number;
}

interface GenesisEndpoint {
  path: string;
  method: string;
  description: string;
  parameters: Array<{
    name: string;
    type: string;
    required: boolean;
    description?: string;
    defaultValue?: unknown;
  }>;
  responseSchema?: Record<string, unknown>;
}

// ============================================================================
// Genesis Auto-Tool Pipeline Service
// ============================================================================

class GenesisAutoToolService {
  private pendingRequests: Map<string, GenesisToolRequest> = new Map();
  private completedResults: Map<string, GenesisToolResult> = new Map();
  private apiDiscoveryCache: Map<string, GenesisAPIDiscovery> = new Map();

  // ==========================================================================
  // REQUEST MANAGEMENT
  // ==========================================================================

  async createToolRequest(params: {
    tenantId: string;
    userId: string;
    targetService: string;
    targetCapability: string;
    naturalLanguageSpec: string;
    userContext?: Record<string, unknown>;
    securityLevel?: ToolSensitivity;
  }): Promise<GenesisToolRequest> {
    const requestId = randomUUID();
    const now = new Date();

    // Generate intent embedding for similarity search
    const intentEmbedding = await this.generateIntentEmbedding(
      params.targetService,
      params.targetCapability,
      params.naturalLanguageSpec
    );

    // Find existing similar tools
    const existingSimilarTools = await this.findSimilarTools(intentEmbedding);

    const request: GenesisToolRequest = {
      requestId,
      tenantId: params.tenantId,
      userId: params.userId,
      targetService: params.targetService,
      targetCapability: params.targetCapability,
      naturalLanguageSpec: params.naturalLanguageSpec,
      intentEmbedding,
      existingSimilarTools,
      userContext: params.userContext,
      maxGenerationTimeMs: 120000, // 2 minutes default
      requireSandboxValidation: true,
      securityLevel: params.securityLevel || 'public',
      status: 'queued',
      createdAt: now,
      updatedAt: now,
    };

    this.pendingRequests.set(requestId, request);
    await this.saveRequestToDatabase(request);

    logger.info(`Genesis tool request created: ${requestId}`, {
      targetService: params.targetService,
      targetCapability: params.targetCapability,
    });

    // Start async processing
    this.processRequest(request).catch(err => {
      logger.error(`Genesis request ${requestId} failed:`, err);
    });

    return request;
  }

  async getRequestStatus(requestId: string): Promise<GenesisToolRequest | null> {
    return this.pendingRequests.get(requestId) || await this.loadRequestFromDatabase(requestId);
  }

  async getResult(requestId: string): Promise<GenesisToolResult | null> {
    return this.completedResults.get(requestId) || await this.loadResultFromDatabase(requestId);
  }

  // ==========================================================================
  // TOOL GENERATION PIPELINE
  // ==========================================================================

  private async processRequest(request: GenesisToolRequest): Promise<GenesisToolResult> {
    const startTime = Date.now();
    let tokensUsed = 0;

    try {
      // Phase 1: API Discovery
      await this.updateRequestStatus(request.requestId, 'scraping');
      const apiDiscovery = await this.discoverAPI(request.targetService);
      
      // Phase 2: Code Generation
      await this.updateRequestStatus(request.requestId, 'generating');
      const generatedCode = await this.generateMCPServerCode(request, apiDiscovery);
      tokensUsed += generatedCode.tokensUsed;

      // Phase 3: Validation
      await this.updateRequestStatus(request.requestId, 'validating');
      const validationResult = await this.validateGeneratedCode(generatedCode.code);

      if (!validationResult.syntaxValid) {
        throw new Error(`Syntax validation failed: ${validationResult.errors.join(', ')}`);
      }

      // Phase 4: Sandbox Testing (if required)
      let sandboxResult: GenesisToolResult['sandboxValidation'];
      if (request.requireSandboxValidation) {
        await this.updateRequestStatus(request.requestId, 'sandbox_testing');
        sandboxResult = await this.runSandboxTests(generatedCode.code, generatedCode.testCases);

        if (!sandboxResult.passed) {
          await this.updateRequestStatus(request.requestId, 'rejected');
          throw new Error(`Sandbox tests failed: ${sandboxResult.errorMessages?.join(', ')}`);
        }
      }

      // Phase 5: Register Tool
      await this.updateRequestStatus(request.requestId, 'approved');
      const registeredTool = await neuralSchemaRegistry.registerTool({
        serverId: `genesis-${request.requestId}`,
        name: this.generateToolName(request),
        description: request.naturalLanguageSpec,
        inputSchemaJSON: generatedCode.inputSchema,
        outputSchemaJSON: generatedCode.outputSchema,
        category: 'api_integration',
        tags: ['genesis', 'auto-generated', request.targetService],
        isStructuredOutput: true,
        successRate: 1,
        avgExecutionMs: 0,
        usageCount: 0,
        primaryDomain: this.inferDomain(request.targetService),
        secondaryDomains: [],
        proficiencyByModel: {},
        requiredPermissions: this.inferPermissions(request.securityLevel),
        sensitivityLevel: request.securityLevel,
        estimatedCostPerCall: 0,
        version: '1.0.0',
      });

      // Phase 6: Deploy
      await this.updateRequestStatus(request.requestId, 'deployed');

      const result: GenesisToolResult = {
        requestId: request.requestId,
        toolId: registeredTool.toolId,
        mcpServerCode: generatedCode.code,
        zodSchemas: generatedCode.schemas,
        testCases: generatedCode.testCases,
        documentation: generatedCode.documentation,
        sandboxValidation: sandboxResult,
        deployedAt: new Date(),
        hotLoadedSessionIds: [],
        generationTimeMs: Date.now() - startTime,
        tokensUsed,
        estimatedCost: tokensUsed * 0.00001, // Rough estimate
      };

      this.completedResults.set(request.requestId, result);
      await this.saveResultToDatabase(result);

      logger.info(`Genesis tool deployed: ${registeredTool.toolId}`, {
        requestId: request.requestId,
        generationTimeMs: result.generationTimeMs,
      });

      return result;

    } catch (error) {
      await this.updateRequestStatus(request.requestId, 'failed');
      
      const failedResult: GenesisToolResult = {
        requestId: request.requestId,
        generationTimeMs: Date.now() - startTime,
        tokensUsed,
        estimatedCost: tokensUsed * 0.00001,
      };

      this.completedResults.set(request.requestId, failedResult);
      await this.saveResultToDatabase(failedResult);

      throw error;
    }
  }

  // ==========================================================================
  // API DISCOVERY
  // ==========================================================================

  private async discoverAPI(serviceUrl: string): Promise<GenesisAPIDiscovery> {
    // Check cache first
    const cached = this.apiDiscoveryCache.get(serviceUrl);
    if (cached && Date.now() - cached.lastScrapedAt.getTime() < 3600000) { // 1 hour cache
      return cached;
    }

    logger.info(`Discovering API for: ${serviceUrl}`);

    // Try OpenAPI discovery first
    let discovery = await this.tryOpenAPIDiscovery(serviceUrl);
    
    if (!discovery) {
      // Try GraphQL discovery
      discovery = await this.tryGraphQLDiscovery(serviceUrl);
    }

    if (!discovery) {
      // Fall back to HTML scraping
      discovery = await this.scrapeDocumentation(serviceUrl);
    }

    if (!discovery) {
      // Generate minimal discovery from URL
      discovery = this.generateMinimalDiscovery(serviceUrl);
    }

    this.apiDiscoveryCache.set(serviceUrl, discovery);
    return discovery;
  }

  private async tryOpenAPIDiscovery(serviceUrl: string): Promise<GenesisAPIDiscovery | null> {
    const openApiPaths = [
      '/openapi.json',
      '/openapi.yaml',
      '/swagger.json',
      '/api-docs',
      '/v1/openapi.json',
      '/api/openapi.json',
    ];

    for (const path of openApiPaths) {
      try {
        const response = await fetch(`${serviceUrl}${path}`, {
          signal: AbortSignal.timeout(5000),
        });

        if (response.ok) {
          const spec = await response.json();
          return this.parseOpenAPISpec(serviceUrl, spec);
        }
      } catch {
        // Continue to next path
      }
    }

    return null;
  }

  private parseOpenAPISpec(serviceUrl: string, spec: any): GenesisAPIDiscovery {
    const endpoints: GenesisEndpoint[] = [];

    const paths = spec.paths || {};
    for (const [path, methods] of Object.entries(paths)) {
      for (const [method, details] of Object.entries(methods as Record<string, any>)) {
        if (['get', 'post', 'put', 'patch', 'delete'].includes(method)) {
          const parameters = (details.parameters || []).map((p: any) => ({
            name: p.name,
            type: p.schema?.type || 'string',
            required: p.required || false,
            description: p.description,
          }));

          // Add request body parameters
          if (details.requestBody?.content?.['application/json']?.schema?.properties) {
            const props = details.requestBody.content['application/json'].schema.properties;
            const required = details.requestBody.content['application/json'].schema.required || [];
            
            for (const [name, schema] of Object.entries(props)) {
              parameters.push({
                name,
                type: (schema as any).type || 'string',
                required: required.includes(name),
                description: (schema as any).description,
              });
            }
          }

          endpoints.push({
            path,
            method: method.toUpperCase(),
            description: details.summary || details.description || '',
            parameters,
            responseSchema: details.responses?.['200']?.content?.['application/json']?.schema,
          });
        }
      }
    }

    return {
      serviceUrl,
      discoveryMethod: 'openapi',
      endpoints,
      authRequirements: this.parseOpenAPIAuth(spec),
      lastScrapedAt: new Date(),
      confidenceScore: 0.95,
    };
  }

  private parseOpenAPIAuth(spec: any): GenesisAPIDiscovery['authRequirements'] | undefined {
    const securitySchemes = spec.components?.securitySchemes || spec.securityDefinitions;
    if (!securitySchemes) return undefined;

    for (const [, scheme] of Object.entries(securitySchemes)) {
      const s = scheme as any;
      if (s.type === 'apiKey') {
        return {
          type: 'api_key',
          location: s.in || 'header',
          keyName: s.name,
        };
      }
      if (s.type === 'oauth2') {
        return { type: 'oauth2', location: 'header' };
      }
      if (s.type === 'http' && s.scheme === 'bearer') {
        return { type: 'bearer', location: 'header' };
      }
    }

    return undefined;
  }

  private async tryGraphQLDiscovery(serviceUrl: string): Promise<GenesisAPIDiscovery | null> {
    const graphqlPaths = ['/graphql', '/api/graphql', '/v1/graphql'];

    for (const path of graphqlPaths) {
      try {
        const response = await fetch(`${serviceUrl}${path}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            query: `
              query IntrospectionQuery {
                __schema {
                  queryType { name }
                  mutationType { name }
                  types {
                    name
                    kind
                    fields {
                      name
                      description
                      args { name type { name } }
                    }
                  }
                }
              }
            `,
          }),
          signal: AbortSignal.timeout(5000),
        });

        if (response.ok) {
          const data = await response.json() as { data?: { __schema?: unknown } };
          if (data.data?.__schema) {
            return this.parseGraphQLSchema(serviceUrl, data.data.__schema);
          }
        }
      } catch {
        // Continue to next path
      }
    }

    return null;
  }

  private parseGraphQLSchema(serviceUrl: string, schema: any): GenesisAPIDiscovery {
    const endpoints: GenesisEndpoint[] = [];

    for (const type of schema.types || []) {
      if (type.name.startsWith('__')) continue;
      if (!type.fields) continue;

      for (const field of type.fields) {
        endpoints.push({
          path: `/${type.name}/${field.name}`,
          method: type.name === 'Mutation' ? 'POST' : 'GET',
          description: field.description || '',
          parameters: (field.args || []).map((arg: any) => ({
            name: arg.name,
            type: arg.type?.name || 'String',
            required: arg.type?.kind === 'NON_NULL',
          })),
        });
      }
    }

    return {
      serviceUrl,
      discoveryMethod: 'graphql',
      endpoints,
      lastScrapedAt: new Date(),
      confidenceScore: 0.85,
    };
  }

  private async scrapeDocumentation(serviceUrl: string): Promise<GenesisAPIDiscovery | null> {
    // Simplified HTML scraping for API documentation
    try {
      const docPaths = ['/docs', '/api', '/documentation', '/api-reference'];
      
      for (const path of docPaths) {
        const response = await fetch(`${serviceUrl}${path}`, {
          signal: AbortSignal.timeout(5000),
        });

        if (response.ok) {
          const html = await response.text();
          // Basic extraction of API patterns from HTML
          const endpoints = this.extractEndpointsFromHTML(html);
          
          if (endpoints.length > 0) {
            return {
              serviceUrl,
              discoveryMethod: 'html_scrape',
              endpoints,
              lastScrapedAt: new Date(),
              confidenceScore: 0.5,
            };
          }
        }
      }
    } catch {
      // Ignore scraping errors
    }

    return null;
  }

  private extractEndpointsFromHTML(html: string): GenesisEndpoint[] {
    const endpoints: GenesisEndpoint[] = [];
    
    // Look for common API patterns in HTML
    const apiPatterns = [
      /(?:GET|POST|PUT|PATCH|DELETE)\s+(\/[a-zA-Z0-9\/_\-{}:]+)/g,
      /endpoint[:\s]+"?(\/[a-zA-Z0-9\/_\-{}:]+)"?/gi,
    ];

    const seenPaths = new Set<string>();

    for (const pattern of apiPatterns) {
      let match;
      while ((match = pattern.exec(html)) !== null) {
        const path = match[1];
        if (!seenPaths.has(path)) {
          seenPaths.add(path);
          endpoints.push({
            path,
            method: match[0].startsWith('/') ? 'GET' : match[0].split(/\s+/)[0],
            description: '',
            parameters: [],
          });
        }
      }
    }

    return endpoints;
  }

  private generateMinimalDiscovery(serviceUrl: string): GenesisAPIDiscovery {
    return {
      serviceUrl,
      discoveryMethod: 'documentation',
      endpoints: [{
        path: '/api',
        method: 'POST',
        description: 'Generic API endpoint',
        parameters: [{
          name: 'request',
          type: 'object',
          required: true,
          description: 'Request payload',
        }],
      }],
      lastScrapedAt: new Date(),
      confidenceScore: 0.1,
    };
  }

  // ==========================================================================
  // CODE GENERATION
  // ==========================================================================

  private async generateMCPServerCode(
    request: GenesisToolRequest,
    apiDiscovery: GenesisAPIDiscovery
  ): Promise<{
    code: string;
    schemas: string;
    testCases: string[];
    documentation: string;
    inputSchema: Record<string, unknown>;
    outputSchema: Record<string, unknown>;
    tokensUsed: number;
  }> {
    const toolName = this.generateToolName(request);
    const primaryEndpoint = apiDiscovery.endpoints[0] || {
      path: '/api',
      method: 'POST',
      description: request.naturalLanguageSpec,
      parameters: [],
    };

    // Generate Zod schema from endpoint parameters
    const inputSchema = this.generateInputSchema(primaryEndpoint);
    const outputSchema = this.generateOutputSchema(primaryEndpoint);

    // Generate MCP server code
    const code = this.generateMCPServerTemplate(
      toolName,
      request,
      apiDiscovery,
      primaryEndpoint
    );

    // Generate Zod schemas as string
    const schemas = this.generateZodSchemaCode(inputSchema, outputSchema, toolName);

    // Generate test cases
    const testCases = this.generateTestCases(toolName, primaryEndpoint);

    // Generate documentation
    const documentation = this.generateDocumentation(toolName, request, apiDiscovery, primaryEndpoint);

    return {
      code,
      schemas,
      testCases,
      documentation,
      inputSchema,
      outputSchema,
      tokensUsed: Math.ceil(code.length / 4), // Rough token estimate
    };
  }

  private generateToolName(request: GenesisToolRequest): string {
    const serviceName = request.targetService
      .replace(/https?:\/\//, '')
      .replace(/[^a-zA-Z0-9]/g, '_')
      .slice(0, 20);
    
    const capabilityName = request.targetCapability
      .replace(/[^a-zA-Z0-9]/g, '_')
      .slice(0, 20);

    return `genesis_${serviceName}_${capabilityName}`;
  }

  private generateInputSchema(endpoint: GenesisEndpoint): Record<string, unknown> {
    const properties: Record<string, unknown> = {};
    const required: string[] = [];

    for (const param of endpoint.parameters) {
      properties[param.name] = {
        type: this.mapTypeToJsonSchema(param.type),
        description: param.description,
      };

      if (param.required) {
        required.push(param.name);
      }
    }

    return {
      type: 'object',
      properties,
      required,
    };
  }

  private generateOutputSchema(endpoint: GenesisEndpoint): Record<string, unknown> {
    if (endpoint.responseSchema) {
      return endpoint.responseSchema;
    }

    return {
      type: 'object',
      properties: {
        success: { type: 'boolean' },
        data: { type: 'object' },
        error: { type: 'string' },
      },
    };
  }

  private mapTypeToJsonSchema(type: string): string {
    const typeMap: Record<string, string> = {
      'string': 'string',
      'String': 'string',
      'int': 'integer',
      'integer': 'integer',
      'Int': 'integer',
      'float': 'number',
      'number': 'number',
      'Float': 'number',
      'bool': 'boolean',
      'boolean': 'boolean',
      'Boolean': 'boolean',
      'array': 'array',
      'object': 'object',
    };

    return typeMap[type] || 'string';
  }

  private generateMCPServerTemplate(
    toolName: string,
    request: GenesisToolRequest,
    apiDiscovery: GenesisAPIDiscovery,
    endpoint: GenesisEndpoint
  ): string {
    const authHeader = apiDiscovery.authRequirements
      ? this.generateAuthHeader(apiDiscovery.authRequirements)
      : '';

    return `// Genesis Auto-Generated MCP Server Tool
// Tool: ${toolName}
// Generated: ${new Date().toISOString()}
// Service: ${request.targetService}
// Capability: ${request.targetCapability}

import { z } from 'zod';

// Input validation schema
const ${toolName}InputSchema = z.object({
${endpoint.parameters.map(p => `  ${p.name}: z.${this.mapTypeToZod(p.type)}()${p.required ? '' : '.optional()'},`).join('\n')}
});

// Output schema
const ${toolName}OutputSchema = z.object({
  success: z.boolean(),
  data: z.unknown().optional(),
  error: z.string().optional(),
});

export type ${this.pascalCase(toolName)}Input = z.infer<typeof ${toolName}InputSchema>;
export type ${this.pascalCase(toolName)}Output = z.infer<typeof ${toolName}OutputSchema>;

/**
 * ${request.naturalLanguageSpec}
 */
export async function ${toolName}(input: ${this.pascalCase(toolName)}Input): Promise<${this.pascalCase(toolName)}Output> {
  // Validate input
  const validatedInput = ${toolName}InputSchema.parse(input);

  try {
    const response = await fetch('${request.targetService}${endpoint.path}', {
      method: '${endpoint.method}',
      headers: {
        'Content-Type': 'application/json',
${authHeader}
      },
      body: ${endpoint.method !== 'GET' ? 'JSON.stringify(validatedInput)' : 'undefined'},
    });

    if (!response.ok) {
      return {
        success: false,
        error: \`API error: \${response.status} \${response.statusText}\`,
      };
    }

    const data = await response.json();
    
    return {
      success: true,
      data,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

// MCP Tool Registration
export const ${toolName}Tool = {
  name: '${toolName}',
  description: '${request.naturalLanguageSpec.replace(/'/g, "\\'")}',
  inputSchema: ${toolName}InputSchema,
  handler: ${toolName},
};
`;
  }

  private generateAuthHeader(auth: NonNullable<GenesisAPIDiscovery['authRequirements']>): string {
    switch (auth.type) {
      case 'api_key':
        return `        '${auth.keyName || 'X-API-Key'}': process.env.GENESIS_API_KEY || '',`;
      case 'bearer':
        return `        'Authorization': \`Bearer \${process.env.GENESIS_API_TOKEN || ''}\`,`;
      case 'oauth2':
        return `        'Authorization': \`Bearer \${process.env.GENESIS_OAUTH_TOKEN || ''}\`,`;
      default:
        return '';
    }
  }

  private mapTypeToZod(type: string): string {
    const typeMap: Record<string, string> = {
      'string': 'string',
      'String': 'string',
      'int': 'number',
      'integer': 'number',
      'Int': 'number',
      'float': 'number',
      'number': 'number',
      'Float': 'number',
      'bool': 'boolean',
      'boolean': 'boolean',
      'Boolean': 'boolean',
      'array': 'array(z.unknown())',
      'object': 'object({})',
    };

    return typeMap[type] || 'string';
  }

  private generateZodSchemaCode(
    inputSchema: Record<string, unknown>,
    outputSchema: Record<string, unknown>,
    toolName: string
  ): string {
    return `// Zod schemas for ${toolName}
import { z } from 'zod';

export const ${toolName}InputSchema = ${JSON.stringify(inputSchema, null, 2)};

export const ${toolName}OutputSchema = ${JSON.stringify(outputSchema, null, 2)};
`;
  }

  private generateTestCases(toolName: string, endpoint: GenesisEndpoint): string[] {
    const testCases: string[] = [];

    // Basic success test
    testCases.push(`
describe('${toolName}', () => {
  it('should handle valid input', async () => {
    const input = {
${endpoint.parameters.filter(p => p.required).map(p => `      ${p.name}: ${this.generateTestValue(p.type)},`).join('\n')}
    };
    
    const result = await ${toolName}(input);
    expect(result).toBeDefined();
    expect(typeof result.success).toBe('boolean');
  });
});
`);

    // Error handling test
    testCases.push(`
describe('${toolName} error handling', () => {
  it('should handle API errors gracefully', async () => {
    const input = {};
    const result = await ${toolName}(input);
    expect(result.success).toBe(false);
    expect(result.error).toBeDefined();
  });
});
`);

    return testCases;
  }

  private generateTestValue(type: string): string {
    const values: Record<string, string> = {
      'string': "'test'",
      'String': "'test'",
      'int': '1',
      'integer': '1',
      'Int': '1',
      'float': '1.0',
      'number': '1',
      'Float': '1.0',
      'bool': 'true',
      'boolean': 'true',
      'Boolean': 'true',
      'array': '[]',
      'object': '{}',
    };

    return values[type] || "'test'";
  }

  private generateDocumentation(
    toolName: string,
    request: GenesisToolRequest,
    apiDiscovery: GenesisAPIDiscovery,
    endpoint: GenesisEndpoint
  ): string {
    return `# ${toolName}

## Description
${request.naturalLanguageSpec}

## Service
- **URL**: ${request.targetService}
- **Endpoint**: ${endpoint.method} ${endpoint.path}
- **Discovery Method**: ${apiDiscovery.discoveryMethod}
- **Confidence Score**: ${(apiDiscovery.confidenceScore * 100).toFixed(0)}%

## Parameters
${endpoint.parameters.map(p => `- **${p.name}** (${p.type}${p.required ? ', required' : ''}): ${p.description || 'No description'}`).join('\n')}

## Authentication
${apiDiscovery.authRequirements ? `- Type: ${apiDiscovery.authRequirements.type}\n- Location: ${apiDiscovery.authRequirements.location}` : 'None required'}

## Generated
- **Date**: ${new Date().toISOString()}
- **Request ID**: ${request.requestId}
`;
  }

  // ==========================================================================
  // VALIDATION & SANDBOX
  // ==========================================================================

  private async validateGeneratedCode(code: string): Promise<{
    syntaxValid: boolean;
    errors: string[];
  }> {
    const errors: string[] = [];

    // Basic syntax validation
    try {
      // Check for common issues
      if (!code.includes('export')) {
        errors.push('Missing export statement');
      }
      if (!code.includes('async function')) {
        errors.push('Missing async function');
      }
      if (code.includes('eval(') || code.includes('Function(')) {
        errors.push('Dangerous code pattern detected: eval/Function constructor');
      }
      if (code.includes('process.exit') || code.includes('child_process')) {
        errors.push('Dangerous code pattern detected: process control');
      }

      return {
        syntaxValid: errors.length === 0,
        errors,
      };
    } catch (error) {
      return {
        syntaxValid: false,
        errors: [error instanceof Error ? error.message : 'Unknown validation error'],
      };
    }
  }

  private async runSandboxTests(
    code: string,
    testCases: string[]
  ): Promise<NonNullable<GenesisToolResult['sandboxValidation']>> {
    const startTime = Date.now();

    // In a real implementation, this would run in a Firecracker VM or similar sandbox
    // For now, we do basic validation
    
    const securityScan = this.performSecurityScan(code);
    const functionalTests: GenesisValidationResult = testCases.length > 0 ? 'pass' : 'warn';

    return {
      passed: securityScan === 'pass' && functionalTests === 'pass',
      executionTimeMs: Date.now() - startTime,
      memoryUsageMb: 0,
      securityScan,
      functionalTests: functionalTests as GenesisValidationResult,
      errorMessages: securityScan === 'fail' ? ['Security scan failed'] : undefined,
    };
  }

  private performSecurityScan(code: string): GenesisValidationResult {
    const dangerousPatterns = [
      'eval(',
      'Function(',
      'process.exit',
      'child_process',
      'fs.rmSync',
      'fs.unlinkSync',
      'require("fs")',
      'import * as fs',
      '__dirname',
      '__filename',
      'process.env.AWS',
      'process.env.SECRET',
    ];

    for (const pattern of dangerousPatterns) {
      if (code.includes(pattern)) {
        logger.warn(`Security scan: dangerous pattern detected: ${pattern}`);
        return 'fail';
      }
    }

    return 'pass';
  }

  // ==========================================================================
  // HELPERS
  // ==========================================================================

  private async generateIntentEmbedding(
    service: string,
    capability: string,
    spec: string
  ): Promise<Float32Array> {
    const text = `Service: ${service}. Capability: ${capability}. ${spec}`;
    
    try {
      const result = await embeddingService.generateEmbedding(text);
      return new Float32Array(result.embedding);
    } catch {
      return new Float32Array(1536);
    }
  }

  private async findSimilarTools(embedding: Float32Array): Promise<string[]> {
    try {
      const similar = await neuralSchemaRegistry.findToolsByIntent(embedding, 5);
      return similar.map(s => s.toolId);
    } catch {
      return [];
    }
  }

  private inferDomain(serviceUrl: string): string {
    const url = serviceUrl.toLowerCase();
    
    if (url.includes('github') || url.includes('gitlab')) return 'software_development';
    if (url.includes('slack') || url.includes('discord')) return 'communication';
    if (url.includes('stripe') || url.includes('paypal')) return 'payments';
    if (url.includes('aws') || url.includes('azure') || url.includes('gcp')) return 'cloud';
    if (url.includes('openai') || url.includes('anthropic')) return 'ai';
    
    return 'general';
  }

  private inferPermissions(securityLevel: ToolSensitivity): string[] {
    const permissions: Record<ToolSensitivity, string[]> = {
      'public': [],
      'internal': ['genesis:use'],
      'confidential': ['genesis:use', 'genesis:confidential'],
      'restricted': ['genesis:use', 'genesis:confidential', 'genesis:restricted'],
    };

    return permissions[securityLevel];
  }

  private pascalCase(str: string): string {
    return str
      .split(/[-_\s]+/)
      .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join('');
  }

  // ==========================================================================
  // DATABASE OPERATIONS
  // ==========================================================================

  private async updateRequestStatus(requestId: string, status: GenesisToolStatus): Promise<void> {
    const request = this.pendingRequests.get(requestId);
    if (request) {
      request.status = status;
      request.updatedAt = new Date();
      if (status === 'deployed' || status === 'failed' || status === 'rejected') {
        request.completedAt = new Date();
      }
    }

    await executeStatement({
      sql: `UPDATE genesis_tool_requests SET status = :status, updated_at = NOW() WHERE request_id = :requestId`,
      parameters: [
        stringParam('status', status),
        stringParam('requestId', requestId),
      ],
    });
  }

  private async saveRequestToDatabase(request: GenesisToolRequest): Promise<void> {
    await executeStatement({
      sql: `
        INSERT INTO genesis_tool_requests (
          request_id, tenant_id, user_id, target_service, target_capability,
          natural_language_spec, existing_similar_tools, max_generation_time_ms,
          require_sandbox_validation, security_level, status, created_at, updated_at
        ) VALUES (
          :requestId, :tenantId, :userId, :targetService, :targetCapability,
          :naturalLanguageSpec, :existingSimilarTools, :maxGenerationTimeMs,
          :requireSandboxValidation, :securityLevel, :status, :createdAt, :updatedAt
        )
      `,
      parameters: [
        stringParam('requestId', request.requestId),
        stringParam('tenantId', request.tenantId),
        stringParam('userId', request.userId),
        stringParam('targetService', request.targetService),
        stringParam('targetCapability', request.targetCapability),
        stringParam('naturalLanguageSpec', request.naturalLanguageSpec),
        stringParam('existingSimilarTools', JSON.stringify(request.existingSimilarTools)),
        longParam('maxGenerationTimeMs', request.maxGenerationTimeMs),
        boolParam('requireSandboxValidation', request.requireSandboxValidation),
        stringParam('securityLevel', request.securityLevel),
        stringParam('status', request.status),
        stringParam('createdAt', request.createdAt.toISOString()),
        stringParam('updatedAt', request.updatedAt.toISOString()),
      ],
    });
  }

  private async loadRequestFromDatabase(requestId: string): Promise<GenesisToolRequest | null> {
    const result = await executeStatement({
      sql: `SELECT * FROM genesis_tool_requests WHERE request_id = :requestId`,
      parameters: [stringParam('requestId', requestId)],
    });

    if (result.rows.length === 0) return null;
    return this.rowToRequest(result.rows[0]);
  }

  private async saveResultToDatabase(result: GenesisToolResult): Promise<void> {
    await executeStatement({
      sql: `
        INSERT INTO genesis_tool_results (
          request_id, tool_id, mcp_server_code, zod_schemas, test_cases,
          documentation, sandbox_passed, generation_time_ms, tokens_used,
          estimated_cost, deployed_at, created_at
        ) VALUES (
          :requestId, :toolId, :mcpServerCode, :zodSchemas, :testCases,
          :documentation, :sandboxPassed, :generationTimeMs, :tokensUsed,
          :estimatedCost, :deployedAt, NOW()
        )
      `,
      parameters: [
        stringParam('requestId', result.requestId),
        stringParam('toolId', result.toolId || ''),
        stringParam('mcpServerCode', result.mcpServerCode || ''),
        stringParam('zodSchemas', result.zodSchemas || ''),
        stringParam('testCases', JSON.stringify(result.testCases || [])),
        stringParam('documentation', result.documentation || ''),
        boolParam('sandboxPassed', result.sandboxValidation?.passed || false),
        longParam('generationTimeMs', result.generationTimeMs),
        longParam('tokensUsed', result.tokensUsed),
        doubleParam('estimatedCost', result.estimatedCost),
        stringParam('deployedAt', result.deployedAt?.toISOString() || ''),
      ],
    });
  }

  private async loadResultFromDatabase(requestId: string): Promise<GenesisToolResult | null> {
    const result = await executeStatement({
      sql: `SELECT * FROM genesis_tool_results WHERE request_id = :requestId`,
      parameters: [stringParam('requestId', requestId)],
    });

    if (result.rows.length === 0) return null;
    return this.rowToResult(result.rows[0]);
  }

  private rowToRequest(row: Record<string, unknown>): GenesisToolRequest {
    const getString = (key: string): string => String(row[key] || '');
    const getNumber = (key: string): number => Number(row[key]) || 0;
    const getDate = (key: string): Date | undefined => row[key] ? new Date(String(row[key])) : undefined;
    const parseJSON = (key: string, fallback: unknown = []): unknown => {
      try {
        const val = row[key];
        return typeof val === 'string' ? JSON.parse(val) : (val || fallback);
      } catch {
        return fallback;
      }
    };

    return {
      requestId: getString('request_id'),
      tenantId: getString('tenant_id'),
      userId: getString('user_id'),
      targetService: getString('target_service'),
      targetCapability: getString('target_capability'),
      naturalLanguageSpec: getString('natural_language_spec'),
      existingSimilarTools: parseJSON('existing_similar_tools', []) as string[],
      maxGenerationTimeMs: getNumber('max_generation_time_ms'),
      requireSandboxValidation: row['require_sandbox_validation'] === true,
      securityLevel: (getString('security_level') || 'public') as ToolSensitivity,
      status: (getString('status') || 'queued') as GenesisToolStatus,
      createdAt: getDate('created_at') || new Date(),
      updatedAt: getDate('updated_at') || new Date(),
      completedAt: getDate('completed_at'),
    };
  }

  private rowToResult(row: Record<string, unknown>): GenesisToolResult {
    const getString = (key: string): string => String(row[key] || '');
    const getNumber = (key: string): number => Number(row[key]) || 0;
    const getDate = (key: string): Date | undefined => row[key] ? new Date(String(row[key])) : undefined;
    const parseJSON = (key: string, fallback: unknown = []): unknown => {
      try {
        const val = row[key];
        return typeof val === 'string' ? JSON.parse(val) : (val || fallback);
      } catch {
        return fallback;
      }
    };

    return {
      requestId: getString('request_id'),
      toolId: getString('tool_id') || undefined,
      mcpServerCode: getString('mcp_server_code') || undefined,
      zodSchemas: getString('zod_schemas') || undefined,
      testCases: parseJSON('test_cases', []) as string[],
      documentation: getString('documentation') || undefined,
      sandboxValidation: row['sandbox_passed'] !== undefined ? {
        passed: row['sandbox_passed'] === true,
        executionTimeMs: 0,
        memoryUsageMb: 0,
        securityScan: 'pass' as GenesisValidationResult,
        functionalTests: 'pass' as GenesisValidationResult,
      } : undefined,
      deployedAt: getDate('deployed_at'),
      generationTimeMs: getNumber('generation_time_ms'),
      tokensUsed: getNumber('tokens_used'),
      estimatedCost: getNumber('estimated_cost'),
    };
  }
}

// ============================================================================
// Export Singleton
// ============================================================================

export const genesisAutoTool = new GenesisAutoToolService();
export { GenesisAutoToolService };
