/**
 * RADIANT v4.18.0 — Intrusion Detection Middleware
 *
 * Lightweight middleware that feeds every API request into the
 * ThreatDetectionEngine for real-time analysis. Designed for <5ms overhead.
 *
 * Standards: NIST SP 800-94 (inline IDPS), NIST CSF DE.CM-01
 */

import { APIGatewayProxyEvent, APIGatewayProxyResult, Context } from 'aws-lambda';
import { Middleware, MiddlewareHandler } from './index';
import {
  threatDetectionEngine,
  RequestSignal,
  DetectionResult,
} from '../services/intrusion-detection.service';
import { registerAllDetectors } from '../services/intrusion-detectors';
import { createRegisteredLogger } from '../services/logging-registry.service';

const logger = createRegisteredLogger({
  serviceName: 'middleware/intrusion-detection',
  category: 'security',
  sourceType: 'application',
});

// Register detectors once per Lambda cold start
let detectorsRegistered = false;

function ensureDetectorsRegistered(): void {
  if (detectorsRegistered) return;
  registerAllDetectors();
  detectorsRegistered = true;
}

interface AuthenticatedEvent extends APIGatewayProxyEvent {
  auth?: {
    tenantId?: string;
    userId?: string;
    sessionId?: string;
  };
}

/**
 * Extract geo information from CloudFront headers (if available)
 */
function extractGeoFromHeaders(headers: Record<string, string | undefined>): {
  geoCountry?: string;
  geoCity?: string;
  geoLat?: number;
  geoLon?: number;
} {
  // CloudFront adds these headers when configured
  const country = headers['cloudfront-viewer-country'] || headers['CloudFront-Viewer-Country'];
  const city = headers['cloudfront-viewer-city'] || headers['CloudFront-Viewer-City'];
  const lat = headers['cloudfront-viewer-latitude'] || headers['CloudFront-Viewer-Latitude'];
  const lon = headers['cloudfront-viewer-longitude'] || headers['CloudFront-Viewer-Longitude'];

  return {
    geoCountry: country || undefined,
    geoCity: city ? decodeURIComponent(city) : undefined,
    geoLat: lat ? parseFloat(lat) : undefined,
    geoLon: lon ? parseFloat(lon) : undefined,
  };
}

/**
 * Build a RequestSignal from an API Gateway event
 */
function buildSignal(
  event: APIGatewayProxyEvent,
  response: APIGatewayProxyResult | null,
  authSuccess?: boolean,
): RequestSignal {
  const authEvent = event as AuthenticatedEvent;
  const headers = (event.headers || {}) as Record<string, string | undefined>;
  const geo = extractGeoFromHeaders(headers);

  return {
    requestId: event.requestContext?.requestId || '',
    timestamp: new Date(),
    sourceIp: event.requestContext?.identity?.sourceIp || 'unknown',
    method: event.httpMethod || 'GET',
    path: event.path || '/',
    statusCode: response?.statusCode,
    userAgent: headers['user-agent'] || headers['User-Agent'] || undefined,
    tenantId: authEvent.auth?.tenantId,
    userId: authEvent.auth?.userId,
    sessionId: authEvent.auth?.sessionId,
    authSuccess,
    responseBytes: response?.body ? Buffer.byteLength(response.body) : undefined,
    body: event.body ? event.body.substring(0, 2000) : undefined, // Cap at 2KB for analysis
    geoCountry: geo.geoCountry,
    geoCity: geo.geoCity,
    geoLat: geo.geoLat,
    geoLon: geo.geoLon,
  };
}

/**
 * Check if any detection result requires blocking the request
 */
function shouldBlockRequest(results: DetectionResult[]): DetectionResult | null {
  for (const r of results) {
    if (r.recommendedActions.includes('block_request') ||
        r.recommendedActions.includes('ban_ip')) {
      return r;
    }
  }
  return null;
}

/**
 * Check if detection results indicate rate limiting needed
 */
function shouldRateLimit(results: DetectionResult[]): boolean {
  return results.some(r => r.recommendedActions.includes('rate_limit'));
}

// ============================================================================
// Middleware: Pre-request analysis
// Analyzes the request BEFORE it reaches the handler.
// If the IP is blocked or injection is detected, returns 403 immediately.
// ============================================================================

export function intrusionDetectionMiddleware(): Middleware {
  return (next: MiddlewareHandler): MiddlewareHandler => {
    return async (event: APIGatewayProxyEvent, context: Context) => {
      ensureDetectorsRegistered();

      // --- PRE-REQUEST ANALYSIS ---
      // Build a partial signal (no response yet) for pre-request checks
      const preSignal = buildSignal(event, null);

      let preResults: DetectionResult[] = [];
      try {
        preResults = await threatDetectionEngine.processSignal(preSignal);
      } catch (err) {
        // Never block legitimate traffic due to detection engine errors
        logger.error('Pre-request intrusion detection failed', err as Error);
      }

      // Block if IP is banned or injection detected
      const blockResult = shouldBlockRequest(preResults);
      if (blockResult) {
        logger.warn('Request blocked by intrusion detection', {
          detector: blockResult.detectorId,
          ip: preSignal.sourceIp,
          path: preSignal.path,
          severity: blockResult.severity,
        });

        return {
          statusCode: 403,
          headers: {
            'Content-Type': 'application/json',
            'X-RIDPS-Blocked': 'true',
          },
          body: JSON.stringify({
            error: {
              code: 'request_blocked',
              message: 'Request denied by security policy.',
            },
          }),
        };
      }

      // --- EXECUTE HANDLER ---
      const response = await next(event, context);

      // --- POST-REQUEST ANALYSIS ---
      // Build full signal with response data for post-request analysis
      const postSignal = buildSignal(event, response, response.statusCode !== 401);

      // Fire-and-forget post-analysis to avoid adding latency
      threatDetectionEngine.processSignal(postSignal).catch(err => {
        logger.error('Post-request intrusion detection failed', err as Error);
      });

      // Add rate limit headers if detection triggered rate limiting
      if (shouldRateLimit(preResults)) {
        response.headers = {
          ...response.headers,
          'X-RIDPS-RateLimit': 'applied',
        };
      }

      return response;
    };
  };
}

// ============================================================================
// Standalone helper: check if an IP is currently blocked
// (for use outside middleware, e.g., WebSocket connections)
// ============================================================================

export async function isIpBlocked(ip: string, tenantId?: string): Promise<boolean> {
  ensureDetectorsRegistered();
  const signal: RequestSignal = {
    requestId: 'ip-check',
    timestamp: new Date(),
    sourceIp: ip,
    method: 'CHECK',
    path: '/ip-check',
    tenantId,
  };

  const results = await threatDetectionEngine.processSignal(signal);
  return results.some(r => r.detectorId === 'ip_blocklist');
}
