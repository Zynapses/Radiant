/**
 * RADIANT OAuth 2.0 Provider Types
 * 
 * RFC 6749 compliant OAuth Authorization Server for third-party app integration.
 * Enables MCP servers, Zapier, partner apps, and other integrations.
 */

// ============================================================================
// SCOPE CATEGORIES & DEFINITIONS
// ============================================================================

export type ScopeCategory =
  | 'profile'
  | 'chat'
  | 'knowledge'
  | 'models'
  | 'usage'
  | 'files'
  | 'agents';

export type ScopeRiskLevel = 'low' | 'medium' | 'high';

export interface ScopeEndpoint {
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  path: string;
}

export interface OAuthScope {
  name: string;
  category: ScopeCategory;
  displayName: string;
  description: string;
  riskLevel: ScopeRiskLevel;
  allowedEndpoints: ScopeEndpoint[];
  isEnabled: boolean;
  requiresApproval: boolean;
  allowedAppTypes: OAuthAppType[];
}

// ============================================================================
// APP TYPES
// ============================================================================

export type OAuthAppType =
  | 'web_application'
  | 'native_application'
  | 'single_page_application'
  | 'machine_to_machine'
  | 'mcp_server';

export type OAuthAppStatus = 'pending' | 'approved' | 'rejected' | 'suspended';

// ============================================================================
// OAUTH CLIENT (Registered Application)
// ============================================================================

export interface OAuthClient {
  id: string;
  clientId: string;
  name: string;
  description?: string;
  logoUrl?: string;
  homepageUrl?: string;
  privacyPolicyUrl?: string;
  termsOfServiceUrl?: string;
  appType: OAuthAppType;
  isConfidential: boolean;
  redirectUris: string[];
  allowedScopes: string[];
  defaultScopes: string[];
  allowedGrantTypes: GrantType[];
  accessTokenTtlSeconds: number;
  refreshTokenTtlSeconds: number;
  rateLimitRequestsPerMinute: number;
  rateLimitTokensPerDay: number;
  createdByTenantId?: string;
  createdByUserId?: string;
  status: OAuthAppStatus;
  approvedBy?: string;
  approvedAt?: string;
  rejectionReason?: string;
  allowedTenantIds?: string[];
  blockedTenantIds: string[];
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
  lastUsedAt?: string;
}

export type GrantType =
  | 'authorization_code'
  | 'refresh_token'
  | 'client_credentials';

// ============================================================================
// AUTHORIZATION CODE
// ============================================================================

export interface OAuthAuthorizationCode {
  id: string;
  code: string;
  clientId: string;
  userId: string;
  tenantId: string;
  redirectUri: string;
  scopes: string[];
  state?: string;
  codeChallenge?: string;
  codeChallengeMethod?: 'S256' | 'plain';
  nonce?: string;
  isUsed: boolean;
  usedAt?: string;
  expiresAt: string;
  createdAt: string;
}

// ============================================================================
// TOKENS
// ============================================================================

export interface OAuthAccessToken {
  id: string;
  tokenHash: string;
  tokenPrefix: string;
  clientId: string;
  userId?: string;
  tenantId: string;
  scopes: string[];
  tokenType: string;
  refreshTokenId?: string;
  expiresAt: string;
  isRevoked: boolean;
  revokedAt?: string;
  revokedReason?: string;
  lastUsedAt?: string;
  useCount: number;
  clientIp?: string;
  userAgent?: string;
  createdAt: string;
}

export interface OAuthRefreshToken {
  id: string;
  tokenHash: string;
  tokenPrefix: string;
  clientId: string;
  userId: string;
  tenantId: string;
  scopes: string[];
  generation: number;
  previousTokenId?: string;
  expiresAt: string;
  isRevoked: boolean;
  revokedAt?: string;
  revokedReason?: string;
  lastUsedAt?: string;
  useCount: number;
  createdAt: string;
}

// ============================================================================
// USER AUTHORIZATION (Consent)
// ============================================================================

export interface OAuthUserAuthorization {
  id: string;
  userId: string;
  tenantId: string;
  clientId: string;
  scopes: string[];
  isActive: boolean;
  revokedAt?: string;
  revokedReason?: string;
  createdAt: string;
  updatedAt: string;
  lastUsedAt?: string;
}

// ============================================================================
// AUDIT LOG
// ============================================================================

export type OAuthEventType =
  | 'authorization_requested'
  | 'authorization_granted'
  | 'authorization_denied'
  | 'token_issued'
  | 'token_refreshed'
  | 'token_revoked'
  | 'app_registered'
  | 'app_approved'
  | 'app_rejected'
  | 'app_suspended'
  | 'consent_revoked';

export interface OAuthAuditEntry {
  id: string;
  eventType: OAuthEventType;
  clientId?: string;
  userId?: string;
  tenantId?: string;
  scopes?: string[];
  details: Record<string, unknown>;
  ipAddress?: string;
  userAgent?: string;
  success: boolean;
  errorCode?: string;
  errorMessage?: string;
  createdAt: string;
}

// ============================================================================
// API REQUEST/RESPONSE TYPES
// ============================================================================

export interface AuthorizeRequest {
  clientId: string;
  redirectUri: string;
  responseType: 'code';
  scope?: string;
  state?: string;
  codeChallenge?: string;
  codeChallengeMethod?: 'S256' | 'plain';
  nonce?: string;
}

export interface TokenRequest {
  grantType: GrantType;
  code?: string;
  redirectUri?: string;
  clientId: string;
  clientSecret?: string;
  codeVerifier?: string;
  refreshToken?: string;
  scope?: string;
}

export interface TokenResponse {
  access_token: string;
  token_type: 'Bearer';
  expires_in: number;
  refresh_token?: string;
  scope: string;
  id_token?: string;
}

export interface TokenErrorResponse {
  error: string;
  error_description?: string;
  error_uri?: string;
}

export interface UserInfoResponse {
  sub: string;
  email?: string;
  email_verified?: boolean;
  name?: string;
  given_name?: string;
  family_name?: string;
  picture?: string;
  tenant_id: string;
}

export interface IntrospectionResponse {
  active: boolean;
  scope?: string;
  client_id?: string;
  username?: string;
  token_type?: string;
  exp?: number;
  iat?: number;
  sub?: string;
  aud?: string;
  iss?: string;
  tenant_id?: string;
}

// ============================================================================
// ADMIN TYPES
// ============================================================================

export interface RegisterAppRequest {
  name: string;
  description?: string;
  logoUrl?: string;
  homepageUrl?: string;
  privacyPolicyUrl?: string;
  termsOfServiceUrl?: string;
  appType: OAuthAppType;
  redirectUris: string[];
  requestedScopes: string[];
}

export interface RegisterAppResponse {
  clientId: string;
  clientSecret?: string;
  app: OAuthClient;
}

export interface OAuthAppStats {
  clientId: string;
  name: string;
  totalAuthorizations: number;
  activeAuthorizations: number;
  totalTokensIssued: number;
  activeTokens: number;
  requestsLast24h: number;
  requestsLast7d: number;
  lastUsedAt?: string;
}

export interface OAuthDashboard {
  totalApps: number;
  appsByStatus: Record<OAuthAppStatus, number>;
  appsByType: Record<OAuthAppType, number>;
  pendingApprovals: OAuthClient[];
  topApps: OAuthAppStats[];
  totalAuthorizations: number;
  activeAuthorizations: number;
  eventsLast24h: number;
}

export interface ConnectedApp {
  clientId: string;
  name: string;
  description?: string;
  logoUrl?: string;
  homepageUrl?: string;
  scopes: string[];
  authorizedAt: string;
  lastUsedAt?: string;
}

// ============================================================================
// DEFAULT SCOPES
// ============================================================================

export const DEFAULT_OAUTH_SCOPES: OAuthScope[] = [
  // Profile (OIDC standard)
  {
    name: 'openid',
    category: 'profile',
    displayName: 'OpenID',
    description: 'Verify your identity',
    riskLevel: 'low',
    allowedEndpoints: [{ method: 'GET', path: '/oauth/userinfo' }],
    isEnabled: true,
    requiresApproval: false,
    allowedAppTypes: ['web_application', 'native_application', 'single_page_application', 'mcp_server'],
  },
  {
    name: 'profile',
    category: 'profile',
    displayName: 'Profile',
    description: 'Read your basic profile information (name, email)',
    riskLevel: 'low',
    allowedEndpoints: [
      { method: 'GET', path: '/oauth/userinfo' },
      { method: 'GET', path: '/api/v2/users/me' },
    ],
    isEnabled: true,
    requiresApproval: false,
    allowedAppTypes: ['web_application', 'native_application', 'single_page_application', 'mcp_server'],
  },
  {
    name: 'email',
    category: 'profile',
    displayName: 'Email',
    description: 'Read your email address',
    riskLevel: 'low',
    allowedEndpoints: [{ method: 'GET', path: '/oauth/userinfo' }],
    isEnabled: true,
    requiresApproval: false,
    allowedAppTypes: ['web_application', 'native_application', 'single_page_application', 'mcp_server'],
  },
  {
    name: 'offline_access',
    category: 'profile',
    displayName: 'Offline Access',
    description: "Access your data when you're not actively using the app",
    riskLevel: 'medium',
    allowedEndpoints: [],
    isEnabled: true,
    requiresApproval: false,
    allowedAppTypes: ['web_application', 'native_application', 'mcp_server'],
  },

  // Chat
  {
    name: 'chat:read',
    category: 'chat',
    displayName: 'Read Conversations',
    description: 'View your conversations and messages',
    riskLevel: 'medium',
    allowedEndpoints: [
      { method: 'GET', path: '/api/v2/conversations' },
      { method: 'GET', path: '/api/v2/conversations/*' },
      { method: 'GET', path: '/api/v2/messages/*' },
    ],
    isEnabled: true,
    requiresApproval: false,
    allowedAppTypes: ['web_application', 'native_application', 'single_page_application', 'mcp_server'],
  },
  {
    name: 'chat:write',
    category: 'chat',
    displayName: 'Send Messages',
    description: 'Create conversations and send messages on your behalf',
    riskLevel: 'high',
    allowedEndpoints: [
      { method: 'POST', path: '/api/v2/conversations' },
      { method: 'POST', path: '/api/v2/chat/completions' },
      { method: 'PATCH', path: '/api/v2/conversations/*' },
    ],
    isEnabled: true,
    requiresApproval: true,
    allowedAppTypes: ['web_application', 'native_application', 'mcp_server'],
  },
  {
    name: 'chat:delete',
    category: 'chat',
    displayName: 'Delete Conversations',
    description: 'Delete your conversations',
    riskLevel: 'high',
    allowedEndpoints: [{ method: 'DELETE', path: '/api/v2/conversations/*' }],
    isEnabled: true,
    requiresApproval: true,
    allowedAppTypes: ['web_application', 'native_application'],
  },

  // Knowledge (Cortex)
  {
    name: 'knowledge:read',
    category: 'knowledge',
    displayName: 'Query Knowledge Base',
    description: 'Search and retrieve information from your knowledge base',
    riskLevel: 'medium',
    allowedEndpoints: [
      { method: 'POST', path: '/api/v2/cortex/query' },
      { method: 'GET', path: '/api/v2/cortex/entities' },
      { method: 'GET', path: '/api/v2/cortex/entities/*' },
    ],
    isEnabled: true,
    requiresApproval: false,
    allowedAppTypes: ['web_application', 'native_application', 'single_page_application', 'mcp_server'],
  },
  {
    name: 'knowledge:write',
    category: 'knowledge',
    displayName: 'Add to Knowledge Base',
    description: 'Upload documents and add information to your knowledge base',
    riskLevel: 'high',
    allowedEndpoints: [
      { method: 'POST', path: '/api/v2/cortex/ingest' },
      { method: 'POST', path: '/api/v2/cortex/entities' },
      { method: 'PATCH', path: '/api/v2/cortex/entities/*' },
    ],
    isEnabled: true,
    requiresApproval: true,
    allowedAppTypes: ['web_application', 'native_application', 'mcp_server'],
  },

  // Models
  {
    name: 'models:read',
    category: 'models',
    displayName: 'List AI Models',
    description: 'View available AI models',
    riskLevel: 'low',
    allowedEndpoints: [
      { method: 'GET', path: '/api/v2/models' },
      { method: 'GET', path: '/api/v2/models/*' },
    ],
    isEnabled: true,
    requiresApproval: false,
    allowedAppTypes: ['web_application', 'native_application', 'single_page_application', 'machine_to_machine', 'mcp_server'],
  },

  // Usage
  {
    name: 'usage:read',
    category: 'usage',
    displayName: 'View Usage',
    description: 'View your API usage and billing information',
    riskLevel: 'low',
    allowedEndpoints: [
      { method: 'GET', path: '/api/v2/usage' },
      { method: 'GET', path: '/api/v2/usage/*' },
    ],
    isEnabled: true,
    requiresApproval: false,
    allowedAppTypes: ['web_application', 'native_application', 'single_page_application'],
  },

  // Files
  {
    name: 'files:read',
    category: 'files',
    displayName: 'Read Files',
    description: 'View and download your uploaded files',
    riskLevel: 'medium',
    allowedEndpoints: [
      { method: 'GET', path: '/api/v2/files' },
      { method: 'GET', path: '/api/v2/files/*' },
    ],
    isEnabled: true,
    requiresApproval: false,
    allowedAppTypes: ['web_application', 'native_application', 'mcp_server'],
  },
  {
    name: 'files:write',
    category: 'files',
    displayName: 'Upload Files',
    description: 'Upload files on your behalf',
    riskLevel: 'high',
    allowedEndpoints: [
      { method: 'POST', path: '/api/v2/files' },
      { method: 'DELETE', path: '/api/v2/files/*' },
    ],
    isEnabled: true,
    requiresApproval: true,
    allowedAppTypes: ['web_application', 'native_application', 'mcp_server'],
  },

  // Agents
  {
    name: 'agents:execute',
    category: 'agents',
    displayName: 'Execute Agents',
    description: 'Run AI agents on your behalf',
    riskLevel: 'high',
    allowedEndpoints: [
      { method: 'POST', path: '/api/v2/agents/*/execute' },
      { method: 'GET', path: '/api/v2/agents/*/runs/*' },
    ],
    isEnabled: true,
    requiresApproval: true,
    allowedAppTypes: ['web_application', 'native_application', 'mcp_server'],
  },
];

// ============================================================================
// HELPERS
// ============================================================================

export function getScopeByName(name: string): OAuthScope | undefined {
  return DEFAULT_OAUTH_SCOPES.find(s => s.name === name);
}

export function getScopesByCategory(category: ScopeCategory): OAuthScope[] {
  return DEFAULT_OAUTH_SCOPES.filter(s => s.category === category);
}

export function getScopesByRiskLevel(level: ScopeRiskLevel): OAuthScope[] {
  return DEFAULT_OAUTH_SCOPES.filter(s => s.riskLevel === level);
}

export function isEndpointAllowedByScopes(
  scopes: string[],
  method: string,
  path: string
): boolean {
  for (const scopeName of scopes) {
    const scope = getScopeByName(scopeName);
    if (!scope) continue;

    for (const endpoint of scope.allowedEndpoints) {
      if (endpoint.method !== method) continue;

      const pattern = endpoint.path
        .replace(/\*/g, '[^/]+')
        .replace(/\//g, '\\/');
      const regex = new RegExp(`^${pattern}$`);

      if (regex.test(path)) {
        return true;
      }
    }
  }

  return false;
}

export function getHighRiskScopes(scopes: string[]): string[] {
  return scopes.filter(s => {
    const scope = getScopeByName(s);
    return scope?.riskLevel === 'high';
  });
}

export function getScopesRequiringApproval(scopes: string[]): string[] {
  return scopes.filter(s => {
    const scope = getScopeByName(s);
    return scope?.requiresApproval;
  });
}
