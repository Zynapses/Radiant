/**
 * RADIANT v4.18.0 - Compliance/PHI Types
 * SINGLE SOURCE OF TRUTH
 */

export type PHIMode = 'auto' | 'manual' | 'disabled';

export interface PHIConfig {
  mode: PHIMode;
  categories: PHICategory[];
  autoSanitize: boolean;
  allowReidentification: boolean;
  logSanitization: boolean;
  retentionDays: number;
}

export type PHICategory =
  | 'name'
  | 'date'
  | 'phone'
  | 'email'
  | 'ssn'
  | 'mrn'
  | 'address'
  | 'age'
  | 'medical_condition'
  | 'medication'
  | 'procedure';

export const DEFAULT_PHI_CONFIG: PHIConfig = {
  mode: 'auto',
  categories: ['name', 'date', 'phone', 'email', 'ssn', 'mrn', 'address'],
  autoSanitize: true,
  allowReidentification: false,
  logSanitization: true,
  retentionDays: 365,
};

export interface ComplianceReport {
  id: string;
  type: ComplianceReportType;
  generatedAt: Date;
  period: { start: Date; end: Date };
  results: ComplianceCheck[];
  overallStatus: ComplianceStatus;
  recommendations: string[];
}

export type ComplianceReportType = 'hipaa' | 'soc2' | 'gdpr' | 'full';

export type ComplianceStatus = 'compliant' | 'non_compliant' | 'needs_review';

export interface ComplianceCheck {
  id: string;
  name: string;
  description: string;
  category: string;
  status: ComplianceStatus;
  evidence?: string;
  remediation?: string;
}

export interface AuditLog {
  id: string;
  tenantId: string;
  appId: string;
  adminId?: string;
  action: string;
  resource: string;
  resourceId: string;
  details: Record<string, unknown>;
  ipAddress?: string;
  userAgent?: string;
  timestamp: Date;
}
