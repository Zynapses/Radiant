/**
 * Cartridge Resolution Worker
 * Triggered by SQS after cartridge install/uninstall/reorder.
 * Runs the stacking resolution engine and persists the result.
 */

import type { SQSEvent, SQSRecord } from 'aws-lambda';
import { createRegisteredLogger } from '../shared/services/logging-registry.service';
import { resolveAndPersist } from '../shared/cartridge/resolution';
import { executeStatement, stringParam } from '../shared/db/client';

const logger = createRegisteredLogger({
  serviceName: 'worker/cartridge-resolution',
  category: 'infrastructure',
  sourceType: 'lambda',
});

interface ResolutionMessage {
  tenant_id: string;
  reason: string;
  cartridge_id?: string;
}

export async function handler(event: SQSEvent): Promise<void> {
  for (const record of event.Records) {
    await processResolution(record);
  }
}

async function processResolution(record: SQSRecord): Promise<void> {
  const msg: ResolutionMessage = JSON.parse(record.body);
  logger.info('Running cartridge resolution', { tenant_id: msg.tenant_id, reason: msg.reason });

  try {
    const resolved = await resolveAndPersist(msg.tenant_id);

    await executeStatement(
      `INSERT INTO cartridge_audit_log (tenant_id, cartridge_id, action, details, created_at)
       VALUES ($1, $2, $3, $4, NOW())`,
      [
        stringParam('tenantId', msg.tenant_id),
        stringParam('cartridgeId', msg.cartridge_id || ''),
        stringParam('action', 'resolution_completed'),
        stringParam('details', JSON.stringify({
          reason: msg.reason,
          sections_resolved: Object.keys(resolved.section_sources).length,
          resolved_at: resolved.resolved_at,
        })),
      ]
    );

    logger.info('Resolution complete', {
      tenant_id: msg.tenant_id,
      sections: Object.keys(resolved.section_sources).length,
    });
  } catch (error) {
    logger.error('Resolution failed', { tenant_id: msg.tenant_id, error });
    throw error;
  }
}
