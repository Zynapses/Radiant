/**
 * RADIANT v5.0 - App Registry Sync Lambda
 * 
 * Scheduled: Daily at 2 AM UTC
 * Purpose: Sync app definitions from Activepieces and n8n registries
 */

import { ScheduledHandler } from 'aws-lambda';
import { executeStatement, stringParam, longParam } from '../shared/db/client';
import { enhancedLogger } from '../shared/logging/enhanced-logger';
import { S3Client, GetObjectCommand } from '@aws-sdk/client-s3';
import * as crypto from 'crypto';

const logger = enhancedLogger;
const s3 = new S3Client({ region: process.env.AWS_REGION || 'us-east-1' });
const SYNC_BUCKET = process.env.APP_SYNC_BUCKET || 'radiant-app-definitions';

interface SyncResult {
  added: number;
  updated: number;
  unchanged: number;
  failed: number;
  changes: string[];
  errors: string[];
}

export const handler: ScheduledHandler = async (event) => {
  logger.info('Starting app registry sync', { event });
  
  const syncId = await startSyncLog('activepieces');
  const results: SyncResult = {
    added: 0,
    updated: 0,
    unchanged: 0,
    failed: 0,
    changes: [],
    errors: [],
  };

  try {
    // Load definitions from S3
    const definitions = await loadDefinitionsFromS3('activepieces');
    logger.info(`Loaded ${definitions.length} app definitions`);

    for (const piece of definitions) {
      try {
        const result = await syncPiece(piece, 'activepieces');
        switch (result.status) {
          case 'added':
            results.added++;
            results.changes.push(`Added: ${piece.name}`);
            break;
          case 'updated':
            results.updated++;
            results.changes.push(`Updated: ${piece.name}`);
            break;
          case 'unchanged':
            results.unchanged++;
            break;
        }
      } catch (err: any) {
        results.failed++;
        results.errors.push(`${piece.name}: ${err.message}`);
        logger.warn('Failed to sync piece', { piece: piece.name, error: err.message });
      }
    }

    await completeSyncLog(syncId, results);
    
    logger.info('App registry sync completed', {
      added: results.added,
      updated: results.updated,
      unchanged: results.unchanged,
      failed: results.failed,
    });

    return { statusCode: 200, body: JSON.stringify(results) };
  } catch (error: any) {
    logger.error('App registry sync failed', { error: error.message });
    await failSyncLog(syncId, error.message);
    throw error;
  }
};

async function loadDefinitionsFromS3(source: string): Promise<any[]> {
  try {
    const command = new GetObjectCommand({
      Bucket: SYNC_BUCKET,
      Key: `definitions/${source}/latest.json`,
    });
    const response = await s3.send(command);
    const body = await response.Body?.transformToString();
    return body ? JSON.parse(body) : [];
  } catch (error) {
    logger.warn('Failed to load definitions from S3, using empty list', { source });
    return [];
  }
}

async function syncPiece(piece: any, source: string): Promise<{ status: 'added' | 'updated' | 'unchanged' }> {
  const hash = crypto.createHash('sha256').update(JSON.stringify(piece)).digest('hex');
  
  const existing = await executeStatement(
    `SELECT id, definition_hash FROM apps WHERE name = :name`,
    [stringParam('name', piece.name)]
  );

  if (!existing.records || existing.records.length === 0) {
    await insertApp(piece, source, hash);
    return { status: 'added' };
  }

  const existingHash = extractValue(existing.records[0].definition_hash);
  if (existingHash === hash) {
    return { status: 'unchanged' };
  }

  await updateApp(extractValue(existing.records[0].id) as string, piece, source, hash);
  return { status: 'updated' };
}

async function insertApp(piece: any, source: string, hash: string): Promise<void> {
  await executeStatement(
    `INSERT INTO apps (name, display_name, description, logo_url, source, definition_hash, 
      auth_type, auth_config, triggers, actions, health_status, last_sync)
     VALUES (:name, :displayName, :description, :logoUrl, :source::app_source, :hash,
      :authType::app_auth_type, :authConfig::jsonb, :triggers::jsonb, :actions::jsonb, 'unknown', NOW())`,
    [
      stringParam('name', piece.name),
      stringParam('displayName', piece.displayName || piece.name),
      stringParam('description', piece.description || ''),
      stringParam('logoUrl', piece.logoUrl || ''),
      stringParam('source', source),
      stringParam('hash', hash),
      stringParam('authType', mapAuthType(piece.auth?.type)),
      stringParam('authConfig', JSON.stringify(piece.auth || {})),
      stringParam('triggers', JSON.stringify(transformTriggers(piece.triggers))),
      stringParam('actions', JSON.stringify(transformActions(piece.actions))),
    ]
  );
}

async function updateApp(id: string, piece: any, source: string, hash: string): Promise<void> {
  await executeStatement(
    `UPDATE apps SET display_name = :displayName, description = :description, logo_url = :logoUrl, 
      definition_hash = :hash, auth_type = :authType::app_auth_type, auth_config = :authConfig::jsonb, 
      triggers = :triggers::jsonb, actions = :actions::jsonb, last_sync = NOW(), updated_at = NOW()
     WHERE id = :id`,
    [
      stringParam('id', id),
      stringParam('displayName', piece.displayName || piece.name),
      stringParam('description', piece.description || ''),
      stringParam('logoUrl', piece.logoUrl || ''),
      stringParam('hash', hash),
      stringParam('authType', mapAuthType(piece.auth?.type)),
      stringParam('authConfig', JSON.stringify(piece.auth || {})),
      stringParam('triggers', JSON.stringify(transformTriggers(piece.triggers))),
      stringParam('actions', JSON.stringify(transformActions(piece.actions))),
    ]
  );
}

function mapAuthType(type?: string): string {
  const map: Record<string, string> = {
    'OAUTH2': 'oauth2',
    'API_KEY': 'api_key',
    'BASIC': 'basic',
    'BEARER_TOKEN': 'bearer',
    'CUSTOM_AUTH': 'custom',
    'NONE': 'none',
  };
  return map[type || 'NONE'] || 'custom';
}

function transformTriggers(triggers: any): any[] {
  if (!triggers) return [];
  return Object.entries(triggers).map(([k, v]: [string, any]) => ({
    id: k,
    name: v.name || k,
    displayName: v.displayName || v.name || k,
    description: v.description || '',
    type: v.type || 'polling',
  }));
}

function transformActions(actions: any): any[] {
  if (!actions) return [];
  return Object.entries(actions).map(([k, v]: [string, any]) => ({
    id: k,
    name: v.name || k,
    displayName: v.displayName || v.name || k,
    description: v.description || '',
  }));
}

async function startSyncLog(source: string): Promise<string> {
  const result = await executeStatement(
    `INSERT INTO app_sync_logs (source, status) VALUES (:source::app_source, 'running') RETURNING id`,
    [stringParam('source', source)]
  );
  return extractValue(result.records?.[0]?.id) as string;
}

async function completeSyncLog(id: string, results: SyncResult): Promise<void> {
  await executeStatement(
    `UPDATE app_sync_logs SET sync_completed_at = NOW(), status = 'completed',
      apps_added = :added, apps_updated = :updated, apps_unchanged = :unchanged, apps_failed = :failed,
      changes = :changes::jsonb, errors = :errors::jsonb
     WHERE id = :id`,
    [
      stringParam('id', id),
      longParam('added', results.added),
      longParam('updated', results.updated),
      longParam('unchanged', results.unchanged),
      longParam('failed', results.failed),
      stringParam('changes', JSON.stringify(results.changes)),
      stringParam('errors', JSON.stringify(results.errors)),
    ]
  );
}

async function failSyncLog(id: string, error: string): Promise<void> {
  await executeStatement(
    `UPDATE app_sync_logs SET sync_completed_at = NOW(), status = 'failed', errors = :errors::jsonb WHERE id = :id`,
    [stringParam('id', id), stringParam('errors', JSON.stringify([error]))]
  );
}

function extractValue(field: unknown): unknown {
  if (!field) return null;
  if (typeof field === 'object' && 'stringValue' in field) {
    return (field as { stringValue: string }).stringValue;
  }
  return field;
}
