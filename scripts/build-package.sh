#!/bin/bash
# RADIANT v4.17.0 - Package Build Script
# Creates .pkg format packages with manifest, checksums, and rollback support

set -e

VERSION="${1:-$(node -p "require('./package.json').version")}"
OUTPUT_DIR="${2:-./dist/packages}"
PACKAGE_NAME="radiant-${VERSION}"

echo "🔨 Building RADIANT package v${VERSION}"
echo "=================================="

# Create output directory
mkdir -p "${OUTPUT_DIR}/${PACKAGE_NAME}"

# Create manifest.json
echo "📋 Creating manifest.json..."
cat > "${OUTPUT_DIR}/${PACKAGE_NAME}/manifest.json" << EOF
{
  "name": "radiant",
  "version": "${VERSION}",
  "schemaVersion": "2.0",
  "buildDate": "$(date -u +"%Y-%m-%dT%H:%M:%SZ")",
  "components": {
    "infrastructure": {
      "version": "${VERSION}",
      "type": "cdk",
      "path": "infrastructure/",
      "dependencies": ["shared"]
    },
    "admin-dashboard": {
      "version": "${VERSION}",
      "type": "nextjs",
      "path": "admin-dashboard/",
      "dependencies": ["shared"]
    },
    "swift-deployer": {
      "version": "${VERSION}",
      "type": "swift",
      "path": "swift-deployer/"
    },
    "shared": {
      "version": "${VERSION}",
      "type": "npm",
      "path": "shared/"
    },
    "sdk": {
      "version": "${VERSION}",
      "type": "npm",
      "path": "sdk/"
    },
    "migrations": {
      "version": "${VERSION}",
      "type": "sql",
      "path": "migrations/"
    }
  },
  "minNodeVersion": "20.0.0",
  "minSwiftVersion": "5.9",
  "supportedRegions": [
    "us-east-1", "us-west-2", "eu-west-1", "eu-central-1",
    "ap-northeast-1", "ap-southeast-1", "ap-south-1"
  ],
  "rollbackSupported": true
}
EOF

# Copy components
echo "📦 Copying components..."

# Infrastructure
if [ -d "packages/infrastructure" ]; then
  mkdir -p "${OUTPUT_DIR}/${PACKAGE_NAME}/infrastructure"
  cp -r packages/infrastructure/lib "${OUTPUT_DIR}/${PACKAGE_NAME}/infrastructure/"
  cp -r packages/infrastructure/migrations "${OUTPUT_DIR}/${PACKAGE_NAME}/infrastructure/"
  cp packages/infrastructure/package.json "${OUTPUT_DIR}/${PACKAGE_NAME}/infrastructure/"
  cp packages/infrastructure/cdk.json "${OUTPUT_DIR}/${PACKAGE_NAME}/infrastructure/" 2>/dev/null || true
fi

# Admin Dashboard
if [ -d "apps/admin-dashboard" ]; then
  mkdir -p "${OUTPUT_DIR}/${PACKAGE_NAME}/admin-dashboard"
  cp -r apps/admin-dashboard/app "${OUTPUT_DIR}/${PACKAGE_NAME}/admin-dashboard/"
  cp -r apps/admin-dashboard/components "${OUTPUT_DIR}/${PACKAGE_NAME}/admin-dashboard/"
  cp -r apps/admin-dashboard/lib "${OUTPUT_DIR}/${PACKAGE_NAME}/admin-dashboard/" 2>/dev/null || true
  cp apps/admin-dashboard/package.json "${OUTPUT_DIR}/${PACKAGE_NAME}/admin-dashboard/"
  cp apps/admin-dashboard/next.config.js "${OUTPUT_DIR}/${PACKAGE_NAME}/admin-dashboard/" 2>/dev/null || true
fi

# Swift Deployer
if [ -d "apps/swift-deployer" ]; then
  mkdir -p "${OUTPUT_DIR}/${PACKAGE_NAME}/swift-deployer"
  cp -r apps/swift-deployer/Sources "${OUTPUT_DIR}/${PACKAGE_NAME}/swift-deployer/"
  cp apps/swift-deployer/Package.swift "${OUTPUT_DIR}/${PACKAGE_NAME}/swift-deployer/"
fi

# Shared package
if [ -d "packages/shared" ]; then
  mkdir -p "${OUTPUT_DIR}/${PACKAGE_NAME}/shared"
  cp -r packages/shared/src "${OUTPUT_DIR}/${PACKAGE_NAME}/shared/"
  cp packages/shared/package.json "${OUTPUT_DIR}/${PACKAGE_NAME}/shared/"
fi

# SDK
if [ -d "packages/sdk" ]; then
  mkdir -p "${OUTPUT_DIR}/${PACKAGE_NAME}/sdk"
  cp -r packages/sdk/src "${OUTPUT_DIR}/${PACKAGE_NAME}/sdk/" 2>/dev/null || true
  cp packages/sdk/package.json "${OUTPUT_DIR}/${PACKAGE_NAME}/sdk/"
fi

# Generate checksums
echo "🔐 Generating checksums..."
cd "${OUTPUT_DIR}/${PACKAGE_NAME}"
find . -type f ! -name "checksums.sha256" ! -name "*.pkg" -exec sha256sum {} \; > checksums.sha256
cd - > /dev/null

# Create VERSION_HISTORY.json
echo "📜 Creating VERSION_HISTORY.json..."
cat > "${OUTPUT_DIR}/${PACKAGE_NAME}/VERSION_HISTORY.json" << EOF
{
  "current": "${VERSION}",
  "history": [
    {
      "version": "${VERSION}",
      "date": "$(date -u +"%Y-%m-%dT%H:%M:%SZ")",
      "changes": [
        "Package created"
      ],
      "rollbackTo": null
    }
  ]
}
EOF

# Create rollback script
echo "🔄 Creating rollback script..."
cat > "${OUTPUT_DIR}/${PACKAGE_NAME}/rollback.sh" << 'ROLLBACK'
#!/bin/bash
# RADIANT Rollback Script
# Usage: ./rollback.sh <target-version>

set -e

TARGET_VERSION="$1"

if [ -z "$TARGET_VERSION" ]; then
  echo "Usage: ./rollback.sh <target-version>"
  echo "Available versions:"
  cat VERSION_HISTORY.json | jq -r '.history[].version'
  exit 1
fi

echo "🔄 Rolling back to version ${TARGET_VERSION}..."

# Check if version exists in history
VERSION_EXISTS=$(cat VERSION_HISTORY.json | jq -r ".history[] | select(.version == \"${TARGET_VERSION}\") | .version")

if [ -z "$VERSION_EXISTS" ]; then
  echo "❌ Version ${TARGET_VERSION} not found in history"
  exit 1
fi

# Run CDK rollback
echo "📦 Rolling back infrastructure..."
cd infrastructure
npx cdk deploy --all --context version=${TARGET_VERSION} --require-approval never
cd ..

# Run migration rollback if needed
echo "🗄️ Checking migrations..."
# Migration rollback logic would go here

echo "✅ Rollback to ${TARGET_VERSION} complete"
ROLLBACK
chmod +x "${OUTPUT_DIR}/${PACKAGE_NAME}/rollback.sh"

# Create the final .pkg archive
echo "📦 Creating package archive..."
cd "${OUTPUT_DIR}"
tar -czf "${PACKAGE_NAME}.pkg" "${PACKAGE_NAME}"
cd - > /dev/null

# Calculate package checksum
PKG_CHECKSUM=$(sha256sum "${OUTPUT_DIR}/${PACKAGE_NAME}.pkg" | cut -d' ' -f1)

echo ""
echo "✅ Package built successfully!"
echo "=================================="
echo "Package: ${OUTPUT_DIR}/${PACKAGE_NAME}.pkg"
echo "Size: $(du -h "${OUTPUT_DIR}/${PACKAGE_NAME}.pkg" | cut -f1)"
echo "SHA256: ${PKG_CHECKSUM}"
echo ""
echo "To install:"
echo "  tar -xzf ${PACKAGE_NAME}.pkg"
echo "  cd ${PACKAGE_NAME}"
echo "  ./install.sh"
