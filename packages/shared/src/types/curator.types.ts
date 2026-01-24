/**
 * RADIANT Curator Types
 * Knowledge curation and verification system for enterprise AI
 */

// =============================================================================
// Agent Registry Types
// =============================================================================

export interface AgentRegistryEntry {
  id: string;
  agentKey: string;
  displayName: string;
  description?: string;
  iconName?: string;
  baseUrl?: string;
  port?: number;
  isActive: boolean;
  isInternal: boolean;
  requiresLicense: boolean;
  licenseTier?: string;
  capabilities: string[];
  defaultPermissions: Record<string, boolean>;
  metadata: Record<string, unknown>;
  sortOrder: number;
  createdAt: Date;
  updatedAt: Date;
}

export type AgentKey = 'thinktank' | 'curator' | 'thinktank_admin' | string;

export interface AgentCapability {
  key: string;
  name: string;
  description: string;
}

// =============================================================================
// Tenant Roles & Permissions Types
// =============================================================================

export interface TenantRole {
  id: string;
  tenantId: string;
  roleKey: string;
  displayName: string;
  description?: string;
  isSystemRole: boolean;
  permissions: Record<string, boolean>;
  agentAccess: AgentKey[];
  createdAt: Date;
  updatedAt: Date;
  createdBy?: string;
}

export interface TenantUserRole {
  id: string;
  tenantId: string;
  userId: string;
  roleId: string;
  assignedAt: Date;
  assignedBy?: string;
  expiresAt?: Date;
  isActive: boolean;
  role?: TenantRole;
}

export interface UserAgentAccess {
  id: string;
  tenantId: string;
  userId: string;
  agentId: string;
  accessLevel: 'viewer' | 'user' | 'editor' | 'admin';
  permissions: Record<string, boolean>;
  grantedAt: Date;
  grantedBy?: string;
  expiresAt?: Date;
  isActive: boolean;
  metadata: Record<string, unknown>;
  agent?: AgentRegistryEntry;
}

export interface EffectivePermissions {
  agentKey: AgentKey;
  hasAccess: boolean;
  accessLevel: string;
  permissions: Record<string, boolean>;
  source: 'role' | 'direct' | 'none';
}

// =============================================================================
// Curator Domain Types
// =============================================================================

export interface CuratorDomain {
  id: string;
  tenantId: string;
  parentId?: string;
  name: string;
  description?: string;
  slug: string;
  iconName?: string;
  settings: CuratorDomainSettings;
  nodeCount: number;
  documentCount: number;
  depth: number;
  pathIds: string[];
  createdAt: Date;
  updatedAt: Date;
  createdBy?: string;
  children?: CuratorDomain[];
}

export interface CuratorDomainSettings {
  autoCategorize: boolean;
  requireVerification: boolean;
  retentionDays?: number;
}

// =============================================================================
// Knowledge Node Types
// =============================================================================

export type KnowledgeNodeType = 'concept' | 'fact' | 'procedure' | 'entity' | 'rule' | 'constraint';
export type KnowledgeNodeStatus = 'pending' | 'verified' | 'rejected' | 'overridden' | 'archived';

export interface CuratorKnowledgeNode {
  id: string;
  tenantId: string;
  domainId?: string;
  nodeType: KnowledgeNodeType;
  label: string;
  content?: string;
  sourceDocumentId?: string;
  sourceLocation?: {
    page?: number;
    section?: string;
    lineStart?: number;
    lineEnd?: number;
  };
  confidence: number;
  status: KnowledgeNodeStatus;
  verifiedAt?: Date;
  verifiedBy?: string;
  overrideValue?: string;
  overrideReason?: string;
  overrideAt?: Date;
  overrideBy?: string;
  aiReasoning?: string;
  metadata: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
  connections?: string[];
  domain?: CuratorDomain;
}

export interface CuratorKnowledgeEdge {
  id: string;
  tenantId: string;
  sourceNodeId: string;
  targetNodeId: string;
  relationshipType: string;
  weight: number;
  bidirectional: boolean;
  metadata: Record<string, unknown>;
  createdAt: Date;
}

// =============================================================================
// Document Types
// =============================================================================

export type DocumentStatus = 'pending' | 'processing' | 'completed' | 'failed' | 'archived';

export interface CuratorDocument {
  id: string;
  tenantId: string;
  domainId?: string;
  filename: string;
  originalFilename: string;
  fileType: string;
  fileSize: number;
  storageKey?: string;
  checksum?: string;
  status: DocumentStatus;
  processingStartedAt?: Date;
  processingCompletedAt?: Date;
  nodesCreated: number;
  errorMessage?: string;
  metadata: Record<string, unknown>;
  createdAt: Date;
  createdBy?: string;
  domain?: CuratorDomain;
}

// =============================================================================
// Verification Types (Entrance Exam)
// =============================================================================

export type CuratorVerificationStatus = 'pending' | 'approved' | 'rejected' | 'deferred';

export interface CuratorVerificationItem {
  id: string;
  tenantId: string;
  nodeId: string;
  statement: string;
  aiConfidence: number;
  aiReasoning?: string;
  sourceReference?: string;
  domainPath?: string;
  priority: number;
  status: CuratorVerificationStatus;
  reviewedAt?: Date;
  reviewedBy?: string;
  reviewComment?: string;
  createdAt: Date;
  node?: CuratorKnowledgeNode;
}

// =============================================================================
// Audit Types
// =============================================================================

export interface CuratorAuditEntry {
  id: string;
  tenantId: string;
  entityType: string;
  entityId: string;
  action: string;
  actorId?: string;
  actorType: 'user' | 'system' | 'ai';
  oldValue?: Record<string, unknown>;
  newValue?: Record<string, unknown>;
  reason?: string;
  createdAt: Date;
}

// =============================================================================
// API Request/Response Types
// =============================================================================

export interface CuratorDashboardData {
  stats: {
    totalNodes: number;
    documentsIngested: number;
    verifiedFacts: number;
    pendingVerification: number;
    overriddenNodes: number;
    domainCount: number;
  };
  recentActivity: CuratorAuditEntry[];
  pendingVerifications: CuratorVerificationItem[];
  topDomains: Array<CuratorDomain & { nodeCount: number }>;
}

export interface IngestDocumentRequest {
  domainId?: string;
  files: Array<{
    filename: string;
    contentType: string;
    size: number;
  }>;
}

export interface IngestDocumentResponse {
  uploadUrls: Array<{
    documentId: string;
    uploadUrl: string;
    expiresAt: Date;
  }>;
}

export interface VerifyNodeRequest {
  nodeId: string;
  action: 'approve' | 'reject' | 'defer';
  comment?: string;
}

export interface OverrideNodeRequest {
  nodeId: string;
  overrideValue: string;
  reason: string;
}

export interface CreateDomainRequest {
  parentId?: string;
  name: string;
  description?: string;
  slug?: string;
  settings?: Partial<CuratorDomainSettings>;
}

export interface UpdateDomainRequest {
  name?: string;
  description?: string;
  settings?: Partial<CuratorDomainSettings>;
}

// =============================================================================
// Graph Visualization Types
// =============================================================================

export interface GraphVisualizationNode {
  id: string;
  label: string;
  type: KnowledgeNodeType;
  status: KnowledgeNodeStatus;
  x: number;
  y: number;
  size: number;
  color: string;
}

export interface GraphVisualizationEdge {
  id: string;
  source: string;
  target: string;
  type: string;
  weight: number;
}

export interface GraphVisualizationData {
  nodes: GraphVisualizationNode[];
  edges: GraphVisualizationEdge[];
  metadata: {
    nodeCount: number;
    edgeCount: number;
    domainId?: string;
  };
}

// =============================================================================
// Tenant Admin Types
// =============================================================================

export interface TenantAdminDashboardData {
  userCount: number;
  roleCount: number;
  agentAccessSummary: Array<{
    agent: AgentRegistryEntry;
    userCount: number;
  }>;
  recentRoleChanges: Array<{
    userId: string;
    userName: string;
    roleId: string;
    roleName: string;
    action: 'assigned' | 'revoked';
    timestamp: Date;
  }>;
}

export interface AssignRoleRequest {
  userId: string;
  roleId: string;
  expiresAt?: Date;
}

export interface GrantAgentAccessRequest {
  userId: string;
  agentKey: AgentKey;
  accessLevel: 'viewer' | 'user' | 'editor' | 'admin';
  permissions?: Record<string, boolean>;
  expiresAt?: Date;
}

export interface CreateTenantRoleRequest {
  roleKey: string;
  displayName: string;
  description?: string;
  permissions: Record<string, boolean>;
  agentAccess: AgentKey[];
}

export interface UpdateTenantRoleRequest {
  displayName?: string;
  description?: string;
  permissions?: Record<string, boolean>;
  agentAccess?: AgentKey[];
}
