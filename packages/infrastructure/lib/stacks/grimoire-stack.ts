RADIANT PROMPT-39: Administrator Guide Update v5.0.2System Evolution Documentation Update
Windsurf / Claude Opus 4.5 Production Prompt📋 Document Validation StatusCriterionGradeNotesCompletenessADocuments both Grimoire and Economic GovernorAccuracyASQL, API endpoints, and configs match PROMPT-38.2ClarityAIDE metaphors extended for new featuresAlignmentAFollows PROMPT-37.1 documentation patternsCross-AI ValidationValidatorGradeDateStatusClaude Opus 4.5A2026-01-08✅ PASSEDGemini 2.0A2026-01-08✅ PASSEDFinal VerdictAGO FOR LAUNCH🟢 Production Ready⚠️ CRITICAL: DOCUMENT UPDATE DIRECTIVEYOU ARE UPDATING AN EXISTING DOCUMENT, NOT CREATING A NEW ONEThis prompt specifies exact changes to make to the Administrator Guide (v4.20.3). Open the source document, apply these modifications in order, and save as v5.0.2.Source Document
File: docs/admin/RADIANT_ARTIFACT_ENGINE_ADMIN_GUIDE_v4.20.3.mdOutput Document
File: docs/admin/RADIANT_ARTIFACT_ENGINE_ADMIN_GUIDE_v5.0.2.md
PDF: RADIANTARTIFACTENGINEADMINGUIDEv5.0.2.pdfDocument Metadata
Document ID: RADIANT-PROMPT-39
Prompt Version: 39.0
Target Doc Version: 5.0.2
Date: January 8, 2026
Operation: UPDATE (not replace)
Source: RADIANT_ARTIFACT_ENGINE_ADMIN_GUIDE_v4.20.3.md
Dependencies: PROMPT-38.2 (v5.0.2 Implementation)
Status: 🟢 GO FOR LAUNCH
Prompt LineagePromptVersionPurposeStatusPROMPT-37.1v4.20.3Admin Guide (Mission Control)✅ CompletePROMPT-38.2v5.0.2System Evolution Implementation✅ CompletePROMPT-39v5.0.2Admin Guide Update (This Document)🟢 GO FOR LAUNCHPROMPT-40v5.1.0Strategic Evolution (Council, Sentinels)📋 PlannedImplementation Rules
FIND/REPLACE - Use exact text matching for updates
ADD SECTIONS - Insert new sections at specified locations
PRESERVE STRUCTURE - Maintain existing formatting and numbering
UPDATE CROSS-REFERENCES - Ensure all section links are correct
UPDATE TOC - Synchronize Table of Contents with new sections
UPDATE INSTRUCTIONSStep 1: Update Document HeaderFIND:
Version 4.20.3 | January 2026REPLACE WITH:
Version 5.0.2 | January 2026Step 2: Update Table of ContentsFIND:
16. Domain Risk Policies (NEW)REPLACE WITH:
16. Domain Risk Policies
17. The Grimoire - Procedural Memory (NEW in v5.0)
18. The Economic Governor - Cost Optimization (NEW in v5.0)
19. Self-Optimizing System Architecture (NEW in v5.0)Step 3: Update Section 1.2 - Extend "IDE for Business Logic" NarrativeFIND in Section 1.2 (after the IDE concept table):
**Key Benefits:**INSERT BEFORE:
markdown### v5.0.2 Evolution: From "Debugger" to "Self-Improving IDE"

Version 5.0.2 extends the IDE metaphor with two powerful new capabilities:

| IDE Concept | v4.20 Feature | v5.0 Evolution | Business Value |
|-------------|---------------|----------------|----------------|
| **Breakpoint** | HITL Decision Point | *(unchanged)* | AI pauses at high-stakes moments |
| **Code Snippets** | Pattern Library | **The Grimoire** | AI learns and reuses successful patterns |
| **Build Optimization** | Manual model selection | **Economic Governor** | Automatic cost-performance optimization |
| **IntelliSense** | Static suggestions | **Contextual Wisdom** | Dynamic, context-aware recommendations |

**The Self-Optimizing Shift:**

| v4.20.3 Behavior | v5.0.2 Evolution |
|------------------|------------------|
| Stateless execution | **Stateful memory** via The Grimoire |
| Fixed model routing | **Dynamic routing** via Economic Governor |
| Manual optimization | **Automatic cost arbitrage** |
| Learn nothing from success | **Extract and store heuristics** |
| Same mistakes repeated | **Institutional wisdom accumulates** |Step 4: Update Administrator Responsibilities (Section 1.3)FIND in Administrator Responsibilities:
- What happens when humans don't respond → Escalation & Auto-Actions (NEW)ADD AFTER:
markdown- What the system remembers → Grimoire Heuristics Management (NEW in v5.0)
- How models are selected for cost → Governor Mode Configuration (NEW in v5.0)
- When to prune institutional memory → Heuristic Lifecycle Policies (NEW in v5.0)Step 5: Update Processing Pipeline (Section 2.1)FIND the Processing Pipeline table and ADD these rows after "HITL Checkpoint":markdown| 4.7 | Grimoire Consult | Heuristic similarity threshold | ~50-200ms (NEW) |
| 4.8 | Governor Routing | Complexity score → Model selection | ~100ms (NEW) |
| 6 | Librarian Review | Auto-extract lessons on success | Background (NEW) |Step 6: Add Grimoire Warning Box (Section 2)INSERT after Section 2.3 "S3 Bronze Layer":markdown### 2.4 The Grimoire Database (Critical Infrastructure) (NEW in v5.0)

> ⚠️ **CRITICAL WARNING: Vector Index Health**
>
> **Symptom**: `consult_grimoire` returns empty results even when heuristics exist.
> **Cause**: The IVFFlat index requires periodic rebuilding as data grows.
> **Verification**:
> ```sql
> -- Check index health
> SELECT indexrelname, idx_scan, idx_tup_read, idx_tup_fetch 
> FROM pg_stat_user_indexes 
> WHERE indexrelname = 'idx_heuristics_embedding';
> 
> -- If idx_scan is high but idx_tup_fetch is low, rebuild:
> REINDEX INDEX CONCURRENTLY idx_heuristics_embedding;
> ```
>
> **Recommended**: Schedule weekly `REINDEX` during maintenance windows.

**Grimoire Storage Architecture:**

| Component | Purpose | Location |
|-----------|---------|----------|
| **knowledge_heuristics** | Primary storage | PostgreSQL + pgvector |
| **context_embedding** | Semantic search | vector(1536) column |
| **Cato Validation** | Security gate | HTTP bridge to Cato service |

**Data Flow:**Successful Execution → Librarian Review → Cato Validation → Embedding Generation → PostgreSQL Storage
↓ (if blocked)
Audit Log + Discard
Step 7: Add Economic Governor Warning Box (Section 2)INSERT after Section 2.4 "The Grimoire Database":markdown### 2.5 Economic Governor (Cost Optimization) (NEW in v5.0)

> ⚠️ **CRITICAL WARNING: Governor Bypass Conditions**
>
> **Symptom**: Expensive models used despite `cost_saver` mode enabled.
> **Causes**:
> 1. Task complexity score ≥ 9 (legitimately complex)
> 2. Governor mode set to `off` or `performance`
> 3. LiteLLM System 0 classifier unavailable (defaults to original model)
>
> **Verification**:
> ```bash
> # Check Governor decisions in logs
> aws logs filter-log-events \
>   --log-group-name /aws/lambda/radiant-swarm \
>   --filter-pattern "Governor Complexity" \
>   --start-time $(date -d '1 hour ago' +%s000)
> ```
>
> **Cost Monitoring**: Track `governor.downgrade.count` and `governor.savings.estimated` metrics.

**Governor Modes:**

| Mode | Behavior | Use Case |
|------|----------|----------|
| **performance** | Always use requested model | Critical production, demos |
| **balanced** | Downgrade if complexity ≤ 4 | Default - good balance |
| **cost_saver** | Downgrade if complexity ≤ 7 | Development, testing, bulk ops |
| **off** | Governor disabled entirely | Debugging, benchmarking |

**System 0 Classifier:**

The Governor uses `gpt-4o-mini` as a "System 0" classifier to score task complexity before routing. This adds ~100ms latency but can save 60-80% on simple tasks.Task Prompt → System 0 (gpt-4o-mini) → Complexity Score (1-10)
│
┌───────────────────────────────┼───────────────────────────────┐
│                               │                               │
Score ≤ 4                      5 ≤ Score ≤ 8                   Score ≥ 9
│                               │                               │
▼                               ▼                               ▼
gpt-4o-mini                    Original Model                      gpt-4o
(cheap)                       (as requested)                    (premium)
Step 8: Add Core Concepts - Grimoire Terms (Section 3)INSERT after "Swarm Concepts" section:markdown### 3.X The Grimoire Concepts (NEW in v5.0)

| Term | Definition | Example |
|------|------------|---------|
| **Heuristic** | Reusable lesson extracted from successful execution | "When querying sales data, always join with regions table" |
| **Confidence Score** | How reinforced a heuristic is (0.0-1.0) | 0.9 = highly validated |
| **Context Embedding** | Vector representation for semantic search | 1536-dimension float array |
| **Similarity Threshold** | Max cosine distance for relevance | 0.25 (lower = more similar) |
| **Librarian** | Background task that extracts heuristics | Runs after successful execution |
| **Institutional Wisdom** | Accumulated heuristics per tenant/domain | Injected into system prompts |

**Heuristic Lifecycle:**┌─────────────────────────────────────────────────────────────────────────────┐
│                        HEURISTIC LIFECYCLE                                   │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│   ┌──────────┐     ┌──────────┐     ┌──────────┐     ┌──────────────────┐  │
│   │ EXTRACT  │────▶│ VALIDATE │────▶│  STORE   │────▶│ REINFORCE/DECAY  │  │
│   │          │     │  (Cato)  │     │          │     │                  │  │
│   └──────────┘     └────┬─────┘     └──────────┘     └────────┬─────────┘  │
│        │                │                                      │            │
│        │           Block if                              Used again?        │
│        │           HIGH risk                                   │            │
│        │                │                          ┌───────────┴──────┐    │
│        │                ▼                          │                  │    │
│        │           DISCARD                    confidence++      confidence-- │
│        │                                     (max 1.0)        (if unused)    │
│        │                                          │                  │      │
│        │                                          │                  ▼      │
│        │                                          │           EXPIRE/DELETE │
│        │                                          │           (90 days or   │
│        └──────────────────────────────────────────┴───────── conf < 0.3)   │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
Step 9: Add Core Concepts - Governor Terms (Section 3)INSERT after "Grimoire Concepts" section:markdown### 3.X Economic Governor Concepts (NEW in v5.0)

| Term | Definition | Example |
|------|------------|---------|
| **System 0** | Cheap classifier model for complexity scoring | gpt-4o-mini |
| **Complexity Score** | 1-10 rating of task difficulty | 3 = simple summary, 9 = code generation |
| **Model Downgrade** | Routing to cheaper model | gpt-4o → gpt-4o-mini |
| **Model Upgrade** | Routing to premium model | gpt-4o-mini → gpt-4o |
| **Cost Arbitrage** | Automatic cost optimization | Use cheapest viable model |
| **Governor Mode** | Per-domain configuration | performance, balanced, cost_saver, off |

**Complexity Scale:**

| Score | Task Type | Typical Model |
|-------|-----------|---------------|
| 1-3 | Formatting, summarization, basic Q&A | gpt-4o-mini |
| 4-6 | Analysis, comparison, multi-step reasoning | Original model |
| 7-8 | Complex analysis, creative writing, planning | Original model |
| 9-10 | Advanced reasoning, code generation, synthesis | gpt-4o |Step 10: Update Tenant Configuration (Section 11)ADD to tenant config reference:markdown### 11.X Grimoire Tenant Configuration (NEW in v5.0)
```typescriptinterface TenantGrimoireConfig {
// Enable/disable the Grimoire for this tenant
enabled: boolean;// Per-domain heuristic limits
maxHeuristicsPerDomain: number;  // Default: 1000// Similarity threshold for retrieval (lower = stricter matching)
similarityThreshold: number;  // Default: 0.25// Heuristic expiration in days
heuristicTTLDays: number;  // Default: 90// Minimum confidence to retain
minConfidenceRetention: number;  // Default: 0.3// Domains where Grimoire is active
enabledDomains: ('medical' | 'financial' | 'legal' | 'general')[];
}

### 11.Y Governor Tenant Configuration (NEW in v5.0)
```typescriptinterface TenantGovernorConfig {
// Global enable/disable
enabled: boolean;// Per-domain mode overrides
domainModes: {
[domain: string]: 'performance' | 'balanced' | 'cost_saver' | 'off';
};// Complexity thresholds (override defaults)
thresholds?: {
cheapModelMax: number;    // Default: 4 (balanced), 7 (cost_saver)
premiumModelMin: number;  // Default: 9
};// Model preferences
cheapModel: string;    // Default: 'gpt-4o-mini'
premiumModel: string;  // Default: 'gpt-4o'// Cost tracking
trackSavings: boolean;  // Enable savings estimation
}
Step 11: Update Metrics & Monitoring (Section 10)ADD Grimoire and Governor metrics:markdown### 10.X Grimoire Metrics (NEW in v5.0)

| Metric | Description | Alert Threshold |
|--------|-------------|-----------------|
| `grimoire.heuristics.total` | Total heuristics stored | > 10000 per tenant |
| `grimoire.heuristics.retrieved` | Heuristics returned per query | Track average |
| `grimoire.heuristics.blocked` | Cato-blocked retrievals | > 10/hour |
| `grimoire.librarian.extractions` | New heuristics per hour | Track trend |
| `grimoire.librarian.blocked` | Cato-blocked writes | > 5% of attempts |
| `grimoire.embedding.latency_ms` | Embedding generation time | > 500ms |
| `grimoire.query.latency_ms` | Vector search time | > 200ms |

### 10.Y Governor Metrics (NEW in v5.0)

| Metric | Description | Alert Threshold |
|--------|-------------|-----------------|
| `governor.decisions.total` | Total routing decisions | Track volume |
| `governor.downgrade.count` | Cheap model selections | Track percentage |
| `governor.upgrade.count` | Premium model selections | > 20% |
| `governor.bypass.count` | Skipped (off/performance mode) | Track |
| `governor.classifier.latency_ms` | System 0 scoring time | > 200ms |
| `governor.classifier.failures` | Scoring failures (default 5) | > 1% |
| `governor.savings.estimated_usd` | Estimated cost savings | Track daily |

**Governor Savings Dashboard:**┌─────────────────────────────────────────────────────────────────────────────┐
│                     GOVERNOR COST OPTIMIZATION                               │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  Today's Routing Decisions         │  Estimated Savings                      │
│  ┌──────────────────────────────┐  │  ┌──────────────────────────────┐      │
│  │ Downgrades: 1,247 (62%)     │  │  │ Today:    $142.50            │      │
│  │ Original:     589 (29%)     │  │  │ This Week: $847.20           │      │
│  │ Upgrades:     164 (8%)      │  │  │ This Month: $3,412.00        │      │
│  └──────────────────────────────┘  │  └──────────────────────────────┘      │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
Step 12: Update Troubleshooting Guide (Section 12)ADD these troubleshooting scenarios:markdown### 12.X Grimoire Troubleshooting (NEW in v5.0)

#### 12.X.1 Heuristics Not Being Retrieved

**Symptoms:** `consult_grimoire` returns empty despite stored heuristics.

**Diagnostic Steps:**

1. **Check heuristics exist:**
```sqlSET app.tenant_id = 'your-tenant-uuid';
SELECT COUNT(*) FROM knowledge_heuristics WHERE domain = 'your-domain';

2. **Check similarity threshold:**
```sql-- Test vector distance manually
SELECT heuristic_text, (context_embedding <=> your_embedding) as distance
FROM knowledge_heuristics
WHERE domain = 'your-domain'
ORDER BY distance ASC
LIMIT 5;
-- If all distances > 0.25, no matches returned

3. **Check expiration:**
```sqlSELECT * FROM knowledge_heuristics
WHERE domain = 'your-domain' AND expires_at < NOW();
-- If results, heuristics have expired

4. **Check Cato blocking:**
```bashgrep "Grimoire: Blocked unsafe heuristic" /var/log/flyte/*.log

#### 12.X.2 Librarian Not Extracting Heuristics

**Symptoms:** Successful executions not generating new heuristics.

**Diagnostic Steps:**

1. **Check extraction logs:**
```bashgrep "Librarian:" /var/log/flyte/*.log | tail -20

2. **Common reasons for NO_INSIGHT:**
   - Response too short (< 500 chars)
   - Response too domain-specific (not generalizable)
   - Similar heuristic already exists (deduplication)

3. **Check Cato write blocks:**
```sqlSELECT * FROM audit_logs
WHERE action = 'BLOCKED' AND resource_type = 'heuristic'
ORDER BY created_at DESC LIMIT 10;

#### 12.X.3 Governor Not Optimizing (Always Using Original Model)

**Symptoms:** Cost savings lower than expected, no downgrades.

**Diagnostic Steps:**

1. **Check Governor mode:**
```sqlSET app.tenant_id = 'your-tenant-uuid';
SELECT domain, governor_mode FROM decision_domain_config;
-- If 'off' or 'performance', Governor is bypassed

2. **Check complexity scores:**
```bashgrep "Governor Complexity" /var/log/lambda/*.log | tail -20
Look for scores consistently > 4 (balanced) or > 7 (cost_saver)

3. **Check System 0 classifier health:**
```bashgrep "Governor scoring failed" /var/log/lambda/*.log
If frequent, classifier is timing out

4. **Verify LiteLLM proxy connectivity:**
```bashcurl -X POST $LITELLM_PROXY_URL/chat/completions 
-H "Authorization: Bearer $LITELLM_API_KEY" 
-H "Content-Type: application/json" 
-d '{"model":"gpt-4o-mini","messages":[{"role":"user","content":"test"}]}'

#### 12.X.4 Vector Index Performance Degradation

**Symptoms:** Grimoire queries slow (>500ms), high CPU on database.

**Fix:**
```sql-- Rebuild vector index (non-blocking)
REINDEX INDEX CONCURRENTLY idx_heuristics_embedding;-- Check index size
SELECT pg_size_pretty(pg_relation_size('idx_heuristics_embedding'));-- If > 1GB, consider increasing IVFFlat lists parameter
DROP INDEX idx_heuristics_embedding;
CREATE INDEX idx_heuristics_embedding ON knowledge_heuristics
USING ivfflat (context_embedding vector_cosine_ops) WITH (lists = 200);
Step 13: Update API Reference (Section 13)ADD Grimoire and Governor endpoints:markdown### 13.X Grimoire API Endpoints (NEW in v5.0)

| Endpoint | Method | Description | Auth |
|----------|--------|-------------|------|
| `/api/grimoire/heuristics` | GET | List tenant heuristics | JWT + Tenant |
| `/api/grimoire/heuristics/:id` | GET | Get single heuristic | JWT + Tenant |
| `/api/grimoire/heuristics/:id` | DELETE | Delete heuristic | JWT + Admin |
| `/api/grimoire/stats` | GET | Grimoire statistics | JWT + Tenant |
| `/api/grimoire/search` | POST | Semantic search heuristics | JWT + Tenant |

**Request/Response Examples:**
```typescript// GET /api/grimoire/stats
{
"tenantId": "uuid",
"totalHeuristics": 342,
"byDomain": {
"general": 156,
"medical": 89,
"financial": 67,
"legal": 30
},
"avgConfidence": 0.72,
"expiringSoon": 12  // Expiring in < 7 days
}// POST /api/grimoire/search
// Request:
{
"query": "How to handle sales data queries",
"domain": "general",
"limit": 5
}
// Response:
{
"results": [
{
"id": "uuid",
"heuristicText": "When querying sales, always join regions",
"distance": 0.18,
"confidence": 0.85
}
]
}

### 13.Y Governor API Endpoints (NEW in v5.0)

| Endpoint | Method | Description | Auth |
|----------|--------|-------------|------|
| `/api/mission-control/governor` | GET | Get Governor config | JWT + Tenant |
| `/api/mission-control/governor` | PUT | Update Governor mode | JWT + Admin |
| `/api/mission-control/governor/stats` | GET | Governor statistics | JWT + Tenant |

**Request/Response Examples:**
```typescript// GET /api/mission-control/governor
{
"tenantId": "uuid",
"domains": [
{ "domain": "general", "mode": "balanced", "updatedAt": "2026-01-08T..." },
{ "domain": "medical", "mode": "performance", "updatedAt": "2026-01-08T..." }
]
}// PUT /api/mission-control/governor
// Request:
{
"domain": "general",
"mode": "cost_saver"
}
// Response:
{
"success": true,
"domain": "general",
"mode": "cost_saver"
}// GET /api/mission-control/governor/stats
{
"period": "24h",
"totalDecisions": 2000,
"downgrades": 1247,
"originals": 589,
"upgrades": 164,
"estimatedSavingsUSD": 142.50,
"avgComplexityScore": 4.2
}
Step 14: ADD NEW Section 17 - The GrimoireINSERT after Section 16 "Domain Risk Policies":markdown## 17. The Grimoire - Procedural Memory (NEW in v5.0)

### 17.1 Overview

The Grimoire is RADIANT's institutional memory system. It automatically extracts, stores, and retrieves lessons learned from successful AI executions, allowing the system to improve over time.

**IDE Equivalent:** Code Snippets Library + IntelliSense

### 17.2 How It Works┌─────────────────────────────────────────────────────────────────────────────┐
│                         THE GRIMOIRE ARCHITECTURE                            │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌───────────────────┐                        ┌───────────────────┐         │
│  │   CONSULT         │                        │   LIBRARIAN       │         │
│  │   (Before Exec)   │                        │   (After Exec)    │         │
│  └─────────┬─────────┘                        └─────────┬─────────┘         │
│            │                                            │                    │
│            ▼                                            ▼                    │
│  ┌───────────────────┐                        ┌───────────────────┐         │
│  │  Generate Prompt  │                        │  Extract Heuristic│         │
│  │    Embedding      │                        │   via LLM         │         │
│  └─────────┬─────────┘                        └─────────┬─────────┘         │
│            │                                            │                    │
│            ▼                                            ▼                    │
│  ┌───────────────────┐                        ┌───────────────────┐         │
│  │  Vector Search    │                        │  Cato Validation  │         │
│  │  (pgvector)       │                        │  (Fail-Closed)    │         │
│  └─────────┬─────────┘                        └─────────┬─────────┘         │
│            │                                            │                    │
│            ▼                                            │                    │
│  ┌───────────────────┐                                  │                    │
│  │  Cato Validation  │                                  │                    │
│  │  (Fail-Open)      │                                  │                    │
│  └─────────┬─────────┘                                  │                    │
│            │                                            │                    │
│            ▼                                            ▼                    │
│  ┌───────────────────────────────────────────────────────────────────┐     │
│  │                                                                     │     │
│  │                     knowledge_heuristics                           │     │
│  │                     (PostgreSQL + pgvector)                        │     │
│  │                                                                     │     │
│  └───────────────────────────────────────────────────────────────────┘     │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘

### 17.3 Security Model

| Operation | Cato Policy | Failure Mode |
|-----------|-------------|--------------|
| **Read** (consult_grimoire) | Validate before return | **Fail-Open** (return anyway) |
| **Write** (librarian_review) | Validate before insert | **Fail-Closed** (discard) |

This asymmetric policy ensures:
- Reads don't break if Cato is unavailable
- Writes never poison the knowledge base

### 17.4 Admin Dashboard

The Grimoire section of the Admin Dashboard shows:

| Panel | Description |
|-------|-------------|
| **Heuristic Browser** | Search and view all stored heuristics |
| **Domain Distribution** | Pie chart of heuristics by domain |
| **Confidence Histogram** | Distribution of confidence scores |
| **Recent Extractions** | Latest heuristics from Librarian |
| **Blocked Writes** | Cato-rejected heuristic attempts |
| **Expiration Timeline** | Upcoming heuristic expirations |

### 17.5 Maintenance

**Daily Cleanup (Automatic):**
- Runs at 3 AM UTC via EventBridge
- Removes heuristics where `expires_at < NOW()`
- Removes low-confidence heuristics (< 0.3) older than 30 days

**Manual Pruning:**
```sql-- Remove all heuristics for a domain
SET app.tenant_id = 'your-uuid';
DELETE FROM knowledge_heuristics WHERE domain = 'old-domain';-- Reset confidence scores
UPDATE knowledge_heuristics
SET confidence_score = 0.5
WHERE domain = 'your-domain';
Step 15: ADD NEW Section 18 - The Economic GovernorINSERT after Section 17 "The Grimoire":markdown## 18. The Economic Governor - Cost Optimization (NEW in v5.0)

### 18.1 Overview

The Economic Governor automatically routes AI tasks to the most cost-effective model that can handle them. It uses a "System 0" cheap classifier to score task complexity before selecting the model.

**IDE Equivalent:** Build Optimization / Incremental Compilation

### 18.2 How It Works┌─────────────────────────────────────────────────────────────────────────────┐
│                      ECONOMIC GOVERNOR FLOW                                  │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│   ┌─────────────┐                                                           │
│   │   Request   │                                                           │
│   │  (Task +    │                                                           │
│   │   Model)    │                                                           │
│   └──────┬──────┘                                                           │
│          │                                                                   │
│          ▼                                                                   │
│   ┌─────────────┐                                                           │
│   │  Governor   │──── Mode = 'off' or 'performance'? ────▶ Use Original    │
│   │   Check     │                                                           │
│   └──────┬──────┘                                                           │
│          │ Mode = 'balanced' or 'cost_saver'                                │
│          ▼                                                                   │
│   ┌─────────────┐                                                           │
│   │  System 0   │                                                           │
│   │ Classifier  │──── Prompt → gpt-4o-mini → Score (1-10)                  │
│   └──────┬──────┘                                                           │
│          │                                                                   │
│          ▼                                                                   │
│   ┌─────────────────────────────────────────────────────────────┐           │
│   │                     ROUTING DECISION                         │           │
│   │                                                               │           │
│   │   Score ≤ 4 (balanced)     Use gpt-4o-mini (cheap)          │           │
│   │   Score ≤ 7 (cost_saver)   Use gpt-4o-mini (cheap)          │           │
│   │   5 ≤ Score ≤ 8            Use Original Model                │           │
│   │   Score ≥ 9                Use gpt-4o (premium)              │           │
│   │                                                               │           │
│   └─────────────────────────────────────────────────────────────┘           │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘

### 18.3 Mode Configuration

| Mode | Cheap Threshold | Use Case | Est. Savings |
|------|-----------------|----------|--------------|
| **off** | N/A | Disabled | 0% |
| **performance** | N/A | Critical paths, demos | 0% |
| **balanced** | Score ≤ 4 | Default production | 30-50% |
| **cost_saver** | Score ≤ 7 | Dev, testing, bulk | 60-80% |

### 18.4 Admin Configuration

**Via API:**
```bashcurl -X PUT https://api.radiant.example.com/api/mission-control/governor 
-H "Authorization: Bearer $TOKEN" 
-H "Content-Type: application/json" 
-d '{"domain": "general", "mode": "cost_saver"}'

**Via Admin Dashboard:**
1. Navigate to **Mission Control** → **Governor**
2. Select domain from dropdown
3. Choose mode from radio buttons
4. Click **Save**

### 18.5 Cost Tracking

The Governor tracks estimated savings:

| Metric | Calculation |
|--------|-------------|
| **Downgrade Savings** | (original_cost - cheap_cost) × downgrade_count |
| **Upgrade Cost** | (premium_cost - original_cost) × upgrade_count |
| **Net Savings** | downgrade_savings - upgrade_cost |

**Example (Daily):**
- 1,000 requests at $0.01/each (gpt-4o)
- Governor downgrades 600 to gpt-4o-mini ($0.001/each)
- Original cost: $10.00
- Actual cost: $4.60
- **Savings: $5.40 (54%)**Step 16: ADD NEW Section 19 - Self-Optimizing ArchitectureINSERT after Section 18 "The Economic Governor":markdown## 19. Self-Optimizing System Architecture (NEW in v5.0)

### 19.1 Overview

Version 5.0 transforms RADIANT from a stateless request-response system into a self-optimizing platform that learns from every execution.

### 19.2 The Learning Loop┌─────────────────────────────────────────────────────────────────────────────┐
│                     RADIANT v5.0 LEARNING LOOP                               │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│                        ┌───────────────────┐                                │
│                        │    User Request   │                                │
│                        └─────────┬─────────┘                                │
│                                  │                                           │
│                                  ▼                                           │
│   ┌───────────────────────────────────────────────────────────┐             │
│   │                    OPTIMIZATION LAYER                      │             │
│   │  ┌─────────────────┐      ┌─────────────────┐            │             │
│   │  │   Economic      │      │   The Grimoire  │            │             │
│   │  │   Governor      │      │   (Consult)     │            │             │
│   │  │   (Route)       │      │                 │            │             │
│   │  └────────┬────────┘      └────────┬────────┘            │             │
│   │           │                        │                      │             │
│   │           └────────────┬───────────┘                      │             │
│   └────────────────────────┼──────────────────────────────────┘             │
│                            │                                                 │
│                            ▼                                                 │
│   ┌───────────────────────────────────────────────────────────┐             │
│   │                    EXECUTION LAYER                         │             │
│   │  ┌─────────────────┐      ┌─────────────────┐            │             │
│   │  │   Swarm         │      │   HITL          │            │             │
│   │  │   Execution     │─────▶│   (if needed)   │            │             │
│   │  └─────────────────┘      └─────────────────┘            │             │
│   └────────────────────────────┼──────────────────────────────┘             │
│                                │                                             │
│                                ▼                                             │
│   ┌───────────────────────────────────────────────────────────┐             │
│   │                    LEARNING LAYER                          │             │
│   │  ┌─────────────────┐      ┌─────────────────┐            │             │
│   │  │   Librarian     │      │   Audit &       │            │             │
│   │  │   (Extract)     │─────▶│   Metrics       │            │             │
│   │  └─────────────────┘      └─────────────────┘            │             │
│   └───────────────────────────────────────────────────────────┘             │
│                                │                                             │
│                                │                                             │
│                                ▼                                             │
│                        ┌───────────────────┐                                │
│                        │    Response       │                                │
│                        └───────────────────┘                                │
│                                                                              │
│   ◀─────────────────────── FEEDBACK LOOP ───────────────────────────────▶  │
│   │                                                                       │  │
│   │   Success → Extract Heuristic → Reinforce Confidence                 │  │
│   │   Failure → No Heuristic → Decay Related Heuristics                  │  │
│   │                                                                       │  │
└───┴───────────────────────────────────────────────────────────────────────┴──┘

### 19.3 Version Comparison

| Capability | v4.20.3 | v5.0.2 |
|------------|---------|--------|
| **Memory** | Stateless | Persistent (Grimoire) |
| **Model Selection** | Manual/Fixed | Automatic (Governor) |
| **Learning** | None | Continuous (Librarian) |
| **Cost Optimization** | Manual tier selection | Automatic per-request |
| **Knowledge Sharing** | Per-session only | Cross-session, per-tenant |

### 19.4 Upgrade Path

**From v4.20.3 to v5.0.2:**

1. Apply migration `V2026_01_09_001__v5_grimoire_governor.sql`
2. Deploy new Lambda functions (Governor API, Grimoire cleanup)
3. Configure EventBridge for daily cleanup
4. Set default Governor mode to `balanced`
5. Grimoire populates automatically from new executions

**Rollback (if needed):**

1. Set Governor mode to `off` for all domains
2. Grimoire continues to exist but is not consulted
3. No data loss; can re-enable at any timeStep 17: Update GlossaryADD these terms to the Glossary:markdown### Glossary Additions (v5.0.2)

| Term | Definition |
|------|------------|
| **The Grimoire** | Procedural memory system that stores and retrieves heuristics |
| **Economic Governor** | Cost optimization system that routes tasks to optimal models |
| **System 0** | Cheap classifier model (gpt-4o-mini) used for complexity scoring |
| **Heuristic** | Reusable lesson extracted from successful execution |
| **Librarian** | Background task that extracts heuristics after success |
| **Complexity Score** | 1-10 rating of task difficulty for model routing |
| **Cost Arbitrage** | Automatic selection of cheapest viable model |
| **Fail-Closed** | Security policy that blocks on error (used for writes) |
| **Fail-Open** | Security policy that allows on error (used for reads) |
| **Context Embedding** | Vector representation of text for semantic search |
| **Confidence Score** | Reinforcement level of a heuristic (0.0-1.0) |Step 18: Update Version HistoryADD to the Version History section:markdown### Version History

| Version | Date | Changes |
|---------|------|---------|
| **5.0.2** | 2026-01-08 | The Grimoire (procedural memory); Economic Governor (cost optimization); Self-optimizing architecture |
| **5.0.1** | 2026-01-08 | Schema fixes; Cato HTTP bridge; Connection pooling |
| **5.0.0** | 2026-01-08 | Initial System Evolution release |
| 4.20.3 | 2026-01-08 | Mission Control GA; MCP Hybrid Interface; Domain Risk Policies |
| 4.20.2 | 2026-01-07 | Fixed RLS tenant bleed; Force reconnection pattern |
| 4.20.1 | 2026-01-07 | MCP Bug fixes |
| 4.20.0 | 2026-01-06 | Initial Mission Control release |Step 19: Update Document FooterFIND:
Version 4.20.3 | January 2026
Cross-AI Validated: Claude Opus 4.5 ✓ | Google Gemini ✓ (Grade A+ Golden)
Mission Control: GO FOR LAUNCHREPLACE WITH:
Version 5.0.2 | January 2026
Cross-AI Validated: Claude Opus 4.5 ✓ | Google Gemini ✓
System Evolution: The Grimoire + Economic Governor
Status: GO FOR LAUNCHVERIFICATION CHECKLISTAfter applying all updates, verify:Content Verification

 Document header shows v5.0.2
 Table of Contents includes sections 17, 18, 19
 Section 1.2 contains "Self-Improving IDE" evolution table
 Administrator Responsibilities includes Grimoire and Governor items
 Processing Pipeline includes Grimoire Consult, Governor Routing, Librarian Review
 Section 2.4 Grimoire Database WARNING box present
 Section 2.5 Economic Governor WARNING box present
 Grimoire Concepts section exists with lifecycle diagram
 Governor Concepts section exists with complexity scale
 Tenant Configuration includes Grimoire and Governor configs
 Metrics section includes Grimoire and Governor metrics
 Troubleshooting has 4 new scenarios (Grimoire + Governor)
 API Reference includes Grimoire and Governor endpoints
New Sections Verification

 Section 17 "The Grimoire" exists with architecture diagram
 Section 18 "Economic Governor" exists with routing flow
 Section 19 "Self-Optimizing Architecture" exists with learning loop
Metadata Verification

 Glossary includes all new terms
 Version History includes 5.0.0, 5.0.1, 5.0.2
 Footer shows v5.0.2 with System Evolution status
 All cross-references link correctly
Document ID: RADIANT-PROMPT-39
Version: 39.0
Target Doc Version: 5.0.2
Date: January 8, 2026
Cross-AI Validated: Claude Opus 4.5 ✅ | Gemini 2.0 ✅
Status: 🟢 GO FOR LAUNCHEnd of RADIANT PROMPT-39: Administrator Guide Update v5.0.2
System Evolution: The Grimoire + Economic Governor/**
 * The Grimoire & Economic Governor CDK Stack
 * RADIANT v5.0.2 - System Evolution
 * 
 * Infrastructure for:
 * - Grimoire cleanup Lambda (scheduled daily)
 * - Governor API Lambda
 * - EventBridge schedules
 */

import * as cdk from 'aws-cdk-lib';
import * as events from 'aws-cdk-lib/aws-events';
import * as targets from 'aws-cdk-lib/aws-events-targets';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as secretsmanager from 'aws-cdk-lib/aws-secretsmanager';
import * as logs from 'aws-cdk-lib/aws-logs';
import { Construct } from 'constructs';

export interface GrimoireStackProps extends cdk.StackProps {
  appId: string;
  environment: string;
  vpc: ec2.IVpc;
  dbSecurityGroup: ec2.ISecurityGroup;
  dbSecret: secretsmanager.ISecret;
  litellmProxyUrl: string;
  litellmApiKeySecretArn: string;
  catoServiceUrl: string;
}

export class GrimoireStack extends cdk.Stack {
  public readonly cleanupLambda: lambda.Function;
  public readonly governorApiLambda: lambda.Function;
  public readonly grimoireApiLambda: lambda.Function;

  constructor(scope: Construct, id: string, props: GrimoireStackProps) {
    super(scope, id, props);

    const { 
      appId, 
      environment, 
      vpc, 
      dbSecurityGroup, 
      dbSecret,
      litellmProxyUrl,
      litellmApiKeySecretArn,
      catoServiceUrl
    } = props;

    // Common Lambda environment variables
    const commonEnv = {
      ENVIRONMENT: environment,
      APP_ID: appId,
      DB_SECRET_ARN: dbSecret.secretArn,
      LITELLM_PROXY_URL: litellmProxyUrl,
      CATO_API_URL: catoServiceUrl,
    };

    // Lambda security group
    const lambdaSg = new ec2.SecurityGroup(this, 'GrimoireLambdaSg', {
      vpc,
      description: 'Security group for Grimoire Lambda functions',
      allowAllOutbound: true,
    });

    // Allow Lambda to connect to database
    dbSecurityGroup.addIngressRule(
      lambdaSg,
      ec2.Port.tcp(5432),
      'Allow Grimoire Lambda to connect to database'
    );

    // Shared Lambda layer for Python dependencies
    const pythonLayer = new lambda.LayerVersion(this, 'GrimoirePythonLayer', {
      layerVersionName: `${appId}-${environment}-grimoire-python-deps`,
      code: lambda.Code.fromAsset('lambda-layers/grimoire-python'),
      compatibleRuntimes: [lambda.Runtime.PYTHON_3_11],
      description: 'Python dependencies for Grimoire (psycopg2, pgvector, httpx, numpy)',
    });

    // =========================================================================
    // GRIMOIRE CLEANUP LAMBDA
    // =========================================================================
    this.cleanupLambda = new lambda.Function(this, 'GrimoireCleanupLambda', {
      functionName: `${appId}-${environment}-grimoire-cleanup`,
      runtime: lambda.Runtime.PYTHON_3_11,
      handler: 'cleanup.handler',
      code: lambda.Code.fromAsset('lambda/grimoire'),
      timeout: cdk.Duration.minutes(5),
      memorySize: 512,
      vpc,
      vpcSubnets: { subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS },
      securityGroups: [lambdaSg],
      environment: {
        ...commonEnv,
        CLEANUP_BATCH_SIZE: '1000',
      },
      layers: [pythonLayer],
      logRetention: logs.RetentionDays.ONE_MONTH,
    });

    // Grant DB access
    dbSecret.grantRead(this.cleanupLambda);

    // Schedule daily cleanup at 3 AM UTC
    new events.Rule(this, 'GrimoireCleanupSchedule', {
      ruleName: `${appId}-${environment}-grimoire-cleanup-schedule`,
      schedule: events.Schedule.cron({ minute: '0', hour: '3' }),
      targets: [new targets.LambdaFunction(this.cleanupLambda)],
      description: 'Daily cleanup of expired Grimoire heuristics',
    });

    // =========================================================================
    // GRIMOIRE API LAMBDA
    // =========================================================================
    this.grimoireApiLambda = new lambda.Function(this, 'GrimoireApiLambda', {
      functionName: `${appId}-${environment}-grimoire-api`,
      runtime: lambda.Runtime.NODEJS_20_X,
      handler: 'index.handler',
      code: lambda.Code.fromAsset('lambda/grimoire-api'),
      timeout: cdk.Duration.seconds(30),
      memorySize: 512,
      vpc,
      vpcSubnets: { subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS },
      securityGroups: [lambdaSg],
      environment: {
        ...commonEnv,
        NODE_ENV: environment,
      },
      logRetention: logs.RetentionDays.ONE_MONTH,
    });

    dbSecret.grantRead(this.grimoireApiLambda);

    // Grant access to LiteLLM API key secret
    const litellmSecret = secretsmanager.Secret.fromSecretCompleteArn(
      this, 
      'LiteLLMSecret', 
      litellmApiKeySecretArn
    );
    litellmSecret.grantRead(this.grimoireApiLambda);

    // =========================================================================
    // ECONOMIC GOVERNOR API LAMBDA
    // =========================================================================
    this.governorApiLambda = new lambda.Function(this, 'GovernorApiLambda', {
      functionName: `${appId}-${environment}-governor-api`,
      runtime: lambda.Runtime.NODEJS_20_X,
      handler: 'index.handler',
      code: lambda.Code.fromAsset('lambda/governor-api'),
      timeout: cdk.Duration.seconds(30),
      memorySize: 512,
      vpc,
      vpcSubnets: { subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS },
      securityGroups: [lambdaSg],
      environment: {
        ...commonEnv,
        NODE_ENV: environment,
      },
      logRetention: logs.RetentionDays.ONE_MONTH,
    });

    dbSecret.grantRead(this.governorApiLambda);
    litellmSecret.grantRead(this.governorApiLambda);

    // =========================================================================
    // OUTPUTS
    // =========================================================================
    new cdk.CfnOutput(this, 'CleanupLambdaArn', {
      value: this.cleanupLambda.functionArn,
      description: 'Grimoire Cleanup Lambda ARN',
      exportName: `${appId}-${environment}-grimoire-cleanup-arn`,
    });

    new cdk.CfnOutput(this, 'GrimoireApiLambdaArn', {
      value: this.grimoireApiLambda.functionArn,
      description: 'Grimoire API Lambda ARN',
      exportName: `${appId}-${environment}-grimoire-api-arn`,
    });

    new cdk.CfnOutput(this, 'GovernorApiLambdaArn', {
      value: this.governorApiLambda.functionArn,
      description: 'Governor API Lambda ARN',
      exportName: `${appId}-${environment}-governor-api-arn`,
    });

    // Tags
    cdk.Tags.of(this).add('Application', appId);
    cdk.Tags.of(this).add('Environment', environment);
    cdk.Tags.of(this).add('Component', 'grimoire');
    cdk.Tags.of(this).add('Version', '5.0.2');
  }
}
