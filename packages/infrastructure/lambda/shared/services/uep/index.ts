// RADIANT v5.53.0 - UEP v2.0 Services
// Universal Envelope Protocol - Multi-modal, streaming, asynchronous AI communication

export { UEPEnvelopeBuilder, UEPFactory } from './envelope-builder.service';
export { UEPStreamManager, getStreamManager } from './stream-manager.service';
export { UEPMigrationService, uepMigrationService } from './migration.service';
export { 
  UEPSecurityService, 
  getSecurityService,
  MLSService,
} from './security.service';

export {
  UEPComplianceService,
  getComplianceService,
  FRAMEWORK_REQUIREMENTS,
} from './compliance.service';

export {
  uepStorageAdapter,
  UEPUDSStorageAdapter,
} from './uds-storage-adapter.service';

export {
  uepIntegrationService,
  UEPIntegrationService,
} from './integration.service';

// Re-export types for convenience
export type {
  StreamCreateOptions,
  StreamChunkResult,
  StreamResumeInfo,
} from './stream-manager.service';

export type {
  RegulatoryFramework,
  FrameworkRequirements,
  ComplianceAuditResult,
  ComplianceFinding,
} from './compliance.service';

export type {
  StoredEnvelope,
  UEPStorageOptions,
} from './uds-storage-adapter.service';

export type {
  UEPEnvelope,
  UEPSource,
  UEPPayload,
  UEPInput,
  UEPOutput,
  UEPTracing,
  UEPCompliance,
  UEPRiskSignals,
  CatoMethodEnvelopeV1,
} from './integration.service';

export type {
  EncryptionAlgorithm,
  SignatureAlgorithm,
  EncryptionKey,
  SignatureResult,
  VerificationResult,
  EncryptedPayload,
  MLSGroupConfig,
  MLSGroupMember,
} from './security.service';
