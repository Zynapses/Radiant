---
description: Policy - Complete documentation must be reassembled when any documentation file changes. Generates RADIANT-THINKTANK-COMPLETE-DOCUMENTATION in .md and .pdf formats.
---

# Complete Documentation Assembly Policy

## When This Policy Applies

This policy is triggered whenever **any of the 21 documentation files** (15 consolidated + 6 standalone) is modified:

- `docs/01-THINK-TANK.md` through `docs/18-UI-UX-LIBRARIES.md`
- `CHANGELOG.md`, `README.md`, `SECURITY.md`, `CONTRIBUTING.md`, `TECHNICAL_DEBT.md`

## What It Does

Assembles ALL 21 documents (15 consolidated + 6 standalone) into a single comprehensive **"RADIANT & Think Tank — Complete Documentation"** file, available in both `.md` and `.pdf` formats.

The assembly:
1. **Logically orders** all 21 documents (apps first, then systems, then standalone)
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

## Document Structure (21 Documents: 15 Consolidated + 6 Standalone)

### App Documents (1–5)
1. **Think Tank** (`docs/01-THINK-TANK.md`) — User guide, admin guide, tenant admin, Mac, licensing, Delight, collaboration, Dojo
2. **Curator** (`docs/02-CURATOR.md`) — User guide + engineering guide
4. **Radiant Admin** (`docs/04-RADIANT-ADMIN.md`) — Platform admin, deployment, system health, spend governor, SaaS metrics
5. **Swift Deployer** (`docs/05-SWIFT-DEPLOYER.md`) — User guide + architecture

### System Documents (6–19)
6. **Architecture & Engineering** (`docs/06-ARCHITECTURE-ENGINEERING.md`) — Platform architecture, CDK, engineering vision, gateway, Data & Storage
7. **AI Systems** (`docs/07-AI-SYSTEMS.md`) — AGI brain, consciousness, cognitive, Cortex, CATO safety, ethics, GPU infra
9. **OMEGA & Genesis** (`docs/09-OMEGA-GENESIS.md`) — OMEGA Protocol, Five Pillars, quantum brain, Helix, firmware, model routing, Global Brain
10. **Orchestration & Workflows** (`docs/10-ORCHESTRATION-WORKFLOWS.md`) — Methods, reference, patterns, UEP
12. **API Reference** (`docs/12-API-REFERENCE.md`) — APIs, versioning, error codes, service layer (MCP/A2A)
13. **Security, Auth & Compliance** (`docs/13-SECURITY-AUTH-COMPLIANCE.md`) — Auth architecture, user/admin/tenant guides, MFA, OAuth
14. **Operations & Runbooks** (`docs/14-OPERATIONS-RUNBOOKS.md`) — Deployment, incidents, scaling, performance, DR, testing
15. **Strategy & Competitive** (`docs/15-STRATEGY-COMPETITIVE.md`) — Vision, moats, capabilities, pitch, revenue, tech debt
16. **Implementation Specs** (`docs/16-IMPLEMENTATION-SPECS.md`) — Sections 00–46 (full technical build specs + DB schema)
17. **Glossary** (`docs/17-GLOSSARY.md`) — Terms, definitions, acronyms
18. **UI/UX & Libraries** (`docs/18-UI-UX-LIBRARIES.md`) — Design patterns, open source dependencies
19. **Strategic Security** (`docs/19-STRATEGIC-SECURITY.md`) — Credential lifecycle security, NIST/CIS/SOC2/PCI/ISO compliance

### Standalone Documents (20–25)
20. **OMEGA Engineering** (`docs/20-OMEGA-ENGINEERING.md`) — Engineering, architecture, marketing, API reference
21. **Text-to-Speech** (`docs/21-TEXT-TO-SPEECH.md`) — TTS complete reference, ElevenLabs, voice presets
22. **Compliance Standards Guide** (`docs/22-COMPLIANCE-STANDARDS-GUIDE.md`) — SOC 2, GDPR, HIPAA, ISO 27701, ISO 42001, HDS, DPF, PCI DSS
23. **Engineering Roadmap** (`docs/23-ENGINEERING-ROADMAP.md`) — Milestones, priorities, timeline, dependencies
24. **Cartridge Specializations** (`docs/24-CARTRIDGE-SPECIALIZATIONS.md`) — Brain-mapped taxonomy, .RADz format, PKI, vault, RNIR
25. **Patents & IP Strategy** (`docs/25-PATENTS.md`) — Patent portfolio, OMEGA & Cartridge IP, provisional filings

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
- **Document count**: Currently 21 documents (15 consolidated + 6 standalone). Update this count when new documents are added.
