#!/bin/bash
# ============================================================================
# RADIANT Mission Control - Flyte Workflow Registration Script
# Version: 4.19.2
# ============================================================================

set -e

ENVIRONMENT=${1:-dev}
FLYTE_PROJECT=${2:-radiant}
FLYTE_DOMAIN=${3:-development}
VERSION=${4:-v4.19.2}

echo "======================================================"
echo "Registering Flyte Workflows for Mission Control"
echo "Environment: $ENVIRONMENT"
echo "Project: $FLYTE_PROJECT"
echo "Domain: $FLYTE_DOMAIN"
echo "Version: $VERSION"
echo "======================================================"

# Set Flyte domain based on environment
if [ "$ENVIRONMENT" = "prod" ]; then
    FLYTE_DOMAIN="production"
elif [ "$ENVIRONMENT" = "staging" ]; then
    FLYTE_DOMAIN="staging"
else
    FLYTE_DOMAIN="development"
fi

# Check for flytectl
if ! command -v flytectl &> /dev/null; then
    echo "Error: flytectl is not installed"
    echo "Install with: brew install flyteorg/homebrew-tap/flytectl"
    exit 1
fi

# Navigate to flyte directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR/.."

echo ""
echo "Step 1: Building workflow package..."
echo "------------------------------------------------------"

# Create dist directory
mkdir -p dist

# Package workflows
pyflyte --pkgs workflows package \
    --image ghcr.io/radiant/flyte-worker:${VERSION} \
    --output dist/flyte-workflows-${VERSION}.tar.gz

echo "Package created: dist/flyte-workflows-${VERSION}.tar.gz"

echo ""
echo "Step 2: Registering workflows with Flyte Admin..."
echo "------------------------------------------------------"

flytectl register files \
    --project $FLYTE_PROJECT \
    --domain $FLYTE_DOMAIN \
    --archive dist/flyte-workflows-${VERSION}.tar.gz \
    --version $VERSION

echo ""
echo "Step 3: Verifying registration..."
echo "------------------------------------------------------"

# List registered workflows
echo "Registered workflows:"
flytectl get workflow \
    --project $FLYTE_PROJECT \
    --domain $FLYTE_DOMAIN \
    --version $VERSION

echo ""
echo "Step 4: Creating launch plans..."
echo "------------------------------------------------------"

# Create launch plans for each workflow
flytectl create launchplan \
    --project $FLYTE_PROJECT \
    --domain $FLYTE_DOMAIN \
    --name think_tank_hitl_workflow \
    --version $VERSION \
    --activate

flytectl create launchplan \
    --project $FLYTE_PROJECT \
    --domain $FLYTE_DOMAIN \
    --name think_tank_workflow \
    --version $VERSION \
    --activate

echo ""
echo "======================================================"
echo "Registration Complete!"
echo ""
echo "Workflows registered:"
echo "  - think_tank_hitl_workflow (with HITL)"
echo "  - think_tank_workflow (without HITL)"
echo ""
echo "Launch plans activated for version: $VERSION"
echo "======================================================"
