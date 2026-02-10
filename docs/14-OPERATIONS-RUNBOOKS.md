# Operations & Runbooks

**Deployment • Incident Response • Scaling • Performance • Disaster Recovery**

*RADIANT v6.6.0 — Generated February 07, 2026*

---

## Table of Contents

- **Part I: Deployment**
- **Part II: Incident Response**
- **Part III: On-Call**
- **Part IV: Scaling**
- **Part V: Performance**
- **Part VI: Troubleshooting**
- **Part VII: Disaster Recovery**
- **Part VIII: Testing**
- **Part IX: OMEGA Firmware Hot-Swap Operations (v6.4.0)**

---


---

## Part I: Deployment

## Overview

This runbook covers deployment procedures for the RADIANT platform.

## Environments

| Environment | Purpose | Auto-Deploy | Approval |
|-------------|---------|-------------|----------|
| `dev` | Development testing | On PR merge to develop | None |
| `staging` | Pre-production | On PR merge to main | None |
| `production` | Live environment | Manual trigger | Required |

## Pre-Deployment Checklist

### Code Quality
- [ ] All tests passing in CI
- [ ] Code review approved
- [ ] No security vulnerabilities
- [ ] Documentation updated

### Infrastructure
- [ ] CDK diff reviewed
- [ ] Database migrations reviewed
- [ ] No breaking API changes (or versioned)
- [ ] Feature flags in place if needed

### Operations
- [ ] Monitoring dashboards ready
- [ ] Rollback plan documented
- [ ] On-call notified (production)
- [ ] Low-traffic window selected (production)

## Deployment Steps

### 1. Development Environment

```bash
# Automatic via GitHub Actions on develop branch
# Or manual:
make deploy-dev
```

### 2. Staging Environment

```bash
# Automatic via GitHub Actions on main branch
# Or manual:
make deploy-staging
```

### 3. Production Environment

#### Step 1: Create Release

```bash
# Create release tag
git tag -a v4.17.1 -m "Release 4.17.1"
git push origin v4.17.1

# Or use GitHub Releases UI
```

#### Step 2: Deploy Infrastructure

```bash
# CDK diff first
ENVIRONMENT=production pnpm --filter @radiant/infrastructure cdk diff

# Deploy with approval
make deploy-prod
```

#### Step 3: Database Migrations

1. Go to Admin Dashboard → Migrations
2. Create migration approval request
3. Get second admin approval
4. Execute migration
5. Verify data integrity

#### Step 4: Deploy Dashboard

```bash
# Build dashboard
pnpm --filter @radiant/admin-dashboard build

# Deploy to S3
aws s3 sync apps/admin-dashboard/out s3://radiant-dashboard-production --delete

# Invalidate CloudFront
aws cloudfront create-invalidation \
  --distribution-id <DIST_ID> \
  --paths "/*"
```

#### Step 5: Verify Deployment

```bash
# Health check
curl https://api.radiant.example.com/v2/health

# Check dashboard
open https://admin.radiant.example.com

# Monitor CloudWatch
open https://console.aws.amazon.com/cloudwatch/home?region=us-east-1#dashboards:name=radiant-production-dashboard
```

## Database Migrations

### Creating Migrations

```bash
# Create new migration file
touch packages/infrastructure/migrations/037_new_feature.sql
```

### Migration File Format

```sql
-- Migration: 037_new_feature
-- Description: Add new feature tables
-- Author: developer@example.com
-- Date: 2024-12-24

-- Up Migration
CREATE TABLE IF NOT EXISTS new_feature (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE new_feature ENABLE ROW LEVEL SECURITY;

-- RLS Policy
CREATE POLICY new_feature_tenant_isolation ON new_feature
  USING (tenant_id = current_setting('app.current_tenant_id')::uuid);

-- Rollback: DROP TABLE new_feature;
```

### Running Migrations

```bash
# Dev/Staging (local)
./scripts/run-migrations.sh

# Production (via Admin Dashboard)
# Use Migration Approval workflow
```

## Rollback Procedures

### Quick Rollback (Lambda)

```bash
# List recent versions
aws lambda list-versions-by-function \
  --function-name radiant-production-router \
  --max-items 5

# Update alias to previous version
aws lambda update-alias \
  --function-name radiant-production-router \
  --name live \
  --function-version 42
```

### Full Rollback (CDK)

```bash
# Check recent deployments
aws cloudformation describe-stack-events \
  --stack-name RadiantProductionApi \
  --max-items 20

# Rollback (if still in progress)
aws cloudformation cancel-update-stack \
  --stack-name RadiantProductionApi

# Or redeploy previous version
git checkout v4.17.0
make deploy-prod
```

### Dashboard Rollback

```bash
# Sync previous build from backup
aws s3 sync s3://radiant-backups/dashboard/v4.17.0 s3://radiant-dashboard-production --delete

# Invalidate cache
aws cloudfront create-invalidation \
  --distribution-id <DIST_ID> \
  --paths "/*"
```

## Blue-Green Deployment (Optional)

For zero-downtime deployments:

1. Deploy new version to "green" stack
2. Run smoke tests against green
3. Switch Route 53 weighted routing
4. Monitor for errors
5. Remove "blue" stack after verification

## Canary Deployment (Optional)

For gradual rollouts:

1. Deploy new Lambda version
2. Configure alias with 10% weight
3. Monitor error rates
4. Gradually increase to 100%

```bash
# Configure canary
aws lambda update-alias \
  --function-name radiant-production-router \
  --name live \
  --routing-config AdditionalVersionWeights={"43"=0.1}
```

## Monitoring During Deployment

### Key Metrics to Watch

- API error rate (< 1%)
- API latency p99 (< 2s)
- Lambda errors (0)
- Database connections (< 80)

### Alerts to Monitor

- `radiant-production-api-5xx-errors`
- `radiant-production-api-latency`
- `radiant-production-lambda-errors`
- `radiant-production-db-cpu`

## Post-Deployment

### Verification Checklist

- [ ] Health endpoints responding
- [ ] Login working
- [ ] Key user flows functional
- [ ] No error spike in CloudWatch
- [ ] No increase in support tickets

### Documentation

- [ ] Update CHANGELOG.md
- [ ] Create GitHub Release
- [ ] Notify stakeholders
- [ ] Update status page (if applicable)

## Troubleshooting

### Deployment Stuck

```bash
# Check CloudFormation status
aws cloudformation describe-stacks --stack-name RadiantProductionApi

# Check for stack events
aws cloudformation describe-stack-events --stack-name RadiantProductionApi

# Force continue if stuck
aws cloudformation continue-update-rollback --stack-name RadiantProductionApi
```

### Lambda Not Updating

```bash
# Force function update
aws lambda update-function-code \
  --function-name radiant-production-router \
  --s3-bucket radiant-artifacts \
  --s3-key lambda/latest.zip
```

### Dashboard Not Updating

```bash
# Check CloudFront status
aws cloudfront get-distribution --id <DIST_ID>

# Create aggressive invalidation
aws cloudfront create-invalidation \
  --distribution-id <DIST_ID> \
  --paths "/*"
```


---

## Part II: Incident Response

> **Version**: {{RADIANT_VERSION}}
> **Last Updated**: {{BUILD_DATE}}

---

## 1. Incident Classification

| Severity | Definition | Response Time | Examples |
|----------|------------|---------------|----------|
| **P1 - Critical** | Platform down, all users affected | 15 minutes | Database failure, Auth down |
| **P2 - High** | Major feature broken, many users affected | 1 hour | Payment processing failed |
| **P3 - Medium** | Feature degraded, some users affected | 4 hours | Slow response times |
| **P4 - Low** | Minor issue, workaround available | 24 hours | UI bug, typo |

---

## 2. Incident Response Process

### 2.1 Detection

1. **Automated Alerts**: CloudWatch, PagerDuty
2. **User Reports**: Support tickets, status page
3. **Monitoring**: Dashboard anomalies

### 2.2 Triage

```
┌─────────────────────────────────────────┐
│         Incident Detected               │
└─────────────────┬───────────────────────┘
                  │
                  ▼
┌─────────────────────────────────────────┐
│     Assess Impact & Severity            │
│  - Users affected?                      │
│  - Revenue impact?                      │
│  - Data at risk?                        │
└─────────────────┬───────────────────────┘
                  │
                  ▼
┌─────────────────────────────────────────┐
│     Assign Severity (P1-P4)             │
└─────────────────┬───────────────────────┘
                  │
                  ▼
┌─────────────────────────────────────────┐
│     Notify Stakeholders                 │
└─────────────────────────────────────────┘
```

### 2.3 Response Actions

**P1 - Critical**
1. Page on-call engineer immediately
2. Create incident channel (#incident-YYYYMMDD)
3. Update status page to "Investigating"
4. Assemble incident team
5. Begin investigation

**P2 - High**
1. Notify on-call engineer
2. Create incident ticket
3. Update status page if customer-facing
4. Begin investigation within 1 hour

---

## 3. Common Incidents

### 3.1 Database Connection Failure

**Symptoms:**
- 500 errors on API requests
- "Connection refused" in logs

**Investigation:**
```bash
# Check Aurora cluster status
aws rds describe-db-clusters --db-cluster-identifier radiant-cluster

# Check security group rules
aws ec2 describe-security-groups --group-ids sg-xxx

# Verify secrets
aws secretsmanager get-secret-value --secret-id radiant/db-credentials
```

**Resolution:**
1. Check if cluster is available
2. Verify security group allows Lambda access
3. Check if credentials rotated
4. Restart affected Lambda functions

### 3.2 High Latency

**Symptoms:**
- Response times > 5 seconds
- Timeout errors

**Investigation:**
```bash
# Check Lambda duration metrics
aws cloudwatch get-metric-statistics \
  --namespace AWS/Lambda \
  --metric-name Duration \
  --dimensions Name=FunctionName,Value=radiant-api \
  --start-time $(date -u -d '1 hour ago' +%Y-%m-%dT%H:%M:%SZ) \
  --end-time $(date -u +%Y-%m-%dT%H:%M:%SZ) \
  --period 300 \
  --statistics Average,Maximum

# Check external provider health
curl -w "@curl-format.txt" https://api.openai.com/v1/models
```

**Resolution:**
1. Identify slow component (DB, provider, processing)
2. Scale resources if needed
3. Enable caching if appropriate
4. Contact provider if external issue

### 3.3 Provider Outage

**Symptoms:**
- Errors from specific AI provider
- Brain Router selecting alternatives

**Investigation:**
```bash
# Check provider health dashboard
# Review error rates by provider in CloudWatch

aws cloudwatch get-metric-statistics \
  --namespace RADIANT/Providers \
  --metric-name ErrorRate \
  --dimensions Name=Provider,Value=openai \
  --start-time $(date -u -d '1 hour ago' +%Y-%m-%dT%H:%M:%SZ) \
  --end-time $(date -u +%Y-%m-%dT%H:%M:%SZ) \
  --period 60 \
  --statistics Average
```

**Resolution:**
1. Verify outage on provider status page
2. Brain Router should auto-failover
3. Update internal status page
4. Monitor for resolution
5. Post-incident: review failover effectiveness

---

## 4. Communication Templates

### 4.1 Status Page - Investigating

```
Investigating Increased Error Rates

We are currently investigating reports of increased error rates 
affecting [service]. Our team is actively working to identify 
and resolve the issue.

We will provide updates every 30 minutes or as we have new information.

Posted: [TIME] UTC
```

### 4.2 Status Page - Identified

```
Issue Identified - [Brief Description]

We have identified the cause of [issue]. The problem is related to 
[root cause summary]. Our team is implementing a fix.

Estimated resolution: [TIME] UTC

Posted: [TIME] UTC
```

### 4.3 Status Page - Resolved

```
Resolved - [Brief Description]

The issue affecting [service] has been resolved. 
[Brief explanation of fix].

Total duration: [X] hours [Y] minutes
Impact: [description of impact]

We apologize for any inconvenience caused.

Posted: [TIME] UTC
```

---

## 5. Post-Incident

### 5.1 Post-Mortem Template

```markdown
# Incident Post-Mortem: [Title]

**Date**: [Date]
**Duration**: [Start] - [End] ([Duration])
**Severity**: P[X]
**Author**: [Name]

## Summary
[1-2 sentence summary]

## Impact
- Users affected: [number]
- Revenue impact: [amount]
- SLA impact: [yes/no]

## Timeline
| Time (UTC) | Event |
|------------|-------|
| HH:MM | [Event] |

## Root Cause
[Detailed explanation]

## Resolution
[How it was fixed]

## Action Items
| Item | Owner | Due Date | Status |
|------|-------|----------|--------|
| [Action] | [Name] | [Date] | Open |

## Lessons Learned
- [Lesson 1]
- [Lesson 2]
```

### 5.2 Review Meeting

Schedule within 48 hours of resolution:
- Review timeline
- Identify root cause
- Assign action items
- Update runbooks if needed

---

## 6. Contacts

| Role | Contact |
|------|---------|
| On-Call Engineer | PagerDuty |
| Platform Lead | [email] |
| Security Team | security@radiant.ai |
| Customer Success | support@radiant.ai |

---

*This runbook is part of the RADIANT v{{RADIANT_VERSION}} documentation.*


## Overview

This runbook provides procedures for responding to incidents in the RADIANT platform.

## Severity Levels

| Level | Description | Response Time | Examples |
|-------|-------------|---------------|----------|
| **SEV1** | Critical - Service down | 15 minutes | Complete outage, data loss |
| **SEV2** | Major - Significant degradation | 30 minutes | Partial outage, high error rates |
| **SEV3** | Minor - Limited impact | 2 hours | Single feature broken |
| **SEV4** | Low - Minimal impact | Next business day | Cosmetic issues |

## Initial Response

### 1. Acknowledge the Alert

```bash
# Check CloudWatch dashboard
aws cloudwatch get-dashboard --dashboard-name radiant-production-dashboard

# Check recent alarms
aws cloudwatch describe-alarms --state-value ALARM
```

### 2. Assess Impact

- [ ] How many users are affected?
- [ ] Which services are impacted?
- [ ] Is data at risk?
- [ ] What's the business impact?

### 3. Communicate

- SEV1/SEV2: Immediately notify on-call and stakeholders
- Update status page if available
- Create incident channel

## Common Incidents

### API Gateway 5XX Errors

**Symptoms:**
- High 5XX error rate in CloudWatch
- Users reporting API failures

**Investigation:**
```bash
# Check Lambda logs
aws logs filter-log-events \
  --log-group-name /aws/lambda/radiant-production-router \
  --filter-pattern "ERROR" \
  --start-time $(date -d '1 hour ago' +%s000)

# Check for throttling
aws cloudwatch get-metric-statistics \
  --namespace AWS/Lambda \
  --metric-name Throttles \
  --dimensions Name=FunctionName,Value=radiant-production-router \
  --start-time $(date -d '1 hour ago' -Iseconds) \
  --end-time $(date -Iseconds) \
  --period 60 \
  --statistics Sum
```

**Resolution:**
1. Check if Lambda is hitting memory/timeout limits
2. Check database connectivity
3. Review recent deployments
4. Scale up if needed

### Database Connection Issues

**Symptoms:**
- Connection timeout errors in Lambda logs
- High database connection count

**Investigation:**
```bash
# Check connection count
aws cloudwatch get-metric-statistics \
  --namespace AWS/RDS \
  --metric-name DatabaseConnections \
  --dimensions Name=DBClusterIdentifier,Value=radiant-production \
  --start-time $(date -d '1 hour ago' -Iseconds) \
  --end-time $(date -Iseconds) \
  --period 60 \
  --statistics Average

# Check for long-running queries (via admin dashboard)
```

**Resolution:**
1. Check for connection leaks in Lambda
2. Increase connection pool size
3. Scale database if CPU is high
4. Kill long-running queries if necessary

### High Latency

**Symptoms:**
- API p99 latency > 5 seconds
- User complaints about slowness

**Investigation:**
```bash
# Check Lambda duration
aws cloudwatch get-metric-statistics \
  --namespace AWS/Lambda \
  --metric-name Duration \
  --dimensions Name=FunctionName,Value=radiant-production-router \
  --start-time $(date -d '1 hour ago' -Iseconds) \
  --end-time $(date -Iseconds) \
  --period 60 \
  --statistics p99

# Check database latency
aws cloudwatch get-metric-statistics \
  --namespace AWS/RDS \
  --metric-name ReadLatency \
  --dimensions Name=DBClusterIdentifier,Value=radiant-production \
  --start-time $(date -d '1 hour ago' -Iseconds) \
  --end-time $(date -Iseconds) \
  --period 60 \
  --statistics Average
```

**Resolution:**
1. Check for slow database queries
2. Review cold start times
3. Check for external API latency (AI providers)
4. Scale up Lambda memory if CPU-bound

### Authentication Failures

**Symptoms:**
- Users cannot log in
- Token validation failures

**Investigation:**
```bash
# Check Cognito metrics
aws cloudwatch get-metric-statistics \
  --namespace AWS/Cognito \
  --metric-name SignInSuccesses \
  --dimensions Name=UserPool,Value=radiant-production-users \
  --start-time $(date -d '1 hour ago' -Iseconds) \
  --end-time $(date -Iseconds) \
  --period 300 \
  --statistics Sum
```

**Resolution:**
1. Check Cognito service health
2. Verify JWT token configuration
3. Check for clock skew issues
4. Review recent Cognito changes

### Storage Quota Exceeded

**Symptoms:**
- Upload failures
- Storage billing alerts

**Investigation:**
```bash
# Check S3 bucket size
aws s3 ls s3://radiant-storage-production --summarize --recursive | tail -2

# Check storage usage in database
# Use admin dashboard Storage page
```

**Resolution:**
1. Identify large files/tenants
2. Contact affected tenants
3. Clean up orphaned files
4. Increase quota if appropriate

## Rollback Procedures

### Lambda Rollback

```bash
# List versions
aws lambda list-versions-by-function \
  --function-name radiant-production-router

# Rollback to previous version
aws lambda update-alias \
  --function-name radiant-production-router \
  --name live \
  --function-version <previous-version>
```

### Database Rollback

**WARNING: Database rollbacks are dangerous. Follow dual-admin approval.**

1. Create a new migration to undo changes
2. Get dual-admin approval via Migration Approval page
3. Execute the migration
4. Verify data integrity

### CDK Rollback

```bash
# Check CloudFormation events
aws cloudformation describe-stack-events \
  --stack-name RadiantProductionApi

# Rollback to previous state
aws cloudformation continue-update-rollback \
  --stack-name RadiantProductionApi
```

## Post-Incident

### 1. Resolve Alert

```bash
# Set alarm to OK (if manually resolved)
aws cloudwatch set-alarm-state \
  --alarm-name radiant-production-api-5xx-errors \
  --state-value OK \
  --state-reason "Manually resolved"
```

### 2. Document

Create an incident report:
- Timeline of events
- Root cause analysis
- Actions taken
- Lessons learned
- Follow-up items

### 3. Review

- Schedule post-mortem for SEV1/SEV2
- Update runbooks with new learnings
- Create tickets for improvements

## Contacts

| Role | Contact | Escalation |
|------|---------|------------|
| On-Call Engineer | PagerDuty | Auto-escalate after 15 min |
| Engineering Lead | @engineering-lead | SEV1/SEV2 |
| Security | @security-team | Security incidents |
| Product | @product-team | Business impact |

## Useful Links

- [CloudWatch Dashboard](https://console.aws.amazon.com/cloudwatch)
- [Admin Dashboard](/admin)
- [Status Page](#)
- [Incident Slack Channel](#incidents)


---

## Part III: On-Call

## Overview

This runbook provides guidance for on-call engineers supporting the RADIANT platform.

## On-Call Responsibilities

1. **Monitor** alerts and dashboards
2. **Respond** to incidents within SLA
3. **Escalate** when needed
4. **Document** all actions taken
5. **Handoff** to next on-call

## Shift Schedule

- Primary on-call: 24/7 coverage
- Secondary on-call: Backup for escalation
- Shifts rotate weekly (Monday 9am)

## Alert Sources

| Source | Type | Priority |
|--------|------|----------|
| PagerDuty | Alerts | High |
| Slack #alerts | Warnings | Medium |
| Email | Informational | Low |

## First Response

### 1. Acknowledge Alert

```bash
# Via PagerDuty app or CLI
pd incident acknowledge <incident-id>
```

### 2. Initial Assessment (5 minutes)

- [ ] What is the alert?
- [ ] What service is affected?
- [ ] What's the impact?
- [ ] When did it start?

### 3. Check Dashboards

```bash
# Open CloudWatch dashboard
open "https://console.aws.amazon.com/cloudwatch/home?region=us-east-1#dashboards:name=radiant-production-dashboard"

# Or use AWS CLI
aws cloudwatch get-metric-data \
  --metric-data-queries file://quick-metrics.json \
  --start-time $(date -d '1 hour ago' -Iseconds) \
  --end-time $(date -Iseconds)
```

### 4. Check Service Health

```bash
# API health
curl -s https://api.radiant.example.com/v2/health | jq

# Dashboard health
curl -s -o /dev/null -w "%{http_code}" https://admin.radiant.example.com

# Database (via admin API)
curl -s -H "Authorization: Bearer $TOKEN" \
  https://api.radiant.example.com/v2/admin/health/database | jq
```

## Common Alerts

### API Error Rate High

**Alert:** `radiant-production-api-5xx-errors`

**Quick Check:**
```bash
# Recent Lambda errors
aws logs filter-log-events \
  --log-group-name /aws/lambda/radiant-production-router \
  --filter-pattern "ERROR" \
  --start-time $(date -d '30 minutes ago' +%s000) \
  --limit 20
```

**Actions:**
1. Check if it's a single endpoint or widespread
2. Check recent deployments
3. Check database connectivity
4. Escalate if > 5 minutes

### API Latency High

**Alert:** `radiant-production-api-latency`

**Quick Check:**
```bash
# Lambda duration
aws cloudwatch get-metric-statistics \
  --namespace AWS/Lambda \
  --metric-name Duration \
  --dimensions Name=FunctionName,Value=radiant-production-router \
  --statistics p99 \
  --period 60 \
  --start-time $(date -d '30 minutes ago' -Iseconds) \
  --end-time $(date -Iseconds)
```

**Actions:**
1. Check if cold starts are high
2. Check database query times
3. Check AI provider latency
4. Consider scaling up

### Database CPU High

**Alert:** `radiant-production-db-cpu`

**Quick Check:**
```bash
# DB metrics
aws cloudwatch get-metric-statistics \
  --namespace AWS/RDS \
  --metric-name CPUUtilization \
  --dimensions Name=DBClusterIdentifier,Value=radiant-production \
  --statistics Average \
  --period 60 \
  --start-time $(date -d '30 minutes ago' -Iseconds) \
  --end-time $(date -Iseconds)
```

**Actions:**
1. Check for long-running queries
2. Check connection count
3. Consider read replica
4. Escalate to database team

### Lambda Throttling

**Alert:** Lambda concurrent execution limit

**Quick Check:**
```bash
aws cloudwatch get-metric-statistics \
  --namespace AWS/Lambda \
  --metric-name Throttles \
  --dimensions Name=FunctionName,Value=radiant-production-router \
  --statistics Sum \
  --period 60 \
  --start-time $(date -d '30 minutes ago' -Iseconds) \
  --end-time $(date -Iseconds)
```

**Actions:**
1. Request concurrency limit increase
2. Check for retry storms
3. Consider provisioned concurrency

## Escalation

### When to Escalate

- SEV1/SEV2 incidents
- Unable to resolve within 30 minutes
- Security incidents
- Data loss potential
- Need additional expertise

### Escalation Path

1. **Secondary On-Call** - First escalation
2. **Engineering Lead** - Major incidents
3. **Security Team** - Security issues
4. **Executive** - Business-critical

### How to Escalate

```bash
# Via PagerDuty
pd incident escalate <incident-id> --escalation-policy "Engineering Lead"

# Via Slack
/page @engineering-lead SEV2 - API errors > 5%
```

## Useful Commands

### Log Analysis

```bash
# Search logs for errors
aws logs filter-log-events \
  --log-group-name /aws/lambda/radiant-production-router \
  --filter-pattern "ERROR" \
  --start-time $(date -d '1 hour ago' +%s000)

# Search for specific request
aws logs filter-log-events \
  --log-group-name /aws/lambda/radiant-production-router \
  --filter-pattern '"requestId":"abc123"'
```

### Quick Metrics

```bash
# API request count
aws cloudwatch get-metric-statistics \
  --namespace AWS/ApiGateway \
  --metric-name Count \
  --dimensions Name=ApiName,Value=radiant-production-api \
  --statistics Sum \
  --period 300 \
  --start-time $(date -d '1 hour ago' -Iseconds) \
  --end-time $(date -Iseconds)
```

### Service Status

```bash
# All Lambda functions
aws lambda list-functions \
  --query "Functions[?starts_with(FunctionName, 'radiant-production')].[FunctionName,LastModified]" \
  --output table

# All RDS clusters
aws rds describe-db-clusters \
  --query "DBClusters[?starts_with(DBClusterIdentifier, 'radiant')].[DBClusterIdentifier,Status]" \
  --output table
```

## Handoff Procedure

### End of Shift

1. **Document** any ongoing issues
2. **Update** incident tickets
3. **Brief** incoming on-call
4. **Transfer** PagerDuty responsibility

### Handoff Template

```
## On-Call Handoff

**Date:** YYYY-MM-DD
**Outgoing:** @name
**Incoming:** @name

### Active Incidents
- None / [Incident links]

### Recent Issues
- [Brief description of any issues in past 24h]

### Upcoming Changes
- [Any scheduled deployments or maintenance]

### Notes
- [Anything the incoming on-call should know]
```

## Resources

- [Incident Response Runbook](./INCIDENT_RESPONSE.md)
- [Deployment Runbook](./DEPLOYMENT.md)
- [CloudWatch Dashboard](https://console.aws.amazon.com/cloudwatch)
- [Admin Dashboard](https://admin.radiant.example.com)
- [PagerDuty](https://radiant.pagerduty.com)


---

## Part IV: Scaling

> **Version**: {{RADIANT_VERSION}}
> **Last Updated**: {{BUILD_DATE}}

---

## 1. Auto-Scaling Configuration

### 1.1 Lambda Functions

| Function | Min | Max | Scaling Trigger |
|----------|-----|-----|-----------------|
| API Handler | 10 | 1000 | Concurrent requests |
| Brain Router | 5 | 500 | Queue depth |
| Webhook Handler | 2 | 100 | Event count |

### 1.2 Aurora PostgreSQL

| Setting | Value | Notes |
|---------|-------|-------|
| Min ACUs | 2 | Development |
| Max ACUs | 64 | Production |
| Scale-out cooldown | 5 minutes | |
| Scale-in cooldown | 15 minutes | |

### 1.3 SageMaker Endpoints

| Model Category | Min | Max | Scale Trigger |
|----------------|-----|-----|---------------|
| Vision Models | 0 | 5 | Invocations/min |
| LLM Models | 0 | 3 | Queue depth |
| Audio Models | 0 | 2 | Invocations/min |

---

## 2. Manual Scaling Procedures

### 2.1 Pre-Event Scaling

Before expected high traffic:

```bash
# Scale Aurora to maximum
aws rds modify-db-cluster \
  --db-cluster-identifier radiant-cluster \
  --serverless-v2-scaling-configuration MinCapacity=16,MaxCapacity=64

# Pre-warm Lambda functions
for i in {1..100}; do
  aws lambda invoke \
    --function-name radiant-api \
    --invocation-type Event \
    --payload '{"warmup": true}' \
    /dev/null &
done
wait

# Scale SageMaker endpoints
aws sagemaker update-endpoint-weights-and-capacities \
  --endpoint-name radiant-vision \
  --desired-weights-and-capacities '[{"VariantName":"AllTraffic","DesiredInstanceCount":3}]'
```

### 2.2 Emergency Scaling

During unexpected traffic spike:

```bash
# Increase Lambda concurrency limit
aws lambda put-function-concurrency \
  --function-name radiant-api \
  --reserved-concurrent-executions 2000

# Scale Aurora immediately
aws rds modify-db-cluster \
  --db-cluster-identifier radiant-cluster \
  --serverless-v2-scaling-configuration MinCapacity=32,MaxCapacity=128 \
  --apply-immediately
```

---

## 3. Monitoring Scaling Events

### 3.1 Key Metrics

| Metric | Warning | Critical |
|--------|---------|----------|
| Lambda Concurrent Executions | 70% of limit | 90% of limit |
| Aurora ACU Utilization | 80% | 95% |
| API Gateway 5xx Rate | 1% | 5% |

### 3.2 CloudWatch Alarms

```bash
# List scaling alarms
aws cloudwatch describe-alarms \
  --alarm-name-prefix "radiant-scaling"

# Check alarm history
aws cloudwatch describe-alarm-history \
  --alarm-name "radiant-api-high-concurrency" \
  --history-item-type StateUpdate
```

---

## 4. Cost Considerations

| Resource | Cost Factor | Optimization |
|----------|-------------|--------------|
| Lambda | Duration × Memory | Right-size memory |
| Aurora | ACU-hours | Scale down off-peak |
| SageMaker | Instance-hours | Use spot instances |
| API Gateway | Request count | Enable caching |

---

*This runbook is part of the RADIANT v{{RADIANT_VERSION}} documentation.*


---

## Part V: Performance

## Overview

This guide covers performance optimization, caching strategies, and scalability considerations for the RADIANT platform.

## Architecture Performance

### Request Flow

```
Client → CloudFront → WAF → API Gateway → Lambda → Aurora
                                              ↓
                                          Redis Cache
```

### Latency Targets

| Component | Target | Max Acceptable |
|-----------|--------|----------------|
| CloudFront edge | < 50ms | 100ms |
| WAF processing | < 5ms | 20ms |
| API Gateway | < 20ms | 50ms |
| Lambda cold start | < 500ms | 1000ms |
| Lambda execution | < 200ms | 500ms |
| Database query | < 50ms | 200ms |
| **Total P95** | **< 500ms** | **2000ms** |

## Caching Strategy

### Multi-Layer Caching

```
┌─────────────────────────────────────────────────────────────┐
│                     CloudFront CDN                          │
│  TTL: 5m for static, 1m for API (with stale-while-revalidate)│
└─────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────┐
│                    API Gateway Cache                         │
│           TTL: 60s for GET endpoints                        │
└─────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────┐
│                      Redis Cache                             │
│     Session: 24h, Config: 5m, Translations: 1h             │
└─────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────┐
│                    Aurora Database                           │
│           Query cache, Connection pooling                   │
└─────────────────────────────────────────────────────────────┘
```

### Cache Keys

```typescript
// Session cache
`session:${tenantId}:${userId}` → TTL: 24h

// Configuration cache
`config:${tenantId}:${key}` → TTL: 5m
`config:global:${key}` → TTL: 5m

// Translation cache
`i18n:${language}:bundle` → TTL: 1h
`i18n:${language}:${key}` → TTL: 1h

// Model cache
`models:${tenantId}:list` → TTL: 5m
`models:${tenantId}:${modelId}` → TTL: 5m

// Rate limit cache
`ratelimit:${tenantId}:${endpoint}` → TTL: 1m
`ratelimit:ip:${ip}` → TTL: 5m
```

### Cache Invalidation

```typescript
// Pattern-based invalidation
await redis.del(`config:${tenantId}:*`);

// Event-driven invalidation
eventBridge.putEvents({
  Entries: [{
    Source: 'radiant.config',
    DetailType: 'ConfigUpdated',
    Detail: JSON.stringify({ tenantId, key }),
  }],
});
```

## Database Optimization

### Connection Pooling

```typescript
// RDS Proxy configuration
const pool = {
  min: 2,
  max: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
};
```

### Query Optimization

```sql
-- Always use indexes
CREATE INDEX idx_models_tenant_status ON ai_models(tenant_id, status);
CREATE INDEX idx_transactions_tenant_date ON credit_transactions(tenant_id, created_at DESC);

-- Use covering indexes for common queries
CREATE INDEX idx_models_list ON ai_models(tenant_id, status, is_enabled) 
  INCLUDE (display_name, category, input_cost_per_1k);

-- Partition large tables by date
CREATE TABLE audit_logs_2024_01 PARTITION OF audit_logs
  FOR VALUES FROM ('2024-01-01') TO ('2024-02-01');
```

### RLS Performance

```sql
-- Set tenant context once per request
SET app.current_tenant_id = 'tenant-123';

-- All subsequent queries automatically filtered
SELECT * FROM models;  -- Implicitly filtered by RLS
```

## Lambda Optimization

### Cold Start Reduction

```typescript
// 1. Minimize dependencies
// 2. Use Lambda layers for shared code
// 3. Enable provisioned concurrency for critical functions

// Provisioned concurrency config
new lambda.Function(this, 'Router', {
  // ... config
  provisionedConcurrentExecutions: 10, // Keep 10 warm
});
```

### Memory Optimization

```typescript
// Memory vs CPU tradeoff
// More memory = more CPU = faster execution

// Recommended settings by function type:
const memoryConfig = {
  router: 1024,      // Main API - balanced
  billing: 512,      // Light compute
  aiProxy: 2048,     // Heavy compute for AI
  migration: 256,    // Infrequent, light
};
```

### Bundling

```typescript
// esbuild configuration for minimal bundle size
{
  bundle: true,
  minify: true,
  treeShaking: true,
  external: ['aws-sdk'], // Use Lambda runtime SDK
  target: 'node20',
}
```

## Rate Limiting

### Tier Limits

| Tier | RPS | Burst | Daily |
|------|-----|-------|-------|
| Free | 10 | 20 | 1,000 |
| Starter | 50 | 100 | 10,000 |
| Professional | 100 | 200 | 50,000 |
| Business | 500 | 1,000 | 250,000 |
| Enterprise | 2,000 | 5,000 | Unlimited |

### Implementation

```typescript
// Token bucket algorithm in Redis
const rateLimiter = {
  async checkLimit(tenantId: string, limit: number): Promise<boolean> {
    const key = `ratelimit:${tenantId}`;
    const current = await redis.incr(key);
    
    if (current === 1) {
      await redis.expire(key, 1); // 1 second window
    }
    
    return current <= limit;
  }
};
```

## Load Testing

### Running Tests

```bash
# Install k6
brew install k6

# Run smoke test
k6 run --env BASE_URL=https://api-dev.radiant.example.com tests/load/k6-config.js

# Run with specific scenario
k6 run --env BASE_URL=https://api-dev.radiant.example.com \
  -e SCENARIO=load tests/load/k6-config.js
```

### Performance Baselines

| Metric | Baseline | Target |
|--------|----------|--------|
| Throughput | 500 RPS | 2000 RPS |
| P50 Latency | 100ms | 50ms |
| P95 Latency | 500ms | 200ms |
| P99 Latency | 1000ms | 500ms |
| Error Rate | < 1% | < 0.1% |

## Scaling

### Horizontal Scaling

| Component | Scaling Method |
|-----------|----------------|
| Lambda | Automatic (up to account limit) |
| Aurora | Read replicas, Serverless v2 |
| Redis | ElastiCache cluster mode |
| API Gateway | Automatic |

### Vertical Scaling

```typescript
// Aurora Serverless v2 scaling
const database = new rds.DatabaseCluster(this, 'Database', {
  serverlessV2MinCapacity: 0.5,  // Minimum ACUs
  serverlessV2MaxCapacity: 16,   // Maximum ACUs
});

// Lambda memory scaling
const lambda = new lambda.Function(this, 'Function', {
  memorySize: 2048,  // More memory = more CPU
});
```

## Monitoring

### Key Metrics

```typescript
// CloudWatch metrics to monitor
const metrics = {
  // Latency
  'AWS/ApiGateway/Latency': 'p95 < 500ms',
  'AWS/Lambda/Duration': 'p95 < 200ms',
  'AWS/RDS/ReadLatency': 'avg < 50ms',
  
  // Throughput
  'AWS/ApiGateway/Count': 'track trends',
  'AWS/Lambda/Invocations': 'track trends',
  
  // Errors
  'AWS/ApiGateway/5XXError': 'rate < 1%',
  'AWS/Lambda/Errors': 'rate < 1%',
  
  // Resources
  'AWS/Lambda/ConcurrentExecutions': '< 80% of limit',
  'AWS/RDS/CPUUtilization': '< 80%',
  'AWS/RDS/DatabaseConnections': '< 80% of max',
};
```

### Alerting Thresholds

| Metric | Warning | Critical |
|--------|---------|----------|
| API P95 Latency | > 1s | > 3s |
| Error Rate | > 1% | > 5% |
| Lambda Concurrent | > 500 | > 800 |
| DB CPU | > 70% | > 85% |
| DB Connections | > 60% | > 80% |

## Best Practices

### Do's

- ✅ Cache aggressively with proper invalidation
- ✅ Use connection pooling
- ✅ Minimize cold starts with provisioned concurrency
- ✅ Use read replicas for read-heavy workloads
- ✅ Implement circuit breakers for external services
- ✅ Use async processing for non-critical paths

### Don'ts

- ❌ Don't make synchronous calls to external APIs in hot paths
- ❌ Don't use Lambda for long-running tasks (> 15 min)
- ❌ Don't store large objects in Redis
- ❌ Don't rely on API Gateway caching for dynamic data
- ❌ Don't skip database indexes

## Troubleshooting

### High Latency

1. Check Lambda cold starts (enable provisioned concurrency)
2. Check database query times (add indexes)
3. Check external API latency (add caching/circuit breaker)
4. Check connection pool exhaustion

### High Error Rate

1. Check Lambda errors in CloudWatch Logs
2. Check database connection errors
3. Check rate limiting (429 errors)
4. Check WAF blocked requests

### Scaling Issues

1. Check Lambda concurrent execution limit
2. Check database connection limit
3. Check API Gateway throttling
4. Check Redis memory usage


## Version: 5.42.0

This document outlines performance optimizations implemented and recommended for the RADIANT platform.

---

## 1. Lambda Cold Start Optimization

### Current Configuration

| Lambda | Memory | Timeout | Provisioned Concurrency |
|--------|--------|---------|------------------------|
| Admin API | 1024 MB | 30s | 0 (on-demand) |
| Think Tank API | 2048 MB | 60s | 0 (on-demand) |
| Agent Worker | 2048 MB | 300s | 0 (configurable) |
| Transparency Worker | 512 MB | 30s | 0 |

### Recommendations

#### 1.1 Bundle Optimization
```typescript
// Use esbuild for smaller bundles
// Current: ~5MB bundled
// Target: <2MB bundled

// In CDK stack:
bundling: {
  minify: true,
  sourceMap: false,
  treeshaking: true,
  externalModules: ['@aws-sdk/*'], // Use Lambda's built-in SDK
}
```

#### 1.2 Lazy Loading
```typescript
// Defer heavy imports until needed
let bedrockClient: BedrockRuntimeClient | null = null;

function getBedrockClient() {
  if (!bedrockClient) {
    bedrockClient = new BedrockRuntimeClient({});
  }
  return bedrockClient;
}
```

#### 1.3 Connection Reuse
```typescript
// Reuse HTTP connections
const httpAgent = new https.Agent({
  keepAlive: true,
  maxSockets: 50,
});
```

---

## 2. Database Query Optimization

### 2.1 Query Patterns

**Use Indexes Effectively:**
```sql
-- Ensure indexes exist for common queries
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_ai_reports_tenant_updated 
ON ai_reports(tenant_id, updated_at DESC);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_ai_report_insights_tenant_created
ON ai_report_insights(tenant_id, created_at DESC);
```

**Batch Operations:**
```typescript
// Instead of N individual inserts
for (const item of items) {
  await executeStatement('INSERT INTO...', [item]);
}

// Use batch insert
const values = items.map((_, i) => `($${i*3+1}, $${i*3+2}, $${i*3+3})`).join(',');
await executeStatement(`INSERT INTO table (a, b, c) VALUES ${values}`, flatParams);
```

### 2.2 Connection Pooling

Aurora Data API handles connection pooling automatically. Ensure:
- `maxConnections` is appropriate for tier
- Idle connections are released

---

## 3. Caching Strategy

### 3.1 In-Memory Caching (Lambda)

```typescript
// Cache expensive computations during Lambda lifetime
const cache = new Map<string, { data: unknown; expiry: number }>();

function getCached<T>(key: string, ttlMs: number, compute: () => T): T {
  const now = Date.now();
  const cached = cache.get(key);
  
  if (cached && cached.expiry > now) {
    return cached.data as T;
  }
  
  const data = compute();
  cache.set(key, { data, expiry: now + ttlMs });
  return data;
}
```

### 3.2 Redis/ElastiCache (Production)

For high-traffic endpoints:
- Model configurations: 5 min TTL
- Tenant settings: 1 min TTL
- User sessions: 15 min TTL

### 3.3 API Gateway Caching

```typescript
// CDK configuration
const api = new apigateway.RestApi(this, 'Api', {
  deployOptions: {
    cachingEnabled: true,
    cacheClusterEnabled: true,
    cacheClusterSize: '0.5',
    cacheTtl: cdk.Duration.minutes(1),
  },
});

// Per-method caching
method.addMethodResponse({
  statusCode: '200',
  responseParameters: {
    'method.response.header.Cache-Control': true,
  },
});
```

---

## 4. Response Optimization

### 4.1 Compression

```typescript
// Enable gzip for large responses
if (body.length > 1024) {
  const compressed = zlib.gzipSync(body);
  return {
    statusCode: 200,
    headers: {
      'Content-Encoding': 'gzip',
      'Content-Type': 'application/json',
    },
    body: compressed.toString('base64'),
    isBase64Encoded: true,
  };
}
```

### 4.2 Pagination

```typescript
// Always paginate large result sets
const DEFAULT_PAGE_SIZE = 50;
const MAX_PAGE_SIZE = 200;

function paginate<T>(items: T[], page: number, pageSize: number): PaginatedResult<T> {
  const size = Math.min(pageSize || DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE);
  const offset = (page - 1) * size;
  
  return {
    items: items.slice(offset, offset + size),
    total: items.length,
    page,
    pageSize: size,
    totalPages: Math.ceil(items.length / size),
  };
}
```

---

## 5. AI Model Call Optimization

### 5.1 Streaming Responses

```typescript
// Use streaming for long generations
const stream = await bedrockClient.send(new InvokeModelWithResponseStreamCommand({
  modelId,
  body: JSON.stringify(request),
}));

for await (const event of stream.body) {
  if (event.chunk) {
    yield JSON.parse(new TextDecoder().decode(event.chunk.bytes));
  }
}
```

### 5.2 Request Batching

```typescript
// Batch similar requests
const batchWindow = 50; // ms
const pendingRequests: Map<string, Promise<Response>> = new Map();

async function batchedInvoke(prompt: string): Promise<Response> {
  const key = hashPrompt(prompt);
  
  if (pendingRequests.has(key)) {
    return pendingRequests.get(key)!;
  }
  
  const promise = invoke(prompt);
  pendingRequests.set(key, promise);
  
  setTimeout(() => pendingRequests.delete(key), batchWindow);
  
  return promise;
}
```

### 5.3 Prompt Caching (Claude)

```typescript
// Use prompt caching for repeated system prompts
const request = {
  anthropic_version: 'bedrock-2023-05-31',
  system: [
    {
      type: 'text',
      text: systemPrompt,
      cache_control: { type: 'ephemeral' }, // Enable caching
    },
  ],
  messages,
};
```

---

## 6. Frontend Performance

### 6.1 Code Splitting

```typescript
// Dynamic imports for large components
const AIReportsPage = dynamic(() => import('./ai-reports'), {
  loading: () => <Skeleton />,
  ssr: false,
});
```

### 6.2 Data Fetching

```typescript
// Use SWR for caching and revalidation
const { data, error, isLoading } = useSWR(
  '/api/admin/ai-reports',
  fetcher,
  {
    revalidateOnFocus: false,
    dedupingInterval: 30000,
  }
);
```

### 6.3 Image Optimization

```typescript
// Use Next.js Image component
import Image from 'next/image';

<Image
  src={logoUrl}
  width={200}
  height={50}
  priority={false}
  loading="lazy"
/>
```

---

## 7. Monitoring & Alerts

### 7.1 Key Metrics

| Metric | Warning | Critical |
|--------|---------|----------|
| P95 Latency | > 1s | > 3s |
| Error Rate | > 1% | > 5% |
| Cold Start Rate | > 10% | > 25% |
| Cache Hit Rate | < 80% | < 60% |

### 7.2 CloudWatch Alarms

```typescript
new cloudwatch.Alarm(this, 'HighLatencyAlarm', {
  metric: api.metricLatency({ statistic: 'p95' }),
  threshold: 1000,
  evaluationPeriods: 3,
  comparisonOperator: cloudwatch.ComparisonOperator.GREATER_THAN_THRESHOLD,
});
```

---

## 8. Cost Optimization

### 8.1 Right-Sizing

- Start with minimum viable memory
- Use Lambda Power Tuning to find optimal
- Monitor actual memory usage

### 8.2 Reserved Concurrency

```typescript
// For predictable workloads
const fn = new lambda.Function(this, 'Function', {
  // ...
  reservedConcurrentExecutions: 100, // Limit max concurrency
});
```

### 8.3 Spot Instances (ECS/Fargate)

For self-hosted models:
```typescript
fargateService.taskDefinition.addContainer('model', {
  // ...
  capacityProviderStrategies: [
    { capacityProvider: 'FARGATE_SPOT', weight: 2 },
    { capacityProvider: 'FARGATE', weight: 1 },
  ],
});
```

---

## 9. Quick Wins Checklist

- [ ] Enable API Gateway caching for read endpoints
- [ ] Add database indexes for frequent queries
- [ ] Implement response compression for large payloads
- [ ] Use streaming for AI model responses
- [ ] Enable HTTP keep-alive for external calls
- [ ] Lazy-load heavy SDK clients
- [ ] Paginate all list endpoints
- [ ] Add CloudWatch alarms for latency
- [ ] Review Lambda memory settings monthly
- [ ] Enable prompt caching for Claude models


---

## Part VI: Troubleshooting

## Common Issues and Solutions

### CDK Deployment Failures

| Issue | Likely Cause | Solution |
|-------|--------------|----------|
| Bootstrap failed | Wrong account/region | Verify `aws sts get-caller-identity` |
| Stack timeout | Slow resource creation | Check CloudFormation events in AWS Console |
| Resource limit | Service quota exceeded | Request quota increase via AWS Service Quotas |
| IAM permission denied | Insufficient permissions | Ensure IAM user has AdministratorAccess |
| Circular dependency | Stack references | Check stack dependencies in CDK code |
| Asset upload failed | S3 bucket permissions | Verify CDK bootstrap bucket exists |

### Aurora Database Issues

| Issue | Likely Cause | Solution |
|-------|--------------|----------|
| Connection refused | Security group rules | Verify Lambda SG can reach Aurora SG on port 5432 |
| Authentication failed | Wrong credentials | Check Secrets Manager for correct credentials |
| Connection timeout | Missing VPC endpoints | Add RDS VPC endpoint to private subnets |
| Too many connections | Connection exhaustion | Use RDS Proxy or increase max_connections |
| Slow queries | Missing indexes | Run EXPLAIN ANALYZE and add appropriate indexes |
| RLS blocking access | Tenant ID not set | Ensure `app.current_tenant_id` is set in session |

### Lambda Function Errors

| Issue | Likely Cause | Solution |
|-------|--------------|----------|
| Cold start > 10s | VPC attachment | Use provisioned concurrency for critical functions |
| Timeout | Slow downstream services | Increase timeout, check DB/API latency |
| Out of memory | Large payloads/responses | Increase memory allocation (also increases CPU) |
| Permission denied | IAM role misconfigured | Check Lambda execution role policies |
| Module not found | Missing dependency | Verify all dependencies in package.json |
| Handler not found | Incorrect handler path | Check function configuration in CDK |

### LiteLLM / ECS Issues

| Issue | Likely Cause | Solution |
|-------|--------------|----------|
| 503 Service Unavailable | ECS task unhealthy | Check ECS service events and task logs |
| Provider timeout | Invalid API key | Verify provider secrets in Secrets Manager |
| Rate limited | Too many requests | Implement exponential backoff retry |
| Wrong model response | Model misconfigured | Check config.yaml model mappings |
| Container crashes | Memory exhaustion | Increase task memory in CDK |
| No healthy targets | Health check failing | Verify health check endpoint returns 200 |

### SageMaker Issues (Tier 3+)

| Issue | Likely Cause | Solution |
|-------|--------------|----------|
| Endpoint failed to create | Insufficient capacity | Try different instance type or region |
| InvocationError | Model loading failed | Check CloudWatch logs for model errors |
| Slow cold start | Large model size | Use warm pools or smaller model variant |
| Capacity error | Instance quota reached | Request SageMaker quota increase |
| Timeout | Long inference time | Increase endpoint timeout or optimize model |

### Cognito Authentication Issues

| Issue | Likely Cause | Solution |
|-------|--------------|----------|
| Invalid grant | Expired refresh token | Re-authenticate user |
| User not confirmed | Email not verified | Check email or manually confirm user |
| MFA required | MFA not set up | Complete MFA setup flow |
| Invalid client | Wrong client ID | Verify app client ID in configuration |
| Callback URL mismatch | URL not whitelisted | Add URL to allowed callbacks in Cognito |

### Admin Dashboard Issues

| Issue | Likely Cause | Solution |
|-------|--------------|----------|
| 403 Forbidden | CloudFront OAC issue | Verify S3 bucket policy allows CloudFront |
| API calls fail | CORS configuration | Check API Gateway CORS settings |
| Login redirect loop | Cookie domain mismatch | Verify cookie domain matches site domain |
| Blank page | Build error | Check `next build` output for errors |
| Slow load | Large bundle size | Enable code splitting and lazy loading |

---

## Log Locations

| Component | CloudWatch Log Group |
|-----------|---------------------|
| API Gateway | `/aws/api-gateway/radiant-{env}-api` |
| Lambda Functions | `/aws/lambda/Radiant-{env}-*` |
| LiteLLM (ECS) | `/ecs/radiant-{env}-litellm` |
| SageMaker Endpoints | `/aws/sagemaker/Endpoints/radiant-*` |
| Aurora PostgreSQL | `/aws/rds/cluster/radiant-{env}/postgresql` |
| CloudFront | Standard CloudFront logs in S3 |

### Viewing Logs

```bash
# Tail Lambda logs in real-time
aws logs tail /aws/lambda/Radiant-dev-router --follow

# View ECS logs
aws logs tail /ecs/radiant-dev-litellm --follow

# Search logs for errors
aws logs filter-log-events \
  --log-group-name /aws/lambda/Radiant-dev-router \
  --filter-pattern "ERROR" \
  --start-time $(date -d '1 hour ago' +%s)000
```

---

## Health Check Endpoints

```bash
# Platform API health
curl https://api.YOUR_DOMAIN/health
# Expected: {"status":"healthy","version":"4.17.0"}

# LiteLLM health
curl https://api.YOUR_DOMAIN/v2/litellm/health
# Expected: {"status":"healthy"}

# Admin API health  
curl https://admin-api.YOUR_DOMAIN/health

# Model registry status
curl https://api.YOUR_DOMAIN/v2/models/status
```

---

## Emergency Procedures

### Database Restore from Snapshot

```bash
# List available snapshots
aws rds describe-db-cluster-snapshots \
  --db-cluster-identifier radiant-prod-cluster \
  --query 'DBClusterSnapshots[*].[DBClusterSnapshotIdentifier,SnapshotCreateTime]' \
  --output table

# Restore from snapshot
aws rds restore-db-cluster-from-snapshot \
  --db-cluster-identifier radiant-prod-restored \
  --snapshot-identifier your-snapshot-id \
  --engine aurora-postgresql \
  --vpc-security-group-ids sg-xxx \
  --db-subnet-group-name radiant-prod-db-subnet
```

### Point-in-Time Recovery

```bash
aws rds restore-db-cluster-to-point-in-time \
  --source-db-cluster-identifier radiant-prod-cluster \
  --db-cluster-identifier radiant-prod-recovered \
  --restore-to-time "2024-12-20T10:00:00Z" \
  --vpc-security-group-ids sg-xxx \
  --db-subnet-group-name radiant-prod-db-subnet
```

### Rollback CDK Deployment

```bash
# Rollback to previous deployment
cd packages/infrastructure
npx cdk deploy Radiant-prod-API \
  --context environment=prod \
  --context tier=3 \
  --rollback
```

### Disable Problematic Model

```sql
-- Connect to Aurora and run:
UPDATE models 
SET status = 'disabled', 
    disabled_reason = 'Emergency disable due to errors',
    updated_at = NOW()
WHERE model_id = 'problematic-model-id';
```

### Force Scale Down SageMaker

```bash
# Scale endpoint to 0 instances
aws sagemaker update-endpoint-weights-and-capacities \
  --endpoint-name radiant-prod-model-endpoint \
  --desired-weights-and-capacities '[{"VariantName":"AllTraffic","DesiredInstanceCount":0}]'
```

---

## Performance Benchmarks

| Metric | Target | Acceptable | Action if Exceeded |
|--------|--------|------------|-------------------|
| API Gateway p50 latency | < 50ms | < 100ms | Check Lambda cold starts |
| API Gateway p99 latency | < 200ms | < 500ms | Enable provisioned concurrency |
| Chat streaming start | < 500ms | < 1s | Check LiteLLM/provider latency |
| Admin dashboard load | < 2s | < 3s | Optimize bundle, enable CDN caching |
| Model warm-up time | < 3 min | < 5 min | Use larger instance or warm pools |
| Aurora query latency | < 10ms | < 50ms | Add indexes, optimize queries |

---

## Support Checklist

When reporting issues, include:

1. **Environment**: dev/staging/prod
2. **Tier**: 1-5
3. **Error message**: Full error text
4. **Request ID**: From response headers
5. **Timestamp**: When the error occurred
6. **Steps to reproduce**: What actions led to the error
7. **Relevant logs**: CloudWatch log excerpts

---

## Useful AWS CLI Commands

```bash
# Check stack status
aws cloudformation describe-stacks --stack-name Radiant-dev-API \
  --query 'Stacks[0].StackStatus'

# List recent CloudFormation events
aws cloudformation describe-stack-events --stack-name Radiant-dev-API \
  --query 'StackEvents[0:10].[Timestamp,ResourceStatus,ResourceType,LogicalResourceId]' \
  --output table

# Check Lambda function configuration
aws lambda get-function-configuration --function-name Radiant-dev-router

# List ECS services
aws ecs list-services --cluster radiant-dev-cluster

# Describe ECS service
aws ecs describe-services --cluster radiant-dev-cluster \
  --services radiant-dev-litellm

# Check Secrets Manager secret
aws secretsmanager get-secret-value --secret-id radiant/dev/db-credentials \
  --query 'SecretString' --output text | jq .
```


---

## Part VII: Disaster Recovery

## Overview

This document outlines disaster recovery (DR) procedures for the RADIANT platform, including backup strategies, recovery procedures, and business continuity plans.

## Recovery Objectives

| Metric | Target | Maximum |
|--------|--------|---------|
| **RTO** (Recovery Time Objective) | 1 hour | 4 hours |
| **RPO** (Recovery Point Objective) | 5 minutes | 1 hour |

## Backup Strategy

### Database Backups

#### Automated Backups (Aurora)

```typescript
// CDK Configuration
const database = new rds.DatabaseCluster(this, 'Database', {
  backup: {
    retention: cdk.Duration.days(35),      // 35 days retention
    preferredWindow: '03:00-04:00',        // 3-4 AM UTC
  },
  deletionProtection: true,
  storageEncrypted: true,
});
```

#### Point-in-Time Recovery

Aurora supports point-in-time recovery (PITR) to any second within the retention period.

```bash
# Restore to specific point in time
aws rds restore-db-cluster-to-point-in-time \
  --source-db-cluster-identifier radiant-production \
  --db-cluster-identifier radiant-production-restored \
  --restore-to-time "2024-12-24T10:30:00Z" \
  --vpc-security-group-ids sg-xxx \
  --db-subnet-group-name radiant-production
```

#### Manual Snapshots

```bash
# Create manual snapshot before major changes
aws rds create-db-cluster-snapshot \
  --db-cluster-identifier radiant-production \
  --db-cluster-snapshot-identifier radiant-production-pre-migration-$(date +%Y%m%d)
```

### S3 Backups

#### Versioning

```typescript
// All S3 buckets have versioning enabled
const bucket = new s3.Bucket(this, 'Storage', {
  versioned: true,
  lifecycleRules: [
    {
      noncurrentVersionExpiration: cdk.Duration.days(90),
    },
  ],
});
```

#### Cross-Region Replication

```typescript
// Production buckets replicate to DR region
const replicationRule = {
  destination: {
    bucket: drBucket.bucketArn,
    storageClass: s3.StorageClass.STANDARD_IA,
  },
  status: 'Enabled',
};
```

### Secrets Backup

```bash
# Export secrets for DR (store securely!)
aws secretsmanager get-secret-value \
  --secret-id radiant-production-db \
  --query SecretString \
  --output text > /secure/path/db-credentials.json
```

## Failure Scenarios

### Scenario 1: Single AZ Failure

**Impact:** Partial service degradation
**Recovery:** Automatic (Multi-AZ)

Aurora automatically fails over to a read replica in another AZ.

```bash
# Monitor failover
aws rds describe-events \
  --source-type db-cluster \
  --source-identifier radiant-production \
  --duration 60
```

### Scenario 2: Database Corruption

**Impact:** Data integrity issues
**Recovery:** Point-in-time restore

1. Identify corruption time
2. Restore to point before corruption
3. Validate data integrity
4. Switch traffic to restored database

```bash
# Step 1: Identify issue time from logs
aws logs filter-log-events \
  --log-group-name /aws/rds/cluster/radiant-production/error \
  --start-time $(date -d '24 hours ago' +%s000)

# Step 2: Restore
aws rds restore-db-cluster-to-point-in-time \
  --source-db-cluster-identifier radiant-production \
  --db-cluster-identifier radiant-dr-$(date +%Y%m%d%H%M) \
  --restore-to-time "2024-12-24T09:00:00Z"

# Step 3: Update Lambda environment to use new cluster
aws lambda update-function-configuration \
  --function-name radiant-production-router \
  --environment "Variables={DB_CLUSTER_ARN=arn:aws:rds:...}"
```

### Scenario 3: Region Failure

**Impact:** Complete service outage
**Recovery:** Failover to DR region

1. Activate DR region infrastructure
2. Promote Aurora Global Database secondary
3. Update Route 53 to point to DR region
4. Verify service health

```bash
# Step 1: Promote DR database
aws rds failover-global-cluster \
  --global-cluster-identifier radiant-global \
  --target-db-cluster-identifier radiant-dr-cluster

# Step 2: Update DNS
aws route53 change-resource-record-sets \
  --hosted-zone-id Z123456 \
  --change-batch file://dr-dns-failover.json
```

### Scenario 4: Accidental Deletion

**Impact:** Data loss
**Recovery:** Restore from backup

```bash
# Restore deleted S3 objects
aws s3api list-object-versions \
  --bucket radiant-storage-production \
  --prefix "deleted/path/" \
  --query 'DeleteMarkers[?IsLatest==`true`]'

# Restore specific version
aws s3api delete-object \
  --bucket radiant-storage-production \
  --key "path/to/file" \
  --version-id "delete-marker-version-id"
```

### Scenario 5: Security Breach

**Impact:** Potential data exposure
**Recovery:** Isolation and investigation

1. Isolate affected systems
2. Rotate all credentials
3. Investigate scope
4. Restore from known-good backup
5. Notify affected parties

```bash
# Step 1: Disable API access
aws apigateway update-stage \
  --rest-api-id abc123 \
  --stage-name v2 \
  --patch-operations op=replace,path=/throttling/rateLimit,value=0

# Step 2: Rotate database credentials
aws secretsmanager rotate-secret \
  --secret-id radiant-production-db

# Step 3: Invalidate all sessions
aws cognito-idp admin-user-global-sign-out \
  --user-pool-id us-east-1_xxx \
  --username "*"
```

## Recovery Procedures

### Database Recovery Runbook

```bash
#!/bin/bash
# database-recovery.sh

set -e

CLUSTER_ID="radiant-production"
RESTORE_TIME="${1:-$(date -d '1 hour ago' -Iseconds)}"
NEW_CLUSTER_ID="radiant-dr-$(date +%Y%m%d%H%M)"

echo "🔄 Starting database recovery..."
echo "   Source: $CLUSTER_ID"
echo "   Restore time: $RESTORE_TIME"
echo "   New cluster: $NEW_CLUSTER_ID"

# Create restored cluster
aws rds restore-db-cluster-to-point-in-time \
  --source-db-cluster-identifier "$CLUSTER_ID" \
  --db-cluster-identifier "$NEW_CLUSTER_ID" \
  --restore-to-time "$RESTORE_TIME" \
  --db-subnet-group-name radiant-production \
  --vpc-security-group-ids sg-xxx

echo "⏳ Waiting for cluster to be available..."
aws rds wait db-cluster-available \
  --db-cluster-identifier "$NEW_CLUSTER_ID"

# Create instance
aws rds create-db-instance \
  --db-instance-identifier "${NEW_CLUSTER_ID}-instance-1" \
  --db-cluster-identifier "$NEW_CLUSTER_ID" \
  --db-instance-class db.r6g.large \
  --engine aurora-postgresql

echo "⏳ Waiting for instance to be available..."
aws rds wait db-instance-available \
  --db-instance-identifier "${NEW_CLUSTER_ID}-instance-1"

echo "✅ Database restored successfully!"
echo "   Endpoint: $(aws rds describe-db-clusters \
  --db-cluster-identifier "$NEW_CLUSTER_ID" \
  --query 'DBClusters[0].Endpoint' --output text)"
```

### Full Service Recovery Runbook

```bash
#!/bin/bash
# full-recovery.sh

set -e

echo "🚨 RADIANT Full Service Recovery"
echo "================================="

# Step 1: Database
echo "Step 1: Recovering database..."
./scripts/dr/database-recovery.sh

# Step 2: Update Lambda configurations
echo "Step 2: Updating Lambda configurations..."
for fn in router admin billing localization configuration; do
  aws lambda update-function-configuration \
    --function-name "radiant-production-$fn" \
    --environment "Variables={DB_CLUSTER_ARN=$NEW_DB_ARN}"
done

# Step 3: Clear caches
echo "Step 3: Clearing caches..."
redis-cli -h radiant-cache.xxx.cache.amazonaws.com FLUSHALL

# Step 4: Verify health
echo "Step 4: Verifying service health..."
curl -f https://api.radiant.example.com/v2/health || exit 1

# Step 5: Run smoke tests
echo "Step 5: Running smoke tests..."
k6 run --env BASE_URL=https://api.radiant.example.com tests/load/k6-config.js

echo "✅ Recovery complete!"
```

## Testing DR Procedures

### Quarterly DR Drill

1. **Preparation**
   - Schedule maintenance window
   - Notify stakeholders
   - Prepare rollback plan

2. **Execution**
   - Simulate failure scenario
   - Execute recovery procedures
   - Measure RTO/RPO

3. **Validation**
   - Verify data integrity
   - Run integration tests
   - Check all services

4. **Documentation**
   - Record actual RTO/RPO
   - Document issues encountered
   - Update procedures

### DR Test Checklist

- [ ] Database point-in-time recovery tested
- [ ] S3 object recovery tested
- [ ] Secret rotation tested
- [ ] Lambda rollback tested
- [ ] DNS failover tested
- [ ] Communication plan executed
- [ ] Recovery time recorded
- [ ] Post-mortem completed

## Communication Plan

### Escalation Matrix

| Severity | Response Time | Notify |
|----------|---------------|--------|
| SEV1 | 15 min | Eng Lead, CTO, Status Page |
| SEV2 | 30 min | Eng Lead, Status Page |
| SEV3 | 2 hours | On-call team |

### Status Page Updates

```bash
# Update status page (example with Statuspage.io)
curl -X POST https://api.statuspage.io/v1/pages/xxx/incidents \
  -H "Authorization: OAuth $STATUSPAGE_API_KEY" \
  -d '{
    "incident": {
      "name": "Service Degradation",
      "status": "investigating",
      "body": "We are investigating reports of API errors."
    }
  }'
```

## Infrastructure as Code

All DR infrastructure is defined in CDK:

```typescript
// lib/stacks/dr-stack.ts
export class DRStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props: DRStackProps) {
    super(scope, id, props);
    
    // Global Database for cross-region replication
    const globalCluster = new rds.CfnGlobalCluster(this, 'GlobalCluster', {
      globalClusterIdentifier: 'radiant-global',
      sourceDbClusterIdentifier: props.primaryClusterArn,
    });
    
    // S3 Cross-Region Replication
    const drBucket = new s3.Bucket(this, 'DRBucket', {
      bucketName: `radiant-storage-dr-${props.drRegion}`,
    });
  }
}
```

## Contacts

| Role | Contact | Backup |
|------|---------|--------|
| DR Coordinator | dr@radiant.example.com | cto@radiant.example.com |
| Database Admin | dba@radiant.example.com | platform@radiant.example.com |
| Security | security@radiant.example.com | cto@radiant.example.com |


---

## Part VIII: Testing

Comprehensive guide for testing RADIANT components.

## Overview

RADIANT uses a multi-layered testing strategy:

| Layer | Tool | Location | Purpose |
|-------|------|----------|---------|
| Unit Tests | Vitest | `**/__tests__/*.test.ts` | Test individual functions/components |
| Integration Tests | Vitest | `**/__tests__/*.integration.test.ts` | Test service interactions |
| E2E Tests | Playwright | `apps/admin-dashboard/e2e/` | Test user workflows |
| Swift Tests | XCTest | `apps/swift-deployer/Tests/` | Test Swift services |

---

## Quick Start

```bash
# Run all tests
pnpm test

# Run with coverage
pnpm test:coverage

# Run E2E tests
cd apps/admin-dashboard && pnpm test:e2e

# Run Swift tests
cd apps/swift-deployer && swift test
```

---

## Unit Testing

### Lambda Handler Tests

Tests for Lambda handlers are located in `__tests__/` directories:

```
packages/infrastructure/lambda/
├── admin/
│   └── __tests__/
│       └── handler.test.ts
├── billing/
│   └── __tests__/
│       └── handler.test.ts
└── shared/
    └── __tests__/
        ├── auth.test.ts
        ├── errors.test.ts
        └── services.test.ts
```

#### Running Lambda Tests

```bash
cd packages/infrastructure

# Run all Lambda tests
pnpm test

# Run specific handler
pnpm test -- admin
pnpm test -- billing

# Run with coverage
pnpm test:coverage

# Watch mode
pnpm test:watch
```

#### Writing Lambda Tests

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { APIGatewayProxyEvent, Context } from 'aws-lambda';

// Mock dependencies
vi.mock('../../shared/db', () => ({
  listTenants: vi.fn(),
  getTenantById: vi.fn(),
}));

import { handler } from '../handler';
import { listTenants, getTenantById } from '../../shared/db';

// Create mock context
const mockContext = {
  awsRequestId: 'test-request-id',
  functionName: 'test-handler',
  // ... other required fields
} as Context;

// Create mock event helper
function createMockEvent(overrides = {}): APIGatewayProxyEvent {
  return {
    httpMethod: 'GET',
    path: '/test',
    headers: { Authorization: 'Bearer test-token' },
    // ... default values
    ...overrides,
  };
}

describe('Handler', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should return 200 for valid request', async () => {
    (listTenants as ReturnType<typeof vi.fn>).mockResolvedValue([]);
    
    const event = createMockEvent({ path: '/admin/tenants' });
    const result = await handler(event, mockContext);
    
    expect(result.statusCode).toBe(200);
  });
});
```

### Shared Module Tests

Test shared utilities and services:

```typescript
// packages/infrastructure/lambda/shared/__tests__/errors.test.ts
import { describe, it, expect } from 'vitest';
import {
  ValidationError,
  NotFoundError,
  isOperationalError,
  toAppError,
} from '../errors';

describe('Error Classes', () => {
  it('should create ValidationError with 400 status', () => {
    const error = new ValidationError('Invalid input');
    
    expect(error.statusCode).toBe(400);
    expect(error.code).toBe('VALIDATION_ERROR');
  });
});
```

---

## E2E Testing (Admin Dashboard)

### Setup

```bash
cd apps/admin-dashboard

# Install Playwright browsers
npx playwright install

# Run E2E tests
pnpm test:e2e

# Run with UI
pnpm test:e2e:ui

# Run specific test file
pnpm test:e2e -- dashboard.spec.ts
```

### Test Structure

```
apps/admin-dashboard/e2e/
├── dashboard.spec.ts      # Dashboard navigation tests
├── deployment.spec.ts     # Deployment workflow tests
└── fixtures/
    └── test-data.json     # Test fixtures
```

### Writing E2E Tests

```typescript
// apps/admin-dashboard/e2e/dashboard.spec.ts
import { test, expect } from '@playwright/test';

test.describe('Dashboard', () => {
  test.beforeEach(async ({ page }) => {
    // Mock authentication
    await page.addInitScript(() => {
      localStorage.setItem('auth_token', 'test-token');
      localStorage.setItem('user', JSON.stringify({
        id: 'test-user',
        email: 'test@example.com',
        role: 'admin',
      }));
    });
  });

  test('should display dashboard home', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('heading', { level: 1 }))
      .toContainText('Dashboard');
  });

  test('should navigate to models page', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('link', { name: 'Models' }).click();
    await expect(page).toHaveURL('/models');
  });
});
```

---

## Swift Testing

### Test Structure

```
apps/swift-deployer/Tests/
├── RadiantDeployerTests.swift           # Basic unit tests
└── RadiantDeployerTests/
    ├── E2ETests/
    │   └── DeploymentE2ETests.swift     # E2E workflow tests
    └── ServiceTests/
        ├── LocalStorageManagerTests.swift
        └── CredentialServiceTests.swift
```

### Running Swift Tests

```bash
cd apps/swift-deployer

# Run all tests
swift test

# Run specific test class
swift test --filter LocalStorageManagerTests

# Run with verbose output
swift test -v

# Generate coverage (requires llvm-cov)
swift test --enable-code-coverage
```

### Writing Swift Tests

```swift
import XCTest
@testable import RadiantDeployer

final class LocalStorageManagerTests: XCTestCase {
    var storageManager: LocalStorageManager!
    
    override func setUp() {
        super.setUp()
        storageManager = LocalStorageManager.shared
    }
    
    override func tearDown() {
        // Cleanup
        super.tearDown()
    }
    
    func testSaveAndLoadConfiguration() async throws {
        // Given
        let key = "test_config"
        let config = TestConfiguration(name: "Test", value: 42)
        
        // When
        try await storageManager.save(config, forKey: key)
        let loaded: TestConfiguration? = try await storageManager.load(forKey: key)
        
        // Then
        XCTAssertNotNil(loaded)
        XCTAssertEqual(loaded?.name, "Test")
        XCTAssertEqual(loaded?.value, 42)
    }
}
```

---

## Test Utilities

### Mock Factories

Use the shared testing utilities:

```typescript
import {
  createMockTenant,
  createMockUser,
  createMockApiKey,
  createMockChatRequest,
  createMockChatResponse,
  createMockApiGatewayEvent,
  createMockLambdaContext,
} from '@radiant/shared/testing';

// Create mock data
const tenant = createMockTenant({ name: 'Test Corp' });
const user = createMockUser({ tenantId: tenant.id });
const event = createMockApiGatewayEvent({
  httpMethod: 'POST',
  body: JSON.stringify({ model: 'gpt-4o' }),
});
```

### Assertion Helpers

```typescript
import {
  assertDefined,
  assertEqual,
  assertMatch,
  assertContains,
  assertThrows,
  waitFor,
  sleep,
} from '@radiant/shared/testing';

// Custom assertions
assertDefined(result, 'Result should not be null');
assertMatch(response.id, /^chatcmpl_/, 'Invalid response ID format');

// Wait for async condition
await waitFor(() => service.isReady(), { timeout: 5000 });
```

---

## Mocking Guidelines

### Database Mocking

```typescript
vi.mock('../db/client', () => ({
  executeStatement: vi.fn(),
}));

import { executeStatement } from '../db/client';

// Mock return value
(executeStatement as ReturnType<typeof vi.fn>).mockResolvedValue({
  rows: [{ id: '123', name: 'Test' }],
});
```

### AWS SDK Mocking

```typescript
vi.mock('@aws-sdk/client-s3', () => ({
  S3Client: vi.fn().mockImplementation(() => ({
    send: vi.fn(),
  })),
  PutObjectCommand: vi.fn(),
}));
```

### External API Mocking

```typescript
vi.mock('node-fetch', () => ({
  default: vi.fn(),
}));

import fetch from 'node-fetch';

(fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
  ok: true,
  json: () => Promise.resolve({ data: 'mocked' }),
});
```

---

## CI/CD Integration

Tests run automatically in GitHub Actions:

```yaml
# .github/workflows/ci.yml
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Setup Node.js
        uses: actions/setup-node@v4
      - name: Install dependencies
        run: pnpm install
      - name: Run tests
        run: pnpm test
        env:
          DATABASE_URL: postgres://test@localhost:5432/test
```

### Coverage Requirements

- Minimum 80% coverage for new code
- Critical paths require 90%+ coverage
- All error handling paths must be tested

---

## Best Practices

### Do's

- ✅ Test behavior, not implementation
- ✅ Use descriptive test names
- ✅ Mock external dependencies
- ✅ Test error cases and edge cases
- ✅ Keep tests fast and isolated
- ✅ Use factory functions for test data

### Don'ts

- ❌ Don't test private methods directly
- ❌ Don't share state between tests
- ❌ Don't test framework code
- ❌ Don't ignore flaky tests
- ❌ Don't hardcode test data

### Test Naming Convention

```typescript
describe('ServiceName', () => {
  describe('methodName', () => {
    it('should return X when given Y', () => {});
    it('should throw error when invalid input', () => {});
    it('should handle empty array gracefully', () => {});
  });
});
```

---

## Debugging Tests

### Vitest

```bash
# Run with verbose output
pnpm test -- --reporter=verbose

# Run single test
pnpm test -- -t "should return 200"

# Debug mode
node --inspect-brk node_modules/.bin/vitest run
```

### Playwright

```bash
# Debug mode with browser
pnpm test:e2e -- --debug

# Generate trace on failure
pnpm test:e2e -- --trace on

# View trace
npx playwright show-trace trace.zip
```

### Swift

```bash
# Run with verbose output
swift test -v

# Run single test
swift test --filter "testSaveAndLoadConfiguration"
```

---

## See Also

- [Contributing Guide](../CONTRIBUTING.md)
- [Error Codes Reference](ERROR_CODES.md)
- [API Reference](API_REFERENCE.md)



---

## Part IX: OMEGA Firmware Hot-Swap Operations (v6.4.0)

> **Version**: 6.4.0 | **Date**: February 8, 2026
> **Audience**: System Administrators & DevOps

### 1. Key Concepts (60-Second Primer)

- **OMEGA Brain** — A living AI system running on Lambda/ECS. Maintains persistent state between requests and learns continuously.
- **Firmware (.bio file)** — A signed JSON file containing the brain's "instincts": safety rules (Helix), learning speed (Ambition), and personality (Broca prompt).
- **Hot-Swap** — Replacing firmware on a running brain without downtime. The brain detects the new firmware hash on its next inference cycle and atomically swaps (~50ms).
- **OMEGA Forge** — The admin web UI where you author, sign, and deploy firmware.

### 2. Swap Modes Cheat Sheet

| Mode | When to Use | Downtime | Risk Level | Approval Needed |
|------|-------------|----------|:---:|:---:|
| **OVERLAY** | Adding/updating safety rules, tuning ambition params | Zero | Low | Single admin |
| **RESET** | Changing Hilbert dimension, major version upgrade | ~30s queued | Medium | Two-person (prod) |
| **SHADOW** | Testing new firmware against live traffic | Zero | Low | Single admin |
| **EMERGENCY** | Safety incident, suspected Helix bypass | Zero | N/A | Any admin (post-hoc review) |

**Decision Tree:**

1. Is there a safety incident right now? → **EMERGENCY**
2. Are you changing Hilbert dimension or unitarity mode? → **RESET** (schedule maintenance window)
3. Is this production with live users? → **SHADOW** first, validate, then **OVERLAY**
4. Dev/staging environment? → **OVERLAY** directly

### 3. Standard Operating Procedures

#### 3.1 Deploy New Firmware (OVERLAY)

**Pre-Flight:**

```bash
# Check brain status
curl -s https://api.radiant.example/api/v2/omega/status | jq '.active_streams, .firmware_hash'
# Should return: active_streams = 0 (or low), firmware_hash = current hash
```

**Steps:**

1. Open **OMEGA Forge** → Firmware Library
2. Click **"New Firmware"** or clone existing
3. Edit Helix Rules, Ambition Settings, or Personality as needed
4. Click **"Validate"** — all checks must pass (green)
5. Click **"Sign"** — requires your admin credentials + KMS signing
6. Click **"Activate"** → Select **OVERLAY** mode
7. Confirm in the modal (re-authentication required in prod per FDA Part 11)
8. Monitor the **Swap Timeline** widget for completion (~5s)

**Post-Deploy Verification:**

```bash
# Confirm new hash loaded
curl -s https://api.radiant.example/api/v2/omega/status | jq '.firmware_hash'

# Check swap log
curl -s https://api.radiant.example/api/v2/firmware/swaps?limit=1 | jq '.'
# Expected: status = "success", duration_ms < 5000
```

#### 3.2 Shadow Test Before Production Deploy

1. Deploy firmware with **SHADOW** mode
2. Shadow brain processes requests in parallel — does NOT serve users
3. Monitor **Coherence Score** in OMEGA Forge Dashboard (target: >90% over 7 days)
4. When score crosses threshold, the **"Promote to Production"** button unlocks
5. Click Promote → triggers OVERLAY swap from shadow to primary

#### 3.3 Emergency Lockdown

If you suspect a Helix bypass or safety failure:

```bash
curl -X POST https://api.radiant.example/api/v2/firmware/emergency \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"brain_id": "uuid-here", "reason": "Suspected Helix bypass on tenant-xyz"}'
```

This immediately loads **platform default firmware** (maximum safety, minimal capabilities). Post-incident review required within 24 hours.

#### 3.4 Rollback

```bash
curl -X POST https://api.radiant.example/api/v2/firmware/{firmware-id}/rollback \
  -H "Authorization: Bearer $ADMIN_TOKEN"
```

Or in OMEGA Forge: Firmware Library → click the superseded firmware → **"Rollback to This Version"**

**Automatic rollback triggers:**

- Post-swap error rate > 10% within 5 minutes
- Post-swap latency increase > 50%
- Any Helix verification failure during self-test

### 4. Infrastructure Requirements

#### 4.1 Storage

| Layer | Service | Purpose | Monitoring |
|-------|---------|---------|------------|
| Hot State | AWS EFS (`/mnt/omega_state`) | Active brain state, sub-ms access | `df -h`, CloudWatch EFS metrics |
| Snapshots | AWS S3 (`s3://radiant-omega-snapshots-{env}`) | Pre-swap rollback snapshots | S3 lifecycle policies |
| Metadata | Aurora PostgreSQL | Firmware records, swap logs, audit trail | RDS Performance Insights |
| Swap Lock | DynamoDB | Distributed lock (5-min TTL) | DynamoDB metrics |

#### 4.2 KMS Keys

| Key | Purpose | Rotation | Deletion Policy |
|-----|---------|----------|-----------------|
| Platform Root CA | Signs tenant CAs | Manual only (asymmetric) | RETAIN in prod |
| Tenant CA Keys | Signs firmware/cartridges | Manual only | 30-day pending (prod) |
| Signing Keys | Per-purpose signing | Manual only | 7-day pending (dev) |

**Check key health:**

```bash
aws kms describe-key --key-id alias/radiant-{env}-cartridge-signing | jq '.KeyMetadata.KeyState'
# Expected: "Enabled"
```

#### 4.3 IAM Permissions Required

Lambda execution role needs:

- `kms:Sign`, `kms:Verify`, `kms:GetPublicKey`, `kms:DescribeKey` on platform signing key
- `kms:CreateKey`, `kms:TagResource`, `kms:CreateAlias` for tenant key creation
- EFS read/write on `/mnt/omega_state`
- S3 read/write on snapshot bucket

### 5. Monitoring & Alerts

#### 5.1 CloudWatch Dashboards

| Dashboard | Key Metrics |
|-----------|-------------|
| OMEGA Brain Health | Coherence score, inference latency, error rate, active streams |
| Firmware Status | Current firmware version, swap count (24h), rollback count |
| Helix Safety | Rule activation count, blocked vector count, bypass attempts |
| Ambition | Entropy level, dopamine level, dream cycle triggers |

#### 5.2 Alert Thresholds

| Alert | Condition | Severity | Action |
|-------|-----------|----------|--------|
| Swap Duration High | > 30 seconds | WARNING | Investigate, check EFS latency |
| Swap Failed | status = 'failed' | CRITICAL | Check logs, may need manual rollback |
| Auto-Rollback Triggered | Post-swap error > 10% | CRITICAL | Review firmware, investigate root cause |
| Helix Bypass Attempt | Any forbidden vector not cancelled | CRITICAL | EMERGENCY mode immediately |
| EFS Unhealthy | Mount failure or > 10ms latency | CRITICAL | Brain cannot persist state |
| Firmware Lock Stuck | Lock held > 5 minutes | WARNING | Check for crashed swap, release manually |

#### 5.3 Log Locations

| Log | Location | Key Fields |
|-----|----------|------------|
| Swap events | CloudWatch `/radiant/omega/firmware-swaps` | swap_mode, duration_ms, status |
| Helix activations | CloudWatch `/radiant/omega/helix` | rule_id, blocked_vector, severity |
| Audit trail | PostgreSQL `pki_audit_log` | operation, key_id, tenant_id, timestamp |

### 6. CORTEX Network Hot-Swap (Nightly CATO Cycle)

Separate from firmware, the 6 CORTEX neural networks update nightly at 2am UTC:

| Time | Phase | What Happens |
|------|-------|--------------|
| 02:00 | INVENTION | Generate novel patterns (30% min budget, enforced) |
| 02:30 | EVOLUTION | PromptBreeder mutations, fitness selection |
| 03:00 | TRAINING | PyTorch training on ml.g5.xlarge |
| 03:30 | DEPLOYMENT | ONNX export → S3 upload → atomic pointer swap on inference nodes |

**Verify CATO ran successfully:**

```bash
aws s3 ls s3://radiant-cortex-models-{env}/pattern_network/ --recursive | tail -5
aws s3 cp s3://radiant-cortex-models-{env}/pattern_network/latest_version.txt -
```

### 7. Troubleshooting

#### Firmware swap stuck (lock not releasing)

```bash
# Check DynamoDB for stale lock
aws dynamodb get-item --table-name radiant-{env}-firmware-locks \
  --key '{"brain_id": {"S": "uuid-here"}}'

# If lock TTL expired, it auto-releases. If stuck, delete manually:
aws dynamodb delete-item --table-name radiant-{env}-firmware-locks \
  --key '{"brain_id": {"S": "uuid-here"}}'
```

#### Brain not detecting new firmware

1. Check `omega_brain_states.firmware_hash` was actually updated
2. Check Lambda is reading from correct Aurora instance (not a stale reader)
3. Force a brain cycle: send a test inference request

#### Helix self-test failing after swap

The firmware's Helix Rules are malformed. Check:

- All forbidden vectors have unit magnitude (|v| = 1.0)
- No duplicate rule IDs
- Schema version matches brain compatibility range
- Rollback to previous firmware and fix the .bio file

#### EFS mount failure

```bash
df -h /mnt/omega_state

# If unmounted, remount:
sudo mount -t efs fs-{id}:/ /mnt/omega_state

# If EFS is completely down, brain falls back to S3 snapshots
# (up to 100 inference cycles of data loss)
```

#### KMS signing failures

```bash
aws kms describe-key --key-id alias/radiant-{env}-cartridge-signing
aws iam simulate-principal-policy \
  --policy-source-arn arn:aws:iam::role/radiant-lambda-execution \
  --action-names kms:Sign kms:Verify
```

### 8. Emergency Contacts

| Situation | Action |
|-----------|--------|
| Swap stuck > 5 minutes | Release lock manually, check CloudWatch |
| Suspected Helix bypass | Trigger EMERGENCY mode immediately |
| Brain state corruption | Restore from S3 snapshot (`aws s3 cp s3://radiant-omega-snapshots-{env}/brain-{id}/latest/brain.pt /mnt/omega_state/brain.pt`) |
| KMS key compromised | Revoke key, rotate, re-sign all active firmware |
| Multiple auto-rollbacks | Disable CATO nightly cycle, investigate training data |

### 9. Maintenance Calendar

| Task | Frequency | Owner |
|------|-----------|-------|
| Review firmware swap logs | Weekly | DevOps |
| Verify snapshot retention | Monthly | DevOps |
| KMS key health check | Monthly | Security |
| CATO training review | Weekly | ML Engineering |
| Helix rule audit | Quarterly | Security + Compliance |
| Disaster recovery drill | Quarterly | DevOps + Engineering |

---

*Consolidated from 10 source documents (0 not found). 3,035 source lines.*
