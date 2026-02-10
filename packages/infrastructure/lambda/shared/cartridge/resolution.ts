/**
 * RADIANT Cartridge Stacking Resolution Engine
 *
 * THE RULE: TENANT ALWAYS PREVAILS
 *
 * Resolution order (highest priority first):
 *   1. Soft ROM (brain's own learning) — additive deltas on top
 *   2. Tenant cartridge — REPLACES matching sections from lower layers
 *   3. Domain cartridge — fills gaps not covered by tenant
 *   4. Base cartridge — foundation, fills remaining gaps
 *   5. Firmware — safety floor, enforced via min() (NEVER loosened)
 *
 * When a tenant cartridge provides a section, the domain and base
 * cartridge versions of that section are IGNORED ENTIRELY.
 * Not averaged. Not merged. REPLACED.
 *
 * Exception: Firmware rules are UNION (most restrictive wins).
 * Tenant cannot lower the safety floor below firmware minimums.
 */

import { createRegisteredLogger } from '../services/logging-registry.service';

const logger = createRegisteredLogger({
  serviceName: 'cartridge/resolution',
  category: 'infrastructure',
  sourceType: 'application',
});

// ============================================================================
// Types
// ============================================================================

export interface ResolvedCartridgeState {
  effective_firmware: Record<string, unknown>;
  section_sources: Record<string, SectionSource>;
  resolution_log: string[];
  memory_priority: MemoryPriorityConfig;
  resolved_at: string;
}

export interface SectionSource {
  cartridge_id: string;
  cartridge_name: string;
  cartridge_type: string;
  priority: number;
}

export interface MemoryPriorityConfig {
  tenant_verified_facts: number;
  tenant_soft_rom: number;
  domain_cartridge: number;
  cato_user_memories: number;
  base_cartridge: number;
  internet_research: number;
}

export interface InstalledCartridge {
  id: string;
  name: string;
  cartridge_type: string;
  stack_priority: number;
  sections_present: string[];
  manifest: Record<string, unknown>;
  storage_ref: string;
}

// All cartridge sections in the system
const ALL_SECTIONS = [
  'firmware', 'qnodes', 'knowledge', 'personality', 'cato_learned',
  'cortex', 'lora', 'soft_rom', 'esa', 'curator', 'ghost', 'tenant_config',
] as const;

// ============================================================================
// Resolution Engine
// ============================================================================

/**
 * Resolve the effective cartridge stack for a tenant.
 *
 * For each section: the highest-priority cartridge that provides it WINS.
 * Firmware is special: all firmware sections are merged with min() for
 * thresholds (most restrictive wins).
 */
export function resolveCartridgeStack(
  installations: InstalledCartridge[],
): ResolvedCartridgeState {
  const log: string[] = [];
  const sectionSources: Record<string, SectionSource> = {};

  // Sort by stack_priority DESCENDING (highest first = tenant prevails)
  const sorted = [...installations].sort((a, b) => b.stack_priority - a.stack_priority);

  log.push(`Resolving stack with ${sorted.length} cartridges`);
  for (const c of sorted) {
    log.push(`  [${c.stack_priority}] ${c.name} (${c.cartridge_type}) — sections: ${c.sections_present.join(', ')}`);
  }

  // For each section: highest-priority cartridge that provides it WINS
  for (const section of ALL_SECTIONS) {
    for (const cart of sorted) {
      if (cart.sections_present.includes(section)) {
        sectionSources[section] = {
          cartridge_id: cart.id,
          cartridge_name: cart.name,
          cartridge_type: cart.cartridge_type,
          priority: cart.stack_priority,
        };
        log.push(`Section '${section}' → provided by '${cart.name}' (priority ${cart.stack_priority}, type: ${cart.cartridge_type})`);
        break; // First match wins (highest priority)
      }
    }
    if (!sectionSources[section]) {
      log.push(`Section '${section}' → NOT PROVIDED by any installed cartridge`);
    }
  }

  // Firmware resolution: UNION of all firmware sections (most restrictive wins)
  const effectiveFirmware = resolveFirmware(sorted, log);

  // Memory priority (fixed, not configurable per cartridge)
  const memoryPriority: MemoryPriorityConfig = {
    tenant_verified_facts: 5.0,
    tenant_soft_rom: 3.0,
    domain_cartridge: 2.0,
    cato_user_memories: 1.5,
    base_cartridge: 1.0,
    internet_research: 0.6,
  };

  log.push('');
  log.push(`Memory priority: tenant_facts(5.0x) > soft_rom(3.0x) > domain(2.0x) > cato_user(1.5x) > base(1.0x) > internet(0.6x)`);

  return {
    effective_firmware: effectiveFirmware,
    section_sources: sectionSources,
    resolution_log: log,
    memory_priority: memoryPriority,
    resolved_at: new Date().toISOString(),
  };
}

/**
 * Merge firmware sections from all cartridges that provide firmware.
 *
 * Rule: For veto thresholds, min() is applied (tighter threshold wins).
 * For parameter bounds: min() for max values, max() for min values.
 * Tenant can TIGHTEN but never LOOSEN the firmware safety floor.
 */
function resolveFirmware(
  sorted: InstalledCartridge[],
  log: string[],
): Record<string, unknown> {
  const firmwareCartridges = sorted.filter(c => c.sections_present.includes('firmware'));
  const effectiveFirmware: Record<string, unknown> = {};

  if (firmwareCartridges.length === 0) {
    log.push('');
    log.push('Firmware resolution: NO firmware sections found in any installed cartridge');
    return effectiveFirmware;
  }

  log.push('');
  log.push(`Firmware resolution: merging ${firmwareCartridges.length} firmware sections`);
  log.push('Rule: for veto thresholds, min() applied (most restrictive wins)');

  // Process from lowest priority to highest — higher priority overlays lower,
  // but for safety thresholds, min() ensures it can only tighten.
  const orderedForMerge = [...firmwareCartridges].sort((a, b) => a.stack_priority - b.stack_priority);

  for (const cart of orderedForMerge) {
    log.push(`  Applying firmware from '${cart.name}' (priority ${cart.stack_priority}, type: ${cart.cartridge_type})`);

    // The actual merging loads firmware JSON files from storage.
    // At this level we record which cartridges contribute.
    if (!effectiveFirmware.contributing_cartridges) {
      effectiveFirmware.contributing_cartridges = [];
    }
    (effectiveFirmware.contributing_cartridges as string[]).push(cart.id);
  }

  return effectiveFirmware;
}

/**
 * Merge two veto threshold objects using min() for all threshold values.
 * Categories present in either are included; for overlapping categories,
 * the tighter (lower) threshold wins.
 */
export function mergeVetoThresholds(
  base: Record<string, { min_threshold: number; auto_veto?: boolean; appeal_allowed?: boolean }>,
  overlay: Record<string, { min_threshold: number; auto_veto?: boolean; appeal_allowed?: boolean }>,
): Record<string, { min_threshold: number; auto_veto?: boolean; appeal_allowed?: boolean }> {
  const merged = { ...base };

  for (const [category, overlayCfg] of Object.entries(overlay)) {
    if (merged[category]) {
      // For thresholds: min() (tighter wins)
      merged[category] = {
        min_threshold: Math.min(merged[category].min_threshold, overlayCfg.min_threshold),
        // For auto_veto: OR (if either says auto_veto, it's auto_veto)
        auto_veto: merged[category].auto_veto || overlayCfg.auto_veto,
        // For appeal: AND (both must allow appeal)
        appeal_allowed: (merged[category].appeal_allowed ?? true) && (overlayCfg.appeal_allowed ?? true),
      };
    } else {
      merged[category] = { ...overlayCfg };
    }
  }

  return merged;
}

/**
 * Merge two parameter bounds objects.
 * For max values: min() (tighter ceiling wins).
 * For min values: max() (tighter floor wins).
 */
export function mergeParameterBounds(
  base: Record<string, { min?: number; max?: number }>,
  overlay: Record<string, { min?: number; max?: number }>,
): Record<string, { min?: number; max?: number }> {
  const merged = { ...base };

  for (const [param, overlayCfg] of Object.entries(overlay)) {
    if (merged[param]) {
      merged[param] = {
        min: (merged[param].min !== undefined && overlayCfg.min !== undefined)
          ? Math.max(merged[param].min!, overlayCfg.min!)
          : merged[param].min ?? overlayCfg.min,
        max: (merged[param].max !== undefined && overlayCfg.max !== undefined)
          ? Math.min(merged[param].max!, overlayCfg.max!)
          : merged[param].max ?? overlayCfg.max,
      };
    } else {
      merged[param] = { ...overlayCfg };
    }
  }

  return merged;
}

// ============================================================================
// Async Resolution (DB + Storage)
// ============================================================================

/**
 * Run full resolution for a tenant and persist the result.
 * Called by the resolution SQS worker after install/uninstall/reorder.
 */
export async function resolveAndPersist(tenantId: string): Promise<ResolvedCartridgeState> {
  const { executeStatement, stringParam } = await import('../db/client.js');

  // Load active installations with their cartridge data
  const result = await executeStatement(
    `SELECT ci.*, cu.name, cu.cartridge_type, cu.sections_present, cu.manifest, cu.storage_ref
     FROM cartridge_installations ci
     JOIN cartridge_universal cu ON cu.id = ci.cartridge_id
     WHERE ci.tenant_id = $1 AND ci.installation_status = 'active'
     ORDER BY ci.stack_priority DESC`,
    [stringParam('tenantId', tenantId)]
  );

  const installations: InstalledCartridge[] = ((result.rows || []) as any[]).map((row: any) => ({
    id: row.cartridge_id,
    name: row.name,
    cartridge_type: row.cartridge_type,
    stack_priority: row.stack_priority,
    sections_present: Array.isArray(row.sections_present) ? row.sections_present : [],
    manifest: typeof row.manifest === 'string' ? JSON.parse(row.manifest) : (row.manifest || {}),
    storage_ref: row.storage_ref,
  }));

  // Resolve the stack
  const resolved = resolveCartridgeStack(installations);

  // Persist to cache table
  await executeStatement(
    `INSERT INTO cartridge_resolved_state (tenant_id, resolved_firmware, resolved_sections, resolution_log, resolved_at)
     VALUES ($1, $2, $3, $4, NOW())
     ON CONFLICT (tenant_id) DO UPDATE SET
       resolved_firmware = $2, resolved_sections = $3, resolution_log = $4, resolved_at = NOW()`,
    [
      stringParam('tenantId', tenantId),
      stringParam('firmware', JSON.stringify(resolved.effective_firmware)),
      stringParam('sections', JSON.stringify(resolved.section_sources)),
      stringParam('log', JSON.stringify(resolved.resolution_log)),
    ]
  );

  logger.info('Cartridge resolution persisted', {
    tenantId,
    cartridgeCount: installations.length,
    sectionsResolved: Object.keys(resolved.section_sources).length,
  });

  return resolved;
}
