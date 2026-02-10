/**
 * Cartridge Loader Worker
 * Triggered by SQS when a cartridge installation is requested.
 *
 * All S3 operations go through cartridgeStorageManager — no direct S3 access.
 *
 * Responsibilities:
 * 1. Retrieve .RADz from storage manager
 * 2. Decompress (ZSTD) and extract ZIP
 * 3. Parse manifest.json
 * 4. For each target service in manifest.targets:
 *    a. omega: store Q-Node weights, firmware, knowledge via storage manager
 *    b. cortex: store ONNX files, LoRA adapters, ESAs via storage manager
 *    c. cato: update personality config in DB, store learned networks
 *    d. tenant: update tenant_config in DB
 * 5. Update cartridge_installations status to 'active'
 * 6. Trigger stacking resolution via SQS
 */

import type { SQSEvent, SQSRecord } from 'aws-lambda';
import { SQSClient, SendMessageCommand } from '@aws-sdk/client-sqs';
import { EventBridgeClient, PutEventsCommand } from '@aws-sdk/client-eventbridge';
import { createRegisteredLogger } from '../shared/services/logging-registry.service';
import { cartridgeStorageManager } from '../shared/services/cartridge-storage-manager.service';
import { executeStatement, stringParam } from '../shared/db/client';

const logger = createRegisteredLogger({
  serviceName: 'worker/cartridge-loader',
  category: 'infrastructure',
  sourceType: 'lambda',
});

const sqs = new SQSClient({});
const eb = new EventBridgeClient({});

const RESOLUTION_QUEUE_URL = process.env.CARTRIDGE_RESOLUTION_QUEUE_URL || '';

// ============================================================================
// Types
// ============================================================================

interface InstallMessage {
  installation_id: string;
  cartridge_id: string;
  tenant_id: string;
  storage_ref: string;
  targets: string[];
  merge_strategy: 'replace' | 'merge' | 'additive';
}

// ============================================================================
// Handler
// ============================================================================

export async function handler(event: SQSEvent): Promise<void> {
  for (const record of event.Records) {
    await processInstallation(record);
  }
}

async function processInstallation(record: SQSRecord): Promise<void> {
  const msg: InstallMessage = JSON.parse(record.body);
  logger.info('Processing cartridge installation', {
    installation_id: msg.installation_id,
    cartridge_id: msg.cartridge_id,
    tenant_id: msg.tenant_id,
  });

  try {
    // 1. Retrieve .RADz from storage manager
    const radzBuffer = await cartridgeStorageManager.retrieveArchive(msg.storage_ref);
    if (!radzBuffer) {
      throw new Error(`RADz file not found at storage ref: ${msg.storage_ref}`);
    }

    // 2. Decompress ZSTD and extract ZIP
    let zipBuffer: Uint8Array;
    try {
      const { decompress } = await import('fzstd');
      zipBuffer = decompress(new Uint8Array(radzBuffer));
    } catch {
      zipBuffer = new Uint8Array(radzBuffer);
    }

    const AdmZip = (await import('adm-zip')).default;
    const zip = new AdmZip(Buffer.from(zipBuffer));

    // 3. Parse manifest
    const manifestEntry = zip.getEntry('manifest.json');
    if (!manifestEntry) throw new Error('manifest.json not found in .RADz');
    const manifest = JSON.parse(manifestEntry.getData().toString('utf8'));

    // 4. Process each target
    for (const target of msg.targets) {
      await processTarget(target, zip, manifest, msg);
    }

    // 5. Update installation status
    await executeStatement(
      `UPDATE cartridge_installations SET installation_status = 'active', updated_at = NOW() WHERE id = $1`,
      [stringParam('installId', msg.installation_id)]
    );

    await executeStatement(
      `UPDATE cartridge_universal SET
        status = 'active', manifest = $1,
        sections_present = $2, updated_at = NOW()
       WHERE id = $3`,
      [
        stringParam('manifest', JSON.stringify(manifest)),
        stringParam('sections', JSON.stringify(manifest.sections_present || [])),
        stringParam('id', msg.cartridge_id),
      ]
    );

    // 6. Trigger stacking resolution
    if (RESOLUTION_QUEUE_URL) {
      await sqs.send(new SendMessageCommand({
        QueueUrl: RESOLUTION_QUEUE_URL,
        MessageBody: JSON.stringify({
          tenant_id: msg.tenant_id,
          reason: 'cartridge_installed',
          cartridge_id: msg.cartridge_id,
        }),
      }));
    }

    // Audit log
    await executeStatement(
      `INSERT INTO cartridge_audit_log (tenant_id, cartridge_id, action, details, created_at)
       VALUES ($1, $2, $3, $4, NOW())`,
      [
        stringParam('tenantId', msg.tenant_id),
        stringParam('cartridgeId', msg.cartridge_id),
        stringParam('action', 'cartridge_installed'),
        stringParam('details', JSON.stringify({
          targets: msg.targets,
          manifest_version: manifest.version,
          sections: manifest.sections_present,
        })),
      ]
    );

    logger.info('Cartridge installation complete', {
      installation_id: msg.installation_id,
      cartridge_id: msg.cartridge_id,
    });

  } catch (error) {
    logger.error('Cartridge installation failed', {
      installation_id: msg.installation_id,
      error,
    });

    // Update status to failed
    await executeStatement(
      `UPDATE cartridge_installations SET installation_status = 'failed', updated_at = NOW() WHERE id = $1`,
      [stringParam('installId', msg.installation_id)]
    );

    // Audit the failure
    await executeStatement(
      `INSERT INTO cartridge_audit_log (tenant_id, cartridge_id, action, details, created_at)
       VALUES ($1, $2, $3, $4, NOW())`,
      [
        stringParam('tenantId', msg.tenant_id),
        stringParam('cartridgeId', msg.cartridge_id),
        stringParam('action', 'installation_failed'),
        stringParam('details', JSON.stringify({ error: (error as Error).message })),
      ]
    );

    throw error;
  }
}

// ============================================================================
// Target Processors — all S3 writes go through storage manager
// ============================================================================

async function processTarget(
  target: string,
  zip: InstanceType<Awaited<ReturnType<typeof import('adm-zip')>>['default']>,
  manifest: Record<string, unknown>,
  msg: InstallMessage,
): Promise<void> {
  logger.info(`Processing target: ${target}`, { cartridge_id: msg.cartridge_id });

  const sectionsPresent: string[] = (manifest.sections_present as string[]) || [];

  switch (target) {
    case 'omega':
      await processOmegaTarget(zip, sectionsPresent, manifest, msg);
      break;
    case 'cortex':
      await processCortexTarget(zip, sectionsPresent, manifest, msg);
      break;
    case 'cato':
      await processCatoTarget(zip, sectionsPresent, manifest, msg);
      break;
    case 'tenant':
      await processTenantTarget(zip, sectionsPresent, msg);
      break;
    default:
      logger.warn(`Unknown target: ${target}, skipping`);
  }
}

// ---------------------------------------------------------------------------
// OMEGA Target
// ---------------------------------------------------------------------------

async function processOmegaTarget(
  zip: any,
  sectionsPresent: string[],
  manifest: Record<string, unknown>,
  msg: InstallMessage,
): Promise<void> {
  // Process firmware/ section
  if (sectionsPresent.includes('firmware')) {
    await storeSectionFiles(zip, 'firmware', msg, 'firmware');
  }

  // Process qnodes/ section
  if (sectionsPresent.includes('qnodes')) {
    await storeSectionFiles(zip, 'qnodes', msg, 'qnodes');
  }

  // Process knowledge/ section — load facts into omega_library
  if (sectionsPresent.includes('knowledge')) {
    await storeSectionFiles(zip, 'knowledge', msg, 'knowledge');

    const factsEntry = zip.getEntry('knowledge/facts.json');
    if (factsEntry) {
      const facts = JSON.parse(factsEntry.getData().toString('utf8'));
      for (const fact of facts) {
        await executeStatement(
          `INSERT INTO omega_library (
            tenant_id, embedding, q_squared, source_context, memory_type, encoded_at
          ) VALUES ($1, $2, $3, $4, 'cartridge_fact', NOW())
          ON CONFLICT DO NOTHING`,
          [
            stringParam('tenantId', msg.tenant_id),
            stringParam('embedding', JSON.stringify(fact.embedding)),
            stringParam('qSquared', '1.0'),
            stringParam('text', fact.text),
          ]
        );
      }
    }
  }

  // Process soft_rom/ section
  if (sectionsPresent.includes('soft_rom')) {
    await storeSectionFiles(zip, 'soft_rom', msg, 'soft_rom');
  }
}

// ---------------------------------------------------------------------------
// CORTEX Target
// ---------------------------------------------------------------------------

async function processCortexTarget(
  zip: any,
  sectionsPresent: string[],
  manifest: Record<string, unknown>,
  msg: InstallMessage,
): Promise<void> {
  // Store CORTEX ONNX networks
  if (sectionsPresent.includes('cortex')) {
    await storeSectionFiles(zip, 'cortex', msg, 'cortex');
  }

  // Store LoRA adapters
  if (sectionsPresent.includes('lora')) {
    await storeSectionFiles(zip, 'lora', msg, 'lora');
  }

  // Store ESAs
  if (sectionsPresent.includes('esa')) {
    await storeSectionFiles(zip, 'esa', msg, 'esa');
  }

  // Notify CORTEX to hot-swap models
  await eb.send(new PutEventsCommand({
    Entries: [{
      Source: 'radiant.cartridge',
      DetailType: 'CortexModelUpdate',
      Detail: JSON.stringify({
        tenant_id: msg.tenant_id,
        cartridge_id: msg.cartridge_id,
      }),
    }],
  }));
}

// ---------------------------------------------------------------------------
// CATO Target
// ---------------------------------------------------------------------------

async function processCatoTarget(
  zip: any,
  sectionsPresent: string[],
  manifest: Record<string, unknown>,
  msg: InstallMessage,
): Promise<void> {
  // Process personality/ section — write config entries to cato_cartridge_config
  if (sectionsPresent.includes('personality')) {
    const personalityFiles = [
      'persona_config.json',
      'mood_profiles.json',
      'cato_incentives.json',
      'dream_schedule.json',
      'training_config.json',
      'promptbreeder_config.json',
    ];

    for (const filename of personalityFiles) {
      const entry = zip.getEntry(`personality/${filename}`);
      if (entry) {
        const configKey = filename.replace('.json', '');
        const configValue = JSON.parse(entry.getData().toString('utf8'));

        await executeStatement(
          `INSERT INTO cato_cartridge_config (tenant_id, config_key, config_value, source_cartridge_id, updated_at)
           VALUES ($1, $2, $3, $4, NOW())
           ON CONFLICT (tenant_id, config_key) DO UPDATE SET
             config_value = $3, source_cartridge_id = $4, updated_at = NOW()`,
          [
            stringParam('tenantId', msg.tenant_id),
            stringParam('key', configKey),
            stringParam('value', JSON.stringify(configValue)),
            stringParam('cartridgeId', msg.cartridge_id),
          ]
        );
      }
    }

    // Handle mood_profiles specially — upsert into genesis_personas
    const moodEntry = zip.getEntry('personality/mood_profiles.json');
    if (moodEntry) {
      const moods = JSON.parse(moodEntry.getData().toString('utf8'));
      for (const mood of moods) {
        await executeStatement(
          `INSERT INTO genesis_personas (id, name, display_name, description, scope, drives, default_gamma, voice, presentation, behavior, is_default, is_active)
           VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, TRUE)
           ON CONFLICT (name) DO UPDATE SET
             display_name = $2, description = $3, drives = $5, default_gamma = $6,
             voice = $7, presentation = $8, behavior = $9, is_active = TRUE`,
          [
            stringParam('name', mood.name),
            stringParam('displayName', mood.display_name),
            stringParam('description', mood.description || ''),
            stringParam('scope', mood.scope || 'system'),
            stringParam('drives', JSON.stringify(mood.drives)),
            stringParam('gamma', String(mood.gamma)),
            stringParam('voice', JSON.stringify(mood.voice || {})),
            stringParam('presentation', JSON.stringify(mood.presentation || {})),
            stringParam('behavior', JSON.stringify(mood.behavior || {})),
            stringParam('isDefault', String(mood.is_default || false)),
          ]
        );
      }
    }

    // Also store the raw files via storage manager
    await storeSectionFiles(zip, 'personality', msg, 'personality');
  }

  // Process cato_learned/ section
  if (sectionsPresent.includes('cato_learned')) {
    await storeSectionFiles(zip, 'cato_learned', msg, 'cato_learned');

    // Load evolved patterns
    const patternsEntry = zip.getEntry('cato_learned/evolved_patterns.json');
    if (patternsEntry) {
      const patterns = JSON.parse(patternsEntry.getData().toString('utf8'));
      for (const pattern of patterns) {
        await executeStatement(
          `INSERT INTO cato_evolved_patterns (tenant_id, pattern_text, fitness_score, source, created_at)
           VALUES ($1, $2, $3, 'cartridge', NOW())
           ON CONFLICT DO NOTHING`,
          [
            stringParam('tenantId', msg.tenant_id),
            stringParam('text', pattern.text),
            stringParam('fitness', String(pattern.fitness || 0.5)),
          ]
        );
      }
    }

    // Load knowledge graph nodes
    const graphEntry = zip.getEntry('cato_learned/knowledge_graph.json');
    if (graphEntry) {
      const graph = JSON.parse(graphEntry.getData().toString('utf8'));
      for (const node of (graph.nodes || [])) {
        await executeStatement(
          `INSERT INTO cortex_graph_nodes (id, tenant_id, node_type, label, properties, confidence, source, status, created_at)
           VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, 'cartridge', 'active', NOW())
           ON CONFLICT DO NOTHING`,
          [
            stringParam('tenantId', msg.tenant_id),
            stringParam('type', node.type),
            stringParam('label', node.label),
            stringParam('props', JSON.stringify(node.properties || {})),
            stringParam('confidence', String(node.confidence || 0.5)),
          ]
        );
      }
    }

    // Load procedural memories
    const procEntry = zip.getEntry('cato_learned/procedural_memories.json');
    if (procEntry) {
      const memories = JSON.parse(procEntry.getData().toString('utf8'));
      for (const memory of memories) {
        await executeStatement(
          `INSERT INTO cato_memories (tenant_id, category, key, value, importance, source, created_at)
           VALUES ($1, 'procedural', $2, $3, $4, 'cartridge', NOW())
           ON CONFLICT DO NOTHING`,
          [
            stringParam('tenantId', msg.tenant_id),
            stringParam('key', memory.key),
            stringParam('value', JSON.stringify(memory.value)),
            stringParam('importance', String(memory.importance || 0.5)),
          ]
        );
      }
    }
  }

  // Process ghost/ section
  if (sectionsPresent.includes('ghost')) {
    await storeSectionFiles(zip, 'ghost', msg, 'ghost');
  }

  // Notify CATO to reload config
  await eb.send(new PutEventsCommand({
    Entries: [{
      Source: 'radiant.cartridge',
      DetailType: 'CatoConfigUpdate',
      Detail: JSON.stringify({
        tenant_id: msg.tenant_id,
        cartridge_id: msg.cartridge_id,
      }),
    }],
  }));
}

// ---------------------------------------------------------------------------
// Tenant Target
// ---------------------------------------------------------------------------

async function processTenantTarget(
  zip: any,
  sectionsPresent: string[],
  msg: InstallMessage,
): Promise<void> {
  if (sectionsPresent.includes('tenant_config')) {
    const configFiles = ['routing_overrides.json', 'feature_flags.json', 'compliance_config.json'];

    for (const filename of configFiles) {
      const entry = zip.getEntry(`tenant_config/${filename}`);
      if (entry) {
        const configKey = filename.replace('.json', '');
        const configValue = JSON.parse(entry.getData().toString('utf8'));

        await executeStatement(
          `INSERT INTO cato_cartridge_config (tenant_id, config_key, config_value, source_cartridge_id, updated_at)
           VALUES ($1, $2, $3, $4, NOW())
           ON CONFLICT (tenant_id, config_key) DO UPDATE SET
             config_value = $3, source_cartridge_id = $4, updated_at = NOW()`,
          [
            stringParam('tenantId', msg.tenant_id),
            stringParam('key', configKey),
            stringParam('value', JSON.stringify(configValue)),
            stringParam('cartridgeId', msg.cartridge_id),
          ]
        );
      }
    }

    // Also store raw files via storage manager
    await storeSectionFiles(zip, 'tenant_config', msg, 'tenant_config');
  }
}

// ============================================================================
// Helper — store all files in a section via cartridgeStorageManager
// ============================================================================

async function storeSectionFiles(
  zip: any,
  sectionPrefix: string,
  msg: InstallMessage,
  category: string,
): Promise<void> {
  for (const entry of zip.getEntries()) {
    if (entry.entryName.startsWith(`${sectionPrefix}/`) && !entry.isDirectory) {
      const filename = entry.entryName.replace(`${sectionPrefix}/`, '');
      await cartridgeStorageManager.storeSectionFile(
        msg.tenant_id,
        msg.cartridge_id,
        sectionPrefix,
        category,
        filename,
        entry.getData(),
      );
    }
  }
}
