---
description: Policy - Think Tank changes must be evaluated for both web and Mac platforms
---

# Think Tank Dual-Platform Sync Policy

> ⚠️ **MANDATORY: Any Think Tank feature change must be evaluated for BOTH platforms** ⚠️

---

## When This Policy Applies

This policy applies when ANY of the following are modified:

- `apps/admin-dashboard/` — Think Tank web UI components
- `apps/thinktank-mac/` — Think Tank Mac app
- `packages/infrastructure/lambda/thinktank/` — Think Tank Lambda handlers
- `apps/admin-dashboard/components/thinktank/` — Think Tank web components
- Any Think Tank API endpoint or data model in `@radiant/shared`

---

## Step 1: Identify Platform Scope

Before making the change, determine:

| Question | If Yes |
|----------|--------|
| Does this change a user-facing feature? | Both platforms must be updated |
| Does this change an API endpoint? | Both platforms must be updated |
| Does this change a data model / type? | Both platforms must be updated |
| Is this a web-specific UI pattern? | Web only — document in "Web-Only Features" |
| Is this a macOS-specific feature? | Mac only — document the Mac advantage |
| Is this an admin-only feature? | Web only — Mac has no admin UI |

---

## Step 2: Make the Change

### If BOTH platforms need updating:

```
1. Implement the web change first (or Mac change if requested)
2. Implement the mirror change on the other platform
3. If the second platform cannot be updated in this session:
   a. Add a TODO comment: // TODO: Mirror to [Mac/Web] — [feature description]
   b. Update the Feature Parity Matrix in THINKTANK-MAC-GUIDE.md
   c. Note the gap in CHANGELOG.md
```

### If SINGLE platform only:

```
1. Implement the change
2. Document WHY it's single-platform in THINKTANK-MAC-GUIDE.md
3. Add to the appropriate table (Web-Only or Mac advantage)
```

---

## Step 3: Update Documentation

### Always Update:

```
✅ CHANGELOG.md — with platform annotation: [Web], [Mac], or [Both]
✅ docs/THINKTANK-MAC-GUIDE.md — Feature Parity Matrix status column
✅ docs/THINKTANK-USER-GUIDE.md — if user-facing feature changed
```

### If API Changed:

```
✅ docs/THINKTANK-MAC-GUIDE.md — Section 4 (API Endpoints Used)
✅ Both platform API client code
```

### If New Feature Added:

```
✅ docs/THINKTANK-MAC-GUIDE.md — Add row to Feature Parity Matrix
✅ Determine tier (1/2/3) and assign status
```

---

## Step 4: CHANGELOG Format

When logging Think Tank changes, always annotate the platform:

```markdown
### Think Tank: Feature Name [Both]
- Web: Description of web implementation
- Mac: Description of Mac implementation

### Think Tank: Feature Name [Web]
- Web-only feature because: [reason]
- Mac parity status: 🔲 Planned / ❌ Not applicable

### Think Tank: Feature Name [Mac]
- Mac-only advantage: [description]
```

---

## Step 5: Verify Sync

Before marking the task complete:

```
□ Feature Parity Matrix in THINKTANK-MAC-GUIDE.md is current
□ No Think Tank feature exists on web without a corresponding Mac row
□ No "🔲 Planned" items exist that should have been built
□ API endpoints match between web and Mac API clients
□ CHANGELOG.md has platform annotations
□ Data models are consistent between TypeScript and Swift
```

---

## Anti-Patterns (NEVER DO)

❌ Add a web feature without checking the Feature Parity Matrix
❌ Add a Mac feature without updating THINKTANK-MAC-GUIDE.md
❌ Change a Think Tank API without evaluating both clients
❌ Log a Think Tank change without a platform annotation
❌ Skip this policy because "it's a small change"
❌ Assume a web UI pattern translates directly to SwiftUI

---

## Quick Reference

```
Think Tank Web  → apps/admin-dashboard/ + components/thinktank/
Think Tank Mac  → apps/thinktank-mac/
Shared Backend  → packages/infrastructure/lambda/thinktank/ (42 handlers)
Shared Types    → packages/shared/src/types/
Sync Guide      → docs/THINKTANK-MAC-GUIDE.md (Feature Parity Matrix)
```
