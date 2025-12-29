/**
 * RADIANT v4.18.19 - Bipolar Rating System Types
 * 
 * Novel rating system that allows negative ratings (-5 to +5)
 * Unlike traditional 5-star systems where "1 star" is ambiguous,
 * negative ratings explicitly capture dissatisfaction.
 * 
 * Scale:
 *   -5 = Harmful / Completely wrong / Made things worse
 *   -3 = Unhelpful / Misleading / Wasted my time
 *   -1 = Slightly unhelpful / Minor issues
 *    0 = Neutral / No strong opinion
 *   +1 = Slightly helpful / Met basic expectations
 *   +3 = Helpful / Good response
 *   +5 = Exceptional / Exceeded expectations / Delightful
 */

// ============================================================================
// Core Types
// ============================================================================

/**
 * Bipolar rating value: -5 to +5
 * Negative = dissatisfaction, Zero = neutral, Positive = satisfaction
 */
export type BipolarRatingValue = -5 | -4 | -3 | -2 | -1 | 0 | 1 | 2 | 3 | 4 | 5;

/**
 * Sentiment derived from rating
 */
export type RatingSentiment = 'negative' | 'neutral' | 'positive';

/**
 * Rating intensity level
 */
export type RatingIntensity = 'extreme' | 'strong' | 'mild' | 'neutral';

/**
 * What aspect of the response is being rated
 */
export type RatingDimension = 
  | 'overall'           // Overall quality
  | 'accuracy'          // Factual correctness
  | 'helpfulness'       // Did it solve the problem?
  | 'clarity'           // Was it easy to understand?
  | 'completeness'      // Was anything missing?
  | 'speed'             // Response time satisfaction
  | 'tone'              // Communication style
  | 'creativity';       // Novel/interesting approach

/**
 * Context about why the rating was given
 */
export type RatingReason =
  // Negative reasons
  | 'incorrect_information'
  | 'misunderstood_question'
  | 'incomplete_answer'
  | 'too_verbose'
  | 'too_brief'
  | 'wrong_tone'
  | 'off_topic'
  | 'harmful_content'
  | 'wasted_time'
  | 'made_things_worse'
  // Positive reasons
  | 'solved_problem'
  | 'learned_something'
  | 'saved_time'
  | 'exceeded_expectations'
  | 'creative_solution'
  | 'perfect_explanation'
  | 'great_code'
  | 'helpful_examples'
  // Neutral
  | 'no_specific_reason'
  | 'other';

// ============================================================================
// Rating Interfaces
// ============================================================================

export interface BipolarRating {
  ratingId: string;
  tenantId: string;
  userId: string;
  
  // What is being rated
  targetType: 'response' | 'plan' | 'conversation' | 'model' | 'feature';
  targetId: string;  // responseId, planId, conversationId, etc.
  
  // The rating itself
  value: BipolarRatingValue;
  dimension: RatingDimension;
  
  // Derived fields
  sentiment: RatingSentiment;
  intensity: RatingIntensity;
  
  // Optional context
  reasons?: RatingReason[];
  feedback?: string;  // Free-form feedback
  
  // Metadata
  conversationId?: string;
  sessionId?: string;
  modelUsed?: string;
  domainDetected?: string;
  promptComplexity?: string;
  responseTimeMs?: number;
  
  // Timestamps
  createdAt: string;
  updatedAt?: string;
}

export interface BipolarRatingInput {
  targetType: BipolarRating['targetType'];
  targetId: string;
  value: BipolarRatingValue;
  dimension?: RatingDimension;  // Defaults to 'overall'
  reasons?: RatingReason[];
  feedback?: string;
  conversationId?: string;
  sessionId?: string;
}

export interface MultiDimensionRating {
  overall: BipolarRatingValue;
  dimensions?: Partial<Record<RatingDimension, BipolarRatingValue>>;
  reasons?: RatingReason[];
  feedback?: string;
}

// ============================================================================
// Analytics Types
// ============================================================================

export interface RatingAnalytics {
  tenantId: string;
  period: 'day' | 'week' | 'month' | 'all';
  periodStart: string;
  periodEnd: string;
  
  // Core metrics
  totalRatings: number;
  averageRating: number;  // -5 to +5
  
  // Sentiment breakdown
  sentimentDistribution: {
    negative: number;  // Count of ratings < 0
    neutral: number;   // Count of ratings = 0
    positive: number;  // Count of ratings > 0
  };
  
  // Net Sentiment Score (like NPS but for satisfaction)
  // = (positive% - negative%) * 100, ranges from -100 to +100
  netSentimentScore: number;
  
  // Distribution by value
  ratingDistribution: Record<BipolarRatingValue, number>;
  
  // By dimension
  dimensionAverages: Partial<Record<RatingDimension, number>>;
  
  // Top reasons
  topPositiveReasons: Array<{ reason: RatingReason; count: number }>;
  topNegativeReasons: Array<{ reason: RatingReason; count: number }>;
  
  // Trends
  trend: 'improving' | 'stable' | 'declining';
  trendPercentage: number;
}

export interface ModelRatingAnalytics extends RatingAnalytics {
  modelId: string;
  modelName: string;
  
  // Compare to other models
  rankAmongModels: number;
  totalModels: number;
  
  // Specific insights
  strengthDimensions: RatingDimension[];
  weaknessDimensions: RatingDimension[];
}

export interface UserRatingPattern {
  userId: string;
  
  // User's rating tendencies
  averageRating: number;
  ratingVariance: number;
  totalRatings: number;
  
  // Is this user a harsh or generous rater?
  raterType: 'harsh' | 'balanced' | 'generous';
  
  // Calibrated rating (adjusted for user tendency)
  calibrationFactor: number;
}

// ============================================================================
// Quick Rating UI Types
// ============================================================================

/**
 * Simplified rating for quick feedback
 * Maps to bipolar values under the hood
 */
export type QuickRating = 
  | 'terrible'    // -5
  | 'bad'         // -3
  | 'meh'         // 0
  | 'good'        // +3
  | 'amazing';    // +5

export const QUICK_RATING_VALUES: Record<QuickRating, BipolarRatingValue> = {
  terrible: -5,
  bad: -3,
  meh: 0,
  good: 3,
  amazing: 5,
};

export const QUICK_RATING_LABELS: Record<QuickRating, string> = {
  terrible: '😠 Terrible',
  bad: '😕 Bad',
  meh: '😐 Meh',
  good: '🙂 Good',
  amazing: '🤩 Amazing',
};

export const QUICK_RATING_COLORS: Record<QuickRating, string> = {
  terrible: '#ef4444',  // red-500
  bad: '#f97316',       // orange-500
  meh: '#6b7280',       // gray-500
  good: '#22c55e',      // green-500
  amazing: '#8b5cf6',   // violet-500
};

// ============================================================================
// Helper Functions (pure, no side effects)
// ============================================================================

export function getSentiment(value: BipolarRatingValue): RatingSentiment {
  if (value < 0) return 'negative';
  if (value > 0) return 'positive';
  return 'neutral';
}

export function getIntensity(value: BipolarRatingValue): RatingIntensity {
  const abs = Math.abs(value);
  if (abs === 0) return 'neutral';
  if (abs <= 2) return 'mild';
  if (abs <= 4) return 'strong';
  return 'extreme';
}

export function calculateNetSentimentScore(ratings: BipolarRatingValue[]): number {
  if (ratings.length === 0) return 0;
  
  const positive = ratings.filter(r => r > 0).length;
  const negative = ratings.filter(r => r < 0).length;
  const total = ratings.length;
  
  return Math.round(((positive - negative) / total) * 100);
}

export function bipolarToStars(value: BipolarRatingValue): number {
  // Convert -5 to +5 → 1 to 5 stars for legacy compatibility
  return Math.round((value + 5) / 2) + 1;
}

export function starsToBipolar(stars: number): BipolarRatingValue {
  // Convert 1-5 stars → -5 to +5
  const bipolar = (stars - 1) * 2 - 5;
  return Math.max(-5, Math.min(5, bipolar)) as BipolarRatingValue;
}

export function quickRatingToBipolar(quick: QuickRating): BipolarRatingValue {
  return QUICK_RATING_VALUES[quick];
}

export function bipolarToQuickRating(value: BipolarRatingValue): QuickRating {
  if (value <= -4) return 'terrible';
  if (value <= -1) return 'bad';
  if (value <= 1) return 'meh';
  if (value <= 3) return 'good';
  return 'amazing';
}
