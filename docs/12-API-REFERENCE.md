# API Reference

**REST APIs • Service Layer • MCP/A2A • Error Codes**

*RADIANT v7.63.0 — Generated March 16, 2026*

---

## Table of Contents

- **Part I: API Reference**
- **Part II: API Versioning**
- **Part III: Authentication API**
- **Part IV: Search API**
- **Part V: Error Codes**
- **Part VI: Service Layer**
- **Part VII: Provider Handling**
- **Part VIII: OMEGA Firmware API (v6.4.0)**

---


---

## Part I: API Reference

Complete API documentation for the RADIANT AI Platform.

**Base URL:** `https://api.radiant.example.com/v2`

**Authentication:** Bearer token (API key or JWT)
```
Authorization: Bearer rad_your_api_key
```

---

## Chat Completions

### Create Chat Completion

```http
POST /v2/chat/completions
```

Create a chat completion with any supported model.

**Request Body:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `model` | string | ✅ | Model ID (e.g., `gpt-4o`, `claude-3-sonnet`) |
| `messages` | array | ✅ | Array of message objects |
| `max_tokens` | integer | | Maximum tokens to generate |
| `temperature` | number | | Sampling temperature (0-2) |
| `top_p` | number | | Nucleus sampling (0-1) |
| `stream` | boolean | | Stream response tokens |
| `stop` | string/array | | Stop sequences |
| `functions` | array | | Function definitions |
| `function_call` | string/object | | Function calling mode |

**Message Object:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `role` | string | ✅ | `system`, `user`, `assistant`, `function` |
| `content` | string | ✅ | Message content |
| `name` | string | | Function name (for function messages) |

**Example Request:**

```json
{
  "model": "gpt-4o",
  "messages": [
    {"role": "system", "content": "You are a helpful assistant."},
    {"role": "user", "content": "Hello!"}
  ],
  "max_tokens": 1000,
  "temperature": 0.7
}
```

**Response:**

```json
{
  "id": "chatcmpl_abc123",
  "object": "chat.completion",
  "created": 1703980800,
  "model": "gpt-4o",
  "choices": [
    {
      "index": 0,
      "message": {
        "role": "assistant",
        "content": "Hello! How can I help you today?"
      },
      "finish_reason": "stop"
    }
  ],
  "usage": {
    "prompt_tokens": 25,
    "completion_tokens": 10,
    "total_tokens": 35
  }
}
```

---

## Models

### List Models

```http
GET /v2/models
```

List all available models.

**Query Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `category` | string | Filter by category (`chat`, `embedding`, `image`) |
| `provider` | string | Filter by provider (`openai`, `anthropic`, `google`) |

**Response:**

```json
{
  "object": "list",
  "data": [
    {
      "id": "gpt-4o",
      "object": "model",
      "created": 1703980800,
      "owned_by": "openai",
      "display_name": "GPT-4o",
      "category": "chat",
      "context_window": 128000,
      "input_cost_per_1k": 0.005,
      "output_cost_per_1k": 0.015,
      "capabilities": ["chat", "vision", "function_calling"]
    }
  ]
}
```

### Get Model

```http
GET /v2/models/{model_id}
```

Get details for a specific model.

---

## Embeddings

### Create Embeddings

```http
POST /v2/embeddings
```

Generate embeddings for text.

**Request Body:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `model` | string | ✅ | Embedding model ID |
| `input` | string/array | ✅ | Text to embed |
| `encoding_format` | string | | `float` or `base64` |

**Response:**

```json
{
  "object": "list",
  "data": [
    {
      "object": "embedding",
      "index": 0,
      "embedding": [0.0023, -0.0091, ...]
    }
  ],
  "model": "text-embedding-3-small",
  "usage": {
    "prompt_tokens": 8,
    "total_tokens": 8
  }
}
```

---

## Billing

### Get Credit Balance

```http
GET /v2/billing/credits
```

Get current credit balance.

**Response:**

```json
{
  "data": {
    "available": 150.50,
    "reserved": 10.00,
    "currency": "USD",
    "updated_at": "2024-01-15T10:30:00Z"
  }
}
```

### Get Usage

```http
GET /v2/billing/usage
```

Get usage data for a period.

**Query Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `start_date` | string | Start date (YYYY-MM-DD) |
| `end_date` | string | End date (YYYY-MM-DD) |
| `group_by` | string | `day`, `model`, `endpoint` |

---

## Webhooks

### List Webhooks

```http
GET /v2/webhooks
```

List configured webhooks.

### Create Webhook

```http
POST /v2/webhooks
```

**Request Body:**

```json
{
  "url": "https://your-server.com/webhook",
  "event_types": ["billing.low_balance", "usage.quota_reached"],
  "description": "Billing alerts"
}
```

**Response:**

```json
{
  "data": {
    "id": "wh_abc123",
    "url": "https://your-server.com/webhook",
    "secret": "whsec_xyz789...",
    "event_types": ["billing.low_balance", "usage.quota_reached"],
    "is_active": true,
    "created_at": "2024-01-15T10:30:00Z"
  }
}
```

### Test Webhook

```http
POST /v2/webhooks/{webhook_id}/test
```

Send a test event to the webhook.

---

## Batch Processing

### Create Batch Job

```http
POST /v2/batch/jobs
```

Create a batch processing job.

**Request Body:**

```json
{
  "type": "completions",
  "model": "gpt-4o",
  "input_file": "batch-input.jsonl",
  "options": {
    "system_prompt": "You are a helpful assistant.",
    "max_tokens": 500
  }
}
```

### Get Batch Job

```http
GET /v2/batch/jobs/{job_id}
```

Get batch job status and results.

### List Batch Jobs

```http
GET /v2/batch/jobs
```

List all batch jobs.

---

## Error Codes

RADIANT uses standardized error codes across all endpoints. See [Error Codes Reference](ERROR_CODES.md) for the complete list.

### Error Categories

| Category | Code Range | Description |
|----------|------------|-------------|
| Authentication | `RADIANT_AUTH_1xxx` | Token, API key, session errors |
| Authorization | `RADIANT_AUTHZ_2xxx` | Permission, role, tenant errors |
| Validation | `RADIANT_VAL_3xxx` | Input validation errors |
| Resource | `RADIANT_RES_4xxx` | Not found, conflict, quota errors |
| Rate Limiting | `RADIANT_RATE_5xxx` | Throttling and rate limit errors |
| AI/Model | `RADIANT_AI_6xxx` | Model, provider, inference errors |
| Billing | `RADIANT_BILL_7xxx` | Credits, subscription errors |
| Storage | `RADIANT_STOR_8xxx` | File upload, storage errors |
| Internal | `RADIANT_INT_9xxx` | Server, database, timeout errors |

### Common Error Codes

| Code | HTTP | Retryable | Description |
|------|------|-----------|-------------|
| `RADIANT_AUTH_1001` | 401 | ❌ | Invalid authentication token |
| `RADIANT_AUTH_1004` | 401 | ❌ | Invalid API key |
| `RADIANT_VAL_3001` | 400 | ❌ | Required field missing |
| `RADIANT_RES_4001` | 404 | ❌ | Resource not found |
| `RADIANT_RATE_5001` | 429 | ✅ | Rate limit exceeded |
| `RADIANT_BILL_7001` | 402 | ❌ | Insufficient credits |
| `RADIANT_AI_6004` | 502 | ✅ | AI provider error |
| `RADIANT_INT_9001` | 500 | ✅ | Internal server error |

**Error Response Format:**

```json
{
  "error": {
    "code": "RADIANT_RATE_5001",
    "message": "Too many requests. Please slow down.",
    "category": "rate_limit",
    "retryable": true,
    "timestamp": "2024-12-25T10:30:00.000Z"
  }
}
```

**Retry-After Header:** Retryable errors include `Retry-After` header with seconds to wait.

---

## Rate Limits

| Tier | Requests/min | Tokens/min |
|------|--------------|------------|
| Free | 10 | 10,000 |
| Starter | 50 | 50,000 |
| Professional | 100 | 200,000 |
| Business | 500 | 1,000,000 |
| Enterprise | 2,000 | Unlimited |

Rate limit headers:

```
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 95
X-RateLimit-Reset: 1703980860
```

---

## SDKs

### TypeScript/JavaScript

```bash
npm install @radiant/sdk
```

```typescript
import { RadiantClient } from '@radiant/sdk';

const client = new RadiantClient({ apiKey: 'your-key' });
const response = await client.chat.create({
  model: 'gpt-4o',
  messages: [{ role: 'user', content: 'Hello!' }],
});
```

### Python

```bash
pip install radiant-sdk
```

```python
from radiant import RadiantClient

client = RadiantClient(api_key="your-key")
response = client.chat.create(
    model="gpt-4o",
    messages=[{"role": "user", "content": "Hello!"}],
)
```

### CLI

```bash
npm install -g @radiant/cli
radiant auth login
radiant chat send "Hello!"
```

---

## Changelog

See [CHANGELOG.md](./CHANGELOG.md) for version history.

## Support

- **Email:** support@radiant.example.com
- **Documentation:** https://docs.radiant.example.com
- **Status:** https://status.radiant.example.com


---

## Part II: API Versioning

## Overview

This document describes the API versioning strategy for the RADIANT platform.

## Versioning Strategy

### URL Path Versioning

RADIANT uses URL path versioning as the primary versioning mechanism:

```
https://api.radiant.example.com/v2/models
https://api.radiant.example.com/v2/chat/completions
```

### Version Lifecycle

| Version | Status | Support End | Deprecation |
|---------|--------|-------------|-------------|
| v1 | Deprecated | 2024-06-01 | Sunset |
| v2 | Current | - | - |
| v3 | Planned | - | Q3 2025 |

### Support Policy

- **Current version**: Full support, all new features
- **Previous version**: Security fixes only, 12 months after new version
- **Deprecated**: No fixes, 6-month sunset warning

## Breaking vs Non-Breaking Changes

### Non-Breaking Changes (No Version Bump)

✅ These changes can be made to the current version:

- Adding new endpoints
- Adding new optional request parameters
- Adding new response fields
- Adding new enum values (with graceful handling)
- Performance improvements
- Bug fixes that don't change behavior

### Breaking Changes (Require New Version)

❌ These changes require a new API version:

- Removing endpoints
- Removing request/response fields
- Changing field types
- Changing validation rules
- Changing authentication methods
- Changing error response formats
- Removing enum values
- Changing default values

## Version Header Support

### Request Headers

```http
# Specify API version via header (optional override)
X-API-Version: 2024-12-01

# Request specific features
X-API-Features: beta-orchestration,streaming-v2
```

### Response Headers

```http
# Current API version
X-API-Version: 2
X-API-Version-Date: 2024-12-01

# Deprecation warning
Deprecation: true
Sunset: Sat, 01 Jun 2024 00:00:00 GMT
Link: <https://api.radiant.example.com/v2>; rel="successor-version"
```

## Deprecation Process

### Timeline

```
Day 0:    Announce deprecation
          Add Deprecation header
          Update documentation
          
Month 3:  Send reminder emails
          Log deprecation warnings
          
Month 6:  Begin returning 299 status for deprecated endpoints
          Increase warning frequency
          
Month 12: Sunset - Return 410 Gone
          Redirect to new version docs
```

### Deprecation Headers

```typescript
// Add deprecation headers to old endpoints
function addDeprecationHeaders(res: Response, sunset: Date): void {
  res.setHeader('Deprecation', 'true');
  res.setHeader('Sunset', sunset.toUTCString());
  res.setHeader('Link', '<https://api.radiant.example.com/v3>; rel="successor-version"');
}
```

### Deprecation Warnings

```typescript
// Log deprecation usage for migration tracking
async function logDeprecatedUsage(req: Request): Promise<void> {
  await analytics.track({
    event: 'deprecated_api_usage',
    properties: {
      endpoint: req.path,
      version: extractVersion(req),
      apiKey: extractKeyId(req),
      tenant: extractTenantId(req),
    },
  });
}
```

## Migration Guide Template

### v1 to v2 Migration

```markdown
# Migrating from API v1 to v2

## Breaking Changes

### 1. Authentication
- v1: API key in query string (`?api_key=xxx`)
- v2: API key in header (`Authorization: Bearer xxx`)

### 2. Response Format
- v1: Flat response (`{ models: [...] }`)
- v2: Wrapped response (`{ data: [...], meta: {...} }`)

### 3. Error Format
- v1: `{ error: "message" }`
- v2: `{ error: { code: "...", message: "...", details: [...] } }`

## Migration Steps

1. Update authentication headers
2. Update response parsing
3. Update error handling
4. Test all endpoints
5. Switch base URL from /v1 to /v2
```

## Feature Flags

### Beta Features

```typescript
// Enable beta features via header
const betaFeatures = {
  'beta-orchestration': true,
  'beta-streaming-v2': true,
  'beta-function-calling': true,
};

function isBetaEnabled(req: Request, feature: string): boolean {
  const features = req.headers['x-api-features']?.split(',') || [];
  return features.includes(feature) && betaFeatures[feature];
}
```

### Graduated Features

```typescript
// Track feature graduation
const featureGraduation = {
  'function-calling': {
    beta: '2024-06-01',
    stable: '2024-09-01',
    version: 'v2',
  },
  'streaming-v2': {
    beta: '2024-09-01',
    stable: null, // Still in beta
    version: 'v2',
  },
};
```

## SDK Versioning

### SDK Version Matrix

| SDK | Latest | Min API Version | Max API Version |
|-----|--------|-----------------|-----------------|
| JavaScript | 2.5.0 | v2 | v2 |
| Python | 2.3.0 | v2 | v2 |
| Go | 1.2.0 | v2 | v2 |
| Ruby | 1.1.0 | v2 | v2 |

### SDK Version Headers

```http
# SDKs include version info
User-Agent: radiant-js/2.5.0 node/20.10.0
X-Radiant-SDK: js
X-Radiant-SDK-Version: 2.5.0
```

## OpenAPI Specification

### Versioned Specs

```
/docs/openapi/v2.yaml     # Current version
/docs/openapi/v2-beta.yaml # With beta features
/docs/openapi/v1.yaml     # Deprecated version
```

### Schema Versioning

```yaml
# openapi.yaml
openapi: 3.1.0
info:
  title: RADIANT API
  version: 2.0.0
  x-api-version: v2
  x-version-date: '2024-12-01'
  x-deprecation-date: null
```

## Testing Versions

### Version Compatibility Tests

```typescript
describe('API Version Compatibility', () => {
  it('should support v2 endpoints', async () => {
    const res = await fetch('/v2/health');
    expect(res.status).toBe(200);
  });
  
  it('should return 410 for sunset v1 endpoints', async () => {
    const res = await fetch('/v1/health');
    expect(res.status).toBe(410);
    expect(res.headers.get('Link')).toContain('/v2');
  });
  
  it('should include deprecation headers for deprecated endpoints', async () => {
    const res = await fetch('/v2/deprecated-endpoint');
    expect(res.headers.get('Deprecation')).toBe('true');
    expect(res.headers.get('Sunset')).toBeDefined();
  });
});
```

## Client Communication

### Changelog

Maintain a public changelog:

```markdown
# API Changelog

## 2024-12-24 (v2.5)
- Added: Orchestration patterns endpoint
- Added: Workflow proposals endpoint
- Changed: Increased rate limits for Professional tier

## 2024-12-01 (v2.4)
- Added: AI translation for localization
- Deprecated: Legacy /translate endpoint (sunset 2025-06-01)
```

### Email Notifications

```typescript
// Notify developers of breaking changes
async function notifyApiChanges(change: ApiChange): Promise<void> {
  const affectedKeys = await getApiKeysUsingEndpoint(change.endpoint);
  
  for (const key of affectedKeys) {
    await sendEmail({
      to: key.ownerEmail,
      subject: `RADIANT API: ${change.type} - ${change.endpoint}`,
      template: 'api-change-notification',
      data: {
        change,
        migrationGuide: change.migrationGuideUrl,
        deadline: change.sunsetDate,
      },
    });
  }
}
```

## Best Practices

### For API Developers

1. **Plan for change**: Design APIs to be extensible
2. **Use optional fields**: Make new fields optional with defaults
3. **Version from day one**: Include version in all endpoints
4. **Document everything**: Keep OpenAPI specs updated
5. **Communicate early**: 12-month deprecation notice minimum

### For API Consumers

1. **Pin versions**: Don't use unversioned endpoints
2. **Handle unknown fields**: Ignore unexpected response fields
3. **Monitor deprecation headers**: Set up alerts
4. **Test regularly**: Run integration tests against current version
5. **Subscribe to updates**: Follow changelog and email updates

## Contact

| Role | Contact | Purpose |
|------|---------|---------|
| API Support | api-support@radiant.example.com | Usage questions |
| Developer Relations | devrel@radiant.example.com | SDKs, docs |
| Engineering | engineering@radiant.example.com | Bug reports |


---

## Part III: Authentication API

> **Version**: 5.52.29 | **Last Updated**: January 25, 2026 | **Base URL**: `https://api.radiant.ai/v1`

Complete API reference for RADIANT authentication endpoints.

---

## Table of Contents

1. [Overview](#overview)
2. [Authentication](#authentication)
3. [Sign In / Sign Out](#sign-in--sign-out)
4. [Password Management](#password-management)
5. [Multi-Factor Authentication](#multi-factor-authentication)
6. [Session Management](#session-management)
7. [OAuth 2.0 Endpoints](#oauth-20-endpoints)
8. [User Profile](#user-profile)
9. [Error Responses](#error-responses)

---

## Overview

### Base URLs

| Environment | URL |
|-------------|-----|
| Production | `https://api.radiant.ai/v1` |
| Staging | `https://api.staging.radiant.ai/v1` |

### Authentication Methods

| Method | Header | Use Case |
|--------|--------|----------|
| Bearer Token | `Authorization: Bearer <token>` | User requests |
| API Key | `X-API-Key: <key>` | Server-to-server |

### Common Headers

```http
Content-Type: application/json
Accept: application/json
Authorization: Bearer eyJhbGciOiJSUzI1NiIs...
X-Request-ID: uuid-for-tracing
```

### Rate Limits

| Endpoint Category | Limit | Window |
|-------------------|-------|--------|
| Authentication | 10 requests | 1 minute |
| Password reset | 3 requests | 1 hour |
| MFA verification | 5 requests | 1 minute |
| General API | 100 requests | 1 minute |

---

## Authentication

### Get Current User

Retrieve the authenticated user's profile.

```http
GET /auth/me
Authorization: Bearer <access_token>
```

**Response 200:**

```json
{
  "id": "usr_abc123def456",
  "email": "user@example.com",
  "name": "Jane Doe",
  "avatar_url": "https://cdn.radiant.ai/avatars/abc123.png",
  "tenant_id": "ten_xyz789",
  "roles": ["member"],
  "mfa_enabled": true,
  "language": "en",
  "timezone": "America/New_York",
  "created_at": "2024-01-15T10:30:00Z",
  "last_sign_in_at": "2026-01-25T08:00:00Z"
}
```

---

## Sign In / Sign Out

### Sign In with Email/Password

```http
POST /auth/signin
Content-Type: application/json
```

**Request Body:**

```json
{
  "email": "user@example.com",
  "password": "SecurePassword123!",
  "remember_me": true
}
```

**Response 200 (Success):**

```json
{
  "access_token": "eyJhbGciOiJSUzI1NiIs...",
  "refresh_token": "dGhpcyBpcyBhIHJlZnJlc2g...",
  "token_type": "Bearer",
  "expires_in": 3600,
  "user": {
    "id": "usr_abc123def456",
    "email": "user@example.com",
    "name": "Jane Doe"
  }
}
```

**Response 200 (MFA Required):**

```json
{
  "challenge": "MFA_REQUIRED",
  "session": "session_token_for_mfa",
  "mfa_methods": ["totp", "backup_code"]
}
```

**Response 401:**

```json
{
  "error": "invalid_credentials",
  "message": "Invalid email or password"
}
```

### Sign In with SSO

Initiate SSO sign-in flow.

```http
POST /auth/sso/initiate
Content-Type: application/json
```

**Request Body:**

```json
{
  "email": "user@company.com"
}
```

**Response 200:**

```json
{
  "sso_url": "https://idp.company.com/saml/sso?SAMLRequest=...",
  "provider": "saml",
  "provider_name": "Company SSO"
}
```

**Response 200 (No SSO):**

```json
{
  "sso_enabled": false,
  "message": "No SSO configured for this domain"
}
```

### SSO Callback

Handle SSO provider callback (internal use).

```http
POST /auth/sso/callback
Content-Type: application/x-www-form-urlencoded
```

### Sign Out

```http
POST /auth/signout
Authorization: Bearer <access_token>
```

**Request Body (optional):**

```json
{
  "all_devices": false
}
```

**Response 200:**

```json
{
  "success": true,
  "message": "Signed out successfully"
}
```

### Refresh Token

Exchange refresh token for new access token.

```http
POST /auth/refresh
Content-Type: application/json
```

**Request Body:**

```json
{
  "refresh_token": "dGhpcyBpcyBhIHJlZnJlc2g..."
}
```

**Response 200:**

```json
{
  "access_token": "eyJhbGciOiJSUzI1NiIs...",
  "refresh_token": "bmV3IHJlZnJlc2ggdG9rZW4...",
  "token_type": "Bearer",
  "expires_in": 3600
}
```

---

## Password Management

### Request Password Reset

```http
POST /auth/password/forgot
Content-Type: application/json
```

**Request Body:**

```json
{
  "email": "user@example.com"
}
```

**Response 200:**

```json
{
  "success": true,
  "message": "If an account exists, a reset link has been sent"
}
```

> **Note**: Always returns success to prevent email enumeration.

### Reset Password

```http
POST /auth/password/reset
Content-Type: application/json
```

**Request Body:**

```json
{
  "token": "reset_token_from_email",
  "password": "NewSecurePassword123!",
  "password_confirmation": "NewSecurePassword123!"
}
```

**Response 200:**

```json
{
  "success": true,
  "message": "Password reset successfully"
}
```

**Response 400:**

```json
{
  "error": "invalid_token",
  "message": "Reset token is invalid or expired"
}
```

### Change Password

```http
POST /auth/password/change
Authorization: Bearer <access_token>
Content-Type: application/json
```

**Request Body:**

```json
{
  "current_password": "OldPassword123!",
  "new_password": "NewSecurePassword456!",
  "new_password_confirmation": "NewSecurePassword456!"
}
```

**Response 200:**

```json
{
  "success": true,
  "message": "Password changed successfully",
  "sessions_revoked": true
}
```

### Validate Password Strength

```http
POST /auth/password/validate
Content-Type: application/json
```

**Request Body:**

```json
{
  "password": "TestPassword123!"
}
```

**Response 200:**

```json
{
  "valid": true,
  "score": 4,
  "requirements": {
    "min_length": { "required": 12, "met": true },
    "uppercase": { "required": true, "met": true },
    "lowercase": { "required": true, "met": true },
    "number": { "required": true, "met": true },
    "special": { "required": true, "met": true }
  },
  "suggestions": []
}
```

---

## Multi-Factor Authentication

### Get MFA Status

```http
GET /auth/mfa/status
Authorization: Bearer <access_token>
```

**Response 200:**

```json
{
  "enabled": true,
  "methods": [
    {
      "type": "totp",
      "enabled": true,
      "configured_at": "2024-06-15T10:30:00Z"
    }
  ],
  "backup_codes_remaining": 8,
  "trusted_devices": 2
}
```

### Setup TOTP

```http
POST /auth/mfa/totp/setup
Authorization: Bearer <access_token>
```

**Response 200:**

```json
{
  "secret": "JBSWY3DPEHPK3PXP",
  "qr_code": "data:image/png;base64,iVBORw0KGgo...",
  "otpauth_uri": "otpauth://totp/RADIANT:user@example.com?secret=JBSWY3DPEHPK3PXP&issuer=RADIANT"
}
```

### Verify and Enable TOTP

```http
POST /auth/mfa/totp/verify
Authorization: Bearer <access_token>
Content-Type: application/json
```

**Request Body:**

```json
{
  "code": "123456"
}
```

**Response 200:**

```json
{
  "success": true,
  "backup_codes": [
    "ABCD1234",
    "EFGH5678",
    "IJKL9012",
    "MNOP3456",
    "QRST7890",
    "UVWX1234",
    "YZAB5678",
    "CDEF9012",
    "GHIJ3456",
    "KLMN7890"
  ],
  "message": "MFA enabled. Save your backup codes securely."
}
```

### Verify MFA Code (During Sign-In)

```http
POST /auth/mfa/verify
Content-Type: application/json
```

**Request Body:**

```json
{
  "session": "session_token_from_signin",
  "code": "123456",
  "trust_device": true
}
```

**Response 200:**

```json
{
  "access_token": "eyJhbGciOiJSUzI1NiIs...",
  "refresh_token": "dGhpcyBpcyBhIHJlZnJlc2g...",
  "token_type": "Bearer",
  "expires_in": 3600,
  "device_trusted": true
}
```

### Use Backup Code

```http
POST /auth/mfa/backup/verify
Content-Type: application/json
```

**Request Body:**

```json
{
  "session": "session_token_from_signin",
  "backup_code": "ABCD1234"
}
```

**Response 200:**

```json
{
  "access_token": "eyJhbGciOiJSUzI1NiIs...",
  "refresh_token": "dGhpcyBpcyBhIHJlZnJlc2g...",
  "backup_codes_remaining": 7,
  "message": "Backup code used. 7 codes remaining."
}
```

### Regenerate Backup Codes

```http
POST /auth/mfa/backup/regenerate
Authorization: Bearer <access_token>
Content-Type: application/json
```

**Request Body:**

```json
{
  "mfa_code": "123456"
}
```

**Response 200:**

```json
{
  "backup_codes": [
    "NEWC1234",
    "ODES5678",
    "..."
  ],
  "message": "New backup codes generated. Previous codes are now invalid."
}
```

### Disable MFA

```http
POST /auth/mfa/disable
Authorization: Bearer <access_token>
Content-Type: application/json
```

**Request Body:**

```json
{
  "mfa_code": "123456",
  "password": "CurrentPassword123!"
}
```

**Response 200:**

```json
{
  "success": true,
  "message": "MFA disabled"
}
```

**Response 403:**

```json
{
  "error": "mfa_required",
  "message": "MFA cannot be disabled for your account type"
}
```

### Get Trusted Devices

```http
GET /auth/mfa/devices
Authorization: Bearer <access_token>
```

**Response 200:**

```json
{
  "devices": [
    {
      "id": "dev_abc123",
      "name": "Chrome on MacOS",
      "last_used": "2026-01-25T08:00:00Z",
      "trusted_at": "2026-01-20T10:00:00Z",
      "expires_at": "2026-02-19T10:00:00Z",
      "current": true
    },
    {
      "id": "dev_def456",
      "name": "Safari on iPhone",
      "last_used": "2026-01-24T15:30:00Z",
      "trusted_at": "2026-01-15T09:00:00Z",
      "expires_at": "2026-02-14T09:00:00Z",
      "current": false
    }
  ]
}
```

### Remove Trusted Device

```http
DELETE /auth/mfa/devices/{device_id}
Authorization: Bearer <access_token>
```

**Response 200:**

```json
{
  "success": true,
  "message": "Device removed from trusted list"
}
```

---

## Session Management

### List Active Sessions

```http
GET /auth/sessions
Authorization: Bearer <access_token>
```

**Response 200:**

```json
{
  "sessions": [
    {
      "id": "sess_abc123",
      "device": "Chrome on MacOS",
      "ip_address": "192.168.1.100",
      "location": "New York, US",
      "created_at": "2026-01-20T10:00:00Z",
      "last_activity": "2026-01-25T08:30:00Z",
      "current": true
    },
    {
      "id": "sess_def456",
      "device": "Safari on iPhone",
      "ip_address": "10.0.0.50",
      "location": "New York, US",
      "created_at": "2026-01-22T14:00:00Z",
      "last_activity": "2026-01-24T18:00:00Z",
      "current": false
    }
  ]
}
```

### Revoke Session

```http
DELETE /auth/sessions/{session_id}
Authorization: Bearer <access_token>
```

**Response 200:**

```json
{
  "success": true,
  "message": "Session revoked"
}
```

### Revoke All Other Sessions

```http
POST /auth/sessions/revoke-others
Authorization: Bearer <access_token>
```

**Response 200:**

```json
{
  "success": true,
  "revoked_count": 3,
  "message": "3 sessions revoked"
}
```

---

## OAuth 2.0 Endpoints

### Authorization Endpoint

```http
GET /oauth/authorize
```

**Query Parameters:**

| Parameter | Required | Description |
|-----------|----------|-------------|
| `client_id` | Yes | Application client ID |
| `redirect_uri` | Yes | Callback URL (must match registration) |
| `response_type` | Yes | `code` |
| `scope` | Yes | Space-separated scopes |
| `state` | Yes | CSRF protection token |
| `code_challenge` | Yes* | PKCE challenge (S256) |
| `code_challenge_method` | Yes* | `S256` |

**Example:**

```
GET /oauth/authorize?client_id=app_123&redirect_uri=https://myapp.com/callback&response_type=code&scope=openid%20profile&state=abc123&code_challenge=E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM&code_challenge_method=S256
```

### Token Endpoint

```http
POST /oauth/token
Content-Type: application/x-www-form-urlencoded
```

**Authorization Code Grant:**

```
grant_type=authorization_code
&code=AUTH_CODE
&redirect_uri=https://myapp.com/callback
&client_id=app_123
&client_secret=secret_456
&code_verifier=PKCE_VERIFIER
```

**Refresh Token Grant:**

```
grant_type=refresh_token
&refresh_token=REFRESH_TOKEN
&client_id=app_123
&client_secret=secret_456
```

**Client Credentials Grant:**

```
grant_type=client_credentials
&client_id=app_123
&client_secret=secret_456
&scope=read:data
```

**Response 200:**

```json
{
  "access_token": "eyJhbGciOiJSUzI1NiIs...",
  "token_type": "Bearer",
  "expires_in": 3600,
  "refresh_token": "dGhpcyBpcyBhIHJlZnJlc2g...",
  "scope": "openid profile"
}
```

### Token Introspection

```http
POST /oauth/introspect
Content-Type: application/x-www-form-urlencoded
Authorization: Basic base64(client_id:client_secret)
```

**Request:**

```
token=ACCESS_TOKEN
```

**Response 200:**

```json
{
  "active": true,
  "client_id": "app_123",
  "scope": "openid profile",
  "sub": "usr_abc123",
  "exp": 1706234567,
  "iat": 1706230967,
  "token_type": "Bearer"
}
```

### Token Revocation

```http
POST /oauth/revoke
Content-Type: application/x-www-form-urlencoded
Authorization: Basic base64(client_id:client_secret)
```

**Request:**

```
token=REFRESH_TOKEN
&token_type_hint=refresh_token
```

**Response 200:**

```json
{
  "success": true
}
```

### UserInfo Endpoint (OIDC)

```http
GET /oauth/userinfo
Authorization: Bearer <access_token>
```

**Response 200:**

```json
{
  "sub": "usr_abc123def456",
  "name": "Jane Doe",
  "given_name": "Jane",
  "family_name": "Doe",
  "email": "user@example.com",
  "email_verified": true,
  "picture": "https://cdn.radiant.ai/avatars/abc123.png"
}
```

---

## User Profile

### Update Profile

```http
PATCH /auth/profile
Authorization: Bearer <access_token>
Content-Type: application/json
```

**Request Body:**

```json
{
  "name": "Jane Smith",
  "language": "es",
  "timezone": "Europe/Madrid"
}
```

**Response 200:**

```json
{
  "id": "usr_abc123def456",
  "email": "user@example.com",
  "name": "Jane Smith",
  "language": "es",
  "timezone": "Europe/Madrid",
  "updated_at": "2026-01-25T10:00:00Z"
}
```

### Update Avatar

```http
POST /auth/profile/avatar
Authorization: Bearer <access_token>
Content-Type: multipart/form-data
```

**Request:**

```
avatar: (binary file, max 5MB, PNG/JPG/GIF)
```

**Response 200:**

```json
{
  "avatar_url": "https://cdn.radiant.ai/avatars/new_abc123.png"
}
```

---

## Error Responses

### Error Format

All errors follow this format:

```json
{
  "error": "error_code",
  "message": "Human-readable message",
  "details": { },
  "request_id": "req_abc123"
}
```

### Error Codes

| Code | HTTP Status | Description |
|------|-------------|-------------|
| `invalid_credentials` | 401 | Email or password incorrect |
| `account_locked` | 403 | Too many failed attempts |
| `account_suspended` | 403 | Account has been suspended |
| `mfa_required` | 401 | MFA verification needed |
| `mfa_invalid` | 401 | MFA code incorrect |
| `session_expired` | 401 | Session has expired |
| `token_invalid` | 401 | Token is invalid or expired |
| `token_revoked` | 401 | Token has been revoked |
| `insufficient_scope` | 403 | Token lacks required scope |
| `rate_limited` | 429 | Too many requests |
| `invalid_request` | 400 | Request validation failed |
| `not_found` | 404 | Resource not found |
| `server_error` | 500 | Internal server error |

### Validation Errors

```json
{
  "error": "validation_error",
  "message": "Validation failed",
  "details": {
    "fields": {
      "email": ["Invalid email format"],
      "password": ["Must be at least 12 characters"]
    }
  }
}
```

---

## Related Documentation

- [Authentication Overview](../authentication/overview.md)
- [OAuth Developer Guide](../authentication/oauth-guide.md)
- [Security Architecture](../security/authentication-architecture.md)


---

## Part IV: Search API

> **Version**: 5.52.29 | **Last Updated**: January 25, 2026 | **Base URL**: `https://api.radiant.ai/v1`

Complete API reference for RADIANT's multi-language full-text search capabilities, including CJK (Chinese, Japanese, Korean) bi-gram search.

---

## Table of Contents

1. [Overview](#overview)
2. [Search Endpoints](#search-endpoints)
3. [Language Detection](#language-detection)
4. [Search Methods](#search-methods)
5. [Filtering and Pagination](#filtering-and-pagination)
6. [Response Format](#response-format)
7. [Error Handling](#error-handling)

---

## Overview

RADIANT provides intelligent multi-language search across all content types, with automatic language detection and optimized search strategies for different language families.

### Supported Languages

| Language | Code | Search Method | Features |
|----------|------|---------------|----------|
| English | `en` | PostgreSQL FTS | Stemming, ranking |
| Spanish | `es` | PostgreSQL FTS | Stemming, ranking |
| French | `fr` | PostgreSQL FTS | Stemming, ranking |
| German | `de` | PostgreSQL FTS | Compound word handling |
| Portuguese | `pt` | PostgreSQL FTS | Stemming, ranking |
| Italian | `it` | PostgreSQL FTS | Stemming, ranking |
| Dutch | `nl` | PostgreSQL FTS | Stemming, ranking |
| Polish | `pl` | Simple FTS | Basic tokenization |
| Russian | `ru` | PostgreSQL FTS | Stemming, ranking |
| Turkish | `tr` | PostgreSQL FTS | Stemming, ranking |
| **Japanese** | `ja` | **pg_bigm** | Bi-gram indexing |
| **Korean** | `ko` | **pg_bigm** | Bi-gram indexing |
| **Chinese (Simplified)** | `zh-CN` | **pg_bigm** | Bi-gram indexing |
| **Chinese (Traditional)** | `zh-TW` | **pg_bigm** | Bi-gram indexing |
| Arabic | `ar` | Simple FTS | Basic tokenization |
| Hindi | `hi` | Simple FTS | Basic tokenization |
| Thai | `th` | Simple FTS | Basic tokenization |
| Vietnamese | `vi` | Simple FTS | Basic tokenization |

### Authentication

All search endpoints require authentication:

```http
Authorization: Bearer <access_token>
```

---

## Search Endpoints

### Universal Search

Search across all content types.

```http
POST /search
Authorization: Bearer <access_token>
Content-Type: application/json
```

**Request Body:**

```json
{
  "query": "machine learning",
  "types": ["sessions", "messages", "files", "artifacts"],
  "limit": 20,
  "offset": 0,
  "filters": {
    "created_after": "2025-01-01T00:00:00Z",
    "created_before": "2026-01-25T23:59:59Z"
  },
  "language_hint": null
}
```

**Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `query` | string | Yes | Search query (1-500 characters) |
| `types` | string[] | No | Content types to search (default: all) |
| `limit` | integer | No | Results per page (1-100, default: 20) |
| `offset` | integer | No | Pagination offset (default: 0) |
| `filters` | object | No | Additional filters |
| `language_hint` | string | No | Override language detection |

**Response 200:**

```json
{
  "results": [
    {
      "id": "sess_abc123",
      "type": "session",
      "title": "Machine Learning Project Discussion",
      "snippet": "...exploring various <mark>machine learning</mark> algorithms for...",
      "relevance_score": 0.95,
      "created_at": "2026-01-20T10:30:00Z",
      "updated_at": "2026-01-24T15:00:00Z"
    },
    {
      "id": "msg_def456",
      "type": "message",
      "session_id": "sess_xyz789",
      "snippet": "...the <mark>machine learning</mark> model achieved 95% accuracy...",
      "relevance_score": 0.87,
      "created_at": "2026-01-22T14:00:00Z"
    }
  ],
  "total": 42,
  "limit": 20,
  "offset": 0,
  "detected_language": "en",
  "search_method": "fts",
  "query_time_ms": 45
}
```

### Search Sessions

Search within Think Tank sessions.

```http
POST /search/sessions
Authorization: Bearer <access_token>
Content-Type: application/json
```

**Request Body:**

```json
{
  "query": "プロジェクト計画",
  "limit": 20,
  "filters": {
    "workspace_id": "ws_abc123",
    "created_after": "2025-01-01T00:00:00Z"
  }
}
```

**Response 200:**

```json
{
  "results": [
    {
      "id": "sess_abc123",
      "title": "プロジェクト計画ミーティング",
      "snippet": "...新しい<mark>プロジェクト計画</mark>について議論しました...",
      "message_count": 45,
      "relevance_score": 0.92,
      "created_at": "2026-01-15T09:00:00Z",
      "last_message_at": "2026-01-24T18:30:00Z"
    }
  ],
  "total": 8,
  "detected_language": "ja",
  "search_method": "pg_bigm"
}
```

### Search Messages

Search within session messages.

```http
POST /search/messages
Authorization: Bearer <access_token>
Content-Type: application/json
```

**Request Body:**

```json
{
  "query": "API integration",
  "session_id": "sess_abc123",
  "limit": 50
}
```

**Response 200:**

```json
{
  "results": [
    {
      "id": "msg_def456",
      "session_id": "sess_abc123",
      "role": "assistant",
      "snippet": "...the <mark>API integration</mark> requires the following steps...",
      "relevance_score": 0.89,
      "created_at": "2026-01-20T11:30:00Z"
    }
  ],
  "total": 15,
  "detected_language": "en",
  "search_method": "fts"
}
```

### Search Files

Search within uploaded files and documents.

```http
POST /search/files
Authorization: Bearer <access_token>
Content-Type: application/json
```

**Request Body:**

```json
{
  "query": "quarterly report",
  "file_types": ["pdf", "docx"],
  "limit": 20
}
```

**Response 200:**

```json
{
  "results": [
    {
      "id": "file_abc123",
      "name": "Q4-2025-Report.pdf",
      "snippet": "...the <mark>quarterly report</mark> shows significant growth...",
      "file_type": "pdf",
      "size_bytes": 2456789,
      "relevance_score": 0.94,
      "uploaded_at": "2026-01-10T08:00:00Z"
    }
  ],
  "total": 5,
  "detected_language": "en",
  "search_method": "fts"
}
```

### Search Artifacts

Search within generated artifacts (code, documents, etc.).

```http
POST /search/artifacts
Authorization: Bearer <access_token>
Content-Type: application/json
```

**Request Body:**

```json
{
  "query": "React component",
  "artifact_types": ["code", "document"],
  "limit": 20
}
```

**Response 200:**

```json
{
  "results": [
    {
      "id": "art_xyz789",
      "title": "UserProfile React Component",
      "type": "code",
      "language": "typescript",
      "snippet": "...export const UserProfile: <mark>React</mark>.<mark>Component</mark>...",
      "relevance_score": 0.91,
      "session_id": "sess_abc123",
      "created_at": "2026-01-18T14:00:00Z"
    }
  ],
  "total": 12,
  "detected_language": "en",
  "search_method": "fts"
}
```

---

## Language Detection

### Detect Language

Detect the primary language of text.

```http
POST /search/detect-language
Authorization: Bearer <access_token>
Content-Type: application/json
```

**Request Body:**

```json
{
  "text": "这是一个测试文本，用于检测语言"
}
```

**Response 200:**

```json
{
  "detected_language": "zh-CN",
  "confidence": 0.98,
  "script": "han",
  "search_method": "pg_bigm",
  "alternatives": [
    { "language": "zh-TW", "confidence": 0.85 },
    { "language": "ja", "confidence": 0.12 }
  ]
}
```

### Detection Algorithm

```mermaid
flowchart TD
    A[Input Text] --> B{Contains CJK?}
    B -->|Yes| C{Which CJK?}
    B -->|No| D{Contains Arabic?}
    
    C -->|Hiragana/Katakana| E[Japanese]
    C -->|Hangul| F[Korean]
    C -->|Han only| G[Chinese]
    
    G --> H{Simplified chars?}
    H -->|Yes| I[zh-CN]
    H -->|No| J[zh-TW]
    
    D -->|Yes| K[Arabic]
    D -->|No| L{Contains Cyrillic?}
    
    L -->|Yes| M[Russian]
    L -->|No| N[Latin-based detection]
    
    N --> O[Trigram analysis]
    O --> P[Most likely language]
```

---

## Search Methods

### PostgreSQL Full-Text Search (FTS)

Used for Western languages with word boundaries.

**Features:**
- Stemming (running → run)
- Stop word removal
- Relevance ranking (ts_rank)
- Phrase search (`"exact phrase"`)
- Prefix matching (`machine*`)

**Example Query Processing:**

```
Input: "machine learning algorithms"
↓
Stemmed: machine learn algorithm
↓
tsvector: 'algorithm':3 'learn':2 'machin':1
```

### pg_bigm Bi-gram Search

Used for CJK languages without word boundaries.

**Features:**
- Character bi-gram indexing
- Substring matching
- No dictionary required
- Fuzzy matching support

**Example Query Processing (Japanese):**

```
Input: "人工知能"
↓
Bi-grams: "人工", "工知", "知能"
↓
Search: LIKE '%人工%' AND LIKE '%工知%' AND LIKE '%知能%'
(optimized via GIN index)
```

### Simple Search

Used for languages without dedicated FTS support.

**Features:**
- Basic word tokenization
- No stemming
- Case-insensitive matching

---

## Filtering and Pagination

### Available Filters

| Filter | Type | Description |
|--------|------|-------------|
| `created_after` | ISO 8601 | Results created after this date |
| `created_before` | ISO 8601 | Results created before this date |
| `workspace_id` | string | Filter by workspace |
| `session_id` | string | Filter by session |
| `file_types` | string[] | Filter by file extensions |
| `artifact_types` | string[] | Filter by artifact type |

### Pagination

```json
{
  "query": "search term",
  "limit": 20,
  "offset": 40
}
```

| Parameter | Default | Maximum |
|-----------|---------|---------|
| `limit` | 20 | 100 |
| `offset` | 0 | 10000 |

### Cursor-Based Pagination (Recommended)

For large result sets, use cursor pagination:

```http
POST /search
Content-Type: application/json
```

**First Request:**

```json
{
  "query": "data analysis",
  "limit": 20
}
```

**Response:**

```json
{
  "results": [...],
  "total": 500,
  "next_cursor": "eyJvZmZzZXQiOjIwfQ==",
  "has_more": true
}
```

**Next Request:**

```json
{
  "query": "data analysis",
  "limit": 20,
  "cursor": "eyJvZmZzZXQiOjIwfQ=="
}
```

---

## Response Format

### Result Object

```json
{
  "id": "string",
  "type": "session | message | file | artifact",
  "title": "string (if applicable)",
  "snippet": "string with <mark>highlighted</mark> matches",
  "relevance_score": 0.0-1.0,
  "created_at": "ISO 8601",
  "updated_at": "ISO 8601 (if applicable)",
  "metadata": {}
}
```

### Snippet Highlighting

Matched terms are wrapped in `<mark>` tags:

```json
{
  "snippet": "The <mark>machine learning</mark> model uses <mark>neural networks</mark>..."
}
```

Configure highlighting:

```json
{
  "query": "machine learning",
  "highlight": {
    "pre_tag": "<em class='highlight'>",
    "post_tag": "</em>",
    "max_length": 200
  }
}
```

### Metadata by Type

**Session:**
```json
{
  "message_count": 45,
  "participant_count": 1,
  "workspace_id": "ws_abc123"
}
```

**Message:**
```json
{
  "session_id": "sess_abc123",
  "role": "user | assistant",
  "message_index": 15
}
```

**File:**
```json
{
  "file_type": "pdf",
  "size_bytes": 2456789,
  "page_count": 25
}
```

**Artifact:**
```json
{
  "artifact_type": "code | document | image",
  "language": "typescript",
  "session_id": "sess_abc123"
}
```

---

## Error Handling

### Error Response Format

```json
{
  "error": "error_code",
  "message": "Human-readable description",
  "details": {},
  "request_id": "req_abc123"
}
```

### Error Codes

| Code | HTTP Status | Description |
|------|-------------|-------------|
| `invalid_query` | 400 | Query is empty or too long |
| `invalid_filter` | 400 | Invalid filter parameter |
| `invalid_language` | 400 | Unknown language code |
| `unauthorized` | 401 | Missing or invalid token |
| `forbidden` | 403 | No access to resource |
| `rate_limited` | 429 | Too many requests |
| `search_timeout` | 504 | Search took too long |
| `internal_error` | 500 | Server error |

### Rate Limits

| Endpoint | Limit | Window |
|----------|-------|--------|
| `/search` | 60 requests | 1 minute |
| `/search/*` | 100 requests | 1 minute |
| `/search/detect-language` | 120 requests | 1 minute |

---

## Examples

### CJK Search Example (Japanese)

```http
POST /search/sessions
Authorization: Bearer <access_token>
Content-Type: application/json

{
  "query": "人工知能の研究",
  "limit": 10
}
```

**Response:**

```json
{
  "results": [
    {
      "id": "sess_jp001",
      "title": "人工知能プロジェクト",
      "snippet": "...<mark>人工知能</mark>の<mark>研究</mark>における最新の進展...",
      "relevance_score": 0.94
    }
  ],
  "detected_language": "ja",
  "search_method": "pg_bigm",
  "query_time_ms": 32
}
```

### Mixed Language Search

```http
POST /search
Authorization: Bearer <access_token>
Content-Type: application/json

{
  "query": "AI 인공지능 development",
  "limit": 20
}
```

**Response:**

```json
{
  "results": [...],
  "detected_language": "ko",
  "search_method": "pg_bigm",
  "note": "Mixed-language query detected. CJK method used for best coverage."
}
```

### Advanced Filtering

```http
POST /search
Authorization: Bearer <access_token>
Content-Type: application/json

{
  "query": "project planning",
  "types": ["sessions", "artifacts"],
  "filters": {
    "workspace_id": "ws_main",
    "created_after": "2026-01-01T00:00:00Z",
    "artifact_types": ["document"]
  },
  "limit": 50
}
```

---

## Performance Considerations

### Query Optimization Tips

| Tip | Reason |
|-----|--------|
| Use specific queries | Reduces result set size |
| Filter by type when possible | Limits tables to search |
| Use date filters | Indexes are date-partitioned |
| Avoid leading wildcards | Cannot use index efficiently |

### Index Architecture

```mermaid
graph LR
    subgraph "Western Languages"
        FTS[GIN tsvector index]
    end
    
    subgraph "CJK Languages"
        BIGM[GIN pg_bigm index]
    end
    
    subgraph "Tables"
        SESS[sessions]
        MSG[messages]
        FILES[files]
        ART[artifacts]
    end
    
    FTS --> SESS
    FTS --> MSG
    FTS --> FILES
    FTS --> ART
    
    BIGM --> SESS
    BIGM --> MSG
    BIGM --> FILES
    BIGM --> ART
```

---

## Related Documentation

- [Internationalization Guide](../authentication/i18n-guide.md)
- [Authentication API](./authentication-api.md)
- [Section 41: Internationalization](../sections/SECTION-41-INTERNATIONALIZATION.md)


---

## Part V: Error Codes

Standardized error codes for consistent API responses across all RADIANT services.

## Overview

All RADIANT errors follow a consistent format:

```json
{
  "error": {
    "code": "RADIANT_AUTH_1001",
    "message": "Invalid authentication token. Please sign in again.",
    "category": "authentication",
    "retryable": false,
    "timestamp": "2024-12-25T10:30:00.000Z"
  }
}
```

## Error Code Format

```
RADIANT_<CATEGORY>_<NUMBER>
```

- **RADIANT** - Prefix for all error codes
- **CATEGORY** - Short category identifier (AUTH, VAL, RES, etc.)
- **NUMBER** - Unique 4-digit number within category

---

## Authentication Errors (1xxx)

Errors related to authentication and identity.

| Code | HTTP | Retryable | Description |
|------|------|-----------|-------------|
| `RADIANT_AUTH_1001` | 401 | ❌ | Invalid authentication token |
| `RADIANT_AUTH_1002` | 401 | ❌ | Token has expired |
| `RADIANT_AUTH_1003` | 401 | ❌ | Missing authentication token |
| `RADIANT_AUTH_1004` | 401 | ❌ | Invalid API key |
| `RADIANT_AUTH_1005` | 401 | ❌ | API key has expired |
| `RADIANT_AUTH_1006` | 401 | ❌ | API key has been revoked |
| `RADIANT_AUTH_1007` | 403 | ❌ | Insufficient API key scope |
| `RADIANT_AUTH_1008` | 401 | ❌ | Multi-factor authentication required |
| `RADIANT_AUTH_1009` | 401 | ❌ | Session has expired |

---

## Authorization Errors (2xxx)

Errors related to permissions and access control.

| Code | HTTP | Retryable | Description |
|------|------|-----------|-------------|
| `RADIANT_AUTHZ_2001` | 403 | ❌ | Forbidden - access denied |
| `RADIANT_AUTHZ_2002` | 403 | ❌ | Tenant ID mismatch |
| `RADIANT_AUTHZ_2003` | 403 | ❌ | Required role not assigned |
| `RADIANT_AUTHZ_2004` | 403 | ❌ | Permission denied |
| `RADIANT_AUTHZ_2005` | 403 | ❌ | Resource access denied |
| `RADIANT_AUTHZ_2006` | 403 | ❌ | Subscription tier insufficient |

---

## Validation Errors (3xxx)

Errors related to input validation.

| Code | HTTP | Retryable | Description |
|------|------|-----------|-------------|
| `RADIANT_VAL_3001` | 400 | ❌ | Required field is missing |
| `RADIANT_VAL_3002` | 400 | ❌ | Invalid field format |
| `RADIANT_VAL_3003` | 400 | ❌ | Value out of allowed range |
| `RADIANT_VAL_3004` | 400 | ❌ | Invalid data type |
| `RADIANT_VAL_3005` | 400 | ❌ | Constraint violation |
| `RADIANT_VAL_3006` | 400 | ❌ | Schema mismatch |
| `RADIANT_VAL_3007` | 400 | ❌ | Invalid JSON in request body |
| `RADIANT_VAL_3008` | 400 | ❌ | Maximum length exceeded |
| `RADIANT_VAL_3009` | 400 | ❌ | Minimum length required |

---

## Resource Errors (4xxx)

Errors related to resources and entities.

| Code | HTTP | Retryable | Description |
|------|------|-----------|-------------|
| `RADIANT_RES_4001` | 404 | ❌ | Resource not found |
| `RADIANT_RES_4002` | 409 | ❌ | Resource already exists |
| `RADIANT_RES_4003` | 410 | ❌ | Resource has been deleted |
| `RADIANT_RES_4004` | 423 | ✅ | Resource is locked |
| `RADIANT_RES_4005` | 409 | ✅ | Resource conflict |
| `RADIANT_RES_4006` | 429 | ❌ | Resource quota exceeded |

---

## Rate Limiting Errors (5xxx)

Errors related to rate limiting and throttling.

| Code | HTTP | Retryable | Description |
|------|------|-----------|-------------|
| `RADIANT_RATE_5001` | 429 | ✅ | Rate limit exceeded |
| `RADIANT_RATE_5002` | 429 | ✅ | Tenant rate limit exceeded |
| `RADIANT_RATE_5003` | 429 | ✅ | User rate limit exceeded |
| `RADIANT_RATE_5004` | 429 | ✅ | API key rate limit exceeded |
| `RADIANT_RATE_5005` | 429 | ✅ | Model rate limit exceeded |
| `RADIANT_RATE_5006` | 429 | ✅ | Burst limit exceeded |

**Retry-After Header:** Rate limit errors include `Retry-After` header with seconds to wait.

---

## AI/Model Errors (6xxx)

Errors related to AI models and inference.

| Code | HTTP | Retryable | Description |
|------|------|-----------|-------------|
| `RADIANT_AI_6001` | 404 | ❌ | Model not found |
| `RADIANT_AI_6002` | 503 | ✅ | Model temporarily unavailable |
| `RADIANT_AI_6003` | 503 | ✅ | Model overloaded |
| `RADIANT_AI_6004` | 502 | ✅ | AI provider error |
| `RADIANT_AI_6005` | 400 | ❌ | Context length exceeded |
| `RADIANT_AI_6006` | 400 | ❌ | Content filtered by safety |
| `RADIANT_AI_6007` | 400 | ❌ | Invalid AI request |
| `RADIANT_AI_6008` | 500 | ✅ | Streaming error |
| `RADIANT_AI_6009` | 504 | ✅ | AI request timeout |
| `RADIANT_AI_6010` | 503 | ✅ | Model is cold (warming up) |

---

## Billing Errors (7xxx)

Errors related to billing, credits, and subscriptions.

| Code | HTTP | Retryable | Description |
|------|------|-----------|-------------|
| `RADIANT_BILL_7001` | 402 | ❌ | Insufficient credits |
| `RADIANT_BILL_7002` | 402 | ❌ | Payment required |
| `RADIANT_BILL_7003` | 402 | ❌ | Payment failed |
| `RADIANT_BILL_7004` | 402 | ❌ | Subscription expired |
| `RADIANT_BILL_7005` | 402 | ❌ | Subscription cancelled |
| `RADIANT_BILL_7006` | 400 | ❌ | Invalid coupon code |
| `RADIANT_BILL_7007` | 429 | ❌ | Usage quota exceeded |

---

## Storage Errors (8xxx)

Errors related to file storage.

| Code | HTTP | Retryable | Description |
|------|------|-----------|-------------|
| `RADIANT_STOR_8001` | 413 | ❌ | Storage quota exceeded |
| `RADIANT_STOR_8002` | 413 | ❌ | File too large |
| `RADIANT_STOR_8003` | 415 | ❌ | Invalid file type |
| `RADIANT_STOR_8004` | 500 | ✅ | Upload failed |
| `RADIANT_STOR_8005` | 404 | ❌ | File not found |

---

## Internal Errors (9xxx)

Internal server errors and system failures.

| Code | HTTP | Retryable | Description |
|------|------|-----------|-------------|
| `RADIANT_INT_9001` | 500 | ✅ | Internal server error |
| `RADIANT_INT_9002` | 500 | ✅ | Database error |
| `RADIANT_INT_9003` | 500 | ✅ | Cache error |
| `RADIANT_INT_9004` | 500 | ✅ | Queue processing error |
| `RADIANT_INT_9005` | 503 | ✅ | Service unavailable |
| `RADIANT_INT_9006` | 502 | ✅ | Dependency failure |
| `RADIANT_INT_9007` | 500 | ❌ | Configuration error |
| `RADIANT_INT_9008` | 504 | ✅ | Request timeout |

---

## Usage in Code

### TypeScript/JavaScript

```typescript
import { 
  ErrorCodes, 
  RadiantError, 
  createNotFoundError,
  createValidationError,
  isRetryableError 
} from '@radiant/shared';

// Using factory functions (recommended)
throw createNotFoundError('User', userId);
throw createValidationError('Email is required', 'email');

// Direct construction
throw new RadiantError(ErrorCodes.AUTH_INVALID_TOKEN, 'Custom message', {
  details: { tokenPrefix: 'rad_...' },
  requestId: context.awsRequestId,
});

// Check if retryable
if (isRetryableError(error.code)) {
  // Implement retry logic
}
```

### Response Format

```typescript
// RadiantError automatically formats responses
const error = new RadiantError(ErrorCodes.RESOURCE_NOT_FOUND);
return error.toResponse();

// Returns:
// {
//   statusCode: 404,
//   headers: { 'Content-Type': 'application/json' },
//   body: '{"error":{"code":"RADIANT_RES_4001","message":"Resource not found.","category":"resource","retryable":false,"timestamp":"..."}}'
// }
```

---

## Client Handling

### Retry Logic

```typescript
async function callWithRetry(fn: () => Promise<Response>, maxRetries = 3) {
  for (let i = 0; i < maxRetries; i++) {
    try {
      const response = await fn();
      if (response.ok) return response;
      
      const error = await response.json();
      if (!error.error.retryable) throw error;
      
      const retryAfter = response.headers.get('Retry-After') || '5';
      await sleep(parseInt(retryAfter) * 1000);
    } catch (e) {
      if (i === maxRetries - 1) throw e;
    }
  }
}
```

### Error Display

```typescript
function getUserMessage(error: RadiantError): string {
  // Error codes include user-friendly messages
  return error.message;
}

function shouldShowRetryButton(error: RadiantError): boolean {
  return error.retryable;
}
```

---

## Adding New Error Codes

1. Add the code to `packages/shared/src/errors/codes.ts`:

```typescript
export const ErrorCodes = {
  // ... existing codes
  MY_NEW_ERROR: 'RADIANT_CAT_NNNN',
} as const;
```

2. Add metadata:

```typescript
export const ErrorCodeMetadata: Record<ErrorCode, {...}> = {
  // ... existing metadata
  [ErrorCodes.MY_NEW_ERROR]: {
    httpStatus: 400,
    category: 'category',
    retryable: false,
    userMessage: 'User-friendly error message.',
  },
};
```

3. Update this documentation.

---

## See Also

- [API Reference](API_REFERENCE.md)
- [Contributing Guide](../CONTRIBUTING.md)
- [Troubleshooting](TROUBLESHOOTING.md)


---

## Part VI: Service Layer

> **Version:** 5.52.5  
> **Last Updated:** January 2026  
> **Audience:** Platform Administrators, Developers, Integration Partners

This guide covers RADIANT's three external service interfaces: **API**, **MCP** (Model Context Protocol), and **A2A** (Agent-to-Agent). These interfaces enable external applications, AI assistants, and autonomous agents to interact with the RADIANT platform.

---

## Table of Contents

1. [Overview](#1-overview)
2. [API Interface](#2-api-interface)
3. [MCP Interface](#3-mcp-interface)
4. [A2A Interface](#4-a2a-interface)
5. [Multi-Protocol Gateway Architecture](#5-multi-protocol-gateway-architecture)
6. [API Keys & Authentication](#6-api-keys--authentication)
7. [Cedar Authorization Policies](#7-cedar-authorization-policies)
8. [Admin Dashboard](#8-admin-dashboard)
9. [Database Schema](#9-database-schema)
10. [Troubleshooting](#10-troubleshooting)
11. [MLS (Message Layer Security) for A2A Encryption](#11-mls-message-layer-security-for-a2a-encryption)

---

## 1. Overview

RADIANT exposes three distinct service interfaces, each designed for different integration patterns:

| Interface | Protocol | Authentication | Use Cases |
|-----------|----------|----------------|-----------|
| **API** | REST/HTTP | API Key, OAuth | Web apps, mobile apps, Zapier, Make |
| **MCP** | JSON-RPC over WebSocket | API Key | Claude Desktop, Cursor, AI assistants |
| **A2A** | Custom over WebSocket | mTLS + API Key | Autonomous agents, multi-agent systems |

### Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              INTERNET                                        │
└─────────────────────────────────┬───────────────────────────────────────────┘
                                  │
                                  ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                     NETWORK LOAD BALANCER (NLB)                              │
└─────────────────────────────────┬───────────────────────────────────────────┘
                                  │
                                  ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                    GO CONNECTIVITY GATEWAY FLEET                             │
│  • TLS/mTLS termination                                                      │
│  • Protocol detection (API, MCP, A2A)                                        │
│  • WebSocket/SSE upgrade                                                     │
│  • Session management                                                        │
│  • Resume token handling                                                     │
└─────────────────────────────────┬───────────────────────────────────────────┘
                                  │
                                  ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                         NATS JETSTREAM CLUSTER                               │
│  • INBOX stream: in.{protocol}.{tenant}.{agent}                             │
│  • OUTBOX stream: out.{session_id}                                          │
│  • HISTORY stream: history.{session_id}                                     │
└─────────────────────────────────┬───────────────────────────────────────────┘
                                  │
                                  ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                         LAMBDA WORKER FLEET                                  │
│  • mcp-workers: MCP JSON-RPC processing                                     │
│  • a2a-workers: A2A protocol handling                                       │
│  • api-workers: REST API requests                                           │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 2. API Interface

The REST API interface provides traditional HTTP-based access to RADIANT services.

### Base URL

```
https://api.{your-domain}/v1
```

### Authentication

```http
Authorization: Bearer rad_sk_xxxxxxxxxxxx
```

### Key Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/chat/completions` | POST | Send chat messages |
| `/models` | GET | List available models |
| `/models/{id}` | GET | Get model details |
| `/sessions` | POST | Create chat session |
| `/sessions/{id}/messages` | POST | Send message to session |
| `/knowledge/search` | POST | Search knowledge base |
| `/files/upload` | POST | Upload file |

### Tenant API (Service Layer)

The Tenant API provides tenant-isolated access for applications that sit behind the service layer (e.g., Think Tank Tenant Admin). All requests are authenticated via JWT with `tenant_id` claim.

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/tenant/cartridges` | GET | List tenant's cartridges (includes system read-only) — see [24-CARTRIDGE-SPECIALIZATIONS.md](./24-CARTRIDGE-SPECIALIZATIONS.md) for brain-mapped specialization taxonomy |
| `/tenant/cartridges` | POST | Create tenant cartridge |
| `/tenant/cartridges/{id}` | GET | Get cartridge (tenant or system read-only) |
| `/tenant/cartridges/{id}` | PATCH | Update tenant cartridge |
| `/tenant/cartridges/{id}` | DELETE | Archive tenant cartridge |
| `/tenant/cartridges/stack` | GET | Get cartridge stack (system → tenant → user) |
| `/tenant/cartridges/{id}/activate` | POST | Activate cartridge |
| `/tenant/cartridges/{id}/deactivate` | POST | Deactivate cartridge |
| `/tenant/cartridges/export` | POST | Export tenant cartridges to .RADz |
| `/tenant/cartridges/import` | POST | Import .RADz file |

**Tenant Isolation**: Tenants can only see their own cartridges plus system cartridges (read-only). They cannot see other tenants' cartridges or modify system cartridges.

### Scopes

| Scope | Description |
|-------|-------------|
| `chat` | Basic chat access |
| `chat:write` | Create/modify conversations |
| `chat:delete` | Delete conversations |
| `models` | List and use models |
| `knowledge:read` | Read from knowledge base |
| `knowledge:write` | Write to knowledge base |
| `files:read` | Read uploaded files |
| `files:write` | Upload files |
| `agents:execute` | Execute agent tools |

### Example: Chat Completion

```bash
curl -X POST https://api.example.com/v1/chat/completions \
  -H "Authorization: Bearer rad_sk_xxxxxxxxxxxx" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "claude-3-5-sonnet",
    "messages": [
      {"role": "user", "content": "Hello, world!"}
    ]
  }'
```

---

## 3. MCP Interface

The Model Context Protocol (MCP) interface enables AI assistants like Claude Desktop and Cursor to use RADIANT as a tool provider.

### Protocol Version

RADIANT supports MCP protocol versions:
- `2024-11-05` (stable)
- `2025-03-26` (latest)

### Connection

```javascript
// MCP client configuration
{
  "mcpServers": {
    "radiant": {
      "url": "wss://gateway.{your-domain}/mcp",
      "apiKey": "rad_mcp_xxxxxxxxxxxx"
    }
  }
}
```

### Capabilities

| Capability | Supported | Description |
|------------|-----------|-------------|
| `tools` | ✅ | Tool execution |
| `tools.listChanged` | ✅ | Dynamic tool updates |
| `resources` | ✅ | Resource access |
| `resources.subscribe` | ✅ | Resource subscriptions |
| `prompts` | ✅ | Prompt templates |
| `logging` | ✅ | Logging support |

### MCP Methods

| Method | Description |
|--------|-------------|
| `initialize` | Initialize MCP session |
| `ping` | Health check |
| `tools/list` | List available tools |
| `tools/call` | Execute a tool |
| `resources/list` | List available resources |
| `resources/read` | Read resource content |
| `prompts/list` | List prompt templates |
| `prompts/get` | Get prompt template |

### Built-in Tools

| Tool | Description | Input Schema |
|------|-------------|--------------|
| `search` | Search knowledge base | `query: string, limit?: number` |
| `calculate` | Math calculations | `expression: string` |
| `fetch_data` | Fetch data from sources | `source: string, limit?: number` |

### Example: Tool Call

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "tools/call",
  "params": {
    "name": "search",
    "arguments": {
      "query": "RADIANT deployment guide",
      "limit": 5
    }
  }
}
```

### Response

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "result": {
    "content": [
      {
        "type": "text",
        "text": "Search results for \"RADIANT deployment guide\":\n\n1. [guide] RADIANT Deployment Guide (confidence: 95%)\n..."
      }
    ]
  }
}
```

### MCP Worker Implementation

**File:** `packages/infrastructure/lambda/gateway/mcp-worker.ts`

Key features:
- JSON-RPC 2.0 message processing
- Cedar policy authorization for each tool call
- Dual-publish responses to NATS and JetStream
- Metrics collection per method
- SQS event source for message delivery

**CDK Deployment:** `packages/infrastructure/lib/stacks/gateway-stack.ts`

```typescript
// MCP Worker Lambda with SQS trigger
this.mcpWorkerLambda = new lambda.Function(this, 'MCPWorker', {
  functionName: `${appId}-${environment}-mcp-worker`,
  runtime: lambda.Runtime.NODEJS_20_X,
  handler: 'gateway/mcp-worker.handler',
  memorySize: 1024,
  timeout: cdk.Duration.seconds(60),
});

// SQS Queue for message buffering
const mcpWorkerQueue = new sqs.Queue(this, 'MCPWorkerQueue', {
  visibilityTimeout: cdk.Duration.seconds(300),
  deadLetterQueue: { queue: mcpWorkerDLQ, maxReceiveCount: 3 },
});
```

---

## 4. A2A Interface

The Agent-to-Agent (A2A) interface enables autonomous agents to communicate with each other through RADIANT.

### Security Model

A2A requires **mTLS authentication** by default:

```
┌──────────────┐     mTLS      ┌──────────────┐
│   Agent A    │ ◄──────────► │   Gateway    │
│  (Client)    │               │   (Server)   │
└──────────────┘               └──────────────┘
```

### Message Types

| Type | Direction | Description |
|------|-----------|-------------|
| `register` | Agent → Server | Register agent in registry |
| `discover` | Agent → Server | Discover other agents |
| `message` | Agent → Agent | Direct message |
| `broadcast` | Agent → All | Broadcast to topic |
| `request` | Agent → Agent | Request with expected response |
| `response` | Agent → Agent | Response to request |
| `subscribe` | Agent → Server | Subscribe to topic |
| `unsubscribe` | Agent → Server | Unsubscribe from topic |
| `heartbeat` | Agent → Server | Keep-alive |
| `acquire_lock` | Agent → Server | Acquire resource lock |
| `release_lock` | Agent → Server | Release resource lock |
| `task_start` | Agent → All | Announce task start |
| `task_update` | Agent → All | Task progress update |
| `task_complete` | Agent → All | Task completion |

### Agent Registration

```json
{
  "messageType": "register",
  "payload": {
    "agentName": "data-processor",
    "agentType": "worker",
    "agentVersion": "1.0.0",
    "capabilities": ["data_processing", "file_conversion"],
    "webhookUrl": "https://agent.example.com/webhook"
  }
}
```

### Agent Discovery

```json
{
  "messageType": "discover",
  "payload": {
    "filterType": "worker",
    "filterCapabilities": ["data_processing"]
  }
}
```

### Response

```json
{
  "success": true,
  "messageType": "discover_response",
  "data": {
    "agents": [
      {
        "agentId": "agent_abc123",
        "agentName": "data-processor",
        "agentType": "worker",
        "capabilities": ["data_processing", "file_conversion"],
        "status": "active",
        "lastSeen": "2026-01-25T14:30:00Z"
      }
    ],
    "total": 1
  }
}
```

### Direct Messaging

```json
{
  "messageType": "message",
  "toAgentId": "agent_xyz789",
  "payload": {
    "content": {"task": "process_file", "fileId": "file_123"},
    "contentType": "application/json",
    "priority": "high"
  }
}
```

### Resource Locking

Agents can acquire exclusive locks on shared resources:

```json
{
  "messageType": "acquire_lock",
  "payload": {
    "resourceUri": "radiant://files/report.pdf",
    "lockType": "write",
    "lockTimeout": 300
  }
}
```

### A2A Worker Implementation

**File:** `packages/infrastructure/lambda/gateway/a2a-worker.ts`

Key features:
- mTLS verification
- Agent registry management
- NATS JetStream integration
- Resource locking coordination
- Task event broadcasting
- Comprehensive audit logging
- SQS event source for message delivery

**CDK Deployment:** `packages/infrastructure/lib/stacks/gateway-stack.ts`

```typescript
// A2A Worker Lambda with SQS trigger
this.a2aWorkerLambda = new lambda.Function(this, 'A2AWorker', {
  functionName: `${appId}-${environment}-a2a-worker`,
  runtime: lambda.Runtime.NODEJS_20_X,
  handler: 'gateway/a2a-worker.handler',
  memorySize: 1024,
  timeout: cdk.Duration.seconds(60),
});

// SQS Queue for A2A message buffering
const a2aWorkerQueue = new sqs.Queue(this, 'A2AWorkerQueue', {
  visibilityTimeout: cdk.Duration.seconds(300),
  deadLetterQueue: { queue: a2aWorkerDLQ, maxReceiveCount: 3 },
});
```

---

## 5. Multi-Protocol Gateway Architecture

The Go Connectivity Gateway handles all three protocols with a unified architecture.

### Gateway Configuration

**File:** `apps/gateway/internal/config/config.go`

```go
type Config struct {
    ListenAddr           string        // :8443
    TLSCertFile          string
    TLSKeyFile           string
    MTLSCACertFile       string        // For A2A
    NATSUrl              string
    MaxConnectionsPerNode int          // 80,000
    SessionTimeout       time.Duration // 1 hour
    ResumeTokenTTL       time.Duration // 1 hour
}
```

### Session Management

Each connection maintains a `SessionContext`:

```go
type SessionContext struct {
    SessionID      string    // Survives reconnects
    ConnectionID   string    // Current connection
    TenantID       string
    PrincipalID    string
    PrincipalType  string    // user, agent, service
    AuthType       string    // mtls, oidc, apikey
    Protocol       string    // mcp, a2a, api
    InboxSubject   string    // in.{protocol}.{tenant}.{agent}
    OutboxSubject  string    // out.{session_id}
    ResumeToken    string
    Expiry         time.Time
}
```

### Resume Tokens

Sessions can be resumed after disconnection:

```go
type ResumeTokenData struct {
    SessionID     string
    TenantID      string
    PrincipalID   string
    Protocol      string
    InboxSubject  string
    OutboxSubject string
    IssuedAt      time.Time
    ExpiresAt     time.Time
    GatewayNode   string    // Hint for sticky routing
}
```

### NATS Stream Configuration

```yaml
# INBOX Stream - incoming messages
name: INBOX
subjects: ["in.>"]
retention: workqueue
maxAge: 1h
replicas: 3

# OUTBOX Stream - responses
name: OUTBOX
subjects: ["out.>"]
retention: limits
maxAge: 1h
replicas: 3

# HISTORY Stream - session replay
name: HISTORY
subjects: ["history.>"]
retention: limits
maxMsgsPerSubject: 10000
maxAge: 1h
replicas: 3
```

### Capacity Planning

| Component | Instance | Connections | Count for 1M |
|-----------|----------|-------------|--------------|
| Go Gateway | c6g.xlarge (8GB) | 80,000 | 13 instances |
| NATS | r6g.xlarge | N/A | 3 nodes (cluster) |
| Lambda (MCP) | 1024MB | N/A | 1000 concurrent |
| Lambda (A2A) | 2048MB | N/A | 500 concurrent |

---

## 6. API Keys & Authentication

### Key Structure

```
rad_{interface}_{random_prefix}_{key_secret}
     ↑               ↑              ↑
     │               │              └── Secret (never stored)
     │               └── Stored prefix (first 20 chars)
     └── Interface type: sk (api), mcp, a2a
```

### Interface Types

| Type | Code | Authentication |
|------|------|----------------|
| API | `sk` | Bearer token |
| MCP | `mcp` | Header or query param |
| A2A | `a2a` | mTLS + API key |
| All | `all` | Any interface |

### Key Fields

| Field | Description |
|-------|-------------|
| `interface_type` | `api`, `mcp`, `a2a`, or `all` |
| `scopes` | Allowed operations |
| `allowed_endpoints` | Explicit allow list |
| `denied_endpoints` | Explicit deny list |
| `rate_limit_per_minute` | Rate limit |
| `a2a_agent_id` | Linked A2A agent (if applicable) |
| `a2a_mtls_required` | Require mTLS for A2A |
| `mcp_allowed_tools` | Allowed MCP tools |
| `expires_at` | Key expiration |

### Creating an API Key

**Via Admin Dashboard:**
1. Navigate to **Settings** → **API Keys**
2. Click **Create Key**
3. Select interface type
4. Configure scopes and limits
5. Copy the generated key (shown only once)

**Via API:**
```bash
curl -X POST https://api.example.com/admin/api-keys \
  -H "Authorization: Bearer admin_token" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "My MCP Key",
    "interface_type": "mcp",
    "scopes": ["tools", "resources"],
    "mcp_allowed_tools": ["search", "calculate"]
  }'
```

### Key Validation Flow

```
Request → Extract Key → Hash Key → DB Lookup
                                      ↓
                        Check: is_active, expires_at
                                      ↓
                        Check: interface_type matches
                                      ↓
                        Check: endpoint restrictions
                                      ↓
                        Update: last_used_at, use_count
                                      ↓
                                 ✓ Authorized
```

---

## 7. Cedar Authorization Policies

RADIANT uses Cedar for fine-grained authorization across all interfaces.

### Cedar Schema

```cedarschema
namespace Radiant {
  entity Agent in [Tenant] {
    tier: String,
    scopes: Set<String>,
    labels: Set<String>
  };
  
  entity User in [Tenant] {
    role: String,
    scopes: Set<String>,
    department: String
  };
  
  entity Tool {
    name: String,
    destructive: Bool,
    sensitive: Bool,
    requiredScopes: Set<String>,
    labels: Set<String>,
    namespace: String,
    owner: String
  };
  
  action "tool:call" appliesTo {
    principal: [Agent, User, Service],
    resource: [Tool],
    context: { tenantId: String, sourceProtocol: String }
  };
}
```

### Key Policies

**File:** `packages/infrastructure/config/cedar/interface-access-policies.cedar`

| Policy | Purpose |
|--------|---------|
| `deny-cross-tenant` | FORBID all cross-tenant access |
| `user-tool-call-non-sensitive` | Allow non-destructive tools with scopes |
| `agent-tool-call-namespace` | Agents can call tools in their namespace |
| `admin-tool-call-all` | Admins bypass restrictions |
| `deny-sensitive-without-label` | Protect sensitive resources |
| `deny-database-direct-access` | FORBID direct DB access from external agents |
| `require-mtls-for-a2a` | Enforce mTLS for A2A |

### Example: Tool Authorization

```typescript
const authResult = await cedarService.authorize({
  principal: {
    type: 'Agent',
    id: 'agent_123',
    tenantId: 'tenant_abc',
    scopes: ['tool:execute'],
  },
  action: 'tool:execute',
  resource: {
    type: 'Tool',
    id: 'search',
    name: 'search',
    namespace: 'public',
    destructive: false,
    sensitive: false,
  },
  context: {
    tenantId: 'tenant_abc',
    sourceProtocol: 'mcp',
  },
});

if (!authResult.allowed) {
  throw new Error(`Authorization denied: ${authResult.decision}`);
}
```

---

## 8. Admin Dashboard

### API Keys Management

**Location:** `/settings/api-keys` (both Radiant Admin and Think Tank Admin)

**Tabs:**
1. **Overview** - Summary cards per interface type
2. **Keys** - List with filtering by interface
3. **A2A Agents** - Agent registry management
4. **Policies** - Interface access policies

### Creating Keys

1. Click **Create Key**
2. Select **Interface Type**:
   - **API** - REST API access
   - **MCP** - Model Context Protocol
   - **A2A** - Agent-to-Agent
   - **All** - All interfaces
3. Configure scopes
4. Set expiration (optional)
5. For A2A: Configure mTLS requirements
6. For MCP: Select allowed tools

### A2A Agent Management

| Action | Description |
|--------|-------------|
| **View Agents** | List registered agents |
| **Suspend** | Temporarily disable agent |
| **Activate** | Re-enable suspended agent |
| **Revoke** | Permanently revoke agent access |
| **View Requests** | See agent request history |

### Interface Policies

Configure per-interface access rules:

| Setting | Description |
|---------|-------------|
| `require_authentication` | Require API key |
| `require_mtls` | Require mTLS (A2A default: true) |
| `allowed_ip_ranges` | IP allowlist |
| `blocked_ip_ranges` | IP blocklist |
| `global_rate_limit_per_minute` | Interface-wide rate limit |

---

## 9. Database Schema

### Core Tables

**Migration:** `V2026_01_24_001__services_layer_api_keys.sql`

| Table | Purpose |
|-------|---------|
| `api_keys` | API key storage with interface types |
| `api_key_audit_log` | Audit trail for key operations |
| `interface_access_policies` | Per-interface access control |
| `a2a_registered_agents` | A2A agent registry |
| `api_key_sync_log` | Cross-admin-app sync queue |

### api_keys Table

```sql
CREATE TABLE api_keys (
  id UUID PRIMARY KEY,
  tenant_id UUID NOT NULL,
  name VARCHAR(255) NOT NULL,
  key_prefix VARCHAR(20) NOT NULL,
  key_hash VARCHAR(128) NOT NULL,
  
  -- Interface type
  interface_type VARCHAR(20) NOT NULL, -- api, mcp, a2a, all
  
  -- Scopes
  scopes TEXT[] NOT NULL DEFAULT ARRAY['chat', 'models'],
  allowed_endpoints TEXT[],
  denied_endpoints TEXT[],
  
  -- A2A fields
  a2a_agent_id VARCHAR(255),
  a2a_mtls_required BOOLEAN DEFAULT true,
  
  -- MCP fields
  mcp_allowed_tools TEXT[],
  mcp_protocol_version VARCHAR(20) DEFAULT '2025-03-26',
  
  -- Status
  is_active BOOLEAN NOT NULL DEFAULT true,
  expires_at TIMESTAMPTZ,
  last_used_at TIMESTAMPTZ,
  use_count INTEGER NOT NULL DEFAULT 0,
  
  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

### a2a_registered_agents Table

```sql
CREATE TABLE a2a_registered_agents (
  id UUID PRIMARY KEY,
  tenant_id UUID NOT NULL,
  agent_id VARCHAR(255) NOT NULL,
  agent_name VARCHAR(255) NOT NULL,
  agent_type VARCHAR(100) NOT NULL,
  agent_version VARCHAR(50),
  
  -- Authentication
  api_key_id UUID REFERENCES api_keys(id),
  mtls_cert_fingerprint VARCHAR(128),
  
  -- Capabilities
  supported_operations TEXT[] NOT NULL DEFAULT '{}',
  max_concurrent_requests INTEGER DEFAULT 10,
  
  -- Status
  status VARCHAR(20) NOT NULL DEFAULT 'active',
  last_heartbeat_at TIMESTAMPTZ,
  total_requests INTEGER NOT NULL DEFAULT 0,
  
  UNIQUE(tenant_id, agent_id)
);
```

### Key Functions

```sql
-- Validate API key for specific interface
SELECT * FROM validate_api_key_for_interface(
  'key_hash_value',
  'mcp',
  '/tools/call'
);

-- Create API key with interface type
SELECT create_api_key(
  'tenant_id',
  'My MCP Key',
  'mcp',
  'rad_mcp_abc',
  'hash_value',
  ARRAY['tools', 'resources']
);

-- Revoke API key
SELECT revoke_api_key('key_id', 'admin_id', 'Security concern');
```

---

## 10. Troubleshooting

### Common Issues

#### MCP Connection Fails

**Symptoms:** Claude Desktop shows "Failed to connect to MCP server"

**Solutions:**
1. Verify API key is valid and has `mcp` interface type
2. Check WebSocket URL: `wss://gateway.{domain}/mcp`
3. Verify key has required scopes: `tools`, `resources`

#### A2A mTLS Errors

**Symptoms:** `MTLS_REQUIRED` error

**Solutions:**
1. Ensure client certificate is valid and not expired
2. Verify certificate is signed by trusted CA
3. Check `mtls_cert_fingerprint` matches registered fingerprint
4. Confirm `a2a_mtls_required` setting in policy

#### Rate Limiting

**Symptoms:** `429 Too Many Requests`

**Solutions:**
1. Check key's `rate_limit_per_minute` setting
2. Review `interface_access_policies` for global limits
3. Implement exponential backoff in client
4. Consider upgrading to higher rate limit tier

#### Authorization Denied

**Symptoms:** `AUTHORIZATION_DENIED` or `-32001` error

**Solutions:**
1. Verify key has required scopes
2. Check Cedar policies for restrictions
3. Confirm tool/resource is in allowed namespace
4. Review audit log for denial reason

### Audit Log Queries

```sql
-- Recent auth failures
SELECT * FROM api_key_audit_log
WHERE action IN ('a2a_auth_failure', 'mcp_auth_failure', 'interface_denied')
ORDER BY created_at DESC
LIMIT 100;

-- Key usage by interface
SELECT interface_type, COUNT(*) as uses, MAX(created_at) as last_use
FROM api_key_audit_log
WHERE action = 'used'
GROUP BY interface_type;

-- A2A agent activity
SELECT a2a_agent_id, a2a_operation, COUNT(*) as operations
FROM api_key_audit_log
WHERE a2a_agent_id IS NOT NULL
GROUP BY a2a_agent_id, a2a_operation
ORDER BY operations DESC;
```

### Health Check Endpoints

| Endpoint | Description |
|----------|-------------|
| `/health` | Gateway health |
| `/health/nats` | NATS connection status |
| `/metrics` | Prometheus metrics |
| `/api/admin/system/gateway` | Gateway configuration |

---

## 11. MLS (Message Layer Security) for A2A Encryption

RADIANT implements **RFC 9420-inspired MLS** for secure agent-to-agent communication. MLS provides group encryption with forward secrecy and post-compromise security—critical for multi-agent AI systems.

### Why MLS for A2A?

| TLS Limitation | MLS Solution |
|----------------|--------------|
| Point-to-point only | Group encryption for multi-agent collaboration |
| Static keys | Epoch-based key rotation |
| No forward secrecy | HKDF ratcheting protects past messages |
| No post-compromise security | Key updates heal from compromise |

### MLS + A2A Integration

```
┌─────────────┐                           ┌─────────────┐
│   Agent A   │◄──── MLS Encrypted ──────►│   Agent B   │
│             │      (Group: proj-123)    │             │
└──────┬──────┘                           └──────┬──────┘
       │                                         │
       │           A2A Protocol                  │
       │     (mTLS + WebSocket + MLS)            │
       │                                         │
       └─────────────────┬───────────────────────┘
                         │
                         ▼
              ┌─────────────────────┐
              │    A2A Gateway      │
              │  • mTLS termination │
              │  • MLS group mgmt   │
              │  • Message routing  │
              └─────────────────────┘
```

### Creating Secure Agent Groups

```typescript
// 1. Generate key packages for agents
const agentAKey = await mlsService.generateKeyPackage(
  "agent-a-id",
  "agent",
  "urn:radiant:agent:agent-a"
);

const agentBKey = await mlsService.generateKeyPackage(
  "agent-b-id", 
  "agent",
  "urn:radiant:agent:agent-b"
);

// 2. Create encrypted group
const group = await mlsService.createGroup(
  tenantId,
  "Project Alpha Collaboration",
  "agent-a-id"  // Creator
);

// 3. Add Agent B (increments epoch for forward secrecy)
await mlsService.addMember(group.groupId, "agent-b-id", "agent-a-id");

// 4. Send encrypted message
const encryptedMsg = await mlsService.encryptForGroup(
  group.groupId,
  "agent-a-id",
  Buffer.from(JSON.stringify({
    action: "analyze",
    data: sensitivePayload
  }))
);

// 5. Agent B decrypts
const decrypted = await mlsService.decryptFromGroup(
  group.groupId,
  "agent-b-id",
  encryptedMsg
);
```

### Security Properties

| Property | How It Works |
|----------|--------------|
| **Forward Secrecy** | Each epoch derives new keys via HKDF. Compromising Epoch N doesn't reveal Epoch N-1 messages. |
| **Post-Compromise Security** | Key updates rotate all group secrets. Temporary compromise doesn't persist. |
| **Sender Authentication** | Ed25519 signatures bind messages to sender identity. |
| **Group Key Agreement** | Ratchet tree allows O(log n) key updates instead of O(n²). |

### Handling Agent Compromise

If an agent's keys are suspected compromised:

```typescript
// Trigger key update (rotates all secrets, increments epoch)
await mlsService.updateKey(group.groupId, "compromised-agent-id");

// All future messages use new epoch secrets
// Past messages remain protected (can't be decrypted with new keys)
```

### MLS Admin Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/admin/mls/dashboard` | GET | MLS statistics |
| `/api/admin/mls/groups` | GET/POST | List/create groups |
| `/api/admin/mls/groups/:id` | GET | Group details + members |
| `/api/admin/mls/groups/:id/members` | POST | Add member |
| `/api/admin/mls/groups/:id/members/:mid` | DELETE | Remove member |
| `/api/admin/mls/groups/:id/update-key` | POST | Trigger key rotation |
| `/api/admin/mls/audit` | GET | Audit log |

### Database Tables

| Table | Purpose |
|-------|---------|
| `mls_key_packages` | Agent key packages (X25519 + Ed25519) |
| `mls_groups` | Group state with epoch tracking |
| `mls_group_members` | Membership with ratchet tree positions |
| `mls_commits` | State change records (add/remove/update) |
| `mls_messages` | Encrypted messages |
| `mls_epoch_secrets` | Per-epoch secrets for forward secrecy |
| `mls_audit_log` | Compliance audit trail |

### Configuration

Set the MLS master key for encrypting private keys:

```bash
# Environment variable (Lambda)
MLS_MASTER_KEY=base64-encoded-32-byte-key

# Future: AWS KMS integration
MLS_KMS_KEY_ARN=arn:aws:kms:region:account:key/key-id
```

---

## Tenant Settings API (v7.43.0)

Unified tenant settings management for retention, storage, AI configuration, feature flags, and compliance.

### Endpoints

| Method | Path | Description | Auth |
|--------|------|-------------|------|
| GET | `/admin/tenant-settings` | List all tenant settings | Admin |
| GET | `/admin/tenant-settings/{tenantId}` | Get settings for a tenant | Admin |
| PUT | `/admin/tenant-settings/{tenantId}` | Update tenant settings | Admin |
| POST | `/admin/tenant-settings/{tenantId}/reset` | Reset settings to defaults | Admin |

### PUT Request Body (Partial Updates)

```json
{
  "chatRetentionDays": 180,
  "fileRetentionDays": 180,
  "auditLogRetentionDays": 365,
  "maxStorageGb": null,
  "storageTierAutoPromote": true,
  "hotToWarmHours": 24,
  "warmToColdDays": 180,
  "coldToGlacierYears": 7,
  "defaultModelId": "anthropic/claude-sonnet-4-20250514",
  "maxTokensPerRequest": 8192,
  "temperatureDefault": 0.7,
  "enableStreaming": true,
  "enableCollaboration": true,
  "enableFileUpload": true,
  "enableConversationExport": true,
  "enableConversationFork": true,
  "complianceFrameworks": ["SOC2", "HIPAA"],
  "dataClassificationDefault": "INTERNAL",
  "requireEncryption": true
}
```

### Database Table

| Table | Purpose |
|-------|---------|
| `tenant_settings` | Unified per-tenant configuration (RLS-isolated) |

---

## Conversation Export API (v7.43.0)

Export full conversation history with messages and attachments into downloadable archives.

### Endpoints

| Method | Path | Description | Auth |
|--------|------|-------------|------|
| POST | `/admin/conversation-export` | Request a new export | Admin |
| GET | `/admin/conversation-export` | List exports (requires `tenant_id`, `user_id` query params) | Admin |
| GET | `/admin/conversation-export/{exportId}` | Get export status (requires `tenant_id`, `user_id` query params) | Admin |

### POST Request Body

```json
{
  "tenantId": "uuid",
  "userId": "uuid",
  "conversationId": "uuid",
  "format": "json",
  "includeAttachments": true,
  "includeMetadata": false
}
```

### Export Formats

| Format | Content-Type | Description |
|--------|-------------|-------------|
| `json` | `application/json` | Full structured export with metadata |
| `markdown` | `text/markdown` | Human-readable conversation transcript |

### Response

```json
{
  "exportId": "uuid",
  "status": "completed",
  "downloadUrl": "https://s3.presigned-url...",
  "downloadExpiresAt": "2026-02-15T...",
  "messageCount": 42,
  "attachmentCount": 3,
  "fileSizeBytes": 15234
}
```

### Database Table

| Table | Purpose |
|-------|---------|
| `conversation_exports` | Export tracking with S3 location, status, expiry |

---

## Related Documentation

- [Multi-Protocol Gateway Architecture](MULTI-PROTOCOL-GATEWAY-ARCHITECTURE.md) - Detailed gateway design
- [RADIANT Admin Guide](RADIANT-ADMIN-GUIDE.md) - Platform administration
- [RADIANT Platform Architecture](RADIANT-PLATFORM-ARCHITECTURE.md) - Section 3.2.2 for MLS details
- [Engineering Implementation Vision](ENGINEERING-IMPLEMENTATION-VISION.md) - Section 30 for MLS internals
- [Authentication Overview](authentication/overview.md) - Authentication methods
- [API Reference](API_REFERENCE.md) - Complete API documentation

---

**Document History**

| Version | Date | Changes |
|---------|------|---------|
| 6.5.0 | 2026-02-03 | Added MLS (Message Layer Security) section for A2A encryption |
| 5.52.5 | 2026-01-25 | Initial comprehensive guide |


---

## Part VII: Provider Handling

**Version**: 4.18.3  
**Last Updated**: 2024-12-28

## Overview

When an AI provider or self-hosted model rejects a prompt based on their ethics policies (that don't conflict with RADIANT's ethics), the system automatically attempts fallback to alternative models. If all capable models reject the request, the user receives a clear explanation.

---

## How It Works

### Rejection Flow

```
1. User submits prompt
2. AGI Brain selects optimal model
3. Model rejects prompt (provider ethics, content policy, etc.)
4. System checks: Does this violate OUR ethics?
   ├── YES → Reject to user with explanation
   └── NO → Try fallback models
5. Fallback loop (max 3 attempts):
   ├── Select model with lowest rejection rate
   ├── Attempt request
   └── If success → Return response
6. If all fallbacks fail:
   └── Reject to user with detailed explanation
```

### Key Principles

1. **RADIANT ethics take precedence** - If our ethics block it, no fallback is attempted
2. **Provider ethics don't block us** - Different providers have different policies; we route around them
3. **Users always know** - Every rejection is explained to the user
4. **Learning from patterns** - The system learns which models reject which types of content

---

## Rejection Types

| Type | Description | Fallback? |
|------|-------------|-----------|
| `content_policy` | Provider's content policy violation | ✅ Yes |
| `safety_filter` | Safety/moderation filter triggered | ✅ Yes |
| `provider_ethics` | Provider's ethical guidelines differ | ✅ Yes |
| `capability_mismatch` | Model can't handle this request type | ✅ Yes |
| `context_length` | Prompt too long for model | ✅ Yes |
| `moderation` | Pre-flight moderation blocked | ✅ Yes |
| `rate_limit` | Rate limiting (retry later) | ⏳ Retry |
| `unknown` | Unknown error | ✅ Yes |

---

## Fallback Model Selection

Models are selected for fallback based on:

1. **Rejection rate** - Models with lowest historical rejection rates preferred
2. **Required capabilities** - Must have same capabilities as original
3. **Exclusion list** - Previously tried models excluded
4. **Provider diversity** - Prefer different providers for better success chance

### Selection Query

```sql
SELECT model_id, provider_id, rejection_rate
FROM unified_model_registry m
LEFT JOIN model_rejection_stats s ON m.model_id = s.model_id
WHERE m.enabled = true
  AND m.model_id != ALL(excluded_models)
  AND m.capabilities && required_capabilities
ORDER BY COALESCE(s.rejection_rate, 0) ASC
LIMIT 10
```

---

## User Notifications

### Notification Types

**Rejected Request**:
```
Title: Request Could Not Be Completed
Message: The ethical guidelines of available AI providers prevented 
         this response. We attempted 3 different AI models.
Suggested Actions:
  - Try rephrasing your request
  - Remove potentially sensitive content
  - Contact administrator
```

**Resolved with Fallback**:
```
Title: Resolved with Alternative Model
Message: Your request was processed by an alternative AI model 
         after the original was unavailable.
```

### Think Tank UI

- **Bell icon** with unread count in toolbar
- **Sheet panel** slides out showing all notifications
- **Rejection banners** appear in conversation when relevant
- **Suggested actions** are clickable to help users resolve issues

---

## Database Schema

### provider_rejections

| Column | Type | Description |
|--------|------|-------------|
| `id` | UUID | Primary key |
| `tenant_id` | UUID | Multi-tenant isolation |
| `user_id` | UUID | User who made request |
| `plan_id` | UUID | AGI Brain plan if applicable |
| `model_id` | VARCHAR | Model that rejected |
| `provider_id` | VARCHAR | Provider ID |
| `rejection_type` | VARCHAR | Type of rejection |
| `rejection_message` | TEXT | Raw error from provider |
| `radiant_ethics_passed` | BOOLEAN | Did it pass our ethics? |
| `fallback_attempted` | BOOLEAN | Was fallback tried? |
| `fallback_model_id` | VARCHAR | Model that succeeded |
| `fallback_succeeded` | BOOLEAN | Did fallback work? |
| `fallback_chain` | JSONB | Array of all attempts |
| `final_status` | VARCHAR | pending, fallback_success, rejected |
| `final_response_to_user` | TEXT | Message shown to user |

### rejection_patterns

Learns patterns for smarter fallback:

| Column | Type | Description |
|--------|------|-------------|
| `pattern_hash` | VARCHAR | Hash of rejection characteristics |
| `trigger_keywords` | TEXT[] | Keywords that trigger rejections |
| `trigger_model_ids` | TEXT[] | Models that reject this pattern |
| `recommended_fallback_models` | TEXT[] | Models that work |
| `success_rate` | NUMERIC | Fallback success rate |

### model_rejection_stats

Per-model rejection statistics:

| Column | Type | Description |
|--------|------|-------------|
| `model_id` | VARCHAR | Model identifier |
| `total_requests` | INTEGER | Total requests to model |
| `total_rejections` | INTEGER | Total rejections |
| `rejection_rate` | NUMERIC | Computed rejection rate |
| `content_policy_count` | INTEGER | By type breakdown |
| `fallback_successes` | INTEGER | Successful fallbacks |

---

## API Endpoints

### Record Rejection

```
POST /api/internal/rejections
{
  "modelId": "gpt-4",
  "providerId": "openai",
  "rejectionType": "content_policy",
  "rejectionMessage": "Content policy violation",
  "planId": "uuid"
}
```

### Get User Notifications

```
GET /api/thinktank/rejections
Response: {
  "notifications": [...],
  "unreadCount": 3
}
```

### Mark Notification Read

```
PATCH /api/thinktank/rejections/:id/read
```

### Dismiss Notification

```
DELETE /api/thinktank/rejections/:id
```

---

## Service Integration

### ProviderRejectionService

```typescript
// Handle rejection with automatic fallback
const result = await providerRejectionService.handleRejectionWithFallback(
  tenantId,
  userId,
  originalModelId,
  providerId,
  rejectionType,
  rejectionMessage,
  async (modelId, providerId) => {
    // Execute request with fallback model
    return await executeRequest(modelId, providerId, prompt);
  },
  planId,
  requiredCapabilities
);

if (result.success) {
  // Request succeeded (possibly with fallback)
  console.log('Handled by:', result.handlingModelId);
  console.log('Used fallback:', result.usedFallback);
} else {
  // All models rejected
  console.log('Rejection reason:', result.rejectionReason);
  console.log('User message:', result.userFacingMessage);
}
```

### AGI Brain Integration

The AGI Brain Planner automatically uses rejection handling:

1. Selects optimal model for task
2. If model rejects, calls `providerRejectionService.handleRejectionWithFallback()`
3. If fallback succeeds, continues with new model
4. If all fail, returns rejection response to user

---

## Configuration

### Constants

```typescript
const MIN_MODELS_FOR_TASK = 2;   // Minimum models needed
const MAX_FALLBACK_ATTEMPTS = 3; // Maximum fallback tries
```

### Model Rejection Thresholds

Models with rejection rates above 30% are deprioritized for initial selection but may still be used as fallbacks.

---

## Admin Dashboard

### Rejection Analytics

**Location**: Admin Dashboard → Analytics → Rejections

Full analytics dashboard for monitoring rejections and informing policy updates.

#### Summary Cards

- **Total Rejections (30d)** - All rejections in period
- **Fallback Success Rate** - Percentage resolved via fallback
- **Rejected to User** - Requests that failed all fallbacks
- **Flagged Keywords** - Keywords marked for policy review

#### Tabs

| Tab | Purpose |
|-----|---------|
| **By Provider** | See which providers reject most, rejection types, fallback rates |
| **Violation Keywords** | Keywords triggering rejections, per-provider breakdown |
| **Flagged Prompts** | Full prompt content for policy investigation |
| **Policy Review** | Recommendations for pre-filters based on patterns |

### Viewing Full Prompt Content

Administrators can view the complete rejected prompt to understand why it was rejected:

1. Go to Analytics → Rejections → Flagged Prompts
2. Click "View Full Prompt" on any entry
3. Review detected keywords and rejection reason
4. Decide: Add Pre-Filter, Add Warning, or Dismiss

### Adding Pre-Filters

Based on rejection patterns, add pre-filters to RADIANT's ethics:

1. Identify high-frequency rejection keywords
2. Flag keywords for review
3. Investigate sample prompts
4. Add pre-filter rule to block before sending to AI

### Database Views

| View | Purpose |
|------|---------|
| `rejection_summary_by_provider` | Aggregated stats per provider |
| `rejection_summary_by_model` | Aggregated stats per model |
| `top_rejection_keywords` | Most frequent violation keywords |

---

## Curator API (v7.43.1)

Knowledge curation and verification endpoints — documents, domains, knowledge graph, golden rules, entrance exams, chain of custody.

### Endpoints

| Method | Path | Description | Auth |
|--------|------|-------------|------|
| GET | `/admin/curator/dashboard` | Dashboard overview | Admin |
| GET/POST | `/admin/curator/domains` | List/create domains | Admin |
| GET/PUT/DELETE | `/admin/curator/domains/{id}` | Domain CRUD | Admin |
| GET/POST | `/admin/curator/documents` | List/ingest documents | Admin |
| GET/POST | `/admin/curator/verification` | Verification items | Admin |
| GET/POST | `/admin/curator/golden-rules` | Golden rules | Admin |
| GET | `/admin/curator/audit` | Audit trail | Admin |
| GET | `/admin/curator/nodes` | Knowledge graph nodes | Admin |
| GET | `/admin/curator/chain-of-custody` | Chain of custody | Admin |
| GET | `/admin/curator/conflicts` | Conflicts | Admin |
| GET | `/admin/curator/connectors` | Connectors | Admin |

---

## Cato Trainer API (v7.43.1)

Safety training document management — libraries, documents, spaces, search, grounded chat, digest, configuration.

### Endpoints

| Method | Path | Description | Auth |
|--------|------|-------------|------|
| GET/POST | `/admin/cato-trainer/libraries/{tenantId}` | List/create libraries | Admin |
| GET | `/admin/cato-trainer/libraries/detail/{id}` | Library detail | Admin |
| GET | `/admin/cato-trainer/documents/{libraryId}` | List documents | Admin |
| POST | `/admin/cato-trainer/documents/{libraryId}/upload` | Upload document | Admin |
| DELETE | `/admin/cato-trainer/documents/{id}` | Delete document | Admin |
| GET/POST | `/admin/cato-trainer/spaces/{tenantId}` | List/create spaces | Admin |
| PUT/DELETE | `/admin/cato-trainer/spaces/{id}` | Update/delete space | Admin |
| POST | `/admin/cato-trainer/search/{tenantId}` | Search documents | Admin |
| GET | `/admin/cato-trainer/links/{documentId}` | Smart links | Admin |
| POST | `/admin/cato-trainer/chat/{tenantId}/session` | Create chat session | Admin |
| GET | `/admin/cato-trainer/chat/{tenantId}/sessions` | List sessions | Admin |
| POST | `/admin/cato-trainer/chat/{sessionId}/message` | Send message | Admin |
| POST | `/admin/cato-trainer/digest/{tenantId}` | Generate digest | Admin |
| GET/PUT | `/admin/cato-trainer/config/{tenantId}` | Configuration | Admin |

---

## Think Tank Tenant Admin API (v7.43.1)

Tenant-scoped administration — dashboard, users, settings, security, collaboration, cartridges, reports.

### Endpoints

| Method | Path | Description | Auth |
|--------|------|-------------|------|
| GET | `/api/v1/tenant/dashboard/stats` | Dashboard statistics | Cognito |
| GET | `/api/v1/tenant/dashboard/usage-trends` | 30-day usage trends | Cognito |
| GET | `/api/v1/tenant/dashboard/activity` | Recent activity | Cognito |
| GET | `/api/v1/tenant/dashboard/alerts` | Active alerts | Cognito |
| GET/POST | `/api/v1/tenant/cartridges` | List/create cartridges | Cognito |
| POST | `/api/v1/tenant/cartridges/{id}/activate` | Activate cartridge | Cognito |
| POST | `/api/v1/tenant/cartridges/{id}/deactivate` | Deactivate cartridge | Cognito |
| DELETE | `/api/v1/tenant/cartridges/{id}` | Delete cartridge | Cognito |
| GET | `/api/tenant-admin/users` | List tenant users | Cognito |
| PUT | `/api/tenant-admin/users/{id}` | Update user | Cognito |
| POST | `/api/tenant-admin/users/{id}/suspend` | Suspend user | Cognito |
| GET/PUT | `/api/tenant-admin/settings` | Tenant settings | Cognito |
| GET/PUT | `/api/tenant-admin/security` | Security config | Cognito |
| GET/PUT | `/api/tenant-admin/collaboration` | Collaboration config | Cognito |
| GET | `/api/tenant-admin/reports` | List reports | Cognito |

---

## Public Status API (v7.43.1)

Unauthenticated status endpoint for status page health checks. Protected by API key only.

| Method | Path | Description | Auth |
|--------|------|-------------|------|
| GET | `/api/public/status` | Service health status | API Key |
| GET | `/api/public/status?datacenter={id}` | Filter by datacenter | API Key |

---

## Library Search API (v7.43.1)

Neural/semantic search for the open source library registry using multi-signal scoring.

| Method | Path | Description | Auth |
|--------|------|-------------|------|
| POST | `/admin/libraries/search` | Search libraries by natural language query | Admin |

---

## Related Documentation

- [AGI Brain Plan System](./sections/SECTION-XX-AGI-BRAIN-PLAN.md)
- [AI Ethics Standards](./AI-ETHICS-STANDARDS.md)
- [Model Router Service](./MODEL-ROUTER.md)



---

## Part VIII: OMEGA Firmware API (v6.4.0)

> **Version**: 6.4.0 | **Base Path**: `/api/v2`
> **Authentication**: Admin Bearer token required for all endpoints
> **Required Role**: `omega:firmware:read`, `omega:firmware:write`, or `omega:firmware:sign` as noted

---

### Upload Firmware

Upload and validate a `.bio` firmware file.

```
POST /api/v2/firmware/upload
```

**Permission:** `omega:firmware:write`

**Request Body:**
```json
{
  "name": "Safety Rules v2.1",
  "description": "Updated Helix rules for healthcare vertical",
  "content": {
    "helix_rules": [
      {
        "name": "block_medical_advice",
        "forbidden_vector": [0.0, 0.0, 1.0, 0.0],
        "severity": "CRITICAL",
        "interference_mode": "DESTRUCTIVE"
      }
    ],
    "ambition": {
      "entropy_threshold": 0.3,
      "plasticity_rate": 0.01,
      "dopamine_decay": 0.95
    },
    "quantum_params": {
      "hilbert_dimension": 1024,
      "unitarity_mode": "STRICT",
      "decoherence_rate": 0.001
    },
    "personality": {
      "system_prompt": "You are a precise medical research assistant.",
      "tone": "formal",
      "domain_focus": ["healthcare", "clinical-trials"]
    }
  }
}
```

**Response (201):**
```json
{
  "firmware_id": "fw_abc123",
  "content_hash": "sha512:a1b2c3...",
  "status": "draft",
  "validation": {
    "passed": true,
    "checks": [
      { "name": "helix_vectors_normalized", "status": "pass" },
      { "name": "ambition_bounds_valid", "status": "pass" },
      { "name": "quantum_params_consistent", "status": "pass" }
    ]
  },
  "created_at": "2026-02-08T10:00:00Z"
}
```

**Error Codes:**
| Code | Description |
|------|-------------|
| 400 | Invalid .bio structure or validation failure |
| 409 | Duplicate content hash already exists |
| 413 | Firmware exceeds 5MB size limit |

---

### Sign Firmware

Cryptographically sign firmware using AWS KMS (Ed25519 / ECDSA_SHA_256).

```
POST /api/v2/firmware/{firmware_id}/sign
```

**Permission:** `omega:firmware:sign`

**Path Parameters:**
| Parameter | Type | Description |
|-----------|------|-------------|
| `firmware_id` | string | UUID of the firmware to sign |

**Response (200):**
```json
{
  "firmware_id": "fw_abc123",
  "status": "signed",
  "signature": {
    "algorithm": "ECDSA_SHA_256",
    "key_id": "arn:aws:kms:us-east-1:123:key/abc-def",
    "signer_admin_id": "admin_xyz",
    "signed_at": "2026-02-08T10:05:00Z"
  }
}
```

**Error Codes:**
| Code | Description |
|------|-------------|
| 400 | Firmware not in `draft` status |
| 403 | Admin does not have `omega:firmware:sign` permission |
| 404 | Firmware not found |
| 502 | KMS signing failed |

---

### Activate Firmware (Trigger Hot-Swap)

Activate signed firmware on a target brain, triggering the hot-swap lifecycle.

```
POST /api/v2/firmware/{firmware_id}/activate
```

**Permission:** `omega:firmware:write`

**Path Parameters:**
| Parameter | Type | Description |
|-----------|------|-------------|
| `firmware_id` | string | UUID of the signed firmware |

**Request Body:**
```json
{
  "brain_id": "brain_xyz",
  "swap_mode": "OVERLAY",
  "reason": "Adding healthcare safety rules"
}
```

**Swap Modes:**
| Mode | Description |
|------|-------------|
| `OVERLAY` | Preserve quantum state, merge rules (~5s) |
| `RESET` | Reinitialize quantum state (~30s). Required for Hilbert dimension or unitarity mode changes |
| `SHADOW` | Fork brain copy for parallel testing (~10s) |
| `EMERGENCY` | Immediate platform defaults (~2s) |

**Response (202):**
```json
{
  "swap_id": "swap_abc123",
  "firmware_id": "fw_abc123",
  "brain_id": "brain_xyz",
  "swap_mode": "OVERLAY",
  "status": "in_progress",
  "started_at": "2026-02-08T10:10:00Z"
}
```

**Error Codes:**
| Code | Description |
|------|-------------|
| 400 | Firmware not in `signed` status, or invalid swap mode |
| 403 | Two-person rule violation (signer == activator) |
| 404 | Firmware or brain not found |
| 409 | Another swap already in progress for this brain |
| 422 | Pre-flight validation failed (use `/preflight` endpoint for details) |

---

### Pre-flight Validation

Check all prerequisites before activating a firmware swap.

```
GET /api/v2/firmware/{firmware_id}/preflight?brain_id={brain_id}&swap_mode={mode}
```

**Permission:** `omega:firmware:read`

**Response (200):**
```json
{
  "ready": true,
  "checks": [
    { "name": "firmware_signed", "status": "pass" },
    { "name": "two_person_rule", "status": "pass" },
    { "name": "brain_healthy", "status": "pass" },
    { "name": "no_active_swap", "status": "pass" },
    { "name": "swap_mode_compatible", "status": "pass" },
    { "name": "helix_rules_valid", "status": "pass" }
  ]
}
```

---

### Rollback Firmware

Revert a brain to its previous firmware version using the stored rollback snapshot.

```
POST /api/v2/firmware/{firmware_id}/rollback
```

**Permission:** `omega:firmware:write`

**Request Body (optional):**
```json
{
  "reason": "Post-swap error rate exceeded threshold"
}
```

**Response (200):**
```json
{
  "rollback_id": "rb_abc123",
  "brain_id": "brain_xyz",
  "from_firmware": "fw_abc123",
  "to_firmware": "fw_previous",
  "status": "completed",
  "duration_ms": 1200
}
```

---

### Emergency Lockdown

Immediately load platform default firmware (maximum safety) on a brain.

```
POST /api/v2/firmware/emergency
```

**Permission:** `omega:firmware:write`

**Request Body:**
```json
{
  "brain_id": "brain_xyz",
  "reason": "Suspected Helix bypass in production"
}
```

**Response (200):**
```json
{
  "emergency_id": "emg_abc123",
  "brain_id": "brain_xyz",
  "status": "locked_down",
  "firmware_loaded": "platform_default_v1",
  "duration_ms": 800,
  "review_required_by": "2026-02-09T10:15:00Z"
}
```

---

### Brain Status

Get current brain status including active firmware information.

```
GET /api/v2/omega/status?brain_id={brain_id}
```

**Permission:** `omega:firmware:read`

**Response (200):**
```json
{
  "brain_id": "brain_xyz",
  "tenant_id": "tenant_abc",
  "status": "active",
  "firmware": {
    "firmware_id": "fw_abc123",
    "name": "Safety Rules v2.1",
    "content_hash": "sha512:a1b2c3...",
    "activated_at": "2026-02-08T10:10:00Z",
    "swap_mode_used": "OVERLAY"
  },
  "quantum_state": {
    "hilbert_dimension": 1024,
    "unitarity_mode": "STRICT",
    "state_norm": 0.9999,
    "decoherence_rate": 0.001
  },
  "helix": {
    "active_rules": 12,
    "last_interference_event": "2026-02-08T09:55:00Z"
  },
  "ambition": {
    "entropy": 0.28,
    "dopamine": 0.72,
    "plasticity_rate": 0.01
  }
}
```

---

### Firmware Swap Log

Retrieve swap history for a brain.

```
GET /api/v2/omega/swaps?brain_id={brain_id}&limit={n}&offset={n}
```

**Permission:** `omega:firmware:read`

**Response (200):**
```json
{
  "swaps": [
    {
      "swap_id": "swap_abc123",
      "brain_id": "brain_xyz",
      "swap_mode": "OVERLAY",
      "from_firmware_id": "fw_old",
      "to_firmware_id": "fw_abc123",
      "status": "completed",
      "duration_ms": 4800,
      "started_at": "2026-02-08T10:10:00Z",
      "completed_at": "2026-02-08T10:10:04Z"
    }
  ],
  "total": 1,
  "limit": 20,
  "offset": 0
}
```

---

## Part IX: OMEGA Proving Ground API (v7.61.0)

> **Version**: 7.61.0 | **Base URL**: `http://localhost:11435`
> **Authentication**: None (local development server)
> **Full reference**: `docs/20-OMEGA-ENGINEERING.md` Part XVI

---

### IX.1 — Brain Lifecycle

#### POST /boot
Create or restore a brain instance. Loads saved state if available, applies time_warp for elapsed time.

**Request Body:**
```json
{
  "config": {
    "input_dim": 1024,
    "hidden_dim": 2048,
    "firmware_path": "path/to/.bio"
  }
}
```

**Response (200):**
```json
{
  "status": "booted",
  "state_restored": true,
  "elapsed_time_seconds": 3600.5,
  "watcher_params": 1573376,
  "transducer_params": 8396800
}
```

#### POST /think
Raw inference cycle — process input text through OMEGA cortex.

**Request Body:**
```json
{ "text": "I'd like a Big Mac please" }
```

**Response (200):**
```json
{
  "behavior": "order_burger",
  "confidence": 0.9234,
  "coherence": 0.8765,
  "state_entropy": 0.4523,
  "thought_vector_norm": 1.0001
}
```

#### POST /dream
Trigger dream consolidation cycle. Runs 3-stage dream + Watcher training.

**Response (200):**
```json
{
  "stages_completed": 3,
  "watcher_training": { "steps": 45, "avg_loss": 0.0234 },
  "post_coherence": 0.9123
}
```

### IX.2 — Full Inference (OMEGA + Llama)

#### POST /infer
Full pipeline: OMEGA think → Llama generation → Shadow Vector safety → Attribution proof.

**Request Body:**
```json
{ "text": "What's in a Big Mac?" }
```

**Response (200):**
```json
{
  "response": "A Big Mac contains two 100% beef patties...",
  "behavior": "menu_inquiry",
  "confidence": 0.9456,
  "shadow_safety": {
    "checked": true,
    "is_safe": true,
    "max_helix_alignment": 0.1234,
    "verdict": "PASS"
  },
  "attribution": {
    "omega_decided": {
      "behavior": "menu_inquiry",
      "confidence": 0.9456,
      "target_data_keys": ["item_name", "ingredients", "calories"],
      "processing_ms": 3.45
    },
    "llama_generated": {
      "response_length": 247,
      "model": "llama3.2",
      "processing_ms": 1234.56
    },
    "proof": "OMEGA classified input as 'menu_inquiry'..."
  }
}
```

### IX.3 — Self-Awareness (Watcher)

#### GET /watcher
Returns Watcher self-model metrics, configuration, and trainer buffer state.

**Response (200):**
```json
{
  "self_awareness_score": 0.8234,
  "surprise_ema": 0.1766,
  "total_observations": 1234,
  "reward_count": 890,
  "error_count": 45,
  "config": { "input_dim": 1024, "cortex_dim": 2048, "hidden_dim": 512 },
  "trainer": { "buffer_size": 456, "total_steps": 1200, "loss_history_length": 1200 }
}
```

#### POST /watcher/train
Manually trigger Watcher training on the replay buffer.

**Response (200):**
```json
{
  "steps": 456,
  "avg_loss": 0.0189,
  "total_steps": 1656,
  "buffer_size": 456
}
```

### IX.4 — Resonant Memory

#### GET /memory/stats
Index statistics including document count, bucket utilization, and capacity metrics.

#### POST /memory/store
Store a document in the Resonant Index by its phase.

**Request Body:**
```json
{
  "doc_id": "menu-bigmac",
  "text": "Big Mac - two all-beef patties...",
  "title": "Big Mac Menu Item",
  "source_uri": "knowledge://menu/bigmac"
}
```

#### POST /memory/retrieve
Retrieve documents by phase resonance.

**Request Body:**
```json
{ "text": "I want a burger", "top_k": 5, "fuzzy_radius": 2 }
```

#### GET /memory/heatmap
Returns 1000-element array of phase bucket sizes for visualization.

### IX.5 — State Persistence

#### POST /state/save
Manually save brain state to disk (atomic write).

#### GET /state/info
Returns metadata about the saved state file (path, size, last save time, inference count).

#### POST /state/config
Configure auto-save interval.

**Request Body:**
```json
{ "auto_save_interval": 5 }
```

### IX.6 — Tunable Parameters

#### GET /config
Returns all tunable parameters (physics, ambition, watcher, storage, resonant_index).

#### POST /config
Hot-swap parameters at runtime.

**Request Body:**
```json
{
  "physics": { "dt": 0.005, "decay_rate": 0.15 },
  "ambition": { "entropy_threshold": 0.7 }
}
```

### IX.7 — Multi-Session

#### GET /sessions
List all active brain sessions with summary state.

#### POST /sessions/{session_id}/boot
Boot an independent brain for the given session ID.

#### POST /sessions/{session_id}/think
Think with the session's brain (isolated state).

**Request Body:**
```json
{ "text": "input text" }
```

#### GET /sessions/{session_id}/state
Get the session brain's full state.

#### POST /sessions/{session_id}/destroy
Destroy the session (saves state first, then removes from memory).

---

## Part X: TTS API (v7.61.0)

> **Version**: 7.61.0 | **Base URL**: `http://localhost:11435`
> **Provider**: ElevenLabs (via `radiant-tts` package)
> **Full reference**: `docs/21-TEXT-TO-SPEECH.md` Part XIII

---

### X.1 — Speech Synthesis

#### POST /tts
One-shot text-to-speech synthesis.

**Request Body:**
```json
{
  "text": "Welcome to McDonald's! What can I get for you?",
  "voice": "rachel",
  "language": "en-US",
  "output_format": "mp3_44100_128"
}
```

**Response**: Audio binary (Content-Type: audio/mpeg)

### X.2 — Provider Status

#### GET /tts/provider
Check TTS provider configuration and availability.

**Response (200):**
```json
{
  "provider": "elevenlabs",
  "available": true,
  "model": "eleven_turbo_v2_5",
  "voice": "rachel",
  "output_format": "mp3_44100_128"
}
```

### X.3 — Voice Listing

#### GET /tts/voices
List all available ElevenLabs voices (library + cloned).

**Response (200):**
```json
{
  "voices": [
    {
      "voice_id": "21m00Tcm4TlvDq8ikWAM",
      "name": "Rachel",
      "category": "premade",
      "description": "Warm, conversational",
      "preview_url": "https://..."
    }
  ],
  "count": 42
}
```

---

*Consolidated from 7 source documents (0 not found). 4,117 source lines. Updated with OMEGA Proving Ground and TTS API (v7.61.0).*
