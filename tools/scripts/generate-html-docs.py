#!/usr/bin/env python3
"""
RADIANT Documentation HTML Generator

Converts all markdown files to styled HTML for browser viewing and PDF printing.

Usage:
    python3 tools/scripts/generate-html-docs.py

Output:
    Styled HTML files in /docs/html/ that can be printed to PDF via browser
"""

import os
import subprocess
import sys
from pathlib import Path
from datetime import datetime
import re
import html

PROJECT_ROOT = Path(__file__).parent.parent.parent.resolve()
DOCS_DIR = PROJECT_ROOT / "docs"
HTML_DIR = DOCS_DIR / "html"

CSS_STYLES = '''
<style>
@media print {
  body { font-size: 11pt !important; }
  pre { page-break-inside: avoid; }
  h1, h2, h3 { page-break-after: avoid; }
  .no-print { display: none !important; }
}

* { box-sizing: border-box; }

body {
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
  line-height: 1.7;
  color: #1d1d1f;
  max-width: 900px;
  margin: 0 auto;
  padding: 40px 30px;
  background: white;
}

h1 {
  color: #1d1d1f;
  border-bottom: 3px solid #0071e3;
  padding-bottom: 12px;
  font-size: 28px;
  margin-top: 0;
}

h2 {
  color: #1d1d1f;
  border-bottom: 1px solid #d2d2d7;
  padding-bottom: 8px;
  font-size: 22px;
  margin-top: 40px;
}

h3 { color: #1d1d1f; font-size: 18px; margin-top: 30px; }
h4 { color: #1d1d1f; font-size: 16px; margin-top: 25px; }

a { color: #0071e3; text-decoration: none; }
a:hover { text-decoration: underline; }

code {
  background: #f5f5f7;
  padding: 2px 6px;
  border-radius: 4px;
  font-family: 'SF Mono', Monaco, 'Cascadia Code', monospace;
  font-size: 0.9em;
  color: #1d1d1f;
}

pre {
  background: #1d1d1f;
  color: #f5f5f7;
  padding: 20px;
  border-radius: 10px;
  overflow-x: auto;
  font-size: 13px;
  line-height: 1.5;
}

pre code {
  background: transparent;
  padding: 0;
  color: inherit;
}

table {
  width: 100%;
  border-collapse: collapse;
  margin: 20px 0;
  font-size: 14px;
}

th, td {
  border: 1px solid #d2d2d7;
  padding: 12px 15px;
  text-align: left;
}

th {
  background: #0071e3;
  color: white;
  font-weight: 600;
}

tr:nth-child(even) { background: #f5f5f7; }

blockquote {
  border-left: 4px solid #0071e3;
  margin: 20px 0;
  padding: 15px 25px;
  background: #f5f5f7;
  border-radius: 0 8px 8px 0;
}

blockquote p { margin: 0; }

img { max-width: 100%; height: auto; border-radius: 8px; }

hr {
  border: none;
  border-top: 1px solid #d2d2d7;
  margin: 40px 0;
}

ul, ol { padding-left: 25px; }
li { margin: 8px 0; }

.header-bar {
  background: linear-gradient(135deg, #0071e3 0%, #00c6ff 100%);
  color: white;
  padding: 20px 30px;
  margin: -40px -30px 30px -30px;
  border-radius: 0 0 16px 16px;
}

.header-bar h1 {
  color: white;
  border: none;
  margin: 0;
  padding: 0;
}

.header-bar .meta {
  font-size: 13px;
  opacity: 0.9;
  margin-top: 8px;
}

.print-btn {
  position: fixed;
  top: 20px;
  right: 20px;
  background: #0071e3;
  color: white;
  border: none;
  padding: 12px 24px;
  border-radius: 8px;
  cursor: pointer;
  font-size: 14px;
  font-weight: 500;
  box-shadow: 0 4px 12px rgba(0,113,227,0.3);
}

.print-btn:hover { background: #0077ed; }

.mermaid {
  background: #f5f5f7;
  padding: 20px;
  border-radius: 10px;
  text-align: center;
  margin: 20px 0;
}

.footer {
  margin-top: 60px;
  padding-top: 20px;
  border-top: 1px solid #d2d2d7;
  color: #86868b;
  font-size: 12px;
  text-align: center;
}
</style>
'''

def find_markdown_files():
    """Find all markdown files in the project."""
    md_files = []
    
    # Root level markdown files
    for f in PROJECT_ROOT.glob("*.md"):
        if f.is_file():
            md_files.append(f)
    
    # Docs directory
    for f in DOCS_DIR.rglob("*.md"):
        if f.is_file() and "html" not in str(f) and "pdf" not in str(f):
            md_files.append(f)
    
    return sorted(md_files)

def markdown_to_html(md_path: Path) -> str:
    """Convert markdown to HTML using pandoc."""
    try:
        result = subprocess.run(
            ["pandoc", str(md_path), "-f", "markdown", "-t", "html5", 
             "--no-highlight", "--wrap=none"],
            capture_output=True, text=True, timeout=30
        )
        if result.returncode == 0:
            return result.stdout
        return None
    except Exception:
        return None

def create_html_document(content: str, title: str, rel_path: str) -> str:
    """Wrap HTML content in a full document with styling."""
    return f'''<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>{html.escape(title)} - RADIANT Documentation</title>
  {CSS_STYLES}
</head>
<body>
  <button class="print-btn no-print" onclick="window.print()">🖨️ Print / Save as PDF</button>
  
  <div class="header-bar">
    <h1>{html.escape(title)}</h1>
    <div class="meta">RADIANT v5.52.29 | {rel_path}</div>
  </div>
  
  {content}
  
  <div class="footer">
    RADIANT Documentation | Version 5.52.29 | Generated {datetime.now().strftime("%B %d, %Y")}
  </div>
</body>
</html>'''

def categorize_file(name: str) -> str:
    """Categorize a file by its name."""
    name_lower = name.lower()
    if "authentication" in name_lower: return "Authentication"
    if "security" in name_lower: return "Security"
    if "api_" in name_lower or "api-" in name_lower: return "API Reference"
    if "sections_" in name_lower or "section-" in name_lower: return "Technical Sections"
    if "phases_" in name_lower or "phase-" in name_lower: return "Implementation Phases"
    if "thinktank" in name_lower: return "Think Tank"
    if "radiant" in name_lower: return "RADIANT Platform"
    if "cato" in name_lower or "genesis" in name_lower: return "Safety & Ethics"
    if "cortex" in name_lower or "agi" in name_lower or "consciousness" in name_lower: return "AI Architecture"
    if "exports" in name_lower or "publications" in name_lower: return "Publications"
    return "General"

def generate_index(output_dir: Path, files: list):
    """Generate an HTML index of all documents."""
    categories = {}
    for f in files:
        cat = categorize_file(f)
        if cat not in categories:
            categories[cat] = []
        categories[cat].append(f)
    
    items_html = ""
    for cat in sorted(categories.keys()):
        items_html += f'<div class="category"><h2>📁 {cat} ({len(categories[cat])})</h2><div class="file-grid">'
        for f in sorted(categories[cat]):
            display = f.replace("_", " / ").replace(".html", "")
            if len(display) > 60:
                display = display[:57] + "..."
            items_html += f'<a href="{f}" class="file-link"><span class="icon">📄</span><span class="name">{display}</span></a>'
        items_html += '</div></div>'
    
    index_html = f'''<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>RADIANT Documentation</title>
  <style>
    * {{ box-sizing: border-box; }}
    body {{ 
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      max-width: 1200px; margin: 0 auto; padding: 40px 20px;
      background: #f5f5f7; color: #1d1d1f;
    }}
    h1 {{ color: #1d1d1f; border-bottom: 3px solid #0071e3; padding-bottom: 15px; font-size: 32px; }}
    h2 {{ color: #1d1d1f; margin: 0 0 20px 0; font-size: 18px; font-weight: 600; }}
    .stats {{ 
      background: linear-gradient(135deg, #0071e3 0%, #00c6ff 100%); 
      color: white; padding: 30px; border-radius: 16px; margin-bottom: 30px; 
      display: flex; gap: 50px; flex-wrap: wrap;
    }}
    .stat {{ text-align: center; min-width: 120px; }}
    .stat-number {{ font-size: 42px; font-weight: bold; }}
    .stat-label {{ font-size: 14px; opacity: 0.9; margin-top: 5px; }}
    .instructions {{
      background: #fff3cd; border: 1px solid #ffc107; border-radius: 12px;
      padding: 20px; margin-bottom: 30px;
    }}
    .instructions h3 {{ margin-top: 0; color: #856404; }}
    .instructions ol {{ margin-bottom: 0; }}
    .category {{ 
      background: white; border-radius: 16px; padding: 25px; margin: 20px 0; 
      box-shadow: 0 4px 12px rgba(0,0,0,0.08);
    }}
    .file-grid {{ 
      display: grid; grid-template-columns: repeat(auto-fill, minmax(320px, 1fr)); gap: 10px;
    }}
    .file-link {{ 
      display: flex; align-items: center; gap: 12px;
      padding: 14px 18px; background: #f5f5f7; border-radius: 10px;
      color: #1d1d1f; text-decoration: none; font-size: 13px; 
      transition: all 0.2s; border: 1px solid transparent;
    }}
    .file-link:hover {{ background: #e8e8ed; border-color: #0071e3; }}
    .file-link .icon {{ font-size: 20px; }}
    .file-link .name {{ flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }}
    footer {{ 
      margin-top: 50px; padding-top: 25px; border-top: 1px solid #d2d2d7; 
      color: #86868b; font-size: 12px; text-align: center;
    }}
  </style>
</head>
<body>
  <h1>📚 RADIANT Documentation</h1>
  
  <div class="stats">
    <div class="stat"><div class="stat-number">{len(files)}</div><div class="stat-label">Documents</div></div>
    <div class="stat"><div class="stat-number">{len(categories)}</div><div class="stat-label">Categories</div></div>
    <div class="stat"><div class="stat-number">v5.52.29</div><div class="stat-label">Version</div></div>
    <div class="stat"><div class="stat-number">{datetime.now().strftime("%Y-%m-%d")}</div><div class="stat-label">Generated</div></div>
  </div>
  
  <div class="instructions">
    <h3>📥 How to Download as PDF</h3>
    <ol>
      <li>Click any document below to open it</li>
      <li>Click the <strong>"Print / Save as PDF"</strong> button (or press Cmd/Ctrl + P)</li>
      <li>Select <strong>"Save as PDF"</strong> as the destination</li>
      <li>Click Save</li>
    </ol>
  </div>
  
  {items_html}
  
  <footer>
    RADIANT Documentation System | Version 5.52.29 | {datetime.now().strftime("%B %d, %Y")}
  </footer>
</body>
</html>'''
    
    (output_dir / "index.html").write_text(index_html)

def main():
    print("🚀 RADIANT Documentation HTML Generator")
    print("=" * 50)
    print()
    
    # Check for pandoc
    try:
        subprocess.run(["pandoc", "--version"], capture_output=True, check=True)
    except (subprocess.CalledProcessError, FileNotFoundError):
        print("❌ pandoc not found. Install with: brew install pandoc")
        sys.exit(1)
    
    # Create output directory
    HTML_DIR.mkdir(parents=True, exist_ok=True)
    
    # Find files
    print("📁 Finding markdown files...")
    md_files = find_markdown_files()
    total = len(md_files)
    print(f"   Found {total} markdown files")
    print()
    
    # Convert
    success_files = []
    failed = 0
    
    for i, md_file in enumerate(md_files, 1):
        rel_path = str(md_file.relative_to(PROJECT_ROOT))
        html_name = rel_path.replace("/", "_").replace(".md", ".html")
        html_path = HTML_DIR / html_name
        
        print(f"\r[{i}/{total}] Converting: {rel_path[:55]:<55}", end="", flush=True)
        
        content = markdown_to_html(md_file)
        if content:
            title = md_file.stem.replace("-", " ").replace("_", " ")
            full_html = create_html_document(content, title, rel_path)
            html_path.write_text(full_html)
            success_files.append(html_name)
        else:
            failed += 1
    
    print()
    print()
    
    # Generate index
    print("📋 Generating index.html...")
    generate_index(HTML_DIR, success_files)
    
    # Summary
    print()
    print("=" * 60)
    print(f"✅ Successfully converted: {len(success_files)} files")
    if failed > 0:
        print(f"⚠️  Failed: {failed} files")
    print("=" * 60)
    print()
    print(f"📂 HTML files saved to: {HTML_DIR}")
    print(f"🌐 Open in browser: open {HTML_DIR}/index.html")
    print()
    print("💡 To save as PDF: Open any doc → Click 'Print' button → Save as PDF")
    print()

if __name__ == "__main__":
    main()
