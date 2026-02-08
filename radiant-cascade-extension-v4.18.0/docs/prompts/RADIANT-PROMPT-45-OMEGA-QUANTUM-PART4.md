# RADIANT-PROMPT-45: Part 4 — Firmware Schema, Admin API, Dashboard, Testing, Rollback

---

## 5. Firmware Schema

### 5.1 Create `lambda/shared/services/omega/schemas/bio-firmware.schema.json`

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "$id": "https://radiant.ai/schemas/omega-firmware-6.5.0.json",
  "title": "OMEGA Firmware (.bio) Specification",
  "type": "object",
  "required": ["manifest", "quantum", "ambition", "helix", "broca", "signature"],
  "properties": {
    "manifest": {
      "type": "object",
      "required": ["name", "version", "schema_version", "author"],
      "properties": {
        "name": { "type": "string", "maxLength": 128 },
        "version": { "type": "string", "pattern": "^\\d+\\.\\d+\\.\\d+$" },
        "schema_version": { "type": "string", "enum": ["6.5.0"] },
        "author": { "type": "string" },
        "description": { "type": "string", "maxLength": 512 },
        "parent_firmware_id": { "type": ["string", "null"] },
        "created_at": { "type": "string", "format": "date-time" },
        "tags": { "type": "array", "items": { "type": "string" } }
      }
    },
    "quantum": {
      "type": "object",
      "required": ["hilbert_dimension", "amplitude_decay", "unitarity_enforcement"],
      "properties": {
        "hilbert_dimension": {
          "type": "object",
          "properties": {
            "value": { "type": "integer", "minimum": 256, "maximum": 4096, "default": 1024 },
            "description": { "type": "string" }
          }
        },
        "amplitude_decay": {
          "type": "object",
          "properties": {
            "lambda": { "type": "number", "minimum": 0.0001, "maximum": 0.1, "default": 0.001 },
            "description": { "type": "string" }
          }
        },
        "phase_resolution": {
          "type": "object",
          "properties": {
            "bits": { "type": "integer", "minimum": 8, "maximum": 32, "default": 16 },
            "description": { "type": "string" }
          }
        },
        "unitarity_enforcement": {
          "type": "object",
          "properties": {
            "mode": { "type": "string", "enum": ["renormalize", "project", "strict"], "default": "renormalize" },
            "correction_threshold": { "type": "number", "default": 0.001 },
            "alert_threshold": { "type": "number", "default": 0.01 }
          }
        },
        "measurement_threshold": {
          "type": "object",
          "properties": {
            "value": { "type": "number", "minimum": 0.1, "maximum": 0.9, "default": 0.5 },
            "description": { "type": "string" }
          }
        },
        "interference_thresholds": {
          "type": "object",
          "properties": {
            "constructive": { "type": "number", "default": 0.85 },
            "destructive": { "type": "number", "default": 0.15 }
          }
        },
        "entanglement": {
          "type": "object",
          "properties": {
            "enabled": { "type": "boolean", "default": true },
            "max_entangled_pairs": { "type": "integer", "default": 1000 }
          }
        },
        "superposition": {
          "type": "object",
          "properties": {
            "max_basis_states": { "type": "integer", "default": 100 }
          }
        }
      }
    },
    "ambition": {
      "type": "object",
      "required": ["entropy_threshold", "dopamine_floor"],
      "properties": {
        "entropy_threshold": { "type": "object", "properties": { "value": { "type": "number", "minimum": 0, "maximum": 1, "default": 0.5 } } },
        "dopamine_floor": { "type": "object", "properties": { "value": { "type": "number", "minimum": 0, "maximum": 1, "default": 0.2 } } },
        "dopamine_decay_rate": { "type": "object", "properties": { "value": { "type": "number", "minimum": 0, "maximum": 1, "default": 0.99 } } },
        "entropy_accumulation_rate": { "type": "object", "properties": { "value": { "type": "number", "minimum": 0, "maximum": 1, "default": 0.01 } } }
      }
    },
    "helix": {
      "type": "object",
      "required": ["rules"],
      "properties": {
        "rules": {
          "type": "array",
          "items": {
            "type": "object",
            "required": ["rule_id", "name", "category", "severity", "forbidden_state"],
            "properties": {
              "rule_id": { "type": "string", "format": "uuid" },
              "name": { "type": "string", "maxLength": 64 },
              "description": { "type": "string" },
              "category": { "type": "string", "enum": ["security", "safety", "compliance", "ethics", "brand", "operational", "custom"] },
              "severity": { "type": "string", "enum": ["critical", "high", "medium", "low"] },
              "forbidden_state": {
                "type": "object",
                "required": ["real", "imaginary"],
                "properties": {
                  "real": { "type": "array", "items": { "type": "number" } },
                  "imaginary": { "type": "array", "items": { "type": "number" } }
                }
              },
              "interference_type": { "type": "string", "enum": ["destructive", "dampening"], "default": "destructive" },
              "dampening_factor": { "type": "number", "minimum": 0, "maximum": 1, "default": 0 },
              "enabled": { "type": "boolean", "default": true },
              "audit_always": { "type": "boolean", "default": false }
            }
          }
        }
      }
    },
    "broca": {
      "type": "object",
      "description": "Natural language interface parameters",
      "properties": {
        "system_prompt_overlay": { "type": "string" },
        "style_directives": { "type": "array", "items": { "type": "string" } },
        "vocabulary_constraints": {
          "type": "object",
          "properties": {
            "forbidden_words": { "type": "array", "items": { "type": "string" } },
            "preferred_terms": { "type": "object", "additionalProperties": { "type": "string" } }
          }
        }
      }
    },
    "signature": {
      "type": "object",
      "required": ["algorithm", "signer_id"],
      "properties": {
        "algorithm": { "type": "string", "enum": ["ed25519"], "default": "ed25519" },
        "signer_id": { "type": "string", "format": "uuid" },
        "signed_at": { "type": "string", "format": "date-time" },
        "content_hash": { "type": "string" },
        "signature_hex": { "type": "string" }
      }
    }
  }
}
```

---

## 6. Genesis Forge: Firmware Activation API

### 6.1 Hot-Swap Lifecycle

```
┌────────────┐     ┌────────────┐     ┌────────────────┐     ┌───────────┐
│  Forge UI  │────>│ Admin API  │────>│ omega_firmware  │────>│ omega_    │
│ (activate) │     │ (handler)  │     │ (status, hash)  │     │ brains    │
└────────────┘     └────────────┘     └────────────────┘     │ (fw_hash) │
                                                              └─────┬─────┘
       ┌────────────────────────────────────────────────────────────┘
       │   On next inference:
       v
┌─────────────────────┐     ┌─────────┐     ┌──────────┐
│ QuantumBrainService │────>│ Verify  │────>│ Self-    │──> Commit or Rollback
│ checkFirmwareSwap() │     │ Ed25519 │     │ Test     │
└─────────────────────┘     └─────────┘     └──────────┘
```

**Trigger:** Admin activates firmware → handler updates `omega_brains.firmware_hash` →
on next inference, `checkFirmwareSwap()` detects hash mismatch → atomic swap.

### 6.2 Create `lambda/admin/omega-firmware.ts`

```typescript
import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { executeStatement } from '../shared/db/client';
import * as crypto from 'crypto';

export async function handler(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  const subPath = event.path.replace('/admin/omega/firmware', '');
  const method = event.httpMethod;
  const tenantId = event.requestContext.authorizer?.tenantId;
  const userId = event.requestContext.authorizer?.userId;
  if (!tenantId || !userId) return respond(401, { error: 'Unauthorized' });

  try {
    if (method === 'POST' && subPath === '/activate') return await activate(event, tenantId, userId);
    if (method === 'POST' && subPath === '/revert') return await revert(event, tenantId);
    if (method === 'GET' && subPath === '/status') return await status(event, tenantId);
    return respond(404, { error: 'Not found' });
  } catch (err: any) {
    console.error(`[OMEGA Firmware] ${err.message}`);
    return respond(500, { error: 'Internal server error' });
  }
}

async function activate(event: APIGatewayProxyEvent, tenantId: string, activatorId: string): Promise<APIGatewayProxyResult> {
  const { firmware_id, brain_id } = JSON.parse(event.body || '{}');
  if (!firmware_id || !brain_id) return respond(400, { error: 'firmware_id and brain_id required' });

  const fwResult = await executeStatement(
    `SELECT id, signed_by, is_verified, status, content_hash FROM omega_firmware WHERE id = $1 AND tenant_id = $2`,
    [firmware_id, tenantId], tenantId
  );
  if (fwResult.rows.length === 0) return respond(404, { error: 'Firmware not found' });
  const fw = fwResult.rows[0];
  if (fw.status === 'revoked') return respond(400, { error: 'Cannot activate revoked firmware' });

  // 2-person rule
  if (fw.signed_by === activatorId) {
    return respond(403, { error: '2-person rule: activator cannot be the signer', signed_by: fw.signed_by, activator: activatorId });
  }

  // Compute content hash for integrity
  const fwContent = await executeStatement(
    `SELECT quantum, ambition, personality, helix_rules_snapshot FROM omega_firmware WHERE id = $1`, [firmware_id], tenantId
  );
  const computedHash = crypto.createHash('sha512').update(JSON.stringify(fwContent.rows[0])).digest('hex');
  if (fw.content_hash && fw.content_hash !== computedHash) {
    return respond(400, { error: 'Content hash mismatch — possible tampering' });
  }

  // Supersede current active firmware
  await executeStatement(
    `UPDATE omega_firmware SET status = 'superseded', superseded_by = $1, updated_at = NOW()
     WHERE id = (SELECT active_firmware_id FROM omega_brains WHERE id = $2 AND tenant_id = $3) AND status = 'active'`,
    [firmware_id, brain_id, tenantId], tenantId
  );

  // Activate new
  await executeStatement(
    `UPDATE omega_firmware SET status = 'active', is_verified = true, updated_at = NOW() WHERE id = $1 AND tenant_id = $2`,
    [firmware_id, tenantId], tenantId
  );

  // Update brain firmware_hash — triggers hot-swap
  await executeStatement(
    `UPDATE omega_brains SET active_firmware_id = $1, firmware_hash = $2, updated_at = NOW() WHERE id = $3 AND tenant_id = $4`,
    [firmware_id, computedHash, brain_id, tenantId], tenantId
  );

  return respond(200, { success: true, firmware_id, brain_id, content_hash: computedHash, message: 'Firmware activated. Hot-swap on next inference.' });
}

async function revert(event: APIGatewayProxyEvent, tenantId: string): Promise<APIGatewayProxyResult> {
  const { brain_id } = JSON.parse(event.body || '{}');
  if (!brain_id) return respond(400, { error: 'brain_id required' });

  const result = await executeStatement(
    `SELECT f_prev.id AS prev_id, f_prev.content_hash AS prev_hash
     FROM omega_brains b
     JOIN omega_firmware f_cur ON f_cur.id = b.active_firmware_id
     JOIN omega_firmware f_prev ON f_prev.status = 'superseded' AND f_prev.superseded_by = f_cur.id
     WHERE b.id = $1 AND b.tenant_id = $2
     ORDER BY f_prev.updated_at DESC LIMIT 1`,
    [brain_id, tenantId], tenantId
  );
  if (result.rows.length === 0) return respond(404, { error: 'No previous firmware to revert to' });
  const prev = result.rows[0];

  await executeStatement(`UPDATE omega_firmware SET status = 'active', superseded_by = NULL, updated_at = NOW() WHERE id = $1 AND tenant_id = $2`, [prev.prev_id, tenantId], tenantId);
  await executeStatement(`UPDATE omega_firmware SET status = 'superseded', updated_at = NOW() WHERE id = (SELECT active_firmware_id FROM omega_brains WHERE id = $1 AND tenant_id = $2)`, [brain_id, tenantId], tenantId);
  await executeStatement(`UPDATE omega_brains SET active_firmware_id = $1, firmware_hash = $2, updated_at = NOW() WHERE id = $3 AND tenant_id = $4`, [prev.prev_id, prev.prev_hash, brain_id, tenantId], tenantId);

  return respond(200, { success: true, reverted_to: prev.prev_id, brain_id });
}

async function status(event: APIGatewayProxyEvent, tenantId: string): Promise<APIGatewayProxyResult> {
  const brainId = event.queryStringParameters?.brain_id;
  if (!brainId) return respond(400, { error: 'brain_id query param required' });

  const result = await executeStatement(
    `SELECT b.id AS brain_id, b.firmware_hash, b.active_firmware_id, b.hilbert_dimension,
            b.last_norm_value, b.unitarity_corrections_count,
            f.status AS fw_status, f.content_hash, f.is_verified, f.signed_by,
            f.created_at AS fw_created_at, f.quantum, f.hilbert_dimension AS fw_hilbert_dim, f.unitarity_mode
     FROM omega_brains b LEFT JOIN omega_firmware f ON f.id = b.active_firmware_id
     WHERE b.id = $1 AND b.tenant_id = $2`,
    [brainId, tenantId], tenantId
  );
  if (result.rows.length === 0) return respond(404, { error: 'Brain not found' });
  return respond(200, result.rows[0]);
}

function respond(statusCode: number, body: any): APIGatewayProxyResult {
  return { statusCode, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) };
}
```

### 6.3 Wire in `lambda/admin/handler.ts`

```typescript
if (resource.startsWith('/admin/omega/firmware')) {
  const mod = await import('./omega-firmware.js');
  return mod.handler(event, context);
}
```

### 6.4 API Gateway routes in `lib/stacks/admin-stack.ts`

```typescript
const omegaFw = adminApi.root.addResource('admin').addResource('omega').addResource('firmware');
omegaFw.addResource('activate').addMethod('POST', adminIntegration, authOptions);
omegaFw.addResource('revert').addMethod('POST', adminIntegration, authOptions);
omegaFw.addResource('status').addMethod('GET', adminIntegration, authOptions);
```

---

## 7. Admin API: Quantum State Endpoints

### 7.1 Create `lambda/admin/omega-quantum.ts`

```typescript
import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { executeStatement } from '../shared/db/client';

export async function handler(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  const subPath = event.path.replace('/admin/omega/quantum', '');
  const method = event.httpMethod;
  const tenantId = event.requestContext.authorizer?.tenantId;
  if (!tenantId) return respond(401, { error: 'Unauthorized' });

  try {
    if (method === 'GET' && subPath === '/state-summary') return await stateSummary(event, tenantId);
    if (method === 'GET' && subPath === '/unitarity-health') return await unitarityHealth(event, tenantId);
    if (method === 'POST' && subPath === '/helix-test') return await helixTest(event, tenantId);
    return respond(404, { error: 'Not found' });
  } catch (err: any) {
    console.error(`[OMEGA Quantum] ${err.message}`);
    return respond(500, { error: 'Internal server error' });
  }
}

async function stateSummary(event: APIGatewayProxyEvent, tenantId: string): Promise<APIGatewayProxyResult> {
  const brainId = event.queryStringParameters?.brain_id;
  if (!brainId) return respond(400, { error: 'brain_id required' });

  const brain = await executeStatement(
    `SELECT b.id, b.hilbert_dimension, b.last_norm_value, b.last_unitarity_check,
            b.unitarity_corrections_count, b.firmware_hash, b.active_firmware_id,
            f.status AS fw_status, f.hilbert_dimension AS fw_dim
     FROM omega_brains b LEFT JOIN omega_firmware f ON f.id = b.active_firmware_id
     WHERE b.id = $1 AND b.tenant_id = $2`,
    [brainId, tenantId], tenantId
  );
  if (brain.rows.length === 0) return respond(404, { error: 'Brain not found' });

  const mStats = await executeStatement(
    `SELECT COUNT(*) AS total, AVG(probability_measured) AS avg_prob, MAX(measured_at) AS last_at
     FROM omega_measurements WHERE brain_id = $1 AND tenant_id = $2 AND measured_at > NOW() - INTERVAL '24 hours'`,
    [brainId, tenantId], tenantId
  );

  return respond(200, { brain: brain.rows[0], measurements_24h: mStats.rows[0] });
}

async function unitarityHealth(event: APIGatewayProxyEvent, tenantId: string): Promise<APIGatewayProxyResult> {
  const brainId = event.queryStringParameters?.brain_id;
  const limit = parseInt(event.queryStringParameters?.limit || '50');
  if (!brainId) return respond(400, { error: 'brain_id required' });

  const events = await executeStatement(
    `SELECT event_type, measured_norm, deviation, action_taken, detected_at, cycle_number
     FROM omega_unitarity_events WHERE brain_id = $1 AND tenant_id = $2 ORDER BY detected_at DESC LIMIT $3`,
    [brainId, tenantId, limit], tenantId
  );

  const stats = await executeStatement(
    `SELECT event_type, COUNT(*) AS count, AVG(deviation) AS avg_deviation
     FROM omega_unitarity_events WHERE brain_id = $1 AND tenant_id = $2 AND detected_at > NOW() - INTERVAL '24 hours'
     GROUP BY event_type`,
    [brainId, tenantId], tenantId
  );

  return respond(200, {
    events: events.rows, stats_24h: stats.rows,
    healthy: !stats.rows.some((s: any) => s.event_type === 'violation' && parseInt(s.count) > 0)
  });
}

async function helixTest(event: APIGatewayProxyEvent, tenantId: string): Promise<APIGatewayProxyResult> {
  const { rule, test_vector } = JSON.parse(event.body || '{}');
  if (!rule || !test_vector) return respond(400, { error: 'rule and test_vector required' });

  const { projectOutForbidden, dampenForbidden, stateNorm } = await import('../shared/services/omega/quantum-math.js');

  const toVec = (v: { real: number[]; imaginary: number[] }) => ({
    amplitudes: v.real.map((r: number, i: number) => ({ real: r, imaginary: v.imaginary[i] || 0 })),
    hilbertDimension: v.real.length, norm: 1.0
  });

  const forbiddenVec = toVec(rule.forbidden_state);
  const inputVec = toVec(test_vector);

  if (rule.interference_type === 'destructive') {
    const { safeState, overlap, projected } = projectOutForbidden(inputVec, forbiddenVec);
    return respond(200, { action: 'destructive', overlap, projected, safe_state_norm: stateNorm(safeState) });
  } else {
    const { dampenedState, overlap } = dampenForbidden(inputVec, forbiddenVec, rule.dampening_factor || 0.5);
    return respond(200, { action: 'dampening', overlap, dampened_state_norm: stateNorm(dampenedState) });
  }
}

function respond(statusCode: number, body: any): APIGatewayProxyResult {
  return { statusCode, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) };
}
```

### 7.2 Wire in `lambda/admin/handler.ts`

```typescript
if (resource.startsWith('/admin/omega/quantum')) {
  const mod = await import('./omega-quantum.js');
  return mod.handler(event, context);
}
```

### 7.3 API Gateway routes in `lib/stacks/admin-stack.ts`

```typescript
const omegaQ = adminApi.root.addResource('admin').addResource('omega').addResource('quantum');
omegaQ.addResource('state-summary').addMethod('GET', adminIntegration, authOptions);
omegaQ.addResource('unitarity-health').addMethod('GET', adminIntegration, authOptions);
omegaQ.addResource('helix-test').addMethod('POST', adminIntegration, authOptions);
```

---

## 8. Admin Dashboard: Firmware Panel

### 8.1 Create `apps/admin-dashboard/app/(dashboard)/omega/firmware/page.tsx`

```tsx
'use client';
import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

interface FwStatus {
  brain_id: string; firmware_hash: string; active_firmware_id: string;
  fw_status: string; content_hash: string; is_verified: boolean;
  signed_by: string; fw_created_at: string; quantum: any;
  fw_hilbert_dim: number; unitarity_mode: string;
  hilbert_dimension: number; last_norm_value: number; unitarity_corrections_count: number;
}

const fetchStatus = async (brainId: string): Promise<FwStatus> => {
  const r = await fetch(`/api/admin/omega/firmware/status?brain_id=${brainId}`);
  if (!r.ok) throw new Error('Failed to load');
  return r.json();
};

export default function FirmwarePage() {
  const qc = useQueryClient();
  const [brainId, setBrainId] = useState('');
  const [fwId, setFwId] = useState('');
  const [msg, setMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['omega-fw', brainId], queryFn: () => fetchStatus(brainId),
    enabled: brainId.length > 0, refetchInterval: 10_000
  });

  const activate = useMutation({
    mutationFn: async () => {
      const r = await fetch('/api/admin/omega/firmware/activate', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ firmware_id: fwId, brain_id: brainId })
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error);
      return j;
    },
    onSuccess: (d) => { setMsg({ type: 'ok', text: d.message }); qc.invalidateQueries({ queryKey: ['omega-fw'] }); },
    onError: (e: Error) => setMsg({ type: 'err', text: e.message })
  });

  const revertMut = useMutation({
    mutationFn: async () => {
      const r = await fetch('/api/admin/omega/firmware/revert', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ brain_id: brainId })
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error);
      return j;
    },
    onSuccess: (d) => { setMsg({ type: 'ok', text: `Reverted to ${d.reverted_to}` }); qc.invalidateQueries({ queryKey: ['omega-fw'] }); },
    onError: (e: Error) => setMsg({ type: 'err', text: e.message })
  });

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      <h1 className="text-2xl font-bold">OMEGA Firmware Management</h1>

      <div className="flex gap-2">
        <input type="text" placeholder="Brain ID (UUID)" value={brainId}
          onChange={e => setBrainId(e.target.value)}
          className="flex-1 border rounded px-3 py-2 text-sm font-mono" />
        <button onClick={() => refetch()} disabled={!brainId}
          className="px-4 py-2 bg-blue-600 text-white rounded text-sm disabled:opacity-50">Load</button>
      </div>

      {isLoading && <p className="text-gray-500">Loading...</p>}
      {data && (
        <div className="border rounded p-4 space-y-3 bg-gray-50">
          <h2 className="font-semibold">Active Firmware</h2>
          <div className="grid grid-cols-2 gap-2 text-sm">
            <div><span className="font-medium">ID:</span> {data.active_firmware_id || 'None'}</div>
            <div><span className="font-medium">Status:</span> {data.fw_status || 'N/A'}</div>
            <div><span className="font-medium">Hilbert Dim:</span> {data.fw_hilbert_dim || data.hilbert_dimension}</div>
            <div><span className="font-medium">Unitarity:</span> {data.unitarity_mode || 'renormalize'}</div>
            <div><span className="font-medium">Norm:</span> {data.last_norm_value?.toFixed(8) || 'N/A'}</div>
            <div><span className="font-medium">Corrections:</span> {data.unitarity_corrections_count}</div>
            <div><span className="font-medium">Verified:</span> {data.is_verified ? 'Yes' : 'No'}</div>
            <div><span className="font-medium">Signer:</span> {data.signed_by || 'N/A'}</div>
          </div>
          <div className="text-xs font-mono text-gray-500 break-all">Hash: {data.firmware_hash || 'N/A'}</div>
        </div>
      )}

      <div className="border rounded p-4 space-y-3">
        <h2 className="font-semibold">Activate New Firmware</h2>
        <div className="flex gap-2">
          <input type="text" placeholder="Firmware ID (UUID)" value={fwId}
            onChange={e => setFwId(e.target.value)}
            className="flex-1 border rounded px-3 py-2 text-sm font-mono" />
          <button onClick={() => activate.mutate()} disabled={!fwId || !brainId || activate.isPending}
            className="px-4 py-2 bg-green-600 text-white rounded text-sm disabled:opacity-50">
            {activate.isPending ? 'Activating...' : 'Activate'}
          </button>
        </div>
        <p className="text-xs text-gray-500">2-person rule: you cannot activate firmware you signed.</p>
      </div>

      <div className="border rounded p-4 space-y-3">
        <h2 className="font-semibold">Emergency Revert</h2>
        <button onClick={() => revertMut.mutate()} disabled={!brainId || revertMut.isPending}
          className="px-4 py-2 bg-red-600 text-white rounded text-sm disabled:opacity-50">
          {revertMut.isPending ? 'Reverting...' : 'Revert to Previous'}
        </button>
      </div>

      {msg && (
        <div className={`p-3 border rounded text-sm ${msg.type === 'ok' ? 'bg-green-100 border-green-300 text-green-800' : 'bg-red-100 border-red-300 text-red-800'}`}>
          {msg.text}
        </div>
      )}
    </div>
  );
}
```

### 8.2 Sidebar entry in `apps/admin-dashboard/components/layout/sidebar.tsx`

```typescript
// Add under OMEGA / Platform section:
{ label: 'OMEGA Firmware', href: '/omega/firmware', icon: CpuChipIcon }
```

---

## 9. Verification Checklist

### Database
- [ ] Migration `V2026_02_07_021` runs on fresh + existing DBs
- [ ] `omega_firmware.quantum` column exists (renamed from `physics`)
- [ ] `omega_firmware` has: `status`, `content_hash`, `is_verified`, `signed_by`, `superseded_by`
- [ ] `omega_brains` has: `active_firmware_id`, `firmware_hash`, `hilbert_dimension`, `last_norm_value`, `unitarity_corrections_count`
- [ ] `omega_measurements` + `omega_unitarity_events` both have `tenant_id` + RLS
- [ ] RLS uses `current_setting('app.current_tenant_id')::UUID`

### TypeScript Types
- [ ] All types export from `quantum-types.ts`
- [ ] Zod schemas validate: `QuantumParametersSchema`, `HelixRuleSchema`, `ForbiddenStateSchema`, `AmbitionSettingsSchema`
- [ ] No NestJS imports anywhere

### Quantum Math
- [ ] `stateNorm()` = 1.0 for normalized states
- [ ] `enforceUnitarity()`: renormalize corrects, strict throws
- [ ] `projectOutForbidden()`: overlap with forbidden → 0
- [ ] `dampenForbidden()`: reduces but preserves nonzero overlap
- [ ] `measureFull()`: collapses to basis state, norm = 1.0
- [ ] `simulateDecoherence()`: decays toward ground state

### Services
- [ ] Plain TS classes, no decorators
- [ ] All DB via `executeStatement()` with `tenantId`
- [ ] `checkFirmwareSwap()`: detects hash mismatch → verify → unload → apply → self-test → commit/rollback
- [ ] `applyFirmware()`: loads quantum, ambition, personality, Helix; resizes Hilbert space
- [ ] `filter()`: severity-ordered, destructive + dampening, audit_always

### Admin API
- [ ] `omega-firmware.ts`: activate (2-person rule), revert, status
- [ ] `omega-quantum.ts`: state-summary, unitarity-health, helix-test
- [ ] Routes wired in `handler.ts` + `admin-stack.ts`

### Dashboard
- [ ] Firmware page renders, polls, activates, reverts
- [ ] Sidebar entry added

---

## 10. Testing

```bash
cd packages/infrastructure/lambda
npx vitest run shared/services/omega/quantum-math.test.ts
npx vitest run shared/services/omega/helix-kernel.service.test.ts
npx tsc --noEmit --project tsconfig.json 2>&1 | head -50
```

### Unit test: `lambda/shared/services/omega/quantum-math.test.ts`

```typescript
import { describe, it, expect } from 'vitest';
import {
  complex, complexAdd, complexMul, complexConj, complexMag, complexMagSquared,
  stateNorm, normalizeState, enforceUnitarity, innerProduct,
  projectOutForbidden, dampenForbidden, measureFull, simulateDecoherence,
  equalSuperposition, basisState, stateOverlap
} from './quantum-math';

describe('Complex ops', () => {
  it('add', () => {
    const r = complexAdd(complex(1, 2), complex(3, 4));
    expect(r.real).toBeCloseTo(4); expect(r.imaginary).toBeCloseTo(6);
  });
  it('mul', () => {
    const r = complexMul(complex(1, 2), complex(3, 4));
    expect(r.real).toBeCloseTo(-5); expect(r.imaginary).toBeCloseTo(10);
  });
  it('mag', () => expect(complexMag(complex(3, 4))).toBeCloseTo(5));
  it('conj', () => {
    const c = complexConj(complex(1, 2));
    expect(c.real).toBe(1); expect(c.imaginary).toBe(-2);
  });
});

describe('State ops', () => {
  it('normalize', () => {
    const s = normalizeState({ amplitudes: [complex(3, 0), complex(4, 0)], hilbertDimension: 2, norm: 5 });
    expect(stateNorm(s)).toBeCloseTo(1.0);
  });
  it('enforceUnitarity renormalize', () => {
    const s = { amplitudes: [complex(0.8, 0), complex(0.8, 0)], hilbertDimension: 2, norm: Math.sqrt(1.28) };
    const { corrected } = enforceUnitarity(s, 'renormalize');
    expect(corrected).toBe(true);
  });
  it('enforceUnitarity strict throws', () => {
    const s = { amplitudes: [complex(0.8, 0), complex(0.8, 0)], hilbertDimension: 2, norm: Math.sqrt(1.28) };
    expect(() => enforceUnitarity(s, 'strict')).toThrow();
  });
  it('equalSuperposition norm=1', () => expect(stateNorm(equalSuperposition(100))).toBeCloseTo(1.0));
  it('basisState', () => {
    const s = basisState(4, 2);
    expect(stateNorm(s)).toBeCloseTo(1.0);
    expect(complexMag(s.amplitudes[2])).toBeCloseTo(1.0);
  });
});

describe('Helix', () => {
  it('projectOutForbidden', () => {
    const brain = normalizeState({ amplitudes: [complex(0.6, 0), complex(0.8, 0)], hilbertDimension: 2, norm: 0 });
    const forbidden = normalizeState({ amplitudes: [complex(1, 0), complex(0, 0)], hilbertDimension: 2, norm: 0 });
    const { safeState, projected } = projectOutForbidden(brain, forbidden);
    expect(projected).toBe(true);
    expect(stateOverlap(safeState, forbidden)).toBeCloseTo(0, 1);
  });
  it('dampenForbidden', () => {
    const brain = normalizeState({ amplitudes: [complex(0.6, 0), complex(0.8, 0)], hilbertDimension: 2, norm: 0 });
    const forbidden = normalizeState({ amplitudes: [complex(1, 0), complex(0, 0)], hilbertDimension: 2, norm: 0 });
    const { dampenedState, overlap } = dampenForbidden(brain, forbidden, 0.5);
    expect(stateOverlap(dampenedState, forbidden)).toBeLessThan(overlap);
    expect(stateOverlap(dampenedState, forbidden)).toBeGreaterThan(0);
  });
});

describe('Measurement', () => {
  it('measureFull collapses', () => {
    const s = normalizeState({ amplitudes: [complex(0.6, 0), complex(0.8, 0)], hilbertDimension: 2, norm: 0 });
    const r = measureFull(s);
    expect(r.basisState).toBeGreaterThanOrEqual(0);
    expect(stateNorm(r.collapsedState)).toBeCloseTo(1.0);
  });
});

describe('Decoherence', () => {
  it('decays toward ground', () => {
    const s = basisState(4, 0);
    const { decayedState, decayFactor } = simulateDecoherence(s, 100, 0.01);
    expect(decayFactor).toBeLessThan(1.0);
    expect(stateNorm(decayedState)).toBeCloseTo(1.0);
    expect(complexMagSquared(decayedState.amplitudes[0])).toBeLessThan(1.0);
  });
});
```

---

## 11. Rollback Plan

```sql
-- ROLLBACK: V2026_02_07_021__omega_quantum_upgrade.sql

DROP TABLE IF EXISTS omega_unitarity_events CASCADE;
DROP TABLE IF EXISTS omega_measurements CASCADE;

ALTER TABLE omega_brains
  DROP COLUMN IF EXISTS hilbert_dimension,
  DROP COLUMN IF EXISTS last_unitarity_check,
  DROP COLUMN IF EXISTS last_norm_value,
  DROP COLUMN IF EXISTS unitarity_corrections_count,
  DROP COLUMN IF EXISTS active_firmware_id,
  DROP COLUMN IF EXISTS firmware_hash;

ALTER TABLE omega_firmware
  DROP COLUMN IF EXISTS hilbert_dimension,
  DROP COLUMN IF EXISTS unitarity_mode,
  DROP COLUMN IF EXISTS status,
  DROP COLUMN IF EXISTS content_hash,
  DROP COLUMN IF EXISTS is_verified,
  DROP COLUMN IF EXISTS signed_by,
  DROP COLUMN IF EXISTS superseded_by;

ALTER TABLE omega_firmware RENAME COLUMN quantum TO physics;

ALTER TABLE omega_helix_rules RENAME COLUMN forbidden_state_real TO phase_vector_real;
ALTER TABLE omega_helix_rules RENAME COLUMN forbidden_state_imaginary TO phase_vector_imaginary;
ALTER TABLE omega_helix_rules DROP COLUMN IF EXISTS forbidden_state_norm;

-- Manual cleanup:
-- rm -rf lambda/shared/services/omega/
-- rm lambda/admin/omega-firmware.ts lambda/admin/omega-quantum.ts
-- rm -rf apps/admin-dashboard/app/(dashboard)/omega/
```

---

## 12. Files Summary

### New Files (9)

| # | File | Purpose |
|---|------|---------|
| 1 | `migrations/V2026_02_07_021__omega_quantum_upgrade.sql` | DB schema: 2 new tables, column renames + additions |
| 2 | `lambda/shared/services/omega/quantum-types.ts` | Types + Zod schemas |
| 3 | `lambda/shared/services/omega/quantum-math.ts` | Pure quantum math functions |
| 4 | `lambda/shared/services/omega/quantum-math.test.ts` | Unit tests |
| 5 | `lambda/shared/services/omega/helix-kernel.service.ts` | Safety filter service |
| 6 | `lambda/shared/services/omega/quantum-brain.service.ts` | Brain management + hot-swap |
| 7 | `lambda/shared/services/omega/schemas/bio-firmware.schema.json` | Firmware validation schema |
| 8 | `lambda/admin/omega-firmware.ts` | Firmware activate/revert/status API |
| 9 | `lambda/admin/omega-quantum.ts` | State-summary/unitarity/helix-test API |

### New UI Files (1)

| # | File | Purpose |
|---|------|---------|
| 10 | `apps/admin-dashboard/app/(dashboard)/omega/firmware/page.tsx` | Firmware management page |

### Modified Files (3)

| File | Change |
|------|--------|
| `lambda/admin/handler.ts` | Route delegation for omega-firmware + omega-quantum |
| `lib/stacks/admin-stack.ts` | 6 API Gateway routes |
| `apps/admin-dashboard/components/layout/sidebar.tsx` | Sidebar entry |

---

## 13. Issues Fixed from Original Prompt

| # | Issue | Fix |
|---|-------|-----|
| 1 | Wrong paths (`packages/core/`, `packages/api/`, `packages/forge/`) | All paths under `packages/infrastructure/lambda/` |
| 2 | NestJS decorators (`@Injectable`, `@Controller`) | Plain TypeScript classes |
| 3 | PrismaService (`this.prisma.*`) | `executeStatement()` from `lambda/shared/db/client` |
| 4 | `omega_unitarity_events` missing `tenant_id` + RLS | Added both |
| 5 | Missing DB columns for hot-swap (`status`, `content_hash`, `is_verified`, etc.) | All added to migration |
| 6 | `projectOutForbidden()` return type mismatch | Correctly destructure `{ safeState, overlap, projected }` |
| 7 | Undefined `innerProductMagnitude()` | Replaced with `complexMag(innerProduct(...))` |
| 8 | Undefined `dampenComponent()` | Replaced with `dampenForbidden()` |
| 9 | `dampenForbidden()` logic error (dampened entire state) | Correctly subtracts scaled projection of forbidden component only |
| 10 | Missing imports (crypto, zod, S3, etc.) | All imports present |
| 11 | Undefined methods (loadFromEFS, etc.) | All methods fully implemented |
| 12 | Wrong property access `quantumParams?.ambition?.entropy_accumulation_rate` | Ambition is separate from quantum params; accessed correctly |
| 13 | Duplicate filter() definitions (Section 4.1 vs 5.5.3) | Single unified filter() in HelixKernelService |
| 14 | HotSwapResult type used before definition | All types defined in quantum-types.ts, imported before use |
| 15 | checkFirmwareSwap() truncated in original | Complete implementation with all 10 steps |
| 16 | Incomplete rollback SQL | Full rollback covering all schema changes |
| 17 | No unit tests | quantum-math.test.ts with comprehensive test suite |
| 18 | FirmwarePanel was just comments | Full working React component |
| 19 | Missing migration sequence number | `V2026_02_07_021` (after `020__axiom_event_history`) |
| 20 | Version mismatch (6.5.0 vs 4.18.0) | Clarified: 6.5.0 is firmware schema version, 4.18.0 is RADIANT platform |
| 21 | No sidebar wiring or handler.ts routing | Explicit instructions for both |
