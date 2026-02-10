---
description: MANDATORY - Update ALL relevant documentation on ANY code change. This is the MASTER documentation policy.
---

# Master Documentation Policy (v3.0 — Merged)

> ⚠️ **THIS POLICY IS MANDATORY AND HAS NO EXCEPTIONS** ⚠️
>
> **Every code change requires documentation updates.** Documentation merged from 22 files into 15 documents (2026-02-10).

---

## The Golden Rule

**If you change code, you MUST update documentation. Period.**

Do NOT:
- ❌ Say "I'll update docs later"
- ❌ Update only CHANGELOG.md
- ❌ Skip any applicable documentation
- ❌ Require the user to remind you

---

## The 15 Consolidated Documents

### App Documents (one per app)
| # | Document | What It Covers |
|---|----------|---------------|
| 01 | `docs/01-THINK-TANK.md` | User guide, admin guide, tenant admin, Mac + portability manifest, Dojo, licensing, Delight, collaboration |
| 02 | `docs/02-CURATOR.md` | User guide + engineering guide |
| 04 | `docs/04-RADIANT-ADMIN.md` | Platform admin, deployment, system health, spend governor, SaaS metrics |
| 05 | `docs/05-SWIFT-DEPLOYER.md` | User guide + architecture |

### System Documents
| # | Document | What It Covers |
|---|----------|---------------|
| 06 | `docs/06-ARCHITECTURE-ENGINEERING.md` | Architecture, CDK, engineering vision, gateway, app isolation, **Data & Storage (UDS, RAWS, retention)** |
| 07 | `docs/07-AI-SYSTEMS.md` | AGI brain, consciousness, cognitive, Cortex, expert adapters, **CATO safety, ethics, GPU infra** |
| 09 | `docs/09-OMEGA-GENESIS.md` | OMEGA complete: user/admin guides, Genesis, **Five Pillars, quantum brain, Helix, firmware, model routing, Global Brain** |
| 10 | `docs/10-ORCHESTRATION-WORKFLOWS.md` | Orchestration methods/patterns, UEP specification |
| 12 | `docs/12-API-REFERENCE.md` | APIs, versioning, error codes, MCP/A2A service layer |
| 13 | `docs/13-SECURITY-AUTH-COMPLIANCE.md` | Auth architecture, user/admin/tenant auth, MFA, OAuth, compliance |
| 14 | `docs/14-OPERATIONS-RUNBOOKS.md` | Runbooks, troubleshooting, performance, DR, testing |
| 15 | `docs/15-STRATEGY-COMPETITIVE.md` | Vision, moats, capabilities, pitch, revenue, tech debt, Organism marketing |
| 16 | `docs/16-IMPLEMENTATION-SPECS.md` | Sections 00–46 (build specs + DB schema) |
| 17 | `docs/17-GLOSSARY.md` | Terms, definitions, acronyms |
| 18 | `docs/18-UI-UX-LIBRARIES.md` | Design patterns, open source libraries |

---

## Step 1: Identify Change Type

Before making ANY code change, identify what type of change it is:

| Change Type | Keywords |
|-------------|----------|
| `thinktank_feature` | Think Tank, chat, UI, morphing, liquid, delight, user rules |
| `thinktank_admin` | admin config, tenant admin, brain plans, domains |
| `curator` | knowledge graph, verification, cartridge |
| `dojo` | training, spaced repetition, competency |
| `platform_feature` | tenant, billing, models, providers, spend governor |
| `deployer` | Swift app, deployment, domain URL, tier |
| `architecture` | service, pattern, design, system, CDK, Lambda |
| `database` | migration, table, column, schema, SQL |
| `api_endpoint` | route, endpoint, API, REST, MCP, A2A |
| `security` | auth, permission, HIPAA, compliance, MFA, OAuth |
| `brain` | consciousness, cognitive, cortex, expert system |
| `cato` | safety, ethics, CBF, grounding |
| `omega` | OMEGA Protocol, Genesis, Helix Kernel, firmware |
| `orchestration` | workflow, method, pipeline, UEP |
| `data_storage` | UDS, RAWS, retention, file conversion |
| `competitive_advantage` | moat, unique feature, differentiator |
| `ui_component` | component, button, panel, design pattern |
| `dependency` | npm, package, library |
| `new_term` | new AI term, subsystem, acronym |
| `operations` | deployment, incident, scaling, performance, DR |

---

## Step 2: Look Up Required Docs

### ALWAYS Update (Every Change)
```
✅ CHANGELOG.md
```

### Think Tank Changes
```
✅ CHANGELOG.md — with platform annotation: [Web], [Mac], or [Both]
✅ docs/01-THINK-TANK.md (user guide, admin guide, tenant admin, Mac, Dojo — all in one doc)
✅ docs/15-STRATEGY-COMPETITIVE.md (if major feature)
⚠️  BIDIRECTIONAL: Web changes MUST mirror to Mac and vice versa
    See: /.windsurf/workflows/thinktank-dual-platform.md
```

### Curator Changes
```
✅ CHANGELOG.md
✅ docs/02-CURATOR.md
✅ docs/15-STRATEGY-COMPETITIVE.md (if competitive advantage)
```

### Dojo Changes
```
✅ CHANGELOG.md
✅ docs/01-THINK-TANK.md (Part XIII: Aurelius Dojo)
```

### Platform / Admin Changes
```
✅ CHANGELOG.md
✅ docs/04-RADIANT-ADMIN.md (admin, deployment, health, spend governor)
✅ docs/15-STRATEGY-COMPETITIVE.md (if major)
```

### Swift Deployer Changes
```
✅ CHANGELOG.md
✅ docs/05-SWIFT-DEPLOYER.md
```

### Think Tank Mac App Changes
```
✅ CHANGELOG.md — with platform annotation: [Mac] or [Both]
✅ docs/01-THINK-TANK.md (Parts XI-XII: Mac Guide + Portability Manifest)
⚠️  BIDIRECTIONAL: Mac changes MUST mirror to Web and vice versa
    See: /.windsurf/workflows/thinktank-dual-platform.md
```

### Architecture / CDK / Lambda Changes
```
✅ CHANGELOG.md
✅ docs/06-ARCHITECTURE-ENGINEERING.md
```

### Database Changes
```
✅ CHANGELOG.md
✅ docs/06-ARCHITECTURE-ENGINEERING.md
✅ docs/16-IMPLEMENTATION-SPECS.md (Section 07: Database Schema)
```

### AI Brain / Consciousness Changes
```
✅ CHANGELOG.md
✅ docs/07-AI-SYSTEMS.md (Brain sections)
```

### CATO Safety Changes
```
✅ CHANGELOG.md
✅ docs/07-AI-SYSTEMS.md (CATO Safety section)
```

### OMEGA / Genesis Changes
```
✅ CHANGELOG.md
✅ docs/09-OMEGA-GENESIS.md (PRIMARY — all OMEGA content here)
✅ docs/06-ARCHITECTURE-ENGINEERING.md (if architectural)
⚠️  Policy: /.windsurf/workflows/omega-docs-policy.md
```

### Orchestration / UEP Changes
```
✅ CHANGELOG.md
✅ docs/10-ORCHESTRATION-WORKFLOWS.md
```

### Data / Storage Changes
```
✅ CHANGELOG.md
✅ docs/06-ARCHITECTURE-ENGINEERING.md (Data & Storage section)
```

### API / Service Layer Changes
```
✅ CHANGELOG.md
✅ docs/12-API-REFERENCE.md
✅ docs/06-ARCHITECTURE-ENGINEERING.md (if architectural)
```

### Security / Auth / Compliance Changes
```
✅ CHANGELOG.md
✅ docs/13-SECURITY-AUTH-COMPLIANCE.md
✅ docs/04-RADIANT-ADMIN.md (if admin-configurable)
```

### Operations / Runbook Changes
```
✅ CHANGELOG.md
✅ docs/14-OPERATIONS-RUNBOOKS.md
```

### Competitive Advantage Features
```
✅ CHANGELOG.md
✅ docs/15-STRATEGY-COMPETITIVE.md
```

### New Dependencies
```
✅ CHANGELOG.md
✅ docs/18-UI-UX-LIBRARIES.md
```

### New Terms / Subsystems / Acronyms
```
✅ CHANGELOG.md
✅ docs/17-GLOSSARY.md (MANDATORY)
```

---

## Step 3: Update ALL Identified Docs

For each document identified in Step 2, add content in the appropriate Part/Section within the consolidated document.

### CHANGELOG.md Format
```markdown
## [X.X.X] - YYYY-MM-DD

### Added/Fixed/Changed

#### Feature Name

**Description of change**

- Bullet point details

**Files Modified**: `path/to/files`
```

---

## Step 4: Update Version Numbers

When updating any of the 15 consolidated documents, update the version number in the document header.

---

## Step 5: Verify Completeness

Before marking task complete, verify:

```
□ CHANGELOG.md updated
□ Relevant app doc updated (01–05) if app-facing change
□ Architecture doc (06) updated if architectural change
□ Relevant system doc updated (06–18) if system-level change
□ Glossary (17) updated if new terms/acronyms
□ Strategy (15) updated if competitive advantage
□ Version numbers updated in all touched docs
□ If Think Tank change: Mac sections in 01 updated (Parts XI-XII)
□ If Think Tank change: Dual-platform sync verified per thinktank-dual-platform.md
```

---

## Step 6: Reassemble Complete Documentation

After updating ANY documentation files, regenerate the complete assembled documentation:

```bash
python3 tools/scripts/assemble-complete-documentation.py
```

This produces:
- `docs/publications/RADIANT-THINKTANK-COMPLETE-DOCUMENTATION.md`
- `docs/publications/RADIANT-THINKTANK-COMPLETE-DOCUMENTATION.pdf`

See policy: `/.windsurf/workflows/docs-assemble-complete.md`

---

## Quick Reference Card

```
┌──────────────────────────────────────────────────────────┐
│           DOCUMENTATION UPDATE CHECKLIST (v3.0)          │
├──────────────────────────────────────────────────────────┤
│                                                          │
│  EVERY CHANGE:     ✅ CHANGELOG.md                       │
│                                                          │
│  THINK TANK+DOJO:  ✅ docs/01-THINK-TANK.md              │
│  CURATOR:          ✅ docs/02-CURATOR.md                  │
│  RADIANT ADMIN:    ✅ docs/04-RADIANT-ADMIN.md            │
│  SWIFT DEPLOYER:   ✅ docs/05-SWIFT-DEPLOYER.md           │
│                                                          │
│  ARCHITECTURE+DATA:✅ docs/06-ARCHITECTURE-ENGINEERING.md  │
│  AI+CATO SAFETY:   ✅ docs/07-AI-SYSTEMS.md               │
│  OMEGA/GENESIS:    ✅ docs/09-OMEGA-GENESIS.md             │
│  ORCHESTRATION:    ✅ docs/10-ORCHESTRATION-WORKFLOWS.md   │
│  API REFERENCE:    ✅ docs/12-API-REFERENCE.md             │
│  SECURITY/AUTH:    ✅ docs/13-SECURITY-AUTH-COMPLIANCE.md   │
│  OPERATIONS:       ✅ docs/14-OPERATIONS-RUNBOOKS.md       │
│  STRATEGY:         ✅ docs/15-STRATEGY-COMPETITIVE.md      │
│  IMPL SPECS:       ✅ docs/16-IMPLEMENTATION-SPECS.md      │
│  GLOSSARY:         ✅ docs/17-GLOSSARY.md                  │
│  UI/UX:            ✅ docs/18-UI-UX-LIBRARIES.md           │
│                                                          │
│  THEN: python3 tools/scripts/                            │
│        assemble-complete-documentation.py                │
│                                                          │
└──────────────────────────────────────────────────────────┘
```

---

## Anti-Patterns (NEVER DO)

❌ "Documentation will be updated in a follow-up"
❌ "See code for details"
❌ Only updating one document when multiple apply
❌ Updating docs without updating version numbers
❌ Waiting for user to ask about documentation
❌ **Introducing new terms/acronyms without updating 17-GLOSSARY.md**

---

**THIS POLICY IS MANDATORY. NO EXCEPTIONS. EVERY CODE CHANGE = DOCUMENTATION UPDATE.**
