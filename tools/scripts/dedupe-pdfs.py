#!/usr/bin/env python3
"""
Deduplicate PDFs - keep only latest version of each document.
"""

import os
import shutil
from pathlib import Path

PDF_DIR = Path("/Users/robertlong/CascadeProjects/Radiant/docs/pdf")
OUTPUT_DIR = Path("/Users/robertlong/CascadeProjects/Radiant/docs/pdf-latest")

# Files to EXCLUDE (duplicates, older versions, code exports)
EXCLUDE = {
    # Older versions (keep v2/latest)
    "CATO-GENESIS-SYSTEM-FULL.pdf",  # keep v2
    "docs_THINKTANK-ADMIN-GUIDE.pdf",  # keep V2
    
    # Duplicates - keep docs_ prefixed versions
    "Think-Tank-User-Guide.pdf",  # duplicate of docs_THINKTANK-USER-GUIDE.pdf
    "RADIANT-Deployer-Admin-Guide.pdf",  # duplicate
    "RADIANT-Platform-Admin-Guide.pdf",  # duplicate of docs_RADIANT-PLATFORM-ARCHITECTURE.pdf
    "RADIANT-Session-Changes-2024-12-28.pdf",  # duplicate
    "RADIANT-Complete-Documentation-v4.18.2.pdf",  # outdated version
    "2025-01-15-CATO-GENESIS-SYSTEM.pdf",  # duplicate of docs_progress version
    "TECHNICAL_DEBT.pdf",  # duplicate
    
    # Runbook duplicates
    "docs_runbooks_INCIDENT_RESPONSE.pdf",  # underscore version, keep hyphen
    
    # Publication duplicates (combined/complete are redundant)
    "docs_publications_RADIANT-COMBINED.pdf",
    "docs_publications_RADIANT-COMPLETE.pdf",
    "docs_publications_RADIANT-FULL-DOCUMENTATION.pdf",
    
    # Code exports (not documentation)
    "docs_exports_GRIMOIRE-GOVERNOR-SOURCE-PART1.pdf",
    "docs_exports_GRIMOIRE-GOVERNOR-SOURCE-PART2.pdf",
    "docs_exports_GRIMOIRE-GOVERNOR-SOURCE-PART3.pdf",
    "docs_exports_GRIMOIRE-GOVERNOR-SOURCE-PART4.pdf",
    "docs_exports_GRIMOIRE-GOVERNOR-SOURCE-PART5.pdf",
    "docs_exports_RADIANT-ADMIN-DASHBOARD.pdf",
    "docs_exports_RADIANT-CDK-STACKS.pdf",
    "docs_exports_RADIANT-DATABASE-MIGRATIONS.pdf",
    "docs_exports_RADIANT-FLYTE-WORKFLOWS.pdf",
    "docs_exports_RADIANT-LAMBDA-HANDLERS.pdf",
    "docs_exports_RADIANT-SHARED-TYPES.pdf",
    "docs_exports_RADIANT-SWIFT-DEPLOYER.pdf",
    "docs_exports_SWIFT-SOURCE-CODE-PART1.pdf",
    "docs_exports_SWIFT-SOURCE-CODE-PART2.pdf",
    "docs_exports_SWIFT-SOURCE-CODE-PART3.pdf",
    
    # Duplicate user guides
    "docs_THINK-TANK-USER-GUIDE.pdf",  # keep THINKTANK version
    
    # Outdated progress/change reports
    "docs_CHANGES-20H.pdf",
    "docs_CHANGES-20HR-SUMMARY.pdf",
    "docs_CHANGE-REPORT-2026-01-10.pdf",
    
    # Duplicate admin guides
    "docs_ADMINISTRATOR-GUIDE.pdf",  # keep RADIANT-ADMIN-GUIDE
    "docs_DEPLOYER-ADMIN-GUIDE.pdf",  # duplicate
    
    # Section header/readme (redundant)
    "docs_sections_00-HEADER-AND-OVERVIEW.pdf",
    "docs_sections_README.pdf",
    
    # Duplicate complete docs
    "docs_RADIANT-COMPLETE-DOCUMENTATION.pdf",
    
    # Duplicate cato docs
    "docs_CATO-GENESIS-SYSTEM.pdf",  # keep FULL-v2
    "docs_CATO-COMPLETE-DOCUMENTATION.pdf",  # redundant
    
    # Gap analysis (internal only)
    "docs_CDK-HANDLER-GAP-ANALYSIS.pdf",
    "docs_THINKTANK-ADMIN-API-GAP-ANALYSIS.pdf",
    "docs_THINKTANK-CONSUMER-GAP-ANALYSIS.pdf",
    
    # Session changes (outdated)
    "docs_SESSION-CHANGES-2024-12-28.pdf",
    
    # Index file (not useful as PDF)
    "docs_INDEX.pdf",
    "docs_exports_RADIANT-COMPLETE-INDEX.pdf",
}

def main():
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    
    # Clear output directory
    for f in OUTPUT_DIR.glob("*.pdf"):
        f.unlink()
    
    copied = 0
    skipped = 0
    
    for pdf in sorted(PDF_DIR.glob("*.pdf")):
        if pdf.name in EXCLUDE:
            print(f"  SKIP: {pdf.name}")
            skipped += 1
        else:
            shutil.copy2(pdf, OUTPUT_DIR / pdf.name)
            copied += 1
    
    print()
    print(f"✅ Copied: {copied} PDFs")
    print(f"❌ Skipped: {skipped} duplicates/exports")
    print(f"📂 Output: {OUTPUT_DIR}")

if __name__ == "__main__":
    main()
