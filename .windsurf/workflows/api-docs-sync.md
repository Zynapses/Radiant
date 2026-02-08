---
description: Policy - API documentation must be updated when admin routes change
---

# API Documentation Sync Policy

**Version:** 1.0.0
**Effective:** v7.43.0

## Rule

When ANY of the following changes are made, `docs/12-API-REFERENCE.md` MUST be updated:

1. A new route is added to `lambda/admin/handler.ts`
2. A new admin Lambda handler file is created in `lambda/admin/`
3. API Gateway routes are added to `lib/stacks/admin-stack.ts`
4. Request/response schemas change for existing endpoints
5. New query parameters or path parameters are added

## Required Documentation Format

For each endpoint, document:

```markdown
| Method | Path | Description | Auth | Request Body | Response |
|--------|------|-------------|------|-------------|----------|
| GET | /admin/example | Brief description | Admin | N/A | `{ data: ExampleType[] }` |
```

## Steps

1. Identify the new or changed route in `lambda/admin/handler.ts`
2. Read the corresponding handler file to understand the endpoint contract
3. Update `docs/12-API-REFERENCE.md` with the endpoint table entry
4. If the endpoint has complex request/response types, add a subsection with schema details
5. Update the "Last Updated" timestamp at the top of the API reference doc

## Enforcement

- Every PR that modifies `lambda/admin/handler.ts` or `lib/stacks/admin-stack.ts` MUST include corresponding `docs/12-API-REFERENCE.md` changes
- The CI pipeline should flag PRs that modify admin handler files without updating API docs

## Current Route Domains (v7.43.0)

The following route domains exist in `handler.ts` and must all be documented:

- `health`, `dashboard`, `tenants`, `users`, `administrators`, `invitations`, `approvals`
- `billing`, `audit-logs`, `models`, `providers`
- `compliance` (checklists, regulatory-standards, self-audit)
- `security` (schedules, general)
- `system` (health, gateway, config)
- `service-api-keys`, `sso-connections`, `cortex`, `oauth`, `time-machine`
- `orchestration/methods`, `pricing`, `aws-costs`
- `spend-governor`, `critical-alerts`, `intrusion-detection`, `data-lake`
- `tenant-settings`, `conversation-export`
- `ethics`, `specialty-rankings`, `agi-learning`, `internet-learning`, `enhanced-learning`
- `logs`, `consciousness` (engine, evolution), `ego`, `formal-reasoning`
- `domain-ethics`, `ethics-free-reasoning`
- `cato` (genesis, dialogue, global, catch-all)
- `model-registry`, `model-coordination`, `model-proficiency`
- `infrastructure-tier`, `library-registry`, `inference-components`
- `user-registry`, `brain`, `metrics`, `translation`, `localization`
- `cognition`, `empiricism`, `lora`, `ai-reports`, `scaling`
