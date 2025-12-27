import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import {
  specialtyRankingService,
  SPECIALTY_CATEGORIES,
  ORCHESTRATION_MODES,
  type SpecialtyCategory,
  type OrchestrationMode,
  type ScoringWeights,
} from '../shared/services/specialty-ranking.service';

const headers = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type,Authorization',
};

function jsonResponse(statusCode: number, body: unknown): APIGatewayProxyResult {
  return { statusCode, headers, body: JSON.stringify(body) };
}

// GET /admin/specialty-rankings/categories
export async function getCategories(): Promise<APIGatewayProxyResult> {
  return jsonResponse(200, {
    specialties: SPECIALTY_CATEGORIES,
    modes: ORCHESTRATION_MODES,
  });
}

// GET /admin/specialty-rankings/specialty/:specialty
export async function getSpecialtyRankings(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  const specialty = event.pathParameters?.specialty as SpecialtyCategory;
  if (!specialty || !SPECIALTY_CATEGORIES[specialty]) {
    return jsonResponse(400, { error: 'Invalid specialty category' });
  }

  const rankings = await specialtyRankingService.getSpecialtyLeaderboard(specialty);
  return jsonResponse(200, { specialty, rankings });
}

// GET /admin/specialty-rankings/mode/:mode
export async function getModeRankings(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  const mode = event.pathParameters?.mode as OrchestrationMode;
  if (!mode || !ORCHESTRATION_MODES[mode]) {
    return jsonResponse(400, { error: 'Invalid orchestration mode' });
  }

  const rankings = await specialtyRankingService.getModeRankings(mode);
  return jsonResponse(200, { mode, rankings });
}

// GET /admin/specialty-rankings/model/:modelId
export async function getModelRankings(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  const modelId = decodeURIComponent(event.pathParameters?.modelId || '');
  if (!modelId) {
    return jsonResponse(400, { error: 'Model ID required' });
  }

  const rankings = await specialtyRankingService.getModelRankings(modelId);
  return jsonResponse(200, { modelId, rankings });
}

// POST /admin/specialty-rankings/research
export async function triggerResearch(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  const body = JSON.parse(event.body || '{}');
  const { scope = 'all', target } = body as { scope?: 'all' | 'specialty' | 'mode'; target?: string };

  const result = await specialtyRankingService.triggerResearchNow(scope, target);
  return jsonResponse(200, result);
}

// POST /admin/specialty-rankings/override
export async function setOverride(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  const body = JSON.parse(event.body || '{}');
  const { modelId, specialty, score, notes } = body as {
    modelId: string;
    specialty: SpecialtyCategory;
    score: number;
    notes?: string;
  };

  if (!modelId || !specialty || score === undefined) {
    return jsonResponse(400, { error: 'modelId, specialty, and score are required' });
  }

  await specialtyRankingService.adminOverrideRanking(modelId, specialty, score, notes);
  return jsonResponse(200, { success: true, modelId, specialty, score });
}

// DELETE /admin/specialty-rankings/override
export async function removeOverride(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  const body = JSON.parse(event.body || '{}');
  const { modelId, specialty } = body as { modelId: string; specialty: SpecialtyCategory };

  if (!modelId || !specialty) {
    return jsonResponse(400, { error: 'modelId and specialty are required' });
  }

  await specialtyRankingService.unlockRanking(modelId, specialty);
  return jsonResponse(200, { success: true, modelId, specialty });
}

// GET /admin/specialty-rankings/weights
export async function getWeights(): Promise<APIGatewayProxyResult> {
  const weights = await specialtyRankingService.getScoringWeights();
  return jsonResponse(200, weights);
}

// PUT /admin/specialty-rankings/weights
export async function updateWeights(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  const weights = JSON.parse(event.body || '{}') as ScoringWeights;

  if (weights.benchmarkWeight === undefined || weights.communityWeight === undefined || weights.internalWeight === undefined) {
    return jsonResponse(400, { error: 'benchmarkWeight, communityWeight, and internalWeight are required' });
  }

  await specialtyRankingService.updateScoringWeights(weights);
  const updated = await specialtyRankingService.getScoringWeights();
  return jsonResponse(200, updated);
}

// GET /admin/specialty-rankings/schedules
export async function getSchedules(): Promise<APIGatewayProxyResult> {
  const schedules = await specialtyRankingService.getResearchSchedules();
  return jsonResponse(200, { schedules });
}

// PUT /admin/specialty-rankings/schedules/:scheduleId
export async function updateSchedule(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  const scheduleId = event.pathParameters?.scheduleId;
  if (!scheduleId) {
    return jsonResponse(400, { error: 'Schedule ID required' });
  }

  const updates = JSON.parse(event.body || '{}');
  await specialtyRankingService.updateResearchSchedule(scheduleId, updates);
  return jsonResponse(200, { success: true, scheduleId });
}

// Main router handler
export async function handler(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  const path = event.path;
  const method = event.httpMethod;

  try {
    // Categories
    if (path === '/admin/specialty-rankings/categories' && method === 'GET') {
      return getCategories();
    }

    // Specialty rankings
    if (path.match(/^\/admin\/specialty-rankings\/specialty\//) && method === 'GET') {
      return getSpecialtyRankings(event);
    }

    // Mode rankings
    if (path.match(/^\/admin\/specialty-rankings\/mode\//) && method === 'GET') {
      return getModeRankings(event);
    }

    // Model rankings
    if (path.match(/^\/admin\/specialty-rankings\/model\//) && method === 'GET') {
      return getModelRankings(event);
    }

    // Research
    if (path === '/admin/specialty-rankings/research' && method === 'POST') {
      return triggerResearch(event);
    }

    // Override
    if (path === '/admin/specialty-rankings/override') {
      if (method === 'POST') return setOverride(event);
      if (method === 'DELETE') return removeOverride(event);
    }

    // Weights
    if (path === '/admin/specialty-rankings/weights') {
      if (method === 'GET') return getWeights();
      if (method === 'PUT') return updateWeights(event);
    }

    // Schedules
    if (path === '/admin/specialty-rankings/schedules' && method === 'GET') {
      return getSchedules();
    }
    if (path.match(/^\/admin\/specialty-rankings\/schedules\//) && method === 'PUT') {
      return updateSchedule(event);
    }

    return jsonResponse(404, { error: 'Not found' });
  } catch (error) {
    console.error('Specialty rankings error:', error);
    return jsonResponse(500, { error: 'Internal server error', message: String(error) });
  }
}
