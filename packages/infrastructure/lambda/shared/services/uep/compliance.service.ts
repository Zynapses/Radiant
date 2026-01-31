// RADIANT v5.53.0 - UEP v2.0 Compliance Service
// Regulatory compliance enforcement for HIPAA, GDPR, SOC2, FDA

import { Pool } from 'pg';
import * as crypto from 'crypto';
import {
  UEPEnvelope,
  UEPComplianceInfo,
  UEPDataClassification,
  UEPRiskSignal,
} from '@radiant/shared';
import { PHIConfig, SanitizationResult, PHIDetection, DEFAULT_PHI_CONFIG } from '../../phi/types';

// ============================================================================
// REGULATORY FRAMEWORK DEFINITIONS
// ============================================================================

export type RegulatoryFramework = 'HIPAA' | 'GDPR' | 'SOC2' | 'FDA' | 'CCPA' | 'PCI-DSS';

export interface FrameworkRequirements {
  framework: RegulatoryFramework;
  requirements: {
    encryption: 'required' | 'recommended' | 'optional';
    auditLogging: 'required' | 'recommended' | 'optional';
    dataClassification: 'required' | 'recommended' | 'optional';
    retentionMinDays: number;
    retentionMaxDays?: number;
    piiDetection: 'required' | 'recommended' | 'optional';
    phiDetection: 'required' | 'recommended' | 'optional';
    consentTracking: 'required' | 'recommended' | 'optional';
    rightToErasure: 'required' | 'recommended' | 'optional';
    crossBorderRestrictions: 'required' | 'recommended' | 'optional';
  };
}

export const FRAMEWORK_REQUIREMENTS: Record<RegulatoryFramework, FrameworkRequirements> = {
  HIPAA: {
    framework: 'HIPAA',
    requirements: {
      encryption: 'required',
      auditLogging: 'required',
      dataClassification: 'required',
      retentionMinDays: 2190, // 6 years
      piiDetection: 'required',
      phiDetection: 'required',
      consentTracking: 'recommended',
      rightToErasure: 'optional', // HIPAA doesn't require this
      crossBorderRestrictions: 'recommended',
    },
  },
  GDPR: {
    framework: 'GDPR',
    requirements: {
      encryption: 'required',
      auditLogging: 'required',
      dataClassification: 'required',
      retentionMinDays: 0, // Data minimization - keep only as needed
      retentionMaxDays: 365, // Unless specific purpose
      piiDetection: 'required',
      phiDetection: 'recommended',
      consentTracking: 'required',
      rightToErasure: 'required',
      crossBorderRestrictions: 'required',
    },
  },
  SOC2: {
    framework: 'SOC2',
    requirements: {
      encryption: 'required',
      auditLogging: 'required',
      dataClassification: 'recommended',
      retentionMinDays: 365, // 1 year
      piiDetection: 'recommended',
      phiDetection: 'optional',
      consentTracking: 'optional',
      rightToErasure: 'optional',
      crossBorderRestrictions: 'optional',
    },
  },
  FDA: {
    framework: 'FDA',
    requirements: {
      encryption: 'required',
      auditLogging: 'required',
      dataClassification: 'required',
      retentionMinDays: 730, // 2 years for medical devices
      piiDetection: 'required',
      phiDetection: 'required',
      consentTracking: 'required',
      rightToErasure: 'optional',
      crossBorderRestrictions: 'recommended',
    },
  },
  CCPA: {
    framework: 'CCPA',
    requirements: {
      encryption: 'recommended',
      auditLogging: 'required',
      dataClassification: 'required',
      retentionMinDays: 0,
      piiDetection: 'required',
      phiDetection: 'optional',
      consentTracking: 'required',
      rightToErasure: 'required',
      crossBorderRestrictions: 'optional',
    },
  },
  'PCI-DSS': {
    framework: 'PCI-DSS',
    requirements: {
      encryption: 'required',
      auditLogging: 'required',
      dataClassification: 'required',
      retentionMinDays: 365,
      piiDetection: 'required',
      phiDetection: 'optional',
      consentTracking: 'optional',
      rightToErasure: 'optional',
      crossBorderRestrictions: 'optional',
    },
  },
};

// ============================================================================
// COMPLIANCE AUDIT RESULT
// ============================================================================

export interface ComplianceAuditResult {
  envelopeId: string;
  auditedAt: string;
  frameworks: RegulatoryFramework[];
  overallStatus: 'compliant' | 'non_compliant' | 'partial' | 'not_assessed';
  findings: ComplianceFinding[];
  riskScore: number; // 0-100
  recommendations: string[];
  requiresEncryption: boolean;
  requiresRedaction: boolean;
  dataClassification: UEPDataClassification;
  retentionDays: number;
}

export interface ComplianceFinding {
  framework: RegulatoryFramework;
  requirement: string;
  status: 'pass' | 'fail' | 'warning' | 'not_applicable';
  severity: 'low' | 'medium' | 'high' | 'critical';
  description: string;
  remediation?: string;
}

// ============================================================================
// PHI/PII DETECTION PATTERNS
// ============================================================================

const PHI_PATTERNS = {
  ssn: /\b\d{3}[-.]?\d{2}[-.]?\d{4}\b/g,
  mrn: /\b(MRN|mrn|Medical Record)[:\s#]*\d{6,12}\b/gi,
  email: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g,
  phone: /\b(\+?1[-.]?)?\(?[0-9]{3}\)?[-.\s]?[0-9]{3}[-.\s]?[0-9]{4}\b/g,
  dob: /\b(DOB|dob|Date of Birth|born)[:\s]*(0?[1-9]|1[0-2])[\/\-](0?[1-9]|[12]\d|3[01])[\/\-](\d{2}|\d{4})\b/gi,
  creditCard: /\b(?:4[0-9]{12}(?:[0-9]{3})?|5[1-5][0-9]{14}|3[47][0-9]{13}|6(?:011|5[0-9]{2})[0-9]{12})\b/g,
  ipAddress: /\b(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\b/g,
  diagnosis: /\b(ICD-?10|diagnosis|diagnosed with)[:\s]*[A-Z]\d{2}(\.\d{1,4})?\b/gi,
  medication: /\b(prescribed|taking|medication)[:\s]*[A-Za-z]+\s+\d+\s*(mg|ml|mcg)\b/gi,
};

const PII_PATTERNS = {
  driversLicense: /\b[A-Z]{1,2}\d{5,8}\b/g,
  passport: /\b[A-Z]{1,2}\d{6,9}\b/g,
  bankAccount: /\b\d{8,17}\b/g, // Basic pattern, needs context
};

// ============================================================================
// UEP COMPLIANCE SERVICE
// ============================================================================

export class UEPComplianceService {
  private phiConfig: PHIConfig;

  constructor(
    private pool: Pool,
    phiConfig?: PHIConfig
  ) {
    this.phiConfig = phiConfig || DEFAULT_PHI_CONFIG;
  }

  /**
   * Audit an envelope for regulatory compliance
   */
  async auditEnvelope<T>(
    envelope: UEPEnvelope<T>,
    frameworks: RegulatoryFramework[]
  ): Promise<ComplianceAuditResult> {
    const findings: ComplianceFinding[] = [];
    let riskScore = 0;
    const recommendations: string[] = [];

    // Detect PHI/PII in payload
    const payloadText = this.extractPayloadText(envelope);
    const phiDetections = this.detectPHI(payloadText);
    const piiDetections = this.detectPII(payloadText);

    const containsPhi = phiDetections.length > 0;
    const containsPii = piiDetections.length > 0 || containsPhi;

    // Determine data classification
    const dataClassification = this.determineDataClassification(
      containsPhi,
      containsPii,
      envelope.compliance?.dataClassification
    );

    // Calculate retention days
    const retentionDays = this.calculateRetentionDays(frameworks, containsPhi);

    // Check each framework's requirements
    for (const framework of frameworks) {
      const reqs = FRAMEWORK_REQUIREMENTS[framework];
      if (!reqs) continue;

      // Encryption check
      if (reqs.requirements.encryption === 'required') {
        const hasEncryption = envelope.extensions?.encrypted === true ||
          envelope.payload.contentEncoding === 'encrypted';
        
        findings.push({
          framework,
          requirement: 'Encryption',
          status: hasEncryption || dataClassification === 'PUBLIC' ? 'pass' : 'fail',
          severity: containsPhi ? 'critical' : 'high',
          description: hasEncryption 
            ? 'Data is encrypted' 
            : 'Sensitive data should be encrypted',
          remediation: hasEncryption ? undefined : 'Enable envelope encryption via UEPSecurityService',
        });

        if (!hasEncryption && dataClassification !== 'PUBLIC') {
          riskScore += containsPhi ? 30 : 15;
          recommendations.push(`${framework}: Enable encryption for ${dataClassification} data`);
        }
      }

      // Audit logging check
      if (reqs.requirements.auditLogging === 'required') {
        const hasTracing = !!envelope.tracing?.traceId;
        findings.push({
          framework,
          requirement: 'Audit Logging',
          status: hasTracing ? 'pass' : 'fail',
          severity: 'high',
          description: hasTracing 
            ? 'Tracing enabled for audit trail' 
            : 'Missing trace ID for audit trail',
        });

        if (!hasTracing) {
          riskScore += 20;
          recommendations.push(`${framework}: Add tracing info to envelope`);
        }
      }

      // PHI Detection check
      if (reqs.requirements.phiDetection === 'required' && containsPhi) {
        const phiFlagged = envelope.compliance?.containsPhi === true;
        findings.push({
          framework,
          requirement: 'PHI Detection',
          status: phiFlagged ? 'pass' : 'warning',
          severity: 'critical',
          description: phiFlagged 
            ? 'PHI properly flagged' 
            : `PHI detected but not flagged: ${phiDetections.map(d => d.type).join(', ')}`,
          remediation: phiFlagged ? undefined : 'Set compliance.containsPhi = true',
        });

        if (!phiFlagged) {
          riskScore += 25;
          recommendations.push(`${framework}: Flag envelope as containing PHI`);
        }
      }

      // PII Detection check
      if (reqs.requirements.piiDetection === 'required' && containsPii) {
        const piiFlagged = envelope.compliance?.containsPii === true;
        findings.push({
          framework,
          requirement: 'PII Detection',
          status: piiFlagged ? 'pass' : 'warning',
          severity: 'high',
          description: piiFlagged 
            ? 'PII properly flagged' 
            : 'PII detected but not flagged',
          remediation: piiFlagged ? undefined : 'Set compliance.containsPii = true',
        });

        if (!piiFlagged) {
          riskScore += 15;
        }
      }

      // Data classification check
      if (reqs.requirements.dataClassification === 'required') {
        const hasClassification = !!envelope.compliance?.dataClassification;
        findings.push({
          framework,
          requirement: 'Data Classification',
          status: hasClassification ? 'pass' : 'fail',
          severity: 'medium',
          description: hasClassification 
            ? `Data classified as ${envelope.compliance?.dataClassification}` 
            : 'Missing data classification',
        });

        if (!hasClassification) {
          riskScore += 10;
          recommendations.push(`${framework}: Add data classification to envelope`);
        }
      }

      // Retention check
      if (reqs.requirements.retentionMinDays > 0) {
        const configuredRetention = envelope.compliance?.retentionDays || 0;
        const meetsMinimum = configuredRetention >= reqs.requirements.retentionMinDays;
        
        findings.push({
          framework,
          requirement: 'Data Retention',
          status: meetsMinimum ? 'pass' : 'warning',
          severity: 'medium',
          description: meetsMinimum 
            ? `Retention (${configuredRetention} days) meets minimum (${reqs.requirements.retentionMinDays} days)` 
            : `Retention (${configuredRetention} days) below minimum (${reqs.requirements.retentionMinDays} days)`,
        });
      }
    }

    // Cap risk score at 100
    riskScore = Math.min(100, riskScore);

    // Determine overall status
    const criticalFailures = findings.filter(f => f.status === 'fail' && f.severity === 'critical');
    const highFailures = findings.filter(f => f.status === 'fail' && f.severity === 'high');
    const warnings = findings.filter(f => f.status === 'warning');

    let overallStatus: ComplianceAuditResult['overallStatus'];
    if (criticalFailures.length > 0) {
      overallStatus = 'non_compliant';
    } else if (highFailures.length > 0) {
      overallStatus = 'partial';
    } else if (warnings.length > 0) {
      overallStatus = 'partial';
    } else {
      overallStatus = 'compliant';
    }

    return {
      envelopeId: envelope.envelopeId,
      auditedAt: new Date().toISOString(),
      frameworks,
      overallStatus,
      findings,
      riskScore,
      recommendations,
      requiresEncryption: containsPhi || containsPii || dataClassification !== 'PUBLIC',
      requiresRedaction: containsPhi && this.phiConfig.mode === 'sanitize',
      dataClassification,
      retentionDays,
    };
  }

  /**
   * Enforce compliance on an envelope (mutates and returns)
   */
  enforceCompliance<T>(
    envelope: UEPEnvelope<T>,
    frameworks: RegulatoryFramework[],
    tenantId: string
  ): { envelope: UEPEnvelope<T>; riskSignals: UEPRiskSignal[] } {
    const riskSignals: UEPRiskSignal[] = [];
    
    // Detect PHI/PII
    const payloadText = this.extractPayloadText(envelope);
    const phiDetections = this.detectPHI(payloadText);
    const piiDetections = this.detectPII(payloadText);
    
    const containsPhi = phiDetections.length > 0;
    const containsPii = piiDetections.length > 0 || containsPhi;

    // Set compliance metadata
    const dataClassification = this.determineDataClassification(
      containsPhi,
      containsPii,
      envelope.compliance?.dataClassification
    );

    const retentionDays = this.calculateRetentionDays(frameworks, containsPhi);

    envelope.compliance = {
      frameworks,
      dataClassification,
      containsPii,
      containsPhi,
      retentionDays,
    };

    // Add risk signals for detected sensitive data
    if (containsPhi) {
      riskSignals.push({
        signalId: crypto.randomUUID(),
        signalType: 'phi_detected',
        severity: 'HIGH',
        description: `PHI detected: ${phiDetections.map(d => d.type).join(', ')}`,
        source: 'UEPComplianceService',
        mitigationSuggestion: 'Ensure data is encrypted and access is logged',
      });
    }

    if (piiDetections.length > 0) {
      riskSignals.push({
        signalId: crypto.randomUUID(),
        signalType: 'pii_detected',
        severity: 'MEDIUM',
        description: `PII detected: ${piiDetections.map(d => d.type).join(', ')}`,
        source: 'UEPComplianceService',
        mitigationSuggestion: 'Review data handling procedures',
      });
    }

    // Add framework-specific signals
    for (const framework of frameworks) {
      const reqs = FRAMEWORK_REQUIREMENTS[framework];
      if (reqs?.requirements.encryption === 'required' && dataClassification !== 'PUBLIC') {
        if (!envelope.extensions?.encrypted) {
          riskSignals.push({
            signalId: crypto.randomUUID(),
            signalType: 'encryption_required',
            severity: containsPhi ? 'CRITICAL' : 'HIGH',
            description: `${framework} requires encryption for ${dataClassification} data`,
            source: 'UEPComplianceService',
            mitigationSuggestion: 'Enable encryption via UEPSecurityService',
          });
        }
      }
    }

    // Merge risk signals
    envelope.riskSignals = [...(envelope.riskSignals || []), ...riskSignals];

    return { envelope, riskSignals };
  }

  /**
   * Sanitize PHI from payload (if mode is 'sanitize')
   */
  sanitizePayload<T>(payload: T): { sanitized: T; result: SanitizationResult } {
    const text = JSON.stringify(payload);
    const detections: PHIDetection[] = [];
    let sanitizedText = text;

    if (this.phiConfig.mode === 'sanitize') {
      // Apply PHI patterns
      for (const [type, pattern] of Object.entries(PHI_PATTERNS)) {
        if (this.phiConfig.patterns[type as keyof typeof this.phiConfig.patterns]) {
          const matches = text.matchAll(pattern);
          for (const match of matches) {
            if (match.index !== undefined) {
              detections.push({
                type,
                value: match[0],
                start: match.index,
                end: match.index + match[0].length,
                redactedValue: this.phiConfig.redactionText,
              });
              sanitizedText = sanitizedText.replace(match[0], this.phiConfig.redactionText);
            }
          }
        }
      }
    }

    return {
      sanitized: JSON.parse(sanitizedText) as T,
      result: {
        sanitizedText,
        detections,
        containsPHI: detections.length > 0,
        originalLength: text.length,
        sanitizedLength: sanitizedText.length,
      },
    };
  }

  /**
   * Log compliance audit to database
   */
  async logAudit(
    tenantId: string,
    auditResult: ComplianceAuditResult
  ): Promise<void> {
    await this.pool.query(
      `INSERT INTO compliance_audit_logs (
        tenant_id, envelope_id, frameworks, overall_status,
        risk_score, findings, recommendations, audited_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [
        tenantId,
        auditResult.envelopeId,
        auditResult.frameworks,
        auditResult.overallStatus,
        auditResult.riskScore,
        JSON.stringify(auditResult.findings),
        auditResult.recommendations,
        auditResult.auditedAt,
      ]
    );
  }

  /**
   * Get tenant compliance configuration
   */
  async getTenantComplianceConfig(tenantId: string): Promise<{
    frameworks: RegulatoryFramework[];
    phiConfig: PHIConfig;
    retentionDays: number;
  }> {
    const result = await this.pool.query<{
      compliance_mode: string[];
      phi_enabled: boolean;
      phi_mode: string;
      retention_days: number;
    }>(
      `SELECT 
        COALESCE(compliance_mode, '{}') as compliance_mode,
        COALESCE((SELECT hipaa_enabled FROM hipaa_config WHERE tenant_id = t.id), false) as phi_enabled,
        COALESCE((SELECT mode FROM hipaa_config WHERE tenant_id = t.id), 'sanitize') as phi_mode,
        COALESCE(retention_days, 30) as retention_days
      FROM tenants t
      WHERE id = $1`,
      [tenantId]
    );

    const row = result.rows[0];
    const frameworks = (row?.compliance_mode || [])
      .map(m => m.toUpperCase())
      .filter(m => m in FRAMEWORK_REQUIREMENTS) as RegulatoryFramework[];

    return {
      frameworks,
      phiConfig: {
        ...DEFAULT_PHI_CONFIG,
        enabled: row?.phi_enabled || false,
        mode: (row?.phi_mode as 'sanitize' | 'block' | 'warn') || 'sanitize',
      },
      retentionDays: row?.retention_days || 30,
    };
  }

  // ============================================================================
  // PRIVATE HELPERS
  // ============================================================================

  private extractPayloadText<T>(envelope: UEPEnvelope<T>): string {
    if (typeof envelope.payload.data === 'string') {
      return envelope.payload.data;
    }
    return JSON.stringify(envelope.payload.data);
  }

  private detectPHI(text: string): PHIDetection[] {
    const detections: PHIDetection[] = [];

    for (const [type, pattern] of Object.entries(PHI_PATTERNS)) {
      const matches = text.matchAll(pattern);
      for (const match of matches) {
        if (match.index !== undefined) {
          detections.push({
            type,
            value: match[0],
            start: match.index,
            end: match.index + match[0].length,
            redactedValue: '[PHI_REDACTED]',
          });
        }
      }
    }

    return detections;
  }

  private detectPII(text: string): PHIDetection[] {
    const detections: PHIDetection[] = [];

    for (const [type, pattern] of Object.entries(PII_PATTERNS)) {
      const matches = text.matchAll(pattern);
      for (const match of matches) {
        if (match.index !== undefined) {
          detections.push({
            type,
            value: match[0],
            start: match.index,
            end: match.index + match[0].length,
            redactedValue: '[PII_REDACTED]',
          });
        }
      }
    }

    return detections;
  }

  private determineDataClassification(
    containsPhi: boolean,
    containsPii: boolean,
    existing?: UEPDataClassification
  ): UEPDataClassification {
    if (existing === 'RESTRICTED') return 'RESTRICTED';
    if (containsPhi) return 'RESTRICTED';
    if (existing === 'CONFIDENTIAL') return 'CONFIDENTIAL';
    if (containsPii) return 'CONFIDENTIAL';
    if (existing === 'INTERNAL') return 'INTERNAL';
    return existing || 'INTERNAL';
  }

  private calculateRetentionDays(
    frameworks: RegulatoryFramework[],
    containsPhi: boolean
  ): number {
    let maxRetention = 30; // Default

    for (const framework of frameworks) {
      const reqs = FRAMEWORK_REQUIREMENTS[framework];
      if (reqs && reqs.requirements.retentionMinDays > maxRetention) {
        maxRetention = reqs.requirements.retentionMinDays;
      }
    }

    // HIPAA override for PHI
    if (containsPhi && frameworks.includes('HIPAA')) {
      maxRetention = Math.max(maxRetention, 2190); // 6 years
    }

    return maxRetention;
  }
}

// Singleton
let complianceServiceInstance: UEPComplianceService | null = null;

export function getComplianceService(pool: Pool): UEPComplianceService {
  if (!complianceServiceInstance) {
    complianceServiceInstance = new UEPComplianceService(pool);
  }
  return complianceServiceInstance;
}

export default UEPComplianceService;
