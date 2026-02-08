// RADIANT v4.18.0 - OMEGA Quantum Brain Service — TypeScript Management Layer
// Manages quantum brain state, firmware lifecycle, and hot-swap.
// Delegates actual neural compute to the Python physics engine.

import * as crypto from 'crypto';
import { executeStatement } from '../../db/client';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import * as fs from 'fs/promises';
import * as path from 'path';
import {
  QuantumStateVector,
  QuantumParameters,
  QuantumParametersSchema,
  AmbitionSettings,
  AmbitionSettingsSchema,
  QuantumBrainCheckpoint,
  UnitarityMode,
  MeasurementResult,
  HotSwapResult,
  SelfTestResult,
  FirmwareRollbackSnapshot
} from './quantum-types';
import {
  stateNorm,
  normalizeState,
  enforceUnitarity,
  measureSoft,
  simulateDecoherence,
  equalSuperposition,
  complexMag,
  innerProduct
} from './quantum-math';
import { HelixKernelService } from './helix-kernel.service';

// ============================================================================
// CONSTANTS
// ============================================================================

const EFS_BASE_PATH = '/mnt/omega_state';
const DEFAULT_HILBERT_DIM = 1024;
const S3_CHECKPOINT_PREFIX = 'omega/checkpoints';

// ============================================================================
// SERVICE
// ============================================================================

export class QuantumBrainService {
  private brainId: string;
  private tenantId: string;

  // Quantum state
  private psi: QuantumStateVector;
  private hilbertDimension: number;
  private unitarityMode: UnitarityMode;
  private totalCycles: number = 0;

  // Firmware state
  private loadedFirmwareId: string | null = null;
  private loadedFirmwareHash: string | null = null;
  private quantumParams: QuantumParameters | null = null;
  private ambitionSettings: AmbitionSettings | null = null;
  private personalityPrompt: string | null = null;

  // Sub-services
  private helixKernel: HelixKernelService;
  private s3Client: S3Client;

  // Brain health
  private entropy: number = 0;
  private dopamine: number = 0.5;
  private lastCycleAt: Date = new Date();

  constructor(
    brainId: string,
    tenantId: string,
    options: {
      hilbertDimension?: number;
      unitarityMode?: UnitarityMode;
      s3Bucket?: string;
    } = {}
  ) {
    this.brainId = brainId;
    this.tenantId = tenantId;
    this.hilbertDimension = options.hilbertDimension || DEFAULT_HILBERT_DIM;
    this.unitarityMode = options.unitarityMode || 'renormalize';
    this.s3Client = new S3Client({});
    this.helixKernel = new HelixKernelService();

    // Initialize to equal superposition
    this.psi = equalSuperposition(this.hilbertDimension);
  }

  // ========================================================================
  // INFERENCE CYCLE
  // ========================================================================

  /**
   * Execute a full inference cycle:
   * 1. Check for firmware hot-swap
   * 2. Load state from persistence
   * 3. Apply decoherence (time-warp)
   * 4. Evolve state (delegate to Python core)
   * 5. Apply Helix safety filter
   * 6. Measure output
   * 7. Enforce unitarity
   * 8. Persist state
   */
  async inferenceCycle(input: {
    prompt: string;
    context?: string[];
    maxTokens?: number;
    temperature?: number;
  }): Promise<{
    output: string;
    measurement: MeasurementResult;
    helixViolations: number;
    unitarityCorrected: boolean;
    firmwareSwapped: boolean;
  }> {
    let firmwareSwapped = false;

    // 1. Check for firmware hot-swap (compare DB hash to loaded hash)
    const swapResult = await this.checkFirmwareSwap();
    if (swapResult) {
      firmwareSwapped = swapResult.success;
    }

    // 2. Load state from EFS
    await this.loadStateFromEFS();

    // 3. Apply decoherence for time elapsed
    const now = new Date();
    const hoursElapsed = (now.getTime() - this.lastCycleAt.getTime()) / (1000 * 60 * 60);
    if (hoursElapsed > 0.01) {
      const lambda = this.quantumParams?.amplitude_decay?.lambda ?? 0.001;
      const { decayedState } = simulateDecoherence(this.psi, hoursElapsed, lambda);
      this.psi = decayedState;
    }

    // 4. Evolve state (encode input → delegate to Python → decode output)
    const encoded = this.encodeInput(input.prompt, input.context);
    const evolved = await this.evolve(encoded);
    this.psi = evolved;

    // 5. Apply Helix safety filter
    const filterResult = this.helixKernel.filter(this.psi);
    this.psi = filterResult.safe_state;

    // 6. Measure output
    const measurementThreshold = this.quantumParams?.measurement_threshold?.value ?? 0.5;
    const { measuredComponents, softCollapsedState } = measureSoft(this.psi, measurementThreshold);
    this.psi = softCollapsedState;

    const measurement: MeasurementResult = {
      type: 'soft',
      basis_state: measuredComponents.length > 0 ? measuredComponents[0] : null,
      probability: measuredComponents.length > 0 ? 1.0 / measuredComponents.length : 0,
      collapsed_state: softCollapsedState,
      pre_measurement_entropy: this.entropy
    };

    // 7. Enforce unitarity
    const unitarityThreshold = this.quantumParams?.unitarity_enforcement?.correction_threshold ?? 0.001;
    const { state: correctedState, corrected } = enforceUnitarity(
      this.psi,
      this.unitarityMode,
      unitarityThreshold
    );
    this.psi = correctedState;

    // Track corrections in DB
    if (corrected) {
      await this.recordUnitarityEvent('correction', stateNorm(this.psi));
    }

    // 8. Persist state
    this.totalCycles++;
    this.lastCycleAt = now;
    await this.persistStateAsync();

    // 9. Decode output from measurement
    const output = this.decodeOutput(measurement);

    return {
      output,
      measurement,
      helixViolations: filterResult.violations.length,
      unitarityCorrected: corrected,
      firmwareSwapped
    };
  }

  // ========================================================================
  // STATE ENCODING / DECODING
  // ========================================================================

  /**
   * Encode user prompt into quantum state modification.
   * Returns the evolved state vector after incorporating input.
   *
   * NOTE: In production, this delegates to the Python core via HTTP.
   * This TypeScript implementation is for admin testing / preview only.
   */
  private encodeInput(prompt: string, context?: string[]): QuantumStateVector {
    // Hash prompt to get deterministic seed
    const hash = crypto.createHash('sha256').update(prompt).digest();
    const amplitudes = this.psi.amplitudes.map((amp, i) => {
      const bytePair = (hash[i % hash.length] / 255) * 2 - 1;
      return {
        real: amp.real + bytePair * 0.01,
        imaginary: amp.imaginary + (hash[(i + 1) % hash.length] / 255 - 0.5) * 0.01
      };
    });
    return normalizeState({
      amplitudes,
      hilbertDimension: this.hilbertDimension,
      norm: 0
    });
  }

  /**
   * Decode measurement result into text output.
   *
   * NOTE: In production, Broca interface handles decoding.
   * This TypeScript implementation is for admin testing / preview only.
   */
  private decodeOutput(measurement: MeasurementResult): string {
    if (measurement.basis_state !== null) {
      return `[OMEGA Quantum Output: basis_state=${measurement.basis_state}, p=${measurement.probability.toFixed(4)}]`;
    }
    return '[OMEGA Quantum Output: no measurement above threshold]';
  }

  /**
   * Evolve quantum state (apply unitary transformation).
   *
   * In production, this calls the Python core:
   *   POST {OMEGA_API_URL}/inference
   * For TypeScript-only testing, applies a simple rotation.
   */
  private async evolve(inputState: QuantumStateVector): Promise<QuantumStateVector> {
    // In production, delegate to Python physics engine:
    // const response = await fetch(`${OMEGA_API_URL}/inference`, {
    //   method: 'POST',
    //   body: JSON.stringify({ state: inputState, tenant_id: this.tenantId })
    // });
    // return response.json().evolved_state;

    // TypeScript fallback: simple phase rotation (for admin preview)
    const rotated = inputState.amplitudes.map(amp => ({
      real: amp.real * 0.999 - amp.imaginary * 0.01,
      imaginary: amp.real * 0.01 + amp.imaginary * 0.999
    }));
    return normalizeState({
      amplitudes: rotated,
      hilbertDimension: inputState.hilbertDimension,
      norm: 0
    });
  }

  // ========================================================================
  // STATE PERSISTENCE
  // ========================================================================

  /**
   * Load brain state from EFS (hot storage).
   */
  private async loadStateFromEFS(): Promise<boolean> {
    const statePath = path.join(EFS_BASE_PATH, this.tenantId, this.brainId, 'state.json');
    try {
      const data = await fs.readFile(statePath, 'utf-8');
      const checkpoint: QuantumBrainCheckpoint = JSON.parse(data);
      this.restoreFromCheckpoint(checkpoint);
      return true;
    } catch (err: any) {
      if (err.code === 'ENOENT') {
        // No persisted state — use current (initialized) state
        return false;
      }
      throw err;
    }
  }

  /**
   * Persist state to EFS asynchronously.
   */
  private async persistStateAsync(): Promise<void> {
    const checkpoint = this.createCheckpoint();
    const stateDir = path.join(EFS_BASE_PATH, this.tenantId, this.brainId);
    await fs.mkdir(stateDir, { recursive: true });
    await fs.writeFile(
      path.join(stateDir, 'state.json'),
      JSON.stringify(checkpoint),
      'utf-8'
    );

    // Update DB with latest norm and cycle count
    await executeStatement(
      `UPDATE omega_brains
       SET last_norm_value = $1,
           last_unitarity_check = NOW(),
           unitarity_corrections_count = unitarity_corrections_count + $2,
           updated_at = NOW()
       WHERE id = $3 AND tenant_id = $4`,
      [stateNorm(this.psi), 0, this.brainId, this.tenantId]
    );
  }

  /**
   * Create a serializable checkpoint of current brain state.
   */
  private createCheckpoint(): QuantumBrainCheckpoint {
    return {
      brain_id: this.brainId,
      tenant_id: this.tenantId,
      firmware_id: this.loadedFirmwareId || '',
      psi: {
        amplitudes_real: this.psi.amplitudes.map(a => a.real),
        amplitudes_imaginary: this.psi.amplitudes.map(a => a.imaginary)
      },
      hilbert_dimension: this.hilbertDimension,
      norm: stateNorm(this.psi),
      pathways: {
        source_indices: [],
        target_indices: [],
        strengths: [],
        phases: [],
        last_fired: []
      },
      entropy: this.entropy,
      dopamine: this.dopamine,
      total_cycles: this.totalCycles,
      last_cycle_at: this.lastCycleAt.toISOString(),
      version: '6.5.0',
      created_at: new Date().toISOString(),
      checksum: this.hashContent(JSON.stringify(this.psi.amplitudes))
    };
  }

  /**
   * Restore brain state from a checkpoint.
   */
  private restoreFromCheckpoint(checkpoint: QuantumBrainCheckpoint): void {
    this.hilbertDimension = checkpoint.hilbert_dimension;
    this.totalCycles = checkpoint.total_cycles;
    this.entropy = checkpoint.entropy;
    this.dopamine = checkpoint.dopamine;
    this.lastCycleAt = new Date(checkpoint.last_cycle_at);

    const amplitudes = checkpoint.psi.amplitudes_real.map((r, i) => ({
      real: r,
      imaginary: checkpoint.psi.amplitudes_imaginary[i] || 0
    }));
    this.psi = normalizeState({
      amplitudes,
      hilbertDimension: this.hilbertDimension,
      norm: 0
    });
  }

  /**
   * Save checkpoint to S3 (cold backup).
   */
  async saveCheckpointToS3(bucket: string): Promise<string> {
    const checkpoint = this.createCheckpoint();
    const key = `${S3_CHECKPOINT_PREFIX}/${this.tenantId}/${this.brainId}/${Date.now()}.json`;
    await this.s3Client.send(new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: JSON.stringify(checkpoint),
      ContentType: 'application/json',
      ServerSideEncryption: 'aws:kms'
    }));
    return key;
  }

  // ========================================================================
  // FIRMWARE HOT-SWAP
  // ========================================================================

  /**
   * Check if firmware has changed and perform hot-swap if needed.
   *
   * The mechanism:
   * 1. Query omega_brains.firmware_hash from DB
   * 2. Compare to this.loadedFirmwareHash
   * 3. If different → new firmware was activated externally (by admin via Forge)
   * 4. Create rollback snapshot
   * 5. Verify new firmware signature (Ed25519)
   * 6. Unload current firmware
   * 7. Apply new firmware
   * 8. Run self-test suite
   * 9. If tests pass → commit
   * 10. If tests fail → rollback from snapshot
   */
  async checkFirmwareSwap(): Promise<HotSwapResult | null> {
    const startTime = Date.now();

    // 1. Query current firmware hash from DB
    const result = await executeStatement<any>(
      `SELECT b.firmware_hash, b.active_firmware_id,
              f.id AS fw_id, f.quantum, f.content_hash, f.status,
              f.signature, f.hilbert_dimension, f.unitarity_mode
       FROM omega_brains b
       LEFT JOIN omega_firmware f ON f.id = b.active_firmware_id
       WHERE b.id = $1 AND b.tenant_id = $2`,
      [this.brainId, this.tenantId]
    );

    if (result.rows.length === 0) return null;
    const row = result.rows[0];

    // 2. Compare hashes
    if (row.firmware_hash === this.loadedFirmwareHash) {
      return null; // No change
    }

    // New firmware detected — begin hot-swap
    const newFirmwareId = row.fw_id;
    const verifyStart = Date.now();

    // 3. Verify firmware signature
    if (row.signature) {
      const verified = await this.verifyFirmwareSignature(
        row.content_hash,
        row.signature
      );
      if (!verified) {
        return {
          success: false,
          previousFirmwareId: this.loadedFirmwareId,
          newFirmwareId,
          unloadDurationMs: 0,
          loadDurationMs: 0,
          verifyDurationMs: Date.now() - verifyStart,
          totalDurationMs: Date.now() - startTime,
          rollbackTriggered: false,
          rollbackReason: 'Firmware signature verification failed',
          selfTestResults: []
        };
      }
    }
    const verifyDuration = Date.now() - verifyStart;

    // 4. Create rollback snapshot
    const snapshot = this.createRollbackSnapshot();

    // 5. Unload current firmware
    const unloadStart = Date.now();
    this.unloadCurrentFirmware();
    const unloadDuration = Date.now() - unloadStart;

    // 6. Apply new firmware
    const loadStart = Date.now();
    try {
      await this.applyFirmware(row);
    } catch (err: any) {
      // Apply failed — rollback
      this.restoreFromSnapshot(snapshot);
      return {
        success: false,
        previousFirmwareId: snapshot.firmwareId,
        newFirmwareId,
        unloadDurationMs: unloadDuration,
        loadDurationMs: Date.now() - loadStart,
        verifyDurationMs: verifyDuration,
        totalDurationMs: Date.now() - startTime,
        rollbackTriggered: true,
        rollbackReason: `Apply failed: ${err.message}`,
        selfTestResults: []
      };
    }
    const loadDuration = Date.now() - loadStart;

    // 7. Run self-test suite
    const selfTestResults = await this.runFirmwareSelfTest();
    const allPassed = selfTestResults.every(r => r.passed);

    if (!allPassed) {
      // Self-test failed — rollback
      this.restoreFromSnapshot(snapshot);
      return {
        success: false,
        previousFirmwareId: snapshot.firmwareId,
        newFirmwareId,
        unloadDurationMs: unloadDuration,
        loadDurationMs: loadDuration,
        verifyDurationMs: verifyDuration,
        totalDurationMs: Date.now() - startTime,
        rollbackTriggered: true,
        rollbackReason: `Self-test failed: ${selfTestResults.filter(r => !r.passed).map(r => r.testName).join(', ')}`,
        selfTestResults
      };
    }

    // 8. Commit — update loaded firmware tracking
    this.loadedFirmwareId = newFirmwareId;
    this.loadedFirmwareHash = row.firmware_hash;

    return {
      success: true,
      previousFirmwareId: snapshot.firmwareId,
      newFirmwareId,
      unloadDurationMs: unloadDuration,
      loadDurationMs: loadDuration,
      verifyDurationMs: verifyDuration,
      totalDurationMs: Date.now() - startTime,
      rollbackTriggered: false,
      selfTestResults
    };
  }

  /**
   * Unload current firmware state — clears Helix rules, zeros params.
   */
  private unloadCurrentFirmware(): void {
    this.helixKernel.clearAllRules();
    this.quantumParams = null;
    this.ambitionSettings = null;
    this.personalityPrompt = null;
    this.loadedFirmwareId = null;
    this.loadedFirmwareHash = null;
  }

  /**
   * Apply new firmware from a DB row.
   */
  private async applyFirmware(fwRow: any): Promise<void> {
    // Parse quantum parameters
    if (fwRow.quantum) {
      const parsed = typeof fwRow.quantum === 'string'
        ? JSON.parse(fwRow.quantum)
        : fwRow.quantum;
      this.quantumParams = QuantumParametersSchema.parse(parsed);
    }

    // Load Helix rules from DB
    await this.helixKernel.loadRulesFromDb(this.brainId, this.tenantId);

    // Load ambition settings from firmware
    const fwResult = await executeStatement<any>(
      `SELECT ambition, personality FROM omega_firmware WHERE id = $1`,
      [fwRow.fw_id]
    );
    if (fwResult.rows.length > 0) {
      const fw = fwResult.rows[0];
      if (fw.ambition) {
        const ambitionData = typeof fw.ambition === 'string'
          ? JSON.parse(fw.ambition)
          : fw.ambition;
        this.ambitionSettings = AmbitionSettingsSchema.parse(ambitionData);

        // Apply ambition to brain state
        this.entropy = this.ambitionSettings.entropy_threshold?.value ?? 0.5;
        this.dopamine = this.ambitionSettings.dopamine_floor?.value ?? 0.2;
      }
      if (fw.personality) {
        this.personalityPrompt = typeof fw.personality === 'string'
          ? fw.personality
          : JSON.stringify(fw.personality);
      }
    }

    // Resize Hilbert space if firmware specifies different dimension
    const newDim = this.quantumParams?.hilbert_dimension?.value ?? this.hilbertDimension;
    if (newDim !== this.hilbertDimension) {
      this.resizeHilbertSpace(newDim);
    }

    // Update unitarity mode
    this.unitarityMode = (fwRow.unitarity_mode as UnitarityMode) || this.unitarityMode;
  }

  /**
   * Resize the Hilbert space. Pads with zeros or truncates amplitudes.
   */
  private resizeHilbertSpace(newDim: number): void {
    const oldAmps = this.psi.amplitudes;
    const newAmps = [];
    for (let i = 0; i < newDim; i++) {
      newAmps.push(i < oldAmps.length ? oldAmps[i] : { real: 0, imaginary: 0 });
    }
    this.hilbertDimension = newDim;
    this.psi = normalizeState({
      amplitudes: newAmps,
      hilbertDimension: newDim,
      norm: 0
    });
  }

  /**
   * Create a rollback snapshot of current firmware state.
   */
  private createRollbackSnapshot(): FirmwareRollbackSnapshot {
    return {
      firmwareId: this.loadedFirmwareId,
      firmwareHash: this.loadedFirmwareHash,
      quantumParams: this.quantumParams ? { ...this.quantumParams } : null,
      ambitionSettings: this.ambitionSettings ? { ...this.ambitionSettings } : null,
      helixRules: [],
      personalityPrompt: this.personalityPrompt,
      hilbertDimension: this.hilbertDimension,
      unitarityMode: this.unitarityMode
    };
  }

  /**
   * Restore firmware state from a rollback snapshot.
   */
  private restoreFromSnapshot(snapshot: FirmwareRollbackSnapshot): void {
    this.loadedFirmwareId = snapshot.firmwareId;
    this.loadedFirmwareHash = snapshot.firmwareHash;
    this.quantumParams = snapshot.quantumParams;
    this.ambitionSettings = snapshot.ambitionSettings;
    this.personalityPrompt = snapshot.personalityPrompt;
    this.hilbertDimension = snapshot.hilbertDimension;
    this.unitarityMode = snapshot.unitarityMode;

    // Reload previous firmware's Helix rules from DB
    if (snapshot.firmwareId) {
      this.helixKernel.loadRulesFromDb(this.brainId, this.tenantId).catch(err => {
        console.error(`[OMEGA] Failed to reload Helix rules during rollback: ${err.message}`);
      });
    }
  }

  /**
   * Verify firmware signature using Ed25519.
   *
   * The public key is stored in SSM Parameter Store:
   * /radiant/{env}/omega/firmware-signing-public-key
   */
  private async verifyFirmwareSignature(
    contentHash: string,
    signatureHex: string
  ): Promise<boolean> {
    try {
      // In production, fetch the public key from SSM or environment
      const publicKeyHex = process.env.OMEGA_FIRMWARE_SIGNING_PUBLIC_KEY;
      if (!publicKeyHex) {
        console.warn('[OMEGA] No firmware signing public key configured — skipping verification');
        return true;
      }

      const publicKey = crypto.createPublicKey({
        key: Buffer.from(publicKeyHex, 'hex'),
        format: 'der',
        type: 'spki'
      });

      const verified = crypto.verify(
        'sha512',
        Buffer.from(contentHash, 'utf-8'),
        publicKey,
        Buffer.from(signatureHex, 'hex')
      );

      return verified;
    } catch (err: any) {
      console.error(`[OMEGA] Firmware signature verification error: ${err.message}`);
      return false;
    }
  }

  /**
   * Run self-test suite after firmware hot-swap.
   *
   * Tests each Helix rule by constructing a test vector that should trigger it.
   * If a forbidden rule fails to block its test vector, the firmware is rejected.
   */
  private async runFirmwareSelfTest(): Promise<SelfTestResult[]> {
    const results: SelfTestResult[] = [];

    // Test each Helix rule
    const rules = Array.from((this.helixKernel as any).activeRules?.values?.() ?? []) as any[];

    for (const rule of rules) {
      const testVector: QuantumStateVector = rule.forbiddenVector;

      // Compute alignment before filtering
      const preAlignment = complexMag(innerProduct(testVector, this.psi));

      // Run filter
      const filterResult = this.helixKernel.filter(testVector);

      // Compute alignment after filtering
      const postAlignment = complexMag(innerProduct(rule.forbiddenVector, filterResult.safe_state));

      const passed = rule.interferenceType === 'destructive'
        ? postAlignment < 0.01  // Should be fully projected out
        : postAlignment < preAlignment;  // Should be reduced

      results.push({
        testName: `helix_rule_${rule.ruleId}`,
        testType: 'forbidden_vector_block',
        ruleId: rule.ruleId,
        expectedOutcome: rule.interferenceType === 'destructive' ? 'alignment < 0.01' : 'alignment reduced',
        actualOutcome: `alignment = ${postAlignment.toFixed(6)}`,
        passed,
        preAlignment,
        postAlignment,
        details: passed
          ? `Rule "${rule.name}" correctly ${rule.interferenceType === 'destructive' ? 'blocked' : 'dampened'} forbidden vector`
          : `Rule "${rule.name}" FAILED to ${rule.interferenceType === 'destructive' ? 'block' : 'dampen'} forbidden vector`
      });
    }

    // Test ambition thresholds if configured
    if (this.ambitionSettings) {
      const entropyThreshold = this.ambitionSettings.entropy_threshold?.value ?? 0.5;
      results.push({
        testName: 'ambition_entropy_threshold',
        testType: 'ambition_threshold',
        ruleId: null,
        expectedOutcome: `entropy_threshold = ${entropyThreshold}`,
        actualOutcome: `brain_entropy = ${this.entropy}`,
        passed: true, // Informational — doesn't fail swap
        preAlignment: null,
        postAlignment: null,
        details: `Entropy threshold set to ${entropyThreshold}, current brain entropy is ${this.entropy}`
      });
    }

    return results;
  }

  // ========================================================================
  // UNITARITY EVENT TRACKING
  // ========================================================================

  private async recordUnitarityEvent(
    eventType: 'drift' | 'correction' | 'violation',
    measuredNorm: number
  ): Promise<void> {
    try {
      await executeStatement(
        `INSERT INTO omega_unitarity_events
         (brain_id, tenant_id, event_type, measured_norm, expected_norm, deviation, action_taken, cycle_number)
         VALUES ($1, $2, $3, $4, 1.0, ABS($4 - 1.0), $5, $6)`,
        [
          this.brainId,
          this.tenantId,
          eventType,
          measuredNorm,
          eventType === 'correction' ? 'renormalized' : eventType === 'violation' ? 'error_raised' : null,
          this.totalCycles
        ]
      );
    } catch (err: any) {
      console.error(`[OMEGA] Failed to record unitarity event: ${err.message}`);
    }
  }

  // ========================================================================
  // UTILITIES
  // ========================================================================

  private hashContent(content: string): string {
    return crypto.createHash('sha512').update(content).digest('hex');
  }

  /**
   * Get a summary of the current brain state for admin API.
   */
  getStateSummary(): {
    brainId: string;
    tenantId: string;
    hilbertDimension: number;
    norm: number;
    entropy: number;
    dopamine: number;
    totalCycles: number;
    loadedFirmwareId: string | null;
    helixRuleCount: number;
    unitarityMode: UnitarityMode;
  } {
    return {
      brainId: this.brainId,
      tenantId: this.tenantId,
      hilbertDimension: this.hilbertDimension,
      norm: stateNorm(this.psi),
      entropy: this.entropy,
      dopamine: this.dopamine,
      totalCycles: this.totalCycles,
      loadedFirmwareId: this.loadedFirmwareId,
      helixRuleCount: this.helixKernel.getActiveRuleCount(),
      unitarityMode: this.unitarityMode
    };
  }
}
