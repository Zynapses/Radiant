---
description: Policy - Documentation must be updated for all user/admin-facing changes
---

# Documentation Required Policy

**This is a MANDATORY policy.** All changes that affect administrators, users, or system behavior must include comprehensive documentation updates.

## ⚠️ CRITICAL: DOCUMENTATION MUST BE PART OF IMPLEMENTATION

**Documentation is NOT a separate step.** Update docs AS YOU BUILD, not afterward.

### MANDATORY: Include in SAME implementation pass

For EVERY feature, update these IN THE SAME TASK (not later):

| If you create... | You MUST also update... |
|------------------|-------------------------|
| Database tables | `docs/sections/SECTION-07-DATABASE-SCHEMA.md` |
| Platform admin features | `docs/RADIANT-ADMIN-GUIDE.md` + `docs/STRATEGIC-VISION-MARKETING.md` |
| Think Tank admin features | `docs/THINKTANK-ADMIN-GUIDE.md` + `docs/STRATEGIC-VISION-MARKETING.md` |
| Lambda services/handlers | `docs/ENGINEERING-IMPLEMENTATION-VISION.md` (Section 5) |
| Any feature | `CHANGELOG.md` |
| Significant feature | `docs/FEATURE-NAME.md` (standalone) |

### ⚠️ AUTOMATIC: Strategic Vision Update

**When you modify `RADIANT-ADMIN-GUIDE.md` OR `THINKTANK-ADMIN-GUIDE.md`, you MUST ALSO update `docs/STRATEGIC-VISION-MARKETING.md`:**

1. Add new features to "Platform Capabilities: What's Implemented Today"
2. Move implemented features from "Upcoming" to "Implemented"
3. Update version numbers if changed
4. Add to Document History table

### Two Admin Guides

RADIANT has exactly **TWO** admin guides:

| Guide | Purpose | When to update |
|-------|---------|----------------|
| `docs/RADIANT-ADMIN-GUIDE.md` | Platform administration: tenants, billing, models, providers, security, infrastructure | Platform/infrastructure features |
| `docs/THINKTANK-ADMIN-GUIDE.md` | Think Tank administration: user rules, delight system, brain plans, pre-prompts, domains | Think Tank/consumer features |

**Update the appropriate guide based on what you're building. If a feature spans both, update both.**

### NEVER do this:
❌ "I'll update the admin guide later"  
❌ "Documentation is the last step"  
❌ Only updating CHANGELOG.md  
❌ Creating standalone doc but skipping admin guide  

### ALWAYS do this:
✅ Update RADIANT-ADMIN-GUIDE.md in the SAME implementation  
✅ Add to SECTION-07 table list when creating tables  
✅ Write docs WHILE building, not after  

**A feature is NOT complete until all documentation is updated IN THE SAME PASS.**

## When Documentation is Required

Update documentation when ANY of the following occur:

### 1. New Features
- New API endpoints
- New UI components or pages
- New configuration options
- New orchestration methods, workflows, or patterns
- New model integrations
- New admin capabilities

### 2. Changed Behavior
- Modified API request/response formats
- Changed default values or settings
- Updated business logic that affects output
- Modified permissions or access controls
- Changed pricing, billing, or cost calculations

### 3. New Database Schema
- New tables or columns that store user/admin data
- New migrations that affect behavior
- New seed data that configures defaults

### 4. Infrastructure Changes
- New CDK stacks or resources
- Changed deployment procedures
- New environment variables or configuration

## Documentation Locations

### API & Backend Changes
- Update `docs/` markdown files for the relevant system
- For API changes: Update OpenAPI/Swagger specs if present
- For Lambda handlers: Document in handler file header + `docs/`

### Admin Dashboard Changes
- Update component inline documentation
- Update `docs/ADMIN-*.md` files
- Add tooltips/help text in UI where appropriate

### Orchestration & AI Changes
- Update `docs/ORCHESTRATION-METHODS.md`
- Update `docs/SPECIALTY-RANKING.md`
- Update `docs/AGI-BRAIN-PLANNER.md` if planning logic changes

### Database Changes
- Add migration header comment explaining purpose
- Update relevant `docs/*.md` with schema changes
- Document new tables in `docs/DATABASE-SCHEMA.md` if present

## Documentation Standards

### Required Elements

1. **Purpose**: What does this feature/change do?
2. **Usage**: How do users/admins interact with it?
3. **Configuration**: What options are available?
4. **Examples**: Code snippets, API calls, or UI screenshots
5. **Defaults**: What happens with no configuration?

### Format Requirements

```markdown
## Feature Name

**Purpose**: Brief description of what this does

**Usage**: How to use this feature

### Configuration Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| option_name | string | "default" | What it controls |

### Examples

\`\`\`typescript
// Example code or API call
\`\`\`

### Related Documentation
- Link to related docs
```

## Enforcement Checklist

Before completing ANY feature or change, verify:

- [ ] Is this change visible to users or admins? → Document it
- [ ] Does this change system behavior? → Document it
- [ ] Does this add new configuration? → Document it
- [ ] Does this change existing configuration? → Document it
- [ ] Have you updated ALL relevant doc files?
- [ ] Have you included examples?
- [ ] Have you documented defaults and edge cases?

## Required Documentation Locations by Change Type

### Database Changes (new tables/columns)
| Location | Required |
|----------|----------|
| `docs/sections/SECTION-07-DATABASE-SCHEMA.md` | ✅ Always - Add to canonical table list |
| `CHANGELOG.md` | ✅ Always |
| Standalone `docs/*.md` | If significant feature |

### Admin Dashboard Features
| Location | Required |
|----------|----------|
| `docs/RADIANT-ADMIN-GUIDE.md` | ✅ Always - Add new section with full documentation |
| `CHANGELOG.md` | ✅ Always |
| Standalone `docs/*.md` | ✅ For significant features |
| `docs/sections/SECTION-07-DATABASE-SCHEMA.md` | If new tables |

### Think Tank / User-Facing Features
| Location | Required |
|----------|----------|
| Standalone `docs/*.md` | ✅ Always |
| `docs/RADIANT-ADMIN-GUIDE.md` | If admin-configurable |
| `CHANGELOG.md` | ✅ Always |
| `docs/sections/SECTION-07-DATABASE-SCHEMA.md` | If new tables |

### API Changes
| Location | Required |
|----------|----------|
| API handler file header comments | ✅ Always |
| Standalone `docs/*.md` | ✅ For new APIs |
| `CHANGELOG.md` | ✅ Always |

### Service Layer Changes
| Location | Required |
|----------|----------|
| Relevant feature `docs/*.md` | ✅ Always |
| `CHANGELOG.md` | ✅ Always |

## Documentation Quality Standards

Documentation must be **comprehensive**, not just a summary:

1. **Purpose** - What does this feature do and why?
2. **Usage** - How do users/admins interact with it?
3. **Configuration** - All available options with defaults
4. **Database Schema** - Tables and columns with descriptions
5. **API Endpoints** - Full request/response documentation
6. **Examples** - Code snippets, UI screenshots, typical workflows
7. **Integration** - How does this connect to other features?

## Examples of Required Documentation

### Adding a New API Endpoint

```markdown
## POST /api/v2/new-feature

Creates a new feature instance.

**Request Body:**
\`\`\`json
{
  "name": "string",
  "config": { ... }
}
\`\`\`

**Response:**
\`\`\`json
{
  "id": "uuid",
  "status": "created"
}
\`\`\`

**Errors:**
- 400: Invalid configuration
- 403: Insufficient permissions
```

### Adding a New Admin Setting

```markdown
## New Setting: Enable Feature X

**Location**: Admin Dashboard → Settings → Features

**Purpose**: Controls whether Feature X is available to users

**Options**:
- `enabled` (default: false): Activates the feature
- `threshold`: Minimum value to trigger (default: 10)

**Impact**: When enabled, users will see...
```

## Consequences of Missing Documentation

- PR/changes should not be considered complete without documentation
- Undocumented features are harder to support and maintain
- Users/admins cannot effectively use features they don't know about
- Future developers cannot understand or modify the system safely

---

**Remember**: If a user or admin might ask "how does this work?" or "what does this do?", it needs documentation.
