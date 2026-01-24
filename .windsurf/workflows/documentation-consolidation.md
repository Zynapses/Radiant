---
description: DEPRECATED - See /docs-update-all for the master documentation policy
---

# ⚠️ DEPRECATED - USE MASTER POLICY

**This policy has been superseded by `docs-update-all.md`**

Please refer to:
- **Master Policy**: `/.windsurf/workflows/docs-update-all.md`
- **Documentation Manifest**: `/docs/DOCUMENTATION-MANIFEST.json`

---

# Legacy Content (For Reference Only)

# Documentation Consolidation Policy

**MANDATORY**: All feature documentation MUST be consolidated into the appropriate guide(s). Standalone documentation files are supplementary references, NOT the primary source.

## The Problem

Creating standalone docs like `docs/FEATURE-NAME.md` without updating the consolidated guides leaves readers uninformed. The consolidated guides are the **single source of truth**.

## Primary Documentation Targets

| Documentation Type | Target Document |
|-------------------|-----------------|
| **Technical/Engineering** | `docs/ENGINEERING-IMPLEMENTATION-VISION.md` |
| **Platform Admin** | `docs/RADIANT-ADMIN-GUIDE.md` |
| **Think Tank Admin** | `docs/THINKTANK-ADMIN-GUIDE.md` |

## The Rule

When you create ANY documentation:

1. **Consolidated guides are PRIMARY** - All substantive documentation goes into:
   - `docs/ENGINEERING-IMPLEMENTATION-VISION.md` - **Technical architecture, implementation details, AWS services, libraries, visionary documentation** (for software engineers)
   - `docs/RADIANT-ADMIN-GUIDE.md` - Platform/infrastructure admin features
   - `docs/THINKTANK-ADMIN-GUIDE.md` - Think Tank user-facing features

2. **Standalone docs are SUPPLEMENTARY** - Files like `docs/FEATURE-NAME.md` provide:
   - Deep technical reference
   - API specifications
   - Code examples
   - BUT they are NOT a substitute for consolidated guide content

3. **Never create orphan documentation** - If you create `docs/FEATURE-NAME.md`:
   - You MUST also add the content to the appropriate consolidated guide
   - The guide section must be COMPLETE, not just a reference
   - Readers should NOT need to click through to understand the feature

## Engineering Documentation Requirements

**CRITICAL**: The `ENGINEERING-IMPLEMENTATION-VISION.md` document is for software engineers. It requires:

- **NEVER abbreviate or summarize to the point of losing implementation specifics**
- **NEVER omit technologies** used to implement features, architectures, or support the vision
- Full architecture explanations with diagrams
- Database table schemas with all columns
- Lambda handler file paths
- AWS service configurations
- Library versions and purposes
- Code examples showing real interfaces
- CDK stack relationships

### Technologies Must Be Documented

For every feature, architecture, or vision element, you MUST document:

| Category | Required Details |
|----------|-----------------|
| **AWS Services** | Service name, configuration, CDK stack location |
| **Libraries** | Package name, version, purpose, import path |
| **Databases** | Tables, columns, indexes, RLS policies |
| **APIs** | Endpoints, request/response formats, auth |
| **Languages** | TypeScript, Python, Swift - version requirements |
| **Frameworks** | CDK, React, Next.js, SwiftUI - versions |
| **External Services** | AI providers, third-party APIs, SaaS integrations |

**Example**: If implementing a feature using Redis for caching:
- ❌ WRONG: "Uses caching for performance"
- ✅ CORRECT: "Uses ElastiCache Redis (r6g.large) via `CatoRedisStack`, client library `ioredis@5.3.2`, session TTL 3600s"

Engineers need this detail to understand, maintain, and extend the system.

## Required Admin Guide Content

Every feature section in admin guides MUST include:

### For RADIANT-ADMIN-GUIDE.md (Infrastructure)
- Overview/purpose
- Architecture (with diagrams for complex features)
- Database schema (tables, migrations)
- Environment variables
- Implementation files
- API endpoints (if applicable)
- Monitoring/alerts
- Security considerations

### For THINKTANK-ADMIN-GUIDE.md (User-Facing)
- User experience description
- Admin configuration options
- How the feature works (step-by-step)
- Visual indicators/UI elements
- Troubleshooting

## Cross-System Documentation Rule

**CRITICAL**: Features that affect BOTH systems must be documented in BOTH guides.

### Examples of Cross-System Features

| Feature | RADIANT Admin | Think Tank Admin |
|---------|---------------|------------------|
| **Cato Persistent Memory** | ✅ Architecture, config | ✅ User-facing behavior |
| **Ghost Vectors** | ✅ Storage, infrastructure | ✅ Relationship continuity |
| **Economic Governor** | ✅ Cost policies | ✅ Savings dashboard |
| **Ego System** | ✅ Tenant config | ✅ Personality settings |
| **Model Configuration** | ✅ Provider setup | ✅ Category display |
| **Compliance Settings** | ✅ Framework selection | ✅ Content filtering |

### How to Document Cross-System Features

1. **Primary documentation** in the guide where the feature is primarily managed
2. **Secondary documentation** in the other guide explaining user-facing impact
3. **Cross-reference** between the two guides

Example:
```markdown
## Cato Persistent Memory (in RADIANT-ADMIN-GUIDE.md)
[Full architecture, database, configuration...]

> **Think Tank Impact**: See [THINKTANK-ADMIN-GUIDE-V2.md Section X] for user-facing memory behavior.
```

```markdown
## Cato Persistent Memory (in THINKTANK-ADMIN-GUIDE-V2.md)
[User-facing behavior, relationship continuity...]

> **Infrastructure**: See [RADIANT-ADMIN-GUIDE.md Section Y] for architecture and configuration.
```

## Checklist Before Marking Documentation Complete

- [ ] Admin guide section is THOROUGH (not just a summary)
- [ ] Reader can understand feature WITHOUT clicking to standalone docs
- [ ] All API endpoints documented with examples
- [ ] All database tables explained
- [ ] All configuration options listed
- [ ] **Cross-system features documented in BOTH guides**
- [ ] Cross-references added between admin guides if feature spans both

## Example: WRONG

```markdown
## 35. File Conversion
See [FILE-CONVERSION-SERVICE.md](./FILE-CONVERSION-SERVICE.md) for documentation.
```

## Example: CORRECT

```markdown
## 35. File Conversion Infrastructure

The File Conversion Service automatically converts files for AI providers...

### 35.1 Core Principle
[Full explanation here]

### 35.2 Provider Capabilities
[Complete table here]

### 35.3 Conversion Strategies
[All strategies explained]

[... complete documentation ...]

### 35.11 Additional Reference
For deep technical details and code examples, see [FILE-CONVERSION-SERVICE.md](./FILE-CONVERSION-SERVICE.md).
```

## Enforcement

This policy is enforced by:
1. This workflow file (Windsurf will follow it)
2. Code review checks
3. Build validation (future)

**NEVER** create standalone documentation without comprehensive admin guide content.
