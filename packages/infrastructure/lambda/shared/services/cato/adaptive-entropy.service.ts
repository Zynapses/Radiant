/**
 * RADIANT Genesis Cato Adaptive Entropy Service
 * Risk-based semantic entropy checking for deception detection
 *
 * High-risk actions get synchronous entropy checks
 * Low-risk actions skip or use async checks
 */

import { query } from '../database';
import { SQSClient, SendMessageCommand, GetQueueUrlCommand } from '@aws-sdk/client-sqs';
import { DynamoDBClient, GetItemCommand, PutItemCommand } from '@aws-sdk/client-dynamodb';
import { EntropyCheckResult, EntropyCheckMode, ProposedAction, ExecutionContext } from './types';

// Default thresholds
const DEFAULT_CONFIG = {
  HIGH_RISK_THRESHOLD: 0.8,
  LOW_RISK_THRESHOLD: 0.3,
  ENTROPY_SAMPLES: 5,
  CONSISTENCY_THRESHOLD: 0.7,
};

// AWS clients (lazy initialized)
let sqsClient: SQSClient | null = null;
let dynamoClient: DynamoDBClient | null = null;

const getSQSClient = (): SQSClient => {
  if (!sqsClient) {
    sqsClient = new SQSClient({ region: process.env.AWS_REGION || 'us-east-1' });
  }
  return sqsClient;
};

const getDynamoClient = (): DynamoDBClient => {
  if (!dynamoClient) {
    dynamoClient = new DynamoDBClient({ region: process.env.AWS_REGION || 'us-east-1' });
  }
  return dynamoClient;
};

export class AdaptiveEntropyService {
  private config = DEFAULT_CONFIG;
  private queueUrl: string | null = null;

  /**
   * Load tenant-specific configuration
   */
  async loadConfig(tenantId: string): Promise<void> {
    try {
      const result = await query(
        `SELECT entropy_high_risk_threshold, entropy_low_risk_threshold 
         FROM cato_tenant_config WHERE tenant_id = $1`,
        [tenantId]
      );

      if (result.rows.length > 0) {
        const row = result.rows[0];
        this.config = {
          ...DEFAULT_CONFIG,
          HIGH_RISK_THRESHOLD:
            parseFloat(row.entropy_high_risk_threshold) || DEFAULT_CONFIG.HIGH_RISK_THRESHOLD,
          LOW_RISK_THRESHOLD:
            parseFloat(row.entropy_low_risk_threshold) || DEFAULT_CONFIG.LOW_RISK_THRESHOLD,
        };
      }
    } catch (error) {
      console.warn('[CATO Entropy] Failed to load config, using defaults:', error);
    }
  }

  /**
   * Check entropy based on risk level
   */
  async checkEntropy(params: {
    prompt: string;
    agentResponse: string;
    action: ProposedAction;
    actorModel: string;
    context: ExecutionContext;
  }): Promise<EntropyCheckResult> {
    const { prompt, agentResponse, action, actorModel, context } = params;

    // Determine check mode based on action risk
    const riskScore = this.assessRisk(action);
    const mode = this.determineMode(riskScore, context);

    if (mode === 'SKIP') {
      return { mode };
    }

    if (mode === 'ASYNC') {
      // Queue background job
      const jobId = await this.queueBackgroundCheck(
        context.tenantId,
        context.sessionId,
        prompt,
        agentResponse,
        actorModel
      );
      return { mode, backgroundJobId: jobId };
    }

    // SYNC mode - perform immediate check
    const result = await this.performEntropyCheck(
      prompt,
      agentResponse,
      actorModel
    );

    return {
      mode: 'SYNC',
      result,
    };
  }

  /**
   * Assess risk of proposed action
   */
  private assessRisk(action: ProposedAction): number {
    let risk = 0.3; // Base risk

    // Increase risk for sensitive data
    if (action.containsPHI) risk += 0.3;
    if (action.containsPII) risk += 0.2;

    // Increase risk for destructive actions
    if (action.isDestructive) risk += 0.3;

    // Increase risk for high-cost actions
    if (action.estimatedCost && action.estimatedCost > 1.0) {
      risk += 0.1;
    }

    return Math.min(1.0, risk);
  }

  /**
   * Determine check mode based on risk
   */
  private determineMode(
    riskScore: number,
    context: ExecutionContext
  ): EntropyCheckMode {
    if (!context.systemState.tenantSettings.enableSemanticEntropy) {
      return 'SKIP';
    }

    if (riskScore >= this.config.HIGH_RISK_THRESHOLD) {
      return 'SYNC';
    }

    if (riskScore >= this.config.LOW_RISK_THRESHOLD) {
      return 'ASYNC';
    }

    return 'SKIP';
  }

  /**
   * Perform entropy check (semantic consistency)
   * Samples multiple responses and computes semantic variance
   */
  private async performEntropyCheck(
    prompt: string,
    agentResponse: string,
    actorModel: string
  ): Promise<{
    isPotentialDeception: boolean;
    semanticEntropy: number;
    consistency: number;
    deceptionIndicators: string[];
    sampledModel: string;
  }> {
    const deceptionIndicators: string[] = [];
    
    try {
      // Analyze the response for deception indicators
      const analysisResult = await this.analyzeResponseConsistency(prompt, agentResponse);
      
      // Check for evasive language patterns
      const evasivePatterns = this.detectEvasivePatterns(agentResponse);
      if (evasivePatterns.length > 0) {
        deceptionIndicators.push(...evasivePatterns);
      }

      // Check for self-contradiction
      const contradictions = this.detectContradictions(agentResponse);
      if (contradictions.length > 0) {
        deceptionIndicators.push(...contradictions);
      }

      // Check for hedging language
      const hedgingScore = this.detectHedgingLanguage(agentResponse);
      if (hedgingScore > 0.5) {
        deceptionIndicators.push('Excessive hedging language detected');
      }

      // Calculate semantic entropy based on analysis
      const baseEntropy = analysisResult.entropyScore;
      const indicatorPenalty = deceptionIndicators.length * 0.1;
      const semanticEntropy = Math.min(1.0, baseEntropy + indicatorPenalty);
      const consistency = 1 - semanticEntropy;
      const isPotentialDeception = semanticEntropy > 0.5;

      // Add severity-based indicators
      if (semanticEntropy > 0.3) {
        deceptionIndicators.push('Response variance detected');
      }
      if (semanticEntropy > 0.5) {
        deceptionIndicators.push('Significant semantic inconsistency');
      }
      if (semanticEntropy > 0.7) {
        deceptionIndicators.push('Possible hallucination or deception');
      }

      return {
        isPotentialDeception,
        semanticEntropy,
        consistency,
        deceptionIndicators,
        sampledModel: actorModel,
      };
    } catch (error) {
      console.error('[CATO Entropy] Check failed:', error);
      // Return conservative values on error
      return {
        isPotentialDeception: false,
        semanticEntropy: 0.2,
        consistency: 0.8,
        deceptionIndicators: ['Entropy check encountered error'],
        sampledModel: actorModel,
      };
    }
  }

  /**
   * Analyze response consistency using heuristics
   */
  private async analyzeResponseConsistency(
    prompt: string,
    response: string
  ): Promise<{ entropyScore: number }> {
    // Calculate entropy based on response characteristics
    let entropyScore = 0.1; // Base entropy

    // Check response length ratio
    const promptLength = prompt.length;
    const responseLength = response.length;
    const lengthRatio = responseLength / Math.max(promptLength, 1);
    
    // Very short or very long responses relative to prompt can indicate issues
    if (lengthRatio < 0.1 || lengthRatio > 50) {
      entropyScore += 0.15;
    }

    // Check for repetition
    const words = response.toLowerCase().split(/\s+/);
    const uniqueWords = new Set(words);
    const repetitionRatio = 1 - (uniqueWords.size / words.length);
    if (repetitionRatio > 0.3) {
      entropyScore += 0.2;
    }

    // Check for sentence coherence
    const sentences = response.split(/[.!?]+/).filter(s => s.trim());
    if (sentences.length > 1) {
      // Simple coherence check: sentences should share some vocabulary
      const firstSentenceWords = new Set(sentences[0].toLowerCase().split(/\s+/));
      let totalOverlap = 0;
      for (let i = 1; i < sentences.length; i++) {
        const sentenceWords = sentences[i].toLowerCase().split(/\s+/);
        const overlap = sentenceWords.filter(w => firstSentenceWords.has(w)).length;
        totalOverlap += overlap / sentenceWords.length;
      }
      const avgOverlap = totalOverlap / (sentences.length - 1);
      if (avgOverlap < 0.1) {
        entropyScore += 0.15; // Low coherence
      }
    }

    return { entropyScore: Math.min(1.0, entropyScore) };
  }

  /**
   * Detect evasive language patterns
   */
  private detectEvasivePatterns(response: string): string[] {
    const patterns: string[] = [];
    const lowerResponse = response.toLowerCase();

    const evasiveIndicators = [
      { pattern: /i cannot.*but.*here/i, message: 'Evasive bypass pattern detected' },
      { pattern: /instead.*i will/i, message: 'Redirect evasion detected' },
      { pattern: /technically.*but/i, message: 'Technical evasion detected' },
      { pattern: /while i.*shouldn't/i, message: 'Self-aware violation pattern' },
      { pattern: /let me.*around/i, message: 'Workaround language detected' },
      { pattern: /hypothetically/i, message: 'Hypothetical framing detected' },
    ];

    for (const { pattern, message } of evasiveIndicators) {
      if (pattern.test(response)) {
        patterns.push(message);
      }
    }

    return patterns;
  }

  /**
   * Detect contradictions in response
   */
  private detectContradictions(response: string): string[] {
    const contradictions: string[] = [];
    
    // Simple contradiction patterns
    const contradictionPairs = [
      { affirm: /\bi am\b/i, deny: /\bi am not\b/i },
      { affirm: /\byes\b/i, deny: /\bno\b/i },
      { affirm: /\bcan\b/i, deny: /\bcannot\b/i },
      { affirm: /\bwill\b/i, deny: /\bwill not\b|won't/i },
      { affirm: /\btrue\b/i, deny: /\bfalse\b/i },
    ];

    for (const { affirm, deny } of contradictionPairs) {
      if (affirm.test(response) && deny.test(response)) {
        contradictions.push('Potential self-contradiction detected');
        break; // Only report once
      }
    }

    return contradictions;
  }

  /**
   * Detect hedging language
   */
  private detectHedgingLanguage(response: string): number {
    const hedgingWords = [
      'maybe', 'perhaps', 'possibly', 'might', 'could', 'seems',
      'appears', 'probably', 'likely', 'somewhat', 'fairly',
      'sort of', 'kind of', 'i think', 'i believe', 'i guess',
    ];

    const lowerResponse = response.toLowerCase();
    const words = lowerResponse.split(/\s+/);
    let hedgeCount = 0;

    for (const hedge of hedgingWords) {
      if (lowerResponse.includes(hedge)) {
        hedgeCount++;
      }
    }

    return Math.min(1.0, hedgeCount / 5); // Normalize: 5+ hedges = max score
  }

  /**
   * Get SQS queue URL
   */
  private async getQueueUrl(): Promise<string | null> {
    if (this.queueUrl) return this.queueUrl;

    const queueName = process.env.CATO_ENTROPY_QUEUE_NAME;
    if (!queueName) {
      console.log('[CATO Entropy] No SQS queue configured');
      return null;
    }

    try {
      const command = new GetQueueUrlCommand({ QueueName: queueName });
      const response = await getSQSClient().send(command);
      this.queueUrl = response.QueueUrl || null;
      return this.queueUrl;
    } catch (error) {
      console.error('[CATO Entropy] Failed to get queue URL:', error);
      return null;
    }
  }

  /**
   * Queue background entropy check to SQS
   */
  private async queueBackgroundCheck(
    tenantId: string,
    sessionId: string,
    prompt: string,
    response: string,
    model: string
  ): Promise<string> {
    const jobId = `entropy-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    const queueUrl = await this.getQueueUrl();
    if (!queueUrl) {
      console.log(`[CATO Entropy] No queue available, skipping background check: ${jobId}`);
      return jobId;
    }

    try {
      const message = {
        jobId,
        tenantId,
        sessionId,
        prompt,
        response,
        model,
        timestamp: Date.now(),
      };

      const command = new SendMessageCommand({
        QueueUrl: queueUrl,
        MessageBody: JSON.stringify(message),
        MessageGroupId: tenantId, // FIFO queue grouping
        MessageDeduplicationId: jobId,
      });

      await getSQSClient().send(command);
      console.log(`[CATO Entropy] Queued background check: ${jobId}`);
    } catch (error) {
      console.error('[CATO Entropy] Failed to queue message:', error);
    }
    
    return jobId;
  }

  /**
   * Get pending entropy check result from DynamoDB
   */
  async getBackgroundResult(jobId: string): Promise<EntropyCheckResult | null> {
    const tableName = process.env.CATO_ENTROPY_RESULTS_TABLE;
    if (!tableName) {
      return null;
    }

    try {
      const command = new GetItemCommand({
        TableName: tableName,
        Key: {
          jobId: { S: jobId },
        },
      });

      const response = await getDynamoClient().send(command);
      if (!response.Item) {
        return null; // Still processing
      }

      const item = response.Item;
      return {
        mode: 'ASYNC',
        backgroundJobId: jobId,
        result: {
          isPotentialDeception: item.isPotentialDeception?.BOOL || false,
          semanticEntropy: parseFloat(item.semanticEntropy?.N || '0'),
          consistency: parseFloat(item.consistency?.N || '1'),
          deceptionIndicators: item.deceptionIndicators?.SS || [],
          sampledModel: item.sampledModel?.S || 'unknown',
        },
      };
    } catch (error) {
      console.error('[CATO Entropy] Failed to get background result:', error);
      return null;
    }
  }

  /**
   * Store entropy check result to DynamoDB (called by background worker)
   */
  async storeBackgroundResult(
    jobId: string,
    result: {
      isPotentialDeception: boolean;
      semanticEntropy: number;
      consistency: number;
      deceptionIndicators: string[];
      sampledModel: string;
    }
  ): Promise<void> {
    const tableName = process.env.CATO_ENTROPY_RESULTS_TABLE;
    if (!tableName) {
      return;
    }

    try {
      const command = new PutItemCommand({
        TableName: tableName,
        Item: {
          jobId: { S: jobId },
          isPotentialDeception: { BOOL: result.isPotentialDeception },
          semanticEntropy: { N: result.semanticEntropy.toString() },
          consistency: { N: result.consistency.toString() },
          deceptionIndicators: { SS: result.deceptionIndicators.length > 0 ? result.deceptionIndicators : ['none'] },
          sampledModel: { S: result.sampledModel },
          ttl: { N: (Math.floor(Date.now() / 1000) + 3600).toString() }, // 1 hour TTL
        },
      });

      await getDynamoClient().send(command);
    } catch (error) {
      console.error('[CATO Entropy] Failed to store result:', error);
    }
  }
}

export const adaptiveEntropyService = new AdaptiveEntropyService();
