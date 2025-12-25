#!/bin/bash
# RADIANT Deployment Verification Script v4.17.0
# Verifies all deployed resources are functioning correctly

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Default values
ENVIRONMENT="dev"
VERBOSE=false

# Parse arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        -e|--environment)
            ENVIRONMENT="$2"
            shift 2
            ;;
        -v|--verbose)
            VERBOSE=true
            shift
            ;;
        -h|--help)
            echo "RADIANT Deployment Verification Script"
            echo ""
            echo "Usage: ./verify-deployment.sh [options]"
            echo ""
            echo "Options:"
            echo "  -e, --environment    Environment to verify (dev, staging, prod)"
            echo "  -v, --verbose        Show detailed output"
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
echo -e "${BLUE}  RADIANT v4.17.0 - Deployment Verification${NC}"
echo -e "${BLUE}═══════════════════════════════════════════════════════════════${NC}"
echo ""
echo -e "Environment: ${GREEN}$ENVIRONMENT${NC}"
echo ""

PASS_COUNT=0
FAIL_COUNT=0
WARN_COUNT=0

check_pass() {
    echo -e "${GREEN}✅ $1${NC}"
    ((PASS_COUNT++))
}

check_fail() {
    echo -e "${RED}❌ $1${NC}"
    ((FAIL_COUNT++))
}

check_warn() {
    echo -e "${YELLOW}⚠️  $1${NC}"
    ((WARN_COUNT++))
}

# ─────────────────────────────────────────────────────────────────
# AWS Account Verification
# ─────────────────────────────────────────────────────────────────
echo -e "${BLUE}▸ AWS Account${NC}"

if aws sts get-caller-identity &>/dev/null; then
    ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
    check_pass "AWS CLI configured (Account: $ACCOUNT_ID)"
else
    check_fail "AWS CLI not configured"
    exit 1
fi

# ─────────────────────────────────────────────────────────────────
# CloudFormation Stacks
# ─────────────────────────────────────────────────────────────────
echo ""
echo -e "${BLUE}▸ CloudFormation Stacks${NC}"

STACKS=(
    "Radiant-$ENVIRONMENT-Foundation"
    "Radiant-$ENVIRONMENT-Networking"
    "Radiant-$ENVIRONMENT-Security"
    "Radiant-$ENVIRONMENT-Data"
    "Radiant-$ENVIRONMENT-Storage"
    "Radiant-$ENVIRONMENT-Auth"
    "Radiant-$ENVIRONMENT-AI"
    "Radiant-$ENVIRONMENT-API"
    "Radiant-$ENVIRONMENT-Admin"
)

for stack in "${STACKS[@]}"; do
    STATUS=$(aws cloudformation describe-stacks --stack-name "$stack" --query 'Stacks[0].StackStatus' --output text 2>/dev/null || echo "NOT_FOUND")
    
    if [ "$STATUS" == "CREATE_COMPLETE" ] || [ "$STATUS" == "UPDATE_COMPLETE" ]; then
        check_pass "$stack ($STATUS)"
    elif [ "$STATUS" == "NOT_FOUND" ]; then
        check_fail "$stack (Not deployed)"
    else
        check_warn "$stack ($STATUS)"
    fi
done

# ─────────────────────────────────────────────────────────────────
# Aurora Database
# ─────────────────────────────────────────────────────────────────
echo ""
echo -e "${BLUE}▸ Aurora Database${NC}"

DB_CLUSTER="radiant-$ENVIRONMENT-cluster"
DB_STATUS=$(aws rds describe-db-clusters --db-cluster-identifier "$DB_CLUSTER" --query 'DBClusters[0].Status' --output text 2>/dev/null || echo "NOT_FOUND")

if [ "$DB_STATUS" == "available" ]; then
    check_pass "Aurora cluster ($DB_CLUSTER) is available"
else
    check_fail "Aurora cluster ($DB_CLUSTER) status: $DB_STATUS"
fi

# ─────────────────────────────────────────────────────────────────
# DynamoDB Tables
# ─────────────────────────────────────────────────────────────────
echo ""
echo -e "${BLUE}▸ DynamoDB Tables${NC}"

TABLES=(
    "radiant-$ENVIRONMENT-sessions"
    "radiant-$ENVIRONMENT-rate-limits"
    "radiant-$ENVIRONMENT-cache"
)

for table in "${TABLES[@]}"; do
    TABLE_STATUS=$(aws dynamodb describe-table --table-name "$table" --query 'Table.TableStatus' --output text 2>/dev/null || echo "NOT_FOUND")
    
    if [ "$TABLE_STATUS" == "ACTIVE" ]; then
        check_pass "DynamoDB table $table"
    elif [ "$TABLE_STATUS" == "NOT_FOUND" ]; then
        check_warn "DynamoDB table $table (Not found - may use different naming)"
    else
        check_fail "DynamoDB table $table ($TABLE_STATUS)"
    fi
done

# ─────────────────────────────────────────────────────────────────
# Cognito User Pools
# ─────────────────────────────────────────────────────────────────
echo ""
echo -e "${BLUE}▸ Cognito User Pools${NC}"

USER_POOLS=$(aws cognito-idp list-user-pools --max-results 20 --query "UserPools[?contains(Name, 'radiant') && contains(Name, '$ENVIRONMENT')].{Name:Name,Id:Id}" --output json 2>/dev/null)

if [ -n "$USER_POOLS" ] && [ "$USER_POOLS" != "[]" ]; then
    check_pass "Cognito user pools found"
    if [ "$VERBOSE" = true ]; then
        echo "$USER_POOLS" | jq -r '.[] | "    - \(.Name)"'
    fi
else
    check_warn "No Cognito user pools found matching pattern"
fi

# ─────────────────────────────────────────────────────────────────
# Lambda Functions
# ─────────────────────────────────────────────────────────────────
echo ""
echo -e "${BLUE}▸ Lambda Functions${NC}"

LAMBDA_COUNT=$(aws lambda list-functions --query "Functions[?contains(FunctionName, 'Radiant-$ENVIRONMENT')].FunctionName" --output json 2>/dev/null | jq length)

if [ "$LAMBDA_COUNT" -gt 0 ]; then
    check_pass "Lambda functions deployed ($LAMBDA_COUNT functions)"
    if [ "$VERBOSE" = true ]; then
        aws lambda list-functions --query "Functions[?contains(FunctionName, 'Radiant-$ENVIRONMENT')].FunctionName" --output text | tr '\t' '\n' | sed 's/^/    - /'
    fi
else
    check_fail "No Lambda functions found"
fi

# ─────────────────────────────────────────────────────────────────
# API Gateway
# ─────────────────────────────────────────────────────────────────
echo ""
echo -e "${BLUE}▸ API Gateway${NC}"

API_COUNT=$(aws apigateway get-rest-apis --query "items[?contains(name, 'radiant') || contains(name, 'Radiant')].name" --output json 2>/dev/null | jq length)

if [ "$API_COUNT" -gt 0 ]; then
    check_pass "API Gateway REST APIs found ($API_COUNT APIs)"
else
    check_warn "No API Gateway REST APIs found"
fi

# ─────────────────────────────────────────────────────────────────
# S3 Buckets
# ─────────────────────────────────────────────────────────────────
echo ""
echo -e "${BLUE}▸ S3 Buckets${NC}"

BUCKET_COUNT=$(aws s3api list-buckets --query "Buckets[?contains(Name, 'radiant') && contains(Name, '$ENVIRONMENT')].Name" --output json 2>/dev/null | jq length)

if [ "$BUCKET_COUNT" -gt 0 ]; then
    check_pass "S3 buckets found ($BUCKET_COUNT buckets)"
    if [ "$VERBOSE" = true ]; then
        aws s3api list-buckets --query "Buckets[?contains(Name, 'radiant') && contains(Name, '$ENVIRONMENT')].Name" --output text | tr '\t' '\n' | sed 's/^/    - /'
    fi
else
    check_warn "No S3 buckets found matching pattern"
fi

# ─────────────────────────────────────────────────────────────────
# KMS Keys
# ─────────────────────────────────────────────────────────────────
echo ""
echo -e "${BLUE}▸ KMS Keys${NC}"

KMS_ALIASES=$(aws kms list-aliases --query "Aliases[?contains(AliasName, 'radiant')].AliasName" --output json 2>/dev/null | jq length)

if [ "$KMS_ALIASES" -gt 0 ]; then
    check_pass "KMS key aliases found ($KMS_ALIASES aliases)"
else
    check_warn "No KMS key aliases found matching pattern"
fi

# ─────────────────────────────────────────────────────────────────
# Secrets Manager
# ─────────────────────────────────────────────────────────────────
echo ""
echo -e "${BLUE}▸ Secrets Manager${NC}"

SECRET_COUNT=$(aws secretsmanager list-secrets --query "SecretList[?contains(Name, 'radiant') || contains(Name, 'Radiant')].Name" --output json 2>/dev/null | jq length)

if [ "$SECRET_COUNT" -gt 0 ]; then
    check_pass "Secrets found ($SECRET_COUNT secrets)"
else
    check_warn "No secrets found matching pattern"
fi

# ─────────────────────────────────────────────────────────────────
# Summary
# ─────────────────────────────────────────────────────────────────
echo ""
echo -e "${BLUE}═══════════════════════════════════════════════════════════════${NC}"
echo -e "${BLUE}  Verification Summary${NC}"
echo -e "${BLUE}═══════════════════════════════════════════════════════════════${NC}"
echo ""
echo -e "  ${GREEN}Passed:${NC}   $PASS_COUNT"
echo -e "  ${YELLOW}Warnings:${NC} $WARN_COUNT"
echo -e "  ${RED}Failed:${NC}   $FAIL_COUNT"
echo ""

if [ $FAIL_COUNT -eq 0 ]; then
    echo -e "${GREEN}✅ All critical checks passed!${NC}"
    exit 0
else
    echo -e "${RED}❌ Some checks failed. Review the output above.${NC}"
    exit 1
fi
