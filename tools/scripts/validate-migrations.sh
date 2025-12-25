#!/bin/bash
# RADIANT Migration Validator
# Validates database migration files for consistency and ordering

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/../.." && pwd)"
MIGRATIONS_DIR="$ROOT_DIR/packages/infrastructure/migrations"

echo "🔍 Validating RADIANT database migrations..."
echo ""

# Track validation status
ERRORS=0
WARNINGS=0

# Check if migrations directory exists
if [ ! -d "$MIGRATIONS_DIR" ]; then
    echo "❌ Migrations directory not found: $MIGRATIONS_DIR"
    exit 1
fi

# Find all SQL migration files
MIGRATION_FILES=$(find "$MIGRATIONS_DIR" -name "*.sql" -type f | sort)

if [ -z "$MIGRATION_FILES" ]; then
    echo "⚠️  No migration files found"
    exit 0
fi

echo "Found $(echo "$MIGRATION_FILES" | wc -l | tr -d ' ') migration files"
echo ""

# Extract and validate migration numbers
echo "📋 Checking migration numbering..."

PREV_NUM=0
MIGRATION_NUMS=()

for file in $MIGRATION_FILES; do
    filename=$(basename "$file")
    
    # Extract migration number (expects format: NNN_name.sql)
    if [[ $filename =~ ^([0-9]+)_ ]]; then
        num=${BASH_REMATCH[1]}
        # Remove leading zeros for comparison
        num_clean=$((10#$num))
        
        MIGRATION_NUMS+=($num_clean)
        
        # Check for gaps
        expected=$((PREV_NUM + 1))
        if [ $num_clean -ne $expected ] && [ $PREV_NUM -ne 0 ]; then
            echo "⚠️  Gap in migration numbers: expected $expected, got $num_clean"
            echo "   File: $filename"
            ((WARNINGS++))
        fi
        
        # Check for duplicates
        count=$(printf '%s\n' "${MIGRATION_NUMS[@]}" | grep -c "^$num_clean$" || true)
        if [ "$count" -gt 1 ]; then
            echo "❌ Duplicate migration number: $num_clean"
            echo "   File: $filename"
            ((ERRORS++))
        fi
        
        PREV_NUM=$num_clean
    else
        echo "❌ Invalid migration filename format: $filename"
        echo "   Expected: NNN_description.sql"
        ((ERRORS++))
    fi
done

echo ""

# Check for common SQL issues
echo "📋 Checking SQL syntax patterns..."

for file in $MIGRATION_FILES; do
    filename=$(basename "$file")
    
    # Check for missing transaction blocks (optional but recommended)
    if ! grep -q "BEGIN" "$file" 2>/dev/null; then
        # Only warn if file has actual SQL statements
        if grep -qE "^(CREATE|ALTER|DROP|INSERT|UPDATE|DELETE)" "$file" 2>/dev/null; then
            echo "⚠️  No transaction block found: $filename"
            ((WARNINGS++))
        fi
    fi
    
    # Check for dangerous operations without IF EXISTS/IF NOT EXISTS
    if grep -qE "^DROP (TABLE|INDEX|FUNCTION)" "$file" 2>/dev/null; then
        if ! grep -qE "DROP .* IF EXISTS" "$file" 2>/dev/null; then
            echo "⚠️  DROP without IF EXISTS: $filename"
            ((WARNINGS++))
        fi
    fi
    
    # Check for RLS policy usage (should use app.current_tenant_id)
    if grep -q "current_tenant_id" "$file" 2>/dev/null; then
        if ! grep -q "app.current_tenant_id" "$file" 2>/dev/null; then
            echo "❌ RLS policy should use 'app.current_tenant_id', not 'current_tenant_id': $filename"
            ((ERRORS++))
        fi
    fi
done

echo ""

# Check for rollback scripts
echo "📋 Checking for rollback scripts..."

ROLLBACK_DIR="$MIGRATIONS_DIR/rollback"
if [ ! -d "$ROLLBACK_DIR" ]; then
    echo "⚠️  No rollback directory found at: $ROLLBACK_DIR"
    ((WARNINGS++))
else
    for file in $MIGRATION_FILES; do
        filename=$(basename "$file")
        rollback_file="$ROLLBACK_DIR/rollback_$filename"
        
        if [ ! -f "$rollback_file" ]; then
            # Only warn for migrations that modify schema
            if grep -qE "^(CREATE|ALTER|DROP)" "$file" 2>/dev/null; then
                echo "⚠️  Missing rollback script for: $filename"
                ((WARNINGS++))
            fi
        fi
    done
fi

echo ""

# Generate migration manifest
echo "📋 Generating migration manifest..."

MANIFEST_FILE="$MIGRATIONS_DIR/manifest.json"

# Get highest migration number
LATEST_NUM=$(printf '%s\n' "${MIGRATION_NUMS[@]}" | sort -n | tail -1)

cat > "$MANIFEST_FILE" << EOF
{
  "generatedAt": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
  "totalMigrations": ${#MIGRATION_NUMS[@]},
  "latestMigration": $LATEST_NUM,
  "migrationRange": {
    "from": 1,
    "to": $LATEST_NUM
  },
  "migrations": [
EOF

first=true
for file in $MIGRATION_FILES; do
    filename=$(basename "$file")
    if [[ $filename =~ ^([0-9]+)_(.*)\.sql$ ]]; then
        num=${BASH_REMATCH[1]}
        name=${BASH_REMATCH[2]}
        
        if [ "$first" = true ]; then
            first=false
        else
            echo "," >> "$MANIFEST_FILE"
        fi
        
        # Get file hash
        hash=$(shasum -a 256 "$file" | cut -d' ' -f1)
        
        printf '    {"number": %d, "name": "%s", "filename": "%s", "hash": "%s"}' \
            "$((10#$num))" "$name" "$filename" "$hash" >> "$MANIFEST_FILE"
    fi
done

cat >> "$MANIFEST_FILE" << EOF

  ]
}
EOF

echo "   Generated: $MANIFEST_FILE"

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

if [ $ERRORS -gt 0 ]; then
    echo "❌ Validation FAILED: $ERRORS errors, $WARNINGS warnings"
    exit 1
elif [ $WARNINGS -gt 0 ]; then
    echo "⚠️  Validation PASSED with $WARNINGS warnings"
    exit 0
else
    echo "✅ Validation PASSED: All migrations are valid"
    exit 0
fi
