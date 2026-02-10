---
description: Policy - Subsystem names must be globally unique or explicitly parent-scoped. No name collisions allowed.
---

# Subsystem Naming Policy

## Core Rule

> **A subsystem name MUST either be globally unique OR explicitly scoped by its parent.**
> **If a name appears under the wrong parent, it MUST be renamed.**

## Naming Categories

| Category | Rule | Examples |
|----------|------|---------|
| **Unique names** | Stand alone, no prefix needed | OMEGA, LIVS, SENTINEL, Delight, Curator, Dojo |
| **Scoped children** | `Parent-Child` format | CATO Genesis, Cortex Graph-RAG, OMEGA Firmware, OMEGA Quantum |
| **Misplaced names** | Rename to match actual parent | ~~Genesis App~~ → OMEGA Lab, ~~Genesis Auto-Tool~~ → Tool Forge |

## Casing Conventions

| Context | Convention | Example |
|---------|-----------|---------|
| **File names** | kebab-case | `tool-forge.service.ts`, `omega-lab/` |
| **DB tables** | snake_case | `tool_forge_requests`, `omega_brains` |
| **TypeScript types** | PascalCase | `ToolForgeRequest`, `OmegaForge` |
| **Service instances** | camelCase | `toolForge`, `economicCortex` |
| **UI labels** | Title Case | "OMEGA Lab", "Cato Genesis" |
| **Acronyms in UI/docs** | ALL CAPS | CATO, OMEGA, LIVS, SENTINEL |
| **Acronyms in file names** | lowercase | `cato/`, `omega/`, `livs/` |

## Directory Structure

Services MUST live under their parent subsystem directory:
```
lambda/shared/services/
├── cato/           # CATO subsystem (includes Genesis gates)
├── omega/          # OMEGA subsystem
├── organism/       # Organism subsystem (includes Tool Forge)
├── cortex/         # Cortex subsystem (includes Graph-RAG)
└── [subsystem]/    # Each subsystem gets its own directory
```

## Pre-Flight Checklist for New Subsystems

Before creating a new subsystem or feature:

1. **Search existing names**: `grep -r "YourProposedName" --include="*.ts" --include="*.tsx"`
2. **Check glossary**: Read `docs/17-GLOSSARY.md` for existing term definitions
3. **Verify uniqueness**: The name must NOT already be used by another subsystem
4. **Choose parent**: If this is a child feature, prefix with parent name
5. **Update glossary**: Add the new term to `docs/17-GLOSSARY.md`
6. **Update manifest**: Add triggers to `docs/DOCUMENTATION-MANIFEST.json`

## Known Exceptions (Do NOT Rename)

These are correctly scoped and must stay as-is:

| Name | Parent | Reason |
|------|--------|--------|
| **CATO Genesis** | CATO | Developmental gate system — deeply entrenched (14+ importers, 2 DB tables, triggers, RLS) |
| **Cortex Graph-RAG** | Cortex | Already properly parent-scoped |

## Completed Renames

| Old Name | New Name | Date | Migration |
|----------|----------|------|-----------|
| Genesis App | OMEGA Lab | 2026-02-09 | Directory rename |
| Genesis Forge App | OMEGA Forge | 2026-02-09 | Directory rename |
| Genesis Auto-Tool | Tool Forge | 2026-02-09 | `V2026_02_09_001__tool_forge_rename.sql` |

## Enforcement

- AI agents MUST check this policy before creating new subsystems
- Code reviewers MUST reject PRs that introduce naming collisions
- The glossary (`docs/17-GLOSSARY.md`) is the canonical source of truth for subsystem names
