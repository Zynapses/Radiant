// AGI Ideas API Handler
// Typeahead suggestions and result ideas endpoints

import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { agiIdeasService } from '../shared/services/agi-ideas.service';
import type { TypeaheadRequest, GenerateIdeasRequest } from '@radiant/shared';

const headers = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
};

/**
 * GET /api/thinktank/ideas/typeahead
 * Get typeahead suggestions as user types
 */
export async function getTypeaheadSuggestions(
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  try {
    const userId = event.requestContext.authorizer?.claims?.sub;
    if (!userId) {
      return { statusCode: 401, headers, body: JSON.stringify({ error: 'Unauthorized' }) };
    }

    const params = event.queryStringParameters || {};
    const partialPrompt = params.q || params.prompt || '';
    const cursorPosition = parseInt(params.cursor || '0') || partialPrompt.length;
    const domainHint = params.domain;
    const maxSuggestions = parseInt(params.max || '5');

    if (!partialPrompt) {
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ suggestions: [], processingTimeMs: 0 }),
      };
    }

    const request: TypeaheadRequest = {
      partialPrompt,
      cursorPosition,
      userId,
      sessionId: params.session,
      domainHint,
      maxSuggestions,
    };

    const response = await agiIdeasService.getTypeaheadSuggestions(request);

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify(response),
    };
  } catch (error) {
    console.error('Typeahead error:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: 'Failed to get suggestions' }),
    };
  }
}

/**
 * POST /api/thinktank/ideas/generate
 * Generate ideas to show with a response
 */
export async function generateIdeas(
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  try {
    const userId = event.requestContext.authorizer?.claims?.sub;
    const tenantId = event.requestContext.authorizer?.claims?.tenant_id;
    
    if (!userId || !tenantId) {
      return { statusCode: 401, headers, body: JSON.stringify({ error: 'Unauthorized' }) };
    }

    const body: GenerateIdeasRequest = JSON.parse(event.body || '{}');

    if (!body.responseText || !body.promptText) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'responseText and promptText are required' }),
      };
    }

    const result = await agiIdeasService.generateResultIdeas(
      body.responseText,
      body.promptText,
      body.orchestrationMode || 'thinking',
      userId,
      tenantId,
      {
        domainId: body.domainId,
        maxIdeas: body.maxIdeas,
      }
    );

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify(result),
    };
  } catch (error) {
    console.error('Generate ideas error:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: 'Failed to generate ideas' }),
    };
  }
}

/**
 * POST /api/thinktank/ideas/click
 * Record that user clicked on an idea
 */
export async function recordIdeaClick(
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  try {
    const body = JSON.parse(event.body || '{}');
    const ideaId = body.ideaId;

    if (!ideaId) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'ideaId is required' }),
      };
    }

    await agiIdeasService.recordIdeaClick(ideaId);

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ success: true }),
    };
  } catch (error) {
    console.error('Record click error:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: 'Failed to record click' }),
    };
  }
}

/**
 * POST /api/thinktank/ideas/select
 * Record that user selected a typeahead suggestion
 */
export async function recordSuggestionSelection(
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  try {
    const body = JSON.parse(event.body || '{}');
    const { logId, selectedId } = body;

    if (!logId || !selectedId) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'logId and selectedId are required' }),
      };
    }

    await agiIdeasService.recordSuggestionSelection(logId, selectedId);

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ success: true }),
    };
  } catch (error) {
    console.error('Record selection error:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: 'Failed to record selection' }),
    };
  }
}

/**
 * Main handler - route based on path
 */
export async function handler(
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  const path = event.path;
  const method = event.httpMethod;

  // GET /api/thinktank/ideas/typeahead
  if (method === 'GET' && path.endsWith('/typeahead')) {
    return getTypeaheadSuggestions(event);
  }

  // POST /api/thinktank/ideas/generate
  if (method === 'POST' && path.endsWith('/generate')) {
    return generateIdeas(event);
  }

  // POST /api/thinktank/ideas/click
  if (method === 'POST' && path.endsWith('/click')) {
    return recordIdeaClick(event);
  }

  // POST /api/thinktank/ideas/select
  if (method === 'POST' && path.endsWith('/select')) {
    return recordSuggestionSelection(event);
  }

  return {
    statusCode: 404,
    headers,
    body: JSON.stringify({ error: 'Not found' }),
  };
}
