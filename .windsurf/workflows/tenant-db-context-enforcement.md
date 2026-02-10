---
description: Policy - All tenant-facing Lambda handlers MUST use parameterized set_config for RLS context. No string interpolation allowed.
---

# Tenant Database Context Enforcement Policy

## Rule

All Lambda handlers that serve **Think Tank Suite tenant apps** (Think Tank, Curator, Dojo, Tenant Admin, Omega Lab, Scribe, Think Tank Mac) MUST:

1. **Set tenant context using parameterized `set_config()`** — never string interpolation
2. **Use the shared database pool** from `lambda/shared/services/database.ts` — never create inline `new Pool()`
3. **Never give tenant apps direct database access** — all DB operations go through the Lambda service layer

## Think Tank Suite Apps (Tenant-Level)

These apps access resources ONLY through the Lambda service layer with RLS:

| App | Backend Handler |
|-----|----------------|
| Think Tank | `lambda/thinktank/handler.ts` |
| Think Tank Tenant Admin | `lambda/thinktank-tenant-admin/handler.ts` |
| Curator | `lambda/curator/index.ts` |
| Dojo | `lambda/admin/dojo.ts` (separate Lambda) |
| Omega Lab | Via Think Tank API Gateway |
| Think Tank Mac | Via Think Tank API Gateway |

## Platform-Level Apps (System Admin)

These apps may have elevated access but MUST still use parameterized queries:

| App | Access Level |
|-----|-------------|
| Admin Dashboard | System admin auth, no RLS |
| Think Tank Admin | System admin auth, scoped by tenant picker |
| OMEGA Forge | System admin auth, direct DB (platform tool) |
| Swift Deployer | AWS IAM, infrastructure only |

## Correct Pattern

```typescript
// ✅ CORRECT: Parameterized set_config
await pool.query(`SELECT set_config('app.current_tenant_id', $1, false)`, [tenantId]);

// ✅ CORRECT: SET LOCAL in transaction (auto-cleanup)
await client.query('BEGIN');
await client.query(`SELECT set_config('app.current_tenant_id', $1, true)`, [tenantId]);
// ... queries ...
await client.query('COMMIT');

// ✅ CORRECT: Use withSecureDBContext from db-context.service.ts
const result = await withSecureDBContext(authContext, async (client) => {
  return client.query('SELECT * FROM data WHERE id = $1', [id]);
});

// ✅ CORRECT: Use shared pool
import { getDbPool } from '../shared/services/database';
const pool = await getDbPool();
```

## Anti-Patterns (FORBIDDEN)

```typescript
// ❌ FORBIDDEN: String interpolation (SQL injection risk)
await db.query(`SET app.current_tenant_id = '${tenantId}'`);

// ❌ FORBIDDEN: Inline pool creation
const pool = new Pool({ host: process.env.DB_HOST, ... });

// ❌ FORBIDDEN: Session-scoped SET without transaction (context leak risk)
await client.query('SET app.current_tenant_id = $1', [tenantId]);
// ... missing BEGIN/COMMIT wrapper ...

// ❌ FORBIDDEN: Tenant app with direct DB access
// (Forge is the ONLY exception — it's a platform tool, not a tenant app)
import { Pool } from 'pg';
const pool = new Pool({ host: process.env.AURORA_PROXY_ENDPOINT });
```

## Tenant Infrastructure Operations

When tenant apps need operations that require system-admin DB permissions (e.g., enabling OMEGA brain, provisioning storage, wiring features), they MUST use the **Tenant Ops API**:

```
POST /api/v1/platform/tenant-ops/request
{
  "tenantId": "...",
  "operation": "enable_omega_brain",
  "parameters": { ... }
}
```

Handler: `lambda/platform/tenant-ops.ts`

Tenant admins can request operations; system admins approve and execute them.

## Verification

When reviewing code changes:
1. Search for `SET app.current_tenant_id` — must NOT use string interpolation
2. Search for `new Pool(` in handler files — must NOT exist (use getDbPool)
3. Search for `from 'pg'` in handler files — only via database.ts imports
4. Ensure all tenant-facing handlers call `set_config` before dispatching
