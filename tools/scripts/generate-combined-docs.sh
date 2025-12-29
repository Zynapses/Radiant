#!/bin/bash
# Generate comprehensive combined documentation for RADIANT + Think Tank
# Output: docs/RADIANT-THINKTANK-COMPLETE-DOCUMENTATION.md

set -e

DOCS_DIR="/Users/robertlong/CascadeProjects/Radiant/docs"
OUTPUT_FILE="$DOCS_DIR/RADIANT-THINKTANK-COMPLETE-DOCUMENTATION.md"

echo "Generating comprehensive documentation..."

# Start with header
cat > "$OUTPUT_FILE" << 'EOF'
# RADIANT + Think Tank Complete Documentation

**Version**: 4.18.3  
**Generated**: $(date +%Y-%m-%d)

---

> This document contains the complete documentation for the RADIANT platform and Think Tank AI.
> It is intended for comprehensive system analysis and review.

---

# Table of Contents

## Part 1: Platform Overview
- Executive Summary
- Architecture
- Technology Stack

## Part 2: Administration Guides
- RADIANT Admin Guide
- Think Tank Admin Guide
- Deployer Admin Guide

## Part 3: User Guides
- Think Tank User Guide

## Part 4: Technical Sections (0-46)
- All implementation specifications

## Part 5: Feature Documentation
- AI Ethics Standards
- Provider Rejection Handling
- User Rules System
- Pre-Prompt Learning
- Orchestration Methods
- And more...

## Part 6: API & Reference
- API Reference
- Error Codes
- Troubleshooting

---

EOF

# Add generation date
echo "" >> "$OUTPUT_FILE"
echo "**Document Generated**: $(date)" >> "$OUTPUT_FILE"
echo "" >> "$OUTPUT_FILE"
echo "---" >> "$OUTPUT_FILE"
echo "" >> "$OUTPUT_FILE"

# Part 1: Executive Summary
echo "# PART 1: PLATFORM OVERVIEW" >> "$OUTPUT_FILE"
echo "" >> "$OUTPUT_FILE"
echo "---" >> "$OUTPUT_FILE"
echo "" >> "$OUTPUT_FILE"

if [ -f "$DOCS_DIR/publications/05-EXECUTIVE-SUMMARY.md" ]; then
    echo "## Executive Summary" >> "$OUTPUT_FILE"
    echo "" >> "$OUTPUT_FILE"
    cat "$DOCS_DIR/publications/05-EXECUTIVE-SUMMARY.md" >> "$OUTPUT_FILE"
    echo "" >> "$OUTPUT_FILE"
    echo "---" >> "$OUTPUT_FILE"
    echo "" >> "$OUTPUT_FILE"
fi

if [ -f "$DOCS_DIR/ARCHITECTURE.md" ]; then
    echo "## Architecture" >> "$OUTPUT_FILE"
    echo "" >> "$OUTPUT_FILE"
    cat "$DOCS_DIR/ARCHITECTURE.md" >> "$OUTPUT_FILE"
    echo "" >> "$OUTPUT_FILE"
    echo "---" >> "$OUTPUT_FILE"
    echo "" >> "$OUTPUT_FILE"
fi

# Part 2: Admin Guides
echo "# PART 2: ADMINISTRATION GUIDES" >> "$OUTPUT_FILE"
echo "" >> "$OUTPUT_FILE"
echo "---" >> "$OUTPUT_FILE"
echo "" >> "$OUTPUT_FILE"

if [ -f "$DOCS_DIR/RADIANT-ADMIN-GUIDE.md" ]; then
    echo "## RADIANT Admin Guide" >> "$OUTPUT_FILE"
    echo "" >> "$OUTPUT_FILE"
    cat "$DOCS_DIR/RADIANT-ADMIN-GUIDE.md" >> "$OUTPUT_FILE"
    echo "" >> "$OUTPUT_FILE"
    echo "---" >> "$OUTPUT_FILE"
    echo "" >> "$OUTPUT_FILE"
fi

if [ -f "$DOCS_DIR/THINKTANK-ADMIN-GUIDE.md" ]; then
    echo "## Think Tank Admin Guide" >> "$OUTPUT_FILE"
    echo "" >> "$OUTPUT_FILE"
    cat "$DOCS_DIR/THINKTANK-ADMIN-GUIDE.md" >> "$OUTPUT_FILE"
    echo "" >> "$OUTPUT_FILE"
    echo "---" >> "$OUTPUT_FILE"
    echo "" >> "$OUTPUT_FILE"
fi

if [ -f "$DOCS_DIR/DEPLOYER-ADMIN-GUIDE.md" ]; then
    echo "## Deployer Admin Guide" >> "$OUTPUT_FILE"
    echo "" >> "$OUTPUT_FILE"
    cat "$DOCS_DIR/DEPLOYER-ADMIN-GUIDE.md" >> "$OUTPUT_FILE"
    echo "" >> "$OUTPUT_FILE"
    echo "---" >> "$OUTPUT_FILE"
    echo "" >> "$OUTPUT_FILE"
fi

# Part 3: User Guides
echo "# PART 3: USER GUIDES" >> "$OUTPUT_FILE"
echo "" >> "$OUTPUT_FILE"
echo "---" >> "$OUTPUT_FILE"
echo "" >> "$OUTPUT_FILE"

if [ -f "$DOCS_DIR/THINK-TANK-USER-GUIDE.md" ]; then
    echo "## Think Tank User Guide" >> "$OUTPUT_FILE"
    echo "" >> "$OUTPUT_FILE"
    cat "$DOCS_DIR/THINK-TANK-USER-GUIDE.md" >> "$OUTPUT_FILE"
    echo "" >> "$OUTPUT_FILE"
    echo "---" >> "$OUTPUT_FILE"
    echo "" >> "$OUTPUT_FILE"
fi

# Part 4: Technical Sections
echo "# PART 4: TECHNICAL SECTIONS" >> "$OUTPUT_FILE"
echo "" >> "$OUTPUT_FILE"
echo "---" >> "$OUTPUT_FILE"
echo "" >> "$OUTPUT_FILE"

for section in "$DOCS_DIR/sections/SECTION-"*.md; do
    if [ -f "$section" ]; then
        section_name=$(basename "$section" .md)
        echo "## $section_name" >> "$OUTPUT_FILE"
        echo "" >> "$OUTPUT_FILE"
        cat "$section" >> "$OUTPUT_FILE"
        echo "" >> "$OUTPUT_FILE"
        echo "---" >> "$OUTPUT_FILE"
        echo "" >> "$OUTPUT_FILE"
    fi
done

# Part 5: Feature Documentation
echo "# PART 5: FEATURE DOCUMENTATION" >> "$OUTPUT_FILE"
echo "" >> "$OUTPUT_FILE"
echo "---" >> "$OUTPUT_FILE"
echo "" >> "$OUTPUT_FILE"

FEATURE_DOCS=(
    "AI-ETHICS-STANDARDS.md"
    "PROVIDER-REJECTION-HANDLING.md"
    "USER-RULES-SYSTEM.md"
    "PREPROMPT-LEARNING-SYSTEM.md"
    "ORCHESTRATION-METHODS.md"
    "SEED-DATA-SYSTEM.md"
    "REVENUE-ANALYTICS.md"
    "SAAS-METRICS-DASHBOARD.md"
    "SPECIALTY-RANKING.md"
    "THINK-TANK-EASTER-EGGS.md"
    "COMPLIANCE.md"
    "DATA_RETENTION.md"
    "DISASTER_RECOVERY.md"
    "COST_OPTIMIZATION.md"
    "PERFORMANCE.md"
    "TESTING.md"
)

for doc in "${FEATURE_DOCS[@]}"; do
    if [ -f "$DOCS_DIR/$doc" ]; then
        doc_name=$(basename "$doc" .md)
        echo "## $doc_name" >> "$OUTPUT_FILE"
        echo "" >> "$OUTPUT_FILE"
        cat "$DOCS_DIR/$doc" >> "$OUTPUT_FILE"
        echo "" >> "$OUTPUT_FILE"
        echo "---" >> "$OUTPUT_FILE"
        echo "" >> "$OUTPUT_FILE"
    fi
done

# Part 6: API & Reference
echo "# PART 6: API & REFERENCE" >> "$OUTPUT_FILE"
echo "" >> "$OUTPUT_FILE"
echo "---" >> "$OUTPUT_FILE"
echo "" >> "$OUTPUT_FILE"

if [ -f "$DOCS_DIR/API_REFERENCE.md" ]; then
    echo "## API Reference" >> "$OUTPUT_FILE"
    echo "" >> "$OUTPUT_FILE"
    cat "$DOCS_DIR/API_REFERENCE.md" >> "$OUTPUT_FILE"
    echo "" >> "$OUTPUT_FILE"
    echo "---" >> "$OUTPUT_FILE"
    echo "" >> "$OUTPUT_FILE"
fi

if [ -f "$DOCS_DIR/API_VERSIONING.md" ]; then
    echo "## API Versioning" >> "$OUTPUT_FILE"
    echo "" >> "$OUTPUT_FILE"
    cat "$DOCS_DIR/API_VERSIONING.md" >> "$OUTPUT_FILE"
    echo "" >> "$OUTPUT_FILE"
    echo "---" >> "$OUTPUT_FILE"
    echo "" >> "$OUTPUT_FILE"
fi

if [ -f "$DOCS_DIR/ERROR_CODES.md" ]; then
    echo "## Error Codes" >> "$OUTPUT_FILE"
    echo "" >> "$OUTPUT_FILE"
    cat "$DOCS_DIR/ERROR_CODES.md" >> "$OUTPUT_FILE"
    echo "" >> "$OUTPUT_FILE"
    echo "---" >> "$OUTPUT_FILE"
    echo "" >> "$OUTPUT_FILE"
fi

if [ -f "$DOCS_DIR/TROUBLESHOOTING.md" ]; then
    echo "## Troubleshooting" >> "$OUTPUT_FILE"
    echo "" >> "$OUTPUT_FILE"
    cat "$DOCS_DIR/TROUBLESHOOTING.md" >> "$OUTPUT_FILE"
    echo "" >> "$OUTPUT_FILE"
    echo "---" >> "$OUTPUT_FILE"
    echo "" >> "$OUTPUT_FILE"
fi

# Part 7: Deployment
echo "# PART 7: DEPLOYMENT" >> "$OUTPUT_FILE"
echo "" >> "$OUTPUT_FILE"
echo "---" >> "$OUTPUT_FILE"
echo "" >> "$OUTPUT_FILE"

if [ -f "$DOCS_DIR/DEPLOYMENT-GUIDE.md" ]; then
    echo "## Deployment Guide" >> "$OUTPUT_FILE"
    echo "" >> "$OUTPUT_FILE"
    cat "$DOCS_DIR/DEPLOYMENT-GUIDE.md" >> "$OUTPUT_FILE"
    echo "" >> "$OUTPUT_FILE"
    echo "---" >> "$OUTPUT_FILE"
    echo "" >> "$OUTPUT_FILE"
fi

if [ -f "$DOCS_DIR/CDK-STACK-DEPENDENCIES.md" ]; then
    echo "## CDK Stack Dependencies" >> "$OUTPUT_FILE"
    echo "" >> "$OUTPUT_FILE"
    cat "$DOCS_DIR/CDK-STACK-DEPENDENCIES.md" >> "$OUTPUT_FILE"
    echo "" >> "$OUTPUT_FILE"
    echo "---" >> "$OUTPUT_FILE"
    echo "" >> "$OUTPUT_FILE"
fi

# Add CHANGELOG
echo "# PART 8: CHANGELOG" >> "$OUTPUT_FILE"
echo "" >> "$OUTPUT_FILE"
echo "---" >> "$OUTPUT_FILE"
echo "" >> "$OUTPUT_FILE"

if [ -f "/Users/robertlong/CascadeProjects/Radiant/CHANGELOG.md" ]; then
    cat "/Users/robertlong/CascadeProjects/Radiant/CHANGELOG.md" >> "$OUTPUT_FILE"
    echo "" >> "$OUTPUT_FILE"
fi

# Count lines
LINES=$(wc -l < "$OUTPUT_FILE")
echo ""
echo "✅ Generated: $OUTPUT_FILE"
echo "📄 Total lines: $LINES"
echo ""
echo "To convert to PDF, use one of these methods:"
echo ""
echo "1. Using pandoc (recommended):"
echo "   pandoc \"$OUTPUT_FILE\" -o \"$DOCS_DIR/RADIANT-THINKTANK-COMPLETE-DOCUMENTATION.pdf\" --pdf-engine=xelatex"
echo ""
echo "2. Using VS Code:"
echo "   - Open the markdown file in VS Code"
echo "   - Install 'Markdown PDF' extension"
echo "   - Right-click > 'Markdown PDF: Export (pdf)'"
echo ""
echo "3. Using grip (GitHub-style):"
echo "   grip \"$OUTPUT_FILE\" --export \"$DOCS_DIR/RADIANT-THINKTANK-COMPLETE-DOCUMENTATION.html\""
echo "   # Then print to PDF from browser"
