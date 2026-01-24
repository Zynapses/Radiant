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

# Think Tank Admin Documentation Policy

**MANDATORY**: All Think Tank Admin features, changes, and updates MUST be documented in `docs/THINKTANK-ADMIN-GUIDE-V2.md`.

## Application Separation

Think Tank Admin is a **separate application** from RADIANT Platform Admin:

| Application | Documentation |
|-------------|---------------|
| **RADIANT Platform Admin** (`apps/admin-dashboard/`) | `docs/RADIANT-ADMIN-GUIDE.md` |
| **Think Tank Admin** (`apps/thinktank-admin/`) | `docs/THINKTANK-ADMIN-GUIDE-V2.md` |

## When This Policy Applies

Document in `THINKTANK-ADMIN-GUIDE-V2.md` when:

1. Adding pages to `apps/thinktank-admin/`
2. Creating Lambda handlers in `lambda/thinktank/`
3. Adding routes to `ThinkTankAdminApiStack`
4. Modifying Think Tank consumer-facing features
5. Changing Think Tank API endpoints
6. Updating user-facing AI behavior

## Required Documentation Content

Every feature section MUST include:

### Minimum Requirements

- **Path**: URL path in the app (e.g., `/users`)
- **App File**: Full path to page.tsx
- **Overview**: What the feature does
- **Features**: Bullet list of capabilities
- **API Endpoints**: Table with Method, Endpoint, Purpose
- **Implementation**: Lambda file, service file, database tables

### Full Documentation Template

```markdown
## N. Feature Name

**Path**: `/feature-path`  
**App File**: `apps/thinktank-admin/app/(dashboard)/feature/page.tsx`

### Overview

[What the feature does and why it exists]

### Features

- Feature 1
- Feature 2
- Feature 3

### API Endpoints

| Method | Endpoint | Purpose |
|--------|----------|---------|
| GET | `/api/thinktank/feature` | List items |
| POST | `/api/thinktank/feature` | Create item |

### Implementation

- **Lambda**: `lambda/thinktank/feature.ts`
- **Service**: `lambda/shared/services/feature.service.ts`
- **Database**: `feature_table`
```

## Checklist Before Completion

- [ ] Section added to Table of Contents
- [ ] Path matches actual app route
- [ ] App File path is correct and file exists
- [ ] All API endpoints documented
- [ ] Lambda handler file path correct
- [ ] Database tables mentioned if applicable
- [ ] Implementation files verified to exist

## What Goes Where

| Content Type | Document |
|--------------|----------|
| Think Tank user management | `THINKTANK-ADMIN-GUIDE-V2.md` |
| Think Tank conversations | `THINKTANK-ADMIN-GUIDE-V2.md` |
| AI behavior customization | `THINKTANK-ADMIN-GUIDE-V2.md` |
| Delight/gamification | `THINKTANK-ADMIN-GUIDE-V2.md` |
| Artifacts/GenUI | `THINKTANK-ADMIN-GUIDE-V2.md` |
| Shadow testing | `THINKTANK-ADMIN-GUIDE-V2.md` |
| Economic Governor | `THINKTANK-ADMIN-GUIDE-V2.md` |
| Tenant management | `RADIANT-ADMIN-GUIDE.md` |
| Billing/subscriptions | `RADIANT-ADMIN-GUIDE.md` |
| Model configuration | `RADIANT-ADMIN-GUIDE.md` |
| Infrastructure tiers | `RADIANT-ADMIN-GUIDE.md` |
| Compliance frameworks | `RADIANT-ADMIN-GUIDE.md` |
| CDK/AWS infrastructure | `ENGINEERING-IMPLEMENTATION-VISION.md` |

## Cross-System Documentation Rule

**CRITICAL**: Features that affect BOTH RADIANT and Think Tank must be documented in BOTH guides.

### Examples of Cross-System Features

| Feature | Think Tank Admin | RADIANT Admin |
|---------|------------------|---------------|
| **Cato Persistent Memory** | ✅ User relationship behavior | ✅ Architecture, config |
| **Ghost Vectors** | ✅ Relationship continuity UI | ✅ Storage, infrastructure |
| **Economic Governor** | ✅ Savings dashboard | ✅ Cost policies |
| **Ego System** | ✅ Personality settings | ✅ Tenant config |
| **Model Categories** | ✅ Category display | ✅ Provider setup |
| **Compliance** | ✅ Content filtering | ✅ Framework selection |

### How to Document Cross-System Features

1. **Primary documentation** in the guide where the feature is primarily managed
2. **Secondary documentation** in the other guide explaining the impact
3. **Cross-reference** between the two guides

Example cross-reference:
```markdown
## Economic Governor (in THINKTANK-ADMIN-GUIDE-V2.md)
[User-facing savings dashboard, mode switching...]

> **Infrastructure**: See [RADIANT-ADMIN-GUIDE.md Section X] for cost policies and budget configuration.
```

## NEVER

- Document Think Tank features only in RADIANT-ADMIN-GUIDE.md
- Create standalone docs without updating THINKTANK-ADMIN-GUIDE-V2.md
- Leave API endpoints undocumented
- Skip Implementation section
- Use placeholder text like "TBD" or "TODO"
- **Document cross-system features in only ONE guide**

## Related Policies

- `/documentation-consolidation` - General documentation policy
- `/cdk-infrastructure-sync` - CDK update requirements
