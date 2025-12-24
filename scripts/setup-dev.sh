#!/bin/bash
# RADIANT Development Setup Script
# Run this script to set up your local development environment

set -e

echo "🚀 RADIANT Development Setup"
echo "============================"

# Check prerequisites
echo ""
echo "📋 Checking prerequisites..."

# Check Node.js
if ! command -v node &> /dev/null; then
    echo "❌ Node.js is not installed. Please install Node.js 20.0+"
    exit 1
fi
NODE_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$NODE_VERSION" -lt 20 ]; then
    echo "❌ Node.js version must be 20.0+. Current: $(node -v)"
    exit 1
fi
echo "✅ Node.js $(node -v)"

# Check pnpm
if ! command -v pnpm &> /dev/null; then
    echo "📦 Installing pnpm..."
    npm install -g pnpm
fi
echo "✅ pnpm $(pnpm -v)"

# Check AWS CLI
if ! command -v aws &> /dev/null; then
    echo "⚠️  AWS CLI is not installed. You'll need it for deployment."
else
    echo "✅ AWS CLI $(aws --version | cut -d' ' -f1 | cut -d'/' -f2)"
fi

# Install dependencies
echo ""
echo "📦 Installing dependencies..."
pnpm install

# Build shared package
echo ""
echo "🔨 Building shared package..."
pnpm --filter @radiant/shared build

# Build infrastructure
echo ""
echo "🔨 Building infrastructure..."
pnpm --filter @radiant/infrastructure build

# Setup environment files
echo ""
echo "📝 Setting up environment files..."

if [ ! -f .env ]; then
    cp .env.example .env
    echo "✅ Created .env from template"
else
    echo "ℹ️  .env already exists, skipping"
fi

if [ ! -f apps/admin-dashboard/.env.local ]; then
    cp apps/admin-dashboard/.env.example apps/admin-dashboard/.env.local
    echo "✅ Created apps/admin-dashboard/.env.local from template"
else
    echo "ℹ️  apps/admin-dashboard/.env.local already exists, skipping"
fi

if [ ! -f packages/infrastructure/.env ]; then
    cp packages/infrastructure/.env.example packages/infrastructure/.env
    echo "✅ Created packages/infrastructure/.env from template"
else
    echo "ℹ️  packages/infrastructure/.env already exists, skipping"
fi

# Summary
echo ""
echo "✨ Setup Complete!"
echo ""
echo "Next steps:"
echo "  1. Update .env files with your configuration"
echo "  2. Run 'pnpm dev' to start development servers"
echo "  3. Run 'pnpm build' to build all packages"
echo ""
echo "Available commands:"
echo "  pnpm dev              - Start all development servers"
echo "  pnpm build            - Build all packages"
echo "  pnpm test             - Run all tests"
echo "  pnpm lint             - Lint all packages"
echo "  pnpm deploy:dev       - Deploy to AWS (dev environment)"
echo ""
