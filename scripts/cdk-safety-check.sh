#!/bin/bash
# ═══════════════════════════════════════════════════════════════════════════
# RADIANT CDK SAFETY CHECK
# ═══════════════════════════════════════════════════════════════════════════
#
# This script MUST be run before any cdk command to enforce environment safety.
# It blocks cdk watch on staging/prod environments.
#
# Usage: source ./scripts/cdk-safety-check.sh [command] [environment]
# Example: source ./scripts/cdk-safety-check.sh watch dev
#
# ═══════════════════════════════════════════════════════════════════════════

set -e

CDK_COMMAND="${1:-}"
TARGET_ENV="${2:-$RADIANT_ENV}"

# Detect environment from AWS_PROFILE if not explicitly set
if [[ -z "$TARGET_ENV" ]]; then
    if [[ "$AWS_PROFILE" == *"staging"* ]]; then
        TARGET_ENV="staging"
    elif [[ "$AWS_PROFILE" == *"prod"* ]]; then
        TARGET_ENV="prod"
    elif [[ "$AWS_PROFILE" == *"dev"* ]]; then
        TARGET_ENV="dev"
    else
        echo "⚠️  WARNING: Could not detect environment. Assuming dev."
        TARGET_ENV="dev"
    fi
fi

# ═══════════════════════════════════════════════════════════════════════════
# HARD RULE: Block cdk watch on non-dev environments
# ═══════════════════════════════════════════════════════════════════════════

if [[ "$CDK_COMMAND" == "watch" ]]; then
    if [[ "$TARGET_ENV" != "dev" ]]; then
        echo ""
        echo "╔═══════════════════════════════════════════════════════════════════════════╗"
        echo "║ 🛑 BLOCKED: cdk watch is FORBIDDEN for $TARGET_ENV environment            ║"
        echo "╠═══════════════════════════════════════════════════════════════════════════╣"
        echo "║                                                                           ║"
        echo "║  cdk watch --hotswap bypasses CloudFormation safety checks and can:       ║"
        echo "║    • Leave infrastructure in inconsistent states                          ║"
        echo "║    • Skip rollback capabilities                                           ║"
        echo "║    • Cause production outages                                             ║"
        echo "║                                                                           ║"
        echo "║  FOR STAGING/PROD, use one of these SAFE methods:                         ║"
        echo "║                                                                           ║"
        echo "║    1. Swift Deployer (recommended)                                        ║"
        echo "║       Open the Swift Deployer app and use the deployment wizard           ║"
        echo "║                                                                           ║"
        echo "║    2. Manual CLI with approval gates:                                     ║"
        echo "║       AWS_PROFILE=radiant-$TARGET_ENV npx cdk deploy --all \\              ║"
        echo "║         --require-approval broadening                                     ║"
        echo "║                                                                           ║"
        echo "╚═══════════════════════════════════════════════════════════════════════════╝"
        echo ""
        exit 1
    fi
fi

# ═══════════════════════════════════════════════════════════════════════════
# Require approval for staging/prod deployments
# ═══════════════════════════════════════════════════════════════════════════

if [[ "$CDK_COMMAND" == "deploy" ]]; then
    if [[ "$TARGET_ENV" == "staging" || "$TARGET_ENV" == "prod" ]]; then
        echo ""
        echo "╔═══════════════════════════════════════════════════════════════════════════╗"
        echo "║ ⚠️  DEPLOYING TO $TARGET_ENV — APPROVAL REQUIRED                          ║"
        echo "╠═══════════════════════════════════════════════════════════════════════════╣"
        echo "║                                                                           ║"
        echo "║  You are about to deploy to a protected environment.                      ║"
        echo "║  Please confirm this action.                                              ║"
        echo "║                                                                           ║"
        echo "╚═══════════════════════════════════════════════════════════════════════════╝"
        echo ""
        read -p "Type '$TARGET_ENV' to confirm deployment: " CONFIRM
        if [[ "$CONFIRM" != "$TARGET_ENV" ]]; then
            echo "❌ Deployment cancelled."
            exit 1
        fi
        echo "✅ Confirmed. Proceeding with deployment..."
    fi
fi

# Export for use by CDK
export RADIANT_ENV="$TARGET_ENV"
export CDK_SAFETY_CHECKED="true"

echo "✅ Safety check passed for '$CDK_COMMAND' on '$TARGET_ENV' environment"
