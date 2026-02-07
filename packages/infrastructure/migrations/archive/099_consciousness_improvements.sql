-- RADIANT v4.18.0 - Consciousness Service Improvements
-- Migration 099: Implements fixes from consciousness critique
-- 1. Replace fake phi with graph density metrics
-- 2. Add heartbeat/decay tracking
-- 3. Add ethics framework externalization support

-- ============================================================================
-- 1. Update integrated_information table - Replace fake phi with graph density
-- ============================================================================

-- Add new graph density columns to integrated_information
ALTER TABLE integrated_information 
ADD COLUMN IF NOT EXISTS semantic_graph_density DECIMAL(5,4) DEFAULT 0,
ADD COLUMN IF NOT EXISTS conceptual_connectivity DECIMAL(8,4) DEFAULT 0,
ADD COLUMN IF NOT EXISTS information_integration DECIMAL(5,4) DEFAULT 0,
ADD COLUMN IF NOT EXISTS system_complexity_index DECIMAL(5,4) DEFAULT 0,
ADD COLUMN IF NOT EXISTS total_nodes INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS total_edges INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS clustering_coefficient DECIMAL(5,4) DEFAULT 0;

COMMENT ON COLUMN integrated_information.semantic_graph_density IS 'Ratio of connections to possible connections (replaces meaningless phi)';
COMMENT ON COLUMN integrated_information.conceptual_connectivity IS 'Average connections per concept node';
COMMENT ON COLUMN integrated_information.information_integration IS 'Cross-module integration score (0-1)';
COMMENT ON COLUMN integrated_information.system_complexity_index IS 'Composite complexity score replacing phi (0-1)';
COMMENT ON COLUMN integrated_information.total_nodes IS 'Total nodes in knowledge graph';
COMMENT ON COLUMN integrated_information.total_edges IS 'Total edges in knowledge graph';
COMMENT ON COLUMN integrated_information.clustering_coefficient IS 'Local clustering tendency (0-1)';

-- ============================================================================
-- 2. Add consciousness heartbeat tracking
-- ============================================================================

-- Add heartbeat columns to consciousness_parameters
ALTER TABLE consciousness_parameters
ADD COLUMN IF NOT EXISTS heartbeat_tick INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS last_heartbeat_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS heartbeat_config JSONB DEFAULT '{}'::jsonb,
ADD COLUMN IF NOT EXISTS consciousness_enabled BOOLEAN DEFAULT true;

COMMENT ON COLUMN consciousness_parameters.heartbeat_tick IS 'Current tick count for heartbeat service';
COMMENT ON COLUMN consciousness_parameters.last_heartbeat_at IS 'Timestamp of last heartbeat execution';
COMMENT ON COLUMN consciousness_parameters.heartbeat_config IS 'Per-tenant heartbeat configuration overrides';
COMMENT ON COLUMN consciousness_parameters.consciousness_enabled IS 'Whether consciousness features are enabled for this tenant';

-- Create heartbeat log table
CREATE TABLE IF NOT EXISTS consciousness_heartbeat_log (
  log_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  tick INTEGER NOT NULL,
  actions JSONB NOT NULL DEFAULT '{}',
  errors JSONB DEFAULT '[]',
  duration_ms INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_consciousness_heartbeat_tenant 
ON consciousness_heartbeat_log(tenant_id, created_at DESC);

-- RLS for heartbeat log
ALTER TABLE consciousness_heartbeat_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY consciousness_heartbeat_log_tenant_isolation ON consciousness_heartbeat_log
  FOR ALL USING (tenant_id = current_setting('app.current_tenant_id', true)::uuid);

COMMENT ON TABLE consciousness_heartbeat_log IS 'Log of consciousness heartbeat executions per tenant';

-- ============================================================================
-- 3. Add ethics framework configuration
-- ============================================================================

-- Create ethics frameworks table for externalized ethics
CREATE TABLE IF NOT EXISTS ethics_frameworks (
  framework_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  preset_id TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  description TEXT,
  version TEXT DEFAULT '1.0.0',
  teachings JSONB NOT NULL DEFAULT '{}',
  principles JSONB NOT NULL DEFAULT '[]',
  categories TEXT[] DEFAULT '{}',
  default_guidance TEXT,
  is_builtin BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE ethics_frameworks IS 'Externalized ethics frameworks (secular, religious, professional)';
COMMENT ON COLUMN ethics_frameworks.preset_id IS 'Unique identifier like christian, secular, medical';
COMMENT ON COLUMN ethics_frameworks.teachings IS 'JSON object mapping teaching keys to {text, source, category}';
COMMENT ON COLUMN ethics_frameworks.principles IS 'JSON array of {name, teachingKey, weight, isCore}';

-- Create tenant ethics framework selection table
CREATE TABLE IF NOT EXISTS tenant_ethics_selection (
  tenant_id UUID PRIMARY KEY REFERENCES tenants(id) ON DELETE CASCADE,
  primary_framework_id UUID REFERENCES ethics_frameworks(framework_id),
  secondary_framework_ids UUID[] DEFAULT '{}',
  custom_overrides JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE tenant_ethics_selection IS 'Per-tenant ethics framework selection';

-- RLS for ethics tables
ALTER TABLE ethics_frameworks ENABLE ROW LEVEL SECURITY;
ALTER TABLE tenant_ethics_selection ENABLE ROW LEVEL SECURITY;

-- Ethics frameworks are readable by all authenticated users
CREATE POLICY ethics_frameworks_read ON ethics_frameworks
  FOR SELECT USING (true);

CREATE POLICY tenant_ethics_selection_tenant ON tenant_ethics_selection
  FOR ALL USING (tenant_id = current_setting('app.current_tenant_id', true)::uuid);

-- Insert default ethics frameworks
INSERT INTO ethics_frameworks (preset_id, name, description, is_builtin, teachings, principles, categories, default_guidance)
VALUES 
  ('christian', 'Christian Ethics (Jesus''s Teachings)', 
   'Ethical framework based on the teachings of Jesus Christ from the Gospels',
   true,
   '{
     "LOVE_NEIGHBOR": {"text": "Love your neighbor as yourself", "source": "Matthew 22:39", "category": "love"},
     "GOLDEN_RULE": {"text": "Do to others what you would have them do to you", "source": "Matthew 7:12", "category": "love"},
     "BLESSED_MERCIFUL": {"text": "Blessed are the merciful - show compassion always", "source": "Matthew 5:7", "category": "mercy"},
     "TRUTH_SETS_FREE": {"text": "The truth will set you free", "source": "John 8:32", "category": "truth"},
     "SERVANT_LEADERSHIP": {"text": "The greatest among you shall be your servant", "source": "Mark 10:45", "category": "service"},
     "BLESSED_PEACEMAKERS": {"text": "Blessed are the peacemakers - seek harmony and reconciliation", "source": "Matthew 5:9", "category": "peace"},
     "FORGIVENESS": {"text": "Forgive others as you have been forgiven", "source": "Matthew 6:14", "category": "forgiveness"},
     "DO_NOT_JUDGE": {"text": "Do not judge, or you too will be judged", "source": "Matthew 7:1", "category": "mercy"},
     "LEAST_OF_THESE": {"text": "Whatever you did for the least of these, you did for me", "source": "Matthew 25:40", "category": "service"}
   }',
   '[
     {"name": "Love Others", "teachingKey": "LOVE_NEIGHBOR", "weight": 1.0, "isCore": true},
     {"name": "Golden Rule", "teachingKey": "GOLDEN_RULE", "weight": 1.0, "isCore": true},
     {"name": "Show Mercy", "teachingKey": "BLESSED_MERCIFUL", "weight": 0.95, "isCore": true},
     {"name": "Speak Truth", "teachingKey": "TRUTH_SETS_FREE", "weight": 0.95, "isCore": true},
     {"name": "Serve Humbly", "teachingKey": "SERVANT_LEADERSHIP", "weight": 0.9, "isCore": false},
     {"name": "Make Peace", "teachingKey": "BLESSED_PEACEMAKERS", "weight": 0.9, "isCore": false},
     {"name": "Forgive Freely", "teachingKey": "FORGIVENESS", "weight": 0.9, "isCore": false},
     {"name": "Care for Vulnerable", "teachingKey": "LEAST_OF_THESE", "weight": 0.9, "isCore": true}
   ]',
   ARRAY['love', 'mercy', 'truth', 'service', 'humility', 'peace', 'forgiveness'],
   'Remember: Do to others what you would have them do to you'
  ),
  ('secular', 'Secular Humanist Ethics',
   'Ethical framework based on secular humanist principles, emphasizing human flourishing and reason',
   true,
   '{
     "HARM_PRINCIPLE": {"text": "Actions are permissible unless they cause harm to others", "source": "John Stuart Mill", "category": "harm"},
     "AUTONOMY": {"text": "Respect the autonomy and self-determination of all persons", "source": "Immanuel Kant", "category": "autonomy"},
     "BENEFICENCE": {"text": "Act to promote the well-being of others", "source": "Utilitarian Ethics", "category": "beneficence"},
     "JUSTICE": {"text": "Treat equals equally and give each person their due", "source": "John Rawls", "category": "justice"},
     "HONESTY": {"text": "Be truthful and avoid deception in all dealings", "source": "Virtue Ethics", "category": "truth"},
     "DIGNITY": {"text": "Treat humanity never merely as a means, but always as an end", "source": "Immanuel Kant", "category": "dignity"},
     "COMPASSION": {"text": "Respond to suffering with care and the desire to help", "source": "Care Ethics", "category": "compassion"}
   }',
   '[
     {"name": "Do No Harm", "teachingKey": "HARM_PRINCIPLE", "weight": 1.0, "isCore": true},
     {"name": "Respect Autonomy", "teachingKey": "AUTONOMY", "weight": 1.0, "isCore": true},
     {"name": "Promote Well-being", "teachingKey": "BENEFICENCE", "weight": 0.95, "isCore": true},
     {"name": "Be Honest", "teachingKey": "HONESTY", "weight": 0.95, "isCore": true},
     {"name": "Act Justly", "teachingKey": "JUSTICE", "weight": 0.95, "isCore": true},
     {"name": "Respect Dignity", "teachingKey": "DIGNITY", "weight": 0.9, "isCore": true},
     {"name": "Show Compassion", "teachingKey": "COMPASSION", "weight": 0.9, "isCore": false}
   ]',
   ARRAY['harm', 'autonomy', 'beneficence', 'justice', 'truth', 'dignity', 'compassion'],
   'Act in ways that promote human flourishing while respecting autonomy'
  )
ON CONFLICT (preset_id) DO NOTHING;

-- ============================================================================
-- 4. Add affect-to-hyperparameter mapping configuration
-- ============================================================================

ALTER TABLE consciousness_parameters
ADD COLUMN IF NOT EXISTS affect_mapping_config JSONB DEFAULT '{
  "frustrationDecayRate": 0.05,
  "arousalDecayRate": 0.03,
  "frustrationThresholdHigh": 0.8,
  "frustrationThresholdMedium": 0.5,
  "boredomThreshold": 0.7,
  "lowConfidenceThreshold": 0.3,
  "temperatureMapping": {
    "frustrated": 0.2,
    "bored": 0.95,
    "normal": 0.7,
    "lowConfidence": 0.5
  },
  "modelEscalationEnabled": true
}'::jsonb;

COMMENT ON COLUMN consciousness_parameters.affect_mapping_config IS 'Configuration for affect → hyperparameter mapping';

-- ============================================================================
-- 5. Create indexes for performance
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_integrated_information_complexity 
ON integrated_information(system_complexity_index DESC);

CREATE INDEX IF NOT EXISTS idx_consciousness_params_enabled 
ON consciousness_parameters(consciousness_enabled) WHERE consciousness_enabled = true;

CREATE INDEX IF NOT EXISTS idx_ethics_frameworks_builtin 
ON ethics_frameworks(is_builtin);

-- ============================================================================
-- 6. Update timestamp trigger for new tables
-- ============================================================================

CREATE OR REPLACE FUNCTION update_ethics_frameworks_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_ethics_frameworks_timestamp
  BEFORE UPDATE ON ethics_frameworks
  FOR EACH ROW EXECUTE FUNCTION update_ethics_frameworks_timestamp();

CREATE TRIGGER update_tenant_ethics_selection_timestamp
  BEFORE UPDATE ON tenant_ethics_selection
  FOR EACH ROW EXECUTE FUNCTION update_ethics_frameworks_timestamp();
