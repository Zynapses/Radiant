#!/bin/bash
# RADIANT v4.17.0 - Commit Validation Script
# Validates conventional commits and runs pre-commit checks

set -e

COMMIT_MSG_FILE="$1"
COMMIT_MSG=$(cat "$COMMIT_MSG_FILE" 2>/dev/null || echo "$1")

echo "🔍 Validating commit..."

# Conventional commit pattern
# type(scope): description
# Types: feat, fix, docs, style, refactor, perf, test, build, ci, chore, revert
PATTERN="^(feat|fix|docs|style|refactor|perf|test|build|ci|chore|revert)(\([a-z0-9-]+\))?: .{1,100}$"

# Check first line
FIRST_LINE=$(echo "$COMMIT_MSG" | head -n1)

if ! echo "$FIRST_LINE" | grep -qE "$PATTERN"; then
  echo "❌ Invalid commit message format!"
  echo ""
  echo "Expected format: type(scope): description"
  echo ""
  echo "Types:"
  echo "  feat:     A new feature"
  echo "  fix:      A bug fix"
  echo "  docs:     Documentation only changes"
  echo "  style:    Changes that don't affect meaning (formatting)"
  echo "  refactor: Code change that neither fixes a bug nor adds a feature"
  echo "  perf:     Performance improvement"
  echo "  test:     Adding missing tests"
  echo "  build:    Changes to build system"
  echo "  ci:       Changes to CI configuration"
  echo "  chore:    Other changes that don't modify src or test"
  echo "  revert:   Reverts a previous commit"
  echo ""
  echo "Optional scopes: infrastructure, dashboard, deployer, shared, sdk, docs"
  echo ""
  echo "Examples:"
  echo "  feat(dashboard): add time machine page"
  echo "  fix(infrastructure): resolve RLS policy issue"
  echo "  docs: update deployment guide"
  echo ""
  echo "Your message: $FIRST_LINE"
  exit 1
fi

# Check description length
DESCRIPTION_LENGTH=$(echo "$FIRST_LINE" | wc -c)
if [ "$DESCRIPTION_LENGTH" -gt 100 ]; then
  echo "❌ Commit description too long (max 100 chars)"
  echo "Current length: $DESCRIPTION_LENGTH"
  exit 1
fi

# Check for breaking changes indicator
if echo "$COMMIT_MSG" | grep -q "BREAKING CHANGE:"; then
  echo "⚠️  Breaking change detected - ensure version bump is planned"
fi

echo "✅ Commit message valid: $FIRST_LINE"
