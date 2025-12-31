---
description: Policy - All standalone documentation must be consolidated into admin guides
---

# Documentation Consolidation Policy

**MANDATORY**: All feature documentation MUST be consolidated into the appropriate admin guide(s). Standalone documentation files are supplementary references, NOT the primary source.

## The Problem

Creating standalone docs like `docs/FEATURE-NAME.md` without updating admin guides leaves readers uninformed. The admin guides are the **single source of truth** for administrators.

## The Rule

When you create ANY documentation:

1. **Admin guides are PRIMARY** - All substantive documentation goes into:
   - `docs/RADIANT-ADMIN-GUIDE.md` - Platform/infrastructure features
   - `docs/THINKTANK-ADMIN-GUIDE.md` - Think Tank user-facing features

2. **Standalone docs are SUPPLEMENTARY** - Files like `docs/FEATURE-NAME.md` provide:
   - Deep technical reference
   - API specifications
   - Code examples
   - BUT they are NOT a substitute for admin guide content

3. **Never create orphan documentation** - If you create `docs/FEATURE-NAME.md`:
   - You MUST also add the content to the appropriate admin guide
   - The admin guide section must be COMPLETE, not just a reference
   - Readers should NOT need to click through to understand the feature

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

## Checklist Before Marking Documentation Complete

- [ ] Admin guide section is THOROUGH (not just a summary)
- [ ] Reader can understand feature WITHOUT clicking to standalone docs
- [ ] All API endpoints documented with examples
- [ ] All database tables explained
- [ ] All configuration options listed
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
