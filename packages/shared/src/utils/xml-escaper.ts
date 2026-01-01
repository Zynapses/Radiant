/**
 * RADIANT v6.0.4 - XML Escaper
 * Prevents Compliance Sandwich injection attacks
 * 
 * All user-provided content MUST be escaped before injection
 * into the Compliance Sandwich context to prevent:
 * - XML tag injection
 * - Escape sequence attacks
 * - Control character injection
 * - Prompt leakage attempts
 */

import { PROTECTED_XML_TAGS, type ProtectedXmlTag } from '../types/compliance-sandwich.types';

// =============================================================================
// Escape Map
// =============================================================================

/**
 * XML character escape mapping
 */
const ESCAPE_MAP: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&apos;',
};

/**
 * Reverse escape map for unescaping
 */
const UNESCAPE_MAP: Record<string, string> = {
  '&amp;': '&',
  '&lt;': '<',
  '&gt;': '>',
  '&quot;': '"',
  '&apos;': "'",
};

// =============================================================================
// XMLEscaper Class
// =============================================================================

/**
 * XML Escaper utility class
 * Provides secure escaping for Compliance Sandwich content
 */
export class XMLEscaper {
  /**
   * Basic XML escape - escapes special characters
   * @param input - Raw input string
   * @returns Escaped string safe for XML content
   */
  static escape(input: string): string {
    if (!input) return '';
    return input.replace(/[&<>"']/g, (char) => ESCAPE_MAP[char] || char);
  }

  /**
   * Unescape XML entities back to characters
   * @param input - Escaped string
   * @returns Original string with entities decoded
   */
  static unescape(input: string): string {
    if (!input) return '';
    return input.replace(/&(amp|lt|gt|quot|apos);/g, (entity) => UNESCAPE_MAP[entity] || entity);
  }

  /**
   * Escape for context injection - escapes and marks protected tags
   * This is the PRIMARY method for escaping user content
   * @param input - User-provided content
   * @returns Safely escaped content for Compliance Sandwich
   */
  static escapeForContext(input: string): string {
    if (!input) return '';
    
    // First, escape all XML special characters
    let escaped = this.escape(input);
    
    // Then, mark any attempts to use protected tags
    for (const tag of PROTECTED_XML_TAGS) {
      // Match escaped opening tags: &lt;tag or &lt;/tag
      const openPattern = new RegExp(`&lt;(\\/?)(${tag})`, 'gi');
      escaped = escaped.replace(openPattern, '&lt;ESCAPED_$1$2');
    }
    
    return escaped;
  }

  /**
   * Check if input contains injection attempts
   * @param input - Raw input to check
   * @returns True if injection attempt detected
   */
  static containsInjectionAttempt(input: string): boolean {
    if (!input) return false;
    
    const lower = input.toLowerCase();
    
    // Check for direct protected tag usage
    for (const tag of PROTECTED_XML_TAGS) {
      if (lower.includes(`</${tag}`) || lower.includes(`<${tag}`)) {
        return true;
      }
    }
    
    // Check for escape sequence attempts
    if (this.containsEscapeSequenceAttempt(input)) {
      return true;
    }
    
    // Check for control characters
    if (this.containsControlCharacters(input)) {
      return true;
    }
    
    return false;
  }

  /**
   * Detect escape sequence injection attempts
   * @param input - Raw input to check
   * @returns True if escape sequence attack detected
   */
  static containsEscapeSequenceAttempt(input: string): boolean {
    // Check for various escape sequence patterns
    const escapePatterns = [
      /\\x[0-9a-fA-F]{2}/,      // Hex escape
      /\\u[0-9a-fA-F]{4}/,      // Unicode escape
      /\\[0-7]{1,3}/,           // Octal escape
      /\x00-\x08|\x0B|\x0C|\x0E-\x1F/, // Control chars
    ];
    
    return escapePatterns.some(pattern => pattern.test(input));
  }

  /**
   * Check for dangerous control characters
   * @param input - Raw input to check
   * @returns True if control characters found
   */
  static containsControlCharacters(input: string): boolean {
    // ASCII control characters (except tab, newline, carriage return)
    // eslint-disable-next-line no-control-regex
    return /[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/.test(input);
  }

  /**
   * Sanitize input by removing dangerous content
   * @param input - Raw input to sanitize
   * @returns Sanitized input with dangerous content removed
   */
  static sanitize(input: string): string {
    if (!input) return '';
    
    let sanitized = input;
    
    // Remove control characters (except tab, newline, carriage return)
    // eslint-disable-next-line no-control-regex
    sanitized = sanitized.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');
    
    // Remove null bytes
    sanitized = sanitized.replace(/\0/g, '');
    
    return sanitized;
  }

  /**
   * Full security processing: sanitize + escape
   * @param input - Raw user input
   * @returns Fully secured content for Compliance Sandwich
   */
  static secureForContext(input: string): {
    secured: string;
    sanitized: boolean;
    escaped: boolean;
    injectionAttemptDetected: boolean;
  } {
    const injectionAttemptDetected = this.containsInjectionAttempt(input);
    const sanitized = this.sanitize(input);
    const wasSanitized = sanitized !== input;
    const escaped = this.escapeForContext(sanitized);
    const wasEscaped = escaped !== sanitized;
    
    return {
      secured: escaped,
      sanitized: wasSanitized,
      escaped: wasEscaped,
      injectionAttemptDetected,
    };
  }

  /**
   * Validate that content is safe (already escaped)
   * @param content - Content to validate
   * @returns True if content appears to be safely escaped
   */
  static isEscaped(content: string): boolean {
    // Check if content has unescaped special characters
    return !/<|>|&(?!(amp|lt|gt|quot|apos);)/.test(content);
  }

  /**
   * Get list of protected tags
   * @returns Array of protected tag names
   */
  static getProtectedTags(): readonly ProtectedXmlTag[] {
    return PROTECTED_XML_TAGS;
  }
}

// =============================================================================
// Standalone Functions (for convenience)
// =============================================================================

/**
 * Escape XML special characters
 */
export function escapeXml(input: string): string {
  return XMLEscaper.escape(input);
}

/**
 * Escape for Compliance Sandwich context
 */
export function escapeForContext(input: string): string {
  return XMLEscaper.escapeForContext(input);
}

/**
 * Check for injection attempts
 */
export function containsInjectionAttempt(input: string): boolean {
  return XMLEscaper.containsInjectionAttempt(input);
}

/**
 * Sanitize dangerous content for XML context
 */
export function sanitizeXmlInput(input: string): string {
  return XMLEscaper.sanitize(input);
}

/**
 * Full security processing
 */
export function secureForContext(input: string): {
  secured: string;
  sanitized: boolean;
  escaped: boolean;
  injectionAttemptDetected: boolean;
} {
  return XMLEscaper.secureForContext(input);
}
