---
description: Policy - Complete documentation must be reassembled when any documentation file changes. Generates RADIANT-THINKTANK-COMPLETE-DOCUMENTATION in .md and .pdf formats.
---

# Complete Documentation Assembly Policy

## When This Policy Applies

This policy is triggered whenever **any of the 18 consolidated documentation files** is modified:

- `docs/01-THINK-TANK.md` through `docs/18-UI-UX-LIBRARIES.md`
- `CHANGELOG.md`, `README.md`, `SECURITY.md`, `CONTRIBUTING.md`, `TECHNICAL_DEBT.md`

## What It Does

Assembles ALL 18 consolidated documents into a single comprehensive **"RADIANT & Think Tank — Complete Documentation"** file, available in both `.md` and `.pdf` formats.

The assembly:
1. **Logically orders** all 18 consolidated documents (apps first, then systems)
2. Adds **Part/Chapter structure** with page breaks
3. Generates a **Table of Contents** from the structure
4. Includes **assembly statistics** (parts, chapters, lines)
5. Outputs to `docs/publications/`

## Output Files

| File | Format | Description |
|------|--------|-------------|
| `docs/publications/RADIANT-THINKTANK-COMPLETE-DOCUMENTATION.md` | Markdown | Complete assembled documentation |
| `docs/publications/RADIANT-THINKTANK-COMPLETE-DOCUMENTATION.pdf` | PDF | Print-ready version (via pandoc) |

## How to Run

// turbo
1. Run the assembly script:

```bash
python3 tools/scripts/assemble-complete-documentation.py
```

## Prerequisites

- **Python 3.10+** (available on all dev machines)
- **pandoc** (for PDF generation): `brew install pandoc`
- **LaTeX** (for PDF via pandoc): `brew install --cask mactex-no-gui` or `brew install basictex`
  - If LaTeX is not available, the script still generates the `.md` file successfully

## Document Structure (18 Consolidated Documents)

### App Documents (1–5)
1. **Think Tank** — User guide, admin guide, tenant admin, Mac, licensing, Delight, collaboration
2. **Curator** — User guide + engineering guide
3. **Dojo** — Aurelius Dojo training system
4. **Radiant Admin** — Platform admin, deployment, system health, spend governor, SaaS metrics
5. **Swift Deployer** — User guide + architecture

### System Documents (6–18)
6. **Architecture & Engineering** — Platform architecture, CDK, engineering vision, gateway
7. **AI Brain Systems** — AGI brain, consciousness, cognitive, Cortex memory
8. **CATO Safety** — Safety system, ADRs, runbooks, GPU infra, trainer, ethics
9. **OMEGA & Genesis** — OMEGA Protocol, Genesis Forge/Lab, Resonant Index
10. **Orchestration & Workflows** — Methods, reference, patterns, UEP
11. **Data & Storage** — UDS, RAWS, data retention, file conversion
12. **API Reference** — APIs, versioning, error codes, service layer (MCP/A2A)
13. **Security, Auth & Compliance** — Auth architecture, user/admin/tenant guides, MFA, OAuth
14. **Operations & Runbooks** — Deployment, incidents, scaling, performance, DR, testing
15. **Strategy & Competitive** — Vision, moats, capabilities, pitch, revenue, tech debt
16. **Implementation Specs** — Sections 00–46 (full technical build specs + DB schema)
17. **Glossary** — Terms, definitions, acronyms
18. **UI/UX & Libraries** — Design patterns, open source dependencies

### Plus Root-Level Files
- `CHANGELOG.md`, `README.md`, `SECURITY.md`, `CONTRIBUTING.md`, `TECHNICAL_DEBT.md`

## Archive

Original 244 documentation files are preserved in `docs/archive/`:
- `docs/archive/pre-consolidation/` — full snapshot before merge
- `docs/archive/build-artifacts/` — old generated docs
- `docs/archive/code-exports/` — code snapshots
- `docs/archive/historical/` — reports, gap analyses, proposals

## Policy Enforcement

- **AI agents**: After completing documentation updates, remind the user that the complete documentation should be reassembled
- **CI/CD**: The assembly script can be added to CI to auto-generate on merge to main
- **The generated files should NOT be committed to git** — they are build artifacts
