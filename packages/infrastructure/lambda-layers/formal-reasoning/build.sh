#!/bin/bash
# Build script for Formal Reasoning Python Lambda Layer
# Run this script to create the layer package

set -e

LAYER_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BUILD_DIR="$LAYER_DIR/python"
PYTHON_VERSION="3.11"

echo "Building Formal Reasoning Lambda Layer..."

# Clean previous build
rm -rf "$BUILD_DIR"
mkdir -p "$BUILD_DIR/lib/python${PYTHON_VERSION}/site-packages"

# Install packages
echo "Installing Python packages..."
pip install \
    z3-solver==4.13.0.0 \
    rdflib==7.0.0 \
    owlrl==6.0.2 \
    pyshacl==0.25.0 \
    numpy>=1.24.0 \
    networkx>=3.0 \
    lxml>=4.9.0 \
    -t "$BUILD_DIR/lib/python${PYTHON_VERSION}/site-packages" \
    --platform manylinux2014_x86_64 \
    --only-binary=:all: \
    --python-version ${PYTHON_VERSION}

# PyReason may need special handling due to Numba
echo "Installing PyReason (may require Numba)..."
pip install pyreason==1.3.0 \
    -t "$BUILD_DIR/lib/python${PYTHON_VERSION}/site-packages" \
    --platform manylinux2014_x86_64 \
    --only-binary=:all: \
    --python-version ${PYTHON_VERSION} || echo "PyReason install failed - may need manual handling"

# Clean up unnecessary files to reduce layer size
echo "Cleaning up..."
find "$BUILD_DIR" -type d -name "__pycache__" -exec rm -rf {} + 2>/dev/null || true
find "$BUILD_DIR" -type d -name "tests" -exec rm -rf {} + 2>/dev/null || true
find "$BUILD_DIR" -type d -name "test" -exec rm -rf {} + 2>/dev/null || true
find "$BUILD_DIR" -type f -name "*.pyc" -delete 2>/dev/null || true
find "$BUILD_DIR" -type f -name "*.pyo" -delete 2>/dev/null || true

# Calculate size
LAYER_SIZE=$(du -sh "$BUILD_DIR" | cut -f1)
echo "Layer size: $LAYER_SIZE"

# Warn if too large (Lambda layer limit is 250MB unzipped)
LAYER_SIZE_MB=$(du -sm "$BUILD_DIR" | cut -f1)
if [ "$LAYER_SIZE_MB" -gt 200 ]; then
    echo "WARNING: Layer is large ($LAYER_SIZE_MB MB). Consider splitting or using container Lambda."
fi

echo "Build complete. Layer contents in: $BUILD_DIR"
echo "Deploy with CDK or zip and upload manually."
