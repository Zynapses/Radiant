/**
 * RADIANT OMEGA Cartridge Boot Service
 *
 * Orchestrates the cartridge-first brain boot sequence:
 * 1. Load resolved cartridge state from DB
 * 2. Load firmware (safety floor) — ALWAYS FIRST
 * 3. Load Q-Node weights from cartridge
 * 4. Load Soft ROM delta (brain's own learning)
 * 5. Load knowledge facts into Library
 * 6. Initialize Ambition from cartridge config
 * 7. Initialize Helix with firmware safety floor
 * 8. Brain ready
 *
 * ALL S3 storage goes through cartridgeStorageManager — no direct S3 calls.
 */

import { createRegisteredLogger } from '../logging-registry.service';
import { cartridgeStorageManager } from '../cartridge-storage-manager.service';
import { FirmwareEnforcer, type FirmwareConfig, type AmbitionConfig, type DevelopmentScheduleConfig, type ActionGateConfig } from './omega-firmware-enforcer.service';
import { OmegaAmbitionService, createFactoryAmbitionService } from './omega-ambition.service';
import { omegaSoftRomService, type SoftRomDelta, type NetworkWeights } from './omega-soft-rom.service';
import { type QuantumStateVector } from './quantum-types';
import { equalSuperposition } from './quantum-math';

const logger = createRegisteredLogger({
  serviceName: 'omega/cartridge-boot',
  category: 'intelligence',
  sourceType: 'application',
});

// ============================================================================
// Types
// ============================================================================

export interface ResolvedCartridgeState {
  tenant_id: string;
  resolved_firmware: Record<string, unknown>;
  resolved_sections: Record<string, {
    cartridge_id: string;
    cartridge_name: string;
    cartridge_type: string;
    priority: number;
  }>;
  section_sources: Record<string, {
    cartridge_id: string;
    cartridge_name: string;
    cartridge_type: string;
    priority: number;
  }>;
  resolution_log: string[];
  resolved_at: string;
}

export interface OmegaBrainState {
  tenantId: string;
  networks: Record<string, QuantumStateVector>;
  ambition: OmegaAmbitionService;
  firmwareEnforcer: FirmwareEnforcer;
  firmwareConfig: FirmwareConfig | null;
  ambitionConfig: AmbitionConfig | null;
  developmentSchedule: DevelopmentScheduleConfig | null;
  actionGateConfig: ActionGateConfig | null;
  softRomVersion: string | null;
  softRomDelta: SoftRomDelta | null;
  cartridgeBaseWeights: NetworkWeights;
  cartridgeStack: Record<string, unknown>;
  knowledgeFacts: KnowledgeFact[];
  bootLog: string[];
  bootedAt: string;
  bootDurationMs: number;
  status: 'active' | 'factory_defaults' | 'degraded';
}

export interface KnowledgeFact {
  id: string;
  text: string;
  embedding?: number[];
  source: string;
  priority: number;
  category: string;
}

export interface CartridgeHealthCheck {
  healthy: boolean;
  resolvedStateExists: boolean;
  firmwareLoaded: boolean;
  qnodeWeightsLoaded: boolean;
  softRomLoaded: boolean;
  knowledgeLoaded: boolean;
  issues: string[];
  checkedAt: string;
}

// ============================================================================
// Boot Service
// ============================================================================

class OmegaCartridgeBootService {

  /**
   * OMEGA Brain Boot Sequence — Cartridge-First
   *
   * Order matters. Each step depends on the previous.
   */
  async bootBrain(tenantId: string): Promise<OmegaBrainState> {
    const startTime = Date.now();
    const log: string[] = [];

    try {
      // STEP 1: Load resolved cartridge state from DB
      const resolved = await this.loadResolvedCartridgeState(tenantId);
      if (!resolved) {
        log.push('WARNING: No cartridge state found. Booting with factory defaults.');
        return this.bootWithFactoryDefaults(tenantId, log, startTime);
      }

      const sectionSources = resolved.resolved_sections || resolved.section_sources || {};
      log.push(`Resolved cartridge state loaded. ${Object.keys(sectionSources).length} sections from ${new Set(Object.values(sectionSources).map(s => s.cartridge_name)).size} cartridges.`);

      // STEP 2: Load firmware (safety floor) — ALWAYS FIRST
      let firmwareConfig: FirmwareConfig | null = null;
      let firmwareEnforcer: FirmwareEnforcer;
      let ambitionConfig: AmbitionConfig | null = null;
      let developmentSchedule: DevelopmentScheduleConfig | null = null;
      let actionGateConfig: ActionGateConfig | null = null;

      try {
        const fwResult = await this.loadFirmwareFromCartridge(tenantId, resolved);
        firmwareConfig = fwResult.firmwareConfig;
        ambitionConfig = fwResult.ambitionConfig;
        developmentSchedule = fwResult.developmentSchedule;
        actionGateConfig = fwResult.actionGateConfig;
        firmwareEnforcer = new FirmwareEnforcer(firmwareConfig);

        const vetoCount = firmwareEnforcer.getThreatGeometryCount();
        log.push(`Firmware loaded. ${vetoCount} veto categories. Ambition config: ${ambitionConfig ? 'YES' : 'DEFAULTS'}. Development schedule: ${developmentSchedule ? 'YES' : 'NONE'}. Action gate: ${actionGateConfig ? 'YES' : 'NONE'}.`);
      } catch (error) {
        log.push(`WARNING: Firmware load failed: ${error instanceof Error ? error.message : 'unknown'}. Using empty safety floor.`);
        firmwareConfig = { veto_thresholds: { categories: {} } };
        firmwareEnforcer = new FirmwareEnforcer(firmwareConfig);
      }

      // STEP 3: Load Q-Node weights from cartridge (pre-learned networks)
      let networks: Record<string, QuantumStateVector> = {};
      let cartridgeBaseWeights: NetworkWeights = {};

      try {
        const qnodeResult = await this.loadQNodeWeightsFromCartridge(tenantId, resolved);
        networks = qnodeResult.networks;
        cartridgeBaseWeights = qnodeResult.rawWeights;
        log.push(`Q-Node weights loaded. ${qnodeResult.networksLoaded} networks, ${qnodeResult.totalQNodes} Q-Nodes.`);
      } catch (error) {
        log.push(`WARNING: Q-Node weight load failed: ${error instanceof Error ? error.message : 'unknown'}. Using equal superposition.`);
        networks = { default: equalSuperposition(1024) };
      }

      // STEP 4: Load Soft ROM delta (brain's own learning on top of cartridge base)
      let softRomDelta: SoftRomDelta | null = null;
      try {
        softRomDelta = await omegaSoftRomService.loadSoftRom(tenantId);
        if (softRomDelta) {
          this.applySoftRomDeltas(networks, softRomDelta);
          log.push(`Soft ROM applied. ${softRomDelta.totalDeltas} weight delta bytes, ${softRomDelta.newConnections} new connections.`);
        } else {
          log.push('No Soft ROM found. Brain starting from cartridge base only (new brain or reset).');
        }
      } catch (error) {
        log.push(`WARNING: Soft ROM load failed: ${error instanceof Error ? error.message : 'unknown'}. Continuing without.`);
      }

      // STEP 5: Load knowledge into Library (cartridge facts + existing memories)
      let knowledgeFacts: KnowledgeFact[] = [];
      try {
        knowledgeFacts = await this.loadCartridgeKnowledge(tenantId, resolved);
        log.push(`Knowledge loaded. ${knowledgeFacts.length} verified facts (5.0x priority).`);
      } catch (error) {
        log.push(`WARNING: Knowledge load failed: ${error instanceof Error ? error.message : 'unknown'}.`);
      }

      // STEP 6: Initialize Ambition system from cartridge config
      const ambition = new OmegaAmbitionService(ambitionConfig || undefined);
      const chemicals = ambition.getChemicals();
      log.push(`Ambition initialized. Chemicals: dopamine=${chemicals.dopamine.toFixed(2)}, entropy=${chemicals.entropy.toFixed(2)}, curiosity=${chemicals.curiosity.toFixed(2)}`);

      // STEP 7: Initialize Helix with firmware safety floor (FirmwareEnforcer already created in Step 2)
      log.push(`Helix safety floor active. ${firmwareEnforcer.getThreatGeometryCount()} threat vectors. Minimum veto thresholds enforced.`);

      // STEP 8: Brain is ready
      const bootDurationMs = Date.now() - startTime;
      log.push(`OMEGA brain online. Consciousness cycle ready. Boot took ${bootDurationMs}ms.`);

      const brainState: OmegaBrainState = {
        tenantId,
        networks,
        ambition,
        firmwareEnforcer,
        firmwareConfig,
        ambitionConfig,
        developmentSchedule,
        actionGateConfig,
        softRomVersion: softRomDelta?.version || null,
        softRomDelta,
        cartridgeBaseWeights,
        cartridgeStack: sectionSources,
        knowledgeFacts,
        bootLog: log,
        bootedAt: new Date().toISOString(),
        bootDurationMs,
        status: 'active',
      };

      // Emit metric
      logger.info('OMEGA brain booted from cartridges', {
        tenantId,
        cartridge_boot_duration_ms: bootDurationMs,
        networks: Object.keys(networks).length,
        knowledgeFacts: knowledgeFacts.length,
        softRomApplied: !!softRomDelta,
        firmware: !!firmwareConfig,
        status: 'active',
      });

      return brainState;

    } catch (error) {
      // FALLBACK: if cartridge state is corrupted, fall back to factory defaults
      log.push(`CRITICAL: Boot sequence failed: ${error instanceof Error ? error.message : 'unknown'}. Falling back to factory defaults.`);

      logger.error('OMEGA cartridge boot failed — falling back to factory defaults', {
        tenantId,
        error,
      });

      return this.bootWithFactoryDefaults(tenantId, log, startTime);
    }
  }

  /**
   * Boot with factory defaults — no cartridge state available.
   */
  private bootWithFactoryDefaults(
    tenantId: string,
    log: string[],
    startTime: number,
  ): OmegaBrainState {
    const ambition = createFactoryAmbitionService();
    const firmwareConfig: FirmwareConfig = { veto_thresholds: { categories: {} } };
    const firmwareEnforcer = new FirmwareEnforcer(firmwareConfig);
    const bootDurationMs = Date.now() - startTime;

    log.push(`Factory defaults loaded. Boot took ${bootDurationMs}ms.`);

    return {
      tenantId,
      networks: { default: equalSuperposition(1024) },
      ambition,
      firmwareEnforcer,
      firmwareConfig,
      ambitionConfig: null,
      developmentSchedule: null,
      actionGateConfig: null,
      softRomVersion: null,
      softRomDelta: null,
      cartridgeBaseWeights: {},
      cartridgeStack: {},
      knowledgeFacts: [],
      bootLog: log,
      bootedAt: new Date().toISOString(),
      bootDurationMs,
      status: 'factory_defaults',
    };
  }

  // ==========================================================================
  // Step 1: Load Resolved Cartridge State
  // ==========================================================================

  private async loadResolvedCartridgeState(tenantId: string): Promise<ResolvedCartridgeState | null> {
    const { executeStatement, stringParam } = await import('../../db/client.js');

    const result = await executeStatement(
      `SELECT tenant_id, resolved_firmware, resolved_sections, resolution_log, resolved_at
       FROM cartridge_resolved_state
       WHERE tenant_id = $1
       ORDER BY resolved_at DESC
       LIMIT 1`,
      [stringParam('tenantId', tenantId)]
    );

    if (!result.rows || result.rows.length === 0) return null;

    const row = result.rows[0] as any;
    return {
      tenant_id: row.tenant_id,
      resolved_firmware: typeof row.resolved_firmware === 'string'
        ? JSON.parse(row.resolved_firmware) : (row.resolved_firmware || {}),
      resolved_sections: typeof row.resolved_sections === 'string'
        ? JSON.parse(row.resolved_sections) : (row.resolved_sections || {}),
      section_sources: typeof row.resolved_sections === 'string'
        ? JSON.parse(row.resolved_sections) : (row.resolved_sections || {}),
      resolution_log: typeof row.resolution_log === 'string'
        ? JSON.parse(row.resolution_log) : (row.resolution_log || []),
      resolved_at: row.resolved_at,
    };
  }

  // ==========================================================================
  // Step 2: Load Firmware from Cartridge
  // ==========================================================================

  private async loadFirmwareFromCartridge(
    tenantId: string,
    resolved: ResolvedCartridgeState,
  ): Promise<{
    firmwareConfig: FirmwareConfig;
    ambitionConfig: AmbitionConfig | null;
    developmentSchedule: DevelopmentScheduleConfig | null;
    actionGateConfig: ActionGateConfig | null;
  }> {
    // Build firmware from resolved state
    const firmwareSection = resolved.resolved_firmware || {};

    // Default firmware if none in resolved state
    let firmwareConfig: FirmwareConfig = {
      veto_thresholds: { categories: {} },
    };
    let ambitionConfig: AmbitionConfig | null = null;
    let developmentSchedule: DevelopmentScheduleConfig | null = null;
    let actionGateConfig: ActionGateConfig | null = null;

    // Check if we have a firmware cartridge in the section sources
    const fwSections = resolved.resolved_sections || {};

    // Load veto_thresholds.json from cartridge
    const fwSource = fwSections['firmware'] || fwSections['veto_thresholds'];
    if (fwSource) {
      const vetoRef = cartridgeStorageManager.buildOmegaStatePath(
        tenantId, 'firmware', 'veto_thresholds.json'
      );
      const vetoResult = await cartridgeStorageManager.retrieveContent(vetoRef);
      if (vetoResult) {
        const parsed = JSON.parse(vetoResult.data.toString('utf-8'));
        firmwareConfig.veto_thresholds = parsed;
      }

      // Load parameter_bounds.json
      const boundsRef = cartridgeStorageManager.buildOmegaStatePath(
        tenantId, 'firmware', 'parameter_bounds.json'
      );
      const boundsResult = await cartridgeStorageManager.retrieveContent(boundsRef);
      if (boundsResult) {
        firmwareConfig.parameter_bounds = JSON.parse(boundsResult.data.toString('utf-8'));
      }
    }

    // Load ambition_config.json from cartridge
    const ambitionSource = fwSections['ambition'] || fwSections['ambition_config'];
    if (ambitionSource) {
      const ambRef = cartridgeStorageManager.buildOmegaStatePath(
        tenantId, 'firmware', 'ambition_config.json'
      );
      const ambResult = await cartridgeStorageManager.retrieveContent(ambRef);
      if (ambResult) {
        ambitionConfig = JSON.parse(ambResult.data.toString('utf-8'));
      }
    }

    // Load development_schedule.json
    const devSource = fwSections['development_schedule'];
    if (devSource) {
      const devRef = cartridgeStorageManager.buildOmegaStatePath(
        tenantId, 'firmware', 'development_schedule.json'
      );
      const devResult = await cartridgeStorageManager.retrieveContent(devRef);
      if (devResult) {
        developmentSchedule = JSON.parse(devResult.data.toString('utf-8'));
        firmwareConfig.development_schedule = developmentSchedule!;
      }
    }

    // Load action_gate_config.json
    const gateSource = fwSections['action_gate'];
    if (gateSource) {
      const gateRef = cartridgeStorageManager.buildOmegaStatePath(
        tenantId, 'firmware', 'action_gate_config.json'
      );
      const gateResult = await cartridgeStorageManager.retrieveContent(gateRef);
      if (gateResult) {
        actionGateConfig = JSON.parse(gateResult.data.toString('utf-8'));
        firmwareConfig.action_gate_config = actionGateConfig!;
      }
    }

    // Also merge any firmware values from resolved_firmware (from resolution engine)
    if (firmwareSection && typeof firmwareSection === 'object') {
      if ((firmwareSection as any).veto_thresholds) {
        firmwareConfig.veto_thresholds = (firmwareSection as any).veto_thresholds;
      }
      if ((firmwareSection as any).parameter_bounds) {
        firmwareConfig.parameter_bounds = (firmwareSection as any).parameter_bounds;
      }
    }

    return { firmwareConfig, ambitionConfig, developmentSchedule, actionGateConfig };
  }

  // ==========================================================================
  // Step 3: Load Q-Node Weights from Cartridge
  // ==========================================================================

  private async loadQNodeWeightsFromCartridge(
    tenantId: string,
    resolved: ResolvedCartridgeState,
  ): Promise<{
    networks: Record<string, QuantumStateVector>;
    rawWeights: NetworkWeights;
    networksLoaded: number;
    totalQNodes: number;
  }> {
    const networks: Record<string, QuantumStateVector> = {};
    const rawWeights: NetworkWeights = {};
    let totalQNodes = 0;

    const sectionSources = resolved.resolved_sections || {};

    // Look for qnodes section
    const qnodeSource = sectionSources['qnodes'] || sectionSources['q_nodes'] || sectionSources['weights'];
    if (!qnodeSource) {
      // No Q-Node weights in cartridge — use default
      networks['default'] = equalSuperposition(1024);
      return { networks, rawWeights, networksLoaded: 0, totalQNodes: 1024 };
    }

    // Load network manifest to find all network files
    const manifestRef = cartridgeStorageManager.buildOmegaStatePath(
      tenantId, 'qnodes', 'network_manifest.json'
    );
    const manifestResult = await cartridgeStorageManager.retrieveContent(manifestRef);

    let networkNames: string[] = ['default'];
    if (manifestResult) {
      const manifest = JSON.parse(manifestResult.data.toString('utf-8'));
      networkNames = manifest.networks || ['default'];
    }

    for (const networkName of networkNames) {
      // Try loading as msgpack first, then safetensors, then JSON
      const msgpackRef = cartridgeStorageManager.buildOmegaStatePath(
        tenantId, 'qnodes', `${networkName}.msgpack`
      );
      const msgpackResult = await cartridgeStorageManager.retrieveContent(msgpackRef);

      if (msgpackResult) {
        try {
          const msgpack = await import('msgpackr');
          const data = msgpack.unpack(msgpackResult.data) as { amplitudes_real: number[]; amplitudes_imaginary: number[] };
          const dim = data.amplitudes_real.length;
          const amplitudes = data.amplitudes_real.map((r: number, i: number) => ({
            real: r,
            imaginary: data.amplitudes_imaginary[i] || 0,
          }));

          networks[networkName] = {
            amplitudes,
            hilbertDimension: dim,
            norm: 1.0,
          };

          rawWeights[networkName] = data.amplitudes_real;
          totalQNodes += dim;
          continue;
        } catch {
          // Fall through to JSON
        }
      }

      // Try JSON format
      const jsonRef = cartridgeStorageManager.buildOmegaStatePath(
        tenantId, 'qnodes', `${networkName}.json`
      );
      const jsonResult = await cartridgeStorageManager.retrieveContent(jsonRef);

      if (jsonResult) {
        const data = JSON.parse(jsonResult.data.toString('utf-8'));
        const dim = data.hilbert_dimension || data.amplitudes_real?.length || 1024;
        const amplitudes = (data.amplitudes_real || []).map((r: number, i: number) => ({
          real: r,
          imaginary: (data.amplitudes_imaginary || [])[i] || 0,
        }));

        networks[networkName] = {
          amplitudes,
          hilbertDimension: dim,
          norm: 1.0,
        };

        rawWeights[networkName] = data.amplitudes_real || [];
        totalQNodes += dim;
      }
    }

    // Fallback if nothing loaded
    if (Object.keys(networks).length === 0) {
      networks['default'] = equalSuperposition(1024);
      totalQNodes = 1024;
    }

    return {
      networks,
      rawWeights,
      networksLoaded: Object.keys(networks).length,
      totalQNodes,
    };
  }

  // ==========================================================================
  // Step 5: Load Knowledge from Cartridge
  // ==========================================================================

  private async loadCartridgeKnowledge(
    tenantId: string,
    resolved: ResolvedCartridgeState,
  ): Promise<KnowledgeFact[]> {
    const sectionSources = resolved.resolved_sections || {};
    const knowledgeSource = sectionSources['knowledge'] || sectionSources['facts'];
    if (!knowledgeSource) return [];

    const facts: KnowledgeFact[] = [];

    // Load verified_facts.json
    const factsRef = cartridgeStorageManager.buildOmegaStatePath(
      tenantId, 'knowledge', 'verified_facts.json'
    );
    const factsResult = await cartridgeStorageManager.retrieveContent(factsRef);
    if (factsResult) {
      const parsed = JSON.parse(factsResult.data.toString('utf-8'));
      const rawFacts = Array.isArray(parsed) ? parsed : (parsed.facts || []);
      for (const f of rawFacts) {
        facts.push({
          id: f.id || `cart-fact-${facts.length}`,
          text: f.text || f.content || '',
          embedding: f.embedding,
          source: `cartridge:${knowledgeSource.cartridge_name}`,
          priority: 5.0, // Cartridge facts get highest priority
          category: f.category || 'cartridge_knowledge',
        });
      }
    }

    // Load embeddings if separate file
    const embRef = cartridgeStorageManager.buildOmegaStatePath(
      tenantId, 'knowledge', 'embeddings.json'
    );
    const embResult = await cartridgeStorageManager.retrieveContent(embRef);
    if (embResult) {
      const embeddings = JSON.parse(embResult.data.toString('utf-8'));
      // Merge embeddings into facts by id
      for (const fact of facts) {
        if (embeddings[fact.id]) {
          fact.embedding = embeddings[fact.id];
        }
      }
    }

    return facts;
  }

  // ==========================================================================
  // Soft ROM Application
  // ==========================================================================

  private applySoftRomDeltas(
    networks: Record<string, QuantumStateVector>,
    softRom: SoftRomDelta,
  ): void {
    for (const [networkName, deltaBuffer] of Object.entries(softRom.weightDeltas)) {
      const network = networks[networkName];
      if (!network) continue;

      // Deserialize delta weights
      const float64 = new Float64Array(
        deltaBuffer.buffer,
        deltaBuffer.byteOffset,
        deltaBuffer.byteLength / 8,
      );

      // Apply deltas additively
      for (let i = 0; i < Math.min(float64.length, network.amplitudes.length); i++) {
        network.amplitudes[i].real += float64[i] || 0;
      }
    }

    // Apply connection topology changes
    for (const conn of softRom.connectionDeltas) {
      // Connection deltas modify pathway strengths in the network
      // This is handled at a higher level by the QuantumBrainService
      // when it rebuilds pathways from the amplitudes
    }
  }

  // ==========================================================================
  // Health Check
  // ==========================================================================

  async checkCartridgeHealth(tenantId: string): Promise<CartridgeHealthCheck> {
    const issues: string[] = [];

    // Check resolved state exists
    const resolved = await this.loadResolvedCartridgeState(tenantId);
    const resolvedStateExists = !!resolved;
    if (!resolvedStateExists) issues.push('No resolved cartridge state found');

    // Check firmware
    let firmwareLoaded = false;
    if (resolved) {
      const fwSections = resolved.resolved_sections || {};
      firmwareLoaded = !!fwSections['firmware'] || !!fwSections['veto_thresholds'];
      if (!firmwareLoaded) issues.push('No firmware section in resolved state');
    }

    // Check Q-Node weights exist in storage
    let qnodeWeightsLoaded = false;
    const manifestRef = cartridgeStorageManager.buildOmegaStatePath(
      tenantId, 'qnodes', 'network_manifest.json'
    );
    qnodeWeightsLoaded = await cartridgeStorageManager.exists(manifestRef);
    if (!qnodeWeightsLoaded) issues.push('No Q-Node network manifest found');

    // Check Soft ROM
    const softRomManifestRef = cartridgeStorageManager.buildOmegaStatePath(
      tenantId, 'soft-rom', 'manifest.json'
    );
    const softRomLoaded = await cartridgeStorageManager.exists(softRomManifestRef);

    // Check knowledge
    const factsRef = cartridgeStorageManager.buildOmegaStatePath(
      tenantId, 'knowledge', 'verified_facts.json'
    );
    const knowledgeLoaded = await cartridgeStorageManager.exists(factsRef);

    return {
      healthy: issues.length === 0,
      resolvedStateExists,
      firmwareLoaded,
      qnodeWeightsLoaded,
      softRomLoaded,
      knowledgeLoaded,
      issues,
      checkedAt: new Date().toISOString(),
    };
  }
}

// Export singleton
export const omegaCartridgeBootService = new OmegaCartridgeBootService();
