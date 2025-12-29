// Enhanced Feedback Types
// 5-star rating system with comments for Think Tank

// ============================================================================
// FEEDBACK TYPES
// ============================================================================

export type FeedbackType = 'thumbs' | 'star_rating';

export type ThumbsFeedback = 'up' | 'down';

export type StarRating = 1 | 2 | 3 | 4 | 5;

export type FeedbackSource = 
  | 'think_tank'      // Think Tank app
  | 'api'             // Direct API call
  | 'admin_dashboard' // Admin review
  | 'automated';      // System-generated

export type FeedbackCategory =
  | 'accuracy'        // Was the information correct?
  | 'helpfulness'     // Was it useful?
  | 'clarity'         // Was it easy to understand?
  | 'completeness'    // Did it fully answer the question?
  | 'tone'            // Was the tone appropriate?
  | 'speed'           // Response time satisfaction
  | 'overall';        // General rating

// ============================================================================
// FEEDBACK ENTITIES
// ============================================================================

export interface ResponseFeedback {
  id: string;
  tenantId: string;
  userId: string;
  
  // What's being rated
  conversationId?: string;
  messageId?: string;
  planId?: string;
  responseHash?: string;
  
  // Rating (supports both systems)
  feedbackType: FeedbackType;
  thumbs?: ThumbsFeedback;
  starRating?: StarRating;
  
  // Detailed ratings (optional)
  categoryRatings?: {
    accuracy?: StarRating;
    helpfulness?: StarRating;
    clarity?: StarRating;
    completeness?: StarRating;
    tone?: StarRating;
  };
  
  // Comments
  comment?: string;
  commentCategories?: FeedbackCategory[]; // What the comment is about
  
  // Context
  source: FeedbackSource;
  modelUsed?: string;
  orchestrationMode?: string;
  domainId?: string;
  promptLength?: number;
  responseLength?: number;
  
  // Metadata
  createdAt: Date;
  updatedAt?: Date;
}

export interface FeedbackSummary {
  totalFeedback: number;
  
  // Thumbs summary
  thumbsUp: number;
  thumbsDown: number;
  thumbsRatio: number; // up / total
  
  // Star rating summary
  totalStarRatings: number;
  averageStarRating: number;
  starDistribution: {
    1: number;
    2: number;
    3: number;
    4: number;
    5: number;
  };
  
  // Category averages
  categoryAverages?: {
    accuracy?: number;
    helpfulness?: number;
    clarity?: number;
    completeness?: number;
    tone?: number;
  };
  
  // Comment stats
  totalWithComments: number;
  recentComments: {
    comment: string;
    rating: StarRating;
    createdAt: Date;
  }[];
}

// ============================================================================
// FEEDBACK REQUEST/RESPONSE
// ============================================================================

export interface ResponseFeedbackRequest {
  // What's being rated
  conversationId?: string;
  messageId?: string;
  planId?: string;
  
  // Rating (one of these required)
  thumbs?: ThumbsFeedback;
  starRating?: StarRating;
  
  // Optional detailed ratings
  categoryRatings?: {
    accuracy?: StarRating;
    helpfulness?: StarRating;
    clarity?: StarRating;
    completeness?: StarRating;
    tone?: StarRating;
  };
  
  // Optional comment
  comment?: string;
  commentCategories?: FeedbackCategory[];
  
  // Context (auto-filled if not provided)
  modelUsed?: string;
  orchestrationMode?: string;
  domainId?: string;
}

export interface SubmitFeedbackResponse {
  feedbackId: string;
  success: boolean;
  message?: string;
  
  // Updated summary after this feedback
  updatedSummary?: {
    averageRating: number;
    totalRatings: number;
  };
}

export interface GetFeedbackRequest {
  // Filters
  conversationId?: string;
  messageId?: string;
  planId?: string;
  userId?: string;
  modelUsed?: string;
  orchestrationMode?: string;
  domainId?: string;
  
  // Rating filters
  minRating?: StarRating;
  maxRating?: StarRating;
  hasComment?: boolean;
  
  // Pagination
  limit?: number;
  offset?: number;
  
  // Time range
  startDate?: Date;
  endDate?: Date;
}

// ============================================================================
// FEEDBACK CONFIGURATION
// ============================================================================

export interface FeedbackConfig {
  // Display settings
  defaultFeedbackType: FeedbackType; // 'star_rating' for Think Tank
  showCategoryRatings: boolean;
  showCommentBox: boolean;
  commentRequired: boolean; // Require comment for low ratings?
  commentRequiredThreshold: StarRating; // e.g., 2 = require comment for 1-2 stars
  
  // Star rating labels (customizable)
  starLabels: {
    1: string; // "Poor"
    2: string; // "Fair"
    3: string; // "Good"
    4: string; // "Very Good"
    5: string; // "Excellent"
  };
  
  // Category settings
  enabledCategories: FeedbackCategory[];
  
  // Prompts
  feedbackPromptDelay: number; // ms before showing feedback prompt
  showFeedbackPrompt: boolean;
  feedbackPromptText: string;
}

export const DEFAULT_FEEDBACK_CONFIG: FeedbackConfig = {
  defaultFeedbackType: 'star_rating',
  showCategoryRatings: false,
  showCommentBox: true,
  commentRequired: false,
  commentRequiredThreshold: 2,
  
  starLabels: {
    1: 'Poor',
    2: 'Fair',
    3: 'Good',
    4: 'Very Good',
    5: 'Excellent',
  },
  
  enabledCategories: ['accuracy', 'helpfulness', 'overall'],
  
  feedbackPromptDelay: 3000,
  showFeedbackPrompt: true,
  feedbackPromptText: 'How was this response?',
};

// ============================================================================
// FEEDBACK ANALYTICS
// ============================================================================

export interface FeedbackAnalytics {
  // Time-based trends
  dailyAverages: {
    date: string;
    avgRating: number;
    totalRatings: number;
  }[];
  
  // Model performance
  modelPerformance: {
    modelId: string;
    avgRating: number;
    totalRatings: number;
    thumbsUpRatio: number;
  }[];
  
  // Mode performance
  modePerformance: {
    mode: string;
    avgRating: number;
    totalRatings: number;
  }[];
  
  // Domain performance
  domainPerformance: {
    domainId: string;
    domainName: string;
    avgRating: number;
    totalRatings: number;
  }[];
  
  // Common issues (from comments)
  commonIssues: {
    category: FeedbackCategory;
    count: number;
    avgRating: number;
  }[];
}

// ============================================================================
// CONSTANTS
// ============================================================================

export const STAR_RATING_VALUES: StarRating[] = [1, 2, 3, 4, 5];

export const FEEDBACK_CATEGORY_LABELS: Record<FeedbackCategory, string> = {
  accuracy: 'Accuracy',
  helpfulness: 'Helpfulness',
  clarity: 'Clarity',
  completeness: 'Completeness',
  tone: 'Tone',
  speed: 'Response Speed',
  overall: 'Overall',
};

export const STAR_EMOJI: Record<StarRating, string> = {
  1: '⭐',
  2: '⭐⭐',
  3: '⭐⭐⭐',
  4: '⭐⭐⭐⭐',
  5: '⭐⭐⭐⭐⭐',
};
