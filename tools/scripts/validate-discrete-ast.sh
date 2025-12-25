#!/bin/bash
set -e

# RADIANT AST-based Discrete Validation Script
# Uses TypeScript AST parsing for thorough validation (CI use)

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/../.." && pwd)"
VALIDATOR_DIR="$ROOT_DIR/tools/ast-validator"

echo "🔍 Running AST-based discrete validation..."
echo ""

# Check if validator exists
if [ ! -f "$VALIDATOR_DIR/validate-discrete.ts" ]; then
    echo "AST validator not found, falling back to grep-based validation"
    exec bash "$SCRIPT_DIR/validate-discrete.sh"
fi

# Check for ts-node
if ! command -v npx &> /dev/null; then
    echo "npx not found, falling back to grep-based validation"
    exec bash "$SCRIPT_DIR/validate-discrete.sh"
fi

# Run AST validator
cd "$VALIDATOR_DIR"
npx ts-node validate-discrete.ts

echo ""
echo "✅ AST validation complete"
