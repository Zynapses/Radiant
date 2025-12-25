    latency_ms INTEGER,
    
    -- Status
    status VARCHAR(20) NOT NULL DEFAULT 'pending' 
        CHECK (status IN ('pending', 'completed', 'failed')),
    error_message TEXT,
    
    -- Metadata
    metadata JSONB DEFAULT '{}',
    
    -- Timestamps
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    completed_at TIMESTAMPTZ,
    
    -- Indexes
    CONSTRAINT fk_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id)
);

CREATE INDEX idx_cost_logs_tenant_created ON cost_logs(tenant_id, created_at DESC);
CREATE INDEX idx_cost_logs_product_created ON cost_logs(product, created_at DESC);
CREATE INDEX idx_cost_logs_model ON cost_logs(model);
CREATE INDEX idx_cost_logs_status ON cost_logs(status) WHERE status = 'pending';


-- =====================================================
-- NEURAL ENGINE INSIGHTS
-- =====================================================

CREATE TABLE cost_insights (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id),
    product VARCHAR(20) NOT NULL CHECK (product IN ('radiant', 'thinktank', 'combined')),
    
    -- Insight details
    type VARCHAR(30) NOT NULL CHECK (type IN ('recommendation', 'trend', 'anomaly')),
    title VARCHAR(200) NOT NULL,
    description TEXT NOT NULL,
    
    -- Impact
    estimated_savings DECIMAL(10, 2),
    savings_percent DECIMAL(5, 2),
    
    -- Analysis data
    data JSONB NOT NULL DEFAULT '{}',
    confidence DECIMAL(3, 2) NOT NULL,
    
    -- Status
    status VARCHAR(20) NOT NULL DEFAULT 'active' 
        CHECK (status IN ('active', 'dismissed', 'applied')),
    
    -- Timestamps
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    expires_at TIMESTAMPTZ NOT NULL,
    actioned_at TIMESTAMPTZ,
    actioned_by UUID REFERENCES admin_users(id)
);

CREATE INDEX idx_cost_insights_tenant_status ON cost_insights(tenant_id, status);


-- =====================================================
-- COST ALERTS
-- =====================================================

CREATE TABLE cost_alert_configs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id),
    
    -- Thresholds
    monthly_budget DECIMAL(10, 2),
    budget_alert_percent INTEGER DEFAULT 80,
    spike_multiplier DECIMAL(3, 1) DEFAULT 3.0,
    variance_threshold_percent INTEGER DEFAULT 20,
    
    -- Notifications
    notify_email BOOLEAN DEFAULT TRUE,
    notify_dashboard BOOLEAN DEFAULT TRUE,
    notify_slack BOOLEAN DEFAULT FALSE,
    slack_webhook_url TEXT,
    
    -- Timestamps
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    UNIQUE(tenant_id)
);

CREATE TABLE cost_alerts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id),
    
    type VARCHAR(30) NOT NULL 
        CHECK (type IN ('budget_threshold', 'cost_spike', 'variance_warning', 'anomaly')),
    severity VARCHAR(20) NOT NULL 
        CHECK (severity IN ('info', 'warning', 'critical')),
    
    message TEXT NOT NULL,
    data JSONB NOT NULL DEFAULT '{}',
    
    -- Resolution
    resolved BOOLEAN DEFAULT FALSE,
    resolved_at TIMESTAMPTZ,
    resolved_by UUID REFERENCES admin_users(id),
    resolution_notes TEXT,
    
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_cost_alerts_tenant_resolved ON cost_alerts(tenant_id, resolved);


-- =====================================================
-- A/B TESTING
-- =====================================================

CREATE TABLE experiments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(200) NOT NULL,
    description TEXT,
    hypothesis TEXT,
    
    product VARCHAR(20) NOT NULL CHECK (product IN ('radiant', 'thinktank', 'combined')),
    status VARCHAR(20) NOT NULL DEFAULT 'draft' 
        CHECK (status IN ('draft', 'running', 'paused', 'completed', 'cancelled')),
    
    -- Variants (JSONB array)
    variants JSONB NOT NULL DEFAULT '[]',
    
    -- Metrics
    primary_metric JSONB NOT NULL,
    secondary_metrics JSONB DEFAULT '[]',
    
    -- Targeting
    targeting_percentage INTEGER NOT NULL DEFAULT 100,
    user_segments JSONB DEFAULT '[]',
    exclude_users JSONB DEFAULT '[]',
    
    -- Schedule
    start_date TIMESTAMPTZ,
    end_date TIMESTAMPTZ,
    min_sample_size INTEGER DEFAULT 1000,
    max_duration_days INTEGER DEFAULT 30,
    
    -- Analysis config
    significance_threshold DECIMAL(4, 3) DEFAULT 0.95,
    minimum_effect DECIMAL(5, 4),
    
    -- Timestamps
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by UUID REFERENCES admin_users(id),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    completed_at TIMESTAMPTZ
);

CREATE INDEX idx_experiments_status ON experiments(status);
CREATE INDEX idx_experiments_product ON experiments(product);


CREATE TABLE experiment_assignments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    experiment_id UUID NOT NULL REFERENCES experiments(id) ON DELETE CASCADE,
    user_id UUID NOT NULL,
    tenant_id UUID NOT NULL REFERENCES tenants(id),
    product VARCHAR(20) NOT NULL,
    
    variant_id VARCHAR(100) NOT NULL,
    variant_name VARCHAR(200) NOT NULL,
    
    assigned_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    UNIQUE(experiment_id, user_id)
);

CREATE INDEX idx_experiment_assignments_user ON experiment_assignments(user_id);
CREATE INDEX idx_experiment_assignments_experiment ON experiment_assignments(experiment_id);


CREATE TABLE experiment_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    experiment_id UUID NOT NULL REFERENCES experiments(id) ON DELETE CASCADE,
    user_id UUID NOT NULL,
    tenant_id UUID NOT NULL REFERENCES tenants(id),
    product VARCHAR(20) NOT NULL,
    
    variant_id VARCHAR(100) NOT NULL,
    event_name VARCHAR(100) NOT NULL,
    event_value DECIMAL(15, 4),
    
    metadata JSONB DEFAULT '{}',
    timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_experiment_events_experiment ON experiment_events(experiment_id);
CREATE INDEX idx_experiment_events_variant ON experiment_events(experiment_id, variant_id);
CREATE INDEX idx_experiment_events_event ON experiment_events(experiment_id, event_name);


-- =====================================================
-- SECURITY & COMPLIANCE
-- =====================================================

CREATE TABLE security_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id),
    user_id UUID REFERENCES users(id),
    product VARCHAR(20) NOT NULL CHECK (product IN ('radiant', 'thinktank')),
    
    type VARCHAR(50) NOT NULL,
    severity VARCHAR(20) NOT NULL 
        CHECK (severity IN ('low', 'medium', 'high', 'critical')),
    
    details JSONB NOT NULL DEFAULT '{}',
    
    -- Source info
    ip_address INET,
    user_agent TEXT,
    geo_location JSONB,
    
    -- Resolution
    resolved BOOLEAN DEFAULT FALSE,
    resolved_at TIMESTAMPTZ,
    resolved_by UUID REFERENCES admin_users(id),
    resolution TEXT,
    
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_security_events_tenant_type ON security_events(tenant_id, type);
CREATE INDEX idx_security_events_severity ON security_events(severity);
CREATE INDEX idx_security_events_resolved ON security_events(resolved) WHERE resolved = FALSE;
CREATE INDEX idx_security_events_created ON security_events(created_at DESC);


CREATE TABLE compliance_reports (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID REFERENCES tenants(id),  -- NULL for platform-wide reports
    
    framework VARCHAR(30) NOT NULL 
        CHECK (framework IN ('soc2', 'hipaa', 'gdpr', 'iso27001', 'custom')),
    report_type VARCHAR(50) NOT NULL,
    
    product VARCHAR(20) NOT NULL CHECK (product IN ('radiant', 'thinktank', 'combined')),
    
    date_range_start TIMESTAMPTZ NOT NULL,
    date_range_end TIMESTAMPTZ NOT NULL,
    
    -- Report content
    data JSONB NOT NULL,
    summary TEXT,
    
    -- File storage
    pdf_url TEXT,
    csv_url TEXT,
    
    generated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    generated_by UUID REFERENCES admin_users(id)
);

CREATE INDEX idx_compliance_reports_framework ON compliance_reports(framework);
CREATE INDEX idx_compliance_reports_tenant ON compliance_reports(tenant_id);


-- =====================================================
-- DEPLOYMENT CONFIGURATION
-- =====================================================

CREATE TABLE deployment_timeouts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID REFERENCES tenants(id),  -- NULL for system defaults
    
    category VARCHAR(50) NOT NULL,
    operation VARCHAR(100) NOT NULL,
    timeout_seconds INTEGER NOT NULL,
    
    is_default BOOLEAN DEFAULT FALSE,
    
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_by UUID REFERENCES admin_users(id),
    
    UNIQUE(tenant_id, category, operation)
);

-- Insert default timeouts
INSERT INTO deployment_timeouts (tenant_id, category, operation, timeout_seconds, is_default) VALUES
(NULL, 'package', 'import', 15, true),
(NULL, 'package', 'extraction', 30, true),
(NULL, 'package', 'checksum', 10, true),
(NULL, 'validation', 'ast', 90, true),
(NULL, 'validation', 'grep', 10, true),
(NULL, 'snapshot', 'aurora', 300, true),
(NULL, 'snapshot', 'dynamodb', 180, true),
(NULL, 'snapshot', 's3_manifest', 120, true),
(NULL, 'infrastructure', 'cdk_synthesis', 120, true),
(NULL, 'infrastructure', 'cloudformation', 900, true),
(NULL, 'infrastructure', 'rollback', 600, true),
(NULL, 'migration', 'step', 300, true),
(NULL, 'migration', 'transaction', 600, true),
(NULL, 'migration', 'lock_acquisition', 30, true),
(NULL, 'health', 'endpoint', 10, true),
(NULL, 'health', 'total', 60, true),
(NULL, 'health', 'retry_interval', 5, true),
(NULL, 'health', 'max_retries', 3, true),
(NULL, 'maintenance', 'drain', 30, true),
(NULL, 'lock', 'ttl', 300, true),
(NULL, 'lock', 'heartbeat', 60, true),
(NULL, 'lock', 'stale_threshold', 120, true),
(NULL, 'ai', 'claude_api', 30, true),
(NULL, 'ai', 'voice_transcription', 10, true);


CREATE TABLE deployment_settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID REFERENCES tenants(id),  -- NULL for system defaults
    
    lock_step_mode BOOLEAN DEFAULT FALSE,
    max_version_drift_major INTEGER DEFAULT 1,
    max_version_drift_minor INTEGER DEFAULT 5,
    warn_on_drift BOOLEAN DEFAULT TRUE,
    
    create_snapshot_by_default BOOLEAN DEFAULT TRUE,
    run_health_checks_by_default BOOLEAN DEFAULT TRUE,
    enable_maintenance_mode_by_default BOOLEAN DEFAULT TRUE,
    
    retention_production_days INTEGER DEFAULT 90,
    retention_staging_days INTEGER DEFAULT 30,
    retention_development_days INTEGER DEFAULT 7,
    max_snapshots_per_environment INTEGER DEFAULT 10,
    
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_by UUID REFERENCES admin_users(id),
    
    UNIQUE(tenant_id)
);

-- Insert system defaults
INSERT INTO deployment_settings (tenant_id) VALUES (NULL);
```

### Migration: 046_to_047.sql

```sql
-- Migration: 046_to_047
-- Description: Add cost tracking, A/B testing, security, and compliance tables
-- Version: 4.18.0

BEGIN;

-- Cost tracking tables
CREATE TABLE IF NOT EXISTS cost_logs (...);
CREATE TABLE IF NOT EXISTS cost_insights (...);
CREATE TABLE IF NOT EXISTS cost_alert_configs (...);
CREATE TABLE IF NOT EXISTS cost_alerts (...);

-- A/B testing tables
CREATE TABLE IF NOT EXISTS experiments (...);
CREATE TABLE IF NOT EXISTS experiment_assignments (...);
CREATE TABLE IF NOT EXISTS experiment_events (...);

-- Security tables
CREATE TABLE IF NOT EXISTS security_events (...);
CREATE TABLE IF NOT EXISTS compliance_reports (...);

-- Deployment config tables
CREATE TABLE IF NOT EXISTS deployment_timeouts (...);
CREATE TABLE IF NOT EXISTS deployment_settings (...);

-- Insert default values
INSERT INTO deployment_timeouts (...) VALUES (...);
INSERT INTO deployment_settings (tenant_id) VALUES (NULL);

-- Record migration
INSERT INTO schema_migrations (version, component, applied_at)
VALUES ('047', 'radiant', NOW());

COMMIT;
```

---

## IMPLEMENTATION CHECKLIST

### Phase 1: Local Storage Foundation
- [ ] Create LocalStorageManager with SQLCipher encryption
- [ ] Implement Keychain integration for encryption key
- [ ] Add JSON schemas with integrity verification
- [ ] Implement backup/restore for corrupted files
- [ ] Add ConnectionStatusIndicator component

### Phase 2: Progress UI + Cancel
- [ ] Create DeploymentState enum with all phases
- [ ] Implement DeploymentProgressView with phase list
- [ ] Add cancel confirmation dialog
- [ ] Implement rollback flow on cancel
- [ ] Add AI explanation integration
- [ ] Create FailureDetailsView with recovery options

### Phase 3: Package System
- [ ] Create manifest.json schema (v2.0)
- [ ] Implement component versioning (touched flag)
- [ ] Add hash verification for untouched components
- [ ] Create PackageInstallView with component checkboxes
- [ ] Implement discrete validation result display

### Phase 4: AI Assistant
- [ ] Create AIAssistantService with Claude API
- [ ] Implement Keychain storage for API key
- [ ] Add connection monitoring (60s poll)
- [ ] Implement explain(), translateError(), recommendRecovery()
- [ ] Add fallback methods for offline mode
- [ ] Create AISettingsView

### Phase 5: Build System
- [ ] Create pre-commit hook (version bump enforcement)
- [ ] Create commit-msg hook (Conventional Commits)
- [ ] Implement bump-version.sh with auto-detection
- [ ] Create validate-discrete.sh (grep, fast)
- [ ] Create validate-discrete-ast.ts (TypeScript, CI)
- [ ] Add VERSION, RADIANT_VERSION, THINKTANK_VERSION files

### Phase 6: Database Schema
- [ ] Create migration 046_to_047.sql
- [ ] Add cost_logs, cost_insights, cost_alerts tables
- [ ] Add experiments, experiment_assignments, experiment_events
- [ ] Add security_events, compliance_reports tables
- [ ] Add deployment_timeouts, deployment_settings tables
- [ ] Insert default values

### Phase 7: Cost Management
- [ ] Create cost-logger Lambda
- [ ] Add cost logging to AI Router
- [ ] Create Neural Engine cost analyzer
- [ ] Build CostAnalytics dashboard component
- [ ] Implement cost alerts system
- [ ] Add segmentation (Radiant/ThinkTank/Combined)

### Phase 8: Compliance Reports
- [ ] Create compliance-reporter Lambda
- [ ] Implement SOC2 report generation
- [ ] Implement HIPAA report generation
- [ ] Implement GDPR report generation
- [ ] Implement ISO27001 report generation
- [ ] Build ComplianceReports dashboard
- [ ] Create CustomReportBuilder

### Phase 9: Security Monitoring
- [ ] Create anomaly-detector Lambda
- [ ] Implement failed login detection
- [ ] Implement geographic anomaly detection
- [ ] Implement session hijacking detection
- [ ] Build SecurityDashboard component
- [ ] Add security event alerting

### Phase 10: A/B Testing
- [ ] Create experiment-tracker Lambda
- [ ] Implement hash-based variant assignment
- [ ] Create statistical analysis functions
- [ ] Build ExperimentDashboard component
- [ ] Build ExperimentDetail with results
- [ ] Add segmentation support

### Phase 11: Deployment Settings
- [ ] Create DeploymentSettings component
- [ ] Create OperationTimeouts component
- [ ] Implement SSM parameter sync
- [ ] Create TimeoutService in Deployer
- [ ] Add bidirectional sync logic

### Phase 12: Integration & Testing
- [ ] End-to-end deployment test
- [ ] Cost tracking verification
- [ ] A/B test experiment lifecycle
- [ ] Compliance report generation test
- [ ] Security alert verification
- [ ] Timeout configuration sync test

---

## SUCCESS CRITERIA

| Feature | Criteria |
|---------|----------|
| **Package System** | Single .pkg contains both Radiant and Think Tank with independent versions |
| **Component Selection** | UI shows checkboxes, touched components checked by default |
| **Progress UI** | Real-time phase updates with percentage and ETA |
| **Cancel** | Immediate abort with automatic rollback to snapshot |
| **AI Assistant** | Explains phases, translates errors, recommends recovery |
| **Voice Input** | Native macOS speech recognition works |
| **Cost Tracking** | Every AI request logged with est vs actual |
| **Neural Engine** | Generates non-auto recommendations for admin review |
| **Cost Alerts** | Triggers on budget threshold, spikes |
| **Compliance** | SOC2, HIPAA, GDPR, ISO27001 reports generate correctly |
| **Security** | Anomaly detection catches failed logins, geo anomalies, hijacking |
| **A/B Testing** | Experiments run with proper statistical analysis |
| **Segmentation** | All reports/analytics filterable by Radiant/ThinkTank/Combined |
| **Timeouts** | All configurable via Admin Dashboard, sync to Deployer |
| **Local Storage** | SQLCipher encrypted, auto-restore from backup |
| **Build System** | Pre-commit enforces version bump, AST validates discrete separation |

---

## FUTURE ENHANCEMENTS (Documented, Not Implemented)

| Enhancement | Status | Notes |
|-------------|--------|-------|
| Package Signing | 📝 Documented | Apple Developer ID code signing |
| Canary Deployments | 🔲 UI Stubbed | Instance-level canary with manual promotion |
| PCI-DSS Compliance | 📝 Documented | If storing payment card data |
| FedRAMP | 📝 Documented | For government contracts |
| Traffic-level Canary | 📝 Documented | ALB weighted routing |

---

**END OF PROMPT-33 v3**

