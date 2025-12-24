# RADIANT Build Rules

You are building RADIANT v4.17.0, a multi-tenant AWS SaaS platform.

## Core Principles

1. **Never ask clarifying questions** - all specs are in docs/sections/
2. **Follow file creation order** - dependencies are explicitly stated
3. **Use constants** - RADIANT_VERSION, DOMAIN_PLACEHOLDER, never hardcode
4. **Match types exactly** - Section 0 defines all shared types
5. **Complete each phase fully** before moving to next

## When Implementing a Phase

1. Read the phase file from docs/phases/
2. For each section in the phase, read from docs/sections/
3. Create files in the specified order
4. Verify compilation before proceeding
5. Mark phase complete only when all sections done

## File Naming Conventions

- Swift: PascalCase (e.g., `DeploymentService.swift`)
- TypeScript: kebab-case (e.g., `deployment-stack.ts`)
- Lambdas: kebab-case with `-handler` suffix
- Migrations: NNN_description.sql (e.g., `001_initial_schema.sql`)

## Error Handling

- Swift: Use `DeploymentError` enum with associated values
- TypeScript: Throw typed errors with context
- Lambda: Return `{ statusCode, body: JSON.stringify({ error }) }`

## Database Rules

- All tables need RLS policies
- Use `app.current_tenant_id` for tenant context
- Migrations must be idempotent (IF NOT EXISTS)
- Foreign keys reference shared types

## Do Not

- Split single files across multiple artifacts
- Skip sections within a phase
- Use placeholder implementations
- Hardcode configuration values
- Ignore the file creation order
