/**
 * Public Status Page Types
 * 
 * Types for the public-facing system health status page.
 * All data exposed through these types is sanitized and safe for public display.
 * 
 * SECURITY: No PII, PHI, internal IPs, credentials, or sensitive configuration
 * 
 * @version 7.1.0
 * @since 2026-02-04
 */

// =============================================================================
// Public Health Status Types (Sanitized for Public Display)
// =============================================================================

/**
 * Public system health status.
 * Contains ONLY information safe for public display.
 */
export interface PublicSystemHealth {
  // Metadata
  generatedAt: string;
  cacheExpiresAt: string;
  platformVersion: string; // e.g., "7.1.0"
  
  // Overall status
  overallStatus: PublicHealthStatus;
  statusMessage: string;
  
  // Component health (sanitized - no internal details)
  components: PublicComponentHealth[];
  
  // Active incidents (if any)
  incidents: PublicIncident[];
  
  // Scheduled maintenance
  scheduledMaintenance: PublicMaintenance[];
  
  // Historical uptime
  uptimeHistory: UptimeRecord[];
  
  // SLA summary (percentage only, no raw numbers)
  uptime: {
    last24Hours: number;
    last7Days: number;
    last30Days: number;
    last90Days: number;
  };
}

/**
 * Public health status enum.
 */
export type PublicHealthStatus = 
  | 'operational'      // Everything working
  | 'degraded'         // Partial issues
  | 'partial_outage'   // Some services down
  | 'major_outage'     // Significant issues
  | 'maintenance';     // Planned maintenance

/**
 * Public component health.
 * Sanitized - no internal URLs, IPs, or resource identifiers.
 */
export interface PublicComponentHealth {
  name: string;          // e.g., "API Services", "Database", "AI Processing"
  description: string;   // User-friendly description
  status: PublicHealthStatus;
  statusMessage?: string;
  
  // Performance indicator (relative, not absolute)
  performanceIndicator?: 'normal' | 'slow' | 'very_slow';
  
  // Last status change
  statusChangedAt?: string;
}

/**
 * Public incident (active or recent).
 */
export interface PublicIncident {
  id: string;
  title: string;
  status: 'investigating' | 'identified' | 'monitoring' | 'resolved';
  severity: 'minor' | 'major' | 'critical';
  affectedComponents: string[];
  
  // Timeline
  createdAt: string;
  updatedAt: string;
  resolvedAt?: string;
  
  // Updates (most recent first)
  updates: PublicIncidentUpdate[];
}

/**
 * Incident update.
 */
export interface PublicIncidentUpdate {
  timestamp: string;
  status: string;
  message: string;
}

/**
 * Scheduled maintenance window.
 */
export interface PublicMaintenance {
  id: string;
  title: string;
  description: string;
  affectedComponents: string[];
  
  scheduledStart: string;
  scheduledEnd: string;
  
  status: 'scheduled' | 'in_progress' | 'completed' | 'cancelled';
}

/**
 * Daily uptime record for historical display.
 */
export interface UptimeRecord {
  date: string; // YYYY-MM-DD
  uptimePercentage: number;
  status: 'operational' | 'incident' | 'maintenance';
  incidentCount: number;
}

// =============================================================================
// Service Account Types
// =============================================================================

/**
 * Service account for automated system access.
 */
export interface ServiceAccount {
  id: string;
  name: string;
  description: string;
  
  // Scopes define what the service account can do
  scopes: ServiceAccountScope[];
  
  // API key (hashed in database)
  apiKeyId: string;
  apiKeyPrefix: string; // First 8 chars for identification
  apiKeyHash: string;   // bcrypt hash
  
  // Metadata
  createdAt: string;
  createdBy: string;
  lastUsedAt?: string;
  
  // Status
  isActive: boolean;
  expiresAt?: string;
  
  // Rate limiting
  rateLimitPerMinute: number;
  rateLimitPerHour: number;
}

/**
 * Service account scopes.
 */
export type ServiceAccountScope = 
  | 'status:read'       // Read public health status
  | 'metrics:read'      // Read public metrics
  | 'incidents:read'    // Read public incidents
  | 'maintenance:read'; // Read maintenance schedules

/**
 * Predefined service accounts to seed.
 */
export const PREDEFINED_SERVICE_ACCOUNTS: Omit<ServiceAccount, 'id' | 'apiKeyId' | 'apiKeyPrefix' | 'apiKeyHash' | 'createdAt' | 'lastUsedAt'>[] = [
  {
    name: 'status-page-reader',
    description: 'Service account for public status page. Read-only access to health status.',
    scopes: ['status:read', 'metrics:read', 'incidents:read', 'maintenance:read'],
    createdBy: 'system',
    isActive: true,
    rateLimitPerMinute: 60,
    rateLimitPerHour: 1000,
  },
];

// =============================================================================
// API Request/Response Types
// =============================================================================

/**
 * Status page API request headers.
 */
export interface StatusPageApiHeaders {
  'X-API-Key': string;
  'X-Request-ID'?: string;
}

/**
 * Status page API response wrapper.
 */
export interface StatusPageApiResponse<T> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
  };
  
  // Cache headers (for resilience)
  cacheControl: {
    maxAge: number;      // seconds
    staleWhileRevalidate: number;
    staleIfError: number;
  };
  
  // Rate limit info
  rateLimit: {
    limit: number;
    remaining: number;
    resetAt: string;
  };
}

// =============================================================================
// Audit Types
// =============================================================================

/**
 * Audit log entry for status page access.
 */
export interface StatusPageAuditEntry {
  id: string;
  timestamp: string;
  
  // Request info
  requestId: string;
  endpoint: string;
  method: string;
  
  // Authentication
  serviceAccountId?: string;
  serviceAccountName?: string;
  apiKeyPrefix?: string;
  
  // Client info (sanitized)
  clientIp: string;      // Hashed for privacy
  userAgent?: string;
  
  // Response
  statusCode: number;
  responseTimeMs: number;
  
  // Rate limiting
  rateLimitRemaining: number;
  wasRateLimited: boolean;
  
  // Error info (when applicable)
  errorCode?: string;
  errorMessage?: string;
}

// =============================================================================
// Configuration Types
// =============================================================================

/**
 * Status page configuration.
 */
export interface StatusPageConfig {
  // URLs
  statusPageUrl: string;
  apiBaseUrl: string;
  
  // Branding
  companyName: string;
  logoUrl?: string;
  faviconUrl?: string;
  primaryColor: string;
  
  // Features
  showUptime: boolean;
  showIncidents: boolean;
  showMaintenance: boolean;
  showSubscribe: boolean;
  
  // Cache settings
  cacheMaxAgeSeconds: number;
  staleWhileRevalidateSeconds: number;
  
  // Rate limiting
  publicRateLimitPerMinute: number;
}

/**
 * Default status page configuration.
 */
export const DEFAULT_STATUS_PAGE_CONFIG: StatusPageConfig = {
  statusPageUrl: 'https://status.{{RADIANT_DOMAIN}}',
  apiBaseUrl: 'https://api.{{RADIANT_DOMAIN}}',
  companyName: 'RADIANT',
  primaryColor: '#6366f1',
  showUptime: true,
  showIncidents: true,
  showMaintenance: true,
  showSubscribe: false, // Disabled by default for HIPAA
  cacheMaxAgeSeconds: 60,
  staleWhileRevalidateSeconds: 300,
  publicRateLimitPerMinute: 60,
};

// =============================================================================
// Component Mapping (Internal to Public)
// =============================================================================

/**
 * Maps internal component names to public-friendly names.
 * This prevents exposing internal infrastructure details.
 */
export const COMPONENT_PUBLIC_NAMES: Record<string, { name: string; description: string }> = {
  'aurora-postgresql': {
    name: 'Database Services',
    description: 'Primary data storage and retrieval',
  },
  'dynamodb': {
    name: 'Session Services',
    description: 'Session management and caching',
  },
  'api-gateway': {
    name: 'API Services',
    description: 'REST and GraphQL API endpoints',
  },
  'lambda': {
    name: 'Compute Services',
    description: 'Request processing and business logic',
  },
  's3': {
    name: 'Storage Services',
    description: 'File storage and delivery',
  },
  'elasticache': {
    name: 'Cache Services',
    description: 'Performance optimization layer',
  },
  'cloudfront': {
    name: 'Content Delivery',
    description: 'Global content distribution',
  },
  'cognito': {
    name: 'Authentication',
    description: 'User authentication and authorization',
  },
  'ai-inference': {
    name: 'AI Processing',
    description: 'AI model inference and orchestration',
  },
  'think-tank': {
    name: 'Think Tank',
    description: 'Collaborative AI workspace',
  },
};

// =============================================================================
// Secrets Manager Keys
// =============================================================================

/**
 * Secrets Manager key paths for status page.
 */
export const STATUS_PAGE_SECRETS = {
  apiKey: (env: string) => `radiant/${env}/status-page/api-key`,
  config: (env: string) => `radiant/${env}/status-page/config`,
};
