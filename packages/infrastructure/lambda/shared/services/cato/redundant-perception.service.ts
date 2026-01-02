/**
 * RADIANT Genesis Cato Redundant Perception Service
 * Multiple detection methods for PHI/PII to ensure no false negatives
 *
 * Uses ensemble of detection methods for critical data types
 */

import { PerceptionResult } from '@radiant/shared';

// PHI detection patterns (HIPAA identifiers)
const PHI_PATTERNS = {
  // Medical Record Numbers
  MRN: /\b(MRN|medical\s*record\s*#?|patient\s*id)\s*[:\s]?\s*[\w-]+/gi,
  // Social Security Numbers
  SSN: /\b\d{3}[-\s]?\d{2}[-\s]?\d{4}\b/g,
  // Dates of birth in various formats
  DOB: /\b(DOB|date\s*of\s*birth|born\s*on?)\s*[:\s]?\s*\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4}/gi,
  // Health plan numbers
  HEALTH_PLAN: /\b(health\s*plan|insurance|member)\s*(id|number|#)\s*[:\s]?\s*[\w-]+/gi,
  // Account numbers
  ACCOUNT: /\b(account|acct)\s*(number|#|no\.?)\s*[:\s]?\s*[\w-]+/gi,
  // License numbers
  LICENSE: /\b(license|certification)\s*(number|#|no\.?)\s*[:\s]?\s*[\w-]+/gi,
  // Device identifiers
  DEVICE_ID: /\b(device|serial)\s*(id|number|#)\s*[:\s]?\s*[\w-]+/gi,
  // IP addresses
  IP_ADDRESS: /\b\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}\b/g,
  // URLs with potential PHI
  URL_WITH_PATIENT: /https?:\/\/[^\s]*patient[^\s]*/gi,
  // Biometric identifiers mentioned
  BIOMETRIC: /\b(fingerprint|retina|voice\s*print|dna|genetic)/gi,
  // Full face photos mentioned
  PHOTO: /\b(photo|photograph|image|picture)\s*(of|showing)?\s*(patient|face)/gi,
};

// PII detection patterns
const PII_PATTERNS = {
  // Email addresses
  EMAIL: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g,
  // Phone numbers (various formats)
  PHONE: /\b(\+?1?[-.\s]?)?\(?[0-9]{3}\)?[-.\s]?[0-9]{3}[-.\s]?[0-9]{4}\b/g,
  // Credit card numbers
  CREDIT_CARD: /\b(?:4[0-9]{12}(?:[0-9]{3})?|5[1-5][0-9]{14}|3[47][0-9]{13}|6(?:011|5[0-9]{2})[0-9]{12})\b/g,
  // Addresses
  ADDRESS: /\b\d{1,5}\s+[\w\s]+(?:street|st|avenue|ave|road|rd|boulevard|blvd|lane|ln|drive|dr|court|ct|way|circle|cir)\.?\s*(?:,?\s*(?:apt|suite|unit|#)\s*[\w-]+)?\b/gi,
  // Names (after common prefixes)
  NAME_PREFIX: /\b(Mr\.|Mrs\.|Ms\.|Dr\.|Prof\.)\s+[A-Z][a-z]+\s+[A-Z][a-z]+/g,
  // Passport numbers
  PASSPORT: /\b[A-Z]{1,2}[0-9]{6,9}\b/g,
  // Bank account patterns
  BANK_ACCOUNT: /\b(routing|account)\s*(number|#)?\s*[:\s]?\s*\d{8,17}\b/gi,
};

export class RedundantPerceptionService {
  /**
   * Detect PHI in text using multiple methods
   */
  async detectPHI(text: string): Promise<{
    detected: boolean;
    confidence: number;
    entities: string[];
    methods: string[];
  }> {
    const entities: string[] = [];
    const methods: string[] = [];

    // Method 1: Regex pattern matching
    for (const [name, pattern] of Object.entries(PHI_PATTERNS)) {
      const matches = text.match(pattern);
      if (matches && matches.length > 0) {
        entities.push(`${name}: ${matches.length} match(es)`);
        methods.push('regex');
      }
    }

    // Method 2: Keyword detection
    const phiKeywords = [
      'diagnosis',
      'treatment',
      'medication',
      'prescription',
      'symptoms',
      'medical history',
      'lab results',
      'blood type',
      'allergies',
      'immunization',
    ];

    for (const keyword of phiKeywords) {
      if (text.toLowerCase().includes(keyword)) {
        entities.push(`keyword: ${keyword}`);
        if (!methods.includes('keyword')) {
          methods.push('keyword');
        }
      }
    }

    // Method 3: Context analysis
    const medicalContext = this.analyzeMedicalContext(text);
    if (medicalContext.isMedical) {
      methods.push('context');
      entities.push(`medical_context: ${medicalContext.reason}`);
    }

    // Calculate confidence based on number of detections and methods
    const detected = entities.length > 0;
    const confidence = detected
      ? Math.min(1.0, 0.5 + methods.length * 0.15 + entities.length * 0.05)
      : 0;

    return {
      detected,
      confidence,
      entities,
      methods,
    };
  }

  /**
   * Detect PII in text using multiple methods
   */
  async detectPII(text: string): Promise<{
    detected: boolean;
    confidence: number;
    types: string[];
    methods: string[];
  }> {
    const types: string[] = [];
    const methods: string[] = [];

    // Method 1: Regex pattern matching
    for (const [name, pattern] of Object.entries(PII_PATTERNS)) {
      const matches = text.match(pattern);
      if (matches && matches.length > 0) {
        types.push(name);
        methods.push('regex');
      }
    }

    // Method 2: Named entity recognition keywords
    const piiIndicators = [
      'my name is',
      'i live at',
      'my address',
      'my phone',
      'my email',
      'social security',
      'date of birth',
      'credit card',
      'bank account',
    ];

    for (const indicator of piiIndicators) {
      if (text.toLowerCase().includes(indicator)) {
        types.push(`indicator: ${indicator}`);
        if (!methods.includes('keyword')) {
          methods.push('keyword');
        }
      }
    }

    // Remove duplicates
    const uniqueTypes = [...new Set(types)];
    const uniqueMethods = [...new Set(methods)];

    // Calculate confidence
    const detected = uniqueTypes.length > 0;
    const confidence = detected
      ? Math.min(1.0, 0.5 + uniqueMethods.length * 0.15 + uniqueTypes.length * 0.05)
      : 0;

    return {
      detected,
      confidence,
      types: uniqueTypes,
      methods: uniqueMethods,
    };
  }

  /**
   * Analyze text for medical context
   */
  private analyzeMedicalContext(text: string): {
    isMedical: boolean;
    reason: string;
  } {
    const medicalTerms = [
      'patient',
      'doctor',
      'hospital',
      'clinic',
      'physician',
      'nurse',
      'medication',
      'prescription',
      'dosage',
      'surgery',
      'diagnosis',
      'prognosis',
      'symptom',
      'treatment',
      'therapy',
      'condition',
      'disease',
      'disorder',
      'syndrome',
    ];

    const lowerText = text.toLowerCase();
    const foundTerms = medicalTerms.filter((term) => lowerText.includes(term));

    if (foundTerms.length >= 2) {
      return {
        isMedical: true,
        reason: `Multiple medical terms: ${foundTerms.slice(0, 3).join(', ')}`,
      };
    }

    return { isMedical: false, reason: '' };
  }

  /**
   * Combined perception check
   */
  async checkAll(text: string): Promise<PerceptionResult> {
    const [phiResult, piiResult] = await Promise.all([
      this.detectPHI(text),
      this.detectPII(text),
    ]);

    return {
      phi: {
        detected: phiResult.detected,
        confidence: phiResult.confidence,
        entities: phiResult.entities,
      },
      pii: {
        detected: piiResult.detected,
        confidence: piiResult.confidence,
        types: piiResult.types,
      },
    };
  }
}

export const redundantPerceptionService = new RedundantPerceptionService();
