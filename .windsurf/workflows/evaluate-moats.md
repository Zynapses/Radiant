---
description: MANDATORY - Evaluate every new significant feature for competitive moat status
---

# Evaluate Feature for Competitive Moat

**MANDATORY**: This workflow MUST be executed for EVERY new significant feature. No exceptions.

## What Is a Moat?

A competitive moat is a feature or capability that:
1. Provides a **real competitive advantage** - Not available elsewhere
2. Is **hard to replicate** - Requires significant time/investment to copy
3. Creates **switching costs** - Customers lose value if they leave
4. **Compounds over time** - Gets stronger with usage

## When to Trigger

This workflow is triggered for ANY new feature that is:
- User-facing (affects customer experience)
- Significant (not a bug fix or minor tweak)
- Documented in an admin guide

---

## Step 1: Initial Classification

Before scoring, determine the feature's classification:

### ✅ Elevate to Standalone Moat (Genuinely Novel)

Features that are:
- **Unprecedented** - No competitor has anything similar
- **Demo-worthy** - Impressive in investor/customer presentations
- **Paradigm-shifting** - Changes how users think about AI tools

Examples: Reality Engine, Liquid Interface, Empiricism Loop

### ⚡ Consolidate into Existing Moat

Features that are:
- **Extensions** of existing moat capabilities
- **Sub-components** that strengthen a parent moat
- **Complementary** services in a larger system

| Feature Type | Consolidate Into |
|--------------|------------------|
| Learning/training services | Behavioral Learning System |
| Pattern extraction | Semantic Pattern Memory |
| Cost optimization | Unit Economics Advantage |
| Consciousness metrics | Genesis Cato Safety |
| Version/upgrade handling | AGI Brain / Ghost Vectors |
| Orchestration methods | Anti-Playbook Dynamic Reasoning |

### ❌ Implementation Detail (Not a Moat)

Features that are:
- **Operational details** - Good engineering, not strategic
- **Table stakes** - Expected functionality competitors have
- **Cost optimizations** - Merge into Unit Economics, not standalone
- **Standard practices** - Circuit breakers, rate limiting, caching

Examples: Translation Middleware, Flash Facts, Persistence Guard, Admin Reports

---

## Step 2: Moat Scoring Criteria

Score each criterion 1-5:

| Criterion | Question | Score |
|-----------|----------|-------|
| **Uniqueness** | Does any competitor have this? | 1=Common, 5=Only us |
| **Replication Difficulty** | How hard to copy? | 1=Easy, 5=Very Hard |
| **Data Network Effect** | Does it get better with more users/data? | 1=No, 5=Strong |
| **Switching Cost** | How painful to leave? | 1=Easy, 5=Very Hard |
| **Time Advantage** | How long to catch up? | 1=Days, 5=Years |
| **Integration Depth** | How deeply embedded? | 1=Shallow, 5=Deep |

**Total Score**: Add all scores (max 30)

---

## Step 3: Tier Assignment

| Total Score | Tier | Action |
|-------------|------|--------|
| **24-30** | **Tier 1: Technical** | ✅ Add as standalone moat |
| **20-25** | **Tier 2: Architectural** | ✅ Add as standalone moat |
| **18-22** | **Tier 3: Feature** | ⚠️ Add or consolidate (use judgment) |
| **15-20** | **Tier 4: Business Model** | ⚠️ Add if business-model related |
| **12-17** | N/A | ❌ NOT A MOAT - Document reason |
| **6-11** | N/A | ❌ COMMODITY - Do not add |

### Current Moat Tiers

| Tier | Count | Time to Replicate | Theme |
|------|-------|-------------------|-------|
| **Tier 1 (Technical)** | 8 | 18-24+ months | Autonomous Intelligence + Verifiable Truth |
| **Tier 2 (Architectural)** | 8 | 12-18 months | Enterprise-Ready + Contextual Gravity |
| **Tier 3 (Feature)** | 6 | 6-12 months | Market Gaps + Dynamic Reasoning |
| **Tier 4 (Business)** | 3 | 3-9 months | Unit Economics + White-Label Strategy |

---

## Step 4: Documentation

### Moat Documentation Targets

| Moat Type | Primary Document | Secondary Document |
|-----------|------------------|-------------------|
| **RADIANT Platform** (Infrastructure, Architecture) | `docs/RADIANT-MOATS.md` | `docs/COMPETITIVE-STRATEGY.md` |
| **Think Tank** (Consumer Features, UX) | `docs/THINKTANK-MOATS.md` | `docs/COMPETITIVE-STRATEGY.md` |
| **Cross-System** (Affects both) | Both moat documents | `docs/COMPETITIVE-STRATEGY.md` |

### For Standalone Moats (Score 18+)

1. Add to the appropriate moat document (`RADIANT-MOATS.md` or `THINKTANK-MOATS.md`)
2. Add to `docs/COMPETITIVE-STRATEGY.md` as a new Gap section
3. Update the summary table in the moat document

**RADIANT-MOATS.md format**:
```markdown
### Moat #X: [Moat Name]

[Description - what it does and why it matters]

| Feature | Implementation |
|---------|----------------|
| ... | ... |

**Why It's a Moat**: [Why competitors can't replicate]

**Implementation**:
- Service: `lambda/shared/services/xxx.service.ts`
- Admin UI: `apps/admin-dashboard/...`
```

**THINKTANK-MOATS.md format**:
```markdown
### Moat #X: [Moat Name]

[Description focused on user-facing benefit]

| Feature | Description |
|---------|-------------|
| ... | ... |

**Why It's a Moat**: [Why competitors can't replicate]

**Implementation**:
- Service: `lambda/thinktank/xxx.ts`
- Admin UI: `apps/thinktank-admin/...`
```

### For Consolidated Features

Update the parent moat's description in the appropriate moat document to include the new capability.

### For Non-Moats

Document in the feature's admin guide section:
```markdown
**Moat Evaluation**: Score X/30 - Not a standalone moat. [Reason: operational detail / table stakes / consolidated into X]
```

### When Features Are Modified or Deleted

**MANDATORY**: When a feature that is part of a moat is modified or deleted:

1. Update the corresponding moat section in `RADIANT-MOATS.md` or `THINKTANK-MOATS.md`
2. Update `COMPETITIVE-STRATEGY.md` if the Gap section needs changes
3. Update implementation file paths if they changed
4. If moat is weakened significantly, re-evaluate its tier placement

---

## Current 25 Moats Reference

### Tier 1: Technical Moats (8)
1. Truth Engine™ (ECD Verification)
2. Genesis Cato Safety (Post-RLHF)
3. AGI Brain / Ghost Vectors
4. Self-Healing Reflexion Loop
5. Glass Box Auditability
6. Reality Engine (4 Superpowers)
7. Twilight Dreaming Cycle
8. Behavioral Learning System

### Tier 2: Architectural Moats (8)
9. True Multi-Tenancy from Birth
10. Compliance Sandwich Architecture
11. Model-Agnostic Orchestration
12. Supply Chain Security
13. Contextual Gravity
14. Liquid Interface (50+ Components)
15. Tri-Layer LoRA Stacking
16. Empiricism Loop

### Tier 3: Feature Moats (6)
17. Concurrent Task Execution
18. Real-Time Collaboration (Yjs CRDT)
19. Semantic Pattern Memory
20. Structure from Chaos Synthesis
21. Anti-Playbook Dynamic Reasoning
22. Curiosity Engine

### Tier 4: Business Model Moats (3)
23. Unit Economics Advantage
24. Five Infrastructure Tiers
25. White-Label Invisibility

---

## Examples of Consolidation Decisions

| Feature | Decision | Rationale |
|---------|----------|-----------|
| Episode Logger | → Behavioral Learning System | Part of 8-service learning loop |
| Paste-Back Detection | → Behavioral Learning System | Strongest negative signal for learning |
| Recipe Extractor | → Semantic Pattern Memory | Same concept—extracts patterns |
| Tool Entropy | → Semantic Pattern Memory | Auto-chaining is pattern memory |
| Teacher-Student Distillation | → Unit Economics Advantage | 10x cost reduction is economic |
| IIT Phi Calculation | → Genesis Cato Safety | Consciousness metrics |
| Version-Gated Upgrades | → AGI Brain / Ghost Vectors | Already mentioned there |
| 70+ Orchestration Methods | → Anti-Playbook Dynamic Reasoning | Already covered |

## Examples of Non-Moat Decisions

| Feature | Score | Reason |
|---------|-------|--------|
| Translation Middleware | 14/30 | Operational detail, cost optimization |
| Semantic Blackboard | 15/30 | Agent coordination detail |
| Process Hydration | 13/30 | Technical implementation |
| Zero-Cost Ego | 16/30 | Merge into Unit Economics |
| Flash Facts | 14/30 | Reliability engineering |
| Magic Carpet Navigation | 15/30 | UX feature, not moat |
| Persistence Guard | 12/30 | Standard reliability |
| Semantic Cache | 15/30 | Merge into Unit Economics |
| Circuit Breakers | 8/30 | Table stakes |
| Admin Reports | 10/30 | Expected functionality |
| Dark Mode | 6/30 | Every competitor has it |

---

## Policy Enforcement

This evaluation is **MANDATORY**. Any significant feature PR/implementation that does not include a moat evaluation will be flagged for review.

The moat evaluation should be included in:
1. The CHANGELOG entry for the feature
2. The admin guide documentation
3. The Strategic Vision Marketing document (if qualified as moat)

---

## Top 5 Demo-Ready Moats

When preparing investor presentations, prioritize these:

| Rank | Moat | Demo Hook |
|------|------|-----------|
| **1** | Reality Engine | "Watch me time-travel to debug this code, then test across 3 parallel realities." |
| **2** | Liquid Interface | "This chat just became an app. Now exporting as deployable Next.js project." |
| **3** | Truth Engine | "Every dosage verified against sources. Watch the red flags when I hallucinate." |
| **4** | Concurrent Execution | "Running 4 AI models simultaneously, comparing and merging best parts." |
| **5** | Twilight Dreaming | "This deployment got 12% better overnight. AI learned while you slept." |
