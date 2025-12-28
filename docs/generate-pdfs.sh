#!/bin/bash
# Generate beautiful PDF documentation from Markdown files
# Requires: pandoc, xelatex

set -e

DOCS_DIR="$(cd "$(dirname "$0")" && pwd)"
OUTPUT_DIR="$DOCS_DIR/pdf"
DATE=$(date +"%Y-%m-%d")

# Create output directory
mkdir -p "$OUTPUT_DIR"

echo "📚 Generating RADIANT Documentation PDFs..."
echo "   Output directory: $OUTPUT_DIR"
echo ""

# Function to generate PDF
generate_pdf() {
    local input="$1"
    local output="$2"
    local title="$3"
    
    echo "   📄 Generating: $output"
    
    pandoc "$input" \
        -o "$OUTPUT_DIR/$output" \
        --pdf-engine=xelatex \
        --toc \
        --toc-depth=3 \
        -V geometry:margin=1in \
        -V fontsize=11pt \
        -V colorlinks=true \
        -V linkcolor=NavyBlue \
        -V urlcolor=NavyBlue \
        -V documentclass=article \
        -V papersize=letter \
        --metadata title="$title" \
        --metadata author="RADIANT Team" \
        --metadata date="$DATE" \
        --standalone
}

# Generate individual PDFs
generate_pdf "$DOCS_DIR/DEPLOYER-ADMIN-GUIDE.md" "RADIANT-Deployer-Admin-Guide.pdf" "RADIANT Deployer - Administrator Guide"
generate_pdf "$DOCS_DIR/RADIANT-ADMIN-GUIDE.md" "RADIANT-Platform-Admin-Guide.pdf" "RADIANT Platform - Administrator Guide"
generate_pdf "$DOCS_DIR/THINK-TANK-USER-GUIDE.md" "Think-Tank-User-Guide.pdf" "Think Tank AI - User Guide"
generate_pdf "$DOCS_DIR/ERROR_CODES.md" "RADIANT-Error-Codes-Reference.pdf" "RADIANT Error Codes Reference"
generate_pdf "$DOCS_DIR/TESTING.md" "RADIANT-Testing-Guide.pdf" "RADIANT Testing Guide"
generate_pdf "$DOCS_DIR/API_REFERENCE.md" "RADIANT-API-Reference.pdf" "RADIANT API Reference"

# Generate combined complete documentation
echo "   📚 Generating: RADIANT-Complete-Documentation.pdf (combined)"

# Concatenate all major docs into one
cat > "$DOCS_DIR/.combined-docs.md" << 'HEADER'
---
title: "RADIANT Platform v4.18.2 - Complete Documentation"
author: "RADIANT Team"
date: "December 2024"
---

\newpage

HEADER

# Add each document with page breaks
echo "" >> "$DOCS_DIR/.combined-docs.md"
cat "$DOCS_DIR/RADIANT-SYSTEM-GUIDE.md" >> "$DOCS_DIR/.combined-docs.md"
echo -e "\n\n\\\\newpage\n\n" >> "$DOCS_DIR/.combined-docs.md"

cat "$DOCS_DIR/ARCHITECTURE.md" >> "$DOCS_DIR/.combined-docs.md"
echo -e "\n\n\\\\newpage\n\n" >> "$DOCS_DIR/.combined-docs.md"

cat "$DOCS_DIR/DEPLOYMENT-GUIDE.md" >> "$DOCS_DIR/.combined-docs.md"
echo -e "\n\n\\\\newpage\n\n" >> "$DOCS_DIR/.combined-docs.md"

cat "$DOCS_DIR/RADIANT-ADMIN-GUIDE.md" >> "$DOCS_DIR/.combined-docs.md"
echo -e "\n\n\\\\newpage\n\n" >> "$DOCS_DIR/.combined-docs.md"

cat "$DOCS_DIR/DEPLOYER-ADMIN-GUIDE.md" >> "$DOCS_DIR/.combined-docs.md"
echo -e "\n\n\\\\newpage\n\n" >> "$DOCS_DIR/.combined-docs.md"

cat "$DOCS_DIR/DEPLOYER-ARCHITECTURE.md" >> "$DOCS_DIR/.combined-docs.md"
echo -e "\n\n\\\\newpage\n\n" >> "$DOCS_DIR/.combined-docs.md"

cat "$DOCS_DIR/THINK-TANK-USER-GUIDE.md" >> "$DOCS_DIR/.combined-docs.md"
echo -e "\n\n\\\\newpage\n\n" >> "$DOCS_DIR/.combined-docs.md"

cat "$DOCS_DIR/API_REFERENCE.md" >> "$DOCS_DIR/.combined-docs.md"
echo -e "\n\n\\\\newpage\n\n" >> "$DOCS_DIR/.combined-docs.md"

cat "$DOCS_DIR/API_VERSIONING.md" >> "$DOCS_DIR/.combined-docs.md"
echo -e "\n\n\\\\newpage\n\n" >> "$DOCS_DIR/.combined-docs.md"

cat "$DOCS_DIR/ERROR_CODES.md" >> "$DOCS_DIR/.combined-docs.md"
echo -e "\n\n\\\\newpage\n\n" >> "$DOCS_DIR/.combined-docs.md"

cat "$DOCS_DIR/TESTING.md" >> "$DOCS_DIR/.combined-docs.md"
echo -e "\n\n\\\\newpage\n\n" >> "$DOCS_DIR/.combined-docs.md"

cat "$DOCS_DIR/COMPLIANCE.md" >> "$DOCS_DIR/.combined-docs.md"
echo -e "\n\n\\\\newpage\n\n" >> "$DOCS_DIR/.combined-docs.md"

cat "$DOCS_DIR/COST_OPTIMIZATION.md" >> "$DOCS_DIR/.combined-docs.md"
echo -e "\n\n\\\\newpage\n\n" >> "$DOCS_DIR/.combined-docs.md"

cat "$DOCS_DIR/DATA_RETENTION.md" >> "$DOCS_DIR/.combined-docs.md"
echo -e "\n\n\\\\newpage\n\n" >> "$DOCS_DIR/.combined-docs.md"

cat "$DOCS_DIR/DISASTER_RECOVERY.md" >> "$DOCS_DIR/.combined-docs.md"
echo -e "\n\n\\\\newpage\n\n" >> "$DOCS_DIR/.combined-docs.md"

cat "$DOCS_DIR/PERFORMANCE.md" >> "$DOCS_DIR/.combined-docs.md"
echo -e "\n\n\\\\newpage\n\n" >> "$DOCS_DIR/.combined-docs.md"

cat "$DOCS_DIR/SEED-DATA-SYSTEM.md" >> "$DOCS_DIR/.combined-docs.md"
echo -e "\n\n\\\\newpage\n\n" >> "$DOCS_DIR/.combined-docs.md"

cat "$DOCS_DIR/TROUBLESHOOTING.md" >> "$DOCS_DIR/.combined-docs.md"
echo -e "\n\n\\\\newpage\n\n" >> "$DOCS_DIR/.combined-docs.md"

cat "$DOCS_DIR/CDK-STACK-DEPENDENCIES.md" >> "$DOCS_DIR/.combined-docs.md"

# Generate the combined PDF
pandoc "$DOCS_DIR/.combined-docs.md" \
    -o "$OUTPUT_DIR/RADIANT-Complete-Documentation-v4.18.2.pdf" \
    --pdf-engine=xelatex \
    --toc \
    --toc-depth=3 \
    -V geometry:margin=1in \
    -V fontsize=10pt \
    -V colorlinks=true \
    -V linkcolor=NavyBlue \
    -V urlcolor=NavyBlue \
    -V documentclass=report \
    -V papersize=letter \
    --metadata title="RADIANT Platform v4.18.2 - Complete Documentation" \
    --metadata author="RADIANT Team" \
    --metadata date="$DATE" \
    --standalone 2>/dev/null || echo "      (warnings suppressed)"

# Clean up temp file
rm -f "$DOCS_DIR/.combined-docs.md"

echo ""
echo "✅ PDF generation complete!"
echo ""
echo "Generated files:"
ls -la "$OUTPUT_DIR"/*.pdf 2>/dev/null || echo "   No PDF files found"
