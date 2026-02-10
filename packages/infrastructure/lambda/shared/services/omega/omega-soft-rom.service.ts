/**
 * RADIANT OMEGA Soft ROM Service
 *
 * Manages reading and writing of Soft ROM deltas — the brain's accumulated
 * learning on top of the installed cartridge base weights.
 *
 * Soft ROM = current weights MINUS installed cartridge base weights.
 *
 * ALL S3 storage goes through the cartridgeStorageManager — no direct S3 calls.
 */

import { createRegisteredLogger } from '../logging-registry.service';
import { cartridgeStorageManager } from '../cartridge-storage-manager.service';

const logger = createRegisteredLogger({
  serviceName: 'omega/soft-rom',
  category: 'intelligence',
  sourceType: 'application',
});

// ============================================================================
// Types
// ============================================================================

export interface SoftRomDelta {
  version: string;
  tenantId: string;
  weightDeltas: Record<string, Buffer>;
  connectionDeltas: ConnectionDelta[];
  subClusterMap: Record<string, SubClusterEntry>;
  preferences: SoftRomPreferences;
  totalDeltas: number;
  newConnections: number;
  createdAt: string;
}

export interface ConnectionDelta {
  sourceIndex: number;
  targetIndex: number;
  strengthDelta: number;
  phaseDelta: number;
  isNew: boolean;
}

export interface SubClusterEntry {
  parentCluster: string;
  specialization: string;
  nodeIndices: number[];
  avgActivation: number;
}

export interface SoftRomPreferences {
  requestedScaling: Record<string, number>;
  thetaOverride: number | null;
  plasticityOverride: number | null;
  researchTopicsPending: string[];
  optimizationHistory: Array<{
    adjustment: string;
    oldValue: number;
    newValue: number;
    timestamp: string;
  }>;
  updatedAt: string;
}

export interface NetworkWeights {
  [networkName: string]: Float64Array | number[];
}

// ============================================================================
// Soft ROM Service
// ============================================================================

export class OmegaSoftRomService {

  /**
   * Load the Soft ROM delta for a tenant from storage manager.
   * Returns null if no Soft ROM exists (new brain or reset).
   */
  async loadSoftRom(tenantId: string): Promise<SoftRomDelta | null> {
    const startTime = Date.now();
    try {
      const manifestRef = cartridgeStorageManager.buildOmegaStatePath(
        tenantId, 'soft-rom', 'manifest.json'
      );

      const manifestResult = await cartridgeStorageManager.retrieveContent(manifestRef);
      if (!manifestResult) {
        logger.info('No Soft ROM found for tenant', { tenantId });
        return null;
      }

      const manifest = JSON.parse(manifestResult.data.toString('utf-8'));

      // Load weight deltas
      const weightDeltas: Record<string, Buffer> = {};
      for (const networkName of (manifest.networks || [])) {
        const deltaRef = cartridgeStorageManager.buildOmegaStatePath(
          tenantId, 'soft-rom', `weight_deltas/${networkName}.msgpack`
        );
        const deltaResult = await cartridgeStorageManager.retrieveContent(deltaRef);
        if (deltaResult) {
          weightDeltas[networkName] = deltaResult.data;
        }
      }

      // Load connection deltas
      const connRef = cartridgeStorageManager.buildOmegaStatePath(
        tenantId, 'soft-rom', 'connection_deltas.msgpack'
      );
      const connResult = await cartridgeStorageManager.retrieveContent(connRef);
      let connectionDeltas: ConnectionDelta[] = [];
      if (connResult) {
        try {
          const msgpack = await import('msgpackr');
          connectionDeltas = msgpack.unpack(connResult.data) as ConnectionDelta[];
        } catch {
          connectionDeltas = JSON.parse(connResult.data.toString('utf-8'));
        }
      }

      // Load sub-cluster map
      const subRef = cartridgeStorageManager.buildOmegaStatePath(
        tenantId, 'soft-rom', 'sub_cluster_map.json'
      );
      const subResult = await cartridgeStorageManager.retrieveContent(subRef);
      let subClusterMap: Record<string, SubClusterEntry> = {};
      if (subResult) {
        subClusterMap = JSON.parse(subResult.data.toString('utf-8'));
      }

      // Load preferences
      const prefRef = cartridgeStorageManager.buildOmegaStatePath(
        tenantId, 'soft-rom', 'preferences.json'
      );
      const prefResult = await cartridgeStorageManager.retrieveContent(prefRef);
      let preferences: SoftRomPreferences = {
        requestedScaling: {},
        thetaOverride: null,
        plasticityOverride: null,
        researchTopicsPending: [],
        optimizationHistory: [],
        updatedAt: new Date().toISOString(),
      };
      if (prefResult) {
        preferences = JSON.parse(prefResult.data.toString('utf-8'));
      }

      const delta: SoftRomDelta = {
        version: manifest.version || '1.0.0',
        tenantId,
        weightDeltas,
        connectionDeltas,
        subClusterMap,
        preferences,
        totalDeltas: Object.values(weightDeltas).reduce((sum, buf) => sum + buf.length, 0),
        newConnections: connectionDeltas.filter(c => c.isNew).length,
        createdAt: manifest.createdAt || new Date().toISOString(),
      };

      logger.info('Soft ROM loaded', {
        tenantId,
        version: delta.version,
        networks: Object.keys(weightDeltas).length,
        totalDeltaBytes: delta.totalDeltas,
        newConnections: delta.newConnections,
        durationMs: Date.now() - startTime,
      });

      return delta;
    } catch (error) {
      logger.error('Failed to load Soft ROM', { tenantId, error });
      return null;
    }
  }

  /**
   * Write the Soft ROM delta for a tenant to storage manager.
   *
   * Called at the end of each Dream Cycle Phase 8.
   * Computes delta = current weights - cartridge base weights.
   *
   * ALL writes go through cartridgeStorageManager.storeContent().
   */
  async writeSoftRom(
    tenantId: string,
    currentWeights: NetworkWeights,
    cartridgeBaseWeights: NetworkWeights,
    connectionDeltas: ConnectionDelta[],
    subClusterMap: Record<string, SubClusterEntry>,
    preferences: SoftRomPreferences,
  ): Promise<{ totalDeltaBytes: number; networksWritten: number }> {
    const startTime = Date.now();
    let totalDeltaBytes = 0;
    let networksWritten = 0;

    const cartridgeId = `soft-rom-${tenantId}`;

    try {
      // Compute and write weight deltas for each network
      const networkNames: string[] = [];
      for (const [networkName, current] of Object.entries(currentWeights)) {
        const base = cartridgeBaseWeights[networkName];
        let deltaBuffer: Buffer;

        if (base) {
          // Delta = current - base
          const delta = subtractWeights(current, base);
          deltaBuffer = serializeWeights(delta);
        } else {
          // New network not in cartridge — store full weights as delta
          deltaBuffer = serializeWeights(current);
        }

        await cartridgeStorageManager.storeContent(
          tenantId,
          cartridgeId,
          'soft_rom',
          `weight_deltas/${networkName}.msgpack`,
          deltaBuffer,
          'application/x-msgpack',
        );

        networkNames.push(networkName);
        totalDeltaBytes += deltaBuffer.length;
        networksWritten++;
      }

      // Write connection deltas
      let connBuffer: Buffer;
      try {
        const msgpack = await import('msgpackr');
        connBuffer = Buffer.from(msgpack.pack(connectionDeltas));
      } catch {
        connBuffer = Buffer.from(JSON.stringify(connectionDeltas));
      }

      await cartridgeStorageManager.storeContent(
        tenantId,
        cartridgeId,
        'soft_rom',
        'connection_deltas.msgpack',
        connBuffer,
        'application/x-msgpack',
      );

      // Write sub-cluster map
      await cartridgeStorageManager.storeContent(
        tenantId,
        cartridgeId,
        'soft_rom',
        'sub_cluster_map.json',
        Buffer.from(JSON.stringify(subClusterMap)),
        'application/json',
      );

      // Write preferences
      await cartridgeStorageManager.storeContent(
        tenantId,
        cartridgeId,
        'soft_rom',
        'preferences.json',
        Buffer.from(JSON.stringify({
          ...preferences,
          updatedAt: new Date().toISOString(),
        })),
        'application/json',
      );

      // Write manifest (index of all files)
      const manifest = {
        version: '1.0.0',
        tenantId,
        networks: networkNames,
        totalDeltaBytes,
        networksWritten,
        connectionDeltaCount: connectionDeltas.length,
        subClusterCount: Object.keys(subClusterMap).length,
        createdAt: new Date().toISOString(),
      };

      await cartridgeStorageManager.storeContent(
        tenantId,
        cartridgeId,
        'soft_rom',
        'manifest.json',
        Buffer.from(JSON.stringify(manifest)),
        'application/json',
      );

      logger.info('Soft ROM written', {
        tenantId,
        networksWritten,
        totalDeltaBytes,
        connectionDeltas: connectionDeltas.length,
        subClusters: Object.keys(subClusterMap).length,
        durationMs: Date.now() - startTime,
      });

      return { totalDeltaBytes, networksWritten };
    } catch (error) {
      logger.error('Failed to write Soft ROM', { tenantId, error });
      throw error;
    }
  }
}

// ============================================================================
// Weight Math Helpers
// ============================================================================

function subtractWeights(
  current: Float64Array | number[],
  base: Float64Array | number[],
): number[] {
  const result: number[] = [];
  const len = Math.max(current.length, base.length);
  for (let i = 0; i < len; i++) {
    const c = i < current.length ? (current as number[])[i] ?? current[i] : 0;
    const b = i < base.length ? (base as number[])[i] ?? base[i] : 0;
    result.push(c - b);
  }
  return result;
}

function serializeWeights(weights: Float64Array | number[]): Buffer {
  const arr = Array.isArray(weights) ? weights : Array.from(weights);
  const float64 = new Float64Array(arr);
  return Buffer.from(float64.buffer);
}

// Export singleton
export const omegaSoftRomService = new OmegaSoftRomService();
