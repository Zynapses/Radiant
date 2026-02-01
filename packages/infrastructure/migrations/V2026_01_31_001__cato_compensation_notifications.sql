-- ============================================================================
-- RADIANT v5.52.58 - Cato Compensation Notifications Table
-- Migration: V2026_01_31_001__cato_compensation_notifications.sql
--
-- Adds table for tracking compensation notifications sent via SNS
-- Required by the updated cato-compensation.service.ts
-- ============================================================================

-- Compensation Notifications - Track all notifications sent for SAGA compensation
CREATE TABLE IF NOT EXISTS cato_compensation_notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    pipeline_id UUID NOT NULL,
    compensation_id UUID NOT NULL REFERENCES cato_compensation_log(id) ON DELETE CASCADE,
    notification_type VARCHAR(50) NOT NULL,
    notification_payload JSONB NOT NULL DEFAULT '{}',
    status VARCHAR(20) NOT NULL DEFAULT 'PENDING',
    sent_at TIMESTAMPTZ,
    acknowledged_at TIMESTAMPTZ,
    acknowledged_by UUID REFERENCES users(id),
    error TEXT,
    retry_count INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    CONSTRAINT comp_notify_status_check CHECK (status IN ('PENDING', 'SENT', 'DELIVERED', 'ACKNOWLEDGED', 'FAILED'))
);

-- Indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_cato_comp_notify_tenant ON cato_compensation_notifications(tenant_id);
CREATE INDEX IF NOT EXISTS idx_cato_comp_notify_pipeline ON cato_compensation_notifications(pipeline_id);
CREATE INDEX IF NOT EXISTS idx_cato_comp_notify_comp_id ON cato_compensation_notifications(compensation_id);
CREATE INDEX IF NOT EXISTS idx_cato_comp_notify_status ON cato_compensation_notifications(status);
CREATE INDEX IF NOT EXISTS idx_cato_comp_notify_created ON cato_compensation_notifications(created_at DESC);

-- RLS policy
ALTER TABLE cato_compensation_notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY cato_compensation_notifications_tenant_isolation ON cato_compensation_notifications
    USING (tenant_id = current_setting('app.current_tenant_id', true)::UUID);

-- Add trigger for updated_at
CREATE TRIGGER update_cato_compensation_notifications_updated_at
    BEFORE UPDATE ON cato_compensation_notifications
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Grant permissions
GRANT SELECT, INSERT, UPDATE ON cato_compensation_notifications TO radiant_app;

COMMENT ON TABLE cato_compensation_notifications IS 'Tracks SNS notifications sent for SAGA compensation events';
COMMENT ON COLUMN cato_compensation_notifications.notification_type IS 'Type of notification (COMPENSATION_REQUIRED, MANUAL_INTERVENTION, etc.)';
COMMENT ON COLUMN cato_compensation_notifications.notification_payload IS 'Full notification payload sent via SNS';
COMMENT ON COLUMN cato_compensation_notifications.acknowledged_by IS 'User who acknowledged the notification (for MANUAL compensations)';
