/**
 * PHI detection patterns
 * Based on HIPAA Safe Harbor de-identification standard
 */

export interface PatternDefinition {
  name: string;
  pattern: RegExp;
  description: string;
  examples: string[];
}

export const PHI_PATTERNS: Record<string, PatternDefinition> = {
  ssn: {
    name: 'Social Security Number',
    pattern: /\b\d{3}[-.\s]?\d{2}[-.\s]?\d{4}\b/g,
    description: 'US Social Security Number in various formats',
    examples: ['123-45-6789', '123 45 6789', '123.45.6789'],
  },
  
  mrn: {
    name: 'Medical Record Number',
    pattern: /\b(?:MRN|Medical Record|Patient ID|Chart)[:\s#]*[A-Z0-9]{6,12}\b/gi,
    description: 'Medical record numbers with common prefixes',
    examples: ['MRN: 123456', 'Patient ID: ABC123456'],
  },
  
  email: {
    name: 'Email Address',
    pattern: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g,
    description: 'Email addresses',
    examples: ['john.doe@example.com'],
  },
  
  phone: {
    name: 'Phone Number',
    pattern: /\b(?:\+?1[-.\s]?)?(?:\(?[2-9]\d{2}\)?[-.\s]?)?\d{3}[-.\s]?\d{4}\b/g,
    description: 'US phone numbers in various formats',
    examples: ['(555) 123-4567', '+1 555-123-4567', '555.123.4567'],
  },
  
  dob: {
    name: 'Date of Birth',
    pattern: /\b(?:DOB|Date of Birth|Birth Date|Born)[:\s]*(?:\d{1,2}[-/]\d{1,2}[-/]\d{2,4}|\d{4}[-/]\d{2}[-/]\d{2}|\w+\s+\d{1,2},?\s+\d{4})\b/gi,
    description: 'Dates of birth with common prefixes',
    examples: ['DOB: 01/15/1980', 'Born: January 15, 1980'],
  },
  
  date: {
    name: 'Date',
    pattern: /\b(?:0?[1-9]|1[0-2])[-/](?:0?[1-9]|[12]\d|3[01])[-/](?:19|20)\d{2}\b/g,
    description: 'Dates in MM/DD/YYYY format',
    examples: ['01/15/1980', '12-25-2020'],
  },
  
  zip: {
    name: 'ZIP Code',
    pattern: /\b\d{5}(?:[-\s]\d{4})?\b/g,
    description: 'US ZIP codes (5 or 9 digit)',
    examples: ['12345', '12345-6789'],
  },
  
  ipAddress: {
    name: 'IP Address',
    pattern: /\b(?:(?:25[0-5]|2[0-4]\d|[01]?\d\d?)\.){3}(?:25[0-5]|2[0-4]\d|[01]?\d\d?)\b/g,
    description: 'IPv4 addresses',
    examples: ['192.168.1.1', '10.0.0.1'],
  },
  
  creditCard: {
    name: 'Credit Card Number',
    pattern: /\b(?:\d{4}[-\s]?){3}\d{4}\b/g,
    description: 'Credit card numbers',
    examples: ['1234-5678-9012-3456'],
  },
  
  driversLicense: {
    name: 'Driver\'s License',
    pattern: /\b(?:DL|Driver'?s?\s*License|License)[:\s#]*[A-Z0-9]{5,15}\b/gi,
    description: 'Driver\'s license numbers',
    examples: ['DL: ABC123456'],
  },
  
  passport: {
    name: 'Passport Number',
    pattern: /\b(?:Passport)[:\s#]*[A-Z0-9]{6,12}\b/gi,
    description: 'Passport numbers',
    examples: ['Passport: 123456789'],
  },
  
  npi: {
    name: 'NPI Number',
    pattern: /\b(?:NPI)[:\s#]*\d{10}\b/gi,
    description: 'National Provider Identifier',
    examples: ['NPI: 1234567890'],
  },
  
  dea: {
    name: 'DEA Number',
    pattern: /\b(?:DEA)[:\s#]*[A-Z]{2}\d{7}\b/gi,
    description: 'DEA registration number',
    examples: ['DEA: AB1234567'],
  },
};

/**
 * Get all pattern names
 */
export function getPatternNames(): string[] {
  return Object.keys(PHI_PATTERNS);
}

/**
 * Get a specific pattern
 */
export function getPattern(name: string): PatternDefinition | undefined {
  return PHI_PATTERNS[name];
}

/**
 * Get patterns for HIPAA Safe Harbor identifiers
 */
export function getHIPAASafeHarborPatterns(): PatternDefinition[] {
  const safeHarborTypes = ['ssn', 'mrn', 'email', 'phone', 'dob', 'zip', 'ipAddress'];
  return safeHarborTypes
    .map(type => PHI_PATTERNS[type])
    .filter((p): p is PatternDefinition => p !== undefined);
}
