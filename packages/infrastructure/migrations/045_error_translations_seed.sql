-- Migration: 045_error_translations_seed.sql
-- Description: Seed error message translations for i18n support
-- RADIANT v4.18.0

-- Create localization tables if not exist
CREATE TABLE IF NOT EXISTS localization_registry (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    key VARCHAR(255) UNIQUE NOT NULL,
    default_text TEXT NOT NULL,
    context TEXT,
    category VARCHAR(100) NOT NULL,
    placeholders TEXT[],
    app_id UUID,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS localization_translations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    registry_id UUID NOT NULL REFERENCES localization_registry(id) ON DELETE CASCADE,
    language_code VARCHAR(10) NOT NULL,
    translated_text TEXT NOT NULL,
    status VARCHAR(50) DEFAULT 'pending',
    translator_type VARCHAR(50) DEFAULT 'human',
    reviewed_by UUID,
    reviewed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(registry_id, language_code)
);

CREATE TABLE IF NOT EXISTS localization_languages (
    code VARCHAR(10) PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    native_name VARCHAR(100) NOT NULL,
    direction VARCHAR(3) DEFAULT 'ltr',
    is_active BOOLEAN DEFAULT true,
    is_default BOOLEAN DEFAULT false,
    display_order INTEGER DEFAULT 0
);

-- Insert supported languages
INSERT INTO localization_languages (code, name, native_name, direction, is_active, is_default, display_order) VALUES
('en', 'English', 'English', 'ltr', true, true, 1),
('es', 'Spanish', 'Español', 'ltr', true, false, 2),
('fr', 'French', 'Français', 'ltr', true, false, 3),
('de', 'German', 'Deutsch', 'ltr', true, false, 4),
('it', 'Italian', 'Italiano', 'ltr', true, false, 5),
('pt', 'Portuguese', 'Português', 'ltr', true, false, 6),
('ja', 'Japanese', '日本語', 'ltr', true, false, 7),
('ko', 'Korean', '한국어', 'ltr', true, false, 8),
('zh', 'Chinese (Simplified)', '简体中文', 'ltr', true, false, 9),
('ar', 'Arabic', 'العربية', 'rtl', true, false, 10)
ON CONFLICT (code) DO NOTHING;

-- Insert error message registry entries (English defaults)
INSERT INTO localization_registry (key, default_text, context, category) VALUES
-- Authentication errors
('error.auth.invalid_token', 'Invalid authentication token. Please sign in again.', 'Shown when JWT token is malformed or invalid', 'error'),
('error.auth.token_expired', 'Your session has expired. Please sign in again.', 'Shown when token TTL exceeded', 'error'),
('error.auth.missing_token', 'Authentication required. Please sign in.', 'Shown when no auth header present', 'error'),
('error.auth.invalid_api_key', 'Invalid API key. Please check your credentials.', 'Shown for invalid API key', 'error'),
('error.auth.api_key_expired', 'API key has expired. Please generate a new one.', 'Shown when API key TTL exceeded', 'error'),
('error.auth.api_key_revoked', 'API key has been revoked.', 'Shown when API key manually revoked', 'error'),
('error.auth.insufficient_scope', 'API key does not have required permissions.', 'Shown when scope check fails', 'error'),
('error.auth.mfa_required', 'Multi-factor authentication required.', 'Shown when MFA step needed', 'error'),
('error.auth.session_expired', 'Session expired. Please sign in again.', 'Shown for session timeout', 'error'),

-- Authorization errors
('error.authz.forbidden', 'You do not have permission to perform this action.', 'Generic forbidden response', 'error'),
('error.authz.tenant_mismatch', 'Access denied to this resource.', 'Cross-tenant access attempt', 'error'),
('error.authz.role_required', 'Insufficient role permissions.', 'Role check failed', 'error'),
('error.authz.permission_denied', 'Permission denied.', 'Permission check failed', 'error'),
('error.authz.resource_access_denied', 'You cannot access this resource.', 'Resource-level access denied', 'error'),
('error.authz.tier_insufficient', 'This feature requires a higher subscription tier.', 'Tier restriction', 'error'),

-- Validation errors
('error.validation.required_field', 'Required field is missing: {field}', 'Missing required field', 'error'),
('error.validation.invalid_format', 'Invalid format for field: {field}', 'Field format validation', 'error'),
('error.validation.out_of_range', 'Value is out of allowed range.', 'Range validation', 'error'),
('error.validation.invalid_type', 'Invalid data type for field: {field}', 'Type validation', 'error'),
('error.validation.constraint_violation', 'Data constraint violation.', 'Database constraint', 'error'),
('error.validation.schema_mismatch', 'Request does not match expected format.', 'Schema validation', 'error'),
('error.validation.invalid_json', 'Invalid JSON in request body.', 'JSON parse error', 'error'),
('error.validation.max_length_exceeded', 'Field exceeds maximum length of {max} characters.', 'Length validation', 'error'),
('error.validation.min_length_required', 'Field requires at least {min} characters.', 'Length validation', 'error'),

-- Resource errors
('error.resource.not_found', '{resourceType} not found: {resourceId}', 'Resource not found', 'error'),
('error.resource.already_exists', 'Resource already exists.', 'Duplicate resource', 'error'),
('error.resource.deleted', 'Resource has been deleted.', 'Deleted resource access', 'error'),
('error.resource.locked', 'Resource is temporarily locked. Please try again.', 'Resource lock', 'error'),
('error.resource.conflict', 'Conflict with current resource state.', 'Optimistic lock conflict', 'error'),
('error.resource.quota_exceeded', 'Resource quota exceeded.', 'Quota limit', 'error'),

-- Rate limiting errors
('error.rate_limit.exceeded', 'Too many requests. Please slow down.', 'General rate limit', 'error'),
('error.rate_limit.tenant', 'Organization rate limit exceeded. Please wait {retryAfter} seconds.', 'Tenant rate limit', 'error'),
('error.rate_limit.user', 'User rate limit exceeded. Please wait {retryAfter} seconds.', 'User rate limit', 'error'),
('error.rate_limit.api_key', 'API key rate limit exceeded.', 'API key rate limit', 'error'),
('error.rate_limit.model', 'Model rate limit exceeded. Try a different model.', 'Model-specific limit', 'error'),
('error.rate_limit.burst', 'Burst limit exceeded. Please wait a moment.', 'Burst protection', 'error'),

-- AI/Model errors
('error.ai.model_not_found', 'Model not found or not available: {model}', 'Unknown model', 'error'),
('error.ai.model_unavailable', 'Model is temporarily unavailable. Please try again later.', 'Model down', 'error'),
('error.ai.model_overloaded', 'Model is overloaded. Please try again.', 'Model capacity', 'error'),
('error.ai.provider_error', 'AI provider error. Retrying may help.', 'Provider failure', 'error'),
('error.ai.context_too_long', 'Input exceeds model context limit of {limit} tokens.', 'Context overflow', 'error'),
('error.ai.content_filtered', 'Content was filtered by safety systems.', 'Content moderation', 'error'),
('error.ai.invalid_request', 'Invalid AI request parameters.', 'Request validation', 'error'),
('error.ai.streaming_error', 'Streaming error occurred.', 'SSE failure', 'error'),
('error.ai.timeout', 'Request timed out. Please try again.', 'Timeout', 'error'),
('error.ai.thermal_cold', 'Model is warming up. Please wait a moment.', 'Cold start', 'error'),

-- Billing errors
('error.billing.insufficient_credits', 'Insufficient credits. Please add more credits to continue.', 'No credits', 'error'),
('error.billing.payment_required', 'Payment required to continue.', 'Payment needed', 'error'),
('error.billing.payment_failed', 'Payment failed. Please update your payment method.', 'Payment failure', 'error'),
('error.billing.subscription_expired', 'Subscription has expired. Please renew to continue.', 'Expired sub', 'error'),
('error.billing.subscription_cancelled', 'Subscription has been cancelled.', 'Cancelled sub', 'error'),
('error.billing.invalid_coupon', 'Invalid or expired coupon code.', 'Coupon validation', 'error'),
('error.billing.quota_exceeded', 'Usage quota exceeded for billing period.', 'Usage quota', 'error'),

-- Storage errors
('error.storage.quota_exceeded', 'Storage quota exceeded. Please delete files or upgrade.', 'Storage full', 'error'),
('error.storage.file_too_large', 'File exceeds maximum size limit of {maxSize}.', 'File size', 'error'),
('error.storage.invalid_file_type', 'File type not supported. Allowed: {allowedTypes}', 'File type', 'error'),
('error.storage.upload_failed', 'Upload failed. Please try again.', 'Upload error', 'error'),
('error.storage.file_not_found', 'File not found.', 'Missing file', 'error'),

-- Internal errors
('error.internal.error', 'An unexpected error occurred. Please try again.', 'Generic internal error', 'error'),
('error.internal.database_error', 'Database error. Please try again.', 'DB failure', 'error'),
('error.internal.cache_error', 'Cache error. Please try again.', 'Cache failure', 'error'),
('error.internal.queue_error', 'Processing error. Please try again.', 'Queue failure', 'error'),
('error.internal.service_unavailable', 'Service temporarily unavailable.', 'Service down', 'error'),
('error.internal.dependency_failure', 'External service error.', 'Dependency failure', 'error'),
('error.internal.configuration_error', 'Configuration error. Please contact support.', 'Config error', 'error'),
('error.internal.timeout', 'Request timed out. Please try again.', 'Timeout', 'error')
ON CONFLICT (key) DO UPDATE SET
    default_text = EXCLUDED.default_text,
    context = EXCLUDED.context,
    updated_at = NOW();

-- Insert Spanish translations
INSERT INTO localization_translations (registry_id, language_code, translated_text, status, translator_type)
SELECT r.id, 'es', 
    CASE r.key
        WHEN 'error.auth.invalid_token' THEN 'Token de autenticación inválido. Por favor, inicie sesión nuevamente.'
        WHEN 'error.auth.token_expired' THEN 'Su sesión ha expirado. Por favor, inicie sesión nuevamente.'
        WHEN 'error.auth.missing_token' THEN 'Se requiere autenticación. Por favor, inicie sesión.'
        WHEN 'error.authz.forbidden' THEN 'No tiene permiso para realizar esta acción.'
        WHEN 'error.validation.required_field' THEN 'Campo requerido faltante: {field}'
        WHEN 'error.resource.not_found' THEN '{resourceType} no encontrado: {resourceId}'
        WHEN 'error.rate_limit.exceeded' THEN 'Demasiadas solicitudes. Por favor, reduzca la velocidad.'
        WHEN 'error.ai.model_unavailable' THEN 'El modelo no está disponible temporalmente. Intente más tarde.'
        WHEN 'error.billing.insufficient_credits' THEN 'Créditos insuficientes. Por favor, agregue más créditos.'
        WHEN 'error.internal.error' THEN 'Ocurrió un error inesperado. Por favor, intente nuevamente.'
        ELSE r.default_text
    END,
    'ai_translated', 'ai'
FROM localization_registry r
WHERE r.category = 'error'
ON CONFLICT (registry_id, language_code) DO NOTHING;

-- Insert French translations
INSERT INTO localization_translations (registry_id, language_code, translated_text, status, translator_type)
SELECT r.id, 'fr',
    CASE r.key
        WHEN 'error.auth.invalid_token' THEN 'Jeton d''authentification invalide. Veuillez vous reconnecter.'
        WHEN 'error.auth.token_expired' THEN 'Votre session a expiré. Veuillez vous reconnecter.'
        WHEN 'error.auth.missing_token' THEN 'Authentification requise. Veuillez vous connecter.'
        WHEN 'error.authz.forbidden' THEN 'Vous n''avez pas la permission d''effectuer cette action.'
        WHEN 'error.validation.required_field' THEN 'Champ requis manquant : {field}'
        WHEN 'error.resource.not_found' THEN '{resourceType} introuvable : {resourceId}'
        WHEN 'error.rate_limit.exceeded' THEN 'Trop de requêtes. Veuillez ralentir.'
        WHEN 'error.ai.model_unavailable' THEN 'Le modèle est temporairement indisponible. Réessayez plus tard.'
        WHEN 'error.billing.insufficient_credits' THEN 'Crédits insuffisants. Veuillez ajouter des crédits.'
        WHEN 'error.internal.error' THEN 'Une erreur inattendue s''est produite. Veuillez réessayer.'
        ELSE r.default_text
    END,
    'ai_translated', 'ai'
FROM localization_registry r
WHERE r.category = 'error'
ON CONFLICT (registry_id, language_code) DO NOTHING;

-- Insert German translations
INSERT INTO localization_translations (registry_id, language_code, translated_text, status, translator_type)
SELECT r.id, 'de',
    CASE r.key
        WHEN 'error.auth.invalid_token' THEN 'Ungültiges Authentifizierungstoken. Bitte melden Sie sich erneut an.'
        WHEN 'error.auth.token_expired' THEN 'Ihre Sitzung ist abgelaufen. Bitte melden Sie sich erneut an.'
        WHEN 'error.auth.missing_token' THEN 'Authentifizierung erforderlich. Bitte melden Sie sich an.'
        WHEN 'error.authz.forbidden' THEN 'Sie haben keine Berechtigung für diese Aktion.'
        WHEN 'error.validation.required_field' THEN 'Pflichtfeld fehlt: {field}'
        WHEN 'error.resource.not_found' THEN '{resourceType} nicht gefunden: {resourceId}'
        WHEN 'error.rate_limit.exceeded' THEN 'Zu viele Anfragen. Bitte verlangsamen Sie.'
        WHEN 'error.ai.model_unavailable' THEN 'Das Modell ist vorübergehend nicht verfügbar. Versuchen Sie es später.'
        WHEN 'error.billing.insufficient_credits' THEN 'Unzureichendes Guthaben. Bitte laden Sie Guthaben auf.'
        WHEN 'error.internal.error' THEN 'Ein unerwarteter Fehler ist aufgetreten. Bitte versuchen Sie es erneut.'
        ELSE r.default_text
    END,
    'ai_translated', 'ai'
FROM localization_registry r
WHERE r.category = 'error'
ON CONFLICT (registry_id, language_code) DO NOTHING;

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_localization_registry_key ON localization_registry(key);
CREATE INDEX IF NOT EXISTS idx_localization_registry_category ON localization_registry(category);
CREATE INDEX IF NOT EXISTS idx_localization_translations_language ON localization_translations(language_code);
CREATE INDEX IF NOT EXISTS idx_localization_translations_status ON localization_translations(status);
