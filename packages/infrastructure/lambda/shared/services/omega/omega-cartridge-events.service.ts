/**
 * RADIANT OMEGA Cartridge Event Listener
 *
 * Handles EventBridge events that trigger cartridge reloads:
 * - CortexModelUpdate: A cortex model cartridge was installed/uninstalled
 * - CatoConfigUpdate: A CATO personality cartridge changed
 * - CartridgeInstalled: New cartridge installed for tenant
 * - CartridgeUninstalled: Cartridge removed from tenant
 * - CartridgeResolved: Resolution engine ran, resolved state updated
 *
 * On any relevant event, the OMEGA brain hot-reloads its cartridge state
 * without a full restart.
 */

import { createRegisteredLogger } from '../logging-registry.service';
import { omegaCartridgeBootService, type OmegaBrainState } from './omega-cartridge-boot.service';

const logger = createRegisteredLogger({
  serviceName: 'omega/cartridge-events',
  category: 'intelligence',
  sourceType: 'application',
});

// ============================================================================
// Types
// ============================================================================

export interface CartridgeEvent {
  source: string;
  'detail-type': string;
  detail: {
    tenant_id: string;
    cartridge_id?: string;
    cartridge_name?: string;
    target_service?: string;
    action?: string;
    timestamp?: string;
  };
}

export type CartridgeEventHandler = (tenantId: string, newState: OmegaBrainState) => Promise<void>;

// ============================================================================
// Event Listener Service
// ============================================================================

class OmegaCartridgeEventService {
  private handlers: Map<string, CartridgeEventHandler[]> = new Map();

  /**
   * Register a handler to be called when a cartridge event triggers a reload.
   */
  onReload(tenantId: string, handler: CartridgeEventHandler): void {
    const existing = this.handlers.get(tenantId) || [];
    existing.push(handler);
    this.handlers.set(tenantId, existing);
  }

  /**
   * Remove all handlers for a tenant.
   */
  removeHandlers(tenantId: string): void {
    this.handlers.delete(tenantId);
  }

  /**
   * Process an EventBridge event and trigger cartridge reload if relevant.
   */
  async handleEvent(event: CartridgeEvent): Promise<{
    handled: boolean;
    reloaded: boolean;
    tenantId: string | null;
    reason: string;
  }> {
    const detailType = event['detail-type'];
    const tenantId = event.detail?.tenant_id;

    if (!tenantId) {
      return { handled: false, reloaded: false, tenantId: null, reason: 'No tenant_id in event' };
    }

    const relevantEvents = [
      'CortexModelUpdate',
      'CatoConfigUpdate',
      'CartridgeInstalled',
      'CartridgeUninstalled',
      'CartridgeResolved',
      'FirmwareUpdate',
    ];

    if (!relevantEvents.includes(detailType)) {
      return { handled: false, reloaded: false, tenantId, reason: `Event type ${detailType} not relevant to OMEGA` };
    }

    // Check if the event targets omega
    const targetService = event.detail?.target_service;
    if (targetService && targetService !== 'omega' && targetService !== 'global') {
      return { handled: true, reloaded: false, tenantId, reason: `Event targets ${targetService}, not omega` };
    }

    logger.info('Cartridge event received — triggering OMEGA reload', {
      detailType,
      tenantId,
      cartridgeId: event.detail?.cartridge_id,
      action: event.detail?.action,
    });

    try {
      // Re-run the boot sequence to pick up new cartridge state
      const newState = await omegaCartridgeBootService.bootBrain(tenantId);

      // Notify registered handlers
      const handlers = this.handlers.get(tenantId) || [];
      for (const handler of handlers) {
        try {
          await handler(tenantId, newState);
        } catch (error) {
          logger.error('Cartridge event handler failed', { tenantId, error });
        }
      }

      logger.info('OMEGA cartridge reload complete', {
        tenantId,
        status: newState.status,
        bootDurationMs: newState.bootDurationMs,
        handlersNotified: handlers.length,
      });

      return { handled: true, reloaded: true, tenantId, reason: `Reloaded from ${detailType}` };
    } catch (error) {
      logger.error('OMEGA cartridge reload failed', { tenantId, detailType, error });
      return { handled: true, reloaded: false, tenantId, reason: `Reload failed: ${error instanceof Error ? error.message : 'unknown'}` };
    }
  }
}

// Export singleton
export const omegaCartridgeEventService = new OmegaCartridgeEventService();
