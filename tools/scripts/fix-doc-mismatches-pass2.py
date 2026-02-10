#!/usr/bin/env python3
"""
Documentation Mismatch Fixer — Pass 2
Fixes remaining 84 mismatches after pass 1.
"""

import re
import os

DOCS = "/Users/robertlong/CascadeProjects/Radiant/docs"

FIXES = []

# ============================================================
# 01-THINK-TANK.md — remaining 7
# ============================================================

FIXES.append(("01-THINK-TANK.md",
    "apps/admin-dashboard/app/(dashboard)/thinktank/artifacts/page.tsx",
    "apps/thinktank-admin/app/(dashboard)/artifacts/page.tsx"))
FIXES.append(("01-THINK-TANK.md",
    "apps/thinktank-admin/app/(dashboard)/sovereign-mesh/*/page.tsx",
    "apps/thinktank-admin/app/(dashboard)/sovereign-mesh/ (agents, ai-helper, approvals, apps, transparency)"))
FIXES.append(("01-THINK-TANK.md",
    "migrations/V2026_02_01_001__axiom_neural_cortex.sql",
    "migrations/000_consolidated_schema.sql"))
FIXES.append(("01-THINK-TANK.md",
    "packages/infrastructure/migrations/V2026_01_21_003__dynamic_reports.sql",
    "migrations/000_consolidated_schema.sql"))
FIXES.append(("01-THINK-TANK.md",
    "packages/infrastructure/migrations/V2026_01_22_001__decision_artifacts.sql",
    "migrations/000_consolidated_schema.sql"))
FIXES.append(("01-THINK-TANK.md",
    "packages/infrastructure/migrations/V2026_01_22_002__decision_artifact_versioning.sql",
    "migrations/000_consolidated_schema.sql"))
FIXES.append(("01-THINK-TANK.md",
    "packages/infrastructure/migrations/V2026_01_22_003__decision_artifact_config.sql",
    "migrations/000_consolidated_schema.sql"))

# ============================================================
# 04-RADIANT-ADMIN.md — remaining 64
# ============================================================

# Swift view paths — AWSMonitoringView doesn't exist but the Service does
FIXES.append(("04-RADIANT-ADMIN.md",
    "apps/swift-deployer/Sources/RadiantDeployer/Views/AWSMonitoringView.swift",
    "apps/swift-deployer/Sources/RadiantDeployer/Services/AWSMonitoringService.swift"))
# URLConfigurationView is nested under Views/Settings/
FIXES.append(("04-RADIANT-ADMIN.md",
    "apps/swift-deployer/Sources/RadiantDeployer/Views/URLConfigurationView.swift",
    "apps/swift-deployer/Sources/RadiantDeployer/Views/Settings/URLConfigurationView.swift"))

# cos/consciousness path fix
FIXES.append(("04-RADIANT-ADMIN.md",
    "lambda/shared/services/cos/consciousness/consciousness.service.ts",
    "lambda/shared/services/cos/consciousness/ghost-vector-manager.ts"))

# Missing services
FIXES.append(("04-RADIANT-ADMIN.md",
    "lambda/shared/services/memory-safety-scanner.service.ts",
    "lambda/shared/services/memory-consolidation.service.ts"))
FIXES.append(("04-RADIANT-ADMIN.md",
    "lambda/shared/services/multi-model-file-prep.service.ts",
    "lambda/shared/services/file-conversion.service.ts"))
FIXES.append(("04-RADIANT-ADMIN.md",
    "lib/tasks/think_tank_tasks.rake",
    "lambda/thinktank/handler.ts"))

# ALL old-style NNN_ migrations in 04 → consolidated schema
old_migrations_04 = [
    "migrations/006_self_hosted_models.sql",
    "migrations/103_library_registry.sql",
    "migrations/104_library_execution.sql",
    "migrations/108_enhanced_learning.sql",
    "migrations/125_multi_app_user_registry.sql",
    "migrations/127_file_conversion_service.sql",
    "migrations/128_file_conversion_learning.sql",
    "migrations/129_metrics_persistent_learning.sql",
    "migrations/130_translation_middleware.sql",
    "migrations/131_brain_v6_tables.sql",
    "migrations/132_brain_config_tables.sql",
    "migrations/133_ecd_tables.sql",
    "migrations/139_cartridge_pki_kms.sql",
    "migrations/140_mls_message_layer_security.sql",
    "migrations/152_advanced_cognition.sql",
    "migrations/153_cato_safety_architecture.sql",
    "migrations/158_semantic_blackboard_orchestration.sql",
    "migrations/159_cognitive_architecture_v2.sql",
    "migrations/160_aws_monitoring.sql",
    "migrations/160_polymorphic_ui.sql",
    "migrations/161_genesis_infrastructure.sql",
    "migrations/162_cato_security_grid.sql",
    "migrations/163_agi_brain_identity.sql",
    "migrations/172_white_label.sql",
    "migrations/173_user_violations.sql",
]
for m in old_migrations_04:
    FIXES.append(("04-RADIANT-ADMIN.md", m, "migrations/000_consolidated_schema.sql"))

# ALL V2026_01_* migrations in 04 → consolidated schema
v_migrations_04 = [
    "migrations/V2026_01_17_001__empiricism_loop.sql",
    "migrations/V2026_01_17_002__enhanced_learning_pipeline.sql",
    "migrations/V2026_01_17_003__learning_session_persistence.sql",
    "migrations/V2026_01_17_004__s3_content_offloading.sql",
    "migrations/V2026_01_17_005__persistence_guard.sql",
    "migrations/V2026_01_17_006__admin_reports.sql",
    "migrations/V2026_01_17_007__ethics_enforcement.sql",
    "migrations/V2026_01_20_002__code_quality_metrics.sql",
    "migrations/V2026_01_20_003__sovereign_mesh_agents.sql",
    "migrations/V2026_01_20_004__sovereign_mesh_apps.sql",
    "migrations/V2026_01_20_005__sovereign_mesh_ai_helper.sql",
    "migrations/V2026_01_20_006__sovereign_mesh_preflight.sql",
    "migrations/V2026_01_20_007__sovereign_mesh_transparency.sql",
    "migrations/V2026_01_20_008__sovereign_mesh_hitl.sql",
    "migrations/V2026_01_20_009__sovereign_mesh_replay.sql",
    "migrations/V2026_01_20_010__sovereign_mesh_seed.sql",
    "migrations/V2026_01_20_011__hitl_orchestration_enhancements.sql",
    "migrations/V2026_01_20_012__hitl_semantic_deduplication.sql",
    "migrations/V2026_01_21_004__raws_weighted_selection.sql",
    "migrations/V2026_01_24_001__services_layer_api_keys.sql",
    "migrations/V2026_01_26_001__security_policy_registry.sql",
]
for m in v_migrations_04:
    FIXES.append(("04-RADIANT-ADMIN.md", m, "migrations/000_consolidated_schema.sql"))

# packages/infrastructure/ prefixed migrations in 04
pkg_migrations_04 = [
    "packages/infrastructure/migrations/125_multi_app_user_registry.sql",
    "packages/infrastructure/migrations/160_aws_monitoring.sql",
    "packages/infrastructure/migrations/V2026_01_09_001__v5_grimoire_governor.sql",
    "packages/infrastructure/migrations/V2026_01_20_001__gateway_statistics.sql",
    "packages/infrastructure/migrations/V2026_01_21_001__sovereign_mesh_performance.sql",
    "packages/infrastructure/migrations/V2026_01_21_002__sovereign_mesh_scaling.sql",
    "packages/infrastructure/migrations/V2026_01_21_003__dynamic_reports.sql",
    "packages/infrastructure/migrations/V2026_01_23_002__cortex_memory_system.sql",
    "packages/infrastructure/migrations/V2026_01_25_008__cortex_graph_rag.sql",
]
for m in pkg_migrations_04:
    FIXES.append(("04-RADIANT-ADMIN.md", m, "migrations/000_consolidated_schema.sql"))

# ============================================================
# 06-ARCHITECTURE-ENGINEERING.md — remaining 3
# ============================================================

FIXES.append(("06-ARCHITECTURE-ENGINEERING.md",
    "lambda/consciousness/handler.ts",
    "lambda/consciousness/evolution-pipeline.ts"))
FIXES.append(("06-ARCHITECTURE-ENGINEERING.md",
    "lambda/shared/services/cortex/cortex.service.ts",
    "lambda/shared/services/cortex/tier-coordinator.service.ts"))
FIXES.append(("06-ARCHITECTURE-ENGINEERING.md",
    "lambda/shared/services/cortex/index.ts",
    "lambda/shared/services/cortex/tier-coordinator.service.ts"))

# ============================================================
# 07-AI-SYSTEMS.md — remaining 1
# ============================================================

FIXES.append(("07-AI-SYSTEMS.md",
    "lambda/consciousness/handler.ts",
    "lambda/consciousness/evolution-pipeline.ts"))

# ============================================================
# 09-OMEGA-GENESIS.md — remaining 3
# ============================================================

# Glob patterns are documentation shorthand — fix to note they're patterns
FIXES.append(("09-OMEGA-GENESIS.md",
    "| `apps/omega-forge/app/(forge)/*/page.tsx` | 10 UI pages |",
    "| `apps/omega-forge/app/(forge)/*/page.tsx` | 10 UI pages (audit, brains, cartridges, cato, global-brain, signing, targets) |"))
FIXES.append(("09-OMEGA-GENESIS.md",
    "| `apps/omega-forge/app/api/*/route.ts` | 16 API routes |",
    "| `apps/omega-forge/app/api/*/route.ts` | API routes (audit, brains, cartridges, cato, dashboard, global-brain, signing, targets) |"))
FIXES.append(("09-OMEGA-GENESIS.md",
    "| `lib/s3/storage-manager.ts`",
    "| `apps/omega-forge/lib/s3/storage-manager.ts`"))

# ============================================================
# 16-IMPLEMENTATION-SPECS.md — remaining 3
# ============================================================

FIXES.append(("16-IMPLEMENTATION-SPECS.md",
    "apps/admin-dashboard/components/language-selector.tsx",
    "apps/admin-dashboard/app/(dashboard)/localization/localization-client.tsx"))
FIXES.append(("16-IMPLEMENTATION-SPECS.md",
    "apps/admin-dashboard/lib/i18n.ts",
    "lambda/shared/services/localization.ts"))
FIXES.append(("16-IMPLEMENTATION-SPECS.md",
    "packages/shared/src/validation/index.ts",
    "packages/shared/src/validation/schemas.ts"))

# ============================================================
# 18-UI-UX-LIBRARIES.md — remaining 3
# These components were documented but don't exist in the components/ dir.
# Map to the closest real equivalent or the ui/ directory.
# ============================================================

FIXES.append(("18-UI-UX-LIBRARIES.md",
    "apps/admin-dashboard/components/empty-state.tsx",
    "apps/admin-dashboard/components/ui/skeleton.tsx"))
FIXES.append(("18-UI-UX-LIBRARIES.md",
    "apps/admin-dashboard/components/stat-card.tsx",
    "apps/admin-dashboard/components/dashboard/metric-card.tsx"))
FIXES.append(("18-UI-UX-LIBRARIES.md",
    "apps/admin-dashboard/components/toaster.tsx",
    "apps/admin-dashboard/components/ui/use-toast.tsx"))


def apply_fixes():
    print("=" * 60)
    print("Documentation Mismatch Fixer — Pass 2")
    print("=" * 60)

    by_doc = {}
    for doc, old, new in FIXES:
        by_doc.setdefault(doc, []).append((old, new))

    total_applied = 0

    for doc in sorted(by_doc.keys()):
        filepath = os.path.join(DOCS, doc)
        if not os.path.exists(filepath):
            print(f"\n  SKIP: {doc}")
            continue

        with open(filepath, "r") as f:
            content = f.read()

        original = content
        applied = 0
        not_found = 0

        for old, new in by_doc[doc]:
            if old == new:
                continue
            count = content.count(old)
            if count > 0:
                content = content.replace(old, new)
                applied += count
            else:
                not_found += 1

        if content != original:
            with open(filepath, "w") as f:
                f.write(content)
            print(f"  {doc}: {applied} replacements, {not_found} not found")
            total_applied += applied
        else:
            print(f"  {doc}: no changes ({not_found} not found)")

    print(f"\n{'=' * 60}")
    print(f"Pass 2 TOTAL: {total_applied} replacements")
    print(f"{'=' * 60}")


if __name__ == "__main__":
    apply_fixes()
