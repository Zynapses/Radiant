// RADIANT v4.18.0 - Security Admin API Handler
// Admin endpoints for security services
// ============================================================================

import { APIGatewayProxyHandler, APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { enhancedLogger as logger } from '../shared/logging/enhanced-logger';
import { constitutionalClassifierService } from '../shared/services/constitutional-classifier.service';
import { behavioralAnomalyService } from '../shared/services/behavioral-anomaly.service';
import { driftDetectionService } from '../shared/services/drift-detection.service';
import { inversePropensityService } from '../shared/services/inverse-propensity.service';
import { semanticClassifierService } from '../shared/services/semantic-classifier.service';
import { datasetImporterService } from '../shared/services/dataset-importer.service';
import { securityAlertService } from '../shared/services/security-alert.service';
import { attackGeneratorService } from '../shared/services/attack-generator.service';
import { classificationFeedbackService } from '../shared/services/classification-feedback.service';
import { securityProtectionService } from '../shared/services/security-protection.service';

// ============================================================================
// Response Helpers
// ============================================================================

const jsonResponse = (statusCode: number, body: unknown): APIGatewayProxyResult => ({
  statusCode,
  headers: {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
  },
  body: JSON.stringify(body),
});

const getTenantId = (event: APIGatewayProxyEvent): string => {
  return event.requestContext.authorizer?.tenantId || 
         event.headers['x-tenant-id'] || 
         '';
};

const getUserId = (event: APIGatewayProxyEvent): string => {
  return event.requestContext.authorizer?.userId || 
         event.headers['x-user-id'] || 
         '';
};

// ============================================================================
// Handler
// ============================================================================

export const handler: APIGatewayProxyHandler = async (event) => {
  const { httpMethod, path, pathParameters, queryStringParameters, body } = event;
  const tenantId = getTenantId(event);
  const userId = getUserId(event);
  
  if (!tenantId) {
    return jsonResponse(401, { error: 'Unauthorized - tenant ID required' });
  }
  
  logger.info('Security API request', { method: httpMethod, path, tenantId });
  
  try {
    // Parse path segments
    const segments = path.replace(/^\/api\/admin\/security\/?/, '').split('/').filter(Boolean);
    const resource = segments[0] || '';
    const subResource = segments[1] || '';
    const resourceId = segments[2] || pathParameters?.id || '';
    
    // Route requests
    switch (resource) {
      // =======================================================================
      // Protection Config
      // =======================================================================
      case 'config':
        if (httpMethod === 'GET') {
          const config = await securityProtectionService.getConfig(tenantId);
          return jsonResponse(200, config);
        }
        if (httpMethod === 'PUT') {
          const updates = JSON.parse(body || '{}');
          await securityProtectionService.updateConfig(tenantId, updates);
          return jsonResponse(200, { success: true });
        }
        break;
      
      // =======================================================================
      // Constitutional Classifier
      // =======================================================================
      case 'classifier':
        if (subResource === 'classify' && httpMethod === 'POST') {
          const { input, inputType } = JSON.parse(body || '{}');
          const result = await constitutionalClassifierService.classify(
            tenantId, input, inputType, { userId }
          );
          return jsonResponse(200, result);
        }
        if (subResource === 'stats' && httpMethod === 'GET') {
          const days = parseInt(queryStringParameters?.days || '7');
          const stats = await constitutionalClassifierService.getClassificationStats(tenantId, days);
          return jsonResponse(200, stats);
        }
        if (subResource === 'categories' && httpMethod === 'GET') {
          const categories = await constitutionalClassifierService.getHarmCategories();
          return jsonResponse(200, categories);
        }
        if (subResource === 'patterns' && httpMethod === 'GET') {
          const type = queryStringParameters?.type;
          const active = queryStringParameters?.active !== 'false';
          const patterns = await constitutionalClassifierService.getJailbreakPatterns({ type, active });
          return jsonResponse(200, patterns);
        }
        break;
      
      // =======================================================================
      // Semantic Classifier
      // =======================================================================
      case 'semantic':
        if (subResource === 'classify' && httpMethod === 'POST') {
          const { input, threshold, topK } = JSON.parse(body || '{}');
          const result = await semanticClassifierService.classifySemanticaly(
            tenantId, input, { similarityThreshold: threshold, topK }
          );
          return jsonResponse(200, result);
        }
        if (subResource === 'similar' && httpMethod === 'POST') {
          const { input, limit } = JSON.parse(body || '{}');
          const similar = await semanticClassifierService.findSimilarPatterns(input, limit || 10);
          return jsonResponse(200, similar);
        }
        if (subResource === 'embeddings' && httpMethod === 'POST') {
          const { model } = JSON.parse(body || '{}');
          const result = await semanticClassifierService.computeMissingEmbeddings(model);
          return jsonResponse(200, result);
        }
        if (subResource === 'stats' && httpMethod === 'GET') {
          const stats = await semanticClassifierService.getSimilarityStats(tenantId);
          return jsonResponse(200, stats);
        }
        if (subResource === 'clusters' && httpMethod === 'GET') {
          const numClusters = parseInt(queryStringParameters?.clusters || '10');
          const clusters = await semanticClassifierService.clusterPatterns(numClusters);
          return jsonResponse(200, clusters);
        }
        break;
      
      // =======================================================================
      // Behavioral Anomaly
      // =======================================================================
      case 'anomaly':
        if (subResource === 'events' && httpMethod === 'GET') {
          const options = {
            userId: queryStringParameters?.userId,
            severity: queryStringParameters?.severity,
            status: queryStringParameters?.status,
            limit: parseInt(queryStringParameters?.limit || '100'),
          };
          const events = await behavioralAnomalyService.getAnomalyEvents(tenantId, options);
          return jsonResponse(200, events);
        }
        if (subResource === 'events' && resourceId && httpMethod === 'PATCH') {
          const { status, notes } = JSON.parse(body || '{}');
          await behavioralAnomalyService.updateAnomalyStatus(tenantId, resourceId, status, userId, notes);
          return jsonResponse(200, { success: true });
        }
        if (subResource === 'baseline' && httpMethod === 'GET') {
          const targetUserId = queryStringParameters?.userId;
          if (!targetUserId) {
            return jsonResponse(400, { error: 'userId required' });
          }
          const baseline = await behavioralAnomalyService.getUserBaseline(tenantId, targetUserId);
          return jsonResponse(200, baseline);
        }
        if (subResource === 'config' && httpMethod === 'GET') {
          const config = await behavioralAnomalyService.getAnomalyConfig(tenantId);
          return jsonResponse(200, config);
        }
        break;
      
      // =======================================================================
      // Drift Detection
      // =======================================================================
      case 'drift':
        if (subResource === 'detect' && httpMethod === 'POST') {
          const { modelId, metrics } = JSON.parse(body || '{}');
          const report = await driftDetectionService.detectDrift(tenantId, modelId, metrics);
          return jsonResponse(200, report);
        }
        if (subResource === 'history' && httpMethod === 'GET') {
          const modelId = queryStringParameters?.modelId;
          const days = parseInt(queryStringParameters?.days || '30');
          const history = await driftDetectionService.getDriftHistory(tenantId, modelId, days);
          return jsonResponse(200, history);
        }
        if (subResource === 'config' && httpMethod === 'GET') {
          const config = await driftDetectionService.getDriftConfig(tenantId);
          return jsonResponse(200, config);
        }
        if (subResource === 'benchmark' && httpMethod === 'POST') {
          const { modelId, benchmarkName, testCases } = JSON.parse(body || '{}');
          const result = await driftDetectionService.runQualityBenchmark(tenantId, modelId, benchmarkName, testCases);
          return jsonResponse(200, result);
        }
        break;
      
      // =======================================================================
      // Inverse Propensity Scoring
      // =======================================================================
      case 'ips':
        if (subResource === 'ranking' && httpMethod === 'POST') {
          const { domainId, candidateModels } = JSON.parse(body || '{}');
          const ranking = await inversePropensityService.getIPSCorrectedRanking(tenantId, domainId, candidateModels);
          return jsonResponse(200, ranking);
        }
        if (subResource === 'estimates' && httpMethod === 'GET') {
          const domainId = queryStringParameters?.domainId || '';
          const estimates = await inversePropensityService.calculateIPSEstimates(tenantId, domainId);
          return jsonResponse(200, estimates);
        }
        if (subResource === 'bias-report' && httpMethod === 'GET') {
          const domainId = queryStringParameters?.domainId;
          const report = await inversePropensityService.getSelectionBiasReport(tenantId, domainId);
          return jsonResponse(200, report);
        }
        if (subResource === 'config' && httpMethod === 'GET') {
          const config = await inversePropensityService.getIPSConfig(tenantId);
          return jsonResponse(200, config);
        }
        break;
      
      // =======================================================================
      // Datasets
      // =======================================================================
      case 'datasets':
        if (httpMethod === 'GET' && !subResource) {
          const datasets = datasetImporterService.getAvailableDatasets();
          return jsonResponse(200, datasets);
        }
        if (subResource === 'stats' && httpMethod === 'GET') {
          const stats = await datasetImporterService.getImportStats();
          return jsonResponse(200, stats);
        }
        if (subResource === 'import' && httpMethod === 'POST') {
          const { dataset, data } = JSON.parse(body || '{}');
          let result;
          switch (dataset) {
            case 'harmbench':
              result = await datasetImporterService.importHarmBench(data);
              break;
            case 'wildjailbreak':
              result = await datasetImporterService.importWildJailbreak(data);
              break;
            case 'toxicchat':
              result = await datasetImporterService.importToxicChat(data);
              break;
            case 'jailbreakbench':
              result = await datasetImporterService.importJailbreakBench(data);
              break;
            default:
              return jsonResponse(400, { error: `Unknown dataset: ${dataset}` });
          }
          return jsonResponse(200, result);
        }
        if (subResource === 'seed-categories' && httpMethod === 'POST') {
          const count = await datasetImporterService.seedHarmCategories();
          return jsonResponse(200, { seeded: count });
        }
        break;
      
      // =======================================================================
      // Alerts
      // =======================================================================
      case 'alerts':
        if (httpMethod === 'GET' && !subResource) {
          const options = {
            limit: parseInt(queryStringParameters?.limit || '100'),
            severity: queryStringParameters?.severity,
          };
          const alerts = await securityAlertService.getAlertHistory(tenantId, options);
          return jsonResponse(200, alerts);
        }
        if (subResource === 'config' && httpMethod === 'GET') {
          const config = await securityAlertService.getAlertConfig(tenantId);
          return jsonResponse(200, config);
        }
        if (subResource === 'config' && httpMethod === 'PUT') {
          const config = JSON.parse(body || '{}');
          await securityAlertService.updateAlertConfig(tenantId, config);
          return jsonResponse(200, { success: true });
        }
        if (subResource === 'test' && httpMethod === 'POST') {
          const { channel } = JSON.parse(body || '{}');
          const result = await securityAlertService.testAlert(tenantId, channel);
          return jsonResponse(200, result);
        }
        if (subResource === 'send' && httpMethod === 'POST') {
          const alert = JSON.parse(body || '{}');
          const result = await securityAlertService.sendAlert(tenantId, alert);
          return jsonResponse(200, result);
        }
        break;
      
      // =======================================================================
      // Attack Generation
      // =======================================================================
      case 'attacks':
        if (subResource === 'probes' && httpMethod === 'GET') {
          const probes = attackGeneratorService.getAvailableProbes();
          return jsonResponse(200, probes);
        }
        if (subResource === 'strategies' && httpMethod === 'GET') {
          const strategies = attackGeneratorService.getAvailableStrategies();
          return jsonResponse(200, strategies);
        }
        if (subResource === 'generate' && httpMethod === 'POST') {
          const { technique, count, options } = JSON.parse(body || '{}');
          const attacks = await attackGeneratorService.generateAttacks(technique, count, options);
          return jsonResponse(200, attacks);
        }
        if (subResource === 'garak' && httpMethod === 'POST') {
          const { probes, targetModelId, options } = JSON.parse(body || '{}');
          const results = await attackGeneratorService.runGarakCampaign(tenantId, probes, targetModelId, options);
          return jsonResponse(200, results);
        }
        if (subResource === 'pyrit' && httpMethod === 'POST') {
          const { strategy, seedPrompts, options } = JSON.parse(body || '{}');
          const result = await attackGeneratorService.runPyRITCampaign(tenantId, strategy, seedPrompts, options);
          return jsonResponse(200, result);
        }
        if (subResource === 'tap' && httpMethod === 'POST') {
          const { seedBehavior, depth, branchingFactor } = JSON.parse(body || '{}');
          const attacks = await attackGeneratorService.generateTAPAttacks(seedBehavior, depth, branchingFactor);
          return jsonResponse(200, attacks);
        }
        if (subResource === 'pair' && httpMethod === 'POST') {
          const { targetBehavior, maxIterations } = JSON.parse(body || '{}');
          const attacks = await attackGeneratorService.generatePAIRAttacks(targetBehavior, maxIterations);
          return jsonResponse(200, attacks);
        }
        if (subResource === 'import' && httpMethod === 'POST') {
          const { attacks, autoActivate } = JSON.parse(body || '{}');
          const result = await attackGeneratorService.importToPatterns(tenantId, attacks, { autoActivate });
          return jsonResponse(200, result);
        }
        if (subResource === 'stats' && httpMethod === 'GET') {
          const stats = await attackGeneratorService.getGenerationStats(tenantId);
          return jsonResponse(200, stats);
        }
        break;
      
      // =======================================================================
      // Feedback
      // =======================================================================
      case 'feedback':
        if (subResource === 'classification' && httpMethod === 'POST') {
          const feedback = JSON.parse(body || '{}');
          const feedbackId = await classificationFeedbackService.submitFeedback({
            ...feedback,
            tenantId,
            submittedBy: userId,
          });
          return jsonResponse(200, { feedbackId });
        }
        if (subResource === 'pattern' && httpMethod === 'POST') {
          const feedback = JSON.parse(body || '{}');
          const feedbackId = await classificationFeedbackService.submitPatternFeedback(tenantId, {
            ...feedback,
            submittedBy: userId,
          });
          return jsonResponse(200, { feedbackId });
        }
        if (subResource === 'stats' && httpMethod === 'GET') {
          const days = parseInt(queryStringParameters?.days || '30');
          const stats = await classificationFeedbackService.getFeedbackStats(tenantId, days);
          return jsonResponse(200, stats);
        }
        if (subResource === 'pending' && httpMethod === 'GET') {
          const options = {
            limit: parseInt(queryStringParameters?.limit || '50'),
            minConfidence: queryStringParameters?.minConfidence ? parseFloat(queryStringParameters.minConfidence) : undefined,
            maxConfidence: queryStringParameters?.maxConfidence ? parseFloat(queryStringParameters.maxConfidence) : undefined,
          };
          const pending = await classificationFeedbackService.getPendingReview(tenantId, options);
          return jsonResponse(200, pending);
        }
        if (subResource === 'candidates' && httpMethod === 'GET') {
          const minCount = parseInt(queryStringParameters?.minCount || '3');
          const candidates = await classificationFeedbackService.getRetrainingCandidates(tenantId, minCount);
          return jsonResponse(200, candidates);
        }
        if (subResource === 'export' && httpMethod === 'GET') {
          const format = (queryStringParameters?.format as 'jsonl' | 'csv') || 'jsonl';
          const data = await classificationFeedbackService.exportTrainingData(tenantId, { format });
          return {
            statusCode: 200,
            headers: {
              'Content-Type': format === 'jsonl' ? 'application/jsonl' : 'text/csv',
              'Content-Disposition': `attachment; filename="training-data.${format}"`,
            },
            body: data,
          };
        }
        if (subResource === 'ineffective-patterns' && httpMethod === 'GET') {
          const minFeedback = parseInt(queryStringParameters?.minFeedback || '5');
          const maxRate = parseFloat(queryStringParameters?.maxRate || '0.3');
          const patterns = await classificationFeedbackService.getIneffectivePatterns(minFeedback, maxRate);
          return jsonResponse(200, patterns);
        }
        if (subResource === 'auto-disable' && httpMethod === 'POST') {
          const options = JSON.parse(body || '{}');
          const result = await classificationFeedbackService.autoDisableIneffectivePatterns(tenantId, options);
          return jsonResponse(200, result);
        }
        break;
      
      // =======================================================================
      // Dashboard
      // =======================================================================
      case 'dashboard':
        if (httpMethod === 'GET') {
          const [
            config,
            classifierStats,
            anomalyConfig,
            driftConfig,
            ipsConfig,
            feedbackStats,
            datasetStats,
          ] = await Promise.all([
            securityProtectionService.getConfig(tenantId),
            constitutionalClassifierService.getClassificationStats(tenantId, 7),
            behavioralAnomalyService.getAnomalyConfig(tenantId),
            driftDetectionService.getDriftConfig(tenantId),
            inversePropensityService.getIPSConfig(tenantId),
            classificationFeedbackService.getFeedbackStats(tenantId, 7),
            datasetImporterService.getImportStats(),
          ]);
          
          return jsonResponse(200, {
            config,
            classifier: classifierStats,
            anomaly: anomalyConfig,
            drift: driftConfig,
            ips: ipsConfig,
            feedback: feedbackStats,
            datasets: datasetStats,
          });
        }
        break;
      
      default:
        return jsonResponse(404, { error: `Unknown resource: ${resource}` });
    }
    
    return jsonResponse(405, { error: 'Method not allowed' });
    
  } catch (error) {
    logger.error('Security API error', { error: String(error), path });
    return jsonResponse(500, { error: 'Internal server error', message: String(error) });
  }
};
