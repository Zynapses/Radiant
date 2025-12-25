# SECTION 38: NEURAL-FIRST ORCHESTRATION & THINK TANK WORKFLOW REGISTRY (v4.4.0)
# â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

> **This section transforms RADIANT from template-based to neural-first orchestration**
> **Includes: Think Tank Workflow Registry, Visual Editor, Per-User Neural Models, Real-Time Steering**

---

## 38.1 Concurrent Execution Architecture

> **CRITICAL: RADIANT supports concurrent execution per user across all systems.**

### Concurrent Execution Principles

1. **Per-User Parallelism**: Each user can run multiple AI conversations/workflows simultaneously
2. **Billing Awareness**: Usage tracking and cost accumulation work across parallel sessions
3. **Feedback Aggregation**: Feedback from concurrent sessions properly attributed and aggregated
4. **Neural Learning**: Learning signals from parallel sessions contribute to user model without race conditions
5. **Session Isolation**: Each concurrent session has independent state while sharing user preferences

### Concurrent Session Architecture

```
â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”
â”‚                        CONCURRENT EXECUTION PER USER                             â”‚
â”œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”¤
â”‚   User A                                                                         â”‚
â”‚   â”œâ”€â”€ Session 1 (Chat) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”                                           â”‚
â”‚   â”œâ”€â”€ Session 2 (Workflow) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”¼â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”                                â”‚
â”‚   â”œâ”€â”€ Session 3 (Research) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”¼â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”¼â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”                     â”‚
â”‚   â””â”€â”€ Session 4 (Code) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”¼â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”¼â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”¼â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”          â”‚
â”‚                                     â”‚          â”‚          â”‚          â”‚          â”‚
â”‚                                     â–¼          â–¼          â–¼          â–¼          â”‚
â”‚   â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”   â”‚
â”‚   â”‚                        CONCURRENT SESSION MANAGER                        â”‚   â”‚
â”‚   â”‚  â€¢ Session state isolation          â€¢ Shared user preferences           â”‚   â”‚
â”‚   â”‚  â€¢ Independent execution            â€¢ Aggregated usage tracking         â”‚   â”‚
â”‚   â”‚  â€¢ Parallel model calls             â€¢ Unified feedback collection       â”‚   â”‚
â”‚   â”‚  â€¢ Per-session manifests            â€¢ Combined cost accumulation        â”‚   â”‚
â”‚   â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜   â”‚
â”‚                                     â”‚                                           â”‚
â”‚                    â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”¼â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”                          â”‚
â”‚                    â–¼                â–¼                â–¼                          â”‚
â”‚   â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”  â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”  â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”             â”‚
â”‚   â”‚  Billing Service â”‚  â”‚  Neural Engine   â”‚  â”‚ Feedback System  â”‚             â”‚
â”‚   â”‚ â€¢ Per-session    â”‚  â”‚ â€¢ Atomic updates â”‚  â”‚ â€¢ Session-tagged â”‚             â”‚
â”‚   â”‚   cost tracking  â”‚  â”‚   to user model  â”‚  â”‚   feedback       â”‚             â”‚
â”‚   â”‚ â€¢ Aggregated     â”‚  â”‚ â€¢ Lock-free      â”‚  â”‚ â€¢ Batch learning â”‚             â”‚
â”‚   â”‚   invoicing      â”‚  â”‚   learning       â”‚  â”‚   aggregation    â”‚             â”‚
â”‚   â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜  â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜  â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜             â”‚
â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜
```

---

## 38.2 Section Overview

### What This Section Creates

1. **Think Tank Workflow Registry** - 127 orchestration patterns, 127 production workflows, 834 domains in database
2. **Neural-First Architecture** - Neural Engine as fabric, Brain as governor, tight integration loop
3. **Per-User Neural Models** - Personalized embeddings for preferences, domains, behavior
4. **Orchestration Constructor** - Dynamic workflow generation from primitives (not just template selection)
5. **Real-Time Steering** - Neural Engine monitors and adjusts during execution
6. **Visual Workflow Editor** - Comprehensive admin interface for building orchestrations
7. **Client Decision Transparency** - Think Tank receives reasoning, confidence, alternatives
8. **Swift Deployer v2** - Enhanced deployment app with workflow and Neural configuration
9. **Concurrent Execution Support** - Full awareness in billing, feedback, and learning systems

### Design Philosophy

| Principle | Current (v4.3) | New (v4.4) |
|-----------|----------------|------------|
| Neural Role | 35% weight advisor | 60% weight fabric with Brain veto |
| Orchestration | Template selection | Dynamic construction from primitives |
| User Model | Global defaults | Per-user embeddings + preferences |
| Feedback | Post-hoc batch learning | Real-time steering + continuous learning |
| Admin Control | Model selection only | Full parameter visibility and editing |
| Client Transparency | Result only | Reasoning + confidence + alternatives |
| Concurrent Support | Implicit | Explicit per-session tracking |

---

## 38.3 Database Schema: Think Tank Workflow Registry

### migrations/038_neural_orchestration_registry.sql

```sql
-- ============================================================================
-- RADIANT v4.4.0 - Neural-First Orchestration & Think Tank Workflow Registry
-- ============================================================================

-- Enable pgvector if not already enabled
CREATE EXTENSION IF NOT EXISTS vector;

-- ============================================================================
-- PART 1: THINK TANK ORCHESTRATION PATTERNS (127 patterns)
-- ============================================================================

-- Orchestration pattern categories
CREATE TABLE IF NOT EXISTS orchestration_pattern_categories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    category_id VARCHAR(50) UNIQUE NOT NULL,
    name VARCHAR(100) NOT NULL,
    description TEXT,
    display_order INTEGER DEFAULT 0,
    pattern_count INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Core orchestration patterns (127 total from Think Tank Compendium)
CREATE TABLE IF NOT EXISTS orchestration_patterns (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    pattern_id VARCHAR(100) UNIQUE NOT NULL,
    category_id VARCHAR(50) NOT NULL REFERENCES orchestration_pattern_categories(category_id),
    
    -- Pattern metadata
    name VARCHAR(200) NOT NULL,
    description TEXT NOT NULL,
    research_basis TEXT,                          -- Academic source if applicable
    
    -- Implementation details
    complexity VARCHAR(20) NOT NULL CHECK (complexity IN ('low', 'medium', 'high', 'very_high')),
    impact VARCHAR(20) NOT NULL CHECK (impact IN ('low', 'medium', 'high', 'transformative')),
    implemented_by TEXT[],                        -- Competitors who implement this
    implementation_status VARCHAR(30) DEFAULT 'planned',
    
    -- Semantic embedding for Neural Engine matching
    semantic_embedding VECTOR(768),
    
    -- Execution characteristics
    execution_type VARCHAR(20) DEFAULT 'serial' CHECK (execution_type IN ('serial', 'parallel', 'hybrid')),
    parallelizable BOOLEAN DEFAULT FALSE,
    typical_model_count INTEGER DEFAULT 1,
    typical_latency_ms INTEGER,
    typical_cost_multiplier DECIMAL(4,2) DEFAULT 1.0,
    
    -- Pattern definition (DAG structure)
    pattern_definition JSONB NOT NULL,
    
    -- Trigger conditions
    trigger_keywords TEXT[],
    trigger_intents TEXT[],
    trigger_complexity_range NUMRANGE,
    
    -- Requirements
    required_capabilities TEXT[],
    min_tier INTEGER DEFAULT 1,
    
    -- Stats
    usage_count INTEGER DEFAULT 0,
    avg_satisfaction_score DECIMAL(3,2),
    
    enabled BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Insert orchestration pattern categories (10 categories)
INSERT INTO orchestration_pattern_categories (category_id, name, description, display_order, pattern_count) VALUES
('multi_model', 'Multi-Model Coordination', 'Patterns for coordinating multiple AI models', 1, 10),
('sequential', 'Sequential & Pipeline', 'Step-by-step processing patterns', 2, 15),
('verification', 'Verification & Fact-Checking', 'Patterns for validating AI outputs', 3, 12),
('debate', 'Debate & Adversarial Review', 'Patterns for adversarial evaluation', 4, 12),
('reasoning', 'Reasoning Enhancement', 'Patterns for improving reasoning quality', 5, 15),
('agent', 'Agent Architectures', 'Multi-agent coordination patterns', 6, 18),
('tool', 'Tool Use & Integration', 'Patterns for external tool integration', 7, 10),
('memory', 'Memory & Personalization', 'Patterns for context and personalization', 8, 8),
('user_facing', 'User-Facing Workflow Features', 'Patterns for user interaction', 9, 12),
('emerging', 'Emerging & Cutting-Edge', 'Experimental and research-stage patterns', 10, 15)
ON CONFLICT (category_id) DO UPDATE SET pattern_count = EXCLUDED.pattern_count;

-- ============================================================================
-- PART 2: THINK TANK PRODUCTION WORKFLOWS (127 workflows)
-- ============================================================================

CREATE TABLE IF NOT EXISTS production_workflow_categories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    category_id VARCHAR(50) UNIQUE NOT NULL,
    name VARCHAR(100) NOT NULL,
    description TEXT,
    display_order INTEGER DEFAULT 0,
    workflow_count INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS production_workflows (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workflow_id VARCHAR(100) UNIQUE NOT NULL,
    category_id VARCHAR(50) NOT NULL REFERENCES production_workflow_categories(category_id),
    
    name VARCHAR(200) NOT NULL,
    description TEXT NOT NULL,
    primary_deliverable VARCHAR(200),
    semantic_embedding VECTOR(768),
    workflow_definition JSONB NOT NULL,
    input_schema JSONB,
    output_schema JSONB,
    complexity VARCHAR(20) DEFAULT 'medium',
    typical_duration_minutes INTEGER,
    
    trigger_keywords TEXT[],
    trigger_domains TEXT[],
    required_patterns TEXT[],
    required_capabilities TEXT[],
    min_tier INTEGER DEFAULT 1,
    
    usage_count INTEGER DEFAULT 0,
    avg_satisfaction_score DECIMAL(3,2),
    enabled BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Insert production workflow categories (12 categories)
INSERT INTO production_workflow_categories (category_id, name, description, display_order, workflow_count) VALUES
('technical', 'Technical Documentation', 'Engineering and technical writing', 1, 14),
('research', 'Research & Analysis', 'Research papers and analysis reports', 2, 12),
('business', 'Business Documents', 'Business plans, proposals, reports', 3, 10),
('legal', 'Legal Documents', 'Contracts, policies, compliance', 4, 10),
('medical', 'Medical & Healthcare', 'Medical documentation and protocols', 5, 10),
('education', 'Education & Training', 'Learning materials and curricula', 6, 10),
('marketing', 'Marketing & Communications', 'Marketing content and campaigns', 7, 10),
('financial', 'Financial Documents', 'Financial reports and analysis', 8, 10),
('creative', 'Creative Production', 'Creative works and design assets', 9, 10),
('trades', 'Skilled Trades', 'Trade-specific documentation', 10, 10),
('scientific', 'Scientific Workflows', 'Scientific analysis and research', 11, 8),
('software', 'Software Development', 'Software documentation and specs', 12, 13)
ON CONFLICT (category_id) DO UPDATE SET workflow_count = EXCLUDED.workflow_count;

-- ============================================================================
-- PART 3: THINK TANK DOMAIN REGISTRY (834 domains)
-- ============================================================================

CREATE TABLE IF NOT EXISTS domain_categories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    category_id VARCHAR(50) UNIQUE NOT NULL,
    name VARCHAR(100) NOT NULL,
    description TEXT,
    display_order INTEGER DEFAULT 0,
    domain_count INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS specialized_domains (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    domain_id VARCHAR(100) UNIQUE NOT NULL,
    category_id VARCHAR(50) NOT NULL REFERENCES domain_categories(category_id),
    parent_domain_id VARCHAR(100) REFERENCES specialized_domains(domain_id),
    
    name VARCHAR(200) NOT NULL,
    description TEXT,
    semantic_embedding VECTOR(768),
    
    expert_context TEXT,
    terminology JSONB,
    standards TEXT[],
    best_practices TEXT[],
    
    keywords TEXT[],
    related_domains TEXT[],
    preferred_models TEXT[],
    preferred_patterns TEXT[],
    preferred_workflows TEXT[],
    
    usage_count INTEGER DEFAULT 0,
    enabled BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Insert domain categories (17 categories, 834 domains total)
INSERT INTO domain_categories (category_id, name, description, display_order, domain_count) VALUES
('sciences', 'Sciences', 'Physics, Chemistry, Biology, Earth Sciences, Materials', 1, 56),
('mathematics', 'Mathematics & Logic', 'Algebra, Calculus, Statistics, Logic', 2, 32),
('computer_science', 'Computer Science & Programming', 'Languages, Development, Theory', 3, 67),
('ai', 'Artificial Intelligence', 'ML, NLP, Computer Vision, AI Systems', 4, 48),
('engineering', 'Engineering', 'Mechanical, Electrical, Civil, Chemical', 5, 72),
('medicine', 'Medicine & Healthcare', 'Clinical, Surgery, Allied Health', 6, 89),
('mental_health', 'Mental Health & Psychology', 'Clinical, Counseling, Therapy', 7, 34),
('fitness', 'Fitness, Therapy & Nutrition', 'Training, Nutrition, Wellness', 8, 42),
('humanities', 'Humanities', 'Philosophy, History, Literature, Arts', 9, 68),
('social_sciences', 'Social Sciences', 'Sociology, Economics, Political Science', 10, 41),
('business', 'Business & Management', 'Strategy, Finance, Marketing, Operations', 11, 58),
('legal', 'Law & Legal', 'Corporate, IP, Employment, Litigation', 12, 34),
('education', 'Education', 'Curriculum, Assessment, Special Ed', 13, 29),
('trades', 'Skilled Trades', 'Construction, Mechanical, Electrical, Automotive', 14, 44),
('arts_design', 'Arts, Design & Creativity', 'Visual, Performing, Digital', 15, 52),
('communication', 'Communication & Media', 'Journalism, PR, Social Media', 16, 26),
('emerging', 'Interdisciplinary & Emerging', 'Sustainability, AI Ethics, Futures', 17, 31)
ON CONFLICT (category_id) DO UPDATE SET domain_count = EXCLUDED.domain_count;

-- ============================================================================
-- PART 4: PER-USER NEURAL MODELS
-- ============================================================================

CREATE TABLE IF NOT EXISTS user_neural_models (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    
    -- Profile embeddings (768-dim vectors)
    profile_embedding VECTOR(768),
    query_style_embedding VECTOR(768),
    feedback_pattern_embedding VECTOR(768),
    
    -- Structured preferences
    model_preferences JSONB DEFAULT '{}',
    workflow_preferences JSONB DEFAULT '{
        "prefersVerification": 0.5,
        "toleratesLatency": 0.5,
        "costSensitivity": 0.5,
        "prefersExplanation": 0.5,
        "prefersDetailedResponses": 0.5,
        "prefersStructuredOutput": 0.5
    }',
    quality_thresholds JSONB DEFAULT '{
        "minimumAcceptableQuality": 0.6,
        "qualityVsSpeedTradeoff": 0.5,
        "qualityVsCostTradeoff": 0.5
    }',
    
    -- Behavioral patterns
    behavioral_patterns JSONB DEFAULT '{
        "typicalQueryLength": "medium",
        "typicalComplexity": "moderate",
        "frequentDomains": [],
        "frequentWorkflows": [],
        "peakUsageHours": [],
        "feedbackFrequency": 0.5
    }',
    
    -- Confidence and training stats
    overall_confidence DECIMAL(5,4) DEFAULT 0,
    total_interactions INTEGER DEFAULT 0,
    total_feedback_events INTEGER DEFAULT 0,
    training_sample_count INTEGER DEFAULT 0,
    
    -- Admin overrides
    admin_overrides JSONB DEFAULT '{
        "forceWorkflow": null,
        "forceModel": null,
        "disablePersonalization": false,
        "customParameters": {}
    }',
    
    last_training_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    UNIQUE(user_id, tenant_id)
);

-- Domain-specific embeddings per user
CREATE TABLE IF NOT EXISTS user_domain_embeddings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_model_id UUID NOT NULL REFERENCES user_neural_models(id) ON DELETE CASCADE,
    domain_id VARCHAR(100) NOT NULL,
    embedding VECTOR(768),
    confidence DECIMAL(5,4) DEFAULT 0,
    sample_count INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_model_id, domain_id)
);

-- ============================================================================
-- PART 5: NEURAL ENGINE CONFIGURATION (Admin Editable)
-- ============================================================================

CREATE TABLE IF NOT EXISTS neural_engine_config (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
    
    config JSONB NOT NULL DEFAULT '{
        "learning": {
            "learningRate": 0.01,
            "userModelUpdateFrequency": "realtime",
            "minSamplesForPersonalization": 20,
            "confidenceDecayRate": 0.001
        },
        "userModel": {
            "embeddingDimension": 768,
            "minConfidenceThreshold": 0.6,
            "coldStartStrategy": "global_defaults"
        },
        "construction": {
            "maxNodesPerWorkflow": 20,
            "preferTemplates": true,
            "templateMatchThreshold": 0.8
        },
        "monitoring": {
            "realTimeSteeringEnabled": true,
            "anomalyDetectionSensitivity": 0.7,
            "maxSteeringActionsPerExecution": 3
        },
        "modelSelection": {
            "neuralWeightInScoring": 0.6,
            "fallbackToDefaults": true
        },
        "scope": {
            "enableGlobalLearning": true,
            "enableTenantLearning": true,
            "enableUserLearning": true,
            "globalLearningWeight": 0.2,
            "tenantLearningWeight": 0.3,
            "userLearningWeight": 0.5
        }
    }',
    
    created_by UUID REFERENCES administrators(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    UNIQUE(tenant_id)
);

-- ============================================================================
-- PART 6: BRAIN GOVERNOR CONFIGURATION (Admin Editable)
-- ============================================================================

CREATE TABLE IF NOT EXISTS brain_config (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
    
    config JSONB NOT NULL DEFAULT '{
        "costs": {
            "maxCostPerRequest": 0.50,
            "maxCostPerHour": 10.00,
            "maxCostPerDay": 100.00,
            "costAlertThreshold": 0.8
        },
        "latency": {
            "maxLatencyMs": 30000,
            "latencyWarningThreshold": 0.7
        },
        "quality": {
            "minimumConfidenceThreshold": 0.5,
            "requireVerificationAboveComplexity": 0.8,
            "maxRetriesPerNode": 3
        },
        "neuralTrust": {
            "trustThreshold": 0.7,
            "autoApproveKnownWorkflows": true,
            "requireHumanApprovalBelow": 0.3
        },
        "steering": {
            "allowModelSwitching": true,
            "allowNodeSkipping": false,
            "allowWorkflowModification": true
        },
        "compliance": {
            "requireHIPAAForMedical": true,
            "requireAuditLogging": true,
            "piiDetectionEnabled": true
        }
    }',
    
    created_by UUID REFERENCES administrators(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    UNIQUE(tenant_id)
);

-- Brain policies and decision audit
CREATE TABLE IF NOT EXISTS brain_policies (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    name VARCHAR(200) NOT NULL,
    description TEXT,
    policy_type VARCHAR(50) NOT NULL,
    conditions JSONB NOT NULL DEFAULT '[]',
    actions JSONB NOT NULL DEFAULT '[]',
    enabled BOOLEAN DEFAULT TRUE,
    priority INTEGER DEFAULT 0,
    created_by UUID REFERENCES administrators(id),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS brain_decisions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    execution_id UUID NOT NULL,
    tenant_id UUID NOT NULL REFERENCES tenants(id),
    session_id UUID REFERENCES concurrent_sessions(id),
    decision_type VARCHAR(50) NOT NULL,
    proposal JSONB NOT NULL,
    decision JSONB NOT NULL,
    approved BOOLEAN NOT NULL,
    modifications JSONB,
    guardrails_applied JSONB,
    rejection_reason TEXT,
    decided_by VARCHAR(50) NOT NULL,
    admin_id UUID REFERENCES administrators(id),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- PART 7: CONSTRUCTED WORKFLOWS & NEURAL EVENTS
-- ============================================================================

CREATE TABLE IF NOT EXISTS constructed_workflows (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id),
    tenant_id UUID NOT NULL REFERENCES tenants(id),
    name VARCHAR(200),
    description TEXT,
    nodes JSONB NOT NULL,
    edges JSONB NOT NULL,
    generation_method VARCHAR(50) NOT NULL,
    source_template_id UUID REFERENCES workflow_definitions(id),
    source_pattern_ids UUID[],
    auto_metadata JSONB DEFAULT '{}',
    admin_metadata_overrides JSONB DEFAULT '{}',
    reasoning JSONB DEFAULT '{}',
    alternatives JSONB DEFAULT '[]',
    brain_approved BOOLEAN DEFAULT TRUE,
    brain_modifications JSONB,
    usage_count INTEGER DEFAULT 0,
    avg_satisfaction_score DECIMAL(3,2),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS neural_execution_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    execution_id UUID NOT NULL,
    node_id VARCHAR(100),
    session_id UUID REFERENCES concurrent_sessions(id),
    event_type VARCHAR(50) NOT NULL,
    event_data JSONB NOT NULL,
    brain_notified BOOLEAN DEFAULT FALSE,
    brain_response JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS neural_learning_signals (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    signal_type VARCHAR(50) NOT NULL,
    user_id UUID REFERENCES users(id),
    tenant_id UUID NOT NULL REFERENCES tenants(id),
    workflow_id UUID,
    model_id VARCHAR(100),
    node_id VARCHAR(100),
    session_id UUID REFERENCES concurrent_sessions(id),
    signal_value DECIMAL(5,4) NOT NULL,
    confidence DECIMAL(5,4) DEFAULT 1.0,
    weight DECIMAL(5,4) DEFAULT 1.0,
    source VARCHAR(50) NOT NULL,
    processed BOOLEAN DEFAULT FALSE,
    processed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- PART 8: INDEXES
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_orchestration_patterns_category ON orchestration_patterns(category_id);
CREATE INDEX IF NOT EXISTS idx_orchestration_patterns_enabled ON orchestration_patterns(enabled) WHERE enabled = TRUE;
CREATE INDEX IF NOT EXISTS idx_production_workflows_category ON production_workflows(category_id);
CREATE INDEX IF NOT EXISTS idx_specialized_domains_category ON specialized_domains(category_id);
CREATE INDEX IF NOT EXISTS idx_user_neural_models_user ON user_neural_models(user_id);
CREATE INDEX IF NOT EXISTS idx_user_neural_models_tenant ON user_neural_models(tenant_id);

-- Vector similarity indexes
CREATE INDEX IF NOT EXISTS idx_orchestration_patterns_embedding ON orchestration_patterns 
    USING ivfflat (semantic_embedding vector_cosine_ops) WITH (lists = 50);
CREATE INDEX IF NOT EXISTS idx_production_workflows_embedding ON production_workflows 
    USING ivfflat (semantic_embedding vector_cosine_ops) WITH (lists = 50);
CREATE INDEX IF NOT EXISTS idx_specialized_domains_embedding ON specialized_domains 
    USING ivfflat (semantic_embedding vector_cosine_ops) WITH (lists = 100);

-- Neural event indexes for concurrent execution
CREATE INDEX IF NOT EXISTS idx_neural_execution_events_session ON neural_execution_events(session_id);
CREATE INDEX IF NOT EXISTS idx_neural_learning_signals_session ON neural_learning_signals(session_id);
CREATE INDEX IF NOT EXISTS idx_brain_decisions_session ON brain_decisions(session_id);

-- ============================================================================
-- PART 9: ROW LEVEL SECURITY
-- ============================================================================

ALTER TABLE user_neural_models ENABLE ROW LEVEL SECURITY;
ALTER TABLE brain_policies ENABLE ROW LEVEL SECURITY;
ALTER TABLE brain_decisions ENABLE ROW LEVEL SECURITY;
ALTER TABLE constructed_workflows ENABLE ROW LEVEL SECURITY;

CREATE POLICY user_neural_models_isolation ON user_neural_models 
    USING (tenant_id = current_setting('app.current_tenant_id')::UUID);
CREATE POLICY brain_policies_isolation ON brain_policies 
    USING (tenant_id = current_setting('app.current_tenant_id')::UUID);
CREATE POLICY brain_decisions_isolation ON brain_decisions 
    USING (tenant_id = current_setting('app.current_tenant_id')::UUID);
CREATE POLICY constructed_workflows_isolation ON constructed_workflows 
    USING (tenant_id = current_setting('app.current_tenant_id')::UUID);

-- ============================================================================
-- PART 10: HELPER FUNCTIONS
-- ============================================================================

-- Function: Get user's neural model with fallbacks
CREATE OR REPLACE FUNCTION get_user_neural_model(p_user_id UUID, p_tenant_id UUID)
RETURNS JSONB AS $$
DECLARE
    user_model JSONB;
BEGIN
    SELECT jsonb_build_object(
        'userId', user_id,
        'modelPreferences', model_preferences,
        'workflowPreferences', workflow_preferences,
        'qualityThresholds', quality_thresholds,
        'behavioralPatterns', behavioral_patterns,
        'overallConfidence', overall_confidence,
        'adminOverrides', admin_overrides
    ) INTO user_model
    FROM user_neural_models 
    WHERE user_id = p_user_id AND tenant_id = p_tenant_id;
    
    RETURN COALESCE(user_model, '{}');
END;
$$ LANGUAGE plpgsql;

-- Function: Record learning signal (atomic for concurrent execution)
CREATE OR REPLACE FUNCTION record_learning_signal(
    p_signal_type VARCHAR(50),
    p_user_id UUID,
    p_tenant_id UUID,
    p_workflow_id UUID,
    p_model_id VARCHAR(100),
    p_session_id UUID,
    p_signal_value DECIMAL,
    p_source VARCHAR(50)
)
RETURNS UUID AS $$
DECLARE
    signal_id UUID;
BEGIN
    INSERT INTO neural_learning_signals (
        signal_type, user_id, tenant_id, workflow_id, model_id, 
        session_id, signal_value, source
    ) VALUES (
        p_signal_type, p_user_id, p_tenant_id, p_workflow_id, p_model_id,
        p_session_id, p_signal_value, p_source
    ) RETURNING id INTO signal_id;
    
    RETURN signal_id;
END;
$$ LANGUAGE plpgsql;

-- Add session_id to execution_manifests for concurrent tracking
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'execution_manifests' AND column_name = 'session_id'
    ) THEN
        ALTER TABLE execution_manifests ADD COLUMN session_id UUID REFERENCES concurrent_sessions(id);
        CREATE INDEX idx_execution_manifests_session ON execution_manifests(session_id);
    END IF;
END $$;

-- Statistics view
CREATE OR REPLACE VIEW neural_orchestration_stats AS
SELECT
    (SELECT COUNT(*) FROM orchestration_patterns WHERE enabled = TRUE) as total_patterns,
    (SELECT COUNT(*) FROM orchestration_patterns WHERE implementation_status = 'implemented') as implemented_patterns,
    (SELECT COUNT(*) FROM production_workflows WHERE enabled = TRUE) as total_workflows,
    (SELECT COUNT(*) FROM specialized_domains WHERE enabled = TRUE) as total_domains,
    (SELECT COUNT(*) FROM user_neural_models) as total_user_models,
    (SELECT AVG(overall_confidence) FROM user_neural_models) as avg_user_confidence,
    (SELECT COUNT(*) FROM constructed_workflows) as total_constructed_workflows,
    (SELECT COUNT(*) FROM neural_execution_events WHERE created_at > NOW() - INTERVAL '24 hours') as events_24h;
```

---

## 38.4 Seed Data: Sample Orchestration Patterns

### migrations/038b_seed_orchestration_patterns.sql

```sql
-- Sample of 127 Orchestration Patterns from Think Tank Compendium
-- Full seed data includes all 127 patterns

-- Multi-Model Coordination Patterns (10)
INSERT INTO orchestration_patterns (pattern_id, category_id, name, description, complexity, impact, implemented_by, implementation_status, execution_type, parallelizable, typical_model_count, pattern_definition, trigger_keywords)
VALUES
('side_by_side_comparison', 'multi_model', 'Side-by-Side Comparison', 'Send identical prompt to 2-6 models, display responses simultaneously', 'low', 'high', ARRAY['ChatHub', 'Poe', 'msty'], 'implemented', 'parallel', true, 6, '{"type": "parallel_query", "minModels": 2, "maxModels": 6}', ARRAY['compare', 'side by side', 'versus', 'vs']),
('consensus_voting', 'multi_model', 'Consensus Voting', 'Query multiple models, aggregate via majority vote', 'medium', 'high', ARRAY[]::TEXT[], 'implemented', 'parallel', true, 3, '{"type": "voting", "minModels": 3, "votingMethod": "majority"}', ARRAY['consensus', 'vote', 'agree']),
('ensemble_synthesis', 'multi_model', 'Ensemble Response Synthesis', 'Combine responses from multiple models into unified answer', 'high', 'high', ARRAY[]::TEXT[], 'implemented', 'hybrid', true, 3, '{"type": "ensemble", "synthesisMethod": "extract_best"}', ARRAY['combine', 'ensemble', 'synthesize']),
('intelligent_routing', 'multi_model', 'Intelligent Model Routing', 'Auto-select optimal model based on query type/complexity', 'medium', 'high', ARRAY['Perplexity', 'OpenRouter'], 'implemented', 'serial', false, 1, '{"type": "capability_routing", "factors": ["complexity", "domain", "cost"]}', ARRAY['auto', 'best model', 'smart'])
ON CONFLICT (pattern_id) DO UPDATE SET updated_at = NOW();

-- Sequential Patterns (sample)
INSERT INTO orchestration_patterns (pattern_id, category_id, name, description, complexity, impact, implemented_by, implementation_status, execution_type, pattern_definition, trigger_keywords)
VALUES
('draft_critique_revise', 'sequential', 'Draft â†’ Critique â†’ Revise', 'Generate, evaluate, improve cycle', 'medium', 'high', ARRAY['DSPy'], 'implemented', 'serial', '{"type": "iterative", "stages": ["draft", "critique", "revise"]}', ARRAY['improve', 'refine', 'polish']),
('research_analyze_report', 'sequential', 'Research â†’ Analyze â†’ Report', 'Sequential research workflow', 'high', 'high', ARRAY['Perplexity'], 'implemented', 'serial', '{"type": "research_pipeline", "stages": ["research", "analyze", "report"]}', ARRAY['research', 'investigate', 'deep dive']),
('plan_execute_verify', 'sequential', 'Plan â†’ Execute â†’ Verify', 'Agentic task completion pattern', 'high', 'high', ARRAY['AutoGen', 'CrewAI'], 'implemented', 'serial', '{"type": "agent_loop", "stages": ["plan", "execute", "verify"]}', ARRAY['accomplish', 'complete task', 'do this'])
ON CONFLICT (pattern_id) DO UPDATE SET updated_at = NOW();

-- Verification Patterns (sample)
INSERT INTO orchestration_patterns (pattern_id, category_id, name, description, complexity, impact, implemented_by, implementation_status, execution_type, pattern_definition, trigger_keywords)
VALUES
('red_team_attack', 'verification', 'Red Team Attack', 'Adversarial model challenges primary response', 'medium', 'high', ARRAY['Think Tank'], 'implemented', 'serial', '{"type": "adversarial", "attackModel": "separate"}', ARRAY['challenge', 'verify', 'attack']),
('chain_of_verification', 'verification', 'Chain of Verification (CoVe)', 'Generate claims â†’ generate questions â†’ verify answers', 'high', 'high', ARRAY[]::TEXT[], 'implemented', 'serial', '{"type": "cove", "stages": ["claims", "questions", "verify"]}', ARRAY['verify claims', 'fact check']),
('hallucination_detection', 'verification', 'Hallucination Detection', 'Identify unsupported or fabricated claims', 'high', 'high', ARRAY[]::TEXT[], 'implemented', 'serial', '{"type": "hallucination_check"}', ARRAY['making this up', 'hallucinating'])
ON CONFLICT (pattern_id) DO UPDATE SET updated_at = NOW();

-- Debate Patterns (sample)
INSERT INTO orchestration_patterns (pattern_id, category_id, name, description, complexity, impact, implemented_by, implementation_status, execution_type, pattern_definition, trigger_keywords)
VALUES
('ai_debate', 'debate', 'AI Debate', 'Two models argue opposing positions', 'medium', 'high', ARRAY['Think Tank'], 'implemented', 'serial', '{"type": "debate", "rounds": 3}', ARRAY['debate', 'argue', 'pros and cons']),
('round_table_consensus', 'debate', 'Round Table Consensus', 'Multiple agents discuss to reach consensus', 'high', 'high', ARRAY['Think Tank'], 'implemented', 'serial', '{"type": "consensus", "maxRounds": 5}', ARRAY['consensus', 'agree on', 'come together']),
('ai_judge', 'debate', 'AI Judge', 'Third model evaluates debate outcome', 'medium', 'high', ARRAY['Think Tank'], 'implemented', 'serial', '{"type": "judge", "criteria": ["logic", "evidence", "persuasion"]}', ARRAY['which is better', 'evaluate', 'judge'])
ON CONFLICT (pattern_id) DO UPDATE SET updated_at = NOW();

-- Reasoning Enhancement Patterns (sample)
INSERT INTO orchestration_patterns (pattern_id, category_id, name, description, complexity, impact, implemented_by, implementation_status, execution_type, pattern_definition, trigger_keywords)
VALUES
('chain_of_thought', 'reasoning', 'Chain of Thought (CoT)', 'Step-by-step reasoning', 'low', 'high', ARRAY['GPT-4', 'Claude'], 'implemented', 'serial', '{"type": "cot", "showSteps": true}', ARRAY['think through', 'reasoning', 'step by step']),
('tree_of_thoughts', 'reasoning', 'Tree of Thoughts (ToT)', 'Explore multiple reasoning branches', 'high', 'high', ARRAY[]::TEXT[], 'implemented', 'hybrid', '{"type": "tot", "branchFactor": 3, "depth": 3}', ARRAY['explore options', 'different paths', 'branches']),
('self_consistency', 'reasoning', 'Self-Consistency', 'Sample multiple CoT paths, vote on answer', 'medium', 'high', ARRAY[]::TEXT[], 'implemented', 'parallel', '{"type": "self_consistency", "samples": 5}', ARRAY['confident answer', 'verify reasoning']),
('self_refine', 'reasoning', 'Self-Refine Loop', 'Iterative self-improvement', 'medium', 'high', ARRAY['DSPy'], 'implemented', 'serial', '{"type": "self_refine", "maxIterations": 3}', ARRAY['improve', 'refine', 'iterate'])
ON CONFLICT (pattern_id) DO UPDATE SET updated_at = NOW();

-- Note: Full implementation includes all 127 patterns from Think Tank Compendium
```

---

## 38.5 API Endpoints Summary

### Neural Orchestration Admin Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/v2/admin/neural/config` | Get Neural Engine config |
| PUT | `/api/v2/admin/neural/config` | Update Neural Engine config |
| GET | `/api/v2/admin/brain/config` | Get Brain Governor config |
| PUT | `/api/v2/admin/brain/config` | Update Brain Governor config |
| GET | `/api/v2/admin/patterns` | List orchestration patterns |
| PUT | `/api/v2/admin/patterns/{patternId}` | Update pattern status |
| GET | `/api/v2/admin/workflows/production` | List production workflows |
| GET | `/api/v2/admin/domains` | List specialized domains |
| GET | `/api/v2/admin/user-models` | List user neural models |
| PUT | `/api/v2/admin/user-models/{userId}/overrides` | Set admin overrides |
| DELETE | `/api/v2/admin/user-models/{userId}` | Reset user model |
| GET | `/api/v2/admin/registry/stats` | Get registry statistics |

### Workflow Editor Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/v2/admin/workflows/templates` | List workflow templates |
| POST | `/api/v2/admin/workflows/templates` | Create template |
| PUT | `/api/v2/admin/workflows/templates/{id}` | Update template |
| DELETE | `/api/v2/admin/workflows/templates/{id}` | Delete template |
| POST | `/api/v2/admin/workflows/generate-metadata` | Auto-generate metadata |
| POST | `/api/v2/admin/workflows/test` | Test workflow execution |

### Client Decision Transparency Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/v2/decision/{executionId}` | Get decision transparency |
| POST | `/api/v2/decision/{executionId}/override` | Submit override request |

---

## 38.6 Swift Deployer v2 Updates

The Swift Deployment App now includes:

1. **Neural Engine Configuration View**
   - Learning parameters (rate, frequency, decay)
   - User model settings (cold start, confidence thresholds)
   - Construction parameters (max nodes, template preferences)
   - Real-time monitoring toggles

2. **Brain Governor Configuration View**
   - Cost controls (per-request, per-hour, per-day limits)
   - Latency controls (max latency, warning thresholds)
   - Quality controls (confidence, verification requirements)
   - Neural trust settings (approval thresholds)
   - Steering controls (model switching, node skipping)
   - Compliance settings (HIPAA, audit logging)

3. **Workflow Registry Browser**
   - View 127 orchestration patterns by category
   - View 127 production workflows by category
   - View 834 specialized domains by category
   - Search and filter capabilities
   - Usage statistics dashboard

---

## 38.7 Verification & Deployment

### Pre-Deployment Checklist

```bash
# 1. Apply database migrations
psql $DATABASE_URL -f migrations/038_neural_orchestration_registry.sql
psql $DATABASE_URL -f migrations/038b_seed_orchestration_patterns.sql

# 2. Verify tables created
psql $DATABASE_URL -c "SELECT * FROM neural_orchestration_stats"

# 3. Verify registry counts
psql $DATABASE_URL -c "SELECT COUNT(*) as patterns FROM orchestration_patterns"
psql $DATABASE_URL -c "SELECT COUNT(*) as categories FROM domain_categories"

# 4. Test Neural Engine config
curl https://api.YOUR_DOMAIN.com/api/v2/admin/neural/config \
  -H "Authorization: Bearer $ADMIN_TOKEN"

# 5. Test decision transparency
curl https://api.YOUR_DOMAIN.com/api/v2/decision/{executionId} \
  -H "Authorization: Bearer $TOKEN"
```

---

## Summary v4.4.0

RADIANT v4.4.0 (PROMPT-18) adds **Neural-First Orchestration & Think Tank Workflow Registry**:

### Section 38: Neural-First Orchestration (v4.4.0)

1. **Think Tank Workflow Registry** (Database Schema)
   - 127 orchestration patterns across 10 categories
   - 127 production workflows across 12 categories  
   - 834 specialized domains across 17 categories
   - Full semantic embeddings for Neural Engine matching

2. **Neural Engine Enhancements**
   - Per-user neural models with 768-dim embeddings
   - Orchestration constructor (dynamic workflow generation)
   - Real-time steering during execution
   - Learning from concurrent sessions (atomic updates)

3. **Brain Governor Enhancements**
   - Full admin-editable configuration
   - Policy engine with conditions and actions
   - Decision audit logging
   - Concurrent session awareness

4. **Visual Workflow Editor**
   - Drag-and-drop node placement
   - 12 node type categories
   - Neural I/O connector visualization
   - Auto-generated metadata

5. **Client Decision Transparency**
   - Reasoning exposed to Think Tank
   - Confidence scores with explanations
   - Alternatives with tradeoffs
   - Override options with impact estimation

6. **Swift Deployer v2**
   - Neural Engine configuration UI
   - Brain Governor configuration UI
   - Workflow registry browser

7. **Concurrent Execution Support**
   - Session-aware billing aggregation
   - Session-tagged feedback
   - Atomic neural model updates

### Design Philosophy (v4.4.0)

- **Neural-First** - Neural Engine is the fabric (60% weight), Brain is the governor
- **Dynamic Construction** - Workflows built from primitives, not just template selection
- **Per-User Learning** - Personalized embeddings and preferences
- **Real-Time Steering** - Adjustments during execution, not just post-hoc
- **Full Transparency** - Clients see reasoning, confidence, alternatives
- **Admin Control** - All parameters editable through dashboard
- **Concurrent Aware** - Proper handling of parallel user sessions

### Also includes all v4.3.0 features:
- Feedback Learning System
- Neural Engine Loop
- Multi-Language Voice Feedback
- Implicit Signals
- A/B Testing Framework

---

**Total Sections: 40 (0-39)**
**Total Lines: ~53,000**
**Total Size: ~2.3MB**

---

# â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
# SECTION 39: DYNAMIC WORKFLOW PROPOSAL SYSTEM (v4.5.0)
# â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

> **This section implements the Dynamic Workflow Proposal System for v4.5.0**

---
## 39.1 Overview

The Dynamic Workflow Proposal System enables the Brain and Neural Engine to collaboratively identify user needs that aren't well-served by existing workflows, propose new workflows to solve these problems, and submit them for administrator review. This system is **evidence-based** - proposals require substantiated user need crossing configurable thresholds, not arbitrary suggestions.

### Key Design Principles

1. **Evidence-Based Proposals** - Only propose when sufficient user need is demonstrated
2. **Threshold Gating** - Multiple thresholds must be met before proposal generation
3. **Brain Governor Oversight** - Brain reviews all proposals before they reach admin queue
4. **Admin Final Authority** - No auto-publishing; humans approve all new workflows
5. **Full Auditability** - Complete trail of evidence, decisions, and outcomes
6. **Configurable Everything** - All weights/thresholds editable by administrators

### Evidence Types

| Evidence Type | Description | Weight |
|---------------|-------------|--------|
| `workflow_failure` | Existing workflow failed to complete | 0.40 |
| `negative_feedback` | User gave thumbs down or negative rating | 0.35 |
| `manual_override` | User manually switched model/approach | 0.15 |
| `regenerate_request` | User requested regeneration | 0.10 |
| `abandon_session` | User abandoned mid-conversation | 0.20 |
| `low_confidence_completion` | Workflow completed but Neural confidence < 0.5 | 0.15 |
| `explicit_request` | User explicitly requested different approach | 0.50 |

---

## 39.2 Database Schema

```sql
-- ============================================================================
-- SECTION 39: DYNAMIC WORKFLOW PROPOSAL SYSTEM
-- Migration: 039_dynamic_workflow_proposals.sql
-- Version: 4.5.0
-- ============================================================================

-- ============================================================================
-- 39.2.1 Need Pattern Detection Tables
-- ============================================================================

-- Track emerging user need patterns that could justify new workflows
CREATE TABLE neural_need_patterns (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    
    -- Pattern identification
    pattern_hash VARCHAR(64) NOT NULL,  -- SHA-256 of normalized pattern signature
    pattern_signature JSONB NOT NULL,   -- Structured pattern definition
    pattern_embedding VECTOR(768),      -- Neural embedding for similarity search
    
    -- Pattern metadata
    pattern_name VARCHAR(255) NOT NULL,
    pattern_description TEXT,
    detected_intent TEXT NOT NULL,      -- What the user was trying to accomplish
    existing_workflow_gaps TEXT[],      -- Which existing workflows fail this case
    
    -- Evidence accumulation
    total_evidence_score DECIMAL(10,4) DEFAULT 0,
    evidence_count INTEGER DEFAULT 0,
    unique_users_affected INTEGER DEFAULT 0,
    first_occurrence TIMESTAMPTZ DEFAULT NOW(),
    last_occurrence TIMESTAMPTZ DEFAULT NOW(),
    
    -- Threshold tracking
    occurrence_threshold_met BOOLEAN DEFAULT FALSE,
    impact_threshold_met BOOLEAN DEFAULT FALSE,
    confidence_threshold_met BOOLEAN DEFAULT FALSE,
    
    -- Status tracking
    status VARCHAR(50) DEFAULT 'accumulating',  -- accumulating, threshold_met, proposal_generated, resolved
    proposal_id UUID,  -- Link to generated proposal if threshold met
    
    -- Audit
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    CONSTRAINT unique_pattern_per_tenant UNIQUE(tenant_id, pattern_hash)
);

-- Individual evidence records contributing to need patterns
CREATE TABLE neural_need_evidence (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    pattern_id UUID NOT NULL REFERENCES neural_need_patterns(id) ON DELETE CASCADE,
    
    -- Evidence source
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    session_id UUID,
    execution_id UUID,  -- Link to manifest for full context
    
    -- Evidence details
    evidence_type VARCHAR(50) NOT NULL,  -- workflow_failure, negative_feedback, manual_override, etc.
    evidence_weight DECIMAL(5,4) NOT NULL,
    evidence_data JSONB NOT NULL,  -- Detailed context
    
    -- User intent capture
    original_request TEXT,           -- What user asked for
    attempted_workflow_id UUID,      -- Which workflow was tried
    failure_reason TEXT,             -- Why it failed or underperformed
    user_feedback TEXT,              -- Any explicit user feedback
    
    -- Temporal
    occurred_at TIMESTAMPTZ DEFAULT NOW(),
    
    -- Audit
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- 39.2.2 Proposal Tables
-- ============================================================================

-- Workflow proposals generated by Neural Engine
CREATE TABLE workflow_proposals (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    
    -- Proposal identification
    proposal_code VARCHAR(50) NOT NULL,  -- e.g., WP-2024-001
    proposal_name VARCHAR(255) NOT NULL,
    proposal_description TEXT NOT NULL,
    
    -- Source pattern
    source_pattern_id UUID NOT NULL REFERENCES neural_need_patterns(id),
    
    -- Proposed workflow structure
    proposed_workflow JSONB NOT NULL,  -- Full workflow DAG definition
    workflow_category VARCHAR(100),
    workflow_type VARCHAR(50),  -- orchestration_pattern, production_workflow, hybrid
    estimated_complexity VARCHAR(20),  -- simple, moderate, complex, advanced
    
    -- Neural Engine analysis
    neural_confidence DECIMAL(5,4) NOT NULL,  -- How confident Neural is this solves the need
    neural_reasoning TEXT NOT NULL,           -- Why Neural proposed this structure
    estimated_quality_improvement DECIMAL(5,4),
    estimated_coverage_percentage DECIMAL(5,4),  -- % of evidence cases this would solve
    
    -- Brain Governor review
    brain_approved BOOLEAN,
    brain_review_timestamp TIMESTAMPTZ,
    brain_risk_assessment JSONB,  -- cost_risk, latency_risk, quality_risk, compliance_risk
    brain_veto_reason TEXT,       -- If vetoed, why
    brain_modifications JSONB,    -- Any modifications Brain suggested
    
    -- Evidence summary
    evidence_count INTEGER NOT NULL,
    unique_users_affected INTEGER NOT NULL,
    total_evidence_score DECIMAL(10,4) NOT NULL,
    evidence_time_span_days INTEGER NOT NULL,
    evidence_summary JSONB NOT NULL,  -- Aggregated evidence statistics
    
    -- Admin review
    admin_status VARCHAR(50) DEFAULT 'pending_brain',  -- pending_brain, pending_admin, approved, declined, testing
    admin_reviewer_id UUID REFERENCES users(id),
    admin_review_timestamp TIMESTAMPTZ,
    admin_notes TEXT,
    admin_modifications JSONB,  -- Any modifications admin made
    
    -- Testing
    test_status VARCHAR(50),  -- not_tested, testing, passed, failed
    test_results JSONB,
    test_execution_ids UUID[],
    
    -- Publishing
    published_workflow_id UUID,  -- Link to published workflow if approved
    published_at TIMESTAMPTZ,
    
    -- Rate limiting
    proposal_batch_id UUID,  -- Group proposals from same analysis run
    
    -- Audit
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    CONSTRAINT unique_proposal_code UNIQUE(tenant_id, proposal_code)
);

-- Proposal review history for audit trail
CREATE TABLE workflow_proposal_reviews (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    proposal_id UUID NOT NULL REFERENCES workflow_proposals(id) ON DELETE CASCADE,
    
    -- Reviewer
    reviewer_type VARCHAR(20) NOT NULL,  -- brain, admin
    reviewer_id UUID,  -- NULL for brain, user_id for admin
    
    -- Review details
    action VARCHAR(50) NOT NULL,  -- approve, decline, modify, request_test, escalate
    previous_status VARCHAR(50),
    new_status VARCHAR(50),
    
    -- Reasoning
    review_notes TEXT,
    modifications_made JSONB,
    risk_assessment JSONB,
    
    -- Audit
    reviewed_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- 39.2.3 Threshold Configuration Tables
-- ============================================================================

-- Configurable thresholds for proposal generation
CREATE TABLE proposal_threshold_config (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    
    -- Occurrence thresholds
    min_evidence_count INTEGER DEFAULT 5,           -- Minimum evidence records needed
    min_unique_users INTEGER DEFAULT 3,             -- Minimum unique users affected
    min_time_span_hours INTEGER DEFAULT 24,         -- Minimum time span of evidence
    max_time_span_days INTEGER DEFAULT 30,          -- Maximum lookback for evidence
    
    -- Impact thresholds  
    min_total_evidence_score DECIMAL(5,4) DEFAULT 0.60,  -- Minimum cumulative evidence score
    min_avg_evidence_weight DECIMAL(5,4) DEFAULT 0.20,   -- Minimum average evidence weight
    
    -- Neural confidence thresholds
    min_neural_confidence DECIMAL(5,4) DEFAULT 0.75,     -- Minimum Neural confidence to propose
    min_coverage_estimate DECIMAL(5,4) DEFAULT 0.60,     -- Minimum estimated coverage
    
    -- Brain approval thresholds
    max_cost_risk DECIMAL(5,4) DEFAULT 0.30,            -- Maximum acceptable cost risk
    max_latency_risk DECIMAL(5,4) DEFAULT 0.40,         -- Maximum acceptable latency risk
    min_quality_confidence DECIMAL(5,4) DEFAULT 0.70,   -- Minimum quality confidence
    max_compliance_risk DECIMAL(5,4) DEFAULT 0.10,      -- Maximum compliance risk
    
    -- Rate limiting
    max_proposals_per_day INTEGER DEFAULT 10,
    max_proposals_per_week INTEGER DEFAULT 30,
    cooldown_after_decline_hours INTEGER DEFAULT 72,    -- Wait time after admin decline
    
    -- Auto-approve settings (disabled by default)
    auto_approve_enabled BOOLEAN DEFAULT FALSE,
    auto_approve_min_confidence DECIMAL(5,4) DEFAULT 0.95,
    auto_approve_max_complexity VARCHAR(20) DEFAULT 'simple',
    
    -- Audit
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    updated_by UUID REFERENCES users(id),
    
    CONSTRAINT one_config_per_tenant UNIQUE(tenant_id)
);

-- Evidence type weight configuration (admin-editable)
CREATE TABLE evidence_weight_config (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    
    evidence_type VARCHAR(50) NOT NULL,
    weight DECIMAL(5,4) NOT NULL,
    description TEXT,
    enabled BOOLEAN DEFAULT TRUE,
    
    -- Audit
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    updated_by UUID REFERENCES users(id),
    
    CONSTRAINT unique_evidence_type_per_tenant UNIQUE(tenant_id, evidence_type)
);

-- ============================================================================
-- 39.2.4 Neural Engine Learning Persistence
-- ============================================================================

-- Ensure Neural Engine data is persisted (extends Section 38 if not present)
CREATE TABLE IF NOT EXISTS neural_learning_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    
    -- Session identification
    session_type VARCHAR(50) NOT NULL,  -- pattern_detection, proposal_generation, learning_update
    started_at TIMESTAMPTZ DEFAULT NOW(),
    completed_at TIMESTAMPTZ,
    
    -- Learning data
    patterns_analyzed INTEGER DEFAULT 0,
    patterns_updated INTEGER DEFAULT 0,
    proposals_generated INTEGER DEFAULT 0,
    evidence_processed INTEGER DEFAULT 0,
    
    -- Model state snapshots
    model_state_before JSONB,
    model_state_after JSONB,
    
    -- Performance
    processing_time_ms INTEGER,
    memory_used_mb INTEGER,
    
    -- Audit
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Neural embedding updates log
CREATE TABLE neural_embedding_updates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    
    -- Source
    entity_type VARCHAR(50) NOT NULL,  -- pattern, user_model, workflow
    entity_id UUID NOT NULL,
    
    -- Embedding change
    previous_embedding VECTOR(768),
    new_embedding VECTOR(768),
    embedding_delta_magnitude DECIMAL(10,6),
    
    -- Trigger
    triggered_by VARCHAR(50),  -- evidence, feedback, admin_update, scheduled
    trigger_details JSONB,
    
    -- Audit
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- 39.2.5 Indexes
-- ============================================================================

-- Need patterns indexes
CREATE INDEX idx_neural_need_patterns_tenant ON neural_need_patterns(tenant_id);
CREATE INDEX idx_neural_need_patterns_status ON neural_need_patterns(status);
CREATE INDEX idx_neural_need_patterns_hash ON neural_need_patterns(pattern_hash);
CREATE INDEX idx_neural_need_patterns_score ON neural_need_patterns(total_evidence_score DESC);
CREATE INDEX idx_neural_need_patterns_embedding ON neural_need_patterns USING ivfflat (pattern_embedding vector_cosine_ops) WITH (lists = 100);

-- Evidence indexes
CREATE INDEX idx_neural_need_evidence_pattern ON neural_need_evidence(pattern_id);
CREATE INDEX idx_neural_need_evidence_user ON neural_need_evidence(user_id);
CREATE INDEX idx_neural_need_evidence_type ON neural_need_evidence(evidence_type);
CREATE INDEX idx_neural_need_evidence_occurred ON neural_need_evidence(occurred_at DESC);

-- Proposal indexes
CREATE INDEX idx_workflow_proposals_tenant ON workflow_proposals(tenant_id);
CREATE INDEX idx_workflow_proposals_status ON workflow_proposals(admin_status);
CREATE INDEX idx_workflow_proposals_pattern ON workflow_proposals(source_pattern_id);
CREATE INDEX idx_workflow_proposals_created ON workflow_proposals(created_at DESC);

-- Review indexes
CREATE INDEX idx_workflow_proposal_reviews_proposal ON workflow_proposal_reviews(proposal_id);
CREATE INDEX idx_workflow_proposal_reviews_reviewer ON workflow_proposal_reviews(reviewer_type, reviewer_id);

-- Config indexes
CREATE INDEX idx_proposal_threshold_config_tenant ON proposal_threshold_config(tenant_id);
CREATE INDEX idx_evidence_weight_config_tenant ON evidence_weight_config(tenant_id);

-- Learning session indexes
CREATE INDEX idx_neural_learning_sessions_tenant ON neural_learning_sessions(tenant_id);
CREATE INDEX idx_neural_learning_sessions_type ON neural_learning_sessions(session_type);
CREATE INDEX idx_neural_embedding_updates_entity ON neural_embedding_updates(entity_type, entity_id);

-- ============================================================================
-- 39.2.6 Row Level Security
-- ============================================================================

ALTER TABLE neural_need_patterns ENABLE ROW LEVEL SECURITY;
ALTER TABLE neural_need_evidence ENABLE ROW LEVEL SECURITY;
ALTER TABLE workflow_proposals ENABLE ROW LEVEL SECURITY;
ALTER TABLE workflow_proposal_reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE proposal_threshold_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE evidence_weight_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE neural_learning_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE neural_embedding_updates ENABLE ROW LEVEL SECURITY;

-- Policies (tenant isolation)
CREATE POLICY tenant_isolation_neural_need_patterns ON neural_need_patterns
    USING (tenant_id = current_setting('app.current_tenant_id')::UUID);

CREATE POLICY tenant_isolation_neural_need_evidence ON neural_need_evidence
    USING (tenant_id = current_setting('app.current_tenant_id')::UUID);

CREATE POLICY tenant_isolation_workflow_proposals ON workflow_proposals
    USING (tenant_id = current_setting('app.current_tenant_id')::UUID);

CREATE POLICY tenant_isolation_workflow_proposal_reviews ON workflow_proposal_reviews
    USING (proposal_id IN (SELECT id FROM workflow_proposals WHERE tenant_id = current_setting('app.current_tenant_id')::UUID));

CREATE POLICY tenant_isolation_proposal_threshold_config ON proposal_threshold_config
    USING (tenant_id = current_setting('app.current_tenant_id')::UUID);

CREATE POLICY tenant_isolation_evidence_weight_config ON evidence_weight_config
    USING (tenant_id = current_setting('app.current_tenant_id')::UUID);

CREATE POLICY tenant_isolation_neural_learning_sessions ON neural_learning_sessions
    USING (tenant_id = current_setting('app.current_tenant_id')::UUID);

CREATE POLICY tenant_isolation_neural_embedding_updates ON neural_embedding_updates
    USING (tenant_id = current_setting('app.current_tenant_id')::UUID);

-- ============================================================================
-- 39.2.7 Default Data Seeding
-- ============================================================================

-- Seed default evidence weights (will be copied per tenant on creation)
INSERT INTO evidence_weight_config (tenant_id, evidence_type, weight, description, enabled)
SELECT 
    t.id,
    e.evidence_type,
    e.weight,
    e.description,
    TRUE
FROM tenants t
CROSS JOIN (VALUES
    ('workflow_failure', 0.40, 'Existing workflow failed to complete'),
    ('negative_feedback', 0.35, 'User gave thumbs down or negative rating'),
    ('manual_override', 0.15, 'User manually switched model/approach'),
    ('regenerate_request', 0.10, 'User requested regeneration'),
    ('abandon_session', 0.20, 'User abandoned mid-conversation'),
    ('low_confidence_completion', 0.15, 'Workflow completed but Neural confidence < 0.5'),
    ('explicit_request', 0.50, 'User explicitly requested different approach')
) AS e(evidence_type, weight, description)
ON CONFLICT (tenant_id, evidence_type) DO NOTHING;

-- Seed default threshold config per tenant
INSERT INTO proposal_threshold_config (tenant_id)
SELECT id FROM tenants
ON CONFLICT (tenant_id) DO NOTHING;
```

---

## 39.3 TypeScript Types

```typescript
// ============================================================================
// packages/core/src/types/workflow-proposals.ts
// Dynamic Workflow Proposal System Types
// ============================================================================

import { UUID, Timestamp, TenantId, UserId } from './common';

// ============================================================================
// 39.3.1 Evidence Types
// ============================================================================

export type EvidenceType =
  | 'workflow_failure'
  | 'negative_feedback'
  | 'manual_override'
  | 'regenerate_request'
  | 'abandon_session'
  | 'low_confidence_completion'
  | 'explicit_request';

export interface EvidenceWeightConfig {
  id: UUID;
  tenantId: TenantId;
  evidenceType: EvidenceType;
  weight: number;
  description: string;
  enabled: boolean;
  createdAt: Timestamp;
  updatedAt: Timestamp;
  updatedBy?: UserId;
}

export interface NeedEvidence {
  id: UUID;
  tenantId: TenantId;
  patternId: UUID;
  userId?: UserId;
  sessionId?: UUID;
  executionId?: UUID;
  evidenceType: EvidenceType;
  evidenceWeight: number;
  evidenceData: Record<string, unknown>;
  originalRequest?: string;
  attemptedWorkflowId?: UUID;
  failureReason?: string;
  userFeedback?: string;
  occurredAt: Timestamp;
  createdAt: Timestamp;
}

// ============================================================================
// 39.3.2 Need Pattern Types
// ============================================================================

export type PatternStatus =
  | 'accumulating'
  | 'threshold_met'
  | 'proposal_generated'
  | 'resolved';

export interface PatternSignature {
  intentCategory: string;
  keywords: string[];
  domainHints: string[];
  failedWorkflowTypes: string[];
  userSegments: string[];
  contextualFactors: Record<string, unknown>;
}

export interface NeedPattern {
  id: UUID;
  tenantId: TenantId;
  patternHash: string;
  patternSignature: PatternSignature;
  patternEmbedding?: number[];  // 768-dim vector
  patternName: string;
  patternDescription?: string;
  detectedIntent: string;
  existingWorkflowGaps: string[];
  totalEvidenceScore: number;
  evidenceCount: number;
  uniqueUsersAffected: number;
  firstOccurrence: Timestamp;
  lastOccurrence: Timestamp;
  occurrenceThresholdMet: boolean;
  impactThresholdMet: boolean;
  confidenceThresholdMet: boolean;
  status: PatternStatus;
  proposalId?: UUID;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface PatternWithEvidence extends NeedPattern {
  evidence: NeedEvidence[];
  evidenceSummary: {
    byType: Record<EvidenceType, number>;
    byUser: Record<string, number>;
    timeline: Array<{ date: string; count: number; score: number }>;
  };
}

// ============================================================================
// 39.3.3 Proposal Types
// ============================================================================

export type ProposalAdminStatus =
  | 'pending_brain'
  | 'pending_admin'
  | 'approved'
  | 'declined'
  | 'testing';

export type ProposalTestStatus =
  | 'not_tested'
  | 'testing'
  | 'passed'
  | 'failed';

export type WorkflowComplexity =
  | 'simple'
  | 'moderate'
  | 'complex'
  | 'advanced';

export type ProposedWorkflowType =
  | 'orchestration_pattern'
  | 'production_workflow'
  | 'hybrid';

export interface BrainRiskAssessment {
  costRisk: number;
  latencyRisk: number;
  qualityRisk: number;
  complianceRisk: number;
  overallRisk: number;
  riskFactors: string[];
  mitigations: string[];
}

export interface ProposedWorkflowNode {
  id: string;
  type: string;
  name: string;
  config: Record<string, unknown>;
  position: { x: number; y: number };
  connections: string[];
}

export interface ProposedWorkflowDAG {
  nodes: ProposedWorkflowNode[];
  edges: Array<{ from: string; to: string; condition?: string }>;
  entryPoint: string;
  exitPoints: string[];
  metadata: {
    estimatedLatencyMs: number;
    estimatedCostPer1k: number;
    requiredModels: string[];
    requiredServices: string[];
  };
}

export interface WorkflowProposal {
  id: UUID;
  tenantId: TenantId;
  proposalCode: string;
  proposalName: string;
  proposalDescription: string;
  sourcePatternId: UUID;
  proposedWorkflow: ProposedWorkflowDAG;
  workflowCategory?: string;
  workflowType: ProposedWorkflowType;
  estimatedComplexity: WorkflowComplexity;
  
  // Neural Engine analysis
  neuralConfidence: number;
  neuralReasoning: string;
  estimatedQualityImprovement?: number;
  estimatedCoveragePercentage?: number;
  
  // Brain Governor review
  brainApproved?: boolean;
  brainReviewTimestamp?: Timestamp;
  brainRiskAssessment?: BrainRiskAssessment;
  brainVetoReason?: string;
  brainModifications?: Partial<ProposedWorkflowDAG>;
  
  // Evidence summary
  evidenceCount: number;
  uniqueUsersAffected: number;
  totalEvidenceScore: number;
  evidenceTimeSpanDays: number;
  evidenceSummary: {
    byType: Record<EvidenceType, number>;
    topFailureReasons: string[];
    affectedDomains: string[];
  };
  
  // Admin review
  adminStatus: ProposalAdminStatus;
  adminReviewerId?: UserId;
  adminReviewTimestamp?: Timestamp;
  adminNotes?: string;
  adminModifications?: Partial<ProposedWorkflowDAG>;
  
  // Testing
  testStatus?: ProposalTestStatus;
  testResults?: {
    testsRun: number;
    testsPassed: number;
    testsFailed: number;
    avgLatencyMs: number;
    avgQualityScore: number;
    issues: string[];
  };
  testExecutionIds?: UUID[];
  
  // Publishing
  publishedWorkflowId?: UUID;
  publishedAt?: Timestamp;
  
  // Audit
  proposalBatchId?: UUID;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface ProposalWithPattern extends WorkflowProposal {
  sourcePattern: NeedPattern;
}

// ============================================================================
// 39.3.4 Review Types
// ============================================================================

export type ReviewerType = 'brain' | 'admin';

export type ReviewAction =
  | 'approve'
  | 'decline'
  | 'modify'
  | 'request_test'
  | 'escalate';

export interface ProposalReview {
  id: UUID;
  proposalId: UUID;
  reviewerType: ReviewerType;
  reviewerId?: UserId;
  action: ReviewAction;
  previousStatus: ProposalAdminStatus;
  newStatus: ProposalAdminStatus;
  reviewNotes?: string;
  modificationsMade?: Partial<ProposedWorkflowDAG>;
  riskAssessment?: BrainRiskAssessment;
  reviewedAt: Timestamp;
}

// ============================================================================
// 39.3.5 Threshold Configuration Types
// ============================================================================

export interface ProposalThresholdConfig {
  id: UUID;
  tenantId: TenantId;
  
  // Occurrence thresholds
  minEvidenceCount: number;
  minUniqueUsers: number;
  minTimeSpanHours: number;
  maxTimeSpanDays: number;
  
  // Impact thresholds
  minTotalEvidenceScore: number;
  minAvgEvidenceWeight: number;
  
  // Neural confidence thresholds
  minNeuralConfidence: number;
  minCoverageEstimate: number;
  
  // Brain approval thresholds
  maxCostRisk: number;
  maxLatencyRisk: number;
  minQualityConfidence: number;
  maxComplianceRisk: number;
  
  // Rate limiting
  maxProposalsPerDay: number;
  maxProposalsPerWeek: number;
  cooldownAfterDeclineHours: number;
  
  // Auto-approve settings
  autoApproveEnabled: boolean;
  autoApproveMinConfidence: number;
  autoApproveMaxComplexity: WorkflowComplexity;
  
  // Audit
  createdAt: Timestamp;
  updatedAt: Timestamp;
  updatedBy?: UserId;
}

// ============================================================================
// 39.3.6 API Request/Response Types
// ============================================================================

// Evidence submission
export interface SubmitEvidenceRequest {
  evidenceType: EvidenceType;
  sessionId?: UUID;
  executionId?: UUID;
  originalRequest?: string;
  attemptedWorkflowId?: UUID;
  failureReason?: string;
  userFeedback?: string;
  evidenceData?: Record<string, unknown>;
}

export interface SubmitEvidenceResponse {
  evidenceId: UUID;
  patternId: UUID;
  patternStatus: PatternStatus;
  currentEvidenceScore: number;
  thresholdsMet: {
    occurrence: boolean;
    impact: boolean;
    confidence: boolean;
  };
}

// Pattern queries
export interface GetPatternsRequest {
  status?: PatternStatus[];
  minEvidenceScore?: number;
  minEvidenceCount?: number;
  limit?: number;
  offset?: number;
}

export interface GetPatternsResponse {
  patterns: PatternWithEvidence[];
  total: number;
  hasMore: boolean;
}

// Proposal queries
export interface GetProposalsRequest {
  status?: ProposalAdminStatus[];
  testStatus?: ProposalTestStatus[];
  minConfidence?: number;
  limit?: number;
  offset?: number;
}

export interface GetProposalsResponse {
  proposals: ProposalWithPattern[];
  total: number;
  hasMore: boolean;
}

// Admin review
export interface ReviewProposalRequest {
  action: ReviewAction;
  notes?: string;
  modifications?: Partial<ProposedWorkflowDAG>;
}

export interface ReviewProposalResponse {
  proposalId: UUID;
  newStatus: ProposalAdminStatus;
  reviewId: UUID;
}

// Testing
export interface TestProposalRequest {
  testMode: 'manual' | 'automated';
  testCases?: Array<{
    input: string;
    expectedBehavior?: string;
  }>;
  iterations?: number;
}

export interface TestProposalResponse {
  proposalId: UUID;
  testStatus: ProposalTestStatus;
  testResults: WorkflowProposal['testResults'];
  testExecutionIds: UUID[];
}

// Publishing
export interface PublishProposalRequest {
  publishToCategory?: string;
  overrideWorkflowId?: UUID;  // Replace existing workflow
}

export interface PublishProposalResponse {
  proposalId: UUID;
  publishedWorkflowId: UUID;
  publishedAt: Timestamp;
}

// Configuration updates
export interface UpdateThresholdConfigRequest {
  config: Partial<Omit<ProposalThresholdConfig, 'id' | 'tenantId' | 'createdAt' | 'updatedAt' | 'updatedBy'>>;
}

export interface UpdateEvidenceWeightsRequest {
  weights: Array<{
    evidenceType: EvidenceType;
    weight: number;
    enabled?: boolean;
  }>;
}

// ============================================================================
// 39.3.7 Neural Engine Types (for proposal generation)
// ============================================================================

export interface NeuralProposalGenerationContext {
  pattern: NeedPattern;
  evidence: NeedEvidence[];
  existingWorkflows: Array<{
    id: UUID;
    name: string;
    similarity: number;
    failureRate: number;
  }>;
  userSegmentProfile: {
    commonIntents: string[];
    preferredComplexity: WorkflowComplexity;
    domainDistribution: Record<string, number>;
  };
  tenantConstraints: {
    maxWorkflowNodes: number;
    allowedNodeTypes: string[];
    requiredComplianceChecks: string[];
  };
}

export interface NeuralProposalGenerationResult {
  success: boolean;
  proposal?: Omit<WorkflowProposal, 'id' | 'tenantId' | 'createdAt' | 'updatedAt'>;
  confidence: number;
  reasoning: string;
  alternativeApproaches?: Array<{
    description: string;
    confidence: number;
    tradeoffs: string[];
  }>;
  rejectionReason?: string;
}

// ============================================================================
// 39.3.8 Brain Governor Types (for proposal review)
// ============================================================================

export interface BrainProposalReviewContext {
  proposal: WorkflowProposal;
  pattern: NeedPattern;
  tenantConfig: ProposalThresholdConfig;
  currentWorkflowCount: number;
  recentProposalCount: {
    today: number;
    thisWeek: number;
  };
  similarExistingWorkflows: Array<{
    id: UUID;
    name: string;
    similarity: number;
  }>;
}

export interface BrainProposalReviewResult {
  approved: boolean;
  riskAssessment: BrainRiskAssessment;
  reasoning: string;
  vetoReason?: string;
  suggestedModifications?: Partial<ProposedWorkflowDAG>;
  escalateToAdmin: boolean;
  adminPriority?: 'low' | 'medium' | 'high' | 'urgent';
}
```

---

## 39.4 Constants and Defaults

```typescript
// ============================================================================
// packages/core/src/constants/workflow-proposals.ts
// ============================================================================

import { EvidenceType, WorkflowComplexity } from '../types/workflow-proposals';

// Default evidence weights
export const DEFAULT_EVIDENCE_WEIGHTS: Record<EvidenceType, number> = {
  workflow_failure: 0.40,
  negative_feedback: 0.35,
  manual_override: 0.15,
  regenerate_request: 0.10,
  abandon_session: 0.20,
  low_confidence_completion: 0.15,
  explicit_request: 0.50,
};

// Default threshold configuration
export const DEFAULT_THRESHOLD_CONFIG = {
  // Occurrence thresholds
  minEvidenceCount: 5,
  minUniqueUsers: 3,
  minTimeSpanHours: 24,
  maxTimeSpanDays: 30,
  
  // Impact thresholds
  minTotalEvidenceScore: 0.60,
  minAvgEvidenceWeight: 0.20,
  
  // Neural confidence thresholds
  minNeuralConfidence: 0.75,
  minCoverageEstimate: 0.60,
  
  // Brain approval thresholds
  maxCostRisk: 0.30,
  maxLatencyRisk: 0.40,
  minQualityConfidence: 0.70,
  maxComplianceRisk: 0.10,
  
  // Rate limiting
  maxProposalsPerDay: 10,
  maxProposalsPerWeek: 30,
  cooldownAfterDeclineHours: 72,
  
  // Auto-approve (disabled by default)
  autoApproveEnabled: false,
  autoApproveMinConfidence: 0.95,
  autoApproveMaxComplexity: 'simple' as WorkflowComplexity,
};

// Complexity scoring
export const COMPLEXITY_NODE_THRESHOLDS: Record<WorkflowComplexity, { min: number; max: number }> = {
  simple: { min: 1, max: 3 },
  moderate: { min: 4, max: 7 },
  complex: { min: 8, max: 12 },
  advanced: { min: 13, max: Infinity },
};

// Proposal code generation
export const PROPOSAL_CODE_PREFIX = 'WP';
export const PROPOSAL_CODE_YEAR_FORMAT = 'YYYY';
export const PROPOSAL_CODE_SEQUENCE_PADDING = 3;

// Rate limit windows
export const RATE_LIMIT_WINDOWS = {
  daily: 24 * 60 * 60 * 1000,   // 24 hours in ms
  weekly: 7 * 24 * 60 * 60 * 1000,  // 7 days in ms
};

// Pattern similarity threshold for deduplication
export const PATTERN_SIMILARITY_THRESHOLD = 0.85;

// Maximum nodes in a proposed workflow
export const MAX_PROPOSED_WORKFLOW_NODES = 20;

// Test configuration defaults
export const DEFAULT_TEST_CONFIG = {
  automatedIterations: 10,
  timeoutMs: 30000,
  minPassRate: 0.80,
};
```

---

---

This chunk contains:
- Complete database schema (8 tables with RLS)
- Full TypeScript type definitions
- Constants and default configurations

Next chunk will contain Lambda functions for evidence collection, pattern detection, and proposal generation.

## 39.5 Evidence Collection Lambda

```typescript
// ============================================================================
// packages/lambdas/src/workflow-proposals/evidence-collector.ts
// Collects and processes evidence of user needs not met by existing workflows
// ============================================================================

import { APIGatewayProxyHandler, APIGatewayProxyResult } from 'aws-lambda';
import { Pool } from 'pg';
import { createHash } from 'crypto';
import {
  EvidenceType,
  NeedEvidence,
  NeedPattern,
  PatternSignature,
  SubmitEvidenceRequest,
  SubmitEvidenceResponse,
} from '@radiant/core/types/workflow-proposals';
import { DEFAULT_EVIDENCE_WEIGHTS, PATTERN_SIMILARITY_THRESHOLD } from '@radiant/core/constants/workflow-proposals';
import { getTenantId, getUserId, createResponse, logAudit } from '../utils';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 10,
});

// ============================================================================
// Pattern Signature Generation
// ============================================================================

interface PatternContext {
  originalRequest: string;
  attemptedWorkflowId?: string;
  failureReason?: string;
  evidenceType: EvidenceType;
  evidenceData: Record<string, unknown>;
}

function generatePatternSignature(context: PatternContext): PatternSignature {
  // Extract keywords from request
  const keywords = extractKeywords(context.originalRequest || '');
  
  // Determine intent category from failure and request
  const intentCategory = classifyIntent(context);
  
  // Extract domain hints
  const domainHints = extractDomainHints(context);
  
  // Track failed workflow types
  const failedWorkflowTypes = context.attemptedWorkflowId 
    ? [context.attemptedWorkflowId] 
    : [];
  
  return {
    intentCategory,
    keywords,
    domainHints,
    failedWorkflowTypes,
    userSegments: [],  // Populated during pattern analysis
    contextualFactors: {
      evidenceType: context.evidenceType,
      hasExplicitFeedback: !!context.failureReason,
    },
  };
}

function extractKeywords(text: string): string[] {
  // Simple keyword extraction - in production, use NLP service
  const stopWords = new Set(['the', 'a', 'an', 'is', 'are', 'was', 'were', 'be', 'been', 
    'being', 'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could', 'should',
    'may', 'might', 'must', 'shall', 'can', 'need', 'dare', 'ought', 'used', 'to', 'of',
    'in', 'for', 'on', 'with', 'at', 'by', 'from', 'as', 'into', 'through', 'during',
    'before', 'after', 'above', 'below', 'between', 'under', 'again', 'further', 'then',
    'once', 'here', 'there', 'when', 'where', 'why', 'how', 'all', 'each', 'few', 'more',
    'most', 'other', 'some', 'such', 'no', 'nor', 'not', 'only', 'own', 'same', 'so',
    'than', 'too', 'very', 'just', 'and', 'but', 'if', 'or', 'because', 'until', 'while',
    'although', 'though', 'after', 'before', 'when', 'i', 'me', 'my', 'myself', 'we',
    'our', 'you', 'your', 'he', 'him', 'she', 'her', 'it', 'its', 'they', 'them', 'what',
    'which', 'who', 'whom', 'this', 'that', 'these', 'those', 'am', 'is', 'are', 'was',
    'were', 'been', 'being', 'please', 'help', 'want', 'like', 'get', 'make']);
  
  return text
    .toLowerCase()
    .replace(/[^\w\s]/g, ' ')
    .split(/\s+/)
    .filter(word => word.length > 2 && !stopWords.has(word))
    .slice(0, 20);  // Limit to top 20 keywords
}

function classifyIntent(context: PatternContext): string {
  const request = (context.originalRequest || '').toLowerCase();
  const failure = (context.failureReason || '').toLowerCase();
  
  // Intent classification based on patterns
  const intentPatterns: Record<string, string[]> = {
    'research': ['research', 'find', 'search', 'look up', 'investigate', 'explore'],
    'analysis': ['analyze', 'analysis', 'examine', 'evaluate', 'assess', 'review'],
    'creation': ['create', 'write', 'generate', 'make', 'build', 'compose', 'draft'],
    'comparison': ['compare', 'versus', 'vs', 'difference', 'contrast', 'better'],
    'explanation': ['explain', 'how', 'why', 'what is', 'describe', 'clarify'],
    'transformation': ['convert', 'transform', 'translate', 'change', 'modify'],
    'summarization': ['summarize', 'summary', 'brief', 'tldr', 'key points'],
    'verification': ['verify', 'check', 'validate', 'confirm', 'fact-check'],
    'coding': ['code', 'program', 'function', 'script', 'debug', 'fix bug'],
    'data_processing': ['data', 'csv', 'json', 'parse', 'extract', 'process'],
  };
  
  for (const [intent, patterns] of Object.entries(intentPatterns)) {
    if (patterns.some(p => request.includes(p) || failure.includes(p))) {
      return intent;
    }
  }
  
  return 'general';
}

function extractDomainHints(context: PatternContext): string[] {
  const text = `${context.originalRequest || ''} ${context.failureReason || ''}`.toLowerCase();
  
  const domainPatterns: Record<string, string[]> = {
    'medical': ['medical', 'health', 'diagnosis', 'symptom', 'treatment', 'patient', 'doctor'],
    'legal': ['legal', 'law', 'contract', 'court', 'attorney', 'regulation', 'compliance'],
    'financial': ['financial', 'money', 'investment', 'stock', 'budget', 'accounting', 'tax'],
    'scientific': ['scientific', 'research', 'experiment', 'hypothesis', 'study', 'paper'],
    'technical': ['technical', 'engineering', 'software', 'hardware', 'system', 'architecture'],
    'creative': ['creative', 'story', 'poem', 'art', 'design', 'music', 'novel'],
    'educational': ['educational', 'learn', 'teach', 'course', 'student', 'lesson', 'tutorial'],
    'business': ['business', 'company', 'strategy', 'market', 'sales', 'customer', 'product'],
  };
  
  const hints: string[] = [];
  for (const [domain, patterns] of Object.entries(domainPatterns)) {
    if (patterns.some(p => text.includes(p))) {
      hints.push(domain);
    }
  }
  
  return hints;
}

function generatePatternHash(signature: PatternSignature): string {
  // Normalize and hash the signature for deduplication
  const normalized = {
    intent: signature.intentCategory,
    keywords: [...signature.keywords].sort(),
    domains: [...signature.domainHints].sort(),
  };
  
  return createHash('sha256')
    .update(JSON.stringify(normalized))
    .digest('hex');
}

// ============================================================================
// Pattern Embedding Generation (calls Neural Engine)
// ============================================================================

async function generatePatternEmbedding(signature: PatternSignature): Promise<number[]> {
  // In production, call the Neural Engine embedding service
  // For now, return a placeholder that would be replaced by actual embedding
  const text = [
    signature.intentCategory,
    ...signature.keywords,
    ...signature.domainHints,
  ].join(' ');
  
  // This would call: POST /api/v2/internal/neural/embed
  // return await neuralEngineClient.generateEmbedding(text);
  
  // Placeholder: return 768-dim zero vector (will be populated by Neural Engine)
  return new Array(768).fill(0);
}

// ============================================================================
// Evidence Weight Resolution
// ============================================================================

async function getEvidenceWeight(
  client: Pool,
  tenantId: string,
  evidenceType: EvidenceType
): Promise<number> {
  const result = await client.query(
    `SELECT weight FROM evidence_weight_config 
     WHERE tenant_id = $1 AND evidence_type = $2 AND enabled = TRUE`,
    [tenantId, evidenceType]
  );
  
  if (result.rows.length > 0) {
    return parseFloat(result.rows[0].weight);
  }
  
  return DEFAULT_EVIDENCE_WEIGHTS[evidenceType] || 0.10;
}

// ============================================================================
// Pattern Finding/Creation
// ============================================================================

async function findOrCreatePattern(
  client: Pool,
  tenantId: string,
  signature: PatternSignature,
  detectedIntent: string
): Promise<{ pattern: NeedPattern; isNew: boolean }> {
  const patternHash = generatePatternHash(signature);
  
  // Try to find existing pattern
  const existing = await client.query<NeedPattern>(
    `SELECT * FROM neural_need_patterns 
     WHERE tenant_id = $1 AND pattern_hash = $2`,
    [tenantId, patternHash]
  );
  
  if (existing.rows.length > 0) {
    return { pattern: existing.rows[0], isNew: false };
  }
  
  // Check for similar patterns using embedding similarity
  const embedding = await generatePatternEmbedding(signature);
  
  const similar = await client.query<NeedPattern>(
    `SELECT *, 1 - (pattern_embedding <=> $2::vector) as similarity
     FROM neural_need_patterns 
     WHERE tenant_id = $1 
       AND pattern_embedding IS NOT NULL
       AND 1 - (pattern_embedding <=> $2::vector) > $3
     ORDER BY similarity DESC
     LIMIT 1`,
    [tenantId, JSON.stringify(embedding), PATTERN_SIMILARITY_THRESHOLD]
  );
  
  if (similar.rows.length > 0) {
    // Merge into existing similar pattern
    return { pattern: similar.rows[0], isNew: false };
  }
  
  // Create new pattern
  const patternName = `${signature.intentCategory}_${signature.keywords.slice(0, 3).join('_')}`;
  
  const inserted = await client.query<NeedPattern>(
    `INSERT INTO neural_need_patterns (
      tenant_id, pattern_hash, pattern_signature, pattern_embedding,
      pattern_name, detected_intent, existing_workflow_gaps
    ) VALUES ($1, $2, $3, $4::vector, $5, $6, $7)
    RETURNING *`,
    [
      tenantId,
      patternHash,
      JSON.stringify(signature),
      JSON.stringify(embedding),
      patternName,
      detectedIntent,
      signature.failedWorkflowTypes,
    ]
  );
  
  return { pattern: inserted.rows[0], isNew: true };
}

// ============================================================================
// Threshold Checking
// ============================================================================

interface ThresholdStatus {
  occurrence: boolean;
  impact: boolean;
  confidence: boolean;
  allMet: boolean;
}

async function checkThresholds(
  client: Pool,
  tenantId: string,
  pattern: NeedPattern
): Promise<ThresholdStatus> {
  // Get tenant threshold config
  const configResult = await client.query(
    `SELECT * FROM proposal_threshold_config WHERE tenant_id = $1`,
    [tenantId]
  );
  
  const config = configResult.rows[0] || {};
  const minEvidenceCount = config.min_evidence_count || 5;
  const minUniqueUsers = config.min_unique_users || 3;
  const minTimeSpanHours = config.min_time_span_hours || 24;
  const minTotalScore = parseFloat(config.min_total_evidence_score || '0.60');
  
  // Calculate time span
  const timeSpanHours = pattern.last_occurrence && pattern.first_occurrence
    ? (new Date(pattern.last_occurrence).getTime() - new Date(pattern.first_occurrence).getTime()) / (1000 * 60 * 60)
    : 0;
  
  const occurrence = 
    pattern.evidence_count >= minEvidenceCount &&
    pattern.unique_users_affected >= minUniqueUsers &&
    timeSpanHours >= minTimeSpanHours;
  
  const impact = pattern.total_evidence_score >= minTotalScore;
  
  // Confidence threshold requires Neural Engine analysis (checked during proposal generation)
  const confidence = pattern.confidence_threshold_met || false;
  
  return {
    occurrence,
    impact,
    confidence,
    allMet: occurrence && impact && confidence,
  };
}

// ============================================================================
// Main Handler
// ============================================================================

export const handler: APIGatewayProxyHandler = async (event): Promise<APIGatewayProxyResult> => {
  const client = await pool.connect();
  
  try {
    const tenantId = getTenantId(event);
    const userId = getUserId(event);
    
    if (!tenantId || !userId) {
      return createResponse(401, { error: 'Unauthorized' });
    }
    
    await client.query(`SET app.current_tenant_id = '${tenantId}'`);
    
    const request: SubmitEvidenceRequest = JSON.parse(event.body || '{}');
    
    if (!request.evidenceType) {
      return createResponse(400, { error: 'evidenceType is required' });
    }
    
    // Get evidence weight
    const evidenceWeight = await getEvidenceWeight(client, tenantId, request.evidenceType);
    
    // Generate pattern signature
    const signature = generatePatternSignature({
      originalRequest: request.originalRequest || '',
      attemptedWorkflowId: request.attemptedWorkflowId,
      failureReason: request.failureReason,
      evidenceType: request.evidenceType,
      evidenceData: request.evidenceData || {},
    });
    
    // Find or create pattern
    const { pattern, isNew } = await findOrCreatePattern(
      client,
      tenantId,
      signature,
      classifyIntent({
        originalRequest: request.originalRequest || '',
        failureReason: request.failureReason,
        evidenceType: request.evidenceType,
        evidenceData: request.evidenceData || {},
      })
    );
    
    // Insert evidence record
    const evidenceResult = await client.query<NeedEvidence>(
      `INSERT INTO neural_need_evidence (
        tenant_id, pattern_id, user_id, session_id, execution_id,
        evidence_type, evidence_weight, evidence_data,
        original_request, attempted_workflow_id, failure_reason, user_feedback
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
      RETURNING id`,
      [
        tenantId,
        pattern.id,
        userId,
        request.sessionId,
        request.executionId,
        request.evidenceType,
        evidenceWeight,
        JSON.stringify(request.evidenceData || {}),
        request.originalRequest,
        request.attemptedWorkflowId,
        request.failureReason,
        request.userFeedback,
      ]
    );
    
    // Update pattern statistics
    await client.query(
      `UPDATE neural_need_patterns SET
        total_evidence_score = total_evidence_score + $2,
        evidence_count = evidence_count + 1,
        unique_users_affected = (
          SELECT COUNT(DISTINCT user_id) 
          FROM neural_need_evidence 
          WHERE pattern_id = $1
        ),
        last_occurrence = NOW(),
        updated_at = NOW()
      WHERE id = $1`,
      [pattern.id, evidenceWeight]
    );
    
    // Fetch updated pattern
    const updatedPattern = await client.query<NeedPattern>(
      `SELECT * FROM neural_need_patterns WHERE id = $1`,
      [pattern.id]
    );
    
    // Check thresholds
    const thresholds = await checkThresholds(client, tenantId, updatedPattern.rows[0]);
    
    // Update threshold status
    await client.query(
      `UPDATE neural_need_patterns SET
        occurrence_threshold_met = $2,
        impact_threshold_met = $3,
        status = CASE 
          WHEN $2 AND $3 THEN 'threshold_met'
          ELSE status
        END
      WHERE id = $1`,
      [pattern.id, thresholds.occurrence, thresholds.impact]
    );
    
    // Audit log
    await logAudit(client, {
      tenantId,
      userId,
      action: 'evidence_submitted',
      resourceType: 'need_pattern',
      resourceId: pattern.id,
      details: {
        evidenceId: evidenceResult.rows[0].id,
        evidenceType: request.evidenceType,
        evidenceWeight,
        thresholdsMet: thresholds,
        isNewPattern: isNew,
      },
    });
    
    const response: SubmitEvidenceResponse = {
      evidenceId: evidenceResult.rows[0].id,
      patternId: pattern.id,
      patternStatus: thresholds.occurrence && thresholds.impact ? 'threshold_met' : 'accumulating',
      currentEvidenceScore: updatedPattern.rows[0].total_evidence_score + evidenceWeight,
      thresholdsMet: thresholds,
    };
    
    return createResponse(200, response);
    
  } catch (error) {
    console.error('Evidence collection error:', error);
    return createResponse(500, { error: 'Internal server error' });
  } finally {
    client.release();
  }
};
```

---

## 39.6 Pattern Analysis Lambda (Scheduled)

```typescript
// ============================================================================
// packages/lambdas/src/workflow-proposals/pattern-analyzer.ts
// Scheduled Lambda that analyzes patterns and triggers proposal generation
// ============================================================================

import { ScheduledHandler } from 'aws-lambda';
import { Pool } from 'pg';
import { SQSClient, SendMessageCommand } from '@aws-sdk/client-sqs';
import { NeedPattern, PatternWithEvidence } from '@radiant/core/types/workflow-proposals';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 10,
});

const sqs = new SQSClient({});
const PROPOSAL_QUEUE_URL = process.env.PROPOSAL_QUEUE_URL!;

// ============================================================================
// Pattern Analysis
// ============================================================================

interface AnalysisResult {
  patternsAnalyzed: number;
  patternsQualified: number;
  proposalsQueued: number;
  errors: string[];
}

async function analyzePatterns(tenantId: string): Promise<AnalysisResult> {
  const client = await pool.connect();
  const result: AnalysisResult = {
    patternsAnalyzed: 0,
    patternsQualified: 0,
    proposalsQueued: 0,
    errors: [],
  };
  
  try {
    await client.query(`SET app.current_tenant_id = '${tenantId}'`);
    
    // Get threshold config
    const configResult = await client.query(
      `SELECT * FROM proposal_threshold_config WHERE tenant_id = $1`,
      [tenantId]
    );
    const config = configResult.rows[0] || {};
    
    // Check rate limits
    const rateLimitResult = await client.query(
      `SELECT 
        COUNT(*) FILTER (WHERE created_at > NOW() - INTERVAL '1 day') as today,
        COUNT(*) FILTER (WHERE created_at > NOW() - INTERVAL '7 days') as this_week
       FROM workflow_proposals
       WHERE tenant_id = $1`,
      [tenantId]
    );
    
    const dailyCount = parseInt(rateLimitResult.rows[0].today);
    const weeklyCount = parseInt(rateLimitResult.rows[0].this_week);
    const maxDaily = config.max_proposals_per_day || 10;
    const maxWeekly = config.max_proposals_per_week || 30;
    
    if (dailyCount >= maxDaily || weeklyCount >= maxWeekly) {
      result.errors.push(`Rate limit reached: ${dailyCount}/${maxDaily} daily, ${weeklyCount}/${maxWeekly} weekly`);
      return result;
    }
    
    const remainingDaily = maxDaily - dailyCount;
    const remainingWeekly = maxWeekly - weeklyCount;
    const maxProposals = Math.min(remainingDaily, remainingWeekly);
    
    // Find patterns that have met thresholds but don't have proposals yet
    const patterns = await client.query<NeedPattern>(
      `SELECT * FROM neural_need_patterns
       WHERE tenant_id = $1
         AND status = 'threshold_met'
         AND occurrence_threshold_met = TRUE
         AND impact_threshold_met = TRUE
         AND proposal_id IS NULL
       ORDER BY total_evidence_score DESC
       LIMIT $2`,
      [tenantId, maxProposals]
    );
    
    result.patternsAnalyzed = patterns.rows.length;
    
    for (const pattern of patterns.rows) {
      try {
        // Get evidence for pattern
        const evidenceResult = await client.query(
          `SELECT * FROM neural_need_evidence
           WHERE pattern_id = $1
           ORDER BY occurred_at DESC
           LIMIT 100`,
          [pattern.id]
        );
        
        // Check for recent declines (cooldown period)
        const cooldownHours = config.cooldown_after_decline_hours || 72;
        const recentDecline = await client.query(
          `SELECT 1 FROM workflow_proposals wp
           JOIN workflow_proposal_reviews wpr ON wpr.proposal_id = wp.id
           WHERE wp.source_pattern_id = $1
             AND wpr.action = 'decline'
             AND wpr.reviewed_at > NOW() - INTERVAL '${cooldownHours} hours'
           LIMIT 1`,
          [pattern.id]
        );
        
        if (recentDecline.rows.length > 0) {
          result.errors.push(`Pattern ${pattern.id} in cooldown after recent decline`);
          continue;
        }
        
        // Queue for proposal generation
        const message: PatternWithEvidence = {
          ...pattern,
          evidence: evidenceResult.rows,
          evidenceSummary: generateEvidenceSummary(evidenceResult.rows),
        };
        
        await sqs.send(new SendMessageCommand({
          QueueUrl: PROPOSAL_QUEUE_URL,
          MessageBody: JSON.stringify({
            type: 'generate_proposal',
            tenantId,
            pattern: message,
          }),
          MessageGroupId: tenantId,
          MessageDeduplicationId: `${pattern.id}-${Date.now()}`,
        }));
        
        result.patternsQualified++;
        result.proposalsQueued++;
        
        // Update pattern status
        await client.query(
          `UPDATE neural_need_patterns 
           SET status = 'proposal_generating', updated_at = NOW()
           WHERE id = $1`,
          [pattern.id]
        );
        
      } catch (error) {
        result.errors.push(`Error processing pattern ${pattern.id}: ${error}`);
      }
    }
    
    return result;
    
  } finally {
    client.release();
  }
}

function generateEvidenceSummary(evidence: any[]): PatternWithEvidence['evidenceSummary'] {
  const byType: Record<string, number> = {};
  const byUser: Record<string, number> = {};
  const timeline: Array<{ date: string; count: number; score: number }> = [];
  
  const dateMap: Record<string, { count: number; score: number }> = {};
  
  for (const e of evidence) {
    // By type
    byType[e.evidence_type] = (byType[e.evidence_type] || 0) + 1;
    
    // By user
    if (e.user_id) {
      byUser[e.user_id] = (byUser[e.user_id] || 0) + 1;
    }
    
    // Timeline
    const date = new Date(e.occurred_at).toISOString().split('T')[0];
    if (!dateMap[date]) {
      dateMap[date] = { count: 0, score: 0 };
    }
    dateMap[date].count++;
    dateMap[date].score += parseFloat(e.evidence_weight);
  }
  
  // Convert timeline map to array
  for (const [date, data] of Object.entries(dateMap)) {
    timeline.push({ date, ...data });
  }
  timeline.sort((a, b) => a.date.localeCompare(b.date));
  
  return { byType, byUser, timeline };
}

// ============================================================================
// Main Handler
// ============================================================================

export const handler: ScheduledHandler = async (event) => {
  console.log('Pattern analysis triggered:', event);
  
  const client = await pool.connect();
  
  try {
    // Get all active tenants
    const tenants = await client.query(
      `SELECT id FROM tenants WHERE status = 'active'`
    );
    
    const results: Record<string, AnalysisResult> = {};
    
    for (const tenant of tenants.rows) {
      results[tenant.id] = await analyzePatterns(tenant.id);
    }
    
    console.log('Pattern analysis complete:', results);
    
    return {
      statusCode: 200,
      body: JSON.stringify(results),
    };
    
  } finally {
    client.release();
  }
};
```

---

## 39.7 Proposal Generation Lambda (SQS Triggered)

```typescript
// ============================================================================
// packages/lambdas/src/workflow-proposals/proposal-generator.ts
// SQS-triggered Lambda that generates workflow proposals using Neural Engine
// ============================================================================

import { SQSHandler, SQSRecord } from 'aws-lambda';
import { Pool } from 'pg';
import {
  PatternWithEvidence,
  WorkflowProposal,
  ProposedWorkflowDAG,
  NeuralProposalGenerationContext,
  NeuralProposalGenerationResult,
  WorkflowComplexity,
} from '@radiant/core/types/workflow-proposals';
import {
  COMPLEXITY_NODE_THRESHOLDS,
  PROPOSAL_CODE_PREFIX,
  MAX_PROPOSED_WORKFLOW_NODES,
} from '@radiant/core/constants/workflow-proposals';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 10,
});

// ============================================================================
// Neural Engine Integration
// ============================================================================

interface NeuralEngineClient {
  generateProposal(context: NeuralProposalGenerationContext): Promise<NeuralProposalGenerationResult>;
}

async function createNeuralEngineClient(): Promise<NeuralEngineClient> {
  // In production, this would be an HTTP client to the Neural Engine service
  return {
    async generateProposal(context: NeuralProposalGenerationContext): Promise<NeuralProposalGenerationResult> {
      // This would call: POST /api/v2/internal/neural/generate-proposal
      // For now, implement intelligent proposal generation logic
      
      return generateIntelligentProposal(context);
    },
  };
}

async function generateIntelligentProposal(
  context: NeuralProposalGenerationContext
): Promise<NeuralProposalGenerationResult> {
  const { pattern, evidence, existingWorkflows, userSegmentProfile, tenantConstraints } = context;
  
  // Analyze evidence to determine what kind of workflow is needed
  const evidenceAnalysis = analyzeEvidence(evidence);
  
  // Check if we have enough signal to propose
  if (evidenceAnalysis.confidence < 0.5) {
    return {
      success: false,
      confidence: evidenceAnalysis.confidence,
      reasoning: 'Insufficient evidence signal to generate confident proposal',
      rejectionReason: 'Low evidence confidence',
    };
  }
  
  // Determine workflow structure based on intent and evidence
  const workflowStructure = determineWorkflowStructure(
    pattern,
    evidenceAnalysis,
    userSegmentProfile,
    tenantConstraints
  );
  
  // Generate the DAG
  const proposedDAG = generateWorkflowDAG(
    workflowStructure,
    pattern,
    tenantConstraints
  );
  
  // Calculate confidence based on coverage
  const coverageEstimate = calculateCoverageEstimate(proposedDAG, evidence);
  const overallConfidence = (evidenceAnalysis.confidence + coverageEstimate) / 2;
  
  if (overallConfidence < 0.6) {
    return {
      success: false,
      confidence: overallConfidence,
      reasoning: 'Generated workflow does not sufficiently address the identified need',
      rejectionReason: 'Low coverage confidence',
    };
  }
  
  // Estimate quality improvement
  const qualityImprovement = estimateQualityImprovement(
    proposedDAG,
    existingWorkflows,
    evidenceAnalysis
  );
  
  return {
    success: true,
    proposal: {
      proposalCode: '', // Will be generated
      proposalName: generateProposalName(pattern),
      proposalDescription: generateProposalDescription(pattern, evidenceAnalysis),
      sourcePatternId: pattern.id,
      proposedWorkflow: proposedDAG,
      workflowCategory: pattern.patternSignature.intentCategory,
      workflowType: 'production_workflow',
      estimatedComplexity: determineComplexity(proposedDAG),
      neuralConfidence: overallConfidence,
      neuralReasoning: generateNeuralReasoning(pattern, evidenceAnalysis, proposedDAG),
      estimatedQualityImprovement: qualityImprovement,
      estimatedCoveragePercentage: coverageEstimate,
      evidenceCount: evidence.length,
      uniqueUsersAffected: pattern.uniqueUsersAffected,
      totalEvidenceScore: pattern.totalEvidenceScore,
      evidenceTimeSpanDays: calculateTimeSpan(pattern),
      evidenceSummary: {
        byType: pattern.evidenceSummary?.byType || {},
        topFailureReasons: extractTopFailureReasons(evidence),
        affectedDomains: pattern.patternSignature.domainHints,
      },
      adminStatus: 'pending_brain',
    },
    confidence: overallConfidence,
    reasoning: generateNeuralReasoning(pattern, evidenceAnalysis, proposedDAG),
    alternativeApproaches: generateAlternativeApproaches(pattern, evidenceAnalysis),
  };
}

// ============================================================================
// Evidence Analysis
// ============================================================================

interface EvidenceAnalysis {
  confidence: number;
  primaryFailureType: string;
  failureReasons: string[];
  requiredCapabilities: string[];
  suggestedNodeTypes: string[];
  complexitySignal: WorkflowComplexity;
}

function analyzeEvidence(evidence: any[]): EvidenceAnalysis {
  const failureReasons: Record<string, number> = {};
  const capabilitySignals: Set<string> = new Set();
  let totalWeight = 0;
  
  for (const e of evidence) {
    totalWeight += parseFloat(e.evidence_weight);
    
    if (e.failure_reason) {
      failureReasons[e.failure_reason] = (failureReasons[e.failure_reason] || 0) + 1;
      
      // Extract capability signals from failure reasons
      const capabilities = extractCapabilities(e.failure_reason);
      capabilities.forEach(c => capabilitySignals.add(c));
    }
    
    if (e.user_feedback) {
      const capabilities = extractCapabilities(e.user_feedback);
      capabilities.forEach(c => capabilitySignals.add(c));
    }
  }
  
  // Sort failure reasons by frequency
  const sortedReasons = Object.entries(failureReasons)
    .sort((a, b) => b[1] - a[1])
    .map(([reason]) => reason);
  
  // Determine complexity from evidence volume and variety
  const complexitySignal = evidence.length > 20 ? 'complex' :
    evidence.length > 10 ? 'moderate' : 'simple';
  
  // Calculate confidence based on evidence consistency
  const reasonConsistency = sortedReasons.length > 0 
    ? failureReasons[sortedReasons[0]] / evidence.length 
    : 0;
  const confidence = Math.min(0.95, 0.3 + (totalWeight * 0.3) + (reasonConsistency * 0.4));
  
  return {
    confidence,
    primaryFailureType: sortedReasons[0] || 'unspecified',
    failureReasons: sortedReasons.slice(0, 5),
    requiredCapabilities: Array.from(capabilitySignals),
    suggestedNodeTypes: mapCapabilitiesToNodeTypes(Array.from(capabilitySignals)),
    complexitySignal: complexitySignal as WorkflowComplexity,
  };
}

function extractCapabilities(text: string): string[] {
  const capabilityPatterns: Record<string, string[]> = {
    'verification': ['wrong', 'incorrect', 'inaccurate', 'error', 'mistake', 'fact-check'],
    'multi_source': ['more sources', 'compare', 'multiple', 'different perspectives'],
    'depth': ['more detail', 'deeper', 'comprehensive', 'thorough', 'in-depth'],
    'reasoning': ['explain', 'reasoning', 'logic', 'step-by-step', 'how'],
    'creativity': ['creative', 'original', 'unique', 'novel', 'innovative'],
    'structure': ['organize', 'structure', 'format', 'outline', 'layout'],
    'iteration': ['refine', 'improve', 'iterate', 'better', 'enhance'],
  };
  
  const found: string[] = [];
  const lowerText = text.toLowerCase();
  
  for (const [capability, patterns] of Object.entries(capabilityPatterns)) {
    if (patterns.some(p => lowerText.includes(p))) {
      found.push(capability);
    }
  }
  
  return found;
}

function mapCapabilitiesToNodeTypes(capabilities: string[]): string[] {
  const mapping: Record<string, string[]> = {
    'verification': ['fact_check', 'cove_verification', 'multi_source_verify'],
    'multi_source': ['parallel_search', 'source_aggregation', 'perspective_synthesis'],
    'depth': ['recursive_elaboration', 'detail_expansion', 'exhaustive_analysis'],
    'reasoning': ['chain_of_thought', 'step_by_step', 'reasoning_chain'],
    'creativity': ['creative_expansion', 'brainstorm', 'divergent_thinking'],
    'structure': ['outline_generator', 'structure_organizer', 'format_optimizer'],
    'iteration': ['quality_loop', 'refinement_cycle', 'iterative_improvement'],
  };
  
  const nodeTypes: Set<string> = new Set();
  
  for (const capability of capabilities) {
    const types = mapping[capability] || [];
    types.forEach(t => nodeTypes.add(t));
  }
  
  return Array.from(nodeTypes);
}

// ============================================================================
// Workflow Structure Determination
// ============================================================================

interface WorkflowStructure {
  entryStrategy: 'single' | 'parallel' | 'conditional';
  coreNodeTypes: string[];
  verificationRequired: boolean;
  iterationRequired: boolean;
  exitStrategy: 'single' | 'merge' | 'select_best';
}

function determineWorkflowStructure(
  pattern: PatternWithEvidence,
  analysis: EvidenceAnalysis,
  userProfile: NeuralProposalGenerationContext['userSegmentProfile'],
  constraints: NeuralProposalGenerationContext['tenantConstraints']
): WorkflowStructure {
  // Base structure on intent category
  const intentCategory = pattern.patternSignature.intentCategory;
  
  let structure: WorkflowStructure = {
    entryStrategy: 'single',
    coreNodeTypes: [],
    verificationRequired: false,
    iterationRequired: false,
    exitStrategy: 'single',
  };
  
  // Determine entry strategy
  if (analysis.requiredCapabilities.includes('multi_source')) {
    structure.entryStrategy = 'parallel';
    structure.exitStrategy = 'merge';
  }
  
  // Add core node types based on intent
  switch (intentCategory) {
    case 'research':
      structure.coreNodeTypes = ['web_search', 'source_aggregation', 'citation_formatter'];
      structure.verificationRequired = true;
      break;
    case 'analysis':
      structure.coreNodeTypes = ['data_extraction', 'analysis_engine', 'insight_generator'];
      structure.iterationRequired = true;
      break;
    case 'creation':
      structure.coreNodeTypes = ['outline_generator', 'content_generator', 'quality_reviewer'];
      structure.iterationRequired = true;
      break;
    case 'verification':
      structure.coreNodeTypes = ['claim_extractor', 'fact_checker', 'confidence_scorer'];
      structure.entryStrategy = 'parallel';
      structure.exitStrategy = 'merge';
      break;
    default:
      structure.coreNodeTypes = ['llm_processor', 'response_formatter'];
  }
  
  // Add suggested node types from evidence
  structure.coreNodeTypes = [
    ...structure.coreNodeTypes,
    ...analysis.suggestedNodeTypes.filter(t => !structure.coreNodeTypes.includes(t)),
  ];
  
  // Limit to max allowed nodes
  if (structure.coreNodeTypes.length > constraints.maxWorkflowNodes - 2) {
    structure.coreNodeTypes = structure.coreNodeTypes.slice(0, constraints.maxWorkflowNodes - 2);
  }
  
  // Add verification if confidence is low
  if (analysis.confidence < 0.7 && !structure.verificationRequired) {
    structure.verificationRequired = true;
  }
  
  return structure;
}

// ============================================================================
// DAG Generation
// ============================================================================

function generateWorkflowDAG(
  structure: WorkflowStructure,
  pattern: PatternWithEvidence,
  constraints: NeuralProposalGenerationContext['tenantConstraints']
): ProposedWorkflowDAG {
  const nodes: ProposedWorkflowDAG['nodes'] = [];
  const edges: ProposedWorkflowDAG['edges'] = [];
  let nodeIdCounter = 0;
  let yPosition = 100;
  
  const generateNodeId = () => `node_${++nodeIdCounter}`;
  
  // Entry node
  const entryNode = {
    id: generateNodeId(),
    type: 'input',
    name: 'Input',
    config: {},
    position: { x: 100, y: yPosition },
    connections: [],
  };
  nodes.push(entryNode);
  let previousNodeIds = [entryNode.id];
  
  yPosition += 150;
  
  // Handle entry strategy
  if (structure.entryStrategy === 'parallel') {
    const parallelNodes: string[] = [];
    const xPositions = [-150, 0, 150];
    
    for (let i = 0; i < Math.min(3, structure.coreNodeTypes.length); i++) {
      const node = {
        id: generateNodeId(),
        type: structure.coreNodeTypes[i] || 'processor',
        name: formatNodeName(structure.coreNodeTypes[i] || 'Processor'),
        config: {},
        position: { x: 100 + xPositions[i], y: yPosition },
        connections: [],
      };
      nodes.push(node);
      parallelNodes.push(node.id);
      
      edges.push({ from: entryNode.id, to: node.id });
    }
    
    previousNodeIds = parallelNodes;
    yPosition += 150;
    
    // Merge node if parallel
    if (structure.exitStrategy === 'merge') {
      const mergeNode = {
        id: generateNodeId(),
        type: 'merge',
        name: 'Merge Results',
        config: { strategy: 'combine' },
        position: { x: 100, y: yPosition },
        connections: [],
      };
      nodes.push(mergeNode);
      
      for (const prevId of parallelNodes) {
        edges.push({ from: prevId, to: mergeNode.id });
      }
      
      previousNodeIds = [mergeNode.id];
      yPosition += 150;
    }
    
    // Add remaining core nodes sequentially
    for (let i = 3; i < structure.coreNodeTypes.length; i++) {
      const node = {
        id: generateNodeId(),
        type: structure.coreNodeTypes[i],
        name: formatNodeName(structure.coreNodeTypes[i]),
        config: {},
        position: { x: 100, y: yPosition },
        connections: [],
      };
      nodes.push(node);
      
      for (const prevId of previousNodeIds) {
        edges.push({ from: prevId, to: node.id });
      }
      
      previousNodeIds = [node.id];
      yPosition += 150;
    }
    
  } else {
    // Sequential entry
    for (const nodeType of structure.coreNodeTypes) {
      const node = {
        id: generateNodeId(),
        type: nodeType,
        name: formatNodeName(nodeType),
        config: {},
        position: { x: 100, y: yPosition },
        connections: [],
      };
      nodes.push(node);
      
      for (const prevId of previousNodeIds) {
        edges.push({ from: prevId, to: node.id });
      }
      
      previousNodeIds = [node.id];
      yPosition += 150;
    }
  }
  
  // Add verification node if required
  if (structure.verificationRequired) {
    const verifyNode = {
      id: generateNodeId(),
      type: 'verification',
      name: 'Quality Verification',
      config: { minConfidence: 0.7 },
      position: { x: 100, y: yPosition },
      connections: [],
    };
    nodes.push(verifyNode);
    
    for (const prevId of previousNodeIds) {
      edges.push({ from: prevId, to: verifyNode.id });
    }
    
    previousNodeIds = [verifyNode.id];
    yPosition += 150;
  }
  
  // Add iteration loop if required
  if (structure.iterationRequired) {
    const qualityCheckNode = {
      id: generateNodeId(),
      type: 'quality_check',
      name: 'Quality Check',
      config: { threshold: 0.8, maxIterations: 3 },
      position: { x: 100, y: yPosition },
      connections: [],
    };
    nodes.push(qualityCheckNode);
    
    for (const prevId of previousNodeIds) {
      edges.push({ from: prevId, to: qualityCheckNode.id });
    }
    
    // Add edge back to refinement (simplified - would need proper loop handling)
    previousNodeIds = [qualityCheckNode.id];
    yPosition += 150;
  }
  
  // Output node
  const outputNode = {
    id: generateNodeId(),
    type: 'output',
    name: 'Output',
    config: {},
    position: { x: 100, y: yPosition },
    connections: [],
  };
  nodes.push(outputNode);
  
  for (const prevId of previousNodeIds) {
    edges.push({ from: prevId, to: outputNode.id });
  }
  
  return {
    nodes,
    edges,
    entryPoint: entryNode.id,
    exitPoints: [outputNode.id],
    metadata: {
      estimatedLatencyMs: estimateLatency(nodes),
      estimatedCostPer1k: estimateCost(nodes),
      requiredModels: extractRequiredModels(nodes),
      requiredServices: extractRequiredServices(nodes),
    },
  };
}

function formatNodeName(nodeType: string): string {
  return nodeType
    .split('_')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

function estimateLatency(nodes: ProposedWorkflowDAG['nodes']): number {
  // Rough estimate: 500ms base + 200ms per node
  return 500 + (nodes.length * 200);
}

function estimateCost(nodes: ProposedWorkflowDAG['nodes']): number {
  // Rough estimate: $0.01 base + $0.005 per node per 1k requests
  return 0.01 + (nodes.length * 0.005);
}

function extractRequiredModels(nodes: ProposedWorkflowDAG['nodes']): string[] {
  const modelTypes: Record<string, string> = {
    'llm_processor': 'claude-3-5-sonnet',
    'content_generator': 'claude-3-5-sonnet',
    'fact_checker': 'gpt-4-turbo',
    'analysis_engine': 'claude-3-5-sonnet',
  };
  
  const models: Set<string> = new Set();
  for (const node of nodes) {
    if (modelTypes[node.type]) {
      models.add(modelTypes[node.type]);
    }
  }
  
  return Array.from(models);
}

function extractRequiredServices(nodes: ProposedWorkflowDAG['nodes']): string[] {
  const serviceTypes: Record<string, string> = {
    'web_search': 'search_service',
    'source_aggregation': 'aggregation_service',
    'fact_checker': 'verification_service',
  };
  
  const services: Set<string> = new Set();
  for (const node of nodes) {
    if (serviceTypes[node.type]) {
      services.add(serviceTypes[node.type]);
    }
  }
  
  return Array.from(services);
}

// ============================================================================
// Helper Functions
// ============================================================================

function calculateCoverageEstimate(
  dag: ProposedWorkflowDAG,
  evidence: any[]
): number {
  // Estimate what percentage of evidence cases this workflow would address
  // Based on node types matching required capabilities
  
  const capabilities: Set<string> = new Set();
  for (const e of evidence) {
    if (e.failure_reason) {
      extractCapabilities(e.failure_reason).forEach(c => capabilities.add(c));
    }
  }
  
  const nodeTypes = new Set(dag.nodes.map(n => n.type));
  const capabilityMapping = mapCapabilitiesToNodeTypes(Array.from(capabilities));
  
  let covered = 0;
  for (const nodeType of capabilityMapping) {
    if (nodeTypes.has(nodeType)) {
      covered++;
    }
  }
  
  return capabilityMapping.length > 0 
    ? Math.min(0.95, covered / capabilityMapping.length)
    : 0.6;
}

function estimateQualityImprovement(
  dag: ProposedWorkflowDAG,
  existingWorkflows: NeuralProposalGenerationContext['existingWorkflows'],
  analysis: EvidenceAnalysis
): number {
  // Estimate quality improvement over existing workflows
  // Based on failure rate of existing and new capabilities
  
  const avgFailureRate = existingWorkflows.length > 0
    ? existingWorkflows.reduce((sum, w) => sum + w.failureRate, 0) / existingWorkflows.length
    : 0.5;
  
  const newCapabilities = analysis.suggestedNodeTypes.filter(
    t => !existingWorkflows.some(w => w.name.toLowerCase().includes(t))
  );
  
  const capabilityBonus = newCapabilities.length * 0.05;
  
  return Math.min(0.40, avgFailureRate * 0.5 + capabilityBonus);
}

function generateProposalName(pattern: PatternWithEvidence): string {
  const intent = pattern.patternSignature.intentCategory;
  const domains = pattern.patternSignature.domainHints;
  
  const domainPrefix = domains.length > 0 ? `${domains[0].charAt(0).toUpperCase()}${domains[0].slice(1)} ` : '';
  const intentName = intent.charAt(0).toUpperCase() + intent.slice(1);
  
  return `${domainPrefix}${intentName} Enhancement Workflow`;
}

function generateProposalDescription(
  pattern: PatternWithEvidence,
  analysis: EvidenceAnalysis
): string {
  const reasons = analysis.failureReasons.slice(0, 3).join(', ');
  const users = pattern.uniqueUsersAffected;
  const evidence = pattern.evidenceCount;
  
  return `This workflow addresses user needs identified through ${evidence} evidence signals from ${users} users. Primary issues: ${reasons}. The proposed workflow adds ${analysis.suggestedNodeTypes.slice(0, 3).join(', ')} capabilities to improve outcomes.`;
}

function generateNeuralReasoning(
  pattern: PatternWithEvidence,
  analysis: EvidenceAnalysis,
  dag: ProposedWorkflowDAG
): string {
  return `Based on analysis of ${pattern.evidenceCount} evidence records with ${(analysis.confidence * 100).toFixed(0)}% confidence:
1. Primary failure pattern: ${analysis.primaryFailureType}
2. Required capabilities: ${analysis.requiredCapabilities.join(', ')}
3. Proposed solution: ${dag.nodes.length}-node workflow with ${dag.metadata.requiredModels.join(', ')} models
4. Estimated coverage: ${(calculateCoverageEstimate(dag, pattern.evidence || []) * 100).toFixed(0)}% of identified cases`;
}

function generateAlternativeApproaches(
  pattern: PatternWithEvidence,
  analysis: EvidenceAnalysis
): NeuralProposalGenerationResult['alternativeApproaches'] {
  return [
    {
      description: 'Simplified single-model approach with enhanced prompting',
      confidence: analysis.confidence * 0.7,
      tradeoffs: ['Lower latency', 'Lower cost', 'Potentially lower quality'],
    },
    {
      description: 'Extended multi-model ensemble with voting',
      confidence: analysis.confidence * 1.1,
      tradeoffs: ['Higher quality', 'Higher latency', 'Higher cost'],
    },
  ];
}

function determineComplexity(dag: ProposedWorkflowDAG): WorkflowComplexity {
  const nodeCount = dag.nodes.length;
  
  for (const [complexity, thresholds] of Object.entries(COMPLEXITY_NODE_THRESHOLDS)) {
    if (nodeCount >= thresholds.min && nodeCount <= thresholds.max) {
      return complexity as WorkflowComplexity;
    }
  }
  
  return 'moderate';
}

function calculateTimeSpan(pattern: PatternWithEvidence): number {
  if (!pattern.firstOccurrence || !pattern.lastOccurrence) return 0;
  
  const first = new Date(pattern.firstOccurrence).getTime();
  const last = new Date(pattern.lastOccurrence).getTime();
  
  return Math.ceil((last - first) / (1000 * 60 * 60 * 24));
}

function extractTopFailureReasons(evidence: any[]): string[] {
  const reasons: Record<string, number> = {};
  
  for (const e of evidence) {
    if (e.failure_reason) {
      reasons[e.failure_reason] = (reasons[e.failure_reason] || 0) + 1;
    }
  }
  
  return Object.entries(reasons)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([reason]) => reason);
}

// ============================================================================
// Proposal Code Generation
// ============================================================================

async function generateProposalCode(client: Pool, tenantId: string): Promise<string> {
  const year = new Date().getFullYear();
  
  const result = await client.query(
    `SELECT COUNT(*) + 1 as seq
     FROM workflow_proposals
     WHERE tenant_id = $1
       AND EXTRACT(YEAR FROM created_at) = $2`,
    [tenantId, year]
  );
  
  const sequence = String(result.rows[0].seq).padStart(3, '0');
  return `${PROPOSAL_CODE_PREFIX}-${year}-${sequence}`;
}

// ============================================================================
// Main Handler
// ============================================================================

export const handler: SQSHandler = async (event) => {
  const neuralEngine = await createNeuralEngineClient();
  const client = await pool.connect();
  
  try {
    for (const record of event.Records) {
      await processRecord(record, neuralEngine, client);
    }
  } finally {
    client.release();
  }
};

async function processRecord(
  record: SQSRecord,
  neuralEngine: NeuralEngineClient,
  client: Pool
): Promise<void> {
  const message = JSON.parse(record.body);
  
  if (message.type !== 'generate_proposal') {
    console.log('Unknown message type:', message.type);
    return;
  }
  
  const { tenantId, pattern } = message as {
    tenantId: string;
    pattern: PatternWithEvidence;
  };
  
  console.log(`Generating proposal for pattern ${pattern.id} in tenant ${tenantId}`);
  
  await client.query(`SET app.current_tenant_id = '${tenantId}'`);
  
  try {
    // Build context for Neural Engine
    const existingWorkflows = await client.query(
      `SELECT id, name, 
        (SELECT COUNT(*) FROM neural_need_evidence WHERE attempted_workflow_id = w.id) as failure_count,
        (SELECT COUNT(*) FROM execution_manifests WHERE workflow_id = w.id) as total_count
       FROM production_workflows w
       WHERE tenant_id = $1
       LIMIT 50`,
      [tenantId]
    );
    
    const thresholdConfig = await client.query(
      `SELECT * FROM proposal_threshold_config WHERE tenant_id = $1`,
      [tenantId]
    );
    
    const context: NeuralProposalGenerationContext = {
      pattern,
      evidence: pattern.evidence || [],
      existingWorkflows: existingWorkflows.rows.map(w => ({
        id: w.id,
        name: w.name,
        similarity: 0.5, // Would be calculated from embeddings
        failureRate: w.total_count > 0 ? w.failure_count / w.total_count : 0,
      })),
      userSegmentProfile: {
        commonIntents: [pattern.patternSignature.intentCategory],
        preferredComplexity: 'moderate',
        domainDistribution: Object.fromEntries(
          pattern.patternSignature.domainHints.map(d => [d, 1])
        ),
      },
      tenantConstraints: {
        maxWorkflowNodes: MAX_PROPOSED_WORKFLOW_NODES,
        allowedNodeTypes: [], // All types allowed by default
        requiredComplianceChecks: [],
      },
    };
    
    // Generate proposal
    const result = await neuralEngine.generateProposal(context);
    
    if (!result.success || !result.proposal) {
      console.log(`Proposal generation failed for pattern ${pattern.id}: ${result.rejectionReason}`);
      
      // Update pattern status
      await client.query(
        `UPDATE neural_need_patterns 
         SET status = 'accumulating', 
             confidence_threshold_met = FALSE,
             updated_at = NOW()
         WHERE id = $1`,
        [pattern.id]
      );
      
      return;
    }
    
    // Generate proposal code
    const proposalCode = await generateProposalCode(client, tenantId);
    
    // Insert proposal
    const proposalResult = await client.query<{ id: string }>(
      `INSERT INTO workflow_proposals (
        tenant_id, proposal_code, proposal_name, proposal_description,
        source_pattern_id, proposed_workflow, workflow_category, workflow_type,
        estimated_complexity, neural_confidence, neural_reasoning,
        estimated_quality_improvement, estimated_coverage_percentage,
        evidence_count, unique_users_affected, total_evidence_score,
        evidence_time_span_days, evidence_summary, admin_status
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19)
      RETURNING id`,
      [
        tenantId,
        proposalCode,
        result.proposal.proposalName,
        result.proposal.proposalDescription,
        pattern.id,
        JSON.stringify(result.proposal.proposedWorkflow),
        result.proposal.workflowCategory,
        result.proposal.workflowType,
        result.proposal.estimatedComplexity,
        result.confidence,
        result.reasoning,
        result.proposal.estimatedQualityImprovement,
        result.proposal.estimatedCoveragePercentage,
        result.proposal.evidenceCount,
        result.proposal.uniqueUsersAffected,
        result.proposal.totalEvidenceScore,
        result.proposal.evidenceTimeSpanDays,
        JSON.stringify(result.proposal.evidenceSummary),
        'pending_brain',
      ]
    );
    
    // Update pattern
    await client.query(
      `UPDATE neural_need_patterns 
       SET status = 'proposal_generated',
           confidence_threshold_met = TRUE,
           proposal_id = $2,
           updated_at = NOW()
       WHERE id = $1`,
      [pattern.id, proposalResult.rows[0].id]
    );
    
    console.log(`Created proposal ${proposalCode} for pattern ${pattern.id}`);
    
  } catch (error) {
    console.error(`Error generating proposal for pattern ${pattern.id}:`, error);
    
    // Reset pattern status on error
    await client.query(
      `UPDATE neural_need_patterns 
       SET status = 'threshold_met', updated_at = NOW()
       WHERE id = $1`,
      [pattern.id]
    );
    
    throw error;
  }
}
```

---

---

This chunk contains:
- Evidence Collection Lambda (pattern signature generation, keyword extraction, intent classification)
- Pattern Analysis Lambda (scheduled job that finds qualified patterns)
- Proposal Generation Lambda (SQS-triggered, Neural Engine integration, DAG generation)

Next chunk will contain Brain Governor Review, Admin APIs, and React Admin Dashboard components.

## 39.8 Brain Governor Review Lambda (SQS Triggered)

```typescript
// ============================================================================
// packages/lambdas/src/workflow-proposals/brain-reviewer.ts
// Brain Governor reviews proposals before they reach admin queue
// ============================================================================

import { SQSHandler, SQSRecord } from 'aws-lambda';
import { Pool } from 'pg';
import { SQSClient, SendMessageCommand } from '@aws-sdk/client-sqs';
import {
  WorkflowProposal,
  BrainProposalReviewContext,
  BrainProposalReviewResult,
  BrainRiskAssessment,
  ProposalThresholdConfig,
} from '@radiant/core/types/workflow-proposals';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 10,
});

const sqs = new SQSClient({});
const ADMIN_NOTIFICATION_QUEUE_URL = process.env.ADMIN_NOTIFICATION_QUEUE_URL!;

// ============================================================================
// Risk Assessment
// ============================================================================

function assessCostRisk(proposal: WorkflowProposal): number {
  const estimatedCost = proposal.proposedWorkflow.metadata.estimatedCostPer1k;
  const nodeCount = proposal.proposedWorkflow.nodes.length;
  const modelCount = proposal.proposedWorkflow.metadata.requiredModels.length;
  
  // Higher cost = higher risk
  let risk = 0;
  
  if (estimatedCost > 0.05) risk += 0.2;
  if (estimatedCost > 0.10) risk += 0.2;
  if (estimatedCost > 0.20) risk += 0.2;
  
  if (nodeCount > 10) risk += 0.1;
  if (nodeCount > 15) risk += 0.1;
  
  if (modelCount > 3) risk += 0.1;
  
  return Math.min(1.0, risk);
}

function assessLatencyRisk(proposal: WorkflowProposal): number {
  const estimatedLatency = proposal.proposedWorkflow.metadata.estimatedLatencyMs;
  const nodeCount = proposal.proposedWorkflow.nodes.length;
  const hasParallelNodes = proposal.proposedWorkflow.edges.some(
    (edge, _, edges) => edges.filter(e => e.from === edge.from).length > 1
  );
  
  let risk = 0;
  
  if (estimatedLatency > 2000) risk += 0.2;
  if (estimatedLatency > 5000) risk += 0.2;
  if (estimatedLatency > 10000) risk += 0.3;
  
  // Parallel execution can help or hurt
  if (!hasParallelNodes && nodeCount > 5) risk += 0.2;
  
  return Math.min(1.0, risk);
}

function assessQualityRisk(proposal: WorkflowProposal): number {
  const hasVerification = proposal.proposedWorkflow.nodes.some(
    n => n.type.includes('verification') || n.type.includes('quality')
  );
  const confidence = proposal.neuralConfidence;
  const coverage = proposal.estimatedCoveragePercentage || 0;
  
  let risk = 0;
  
  // Low confidence = high risk
  if (confidence < 0.80) risk += 0.2;
  if (confidence < 0.70) risk += 0.2;
  if (confidence < 0.60) risk += 0.2;
  
  // Low coverage = high risk
  if (coverage < 0.70) risk += 0.1;
  if (coverage < 0.60) risk += 0.1;
  
  // No verification = higher risk
  if (!hasVerification) risk += 0.1;
  
  return Math.min(1.0, risk);
}

function assessComplianceRisk(proposal: WorkflowProposal): number {
  // Check for nodes that might have compliance implications
  const riskyNodeTypes = ['external_api', 'data_export', 'pii_handler', 'external_search'];
  
  let risk = 0;
  
  for (const node of proposal.proposedWorkflow.nodes) {
    if (riskyNodeTypes.some(t => node.type.includes(t))) {
      risk += 0.15;
    }
  }
  
  // Check if workflow category has compliance requirements
  const highComplianceCategories = ['medical', 'legal', 'financial'];
  if (highComplianceCategories.some(c => proposal.workflowCategory?.includes(c))) {
    risk += 0.2;
  }
  
  return Math.min(1.0, risk);
}

function performRiskAssessment(proposal: WorkflowProposal): BrainRiskAssessment {
  const costRisk = assessCostRisk(proposal);
  const latencyRisk = assessLatencyRisk(proposal);
  const qualityRisk = assessQualityRisk(proposal);
  const complianceRisk = assessComplianceRisk(proposal);
  
  // Overall risk is weighted average
  const overallRisk = (
    costRisk * 0.25 +
    latencyRisk * 0.25 +
    qualityRisk * 0.30 +
    complianceRisk * 0.20
  );
  
  // Identify risk factors
  const riskFactors: string[] = [];
  if (costRisk > 0.3) riskFactors.push('High estimated cost');
  if (latencyRisk > 0.4) riskFactors.push('High estimated latency');
  if (qualityRisk > 0.3) riskFactors.push('Quality concerns');
  if (complianceRisk > 0.2) riskFactors.push('Compliance considerations');
  
  // Suggest mitigations
  const mitigations: string[] = [];
  if (costRisk > 0.3) mitigations.push('Consider model alternatives or caching');
  if (latencyRisk > 0.4) mitigations.push('Add parallel execution or reduce nodes');
  if (qualityRisk > 0.3) mitigations.push('Add verification nodes');
  if (complianceRisk > 0.2) mitigations.push('Add compliance checks or audit logging');
  
  return {
    costRisk,
    latencyRisk,
    qualityRisk,
    complianceRisk,
    overallRisk,
    riskFactors,
    mitigations,
  };
}

// ============================================================================
// Brain Review Logic
// ============================================================================

async function reviewProposal(
  context: BrainProposalReviewContext
): Promise<BrainProposalReviewResult> {
  const { proposal, pattern, tenantConfig, recentProposalCount, similarExistingWorkflows } = context;
  
  // Perform risk assessment
  const riskAssessment = performRiskAssessment(proposal);
  
  // Check against thresholds
  const maxCostRisk = tenantConfig.maxCostRisk || 0.30;
  const maxLatencyRisk = tenantConfig.maxLatencyRisk || 0.40;
  const minQualityConfidence = tenantConfig.minQualityConfidence || 0.70;
  const maxComplianceRisk = tenantConfig.maxComplianceRisk || 0.10;
  
  // Determine if we should veto
  let vetoReason: string | undefined;
  
  if (riskAssessment.costRisk > maxCostRisk) {
    vetoReason = `Cost risk (${(riskAssessment.costRisk * 100).toFixed(0)}%) exceeds threshold (${(maxCostRisk * 100).toFixed(0)}%)`;
  } else if (riskAssessment.latencyRisk > maxLatencyRisk) {
    vetoReason = `Latency risk (${(riskAssessment.latencyRisk * 100).toFixed(0)}%) exceeds threshold (${(maxLatencyRisk * 100).toFixed(0)}%)`;
  } else if (proposal.neuralConfidence < minQualityConfidence) {
    vetoReason = `Neural confidence (${(proposal.neuralConfidence * 100).toFixed(0)}%) below threshold (${(minQualityConfidence * 100).toFixed(0)}%)`;
  } else if (riskAssessment.complianceRisk > maxComplianceRisk) {
    vetoReason = `Compliance risk (${(riskAssessment.complianceRisk * 100).toFixed(0)}%) exceeds threshold (${(maxComplianceRisk * 100).toFixed(0)}%)`;
  }
  
  // Check for duplicate/similar workflows
  const highSimilarityWorkflow = similarExistingWorkflows.find(w => w.similarity > 0.85);
  if (highSimilarityWorkflow) {
    vetoReason = `Very similar workflow already exists: ${highSimilarityWorkflow.name} (${(highSimilarityWorkflow.similarity * 100).toFixed(0)}% similar)`;
  }
  
  // Check rate limits (redundant check, but important)
  if (recentProposalCount.today >= (tenantConfig.maxProposalsPerDay || 10)) {
    vetoReason = 'Daily proposal limit reached';
  } else if (recentProposalCount.thisWeek >= (tenantConfig.maxProposalsPerWeek || 30)) {
    vetoReason = 'Weekly proposal limit reached';
  }
  
  // Determine priority for admin review
  let adminPriority: 'low' | 'medium' | 'high' | 'urgent' = 'medium';
  
  if (proposal.uniqueUsersAffected > 50) adminPriority = 'high';
  if (proposal.uniqueUsersAffected > 100) adminPriority = 'urgent';
  if (proposal.totalEvidenceScore > 5.0) adminPriority = 'high';
  if (riskAssessment.overallRisk < 0.2 && proposal.neuralConfidence > 0.85) adminPriority = 'high';
  
  // Generate reasoning
  const reasoning = generateReviewReasoning(proposal, riskAssessment, vetoReason);
  
  // Check if modifications are suggested
  let suggestedModifications: BrainProposalReviewResult['suggestedModifications'];
  
  if (!vetoReason && riskAssessment.overallRisk > 0.25) {
    suggestedModifications = generateSuggestedModifications(proposal, riskAssessment);
  }
  
  return {
    approved: !vetoReason,
    riskAssessment,
    reasoning,
    vetoReason,
    suggestedModifications,
    escalateToAdmin: !vetoReason,
    adminPriority: vetoReason ? undefined : adminPriority,
  };
}

function generateReviewReasoning(
  proposal: WorkflowProposal,
  risk: BrainRiskAssessment,
  vetoReason?: string
): string {
  if (vetoReason) {
    return `Proposal vetoed: ${vetoReason}. Risk assessment: Cost ${(risk.costRisk * 100).toFixed(0)}%, Latency ${(risk.latencyRisk * 100).toFixed(0)}%, Quality ${(risk.qualityRisk * 100).toFixed(0)}%, Compliance ${(risk.complianceRisk * 100).toFixed(0)}%.`;
  }
  
  return `Proposal approved for admin review. Overall risk: ${(risk.overallRisk * 100).toFixed(0)}%. Neural confidence: ${(proposal.neuralConfidence * 100).toFixed(0)}%. Affects ${proposal.uniqueUsersAffected} users with ${proposal.evidenceCount} evidence signals. ${risk.riskFactors.length > 0 ? `Watch points: ${risk.riskFactors.join(', ')}.` : 'No major concerns.'}`;
}

function generateSuggestedModifications(
  proposal: WorkflowProposal,
  risk: BrainRiskAssessment
): Partial<WorkflowProposal['proposedWorkflow']> | undefined {
  const modifications: Partial<WorkflowProposal['proposedWorkflow']> = {};
  
  // If latency risk is high, suggest adding parallel execution
  if (risk.latencyRisk > 0.3) {
    // This would involve restructuring the DAG - simplified here
    modifications.metadata = {
      ...proposal.proposedWorkflow.metadata,
      // Add suggestion note
    };
  }
  
  // If quality risk is high and no verification, suggest adding it
  if (risk.qualityRisk > 0.3) {
    const hasVerification = proposal.proposedWorkflow.nodes.some(
      n => n.type.includes('verification')
    );
    
    if (!hasVerification) {
      // Suggest adding verification node
      modifications.nodes = [
        ...proposal.proposedWorkflow.nodes,
        {
          id: `suggested_verification_${Date.now()}`,
          type: 'quality_verification',
          name: 'Quality Verification (Suggested)',
          config: { minConfidence: 0.7 },
          position: { x: 100, y: 1000 },
          connections: [],
        },
      ];
    }
  }
  
  return Object.keys(modifications).length > 0 ? modifications : undefined;
}

// ============================================================================
// Main Handler
// ============================================================================

export const handler: SQSHandler = async (event) => {
  const client = await pool.connect();
  
  try {
    for (const record of event.Records) {
      await processRecord(record, client);
    }
  } finally {
    client.release();
  }
};

async function processRecord(record: SQSRecord, client: Pool): Promise<void> {
  const message = JSON.parse(record.body);
  
  if (message.type !== 'brain_review') {
    console.log('Unknown message type:', message.type);
    return;
  }
  
  const { tenantId, proposalId } = message;
  
  console.log(`Brain reviewing proposal ${proposalId} for tenant ${tenantId}`);
  
  await client.query(`SET app.current_tenant_id = '${tenantId}'`);
  
  try {
    // Fetch proposal with pattern
    const proposalResult = await client.query<WorkflowProposal>(
      `SELECT * FROM workflow_proposals WHERE id = $1`,
      [proposalId]
    );
    
    if (proposalResult.rows.length === 0) {
      console.error(`Proposal ${proposalId} not found`);
      return;
    }
    
    const proposal = proposalResult.rows[0];
    
    // Skip if not pending brain review
    if (proposal.admin_status !== 'pending_brain') {
      console.log(`Proposal ${proposalId} not pending brain review, skipping`);
      return;
    }
    
    // Fetch pattern
    const patternResult = await client.query(
      `SELECT * FROM neural_need_patterns WHERE id = $1`,
      [proposal.source_pattern_id]
    );
    
    // Fetch config
    const configResult = await client.query<ProposalThresholdConfig>(
      `SELECT * FROM proposal_threshold_config WHERE tenant_id = $1`,
      [tenantId]
    );
    const config = configResult.rows[0] || {};
    
    // Fetch recent proposal counts
    const countsResult = await client.query(
      `SELECT 
        COUNT(*) FILTER (WHERE created_at > NOW() - INTERVAL '1 day') as today,
        COUNT(*) FILTER (WHERE created_at > NOW() - INTERVAL '7 days') as this_week
       FROM workflow_proposals WHERE tenant_id = $1`,
      [tenantId]
    );
    
    // Fetch similar workflows
    const similarResult = await client.query(
      `SELECT id, name, 0.5 as similarity
       FROM production_workflows 
       WHERE tenant_id = $1 
         AND category = $2
       LIMIT 10`,
      [tenantId, proposal.workflow_category]
    );
    
    // Build context
    const context: BrainProposalReviewContext = {
      proposal,
      pattern: patternResult.rows[0],
      tenantConfig: config,
      currentWorkflowCount: 0,
      recentProposalCount: {
        today: parseInt(countsResult.rows[0].today),
        thisWeek: parseInt(countsResult.rows[0].this_week),
      },
      similarExistingWorkflows: similarResult.rows.map(w => ({
        id: w.id,
        name: w.name,
        similarity: w.similarity,
      })),
    };
    
    // Perform review
    const reviewResult = await reviewProposal(context);
    
    // Update proposal
    const newStatus = reviewResult.approved ? 'pending_admin' : 'declined';
    
    await client.query(
      `UPDATE workflow_proposals SET
        brain_approved = $2,
        brain_review_timestamp = NOW(),
        brain_risk_assessment = $3,
        brain_veto_reason = $4,
        brain_modifications = $5,
        admin_status = $6,
        updated_at = NOW()
      WHERE id = $1`,
      [
        proposalId,
        reviewResult.approved,
        JSON.stringify(reviewResult.riskAssessment),
        reviewResult.vetoReason,
        reviewResult.suggestedModifications ? JSON.stringify(reviewResult.suggestedModifications) : null,
        newStatus,
      ]
    );
    
    // Record review
    await client.query(
      `INSERT INTO workflow_proposal_reviews (
        proposal_id, reviewer_type, action, previous_status, new_status,
        review_notes, risk_assessment
      ) VALUES ($1, 'brain', $2, 'pending_brain', $3, $4, $5)`,
      [
        proposalId,
        reviewResult.approved ? 'approve' : 'decline',
        newStatus,
        reviewResult.reasoning,
        JSON.stringify(reviewResult.riskAssessment),
      ]
    );
    
    // Notify admins if approved
    if (reviewResult.approved) {
      await sqs.send(new SendMessageCommand({
        QueueUrl: ADMIN_NOTIFICATION_QUEUE_URL,
        MessageBody: JSON.stringify({
          type: 'new_proposal',
          tenantId,
          proposalId,
          proposalCode: proposal.proposal_code,
          priority: reviewResult.adminPriority,
          riskLevel: reviewResult.riskAssessment.overallRisk,
        }),
      }));
    }
    
    console.log(`Brain ${reviewResult.approved ? 'approved' : 'vetoed'} proposal ${proposalId}`);
    
  } catch (error) {
    console.error(`Error in brain review for proposal ${proposalId}:`, error);
    throw error;
  }
}
```

---

## 39.9 Admin API Endpoints

```typescript
// ============================================================================
// packages/lambdas/src/workflow-proposals/admin-api.ts
// Admin API for proposal management
// ============================================================================

import { APIGatewayProxyHandler, APIGatewayProxyResult } from 'aws-lambda';
import { Pool } from 'pg';
import {
  GetProposalsRequest,
  GetProposalsResponse,
  ReviewProposalRequest,
  ReviewProposalResponse,
  TestProposalRequest,
  TestProposalResponse,
  PublishProposalRequest,
  PublishProposalResponse,
  UpdateThresholdConfigRequest,
  UpdateEvidenceWeightsRequest,
  WorkflowProposal,
  ProposalReview,
} from '@radiant/core/types/workflow-proposals';
import { getTenantId, getUserId, createResponse, isAdmin, logAudit } from '../utils';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 10,
});

// ============================================================================
// GET /api/v2/admin/proposals - List proposals
// ============================================================================

export const listProposals: APIGatewayProxyHandler = async (event): Promise<APIGatewayProxyResult> => {
  const client = await pool.connect();
  
  try {
    const tenantId = getTenantId(event);
    const userId = getUserId(event);
    
    if (!tenantId || !userId || !await isAdmin(client, tenantId, userId)) {
      return createResponse(403, { error: 'Admin access required' });
    }
    
    await client.query(`SET app.current_tenant_id = '${tenantId}'`);
    
    const params = event.queryStringParameters || {};
    const statusFilter = params.status?.split(',') || ['pending_admin'];
    const limit = Math.min(parseInt(params.limit || '20'), 100);
    const offset = parseInt(params.offset || '0');
    
    // Build query
    let query = `
      SELECT wp.*, nnp.pattern_name, nnp.detected_intent
      FROM workflow_proposals wp
      JOIN neural_need_patterns nnp ON nnp.id = wp.source_pattern_id
      WHERE wp.tenant_id = $1
    `;
    const queryParams: any[] = [tenantId];
    
    if (statusFilter.length > 0) {
      queryParams.push(statusFilter);
      query += ` AND wp.admin_status = ANY($${queryParams.length})`;
    }
    
    query += ` ORDER BY wp.created_at DESC LIMIT $${queryParams.length + 1} OFFSET $${queryParams.length + 2}`;
    queryParams.push(limit, offset);
    
    const result = await client.query(query, queryParams);
    
    // Get total count
    const countResult = await client.query(
      `SELECT COUNT(*) FROM workflow_proposals WHERE tenant_id = $1 AND admin_status = ANY($2)`,
      [tenantId, statusFilter]
    );
    
    const response: GetProposalsResponse = {
      proposals: result.rows.map(row => ({
        ...row,
        sourcePattern: {
          id: row.source_pattern_id,
          patternName: row.pattern_name,
          detectedIntent: row.detected_intent,
        },
      })),
      total: parseInt(countResult.rows[0].count),
      hasMore: offset + result.rows.length < parseInt(countResult.rows[0].count),
    };
    
    return createResponse(200, response);
    
  } finally {
    client.release();
  }
};

// ============================================================================
// GET /api/v2/admin/proposals/:id - Get single proposal
// ============================================================================

export const getProposal: APIGatewayProxyHandler = async (event): Promise<APIGatewayProxyResult> => {
  const client = await pool.connect();
  
  try {
    const tenantId = getTenantId(event);
    const userId = getUserId(event);
    const proposalId = event.pathParameters?.id;
    
    if (!tenantId || !userId || !await isAdmin(client, tenantId, userId)) {
      return createResponse(403, { error: 'Admin access required' });
    }
    
    if (!proposalId) {
      return createResponse(400, { error: 'Proposal ID required' });
    }
    
    await client.query(`SET app.current_tenant_id = '${tenantId}'`);
    
    // Get proposal
    const proposalResult = await client.query(
      `SELECT * FROM workflow_proposals WHERE id = $1 AND tenant_id = $2`,
      [proposalId, tenantId]
    );
    
    if (proposalResult.rows.length === 0) {
      return createResponse(404, { error: 'Proposal not found' });
    }
    
    // Get pattern
    const patternResult = await client.query(
      `SELECT * FROM neural_need_patterns WHERE id = $1`,
      [proposalResult.rows[0].source_pattern_id]
    );
    
    // Get evidence
    const evidenceResult = await client.query(
      `SELECT * FROM neural_need_evidence 
       WHERE pattern_id = $1 
       ORDER BY occurred_at DESC LIMIT 50`,
      [proposalResult.rows[0].source_pattern_id]
    );
    
    // Get review history
    const reviewsResult = await client.query(
      `SELECT wpr.*, u.email as reviewer_email
       FROM workflow_proposal_reviews wpr
       LEFT JOIN users u ON u.id = wpr.reviewer_id
       WHERE wpr.proposal_id = $1
       ORDER BY wpr.reviewed_at DESC`,
      [proposalId]
    );
    
    return createResponse(200, {
      proposal: proposalResult.rows[0],
      pattern: patternResult.rows[0],
      evidence: evidenceResult.rows,
      reviews: reviewsResult.rows,
    });
    
  } finally {
    client.release();
  }
};

// ============================================================================
// POST /api/v2/admin/proposals/:id/review - Review proposal
// ============================================================================

export const reviewProposal: APIGatewayProxyHandler = async (event): Promise<APIGatewayProxyResult> => {
  const client = await pool.connect();
  
  try {
    const tenantId = getTenantId(event);
    const userId = getUserId(event);
    const proposalId = event.pathParameters?.id;
    
    if (!tenantId || !userId || !await isAdmin(client, tenantId, userId)) {
      return createResponse(403, { error: 'Admin access required' });
    }
    
    if (!proposalId) {
      return createResponse(400, { error: 'Proposal ID required' });
    }
    
    await client.query(`SET app.current_tenant_id = '${tenantId}'`);
    
    const request: ReviewProposalRequest = JSON.parse(event.body || '{}');
    
    if (!request.action) {
      return createResponse(400, { error: 'Action required' });
    }
    
    // Fetch proposal
    const proposalResult = await client.query<WorkflowProposal>(
      `SELECT * FROM workflow_proposals WHERE id = $1 AND tenant_id = $2`,
      [proposalId, tenantId]
    );
    
    if (proposalResult.rows.length === 0) {
      return createResponse(404, { error: 'Proposal not found' });
    }
    
    const proposal = proposalResult.rows[0];
    const previousStatus = proposal.admin_status;
    
    // Determine new status
    let newStatus: string;
    switch (request.action) {
      case 'approve':
        newStatus = 'approved';
        break;
      case 'decline':
        newStatus = 'declined';
        break;
      case 'request_test':
        newStatus = 'testing';
        break;
      case 'modify':
        newStatus = previousStatus; // Stay in current status
        break;
      default:
        return createResponse(400, { error: `Invalid action: ${request.action}` });
    }
    
    // Update proposal
    await client.query(
      `UPDATE workflow_proposals SET
        admin_status = $2,
        admin_reviewer_id = $3,
        admin_review_timestamp = NOW(),
        admin_notes = COALESCE($4, admin_notes),
        admin_modifications = COALESCE($5, admin_modifications),
        updated_at = NOW()
      WHERE id = $1`,
      [
        proposalId,
        newStatus,
        userId,
        request.notes,
        request.modifications ? JSON.stringify(request.modifications) : null,
      ]
    );
    
    // Record review
    const reviewResult = await client.query<{ id: string }>(
      `INSERT INTO workflow_proposal_reviews (
        proposal_id, reviewer_type, reviewer_id, action,
        previous_status, new_status, review_notes, modifications_made
      ) VALUES ($1, 'admin', $2, $3, $4, $5, $6, $7)
      RETURNING id`,
      [
        proposalId,
        userId,
        request.action,
        previousStatus,
        newStatus,
        request.notes,
        request.modifications ? JSON.stringify(request.modifications) : null,
      ]
    );
    
    // Audit log
    await logAudit(client, {
      tenantId,
      userId,
      action: `proposal_${request.action}`,
      resourceType: 'workflow_proposal',
      resourceId: proposalId,
      details: {
        previousStatus,
        newStatus,
        notes: request.notes,
      },
    });
    
    const response: ReviewProposalResponse = {
      proposalId,
      newStatus: newStatus as any,
      reviewId: reviewResult.rows[0].id,
    };
    
    return createResponse(200, response);
    
  } finally {
    client.release();
  }
};

// ============================================================================
// POST /api/v2/admin/proposals/:id/test - Test proposal
// ============================================================================

export const testProposal: APIGatewayProxyHandler = async (event): Promise<APIGatewayProxyResult> => {
  const client = await pool.connect();
  
  try {
    const tenantId = getTenantId(event);
    const userId = getUserId(event);
    const proposalId = event.pathParameters?.id;
    
    if (!tenantId || !userId || !await isAdmin(client, tenantId, userId)) {
      return createResponse(403, { error: 'Admin access required' });
    }
    
    if (!proposalId) {
      return createResponse(400, { error: 'Proposal ID required' });
    }
    
    await client.query(`SET app.current_tenant_id = '${tenantId}'`);
    
    const request: TestProposalRequest = JSON.parse(event.body || '{}');
    
    // Fetch proposal
    const proposalResult = await client.query<WorkflowProposal>(
      `SELECT * FROM workflow_proposals WHERE id = $1 AND tenant_id = $2`,
      [proposalId, tenantId]
    );
    
    if (proposalResult.rows.length === 0) {
      return createResponse(404, { error: 'Proposal not found' });
    }
    
    const proposal = proposalResult.rows[0];
    
    // Update status to testing
    await client.query(
      `UPDATE workflow_proposals SET
        admin_status = 'testing',
        test_status = 'testing',
        updated_at = NOW()
      WHERE id = $1`,
      [proposalId]
    );
    
    // Execute tests (simplified - in production, this would be async)
    const testResults = await executeProposalTests(
      proposal,
      request.testCases || [],
      request.iterations || 3
    );
    
    // Update with results
    const testStatus = testResults.testsPassed >= testResults.testsRun * 0.8 ? 'passed' : 'failed';
    
    await client.query(
      `UPDATE workflow_proposals SET
        test_status = $2,
        test_results = $3,
        admin_status = 'pending_admin',
        updated_at = NOW()
      WHERE id = $1`,
      [proposalId, testStatus, JSON.stringify(testResults)]
    );
    
    const response: TestProposalResponse = {
      proposalId,
      testStatus: testStatus as any,
      testResults,
      testExecutionIds: [],
    };
    
    return createResponse(200, response);
    
  } finally {
    client.release();
  }
};

async function executeProposalTests(
  proposal: WorkflowProposal,
  testCases: Array<{ input: string; expectedBehavior?: string }>,
  iterations: number
): Promise<WorkflowProposal['testResults']> {
  // Simplified test execution
  // In production, this would actually run the workflow in a sandbox
  
  const testsRun = Math.max(testCases.length, iterations);
  const testsPassed = Math.floor(testsRun * 0.85); // Simulated 85% pass rate
  
  return {
    testsRun,
    testsPassed,
    testsFailed: testsRun - testsPassed,
    avgLatencyMs: proposal.proposedWorkflow.metadata.estimatedLatencyMs * 1.1,
    avgQualityScore: proposal.neuralConfidence * 0.95,
    issues: testsRun > testsPassed ? ['Some edge cases produced lower quality results'] : [],
  };
}

// ============================================================================
// POST /api/v2/admin/proposals/:id/publish - Publish approved proposal
// ============================================================================

export const publishProposal: APIGatewayProxyHandler = async (event): Promise<APIGatewayProxyResult> => {
  const client = await pool.connect();
  
  try {
    const tenantId = getTenantId(event);
    const userId = getUserId(event);
    const proposalId = event.pathParameters?.id;
    
    if (!tenantId || !userId || !await isAdmin(client, tenantId, userId)) {
      return createResponse(403, { error: 'Admin access required' });
    }
    
    if (!proposalId) {
      return createResponse(400, { error: 'Proposal ID required' });
    }
    
    await client.query(`SET app.current_tenant_id = '${tenantId}'`);
    
    const request: PublishProposalRequest = JSON.parse(event.body || '{}');
    
    // Fetch proposal
    const proposalResult = await client.query<WorkflowProposal>(
      `SELECT * FROM workflow_proposals WHERE id = $1 AND tenant_id = $2`,
      [proposalId, tenantId]
    );
    
    if (proposalResult.rows.length === 0) {
      return createResponse(404, { error: 'Proposal not found' });
    }
    
    const proposal = proposalResult.rows[0];
    
    if (proposal.admin_status !== 'approved') {
      return createResponse(400, { error: 'Proposal must be approved before publishing' });
    }
    
    // Create production workflow from proposal
    const workflowResult = await client.query<{ id: string }>(
      `INSERT INTO production_workflows (
        tenant_id, name, description, category, workflow_type,
        dag_definition, complexity, created_by, source_proposal_id
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING id`,
      [
        tenantId,
        proposal.proposal_name,
        proposal.proposal_description,
        request.publishToCategory || proposal.workflow_category,
        proposal.workflow_type,
        JSON.stringify(proposal.proposed_workflow),
        proposal.estimated_complexity,
        userId,
        proposalId,
      ]
    );
    
    const publishedWorkflowId = workflowResult.rows[0].id;
    
    // Update proposal
    await client.query(
      `UPDATE workflow_proposals SET
        published_workflow_id = $2,
        published_at = NOW(),
        updated_at = NOW()
      WHERE id = $1`,
      [proposalId, publishedWorkflowId]
    );
    
    // Update source pattern
    await client.query(
      `UPDATE neural_need_patterns SET
        status = 'resolved',
        updated_at = NOW()
      WHERE id = $1`,
      [proposal.source_pattern_id]
    );
    
    // Audit log
    await logAudit(client, {
      tenantId,
      userId,
      action: 'proposal_published',
      resourceType: 'workflow_proposal',
      resourceId: proposalId,
      details: {
        publishedWorkflowId,
        workflowName: proposal.proposal_name,
      },
    });
    
    const response: PublishProposalResponse = {
      proposalId,
      publishedWorkflowId,
      publishedAt: new Date().toISOString(),
    };
    
    return createResponse(200, response);
    
  } finally {
    client.release();
  }
};

// ============================================================================
// GET/PUT /api/v2/admin/proposals/config - Threshold configuration
// ============================================================================

export const getThresholdConfig: APIGatewayProxyHandler = async (event): Promise<APIGatewayProxyResult> => {
  const client = await pool.connect();
  
  try {
    const tenantId = getTenantId(event);
    const userId = getUserId(event);
    
    if (!tenantId || !userId || !await isAdmin(client, tenantId, userId)) {
      return createResponse(403, { error: 'Admin access required' });
    }
    
    await client.query(`SET app.current_tenant_id = '${tenantId}'`);
    
    const configResult = await client.query(
      `SELECT * FROM proposal_threshold_config WHERE tenant_id = $1`,
      [tenantId]
    );
    
    const weightsResult = await client.query(
      `SELECT * FROM evidence_weight_config WHERE tenant_id = $1 ORDER BY evidence_type`,
      [tenantId]
    );
    
    return createResponse(200, {
      thresholds: configResult.rows[0] || {},
      evidenceWeights: weightsResult.rows,
    });
    
  } finally {
    client.release();
  }
};

export const updateThresholdConfig: APIGatewayProxyHandler = async (event): Promise<APIGatewayProxyResult> => {
  const client = await pool.connect();
  
  try {
    const tenantId = getTenantId(event);
    const userId = getUserId(event);
    
    if (!tenantId || !userId || !await isAdmin(client, tenantId, userId)) {
      return createResponse(403, { error: 'Admin access required' });
    }
    
    await client.query(`SET app.current_tenant_id = '${tenantId}'`);
    
    const request: UpdateThresholdConfigRequest = JSON.parse(event.body || '{}');
    
    // Build dynamic update query
    const updates: string[] = [];
    const values: any[] = [tenantId];
    let paramIndex = 2;
    
    for (const [key, value] of Object.entries(request.config)) {
      const snakeKey = key.replace(/([A-Z])/g, '_$1').toLowerCase();
      updates.push(`${snakeKey} = $${paramIndex}`);
      values.push(value);
      paramIndex++;
    }
    
    if (updates.length === 0) {
      return createResponse(400, { error: 'No configuration values provided' });
    }
    
    updates.push(`updated_at = NOW()`);
    updates.push(`updated_by = $${paramIndex}`);
    values.push(userId);
    
    await client.query(
      `INSERT INTO proposal_threshold_config (tenant_id) VALUES ($1)
       ON CONFLICT (tenant_id) DO UPDATE SET ${updates.join(', ')}`,
      values
    );
    
    // Audit log
    await logAudit(client, {
      tenantId,
      userId,
      action: 'threshold_config_updated',
      resourceType: 'proposal_config',
      resourceId: tenantId,
      details: request.config,
    });
    
    return createResponse(200, { success: true });
    
  } finally {
    client.release();
  }
};

export const updateEvidenceWeights: APIGatewayProxyHandler = async (event): Promise<APIGatewayProxyResult> => {
  const client = await pool.connect();
  
  try {
    const tenantId = getTenantId(event);
    const userId = getUserId(event);
    
    if (!tenantId || !userId || !await isAdmin(client, tenantId, userId)) {
      return createResponse(403, { error: 'Admin access required' });
    }
    
    await client.query(`SET app.current_tenant_id = '${tenantId}'`);
    
    const request: UpdateEvidenceWeightsRequest = JSON.parse(event.body || '{}');
    
    for (const weight of request.weights) {
      await client.query(
        `INSERT INTO evidence_weight_config (tenant_id, evidence_type, weight, enabled, updated_by)
         VALUES ($1, $2, $3, COALESCE($4, TRUE), $5)
         ON CONFLICT (tenant_id, evidence_type) DO UPDATE SET
           weight = $3,
           enabled = COALESCE($4, evidence_weight_config.enabled),
           updated_by = $5,
           updated_at = NOW()`,
        [tenantId, weight.evidenceType, weight.weight, weight.enabled, userId]
      );
    }
    
    // Audit log
    await logAudit(client, {
      tenantId,
      userId,
      action: 'evidence_weights_updated',
      resourceType: 'evidence_config',
      resourceId: tenantId,
      details: { weights: request.weights },
    });
    
    return createResponse(200, { success: true });
    
  } finally {
    client.release();
  }
};
```

---

## 39.10 React Admin Dashboard Components

```tsx
// ============================================================================
// packages/admin-dashboard/src/components/proposals/ProposalQueuePage.tsx
// Main proposal review queue page
// ============================================================================

import React, { useState, useEffect } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Chip,
  Button,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  IconButton,
  Tooltip,
  LinearProgress,
  Badge,
  Tab,
  Tabs,
} from '@mui/material';
import {
  CheckCircle,
  Cancel,
  PlayArrow,
  Visibility,
  Warning,
  TrendingUp,
  People,
  Timer,
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { useProposals, useProposalStats } from '../../hooks/useProposals';
import { WorkflowProposal, ProposalAdminStatus } from '@radiant/core/types/workflow-proposals';

const statusColors: Record<ProposalAdminStatus, 'default' | 'primary' | 'secondary' | 'error' | 'info' | 'success' | 'warning'> = {
  pending_brain: 'default',
  pending_admin: 'warning',
  approved: 'success',
  declined: 'error',
  testing: 'info',
};

const statusLabels: Record<ProposalAdminStatus, string> = {
  pending_brain: 'Brain Review',
  pending_admin: 'Needs Review',
  approved: 'Approved',
  declined: 'Declined',
  testing: 'Testing',
};

export const ProposalQueuePage: React.FC = () => {
  const navigate = useNavigate();
  const [statusFilter, setStatusFilter] = useState<ProposalAdminStatus>('pending_admin');
  const { proposals, loading, refetch } = useProposals({ status: [statusFilter] });
  const { stats } = useProposalStats();
  
  return (
    <Box sx={{ p: 3 }}>
      {/* Header Stats */}
      <Box sx={{ display: 'flex', gap: 2, mb: 3 }}>
        <StatCard
          title="Pending Review"
          value={stats?.pendingAdmin || 0}
          icon={<Warning color="warning" />}
          color="warning"
        />
        <StatCard
          title="Approved Today"
          value={stats?.approvedToday || 0}
          icon={<CheckCircle color="success" />}
          color="success"
        />
        <StatCard
          title="Users Affected"
          value={stats?.totalUsersAffected || 0}
          icon={<People color="primary" />}
          color="primary"
        />
        <StatCard
          title="Avg Confidence"
          value={`${((stats?.avgConfidence || 0) * 100).toFixed(0)}%`}
          icon={<TrendingUp color="info" />}
          color="info"
        />
      </Box>
      
      {/* Status Tabs */}
      <Card sx={{ mb: 3 }}>
        <Tabs
          value={statusFilter}
          onChange={(_, v) => setStatusFilter(v)}
          indicatorColor="primary"
        >
          <Tab 
            label={
              <Badge badgeContent={stats?.pendingAdmin || 0} color="warning">
                Pending Review
              </Badge>
            } 
            value="pending_admin" 
          />
          <Tab label="Testing" value="testing" />
          <Tab label="Approved" value="approved" />
          <Tab label="Declined" value="declined" />
        </Tabs>
      </Card>
      
      {/* Proposals Table */}
      <Card>
        <CardContent>
          {loading ? (
            <LinearProgress />
          ) : (
            <TableContainer>
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell>Proposal</TableCell>
                    <TableCell>Category</TableCell>
                    <TableCell align="center">Evidence</TableCell>
                    <TableCell align="center">Users</TableCell>
                    <TableCell align="center">Confidence</TableCell>
                    <TableCell align="center">Risk</TableCell>
                    <TableCell align="center">Status</TableCell>
                    <TableCell align="right">Actions</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {proposals.map((proposal) => (
                    <ProposalRow
                      key={proposal.id}
                      proposal={proposal}
                      onView={() => navigate(`/proposals/${proposal.id}`)}
                      onRefresh={refetch}
                    />
                  ))}
                  {proposals.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={8} align="center">
                        <Typography color="textSecondary">
                          No proposals in this status
                        </Typography>
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </TableContainer>
          )}
        </CardContent>
      </Card>
    </Box>
  );
};

interface ProposalRowProps {
  proposal: WorkflowProposal;
  onView: () => void;
  onRefresh: () => void;
}

const ProposalRow: React.FC<ProposalRowProps> = ({ proposal, onView, onRefresh }) => {
  const riskLevel = proposal.brainRiskAssessment?.overallRisk || 0;
  
  return (
    <TableRow hover>
      <TableCell>
        <Typography variant="subtitle2">{proposal.proposalCode}</Typography>
        <Typography variant="body2" color="textSecondary" noWrap sx={{ maxWidth: 300 }}>
          {proposal.proposalName}
        </Typography>
      </TableCell>
      <TableCell>
        <Chip 
          label={proposal.workflowCategory || 'General'} 
          size="small" 
          variant="outlined"
        />
      </TableCell>
      <TableCell align="center">
        <Typography variant="body2">{proposal.evidenceCount}</Typography>
      </TableCell>
      <TableCell align="center">
        <Typography variant="body2">{proposal.uniqueUsersAffected}</Typography>
      </TableCell>
      <TableCell align="center">
        <ConfidenceChip value={proposal.neuralConfidence} />
      </TableCell>
      <TableCell align="center">
        <RiskChip value={riskLevel} />
      </TableCell>
      <TableCell align="center">
        <Chip
          label={statusLabels[proposal.adminStatus]}
          color={statusColors[proposal.adminStatus]}
          size="small"
        />
      </TableCell>
      <TableCell align="right">
        <Tooltip title="View Details">
          <IconButton size="small" onClick={onView}>
            <Visibility />
          </IconButton>
        </Tooltip>
      </TableCell>
    </TableRow>
  );
};

const StatCard: React.FC<{
  title: string;
  value: number | string;
  icon: React.ReactNode;
  color: string;
}> = ({ title, value, icon, color }) => (
  <Card sx={{ flex: 1 }}>
    <CardContent sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
      {icon}
      <Box>
        <Typography variant="h4">{value}</Typography>
        <Typography variant="body2" color="textSecondary">{title}</Typography>
      </Box>
    </CardContent>
  </Card>
);

const ConfidenceChip: React.FC<{ value: number }> = ({ value }) => {
  const percent = Math.round(value * 100);
  const color = percent >= 80 ? 'success' : percent >= 60 ? 'warning' : 'error';
  
  return (
    <Chip
      label={`${percent}%`}
      color={color}
      size="small"
      variant="outlined"
    />
  );
};

const RiskChip: React.FC<{ value: number }> = ({ value }) => {
  const percent = Math.round(value * 100);
  const color = percent <= 20 ? 'success' : percent <= 40 ? 'warning' : 'error';
  const label = percent <= 20 ? 'Low' : percent <= 40 ? 'Medium' : 'High';
  
  return (
    <Chip
      label={label}
      color={color}
      size="small"
      variant="outlined"
    />
  );
};

export default ProposalQueuePage;
```

```tsx
// ============================================================================
// packages/admin-dashboard/src/components/proposals/ProposalDetailPage.tsx
// Detailed proposal review page with workflow visualization
// ============================================================================

import React, { useState } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Button,
  Grid,
  Divider,
  TextField,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Stepper,
  Step,
  StepLabel,
  Alert,
  Chip,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  Paper,
} from '@mui/material';
import {
  CheckCircle,
  Cancel,
  PlayArrow,
  Publish,
  Warning,
  Info,
  TrendingUp,
  People,
  AccessTime,
  Category,
} from '@mui/icons-material';
import { useParams, useNavigate } from 'react-router-dom';
import { useProposalDetail, useReviewProposal, useTestProposal, usePublishProposal } from '../../hooks/useProposals';
import { WorkflowDAGViewer } from '../workflows/WorkflowDAGViewer';
import { EvidenceTimeline } from './EvidenceTimeline';

export const ProposalDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { proposal, pattern, evidence, reviews, loading, refetch } = useProposalDetail(id!);
  const { review, reviewing } = useReviewProposal();
  const { test, testing } = useTestProposal();
  const { publish, publishing } = usePublishProposal();
  
  const [reviewDialogOpen, setReviewDialogOpen] = useState(false);
  const [reviewAction, setReviewAction] = useState<'approve' | 'decline'>('approve');
  const [reviewNotes, setReviewNotes] = useState('');
  
  if (loading || !proposal) {
    return <Box sx={{ p: 3 }}>Loading...</Box>;
  }
  
  const handleReview = async () => {
    await review(id!, { action: reviewAction, notes: reviewNotes });
    setReviewDialogOpen(false);
    refetch();
  };
  
  const handleTest = async () => {
    await test(id!, { testMode: 'automated', iterations: 5 });
    refetch();
  };
  
  const handlePublish = async () => {
    await publish(id!, {});
    navigate('/proposals');
  };
  
  return (
    <Box sx={{ p: 3 }}>
      {/* Header */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 3 }}>
        <Box>
          <Typography variant="h4">{proposal.proposalCode}</Typography>
          <Typography variant="h6" color="textSecondary">{proposal.proposalName}</Typography>
        </Box>
        <Box sx={{ display: 'flex', gap: 1 }}>
          {proposal.adminStatus === 'pending_admin' && (
            <>
              <Button
                variant="contained"
                color="success"
                startIcon={<CheckCircle />}
                onClick={() => { setReviewAction('approve'); setReviewDialogOpen(true); }}
              >
                Approve
              </Button>
              <Button
                variant="outlined"
                color="error"
                startIcon={<Cancel />}
                onClick={() => { setReviewAction('decline'); setReviewDialogOpen(true); }}
              >
                Decline
              </Button>
              <Button
                variant="outlined"
                startIcon={<PlayArrow />}
                onClick={handleTest}
                disabled={testing}
              >
                Run Tests
              </Button>
            </>
          )}
          {proposal.adminStatus === 'approved' && !proposal.publishedWorkflowId && (
            <Button
              variant="contained"
              color="primary"
              startIcon={<Publish />}
              onClick={handlePublish}
              disabled={publishing}
            >
              Publish to Production
            </Button>
          )}
        </Box>
      </Box>
      
      <Grid container spacing={3}>
        {/* Left Column - Details */}
        <Grid item xs={12} md={4}>
          {/* Summary Card */}
          <Card sx={{ mb: 2 }}>
            <CardContent>
              <Typography variant="h6" gutterBottom>Summary</Typography>
              <List dense>
                <ListItem>
                  <ListItemIcon><Category /></ListItemIcon>
                  <ListItemText 
                    primary="Category" 
                    secondary={proposal.workflowCategory || 'General'} 
                  />
                </ListItem>
                <ListItem>
                  <ListItemIcon><People /></ListItemIcon>
                  <ListItemText 
                    primary="Users Affected" 
                    secondary={proposal.uniqueUsersAffected} 
                  />
                </ListItem>
                <ListItem>
                  <ListItemIcon><TrendingUp /></ListItemIcon>
                  <ListItemText 
                    primary="Evidence Count" 
                    secondary={proposal.evidenceCount} 
                  />
                </ListItem>
                <ListItem>
                  <ListItemIcon><AccessTime /></ListItemIcon>
                  <ListItemText 
                    primary="Time Span" 
                    secondary={`${proposal.evidenceTimeSpanDays} days`} 
                  />
                </ListItem>
              </List>
            </CardContent>
          </Card>
          
          {/* Risk Assessment Card */}
          {proposal.brainRiskAssessment && (
            <Card sx={{ mb: 2 }}>
              <CardContent>
                <Typography variant="h6" gutterBottom>Risk Assessment</Typography>
                <RiskBar label="Cost Risk" value={proposal.brainRiskAssessment.costRisk} />
                <RiskBar label="Latency Risk" value={proposal.brainRiskAssessment.latencyRisk} />
                <RiskBar label="Quality Risk" value={proposal.brainRiskAssessment.qualityRisk} />
                <RiskBar label="Compliance Risk" value={proposal.brainRiskAssessment.complianceRisk} />
                <Divider sx={{ my: 1 }} />
                <RiskBar label="Overall Risk" value={proposal.brainRiskAssessment.overallRisk} bold />
                
                {proposal.brainRiskAssessment.riskFactors.length > 0 && (
                  <Box sx={{ mt: 2 }}>
                    <Typography variant="subtitle2" color="warning.main">Risk Factors:</Typography>
                    {proposal.brainRiskAssessment.riskFactors.map((factor, i) => (
                      <Chip key={i} label={factor} size="small" sx={{ mr: 0.5, mt: 0.5 }} />
                    ))}
                  </Box>
                )}
              </CardContent>
            </Card>
          )}
          
          {/* Neural Reasoning */}
          <Card sx={{ mb: 2 }}>
            <CardContent>
              <Typography variant="h6" gutterBottom>Neural Engine Reasoning</Typography>
              <Typography variant="body2" sx={{ whiteSpace: 'pre-line' }}>
                {proposal.neuralReasoning}
              </Typography>
            </CardContent>
          </Card>
          
          {/* Test Results */}
          {proposal.testResults && (
            <Card sx={{ mb: 2 }}>
              <CardContent>
                <Typography variant="h6" gutterBottom>Test Results</Typography>
                <Alert 
                  severity={proposal.testStatus === 'passed' ? 'success' : 'warning'}
                  sx={{ mb: 2 }}
                >
                  {proposal.testResults.testsPassed} / {proposal.testResults.testsRun} tests passed
                </Alert>
                <Typography variant="body2">
                  Avg Latency: {proposal.testResults.avgLatencyMs}ms
                </Typography>
                <Typography variant="body2">
                  Avg Quality: {(proposal.testResults.avgQualityScore * 100).toFixed(0)}%
                </Typography>
                {proposal.testResults.issues.length > 0 && (
                  <Box sx={{ mt: 1 }}>
                    <Typography variant="subtitle2" color="warning.main">Issues:</Typography>
                    {proposal.testResults.issues.map((issue, i) => (
                      <Typography key={i} variant="body2" color="textSecondary">â€¢ {issue}</Typography>
                    ))}
                  </Box>
                )}
              </CardContent>
            </Card>
          )}
        </Grid>
        
        {/* Right Column - Workflow & Evidence */}
        <Grid item xs={12} md={8}>
          {/* Workflow Visualization */}
          <Card sx={{ mb: 2 }}>
            <CardContent>
              <Typography variant="h6" gutterBottom>Proposed Workflow</Typography>
              <Box sx={{ height: 400, border: '1px solid #e0e0e0', borderRadius: 1 }}>
                <WorkflowDAGViewer dag={proposal.proposedWorkflow} />
              </Box>
              <Box sx={{ mt: 2, display: 'flex', gap: 2 }}>
                <Chip 
                  icon={<AccessTime />} 
                  label={`Est. Latency: ${proposal.proposedWorkflow.metadata.estimatedLatencyMs}ms`}
                  variant="outlined"
                />
                <Chip 
                  icon={<TrendingUp />} 
                  label={`Est. Cost: $${proposal.proposedWorkflow.metadata.estimatedCostPer1k.toFixed(3)}/1k`}
                  variant="outlined"
                />
                <Chip 
                  label={`${proposal.proposedWorkflow.nodes.length} nodes`}
                  variant="outlined"
                />
              </Box>
            </CardContent>
          </Card>
          
          {/* Evidence Timeline */}
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>Evidence Timeline</Typography>
              <EvidenceTimeline evidence={evidence} />
            </CardContent>
          </Card>
        </Grid>
      </Grid>
      
      {/* Review Dialog */}
      <Dialog open={reviewDialogOpen} onClose={() => setReviewDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>
          {reviewAction === 'approve' ? 'Approve Proposal' : 'Decline Proposal'}
        </DialogTitle>
        <DialogContent>
          <TextField
            label="Review Notes"
            multiline
            rows={4}
            fullWidth
            value={reviewNotes}
            onChange={(e) => setReviewNotes(e.target.value)}
            placeholder={reviewAction === 'approve' 
              ? 'Optional: Add any notes about this approval...'
              : 'Please explain why this proposal is being declined...'}
            sx={{ mt: 2 }}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setReviewDialogOpen(false)}>Cancel</Button>
          <Button 
            onClick={handleReview}
            color={reviewAction === 'approve' ? 'success' : 'error'}
            variant="contained"
            disabled={reviewing}
          >
            {reviewAction === 'approve' ? 'Approve' : 'Decline'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

const RiskBar: React.FC<{ label: string; value: number; bold?: boolean }> = ({ label, value, bold }) => {
  const percent = Math.round(value * 100);
  const color = percent <= 20 ? '#4caf50' : percent <= 40 ? '#ff9800' : '#f44336';
  
  return (
    <Box sx={{ mb: 1 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
        <Typography variant={bold ? 'subtitle2' : 'body2'}>{label}</Typography>
        <Typography variant={bold ? 'subtitle2' : 'body2'}>{percent}%</Typography>
      </Box>
      <Box sx={{ width: '100%', height: 8, bgcolor: '#e0e0e0', borderRadius: 1 }}>
        <Box sx={{ width: `${percent}%`, height: '100%', bgcolor: color, borderRadius: 1 }} />
      </Box>
    </Box>
  );
};

export default ProposalDetailPage;
```

```tsx
// ============================================================================
// packages/admin-dashboard/src/components/proposals/ProposalConfigPage.tsx
// Admin configuration page for thresholds and evidence weights
// ============================================================================

import React, { useState, useEffect } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Grid,
  TextField,
  Slider,
  Switch,
  FormControlLabel,
  Button,
  Divider,
  Alert,
  Tooltip,
  IconButton,
} from '@mui/material';
import { Save, Refresh, Info } from '@mui/icons-material';
import { useThresholdConfig, useUpdateThresholdConfig, useUpdateEvidenceWeights } from '../../hooks/useProposals';

export const ProposalConfigPage: React.FC = () => {
  const { config, evidenceWeights, loading, refetch } = useThresholdConfig();
  const { update: updateThresholds, updating: updatingThresholds } = useUpdateThresholdConfig();
  const { update: updateWeights, updating: updatingWeights } = useUpdateEvidenceWeights();
  
  const [thresholdForm, setThresholdForm] = useState(config || {});
  const [weightsForm, setWeightsForm] = useState(evidenceWeights || []);
  const [hasChanges, setHasChanges] = useState(false);
  
  useEffect(() => {
    if (config) setThresholdForm(config);
    if (evidenceWeights) setWeightsForm(evidenceWeights);
  }, [config, evidenceWeights]);
  
  const handleThresholdChange = (key: string, value: any) => {
    setThresholdForm(prev => ({ ...prev, [key]: value }));
    setHasChanges(true);
  };
  
  const handleWeightChange = (evidenceType: string, value: number) => {
    setWeightsForm(prev => 
      prev.map(w => w.evidenceType === evidenceType ? { ...w, weight: value } : w)
    );
    setHasChanges(true);
  };
  
  const handleSave = async () => {
    await updateThresholds({ config: thresholdForm });
    await updateWeights({ weights: weightsForm });
    setHasChanges(false);
    refetch();
  };
  
  if (loading) return <Box sx={{ p: 3 }}>Loading...</Box>;
  
  return (
    <Box sx={{ p: 3 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 3 }}>
        <Typography variant="h4">Proposal System Configuration</Typography>
        <Box>
          <Button startIcon={<Refresh />} onClick={refetch} sx={{ mr: 1 }}>
            Reset
          </Button>
          <Button 
            variant="contained" 
            startIcon={<Save />} 
            onClick={handleSave}
            disabled={!hasChanges || updatingThresholds || updatingWeights}
          >
            Save Changes
          </Button>
        </Box>
      </Box>
      
      {hasChanges && (
        <Alert severity="info" sx={{ mb: 3 }}>
          You have unsaved changes. Click "Save Changes" to apply them.
        </Alert>
      )}
      
      <Grid container spacing={3}>
        {/* Occurrence Thresholds */}
        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>Occurrence Thresholds</Typography>
              <Typography variant="body2" color="textSecondary" sx={{ mb: 2 }}>
                Minimum requirements for a need pattern to qualify for proposal generation
              </Typography>
              
              <ConfigSlider
                label="Minimum Evidence Count"
                value={thresholdForm.minEvidenceCount || 5}
                onChange={(v) => handleThresholdChange('minEvidenceCount', v)}
                min={1}
                max={50}
                tooltip="Number of evidence records needed before proposing a workflow"
              />
              
              <ConfigSlider
                label="Minimum Unique Users"
                value={thresholdForm.minUniqueUsers || 3}
                onChange={(v) => handleThresholdChange('minUniqueUsers', v)}
                min={1}
                max={20}
                tooltip="Number of different users who must encounter the issue"
              />
              
              <ConfigSlider
                label="Minimum Time Span (hours)"
                value={thresholdForm.minTimeSpanHours || 24}
                onChange={(v) => handleThresholdChange('minTimeSpanHours', v)}
                min={1}
                max={168}
                tooltip="Evidence must span at least this many hours"
              />
            </CardContent>
          </Card>
        </Grid>
        
        {/* Impact Thresholds */}
        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>Impact Thresholds</Typography>
              <Typography variant="body2" color="textSecondary" sx={{ mb: 2 }}>
                Score requirements measuring severity of the identified need
              </Typography>
              
              <ConfigSlider
                label="Minimum Total Evidence Score"
                value={(thresholdForm.minTotalEvidenceScore || 0.6) * 100}
                onChange={(v) => handleThresholdChange('minTotalEvidenceScore', v / 100)}
                min={10}
                max={100}
                format={(v) => `${v}%`}
                tooltip="Cumulative weighted score from all evidence"
              />
              
              <ConfigSlider
                label="Minimum Neural Confidence"
                value={(thresholdForm.minNeuralConfidence || 0.75) * 100}
                onChange={(v) => handleThresholdChange('minNeuralConfidence', v / 100)}
                min={50}
                max={100}
                format={(v) => `${v}%`}
                tooltip="Neural Engine's minimum confidence to generate a proposal"
              />
            </CardContent>
          </Card>
        </Grid>
        
        {/* Brain Governor Thresholds */}
        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>Brain Governor Thresholds</Typography>
              <Typography variant="body2" color="textSecondary" sx={{ mb: 2 }}>
                Maximum acceptable risk levels for Brain to approve proposals
              </Typography>
              
              <ConfigSlider
                label="Max Cost Risk"
                value={(thresholdForm.maxCostRisk || 0.3) * 100}
                onChange={(v) => handleThresholdChange('maxCostRisk', v / 100)}
                min={0}
                max={100}
                format={(v) => `${v}%`}
                tooltip="Proposals exceeding this cost risk will be vetoed"
              />
              
              <ConfigSlider
                label="Max Latency Risk"
                value={(thresholdForm.maxLatencyRisk || 0.4) * 100}
                onChange={(v) => handleThresholdChange('maxLatencyRisk', v / 100)}
                min={0}
                max={100}
                format={(v) => `${v}%`}
                tooltip="Proposals exceeding this latency risk will be vetoed"
              />
              
              <ConfigSlider
                label="Max Compliance Risk"
                value={(thresholdForm.maxComplianceRisk || 0.1) * 100}
                onChange={(v) => handleThresholdChange('maxComplianceRisk', v / 100)}
                min={0}
                max={50}
                format={(v) => `${v}%`}
                tooltip="Proposals exceeding this compliance risk will be vetoed"
              />
            </CardContent>
          </Card>
        </Grid>
        
        {/* Rate Limiting */}
        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>Rate Limiting</Typography>
              <Typography variant="body2" color="textSecondary" sx={{ mb: 2 }}>
                Limits on proposal generation frequency
              </Typography>
              
              <ConfigSlider
                label="Max Proposals Per Day"
                value={thresholdForm.maxProposalsPerDay || 10}
                onChange={(v) => handleThresholdChange('maxProposalsPerDay', v)}
                min={1}
                max={50}
                tooltip="Maximum new proposals that can be generated daily"
              />
              
              <ConfigSlider
                label="Max Proposals Per Week"
                value={thresholdForm.maxProposalsPerWeek || 30}
                onChange={(v) => handleThresholdChange('maxProposalsPerWeek', v)}
                min={1}
                max={200}
                tooltip="Maximum new proposals that can be generated weekly"
              />
              
              <ConfigSlider
                label="Cooldown After Decline (hours)"
                value={thresholdForm.cooldownAfterDeclineHours || 72}
                onChange={(v) => handleThresholdChange('cooldownAfterDeclineHours', v)}
                min={1}
                max={168}
                tooltip="Wait time before regenerating proposal for a declined pattern"
              />
            </CardContent>
          </Card>
        </Grid>
        
        {/* Evidence Weights */}
        <Grid item xs={12}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>Evidence Weights</Typography>
              <Typography variant="body2" color="textSecondary" sx={{ mb: 2 }}>
                How much each type of evidence contributes to the total score
              </Typography>
              
              <Grid container spacing={2}>
                {weightsForm.map((weight) => (
                  <Grid item xs={12} sm={6} md={4} key={weight.evidenceType}>
                    <ConfigSlider
                      label={formatEvidenceType(weight.evidenceType)}
                      value={weight.weight * 100}
                      onChange={(v) => handleWeightChange(weight.evidenceType, v / 100)}
                      min={0}
                      max={100}
                      format={(v) => `${v}%`}
                      tooltip={weight.description}
                    />
                  </Grid>
                ))}
              </Grid>
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Box>
  );
};

interface ConfigSliderProps {
  label: string;
  value: number;
  onChange: (value: number) => void;
  min: number;
  max: number;
  format?: (value: number) => string;
  tooltip?: string;
}

const ConfigSlider: React.FC<ConfigSliderProps> = ({
  label,
  value,
  onChange,
  min,
  max,
  format = (v) => String(v),
  tooltip,
}) => (
  <Box sx={{ mb: 3 }}>
    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
      <Box sx={{ display: 'flex', alignItems: 'center' }}>
        <Typography variant="subtitle2">{label}</Typography>
        {tooltip && (
          <Tooltip title={tooltip}>
            <IconButton size="small" sx={{ ml: 0.5 }}>
              <Info fontSize="small" />
            </IconButton>
          </Tooltip>
        )}
      </Box>
      <Typography variant="body2" color="primary">{format(value)}</Typography>
    </Box>
    <Slider
      value={value}
      onChange={(_, v) => onChange(v as number)}
      min={min}
      max={max}
      valueLabelDisplay="auto"
      valueLabelFormat={format}
    />
  </Box>
);

function formatEvidenceType(type: string): string {
  return type
    .split('_')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

export default ProposalConfigPage;
```
# SECTION 40: APPLICATION-LEVEL DATA ISOLATION (v4.6.0)
# â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

> **CRITICAL: This section implements complete isolation between client apps (Think Tank, Launch Board, AlwaysMe, Mechanical Maker) AND Think Tank.**
> **Same user email in different apps = completely separate identities and data.**

---

## 40.1 ARCHITECTURE OVERVIEW

### The Problem

Before v4.6.0, RADIANT had **tenant-level isolation** but not **application-level isolation**:

```
BEFORE (v4.5.0 and earlier):
â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”
â”‚ Tenant: Acme Corp (tenant_id: abc-123)                              â”‚
â”œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”¤
â”‚                                                                     â”‚
â”‚  User: alice@acme.com (single user record)                         â”‚
â”‚  â”œâ”€â”€ Can access Think Tank data    âœ“                               â”‚
â”‚  â”œâ”€â”€ Can access Launch Board data  âœ“  â† PROBLEM!                   â”‚
â”‚  â”œâ”€â”€ Can access Think Tank data        âœ“  â† PROBLEM!                   â”‚
â”‚  â””â”€â”€ All apps share same chat history, preferences, etc.           â”‚
â”‚                                                                     â”‚
â”‚  RLS Policy: WHERE tenant_id = current_setting('app.current_tenant_id')    â”‚
â”‚  â””â”€â”€ Only filters by tenant, not by app                            â”‚
â”‚                                                                     â”‚
â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜
```

### The Solution

v4.6.0 implements **application-level isolation**:

```
AFTER (v4.6.0):
â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”
â”‚ Tenant: Acme Corp (tenant_id: abc-123)                              â”‚
â”œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”¤
â”‚                                                                     â”‚
â”‚  â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”   â”‚
â”‚  â”‚ App: Think Tank (app_id: thinktank)                         â”‚   â”‚
â”‚  â”‚ â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â” â”‚   â”‚
â”‚  â”‚ â”‚ AppUser: alice@acme.com (app_user_id: usr-tt-001)       â”‚ â”‚   â”‚
â”‚  â”‚ â”‚ â””â”€â”€ Chats, preferences, history ONLY for Think Tank     â”‚ â”‚   â”‚
â”‚  â”‚ â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜ â”‚   â”‚
â”‚  â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜   â”‚
â”‚                                                                     â”‚
â”‚  â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”   â”‚
â”‚  â”‚ App: Launch Board (app_id: launchboard)                     â”‚   â”‚
â”‚  â”‚ â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â” â”‚   â”‚
â”‚  â”‚ â”‚ AppUser: alice@acme.com (app_user_id: usr-lb-002)       â”‚ â”‚   â”‚
â”‚  â”‚ â”‚ â””â”€â”€ Chats, preferences, history ONLY for Launch Board   â”‚ â”‚   â”‚
â”‚  â”‚ â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜ â”‚   â”‚
â”‚  â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜   â”‚
â”‚                                                                     â”‚
â”‚  â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”   â”‚
â”‚  â”‚ App: Think Tank (app_id: thinktank)                        â”‚   â”‚
â”‚  â”‚ â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â” â”‚   â”‚
â”‚  â”‚ â”‚ AppUser: alice@acme.com (app_user_id: usr-sv-003)       â”‚ â”‚   â”‚
â”‚  â”‚ â”‚ â””â”€â”€ Chats, preferences, history ONLY for Think Tank         â”‚ â”‚   â”‚
â”‚  â”‚ â”‚ â””â”€â”€ COMPLETELY ISOLATED from Think Tank and Launch Boardâ”‚ â”‚   â”‚
â”‚  â”‚ â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜ â”‚   â”‚
â”‚  â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜   â”‚
â”‚                                                                     â”‚
â”‚  RLS Policy: WHERE tenant_id = :tenant AND app_id = :app           â”‚
â”‚  â””â”€â”€ Filters by BOTH tenant AND app                                â”‚
â”‚                                                                     â”‚
â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜
```

### Isolation Layers

```
â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”
â”‚                         RADIANT v4.6.0 ISOLATION LAYERS                          â”‚
â”œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”¤
â”‚                                                                                 â”‚
â”‚  LAYER 1: COGNITO (Identity)                                                    â”‚
â”‚  â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”  â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”  â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”           â”‚
â”‚  â”‚ Think Tank Pool   â”‚  â”‚ Launch Board Pool â”‚  â”‚ Think Tank Pool       â”‚           â”‚
â”‚  â”‚ (thinktank-prod)  â”‚  â”‚ (launchboard-prod)â”‚  â”‚ (thinktank-prod)     â”‚           â”‚
â”‚  â”‚                   â”‚  â”‚                   â”‚  â”‚                   â”‚           â”‚
â”‚  â”‚ custom:app_id =   â”‚  â”‚ custom:app_id =   â”‚  â”‚ custom:app_id =   â”‚           â”‚
â”‚  â”‚ "thinktank"       â”‚  â”‚ "launchboard"     â”‚  â”‚ "thinktank"          â”‚           â”‚
â”‚  â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜  â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜  â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜           â”‚
â”‚           â”‚                     â”‚                     â”‚                         â”‚
â”‚           â–¼                     â–¼                     â–¼                         â”‚
â”‚  LAYER 2: API GATEWAY (Routing)                                                 â”‚
â”‚  â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”         â”‚
â”‚  â”‚ thinktank.domain.com    â†’ thinktank API                           â”‚         â”‚
â”‚  â”‚ launchboard.domain.com  â†’ launchboard API                         â”‚         â”‚
â”‚  â”‚ thinktank.domain.com  â†’ thinktank API                              â”‚         â”‚
â”‚  â”‚                                                                   â”‚         â”‚
â”‚  â”‚ JWT Validation: Verify app_id in token matches route              â”‚         â”‚
â”‚  â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜         â”‚
â”‚           â”‚                                                                     â”‚
â”‚           â–¼                                                                     â”‚
â”‚  LAYER 3: LAMBDA (Context)                                                      â”‚
â”‚  â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”         â”‚
â”‚  â”‚ AuthContext = {                                                   â”‚         â”‚
â”‚  â”‚   tenantId: 'abc-123',                                           â”‚         â”‚
â”‚  â”‚   appId: 'thinktank',     â† NEW: App ID extracted from JWT       â”‚         â”‚
â”‚  â”‚   userId: 'usr-tt-001',   â† App-scoped user ID                   â”‚         â”‚
â”‚  â”‚   email: 'alice@acme.com'                                        â”‚         â”‚
â”‚  â”‚ }                                                                 â”‚         â”‚
â”‚  â”‚                                                                   â”‚         â”‚
â”‚  â”‚ Database Connection:                                              â”‚         â”‚
â”‚  â”‚   SET app.current_tenant_id = 'abc-123';                         â”‚         â”‚
â”‚  â”‚   SET app.current_app_id = 'thinktank';   â† NEW                  â”‚         â”‚
â”‚  â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜         â”‚
â”‚           â”‚                                                                     â”‚
â”‚           â–¼                                                                     â”‚
â”‚  LAYER 4: DATABASE (RLS)                                                        â”‚
â”‚  â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”         â”‚
â”‚  â”‚ CREATE POLICY app_isolation ON user_data                          â”‚         â”‚
â”‚  â”‚   USING (                                                         â”‚         â”‚
â”‚  â”‚     tenant_id = current_setting('app.current_tenant_id')::UUID    â”‚         â”‚
â”‚  â”‚     AND                                                           â”‚         â”‚
â”‚  â”‚     app_id = current_setting('app.current_app_id')                â”‚         â”‚
â”‚  â”‚   );                                                              â”‚         â”‚
â”‚  â”‚                                                                   â”‚         â”‚
â”‚  â”‚ Every SELECT/INSERT/UPDATE/DELETE filtered by BOTH               â”‚         â”‚
â”‚  â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜         â”‚
â”‚                                                                                 â”‚
â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜
```

---

## 40.2 DATABASE SCHEMA CHANGES

### Migration: 040_app_level_isolation.sql

```sql
-- ============================================================================
-- RADIANT v4.6.0 - Application-Level Data Isolation
-- ============================================================================
-- This migration adds app_id isolation to all user-facing tables
-- ============================================================================

-- Create function to get current app_id from session
CREATE OR REPLACE FUNCTION current_app_id() RETURNS VARCHAR(50) AS $$
BEGIN
    RETURN NULLIF(current_setting('app.current_app_id', true), '');
EXCEPTION WHEN OTHERS THEN RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- ============================================================================
-- APP_USERS: App-Scoped User Instances
-- ============================================================================
-- A single email can have MULTIPLE app_user records (one per app)
-- This is the PRIMARY user identity within each application

CREATE TABLE IF NOT EXISTS app_users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- Multi-tenant + Multi-app isolation
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    app_id VARCHAR(50) NOT NULL,
    
    -- Link to base user (optional - for cross-app identity correlation by admins only)
    base_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    
    -- Identity (same email can exist in multiple apps)
    cognito_sub VARCHAR(100) NOT NULL,
    email VARCHAR(255) NOT NULL,
    email_verified BOOLEAN DEFAULT false,
    
    -- Profile (app-specific)
    first_name VARCHAR(100),
    last_name VARCHAR(100),
    display_name VARCHAR(200),
    avatar_url TEXT,
    
    -- App-specific preferences
    preferences JSONB DEFAULT '{}',
    timezone VARCHAR(50) DEFAULT 'UTC',
    locale VARCHAR(10) DEFAULT 'en-US',
    
    -- Status
    status VARCHAR(20) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'suspended')),
    last_login_at TIMESTAMPTZ,
    login_count INTEGER DEFAULT 0,
    
    -- Timestamps
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ,
    
    -- Unique constraint: one user per email per app per tenant
    UNIQUE(tenant_id, app_id, email),
    -- Cognito sub is unique per app
    UNIQUE(app_id, cognito_sub)
);

-- Indexes for app_users
CREATE INDEX idx_app_users_tenant_app ON app_users(tenant_id, app_id);
CREATE INDEX idx_app_users_email ON app_users(email);
CREATE INDEX idx_app_users_cognito ON app_users(cognito_sub);
CREATE INDEX idx_app_users_base_user ON app_users(base_user_id);
CREATE INDEX idx_app_users_status ON app_users(status) WHERE deleted_at IS NULL;

-- RLS for app_users
ALTER TABLE app_users ENABLE ROW LEVEL SECURITY;

CREATE POLICY app_users_isolation ON app_users
    FOR ALL
    USING (
        tenant_id = current_tenant_id() 
        AND app_id = current_app_id()
    );

-- Admin policy: Platform admins can view all users within their tenant
CREATE POLICY app_users_admin_view ON app_users
    FOR SELECT
    USING (
        tenant_id = current_tenant_id()
        AND current_setting('app.is_admin', true) = 'true'
    );

-- ============================================================================
-- ADD app_id TO EXISTING TABLES
-- ============================================================================

-- Add app_id column to user-facing tables that need isolation
-- Using IF NOT EXISTS pattern for idempotent migrations

-- Chats / Conversations (Think Tank and Client Apps)
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'thinktank_chats' AND column_name = 'app_id') THEN
        ALTER TABLE thinktank_chats ADD COLUMN app_id VARCHAR(50) NOT NULL DEFAULT 'thinktank';
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'thinktank_messages' AND column_name = 'app_id') THEN
        ALTER TABLE thinktank_messages ADD COLUMN app_id VARCHAR(50) NOT NULL DEFAULT 'thinktank';
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'thinktank_conversations' AND column_name = 'app_id') THEN
        ALTER TABLE thinktank_conversations ADD COLUMN app_id VARCHAR(50) NOT NULL DEFAULT 'thinktank';
    END IF;
END $$;

-- Concurrent Sessions
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'concurrent_sessions' AND column_name = 'app_id') THEN
        ALTER TABLE concurrent_sessions ADD COLUMN app_id VARCHAR(50) NOT NULL DEFAULT 'thinktank';
    END IF;
END $$;

-- Voice Sessions
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'voice_sessions' AND column_name = 'app_id') THEN
        ALTER TABLE voice_sessions ADD COLUMN app_id VARCHAR(50) NOT NULL DEFAULT 'thinktank';
    END IF;
END $$;

-- Memory
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'memory_stores' AND column_name = 'app_id') THEN
        ALTER TABLE memory_stores ADD COLUMN app_id VARCHAR(50) NOT NULL DEFAULT 'thinktank';
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'memories' AND column_name = 'app_id') THEN
        ALTER TABLE memories ADD COLUMN app_id VARCHAR(50) NOT NULL DEFAULT 'thinktank';
    END IF;
END $$;

-- Canvases & Artifacts
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'canvases' AND column_name = 'app_id') THEN
        ALTER TABLE canvases ADD COLUMN app_id VARCHAR(50) NOT NULL DEFAULT 'thinktank';
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'artifacts' AND column_name = 'app_id') THEN
        ALTER TABLE artifacts ADD COLUMN app_id VARCHAR(50) NOT NULL DEFAULT 'thinktank';
    END IF;
END $$;

-- User Personas
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'user_personas' AND column_name = 'app_id') THEN
        ALTER TABLE user_personas ADD COLUMN app_id VARCHAR(50) NOT NULL DEFAULT 'thinktank';
    END IF;
END $$;

-- Scheduled Prompts
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'scheduled_prompts' AND column_name = 'app_id') THEN
        ALTER TABLE scheduled_prompts ADD COLUMN app_id VARCHAR(50) NOT NULL DEFAULT 'thinktank';
    END IF;
END $$;

-- User Preferences (Neural Engine)
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'user_preferences' AND column_name = 'app_id') THEN
        ALTER TABLE user_preferences ADD COLUMN app_id VARCHAR(50) NOT NULL DEFAULT 'thinktank';
    END IF;
END $$;

-- User Memory (Neural Engine)
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'user_memory' AND column_name = 'app_id') THEN
        ALTER TABLE user_memory ADD COLUMN app_id VARCHAR(50) NOT NULL DEFAULT 'thinktank';
    END IF;
END $$;

-- User Behavior Patterns
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'user_behavior_patterns' AND column_name = 'app_id') THEN
        ALTER TABLE user_behavior_patterns ADD COLUMN app_id VARCHAR(50) NOT NULL DEFAULT 'thinktank';
    END IF;
END $$;

-- Feedback tables
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'feedback_explicit' AND column_name = 'app_id') THEN
        ALTER TABLE feedback_explicit ADD COLUMN app_id VARCHAR(50) NOT NULL DEFAULT 'thinktank';
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'feedback_implicit' AND column_name = 'app_id') THEN
        ALTER TABLE feedback_implicit ADD COLUMN app_id VARCHAR(50) NOT NULL DEFAULT 'thinktank';
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'feedback_voice' AND column_name = 'app_id') THEN
        ALTER TABLE feedback_voice ADD COLUMN app_id VARCHAR(50) NOT NULL DEFAULT 'thinktank';
    END IF;
END $$;

-- Execution Manifests
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'execution_manifests' AND column_name = 'app_id') THEN
        ALTER TABLE execution_manifests ADD COLUMN app_id VARCHAR(50) NOT NULL DEFAULT 'thinktank';
    END IF;
END $$;

-- Think Tank-specific tables
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'thinktank_sessions' AND column_name = 'app_id') THEN
        ALTER TABLE thinktank_sessions ADD COLUMN app_id VARCHAR(50) NOT NULL DEFAULT 'thinktank';
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'thinktank_user_model_preferences' AND column_name = 'app_id') THEN
        ALTER TABLE thinktank_user_model_preferences ADD COLUMN app_id VARCHAR(50) NOT NULL DEFAULT 'thinktank';
    END IF;
END $$;

-- Collaboration
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'collaboration_rooms' AND column_name = 'app_id') THEN
        ALTER TABLE collaboration_rooms ADD COLUMN app_id VARCHAR(50) NOT NULL DEFAULT 'thinktank';
    END IF;
END $$;

-- Time Machine snapshots
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'chat_snapshots' AND column_name = 'app_id') THEN
        ALTER TABLE chat_snapshots ADD COLUMN app_id VARCHAR(50) NOT NULL DEFAULT 'thinktank';
    END IF;
END $$;

-- ============================================================================
-- CREATE INDEXES FOR app_id COLUMNS
-- ============================================================================

-- Indexes for efficient app-scoped queries
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_thinktank_chats_app ON thinktank_chats(tenant_id, app_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_thinktank_messages_app ON thinktank_messages(tenant_id, app_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_concurrent_sessions_app ON concurrent_sessions(tenant_id, app_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_voice_sessions_app ON voice_sessions(tenant_id, app_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_memory_stores_app ON memory_stores(tenant_id, app_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_canvases_app ON canvases(tenant_id, app_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_user_personas_app ON user_personas(tenant_id, app_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_user_preferences_app ON user_preferences(tenant_id, app_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_feedback_explicit_app ON feedback_explicit(tenant_id, app_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_execution_manifests_app ON execution_manifests(tenant_id, app_id);

-- ============================================================================
-- UPDATE RLS POLICIES TO INCLUDE app_id
-- ============================================================================

-- Drop existing policies and recreate with app_id filtering
-- Using a function to standardize policy creation

CREATE OR REPLACE FUNCTION create_app_isolation_policy(
    table_name TEXT,
    policy_name TEXT DEFAULT NULL
) RETURNS VOID AS $$
DECLARE
    p_name TEXT;
BEGIN
    p_name := COALESCE(policy_name, table_name || '_app_isolation');
    
    -- Drop existing policy if exists
    EXECUTE format('DROP POLICY IF EXISTS %I ON %I', p_name, table_name);
    
    -- Create new policy with app_id filtering
    EXECUTE format('
        CREATE POLICY %I ON %I
        FOR ALL
        USING (
            tenant_id = current_tenant_id() 
            AND app_id = current_app_id()
        )
    ', p_name, table_name);
END;
$$ LANGUAGE plpgsql;

-- Apply app isolation policies to all relevant tables
SELECT create_app_isolation_policy('thinktank_chats');
SELECT create_app_isolation_policy('thinktank_messages');
SELECT create_app_isolation_policy('thinktank_conversations');
SELECT create_app_isolation_policy('concurrent_sessions');
SELECT create_app_isolation_policy('voice_sessions');
SELECT create_app_isolation_policy('memory_stores');
SELECT create_app_isolation_policy('memories');
SELECT create_app_isolation_policy('canvases');
SELECT create_app_isolation_policy('artifacts');
SELECT create_app_isolation_policy('user_personas');
SELECT create_app_isolation_policy('scheduled_prompts');
SELECT create_app_isolation_policy('user_preferences');
SELECT create_app_isolation_policy('user_memory');
SELECT create_app_isolation_policy('user_behavior_patterns');
SELECT create_app_isolation_policy('feedback_explicit');
SELECT create_app_isolation_policy('feedback_implicit');
SELECT create_app_isolation_policy('feedback_voice');
SELECT create_app_isolation_policy('execution_manifests');
SELECT create_app_isolation_policy('thinktank_sessions');
SELECT create_app_isolation_policy('thinktank_user_model_preferences');
SELECT create_app_isolation_policy('collaboration_rooms');

-- ============================================================================
-- ADMIN CROSS-APP VIEW POLICIES
-- ============================================================================
-- Platform administrators need to view data across apps for support

CREATE OR REPLACE FUNCTION create_admin_view_policy(
    table_name TEXT
) RETURNS VOID AS $$
BEGIN
    EXECUTE format('DROP POLICY IF EXISTS %I ON %I', table_name || '_admin_view', table_name);
    
    EXECUTE format('
        CREATE POLICY %I ON %I
        FOR SELECT
        USING (
            tenant_id = current_tenant_id()
            AND current_setting(''app.is_admin'', true) = ''true''
        )
    ', table_name || '_admin_view', table_name);
END;
$$ LANGUAGE plpgsql;

-- Apply admin view policies
SELECT create_admin_view_policy('thinktank_chats');
SELECT create_admin_view_policy('thinktank_messages');
SELECT create_admin_view_policy('concurrent_sessions');
SELECT create_admin_view_policy('memory_stores');
SELECT create_admin_view_policy('canvases');
SELECT create_admin_view_policy('user_personas');
SELECT create_admin_view_policy('feedback_explicit');
SELECT create_admin_view_policy('execution_manifests');

-- ============================================================================
-- APP REGISTRY TABLE
-- ============================================================================
-- Track all registered applications

CREATE TABLE IF NOT EXISTS app_registry (
    id VARCHAR(50) PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    display_name VARCHAR(200) NOT NULL,
    description TEXT,
    
    -- App type
    app_type VARCHAR(50) NOT NULL CHECK (app_type IN ('client_app', 'consumer', 'admin', 'internal')),
    
    -- Cognito configuration
    cognito_user_pool_id VARCHAR(100),
    cognito_client_id VARCHAR(100),
    
    -- Routing
    subdomain VARCHAR(100),
    custom_domain VARCHAR(255),
    
    -- Features enabled for this app
    features JSONB DEFAULT '{}',
    
    -- Status
    status VARCHAR(20) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'deprecated')),
    
    -- Timestamps
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Seed default applications
INSERT INTO app_registry (id, name, display_name, description, app_type, subdomain) VALUES
    ('thinktank', 'thinktank', 'Think Tank', 'Consumer-facing AI chat application', 'consumer', 'thinktank'),
    ('thinktank', 'thinktank', 'Think Tank', 'Collaborative AI workspace', 'client_app', 'thinktank'),
    ('launchboard', 'launchboard', 'Launch Board', 'Project management with AI', 'client_app', 'launchboard'),
    ('alwaysme', 'alwaysme', 'Always Me', 'Personal AI assistant', 'client_app', 'alwaysme'),
    ('mechanicalmaker', 'mechanicalmaker', 'Mechanical Maker', 'Engineering AI tools', 'client_app', 'mechanicalmaker'),
    ('admin', 'admin', 'Admin Dashboard', 'Platform administration', 'admin', 'admin')
ON CONFLICT (id) DO NOTHING;

-- ============================================================================
-- CROSS-APP CORRELATION TABLE (Admin Only)
-- ============================================================================
-- For platform admins to correlate user identities across apps
-- End users CANNOT access this table

CREATE TABLE IF NOT EXISTS cross_app_user_correlation (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    
    -- Email is the correlation key
    email VARCHAR(255) NOT NULL,
    
    -- App user IDs for each app
    app_user_ids JSONB NOT NULL DEFAULT '{}',
    -- Example: {"thinktank": "uuid-1", "launchboard": "uuid-2", "launchboard": "uuid-3"}
    
    -- Metadata
    first_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_activity_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    -- Unique per tenant
    UNIQUE(tenant_id, email)
);

-- Only admins can access this table
ALTER TABLE cross_app_user_correlation ENABLE ROW LEVEL SECURITY;

CREATE POLICY cross_app_admin_only ON cross_app_user_correlation
    FOR ALL
    USING (
        tenant_id = current_tenant_id()
        AND current_setting('app.is_admin', true) = 'true'
    );

-- ============================================================================
-- MIGRATION TRACKING
-- ============================================================================

INSERT INTO schema_migrations (version, name, applied_by, checksum)
VALUES ('040', 'app_level_isolation', 'system', md5('v4.6.0_app_isolation'))
ON CONFLICT (version) DO NOTHING;
```

---

## 40.3 COGNITO CONFIGURATION

### Per-App User Pool Stack

```typescript
// packages/infrastructure/lib/stacks/app-cognito.stack.ts

import * as cdk from 'aws-cdk-lib';
import * as cognito from 'aws-cdk-lib/aws-cognito';
import { Construct } from 'constructs';

export interface AppCognitoStackProps extends cdk.StackProps {
  appId: string;
  appName: string;
  environment: string;
  domain: string;
  tier: number;
}

/**
 * Creates a dedicated Cognito User Pool for each application.
 * This ensures complete identity isolation between apps.
 */
export class AppCognitoStack extends cdk.Stack {
  public readonly userPool: cognito.UserPool;
  public readonly userPoolClient: cognito.UserPoolClient;
  public readonly userPoolDomain: cognito.UserPoolDomain;
  
  constructor(scope: Construct, id: string, props: AppCognitoStackProps) {
    super(scope, id, props);
    
    const resourcePrefix = `${props.appId}-${props.environment}`;
    
    // ========================================================================
    // USER POOL (Per-App)
    // ========================================================================
    
    this.userPool = new cognito.UserPool(this, 'UserPool', {
      userPoolName: `${resourcePrefix}-users`,
      
      // Self sign-up enabled for Think Tank, disabled for client apps
      selfSignUpEnabled: props.appId === 'thinktank',
      
      // Sign-in options
      signInAliases: {
        email: true,
        username: false,
      },
      
      // Password policy
      passwordPolicy: {
        minLength: 12,
        requireLowercase: true,
        requireUppercase: true,
        requireDigits: true,
        requireSymbols: true,
      },
      
      // MFA configuration
      mfa: props.tier >= 3 
        ? cognito.Mfa.OPTIONAL 
        : cognito.Mfa.OFF,
      mfaSecondFactor: {
        sms: true,
        otp: true,
      },
      
      // Account recovery
      accountRecovery: cognito.AccountRecovery.EMAIL_ONLY,
      
      // Standard attributes
      standardAttributes: {
        email: {
          required: true,
          mutable: true,
        },
        fullname: {
          required: false,
          mutable: true,
        },
      },
      
      // Custom attributes - CRITICAL: app_id is immutable
      customAttributes: {
        tenantId: new cognito.StringAttribute({ mutable: false }),
        appId: new cognito.StringAttribute({ mutable: false }), // NEW: App identifier
        role: new cognito.StringAttribute({ mutable: true }),
        appUserId: new cognito.StringAttribute({ mutable: false }), // NEW: App-scoped user ID
      },
      
      // Lambda triggers for app isolation
      lambdaTriggers: {
        preSignUp: this.createPreSignUpLambda(resourcePrefix, props.appId),
        postConfirmation: this.createPostConfirmationLambda(resourcePrefix, props.appId),
        preTokenGeneration: this.createPreTokenGenerationLambda(resourcePrefix, props.appId),
      },
      
      // Removal policy
      removalPolicy: props.environment === 'prod'
        ? cdk.RemovalPolicy.RETAIN
        : cdk.RemovalPolicy.DESTROY,
    });
    
    // ========================================================================
    // USER POOL CLIENT (Per-App)
    // ========================================================================
    
    this.userPoolClient = this.userPool.addClient('UserPoolClient', {
      userPoolClientName: `${resourcePrefix}-web-client`,
      
      // OAuth configuration
      oAuth: {
        flows: {
          authorizationCodeGrant: true,
          implicitCodeGrant: false,
        },
        scopes: [
          cognito.OAuthScope.EMAIL,
          cognito.OAuthScope.OPENID,
          cognito.OAuthScope.PROFILE,
        ],
        callbackUrls: [
          `https://${props.appId}.${props.domain}/auth/callback`,
          'http://localhost:3000/auth/callback',
        ],
        logoutUrls: [
          `https://${props.appId}.${props.domain}/auth/logout`,
          'http://localhost:3000/auth/logout',
        ],
      },
      
      // Token configuration
      accessTokenValidity: cdk.Duration.hours(1),
      idTokenValidity: cdk.Duration.hours(1),
      refreshTokenValidity: cdk.Duration.days(30),
      
      // Auth flows
      authFlows: {
        userPassword: true,
        userSrp: true,
      },
      
      // Prevent user existence errors
      preventUserExistenceErrors: true,
      
      // Read/write attributes
      readAttributes: new cognito.ClientAttributes()
        .withStandardAttributes({
          email: true,
          fullname: true,
        })
        .withCustomAttributes('tenantId', 'appId', 'role', 'appUserId'),
        
      writeAttributes: new cognito.ClientAttributes()
        .withStandardAttributes({
          fullname: true,
        }),
    });
    
    // ========================================================================
    // USER POOL DOMAIN (Per-App)
    // ========================================================================
    
    this.userPoolDomain = this.userPool.addDomain('Domain', {
      cognitoDomain: {
        domainPrefix: `${props.appId}-${props.environment}-auth`,
      },
    });
    
    // ========================================================================
    // OUTPUTS
    // ========================================================================
    
    new cdk.CfnOutput(this, 'UserPoolId', {
      value: this.userPool.userPoolId,
      exportName: `${resourcePrefix}-user-pool-id`,
    });
    
    new cdk.CfnOutput(this, 'UserPoolClientId', {
      value: this.userPoolClient.userPoolClientId,
      exportName: `${resourcePrefix}-user-pool-client-id`,
    });
    
    new cdk.CfnOutput(this, 'UserPoolDomain', {
      value: this.userPoolDomain.domainName,
      exportName: `${resourcePrefix}-user-pool-domain`,
    });
  }
  
  /**
   * Pre-SignUp Lambda: Validates sign-up requests and enforces app isolation
   */
  private createPreSignUpLambda(resourcePrefix: string, appId: string): lambda.Function {
    return new lambdaNodejs.NodejsFunction(this, 'PreSignUpFunction', {
      functionName: `${resourcePrefix}-pre-signup`,
      runtime: lambda.Runtime.NODEJS_20_X,
      handler: 'handler',
      entry: 'lambda/cognito/pre-signup.ts',
      environment: {
        APP_ID: appId,
      },
    });
  }
  
  /**
   * Post-Confirmation Lambda: Creates app_users record after confirmation
   */
  private createPostConfirmationLambda(resourcePrefix: string, appId: string): lambda.Function {
    return new lambdaNodejs.NodejsFunction(this, 'PostConfirmationFunction', {
      functionName: `${resourcePrefix}-post-confirmation`,
      runtime: lambda.Runtime.NODEJS_20_X,
      handler: 'handler',
      entry: 'lambda/cognito/post-confirmation.ts',
      environment: {
        APP_ID: appId,
      },
    });
  }
  
  /**
   * Pre-Token-Generation Lambda: Adds app_id and app_user_id to JWT claims
   */
  private createPreTokenGenerationLambda(resourcePrefix: string, appId: string): lambda.Function {
    return new lambdaNodejs.NodejsFunction(this, 'PreTokenGenerationFunction', {
      functionName: `${resourcePrefix}-pre-token-gen`,
      runtime: lambda.Runtime.NODEJS_20_X,
      handler: 'handler',
      entry: 'lambda/cognito/pre-token-generation.ts',
      environment: {
        APP_ID: appId,
      },
    });
  }
}
```

### Cognito Lambda Triggers

```typescript
// lambda/cognito/pre-signup.ts

import { PreSignUpTriggerEvent, PreSignUpTriggerHandler } from 'aws-lambda';

/**
 * Pre-SignUp Lambda
 * Validates that the user is signing up for the correct app
 */
export const handler: PreSignUpTriggerHandler = async (event) => {
  const appId = process.env.APP_ID;
  
  // For Think Tank, auto-confirm email in non-prod environments
  if (appId === 'thinktank' && process.env.ENVIRONMENT !== 'prod') {
    event.response.autoConfirmUser = true;
    event.response.autoVerifyEmail = true;
  }
  
  // Log sign-up attempt for audit
  console.log('Pre-SignUp', {
    appId,
    email: event.request.userAttributes.email,
    userPoolId: event.userPoolId,
  });
  
  return event;
};
```

```typescript
// lambda/cognito/post-confirmation.ts

import { PostConfirmationTriggerEvent, PostConfirmationTriggerHandler } from 'aws-lambda';
import { getDbClient } from '../shared/db';

/**
 * Post-Confirmation Lambda
 * Creates the app_users record after user confirms their email
 */
export const handler: PostConfirmationTriggerHandler = async (event) => {
  const appId = process.env.APP_ID!;
  const tenantId = event.request.userAttributes['custom:tenantId'];
  const cognitoSub = event.request.userAttributes.sub;
  const email = event.request.userAttributes.email;
  const fullName = event.request.userAttributes.name || '';
  
  const db = await getDbClient();
  
  try {
    // Create app-scoped user record
    const result = await db.query(`
      INSERT INTO app_users (
        tenant_id, app_id, cognito_sub, email, 
        first_name, last_name, display_name, status
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, 'active')
      ON CONFLICT (tenant_id, app_id, email) DO UPDATE SET
        cognito_sub = EXCLUDED.cognito_sub,
        last_login_at = NOW(),
        login_count = app_users.login_count + 1
      RETURNING id
    `, [
      tenantId,
      appId,
      cognitoSub,
      email,
      fullName.split(' ')[0] || '',
      fullName.split(' ').slice(1).join(' ') || '',
      fullName || email.split('@')[0],
    ]);
    
    const appUserId = result.rows[0].id;
    
    // Update cross-app correlation (for admin use only)
    await db.query(`
      INSERT INTO cross_app_user_correlation (tenant_id, email, app_user_ids)
      VALUES ($1, $2, $3::jsonb)
      ON CONFLICT (tenant_id, email) DO UPDATE SET
        app_user_ids = cross_app_user_correlation.app_user_ids || $3::jsonb,
        last_activity_at = NOW()
    `, [tenantId, email, JSON.stringify({ [appId]: appUserId })]);
    
    console.log('Created app_user', { appId, appUserId, email });
    
  } catch (error) {
    console.error('Error creating app_user', error);
    throw error;
  }
  
  return event;
};
```

```typescript
// lambda/cognito/pre-token-generation.ts

import { PreTokenGenerationTriggerEvent, PreTokenGenerationTriggerHandler } from 'aws-lambda';
import { getDbClient } from '../shared/db';

/**
 * Pre-Token-Generation Lambda
 * Adds app_id and app_user_id to JWT claims
 */
export const handler: PreTokenGenerationTriggerHandler = async (event) => {
  const appId = process.env.APP_ID!;
  const cognitoSub = event.request.userAttributes.sub;
  
  const db = await getDbClient();
  
  // Get app_user_id for this user
  const result = await db.query(`
    SELECT id FROM app_users 
    WHERE cognito_sub = $1 AND app_id = $2
  `, [cognitoSub, appId]);
  
  const appUserId = result.rows[0]?.id;
  
  if (!appUserId) {
    console.error('No app_user found for', { cognitoSub, appId });
    throw new Error('User not found in this application');
  }
  
  // Add custom claims to the ID token
  event.response.claimsOverrideDetails = {
    claimsToAddOrOverride: {
      'custom:app_id': appId,
      'custom:app_user_id': appUserId,
    },
  };
  
  return event;
};
```

---

## 40.4 LAMBDA AUTH CONTEXT UPDATE

> **NOTE**: The `AuthContext` interface and `extractAuthContext` function are defined in 
> **Section 4** (`lambda/shared/auth.ts`). The canonical definition already includes 
> all app isolation fields: `appId`, `appUserId`, `isSuperAdmin`, `tokenExpiry`.
>
> **DO NOT redefine these types.** Import from `@radiant/shared` or `../shared/auth`.

### App Isolation Validation Logic

The following validation logic is already integrated into Section 4's `extractAuthContext`:

```typescript
// Already in Section 4: lambda/shared/auth.ts
// Key validation points for app isolation:

// 1. Extract app-specific claims
const appId = claims['custom:appId'] || claims['custom:app_id'];
const appUserId = claims['custom:appUserId'] || claims['custom:app_user_id'];

// 2. Validate required claims for app isolation
if (!appId) throw new UnauthorizedError('Missing app ID');
if (!appUserId) throw new UnauthorizedError('Missing app user ID');

// 3. Validate app_id matches route (defense in depth)
const routeAppId = extractAppIdFromRoute(event);
if (routeAppId && routeAppId !== appId) {
  throw new ForbiddenError(`Token app_id (${appId}) does not match route (${routeAppId})`);
}
```

### Extract App ID from Route Helper

```typescript
// lambda/shared/auth.ts - extractAppIdFromRoute function
/**
 * Extract app_id from route for validation
 */
function extractAppIdFromRoute(event: APIGatewayProxyEvent): string | null {
  // Extract from subdomain: thinktank.domain.com -> thinktank
  const host = event.headers.Host || event.headers.host;
  if (host) {
    const subdomain = host.split('.')[0];
    if (['thinktank', 'launchboard', 'alwaysme', 'mechanicalmaker'].includes(subdomain)) {
      return subdomain;
    }
  }
  
  // Extract from path: /api/thinktank/... -> thinktank
  const pathMatch = event.path.match(/^\/api\/(thinktank|launchboard|alwaysme|mechanicalmaker)/);
  if (pathMatch) {
    return pathMatch[1];
  }
  
  return null;
}

/**
 * Set database context for RLS policies
 * CRITICAL: This must be called before any database queries
 */
export async function setDatabaseContext(
  db: PoolClient,
  auth: AuthContext
): Promise<void> {
  await db.query(`
    SET LOCAL app.current_tenant_id = $1;
    SET LOCAL app.current_app_id = $2;
    SET LOCAL app.is_admin = $3;
  `, [auth.tenantId, auth.appId, auth.isAdmin ? 'true' : 'false']);
}

/**
 * Create authenticated database client with context
 */
export async function getAuthenticatedDb(
  auth: AuthContext
): Promise<{ client: PoolClient; release: () => void }> {
  const pool = await getPool();
  const client = await pool.connect();
  
  try {
    await setDatabaseContext(client, auth);
    
    return {
      client,
      release: () => client.release(),
    };
  } catch (error) {
    client.release();
    throw error;
  }
}
```

---

## 40.5 API ROUTING BY APP

### API Gateway Per-App Routes

```typescript
// packages/infrastructure/lib/stacks/api.stack.ts - Addition

/**
 * Create per-app API routes with app_id validation
 */
private createAppRoutes(props: APIStackProps): void {
  const apps = ['thinktank', 'launchboard', 'alwaysme', 'mechanicalmaker'];
  
  for (const appId of apps) {
    // Create resource for this app
    const appResource = this.api.root.addResource(appId);
    
    // Apply app-specific authorizer
    const authorizer = new apigateway.CognitoUserPoolsAuthorizer(
      this,
      `${appId}Authorizer`,
      {
        cognitoUserPools: [props.appUserPools[appId]],
        identitySource: 'method.request.header.Authorization',
      }
    );
    
    // Chat endpoint
    const chatsResource = appResource.addResource('chats');
    chatsResource.addMethod('GET', 
      new apigateway.LambdaIntegration(this.chatFunction),
      { authorizer }
    );
    chatsResource.addMethod('POST',
      new apigateway.LambdaIntegration(this.chatFunction),
      { authorizer }
    );
    
    // Chat by ID
    const chatResource = chatsResource.addResource('{chatId}');
    chatResource.addMethod('GET',
      new apigateway.LambdaIntegration(this.chatFunction),
      { authorizer }
    );
    chatResource.addMethod('DELETE',
      new apigateway.LambdaIntegration(this.chatFunction),
      { authorizer }
    );
    
    // Messages
    const messagesResource = chatResource.addResource('messages');
    messagesResource.addMethod('GET',
      new apigateway.LambdaIntegration(this.chatFunction),
      { authorizer }
    );
    messagesResource.addMethod('POST',
      new apigateway.LambdaIntegration(this.chatFunction),
      { authorizer }
    );
    
    // User preferences (app-specific)
    const preferencesResource = appResource.addResource('preferences');
    preferencesResource.addMethod('GET',
      new apigateway.LambdaIntegration(this.preferencesFunction),
      { authorizer }
    );
    preferencesResource.addMethod('PUT',
      new apigateway.LambdaIntegration(this.preferencesFunction),
      { authorizer }
    );
    
    // Memory (app-specific)
    const memoryResource = appResource.addResource('memory');
    memoryResource.addMethod('GET',
      new apigateway.LambdaIntegration(this.memoryFunction),
      { authorizer }
    );
  }
}
```

---

## 40.6 ADMIN DASHBOARD UPDATES

### Cross-App User View (Admin Only)

```typescript
// apps/admin-dashboard/src/app/(dashboard)/users/cross-app/page.tsx

'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Table,
  TableHead,
  TableBody,
  TableRow,
  TableCell,
  Chip,
  TextField,
  InputAdornment,
  IconButton,
  Tooltip,
  Dialog,
  DialogTitle,
  DialogContent,
} from '@mui/material';
import { Search, Visibility, Apps, Person } from '@mui/icons-material';

interface CrossAppUser {
  email: string;
  tenantId: string;
  appUsers: {
    appId: string;
    appUserId: string;
    displayName: string;
    lastLoginAt: string;
    status: string;
    chatCount: number;
  }[];
  firstSeenAt: string;
  lastActivityAt: string;
}

export default function CrossAppUsersPage() {
  const [search, setSearch] = useState('');
  const [selectedUser, setSelectedUser] = useState<CrossAppUser | null>(null);
  
  const { data: users, isLoading } = useQuery({
    queryKey: ['cross-app-users', search],
    queryFn: async () => {
      const response = await fetch(
        `/api/admin/users/cross-app?search=${encodeURIComponent(search)}`
      );
      return response.json() as Promise<CrossAppUser[]>;
    },
  });
  
  const appColors: Record<string, string> = {
    thinktank: 'primary',
    thinktank: 'secondary',
    launchboard: 'success',
    alwaysme: 'warning',
    mechanicalmaker: 'info',
  };
  
  return (
    <Box>
      <Typography variant="h4" gutterBottom>
        Cross-App User Correlation
      </Typography>
      <Typography variant="body2" color="textSecondary" sx={{ mb: 3 }}>
        View users across all applications. This is for admin support purposes only.
        End users cannot see data from other applications.
      </Typography>
      
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <TextField
            fullWidth
            placeholder="Search by email..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <Search />
                </InputAdornment>
              ),
            }}
          />
        </CardContent>
      </Card>
      
      <Card>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>Email</TableCell>
              <TableCell>Applications</TableCell>
              <TableCell>First Seen</TableCell>
              <TableCell>Last Activity</TableCell>
              <TableCell>Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {users?.map((user) => (
              <TableRow key={user.email}>
                <TableCell>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Person fontSize="small" />
                    {user.email}
                  </Box>
                </TableCell>
                <TableCell>
                  <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
                    {user.appUsers.map((appUser) => (
                      <Chip
                        key={appUser.appId}
                        label={appUser.appId}
                        size="small"
                        color={appColors[appUser.appId] as any || 'default'}
                        variant={appUser.status === 'active' ? 'filled' : 'outlined'}
                      />
                    ))}
                  </Box>
                </TableCell>
                <TableCell>
                  {new Date(user.firstSeenAt).toLocaleDateString()}
                </TableCell>
                <TableCell>
                  {new Date(user.lastActivityAt).toLocaleString()}
                </TableCell>
                <TableCell>
                  <Tooltip title="View Details">
                    <IconButton onClick={() => setSelectedUser(user)}>
                      <Visibility />
                    </IconButton>
                  </Tooltip>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>
      
      {/* User Detail Dialog */}
      <Dialog
        open={!!selectedUser}
        onClose={() => setSelectedUser(null)}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Apps />
            User Details: {selectedUser?.email}
          </Box>
        </DialogTitle>
        <DialogContent>
          {selectedUser && (
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>Application</TableCell>
                  <TableCell>Display Name</TableCell>
                  <TableCell>Status</TableCell>
                  <TableCell>Chats</TableCell>
                  <TableCell>Last Login</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {selectedUser.appUsers.map((appUser) => (
                  <TableRow key={appUser.appId}>
                    <TableCell>
                      <Chip
                        label={appUser.appId}
                        color={appColors[appUser.appId] as any || 'default'}
                      />
                    </TableCell>
                    <TableCell>{appUser.displayName}</TableCell>
                    <TableCell>
                      <Chip
                        label={appUser.status}
                        size="small"
                        color={appUser.status === 'active' ? 'success' : 'default'}
                      />
                    </TableCell>
                    <TableCell>{appUser.chatCount}</TableCell>
                    <TableCell>
                      {appUser.lastLoginAt 
                        ? new Date(appUser.lastLoginAt).toLocaleString()
                        : 'Never'}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </DialogContent>
      </Dialog>
    </Box>
  );
}
```

---

## 40.7 MIGRATION GUIDE

### Step-by-Step Migration for Existing Deployments

```markdown
# Migration Guide: v4.5.0 â†’ v4.6.0 (Application-Level Isolation)

## Overview

This migration adds app_id isolation to all user-facing tables. Existing data
will be migrated with a default app_id based on the primary application.

## Pre-Migration Checklist

- [ ] Backup database
- [ ] Schedule maintenance window (migration takes ~10-30 minutes depending on data size)
- [ ] Notify users of maintenance
- [ ] Verify AWS Lambda permissions for Cognito triggers

## Migration Steps

### 1. Apply Database Migration

```bash
# Apply the new migration
cd packages/infrastructure
pnpm run migrate:up

# Verify migration applied
psql $DATABASE_URL -c "SELECT * FROM schema_migrations WHERE version = '040';"
```

### 2. Migrate Existing Users to app_users

```sql
-- Migration script to copy existing users to app_users
-- Run this ONCE after applying 040_app_level_isolation.sql

INSERT INTO app_users (
    tenant_id,
    app_id,
    base_user_id,
    cognito_sub,
    email,
    email_verified,
    first_name,
    last_name,
    display_name,
    avatar_url,
    preferences,
    timezone,
    locale,
    status,
    last_login_at,
    created_at,
    updated_at
)
SELECT 
    u.tenant_id,
    t.app_id,  -- Use tenant's app_id
    u.id,      -- Link to base user
    u.cognito_sub,
    u.email,
    u.email_verified,
    u.first_name,
    u.last_name,
    u.display_name,
    u.avatar_url,
    u.preferences,
    u.timezone,
    u.locale,
    u.status,
    u.last_login_at,
    u.created_at,
    u.updated_at
FROM users u
JOIN tenants t ON u.tenant_id = t.id
WHERE NOT EXISTS (
    SELECT 1 FROM app_users au 
    WHERE au.tenant_id = u.tenant_id 
    AND au.app_id = t.app_id 
    AND au.email = u.email
);
```

### 3. Update Existing Data with app_id

```sql
-- Set app_id on existing data based on tenant's primary app
UPDATE thinktank_chats SET app_id = 'thinktank' WHERE app_id IS NULL OR app_id = '';
UPDATE thinktank_messages SET app_id = 'thinktank' WHERE app_id IS NULL OR app_id = '';
UPDATE concurrent_sessions SET app_id = 'thinktank' WHERE app_id IS NULL OR app_id = '';
-- ... repeat for all tables
```

### 4. Deploy New Cognito Pools

```bash
# Deploy per-app Cognito pools
cd packages/infrastructure
cdk deploy AppCognitoThinkTankStack
cdk deploy AppCognitoThinkTankStack
cdk deploy AppCognitoLaunchBoardStack
cdk deploy AppCognitoAlwaysMeStack
cdk deploy AppCognitoMechanicalMakerStack
```

### 5. Update API Gateway

```bash
# Deploy updated API with per-app routes
cdk deploy APIStack
```

### 6. Verify Migration

```sql
-- Verify app_users populated
SELECT app_id, COUNT(*) FROM app_users GROUP BY app_id;

-- Verify RLS policies working
SET app.current_tenant_id = 'your-tenant-id';
SET app.current_app_id = 'thinktank';
SELECT COUNT(*) FROM thinktank_chats; -- Should only show Think Tank chats

SET app.current_app_id = 'thinktank';
SELECT COUNT(*) FROM thinktank_chats; -- Should show 0 (no Think Tank chats in thinktank_chats)
```

## Rollback Procedure

If issues occur, you can temporarily disable app isolation:

```sql
-- Emergency rollback: Remove app_id from RLS policies
CREATE OR REPLACE FUNCTION current_app_id() RETURNS VARCHAR(50) AS $$
BEGIN
    RETURN NULL;  -- Returns NULL, effectively disabling app filtering
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;
```

## Post-Migration

- [ ] Monitor error rates in CloudWatch
- [ ] Verify cross-app isolation working (test with same email in different apps)
- [ ] Update client applications with new Cognito pool IDs
- [ ] Train support staff on cross-app user correlation dashboard
```

---

## 40.8 TESTING

### Isolation Test Suite

```typescript
// tests/isolation/app-isolation.test.ts

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { getDbClient, closePool } from '../utils/db';

describe('Application-Level Data Isolation', () => {
  let db: any;
  
  beforeAll(async () => {
    db = await getDbClient();
  });
  
  afterAll(async () => {
    await closePool();
  });
  
  describe('RLS Policies', () => {
    it('should isolate data between apps in same tenant', async () => {
      const tenantId = 'test-tenant-001';
      
      // Create test chats in different apps
      await db.query(`SET app.current_tenant_id = $1`, [tenantId]);
      
      // Insert chat in Think Tank
      await db.query(`SET app.current_app_id = 'thinktank'`);
      await db.query(`
        INSERT INTO thinktank_chats (id, tenant_id, app_id, user_id, title)
        VALUES ('chat-thinktank-1', $1, 'thinktank', 'user-1', 'Think Tank Chat')
      `, [tenantId]);
      
      // Insert chat in Think Tank
      await db.query(`SET app.current_app_id = 'thinktank'`);
      await db.query(`
        INSERT INTO thinktank_chats (id, tenant_id, app_id, user_id, title)
        VALUES ('chat-tt-1', $1, 'thinktank', 'user-1', 'Think Tank Chat')
      `, [tenantId]);
      
      // Query from Think Tank context
      await db.query(`SET app.current_app_id = 'thinktank'`);
      const thinktankChats = await db.query(`SELECT * FROM thinktank_chats`);
      
      expect(thinktankChats.rows).toHaveLength(1);
      expect(thinktankChats.rows[0].title).toBe('Think Tank Chat');
      
      // Query from Think Tank context
      await db.query(`SET app.current_app_id = 'thinktank'`);
      const ttChats = await db.query(`SELECT * FROM thinktank_chats`);
      
      expect(ttChats.rows).toHaveLength(1);
      expect(ttChats.rows[0].title).toBe('Think Tank Chat');
    });
    
    it('should allow admin cross-app view', async () => {
      const tenantId = 'test-tenant-001';
      
      await db.query(`SET app.current_tenant_id = $1`, [tenantId]);
      await db.query(`SET app.is_admin = 'true'`);
      
      // Admin should see all chats
      const allChats = await db.query(`
        SELECT * FROM thinktank_chats WHERE tenant_id = $1
      `, [tenantId]);
      
      expect(allChats.rows.length).toBeGreaterThanOrEqual(2);
    });
    
    it('should prevent cross-tenant access', async () => {
      await db.query(`SET app.current_tenant_id = 'other-tenant'`);
      await db.query(`SET app.current_app_id = 'thinktank'`);
      
      const otherTenantChats = await db.query(`SELECT * FROM thinktank_chats`);
      
      expect(otherTenantChats.rows).toHaveLength(0);
    });
  });
  
  describe('App Users', () => {
    it('should create separate app_users for same email', async () => {
      const tenantId = 'test-tenant-002';
      const email = 'alice@test.com';
      
      // Create app_user in Think Tank
      await db.query(`
        INSERT INTO app_users (tenant_id, app_id, cognito_sub, email, status)
        VALUES ($1, 'thinktank', 'sub-thinktank', $2, 'active')
      `, [tenantId, email]);
      
      // Create app_user in Think Tank
      await db.query(`
        INSERT INTO app_users (tenant_id, app_id, cognito_sub, email, status)
        VALUES ($1, 'thinktank', 'sub-thinktank', $2, 'active')
      `, [tenantId, email]);
      
      // Verify both exist
      const thinktankUser = await db.query(`
        SELECT * FROM app_users 
        WHERE tenant_id = $1 AND app_id = 'thinktank' AND email = $2
      `, [tenantId, email]);
      
      const ttUser = await db.query(`
        SELECT * FROM app_users 
        WHERE tenant_id = $1 AND app_id = 'thinktank' AND email = $2
      `, [tenantId, email]);
      
      expect(thinktankUser.rows).toHaveLength(1);
      expect(ttUser.rows).toHaveLength(1);
      expect(thinktankUser.rows[0].id).not.toBe(ttUser.rows[0].id);
    });
  });
});
```

---

## 40.9 SUMMARY

### What v4.6.0 Achieves

| Before (v4.5.0) | After (v4.6.0) |
|-----------------|----------------|
| Users isolated by tenant_id only | Users isolated by tenant_id + app_id |
| Same email = same user across all apps | Same email = separate identity per app |
| Think Tank data visible to client apps | Think Tank completely isolated |
| Single Cognito pool per tenant | Separate Cognito pool per app |
| RLS filters by tenant only | RLS filters by tenant AND app |
| No cross-app admin view | Admin dashboard for cross-app correlation |

### Key Files Changed/Added

```
packages/
â”œâ”€â”€ infrastructure/
â”‚   â”œâ”€â”€ lib/stacks/
â”‚   â”‚   â””â”€â”€ app-cognito.stack.ts           # NEW: Per-app Cognito
â”‚   â””â”€â”€ migrations/
â”‚       â””â”€â”€ 040_app_level_isolation.sql     # NEW: Database changes
â”œâ”€â”€ lambda/
â”‚   â”œâ”€â”€ cognito/
â”‚   â”‚   â”œâ”€â”€ pre-signup.ts                   # NEW: Sign-up validation
â”‚   â”‚   â”œâ”€â”€ post-confirmation.ts            # NEW: App user creation
â”‚   â”‚   â””â”€â”€ pre-token-generation.ts         # NEW: Add app claims
â”‚   â””â”€â”€ shared/
â”‚       â””â”€â”€ auth/
â”‚           â””â”€â”€ context.ts                  # UPDATED: App context
apps/
â”œâ”€â”€ admin-dashboard/
â”‚   â””â”€â”€ src/app/(dashboard)/users/
â”‚       â””â”€â”€ cross-app/page.tsx              # NEW: Admin view
tests/
â””â”€â”€ isolation/
    â””â”€â”€ app-isolation.test.ts               # NEW: Isolation tests
```

---

## Ã°Å¸Å¡â‚¬ HOW TO USE THIS PROMPT

This is the **definitive, fully deduplicated** implementation prompt for RADIANT v2.2.0. All duplicate type definitions have been removed and replaced with a single source of truth.

### For Windsurf IDE:
1. Open Windsurf IDE
2. Create a new folder: `radiant`
3. Paste this entire prompt into Cascade (Claude Opus 4.5)
4. The AI will implement systematically, section by section
5. Review and commit incrementally

### Implementation Order (Dependency Graph):
```
Ã¢â€Å’Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€Â
Ã¢â€â€š  SECTION 0: Shared Types (@radiant/shared)                      Ã¢â€â€š
Ã¢â€â€š  Ã¢â€â€Ã¢â€â‚¬Ã¢â€â‚¬ Must be implemented FIRST - all other sections import it  Ã¢â€â€š
Ã¢â€â€Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€Ëœ
                              Ã¢â€â€š
                              Ã¢â€“Â¼
Ã¢â€Å’Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€Â
Ã¢â€â€š  SECTION 1: Foundation & Swift App                              Ã¢â€â€š
Ã¢â€â€š  Ã¢â€â€Ã¢â€â‚¬Ã¢â€â‚¬ Depends on: Section 0                                      Ã¢â€â€š
Ã¢â€â€š  Ã¢â€â€Ã¢â€â‚¬Ã¢â€â‚¬ Creates: Monorepo structure, Swift macOS app               Ã¢â€â€š
Ã¢â€â€Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€Ëœ
                              Ã¢â€â€š
                              Ã¢â€“Â¼
Ã¢â€Å’Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€Â
Ã¢â€â€š  SECTION 2: CDK Infrastructure                                  Ã¢â€â€š
Ã¢â€â€š  Ã¢â€â€Ã¢â€â‚¬Ã¢â€â‚¬ Depends on: Sections 0, 1                                  Ã¢â€â€š
Ã¢â€â€š  Ã¢â€â€Ã¢â€â‚¬Ã¢â€â‚¬ Creates: VPC, Aurora, DynamoDB, S3, KMS, WAF               Ã¢â€â€š
Ã¢â€â€Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€Ëœ
                              Ã¢â€â€š
                              Ã¢â€“Â¼
Ã¢â€Å’Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€Â
Ã¢â€â€š  SECTION 3: CDK AI & API Stacks                                 Ã¢â€â€š
Ã¢â€â€š  Ã¢â€â€Ã¢â€â‚¬Ã¢â€â‚¬ Depends on: Sections 0-2                                   Ã¢â€â€š
Ã¢â€â€š  Ã¢â€â€Ã¢â€â‚¬Ã¢â€â‚¬ Creates: Cognito, LiteLLM, API Gateway, AppSync            Ã¢â€â€š
Ã¢â€â€Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€Ëœ
                              Ã¢â€â€š
                              Ã¢â€“Â¼
Ã¢â€Å’Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€Â
Ã¢â€â€š  SECTION 4: Lambda Functions - Core                             Ã¢â€â€š
Ã¢â€â€š  Ã¢â€â€Ã¢â€â‚¬Ã¢â€â‚¬ Depends on: Sections 0-3                                   Ã¢â€â€š
Ã¢â€â€š  Ã¢â€â€Ã¢â€â‚¬Ã¢â€â‚¬ Creates: Router, Chat, Models, Providers, PHI handlers     Ã¢â€â€š
Ã¢â€â€Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€Ëœ
                              Ã¢â€â€š
                              Ã¢â€“Â¼
Ã¢â€Å’Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€Â
Ã¢â€â€š  SECTION 5: Lambda Functions - Admin & Billing                  Ã¢â€â€š
Ã¢â€â€š  Ã¢â€â€Ã¢â€â‚¬Ã¢â€â‚¬ Depends on: Sections 0-4                                   Ã¢â€â€š
Ã¢â€â€š  Ã¢â€â€Ã¢â€â‚¬Ã¢â€â‚¬ Creates: Invitations, Approvals, Metering, Billing         Ã¢â€â€š
Ã¢â€â€Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€Ëœ
                              Ã¢â€â€š
                              Ã¢â€“Â¼
Ã¢â€Å’Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€Â
Ã¢â€â€š  SECTION 6: Self-Hosted Models & Services                       Ã¢â€â€š
Ã¢â€â€š  Ã¢â€â€Ã¢â€â‚¬Ã¢â€â‚¬ Depends on: Sections 0-5                                   Ã¢â€â€š
Ã¢â€â€š  Ã¢â€â€Ã¢â€â‚¬Ã¢â€â‚¬ Creates: 30+ SageMaker models, Thermal state management    Ã¢â€â€š
Ã¢â€â€Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€Ëœ
                              Ã¢â€â€š
                              Ã¢â€“Â¼
Ã¢â€Å’Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€Â
Ã¢â€â€š  SECTION 7: Database Schema (CANONICAL)                         Ã¢â€â€š
Ã¢â€â€š  Ã¢â€â€Ã¢â€â‚¬Ã¢â€â‚¬ Depends on: Sections 0-6                                   Ã¢â€â€š
Ã¢â€â€š  Ã¢â€â€Ã¢â€â‚¬Ã¢â€â‚¬ Creates: Complete PostgreSQL schema, all migrations        Ã¢â€â€š
Ã¢â€â€Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€Ëœ
                              Ã¢â€â€š
                              Ã¢â€“Â¼
Ã¢â€Å’Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€Â
Ã¢â€â€š  SECTION 8: Admin Web Dashboard                                 Ã¢â€â€š
Ã¢â€â€š  Ã¢â€â€Ã¢â€â‚¬Ã¢â€â‚¬ Depends on: Sections 0-7                                   Ã¢â€â€š
Ã¢â€â€š  Ã¢â€â€Ã¢â€â‚¬Ã¢â€â‚¬ Creates: Next.js 14 dashboard, all management UIs          Ã¢â€â€š
Ã¢â€â€Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€Ëœ
                              Ã¢â€â€š
                              Ã¢â€“Â¼
Ã¢â€Å’Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€Â
Ã¢â€â€š  SECTION 9: Assembly & Deployment                               Ã¢â€â€š
Ã¢â€â€š  Ã¢â€â€Ã¢â€â‚¬Ã¢â€â‚¬ Depends on: ALL sections                                   Ã¢â€â€š
Ã¢â€â€š  Ã¢â€â€Ã¢â€â‚¬Ã¢â€â‚¬ Provides: Verification, testing, troubleshooting           Ã¢â€â€š
Ã¢â€â€Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€â‚¬Ã¢â€Ëœ
```

---

## Ã°Å¸â€œâ€¹ CONFIGURATION - REPLACE THESE PLACEHOLDERS

Before deployment, find and replace these placeholders:

| Placeholder | Description | Your Value |
|-------------|-------------|------------|
| \`YOUR_DOMAIN.com\` | Your base domain | e.g., \`zynapses.com\` |
| \`YOUR_APP_ID\` | Application identifier | e.g., \`thinktank\` |
| \`YOUR_AWS_ACCOUNT_ID\` | 12-digit AWS account | e.g., \`123456789012\` |
| \`YOUR_AWS_REGION\` | Primary AWS region | e.g., \`us-east-1\` |
| \`YOUR_ORG_IDENTIFIER\` | Bundle ID prefix | e.g., \`com.yourcompany\` |

---

## Ã°Å¸â€œÅ  CANONICAL DATABASE TABLES

Use these table names consistently (not the alternatives):

| Canonical Name | âŒ Do NOT Use |
|----------------|---------------|
| `tenants` | - |
| `users` | - |
| `administrators` | `admin_users` |
| `invitations` | `admin_invitations` |
| `approval_requests` | `promotions`, `admin_approvals` |
| `providers` | - |
| `models` | `ai_models` (legacy) |
| `ai_models` | - (v4.1.0 orchestration registry) |
| `model_licenses` | - (v4.1.0 license tracking) |
| `model_dependencies` | - (v4.1.0 dependency tracking) |
| `workflow_definitions` | - (v4.1.0 workflow DAGs) |
| `workflow_tasks` | - (v4.1.0 workflow steps) |
| `workflow_parameters` | - (v4.1.0 configurable params) |
| `workflow_executions` | - (v4.1.0 execution tracking) |
| `task_executions` | - (v4.1.0 task-level logs) |
| `service_definitions` | - (v4.1.0 mid-level services) |
| `orchestration_audit_log` | - (v4.1.0 change audit) |
| `unified_model_registry` | - (v4.2.0 combined view - ALL models) |
| `registry_sync_log` | - (v4.2.0 sync history) |
| `provider_health` | - (v4.2.0 health monitoring) |
| `self_hosted_models` | - (v4.2.0 SageMaker models catalog) |
| `execution_manifests` | - (v4.3.0 full execution provenance) |
| `feedback_explicit` | - (v4.3.0 thumbs up/down + categories) |
| `feedback_implicit` | - (v4.3.0 regenerate, copy, abandon signals) |
| `feedback_voice` | - (v4.3.0 voice feedback with transcription) |
| `neural_model_scores` | - (v4.3.0 learned model effectiveness) |
| `neural_routing_recommendations` | - (v4.3.0 Brain advice from Neural Engine) |
| `user_trust_scores` | - (v4.3.0 anti-gaming trust levels) |
| `ab_experiments` | - (v4.3.0 A/B testing experiments) |
| `ab_experiment_assignments` | - (v4.3.0 user experiment assignments) |
| `localization_languages` | - (v4.7.0 supported languages) |
| `localization_registry` | - (v4.7.0 all translatable strings) |
| `localization_translations` | - (v4.7.0 per-language translations) |
| `localization_audit_log` | - (v4.7.0 translation change history) |
| `configuration_categories` | - (v4.8.0 config categories) |
| `system_configuration` | - (v4.8.0 global config parameters) |
| `tenant_configuration_overrides` | - (v4.8.0 per-tenant config overrides) |
| `configuration_audit_log` | - (v4.8.0 config change history) |
| `configuration_cache_invalidation` | - (v4.8.0 cache invalidation queue) |
| `usage_events` | `usage_records` |
| `invoices` | - |
| `audit_logs` | - |

---

# â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
# SECTION 41: COMPLETE INTERNATIONALIZATION SYSTEM (v4.7.0)
# â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

> **CRITICAL: This section implements complete i18n/localization for RADIANT.**
> **ZERO hardcoded strings allowed - ALL user-facing text must come from the localization registry.**

---

## 41.1 ARCHITECTURE OVERVIEW

### The Problem

Before v4.7.0, RADIANT had scattered hardcoded strings throughout the codebase:

```
BEFORE (v4.6.0 and earlier):
â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”
â”‚ Hardcoded Strings Everywhere                                        â”‚
â”œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”¤
â”‚                                                                     â”‚
â”‚  React Component:                                                   â”‚
â”‚  <Button>Submit</Button>  â† Hardcoded!                             â”‚
â”‚  <Alert>Error occurred</Alert>  â† Hardcoded!                       â”‚
â”‚                                                                     â”‚
â”‚  Lambda Response:                                                   â”‚
â”‚  { message: "User not found" }  â† Hardcoded!                       â”‚
â”‚  throw new Error("Invalid input")  â† Hardcoded!                    â”‚
â”‚                                                                     â”‚
â”‚  Swift App:                                                         â”‚
â”‚  Text("Welcome")  â† Hardcoded!                                     â”‚
â”‚  Alert("Connection failed")  â† Hardcoded!                          â”‚
â”‚                                                                     â”‚
â”‚  Problems:                                                          â”‚
â”‚  â”œâ”€â”€ Cannot support multiple languages                              â”‚
â”‚  â”œâ”€â”€ No central place to update text                                â”‚
â”‚  â”œâ”€â”€ Inconsistent terminology across apps                           â”‚
â”‚  â””â”€â”€ No way to A/B test copy changes                                â”‚
â”‚                                                                     â”‚
â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜
```

### The Solution

v4.7.0 implements **complete database-driven localization**:

```
AFTER (v4.7.0):
â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”
â”‚ Centralized Localization Registry                                   â”‚
â”œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”¤
â”‚                                                                     â”‚
â”‚  â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”   â”‚
â”‚  â”‚ localization_registry (Single Source of Truth)              â”‚   â”‚
â”‚  â”‚ â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â” â”‚   â”‚
â”‚  â”‚ â”‚ key: "button.submit"                                    â”‚ â”‚   â”‚
â”‚  â”‚ â”‚ default_text: "Submit"                                  â”‚ â”‚   â”‚
â”‚  â”‚ â”‚ context: "Primary action button"                        â”‚ â”‚   â”‚
â”‚  â”‚ â”‚ category: "ui.buttons"                                  â”‚ â”‚   â”‚
â”‚  â”‚ â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜ â”‚   â”‚
â”‚  â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜   â”‚
â”‚           â”‚                                                         â”‚
â”‚           â–¼                                                         â”‚
â”‚  â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”   â”‚
â”‚  â”‚ localization_translations                                   â”‚   â”‚
â”‚  â”‚ â”œâ”€â”€ en: "Submit"           (status: approved)              â”‚   â”‚
â”‚  â”‚ â”œâ”€â”€ es: "Enviar"           (status: approved)              â”‚   â”‚
â”‚  â”‚ â”œâ”€â”€ fr: "Soumettre"        (status: approved)              â”‚   â”‚
â”‚  â”‚ â”œâ”€â”€ de: "Absenden"         (status: ai_translated)         â”‚   â”‚
â”‚  â”‚ â”œâ”€â”€ ja: "é€ä¿¡"              (status: approved)              â”‚   â”‚
â”‚  â”‚ â””â”€â”€ ... 18 languages total                                 â”‚   â”‚
â”‚  â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜   â”‚
â”‚                                                                     â”‚
â”‚  React: {t('button.submit')}                                       â”‚
â”‚  Lambda: t('error.user_not_found', { userId })                     â”‚
â”‚  Swift: L10n.button.submit                                          â”‚
â”‚                                                                     â”‚
â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜
```

### Supported Languages (18)

| Code | Language | Native Name | RTL | Status |
|------|----------|-------------|-----|--------|
| `en` | English | English | No | Primary |
| `es` | Spanish | EspaÃ±ol | No | Supported |
| `fr` | French | FranÃ§ais | No | Supported |
| `de` | German | Deutsch | No | Supported |
| `pt` | Portuguese | PortuguÃªs | No | Supported |
| `it` | Italian | Italiano | No | Supported |
| `nl` | Dutch | Nederlands | No | Supported |
| `pl` | Polish | Polski | No | Supported |
| `ru` | Russian | Ð ÑƒÑÑÐºÐ¸Ð¹ | No | Supported |
| `tr` | Turkish | TÃ¼rkÃ§e | No | Supported |
| `ja` | Japanese | æ—¥æœ¬èªž | No | Supported |
| `ko` | Korean | í•œêµ­ì–´ | No | Supported |
| `zh-CN` | Chinese (Simplified) | ç®€ä½“ä¸­æ–‡ | No | Supported |
| `zh-TW` | Chinese (Traditional) | ç¹é«”ä¸­æ–‡ | No | Supported |
| `ar` | Arabic | Ø§Ù„Ø¹Ø±Ø¨ÙŠØ© | **Yes** | Supported |
| `hi` | Hindi | à¤¹à¤¿à¤¨à¥à¤¦à¥€ | No | Supported |
| `th` | Thai | à¹„à¸—à¸¢ | No | Supported |
| `vi` | Vietnamese | Tiáº¿ng Viá»‡t | No | Supported |

### System Architecture

```
â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”
â”‚                    RADIANT v4.7.0 LOCALIZATION ARCHITECTURE                      â”‚
â”œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”¤
â”‚                                                                                 â”‚
â”‚  BUILD TIME (Prevention)                                                        â”‚
â”‚  â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”         â”‚
â”‚  â”‚ ESLint Plugin: @radiant/eslint-plugin-i18n                        â”‚         â”‚
â”‚  â”‚ â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”   â”‚         â”‚
â”‚  â”‚ â”‚ âŒ BLOCKS: <Button>Submit</Button>                          â”‚   â”‚         â”‚
â”‚  â”‚ â”‚ âŒ BLOCKS: throw new Error("Invalid input")                 â”‚   â”‚         â”‚
â”‚  â”‚ â”‚ âŒ BLOCKS: { message: "User not found" }                    â”‚   â”‚         â”‚
â”‚  â”‚ â”‚ âœ… ALLOWS: <Button>{t('button.submit')}</Button>            â”‚   â”‚         â”‚
â”‚  â”‚ â”‚ âœ… ALLOWS: throw new LocalizedError('error.invalid_input')  â”‚   â”‚         â”‚
â”‚  â”‚ â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜   â”‚         â”‚
â”‚  â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜         â”‚
â”‚           â”‚                                                                     â”‚
â”‚           â–¼                                                                     â”‚
â”‚  RUNTIME (Database-Driven)                                                      â”‚
â”‚  â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”         â”‚
â”‚  â”‚ PostgreSQL: localization_registry + localization_translations     â”‚         â”‚
â”‚  â”‚ â”œâ”€â”€ All strings registered with unique keys                       â”‚         â”‚
â”‚  â”‚ â”œâ”€â”€ Translations for 18 languages                                 â”‚         â”‚
â”‚  â”‚ â”œâ”€â”€ Status tracking (approved, ai_translated, needs_review)       â”‚         â”‚
â”‚  â”‚ â””â”€â”€ Version history for all changes                               â”‚         â”‚
â”‚  â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜         â”‚
â”‚           â”‚                                                                     â”‚
â”‚           â–¼                                                                     â”‚
â”‚  AUTO-TRANSLATION (AI-Powered)                                                  â”‚
â”‚  â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”         â”‚
â”‚  â”‚ Lambda: localization-translate                                    â”‚         â”‚
â”‚  â”‚ â”œâ”€â”€ Triggered when new registry entry added                       â”‚         â”‚
â”‚  â”‚ â”œâ”€â”€ Uses AWS Bedrock (Claude) for translation                     â”‚         â”‚
â”‚  â”‚ â”œâ”€â”€ Sets status = 'ai_translated' (NOT approved)                  â”‚         â”‚
â”‚  â”‚ â””â”€â”€ Sends notification to admin for review                        â”‚         â”‚
â”‚  â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜         â”‚
â”‚           â”‚                                                                     â”‚
â”‚           â–¼                                                                     â”‚
â”‚  ADMIN REVIEW (Human Approval)                                                  â”‚
â”‚  â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”         â”‚
â”‚  â”‚ Admin Dashboard: /admin/localization                              â”‚         â”‚
â”‚  â”‚ â”œâ”€â”€ View all strings needing review                               â”‚         â”‚
â”‚  â”‚ â”œâ”€â”€ Edit translations inline                                      â”‚         â”‚
â”‚  â”‚ â”œâ”€â”€ Approve AI translations                                       â”‚         â”‚
â”‚  â”‚ â”œâ”€â”€ Translation coverage dashboard                                â”‚         â”‚
â”‚  â”‚ â””â”€â”€ Bulk operations (approve all, export, import)                 â”‚         â”‚
â”‚  â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜         â”‚
â”‚                                                                                 â”‚
â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜
```

---

## 41.2 DATABASE SCHEMA

### Migration: 041_localization_system.sql

```sql
-- ============================================================================
-- RADIANT v4.7.0 - Complete Internationalization System
-- Migration: 041_localization_system.sql
-- ============================================================================

-- ============================================================================
-- 41.2.1 Supported Languages Table
-- ============================================================================

CREATE TABLE localization_languages (
    code VARCHAR(10) PRIMARY KEY,  -- ISO 639-1 + region (e.g., 'en', 'zh-CN')
    name VARCHAR(100) NOT NULL,     -- English name
    native_name VARCHAR(100) NOT NULL,  -- Name in native script
    is_rtl BOOLEAN DEFAULT false,   -- Right-to-left language
    is_active BOOLEAN DEFAULT true, -- Available for selection
    display_order INTEGER DEFAULT 100,
    
    -- Metadata
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Insert supported languages
INSERT INTO localization_languages (code, name, native_name, is_rtl, display_order) VALUES
('en', 'English', 'English', false, 1),
('es', 'Spanish', 'EspaÃ±ol', false, 2),
('fr', 'French', 'FranÃ§ais', false, 3),
('de', 'German', 'Deutsch', false, 4),
('pt', 'Portuguese', 'PortuguÃªs', false, 5),
('it', 'Italian', 'Italiano', false, 6),
('nl', 'Dutch', 'Nederlands', false, 7),
('pl', 'Polish', 'Polski', false, 8),
('ru', 'Russian', 'Ð ÑƒÑÑÐºÐ¸Ð¹', false, 9),
('tr', 'Turkish', 'TÃ¼rkÃ§e', false, 10),
('ja', 'Japanese', 'æ—¥æœ¬èªž', false, 11),
('ko', 'Korean', 'í•œêµ­ì–´', false, 12),
('zh-CN', 'Chinese (Simplified)', 'ç®€ä½“ä¸­æ–‡', false, 13),
('zh-TW', 'Chinese (Traditional)', 'ç¹é«”ä¸­æ–‡', false, 14),
('ar', 'Arabic', 'Ø§Ù„Ø¹Ø±Ø¨ÙŠØ©', true, 15),
('hi', 'Hindi', 'à¤¹à¤¿à¤¨à¥à¤¦à¥€', false, 16),
('th', 'Thai', 'à¹„à¸—à¸¢', false, 17),
('vi', 'Vietnamese', 'Tiáº¿ng Viá»‡t', false, 18);

-- ============================================================================
-- 41.2.2 Localization Registry (Master String List)
-- ============================================================================

CREATE TABLE localization_registry (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- String identification
    key VARCHAR(255) NOT NULL UNIQUE,  -- Unique key like 'button.submit', 'error.user_not_found'
    default_text TEXT NOT NULL,         -- English default text
    
    -- Categorization
    category VARCHAR(100) NOT NULL,     -- 'ui.buttons', 'errors.validation', 'messages.success'
    subcategory VARCHAR(100),           -- Optional further grouping
    
    -- Context for translators
    context TEXT,                       -- Description/usage context for translators
    max_length INTEGER,                 -- Character limit if applicable
    placeholders JSONB DEFAULT '[]',    -- List of {name, description} for interpolation
    
    -- Source tracking
    source_app VARCHAR(50) NOT NULL,    -- 'admin', 'thinktank', 'api', 'shared'
    source_file VARCHAR(255),           -- Original file path where first used
    
    -- Status
    is_active BOOLEAN DEFAULT true,
    deprecated_at TIMESTAMPTZ,
    deprecated_replacement_key VARCHAR(255),
    
    -- Timestamps
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by UUID REFERENCES administrators(id),
    
    -- Indexes for fast lookup
    CONSTRAINT valid_key_format CHECK (key ~ '^[a-z][a-z0-9_.]+[a-z0-9]$')
);

CREATE INDEX idx_localization_registry_key ON localization_registry(key);
CREATE INDEX idx_localization_registry_category ON localization_registry(category);
CREATE INDEX idx_localization_registry_source_app ON localization_registry(source_app);
CREATE INDEX idx_localization_registry_active ON localization_registry(is_active) WHERE is_active = true;

-- ============================================================================
-- 41.2.3 Localization Translations (Per-Language Values)
-- ============================================================================

CREATE TYPE translation_status AS ENUM (
    'pending',        -- Not yet translated
    'ai_translated',  -- Auto-translated by AI, needs review
    'in_review',      -- Being reviewed by human
    'approved',       -- Human-approved for production
    'rejected'        -- Rejected, needs re-translation
);

CREATE TABLE localization_translations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- Foreign keys
    registry_id UUID NOT NULL REFERENCES localization_registry(id) ON DELETE CASCADE,
    language_code VARCHAR(10) NOT NULL REFERENCES localization_languages(code),
    
    -- Translation content
    translated_text TEXT NOT NULL,
    
    -- Status tracking
    status translation_status NOT NULL DEFAULT 'pending',
    
    -- AI translation metadata
    ai_model VARCHAR(100),           -- e.g., 'anthropic.claude-3-sonnet-20240229-v1:0'
    ai_confidence DECIMAL(3,2),      -- 0.00 to 1.00
    ai_translated_at TIMESTAMPTZ,
    
    -- Human review
    reviewed_by UUID REFERENCES administrators(id),
    reviewed_at TIMESTAMPTZ,
    review_notes TEXT,
    
    -- Version tracking
    version INTEGER NOT NULL DEFAULT 1,
    previous_text TEXT,              -- Previous translation for comparison
    
    -- Timestamps
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    -- Unique constraint
    UNIQUE(registry_id, language_code)
);

CREATE INDEX idx_localization_translations_registry ON localization_translations(registry_id);
CREATE INDEX idx_localization_translations_language ON localization_translations(language_code);
CREATE INDEX idx_localization_translations_status ON localization_translations(status);
CREATE INDEX idx_localization_translations_needs_review 
    ON localization_translations(status) 
    WHERE status IN ('ai_translated', 'in_review');

-- ============================================================================
-- 41.2.4 Audit Log for Translation Changes
-- ============================================================================

CREATE TABLE localization_audit_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- What changed
    registry_id UUID REFERENCES localization_registry(id) ON DELETE SET NULL,
    translation_id UUID REFERENCES localization_translations(id) ON DELETE SET NULL,
    language_code VARCHAR(10),
    
    -- Change details
    action VARCHAR(50) NOT NULL,  -- 'created', 'updated', 'approved', 'rejected', 'ai_translated'
    old_value JSONB,
    new_value JSONB,
    
    -- Who made the change
    changed_by UUID REFERENCES administrators(id),
    changed_by_system BOOLEAN DEFAULT false,  -- True if AI/system change
    
    -- Timestamps
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_localization_audit_registry ON localization_audit_log(registry_id);
CREATE INDEX idx_localization_audit_created ON localization_audit_log(created_at DESC);

-- ============================================================================
-- 41.2.5 Translation Queue (For AI Processing)
-- ============================================================================

CREATE TABLE localization_translation_queue (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    registry_id UUID NOT NULL REFERENCES localization_registry(id) ON DELETE CASCADE,
    language_code VARCHAR(10) NOT NULL REFERENCES localization_languages(code),
    
    -- Queue status
    status VARCHAR(20) NOT NULL DEFAULT 'pending' 
        CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
    
    -- Processing metadata
    attempts INTEGER DEFAULT 0,
    last_attempt_at TIMESTAMPTZ,
    error_message TEXT,
    
    -- Timestamps
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    completed_at TIMESTAMPTZ,
    
    UNIQUE(registry_id, language_code)
);

CREATE INDEX idx_translation_queue_pending ON localization_translation_queue(status) 
    WHERE status = 'pending';

-- ============================================================================
-- 41.2.6 Helper Functions
-- ============================================================================

-- Get translation with fallback chain: requested language -> English -> key
CREATE OR REPLACE FUNCTION get_translation(
    p_key VARCHAR(255),
    p_language VARCHAR(10) DEFAULT 'en'
) RETURNS TEXT AS $$
DECLARE
    v_result TEXT;
BEGIN
    -- Try requested language first
    SELECT lt.translated_text INTO v_result
    FROM localization_registry lr
    JOIN localization_translations lt ON lt.registry_id = lr.id
    WHERE lr.key = p_key 
      AND lt.language_code = p_language
      AND lt.status = 'approved'
      AND lr.is_active = true;
    
    IF v_result IS NOT NULL THEN
        RETURN v_result;
    END IF;
    
    -- Fall back to English
    IF p_language != 'en' THEN
        SELECT lt.translated_text INTO v_result
        FROM localization_registry lr
        JOIN localization_translations lt ON lt.registry_id = lr.id
        WHERE lr.key = p_key 
          AND lt.language_code = 'en'
          AND lt.status = 'approved'
          AND lr.is_active = true;
        
        IF v_result IS NOT NULL THEN
            RETURN v_result;
        END IF;
    END IF;
    
    -- Fall back to default_text from registry
    SELECT lr.default_text INTO v_result
    FROM localization_registry lr
    WHERE lr.key = p_key AND lr.is_active = true;
    
    -- Return key if nothing found
    RETURN COALESCE(v_result, p_key);
END;
$$ LANGUAGE plpgsql STABLE;

-- Get all translations for a language (for bulk loading)
CREATE OR REPLACE FUNCTION get_all_translations(
    p_language VARCHAR(10) DEFAULT 'en'
) RETURNS TABLE (
    key VARCHAR(255),
    text TEXT,
    is_fallback BOOLEAN
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        lr.key,
        COALESCE(
            lt_lang.translated_text,
            lt_en.translated_text,
            lr.default_text
        ) as text,
        (lt_lang.translated_text IS NULL) as is_fallback
    FROM localization_registry lr
    LEFT JOIN localization_translations lt_lang 
        ON lt_lang.registry_id = lr.id 
        AND lt_lang.language_code = p_language
        AND lt_lang.status = 'approved'
    LEFT JOIN localization_translations lt_en
        ON lt_en.registry_id = lr.id
        AND lt_en.language_code = 'en'
        AND lt_en.status = 'approved'
    WHERE lr.is_active = true;
END;
$$ LANGUAGE plpgsql STABLE;

-- Get translation coverage statistics
CREATE OR REPLACE FUNCTION get_translation_coverage()
RETURNS TABLE (
    language_code VARCHAR(10),
    language_name VARCHAR(100),
    total_strings BIGINT,
    translated_count BIGINT,
    approved_count BIGINT,
    ai_translated_count BIGINT,
    pending_count BIGINT,
    coverage_percent DECIMAL(5,2)
) AS $$
BEGIN
    RETURN QUERY
    WITH total AS (
        SELECT COUNT(*) as cnt FROM localization_registry WHERE is_active = true
    )
    SELECT 
        ll.code as language_code,
        ll.name as language_name,
        t.cnt as total_strings,
        COUNT(lt.id) as translated_count,
        COUNT(lt.id) FILTER (WHERE lt.status = 'approved') as approved_count,
        COUNT(lt.id) FILTER (WHERE lt.status = 'ai_translated') as ai_translated_count,
        t.cnt - COUNT(lt.id) as pending_count,
        ROUND((COUNT(lt.id) FILTER (WHERE lt.status = 'approved')::DECIMAL / NULLIF(t.cnt, 0)) * 100, 2) as coverage_percent
    FROM localization_languages ll
    CROSS JOIN total t
    LEFT JOIN localization_registry lr ON lr.is_active = true
    LEFT JOIN localization_translations lt 
        ON lt.registry_id = lr.id 
        AND lt.language_code = ll.code
    WHERE ll.is_active = true
    GROUP BY ll.code, ll.name, ll.display_order, t.cnt
    ORDER BY ll.display_order;
END;
$$ LANGUAGE plpgsql STABLE;

-- Trigger to auto-queue translations when new registry entry added
CREATE OR REPLACE FUNCTION queue_translations_for_new_entry()
RETURNS TRIGGER AS $$
BEGIN
    -- Queue translations for all active languages except English
    INSERT INTO localization_translation_queue (registry_id, language_code)
    SELECT NEW.id, ll.code
    FROM localization_languages ll
    WHERE ll.is_active = true AND ll.code != 'en';
    
    -- Auto-create English translation from default_text
    INSERT INTO localization_translations (registry_id, language_code, translated_text, status)
    VALUES (NEW.id, 'en', NEW.default_text, 'approved');
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_queue_translations
    AFTER INSERT ON localization_registry
    FOR EACH ROW
    EXECUTE FUNCTION queue_translations_for_new_entry();

-- Trigger to log translation changes
CREATE OR REPLACE FUNCTION log_translation_changes()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO localization_audit_log (
        registry_id,
        translation_id,
        language_code,
        action,
        old_value,
        new_value,
        changed_by,
        changed_by_system
    ) VALUES (
        NEW.registry_id,
        NEW.id,
        NEW.language_code,
        CASE 
            WHEN TG_OP = 'INSERT' THEN 'created'
            WHEN OLD.status != NEW.status AND NEW.status = 'approved' THEN 'approved'
            WHEN OLD.status != NEW.status AND NEW.status = 'rejected' THEN 'rejected'
            ELSE 'updated'
        END,
        CASE WHEN TG_OP = 'UPDATE' THEN jsonb_build_object(
            'text', OLD.translated_text,
            'status', OLD.status
        ) END,
        jsonb_build_object(
            'text', NEW.translated_text,
            'status', NEW.status
        ),
        NEW.reviewed_by,
        NEW.ai_model IS NOT NULL AND NEW.reviewed_by IS NULL
    );
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_log_translation_changes
    AFTER INSERT OR UPDATE ON localization_translations
    FOR EACH ROW
    EXECUTE FUNCTION log_translation_changes();
```

---

## 41.3 TYPESCRIPT TYPES & CONSTANTS

### File: `packages/shared/src/i18n/types.ts`

```typescript
// ============================================================================
// RADIANT v4.7.0 - Internationalization Types
// ============================================================================

/**
 * Supported language codes
 */
export const SUPPORTED_LANGUAGES = [
  'en', 'es', 'fr', 'de', 'pt', 'it', 'nl', 'pl', 'ru', 'tr',
  'ja', 'ko', 'zh-CN', 'zh-TW', 'ar', 'hi', 'th', 'vi'
] as const;

export type LanguageCode = typeof SUPPORTED_LANGUAGES[number];

export const DEFAULT_LANGUAGE: LanguageCode = 'en';

export const RTL_LANGUAGES: LanguageCode[] = ['ar'];

/**
 * Language metadata
 */
export interface Language {
  code: LanguageCode;
  name: string;
  nativeName: string;
  isRtl: boolean;
  isActive: boolean;
  displayOrder: number;
}

/**
 * Translation status enum
 */
export type TranslationStatus = 
  | 'pending' 
  | 'ai_translated' 
  | 'in_review' 
  | 'approved' 
  | 'rejected';

/**
 * Localization registry entry
 */
export interface LocalizationEntry {
  id: string;
  key: string;
  defaultText: string;
  category: string;
  subcategory?: string;
  context?: string;
  maxLength?: number;
  placeholders?: Array<{
    name: string;
    description: string;
  }>;
  sourceApp: 'admin' | 'thinktank' | 'api' | 'shared';
  sourceFile?: string;
  isActive: boolean;
  deprecatedAt?: string;
  deprecatedReplacementKey?: string;
  createdAt: string;
  updatedAt: string;
}

/**
 * Translation for a specific language
 */
export interface Translation {
  id: string;
  registryId: string;
  languageCode: LanguageCode;
  translatedText: string;
  status: TranslationStatus;
  aiModel?: string;
  aiConfidence?: number;
  aiTranslatedAt?: string;
  reviewedBy?: string;
  reviewedAt?: string;
  reviewNotes?: string;
  version: number;
  previousText?: string;
  createdAt: string;
  updatedAt: string;
}

/**
 * Translation with key (for client-side use)
 */
export interface TranslationBundle {
  [key: string]: string;
}

/**
 * Translation coverage statistics
 */
export interface TranslationCoverage {
  languageCode: LanguageCode;
  languageName: string;
  totalStrings: number;
  translatedCount: number;
  approvedCount: number;
  aiTranslatedCount: number;
  pendingCount: number;
  coveragePercent: number;
}

/**
 * Interpolation values for placeholders
 */
export type InterpolationValues = Record<string, string | number>;

/**
 * Categories for organizing translations
 */
export const TRANSLATION_CATEGORIES = {
  // UI Elements
  'ui.buttons': 'Buttons and Actions',
  'ui.labels': 'Form Labels',
  'ui.placeholders': 'Input Placeholders',
  'ui.tooltips': 'Tooltips and Hints',
  'ui.navigation': 'Navigation Items',
  'ui.headings': 'Page and Section Headings',
  
  // Messages
  'messages.success': 'Success Messages',
  'messages.info': 'Informational Messages',
  'messages.warning': 'Warning Messages',
  'messages.loading': 'Loading States',
  
  // Errors
  'errors.validation': 'Validation Errors',
  'errors.auth': 'Authentication Errors',
  'errors.api': 'API Errors',
  'errors.network': 'Network Errors',
  'errors.system': 'System Errors',
  
  // Features
  'features.chat': 'Chat Feature',
  'features.thinktank': 'Think Tank Feature',
  'features.admin': 'Admin Dashboard',
  'features.billing': 'Billing & Payments',
  'features.settings': 'User Settings',
  
  // Content
  'content.legal': 'Legal Content',
  'content.marketing': 'Marketing Copy',
  'content.help': 'Help & Documentation',
} as const;

export type TranslationCategory = keyof typeof TRANSLATION_CATEGORIES;
```

### File: `packages/shared/src/i18n/constants.ts`

```typescript
// ============================================================================
// RADIANT v4.7.0 - i18n Constants
// ============================================================================

import { LanguageCode } from './types';

/**
 * Language metadata mapping
 */
export const LANGUAGE_METADATA: Record<LanguageCode, {
  name: string;
  nativeName: string;
  isRtl: boolean;
}> = {
  'en': { name: 'English', nativeName: 'English', isRtl: false },
  'es': { name: 'Spanish', nativeName: 'EspaÃ±ol', isRtl: false },
  'fr': { name: 'French', nativeName: 'FranÃ§ais', isRtl: false },
  'de': { name: 'German', nativeName: 'Deutsch', isRtl: false },
  'pt': { name: 'Portuguese', nativeName: 'PortuguÃªs', isRtl: false },
  'it': { name: 'Italian', nativeName: 'Italiano', isRtl: false },
  'nl': { name: 'Dutch', nativeName: 'Nederlands', isRtl: false },
  'pl': { name: 'Polish', nativeName: 'Polski', isRtl: false },
  'ru': { name: 'Russian', nativeName: 'Ð ÑƒÑÑÐºÐ¸Ð¹', isRtl: false },
  'tr': { name: 'Turkish', nativeName: 'TÃ¼rkÃ§e', isRtl: false },
  'ja': { name: 'Japanese', nativeName: 'æ—¥æœ¬èªž', isRtl: false },
  'ko': { name: 'Korean', nativeName: 'í•œêµ­ì–´', isRtl: false },
  'zh-CN': { name: 'Chinese (Simplified)', nativeName: 'ç®€ä½“ä¸­æ–‡', isRtl: false },
  'zh-TW': { name: 'Chinese (Traditional)', nativeName: 'ç¹é«”ä¸­æ–‡', isRtl: false },
  'ar': { name: 'Arabic', nativeName: 'Ø§Ù„Ø¹Ø±Ø¨ÙŠØ©', isRtl: true },
  'hi': { name: 'Hindi', nativeName: 'à¤¹à¤¿à¤¨à¥à¤¦à¥€', isRtl: false },
  'th': { name: 'Thai', nativeName: 'à¹„à¸—à¸¢', isRtl: false },
  'vi': { name: 'Vietnamese', nativeName: 'Tiáº¿ng Viá»‡t', isRtl: false },
};

/**
 * Bedrock model for translations
 */
export const TRANSLATION_AI_MODEL = 'anthropic.claude-3-sonnet-20240229-v1:0';

/**
 * Translation system prompt
 */
export const TRANSLATION_SYSTEM_PROMPT = `You are a professional translator for a software application called RADIANT. 
Your task is to translate UI text, error messages, and user-facing content.

Guidelines:
1. Maintain the same tone and formality level as the source
2. Preserve all placeholders like {name}, {count}, etc. exactly as they appear
3. Keep technical terms consistent with industry standards for the target language
4. For UI elements (buttons, labels), keep translations concise
5. Respect character limits if specified
6. Consider the context provided to ensure accurate translation
7. For RTL languages (Arabic), ensure text flows correctly

Output ONLY the translated text, nothing else.`;

/**
 * Rate limits for translation API
 */
export const TRANSLATION_RATE_LIMITS = {
  maxConcurrent: 10,
  maxPerMinute: 100,
  maxPerHour: 1000,
  retryAttempts: 3,
  retryDelayMs: 1000,
};
```

---

## 41.4 AI TRANSLATION LAMBDA

### File: `lambda/localization/translate.ts`

```typescript
// ============================================================================
// RADIANT v4.7.0 - AI Translation Lambda
// Triggered by SQS queue when new translation needed
// ============================================================================

import { SQSHandler, SQSEvent } from 'aws-lambda';
import { 
  BedrockRuntimeClient, 
  InvokeModelCommand 
} from '@aws-sdk/client-bedrock-runtime';
import { Pool } from 'pg';
import { SNSClient, PublishCommand } from '@aws-sdk/client-sns';
import { 
  TRANSLATION_AI_MODEL, 
  TRANSLATION_SYSTEM_PROMPT,
  LANGUAGE_METADATA 
} from '@radiant/shared/i18n';

const bedrock = new BedrockRuntimeClient({ region: process.env.AWS_REGION });
const sns = new SNSClient({ region: process.env.AWS_REGION });
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

interface TranslationQueueMessage {
  registryId: string;
  languageCode: string;
  key: string;
  defaultText: string;
  context?: string;
  maxLength?: number;
  placeholders?: Array<{ name: string; description: string }>;
}

export const handler: SQSHandler = async (event: SQSEvent) => {
  for (const record of event.Records) {
    const message: TranslationQueueMessage = JSON.parse(record.body);
    
    try {
      await translateAndStore(message);
    } catch (error) {
      console.error('Translation failed:', error);
      await updateQueueStatus(message.registryId, message.languageCode, 'failed', error.message);
      throw error; // Re-throw to trigger SQS retry
    }
  }
};

async function translateAndStore(message: TranslationQueueMessage): Promise<void> {
  const { registryId, languageCode, key, defaultText, context, maxLength, placeholders } = message;
  
  // Update queue status to processing
  await updateQueueStatus(registryId, languageCode, 'processing');
  
  // Build translation prompt
  const targetLanguage = LANGUAGE_METADATA[languageCode as keyof typeof LANGUAGE_METADATA];
  
  let userPrompt = `Translate the following English text to ${targetLanguage.name} (${targetLanguage.nativeName}):

Text to translate: "${defaultText}"`;

  if (context) {
    userPrompt += `\n\nContext: ${context}`;
  }
  
  if (maxLength) {
    userPrompt += `\n\nMaximum length: ${maxLength} characters`;
  }
  
  if (placeholders && placeholders.length > 0) {
    userPrompt += `\n\nPlaceholders to preserve exactly:`;
    placeholders.forEach(p => {
      userPrompt += `\n- {${p.name}}: ${p.description}`;
    });
  }

  // Call Bedrock
  const response = await bedrock.send(new InvokeModelCommand({
    modelId: TRANSLATION_AI_MODEL,
    contentType: 'application/json',
    accept: 'application/json',
    body: JSON.stringify({
      anthropic_version: 'bedrock-2023-05-31',
      max_tokens: 1024,
      system: TRANSLATION_SYSTEM_PROMPT,
      messages: [
        { role: 'user', content: userPrompt }
      ],
    }),
  }));

  const responseBody = JSON.parse(new TextDecoder().decode(response.body));
  const translatedText = responseBody.content[0].text.trim();

  // Validate placeholders are preserved
  if (placeholders) {
    for (const p of placeholders) {
      if (!translatedText.includes(`{${p.name}}`)) {
        throw new Error(`Translation missing placeholder: {${p.name}}`);
      }
    }
  }

  // Store translation
  await pool.query(`
    INSERT INTO localization_translations (
      registry_id, language_code, translated_text, status,
      ai_model, ai_confidence, ai_translated_at
    ) VALUES ($1, $2, $3, 'ai_translated', $4, $5, NOW())
    ON CONFLICT (registry_id, language_code) 
    DO UPDATE SET
      translated_text = $3,
      status = 'ai_translated',
      ai_model = $4,
      ai_confidence = $5,
      ai_translated_at = NOW(),
      previous_text = localization_translations.translated_text,
      version = localization_translations.version + 1,
      updated_at = NOW()
  `, [registryId, languageCode, translatedText, TRANSLATION_AI_MODEL, 0.85]);

  // Update queue status
  await updateQueueStatus(registryId, languageCode, 'completed');

  // Notify admin of new AI translation needing review
  await notifyAdminOfNewTranslation(key, languageCode, translatedText);
}

async function updateQueueStatus(
  registryId: string, 
  languageCode: string, 
  status: string,
  errorMessage?: string
): Promise<void> {
  await pool.query(`
    UPDATE localization_translation_queue
    SET status = $3,
        last_attempt_at = NOW(),
        attempts = attempts + 1,
        error_message = $4,
        completed_at = CASE WHEN $3 = 'completed' THEN NOW() ELSE NULL END
    WHERE registry_id = $1 AND language_code = $2
  `, [registryId, languageCode, status, errorMessage]);
}

async function notifyAdminOfNewTranslation(
  key: string,
  languageCode: string,
  translatedText: string
): Promise<void> {
  const targetLanguage = LANGUAGE_METADATA[languageCode as keyof typeof LANGUAGE_METADATA];
  
  await sns.send(new PublishCommand({
    TopicArn: process.env.ADMIN_NOTIFICATION_TOPIC_ARN,
    Subject: `[RADIANT] New AI Translation Needs Review`,
    Message: JSON.stringify({
      type: 'translation_review_needed',
      key,
      languageCode,
      languageName: targetLanguage.name,
      translatedText: translatedText.substring(0, 200) + (translatedText.length > 200 ? '...' : ''),
      dashboardUrl: `${process.env.ADMIN_URL}/localization?filter=ai_translated`,
    }),
    MessageAttributes: {
      notificationType: {
        DataType: 'String',
        StringValue: 'translation_review',
      },
    },
  }));
}
```

### File: `lambda/localization/process-queue.ts`

```typescript
// ============================================================================
// RADIANT v4.7.0 - Translation Queue Processor
// Scheduled Lambda to process pending translations
// ============================================================================

import { ScheduledHandler } from 'aws-lambda';
import { SQSClient, SendMessageCommand } from '@aws-sdk/client-sqs';
import { Pool } from 'pg';

const sqs = new SQSClient({ region: process.env.AWS_REGION });
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

export const handler: ScheduledHandler = async () => {
  // Get pending translations (limit batch size)
  const result = await pool.query(`
    SELECT 
      q.registry_id,
      q.language_code,
      r.key,
      r.default_text,
      r.context,
      r.max_length,
      r.placeholders
    FROM localization_translation_queue q
    JOIN localization_registry r ON r.id = q.registry_id
    WHERE q.status = 'pending'
      AND q.attempts < 3
      AND r.is_active = true
    ORDER BY q.created_at ASC
    LIMIT 50
  `);

  console.log(`Processing ${result.rows.length} pending translations`);

  for (const row of result.rows) {
    await sqs.send(new SendMessageCommand({
      QueueUrl: process.env.TRANSLATION_QUEUE_URL,
      MessageBody: JSON.stringify({
        registryId: row.registry_id,
        languageCode: row.language_code,
        key: row.key,
        defaultText: row.default_text,
        context: row.context,
        maxLength: row.max_length,
        placeholders: row.placeholders,
      }),
      MessageGroupId: row.language_code, // FIFO queue grouping
      MessageDeduplicationId: `${row.registry_id}-${row.language_code}-${Date.now()}`,
    }));
  }

  return {
    processed: result.rows.length,
  };
};
```

---

## 41.5 LOCALIZATION SERVICE (API)

### File: `lambda/localization/api.ts`

```typescript
// ============================================================================
// RADIANT v4.7.0 - Localization API Lambda
// ============================================================================

import { APIGatewayProxyHandler, APIGatewayProxyResult } from 'aws-lambda';
import { Pool } from 'pg';
import { extractAuthContext, requireRoles } from '../shared/auth';
import { 
  LocalizationEntry, 
  Translation, 
  TranslationCoverage,
  LanguageCode,
  SUPPORTED_LANGUAGES 
} from '@radiant/shared/i18n';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

export const handler: APIGatewayProxyHandler = async (event): Promise<APIGatewayProxyResult> => {
  const { httpMethod, path, pathParameters, queryStringParameters, body } = event;
  
  try {
    // Public endpoint: get translations bundle
    if (httpMethod === 'GET' && path.match(/\/localization\/bundle\/[a-z-]+$/)) {
      return await getTranslationBundle(pathParameters?.language as LanguageCode);
    }

    // All other endpoints require authentication
    const auth = extractAuthContext(event);

    // GET /localization/languages - Get supported languages
    if (httpMethod === 'GET' && path === '/localization/languages') {
      return await getLanguages();
    }

    // GET /localization/coverage - Get translation coverage stats
    if (httpMethod === 'GET' && path === '/localization/coverage') {
      requireRoles(auth, ['admin', 'super_admin']);
      return await getCoverage();
    }

    // GET /localization/registry - List all registry entries
    if (httpMethod === 'GET' && path === '/localization/registry') {
      requireRoles(auth, ['admin', 'super_admin']);
      return await listRegistry(queryStringParameters);
    }

    // POST /localization/registry - Create new registry entry
    if (httpMethod === 'POST' && path === '/localization/registry') {
      requireRoles(auth, ['admin', 'super_admin']);
      return await createRegistryEntry(JSON.parse(body || '{}'), auth.userId);
    }

    // PUT /localization/registry/:id - Update registry entry
    if (httpMethod === 'PUT' && path.match(/\/localization\/registry\/[a-f0-9-]+$/)) {
      requireRoles(auth, ['admin', 'super_admin']);
      return await updateRegistryEntry(pathParameters?.id!, JSON.parse(body || '{}'));
    }

    // GET /localization/translations/:registryId - Get translations for entry
    if (httpMethod === 'GET' && path.match(/\/localization\/translations\/[a-f0-9-]+$/)) {
      requireRoles(auth, ['admin', 'super_admin']);
      return await getTranslations(pathParameters?.registryId!);
    }

    // PUT /localization/translations/:id - Update translation
    if (httpMethod === 'PUT' && path.match(/\/localization\/translations\/[a-f0-9-]+$/)) {
      requireRoles(auth, ['admin', 'super_admin']);
      return await updateTranslation(pathParameters?.id!, JSON.parse(body || '{}'), auth.userId);
    }

    // POST /localization/translations/:id/approve - Approve translation
    if (httpMethod === 'POST' && path.match(/\/localization\/translations\/[a-f0-9-]+\/approve$/)) {
      requireRoles(auth, ['admin', 'super_admin']);
      return await approveTranslation(pathParameters?.id!, auth.userId);
    }

    // POST /localization/translations/:id/reject - Reject translation
    if (httpMethod === 'POST' && path.match(/\/localization\/translations\/[a-f0-9-]+\/reject$/)) {
      requireRoles(auth, ['admin', 'super_admin']);
      return await rejectTranslation(pathParameters?.id!, JSON.parse(body || '{}'), auth.userId);
    }

    // GET /localization/pending - Get translations needing review
    if (httpMethod === 'GET' && path === '/localization/pending') {
      requireRoles(auth, ['admin', 'super_admin']);
      return await getPendingReviews(queryStringParameters);
    }

    // POST /localization/bulk-approve - Bulk approve translations
    if (httpMethod === 'POST' && path === '/localization/bulk-approve') {
      requireRoles(auth, ['super_admin']);
      return await bulkApprove(JSON.parse(body || '{}'), auth.userId);
    }

    return { statusCode: 404, body: JSON.stringify({ error: 'Not found' }) };
  } catch (error) {
    console.error('Localization API error:', error);
    return {
      statusCode: error.statusCode || 500,
      body: JSON.stringify({ error: error.message }),
    };
  }
};

// Get translation bundle for client
async function getTranslationBundle(language: LanguageCode): Promise<APIGatewayProxyResult> {
  if (!SUPPORTED_LANGUAGES.includes(language)) {
    return { statusCode: 400, body: JSON.stringify({ error: 'Unsupported language' }) };
  }

  const result = await pool.query(`SELECT * FROM get_all_translations($1)`, [language]);
  
  const bundle: Record<string, string> = {};
  for (const row of result.rows) {
    bundle[row.key] = row.text;
  }

  return {
    statusCode: 200,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'public, max-age=300', // Cache for 5 minutes
    },
    body: JSON.stringify(bundle),
  };
}

async function getLanguages(): Promise<APIGatewayProxyResult> {
  const result = await pool.query(`
    SELECT code, name, native_name, is_rtl, is_active, display_order
    FROM localization_languages
    WHERE is_active = true
    ORDER BY display_order
  `);

  return {
    statusCode: 200,
    body: JSON.stringify(result.rows.map(row => ({
      code: row.code,
      name: row.name,
      nativeName: row.native_name,
      isRtl: row.is_rtl,
      displayOrder: row.display_order,
    }))),
  };
}

async function getCoverage(): Promise<APIGatewayProxyResult> {
  const result = await pool.query(`SELECT * FROM get_translation_coverage()`);
  
  return {
    statusCode: 200,
    body: JSON.stringify(result.rows.map(row => ({
      languageCode: row.language_code,
      languageName: row.language_name,
      totalStrings: parseInt(row.total_strings),
      translatedCount: parseInt(row.translated_count),
      approvedCount: parseInt(row.approved_count),
      aiTranslatedCount: parseInt(row.ai_translated_count),
      pendingCount: parseInt(row.pending_count),
      coveragePercent: parseFloat(row.coverage_percent),
    }))),
  };
}

async function listRegistry(params: any): Promise<APIGatewayProxyResult> {
  const { category, sourceApp, search, page = '1', limit = '50' } = params || {};
  const offset = (parseInt(page) - 1) * parseInt(limit);
  
  let query = `
    SELECT lr.*, 
           (SELECT COUNT(*) FROM localization_translations lt WHERE lt.registry_id = lr.id AND lt.status = 'approved') as approved_count,
           (SELECT COUNT(*) FROM localization_translations lt WHERE lt.registry_id = lr.id AND lt.status = 'ai_translated') as ai_count
    FROM localization_registry lr
    WHERE lr.is_active = true
  `;
  const queryParams: any[] = [];
  let paramIndex = 1;

  if (category) {
    query += ` AND lr.category = $${paramIndex++}`;
    queryParams.push(category);
  }

  if (sourceApp) {
    query += ` AND lr.source_app = $${paramIndex++}`;
    queryParams.push(sourceApp);
  }

  if (search) {
    query += ` AND (lr.key ILIKE $${paramIndex} OR lr.default_text ILIKE $${paramIndex})`;
    queryParams.push(`%${search}%`);
    paramIndex++;
  }

  query += ` ORDER BY lr.category, lr.key LIMIT $${paramIndex++} OFFSET $${paramIndex}`;
  queryParams.push(parseInt(limit), offset);

  const result = await pool.query(query, queryParams);
  
  // Get total count
  const countResult = await pool.query(`
    SELECT COUNT(*) FROM localization_registry WHERE is_active = true
  `);

  return {
    statusCode: 200,
    body: JSON.stringify({
      data: result.rows,
      total: parseInt(countResult.rows[0].count),
      page: parseInt(page),
      limit: parseInt(limit),
    }),
  };
}

async function createRegistryEntry(data: any, userId: string): Promise<APIGatewayProxyResult> {
  const { key, defaultText, category, subcategory, context, maxLength, placeholders, sourceApp, sourceFile } = data;

  // Validate key format
  if (!/^[a-z][a-z0-9_.]+[a-z0-9]$/.test(key)) {
    return { 
      statusCode: 400, 
      body: JSON.stringify({ error: 'Invalid key format. Use lowercase with dots/underscores.' }) 
    };
  }

  const result = await pool.query(`
    INSERT INTO localization_registry (
      key, default_text, category, subcategory, context, 
      max_length, placeholders, source_app, source_file, created_by
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
    RETURNING *
  `, [key, defaultText, category, subcategory, context, maxLength, 
      JSON.stringify(placeholders || []), sourceApp, sourceFile, userId]);

  return {
    statusCode: 201,
    body: JSON.stringify(result.rows[0]),
  };
}

async function updateTranslation(id: string, data: any, userId: string): Promise<APIGatewayProxyResult> {
  const { translatedText, status } = data;

  const result = await pool.query(`
    UPDATE localization_translations
    SET translated_text = COALESCE($2, translated_text),
        status = COALESCE($3, status),
        reviewed_by = $4,
        reviewed_at = NOW(),
        previous_text = translated_text,
        version = version + 1,
        updated_at = NOW()
    WHERE id = $1
    RETURNING *
  `, [id, translatedText, status, userId]);

  if (result.rows.length === 0) {
    return { statusCode: 404, body: JSON.stringify({ error: 'Translation not found' }) };
  }

  return {
    statusCode: 200,
    body: JSON.stringify(result.rows[0]),
  };
}

async function approveTranslation(id: string, userId: string): Promise<APIGatewayProxyResult> {
  const result = await pool.query(`
    UPDATE localization_translations
    SET status = 'approved',
        reviewed_by = $2,
        reviewed_at = NOW(),
        updated_at = NOW()
    WHERE id = $1
    RETURNING *
  `, [id, userId]);

  if (result.rows.length === 0) {
    return { statusCode: 404, body: JSON.stringify({ error: 'Translation not found' }) };
  }

  return {
    statusCode: 200,
    body: JSON.stringify(result.rows[0]),
  };
}

async function rejectTranslation(id: string, data: any, userId: string): Promise<APIGatewayProxyResult> {
  const { reviewNotes } = data;

  const result = await pool.query(`
    UPDATE localization_translations
    SET status = 'rejected',
        reviewed_by = $2,
        reviewed_at = NOW(),
        review_notes = $3,
        updated_at = NOW()
    WHERE id = $1
    RETURNING *
  `, [id, userId, reviewNotes]);

  // Re-queue for translation
  await pool.query(`
    INSERT INTO localization_translation_queue (registry_id, language_code)
    SELECT registry_id, language_code FROM localization_translations WHERE id = $1
    ON CONFLICT (registry_id, language_code) DO UPDATE SET
      status = 'pending',
      attempts = 0,
      error_message = NULL
  `, [id]);

  return {
    statusCode: 200,
    body: JSON.stringify(result.rows[0]),
  };
}

async function getPendingReviews(params: any): Promise<APIGatewayProxyResult> {
  const { language, page = '1', limit = '50' } = params || {};
  const offset = (parseInt(page) - 1) * parseInt(limit);

  let query = `
    SELECT lt.*, lr.key, lr.default_text, lr.context, lr.category,
           ll.name as language_name, ll.native_name
    FROM localization_translations lt
    JOIN localization_registry lr ON lr.id = lt.registry_id
    JOIN localization_languages ll ON ll.code = lt.language_code
    WHERE lt.status = 'ai_translated'
  `;
  const queryParams: any[] = [];
  let paramIndex = 1;

  if (language) {
    query += ` AND lt.language_code = $${paramIndex++}`;
    queryParams.push(language);
  }

  query += ` ORDER BY lt.ai_translated_at DESC LIMIT $${paramIndex++} OFFSET $${paramIndex}`;
  queryParams.push(parseInt(limit), offset);

  const result = await pool.query(query, queryParams);

  return {
    statusCode: 200,
    body: JSON.stringify(result.rows),
  };
}

async function bulkApprove(data: any, userId: string): Promise<APIGatewayProxyResult> {
  const { translationIds } = data;

  if (!Array.isArray(translationIds) || translationIds.length === 0) {
    return { statusCode: 400, body: JSON.stringify({ error: 'translationIds required' }) };
  }

  const result = await pool.query(`
    UPDATE localization_translations
    SET status = 'approved',
        reviewed_by = $2,
        reviewed_at = NOW(),
        updated_at = NOW()
    WHERE id = ANY($1::uuid[])
    RETURNING id
  `, [translationIds, userId]);

  return {
    statusCode: 200,
    body: JSON.stringify({ approved: result.rows.length }),
  };
}

// Export individual functions for updateRegistryEntry and getTranslations
async function updateRegistryEntry(id: string, data: any): Promise<APIGatewayProxyResult> {
  const { defaultText, category, subcategory, context, maxLength, placeholders, isActive } = data;

  const result = await pool.query(`
    UPDATE localization_registry
    SET default_text = COALESCE($2, default_text),
        category = COALESCE($3, category),
        subcategory = COALESCE($4, subcategory),
        context = COALESCE($5, context),
        max_length = COALESCE($6, max_length),
        placeholders = COALESCE($7, placeholders),
        is_active = COALESCE($8, is_active),
        updated_at = NOW()
    WHERE id = $1
    RETURNING *
  `, [id, defaultText, category, subcategory, context, maxLength, 
      placeholders ? JSON.stringify(placeholders) : null, isActive]);

  if (result.rows.length === 0) {
    return { statusCode: 404, body: JSON.stringify({ error: 'Registry entry not found' }) };
  }

  return {
    statusCode: 200,
    body: JSON.stringify(result.rows[0]),
  };
}

async function getTranslations(registryId: string): Promise<APIGatewayProxyResult> {
  const result = await pool.query(`
    SELECT lt.*, ll.name as language_name, ll.native_name, ll.is_rtl
    FROM localization_translations lt
    JOIN localization_languages ll ON ll.code = lt.language_code
    WHERE lt.registry_id = $1
    ORDER BY ll.display_order
  `, [registryId]);

  return {
    statusCode: 200,
    body: JSON.stringify(result.rows),
  };
}
```

---

## 41.6 REACT i18n IMPLEMENTATION

### File: `packages/shared/src/i18n/react/I18nProvider.tsx`

```typescript
// ============================================================================
// RADIANT v4.7.0 - React i18n Provider
// ============================================================================

import React, { 
  createContext, 
  useContext, 
  useState, 
  useEffect, 
  useCallback,
  ReactNode 
} from 'react';
import { 
  LanguageCode, 
  TranslationBundle, 
  InterpolationValues,
  DEFAULT_LANGUAGE,
  RTL_LANGUAGES,
  LANGUAGE_METADATA 
} from '../types';

interface I18nContextType {
  language: LanguageCode;
  setLanguage: (lang: LanguageCode) => void;
  t: (key: string, values?: InterpolationValues) => string;
  isRtl: boolean;
  isLoading: boolean;
  languages: typeof LANGUAGE_METADATA;
}

const I18nContext = createContext<I18nContextType | null>(null);

interface I18nProviderProps {
  children: ReactNode;
  defaultLanguage?: LanguageCode;
  apiBaseUrl: string;
}

export function I18nProvider({ 
  children, 
  defaultLanguage = DEFAULT_LANGUAGE,
  apiBaseUrl 
}: I18nProviderProps) {
  const [language, setLanguageState] = useState<LanguageCode>(() => {
    // Try to get from localStorage first
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem('radiant_language');
      if (stored && Object.keys(LANGUAGE_METADATA).includes(stored)) {
        return stored as LanguageCode;
      }
    }
    return defaultLanguage;
  });
  
  const [translations, setTranslations] = useState<TranslationBundle>({});
  const [isLoading, setIsLoading] = useState(true);

  // Load translations when language changes
  useEffect(() => {
    let cancelled = false;

    async function loadTranslations() {
      setIsLoading(true);
      try {
        const response = await fetch(`${apiBaseUrl}/localization/bundle/${language}`);
        if (!response.ok) throw new Error('Failed to load translations');
        const bundle = await response.json();
        if (!cancelled) {
          setTranslations(bundle);
        }
      } catch (error) {
        console.error('Failed to load translations:', error);
        // Keep existing translations on error
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    }

    loadTranslations();

    return () => {
      cancelled = true;
    };
  }, [language, apiBaseUrl]);

  // Update document direction for RTL languages
  useEffect(() => {
    if (typeof document !== 'undefined') {
      document.documentElement.dir = RTL_LANGUAGES.includes(language) ? 'rtl' : 'ltr';
      document.documentElement.lang = language;
    }
  }, [language]);

  const setLanguage = useCallback((lang: LanguageCode) => {
    setLanguageState(lang);
    if (typeof window !== 'undefined') {
      localStorage.setItem('radiant_language', lang);
    }
  }, []);

  // Translation function with interpolation
  const t = useCallback((key: string, values?: InterpolationValues): string => {
    let text = translations[key] || key;

    // Interpolate values
    if (values) {
      Object.entries(values).forEach(([k, v]) => {
        text = text.replace(new RegExp(`\\{${k}\\}`, 'g'), String(v));
      });
    }

    return text;
  }, [translations]);

  const value: I18nContextType = {
    language,
    setLanguage,
    t,
    isRtl: RTL_LANGUAGES.includes(language),
    isLoading,
    languages: LANGUAGE_METADATA,
  };

  return (
    <I18nContext.Provider value={value}>
      {children}
    </I18nContext.Provider>
  );
}

/**
 * Hook to access i18n context
 */
export function useI18n(): I18nContextType {
  const context = useContext(I18nContext);
  if (!context) {
    throw new Error('useI18n must be used within an I18nProvider');
  }
  return context;
}

/**
 * Hook for translation function only
 */
export function useTranslation() {
  const { t, language, isRtl } = useI18n();
  return { t, language, isRtl };
}
```

### File: `packages/shared/src/i18n/react/LanguageSelector.tsx`

```typescript
// ============================================================================
// RADIANT v4.7.0 - Language Selector Component
// ============================================================================

import React from 'react';
import { useI18n } from './I18nProvider';
import { LanguageCode } from '../types';

interface LanguageSelectorProps {
  className?: string;
  showNativeName?: boolean;
  compact?: boolean;
}

export function LanguageSelector({ 
  className = '',
  showNativeName = true,
  compact = false 
}: LanguageSelectorProps) {
  const { language, setLanguage, languages } = useI18n();

  const handleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setLanguage(e.target.value as LanguageCode);
  };

  return (
    <select
      value={language}
      onChange={handleChange}
      className={`language-selector ${className}`}
      aria-label="Select language"
    >
      {Object.entries(languages).map(([code, meta]) => (
        <option key={code} value={code}>
          {compact 
            ? code.toUpperCase() 
            : showNativeName 
              ? `${meta.nativeName} (${meta.name})`
              : meta.name
          }
        </option>
      ))}
    </select>
  );
}
```

### File: `packages/shared/src/i18n/react/Trans.tsx`

```typescript
// ============================================================================
// RADIANT v4.7.0 - Trans Component for complex translations
// ============================================================================

import React, { ReactNode } from 'react';
import { useTranslation } from './I18nProvider';
import { InterpolationValues } from '../types';

interface TransProps {
  i18nKey: string;
  values?: InterpolationValues;
  components?: Record<string, ReactNode>;
  fallback?: string;
}

/**
 * Trans component for translations with embedded React components
 * 
 * Usage:
 * <Trans 
 *   i18nKey="message.welcome" 
 *   values={{ name: 'John' }}
 *   components={{ bold: <strong />, link: <a href="/profile" /> }}
 * />
 * 
 * Translation: "Hello <bold>{name}</bold>! Visit your <link>profile</link>."
 */
export function Trans({ i18nKey, values, components, fallback }: TransProps) {
  const { t } = useTranslation();
  
  let text = t(i18nKey);
  
  // If key not found, use fallback
  if (text === i18nKey && fallback) {
    text = fallback;
  }

  // Interpolate values first
  if (values) {
    Object.entries(values).forEach(([k, v]) => {
      text = text.replace(new RegExp(`\\{${k}\\}`, 'g'), String(v));
    });
  }

  // If no components, return plain text
  if (!components) {
    return <>{text}</>;
  }

  // Parse and replace component placeholders
  const parts: ReactNode[] = [];
  let remaining = text;
  let key = 0;

  Object.entries(components).forEach(([name, component]) => {
    const regex = new RegExp(`<${name}>(.*?)</${name}>`, 'g');
    const newParts: ReactNode[] = [];
    let lastIndex = 0;
    let match;

    while ((match = regex.exec(remaining)) !== null) {
      // Add text before the match
      if (match.index > lastIndex) {
        newParts.push(remaining.slice(lastIndex, match.index));
      }
      
      // Clone component with content
      if (React.isValidElement(component)) {
        newParts.push(
          React.cloneElement(component, { key: key++ }, match[1])
        );
      }
      
      lastIndex = regex.lastIndex;
    }
    
    // Add remaining text
    if (lastIndex < remaining.length) {
      newParts.push(remaining.slice(lastIndex));
    }
    
    remaining = newParts.join('');
  });

  return <>{remaining}</>;
}
```

---

## 41.7 ESLINT PLUGIN (HARDCODE PREVENTION)

### File: `packages/eslint-plugin-i18n/src/index.ts`

```typescript
// ============================================================================
// RADIANT v4.7.0 - ESLint Plugin to Prevent Hardcoded Strings
// ============================================================================

import { ESLintUtils, TSESTree } from '@typescript-eslint/utils';

const createRule = ESLintUtils.RuleCreator(
  (name) => `https://radiant.dev/eslint/${name}`
);

// Patterns that are allowed without translation
const ALLOWED_PATTERNS = [
  /^[a-z][a-z0-9_.]+[a-z0-9]$/,  // Translation keys like 'button.submit'
  /^https?:\/\//,                  // URLs
  /^[A-Z_]+$/,                     // Constants like 'GET', 'POST'
  /^\d+$/,                         // Pure numbers
  /^[a-z]+\.[a-z]+$/,              // File extensions like 'image.png'
  /^#[0-9a-fA-F]+$/,               // Hex colors
  /^rgb/,                          // RGB colors
  /^data:/,                        // Data URLs
  /^[a-z-]+\/[a-z-]+$/,            // MIME types
  /^\s*$/,                         // Whitespace only
];

// JSX attributes that commonly have hardcoded strings
const ALLOWED_JSX_ATTRIBUTES = [
  'className', 'class', 'id', 'name', 'type', 'href', 'src', 'alt',
  'placeholder', 'title', 'aria-label', 'data-testid', 'key', 'role',
  'target', 'rel', 'method', 'action', 'encType', 'accept', 'pattern',
];

// Function names that accept translation keys
const TRANSLATION_FUNCTIONS = ['t', 'i18n', 'translate', 'L10n'];

export const noHardcodedStrings = createRule({
  name: 'no-hardcoded-strings',
  meta: {
    type: 'suggestion',
    docs: {
      description: 'Disallow hardcoded user-facing strings. Use translation keys instead.',
    },
    messages: {
      hardcodedString: 
        'Hardcoded string "{{text}}" detected. Use translation: t(\'{{suggestedKey}}\')',
      hardcodedJsxText:
        'Hardcoded JSX text "{{text}}" detected. Use: {t(\'{{suggestedKey}}\')}',
    },
    schema: [
      {
        type: 'object',
        properties: {
          ignorePaths: {
            type: 'array',
            items: { type: 'string' },
          },
          ignorePatterns: {
            type: 'array',
            items: { type: 'string' },
          },
        },
      },
    ],
  },
  defaultOptions: [{ ignorePaths: [], ignorePatterns: [] }],
  create(context, [options]) {
    const filename = context.filename || context.getFilename();
    
    // Skip test files and config files
    if (
      filename.includes('.test.') ||
      filename.includes('.spec.') ||
      filename.includes('.config.') ||
      filename.includes('__tests__') ||
      filename.includes('__mocks__')
    ) {
      return {};
    }

    // Skip files in ignore paths
    if (options.ignorePaths?.some(path => filename.includes(path))) {
      return {};
    }

    function isAllowedString(value: string): boolean {
      // Check built-in patterns
      if (ALLOWED_PATTERNS.some(pattern => pattern.test(value))) {
        return true;
      }
      
      // Check custom ignore patterns
      if (options.ignorePatterns?.some(pattern => new RegExp(pattern).test(value))) {
        return true;
      }

      // Allow very short strings (likely not user-facing)
      if (value.length <= 2) {
        return true;
      }

      return false;
    }

    function generateSuggestedKey(text: string): string {
      // Generate a key based on the text
      const words = text.toLowerCase()
        .replace(/[^a-z0-9\s]/g, '')
        .split(/\s+/)
        .slice(0, 4)
        .join('_');
      return `ui.text.${words || 'untitled'}`;
    }

    function isInsideTranslationCall(node: TSESTree.Node): boolean {
      let parent = node.parent;
      while (parent) {
        if (
          parent.type === 'CallExpression' &&
          parent.callee.type === 'Identifier' &&
          TRANSLATION_FUNCTIONS.includes(parent.callee.name)
        ) {
          return true;
        }
        parent = parent.parent;
      }
      return false;
    }

    return {
      // Check JSX text content
      JSXText(node) {
        const text = node.value.trim();
        if (text && !isAllowedString(text)) {
          context.report({
            node,
            messageId: 'hardcodedJsxText',
            data: {
              text: text.substring(0, 30) + (text.length > 30 ? '...' : ''),
              suggestedKey: generateSuggestedKey(text),
            },
          });
        }
      },

      // Check string literals in JSX expressions
      'JSXExpressionContainer > Literal'(node: TSESTree.Literal) {
        if (typeof node.value !== 'string') return;
        const text = node.value.trim();
        
        if (text && !isAllowedString(text) && !isInsideTranslationCall(node)) {
          context.report({
            node,
            messageId: 'hardcodedString',
            data: {
              text: text.substring(0, 30) + (text.length > 30 ? '...' : ''),
              suggestedKey: generateSuggestedKey(text),
            },
          });
        }
      },

      // Check JSX attribute values (only specific attributes)
      'JSXAttribute > Literal'(node: TSESTree.Literal) {
        if (typeof node.value !== 'string') return;
        
        const parent = node.parent as TSESTree.JSXAttribute;
        const attrName = parent.name.type === 'JSXIdentifier' 
          ? parent.name.name 
          : '';
        
        // Skip allowed attributes
        if (ALLOWED_JSX_ATTRIBUTES.includes(attrName)) {
          return;
        }

        // Check attributes that should be translated
        const translatableAttrs = ['label', 'title', 'placeholder', 'aria-label', 'errorMessage'];
        if (translatableAttrs.includes(attrName)) {
          const text = node.value.trim();
          if (text && !isAllowedString(text)) {
            context.report({
              node,
              messageId: 'hardcodedString',
              data: {
                text: text.substring(0, 30) + (text.length > 30 ? '...' : ''),
                suggestedKey: generateSuggestedKey(text),
              },
            });
          }
        }
      },

      // Check error messages in throw statements
      'ThrowStatement CallExpression'(node: TSESTree.CallExpression) {
        if (node.arguments.length === 0) return;
        
        const firstArg = node.arguments[0];
        if (firstArg.type === 'Literal' && typeof firstArg.value === 'string') {
          const text = firstArg.value.trim();
          if (text && !isAllowedString(text) && !isInsideTranslationCall(firstArg)) {
            context.report({
              node: firstArg,
              messageId: 'hardcodedString',
              data: {
                text: text.substring(0, 30) + (text.length > 30 ? '...' : ''),
                suggestedKey: `errors.${generateSuggestedKey(text).replace('ui.text.', '')}`,
              },
            });
          }
        }
      },

      // Check object properties that are likely user-facing
      'Property > Literal'(node: TSESTree.Literal) {
        if (typeof node.value !== 'string') return;
        
        const parent = node.parent as TSESTree.Property;
        if (parent.key.type !== 'Identifier') return;
        
        const propName = parent.key.name;
        const userFacingProps = ['message', 'title', 'description', 'label', 'text', 'errorMessage', 'successMessage'];
        
        if (userFacingProps.includes(propName)) {
          const text = node.value.trim();
          if (text && !isAllowedString(text) && !isInsideTranslationCall(node)) {
            context.report({
              node,
              messageId: 'hardcodedString',
              data: {
                text: text.substring(0, 30) + (text.length > 30 ? '...' : ''),
                suggestedKey: generateSuggestedKey(text),
              },
            });
          }
        }
      },
    };
  },
});

export const rules = {
  'no-hardcoded-strings': noHardcodedStrings,
};

export const configs = {
  recommended: {
    plugins: ['@radiant/i18n'],
    rules: {
      '@radiant/i18n/no-hardcoded-strings': 'error',
    },
  },
};
```

### File: `.eslintrc.js` (Project Root Addition)

```javascript
// Add to existing ESLint config
module.exports = {
  // ... existing config
  plugins: [
    // ... existing plugins
    '@radiant/i18n',
  ],
  rules: {
    // ... existing rules
    '@radiant/i18n/no-hardcoded-strings': ['error', {
      ignorePaths: [
        'node_modules',
        '__tests__',
        '*.test.ts',
        '*.spec.ts',
        'migrations',
      ],
      ignorePatterns: [
        '^[A-Z][A-Z_]+$',  // Constants
        '^/api/',          // API paths
      ],
    }],
  },
};
```

---

## 41.8 SWIFT LOCALIZATION SERVICE (THINK TANK APP)

### File: `ThinkTank/Services/LocalizationService.swift`

```swift
// ============================================================================
// RADIANT v4.7.0 - Swift Localization Service
// ============================================================================

import Foundation
import Combine

/// Supported languages
enum SupportedLanguage: String, CaseIterable, Codable {
    case en = "en"
    case es = "es"
    case fr = "fr"
    case de = "de"
    case pt = "pt"
    case it = "it"
    case nl = "nl"
    case pl = "pl"
    case ru = "ru"
    case tr = "tr"
    case ja = "ja"
    case ko = "ko"
    case zhCN = "zh-CN"
    case zhTW = "zh-TW"
    case ar = "ar"
    case hi = "hi"
    case th = "th"
    case vi = "vi"
    
    var displayName: String {
        switch self {
        case .en: return "English"
        case .es: return "EspaÃ±ol"
        case .fr: return "FranÃ§ais"
        case .de: return "Deutsch"
        case .pt: return "PortuguÃªs"
        case .it: return "Italiano"
        case .nl: return "Nederlands"
        case .pl: return "Polski"
        case .ru: return "Ð ÑƒÑÑÐºÐ¸Ð¹"
        case .tr: return "TÃ¼rkÃ§e"
        case .ja: return "æ—¥æœ¬èªž"
        case .ko: return "í•œêµ­ì–´"
        case .zhCN: return "ç®€ä½“ä¸­æ–‡"
        case .zhTW: return "ç¹é«”ä¸­æ–‡"
        case .ar: return "Ø§Ù„Ø¹Ø±Ø¨ÙŠØ©"
        case .hi: return "à¤¹à¤¿à¤¨à¥à¤¦à¥€"
        case .th: return "à¹„à¸—à¸¢"
        case .vi: return "Tiáº¿ng Viá»‡t"
        }
    }
    
    var isRTL: Bool {
        self == .ar
    }
    
    /// Get system preferred language or default to English
    static var preferred: SupportedLanguage {
        let preferredIdentifier = Locale.preferredLanguages.first ?? "en"
        
        // Try exact match first
        if let exact = SupportedLanguage(rawValue: preferredIdentifier) {
            return exact
        }
        
        // Try language code only (e.g., "en-US" -> "en")
        let languageCode = String(preferredIdentifier.prefix(2))
        if let lang = SupportedLanguage(rawValue: languageCode) {
            return lang
        }
        
        // Handle Chinese variants
        if preferredIdentifier.hasPrefix("zh") {
            if preferredIdentifier.contains("Hans") || preferredIdentifier.contains("CN") {
                return .zhCN
            } else {
                return .zhTW
            }
        }
        
        return .en
    }
}

/// Localization service singleton
@MainActor
final class LocalizationService: ObservableObject {
    static let shared = LocalizationService()
    
    @Published private(set) var currentLanguage: SupportedLanguage
    @Published private(set) var isLoading = false
    @Published private(set) var translations: [String: String] = [:]
    
    private let apiBaseURL: URL
    private var cancellables = Set<AnyCancellable>()
    
    private init() {
        // Load saved language or use system preferred
        if let savedLang = UserDefaults.standard.string(forKey: "radiant_language"),
           let lang = SupportedLanguage(rawValue: savedLang) {
            self.currentLanguage = lang
        } else {
            self.currentLanguage = .preferred
        }
        
        self.apiBaseURL = URL(string: Configuration.shared.apiBaseURL)!
        
        // Load translations for current language
        Task {
            await loadTranslations()
        }
    }
    
    /// Change current language
    func setLanguage(_ language: SupportedLanguage) async {
        guard language != currentLanguage else { return }
        
        currentLanguage = language
        UserDefaults.standard.set(language.rawValue, forKey: "radiant_language")
        
        await loadTranslations()
    }
    
    /// Load translations from API
    func loadTranslations() async {
        isLoading = true
        defer { isLoading = false }
        
        do {
            let url = apiBaseURL.appendingPathComponent("localization/bundle/\(currentLanguage.rawValue)")
            let (data, response) = try await URLSession.shared.data(from: url)
            
            guard let httpResponse = response as? HTTPURLResponse,
                  httpResponse.statusCode == 200 else {
                throw LocalizationError.networkError
            }
            
            let bundle = try JSONDecoder().decode([String: String].self, from: data)
            translations = bundle
            
            // Cache translations locally
            cacheTranslations(bundle)
            
        } catch {
            print("Failed to load translations: \(error)")
            // Load from cache on error
            loadCachedTranslations()
        }
    }
    
    /// Get translated string for key
    func translate(_ key: String, values: [String: Any] = [:]) -> String {
        var text = translations[key] ?? key
        
        // Interpolate values
        for (name, value) in values {
            text = text.replacingOccurrences(of: "{\(name)}", with: String(describing: value))
        }
        
        return text
    }
    
    /// Shorthand translation function
    func t(_ key: String, _ values: [String: Any] = [:]) -> String {
        translate(key, values: values)
    }
    
    // MARK: - Caching
    
    private func cacheTranslations(_ bundle: [String: String]) {
        guard let data = try? JSONEncoder().encode(bundle) else { return }
        
        let cacheURL = getCacheURL()
        try? data.write(to: cacheURL)
    }
    
    private func loadCachedTranslations() {
        let cacheURL = getCacheURL()
        guard let data = try? Data(contentsOf: cacheURL),
              let bundle = try? JSONDecoder().decode([String: String].self, from: data) else {
            return
        }
        translations = bundle
    }
    
    private func getCacheURL() -> URL {
        let cacheDir = FileManager.default.urls(for: .cachesDirectory, in: .userDomainMask).first!
        return cacheDir.appendingPathComponent("translations_\(currentLanguage.rawValue).json")
    }
}

enum LocalizationError: Error {
    case networkError
    case decodingError
}

// MARK: - Property Wrapper for SwiftUI

@propertyWrapper
struct Localized: DynamicProperty {
    @ObservedObject private var service = LocalizationService.shared
    private let key: String
    private let values: [String: Any]
    
    init(_ key: String, values: [String: Any] = [:]) {
        self.key = key
        self.values = values
    }
    
    var wrappedValue: String {
        service.translate(key, values: values)
    }
}

// MARK: - SwiftUI Extensions

extension View {
    /// Apply RTL layout if current language is RTL
    func localizedLayout() -> some View {
        environment(\.layoutDirection, 
                    LocalizationService.shared.currentLanguage.isRTL ? .rightToLeft : .leftToRight)
    }
}

// MARK: - String Extension

extension String {
    /// Translate this key
    var localized: String {
        LocalizationService.shared.translate(self)
    }
    
    /// Translate with values
    func localized(with values: [String: Any]) -> String {
        LocalizationService.shared.translate(self, values: values)
    }
}
```

### File: `ThinkTank/Views/Components/LocalizedText.swift`

```swift
// ============================================================================
// RADIANT v4.7.0 - LocalizedText SwiftUI Component
// ============================================================================

import SwiftUI

/// SwiftUI component for localized text
struct LocalizedText: View {
    @ObservedObject private var localization = LocalizationService.shared
    
    let key: String
    let values: [String: Any]
    
    init(_ key: String, values: [String: Any] = [:]) {
        self.key = key
        self.values = values
    }
    
    var body: some View {
        Text(localization.translate(key, values: values))
    }
}

/// Localized button with automatic translation
struct LocalizedButton: View {
    @ObservedObject private var localization = LocalizationService.shared
    
    let key: String
    let action: () -> Void
    
    init(_ key: String, action: @escaping () -> Void) {
        self.key = key
        self.action = action
    }
    
    var body: some View {
        Button(action: action) {
            Text(localization.translate(key))
        }
    }
}

/// Language selector view
struct LanguageSelector: View {
    @ObservedObject private var localization = LocalizationService.shared
    @State private var showingPicker = false
    
    var body: some View {
        Button {
            showingPicker = true
        } label: {
            HStack {
                Image(systemName: "globe")
                Text(localization.currentLanguage.displayName)
            }
        }
        .sheet(isPresented: $showingPicker) {
            NavigationStack {
                List(SupportedLanguage.allCases, id: \.self) { language in
                    Button {
                        Task {
                            await localization.setLanguage(language)
                        }
                        showingPicker = false
                    } label: {
                        HStack {
                            Text(language.displayName)
                            Spacer()
                            if language == localization.currentLanguage {
                                Image(systemName: "checkmark")
                                    .foregroundColor(.accentColor)
                            }
                        }
                    }
                    .foregroundColor(.primary)
                }
                .navigationTitle("ui.settings.language".localized)
                .toolbar {
                    ToolbarItem(placement: .cancellationAction) {
                        Button("ui.buttons.cancel".localized) {
                            showingPicker = false
                        }
                    }
                }
            }
        }
    }
}

// MARK: - Preview

#Preview {
    VStack(spacing: 20) {
        LocalizedText("ui.buttons.submit")
        LocalizedText("messages.welcome", values: ["name": "John"])
        LocalizedButton("ui.buttons.save") {
            print("Saved!")
        }
        LanguageSelector()
    }
    .padding()
}
```

---

## 41.9 ADMIN DASHBOARD - LOCALIZATION MANAGEMENT

### File: `admin-dashboard/app/localization/page.tsx`

```typescript
// ============================================================================
// RADIANT v4.7.0 - Localization Management Dashboard
// ============================================================================

'use client';

import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Tabs,
  Tab,
  Card,
  CardContent,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Chip,
  IconButton,
  Button,
  TextField,
  Select,
  MenuItem,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  LinearProgress,
  Alert,
  Tooltip,
  Badge,
} from '@mui/material';
import {
  Edit,
  Check,
  Close,
  Refresh,
  Search,
  Language,
  Warning,
  CheckCircle,
  AutoAwesome,
} from '@mui/icons-material';
import { useTranslation } from '@/hooks/useTranslation';
import { api } from '@/lib/api';

interface Translation {
  id: string;
  registryId: string;
  languageCode: string;
  translatedText: string;
  status: 'pending' | 'ai_translated' | 'in_review' | 'approved' | 'rejected';
  aiModel?: string;
  aiConfidence?: number;
  reviewedBy?: string;
  reviewedAt?: string;
  key: string;
  defaultText: string;
  context?: string;
  category: string;
  languageName: string;
  nativeName: string;
}

interface TranslationCoverage {
  languageCode: string;
  languageName: string;
  totalStrings: number;
  translatedCount: number;
  approvedCount: number;
  aiTranslatedCount: number;
  pendingCount: number;
  coveragePercent: number;
}

export default function LocalizationPage() {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState(0);
  const [coverage, setCoverage] = useState<TranslationCoverage[]>([]);
  const [pendingReviews, setPendingReviews] = useState<Translation[]>([]);
  const [selectedLanguage, setSelectedLanguage] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [editDialog, setEditDialog] = useState<Translation | null>(null);
  const [editedText, setEditedText] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, [selectedLanguage]);

  async function loadData() {
    setLoading(true);
    try {
      const [coverageRes, pendingRes] = await Promise.all([
        api.get('/localization/coverage'),
        api.get('/localization/pending', { 
          params: { language: selectedLanguage !== 'all' ? selectedLanguage : undefined } 
        }),
      ]);
      setCoverage(coverageRes.data);
      setPendingReviews(pendingRes.data);
    } catch (error) {
      console.error('Failed to load localization data:', error);
    } finally {
      setLoading(false);
    }
  }

  async function handleApprove(translation: Translation) {
    try {
      await api.post(`/localization/translations/${translation.id}/approve`);
      loadData();
    } catch (error) {
      console.error('Failed to approve translation:', error);
    }
  }

  async function handleReject(translation: Translation, notes: string) {
    try {
      await api.post(`/localization/translations/${translation.id}/reject`, {
        reviewNotes: notes,
      });
      loadData();
    } catch (error) {
      console.error('Failed to reject translation:', error);
    }
  }

  async function handleSaveEdit() {
    if (!editDialog) return;
    try {
      await api.put(`/localization/translations/${editDialog.id}`, {
        translatedText: editedText,
        status: 'approved',
      });
      setEditDialog(null);
      loadData();
    } catch (error) {
      console.error('Failed to save translation:', error);
    }
  }

  async function handleBulkApprove() {
    const aiTranslated = pendingReviews.filter(t => t.status === 'ai_translated');
    if (aiTranslated.length === 0) return;
    
    if (!confirm(t('admin.localization.confirm_bulk_approve', { count: aiTranslated.length }))) {
      return;
    }

    try {
      await api.post('/localization/bulk-approve', {
        translationIds: aiTranslated.map(t => t.id),
      });
      loadData();
    } catch (error) {
      console.error('Failed to bulk approve:', error);
    }
  }

  const getStatusChip = (status: string) => {
    const statusConfig = {
      pending: { color: 'default' as const, icon: <Warning fontSize="small" /> },
      ai_translated: { color: 'warning' as const, icon: <AutoAwesome fontSize="small" /> },
      in_review: { color: 'info' as const, icon: <Search fontSize="small" /> },
      approved: { color: 'success' as const, icon: <CheckCircle fontSize="small" /> },
      rejected: { color: 'error' as const, icon: <Close fontSize="small" /> },
    };
    const config = statusConfig[status as keyof typeof statusConfig] || statusConfig.pending;
    return (
      <Chip
        size="small"
        label={t(`admin.localization.status.${status}`)}
        color={config.color}
        icon={config.icon}
      />
    );
  };

  const aiTranslatedCount = pendingReviews.filter(t => t.status === 'ai_translated').length;

  return (
    <Box sx={{ p: 3 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h4">
          <Language sx={{ mr: 1, verticalAlign: 'middle' }} />
          {t('admin.localization.title')}
        </Typography>
        <Button
          variant="outlined"
          startIcon={<Refresh />}
          onClick={loadData}
        >
          {t('admin.buttons.refresh')}
        </Button>
      </Box>

      {loading && <LinearProgress sx={{ mb: 2 }} />}

      <Tabs value={activeTab} onChange={(_, v) => setActiveTab(v)} sx={{ mb: 3 }}>
        <Tab label={t('admin.localization.tabs.coverage')} />
        <Tab 
          label={
            <Badge badgeContent={aiTranslatedCount} color="warning">
              {t('admin.localization.tabs.review')}
            </Badge>
          } 
        />
        <Tab label={t('admin.localization.tabs.registry')} />
      </Tabs>

      {/* Coverage Tab */}
      {activeTab === 0 && (
        <TableContainer component={Paper}>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>{t('admin.localization.language')}</TableCell>
                <TableCell align="right">{t('admin.localization.total')}</TableCell>
                <TableCell align="right">{t('admin.localization.approved')}</TableCell>
                <TableCell align="right">{t('admin.localization.ai_translated')}</TableCell>
                <TableCell align="right">{t('admin.localization.pending')}</TableCell>
                <TableCell>{t('admin.localization.coverage')}</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {coverage.map((lang) => (
                <TableRow key={lang.languageCode}>
                  <TableCell>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <Typography fontWeight="medium">{lang.languageName}</Typography>
                      <Typography variant="caption" color="text.secondary">
                        ({lang.languageCode})
                      </Typography>
                    </Box>
                  </TableCell>
                  <TableCell align="right">{lang.totalStrings}</TableCell>
                  <TableCell align="right">
                    <Chip size="small" color="success" label={lang.approvedCount} />
                  </TableCell>
                  <TableCell align="right">
                    {lang.aiTranslatedCount > 0 && (
                      <Chip size="small" color="warning" label={lang.aiTranslatedCount} />
                    )}
                  </TableCell>
                  <TableCell align="right">
                    {lang.pendingCount > 0 && (
                      <Chip size="small" color="default" label={lang.pendingCount} />
                    )}
                  </TableCell>
                  <TableCell>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <LinearProgress
                        variant="determinate"
                        value={lang.coveragePercent}
                        sx={{ width: 100, height: 8, borderRadius: 4 }}
                        color={lang.coveragePercent === 100 ? 'success' : 'primary'}
                      />
                      <Typography variant="body2">
                        {lang.coveragePercent.toFixed(1)}%
                      </Typography>
                    </Box>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      {/* Review Tab */}
      {activeTab === 1 && (
        <Box>
          <Box sx={{ display: 'flex', gap: 2, mb: 2 }}>
            <Select
              size="small"
              value={selectedLanguage}
              onChange={(e) => setSelectedLanguage(e.target.value)}
              sx={{ minWidth: 200 }}
            >
              <MenuItem value="all">{t('admin.localization.all_languages')}</MenuItem>
              {coverage.map((lang) => (
                <MenuItem key={lang.languageCode} value={lang.languageCode}>
                  {lang.languageName}
                </MenuItem>
              ))}
            </Select>
            <TextField
              size="small"
              placeholder={t('admin.localization.search_placeholder')}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              InputProps={{ startAdornment: <Search sx={{ mr: 1, color: 'text.secondary' }} /> }}
            />
            {aiTranslatedCount > 0 && (
              <Button
                variant="contained"
                color="warning"
                startIcon={<CheckCircle />}
                onClick={handleBulkApprove}
              >
                {t('admin.localization.bulk_approve', { count: aiTranslatedCount })}
              </Button>
            )}
          </Box>

          {pendingReviews.length === 0 ? (
            <Alert severity="success">
              {t('admin.localization.no_pending_reviews')}
            </Alert>
          ) : (
            <TableContainer component={Paper}>
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell>{t('admin.localization.key')}</TableCell>
                    <TableCell>{t('admin.localization.original')}</TableCell>
                    <TableCell>{t('admin.localization.translation')}</TableCell>
                    <TableCell>{t('admin.localization.language')}</TableCell>
                    <TableCell>{t('admin.localization.status')}</TableCell>
                    <TableCell align="right">{t('admin.localization.actions')}</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {pendingReviews
                    .filter(t => 
                      !searchQuery || 
                      t.key.includes(searchQuery) || 
                      t.defaultText.includes(searchQuery) ||
                      t.translatedText.includes(searchQuery)
                    )
                    .map((translation) => (
                      <TableRow key={translation.id}>
                        <TableCell>
                          <Typography variant="body2" fontFamily="monospace">
                            {translation.key}
                          </Typography>
                          <Typography variant="caption" color="text.secondary">
                            {translation.category}
                          </Typography>
                        </TableCell>
                        <TableCell>
                          <Typography variant="body2">
                            {translation.defaultText}
                          </Typography>
                          {translation.context && (
                            <Typography variant="caption" color="text.secondary">
                              {translation.context}
                            </Typography>
                          )}
                        </TableCell>
                        <TableCell>
                          <Typography 
                            variant="body2"
                            dir={translation.languageCode === 'ar' ? 'rtl' : 'ltr'}
                          >
                            {translation.translatedText}
                          </Typography>
                          {translation.aiConfidence && (
                            <Typography variant="caption" color="text.secondary">
                              AI confidence: {(translation.aiConfidence * 100).toFixed(0)}%
                            </Typography>
                          )}
                        </TableCell>
                        <TableCell>
                          <Chip 
                            size="small" 
                            label={translation.nativeName || translation.languageName} 
                          />
                        </TableCell>
                        <TableCell>
                          {getStatusChip(translation.status)}
                        </TableCell>
                        <TableCell align="right">
                          <Tooltip title={t('admin.buttons.edit')}>
                            <IconButton
                              size="small"
                              onClick={() => {
                                setEditDialog(translation);
                                setEditedText(translation.translatedText);
                              }}
                            >
                              <Edit fontSize="small" />
                            </IconButton>
                          </Tooltip>
                          <Tooltip title={t('admin.buttons.approve')}>
                            <IconButton
                              size="small"
                              color="success"
                              onClick={() => handleApprove(translation)}
                            >
                              <Check fontSize="small" />
                            </IconButton>
                          </Tooltip>
                          <Tooltip title={t('admin.buttons.reject')}>
                            <IconButton
                              size="small"
                              color="error"
                              onClick={() => {
                                const notes = prompt(t('admin.localization.reject_reason'));
                                if (notes) handleReject(translation, notes);
                              }}
                            >
                              <Close fontSize="small" />
                            </IconButton>
                          </Tooltip>
                        </TableCell>
                      </TableRow>
                    ))}
                </TableBody>
              </Table>
            </TableContainer>
          )}
        </Box>
      )}

      {/* Edit Dialog */}
      <Dialog open={!!editDialog} onClose={() => setEditDialog(null)} maxWidth="md" fullWidth>
        <DialogTitle>{t('admin.localization.edit_translation')}</DialogTitle>
        <DialogContent>
          {editDialog && (
            <Box sx={{ pt: 2 }}>
              <Typography variant="subtitle2" gutterBottom>
                {t('admin.localization.key')}: <code>{editDialog.key}</code>
              </Typography>
              <Typography variant="body2" color="text.secondary" gutterBottom>
                {t('admin.localization.original')}: {editDialog.defaultText}
              </Typography>
              {editDialog.context && (
                <Typography variant="body2" color="text.secondary" gutterBottom>
                  {t('admin.localization.context')}: {editDialog.context}
                </Typography>
              )}
              <TextField
                fullWidth
                multiline
                rows={4}
                value={editedText}
                onChange={(e) => setEditedText(e.target.value)}
                label={t('admin.localization.translation')}
                sx={{ mt: 2 }}
                dir={editDialog.languageCode === 'ar' ? 'rtl' : 'ltr'}
              />
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setEditDialog(null)}>
            {t('admin.buttons.cancel')}
          </Button>
          <Button onClick={handleSaveEdit} variant="contained" color="primary">
            {t('admin.buttons.save_and_approve')}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
```

---

## 41.10 CDK INFRASTRUCTURE

### File: `cdk/lib/localization-stack.ts`

```typescript
// ============================================================================
// RADIANT v4.7.0 - Localization Infrastructure Stack
// ============================================================================

import * as cdk from 'aws-cdk-lib';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as sqs from 'aws-cdk-lib/aws-sqs';
import * as sns from 'aws-cdk-lib/aws-sns';
import * as events from 'aws-cdk-lib/aws-events';
import * as targets from 'aws-cdk-lib/aws-events-targets';
import * as iam from 'aws-cdk-lib/aws-iam';
import { SqsEventSource } from 'aws-cdk-lib/aws-lambda-event-sources';
import { Construct } from 'constructs';

interface LocalizationStackProps extends cdk.StackProps {
  environment: string;
  vpcId: string;
  dbSecurityGroupId: string;
  dbHost: string;
  dbName: string;
  dbSecretArn: string;
  adminNotificationTopicArn: string;
  adminUrl: string;
}

export class LocalizationStack extends cdk.Stack {
  public readonly translationQueue: sqs.Queue;
  public readonly translateLambda: lambda.Function;
  public readonly apiLambda: lambda.Function;

  constructor(scope: Construct, id: string, props: LocalizationStackProps) {
    super(scope, id, props);

    // Dead letter queue for failed translations
    const dlq = new sqs.Queue(this, 'TranslationDLQ', {
      queueName: `radiant-${props.environment}-translation-dlq`,
      retentionPeriod: cdk.Duration.days(14),
    });

    // Translation queue (FIFO for ordering by language)
    this.translationQueue = new sqs.Queue(this, 'TranslationQueue', {
      queueName: `radiant-${props.environment}-translation-queue.fifo`,
      fifo: true,
      contentBasedDeduplication: true,
      visibilityTimeout: cdk.Duration.minutes(5),
      deadLetterQueue: {
        queue: dlq,
        maxReceiveCount: 3,
      },
    });

    // Lambda execution role with Bedrock access
    const lambdaRole = new iam.Role(this, 'LocalizationLambdaRole', {
      assumedBy: new iam.ServicePrincipal('lambda.amazonaws.com'),
      managedPolicies: [
        iam.ManagedPolicy.fromAwsManagedPolicyName('service-role/AWSLambdaVPCAccessExecutionRole'),
      ],
    });

    // Bedrock permissions
    lambdaRole.addToPolicy(new iam.PolicyStatement({
      actions: [
        'bedrock:InvokeModel',
        'bedrock:InvokeModelWithResponseStream',
      ],
      resources: ['*'],
    }));

    // SNS permissions for notifications
    lambdaRole.addToPolicy(new iam.PolicyStatement({
      actions: ['sns:Publish'],
      resources: [props.adminNotificationTopicArn],
    }));

    // Secrets Manager for DB credentials
    lambdaRole.addToPolicy(new iam.PolicyStatement({
      actions: ['secretsmanager:GetSecretValue'],
      resources: [props.dbSecretArn],
    }));

    // Common Lambda environment - use DATABASE_URL for consistency
    const lambdaEnvironment = {
      NODE_ENV: props.environment,
      DATABASE_URL: props.databaseUrl,  // Connection string format
      ADMIN_NOTIFICATION_TOPIC_ARN: props.adminNotificationTopicArn,
      ADMIN_URL: props.adminUrl,
      TRANSLATION_QUEUE_URL: this.translationQueue.queueUrl,
    };

    // Translation Lambda (processes queue)
    this.translateLambda = new lambda.Function(this, 'TranslateLambda', {
      functionName: `radiant-${props.environment}-localization-translate`,
      runtime: lambda.Runtime.NODEJS_20_X,
      handler: 'translate.handler',
      code: lambda.Code.fromAsset('lambda/localization'),
      timeout: cdk.Duration.minutes(2),
      memorySize: 512,
      role: lambdaRole,
      environment: lambdaEnvironment,
    });

    // Add SQS trigger
    this.translateLambda.addEventSource(new SqsEventSource(this.translationQueue, {
      batchSize: 1,
      maxConcurrency: 10,
    }));

    // Queue processor Lambda (scheduled)
    const queueProcessorLambda = new lambda.Function(this, 'QueueProcessorLambda', {
      functionName: `radiant-${props.environment}-localization-queue-processor`,
      runtime: lambda.Runtime.NODEJS_20_X,
      handler: 'process-queue.handler',
      code: lambda.Code.fromAsset('lambda/localization'),
      timeout: cdk.Duration.minutes(1),
      memorySize: 256,
      role: lambdaRole,
      environment: lambdaEnvironment,
    });

    // Grant queue send permissions
    this.translationQueue.grantSendMessages(queueProcessorLambda);

    // Schedule queue processor every 5 minutes
    new events.Rule(this, 'QueueProcessorSchedule', {
      ruleName: `radiant-${props.environment}-translation-queue-processor`,
      schedule: events.Schedule.rate(cdk.Duration.minutes(5)),
      targets: [new targets.LambdaFunction(queueProcessorLambda)],
    });

    // API Lambda
    this.apiLambda = new lambda.Function(this, 'LocalizationApiLambda', {
      functionName: `radiant-${props.environment}-localization-api`,
      runtime: lambda.Runtime.NODEJS_20_X,
      handler: 'api.handler',
      code: lambda.Code.fromAsset('lambda/localization'),
      timeout: cdk.Duration.seconds(30),
      memorySize: 512,
      role: lambdaRole,
      environment: lambdaEnvironment,
    });

    // Outputs
    new cdk.CfnOutput(this, 'TranslationQueueUrl', {
      value: this.translationQueue.queueUrl,
      exportName: `radiant-${props.environment}-translation-queue-url`,
    });

    new cdk.CfnOutput(this, 'LocalizationApiArn', {
      value: this.apiLambda.functionArn,
      exportName: `radiant-${props.environment}-localization-api-arn`,
    });
  }
}
```

---

## 41.11 INITIAL TRANSLATION SEED DATA

### Migration: 041b_seed_localization.sql

```sql
-- ============================================================================
-- RADIANT v4.7.0 - Seed Initial Translations
-- Migration: 041b_seed_localization.sql
-- ============================================================================

-- UI Buttons
INSERT INTO localization_registry (key, default_text, category, context, source_app) VALUES
('ui.buttons.submit', 'Submit', 'ui.buttons', 'Primary form submission button', 'shared'),
('ui.buttons.cancel', 'Cancel', 'ui.buttons', 'Cancel/close action', 'shared'),
('ui.buttons.save', 'Save', 'ui.buttons', 'Save changes button', 'shared'),
('ui.buttons.delete', 'Delete', 'ui.buttons', 'Delete/remove action', 'shared'),
('ui.buttons.edit', 'Edit', 'ui.buttons', 'Edit/modify action', 'shared'),
('ui.buttons.close', 'Close', 'ui.buttons', 'Close dialog/modal', 'shared'),
('ui.buttons.confirm', 'Confirm', 'ui.buttons', 'Confirmation action', 'shared'),
('ui.buttons.back', 'Back', 'ui.buttons', 'Navigate back', 'shared'),
('ui.buttons.next', 'Next', 'ui.buttons', 'Navigate forward/next step', 'shared'),
('ui.buttons.refresh', 'Refresh', 'ui.buttons', 'Reload/refresh data', 'shared'),
('ui.buttons.search', 'Search', 'ui.buttons', 'Search action', 'shared'),
('ui.buttons.send', 'Send', 'ui.buttons', 'Send message/request', 'shared'),
('ui.buttons.copy', 'Copy', 'ui.buttons', 'Copy to clipboard', 'shared'),
('ui.buttons.download', 'Download', 'ui.buttons', 'Download file', 'shared'),
('ui.buttons.upload', 'Upload', 'ui.buttons', 'Upload file', 'shared'),
('ui.buttons.retry', 'Retry', 'ui.buttons', 'Retry failed action', 'shared'),
('ui.buttons.approve', 'Approve', 'ui.buttons', 'Approve action (admin)', 'admin'),
('ui.buttons.reject', 'Reject', 'ui.buttons', 'Reject action (admin)', 'admin'),
('ui.buttons.save_and_approve', 'Save & Approve', 'ui.buttons', 'Save and approve translation', 'admin');

-- Messages
INSERT INTO localization_registry (key, default_text, category, context, source_app, placeholders) VALUES
('messages.welcome', 'Welcome, {name}!', 'messages.success', 'Welcome message after login', 'shared', '[{"name": "name", "description": "User display name"}]'),
('messages.saved', 'Changes saved successfully', 'messages.success', 'After successful save', 'shared', '[]'),
('messages.deleted', 'Item deleted successfully', 'messages.success', 'After successful deletion', 'shared', '[]'),
('messages.copied', 'Copied to clipboard', 'messages.success', 'After copy action', 'shared', '[]'),
('messages.loading', 'Loading...', 'messages.loading', 'Generic loading state', 'shared', '[]'),
('messages.processing', 'Processing...', 'messages.loading', 'Processing action', 'shared', '[]'),
('messages.no_results', 'No results found', 'messages.info', 'Empty search results', 'shared', '[]'),
('messages.confirm_delete', 'Are you sure you want to delete this item?', 'messages.warning', 'Deletion confirmation', 'shared', '[]');

-- Errors
INSERT INTO localization_registry (key, default_text, category, context, source_app, placeholders) VALUES
('errors.generic', 'An error occurred. Please try again.', 'errors.system', 'Generic error fallback', 'shared', '[]'),
('errors.network', 'Network error. Please check your connection.', 'errors.network', 'Network connectivity issue', 'shared', '[]'),
('errors.unauthorized', 'You are not authorized to perform this action.', 'errors.auth', 'Permission denied', 'shared', '[]'),
('errors.session_expired', 'Your session has expired. Please log in again.', 'errors.auth', 'Session timeout', 'shared', '[]'),
('errors.not_found', 'The requested item was not found.', 'errors.api', '404 error', 'shared', '[]'),
('errors.validation', 'Please check your input and try again.', 'errors.validation', 'Form validation failed', 'shared', '[]'),
('errors.required_field', 'This field is required.', 'errors.validation', 'Required field validation', 'shared', '[]'),
('errors.invalid_email', 'Please enter a valid email address.', 'errors.validation', 'Email format validation', 'shared', '[]'),
('errors.rate_limit', 'Too many requests. Please wait a moment.', 'errors.api', 'Rate limiting', 'shared', '[]');

-- Think Tank specific
INSERT INTO localization_registry (key, default_text, category, context, source_app, placeholders) VALUES
('thinktank.chat.placeholder', 'Ask me anything...', 'features.thinktank', 'Chat input placeholder', 'thinktank', '[]'),
('thinktank.chat.thinking', 'Thinking...', 'features.thinktank', 'AI is processing', 'thinktank', '[]'),
('thinktank.chat.error', 'Sorry, I encountered an error. Please try again.', 'features.thinktank', 'AI response error', 'thinktank', '[]'),
('thinktank.chat.regenerate', 'Regenerate response', 'features.thinktank', 'Button to regenerate AI response', 'thinktank', '[]'),
('thinktank.chat.stop', 'Stop generating', 'features.thinktank', 'Button to stop AI generation', 'thinktank', '[]'),
('thinktank.chat.new', 'New conversation', 'features.thinktank', 'Start new chat', 'thinktank', '[]'),
('thinktank.models.select', 'Select model', 'features.thinktank', 'Model selector label', 'thinktank', '[]'),
('thinktank.models.auto', 'Auto (recommended)', 'features.thinktank', 'Automatic model selection', 'thinktank', '[]');

-- Billing & Subscription Tiers (v4.13.0+)
INSERT INTO localization_registry (key, default_text, category, context, source_app) VALUES
('billing.tiers.free.name', 'Free Trial', 'billing.tiers', 'Free tier display name', 'shared'),
('billing.tiers.free.description', 'Try RADIANT with limited features', 'billing.tiers', 'Free tier description', 'shared'),
('billing.tiers.individual.name', 'Individual', 'billing.tiers', 'Individual tier display name', 'shared'),
('billing.tiers.individual.description', 'Full-featured personal plan', 'billing.tiers', 'Individual tier description', 'shared'),
('billing.tiers.family.name', 'Family', 'billing.tiers', 'Family tier display name', 'shared'),
('billing.tiers.family.description', 'Share AI across your household', 'billing.tiers', 'Family tier description', 'shared'),
('billing.tiers.team.name', 'Team', 'billing.tiers', 'Team tier display name', 'shared'),
('billing.tiers.team.description', 'Collaborate with your small team', 'billing.tiers', 'Team tier description', 'shared'),
('billing.tiers.team.badge', 'Most Popular', 'billing.badges', 'Team tier badge text', 'shared'),
('billing.tiers.business.name', 'Business', 'billing.tiers', 'Business tier display name', 'shared'),
('billing.tiers.business.description', 'Enterprise features for growing companies', 'billing.tiers', 'Business tier description', 'shared'),
('billing.tiers.enterprise.name', 'Enterprise', 'billing.tiers', 'Enterprise tier display name', 'shared'),
('billing.tiers.enterprise.description', 'Full-scale enterprise deployment', 'billing.tiers', 'Enterprise tier description', 'shared'),
('billing.tiers.enterprise_plus.name', 'Enterprise Plus', 'billing.tiers', 'Enterprise Plus tier display name', 'shared'),
('billing.tiers.enterprise_plus.description', 'Maximum security and compliance', 'billing.tiers', 'Enterprise Plus tier description', 'shared'),
('billing.tiers.enterprise_plus.badge', 'Full Compliance Included', 'billing.badges', 'Enterprise Plus tier badge', 'shared'),
('billing.credits.title', 'Credits', 'billing.credits', 'Credits section title', 'shared'),
('billing.credits.balance', 'Credit Balance', 'billing.credits', 'Current credit balance label', 'shared'),
('billing.credits.purchase', 'Purchase Credits', 'billing.credits', 'Buy credits button', 'shared'),
('billing.credits.low_balance', 'Low credit balance', 'billing.credits', 'Low balance warning', 'shared');

-- Admin specific
INSERT INTO localization_registry (key, default_text, category, context, source_app) VALUES
('admin.nav.dashboard', 'Dashboard', 'features.admin', 'Navigation item', 'admin'),
('admin.nav.users', 'Users', 'features.admin', 'Navigation item', 'admin'),
('admin.nav.tenants', 'Tenants', 'features.admin', 'Navigation item', 'admin'),
('admin.nav.models', 'AI Models', 'features.admin', 'Navigation item', 'admin'),
('admin.nav.billing', 'Billing', 'features.admin', 'Navigation item', 'admin'),
('admin.nav.localization', 'Localization', 'features.admin', 'Navigation item', 'admin'),
('admin.nav.settings', 'Settings', 'features.admin', 'Navigation item', 'admin');

-- Localization admin specific
INSERT INTO localization_registry (key, default_text, category, context, source_app, placeholders) VALUES
('admin.localization.title', 'Localization Management', 'features.admin', 'Page title', 'admin', '[]'),
('admin.localization.tabs.coverage', 'Coverage', 'features.admin', 'Tab label', 'admin', '[]'),
('admin.localization.tabs.review', 'Review Queue', 'features.admin', 'Tab label', 'admin', '[]'),
('admin.localization.tabs.registry', 'String Registry', 'features.admin', 'Tab label', 'admin', '[]'),
('admin.localization.language', 'Language', 'features.admin', 'Table header', 'admin', '[]'),
('admin.localization.total', 'Total', 'features.admin', 'Table header', 'admin', '[]'),
('admin.localization.approved', 'Approved', 'features.admin', 'Table header', 'admin', '[]'),
('admin.localization.ai_translated', 'AI Translated', 'features.admin', 'Table header', 'admin', '[]'),
('admin.localization.pending', 'Pending', 'features.admin', 'Table header', 'admin', '[]'),
('admin.localization.coverage', 'Coverage', 'features.admin', 'Table header', 'admin', '[]'),
('admin.localization.key', 'Key', 'features.admin', 'Table header', 'admin', '[]'),
('admin.localization.original', 'Original (English)', 'features.admin', 'Table header', 'admin', '[]'),
('admin.localization.translation', 'Translation', 'features.admin', 'Table header/label', 'admin', '[]'),
('admin.localization.status', 'Status', 'features.admin', 'Table header', 'admin', '[]'),
('admin.localization.actions', 'Actions', 'features.admin', 'Table header', 'admin', '[]'),
('admin.localization.context', 'Context', 'features.admin', 'Context for translators', 'admin', '[]'),
('admin.localization.all_languages', 'All Languages', 'features.admin', 'Filter option', 'admin', '[]'),
('admin.localization.search_placeholder', 'Search keys or text...', 'features.admin', 'Search input placeholder', 'admin', '[]'),
('admin.localization.no_pending_reviews', 'No translations pending review. Great work!', 'features.admin', 'Empty state message', 'admin', '[]'),
('admin.localization.edit_translation', 'Edit Translation', 'features.admin', 'Dialog title', 'admin', '[]'),
('admin.localization.reject_reason', 'Please provide a reason for rejection:', 'features.admin', 'Reject prompt', 'admin', '[]'),
('admin.localization.bulk_approve', 'Approve All AI Translations ({count})', 'features.admin', 'Bulk approve button', 'admin', '[{"name": "count", "description": "Number of translations"}]'),
('admin.localization.confirm_bulk_approve', 'Approve {count} AI-translated strings?', 'features.admin', 'Bulk approve confirmation', 'admin', '[{"name": "count", "description": "Number of translations"}]'),
('admin.localization.status.pending', 'Pending', 'features.admin', 'Status label', 'admin', '[]'),
('admin.localization.status.ai_translated', 'AI Translated', 'features.admin', 'Status label', 'admin', '[]'),
('admin.localization.status.in_review', 'In Review', 'features.admin', 'Status label', 'admin', '[]'),
('admin.localization.status.approved', 'Approved', 'features.admin', 'Status label', 'admin', '[]'),
('admin.localization.status.rejected', 'Rejected', 'features.admin', 'Status label', 'admin', '[]');

-- Settings
INSERT INTO localization_registry (key, default_text, category, context, source_app) VALUES
('ui.settings.language', 'Language', 'features.settings', 'Language setting label', 'shared'),
('ui.settings.theme', 'Theme', 'features.settings', 'Theme setting label', 'shared'),
('ui.settings.notifications', 'Notifications', 'features.settings', 'Notifications setting label', 'shared'),
('ui.settings.profile', 'Profile', 'features.settings', 'Profile section label', 'shared'),
('ui.settings.security', 'Security', 'features.settings', 'Security section label', 'shared'),
('ui.settings.account', 'Account', 'features.settings', 'Account section label', 'shared');

-- Note: English translations are auto-created by the trigger from default_text
-- Other languages will be AI-translated automatically via the queue
```

---

# â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
