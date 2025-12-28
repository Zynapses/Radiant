-- Migration 045: Domain Taxonomy System
-- RADIANT v4.18.0 - Hierarchical domain taxonomy for AI model matching

-- ============================================================================
-- Domain Taxonomy Fields (Top Level)
-- ============================================================================

CREATE TABLE IF NOT EXISTS domain_taxonomy_fields (
    field_id VARCHAR(100) PRIMARY KEY,
    field_name VARCHAR(255) NOT NULL,
    field_icon VARCHAR(10) DEFAULT '📚',
    field_color VARCHAR(20) DEFAULT '#6366f1',
    field_description TEXT,
    field_proficiencies JSONB NOT NULL DEFAULT '{
        "reasoning_depth": 5,
        "mathematical_quantitative": 5,
        "code_generation": 5,
        "creative_generative": 5,
        "research_synthesis": 5,
        "factual_recall_precision": 5,
        "multi_step_problem_solving": 5,
        "domain_terminology_handling": 5
    }'::jsonb,
    display_order INTEGER DEFAULT 0,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_by VARCHAR(255)
);

CREATE INDEX idx_taxonomy_fields_active ON domain_taxonomy_fields(is_active);
CREATE INDEX idx_taxonomy_fields_order ON domain_taxonomy_fields(display_order);

-- ============================================================================
-- Domain Taxonomy Domains (Middle Level)
-- ============================================================================

CREATE TABLE IF NOT EXISTS domain_taxonomy_domains (
    domain_id VARCHAR(100) PRIMARY KEY,
    domain_name VARCHAR(255) NOT NULL,
    domain_icon VARCHAR(10) DEFAULT '📁',
    domain_description TEXT,
    parent_field VARCHAR(100) NOT NULL REFERENCES domain_taxonomy_fields(field_id) ON DELETE CASCADE,
    detection_keywords JSONB DEFAULT '[]'::jsonb,
    professional_associations JSONB DEFAULT '[]'::jsonb,
    key_journals JSONB DEFAULT '[]'::jsonb,
    reference_databases JSONB DEFAULT '[]'::jsonb,
    domain_proficiencies JSONB NOT NULL DEFAULT '{
        "reasoning_depth": 5,
        "mathematical_quantitative": 5,
        "code_generation": 5,
        "creative_generative": 5,
        "research_synthesis": 5,
        "factual_recall_precision": 5,
        "multi_step_problem_solving": 5,
        "domain_terminology_handling": 5
    }'::jsonb,
    display_order INTEGER DEFAULT 0,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_by VARCHAR(255)
);

CREATE INDEX idx_taxonomy_domains_field ON domain_taxonomy_domains(parent_field);
CREATE INDEX idx_taxonomy_domains_active ON domain_taxonomy_domains(is_active);
CREATE INDEX idx_taxonomy_domains_keywords ON domain_taxonomy_domains USING gin(detection_keywords);

-- ============================================================================
-- Domain Taxonomy Subspecialties (Leaf Level)
-- ============================================================================

CREATE TABLE IF NOT EXISTS domain_taxonomy_subspecialties (
    subspecialty_id VARCHAR(100) PRIMARY KEY,
    subspecialty_name VARCHAR(255) NOT NULL,
    description TEXT,
    parent_domain VARCHAR(100) NOT NULL REFERENCES domain_taxonomy_domains(domain_id) ON DELETE CASCADE,
    detection_keywords JSONB DEFAULT '[]'::jsonb,
    terminology_signals JSONB DEFAULT '{
        "high_confidence": [],
        "medium_confidence": [],
        "exclusionary": []
    }'::jsonb,
    certifications JSONB DEFAULT '[]'::jsonb,
    competency_mappings JSONB DEFAULT '{
        "cip_codes": [],
        "soc_codes": []
    }'::jsonb,
    subspecialty_proficiencies JSONB NOT NULL DEFAULT '{
        "reasoning_depth": 5,
        "mathematical_quantitative": 5,
        "code_generation": 5,
        "creative_generative": 5,
        "research_synthesis": 5,
        "factual_recall_precision": 5,
        "multi_step_problem_solving": 5,
        "domain_terminology_handling": 5
    }'::jsonb,
    display_order INTEGER DEFAULT 0,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_by VARCHAR(255)
);

CREATE INDEX idx_taxonomy_subspecialties_domain ON domain_taxonomy_subspecialties(parent_domain);
CREATE INDEX idx_taxonomy_subspecialties_active ON domain_taxonomy_subspecialties(is_active);
CREATE INDEX idx_taxonomy_subspecialties_keywords ON domain_taxonomy_subspecialties USING gin(detection_keywords);
CREATE INDEX idx_taxonomy_subspecialties_signals ON domain_taxonomy_subspecialties USING gin(terminology_signals);

-- ============================================================================
-- Domain Detection Feedback (for AGI learning)
-- ============================================================================

CREATE TABLE IF NOT EXISTS domain_taxonomy_feedback (
    feedback_id VARCHAR(100) PRIMARY KEY,
    tenant_id VARCHAR(100) NOT NULL,
    user_id VARCHAR(255) NOT NULL,
    prompt_hash VARCHAR(64) NOT NULL,
    detected_domain_id VARCHAR(100) REFERENCES domain_taxonomy_domains(domain_id),
    detected_subspecialty_id VARCHAR(100) REFERENCES domain_taxonomy_subspecialties(subspecialty_id),
    actual_domain_id VARCHAR(100) REFERENCES domain_taxonomy_domains(domain_id),
    actual_subspecialty_id VARCHAR(100) REFERENCES domain_taxonomy_subspecialties(subspecialty_id),
    model_used VARCHAR(255) NOT NULL,
    quality_score INTEGER NOT NULL CHECK (quality_score >= 1 AND quality_score <= 5),
    domain_accuracy BOOLEAN NOT NULL,
    proficiency_match_quality INTEGER CHECK (proficiency_match_quality >= 1 AND proficiency_match_quality <= 5),
    feedback_text TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_taxonomy_feedback_tenant ON domain_taxonomy_feedback(tenant_id);
CREATE INDEX idx_taxonomy_feedback_domain ON domain_taxonomy_feedback(detected_domain_id);
CREATE INDEX idx_taxonomy_feedback_actual ON domain_taxonomy_feedback(actual_domain_id);
CREATE INDEX idx_taxonomy_feedback_created ON domain_taxonomy_feedback(created_at);
CREATE INDEX idx_taxonomy_feedback_accuracy ON domain_taxonomy_feedback(domain_accuracy);

-- ============================================================================
-- Manual Domain Selections (user overrides)
-- ============================================================================

CREATE TABLE IF NOT EXISTS domain_taxonomy_selections (
    selection_id VARCHAR(100) PRIMARY KEY DEFAULT gen_random_uuid()::text,
    tenant_id VARCHAR(100) NOT NULL,
    user_id VARCHAR(255) NOT NULL,
    field_id VARCHAR(100) REFERENCES domain_taxonomy_fields(field_id),
    domain_id VARCHAR(100) REFERENCES domain_taxonomy_domains(domain_id),
    subspecialty_id VARCHAR(100) REFERENCES domain_taxonomy_subspecialties(subspecialty_id),
    session_id VARCHAR(255),
    is_default BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    expires_at TIMESTAMP WITH TIME ZONE
);

CREATE INDEX idx_taxonomy_selections_user ON domain_taxonomy_selections(tenant_id, user_id);
CREATE INDEX idx_taxonomy_selections_session ON domain_taxonomy_selections(session_id);
CREATE INDEX idx_taxonomy_selections_default ON domain_taxonomy_selections(tenant_id, user_id, is_default) WHERE is_default = true;

-- ============================================================================
-- Taxonomy Update Audit Log
-- ============================================================================

CREATE TABLE IF NOT EXISTS domain_taxonomy_audit_log (
    log_id VARCHAR(100) PRIMARY KEY DEFAULT gen_random_uuid()::text,
    update_type VARCHAR(50) NOT NULL,
    target_type VARCHAR(50) NOT NULL, -- 'field', 'domain', 'subspecialty'
    target_id VARCHAR(100) NOT NULL,
    previous_data JSONB,
    new_data JSONB NOT NULL,
    admin_user_id VARCHAR(255) NOT NULL,
    reason TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_taxonomy_audit_target ON domain_taxonomy_audit_log(target_type, target_id);
CREATE INDEX idx_taxonomy_audit_admin ON domain_taxonomy_audit_log(admin_user_id);
CREATE INDEX idx_taxonomy_audit_created ON domain_taxonomy_audit_log(created_at);

-- ============================================================================
-- Model-Domain Proficiency Cache
-- ============================================================================

CREATE TABLE IF NOT EXISTS domain_model_proficiency_cache (
    cache_id VARCHAR(100) PRIMARY KEY DEFAULT gen_random_uuid()::text,
    domain_id VARCHAR(100) NOT NULL REFERENCES domain_taxonomy_domains(domain_id) ON DELETE CASCADE,
    subspecialty_id VARCHAR(100) REFERENCES domain_taxonomy_subspecialties(subspecialty_id) ON DELETE CASCADE,
    model_id VARCHAR(255) NOT NULL,
    match_score NUMERIC(5,2) NOT NULL,
    dimension_scores JSONB NOT NULL,
    strengths JSONB DEFAULT '[]'::jsonb,
    weaknesses JSONB DEFAULT '[]'::jsonb,
    recommended BOOLEAN DEFAULT false,
    ranking INTEGER,
    calculated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    expires_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() + INTERVAL '1 hour'
);

CREATE INDEX idx_domain_model_cache_domain ON domain_model_proficiency_cache(domain_id);
CREATE INDEX idx_domain_model_cache_subspecialty ON domain_model_proficiency_cache(subspecialty_id);
CREATE INDEX idx_domain_model_cache_model ON domain_model_proficiency_cache(model_id);
CREATE INDEX idx_domain_model_cache_expires ON domain_model_proficiency_cache(expires_at);
CREATE UNIQUE INDEX idx_domain_model_cache_unique ON domain_model_proficiency_cache(domain_id, COALESCE(subspecialty_id, ''), model_id);

-- ============================================================================
-- Seed Data: Top-Level Fields (17 fields as per taxonomy spec)
-- ============================================================================

INSERT INTO domain_taxonomy_fields (field_id, field_name, field_icon, field_color, field_description, field_proficiencies, display_order) VALUES
('sciences', 'Sciences', '🔬', '#4A90D9', 'Natural and physical sciences including physics, chemistry, biology, earth sciences, and astronomy', 
 '{"reasoning_depth": 9, "mathematical_quantitative": 9, "code_generation": 5, "creative_generative": 4, "research_synthesis": 9, "factual_recall_precision": 9, "multi_step_problem_solving": 9, "domain_terminology_handling": 9}'::jsonb, 1),

('computer_science', 'Computer Science & IT', '💻', '#2ECC71', 'Software engineering, systems, networking, security, and information technology',
 '{"reasoning_depth": 9, "mathematical_quantitative": 8, "code_generation": 10, "creative_generative": 6, "research_synthesis": 7, "factual_recall_precision": 8, "multi_step_problem_solving": 10, "domain_terminology_handling": 9}'::jsonb, 2),

('mathematics', 'Mathematics & Logic', '📐', '#9B59B6', 'Pure and applied mathematics, statistics, and formal logic',
 '{"reasoning_depth": 10, "mathematical_quantitative": 10, "code_generation": 6, "creative_generative": 4, "research_synthesis": 7, "factual_recall_precision": 9, "multi_step_problem_solving": 10, "domain_terminology_handling": 9}'::jsonb, 3),

('ai_ml', 'AI & Machine Learning', '🤖', '#E74C3C', 'Artificial intelligence, machine learning, deep learning, and data science',
 '{"reasoning_depth": 10, "mathematical_quantitative": 9, "code_generation": 10, "creative_generative": 7, "research_synthesis": 9, "factual_recall_precision": 8, "multi_step_problem_solving": 10, "domain_terminology_handling": 10}'::jsonb, 4),

('engineering', 'Engineering', '⚙️', '#F39C12', 'Mechanical, electrical, civil, chemical, and other engineering disciplines',
 '{"reasoning_depth": 9, "mathematical_quantitative": 9, "code_generation": 7, "creative_generative": 6, "research_synthesis": 8, "factual_recall_precision": 9, "multi_step_problem_solving": 10, "domain_terminology_handling": 9}'::jsonb, 5),

('medicine', 'Medicine & Healthcare', '🏥', '#E91E63', 'Medical sciences, clinical practice, public health, and healthcare systems',
 '{"reasoning_depth": 9, "mathematical_quantitative": 7, "code_generation": 3, "creative_generative": 4, "research_synthesis": 9, "factual_recall_precision": 10, "multi_step_problem_solving": 9, "domain_terminology_handling": 10}'::jsonb, 6),

('business', 'Business & Management', '💼', '#00BCD4', 'Business strategy, management, finance, marketing, and entrepreneurship',
 '{"reasoning_depth": 8, "mathematical_quantitative": 7, "code_generation": 4, "creative_generative": 7, "research_synthesis": 8, "factual_recall_precision": 7, "multi_step_problem_solving": 9, "domain_terminology_handling": 8}'::jsonb, 7),

('social_sciences', 'Social Sciences', '🌍', '#795548', 'Psychology, sociology, anthropology, economics, and political science',
 '{"reasoning_depth": 9, "mathematical_quantitative": 6, "code_generation": 4, "creative_generative": 6, "research_synthesis": 10, "factual_recall_precision": 8, "multi_step_problem_solving": 8, "domain_terminology_handling": 9}'::jsonb, 8),

('law_legal', 'Law & Legal Studies', '⚖️', '#607D8B', 'Legal systems, jurisprudence, regulatory frameworks, and legal practice',
 '{"reasoning_depth": 10, "mathematical_quantitative": 4, "code_generation": 2, "creative_generative": 5, "research_synthesis": 9, "factual_recall_precision": 10, "multi_step_problem_solving": 9, "domain_terminology_handling": 10}'::jsonb, 9),

('humanities', 'Humanities', '📚', '#8E44AD', 'Literature, history, philosophy, linguistics, and cultural studies',
 '{"reasoning_depth": 9, "mathematical_quantitative": 3, "code_generation": 2, "creative_generative": 9, "research_synthesis": 10, "factual_recall_precision": 9, "multi_step_problem_solving": 7, "domain_terminology_handling": 9}'::jsonb, 10),

('arts_design', 'Arts & Design', '🎨', '#FF5722', 'Visual arts, graphic design, UX/UI, architecture, and creative industries',
 '{"reasoning_depth": 6, "mathematical_quantitative": 4, "code_generation": 5, "creative_generative": 10, "research_synthesis": 6, "factual_recall_precision": 5, "multi_step_problem_solving": 7, "domain_terminology_handling": 8}'::jsonb, 11),

('education', 'Education', '🎓', '#4CAF50', 'Teaching methods, curriculum design, educational technology, and learning sciences',
 '{"reasoning_depth": 7, "mathematical_quantitative": 5, "code_generation": 4, "creative_generative": 8, "research_synthesis": 8, "factual_recall_precision": 8, "multi_step_problem_solving": 7, "domain_terminology_handling": 7}'::jsonb, 12),

('agriculture', 'Agriculture & Environmental', '🌱', '#8BC34A', 'Agriculture, forestry, environmental science, and sustainability',
 '{"reasoning_depth": 7, "mathematical_quantitative": 6, "code_generation": 4, "creative_generative": 4, "research_synthesis": 8, "factual_recall_precision": 8, "multi_step_problem_solving": 7, "domain_terminology_handling": 8}'::jsonb, 13),

('trades', 'Trades & Skilled Crafts', '🔧', '#FF9800', 'Construction, manufacturing, automotive, electrical trades, and craftsmanship',
 '{"reasoning_depth": 6, "mathematical_quantitative": 6, "code_generation": 3, "creative_generative": 5, "research_synthesis": 5, "factual_recall_precision": 8, "multi_step_problem_solving": 8, "domain_terminology_handling": 8}'::jsonb, 14),

('sports_recreation', 'Sports & Recreation', '⚽', '#03A9F4', 'Sports science, athletics, fitness, outdoor recreation, and wellness',
 '{"reasoning_depth": 6, "mathematical_quantitative": 5, "code_generation": 3, "creative_generative": 6, "research_synthesis": 6, "factual_recall_precision": 8, "multi_step_problem_solving": 7, "domain_terminology_handling": 8}'::jsonb, 15),

('media_communication', 'Media & Communication', '📺', '#9B59B6', 'Journalism, broadcasting, public relations, and digital media',
 '{"reasoning_depth": 7, "mathematical_quantitative": 4, "code_generation": 4, "creative_generative": 9, "research_synthesis": 8, "factual_recall_precision": 8, "multi_step_problem_solving": 7, "domain_terminology_handling": 8}'::jsonb, 16),

('interdisciplinary', 'Interdisciplinary Studies', '🔗', '#95A5A6', 'Cross-domain fields combining multiple disciplines',
 '{"reasoning_depth": 9, "mathematical_quantitative": 6, "code_generation": 5, "creative_generative": 7, "research_synthesis": 10, "factual_recall_precision": 8, "multi_step_problem_solving": 9, "domain_terminology_handling": 8}'::jsonb, 17)

ON CONFLICT (field_id) DO UPDATE SET
    field_name = EXCLUDED.field_name,
    field_icon = EXCLUDED.field_icon,
    field_color = EXCLUDED.field_color,
    field_description = EXCLUDED.field_description,
    field_proficiencies = EXCLUDED.field_proficiencies,
    display_order = EXCLUDED.display_order,
    updated_at = NOW();

-- ============================================================================
-- Seed Data: Sample Domains (first few for each field)
-- ============================================================================

-- Sciences domains
INSERT INTO domain_taxonomy_domains (domain_id, domain_name, domain_icon, domain_description, parent_field, detection_keywords, domain_proficiencies) VALUES
('physics', 'Physics', '⚛️', 'Study of matter, energy, and fundamental forces of nature', 'sciences',
 '["physics", "quantum", "relativity", "particle", "thermodynamics", "mechanics", "electromagnetism"]'::jsonb,
 '{"reasoning_depth": 10, "mathematical_quantitative": 10, "code_generation": 6, "creative_generative": 4, "research_synthesis": 9, "factual_recall_precision": 9, "multi_step_problem_solving": 10, "domain_terminology_handling": 9}'::jsonb),

('chemistry', 'Chemistry', '🧪', 'Study of matter composition, structure, properties, and reactions', 'sciences',
 '["chemistry", "chemical", "molecule", "reaction", "compound", "synthesis", "bond"]'::jsonb,
 '{"reasoning_depth": 9, "mathematical_quantitative": 8, "code_generation": 5, "creative_generative": 5, "research_synthesis": 9, "factual_recall_precision": 9, "multi_step_problem_solving": 9, "domain_terminology_handling": 9}'::jsonb),

('biology', 'Biology', '🧬', 'Study of living organisms and life processes', 'sciences',
 '["biology", "cell", "organism", "genetics", "evolution", "ecology", "molecular"]'::jsonb,
 '{"reasoning_depth": 8, "mathematical_quantitative": 6, "code_generation": 5, "creative_generative": 4, "research_synthesis": 9, "factual_recall_precision": 9, "multi_step_problem_solving": 8, "domain_terminology_handling": 9}'::jsonb),

-- Computer Science domains
('software_engineering', 'Software Engineering', '👨‍💻', 'Software development methodologies, design patterns, and best practices', 'computer_science',
 '["software", "engineering", "development", "agile", "devops", "architecture", "design pattern"]'::jsonb,
 '{"reasoning_depth": 9, "mathematical_quantitative": 6, "code_generation": 10, "creative_generative": 7, "research_synthesis": 7, "factual_recall_precision": 8, "multi_step_problem_solving": 10, "domain_terminology_handling": 9}'::jsonb),

('web_development', 'Web Development', '🌐', 'Frontend, backend, and full-stack web technologies', 'computer_science',
 '["web", "frontend", "backend", "javascript", "react", "node", "api", "html", "css"]'::jsonb,
 '{"reasoning_depth": 7, "mathematical_quantitative": 5, "code_generation": 10, "creative_generative": 7, "research_synthesis": 6, "factual_recall_precision": 8, "multi_step_problem_solving": 9, "domain_terminology_handling": 9}'::jsonb),

('cybersecurity', 'Cybersecurity', '🔐', 'Information security, threat detection, and protective measures', 'computer_science',
 '["security", "cybersecurity", "vulnerability", "encryption", "firewall", "penetration", "hacking"]'::jsonb,
 '{"reasoning_depth": 9, "mathematical_quantitative": 7, "code_generation": 8, "creative_generative": 5, "research_synthesis": 8, "factual_recall_precision": 9, "multi_step_problem_solving": 10, "domain_terminology_handling": 9}'::jsonb),

-- AI/ML domains
('machine_learning', 'Machine Learning', '🧠', 'Statistical learning, supervised and unsupervised methods', 'ai_ml',
 '["machine learning", "ml", "training", "model", "supervised", "unsupervised", "classification", "regression"]'::jsonb,
 '{"reasoning_depth": 10, "mathematical_quantitative": 10, "code_generation": 9, "creative_generative": 5, "research_synthesis": 9, "factual_recall_precision": 8, "multi_step_problem_solving": 10, "domain_terminology_handling": 10}'::jsonb),

('deep_learning', 'Deep Learning', '🔮', 'Neural networks, transformers, and deep architectures', 'ai_ml',
 '["deep learning", "neural network", "transformer", "cnn", "rnn", "lstm", "attention", "gpu"]'::jsonb,
 '{"reasoning_depth": 10, "mathematical_quantitative": 9, "code_generation": 10, "creative_generative": 6, "research_synthesis": 9, "factual_recall_precision": 8, "multi_step_problem_solving": 10, "domain_terminology_handling": 10}'::jsonb),

('nlp', 'Natural Language Processing', '💬', 'Text analysis, language models, and conversational AI', 'ai_ml',
 '["nlp", "natural language", "text", "language model", "tokenization", "embedding", "chatbot", "llm"]'::jsonb,
 '{"reasoning_depth": 9, "mathematical_quantitative": 8, "code_generation": 9, "creative_generative": 8, "research_synthesis": 9, "factual_recall_precision": 8, "multi_step_problem_solving": 9, "domain_terminology_handling": 10}'::jsonb),

-- Medicine domains
('clinical_medicine', 'Clinical Medicine', '👨‍⚕️', 'Diagnosis, treatment, and patient care', 'medicine',
 '["clinical", "diagnosis", "treatment", "patient", "symptoms", "therapy", "prognosis"]'::jsonb,
 '{"reasoning_depth": 10, "mathematical_quantitative": 6, "code_generation": 2, "creative_generative": 3, "research_synthesis": 9, "factual_recall_precision": 10, "multi_step_problem_solving": 10, "domain_terminology_handling": 10}'::jsonb),

('pharmacology', 'Pharmacology', '💊', 'Drug development, mechanisms, and therapeutics', 'medicine',
 '["pharmacology", "drug", "medication", "dosage", "pharmaceutical", "prescription", "side effect"]'::jsonb,
 '{"reasoning_depth": 9, "mathematical_quantitative": 7, "code_generation": 3, "creative_generative": 3, "research_synthesis": 9, "factual_recall_precision": 10, "multi_step_problem_solving": 9, "domain_terminology_handling": 10}'::jsonb),

-- Business domains
('finance', 'Finance', '📈', 'Financial analysis, investment, and markets', 'business',
 '["finance", "investment", "stock", "portfolio", "banking", "trading", "valuation", "risk"]'::jsonb,
 '{"reasoning_depth": 9, "mathematical_quantitative": 9, "code_generation": 6, "creative_generative": 4, "research_synthesis": 8, "factual_recall_precision": 9, "multi_step_problem_solving": 9, "domain_terminology_handling": 9}'::jsonb),

('marketing', 'Marketing', '📣', 'Marketing strategy, branding, and consumer behavior', 'business',
 '["marketing", "brand", "advertising", "campaign", "consumer", "seo", "social media", "content"]'::jsonb,
 '{"reasoning_depth": 7, "mathematical_quantitative": 6, "code_generation": 4, "creative_generative": 9, "research_synthesis": 8, "factual_recall_precision": 7, "multi_step_problem_solving": 8, "domain_terminology_handling": 8}'::jsonb),

-- Law domains
('corporate_law', 'Corporate Law', '🏢', 'Business law, contracts, and corporate governance', 'law_legal',
 '["corporate", "contract", "merger", "acquisition", "compliance", "governance", "securities"]'::jsonb,
 '{"reasoning_depth": 10, "mathematical_quantitative": 5, "code_generation": 2, "creative_generative": 4, "research_synthesis": 9, "factual_recall_precision": 10, "multi_step_problem_solving": 9, "domain_terminology_handling": 10}'::jsonb),

('intellectual_property', 'Intellectual Property', '©️', 'Patents, trademarks, copyrights, and trade secrets', 'law_legal',
 '["patent", "trademark", "copyright", "intellectual property", "ip", "licensing", "infringement"]'::jsonb,
 '{"reasoning_depth": 9, "mathematical_quantitative": 4, "code_generation": 2, "creative_generative": 5, "research_synthesis": 9, "factual_recall_precision": 10, "multi_step_problem_solving": 9, "domain_terminology_handling": 10}'::jsonb)

ON CONFLICT (domain_id) DO UPDATE SET
    domain_name = EXCLUDED.domain_name,
    domain_icon = EXCLUDED.domain_icon,
    domain_description = EXCLUDED.domain_description,
    detection_keywords = EXCLUDED.detection_keywords,
    domain_proficiencies = EXCLUDED.domain_proficiencies,
    updated_at = NOW();

-- ============================================================================
-- Seed Data: Sample Subspecialties
-- ============================================================================

INSERT INTO domain_taxonomy_subspecialties (subspecialty_id, subspecialty_name, description, parent_domain, detection_keywords, terminology_signals, subspecialty_proficiencies) VALUES
-- Physics subspecialties
('quantum_mechanics', 'Quantum Mechanics', 'Wave-particle duality, Schrödinger equation, quantum states, measurement theory', 'physics',
 '["quantum", "wave function", "Schrödinger", "Heisenberg", "superposition", "entanglement", "uncertainty principle"]'::jsonb,
 '{"high_confidence": ["wave function", "Hilbert space", "eigenstate", "observable", "commutator", "bra-ket"], "medium_confidence": ["quantum", "uncertainty", "probability amplitude"], "exclusionary": ["quantum computing", "qubit"]}'::jsonb,
 '{"reasoning_depth": 10, "mathematical_quantitative": 10, "code_generation": 5, "creative_generative": 4, "research_synthesis": 9, "factual_recall_precision": 9, "multi_step_problem_solving": 10, "domain_terminology_handling": 10}'::jsonb),

('classical_mechanics', 'Classical Mechanics', 'Newtonian mechanics, Lagrangian and Hamiltonian formulations, rigid body dynamics', 'physics',
 '["Newton", "Lagrangian", "Hamiltonian", "rigid body", "inertia", "momentum", "torque", "angular momentum"]'::jsonb,
 '{"high_confidence": ["Lagrangian", "Hamiltonian", "phase space", "canonical transformation", "Noether theorem"], "medium_confidence": ["force", "acceleration", "momentum", "energy conservation"], "exclusionary": ["quantum", "relativistic"]}'::jsonb,
 '{"reasoning_depth": 9, "mathematical_quantitative": 10, "code_generation": 6, "creative_generative": 3, "research_synthesis": 7, "factual_recall_precision": 8, "multi_step_problem_solving": 10, "domain_terminology_handling": 8}'::jsonb),

-- Machine Learning subspecialties
('supervised_learning', 'Supervised Learning', 'Classification, regression, and labeled data methods', 'machine_learning',
 '["supervised", "classification", "regression", "labeled", "training data", "cross-validation", "overfitting"]'::jsonb,
 '{"high_confidence": ["loss function", "gradient descent", "cross-entropy", "confusion matrix", "ROC curve"], "medium_confidence": ["training", "prediction", "accuracy"], "exclusionary": []}'::jsonb,
 '{"reasoning_depth": 9, "mathematical_quantitative": 9, "code_generation": 10, "creative_generative": 4, "research_synthesis": 8, "factual_recall_precision": 8, "multi_step_problem_solving": 9, "domain_terminology_handling": 9}'::jsonb),

('reinforcement_learning', 'Reinforcement Learning', 'Agent-based learning, reward optimization, and policy gradients', 'machine_learning',
 '["reinforcement", "reward", "agent", "environment", "policy", "Q-learning", "exploration"]'::jsonb,
 '{"high_confidence": ["Bellman equation", "policy gradient", "actor-critic", "temporal difference", "epsilon-greedy"], "medium_confidence": ["agent", "reward", "state", "action"], "exclusionary": []}'::jsonb,
 '{"reasoning_depth": 10, "mathematical_quantitative": 9, "code_generation": 9, "creative_generative": 5, "research_synthesis": 9, "factual_recall_precision": 8, "multi_step_problem_solving": 10, "domain_terminology_handling": 10}'::jsonb),

-- Software Engineering subspecialties
('frontend_development', 'Frontend Development', 'User interfaces, JavaScript frameworks, and browser technologies', 'web_development',
 '["frontend", "react", "vue", "angular", "javascript", "typescript", "css", "html", "ui"]'::jsonb,
 '{"high_confidence": ["virtual DOM", "state management", "component lifecycle", "hooks", "SSR"], "medium_confidence": ["component", "render", "styling"], "exclusionary": []}'::jsonb,
 '{"reasoning_depth": 7, "mathematical_quantitative": 4, "code_generation": 10, "creative_generative": 8, "research_synthesis": 6, "factual_recall_precision": 8, "multi_step_problem_solving": 8, "domain_terminology_handling": 9}'::jsonb),

('backend_development', 'Backend Development', 'Server-side programming, APIs, and databases', 'web_development',
 '["backend", "server", "api", "database", "node", "python", "java", "rest", "graphql"]'::jsonb,
 '{"high_confidence": ["middleware", "ORM", "connection pooling", "microservices", "rate limiting"], "medium_confidence": ["server", "endpoint", "query"], "exclusionary": []}'::jsonb,
 '{"reasoning_depth": 8, "mathematical_quantitative": 5, "code_generation": 10, "creative_generative": 5, "research_synthesis": 7, "factual_recall_precision": 8, "multi_step_problem_solving": 9, "domain_terminology_handling": 9}'::jsonb)

ON CONFLICT (subspecialty_id) DO UPDATE SET
    subspecialty_name = EXCLUDED.subspecialty_name,
    description = EXCLUDED.description,
    detection_keywords = EXCLUDED.detection_keywords,
    terminology_signals = EXCLUDED.terminology_signals,
    subspecialty_proficiencies = EXCLUDED.subspecialty_proficiencies,
    updated_at = NOW();

-- ============================================================================
-- RLS Policies
-- ============================================================================

ALTER TABLE domain_taxonomy_feedback ENABLE ROW LEVEL SECURITY;
ALTER TABLE domain_taxonomy_selections ENABLE ROW LEVEL SECURITY;

CREATE POLICY taxonomy_feedback_tenant_isolation ON domain_taxonomy_feedback
    FOR ALL USING (tenant_id = current_setting('app.current_tenant_id', true));

CREATE POLICY taxonomy_selections_tenant_isolation ON domain_taxonomy_selections
    FOR ALL USING (tenant_id = current_setting('app.current_tenant_id', true));

-- Grant read access to taxonomy tables for all users
GRANT SELECT ON domain_taxonomy_fields TO authenticated;
GRANT SELECT ON domain_taxonomy_domains TO authenticated;
GRANT SELECT ON domain_taxonomy_subspecialties TO authenticated;
