// RADIANT v4.18.0 - Think Tank Admin Consolidated Lambda Handler
// Combines dashboard, analytics, settings, my-rules, and shadow-testing APIs

import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';

// Import handlers from individual modules
import { getDashboardStats } from './dashboard';
import { getAnalytics } from '../thinktank/analytics';
import { getStatus, getConfig, updateConfig } from '../thinktank/settings';
import { listRules, createRule, updateRule, deleteRule, getPresets } from '../thinktank/my-rules';
import {
  listTests,
  createTest,
  startTest,
  stopTest,
  promoteTest,
  getSettings as getShadowSettings,
  updateSettings as updateShadowSettings,
} from '../thinktank/shadow-testing';

const corsHeaders = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type,Authorization,X-Tenant-ID',
  'Access-Control-Allow-Methods': 'GET,POST,PUT,PATCH,DELETE,OPTIONS',
};

export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  // Handle CORS preflight
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers: corsHeaders, body: '' };
  }

  const path = event.path;
  const method = event.httpMethod;

  try {
    // Dashboard routes
    if (path.includes('/thinktank-admin/dashboard/stats') && method === 'GET') {
      return await getDashboardStats(event);
    }

    // Analytics routes
    if (path.includes('/admin/thinktank/analytics') && method === 'GET') {
      return await getAnalytics(event);
    }

    // Settings routes
    if (path.includes('/admin/thinktank/status') && method === 'GET') {
      return await getStatus(event);
    }
    if (path.includes('/admin/thinktank/config')) {
      if (method === 'GET') return await getConfig(event);
      if (method === 'PATCH') return await updateConfig(event);
    }

    // My Rules routes
    if (path.includes('/admin/my-rules')) {
      if (path.includes('/presets') && method === 'GET') {
        return await getPresets(event);
      }
      
      const ruleIdMatch = path.match(/\/my-rules\/([^/]+)$/);
      if (ruleIdMatch) {
        if (method === 'PUT') return await updateRule(event);
        if (method === 'DELETE') return await deleteRule(event);
      }
      
      if (method === 'GET') return await listRules(event);
      if (method === 'POST') return await createRule(event);
    }

    // Shadow Testing routes
    if (path.includes('/admin/shadow-tests')) {
      if (path.includes('/settings')) {
        if (method === 'GET') return await getShadowSettings(event);
        if (method === 'PUT') return await updateShadowSettings(event);
      }
      
      const testIdMatch = path.match(/\/shadow-tests\/([^/]+)/);
      if (testIdMatch) {
        if (path.includes('/start') && method === 'POST') return await startTest(event);
        if (path.includes('/stop') && method === 'POST') return await stopTest(event);
        if (path.includes('/promote') && method === 'POST') return await promoteTest(event);
      }
      
      if (method === 'GET') return await listTests(event);
      if (method === 'POST') return await createTest(event);
    }

    // Route not found
    return {
      statusCode: 404,
      headers: corsHeaders,
      body: JSON.stringify({ error: 'Route not found', path, method }),
    };
  } catch (error) {
    console.error('Handler error:', error);
    return {
      statusCode: 500,
      headers: corsHeaders,
      body: JSON.stringify({ error: 'Internal server error' }),
    };
  }
};
