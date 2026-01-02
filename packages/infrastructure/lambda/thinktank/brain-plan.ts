// RADIANT v4.18.0 - Think Tank Brain Plan API Handler
// Real-time AGI planning endpoints for Think Tank integration

import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { agiBrainPlannerService } from '../shared/services';
import { corsHeaders } from '../shared/middleware/api-response';
import { enhancedLogger as logger } from '../shared/logging/enhanced-logger';

interface User {
  id: string;
  tenantId: string;
}

// Extract user from JWT token
async function getUserFromToken(event: APIGatewayProxyEvent): Promise<User> {
  const authHeader = event.headers.Authorization || event.headers.authorization;
  if (!authHeader) {
    throw new Error('Unauthorized');
  }

  // Decode JWT payload
  const token = authHeader.replace('Bearer ', '');
  const parts = token.split('.');
  if (parts.length !== 3) {
    throw new Error('Invalid token');
  }

  const payload = JSON.parse(Buffer.from(parts[1], 'base64').toString());
  return {
    id: payload.sub,
    tenantId: payload['custom:tenant_id'] || payload.tenant_id || 'default',
  };
}

// POST /api/thinktank/brain-plan/generate - Generate a plan for a prompt
export async function generatePlan(
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  try {
    const user = await getUserFromToken(event);
    const body = JSON.parse(event.body || '{}');

    if (!body.prompt) {
      return {
        statusCode: 400,
        headers: corsHeaders,
        body: JSON.stringify({ error: 'prompt is required' }),
      };
    }

    const plan = await agiBrainPlannerService.generatePlan({
      prompt: body.prompt,
      tenantId: user.tenantId,
      userId: user.id,
      sessionId: body.sessionId,
      conversationId: body.conversationId,
      preferredMode: body.preferredMode,
      preferredModel: body.preferredModel,
      maxLatencyMs: body.maxLatencyMs,
      maxCostCents: body.maxCostCents,
      enableConsciousness: body.enableConsciousness ?? true,
      enableEthicsCheck: body.enableEthicsCheck ?? true,
      enableVerification: body.enableVerification ?? true,
      enableLearning: body.enableLearning ?? true,
      domainOverride: body.domainOverride,
    });

    // Transform to display format
    const display = transformPlanToDisplay(plan);

    return {
      statusCode: 200,
      headers: corsHeaders,
      body: JSON.stringify({
        plan,
        display,
      }),
    };
  } catch (error) {
    logger.error('Failed to generate brain plan', error instanceof Error ? error : undefined);
    return {
      statusCode: 500,
      headers: corsHeaders,
      body: JSON.stringify({ error: 'Failed to generate plan' }),
    };
  }
}

// GET /api/thinktank/brain-plan/:planId - Get a specific plan
export async function getPlan(
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  try {
    await getUserFromToken(event);
    const planId = event.pathParameters?.planId;

    if (!planId) {
      return {
        statusCode: 400,
        headers: corsHeaders,
        body: JSON.stringify({ error: 'planId is required' }),
      };
    }

    const plan = await agiBrainPlannerService.getPlan(planId);

    if (!plan) {
      return {
        statusCode: 404,
        headers: corsHeaders,
        body: JSON.stringify({ error: 'Plan not found' }),
      };
    }

    const display = transformPlanToDisplay(plan);

    return {
      statusCode: 200,
      headers: corsHeaders,
      body: JSON.stringify({
        plan,
        display,
      }),
    };
  } catch (error) {
    logger.error('Failed to get brain plan', error instanceof Error ? error : undefined);
    return {
      statusCode: 500,
      headers: corsHeaders,
      body: JSON.stringify({ error: 'Failed to get plan' }),
    };
  }
}

// POST /api/thinktank/brain-plan/:planId/execute - Start executing a plan
export async function executePlan(
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  try {
    await getUserFromToken(event);
    const planId = event.pathParameters?.planId;

    if (!planId) {
      return {
        statusCode: 400,
        headers: corsHeaders,
        body: JSON.stringify({ error: 'planId is required' }),
      };
    }

    const plan = await agiBrainPlannerService.startExecution(planId);
    const display = transformPlanToDisplay(plan);

    return {
      statusCode: 200,
      headers: corsHeaders,
      body: JSON.stringify({
        plan,
        display,
      }),
    };
  } catch (error) {
    logger.error('Failed to execute brain plan', error instanceof Error ? error : undefined);
    return {
      statusCode: 500,
      headers: corsHeaders,
      body: JSON.stringify({ error: 'Failed to execute plan' }),
    };
  }
}

// PATCH /api/thinktank/brain-plan/:planId/step/:stepId - Update step status
export async function updateStep(
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  try {
    await getUserFromToken(event);
    const planId = event.pathParameters?.planId;
    const stepId = event.pathParameters?.stepId;
    const body = JSON.parse(event.body || '{}');

    if (!planId || !stepId) {
      return {
        statusCode: 400,
        headers: corsHeaders,
        body: JSON.stringify({ error: 'planId and stepId are required' }),
      };
    }

    const step = await agiBrainPlannerService.updateStepStatus(
      planId,
      stepId,
      body.status,
      body.output
    );

    if (!step) {
      return {
        statusCode: 404,
        headers: corsHeaders,
        body: JSON.stringify({ error: 'Step not found' }),
      };
    }

    return {
      statusCode: 200,
      headers: corsHeaders,
      body: JSON.stringify({ step }),
    };
  } catch (error) {
    logger.error('Failed to update step', error instanceof Error ? error : undefined);
    return {
      statusCode: 500,
      headers: corsHeaders,
      body: JSON.stringify({ error: 'Failed to update step' }),
    };
  }
}

// POST /api/thinktank/brain-plan/:planId/evaluate-safety - Evaluate response through Cato Safety Pipeline
export async function evaluateSafety(
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  try {
    await getUserFromToken(event);
    const planId = event.pathParameters?.planId;
    const body = JSON.parse(event.body || '{}');

    if (!planId) {
      return {
        statusCode: 400,
        headers: corsHeaders,
        body: JSON.stringify({ error: 'planId is required' }),
      };
    }

    if (!body.generatedResponse) {
      return {
        statusCode: 400,
        headers: corsHeaders,
        body: JSON.stringify({ error: 'generatedResponse is required' }),
      };
    }

    // Run through Cato Safety Pipeline
    const safetyResult = await agiBrainPlannerService.evaluateSafety(
      planId,
      body.generatedResponse
    );

    return {
      statusCode: 200,
      headers: corsHeaders,
      body: JSON.stringify({
        allowed: safetyResult.allowed,
        blockedBy: safetyResult.blockedBy,
        recommendation: safetyResult.recommendation,
        retryWithContext: safetyResult.retryWithContext,
        allowedGamma: safetyResult.allowedGamma,
        effectivePersona: safetyResult.effectivePersona,
      }),
    };
  } catch (error) {
    logger.error('Failed to evaluate safety', error instanceof Error ? error : undefined);
    return {
      statusCode: 500,
      headers: corsHeaders,
      body: JSON.stringify({ error: 'Failed to evaluate safety' }),
    };
  }
}

// GET /api/thinktank/brain-plan/recent - Get recent plans for user
export async function getRecentPlans(
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  try {
    const user = await getUserFromToken(event);
    const limit = parseInt(event.queryStringParameters?.limit || '10', 10);

    const plans = await agiBrainPlannerService.getRecentPlans(
      user.tenantId,
      user.id,
      limit
    );

    return {
      statusCode: 200,
      headers: corsHeaders,
      body: JSON.stringify({
        plans: plans.map(p => ({
          planId: p.planId,
          status: p.status,
          orchestrationMode: p.orchestrationMode,
          promptSummary: p.prompt.substring(0, 100) + (p.prompt.length > 100 ? '...' : ''),
          createdAt: p.createdAt,
          completedAt: p.completedAt,
          totalDurationMs: p.totalDurationMs,
          stepsTotal: p.steps.length,
          stepsCompleted: p.steps.filter(s => s.status === 'completed').length,
        })),
      }),
    };
  } catch (error) {
    logger.error('Failed to get recent plans', error instanceof Error ? error : undefined);
    return {
      statusCode: 500,
      headers: corsHeaders,
      body: JSON.stringify({ error: 'Failed to get recent plans' }),
    };
  }
}

// Transform plan to display format for UI
function transformPlanToDisplay(plan: Awaited<ReturnType<typeof agiBrainPlannerService.generatePlan>>) {
  const modeDescriptions: Record<string, string> = {
    thinking: 'Standard reasoning mode',
    extended_thinking: 'Deep multi-step reasoning with extended thinking',
    coding: 'Optimized for code generation and debugging',
    creative: 'Enhanced creativity and imagination',
    research: 'Research synthesis with citations',
    analysis: 'Quantitative analysis and data processing',
    multi_model: 'Consulting multiple AI models for consensus',
    chain_of_thought: 'Explicit step-by-step reasoning',
    self_consistency: 'Multiple samples for consistency check',
  };

  const stepIcons: Record<string, string> = {
    analyze: '🔍',
    detect_domain: '🧭',
    select_model: '🤖',
    prepare_context: '📚',
    ethics_check: '⚖️',
    generate: '✨',
    synthesize: '🔗',
    verify: '✅',
    refine: '💎',
    calibrate: '🎯',
    reflect: '🪞',
  };

  const statusIcons: Record<string, string> = {
    pending: '⏳',
    in_progress: '🔄',
    completed: '✅',
    skipped: '⏭️',
    failed: '❌',
  };

  const completedSteps = plan.steps.filter(s => s.status === 'completed').length;
  const elapsed = plan.startedAt
    ? Math.round((Date.now() - new Date(plan.startedAt).getTime()) / 1000)
    : 0;
  const remaining = plan.estimatedDurationMs
    ? Math.max(0, Math.round((plan.estimatedDurationMs / 1000) - elapsed))
    : 0;

  return {
    planId: plan.planId,
    status: plan.status,
    statusMessage: getStatusMessage(plan.status),
    mode: plan.orchestrationMode,
    modeDescription: modeDescriptions[plan.orchestrationMode] || plan.orchestrationMode,
    modeSelection: plan.orchestrationSelection,  // 'auto' or 'user'
    modeReason: plan.orchestrationReason,

    // Summary
    promptSummary: plan.prompt.length > 100 
      ? plan.prompt.substring(0, 100) + '...' 
      : plan.prompt,
    complexity: plan.promptAnalysis.complexity,
    estimatedTime: formatDuration(plan.estimatedDurationMs),
    estimatedCost: `$${(plan.estimatedCostCents / 100).toFixed(4)}`,

    // Domain
    domain: plan.domainDetection ? {
      icon: plan.domainDetection.domainIcon,
      name: plan.domainDetection.domainName,
      field: plan.domainDetection.fieldName,
      confidence: `${Math.round(plan.domainDetection.confidence * 100)}%`,
    } : undefined,

    // Model
    model: {
      name: plan.primaryModel.modelName,
      provider: plan.primaryModel.provider,
      reason: plan.primaryModel.selectionReason,
    },

    // Steps
    steps: plan.steps.map((step, index) => ({
      stepNumber: step.stepNumber,
      icon: stepIcons[step.stepType] || '📋',
      title: step.title,
      description: step.description,
      status: step.status,
      statusIcon: statusIcons[step.status] || '❓',
      isActive: index === plan.currentStepIndex && plan.status === 'executing',
      details: getStepDetails(step),
      model: step.selectedModel,
      domain: step.detectedDomain?.domainName,
      duration: step.durationMs ? formatDuration(step.durationMs) : undefined,
      confidence: step.confidence ? `${Math.round(step.confidence * 100)}%` : undefined,
    })),
    currentStep: plan.currentStepIndex,
    totalSteps: plan.steps.length,
    completedSteps,

    // Timing
    elapsed: elapsed > 0 ? formatDuration(elapsed * 1000) : undefined,
    remaining: remaining > 0 ? formatDuration(remaining * 1000) : undefined,

    // Plan Summary (shown before execution)
    summary: plan.planSummary ? {
      headline: plan.planSummary.headline,
      approach: plan.planSummary.approach,
      stepsOverview: plan.planSummary.stepsOverview,
      expectedOutcome: plan.planSummary.expectedOutcome,
      estimatedTime: plan.planSummary.estimatedTime,
      confidenceStatement: plan.planSummary.confidenceStatement,
      warnings: plan.planSummary.warnings,
    } : undefined,
  };
}

function getStatusMessage(status: string): string {
  const messages: Record<string, string> = {
    planning: 'Analyzing your request...',
    ready: 'Plan ready - click to execute',
    executing: 'Working on your request...',
    completed: 'Response complete',
    failed: 'An error occurred',
    cancelled: 'Request cancelled',
  };
  return messages[status] || status;
}

function getStepDetails(step: Awaited<ReturnType<typeof agiBrainPlannerService.generatePlan>>['steps'][0]): string[] {
  const details: string[] = [];

  if (step.servicesInvolved.length > 0) {
    details.push(`Services: ${step.servicesInvolved.join(', ')}`);
  }
  if (step.selectedModel) {
    details.push(`Model: ${step.selectedModel}`);
  }
  if (step.detectedDomain) {
    details.push(`Domain: ${step.detectedDomain.domainName}`);
  }
  if (step.confidence) {
    details.push(`Confidence: ${Math.round(step.confidence * 100)}%`);
  }

  return details;
}

function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  return `${(ms / 60000).toFixed(1)}m`;
}

// Lambda handler router
export async function handler(
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  const path = event.path;
  const method = event.httpMethod;

  // POST /api/thinktank/brain-plan/generate
  if (method === 'POST' && path.endsWith('/generate')) {
    return generatePlan(event);
  }

  // GET /api/thinktank/brain-plan/recent
  if (method === 'GET' && path.endsWith('/recent')) {
    return getRecentPlans(event);
  }

  // GET /api/thinktank/brain-plan/:planId
  if (method === 'GET' && path.match(/\/brain-plan\/[^/]+$/)) {
    return getPlan(event);
  }

  // POST /api/thinktank/brain-plan/:planId/execute
  if (method === 'POST' && path.endsWith('/execute')) {
    return executePlan(event);
  }

  // PATCH /api/thinktank/brain-plan/:planId/step/:stepId
  if (method === 'PATCH' && path.includes('/step/')) {
    return updateStep(event);
  }

  // POST /api/thinktank/brain-plan/:planId/evaluate-safety
  if (method === 'POST' && path.endsWith('/evaluate-safety')) {
    return evaluateSafety(event);
  }

  return {
    statusCode: 404,
    headers: corsHeaders,
    body: JSON.stringify({ error: 'Not found' }),
  };
}
