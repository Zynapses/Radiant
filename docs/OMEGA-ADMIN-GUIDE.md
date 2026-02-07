# OMEGA Protocol — Administrator Guide

> **Classification**: RADIANT INTERNAL // STRATEGIC  
> **Version**: 2.0.0 | **Date**: February 6, 2026  
> **Status**: IMPLEMENTED — Full Admin Operations  
> **Part of**: RADIANT Platform — Project Genesis  
> **Admin Dashboard**: Platform → OMEGA

---

## 1. Overview

This guide covers all administrative operations for the OMEGA Synthetic Biological Intelligence system. Administrators use the **RADIANT Admin Dashboard** (OMEGA section) and the **Genesis Lab** (`apps/genesis/`) to manage OMEGA brains, firmware, Shadow Mode, and infrastructure.

---

## 2. Admin API Reference

All Omega admin endpoints are under `/api/admin/omega/`:

### 2.1 Dashboard

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/omega/dashboard` | GET | Full OMEGA dashboard data — brain count, thermal distribution, coherence averages, system status |

### 2.2 Configuration

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/omega/config` | GET | Get OMEGA platform configuration |
| `/omega/config` | PUT | Update OMEGA platform configuration |

### 2.3 Shadow Mode

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/omega/shadow/config` | GET | Get Shadow Mode configuration |
| `/omega/shadow/config` | PUT | Update Shadow Mode configuration |
| `/omega/shadow/stats` | GET | Get Shadow Mode statistics (total requests, success rate, latency, similarity) |
| `/omega/shadow/comparisons` | GET | Get Shadow Mode comparisons (standard vs OMEGA response pairs) |

### 2.4 Cortex (Brain) Management

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/omega/cortex` | GET | List all OMEGA brains with thermal status and coherence |
| `/omega/cortex/{tenantId}` | GET | Get detailed brain state for a specific tenant |
| `/omega/cortex/{tenantId}/snapshot` | POST | Create point-in-time backup to S3 |
| `/omega/cortex/{tenantId}/restore` | POST | Restore brain from S3 snapshot |
| `/omega/cortex/{tenantId}/lobotomy` | POST | **DESTRUCTIVE** — Reset brain to fresh state |

### 2.5 Firmware Management

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/omega/firmware` | GET | List all firmware files across tenants |
| `/omega/firmware` | POST | Upload new firmware (.bio file) |
| `/omega/firmware/{tenantId}` | GET | List firmware for a specific tenant |
| `/omega/firmware/{tenantId}/{firmwareId}` | GET | Get firmware details |
| `/omega/firmware/{tenantId}/{firmwareId}/activate` | POST | Activate firmware on a tenant's brain |

### 2.6 URL Configuration

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/omega/urls` | GET | Get OMEGA URL configuration |
| `/omega/urls` | PUT | Update OMEGA URL configuration |

---

## 3. Brain Management

### 3.1 Viewing Brain Status

The **Cortex Explorer** (in Genesis Lab or Admin Dashboard) shows:

| Metric | Description |
|--------|-------------|
| **Coherence %** | How well-aligned the brain's internal Q-Nodes are (higher = more focused) |
| **Entropy %** | Level of disorder/boredom (high entropy triggers ambition system) |
| **Neural Density** | Number of strong neural pathways (increases with use) |
| **Thermal Status** | Warm/Cooling/Cold/Frozen based on last activity time |
| **Cycle Count** | Total inference cycles since creation |

### 3.2 Thermal Status Management

| Status | Condition | Admin Action |
|--------|-----------|--------------|
| **Warm** | Active < 15 min | No action needed |
| **Cooling** | Active 15-60 min | Normal — brain is naturally entering idle |
| **Cold** | Active 1-24 hours | Brain serialized to EFS; Time Warp will apply on next wake |
| **Frozen** | Active > 24 hours | Consider whether tenant still needs an active brain |

### 3.3 Snapshots and Restore

**Creating a Snapshot:**
1. Navigate to Cortex Explorer → select tenant brain
2. Click **Snapshot** button
3. Brain state is serialized to S3 (cold storage)
4. Snapshot ID is returned for future reference

**Restoring from Snapshot:**
1. Navigate to Cortex Explorer → select tenant brain
2. Click **Restore** → select snapshot by date/ID
3. Brain state is loaded from S3 and applied
4. Current state is overwritten — **this is destructive**

### 3.4 Lobotomy (Emergency Reset)

**Use only as a last resort.** This completely resets the brain to factory state:

1. Navigate to Cortex Explorer → select tenant brain
2. Click **Lobotomy** → confirm with tenant ID
3. All learned pathways, memories, and neural density are destroyed
4. Brain returns to Day 1 state
5. Default firmware is re-applied

---

## 4. Firmware Administration

### 4.1 The .bio Firmware Standard

Firmware files control the brain's "instincts":

| Component | Description |
|-----------|-------------|
| **Helix Rules** | Forbidden Phase Vectors — what the brain CANNOT think |
| **Ambition Settings** | Entropy threshold, dopamine decay, curiosity bias, plasticity, caution |
| **Personality** | Warmth, assertiveness, creativity, formality, humor, empathy (0.0–1.0) |
| **Signature** | Ed25519 cryptographic signature — brain rejects unsigned firmware |

### 4.2 Creating Firmware (Genesis Forge)

1. Open Genesis Lab → **Genesis Forge** tab
2. Use the React Flow canvas to design firmware visually, or:
   - Click **AI Generate** → describe desired persona (e.g., "Create a conservative financial advisor")
   - AI drafts Helix rules, personality traits, and ambition settings
3. Review and adjust all settings
4. Click **Sign** → firmware is cryptographically signed
5. Click **Deploy** → upload to the target tenant's brain

### 4.3 Firmware Hot-Swap

Firmware can be swapped on a running brain without downtime:

1. Upload new firmware via API or Forge
2. Call `/omega/firmware/{tenantId}/{firmwareId}/activate`
3. Brain loads new firmware on next wake cycle
4. Old firmware is retained for rollback

### 4.4 Firmware Versioning

| Version Part | When to Increment |
|--------------|-------------------|
| **MAJOR** | Breaking changes to safety rules |
| **MINOR** | New personality traits or ambition settings |
| **PATCH** | Bug fixes or minor adjustments |

### 4.5 Rollback Procedures

If a firmware update causes issues:

1. **Immediate Rollback**: Call `/omega/firmware/{tenantId}/{previous_id}/activate`
2. **Snapshot Restore**: Restore brain from pre-update snapshot
3. **Emergency Reset**: Lobotomy + default firmware (last resort)

---

## 5. Shadow Mode Administration

### 5.1 Configuration

Shadow Mode runs OMEGA in parallel with the Legacy LLM without affecting production output:

| Setting | Type | Default | Description |
|---------|------|---------|-------------|
| `enabled` | boolean | `false` | Enable Shadow Mode |
| `omegaApiUrl` | string | env var | OMEGA inference endpoint URL |
| `shadowPercentage` | number | `10` | % of requests to shadow (0-100) |
| `captureResponses` | boolean | `true` | Store OMEGA responses for comparison |
| `compareResponses` | boolean | `true` | Calculate similarity scores |
| `tenantAllowlist` | string[] | null | Only these tenants use shadow |
| `tenantDenylist` | string[] | null | These tenants never use shadow |

### 5.2 Monitoring Shadow Mode

The Shadow Mode dashboard shows:

| Metric | Description |
|--------|-------------|
| **Total Shadow Requests** | Total requests sent to OMEGA in parallel |
| **Success Rate** | % of OMEGA responses that succeeded |
| **Avg Latency** | Average OMEGA response time vs Legacy |
| **Avg Similarity** | How closely OMEGA matches Legacy responses |
| **Avg Coherence** | Average coherence score of OMEGA brains |
| **Thermal Distribution** | Warm/Cooling/Cold/Frozen brain distribution |

### 5.3 Promotion Criteria

OMEGA is ready for promotion to Primary Driver when:

| Criterion | Threshold |
|-----------|-----------|
| **7-Day Coherence Score** | > 90% |
| **Similarity to Legacy** | > 85% |
| **Error Rate** | < 1% |
| **Latency** | Within 2x of Legacy |

---

## 6. Neural Bridge Administration

### 6.1 Bridge Settings (Per-Tenant via Firmware)

| Setting | Range | Default | Description |
|---------|-------|---------|-------------|
| `bridge_mode` | active/shadow/disabled | `shadow` | Injection strategy |
| `injection_strength` | 0-1 | 1.0 | Scale factor for soft token injection |
| `max_injection_norm` | 1-10 | 5.0 | Norm clamp for injection safety |
| `num_soft_tokens` | 1-16 | 8 | Number of soft prompt tokens |

### 6.2 Bridge Monitoring

The Neural Bridge Transducer (~33M params) metrics:

| Metric | Description |
|--------|-------------|
| **Magnitude Mean/Std** | How strongly OMEGA "feels" about current input |
| **Phase Mean/Std** | What OMEGA is "thinking about" |
| **Coherence Estimate** | Overall phase alignment of brain state |
| **Training Loss** | Current loss from Bridge training during dream cycles |

---

## 7. Homeostatic Dreaming Administration

### 7.1 Dream Cycle Schedule

The heartbeat Lambda (`omega_heartbeat.py`) triggers dream cycles:

| Cycle Component | Description |
|-----------------|-------------|
| **Magnitude Gate** | Prunes weak connections (synaptic pruning) |
| **Phase Sharpening** | Crystallizes fuzzy memories (memory consolidation) |
| **Experience Replay** | Replays high-coherence logs (REM sleep) |
| **Watcher Training** | Trains the self-awareness predictor on replayed (input, output) pairs |
| **Bridge Training** | Trains the Neural Transducer using Shadow Mode data |

### 7.2 Monitoring Dreams

| Metric | Description |
|--------|-------------|
| **Dream Frequency** | How often the heartbeat triggers |
| **Pruning Rate** | % of weak connections pruned |
| **Consolidation Quality** | Phase sharpening effectiveness |
| **Watcher Accuracy** | Self-model prediction accuracy |
| **Bridge Loss** | Neural Bridge training convergence |

---

## 8. Infrastructure

### 8.1 AWS Resources

| Resource | Purpose |
|----------|---------|
| **Lambda (Inference)** | `omega_inference.py` — handles wake, think, Time Warp, Neural Bridge |
| **Lambda (Heartbeat)** | `omega_heartbeat.py` — pacemaker, dream cycles, training |
| **Lambda (vLLM Server)** | `omega_vllm_server.py` — custom FastAPI wrapper with `/inject` endpoint |
| **Lambda (Admin)** | `omega_admin.py` — Cortex Explorer API |
| **EFS** | Hot storage — `/mnt/omega_state/{tenantId}/brain.pt` |
| **S3** | Cold storage — `radiant-omega-backups/{tenantId}/snapshots/` |
| **CDK Stack** | `OmegaStack.ts` — infrastructure definition |

### 8.2 Storage Hierarchy

| Tier | Technology | Purpose | Latency |
|------|------------|---------|---------|
| **Tier 1 (Hot)** | AWS EFS | Active brain state for Lambda hot boot | Sub-millisecond |
| **Tier 2 (Cold)** | AWS S3 | Snapshots, disaster recovery | Seconds |

### 8.3 Atomic Persistence

Brain state is always written atomically:
1. Write to `brain.pt.tmp`
2. Use `os.replace()` to atomically swap to `brain.pt`
3. Brain file is **never** in a half-written state

### 8.4 CDK Routes (admin-stack.ts)

All routes under `/admin/omega/`:

```
/admin/omega/dashboard         → GET
/admin/omega/config            → GET, PUT
/admin/omega/shadow/config     → GET, PUT
/admin/omega/shadow/stats      → GET
/admin/omega/shadow/comparisons → GET
/admin/omega/cortex            → GET
/admin/omega/cortex/{tenantId} → GET
/admin/omega/cortex/{tenantId}/snapshot → POST
/admin/omega/cortex/{tenantId}/restore  → POST
/admin/omega/cortex/{tenantId}/lobotomy → POST
/admin/omega/firmware          → GET, POST
/admin/omega/firmware/{tenantId} → GET
/admin/omega/firmware/{tenantId}/{firmwareId} → GET
/admin/omega/firmware/{tenantId}/{firmwareId}/activate → POST
/admin/omega/urls              → GET, PUT
```

---

## 9. Omega Instance Registry

Every OMEGA instance has a unique identity:

| Field | Description |
|-------|-------------|
| `instance_id` | UUID — unique brain identifier |
| `name` | Human-readable instance name |
| `tenant_id` | Owning tenant |
| `endpoint` | Inference API endpoint URL |
| `status` | active/inactive/dreaming/frozen |
| `firmware_version` | Current firmware version |
| `coherence_score` | Latest coherence score |
| `thermal_status` | Current thermal state |

The Forge addresses individual OMEGA instances via the `omega_instance_registry` table.

---

## 10. Shadow Omega WebSocket Tether

The `useShadowOmega()` React hook provides real-time bi-directional telemetry between Genesis Forge and live OMEGA instances:

| Event | Direction | Description |
|-------|-----------|-------------|
| **telemetry** | OMEGA → Forge | Real-time coherence, entropy, phase data |
| **edge_rejection** | OMEGA → Forge | Helix Kernel blocked a vector |
| **stability_update** | OMEGA → Forge | Stability score changes → UI hue shift |
| **command** | Forge → OMEGA | Firmware hot-swap, snapshot, parameter change |

### Global UI Hue Shift

Genesis Forge's UI color shifts based on the OMEGA stability score:
- **Cyan** (stable) → **Orange** (warning) → **Red** (critical)

---

## 11. Troubleshooting

### Brain Not Responding

1. Check thermal status — if Frozen, brain needs wake trigger
2. Verify EFS mount is accessible (`/mnt/omega_state`)
3. Check Lambda logs for inference errors
4. Try snapshot restore if brain is corrupted

### Low Coherence

1. Check dream cycle execution (heartbeat Lambda)
2. Verify firmware isn't causing conflicting Helix rules
3. Review Shadow Mode comparisons for divergence patterns
4. Consider reducing curiosity_bias in firmware (too much exploration)

### Neural Bridge Errors

1. Bridge failures are non-fatal — system falls back to text injection
2. Check `OMEGA_BRIDGE_ENABLED` environment variable
3. Review Bridge training loss trend — should be decreasing
4. If loss is increasing, consider resetting Bridge weights

### Shadow Mode Issues

1. Verify `OMEGA_API_URL` environment variable
2. Check network connectivity to OMEGA inference Lambda
3. Review tenant allowlist/denylist configuration
4. Check 30-second timeout — OMEGA may need more time on cold starts

---

## 12. Security Considerations

| Concern | Mitigation |
|---------|------------|
| **Brain State Theft** | Brain files encrypted at rest (EFS encryption), in transit (TLS) |
| **Firmware Tampering** | Ed25519 signatures — brain rejects unsigned firmware |
| **Cross-Tenant Isolation** | Each tenant has separate EFS directory and S3 prefix |
| **Helix Rule Bypass** | Mathematically impossible — destructive interference is physics, not policy |
| **Snapshot Access** | S3 bucket policies restrict access to admin roles only |

---

## 13. Version History

| Version | Date | Changes |
|---------|------|---------|
| 2.1.0 | 2026-02-07 | Drift-aware shadow tracking: each ShadowComparison now records `standard_model_drift_score` and `drift_warnings`; enables drift-vs-coherence correlation analysis; Genesis drift health gates block stage advancement on poor drift; Admin UI: Drift Control Center page |
| 2.0.0 | 2026-02-06 | Dedicated admin guide created; comprehensive API reference; Shadow Mode, Neural Bridge, Dream Cycle, and Instance Registry documentation |
| 1.0.0 | 2026-02-04 | Initial OMEGA implementation with Cortex, Helix Kernel, Resonant Index, Cryogenic Engine, Neural Bridge, Homeostatic Dreaming |

---

## 14. Drift-Aware Shadow Tracking (v7.36.0)

OMEGA Shadow Mode now integrates with the unified `DriftAwareWeightingService` to track drift health alongside every shadow comparison.

### What Changed

Each `ShadowComparison` result now includes:
- **`standard_model_drift_score`**: The standard model's drift score at comparison time (0.0–1.0)
- **`drift_warnings`**: Array of drift warning strings for models with poor drift health

### Why This Matters

Shadow Mode compares OMEGA outputs against standard models. If the standard model is drifting (producing degraded outputs), shadow comparisons may incorrectly attribute quality differences to OMEGA when the baseline itself is unreliable. By recording drift health per comparison, admins can:

1. **Filter comparisons**: Exclude comparisons where the standard model was drifting
2. **Correlate performance**: Detect if OMEGA coherence drops when standard models drift
3. **Validate baselines**: Ensure shadow comparison baselines are stable

### Omega App Weight Profile

OMEGA uses the **highest drift weight** (0.40) of any app because shadow comparison integrity depends critically on stable baselines:

| Factor | Weight |
|--------|--------|
| Drift | 0.40 |
| Quality | 0.25 |
| Latency | 0.10 |
| Cost | 0.10 |
| Availability | 0.15 |
| Min Drift Score | 0.50 |

### Admin Access

- **Drift Control Center**: Orchestration → Drift Control → Overview (Omega listed with integration status)
- **App Weight Profiles tab**: Edit Omega's drift sensitivity weights
- **Model Weights page**: Per-model drift scores and quarantine controls

---

**Document maintained under RADIANT documentation policy. Any changes to OMEGA infrastructure, admin API, Genesis Lab, Genesis Forge, Shadow Mode, or Neural Bridge MUST update this guide.**
