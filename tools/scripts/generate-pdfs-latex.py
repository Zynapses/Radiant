#!/usr/bin/env python3
"""
RADIANT Documentation PDF Generator - Using LaTeX

Generates actual PDF files from all markdown documentation.
"""

import os
import subprocess
import sys
from pathlib import Path
from datetime import datetime
from concurrent.futures import ThreadPoolExecutor, as_completed
import shutil

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
    
    # Docs directory (excluding pdf and html output folders)
    for f in DOCS_DIR.rglob("*.md"):
        if f.is_file() and "/pdf/" not in str(f) and "/html/" not in str(f):
            md_files.append(f)
    
    return sorted(md_files)

def convert_to_pdf(md_path: Path, pdf_dir: Path) -> tuple:
    """Convert a single markdown file to PDF using pandoc + LaTeX."""
    rel_path = str(md_path.relative_to(PROJECT_ROOT))
    pdf_name = rel_path.replace("/", "_").replace(".md", ".pdf")
    pdf_path = pdf_dir / pdf_name
    
    try:
        result = subprocess.run(
            [
                "pandoc",
                str(md_path),
                "-f", "markdown",
                "-t", "pdf",
                "--pdf-engine=xelatex",
                "-V", "geometry:margin=1in",
                "-V", "fontsize=11pt",
                "-V", "documentclass=article",
                "-V", "linkcolor=blue",
                "-V", "urlcolor=blue",
                "--toc",
                "--toc-depth=3",
                "-o", str(pdf_path)
            ],
            capture_output=True,
            text=True,
            timeout=120,
            env={**os.environ, "PATH": f"/Library/TeX/texbin:{os.environ.get('PATH', '')}"}
        )
        
        if result.returncode == 0 and pdf_path.exists():
            return (rel_path, True, None)
        else:
            return (rel_path, False, result.stderr[:500] if result.stderr else "Unknown error")
    except subprocess.TimeoutExpired:
        return (rel_path, False, "Timeout")
    except Exception as e:
        return (rel_path, False, str(e)[:200])

def generate_index(pdf_dir: Path, files: list):
    """Generate an HTML index of all PDFs."""
    categories = {}
    for f in files:
        name_lower = f.lower()
        if "authentication" in name_lower: cat = "Authentication"
        elif "security" in name_lower: cat = "Security"
        elif "api_" in name_lower or "api-" in name_lower: cat = "API Reference"
        elif "sections_" in name_lower or "section-" in name_lower: cat = "Technical Sections"
        elif "phases_" in name_lower or "phase-" in name_lower: cat = "Implementation Phases"
        elif "thinktank" in name_lower: cat = "Think Tank"
        elif "radiant" in name_lower: cat = "RADIANT Platform"
        elif "cato" in name_lower or "genesis" in name_lower: cat = "Safety & Ethics"
        elif "cortex" in name_lower or "agi" in name_lower: cat = "AI Architecture"
        else: cat = "General"
        
        if cat not in categories:
            categories[cat] = []
        categories[cat].append(f)
    
    items_html = ""
    for cat in sorted(categories.keys()):
        items_html += f'<div class="category"><h2>📁 {cat} ({len(categories[cat])})</h2><div class="file-grid">'
        for f in sorted(categories[cat]):
            display = f.replace("_", " / ").replace(".pdf", "")
            if len(display) > 55:
                display = display[:52] + "..."
            items_html += f'<a href="{f}" class="file-link" download><span class="icon">📄</span><span class="name">{display}</span><span class="dl">⬇️</span></a>'
        items_html += '</div></div>'
    
    index_html = f'''<!DOCTYPE html>
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
    h1 {{ color: #1d1d1f; border-bottom: 3px solid #0071e3; padding-bottom: 15px; }}
    h2 {{ color: #1d1d1f; margin: 0 0 15px 0; font-size: 18px; }}
    .stats {{ 
      background: linear-gradient(135deg, #0071e3 0%, #00c6ff 100%); 
      color: white; padding: 25px; border-radius: 16px; margin-bottom: 25px; 
      display: flex; gap: 40px; flex-wrap: wrap;
    }}
    .stat {{ text-align: center; }}
    .stat-number {{ font-size: 36px; font-weight: bold; }}
    .stat-label {{ font-size: 13px; opacity: 0.9; }}
    .category {{ background: white; border-radius: 16px; padding: 20px; margin: 15px 0; box-shadow: 0 4px 12px rgba(0,0,0,0.08); }}
    .file-grid {{ display: grid; grid-template-columns: repeat(auto-fill, minmax(300px, 1fr)); gap: 8px; }}
    .file-link {{ 
      display: flex; align-items: center; gap: 10px;
      padding: 12px 15px; background: #f5f5f7; border-radius: 8px;
      color: #1d1d1f; text-decoration: none; font-size: 12px; 
      transition: all 0.2s; border: 1px solid transparent;
    }}
    .file-link:hover {{ background: #e8e8ed; border-color: #0071e3; }}
    .file-link .icon {{ font-size: 18px; }}
    .file-link .name {{ flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }}
    .file-link .dl {{ opacity: 0.5; }}
    .file-link:hover .dl {{ opacity: 1; }}
    .download-all {{ 
      display: inline-block; background: #0071e3; color: white; 
      padding: 15px 30px; border-radius: 10px; text-decoration: none; 
      font-weight: 600; margin-bottom: 20px;
    }}
    .download-all:hover {{ background: #0077ed; }}
    footer {{ margin-top: 40px; padding-top: 20px; border-top: 1px solid #d2d2d7; color: #86868b; font-size: 12px; text-align: center; }}
  </style>
</head>
<body>
  <h1>📚 RADIANT Documentation PDFs</h1>
  
  <div class="stats">
    <div class="stat"><div class="stat-number">{len(files)}</div><div class="stat-label">PDF Documents</div></div>
    <div class="stat"><div class="stat-number">{len(categories)}</div><div class="stat-label">Categories</div></div>
    <div class="stat"><div class="stat-number">v5.52.29</div><div class="stat-label">Version</div></div>
  </div>
  
  <p>Click any PDF to download. All documents are ready for offline viewing.</p>
  
  {items_html}
  
  <footer>RADIANT Documentation | Generated {datetime.now().strftime("%B %d, %Y")}</footer>
</body>
</html>'''
    
    (pdf_dir / "index.html").write_text(index_html)

def main():
    print("=" * 70)
    print("  RADIANT Documentation PDF Generator")
    print("  Using: pandoc + XeLaTeX")
    print("=" * 70)
    print()
    
    # Create output directory
    PDF_DIR.mkdir(parents=True, exist_ok=True)
    
    # Find files
    print("📁 Finding markdown files...")
    md_files = find_markdown_files()
    total = len(md_files)
    print(f"   Found {total} markdown files")
    print()
    
    # Convert with parallel processing
    print("📄 Converting to PDF (this may take a few minutes)...")
    print()
    
    success_files = []
    failed_files = []
    
    # Use thread pool for parallel conversion
    with ThreadPoolExecutor(max_workers=4) as executor:
        futures = {executor.submit(convert_to_pdf, f, PDF_DIR): f for f in md_files}
        
        for i, future in enumerate(as_completed(futures), 1):
            rel_path, success, error = future.result()
            status = "✅" if success else "❌"
            print(f"\r[{i:3}/{total}] {status} {rel_path[:60]:<60}", end="", flush=True)
            
            if success:
                pdf_name = rel_path.replace("/", "_").replace(".md", ".pdf")
                success_files.append(pdf_name)
            else:
                failed_files.append((rel_path, error))
    
    print()
    print()
    
    # Generate index
    if success_files:
        print("📋 Generating index.html...")
        generate_index(PDF_DIR, success_files)
    
    # Summary
    print()
    print("=" * 70)
    print(f"  ✅ Successfully converted: {len(success_files)} PDFs")
    if failed_files:
        print(f"  ❌ Failed: {len(failed_files)} files")
    print("=" * 70)
    print()
    print(f"📂 PDFs saved to: {PDF_DIR}")
    print(f"🌐 Open index: open {PDF_DIR}/index.html")
    print()
    
    if failed_files and len(failed_files) <= 10:
        print("Failed files:")
        for f, err in failed_files[:10]:
            print(f"  - {f}: {err[:80]}")

if __name__ == "__main__":
    main()
