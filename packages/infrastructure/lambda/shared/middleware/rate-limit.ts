/**
 * Rate Limiting Middleware
 */

import { APIGatewayProxyEvent, Context } from 'aws-lambda';
import { Middleware, MiddlewareHandler } from './index';

interface RateLimitConfig {
  windowMs: number;
  maxRequests: number;
  keyGenerator?: (event: APIGatewayProxyEvent) => string;
  skipSuccessfulRequests?: boolean;
  skipFailedRequests?: boolean;
}

// In-memory store (for Lambda, use Redis in production)
const requestCounts: Map<string, { count: number; resetAt: number }> = new Map();

/**
 * Rate limiting middleware
 */
export function rateLimitMiddleware(config: RateLimitConfig): Middleware {
  const {
    windowMs = 60000,
    maxRequests = 100,
    keyGenerator = defaultKeyGenerator,
    skipSuccessfulRequests = false,
    skipFailedRequests = false,
  } = config;

  return (next: MiddlewareHandler): MiddlewareHandler => {
    return async (event: APIGatewayProxyEvent, context: Context) => {
      const key = keyGenerator(event);
      const now = Date.now();

      // Get or create rate limit entry
      let entry = requestCounts.get(key);
      if (!entry || entry.resetAt < now) {
        entry = { count: 0, resetAt: now + windowMs };
        requestCounts.set(key, entry);
      }

      // Check if rate limit exceeded
      if (entry.count >= maxRequests) {
        const retryAfter = Math.ceil((entry.resetAt - now) / 1000);
        
        return {
          statusCode: 429,
          headers: {
            'Content-Type': 'application/json',
            'Retry-After': String(retryAfter),
            'X-RateLimit-Limit': String(maxRequests),
            'X-RateLimit-Remaining': '0',
            'X-RateLimit-Reset': String(Math.ceil(entry.resetAt / 1000)),
          },
          body: JSON.stringify({
            error: {
              code: 'rate_limit_exceeded',
              message: 'Too many requests. Please try again later.',
              retry_after: retryAfter,
            },
          }),
        };
      }

      // Increment counter
      entry.count++;

      // Add rate limit headers
      const response = await next(event, context);

      // Skip counting based on config
      if (skipSuccessfulRequests && response.statusCode < 400) {
        entry.count--;
      }
      if (skipFailedRequests && response.statusCode >= 400) {
        entry.count--;
      }

      // Add rate limit headers to response
      response.headers = {
        ...response.headers,
        'X-RateLimit-Limit': String(maxRequests),
        'X-RateLimit-Remaining': String(Math.max(0, maxRequests - entry.count)),
        'X-RateLimit-Reset': String(Math.ceil(entry.resetAt / 1000)),
      };

      return response;
    };
  };
}

interface AuthenticatedEvent extends APIGatewayProxyEvent {
  auth?: { tenantId?: string };
}

function defaultKeyGenerator(event: APIGatewayProxyEvent): string {
  // Use tenant ID if authenticated, otherwise use IP
  const tenantId = (event as AuthenticatedEvent).auth?.tenantId;
  if (tenantId) {
    return `tenant:${tenantId}`;
  }

  const ip = event.requestContext.identity?.sourceIp || 'unknown';
  return `ip:${ip}`;
}

/**
 * Tier-based rate limit configuration
 */
export const TIER_RATE_LIMITS: Record<string, RateLimitConfig> = {
  free: {
    windowMs: 60000,
    maxRequests: 10,
  },
  starter: {
    windowMs: 60000,
    maxRequests: 50,
  },
  professional: {
    windowMs: 60000,
    maxRequests: 100,
  },
  business: {
    windowMs: 60000,
    maxRequests: 500,
  },
  enterprise: {
    windowMs: 60000,
    maxRequests: 2000,
  },
};

/**
 * Get rate limit config for a tier
 */
export function getRateLimitForTier(tier: string): RateLimitConfig {
  return TIER_RATE_LIMITS[tier] || TIER_RATE_LIMITS.starter;
}
