#!/bin/bash
# ═══════════════════════════════════════════════════════════════════════════
# RADIANT CDK BOOTSTRAP
# Run ONCE after credentials are configured to prepare AWS for CDK
# ═══════════════════════════════════════════════════════════════════════════

set -e

echo ""
echo "╔═══════════════════════════════════════════════════════════════════════╗"
echo "║                     RADIANT CDK BOOTSTRAP                             ║"
echo "╚═══════════════════════════════════════════════════════════════════════╝"
echo ""

# Get account ID from active profile
ACCOUNT_ID=$(aws sts get-caller-identity --profile radiant-dev --query Account --output text)
PRIMARY_REGION="us-east-1"

echo "Account ID: $ACCOUNT_ID"
echo "Region:     $PRIMARY_REGION"
echo ""

# Bootstrap primary region
echo "Bootstrapping $PRIMARY_REGION..."
AWS_PROFILE=radiant-dev npx cdk bootstrap aws://$ACCOUNT_ID/$PRIMARY_REGION

echo ""
echo "╔═══════════════════════════════════════════════════════════════════════╗"
echo "║ ✅ CDK BOOTSTRAP COMPLETE                                             ║"
echo "╠═══════════════════════════════════════════════════════════════════════╣"
echo "║                                                                       ║"
echo "║  Your AWS account is ready for CDK deployments.                       ║"
echo "║                                                                       ║"
echo "║  START DIRECT DEV MODE:                                               ║"
echo "║    cd packages/infrastructure                                         ║"
echo "║    npx cdk watch --hotswap --profile radiant-dev                      ║"
echo "║                                                                       ║"
echo "║  FOR MULTI-REGION (run later if needed):                              ║"
echo "║    AWS_PROFILE=radiant-dev npx cdk bootstrap aws://$ACCOUNT_ID/eu-west-1       ║"
echo "║    AWS_PROFILE=radiant-dev npx cdk bootstrap aws://$ACCOUNT_ID/ap-northeast-1  ║"
echo "║                                                                       ║"
echo "╚═══════════════════════════════════════════════════════════════════════╝"
