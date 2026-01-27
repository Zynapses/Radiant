#!/usr/bin/env python3
"""
RADIANT Documentation PDF Generator

Converts all markdown files to PDF using pandoc + wkhtmltopdf.

Usage:
    python tools/scripts/generate-pdfs.py
"""

import os
import subprocess
import sys
from pathlib import Path
from datetime import datetime

PROJECT_ROOT = Path(__file__).parent.parent.parent.resolve()
DOCS_DIR = PROJECT_ROOT / "docs"
PDF_DIR = DOCS_DIR / "pdf"

def find_markdown_files():
    """Find all markdown files in the project."""
    md_files = []
    
    # Root level markdown files
    for f in PROJECT_ROOT.glob("*.md"):
        if f.is_file():
            md_files.append(f)
    
    # Docs directory
    for f in DOCS_DIR.rglob("*.md"):
        if f.is_file() and "pdf" not in str(f):
            md_files.append(f)
    
    return sorted(md_files)

def convert_to_pdf(md_path: Path, output_dir: Path) -> bool:
    """Convert a markdown file to PDF using pandoc."""
    rel_path = md_path.relative_to(PROJECT_ROOT)
    pdf_name = str(rel_path).replace("/", "_").replace(".md", ".pdf")
    pdf_path = output_dir / pdf_name
    
    try:
        result = subprocess.run([
            "pandoc", str(md_path),
            "-f", "markdown",
            "-t", "html",
            "--pdf-engine=wkhtmltopdf",
            "--pdf-engine-opt=--enable-local-file-access",
            "--pdf-engine-opt=--quiet",
            f"--metadata=title:RADIANT: {rel_path.stem}",
            "-V", "margin-top=20mm",
            "-V", "margin-bottom=20mm", 
            "-V", "margin-left=15mm",
            "-V", "margin-right=15mm",
            "-o", str(pdf_path)
        ], capture_output=True, timeout=60)
        return result.returncode == 0
    except Exception:
        return False

def categorize_pdf(name: str) -> str:
    """Categorize a PDF by its name."""
    name_lower = name.lower()
    if "authentication" in name_lower: return "Authentication"
    if "security" in name_lower: return "Security"
    if "api_" in name_lower: return "API Reference"
    if "sections_" in name_lower: return "Technical Sections"
    if "phases_" in name_lower: return "Implementation Phases"
    if "thinktank" in name_lower: return "Think Tank"
    if "radiant" in name_lower: return "RADIANT Platform"
    if "cato" in name_lower or "genesis" in name_lower: return "Safety & Ethics"
    if "cortex" in name_lower or "agi" in name_lower or "consciousness" in name_lower: return "AI Architecture"
    if "exports_" in name_lower or "publications_" in name_lower: return "Publications"
    return "General"

def generate_index(output_dir: Path, success_count: int):
    """Generate an HTML index of all PDFs."""
    pdfs = sorted([f.name for f in output_dir.glob("*.pdf")])
    
    # Group by category
    categories = {}
    for pdf in pdfs:
        cat = categorize_pdf(pdf)
        if cat not in categories:
            categories[cat] = []
        categories[cat].append(pdf)
    
    html = f'''<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>RADIANT Documentation PDFs</title>
  <style>
    * {{ box-sizing: border-box; }}
    body {{ 
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      max-width: 1200px; margin: 0 auto; padding: 40px 20px;
      background: #f5f5f7; color: #1d1d1f;
    }}
    h1 {{ color: #1d1d1f; border-bottom: 2px solid #0071e3; padding-bottom: 15px; }}
    h2 {{ color: #1d1d1f; margin-top: 30px; font-size: 18px; }}
    .stats {{ background: linear-gradient(135deg, #0071e3 0%, #00c6ff 100%); color: white; padding: 25px; border-radius: 16px; margin-bottom: 30px; display: flex; gap: 50px; flex-wrap: wrap; }}
    .stat {{ text-align: center; min-width: 120px; }}
    .stat-number {{ font-size: 36px; font-weight: bold; }}
    .stat-label {{ font-size: 14px; opacity: 0.9; margin-top: 5px; }}
    .category {{ background: white; border-radius: 16px; padding: 25px; margin: 20px 0; box-shadow: 0 4px 12px rgba(0,0,0,0.08); }}
    .category h2 {{ margin-top: 0; margin-bottom: 20px; }}
    .pdf-grid {{ display: grid; grid-template-columns: repeat(auto-fill, minmax(300px, 1fr)); gap: 10px; }}
    .pdf-link {{ 
      display: flex; align-items: center; gap: 10px;
      padding: 12px 15px; background: #f5f5f7; border-radius: 10px;
      color: #1d1d1f; text-decoration: none; font-size: 13px; 
      transition: all 0.2s; border: 1px solid transparent;
    }}
    .pdf-link:hover {{ background: #e8e8ed; border-color: #0071e3; }}
    .pdf-icon {{ font-size: 20px; }}
    .pdf-name {{ flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }}
    footer {{ margin-top: 50px; padding-top: 25px; border-top: 1px solid #d2d2d7; color: #86868b; font-size: 12px; text-align: center; }}
    .download-tip {{ background: #fff3cd; border: 1px solid #ffc107; border-radius: 10px; padding: 15px; margin-bottom: 25px; font-size: 14px; }}
  </style>
</head>
<body>
  <h1>📚 RADIANT Documentation PDFs</h1>
  
  <div class="stats">
    <div class="stat"><div class="stat-number">{success_count}</div><div class="stat-label">PDF Documents</div></div>
    <div class="stat"><div class="stat-number">{len(categories)}</div><div class="stat-label">Categories</div></div>
    <div class="stat"><div class="stat-number">v5.52.29</div><div class="stat-label">Version</div></div>
    <div class="stat"><div class="stat-number">{datetime.now().strftime("%Y-%m-%d")}</div><div class="stat-label">Generated</div></div>
  </div>
  
  <div class="download-tip">
    💡 <strong>Tip:</strong> Click any document to download. To download all PDFs at once, 
    select all files in Finder or use: <code>zip -r radiant-docs.zip *.pdf</code>
  </div>
'''

    for cat in sorted(categories.keys()):
        html += f'  <div class="category">\n    <h2>📁 {cat} ({len(categories[cat])})</h2>\n    <div class="pdf-grid">\n'
        for pdf in sorted(categories[cat]):
            display = pdf.replace("_", " / ").replace(".pdf", "")
            if len(display) > 55:
                display = display[:52] + "..."
            html += f'      <a href="{pdf}" class="pdf-link" title="{pdf}"><span class="pdf-icon">📄</span><span class="pdf-name">{display}</span></a>\n'
        html += '    </div>\n  </div>\n'

    html += f'''
  <footer>
    Generated by RADIANT Documentation System | Version 5.52.29 | {datetime.now().strftime("%B %d, %Y")}
  </footer>
</body>
</html>'''

    (output_dir / "index.html").write_text(html)

def main():
    print("🚀 RADIANT Documentation PDF Generator")
    print("=" * 50)
    print()
    
    # Check dependencies
    try:
        subprocess.run(["pandoc", "--version"], capture_output=True, check=True)
    except (subprocess.CalledProcessError, FileNotFoundError):
        print("❌ pandoc not found. Install with: brew install pandoc")
        sys.exit(1)
    
    try:
        subprocess.run(["wkhtmltopdf", "--version"], capture_output=True, check=True)
    except (subprocess.CalledProcessError, FileNotFoundError):
        print("❌ wkhtmltopdf not found. Install with: brew install wkhtmltopdf")
        sys.exit(1)
    
    # Create output directory
    PDF_DIR.mkdir(parents=True, exist_ok=True)
    
    # Find files
    print("📁 Finding markdown files...")
    md_files = find_markdown_files()
    total = len(md_files)
    print(f"   Found {total} markdown files")
    print()
    
    # Convert
    success = 0
    failed = 0
    
    for i, md_file in enumerate(md_files, 1):
        rel_path = str(md_file.relative_to(PROJECT_ROOT))[:55]
        print(f"\r[{i}/{total}] Converting: {rel_path:<55}", end="", flush=True)
        
        if convert_to_pdf(md_file, PDF_DIR):
            success += 1
        else:
            failed += 1
    
    print()
    print()
    
    # Generate index
    print("📋 Generating index.html...")
    generate_index(PDF_DIR, success)
    
    # Summary
    print()
    print("=" * 60)
    print(f"✅ Successfully converted: {success} files")
    if failed > 0:
        print(f"⚠️  Failed: {failed} files (may have unsupported markdown)")
    print("=" * 60)
    print()
    print(f"📂 PDFs saved to: {PDF_DIR}")
    print(f"🌐 Open in browser: open {PDF_DIR}/index.html")
    print()

if __name__ == "__main__":
    main()
