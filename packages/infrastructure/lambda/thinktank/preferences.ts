/**
 * Think Tank User Preferences Lambda
 * Handles user preferences for models, UI, and behavior
 */

import type { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { executeStatement, stringParam } from '../shared/db/client';

const corsHeaders = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type,Authorization,X-Tenant-ID,X-User-ID',
  'Access-Control-Allow-Methods': 'GET,POST,PUT,OPTIONS',
};

interface UserPreferences {
  id: string;
  userId: string;
  favoriteModels: string[];
  defaultModel: string | null;
  preferredResponseLength: 'concise' | 'balanced' | 'detailed';
  preferredTone: 'casual' | 'professional' | 'academic' | 'creative';
  autoSaveConversations: boolean;
  showTokenUsage: boolean;
  showCostEstimates: boolean;
  keyboardShortcutsEnabled: boolean;
  soundEffectsEnabled: boolean;
  hapticFeedbackEnabled: boolean;
  theme: 'light' | 'dark' | 'system';
  language: string;
}

export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers: corsHeaders, body: '' };
  }

  const tenantId = event.requestContext.authorizer?.tenantId || event.headers['X-Tenant-ID'];
  const userId = event.requestContext.authorizer?.userId || event.headers['X-User-ID'];
  
  if (!tenantId || !userId) {
    return {
      statusCode: 401,
      headers: corsHeaders,
      body: JSON.stringify({ error: 'Tenant ID and User ID required' }),
    };
  }

  const path = event.path;
  const isFavorite = path.includes('/favorite');
  const isModels = path.includes('/models');

  try {
    if (event.httpMethod === 'GET') {
      if (isModels) {
        return await getModelPreferences(tenantId, userId);
      }
      return await getPreferences(tenantId, userId);
    }
    
    if (event.httpMethod === 'POST' && isFavorite) {
      return await toggleFavoriteModel(tenantId, userId, JSON.parse(event.body || '{}'));
    }
    
    if (event.httpMethod === 'PUT') {
      return await updatePreferences(tenantId, userId, JSON.parse(event.body || '{}'));
    }

    return {
      statusCode: 405,
      headers: corsHeaders,
      body: JSON.stringify({ error: 'Method not allowed' }),
    };
  } catch (error) {
    console.error('Preferences handler error:', error);
    return {
      statusCode: 500,
      headers: corsHeaders,
      body: JSON.stringify({ error: 'Internal server error' }),
    };
  }
};

async function getPreferences(
  tenantId: string,
  userId: string
): Promise<APIGatewayProxyResult> {
  const result = await executeStatement(`
    SELECT 
      id, user_id as "userId",
      favorite_models as "favoriteModels",
      default_model as "defaultModel",
      preferred_response_length as "preferredResponseLength",
      preferred_tone as "preferredTone",
      auto_save_conversations as "autoSaveConversations",
      show_token_usage as "showTokenUsage",
      show_cost_estimates as "showCostEstimates",
      keyboard_shortcuts_enabled as "keyboardShortcutsEnabled",
      sound_effects_enabled as "soundEffectsEnabled",
      haptic_feedback_enabled as "hapticFeedbackEnabled",
      theme, language
    FROM thinktank_user_preferences
    WHERE tenant_id = $1 AND user_id = $2
  `, [
    stringParam('tenant_id', tenantId),
    stringParam('user_id', userId),
  ]);

  if (result.rows.length === 0) {
    // Return defaults
    const defaults: Partial<UserPreferences> = {
      favoriteModels: [],
      defaultModel: null,
      preferredResponseLength: 'balanced',
      preferredTone: 'professional',
      autoSaveConversations: true,
      showTokenUsage: false,
      showCostEstimates: false,
      keyboardShortcutsEnabled: true,
      soundEffectsEnabled: false,
      hapticFeedbackEnabled: true,
      theme: 'system',
      language: 'en',
    };
    return {
      statusCode: 200,
      headers: corsHeaders,
      body: JSON.stringify(defaults),
    };
  }

  return {
    statusCode: 200,
    headers: corsHeaders,
    body: JSON.stringify(result.rows[0]),
  };
}

async function getModelPreferences(
  tenantId: string,
  userId: string
): Promise<APIGatewayProxyResult> {
  const result = await executeStatement(`
    SELECT 
      favorite_models as "favoriteModels",
      default_model as "defaultModel"
    FROM thinktank_user_preferences
    WHERE tenant_id = $1 AND user_id = $2
  `, [
    stringParam('tenant_id', tenantId),
    stringParam('user_id', userId),
  ]);

  if (result.rows.length === 0) {
    return {
      statusCode: 200,
      headers: corsHeaders,
      body: JSON.stringify({ favoriteModels: [], defaultModel: null }),
    };
  }

  return {
    statusCode: 200,
    headers: corsHeaders,
    body: JSON.stringify(result.rows[0]),
  };
}

async function toggleFavoriteModel(
  tenantId: string,
  userId: string,
  body: { modelId: string }
): Promise<APIGatewayProxyResult> {
  const { modelId } = body;

  if (!modelId) {
    return {
      statusCode: 400,
      headers: corsHeaders,
      body: JSON.stringify({ error: 'modelId is required' }),
    };
  }

  // Check if preferences exist
  const existingResult = await executeStatement(`
    SELECT favorite_models FROM thinktank_user_preferences
    WHERE tenant_id = $1 AND user_id = $2
  `, [
    stringParam('tenant_id', tenantId),
    stringParam('user_id', userId),
  ]);

  if (existingResult.rows.length === 0) {
    // Create new preferences with this model as favorite
    await executeStatement(`
      INSERT INTO thinktank_user_preferences (tenant_id, user_id, favorite_models)
      VALUES ($1, $2, ARRAY[$3])
    `, [
      stringParam('tenant_id', tenantId),
      stringParam('user_id', userId),
      stringParam('model_id', modelId),
    ]);

    return {
      statusCode: 200,
      headers: corsHeaders,
      body: JSON.stringify({ success: true, isFavorite: true, favoriteModels: [modelId] }),
    };
  }

  const currentFavorites = (existingResult.rows[0] as { favorite_models: string[] }).favorite_models || [];
  const isFavorite = currentFavorites.includes(modelId);

  if (isFavorite) {
    // Remove from favorites
    await executeStatement(`
      UPDATE thinktank_user_preferences SET
        favorite_models = array_remove(favorite_models, $3),
        updated_at = NOW()
      WHERE tenant_id = $1 AND user_id = $2
    `, [
      stringParam('tenant_id', tenantId),
      stringParam('user_id', userId),
      stringParam('model_id', modelId),
    ]);

    return {
      statusCode: 200,
      headers: corsHeaders,
      body: JSON.stringify({ 
        success: true, 
        isFavorite: false, 
        favoriteModels: currentFavorites.filter(m => m !== modelId),
      }),
    };
  } else {
    // Add to favorites
    await executeStatement(`
      UPDATE thinktank_user_preferences SET
        favorite_models = array_append(favorite_models, $3),
        updated_at = NOW()
      WHERE tenant_id = $1 AND user_id = $2
    `, [
      stringParam('tenant_id', tenantId),
      stringParam('user_id', userId),
      stringParam('model_id', modelId),
    ]);

    return {
      statusCode: 200,
      headers: corsHeaders,
      body: JSON.stringify({ 
        success: true, 
        isFavorite: true, 
        favoriteModels: [...currentFavorites, modelId],
      }),
    };
  }
}

async function updatePreferences(
  tenantId: string,
  userId: string,
  body: Partial<UserPreferences>
): Promise<APIGatewayProxyResult> {
  const {
    favoriteModels,
    defaultModel,
    preferredResponseLength,
    preferredTone,
    autoSaveConversations,
    showTokenUsage,
    showCostEstimates,
    keyboardShortcutsEnabled,
    soundEffectsEnabled,
    hapticFeedbackEnabled,
    theme,
    language,
  } = body;

  await executeStatement(`
    INSERT INTO thinktank_user_preferences (
      tenant_id, user_id,
      favorite_models, default_model,
      preferred_response_length, preferred_tone,
      auto_save_conversations, show_token_usage,
      show_cost_estimates, keyboard_shortcuts_enabled,
      sound_effects_enabled, haptic_feedback_enabled,
      theme, language
    ) VALUES (
      $1, $2,
      COALESCE($3, '{}'), $4,
      COALESCE($5, 'balanced'), COALESCE($6, 'professional'),
      COALESCE($7, true), COALESCE($8, false),
      COALESCE($9, false), COALESCE($10, true),
      COALESCE($11, false), COALESCE($12, true),
      COALESCE($13, 'system'), COALESCE($14, 'en')
    )
    ON CONFLICT (tenant_id, user_id) DO UPDATE SET
      favorite_models = COALESCE($3, thinktank_user_preferences.favorite_models),
      default_model = COALESCE($4, thinktank_user_preferences.default_model),
      preferred_response_length = COALESCE($5, thinktank_user_preferences.preferred_response_length),
      preferred_tone = COALESCE($6, thinktank_user_preferences.preferred_tone),
      auto_save_conversations = COALESCE($7, thinktank_user_preferences.auto_save_conversations),
      show_token_usage = COALESCE($8, thinktank_user_preferences.show_token_usage),
      show_cost_estimates = COALESCE($9, thinktank_user_preferences.show_cost_estimates),
      keyboard_shortcuts_enabled = COALESCE($10, thinktank_user_preferences.keyboard_shortcuts_enabled),
      sound_effects_enabled = COALESCE($11, thinktank_user_preferences.sound_effects_enabled),
      haptic_feedback_enabled = COALESCE($12, thinktank_user_preferences.haptic_feedback_enabled),
      theme = COALESCE($13, thinktank_user_preferences.theme),
      language = COALESCE($14, thinktank_user_preferences.language),
      updated_at = NOW()
  `, [
    stringParam('tenant_id', tenantId),
    stringParam('user_id', userId),
    favoriteModels ? stringParam('favorite_models', `{${favoriteModels.join(',')}}`) : stringParam('favorite_models', ''),
    defaultModel ? stringParam('default_model', defaultModel) : stringParam('default_model', ''),
    preferredResponseLength ? stringParam('preferred_response_length', preferredResponseLength) : stringParam('preferred_response_length', ''),
    preferredTone ? stringParam('preferred_tone', preferredTone) : stringParam('preferred_tone', ''),
    autoSaveConversations !== undefined ? stringParam('auto_save_conversations', String(autoSaveConversations)) : stringParam('auto_save_conversations', ''),
    showTokenUsage !== undefined ? stringParam('show_token_usage', String(showTokenUsage)) : stringParam('show_token_usage', ''),
    showCostEstimates !== undefined ? stringParam('show_cost_estimates', String(showCostEstimates)) : stringParam('show_cost_estimates', ''),
    keyboardShortcutsEnabled !== undefined ? stringParam('keyboard_shortcuts_enabled', String(keyboardShortcutsEnabled)) : stringParam('keyboard_shortcuts_enabled', ''),
    soundEffectsEnabled !== undefined ? stringParam('sound_effects_enabled', String(soundEffectsEnabled)) : stringParam('sound_effects_enabled', ''),
    hapticFeedbackEnabled !== undefined ? stringParam('haptic_feedback_enabled', String(hapticFeedbackEnabled)) : stringParam('haptic_feedback_enabled', ''),
    theme ? stringParam('theme', theme) : stringParam('theme', ''),
    language ? stringParam('language', language) : stringParam('language', ''),
  ]);

  return {
    statusCode: 200,
    headers: corsHeaders,
    body: JSON.stringify({ success: true, message: 'Preferences updated' }),
  };
}
