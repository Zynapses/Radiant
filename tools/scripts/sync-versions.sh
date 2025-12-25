#!/bin/bash
# RADIANT Version Sync Script
# Ensures version numbers are consistent across all files

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/../.." && pwd)"

# Read canonical versions
PACKAGE_VERSION=$(cat "$ROOT_DIR/VERSION" | tr -d '\n')
RADIANT_VERSION=$(cat "$ROOT_DIR/RADIANT_VERSION" | tr -d '\n')
THINKTANK_VERSION=$(cat "$ROOT_DIR/THINKTANK_VERSION" | tr -d '\n')

echo "🔄 RADIANT Version Sync"
echo "   Package Version: $PACKAGE_VERSION"
echo "   Radiant Version: $RADIANT_VERSION"
echo "   Think Tank Version: $THINKTANK_VERSION"
echo ""

# Track changes
CHANGES=0

# Function to update version in file
update_version() {
    local file=$1
    local pattern=$2
    local replacement=$3
    local description=$4
    
    if [ -f "$file" ]; then
        if grep -q "$pattern" "$file" 2>/dev/null; then
            # Check if update needed
            if ! grep -q "$replacement" "$file" 2>/dev/null; then
                sed -i.bak "s|$pattern|$replacement|g" "$file"
                rm -f "$file.bak"
                echo "✅ Updated $description in $file"
                ((CHANGES++))
            fi
        fi
    fi
}

# Update root package.json
echo "📦 Checking package.json files..."

ROOT_PKG="$ROOT_DIR/package.json"
if [ -f "$ROOT_PKG" ]; then
    current=$(grep -o '"version": "[^"]*"' "$ROOT_PKG" | head -1 | cut -d'"' -f4)
    if [ "$current" != "$PACKAGE_VERSION" ]; then
        sed -i.bak "s|\"version\": \"$current\"|\"version\": \"$PACKAGE_VERSION\"|" "$ROOT_PKG"
        rm -f "$ROOT_PKG.bak"
        echo "✅ Updated root package.json: $current -> $PACKAGE_VERSION"
        ((CHANGES++))
    fi
fi

# Update packages/shared/package.json
SHARED_PKG="$ROOT_DIR/packages/shared/package.json"
if [ -f "$SHARED_PKG" ]; then
    current=$(grep -o '"version": "[^"]*"' "$SHARED_PKG" | head -1 | cut -d'"' -f4)
    if [ "$current" != "$PACKAGE_VERSION" ]; then
        sed -i.bak "s|\"version\": \"$current\"|\"version\": \"$PACKAGE_VERSION\"|" "$SHARED_PKG"
        rm -f "$SHARED_PKG.bak"
        echo "✅ Updated shared package.json: $current -> $PACKAGE_VERSION"
        ((CHANGES++))
    fi
fi

# Update packages/infrastructure/package.json
INFRA_PKG="$ROOT_DIR/packages/infrastructure/package.json"
if [ -f "$INFRA_PKG" ]; then
    current=$(grep -o '"version": "[^"]*"' "$INFRA_PKG" | head -1 | cut -d'"' -f4)
    if [ "$current" != "$PACKAGE_VERSION" ]; then
        sed -i.bak "s|\"version\": \"$current\"|\"version\": \"$PACKAGE_VERSION\"|" "$INFRA_PKG"
        rm -f "$INFRA_PKG.bak"
        echo "✅ Updated infrastructure package.json: $current -> $PACKAGE_VERSION"
        ((CHANGES++))
    fi
fi

# Update Swift Package.swift
echo ""
echo "🍎 Checking Swift Package.swift..."

SWIFT_PKG="$ROOT_DIR/apps/swift-deployer/Package.swift"
if [ -f "$SWIFT_PKG" ]; then
    # Look for version constant
    if grep -q 'let RADIANT_VERSION' "$SWIFT_PKG"; then
        current=$(grep 'let RADIANT_VERSION' "$SWIFT_PKG" | grep -o '"[^"]*"' | tr -d '"')
        if [ "$current" != "$RADIANT_VERSION" ]; then
            sed -i.bak "s|let RADIANT_VERSION = \"$current\"|let RADIANT_VERSION = \"$RADIANT_VERSION\"|" "$SWIFT_PKG"
            rm -f "$SWIFT_PKG.bak"
            echo "✅ Updated Package.swift RADIANT_VERSION: $current -> $RADIANT_VERSION"
            ((CHANGES++))
        fi
    fi
fi

# Update version constant in Swift code
SWIFT_CONST="$ROOT_DIR/apps/swift-deployer/Sources/RadiantDeployer/Constants.swift"
if [ -f "$SWIFT_CONST" ]; then
    if grep -q 'let RADIANT_VERSION' "$SWIFT_CONST"; then
        current=$(grep 'let RADIANT_VERSION' "$SWIFT_CONST" | grep -o '"[^"]*"' | tr -d '"')
        if [ "$current" != "$RADIANT_VERSION" ]; then
            sed -i.bak "s|let RADIANT_VERSION = \"$current\"|let RADIANT_VERSION = \"$RADIANT_VERSION\"|" "$SWIFT_CONST"
            rm -f "$SWIFT_CONST.bak"
            echo "✅ Updated Constants.swift RADIANT_VERSION: $current -> $RADIANT_VERSION"
            ((CHANGES++))
        fi
    fi
fi

# Update admin dashboard package.json
echo ""
echo "🖥️  Checking admin dashboard..."

ADMIN_PKG="$ROOT_DIR/apps/admin-dashboard/package.json"
if [ -f "$ADMIN_PKG" ]; then
    current=$(grep -o '"version": "[^"]*"' "$ADMIN_PKG" | head -1 | cut -d'"' -f4)
    if [ "$current" != "$PACKAGE_VERSION" ]; then
        sed -i.bak "s|\"version\": \"$current\"|\"version\": \"$PACKAGE_VERSION\"|" "$ADMIN_PKG"
        rm -f "$ADMIN_PKG.bak"
        echo "✅ Updated admin-dashboard package.json: $current -> $PACKAGE_VERSION"
        ((CHANGES++))
    fi
fi

# Check documentation for outdated versions
echo ""
echo "📚 Checking documentation..."

DOCS_DIR="$ROOT_DIR/docs"
if [ -d "$DOCS_DIR" ]; then
    # Find docs with hardcoded old versions (warn only)
    OLD_VERSIONS=$(grep -rn "v4\.1[0-6]\." "$DOCS_DIR" --include="*.md" 2>/dev/null | head -10 || true)
    if [ -n "$OLD_VERSIONS" ]; then
        echo "⚠️  Found potentially outdated version references in docs:"
        echo "$OLD_VERSIONS" | head -5
        echo "   (Run manually to update documentation version references)"
    fi
fi

# Update VERSION_HISTORY.json if needed
echo ""
echo "📜 Checking VERSION_HISTORY.json..."

VERSION_HISTORY="$ROOT_DIR/VERSION_HISTORY.json"
if [ -f "$VERSION_HISTORY" ]; then
    # Check if current version exists in history
    if ! grep -q "\"version\": \"$PACKAGE_VERSION\"" "$VERSION_HISTORY"; then
        echo "⚠️  Current version $PACKAGE_VERSION not found in VERSION_HISTORY.json"
        echo "   Run 'npm run version:bump' to properly record version"
    fi
fi

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

if [ $CHANGES -gt 0 ]; then
    echo "✅ Synced $CHANGES file(s)"
else
    echo "✅ All versions are in sync"
fi
