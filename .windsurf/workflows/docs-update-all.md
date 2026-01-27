---
description: MANDATORY - Update ALL relevant documentation on ANY code change. This is the MASTER documentation policy.
---

# Master Documentation Policy

> ⚠️ **THIS POLICY IS MANDATORY AND HAS NO EXCEPTIONS** ⚠️
>
> **Every code change requires documentation updates.** This policy replaces all previous fragmented documentation policies.

---

## The Golden Rule

**If you change code, you MUST update documentation. Period.**

Do NOT:
- ❌ Say "I'll update docs later"
- ❌ Update only CHANGELOG.md
- ❌ Skip any applicable documentation
- ❌ Require the user to remind you

---

## Step 1: Identify Change Type

Before making ANY code change, identify what type of change it is:

| Change Type | Keywords to Look For |
|-------------|---------------------|
| `database` | migration, table, column, schema, SQL |
| `lambda` | handler, service, Lambda function |
| `api_endpoint` | route, endpoint, API, REST |
| `cdk` | stack, CDK, infrastructure, AWS resource |
| `thinktank_feature` | Think Tank, chat, UI, morphing, liquid |
| `thinktank_admin` | admin config, user rules, delight, domains |
| `platform_feature` | tenant, billing, models, providers |
| `user_facing` | UI component, user interaction, visible to user |
| `ui_component` | component, button, panel, view, design |
| `orchestration` | workflow, method, pipeline, execution |
| `security` | auth, permission, HIPAA, compliance, encryption |
| `billing` | credits, subscription, pricing, invoice |
| `models` | AI model, provider, LLM, self-hosted |
| `dependency` | npm, package, library, import |
| `consciousness` | ego, affect, consciousness, identity |
| `cato` | safety, genesis, ethics, CBF |
| `cortex` | memory, blackboard, context |
| `architecture` | service, pattern, design, system |
| `competitive_advantage` | moat, unique feature, differentiator |
| `deployer` | Swift app, deployment, domain URL, tier, installation |
| `mcp` | Model Context Protocol, MCP server, tools, resources |
| `a2a` | Agent-to-Agent, A2A protocol, agent registry |
| `api_keys` | API key, interface type, scopes, key validation |
| `gateway` | Go gateway, NATS, WebSocket, SSE, protocol |
| `service_layer` | MCP worker, A2A worker, Cedar policy |

---

## Step 2: Look Up Required Docs

Use the trigger matrix to find ALL required documentation:

### ALWAYS Update (Every Change)
```
✅ CHANGELOG.md
```

### Database Changes
```
✅ CHANGELOG.md
✅ docs/sections/SECTION-07-DATABASE-SCHEMA.md
✅ docs/RADIANT-PLATFORM-ARCHITECTURE.md
✅ Relevant admin guide (RADIANT or THINKTANK)
```

### Lambda/Service Changes
```
✅ CHANGELOG.md
✅ docs/ENGINEERING-IMPLEMENTATION-VISION.md
✅ docs/RADIANT-PLATFORM-ARCHITECTURE.md
```

### API Endpoint Changes
```
✅ CHANGELOG.md
✅ docs/ENGINEERING-IMPLEMENTATION-VISION.md
✅ docs/API_REFERENCE.md
✅ docs/RADIANT-PLATFORM-ARCHITECTURE.md
✅ Relevant admin guide
```

### CDK/Infrastructure Changes
```
✅ CHANGELOG.md
✅ docs/ENGINEERING-IMPLEMENTATION-VISION.md
✅ docs/RADIANT-PLATFORM-ARCHITECTURE.md
```

### Think Tank Features
```
✅ CHANGELOG.md
✅ docs/THINKTANK-USER-GUIDE.md
✅ docs/THINKTANK-ADMIN-GUIDE.md
✅ docs/THINKTANK-ADMIN-GUIDE-V2.md
✅ docs/STRATEGIC-VISION-MARKETING.md (if major)
```

### Platform Features
```
✅ CHANGELOG.md
✅ docs/RADIANT-ADMIN-GUIDE.md
✅ docs/STRATEGIC-VISION-MARKETING.md
✅ docs/ENGINEERING-IMPLEMENTATION-VISION.md (if technical)
```

### User-Facing UI Changes
```
✅ CHANGELOG.md
✅ docs/THINKTANK-USER-GUIDE.md
✅ docs/UI-UX-PATTERNS.md (if new pattern)
```

### Competitive Advantage Features
```
✅ CHANGELOG.md
✅ docs/THINKTANK-MOATS.md (Think Tank advantages)
✅ docs/RADIANT-MOATS.md (Platform advantages)
✅ docs/STRATEGIC-VISION-MARKETING.md
```

### New Dependencies
```
✅ CHANGELOG.md
✅ docs/OPEN-SOURCE-LIBRARIES.md
```

### Swift Deployer Changes
```
✅ CHANGELOG.md
✅ docs/SWIFT-DEPLOYER-USER-GUIDE.md
✅ docs/RADIANT-ADMIN-GUIDE.md (if affects deployment options)
```

### Service Layer Changes (MCP, A2A, API)
```
✅ CHANGELOG.md
✅ docs/SERVICE-LAYER-GUIDE.md
✅ docs/RADIANT-PLATFORM-ARCHITECTURE.md
✅ docs/RADIANT-ADMIN-GUIDE.md (if admin-configurable)
✅ docs/ENGINEERING-IMPLEMENTATION-VISION.md (if architectural)
```

---

## Step 3: Update ALL Identified Docs

For each document identified in Step 2:

### CHANGELOG.md Format
```markdown
## [X.X.X] - YYYY-MM-DD

### Added/Fixed/Changed

#### Feature Name

**Description of change**

- Bullet point details
- More details

**Files Modified**: `path/to/files`
```

### Admin Guide Format
```markdown
### Feature Name (vX.X.X)

**Purpose**: What this does

**Configuration**:
| Setting | Default | Description |
|---------|---------|-------------|
| option | value | what it does |

**Usage**:
1. Step one
2. Step two

**API** (if applicable):
- `GET /api/endpoint` - description
```

### User Guide Format
```markdown
### Feature Name

**What it does**: Plain language description for end users

**How to use it**:
1. Navigate to...
2. Click...
3. Result...

**Tips**: Helpful hints
```

### Engineering Guide Format
```markdown
## Section Number. Feature Name (vX.X.X)

### X.1 Overview

Technical description

### X.2 Architecture

```
[ASCII diagram]
```

### X.3 Implementation

| Component | Location | Purpose |
|-----------|----------|---------|
| File | path | what it does |

### X.4 Code Example

```typescript
// example code
```
```

---

## Step 4: Update Version Numbers

When updating these documents, also update the version number in the header:

- `docs/RADIANT-ADMIN-GUIDE.md`
- `docs/THINKTANK-ADMIN-GUIDE.md`
- `docs/THINKTANK-ADMIN-GUIDE-V2.md`
- `docs/THINKTANK-USER-GUIDE.md`
- `docs/STRATEGIC-VISION-MARKETING.md`
- `docs/ENGINEERING-IMPLEMENTATION-VISION.md`
- `docs/RADIANT-PLATFORM-ARCHITECTURE.md`
- `docs/SWIFT-DEPLOYER-USER-GUIDE.md`
- `docs/SERVICE-LAYER-GUIDE.md`

---

## Step 5: Verify Completeness

Before marking task complete, verify:

```
□ CHANGELOG.md updated
□ All admin guides updated (if admin-facing)
□ User guide updated (if user-facing)
□ Engineering guide updated (if technical)
□ Strategic vision updated (if major feature)
□ Moats updated (if competitive advantage)
□ Database schema updated (if new tables)
□ Platform architecture updated (if architectural change)
□ Swift Deployer guide updated (if deployer changes)
□ Service Layer guide updated (if MCP, A2A, API, gateway changes)
□ Version numbers updated in all touched docs
```

---

## The Documentation Manifest

A machine-readable manifest exists at:
```
docs/DOCUMENTATION-MANIFEST.json
```

This file contains:
- All primary and secondary documentation files
- Trigger keywords for each document
- The complete trigger matrix

Use this manifest to programmatically determine which docs need updating.

---

## Quick Reference Card

```
┌─────────────────────────────────────────────────────────────────────────┐
│                    DOCUMENTATION UPDATE CHECKLIST                        │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  FOR EVERY CHANGE:                                                       │
│  ✅ CHANGELOG.md                                                         │
│                                                                          │
│  FOR THINK TANK CHANGES:                                                 │
│  ✅ THINKTANK-USER-GUIDE.md (user-facing)                               │
│  ✅ THINKTANK-ADMIN-GUIDE.md (admin-facing)                             │
│  ✅ THINKTANK-ADMIN-GUIDE-V2.md (admin-facing)                          │
│                                                                          │
│  FOR PLATFORM CHANGES:                                                   │
│  ✅ RADIANT-ADMIN-GUIDE.md                                              │
│                                                                          │
│  FOR MAJOR FEATURES:                                                     │
│  ✅ STRATEGIC-VISION-MARKETING.md                                       │
│  ✅ ENGINEERING-IMPLEMENTATION-VISION.md                                │
│                                                                          │
│  FOR DATABASE CHANGES:                                                   │
│  ✅ sections/SECTION-07-DATABASE-SCHEMA.md                              │
│  ✅ RADIANT-PLATFORM-ARCHITECTURE.md                                    │
│                                                                          │
│  FOR COMPETITIVE ADVANTAGES:                                             │
│  ✅ THINKTANK-MOATS.md or RADIANT-MOATS.md                              │
│                                                                          │
│  FOR SERVICE LAYER (MCP, A2A, API):                                      │
│  ✅ SERVICE-LAYER-GUIDE.md                                              │
│  ✅ RADIANT-PLATFORM-ARCHITECTURE.md                                    │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## Anti-Patterns (NEVER DO)

❌ "Documentation will be updated in a follow-up"
❌ "See code for details"
❌ Only updating one document when multiple apply
❌ Updating docs without updating version numbers
❌ Waiting for user to ask about documentation
❌ Skipping user guide for user-facing changes
❌ Skipping admin guide for admin-facing changes
❌ Forgetting STRATEGIC-VISION-MARKETING.md when updating admin guides

---

## Why This Matters

1. **User Trust**: Users rely on documentation to understand features
2. **Maintainability**: Future developers need accurate docs
3. **Compliance**: Some docs are legally required (HIPAA, SOC2)
4. **Marketing**: Strategic vision is customer-facing
5. **Competitive Advantage**: Moats docs track our differentiation

---

**THIS POLICY IS MANDATORY. NO EXCEPTIONS. EVERY CODE CHANGE = DOCUMENTATION UPDATE.**
