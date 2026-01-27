#!/bin/zsh
# RADIANT Documentation PDF Generator (Pandoc)
# Converts all markdown files to PDF using pandoc + wkhtmltopdf

PROJECT_ROOT="${0:A:h}/../.."
PROJECT_ROOT="${PROJECT_ROOT:A}"
DOCS_DIR="$PROJECT_ROOT/docs"
PDF_DIR="$DOCS_DIR/pdf"

echo "🚀 RADIANT Documentation PDF Generator (Pandoc)"
echo "================================================"
echo ""

# Create output directory
mkdir -p "$PDF_DIR"

# Check for pandoc
if ! command -v pandoc &> /dev/null; then
    echo "❌ pandoc not found. Install with: brew install pandoc"
    exit 1
fi

# Check for wkhtmltopdf
if ! command -v wkhtmltopdf &> /dev/null; then
    echo "⚠️  wkhtmltopdf not found. Installing..."
    brew install wkhtmltopdf || {
        echo "❌ Failed to install wkhtmltopdf. Please install manually."
        exit 1
    }
fi

# Find all markdown files
echo "📁 Finding markdown files..."
MD_FILES=("${(@f)$(find "$PROJECT_ROOT" -name "*.md" -type f \
    -not -path "*/node_modules/*" \
    -not -path "*/.git/*" \
    -not -path "*/pdf/*" | sort)}")

TOTAL=${#MD_FILES[@]}
echo "   Found $TOTAL markdown files"
echo ""

# Convert each file
SUCCESS=0
FAILED=0

for i in {1..$TOTAL}; do
    FILE="${MD_FILES[$i]}"
    REL_PATH="${FILE#$PROJECT_ROOT/}"
    PDF_NAME="${REL_PATH//\//_}"
    PDF_NAME="${PDF_NAME%.md}.pdf"
    PDF_PATH="$PDF_DIR/$PDF_NAME"
    
    printf "\r[%d/%d] Converting: %-55s" "$i" "$TOTAL" "${REL_PATH:0:55}"
    
    if pandoc "$FILE" \
        -f markdown \
        -t html \
        --pdf-engine=wkhtmltopdf \
        --pdf-engine-opt=--enable-local-file-access \
        --metadata title="RADIANT: ${REL_PATH%.md}" \
        -V margin-top=20mm \
        -V margin-bottom=20mm \
        -V margin-left=15mm \
        -V margin-right=15mm \
        -o "$PDF_PATH" 2>/dev/null; then
        ((SUCCESS++))
    else
        ((FAILED++))
    fi
done

echo ""
echo ""

# Generate index HTML
echo "📋 Generating index.html..."

cat > "$PDF_DIR/index.html" << 'HTMLEOF'
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>RADIANT Documentation PDFs</title>
  <style>
    * { box-sizing: border-box; }
    body { 
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      max-width: 1200px; margin: 0 auto; padding: 40px 20px;
      background: #f5f5f7; color: #1d1d1f;
    }
    h1 { color: #1d1d1f; border-bottom: 2px solid #0071e3; padding-bottom: 15px; }
    h2 { color: #1d1d1f; margin-top: 30px; font-size: 18px; }
    .stats { background: #0071e3; color: white; padding: 20px; border-radius: 12px; margin-bottom: 30px; display: flex; gap: 40px; flex-wrap: wrap; }
    .stat { text-align: center; min-width: 100px; }
    .stat-number { font-size: 28px; font-weight: bold; }
    .stat-label { font-size: 13px; opacity: 0.9; }
    .category { background: white; border-radius: 12px; padding: 20px; margin: 20px 0; box-shadow: 0 2px 8px rgba(0,0,0,0.1); }
    .pdf-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 8px; margin-top: 15px; }
    .pdf-link { 
      display: block; padding: 10px 12px; background: #f5f5f7; border-radius: 6px;
      color: #0071e3; text-decoration: none; font-size: 12px; transition: background 0.2s;
      white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
    }
    .pdf-link:hover { background: #e8e8ed; }
    footer { margin-top: 40px; padding-top: 20px; border-top: 1px solid #d2d2d7; color: #86868b; font-size: 12px; }
  </style>
</head>
<body>
  <h1>📚 RADIANT Documentation PDFs</h1>
HTMLEOF

echo "  <div class=\"stats\">" >> "$PDF_DIR/index.html"
echo "    <div class=\"stat\"><div class=\"stat-number\">$SUCCESS</div><div class=\"stat-label\">PDF Files</div></div>" >> "$PDF_DIR/index.html"
echo "    <div class=\"stat\"><div class=\"stat-number\">v5.52.29</div><div class=\"stat-label\">Version</div></div>" >> "$PDF_DIR/index.html"
echo "    <div class=\"stat\"><div class=\"stat-number\">$(date +%Y-%m-%d)</div><div class=\"stat-label\">Generated</div></div>" >> "$PDF_DIR/index.html"
echo "  </div>" >> "$PDF_DIR/index.html"
echo "  <p>All RADIANT documentation converted to PDF format. Click any document to download.</p>" >> "$PDF_DIR/index.html"

# Create categories
typeset -A CATEGORIES

for PDF in "$PDF_DIR"/*.pdf(N); do
    [ -f "$PDF" ] || continue
    NAME="${PDF:t}"
    
    if [[ "$NAME" == *"authentication"* ]]; then CAT="Authentication"
    elif [[ "$NAME" == *"security"* ]]; then CAT="Security"
    elif [[ "$NAME" == *"api_"* ]]; then CAT="API Reference"
    elif [[ "$NAME" == *"sections_"* ]]; then CAT="Technical Sections"
    elif [[ "$NAME" == *"phases_"* ]]; then CAT="Implementation Phases"
    elif [[ "$NAME" == *"THINKTANK"* ]]; then CAT="Think Tank"
    elif [[ "$NAME" == *"RADIANT"* ]]; then CAT="RADIANT Platform"
    elif [[ "$NAME" == *"CATO"* ]] || [[ "$NAME" == *"GENESIS"* ]]; then CAT="Safety & Ethics"
    elif [[ "$NAME" == *"CORTEX"* ]] || [[ "$NAME" == *"AGI"* ]] || [[ "$NAME" == *"CONSCIOUSNESS"* ]]; then CAT="AI Architecture"
    elif [[ "$NAME" == *"cato_"* ]]; then CAT="Cato System"
    elif [[ "$NAME" == *"exports_"* ]] || [[ "$NAME" == *"publications_"* ]]; then CAT="Publications"
    else CAT="General"
    fi
    
    CATEGORIES[$CAT]+="$NAME|"
done

for CAT in ${(k)CATEGORIES}; do
    echo "  <div class=\"category\"><h2>📁 $CAT</h2><div class=\"pdf-grid\">" >> "$PDF_DIR/index.html"
    
    IFS='|' read -rA PDFS <<< "${CATEGORIES[$CAT]}"
    for PDF in "${PDFS[@]}"; do
        [ -z "$PDF" ] && continue
        DISPLAY="${PDF//_/ / }"
        DISPLAY="${DISPLAY%.pdf}"
        DISPLAY="${DISPLAY:0:50}"
        echo "    <a href=\"$PDF\" class=\"pdf-link\" title=\"$PDF\">📄 $DISPLAY</a>" >> "$PDF_DIR/index.html"
    done
    
    echo "  </div></div>" >> "$PDF_DIR/index.html"
done

cat >> "$PDF_DIR/index.html" << 'HTMLEOF'
  <footer>Generated by RADIANT Documentation System | v5.52.29</footer>
</body>
</html>
HTMLEOF

# Summary
echo ""
echo "════════════════════════════════════════════════════════════"
echo "✅ Successfully converted: $SUCCESS files"
if [ $FAILED -gt 0 ]; then
    echo "⚠️  Failed: $FAILED files (may have complex markdown)"
fi
echo "════════════════════════════════════════════════════════════"
echo ""
echo "📂 PDFs saved to: $PDF_DIR"
echo "🌐 Open index.html in browser: open $PDF_DIR/index.html"
echo ""
