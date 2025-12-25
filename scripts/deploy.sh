#!/bin/bash
# RADIANT Deployment Script v4.17.0
# Deploys all CDK stacks in the correct order

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Default values
ENVIRONMENT="dev"
TIER="1"
REQUIRE_APPROVAL="never"
DRY_RUN=false

# Parse arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        -e|--environment)
            ENVIRONMENT="$2"
            shift 2
            ;;
        -t|--tier)
            TIER="$2"
            shift 2
            ;;
        --dry-run)
            DRY_RUN=true
            shift
            ;;
        --require-approval)
            REQUIRE_APPROVAL="$2"
            shift 2
            ;;
        -h|--help)
            echo "RADIANT Deployment Script"
            echo ""
            echo "Usage: ./deploy.sh [options]"
            echo ""
            echo "Options:"
            echo "  -e, --environment    Environment (dev, staging, prod) [default: dev]"
            echo "  -t, --tier           Tier level (1-5) [default: 1]"
            echo "  --dry-run            Show what would be deployed without deploying"
            echo "  --require-approval   CDK approval mode (never, broadening, any-change)"
            echo "  -h, --help           Show this help message"
            exit 0
            ;;
        *)
            echo "Unknown option: $1"
            exit 1
            ;;
    esac
done

echo -e "${BLUE}═══════════════════════════════════════════════════════════════${NC}"
echo -e "${BLUE}  RADIANT v4.17.0 - Deployment Script${NC}"
echo -e "${BLUE}═══════════════════════════════════════════════════════════════${NC}"
echo ""
echo -e "Environment: ${GREEN}$ENVIRONMENT${NC}"
echo -e "Tier:        ${GREEN}$TIER${NC}"
echo -e "Dry Run:     ${GREEN}$DRY_RUN${NC}"
echo ""

# Validate environment
if [[ ! "$ENVIRONMENT" =~ ^(dev|staging|prod)$ ]]; then
    echo -e "${RED}Error: Invalid environment. Must be dev, staging, or prod${NC}"
    exit 1
fi

# Validate tier
if [[ ! "$TIER" =~ ^[1-5]$ ]]; then
    echo -e "${RED}Error: Invalid tier. Must be 1-5${NC}"
    exit 1
fi

# Production safety check
if [[ "$ENVIRONMENT" == "prod" && "$REQUIRE_APPROVAL" == "never" ]]; then
    echo -e "${YELLOW}Warning: Production deployment with --require-approval never${NC}"
    echo -e "${YELLOW}Setting approval to 'broadening' for safety${NC}"
    REQUIRE_APPROVAL="broadening"
fi

# Navigate to infrastructure directory
cd "$(dirname "$0")/../packages/infrastructure"

# CDK context arguments
CDK_CONTEXT="--context environment=$ENVIRONMENT --context tier=$TIER"

# Build shared package first
echo -e "${BLUE}📦 Building shared package...${NC}"
cd ../shared
npm run build
cd ../infrastructure

# Deployment phases
PHASE_1_STACKS=(
    "Radiant-$ENVIRONMENT-Foundation"
    "Radiant-$ENVIRONMENT-Networking"
)

PHASE_2_STACKS=(
    "Radiant-$ENVIRONMENT-Security"
    "Radiant-$ENVIRONMENT-Data"
    "Radiant-$ENVIRONMENT-Storage"
)

PHASE_3_STACKS=(
    "Radiant-$ENVIRONMENT-Auth"
    "Radiant-$ENVIRONMENT-AI"
)

PHASE_4_STACKS=(
    "Radiant-$ENVIRONMENT-API"
    "Radiant-$ENVIRONMENT-Admin"
)

deploy_phase() {
    local phase_name=$1
    shift
    local stacks=("$@")
    
    echo ""
    echo -e "${BLUE}═══════════════════════════════════════════════════════════════${NC}"
    echo -e "${BLUE}  Phase: $phase_name${NC}"
    echo -e "${BLUE}═══════════════════════════════════════════════════════════════${NC}"
    
    for stack in "${stacks[@]}"; do
        echo ""
        echo -e "${YELLOW}Deploying: $stack${NC}"
        
        if [ "$DRY_RUN" = true ]; then
            echo -e "${GREEN}[DRY RUN] Would deploy: $stack${NC}"
            npx cdk diff $stack $CDK_CONTEXT || true
        else
            npx cdk deploy $stack $CDK_CONTEXT --require-approval $REQUIRE_APPROVAL
            if [ $? -eq 0 ]; then
                echo -e "${GREEN}✅ $stack deployed successfully${NC}"
            else
                echo -e "${RED}❌ $stack deployment failed${NC}"
                exit 1
            fi
        fi
    done
}

# Check if CDK is bootstrapped
echo -e "${BLUE}🔍 Checking CDK bootstrap status...${NC}"
ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
REGION=$(aws configure get region || echo "us-east-1")

if [ -z "$ACCOUNT_ID" ]; then
    echo -e "${RED}Error: Could not get AWS account ID. Is AWS CLI configured?${NC}"
    exit 1
fi

echo -e "AWS Account: ${GREEN}$ACCOUNT_ID${NC}"
echo -e "AWS Region:  ${GREEN}$REGION${NC}"

# Deploy in phases
START_TIME=$(date +%s)

deploy_phase "1: Foundation & Networking" "${PHASE_1_STACKS[@]}"
deploy_phase "2: Security & Data" "${PHASE_2_STACKS[@]}"
deploy_phase "3: Auth & AI" "${PHASE_3_STACKS[@]}"
deploy_phase "4: API & Admin" "${PHASE_4_STACKS[@]}"

END_TIME=$(date +%s)
DURATION=$((END_TIME - START_TIME))
MINUTES=$((DURATION / 60))
SECONDS=$((DURATION % 60))

echo ""
echo -e "${BLUE}═══════════════════════════════════════════════════════════════${NC}"
echo -e "${GREEN}  Deployment Complete!${NC}"
echo -e "${BLUE}═══════════════════════════════════════════════════════════════${NC}"
echo ""
echo -e "Duration: ${GREEN}${MINUTES}m ${SECONDS}s${NC}"
echo ""
echo -e "${YELLOW}Next Steps:${NC}"
echo "  1. Run database migrations: ./scripts/run-migrations.sh --environment $ENVIRONMENT"
echo "  2. Create first admin user (see docs/DEPLOYMENT-GUIDE.md)"
echo "  3. Configure AI providers in Admin Dashboard"
echo "  4. Run verification: ./scripts/verify-deployment.sh --environment $ENVIRONMENT"
echo ""
