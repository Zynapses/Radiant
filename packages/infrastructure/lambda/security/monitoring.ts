// RADIANT v4.18.0 - Security Monitoring Lambda
// EventBridge scheduled continuous monitoring for drift, anomalies, and threats
// ============================================================================

import { Handler, ScheduledEvent } from 'aws-lambda';
import { executeStatement, stringParam, longParam } from '../shared/db/client';
import { enhancedLogger as logger } from '../shared/logging/enhanced-logger';
import { driftDetectionService } from '../shared/services/drift-detection.service';
import { behavioralAnomalyService } from '../shared/services/behavioral-anomaly.service';
import { constitutionalClassifierService } from '../shared/services/constitutional-classifier.service';
import { securityAlertService } from '../shared/services/security-alert.service';

// ============================================================================
// Types
// ============================================================================

interface MonitoringConfig {
  driftDetectionEnabled: boolean;
  anomalyDetectionEnabled: boolean;
  classificationReviewEnabled: boolean;
  alertThresholds: {
    driftPsiCritical: number;
    anomalyScoreCritical: number;
    harmfulRateCritical: number;
  };
}

interface MonitoringResult {
  tenantId: string;
  timestamp: Date;
  driftResults: Array<{
    modelId: string;
    driftDetected: boolean;
    metrics: string[];
  }>;
  anomalyResults: {
    totalUsers: number;
    usersWithAnomalies: number;
    criticalAnomalies: number;
  };
  classificationResults: {
    totalClassified: number;
    harmfulDetected: number;
    harmfulRate: number;
  };
  alertsSent: number;
}

// ============================================================================
// Handler
// ============================================================================

export const handler: Handler<ScheduledEvent> = async (event) => {
  const startTime = Date.now();
  logger.info('Security monitoring started', { event });
  
  try {
    // Get all active tenants with security features enabled
    const tenants = await getActiveTenants();
    
    const results: MonitoringResult[] = [];
    
    for (const tenant of tenants) {
      const config = await getMonitoringConfig(tenant.id);
      const result = await runTenantMonitoring(tenant.id, config);
      results.push(result);
    }
    
    // Aggregate results
    const summary = {
      tenantsMonitored: results.length,
      totalDriftDetections: results.reduce((s, r) => s + r.driftResults.filter(d => d.driftDetected).length, 0),
      totalCriticalAnomalies: results.reduce((s, r) => s + r.anomalyResults.criticalAnomalies, 0),
      totalHarmfulDetected: results.reduce((s, r) => s + r.classificationResults.harmfulDetected, 0),
      totalAlertsSent: results.reduce((s, r) => s + r.alertsSent, 0),
      executionTimeMs: Date.now() - startTime,
    };
    
    logger.info('Security monitoring complete', summary);
    
    return {
      statusCode: 200,
      body: JSON.stringify(summary),
    };
  } catch (error) {
    logger.error('Security monitoring failed', { error });
    throw error;
  }
};

// ============================================================================
// Monitoring Functions
// ============================================================================

async function runTenantMonitoring(
  tenantId: string,
  config: MonitoringConfig
): Promise<MonitoringResult> {
  const result: MonitoringResult = {
    tenantId,
    timestamp: new Date(),
    driftResults: [],
    anomalyResults: { totalUsers: 0, usersWithAnomalies: 0, criticalAnomalies: 0 },
    classificationResults: { totalClassified: 0, harmfulDetected: 0, harmfulRate: 0 },
    alertsSent: 0,
  };
  
  // 1. Run drift detection for all active models
  if (config.driftDetectionEnabled) {
    result.driftResults = await runDriftDetection(tenantId, config);
  }
  
  // 2. Check for behavioral anomalies across users
  if (config.anomalyDetectionEnabled) {
    result.anomalyResults = await runAnomalyDetection(tenantId, config);
  }
  
  // 3. Review classification statistics
  if (config.classificationReviewEnabled) {
    result.classificationResults = await runClassificationReview(tenantId, config);
  }
  
  // 4. Send alerts for critical findings
  result.alertsSent = await sendAlerts(tenantId, result, config);
  
  return result;
}

async function runDriftDetection(
  tenantId: string,
  config: MonitoringConfig
): Promise<MonitoringResult['driftResults']> {
  const results: MonitoringResult['driftResults'] = [];
  
  // Get all models used in the last 7 days
  const modelsResult = await executeStatement(
    `SELECT DISTINCT model_id FROM usage_logs 
     WHERE tenant_id = $1::uuid AND created_at >= NOW() - INTERVAL '7 days'`,
    [stringParam('tenantId', tenantId)]
  );
  
  for (const row of modelsResult.rows || []) {
    const modelId = String(row.model_id);
    
    try {
      const report = await driftDetectionService.detectDrift(
        tenantId,
        modelId,
        ['response_length', 'sentiment', 'toxicity']
      );
      
      results.push({
        modelId,
        driftDetected: report.overallDriftDetected,
        metrics: report.tests.filter(t => t.driftDetected).map(t => t.metricName),
      });
      
      // Log critical drift
      if (report.tests.some(t => t.testStatistic > config.alertThresholds.driftPsiCritical)) {
        logger.warn('Critical drift detected', { tenantId, modelId, report });
      }
    } catch (error) {
      logger.error('Drift detection failed for model', { tenantId, modelId, error });
    }
  }
  
  return results;
}

async function runAnomalyDetection(
  tenantId: string,
  config: MonitoringConfig
): Promise<MonitoringResult['anomalyResults']> {
  // Get users active in last hour
  const usersResult = await executeStatement(
    `SELECT DISTINCT user_id FROM usage_logs 
     WHERE tenant_id = $1::uuid AND created_at >= NOW() - INTERVAL '1 hour'`,
    [stringParam('tenantId', tenantId)]
  );
  
  const totalUsers = usersResult.rows?.length || 0;
  let usersWithAnomalies = 0;
  let criticalAnomalies = 0;
  
  for (const row of usersResult.rows || []) {
    const userId = String(row.user_id);
    
    try {
      const volumeAnomaly = await behavioralAnomalyService.analyzeSessionVolume(
        tenantId,
        userId,
        60
      );
      
      if (volumeAnomaly) {
        usersWithAnomalies++;
        if (volumeAnomaly.severity === 'critical') {
          criticalAnomalies++;
          logger.warn('Critical volume anomaly detected', { tenantId, userId, anomaly: volumeAnomaly });
        }
      }
    } catch (error) {
      logger.error('Anomaly detection failed for user', { tenantId, userId, error });
    }
  }
  
  return { totalUsers, usersWithAnomalies, criticalAnomalies };
}

async function runClassificationReview(
  tenantId: string,
  config: MonitoringConfig
): Promise<MonitoringResult['classificationResults']> {
  const stats = await constitutionalClassifierService.getClassificationStats(tenantId, 1);
  
  // Alert on high harmful rate
  if (stats.harmfulRate > config.alertThresholds.harmfulRateCritical) {
    logger.warn('High harmful classification rate', { tenantId, stats });
  }
  
  return {
    totalClassified: stats.totalClassifications,
    harmfulDetected: stats.harmfulDetected,
    harmfulRate: stats.harmfulRate,
  };
}

async function sendAlerts(
  tenantId: string,
  result: MonitoringResult,
  config: MonitoringConfig
): Promise<number> {
  let alertsSent = 0;
  
  // Critical drift alerts
  for (const drift of result.driftResults) {
    if (drift.driftDetected && drift.metrics.length > 0) {
      await securityAlertService.sendAlert(tenantId, {
        type: 'drift_detected',
        severity: 'warning',
        title: `Model drift detected: ${drift.modelId}`,
        message: `Drift detected in metrics: ${drift.metrics.join(', ')}`,
        metadata: { modelId: drift.modelId, metrics: drift.metrics },
      });
      alertsSent++;
    }
  }
  
  // Critical anomaly alerts
  if (result.anomalyResults.criticalAnomalies > 0) {
    await securityAlertService.sendAlert(tenantId, {
      type: 'anomaly_critical',
      severity: 'critical',
      title: `Critical behavioral anomalies detected`,
      message: `${result.anomalyResults.criticalAnomalies} critical anomalies from ${result.anomalyResults.usersWithAnomalies} users`,
      metadata: result.anomalyResults,
    });
    alertsSent++;
  }
  
  // High harmful rate alerts
  if (result.classificationResults.harmfulRate > config.alertThresholds.harmfulRateCritical) {
    await securityAlertService.sendAlert(tenantId, {
      type: 'harmful_rate_high',
      severity: 'warning',
      title: `High harmful content rate`,
      message: `${(result.classificationResults.harmfulRate * 100).toFixed(2)}% of requests classified as harmful`,
      metadata: result.classificationResults,
    });
    alertsSent++;
  }
  
  return alertsSent;
}

// ============================================================================
// Helpers
// ============================================================================

async function getActiveTenants(): Promise<Array<{ id: string; name: string }>> {
  const result = await executeStatement(
    `SELECT t.id, t.name FROM tenants t
     JOIN security_protection_config spc ON t.id = spc.tenant_id
     WHERE t.status = 'active' 
       AND (spc.drift_detection_enabled = true 
            OR spc.behavioral_anomaly_enabled = true 
            OR spc.constitutional_classifier_enabled = true)`,
    []
  );
  
  return (result.rows || []).map(row => ({
    id: String(row.id),
    name: String(row.name),
  }));
}

async function getMonitoringConfig(tenantId: string): Promise<MonitoringConfig> {
  const result = await executeStatement(
    `SELECT drift_detection_enabled, behavioral_anomaly_enabled, constitutional_classifier_enabled,
            drift_psi_threshold
     FROM security_protection_config WHERE tenant_id = $1::uuid`,
    [stringParam('tenantId', tenantId)]
  );
  
  const row = result.rows?.[0] || {};
  
  return {
    driftDetectionEnabled: row.drift_detection_enabled === true,
    anomalyDetectionEnabled: row.behavioral_anomaly_enabled === true,
    classificationReviewEnabled: row.constitutional_classifier_enabled === true,
    alertThresholds: {
      driftPsiCritical: Number(row.drift_psi_threshold || 0.25) * 1.5,
      anomalyScoreCritical: 0.8,
      harmfulRateCritical: 0.1, // 10% harmful rate triggers alert
    },
  };
}
