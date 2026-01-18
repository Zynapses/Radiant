/**
 * RADIANT v4.18.56 - Learning Aggregation Scheduled Lambda
 * Aggregates tenant learning data to global anonymized learning
 * Schedule: Weekly on Sunday at 4:00 AM UTC
 */

import { ScheduledEvent } from 'aws-lambda';
import { Pool } from 'pg';
import { LearningInfluenceService } from '../shared/services/learning-hierarchy.service';
import { logger } from '../shared/logging/enhanced-logger';

const pool = new Pool({
  host: process.env.DB_HOST,
  port: parseInt(process.env.DB_PORT || '5432'),
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  // Note: rejectUnauthorized: false is acceptable for Aurora within AWS VPC
  // Aurora uses AWS-managed certificates that may not chain to public CAs
  ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false,
});

const learningService = new LearningInfluenceService(pool);

interface AggregationStats {
  tenantsProcessed: number;
  globalDimensionsUpdated: number;
  modelPerformanceRecords: number;
  patternsDiscovered: number;
}

export const handler = async (event: ScheduledEvent): Promise<{
  statusCode: number;
  body: string;
}> => {
  logger.info('Learning Aggregation Lambda triggered', { time: event.time });

  const stats: AggregationStats = {
    tenantsProcessed: 0,
    globalDimensionsUpdated: 0,
    modelPerformanceRecords: 0,
    patternsDiscovered: 0,
  };

  try {
    // 1. Check minimum tenant threshold (privacy protection)
    const tenantCountResult = await pool.query(`
      SELECT COUNT(DISTINCT tenant_id) as tenant_count
      FROM tenant_aggregate_learning
      WHERE sample_count > 0
    `);
    const tenantCount = parseInt(tenantCountResult.rows[0]?.tenant_count || '0');
    
    const minTenantThreshold = parseInt(process.env.GLOBAL_AGGREGATION_MIN_TENANTS || '5');
    
    if (tenantCount < minTenantThreshold) {
      logger.info('Skipping global aggregation: insufficient tenants', { tenantCount, minTenantThreshold });
      return {
        statusCode: 200,
        body: JSON.stringify({
          success: true,
          message: `Skipped: insufficient tenants (${tenantCount}/${minTenantThreshold})`,
          stats,
        }),
      };
    }

    stats.tenantsProcessed = tenantCount;

    // 2. Run the aggregate_to_global function
    logger.info('Running global aggregation');
    await learningService.aggregateToGlobal();
    
    // 3. Count updated global dimensions
    const dimensionsResult = await pool.query(`
      SELECT COUNT(*) as count 
      FROM global_aggregate_learning 
      WHERE last_aggregation_at > NOW() - INTERVAL '1 hour'
    `);
    stats.globalDimensionsUpdated = parseInt(dimensionsResult.rows[0]?.count || '0');

    // 4. Count model performance records
    const modelPerfResult = await pool.query(`
      SELECT COUNT(*) as count 
      FROM global_model_performance 
      WHERE last_aggregated_at > NOW() - INTERVAL '1 hour'
    `);
    stats.modelPerformanceRecords = parseInt(modelPerfResult.rows[0]?.count || '0');

    // 5. Discover and promote successful patterns to global library
    const patternsResult = await pool.query(`
      INSERT INTO global_pattern_library (
        pattern_hash, pattern_category, pattern_name, pattern_template,
        pattern_description, tenant_adoption_count, successful_applications,
        total_applications, success_rate, confidence
      )
      SELECT 
        encode(sha256(tal.state_data::text::bytea), 'hex') as pattern_hash,
        tal.learning_dimension as pattern_category,
        tal.learning_dimension || ' pattern' as pattern_name,
        tal.state_data::text as pattern_template,
        'Auto-discovered pattern from aggregate learning' as pattern_description,
        COUNT(DISTINCT tal.tenant_id) as tenant_adoption_count,
        SUM(tal.sample_count) as successful_applications,
        SUM(tal.sample_count) as total_applications,
        AVG(tal.confidence) as success_rate,
        CASE WHEN COUNT(DISTINCT tal.tenant_id) >= $1 THEN 0.8 ELSE 0.3 END as confidence
      FROM tenant_aggregate_learning tal
      WHERE tal.confidence > 0.7
        AND tal.sample_count >= 10
      GROUP BY tal.learning_dimension, tal.state_data::text
      HAVING COUNT(DISTINCT tal.tenant_id) >= $1
      ON CONFLICT (pattern_hash) DO UPDATE SET
        tenant_adoption_count = EXCLUDED.tenant_adoption_count,
        successful_applications = EXCLUDED.successful_applications,
        total_applications = EXCLUDED.total_applications,
        success_rate = EXCLUDED.success_rate,
        confidence = EXCLUDED.confidence,
        last_applied_at = NOW()
      RETURNING id
    `, [minTenantThreshold]);
    stats.patternsDiscovered = patternsResult.rowCount || 0;

    // 6. Update global learning dimensions
    await pool.query(`
      INSERT INTO global_aggregate_learning (learning_dimension, state_data, confidence, sample_count, contributing_tenants, contributing_users)
      SELECT 
        tal.learning_dimension,
        jsonb_object_agg(
          tal.tenant_id::text,
          jsonb_build_object('confidence', tal.confidence, 'samples', tal.sample_count)
        ) as state_data,
        AVG(tal.confidence) as confidence,
        SUM(tal.sample_count) as sample_count,
        COUNT(DISTINCT tal.tenant_id) as contributing_tenants,
        SUM(tal.contributing_users) as contributing_users
      FROM tenant_aggregate_learning tal
      WHERE tal.sample_count > 0
      GROUP BY tal.learning_dimension
      HAVING COUNT(DISTINCT tal.tenant_id) >= $1
      ON CONFLICT (learning_dimension) DO UPDATE SET
        state_data = EXCLUDED.state_data,
        confidence = EXCLUDED.confidence,
        sample_count = EXCLUDED.sample_count,
        contributing_tenants = EXCLUDED.contributing_tenants,
        contributing_users = EXCLUDED.contributing_users,
        current_version = global_aggregate_learning.current_version + 1,
        last_updated = NOW(),
        last_aggregation_at = NOW()
    `, [minTenantThreshold]);

    // 7. Cleanup old learning events (keep 90 days)
    const cleanupResult = await pool.query(`
      DELETE FROM tenant_learning_events
      WHERE occurred_at < NOW() - INTERVAL '90 days'
      RETURNING id
    `);
    logger.info('Cleaned up old learning events', { count: cleanupResult.rowCount });

    // 8. Cleanup old decision logs (keep 30 days)
    const decisionCleanup = await pool.query(`
      DELETE FROM learning_decision_log
      WHERE decided_at < NOW() - INTERVAL '30 days'
      AND outcome_recorded = true
      RETURNING id
    `);
    logger.info('Cleaned up old decision logs', { count: decisionCleanup.rowCount });

    // 9. Log aggregation run
    await pool.query(`
      INSERT INTO system_logs (
        log_level, log_source, log_category, message, data
      ) VALUES (
        'info', 'learning-aggregation-lambda', 'scheduled_job',
        'Weekly global learning aggregation completed',
        $1
      )
    `, [JSON.stringify(stats)]);

    logger.info('Aggregation job completed', { stats });

    return {
      statusCode: 200,
      body: JSON.stringify({
        success: true,
        message: 'Global learning aggregation completed successfully',
        stats,
      }),
    };

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logger.error('Learning aggregation job failed', undefined, { error: errorMessage });

    // Log failure
    await pool.query(`
      INSERT INTO system_logs (
        log_level, log_source, log_category, message, data
      ) VALUES (
        'error', 'learning-aggregation-lambda', 'scheduled_job',
        'Weekly global learning aggregation failed',
        $1
      )
    `, [JSON.stringify({ error: errorMessage, stats })]).catch(() => {});

    return {
      statusCode: 500,
      body: JSON.stringify({
        success: false,
        error: errorMessage,
        stats,
      }),
    };
  }
};
