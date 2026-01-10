---
description: Policy - All builds, features, and metadata changes must be tracked in version files
---

# Auto-Build Change Tracking Policy

**This is a MANDATORY policy.** All changes to features, functionality, or metadata must be recorded in the project's version tracking files.

## Required Updates

**⚠️ CRITICAL: Documentation is part of the build, not a separate step.**

See also: `/documentation-required` and `/documentation-standards` workflows.

When making ANY of the following changes, you MUST update the corresponding files:

### 1. Feature Changes → Update CHANGELOG.md

Any new feature, changed behavior, or bug fix must be added to `CHANGELOG.md`:

```markdown
## [Unreleased] or [X.Y.Z] - YYYY-MM-DD

### Added
- **Feature Name** (`path/to/file.ts`) - Description of new feature

### Changed
- **Component Name** - Description of behavior change

### Fixed
- **Bug Description** - What was fixed and where
```

**Location**: `/CHANGELOG.md`

### 2. New Releases → Update VERSION_HISTORY.json

When preparing a release, update `VERSION_HISTORY.json` with:

```json
{
  "packageVersion": "X.Y.Z",
  "radiantVersion": "X.Y.Z",
  "thinktankVersion": "A.B.C",
  "releaseDate": "YYYY-MM-DDTHH:MM:SSZ",
  "releaseType": "major|minor|patch",
  "changes": {
    "radiant": {
      "touched": true|false,
      "features": ["Feature 1", "Feature 2"],
      "checksumHash": "sha256:..."
    },
    "thinktank": {
      "touched": true|false,
      "features": ["Feature 1"],
      "checksumHash": "sha256:..."
    }
  }
}
```

**Location**: `/VERSION_HISTORY.json`

### 3. Version Bumps → Update Version Files

When version changes, update ALL version files:

| File | Content |
|------|---------|
| `/VERSION` | Package version (e.g., `4.18.0`) |
| `/RADIANT_VERSION` | Radiant component version |
| `/THINKTANK_VERSION` | Think Tank component version |

### 4. Database Changes → Migration Metadata

New migrations must include header comments:

```sql
-- Migration: NNN_description.sql
-- Date: YYYY-MM-DD
-- Author: Name
-- Purpose: Brief description of what this migration does
-- Affects: Tables/features affected
```

### 5. Feature Documentation → Update Admin Guides

**All user/admin-facing features MUST have documentation updated in the SAME implementation pass:**

| If you create... | You MUST also update... |
|------------------|-------------------------|
| Platform admin features | `docs/RADIANT-ADMIN-GUIDE.md` |
| Think Tank features | `docs/THINKTANK-ADMIN-GUIDE.md` |
| Orchestration methods/workflows | `docs/THINKTANK-ADMIN-GUIDE.md` Section 34 |
| Any significant feature | `docs/STRATEGIC-VISION-MARKETING.md` |

**This is NOT optional.** A feature is incomplete without documentation.

## When to Apply This Policy

| Change Type | CHANGELOG | VERSION_HISTORY | Version Files | Admin Guide |
|-------------|-----------|-----------------|---------------|-------------|
| New feature | ✅ Required | On release | On release | ✅ Required |
| Bug fix | ✅ Required | On release | On release | If behavior changes |
| Behavior change | ✅ Required | On release | On release | ✅ Required |
| New API endpoint | ✅ Required | On release | On release | ✅ Required |
| New migration | ✅ Required | On release | On release | If user-facing |
| Config change | ✅ Required | On release | On release | ✅ Required |
| UI component | ✅ Required | On release | On release | ✅ Required |
| Orchestration method | ✅ Required | On release | On release | ✅ Required |
| Documentation only | Optional | No | No | N/A |
| Refactor (no behavior change) | Optional | No | No | No |

## Enforcement Checklist

Before completing ANY feature or change:

- [ ] Have you added an entry to `CHANGELOG.md` under the appropriate section?
- [ ] Does the changelog entry include the file path for new features?
- [ ] For releases: Is `VERSION_HISTORY.json` updated with all features?
- [ ] For releases: Are all version files (`VERSION`, `RADIANT_VERSION`, `THINKTANK_VERSION`) updated?
- [ ] For migrations: Does the SQL file have proper header comments?

## CHANGELOG Entry Format

### For New Features
```markdown
- **Feature Name** (`package/path/to/main/file.ts`)
  - Sub-feature or detail 1
  - Sub-feature or detail 2
```

### For Bug Fixes
```markdown
- **Component**: Fixed description of the bug (`path/to/file.ts`)
```

### For Changed Behavior
```markdown
- **Component**: Changed X from Y to Z behavior
```

## Automation Scripts

Use the provided scripts when possible:

```bash
# Bump version (updates all version files)
./tools/scripts/bump-version.sh [major|minor|patch]

# Generate changelog from commits
./tools/scripts/generate-changelog.sh

# Build package (validates versions)
./tools/scripts/build-package.sh
```

## Consequences of Missing Updates

- Changes without changelog entries are incomplete
- Releases without VERSION_HISTORY updates break rollback chains
- Version file mismatches cause deployment failures
- Missing migration metadata makes debugging difficult

---

**Remember**: Every user-visible or behavior-changing modification must be traceable through the version history.
