---
description: Policy - RADIANT Glossary must be synchronized when documentation changes introduce new terms
---

# Glossary Synchronization Policy

> ⚠️ **MANDATORY POLICY** ⚠️
>
> The RADIANT Glossary (`docs/RADIANT-GLOSSARY.md`) must be kept in sync with all other documentation.

---

## When This Policy Applies

This policy is triggered when ANY of these documents are updated:

| Document | Trigger Reason |
|----------|---------------|
| `docs/RADIANT-ADMIN-GUIDE.md` | May introduce platform terms/features |
| `docs/THINKTANK-ADMIN-GUIDE.md` | May introduce Think Tank admin terms |
| `docs/THINKTANK-USER-GUIDE.md` | May introduce user-facing features |
| `docs/ENGINEERING-IMPLEMENTATION-VISION.md` | May introduce technical terms/subsystems |
| `docs/RADIANT-PLATFORM-ARCHITECTURE.md` | May introduce architecture terms/AWS services |
| `docs/RADIANT-MOATS.md` | May introduce competitive advantage terms |
| `docs/THINKTANK-MOATS.md` | May introduce feature-specific terms |
| `docs/SERVICE-LAYER-GUIDE.md` | May introduce API/protocol terms |

---

## Glossary Update Checklist

When updating any documentation, check for:

```
□ New AI/ML terms (LLM, RAG, LoRA, embedding, etc.)
□ New RADIANT subsystems (services, engines, pipelines)
□ New Think Tank features (UI features, user capabilities)
□ New AWS services being used
□ New acronyms or abbreviations
□ New database/storage terms
□ New security/compliance terms
□ New API/protocol terms
□ New UI/UX terms
```

---

## How to Update the Glossary

### Step 1: Identify New Terms

Search the updated document for:
- Bold terms (`**term**`)
- Technical jargon not in common use
- Abbreviations and acronyms
- Service or component names
- AWS service references

### Step 2: Add to Appropriate Section

The glossary has these sections:

| Section | What Goes Here |
|---------|----------------|
| 1. AI & Machine Learning Terms | LLM, RAG, embedding, inference, etc. |
| 2. RADIANT Core Subsystems | Brain, Cato, Cortex, Genesis, etc. |
| 3. Think Tank Features | Magic Carpet, Polymorphic UI, etc. |
| 4. AWS Services Used | Lambda, S3, Aurora, Bedrock, etc. |
| 5. Acronyms & Abbreviations | All abbreviations (MCP, A2A, CBF, etc.) |
| 6. Database & Storage Terms | pgvector, RDS Proxy, tiers, etc. |
| 7. Security & Compliance Terms | RLS, RBAC, HIPAA, etc. |
| 8. API & Protocol Terms | MCP, A2A, SSE, WebSocket, etc. |
| 9. UI/UX Terms | GenUI, Shadcn, Tailwind, etc. |

### Step 3: Follow Table Format

```markdown
| Term | Definition |
|------|------------|
| **New Term** | Clear, concise definition |
```

For subsystems with file references:
```markdown
| Subsystem | Description | Key Files |
|-----------|-------------|-----------|
| **New System** | What it does | `path/to/file.ts` |
```

### Step 4: Update Version

Update the version in the glossary header:
```markdown
> **Version**: X.X.X | **Last Updated**: YYYY-MM-DD
```

---

## Quick Reference: Term Categories

### AI/ML Terms
- Model types (LLM, transformer, embedding)
- Training techniques (LoRA, RLHF, fine-tuning)
- Inference concepts (temperature, tokens, RAG)

### Subsystem Names
- Core engines (Brain, Cato, Cortex, Genesis)
- Feature systems (Grimoire, Time Machine, Flash Facts)
- Safety systems (CBF, Truth Engine, Ethics Pipeline)

### AWS Services
- Compute (Lambda, SageMaker, ECS)
- Database (Aurora, DynamoDB, ElastiCache)
- Storage (S3, Glacier)
- AI/ML (Bedrock, Textract, Comprehend)

### Acronyms (ALWAYS add new ones)
- Protocol acronyms (MCP, A2A, SSE)
- RADIANT-specific (CBF, HITL, RAWS, UDS)
- Compliance (HIPAA, SOC2, GDPR, CCPA)

---

## Integration with Master Policy

This policy is integrated with `docs-update-all.md`:

1. When updating primary docs → Check glossary
2. When introducing new terms → Update glossary
3. When adding AWS services → Update glossary
4. When creating new subsystems → Update glossary

---

## Regenerating PDF

After significant glossary updates, regenerate the PDF:

```bash
// turbo
pandoc docs/RADIANT-GLOSSARY.md -o docs/RADIANT-GLOSSARY.pdf \
  --pdf-engine=pdflatex \
  -V colorlinks=true \
  -V linkcolor=blue \
  -V urlcolor=blue \
  -V toccolor=blue \
  --toc --toc-depth=2 \
  -V geometry:margin=1in \
  -V fontsize=11pt
```

---

## Anti-Patterns

❌ Adding new terms to docs without updating glossary
❌ Using undefined acronyms in documentation
❌ Introducing subsystems without glossary entries
❌ Adding AWS services without documenting in glossary
❌ Skipping glossary because "it's just a small change"

---

**THIS POLICY IS MANDATORY. All new terms, subsystems, acronyms, and AWS services MUST be added to the glossary.**
