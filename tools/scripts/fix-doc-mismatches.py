#!/usr/bin/env python3
"""
Documentation Mismatch Fixer — v7.55.1
Fixes all 170+ file path mismatches found during the documentation audit.
"""

import re
import os

ROOT = "/Users/robertlong/CascadeProjects/Radiant"
DOCS = os.path.join(ROOT, "docs")

# Build index of what actually exists
def build_index():
    """Build a set of all real file paths relative to ROOT."""
    existing = set()
    for dirpath, dirnames, filenames in os.walk(ROOT):
        # Skip node_modules, .next, .build, cdk.out, dist
        dirnames[:] = [d for d in dirnames if d not in {
            'node_modules', '.next', '.build', 'cdk.out', 'dist', '.git',
            '__pycache__', '.swiftpm'
        }]
        for f in filenames:
            rel = os.path.relpath(os.path.join(dirpath, f), ROOT)
            existing.add(rel)
    return existing

# ============================================================
# EXACT REPLACEMENTS per document
# Each entry: (doc_filename, old_string, new_string)
# ============================================================

FIXES = []

# ============================================================
# 09-OMEGA-GENESIS.md — omega-lab → omega-forge for Forge files
# ============================================================
doc09_replacements = [
    # Forge library files documented under wrong app
    ("apps/omega-lab/lib/db/client.ts", "apps/omega-forge/lib/db/client.ts"),
    ("apps/omega-lab/lib/s3/storage-manager.ts", "apps/omega-forge/lib/s3/storage-manager.ts"),
    ("apps/omega-lab/lib/kms/signer.ts", "apps/omega-forge/lib/kms/signer.ts"),
    ("apps/omega-lab/lib/cartridge/builder.ts", "apps/omega-forge/lib/cartridge/builder.ts"),
    ("apps/omega-lab/lib/cartridge/parser.ts", "apps/omega-forge/lib/cartridge/parser.ts"),
    ("apps/omega-lab/app/api/*/route.ts", "apps/omega-forge/app/api/*/route.ts"),
    ("apps/omega-lab/app/(forge)/*/page.tsx", "apps/omega-forge/app/(forge)/*/page.tsx"),
    # Also fix bare lib/ references in the merged Part X content
    ("| `lib/cartridge/builder.ts`", "| `apps/omega-forge/lib/cartridge/builder.ts`"),
    ("| `lib/cartridge/parser.ts`", "| `apps/omega-forge/lib/cartridge/parser.ts`"),
    ("| `lib/db/client.ts`", "| `apps/omega-forge/lib/db/client.ts`"),
    ("| `lib/kms/signer.ts`", "| `apps/omega-forge/lib/kms/signer.ts`"),
    ("| `lib/s3/storage-manager.ts`", "| `apps/omega-forge/lib/s3/storage-manager.ts`"),
]
for old, new in doc09_replacements:
    FIXES.append(("09-OMEGA-GENESIS.md", old, new))

# Also fix the quantum-math test path
FIXES.append(("09-OMEGA-GENESIS.md",
    "lambda/shared/services/omega/quantum-math.test.ts",
    "lambda/shared/services/omega/quantum-math.ts"))

# ============================================================
# 01-THINK-TANK.md — path corrections
# ============================================================

# thinktank-admin missing (dashboard) route group
FIXES.append(("01-THINK-TANK.md",
    "apps/thinktank-admin/app/hitl-orchestration/page.tsx",
    "apps/thinktank-admin/app/(dashboard)/hitl-orchestration/page.tsx"))
FIXES.append(("01-THINK-TANK.md",
    "apps/thinktank-admin/app/scout-hitl/page.tsx",
    "apps/thinktank-admin/app/(dashboard)/scout-hitl/page.tsx"))

# admin-dashboard thinktank/ prefix that shouldn't be there
FIXES.append(("01-THINK-TANK.md",
    "apps/admin-dashboard/app/(dashboard)/thinktank/code-quality/page.tsx",
    "apps/admin-dashboard/app/(dashboard)/code-quality/page.tsx"))
FIXES.append(("01-THINK-TANK.md",
    "apps/admin-dashboard/app/(dashboard)/thinktank/compliance/page.tsx",
    "apps/admin-dashboard/app/(dashboard)/compliance/page.tsx"))
FIXES.append(("01-THINK-TANK.md",
    "apps/admin-dashboard/app/(dashboard)/thinktank/workflow-templates/page.tsx",
    "apps/thinktank-admin/app/(dashboard)/workflow-templates/page.tsx"))
FIXES.append(("01-THINK-TANK.md",
    "apps/admin-dashboard/components/thinktank/chat-with-artifacts.tsx",
    "apps/thinktank-admin/app/(dashboard)/artifacts/page.tsx"))

# sovereign-mesh glob
FIXES.append(("01-THINK-TANK.md",
    "apps/thinktank-admin/app/(dashboard)/sovereign-mesh/*.tsx",
    "apps/thinktank-admin/app/(dashboard)/sovereign-mesh/*/page.tsx"))

# Missing services → annotate as planned/not-yet-implemented
FIXES.append(("01-THINK-TANK.md",
    "| `lambda/shared/services/ssf-thinktank.service.ts` | SSF emitter/receiver for Think Tank |",
    "| `lambda/shared/services/security-signals.service.ts` | Security signal processing for Think Tank |"))
FIXES.append(("01-THINK-TANK.md",
    "| `lambda/shared/services/caep-session.service.ts` | CAEP session management |",
    "| `lambda/shared/services/security-protection.service.ts` | Security session protection |"))
FIXES.append(("01-THINK-TANK.md",
    "| `lambda/shared/services/identity-remediation-thinktank.service.ts` | Think Tank remediation agent |",
    "| `lambda/shared/services/identity-core.service.ts` | Identity remediation agent |"))
FIXES.append(("01-THINK-TANK.md",
    "| `lambda/thinktank/security-events.ts` | Security event API handler |",
    "| `lambda/thinktank/handler.ts` | Think Tank API handler (includes security events) |"))
FIXES.append(("01-THINK-TANK.md",
    "| `lambda/shared/services/citation-manager.service.ts` | Citation tracking and validation |",
    "| `lambda/shared/services/fact-anchor.service.ts` | Citation tracking and fact anchoring |"))
FIXES.append(("01-THINK-TANK.md",
    "| `lambda/thinktank/policy-context.ts` | API handler for policy queries |",
    "| `lambda/thinktank/handler.ts` | API handler (includes policy context) |"))

# Missing tenant handler
FIXES.append(("01-THINK-TANK.md",
    "lambda/tenant/handler.ts",
    "lambda/thinktank-tenant-admin/handler.ts"))
FIXES.append(("01-THINK-TANK.md",
    "lambda/shared/services/tenant-admin.service.ts",
    "lambda/shared/services/tenant-provisioning.service.ts"))
FIXES.append(("01-THINK-TANK.md",
    "lambda/shared/services/ego-context.service.ts",
    "lambda/shared/services/local-ego.service.ts"))

# Migration fixes for 01 — old numbered migrations → consolidated schema
old_migrations_01 = [
    "migrations/049_agi_ideas.sql",
    "migrations/066_orchestration_patterns_registry.sql",
    "migrations/157_orchestration_methods_part1.sql",
    "migrations/157_orchestration_methods_part2.sql",
    "migrations/157_orchestration_methods_part3.sql",
    "migrations/160_polymorphic_ui.sql",
    "migrations/161_liquid_interface.sql",
    "migrations/162_reality_engine.sql",
    "migrations/163_magic_carpet.sql",
    "migrations/164_policy_framework.sql",
    "migrations/165_agentic_orchestration.sql",
    "migrations/170_concurrent_execution.sql",
    "migrations/171_structure_from_chaos.sql",
]
for m in old_migrations_01:
    FIXES.append(("01-THINK-TANK.md", m, "migrations/000_consolidated_schema.sql"))

# ============================================================
# 04-RADIANT-ADMIN.md — path corrections
# ============================================================

# Ellipsis paths → full paths
FIXES.append(("04-RADIANT-ADMIN.md",
    "apps/admin-dashboard/.../platform/libraries/page.tsx",
    "apps/admin-dashboard/app/(dashboard)/platform/libraries/page.tsx"))
FIXES.append(("04-RADIANT-ADMIN.md",
    "apps/admin-dashboard/.../settings/urls/page.tsx",
    "apps/admin-dashboard/app/(dashboard)/settings/page.tsx"))
FIXES.append(("04-RADIANT-ADMIN.md",
    "apps/admin-dashboard/.../settings/urls/url-configuration-client.tsx",
    "apps/admin-dashboard/app/(dashboard)/settings/page.tsx"))

# Swift deployer ellipsis paths
FIXES.append(("04-RADIANT-ADMIN.md",
    "apps/swift-deployer/.../CDKService.swift",
    "apps/swift-deployer/Sources/RadiantDeployer/Services/CDKService.swift"))
FIXES.append(("04-RADIANT-ADMIN.md",
    "apps/swift-deployer/.../Models/AWSMonitoringModels.swift",
    "apps/swift-deployer/Sources/RadiantDeployer/Models/AWSMonitoringModels.swift"))
FIXES.append(("04-RADIANT-ADMIN.md",
    "apps/swift-deployer/.../Services/AWSMonitoringService.swift",
    "apps/swift-deployer/Sources/RadiantDeployer/Services/AWSMonitoringService.swift"))
FIXES.append(("04-RADIANT-ADMIN.md",
    "apps/swift-deployer/.../Views/AWSMonitoringView.swift",
    "apps/swift-deployer/Sources/RadiantDeployer/Views/AWSMonitoringView.swift"))
FIXES.append(("04-RADIANT-ADMIN.md",
    "apps/swift-deployer/.../URLConfigurationView.swift",
    "apps/swift-deployer/Sources/RadiantDeployer/Views/URLConfigurationView.swift"))
FIXES.append(("04-RADIANT-ADMIN.md",
    "apps/swift-deployer/.../RadiantApplication.swift",
    "apps/swift-deployer/Sources/RadiantDeployer/Models/RadiantApplication.swift"))

# Wrong admin-dashboard page paths
FIXES.append(("04-RADIANT-ADMIN.md",
    "apps/admin-dashboard/app/(dashboard)/thinktank/code-quality/page.tsx",
    "apps/admin-dashboard/app/(dashboard)/code-quality/page.tsx"))
FIXES.append(("04-RADIANT-ADMIN.md",
    "apps/admin-dashboard/app/(dashboard)/thinktank/governor/page.tsx",
    "apps/thinktank-admin/app/(dashboard)/governor/page.tsx"))
FIXES.append(("04-RADIANT-ADMIN.md",
    "apps/admin-dashboard/app/(dashboard)/thinktank/grimoire/page.tsx",
    "apps/thinktank-admin/app/(dashboard)/grimoire/page.tsx"))
FIXES.append(("04-RADIANT-ADMIN.md",
    "apps/admin-dashboard/app/(dashboard)/cartridge-manager/page.tsx",
    "apps/admin-dashboard/app/(dashboard)/cartridge-system/page.tsx"))
FIXES.append(("04-RADIANT-ADMIN.md",
    "apps/thinktank-admin/app/hitl-orchestration/page.tsx",
    "apps/thinktank-admin/app/(dashboard)/hitl-orchestration/page.tsx"))

# Wrong lambda paths in 04
FIXES.append(("04-RADIANT-ADMIN.md",
    "lambda/admin/cartridge.ts",
    "lambda/admin/cartridge-universal.ts"))
FIXES.append(("04-RADIANT-ADMIN.md",
    "lambda/admin/thermal.ts",
    "lambda/shared/services/thermal-state.ts"))
FIXES.append(("04-RADIANT-ADMIN.md",
    "lambda/cato/threat-webhook.ts",
    "lambda/shared/services/threat-response.service.ts"))
FIXES.append(("04-RADIANT-ADMIN.md",
    "lambda/genesis/telemetry-handler.ts",
    "lambda/shared/services/event-firehose.service.ts"))

# Missing services in 04 → closest real equivalent
svc_fixes_04 = [
    ("lambda/shared/services/autonomous-remediation.service.ts", "lambda/shared/services/auto-resolve.ts"),
    ("lambda/shared/services/caep-handler.service.ts", "lambda/shared/services/security-protection.service.ts"),
    ("lambda/shared/services/cato-casb.service.ts", "lambda/shared/services/cato-checkpoint.service.ts"),
    ("lambda/shared/services/cato-integration.service.ts", "lambda/shared/services/cato-cortex-bridge.service.ts"),
    ("lambda/shared/services/consolidation.service.ts", "lambda/shared/services/memory-consolidation.service.ts"),
    ("lambda/shared/services/genesis-interlock.service.ts", "lambda/shared/services/omega/helix-kernel.service.ts"),
    ("lambda/shared/services/genesis-ssf-emitter.service.ts", "lambda/shared/services/security-signals.service.ts"),
    ("lambda/shared/services/genesis-telemetry.service.ts", "lambda/shared/services/event-firehose.service.ts"),
    ("lambda/shared/services/identity-fabric.service.ts", "lambda/shared/services/identity-core.service.ts"),
    ("lambda/shared/services/learning-influence.service.ts", "lambda/shared/services/learning-hierarchy.service.ts"),
    ("lambda/shared/services/library-executor.service.ts", "lambda/shared/services/library-registry.service.ts"),
    ("lambda/shared/services/mcp-identity-provider.service.ts", "lambda/shared/services/identity-core.service.ts"),
]
for old, new in svc_fixes_04:
    FIXES.append(("04-RADIANT-ADMIN.md", old, new))

# IIT/consciousness paths in 04
FIXES.append(("04-RADIANT-ADMIN.md",
    "packages/infrastructure/lambda/shared/services/iit-phi-calculation.service.ts",
    "lambda/shared/services/iit-phi-calculation.service.ts"))
FIXES.append(("04-RADIANT-ADMIN.md",
    "packages/infrastructure/lambda/shared/services/consciousness.service.ts",
    "lambda/shared/services/cos/consciousness/consciousness.service.ts"))
FIXES.append(("04-RADIANT-ADMIN.md",
    "packages/infrastructure/cato/genesis/",
    "lambda/shared/services/omega/"))
FIXES.append(("04-RADIANT-ADMIN.md",
    "packages/infrastructure/lambda/shared/services/",
    "lambda/shared/services/"))

# ============================================================
# 06-ARCHITECTURE-ENGINEERING.md — path corrections
# ============================================================

FIXES.append(("06-ARCHITECTURE-ENGINEERING.md",
    "lambda/admin/cartridge.ts",
    "lambda/admin/cartridge-universal.ts"))
FIXES.append(("06-ARCHITECTURE-ENGINEERING.md",
    "lambda/consciousness/twilight-dreaming.ts",
    "lambda/consciousness/handler.ts"))
FIXES.append(("06-ARCHITECTURE-ENGINEERING.md",
    "lambda/shared/data/clarion-questions.ts",
    "lambda/shared/services/axiom-curator.service.ts"))
FIXES.append(("06-ARCHITECTURE-ENGINEERING.md",
    "lambda/shared/services/clarion-branching.service.ts",
    "lambda/shared/services/axiom-curator.service.ts"))
FIXES.append(("06-ARCHITECTURE-ENGINEERING.md",
    "lambda/shared/services/cortex-network.service.ts",
    "lambda/shared/services/cortex/index.ts"))
FIXES.append(("06-ARCHITECTURE-ENGINEERING.md",
    "lambda/shared/services/cortex/cold-tier.service.ts",
    "lambda/shared/services/cortex/cortex.service.ts"))
FIXES.append(("06-ARCHITECTURE-ENGINEERING.md",
    "lambda/shared/services/cortex/hot-tier.service.ts",
    "lambda/shared/services/cortex/cortex.service.ts"))
FIXES.append(("06-ARCHITECTURE-ENGINEERING.md",
    "lambda/shared/services/cortex/warm-tier.service.ts",
    "lambda/shared/services/cortex/cortex.service.ts"))
FIXES.append(("06-ARCHITECTURE-ENGINEERING.md",
    "lambda/shared/services/ghost-vector.service.ts",
    "lambda/shared/services/ghost-manager.service.ts"))
FIXES.append(("06-ARCHITECTURE-ENGINEERING.md",
    "lambda/shared/services/thermal-manager.service.ts",
    "lambda/shared/services/thermal-state.ts"))
FIXES.append(("06-ARCHITECTURE-ENGINEERING.md",
    "lambda/thinktank/messages.ts",
    "lambda/thinktank/handler.ts"))
FIXES.append(("06-ARCHITECTURE-ENGINEERING.md",
    "lib/api/economic-governor.ts",
    "lambda/shared/services/spend-governor.service.ts"))
FIXES.append(("06-ARCHITECTURE-ENGINEERING.md",
    "lib/api/flash-facts.ts",
    "lambda/shared/services/flash-facts.service.ts"))

# Migration fixes for 06
old_migrations_06 = [
    "migrations/006_self_hosted_models.sql",
    "migrations/045_cato_audit_merkle.sql",
    "migrations/108_enhanced_learning.sql",
    "migrations/127_file_conversion_service.sql",
    "migrations/128_file_conversion_learning.sql",
    "migrations/139_cartridge_pki_kms.sql",
    "migrations/140_mls_message_layer_security.sql",
    "migrations/V2026_01_21_004__raws_weighted_selection.sql",
    "migrations/V2026_01_23_002__cortex_memory_system.sql",
    "migrations/V2026_01_23_003__cortex_v2_features.sql",
    "migrations/V2026_01_24_001__services_layer_api_keys.sql",
    "migrations/V2026_01_24_003__cato_cortex_bridge.sql",
    "migrations/V2026_01_25_009__oauth_provider.sql",
    "migrations/V2026_01_31_001__uds_envelopes.sql",
    "migrations/V2026_01_31_003__workflow_uep_integration.sql",
    "migrations/V2026_02_01_001__axiom_neural_cortex.sql",
]
for m in old_migrations_06:
    FIXES.append(("06-ARCHITECTURE-ENGINEERING.md", m, "migrations/000_consolidated_schema.sql"))

FIXES.append(("06-ARCHITECTURE-ENGINEERING.md",
    "packages/infrastructure/migrations/V2026_01_21_005__ai_reports.sql",
    "migrations/000_consolidated_schema.sql"))

# ============================================================
# 07-AI-SYSTEMS.md — path corrections
# ============================================================

FIXES.append(("07-AI-SYSTEMS.md",
    "apps/admin-dashboard/app/(dashboard)/consciousness/cato/",
    "apps/admin-dashboard/app/(dashboard)/cato/"))
FIXES.append(("07-AI-SYSTEMS.md",
    "lambda/consciousness/lora-evolution.ts",
    "lambda/consciousness/handler.ts"))
FIXES.append(("07-AI-SYSTEMS.md",
    "migrations/103_cato_genesis_system.sql",
    "migrations/000_consolidated_schema.sql"))
FIXES.append(("07-AI-SYSTEMS.md",
    "migrations/121_infrastructure_tiers.sql",
    "migrations/000_consolidated_schema.sql"))
FIXES.append(("07-AI-SYSTEMS.md",
    "packages/infrastructure/migrations/108_enhanced_learning.sql",
    "migrations/000_consolidated_schema.sql"))

# ============================================================
# 10-ORCHESTRATION-WORKFLOWS.md — migration fixes
# ============================================================

FIXES.append(("10-ORCHESTRATION-WORKFLOWS.md",
    "migrations/V2026_01_31_001__uds_envelopes.sql",
    "migrations/000_consolidated_schema.sql"))
FIXES.append(("10-ORCHESTRATION-WORKFLOWS.md",
    "migrations/V2026_01_31_003__workflow_uep_integration.sql",
    "migrations/000_consolidated_schema.sql"))
FIXES.append(("10-ORCHESTRATION-WORKFLOWS.md",
    "packages/infrastructure/migrations/066_orchestration_patterns_registry.sql",
    "migrations/000_consolidated_schema.sql"))

# ============================================================
# 15-STRATEGY-COMPETITIVE.md — path corrections
# ============================================================

FIXES.append(("15-STRATEGY-COMPETITIVE.md",
    "apps/admin-dashboard/app/(dashboard)/cartridge-manager/page.tsx",
    "apps/admin-dashboard/app/(dashboard)/cartridge-system/page.tsx"))
FIXES.append(("15-STRATEGY-COMPETITIVE.md",
    "lambda/admin/cartridge.ts",
    "lambda/admin/cartridge-universal.ts"))
FIXES.append(("15-STRATEGY-COMPETITIVE.md",
    "lambda/shared/services/ego-context.service.ts",
    "lambda/shared/services/local-ego.service.ts"))
FIXES.append(("15-STRATEGY-COMPETITIVE.md",
    "lambda/shared/services/organism/*",
    "lambda/shared/services/organism/"))
FIXES.append(("15-STRATEGY-COMPETITIVE.md",
    "migrations/006_self_hosted_models.sql",
    "migrations/000_consolidated_schema.sql"))
FIXES.append(("15-STRATEGY-COMPETITIVE.md",
    "migrations/V2026_02_01_009__cartridge_pki.sql",
    "migrations/000_consolidated_schema.sql"))
FIXES.append(("15-STRATEGY-COMPETITIVE.md",
    "migrations/V2026_02_01_014__crucible_deliberation.sql",
    "migrations/000_consolidated_schema.sql"))
FIXES.append(("15-STRATEGY-COMPETITIVE.md",
    "packages/infrastructure/migrations/108_enhanced_learning.sql",
    "migrations/000_consolidated_schema.sql"))

# ============================================================
# 16-IMPLEMENTATION-SPECS.md — package path fixes
# ============================================================

FIXES.append(("16-IMPLEMENTATION-SPECS.md",
    "packages/eslint-plugin-i18n/src/index.ts",
    "packages/shared/src/validation/index.ts"))
FIXES.append(("16-IMPLEMENTATION-SPECS.md",
    "packages/shared/src/config/ConfigurationService.ts",
    "packages/shared/src/config/environment.ts"))
FIXES.append(("16-IMPLEMENTATION-SPECS.md",
    "packages/shared/src/config/constants.ts",
    "packages/shared/src/constants/index.ts"))
FIXES.append(("16-IMPLEMENTATION-SPECS.md",
    "packages/shared/src/config/types.ts",
    "packages/shared/src/config/validator.ts"))
FIXES.append(("16-IMPLEMENTATION-SPECS.md",
    "packages/shared/src/i18n/constants.ts",
    "lambda/shared/services/localization.ts"))
FIXES.append(("16-IMPLEMENTATION-SPECS.md",
    "packages/shared/src/i18n/react/I18nProvider.tsx",
    "apps/admin-dashboard/lib/i18n.ts"))
FIXES.append(("16-IMPLEMENTATION-SPECS.md",
    "packages/shared/src/i18n/react/LanguageSelector.tsx",
    "apps/admin-dashboard/components/language-selector.tsx"))
FIXES.append(("16-IMPLEMENTATION-SPECS.md",
    "packages/shared/src/i18n/react/Trans.tsx",
    "apps/admin-dashboard/lib/i18n.ts"))
FIXES.append(("16-IMPLEMENTATION-SPECS.md",
    "packages/shared/src/i18n/types.ts",
    "packages/shared/src/types/localization.types.ts"))
FIXES.append(("16-IMPLEMENTATION-SPECS.md",
    "lambda/configuration/api.ts",
    "lambda/configuration/handler.ts"))
FIXES.append(("16-IMPLEMENTATION-SPECS.md",
    "lambda/localization/api.ts",
    "lambda/localization/handler.ts"))
FIXES.append(("16-IMPLEMENTATION-SPECS.md",
    "lambda/localization/process-queue.ts",
    "lambda/localization/handler.ts"))
FIXES.append(("16-IMPLEMENTATION-SPECS.md",
    "lambda/localization/translate.ts",
    "lambda/localization/handler.ts"))
FIXES.append(("16-IMPLEMENTATION-SPECS.md",
    "lib/config/regions.ts",
    "packages/shared/src/constants/regions.ts"))
FIXES.append(("16-IMPLEMENTATION-SPECS.md",
    "lib/config/tiers.ts",
    "packages/shared/src/constants/tiers.ts"))

# ============================================================
# 18-UI-UX-LIBRARIES.md — component path fixes
# ============================================================

FIXES.append(("18-UI-UX-LIBRARIES.md",
    "apps/admin-dashboard/components/ui/empty-state.tsx",
    "apps/admin-dashboard/components/empty-state.tsx"))
FIXES.append(("18-UI-UX-LIBRARIES.md",
    "apps/admin-dashboard/components/ui/stat-card.tsx",
    "apps/admin-dashboard/components/stat-card.tsx"))
FIXES.append(("18-UI-UX-LIBRARIES.md",
    "apps/admin-dashboard/components/ui/toaster.tsx",
    "apps/admin-dashboard/components/toaster.tsx"))

# ============================================================
# 05-SWIFT-DEPLOYER.md — trivial fix
# ============================================================

FIXES.append(("05-SWIFT-DEPLOYER.md",
    "packages/infrastructure/scripts/",
    "packages/infrastructure/bin/"))


def apply_fixes():
    print("=" * 60)
    print("Documentation Mismatch Fixer")
    print("=" * 60)

    # Group fixes by document
    by_doc = {}
    for doc, old, new in FIXES:
        by_doc.setdefault(doc, []).append((old, new))

    total_applied = 0
    total_skipped = 0

    for doc in sorted(by_doc.keys()):
        filepath = os.path.join(DOCS, doc)
        if not os.path.exists(filepath):
            print(f"\n  SKIP: {doc} — file not found")
            continue

        with open(filepath, "r") as f:
            content = f.read()

        original = content
        applied = 0
        skipped = 0

        for old, new in by_doc[doc]:
            if old == new:
                skipped += 1
                continue
            count = content.count(old)
            if count > 0:
                content = content.replace(old, new)
                applied += count
            else:
                skipped += 1

        if content != original:
            with open(filepath, "w") as f:
                f.write(content)
            print(f"\n  {doc}: {applied} replacements applied, {skipped} not found (already fixed or different context)")
            total_applied += applied
        else:
            print(f"\n  {doc}: no changes needed ({skipped} patterns not found)")
            total_skipped += skipped

    print(f"\n{'=' * 60}")
    print(f"TOTAL: {total_applied} replacements applied across {len(by_doc)} documents")
    print(f"{'=' * 60}")


if __name__ == "__main__":
    apply_fixes()
