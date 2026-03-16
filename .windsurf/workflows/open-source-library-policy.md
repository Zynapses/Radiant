---
description: Policy - Open source libraries must be documented when added or removed
---

# Open Source Library Documentation Policy

**MANDATORY**: This workflow MUST be executed when ANY open source library is added or removed from the codebase.

## When to Trigger

This policy is triggered when:
- A new dependency is added to any `package.json` or `Package.swift`
- A dependency is removed from any `package.json` or `Package.swift`
- A dependency version is significantly upgraded (major version)

---

## Step 1: Identify the Library

Gather the following information:

| Field | Description | Required |
|-------|-------------|----------|
| **Full Name** | npm package name or Swift package name | ✅ |
| **Description** | What the library does (1 sentence) | ✅ |
| **License** | SPDX license identifier (MIT, Apache-2.0, etc.) | ✅ |
| **Date Added** | Date in YYYY-MM-DD format | ✅ |
| **Category** | Which category it belongs to | ✅ |

---

## Step 2: Check License Compatibility

### ✅ Auto-Approved Licenses (Commercial-Friendly)

| License | SPDX | Notes |
|---------|------|-------|
| MIT License | MIT | Most permissive |
| Apache License 2.0 | Apache-2.0 | Patent grant included |
| ISC License | ISC | Simplified MIT |
| BSD 2-Clause | BSD-2-Clause | Permissive |
| BSD 3-Clause | BSD-3-Clause | Permissive |
| CC0 1.0 | CC0-1.0 | Public domain |
| Unlicense | Unlicense | Public domain |

### ⚠️ Requires Legal Review

| License | SPDX | Concern |
|---------|------|---------|
| LGPL 2.1 | LGPL-2.1-only | Dynamic linking usually OK |
| LGPL 3.0 | LGPL-3.0-only | Dynamic linking usually OK |
| MPL 2.0 | MPL-2.0 | File-level copyleft |
| EPL 2.0 | EPL-2.0 | Weak copyleft |

### 🔶 Requires Flagging (Document Justification)

| License | SPDX | Flag | Concern |
|---------|------|------|--------|
| GPL 2.0 | GPL-2.0-only | 🔶 COPYLEFT | Strong copyleft - document isolation |
| GPL 3.0 | GPL-3.0-only | 🔶 COPYLEFT | Strong copyleft - document isolation |
| AGPL 3.0 | AGPL-3.0-only | 🔶 COPYLEFT | Network copyleft - document usage |
| SSPL | SSPL-1.0 | 🚨 NON-COMMERCIAL | Service-level copyleft |
| Commons Clause | — | 🚨 NON-COMMERCIAL | Non-commercial restriction |
| Any "Non-Commercial" | — | 🚨 NON-COMMERCIAL | Cannot use commercially without review |
| Proprietary | — | ❓ UNKNOWN | Requires paid license verification |
| Unknown | — | ❓ UNKNOWN | Must verify before production |

**Note**: These licenses are NOT automatically blocked. They require documentation in the "Flagged Libraries" section with justification and review.

---

## Step 3: Categorize the Library

| Category | Description | Examples |
|----------|-------------|----------|
| **RADIANT Platform Internal** | Infrastructure, AWS, database | AWS SDK, pg, redis |
| **Think Tank Internal** | UI components, React, Next.js | Radix UI, TanStack Query |
| **Orchestration / User** | Document processing, media, AI | mammoth, pdf-parse, yjs |
| **CLI** | Command-line tools | commander, inquirer, chalk |
| **Swift** | macOS deployer | GRDB.swift |
| **Development & Testing** | Dev-only tools | vitest, eslint, typescript |

---

## Step 4: Update Documentation

### For New Libraries

1. Open `docs/18-UI-UX-LIBRARIES.md`
2. Find the appropriate category section
3. Add a new row to the table:

```markdown
| `library-name` | Description of what it does | LICENSE | YYYY-MM-DD | ✅ |
```

4. If license requires review, add appropriate flag: `⚠️`, `🔶`, `🚨`, or `❓`
5. If flagged, add entry to "Flagged Libraries" section with justification

### For Removed Libraries

1. Remove the row from `docs/18-UI-UX-LIBRARIES.md`
2. Add entry to "Removal History" section:

```markdown
| `library-name` | Category | YYYY-MM-DD | Reason for removal |
```

---

## Step 5: Document Flagged Licenses

If you encounter a library with a non-permissive license:

1. **Add to the library table** with appropriate flag
2. **Add to "Flagged Libraries" section** in `docs/18-UI-UX-LIBRARIES.md`:
   ```markdown
   | `library-name` | LICENSE | 🔶 FLAG | Justification for use | Your Name | YYYY-MM-DD |
   ```
3. **Document isolation strategy** (if copyleft)
4. **Consider alternatives** if available
5. **Escalate to legal** if uncertain about compliance

---

## Verification Checklist

Before completing, verify:

- [ ] Library is added to `docs/18-UI-UX-LIBRARIES.md`
- [ ] All fields are filled in (Name, Description, License, Date, Flag)
- [ ] License is identified and flagged appropriately
- [ ] Category is correct
- [ ] If removed, added to Removal History

---

## Quick Reference: Common Libraries

### Already Approved (Just Add to Docs)

| Library | License | Category |
|---------|---------|----------|
| Any `@aws-sdk/*` | Apache-2.0 | RADIANT Platform |
| Any `@radix-ui/*` | MIT | Think Tank |
| Any `@tanstack/*` | MIT | Think Tank |
| Any `@types/*` | MIT | Development |

### Known Safe Alternatives

| Instead of | Use | Reason |
|------------|-----|--------|
| `moment` (deprecated) | `date-fns` | MIT, smaller |
| `request` (deprecated) | `node-fetch` or native | MIT |
| `lodash` (full) | `lodash-es` or native | MIT, tree-shakeable |

---

## Policy Enforcement

This policy is **MANDATORY**. Any PR that adds or removes dependencies without updating `docs/18-UI-UX-LIBRARIES.md` will be flagged for review.

### NEVER

- Add a library without checking its license
- Add a flagged library without documenting justification
- Skip documentation when adding dependencies
- Remove a library without adding to Removal History
- Use a library with unknown license in production

---

## How to Find License Information

1. **npm**: `npm view <package> license`
2. **GitHub**: Check `LICENSE` file in repo root
3. **package.json**: Look for `license` field
4. **SPDX**: https://spdx.org/licenses/

If license is unclear, flag as `❓ UNKNOWN` and verify before production use.
