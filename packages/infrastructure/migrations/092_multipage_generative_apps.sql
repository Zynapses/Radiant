-- RADIANT v4.18.0 - Multi-Page Generative UI ("Web App Generator")
-- Transforms Think Tank into a full web application generator
-- "Claude can describe a todo app, but now it can BUILD the todo app"

-- ============================================================================
-- MULTI-PAGE APPS TABLE
-- Stores complete multi-page generated applications
-- ============================================================================

CREATE TABLE IF NOT EXISTS generated_multipage_apps (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    conversation_id UUID,
    message_id UUID,
    
    -- App metadata
    name VARCHAR(200) NOT NULL,
    description TEXT,
    app_type VARCHAR(30) NOT NULL CHECK (app_type IN (
        'web_app', 'dashboard', 'wizard', 'documentation', 'portfolio',
        'landing_page', 'tutorial', 'report', 'admin_panel', 'e_commerce', 'blog'
    )),
    icon VARCHAR(100),
    
    -- Home page reference
    home_page_id UUID, -- Will be updated after pages are created
    
    -- Navigation configuration
    navigation JSONB NOT NULL DEFAULT '{"type": "top_bar", "items": []}',
    
    -- Global state shared across pages
    global_state JSONB DEFAULT '{}',
    
    -- Theme and styling
    theme JSONB NOT NULL DEFAULT '{}',
    
    -- Data sources
    data_sources JSONB DEFAULT '[]',
    
    -- Actions/endpoints
    actions JSONB DEFAULT '[]',
    
    -- Generated assets
    assets JSONB DEFAULT '[]',
    
    -- Build status
    build_status VARCHAR(20) DEFAULT 'draft' CHECK (build_status IN (
        'draft', 'building', 'ready', 'deployed', 'error'
    )),
    preview_url TEXT,
    deploy_url TEXT,
    
    -- Version control
    version INTEGER DEFAULT 1,
    
    -- Metadata
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_multipage_apps_tenant ON generated_multipage_apps(tenant_id);
CREATE INDEX idx_multipage_apps_user ON generated_multipage_apps(user_id);
CREATE INDEX idx_multipage_apps_type ON generated_multipage_apps(app_type);
CREATE INDEX idx_multipage_apps_status ON generated_multipage_apps(build_status);

-- ============================================================================
-- APP PAGES TABLE
-- Individual pages within a multi-page app
-- ============================================================================

CREATE TABLE IF NOT EXISTS app_pages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    app_id UUID NOT NULL REFERENCES generated_multipage_apps(id) ON DELETE CASCADE,
    
    -- Page identity
    slug VARCHAR(200) NOT NULL, -- URL path
    title VARCHAR(200) NOT NULL,
    description TEXT,
    
    -- Page type
    page_type VARCHAR(30) NOT NULL CHECK (page_type IN (
        'home', 'list', 'detail', 'form', 'dashboard', 'settings',
        'profile', 'about', 'contact', 'search', 'error', 'auth', 'custom'
    )),
    
    -- Layout configuration
    layout JSONB NOT NULL DEFAULT '{}',
    
    -- Sections with components
    sections JSONB NOT NULL DEFAULT '[]',
    
    -- Page-specific state
    local_state JSONB DEFAULT '{}',
    
    -- SEO metadata
    meta JSONB DEFAULT '{}',
    
    -- Access control
    requires_auth BOOLEAN DEFAULT FALSE,
    allowed_roles TEXT[] DEFAULT '{}',
    
    -- Navigation
    show_in_nav BOOLEAN DEFAULT TRUE,
    nav_order INTEGER DEFAULT 0,
    nav_icon VARCHAR(100),
    parent_page_id UUID REFERENCES app_pages(id),
    
    -- Metadata
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    UNIQUE(app_id, slug)
);

CREATE INDEX idx_app_pages_app ON app_pages(app_id);
CREATE INDEX idx_app_pages_type ON app_pages(page_type);
CREATE INDEX idx_app_pages_slug ON app_pages(slug);

-- Add foreign key for home_page_id after app_pages table exists
ALTER TABLE generated_multipage_apps 
    ADD CONSTRAINT fk_home_page 
    FOREIGN KEY (home_page_id) REFERENCES app_pages(id) ON DELETE SET NULL;

-- ============================================================================
-- APP VERSIONS TABLE
-- Version history for multi-page apps
-- ============================================================================

CREATE TABLE IF NOT EXISTS app_versions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    app_id UUID NOT NULL REFERENCES generated_multipage_apps(id) ON DELETE CASCADE,
    version INTEGER NOT NULL,
    
    -- Snapshot of the app at this version
    snapshot JSONB NOT NULL,
    
    -- Change summary
    change_summary TEXT,
    
    -- Who made the change
    changed_by UUID REFERENCES users(id),
    
    -- Metadata
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    UNIQUE(app_id, version)
);

CREATE INDEX idx_app_versions_app ON app_versions(app_id);

-- ============================================================================
-- APP DEPLOYMENTS TABLE
-- Track deployments of multi-page apps
-- ============================================================================

CREATE TABLE IF NOT EXISTS app_deployments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    app_id UUID NOT NULL REFERENCES generated_multipage_apps(id) ON DELETE CASCADE,
    version INTEGER NOT NULL,
    
    -- Deployment target
    target VARCHAR(30) NOT NULL CHECK (target IN (
        'preview', 'staging', 'production', 'custom'
    )),
    
    -- URLs
    url TEXT NOT NULL,
    custom_domain TEXT,
    
    -- Status
    status VARCHAR(20) NOT NULL DEFAULT 'deploying' CHECK (status IN (
        'deploying', 'deployed', 'failed', 'retired'
    )),
    
    -- Build info
    build_log TEXT,
    build_duration_ms INTEGER,
    
    -- Metadata
    deployed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deployed_by UUID REFERENCES users(id),
    retired_at TIMESTAMPTZ
);

CREATE INDEX idx_app_deployments_app ON app_deployments(app_id);
CREATE INDEX idx_app_deployments_status ON app_deployments(status);

-- ============================================================================
-- APP TEMPLATES TABLE
-- Pre-built templates for different app types
-- ============================================================================

CREATE TABLE IF NOT EXISTS multipage_app_templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE, -- NULL = global template
    
    -- Template metadata
    name VARCHAR(200) NOT NULL,
    description TEXT,
    app_type VARCHAR(30) NOT NULL,
    
    -- Template thumbnail
    thumbnail_url TEXT,
    
    -- Template content
    pages JSONB NOT NULL DEFAULT '[]',
    navigation JSONB NOT NULL DEFAULT '{}',
    theme JSONB NOT NULL DEFAULT '{}',
    data_sources JSONB DEFAULT '[]',
    
    -- Usage stats
    usage_count INTEGER DEFAULT 0,
    
    -- Status
    is_active BOOLEAN DEFAULT TRUE,
    is_featured BOOLEAN DEFAULT FALSE,
    
    -- Metadata
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_templates_type ON multipage_app_templates(app_type);
CREATE INDEX idx_templates_active ON multipage_app_templates(is_active) WHERE is_active = TRUE;

-- ============================================================================
-- APP ANALYTICS TABLE
-- Track usage and interactions with generated apps
-- ============================================================================

CREATE TABLE IF NOT EXISTS app_analytics (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    app_id UUID NOT NULL REFERENCES generated_multipage_apps(id) ON DELETE CASCADE,
    
    -- Event info
    event_type VARCHAR(30) NOT NULL CHECK (event_type IN (
        'page_view', 'interaction', 'form_submit', 'action_trigger',
        'error', 'navigation', 'search', 'export'
    )),
    
    -- Page context
    page_id UUID REFERENCES app_pages(id),
    page_slug VARCHAR(200),
    
    -- Event data
    event_data JSONB DEFAULT '{}',
    
    -- User context (can be anonymous)
    user_id UUID REFERENCES users(id),
    session_id VARCHAR(100),
    
    -- Device/browser
    user_agent TEXT,
    viewport JSONB, -- { width, height }
    
    -- Timestamp
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_app_analytics_app ON app_analytics(app_id);
CREATE INDEX idx_app_analytics_page ON app_analytics(page_id);
CREATE INDEX idx_app_analytics_type ON app_analytics(event_type);
CREATE INDEX idx_app_analytics_time ON app_analytics(created_at);

-- Partition by month for efficient querying
-- Note: In production, consider partitioning this table

-- ============================================================================
-- MULTI-PAGE CONFIG TABLE
-- Per-tenant configuration for multi-page app generation
-- ============================================================================

CREATE TABLE IF NOT EXISTS multipage_app_config (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID UNIQUE NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    
    -- Generation settings
    enabled BOOLEAN DEFAULT TRUE,
    max_pages_per_app INTEGER DEFAULT 20,
    max_apps_per_user INTEGER DEFAULT 10,
    
    -- Allowed app types
    allowed_app_types TEXT[] DEFAULT ARRAY[
        'web_app', 'dashboard', 'wizard', 'documentation', 'portfolio',
        'landing_page', 'tutorial', 'report', 'admin_panel', 'e_commerce', 'blog'
    ],
    
    -- Default theme
    default_theme JSONB DEFAULT '{}',
    
    -- Deployment settings
    auto_deploy_preview BOOLEAN DEFAULT TRUE,
    custom_domains_allowed BOOLEAN DEFAULT FALSE,
    
    -- Asset generation
    generate_assets BOOLEAN DEFAULT TRUE,
    asset_generation_model VARCHAR(100) DEFAULT 'dall-e-3',
    
    -- Analytics
    collect_analytics BOOLEAN DEFAULT TRUE,
    analytics_retention_days INTEGER DEFAULT 90,
    
    -- Metadata
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================================
-- ROW LEVEL SECURITY
-- ============================================================================

ALTER TABLE generated_multipage_apps ENABLE ROW LEVEL SECURITY;
ALTER TABLE app_pages ENABLE ROW LEVEL SECURITY;
ALTER TABLE app_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE app_deployments ENABLE ROW LEVEL SECURITY;
ALTER TABLE multipage_app_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE app_analytics ENABLE ROW LEVEL SECURITY;
ALTER TABLE multipage_app_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY multipage_apps_tenant_isolation ON generated_multipage_apps
    FOR ALL USING (tenant_id = current_setting('app.current_tenant_id')::uuid);

CREATE POLICY app_pages_tenant_isolation ON app_pages
    FOR ALL USING (app_id IN (
        SELECT id FROM generated_multipage_apps WHERE tenant_id = current_setting('app.current_tenant_id')::uuid
    ));

CREATE POLICY app_versions_tenant_isolation ON app_versions
    FOR ALL USING (app_id IN (
        SELECT id FROM generated_multipage_apps WHERE tenant_id = current_setting('app.current_tenant_id')::uuid
    ));

CREATE POLICY app_deployments_tenant_isolation ON app_deployments
    FOR ALL USING (app_id IN (
        SELECT id FROM generated_multipage_apps WHERE tenant_id = current_setting('app.current_tenant_id')::uuid
    ));

CREATE POLICY templates_tenant_isolation ON multipage_app_templates
    FOR ALL USING (tenant_id IS NULL OR tenant_id = current_setting('app.current_tenant_id')::uuid);

CREATE POLICY app_analytics_tenant_isolation ON app_analytics
    FOR ALL USING (app_id IN (
        SELECT id FROM generated_multipage_apps WHERE tenant_id = current_setting('app.current_tenant_id')::uuid
    ));

CREATE POLICY config_tenant_isolation ON multipage_app_config
    FOR ALL USING (tenant_id = current_setting('app.current_tenant_id')::uuid);

-- ============================================================================
-- DEFAULT TEMPLATES
-- ============================================================================

INSERT INTO multipage_app_templates (name, description, app_type, pages, navigation, theme, is_featured) VALUES
-- Dashboard Template
('Analytics Dashboard', 'A complete analytics dashboard with overview, charts, and reports', 'dashboard',
 '[
   {"slug": "", "title": "Overview", "pageType": "home", "sections": [{"sectionType": "stats"}, {"sectionType": "chart_grid"}]},
   {"slug": "analytics", "title": "Analytics", "pageType": "dashboard", "sections": [{"sectionType": "chart_grid"}]},
   {"slug": "reports", "title": "Reports", "pageType": "list", "sections": [{"sectionType": "data_table"}]},
   {"slug": "settings", "title": "Settings", "pageType": "settings", "sections": [{"sectionType": "form"}]}
 ]'::jsonb,
 '{"type": "sidebar", "items": [{"label": "Overview", "pageId": "home"}, {"label": "Analytics", "pageId": "analytics"}, {"label": "Reports", "pageId": "reports"}, {"label": "Settings", "pageId": "settings"}]}'::jsonb,
 '{"mode": "light", "colors": {"primary": "#3b82f6"}}'::jsonb,
 true),

-- Portfolio Template
('Professional Portfolio', 'Personal portfolio with about, projects, and contact pages', 'portfolio',
 '[
   {"slug": "", "title": "Home", "pageType": "home", "sections": [{"sectionType": "hero"}, {"sectionType": "features"}]},
   {"slug": "about", "title": "About", "pageType": "about", "sections": [{"sectionType": "content"}]},
   {"slug": "projects", "title": "Projects", "pageType": "list", "sections": [{"sectionType": "gallery"}]},
   {"slug": "contact", "title": "Contact", "pageType": "contact", "sections": [{"sectionType": "contact"}]}
 ]'::jsonb,
 '{"type": "top_bar", "items": [{"label": "Home", "pageId": "home"}, {"label": "About", "pageId": "about"}, {"label": "Projects", "pageId": "projects"}, {"label": "Contact", "pageId": "contact"}]}'::jsonb,
 '{"mode": "dark", "colors": {"primary": "#6366f1"}}'::jsonb,
 true),

-- Documentation Template
('Documentation Site', 'Technical documentation with search, sidebar navigation, and code highlighting', 'documentation',
 '[
   {"slug": "", "title": "Introduction", "pageType": "home", "sections": [{"sectionType": "content"}]},
   {"slug": "getting-started", "title": "Getting Started", "pageType": "custom", "sections": [{"sectionType": "content"}]},
   {"slug": "api-reference", "title": "API Reference", "pageType": "list", "sections": [{"sectionType": "content"}]},
   {"slug": "examples", "title": "Examples", "pageType": "list", "sections": [{"sectionType": "content"}]}
 ]'::jsonb,
 '{"type": "sidebar", "items": [{"label": "Introduction", "pageId": "home"}, {"label": "Getting Started", "pageId": "getting-started"}, {"label": "API Reference", "pageId": "api-reference"}, {"label": "Examples", "pageId": "examples"}]}'::jsonb,
 '{"mode": "light", "colors": {"primary": "#059669"}}'::jsonb,
 true),

-- Landing Page Template
('Product Landing Page', 'Marketing landing page with hero, features, pricing, and CTA', 'landing_page',
 '[
   {"slug": "", "title": "Home", "pageType": "home", "sections": [
     {"sectionType": "hero"},
     {"sectionType": "features"},
     {"sectionType": "testimonials"},
     {"sectionType": "pricing"},
     {"sectionType": "faq"},
     {"sectionType": "cta"}
   ]}
 ]'::jsonb,
 '{"type": "top_bar", "items": [{"label": "Features", "href": "#features"}, {"label": "Pricing", "href": "#pricing"}, {"label": "FAQ", "href": "#faq"}]}'::jsonb,
 '{"mode": "light", "colors": {"primary": "#8b5cf6", "accent": "#f59e0b"}}'::jsonb,
 true),

-- E-commerce Template
('Online Store', 'E-commerce store with product listing, cart, and checkout', 'e_commerce',
 '[
   {"slug": "", "title": "Home", "pageType": "home", "sections": [{"sectionType": "hero"}, {"sectionType": "features"}]},
   {"slug": "products", "title": "Products", "pageType": "list", "sections": [{"sectionType": "gallery"}]},
   {"slug": "cart", "title": "Cart", "pageType": "custom", "sections": [{"sectionType": "data_table"}]},
   {"slug": "checkout", "title": "Checkout", "pageType": "form", "sections": [{"sectionType": "form"}]}
 ]'::jsonb,
 '{"type": "top_bar", "items": [{"label": "Home", "pageId": "home"}, {"label": "Products", "pageId": "products"}, {"label": "Cart", "pageId": "cart", "icon": "shopping-cart"}]}'::jsonb,
 '{"mode": "light", "colors": {"primary": "#ec4899"}}'::jsonb,
 true)
ON CONFLICT DO NOTHING;

-- ============================================================================
-- HELPER FUNCTIONS
-- ============================================================================

-- Function to create a new multi-page app
CREATE OR REPLACE FUNCTION create_multipage_app(
    p_tenant_id UUID,
    p_user_id UUID,
    p_name VARCHAR(200),
    p_app_type VARCHAR(30),
    p_description TEXT DEFAULT NULL,
    p_theme JSONB DEFAULT NULL
) RETURNS UUID AS $$
DECLARE
    v_app_id UUID;
BEGIN
    INSERT INTO generated_multipage_apps (
        tenant_id, user_id, name, app_type, description, theme
    ) VALUES (
        p_tenant_id, p_user_id, p_name, p_app_type, p_description,
        COALESCE(p_theme, '{"mode": "light"}'::jsonb)
    ) RETURNING id INTO v_app_id;
    
    RETURN v_app_id;
END;
$$ LANGUAGE plpgsql;

-- Function to add a page to an app
CREATE OR REPLACE FUNCTION add_app_page(
    p_app_id UUID,
    p_slug VARCHAR(200),
    p_title VARCHAR(200),
    p_page_type VARCHAR(30),
    p_sections JSONB DEFAULT '[]',
    p_layout JSONB DEFAULT NULL,
    p_show_in_nav BOOLEAN DEFAULT TRUE,
    p_nav_order INTEGER DEFAULT NULL
) RETURNS UUID AS $$
DECLARE
    v_page_id UUID;
    v_nav_order INTEGER;
BEGIN
    -- Get next nav order if not specified
    IF p_nav_order IS NULL THEN
        SELECT COALESCE(MAX(nav_order), 0) + 1 INTO v_nav_order
        FROM app_pages WHERE app_id = p_app_id;
    ELSE
        v_nav_order := p_nav_order;
    END IF;
    
    INSERT INTO app_pages (
        app_id, slug, title, page_type, sections, layout, show_in_nav, nav_order
    ) VALUES (
        p_app_id, p_slug, p_title, p_page_type, p_sections,
        COALESCE(p_layout, '{"type": "centered", "showHeader": true, "showFooter": true}'::jsonb),
        p_show_in_nav, v_nav_order
    ) RETURNING id INTO v_page_id;
    
    -- Set as home page if it's the first page or slug is empty
    IF p_slug = '' OR NOT EXISTS (SELECT 1 FROM app_pages WHERE app_id = p_app_id AND id != v_page_id) THEN
        UPDATE generated_multipage_apps SET home_page_id = v_page_id WHERE id = p_app_id;
    END IF;
    
    RETURN v_page_id;
END;
$$ LANGUAGE plpgsql;

-- Function to get app with all pages
CREATE OR REPLACE FUNCTION get_multipage_app(p_app_id UUID)
RETURNS JSONB AS $$
DECLARE
    v_result JSONB;
BEGIN
    SELECT jsonb_build_object(
        'app', row_to_json(a.*),
        'pages', COALESCE((
            SELECT jsonb_agg(row_to_json(p.*) ORDER BY p.nav_order)
            FROM app_pages p WHERE p.app_id = a.id
        ), '[]'::jsonb)
    ) INTO v_result
    FROM generated_multipage_apps a
    WHERE a.id = p_app_id;
    
    RETURN v_result;
END;
$$ LANGUAGE plpgsql;

-- Function to save app version
CREATE OR REPLACE FUNCTION save_app_version(
    p_app_id UUID,
    p_changed_by UUID,
    p_change_summary TEXT DEFAULT NULL
) RETURNS INTEGER AS $$
DECLARE
    v_version INTEGER;
    v_snapshot JSONB;
BEGIN
    -- Get next version number
    SELECT COALESCE(MAX(version), 0) + 1 INTO v_version
    FROM app_versions WHERE app_id = p_app_id;
    
    -- Get current snapshot
    v_snapshot := get_multipage_app(p_app_id);
    
    -- Save version
    INSERT INTO app_versions (app_id, version, snapshot, change_summary, changed_by)
    VALUES (p_app_id, v_version, v_snapshot, p_change_summary, p_changed_by);
    
    -- Update app version number
    UPDATE generated_multipage_apps SET version = v_version, updated_at = NOW()
    WHERE id = p_app_id;
    
    RETURN v_version;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- TRIGGERS
-- ============================================================================

-- Update timestamps on modification
CREATE OR REPLACE FUNCTION update_multipage_app_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_update_multipage_app_timestamp
    BEFORE UPDATE ON generated_multipage_apps
    FOR EACH ROW EXECUTE FUNCTION update_multipage_app_timestamp();

CREATE TRIGGER trg_update_app_page_timestamp
    BEFORE UPDATE ON app_pages
    FOR EACH ROW EXECUTE FUNCTION update_multipage_app_timestamp();

-- Track template usage
CREATE OR REPLACE FUNCTION track_template_usage()
RETURNS TRIGGER AS $$
BEGIN
    -- This would be triggered when an app is created from a template
    -- Implementation depends on how templates are applied
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;
