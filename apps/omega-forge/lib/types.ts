/**
 * OMEGA Forge — Shared internal types for API responses and UI data
 */

/** Generic database row — use for .map() callbacks in JSX where properties are dynamic */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type Row = Record<string, any>;

// Database row types for cartridge system
export interface AuditEntry {
  [key: string]: unknown;
  id: string;
  action: string;
  cartridge_id?: string;
  cartridge_name?: string;
  cartridge_version?: string;
  actor_id?: string;
  tenant_id?: string;
  created_at?: string;
}

export interface CartridgeRow {
  [key: string]: unknown;
  id: string;
  name: string;
  display_name?: string;
  version: string;
  cartridge_type?: string;
  targets?: string[];
  sections_present?: string[];
  status?: string;
  total_size_bytes?: number;
  created_at?: string;
  updated_at?: string;
  priority?: number;
}

export interface BrainRow {
  [key: string]: unknown;
  tenant_id: string;
  tenant_name?: string;
  brain_status?: string;
  boot_status?: string;
  total_cartridges?: number;
  total_dreams?: number;
  last_dream_at?: string;
}

export interface DreamRow {
  [key: string]: unknown;
  id: string;
  status: string;
  duration_ms?: number;
  started_at?: string;
}

export interface CatoInstance {
  [key: string]: unknown;
  tenant_id: string;
  tenant_name?: string;
  evolved_patterns?: number;
  twilight_cycles?: number;
  last_cycle_at?: string;
}

export interface TargetService {
  [key: string]: unknown;
  id?: string;
  service_key: string;
  display_name?: string;
  description?: string;
  is_active?: boolean;
  cartridge_count?: number;
}

export interface GlobalBrainRound {
  [key: string]: unknown;
  id: string;
  round_number?: number;
  round_type?: string;
  status: string;
  participants?: number;
  started_at?: string;
}

export interface GlobalBrainPipeline {
  [key: string]: unknown;
  id: string;
  status: string;
}

export interface CartridgeManifest {
  schema_version: string;
  cartridge_id: string;
  name: string;
  display_name: string;
  version: string;
  description: string | null;
  author: string | { name: string; email?: string; org_id?: string };
  targets: string[];
  cartridge_type: string;
  sections_present: string[];
  checksums: Record<string, string>;
  total_size_bytes: number;
  created_at: string;
  signed_at: string | null;
  signing_key_id: string | null;
}

export interface CatoPatternRow {
  pattern_text: string;
  fitness_score: number;
}

export interface CatoConfigRow {
  config_key: string;
  config_value: string;
}
