#!/bin/bash
# ============================================================================
# RADIANT Mission Control - Deployment Script
# Version: 4.19.2
# 
# This script deploys the complete Mission Control HITL system including:
# - Database migrations
# - CDK infrastructure stack
# - Flyte workflows
# - Redis Bridge Service
# ============================================================================

set -e

ENVIRONMENT=${1:-dev}
AWS_REGION=${AWS_REGION:-us-east-1}
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$SCRIPT_DIR/../.."

echo "============================================================"
echo "RADIANT Mission Control Deployment"
echo "Environment: $ENVIRONMENT"
echo "Region: $AWS_REGION"
echo "============================================================"

# Validate environment
if [[ ! "$ENVIRONMENT" =~ ^(dev|staging|prod)$ ]]; then
    echo "Error: Invalid environment. Must be dev, staging, or prod"
    exit 1
fi

# ============================================================================
# STEP 1: Run Database Migrations
# ============================================================================
echo ""
echo "Step 1: Running database migrations..."
echo "------------------------------------------------------------"

cd "$PROJECT_ROOT/packages/infrastructure"

# Apply the Mission Control schema migration
psql "$DATABASE_URL" -f migrations/V2026_01_07_001__mission_control_schema.sql

echo "Database migrations complete."

# ============================================================================
# STEP 2: Build Lambda Functions
# ============================================================================
echo ""
echo "Step 2: Building Lambda functions..."
echo "------------------------------------------------------------"

# Build TypeScript
npm run build

# Create dist directories
mkdir -p dist/lambda/mission-control
mkdir -p dist/lambda/websocket
mkdir -p dist/lambda/timeout-cleanup

# Bundle Lambda functions
npx esbuild lambda/functions/mission-control/index.ts \
    --bundle --platform=node --target=node20 \
    --external:aws-sdk --external:pg-native \
    --outdir=dist/lambda/mission-control

npx esbuild lambda/functions/websocket/connection-handler.ts \
    --bundle --platform=node --target=node20 \
    --external:aws-sdk --external:pg-native \
    --outdir=dist/lambda/websocket

npx esbuild lambda/functions/timeout-cleanup/index.ts \
    --bundle --platform=node --target=node20 \
    --external:aws-sdk --external:pg-native \
    --outdir=dist/lambda/timeout-cleanup

echo "Lambda functions built."

# ============================================================================
# STEP 3: Build Redis Bridge Service
# ============================================================================
echo ""
echo "Step 3: Building Redis Bridge Service..."
echo "------------------------------------------------------------"

cd "$PROJECT_ROOT/packages/services/redis-bridge"

# Create package.json if not exists
cat > package.json << 'EOF'
{
  "name": "@radiant/redis-bridge",
  "version": "4.19.2",
  "private": true,
  "main": "dist/index.js",
  "scripts": {
    "build": "tsc",
    "start": "node dist/index.js"
  },
  "dependencies": {
    "express": "^4.18.2",
    "ioredis": "^5.3.2",
    "@aws-sdk/client-apigatewaymanagementapi": "^3.400.0"
  },
  "devDependencies": {
    "@types/express": "^4.17.21",
    "@types/node": "^20.9.0",
    "typescript": "^5.2.2"
  }
}
EOF

# Create tsconfig.json if not exists
cat > tsconfig.json << 'EOF'
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "commonjs",
    "lib": ["ES2022"],
    "outDir": "./dist",
    "rootDir": "./src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "declaration": true,
    "declarationMap": true
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist"]
}
EOF

# Create Dockerfile
cat > Dockerfile << 'EOF'
FROM node:20-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci --only=production

COPY dist/ ./dist/

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3000/health || exit 1

CMD ["node", "dist/index.js"]
EOF

npm install
npm run build

echo "Redis Bridge Service built."

# ============================================================================
# STEP 4: Deploy CDK Stack
# ============================================================================
echo ""
echo "Step 4: Deploying CDK infrastructure..."
echo "------------------------------------------------------------"

cd "$PROJECT_ROOT/packages/infrastructure"

# Set environment-specific variables
if [ "$ENVIRONMENT" = "prod" ]; then
    CDK_CONTEXT="--context environment=prod"
elif [ "$ENVIRONMENT" = "staging" ]; then
    CDK_CONTEXT="--context environment=staging"
else
    CDK_CONTEXT="--context environment=dev"
fi

# Bootstrap CDK if needed
npx cdk bootstrap $CDK_CONTEXT || true

# Deploy the Mission Control stack
npx cdk deploy RadiantMissionControlStack \
    $CDK_CONTEXT \
    --require-approval never \
    --outputs-file cdk-outputs.json

echo "CDK deployment complete."

# ============================================================================
# STEP 5: Register Flyte Workflows
# ============================================================================
echo ""
echo "Step 5: Registering Flyte workflows..."
echo "------------------------------------------------------------"

cd "$PROJECT_ROOT/packages/flyte"

chmod +x scripts/register-workflows.sh
./scripts/register-workflows.sh $ENVIRONMENT radiant

echo "Flyte workflows registered."

# ============================================================================
# STEP 6: Deploy Redis Bridge to ECS
# ============================================================================
echo ""
echo "Step 6: Deploying Redis Bridge to ECS..."
echo "------------------------------------------------------------"

cd "$PROJECT_ROOT/packages/services/redis-bridge"

# Build and push Docker image
AWS_ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
ECR_REPO="$AWS_ACCOUNT_ID.dkr.ecr.$AWS_REGION.amazonaws.com/radiant-redis-bridge"

# Login to ECR
aws ecr get-login-password --region $AWS_REGION | docker login --username AWS --password-stdin $ECR_REPO

# Build and push
docker build -t radiant-redis-bridge:latest .
docker tag radiant-redis-bridge:latest $ECR_REPO:latest
docker tag radiant-redis-bridge:latest $ECR_REPO:$ENVIRONMENT
docker push $ECR_REPO:latest
docker push $ECR_REPO:$ENVIRONMENT

# Update ECS service
aws ecs update-service \
    --cluster radiant-$ENVIRONMENT \
    --service radiant-redis-bridge \
    --force-new-deployment \
    --region $AWS_REGION

echo "Redis Bridge deployed to ECS."

# ============================================================================
# STEP 7: Verify Deployment
# ============================================================================
echo ""
echo "Step 7: Verifying deployment..."
echo "------------------------------------------------------------"

# Get outputs from CDK
REST_API_URL=$(cat "$PROJECT_ROOT/packages/infrastructure/cdk-outputs.json" | jq -r '.RadiantMissionControlStack.RestApiUrl')
WS_URL=$(cat "$PROJECT_ROOT/packages/infrastructure/cdk-outputs.json" | jq -r '.RadiantMissionControlStack.WebSocketUrl')

echo "REST API URL: $REST_API_URL"
echo "WebSocket URL: $WS_URL"

# Test health endpoint
echo ""
echo "Testing health endpoint..."
curl -s "${REST_API_URL}health" | jq .

echo ""
echo "============================================================"
echo "Deployment Complete!"
echo ""
echo "Endpoints:"
echo "  REST API: $REST_API_URL"
echo "  WebSocket: $WS_URL"
echo ""
echo "Next steps:"
echo "  1. Update admin dashboard with new API endpoints"
echo "  2. Configure PagerDuty and Slack webhooks"
echo "  3. Test HITL flow end-to-end"
echo "============================================================"
