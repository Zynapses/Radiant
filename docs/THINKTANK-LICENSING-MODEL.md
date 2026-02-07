# Think Tank Licensing Model

> **Version**: 1.0.0
> **Platform**: RADIANT v4.18.0 / v7.23.0+
> **Last Updated**: February 6, 2026
> **Companion**: [ADR: User Provisioning & Licensing](./architecture/ADR-USER-PROVISIONING-SEAT-LICENSING-AUTH.md)
> **Support Contact**: support@thinktank.app

---

## 1. Overview

The Think Tank Licensing Model governs what features, capacity, and regulatory capabilities each tenant has access to. Licensing is **flexible and multi-dimensional** — it covers seats, storage, retention, compliance, and any future dimension without requiring code changes.

### Core Principle

```
Every feature that costs us money to operate is a licensable dimension.
If a tenant doesn't have the license, the feature is disabled.
If they want it, they contact support@thinktank.app.
```

### Who This Document Is For

| Audience | What To Read |
|----------|-------------|
| **Engineers** | Sections 2-6 (schema, middleware, API enforcement) |
| **Administrators** | Sections 7-9 (tenant admin UI, managing licenses) |
| **Product/Sales** | Sections 10-11 (pricing tiers, regulatory licenses) |

---

## 2. License Architecture

### 2.1 The `tenant_licenses` Table

A single flexible table handles ALL license types. No code changes needed to add new license dimensions.

```sql
CREATE TABLE IF NOT EXISTS tenant_licenses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    
    -- What type of license
    license_type VARCHAR(50) NOT NULL,
    -- CHECK: 'seat', 'storage', 'retention', 'compliance', 'feature', 'api_rate', 'addon'
    
    -- Which app (or 'platform' for cross-app)
    app_id VARCHAR(50) NOT NULL DEFAULT 'platform',
    -- Values: 'think_tank', 'curator', 'dojo', 'cato_trainer', 'genesis', 'platform'
    
    -- For compliance/feature licenses: specific feature code
    feature_code VARCHAR(100),
    -- Examples: 'hipaa', 'gdpr', 'soc2', 'ccpa', 'iso27001', 'data_residency',
    --           'enhanced_audit', 'extended_retention', 'hipaa_retention'
    
    -- Capacity
    quantity INTEGER NOT NULL DEFAULT 0,      -- Total licensed amount
    used INTEGER NOT NULL DEFAULT 0,          -- Currently consumed
    reserved INTEGER NOT NULL DEFAULT 0,      -- Reserved (e.g., pending invitations)
    unit VARCHAR(20) NOT NULL DEFAULT 'unit', -- 'user', 'gb', 'days', 'requests', 'boolean'
    
    -- Billing
    included_in_tier INTEGER NOT NULL DEFAULT 0,   -- Included with subscription tier
    additional_purchased INTEGER NOT NULL DEFAULT 0, -- Purchased beyond tier
    price_per_unit_cents INTEGER,                    -- Price for additional units
    overage_allowed BOOLEAN NOT NULL DEFAULT false,  -- Can exceed quantity?
    overage_price_per_unit_cents INTEGER,             -- Price for overage units
    
    -- Status
    is_active BOOLEAN NOT NULL DEFAULT true,
    expires_at TIMESTAMPTZ,                   -- NULL = no expiry
    
    -- Metadata
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    -- One license record per type+app+feature per tenant
    UNIQUE(tenant_id, license_type, app_id, COALESCE(feature_code, ''))
);

CREATE INDEX idx_tenant_licenses_tenant ON tenant_licenses(tenant_id);
CREATE INDEX idx_tenant_licenses_type ON tenant_licenses(license_type, app_id);
CREATE INDEX idx_tenant_licenses_feature ON tenant_licenses(feature_code) WHERE feature_code IS NOT NULL;

ALTER TABLE tenant_licenses ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_licenses_isolation ON tenant_licenses
    USING (tenant_id = current_setting('app.current_tenant_id')::uuid);
```

### 2.2 The `license_catalog` Table

Defines all available license types and their default pricing. Used by the platform admin and billing system.

```sql
CREATE TABLE IF NOT EXISTS license_catalog (
    id VARCHAR(100) PRIMARY KEY,  -- e.g., 'seat:think_tank', 'compliance:hipaa'
    
    license_type VARCHAR(50) NOT NULL,
    app_id VARCHAR(50) NOT NULL DEFAULT 'platform',
    feature_code VARCHAR(100),
    
    display_name VARCHAR(200) NOT NULL,
    description TEXT,
    category VARCHAR(50) NOT NULL,
    -- CHECK: 'app_access', 'capacity', 'compliance', 'addon'
    
    unit VARCHAR(20) NOT NULL,
    default_price_per_unit_cents INTEGER,
    
    -- Tier inclusion (how many units included per tier)
    included_tier_1 INTEGER NOT NULL DEFAULT 0,  -- SEED
    included_tier_2 INTEGER NOT NULL DEFAULT 0,  -- SPROUT
    included_tier_3 INTEGER NOT NULL DEFAULT 0,  -- GROWTH
    included_tier_4 INTEGER NOT NULL DEFAULT 0,  -- SCALE
    included_tier_5 INTEGER NOT NULL DEFAULT 0,  -- ENTERPRISE
    
    -- Constraints
    min_quantity INTEGER DEFAULT 0,
    max_quantity INTEGER,  -- NULL = unlimited
    requires_license_ids TEXT[],  -- Other licenses required first
    
    is_public BOOLEAN NOT NULL DEFAULT true,
    sort_order INTEGER NOT NULL DEFAULT 0,
    
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

### 2.3 The `license_audit` Table

All license changes are logged for compliance and billing reconciliation.

```sql
CREATE TABLE IF NOT EXISTS license_audit (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    license_id UUID REFERENCES tenant_licenses(id) ON DELETE SET NULL,
    
    action VARCHAR(50) NOT NULL,
    -- CHECK: 'created', 'activated', 'deactivated', 'quantity_changed',
    --        'used_changed', 'expired', 'renewed', 'overage_triggered'
    
    old_value JSONB,
    new_value JSONB,
    
    performed_by UUID,           -- User who made the change
    performed_by_app VARCHAR(50), -- 'radiant_admin', 'thinktank_tenant_admin', 'system', 'billing'
    reason TEXT,
    
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_license_audit_tenant ON license_audit(tenant_id, created_at DESC);
```

---

## 3. License Types

### 3.1 Seat Licenses (Per-App User Access)

| License ID | App | Unit | Description |
|-----------|-----|------|-------------|
| `seat:think_tank` | think_tank | user | Think Tank access (Web + Mac = 1 seat) |
| `seat:curator` | curator | user | Curator access |
| `seat:dojo` | dojo | user | Aurelius Dojo access |
| `seat:cato_trainer` | cato_trainer | user | Cato Trainer access |
| `seat:genesis` | genesis | user | Genesis access |

**Rules**:
- Active users consume seats
- **Deactivated users FREE seats** (seat returned to pool)
- Invited users RESERVE seats (to prevent over-invitation)
- Think Tank seat granted by default on invite; other apps require explicit activation
- Overage: configurable per tenant (hard-block or auto-charge)

### 3.2 Capacity Licenses

| License ID | App | Unit | Description |
|-----------|-----|------|-------------|
| `storage:think_tank` | think_tank | gb | File storage quota for Think Tank |
| `storage:curator` | curator | gb | Document storage for Curator |
| `storage:cato_trainer` | cato_trainer | gb | Knowledge base storage |
| `storage:platform` | platform | gb | Platform-wide storage quota |
| `api_rate:platform` | platform | requests | API rate limit (requests/minute) |
| `tokens:platform` | platform | token | Monthly token allocation |

### 3.3 Retention Licenses

| License ID | App | Unit | Description | Cost Driver |
|-----------|-----|------|-------------|-------------|
| `retention:default` | platform | days | Default data retention | Included (30 days) |
| `retention:extended` | platform | days | Extended retention (90-365 days) | Warm storage |
| `retention:hipaa` | platform | days | HIPAA 7-year retention (2,555 days) | Glacier storage |
| `retention:sox` | platform | days | SOX record retention | Glacier storage |

### 3.4 Compliance/Regulatory Licenses

**These are the critical licensable regulatory features.** If a tenant does NOT have the license, the feature is DISABLED.

| License ID | Feature Code | Unit | Description | Internal Cost Driver |
|-----------|-------------|------|-------------|---------------------|
| `compliance:hipaa` | `hipaa` | boolean | HIPAA compliance features | Enhanced audit, PHI encryption keys, BAA |
| `compliance:hipaa_retention` | `hipaa_retention` | boolean | HIPAA 7-year retention | S3 Glacier for 7 years |
| `compliance:gdpr` | `gdpr` | boolean | GDPR compliance features | Erasure processing, consent mgmt, DSAR |
| `compliance:soc2` | `soc2` | boolean | SOC 2 Type II features | Comprehensive audit logging, evidence |
| `compliance:ccpa` | `ccpa` | boolean | CCPA compliance | Consumer privacy processing, opt-out |
| `compliance:iso27001` | `iso27001` | boolean | ISO 27001 features | Security management controls |
| `compliance:data_residency` | `data_residency` | boolean | Data residency controls | Multi-region storage infrastructure |
| `compliance:enhanced_audit` | `enhanced_audit` | boolean | Enhanced audit logging | High-volume audit storage |
| `compliance:pci_dss` | `pci_dss` | boolean | PCI-DSS features | Cardholder data controls |
| `compliance:fedramp` | `fedramp` | boolean | FedRAMP compliance | Gov cloud, additional controls |
| `compliance:hitrust` | `hitrust` | boolean | HITRUST CSF | Healthcare security framework |
| `compliance:eu_ai_act` | `eu_ai_act` | boolean | EU AI Act compliance | AI governance, risk assessment |

### 3.5 Add-On Licenses

| License ID | App | Unit | Description |
|-----------|-----|------|-------------|
| `addon:custom_models` | platform | boolean | Self-hosted custom model support |
| `addon:dedicated_support` | platform | boolean | Dedicated support channel |
| `addon:white_label` | platform | boolean | White-label/custom branding |
| `addon:sso_enterprise` | platform | boolean | Enterprise SSO (SAML/OIDC) |
| `addon:advanced_analytics` | platform | boolean | Advanced analytics dashboard |

---

## 4. Tier Defaults

When a tenant is created or upgrades their subscription, licenses are automatically provisioned based on their tier.

| License | SEED (T1) | SPROUT (T2) | GROWTH (T3) | SCALE (T4) | ENTERPRISE (T5) |
|---------|-----------|-------------|-------------|------------|-----------------|
| **Think Tank seats** | 1 | 10 | 50 | 200 | Unlimited |
| **Curator seats** | 0 | 5 | 25 | 100 | Unlimited |
| **Dojo seats** | 0 | 5 | 25 | 100 | Unlimited |
| **Cato seats** | 0 | 0 | 10 | 50 | Unlimited |
| **Genesis seats** | 0 | 0 | 10 | 50 | Unlimited |
| **Storage (platform)** | 1 GB | 10 GB | 100 GB | 1 TB | 10 TB |
| **Retention** | 30 days | 90 days | 365 days | 365 days | Custom |
| **API rate** | 100/min | 500/min | 2000/min | 10000/min | Custom |
| **HIPAA** | No | No | Add-on | Add-on | Included |
| **GDPR** | No | Add-on | Add-on | Included | Included |
| **SOC 2** | No | No | Add-on | Add-on | Included |
| **Enterprise SSO** | No | No | Add-on | Included | Included |

**"Add-on"** = Available for purchase. **"Included"** = Comes with the tier. **"No"** = Not available at this tier.

---

## 5. API Licensing Enforcement (For Engineers)

### 5.1 Middleware Pattern

Every API handler MUST check licensing before processing. This is implemented as middleware that runs before the handler logic.

```typescript
// packages/infrastructure/lambda/shared/middleware/license-check.ts

interface LicenseRequirement {
  app_id: string;           // Which app this endpoint belongs to
  license_type?: string;    // 'seat', 'compliance', etc.
  feature_code?: string;    // 'hipaa', 'gdpr', etc. (for compliance checks)
  check_seat?: boolean;     // Should we verify the user has a seat for this app?
  check_feature?: boolean;  // Should we verify a specific feature license?
}

async function checkLicense(
  tenantId: string,
  userId: string,
  requirement: LicenseRequirement
): Promise<LicenseCheckResult> {
  // 1. Check app seat license (if check_seat)
  if (requirement.check_seat) {
    const seatLicense = await getLicense(tenantId, 'seat', requirement.app_id);
    if (!seatLicense || !seatLicense.is_active) {
      return {
        allowed: false,
        error: 'LICENSE_REQUIRED',
        license_type: 'seat',
        app_id: requirement.app_id,
        message: `Your organization does not have ${requirement.app_id} licenses. Contact Think Tank support at support@thinktank.app to add this to your plan.`
      };
    }
    // Check if user has a seat allocated
    const userHasSeat = await userHasAppAccess(userId, requirement.app_id);
    if (!userHasSeat) {
      return {
        allowed: false,
        error: 'SEAT_NOT_ASSIGNED',
        message: `You do not have access to ${requirement.app_id}. Contact your tenant administrator.`
      };
    }
  }

  // 2. Check feature license (if check_feature)
  if (requirement.check_feature && requirement.feature_code) {
    const featureLicense = await getLicense(
      tenantId, 'compliance', 'platform', requirement.feature_code
    );
    if (!featureLicense || !featureLicense.is_active) {
      return {
        allowed: false,
        error: 'LICENSE_REQUIRED',
        license_type: 'compliance',
        feature_code: requirement.feature_code,
        message: `This feature requires a ${requirement.feature_code.toUpperCase()} compliance license. Contact Think Tank support at support@thinktank.app to add this to your plan.`,
        contact: 'support@thinktank.app'
      };
    }
  }

  return { allowed: true };
}
```

### 5.2 How To Apply Licensing To An Endpoint

```typescript
// Example: Think Tank chat endpoint — requires Think Tank seat
export async function handler(event: APIGatewayProxyEvent) {
  const user = extractAuthContext(event);
  
  // Check seat license
  const license = await checkLicense(user.tenantId, user.userId, {
    app_id: 'think_tank',
    check_seat: true,
  });
  if (!license.allowed) {
    return forbidden(license);
  }
  
  // ... handle request
}

// Example: HIPAA audit endpoint — requires HIPAA license
export async function hipaaAuditHandler(event: APIGatewayProxyEvent) {
  const user = extractAuthContext(event);
  
  // Check both seat AND compliance license
  const license = await checkLicense(user.tenantId, user.userId, {
    app_id: 'think_tank',
    check_seat: true,
    check_feature: true,
    feature_code: 'hipaa',
  });
  if (!license.allowed) {
    return forbidden(license);
  }
  
  // ... handle request
}

// Example: GDPR erasure endpoint — requires GDPR license
export async function gdprErasureHandler(event: APIGatewayProxyEvent) {
  const user = extractAuthContext(event);
  
  const license = await checkLicense(user.tenantId, user.userId, {
    app_id: 'platform',
    check_feature: true,
    feature_code: 'gdpr',
  });
  if (!license.allowed) {
    return forbidden(license);
  }
  
  // ... handle erasure request
}
```

### 5.3 Response Format When Unlicensed

All endpoints return a consistent error format:

```json
{
  "error": "LICENSE_REQUIRED",
  "license_type": "compliance",
  "feature_code": "hipaa",
  "message": "This feature requires a HIPAA compliance license. Contact Think Tank support at support@thinktank.app to add this to your plan.",
  "contact": "support@thinktank.app",
  "upgrade_url": "https://thinktank.app/pricing"
}
```

HTTP status: **403 Forbidden** (authenticated but not authorized by license).

### 5.4 License Cache

To avoid querying the database on every request, licenses are cached:

```typescript
// Cache tenant licenses for 5 minutes
// Invalidated on license change events
const LICENSE_CACHE_TTL_MS = 5 * 60 * 1000;

// Key: `license:${tenantId}` → Map of all active licenses
// Populated on first request, refreshed on TTL expiry or license change SNS event
```

### 5.5 Endpoint-to-License Mapping

Every Lambda handler file MUST declare its license requirements at the top:

```typescript
// At top of every handler file:
const LICENSE_REQUIREMENTS: Record<string, LicenseRequirement> = {
  'GET /chat': { app_id: 'think_tank', check_seat: true },
  'POST /chat': { app_id: 'think_tank', check_seat: true },
  'GET /hipaa/audit': { app_id: 'platform', check_seat: true, check_feature: true, feature_code: 'hipaa' },
  'POST /gdpr/erasure': { app_id: 'platform', check_feature: true, feature_code: 'gdpr' },
};
```

---

## 6. License Enforcement Summary By Regulatory Standard

### 6.1 What Each Standard Enables/Disables

| Standard | License Code | What Gets ENABLED | What Gets DISABLED Without It |
|----------|-------------|-------------------|-------------------------------|
| **HIPAA** | `hipaa` | PHI field management, enhanced audit trail, BAA documentation, access controls for ePHI, workforce training tracking | All PHI-related fields hidden, HIPAA audit tab disabled, HIPAA compliance reports unavailable |
| **HIPAA Retention** | `hipaa_retention` | 7-year record retention, Glacier archival, legal hold support | Records only retained for default period (30 days), no Glacier archival |
| **GDPR** | `gdpr` | Right to erasure (Art. 17), data portability (Art. 20), consent management (Art. 7), DSAR handling, DPA support | Erasure requests rejected, data export unavailable, consent UI hidden |
| **SOC 2** | `soc2` | Self-audit runner, evidence collection, compliance reports, change management tracking, penetration test tracking | Self-audit tab disabled, compliance report generation unavailable |
| **CCPA** | `ccpa` | Consumer privacy rights, opt-out tracking, data sale disclosure, privacy policy management | CCPA-specific opt-out unavailable, privacy rights tab hidden |
| **ISO 27001** | `iso27001` | 93 Annex A control tracking, risk assessment, security policy management, ISMS dashboard | ISO compliance dashboard disabled, control tracking unavailable |
| **Data Residency** | `data_residency` | Region selection for data storage, EU-only mode, cross-border transfer controls | Data stored in default region only, no region selection |
| **Enhanced Audit** | `enhanced_audit` | Per-request audit logging, IP tracking, device fingerprinting, session replay | Basic audit only (admin actions + auth events) |
| **PCI-DSS** | `pci_dss` | Cardholder data environment controls, network segmentation, vulnerability management | PCI controls tab disabled |
| **FedRAMP** | `fedramp` | Gov cloud compliance, FIPS 140-2 encryption, agency authorization tracking | FedRAMP compliance tab disabled |
| **HITRUST** | `hitrust` | CSF control tracking, readiness assessment, certification management | HITRUST tab disabled |
| **EU AI Act** | `eu_ai_act` | AI risk classification, transparency requirements, human oversight documentation | AI governance tab disabled |

### 6.2 Default Behavior (No Compliance Licenses)

Every tenant starts with these defaults (no license required):

| Capability | Default |
|-----------|---------|
| **Encryption at rest** | AES-256 (always on, all tiers) |
| **Encryption in transit** | TLS 1.3 (always on, all tiers) |
| **Tenant isolation** | RLS (always on, all tiers) |
| **Basic audit** | Admin actions + auth events logged, 30-day retention |
| **Data retention** | 30 days |
| **MFA** | Available but not required (tenant can require) |

---

## 7. Think Tank Tenant Admin — License Management UI

### 7.1 License Dashboard

**Location**: Think Tank Tenant Admin → Licenses

```
┌─────────────────────────────────────────────────────────────────┐
│  Licenses & Usage                              Tier: GROWTH (3)  │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  APP SEATS                                                       │
│  ┌──────────────────┐  ┌──────────────────┐  ┌────────────────┐│
│  │ Think Tank       │  │ Curator          │  │ Dojo           ││
│  │ ████████░░ 42/50 │  │ ██████░░░░ 15/25 │  │ ██░░░░░░ 5/25  ││
│  │ [+ Buy Seats]    │  │ [+ Buy Seats]    │  │ [+ Buy Seats]  ││
│  └──────────────────┘  └──────────────────┘  └────────────────┘│
│                                                                  │
│  CAPACITY                                                        │
│  ┌──────────────────┐  ┌──────────────────┐                    │
│  │ Storage          │  │ API Rate         │                    │
│  │ ██████████░ 67/100 GB │ 1,200/2,000 req/min │              │
│  │ [+ Buy Storage]  │  │ [+ Upgrade]      │                    │
│  └──────────────────┘  └──────────────────┘                    │
│                                                                  │
│  COMPLIANCE LICENSES                                             │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │ ✓ GDPR           Active    Included with GROWTH tier      │  │
│  │ ⚠ HIPAA          Not Licensed                             │  │
│  │   → Contact support@thinktank.app to add HIPAA            │  │
│  │ ⚠ SOC 2          Not Licensed                             │  │
│  │   → Contact support@thinktank.app to add SOC 2            │  │
│  │ ✓ Enterprise SSO  Active    Add-on purchased               │  │
│  └──────────────────────────────────────────────────────────┘  │
│                                                                  │
│  DATA RETENTION                                                  │
│  Current: 365 days (included with GROWTH)                        │
│  HIPAA 7-year retention: Not Licensed                            │
│  → Contact support@thinktank.app for extended retention          │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### 7.2 Unlicensed Feature UI Pattern

When a tenant admin navigates to a feature that requires a license they don't have:

```
┌─────────────────────────────────────────────────────────────────┐
│  ⚠ [Feature Name]                                                │
│                                                                  │
│  This feature requires a [LICENSE_NAME] license.                 │
│                                                                  │
│  [LICENSE_NAME] includes:                                        │
│  • [Benefit 1]                                                   │
│  • [Benefit 2]                                                   │
│  • [Benefit 3]                                                   │
│                                                                  │
│  To add this license to your plan, contact Think Tank support:   │
│                                                                  │
│  📧 support@thinktank.app                                       │
│                                                                  │
│  [Contact Support]                                               │
└─────────────────────────────────────────────────────────────────┘
```

This pattern MUST be used consistently across ALL apps, not just Tenant Admin.

---

## 8. Invitation Flow with License Checks

### 8.1 Invite User Flow

```
Tenant Admin clicks "Invite User"
    │
    ▼
Enter email, select role, select app access:
  [✓] Think Tank (42/50 seats available)
  [✓] Curator (15/25 seats available)
  [✗] Dojo — 0 seats available → DISABLED
      "No Dojo seats available. Buy more seats or deactivate a user."
  [✗] Genesis — Not licensed → DISABLED
      "Genesis requires a license. Contact support@thinktank.app"
    │
    ▼
System checks:
  1. Inviter has tenant_admin or tenant_owner role? → YES
  2. Think Tank seat available? → YES (42 < 50)
  3. Curator seat available? → YES (15 < 25)
  4. Email already in this tenant? → NO
    │
    ▼
Create user record:
  - status = 'invited'
  - has_access_think_tank = true
  - has_access_curator = true
  - Think Tank seats_reserved += 1
  - Curator seats_reserved += 1
  - Send invitation email (expires in 7 days or tenant-configured)
    │
    ▼
User accepts invitation:
  - status → 'active'
  - seats_reserved -= 1, seats_used += 1 (for each app)
```

### 8.2 Deactivate User Flow

```
Tenant Admin deactivates a user
    │
    ▼
System:
  - user.status → 'deactivated'
  - For each app the user had access to:
    - seats_used -= 1  (SEAT FREED)
  - User can no longer log in
  - User data RETAINED (for regulatory compliance)
  - Audit log entry created
    │
    ▼
Later, if tenant wants to delete user data:
  - Check tenant retention licenses
  - If retention period not met → BLOCK deletion
    "This user's data must be retained for [X] more days per your [HIPAA/SOC2] license."
  - If retention period met → schedule hard delete
```

---

## 9. Regulatory Compliance & Licensing Interactions

### 9.1 When a Tenant Enables a Compliance License

```
Tenant purchases HIPAA license
    │
    ▼
System provisions:
  1. tenant_licenses: compliance:hipaa → active
  2. tenant_licenses: retention:hipaa → 2555 days (if purchased)
  3. tenant_auth_config: require_mfa → true (HIPAA requires it)
  4. Enable enhanced audit logging for this tenant
  5. Enable PHI field management
  6. Audit log: "HIPAA compliance activated"
    │
    ▼
Tenant Admin UI:
  - HIPAA tab becomes visible and functional
  - MFA becomes mandatory (cannot be disabled while HIPAA is active)
  - Session timeout enforced (15 minutes default for HIPAA)
  - All previously-disabled HIPAA features now available
```

### 9.2 When a Tenant Disables a Compliance License

```
Tenant cancels HIPAA license
    │
    ▼
System checks:
  1. Does tenant have data under HIPAA retention? → If yes, CANNOT disable
     "HIPAA license cannot be removed while data is under HIPAA retention.
      Data must be retained until [DATE]. Contact support for assistance."
  2. If no retained data → proceed
    │
    ▼
System deprovisions:
  1. tenant_licenses: compliance:hipaa → inactive
  2. HIPAA UI features disabled
  3. MFA requirement can now be changed (no longer HIPAA-enforced)
  4. Audit log: "HIPAA compliance deactivated"
```

---

## 10. License Helper Functions

```sql
-- Check if a tenant has a specific license
CREATE OR REPLACE FUNCTION check_tenant_license(
    p_tenant_id UUID,
    p_license_type VARCHAR,
    p_app_id VARCHAR DEFAULT 'platform',
    p_feature_code VARCHAR DEFAULT NULL
) RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM tenant_licenses
        WHERE tenant_id = p_tenant_id
          AND license_type = p_license_type
          AND app_id = p_app_id
          AND (p_feature_code IS NULL OR feature_code = p_feature_code)
          AND is_active = true
          AND (expires_at IS NULL OR expires_at > NOW())
    );
END;
$$ LANGUAGE plpgsql STABLE;

-- Get available seats for an app
CREATE OR REPLACE FUNCTION get_available_seats(
    p_tenant_id UUID,
    p_app_id VARCHAR
) RETURNS INTEGER AS $$
DECLARE
    v_license tenant_licenses%ROWTYPE;
BEGIN
    SELECT * INTO v_license FROM tenant_licenses
    WHERE tenant_id = p_tenant_id
      AND license_type = 'seat'
      AND app_id = p_app_id
      AND is_active = true;
    
    IF NOT FOUND THEN RETURN 0; END IF;
    
    RETURN v_license.quantity - v_license.used - v_license.reserved;
END;
$$ LANGUAGE plpgsql STABLE;

-- Consume a seat (on user activation)
CREATE OR REPLACE FUNCTION consume_seat(
    p_tenant_id UUID,
    p_app_id VARCHAR
) RETURNS BOOLEAN AS $$
DECLARE
    v_available INTEGER;
BEGIN
    v_available := get_available_seats(p_tenant_id, p_app_id);
    IF v_available <= 0 THEN RETURN false; END IF;
    
    UPDATE tenant_licenses
    SET used = used + 1, updated_at = NOW()
    WHERE tenant_id = p_tenant_id
      AND license_type = 'seat'
      AND app_id = p_app_id
      AND is_active = true;
    
    RETURN true;
END;
$$ LANGUAGE plpgsql;

-- Release a seat (on user deactivation)
CREATE OR REPLACE FUNCTION release_seat(
    p_tenant_id UUID,
    p_app_id VARCHAR
) RETURNS BOOLEAN AS $$
BEGIN
    UPDATE tenant_licenses
    SET used = GREATEST(used - 1, 0), updated_at = NOW()
    WHERE tenant_id = p_tenant_id
      AND license_type = 'seat'
      AND app_id = p_app_id
      AND is_active = true;
    
    RETURN FOUND;
END;
$$ LANGUAGE plpgsql;
```

---

## 11. Adding New License Types (For Engineers)

When a new licensable feature is added to the platform:

1. **Add a row to `license_catalog`** with the new license definition
2. **Add license check to the relevant API endpoint(s)** using the middleware pattern in Section 5
3. **Add UI gating** in the relevant app — show "license required" message if unlicensed
4. **Update tier defaults** if the feature should be included in any tier
5. **Update this document** (Section 3) with the new license type
6. **NO code changes to the licensing system itself** — it reads `license_catalog` dynamically

---

## 12. Adding New Apps (For Engineers)

When a new user-facing app is added to the platform:

1. **Add `seat:<app_id>` to `license_catalog`** with tier defaults
2. **Add `has_access_<app_id>` column to `users` table** (or use the dynamic permission system)
3. **Add the app to the invitation UI** in Think Tank Tenant Admin
4. **Add seat license rows** to `tenant_licenses` for all existing tenants (migration)
5. **All API endpoints in the new app** must use the license middleware with `app_id: '<app_id>'`
6. **Update this document** (Sections 3.1 and 4)

---

## 12A. Tenant-Disableable Regulatory Features & UI Pattern

### Overview

Regulatory compliance features are **optional licensed features**. When a tenant has a compliance license, the corresponding features are enabled. When they don't, the features are disabled with a clear UI message.

However, even when a tenant HAS a compliance license, the `tenant_owner` can choose to **disable specific compliance features** for their tenant (e.g., they have HIPAA but want to temporarily disable certain PHI scanning rules).

### Which Features Can Be Tenant-Disabled

| Feature | Can Tenant Disable? | Impact If Disabled | Notes |
|---------|:---:|---|---|
| **HIPAA** | ✅ | PHI scanning off, audit logging reduced | Warning: "Disabling HIPAA may violate BAA" |
| **HIPAA Retention** | ❌ | Cannot disable — required by law once activated | Locked for 7 years after activation |
| **GDPR** | ✅ | Erasure workflows still available (required by law), but consent UI hidden | "GDPR erasure rights cannot be fully disabled" |
| **SOC 2** | ✅ | Self-audit tools hidden, compliance reports disabled | No regulatory consequence |
| **CCPA** | ✅ | Consumer opt-out tracking hidden | Warning if CA users detected |
| **ISO 27001** | ✅ | ISMS controls hidden | No regulatory consequence |
| **Data Residency** | ❌ | Cannot disable — data cannot be moved once pinned | Locked once activated |
| **Enhanced Audit** | ✅ | Per-request audit logging stops | Warning if other compliance requires it |
| **PCI-DSS** | ✅ | Cardholder data controls hidden | Only relevant if processing cards |
| **FedRAMP** | ❌ | Cannot disable — federal requirement once certified | Locked once activated |
| **HITRUST** | ✅ | Healthcare security controls hidden | Warning if HIPAA also active |
| **EU AI Act** | ✅ | AI transparency/oversight features hidden | Warning for EU-based tenants |

### Disable UI Pattern (Think Tank Tenant Admin → Compliance)

```
┌──────────────────────────────────────────────────────────┐
│ Compliance Features                                       │
├──────────────────────────────────────────────────────────┤
│                                                           │
│ ✅ HIPAA Compliance                              [ON/OFF] │
│    PHI management, enhanced audit, BAA                    │
│    ⚠️ Disabling may violate your Business Associate      │
│       Agreement. Contact legal before disabling.          │
│                                                           │
│ 🔒 HIPAA 7-Year Retention                     [LOCKED]   │
│    Cannot be disabled once activated.                     │
│    Earliest deactivation: 2033-02-06                      │
│                                                           │
│ ✅ GDPR Compliance                              [ON/OFF] │
│    Consent UI, portability, DSAR workflows                │
│    ℹ️ Right to erasure remains active per EU law          │
│                                                           │
│ ✅ SOC 2 Type II                                [ON/OFF] │
│    Self-audit, evidence collection, reports               │
│                                                           │
│ ❌ PCI-DSS                               [NOT LICENSED]  │
│    Contact support@thinktank.app to add this license.     │
│    [Contact Support]                                      │
│                                                           │
└──────────────────────────────────────────────────────────┘
```

### States

| State | Visual | Behavior |
|-------|--------|----------|
| **Licensed + Enabled** | Green toggle ON | Feature fully active |
| **Licensed + Disabled by tenant** | Gray toggle OFF | Feature hidden from users, can re-enable |
| **Licensed + Locked** | Lock icon, no toggle | Cannot be disabled (retention, residency, FedRAMP) |
| **Not Licensed** | "NOT LICENSED" badge | Contact support message, no toggle |

### API Enforcement

When a feature is disabled by the tenant (even if licensed):

```typescript
// Check both license AND tenant enablement
const isEnabled = await checkFeatureEnabled(tenantId, 'hipaa');
// Returns false if: no license OR license exists but tenant disabled it

// API response when tenant-disabled:
{
  "error": "FEATURE_DISABLED",
  "feature_code": "hipaa",
  "message": "HIPAA compliance is disabled for this tenant. Contact your tenant administrator to re-enable.",
  "disabled_by": "tenant_admin"
}
```

### Storage

Tenant-level feature enablement is stored in the `tenant_licenses` table via the `is_active` field:
- `is_active = true` → Licensed and enabled
- `is_active = false` → Licensed but tenant-disabled

For locked features, the application logic prevents toggling `is_active` to `false`.

---

## 13. Version History

| Version | Date | Changes |
|---------|------|---------|
| 1.0.0 | 2026-02-06 | Initial licensing model: flexible multi-dimension licensing, regulatory compliance as licensed features, per-app seats, API enforcement middleware, tier defaults |

---

*Think Tank Licensing Model v1.0.0*
*RADIANT Platform — February 2026*
*Contact: support@thinktank.app*
