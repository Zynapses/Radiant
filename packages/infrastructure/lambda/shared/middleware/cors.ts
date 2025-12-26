/**
 * CORS Middleware
 */

import { APIGatewayProxyEvent, Context } from 'aws-lambda';
import { Middleware, MiddlewareHandler } from './index';

interface CorsOptions {
  origins?: string[] | '*';
  methods?: string[];
  headers?: string[];
  credentials?: boolean;
  maxAge?: number;
}

const DEFAULT_OPTIONS: CorsOptions = {
  origins: '*',
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  headers: [
    'Content-Type',
    'Authorization',
    'X-Api-Key',
    'X-Request-Id',
    'X-Radiant-SDK',
    'X-Radiant-SDK-Version',
  ],
  credentials: true,
  maxAge: 86400, // 24 hours
};

/**
 * CORS middleware
 */
export function corsMiddleware(options: CorsOptions = {}): Middleware {
  const config = { ...DEFAULT_OPTIONS, ...options };

  return (next: MiddlewareHandler): MiddlewareHandler => {
    return async (event: APIGatewayProxyEvent, context: Context) => {
      const origin = event.headers['Origin'] || event.headers['origin'];
      
      // Determine allowed origin
      let allowedOrigin: string | null = null;
      
      if (config.origins === '*') {
        allowedOrigin = '*';
      } else if (Array.isArray(config.origins) && origin) {
        if (config.origins.includes(origin)) {
          allowedOrigin = origin;
        }
      }

      // CORS headers
      const corsHeaders: Record<string, string> = {};
      
      if (allowedOrigin) {
        corsHeaders['Access-Control-Allow-Origin'] = allowedOrigin;
      }
      
      if (config.credentials && allowedOrigin !== '*') {
        corsHeaders['Access-Control-Allow-Credentials'] = 'true';
      }

      // Handle preflight OPTIONS request
      if (event.httpMethod === 'OPTIONS') {
        return {
          statusCode: 204,
          headers: {
            ...corsHeaders,
            'Access-Control-Allow-Methods': config.methods!.join(', '),
            'Access-Control-Allow-Headers': config.headers!.join(', '),
            'Access-Control-Max-Age': String(config.maxAge),
          },
          body: '',
        };
      }

      // Process request and add CORS headers to response
      const response = await next(event, context);

      return {
        ...response,
        headers: {
          ...response.headers,
          ...corsHeaders,
        },
      };
    };
  };
}
