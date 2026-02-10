#!/usr/bin/env python3
"""
Documentation Merge Script — v7.55.0
Merges redundant documentation files while preserving ALL detail.
Archived source files get a DEPRECATED header and move to docs/archive/pre-merge-2026-02-10/.
"""

import os
import shutil
from datetime import datetime

DOCS = "/Users/robertlong/CascadeProjects/Radiant/docs"
ARCHIVE = os.path.join(DOCS, "archive", "pre-merge-2026-02-10")

DEPRECATED_HEADER = """<!--
╔══════════════════════════════════════════════════════════════════╗
║  DEPRECATED — {date}                                           ║
║  This file has been merged into: {target}                      ║
║  It is kept in git for historical reference only.              ║
║  DO NOT EDIT — all future changes go to the target document.   ║
╚══════════════════════════════════════════════════════════════════╝
-->

"""

def read(path):
    with open(path, "r") as f:
        return f.read()

def readlines(path):
    with open(path, "r") as f:
        return f.readlines()

def write(path, content):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, "w") as f:
        f.write(content)

def archive_with_deprecated(src_path, target_doc_name):
    """Copy file to archive with DEPRECATED header, keeping original in git."""
    filename = os.path.basename(src_path)
    archive_path = os.path.join(ARCHIVE, filename)
    content = read(src_path)
    header = DEPRECATED_HEADER.format(
        date=datetime.now().strftime("%Y-%m-%d"),
        target=target_doc_name
    )
    write(archive_path, header + content)
    print(f"  Archived: {filename} → archive/pre-merge-2026-02-10/{filename}")
    # Remove the original from docs/
    os.remove(src_path)
    print(f"  Removed:  docs/{filename}")

def merge_19_into_09_and_marketing_to_15():
    """
    M1 + D: Merge 19-OMEGA-QUANTUM-MODEL-AI.md into 09-OMEGA-GENESIS.md.
    Move marketing content (lines 2349-2548 of 09) into 15-STRATEGY-COMPETITIVE.md.
    """
    print("\n=== M1+D: Merge 19 → 09, marketing → 15 ===")
    
    lines_09 = readlines(os.path.join(DOCS, "09-OMEGA-GENESIS.md"))
    content_19 = read(os.path.join(DOCS, "19-OMEGA-QUANTUM-MODEL-AI.md"))
    content_15 = read(os.path.join(DOCS, "15-STRATEGY-COMPETITIVE.md"))
    
    # Extract marketing from 09 (lines 2349-2548, 0-indexed: 2348-2548)
    # Find the exact boundaries
    marketing_start = None
    marketing_end = None
    for i, line in enumerate(lines_09):
        if line.strip() == "# PART I: MARKETING & POSITIONING":
            marketing_start = i
        if marketing_start and line.strip() == "# PART II: TECHNICAL DOCUMENTATION":
            marketing_end = i
            break
    
    if marketing_start and marketing_end:
        marketing_lines = lines_09[marketing_start:marketing_end]
        marketing_content = "".join(marketing_lines)
        
        # Build new 09: everything before marketing + everything after marketing + 19 content
        before_marketing = lines_09[:marketing_start]
        after_marketing = lines_09[marketing_end:]
        
        # Strip 19's own header (first ~25 lines) and footer (last ~3 lines)
        lines_19 = content_19.split("\n")
        # Find where Part I starts in 19
        part1_start = 0
        for i, line in enumerate(lines_19):
            if line.startswith("## Part I: The Five Pillars"):
                part1_start = i
                break
        # Find footer
        footer_start = len(lines_19)
        for i in range(len(lines_19) - 1, -1, -1):
            if lines_19[i].startswith("*Document 19"):
                footer_start = i
                break
        
        content_19_body = "\n".join(lines_19[part1_start:footer_start])
        
        # Build new 09 content
        new_09 = "".join(before_marketing) + "".join(after_marketing)
        
        # Remove old footer from 09
        if new_09.rstrip().endswith("*Consolidated from 8 source documents (0 not found). 2,999 source lines.*"):
            new_09 = new_09[:new_09.rfind("*Consolidated from")]
        
        # Append 19's content as new Parts
        new_09 += "\n\n---\n\n"
        new_09 += "## Part X: Five Pillars of Computational Architecture (v7.50.0)\n\n"
        new_09 += "> *Merged from `19-OMEGA-QUANTUM-MODEL-AI.md` — all OMEGA Quantum, Model Routing, Firmware, Cartridge, and Global Brain content consolidated here.*\n\n"
        new_09 += content_19_body + "\n"
        new_09 += "\n---\n\n"
        new_09 += "*OMEGA Complete Reference — consolidated from docs 09 + 19. All OMEGA-related changes MUST be documented in this file.*\n"
        
        # Update 09's header TOC
        old_toc = """## Table of Contents

- **Part I: OMEGA User Guide**
- **Part II: OMEGA Admin Guide**
- **Part III: Project Genesis OMEGA**
- **Part IV: OMEGA Forge Components**
- **Part V: Omega Point & LIVS-M**
- **Part VI: Quantum-Inspired Architecture (v4.18.0)**
- **Part VII: Firmware Hot-Swap Engineering Specification (v6.4.0)**
- **Part VIII: Firmware Live Updates — End-User Guide (v6.4.0)**
- **Part IX: OMEGA Forge — System Admin Application (v7.50.0)**"""

        new_toc = """## Table of Contents

- **Part I: OMEGA User Guide**
- **Part II: OMEGA Admin Guide**
- **Part III: Project Genesis OMEGA**
- **Part IV: OMEGA Forge Components**
- **Part V: Omega Point & LIVS-M**
- **Part VI: Quantum-Inspired Architecture (v4.18.0)**
- **Part VII: Firmware Hot-Swap Engineering Specification (v6.4.0)**
- **Part VIII: Firmware Live Updates — End-User Guide (v6.4.0)**
- **Part IX: OMEGA Forge — System Admin Application (v7.50.0)**
- **Part X: Five Pillars of Computational Architecture (v7.50.0)**"""

        new_09 = new_09.replace(old_toc, new_toc)
        
        # Update version
        new_09 = new_09.replace(
            "*RADIANT v6.6.0 — Generated February 07, 2026*",
            "*RADIANT v7.55.0 — Updated February 10, 2026*"
        )
        
        write(os.path.join(DOCS, "09-OMEGA-GENESIS.md"), new_09)
        print(f"  Updated: 09-OMEGA-GENESIS.md (+{len(content_19_body.splitlines())} lines from 19, -{len(marketing_lines)} marketing lines)")
        
        # Append marketing to 15
        marketing_section = "\n\n---\n\n"
        marketing_section += "## Part IX: Autonomous Organism — Marketing & Positioning\n\n"
        marketing_section += "> *Merged from `09-OMEGA-GENESIS.md` (Autonomous Organism section) — all marketing and competitive positioning content consolidated here.*\n\n"
        marketing_section += marketing_content
        
        # Remove old footer from 15 if present
        if content_15.rstrip().endswith("*"):
            # Find last line starting with *Consolidated
            idx = content_15.rfind("\n*Consolidated from")
            if idx > 0:
                content_15 = content_15[:idx]
        
        new_15 = content_15.rstrip() + "\n" + marketing_section
        write(os.path.join(DOCS, "15-STRATEGY-COMPETITIVE.md"), new_15)
        print(f"  Updated: 15-STRATEGY-COMPETITIVE.md (+{len(marketing_lines)} marketing lines)")
    else:
        print("  WARNING: Could not find marketing section boundaries in 09")
    
    # Archive 19
    archive_with_deprecated(
        os.path.join(DOCS, "19-OMEGA-QUANTUM-MODEL-AI.md"),
        "09-OMEGA-GENESIS.md"
    )

def merge_mac_docs_into_01():
    """M2: Merge THINKTANK-MAC-GUIDE.md + THINKTANK-MAC-PORTABILITY-MANIFEST.md into 01."""
    print("\n=== M2: Merge Mac docs → 01-THINK-TANK.md ===")
    
    content_01 = read(os.path.join(DOCS, "01-THINK-TANK.md"))
    content_mac_guide = read(os.path.join(DOCS, "THINKTANK-MAC-GUIDE.md"))
    content_mac_manifest = read(os.path.join(DOCS, "THINKTANK-MAC-PORTABILITY-MANIFEST.md"))
    
    # Remove old footer from 01
    footer_marker = "\n*Consolidated from"
    if footer_marker in content_01:
        content_01 = content_01[:content_01.rfind(footer_marker)]
    
    # Append Mac Guide as new Part
    appendix = "\n\n---\n\n"
    appendix += "## Part XI: Think Tank macOS Native Client — User Guide\n\n"
    appendix += "> *Merged from `THINKTANK-MAC-GUIDE.md` — complete Mac app user guide consolidated here.*\n\n"
    # Skip the Mac guide's own H1 header
    mac_lines = content_mac_guide.split("\n")
    for i, line in enumerate(mac_lines):
        if line.startswith("## Table of Contents") or line.startswith("## 1."):
            mac_body = "\n".join(mac_lines[i:])
            break
    else:
        mac_body = content_mac_guide
    appendix += mac_body + "\n"
    
    # Append Portability Manifest as new Part
    appendix += "\n\n---\n\n"
    appendix += "## Part XII: Think Tank — Mac Portability Manifest\n\n"
    appendix += "> *Merged from `THINKTANK-MAC-PORTABILITY-MANIFEST.md` — feature parity matrix and technology adaptation map.*\n\n"
    manifest_lines = content_mac_manifest.split("\n")
    for i, line in enumerate(manifest_lines):
        if line.startswith("## Feature Parity Matrix") or line.startswith("This document is"):
            manifest_body = "\n".join(manifest_lines[i:])
            break
    else:
        manifest_body = content_mac_manifest
    appendix += manifest_body + "\n"
    
    appendix += "\n---\n\n"
    appendix += "*Think Tank Complete Reference — consolidated from original 01 + Mac Guide + Mac Portability Manifest.*\n"
    
    new_01 = content_01.rstrip() + appendix
    write(os.path.join(DOCS, "01-THINK-TANK.md"), new_01)
    print(f"  Updated: 01-THINK-TANK.md (+{len(content_mac_guide.splitlines()) + len(content_mac_manifest.splitlines())} lines)")
    
    # Archive Mac docs
    archive_with_deprecated(os.path.join(DOCS, "THINKTANK-MAC-GUIDE.md"), "01-THINK-TANK.md")
    archive_with_deprecated(os.path.join(DOCS, "THINKTANK-MAC-PORTABILITY-MANIFEST.md"), "01-THINK-TANK.md")

def archive_executive_report():
    """M3: Archive EXECUTIVE-REPORT to historical."""
    print("\n=== M3: Archive Executive Report ===")
    archive_with_deprecated(
        os.path.join(DOCS, "EXECUTIVE-REPORT-2026-02-09.md"),
        "docs/archive/historical/ (point-in-time report)"
    )

def merge_08_into_07():
    """M4: Merge 08-CATO-SAFETY.md into 07-AI-BRAIN-SYSTEMS.md → 07-AI-SYSTEMS.md"""
    print("\n=== M4: Merge 08 → 07 (AI Systems) ===")
    
    content_07 = read(os.path.join(DOCS, "07-AI-BRAIN-SYSTEMS.md"))
    content_08 = read(os.path.join(DOCS, "08-CATO-SAFETY.md"))
    
    # Remove old footer from 07
    footer_marker = "\n*Consolidated from"
    if footer_marker in content_07:
        content_07 = content_07[:content_07.rfind(footer_marker)]
    
    # Strip 08's H1 header to avoid duplicate
    lines_08 = content_08.split("\n")
    for i, line in enumerate(lines_08):
        if line.startswith("## Table of Contents") or line.startswith("## Part I") or (line.startswith("---") and i > 5):
            body_08 = "\n".join(lines_08[i:])
            break
    else:
        body_08 = content_08
    
    # Rename 07 header
    content_07 = content_07.replace(
        "# AI Brain Systems",
        "# AI Systems — Brain, Consciousness & CATO Safety"
    )
    content_07 = content_07.replace(
        "**AGI Brain • Consciousness • Cognitive Framework • Cortex Memory • Expert Adapters**",
        "**AGI Brain • Consciousness • Cognitive Framework • Cortex Memory • Expert Adapters • CATO Safety • Ethics**"
    )
    
    appendix = "\n\n---\n\n"
    appendix += "# CATO Safety System\n\n"
    appendix += "> *Merged from `08-CATO-SAFETY.md` — complete CATO safety system documentation consolidated here.*\n\n"
    appendix += body_08 + "\n"
    appendix += "\n---\n\n"
    appendix += "*AI Systems Complete Reference — consolidated from docs 07 (Brain) + 08 (CATO Safety).*\n"
    
    new_07 = content_07.rstrip() + appendix
    write(os.path.join(DOCS, "07-AI-SYSTEMS.md"), new_07)
    print(f"  Created: 07-AI-SYSTEMS.md ({len(new_07.splitlines())} lines)")
    
    # Remove old 07 and archive 08
    if os.path.exists(os.path.join(DOCS, "07-AI-BRAIN-SYSTEMS.md")):
        os.remove(os.path.join(DOCS, "07-AI-BRAIN-SYSTEMS.md"))
        print(f"  Removed: 07-AI-BRAIN-SYSTEMS.md (replaced by 07-AI-SYSTEMS.md)")
    archive_with_deprecated(os.path.join(DOCS, "08-CATO-SAFETY.md"), "07-AI-SYSTEMS.md")

def merge_11_into_06():
    """M5: Merge 11-DATA-STORAGE.md into 06-ARCHITECTURE-ENGINEERING.md"""
    print("\n=== M5: Merge 11 → 06 ===")
    
    content_06 = read(os.path.join(DOCS, "06-ARCHITECTURE-ENGINEERING.md"))
    content_11 = read(os.path.join(DOCS, "11-DATA-STORAGE.md"))
    
    # Remove old footer from 06
    footer_marker = "\n*Consolidated from"
    if footer_marker in content_06:
        content_06 = content_06[:content_06.rfind(footer_marker)]
    
    # Strip 11's H1 header
    lines_11 = content_11.split("\n")
    for i, line in enumerate(lines_11):
        if line.startswith("## Table of Contents") or line.startswith("## Part I") or (line.startswith("---") and i > 5):
            body_11 = "\n".join(lines_11[i:])
            break
    else:
        body_11 = content_11
    
    # Update 06 header
    content_06 = content_06.replace(
        "**Architecture • CDK • Engineering Vision • Gateway • App Isolation**",
        "**Architecture • CDK • Engineering Vision • Gateway • App Isolation • Data & Storage**"
    )
    
    appendix = "\n\n---\n\n"
    appendix += "# Data & Storage\n\n"
    appendix += "> *Merged from `11-DATA-STORAGE.md` — UDS, RAWS, data retention, cost optimization, file conversion.*\n\n"
    appendix += body_11 + "\n"
    appendix += "\n---\n\n"
    appendix += "*Architecture & Engineering Complete Reference — consolidated from docs 06 + 11 (Data & Storage).*\n"
    
    new_06 = content_06.rstrip() + appendix
    write(os.path.join(DOCS, "06-ARCHITECTURE-ENGINEERING.md"), new_06)
    print(f"  Updated: 06-ARCHITECTURE-ENGINEERING.md (+{len(content_11.splitlines())} lines)")
    
    archive_with_deprecated(os.path.join(DOCS, "11-DATA-STORAGE.md"), "06-ARCHITECTURE-ENGINEERING.md")

def merge_03_into_01():
    """M6: Merge 03-DOJO.md into 01-THINK-TANK.md"""
    print("\n=== M6: Merge 03 → 01 ===")
    
    content_01 = read(os.path.join(DOCS, "01-THINK-TANK.md"))
    content_03 = read(os.path.join(DOCS, "03-DOJO.md"))
    
    # Remove old footer from 01 (may have been updated by M2)
    footer_marker = "*Think Tank Complete Reference"
    if footer_marker in content_01:
        content_01 = content_01[:content_01.rfind(footer_marker)]
    
    # Strip 03's H1 header
    lines_03 = content_03.split("\n")
    for i, line in enumerate(lines_03):
        if line.startswith("## Table of Contents") or line.startswith("## Part I") or line.startswith("## 1. What"):
            body_03 = "\n".join(lines_03[i:])
            break
    else:
        body_03 = content_03
    
    appendix = "\n\n---\n\n"
    appendix += "## Part XIII: Aurelius Dojo — Training System\n\n"
    appendix += "> *Merged from `03-DOJO.md` — complete Dojo training platform reference.*\n\n"
    appendix += body_03 + "\n"
    appendix += "\n---\n\n"
    appendix += "*Think Tank Complete Reference — consolidated from original 01 + Mac Guide + Mac Portability Manifest + Dojo.*\n"
    
    new_01 = content_01.rstrip() + appendix
    write(os.path.join(DOCS, "01-THINK-TANK.md"), new_01)
    print(f"  Updated: 01-THINK-TANK.md (+{len(content_03.splitlines())} Dojo lines)")
    
    archive_with_deprecated(os.path.join(DOCS, "03-DOJO.md"), "01-THINK-TANK.md")

def main():
    print("=" * 60)
    print("RADIANT Documentation Merge — v7.55.0")
    print("=" * 60)
    
    # Create archive directory
    os.makedirs(ARCHIVE, exist_ok=True)
    print(f"\nArchive directory: {ARCHIVE}")
    
    # Execute merges in dependency order
    # M1+D first (modifies 09, 15; archives 19)
    merge_19_into_09_and_marketing_to_15()
    
    # M2: Mac docs → 01
    merge_mac_docs_into_01()
    
    # M3: Archive executive report
    archive_executive_report()
    
    # M4: 08 → 07
    merge_08_into_07()
    
    # M5: 11 → 06
    merge_11_into_06()
    
    # M6: 03 → 01 (must come after M2 since both modify 01)
    merge_03_into_01()
    
    # Summary
    print("\n" + "=" * 60)
    print("MERGE COMPLETE")
    print("=" * 60)
    
    remaining = []
    for f in sorted(os.listdir(DOCS)):
        if f.endswith(".md") and not f.startswith("."):
            path = os.path.join(DOCS, f)
            if os.path.isfile(path):
                lines = len(readlines(path))
                remaining.append((f, lines))
    
    print(f"\nRemaining docs ({len(remaining)} files):")
    total = 0
    for f, lines in remaining:
        print(f"  {f:50s} {lines:>6,} lines")
        total += lines
    print(f"  {'TOTAL':50s} {total:>6,} lines")
    
    archived = []
    if os.path.exists(ARCHIVE):
        for f in sorted(os.listdir(ARCHIVE)):
            if f.endswith(".md"):
                archived.append(f)
    
    print(f"\nArchived ({len(archived)} files in {os.path.basename(ARCHIVE)}/):")
    for f in archived:
        print(f"  {f}")

if __name__ == "__main__":
    main()
