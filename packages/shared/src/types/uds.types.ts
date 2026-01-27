/**
 * User Data Service (UDS) Types
 * Tiered Storage for User-Generated Content v1.0.0
 * 
 * Scale Target: 1M+ concurrent users
 * Security: Encryption at rest, RLS, GDPR-compliant
 */

// =============================================================================
// Enums
// =============================================================================

export type UDSMessageRole = 'system' | 'user' | 'assistant' | 'tool';

export type UDSConversationStatus = 'active' | 'archived' | 'deleted' | 'forked';

export type UDSUploadStatus = 
  | 'pending' 
  | 'scanning' 
  | 'clean' 
  | 'infected' 
  | 'processing' 
  | 'ready' 
  | 'failed' 
  | 'deleted';

export type UDSUploadSource = 'direct' | 'paste' | 'api' | 'integration' | 'import';

export type UDSContentType =
  | 'text' | 'markdown' | 'code' | 'json' | 'xml' | 'html' | 'csv'
  | 'image' | 'pdf' | 'document' | 'spreadsheet' | 'presentation'
  | 'audio' | 'video' | 'archive' | 'binary' | 'unknown';

export type UDSTier = 'hot' | 'warm' | 'cold' | 'glacier';

export type UDSAuditCategory =
  | 'auth' | 'conversation' | 'message' | 'upload' | 'export'
  | 'admin' | 'billing' | 'security' | 'compliance' | 'system' | 'gdpr';

export type UDSErasureStatus = 'pending' | 'processing' | 'completed' | 'failed' | 'partial';

export type UDSErasureScope = 'user' | 'conversation' | 'tenant';

export type UDSExportFormat = 'json' | 'csv' | 'pdf' | 'html' | 'zip';

export type UDSExportType = 'user_data' | 'conversations' | 'audit_log' | 'compliance' | 'gdpr';

// =============================================================================
// Configuration
// =============================================================================

export interface UDSConfig {
  id: string;
  tenantId: string;
  
  // Hot Tier
  hotTierEnabled: boolean;
  hotSessionTtlSeconds: number;
  hotMessageTtlSeconds: number;
  hotCacheMaxConversations: number;
  
  // Warm Tier
  warmTierEnabled: boolean;
  warmRetentionDays: number;
  warmFullTextSearchEnabled: boolean;
  warmVectorSearchEnabled: boolean;
  
  // Cold Tier
  coldTierEnabled: boolean;
  coldCompressionEnabled: boolean;
  coldCompressionAlgorithm: 'zstd' | 'snappy' | 'gzip';
  coldRetentionYears: number;
  
  // Uploads
  maxUploadSizeMb: number;
  allowedFileTypes: string[];
  virusScanEnabled: boolean;
  autoExtractText: boolean;
  generateThumbnails: boolean;
  
  // Security
  encryptionEnabled: boolean;
  encryptionAlgorithm: string;
  perUserEncryptionKeys: boolean;
  auditLogEnabled: boolean;
  merkleChainEnabled: boolean;
  
  // GDPR
  gdprAutoDeleteEnabled: boolean;
  gdprRetentionDays: number;
  gdprAnonymizeOnDelete: boolean;
  
  createdAt: Date;
  updatedAt: Date;
}

export interface UDSEncryptionKey {
  id: string;
  tenantId: string;
  userId?: string;
  keyId: string;
  keyType: 'tenant' | 'user' | 'conversation';
  algorithm: string;
  version: number;
  isActive: boolean;
  createdAt: Date;
  rotatedAt?: Date;
  expiresAt?: Date;
}

// =============================================================================
// Conversations
// =============================================================================

export interface UDSConversation {
  id: string;
  tenantId: string;
  userId: string;
  
  // Metadata
  title?: string;
  titleGenerated: boolean;
  summary?: string;
  tags: string[];
  
  // Model config
  modelId?: string;
  systemPromptId?: string;
  personaId?: string;
  temperature?: number;
  maxTokens?: number;
  
  // Statistics
  messageCount: number;
  totalInputTokens: number;
  totalOutputTokens: number;
  totalCostCredits: number;
  attachmentCount: number;
  
  // Time Machine (forking)
  parentConversationId?: string;
  forkPointMessageId?: string;
  forkSequenceNumber?: number;
  branchName?: string;
  isCheckpoint: boolean;
  checkpointName?: string;
  
  // Collaboration
  isShared: boolean;
  sharedWithUserIds: string[];
  collaborationMode?: 'view' | 'comment' | 'edit';
  
  // Status
  status: UDSConversationStatus;
  starred: boolean;
  pinned: boolean;
  
  // Tiering
  currentTier: UDSTier;
  lastAccessedAt: Date;
  promotedToWarmAt?: Date;
  archivedToColdAt?: Date;
  
  // Encryption
  encryptionKeyId?: string;
  
  // Timestamps
  startedAt: Date;
  lastMessageAt?: Date;
  createdAt: Date;
  updatedAt: Date;
  deletedAt?: Date;
}

export interface UDSConversationCreate {
  title?: string;
  modelId?: string;
  systemPromptId?: string;
  personaId?: string;
  temperature?: number;
  maxTokens?: number;
  tags?: string[];
  parentConversationId?: string;
  forkPointMessageId?: string;
  branchName?: string;
}

export interface UDSConversationUpdate {
  title?: string;
  summary?: string;
  tags?: string[];
  modelId?: string;
  personaId?: string;
  starred?: boolean;
  pinned?: boolean;
  isShared?: boolean;
  sharedWithUserIds?: string[];
  collaborationMode?: 'view' | 'comment' | 'edit';
}

export interface UDSConversationListOptions {
  status?: UDSConversationStatus;
  tier?: UDSTier;
  starred?: boolean;
  pinned?: boolean;
  tags?: string[];
  search?: string;
  startDate?: Date;
  endDate?: Date;
  limit?: number;
  offset?: number;
  orderBy?: 'lastMessageAt' | 'createdAt' | 'title';
  orderDirection?: 'asc' | 'desc';
}

export interface UDSConversationSearchResult {
  conversations: UDSConversation[];
  total: number;
  hasMore: boolean;
}

// =============================================================================
// Messages
// =============================================================================

export interface UDSMessage {
  id: string;
  tenantId: string;
  conversationId: string;
  userId: string;
  
  // Content (decrypted for API response)
  role: UDSMessageRole;
  content: string;
  contentLength: number;
  
  // Tool calls
  toolCallId?: string;
  toolName?: string;
  toolArguments?: Record<string, unknown>;
  toolResult?: unknown;
  
  // Token usage
  inputTokens?: number;
  outputTokens?: number;
  costCredits?: number;
  
  // Model info
  modelId?: string;
  modelResponseId?: string;
  finishReason?: string;
  
  // Attachments
  attachmentIds: string[];
  attachments?: UDSMessageAttachment[];
  
  // Time Machine
  sequenceNumber: number;
  isCheckpoint: boolean;
  checkpointName?: string;
  
  // Editing
  isEdited: boolean;
  editedAt?: Date;
  editCount: number;
  
  // Feedback
  userRating?: number;
  userFeedback?: string;
  flagged: boolean;
  flagReason?: string;
  
  // Streaming
  isStreaming: boolean;
  streamCompletedAt?: Date;
  
  // Tiering
  currentTier: UDSTier;
  
  // Timestamps
  createdAt: Date;
  updatedAt: Date;
}

export interface UDSMessageCreate {
  role: UDSMessageRole;
  content: string;
  toolCallId?: string;
  toolName?: string;
  toolArguments?: Record<string, unknown>;
  toolResult?: unknown;
  modelId?: string;
  attachmentIds?: string[];
  isCheckpoint?: boolean;
  checkpointName?: string;
}

export interface UDSMessageUpdate {
  content?: string;
  userRating?: number;
  userFeedback?: string;
  flagged?: boolean;
  flagReason?: string;
  isCheckpoint?: boolean;
  checkpointName?: string;
}

export interface UDSMessageListOptions {
  conversationId: string;
  fromSequenceNumber?: number;
  toSequenceNumber?: number;
  checkpointsOnly?: boolean;
  limit?: number;
  offset?: number;
}

export interface UDSMessageAttachment {
  id: string;
  tenantId: string;
  messageId: string;
  attachmentType: 'code' | 'image' | 'file' | 'link';
  contentType: UDSContentType;
  mimeType?: string;
  language?: string;
  filename?: string;
  content?: string;  // Decrypted
  contentSize?: number;
  uploadId?: string;
  displayOrder: number;
  altText?: string;
  caption?: string;
  createdAt: Date;
}

// =============================================================================
// Uploads
// =============================================================================

export interface UDSUpload {
  id: string;
  tenantId: string;
  userId: string;
  conversationId?: string;
  
  // File metadata
  originalFilename: string;
  sanitizedFilename: string;
  fileExtension?: string;
  mimeType: string;
  contentType: UDSContentType;
  fileSizeBytes: number;
  
  // Storage
  storageBucket: string;
  storageKey: string;
  storageClass: string;
  
  // Encryption
  encryptionKeyId?: string;
  encrypted: boolean;
  
  // Hashes
  sha256Hash: string;
  md5Hash?: string;
  contentFingerprint?: string;
  
  // Status
  status: UDSUploadStatus;
  uploadSource: UDSUploadSource;
  
  // Virus scanning
  virusScanStatus: string;
  virusScanResult?: Record<string, unknown>;
  scannedAt?: Date;
  
  // Content extraction
  extractedText?: string;
  textExtractionStatus?: string;
  textExtractionError?: string;
  
  // Vector embedding
  hasEmbedding: boolean;
  embeddingModel?: string;
  embeddedAt?: Date;
  
  // Thumbnails
  thumbnailKey?: string;
  thumbnailGenerated: boolean;
  previewKey?: string;
  
  // Metadata
  extractedMetadata: Record<string, unknown>;
  
  // OCR
  ocrText?: string;
  ocrStatus?: string;
  ocrConfidence?: number;
  
  // Usage
  downloadCount: number;
  lastAccessedAt?: Date;
  
  // Tiering
  currentTier: UDSTier;
  promotedAt?: Date;
  archivedAt?: Date;
  
  // Lifecycle
  expiresAt?: Date;
  deletedAt?: Date;
  
  createdAt: Date;
  updatedAt: Date;
}

export interface UDSUploadCreate {
  originalFilename: string;
  mimeType: string;
  fileSizeBytes: number;
  conversationId?: string;
  uploadSource?: UDSUploadSource;
}

export interface UDSUploadComplete {
  sha256Hash: string;
  md5Hash?: string;
}

export interface UDSUploadListOptions {
  conversationId?: string;
  contentType?: UDSContentType;
  status?: UDSUploadStatus;
  search?: string;
  startDate?: Date;
  endDate?: Date;
  limit?: number;
  offset?: number;
}

export interface UDSUploadChunk {
  id: string;
  uploadId: string;
  tenantId: string;
  chunkNumber: number;
  totalChunks: number;
  chunkSizeBytes: number;
  storageKey: string;
  sha256Hash: string;
  uploadedAt: Date;
}

export interface UDSPresignedUpload {
  uploadId: string;
  presignedUrl: string;
  presignedFields?: Record<string, string>;
  expiresAt: Date;
  maxSizeBytes: number;
}

export interface UDSPresignedDownload {
  downloadUrl: string;
  expiresAt: Date;
  filename: string;
  contentType: string;
  fileSize: number;
}

// =============================================================================
// Audit Log
// =============================================================================

export interface UDSAuditEntry {
  id: string;
  tenantId: string;
  userId?: string;
  
  // Event
  eventType: string;
  eventCategory: UDSAuditCategory;
  eventSeverity: 'debug' | 'info' | 'warning' | 'error' | 'critical';
  
  // Resource
  resourceType?: string;
  resourceId?: string;
  resourceName?: string;
  
  // Action
  action: string;
  actionDetails: Record<string, unknown>;
  
  // State tracking
  previousStateHash?: string;
  newStateHash?: string;
  changes?: Record<string, unknown>;
  
  // Merkle chain
  merkleHash: string;
  previousMerkleHash?: string;
  merkleTreeRoot?: string;
  sequenceNumber: number;
  
  // Request context
  requestId?: string;
  sessionId?: string;
  ipAddress?: string;
  userAgent?: string;
  geoLocation?: {
    country?: string;
    region?: string;
    city?: string;
  };
  
  metadata: Record<string, unknown>;
  createdAt: Date;
}

export interface UDSAuditEntryCreate {
  eventType: string;
  eventCategory: UDSAuditCategory;
  eventSeverity?: 'debug' | 'info' | 'warning' | 'error' | 'critical';
  resourceType?: string;
  resourceId?: string;
  resourceName?: string;
  action: string;
  actionDetails?: Record<string, unknown>;
  previousStateHash?: string;
  newStateHash?: string;
  changes?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
}

export interface UDSAuditListOptions {
  userId?: string;
  eventType?: string;
  eventCategory?: UDSAuditCategory;
  resourceType?: string;
  resourceId?: string;
  startDate?: Date;
  endDate?: Date;
  limit?: number;
  offset?: number;
}

export interface UDSAuditMerkleTree {
  id: string;
  tenantId: string;
  treeHeight: number;
  leafCount: number;
  rootHash: string;
  firstSequenceNumber: number;
  lastSequenceNumber: number;
  firstEntryAt: Date;
  lastEntryAt: Date;
  isVerified: boolean;
  verifiedAt?: Date;
  verifiedBy?: string;
  treeDataKey?: string;
  createdAt: Date;
}

export interface UDSAuditVerificationResult {
  isValid: boolean;
  treeRoot: string;
  entriesVerified: number;
  firstEntry: number;
  lastEntry: number;
  errors: string[];
  verifiedAt: Date;
}

// =============================================================================
// Export Requests
// =============================================================================

export interface UDSExportRequest {
  id: string;
  tenantId: string;
  userId?: string;
  requestedByUserId: string;
  
  // Scope
  exportType: UDSExportType;
  scopeType: 'user' | 'tenant' | 'date_range' | 'conversation';
  
  // Filters
  dateRangeStart?: Date;
  dateRangeEnd?: Date;
  conversationIds?: string[];
  includeAttachments: boolean;
  includeMetadata: boolean;
  
  // Format
  exportFormat: UDSExportFormat;
  encryptionEnabled: boolean;
  
  // Status
  status: 'pending' | 'processing' | 'completed' | 'failed' | 'expired';
  progressPercent: number;
  
  // Result
  resultBucket?: string;
  resultKey?: string;
  resultSizeBytes?: number;
  resultChecksum?: string;
  downloadUrl?: string;
  downloadExpiresAt?: Date;
  downloadCount: number;
  
  // Error
  errorMessage?: string;
  retryCount: number;
  
  completedAt?: Date;
  createdAt: Date;
  expiresAt?: Date;
}

export interface UDSExportRequestCreate {
  exportType: UDSExportType;
  scopeType: 'user' | 'tenant' | 'date_range' | 'conversation';
  userId?: string;
  dateRangeStart?: Date;
  dateRangeEnd?: Date;
  conversationIds?: string[];
  includeAttachments?: boolean;
  includeMetadata?: boolean;
  exportFormat?: UDSExportFormat;
  encryptionEnabled?: boolean;
}

// =============================================================================
// GDPR Erasure
// =============================================================================

export interface UDSErasureRequest {
  id: string;
  tenantId: string;
  userId?: string;
  conversationId?: string;
  requestedByUserId: string;
  
  // Scope
  scope: UDSErasureScope;
  
  // What to erase
  eraseConversations: boolean;
  eraseMessages: boolean;
  eraseUploads: boolean;
  eraseAuditLog: boolean;
  eraseFromBackups: boolean;
  anonymizeRemaining: boolean;
  
  // Status
  status: UDSErasureStatus;
  hotTierStatus: UDSErasureStatus;
  warmTierStatus: UDSErasureStatus;
  coldTierStatus: UDSErasureStatus;
  backupStatus: UDSErasureStatus;
  
  // Progress
  conversationsDeleted: number;
  messagesDeleted: number;
  uploadsDeleted: number;
  bytesDeleted: number;
  
  // Verification
  verificationHash?: string;
  
  // Legal
  legalBasis?: string;
  legalReference?: string;
  
  // Timing
  scheduledAt?: Date;
  startedAt?: Date;
  completedAt?: Date;
  
  // Error
  errorMessage?: string;
  retryCount: number;
  
  createdAt: Date;
  updatedAt: Date;
}

export interface UDSErasureRequestCreate {
  scope: UDSErasureScope;
  userId?: string;
  conversationId?: string;
  eraseConversations?: boolean;
  eraseMessages?: boolean;
  eraseUploads?: boolean;
  eraseAuditLog?: boolean;
  eraseFromBackups?: boolean;
  anonymizeRemaining?: boolean;
  legalBasis?: string;
  legalReference?: string;
  scheduledAt?: Date;
}

// =============================================================================
// Tier Management
// =============================================================================

export interface UDSTierTransition {
  id: string;
  tenantId: string;
  resourceType: 'conversation' | 'message' | 'upload';
  resourceId: string;
  fromTier: UDSTier;
  toTier: UDSTier;
  transitionReason: 'ttl_expiry' | 'manual' | 'access_pattern' | 'archival';
  sizeBytes?: number;
  durationMs?: number;
  createdAt: Date;
}

export interface UDSDataFlowMetrics {
  id: string;
  tenantId: string;
  period: 'hour' | 'day' | 'week';
  periodStart: Date;
  
  // Hot tier
  hotConversationsCount: number;
  hotMessagesCount: number;
  hotCacheHits: number;
  hotCacheMisses: number;
  
  // Warm tier
  warmConversationsCount: number;
  warmMessagesCount: number;
  warmQueryCount: number;
  warmQueryLatencyP99Ms?: number;
  
  // Cold tier
  coldConversationsCount: number;
  coldRetrievalCount: number;
  coldRetrievalLatencyP99Ms?: number;
  
  // Transitions
  hotToWarmCount: number;
  warmToColdCount: number;
  coldToWarmCount: number;
  
  // Storage
  totalStorageBytes: number;
  hotStorageBytes: number;
  warmStorageBytes: number;
  coldStorageBytes: number;
  
  createdAt: Date;
}

export interface UDSTierHealth {
  tier: UDSTier;
  status: 'healthy' | 'degraded' | 'critical';
  metrics: {
    itemCount?: number;
    storageBytes?: number;
    cacheHitRate?: number;
    latencyP99Ms?: number;
    errorRate?: number;
  };
  alerts: UDSTierAlert[];
  lastChecked: Date;
}

export interface UDSTierAlert {
  id: string;
  tier: UDSTier;
  severity: 'info' | 'warning' | 'critical';
  metric: string;
  threshold: number;
  currentValue: number;
  message: string;
  triggeredAt: Date;
  acknowledgedAt?: Date;
}

// =============================================================================
// Search
// =============================================================================

export interface UDSSearchQuery {
  query: string;
  searchType: 'fulltext' | 'semantic' | 'hybrid';
  sourceTypes?: ('conversation' | 'message' | 'upload')[];
  conversationId?: string;
  tags?: string[];
  contentTypes?: UDSContentType[];
  startDate?: Date;
  endDate?: Date;
  limit?: number;
  offset?: number;
}

export interface UDSSearchResult {
  id: string;
  sourceType: 'conversation' | 'message' | 'upload';
  sourceId: string;
  conversationId?: string;
  contentSnippet: string;
  highlightedContent?: string;
  score: number;
  contentType?: string;
  tags?: string[];
  createdAt: Date;
}

export interface UDSSearchResponse {
  results: UDSSearchResult[];
  total: number;
  hasMore: boolean;
  searchTime: number;
}

// =============================================================================
// API Response Types
// =============================================================================

export interface UDSApiResponse<T> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: Record<string, unknown>;
  };
  meta?: {
    requestId: string;
    timestamp: Date;
    tier?: UDSTier;
  };
}

export interface UDSPaginatedResponse<T> extends UDSApiResponse<T[]> {
  pagination: {
    total: number;
    limit: number;
    offset: number;
    hasMore: boolean;
  };
}

// =============================================================================
// Service Interfaces
// =============================================================================

export interface IUDSConversationService {
  create(tenantId: string, userId: string, data: UDSConversationCreate): Promise<UDSConversation>;
  get(tenantId: string, userId: string, conversationId: string): Promise<UDSConversation | null>;
  update(tenantId: string, userId: string, conversationId: string, data: UDSConversationUpdate): Promise<UDSConversation>;
  delete(tenantId: string, userId: string, conversationId: string): Promise<void>;
  list(tenantId: string, userId: string, options: UDSConversationListOptions): Promise<UDSConversationSearchResult>;
  fork(tenantId: string, userId: string, conversationId: string, atMessageId?: string, branchName?: string): Promise<UDSConversation>;
  createCheckpoint(tenantId: string, userId: string, conversationId: string, name: string): Promise<UDSConversation>;
  archive(tenantId: string, userId: string, conversationId: string): Promise<void>;
  restore(tenantId: string, userId: string, conversationId: string): Promise<UDSConversation>;
}

export interface IUDSMessageService {
  create(tenantId: string, userId: string, conversationId: string, data: UDSMessageCreate): Promise<UDSMessage>;
  get(tenantId: string, userId: string, messageId: string): Promise<UDSMessage | null>;
  update(tenantId: string, userId: string, messageId: string, data: UDSMessageUpdate): Promise<UDSMessage>;
  delete(tenantId: string, userId: string, messageId: string): Promise<void>;
  list(tenantId: string, userId: string, options: UDSMessageListOptions): Promise<UDSMessage[]>;
  createCheckpoint(tenantId: string, userId: string, messageId: string, name: string): Promise<UDSMessage>;
  streamStart(tenantId: string, userId: string, conversationId: string, messageId: string): Promise<void>;
  streamAppend(tenantId: string, userId: string, messageId: string, content: string): Promise<void>;
  streamComplete(tenantId: string, userId: string, messageId: string, finalContent: string, tokens: { input: number; output: number }): Promise<UDSMessage>;
}

export interface IUDSUploadService {
  initiate(tenantId: string, userId: string, data: UDSUploadCreate): Promise<UDSPresignedUpload>;
  complete(tenantId: string, userId: string, uploadId: string, data: UDSUploadComplete): Promise<UDSUpload>;
  get(tenantId: string, userId: string, uploadId: string): Promise<UDSUpload | null>;
  getDownloadUrl(tenantId: string, userId: string, uploadId: string): Promise<UDSPresignedDownload>;
  delete(tenantId: string, userId: string, uploadId: string): Promise<void>;
  list(tenantId: string, userId: string, options: UDSUploadListOptions): Promise<UDSUpload[]>;
  search(tenantId: string, userId: string, query: string, options?: UDSUploadListOptions): Promise<UDSUpload[]>;
}

export interface IUDSAuditService {
  log(tenantId: string, userId: string | null, entry: UDSAuditEntryCreate, requestContext?: { requestId?: string; ipAddress?: string; userAgent?: string }): Promise<UDSAuditEntry>;
  list(tenantId: string, options: UDSAuditListOptions): Promise<UDSAuditEntry[]>;
  verify(tenantId: string, fromSequence: number, toSequence: number): Promise<UDSAuditVerificationResult>;
  buildMerkleTree(tenantId: string, fromSequence: number, toSequence: number): Promise<UDSAuditMerkleTree>;
}

export interface IUDSErasureService {
  request(tenantId: string, requestedByUserId: string, data: UDSErasureRequestCreate): Promise<UDSErasureRequest>;
  get(tenantId: string, requestId: string): Promise<UDSErasureRequest | null>;
  list(tenantId: string): Promise<UDSErasureRequest[]>;
  process(requestId: string): Promise<void>;
  cancel(tenantId: string, requestId: string): Promise<void>;
}

export interface UDSTierOperationResult {
  promoted: number;
  errors: number;
  details?: string[];
}

export interface IUDSTierService {
  getHealth(tenantId: string): Promise<UDSTierHealth[]>;
  promoteHotToWarm(tenantId: string): Promise<UDSTierOperationResult>;
  archiveWarmToCold(tenantId: string): Promise<UDSTierOperationResult>;
  retrieveColdToWarm(tenantId: string, resourceIds: string[]): Promise<UDSTierOperationResult>;
  getMetrics(tenantId: string, period: 'hour' | 'day' | 'week'): Promise<UDSDataFlowMetrics[]>;
}

export interface IUDSSearchService {
  search(tenantId: string, userId: string, query: UDSSearchQuery): Promise<UDSSearchResponse>;
  indexConversation(tenantId: string, conversationId: string): Promise<void>;
  indexMessage(tenantId: string, messageId: string): Promise<void>;
  indexUpload(tenantId: string, uploadId: string): Promise<void>;
  removeFromIndex(tenantId: string, sourceType: string, sourceId: string): Promise<void>;
}
