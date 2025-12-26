-- RADIANT v4.17.0 - Migration 041: Admin & Billing Enhancements
-- Extended invitation schema, admin profiles, billing settings

-- ============================================================================
-- EXTEND INVITATIONS TABLE
-- ============================================================================

ALTER TABLE invitations 
    ADD COLUMN IF NOT EXISTS app_id VARCHAR(100),
    ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES tenants(id),
    ADD COLUMN IF NOT EXISTS environment VARCHAR(20) DEFAULT 'dev',
    ADD COLUMN IF NOT EXISTS status VARCHAR(20) DEFAULT 'pending',
    ADD COLUMN IF NOT EXISTS message TEXT,
    ADD COLUMN IF NOT EXISTS accepted_by_ip VARCHAR(45);

-- Add constraint if not exists
DO $$ BEGIN
    ALTER TABLE invitations ADD CONSTRAINT valid_invitation_status 
        CHECK (status IN ('pending', 'accepted', 'expired', 'revoked'));
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS idx_invitations_tenant ON invitations(tenant_id);
CREATE INDEX IF NOT EXISTS idx_invitations_status ON invitations(status);

-- ============================================================================
-- EXTEND APPROVAL REQUESTS TABLE
-- ============================================================================

ALTER TABLE approval_requests
    ADD COLUMN IF NOT EXISTS type VARCHAR(50),
    ADD COLUMN IF NOT EXISTS app_id VARCHAR(100),
    ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES tenants(id),
    ADD COLUMN IF NOT EXISTS environment VARCHAR(20) DEFAULT 'dev',
    ADD COLUMN IF NOT EXISTS requested_by UUID REFERENCES administrators(id),
    ADD COLUMN IF NOT EXISTS requested_at TIMESTAMPTZ DEFAULT NOW(),
    ADD COLUMN IF NOT EXISTS approved_by UUID REFERENCES administrators(id),
    ADD COLUMN IF NOT EXISTS approved_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS rejected_reason TEXT,
    ADD COLUMN IF NOT EXISTS action VARCHAR(100),
    ADD COLUMN IF NOT EXISTS details JSONB DEFAULT '{}',
    ADD COLUMN IF NOT EXISTS priority VARCHAR(20) DEFAULT 'medium',
    ADD COLUMN IF NOT EXISTS notes TEXT,
    ADD COLUMN IF NOT EXISTS requires_two_person BOOLEAN DEFAULT false;

-- Add constraint if not exists
DO $$ BEGIN
    ALTER TABLE approval_requests ADD CONSTRAINT valid_approval_priority 
        CHECK (priority IN ('low', 'medium', 'high', 'critical'));
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS idx_approvals_tenant ON approval_requests(tenant_id);
CREATE INDEX IF NOT EXISTS idx_approvals_requested_by ON approval_requests(requested_by);

-- ============================================================================
-- ADMIN PROFILES TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS admin_profiles (
    admin_id UUID PRIMARY KEY REFERENCES administrators(id) ON DELETE CASCADE,
    notifications JSONB NOT NULL DEFAULT '{}',
    timezone VARCHAR(50) NOT NULL DEFAULT 'America/New_York',
    language VARCHAR(10) NOT NULL DEFAULT 'en',
    date_format VARCHAR(20) NOT NULL DEFAULT 'MM/DD/YYYY',
    time_format VARCHAR(10) NOT NULL DEFAULT '12h',
    currency VARCHAR(3) NOT NULL DEFAULT 'USD',
    theme VARCHAR(20) NOT NULL DEFAULT 'system',
    default_environment VARCHAR(20) NOT NULL DEFAULT 'dev',
    sidebar_collapsed BOOLEAN NOT NULL DEFAULT false,
    table_rows_per_page INTEGER NOT NULL DEFAULT 25,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================================
-- BILLING SETTINGS TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS billing_settings (
    tenant_id VARCHAR(100) PRIMARY KEY,
    margin_percent DECIMAL(5,2) NOT NULL DEFAULT 20.00,
    margin_type VARCHAR(20) NOT NULL DEFAULT 'fixed',
    tiers JSONB,
    tax_enabled BOOLEAN NOT NULL DEFAULT false,
    tax_percent DECIMAL(5,2) NOT NULL DEFAULT 0.00,
    tax_id VARCHAR(50),
    stripe_customer_id VARCHAR(100),
    default_payment_method_id VARCHAR(100),
    auto_pay BOOLEAN NOT NULL DEFAULT false,
    billing_cycle_day INTEGER NOT NULL DEFAULT 1,
    currency VARCHAR(3) NOT NULL DEFAULT 'USD',
    budget_limit DECIMAL(12,2),
    alert_thresholds INTEGER[] NOT NULL DEFAULT '{50, 75, 90, 100}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT valid_margin_type CHECK (margin_type IN ('fixed', 'tiered')),
    CONSTRAINT valid_billing_day CHECK (billing_cycle_day BETWEEN 1 AND 28)
);

-- ============================================================================
-- INVOICES TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS invoices (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id VARCHAR(100) NOT NULL,
    app_id VARCHAR(100) NOT NULL,
    period_start DATE NOT NULL,
    period_end DATE NOT NULL,
    subtotal DECIMAL(12,2) NOT NULL,
    margin_percent DECIMAL(5,2) NOT NULL,
    tax DECIMAL(12,2) NOT NULL DEFAULT 0,
    tax_percent DECIMAL(5,2) NOT NULL DEFAULT 0,
    total DECIMAL(12,2) NOT NULL,
    currency VARCHAR(3) NOT NULL DEFAULT 'USD',
    status VARCHAR(20) NOT NULL DEFAULT 'draft',
    due_date TIMESTAMPTZ NOT NULL,
    paid_at TIMESTAMPTZ,
    line_items JSONB NOT NULL DEFAULT '[]',
    stripe_invoice_id VARCHAR(100),
    stripe_payment_intent_id VARCHAR(100),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT valid_invoice_status CHECK (status IN ('draft', 'pending', 'paid', 'overdue', 'cancelled'))
);

CREATE INDEX IF NOT EXISTS idx_invoices_tenant ON invoices(tenant_id);
CREATE INDEX IF NOT EXISTS idx_invoices_status ON invoices(status);
CREATE INDEX IF NOT EXISTS idx_invoices_period ON invoices(period_start, period_end);

-- ============================================================================
-- ADMIN NOTIFICATIONS TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS admin_notifications (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    admin_id UUID NOT NULL REFERENCES administrators(id) ON DELETE CASCADE,
    tenant_id VARCHAR(100) NOT NULL,
    type VARCHAR(50) NOT NULL,
    priority VARCHAR(20) NOT NULL DEFAULT 'medium',
    title VARCHAR(255) NOT NULL,
    message TEXT NOT NULL,
    action_url VARCHAR(500),
    action_label VARCHAR(100),
    read BOOLEAN NOT NULL DEFAULT false,
    read_at TIMESTAMPTZ,
    dismissed BOOLEAN NOT NULL DEFAULT false,
    dismissed_at TIMESTAMPTZ,
    email_sent BOOLEAN NOT NULL DEFAULT false,
    email_sent_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    expires_at TIMESTAMPTZ,
    CONSTRAINT valid_notification_type CHECK (type IN ('security', 'billing', 'deployment', 'approval', 'system', 'alert')),
    CONSTRAINT valid_notification_priority CHECK (priority IN ('low', 'medium', 'high', 'critical'))
);

CREATE INDEX IF NOT EXISTS idx_notifications_admin ON admin_notifications(admin_id);
CREATE INDEX IF NOT EXISTS idx_notifications_read ON admin_notifications(admin_id, read);

-- ============================================================================
-- TRIGGERS
-- ============================================================================

CREATE TRIGGER update_admin_profiles_updated_at BEFORE UPDATE ON admin_profiles
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_billing_settings_updated_at BEFORE UPDATE ON billing_settings
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_invoices_updated_at BEFORE UPDATE ON invoices
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
