// RADIANT v4.18.0 - Think Tank Consolidated Lambda Handler
// Routes all /api/v2/thinktank/* requests to appropriate sub-handlers

import type { APIGatewayProxyEvent, APIGatewayProxyResult, Context } from 'aws-lambda';

const corsHeaders = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type,Authorization,X-Tenant-ID',
  'Access-Control-Allow-Methods': 'GET,POST,PUT,PATCH,DELETE,OPTIONS',
};

export const handler = async (
  event: APIGatewayProxyEvent,
  context: Context
): Promise<APIGatewayProxyResult> => {
  // Handle CORS preflight
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers: corsHeaders, body: '' };
  }

  const path = event.path;
  const pathParts = path.split('/').filter(Boolean);
  // Path structure: api/v2/thinktank/{resource}/...
  const resource = pathParts[3] || '';

  try {
    // Route based on resource
    switch (resource) {
      // Core Think Tank Features
      case 'conversations': {
        const mod = await import('./conversations.js');
        return mod.handler(event, context);
      }
      case 'users': {
        const mod = await import('./users.js');
        return mod.handler(event, context);
      }
      case 'models': {
        const mod = await import('./models.js');
        return mod.handler(event, context);
      }
      case 'brain-plan': {
        const mod = await import('./brain-plan.js');
        return mod.handler(event, context);
      }
      case 'user-context': {
        const mod = await import('./user-context.js');
        return mod.handler(event, context);
      }
      case 'domain-modes': {
        const mod = await import('./domain-modes.js');
        return mod.handler(event, context);
      }
      case 'model-categories': {
        const mod = await import('./model-categories.js');
        return mod.handler(event, context);
      }
      case 'ratings': {
        const mod = await import('./ratings.js');
        return mod.handler(event, context);
      }

      // Advanced Features
      case 'grimoire': {
        const mod = await import('./grimoire.js');
        return mod.handler(event, context);
      }
      case 'economic-governor': {
        const mod = await import('./economic-governor.js');
        return mod.handler(event, context);
      }
      case 'time-travel': {
        const mod = await import('./time-travel.js');
        return mod.handler(event, context);
      }
      case 'council-of-rivals': {
        const mod = await import('./council-of-rivals.js');
        return mod.handler(event, context);
      }
      case 'concurrent-execution': {
        const mod = await import('./concurrent-execution.js');
        return mod.handler(event, context);
      }
      case 'structure-from-chaos': {
        const mod = await import('./structure-from-chaos.js');
        return mod.handler(event, context);
      }
      case 'sentinel-agents': {
        const mod = await import('./sentinel-agents.js');
        return mod.handler(event, context);
      }
      case 'flash-facts': {
        const mod = await import('./flash-facts.js');
        return mod.handler(event, context);
      }

      // Specialized Features
      case 'liquid-interface': {
        const mod = await import('./liquid-interface.js');
        return mod.handler(event, context);
      }
      case 'reality-engine': {
        const mod = await import('./reality-engine.js');
        return mod.handler(event, context);
      }
      case 'security-signals': {
        const mod = await import('./security-signals.js');
        return mod.handler(event, context);
      }
      case 'policy-framework': {
        const mod = await import('./policy-framework.js');
        return mod.handler(event, context);
      }
      case 'derivation-history': {
        const mod = await import('./derivation-history.js');
        return mod.handler(event, context);
      }
      case 'enhanced-collaboration': {
        const mod = await import('./enhanced-collaboration.js');
        return mod.handler(event, context);
      }
      case 'file-conversion': {
        const mod = await import('./file-conversion.js');
        return mod.handler(event, context);
      }
      case 'ideas': {
        const mod = await import('./ideas.js');
        return mod.handler(event, context);
      }

      // Artifact Engine (also routed separately in CDK)
      case 'artifacts': {
        const mod = await import('./artifact-engine.js');
        return mod.handler(event, context);
      }

      // Analytics, Settings, Rules, Shadow Testing (also in thinktank-admin-api-stack)
      case 'analytics': {
        const mod = await import('./analytics.js');
        return mod.handler(event, context);
      }
      case 'settings': {
        const mod = await import('./settings.js');
        return mod.handler(event, context);
      }
      case 'my-rules': {
        const mod = await import('./my-rules.js');
        return mod.handler(event, context);
      }
      case 'shadow-testing': {
        const mod = await import('./shadow-testing.js');
        return mod.handler(event, context);
      }

      // GDPR & Compliance
      case 'consent': {
        const mod = await import('./consent.js');
        return mod.handler(event, context);
      }
      case 'gdpr': {
        const mod = await import('./gdpr.js');
        return mod.handler(event, context);
      }
      case 'security-config': {
        const mod = await import('./security-config.js');
        return mod.handler(event, context);
      }

      // User Experience
      case 'rejections': {
        const mod = await import('./rejections.js');
        return mod.handler(event, context);
      }
      case 'preferences': {
        const mod = await import('./preferences.js');
        return mod.handler(event, context);
      }
      case 'ui-feedback': {
        const mod = await import('./ui-feedback.js');
        return mod.handler(event, context);
      }
      case 'ui-improvement': {
        const mod = await import('./ui-improvement.js');
        return mod.handler(event, context);
      }
      case 'multipage-apps': {
        const mod = await import('./multipage-apps.js');
        return mod.handler(event, context);
      }

      default:
        return {
          statusCode: 404,
          headers: corsHeaders,
          body: JSON.stringify({
            error: 'Route not found',
            path,
            resource,
            message: `Think Tank resource '${resource}' not found`,
          }),
        };
    }
  } catch (error) {
    console.error('Think Tank handler error:', error);
    
    // Check if it's a module not found error
    if (error instanceof Error && error.message.includes('Cannot find module')) {
      return {
        statusCode: 501,
        headers: corsHeaders,
        body: JSON.stringify({
          error: 'Not Implemented',
          message: `Handler for '${resource}' is not yet implemented`,
        }),
      };
    }

    return {
      statusCode: 500,
      headers: corsHeaders,
      body: JSON.stringify({
        error: 'Internal server error',
        message: error instanceof Error ? error.message : 'Unknown error',
      }),
    };
  }
};
