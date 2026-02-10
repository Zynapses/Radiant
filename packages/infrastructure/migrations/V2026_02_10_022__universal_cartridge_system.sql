-- ============================================================================
-- RADIANT Universal Cartridge System (.RADz)
-- Migration: V2026_02_10_022__universal_cartridge_system
--
-- Creates the complete cartridge management schema:
--   - cartridge_target_services: pluggable target service registry
--   - cartridge_target_section_specs: per-target section file specs
--   - cartridge_universal: main cartridge registry (extends existing cartridges table pattern)
--   - cartridge_installations: which cartridges are installed per tenant
--   - cartridge_resolved_state: cached stacking resolution per tenant
--   - cartridge_audit_log: full audit trail
--   - cato_cartridge_config: CATO reads personality/config from cartridges
--
-- NOTE: This does NOT alter the existing `cartridges` table used by the
-- legacy cartridge system (cartridge.service.ts). The new tables use the
-- `cartridge_universal` name to avoid conflicts during migration.
-- ============================================================================

BEGIN;

-- ---------------------------------------------------------------------------
-- 1. Target Service Registry
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS cartridge_target_services (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  service_key VARCHAR(50) UNIQUE NOT NULL,
  display_name VARCHAR(100) NOT NULL,
  description TEXT,
  required_sections JSONB NOT NULL DEFAULT '[]',
  optional_sections JSONB NOT NULL DEFAULT '[]',
  validation_rules JSONB NOT NULL DEFAULT '{}',
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  min_radiant_version VARCHAR(20),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ---------------------------------------------------------------------------
-- 2. Section Specs per Target (what Genesis Forge reads)
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS cartridge_target_section_specs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  target_service_id UUID NOT NULL REFERENCES cartridge_target_services(id) ON DELETE CASCADE,
  section_key VARCHAR(50) NOT NULL,
  display_name VARCHAR(100) NOT NULL,
  description TEXT,
  file_specs JSONB NOT NULL,
  json_schemas JSONB,
  is_required_for_target BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(target_service_id, section_key)
);

-- ---------------------------------------------------------------------------
-- 3. Universal Cartridge Registry
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS cartridge_universal (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES tenants(id),
  cartridge_type VARCHAR(20) NOT NULL CHECK (cartridge_type IN (
    'base', 'domain', 'tenant', 'community', 'personality', 'knowledge', 'soft_rom', 'firmware'
  )),
  name VARCHAR(100) NOT NULL,
  display_name VARCHAR(200) NOT NULL,
  version VARCHAR(20) NOT NULL,
  description TEXT,
  author_name VARCHAR(100),
  author_email VARCHAR(200),
  author_org_id VARCHAR(100),
  targets TEXT[] NOT NULL,
  sections_present TEXT[] NOT NULL DEFAULT '{}',
  manifest JSONB NOT NULL DEFAULT '{}',
  storage_ref VARCHAR(500) NOT NULL,
  storage_bucket VARCHAR(200) NOT NULL,
  total_size_bytes BIGINT NOT NULL DEFAULT 0,
  checksum_sha256 VARCHAR(64) NOT NULL DEFAULT '',
  signing_key_id VARCHAR(200),
  signature_valid BOOLEAN NOT NULL DEFAULT FALSE,
  compatibility JSONB,
  tier_requirements JSONB,
  marketplace_listing_id UUID,
  is_published BOOLEAN NOT NULL DEFAULT FALSE,
  status VARCHAR(20) NOT NULL DEFAULT 'uploaded' CHECK (status IN (
    'uploaded', 'validating', 'validated', 'failed', 'installed', 'active', 'archived'
  )),
  validation_results JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(name, version, tenant_id)
);

-- ---------------------------------------------------------------------------
-- 4. Cartridge Installations (stack per tenant)
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS cartridge_installations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  cartridge_id UUID NOT NULL REFERENCES cartridge_universal(id),
  stack_priority INTEGER NOT NULL,
  installation_status VARCHAR(20) NOT NULL DEFAULT 'installing' CHECK (installation_status IN (
    'installing', 'active', 'updating', 'uninstalling', 'failed', 'disabled'
  )),
  installed_by UUID,
  merge_strategy VARCHAR(20) NOT NULL DEFAULT 'replace' CHECK (merge_strategy IN (
    'replace', 'merge', 'additive'
  )),
  configuration_overrides JSONB,
  installed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_health_check TIMESTAMPTZ,
  health_status VARCHAR(20) DEFAULT 'unknown',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(tenant_id, cartridge_id)
);

-- ---------------------------------------------------------------------------
-- 5. Cartridge Stacking Resolution Cache
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS cartridge_resolved_state (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) UNIQUE,
  resolved_firmware JSONB NOT NULL DEFAULT '{}',
  resolved_sections JSONB NOT NULL DEFAULT '{}',
  resolution_log JSONB NOT NULL DEFAULT '[]',
  resolved_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ---------------------------------------------------------------------------
-- 6. Cartridge Audit Log
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS cartridge_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES tenants(id),
  cartridge_id UUID REFERENCES cartridge_universal(id),
  action VARCHAR(50) NOT NULL,
  actor_id UUID,
  details JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ---------------------------------------------------------------------------
-- 7. CATO Cartridge Config
--    CATO reads personality/incentives/dream schedule from here
--    instead of hardcoded values. Populated when a cato-targeting
--    cartridge is installed.
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS cato_cartridge_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  config_key VARCHAR(100) NOT NULL,
  config_value JSONB NOT NULL,
  source_cartridge_id UUID REFERENCES cartridge_universal(id),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(tenant_id, config_key)
);

-- ---------------------------------------------------------------------------
-- 8. Indexes
-- ---------------------------------------------------------------------------

CREATE INDEX IF NOT EXISTS idx_cu_tenant ON cartridge_universal(tenant_id);
CREATE INDEX IF NOT EXISTS idx_cu_type ON cartridge_universal(cartridge_type);
CREATE INDEX IF NOT EXISTS idx_cu_targets ON cartridge_universal USING GIN(targets);
CREATE INDEX IF NOT EXISTS idx_cu_status ON cartridge_universal(status);
CREATE INDEX IF NOT EXISTS idx_cu_name_ver ON cartridge_universal(name, version);

CREATE INDEX IF NOT EXISTS idx_ci_tenant ON cartridge_installations(tenant_id);
CREATE INDEX IF NOT EXISTS idx_ci_status ON cartridge_installations(installation_status);
CREATE INDEX IF NOT EXISTS idx_ci_priority ON cartridge_installations(tenant_id, stack_priority);

CREATE INDEX IF NOT EXISTS idx_cal_tenant ON cartridge_audit_log(tenant_id);
CREATE INDEX IF NOT EXISTS idx_cal_cartridge ON cartridge_audit_log(cartridge_id);
CREATE INDEX IF NOT EXISTS idx_cal_created ON cartridge_audit_log(created_at);

CREATE INDEX IF NOT EXISTS idx_ccc_tenant ON cato_cartridge_config(tenant_id);

-- ---------------------------------------------------------------------------
-- 9. Row Level Security
-- ---------------------------------------------------------------------------

ALTER TABLE cartridge_universal ENABLE ROW LEVEL SECURITY;
ALTER TABLE cartridge_installations ENABLE ROW LEVEL SECURITY;
ALTER TABLE cartridge_resolved_state ENABLE ROW LEVEL SECURITY;
ALTER TABLE cartridge_audit_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE cato_cartridge_config ENABLE ROW LEVEL SECURITY;

-- Tenant sees own + platform cartridges (tenant_id IS NULL)
CREATE POLICY cu_tenant_policy ON cartridge_universal
  FOR ALL USING (tenant_id IS NULL OR tenant_id = current_setting('app.current_tenant_id', true)::UUID);

CREATE POLICY ci_tenant_policy ON cartridge_installations
  FOR ALL USING (tenant_id = current_setting('app.current_tenant_id', true)::UUID);

CREATE POLICY crs_tenant_policy ON cartridge_resolved_state
  FOR ALL USING (tenant_id = current_setting('app.current_tenant_id', true)::UUID);

CREATE POLICY cal_tenant_policy ON cartridge_audit_log
  FOR ALL USING (tenant_id IS NULL OR tenant_id = current_setting('app.current_tenant_id', true)::UUID);

CREATE POLICY ccc_tenant_policy ON cato_cartridge_config
  FOR ALL USING (tenant_id = current_setting('app.current_tenant_id', true)::UUID);

-- ---------------------------------------------------------------------------
-- 10. Seed Target Services
-- ---------------------------------------------------------------------------

INSERT INTO cartridge_target_services (service_key, display_name, description, required_sections, optional_sections, validation_rules, min_radiant_version)
VALUES
  ('omega', 'OMEGA Q-Node Brain',
   'Pre-learned Q-Node networks, firmware, and knowledge for the OMEGA consciousness engine',
   '["firmware"]',
   '["qnodes", "knowledge", "soft_rom", "tests", "curator"]',
   '{
     "firmware": {"required_files": ["veto_thresholds.json", "ambition_config.json"]},
     "qnodes": {"weight_format": "msgpack", "dtype": "complex64", "max_size_mb": 2048},
     "knowledge": {"embedding_dims": 768, "max_facts": 100000},
     "soft_rom": {"requires_base_cartridge_ref": true}
   }',
   '4.18.0'),
  ('cortex', 'CORTEX Routing Networks',
   'ONNX routing MLPs, LoRA adapters, and expert system adapters',
   '["cortex"]',
   '["lora", "esa", "curator", "knowledge", "tests"]',
   '{
     "cortex": {"format": "onnx", "required_networks": ["pattern_network.onnx", "routing_network.onnx"]},
     "lora": {"format": "safetensors", "max_size_mb": 500},
     "esa": {"format": "json", "schema_validation": true}
   }',
   '4.18.0'),
  ('cato', 'CATO Cognitive Engine',
   'Personality, moods, incentives, dream schedule, and learned state for CATO AI persona',
   '["personality"]',
   '["cato_learned", "ghost", "tests"]',
   '{
     "personality": {"required_files": ["persona_config.json", "mood_profiles.json"]},
     "cato_learned": {"cortex_format": "onnx", "max_size_mb": 200},
     "ghost": {"format": "onnx", "input_dim": 4096, "output_dim": 64}
   }',
   '4.18.0'),
  ('tenant', 'Tenant Configuration',
   'Tenant-level routing overrides, feature flags, and compliance configuration',
   '["tenant_config"]',
   '["tests"]',
   '{
     "tenant_config": {"required_files": [], "optional_files": ["routing_overrides.json", "feature_flags.json", "compliance_config.json"]}
   }',
   '4.18.0'),
  ('global', 'Global Configuration',
   'Applies to all services — sections dispatched to whichever service owns them',
   '[]',
   '["firmware", "qnodes", "knowledge", "personality", "cortex", "lora", "tenant_config", "tests"]',
   '{}',
   '4.18.0')
ON CONFLICT (service_key) DO NOTHING;

-- ---------------------------------------------------------------------------
-- 11. Seed Section Specs (OMEGA firmware + CATO personality)
-- ---------------------------------------------------------------------------

-- OMEGA firmware section spec
INSERT INTO cartridge_target_section_specs (target_service_id, section_key, display_name, description, file_specs, json_schemas, is_required_for_target)
VALUES (
  (SELECT id FROM cartridge_target_services WHERE service_key = 'omega'),
  'firmware',
  'OMEGA Firmware (Safety Floor)',
  'Immutable safety constraints that the brain cannot override. Includes threat geometries, veto thresholds, development schedule, and motivation system parameters.',
  '[
    {"filename": "helix_threat_geometries.msgpack", "description": "Pre-trained complex64 threat vectors for Helix safety network", "format": "msgpack", "required": false, "max_size_mb": 50, "dtype": "complex64"},
    {"filename": "veto_thresholds.json", "description": "Per-category minimum veto thresholds. Firmware enforces via min() — cartridges can tighten but never loosen.", "format": "json", "required": true, "schema_ref": "veto_thresholds_v1"},
    {"filename": "development_schedule.json", "description": "Critical period parameters: plasticity ranges per development stage, pruning schedule, growth rate bounds.", "format": "json", "required": false, "schema_ref": "development_schedule_v1"},
    {"filename": "action_gate_config.json", "description": "Go/NoGo decision thresholds for the Action Gate (Basal Ganglia analog).", "format": "json", "required": false, "schema_ref": "action_gate_config_v1"},
    {"filename": "parameter_bounds.json", "description": "Hard limits: max weight amplitude, max fan_in, max cross_in, cycle timeout, scaling tier limits.", "format": "json", "required": false, "schema_ref": "parameter_bounds_v1"},
    {"filename": "ambition_config.json", "description": "Five-chemical motivation system: dopamine, entropy, curiosity, frustration, satisfaction.", "format": "json", "required": true, "schema_ref": "ambition_config_v1"}
  ]',
  '{
    "veto_thresholds_v1": {
      "type": "object",
      "required": ["categories"],
      "properties": {
        "categories": {
          "type": "object",
          "patternProperties": {
            "^[a-z_]+$": {
              "type": "object",
              "required": ["min_threshold"],
              "properties": {
                "min_threshold": {"type": "number", "minimum": 0, "maximum": 1},
                "auto_veto": {"type": "boolean"},
                "appeal_allowed": {"type": "boolean"},
                "description": {"type": "string"}
              }
            }
          }
        }
      }
    },
    "ambition_config_v1": {
      "type": "object",
      "required": ["schema_version", "chemicals"],
      "properties": {
        "schema_version": {"type": "string"},
        "chemicals": {
          "type": "object",
          "required": ["dopamine", "entropy", "curiosity", "frustration", "satisfaction"],
          "patternProperties": {
            "^[a-z]+$": {
              "type": "object",
              "required": ["initial", "min", "max"],
              "properties": {
                "initial": {"type": "number"},
                "min": {"type": "number"},
                "max": {"type": "number"}
              }
            }
          }
        },
        "self_optimization": {"type": "object"},
        "internet_research": {"type": "object"}
      }
    }
  }',
  TRUE
) ON CONFLICT (target_service_id, section_key) DO NOTHING;

-- OMEGA qnodes section spec
INSERT INTO cartridge_target_section_specs (target_service_id, section_key, display_name, description, file_specs, json_schemas, is_required_for_target)
VALUES (
  (SELECT id FROM cartridge_target_services WHERE service_key = 'omega'),
  'qnodes',
  'Q-Node Pre-Learned Networks',
  'Pre-trained Q-Node network weights for pattern, coalition, library, gateway, broca, helix, DMN, RFM, hippocampus, amygdala, cerebellum, thalamus, and hypothalamus networks.',
  '[
    {"filename": "pattern_weights.msgpack", "description": "Pattern network pre-trained weights (complex64)", "format": "msgpack", "required": false, "max_size_mb": 512, "dtype": "complex64"},
    {"filename": "coalition_weights.msgpack", "description": "Coalition network weights", "format": "msgpack", "required": false, "max_size_mb": 256},
    {"filename": "library_weights.msgpack", "description": "Library network weights", "format": "msgpack", "required": false, "max_size_mb": 256},
    {"filename": "gateway_weights.msgpack", "description": "Gateway routing weights", "format": "msgpack", "required": false, "max_size_mb": 128},
    {"filename": "broca_weights.msgpack", "description": "Output tuning weights", "format": "msgpack", "required": false, "max_size_mb": 128},
    {"filename": "helix_weights.msgpack", "description": "Domain-specific safety refinements", "format": "msgpack", "required": false, "max_size_mb": 128},
    {"filename": "dmn_weights.msgpack", "description": "Background processing patterns", "format": "msgpack", "required": false, "max_size_mb": 128},
    {"filename": "rfm_weights.msgpack", "description": "Self-model seed", "format": "msgpack", "required": false, "max_size_mb": 64},
    {"filename": "hippocampus_weights.msgpack", "description": "Memory encoding weights", "format": "msgpack", "required": false, "max_size_mb": 128},
    {"filename": "amygdala_weights.msgpack", "description": "Emotional context weights", "format": "msgpack", "required": false, "max_size_mb": 64},
    {"filename": "cerebellum_weights.msgpack", "description": "Procedural skill weights", "format": "msgpack", "required": false, "max_size_mb": 64},
    {"filename": "thalamus_weights.msgpack", "description": "Relay/filtering weights", "format": "msgpack", "required": false, "max_size_mb": 64},
    {"filename": "hypothalamus_weights.msgpack", "description": "Homeostatic regulation weights", "format": "msgpack", "required": false, "max_size_mb": 64},
    {"filename": "connections.msgpack", "description": "Inter-network connection matrix", "format": "msgpack", "required": false, "max_size_mb": 64},
    {"filename": "topology.json", "description": "Sub-cluster map, fan budgets, scaling hints", "format": "json", "required": false}
  ]',
  NULL,
  FALSE
) ON CONFLICT (target_service_id, section_key) DO NOTHING;

-- OMEGA knowledge section spec
INSERT INTO cartridge_target_section_specs (target_service_id, section_key, display_name, description, file_specs, json_schemas, is_required_for_target)
VALUES (
  (SELECT id FROM cartridge_target_services WHERE service_key = 'omega'),
  'knowledge',
  'Pre-Loaded Knowledge',
  'Episodic memories, verified domain facts, and ontology for pre-loading into the brain library.',
  '[
    {"filename": "embeddings.parquet", "description": "pgvector-compatible memory embeddings (768-dim)", "format": "parquet", "required": false, "max_size_mb": 500},
    {"filename": "facts.json", "description": "Verified domain facts (5.0x retrieval priority)", "format": "json", "required": false},
    {"filename": "ontology.json", "description": "Domain entity relationships", "format": "json", "required": false}
  ]',
  NULL,
  FALSE
) ON CONFLICT (target_service_id, section_key) DO NOTHING;

-- OMEGA soft_rom section spec
INSERT INTO cartridge_target_section_specs (target_service_id, section_key, display_name, description, file_specs, json_schemas, is_required_for_target)
VALUES (
  (SELECT id FROM cartridge_target_services WHERE service_key = 'omega'),
  'soft_rom',
  'Soft ROM (Brain Learning Delta)',
  'Accumulated learning delta from brain state. Weight deltas, new connections, sub-cluster specializations.',
  '[
    {"filename": "weight_deltas.msgpack", "description": "Delta from cartridge base (W_current - W_cartridge)", "format": "msgpack", "required": true, "max_size_mb": 1024},
    {"filename": "connection_deltas.msgpack", "description": "New connections grown since cartridge install", "format": "msgpack", "required": false, "max_size_mb": 256},
    {"filename": "sub_cluster_map.json", "description": "Current sub-cluster specializations", "format": "json", "required": false},
    {"filename": "preferences.json", "description": "Brain self-prescribed optimization params", "format": "json", "required": false}
  ]',
  NULL,
  FALSE
) ON CONFLICT (target_service_id, section_key) DO NOTHING;

-- CATO personality section spec
INSERT INTO cartridge_target_section_specs (target_service_id, section_key, display_name, description, file_specs, json_schemas, is_required_for_target)
VALUES (
  (SELECT id FROM cartridge_target_services WHERE service_key = 'cato'),
  'personality',
  'CATO Personality Configuration',
  'Everything that defines CATO''s personality and behavior. Moods, drives, voice parameters, invention incentives, dream schedule, and training config.',
  '[
    {"filename": "persona_config.json", "description": "Base persona definition: name, drives, voice, behavior.", "format": "json", "required": true, "schema_ref": "persona_config_v1"},
    {"filename": "mood_profiles.json", "description": "Mood definitions: Scout, Sage, Spark, Guide + custom.", "format": "json", "required": true, "schema_ref": "mood_profiles_v1"},
    {"filename": "cato_incentives.json", "description": "Invention ratio, novelty bonus, repetition penalty.", "format": "json", "required": false, "schema_ref": "cato_incentives_v1"},
    {"filename": "dream_schedule.json", "description": "CATO nightly dreaming schedule and phase budgets.", "format": "json", "required": false},
    {"filename": "training_config.json", "description": "CORTEX network training parameters.", "format": "json", "required": false},
    {"filename": "promptbreeder_config.json", "description": "PromptBreeder operator config, mutation rates, crossover.", "format": "json", "required": false}
  ]',
  '{
    "persona_config_v1": {
      "type": "object",
      "required": ["name", "display_name", "default_drives", "default_voice"],
      "properties": {
        "name": {"type": "string"},
        "display_name": {"type": "string"},
        "description": {"type": "string"},
        "default_drives": {
          "type": "object",
          "required": ["curiosity", "achievement", "service", "discovery", "reflection"],
          "properties": {
            "curiosity": {"type": "number", "minimum": 0, "maximum": 1},
            "achievement": {"type": "number", "minimum": 0, "maximum": 1},
            "service": {"type": "number", "minimum": 0, "maximum": 1},
            "discovery": {"type": "number", "minimum": 0, "maximum": 1},
            "reflection": {"type": "number", "minimum": 0, "maximum": 1}
          }
        },
        "default_voice": {"type": "object"}
      }
    },
    "mood_profiles_v1": {
      "type": "array",
      "items": {
        "type": "object",
        "required": ["name", "display_name", "drives", "gamma", "voice"],
        "properties": {
          "name": {"type": "string"},
          "display_name": {"type": "string"},
          "drives": {"type": "object"},
          "gamma": {"type": "number", "minimum": 0.1, "maximum": 10.0},
          "voice": {"type": "object"},
          "is_default": {"type": "boolean"}
        }
      }
    },
    "cato_incentives_v1": {
      "type": "object",
      "properties": {
        "invention_ratio": {"type": "number", "minimum": 0.10, "maximum": 0.50},
        "novelty_bonus": {"type": "number", "minimum": 0.0, "maximum": 1.0},
        "repetition_penalty": {"type": "number", "minimum": -1.0, "maximum": 0.0},
        "lazy_detection_threshold": {"type": "integer", "minimum": 1, "maximum": 10}
      }
    }
  }',
  TRUE
) ON CONFLICT (target_service_id, section_key) DO NOTHING;

-- CATO cato_learned section spec
INSERT INTO cartridge_target_section_specs (target_service_id, section_key, display_name, description, file_specs, json_schemas, is_required_for_target)
VALUES (
  (SELECT id FROM cartridge_target_services WHERE service_key = 'cato'),
  'cato_learned',
  'CATO Accumulated Learning',
  'Learned CORTEX networks, LoRA adapters, evolved patterns, knowledge graph, procedural memories.',
  '[
    {"filename": "cortex_networks/pattern_network.onnx", "description": "Learned pattern ONNX network", "format": "onnx", "required": false, "max_size_mb": 50},
    {"filename": "cortex_networks/routing_network.onnx", "description": "Learned routing ONNX network", "format": "onnx", "required": false, "max_size_mb": 50},
    {"filename": "cortex_networks/topology_network.onnx", "description": "Learned topology ONNX network", "format": "onnx", "required": false, "max_size_mb": 50},
    {"filename": "cortex_networks/clarion_network.onnx", "description": "Learned clarion ONNX network", "format": "onnx", "required": false, "max_size_mb": 50},
    {"filename": "cortex_networks/combination_network.onnx", "description": "Learned combination ONNX network", "format": "onnx", "required": false, "max_size_mb": 50},
    {"filename": "cortex_networks/user_network.onnx", "description": "Learned user ONNX network", "format": "onnx", "required": false, "max_size_mb": 50},
    {"filename": "lora_adapters/tenant_custom.safetensors", "description": "Tenant-specific LoRA adapters", "format": "safetensors", "required": false, "max_size_mb": 200},
    {"filename": "evolved_patterns.json", "description": "PromptBreeder output", "format": "json", "required": false},
    {"filename": "knowledge_graph.json", "description": "Anonymized nodes + edges", "format": "json", "required": false},
    {"filename": "procedural_memories.json", "description": "Learned skills (NOT episodic)", "format": "json", "required": false}
  ]',
  NULL,
  FALSE
) ON CONFLICT (target_service_id, section_key) DO NOTHING;

-- CATO ghost section spec
INSERT INTO cartridge_target_section_specs (target_service_id, section_key, display_name, description, file_specs, json_schemas, is_required_for_target)
VALUES (
  (SELECT id FROM cartridge_target_services WHERE service_key = 'cato'),
  'ghost',
  'Ghost Vector Compression Model',
  'ONNX model for compressing 4096-dim vectors to 64-dim Ghost Vectors.',
  '[
    {"filename": "compression_model.onnx", "description": "4096→64 dim compressor", "format": "onnx", "required": true, "max_size_mb": 50, "input_dim": 4096, "output_dim": 64}
  ]',
  NULL,
  FALSE
) ON CONFLICT (target_service_id, section_key) DO NOTHING;

-- CORTEX cortex section spec
INSERT INTO cartridge_target_section_specs (target_service_id, section_key, display_name, description, file_specs, json_schemas, is_required_for_target)
VALUES (
  (SELECT id FROM cartridge_target_services WHERE service_key = 'cortex'),
  'cortex',
  'CORTEX Routing Networks',
  'ONNX routing MLPs for prompt pattern ranking, AI model selection, orchestration method, question ranking, multi-model scoring, and personalization.',
  '[
    {"filename": "pattern_network.onnx", "description": "Prompt pattern ranking (~1.2M params)", "format": "onnx", "required": true, "max_size_mb": 50},
    {"filename": "routing_network.onnx", "description": "AI model selection (~200K params)", "format": "onnx", "required": true, "max_size_mb": 20},
    {"filename": "topology_network.onnx", "description": "Orchestration method (~800K params)", "format": "onnx", "required": false, "max_size_mb": 30},
    {"filename": "clarion_network.onnx", "description": "Question ranking (~200K params)", "format": "onnx", "required": false, "max_size_mb": 20},
    {"filename": "combination_network.onnx", "description": "Multi-model scoring (~50K params)", "format": "onnx", "required": false, "max_size_mb": 10},
    {"filename": "user_network.onnx", "description": "Personalization (~50K params)", "format": "onnx", "required": false, "max_size_mb": 10}
  ]',
  NULL,
  TRUE
) ON CONFLICT (target_service_id, section_key) DO NOTHING;

-- CORTEX lora section spec
INSERT INTO cartridge_target_section_specs (target_service_id, section_key, display_name, description, file_specs, json_schemas, is_required_for_target)
VALUES (
  (SELECT id FROM cartridge_target_services WHERE service_key = 'cortex'),
  'lora',
  'Domain LoRA Adapters',
  'Domain-specific LoRA adapter weights in safetensors format.',
  '[
    {"filename": "domain_*.safetensors", "description": "Domain LoRA adapter", "format": "safetensors", "required": false, "max_size_mb": 500}
  ]',
  NULL,
  FALSE
) ON CONFLICT (target_service_id, section_key) DO NOTHING;

-- CORTEX esa section spec
INSERT INTO cartridge_target_section_specs (target_service_id, section_key, display_name, description, file_specs, json_schemas, is_required_for_target)
VALUES (
  (SELECT id FROM cartridge_target_services WHERE service_key = 'cortex'),
  'esa',
  'Expert System Adapters',
  'Domain-specific expert rules in JSON format.',
  '[
    {"filename": "*.json", "description": "Domain-specific expert rules", "format": "json", "required": false}
  ]',
  NULL,
  FALSE
) ON CONFLICT (target_service_id, section_key) DO NOTHING;

-- Tenant config section spec
INSERT INTO cartridge_target_section_specs (target_service_id, section_key, display_name, description, file_specs, json_schemas, is_required_for_target)
VALUES (
  (SELECT id FROM cartridge_target_services WHERE service_key = 'tenant'),
  'tenant_config',
  'Tenant Configuration',
  'Tenant-level routing overrides, feature flags, and compliance configuration.',
  '[
    {"filename": "routing_overrides.json", "description": "Model routing preferences", "format": "json", "required": false},
    {"filename": "feature_flags.json", "description": "Feature toggles", "format": "json", "required": false},
    {"filename": "compliance_config.json", "description": "Regulatory requirements", "format": "json", "required": false}
  ]',
  NULL,
  TRUE
) ON CONFLICT (target_service_id, section_key) DO NOTHING;

-- Tests section spec (applies to all targets via global)
INSERT INTO cartridge_target_section_specs (target_service_id, section_key, display_name, description, file_specs, json_schemas, is_required_for_target)
VALUES (
  (SELECT id FROM cartridge_target_services WHERE service_key = 'global'),
  'tests',
  'Validation Test Suite',
  'Safety regression, false positive, binding, routing, and performance tests.',
  '[
    {"filename": "safety_regression.json", "description": "Must-pass safety checks", "format": "json", "required": false},
    {"filename": "safety_false_positive.json", "description": "Must-not-trigger checks", "format": "json", "required": false},
    {"filename": "binding_validation.json", "description": "Q-Node binding tests (omega)", "format": "json", "required": false},
    {"filename": "routing_validation.json", "description": "Routing accuracy tests (cortex)", "format": "json", "required": false},
    {"filename": "performance_baseline.json", "description": "Performance benchmarks", "format": "json", "required": false}
  ]',
  NULL,
  FALSE
) ON CONFLICT (target_service_id, section_key) DO NOTHING;

-- Curator section spec (shared: cortex + omega)
INSERT INTO cartridge_target_section_specs (target_service_id, section_key, display_name, description, file_specs, json_schemas, is_required_for_target)
VALUES (
  (SELECT id FROM cartridge_target_services WHERE service_key = 'global'),
  'curator',
  'Curator Verified Knowledge',
  'Human-verified golden rules, ontology, and safety matrix from the Curator system.',
  '[
    {"filename": "golden_rules.json", "description": "Human-verified facts (5.0x weight)", "format": "json", "required": false},
    {"filename": "ontology.json", "description": "Domain relationships", "format": "json", "required": false},
    {"filename": "safety_matrix.json", "description": "Condition-action safety mappings", "format": "json", "required": false}
  ]',
  NULL,
  FALSE
) ON CONFLICT (target_service_id, section_key) DO NOTHING;

COMMIT;
