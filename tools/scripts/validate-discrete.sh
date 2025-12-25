#!/bin/bash
set -e

# RADIANT Discrete Validation Script (Grep-based, fast)
# Validates that Radiant and Think Tank remain discrete (no cross-imports)

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/../.." && pwd)"

echo "🔍 Running discrete validation (grep-based)..."
echo ""

ERRORS=0

# Check for Think Tank imports in Radiant code
echo "Checking Radiant for Think Tank imports..."
if grep -r "from.*thinktank" "$ROOT_DIR/packages/infrastructure" 2>/dev/null | grep -v node_modules | grep -v ".git"; then
    echo "❌ Found Think Tank imports in Radiant infrastructure"
    ERRORS=$((ERRORS + 1))
fi

if grep -r "import.*ThinkTank" "$ROOT_DIR/apps/admin-dashboard" 2>/dev/null | grep -v node_modules | grep -v ".git"; then
    echo "❌ Found Think Tank imports in Admin Dashboard"
    ERRORS=$((ERRORS + 1))
fi

# Check for Radiant imports in Think Tank code
echo "Checking Think Tank for Radiant imports..."
if [ -d "$ROOT_DIR/packages/thinktank" ]; then
    if grep -r "from.*radiant" "$ROOT_DIR/packages/thinktank" 2>/dev/null | grep -v node_modules | grep -v ".git" | grep -v "@radiant/shared"; then
        echo "❌ Found Radiant imports in Think Tank (except shared)"
        ERRORS=$((ERRORS + 1))
    fi
fi

# Check for hardcoded cross-references
echo "Checking for hardcoded cross-references..."
CROSS_REF_PATTERNS=(
    "radiant.*thinktank.*direct"
    "thinktank.*radiant.*direct"
)

for pattern in "${CROSS_REF_PATTERNS[@]}"; do
    if grep -ri "$pattern" "$ROOT_DIR/packages" 2>/dev/null | grep -v node_modules | grep -v ".git"; then
        echo "❌ Found cross-reference pattern: $pattern"
        ERRORS=$((ERRORS + 1))
    fi
done

# Check shared imports are from @radiant/shared only
echo "Validating shared imports..."
if grep -r "packages/shared" "$ROOT_DIR/packages/infrastructure" 2>/dev/null | grep -v node_modules | grep -v ".git" | grep -v "package.json"; then
    echo "⚠️  Found direct path imports to shared (should use @radiant/shared)"
fi

echo ""
if [ $ERRORS -eq 0 ]; then
    echo "✅ Discrete validation passed"
    exit 0
else
    echo "❌ Discrete validation failed with $ERRORS error(s)"
    exit 1
fi
