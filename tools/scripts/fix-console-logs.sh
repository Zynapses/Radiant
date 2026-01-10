#!/bin/bash
# RADIANT v5.2.1 - Fix console.log statements in Lambda code
# Replaces console.log/error/warn with structured logger calls
# Run from project root: ./tools/scripts/fix-console-logs.sh

set -e

LAMBDA_DIR="packages/infrastructure/lambda"

# Files to process (excluding logger files themselves)
FILES=$(find "$LAMBDA_DIR" -name "*.ts" \
  -not -path "*/node_modules/*" \
  -not -name "logger.ts" \
  -not -name "enhanced-logger.ts" \
  | xargs grep -l "console\.\(log\|error\|warn\)" 2>/dev/null || true)

if [ -z "$FILES" ]; then
  echo "No files with console.log found"
  exit 0
fi

echo "Found $(echo "$FILES" | wc -l | tr -d ' ') files with console statements"

for file in $FILES; do
  echo "Processing: $file"
  
  # Check if logger is already imported
  if ! grep -q "import.*logger.*from.*logging/enhanced-logger" "$file"; then
    # Find the last import line and add logger import after it
    if grep -q "^import " "$file"; then
      # Add import after the last import statement
      sed -i '' '/^import /{ 
        :a
        n
        /^import /ba
        i\
import { logger } from '\''../shared/logging/enhanced-logger'\'';
      }' "$file" 2>/dev/null || true
    fi
  fi
  
  # Replace console.log with logger.info
  sed -i '' 's/console\.log(/logger.info(/g' "$file"
  
  # Replace console.error with logger.error  
  sed -i '' 's/console\.error(/logger.error(/g' "$file"
  
  # Replace console.warn with logger.warn
  sed -i '' 's/console\.warn(/logger.warn(/g' "$file"
done

echo "Done! Please review changes and fix any import path issues."
echo "Some files may need manual import path adjustment based on directory depth."
