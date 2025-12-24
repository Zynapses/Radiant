#!/bin/bash
# RADIANT Migration Runner
# Run database migrations in order

set -e

MIGRATIONS_DIR="packages/infrastructure/migrations"
SEED_DIR="packages/infrastructure/migrations/seed"

# Database connection (update these or use environment variables)
DB_HOST="${LOCAL_DB_HOST:-localhost}"
DB_PORT="${LOCAL_DB_PORT:-5432}"
DB_USER="${LOCAL_DB_USER:-radiant}"
DB_NAME="${LOCAL_DB_NAME:-radiant_dev}"

echo "🗃️  RADIANT Migration Runner"
echo "============================"
echo ""
echo "Database: $DB_NAME @ $DB_HOST:$DB_PORT"
echo ""

# Check if psql is available
if ! command -v psql &> /dev/null; then
    echo "❌ psql is not installed. Please install PostgreSQL client."
    exit 1
fi

# Function to run a single migration
run_migration() {
    local file=$1
    local filename=$(basename "$file")
    echo "  Running: $filename"
    PGPASSWORD="$LOCAL_DB_PASSWORD" psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -f "$file" -q
}

# Parse arguments
INCLUDE_SEED=false
ONLY_SEED=false

while [[ "$#" -gt 0 ]]; do
    case $1 in
        --seed) INCLUDE_SEED=true ;;
        --only-seed) ONLY_SEED=true ;;
        -h|--help)
            echo "Usage: $0 [options]"
            echo ""
            echo "Options:"
            echo "  --seed       Include seed data after migrations"
            echo "  --only-seed  Only run seed data (skip migrations)"
            echo "  -h, --help   Show this help"
            exit 0
            ;;
        *) echo "Unknown option: $1"; exit 1 ;;
    esac
    shift
done

# Run migrations
if [ "$ONLY_SEED" = false ]; then
    echo "📋 Running migrations..."
    
    # Get all SQL files sorted by name
    for file in $(ls -1 "$MIGRATIONS_DIR"/*.sql 2>/dev/null | sort); do
        run_migration "$file"
    done
    
    echo "✅ Migrations complete"
    echo ""
fi

# Run seed data
if [ "$INCLUDE_SEED" = true ] || [ "$ONLY_SEED" = true ]; then
    echo "🌱 Running seed data..."
    
    for file in $(ls -1 "$SEED_DIR"/*.sql 2>/dev/null | sort); do
        run_migration "$file"
    done
    
    echo "✅ Seed data complete"
    echo ""
fi

echo "✨ Done!"
