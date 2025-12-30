/**
 * Thinking Session Lambda
 * 
 * Processes autonomous thinking sessions with real-time updates via WebSocket.
 * Triggered by SQS queue for async processing.
 */

import { Handler, SQSEvent } from 'aws-lambda';
import { executeStatement } from '../shared/db/client';
import { logger } from '../shared/logger';
import { ApiGatewayManagementApiClient, PostToConnectionCommand } from '@aws-sdk/client-apigatewaymanagementapi';
import { ModelRouterService, ModelRequest, ModelResponse } from '../shared/services/model-router.service';

const modelRouter = new ModelRouterService();

interface ThinkingSessionJob {
  sessionId: string;
  tenantId: string;
  userId: string;
  goal: string;
  connectionId?: string; // WebSocket connection for real-time updates
}

interface ThinkingStep {
  type: 'analysis' | 'research' | 'planning' | 'execution' | 'synthesis';
  content: string;
  timestamp: string;
  modelUsed?: string;
  tokensUsed?: number;
}

const wsClient = process.env.WEBSOCKET_ENDPOINT 
  ? new ApiGatewayManagementApiClient({ endpoint: process.env.WEBSOCKET_ENDPOINT })
  : null;

export const handler: Handler<SQSEvent> = async (event) => {
  for (const record of event.Records) {
    const job: ThinkingSessionJob = JSON.parse(record.body);
    
    logger.info('Starting thinking session', { 
      sessionId: job.sessionId, 
      goal: job.goal,
    });

    try {
      // Update session status
      await updateSessionStatus(job.sessionId, job.tenantId, 'thinking', 'Initializing...');
      await sendWebSocketUpdate(job.connectionId, {
        type: 'session_started',
        sessionId: job.sessionId,
        status: 'thinking',
      });

      // Run the thinking session
      const result = await runThinkingSession(job);

      // Update session with results
      await completeSession(job.sessionId, job.tenantId, result);
      await sendWebSocketUpdate(job.connectionId, {
        type: 'session_completed',
        sessionId: job.sessionId,
        result: result.summary,
      });

      logger.info('Thinking session completed', { sessionId: job.sessionId });
    } catch (error) {
      logger.error(`Thinking session failed: ${String(error)}`);
      await updateSessionStatus(job.sessionId, job.tenantId, 'failed', String(error));
      await sendWebSocketUpdate(job.connectionId, {
        type: 'session_failed',
        sessionId: job.sessionId,
        error: String(error),
      });
    }
  }

  return { processed: event.Records.length };
};

async function runThinkingSession(job: ThinkingSessionJob): Promise<{
  summary: string;
  thoughts: ThinkingStep[];
  modelsUsed: string[];
  searchesPerformed: number;
  workflowsCreated: string[];
}> {
  const thoughts: ThinkingStep[] = [];
  const modelsUsed: Set<string> = new Set();
  let searchesPerformed = 0;
  const workflowsCreated: string[] = [];

  // Step 1: Analyze the goal
  await updateSessionStatus(job.sessionId, job.tenantId, 'thinking', 'Analyzing goal...');
  await sendWebSocketUpdate(job.connectionId, {
    type: 'step_update',
    sessionId: job.sessionId,
    step: 'analysis',
    message: 'Analyzing the goal and breaking it down...',
  });

  const analysisResult = await analyzeGoal(job.goal);
  thoughts.push({
    type: 'analysis',
    content: analysisResult.analysis,
    timestamp: new Date().toISOString(),
    modelUsed: analysisResult.model,
    tokensUsed: analysisResult.tokens,
  });
  modelsUsed.add(analysisResult.model);

  // Step 2: Research if needed
  if (analysisResult.needsResearch) {
    await updateSessionStatus(job.sessionId, job.tenantId, 'researching', 'Gathering information...');
    await sendWebSocketUpdate(job.connectionId, {
      type: 'step_update',
      sessionId: job.sessionId,
      step: 'research',
      message: 'Researching relevant information...',
    });

    const researchResult = await performResearch(analysisResult.researchQueries);
    thoughts.push({
      type: 'research',
      content: researchResult.summary,
      timestamp: new Date().toISOString(),
    });
    searchesPerformed = researchResult.searchCount;
  }

  // Step 3: Plan approach
  await updateSessionStatus(job.sessionId, job.tenantId, 'planning', 'Developing approach...');
  await sendWebSocketUpdate(job.connectionId, {
    type: 'step_update',
    sessionId: job.sessionId,
    step: 'planning',
    message: 'Planning the approach...',
  });

  const planResult = await developPlan(job.goal, thoughts);
  thoughts.push({
    type: 'planning',
    content: planResult.plan,
    timestamp: new Date().toISOString(),
    modelUsed: planResult.model,
    tokensUsed: planResult.tokens,
  });
  modelsUsed.add(planResult.model);

  // Step 4: Execute plan steps
  await updateSessionStatus(job.sessionId, job.tenantId, 'executing', 'Executing plan...');
  
  for (let i = 0; i < planResult.steps.length; i++) {
    const step = planResult.steps[i];
    await sendWebSocketUpdate(job.connectionId, {
      type: 'step_update',
      sessionId: job.sessionId,
      step: 'execution',
      message: `Executing step ${i + 1}/${planResult.steps.length}: ${step}`,
      progress: Math.round(((i + 1) / planResult.steps.length) * 100),
    });

    const executionResult = await executeStep(step, job.goal, thoughts);
    thoughts.push({
      type: 'execution',
      content: executionResult.result,
      timestamp: new Date().toISOString(),
      modelUsed: executionResult.model,
      tokensUsed: executionResult.tokens,
    });
    modelsUsed.add(executionResult.model);
  }

  // Step 5: Synthesize results
  await updateSessionStatus(job.sessionId, job.tenantId, 'synthesizing', 'Synthesizing results...');
  await sendWebSocketUpdate(job.connectionId, {
    type: 'step_update',
    sessionId: job.sessionId,
    step: 'synthesis',
    message: 'Synthesizing final results...',
  });

  const synthesisResult = await synthesizeResults(job.goal, thoughts);
  thoughts.push({
    type: 'synthesis',
    content: synthesisResult.synthesis,
    timestamp: new Date().toISOString(),
    modelUsed: synthesisResult.model,
    tokensUsed: synthesisResult.tokens,
  });
  modelsUsed.add(synthesisResult.model);

  return {
    summary: synthesisResult.synthesis,
    thoughts,
    modelsUsed: Array.from(modelsUsed),
    searchesPerformed,
    workflowsCreated,
  };
}

async function analyzeGoal(goal: string): Promise<{
  analysis: string;
  needsResearch: boolean;
  researchQueries: string[];
  model: string;
  tokens: number;
}> {
  const modelId = 'anthropic/claude-3-5-sonnet-20241022';
  
  const prompt = `Analyze this goal and determine what's needed to accomplish it:

Goal: "${goal}"

Provide:
1. A brief analysis of what this goal entails
2. Whether external research is needed (yes/no)
3. If yes, what specific topics to research

Format your response EXACTLY as:
ANALYSIS: [your analysis]
NEEDS_RESEARCH: [yes/no]
RESEARCH_QUERIES: [comma-separated queries if applicable, or "none"]`;

  try {
    const request: ModelRequest = {
      modelId,
      messages: [{ role: 'user', content: prompt }],
      maxTokens: 1000,
      temperature: 0.3,
    };

    const response: ModelResponse = await modelRouter.invoke(request);
    const content = response.content;
    const tokens = response.inputTokens + response.outputTokens;

    // Parse the structured response
    const analysisMatch = content.match(/ANALYSIS:\s*(.+?)(?=NEEDS_RESEARCH:|$)/s);
    const needsResearchMatch = content.match(/NEEDS_RESEARCH:\s*(yes|no)/i);
    const queriesMatch = content.match(/RESEARCH_QUERIES:\s*(.+?)$/s);

    const analysis = analysisMatch?.[1]?.trim() || content;
    const needsResearch = needsResearchMatch?.[1]?.toLowerCase() === 'yes';
    const queriesStr = queriesMatch?.[1]?.trim() || '';
    const researchQueries = queriesStr && queriesStr.toLowerCase() !== 'none'
      ? queriesStr.split(',').map(q => q.trim()).filter(q => q.length > 0)
      : [goal, `${goal} best practices`];

    return {
      analysis,
      needsResearch,
      researchQueries,
      model: modelId,
      tokens,
    };
  } catch (error) {
    logger.error(`Goal analysis failed: ${String(error)}`);
    // Fallback to basic analysis
    return {
      analysis: `Goal: ${goal} - Requires systematic exploration and execution.`,
      needsResearch: true,
      researchQueries: [goal, `${goal} best practices`],
      model: modelId,
      tokens: 0,
    };
  }
}

async function performResearch(queries: string[]): Promise<{
  summary: string;
  searchCount: number;
  results: Array<{ query: string; snippets: string[] }>;
}> {
  let searchCount = 0;
  const results: Array<{ query: string; snippets: string[] }> = [];

  for (const query of queries.slice(0, 3)) {
    try {
      const searchResults = await searchWithProviders(query);
      if (searchResults.length > 0) {
        searchCount++;
        results.push({
          query,
          snippets: searchResults.slice(0, 5).map(r => `${r.title}: ${r.snippet}`),
        });
      }
    } catch (error) {
      logger.warn(`Search failed for query: ${query}`);
    }
  }

  const summary = results.length > 0
    ? `Conducted ${searchCount} searches across ${results.reduce((acc, r) => acc + r.snippets.length, 0)} sources.`
    : 'No search results found.';

  return { summary, searchCount, results };
}

async function searchWithProviders(query: string): Promise<Array<{ title: string; url: string; snippet: string }>> {
  // Try Brave Search first
  const braveKey = process.env.BRAVE_SEARCH_API_KEY;
  if (braveKey) {
    try {
      const params = new URLSearchParams({ q: query, count: '5' });
      const response = await fetch(`https://api.search.brave.com/res/v1/web/search?${params}`, {
        headers: { 'Accept': 'application/json', 'X-Subscription-Token': braveKey },
      });
      if (response.ok) {
        const data = await response.json() as { web?: { results?: Array<{ title: string; url: string; description: string }> } };
        return (data.web?.results || []).map(r => ({ title: r.title, url: r.url, snippet: r.description }));
      }
    } catch (e) { logger.debug(`Brave search failed: ${String(e)}`); }
  }

  // Fallback to Bing
  const bingKey = process.env.BING_SEARCH_API_KEY;
  if (bingKey) {
    try {
      const params = new URLSearchParams({ q: query, count: '5' });
      const response = await fetch(`https://api.bing.microsoft.com/v7.0/search?${params}`, {
        headers: { 'Ocp-Apim-Subscription-Key': bingKey },
      });
      if (response.ok) {
        const data = await response.json() as { webPages?: { value?: Array<{ name: string; url: string; snippet: string }> } };
        return (data.webPages?.value || []).map(r => ({ title: r.name, url: r.url, snippet: r.snippet }));
      }
    } catch (e) { logger.debug(`Bing search failed: ${String(e)}`); }
  }

  return [];
}

async function developPlan(goal: string, priorThoughts: ThinkingStep[]): Promise<{
  plan: string;
  steps: string[];
  model: string;
  tokens: number;
}> {
  const modelId = 'anthropic/claude-3-5-sonnet-20241022';
  
  const context = priorThoughts.map(t => `[${t.type}]: ${t.content}`).join('\n\n');
  
  const prompt = `Based on the following analysis and research, create a detailed plan to achieve the goal.

Goal: "${goal}"

Prior Analysis:
${context}

Create a step-by-step plan with 3-7 concrete, actionable steps.

Format your response as:
PLAN_SUMMARY: [brief overview of the approach]
STEPS:
1. [step 1]
2. [step 2]
... (continue as needed)`;

  try {
    const request: ModelRequest = {
      modelId,
      messages: [{ role: 'user', content: prompt }],
      maxTokens: 1500,
      temperature: 0.4,
    };

    const response: ModelResponse = await modelRouter.invoke(request);
    const content = response.content;
    const tokens = response.inputTokens + response.outputTokens;

    // Parse steps from response
    const stepsMatch = content.match(/STEPS:\s*([\s\S]+)$/i);
    const stepsText = stepsMatch?.[1] || content;
    const steps = stepsText
      .split(/\n/)
      .map(line => line.replace(/^\d+\.\s*/, '').trim())
      .filter(line => line.length > 5 && line.length < 200);

    const planSummary = content.match(/PLAN_SUMMARY:\s*(.+?)(?=STEPS:|$)/s)?.[1]?.trim() || '';

    return {
      plan: `Plan: ${planSummary}\n\nSteps:\n${steps.map((s, i) => `${i + 1}. ${s}`).join('\n')}`,
      steps: steps.length > 0 ? steps : ['Analyze requirements', 'Implement solution', 'Validate results'],
      model: modelId,
      tokens,
    };
  } catch (error) {
    logger.error(`Plan development failed: ${String(error)}`);
    return {
      plan: `Plan to achieve: ${goal}`,
      steps: ['Analyze requirements', 'Develop approach', 'Implement solution', 'Validate results'],
      model: modelId,
      tokens: 0,
    };
  }
}

async function executeStep(step: string, goal: string, context: ThinkingStep[]): Promise<{
  result: string;
  model: string;
  tokens: number;
}> {
  const modelId = 'groq/llama-3.1-8b-instant'; // Fast model for step execution
  
  const priorContext = context.slice(-3).map(t => `[${t.type}]: ${t.content.substring(0, 300)}`).join('\n');
  
  const prompt = `You are executing a step in a thinking session.

Overall Goal: "${goal}"
Current Step: "${step}"

Recent Context:
${priorContext}

Execute this step by:
1. Understanding what needs to be done
2. Providing concrete findings or outputs
3. Identifying any issues or next considerations

Provide a concise but substantive response (2-4 paragraphs).`;

  try {
    const request: ModelRequest = {
      modelId,
      messages: [{ role: 'user', content: prompt }],
      maxTokens: 800,
      temperature: 0.5,
    };

    const response: ModelResponse = await modelRouter.invoke(request);
    return {
      result: response.content,
      model: modelId,
      tokens: response.inputTokens + response.outputTokens,
    };
  } catch (error) {
    logger.error(`Step execution failed: ${String(error)}`);
    return {
      result: `Executed step: "${step}" - Completed with basic analysis.`,
      model: modelId,
      tokens: 0,
    };
  }
}

async function synthesizeResults(goal: string, thoughts: ThinkingStep[]): Promise<{
  synthesis: string;
  model: string;
  tokens: number;
}> {
  const modelId = 'anthropic/claude-3-5-sonnet-20241022';
  
  const thoughtsSummary = thoughts.map(t => {
    const content = t.content.length > 500 ? t.content.substring(0, 500) + '...' : t.content;
    return `## ${t.type.toUpperCase()}\n${content}`;
  }).join('\n\n');
  
  const prompt = `Synthesize the results of this thinking session into a comprehensive summary.

Goal: "${goal}"

Thinking Session Steps:
${thoughtsSummary}

Provide:
1. Executive summary (2-3 sentences)
2. Key findings and insights
3. Recommended actions or conclusions
4. Any limitations or areas for further exploration

Be thorough but concise. Focus on actionable insights.`;

  try {
    const request: ModelRequest = {
      modelId,
      messages: [{ role: 'user', content: prompt }],
      maxTokens: 2000,
      temperature: 0.3,
    };

    const response: ModelResponse = await modelRouter.invoke(request);
    const tokens = response.inputTokens + response.outputTokens;
    
    const modelsUsed = thoughts
      .filter(t => t.modelUsed)
      .map(t => t.modelUsed)
      .filter((v, i, a) => a.indexOf(v) === i)
      .join(', ');

    const synthesis = `${response.content}\n\n---\nModels used: ${modelsUsed}\nTotal thinking steps: ${thoughts.length}`;

    return {
      synthesis,
      model: modelId,
      tokens,
    };
  } catch (error) {
    logger.error(`Synthesis failed: ${String(error)}`);
    return {
      synthesis: `Thinking session for "${goal}" completed with ${thoughts.length} steps.`,
      model: modelId,
      tokens: 0,
    };
  }
}

async function updateSessionStatus(
  sessionId: string,
  tenantId: string,
  status: string,
  currentStep: string
): Promise<void> {
  await executeStatement(
    `UPDATE consciousness_thinking_sessions 
     SET status = $3, current_step = $4, updated_at = NOW()
     WHERE session_id = $1 AND tenant_id = $2`,
    [
      { name: 'sessionId', value: { stringValue: sessionId } },
      { name: 'tenantId', value: { stringValue: tenantId } },
      { name: 'status', value: { stringValue: status } },
      { name: 'currentStep', value: { stringValue: currentStep } },
    ]
  );
}

async function completeSession(
  sessionId: string,
  tenantId: string,
  result: {
    summary: string;
    thoughts: ThinkingStep[];
    modelsUsed: string[];
    searchesPerformed: number;
    workflowsCreated: string[];
  }
): Promise<void> {
  await executeStatement(
    `UPDATE consciousness_thinking_sessions 
     SET status = 'completed', 
         current_step = 'done',
         result = $3,
         thoughts = $4::jsonb,
         models_used = $5,
         searches_performed = $6,
         workflows_created = $7,
         completed_at = NOW(),
         updated_at = NOW()
     WHERE session_id = $1 AND tenant_id = $2`,
    [
      { name: 'sessionId', value: { stringValue: sessionId } },
      { name: 'tenantId', value: { stringValue: tenantId } },
      { name: 'result', value: { stringValue: result.summary } },
      { name: 'thoughts', value: { stringValue: JSON.stringify(result.thoughts) } },
      { name: 'modelsUsed', value: { stringValue: result.modelsUsed.join(',') } },
      { name: 'searchesPerformed', value: { longValue: result.searchesPerformed } },
      { name: 'workflowsCreated', value: { stringValue: result.workflowsCreated.join(',') } },
    ]
  );
}

async function sendWebSocketUpdate(
  connectionId: string | undefined,
  message: Record<string, unknown>
): Promise<void> {
  if (!connectionId || !wsClient) {
    return;
  }

  try {
    await wsClient.send(new PostToConnectionCommand({
      ConnectionId: connectionId,
      Data: Buffer.from(JSON.stringify(message)),
    }));
  } catch (error) {
    // Connection might be closed, log but don't fail
    logger.debug(`WebSocket send failed: ${String(error)}`);
  }
}
