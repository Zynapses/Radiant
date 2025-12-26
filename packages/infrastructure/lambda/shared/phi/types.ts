/**
 * PHI (Protected Health Information) types for HIPAA compliance
 */

export interface PHIConfig {
  enabled: boolean;
  mode: 'sanitize' | 'block' | 'warn';
  patterns: PHIPatternConfig;
  redactionText: string;
  logDetections: boolean;
}

export interface PHIPatternConfig {
  ssn: boolean;
  mrn: boolean;
  email: boolean;
  phone: boolean;
  dob: boolean;
  address: boolean;
  names: boolean;
  custom: CustomPattern[];
}

export interface CustomPattern {
  name: string;
  pattern: string;
  flags?: string;
  redactionText?: string;
}

export interface PHIDetection {
  type: string;
  value: string;
  start: number;
  end: number;
  redactedValue: string;
}

export interface SanitizationResult {
  sanitizedText: string;
  detections: PHIDetection[];
  containsPHI: boolean;
  originalLength: number;
  sanitizedLength: number;
}

export interface PHIToken {
  id: string;
  originalValue: string;
  redactedValue: string;
  type: string;
  createdAt: string;
  expiresAt: string;
}

export const DEFAULT_PHI_CONFIG: PHIConfig = {
  enabled: true,
  mode: 'sanitize',
  patterns: {
    ssn: true,
    mrn: true,
    email: true,
    phone: true,
    dob: true,
    address: false,
    names: false,
    custom: [],
  },
  redactionText: '[REDACTED]',
  logDetections: true,
};
