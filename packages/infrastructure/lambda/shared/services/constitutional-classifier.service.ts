// RADIANT v4.18.0 - Constitutional Classifier Service
// Based on HarmBench, WildJailbreak, and Anthropic Constitutional AI
// ============================================================================

import { executeStatement, stringParam, longParam, doubleParam, boolParam } from '../db/client';
import { modelRouterService, type ChatMessage } from './model-router.service';
import { enhancedLogger as logger } from '../logging/enhanced-logger';
import * as crypto from 'crypto';

// ============================================================================
// Types
// ============================================================================

export interface HarmCategory {
  categoryCode: string;
  categoryName: string;
  description: string;
  severityLevel: number;
  examples: string[];
}

export interface ClassificationResult {
  isHarmful: boolean;
  confidenceScore: number;
  harmCategories: Array<{ category: string; score: number }>;
  attackType?: string;
  actionTaken: 'allowed' | 'blocked' | 'flagged' | 'modified';
  latencyMs: number;
}

export interface JailbreakPattern {
  patternName: string;
  patternType: string;
  patternRegex?: string;
  examplePrompts: string[];
  severity: number;
}

export interface ClassifierConfig {
  enabled: boolean;
  modelType: string;
  confidenceThreshold: number;
  action: 'flag' | 'block' | 'modify';
  categories: string[];
}

// HarmBench-aligned attack type taxonomy
const ATTACK_TYPES = {
  DAN: 'dan', // Do Anything Now
  ROLEPLAY: 'roleplay', // Character roleplay
  ENCODING: 'encoding', // Base64, ROT13, etc.
  HYPOTHETICAL: 'hypothetical', // "Imagine if..."
  TRANSLATION: 'translation', // Language switching
  CONTINUATION: 'continuation', // "Continue this story..."
  GRADUAL: 'gradual', // Crescendo attacks
  INSTRUCTION_OVERRIDE: 'instruction_override', // "Ignore previous instructions"
  CONTEXT_MANIPULATION: 'context_manipulation', // Misleading context
  OBFUSCATION: 'obfuscation', // Character substitution
};

// WildJailbreak-derived pattern signatures
const JAILBREAK_PATTERNS: Array<{ name: string; type: string; regex: RegExp; severity: number }> = [
  { name: 'DAN Mode', type: 'dan', regex: /\b(DAN|do anything now|jailbroken?|unlocked mode)\b/i, severity: 8 },
  { name: 'Ignore Instructions', type: 'instruction_override', regex: /\b(ignore|disregard|forget)\s+(all\s+)?(previous|prior|above)\s+(instructions?|rules?|guidelines?)/i, severity: 9 },
  { name: 'Developer Mode', type: 'roleplay', regex: /\b(developer|dev|debug|admin|root)\s*mode\b/i, severity: 7 },
  { name: 'Hypothetical Framing', type: 'hypothetical', regex: /\b(imagine|pretend|suppose|what if|hypothetically|in a fictional)\b.*\b(you (were|are|could)|scenario)\b/i, severity: 5 },
  { name: 'Base64 Payload', type: 'encoding', regex: /[A-Za-z0-9+/]{40,}={0,2}/, severity: 6 },
  { name: 'Roleplay Request', type: 'roleplay', regex: /\b(act as|pretend to be|you are now|roleplay as|impersonate)\b/i, severity: 4 },
  { name: 'Fictional Story', type: 'continuation', regex: /\b(write a (story|fiction|novel)|continue (this|the) story|creative writing prompt)\b.*\b(illegal|harmful|dangerous|violent)\b/i, severity: 6 },
  { name: 'Translation Attack', type: 'translation', regex: /\b(translate|write in|say in)\s+(latin|pig latin|l33t|leet|base64|binary|morse)/i, severity: 5 },
  { name: 'System Prompt Extract', type: 'instruction_override', regex: /\b(repeat|show|reveal|tell me|what (is|are))\s+(your|the)?\s*(system|initial|original|full)\s*(prompt|instructions?|rules?)/i, severity: 8 },
  { name: 'Character Obfuscation', type: 'obfuscation', regex: /[a-z]\*[a-z]|[a-z]_[a-z]|[a-z]\.[a-z]{2,}/i, severity: 4 },
  { name: 'Gradual Escalation', type: 'gradual', regex: /\b(step by step|gradually|slowly|first.*then.*finally)\b.*\b(bypass|circumvent|avoid|get around)\b/i, severity: 7 },
  { name: 'Opposite Day', type: 'context_manipulation', regex: /\b(opposite day|reverse|invert|flip)\s+(the\s+)?(rules?|instructions?|meaning)/i, severity: 6 },
];

// HarmBench harm category keywords
const HARM_CATEGORY_KEYWORDS: Record<string, string[]> = {
  chem_bio: ['chemical weapon', 'biological weapon', 'nerve agent', 'ricin', 'anthrax', 'mustard gas', 'sarin', 'bioweapon', 'synthesize', 'pathogen'],
  cybercrime: ['hack', 'malware', 'ransomware', 'phishing', 'exploit', 'vulnerability', 'ddos', 'botnet', 'keylogger', 'backdoor', 'zero day'],
  harassment: ['harass', 'bully', 'stalk', 'dox', 'intimidate', 'threaten', 'humiliate', 'cyberbully'],
  illegal_activity: ['drug', 'cocaine', 'heroin', 'meth', 'fentanyl', 'traffic', 'smuggle', 'counterfeit', 'launder'],
  misinformation: ['fake news', 'propaganda', 'disinformation', 'conspiracy', 'election fraud', 'deep fake', 'misinform'],
  physical_harm: ['kill', 'murder', 'assault', 'bomb', 'explosive', 'weapon', 'shoot', 'stab', 'poison', 'attack'],
  fraud: ['scam', 'fraud', 'phish', 'identity theft', 'credit card', 'bank account', 'steal money', 'pyramid scheme'],
  copyright: ['pirate', 'torrent', 'crack', 'serial key', 'bypass drm', 'copyrighted', 'download illegally'],
  privacy: ['track', 'surveil', 'spy on', 'personal information', 'address of', 'phone number of', 'where does.*live'],
  sexual_content: ['nsfw', 'explicit', 'pornograph', 'sexual content', 'nude', 'minor', 'child'],
  hate_speech: ['racist', 'sexist', 'slur', 'discriminat', 'supremac', 'ethnic cleansing', 'genocide'],
  self_harm: ['suicide', 'kill myself', 'self harm', 'cut myself', 'overdose', 'end my life', 'eating disorder'],
};

// ============================================================================
// Constitutional Classifier Service
// ============================================================================

class ConstitutionalClassifierService {
  
  /**
   * Classify input for potential harm
   */
  async classify(
    tenantId: string,
    input: string,
    inputType: 'prompt' | 'response' | 'conversation' = 'prompt',
    options?: { modelId?: string; userId?: string; requestId?: string }
  ): Promise<ClassificationResult> {
    const startTime = Date.now();
    const config = await this.getClassifierConfig(tenantId);
    
    if (!config.enabled) {
      return {
        isHarmful: false,
        confidenceScore: 0,
        harmCategories: [],
        actionTaken: 'allowed',
        latencyMs: Date.now() - startTime,
      };
    }
    
    // Run classification pipeline
    const jailbreakResult = this.detectJailbreakPatterns(input);
    const harmResult = this.detectHarmCategories(input, config.categories);
    
    // Combine scores
    const combinedScore = Math.max(
      jailbreakResult.maxScore * 0.8, // Jailbreak patterns weighted slightly less
      harmResult.maxScore
    );
    
    const isHarmful = combinedScore >= config.confidenceThreshold;
    
    // Determine action
    let actionTaken: ClassificationResult['actionTaken'] = 'allowed';
    if (isHarmful) {
      actionTaken = config.action === 'block' ? 'blocked' : 'flagged';
    }
    
    const result: ClassificationResult = {
      isHarmful,
      confidenceScore: combinedScore,
      harmCategories: harmResult.categories,
      attackType: jailbreakResult.detectedType,
      actionTaken,
      latencyMs: Date.now() - startTime,
    };
    
    // Log classification result
    await this.logClassification(tenantId, input, result, options);
    
    return result;
  }
  
  /**
   * Detect jailbreak patterns using WildJailbreak-derived signatures
   */
  private detectJailbreakPatterns(input: string): {
    detected: boolean;
    detectedType?: string;
    maxScore: number;
    matches: Array<{ pattern: string; type: string; score: number }>;
  } {
    const matches: Array<{ pattern: string; type: string; score: number }> = [];
    let maxScore = 0;
    let detectedType: string | undefined;
    
    for (const pattern of JAILBREAK_PATTERNS) {
      if (pattern.regex.test(input)) {
        const score = pattern.severity / 10;
        matches.push({
          pattern: pattern.name,
          type: pattern.type,
          score,
        });
        
        if (score > maxScore) {
          maxScore = score;
          detectedType = pattern.type;
        }
      }
    }
    
    // Additional heuristics
    const lowerInput = input.toLowerCase();
    
    // Check for excessive special characters (obfuscation)
    const specialCharRatio = (input.match(/[^\w\s]/g) || []).length / input.length;
    if (specialCharRatio > 0.3) {
      matches.push({ pattern: 'High Special Char Ratio', type: 'obfuscation', score: 0.4 });
      maxScore = Math.max(maxScore, 0.4);
    }
    
    // Check for unicode tricks
    if (/[\u200B-\u200F\u2028-\u202F\uFEFF]/.test(input)) {
      matches.push({ pattern: 'Zero-Width Characters', type: 'obfuscation', score: 0.6 });
      maxScore = Math.max(maxScore, 0.6);
      detectedType = detectedType || 'obfuscation';
    }
    
    // Check for homoglyph substitution (Cyrillic/Greek lookalikes)
    if (/[\u0400-\u04FF\u0370-\u03FF]/.test(input) && /[a-zA-Z]/.test(input)) {
      matches.push({ pattern: 'Homoglyph Substitution', type: 'obfuscation', score: 0.5 });
      maxScore = Math.max(maxScore, 0.5);
    }
    
    return {
      detected: matches.length > 0,
      detectedType,
      maxScore,
      matches,
    };
  }
  
  /**
   * Detect harm categories using HarmBench taxonomy
   */
  private detectHarmCategories(input: string, enabledCategories: string[]): {
    detected: boolean;
    categories: Array<{ category: string; score: number }>;
    maxScore: number;
  } {
    const lowerInput = input.toLowerCase();
    const categories: Array<{ category: string; score: number }> = [];
    let maxScore = 0;
    
    for (const [category, keywords] of Object.entries(HARM_CATEGORY_KEYWORDS)) {
      // Skip if category not enabled (empty = all enabled)
      if (enabledCategories.length > 0 && !enabledCategories.includes(category)) {
        continue;
      }
      
      let matchCount = 0;
      let totalWeight = 0;
      
      for (const keyword of keywords) {
        if (lowerInput.includes(keyword)) {
          matchCount++;
          // Weight by keyword specificity (longer = more specific)
          totalWeight += Math.min(keyword.length / 10, 1);
        }
      }
      
      if (matchCount > 0) {
        // Score based on match count and weight, capped at 1.0
        const score = Math.min(
          (matchCount * 0.2) + (totalWeight * 0.3),
          1.0
        );
        
        categories.push({ category, score });
        maxScore = Math.max(maxScore, score);
      }
    }
    
    // Sort by score descending
    categories.sort((a, b) => b.score - a.score);
    
    return {
      detected: categories.length > 0,
      categories: categories.slice(0, 5), // Top 5
      maxScore,
    };
  }
  
  /**
   * Get classifier configuration for tenant
   */
  async getClassifierConfig(tenantId: string): Promise<ClassifierConfig> {
    const result = await executeStatement(
      `SELECT constitutional_classifier_enabled, classifier_model_type, 
              classifier_confidence_threshold, classifier_action, classifier_categories
       FROM security_protection_config WHERE tenant_id = $1::uuid`,
      [stringParam('tenantId', tenantId)]
    );
    
    if (!result.rows?.length) {
      return {
        enabled: false,
        modelType: 'harmbench_llama',
        confidenceThreshold: 0.8,
        action: 'flag',
        categories: [],
      };
    }
    
    const row = result.rows[0];
    return {
      enabled: row.constitutional_classifier_enabled === true,
      modelType: String(row.classifier_model_type || 'harmbench_llama'),
      confidenceThreshold: Number(row.classifier_confidence_threshold || 0.8),
      action: (row.classifier_action as 'flag' | 'block' | 'modify') || 'flag',
      categories: (row.classifier_categories as string[]) || [],
    };
  }
  
  /**
   * Log classification result to database
   */
  private async logClassification(
    tenantId: string,
    input: string,
    result: ClassificationResult,
    options?: { modelId?: string; userId?: string; requestId?: string }
  ): Promise<void> {
    const inputHash = crypto.createHash('sha256').update(input).digest('hex');
    
    await executeStatement(
      `INSERT INTO classification_results (
        tenant_id, input_hash, input_type, is_harmful, confidence_score,
        harm_categories, attack_type, action_taken, latency_ms,
        model_id, user_id, request_id
      ) VALUES ($1::uuid, $2, $3, $4, $5, $6::jsonb, $7, $8, $9, $10, $11::uuid, $12::uuid)`,
      [
        stringParam('tenantId', tenantId),
        stringParam('inputHash', inputHash),
        stringParam('inputType', 'prompt'),
        boolParam('isHarmful', result.isHarmful),
        doubleParam('confidenceScore', result.confidenceScore),
        stringParam('harmCategories', JSON.stringify(result.harmCategories)),
        stringParam('attackType', result.attackType || ''),
        stringParam('actionTaken', result.actionTaken),
        longParam('latencyMs', result.latencyMs),
        stringParam('modelId', options?.modelId || ''),
        stringParam('userId', options?.userId || ''),
        stringParam('requestId', options?.requestId || ''),
      ]
    );
  }
  
  /**
   * Get classification statistics
   */
  async getClassificationStats(tenantId: string, days: number = 7): Promise<{
    totalClassifications: number;
    harmfulDetected: number;
    harmfulRate: number;
    byCategory: Record<string, number>;
    byAttackType: Record<string, number>;
    avgLatencyMs: number;
  }> {
    const result = await executeStatement(
      `SELECT 
        COUNT(*) as total,
        SUM(CASE WHEN is_harmful THEN 1 ELSE 0 END) as harmful,
        AVG(latency_ms) as avg_latency
       FROM classification_results
       WHERE tenant_id = $1::uuid AND created_at >= NOW() - INTERVAL '1 day' * $2`,
      [stringParam('tenantId', tenantId), longParam('days', days)]
    );
    
    const row = result.rows?.[0] || {};
    const total = Number(row.total || 0);
    const harmful = Number(row.harmful || 0);
    
    // Get category breakdown
    const categoryResult = await executeStatement(
      `SELECT 
        jsonb_array_elements(harm_categories)->>'category' as category,
        COUNT(*) as count
       FROM classification_results
       WHERE tenant_id = $1::uuid AND is_harmful = true 
         AND created_at >= NOW() - INTERVAL '1 day' * $2
       GROUP BY category`,
      [stringParam('tenantId', tenantId), longParam('days', days)]
    );
    
    const byCategory: Record<string, number> = {};
    for (const r of categoryResult.rows || []) {
      byCategory[String(r.category)] = Number(r.count);
    }
    
    // Get attack type breakdown
    const attackResult = await executeStatement(
      `SELECT attack_type, COUNT(*) as count
       FROM classification_results
       WHERE tenant_id = $1::uuid AND attack_type IS NOT NULL AND attack_type != ''
         AND created_at >= NOW() - INTERVAL '1 day' * $2
       GROUP BY attack_type`,
      [stringParam('tenantId', tenantId), longParam('days', days)]
    );
    
    const byAttackType: Record<string, number> = {};
    for (const r of attackResult.rows || []) {
      byAttackType[String(r.attack_type)] = Number(r.count);
    }
    
    return {
      totalClassifications: total,
      harmfulDetected: harmful,
      harmfulRate: total > 0 ? harmful / total : 0,
      byCategory,
      byAttackType,
      avgLatencyMs: Number(row.avg_latency || 0),
    };
  }
  
  /**
   * Get all harm categories
   */
  async getHarmCategories(): Promise<HarmCategory[]> {
    const result = await executeStatement(
      `SELECT category_code, category_name, description, severity_level, examples
       FROM harm_categories ORDER BY severity_level DESC`,
      []
    );
    
    return (result.rows || []).map(row => ({
      categoryCode: String(row.category_code),
      categoryName: String(row.category_name),
      description: String(row.description || ''),
      severityLevel: Number(row.severity_level || 5),
      examples: (row.examples as string[]) || [],
    }));
  }
  
  /**
   * Add custom jailbreak pattern
   */
  async addJailbreakPattern(pattern: {
    patternName: string;
    patternType: string;
    patternRegex: string;
    examplePrompts: string[];
    severity: number;
    source?: string;
  }): Promise<void> {
    await executeStatement(
      `INSERT INTO jailbreak_patterns (
        pattern_name, pattern_type, pattern_regex, example_prompts, severity, source, is_active
      ) VALUES ($1, $2, $3, $4, $5, $6, true)`,
      [
        stringParam('patternName', pattern.patternName),
        stringParam('patternType', pattern.patternType),
        stringParam('patternRegex', pattern.patternRegex),
        stringParam('examplePrompts', JSON.stringify(pattern.examplePrompts)),
        longParam('severity', pattern.severity),
        stringParam('source', pattern.source || 'manual'),
      ]
    );
  }
  
  /**
   * Get jailbreak patterns
   */
  async getJailbreakPatterns(options?: { type?: string; active?: boolean }): Promise<JailbreakPattern[]> {
    let query = `SELECT pattern_name, pattern_type, pattern_regex, example_prompts, severity
                 FROM jailbreak_patterns WHERE 1=1`;
    const params: ReturnType<typeof stringParam>[] = [];
    let idx = 1;
    
    if (options?.type) {
      query += ` AND pattern_type = $${idx}`;
      params.push(stringParam('type', options.type));
      idx++;
    }
    
    if (options?.active !== undefined) {
      query += ` AND is_active = $${idx}`;
      params.push(boolParam('active', options.active));
    }
    
    query += ` ORDER BY severity DESC`;
    
    const result = await executeStatement(query, params);
    
    return (result.rows || []).map(row => ({
      patternName: String(row.pattern_name),
      patternType: String(row.pattern_type),
      patternRegex: row.pattern_regex ? String(row.pattern_regex) : undefined,
      examplePrompts: (row.example_prompts as string[]) || [],
      severity: Number(row.severity || 5),
    }));
  }
  
  /**
   * Self-critique and revise (Constitutional AI methodology)
   * Uses LLM for critique and revision following Anthropic's CAI approach
   */
  async selfCritiqueAndRevise(
    tenantId: string,
    harmfulResponse: string,
    constitutionalPrinciples: string[]
  ): Promise<{
    critique: string;
    revisedResponse: string;
    principlesViolated: string[];
  }> {
    const principlesText = constitutionalPrinciples.map((p, i) => `${i + 1}. ${p}`).join('\n');
    
    // Step 1: Critique the response using LLM
    const critiquePrompt = `You are a constitutional AI critic. Analyze the following response against these principles:

PRINCIPLES:
${principlesText}

RESPONSE TO CRITIQUE:
"${harmfulResponse}"

Identify which principles (if any) this response violates. Be specific about why each principle is violated.

Respond with ONLY valid JSON:
{"critique": "detailed critique", "principlesViolated": ["principle 1", "principle 2"], "severityScore": 0.0-1.0}`;

    let critique = '';
    let principlesViolated: string[] = [];
    let severityScore = 0;
    
    try {
      const critiqueMessages: ChatMessage[] = [
        { role: 'system', content: 'You are a constitutional AI safety critic. Analyze responses for principle violations. Always respond with valid JSON.' },
        { role: 'user', content: critiquePrompt }
      ];
      
      const critiqueResponse = await modelRouterService.invoke({
        modelId: 'anthropic/claude-3-haiku',
        messages: critiqueMessages,
        temperature: 0.1,
        maxTokens: 1024,
      });
      
      const jsonMatch = critiqueResponse.content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]) as {
          critique: string;
          principlesViolated: string[];
          severityScore: number;
        };
        critique = parsed.critique || '';
        principlesViolated = parsed.principlesViolated || [];
        severityScore = parsed.severityScore || 0;
      }
    } catch (error) {
      logger.warn('LLM critique failed, using pattern-based analysis', { error: String(error) });
      
      // Fallback to pattern-based detection
      for (const principle of constitutionalPrinciples) {
        const lowerPrinciple = principle.toLowerCase();
        if (lowerPrinciple.includes('harm') && this.detectHarmCategories(harmfulResponse, []).detected) {
          principlesViolated.push(principle);
        }
        if (lowerPrinciple.includes('honest') && harmfulResponse.toLowerCase().includes('lie')) {
          principlesViolated.push(principle);
        }
      }
      critique = principlesViolated.length > 0
        ? `Pattern-based analysis found violations: ${principlesViolated.join(', ')}`
        : 'No obvious violations detected via pattern analysis.';
    }
    
    // Step 2: If violations found, revise the response using LLM
    let revisedResponse = harmfulResponse;
    
    if (principlesViolated.length > 0 || severityScore > 0.3) {
      try {
        const revisionPrompt = `You are a constitutional AI assistant. Revise this response to comply with the violated principles while still being helpful.

ORIGINAL RESPONSE:
"${harmfulResponse}"

CRITIQUE:
${critique}

PRINCIPLES VIOLATED:
${principlesViolated.join(', ') || 'General safety concerns'}

Write a revised response that:
1. Addresses the user's underlying need if legitimate
2. Complies with all constitutional principles
3. Is helpful and informative without being harmful

Provide ONLY the revised response text, no explanation.`;

        const revisionMessages: ChatMessage[] = [
          { role: 'system', content: 'You are a helpful AI that always follows constitutional principles. Revise responses to be safe and helpful.' },
          { role: 'user', content: revisionPrompt }
        ];
        
        const revisionResponse = await modelRouterService.invoke({
          modelId: 'anthropic/claude-3-haiku',
          messages: revisionMessages,
          temperature: 0.3,
          maxTokens: 2048,
        });
        
        revisedResponse = revisionResponse.content.trim();
      } catch (error) {
        logger.warn('LLM revision failed, using default refusal', { error: String(error) });
        revisedResponse = "I can't help with that request as it goes against my guidelines. Let me know if there's something else I can assist with.";
      }
    }
    
    return {
      critique,
      revisedResponse,
      principlesViolated,
    };
  }
}

export const constitutionalClassifierService = new ConstitutionalClassifierService();
