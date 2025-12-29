// RADIANT v4.18.0 - Security Middleware Service
// Integration layer for Brain Router and request pipeline
// ============================================================================

import { enhancedLogger as logger } from '../logging/enhanced-logger';
import { constitutionalClassifierService } from './constitutional-classifier.service';
import { semanticClassifierService } from './semantic-classifier.service';
import { behavioralAnomalyService } from './behavioral-anomaly.service';
import { hallucinationDetectionService } from './hallucination-detection.service';
import { securityProtectionService } from './security-protection.service';
import { securityAlertService } from './security-alert.service';

// ============================================================================
// Types
// ============================================================================

export interface SecurityCheckRequest {
  tenantId: string;
  userId: string;
  prompt: string;
  modelId?: string;
  conversationId?: string;
  requestId?: string;
  context?: string;
}

export interface SecurityCheckResult {
  allowed: boolean;
  blocked: boolean;
  flagged: boolean;
  modified: boolean;
  
  modifiedPrompt?: string;
  blockReason?: string;
  flagReasons: string[];
  
  checks: {
    constitutional?: {
      isHarmful: boolean;
      confidenceScore: number;
      attackType?: string;
      categories: string[];
    };
    semantic?: {
      isHarmful: boolean;
      semanticScore: number;
      topMatches: Array<{ patternName: string; similarity: number }>;
    };
    anomaly?: {
      hasAnomaly: boolean;
      riskScore: number;
      anomalyTypes: string[];
    };
    inputSanitization?: {
      containsInjection: boolean;
      patterns: string[];
    };
  };
  
  trustScore?: number;
  latencyMs: number;
}

export interface ResponseCheckRequest {
  tenantId: string;
  userId: string;
  prompt: string;
  response: string;
  modelId: string;
  requestId?: string;
  context?: string;
}

export interface ResponseCheckResult {
  allowed: boolean;
  modified: boolean;
  sanitized: boolean;
  
  modifiedResponse?: string;
  
  checks: {
    outputSanitization?: {
      containsPII: boolean;
      containsCanaryTokens: boolean;
      containsSystemPrompts: boolean;
    };
    hallucination?: {
      isHallucinated: boolean;
      confidenceScore: number;
      groundingScore?: number;
    };
  };
  
  latencyMs: number;
}

// ============================================================================
// Security Middleware Service
// ============================================================================

class SecurityMiddlewareService {
  
  /**
   * Run all pre-request security checks
   * Called by Brain Router before model selection
   */
  async checkRequest(request: SecurityCheckRequest): Promise<SecurityCheckResult> {
    const startTime = Date.now();
    const config = await securityProtectionService.getConfig(request.tenantId);
    
    const result: SecurityCheckResult = {
      allowed: true,
      blocked: false,
      flagged: false,
      modified: false,
      flagReasons: [],
      checks: {},
      latencyMs: 0,
    };
    
    if (!config.protectionEnabled) {
      result.latencyMs = Date.now() - startTime;
      return result;
    }
    
    // Run checks in parallel for performance
    const checkPromises: Promise<void>[] = [];
    
    // 1. Constitutional Classification (always run if protection enabled)
    checkPromises.push(
      this.runConstitutionalCheck(request, config, result)
    );
    
    // 2. Semantic Classification
    checkPromises.push(
      this.runSemanticCheck(request, result)
    );
    
    // 3. Behavioral Anomaly Detection
    checkPromises.push(
      this.runAnomalyCheck(request, result)
    );
    
    // 4. Input Sanitization
    if (config.inputSanitization?.enabled) {
      checkPromises.push(
        this.runInputSanitization(request, config, result)
      );
    }
    
    // 5. Trust Score Check
    if (config.trustScoring?.enabled) {
      checkPromises.push(
        this.checkTrustScore(request, result)
      );
    }
    
    await Promise.all(checkPromises);
    
    // Apply instruction hierarchy if enabled
    if (config.instructionHierarchy?.enabled && !result.blocked) {
      // applyInstructionHierarchy takes (config, systemPrompt, orchestrationContext, userInput)
      result.modifiedPrompt = securityProtectionService.applyInstructionHierarchy(
        config,
        '', // system prompt - would be provided by Brain Router
        '', // orchestration context
        request.prompt
      );
      result.modified = result.modifiedPrompt !== request.prompt;
    }
    
    // Add self-reminder if enabled
    if (config.selfReminder?.enabled && !result.blocked) {
      const promptToModify = result.modifiedPrompt || request.prompt;
      // applySelfReminder takes (config, prompt)
      result.modifiedPrompt = securityProtectionService.applySelfReminder(
        config,
        promptToModify
      );
      result.modified = true;
    }
    
    // Log security event if flagged or blocked
    if (result.blocked || result.flagged) {
      await securityProtectionService.logSecurityEvent(request.tenantId, {
        eventType: result.blocked ? 'request_blocked' : 'request_flagged',
        severity: result.blocked ? 'critical' : 'warning',
        eventSource: 'security_middleware',
        modelId: request.modelId,
        requestId: request.requestId,
        details: {
          checks: result.checks,
          flagReasons: result.flagReasons,
          blockReason: result.blockReason,
        },
      });
      
      // Send alert for blocked requests
      if (result.blocked) {
        await securityAlertService.sendAlert(request.tenantId, {
          type: 'request_blocked',
          severity: 'warning',
          title: 'Request blocked by security',
          message: result.blockReason || 'Request blocked due to security policy',
          metadata: {
            userId: request.userId,
            checks: result.checks,
          },
        });
      }
    }
    
    result.latencyMs = Date.now() - startTime;
    return result;
  }
  
  /**
   * Run all post-response security checks
   * Called by Brain Router after model response
   */
  async checkResponse(request: ResponseCheckRequest): Promise<ResponseCheckResult> {
    const startTime = Date.now();
    const config = await securityProtectionService.getConfig(request.tenantId);
    
    const result: ResponseCheckResult = {
      allowed: true,
      modified: false,
      sanitized: false,
      checks: {},
      latencyMs: 0,
    };
    
    if (!config.protectionEnabled) {
      result.latencyMs = Date.now() - startTime;
      return result;
    }
    
    let currentResponse = request.response;
    
    // 1. Output Sanitization
    if (config.outputSanitization?.enabled) {
      // sanitizeOutput takes (config, output, canaryToken?) and returns string
      const sanitizedOutput = securityProtectionService.sanitizeOutput(
        config,
        currentResponse
      );
      
      // Check what was sanitized by comparing
      const containsPII = config.outputSanitization.sanitizePii && sanitizedOutput !== currentResponse;
      const containsSystemPrompts = config.outputSanitization.sanitizeSystemPrompts && sanitizedOutput !== currentResponse;
      
      result.checks.outputSanitization = {
        containsPII,
        containsCanaryTokens: false, // Will be checked separately
        containsSystemPrompts,
      };
      
      if (sanitizedOutput !== currentResponse) {
        currentResponse = sanitizedOutput;
        result.modified = true;
        result.sanitized = true;
      }
    }
    
    // 2. Hallucination Detection (if enabled and context provided)
    const hallucinationConfig = await hallucinationDetectionService.getConfig(request.tenantId);
    if (hallucinationConfig.enabled) {
      const hallucinationResult = await hallucinationDetectionService.checkHallucination(
        request.tenantId,
        request.prompt,
        currentResponse,
        {
          context: request.context,
          modelId: request.modelId,
          runSelfCheck: hallucinationConfig.selfCheckEnabled,
          runGrounding: hallucinationConfig.groundingEnabled && !!request.context,
        }
      );
      
      result.checks.hallucination = {
        isHallucinated: hallucinationResult.isHallucinated,
        confidenceScore: hallucinationResult.confidenceScore,
        groundingScore: hallucinationResult.details.groundingScore,
      };
      
      // Flag but don't block hallucinated responses
      if (hallucinationResult.isHallucinated) {
        logger.warn('Hallucination detected in response', {
          tenantId: request.tenantId,
          modelId: request.modelId,
          score: hallucinationResult.confidenceScore,
        });
      }
    }
    
    // 3. Canary Token Detection
    // Note: Canary tokens would be stored per-request, this is a simplified check
    // In production, you'd pass the canary token that was injected into the prompt
    if (config.canaryDetection?.enabled && config.outputSanitization?.sanitizeCanaryTokens) {
      // Check for common canary patterns in output
      const canaryPatterns = [/TKCANARY_[a-f0-9]{8}/g, /CANARY_[a-f0-9]{16}/g, /SECURE_TOKEN_[a-z0-9]+/g];
      let canaryFound = false;
      let sanitizedResponse = currentResponse;
      
      for (const pattern of canaryPatterns) {
        if (pattern.test(currentResponse)) {
          canaryFound = true;
          sanitizedResponse = sanitizedResponse.replace(pattern, '');
        }
      }
      
      if (canaryFound) {
        // Canary token leaked - this is a serious security issue
        await securityProtectionService.logSecurityEvent(request.tenantId, {
          eventType: 'canary_token_leak',
          severity: 'critical',
          eventSource: 'security_middleware',
          modelId: request.modelId,
          requestId: request.requestId,
          details: { detected: true },
        });
        
        if (result.checks.outputSanitization) {
          result.checks.outputSanitization.containsCanaryTokens = true;
        }
        
        currentResponse = sanitizedResponse;
        result.modified = true;
      }
    }
    
    result.modifiedResponse = result.modified ? currentResponse : undefined;
    result.latencyMs = Date.now() - startTime;
    
    return result;
  }
  
  /**
   * Get security summary for a request
   * Used by Brain Router for logging/metrics
   */
  async getSecuritySummary(
    tenantId: string,
    userId: string
  ): Promise<{
    trustScore: number;
    recentFlags: number;
    recentBlocks: number;
    riskLevel: 'low' | 'medium' | 'high';
  }> {
    const [trustScore, recentEvents] = await Promise.all([
      securityProtectionService.getTrustScore(tenantId, userId),
      securityProtectionService.getSecurityEvents(tenantId, {
        since: new Date(Date.now() - 24 * 60 * 60 * 1000),
        limit: 100,
      }),
    ]);
    
    const recentFlags = recentEvents.filter((e: { eventType: string }) => e.eventType === 'request_flagged').length;
    const recentBlocks = recentEvents.filter((e: { eventType: string }) => e.eventType === 'request_blocked').length;
    
    let riskLevel: 'low' | 'medium' | 'high' = 'low';
    if (trustScore.overallScore < 0.3 || recentBlocks > 0) {
      riskLevel = 'high';
    } else if (trustScore.overallScore < 0.6 || recentFlags > 2) {
      riskLevel = 'medium';
    }
    
    return {
      trustScore: trustScore.overallScore,
      recentFlags,
      recentBlocks,
      riskLevel,
    };
  }
  
  // ==========================================================================
  // Private Check Methods
  // ==========================================================================
  
  private async runConstitutionalCheck(
    request: SecurityCheckRequest,
    config: Awaited<ReturnType<typeof securityProtectionService.getConfig>>,
    result: SecurityCheckResult
  ): Promise<void> {
    try {
      const classificationResult = await constitutionalClassifierService.classify(
        request.tenantId,
        request.prompt,
        'prompt',
        {
          modelId: request.modelId,
          userId: request.userId,
          requestId: request.requestId,
        }
      );
      
      result.checks.constitutional = {
        isHarmful: classificationResult.isHarmful,
        confidenceScore: classificationResult.confidenceScore,
        attackType: classificationResult.attackType,
        categories: classificationResult.harmCategories.map(c => c.category),
      };
      
      if (classificationResult.isHarmful) {
        // Default action is 'flag' - config doesn't have constitutionalClassifier property
        // Action would be determined by classification confidence
        const shouldBlock = classificationResult.confidenceScore > 0.9;
        
        if (shouldBlock) {
          result.blocked = true;
          result.allowed = false;
          result.blockReason = `Blocked: ${classificationResult.attackType || 'harmful content'} detected`;
        } else {
          result.flagged = true;
          result.flagReasons.push(`Constitutional: ${classificationResult.attackType || 'harmful'}`);
        }
      }
    } catch (error) {
      logger.error('Constitutional check failed', { error: String(error) });
    }
  }
  
  private async runSemanticCheck(
    request: SecurityCheckRequest,
    result: SecurityCheckResult
  ): Promise<void> {
    try {
      const semanticResult = await semanticClassifierService.classifySemanticaly(
        request.tenantId,
        request.prompt,
        { similarityThreshold: 0.75, topK: 3 }
      );
      
      result.checks.semantic = {
        isHarmful: semanticResult.isHarmful,
        semanticScore: semanticResult.semanticScore,
        topMatches: semanticResult.topMatches.map(m => ({
          patternName: m.patternName,
          similarity: m.similarity,
        })),
      };
      
      if (semanticResult.isHarmful && !result.blocked) {
        result.flagged = true;
        result.flagReasons.push(`Semantic: similar to known attack patterns`);
      }
    } catch (error) {
      logger.error('Semantic check failed', { error: String(error) });
    }
  }
  
  private async runAnomalyCheck(
    request: SecurityCheckRequest,
    result: SecurityCheckResult
  ): Promise<void> {
    try {
      // Get user baseline and check for anomalies
      const baseline = await behavioralAnomalyService.getUserBaseline(request.tenantId, request.userId);
      
      // Simple anomaly check based on prompt length deviation
      // UserBaseline has avgPromptLength but we estimate stddev as 20% of mean
      const estimatedStddev = baseline ? baseline.avgPromptLength * 0.2 : 100;
      const promptLengthZScore = baseline && estimatedStddev > 0
        ? Math.abs(request.prompt.length - baseline.avgPromptLength) / estimatedStddev
        : 0;
      
      const hasAnomaly = promptLengthZScore > 3; // Z-score > 3 is anomalous
      const riskScore = Math.min(promptLengthZScore / 5, 1); // Normalize to 0-1
      
      result.checks.anomaly = {
        hasAnomaly,
        riskScore,
        anomalyTypes: hasAnomaly ? ['prompt_length_deviation'] : [],
      };
      
      if (riskScore > 0.8) {
        result.flagged = true;
        result.flagReasons.push('Anomaly: unusual prompt length');
      }
    } catch (error) {
      logger.error('Anomaly check failed', { error: String(error) });
    }
  }
  
  private async runInputSanitization(
    request: SecurityCheckRequest,
    config: Awaited<ReturnType<typeof securityProtectionService.getConfig>>,
    result: SecurityCheckResult
  ): Promise<void> {
    try {
      // scanInputForInjection takes (config, input) and returns { clean, flags, decodedContent? }
      const scanResult = securityProtectionService.scanInputForInjection(
        config,
        request.prompt
      );
      
      result.checks.inputSanitization = {
        containsInjection: !scanResult.clean,
        patterns: scanResult.flags,
      };
      
      if (scanResult.flags.length > 0) {
        const action = config.inputSanitization?.action || 'log_only';
        
        if (action === 'block') {
          result.blocked = true;
          result.allowed = false;
          result.blockReason = 'Blocked: suspicious input patterns detected';
        } else {
          result.flagged = true;
          result.flagReasons.push(`Input: ${scanResult.flags.join(', ')}`);
        }
      }
    } catch (error) {
      logger.error('Input sanitization failed', { error: String(error) });
    }
  }
  
  private async checkTrustScore(
    request: SecurityCheckRequest,
    result: SecurityCheckResult
  ): Promise<void> {
    try {
      const trustScore = await securityProtectionService.getTrustScore(
        request.tenantId,
        request.userId
      );
      
      result.trustScore = trustScore.overallScore;
      
      // Flag low trust users
      if (trustScore.overallScore < 0.3) {
        result.flagged = true;
        result.flagReasons.push('Low trust score');
      }
    } catch (error) {
      logger.error('Trust score check failed', { error: String(error) });
    }
  }
}

export const securityMiddlewareService = new SecurityMiddlewareService();
