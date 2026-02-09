---
description: Policy - Think Tank changes must be evaluated for both web and Mac platforms
---

# Think Tank Dual-Platform Sync Policy v2.0

> **MANDATORY — NO EXCEPTIONS — BLOCKING GATE**
>
> Any change to Think Tank on ANY platform MUST be mirrored to the other platform
> in the SAME task, or the task is NOT complete.
>
> This policy is BIDIRECTIONAL: Web changes trigger Mac changes AND Mac changes trigger Web changes.

---

## HARD RULES (Violation = Incomplete Task)

```
RULE 1: You CANNOT add a user-facing feature to Web without implementing it on Mac.
RULE 2: You CANNOT add a user-facing feature to Mac without implementing it on Web.
RULE 3: You CANNOT change a Think Tank API without updating BOTH API clients.
RULE 4: You CANNOT change a data model in TypeScript without updating the Swift equivalent.
RULE 5: You CANNOT change a data model in Swift without updating the TypeScript equivalent.
RULE 6: You CANNOT mark a task complete without updating the Portability Manifest.
RULE 7: You CANNOT skip this policy. There is no "small change" exception.
```

**If a mirror implementation is technically impossible in the current session**, you MUST:
1. Throw a descriptive error explaining the blocker
2. Add `// PLATFORM-SYNC-BLOCKED: [reason] — [date]` comment at the change site
3. Add a row to Known Gaps in `docs/THINKTANK-MAC-PORTABILITY-MANIFEST.md`
4. Add a `[PLATFORM-SYNC-PENDING]` entry in CHANGELOG.md
5. Get explicit user approval to proceed without the mirror

---

## Scope — When This Policy Fires

This policy is triggered by ANY modification to:

| Path | Platform | Description |
|------|----------|-------------|
| `apps/thinktank/` | Web | Think Tank web app (Next.js) |
| `apps/thinktank-mac/` | Mac | Think Tank Mac app (Swift) |
| `packages/infrastructure/lambda/thinktank*/` | Shared | Think Tank Lambda handlers |
| `packages/shared/src/types/*thinktank*` | Shared | Shared TypeScript types |
| Any Think Tank API endpoint | Shared | REST API contracts |
| `docs/THINKTANK-MAC-PORTABILITY-MANIFEST.md` | Docs | Portability manifest |
| `docs/THINKTANK-MAC-GUIDE.md` | Docs | Mac user documentation |

---

## Step 1: Classify the Change

Before writing any code, classify:

| Question | Answer | Action Required |
|----------|--------|----------------|
| Is this a user-facing feature? | Yes | **BOTH platforms** — implement on both |
| Is this an API endpoint change? | Yes | **BOTH clients** — update TypeScript + Swift |
| Is this a data model change? | Yes | **BOTH languages** — update TS types + Swift structs |
| Is this admin-only? | Yes | **Web only** — document as excluded in manifest |
| Is this a macOS-specific OS feature? | Yes | **Mac only** — document as Mac advantage in manifest |
| Is this purely cosmetic CSS? | Yes | **Adapt** — find SwiftUI equivalent, document adaptation |

---

## Step 2: Implement Bidirectionally

### Direction: Web -> Mac

```
1. Implement the web change in apps/thinktank/
2. IMMEDIATELY implement the Mac equivalent in apps/thinktank-mac/
3. If the feature uses a new API:
   a. Update apps/thinktank-mac/Sources/ThinkTankMac/Services/ with the new endpoint
   b. Update apps/thinktank-mac/Sources/ThinkTankMac/Models/CoreTypes.swift if new types
4. If the feature uses new UI patterns:
   a. Find the SwiftUI equivalent (see Technology Adaptation Map in Portability Manifest)
   b. Implement using native macOS patterns
```

### Direction: Mac -> Web

```
1. Implement the Mac change in apps/thinktank-mac/
2. IMMEDIATELY implement the web equivalent in apps/thinktank/
3. If the feature uses a new API:
   a. Update apps/thinktank/lib/api/ with the new endpoint
   b. Update apps/thinktank/lib/api/types.ts if new types
4. If the feature uses macOS-specific APIs:
   a. Find the web equivalent (see Technology Adaptation Map in reverse)
   b. Implement using web-standard patterns
```

### Direction: API / Backend Change

```
1. Implement the Lambda/API change
2. Update the TypeScript API client: apps/thinktank/lib/api/
3. Update the Swift API client: apps/thinktank-mac/Sources/ThinkTankMac/Services/
4. Update TypeScript types: apps/thinktank/lib/api/types.ts
5. Update Swift types: apps/thinktank-mac/Sources/ThinkTankMac/Models/CoreTypes.swift
```

---

## Step 3: Update the Portability Manifest

**EVERY Think Tank change requires a manifest check.**

File: `docs/THINKTANK-MAC-PORTABILITY-MANIFEST.md`

Actions:
- **New feature**: Add a row to the Feature Parity Matrix (correct Tier)
- **Modified feature**: Update the status column and notes
- **New technology used**: Add a row to the Technology Adaptation Map
- **New gap discovered**: Add a row to Known Gaps & Planned Work
- **Gap resolved**: Remove from Known Gaps, update Feature Parity Matrix status
- **Update version and date** at the top of the manifest

---

## Step 4: Update Documentation

### ALWAYS Update (Every Think Tank Change):

```
✅ CHANGELOG.md — with platform annotation: [Web], [Mac], or [Both]
✅ docs/THINKTANK-MAC-PORTABILITY-MANIFEST.md — Feature Parity Matrix
✅ docs/01-THINK-TANK.md — if user-facing feature changed
✅ docs/THINKTANK-MAC-GUIDE.md — if Mac user experience changed
```

### If API Changed:

```
✅ docs/12-API-REFERENCE.md — endpoint documentation
✅ Both platform API client code (TypeScript + Swift)
✅ Both platform type definitions (types.ts + CoreTypes.swift)
```

### If New Feature Added:

```
✅ docs/THINKTANK-MAC-PORTABILITY-MANIFEST.md — new row in Feature Parity Matrix
✅ Determine tier (1/2/3) and assign status
✅ Both platform implementations (or document blocker per Hard Rules)
```

---

## Step 5: CHANGELOG Format

```markdown
### Think Tank: Feature Name [Both]
- **Web**: Description of web implementation
- **Mac**: Description of Mac implementation
- **Manifest**: Row added/updated in Portability Manifest

### Think Tank: Feature Name [Web Only]
- **Web**: Description
- **Excluded from Mac because**: [specific reason — must reference manifest]
- **Manifest row**: E# in Excluded Features table

### Think Tank: Feature Name [Mac Only]
- **Mac**: Description of Mac-specific advantage
- **Not applicable to Web because**: [specific reason]
- **Manifest row**: Updated in Feature Parity Matrix

### Think Tank: Feature Name [PLATFORM-SYNC-PENDING]
- **Implemented on**: [Web/Mac]
- **BLOCKED on**: [Mac/Web] — [blocker description]
- **Tracking**: Known Gap G# in Portability Manifest
- **Approval**: [user approved proceeding without mirror — date]
```

---

## Step 6: Pre-Completion Gate (BLOCKING)

**You CANNOT mark the task as complete until ALL boxes are checked:**

```
□ Feature implemented on BOTH platforms (or blocker documented per Hard Rules)
□ Feature Parity Matrix in Portability Manifest is current
□ No new feature exists on one platform without a corresponding row on the other
□ API endpoints match between TypeScript and Swift clients
□ Data models are consistent between TypeScript and Swift
□ CHANGELOG.md has platform annotation ([Web], [Mac], [Both], or [PLATFORM-SYNC-PENDING])
□ docs/01-THINK-TANK.md updated if user-facing
□ docs/THINKTANK-MAC-GUIDE.md updated if Mac UX changed
□ Portability Manifest version and date updated
```

**If ANY box is unchecked, the task is NOT complete. Go back and fix it.**

---

## Anti-Patterns (NEVER DO — Treat as Build Failures)

```
❌ Add a web feature without implementing the Mac equivalent
❌ Add a Mac feature without implementing the web equivalent
❌ Change a Think Tank API without updating BOTH clients
❌ Change types.ts without updating CoreTypes.swift (or vice versa)
❌ Log a Think Tank change without a platform annotation
❌ Skip this policy because "it's a small change"
❌ Say "I'll implement the mirror later"
❌ Assume a web UI pattern translates directly to SwiftUI without checking
❌ Leave the Portability Manifest stale
❌ Mark a task complete with unchecked gate items
```

---

## Quick Reference

```
Think Tank Web       → apps/thinktank/
Think Tank Mac       → apps/thinktank-mac/
Web Types            → apps/thinktank/lib/api/types.ts
Mac Types            → apps/thinktank-mac/Sources/ThinkTankMac/Models/CoreTypes.swift
Web API Client       → apps/thinktank/lib/api/client.ts + chat.ts
Mac API Client       → apps/thinktank-mac/Sources/ThinkTankMac/Services/APIClient.swift
Web Stores           → apps/thinktank/lib/stores/
Mac Stores           → apps/thinktank-mac/Sources/ThinkTankMac/Stores/
Shared Backend       → packages/infrastructure/lambda/thinktank/ (42 handlers)
Shared Types         → packages/shared/src/types/
Portability Manifest → docs/THINKTANK-MAC-PORTABILITY-MANIFEST.md
Mac User Guide       → docs/THINKTANK-MAC-GUIDE.md
```
