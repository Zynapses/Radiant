// RADIANT v4.18.0 - Prompt Injection Detection Service
// OWASP LLM01 - Comprehensive injection attack detection
// ============================================================================

import { executeStatement, stringParam, longParam, doubleParam, boolParam } from '../db/client';
import { enhancedLogger as logger } from '../logging/enhanced-logger';
import crypto from 'crypto';

// ============================================================================
// Types
// ============================================================================

export interface InjectionPattern {
  id: string;
  patternName: string;
  patternType: 'direct' | 'indirect' | 'context_ignoring' | 'role_escape' | 'encoding';
  regexPattern?: string;
  keywordPatterns?: string[];
  severity: number;
  description?: string;
  source: string;
}

export interface InjectionDetectionResult {
  injectionDetected: boolean;
  confidenceScore: number;
  injectionType?: string;
  matchedPatterns: string[];
  riskLevel: 'none' | 'low' | 'medium' | 'high' | 'critical';
  recommendations: string[];
  latencyMs: number;
}

export interface InjectionConfig {
  enabled: boolean;
  strictMode: boolean;
  blockOnDetection: boolean;
  semanticDetectionEnabled: boolean;
  confidenceThreshold: number;
  enabledPatternTypes: string[];
}

// Built-in patterns (loaded from database but have fallbacks)
const BUILTIN_PATTERNS: Omit<InjectionPattern, 'id'>[] = [
  // Direct Injection Patterns
  {
    patternName: 'Ignore Instructions',
    patternType: 'direct',
    regexPattern: '(?i)\\b(ignore|disregard|forget)\\s+(all\\s+)?(previous|prior|above)\\s+(instructions?|rules?|guidelines?)',
    severity: 9,
    description: 'Direct instruction to ignore system prompt',
    source: 'owasp',
  },
  {
    patternName: 'System Prompt Override',
    patternType: 'direct',
    regexPattern: '(?i)(new\\s+)?system\\s+(prompt|instruction|message):\\s*',
    severity: 9,
    description: 'Attempt to inject new system prompt',
    source: 'owasp',
  },
  {
    patternName: 'Instruction Termination',
    patternType: 'direct',
    regexPattern: '(?i)(end\\s+of\\s+instructions?|</?(system|instructions?|prompt)>|\\[/?INST\\])',
    severity: 8,
    description: 'Attempt to terminate instruction block',
    source: 'owasp',
  },
  
  // Role Escape Patterns
  {
    patternName: 'Role Hijacking',
    patternType: 'role_escape',
    regexPattern: '(?i)\\b(you\\s+are\\s+now|act\\s+as|pretend\\s+(to\\s+be|you\\s+are)|roleplay\\s+as|impersonate)\\b',
    severity: 6,
    description: 'Attempt to change AI role/persona',
    source: 'owasp',
  },
  {
    patternName: 'Persona Override',
    patternType: 'role_escape',
    regexPattern: '(?i)\\b(your\\s+(new\\s+)?name\\s+is|you\\s+will\\s+(now\\s+)?respond\\s+as|from\\s+now\\s+on\\s+you\\s+are)\\b',
    severity: 7,
    description: 'Attempt to override AI persona',
    source: 'research',
  },
  
  // Context Ignoring Patterns
  {
    patternName: 'Developer Mode',
    patternType: 'context_ignoring',
    regexPattern: '(?i)\\b(developer|dev|debug|admin|root|sudo|superuser)\\s*mode\\b',
    severity: 8,
    description: 'Attempt to enable privileged mode',
    source: 'owasp',
  },
  {
    patternName: 'DAN Jailbreak',
    patternType: 'context_ignoring',
    regexPattern: '(?i)\\b(DAN|do\\s+anything\\s+now|jailbreak(ed)?|unlocked\\s+mode|unrestricted\\s+mode)\\b',
    severity: 9,
    description: 'DAN-style jailbreak attempt',
    source: 'research',
  },
  {
    patternName: 'Safety Bypass',
    patternType: 'context_ignoring',
    regexPattern: '(?i)\\b(bypass|disable|remove|ignore)\\s+(safety|filter|restriction|guard|limit)s?\\b',
    severity: 8,
    description: 'Attempt to bypass safety measures',
    source: 'owasp',
  },
  
  // Indirect Injection Patterns
  {
    patternName: 'System Prompt Extract',
    patternType: 'indirect',
    regexPattern: '(?i)\\b(repeat|show|reveal|tell\\s+me|what\\s+(is|are))\\s+(your|the)?\\s*(system|initial|original|full|complete)\\s*(prompt|instructions?|rules?|guidelines?)',
    severity: 8,
    description: 'Attempt to extract system prompt',
    source: 'owasp',
  },
  {
    patternName: 'Hidden Instructions',
    patternType: 'indirect',
    regexPattern: '(?i)(when\\s+you\\s+see\\s+this|if\\s+(you\\s+are\\s+)?reading\\s+this|ai\\s+assistant:\\s*|\\[hidden\\])',
    severity: 6,
    description: 'Indirect injection markers',
    source: 'owasp',
  },
  {
    patternName: 'Context Manipulation',
    patternType: 'indirect',
    regexPattern: '(?i)(previous\\s+conversation|earlier\\s+we\\s+agreed|you\\s+said\\s+before|remember\\s+when\\s+you)',
    severity: 5,
    description: 'False context injection',
    source: 'research',
  },
  
  // Encoding Patterns
  {
    patternName: 'Base64 Payload',
    patternType: 'encoding',
    regexPattern: '[A-Za-z0-9+/]{100,}={0,2}',
    severity: 7,
    description: 'Potential base64-encoded payload',
    source: 'owasp',
  },
  {
    patternName: 'Unicode Smuggling',
    patternType: 'encoding',
    regexPattern: '[\\u200B-\\u200F\\u2028-\\u202F\\uFEFF\\u0000-\\u001F]',
    severity: 6,
    description: 'Invisible unicode characters',
    source: 'owasp',
  },
  {
    patternName: 'Homoglyph Attack',
    patternType: 'encoding',
    regexPattern: '[\\u0400-\\u04FF\\u0370-\\u03FF]',
    severity: 5,
    description: 'Cyrillic/Greek character substitution',
    source: 'research',
  },
];

// ============================================================================
// Prompt Injection Detection Service
// ============================================================================

class PromptInjectionService {
  private patternCache: Map<string, InjectionPattern[]> = new Map();
  private readonly CACHE_TTL_MS = 300000; // 5 minutes
  private lastCacheUpdate = 0;
  
  /**
   * Detect prompt injection attacks
   */
  async detect(
    tenantId: string,
    input: string,
    options?: {
      context?: string;
      strictMode?: boolean;
      enableSemanticCheck?: boolean;
    }
  ): Promise<InjectionDetectionResult> {
    const startTime = Date.now();
    const config = await this.getConfig(tenantId);
    
    if (!config.enabled) {
      return {
        injectionDetected: false,
        confidenceScore: 0,
        matchedPatterns: [],
        riskLevel: 'none',
        recommendations: [],
        latencyMs: Date.now() - startTime,
      };
    }
    
    const patterns = await this.getPatterns(config.enabledPatternTypes);
    const matchedPatterns: string[] = [];
    let maxSeverity = 0;
    let totalScore = 0;
    let matchCount = 0;
    
    // Check each pattern
    for (const pattern of patterns) {
      if (pattern.regexPattern) {
        try {
          const regex = new RegExp(pattern.regexPattern, 'gi');
          if (regex.test(input)) {
            matchedPatterns.push(pattern.patternName);
            maxSeverity = Math.max(maxSeverity, pattern.severity);
            totalScore += pattern.severity;
            matchCount++;
          }
        } catch (e) {
          logger.warn('Invalid regex pattern', { patternName: pattern.patternName });
        }
      }
      
      if (pattern.keywordPatterns) {
        for (const keyword of pattern.keywordPatterns) {
          if (input.toLowerCase().includes(keyword.toLowerCase())) {
            if (!matchedPatterns.includes(pattern.patternName)) {
              matchedPatterns.push(pattern.patternName);
              maxSeverity = Math.max(maxSeverity, pattern.severity);
              totalScore += pattern.severity;
              matchCount++;
            }
            break;
          }
        }
      }
    }
    
    // Check context for indirect injection if provided
    if (options?.context && config.semanticDetectionEnabled) {
      const contextMatches = await this.checkContextInjection(options.context);
      for (const match of contextMatches) {
        if (!matchedPatterns.includes(match)) {
          matchedPatterns.push(`Context: ${match}`);
          maxSeverity = Math.max(maxSeverity, 6);
          totalScore += 6;
          matchCount++;
        }
      }
    }
    
    // Calculate confidence score
    const confidenceScore = matchCount > 0
      ? Math.min((totalScore / matchCount) / 10, 1)
      : 0;
    
    // Determine risk level
    let riskLevel: InjectionDetectionResult['riskLevel'] = 'none';
    if (maxSeverity >= 9) riskLevel = 'critical';
    else if (maxSeverity >= 7) riskLevel = 'high';
    else if (maxSeverity >= 5) riskLevel = 'medium';
    else if (maxSeverity >= 3) riskLevel = 'low';
    
    // Generate recommendations
    const recommendations = this.generateRecommendations(matchedPatterns, riskLevel);
    
    // Determine injection type
    const injectionType = matchedPatterns.length > 0
      ? this.categorizeInjection(matchedPatterns, patterns)
      : undefined;
    
    const result: InjectionDetectionResult = {
      injectionDetected: matchedPatterns.length > 0,
      confidenceScore,
      injectionType,
      matchedPatterns,
      riskLevel,
      recommendations,
      latencyMs: Date.now() - startTime,
    };
    
    // Log detection if found
    if (result.injectionDetected) {
      await this.logDetection(tenantId, input, result);
    }
    
    return result;
  }
  
  /**
   * Sanitize input by removing/neutralizing injection attempts
   */
  async sanitize(
    tenantId: string,
    input: string,
    options?: { preserveReadability?: boolean }
  ): Promise<{ sanitized: string; modifications: string[] }> {
    const modifications: string[] = [];
    let sanitized = input;
    
    // Remove invisible unicode characters
    const invisibleChars = /[\u200B-\u200F\u2028-\u202F\uFEFF\u0000-\u001F]/g;
    if (invisibleChars.test(sanitized)) {
      sanitized = sanitized.replace(invisibleChars, '');
      modifications.push('Removed invisible unicode characters');
    }
    
    // Neutralize instruction override attempts
    const overridePatterns = [
      { pattern: /ignore\s+(all\s+)?(previous|prior|above)\s+instructions?/gi, replacement: '[REDACTED]' },
      { pattern: /system\s+(prompt|instruction|message):/gi, replacement: '[REDACTED]:' },
      { pattern: /<\/?system>/gi, replacement: '' },
      { pattern: /\[\/?(INST|SYS)\]/gi, replacement: '' },
    ];
    
    for (const { pattern, replacement } of overridePatterns) {
      if (pattern.test(sanitized)) {
        sanitized = sanitized.replace(pattern, replacement);
        modifications.push(`Neutralized pattern: ${pattern.source.substring(0, 30)}`);
      }
    }
    
    // Decode and inspect base64 content
    const base64Pattern = /[A-Za-z0-9+/]{100,}={0,2}/g;
    const base64Matches = sanitized.match(base64Pattern);
    if (base64Matches) {
      for (const match of base64Matches) {
        try {
          const decoded = Buffer.from(match, 'base64').toString('utf8');
          // If decoded content contains injection patterns, remove it
          if (/ignore|system|jailbreak|dan mode/i.test(decoded)) {
            sanitized = sanitized.replace(match, '[BASE64_REMOVED]');
            modifications.push('Removed suspicious base64 content');
          }
        } catch {
          // Not valid base64, leave it
        }
      }
    }
    
    return { sanitized, modifications };
  }
  
  /**
   * Get injection detection statistics
   */
  async getStats(
    tenantId: string,
    days: number = 30
  ): Promise<{
    totalChecks: number;
    detectionsCount: number;
    detectionRate: number;
    byType: Record<string, number>;
    byRiskLevel: Record<string, number>;
    topPatterns: Array<{ pattern: string; count: number }>;
  }> {
    const result = await executeStatement(
      `SELECT 
        COUNT(*) as total,
        SUM(CASE WHEN injection_detected THEN 1 ELSE 0 END) as detections,
        injection_type,
        matched_patterns
       FROM prompt_injection_detections
       WHERE tenant_id = $1::uuid AND created_at >= NOW() - INTERVAL '1 day' * $2
       GROUP BY injection_type, matched_patterns`,
      [stringParam('tenantId', tenantId), longParam('days', days)]
    );
    
    let totalChecks = 0;
    let detectionsCount = 0;
    const byType: Record<string, number> = {};
    const patternCounts: Record<string, number> = {};
    
    for (const row of result.rows || []) {
      totalChecks += Number(row.total || 0);
      detectionsCount += Number(row.detections || 0);
      
      const type = String(row.injection_type || 'unknown');
      byType[type] = (byType[type] || 0) + Number(row.detections || 0);
      
      const patterns = row.matched_patterns as string[] || [];
      for (const p of patterns) {
        patternCounts[p] = (patternCounts[p] || 0) + 1;
      }
    }
    
    const topPatterns = Object.entries(patternCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([pattern, count]) => ({ pattern, count }));
    
    return {
      totalChecks,
      detectionsCount,
      detectionRate: totalChecks > 0 ? detectionsCount / totalChecks : 0,
      byType,
      byRiskLevel: {}, // Would need additional query
      topPatterns,
    };
  }
  
  /**
   * Get available patterns
   */
  async getPatterns(enabledTypes?: string[]): Promise<InjectionPattern[]> {
    // Check cache
    const cacheKey = enabledTypes?.join(',') || 'all';
    if (Date.now() - this.lastCacheUpdate < this.CACHE_TTL_MS) {
      const cached = this.patternCache.get(cacheKey);
      if (cached) return cached;
    }
    
    // Query database
    let query = 'SELECT * FROM prompt_injection_patterns WHERE is_active = true';
    const params: ReturnType<typeof stringParam>[] = [];
    
    if (enabledTypes && enabledTypes.length > 0) {
      query += ` AND pattern_type = ANY($1)`;
      params.push(stringParam('types', `{${enabledTypes.join(',')}}`));
    }
    
    const result = await executeStatement(query, params);
    
    let patterns: InjectionPattern[] = [];
    
    if (result.rows?.length) {
      patterns = result.rows.map(row => ({
        id: String(row.id),
        patternName: String(row.pattern_name),
        patternType: row.pattern_type as InjectionPattern['patternType'],
        regexPattern: row.regex_pattern ? String(row.regex_pattern) : undefined,
        keywordPatterns: row.keyword_patterns as string[] | undefined,
        severity: Number(row.severity || 5),
        description: row.description ? String(row.description) : undefined,
        source: String(row.source || 'custom'),
      }));
    } else {
      // Fall back to builtin patterns
      patterns = BUILTIN_PATTERNS.map((p, i) => ({ ...p, id: `builtin_${i}` }));
      if (enabledTypes) {
        patterns = patterns.filter(p => enabledTypes.includes(p.patternType));
      }
    }
    
    // Update cache
    this.patternCache.set(cacheKey, patterns);
    this.lastCacheUpdate = Date.now();
    
    return patterns;
  }
  
  /**
   * Get injection detection config
   */
  async getConfig(tenantId: string): Promise<InjectionConfig> {
    const result = await executeStatement(
      `SELECT injection_config FROM security_protection_config WHERE tenant_id = $1::uuid`,
      [stringParam('tenantId', tenantId)]
    );
    
    const config = result.rows?.[0]?.injection_config as Partial<InjectionConfig> | undefined;
    
    return {
      enabled: config?.enabled ?? true,
      strictMode: config?.strictMode ?? false,
      blockOnDetection: config?.blockOnDetection ?? false,
      semanticDetectionEnabled: config?.semanticDetectionEnabled ?? false,
      confidenceThreshold: config?.confidenceThreshold ?? 0.7,
      enabledPatternTypes: config?.enabledPatternTypes ?? ['direct', 'indirect', 'context_ignoring', 'role_escape', 'encoding'],
    };
  }
  
  // ==========================================================================
  // Private Helpers
  // ==========================================================================
  
  private async checkContextInjection(context: string): Promise<string[]> {
    const matches: string[] = [];
    
    // Check for injection markers in context (external content)
    const contextPatterns = [
      { pattern: /ai\s+assistant:/i, name: 'AI directive in context' },
      { pattern: /\[hidden\s+instruction\]/i, name: 'Hidden instruction marker' },
      { pattern: /ignore\s+above/i, name: 'Ignore directive in context' },
      { pattern: /<\/?system>/i, name: 'System tags in context' },
    ];
    
    for (const { pattern, name } of contextPatterns) {
      if (pattern.test(context)) {
        matches.push(name);
      }
    }
    
    return matches;
  }
  
  private categorizeInjection(
    matchedPatterns: string[],
    allPatterns: InjectionPattern[]
  ): string {
    // Find the most severe matched pattern type
    let maxSeverity = 0;
    let category = 'unknown';
    
    for (const patternName of matchedPatterns) {
      const pattern = allPatterns.find(p => p.patternName === patternName);
      if (pattern && pattern.severity > maxSeverity) {
        maxSeverity = pattern.severity;
        category = pattern.patternType;
      }
    }
    
    return category;
  }
  
  private generateRecommendations(
    matchedPatterns: string[],
    riskLevel: InjectionDetectionResult['riskLevel']
  ): string[] {
    const recommendations: string[] = [];
    
    if (riskLevel === 'critical' || riskLevel === 'high') {
      recommendations.push('Block this request or require manual review');
      recommendations.push('Log this attempt for security analysis');
    }
    
    if (matchedPatterns.some(p => p.includes('DAN') || p.includes('Jailbreak'))) {
      recommendations.push('User may be attempting to bypass safety measures');
    }
    
    if (matchedPatterns.some(p => p.includes('Base64') || p.includes('Unicode'))) {
      recommendations.push('Inspect decoded content for hidden instructions');
    }
    
    if (matchedPatterns.some(p => p.includes('System Prompt'))) {
      recommendations.push('Ensure system prompt is not exposed in responses');
    }
    
    if (riskLevel === 'medium') {
      recommendations.push('Monitor this user for repeated attempts');
    }
    
    return recommendations;
  }
  
  private async logDetection(
    tenantId: string,
    input: string,
    result: InjectionDetectionResult
  ): Promise<void> {
    try {
      const inputHash = crypto.createHash('sha256').update(input).digest('hex');
      
      await executeStatement(
        `INSERT INTO prompt_injection_detections (
          tenant_id, input_hash, injection_detected, confidence_score,
          injection_type, matched_patterns, action_taken, latency_ms
        ) VALUES ($1::uuid, $2, $3, $4, $5, $6, $7, $8)`,
        [
          stringParam('tenantId', tenantId),
          stringParam('inputHash', inputHash),
          boolParam('detected', result.injectionDetected),
          doubleParam('confidence', result.confidenceScore),
          stringParam('type', result.injectionType || ''),
          stringParam('patterns', `{${result.matchedPatterns.map(p => `"${p.replace(/"/g, '\\"')}"`).join(',')}}`),
          stringParam('action', result.riskLevel === 'critical' ? 'blocked' : 'flagged'),
          longParam('latency', result.latencyMs),
        ]
      );
    } catch (error) {
      logger.error('Failed to log injection detection', { error: String(error) });
    }
  }
}

export const promptInjectionService = new PromptInjectionService();
