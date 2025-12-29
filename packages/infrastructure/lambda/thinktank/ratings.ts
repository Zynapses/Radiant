// RADIANT v4.18.19 - Think Tank Bipolar Ratings API
// Novel rating system with -5 to +5 scale for explicit dissatisfaction capture

import { APIGatewayProxyHandler, APIGatewayProxyResult } from 'aws-lambda';
import { bipolarRatingService } from '../shared/services/bipolar-rating.service';
import { enhancedLogger as logger } from '../shared/logging/enhanced-logger';
import type { BipolarRatingValue, RatingDimension, RatingReason, QuickRating } from '@radiant/shared';

// ============================================================================
// Helper Functions
// ============================================================================

function response(statusCode: number, body: unknown): APIGatewayProxyResult {
  return {
    statusCode,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Content-Type,Authorization',
    },
    body: JSON.stringify(body),
  };
}

function extractAuth(event: { headers?: Record<string, string | undefined> }): { tenantId: string; userId: string } {
  // In production, extract from JWT token
  const tenantId = event.headers?.['x-tenant-id'] || '';
  const userId = event.headers?.['x-user-id'] || '';
  return { tenantId, userId };
}

// ============================================================================
// API Handler
// ============================================================================

export const handler: APIGatewayProxyHandler = async (event) => {
  const method = event.httpMethod;
  const path = event.path.replace('/api/thinktank/ratings', '').replace(/^\//, '');
  const { tenantId, userId } = extractAuth(event);
  
  if (!tenantId) {
    return response(401, { error: 'Unauthorized', message: 'Missing tenant ID' });
  }
  
  logger.info('Ratings API request', { method, path, tenantId });
  
  try {
    // ========================================================================
    // POST /submit - Submit a bipolar rating
    // ========================================================================
    if (method === 'POST' && path === 'submit') {
      const body = JSON.parse(event.body || '{}');
      const { targetType, targetId, value, dimension, reasons, feedback, conversationId, sessionId } = body;
      
      if (!targetType || !targetId || value === undefined) {
        return response(400, { error: 'Bad Request', message: 'targetType, targetId, and value are required' });
      }
      
      if (value < -5 || value > 5) {
        return response(400, { error: 'Bad Request', message: 'Rating value must be between -5 and +5' });
      }
      
      const result = await bipolarRatingService.submitRating(tenantId, userId, {
        targetType,
        targetId,
        value: value as BipolarRatingValue,
        dimension: dimension as RatingDimension,
        reasons: reasons as RatingReason[],
        feedback,
        conversationId,
        sessionId,
      });
      
      return response(201, {
        success: true,
        rating: result,
        message: result.learningCandidateCreated 
          ? 'Rating submitted and flagged for learning'
          : 'Rating submitted successfully',
      });
    }
    
    // ========================================================================
    // POST /quick - Submit a quick rating (terrible/bad/meh/good/amazing)
    // ========================================================================
    if (method === 'POST' && path === 'quick') {
      const body = JSON.parse(event.body || '{}');
      const { targetType, targetId, quickRating, conversationId } = body;
      
      if (!targetType || !targetId || !quickRating) {
        return response(400, { error: 'Bad Request', message: 'targetType, targetId, and quickRating are required' });
      }
      
      const validQuickRatings = ['terrible', 'bad', 'meh', 'good', 'amazing'];
      if (!validQuickRatings.includes(quickRating)) {
        return response(400, { 
          error: 'Bad Request', 
          message: `quickRating must be one of: ${validQuickRatings.join(', ')}` 
        });
      }
      
      const result = await bipolarRatingService.submitQuickRating(
        tenantId,
        userId,
        targetType,
        targetId,
        quickRating as QuickRating,
        conversationId
      );
      
      return response(201, {
        success: true,
        rating: result,
        quickRatingUsed: quickRating,
      });
    }
    
    // ========================================================================
    // POST /multi - Submit multi-dimension ratings
    // ========================================================================
    if (method === 'POST' && path === 'multi') {
      const body = JSON.parse(event.body || '{}');
      const { targetType, targetId, ratings, reasons, feedback, conversationId } = body;
      
      if (!targetType || !targetId || !ratings) {
        return response(400, { error: 'Bad Request', message: 'targetType, targetId, and ratings are required' });
      }
      
      const results = await bipolarRatingService.submitMultiDimensionRating(
        tenantId,
        userId,
        targetType,
        targetId,
        ratings as Partial<Record<RatingDimension, BipolarRatingValue>>,
        reasons as RatingReason[],
        feedback,
        conversationId
      );
      
      return response(201, {
        success: true,
        ratings: results,
        dimensionsRated: Object.keys(ratings),
      });
    }
    
    // ========================================================================
    // GET /target/:targetId - Get ratings for a target
    // ========================================================================
    if (method === 'GET' && path.startsWith('target/')) {
      const targetId = path.replace('target/', '');
      
      const ratings = await bipolarRatingService.getRatingsForTarget(tenantId, targetId);
      
      // Calculate summary
      const values = ratings.map(r => r.value);
      const avgRating = values.length > 0 ? values.reduce((a, b) => a + b, 0) / values.length : 0;
      const positiveCount = values.filter(v => v > 0).length;
      const negativeCount = values.filter(v => v < 0).length;
      
      return response(200, {
        targetId,
        ratings,
        summary: {
          count: ratings.length,
          averageRating: avgRating,
          positiveCount,
          negativeCount,
          netSentimentScore: ratings.length > 0 
            ? Math.round(((positiveCount - negativeCount) / ratings.length) * 100)
            : 0,
        },
      });
    }
    
    // ========================================================================
    // GET /my - Get current user's ratings
    // ========================================================================
    if (method === 'GET' && path === 'my') {
      const limit = parseInt(event.queryStringParameters?.limit || '50', 10);
      
      const ratings = await bipolarRatingService.getUserRatings(tenantId, userId, limit);
      const pattern = await bipolarRatingService.getUserRatingPattern(tenantId, userId);
      
      return response(200, {
        ratings,
        pattern,
        totalCount: ratings.length,
      });
    }
    
    // ========================================================================
    // GET /analytics - Get rating analytics
    // ========================================================================
    if (method === 'GET' && path === 'analytics') {
      const period = (event.queryStringParameters?.period || 'month') as 'day' | 'week' | 'month' | 'all';
      const targetType = event.queryStringParameters?.targetType;
      const modelId = event.queryStringParameters?.modelId;
      
      const analytics = await bipolarRatingService.getAnalytics(tenantId, period, targetType, modelId);
      
      return response(200, analytics);
    }
    
    // ========================================================================
    // GET /analytics/model/:modelId - Get model-specific analytics
    // ========================================================================
    if (method === 'GET' && path.startsWith('analytics/model/')) {
      const modelId = path.replace('analytics/model/', '');
      const period = (event.queryStringParameters?.period || 'month') as 'day' | 'week' | 'month' | 'all';
      
      const analytics = await bipolarRatingService.getModelAnalytics(tenantId, modelId, period);
      
      return response(200, analytics);
    }
    
    // ========================================================================
    // GET /dashboard - Get admin dashboard
    // ========================================================================
    if (method === 'GET' && path === 'dashboard') {
      const dashboard = await bipolarRatingService.getDashboard(tenantId);
      
      return response(200, dashboard);
    }
    
    // ========================================================================
    // GET /scale - Get rating scale information (for UI)
    // ========================================================================
    if (method === 'GET' && path === 'scale') {
      return response(200, {
        type: 'bipolar',
        min: -5,
        max: 5,
        neutral: 0,
        scale: [
          { value: -5, label: 'Harmful', emoji: '😠', color: '#ef4444', description: 'Made things worse' },
          { value: -4, label: 'Very Bad', emoji: '😡', color: '#f87171', description: 'Significantly unhelpful' },
          { value: -3, label: 'Bad', emoji: '😕', color: '#f97316', description: 'Unhelpful or misleading' },
          { value: -2, label: 'Poor', emoji: '😒', color: '#fb923c', description: 'Below expectations' },
          { value: -1, label: 'Slightly Bad', emoji: '😐', color: '#fbbf24', description: 'Minor issues' },
          { value: 0, label: 'Neutral', emoji: '😶', color: '#6b7280', description: 'No strong opinion' },
          { value: 1, label: 'Slightly Good', emoji: '🙂', color: '#a3e635', description: 'Met basic expectations' },
          { value: 2, label: 'Okay', emoji: '😊', color: '#84cc16', description: 'Somewhat helpful' },
          { value: 3, label: 'Good', emoji: '😀', color: '#22c55e', description: 'Helpful response' },
          { value: 4, label: 'Very Good', emoji: '😃', color: '#10b981', description: 'Very helpful' },
          { value: 5, label: 'Amazing', emoji: '🤩', color: '#8b5cf6', description: 'Exceptional, exceeded expectations' },
        ],
        quickRatings: [
          { value: 'terrible', bipolarValue: -5, label: '😠 Terrible', color: '#ef4444' },
          { value: 'bad', bipolarValue: -3, label: '😕 Bad', color: '#f97316' },
          { value: 'meh', bipolarValue: 0, label: '😐 Meh', color: '#6b7280' },
          { value: 'good', bipolarValue: 3, label: '🙂 Good', color: '#22c55e' },
          { value: 'amazing', bipolarValue: 5, label: '🤩 Amazing', color: '#8b5cf6' },
        ],
        dimensions: [
          { key: 'overall', label: 'Overall Quality' },
          { key: 'accuracy', label: 'Factual Accuracy' },
          { key: 'helpfulness', label: 'Helpfulness' },
          { key: 'clarity', label: 'Clarity' },
          { key: 'completeness', label: 'Completeness' },
          { key: 'speed', label: 'Response Time' },
          { key: 'tone', label: 'Tone & Style' },
          { key: 'creativity', label: 'Creativity' },
        ],
        reasons: {
          negative: [
            { key: 'incorrect_information', label: 'Incorrect information' },
            { key: 'misunderstood_question', label: 'Misunderstood my question' },
            { key: 'incomplete_answer', label: 'Incomplete answer' },
            { key: 'too_verbose', label: 'Too verbose' },
            { key: 'too_brief', label: 'Too brief' },
            { key: 'wrong_tone', label: 'Wrong tone' },
            { key: 'off_topic', label: 'Off topic' },
            { key: 'harmful_content', label: 'Harmful content' },
            { key: 'wasted_time', label: 'Wasted my time' },
            { key: 'made_things_worse', label: 'Made things worse' },
          ],
          positive: [
            { key: 'solved_problem', label: 'Solved my problem' },
            { key: 'learned_something', label: 'I learned something' },
            { key: 'saved_time', label: 'Saved me time' },
            { key: 'exceeded_expectations', label: 'Exceeded expectations' },
            { key: 'creative_solution', label: 'Creative solution' },
            { key: 'perfect_explanation', label: 'Perfect explanation' },
            { key: 'great_code', label: 'Great code' },
            { key: 'helpful_examples', label: 'Helpful examples' },
          ],
        },
      });
    }
    
    // ========================================================================
    // Not Found
    // ========================================================================
    return response(404, { error: 'Not Found', message: `Unknown endpoint: ${method} ${path}` });
    
  } catch (error) {
    logger.error('Ratings API error', { error, method, path });
    return response(500, { 
      error: 'Internal Server Error', 
      message: error instanceof Error ? error.message : 'Unknown error' 
    });
  }
};
