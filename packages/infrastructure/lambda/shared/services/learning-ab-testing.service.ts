// RADIANT v4.18.0 - Learning A/B Testing Service
// Compares cached vs fresh responses to measure learning effectiveness
// ============================================================================

import { executeStatement, stringParam, longParam, doubleParam } from '../db/client';
import { enhancedLearningService } from './enhanced-learning.service';
import { enhancedLogger as logger } from '../logging/enhanced-logger';
import { v4 as uuidv4 } from 'uuid';

// ============================================================================
// Types
// ============================================================================

export interface ABTestConfig {
  tenantId: string;
  testId: string;
  testName: string;
  description: string;
  status: 'draft' | 'running' | 'paused' | 'completed';
  trafficSplitPercent: number; // % going to variant (cached)
  startedAt?: Date;
  endedAt?: Date;
  minSampleSize: number;
  confidenceLevel: number; // e.g., 0.95 for 95% confidence
}

export interface ABTestVariant {
  variantId: string;
  variantName: 'control' | 'cached';
  description: string;
}

export interface ABTestAssignment {
  assignmentId: string;
  testId: string;
  userId: string;
  variantName: 'control' | 'cached';
  assignedAt: Date;
}

export interface ABTestResult {
  testId: string;
  testName: string;
  status: string;
  controlStats: {
    sampleSize: number;
    avgRating: number;
    avgResponseTimeMs: number;
    conversionRate: number;
  };
  variantStats: {
    sampleSize: number;
    avgRating: number;
    avgResponseTimeMs: number;
    conversionRate: number;
  };
  analysis: {
    ratingDifference: number;
    ratingPValue: number;
    isSignificant: boolean;
    winner: 'control' | 'cached' | 'tie' | 'insufficient_data';
    confidenceLevel: number;
    recommendation: string;
  };
}

// ============================================================================
// A/B Testing Service
// ============================================================================

class LearningABTestingService {
  
  /**
   * Create a new A/B test
   */
  async createTest(
    tenantId: string,
    testName: string,
    description: string,
    trafficSplitPercent: number = 50
  ): Promise<ABTestConfig> {
    const testId = uuidv4();
    
    await executeStatement(
      `INSERT INTO learning_ab_tests (
        test_id, tenant_id, test_name, description, status,
        traffic_split_percent, min_sample_size, confidence_level, created_at
      ) VALUES ($1::uuid, $2::uuid, $3, $4, 'draft', $5, 100, 0.95, NOW())`,
      [
        stringParam('testId', testId),
        stringParam('tenantId', tenantId),
        stringParam('testName', testName),
        stringParam('description', description),
        longParam('trafficSplit', trafficSplitPercent),
      ]
    );
    
    logger.info('Created A/B test', { testId, tenantId, testName });
    
    return {
      tenantId,
      testId,
      testName,
      description,
      status: 'draft',
      trafficSplitPercent,
      minSampleSize: 100,
      confidenceLevel: 0.95,
    };
  }
  
  /**
   * Start an A/B test
   */
  async startTest(tenantId: string, testId: string): Promise<void> {
    await executeStatement(
      `UPDATE learning_ab_tests 
       SET status = 'running', started_at = NOW()
       WHERE tenant_id = $1::uuid AND test_id = $2::uuid`,
      [stringParam('tenantId', tenantId), stringParam('testId', testId)]
    );
    
    logger.info('Started A/B test', { testId, tenantId });
  }
  
  /**
   * Stop an A/B test
   */
  async stopTest(tenantId: string, testId: string): Promise<void> {
    await executeStatement(
      `UPDATE learning_ab_tests 
       SET status = 'completed', ended_at = NOW()
       WHERE tenant_id = $1::uuid AND test_id = $2::uuid`,
      [stringParam('tenantId', tenantId), stringParam('testId', testId)]
    );
    
    logger.info('Stopped A/B test', { testId, tenantId });
  }
  
  /**
   * Get user's test assignment (or create one)
   */
  async getOrAssignVariant(
    tenantId: string,
    userId: string
  ): Promise<{ testId: string; variant: 'control' | 'cached' } | null> {
    // Get active test
    const testResult = await executeStatement(
      `SELECT * FROM learning_ab_tests 
       WHERE tenant_id = $1::uuid AND status = 'running'
       ORDER BY started_at DESC LIMIT 1`,
      [stringParam('tenantId', tenantId)]
    );
    
    if (!testResult.rows?.length) return null;
    
    const test = testResult.rows[0];
    const testId = String(test.test_id);
    
    // Check existing assignment
    const assignmentResult = await executeStatement(
      `SELECT * FROM learning_ab_assignments 
       WHERE test_id = $1::uuid AND user_id = $2::uuid`,
      [stringParam('testId', testId), stringParam('userId', userId)]
    );
    
    if (assignmentResult.rows?.length) {
      return {
        testId,
        variant: assignmentResult.rows[0].variant_name as 'control' | 'cached',
      };
    }
    
    // Assign new variant based on traffic split
    const trafficSplit = Number(test.traffic_split_percent || 50);
    const variant: 'control' | 'cached' = Math.random() * 100 < trafficSplit ? 'cached' : 'control';
    
    await executeStatement(
      `INSERT INTO learning_ab_assignments (assignment_id, test_id, user_id, variant_name, assigned_at)
       VALUES ($1::uuid, $2::uuid, $3::uuid, $4, NOW())`,
      [
        stringParam('assignmentId', uuidv4()),
        stringParam('testId', testId),
        stringParam('userId', userId),
        stringParam('variantName', variant),
      ]
    );
    
    return { testId, variant };
  }
  
  /**
   * Record a response for A/B test
   */
  async recordResponse(
    tenantId: string,
    userId: string,
    responseData: {
      responseId: string;
      responseTimeMs: number;
      usedCache: boolean;
      rating?: number;
    }
  ): Promise<void> {
    const assignment = await this.getOrAssignVariant(tenantId, userId);
    if (!assignment) return;
    
    await executeStatement(
      `INSERT INTO learning_ab_responses (
        response_id, test_id, user_id, variant_name,
        response_time_ms, used_cache, rating, created_at
      ) VALUES ($1::uuid, $2::uuid, $3::uuid, $4, $5, $6, $7, NOW())`,
      [
        stringParam('responseId', responseData.responseId),
        stringParam('testId', assignment.testId),
        stringParam('userId', userId),
        stringParam('variantName', assignment.variant),
        longParam('responseTimeMs', responseData.responseTimeMs),
        stringParam('usedCache', String(responseData.usedCache)),
        doubleParam('rating', responseData.rating || 0),
      ]
    );
  }
  
  /**
   * Get test results with statistical analysis
   */
  async getTestResults(tenantId: string, testId: string): Promise<ABTestResult> {
    // Get test config
    const testResult = await executeStatement(
      `SELECT * FROM learning_ab_tests WHERE tenant_id = $1::uuid AND test_id = $2::uuid`,
      [stringParam('tenantId', tenantId), stringParam('testId', testId)]
    );
    
    if (!testResult.rows?.length) {
      throw new Error('Test not found');
    }
    
    const test = testResult.rows[0];
    
    // Get stats for each variant
    const statsResult = await executeStatement(
      `SELECT 
         variant_name,
         COUNT(*) as sample_size,
         AVG(rating) FILTER (WHERE rating > 0) as avg_rating,
         AVG(response_time_ms) as avg_response_time,
         COUNT(*) FILTER (WHERE rating >= 4) / NULLIF(COUNT(*) FILTER (WHERE rating > 0), 0)::float as conversion_rate
       FROM learning_ab_responses
       WHERE test_id = $1::uuid
       GROUP BY variant_name`,
      [stringParam('testId', testId)]
    );
    
    const controlStats = { sampleSize: 0, avgRating: 0, avgResponseTimeMs: 0, conversionRate: 0 };
    const variantStats = { sampleSize: 0, avgRating: 0, avgResponseTimeMs: 0, conversionRate: 0 };
    
    for (const row of statsResult.rows || []) {
      const stats = {
        sampleSize: Number(row.sample_size || 0),
        avgRating: Number(row.avg_rating || 0),
        avgResponseTimeMs: Number(row.avg_response_time || 0),
        conversionRate: Number(row.conversion_rate || 0),
      };
      
      if (row.variant_name === 'control') {
        Object.assign(controlStats, stats);
      } else {
        Object.assign(variantStats, stats);
      }
    }
    
    // Statistical analysis
    const analysis = this.analyzeResults(controlStats, variantStats, Number(test.confidence_level || 0.95));
    
    return {
      testId,
      testName: String(test.test_name),
      status: String(test.status),
      controlStats,
      variantStats,
      analysis,
    };
  }
  
  private analyzeResults(
    control: { sampleSize: number; avgRating: number; avgResponseTimeMs: number; conversionRate: number },
    variant: { sampleSize: number; avgRating: number; avgResponseTimeMs: number; conversionRate: number },
    confidenceLevel: number
  ): ABTestResult['analysis'] {
    const minSampleSize = 30;
    
    if (control.sampleSize < minSampleSize || variant.sampleSize < minSampleSize) {
      return {
        ratingDifference: variant.avgRating - control.avgRating,
        ratingPValue: 1,
        isSignificant: false,
        winner: 'insufficient_data',
        confidenceLevel,
        recommendation: `Need at least ${minSampleSize} samples per variant. Control: ${control.sampleSize}, Cached: ${variant.sampleSize}`,
      };
    }
    
    // Simple z-test approximation for rating difference
    const ratingDiff = variant.avgRating - control.avgRating;
    const pooledStdDev = 1.0; // Assume standard deviation of 1 for ratings
    const standardError = pooledStdDev * Math.sqrt(1/control.sampleSize + 1/variant.sampleSize);
    const zScore = ratingDiff / standardError;
    const pValue = 2 * (1 - this.normalCDF(Math.abs(zScore)));
    
    const isSignificant = pValue < (1 - confidenceLevel);
    
    let winner: 'control' | 'cached' | 'tie' = 'tie';
    if (isSignificant) {
      winner = ratingDiff > 0 ? 'cached' : 'control';
    }
    
    const recommendation = this.generateRecommendation(winner, ratingDiff, variant.avgResponseTimeMs, control.avgResponseTimeMs, isSignificant);
    
    return {
      ratingDifference: ratingDiff,
      ratingPValue: pValue,
      isSignificant,
      winner,
      confidenceLevel,
      recommendation,
    };
  }
  
  private normalCDF(z: number): number {
    // Approximation of normal CDF
    const a1 = 0.254829592;
    const a2 = -0.284496736;
    const a3 = 1.421413741;
    const a4 = -1.453152027;
    const a5 = 1.061405429;
    const p = 0.3275911;
    
    const sign = z < 0 ? -1 : 1;
    z = Math.abs(z) / Math.sqrt(2);
    
    const t = 1.0 / (1.0 + p * z);
    const y = 1.0 - (((((a5 * t + a4) * t) + a3) * t + a2) * t + a1) * t * Math.exp(-z * z);
    
    return 0.5 * (1.0 + sign * y);
  }
  
  private generateRecommendation(
    winner: 'control' | 'cached' | 'tie',
    ratingDiff: number,
    cachedResponseTime: number,
    controlResponseTime: number,
    isSignificant: boolean
  ): string {
    const timeSaved = controlResponseTime - cachedResponseTime;
    
    if (winner === 'cached') {
      return `Cached responses perform ${(ratingDiff * 100).toFixed(1)}% better. ` +
        `Also ${timeSaved.toFixed(0)}ms faster. Recommend enabling pattern caching.`;
    } else if (winner === 'control') {
      return `Fresh responses perform ${(-ratingDiff * 100).toFixed(1)}% better. ` +
        `Review cache quality thresholds.`;
    } else {
      if (timeSaved > 100) {
        return `No significant rating difference, but cached is ${timeSaved.toFixed(0)}ms faster. ` +
          `Consider enabling for performance.`;
      }
      return `No significant difference detected. Continue collecting data.`;
    }
  }
  
  /**
   * List all tests for tenant
   */
  async listTests(tenantId: string): Promise<ABTestConfig[]> {
    const result = await executeStatement(
      `SELECT * FROM learning_ab_tests WHERE tenant_id = $1::uuid ORDER BY created_at DESC`,
      [stringParam('tenantId', tenantId)]
    );
    
    return (result.rows || []).map(row => ({
      tenantId,
      testId: String(row.test_id),
      testName: String(row.test_name),
      description: String(row.description || ''),
      status: row.status as ABTestConfig['status'],
      trafficSplitPercent: Number(row.traffic_split_percent || 50),
      startedAt: row.started_at ? new Date(row.started_at as string) : undefined,
      endedAt: row.ended_at ? new Date(row.ended_at as string) : undefined,
      minSampleSize: Number(row.min_sample_size || 100),
      confidenceLevel: Number(row.confidence_level || 0.95),
    }));
  }
}

export const learningABTestingService = new LearningABTestingService();
