---
description: Policy - All Lambda services MUST use the Logging Registry for structured, enforced logging. No raw console.log/error or legacy enhancedLogger allowed.
---

# Enforced Logging Policy

## Purpose

Every Lambda service in RADIANT **MUST** use the Logging Registry (`logging-registry.service.ts`) for all log output. This ensures:

1. **Structured JSON logging** — every log entry includes timestamp, level, service name, category, requestId, tenantId
2. **Auto-registration** — services self-register in `log_source_registry` on first use
3. **Compliance coverage** — `log-retention-policy.service.ts` can detect unenforced sources and flag them as critical compliance issues
4. **Retention policy adherence** — log categories drive retention rules (HIPAA, GDPR, SOC2)
5. **Audit trail** — `getLoggingCoverageReport()` shows exactly which services are logging and which are not

## Rules

### REQUIRED: Use `createRegisteredLogger()` or `withEnforcedLogging()`

Every service file that produces log output MUST use one of:

```typescript
// Option 1: Registered logger (for services, not Lambda entry points)
import { createRegisteredLogger } from './logging-registry.service';

const logger = createRegisteredLogger({
  serviceName: 'your-domain/service-name',  // e.g. 'sentinel/alert-processor'
  category: 'security',                      // LogCategory enum value
  sourceType: 'application',                 // 'lambda' | 'application' | 'infrastructure'
});
```

```typescript
// Option 2: Enforced handler wrapper (for Lambda entry points)
import { withEnforcedLogging } from './logging-registry.service';

export const handler = withEnforcedLogging(
  { serviceName: 'admin/users', category: 'audit' },
  async (event, context, logger) => {
    logger.info('Processing request', { action: 'list_users' });
    return { statusCode: 200, body: '...' };
  }
);
```

### FORBIDDEN

| Pattern | Why |
|---------|-----|
| `console.log(...)` | Not structured, not registered, not categorized |
| `console.error(...)` | Same — bypasses retention policy and compliance tracking |
| `console.warn(...)` | Same |
| `import { enhancedLogger } from '../logging/enhanced-logger'` | Legacy logger — not registered in `log_source_registry` |
| Logging without a `category` | Breaks retention policy resolution |
| Logging without a `serviceName` | Cannot be tracked for coverage reports |

### Service Name Convention

Service names MUST follow the pattern: `domain/service-name`

| Domain | Examples |
|--------|----------|
| `security` | `security/alert-service`, `security/policy-framework` |
| `sentinel` | `sentinel/alert-processor`, `sentinel/notifier`, `sentinel/watchdog` |
| `billing` | `billing/metering`, `billing/stripe-sync` |
| `admin` | `admin/users`, `admin/tenants`, `admin/licensing` |
| `ai` | `ai/model-router`, `ai/drift-detection`, `ai/orchestrator` |
| `cato` | `cato/genesis`, `cato/cortex`, `cato/omega` |
| `workflow` | `workflow/engine`, `workflow/uncertainty` |
| `data` | `data/retention`, `data/migration` |

### Log Categories

Must be one of the `LogCategory` enum values from `log-retention-policy.service.ts`:

- `security` — security events, alerts, incidents
- `audit` — admin actions, configuration changes
- `billing` — metering, invoicing, subscriptions
- `access` — authentication, authorization
- `application` — general application logs
- `infrastructure` — CDK, deployment, health checks
- `compliance` — compliance-specific events
- `performance` — latency, throughput metrics
- `error` — error tracking, crash reports

## Enforcement Checklist

When creating or modifying ANY Lambda service:

- [ ] Service uses `createRegisteredLogger()` or `withEnforcedLogging()`
- [ ] `serviceName` follows `domain/service-name` convention
- [ ] `category` is set to the correct `LogCategory`
- [ ] No `console.log`, `console.error`, or `console.warn` calls remain
- [ ] No `enhancedLogger` imports remain (legacy)
- [ ] Error logging uses `logger.error(message, error)` with the Error object
- [ ] Sensitive data (API keys, tokens, PII) is NOT logged in metadata

## Audit Command

To check logging coverage across all services:

```typescript
import { getLoggingCoverageReport } from './services/logging-registry.service';

const report = await getLoggingCoverageReport(pool);
// report.unenforced — count of services NOT using enforced logging
// report.unenforcedSources — list of non-compliant services
// report.staleSources — services that haven't logged in 7+ days
```

## Compliance Impact

The `log-retention-policy.service.ts` `detectComplianceIssues()` method flags unenforced log sources as **critical severity** for any tenant with active compliance licenses (HIPAA, GDPR, SOC2). This means:

- Unenforced logging → critical compliance issue in admin dashboard
- Missing log sources → audit gaps that block compliance certification
- Stale sources → potential coverage gaps requiring investigation
