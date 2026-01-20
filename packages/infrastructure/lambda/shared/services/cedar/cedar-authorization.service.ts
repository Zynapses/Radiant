/**
 * RADIANT Cedar Authorization Service v1.0
 * 
 * Provides resource-level ABAC authorization for the Multi-Protocol Gateway.
 * Uses Cedar policy language for fine-grained access control.
 */

import { Logger } from '@aws-lambda-powertools/logger';

const logger = new Logger({ serviceName: 'cedar-authorization' });

// =============================================================================
// TYPES
// =============================================================================

export type PrincipalType = 'User' | 'Agent' | 'Service';
export type ActionType = 
  | 'tool:read' 
  | 'tool:execute' 
  | 'model:invoke' 
  | 'model:stream'
  | 'session:create'
  | 'session:resume'
  | 'admin:impersonate'
  | 'admin:configure';

export interface Principal {
  type: PrincipalType;
  id: string;
  tenantId: string;
  role?: string;
  tier?: string;
  scopes: string[];
  labels: string[];
  namespace?: string;
  department?: string;
  active: boolean;
  internal?: boolean;
}

export interface ToolResource {
  type: 'Tool';
  id: string;
  name: string;
  namespace: string;
  owner: string;
  destructive: boolean;
  sensitive: boolean;
  requiredScopes: string[];
  labels: string[];
  rateLimit: number;
}

export interface ModelResource {
  type: 'Model';
  id: string;
  provider: string;
  tier: string;
  costPerToken: number;
  maxTokens: number;
  labels: string[];
}

export interface SessionResource {
  type: 'Session';
  id: string;
  protocol: string;
  createdAt: number;
  expiresAt: number;
}

export interface TenantResource {
  type: 'Tenant';
  id: string;
  name: string;
  tier: string;
  active: boolean;
}

export type Resource = ToolResource | ModelResource | SessionResource | TenantResource;

export interface AuthorizationContext {
  tenantId: string;
  sourceProtocol?: string;
  sessionId?: string;
  parameters?: string;
  estimatedTokens?: number;
  tokenBudget?: number;
  rateLimitRemaining?: number;
  concurrentSessions?: number;
  maxConcurrentSessions?: number;
  tenantMonthlySpend?: number;
  tenantMonthlyBudget?: number;
  clientIP?: string;
  resumeToken?: string;
  reason?: string;
  configKey?: string;
}

export interface AuthorizationRequest {
  principal: Principal;
  action: ActionType;
  resource: Resource;
  context: AuthorizationContext;
}

export interface AuthorizationResult {
  allowed: boolean;
  decision: 'ALLOW' | 'DENY' | 'FORBID';
  matchedPolicies: string[];
  diagnostics?: string[];
}

// =============================================================================
// CEDAR AUTHORIZATION SERVICE
// =============================================================================

export class CedarAuthorizationService {
  private readonly tenantCache: Map<string, TenantResource> = new Map();
  
  constructor(
    private readonly config: {
      cacheEnabled?: boolean;
      cacheTtlMs?: number;
      strictMode?: boolean;
    } = {}
  ) {}

  /**
   * Authorize a request against Cedar policies.
   * Returns whether the action is allowed and which policies matched.
   */
  async authorize(request: AuthorizationRequest): Promise<AuthorizationResult> {
    const startTime = Date.now();
    const matchedPolicies: string[] = [];
    const diagnostics: string[] = [];

    try {
      // Validate principal is active
      if (!request.principal.active) {
        return {
          allowed: false,
          decision: 'FORBID',
          matchedPolicies: ['deny-inactive'],
          diagnostics: ['Principal is not active']
        };
      }

      // Check cross-tenant access (CRITICAL)
      const crossTenantResult = this.checkCrossTenantAccess(request);
      if (!crossTenantResult.allowed) {
        return crossTenantResult;
      }

      // Check rate limiting
      const rateLimitResult = this.checkRateLimits(request);
      if (!rateLimitResult.allowed) {
        return rateLimitResult;
      }

      // Check action-specific policies
      let result: AuthorizationResult;
      
      switch (request.action) {
        case 'tool:read':
          result = this.authorizeToolRead(request);
          break;
        case 'tool:execute':
          result = this.authorizeToolExecute(request);
          break;
        case 'model:invoke':
        case 'model:stream':
          result = this.authorizeModelAccess(request);
          break;
        case 'session:create':
        case 'session:resume':
          result = this.authorizeSessionAction(request);
          break;
        case 'admin:impersonate':
        case 'admin:configure':
          result = this.authorizeAdminAction(request);
          break;
        default:
          result = {
            allowed: false,
            decision: 'DENY',
            matchedPolicies: [],
            diagnostics: [`Unknown action: ${request.action}`]
          };
      }

      const duration = Date.now() - startTime;
      logger.info('Authorization decision', {
        principal: `${request.principal.type}:${request.principal.id}`,
        action: request.action,
        resource: `${request.resource.type}:${request.resource.id}`,
        allowed: result.allowed,
        decision: result.decision,
        matchedPolicies: result.matchedPolicies,
        durationMs: duration
      });

      return result;

    } catch (error) {
      logger.error('Authorization error', { error, request });
      
      // In strict mode, deny on error
      if (this.config.strictMode) {
        return {
          allowed: false,
          decision: 'DENY',
          matchedPolicies: ['error-fallback'],
          diagnostics: [`Authorization error: ${error}`]
        };
      }
      
      throw error;
    }
  }

  /**
   * Batch authorize multiple requests efficiently.
   */
  async authorizeBatch(requests: AuthorizationRequest[]): Promise<AuthorizationResult[]> {
    return Promise.all(requests.map(r => this.authorize(r)));
  }

  // ===========================================================================
  // CROSS-TENANT CHECK (CRITICAL)
  // ===========================================================================

  private checkCrossTenantAccess(request: AuthorizationRequest): AuthorizationResult {
    const principalTenantId = request.principal.tenantId;
    const contextTenantId = request.context.tenantId;

    // Context tenant must match principal tenant
    if (contextTenantId !== principalTenantId) {
      // Exception: super_admin can access any tenant
      if (request.principal.type === 'User' && request.principal.role === 'super_admin') {
        return { allowed: true, decision: 'ALLOW', matchedPolicies: ['super-admin-all'] };
      }

      // Exception: internal services can access any tenant
      if (request.principal.type === 'Service' && request.principal.internal) {
        return { allowed: true, decision: 'ALLOW', matchedPolicies: ['internal-service-all'] };
      }

      return {
        allowed: false,
        decision: 'FORBID',
        matchedPolicies: ['deny-cross-tenant'],
        diagnostics: [`Cross-tenant access denied: ${principalTenantId} -> ${contextTenantId}`]
      };
    }

    return { allowed: true, decision: 'ALLOW', matchedPolicies: [] };
  }

  // ===========================================================================
  // RATE LIMIT CHECK
  // ===========================================================================

  private checkRateLimits(request: AuthorizationRequest): AuthorizationResult {
    const ctx = request.context;

    // Check rate limit exhaustion
    if (ctx.rateLimitRemaining !== undefined && ctx.rateLimitRemaining <= 0) {
      return {
        allowed: false,
        decision: 'FORBID',
        matchedPolicies: ['rate-limit-tool-exhausted'],
        diagnostics: ['Rate limit exhausted']
      };
    }

    // Check token budget
    if (ctx.estimatedTokens !== undefined && ctx.tokenBudget !== undefined) {
      if (ctx.estimatedTokens > ctx.tokenBudget) {
        return {
          allowed: false,
          decision: 'FORBID',
          matchedPolicies: ['token-budget-exceeded'],
          diagnostics: [`Token budget exceeded: ${ctx.estimatedTokens} > ${ctx.tokenBudget}`]
        };
      }
    }

    // Check concurrent sessions
    if (ctx.concurrentSessions !== undefined && ctx.maxConcurrentSessions !== undefined) {
      if (ctx.concurrentSessions >= ctx.maxConcurrentSessions) {
        return {
          allowed: false,
          decision: 'FORBID',
          matchedPolicies: ['concurrent-session-limit'],
          diagnostics: [`Concurrent session limit reached: ${ctx.concurrentSessions}/${ctx.maxConcurrentSessions}`]
        };
      }
    }

    // Check tenant budget
    if (ctx.tenantMonthlySpend !== undefined && ctx.tenantMonthlyBudget !== undefined) {
      if (ctx.tenantMonthlySpend >= ctx.tenantMonthlyBudget) {
        const resource = request.resource;
        if (resource.type === 'Model' && resource.costPerToken > 100) {
          return {
            allowed: false,
            decision: 'FORBID',
            matchedPolicies: ['tenant-budget-exceeded'],
            diagnostics: ['Tenant monthly budget exceeded for premium models']
          };
        }
      }
    }

    return { allowed: true, decision: 'ALLOW', matchedPolicies: [] };
  }

  // ===========================================================================
  // TOOL AUTHORIZATION
  // ===========================================================================

  private authorizeToolRead(request: AuthorizationRequest): AuthorizationResult {
    const principal = request.principal;
    const resource = request.resource as ToolResource;

    // Super admin bypass
    if (principal.type === 'User' && principal.role === 'super_admin') {
      return { allowed: true, decision: 'ALLOW', matchedPolicies: ['super-admin-all'] };
    }

    // Internal service bypass
    if (principal.type === 'Service' && principal.internal) {
      return { allowed: true, decision: 'ALLOW', matchedPolicies: ['internal-service-all'] };
    }

    // Check scope
    if (!principal.scopes.includes('tool:read')) {
      return {
        allowed: false,
        decision: 'DENY',
        matchedPolicies: [],
        diagnostics: ['Missing scope: tool:read']
      };
    }

    // Users can read any tool in their tenant
    if (principal.type === 'User') {
      return { allowed: true, decision: 'ALLOW', matchedPolicies: ['user-tool-read'] };
    }

    // Agents can read tools in their namespace or public
    if (principal.type === 'Agent') {
      if (resource.namespace === principal.namespace || resource.namespace === 'public') {
        return { allowed: true, decision: 'ALLOW', matchedPolicies: ['agent-tool-read-namespace'] };
      }
      return {
        allowed: false,
        decision: 'DENY',
        matchedPolicies: [],
        diagnostics: [`Agent namespace ${principal.namespace} cannot read tool in ${resource.namespace}`]
      };
    }

    return { allowed: false, decision: 'DENY', matchedPolicies: [] };
  }

  private authorizeToolExecute(request: AuthorizationRequest): AuthorizationResult {
    const principal = request.principal;
    const resource = request.resource as ToolResource;

    // Super admin bypass
    if (principal.type === 'User' && principal.role === 'super_admin') {
      return { allowed: true, decision: 'ALLOW', matchedPolicies: ['super-admin-all'] };
    }

    // Internal service bypass
    if (principal.type === 'Service' && principal.internal) {
      return { allowed: true, decision: 'ALLOW', matchedPolicies: ['internal-service-all'] };
    }

    // Check scope
    if (!principal.scopes.includes('tool:execute')) {
      return {
        allowed: false,
        decision: 'DENY',
        matchedPolicies: [],
        diagnostics: ['Missing scope: tool:execute']
      };
    }

    // Check sensitive resource protection
    if (resource.sensitive && !principal.labels.includes('sensitive-access')) {
      return {
        allowed: false,
        decision: 'FORBID',
        matchedPolicies: ['deny-sensitive-without-label'],
        diagnostics: ['Sensitive tool access requires sensitive-access label']
      };
    }

    // User authorization
    if (principal.type === 'User') {
      // Power users can execute destructive (non-sensitive) tools
      if (resource.destructive) {
        if (['power_user', 'admin', 'super_admin'].includes(principal.role || '')) {
          return { allowed: true, decision: 'ALLOW', matchedPolicies: ['power-user-tool-execute-destructive'] };
        }
        return {
          allowed: false,
          decision: 'DENY',
          matchedPolicies: [],
          diagnostics: ['Destructive tools require power_user role or higher']
        };
      }

      // Regular users can execute safe tools
      return { allowed: true, decision: 'ALLOW', matchedPolicies: ['user-tool-execute-safe'] };
    }

    // Agent authorization
    if (principal.type === 'Agent') {
      // Agents can execute tools in their namespace
      if (resource.namespace === principal.namespace) {
        return { allowed: true, decision: 'ALLOW', matchedPolicies: ['agent-tool-execute-namespace'] };
      }

      // Premium agents can execute public tools
      if (principal.tier === 'premium' && resource.namespace === 'public' && !resource.sensitive) {
        return { allowed: true, decision: 'ALLOW', matchedPolicies: ['premium-agent-tool-execute-public'] };
      }

      return {
        allowed: false,
        decision: 'DENY',
        matchedPolicies: [],
        diagnostics: [`Agent cannot execute tool outside namespace: ${resource.namespace}`]
      };
    }

    return { allowed: false, decision: 'DENY', matchedPolicies: [] };
  }

  // ===========================================================================
  // MODEL AUTHORIZATION
  // ===========================================================================

  private authorizeModelAccess(request: AuthorizationRequest): AuthorizationResult {
    const principal = request.principal;
    const resource = request.resource as ModelResource;
    const action = request.action;

    // Super admin bypass
    if (principal.type === 'User' && principal.role === 'super_admin') {
      return { allowed: true, decision: 'ALLOW', matchedPolicies: ['super-admin-all'] };
    }

    // Internal service bypass
    if (principal.type === 'Service' && principal.internal) {
      return { allowed: true, decision: 'ALLOW', matchedPolicies: ['internal-service-all'] };
    }

    // Check scope
    const requiredScope = action === 'model:stream' ? 'model:stream' : 'model:invoke';
    if (!principal.scopes.includes(requiredScope)) {
      return {
        allowed: false,
        decision: 'DENY',
        matchedPolicies: [],
        diagnostics: [`Missing scope: ${requiredScope}`]
      };
    }

    // User model access
    if (principal.type === 'User') {
      return { allowed: true, decision: 'ALLOW', matchedPolicies: ['user-model-invoke'] };
    }

    // Agent tier-based model access
    if (principal.type === 'Agent') {
      const agentTier = principal.tier || 'basic';
      const modelTier = resource.tier;

      if (modelTier === 'free') {
        return { allowed: true, decision: 'ALLOW', matchedPolicies: ['agent-model-invoke-tier'] };
      }

      if (modelTier === 'standard' && ['standard', 'premium'].includes(agentTier)) {
        return { allowed: true, decision: 'ALLOW', matchedPolicies: ['agent-model-invoke-tier'] };
      }

      if (modelTier === 'premium' && agentTier === 'premium') {
        return { allowed: true, decision: 'ALLOW', matchedPolicies: ['agent-model-invoke-tier'] };
      }

      return {
        allowed: false,
        decision: 'FORBID',
        matchedPolicies: ['premium-model-agent-tier-check'],
        diagnostics: [`Agent tier ${agentTier} cannot access ${modelTier} models`]
      };
    }

    return { allowed: false, decision: 'DENY', matchedPolicies: [] };
  }

  // ===========================================================================
  // SESSION AUTHORIZATION
  // ===========================================================================

  private authorizeSessionAction(request: AuthorizationRequest): AuthorizationResult {
    const principal = request.principal;

    // Any active principal can create/resume sessions
    if (principal.active) {
      const policy = request.action === 'session:create' ? 'session-create' : 'session-resume';
      return { allowed: true, decision: 'ALLOW', matchedPolicies: [policy] };
    }

    return {
      allowed: false,
      decision: 'FORBID',
      matchedPolicies: ['deny-inactive'],
      diagnostics: ['Inactive principals cannot manage sessions']
    };
  }

  // ===========================================================================
  // ADMIN AUTHORIZATION
  // ===========================================================================

  private authorizeAdminAction(request: AuthorizationRequest): AuthorizationResult {
    const principal = request.principal;

    if (principal.type !== 'User') {
      return {
        allowed: false,
        decision: 'DENY',
        matchedPolicies: [],
        diagnostics: ['Only users can perform admin actions']
      };
    }

    // Impersonation requires super_admin
    if (request.action === 'admin:impersonate') {
      if (principal.role === 'super_admin') {
        return { allowed: true, decision: 'ALLOW', matchedPolicies: ['super-admin-impersonate'] };
      }
      return {
        allowed: false,
        decision: 'DENY',
        matchedPolicies: [],
        diagnostics: ['Impersonation requires super_admin role']
      };
    }

    // Configuration requires admin or higher
    if (request.action === 'admin:configure') {
      if (['admin', 'super_admin'].includes(principal.role || '')) {
        return { allowed: true, decision: 'ALLOW', matchedPolicies: ['admin-configure-tenant'] };
      }
      return {
        allowed: false,
        decision: 'DENY',
        matchedPolicies: [],
        diagnostics: ['Configuration requires admin role or higher']
      };
    }

    return { allowed: false, decision: 'DENY', matchedPolicies: [] };
  }

  // ===========================================================================
  // UTILITY METHODS
  // ===========================================================================

  /**
   * Check if principal has specific scope.
   */
  hasScope(principal: Principal, scope: string): boolean {
    return principal.scopes.includes(scope);
  }

  /**
   * Check if principal has specific label.
   */
  hasLabel(principal: Principal, label: string): boolean {
    return principal.labels.includes(label);
  }

  /**
   * Create a principal from OIDC claims.
   */
  createUserPrincipal(claims: {
    sub: string;
    tenant_id: string;
    role?: string;
    scopes?: string[];
    department?: string;
  }): Principal {
    return {
      type: 'User',
      id: claims.sub,
      tenantId: claims.tenant_id,
      role: claims.role || 'user',
      scopes: claims.scopes || ['tool:read', 'model:invoke'],
      labels: [],
      department: claims.department,
      active: true
    };
  }

  /**
   * Create a principal from mTLS certificate.
   */
  createAgentPrincipal(cert: {
    agentId: string;
    tenantId: string;
    tier?: string;
    scopes?: string[];
    namespace?: string;
    labels?: string[];
  }): Principal {
    return {
      type: 'Agent',
      id: cert.agentId,
      tenantId: cert.tenantId,
      tier: cert.tier || 'basic',
      scopes: cert.scopes || ['tool:read', 'tool:execute', 'model:invoke'],
      labels: cert.labels || [],
      namespace: cert.namespace || cert.agentId,
      active: true
    };
  }

  /**
   * Create an internal service principal.
   */
  createServicePrincipal(serviceName: string, tenantId: string): Principal {
    return {
      type: 'Service',
      id: serviceName,
      tenantId,
      scopes: ['*'],
      labels: ['internal'],
      internal: true,
      active: true
    };
  }
}

// Singleton instance
let instance: CedarAuthorizationService | null = null;

export function getCedarAuthorizationService(config?: {
  cacheEnabled?: boolean;
  cacheTtlMs?: number;
  strictMode?: boolean;
}): CedarAuthorizationService {
  if (!instance) {
    instance = new CedarAuthorizationService(config);
  }
  return instance;
}

export default CedarAuthorizationService;
