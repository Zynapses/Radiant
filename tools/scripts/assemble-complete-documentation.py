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
import unicodedata
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
        ("Think Tank (Mac) — User Guide", "docs/THINKTANK-MAC-GUIDE.md"),
        ("Think Tank (Mac) — Portability Manifest", "docs/THINKTANK-MAC-PORTABILITY-MANIFEST.md"),
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


def sanitize_for_pdf(content: str) -> str:
    """Replace ALL problematic Unicode with safe ASCII for LaTeX PDF rendering.
    
    Handles ~250K+ characters across the documentation:
    - Box-drawing characters (U+2500-U+257F) -> ASCII art
    - Block elements (U+2580-U+259F) -> removed
    - Smart quotes / dashes -> ASCII equivalents
    - Emoji -> bracketed text labels
    - U+FFFD replacement characters -> removed
    - Variation selectors -> removed
    - Non-breaking spaces -> regular spaces
    """
    # ── Phase 1: Fast string replacements (most common first by frequency) ──

    replacements = {
        # Box-drawing: LIGHT lines (186K+ occurrences)
        "─": "-",   # U+2500 BOX DRAWINGS LIGHT HORIZONTAL
        "│": "|",   # U+2502 BOX DRAWINGS LIGHT VERTICAL
        "┌": "+",   # U+250C BOX DRAWINGS LIGHT DOWN AND RIGHT
        "┐": "+",   # U+2510 BOX DRAWINGS LIGHT DOWN AND LEFT
        "└": "+",   # U+2514 BOX DRAWINGS LIGHT UP AND RIGHT
        "┘": "+",   # U+2518 BOX DRAWINGS LIGHT UP AND LEFT
        "├": "+",   # U+251C BOX DRAWINGS LIGHT VERTICAL AND RIGHT
        "┤": "+",   # U+2524 BOX DRAWINGS LIGHT VERTICAL AND LEFT
        "┬": "+",   # U+252C BOX DRAWINGS LIGHT DOWN AND HORIZONTAL
        "┴": "+",   # U+2534 BOX DRAWINGS LIGHT UP AND HORIZONTAL
        "┼": "+",   # U+253C BOX DRAWINGS LIGHT VERTICAL AND HORIZONTAL
        # Box-drawing: DOUBLE lines (14K+)
        "═": "=",   # U+2550 BOX DRAWINGS DOUBLE HORIZONTAL
        "║": "|",   # U+2551 BOX DRAWINGS DOUBLE VERTICAL
        "╔": "+",   # U+2554 BOX DRAWINGS DOUBLE DOWN AND RIGHT
        "╗": "+",   # U+2557 BOX DRAWINGS DOUBLE DOWN AND LEFT
        "╚": "+",   # U+255A BOX DRAWINGS DOUBLE UP AND RIGHT
        "╝": "+",   # U+255D BOX DRAWINGS DOUBLE UP AND LEFT
        "╠": "+",   # U+2560 BOX DRAWINGS DOUBLE VERTICAL AND RIGHT
        "╣": "+",   # U+2563 BOX DRAWINGS DOUBLE VERTICAL AND LEFT
        "╦": "+",   # U+2566 BOX DRAWINGS DOUBLE DOWN AND HORIZONTAL
        "╩": "+",   # U+2569 BOX DRAWINGS DOUBLE UP AND HORIZONTAL
        "╬": "+",   # U+256C BOX DRAWINGS DOUBLE VERTICAL AND HORIZONTAL
        # Box-drawing: ROUNDED corners
        "╭": "+",   # U+256D BOX DRAWINGS LIGHT ARC DOWN AND RIGHT
        "╮": "+",   # U+256E BOX DRAWINGS LIGHT ARC DOWN AND LEFT
        "╯": "+",   # U+256F BOX DRAWINGS LIGHT ARC UP AND LEFT
        "╰": "+",   # U+2570 BOX DRAWINGS LIGHT ARC UP AND RIGHT
        # Box-drawing: HEAVY lines
        "━": "-",   # U+2501 BOX DRAWINGS HEAVY HORIZONTAL
        "┃": "|",   # U+2503 BOX DRAWINGS HEAVY VERTICAL
        "┏": "+",   # U+250F BOX DRAWINGS HEAVY DOWN AND RIGHT
        "┓": "+",   # U+2513 BOX DRAWINGS HEAVY DOWN AND LEFT
        "┗": "+",   # U+2517 BOX DRAWINGS HEAVY UP AND RIGHT
        "┛": "+",   # U+251B BOX DRAWINGS HEAVY UP AND LEFT
        "┣": "+",   # U+2523 BOX DRAWINGS HEAVY VERTICAL AND RIGHT
        "┫": "+",   # U+252B BOX DRAWINGS HEAVY VERTICAL AND LEFT
        "┳": "+",   # U+2533 BOX DRAWINGS HEAVY DOWN AND HORIZONTAL
        "┻": "+",   # U+253B BOX DRAWINGS HEAVY UP AND HORIZONTAL
        "╋": "+",   # U+254B BOX DRAWINGS HEAVY VERTICAL AND HORIZONTAL
        # Box-drawing: MIXED light/double
        "╞": "+",   # U+255E
        "╡": "+",   # U+2561
        "╥": "+",   # U+2565
        "╨": "+",   # U+2568
        "╪": "+",   # U+256A
        # Arrows (keep as ASCII)
        "→": "->",
        "←": "<-",
        "↑": "^",
        "↓": "v",
        "↔": "<->",
        "⟶": "-->",
        "⟵": "<--",
        "▶": ">",
        "◀": "<",
        "▷": ">",
        "◁": "<",
        "▼": "v",
        "▲": "^",
        # Typography: smart quotes -> ASCII
        "\u201C": '"',   # " LEFT DOUBLE QUOTATION MARK
        "\u201D": '"',   # " RIGHT DOUBLE QUOTATION MARK
        "\u2018": "'",   # ' LEFT SINGLE QUOTATION MARK
        "\u2019": "'",   # ' RIGHT SINGLE QUOTATION MARK
        "\u2014": "--",  # — EM DASH
        "\u2013": "-",   # – EN DASH
        "\u2026": "...", # … HORIZONTAL ELLIPSIS
        "\u00A0": " ",   # NON-BREAKING SPACE
        "\uFFFD": "",    # REPLACEMENT CHARACTER (remove)
        # Bullets and markers
        "•": "*",
        "·": ".",
        "∙": ".",
        "◆": "*",
        "◇": "*",
        "○": "o",
        "●": "*",
        "□": "[ ]",
        "■": "[x]",
        "☐": "[ ]",
        "☑": "[x]",
        "☒": "[x]",
        # Math symbols
        "≤": "<=",
        "≥": ">=",
        "≠": "!=",
        "≈": "~=",
        "≡": "===",
        "±": "+/-",
        "×": "x",
        "÷": "/",
        "∞": "inf",
        "∑": "SUM",
        "∏": "PROD",
        "√": "sqrt",
        "∆": "delta",
        "∇": "nabla",
        "∈": "in",
        "∉": "not in",
        "⊂": "subset",
        "⊃": "superset",
        "∩": "AND",
        "∪": "OR",
        "∧": "AND",
        "∨": "OR",
        "¬": "NOT",
        "∀": "for all",
        "∃": "exists",
        # Currency and special
        "€": "EUR",
        "™": "(TM)",
        "©": "(C)",
        "®": "(R)",
        "⌘": "Cmd",
        "⇧": "Shift",
        "⌥": "Opt",
        "⌃": "Ctrl",
        # Low-9 quotation mark (commonly appears as mojibake)
        "\u201A": ",",
        # Combining strikethrough
        "\u0336": "",
        # Tilde
        "\u02DC": "~",
        # Greek letters (common in AI/math docs)
        "Φ": "Phi",
        "ψ": "psi",
        "Ψ": "Psi",
        "Δ": "Delta",
        "Σ": "Sigma",
        "σ": "sigma",
        "θ": "theta",
        "Θ": "Theta",
        "λ": "lambda",
        "α": "alpha",
        "β": "beta",
        "γ": "gamma",
        "Γ": "Gamma",
        "δ": "delta",
        "ε": "epsilon",
        "ζ": "zeta",
        "η": "eta",
        "κ": "kappa",
        "μ": "mu",
        "ν": "nu",
        "π": "pi",
        "Π": "Pi",
        "ρ": "rho",
        "τ": "tau",
        "φ": "phi",
        "χ": "chi",
        "ω": "omega",
        "Ω": "Omega",
        # Emoji: ownership symbols in glossary
        "🔷": "[RADIANT]",
        "🔶": "[BRANDED]",
        "🟣": "[OMEGA]",
        # Emoji: status
        "✅": "[OK]",
        "❌": "[X]",
        "⚠️": "[!]",
        "⚠": "[!]",
        "✓": "[ok]",
        "✗": "[x]",
        "✘": "[x]",
        # Emoji: objects
        "💡": "[TIP]",
        "📄": "[DOC]",
        "📕": "[PDF]",
        "📚": "[DOCS]",
        "📋": "[LIST]",
        "📖": "[BOOK]",
        "📊": "[CHART]",
        "🚀": "[LAUNCH]",
        "🔑": "[KEY]",
        "🔐": "[LOCK]",
        "🔒": "[LOCK]",
        "🛡️": "[SHIELD]",
        "🛡": "[SHIELD]",
        "🧠": "[BRAIN]",
        "🧭": "[NAV]",
        "🏗️": "[BUILD]",
        "🏗": "[BUILD]",
        "🥋": "[DOJO]",
        "🖥️": "[SCREEN]",
        "🖥": "[SCREEN]",
        "🎯": "[TARGET]",
        "🚨": "[ALERT]",
        "🚫": "[NO]",
        "💰": "[COST]",
        "🔧": "[TOOL]",
        "🔄": "[SYNC]",
        "⭐": "[STAR]",
        "🌟": "[STAR]",
        "🎉": "[DONE]",
        "🎨": "[DESIGN]",
        "📈": "[UP]",
        "📉": "[DOWN]",
        "🔥": "[HOT]",
        "💎": "[GEM]",
        "⚡": "[FAST]",
        "🌐": "[GLOBAL]",
        "🗂️": "[FOLDER]",
        "🗂": "[FOLDER]",
        "✨": "[NEW]",
        "🔍": "[SEARCH]",
        "📝": "[NOTE]",
        "🏆": "[TROPHY]",
        "📌": "[PIN]",
        "💬": "[CHAT]",
        "🤖": "[AI]",
        "🧩": "[PUZZLE]",
        "🎓": "[EDU]",
        "👤": "[USER]",
        "👥": "[USERS]",
        "📦": "[PKG]",
        "⚙️": "[GEAR]",
        "⚙": "[GEAR]",
        "🔗": "[LINK]",
        "📡": "[SIGNAL]",
        "🧪": "[TEST]",
        "💻": "[CODE]",
        "🌍": "[WORLD]",
        "🕐": "[TIME]",
    }
    for old, new in replacements.items():
        content = content.replace(old, new)

    # ── Phase 2: Character-level sweep for remaining problematic codepoints ──
    # Helvetica only covers Latin-1 + a few extras. Everything else must go.

    cleaned = []
    for ch in content:
        cp = ord(ch)

        # --- FAST PATH: ASCII is always safe ---
        if cp < 0x80:
            cleaned.append(ch)
            continue

        # --- REMOVE: C1 control characters (U+0080-U+009F) ---
        if 0x0080 <= cp <= 0x009F:
            continue

        # --- Latin-1 Supplement (U+00A0-U+00FF): mostly safe for Helvetica ---
        if 0x00A1 <= cp <= 0x00FF:
            cleaned.append(ch)
            continue

        # --- Latin Extended-A (U+0100-U+017F): accented chars, mostly safe ---
        if 0x0100 <= cp <= 0x017F:
            cleaned.append(ch)
            continue

        # --- Latin Extended-B partial (U+0180-U+024F): some safe ---
        if 0x0180 <= cp <= 0x024F:
            cleaned.append(ch)
            continue

        # --- REMOVE: Block elements (U+2580-U+259F) ---
        if 0x2580 <= cp <= 0x259F:
            continue

        # --- REPLACE: Any remaining box-drawing (U+2500-U+257F) ---
        if 0x2500 <= cp <= 0x257F:
            cleaned.append("+")
            continue

        # --- REMOVE/REPLACE: Geometric shapes (U+25A0-U+25FF) ---
        if 0x25A0 <= cp <= 0x25FF:
            cleaned.append("*")
            continue

        # --- REMOVE: Dingbats (U+2700-U+27BF) ---
        if 0x2700 <= cp <= 0x27BF:
            continue

        # --- REMOVE: Misc symbols (U+2600-U+26FF) ---
        if 0x2600 <= cp <= 0x26FF:
            continue

        # --- REPLACE: Supplemental arrows ---
        if 0x27F0 <= cp <= 0x27FF or 0x2900 <= cp <= 0x297F:
            cleaned.append("->")
            continue

        # --- REMOVE: Braille (U+2800-U+28FF) ---
        if 0x2800 <= cp <= 0x28FF:
            continue

        # --- REMOVE: Remaining math operators (U+2200-U+22FF) not in Phase 1 ---
        if 0x2200 <= cp <= 0x22FF:
            continue

        # --- REMOVE: Misc technical (U+2300-U+23FF) ---
        if 0x2300 <= cp <= 0x23FF:
            continue

        # --- REMOVE: General punctuation extras (U+2000-U+206F) not handled ---
        if 0x2000 <= cp <= 0x206F:
            # Keep standard spaces and dashes (already handled in Phase 1)
            continue

        # --- REMOVE: Superscripts/subscripts (U+2070-U+209F) ---
        if 0x2070 <= cp <= 0x209F:
            continue

        # --- REMOVE: Currency symbols (U+20A0-U+20CF) not already handled ---
        if 0x20A0 <= cp <= 0x20CF:
            continue

        # --- REMOVE: Letterlike symbols (U+2100-U+214F) ---
        if 0x2100 <= cp <= 0x214F:
            continue

        # --- REMOVE: Number forms (U+2150-U+218F) ---
        if 0x2150 <= cp <= 0x218F:
            continue

        # --- REMOVE: Arrows (U+2190-U+21FF) not in Phase 1 ---
        if 0x2190 <= cp <= 0x21FF:
            cleaned.append("->")
            continue

        # --- REMOVE: CJK (Chinese/Japanese/Korean) ---
        if 0x4E00 <= cp <= 0x9FFF:  # CJK Unified Ideographs
            continue
        if 0x3000 <= cp <= 0x303F:  # CJK Symbols
            continue
        if 0x3040 <= cp <= 0x309F:  # Hiragana
            continue
        if 0x30A0 <= cp <= 0x30FF:  # Katakana
            continue
        if 0xAC00 <= cp <= 0xD7AF:  # Hangul Syllables
            continue
        if 0x2E80 <= cp <= 0x2EFF:  # CJK Radicals
            continue
        if 0x2F00 <= cp <= 0x2FDF:  # Kangxi Radicals
            continue
        if 0xF900 <= cp <= 0xFAFF:  # CJK Compatibility Ideographs
            continue

        # --- REMOVE: Arabic (U+0600-U+06FF, U+0750-U+077F) ---
        if 0x0600 <= cp <= 0x06FF or 0x0750 <= cp <= 0x077F:
            continue
        if 0xFB50 <= cp <= 0xFDFF or 0xFE70 <= cp <= 0xFEFF:  # Arabic forms
            continue

        # --- REMOVE: Hebrew (U+0590-U+05FF) ---
        if 0x0590 <= cp <= 0x05FF:
            continue

        # --- REMOVE: Cyrillic (U+0400-U+04FF) ---
        if 0x0400 <= cp <= 0x04FF:
            continue

        # --- REMOVE: Thai (U+0E00-U+0E7F) ---
        if 0x0E00 <= cp <= 0x0E7F:
            continue

        # --- REMOVE: Devanagari (U+0900-U+097F) ---
        if 0x0900 <= cp <= 0x097F:
            continue

        # --- REMOVE: Greek and Coptic (U+0370-U+03FF) not in Phase 1 ---
        if 0x0370 <= cp <= 0x03FF:
            continue

        # --- REMOVE: All SMP emoji and symbols (U+10000+) ---
        if cp >= 0x10000:
            continue

        # --- REMOVE: Variation selectors ---
        if 0xFE00 <= cp <= 0xFE0F:
            continue

        # --- REMOVE: Zero-width and special ---
        if cp in (0x200B, 0x200C, 0x200D, 0xFEFF, 0xFFFD):
            continue

        # --- REMOVE: Combining diacritical marks (U+0300-U+036F) ---
        if 0x0300 <= cp <= 0x036F:
            continue

        # Everything else: keep if in BMP Latin range, drop otherwise
        if cp < 0x0250:
            cleaned.append(ch)
        # else: silently drop (non-Latin script without explicit handling)

    return "".join(cleaned)


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
    # Write a sanitized intermediate file for PDF (emojis replaced with text)
    version = read_version()
    print("Sanitizing content for PDF (replacing emoji with text equivalents)...")
    pdf_md_content = sanitize_for_pdf(md_content)
    pdf_source = OUT_DIR / "_PDF_SOURCE.md"
    pdf_source.write_text(pdf_md_content, encoding="utf-8")
    emoji_diff = len(md_content) - len(pdf_md_content)
    print(f"  Sanitized {abs(emoji_diff):,} character delta (emoji -> text)")

    print("Generating PDF via pandoc (this may take a few minutes for large documents)...")

    # Pandoc engines to try in order
    # Disable tex_math_dollars and tex_math_single_backslash to prevent
    # dollar signs and backslashes in docs from being interpreted as LaTeX math
    md_format = "markdown-yaml_metadata_block-tex_math_dollars-tex_math_single_backslash-raw_tex"

    # Header file for custom styling (injected into pandoc's default template)
    header_path = Path(__file__).resolve().parent / "radiant-pdf-header.tex"

    engines = [
        ("xelatex+styled", [
            "pandoc",
            str(pdf_source),
            "-o", str(OUT_PDF),
            f"--from={md_format}",
            "--pdf-engine=xelatex",
            f"--include-in-header={header_path}",
            "--toc",
            "--toc-depth=2",
            "-V", "geometry:margin=0.75in,top=1in,bottom=1in",
            "-V", "fontsize=10pt",
            "-V", "documentclass=report",
            "-V", f"title=RADIANT \\& Think Tank -- Complete Documentation v{version}",
            "-V", "author=Zynapses Inc.",
            "-V", "mainfont=Helvetica",
            "-V", "monofont=Menlo",
            "-V", "linestretch=1.08",
        ]),
        ("xelatex-basic", [
            "pandoc",
            str(pdf_source),
            "-o", str(OUT_PDF),
            f"--from={md_format}",
            "--pdf-engine=xelatex",
            "--toc",
            "--toc-depth=2",
            "-V", "geometry:margin=0.75in",
            "-V", "fontsize=10pt",
            "-V", "documentclass=report",
            "-V", f"title=RADIANT \\& Think Tank -- Complete Documentation v{version}",
            "-V", "author=Zynapses Inc.",
            "-V", "mainfont=Helvetica",
            "-V", "monofont=Menlo",
            "-V", "colorlinks=true",
            "-V", "linkcolor=NavyBlue",
            "-V", "urlcolor=NavyBlue",
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
                print(f"  [OK] PDF: {OUT_PDF.name} ({pdf_size / 1_048_576:.1f} MB)")
                pdf_ok = True
                break
            else:
                stderr_snippet = (result.stderr or "")[:1500]
                print(f"  [!] {engine_name} failed: {stderr_snippet[:200]}...")

        if not pdf_ok:
            print(f"  [X] All PDF engines failed.")
            print(f"  [TIP] The .md file was generated successfully. You can convert manually:")
            print(f"     pandoc {OUT_MD} -o {OUT_PDF} --from=markdown-yaml_metadata_block")
    except FileNotFoundError:
        print(f"  [X] pandoc not found. Install with: brew install pandoc")
        print(f"  [TIP] The .md file was generated successfully.")
    except subprocess.TimeoutExpired:
        print(f"  [X] PDF generation timed out (>10 min). The document may be too large.")
        print(f"  [TIP] The .md file was generated successfully.")

    # Clean up intermediate file
    if pdf_source.exists():
        pdf_source.unlink()

    print()
    print(f"Done! Files in: {OUT_DIR}/")
    print(f"  📄 {OUT_MD.name}")
    if OUT_PDF.exists():
        print(f"  📕 {OUT_PDF.name}")


if __name__ == "__main__":
    main()
