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

# Think Tank User Guide Update Policy

**MANDATORY**: When modifying ANY user-facing feature in Think Tank, you MUST update `docs/THINKTANK-USER-GUIDE.md`.

## Scope

This policy applies when creating or modifying:

| Change Type | User Guide Section to Update |
|-------------|------------------------------|
| UI components or pages | Relevant feature section |
| User configuration options | Configuration section |
| AI behavior changes | Understanding AI Decisions |
| Governance/safety features | Safety & Governance section |
| Collaboration features | Collaboration section |
| Delight/personality features | Personalization section |
| Navigation changes | Navigation & UI section |
| New user rules | My Rules section |
| Domain mode changes | Domain Modes section |
| Any user-visible behavior | Appropriate section |

## Required Documentation Elements

When documenting a user-facing feature, include:

1. **What It Is** - Brief description of the feature
2. **How To Use It** - Step-by-step instructions
3. **What It Does** - Expected behavior and outcomes
4. **Configuration Options** - Any user-adjustable settings
5. **Visual Indicators** - UI elements, icons, badges explained
6. **Tips & Best Practices** - Helpful guidance

## Update Checklist

Before marking any user-facing change complete:

- [ ] Feature documented in THINKTANK-USER-GUIDE.md
- [ ] Screenshots or UI descriptions updated (if UI changed)
- [ ] Configuration options documented
- [ ] Any new terminology explained
- [ ] Navigation path to feature documented
- [ ] Related features cross-referenced

## File Location

**User Guide**: `docs/THINKTANK-USER-GUIDE.md`

## Relationship to Other Documentation

| Document | Audience | Purpose |
|----------|----------|---------|
| THINKTANK-USER-GUIDE.md | **End Users** | How to use Think Tank |
| THINKTANK-ADMIN-GUIDE.md | Administrators | How to configure Think Tank |
| RADIANT-ADMIN-GUIDE.md | Platform Admins | Platform-level configuration |

**The User Guide is for END USERS, not administrators.** Focus on:
- How to use features
- What to expect from the AI
- How to personalize the experience
- Understanding AI decisions and safety

## Examples

### Good: Feature Documentation
```markdown
## My Rules

My Rules let you set personal preferences for how Think Tank responds to you.

### Creating a Rule
1. Navigate to **My Rules** from the sidebar
2. Click **Add Custom Rule**
3. Enter a summary (e.g., "Prefer concise answers")
4. Write the detailed rule text
5. Select a rule type
6. Click **Create Rule**

### Rule Types
- **Preference** - General response preferences
- **Restriction** - Things to avoid
- **Format** - Response structure preferences
...
```

### Bad: Missing User Context
```markdown
## My Rules
The user rules API allows creating and managing rules.
POST /api/thinktank/user-rules with ruleText parameter.
```

## NEVER

- Skip user guide updates for "small" UI changes
- Use technical API documentation instead of user-friendly explanations
- Assume users understand internal terminology
- Leave placeholder text like "TBD" or "Coming soon"

## Invoke

When working on Think Tank user-facing features, automatically follow this policy. No explicit invocation needed.
