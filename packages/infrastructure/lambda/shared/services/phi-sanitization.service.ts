// RADIANT v4.18.0 - PHI Sanitization Service
// HIPAA-compliant detection and handling of Protected Health Information

import { executeStatement, stringParam } from '../db/client';

// ============================================================================
// Types
// ============================================================================

export interface PHIDetectionResult {
  containsPHI: boolean;
  detectedTypes: PHIType[];
  sanitizedText: string;
  redactedCount: number;
  confidence: number;
}

export type PHIType =
  | 'ssn'              // Social Security Number
  | 'mrn'              // Medical Record Number
  | 'npi'              // National Provider Identifier
  | 'dea'              // DEA Number
  | 'drivers_license'  // Driver's License
  | 'passport'         // Passport Number
  | 'phone'            // Phone Number
  | 'email'            // Email Address
  | 'dob'              // Date of Birth
  | 'address'          // Physical Address
  | 'health_plan_id'   // Health Plan Beneficiary ID
  | 'account_number'   // Account Number
  | 'vehicle_id'       // Vehicle Identifier
  | 'device_id'        // Device Serial Number
  | 'url'              // Web URL
  | 'ip_address'       // IP Address
  | 'biometric'        // Biometric Identifier
  | 'photo'            // Full-face Photo Reference
  | 'name'             // Full Name
  | 'medical_condition'// Medical Condition
  | 'medication'       // Medication Name
  | 'diagnosis_code';  // ICD/CPT Code

interface PHIPattern {
  type: PHIType;
  pattern: RegExp;
  replacement: string;
  confidence: number;
}

// ============================================================================
// PHI Detection Patterns (HIPAA 18 Identifiers + Medical Terms)
// ============================================================================

const PHI_PATTERNS: PHIPattern[] = [
  // Social Security Number
  {
    type: 'ssn',
    pattern: /\b\d{3}[-\s]?\d{2}[-\s]?\d{4}\b/g,
    replacement: '[SSN REDACTED]',
    confidence: 0.95,
  },
  // Medical Record Number (various formats)
  {
    type: 'mrn',
    pattern: /\b(?:MRN|Medical Record|Patient ID)[:\s#]*([A-Z0-9]{6,12})\b/gi,
    replacement: '[MRN REDACTED]',
    confidence: 0.9,
  },
  // National Provider Identifier
  {
    type: 'npi',
    pattern: /\b(?:NPI)[:\s#]*(\d{10})\b/gi,
    replacement: '[NPI REDACTED]',
    confidence: 0.95,
  },
  // DEA Number
  {
    type: 'dea',
    pattern: /\b(?:DEA)[:\s#]*([A-Z]{2}\d{7})\b/gi,
    replacement: '[DEA REDACTED]',
    confidence: 0.95,
  },
  // Driver's License (various state formats)
  {
    type: 'drivers_license',
    pattern: /\b(?:DL|Driver'?s? License)[:\s#]*([A-Z0-9]{5,15})\b/gi,
    replacement: '[LICENSE REDACTED]',
    confidence: 0.85,
  },
  // Passport Number
  {
    type: 'passport',
    pattern: /\b(?:Passport)[:\s#]*([A-Z0-9]{6,9})\b/gi,
    replacement: '[PASSPORT REDACTED]',
    confidence: 0.9,
  },
  // Phone Number
  {
    type: 'phone',
    pattern: /\b(?:\+1[-.\s]?)?(?:\(?\d{3}\)?[-.\s]?)?\d{3}[-.\s]?\d{4}\b/g,
    replacement: '[PHONE REDACTED]',
    confidence: 0.8,
  },
  // Email Address
  {
    type: 'email',
    pattern: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g,
    replacement: '[EMAIL REDACTED]',
    confidence: 0.95,
  },
  // Date of Birth (various formats)
  {
    type: 'dob',
    pattern: /\b(?:DOB|Date of Birth|Born)[:\s]*(\d{1,2}[-/]\d{1,2}[-/]\d{2,4})\b/gi,
    replacement: '[DOB REDACTED]',
    confidence: 0.9,
  },
  // Health Plan ID
  {
    type: 'health_plan_id',
    pattern: /\b(?:Member ID|Policy|Insurance ID)[:\s#]*([A-Z0-9]{8,15})\b/gi,
    replacement: '[HEALTH PLAN ID REDACTED]',
    confidence: 0.85,
  },
  // IP Address
  {
    type: 'ip_address',
    pattern: /\b(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\b/g,
    replacement: '[IP REDACTED]',
    confidence: 0.95,
  },
  // Credit Card (for PCI compliance)
  {
    type: 'account_number',
    pattern: /\b(?:\d{4}[-\s]?){3}\d{4}\b/g,
    replacement: '[CARD REDACTED]',
    confidence: 0.9,
  },
  // ICD-10 Diagnosis Codes
  {
    type: 'diagnosis_code',
    pattern: /\b[A-TV-Z]\d{2}(?:\.\d{1,4})?\b/g,
    replacement: '[DIAGNOSIS CODE]',
    confidence: 0.7,
  },
];

// Medical condition keywords (contextual detection)
const MEDICAL_KEYWORDS = [
  'diabetes', 'cancer', 'hiv', 'aids', 'hepatitis', 'tuberculosis',
  'depression', 'anxiety', 'schizophrenia', 'bipolar', 'adhd',
  'pregnancy', 'pregnant', 'abortion', 'miscarriage',
  'substance abuse', 'addiction', 'overdose', 'rehab',
  'surgery', 'transplant', 'chemotherapy', 'radiation',
  'diagnosis', 'prognosis', 'treatment plan', 'medication',
];

// ============================================================================
// PHI Sanitization Service
// ============================================================================

class PHISanitizationService {
  /**
   * Check if HIPAA mode is enabled for tenant
   */
  async isHIPAAEnabled(tenantId: string): Promise<boolean> {
    const result = await executeStatement(
      `SELECT hipaa_enabled FROM hipaa_config WHERE tenant_id = $1::uuid`,
      [stringParam('tenantId', tenantId)]
    );
    return result.rows?.[0]?.hipaa_enabled === true;
  }

  /**
   * Detect PHI in text
   */
  detectPHI(text: string): PHIDetectionResult {
    const detectedTypes: PHIType[] = [];
    let sanitizedText = text;
    let redactedCount = 0;
    let totalConfidence = 0;

    // Apply pattern-based detection
    for (const pattern of PHI_PATTERNS) {
      const matches = text.match(pattern.pattern);
      if (matches && matches.length > 0) {
        detectedTypes.push(pattern.type);
        sanitizedText = sanitizedText.replace(pattern.pattern, pattern.replacement);
        redactedCount += matches.length;
        totalConfidence += pattern.confidence * matches.length;
      }
    }

    // Check for medical keywords (contextual)
    const lowerText = text.toLowerCase();
    for (const keyword of MEDICAL_KEYWORDS) {
      if (lowerText.includes(keyword)) {
        if (!detectedTypes.includes('medical_condition')) {
          detectedTypes.push('medical_condition');
          totalConfidence += 0.6;
        }
      }
    }

    const avgConfidence = redactedCount > 0 ? totalConfidence / redactedCount : 0;

    return {
      containsPHI: detectedTypes.length > 0,
      detectedTypes,
      sanitizedText,
      redactedCount,
      confidence: Math.min(avgConfidence, 1),
    };
  }

  /**
   * Sanitize text by redacting PHI
   */
  sanitize(text: string): string {
    return this.detectPHI(text).sanitizedText;
  }

  /**
   * Sanitize with logging (for HIPAA audit trail)
   */
  async sanitizeWithAudit(
    tenantId: string,
    userId: string,
    text: string,
    context: {
      purpose: string;
      resourceType: string;
      resourceId?: string;
    }
  ): Promise<PHIDetectionResult> {
    const result = this.detectPHI(text);

    // Log PHI access if detected
    if (result.containsPHI) {
      await this.logPHIAccess(tenantId, userId, {
        accessType: 'view',
        resourceType: context.resourceType,
        resourceId: context.resourceId || '',
        phiFields: result.detectedTypes,
        purpose: context.purpose,
      });
    }

    return result;
  }

  /**
   * Log PHI access for HIPAA compliance
   */
  async logPHIAccess(
    tenantId: string,
    userId: string,
    details: {
      accessType: 'view' | 'create' | 'update' | 'delete' | 'export' | 'print';
      resourceType: string;
      resourceId: string;
      phiFields: PHIType[];
      purpose?: string;
      ipAddress?: string;
      sessionId?: string;
    }
  ): Promise<void> {
    await executeStatement(
      `INSERT INTO phi_access_log (
        tenant_id, user_id, access_type, resource_type, resource_id,
        phi_fields, purpose, ip_address, session_id
      ) VALUES (
        $1::uuid, $2::uuid, $3, $4, $5,
        $6::text[], $7, $8::inet, $9::uuid
      )`,
      [
        stringParam('tenantId', tenantId),
        stringParam('userId', userId),
        stringParam('accessType', details.accessType),
        stringParam('resourceType', details.resourceType),
        stringParam('resourceId', details.resourceId),
        stringParam('phiFields', `{${details.phiFields.join(',')}}`),
        stringParam('purpose', details.purpose || ''),
        stringParam('ipAddress', details.ipAddress || ''),
        stringParam('sessionId', details.sessionId || ''),
      ]
    );
  }

  /**
   * Get PHI access logs for audit
   */
  async getPHIAccessLogs(
    tenantId: string,
    filters?: {
      userId?: string;
      resourceType?: string;
      startDate?: Date;
      endDate?: Date;
      limit?: number;
    }
  ): Promise<PHIAccessLog[]> {
    let sql = `
      SELECT * FROM phi_access_log
      WHERE tenant_id = $1::uuid
    `;
    const params = [stringParam('tenantId', tenantId)];
    let paramIndex = 2;

    if (filters?.userId) {
      sql += ` AND user_id = $${paramIndex}::uuid`;
      params.push(stringParam('userId', filters.userId));
      paramIndex++;
    }

    if (filters?.resourceType) {
      sql += ` AND resource_type = $${paramIndex}`;
      params.push(stringParam('resourceType', filters.resourceType));
      paramIndex++;
    }

    if (filters?.startDate) {
      sql += ` AND accessed_at >= $${paramIndex}`;
      params.push(stringParam('startDate', filters.startDate.toISOString()));
      paramIndex++;
    }

    if (filters?.endDate) {
      sql += ` AND accessed_at <= $${paramIndex}`;
      params.push(stringParam('endDate', filters.endDate.toISOString()));
      paramIndex++;
    }

    sql += ` ORDER BY accessed_at DESC LIMIT ${filters?.limit || 100}`;

    const result = await executeStatement(sql, params);

    return (result.rows || []).map((row: Record<string, unknown>) => ({
      id: row.id as string,
      tenantId: row.tenant_id as string,
      userId: row.user_id as string,
      accessType: row.access_type as string,
      resourceType: row.resource_type as string,
      resourceId: row.resource_id as string,
      phiFields: row.phi_fields as PHIType[],
      purpose: row.purpose as string,
      ipAddress: row.ip_address as string,
      sessionId: row.session_id as string,
      accessedAt: new Date(row.accessed_at as string),
    }));
  }

  /**
   * Validate that text doesn't contain PHI (for non-HIPAA contexts)
   */
  validateNoPHI(text: string): { valid: boolean; violations: PHIType[] } {
    const result = this.detectPHI(text);
    return {
      valid: !result.containsPHI,
      violations: result.detectedTypes,
    };
  }

  /**
   * Get HIPAA configuration for tenant
   */
  async getHIPAAConfig(tenantId: string): Promise<HIPAAConfig | null> {
    const result = await executeStatement(
      `SELECT * FROM hipaa_config WHERE tenant_id = $1::uuid`,
      [stringParam('tenantId', tenantId)]
    );

    if (!result.rows?.length) return null;

    const row = result.rows[0] as Record<string, unknown>;
    return {
      tenantId: row.tenant_id as string,
      hipaaEnabled: Boolean(row.hipaa_enabled),
      baaSignedDate: row.baa_signed_date ? new Date(row.baa_signed_date as string) : undefined,
      phiDetectionEnabled: Boolean(row.phi_detection_enabled),
      phiEncryptionEnabled: Boolean(row.phi_encryption_enabled),
      enhancedLoggingEnabled: Boolean(row.enhanced_logging_enabled),
      mfaRequired: Boolean(row.mfa_required),
      sessionTimeoutMinutes: parseInt(row.session_timeout_minutes as string, 10),
      accessReviewDays: parseInt(row.access_review_days as string, 10),
      phiRetentionDays: parseInt(row.phi_retention_days as string, 10),
      auditRetentionDays: parseInt(row.audit_retention_days as string, 10),
    };
  }

  /**
   * Update HIPAA configuration
   */
  async updateHIPAAConfig(
    tenantId: string,
    config: Partial<HIPAAConfig>
  ): Promise<void> {
    await executeStatement(
      `INSERT INTO hipaa_config (tenant_id, hipaa_enabled, phi_detection_enabled, 
        phi_encryption_enabled, enhanced_logging_enabled, mfa_required,
        session_timeout_minutes, access_review_days, phi_retention_days, audit_retention_days)
       VALUES ($1::uuid, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       ON CONFLICT (tenant_id) DO UPDATE SET
        hipaa_enabled = COALESCE($2, hipaa_config.hipaa_enabled),
        phi_detection_enabled = COALESCE($3, hipaa_config.phi_detection_enabled),
        phi_encryption_enabled = COALESCE($4, hipaa_config.phi_encryption_enabled),
        enhanced_logging_enabled = COALESCE($5, hipaa_config.enhanced_logging_enabled),
        mfa_required = COALESCE($6, hipaa_config.mfa_required),
        session_timeout_minutes = COALESCE($7, hipaa_config.session_timeout_minutes),
        access_review_days = COALESCE($8, hipaa_config.access_review_days),
        phi_retention_days = COALESCE($9, hipaa_config.phi_retention_days),
        audit_retention_days = COALESCE($10, hipaa_config.audit_retention_days),
        updated_at = NOW()`,
      [
        stringParam('tenantId', tenantId),
        stringParam('hipaaEnabled', String(config.hipaaEnabled ?? true)),
        stringParam('phiDetectionEnabled', String(config.phiDetectionEnabled ?? true)),
        stringParam('phiEncryptionEnabled', String(config.phiEncryptionEnabled ?? true)),
        stringParam('enhancedLoggingEnabled', String(config.enhancedLoggingEnabled ?? true)),
        stringParam('mfaRequired', String(config.mfaRequired ?? true)),
        stringParam('sessionTimeoutMinutes', String(config.sessionTimeoutMinutes ?? 15)),
        stringParam('accessReviewDays', String(config.accessReviewDays ?? 90)),
        stringParam('phiRetentionDays', String(config.phiRetentionDays ?? 2190)),
        stringParam('auditRetentionDays', String(config.auditRetentionDays ?? 2555)),
      ]
    );
  }
}

// ============================================================================
// Types for External Use
// ============================================================================

export interface PHIAccessLog {
  id: string;
  tenantId: string;
  userId: string;
  accessType: string;
  resourceType: string;
  resourceId: string;
  phiFields: PHIType[];
  purpose?: string;
  ipAddress?: string;
  sessionId?: string;
  accessedAt: Date;
}

export interface HIPAAConfig {
  tenantId: string;
  hipaaEnabled: boolean;
  baaSignedDate?: Date;
  phiDetectionEnabled: boolean;
  phiEncryptionEnabled: boolean;
  enhancedLoggingEnabled: boolean;
  mfaRequired: boolean;
  sessionTimeoutMinutes: number;
  accessReviewDays: number;
  phiRetentionDays: number;
  auditRetentionDays: number;
}

export const phiSanitizationService = new PHISanitizationService();
