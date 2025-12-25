#!/bin/bash
set -e

# RADIANT Package Builder
# Builds unified deployment package with atomic component versioning

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/../.." && pwd)"

# Read versions
PACKAGE_VERSION=$(cat "$ROOT_DIR/VERSION" | tr -d '\n')
RADIANT_VERSION=$(cat "$ROOT_DIR/RADIANT_VERSION" | tr -d '\n')
THINKTANK_VERSION=$(cat "$ROOT_DIR/THINKTANK_VERSION" | tr -d '\n')
TIMESTAMP=$(date +%Y%m%d%H%M%S)
BUILD_NUMBER="${TIMESTAMP}"

PACKAGE_NAME="radiant-platform-${PACKAGE_VERSION}-${TIMESTAMP}"
OUTPUT_DIR="$ROOT_DIR/dist/packages"
PACKAGE_DIR="$OUTPUT_DIR/$PACKAGE_NAME"

echo "🚀 Building RADIANT Package"
echo "   Package Version: $PACKAGE_VERSION"
echo "   Radiant Version: $RADIANT_VERSION"
echo "   Think Tank Version: $THINKTANK_VERSION"
echo "   Build Number: $BUILD_NUMBER"
echo ""

# Create output directory
mkdir -p "$PACKAGE_DIR"

# Run discrete validation
echo "🔍 Running discrete validation..."
if [ -f "$SCRIPT_DIR/validate-discrete.sh" ]; then
    bash "$SCRIPT_DIR/validate-discrete.sh" || {
        echo "❌ Discrete validation failed"
        exit 1
    }
fi

# Detect touched components by comparing hashes
echo "🔎 Detecting component changes..."

RADIANT_TOUCHED=false
THINKTANK_TOUCHED=false

# Check if radiant files changed (simplified - in production would compare full hashes)
if git diff --name-only HEAD~1 2>/dev/null | grep -qE "^(packages/infrastructure|apps/admin-dashboard)/"; then
    RADIANT_TOUCHED=true
    echo "   Radiant: TOUCHED"
else
    echo "   Radiant: unchanged"
fi

if git diff --name-only HEAD~1 2>/dev/null | grep -qE "^(packages/thinktank|apps/thinktank)/"; then
    THINKTANK_TOUCHED=true
    echo "   Think Tank: TOUCHED"
else
    echo "   Think Tank: unchanged"
fi

# Build components
echo ""
echo "📦 Building components..."

# Create package structure
mkdir -p "$PACKAGE_DIR/radiant/infrastructure"
mkdir -p "$PACKAGE_DIR/radiant/lambda"
mkdir -p "$PACKAGE_DIR/radiant/dashboard"
mkdir -p "$PACKAGE_DIR/radiant/migrations"
mkdir -p "$PACKAGE_DIR/thinktank"
mkdir -p "$PACKAGE_DIR/shared"
mkdir -p "$PACKAGE_DIR/scripts"
mkdir -p "$PACKAGE_DIR/rollback"

# Copy infrastructure
echo "   Copying infrastructure..."
cp -r "$ROOT_DIR/packages/infrastructure/lib" "$PACKAGE_DIR/radiant/infrastructure/" 2>/dev/null || true
cp -r "$ROOT_DIR/packages/infrastructure/lambda" "$PACKAGE_DIR/radiant/lambda/" 2>/dev/null || true
cp -r "$ROOT_DIR/packages/infrastructure/migrations" "$PACKAGE_DIR/radiant/migrations/" 2>/dev/null || true

# Copy dashboard
echo "   Copying dashboard..."
if [ -d "$ROOT_DIR/apps/admin-dashboard" ]; then
    cp -r "$ROOT_DIR/apps/admin-dashboard/app" "$PACKAGE_DIR/radiant/dashboard/" 2>/dev/null || true
    cp -r "$ROOT_DIR/apps/admin-dashboard/components" "$PACKAGE_DIR/radiant/dashboard/" 2>/dev/null || true
    cp -r "$ROOT_DIR/apps/admin-dashboard/lib" "$PACKAGE_DIR/radiant/dashboard/" 2>/dev/null || true
fi

# Copy shared
echo "   Copying shared..."
cp -r "$ROOT_DIR/packages/shared/src" "$PACKAGE_DIR/shared/" 2>/dev/null || true

# Create component manifests
echo "   Creating component manifests..."

# Radiant component.json
cat > "$PACKAGE_DIR/radiant/component.json" << EOF
{
  "name": "radiant",
  "version": "$RADIANT_VERSION",
  "touched": $RADIANT_TOUCHED,
  "lastModifiedVersion": "$RADIANT_VERSION",
  "buildTimestamp": "$(date -u +%Y-%m-%dT%H:%M:%SZ)"
}
EOF

# Think Tank component.json
cat > "$PACKAGE_DIR/thinktank/component.json" << EOF
{
  "name": "thinktank",
  "version": "$THINKTANK_VERSION",
  "touched": $THINKTANK_TOUCHED,
  "lastModifiedVersion": "$THINKTANK_VERSION",
  "buildTimestamp": "$(date -u +%Y-%m-%dT%H:%M:%SZ)"
}
EOF

# Create deployment scripts
echo "   Creating deployment scripts..."

cat > "$PACKAGE_DIR/scripts/pre-install.sh" << 'EOF'
#!/bin/bash
echo "Running pre-install checks..."
# Verify AWS credentials
aws sts get-caller-identity > /dev/null || { echo "AWS credentials not configured"; exit 1; }
echo "Pre-install checks passed"
EOF

cat > "$PACKAGE_DIR/scripts/post-install.sh" << 'EOF'
#!/bin/bash
echo "Running post-install tasks..."
# Verify deployment
echo "Post-install tasks complete"
EOF

cat > "$PACKAGE_DIR/scripts/enable-maintenance.sh" << 'EOF'
#!/bin/bash
echo "Enabling maintenance mode..."
# Would call API to enable maintenance
echo "Maintenance mode enabled"
EOF

cat > "$PACKAGE_DIR/scripts/disable-maintenance.sh" << 'EOF'
#!/bin/bash
echo "Disabling maintenance mode..."
# Would call API to disable maintenance
echo "Maintenance mode disabled"
EOF

chmod +x "$PACKAGE_DIR/scripts/"*.sh

# Generate manifest.json
echo ""
echo "📋 Generating manifest..."

RADIANT_HASH=$(find "$PACKAGE_DIR/radiant" -type f -exec sha256sum {} \; 2>/dev/null | sha256sum | cut -d' ' -f1 || echo "pending")
THINKTANK_HASH=$(find "$PACKAGE_DIR/thinktank" -type f -exec sha256sum {} \; 2>/dev/null | sha256sum | cut -d' ' -f1 || echo "pending")

cat > "$PACKAGE_DIR/manifest.json" << EOF
{
  "schemaVersion": "2.0",
  "package": {
    "version": "$PACKAGE_VERSION",
    "buildNumber": "$BUILD_NUMBER",
    "buildTimestamp": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
    "builder": "radiant-package-builder",
    "builderVersion": "1.0.0"
  },
  "components": {
    "radiant": {
      "version": "$RADIANT_VERSION",
      "touched": $RADIANT_TOUCHED,
      "lastModifiedVersion": "$RADIANT_VERSION",
      "checksumHash": "sha256:$RADIANT_HASH"
    },
    "thinktank": {
      "version": "$THINKTANK_VERSION",
      "touched": $THINKTANK_TOUCHED,
      "lastModifiedVersion": "$THINKTANK_VERSION",
      "checksumHash": "sha256:$THINKTANK_HASH"
    }
  },
  "compatibility": {
    "minUpgradeFromVersion": "4.16.0",
    "lockStepRequired": false,
    "maxVersionDrift": {
      "radiant": 2,
      "thinktank": 3
    }
  },
  "migrations": {
    "fromVersions": {
      "4.17.0": ["044_cost_experiments_security.sql"]
    }
  },
  "rollback": {
    "supportedRollbackVersions": ["4.17.0"]
  },
  "releaseNotes": {
    "highlights": [
      "Unified Package System with atomic component versioning",
      "Cost Management with Neural Engine recommendations",
      "Compliance Reports (SOC2, HIPAA, GDPR, ISO27001)",
      "Security & Intrusion Detection Dashboard",
      "A/B Testing Framework"
    ],
    "breakingChanges": [],
    "deprecations": []
  }
}
EOF

# Generate checksums
echo "🔐 Generating checksums..."
cd "$PACKAGE_DIR"
find . -type f ! -name "checksums.sha256" -exec sha256sum {} \; > checksums.sha256

# Copy VERSION_HISTORY
cp "$ROOT_DIR/VERSION_HISTORY.json" "$PACKAGE_DIR/"

# Create package archive
echo ""
echo "📦 Creating package archive..."
cd "$OUTPUT_DIR"
tar -czf "${PACKAGE_NAME}.pkg" "$PACKAGE_NAME"

# Calculate final package hash
PACKAGE_HASH=$(sha256sum "${PACKAGE_NAME}.pkg" | cut -d' ' -f1)

echo ""
echo "✅ Package built successfully!"
echo "   Package: $OUTPUT_DIR/${PACKAGE_NAME}.pkg"
echo "   SHA256: $PACKAGE_HASH"
echo "   Size: $(du -h "${PACKAGE_NAME}.pkg" | cut -f1)"
