// RADIANT v4.18.0 - Provider Sync Lambda Handler
// Syncs external provider models to the database

import { APIGatewayProxyEvent, APIGatewayProxyResult, ScheduledEvent } from 'aws-lambda';
import { Pool } from 'pg';
import { logger } from '../shared/logger';

interface ProviderModel {
  id: string;
  displayName: string;
  contextWindow: number;
  inputPer1M: number;
  outputPer1M: number;
  capabilities: string[];
  isNovel?: boolean;
}

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type,Authorization',
  'Content-Type': 'application/json',
};

// External provider configurations with model definitions
const EXTERNAL_PROVIDERS = {
  openai: {
    id: 'openai',
    displayName: 'OpenAI',
    apiBase: 'https://api.openai.com/v1',
    models: [
      { id: 'gpt-4o', displayName: 'GPT-4o', contextWindow: 128000, inputPer1M: 2.50, outputPer1M: 10.00, capabilities: ['chat', 'vision'] },
      { id: 'gpt-4o-mini', displayName: 'GPT-4o Mini', contextWindow: 128000, inputPer1M: 0.15, outputPer1M: 0.60, capabilities: ['chat', 'vision'] },
      { id: 'o1', displayName: 'o1 Reasoning', contextWindow: 200000, inputPer1M: 15.00, outputPer1M: 60.00, capabilities: ['reasoning'] },
      { id: 'o1-mini', displayName: 'o1 Mini', contextWindow: 128000, inputPer1M: 3.00, outputPer1M: 12.00, capabilities: ['reasoning'] },
      { id: 'gpt-4-turbo', displayName: 'GPT-4 Turbo', contextWindow: 128000, inputPer1M: 10.00, outputPer1M: 30.00, capabilities: ['chat', 'vision'] },
    ],
  },
  anthropic: {
    id: 'anthropic',
    displayName: 'Anthropic',
    apiBase: 'https://api.anthropic.com/v1',
    models: [
      { id: 'claude-4-opus', displayName: 'Claude 4 Opus', contextWindow: 200000, inputPer1M: 15.00, outputPer1M: 75.00, capabilities: ['chat', 'vision', 'agents'] },
      { id: 'claude-4-sonnet', displayName: 'Claude 4 Sonnet', contextWindow: 200000, inputPer1M: 3.00, outputPer1M: 15.00, capabilities: ['chat', 'vision'] },
      { id: 'claude-3.5-haiku', displayName: 'Claude 3.5 Haiku', contextWindow: 200000, inputPer1M: 0.25, outputPer1M: 1.25, capabilities: ['chat'] },
    ],
  },
  google: {
    id: 'google',
    displayName: 'Google AI',
    apiBase: 'https://generativelanguage.googleapis.com/v1',
    models: [
      { id: 'gemini-2.0-pro', displayName: 'Gemini 2.0 Pro', contextWindow: 2000000, inputPer1M: 1.25, outputPer1M: 5.00, capabilities: ['chat', 'vision'] },
      { id: 'gemini-2.0-flash', displayName: 'Gemini 2.0 Flash', contextWindow: 1000000, inputPer1M: 0.075, outputPer1M: 0.30, capabilities: ['chat', 'vision'] },
      { id: 'gemini-1.5-pro', displayName: 'Gemini 1.5 Pro', contextWindow: 2000000, inputPer1M: 1.25, outputPer1M: 5.00, capabilities: ['chat', 'vision'] },
    ],
  },
  xai: {
    id: 'xai',
    displayName: 'xAI (Grok)',
    apiBase: 'https://api.x.ai/v1',
    models: [
      { id: 'grok-3', displayName: 'Grok 3', contextWindow: 131072, inputPer1M: 3.00, outputPer1M: 15.00, capabilities: ['chat', 'reasoning'] },
      { id: 'grok-3-fast', displayName: 'Grok 3 Fast', contextWindow: 131072, inputPer1M: 1.00, outputPer1M: 5.00, capabilities: ['chat'] },
      { id: 'grok-3-mini', displayName: 'Grok 3 Mini', contextWindow: 131072, inputPer1M: 0.30, outputPer1M: 1.50, capabilities: ['chat'] },
      { id: 'grok-2-vision', displayName: 'Grok 2 Vision', contextWindow: 32768, inputPer1M: 2.00, outputPer1M: 10.00, capabilities: ['chat', 'vision'], isNovel: true },
    ],
  },
  mistral: {
    id: 'mistral',
    displayName: 'Mistral AI',
    apiBase: 'https://api.mistral.ai/v1',
    models: [
      { id: 'mistral-large-2', displayName: 'Mistral Large 2', contextWindow: 128000, inputPer1M: 2.00, outputPer1M: 6.00, capabilities: ['chat', 'reasoning'] },
      { id: 'codestral-latest', displayName: 'Codestral', contextWindow: 32000, inputPer1M: 0.30, outputPer1M: 0.90, capabilities: ['code'] },
      { id: 'mistral-medium', displayName: 'Mistral Medium', contextWindow: 32000, inputPer1M: 0.27, outputPer1M: 0.81, capabilities: ['chat'] },
    ],
  },
  deepseek: {
    id: 'deepseek',
    displayName: 'DeepSeek',
    apiBase: 'https://api.deepseek.com/v1',
    models: [
      { id: 'deepseek-v3', displayName: 'DeepSeek V3', contextWindow: 64000, inputPer1M: 0.14, outputPer1M: 0.28, capabilities: ['chat', 'code'] },
      { id: 'deepseek-r1', displayName: 'DeepSeek R1', contextWindow: 64000, inputPer1M: 0.55, outputPer1M: 2.19, capabilities: ['reasoning'], isNovel: true },
    ],
  },
  perplexity: {
    id: 'perplexity',
    displayName: 'Perplexity',
    apiBase: 'https://api.perplexity.ai',
    models: [
      { id: 'perplexity-sonar-pro', displayName: 'Sonar Pro', contextWindow: 128000, inputPer1M: 3.00, outputPer1M: 15.00, capabilities: ['search', 'chat'] },
      { id: 'perplexity-sonar', displayName: 'Sonar', contextWindow: 128000, inputPer1M: 1.00, outputPer1M: 5.00, capabilities: ['search', 'chat'] },
    ],
  },
  cohere: {
    id: 'cohere',
    displayName: 'Cohere',
    apiBase: 'https://api.cohere.ai/v1',
    models: [
      { id: 'command-r-plus', displayName: 'Command R+', contextWindow: 128000, inputPer1M: 2.50, outputPer1M: 10.00, capabilities: ['chat', 'rag'] },
      { id: 'command-r', displayName: 'Command R', contextWindow: 128000, inputPer1M: 0.50, outputPer1M: 1.50, capabilities: ['chat', 'rag'] },
    ],
  },
};

interface SyncResult {
  providersUpdated: number;
  modelsUpdated: number;
  modelsAdded: number;
  errors: string[];
}

async function syncProviders(tenantId?: string): Promise<SyncResult> {
  const client = await pool.connect();
  const result: SyncResult = {
    providersUpdated: 0,
    modelsUpdated: 0,
    modelsAdded: 0,
    errors: [],
  };

  try {
    await client.query('BEGIN');

    for (const [providerId, provider] of Object.entries(EXTERNAL_PROVIDERS)) {
      try {
        // Upsert provider
        await client.query(
          `
          INSERT INTO providers (id, display_name, api_base, is_enabled, updated_at)
          VALUES ($1, $2, $3, true, NOW())
          ON CONFLICT (id) DO UPDATE SET
            display_name = EXCLUDED.display_name,
            api_base = EXCLUDED.api_base,
            updated_at = NOW()
          `,
          [provider.id, provider.displayName, provider.apiBase]
        );
        result.providersUpdated++;

        // Sync models for this provider
        for (const model of provider.models) {
          const existingModel = await client.query(
            `SELECT id FROM models WHERE id = $1`,
            [model.id]
          );

          const pricing = {
            input_tokens: model.inputPer1M,
            output_tokens: model.outputPer1M,
          };

          if (existingModel.rows.length > 0) {
            // Update existing model
            await client.query(
              `
              UPDATE models SET
                display_name = $2,
                provider_id = $3,
                context_window = $4,
                pricing = $5,
                capabilities = $6,
                is_novel = $7,
                thinktank_enabled = true,
                updated_at = NOW()
              WHERE id = $1
              `,
              [
                model.id,
                model.displayName,
                provider.id,
                model.contextWindow,
                JSON.stringify(pricing),
                JSON.stringify(model.capabilities),
                (model as ProviderModel).isNovel || false,
              ]
            );
            result.modelsUpdated++;
          } else {
            // Insert new model
            await client.query(
              `
              INSERT INTO models (
                id, display_name, provider_id, context_window, pricing,
                capabilities, is_novel, is_enabled, thinktank_enabled, status
              )
              VALUES ($1, $2, $3, $4, $5, $6, $7, true, true, 'active')
              `,
              [
                model.id,
                model.displayName,
                provider.id,
                model.contextWindow,
                JSON.stringify(pricing),
                JSON.stringify(model.capabilities),
                (model as ProviderModel).isNovel || false,
              ]
            );
            result.modelsAdded++;
          }
        }
      } catch (error) {
        result.errors.push(`Error syncing ${providerId}: ${(error as Error).message}`);
      }
    }

    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }

  return result;
}

// API Gateway handler for manual sync
export async function apiHandler(
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> {
  try {
    // Verify admin authorization here
    const result = await syncProviders();

    return {
      statusCode: 200,
      headers: corsHeaders,
      body: JSON.stringify({
        success: true,
        message: 'Provider sync completed',
        ...result,
      }),
    };
  } catch (error) {
    logger.error('Provider sync failed', error instanceof Error ? error : undefined);
    return {
      statusCode: 500,
      headers: corsHeaders,
      body: JSON.stringify({
        error: 'Provider sync failed',
        message: (error as Error).message,
      }),
    };
  }
}

// Scheduled event handler for automatic sync
export async function scheduledHandler(event: ScheduledEvent): Promise<void> {
  logger.info('Starting scheduled provider sync');
  
  try {
    const result = await syncProviders();
    logger.info('Provider sync completed', { result });
  } catch (error) {
    logger.error('Scheduled provider sync failed', error instanceof Error ? error : undefined);
    throw error;
  }
}

// Combined handler
export async function handler(
  event: APIGatewayProxyEvent | ScheduledEvent
): Promise<APIGatewayProxyResult | void> {
  if ('httpMethod' in event) {
    return apiHandler(event);
  } else {
    return scheduledHandler(event);
  }
}
