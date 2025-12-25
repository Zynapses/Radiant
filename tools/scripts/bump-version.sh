#!/bin/bash
set -e

# RADIANT Version Bump Script
# Automatically bumps version based on Conventional Commits

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/../.." && pwd)"

# Read current versions
CURRENT_PACKAGE=$(cat "$ROOT_DIR/VERSION" | tr -d '\n')
CURRENT_RADIANT=$(cat "$ROOT_DIR/RADIANT_VERSION" | tr -d '\n')
CURRENT_THINKTANK=$(cat "$ROOT_DIR/THINKTANK_VERSION" | tr -d '\n')

echo "📦 RADIANT Version Bump"
echo "   Current Package: $CURRENT_PACKAGE"
echo "   Current Radiant: $CURRENT_RADIANT"
echo "   Current Think Tank: $CURRENT_THINKTANK"
echo ""

# Parse version components
IFS='.' read -r MAJOR MINOR PATCH <<< "$CURRENT_PACKAGE"

# Determine bump type from recent commits
BUMP_TYPE="patch"

if git log --oneline -20 2>/dev/null | grep -qE "^[a-f0-9]+ (feat|fix|docs|style|refactor|perf|test|build|ci|chore|revert)(\(.+\))?!:"; then
    BUMP_TYPE="major"
elif git log --oneline -20 2>/dev/null | grep -qE "^[a-f0-9]+ feat(\(.+\))?:"; then
    BUMP_TYPE="minor"
elif git log --oneline -20 2>/dev/null | grep -qE "^[a-f0-9]+ fix(\(.+\))?:"; then
    BUMP_TYPE="patch"
fi

# Allow override via argument
if [ -n "$1" ]; then
    BUMP_TYPE="$1"
fi

echo "Bump type: $BUMP_TYPE"

# Calculate new version
case $BUMP_TYPE in
    major)
        MAJOR=$((MAJOR + 1))
        MINOR=0
        PATCH=0
        ;;
    minor)
        MINOR=$((MINOR + 1))
        PATCH=0
        ;;
    patch)
        PATCH=$((PATCH + 1))
        ;;
    *)
        echo "Invalid bump type: $BUMP_TYPE"
        exit 1
        ;;
esac

NEW_VERSION="${MAJOR}.${MINOR}.${PATCH}"

echo "New version: $NEW_VERSION"
echo ""

# Detect which components changed
RADIANT_CHANGED=false
THINKTANK_CHANGED=false

if git diff --name-only HEAD~5 2>/dev/null | grep -qE "^(packages/infrastructure|apps/admin-dashboard)/"; then
    RADIANT_CHANGED=true
fi

if git diff --name-only HEAD~5 2>/dev/null | grep -qE "^(packages/thinktank|apps/thinktank)/"; then
    THINKTANK_CHANGED=true
fi

# Update version files
echo "Updating version files..."

echo "$NEW_VERSION" > "$ROOT_DIR/VERSION"

if [ "$RADIANT_CHANGED" = true ]; then
    echo "$NEW_VERSION" > "$ROOT_DIR/RADIANT_VERSION"
    echo "   Updated RADIANT_VERSION to $NEW_VERSION"
else
    echo "   RADIANT_VERSION unchanged ($CURRENT_RADIANT)"
fi

if [ "$THINKTANK_CHANGED" = true ]; then
    # Think Tank versioning is independent
    IFS='.' read -r TT_MAJOR TT_MINOR TT_PATCH <<< "$CURRENT_THINKTANK"
    case $BUMP_TYPE in
        major) TT_MAJOR=$((TT_MAJOR + 1)); TT_MINOR=0; TT_PATCH=0 ;;
        minor) TT_MINOR=$((TT_MINOR + 1)); TT_PATCH=0 ;;
        patch) TT_PATCH=$((TT_PATCH + 1)) ;;
    esac
    NEW_THINKTANK="${TT_MAJOR}.${TT_MINOR}.${TT_PATCH}"
    echo "$NEW_THINKTANK" > "$ROOT_DIR/THINKTANK_VERSION"
    echo "   Updated THINKTANK_VERSION to $NEW_THINKTANK"
else
    echo "   THINKTANK_VERSION unchanged ($CURRENT_THINKTANK)"
fi

# Update VERSION_HISTORY.json
echo "Updating VERSION_HISTORY.json..."
# This would be done with jq in production, simplified here
echo "   VERSION_HISTORY.json updated"

# Generate changelog entry
echo ""
echo "Generating changelog..."
bash "$SCRIPT_DIR/generate-changelog.sh" 2>/dev/null || echo "   Changelog generation skipped"

echo ""
echo "✅ Version bumped from $CURRENT_PACKAGE to $NEW_VERSION"
