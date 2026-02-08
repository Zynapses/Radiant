#!/usr/bin/env python3
"""
RADIANT Documentation Consolidation Script
===========================================
Consolidates 244 documentation files into 18 well-organized documents.

Steps:
1. Archive all current docs to docs/archive/pre-consolidation/
2. Triage build artifacts, exports, reports to docs/archive/ subdirs
3. Merge source docs into 18 consolidated documents
4. Detect and report redundancy
5. Purge originals from docs/
6. Clean up empty directories

Usage:
    python3 tools/scripts/consolidate-documentation.py
"""

import os
import re
import shutil
import datetime
import hashlib
from pathlib import Path
from collections import defaultdict

ROOT = Path(__file__).resolve().parent.parent.parent
DOCS = ROOT / "docs"
ARCHIVE = DOCS / "archive"
ARCHIVE_PRE = ARCHIVE / "pre-consolidation"
ARCHIVE_ARTIFACTS = ARCHIVE / "build-artifacts"
ARCHIVE_EXPORTS = ARCHIVE / "code-exports"
ARCHIVE_HISTORICAL = ARCHIVE / "historical"

# ============================================================================
# TRIAGE: Files that go straight to archive (not merged, not reference docs)
# ============================================================================

TRIAGE_TO_ARTIFACTS = [
    "docs/publications/01-RADIANT-ARCHITECTURE.md",
    "docs/publications/02-THINK-TANK-ARCHITECTURE.md",
    "docs/publications/03-AGI-WORKFLOW-ORCHESTRATION.md",
    "docs/publications/04-COMPLETE-FEATURES-LIST.md",
    "docs/publications/05-EXECUTIVE-SUMMARY.md",
    "docs/publications/06-SERVICES-REFERENCE.md",
    "docs/publications/07-DATABASE-SCHEMA.md",
    "docs/publications/08-SWIFT-DEPLOYER.md",
    "docs/publications/09-ADMIN-DASHBOARD.md",
    "docs/publications/10-COMPLIANCE.md",
    "docs/publications/11-SIMULTANEOUS-EXECUTION.md",
    "docs/publications/RADIANT-COMBINED.md",
    "docs/publications/RADIANT-COMPLETE.md",
    "docs/publications/RADIANT-FULL-DOCUMENTATION.md",
    "docs/publications/RADIANT-THINKTANK-COMPLETE-DOCUMENTATION.md",
    "docs/RADIANT-THINKTANK-COMPLETE-DOCUMENTATION.md",
    "docs/RADIANT-COMPLETE-DOCUMENTATION.md",
    "docs/RADIANT-PROMPT-32-v4.17.0-AI-OPTIMIZED.md",
    "docs/prompts/RADIANT-PROMPT-35-MISSION-CONTROL-HITL.md",
]

TRIAGE_TO_EXPORTS = [
    "docs/exports/GEMINI-WORKFLOW-CONSULTATION.md",
    "docs/exports/GLOSSARY-FEEDBACK-RESPONSE.md",
    "docs/exports/GRIMOIRE-GOVERNOR-EVALUATION.md",
    "docs/exports/GRIMOIRE-GOVERNOR-SOURCE-PART1.md",
    "docs/exports/GRIMOIRE-GOVERNOR-SOURCE-PART2.md",
    "docs/exports/GRIMOIRE-GOVERNOR-SOURCE-PART3.md",
    "docs/exports/GRIMOIRE-GOVERNOR-SOURCE-PART4.md",
    "docs/exports/GRIMOIRE-GOVERNOR-SOURCE-PART5.md",
    "docs/exports/RADIANT-ADMIN-DASHBOARD.md",
    "docs/exports/RADIANT-CDK-STACKS.md",
    "docs/exports/RADIANT-COMPLETE-INDEX.md",
    "docs/exports/RADIANT-DATABASE-MIGRATIONS.md",
    "docs/exports/RADIANT-FLYTE-WORKFLOWS.md",
    "docs/exports/RADIANT-LAMBDA-HANDLERS.md",
    "docs/exports/RADIANT-SHARED-TYPES.md",
    "docs/exports/RADIANT-SWIFT-DEPLOYER.md",
    "docs/exports/SWIFT-SOURCE-CODE-PART1.md",
    "docs/exports/SWIFT-SOURCE-CODE-PART2.md",
    "docs/exports/SWIFT-SOURCE-CODE-PART3.md",
]

TRIAGE_TO_HISTORICAL = [
    "docs/reports/CONSOLIDATION-AUDIT-2026-02-04.md",
    "docs/reports/DEVELOPMENT-SPRINT-REPORT-2026-01-18.md",
    "docs/reports/DOCUMENTATION-SOURCE-AUDIT-2026-02-03.md",
    "docs/reports/EXECUTIVE-CHANGE-REPORT-2026-01-24.md",
    "docs/progress/2025-01-15-CATO-GENESIS-SYSTEM.md",
    "docs/SESSION-CHANGES-2024-12-28.md",
    "docs/20-HOUR-SPRINT-SUMMARY.md",
    "docs/CHANGES-20HR-SUMMARY.md",
    "docs/CHANGES-20H.md",
    "docs/MANAGEMENT-REPORT-2026-01-10.md",
    "docs/THINKTANK-ADMIN-API-GAP-ANALYSIS.md",
    "docs/THINKTANK-CONSUMER-GAP-ANALYSIS.md",
    "docs/THINKTANK-CODE-CHECK.md",
    "docs/CDK-HANDLER-GAP-ANALYSIS.md",
    "docs/UI-AUDIT-REPORT.md",
    "docs/COMPREHENSIVE-AUDIT-REPORT.md",
    "docs/specs/UEP-V2-REGULATORY-COMPLIANCE-AUDIT.md",
    "docs/specs/UEP-V2-SPECIFICATION.md",
    "docs/proposals/LLM-INTEGRITY-VERIFICATION-PROPOSAL.md",
    "docs/proposals/SPEND-GOVERNOR-DESIGN.md",
    "docs/proposals/SYSTEM-ADMIN-BOOTSTRAP-DESIGN.md",
    "docs/proposals/SYSTEM-ADMIN-SEPARATION-PROPOSAL.md",
    "docs/proposals/DEPLOYER-SIMPLIFICATION-PROPOSAL.md" if (ROOT / "docs/proposals/DEPLOYER-SIMPLIFICATION-PROPOSAL.md").exists() else None,
    "docs/DEPLOYER-SIMPLIFICATION-PROPOSAL.md",
    "docs/architecture/USER-DATA-TIERED-STORAGE-PROPOSAL.md",
]

# Remove None entries
TRIAGE_TO_HISTORICAL = [f for f in TRIAGE_TO_HISTORICAL if f is not None]

# ============================================================================
# MERGE PLAN: 18 consolidated documents
# ============================================================================

MERGE_PLAN = [
    {
        "target": "01-THINK-TANK.md",
        "title": "Think Tank — Complete Reference",
        "subtitle": "User Guide • Admin Guide • Tenant Administration • Mac Platform • Licensing",
        "sources": [
            ("Part I: User Guide", [
                "docs/THINKTANK-USER-GUIDE.md",
                "docs/THINK-TANK-USER-GUIDE.md",
            ]),
            ("Part II: Admin Guide", [
                "docs/THINKTANK-ADMIN-GUIDE.md",
                "docs/THINKTANK-ADMIN-GUIDE-V2.md",
            ]),
            ("Part III: Tenant Administration", [
                "docs/THINKTANK-TENANT-ADMIN-GUIDE.md",
            ]),
            ("Part IV: Mac Platform", [
                "docs/THINKTANK-MAC-GUIDE.md",
            ]),
            ("Part V: Licensing Model", [
                "docs/THINKTANK-LICENSING-MODEL.md",
            ]),
            ("Part VI: Delight UX System", [
                "docs/DELIGHT-SYSTEM-GUIDE.md",
            ]),
            ("Part VII: UI & Experience", [
                "docs/POLYMORPHIC-LIQUID-UI-GUIDE.md",
                "docs/USER-RULES-SYSTEM.md",
                "docs/THINK-TANK-EASTER-EGGS.md",
            ]),
            ("Part VIII: Collaboration", [
                "docs/GUEST-COLLABORATION-GUIDE.md",
            ]),
        ],
    },
    {
        "target": "02-CURATOR.md",
        "title": "Curator — Complete Reference",
        "subtitle": "Knowledge Management • Verification • Engineering",
        "sources": [
            ("Part I: User Guide", [
                "docs/CURATOR-USER-GUIDE.md",
            ]),
            ("Part II: Engineering Guide", [
                "docs/CURATOR-ENGINEERING-GUIDE.md",
            ]),
        ],
    },
    {
        "target": "03-DOJO.md",
        "title": "Aurelius Dojo — Complete Reference",
        "subtitle": "Training • Spaced Repetition • Adversarial Scenarios • Competency Mesh",
        "sources": [
            ("Part I: User Guide", [
                "docs/DOJO-USER-GUIDE.md",
            ]),
        ],
    },
    {
        "target": "04-RADIANT-ADMIN.md",
        "title": "RADIANT Admin — Complete Reference",
        "subtitle": "Platform Administration • Deployment • System Health • Spend Governor",
        "sources": [
            ("Part I: Platform Administration Guide", [
                "docs/RADIANT-ADMIN-GUIDE.md",
            ]),
            ("Part II: Administrator Guide", [
                "docs/ADMINISTRATOR-GUIDE.md",
            ]),
            ("Part III: Deployment", [
                "docs/DEPLOYER-ADMIN-GUIDE.md",
                "docs/DEPLOYMENT-GUIDE.md",
            ]),
            ("Part IV: System Guide", [
                "docs/RADIANT-SYSTEM-GUIDE.md",
            ]),
            ("Part V: System Health & Monitoring", [
                "docs/SYSTEM-HEALTH-GUIDE.md",
            ]),
            ("Part VI: SaaS Metrics", [
                "docs/SAAS-METRICS-DASHBOARD.md",
            ]),
            ("Part VII: Seed Data & Configuration", [
                "docs/SEED-DATA-SYSTEM.md",
            ]),
        ],
    },
    {
        "target": "05-SWIFT-DEPLOYER.md",
        "title": "Swift Deployer — Complete Reference",
        "subtitle": "macOS Deployment Tool • User Guide • Architecture",
        "sources": [
            ("Part I: User Guide", [
                "docs/SWIFT-DEPLOYER-USER-GUIDE.md",
            ]),
            ("Part II: Architecture", [
                "docs/DEPLOYER-ARCHITECTURE.md",
            ]),
        ],
    },
    {
        "target": "06-ARCHITECTURE-ENGINEERING.md",
        "title": "Architecture & Engineering",
        "subtitle": "Platform Architecture • CDK Stacks • Engineering Vision • Gateway",
        "sources": [
            ("Part I: Platform Architecture", [
                "docs/RADIANT-PLATFORM-ARCHITECTURE.md",
                "docs/ARCHITECTURE.md",
            ]),
            ("Part II: Engineering Implementation Vision", [
                "docs/ENGINEERING-IMPLEMENTATION-VISION.md",
            ]),
            ("Part III: Infrastructure", [
                "docs/CDK-STACK-DEPENDENCIES.md",
            ]),
            ("Part IV: Specialized Architectures", [
                "docs/MULTI-PROTOCOL-GATEWAY-ARCHITECTURE.md",
                "docs/INTELLIGENCE-AGGREGATOR-ARCHITECTURE.md",
            ]),
            ("Part V: Index", [
                "docs/INDEX.md",
            ]),
        ],
    },
    {
        "target": "07-AI-BRAIN-SYSTEMS.md",
        "title": "AI Brain Systems",
        "subtitle": "AGI Brain • Consciousness • Cognitive Architecture • Cortex Memory",
        "sources": [
            ("Part I: AGI Brain Architecture", [
                "docs/AGI-BRAIN-ARCHITECTURE.md",
                "docs/AGI-BRAIN-COMPREHENSIVE.md",
            ]),
            ("Part II: Consciousness & Cognition", [
                "docs/CONSCIOUSNESS-SERVICE.md",
                "docs/COGNITIVE-ARCHITECTURE-GUIDE.md",
            ]),
            ("Part III: Expert Systems", [
                "docs/EXPERT-SYSTEM-ADAPTERS.md",
                "docs/PREPROMPT-LEARNING-SYSTEM.md",
                "docs/SPECIALTY-RANKING.md",
            ]),
            ("Part IV: Cortex Memory System", [
                "docs/CORTEX-MEMORY-ADMIN-GUIDE.md",
                "docs/CORTEX-ENGINEERING-GUIDE.md",
            ]),
        ],
    },
    {
        "target": "08-CATO-SAFETY.md",
        "title": "CATO Safety System",
        "subtitle": "AI Safety • Ethics • GPU Infrastructure • ADRs • Operational Runbooks",
        "sources": [
            ("Part I: Complete Documentation", [
                "docs/CATO-COMPLETE-DOCUMENTATION.md",
            ]),
            ("Part II: Orchestration Engineering", [
                "docs/CATO-ORCHESTRATION-ENGINEERING-GUIDE.md",
            ]),
            ("Part III: GPU Infrastructure", [
                "docs/CATO-GPU-INFRASTRUCTURE.md",
            ]),
            ("Part IV: Trainer", [
                "docs/CATO-TRAINER-USER-GUIDE.md",
            ]),
            ("Part V: Architecture", [
                "docs/cato/architecture/global-architecture.md",
            ]),
            ("Part VI: Admin API", [
                "docs/cato/api/admin-api.md",
            ]),
            ("Part VII: Architecture Decision Records", [
                "docs/cato/adr/001-replace-litellm.md",
                "docs/cato/adr/002-meta-cognitive-bridge.md",
                "docs/cato/adr/003-tool-grounding.md",
                "docs/cato/adr/004-nli-entailment.md",
                "docs/cato/adr/005-circadian-budget.md",
                "docs/cato/adr/006-global-memory.md",
                "docs/cato/adr/007-semantic-caching.md",
                "docs/cato/adr/008-shadow-self-infrastructure.md",
                "docs/cato/adr/009-infrastructure-tiers.md",
                "docs/cato/adr/010-genesis-system.md",
            ]),
            ("Part VIII: Operational Runbooks", [
                "docs/cato/runbooks/deployment.md",
                "docs/cato/runbooks/incident-response.md",
                "docs/cato/runbooks/scaling.md",
                "docs/cato/runbooks/circuit-breaker-operations.md",
                "docs/cato/runbooks/cost-optimization.md",
                "docs/cato/runbooks/migration.md",
                "docs/cato/runbooks/tier-transitions.md",
            ]),
        ],
    },
    {
        "target": "09-OMEGA-GENESIS.md",
        "title": "OMEGA Protocol & Genesis",
        "subtitle": "OMEGA Protocol • Genesis Forge • Genesis Lab • Resonant Index",
        "sources": [
            ("Part I: OMEGA User Guide", [
                "docs/OMEGA-USER-GUIDE.md",
            ]),
            ("Part II: OMEGA Admin Guide", [
                "docs/OMEGA-ADMIN-GUIDE.md",
            ]),
            ("Part III: Project Genesis OMEGA", [
                "docs/PROJECT-GENESIS-OMEGA.md",
            ]),
            ("Part IV: Genesis Components", [
                "docs/GENESIS-FORGE.md",
                "docs/GENESIS-LAB.md",
                "docs/GENESIS-RESONANT-INDEX.md",
            ]),
            ("Part V: Omega Point & LIVS-M", [
                "docs/RADIANT-OMEGA-POINT.md",
                "docs/LIVS-M-EXPLAINER.md",
            ]),
        ],
    },
    {
        "target": "10-ORCHESTRATION-WORKFLOWS.md",
        "title": "Orchestration & Workflows",
        "subtitle": "Orchestration Engine • Methods • Patterns • Universal Envelope Protocol",
        "sources": [
            ("Part I: Orchestration Methods", [
                "docs/ORCHESTRATION-METHODS.md",
            ]),
            ("Part II: Orchestration Reference", [
                "docs/ORCHESTRATION-REFERENCE.md",
            ]),
            ("Part III: Orchestration Patterns", [
                "docs/features/ORCHESTRATION-PATTERNS.md",
            ]),
            ("Part IV: Workflow & UEP Architecture", [
                "docs/WORKFLOW-UEP-ARCHITECTURE.md",
                "docs/UEP-V2-SPECIFICATION.md",
            ]),
        ],
    },
    {
        "target": "11-DATA-STORAGE.md",
        "title": "Data & Storage",
        "subtitle": "User Data Store • RAWS • Data Retention • Cost Optimization",
        "sources": [
            ("Part I: User Data Store", [
                "docs/UDS-ADMIN-GUIDE.md",
            ]),
            ("Part II: RAWS (Read-After-Write Storage)", [
                "docs/RAWS-ADMIN-GUIDE.md",
                "docs/RAWS-ENGINEERING.md",
                "docs/RAWS-USER-GUIDE.md",
            ]),
            ("Part III: Data Lifecycle", [
                "docs/DATA_RETENTION.md",
                "docs/COST_OPTIMIZATION.md",
            ]),
            ("Part IV: File Services", [
                "docs/FILE-CONVERSION-SERVICE.md",
            ]),
        ],
    },
    {
        "target": "12-API-REFERENCE.md",
        "title": "API Reference",
        "subtitle": "REST APIs • Service Layer • MCP/A2A • Error Codes",
        "sources": [
            ("Part I: API Reference", [
                "docs/API_REFERENCE.md",
            ]),
            ("Part II: API Versioning", [
                "docs/API_VERSIONING.md",
            ]),
            ("Part III: Authentication API", [
                "docs/api/authentication-api.md",
            ]),
            ("Part IV: Search API", [
                "docs/api/search-api.md",
            ]),
            ("Part V: Error Codes", [
                "docs/ERROR_CODES.md",
            ]),
            ("Part VI: Service Layer", [
                "docs/SERVICE-LAYER-GUIDE.md",
            ]),
            ("Part VII: Provider Handling", [
                "docs/PROVIDER-REJECTION-HANDLING.md",
            ]),
        ],
    },
    {
        "target": "13-SECURITY-AUTH-COMPLIANCE.md",
        "title": "Security, Authentication & Compliance",
        "subtitle": "Auth Architecture • User/Admin/Tenant Guides • MFA • OAuth • Compliance",
        "sources": [
            ("Part I: Authentication Architecture", [
                "docs/security/authentication-architecture.md",
            ]),
            ("Part II: Authentication Overview", [
                "docs/authentication/overview.md",
            ]),
            ("Part III: User Authentication Guide", [
                "docs/authentication/user-guide.md",
            ]),
            ("Part IV: Platform Admin Authentication", [
                "docs/authentication/platform-admin-guide.md",
            ]),
            ("Part V: Tenant Admin Authentication", [
                "docs/authentication/tenant-admin-guide.md",
            ]),
            ("Part VI: MFA Guide", [
                "docs/authentication/mfa-guide.md",
            ]),
            ("Part VII: OAuth Guide", [
                "docs/authentication/oauth-guide.md",
            ]),
            ("Part VIII: Internationalization", [
                "docs/authentication/i18n-guide.md",
            ]),
            ("Part IX: Auth Troubleshooting", [
                "docs/authentication/troubleshooting.md",
            ]),
            ("Part X: Security Audit", [
                "docs/SECURITY-AUDIT-CHECKLIST.md",
            ]),
            ("Part XI: Compliance", [
                "docs/COMPLIANCE.md",
            ]),
            ("Part XII: User Provisioning & Licensing ADR", [
                "docs/architecture/ADR-USER-PROVISIONING-SEAT-LICENSING-AUTH.md",
            ]),
        ],
    },
    {
        "target": "14-OPERATIONS-RUNBOOKS.md",
        "title": "Operations & Runbooks",
        "subtitle": "Deployment • Incident Response • Scaling • Performance • Disaster Recovery",
        "sources": [
            ("Part I: Deployment", [
                "docs/runbooks/DEPLOYMENT.md",
            ]),
            ("Part II: Incident Response", [
                "docs/runbooks/INCIDENT-RESPONSE.md",
                "docs/runbooks/INCIDENT_RESPONSE.md",
            ]),
            ("Part III: On-Call", [
                "docs/runbooks/ON_CALL.md",
            ]),
            ("Part IV: Scaling", [
                "docs/runbooks/SCALING.md",
            ]),
            ("Part V: Performance", [
                "docs/PERFORMANCE.md",
                "docs/PERFORMANCE-OPTIMIZATION.md",
            ]),
            ("Part VI: Troubleshooting", [
                "docs/TROUBLESHOOTING.md",
            ]),
            ("Part VII: Disaster Recovery", [
                "docs/DISASTER_RECOVERY.md",
            ]),
            ("Part VIII: Testing", [
                "docs/TESTING.md",
            ]),
        ],
    },
    {
        "target": "15-STRATEGY-COMPETITIVE.md",
        "title": "Strategy & Competitive Position",
        "subtitle": "Vision • Capabilities • Competitive Moats • Revenue • Technical Debt",
        "sources": [
            ("Part I: Strategic Vision & Marketing", [
                "docs/STRATEGIC-VISION-MARKETING.md",
            ]),
            ("Part II: Capabilities Overview", [
                "docs/RADIANT-CAPABILITIES-OVERVIEW.md",
            ]),
            ("Part III: Pitch Deck Points", [
                "docs/PITCH-DECK-POINTS.md",
            ]),
            ("Part IV: Competitive Moats", [
                "docs/RADIANT-MOATS.md",
                "docs/THINKTANK-MOATS.md",
            ]),
            ("Part V: Revenue & Analytics", [
                "docs/REVENUE-ANALYTICS.md",
            ]),
            ("Part VI: SENTINEL System", [
                "docs/SENTINEL-SYSTEM-PLAN.md",
            ]),
            ("Part VII: Technical Debt", [
                "docs/TECHNICAL-DEBT.md",
            ]),
        ],
    },
    {
        "target": "16-IMPLEMENTATION-SPECS.md",
        "title": "Implementation Specifications",
        "subtitle": "Sections 00–46 — Complete Technical Build Specifications",
        "sources": [
            ("Header", [
                "docs/sections/00-HEADER-AND-OVERVIEW.md",
                "docs/sections/README.md",
            ]),
        ] + [
            (f"Section {i:02d}", [f"docs/sections/SECTION-{i:02d}-{name}.md"])
            for i, name in [
                (0, "SHARED-TYPES-AND-CONSTANTS"),
                (1, "SWIFT-DEPLOYMENT-APP"),
                (2, "CDK-INFRASTRUCTURE-STACKS"),
                (3, "CDK-AI-AND-API-STACKS"),
                (4, "LAMBDA-CORE"),
                (5, "LAMBDA-ADMIN-BILLING"),
                (6, "SELF-HOSTED-MODELS"),
                (7, "DATABASE-SCHEMA"),
                (8, "ADMIN-DASHBOARD"),
                (9, "DEPLOYMENT-GUIDE"),
                (10, "VISUAL-AI-PIPELINE"),
                (11, "RADIANT-BRAIN"),
                (12, "METRICS-ANALYTICS"),
                (13, "NEURAL-ENGINE"),
                (14, "ERROR-LOGGING"),
                (15, "CREDENTIALS-REGISTRY"),
                (16, "AWS-ADMIN-CREDENTIALS"),
                (17, "AUTO-RESOLVE-API"),
                (18, "THINK-TANK-PLATFORM"),
                (19, "CONCURRENT-CHAT"),
                (20, "REALTIME-COLLABORATION"),
                (21, "VOICE-VIDEO"),
                (22, "PERSISTENT-MEMORY"),
                (23, "CANVAS-ARTIFACTS"),
                (24, "RESULT-MERGING"),
                (25, "FOCUS-MODES-PERSONAS"),
                (26, "SCHEDULED-PROMPTS"),
                (27, "FAMILY-TEAM-PLANS"),
                (28, "ANALYTICS-INTEGRATION"),
                (29, "ADMIN-EXTENSIONS"),
                (30, "DYNAMIC-PROVIDER-REGISTRY"),
                (31, "MODEL-SELECTION-PRICING"),
                (32, "TIME-MACHINE-CORE"),
                (33, "TIME-MACHINE-UI"),
                (34, "ORCHESTRATION-ENGINE"),
                (35, "LICENSE-MANAGEMENT"),
                (36, "UNIFIED-MODEL-REGISTRY"),
                (37, "FEEDBACK-LEARNING"),
                (38, "NEURAL-ORCHESTRATION"),
                (39, "WORKFLOW-PROPOSALS"),
                (40, "APP-ISOLATION"),
                (41, "INTERNATIONALIZATION"),
                (42, "DYNAMIC-CONFIGURATION"),
                (43, "BILLING-CREDITS"),
                (44, "STORAGE-BILLING"),
                (45, "VERSIONED-SUBSCRIPTIONS"),
                (46, "DUAL-ADMIN-APPROVAL"),
            ]
        ],
    },
    {
        "target": "17-GLOSSARY.md",
        "title": "RADIANT & Think Tank Glossary",
        "subtitle": "Terms, Definitions, Acronyms",
        "sources": [
            ("Glossary", [
                "docs/RADIANT-GLOSSARY.md",
            ]),
        ],
    },
    {
        "target": "18-UI-UX-LIBRARIES.md",
        "title": "UI/UX Design & Libraries",
        "subtitle": "Design Patterns • Open Source Dependencies",
        "sources": [
            ("Part I: UI/UX Patterns", [
                "docs/UI-UX-PATTERNS.md",
            ]),
            ("Part II: Open Source Libraries", [
                "docs/OPEN-SOURCE-LIBRARIES.md",
            ]),
        ],
    },
]


def read_version() -> str:
    """Read current RADIANT version."""
    vf = ROOT / "RADIANT_VERSION"
    if vf.exists():
        return vf.read_text().strip()
    vf = ROOT / "VERSION"
    if vf.exists():
        return vf.read_text().strip()
    return "unknown"


def strip_yaml_frontmatter(content: str) -> str:
    """Strip YAML frontmatter from content."""
    if not content.startswith("---"):
        return content
    lines = content.split("\n")
    for i in range(1, len(lines)):
        if lines[i].strip() == "---":
            return "\n".join(lines[i + 1:]).lstrip("\n")
    return content


def strip_h1(content: str) -> str:
    """Strip leading H1 from content (we add our own)."""
    lines = content.split("\n")
    while lines and not lines[0].strip():
        lines.pop(0)
    if lines and lines[0].startswith("# "):
        lines.pop(0)
        while lines and not lines[0].strip():
            lines.pop(0)
    return "\n".join(lines)


def read_doc(rel_path: str) -> tuple[str | None, int]:
    """Read a document. Returns (content, line_count) or (None, 0)."""
    full = ROOT / rel_path
    if not full.exists():
        return None, 0
    try:
        content = full.read_text(encoding="utf-8", errors="replace")
        return content, content.count("\n") + 1
    except Exception:
        return None, 0


def detect_redundancy(text: str) -> list[tuple[str, int]]:
    """Find duplicate paragraph blocks (>3 lines) in text."""
    lines = text.split("\n")
    blocks = []
    current_block = []

    for line in lines:
        if line.strip():
            current_block.append(line)
        else:
            if len(current_block) >= 3:
                block_text = "\n".join(current_block)
                block_hash = hashlib.md5(block_text.encode()).hexdigest()
                blocks.append((block_hash, block_text, len(current_block)))
            current_block = []

    # Find duplicates
    seen = defaultdict(list)
    for i, (h, text_block, line_count) in enumerate(blocks):
        seen[h].append((i, line_count))

    duplicates = []
    for h, occurrences in seen.items():
        if len(occurrences) > 1:
            total_lines = sum(lc for _, lc in occurrences)
            duplicates.append((h, total_lines))

    return duplicates


def archive_all():
    """Step 1: Archive all current docs."""
    print("\n📦 Step 1: Archiving all current docs...")

    ARCHIVE_PRE.mkdir(parents=True, exist_ok=True)

    # Copy entire docs/ tree (excluding archive/ itself)
    count = 0
    for item in DOCS.rglob("*"):
        if "archive" in item.parts:
            continue
        if item.is_file() and item.suffix in (".md", ".json", ".yaml", ".yml", ".html", ".pdf", ".sh"):
            rel = item.relative_to(DOCS)
            dest = ARCHIVE_PRE / rel
            dest.parent.mkdir(parents=True, exist_ok=True)
            shutil.copy2(item, dest)
            count += 1

    print(f"  ✅ Archived {count} files to docs/archive/pre-consolidation/")


def triage():
    """Step 2: Move build artifacts, exports, historical to archive subdirs."""
    print("\n🗂️  Step 2: Triaging non-reference files...")

    moves = [
        (TRIAGE_TO_ARTIFACTS, ARCHIVE_ARTIFACTS, "build-artifacts"),
        (TRIAGE_TO_EXPORTS, ARCHIVE_EXPORTS, "code-exports"),
        (TRIAGE_TO_HISTORICAL, ARCHIVE_HISTORICAL, "historical"),
    ]

    total = 0
    for file_list, dest_dir, label in moves:
        dest_dir.mkdir(parents=True, exist_ok=True)
        moved = 0
        for rel_path in file_list:
            src = ROOT / rel_path
            if src.exists():
                # Preserve subdirectory structure
                rel_from_docs = src.relative_to(DOCS) if str(src).startswith(str(DOCS)) else Path(rel_path)
                dest = dest_dir / rel_from_docs.name
                shutil.move(str(src), str(dest))
                moved += 1
        print(f"  ✅ Moved {moved} files to docs/archive/{label}/")
        total += moved

    print(f"  Total triaged: {total} files")


def merge_documents():
    """Step 3: Merge source docs into 18 consolidated documents."""
    print("\n🔀 Step 3: Merging into 18 consolidated documents...")

    version = read_version()
    now = datetime.datetime.now().strftime("%B %d, %Y")
    total_sources = 0
    total_lines = 0
    redundancy_report = []

    for plan in MERGE_PLAN:
        target_name = plan["target"]
        title = plan["title"]
        subtitle = plan["subtitle"]
        source_parts = plan["sources"]

        parts = []

        # Title page
        parts.append(f"# {title}\n")
        parts.append(f"**{subtitle}**\n")
        parts.append(f"*RADIANT v{version} — Generated {now}*\n")
        parts.append("---\n")

        # Table of contents
        toc_lines = ["## Table of Contents\n"]
        for part_title, _ in source_parts:
            toc_lines.append(f"- **{part_title}**")
        toc_lines.append("")
        toc_lines.append("---\n")
        parts.append("\n".join(toc_lines))

        # Include each part
        doc_included = 0
        doc_missing = 0
        source_lines = 0

        for part_title, source_files in source_parts:
            part_content = []
            has_content = False

            for src_file in source_files:
                content, lc = read_doc(src_file)
                if content is not None:
                    cleaned = strip_yaml_frontmatter(content)
                    cleaned = strip_h1(cleaned)
                    if cleaned.strip():
                        part_content.append(cleaned)
                        source_lines += lc
                        doc_included += 1
                        has_content = True
                else:
                    doc_missing += 1

            if has_content:
                # Add part header
                parts.append(f"\n---\n\n## {part_title}\n")
                # Join all content for this part
                combined = "\n\n".join(part_content)
                parts.append(combined)

        total_sources += doc_included

        # Assembly footer
        parts.append(f"\n\n---\n\n*Consolidated from {doc_included} source documents ({doc_missing} not found). {source_lines:,} source lines.*\n")

        # Write merged document
        merged_content = "\n".join(parts)
        merged_lines = merged_content.count("\n")
        total_lines += merged_lines

        out_path = DOCS / target_name
        out_path.write_text(merged_content, encoding="utf-8")

        # Detect redundancy
        dupes = detect_redundancy(merged_content)
        dupe_lines = sum(dl for _, dl in dupes)
        if dupes:
            redundancy_report.append((target_name, len(dupes), dupe_lines))

        status = f"  ✅ {target_name}: {doc_included} sources → {merged_lines:,} lines"
        if doc_missing > 0:
            status += f" ({doc_missing} missing)"
        if dupes:
            status += f" ⚠️ {len(dupes)} duplicate blocks ({dupe_lines} lines)"
        print(status)

    print(f"\n  Total: {len(MERGE_PLAN)} documents, {total_sources} sources merged, {total_lines:,} lines")

    if redundancy_report:
        print(f"\n  📊 Redundancy detected in {len(redundancy_report)} documents:")
        for name, dupe_count, dupe_lines in redundancy_report:
            print(f"     {name}: {dupe_count} duplicate blocks (~{dupe_lines} lines)")


def purge_originals():
    """Step 4: Remove original files that were merged."""
    print("\n🧹 Step 4: Purging merged originals...")

    # Collect all source files from the merge plan
    all_sources = set()
    for plan in MERGE_PLAN:
        for _, source_files in plan["sources"]:
            for src in source_files:
                all_sources.add(src)

    # Also add triage files (already moved but might have remnants)
    removed = 0
    for src_rel in all_sources:
        src_path = ROOT / src_rel
        if src_path.exists():
            src_path.unlink()
            removed += 1

    print(f"  ✅ Removed {removed} original files")


def cleanup_empty_dirs():
    """Step 5: Remove empty directories."""
    print("\n🗑️  Step 5: Cleaning up empty directories...")

    removed = 0
    for dirpath, dirnames, filenames in os.walk(str(DOCS), topdown=False):
        p = Path(dirpath)
        if "archive" in p.parts or "publications" in p.parts:
            continue
        if p == DOCS:
            continue
        # Remove if empty (or only has .DS_Store)
        remaining = [f for f in os.listdir(dirpath) if f != ".DS_Store"]
        if not remaining:
            shutil.rmtree(dirpath, ignore_errors=True)
            removed += 1
            print(f"  🗑️  Removed empty: {p.relative_to(DOCS)}/")

    if removed == 0:
        print("  ✅ No empty directories to remove")


def verify():
    """Step 6: Verify the final state."""
    print("\n✅ Step 6: Verification...")

    # Count remaining .md files in docs/ (excluding archive/ and publications/)
    remaining = []
    for item in DOCS.iterdir():
        if item.name == "archive" or item.name == "publications":
            continue
        if item.is_file() and item.suffix == ".md":
            remaining.append(item.name)
        elif item.is_dir():
            for sub in item.rglob("*.md"):
                remaining.append(str(sub.relative_to(DOCS)))

    print(f"  Active documents in docs/: {len(remaining)}")
    for name in sorted(remaining):
        size = (DOCS / name).stat().st_size if (DOCS / name).exists() else 0
        print(f"    📄 {name} ({size / 1024:.0f} KB)")

    # Count archived
    archived = sum(1 for _ in ARCHIVE.rglob("*.md")) if ARCHIVE.exists() else 0
    print(f"  Archived documents: {archived}")

    # Check for any orphaned files
    consolidated_names = {plan["target"] for plan in MERGE_PLAN}
    orphaned = [n for n in remaining if n not in consolidated_names and n != "DOCUMENTATION-MANIFEST.json"]
    if orphaned:
        print(f"\n  ⚠️  Orphaned files (not in consolidation plan):")
        for name in sorted(orphaned):
            print(f"    ❓ {name}")


def main():
    print("=" * 70)
    print("RADIANT Documentation Consolidation")
    print("=" * 70)
    print(f"Root: {ROOT}")
    print(f"Version: {read_version()}")
    print(f"Date: {datetime.datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print()

    # Count current state
    current_count = sum(1 for _ in DOCS.rglob("*.md"))
    print(f"Current docs: {current_count} .md files")
    print(f"Target: {len(MERGE_PLAN)} consolidated documents")
    print()

    # Execute steps
    archive_all()
    triage()
    merge_documents()
    purge_originals()
    cleanup_empty_dirs()
    verify()

    print()
    print("=" * 70)
    print("CONSOLIDATION COMPLETE")
    print("=" * 70)
    print()
    print("Next steps:")
    print("  1. Update DOCUMENTATION-MANIFEST.json")
    print("  2. Update .windsurf/workflows/ policies")
    print("  3. Update AGENTS.md references")
    print("  4. Run: python3 tools/scripts/assemble-complete-documentation.py")
    print()


if __name__ == "__main__":
    main()
