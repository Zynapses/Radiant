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
generate_pdf "DEPLOYER-ADMIN-GUIDE.md" "RADIANT-Deployer-Admin-Guide.pdf" "RADIANT Deployer - Administrator Guide"
generate_pdf "RADIANT-ADMIN-GUIDE.md" "RADIANT-Platform-Admin-Guide.pdf" "RADIANT Platform - Administrator Guide"
generate_pdf "THINK-TANK-USER-GUIDE.md" "Think-Tank-User-Guide.pdf" "Think Tank AI - User Guide"
generate_pdf "ERROR_CODES.md" "RADIANT-Error-Codes-Reference.pdf" "RADIANT Error Codes Reference"
generate_pdf "TESTING.md" "RADIANT-Testing-Guide.pdf" "RADIANT Testing Guide"
generate_pdf "API_REFERENCE.md" "RADIANT-API-Reference.pdf" "RADIANT API Reference"

echo ""
echo "✅ PDF generation complete!"
echo ""
echo "Generated files:"
ls -la "$OUTPUT_DIR"/*.pdf 2>/dev/null || echo "   No PDF files found"
