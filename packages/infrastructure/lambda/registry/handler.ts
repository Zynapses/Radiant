// RADIANT v4.18.0 - AI Registry Lambda Handler
// API endpoints for providers, models, and self-hosted models

import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { Pool, PoolClient } from 'pg';

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type,Authorization',
  'Content-Type': 'application/json',
};

// ============================================================================
// Types
// ============================================================================

interface Provider {
  id: string;
  name: string;
  displayName: string;
  category: string;
  description: string | null;
  website: string | null;
  apiBaseUrl: string | null;
  enabled: boolean;
  modelCount: number;
  features: string[];
  compliance: string[];
  status: string;
}

interface Model {
  id: string;
  providerId: string;
  modelId: string;
  litellmId: string | null;
  name: string;
  displayName: string;
  description: string | null;
  category: string;
  specialty: string | null;
  capabilities: string[];
  contextWindow: number | null;
  maxOutput: number | null;
  inputModalities: string[] | null;
  outputModalities: string[] | null;
  pricing: Record<string, unknown>;
  minTier: number;
  enabled: boolean;
  status: string;
}

interface SelfHostedModel {
  id: string;
  name: string;
  displayName: string;
  description: string | null;
  category: string;
  specialty: string | null;
  instanceType: string;
  capabilities: string[];
  pricing: Record<string, unknown>;
  minTier: number;
  thermalState: string | null;
  enabled: boolean;
}

// ============================================================================
// Provider Endpoints
// ============================================================================

// GET /api/v2/providers
async function listProviders(client: PoolClient): Promise<Provider[]> {
  const result = await client.query(`
    SELECT 
      p.id,
      p.name,
      p.display_name,
      p.category,
      p.description,
      p.website,
      p.api_base_url,
      p.enabled,
      p.features,
      p.compliance,
      CASE 
        WHEN p.enabled THEN 'active'
        ELSE 'disabled'
      END as status,
      COUNT(m.id)::int as model_count
    FROM providers p
    LEFT JOIN models m ON m.provider_id = p.id AND m.enabled = true
    GROUP BY p.id
    ORDER BY p.display_name
  `);

  return result.rows.map(row => ({
    id: row.id,
    name: row.name,
    displayName: row.display_name,
    category: row.category,
    description: row.description,
    website: row.website,
    apiBaseUrl: row.api_base_url,
    enabled: row.enabled,
    modelCount: row.model_count,
    features: row.features || [],
    compliance: row.compliance || [],
    status: row.status,
  }));
}

// GET /api/v2/providers/:id
async function getProvider(client: PoolClient, providerId: string): Promise<Provider | null> {
  const result = await client.query(`
    SELECT 
      p.id,
      p.name,
      p.display_name,
      p.category,
      p.description,
      p.website,
      p.api_base_url,
      p.enabled,
      p.features,
      p.compliance,
      CASE 
        WHEN p.enabled THEN 'active'
        ELSE 'disabled'
      END as status,
      COUNT(m.id)::int as model_count
    FROM providers p
    LEFT JOIN models m ON m.provider_id = p.id AND m.enabled = true
    WHERE p.id = $1
    GROUP BY p.id
  `, [providerId]);

  if (result.rows.length === 0) return null;

  const row = result.rows[0];
  return {
    id: row.id,
    name: row.name,
    displayName: row.display_name,
    category: row.category,
    description: row.description,
    website: row.website,
    apiBaseUrl: row.api_base_url,
    enabled: row.enabled,
    modelCount: row.model_count,
    features: row.features || [],
    compliance: row.compliance || [],
    status: row.status,
  };
}

// ============================================================================
// Model Endpoints
// ============================================================================

// GET /api/v2/models
async function listModels(client: PoolClient, category?: string): Promise<Model[]> {
  let query = `
    SELECT 
      m.id,
      m.provider_id,
      m.model_id,
      m.litellm_id,
      m.name,
      m.display_name,
      m.description,
      m.category,
      m.specialty,
      m.capabilities,
      m.context_window,
      m.max_output,
      m.input_modalities,
      m.output_modalities,
      m.pricing,
      m.min_tier,
      m.enabled,
      m.status
    FROM models m
    JOIN providers p ON m.provider_id = p.id
    WHERE p.enabled = true
  `;
  
  const params: string[] = [];
  if (category && category !== 'All') {
    params.push(category);
    query += ` AND m.category = $1`;
  }
  
  query += ` ORDER BY p.display_name, m.display_name`;

  const result = await client.query(query, params);

  return result.rows.map(row => ({
    id: row.id,
    providerId: row.provider_id,
    modelId: row.model_id,
    litellmId: row.litellm_id,
    name: row.name,
    displayName: row.display_name,
    description: row.description,
    category: row.category,
    specialty: row.specialty,
    capabilities: row.capabilities || [],
    contextWindow: row.context_window,
    maxOutput: row.max_output,
    inputModalities: row.input_modalities,
    outputModalities: row.output_modalities,
    pricing: row.pricing,
    minTier: row.min_tier,
    enabled: row.enabled,
    status: row.status,
  }));
}

// GET /api/v2/providers/:id/models
async function listProviderModels(client: PoolClient, providerId: string): Promise<Model[]> {
  const result = await client.query(`
    SELECT 
      m.id,
      m.provider_id,
      m.model_id,
      m.litellm_id,
      m.name,
      m.display_name,
      m.description,
      m.category,
      m.specialty,
      m.capabilities,
      m.context_window,
      m.max_output,
      m.input_modalities,
      m.output_modalities,
      m.pricing,
      m.min_tier,
      m.enabled,
      m.status
    FROM models m
    WHERE m.provider_id = $1
    ORDER BY m.display_name
  `, [providerId]);

  return result.rows.map(row => ({
    id: row.id,
    providerId: row.provider_id,
    modelId: row.model_id,
    litellmId: row.litellm_id,
    name: row.name,
    displayName: row.display_name,
    description: row.description,
    category: row.category,
    specialty: row.specialty,
    capabilities: row.capabilities || [],
    contextWindow: row.context_window,
    maxOutput: row.max_output,
    inputModalities: row.input_modalities,
    outputModalities: row.output_modalities,
    pricing: row.pricing,
    minTier: row.min_tier,
    enabled: row.enabled,
    status: row.status,
  }));
}

// ============================================================================
// Self-Hosted Model Endpoints
// ============================================================================

// GET /api/v2/models/self-hosted
async function listSelfHostedModels(client: PoolClient): Promise<SelfHostedModel[]> {
  const result = await client.query(`
    SELECT 
      shm.id,
      shm.name,
      shm.display_name,
      shm.description,
      shm.category,
      shm.specialty,
      shm.instance_type,
      shm.capabilities,
      shm.pricing,
      shm.min_tier,
      shm.enabled,
      ts.state as thermal_state
    FROM self_hosted_models shm
    LEFT JOIN thermal_states ts ON ts.model_id = shm.id
    ORDER BY shm.display_name
  `);

  return result.rows.map(row => ({
    id: row.id,
    name: row.name,
    displayName: row.display_name,
    description: row.description,
    category: row.category,
    specialty: row.specialty,
    instanceType: row.instance_type,
    capabilities: row.capabilities || [],
    pricing: row.pricing,
    minTier: row.min_tier,
    thermalState: row.thermal_state,
    enabled: row.enabled,
  }));
}

// ============================================================================
// Lambda Handler
// ============================================================================

export async function handler(
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  const path = event.path;
  const method = event.httpMethod;

  // Handle CORS preflight
  if (method === 'OPTIONS') {
    return {
      statusCode: 200,
      headers: {
        ...corsHeaders,
        'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS',
      },
      body: '',
    };
  }

  const client = await pool.connect();

  try {
    // GET /api/v2/providers
    if (path === '/api/v2/providers' && method === 'GET') {
      const providers = await listProviders(client);
      return {
        statusCode: 200,
        headers: corsHeaders,
        body: JSON.stringify({ providers }),
      };
    }

    // GET /api/v2/providers/:id
    const providerMatch = path.match(/^\/api\/v2\/providers\/([^/]+)$/);
    if (providerMatch && method === 'GET') {
      const provider = await getProvider(client, providerMatch[1]);
      if (!provider) {
        return {
          statusCode: 404,
          headers: corsHeaders,
          body: JSON.stringify({ error: 'Provider not found' }),
        };
      }
      return {
        statusCode: 200,
        headers: corsHeaders,
        body: JSON.stringify(provider),
      };
    }

    // GET /api/v2/providers/:id/models
    const providerModelsMatch = path.match(/^\/api\/v2\/providers\/([^/]+)\/models$/);
    if (providerModelsMatch && method === 'GET') {
      const models = await listProviderModels(client, providerModelsMatch[1]);
      return {
        statusCode: 200,
        headers: corsHeaders,
        body: JSON.stringify({ models }),
      };
    }

    // GET /api/v2/models
    if (path === '/api/v2/models' && method === 'GET') {
      const category = event.queryStringParameters?.category;
      const models = await listModels(client, category);
      return {
        statusCode: 200,
        headers: corsHeaders,
        body: JSON.stringify({ models }),
      };
    }

    // GET /api/v2/models/self-hosted
    if (path === '/api/v2/models/self-hosted' && method === 'GET') {
      const models = await listSelfHostedModels(client);
      return {
        statusCode: 200,
        headers: corsHeaders,
        body: JSON.stringify({ models }),
      };
    }

    // Not found
    return {
      statusCode: 404,
      headers: corsHeaders,
      body: JSON.stringify({ error: 'Not found' }),
    };
  } catch (error) {
    console.error('Registry handler error:', error);
    return {
      statusCode: 500,
      headers: corsHeaders,
      body: JSON.stringify({ error: 'Internal server error' }),
    };
  } finally {
    client.release();
  }
}
