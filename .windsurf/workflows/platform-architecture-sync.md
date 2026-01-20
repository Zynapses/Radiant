---
description: Policy - RADIANT-PLATFORM-ARCHITECTURE.md must be updated when architectural changes are made
---

# Platform Architecture Documentation Sync Policy

## Purpose

The `docs/RADIANT-PLATFORM-ARCHITECTURE.md` document is the **authoritative reference** for RADIANT's complete system architecture. It must stay synchronized with all architectural changes.

## When This Policy Applies

Update `RADIANT-PLATFORM-ARCHITECTURE.md` whenever you:

| Change Type | Section to Update |
|-------------|-------------------|
| New database migrations | Part 3.2 (Database Migration Order) |
| New Lambda functions | Part 1.2 or 3.4 (Lambda Functions) |
| New admin dashboard pages | Part 3.3 (Admin Dashboard Pages) |
| New API endpoints | Part 4 (API Reference) |
| New services in `lambda/shared/services/` | Part 1.12 or Part 2 |
| CDK stack changes | Part 1.1 (Infrastructure Foundation) |
| New AI providers/models | Part 1.4 (External AI Providers) |
| Self-hosted model changes | Part 1.3 (Self-Hosted Models) |
| Cato/Genesis safety changes | Part 1.6 (Genesis Cato Safety) |
| Routing/War Room changes | Part 1.9-1.10 (Routing, War Room) |
| New major features (PROMPT-XX) | Add new section to Part 2 |
| File structure changes | Appendix B (File Structure) |

## Required Updates

### 1. For New Features (PROMPT-XX)

Add a new section under **Part 2: NEW IN VERSION 5.0** with:
- Purpose description
- Database tables
- Key configuration structures
- Architecture diagrams (ASCII)

### 2. For New API Endpoints

Add to **Part 4: API REFERENCE** following the format:
```
GET    /api/path/to/endpoint    Description
POST   /api/path/to/endpoint    Description
```

### 3. For New Migrations

Add to **Part 3.2 Database Migration Order**:
```
X. **VXXXX_XX_XX_XXX** - Description
```

### 4. For New Lambda Functions

Add to appropriate table in **Part 1.2** or **Part 3.4**:
```
| `function-name` | Schedule/Trigger | Purpose |
```

### 5. For File Structure Changes

Update **Appendix B: FILE STRUCTURE** tree diagram.

## Checklist

Before completing any architectural work, verify:

- [ ] `RADIANT-PLATFORM-ARCHITECTURE.md` updated with new components
- [ ] Version number updated if major feature
- [ ] API endpoints documented if new
- [ ] Database tables listed if new migrations
- [ ] File paths in Appendix B accurate

## Related Policies

- `/documentation-required` - General documentation requirements
- `/documentation-standards` - Documentation format standards
- `/update-strategic-vision` - Marketing document updates

## Example

When implementing PROMPT-37 with new orchestration features:

1. Add new section `## 2.8 [Feature Name]` in Part 2
2. Add new migrations to Part 3.2
3. Add new API endpoints to Part 4
4. Add new Lambda functions to Part 3.4
5. Update Appendix B file structure
6. Bump document version at bottom

---

**This policy is MANDATORY for all architectural changes to RADIANT.**
