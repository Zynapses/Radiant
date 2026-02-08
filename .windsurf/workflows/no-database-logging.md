---
description: Policy - No direct database writes for logs, audit trails, telemetry, or usage events. All event data MUST go through the Event Firehose Service.
---

# No Database Logging Policy

**Version**: 1.0.0
**Effective**: v4.18.0+
**Severity**: CRITICAL — violations cause database bottlenecks at scale

## The Rule

**NEVER write log, audit, telemetry, billing, or usage event data directly to PostgreSQL.**

All event data MUST be emitted through the **Event Firehose Service** (`event-firehose.service.ts`),
which routes events to Kinesis Data Firehose → S3 Parquet → Athena.

## What This Means

### FORBIDDEN Patterns

```typescript
// ❌ FORBIDDEN: Direct INSERT INTO any *_log, *_audit, *_event, *_telemetry table
await pool.query('INSERT INTO audit_logs (...) VALUES (...)', [...]);
await pool.query('INSERT INTO uds_audit_log (...) VALUES (...)', [...]);
await pool.query('INSERT INTO intrusion_events (...) VALUES (...)', [...]);
await pool.query('INSERT INTO account_lockout_history (...) VALUES (...)', [...]);
await pool.query('INSERT INTO usage_events (...) VALUES (...)', [...]);
await pool.query('INSERT INTO drift_invocation_telemetry (...) VALUES (...)', [...]);
await pool.query('INSERT INTO storage_events (...) VALUES (...)', [...]);
await executeStatement('INSERT INTO ..._log ...', [...]);
await executeStatement('INSERT INTO ..._audit ...', [...]);

// ❌ FORBIDDEN: Any INSERT into tables that match these patterns:
//   *_log, *_audit, *_event*, *_telemetry, *_metric*, *_history (for events)
//   storage_events, usage_events, cost_attribution_log
```

### REQUIRED Patterns

```typescript
// ✅ REQUIRED: Use Event Firehose Service
import { emitEvent, emitAuditEvent, emitSecurityEvent } from './event-firehose.service';

// For audit events
await emitAuditEvent(tenantId, userId, 'update_settings', 'lockout_policy', { details });

// For security events (immediate, non-buffered)
await emitSecurityEvent(tenantId, 'auth_failure', 'high', { ip, reason });

// For AI invocations
await emitAIInvocation(tenantId, userId, modelId, { tokens, latencyMs });

// For billing
await emitBillingEvent(tenantId, 'credit_used', { amount, model });

// For generic events
await emitEvent({
  typeKey: 'collaboration_event',
  tenantId,
  userId,
  payload: { action: 'invite_sent', guestEmail },
});
```

## Detection Criteria

A violation is detected when ANY of the following patterns appear in new or modified code:

1. **`INSERT INTO` + table name matching**: `*_log`, `*_audit`, `*_event`, `*_telemetry`, `*_metric`, `*_history`, `storage_events`, `usage_events`, `cost_attribution`, `drift_invocation`
2. **`executeStatement` with INSERT** into any of the above table patterns
3. **`pool.query` with INSERT** into any of the above table patterns
4. **New database table creation** for event/log storage (should be a `data_type_registry` entry instead)

## Exceptions

The following are **NOT violations** (business-critical OLTP data that needs ACID):

- `INSERT INTO users` — user records
- `INSERT INTO tenants` — tenant records
- `INSERT INTO conversations` — active conversation state
- `INSERT INTO messages` — active message state
- `INSERT INTO models` — model configuration
- `INSERT INTO subscriptions` — billing state
- `INSERT INTO tenant_licenses` — license state
- `INSERT INTO data_type_registry` — data type definitions (metadata, not events)
- `INSERT INTO data_location_index` — location index (metadata about S3 objects)
- `INSERT INTO tenant_data_retention` — retention policy configuration
- `INSERT INTO glacier_deletion_queue` — deletion queue (operational state)
- `UPDATE` statements on any table (updates to existing records are fine)
- `INSERT INTO log_source_registry` — service registration (runs once per cold start)

## Why This Policy Exists

At 1M+ concurrent users, the platform generates ~30-100M event writes per day. Each
`INSERT INTO` to PostgreSQL:

1. Consumes a database connection from the pool
2. Triggers RLS policy evaluation
3. Updates indexes
4. Fires triggers
5. Generates WAL entries
6. Competes with business-critical queries for IOPS

This creates:
- Connection pool exhaustion (even with RDS Proxy)
- Write amplification from indexes and triggers
- Aurora IOPS costs of $500-2000+/month just for logging
- Query latency degradation for actual business operations

The Event Firehose path costs ~$30-50/month for the same volume and has zero database impact.

## Migration Guide

For services that currently INSERT into database log tables:

1. Add `import { emitEvent } from '../shared/services/event-firehose.service'`
2. Replace the `INSERT INTO` with the appropriate `emit*` call
3. If dual-write mode is needed during migration, set `dualWrite: true` in the event
4. Ensure `flushEventBuffer()` is called before Lambda returns (automatic with `withEnforcedLogging`)
5. Register new data types in `data_type_registry` if the event doesn't match existing types

## Data Type Registry

All event types must be registered in the `data_type_registry` table. Current registered types:

| Type Key | Category | Description |
|----------|----------|-------------|
| `audit_log` | audit | Admin actions, role changes, settings |
| `license_audit` | audit | License assignment/removal |
| `log_retention_audit` | audit | Retention policy changes |
| `uds_audit` | audit | User Data Service operations |
| `system_admin_audit` | audit | System admin actions |
| `security_event` | security | Auth failures, MFA, suspicious activity |
| `intrusion_event` | security | RIDPS alerts, threat detections |
| `lockout_event` | security | Account lockout/unlock |
| `ai_invocation` | ai_model | Model requests, responses, latency |
| `drift_telemetry` | ai_model | Model drift scores, reroutes |
| `brain_plan` | ai_model | AGI Brain planning decisions |
| `compliance_event` | compliance | GDPR erasure, consent changes |
| `guest_restriction` | compliance | Guest access restrictions |
| `billing_event` | billing | Credit usage, metering |
| `cost_attribution` | billing | Per-user, per-model costs |
| `storage_event` | billing | Upload/download/archive events |
| `infrastructure_metric` | infrastructure | Lambda/API latency, errors |
| `error_log` | infrastructure | Application errors, stack traces |
| `application_log` | application | General structured logs |
| `delight_event` | application | UX delight interactions |
| `collaboration_event` | collaboration | Guest invites, sharing |

## Querying Data

To query data that was previously in PostgreSQL, use the **Data Lake Query Service**:

```typescript
import { DataLakeQueryService } from './data-lake-query.service';

const queryService = new DataLakeQueryService(pool);
const results = await queryService.queryEvents({
  tenantId: 'tenant-123',
  dataTypeKey: 'audit_log',
  startDate: '2026-01-01',
  endDate: '2026-02-01',
  filters: { action: 'update_settings' },
  limit: 100,
});
```

## Enforcement

This policy is enforced by:
1. **Code review** — any PR with `INSERT INTO` matching the forbidden patterns must be rejected
2. **CI grep check** — automated scan for forbidden INSERT patterns in new code
3. **This workflow** — Windsurf/Cascade agents must follow this policy for all new code
4. **Runtime monitoring** — CloudWatch metrics track database write volume; alerts fire on spikes
