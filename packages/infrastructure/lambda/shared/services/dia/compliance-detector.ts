/**
 * RADIANT v5.43.0 - DIA Engine Compliance Detector
 * 
 * Detects compliance requirements (HIPAA, SOC2, GDPR) and sensitive data (PHI, PII)
 * in decision artifacts for proper classification and export handling.
 */

import {
  ComplianceMetadata,
  HIPAACompliance,
  SOC2Compliance,
  GDPRCompliance,
  Claim,
} from '@radiant/shared';

interface ExtractionContext {
  conversationId: string;
  messages: Array<{ content: string }>;
  primaryDomain?: string;
}

const PHI_PATTERNS = [
  /\b\d{3}-\d{2}-\d{4}\b/g, // SSN
  /\b[A-Z]{1,2}\d{6,8}\b/gi, // Medical Record Numbers
  /\bMRN[:\s]*\d+/gi,
  /\bpatient\s+(?:name|id|number)/gi,
  /\bdiagnosis[:\s]/gi,
  /\btreatment[:\s]/gi,
  /\bmedication[:\s]/gi,
  /\bprescription[:\s]/gi,
  /\blab\s+results?/gi,
  /\bblood\s+(?:type|pressure|sugar|test)/gi,
  /\bmedical\s+(?:history|record|condition)/gi,
  /\bhealth\s+(?:insurance|plan|condition)/gi,
  /\bHIPAA/gi,
  /\bPHI\b/g,
];

const PII_PATTERNS = [
  /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g, // Email
  /\b\d{3}[-.\s]?\d{3}[-.\s]?\d{4}\b/g, // Phone numbers
  /\b\d{5}(?:-\d{4})?\b/g, // ZIP codes
  /\bdate\s+of\s+birth/gi,
  /\bDOB[:\s]/gi,
  /\baddress[:\s]/gi,
  /\bsocial\s+security/gi,
  /\bdriver'?s?\s+license/gi,
  /\bpassport\s+(?:number|#)/gi,
  /\bcredit\s+card/gi,
  /\bbank\s+account/gi,
];

const SOC2_CONTROL_KEYWORDS: Record<string, string[]> = {
  'CC6.1': ['access control', 'authentication', 'authorization', 'permission', 'role-based'],
  'CC6.2': ['user registration', 'provisioning', 'deprovisioning', 'access review'],
  'CC6.3': ['system access', 'privileged access', 'admin access'],
  'CC7.1': ['change management', 'change control', 'deployment', 'release'],
  'CC7.2': ['system monitoring', 'logging', 'audit trail', 'alerting'],
  'CC7.3': ['incident response', 'security incident', 'breach', 'vulnerability'],
  'CC8.1': ['data retention', 'data disposal', 'backup', 'recovery'],
};

const GDPR_KEYWORDS = [
  'personal data', 'data subject', 'consent', 'legitimate interest',
  'right to access', 'right to erasure', 'right to be forgotten',
  'data portability', 'GDPR', 'data protection', 'privacy',
  'EU citizen', 'European', 'data controller', 'data processor',
];

const HEALTHCARE_DOMAINS = [
  'healthcare', 'medical', 'clinical', 'health', 'pharma',
  'biotech', 'hospital', 'patient care', 'telemedicine',
];

const FINANCIAL_DOMAINS = [
  'financial', 'banking', 'investment', 'insurance', 'fintech',
  'trading', 'wealth management', 'accounting',
];

/**
 * Analyze content for compliance requirements
 */
export async function detectCompliance(
  context: ExtractionContext,
  claims: Claim[]
): Promise<ComplianceMetadata> {
  const allText = [
    ...context.messages.map((m) => m.content),
    ...claims.map((c) => c.text),
  ].join(' ');

  const frameworks: string[] = [];
  
  // Detect PHI (HIPAA)
  const hipaaResult = detectHIPAA(allText, context.primaryDomain, claims);
  if (hipaaResult.phi_present || isHealthcareDomain(context.primaryDomain)) {
    frameworks.push('hipaa');
  }

  // Detect SOC2 relevance
  const soc2Result = detectSOC2(allText);
  if (soc2Result.controls_referenced.length > 0) {
    frameworks.push('soc2');
  }

  // Detect GDPR relevance
  const gdprResult = detectGDPR(allText, claims);
  if (gdprResult.pii_present) {
    frameworks.push('gdpr');
  }

  return {
    frameworks_applicable: frameworks,
    hipaa: hipaaResult,
    soc2: soc2Result,
    gdpr: gdprResult,
    audit_entries: [
      {
        timestamp: new Date().toISOString(),
        action: 'created',
        actor_id: 'system',
        actor_type: 'system',
        details: `Compliance detection completed. Frameworks: ${frameworks.join(', ') || 'none'}`,
      },
    ],
  };
}

/**
 * Detect HIPAA-relevant content
 */
function detectHIPAA(
  text: string,
  domain?: string,
  claims?: Claim[]
): HIPAACompliance {
  const categories: string[] = [];
  let phiPresent = false;

  // Check for PHI patterns
  for (const pattern of PHI_PATTERNS) {
    if (pattern.test(text)) {
      phiPresent = true;
      // Categorize the type of PHI
      if (pattern.source.includes('SSN') || pattern.source.includes('\\d{3}-\\d{2}')) {
        categories.push('identifiers');
      } else if (pattern.source.includes('diagnosis') || pattern.source.includes('treatment')) {
        categories.push('medical_records');
      } else if (pattern.source.includes('medication') || pattern.source.includes('prescription')) {
        categories.push('prescriptions');
      } else if (pattern.source.includes('lab') || pattern.source.includes('blood')) {
        categories.push('lab_results');
      }
    }
  }

  // Check claims for PHI flags
  if (claims) {
    const phiClaims = claims.filter((c) => c.contains_phi);
    if (phiClaims.length > 0) {
      phiPresent = true;
      categories.push('ai_detected_phi');
    }
  }

  // Check if domain suggests healthcare
  if (isHealthcareDomain(domain)) {
    categories.push('healthcare_domain');
  }

  return {
    phi_present: phiPresent,
    phi_categories: [...new Set(categories)],
    minimum_necessary_applied: false, // Would require additional processing
    access_logged: true,
  };
}

/**
 * Detect SOC2-relevant controls
 */
function detectSOC2(text: string): SOC2Compliance {
  const controlsReferenced: string[] = [];
  const lowerText = text.toLowerCase();

  for (const [control, keywords] of Object.entries(SOC2_CONTROL_KEYWORDS)) {
    const hasKeyword = keywords.some((kw) => lowerText.includes(kw.toLowerCase()));
    if (hasKeyword) {
      controlsReferenced.push(control);
    }
  }

  return {
    controls_referenced: controlsReferenced,
    evidence_chain_complete: true, // Artifacts provide evidence chain by design
    change_management_documented: controlsReferenced.includes('CC7.1'),
  };
}

/**
 * Detect GDPR-relevant content
 */
function detectGDPR(text: string, claims?: Claim[]): GDPRCompliance {
  let piiPresent = false;
  const lowerText = text.toLowerCase();

  // Check for PII patterns
  for (const pattern of PII_PATTERNS) {
    if (pattern.test(text)) {
      piiPresent = true;
      break;
    }
  }

  // Check claims for PII flags
  if (claims) {
    const piiClaims = claims.filter((c) => c.contains_pii);
    if (piiClaims.length > 0) {
      piiPresent = true;
    }
  }

  // Check for GDPR keywords
  const hasGdprContext = GDPR_KEYWORDS.some((kw) =>
    lowerText.includes(kw.toLowerCase())
  );

  // Determine lawful basis (simplified)
  let lawfulBasis = 'not_applicable';
  if (piiPresent || hasGdprContext) {
    if (lowerText.includes('consent')) {
      lawfulBasis = 'consent';
    } else if (lowerText.includes('legitimate interest')) {
      lawfulBasis = 'legitimate_interest';
    } else if (lowerText.includes('contract')) {
      lawfulBasis = 'contract';
    } else {
      lawfulBasis = 'undetermined';
    }
  }

  return {
    pii_present: piiPresent,
    lawful_basis: lawfulBasis,
    data_subject_rights_applicable: piiPresent || hasGdprContext,
  };
}

/**
 * Check if domain is healthcare-related
 */
function isHealthcareDomain(domain?: string): boolean {
  if (!domain) return false;
  const lowerDomain = domain.toLowerCase();
  return HEALTHCARE_DOMAINS.some((hd) => lowerDomain.includes(hd));
}

/**
 * Check if domain is financial
 */
export function isFinancialDomain(domain?: string): boolean {
  if (!domain) return false;
  const lowerDomain = domain.toLowerCase();
  return FINANCIAL_DOMAINS.some((fd) => lowerDomain.includes(fd));
}

/**
 * Redact PHI from text for export
 */
export function redactPHI(text: string): string {
  let redacted = text;

  for (const pattern of PHI_PATTERNS) {
    redacted = redacted.replace(pattern, '[REDACTED-PHI]');
  }

  return redacted;
}

/**
 * Redact PII from text for export
 */
export function redactPII(text: string): string {
  let redacted = text;

  for (const pattern of PII_PATTERNS) {
    redacted = redacted.replace(pattern, '[REDACTED-PII]');
  }

  return redacted;
}

/**
 * Get compliance summary for display
 */
export function getComplianceSummary(metadata: ComplianceMetadata): string {
  const parts: string[] = [];

  if (metadata.hipaa?.phi_present) {
    parts.push(`HIPAA: PHI detected (${metadata.hipaa.phi_categories.join(', ')})`);
  }

  if (metadata.soc2?.controls_referenced.length) {
    parts.push(`SOC2: ${metadata.soc2.controls_referenced.length} controls referenced`);
  }

  if (metadata.gdpr?.pii_present) {
    parts.push(`GDPR: PII present (basis: ${metadata.gdpr.lawful_basis})`);
  }

  return parts.length > 0 ? parts.join('; ') : 'No compliance frameworks detected';
}
