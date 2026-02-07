# LIVS-M 2.0 Explainer

**LLM Integrity Verification System - Management Edition**

> TL;DR: LIVS-M catches AI "lies" the same way a manager catches engineers who submit placeholder code and say "it's done."

---

## The Problem LIVS-M Solves

LLMs have a **"Laziness Factor"** — they satisfice (do minimum work) to save compute:

| AI Lie Type | What It Looks Like | Why It Happens |
|-------------|-------------------|----------------|
| **Stubs** | `return [];` or `// TODO: implement` | Easier than real implementation |
| **Sycophancy** | "Great idea!" (agrees too fast) | RLHF trained it to please users |
| **Hallucination** | Fabricated citations, fake data | Model fills gaps with plausible-sounding text |
| **Overconfidence** | "I'm 95% sure" (but wrong) | No self-calibration mechanism |

---

## How LIVS-M Works

### Two-Phase Defense

```
┌─────────────────────────────────────────────────────────────┐
│                    PHASE 1: STUB DETECTION                  │
│  Hard reject placeholder code BEFORE it reaches the user    │
│  Patterns: "TODO", "placeholder", "return []", "pass", etc  │
└─────────────────────────────┬───────────────────────────────┘
                              │ If stubs found → REJECT + retry prompt
                              ▼
┌─────────────────────────────────────────────────────────────┐
│               PHASE 2: GOVERNANCE SUPERVISOR                │
│  LLM-as-Judge evaluates agent output against Policy Rules   │
│  Decisions: APPROVE / WARN / REJECT / ESCALATE              │
└─────────────────────────────────────────────────────────────┘
```

### Core Components

| Component | What It Does |
|-----------|--------------|
| **Policy Registry** | JSON config with rules (can be changed without code deploys) |
| **Governance Supervisor** | LLM turned into a "judge" that enforces policy rules |
| **Interrogator** | Multi-round questioning to detect lies ("peel the onion") |
| **Sycophancy Breaker** | Injects adversarial "Devil's Advocate" when agents agree too fast |

---

## The Three Policy Modes

Users choose how strict the AI verification should be:

| Mode | Nickname | Use Case | Behavior |
|------|----------|----------|----------|
| **RAPID_PROTO** | "Brainstorming" | Hackathons, exploration | Stubs allowed, warnings don't block |
| **ENGINEERING** | "Standard" ⭐ | Daily work | Code must run, sycophancy warned |
| **STRICT_AUDIT** | "Strict Audit" | Production, compliance | No stubs, tests required, Devil's Advocate active |

**Default is Standard** — balanced rigor without slowing down normal work.

---

## Key Rules in the Registry

| Rule | What It Catches | Action |
|------|-----------------|--------|
| `no_placeholder_code` | `// TODO`, `return null`, empty implementations | REJECT |
| `no_mock_data` | Hardcoded fake data in production code | REJECT |
| `sycophancy_detection` | Agent agrees within 1 turn without evidence | WARN + inject chaos |
| `confidence_calibration` | Claims >90% confidence without citations | WARN + probe |
| `test_required` | Code without test in Strict mode | REJECT |

---

## Sycophancy Breaking (Chaos Injection)

When agents agree too quickly:

```
User: "Should we use MongoDB for this financial system?"
Agent A: "Yes, great choice!"
Agent B: "I agree, MongoDB is perfect!"

→ LIVS-M DETECTS: Consensus velocity too high (2 agents agreed in <2 turns)
→ INJECTS: "Devil's Advocate" prompt to Agent C

Agent C: "Actually, ACID compliance concerns with MongoDB for 
         financial data. Have we considered PostgreSQL?"
```

This breaks the sycophancy loop and forces real discussion.

---

## Integration Points

```
AGI Orchestrator
       │
       ▼
┌──────────────┐    ┌──────────────────┐
│ Agent Output │───▶│ LIVS-M Supervisor │
└──────────────┘    └────────┬─────────┘
                             │
        ┌────────────────────┼────────────────────┐
        ▼                    ▼                    ▼
   [APPROVE]            [WARN + LOG]         [REJECT]
   Continue              Continue           Retry with
                        (flagged)           guidance
```

---

## Where to Configure

| UI | Path |
|----|------|
| **Think Tank** | Settings → Advanced → LIVS-M Policy |
| **Radiant Admin** | Cato → LIVS Policy |

---

## Why "LIVS-M"?

- **LIVS** = LLM Integrity Verification System
- **M** = Management (policy-driven, not hardcoded rules)
- **2.0** = Second generation (added Soft Registry + Governance Supervisor)

---

## One-Line Summary

> LIVS-M is a policy engine that catches AI shortcuts before they ship — configurable from "let me brainstorm" to "zero trust audit mode."
