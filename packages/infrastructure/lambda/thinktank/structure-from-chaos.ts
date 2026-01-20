/**
 * Structure from Chaos Synthesis API Handler
 * 
 * Moat #20: AI transforms whiteboard chaos → structured decisions, data, project plans.
 * Think Tank differentiation vs Miro/Mural.
 */

import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { Logger } from '@aws-lambda-powertools/logger';
import { v4 as uuidv4 } from 'uuid';
import { structureFromChaosService } from '../shared/services/structure-from-chaos.service';
import { ChaoticInput, ChaoticInputType, StructuredOutputType } from '@radiant/shared';

const logger = new Logger({ serviceName: 'structure-from-chaos-api' });

export async function handler(
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  const tenantId = event.requestContext.authorizer?.tenantId;
  const userId = event.requestContext.authorizer?.userId;

  if (!tenantId || !userId) {
    return {
      statusCode: 401,
      body: JSON.stringify({ error: 'Unauthorized' }),
    };
  }

  const path = event.path.replace('/api/thinktank/chaos', '');
  const method = event.httpMethod;

  try {
    // GET /config - Get configuration
    if (path === '/config' && method === 'GET') {
      const config = await structureFromChaosService.getConfig(tenantId);
      return {
        statusCode: 200,
        body: JSON.stringify(config),
      };
    }

    // PUT /config - Update configuration
    if (path === '/config' && method === 'PUT') {
      const updates = JSON.parse(event.body || '{}');
      const config = await structureFromChaosService.updateConfig(tenantId, updates);
      return {
        statusCode: 200,
        body: JSON.stringify(config),
      };
    }

    // POST /synthesize - Synthesize chaotic input into structured output
    if (path === '/synthesize' && method === 'POST') {
      const body = JSON.parse(event.body || '{}');
      
      const input: ChaoticInput = {
        id: uuidv4(),
        tenantId,
        userId,
        sessionId: body.sessionId,
        inputType: body.inputType as ChaoticInputType || 'mixed',
        rawContent: body.content,
        attachments: body.attachments,
        context: body.context,
        createdAt: new Date(),
      };

      const outputTypes: StructuredOutputType[] = body.outputTypes || ['meeting_summary'];

      const result = await structureFromChaosService.synthesize({
        input,
        outputTypes,
        options: body.options,
      });

      return {
        statusCode: 200,
        body: JSON.stringify(result),
      };
    }

    // POST /extract/actions - Extract action items
    if (path === '/extract/actions' && method === 'POST') {
      const body = JSON.parse(event.body || '{}');
      
      const input: ChaoticInput = {
        id: uuidv4(),
        tenantId,
        userId,
        sessionId: body.sessionId,
        inputType: body.inputType as ChaoticInputType || 'mixed',
        rawContent: body.content,
        createdAt: new Date(),
      };

      const actions = await structureFromChaosService.extractActionItems(input);
      return {
        statusCode: 200,
        body: JSON.stringify({ actions }),
      };
    }

    // POST /extract/decisions - Extract decisions
    if (path === '/extract/decisions' && method === 'POST') {
      const body = JSON.parse(event.body || '{}');
      
      const input: ChaoticInput = {
        id: uuidv4(),
        tenantId,
        userId,
        sessionId: body.sessionId,
        inputType: body.inputType as ChaoticInputType || 'mixed',
        rawContent: body.content,
        createdAt: new Date(),
      };

      const decisions = await structureFromChaosService.extractDecisions(input);
      return {
        statusCode: 200,
        body: JSON.stringify({ decisions }),
      };
    }

    // POST /extract/questions - Extract questions
    if (path === '/extract/questions' && method === 'POST') {
      const body = JSON.parse(event.body || '{}');
      
      const input: ChaoticInput = {
        id: uuidv4(),
        tenantId,
        userId,
        sessionId: body.sessionId,
        inputType: body.inputType as ChaoticInputType || 'mixed',
        rawContent: body.content,
        createdAt: new Date(),
      };

      const questions = await structureFromChaosService.extractQuestions(input);
      return {
        statusCode: 200,
        body: JSON.stringify({ questions }),
      };
    }

    // POST /project-plan - Generate project plan
    if (path === '/project-plan' && method === 'POST') {
      const body = JSON.parse(event.body || '{}');
      
      const input: ChaoticInput = {
        id: uuidv4(),
        tenantId,
        userId,
        sessionId: body.sessionId,
        inputType: body.inputType as ChaoticInputType || 'mixed',
        rawContent: body.content,
        attachments: body.attachments,
        context: body.context,
        createdAt: new Date(),
      };

      const projectPlan = await structureFromChaosService.generateProjectPlan(input);
      return {
        statusCode: 200,
        body: JSON.stringify(projectPlan),
      };
    }

    // POST /whiteboard/parse - Parse whiteboard elements
    if (path === '/whiteboard/parse' && method === 'POST') {
      const body = JSON.parse(event.body || '{}');
      const clusters = await structureFromChaosService.parseWhiteboard(body.elements || []);
      return {
        statusCode: 200,
        body: JSON.stringify({ clusters }),
      };
    }

    // GET /metrics - Get metrics
    if (path === '/metrics' && method === 'GET') {
      const period = event.queryStringParameters?.period || 'day';
      const metrics = await structureFromChaosService.getMetrics(tenantId, period);
      return {
        statusCode: 200,
        body: JSON.stringify(metrics),
      };
    }

    return {
      statusCode: 404,
      body: JSON.stringify({ error: 'Not found' }),
    };
  } catch (error) {
    logger.error('Error in structure from chaos handler', { error });
    return {
      statusCode: 500,
      body: JSON.stringify({ error: (error as Error).message }),
    };
  }
}
