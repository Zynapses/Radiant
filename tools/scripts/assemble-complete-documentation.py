#!/usr/bin/env python3
"""
RADIANT — Complete Documentation Assembly Script
=================================================

Assembles ALL documentation into a single comprehensive document:
  - Logically ordered by topic (not alphabetical)
  - Part/Chapter/Section structure with page breaks
  - Table of Contents generated from the structure
  - Outputs: .md and .pdf (via pandoc)

Usage:
  python3 tools/scripts/assemble-complete-documentation.py

Outputs:
  docs/publications/RADIANT-THINKTANK-COMPLETE-DOCUMENTATION.md
  docs/publications/RADIANT-THINKTANK-COMPLETE-DOCUMENTATION.pdf
"""

import os
import sys
import subprocess
import datetime
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
DOCS = ROOT / "docs"
OUT_DIR = DOCS / "publications"
OUT_MD = OUT_DIR / "RADIANT-THINKTANK-COMPLETE-DOCUMENTATION.md"
OUT_PDF = OUT_DIR / "RADIANT-THINKTANK-COMPLETE-DOCUMENTATION.pdf"

# ---------------------------------------------------------------------------
# Logical document ordering — each tuple is (Part Title, [(chapter_title, relative_path)])
# Paths are relative to the repo root.
# ---------------------------------------------------------------------------

DOCUMENT_STRUCTURE = [
    ("Applications — Think Tank", [
        ("Think Tank — Complete Reference", "docs/01-THINK-TANK.md"),
    ]),

    ("Applications — Curator", [
        ("Curator — Complete Reference", "docs/02-CURATOR.md"),
    ]),

    ("Applications — Aurelius Dojo", [
        ("Dojo — Complete Reference", "docs/03-DOJO.md"),
    ]),

    ("Applications — Radiant Admin", [
        ("Radiant Admin — Complete Reference", "docs/04-RADIANT-ADMIN.md"),
    ]),

    ("Applications — Swift Deployer", [
        ("Swift Deployer — Complete Reference", "docs/05-SWIFT-DEPLOYER.md"),
    ]),

    ("Architecture & Engineering", [
        ("Architecture & Engineering — Complete Reference", "docs/06-ARCHITECTURE-ENGINEERING.md"),
    ]),

    ("AI Brain Systems", [
        ("AI Brain Systems — Complete Reference", "docs/07-AI-BRAIN-SYSTEMS.md"),
    ]),

    ("CATO Safety System", [
        ("CATO Safety — Complete Reference", "docs/08-CATO-SAFETY.md"),
    ]),

    ("OMEGA Protocol & Genesis", [
        ("OMEGA & Genesis — Complete Reference", "docs/09-OMEGA-GENESIS.md"),
    ]),

    ("Orchestration & Workflows", [
        ("Orchestration & Workflows — Complete Reference", "docs/10-ORCHESTRATION-WORKFLOWS.md"),
    ]),

    ("Data & Storage", [
        ("Data & Storage — Complete Reference", "docs/11-DATA-STORAGE.md"),
    ]),

    ("API Reference", [
        ("API Reference — Complete Reference", "docs/12-API-REFERENCE.md"),
    ]),

    ("Security, Authentication & Compliance", [
        ("Security, Auth & Compliance — Complete Reference", "docs/13-SECURITY-AUTH-COMPLIANCE.md"),
    ]),

    ("Operations & Runbooks", [
        ("Operations & Runbooks — Complete Reference", "docs/14-OPERATIONS-RUNBOOKS.md"),
    ]),

    ("Strategy & Competitive Position", [
        ("Strategy & Competitive — Complete Reference", "docs/15-STRATEGY-COMPETITIVE.md"),
    ]),

    ("Implementation Specifications", [
        ("Implementation Specs — Sections 00–46", "docs/16-IMPLEMENTATION-SPECS.md"),
    ]),

    ("Glossary", [
        ("RADIANT & Think Tank Glossary", "docs/17-GLOSSARY.md"),
    ]),

    ("UI/UX & Libraries", [
        ("UI/UX Design & Libraries", "docs/18-UI-UX-LIBRARIES.md"),
    ]),

    ("Changelog & History", [
        ("Changelog", "CHANGELOG.md"),
        ("Technical Debt", "TECHNICAL_DEBT.md"),
        ("Security Policy", "SECURITY.md"),
        ("Contributing Guide", "CONTRIBUTING.md"),
        ("Code of Conduct", "CODE_OF_CONDUCT.md"),
        ("README", "README.md"),
    ]),
]


def read_version() -> str:
    """Read current RADIANT version."""
    version_file = ROOT / "RADIANT_VERSION"
    if version_file.exists():
        return version_file.read_text().strip()
    version_file = ROOT / "VERSION"
    if version_file.exists():
        return version_file.read_text().strip()
    return "unknown"


def read_doc(rel_path: str) -> str | None:
    """Read a document, return contents or None if missing."""
    full = ROOT / rel_path
    if not full.exists():
        return None
    try:
        return full.read_text(encoding="utf-8", errors="replace")
    except Exception:
        return None


def strip_yaml_frontmatter(content: str) -> str:
    """Strip YAML frontmatter (---...---) from content to prevent pandoc conflicts."""
    if not content.startswith("---"):
        return content
    lines = content.split("\n")
    # Find closing ---
    for i in range(1, len(lines)):
        if lines[i].strip() == "---":
            # Return everything after the frontmatter
            rest = "\n".join(lines[i + 1:])
            return rest.lstrip("\n")
    return content


def strip_title(content: str) -> str:
    """Strip YAML frontmatter and leading H1 header line from content."""
    content = strip_yaml_frontmatter(content)
    lines = content.split("\n")
    # Remove leading blank lines
    while lines and not lines[0].strip():
        lines.pop(0)
    # Remove H1 line if present
    if lines and lines[0].startswith("# "):
        lines.pop(0)
        # Remove blank line after H1
        while lines and not lines[0].strip():
            lines.pop(0)
    return "\n".join(lines)


def build_toc(structure: list) -> str:
    """Build a table of contents from the document structure."""
    toc_lines = []
    for part_idx, (part_title, chapters) in enumerate(structure, 1):
        toc_lines.append(f"### Part {part_idx}: {part_title}\n")
        for chap_idx, (chap_title, rel_path) in enumerate(chapters, 1):
            exists = (ROOT / rel_path).exists()
            marker = "" if exists else " *(not found)*"
            toc_lines.append(f"  {part_idx}.{chap_idx}. {chap_title}{marker}")
        toc_lines.append("")
    return "\n".join(toc_lines)


def assemble() -> str:
    """Assemble the complete documentation."""
    version = read_version()
    now = datetime.datetime.now().strftime("%B %d, %Y")
    
    parts = []
    
    # Title page (no YAML frontmatter in assembled .md — pandoc metadata passed via CLI)
    parts.append(f"""# RADIANT & Think Tank — Complete Documentation

**Version {version}** | **Generated {now}** | **Zynapses Inc.**

> This document is the single authoritative assembly of ALL RADIANT and Think Tank
> documentation. It is auto-generated from the source documentation files in the
> repository. To regenerate, run:
>
> ```bash
> python3 tools/scripts/assemble-complete-documentation.py
> ```

---

## Table of Contents

{build_toc(DOCUMENT_STRUCTURE)}

---
""")

    stats = {"parts": 0, "chapters": 0, "included": 0, "missing": 0, "total_lines": 0}
    
    for part_idx, (part_title, chapters) in enumerate(DOCUMENT_STRUCTURE, 1):
        stats["parts"] += 1
        
        # Part header with page break
        parts.append(f"\n\\newpage\n\n# Part {part_idx}: {part_title}\n\n---\n")
        
        for chap_idx, (chap_title, rel_path) in enumerate(chapters, 1):
            stats["chapters"] += 1
            content = read_doc(rel_path)
            
            if content is None:
                stats["missing"] += 1
                parts.append(f"\n## {part_idx}.{chap_idx} {chap_title}\n\n")
                parts.append(f"> **Note:** Source file `{rel_path}` not found in repository.\n\n")
                continue
            
            stats["included"] += 1
            line_count = content.count("\n")
            stats["total_lines"] += line_count
            
            # Chapter header
            parts.append(f"\n\\newpage\n\n## {part_idx}.{chap_idx} {chap_title}\n\n")
            parts.append(f"*Source: `{rel_path}` ({line_count:,} lines)*\n\n---\n\n")
            
            # Content with H1 stripped (we added our own header)
            cleaned = strip_title(content)
            parts.append(cleaned)
            parts.append("\n\n")
    
    # Assembly statistics footer
    parts.append(f"""
\\newpage

# Assembly Statistics

| Metric | Value |
|--------|-------|
| **Parts** | {stats["parts"]} |
| **Chapters** | {stats["chapters"]} |
| **Documents Included** | {stats["included"]} |
| **Documents Missing** | {stats["missing"]} |
| **Total Source Lines** | {stats["total_lines"]:,} |
| **Generated** | {now} |
| **RADIANT Version** | v{version} |

---

*This document was auto-generated by `tools/scripts/assemble-complete-documentation.py`.*
*To update, re-run the script after making documentation changes.*
""")

    return "\n".join(parts)


def main():
    print(f"RADIANT Documentation Assembly")
    print(f"==============================")
    print(f"Root: {ROOT}")
    print(f"Version: {read_version()}")
    print()

    # Ensure output directory exists
    OUT_DIR.mkdir(parents=True, exist_ok=True)

    # Assemble markdown
    print("Assembling comprehensive documentation...")
    md_content = assemble()
    
    OUT_MD.write_text(md_content, encoding="utf-8")
    md_size = OUT_MD.stat().st_size
    md_lines = md_content.count("\n")
    print(f"  ✅ Markdown: {OUT_MD.name} ({md_lines:,} lines, {md_size / 1_048_576:.1f} MB)")

    # Generate PDF via pandoc
    version = read_version()
    print("Generating PDF via pandoc (this may take a few minutes for large documents)...")

    # Pandoc engines to try in order
    # Disable tex_math_dollars and tex_math_single_backslash to prevent
    # dollar signs and backslashes in docs from being interpreted as LaTeX math
    md_format = "markdown-yaml_metadata_block-tex_math_dollars-tex_math_single_backslash-raw_tex"

    engines = [
        ("xelatex", [
            "pandoc",
            str(OUT_MD),
            "-o", str(OUT_PDF),
            f"--from={md_format}",
            "--pdf-engine=xelatex",
            "--toc",
            "--toc-depth=2",
            "-V", "geometry:margin=0.8in",
            "-V", "fontsize=10pt",
            "-V", "documentclass=report",
            "-V", f"title=RADIANT \\& Think Tank — Complete Documentation v{version}",
            "-V", "author=Zynapses Inc.",
            "-V", "mainfont=Helvetica",
            "-V", "monofont=Menlo",
            "-V", "colorlinks=true",
            "-V", "linkcolor=blue",
            "-V", "urlcolor=blue",
        ]),
        ("pdflatex", [
            "pandoc",
            str(OUT_MD),
            "-o", str(OUT_PDF),
            f"--from={md_format}",
            "--pdf-engine=pdflatex",
            "--toc",
            "--toc-depth=2",
            "-V", "geometry:margin=0.8in",
            "-V", "fontsize=10pt",
            "-V", "documentclass=report",
            "-V", f"title=RADIANT \\& Think Tank — Complete Documentation v{version}",
            "-V", "author=Zynapses Inc.",
            "-V", "colorlinks=true",
        ]),
    ]

    pdf_ok = False
    try:
        for engine_name, cmd in engines:
            print(f"  Trying {engine_name}...")
            result = subprocess.run(
                cmd,
                capture_output=True,
                text=True,
                timeout=600,
            )
            if result.returncode == 0:
                pdf_size = OUT_PDF.stat().st_size
                print(f"  ✅ PDF: {OUT_PDF.name} ({pdf_size / 1_048_576:.1f} MB)")
                pdf_ok = True
                break
            else:
                stderr_snippet = (result.stderr or "")[:1500]
                print(f"  ⚠ {engine_name} failed: {stderr_snippet[:200]}...")

        if not pdf_ok:
            print(f"  ❌ All PDF engines failed.")
            print(f"  💡 The .md file was generated successfully. You can convert manually:")
            print(f"     pandoc {OUT_MD} -o {OUT_PDF} --from=markdown-yaml_metadata_block")
    except FileNotFoundError:
        print(f"  ❌ pandoc not found. Install with: brew install pandoc")
        print(f"  💡 The .md file was generated successfully.")
    except subprocess.TimeoutExpired:
        print(f"  ❌ PDF generation timed out (>10 min). The document may be too large.")
        print(f"  💡 The .md file was generated successfully.")

    print()
    print(f"Done! Files in: {OUT_DIR}/")
    print(f"  📄 {OUT_MD.name}")
    if OUT_PDF.exists():
        print(f"  📕 {OUT_PDF.name}")


if __name__ == "__main__":
    main()
