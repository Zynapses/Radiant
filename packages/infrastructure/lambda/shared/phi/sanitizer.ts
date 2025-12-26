/**
 * PHI Sanitizer for HIPAA compliance
 */

import { v4 as uuidv4 } from 'uuid';
import { logger } from '../logger';
import { PHI_PATTERNS, getHIPAASafeHarborPatterns } from './patterns';
import type {
  PHIConfig,
  PHIDetection,
  SanitizationResult,
  PHIToken,
  CustomPattern,
} from './types';
import { DEFAULT_PHI_CONFIG } from './types';

export class PHISanitizer {
  private config: PHIConfig;
  private tokenStore: Map<string, PHIToken>;

  constructor(config: Partial<PHIConfig> = {}) {
    this.config = { ...DEFAULT_PHI_CONFIG, ...config };
    this.tokenStore = new Map();
  }

  /**
   * Sanitize text by detecting and redacting PHI
   */
  sanitize(text: string): SanitizationResult {
    if (!this.config.enabled) {
      return {
        sanitizedText: text,
        detections: [],
        containsPHI: false,
        originalLength: text.length,
        sanitizedLength: text.length,
      };
    }

    const detections: PHIDetection[] = [];
    let sanitizedText = text;
    let offset = 0;

    const patterns = this.getActivePatterns();

    for (const [name, pattern] of patterns) {
      const regex = new RegExp(pattern.source, pattern.flags);
      let match: RegExpExecArray | null;

      while ((match = regex.exec(text)) !== null) {
        const redactedValue = this.getRedactedValue(name, match[0]);
        
        detections.push({
          type: name,
          value: match[0],
          start: match.index,
          end: match.index + match[0].length,
          redactedValue,
        });
      }
    }

    detections.sort((a, b) => b.start - a.start);

    for (const detection of detections) {
      const adjustedStart = detection.start + offset;
      const adjustedEnd = detection.end + offset;
      
      sanitizedText =
        sanitizedText.slice(0, adjustedStart) +
        detection.redactedValue +
        sanitizedText.slice(adjustedEnd);
      
      offset += detection.redactedValue.length - detection.value.length;
    }

    if (this.config.logDetections && detections.length > 0) {
      logger.info('PHI detected and sanitized', {
        detectionCount: detections.length,
        types: [...new Set(detections.map(d => d.type))],
      });
    }

    return {
      sanitizedText,
      detections,
      containsPHI: detections.length > 0,
      originalLength: text.length,
      sanitizedLength: sanitizedText.length,
    };
  }

  /**
   * Check if text contains PHI without sanitizing
   */
  containsPHI(text: string): boolean {
    if (!this.config.enabled) {
      return false;
    }

    const patterns = this.getActivePatterns();

    for (const [, pattern] of patterns) {
      if (pattern.test(text)) {
        return true;
      }
    }

    return false;
  }

  /**
   * Create a reversible token for PHI
   */
  tokenize(value: string, type: string): string {
    const tokenId = `PHI_${uuidv4().replace(/-/g, '').substring(0, 16)}`;
    
    const token: PHIToken = {
      id: tokenId,
      originalValue: value,
      redactedValue: this.getRedactedValue(type, value),
      type,
      createdAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
    };

    this.tokenStore.set(tokenId, token);
    
    return tokenId;
  }

  /**
   * Detokenize a PHI token back to original value
   */
  detokenize(tokenId: string): string | null {
    const token = this.tokenStore.get(tokenId);
    
    if (!token) {
      return null;
    }

    if (new Date(token.expiresAt) < new Date()) {
      this.tokenStore.delete(tokenId);
      return null;
    }

    return token.originalValue;
  }

  /**
   * Clear expired tokens
   */
  clearExpiredTokens(): number {
    const now = new Date();
    let cleared = 0;

    for (const [id, token] of this.tokenStore) {
      if (new Date(token.expiresAt) < now) {
        this.tokenStore.delete(id);
        cleared++;
      }
    }

    return cleared;
  }

  /**
   * Get active patterns based on configuration
   */
  private getActivePatterns(): Map<string, RegExp> {
    const patterns = new Map<string, RegExp>();

    if (this.config.patterns.ssn) {
      patterns.set('ssn', PHI_PATTERNS.ssn.pattern);
    }
    if (this.config.patterns.mrn) {
      patterns.set('mrn', PHI_PATTERNS.mrn.pattern);
    }
    if (this.config.patterns.email) {
      patterns.set('email', PHI_PATTERNS.email.pattern);
    }
    if (this.config.patterns.phone) {
      patterns.set('phone', PHI_PATTERNS.phone.pattern);
    }
    if (this.config.patterns.dob) {
      patterns.set('dob', PHI_PATTERNS.dob.pattern);
    }

    for (const custom of this.config.patterns.custom) {
      try {
        patterns.set(custom.name, new RegExp(custom.pattern, custom.flags || 'g'));
      } catch (error) {
        logger.warn('Invalid custom PHI pattern', { name: custom.name, error });
      }
    }

    return patterns;
  }

  /**
   * Get redacted value for a detection
   */
  private getRedactedValue(type: string, originalValue: string): string {
    const customPattern = this.config.patterns.custom.find(p => p.name === type);
    
    if (customPattern?.redactionText) {
      return customPattern.redactionText;
    }

    const typeRedactions: Record<string, string> = {
      ssn: '[SSN REDACTED]',
      mrn: '[MRN REDACTED]',
      email: '[EMAIL REDACTED]',
      phone: '[PHONE REDACTED]',
      dob: '[DOB REDACTED]',
      zip: '[ZIP REDACTED]',
      ipAddress: '[IP REDACTED]',
      creditCard: '[CC REDACTED]',
    };

    return typeRedactions[type] || this.config.redactionText;
  }

  /**
   * Update configuration
   */
  updateConfig(config: Partial<PHIConfig>): void {
    this.config = { ...this.config, ...config };
  }

  /**
   * Get current configuration
   */
  getConfig(): PHIConfig {
    return { ...this.config };
  }
}

let defaultSanitizer: PHISanitizer | null = null;

export function getSanitizer(config?: Partial<PHIConfig>): PHISanitizer {
  if (!defaultSanitizer || config) {
    defaultSanitizer = new PHISanitizer(config);
  }
  return defaultSanitizer;
}

export function sanitizePHI(text: string): SanitizationResult {
  return getSanitizer().sanitize(text);
}

export function containsPHI(text: string): boolean {
  return getSanitizer().containsPHI(text);
}
