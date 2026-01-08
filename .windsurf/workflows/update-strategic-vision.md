---
description: Update strategic vision document when admin guides change
---

# Update Strategic Vision Document

**MANDATORY**: This workflow MUST be executed whenever `RADIANT-ADMIN-GUIDE.md` or `THINKTANK-ADMIN-GUIDE.md` is modified.

## When to Trigger

This workflow is triggered when ANY of the following files are modified:
- `docs/RADIANT-ADMIN-GUIDE.md`
- `docs/THINKTANK-ADMIN-GUIDE.md`

## Steps

1. **Review the change** - Understand what was added or modified in the admin guide(s)

2. **Update `docs/STRATEGIC-VISION-MARKETING.md`** with the relevant changes:
   
   - If a **new feature** was added:
     - Add it to the "Platform Capabilities: What's Implemented Today" section
     - Mark status as "✅ Live"
     - Include a brief description
   
   - If a **planned feature** was implemented:
     - Move it from "Upcoming" to "Implemented Today" section
     - Update status from "📋 Documented" to "✅ Live"
   
   - If a **strategic enhancement** (Grimoire, Time-Travel, Governor, Sentinels, Council) was implemented:
     - Update its status in the roadmap
     - Add implementation details to the feature section
     - Update the competitive positioning table if relevant
   
   - If **version numbers** changed:
     - Update the version in the document header
     - Add entry to Document History table

3. **Verify consistency** - Ensure the strategic vision document accurately reflects the current state of both platforms

4. **Update Document History** - Add a new row with the current date and a brief description of changes

## Example Update

If adding "New Feature X" to Think Tank Admin Guide:

```markdown
<!-- In STRATEGIC-VISION-MARKETING.md -->

### Think Tank (Consumer AI Layer)

| Category | Feature | Status | Description |
|----------|---------|--------|-------------|
| ... | ... | ... | ... |
| **New Category** | New Feature X | ✅ Live | Brief description of what it does |
```

## Important Notes

- **Never reduce detail** - Only add information, don't summarize or remove existing content
- **Keep marketing language** - This document is customer-facing, use benefit-focused language
- **Update metrics** if implementation provides new measurable outcomes
- **Cross-reference** - Link to the specific admin guide section for technical details
