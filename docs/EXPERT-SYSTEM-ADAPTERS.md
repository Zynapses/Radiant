# RADIANT Expert System Adapters

## Tenant-Trainable Domain Intelligence

**Version**: 1.0 | **January 2026**  
**Cross-AI Collaborative Design**: Claude Opus 4.5 + Gemini

---

## Executive Summary

Expert System Adapters (ESA) represent RADIANT's approach to tenant-trainable domain intelligence. Unlike generic AI models that treat all queries equally, ESA enables each tenant to build specialized AI expertise that continuously improves through interaction feedback.

**Key Innovation**: Every tenant develops their own "expert" that learns their specific domain language, preferences, and quality standards—without requiring any ML expertise from administrators.

---

## 1. The Problem with Generic AI

### 1.1 One-Size-Fits-None

Traditional AI platforms offer the same model to all customers:
- A law firm gets the same AI as a marketing agency
- Medical terminology isn't prioritized for healthcare providers
- Industry-specific jargon goes unrecognized
- Quality standards vary by domain but models can't adapt

### 1.2 The Training Gap

Organizations want AI that understands them, but:
- Fine-tuning requires ML expertise (costly, rare)
- Training data curation is time-consuming
- Model updates risk regression
- No visibility into what the AI has "learned"

---

## 2. Expert System Adapters: The Solution

### 2.1 Tri-Layer Architecture

ESA implements a three-layer adapter stack that composes personalization at multiple levels:

```
┌─────────────────────────────────────────┐
│         Final Model Weights             │
│  W_Final = W_Genesis + W_Cato + W_User  │
└─────────────────────────────────────────┘
                    ▲
        ┌───────────┼───────────┐
        │           │           │
   ┌────┴────┐ ┌────┴────┐ ┌────┴────┐
   │ Layer 0 │ │ Layer 1 │ │ Layer 2 │
   │ Genesis │ │  Cato   │ │  User   │
   │  (Base) │ │(Global) │ │(Personal│
   └─────────┘ └─────────┘ └─────────┘
      Frozen     Pinned    LRU Eviction
```

| Layer | Name | Purpose | Management |
|-------|------|---------|------------|
| **0** | Genesis | Base model weights | Frozen, never modified |
| **1** | Cato | Global constitution, safety, tenant values | Pinned in memory, never evicted |
| **2** | User | Personal preferences, interaction style | LRU eviction when memory constrained |
| **3** | Domain | Specialized expertise (optional) | Auto-selected by domain detection |

### 2.2 Automatic Learning Pipeline

ESA learns from every interaction without manual intervention:

```
User Interaction
      │
      ▼
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│  Implicit   │────▶│  Training   │────▶│   Adapter   │
│  Feedback   │     │  Candidate  │     │  Training   │
│  Detection  │     │   Queue     │     │  Pipeline   │
└─────────────┘     └─────────────┘     └─────────────┘
      │                                       │
      │                                       ▼
      │                               ┌─────────────┐
      └─────────────────────────────▶│  Validation │
                                      │  & Rollback │
                                      └─────────────┘
```

### 2.3 Feedback Signals

ESA captures both explicit and implicit quality signals:

| Signal Type | Weight | Interpretation |
|-------------|--------|----------------|
| **Copy Response** | +0.80 | High utility - user copied the output |
| **Thumbs Up** | +1.00 | Explicit positive feedback |
| **Follow-up Question** | +0.30 | Partial success, needs more |
| **Long Dwell Time** | +0.40 | User engaged with response |
| **Regenerate Request** | -0.50 | Response wasn't satisfactory |
| **Abandon Conversation** | -0.70 | Complete failure |
| **Rephrase Question** | -0.50 | Original response missed the mark |
| **Thumbs Down** | -1.00 | Explicit negative feedback |

---

## 3. Domain Expertise System

### 3.1 Domain Detection

RAWS (RADIANT Adaptive Weighted Selection) automatically detects query domains:

| Domain | Subspecialties | Example Triggers |
|--------|---------------|------------------|
| **Legal** | Contract, IP, Employment, Litigation | "pursuant to", "liability", "indemnify" |
| **Medical** | Clinical, Research, Administrative | "diagnosis", "contraindication", "ICD-10" |
| **Financial** | Accounting, Investment, Compliance | "GAAP", "depreciation", "quarterly" |
| **Engineering** | Software, Mechanical, Electrical | "API", "architecture", "implementation" |
| **Creative** | Marketing, Design, Content | "brand voice", "engagement", "campaign" |
| **Research** | Academic, Scientific, Analysis | "hypothesis", "methodology", "peer-reviewed" |
| **Operations** | HR, Project Management, Logistics | "workflow", "onboarding", "KPI" |

### 3.2 Domain-Specific Adapters

Each domain can have specialized LoRA adapters:

```typescript
interface DomainLoraAdapter {
  id: string;
  tenantId: string;
  domain: string;
  subdomain?: string;
  adapterName: string;
  baseModel: string;
  adapterVersion: number;
  s3Bucket: string;
  s3Key: string;
  trainingCandidatesCount: number;
  lastTrainedAt?: Date;
  accuracyScore?: number;
  domainRelevanceScore?: number;
  userSatisfactionScore?: number;
  status: 'training' | 'validating' | 'active' | 'deprecated' | 'failed';
}
```

### 3.3 Auto-Selection Algorithm

When a query arrives, ESA selects the optimal adapter:

```
Score = (0.3 × DomainMatch) 
      + (0.1 × SubdomainBonus)
      + (0.25 × SatisfactionScore)
      + (0.1 × VolumeScore)
      + (0.05 × ErrorRate)
      + (0.2 × RecencyScore)
```

Selection threshold: Score ≥ 0.5 to use adapter (else fallback to base model)

---

## 4. Training Pipeline

### 4.1 Candidate Collection

Training candidates accumulate based on configurable thresholds:

| Setting | Default | Description |
|---------|---------|-------------|
| `min_candidates_for_training` | 25 | Minimum total candidates before training |
| `min_positive_candidates` | 15 | Minimum positive examples required |
| `min_negative_candidates` | 5 | Minimum negative examples for contrastive learning |

### 4.2 Training Schedule

Configurable training frequency with intelligent scheduling:

| Frequency | Best For | Auto-Optimal Time |
|-----------|----------|-------------------|
| **Daily** | High-volume tenants | Detects lowest-usage hours |
| **Twice Weekly** | Medium activity | Balances freshness/cost |
| **Weekly** | Standard deployments | Default for most tenants |
| **Biweekly** | Low activity | Conservative approach |
| **Monthly** | Minimal changes | Stability-focused |

### 4.3 Contrastive Learning

ESA uses both positive and negative examples for better learning:

**Positive Examples**: High-rated responses, copied text, explicit thumbs-up
**Negative Examples**: Regenerated responses, abandoned conversations, explicit thumbs-down

```sql
-- Negative learning candidate categories
'factual_error'       -- Incorrect information
'incomplete_answer'   -- Missing key details
'wrong_tone'          -- Inappropriate style
'too_verbose'         -- Unnecessarily long
'too_brief'           -- Lacking detail
'off_topic'           -- Didn't address question
'harmful_content'     -- Safety violation
'formatting_issue'    -- Poor structure
'code_error'          -- Broken code
'unclear_explanation' -- Confusing response
```

---

## 5. Safety & Rollback

### 5.1 Automatic Rollback

ESA monitors adapter performance and automatically rolls back if quality degrades:

```typescript
// Rollback triggers
const rollbackConditions = {
  satisfactionDrop: 10,     // % drop from baseline
  errorRateIncrease: 5,     // % increase in errors
  latencyIncrease: 50,      // % increase in response time
  minSampleSize: 100,       // Minimum requests before evaluation
};
```

### 5.2 A/B Testing

New adapters are deployed with gradual rollout:
1. **Shadow Mode** (0% traffic): Adapter runs but results not returned
2. **Canary** (5% traffic): Small percentage gets new adapter
3. **Gradual Rollout** (5% → 25% → 50% → 100%): Progressive increase
4. **Full Deployment**: All traffic uses new adapter

### 5.3 Version Control

Every adapter version is preserved:
- Rollback to any previous version
- Compare performance across versions
- Audit trail of all training runs

---

## 6. Implementation Files

### 6.1 Database Schema

| Table | Purpose |
|-------|---------|
| `enhanced_learning_config` | Per-tenant configuration |
| `implicit_feedback_signals` | Captured feedback signals |
| `negative_learning_candidates` | Contrastive learning examples |
| `active_learning_requests` | User feedback requests |
| `domain_lora_adapters` | Domain-specific adapters |
| `domain_adapter_training_queue` | Training job queue |
| `adapter_usage_logs` | Adapter invocation tracking |
| `pattern_cache` | Successful response patterns |

**Migration**: `packages/infrastructure/migrations/108_enhanced_learning.sql`

### 6.2 Services

| Service | Purpose |
|---------|---------|
| `enhanced-learning.service.ts` | Core learning orchestration |
| `lora-inference.service.ts` | Tri-layer adapter inference |
| `adapter-management.service.ts` | Adapter selection and management |

### 6.3 Admin API

**Base**: `/api/admin/learning`

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/config` | GET/PUT | Configuration management |
| `/domain-adapters` | GET | List domain adapters |
| `/domain-adapters/{domain}` | GET | Get active adapter for domain |
| `/training/queue` | GET | View training queue |
| `/training/trigger` | POST | Manually trigger training |
| `/performance/{adapterId}` | GET | Adapter performance metrics |

### 6.4 Admin UI

**Location**: `/models/lora-adapters`

Features:
- Tri-layer architecture visualization
- Adapter registry by layer (Global/User/Domain)
- Configuration management
- Warmup controls
- Performance metrics

---

## 7. Competitive Advantages

### 7.1 vs. Generic AI Platforms

| Capability | RADIANT ESA | Generic Platforms |
|------------|-------------|-------------------|
| Per-tenant customization | ✅ Automatic | ❌ Same model for all |
| Domain expertise | ✅ Learned | ❌ Generic |
| Implicit feedback | ✅ 11 signal types | ❌ Manual ratings only |
| Contrastive learning | ✅ Positive + negative | ❌ Positive only |
| Automatic rollback | ✅ Built-in | ❌ Manual monitoring |
| Zero ML expertise required | ✅ Fully automatic | ❌ Requires ML team |

### 7.2 vs. Custom Fine-Tuning

| Aspect | RADIANT ESA | Custom Fine-Tuning |
|--------|-------------|-------------------|
| Time to value | Hours | Weeks-months |
| ML expertise needed | None | Senior ML engineer |
| Data curation | Automatic | Manual |
| Continuous learning | ✅ Always on | ❌ Batch retraining |
| Regression protection | ✅ Automatic rollback | ❌ Manual testing |
| Cost | Included | $50K-500K/year |

---

## 8. 2029 Vision

### 8.1 Short-term (2026)
- ✅ Tri-layer adapter architecture
- ✅ Implicit feedback detection
- ✅ Contrastive learning
- ✅ Automatic rollback
- ✅ Domain auto-selection

### 8.2 Medium-term (2027)
- Cross-tenant knowledge sharing (with privacy guarantees)
- Real-time adapter updates (no batch training)
- Multi-modal expertise (text, code, images)
- Expert marketplace for adapter sharing

### 8.3 Long-term (2029)
- Fully autonomous expertise development
- Zero-shot domain adaptation
- Cross-lingual expertise transfer
- Self-improving training pipelines

---

## 9. Getting Started

### 9.1 Enable Expert System Adapters

1. Navigate to **Admin Dashboard → Models → LoRA Adapters**
2. Enable "LoRA Adapters" toggle
3. Configure adapter stacking options:
   - Use Global Adapter (Cato): Recommended ON
   - Use User Adapter: Recommended ON
   - Auto Selection: Recommended ON
4. Save configuration

### 9.2 Monitor Learning Progress

1. Check **Training Queue** for pending candidates
2. Review **Adapter Registry** for active adapters
3. Monitor **Performance Metrics** for quality trends
4. Use **Warmup** to pre-load frequently-used adapters

### 9.3 Domain Configuration

1. Navigate to **Learning → Domain Adapters**
2. View auto-detected domains with training candidates
3. Optionally trigger manual training for priority domains
4. Review adapter performance by domain

---

*Expert System Adapters: Where every tenant becomes an AI domain expert.*
