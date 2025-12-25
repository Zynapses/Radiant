#!/bin/bash
set -e

# RADIANT Changelog Generator
# Generates CHANGELOG.md from Conventional Commits

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/../.." && pwd)"

VERSION=$(cat "$ROOT_DIR/VERSION" | tr -d '\n')
DATE=$(date +%Y-%m-%d)

echo "📝 Generating changelog for v$VERSION..."

# Create temporary changelog content
TEMP_CHANGELOG=$(mktemp)

cat > "$TEMP_CHANGELOG" << EOF
## [$VERSION] - $DATE

EOF

# Group commits by type
echo "### ✨ Features" >> "$TEMP_CHANGELOG"
git log --oneline --since="2024-01-01" 2>/dev/null | grep -E "^[a-f0-9]+ feat(\(.+\))?:" | sed 's/^[a-f0-9]* feat[^:]*: /- /' >> "$TEMP_CHANGELOG" 2>/dev/null || echo "- No new features" >> "$TEMP_CHANGELOG"
echo "" >> "$TEMP_CHANGELOG"

echo "### 🐛 Bug Fixes" >> "$TEMP_CHANGELOG"
git log --oneline --since="2024-01-01" 2>/dev/null | grep -E "^[a-f0-9]+ fix(\(.+\))?:" | sed 's/^[a-f0-9]* fix[^:]*: /- /' >> "$TEMP_CHANGELOG" 2>/dev/null || echo "- No bug fixes" >> "$TEMP_CHANGELOG"
echo "" >> "$TEMP_CHANGELOG"

echo "### 📚 Documentation" >> "$TEMP_CHANGELOG"
git log --oneline --since="2024-01-01" 2>/dev/null | grep -E "^[a-f0-9]+ docs(\(.+\))?:" | sed 's/^[a-f0-9]* docs[^:]*: /- /' >> "$TEMP_CHANGELOG" 2>/dev/null || echo "- No documentation changes" >> "$TEMP_CHANGELOG"
echo "" >> "$TEMP_CHANGELOG"

echo "### 🔧 Maintenance" >> "$TEMP_CHANGELOG"
git log --oneline --since="2024-01-01" 2>/dev/null | grep -E "^[a-f0-9]+ (chore|refactor|perf|build|ci)(\(.+\))?:" | sed 's/^[a-f0-9]* [^:]*: /- /' >> "$TEMP_CHANGELOG" 2>/dev/null || echo "- No maintenance changes" >> "$TEMP_CHANGELOG"
echo "" >> "$TEMP_CHANGELOG"

# Check for breaking changes
BREAKING=$(git log --oneline --since="2024-01-01" 2>/dev/null | grep -E "^[a-f0-9]+ [a-z]+(\(.+\))?!:" || true)
if [ -n "$BREAKING" ]; then
    echo "### ⚠️ Breaking Changes" >> "$TEMP_CHANGELOG"
    echo "$BREAKING" | sed 's/^[a-f0-9]* [^:]*: /- /' >> "$TEMP_CHANGELOG"
    echo "" >> "$TEMP_CHANGELOG"
fi

# Prepend to existing changelog
if [ -f "$ROOT_DIR/CHANGELOG.md" ]; then
    # Read existing content after header
    EXISTING=$(tail -n +3 "$ROOT_DIR/CHANGELOG.md")
    
    cat > "$ROOT_DIR/CHANGELOG.md" << EOF
# Changelog

$(cat "$TEMP_CHANGELOG")
$EXISTING
EOF
else
    cat > "$ROOT_DIR/CHANGELOG.md" << EOF
# Changelog

All notable changes to RADIANT will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

$(cat "$TEMP_CHANGELOG")
EOF
fi

rm "$TEMP_CHANGELOG"

echo "✅ Changelog updated"
