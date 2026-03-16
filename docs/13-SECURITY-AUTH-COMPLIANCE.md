# Security, Authentication & Compliance

**Auth Architecture • User/Admin/Tenant Guides • MFA • OAuth • Compliance**

*RADIANT v7.63.0 — Generated March 16, 2026*

---

## Table of Contents

- **Part I: Authentication Architecture**
- **Part II: Authentication Overview**
- **Part III: User Authentication Guide**
- **Part IV: Platform Admin Authentication**
- **Part V: Tenant Admin Authentication**
- **Part VI: MFA Guide**
- **Part VII: OAuth Guide**
- **Part VIII: Internationalization**
- **Part IX: Auth Troubleshooting**
- **Part X: Security Audit**
- **Part XI: Compliance**
- **Part XII: User Provisioning & Licensing ADR**

---


---

## Part I: Authentication Architecture

> **Version**: 5.52.29 | **Last Updated**: January 25, 2026 | **Audience**: Security Teams, Architects, Compliance Officers

This document describes RADIANT's authentication security architecture, including threat models, security controls, compliance considerations, and implementation details.

---

## Table of Contents

1. [Architecture Overview](#architecture-overview)
2. [Identity Management](#identity-management)
3. [Authentication Flows](#authentication-flows)
4. [Token Security](#token-security)
5. [Multi-Factor Authentication](#multi-factor-authentication)
6. [Session Management](#session-management)
7. [Enterprise SSO Security](#enterprise-sso-security)
8. [OAuth 2.0 Security](#oauth-20-security)
9. [Threat Mitigation](#threat-mitigation)
10. [Audit and Compliance](#audit-and-compliance)
11. [Cryptographic Standards](#cryptographic-standards)

---

## Architecture Overview

RADIANT implements a defense-in-depth authentication architecture with multiple security layers:

```mermaid
graph TB
    subgraph "Edge Layer"
        WAF[AWS WAF<br/>Rate limiting, IP filtering]
        CF[CloudFront<br/>DDoS protection]
    end
    
    subgraph "API Layer"
        APIGW[API Gateway<br/>Request validation]
        AUTH[Auth Lambda<br/>Token validation]
    end
    
    subgraph "Identity Layer"
        COGNITO[AWS Cognito<br/>User management]
        SSO[SSO Providers<br/>SAML/OIDC]
    end
    
    subgraph "Data Layer"
        RDS[(Aurora PostgreSQL<br/>Encrypted at rest)]
        SECRETS[Secrets Manager<br/>Credential storage]
    end
    
    CF --> WAF
    WAF --> APIGW
    APIGW --> AUTH
    AUTH --> COGNITO
    COGNITO --> SSO
    AUTH --> RDS
    AUTH --> SECRETS
    
    style WAF fill:#ffcdd2
    style COGNITO fill:#c8e6c9
    style RDS fill:#bbdefb
```

### Security Principles

| Principle | Implementation |
|-----------|----------------|
| **Defense in Depth** | Multiple security layers, no single point of failure |
| **Least Privilege** | Minimal permissions by default, explicit grants |
| **Zero Trust** | Verify every request, assume breach |
| **Fail Secure** | Default to deny on errors |
| **Audit Everything** | Complete authentication event logging |

---

## Identity Management

### User Pool Separation

RADIANT maintains separate identity pools for security isolation:

```mermaid
graph LR
    subgraph "End-User Pool"
        EU[Regular Users]
        TA[Tenant Admins]
    end
    
    subgraph "Platform Pool"
        PA[Platform Admins]
    end
    
    subgraph "Service Accounts"
        SA[M2M Tokens]
        API[API Keys]
    end
```

| Pool | Purpose | Isolation |
|------|---------|-----------|
| **End-User** | Think Tank, Curator, Tenant Admin | Per-tenant RLS |
| **Platform** | RADIANT Admin | Separate Cognito pool |
| **Service** | API integrations | Token-based, no user context |

### Tenant Isolation

Row-Level Security (RLS) ensures complete tenant data isolation:

```sql
-- All queries automatically filtered by tenant
ALTER TABLE users ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation ON users
  USING (tenant_id = current_setting('app.current_tenant_id')::uuid);
```

---

## Authentication Flows

### Password Authentication Flow

```mermaid
sequenceDiagram
    participant Client
    participant API as API Gateway
    participant Lambda
    participant Cognito
    participant DB as Database
    
    Client->>API: POST /auth/signin {email, password}
    API->>Lambda: Validate request
    Lambda->>Lambda: Rate limit check
    Lambda->>Cognito: InitiateAuth
    Cognito->>Cognito: Verify password (SRP)
    
    alt MFA Required
        Cognito-->>Lambda: MFA_REQUIRED challenge
        Lambda-->>Client: {challenge: "MFA_REQUIRED"}
        Client->>API: POST /auth/mfa {code}
        API->>Lambda: Verify MFA
        Lambda->>Cognito: RespondToAuthChallenge
    end
    
    Cognito-->>Lambda: Tokens
    Lambda->>DB: Create session record
    Lambda->>DB: Log authentication event
    Lambda-->>Client: {access_token, refresh_token}
```

### Security Controls in Flow

| Step | Control | Purpose |
|------|---------|---------|
| Request | TLS 1.3 | Encryption in transit |
| Request | Rate limiting | Brute force prevention |
| Request | CAPTCHA (optional) | Bot prevention |
| Validation | Input sanitization | Injection prevention |
| Auth | SRP protocol | Zero-knowledge password |
| MFA | TOTP verification | Second factor |
| Response | Secure cookies | XSS/CSRF protection |

---

## Token Security

### Token Types

| Token | Type | Lifetime | Storage |
|-------|------|----------|---------|
| **Access Token** | JWT | 1 hour | Memory only |
| **Refresh Token** | Opaque | 30 days | Secure storage |
| **ID Token** | JWT | 1 hour | Memory only |
| **API Key** | Opaque | Configurable | Server-side |

### JWT Structure

```json
{
  "header": {
    "alg": "RS256",
    "typ": "JWT",
    "kid": "key-id-from-jwks"
  },
  "payload": {
    "sub": "user-uuid",
    "iss": "https://cognito-idp.region.amazonaws.com/pool-id",
    "aud": "client-id",
    "exp": 1706234567,
    "iat": 1706230967,
    "auth_time": 1706230967,
    "token_use": "access",
    "scope": "openid profile",
    "tenant_id": "tenant-uuid",
    "roles": ["member"]
  },
  "signature": "..."
}
```

### Token Validation

```mermaid
flowchart TD
    A[Receive Token] --> B{Signature Valid?}
    B -->|No| X[Reject]
    B -->|Yes| C{Expired?}
    C -->|Yes| X
    C -->|No| D{Issuer Valid?}
    D -->|No| X
    D -->|Yes| E{Audience Valid?}
    E -->|No| X
    E -->|Yes| F{Revoked?}
    F -->|Yes| X
    F -->|No| G[Accept]
```

### Token Storage Best Practices

| Client Type | Access Token | Refresh Token |
|-------------|--------------|---------------|
| **SPA** | Memory variable | httpOnly cookie or memory |
| **Mobile** | Secure enclave | Keychain/Keystore |
| **Server** | Memory | Encrypted database |

---

## Multi-Factor Authentication

### TOTP Implementation

| Parameter | Value |
|-----------|-------|
| **Algorithm** | SHA-1 (RFC 6238 compliant) |
| **Digits** | 6 |
| **Period** | 30 seconds |
| **Clock tolerance** | ±1 period |

### MFA Enrollment Security

```mermaid
sequenceDiagram
    participant User
    participant App
    participant Backend
    participant Cognito
    
    User->>App: Click "Enable MFA"
    App->>Backend: Request MFA setup
    Backend->>Cognito: AssociateSoftwareToken
    Cognito-->>Backend: Secret key
    Backend-->>App: QR code (not stored)
    App->>User: Display QR code
    User->>User: Scan with authenticator
    User->>App: Enter verification code
    App->>Backend: Verify code
    Backend->>Cognito: VerifySoftwareToken
    Cognito-->>Backend: Success
    Backend->>Backend: Mark MFA enabled
    Backend-->>App: MFA enabled
```

### Backup Codes

| Property | Value |
|----------|-------|
| **Count** | 10 codes |
| **Format** | 8 alphanumeric characters |
| **Storage** | Hashed (bcrypt) |
| **Usage** | Single use, then invalidated |

---

## Session Management

### Session Properties

| Property | Value | Rationale |
|----------|-------|-----------|
| **Session ID** | UUID v4 | Unpredictable |
| **Binding** | User + Device fingerprint | Prevent session hijacking |
| **Inactivity timeout** | Configurable (default 7 days) | Balance security/UX |
| **Absolute timeout** | Configurable (default 30 days) | Force re-authentication |
| **Concurrent limit** | Configurable (default 5) | Detect sharing/theft |

### Session Storage

```sql
CREATE TABLE user_sessions (
    id UUID PRIMARY KEY,
    user_id UUID REFERENCES users(id),
    tenant_id UUID REFERENCES tenants(id),
    device_fingerprint TEXT,
    ip_address INET,
    user_agent TEXT,
    created_at TIMESTAMPTZ,
    last_activity_at TIMESTAMPTZ,
    expires_at TIMESTAMPTZ,
    revoked_at TIMESTAMPTZ,
    revocation_reason TEXT
);

-- Index for cleanup and validation
CREATE INDEX idx_sessions_expiry ON user_sessions(expires_at) WHERE revoked_at IS NULL;
CREATE INDEX idx_sessions_user ON user_sessions(user_id, tenant_id) WHERE revoked_at IS NULL;
```

### Session Termination Events

| Event | Action |
|-------|--------|
| User logout | Revoke current session |
| Password change | Revoke all sessions |
| MFA reset | Revoke all sessions |
| Admin action | Revoke specified sessions |
| Suspicious activity | Revoke all sessions |

---

## Enterprise SSO Security

### SAML 2.0 Security

| Control | Implementation |
|---------|----------------|
| **Signature validation** | RSA-SHA256 required |
| **Assertion encryption** | AES-256 supported |
| **Replay prevention** | Assertion ID tracking, 5-min validity |
| **Audience restriction** | Enforce SP entity ID |
| **Time validation** | Clock skew ≤ 5 minutes |

### OIDC Security

| Control | Implementation |
|---------|----------------|
| **PKCE** | Required for all flows |
| **State parameter** | Required, validated |
| **Nonce** | Required for implicit flows |
| **Token binding** | Client ID validation |

### IdP Trust Model

```mermaid
graph TD
    subgraph "Trust Boundary"
        RADIANT[RADIANT SP]
        CERT[Certificate Store]
    end
    
    subgraph "External"
        IDP[Identity Provider]
    end
    
    IDP -->|SAML Assertion| RADIANT
    CERT -->|Verify Signature| RADIANT
    
    Note1[Certificates managed<br/>per tenant]
    Note2[Automatic expiration<br/>alerts]
```

---

## OAuth 2.0 Security

### Authorization Server Security

| Control | Implementation |
|---------|----------------|
| **PKCE** | Required (S256 only) |
| **Redirect URI** | Exact match validation |
| **State parameter** | Required, cryptographic |
| **Client authentication** | Secret for confidential clients |
| **Scope limitation** | Explicit consent required |

### Token Security

| Token Type | Security Measures |
|------------|-------------------|
| **Authorization Code** | Single-use, 10-min expiry, bound to client |
| **Access Token** | JWT signed RS256, 1-hour expiry |
| **Refresh Token** | Rotation on use, revocable |

### Consent Management

```sql
CREATE TABLE oauth_consents (
    id UUID PRIMARY KEY,
    user_id UUID REFERENCES users(id),
    client_id TEXT NOT NULL,
    scopes TEXT[] NOT NULL,
    granted_at TIMESTAMPTZ DEFAULT NOW(),
    revoked_at TIMESTAMPTZ,
    UNIQUE(user_id, client_id)
);
```

---

## Threat Mitigation

### Threat Model

| Threat | Mitigation |
|--------|------------|
| **Credential stuffing** | Rate limiting, CAPTCHA, breach monitoring |
| **Brute force** | Account lockout, progressive delays |
| **Session hijacking** | Secure cookies, device binding, IP validation |
| **Token theft** | Short expiry, secure storage, rotation |
| **Phishing** | MFA, passkeys, security training |
| **Man-in-the-middle** | TLS 1.3, certificate pinning (mobile) |
| **XSS** | CSP headers, httpOnly cookies, sanitization |
| **CSRF** | SameSite cookies, CSRF tokens |

### Rate Limiting

| Endpoint | Limit | Window | Action |
|----------|-------|--------|--------|
| `/auth/signin` | 10 | 1 minute | Block IP |
| `/auth/signup` | 5 | 1 minute | Block IP |
| `/auth/password-reset` | 3 | 1 hour | Block email |
| `/auth/mfa/verify` | 5 | 1 minute | Lock account |

### Anomaly Detection

```mermaid
flowchart TD
    A[Login Attempt] --> B{New Device?}
    B -->|Yes| C{New Location?}
    C -->|Yes| D[High Risk]
    C -->|No| E[Medium Risk]
    B -->|No| F{Unusual Time?}
    F -->|Yes| G[Low Risk]
    F -->|No| H[Normal]
    
    D --> I[Require MFA + Notify]
    E --> J[Require MFA]
    G --> K[Log for review]
    H --> L[Proceed]
```

---

## Audit and Compliance

### Authentication Events Logged

| Event | Data Captured |
|-------|---------------|
| `auth.attempt` | User, IP, device, timestamp, method |
| `auth.success` | User, IP, device, session ID, MFA used |
| `auth.failure` | User (if known), IP, device, reason |
| `auth.mfa.setup` | User, method, timestamp |
| `auth.mfa.verify` | User, method, success/failure |
| `auth.logout` | User, session ID, reason |
| `auth.session.revoke` | User, session ID, admin (if applicable) |
| `auth.password.change` | User, IP, timestamp |
| `auth.password.reset` | User, IP, timestamp |

### Log Storage

| Requirement | Implementation |
|-------------|----------------|
| **Retention** | 90 days hot, 7 years archive |
| **Encryption** | AES-256 at rest |
| **Integrity** | Hash chain, tamper detection |
| **Access** | Role-based, audited |

### Compliance Frameworks

| Framework | Authentication Requirements | Status |
|-----------|----------------------------|--------|
| **SOC 2** | Access controls, MFA, logging | ✅ Compliant |
| **GDPR** | Consent, data minimization | ✅ Compliant |
| **HIPAA** | Access controls, audit trails | ✅ Ready |
| **ISO 27001** | ISMS controls | ✅ Aligned |

---

## Cryptographic Standards

### Algorithms in Use

| Purpose | Algorithm | Key Size |
|---------|-----------|----------|
| **Password hashing** | Argon2id | Memory: 64MB, Time: 3 |
| **Token signing** | RS256 (RSA-SHA256) | 2048-bit |
| **Session IDs** | CSPRNG (UUID v4) | 128-bit |
| **MFA secrets** | HMAC-SHA1 | 160-bit |
| **Backup codes** | CSPRNG | 64-bit |
| **TLS** | TLS 1.3 | ECDHE+AES-256-GCM |

### Key Management

| Key Type | Rotation | Storage |
|----------|----------|---------|
| **Cognito signing keys** | Automatic (AWS managed) | AWS KMS |
| **SSO certificates** | Annual (manual) | Secrets Manager |
| **API secrets** | On compromise | Secrets Manager |
| **Encryption keys** | Annual (automatic) | AWS KMS |

---

## Security Recommendations

### For Tenant Administrators

1. **Enable MFA for all admins** (enforced by default)
2. **Configure SSO** for enterprise identity management
3. **Review audit logs** regularly for anomalies
4. **Set appropriate session timeouts** for your security requirements
5. **Use IP restrictions** for admin access when possible

### For Platform Administrators

1. **Monitor rate limiting effectiveness**
2. **Review failed authentication patterns**
3. **Keep SSO certificates updated** (30-day alerts)
4. **Perform regular access reviews**
5. **Test incident response procedures**

### For Developers

1. **Never log sensitive data** (passwords, tokens)
2. **Validate all tokens server-side**
3. **Use secure token storage patterns**
4. **Implement proper error handling** (no information leakage)
5. **Follow OWASP guidelines**

---

## Related Documentation

- [Authentication Overview](../authentication/overview.md)
- [Platform Admin Guide](../authentication/platform-admin-guide.md)
- [OAuth Developer Guide](../authentication/oauth-guide.md)
- [API Reference](../api/authentication-api.md)
- [Compliance Documentation](../COMPLIANCE.md)


---

## Part II: Authentication Overview

> **Version**: 5.52.29 | **Last Updated**: January 25, 2026 | **PROMPT-41C**

RADIANT provides enterprise-grade authentication with multi-layer security, supporting everything from individual users to large organizations with complex security requirements.

## Key Features

| Feature | Description |
|---------|-------------|
| **Multi-layer authentication** | End users, tenant admins, and platform admins |
| **Enterprise SSO** | SAML 2.0 and OIDC integration |
| **Two-Factor Authentication** | Required for admin roles |
| **OAuth 2.0 Provider** | Third-party app integrations |
| **18 Language Support** | Full internationalization including RTL |
| **Multi-language Search** | CJK (Chinese, Japanese, Korean) support |

## Authentication Layers

RADIANT implements three distinct authentication layers, each designed for specific use cases:

```mermaid
graph TB
    subgraph "Layer 1: End Users"
        EU[End Users] --> UP[User Pool]
        UP --> TT[Think Tank]
        UP --> CU[Curator]
        UP --> TA[Tenant Admin]
    end
    
    subgraph "Layer 2: Platform Admins"
        PA[Platform Admins] --> AP[Admin Pool]
        AP --> RA[RADIANT Admin]
    end
    
    subgraph "Layer 3: Services"
        SV[Services & Apps] --> AK[API Keys]
        SV --> M2M[M2M Tokens]
        AK --> API[RADIANT API]
        M2M --> API
    end
    
    style EU fill:#e1f5fe
    style PA fill:#fff3e0
    style SV fill:#f3e5f5
```

### Layer 1: End-User Authentication

For users of Think Tank, Curator, and Tenant Admin applications.

| Feature | Description |
|---------|-------------|
| **Sign-in Methods** | Email/password, Google, Microsoft, Apple, GitHub |
| **Enterprise SSO** | SAML 2.0 and OIDC for organization-wide sign-in |
| **Passkeys** | WebAuthn/FIDO2 passwordless authentication |
| **MFA** | Optional for standard users, required for tenant admins |
| **Languages** | 18 languages including Arabic (RTL) |

### Layer 2: Platform Administrator Authentication

For RADIANT platform operators and support staff.

| Feature | Description |
|---------|-------------|
| **Access** | Invitation-only (no self-registration) |
| **MFA** | Always required, cannot be disabled |
| **Session Timeout** | 30 minutes (shorter than end users) |
| **Audit** | All actions logged with full context |

### Layer 3: Service Authentication

For programmatic access and third-party integrations.

| Feature | Description |
|---------|-------------|
| **API Keys** | Long-lived keys for server-to-server communication |
| **OAuth Tokens** | Short-lived tokens for third-party apps acting as users |
| **Scopes** | Fine-grained permissions for each token/key |

---

## Supported Languages

RADIANT authentication screens are available in 18 languages:

| Language | Code | Direction | Search Method |
|----------|------|-----------|---------------|
| English | `en` | LTR | PostgreSQL FTS |
| Spanish | `es` | LTR | PostgreSQL FTS |
| French | `fr` | LTR | PostgreSQL FTS |
| German | `de` | LTR | PostgreSQL FTS |
| Portuguese | `pt` | LTR | PostgreSQL FTS |
| Italian | `it` | LTR | PostgreSQL FTS |
| Dutch | `nl` | LTR | PostgreSQL FTS |
| Polish | `pl` | LTR | PostgreSQL `simple` |
| Russian | `ru` | LTR | PostgreSQL FTS |
| Turkish | `tr` | LTR | PostgreSQL FTS |
| Japanese | `ja` | LTR | `pg_bigm` bi-gram |
| Korean | `ko` | LTR | `pg_bigm` bi-gram |
| Chinese (Simplified) | `zh-CN` | LTR | `pg_bigm` bi-gram |
| Chinese (Traditional) | `zh-TW` | LTR | `pg_bigm` bi-gram |
| **Arabic** | `ar` | **RTL** | PostgreSQL `simple` |
| Hindi | `hi` | LTR | PostgreSQL `simple` |
| Thai | `th` | LTR | PostgreSQL `simple` |
| Vietnamese | `vi` | LTR | PostgreSQL `simple` |

See [Internationalization Guide](./i18n-guide.md) for details on changing your language.

---

## Security Features

### Multi-Factor Authentication (MFA)

```mermaid
flowchart LR
    subgraph "MFA Methods"
        TOTP[Authenticator App<br/>TOTP]
        BC[Backup Codes<br/>10 one-time codes]
    end
    
    subgraph "Device Trust"
        DT[Remember Device<br/>30 days]
        DM[Device Management<br/>Up to 5 devices]
    end
    
    TOTP --> DT
    BC --> DT
```

| Method | Description |
|--------|-------------|
| **TOTP** | Time-based codes from authenticator apps (Google, Microsoft, 1Password, Authy) |
| **Backup Codes** | 10 one-time recovery codes for emergency access |
| **Device Trust** | Skip MFA verification on trusted devices for 30 days |

### Enterprise SSO

```mermaid
flowchart LR
    User --> App[RADIANT App]
    App --> |"Redirect"| IdP[Identity Provider]
    IdP --> |"SAML/OIDC"| App
    App --> |"Session"| User
    
    subgraph "Supported Providers"
        Okta
        AzureAD[Azure AD]
        Google[Google Workspace]
        OneLogin
        Custom[Custom SAML/OIDC]
    end
    
    IdP -.-> Okta
    IdP -.-> AzureAD
    IdP -.-> Google
    IdP -.-> OneLogin
    IdP -.-> Custom
```

### OAuth for Third-Party Apps

Third-party applications can request permission to access RADIANT on behalf of users:

```mermaid
sequenceDiagram
    participant User
    participant App as Third-Party App
    participant RADIANT
    
    User->>App: Click "Connect to RADIANT"
    App->>RADIANT: Authorization request
    RADIANT->>User: Show consent screen
    User->>RADIANT: Approve
    RADIANT->>App: Authorization code
    App->>RADIANT: Exchange for tokens
    RADIANT->>App: Access token
    App->>RADIANT: API requests (as user)
```

---

## Application Matrix

| Application | User Types | MFA | SSO | OAuth | Languages |
|-------------|-----------|-----|-----|-------|-----------|
| **Think Tank** | Standard users | Optional (hidden) | ✅ | N/A | 18 |
| **Curator** | Standard users | Optional (hidden) | ✅ | N/A | 18 |
| **Tenant Admin** | Tenant admins/owners | Required | ✅ | N/A | 18 |
| **RADIANT Admin** | Platform admins | Required | ❌ | N/A | 18 |

---

## Quick Links

| Document | Audience | Description |
|----------|----------|-------------|
| [User Authentication Guide](./user-guide.md) | End Users | Sign-in, password, passkeys |
| [Tenant Admin Guide](./tenant-admin-guide.md) | Tenant Admins | SSO, user management, MFA policies |
| [Platform Admin Guide](./platform-admin-guide.md) | Platform Admins | System-wide auth configuration |
| [MFA Setup Guide](./mfa-guide.md) | All Admins | Two-factor authentication setup |
| [OAuth Developer Guide](./oauth-guide.md) | Developers | Building third-party integrations |
| [Internationalization Guide](./i18n-guide.md) | All | Language settings, RTL support |
| [API Reference](../api/authentication-api.md) | Developers | Technical API documentation |
| [Search API Reference](../api/search-api.md) | Developers | Multi-language search |
| [Security Architecture](../security/authentication-architecture.md) | Security Teams | Compliance and architecture |
| [Troubleshooting](./troubleshooting.md) | All | Common issues and solutions |

---

## Related Documentation

- [RADIANT Admin Guide](../RADIANT-ADMIN-GUIDE.md) - Platform administration
- [Think Tank Admin Guide](../THINKTANK-ADMIN-GUIDE.md) - Tenant administration
- [Think Tank User Guide](../THINKTANK-USER-GUIDE.md) - End-user documentation
- [Engineering Implementation Vision](../ENGINEERING-IMPLEMENTATION-VISION.md) - Technical architecture


---

## Part III: User Authentication Guide

> **Version**: 5.52.29 | **Last Updated**: January 25, 2026 | **Audience**: End Users

This guide covers how to sign in, manage your password, set up passkeys, and change your language settings.

---

## Table of Contents

1. [Signing In](#signing-in)
2. [Password Management](#password-management)
3. [Passkeys (Passwordless)](#passkeys-passwordless)
4. [Social Sign-In](#social-sign-in)
5. [Enterprise SSO](#enterprise-sso)
6. [Language Settings](#language-settings)
7. [Common Issues](#common-issues)

---

## Signing In

### Email and Password

1. Go to your organization's Think Tank or Curator URL
2. Enter your **email address**
3. Enter your **password**
4. Click **Sign In**

```mermaid
flowchart LR
    A[Enter Email] --> B[Enter Password]
    B --> C{MFA Enabled?}
    C -->|Yes| D[Enter MFA Code]
    C -->|No| E[Dashboard]
    D --> E
```

### What to Expect After Signing In

| Scenario | What Happens |
|----------|--------------|
| **First sign-in** | You may be asked to verify your email |
| **New device** | Additional verification may be required |
| **MFA enabled** | Enter code from your authenticator app |
| **Session expired** | Sign in again (sessions last 7 days) |

---

## Password Management

### Password Requirements

Your password must meet these requirements:

| Requirement | Minimum |
|-------------|---------|
| **Length** | 12 characters |
| **Uppercase** | 1 letter |
| **Lowercase** | 1 letter |
| **Number** | 1 digit |
| **Special character** | 1 symbol (!@#$%^&*) |

### Changing Your Password

1. Click your **avatar** (top-right corner)
2. Select **Account Settings**
3. Click **Security** tab
4. Click **Change Password**
5. Enter your **current password**
6. Enter and confirm your **new password**
7. Click **Update Password**

### Forgot Password

1. On the sign-in page, click **Forgot password?**
2. Enter your **email address**
3. Click **Send Reset Link**
4. Check your email for the reset link
5. Click the link and enter your **new password**

> **Note**: Reset links expire after 24 hours. If expired, request a new one.

---

## Passkeys (Passwordless)

Passkeys let you sign in without a password using biometrics or your device's security.

### What is a Passkey?

A passkey is a secure credential stored on your device that uses:
- **Fingerprint** (Touch ID, fingerprint sensor)
- **Face recognition** (Face ID)
- **Device PIN/pattern** (Windows Hello, Android PIN)

```mermaid
flowchart LR
    subgraph "Passkey Sign-In"
        A[Click Sign In with Passkey] --> B[Select Your Passkey]
        B --> C[Verify with Biometric]
        C --> D[Signed In!]
    end
```

### Setting Up a Passkey

1. Sign in with your email and password
2. Go to **Account Settings** → **Security**
3. Click **Add Passkey**
4. Follow your browser/device prompts to create the passkey
5. Give your passkey a **name** (e.g., "MacBook Touch ID")

### Using Your Passkey

1. On the sign-in page, click **Sign in with Passkey**
2. Select your passkey from the browser prompt
3. Verify with your biometric (fingerprint/face)
4. You're signed in!

### Managing Passkeys

- **View passkeys**: Account Settings → Security → Passkeys
- **Remove a passkey**: Click the ✕ next to the passkey name
- **Maximum passkeys**: You can have up to 10 passkeys

### Passkey Compatibility

| Platform | Browser | Biometric Support |
|----------|---------|------------------|
| macOS | Safari, Chrome, Firefox | Touch ID |
| iOS | Safari | Face ID, Touch ID |
| Windows | Chrome, Edge | Windows Hello |
| Android | Chrome | Fingerprint, Face Unlock |

---

## Social Sign-In

You can sign in using your existing accounts from:

| Provider | Click This Button |
|----------|-------------------|
| **Google** | "Continue with Google" |
| **Microsoft** | "Continue with Microsoft" |
| **Apple** | "Continue with Apple" |
| **GitHub** | "Continue with GitHub" |

### Linking Social Accounts

To link a social account to your existing RADIANT account:

1. Sign in with your email/password
2. Go to **Account Settings** → **Connected Accounts**
3. Click **Connect** next to the provider
4. Authorize the connection

### Unlinking Social Accounts

1. Go to **Account Settings** → **Connected Accounts**
2. Click **Disconnect** next to the provider
3. Confirm the disconnection

> **Warning**: If you unlink all sign-in methods, ensure you have a password set!

---

## Enterprise SSO

If your organization uses Single Sign-On (SSO), you may sign in differently.

### Signing In with SSO

1. Go to your organization's sign-in page
2. Enter your **work email address**
3. Click **Continue** — you'll be redirected to your company's identity provider
4. Sign in using your company credentials
5. You'll be automatically signed in to RADIANT

```mermaid
sequenceDiagram
    participant You
    participant RADIANT
    participant Company as Your Company IdP
    
    You->>RADIANT: Enter work email
    RADIANT->>Company: Redirect to SSO
    You->>Company: Sign in with company credentials
    Company->>RADIANT: Authentication successful
    RADIANT->>You: Signed in!
```

### SSO Providers Supported

- **Okta**
- **Azure Active Directory** (Microsoft Entra ID)
- **Google Workspace**
- **OneLogin**
- **Ping Identity**
- **Custom SAML 2.0 / OIDC providers**

> **Note**: SSO configuration is managed by your organization's IT administrator.

---

## Language Settings

RADIANT supports 18 languages for all authentication screens and the application interface.

### Changing Your Language

1. Click your **avatar** (top-right corner)
2. Select **Settings** (or **Account Settings**)
3. Click **Language & Region**
4. Select your preferred **language** from the dropdown
5. Click **Save**

The interface will immediately update to your selected language.

### Supported Languages

| Language | Native Name | Direction |
|----------|-------------|-----------|
| English | English | Left-to-right |
| Spanish | Español | Left-to-right |
| French | Français | Left-to-right |
| German | Deutsch | Left-to-right |
| Portuguese | Português | Left-to-right |
| Italian | Italiano | Left-to-right |
| Dutch | Nederlands | Left-to-right |
| Polish | Polski | Left-to-right |
| Russian | Русский | Left-to-right |
| Turkish | Türkçe | Left-to-right |
| Japanese | 日本語 | Left-to-right |
| Korean | 한국어 | Left-to-right |
| Chinese (Simplified) | 简体中文 | Left-to-right |
| Chinese (Traditional) | 繁體中文 | Left-to-right |
| **Arabic** | العربية | **Right-to-left** |
| Hindi | हिन्दी | Left-to-right |
| Thai | ไทย | Left-to-right |
| Vietnamese | Tiếng Việt | Left-to-right |

### Right-to-Left (RTL) Support

When using Arabic, the entire interface automatically adjusts:
- Text flows right-to-left
- Navigation moves to the right side
- Icons and buttons are mirrored appropriately
- **Email addresses**, **codes**, and **passwords** remain left-to-right for clarity

---

## Common Issues

### "Invalid email or password"

**Possible causes:**
- Incorrect password (passwords are case-sensitive)
- Using the wrong email address
- Account not yet verified

**Solutions:**
1. Check your email address for typos
2. Use **Forgot password?** to reset your password
3. Check your email for a verification link

### "Account locked"

Your account may be locked after too many failed sign-in attempts.

**Solutions:**
1. Wait 15 minutes, then try again
2. Reset your password using **Forgot password?**
3. Contact your organization's administrator

### "MFA code invalid"

**Possible causes:**
- Code has expired (codes are valid for 30 seconds)
- Clock on your device is incorrect
- Using a code from the wrong account

**Solutions:**
1. Wait for a new code to generate
2. Ensure your device's time is synced automatically
3. Verify you're scanning the correct QR code in your authenticator app

### "Session expired"

**Cause:** You haven't used the application for a while.

**Solution:** Sign in again. Your work is saved.

### "Passkey not recognized"

**Possible causes:**
- Passkey was created on a different device
- Passkey has been deleted

**Solutions:**
1. Try signing in with email/password
2. Set up a new passkey on this device

---

## Getting Help

If you continue to have issues signing in:

1. **Check the status page** for any ongoing incidents
2. **Contact your IT administrator** if you're using enterprise SSO
3. **Use the Help chat** in the bottom-right corner of the sign-in page
4. **Email support** at the address provided by your organization

---

## Related Documentation

- [Authentication Overview](./overview.md)
- [MFA Setup Guide](./mfa-guide.md)
- [Internationalization Guide](./i18n-guide.md)
- [Troubleshooting](./troubleshooting.md)


---

## Part IV: Platform Admin Authentication

> **Version**: 5.52.29 | **Last Updated**: January 25, 2026 | **Audience**: Platform Administrators

This guide covers system-wide authentication configuration for RADIANT platform administrators: managing Cognito pools, global security policies, tenant authentication settings, and compliance configuration.

---

## Table of Contents

1. [Overview](#overview)
2. [Cognito User Pool Management](#cognito-user-pool-management)
3. [Global Security Policies](#global-security-policies)
4. [Tenant Authentication Management](#tenant-authentication-management)
5. [OAuth Provider Management](#oauth-provider-management)
6. [Compliance & Audit](#compliance--audit)
7. [Emergency Procedures](#emergency-procedures)
8. [Infrastructure Configuration](#infrastructure-configuration)

---

## Overview

As a Platform Administrator, you manage authentication infrastructure across all tenants. Your responsibilities include:

| Responsibility | Scope |
|---------------|-------|
| **Cognito Pool Management** | Configure AWS Cognito settings |
| **Global Security Policies** | Set platform-wide security baselines |
| **Tenant Oversight** | Monitor and assist tenant authentication |
| **OAuth Provider Registry** | Manage platform-level OAuth settings |
| **Compliance Configuration** | Configure audit, retention, and compliance features |
| **Incident Response** | Handle security incidents and emergency access |

```mermaid
graph TB
    subgraph "Platform Admin Scope"
        PA[Platform Admin] --> COGNITO[Cognito Pools]
        PA --> GLOBAL[Global Policies]
        PA --> TENANTS[Tenant Oversight]
        PA --> OAUTH[OAuth Registry]
        PA --> COMPLIANCE[Compliance]
        PA --> INCIDENT[Incidents]
    end
    
    subgraph "Tenant Scope"
        TENANTS --> T1[Tenant 1]
        TENANTS --> T2[Tenant 2]
        TENANTS --> TN[Tenant N]
    end
    
    COGNITO --> T1
    COGNITO --> T2
    COGNITO --> TN
```

> **Note**: Platform administrators always require MFA and have shorter session timeouts (30 minutes) compared to tenant users.

---

## Cognito User Pool Management

### User Pool Architecture

RADIANT uses separate Cognito User Pools for different user types:

| Pool | Purpose | Users |
|------|---------|-------|
| **End-User Pool** | Think Tank, Curator, Tenant Admin users | Organization members |
| **Platform Admin Pool** | RADIANT platform administrators | Internal operations |

```mermaid
graph LR
    subgraph "AWS Cognito"
        EUP[End-User Pool]
        PAP[Platform Admin Pool]
    end
    
    subgraph "Applications"
        TT[Think Tank]
        CU[Curator]
        TA[Tenant Admin]
        RA[RADIANT Admin]
    end
    
    EUP --> TT
    EUP --> CU
    EUP --> TA
    PAP --> RA
```

### Configuring the End-User Pool

1. Navigate to **Platform Admin** → **Infrastructure** → **Cognito**
2. Select **End-User Pool**
3. Configure settings:

| Setting | Description | Recommended |
|---------|-------------|-------------|
| **Password policy** | Minimum requirements | 12+ chars, mixed case, number, symbol |
| **MFA configuration** | Available MFA methods | TOTP enabled |
| **Account recovery** | How users reset passwords | Email verification |
| **Email configuration** | SES for transactional emails | Use verified SES domain |
| **Lambda triggers** | Custom authentication logic | Pre-signup, Post-confirm |

### Configuring the Platform Admin Pool

1. Navigate to **Platform Admin** → **Infrastructure** → **Cognito**
2. Select **Platform Admin Pool**
3. This pool has stricter defaults:

| Setting | Value | Changeable |
|---------|-------|------------|
| **Self-registration** | Disabled | No |
| **MFA** | Required (TOTP) | No |
| **Password length** | 16+ characters | Can increase only |
| **Session duration** | 30 minutes | Can decrease only |

### Managing App Clients

App clients define how applications connect to Cognito:

1. Navigate to **Cognito** → **App Clients**
2. View existing clients:

| Client | Application | OAuth Flows |
|--------|-------------|-------------|
| `thinktank-web` | Think Tank Web | Authorization Code + PKCE |
| `curator-web` | Curator Web | Authorization Code + PKCE |
| `admin-web` | Admin Dashboard | Authorization Code + PKCE |
| `api-m2m` | Machine-to-Machine | Client Credentials |

3. To create a new client, click **Add Client** and configure:
   - **Name**: Descriptive identifier
   - **Generate secret**: Yes for server apps, No for SPAs
   - **OAuth flows**: Select appropriate flows
   - **Scopes**: Limit to required scopes

---

## Global Security Policies

### Password Policy Baseline

Set minimum password requirements that all tenants must meet:

1. Navigate to **Platform Admin** → **Security** → **Global Policies**
2. Under **Password Baseline**:

| Setting | Minimum | Maximum | Default |
|---------|---------|---------|---------|
| **Length** | 8 | — | 12 |
| **Uppercase** | Required | — | Required |
| **Lowercase** | Required | — | Required |
| **Numbers** | Required | — | Required |
| **Symbols** | Optional | — | Required |
| **History** | 0 | 24 | 5 |

Tenants can only set policies **stricter** than the baseline.

### MFA Policy Baseline

Define minimum MFA requirements:

| User Type | Platform Minimum | Tenant Can Override |
|-----------|-----------------|---------------------|
| **Tenant Owners** | Required | No (cannot weaken) |
| **Tenant Admins** | Required | No (cannot weaken) |
| **Members** | Hidden | Yes (can require) |

### Session Policy Baseline

| Setting | Platform Limit | Tenant Range |
|---------|---------------|--------------|
| **Max session length** | 30 days | 1 hour - 30 days |
| **Inactivity timeout** | 7 days | 15 min - 7 days |
| **Concurrent sessions** | 10 | 1 - 10 |

### Rate Limiting

Protect against abuse with rate limits:

| Endpoint | Limit | Window |
|----------|-------|--------|
| `/auth/signin` | 10 requests | 1 minute per IP |
| `/auth/signup` | 5 requests | 1 minute per IP |
| `/auth/password-reset` | 3 requests | 1 hour per email |
| `/auth/mfa/verify` | 5 requests | 1 minute per user |

---

## Tenant Authentication Management

### Viewing Tenant Auth Status

1. Navigate to **Platform Admin** → **Tenants**
2. The **Authentication** column shows:
   - 🟢 **Healthy**: No issues
   - 🟡 **Warning**: Potential issues (high failure rate, expiring certs)
   - 🔴 **Critical**: Active issues (SSO down, lockouts)

### Tenant SSO Oversight

View and assist with tenant SSO configurations:

1. Navigate to **Platform Admin** → **Tenants** → **[Tenant]** → **SSO**
2. View:
   - SSO provider details
   - Certificate expiration dates
   - Recent authentication success/failure rates
   - Error logs

### Certificate Expiration Alerts

Automatic alerts are sent when:

| Timeframe | Alert Level | Recipients |
|-----------|-------------|------------|
| 30 days before | Info | Tenant admins |
| 14 days before | Warning | Tenant admins, Platform admins |
| 7 days before | Critical | All admins + escalation |
| Expired | Emergency | All + service status page |

### Assisting Tenant Users

To help a tenant user with authentication issues:

1. Navigate to **Platform Admin** → **Tenants** → **[Tenant]** → **Users**
2. Find the user
3. Available actions:
   - **Reset password**: Send password reset email
   - **Reset MFA**: Clear MFA configuration
   - **Unlock account**: Remove lockout
   - **Terminate sessions**: Force re-authentication
   - **View auth logs**: See recent activity

> **Audit**: All platform admin actions on tenant users are logged with full context.

---

## OAuth Provider Management

### Platform OAuth Applications

Manage applications that can integrate with RADIANT across tenants:

1. Navigate to **Platform Admin** → **OAuth** → **Applications**
2. View registered applications:

| Field | Description |
|-------|-------------|
| **Name** | Application display name |
| **Publisher** | Verified publisher (if any) |
| **Client ID** | Public identifier |
| **Redirect URIs** | Allowed callback URLs |
| **Scopes** | Maximum permitted scopes |
| **Status** | Active, Suspended, Pending Review |

### Registering a Platform App

For first-party or verified partner applications:

1. Click **Register Application**
2. Enter application details:
   - **Name**: Display name shown to users
   - **Description**: What the app does
   - **Publisher**: Company/developer name
   - **Logo URL**: 256x256 PNG/SVG
   - **Privacy Policy URL**: Required
   - **Terms of Service URL**: Required
3. Configure OAuth settings:
   - **Redirect URIs**: Exact match required
   - **Allowed scopes**: Select from available scopes
   - **Token lifetime**: Access token expiration
4. Click **Register**
5. Securely store the **Client Secret** (shown only once)

### Scope Definitions

| Scope | Access | Sensitivity |
|-------|--------|-------------|
| `openid` | Basic identity | Low |
| `profile` | Name, avatar | Low |
| `email` | Email address | Medium |
| `read:sessions` | View user sessions | Medium |
| `write:sessions` | Modify sessions | High |
| `read:files` | Access user files | High |
| `write:files` | Upload/delete files | High |
| `admin:tenant` | Tenant admin actions | Critical |

### Suspending an Application

If an application is compromised or violates policies:

1. Find the application in the list
2. Click **Suspend**
3. Select reason:
   - **Security incident**
   - **Policy violation**
   - **Publisher request**
4. All tokens are immediately invalidated
5. Tenants are notified

---

## Compliance & Audit

### Audit Log Configuration

Configure what authentication events are logged:

1. Navigate to **Platform Admin** → **Compliance** → **Audit Configuration**
2. Enable/disable event categories:

| Category | Events | Default |
|----------|--------|---------|
| **Authentication** | Sign-in, sign-out, failures | Enabled |
| **MFA** | Setup, verification, reset | Enabled |
| **Password** | Change, reset, policy violations | Enabled |
| **Session** | Create, terminate, timeout | Enabled |
| **Admin Actions** | All admin operations | Enabled (cannot disable) |
| **OAuth** | Authorization, token issuance | Enabled |

### Log Retention

Configure retention periods (compliance requirements may mandate minimums):

| Log Type | Default | Minimum | Maximum |
|----------|---------|---------|---------|
| **Authentication** | 90 days | 30 days | 7 years |
| **Admin Actions** | 7 years | 1 year | 7 years |
| **Security Incidents** | 7 years | 7 years | 7 years |

### Compliance Reports

Generate pre-built compliance reports:

1. Navigate to **Platform Admin** → **Compliance** → **Reports**
2. Available reports:

| Report | Contents | Frequency |
|--------|----------|-----------|
| **Authentication Summary** | Sign-in stats, failure rates, MFA adoption | Weekly/Monthly |
| **Security Incidents** | Failed logins, lockouts, anomalies | Daily/Weekly |
| **SSO Health** | Provider status, cert expirations | Weekly |
| **User Access Review** | User permissions across tenants | Quarterly |
| **Admin Activity** | All platform admin actions | Monthly |

### SIEM Integration

Export logs to external SIEM systems:

1. Navigate to **Platform Admin** → **Compliance** → **Integrations**
2. Configure export:
   - **Destination**: S3 bucket, CloudWatch, or direct SIEM
   - **Format**: JSON, CEF, or LEEF
   - **Frequency**: Real-time, hourly, or daily batch
3. Test the integration
4. Enable export

---

## Emergency Procedures

### Security Incident Response

```mermaid
flowchart TD
    A[Incident Detected] --> B{Severity?}
    B -->|Critical| C[Immediate Lockdown]
    B -->|High| D[Targeted Response]
    B -->|Medium| E[Investigation]
    
    C --> F[Disable affected accounts]
    C --> G[Revoke all sessions]
    C --> H[Block IP ranges]
    
    D --> I[Reset affected passwords]
    D --> J[Require MFA re-enrollment]
    
    E --> K[Review audit logs]
    E --> L[Assess impact]
```

### Emergency Account Lockdown

To immediately lock down a compromised account:

1. Navigate to **Platform Admin** → **Emergency** → **Lockdown**
2. Enter the **user email** or **tenant ID**
3. Select lockdown scope:
   - **Single user**: Lock one account
   - **Tenant-wide**: Lock all users in a tenant
   - **Platform-wide**: Lock all non-admin users (extreme)
4. Confirm with your MFA code
5. Document the incident

### Emergency Access Bypass

For critical situations where normal auth is unavailable:

1. Contact the **on-call platform engineer**
2. Provide incident details and verification
3. The engineer can issue a **time-limited bypass token**
4. All bypass usage is logged and reviewed

> **Warning**: Emergency bypass is audited and should only be used for genuine emergencies.

### Credential Rotation

Rotate Cognito and OAuth secrets:

1. Navigate to **Platform Admin** → **Infrastructure** → **Secrets**
2. Select the credential to rotate
3. Click **Rotate**
4. Update any dependent systems
5. Verify functionality
6. Revoke the old credential

---

## Infrastructure Configuration

### Cognito Lambda Triggers

Custom logic hooks in the authentication flow:

| Trigger | Purpose | Example |
|---------|---------|---------|
| **Pre Sign-up** | Validate/modify registration | Block disposable emails |
| **Post Confirmation** | Actions after verification | Create default workspace |
| **Pre Authentication** | Before password verification | Check IP allowlist |
| **Post Authentication** | After successful auth | Log custom metrics |
| **Pre Token Generation** | Customize token claims | Add tenant context |

### Email Templates

Customize authentication emails:

1. Navigate to **Platform Admin** → **Infrastructure** → **Email Templates**
2. Available templates:

| Template | Trigger |
|----------|---------|
| **Verification** | New user email verification |
| **Password Reset** | Forgot password request |
| **MFA Setup** | MFA enrollment confirmation |
| **Security Alert** | Suspicious activity detected |
| **Session Alert** | New device sign-in |

3. Customize:
   - Subject line
   - Body content (HTML + plain text)
   - Sender name
4. Preview and test before saving

### Multi-Region Configuration

For global deployments:

| Setting | Description |
|---------|-------------|
| **Primary region** | Main Cognito pool location |
| **Replica regions** | Read replicas for lower latency |
| **Failover** | Automatic failover on primary outage |

---

## Related Documentation

- [Authentication Overview](./overview.md)
- [Tenant Admin Guide](./tenant-admin-guide.md)
- [Security Architecture](../security/authentication-architecture.md)
- [OAuth Developer Guide](./oauth-guide.md)
- [Compliance Documentation](../COMPLIANCE.md)


---

## Part V: Tenant Admin Authentication

> **Version**: 5.52.29 | **Last Updated**: January 25, 2026 | **Audience**: Tenant Administrators

This guide covers authentication management for tenant administrators: configuring SSO, managing users, enforcing MFA policies, and handling security settings for your organization.

---

## Table of Contents

1. [Overview](#overview)
2. [Single Sign-On (SSO) Configuration](#single-sign-on-sso-configuration)
3. [User Management](#user-management)
4. [MFA Policies](#mfa-policies)
5. [Session Management](#session-management)
6. [Security Settings](#security-settings)
7. [Audit Logs](#audit-logs)
8. [OAuth Applications](#oauth-applications)
9. [Language & Localization](#language--localization)

---

## Overview

As a Tenant Administrator, you manage authentication for users within your organization. You have access to:

| Capability | Description |
|------------|-------------|
| **SSO Configuration** | Set up and manage enterprise identity providers |
| **User Management** | Invite, suspend, and remove users |
| **MFA Policies** | Require or recommend MFA for user groups |
| **Session Policies** | Configure timeout and concurrent session limits |
| **Security Monitoring** | View authentication logs and failed attempts |
| **OAuth Apps** | Manage third-party application access |

```mermaid
graph TB
    TA[Tenant Admin] --> SSO[SSO Config]
    TA --> UM[User Management]
    TA --> MFA[MFA Policies]
    TA --> SEC[Security Settings]
    TA --> AUDIT[Audit Logs]
    TA --> OAUTH[OAuth Apps]
    
    SSO --> Users
    UM --> Users
    MFA --> Users
    
    Users[Organization Users]
```

---

## Single Sign-On (SSO) Configuration

### Supported Protocols

| Protocol | Use Case | Providers |
|----------|----------|-----------|
| **SAML 2.0** | Enterprise IdPs | Okta, Azure AD, OneLogin, Ping |
| **OIDC** | Modern identity providers | Auth0, Google Workspace, custom |

### Setting Up SAML 2.0

1. Navigate to **Admin** → **Authentication** → **SSO**
2. Click **Configure SAML Provider**
3. Enter your identity provider details:

| Field | Description | Example |
|-------|-------------|---------|
| **IdP Entity ID** | Unique identifier from your IdP | `https://idp.yourcompany.com/entity` |
| **SSO URL** | Where users are redirected to sign in | `https://idp.yourcompany.com/sso` |
| **Certificate** | X.509 certificate for signature verification | Paste PEM-encoded certificate |
| **Name ID Format** | User identifier format | `emailAddress` (recommended) |

4. Download the **RADIANT Service Provider metadata** to import into your IdP
5. In your IdP, configure attribute mappings:

| IdP Attribute | RADIANT Attribute | Required |
|---------------|-------------------|----------|
| `email` | `email` | Yes |
| `firstName` | `given_name` | Yes |
| `lastName` | `family_name` | Yes |
| `groups` | `groups` | Optional |
| `department` | `department` | Optional |

6. Click **Test Connection** to verify the setup
7. Enable **SSO for new users** and/or **existing users**

```mermaid
sequenceDiagram
    participant User
    participant RADIANT
    participant IdP as Your IdP
    
    User->>RADIANT: Enter work email
    RADIANT->>RADIANT: Lookup SSO config
    RADIANT->>IdP: SAML AuthnRequest
    IdP->>User: Login page
    User->>IdP: Enter credentials
    IdP->>RADIANT: SAML Response
    RADIANT->>RADIANT: Validate & create session
    RADIANT->>User: Redirect to app
```

### Setting Up OIDC

1. Navigate to **Admin** → **Authentication** → **SSO**
2. Click **Configure OIDC Provider**
3. Enter your identity provider details:

| Field | Description | Example |
|-------|-------------|---------|
| **Issuer URL** | OIDC discovery endpoint | `https://idp.yourcompany.com` |
| **Client ID** | Application identifier | `abc123` |
| **Client Secret** | Application secret | (secure input) |
| **Scopes** | Requested permissions | `openid profile email` |

4. Configure the **redirect URI** in your IdP: `https://{your-domain}/api/auth/oidc/callback`
5. Click **Test Connection**
6. Enable for users

### SSO Options

| Option | Description | Default |
|--------|-------------|---------|
| **Auto-provision users** | Create users automatically on first SSO sign-in | Off |
| **Require SSO** | Disable password sign-in for SSO users | Off |
| **JIT group sync** | Sync group memberships from IdP | Off |
| **Allow bypass for admins** | Let tenant admins use password if SSO fails | On |

---

## User Management

### Inviting Users

1. Navigate to **Admin** → **Users**
2. Click **Invite User**
3. Enter the user's **email address**
4. Select their **role**:
   - **Member**: Standard user access
   - **Admin**: Can manage users and settings
   - **Owner**: Full tenant control
5. Optionally add to **groups**
6. Click **Send Invitation**

The user receives an email with a link to create their account.

### User Roles and Permissions

| Role | Users | Settings | Billing | SSO Config |
|------|-------|----------|---------|------------|
| **Member** | View self | View | — | — |
| **Admin** | Manage all | Manage | View | Configure |
| **Owner** | Manage all | Manage | Manage | Configure |

### Suspending Users

1. Navigate to **Admin** → **Users**
2. Find the user and click **⋮** → **Suspend**
3. Confirm the suspension

Suspended users:
- Cannot sign in
- Lose access to all applications
- Keep their data (can be restored)
- Can be unsuspended later

### Removing Users

1. Navigate to **Admin** → **Users**
2. Find the user and click **⋮** → **Remove**
3. Choose data handling:
   - **Transfer data**: Move to another user
   - **Archive data**: Keep for compliance
   - **Delete data**: Permanent removal (after retention period)
4. Confirm removal

---

## MFA Policies

### Policy Options

| Policy | Description | Applies To |
|--------|-------------|------------|
| **Required** | Users must set up MFA before accessing apps | Admins (always), or all users |
| **Encouraged** | Users see a prompt but can skip (for now) | Members |
| **Hidden** | MFA option not shown to these users | Standard users (default) |

### Configuring MFA Policy

1. Navigate to **Admin** → **Security** → **MFA Policy**
2. For each user role, select the policy:

| Role | Recommended Policy |
|------|-------------------|
| **Owner** | Required (cannot change) |
| **Admin** | Required (cannot change) |
| **Member** | Encouraged or Hidden |

3. Configure **grace period** for "Required" policy (days before enforcement)
4. Click **Save Policy**

### MFA Methods Allowed

Enable or disable MFA methods for your organization:

| Method | Description | Recommendation |
|--------|-------------|----------------|
| **TOTP** | Authenticator apps (Google, Microsoft, etc.) | Enable (most secure) |
| **Backup Codes** | 10 one-time recovery codes | Enable (for recovery) |
| **Trusted Devices** | Remember this device for 30 days | Enable (convenience) |

### Viewing MFA Status

1. Navigate to **Admin** → **Users**
2. The **MFA** column shows:
   - ✅ **Enabled**: MFA is set up
   - ⚠️ **Pending**: Required but not yet set up
   - — **Not available**: Policy is "Hidden"

### Resetting User MFA

If a user loses access to their authenticator:

1. Navigate to **Admin** → **Users**
2. Find the user and click **⋮** → **Reset MFA**
3. Confirm the reset

The user will need to set up MFA again on their next sign-in.

---

## Session Management

### Session Policies

Configure how long sessions last and concurrent session behavior:

| Setting | Description | Default |
|---------|-------------|---------|
| **Session timeout** | Inactivity before auto-logout | 7 days |
| **Absolute timeout** | Maximum session length | 30 days |
| **Concurrent sessions** | Max sessions per user | 5 |
| **Session on new device** | Require re-auth on new device | Yes |

### Viewing Active Sessions

1. Navigate to **Admin** → **Security** → **Active Sessions**
2. View all active sessions with:
   - User email
   - Device/browser info
   - Location (approximate)
   - Last activity
   - Session start time

### Terminating Sessions

To force a user to sign in again:

1. Find the session in **Active Sessions**
2. Click **Terminate**
3. The user is immediately logged out

To terminate all sessions for a user:

1. Navigate to **Admin** → **Users**
2. Find the user and click **⋮** → **Terminate All Sessions**

---

## Security Settings

### Password Policy

Configure password requirements for users who don't use SSO:

| Setting | Description | Default | Range |
|---------|-------------|---------|-------|
| **Minimum length** | Characters required | 12 | 8-128 |
| **Require uppercase** | At least one uppercase letter | Yes | — |
| **Require lowercase** | At least one lowercase letter | Yes | — |
| **Require number** | At least one digit | Yes | — |
| **Require special** | At least one symbol | Yes | — |
| **Password history** | Prevent reusing recent passwords | 5 | 0-24 |
| **Maximum age** | Days before password expires | 0 (never) | 0-365 |

### Account Lockout

Protect against brute-force attacks:

| Setting | Description | Default |
|---------|-------------|---------|
| **Lockout threshold** | Failed attempts before lockout | 5 |
| **Lockout duration** | Minutes until auto-unlock | 15 |
| **Reset counter after** | Minutes of no failed attempts | 10 |

### IP Restrictions

Limit access to specific IP ranges:

1. Navigate to **Admin** → **Security** → **IP Restrictions**
2. Click **Add Rule**
3. Enter an **IP address** or **CIDR range**
4. Select **Allow** or **Block**
5. Click **Save**

Example rules:
- `10.0.0.0/8` — Allow corporate network
- `192.168.1.100` — Allow specific IP
- `0.0.0.0/0` with Block — Block all (except allowed)

---

## Audit Logs

### Viewing Authentication Logs

1. Navigate to **Admin** → **Security** → **Audit Logs**
2. Filter by:
   - **Event type**: Sign-in, Sign-out, MFA, Password change, etc.
   - **User**: Specific user email
   - **Date range**: Custom time period
   - **Status**: Success, Failure

### Log Events Captured

| Event | Description | Details Logged |
|-------|-------------|----------------|
| `auth.signin.success` | Successful sign-in | User, device, location, method |
| `auth.signin.failed` | Failed sign-in attempt | User (if known), reason, IP |
| `auth.signout` | User signed out | User, session duration |
| `auth.mfa.setup` | MFA configured | User, method |
| `auth.mfa.verified` | MFA code accepted | User, method |
| `auth.mfa.failed` | MFA code rejected | User, attempt count |
| `auth.password.changed` | Password updated | User |
| `auth.password.reset` | Password reset via email | User, IP |
| `auth.session.terminated` | Session forcibly ended | User, by admin |

### Exporting Logs

1. Apply desired filters
2. Click **Export**
3. Select format: **CSV** or **JSON**
4. Download the file

Logs are retained for **90 days** by default (configurable per compliance requirements).

---

## OAuth Applications

Manage third-party applications that can access your organization's data.

### Viewing Connected Apps

1. Navigate to **Admin** → **Security** → **OAuth Applications**
2. View all authorized applications with:
   - Application name
   - Publisher
   - Permissions granted
   - Users who authorized
   - Last used

### Revoking App Access

To remove an application's access for all users:

1. Find the application in the list
2. Click **Revoke Access**
3. Confirm the revocation

All tokens for that application are immediately invalidated.

### App Permissions (Scopes)

| Scope | Access Level |
|-------|--------------|
| `read:profile` | User's name and email |
| `read:sessions` | User's Think Tank sessions |
| `write:sessions` | Create and modify sessions |
| `read:files` | User's uploaded files |
| `write:files` | Upload and delete files |
| `admin:users` | Manage organization users |

---

## Language & Localization

### Default Language

Set the default language for new users in your organization:

1. Navigate to **Admin** → **Settings** → **Localization**
2. Select **Default Language** from the dropdown
3. Click **Save**

### Available Languages

| Language | Code | Direction |
|----------|------|-----------|
| English | `en` | LTR |
| Spanish | `es` | LTR |
| French | `fr` | LTR |
| German | `de` | LTR |
| Japanese | `ja` | LTR |
| Korean | `ko` | LTR |
| Chinese (Simplified) | `zh-CN` | LTR |
| Chinese (Traditional) | `zh-TW` | LTR |
| **Arabic** | `ar` | **RTL** |
| *(14 more)* | — | — |

### Language Override

Users can override the default language in their personal settings.

---

## Related Documentation

- [Authentication Overview](./overview.md)
- [Platform Admin Guide](./platform-admin-guide.md)
- [MFA Setup Guide](./mfa-guide.md)
- [OAuth Developer Guide](./oauth-guide.md)
- [Security Architecture](../security/authentication-architecture.md)
- [Troubleshooting](./troubleshooting.md)


---

## Part VI: MFA Guide

> **Version**: 5.52.29 | **Last Updated**: January 25, 2026 | **Audience**: All Users

This guide covers setting up and using Multi-Factor Authentication (MFA) in RADIANT, including TOTP authenticator apps, backup codes, and trusted devices.

---

## Table of Contents

1. [What is MFA?](#what-is-mfa)
2. [Setting Up MFA](#setting-up-mfa)
3. [Using MFA](#using-mfa)
4. [Backup Codes](#backup-codes)
5. [Trusted Devices](#trusted-devices)
6. [Managing MFA](#managing-mfa)
7. [Troubleshooting](#troubleshooting)
8. [For Administrators](#for-administrators)

---

## What is MFA?

Multi-Factor Authentication (MFA) adds an extra layer of security to your account by requiring two things to sign in:

1. **Something you know**: Your password
2. **Something you have**: A code from your phone

```mermaid
flowchart LR
    A[Enter Password] --> B[Enter MFA Code]
    B --> C[Access Granted]
    
    subgraph "Two Factors"
        D[Password<br/>Something you know]
        E[Phone Code<br/>Something you have]
    end
```

Even if someone learns your password, they cannot access your account without also having your phone.

### Who Needs MFA?

| User Type | MFA Requirement |
|-----------|----------------|
| **Tenant Owners** | Always required |
| **Tenant Admins** | Always required |
| **Standard Users** | Depends on organization policy |
| **Platform Admins** | Always required (cannot disable) |

---

## Setting Up MFA

### Requirements

Before you begin, you need:

- A smartphone or tablet
- An authenticator app installed:
  - **Google Authenticator** (iOS/Android)
  - **Microsoft Authenticator** (iOS/Android)
  - **1Password** (iOS/Android/Desktop)
  - **Authy** (iOS/Android/Desktop)
  - **Any TOTP-compatible app**

### Step-by-Step Setup

1. **Sign in** to your RADIANT account
2. Navigate to **Account Settings** → **Security**
3. Click **Enable MFA** or **Set Up Two-Factor Authentication**

```mermaid
flowchart TD
    A[Click Enable MFA] --> B[Open Authenticator App]
    B --> C[Scan QR Code]
    C --> D[Enter 6-digit Code]
    D --> E{Code Valid?}
    E -->|Yes| F[MFA Enabled!]
    E -->|No| G[Try Again]
    G --> D
    F --> H[Save Backup Codes]
```

4. You'll see a **QR code** on screen
5. Open your **authenticator app** on your phone
6. Tap **+** or **Add Account**
7. Select **Scan QR Code**
8. Point your camera at the QR code
9. Your authenticator app will show a **6-digit code**
10. Enter the code in RADIANT
11. Click **Verify and Enable**

### Manual Entry (If QR Won't Scan)

If you cannot scan the QR code:

1. Click **Can't scan? Enter manually**
2. Copy the **secret key** shown
3. In your authenticator app, select **Enter manually** or **Enter setup key**
4. Enter:
   - **Account name**: Your email or "RADIANT"
   - **Secret key**: Paste the key you copied
   - **Time-based**: Yes (TOTP)
5. The app will start showing codes
6. Enter the current code in RADIANT

> **Important**: Never share your secret key with anyone!

---

## Using MFA

### Signing In with MFA

1. Enter your **email** and **password**
2. Click **Sign In**
3. You'll see the MFA verification screen
4. Open your **authenticator app**
5. Find your RADIANT account
6. Enter the current **6-digit code**
7. Click **Verify**

### MFA Code Tips

| Tip | Details |
|-----|---------|
| **Codes change every 30 seconds** | Wait for a new code if the current one is about to expire |
| **Codes are time-sensitive** | Your device clock must be accurate |
| **Each code works once** | You cannot reuse a code |
| **No spaces needed** | Enter `123456` not `123 456` |

---

## Backup Codes

Backup codes are emergency codes you can use if you lose access to your authenticator app.

### Getting Your Backup Codes

When you enable MFA, you receive **10 backup codes**. Each code can only be used **once**.

1. After enabling MFA, you'll see your backup codes
2. **Save them securely**:
   - Download as a file
   - Print them out
   - Store in a password manager
3. Click **I've saved my codes** to continue

### Using a Backup Code

1. On the MFA verification screen, click **Use a backup code**
2. Enter one of your backup codes
3. Click **Verify**
4. You're signed in, but that code is now used

### Regenerating Backup Codes

If you've used most of your codes or lost them:

1. Sign in to your account
2. Go to **Account Settings** → **Security**
3. Click **Regenerate Backup Codes**
4. Confirm with your current MFA code
5. Save your new codes (old codes are invalidated)

> **Warning**: Regenerating codes invalidates all previous backup codes!

---

## Trusted Devices

Skip MFA on devices you use regularly by marking them as trusted.

### Trusting a Device

1. After entering your MFA code, check **Trust this device for 30 days**
2. Click **Verify**
3. For the next 30 days, you won't need MFA on this device

```mermaid
flowchart TD
    A[Enter MFA Code] --> B{Trust Device?}
    B -->|Yes| C[Skip MFA for 30 days]
    B -->|No| D[Require MFA every time]
    C --> E[Signed In]
    D --> E
```

### Managing Trusted Devices

1. Go to **Account Settings** → **Security** → **Trusted Devices**
2. View all your trusted devices:
   - Device name/browser
   - Last used
   - Trust expiration
3. To remove trust, click **Remove** next to a device

### Trusted Device Limits

| Setting | Default |
|---------|---------|
| **Maximum trusted devices** | 5 |
| **Trust duration** | 30 days |
| **Trust auto-expires** | Yes, after 30 days |

If you reach the maximum, trusting a new device will remove the oldest trusted device.

---

## Managing MFA

### Viewing MFA Status

1. Go to **Account Settings** → **Security**
2. The MFA section shows:
   - ✅ **Enabled** or ❌ **Disabled**
   - Date MFA was enabled
   - Number of backup codes remaining

### Changing Your Authenticator App

To switch to a different authenticator app:

1. Go to **Account Settings** → **Security**
2. Click **Change Authenticator**
3. Enter your current MFA code to verify
4. Scan the new QR code with your new app
5. Enter a code from the new app
6. Click **Verify and Update**

Your old app will stop working for RADIANT.

### Disabling MFA

> **Note**: Admins may not be able to disable MFA due to security policies.

1. Go to **Account Settings** → **Security**
2. Click **Disable MFA**
3. Enter your current MFA code
4. Confirm the action
5. MFA is now disabled

---

## Troubleshooting

### "Invalid code" Error

**Possible causes:**
- Code has expired (codes last 30 seconds)
- Device clock is incorrect
- Wrong account in authenticator app

**Solutions:**

1. **Wait for a new code**: If the code is about to change, wait for the next one
2. **Check your device time**: Ensure your phone's time is set to automatic
   - **iOS**: Settings → General → Date & Time → Set Automatically
   - **Android**: Settings → System → Date & Time → Automatic
3. **Verify the account**: Make sure you're using the RADIANT entry, not a different service

### Lost Access to Authenticator App

**If you have backup codes:**
1. Click **Use a backup code** on the MFA screen
2. Enter one of your saved codes
3. Once signed in, set up a new authenticator app

**If you don't have backup codes:**
1. Click **Can't access your code?** on the MFA screen
2. Follow the account recovery process:
   - Verify your email
   - Answer security questions (if set up)
   - Wait for admin approval (if required)
3. Contact your organization's admin if self-recovery fails

### New Phone

Got a new phone? Here's how to transfer your MFA:

**Option 1: Before wiping old phone**
1. Sign in on a computer
2. Change your authenticator (see "Changing Your Authenticator App")
3. Set up the new app on your new phone

**Option 2: After wiping old phone**
1. Use a backup code to sign in
2. Set up MFA with your new phone
3. Save your new backup codes

**Option 3: Using Authy or 1Password**
These apps can sync across devices, so your codes transfer automatically.

### Clock Sync Issues

TOTP codes depend on accurate time. If codes consistently fail:

1. Enable automatic time on your device
2. If already enabled, toggle it off and on
3. Restart your authenticator app
4. Try again

---

## For Administrators

### MFA Enforcement

See the [Tenant Admin Guide](./tenant-admin-guide.md#mfa-policies) for configuring MFA policies.

### Resetting User MFA

If a user is locked out:

1. Navigate to **Admin** → **Users**
2. Find the user
3. Click **⋮** → **Reset MFA**
4. Confirm the action
5. The user will need to set up MFA again

### MFA Reports

View MFA adoption in your organization:

1. Navigate to **Admin** → **Security** → **MFA Report**
2. See:
   - Users with MFA enabled
   - Users without MFA
   - MFA methods in use
   - Recent MFA failures

---

## Security Best Practices

| Practice | Why |
|----------|-----|
| **Use a reputable authenticator app** | Avoid apps that backup codes to insecure locations |
| **Save backup codes offline** | Don't store them in email or cloud notes |
| **Don't share codes** | Codes are for your use only |
| **Review trusted devices regularly** | Remove devices you no longer use |
| **Enable biometric lock on your authenticator** | Adds another layer of protection |

---

## Related Documentation

- [Authentication Overview](./overview.md)
- [User Guide](./user-guide.md)
- [Tenant Admin Guide](./tenant-admin-guide.md)
- [Troubleshooting](./troubleshooting.md)


---

## Part VII: OAuth Guide

> **Version**: 5.52.29 | **Last Updated**: January 25, 2026 | **Audience**: Developers

This guide covers building third-party applications that integrate with RADIANT using OAuth 2.0, including authorization flows, scopes, token management, and best practices.

---

## Table of Contents

1. [Overview](#overview)
2. [Registering Your Application](#registering-your-application)
3. [Authorization Code Flow](#authorization-code-flow)
4. [Token Management](#token-management)
5. [Scopes and Permissions](#scopes-and-permissions)
6. [API Requests](#api-requests)
7. [Consent Screens](#consent-screens)
8. [Error Handling](#error-handling)
9. [Security Best Practices](#security-best-practices)
10. [Testing](#testing)

---

## Overview

RADIANT implements OAuth 2.0 to allow third-party applications to access user data with their consent.

```mermaid
sequenceDiagram
    participant User
    participant YourApp as Your App
    participant RADIANT
    
    User->>YourApp: Click "Connect to RADIANT"
    YourApp->>RADIANT: Redirect to authorization
    RADIANT->>User: Show consent screen
    User->>RADIANT: Grant permission
    RADIANT->>YourApp: Authorization code
    YourApp->>RADIANT: Exchange code for tokens
    RADIANT->>YourApp: Access + refresh tokens
    YourApp->>RADIANT: API requests with access token
    RADIANT->>YourApp: Protected resources
```

### Supported Flows

| Flow | Use Case | Client Type |
|------|----------|-------------|
| **Authorization Code + PKCE** | Web apps, mobile apps, SPAs | Public & Confidential |
| **Client Credentials** | Server-to-server (M2M) | Confidential only |

> **Note**: Implicit flow is not supported due to security concerns.

---

## Registering Your Application

### For Developer/Testing

1. Sign in to your RADIANT account (must be a tenant admin)
2. Navigate to **Admin** → **Integrations** → **OAuth Applications**
3. Click **Create Application**
4. Enter application details:

| Field | Description | Example |
|-------|-------------|---------|
| **Name** | Displayed to users | "My Awesome App" |
| **Description** | What your app does | "Sync your sessions with..." |
| **Website URL** | Your app's homepage | `https://myapp.com` |
| **Redirect URIs** | Where to return after auth | `https://myapp.com/callback` |
| **Logo** | 256x256 PNG/SVG | Upload file |

5. Click **Create**
6. **Save your credentials**:
   - **Client ID**: Public identifier
   - **Client Secret**: Keep this secret! (shown only once)

### For Production/Platform-Wide

Contact RADIANT to register a verified application that can be used across all tenants.

---

## Authorization Code Flow

The recommended flow for most applications.

### Step 1: Redirect to Authorization

Redirect the user to RADIANT's authorization endpoint:

```
GET https://{radiant-domain}/oauth/authorize
```

**Query Parameters:**

| Parameter | Required | Description |
|-----------|----------|-------------|
| `client_id` | Yes | Your application's client ID |
| `redirect_uri` | Yes | Must exactly match a registered URI |
| `response_type` | Yes | Always `code` |
| `scope` | Yes | Space-separated list of scopes |
| `state` | Yes | Random string for CSRF protection |
| `code_challenge` | Yes* | PKCE challenge (required for public clients) |
| `code_challenge_method` | Yes* | Always `S256` |

**Example:**

```javascript
// Generate PKCE verifier and challenge
const codeVerifier = generateRandomString(64);
const codeChallenge = base64URLEncode(sha256(codeVerifier));

// Build authorization URL
const authUrl = new URL('https://app.radiant.ai/oauth/authorize');
authUrl.searchParams.set('client_id', 'your-client-id');
authUrl.searchParams.set('redirect_uri', 'https://myapp.com/callback');
authUrl.searchParams.set('response_type', 'code');
authUrl.searchParams.set('scope', 'openid profile read:sessions');
authUrl.searchParams.set('state', generateRandomString(32));
authUrl.searchParams.set('code_challenge', codeChallenge);
authUrl.searchParams.set('code_challenge_method', 'S256');

// Store verifier and state for later
sessionStorage.setItem('pkce_verifier', codeVerifier);
sessionStorage.setItem('oauth_state', state);

// Redirect user
window.location.href = authUrl.toString();
```

### Step 2: User Grants Permission

RADIANT displays a consent screen showing:
- Your application's name and logo
- Requested permissions (scopes)
- The user's identity

The user can **Allow** or **Deny** the request.

### Step 3: Receive Authorization Code

After the user grants permission, RADIANT redirects back to your `redirect_uri`:

```
https://myapp.com/callback?code=AUTH_CODE&state=YOUR_STATE
```

**Verify the state parameter matches what you sent!**

### Step 4: Exchange Code for Tokens

```
POST https://{radiant-domain}/oauth/token
Content-Type: application/x-www-form-urlencoded
```

**Body Parameters:**

| Parameter | Required | Description |
|-----------|----------|-------------|
| `grant_type` | Yes | `authorization_code` |
| `code` | Yes | The authorization code received |
| `redirect_uri` | Yes | Same URI used in authorization |
| `client_id` | Yes | Your client ID |
| `client_secret` | Conditional | Required for confidential clients |
| `code_verifier` | Conditional | Required if PKCE was used |

**Example (Node.js):**

```javascript
const response = await fetch('https://app.radiant.ai/oauth/token', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/x-www-form-urlencoded',
  },
  body: new URLSearchParams({
    grant_type: 'authorization_code',
    code: authorizationCode,
    redirect_uri: 'https://myapp.com/callback',
    client_id: 'your-client-id',
    code_verifier: storedCodeVerifier, // From Step 1
  }),
});

const tokens = await response.json();
```

**Response:**

```json
{
  "access_token": "eyJhbGciOiJSUzI1NiIs...",
  "token_type": "Bearer",
  "expires_in": 3600,
  "refresh_token": "dGhpcyBpcyBhIHJlZnJlc2g...",
  "scope": "openid profile read:sessions",
  "id_token": "eyJhbGciOiJSUzI1NiIs..."
}
```

---

## Token Management

### Access Tokens

| Property | Value |
|----------|-------|
| **Type** | JWT |
| **Lifetime** | 1 hour (3600 seconds) |
| **Use** | Authorization header for API requests |

**Using the access token:**

```javascript
const response = await fetch('https://api.radiant.ai/v1/sessions', {
  headers: {
    'Authorization': `Bearer ${accessToken}`,
  },
});
```

### Refresh Tokens

| Property | Value |
|----------|-------|
| **Type** | Opaque string |
| **Lifetime** | 30 days (configurable) |
| **Use** | Obtain new access tokens |

**Refreshing tokens:**

```
POST https://{radiant-domain}/oauth/token
Content-Type: application/x-www-form-urlencoded

grant_type=refresh_token
&refresh_token=YOUR_REFRESH_TOKEN
&client_id=YOUR_CLIENT_ID
&client_secret=YOUR_CLIENT_SECRET
```

**Response:**

```json
{
  "access_token": "new_access_token...",
  "token_type": "Bearer",
  "expires_in": 3600,
  "refresh_token": "new_or_same_refresh_token..."
}
```

### Token Revocation

Revoke tokens when users disconnect your app:

```
POST https://{radiant-domain}/oauth/revoke
Content-Type: application/x-www-form-urlencoded

token=TOKEN_TO_REVOKE
&token_type_hint=refresh_token
&client_id=YOUR_CLIENT_ID
&client_secret=YOUR_CLIENT_SECRET
```

---

## Scopes and Permissions

Request only the scopes your application needs.

### Available Scopes

| Scope | Access | Description |
|-------|--------|-------------|
| `openid` | Identity | Required for OIDC, returns ID token |
| `profile` | Identity | User's name and avatar |
| `email` | Identity | User's email address |
| `read:sessions` | Sessions | List and view Think Tank sessions |
| `write:sessions` | Sessions | Create and modify sessions |
| `read:files` | Files | Access uploaded files |
| `write:files` | Files | Upload and delete files |
| `read:artifacts` | Artifacts | View generated artifacts |
| `write:artifacts` | Artifacts | Create and modify artifacts |
| `offline_access` | Tokens | Receive refresh tokens |

### Scope Combinations

**Minimal (identity only):**
```
scope=openid profile email
```

**Read-only access:**
```
scope=openid profile read:sessions read:files read:artifacts
```

**Full access:**
```
scope=openid profile email read:sessions write:sessions read:files write:files read:artifacts write:artifacts offline_access
```

---

## API Requests

### Base URL

```
https://api.radiant.ai/v1
```

### Authentication

Include the access token in the `Authorization` header:

```http
GET /v1/sessions HTTP/1.1
Host: api.radiant.ai
Authorization: Bearer eyJhbGciOiJSUzI1NiIs...
```

### Example Requests

**Get current user:**

```javascript
const user = await fetch('https://api.radiant.ai/v1/me', {
  headers: { 'Authorization': `Bearer ${accessToken}` },
}).then(r => r.json());

// Response:
// {
//   "id": "user_abc123",
//   "email": "user@example.com",
//   "name": "Jane Doe",
//   "avatar_url": "https://..."
// }
```

**List sessions:**

```javascript
const sessions = await fetch('https://api.radiant.ai/v1/sessions', {
  headers: { 'Authorization': `Bearer ${accessToken}` },
}).then(r => r.json());

// Response:
// {
//   "data": [
//     { "id": "sess_123", "title": "Project Planning", "created_at": "..." },
//     ...
//   ],
//   "has_more": true,
//   "next_cursor": "..."
// }
```

See the [API Reference](../api/authentication-api.md) for complete endpoint documentation.

---

## Consent Screens

### What Users See

The consent screen displays:

```
┌────────────────────────────────────────┐
│                                        │
│         [Your App Logo]                │
│                                        │
│    "My Awesome App" wants to           │
│    access your RADIANT account         │
│                                        │
│    This will allow the app to:         │
│    ✓ See your profile information      │
│    ✓ View your Think Tank sessions     │
│    ✓ Create new sessions               │
│                                        │
│    [Deny]              [Allow]         │
│                                        │
│    Signed in as: user@example.com      │
│                                        │
└────────────────────────────────────────┘
```

### Improving Consent Experience

| Do | Don't |
|----|-------|
| Request minimal scopes | Request all scopes "just in case" |
| Use a clear app name | Use technical/internal names |
| Provide a recognizable logo | Use a generic placeholder |
| Explain why you need access | Leave users guessing |

---

## Error Handling

### Authorization Errors

Errors during authorization redirect to your `redirect_uri` with error parameters:

```
https://myapp.com/callback?error=access_denied&error_description=User%20denied%20access&state=YOUR_STATE
```

| Error | Description |
|-------|-------------|
| `invalid_request` | Missing or invalid parameters |
| `unauthorized_client` | Client not allowed to use this flow |
| `access_denied` | User denied permission |
| `unsupported_response_type` | Invalid `response_type` |
| `invalid_scope` | Unknown or invalid scopes |
| `server_error` | Internal error |

### Token Errors

Token endpoint returns JSON errors:

```json
{
  "error": "invalid_grant",
  "error_description": "Authorization code has expired"
}
```

| Error | Description |
|-------|-------------|
| `invalid_request` | Missing required parameter |
| `invalid_client` | Client authentication failed |
| `invalid_grant` | Code expired, already used, or invalid |
| `unauthorized_client` | Client not authorized for this grant |
| `unsupported_grant_type` | Invalid grant type |

### API Errors

API requests return standard HTTP errors:

| Status | Meaning | Action |
|--------|---------|--------|
| `401` | Token invalid or expired | Refresh the token |
| `403` | Insufficient scope | Request additional scopes |
| `429` | Rate limited | Back off and retry |

---

## Security Best Practices

### Must Do

| Practice | Why |
|----------|-----|
| **Always use HTTPS** | Protect tokens in transit |
| **Always use PKCE** | Prevent code interception attacks |
| **Validate state parameter** | Prevent CSRF attacks |
| **Store secrets securely** | Never expose client secret in frontend code |
| **Use short-lived tokens** | Limit damage from token theft |

### Token Storage

| Client Type | Recommended Storage |
|-------------|---------------------|
| **Web (SPA)** | Memory (not localStorage) or secure httpOnly cookie |
| **Web (Server)** | Server-side session or encrypted database |
| **Mobile** | Secure keychain (iOS) / Keystore (Android) |
| **Desktop** | OS credential storage |

### Redirect URI Security

- Use exact matching (no wildcards in production)
- Always use HTTPS (except `http://localhost` for development)
- Avoid open redirectors

---

## Testing

### Development Redirect URIs

You can register `http://localhost:*` for development:

```
http://localhost:3000/callback
http://localhost:8080/auth/callback
```

### Test Users

Create test users in your tenant for development:

1. Navigate to **Admin** → **Users** → **Invite User**
2. Invite yourself with a `+test` email alias (e.g., `you+test@company.com`)
3. Use this account for OAuth testing

### Debugging Tips

1. **Inspect tokens**: Use [jwt.io](https://jwt.io) to decode and inspect JWTs
2. **Check scopes**: Verify the token contains expected scopes in the `scope` claim
3. **Verify signatures**: Ensure tokens are signed correctly
4. **Monitor logs**: Check your app logs for OAuth errors

### Token Inspection Endpoint

```
GET https://{radiant-domain}/oauth/tokeninfo?token=ACCESS_TOKEN
```

Response:
```json
{
  "active": true,
  "client_id": "your-client-id",
  "scope": "openid profile read:sessions",
  "sub": "user_abc123",
  "exp": 1706234567,
  "iat": 1706230967
}
```

---

## Code Examples

### Complete Node.js Example

```javascript
const express = require('express');
const crypto = require('crypto');

const app = express();

const CLIENT_ID = 'your-client-id';
const CLIENT_SECRET = 'your-client-secret';
const REDIRECT_URI = 'http://localhost:3000/callback';
const RADIANT_DOMAIN = 'https://app.radiant.ai';

// Generate PKCE challenge
function generatePKCE() {
  const verifier = crypto.randomBytes(32).toString('base64url');
  const challenge = crypto
    .createHash('sha256')
    .update(verifier)
    .digest('base64url');
  return { verifier, challenge };
}

// Step 1: Start OAuth flow
app.get('/login', (req, res) => {
  const { verifier, challenge } = generatePKCE();
  const state = crypto.randomBytes(16).toString('hex');
  
  // Store for later verification
  req.session.pkceVerifier = verifier;
  req.session.oauthState = state;
  
  const authUrl = new URL(`${RADIANT_DOMAIN}/oauth/authorize`);
  authUrl.searchParams.set('client_id', CLIENT_ID);
  authUrl.searchParams.set('redirect_uri', REDIRECT_URI);
  authUrl.searchParams.set('response_type', 'code');
  authUrl.searchParams.set('scope', 'openid profile read:sessions');
  authUrl.searchParams.set('state', state);
  authUrl.searchParams.set('code_challenge', challenge);
  authUrl.searchParams.set('code_challenge_method', 'S256');
  
  res.redirect(authUrl.toString());
});

// Step 2-4: Handle callback
app.get('/callback', async (req, res) => {
  const { code, state, error } = req.query;
  
  // Check for errors
  if (error) {
    return res.status(400).send(`OAuth error: ${error}`);
  }
  
  // Verify state
  if (state !== req.session.oauthState) {
    return res.status(400).send('State mismatch');
  }
  
  // Exchange code for tokens
  const tokenResponse = await fetch(`${RADIANT_DOMAIN}/oauth/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      redirect_uri: REDIRECT_URI,
      client_id: CLIENT_ID,
      client_secret: CLIENT_SECRET,
      code_verifier: req.session.pkceVerifier,
    }),
  });
  
  const tokens = await tokenResponse.json();
  
  if (tokens.error) {
    return res.status(400).send(`Token error: ${tokens.error}`);
  }
  
  // Store tokens securely
  req.session.accessToken = tokens.access_token;
  req.session.refreshToken = tokens.refresh_token;
  
  res.redirect('/dashboard');
});

app.listen(3000);
```

---

## Related Documentation

- [Authentication Overview](./overview.md)
- [API Reference](../api/authentication-api.md)
- [Tenant Admin Guide](./tenant-admin-guide.md)
- [Security Architecture](../security/authentication-architecture.md)


---

## Part VIII: Internationalization

> **Version**: 5.52.29 | **Last Updated**: January 25, 2026 | **Audience**: All Users & Developers

This guide covers RADIANT's internationalization features, including 18 supported languages, RTL support for Arabic, and multi-language search with CJK (Chinese, Japanese, Korean) support.

---

## Table of Contents

1. [Overview](#overview)
2. [Supported Languages](#supported-languages)
3. [Changing Your Language](#changing-your-language)
4. [Right-to-Left (RTL) Support](#right-to-left-rtl-support)
5. [Multi-Language Search](#multi-language-search)
6. [For Developers](#for-developers)
7. [For Administrators](#for-administrators)

---

## Overview

RADIANT supports 18 languages across all applications, with special handling for:

- **Right-to-Left (RTL)** languages like Arabic
- **CJK (Chinese, Japanese, Korean)** languages with bi-gram search
- **Locale-specific** date, time, and number formatting

```mermaid
graph TB
    subgraph "Language Features"
        L[18 Languages]
        RTL[RTL Support]
        CJK[CJK Search]
        FMT[Locale Formatting]
    end
    
    subgraph "Applications"
        TT[Think Tank]
        CU[Curator]
        TA[Tenant Admin]
        RA[RADIANT Admin]
    end
    
    L --> TT
    L --> CU
    L --> TA
    L --> RA
    
    RTL --> TT
    RTL --> CU
    RTL --> TA
    RTL --> RA
```

---

## Supported Languages

RADIANT supports 18 languages with varying levels of full-text search support:

| Language | Code | Native Name | Direction | Search Method |
|----------|------|-------------|-----------|---------------|
| English | `en` | English | LTR | PostgreSQL FTS |
| Spanish | `es` | Español | LTR | PostgreSQL FTS |
| French | `fr` | Français | LTR | PostgreSQL FTS |
| German | `de` | Deutsch | LTR | PostgreSQL FTS |
| Portuguese | `pt` | Português | LTR | PostgreSQL FTS |
| Italian | `it` | Italiano | LTR | PostgreSQL FTS |
| Dutch | `nl` | Nederlands | LTR | PostgreSQL FTS |
| Polish | `pl` | Polski | LTR | PostgreSQL `simple` |
| Russian | `ru` | Русский | LTR | PostgreSQL FTS |
| Turkish | `tr` | Türkçe | LTR | PostgreSQL FTS |
| Japanese | `ja` | 日本語 | LTR | `pg_bigm` bi-gram |
| Korean | `ko` | 한국어 | LTR | `pg_bigm` bi-gram |
| Chinese (Simplified) | `zh-CN` | 简体中文 | LTR | `pg_bigm` bi-gram |
| Chinese (Traditional) | `zh-TW` | 繁體中文 | LTR | `pg_bigm` bi-gram |
| **Arabic** | `ar` | العربية | **RTL** | PostgreSQL `simple` |
| Hindi | `hi` | हिन्दी | LTR | PostgreSQL `simple` |
| Thai | `th` | ไทย | LTR | PostgreSQL `simple` |
| Vietnamese | `vi` | Tiếng Việt | LTR | PostgreSQL `simple` |

### Language Detection

RADIANT automatically detects the primary language of your content for optimal search indexing:

```mermaid
flowchart TD
    A[User Input] --> B{Detect Language}
    B -->|CJK Characters| C[Use pg_bigm]
    B -->|Arabic Script| D[Use simple FTS]
    B -->|Latin/Cyrillic| E[Use Native FTS]
    
    C --> F[Bi-gram Indexing]
    D --> G[Simple Tokenization]
    E --> H[Stemming + Stop Words]
```

---

## Changing Your Language

### In Think Tank / Curator

1. Click your **avatar** in the top-right corner
2. Select **Settings**
3. Click **Language & Region**
4. Select your preferred **language** from the dropdown
5. The interface updates immediately

### In Tenant Admin / RADIANT Admin

1. Click your **avatar** in the top-right corner
2. Select **Account Settings**
3. Navigate to **Preferences** → **Language**
4. Select your language
5. Click **Save**

### During Sign-In

The sign-in page automatically detects your browser language. To change it:

1. Look for the **language selector** (usually bottom of the page)
2. Click and select your language
3. The sign-in page reloads in your language

---

## Right-to-Left (RTL) Support

When using Arabic, the entire interface automatically adapts:

### What Changes

| Element | RTL Behavior |
|---------|--------------|
| **Text direction** | Flows right-to-left |
| **Navigation** | Moves to the right side |
| **Icons** | Directional icons are mirrored |
| **Buttons** | Order is reversed |
| **Forms** | Labels and inputs are flipped |
| **Tables** | Columns flow right-to-left |

### What Stays Left-to-Right

Certain elements remain LTR for clarity:

| Element | Reason |
|---------|--------|
| **Email addresses** | Standard format worldwide |
| **URLs** | Technical format |
| **Code blocks** | Programming languages are LTR |
| **Passwords** | Consistency and security |
| **Phone numbers** | International format |
| **MFA codes** | Numeric sequences |

### Visual Example

```
┌─────────────────────────────────────────────────────┐
│ LTR Layout (English)                                │
├─────────────────────────────────────────────────────┤
│ [Logo] Navigation ────────────────────  [Avatar ▼] │
│                                                     │
│ [Sidebar]  │  Main Content Area                    │
│            │                                        │
│            │  Form Label: [Input Field        ]    │
│            │  [Cancel]              [Submit ➔]     │
│                                                     │
└─────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────┐
│ RTL Layout (Arabic)                                 │
├─────────────────────────────────────────────────────┤
│ [▼ الملف] ────────────────────  التنقل [الشعار]   │
│                                                     │
│                    │  [الشريط الجانبي]              │
│  منطقة المحتوى الرئيسية                            │
│                                                     │
│ [        حقل الإدخال] :تسمية النموذج               │
│ [←إرسال]              [إلغاء]                      │
│                                                     │
└─────────────────────────────────────────────────────┘
```

---

## Multi-Language Search

RADIANT provides intelligent search across all supported languages.

### How It Works

```mermaid
flowchart LR
    subgraph "Search Query"
        Q[User Query]
    end
    
    subgraph "Language Detection"
        D{Detect Script}
    end
    
    subgraph "Search Strategy"
        FTS[PostgreSQL FTS<br/>Stemming, ranking]
        BIGM[pg_bigm<br/>Bi-gram matching]
        SIMPLE[Simple FTS<br/>Basic tokenization]
    end
    
    Q --> D
    D -->|"Latin (en,es,fr...)"| FTS
    D -->|"CJK (ja,ko,zh)"| BIGM
    D -->|"Arabic, Hindi..."| SIMPLE
```

### CJK Search (Chinese, Japanese, Korean)

CJK languages don't have word boundaries, so traditional full-text search doesn't work. RADIANT uses **bi-gram indexing** (`pg_bigm`):

| Feature | Description |
|---------|-------------|
| **No word segmentation needed** | Works without dictionaries |
| **Substring matching** | Find partial words/phrases |
| **Mixed-language support** | Search CJK + English together |
| **Fuzzy matching** | Find similar terms |

**Example:**

Searching for `人工知能` (artificial intelligence) finds:
- Exact matches: `人工知能`
- Partial matches: `人工知能技術` (AI technology)
- Mixed: `AIと人工知能の違い` (Difference between AI and artificial intelligence)

### Western Language Search

For Latin-script and Cyrillic languages, RADIANT uses PostgreSQL's native full-text search:

| Feature | Description |
|---------|-------------|
| **Stemming** | "running" matches "run", "runs" |
| **Stop words** | Common words ("the", "is") are ignored |
| **Ranking** | Results sorted by relevance |
| **Phrase search** | `"exact phrase"` matching |

### Search Tips by Language

| Language | Tip |
|----------|-----|
| **English** | Use quotes for exact phrases: `"machine learning"` |
| **Spanish** | Accents are normalized: `café` = `cafe` |
| **German** | Compound words are split: `Softwareentwicklung` |
| **Japanese** | Hiragana, katakana, and kanji all work |
| **Chinese** | Both simplified and traditional are indexed |
| **Korean** | Hangul syllables are bi-gram indexed |
| **Arabic** | Diacritics are normalized |

---

## For Developers

### Using Translations in Code

**React (Admin Dashboard):**

```typescript
import { useTranslation } from '@/hooks/useTranslation';

function MyComponent() {
  const { t, language, setLanguage, isRTL } = useTranslation();
  
  return (
    <div dir={isRTL ? 'rtl' : 'ltr'}>
      <h1>{t('auth.login.title')}</h1>
      <p>{t('auth.login.description')}</p>
      <button>{t('common.submit')}</button>
    </div>
  );
}
```

**Translation Files Structure:**

```
locales/
├── auth/
│   ├── en.json
│   ├── es.json
│   ├── fr.json
│   ├── ja.json
│   ├── ko.json
│   ├── zh-CN.json
│   ├── ar.json
│   └── ...
└── index.ts
```

**Example Translation File (`en.json`):**

```json
{
  "auth": {
    "login": {
      "title": "Sign In",
      "description": "Welcome back! Please sign in to continue.",
      "email_placeholder": "Enter your email",
      "password_placeholder": "Enter your password",
      "submit": "Sign In",
      "forgot_password": "Forgot password?",
      "no_account": "Don't have an account?",
      "sign_up": "Sign up"
    },
    "mfa": {
      "title": "Two-Factor Authentication",
      "enter_code": "Enter the 6-digit code from your authenticator app",
      "verify": "Verify",
      "use_backup": "Use a backup code"
    }
  },
  "common": {
    "submit": "Submit",
    "cancel": "Cancel",
    "save": "Save",
    "delete": "Delete",
    "loading": "Loading...",
    "error": "An error occurred"
  }
}
```

### RTL CSS Utilities

**RTL-aware CSS classes (`rtl.css`):**

```css
/* Automatic margin/padding flipping */
[dir="rtl"] .ml-4 { margin-left: 0; margin-right: 1rem; }
[dir="rtl"] .mr-4 { margin-right: 0; margin-left: 1rem; }
[dir="rtl"] .pl-4 { padding-left: 0; padding-right: 1rem; }
[dir="rtl"] .pr-4 { padding-right: 0; padding-left: 1rem; }

/* Text alignment flipping */
[dir="rtl"] .text-left { text-align: right; }
[dir="rtl"] .text-right { text-align: left; }

/* Flex direction flipping */
[dir="rtl"] .flex-row { flex-direction: row-reverse; }

/* Preserve LTR for specific content */
.ltr-preserve {
  direction: ltr !important;
  unicode-bidi: embed;
}

/* Apply to emails, codes, passwords */
input[type="email"],
input[type="password"],
.code-input,
.mfa-code {
  direction: ltr;
  text-align: left;
}
```

### useRTL Hook

```typescript
import { useRTL } from '@/hooks/useRTL';

function MyComponent() {
  const { isRTL, dir, flipMargin, flipPadding, flipTextAlign } = useRTL();
  
  return (
    <div 
      dir={dir}
      className={`${flipMargin('ml-4')} ${flipTextAlign('text-left')}`}
    >
      {/* Content */}
    </div>
  );
}
```

### Multi-Language Search API

```typescript
// Search with automatic language detection
const results = await searchService.search({
  query: '人工知能', // Japanese
  tenantId: 'tenant_123',
  // Language is auto-detected, but can be overridden:
  // languageHint: 'ja'
});

// Results include detected language
console.log(results.detectedLanguage); // 'ja'
console.log(results.searchMethod); // 'pg_bigm'
```

---

## For Administrators

### Setting Default Language

**Tenant Admins:**

1. Navigate to **Admin** → **Settings** → **Localization**
2. Set **Default Language** for new users
3. Set **Fallback Language** (used when translation is missing)
4. Click **Save**

**Platform Admins:**

1. Navigate to **Platform Admin** → **Configuration** → **Localization**
2. Set platform-wide defaults
3. Enable/disable languages per tenant tier

### Translation Management

**Viewing Translation Coverage:**

1. Navigate to **Admin** → **Settings** → **Localization** → **Coverage**
2. View translation status by language:
   - ✅ **100%** - Fully translated
   - 🟡 **90%+** - Nearly complete
   - 🔴 **<90%** - Missing translations

### Custom Translations

Tenants can override default translations:

1. Navigate to **Admin** → **Settings** → **Localization** → **Custom**
2. Select a language
3. Search for the key to override
4. Enter your custom translation
5. Click **Save**

Custom translations take precedence over defaults.

### Search Configuration

**Enabling CJK Search:**

CJK search requires the `pg_bigm` PostgreSQL extension. This is automatically configured for all tenants.

**Search Indexing:**

Content is automatically indexed in the detected language. To re-index:

1. Navigate to **Admin** → **Settings** → **Search**
2. Click **Rebuild Index**
3. Wait for indexing to complete (can take several minutes)

---

## Related Documentation

- [Authentication Overview](./overview.md)
- [User Guide](./user-guide.md)
- [Search API Reference](../api/search-api.md)
- [Section 41: Internationalization](../sections/SECTION-41-INTERNATIONALIZATION.md)


---

## Part IX: Auth Troubleshooting

> **Version**: 5.52.29 | **Last Updated**: January 25, 2026 | **Audience**: All Users & Administrators

This guide helps resolve common authentication issues in RADIANT.

---

## Table of Contents

1. [Sign-In Issues](#sign-in-issues)
2. [Password Problems](#password-problems)
3. [MFA Issues](#mfa-issues)
4. [SSO Problems](#sso-problems)
5. [Session Issues](#session-issues)
6. [OAuth/Integration Issues](#oauthintegration-issues)
7. [Language/Display Issues](#languagedisplay-issues)
8. [Administrator Troubleshooting](#administrator-troubleshooting)
9. [Getting Help](#getting-help)

---

## Sign-In Issues

### "Invalid email or password"

**Symptoms:** Error message after entering credentials

**Possible Causes:**
| Cause | Solution |
|-------|----------|
| Incorrect password | Passwords are case-sensitive. Check Caps Lock |
| Wrong email address | Verify you're using the correct email |
| Account not verified | Check email for verification link |
| Account suspended | Contact your administrator |
| Using SSO email with password | Use the SSO sign-in flow instead |

**Steps to Resolve:**
1. Double-check your email address for typos
2. Try resetting your password via "Forgot password?"
3. Check your email (including spam) for verification links
4. Contact your admin if the issue persists

### "Account locked"

**Symptoms:** Cannot sign in, message says account is locked

**Cause:** Too many failed sign-in attempts (typically 5+)

**Solutions:**
1. **Wait** - Accounts auto-unlock after 15 minutes
2. **Reset password** - Use "Forgot password?" to unlock immediately
3. **Contact admin** - They can manually unlock your account

### "Your session has expired"

**Symptoms:** Redirected to sign-in page while working

**Cause:** Session timeout due to inactivity or maximum session length reached

**Solutions:**
1. Sign in again - your work should be saved
2. If this happens frequently, contact your admin about session policies

### "Sign-in not allowed"

**Symptoms:** Error after entering valid credentials

**Possible Causes:**
| Cause | Solution |
|-------|----------|
| IP restrictions | Connect from an allowed network/VPN |
| Account disabled | Contact your administrator |
| SSO required | Use your organization's SSO instead |
| Tenant suspended | Contact RADIANT support |

---

## Password Problems

### "Password does not meet requirements"

**Symptoms:** Cannot set new password

**Requirements (typical):**
- Minimum 12 characters
- At least 1 uppercase letter (A-Z)
- At least 1 lowercase letter (a-z)
- At least 1 number (0-9)
- At least 1 special character (!@#$%^&*)
- Cannot be a previously used password

**Tips for Strong Passwords:**
- Use a passphrase: `Coffee-Mountain-7Blue!`
- Use a password manager to generate random passwords
- Avoid personal information (birthdays, names)

### "Password reset link expired"

**Symptoms:** Clicking reset link shows error

**Cause:** Reset links expire after 24 hours

**Solution:**
1. Go to the sign-in page
2. Click "Forgot password?" again
3. Request a new reset link
4. Use the new link within 24 hours

### Not receiving password reset email

**Possible Causes:**
| Cause | Solution |
|-------|----------|
| Email in spam/junk | Check spam folder |
| Wrong email entered | Try again with correct email |
| Email delivery delay | Wait 5-10 minutes |
| Email system issues | Contact admin |

**Note:** For security, we show the same message whether the email exists or not.

---

## MFA Issues

### "Invalid code"

**Symptoms:** MFA code is rejected

**Possible Causes & Solutions:**

| Cause | Solution |
|-------|----------|
| Code expired | Wait for new code (changes every 30 seconds) |
| Device clock incorrect | Enable automatic time sync |
| Wrong account | Verify using RADIANT entry in your app |
| Already used | Each code works only once |

**Fix Clock Sync:**
- **iOS:** Settings → General → Date & Time → Set Automatically
- **Android:** Settings → System → Date & Time → Automatic
- **Windows:** Settings → Time & Language → Sync now
- **Mac:** System Preferences → Date & Time → Set automatically

### Lost access to authenticator app

**If you have backup codes:**
1. On the MFA screen, click "Use a backup code"
2. Enter one of your saved backup codes
3. Sign in and set up a new authenticator

**If you don't have backup codes:**
1. Click "Can't access your code?"
2. Follow the recovery process
3. You may need admin assistance

### "MFA required" but I didn't enable it

**Cause:** Your organization enforces MFA for your role

**Solution:**
1. Follow the MFA setup prompts
2. This is required - you cannot skip it
3. Contact your admin if you have questions

### New phone - how to transfer MFA?

**Best approach (before wiping old phone):**
1. Sign in on a computer
2. Go to Account Settings → Security
3. Click "Change Authenticator"
4. Set up MFA on your new phone
5. Your old phone's entry will stop working

**If old phone is already wiped:**
1. Use a backup code to sign in
2. Set up MFA fresh on your new phone

---

## SSO Problems

### "SSO configuration not found"

**Symptoms:** Error when trying to sign in with work email

**Possible Causes:**
| Cause | Solution |
|-------|----------|
| SSO not configured | Contact your IT admin |
| Using wrong email domain | Use your work email, not personal |
| SSO temporarily disabled | Contact your IT admin |

### "SAML assertion invalid"

**Symptoms:** Error after authenticating with your identity provider

**Possible Causes:**
- Certificate mismatch
- Clock skew between systems
- Attribute mapping issues

**Solutions:**
1. Try again - sometimes temporary
2. Clear browser cookies and cache
3. Contact your IT admin to check SSO configuration

### Stuck in redirect loop

**Symptoms:** Page keeps redirecting between RADIANT and identity provider

**Solutions:**
1. Clear all cookies for both sites
2. Try incognito/private browser window
3. Disable browser extensions temporarily
4. Contact IT admin if persists

### "User not provisioned"

**Symptoms:** SSO authentication succeeds but RADIANT denies access

**Cause:** Your account doesn't exist in RADIANT yet

**Solutions:**
1. Contact your organization admin to provision your account
2. If auto-provisioning should be enabled, admin needs to check SSO settings

---

## Session Issues

### Logged out unexpectedly

**Possible Causes:**
| Cause | Explanation |
|-------|-------------|
| Inactivity timeout | Session ended due to no activity |
| Absolute timeout | Maximum session length reached |
| Admin terminated session | Your admin ended your session |
| Signed in elsewhere | Concurrent session limit reached |
| Password changed | All sessions end when password changes |

### Can't stay signed in

**Possible Causes:**
| Cause | Solution |
|-------|----------|
| Cookies blocked | Enable cookies for RADIANT domain |
| Private browsing | Sessions don't persist in incognito |
| Browser settings | Check "clear cookies on close" |
| Strict session policy | Normal for high-security environments |

### Signed in on wrong account

**Solution:**
1. Click your avatar → Sign Out
2. Sign in with the correct account

---

## OAuth/Integration Issues

### "Invalid redirect URI"

**Symptoms:** Error when authorizing a third-party app

**Cause:** The app's callback URL doesn't match registered URIs

**Solutions:**
- **For users:** Contact the app developer
- **For developers:** Ensure redirect URI exactly matches registration

### "Invalid client"

**Symptoms:** OAuth authorization fails immediately

**Cause:** Client ID is incorrect or application is disabled

**Solutions:**
- **For users:** Contact the app developer
- **For developers:** Verify client ID and check if app is active

### "Access denied"

**Symptoms:** You clicked "Allow" but got an error

**Possible Causes:**
| Cause | Solution |
|-------|----------|
| Scope not allowed | App requesting unauthorized permissions |
| App suspended | Contact app developer |
| Tenant doesn't allow app | Contact your admin |

### Revoking app access

To disconnect a third-party app:
1. Go to Account Settings → Connected Apps
2. Find the app
3. Click "Revoke" or "Disconnect"
4. Confirm

---

## Language/Display Issues

### Interface in wrong language

**Solutions:**
1. Click avatar → Settings → Language
2. Select your preferred language
3. Interface updates immediately

### RTL layout issues

**Symptoms:** Arabic text displays incorrectly

**Possible Causes:**
| Cause | Solution |
|-------|----------|
| Browser override | Check browser language settings |
| CSS not loaded | Hard refresh (Ctrl+Shift+R / Cmd+Shift+R) |
| Mixed content | Some elements intentionally stay LTR |

### Characters not displaying

**Symptoms:** Boxes (□) or question marks (?) instead of text

**Solutions:**
1. Ensure your system has fonts for that language
2. Try a different browser
3. Check if the page is loading completely

---

## Administrator Troubleshooting

### User can't sign in (Admin view)

**Diagnostic steps:**
1. Check user status (active, suspended, pending?)
2. Check for recent failed login attempts
3. Verify user is in correct tenant
4. Check IP restriction rules
5. Review audit logs for errors

**Common fixes:**
- Reset user's password
- Reset user's MFA
- Unlock account
- Clear IP restriction (if applicable)

### SSO not working for tenant

**Diagnostic steps:**
1. Verify SSO configuration in Admin → Authentication → SSO
2. Check certificate expiration
3. Test with "Test Connection" button
4. Review SSO-specific audit logs
5. Verify attribute mappings

**Common fixes:**
- Update expired certificate
- Correct attribute mappings
- Enable SSO for user accounts
- Check IdP configuration

### High failure rate in authentication logs

**Investigation:**
1. Check for bot/attack patterns (same IP, many users)
2. Verify recent configuration changes
3. Check if legitimate service accounts are failing
4. Review rate limiting effectiveness

**Actions:**
- Enable/increase rate limiting
- Block suspicious IPs
- Alert affected users
- Consider enabling CAPTCHA

### MFA adoption is low

**Strategies:**
1. Change policy from "Hidden" to "Encouraged"
2. Send communication about MFA benefits
3. Set a deadline for "Required" enforcement
4. Provide help resources for setup

---

## Getting Help

### Self-Service Resources

| Resource | Description |
|----------|-------------|
| This guide | Common issues and solutions |
| In-app help | Click ? icon in application |
| Knowledge base | Searchable articles |
| Status page | Check for ongoing incidents |

### Contact Support

**For End Users:**
1. Contact your organization's IT administrator first
2. Use the in-app help chat (if available)
3. Email support at address provided by your organization

**For Tenant Administrators:**
1. Check RADIANT Admin documentation
2. Use the Admin support channel
3. Submit a support ticket

**For Platform Administrators:**
1. Check runbooks in `/docs/runbooks/`
2. Escalate via on-call procedures
3. Access emergency support channels

### Information to Provide

When contacting support, include:
- Your email address
- Tenant/organization name
- Browser and OS version
- Steps to reproduce the issue
- Screenshots (if applicable)
- Error messages (exact text)
- Timestamp of the issue

---

## Error Code Reference

| Code | Meaning | Resolution |
|------|---------|------------|
| `AUTH001` | Invalid credentials | Check email/password |
| `AUTH002` | Account locked | Wait 15 min or reset password |
| `AUTH003` | Account suspended | Contact admin |
| `AUTH004` | MFA required | Set up MFA |
| `AUTH005` | MFA invalid | Check code and time sync |
| `AUTH006` | Session expired | Sign in again |
| `AUTH007` | IP restricted | Use allowed network |
| `AUTH008` | SSO required | Use SSO sign-in |
| `AUTH009` | Rate limited | Wait and retry |
| `AUTH010` | Service unavailable | Check status page |

---

## Related Documentation

- [Authentication Overview](./overview.md)
- [User Guide](./user-guide.md)
- [MFA Guide](./mfa-guide.md)
- [Tenant Admin Guide](./tenant-admin-guide.md)


---

## Part X: Security Audit

## Version: 5.42.0
## Last Audit: January 2026

This document provides a security audit checklist for the RADIANT platform covering authentication, authorization, data isolation, and security best practices.

---

## 1. Row-Level Security (RLS) Policies

### 1.1 Core Tables - RLS Status

| Table | RLS Enabled | Policy Type | Verified |
|-------|-------------|-------------|----------|
| `tenants` | ✅ | tenant_id match | ✅ |
| `users` | ✅ | tenant_id + user_id | ✅ |
| `ai_reports` | ✅ | tenant_id match | ✅ |
| `ai_report_templates` | ✅ | tenant_id OR is_system | ✅ |
| `ai_report_brand_kits` | ✅ | tenant_id match | ✅ |
| `ai_report_insights` | ✅ | tenant_id match | ✅ |
| `billing_credits` | ✅ | tenant_id match | ✅ |
| `usage_records` | ✅ | tenant_id match | ✅ |
| `model_configs` | ✅ | tenant_id match | ✅ |
| `agi_brain_plans` | ✅ | tenant_id + user_id | ✅ |
| `conversations` | ✅ | tenant_id + user_id | ✅ |

### 1.2 RLS Policy Template

```sql
-- Standard tenant isolation policy
ALTER TABLE table_name ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation ON table_name
  FOR ALL
  USING (tenant_id = current_setting('app.current_tenant_id', true)::text)
  WITH CHECK (tenant_id = current_setting('app.current_tenant_id', true)::text);

-- User-level isolation (for user-specific data)
CREATE POLICY user_isolation ON table_name
  FOR ALL
  USING (
    tenant_id = current_setting('app.current_tenant_id', true)::text
    AND user_id = current_setting('app.current_user_id', true)::text
  );
```

### 1.3 RLS Audit Queries

```sql
-- Check which tables have RLS enabled
SELECT schemaname, tablename, rowsecurity 
FROM pg_tables 
WHERE schemaname = 'public' AND rowsecurity = true;

-- Check RLS policies
SELECT tablename, policyname, permissive, roles, cmd, qual 
FROM pg_policies 
WHERE schemaname = 'public';

-- Verify tenant context is set
SELECT current_setting('app.current_tenant_id', true);
```

---

## 2. Authentication Flow

### 2.1 Token Validation

```typescript
// Required checks for every authenticated request:
interface AuthChecks {
  tokenSignature: boolean;      // JWT signature valid
  tokenExpiry: boolean;         // Not expired
  tokenIssuer: boolean;         // Correct issuer
  tenantExists: boolean;        // Tenant is valid
  tenantActive: boolean;        // Tenant not suspended
  userExists: boolean;          // User exists
  userActive: boolean;          // User not disabled
  permissionsValid: boolean;    // Has required permissions
}
```

### 2.2 Auth Middleware Checklist

- [x] JWT signature verification
- [x] Token expiration check
- [x] Issuer validation
- [x] Audience validation
- [x] Tenant context injection
- [x] User context injection
- [x] Role/permission extraction
- [x] Rate limiting per user
- [x] Session validation (if applicable)

### 2.3 Admin Authentication

```typescript
// Admin endpoints require additional checks:
const adminAuthChecks = {
  isAdmin: user.roles.includes('admin') || user.isSuperAdmin,
  hasPermission: (permission: string) => user.permissions.includes(permission),
  isSuperAdmin: user.isSuperAdmin === true,
};
```

---

## 3. Authorization Patterns

### 3.1 Permission Hierarchy

```
SuperAdmin
  └── Full platform access
  └── Can access any tenant
  └── Can modify system settings

TenantAdmin
  └── Full tenant access
  └── Can manage users
  └── Can configure models
  └── Can view billing

TenantUser
  └── Limited to own data
  └── Can use AI features
  └── Cannot modify settings
```

### 3.2 Resource Authorization

```typescript
// Every resource access must verify:
async function authorizeResourceAccess(
  userId: string,
  tenantId: string,
  resourceType: string,
  resourceId: string,
  action: 'read' | 'write' | 'delete'
): Promise<boolean> {
  // 1. Verify tenant access
  if (!await canAccessTenant(userId, tenantId)) return false;
  
  // 2. Verify resource belongs to tenant
  if (!await resourceBelongsToTenant(resourceType, resourceId, tenantId)) return false;
  
  // 3. Verify user has permission for action
  if (!await userHasPermission(userId, resourceType, action)) return false;
  
  return true;
}
```

---

## 4. Input Validation & Sanitization

### 4.1 Required Validations

| Input Type | Validation | Sanitization |
|------------|------------|--------------|
| UUID | Format check | None needed |
| Email | RFC 5322 regex | Lowercase, trim |
| Tenant ID | Alphanumeric + hyphen | Lowercase |
| User input text | Length limits | HTML escape |
| JSON payloads | Schema validation | Type coercion |
| File uploads | MIME type, size | Virus scan |
| SQL parameters | Parameterized queries | Never concatenate |

### 4.2 SQL Injection Prevention

```typescript
// ✅ CORRECT: Parameterized queries
await executeStatement(
  'SELECT * FROM users WHERE tenant_id = $1 AND id = $2',
  [stringParam('tenantId', tenantId), stringParam('id', userId)]
);

// ❌ WRONG: String concatenation
await executeStatement(
  `SELECT * FROM users WHERE tenant_id = '${tenantId}'` // NEVER DO THIS
);
```

### 4.3 XSS Prevention

```typescript
// Sanitize user-generated content before rendering
import DOMPurify from 'dompurify';

const sanitizedHtml = DOMPurify.sanitize(userContent, {
  ALLOWED_TAGS: ['b', 'i', 'em', 'strong', 'a', 'p', 'br'],
  ALLOWED_ATTR: ['href', 'title'],
});
```

---

## 5. API Security

### 5.1 Rate Limiting

| Endpoint Type | Rate Limit | Window |
|---------------|------------|--------|
| Auth endpoints | 10 req | 1 min |
| Admin API | 100 req | 1 min |
| AI generation | 20 req | 1 min |
| Export endpoints | 5 req | 1 min |
| Public API | 1000 req | 1 min |

### 5.2 CORS Configuration

```typescript
// Strict CORS for production
const corsConfig = {
  origin: [
    'https://admin.radiant.ai',
    'https://app.radiant.ai',
    process.env.NODE_ENV === 'development' && 'http://localhost:3000',
  ].filter(Boolean),
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Tenant-ID'],
  credentials: true,
  maxAge: 86400,
};
```

### 5.3 Security Headers

```typescript
const securityHeaders = {
  'Strict-Transport-Security': 'max-age=31536000; includeSubDomains',
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'X-XSS-Protection': '1; mode=block',
  'Content-Security-Policy': "default-src 'self'; script-src 'self'",
  'Referrer-Policy': 'strict-origin-when-cross-origin',
};
```

---

## 6. Data Protection

### 6.1 Encryption at Rest

| Data Type | Encryption | Key Management |
|-----------|------------|----------------|
| Aurora PostgreSQL | AES-256 | AWS KMS |
| S3 Buckets | AES-256 | AWS KMS |
| Secrets | AES-256 | Secrets Manager |
| Local storage | N/A | Not stored |

### 6.2 Encryption in Transit

- All API traffic: TLS 1.2+
- Database connections: SSL required
- Internal AWS: VPC endpoints

### 6.3 PII Handling

```typescript
// PII fields requiring special handling
const piiFields = [
  'email',
  'name',
  'phone',
  'address',
  'ip_address',
  'api_key',
];

// Log redaction
function redactPII(obj: Record<string, unknown>): Record<string, unknown> {
  const redacted = { ...obj };
  for (const field of piiFields) {
    if (field in redacted) {
      redacted[field] = '[REDACTED]';
    }
  }
  return redacted;
}
```

---

## 7. Secret Management

### 7.1 Secret Storage

| Secret Type | Storage | Rotation |
|-------------|---------|----------|
| API Keys | Secrets Manager | 90 days |
| Database credentials | Secrets Manager | 30 days |
| JWT signing keys | Secrets Manager | 365 days |
| Encryption keys | KMS | Auto |

### 7.2 Secret Access

```typescript
// Secrets should never be:
// - Logged
// - Returned in API responses
// - Stored in environment variables (use Secrets Manager)
// - Committed to code

// Correct pattern:
const secret = await secretsManager.getSecretValue({
  SecretId: 'prod/radiant/api-key',
});
```

---

## 8. Audit Logging

### 8.1 Events to Log

| Event Category | Events |
|----------------|--------|
| Authentication | Login, logout, failed attempts |
| Authorization | Permission denied, role changes |
| Data access | Read sensitive data, exports |
| Data modification | Create, update, delete |
| Admin actions | User management, settings changes |
| Security events | Rate limit hits, suspicious activity |

### 8.2 Log Format

```typescript
interface AuditLog {
  timestamp: string;
  eventType: string;
  tenantId: string;
  userId: string;
  resourceType: string;
  resourceId: string;
  action: string;
  outcome: 'success' | 'failure';
  ipAddress: string;
  userAgent: string;
  details: Record<string, unknown>;
}
```

---

## 9. Vulnerability Checklist

### 9.1 OWASP Top 10 Coverage

| Vulnerability | Mitigation | Status |
|---------------|------------|--------|
| Injection | Parameterized queries | ✅ |
| Broken Auth | JWT + MFA support | ✅ |
| Sensitive Data Exposure | Encryption + redaction | ✅ |
| XML External Entities | Not applicable (JSON only) | ✅ |
| Broken Access Control | RLS + auth middleware | ✅ |
| Security Misconfiguration | IaC + security headers | ✅ |
| XSS | Content sanitization | ✅ |
| Insecure Deserialization | Schema validation | ✅ |
| Known Vulnerabilities | Dependabot + npm audit | ✅ |
| Insufficient Logging | Audit logging | ✅ |

### 9.2 Dependency Security

```bash
# Run regularly
npm audit
npm audit fix

# Check for outdated packages
npm outdated

# Review Dependabot alerts in GitHub
```

---

## 10. Incident Response

### 10.1 Security Incident Procedure

1. **Detect** - Automated alerts or manual report
2. **Contain** - Isolate affected systems
3. **Investigate** - Review logs, identify scope
4. **Eradicate** - Remove threat, patch vulnerability
5. **Recover** - Restore services
6. **Document** - Post-incident report

### 10.2 Emergency Contacts

```
Security Team: security@radiant.ai
On-Call: PagerDuty integration
AWS Support: Enterprise support case
```

---

## 11. Compliance

### 11.1 Compliance Requirements

| Standard | Status | Notes |
|----------|--------|-------|
| SOC 2 Type II | In progress | Annual audit |
| GDPR | ✅ | Data processing agreements |
| HIPAA | Optional | PHI sanitization available |
| CCPA | ✅ | Privacy controls implemented |

### 11.2 Data Retention

| Data Type | Retention | Deletion |
|-----------|-----------|----------|
| Audit logs | 2 years | Auto-archive |
| User data | Account lifetime + 30 days | On request |
| AI conversations | 90 days default | Configurable |
| Reports | 1 year | Auto-delete |

---

## 12. Security Testing

### 12.1 Testing Schedule

| Test Type | Frequency | Last Run |
|-----------|-----------|----------|
| Dependency audit | Weekly | Auto |
| SAST (static analysis) | On PR | Auto |
| DAST (dynamic) | Monthly | Manual |
| Penetration test | Annual | External |
| Security review | Quarterly | Internal |

### 12.2 Security Test Commands

```bash
# Static analysis
npm run lint
npm run typecheck

# Dependency audit
npm audit

# Secret scanning
git secrets --scan

# Infrastructure security
cdk synth && cfn-nag
```

---

## Approval

| Role | Name | Date |
|------|------|------|
| Security Lead | | |
| Engineering Lead | | |
| CTO | | |


---

## Part XI: Compliance

## Overview

This document outlines RADIANT's compliance posture for SOC 2, HIPAA, and GDPR requirements.

## Compliance Matrix

| Framework | Tier Required | Status |
|-----------|---------------|--------|
| SOC 2 Type II | All tiers | ✅ Controls implemented |
| HIPAA | Tier 3+ (GROWTH) | ✅ BAA available |
| GDPR | All tiers (EU data) | ✅ DPA available |
| PCI DSS | N/A | Not applicable (no card data) |

## SOC 2 Controls

### Trust Service Criteria

#### Security (Common Criteria)

| Control | Implementation |
|---------|----------------|
| CC1.1 - Board oversight | Documented security policies |
| CC2.1 - Communication | Security awareness training |
| CC3.1 - Risk assessment | Annual risk assessments |
| CC4.1 - Monitoring | CloudWatch, GuardDuty |
| CC5.1 - Logical access | IAM, Cognito, RLS |
| CC6.1 - System operations | Runbooks, on-call |
| CC7.1 - Change management | CI/CD, PR reviews |
| CC8.1 - Risk mitigation | WAF, rate limiting |
| CC9.1 - Entity risk | Vendor assessments |

#### Availability

| Control | Implementation |
|---------|----------------|
| A1.1 - Capacity planning | Auto-scaling, monitoring |
| A1.2 - Environmental protection | Multi-AZ, DR procedures |
| A1.3 - Recovery | Backups, PITR, runbooks |

#### Confidentiality

| Control | Implementation |
|---------|----------------|
| C1.1 - Data classification | PII tagging, encryption |
| C1.2 - Data disposal | Lifecycle policies |

### Evidence Collection

```typescript
// Automated evidence collection
const auditLogs = {
  // All admin actions logged
  source: 'audit_logs table',
  retention: '7 years',
  
  // Access logs
  accessLogs: 'CloudWatch Logs',
  
  // Configuration changes
  configChanges: 'AWS Config',
  
  // Security events
  securityEvents: 'GuardDuty findings',
};
```

### Annual Audit Checklist

- [ ] Access review completed
- [ ] Penetration test completed
- [ ] Vulnerability scan completed
- [ ] Security training completed
- [ ] Incident response test completed
- [ ] DR test completed
- [ ] Vendor assessments updated
- [ ] Policies reviewed and updated

## HIPAA Compliance

### Applicability

HIPAA compliance is available for Tier 3 (GROWTH) and above, which includes:
- Encryption at rest (AES-256)
- Encryption in transit (TLS 1.3)
- Audit logging
- Access controls
- BAA with AWS

### Technical Safeguards

| Requirement | Implementation |
|-------------|----------------|
| Access Control (§164.312(a)) | Cognito MFA, RLS, RBAC |
| Audit Controls (§164.312(b)) | CloudTrail, audit_logs table |
| Integrity Controls (§164.312(c)) | Checksums, versioning |
| Transmission Security (§164.312(e)) | TLS 1.3, VPC endpoints |

### Administrative Safeguards

| Requirement | Implementation |
|-------------|----------------|
| Security Officer | Designated in org |
| Workforce Training | Annual security training |
| Access Management | Quarterly access reviews |
| Incident Response | Documented procedures |

### Physical Safeguards

Handled by AWS:
- Data center security
- Device controls
- Facility access

### PHI Data Handling

```sql
-- PHI fields are encrypted at column level
CREATE TABLE patient_data (
  id UUID PRIMARY KEY,
  tenant_id UUID NOT NULL,
  -- PHI fields use additional encryption
  encrypted_data BYTEA NOT NULL,
  encryption_key_id VARCHAR(255) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS for tenant isolation
ALTER TABLE patient_data ENABLE ROW LEVEL SECURITY;
```

### BAA Requirements

Before processing PHI:
1. Sign BAA with RADIANT
2. Enable HIPAA-eligible services only
3. Configure CloudTrail logging
4. Enable AWS Config
5. Review shared responsibility model

## GDPR Compliance

### Data Subject Rights

| Right | Implementation |
|-------|----------------|
| Right to Access | Data export API |
| Right to Rectification | Self-service + API |
| Right to Erasure | Deletion API + cascade |
| Right to Restrict | Processing flags |
| Right to Portability | JSON/CSV export |
| Right to Object | Consent management |

### Data Export (Right to Access)

```typescript
// API endpoint for data export
// GET /api/v2/gdpr/export
async function exportUserData(userId: string): Promise<UserDataExport> {
  return {
    personalData: await getPersonalData(userId),
    activityLogs: await getActivityLogs(userId),
    preferences: await getPreferences(userId),
    exportedAt: new Date().toISOString(),
    format: 'JSON',
  };
}
```

### Data Deletion (Right to Erasure)

```typescript
// API endpoint for data deletion
// DELETE /api/v2/gdpr/delete
async function deleteUserData(userId: string): Promise<DeletionResult> {
  // Cascade delete all user data
  await deletePersonalData(userId);
  await deleteActivityLogs(userId);
  await deletePreferences(userId);
  await deleteApiKeys(userId);
  
  // Anonymize audit logs (retain for compliance)
  await anonymizeAuditLogs(userId);
  
  return {
    deletedAt: new Date().toISOString(),
    confirmation: generateDeletionCertificate(userId),
  };
}
```

### Data Processing Agreement

DPA includes:
- Nature and purpose of processing
- Types of personal data
- Categories of data subjects
- Sub-processor list
- Technical measures
- Audit rights

### Data Residency

| Region | Data Location | Backup Location |
|--------|---------------|-----------------|
| EU | eu-west-1 (Ireland) | eu-central-1 (Frankfurt) |
| US | us-east-1 (Virginia) | us-west-2 (Oregon) |
| APAC | ap-northeast-1 (Tokyo) | ap-southeast-1 (Singapore) |

```typescript
// Enforce data residency
const dataResidency = {
  EU: ['eu-west-1', 'eu-central-1'],
  US: ['us-east-1', 'us-west-2'],
  APAC: ['ap-northeast-1', 'ap-southeast-1'],
};

// Route requests to appropriate region
function routeByResidency(tenantRegion: string): string {
  return dataResidency[tenantRegion][0];
}
```

### Consent Management

```sql
-- Consent tracking table
CREATE TABLE consent_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id),
  consent_type VARCHAR(50) NOT NULL,
  granted BOOLEAN NOT NULL,
  granted_at TIMESTAMPTZ,
  withdrawn_at TIMESTAMPTZ,
  ip_address INET,
  user_agent TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Consent types: marketing, analytics, essential, third_party
```

## Data Classification

### Classification Levels

| Level | Description | Examples | Controls |
|-------|-------------|----------|----------|
| Public | No restrictions | Marketing content | None |
| Internal | Business use | Metrics, configs | Access control |
| Confidential | Sensitive business | API keys, billing | Encryption, audit |
| Restricted | Highly sensitive | PHI, PII, credentials | Full controls |

### PII Fields

```typescript
// Fields classified as PII
const piiFields = [
  'email',
  'display_name',
  'phone_number',
  'ip_address',
  'user_agent',
  'billing_address',
  'payment_method',
];

// Automatic PII detection and tagging
function tagPiiFields(data: Record<string, unknown>): void {
  for (const field of piiFields) {
    if (data[field]) {
      // Tag for audit and retention policies
      data[`${field}_pii`] = true;
    }
  }
}
```

## Encryption

### At Rest

| Data Type | Encryption | Key Management |
|-----------|------------|----------------|
| Database | AES-256 | AWS KMS |
| S3 | AES-256 | AWS KMS |
| Secrets | AES-256 | Secrets Manager |
| Backups | AES-256 | AWS KMS |

### In Transit

| Connection | Protocol | Minimum Version |
|------------|----------|-----------------|
| API | TLS | 1.2 (1.3 preferred) |
| Database | TLS | 1.2 |
| Internal | TLS | 1.2 |

### Key Rotation

```typescript
// Automatic key rotation
const kmsKey = new kms.Key(this, 'Key', {
  enableKeyRotation: true,  // Annual rotation
  rotationPeriod: cdk.Duration.days(365),
});
```

## Audit Logging

### What We Log

| Event Type | Retention | Purpose |
|------------|-----------|---------|
| Authentication | 2 years | Security |
| Authorization | 2 years | Security |
| Data access | 7 years | Compliance |
| Admin actions | 7 years | Compliance |
| Configuration changes | 7 years | Compliance |
| API requests | 90 days | Operations |

### Log Format

```json
{
  "timestamp": "2024-12-24T10:30:00Z",
  "event_type": "data_access",
  "actor": {
    "id": "user-123",
    "type": "admin",
    "ip": "192.168.1.100"
  },
  "resource": {
    "type": "model",
    "id": "model-456"
  },
  "action": "read",
  "outcome": "success",
  "metadata": {}
}
```

### Log Protection

- Logs are immutable (write-once)
- Logs are encrypted at rest
- Access requires special IAM role
- Log deletion requires dual approval

## Incident Response

### Classification

| Severity | Response Time | Examples |
|----------|---------------|----------|
| Critical | 1 hour | Data breach, service down |
| High | 4 hours | Attempted breach, partial outage |
| Medium | 24 hours | Policy violation |
| Low | 72 hours | Minor security event |

### Breach Notification

| Jurisdiction | Requirement | Timeline |
|--------------|-------------|----------|
| GDPR | DPA + affected users | 72 hours |
| HIPAA | HHS + affected individuals | 60 days |
| State laws | Varies by state | Varies |

## Vendor Management

### Approved Sub-Processors

| Vendor | Purpose | Location | DPA |
|--------|---------|----------|-----|
| AWS | Infrastructure | Global | Yes |
| OpenAI | AI provider | US | Yes |
| Anthropic | AI provider | US | Yes |
| Google Cloud | AI provider | Global | Yes |

### Vendor Assessment

Annual assessment includes:
- Security questionnaire
- SOC 2 report review
- Penetration test results
- Insurance verification

## Contact

| Role | Contact |
|------|---------|
| Data Protection Officer | dpo@radiant.example.com |
| Security Team | security@radiant.example.com |
| Compliance Team | compliance@radiant.example.com |


---

## Part XII: User Provisioning & Licensing ADR

> **Status**: APPROVED
> **Author**: AI Build Agent (Cascade) + Product Owner
> **Date**: February 6, 2026
> **RADIANT Version**: 4.18.0 / v7.23.0+
> **Supersedes**: ADR v1 (multi-tenant user model — replaced with single-tenant model)
> **Companion Document**: [Think Tank Licensing Model](../THINKTANK-LICENSING-MODEL.md)

---

## 1. Context & Problem Statement

RADIANT is a multi-tenant SaaS platform with multiple user-facing applications (Think Tank, Curator, Aurelius Dojo, Cato Trainer, OMEGA Lab, and future apps). Several interrelated concerns must be resolved together before implementing authentication:

1. **User provisioning**: How do new users get into the system?
2. **Licensing model**: Per-app seats + storage + retention + regulatory compliance features
3. **Permission management**: Where and by whom are user permissions managed?
4. **Third-party authentication**: Can Google/Apple/Microsoft be used to log in?
5. **Regulatory compliance**: Which standards are licensed features? How do they affect cost?
6. **Tenant creation & management**: How are tenants created? Who manages them?
7. **User-tenant relationship**: One user = one tenant (NOT multi-tenant)

---

## 2. Approved Decisions

### DECISION 1: Single-Tenant Users (One User = One Tenant)

**Rule**: Each user belongs to exactly ONE tenant. The same email address can exist as separate user records in different tenants.

**IMPORTANT**: This REVERSES the v7.22.0 multi-tenant user identity model.

**Architecture**:

```
users table:
┌──────────────────────────────────────────┐
│ id: uuid-001                              │
│ tenant_id: acme-corp (NOT NULL)           │  ← User belongs to Acme Corp
│ email: john@gmail.com                     │
│ cognito_user_id: cognito-sub-abc          │
│ role: standard_user                       │
│ status: active                            │
└──────────────────────────────────────────┘

┌──────────────────────────────────────────┐
│ id: uuid-002                              │
│ tenant_id: contoso (NOT NULL)             │  ← SEPARATE user in Contoso
│ email: john@gmail.com                     │  ← Same email, different tenant
│ cognito_user_id: cognito-sub-abc          │  ← Same Cognito identity
│ role: tenant_admin                        │
│ status: active                            │
└──────────────────────────────────────────┘
```

**Constraints**:
- `UNIQUE(tenant_id, email)` — one email per tenant
- `UNIQUE(tenant_id, cognito_user_id)` — one Cognito identity per tenant
- `tenant_id NOT NULL` — every user must belong to a tenant
- `cognito_user_id` is NOT globally unique (same person can have records in multiple tenants)

**Login flow when email exists in multiple tenants**:

```
1. User enters email on login page
2. Cognito authenticates (password, Google, Apple, etc.)
3. Our API queries: SELECT tenant_id, tenant_name FROM users WHERE email = ?
4. If ONE tenant  → log straight in
5. If MULTIPLE    → show tenant picker: "Which organization?"
6. User selects   → session scoped to that tenant's user record
7. User can ONLY see data for the tenant they selected
```

**What this means**:
- No global "user identity" that spans tenants
- Each tenant has its own user record with its own role, permissions, features
- Deactivating john@gmail.com in Acme Corp does NOT affect john@gmail.com in Contoso
- Users have ZERO visibility into other tenants
- Passwords are the same (one Cognito account per email) but roles/permissions differ per tenant

### DECISION 2: Invitation-Only User Provisioning (No Self-Registration)

**Rule**: A user can ONLY enter the system if a tenant administrator explicitly invites them.

**Who can invite**: Only users with `tenant_admin` role.

**Invitation flow**:

```
1. Tenant Admin opens Think Tank Tenant Administration → Users → Invite
2. System checks:
   a. Does the inviter have tenant_admin role?                      → If no, REJECT
   b. Does the tenant have available seat licenses for the app(s)?  → If no, REJECT
3. If all checks pass:
   - Create tenant_user_memberships row with status='invited'
   - Set has_access_think_tank, has_access_curator, etc. based on what admin selected
   - Send invitation email
4. Invitation contains a one-time token with expiry (configurable, default 7 days)

WHEN the user logs in for the first time (any method):

5. Cognito authenticates them → issues cognito_sub
6. Our API checks: does a users row exist for this cognito_sub?
   a. YES → existing user, check memberships, proceed
   b. NO  → first time. Check: is there an invitation for this email?
      - YES → Create users row, link to invitation, set membership status='active'
      - NO  → REJECT. "You have not been invited to any organization."
```

**What this means**:
- **No self-signup page**. There is no public registration form.
- **No "Sign in with Google" for strangers**. Google/Apple only authenticates people who are ALREADY in the system (invited or active).
- **Tenant admins are the gatekeepers**. They decide who gets in and what they can access.

---

### DECISION 3: Flexible Licensing Model (Per-App, Multi-Dimension)

**Rule**: Licensing is NOT just seats. Each app can have multiple license dimensions (seats, storage, retention, regulatory features, etc.). Adding a new licensable dimension does NOT require a code rewrite.

**See**: [Think Tank Licensing Model](../THINKTANK-LICENSING-MODEL.md) for full details.

**Core table**: `tenant_licenses` — a single flexible table that handles all license types:

```
tenant_licenses:
┌───────────────────────────────────────────────────┐
│ tenant_id:    acme-corp                            │
│ license_type: 'seat'                               │
│ app_id:       'think_tank'                         │
│ quantity:     50                                    │
│ used:         48                                    │
│ unit:         'user'                                │
│ is_active:    true                                  │
├───────────────────────────────────────────────────┤
│ tenant_id:    acme-corp                            │
│ license_type: 'storage'                            │
│ app_id:       'think_tank'                         │
│ quantity:     100                                   │
│ used:         67                                    │
│ unit:         'gb'                                  │
│ is_active:    true                                  │
├───────────────────────────────────────────────────┤
│ tenant_id:    acme-corp                            │
│ license_type: 'compliance'                         │
│ app_id:       'platform'     ← cross-app           │
│ quantity:     1              ← boolean (licensed)   │
│ feature_code: 'hipaa'                              │
│ is_active:    true                                  │
├───────────────────────────────────────────────────┤
│ tenant_id:    acme-corp                            │
│ license_type: 'retention'                          │
│ app_id:       'platform'                           │
│ quantity:     2555           ← 7 years in days      │
│ unit:         'days'                                │
│ feature_code: 'hipaa_retention'                    │
│ is_active:    true                                  │
└───────────────────────────────────────────────────┘
```

**Seat rules**:
- Active users consume seats. **Deactivated users free up seats.**
- Invited users reserve seats (to prevent over-invitation)
- Deleted users must respect regulatory retention if licensed (data retained, seat freed)
- Configurable overage: tenant can add users/licenses; billing method is charged automatically
- Think Tank (Web + Mac) = ONE seat (`think_tank`). One seat covers both platforms.
- Think Tank is granted by default on invite. Other apps require explicit activation subject to licensing.

**Regulatory compliance as licenses**:
- Every regulatory standard (HIPAA, GDPR, SOC2, CCPA, ISO 27001, etc.) is a licensable feature
- If a tenant does NOT have the license, the feature is DISABLED
- UI shows: "This feature requires a [HIPAA/GDPR/etc.] compliance license. Contact Think Tank support at support@thinktank.app to add this to your plan."
- API endpoints that serve compliance features check the license and return 403 if unlicensed
- Record retention policies that have significant storage cost are licensed separately

**All API endpoints enforce licensing** — see Licensing Model doc for the middleware pattern.

---

### DECISION 4: Think Tank Tenant Admin as Central Management Hub

**Rule**: The Think Tank Tenant Admin app is the central place for ALL tenant management, not just users. It manages:

- **User management**: Invitations, roles, app access, deactivation
- **License dashboard**: View all licenses, usage, purchase additional
- **Permissions**: Role-based permissions (soft, admin-configurable, UI for editing)
- **Tenant settings**: Name, timezone, language, branding
- **Auth config**: Allowed login methods, MFA, SSO, session timeouts
- **Compliance**: Enable/disable regulatory features (subject to licensing)
- **Reporting**: Tenant usage, audit trails, compliance reports
- **Templates & shared resources**: Tenant-visible templates, cartridges (see [24-CARTRIDGE-SPECIALIZATIONS.md](./24-CARTRIDGE-SPECIALIZATIONS.md) for brain-mapped specialization taxonomy and PKI federation), etc.

**What individual apps do NOT have**:
- No user invite/management UI
- No license management UI
- Individual apps show "you don't have access" or "feature requires license" as appropriate

**What Radiant Admin (platform) can do additionally**:
- Override license limits for any tenant (trials, special deals)
- Create/delete tenants
- View cross-tenant summaries
- Manage Cognito accounts directly
- These are NOT available in Think Tank Tenant Admin

---

### DECISION 5: Authentication Architecture

**Rule**: Two completely separate Cognito User Pools. Federated login ONLY for the user pool. No self-registration.

#### Pool 1: `radiant-admins` (Platform Operators)

| Setting | Value |
|---------|-------|
| **Apps** | Radiant Admin Dashboard ONLY |
| **Who** | Platform operators (your team) |
| **Login** | Email + password ONLY |
| **MFA** | MANDATORY (TOTP — no SMS) |
| **Federation** | DISABLED. No Google, Apple, Microsoft, SSO. Never. |

#### Pool 2: `radiant-users` (All User-Facing Apps)

| Setting | Value |
|---------|-------|
| **Apps** | Think Tank (Web+Mac), Curator, Dojo, Cato Trainer, OMEGA Lab, Tenant Admin, ALL future apps |
| **Login** | Email+password, Google, Apple, Microsoft, Enterprise SSO (SAML/OIDC per-tenant) |
| **MFA** | Configurable per-tenant |
| **Federation** | ENABLED — authenticates only, never creates accounts |
| **Self-registration** | DISABLED. Unknown users → rejected. |

#### Authentication ≠ Authorization

```
AUTHENTICATION (Cognito):  "Is this person who they claim to be?"
AUTHORIZATION (Our API):   "Is this person allowed in this tenant with this app?"
   → users row exists for this email in a tenant? 
   → user status = active?
   → tenant has seat license for requested app?
   → tenant auth config allows this login method?
   → ALL checks pass → access granted
   → ANY check fails → HTTP 403
```

If someone authenticates via Google but has no user record → **rejected**.

---

### DECISION 6: Regulatory Compliance as Licensed Features

**Rule**: ALL regulatory standards are optional licensed features. If a tenant doesn't have the license, the features are disabled with a UI message to contact support.

**Regulatory standards with significant cost implications (must be licensed)**:

| Standard | License Code | Cost Driver | What Gets Disabled Without License |
|----------|-------------|-------------|-------------------------------------|
| **HIPAA** | `hipaa` | 7-year retention, enhanced audit, PHI encryption keys | PHI fields, enhanced audit, BAA features |
| **HIPAA Retention** | `hipaa_retention` | S3 Glacier storage for 7 years | Long-term record retention beyond default |
| **GDPR** | `gdpr` | Erasure processing, consent management, DSAR handling | Right to erasure, data export, consent UI |
| **SOC 2** | `soc2` | Comprehensive audit logging, evidence collection | Self-audit, compliance reports, evidence bundles |
| **CCPA** | `ccpa` | California consumer privacy processing | CCPA-specific rights, opt-out tracking |
| **ISO 27001** | `iso27001` | Security management controls | ISO compliance dashboard, control tracking |
| **Data Residency** | `data_residency` | Multi-region storage | Region-specific data storage, EU-only mode |
| **Enhanced Audit** | `enhanced_audit` | High-volume audit log storage | Detailed auth event logging, IP tracking |
| **Extended Retention** | `extended_retention` | Long-term storage | Retention beyond default (30 days → configurable) |

**Default (no compliance license)**: 30-day data retention, basic audit logging, standard encryption.

**UI behavior when unlicensed**:
```
┌─────────────────────────────────────────────────────────────┐
│  ⚠ HIPAA Compliance                                         │
│                                                              │
│  This feature requires a HIPAA compliance license.           │
│                                                              │
│  HIPAA compliance includes:                                  │
│  • 7-year record retention                                   │
│  • Enhanced audit logging                                    │
│  • PHI field encryption                                      │
│  • BAA documentation                                         │
│                                                              │
│  To add this license to your plan, contact Think Tank        │
│  support at support@thinktank.app                            │
│                                                              │
│  [Contact Support]                                           │
└─────────────────────────────────────────────────────────────┘
```

---

### DECISION 7: Tenant Creation & First User

**Rule**: Tenants are created via the Think Tank Tenant Admin app (or by Radiant platform admin).

**Tenant creation flow**:

```
1. New customer signs up (or Radiant admin creates tenant)
2. System creates:
   - Tenant record with name, settings
   - Default licenses based on subscription tier
   - First user with tenant_admin role
3. First user is ALWAYS an administrator
4. First user can see ALL permissions in Think Tank Tenant Administration
   (even ones that are off — so they know what's available)
```

**Personal accounts**:
- Single-user personal accounts still get a tenant name
- The one user is `tenant_admin` with full admin privileges
- They can later invite others if their license allows

**Permissions model**:
- Permissions are SOFT — can be added/modified/removed without code changes
- Stored as configurable data, not hardcoded
- Admin-settable per role type (User, Admin)
- All permissions visible in Think Tank Tenant Administration UI with toggle on/off
- Eventually refined to exact per-action permissions

---

### DECISION 8: Role-Based Permissions & Data Isolation

**Rule**: Users within a tenant can ONLY see tenant-allowed resources. Users NEVER have access to other users' data.

**Role types**:

| Role | Scope | Default Permissions |
|------|-------|--------------------|
| `tenant_admin` | Full tenant control | All permissions, billing, delete tenant, invite users, manage roles, configure settings |
| `standard_user` | Use apps | Access licensed apps, own data only |
| `viewer` | Read-only | View dashboards, no create/edit |

**Default Permissions Matrix** (soft — admin-configurable per tenant):

| Permission | `tenant_admin` | `standard_user` | `viewer` |
|-----------|:-:|:-:|:-:|
| **User Management** | | | |
| Invite users | ✅ | ❌ | ❌ |
| Deactivate/reactivate users | ✅ | ❌ | ❌ |
| Change user roles | ✅ | ❌ | ❌ |
| Toggle user app access | ✅ | ❌ | ❌ |
| Request user deletion | ✅ | ❌ | ❌ |
| **Tenant Config** | | | |
| Edit tenant settings | ✅ | ❌ | ❌ |
| Configure auth (MFA, SSO) | ✅ | ❌ | ❌ |
| Manage billing/licenses | ✅ | ❌ | ❌ |
| Delete tenant | ✅ | ❌ | ❌ |
| **Content** | | | |
| Create conversations | ✅ | ✅ | ❌ |
| View own conversations | ✅ | ✅ | ✅ |
| View others' conversations | ❌ | ❌ | ❌ |
| Create/edit templates | ✅ | ❌ | ❌ |
| View shared templates | ✅ | ✅ | ✅ |
| Manage cartridges | ✅ | ❌ | ❌ |
| Use cartridges | ✅ | ✅ | ❌ |
| **Reporting** | | | |
| View tenant usage reports | ✅ | ❌ | ✅ |
| View own usage | ✅ | ✅ | ✅ |
| Export audit logs | ✅ | ❌ | ❌ |
| **Compliance** | | | |
| Enable/disable compliance features | ✅ | ❌ | ❌ |
| View compliance dashboards | ✅ | ❌ | ✅ |
| Initiate GDPR erasure | ✅ | ❌ | ❌ |

**Key rules**:
- All permissions are stored in the `users.permissions` JSONB column
- Roles provide defaults; admins can override per-user in Think Tank Tenant Administration → Permissions
- New permissions can be added without migrations (JSONB is flexible)
- The UI shows ALL available permissions with toggles, even if off — so admins know what exists

**Absolute rules (NOT configurable — enforced by system)**:
- Users NEVER see other users' conversation data
- Users NEVER see other tenants' data
- RLS (`app.current_tenant_id`) enforces tenant isolation at the database level
- User-level data isolation enforced by `user_id` checks in queries
- `tenant_admin` has full control including billing and tenant deletion

---

## 3. Implementation Requirements

### 3.1 User Model Changes (Reversal of v7.22.0 Multi-Tenant)

The v7.22.0 migration made `users.tenant_id` nullable for multi-tenant users. This must be reversed:

- `users.tenant_id` → `NOT NULL` again
- `UNIQUE(cognito_user_id)` → `UNIQUE(tenant_id, cognito_user_id)` (same person can exist in multiple tenants)
- `UNIQUE(tenant_id, email)` — one email per tenant
- Feature access flags (`has_access_think_tank`, etc.) stay on the user record
- `tenant_user_memberships` table is no longer needed for multi-tenant — evaluate consolidation into `users`
- Safety functions updated for single-tenant model
- `users_by_tenant` view may no longer be needed

### 3.2 Licensing Tables

See [Think Tank Licensing Model](../THINKTANK-LICENSING-MODEL.md) for full schema.

Core tables:
- `tenant_licenses` — flexible license records (seats, storage, retention, compliance, etc.)
- `license_catalog` — available license types and pricing
- `license_audit` — all license changes logged
- `tenant_auth_config` — per-tenant auth settings

### 3.3 API Licensing Middleware

Every API endpoint must:
1. Extract `tenant_id` from auth context
2. Check `tenant_licenses` for the relevant app and feature
3. If unlicensed → return `{ error: 'LICENSE_REQUIRED', license_type: 'hipaa', contact: 'support@thinktank.app' }`
4. If licensed → proceed

### 3.4 Invitation Settings

- Default expiry: 7 days
- Tenant-configurable (persistent setting in `tenants.settings` or `tenant_auth_config`)
- Applies to ALL invitations for the tenant (not per-user)

### 3.5 User Deactivation vs Deletion

| Action | Seat Impact | Data Impact | Regulatory |
|--------|-------------|-------------|------------|
| **Deactivate** | Seat FREED | Data retained | Safe for all standards |
| **Delete** | Seat FREED | Data retained per retention license | Must check tenant retention requirements |
| **Hard delete** | Seat FREED | Data purged | Only after retention period expires |

---

## 4. Resolved Open Questions

| Question | Answer |
|----------|--------|
| **Invitation expiry** | 7-day default, tenant-configurable (persistent), applies to all invitations |
| **Seat overage** | Configurable. Can add users/licenses, billing method charged. Deactivated users free seats. |
| **Cross-tenant visibility** | Zero. Users only access the tenant they logged into. No cross-tenant information. |
| **Default app access** | Think Tank by default. Other apps require explicit activation subject to licensing. |
| **Mac + Web seats** | One seat covers both (`think_tank`). |
| **User-tenant model** | One user = one tenant. Same email in multiple tenants = separate user records. |
| **Deleted user retention** | Must respect tenant's regulatory retention license before hard-deleting data. |

---

## 5. Policy Summary (For Codification)

| Policy | Rule |
|--------|------|
| **Single-tenant users** | Each user belongs to exactly one tenant |
| **No self-registration** | Users can only enter via tenant admin invitation |
| **Invitation-only auth** | Federated login authenticates but never creates accounts |
| **Flexible licensing** | Per-app, multi-dimension (seats, storage, retention, compliance) |
| **Regulatory = licensed** | All regulatory features (HIPAA, GDPR, SOC2, etc.) require a license |
| **Unlicensed = disabled** | No license → feature disabled + "contact support@thinktank.app" message |
| **API enforces licensing** | Every endpoint checks license via middleware |
| **Two Cognito pools** | `radiant-admins` (no federation) and `radiant-users` (federation enabled) |
| **Radiant Admin: no federation** | Platform admin is email+password+MFA only, always |
| **Tenant Admin = hub** | Think Tank Tenant Administration is the central management UI |
| **Apps don't manage users** | Individual apps have no user management UI |
| **First user = admin** | First user in any tenant gets tenant_admin role |
| **Soft permissions** | Configurable, admin-visible, UI for toggle on/off |
| **Data isolation** | Users never see other users' data. RLS + user_id checks. |
| **Deactivation frees seats** | Deactivated user's seat is returned to the pool |
| **Retention before deletion** | Must respect regulatory retention before hard-deleting |

---

*Document approved by Product Owner — February 6, 2026*

---

## Part XIII: Real-Time Intrusion Detection & Prevention System (RIDPS) — v7.40.0

### 1. Overview

RIDPS is RADIANT's application-layer intrusion detection and prevention system. It operates in real-time within the Lambda execution environment, analyzing every API request for threat signals using 14 MITRE ATT&CK-mapped detectors.

### 2. Standards Compliance

| Standard | Section | Implementation |
|----------|---------|---------------|
| NIST SP 800-94 | §2-4, §7 | Three detection methods: signature, anomaly, stateful protocol analysis |
| NIST CSF 2.0 | DE.CM-01 through DE.CM-09 | Continuous monitoring via request middleware |
| NIST CSF 2.0 | DE.AE-01 through DE.AE-08 | Event correlation engine (1-min cadence) |
| MITRE ATT&CK Cloud | 11 techniques | T1078, T1110, T1190, T1530, T1548, T1550, T1087 |
| OWASP ASVS 4.0 | V7.1, V7.2, V11.1 | Structured logging, business logic monitoring |
| OWASP LLM Top 10 | LLM01 | Prompt injection surge detector |
| CIS Controls v8 | 8.2, 8.5, 8.11, 13.1, 13.3, 13.6 | Audit log management, network defense |
| SOC 2 Type II | CC6.1, CC6.6, CC7.2, CC7.3 | Access monitoring, anomaly detection |
| ISO 27001:2022 | A.8.15, A.8.16, A.5.25 | Logging, monitoring, event assessment |

### 3. Architecture

```
Layer 1 (Perimeter): AWS WAF → Managed Rules + IP Rate Limiting
Layer 2 (Application): Middleware → ThreatDetectionEngine → 14 Detectors → Correlation
Layer 3 (Response): IP Ban → Session Kill → Account Lock → SENTINEL Escalation
```

**Key components:**
- **`intrusion-detection.service.ts`** — Core engine with sliding windows, rule management, event persistence
- **`intrusion-detectors.ts`** — 14 detector implementations
- **`threat-response.service.ts`** — Automated response: ban, kill, lock, alert, escalate
- **`threat-intelligence.service.ts`** — IOC database, IP reputation, known-bad patterns
- **`middleware/intrusion-detection.ts`** — <5ms request middleware (pre + post analysis)
- **`intrusion-detection/analyzer.ts`** — EventBridge Lambda: correlation, UEBA baselines, cleanup

### 4. Detection Rules

Each detector reads configurable thresholds from the `detection_rules` table. Defaults are seeded by the migration. Per-tenant overrides supported.

**Response actions** (ordered by severity): `log_only` → `rate_limit` → `challenge` → `block_request` → `ban_ip` → `kill_session` → `lock_account` → `alert_admin` → `escalate_sentinel` → `waf_block`

### 5. UEBA (User & Entity Behavior Analytics)

User baselines are maintained in `user_access_baselines` and updated hourly by the analyzer Lambda. Baselines track: typical hours, countries, IPs, user-agents, request rates, and endpoint access patterns. The `unusual_access_pattern` detector compares real-time behavior against these baselines.

### 6. Integration Points

| Service | Integration |
|---------|-------------|
| `logging-registry.service.ts` | All detectors log via `createRegisteredLogger({ category: 'security' })` |
| `security-alert.service.ts` | Threat response triggers alerts for WARNING/CRITICAL via `securityAlertService.sendAlert()` |
| `sentinel-notifier.service.ts` | SEV1-2 incidents routed through SENTINEL escalation |
| `security-protection.service.ts` | Detections feed into `logSecurityEvent()` for security audit hotspot analysis |
| `audit.ts` | All detections emit `intrusion_detected` audit entries; all admin actions emit typed audit entries |
| `rate-limiter.ts` | Threat response dynamically adjusts rate limits |
| `security-stack.ts` (WAF) | Future: IP set sync for network-level blocking |
| `spend-governor.service.ts` | Model cost anomaly detector reads spend data |

### 7. Admin API Endpoints

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/admin/intrusion-detection/dashboard` | Dashboard stats |
| GET | `/admin/intrusion-detection/events` | Recent events |
| GET | `/admin/intrusion-detection/incidents` | Incident list |
| PUT | `/admin/intrusion-detection/incidents/{id}` | Update incident status |
| GET/POST | `/admin/intrusion-detection/blocked-ips` | IP blocklist management |
| DELETE | `/admin/intrusion-detection/blocked-ips/{ip}` | Unblock IP |
| GET/PUT | `/admin/intrusion-detection/config` | RIDPS config |
| GET | `/admin/intrusion-detection/detectors` | List detectors + rules |
| PUT | `/admin/intrusion-detection/detectors/{id}` | Update detector rule |
| GET/POST | `/admin/intrusion-detection/threat-intel` | Threat indicators |
| POST | `/admin/intrusion-detection/threat-intel/import` | Bulk import indicators |
| DELETE | `/admin/intrusion-detection/threat-intel/{id}` | Remove indicator |
| POST | `/admin/intrusion-detection/sessions/kill` | Manual session kill |
| POST | `/admin/intrusion-detection/accounts/lock` | Manual account lock |
| POST | `/admin/intrusion-detection/accounts/unlock` | Manual account unlock |

### 8. Manual Threat Mitigation

Admins can manually mitigate threats that the automated system cannot handle:

- **Incident Management**: Change incident status (investigating → mitigated → resolved / false_positive) with audit trail
- **IP Blocking**: Manual block/unblock with reason, severity, duration, and permanent options
- **Session Kill**: Revoke active sessions by session ID with reason tracking
- **Account Lock/Unlock**: Lock compromised accounts or unlock false positives
- **Detector Block**: Block source IPs directly from incident detail with one click

All manual actions are audit-logged to DynamoDB (`audit.ts`) with action type, admin ID, IP, and user agent.

### 9. Account Lockout Resolution (NIST SP 800-63B §5.2.8)

Lockouts follow a progressive duration policy with automatic resolution:

| Offense | Duration | Resolution |
|---------|----------|------------|
| 1st | 30 min | Auto-unlock |
| 2nd (within 7d) | 2 hours | Auto-unlock |
| 3rd (within 7d) | 24 hours | Auto-unlock |
| 4th+ (within 30d) | Permanent | Admin review required |

All durations are configurable per-tenant via the `lockout_policy` table.

**Automated resolution**: The analyzer Lambda calls `auto_unlock_expired_accounts()` every cleanup cycle. Expired timed lockouts are automatically cleared from the `users` table and marked `auto_unlocked` in the `account_lockout_history` table.

**Manual override**: Admins can unlock any account at any time via the Locked Accounts tab or the `/admin/intrusion-detection/accounts/unlock` API. All unlocks are audit-logged.

**Database objects**:
- `account_lockout_history` — Full lockout event history with reason type, offense number, duration, and resolution tracking
- `lockout_policy` — Per-tenant configurable progressive durations and policy settings
- `calculate_lockout_duration()` — DB function returning progressive duration based on offense count
- `auto_unlock_expired_accounts()` — DB function for bulk-unlocking expired timed lockouts

### 10. CloudWatch Metrics

Namespace: `RADIANT/IntrusionDetection`

| Metric | Description |
|--------|-------------|
| `IntrusionEventsDetected` | Total events per 5-min window |
| `CriticalIntrusionEvents` | Critical-severity events |
| `HighIntrusionEvents` | High-severity events |
| `UniqueAttackSourceIPs` | Distinct attacking IPs |
| `BlockedIPs` | Active IP blocks |
| `ActiveIncidents` | Open/investigating incidents |
| `LockedAccounts` | Currently locked user accounts |
| `PermanentAccountLocks` | Accounts with permanent lockout (requires admin review) |

---

*Consolidated from 12 source documents (0 not found). Updated v7.41.0.*
