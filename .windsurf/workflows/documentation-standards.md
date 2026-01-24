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

This workflow defines **mandatory documentation requirements** for all RADIANT feature implementations.

## Core Principle

**Documentation is NOT a separate step. Update docs AS YOU BUILD.**

Every feature implementation MUST include documentation updates in the SAME implementation pass. Do not create PRs or complete features without documentation.

---

## Documentation Files to Update

### Required for ALL Features

| If creating... | MUST update... |
|----------------|----------------|
| Database tables/migrations | `docs/sections/SECTION-07-DATABASE-SCHEMA.md` |
| Platform admin features | `docs/RADIANT-ADMIN-GUIDE.md` **+ Strategic Vision** |
| Think Tank admin features | `docs/THINKTANK-ADMIN-GUIDE.md` **+ Strategic Vision** |
| Any feature | `CHANGELOG.md` |
| Significant feature | Standalone `docs/FEATURE-NAME.md` |
| API endpoints | Include in admin guide + `docs/api/` |
| Security features | Include in admin guide security section |

### ⚠️ AUTOMATIC: Strategic Vision Update

**EVERY time you modify `RADIANT-ADMIN-GUIDE.md` OR `THINKTANK-ADMIN-GUIDE.md`, you MUST ALSO update:**

**`docs/STRATEGIC-VISION-MARKETING.md`**

| Change Type | Strategic Vision Update Required |
|-------------|----------------------------------|
| New feature implemented | Add to "Platform Capabilities: What's Implemented Today" section |
| Planned feature completed | Move from "Upcoming" to "Implemented Today" |
| Version bump | Update version in document header |
| Any admin guide change | Add entry to Document History table |

**This is NOT optional.** The Strategic Vision document is customer-facing marketing material that must accurately reflect platform capabilities.

### Two Admin Guides (use correct one)

| Guide | Purpose | When to update |
|-------|---------|----------------|
| `docs/RADIANT-ADMIN-GUIDE.md` | Platform: tenants, billing, models, providers, security, infrastructure | Platform features |
| `docs/THINKTANK-ADMIN-GUIDE.md` | Think Tank: user rules, delight, brain plans, pre-prompts, domains | Think Tank features |

If a feature spans both, **update both guides**.

---

## Documentation Quality Standards

### NEVER Reduce Detail

Documentation must be **thorough and comprehensive**. Do NOT:
- Summarize complex procedures into single sentences
- Skip edge cases or error handling documentation
- Omit configuration options or parameters
- Remove existing documentation to "simplify"
- Use placeholder text like "TBD" or "Coming soon"

### ALWAYS Include

For every feature, documentation MUST include:

1. **Overview/Purpose** - What the feature does and why it exists
2. **Architecture** - How it fits into the system (diagrams for complex features)
3. **Configuration** - All settings, defaults, and valid values
4. **Procedures** - Step-by-step instructions for common operations
5. **API Reference** - All endpoints with request/response examples
6. **Database Schema** - Tables, columns, constraints, indexes
7. **Security Considerations** - Permissions, compliance, audit logging
8. **Error Handling** - Common errors and resolution steps
9. **Examples** - Real-world usage scenarios
10. **Troubleshooting** - Known issues and solutions

### Format Standards

```markdown
## Feature Name

> **Version Note**: Introduced in v4.18.XX

### Overview

[2-3 paragraph explanation of the feature]

### Architecture

[Diagram if applicable]

```
┌──────────┐     ┌──────────┐     ┌──────────┐
│  Input   │ ──▶ │ Process  │ ──▶ │  Output  │
└──────────┘     └──────────┘     └──────────┘
```

### Configuration

| Setting | Default | Description | Valid Values |
|---------|---------|-------------|--------------|
| `setting_name` | `default` | What it does | Range/options |

### Procedures

#### Creating a [Thing]

1. Navigate to **Section → Subsection**
2. Click **"+ Create"**
3. Fill in the required fields:
   - **Field 1**: Description
   - **Field 2**: Description
4. Click **"Save"**

### API Reference

#### `POST /api/endpoint`

Creates a new resource.

**Request Body:**
```json
{
  "field1": "value",
  "field2": 123
}
```

**Response:**
```json
{
  "success": true,
  "data": { ... }
}
```

**Error Responses:**
| Code | Meaning |
|------|---------|
| 400 | Validation error |
| 401 | Unauthorized |
| 409 | Conflict |

### Database Schema

```sql
CREATE TABLE table_name (
    id UUID PRIMARY KEY,
    field1 VARCHAR(255) NOT NULL,
    field2 INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
```

### Security Considerations

- **Access Control**: Who can access this feature
- **Audit Logging**: What actions are logged
- **Compliance**: Relevant frameworks (HIPAA, SOC2, GDPR)

### Troubleshooting

| Issue | Cause | Resolution |
|-------|-------|------------|
| Error message | Why it happens | How to fix |
```

---

## Pre-Commit Checklist

Before marking any feature complete, verify:

- [ ] CHANGELOG.md updated with feature entry
- [ ] Appropriate admin guide(s) updated
- [ ] **Strategic Vision document updated** (if admin guide changed)
- [ ] Database schema documentation updated (if tables added)
- [ ] API documentation complete (if endpoints added)
- [ ] Security considerations documented
- [ ] All configuration options documented with defaults
- [ ] Step-by-step procedures included
- [ ] Error handling documented
- [ ] No placeholder text remaining
- [ ] Version number updated in guide header

---

## Enforcement

**Pull requests without documentation updates will be rejected.**

When reviewing code, explicitly verify documentation completeness before approval.

---

## Examples of Good Documentation

See these sections as reference:
- `docs/RADIANT-ADMIN-GUIDE.md` Section 4 (Tenant Management)
- `docs/THINKTANK-ADMIN-GUIDE.md` Section 24 (Ego System)

---

## Anti-Patterns (DO NOT DO)

❌ "See code for details"
❌ "Documentation to follow"
❌ Single-sentence feature descriptions
❌ Skipping error handling documentation
❌ Not updating CHANGELOG
❌ Only updating CHANGELOG without admin guide
❌ Reducing existing documentation detail
❌ Using generic/vague descriptions
❌ Omitting security considerations
❌ Missing API request/response examples
