// RADIANT v4.18.0 - Domain Ethics Types
// Professional ethics requirements for specific domains (legal, medical, financial, etc.)

// ============================================================================
// Core Types
// ============================================================================

export interface DomainEthicsFramework {
  id: string;
  domain: string;
  subspecialties?: string[];
  
  // Framework identification
  frameworkName: string;
  frameworkCode: string; // e.g., "ABA", "AMA", "CFP"
  governingBody: string;
  jurisdiction?: string; // e.g., "US", "UK", "EU", "Global"
  
  // Framework details
  description: string;
  websiteUrl?: string;
  lastUpdated: Date;
  
  // Rules and principles
  principles: EthicsPrinciple[];
  prohibitions: EthicsProhibition[];
  disclosureRequirements: DisclosureRequirement[];
  
  // Response requirements
  requiredDisclaimers: string[];
  mandatoryWarnings: string[];
  
  // Enforcement
  enforcementLevel: 'strict' | 'standard' | 'advisory';
  isActive: boolean;
  
  // Admin control
  canBeDisabled: boolean;
  lastModifiedBy?: string;
  lastModifiedAt?: Date;
}

export interface EthicsPrinciple {
  id: string;
  code: string; // e.g., "Rule 1.1" for ABA
  title: string;
  description: string;
  category: EthicsCategory;
  priority: number; // 1-10, 10 being highest
  isAbsolute: boolean; // Cannot be overridden
  examples?: string[];
}

export interface EthicsProhibition {
  id: string;
  code?: string;
  title: string;
  description: string;
  category: EthicsCategory;
  severity: 'critical' | 'major' | 'minor';
  triggerKeywords: string[];
  actionOnViolation: 'block' | 'warn' | 'modify' | 'disclose';
  alternativeGuidance?: string;
}

export interface DisclosureRequirement {
  id: string;
  title: string;
  description: string;
  triggerConditions: string[];
  disclosureText: string;
  placement: 'before' | 'after' | 'inline';
  isRequired: boolean;
}

export type EthicsCategory =
  | 'confidentiality'
  | 'conflict_of_interest'
  | 'competence'
  | 'diligence'
  | 'communication'
  | 'fees'
  | 'advertising'
  | 'client_relationship'
  | 'duties_to_court'
  | 'duties_to_public'
  | 'professional_conduct'
  | 'record_keeping'
  | 'supervision'
  | 'unauthorized_practice'
  | 'informed_consent'
  | 'fiduciary_duty'
  | 'standard_of_care'
  | 'disclosure'
  | 'privacy';

// ============================================================================
// Domain-Specific Framework Types
// ============================================================================

export interface LegalEthicsFramework extends DomainEthicsFramework {
  domain: 'legal';
  barAssociation: string;
  ruleSet: 'ABA Model Rules' | 'State Rules' | 'UK SRA' | 'Other';
  practiceAreas?: string[];
}

export interface MedicalEthicsFramework extends DomainEthicsFramework {
  domain: 'healthcare';
  medicalBoard: string;
  codeOfEthics: 'AMA' | 'Hippocratic' | 'WHO' | 'Other';
  specialties?: string[];
}

export interface FinancialEthicsFramework extends DomainEthicsFramework {
  domain: 'finance';
  regulatoryBody: string;
  certifications?: string[]; // CFP, CFA, etc.
  regulations?: string[]; // SEC, FINRA, etc.
}

export interface EngineeringEthicsFramework extends DomainEthicsFramework {
  domain: 'engineering';
  professionalBody: string;
  codeOfEthics: 'NSPE' | 'IEEE' | 'ACM' | 'Other';
  disciplines?: string[];
}

// ============================================================================
// Ethics Check Types
// ============================================================================

export interface DomainEthicsCheck {
  domain: string;
  subspecialty?: string;
  frameworksApplied: string[];
  
  // Check results
  passed: boolean;
  score: number; // 0-100
  
  // Issues found
  violations: EthicsViolation[];
  warnings: EthicsWarning[];
  
  // Required actions
  requiredDisclosures: string[];
  requiredModifications: string[];
  
  // Response modifications
  prefixText?: string;
  suffixText?: string;
  inlineModifications?: Array<{
    pattern: string;
    replacement: string;
    reason: string;
  }>;
  
  // Metadata
  checkDurationMs: number;
  checkedAt: Date;
}

export interface EthicsViolation {
  frameworkId: string;
  frameworkCode: string;
  prohibitionId: string;
  title: string;
  description: string;
  severity: 'critical' | 'major' | 'minor';
  action: 'block' | 'warn' | 'modify' | 'disclose';
  matchedContent?: string;
  guidance: string;
}

export interface EthicsWarning {
  frameworkId: string;
  frameworkCode: string;
  principleId: string;
  title: string;
  description: string;
  recommendation: string;
}

// ============================================================================
// Admin Types
// ============================================================================

export interface DomainEthicsConfig {
  tenantId: string;
  
  // Global settings
  enableDomainEthics: boolean;
  enforcementMode: 'strict' | 'standard' | 'advisory' | 'disabled';
  
  // Framework overrides
  disabledFrameworks: string[];
  customFrameworks: DomainEthicsFramework[];
  
  // Domain-specific settings
  domainSettings: Record<string, {
    enabled: boolean;
    enforcementLevel: 'strict' | 'standard' | 'advisory';
    customDisclaimers?: string[];
  }>;
  
  // Logging
  logAllChecks: boolean;
  logViolationsOnly: boolean;
  
  // Notifications
  notifyOnViolation: boolean;
  notifyOnWarning: boolean;
  notificationEmails?: string[];
}

export interface DomainEthicsAuditLog {
  id: string;
  tenantId: string;
  userId: string;
  sessionId: string;
  
  // Request details
  promptId: string;
  detectedDomain: string;
  detectedSubspecialty?: string;
  
  // Check results
  frameworksApplied: string[];
  checkResult: DomainEthicsCheck;
  
  // Actions taken
  actionTaken: 'allowed' | 'blocked' | 'modified' | 'warned';
  modificationsApplied?: string[];
  
  // Timestamps
  createdAt: Date;
}

// ============================================================================
// API Types
// ============================================================================

export interface ListFrameworksRequest {
  domain?: string;
  jurisdiction?: string;
  includeDisabled?: boolean;
}

export interface CheckEthicsRequest {
  domain: string;
  subspecialty?: string;
  content: string;
  context?: Record<string, unknown>;
}

export interface UpdateFrameworkRequest {
  frameworkId: string;
  updates: Partial<DomainEthicsFramework>;
  reason: string;
}

export interface DomainEthicsStats {
  totalChecks: number;
  checksToday: number;
  violationsBlocked: number;
  warningsIssued: number;
  topViolatedRules: Array<{
    ruleCode: string;
    ruleName: string;
    count: number;
  }>;
  checksByDomain: Record<string, number>;
}
