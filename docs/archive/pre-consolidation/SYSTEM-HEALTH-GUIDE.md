# RADIANT System Health Monitoring Guide

**Version**: 7.2.0  
**Last Updated**: February 4, 2026  
**Audience**: Platform Administrators, DevOps Engineers

---

## Table of Contents

1. [Overview](#1-overview)
2. [Understanding the Dashboard](#2-understanding-the-dashboard)
3. [Components Monitored](#3-components-monitored)
4. [Health Status Indicators](#4-health-status-indicators)
5. [Alerts System](#5-alerts-system)
6. [LiteLLM Gateway Health](#6-litellm-gateway-health)
7. [Metrics Reference](#7-metrics-reference)
8. [Uptime Tracking](#8-uptime-tracking)
9. [API Reference](#9-api-reference)
10. [Troubleshooting](#10-troubleshooting)
11. [Configuration](#11-configuration)
12. [Best Practices](#12-best-practices)

---

## 1. Overview

RADIANT provides a **two-tier health monitoring system**:

| Tier | Audience | URL | Detail Level |
|------|----------|-----|--------------|
| **Public Status Page** | End users, customers | `https://status.{your-domain}` | Badges only |
| **Admin Health Dashboard** | Platform administrators | `https://{your-domain}/admin/health` | Full CloudWatch metrics |

### Two-Tier Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                     PUBLIC STATUS PAGE                               │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐                 │
│  │ API Gateway │  │  Database   │  │   Cache     │   ...           │
│  │ ✅ Operational│  │ ✅ Operational│  │ ✅ Operational│                 │
│  └─────────────┘  └─────────────┘  └─────────────┘                 │
│                                                                      │
│  Simple status badges - no detailed metrics exposed                 │
└─────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────┐
│                    ADMIN HEALTH DASHBOARD                            │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │ Aurora PostgreSQL                          Healthy           │   │
│  │ CPU: 45%  │  Memory: 62%  │  Connections: 127  │  IOPS: 1.2k │   │
│  │ Latency: 12ms  │  Error Rate: 0%  │  Last Check: 2s ago     │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                                                                      │
│  Full CloudWatch metrics, alerts, SLA compliance, configuration     │
└─────────────────────────────────────────────────────────────────────┘
```

### Purpose

| Goal | Description |
|------|-------------|
| **Public Transparency** | Show customers system status without exposing internals |
| **Admin Visibility** | Full CloudWatch metrics for troubleshooting |
| **Early Warning** | Detect issues before they impact users |
| **Historical Context** | Track uptime and incident history |
| **Rapid Response** | Enable quick acknowledgment and resolution of alerts |

### Access

| Page | URL | Permissions |
|------|-----|-------------|
| **Public Status** | `https://status.{your-domain}` | None (public) |
| **Admin Health** | `https://{your-domain}/admin/health` | Admin role required |

### Multi-Datacenter Support

Both pages provide visibility into all datacenters across three geographic regions:

| Region | Datacenters | Primary Region |
|--------|-------------|----------------|
| **Americas** | us-east-1, us-west-2 | us-east-1 (N. Virginia) |
| **Europe** | eu-west-1, eu-central-1 | eu-west-1 (Ireland) |
| **Asia Pacific** | ap-northeast-1, ap-southeast-1, ap-south-1 | ap-northeast-1 (Tokyo) |

#### Global Aggregate View

By default, both pages show a **global aggregate status** that combines health from all datacenters:
- The aggregate status shows the worst-case status across all regions
- Users don't see which specific datacenter has an issue until they drill down
- This provides a simple "is the platform healthy?" answer

#### Datacenter Drill-Down

Users can click on a specific datacenter to see:
- Region-specific component health
- Alerts filtered to that datacenter
- Uptime metrics for that region
- CloudWatch metrics from that region's AWS resources (admin only)

```
┌─────────────────────────────────────────────────────────────┐
│  Region: [Global ✓] [Americas ●] [Europe ●] [Asia Pacific ●]  │
├─────────────────────────────────────────────────────────────┤
│  Overall Status: ✅ Operational                              │
│                                                              │
│  Click a region to see datacenter-specific health details   │
└─────────────────────────────────────────────────────────────┘
```

---

## 2. Understanding the Dashboard

### Overall Status Banner

At the top of the dashboard, you'll see the overall system status:

| Status | Icon | Meaning |
|--------|------|---------|
| **Healthy** | ✅ Green checkmark | All components operating normally |
| **Degraded** | ⚠️ Yellow triangle | One or more components experiencing issues |
| **Unhealthy** | ❌ Red X | Critical component failure |

The overall status is calculated as:
- **Unhealthy**: Any component is unhealthy
- **Degraded**: Any component is degraded (but none unhealthy)
- **Healthy**: All components are healthy

### Key Metrics Display

| Metric | Description |
|--------|-------------|
| **Services Healthy** | Count of healthy vs. total services (e.g., "6/8 services healthy") |
| **Uptime (30 days)** | Percentage availability over the last 30 days |
| **Last Incident** | Time since the most recent incident |

### Service Grid

Each monitored service is displayed as a card showing:
- **Service Name**: The component being monitored
- **Status Badge**: Current health status
- **Latency**: Current response time in milliseconds
- **Last Check**: When the health check last ran

**Click any service card** to open the detailed drill-down view.

---

## 3. Components Monitored

### Infrastructure Components

| Component | Display Name | What It Monitors |
|-----------|--------------|------------------|
| `litellm_gateway` | LiteLLM Gateway | ECS service running the AI model proxy |
| `aurora_postgresql` | Aurora PostgreSQL | Primary database cluster |
| `elasticache_redis` | ElastiCache Redis | Caching layer for sessions and data |
| `lambda_chat` | Lambda Chat | Chat Lambda function performance |
| `api_gateway` | API Gateway | REST API endpoints |
| `cognito_user_pool` | Cognito User Pool | End-user authentication |
| `cognito_admin_pool` | Cognito Admin Pool | Admin authentication |
| `s3_storage` | S3 Storage | Object storage buckets |
| `sqs_queues` | SQS Queues | Message queue processing |

### Data Sources

| Source | Components | Refresh Rate |
|--------|------------|--------------|
| **CloudWatch** | ECS, Lambda, RDS, ElastiCache | 60 seconds |
| **ECS API** | Running/desired task counts | 60 seconds |
| **Database** | API Gateway, Cognito, S3, SQS | 60 seconds |

---

## 4. Health Status Indicators

### Status Definitions

| Status | Color | Criteria |
|--------|-------|----------|
| **Healthy** | 🟢 Green | All metrics within normal thresholds |
| **Degraded** | 🟡 Yellow | Elevated metrics but service functional |
| **Unhealthy** | 🔴 Red | Service unavailable or critical failure |

### Threshold Examples

| Component | Healthy | Degraded | Unhealthy |
|-----------|---------|----------|-----------|
| **LiteLLM Gateway** | CPU < 90%, running = desired | CPU ≥ 90% OR running < desired | 0 running tasks |
| **Aurora PostgreSQL** | CPU < 85% | CPU ≥ 85% | Connection failures |
| **ElastiCache Redis** | Memory < 85% | Memory ≥ 85% | Evictions occurring |
| **Lambda Chat** | Error rate < 5% | Error rate ≥ 5% | Error rate ≥ 20% |

---

## 5. Alerts System

### Alert Severities

| Severity | Icon | Response Time | Examples |
|----------|------|---------------|----------|
| **Critical** | 🔴 | Immediate | Service down, database unavailable |
| **Warning** | 🟡 | Within 1 hour | High CPU, elevated latency |
| **Info** | 🔵 | As needed | Scheduled maintenance, capacity changes |

### Alert Lifecycle

```
Triggered → Active → Acknowledged → Resolved
```

1. **Triggered**: Alert condition met, notification sent
2. **Active**: Alert visible in dashboard, awaiting response
3. **Acknowledged**: Admin has seen and is investigating
4. **Resolved**: Condition returned to normal or manually resolved

### Acknowledging Alerts

1. Navigate to **Health** → **Alerts** tab
2. Find the active alert
3. Click **Acknowledge**
4. The alert will show who acknowledged it and when

### Alert Data Structure

| Field | Description |
|-------|-------------|
| `severity` | critical, warning, or info |
| `component` | Which service triggered the alert |
| `metric` | The specific metric that exceeded threshold |
| `message` | Human-readable description |
| `currentValue` | Actual value that triggered the alert |
| `threshold` | The configured threshold value |
| `triggeredAt` | When the alert was created |
| `acknowledgedAt` | When someone acknowledged it |
| `acknowledgedBy` | User ID who acknowledged |
| `resolvedAt` | When the alert was resolved |

---

## 6. LiteLLM Gateway Health

The LiteLLM Gateway is a critical component that routes AI model requests. It has its own dedicated health section.

### Gateway Status View

| Metric | Description |
|--------|-------------|
| **Running Tasks** | Number of ECS tasks currently running |
| **Desired Tasks** | Target task count for auto-scaling |
| **Healthy Targets** | Tasks passing health checks |
| **Unhealthy Targets** | Tasks failing health checks |
| **CPU Utilization** | Average CPU across all tasks |
| **Memory Utilization** | Average memory across all tasks |
| **Requests/Second** | Current request throughput |
| **Latency P50/P99** | 50th and 99th percentile response times |
| **Error Rate** | Percentage of failed requests |

### AI Provider Status

Each AI provider connected through LiteLLM is monitored:

| Provider | Models | Metrics Tracked |
|----------|--------|-----------------|
| **OpenAI** | gpt-4o, gpt-4o-mini | Latency, error rate, availability |
| **Anthropic** | claude-3-5-sonnet, claude-3-opus | Latency, error rate, availability |
| **Google** | gemini-2.0-flash, gemini-1.5-pro | Latency, error rate, availability |

### Gateway Configuration

Administrators can view and modify gateway settings:

| Setting | Default | Description |
|---------|---------|-------------|
| **Min Tasks** | 2 | Minimum ECS tasks |
| **Max Tasks** | 50 | Maximum ECS tasks |
| **Target CPU** | 70% | Scale-out CPU threshold |
| **Target Memory** | 80% | Scale-out memory threshold |
| **Requests/Target** | 1000 | Requests before scaling |
| **Scale-Out Cooldown** | 60s | Wait between scale-out events |
| **Scale-In Cooldown** | 300s | Wait between scale-in events |
| **Health Check Path** | /health | ECS health check endpoint |
| **Health Check Interval** | 30s | Time between checks |
| **Global Rate Limit** | 10,000/s | Platform-wide request limit |
| **Per-Tenant Rate Limit** | 1,000/min | Per-organization limit |
| **Response Caching** | Enabled | Cache identical requests |
| **Cache TTL** | 3600s | Cache expiration |
| **Max Retries** | 3 | Failed request retry count |
| **Request Timeout** | 600s | Maximum request duration |

---

## 7. Metrics Reference

### ECS Metrics (LiteLLM Gateway)

| Metric | Source | Unit | Good | Concerning |
|--------|--------|------|------|------------|
| CPU Utilization | CloudWatch | % | < 70 | > 90 |
| Memory Utilization | CloudWatch | % | < 70 | > 85 |
| Running Tasks | ECS API | count | = desired | < desired |

### Aurora PostgreSQL Metrics

| Metric | Source | Unit | Good | Concerning |
|--------|--------|------|------|------------|
| CPU Utilization | CloudWatch | % | < 60 | > 85 |
| Database Connections | CloudWatch | count | < 80% max | > 90% max |
| Read IOPS | CloudWatch | ops/s | Stable | Spiking |

### ElastiCache Redis Metrics

| Metric | Source | Unit | Good | Concerning |
|--------|--------|------|------|------------|
| CPU Utilization | CloudWatch | % | < 60 | > 80 |
| Memory Used | CloudWatch | % | < 70 | > 85 |
| Cache Hit Rate | CloudWatch | % | > 95 | < 80 |

### Lambda Metrics

| Metric | Source | Unit | Good | Concerning |
|--------|--------|------|------|------------|
| Invocations | CloudWatch | count | Stable | -50% drop |
| Errors | CloudWatch | count | 0 | Any |
| Concurrent Executions | CloudWatch | count | < 80% limit | > 90% limit |
| Error Rate | Calculated | % | < 1% | > 5% |

---

## 8. Uptime Tracking

### Uptime Periods

| Period | Description |
|--------|-------------|
| **24 Hours** | Rolling 24-hour availability |
| **7 Days** | Rolling 7-day availability |
| **30 Days** | Rolling 30-day availability |

### SLA Targets

| Tier | Target | Max Downtime/Month |
|------|--------|-------------------|
| **SEED** | 99.5% | ~3.6 hours |
| **STARTER** | 99.9% | ~43 minutes |
| **GROWTH** | 99.95% | ~22 minutes |
| **SCALE** | 99.99% | ~4.3 minutes |
| **ENTERPRISE** | 99.99% | ~4.3 minutes |

### How Uptime Is Calculated

Uptime is calculated from CloudWatch alarm history. A service is considered "up" when:
1. Health checks are passing
2. Error rate is below threshold
3. Response latency is acceptable

---

## 9. API Reference

### Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/admin/system/health` | Full health dashboard |
| `GET` | `/api/admin/system/health/components` | Component health list |
| `GET` | `/api/admin/system/health/alerts` | Active alerts |
| `POST` | `/api/admin/system/health/alerts/:id/acknowledge` | Acknowledge alert |
| `GET` | `/api/admin/system/gateway` | LiteLLM Gateway status |
| `GET` | `/api/admin/system/gateway/config` | Gateway configuration |
| `PUT` | `/api/admin/system/gateway/config` | Update gateway config |

### Response: Health Dashboard

```json
{
  "generatedAt": "2026-02-04T14:30:00Z",
  "overallStatus": "healthy",
  "components": [...],
  "activeAlerts": [...],
  "recentIncidents": [...],
  "uptimePercent24h": 100,
  "uptimePercent7d": 99.98,
  "uptimePercent30d": 99.95
}
```

### Response: Component Health

```json
{
  "component": "litellm_gateway",
  "displayName": "LiteLLM Gateway",
  "status": "healthy",
  "currentCapacity": 4,
  "maxCapacity": 50,
  "utilizationPercent": 45,
  "latencyMs": 45,
  "errorRate": 0.001,
  "lastChecked": "2026-02-04T14:30:00Z",
  "metrics": [
    { "name": "CPU Utilization", "value": 45, "unit": "%", "trend": "stable" },
    { "name": "Memory Utilization", "value": 62, "unit": "%", "trend": "stable" },
    { "name": "Running Tasks", "value": 4, "unit": "", "trend": "stable" }
  ]
}
```

---

## 10. Troubleshooting

### Component Shows "Degraded"

1. **Check the specific metrics** - Click the component card for details
2. **Review recent alerts** - Look for threshold violations
3. **Check CloudWatch** - View raw metrics in AWS Console
4. **Scale if needed** - Increase capacity via gateway config

### Component Shows "Unhealthy"

1. **Check ECS/Lambda logs** - Look for errors in CloudWatch Logs
2. **Verify dependencies** - Database, cache, external APIs
3. **Check AWS service health** - https://status.aws.amazon.com
4. **Review recent deployments** - Rollback if necessary

### High Latency

| Component | Common Causes | Solutions |
|-----------|---------------|-----------|
| **LiteLLM** | AI provider slow | Check provider status, enable fallback |
| **Database** | Complex queries | Review slow query log, add indexes |
| **Redis** | Memory pressure | Increase node size, review TTLs |
| **Lambda** | Cold starts | Increase provisioned concurrency |

### Alerts Not Appearing

1. Verify alert thresholds are configured in database
2. Check `system_alerts` table for recent entries
3. Review Lambda logs for errors in alert processing
4. Ensure CloudWatch alarms are properly configured

---

## 11. Configuration

### Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `ECS_CLUSTER_NAME` | ECS cluster to monitor | `radiant-prod-litellm` |
| `ECS_SERVICE_NAME` | ECS service name | `radiant-prod-litellm` |
| `DB_CLUSTER_ID` | Aurora cluster identifier | `radiant-prod-aurora` |
| `REDIS_CLUSTER_ID` | ElastiCache cluster ID | `radiant-prod-redis` |

### Database Tables

| Table | Purpose |
|-------|---------|
| `system_component_health` | Stores component status for non-CloudWatch sources |
| `system_alerts` | Active and historical alerts |
| `litellm_gateway_config` | Gateway configuration settings |
| `configuration_audit_log` | Tracks config changes |

### Auto-Refresh

The health dashboard automatically refreshes every **30 seconds**. You can also click the **Refresh** button for an immediate update.

---

## 12. Best Practices

### Monitoring

1. **Check daily** - Review dashboard each morning
2. **Set up notifications** - Configure Slack/email for critical alerts
3. **Establish baselines** - Know what "normal" looks like for your deployment
4. **Review trends** - Look for gradual degradation, not just failures

### Alert Management

1. **Acknowledge promptly** - Shows the team someone is investigating
2. **Don't ignore warnings** - They often precede critical issues
3. **Document resolutions** - Record what fixed each alert type
4. **Tune thresholds** - Adjust to reduce noise while catching issues

### Capacity Planning

1. **Monitor utilization trends** - Scale before hitting limits
2. **Review during business hours** - Peak usage varies
3. **Plan for growth** - Budget for increased AI usage
4. **Test failover** - Verify redundancy works

### Incident Response

1. **Prioritize by impact** - Focus on user-facing issues first
2. **Communicate status** - Update public status page if needed
3. **Root cause analysis** - Understand why incidents happen
4. **Improve monitoring** - Add checks for new failure modes

---

## Document Information

| Field | Value |
|-------|-------|
| **Document ID** | DOC-SYSTEM-HEALTH-001 |
| **Version** | 7.2.0 |
| **Status** | Published |
| **Owner** | Platform Team |
| **Last Updated** | February 4, 2026 |
| **Next Review** | May 4, 2026 |
