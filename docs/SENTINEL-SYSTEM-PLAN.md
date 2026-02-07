# RADIANT SENTINEL — Alerting, Monitoring & Incident Response System

> **Status**: RATIFIED — Approved for Engineering
> **Version**: 1.0.0 (Final)
> **Date**: 2026-02-07
> **Author**: RADIANT Engineering
> **Review Verdict**: Grade A- (Approved with 3 Critical Constraints)

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Design Principles](#2-design-principles)
3. [Severity Classification (SEV 1–5)](#3-severity-classification)
4. [Alert Dimensions & Categorization](#4-alert-dimensions--categorization)
5. [Notification Channels & Escalation Matrix](#5-notification-channels--escalation-matrix)
6. [Service Watchdog — "The Watcher"](#6-service-watchdog--the-watcher)
7. [Self-Healing & Auto-Remediation](#7-self-healing--auto-remediation)
8. [Dead Man's Switch — Who Watches the Watcher?](#8-dead-mans-switch--who-watches-the-watcher)
9. [On-Call Rotation & Incident Commander](#9-on-call-rotation--incident-commander)
10. [Incident Lifecycle & Playbooks](#10-incident-lifecycle--playbooks)
11. [Compliance & Regulatory Requirements](#11-compliance--regulatory-requirements)
12. [Metrics & SLAs](#12-metrics--slas)
13. [Architecture & AWS Infrastructure](#13-architecture--aws-infrastructure)
14. [Database Schema](#14-database-schema)
15. [Admin UI](#15-admin-ui)
16. [Status Page (Public)](#16-status-page-public)
17. [Implementation Phases](#17-implementation-phases)
18. [Open Questions for Review](#18-open-questions-for-review)

---

## 1. Executive Summary

SENTINEL is RADIANT's always-on alerting, monitoring, and incident response system. It provides:

- **Multi-dimensional alert classification** across 5 severity levels and 8+ categories
- **Service watchdog** that continuously monitors every AWS and RADIANT service with health checks, auto-restart, and verification
- **Multi-channel notifications** (SMS, email, phone call, Slack, PagerDuty, push, in-app) routed by severity and recipient role
- **Self-healing infrastructure** with automated remediation for known failure patterns
- **Dead Man's Switch** ensuring the monitoring system itself cannot silently fail
- **Compliance-aware alerting** that automatically escalates HIPAA/GDPR/SOC2 incidents to required personnel within regulatory timeframes
- **Incident lifecycle management** with playbooks, postmortems, and continuous improvement

### Why "SENTINEL"?

**S**ervice **E**ngineering **N**otification, **T**riage, **I**ncident **N**avigation, **E**scalation & **L**ifecycle

---

## 2. Design Principles

| # | Principle | Description |
|---|-----------|-------------|
| 1 | **Cannot go down** | SENTINEL itself is multi-region, multi-path, with independent fallback notification channels that don't share infrastructure with the monitored systems |
| 2 | **Alert fatigue prevention** | Intelligent deduplication, correlation, suppression during maintenance windows, and severity-appropriate routing — not everything pages someone at 3 AM |
| 3 | **Seconds matter at SEV 1** | Critical alerts reach humans via phone call within 60 seconds; auto-remediation starts immediately in parallel |
| 4 | **Defense in depth** | Multiple independent monitoring paths; if CloudWatch fails, synthetic monitors still detect; if SNS fails, direct SMS API still sends |
| 5 | **Compliance by default** | HIPAA breach notification (60 min internal), GDPR 72-hour window, SOC2 continuous monitoring — all built into the severity/escalation model |
| 6 | **Blameless postmortems** | Every SEV 1/2 gets a postmortem; focus on systemic improvements, not individual blame |
| 7 | **Observable** | SENTINEL's own health, alert volume, MTTD, MTTR, and escalation metrics are dashboarded and themselves monitored |

---

## 3. Severity Classification

### 3.1 Severity Levels (SEV 1–5)

Based on industry standards (Atlassian, PagerDuty, Google SRE):

| SEV | Name | Impact | Examples | Response Time | Resolution Target |
|-----|------|--------|----------|---------------|-------------------|
| **SEV 1** | **Critical** | Total service outage or data breach affecting all/most users | Platform down for all tenants; confirmed data breach; complete auth system failure; data corruption across tenants | **< 5 min** (auto-page) | **< 1 hour** |
| **SEV 2** | **Major** | Significant degradation or partial outage affecting subset of users | Single tenant fully down; AI model routing failing for 1+ providers; payment processing offline; single-region outage | **< 15 min** (auto-page) | **< 4 hours** |
| **SEV 3** | **Moderate** | Limited impact, workaround available, or non-user-facing system degraded | Elevated error rates (>5%); single non-critical Lambda failing; search indexer behind by 2+ hours; report generation stalled | **< 1 hour** (notification) | **< 24 hours** |
| **SEV 4** | **Low** | Minor issue, no immediate user impact | Elevated latency within SLA; non-critical background job delayed; disk usage >80%; certificate expiring in 30 days | **< 4 hours** (queue) | **< 1 week** |
| **SEV 5** | **Informational** | Awareness only, no action required | Deployment completed; scheduled maintenance reminder; usage approaching quota; performance anomaly detected | Next business day | As needed |

### 3.2 Severity Auto-Classification Rules

Alerts are auto-classified based on a scoring matrix:

```
severity = f(user_impact, blast_radius, data_risk, compliance_trigger, duration)
```

| Factor | Weight | SEV 1 Threshold | SEV 2 Threshold |
|--------|--------|-----------------|-----------------|
| **User Impact** | 30% | All users affected | >10% of users |
| **Blast Radius** | 20% | All regions/tenants | Single region or >5 tenants |
| **Data Risk** | 25% | Confirmed breach/loss | Potential exposure |
| **Compliance Trigger** | 15% | HIPAA/GDPR breach | Audit log gap |
| **Duration** | 10% | >5 min total outage | >15 min degradation |

Any single factor at SEV 1 threshold → auto-escalate to SEV 1 regardless of score.

---

## 4. Alert Dimensions & Categorization

### 4.1 Primary Categories

| Category | Icon | Description | Examples |
|----------|------|-------------|----------|
| **Infrastructure** | 🏗️ | AWS resource health, capacity, connectivity | EC2/ECS down, RDS failover, S3 errors, VPC issues |
| **Security** | 🔒 | Auth failures, breaches, anomalous access | Brute force, privilege escalation, data exfiltration, WAF triggers |
| **Compliance** | 📋 | Regulatory requirement violations | Audit log gaps, retention policy violation, encryption failure, PHI exposure |
| **Application** | ⚙️ | RADIANT service errors and performance | Lambda errors, API 5xx rate, timeout spikes, memory leaks |
| **AI/Model** | 🤖 | Model availability, cost, quality | Provider outage, cost spike, hallucination rate, token budget exceeded |
| **Data** | 💾 | Database, storage, replication | Replication lag, connection pool exhaustion, migration failure, backup failure |
| **Billing** | 💰 | Payment and cost anomalies | Payment failure, AWS cost spike >200%, credit balance critical |
| **Performance** | ⚡ | Latency, throughput, capacity | P99 latency >2s, request queue depth, thread pool exhaustion |
| **Availability** | 🌐 | Uptime, health checks, synthetic monitors | Health check failure, synthetic monitor down, SSL cert expiry |
| **Tenant** | 🏢 | Per-tenant issues | Single tenant degraded, tenant data isolation concern, tenant-specific errors |

### 4.2 Secondary Dimensions

Each alert is additionally tagged with:

| Dimension | Values | Purpose |
|-----------|--------|---------|
| **Environment** | production, staging, development | Only production alerts page; staging alerts notify Slack |
| **Region** | us-east-1, us-west-2, eu-west-1, etc. | Region-specific routing and blast radius assessment |
| **Service** | Think Tank, Curator, Dojo, Genesis, Gateway, Admin, Lambda/* | Which RADIANT service is affected |
| **Tenant Scope** | all, multi (list), single (id), none | Blast radius for tenant impact |
| **Compliance Context** | hipaa, gdpr, soc2, pci-dss, fedramp, none | Triggers compliance-specific escalation paths |
| **Recurrence** | first_occurrence, recurring (count), flapping | Prevents duplicate pages; escalates recurring issues |
| **Auto-Remediation Status** | not_applicable, attempted, succeeded, failed | Did self-healing already try? |

---

## 5. Notification Channels & Escalation Matrix

### 5.1 Available Channels

| Channel | Latency | Reliability | Use Case | Provider |
|---------|---------|-------------|----------|----------|
| **Phone Call** | < 30s | Very High | SEV 1 only — wake people up | PagerDuty / Twilio |
| **SMS** | < 60s | High | SEV 1–2 — immediate awareness | AWS SNS / Twilio |
| **Push Notification** | < 30s | High | SEV 1–3 — mobile on-call app | PagerDuty / custom |
| **Slack/Teams** | < 5s | High | SEV 1–4 — team coordination | Slack API |
| **Email** | < 2 min | Medium | SEV 2–5 — detailed context, non-urgent | AWS SES |
| **In-App Banner** | Real-time | High | SEV 1–3 — admin dashboard notification | WebSocket/SSE |
| **Status Page** | < 5 min | High | SEV 1–3 — public customer communication | Custom / Statuspage.io |
| **Webhook** | < 5s | Medium | All — integration with external systems | Custom |

### 5.2 Escalation Matrix

Who gets notified, through which channels, at each severity:

| Severity | Immediate (< 1 min) | Short (< 15 min) | Escalation (if unack'd) |
|----------|---------------------|-------------------|-------------------------|
| **SEV 1** | On-call engineer: **Phone + SMS + Push** | Engineering lead: **Phone + SMS**; CTO: **SMS**; All engineers: **Slack** | 5 min → Engineering Lead phone; 15 min → CTO phone; 30 min → CEO SMS |
| **SEV 2** | On-call engineer: **SMS + Push + Slack** | Engineering lead: **Slack + Email** | 15 min → Engineering Lead SMS; 30 min → CTO Slack |
| **SEV 3** | On-call engineer: **Push + Slack** | Team: **Slack** | 1 hour → Engineering Lead Slack; 4 hours → auto-create Jira |
| **SEV 4** | Slack channel only | — | 24 hours → auto-create Jira ticket |
| **SEV 5** | Slack channel (low priority) + Email digest | — | — |

### 5.3 Compliance-Triggered Escalation Overrides

| Compliance Context | Additional Notifications | Regulatory Deadline |
|--------------------|--------------------------|---------------------|
| **HIPAA** (confirmed PHI breach) | Privacy Officer: **Phone + Email** within 15 min; Legal: **Email** within 30 min | 60 days to HHS (but internal escalation within 1 hour) |
| **GDPR** (personal data breach) | DPO: **Phone + Email** within 30 min; Legal: **Email** within 1 hour | 72 hours to supervisory authority |
| **SOC2** (control failure) | Compliance team: **Email** within 1 hour; Auditor notification within 24 hours | Continuous monitoring — must be documented |
| **PCI-DSS** (cardholder data) | Security team: **Phone** within 15 min; Acquiring bank notification | 24-72 hours depending on card brand |

### 5.4 Alert Routing Rules (Per-Admin Preferences)

Each admin user configures their preferences:

```typescript
interface AdminAlertPreferences {
  userId: string;
  // What they care about
  subscribedCategories: AlertCategory[];     // e.g., ['security', 'compliance', 'infrastructure']
  subscribedServices: string[];              // e.g., ['think-tank', 'gateway']
  minimumSeverity: 1 | 2 | 3 | 4 | 5;      // Only alert me for SEV ≤ this
  
  // How to reach them
  channels: {
    phone: string | null;                    // +1-555-... (SEV 1-2 only)
    sms: string | null;                      // +1-555-...
    email: string;                           // required
    slack: string | null;                    // @user or channel
    pushEnabled: boolean;                    // mobile app push
  };
  
  // When to reach them
  onCallSchedule: OnCallSchedule | null;     // null = always notify per preferences
  quietHours: { start: string; end: string } | null;  // Quiet hours (SEV 1 overrides)
  timezone: string;                          // For schedule interpretation
}
```

---

## 6. Service Watchdog — "The Watcher"

### 6.1 What Gets Watched

Every service in the RADIANT ecosystem is monitored:

#### AWS Managed Services

| Service | Health Check Method | Frequency | Auto-Remediation |
|---------|--------------------|-----------|--------------------|
| **Aurora PostgreSQL** | Connection pool test + read/write probe | 30s | Failover to read replica; connection pool restart |
| **Lambda Functions** (all 118+) | CloudWatch error rate + duration anomaly | Continuous | Redeploy from last-known-good; increase concurrency |
| **API Gateway** | Synthetic HTTP request to /health | 30s | Failover to backup gateway; cache responses |
| **S3** | HeadBucket + GetObject test | 60s | Switch to cross-region replica bucket |
| **CloudFront** | Synthetic edge request | 60s | Invalidate + origin failover |
| **Cognito** | Auth token test | 60s | Cache valid tokens; extend session TTL |
| **ElastiCache** | PING + GET/SET test | 15s | Failover to replica; rebuild from Aurora |
| **DynamoDB** | Read/Write test item | 30s | Switch to Aurora fallback |
| **SQS** | Queue depth + message age | 30s | Dead-letter redirect; increase consumers |
| **EventBridge** | Rule execution confirmation | 60s | Direct Lambda invocation fallback |
| **KMS** | Decrypt test | 60s | Cache data keys locally (short TTL) |
| **SES** | Send test email | 5 min | Failover to Twilio/SendGrid |
| **SNS** | Publish test message | 60s | Direct Twilio SMS; direct SES email |

#### RADIANT Application Services

| Service | Health Check | Frequency | Auto-Remediation |
|---------|-------------|-----------|-------------------|
| **Think Tank (consumer)** | `/api/health` + synthetic prompt test | 30s | ECS task restart; traffic shift to healthy tasks |
| **Think Tank Admin** | `/api/health` + admin dashboard load test | 30s | ECS restart |
| **Curator** | `/api/health` + search test | 30s | ECS restart |
| **Dojo** | `/api/health` + arena load test | 30s | ECS restart |
| **Genesis** | `/api/health` + generation test | 60s | ECS restart |
| **Gateway (Go)** | `/healthz` + WebSocket echo | 15s | Container restart; traffic drain |
| **LiteLLM Proxy** | `/health` + model availability | 30s | Restart proxy; failover to direct API calls |
| **Log Indexer** | Last successful run < 2 hours | 5 min | Manual Lambda trigger; alert if 2x consecutive failure |
| **Cato Pipeline** | Queue depth + execution age | 60s | Restart stuck executions; DLQ redirect |
| **Billing Metering** | DynamoDB write test + SQS depth | 60s | Buffer to SQS; replay from event log |
| **Egress Proxy** | Outbound HTTP test | 30s | Direct outbound fallback |

#### AI Model Providers (External)

| Provider | Health Check | Frequency | Fallback |
|----------|-------------|-----------|----------|
| **OpenAI** | GET /models + chat completion test | 60s | Anthropic → Google → self-hosted |
| **Anthropic** | GET /messages test | 60s | OpenAI → Google → self-hosted |
| **Google (Gemini)** | Completion test | 60s | Anthropic → OpenAI → self-hosted |
| **AWS Bedrock** | InvokeModel test | 60s | Direct provider APIs |
| **Self-hosted (SageMaker)** | InvokeEndpoint test | 30s | External providers |

### 6.2 Watchdog Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    SENTINEL WATCHDOG                         │
│                                                             │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐     │
│  │  CloudWatch   │  │  Synthetic   │  │  Custom       │     │
│  │  Alarms       │  │  Canaries    │  │  Health       │     │
│  │  (AWS native) │  │  (external)  │  │  Lambdas      │     │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘     │
│         │                  │                  │              │
│         ▼                  ▼                  ▼              │
│  ┌──────────────────────────────────────────────────┐      │
│  │            Alert Correlation Engine               │      │
│  │  (dedup, group, score severity, enrich context)   │      │
│  └──────────────────────┬───────────────────────────┘      │
│                         │                                    │
│         ┌───────────────┼───────────────┐                   │
│         ▼               ▼               ▼                   │
│  ┌────────────┐  ┌────────────┐  ┌────────────┐           │
│  │ Auto-Heal  │  │ Notify     │  │ Incident   │           │
│  │ Engine     │  │ Router     │  │ Creator    │           │
│  └────────────┘  └────────────┘  └────────────┘           │
│                                                             │
│  ┌──────────────────────────────────────────────────┐      │
│  │            Dead Man's Switch (external)            │      │
│  │  (heartbeat to independent monitoring service)     │      │
│  └──────────────────────────────────────────────────┘      │
└─────────────────────────────────────────────────────────────┘
```

### 6.3 Health Check Response Contract

Every RADIANT service must implement:

```typescript
// GET /api/health (or /healthz for Go services)
interface HealthCheckResponse {
  status: 'healthy' | 'degraded' | 'unhealthy';
  version: string;
  uptime: number;                    // seconds
  timestamp: string;                 // ISO 8601
  checks: {
    database: 'ok' | 'slow' | 'down';
    cache: 'ok' | 'slow' | 'down';
    externalDeps: Record<string, 'ok' | 'slow' | 'down'>;
  };
  latency: {
    p50: number;
    p95: number;
    p99: number;
  };
}
```

---

## 7. Self-Healing & Auto-Remediation

### 7.1 Remediation Actions

| Action | Trigger | Cooldown | Max Retries | Requires Approval |
|--------|---------|----------|-------------|-------------------|
| **Lambda Redeploy** | 5xx error rate >10% for 5 min | 15 min | 3 | No |
| **ECS Task Restart** | Health check failure 3x consecutive | 5 min | 5 | No |
| **RDS Failover** | Primary unreachable for 60s | 30 min | 1 | SEV 1: No; otherwise: Yes |
| **Cache Rebuild** | ElastiCache failure | 10 min | 2 | No |
| **Connection Pool Reset** | Pool exhaustion >90% | 5 min | 3 | No |
| **Traffic Shift** | Region-level degradation | 5 min | 2 | No (auto); reversal: Yes |
| **AI Provider Failover** | Provider returning errors >5% | 1 min | N/A (circuit breaker) | No |
| **Queue Drain to DLQ** | Message age >15 min | 10 min | 1 | Yes (SEV 3+) |
| **Certificate Renewal** | Cert expiring in <7 days | 24 hours | 3 | No |
| **Disk Cleanup** | Disk usage >90% | 1 hour | 1 | SEV 4+: No; storage: Yes |

### 7.2 Circuit Breaker Pattern

All external dependencies use a circuit breaker:

```
CLOSED (normal) → OPEN (after N failures in M seconds)
                     ↓
                  HALF-OPEN (after timeout, try one request)
                     ↓
              success? → CLOSED
              failure? → OPEN (reset timeout)
```

Configuration per service:
- **AI Providers**: 3 failures in 60s → open for 30s
- **Databases**: 5 failures in 30s → open for 10s (critical path)
- **External APIs**: 5 failures in 120s → open for 60s

### 7.3 Remediation Audit Trail

Every auto-remediation action is logged:

```typescript
interface RemediationEvent {
  id: string;
  alertId: string;
  action: RemediationAction;
  trigger: string;              // Why this fired
  targetService: string;
  startedAt: string;
  completedAt: string | null;
  result: 'success' | 'failed' | 'partial' | 'skipped_cooldown' | 'requires_approval';
  details: Record<string, unknown>;
  approvedBy: string | null;    // For actions requiring approval
}
```

---

## 8. Dead Man's Switch — Who Watches the Watcher?

The most critical design requirement: **SENTINEL itself must be monitored by an independent system that shares zero infrastructure.**

### 8.1 Architecture

```
SENTINEL (us-east-1)
    │
    ├──▶ Heartbeat every 60s ──▶ Dead Man's Snitch (deadmanssnitch.com)
    │                                    │
    │                                    ├── If heartbeat missing for 3 min:
    │                                    │   → Direct Twilio phone call to CTO
    │                                    │   → Direct Twilio SMS to all engineers
    │                                    │   → PagerDuty critical incident
    │                                    │
    ├──▶ Heartbeat every 60s ──▶ PagerDuty Dead Man's Snitch
    │                                    │
    │                                    └── Independent alerting path
    │
    └──▶ Heartbeat every 60s ──▶ Independent Region Monitor (us-west-2)
                                         │
                                         └── Separate AWS account
                                             Separate VPC
                                             Separate credentials
                                             → Direct Twilio failover
```

### 8.2 Heartbeat Contract

SENTINEL publishes a heartbeat to **three independent monitors** every 60 seconds:

```json
{
  "service": "radiant-sentinel",
  "region": "us-east-1",
  "timestamp": "2026-02-07T08:40:00Z",
  "checks_completed": 847,
  "alerts_active": 3,
  "last_notification_sent": "2026-02-07T08:39:12Z",
  "notification_pipeline_healthy": true
}
```

If **any** heartbeat monitor doesn't receive a ping for **3 minutes**, it independently triggers a critical alert through a completely separate notification path (direct Twilio API, not through AWS SNS).

### 8.3 Multi-Path Notification Guarantee

For SEV 1 alerts, notifications are sent through **at least 3 independent paths simultaneously**:

1. **Primary**: SNS → PagerDuty → Phone/SMS/Push
2. **Secondary**: Direct Twilio API call (bypasses SNS entirely)
3. **Tertiary**: Direct SES email (bypasses SNS entirely)

If any path fails, the others still deliver. Delivery confirmation is tracked; if no acknowledgment within 5 minutes, all paths retry.

---

## 9. On-Call Rotation & Incident Commander

### 9.1 On-Call Schedule

| Rotation | Coverage | Team Size | Escalation |
|----------|----------|-----------|------------|
| **Primary On-Call** | 24/7 | 1 engineer | First responder for all SEV 1–3 |
| **Secondary On-Call** | 24/7 | 1 engineer | Backup if primary doesn't ack in 5 min |
| **Incident Commander** | Business hours + on-call for SEV 1 | Engineering lead | Coordinates response, external comms |
| **Compliance On-Call** | 24/7 for compliance-tagged alerts | 1 compliance officer | HIPAA/GDPR/SOC2 incident handling |

### 9.2 Rotation Rules

- **Rotation period**: 1 week (Monday 09:00 → Monday 09:00 local time)
- **Handoff**: 30-minute overlap with active incident briefing
- **Fatigue protection**: Max 2 consecutive weeks; compensation time after heavy on-call
- **Override**: Anyone can claim a shift; swap requires mutual agreement
- **Holiday coverage**: Volunteers first, then round-robin with 2x compensation

### 9.3 Incident Commander Role (SEV 1–2)

The IC has authority to:
- Declare incident severity and communicate externally
- Page any engineer regardless of on-call status
- Authorize emergency deployments and rollbacks
- Initiate status page updates
- Call an all-hands war room

---

## 10. Incident Lifecycle & Playbooks

### 10.1 Lifecycle Stages

```
DETECTED → TRIAGED → INVESTIGATING → IDENTIFIED → MITIGATING → RESOLVED → POSTMORTEM
    │          │            │              │             │            │           │
    ▼          ▼            ▼              ▼             ▼            ▼           ▼
  Alert     Assign       Update        Root cause    Fix deploy   Verify      Publish
  fires     severity     status        documented    applied      recovery    report
            & owner      page                                     stable
```

### 10.2 Required Actions Per Stage

| Stage | SEV 1 | SEV 2 | SEV 3 |
|-------|-------|-------|-------|
| **Detected** | Auto-page + auto-remediate | Auto-page | Slack notification |
| **Triaged** (< 5 min) | IC assigned, war room opened | Owner assigned | Owner assigned |
| **Investigating** (< 15 min) | Status page updated, exec notified | Status page if customer-facing | Internal tracking |
| **Identified** | Root cause in incident log | Root cause documented | Root cause documented |
| **Mitigating** | Fix deployed with rollback plan | Fix or workaround deployed | Scheduled fix |
| **Resolved** | All-clear to stakeholders + customers | Status page updated | Ticket closed |
| **Postmortem** (< 48 hours) | Mandatory blameless postmortem with action items | Mandatory postmortem | Optional |

### 10.3 Pre-Built Playbooks

| Playbook | Trigger | Key Steps |
|----------|---------|-----------|
| **Total Platform Outage** | All health checks failing | 1. Check AWS Health Dashboard; 2. Check DNS; 3. Check primary region; 4. Failover to DR region; 5. Status page update |
| **Database Failover** | Aurora primary unreachable | 1. Verify replica health; 2. Promote replica; 3. Update connection strings; 4. Verify data integrity; 5. Notify affected tenants |
| **Security Breach** | WAF trigger + anomalous access | 1. Isolate affected systems; 2. Preserve evidence; 3. Assess data exposure; 4. Notify compliance; 5. Begin containment |
| **AI Provider Outage** | Circuit breaker open on provider | 1. Verify provider status; 2. Confirm failover to alternate; 3. Monitor quality; 4. Notify if degraded quality |
| **Data Corruption** | Integrity check failure | 1. Stop writes; 2. Identify scope; 3. Point-in-time recovery; 4. Verify restoration; 5. Replay lost transactions |
| **Cost Anomaly** | AWS bill spike >200% | 1. Identify source; 2. Check for crypto mining / abuse; 3. Apply budget limits; 4. Remediate root cause |
| **Certificate Expiry** | Cert expiring < 48 hours | 1. Auto-renew via ACM; 2. If ACM fails, manual renewal; 3. Deploy new cert; 4. Verify SSL |
| **Tenant Isolation Breach** | Cross-tenant data in response | 1. **IMMEDIATE**: Block affected endpoint; 2. Assess data exposure; 3. Notify affected tenants; 4. HIPAA/GDPR notification if PHI/PII involved |

---

## 11. Compliance & Regulatory Requirements

### 11.1 Compliance-Driven Alert Handling

| Framework | Monitoring Requirement | Alert Response | Documentation |
|-----------|----------------------|----------------|---------------|
| **HIPAA** | Continuous access monitoring; breach detection | PHI breach: IC + Privacy Officer notified within 15 min; HHS notification within 60 days | Full audit trail; breach risk assessment within 24 hours |
| **GDPR** | Personal data processing monitoring | Personal data breach: DPO notified within 30 min; supervisory authority within 72 hours; data subjects "without undue delay" | DPIA if high risk; breach register maintained |
| **SOC2** | Continuous monitoring of all controls | Control failure: documented immediately; remediation tracked | Annual audit evidence; continuous monitoring reports |
| **FedRAMP** | Continuous monitoring per NIST 800-53 | Incident reported to US-CERT within 1 hour (SEV 1) | Monthly POA&M updates |
| **PCI-DSS** | Payment data monitoring | Cardholder data breach: forensic investigation within 24 hours | Quarterly ASV scans; annual ROC |

### 11.2 Immutable Incident Audit Log

Every incident action is immutably logged (same Merkle chain pattern as log retention):

- Alert creation, severity changes, escalations
- Acknowledgments, assignments, notes
- Remediation actions and results
- Status page updates
- Notification delivery confirmations
- Postmortem creation and action item tracking

---

## 12. Metrics & SLAs

### 12.1 Key Metrics (SENTINEL Dashboard)

| Metric | Target | SEV 1 | SEV 2 | SEV 3 |
|--------|--------|-------|-------|-------|
| **MTTD** (Mean Time to Detect) | < 1 min | < 30s | < 1 min | < 5 min |
| **MTTA** (Mean Time to Acknowledge) | < 5 min | < 2 min | < 10 min | < 1 hour |
| **MTTR** (Mean Time to Resolve) | < 1 hour | < 1 hour | < 4 hours | < 24 hours |
| **Uptime** (platform) | 99.95% | — | — | — |
| **Alert-to-Notification Latency** | < 60s | < 30s | < 60s | < 5 min |
| **False Positive Rate** | < 5% | — | — | — |
| **Escalation Rate** (unack'd) | < 10% | — | — | — |

### 12.2 SLA Tiers Per Tenant Subscription

| Tier | Uptime SLA | SEV 1 Response | SEV 2 Response | Status Page | Dedicated IC |
|------|-----------|----------------|----------------|-------------|--------------|
| **Seed** | 99.5% | Best effort | Best effort | Shared | No |
| **Starter** | 99.9% | < 30 min | < 2 hours | Shared | No |
| **Growth** | 99.95% | < 15 min | < 1 hour | Shared | No |
| **Scale** | 99.99% | < 5 min | < 30 min | Branded | Yes |
| **Enterprise** | 99.99% + custom | < 5 min | < 15 min | Branded + API | Yes |

---

## 13. Architecture & AWS Infrastructure

### 13.1 Core AWS Resources

| Resource | Purpose | Config |
|----------|---------|--------|
| **Lambda: sentinel-watchdog** | Runs health checks every 30s–5min per service | 2048 MB, 5 min timeout, reserved concurrency 10 |
| **Lambda: sentinel-alert-processor** | Correlation engine, severity scoring, dedup | 1024 MB, 30s timeout |
| **Lambda: sentinel-notifier** | Multi-channel notification dispatch | 512 MB, 30s timeout |
| **Lambda: sentinel-auto-healer** | Executes remediation actions | 2048 MB, 5 min timeout |
| **Lambda: sentinel-heartbeat** | Dead Man's Switch heartbeat emitter | 128 MB, 10s timeout, EventBridge every 60s |
| **DynamoDB: sentinel-alerts** | Active alerts with TTL | On-demand, point-in-time recovery |
| **DynamoDB: sentinel-incidents** | Incident lifecycle tracking | On-demand, point-in-time recovery |
| **DynamoDB: sentinel-health-checks** | Latest health status per service | On-demand |
| **SQS: sentinel-alert-queue** | Alert ingestion buffer | FIFO, dedup 5 min |
| **SQS: sentinel-notification-queue** | Notification dispatch queue | Standard, 3 retry, DLQ |
| **SNS: sentinel-critical** | SEV 1 fan-out topic | SMS + Email + Lambda |
| **SNS: sentinel-major** | SEV 2 fan-out topic | Email + Lambda |
| **EventBridge: sentinel-rules** | Scheduled health checks + alert rules | Multiple rules |
| **CloudWatch Synthetics** | External canary monitors | 5 canaries, every 1 min |
| **S3: sentinel-artifacts** | Incident artifacts, postmortems, evidence | Versioned, KMS encrypted |
| **KMS: sentinel-key** | Encrypt sensitive alert data | Auto-rotation |

### 13.2 Why DynamoDB (Not Aurora)

SENTINEL uses DynamoDB instead of Aurora for its primary data store because:

1. **Independence**: If Aurora is the thing that's down, SENTINEL must still function
2. **Multi-region**: DynamoDB Global Tables for cross-region failover
3. **Guaranteed latency**: Single-digit ms reads for active alerts
4. **No connection pooling**: Lambda-friendly; no pool exhaustion during incident storms

Aurora is used only for long-term incident history and postmortem storage (via the existing `pg` pool).

### 13.3 Cross-Region Failover

```
Primary: us-east-1
    │
    ├── DynamoDB Global Table replica → us-west-2
    ├── Lambda@Edge for synthetic monitors
    ├── S3 Cross-Region Replication → us-west-2
    │
    └── If us-east-1 down:
        → us-west-2 SENTINEL activates autonomously
        → Independent Twilio path still works
        → Dead Man's Switch triggers from deadmanssnitch.com
```

---

## 14. Database Schema

### 14.1 DynamoDB Tables

```
sentinel-alerts
  PK: alertId (ULID)
  SK: timestamp
  GSI1: category-severity-index (category#severity → timestamp)
  GSI2: service-index (service → timestamp)
  Attributes: severity, category, service, region, tenantScope, 
              message, details, autoRemediationStatus, 
              acknowledgedBy, acknowledgedAt, resolvedAt,
              deduplicationKey, occurrenceCount, ttl

sentinel-incidents
  PK: incidentId (ULID)
  SK: timestamp
  GSI1: severity-status-index (severity#status → timestamp)
  Attributes: severity, status, title, description, alertIds[],
              commander, assignees[], timeline[], 
              postmortemId, complianceContext[],
              statusPageUpdates[], ttl

sentinel-health-checks
  PK: serviceId
  SK: checkType
  Attributes: status, lastCheck, latency, details,
              consecutiveFailures, circuitBreakerState
```

### 14.2 Aurora Tables (Long-Term Storage)

```sql
-- Incident history (searchable, reportable)
CREATE TABLE sentinel_incidents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  severity INTEGER NOT NULL CHECK (severity BETWEEN 1 AND 5),
  status TEXT NOT NULL, -- detected, triaged, investigating, identified, mitigating, resolved, postmortem
  title TEXT NOT NULL,
  description TEXT,
  category TEXT NOT NULL,
  service TEXT NOT NULL,
  region TEXT,
  tenant_scope TEXT DEFAULT 'none',
  affected_tenant_ids TEXT[],
  compliance_context TEXT[],
  commander_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  acknowledged_at TIMESTAMPTZ,
  resolved_at TIMESTAMPTZ,
  duration_seconds INTEGER,
  root_cause TEXT,
  resolution TEXT,
  postmortem_url TEXT,
  auto_remediation_attempted BOOLEAN DEFAULT false,
  auto_remediation_succeeded BOOLEAN DEFAULT false
);

-- Incident timeline events
CREATE TABLE sentinel_incident_timeline (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  incident_id UUID NOT NULL REFERENCES sentinel_incidents(id),
  event_type TEXT NOT NULL, -- alert, escalation, ack, note, status_change, remediation, resolution
  actor TEXT, -- user or 'system'
  message TEXT NOT NULL,
  details JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- On-call schedules
CREATE TABLE sentinel_oncall_schedules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rotation_name TEXT NOT NULL, -- primary, secondary, compliance, ic
  user_id UUID NOT NULL,
  start_time TIMESTAMPTZ NOT NULL,
  end_time TIMESTAMPTZ NOT NULL,
  is_override BOOLEAN DEFAULT false,
  created_by UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Admin alert preferences
CREATE TABLE sentinel_alert_preferences (
  user_id UUID PRIMARY KEY,
  subscribed_categories TEXT[] NOT NULL DEFAULT '{}',
  subscribed_services TEXT[] NOT NULL DEFAULT '{}',
  minimum_severity INTEGER NOT NULL DEFAULT 3,
  phone TEXT,
  sms TEXT,
  email TEXT NOT NULL,
  slack_id TEXT,
  push_enabled BOOLEAN DEFAULT true,
  quiet_hours_start TIME,
  quiet_hours_end TIME,
  timezone TEXT NOT NULL DEFAULT 'UTC',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Remediation log
CREATE TABLE sentinel_remediation_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  alert_id TEXT NOT NULL,
  incident_id UUID REFERENCES sentinel_incidents(id),
  action TEXT NOT NULL,
  target_service TEXT NOT NULL,
  trigger_reason TEXT NOT NULL,
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  result TEXT NOT NULL, -- success, failed, partial, skipped_cooldown, requires_approval
  details JSONB,
  approved_by UUID
);

-- Postmortems
CREATE TABLE sentinel_postmortems (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  incident_id UUID NOT NULL REFERENCES sentinel_incidents(id),
  title TEXT NOT NULL,
  summary TEXT NOT NULL,
  root_cause TEXT NOT NULL,
  impact_summary TEXT NOT NULL,
  timeline_summary TEXT NOT NULL,
  what_went_well TEXT[],
  what_went_wrong TEXT[],
  action_items JSONB NOT NULL DEFAULT '[]', -- [{title, owner, dueDate, status}]
  participants UUID[],
  published BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Playbook definitions
CREATE TABLE sentinel_playbooks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  description TEXT NOT NULL,
  trigger_conditions JSONB NOT NULL, -- auto-match rules
  steps JSONB NOT NULL, -- ordered steps with commands
  severity_range INT4RANGE NOT NULL DEFAULT '[1,5]',
  categories TEXT[] NOT NULL,
  last_executed_at TIMESTAMPTZ,
  execution_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

---

## 15. Admin UI

### 15.1 SENTINEL Dashboard Page (`/sentinel`)

**Top-level entry in admin sidebar** under "Operations" section.

#### Tabs:

| Tab | Content |
|-----|---------|
| **Dashboard** | Live alert count by severity (big numbers); active incidents; service health grid (green/yellow/red per service); MTTD/MTTA/MTTR gauges; uptime percentage |
| **Alerts** | Filterable alert list (severity, category, service, status); acknowledge/resolve buttons; alert detail drawer with timeline; dedup count |
| **Incidents** | Active + recent incidents; lifecycle stage visualization; IC assignment; war room link; compliance badges |
| **Health Map** | Visual grid of all services with real-time status; click to see health history, latency chart, circuit breaker state |
| **On-Call** | Current on-call roster; schedule calendar; override controls; swap requests |
| **Playbooks** | Playbook library; execution history; create/edit playbooks |
| **Postmortems** | Postmortem list; action item tracker with owner and due date; recurring issue patterns |
| **Settings** | Alert preferences; notification channel config; escalation rules; maintenance windows; SLA configuration |

### 15.2 Real-Time Features

- **WebSocket connection** for live alert feed (no polling)
- **Sound alerts** for SEV 1/2 in browser (configurable)
- **Desktop notifications** via Notification API
- **Badge count** on sidebar icon showing active SEV 1+2 alerts

---

## 16. Status Page (Public)

### 16.1 Components Shown

| Component | Description |
|-----------|-------------|
| Think Tank | Consumer AI chat platform |
| Think Tank Admin | Administrative dashboard |
| Curator | Knowledge management |
| Dojo | Training platform |
| Genesis | Content generation |
| API Gateway | Developer API access |
| Authentication | Login and session management |
| AI Model Routing | Model availability and routing |
| Billing & Payments | Payment processing |
| Data Storage | Database and file storage |

### 16.2 Status Levels

- **Operational** (green)
- **Degraded Performance** (yellow)
- **Partial Outage** (orange)
- **Major Outage** (red)
- **Under Maintenance** (blue)

### 16.3 Automatic Updates

- SEV 1/2 incidents auto-create status page entries
- Status page updates are part of the incident lifecycle
- Historical uptime displayed (90-day rolling)
- RSS/Atom feed + email subscription for updates

---

## 17. Implementation Phases

### Phase 1: Foundation (Week 1–2)
- [ ] Database migration: DynamoDB tables + Aurora tables
- [ ] Health check contract: implement `/api/health` in all services
- [ ] `sentinel-watchdog` Lambda: health checks for all AWS + RADIANT services
- [ ] `sentinel-alert-processor` Lambda: severity scoring, dedup, correlation
- [ ] Shared types: `packages/shared/src/types/sentinel.types.ts`

### Phase 2: Notification Pipeline (Week 2–3)
- [ ] `sentinel-notifier` Lambda: multi-channel dispatch
- [ ] SNS topics: sentinel-critical, sentinel-major
- [ ] PagerDuty integration (API v2)
- [ ] Twilio integration (SMS + voice call)
- [ ] SES email templates for each severity
- [ ] Slack webhook integration
- [ ] Admin alert preferences service + API

### Phase 3: Self-Healing (Week 3–4)
- [ ] `sentinel-auto-healer` Lambda: remediation actions
- [ ] Circuit breaker implementation per service
- [ ] Lambda redeploy, ECS restart, RDS failover actions
- [ ] AI provider failover integration
- [ ] Remediation audit trail

### Phase 4: Dead Man's Switch (Week 4)
- [ ] `sentinel-heartbeat` Lambda: 60s heartbeat to 3 independent monitors
- [ ] Dead Man's Snitch integration
- [ ] PagerDuty Dead Man's Snitch integration
- [ ] Independent region monitor (us-west-2, separate account)
- [ ] Multi-path notification verification

### Phase 5: Admin UI (Week 4–5)
- [ ] SENTINEL dashboard page (`/sentinel`)
- [ ] All 8 tabs with full functionality
- [ ] WebSocket live alert feed
- [ ] Sound/desktop notifications
- [ ] Sidebar integration with badge count

### Phase 6: Incident Lifecycle (Week 5–6)
- [ ] Incident creation from alert correlation
- [ ] Lifecycle stage management
- [ ] On-call schedule management
- [ ] Incident Commander assignment
- [ ] Playbook library + execution engine
- [ ] Postmortem workflow

### Phase 7: Status Page & Compliance (Week 6–7)
- [ ] Public status page (custom Next.js page or Statuspage.io)
- [ ] Auto-update from incident lifecycle
- [ ] Compliance-triggered escalation overrides
- [ ] Immutable incident audit log (Merkle chain)
- [ ] Compliance reporting (HIPAA, GDPR, SOC2)

### Phase 8: CDK Stack & Hardening (Week 7–8)
- [ ] `SentinelStack` CDK: all Lambdas, DynamoDB, SQS, SNS, EventBridge
- [ ] Cross-region DynamoDB Global Table
- [ ] CloudWatch Synthetics canaries
- [ ] Load testing the alert pipeline
- [ ] Chaos testing: simulate failures and verify response
- [ ] Documentation: admin guide, runbooks, playbook templates

---

## 18. Open Questions for Review

1. **PagerDuty vs. Build-In-House?** — PagerDuty provides on-call management, phone/SMS alerting, escalation policies, and mobile app. Cost is ~$29/user/month. Alternative: build notification routing in-house with Twilio + SNS (more control, more maintenance). **Recommendation: PagerDuty for SEV 1-2, in-house for SEV 3-5.**

2. **Status Page: Custom vs. Statuspage.io?** — Statuspage.io ($79-399/mo) is industry standard, integrates with PagerDuty. Custom gives full control and branding. **Recommendation: Custom page backed by SENTINEL data, with RSS feed.**

3. **Cross-Region Active-Active vs. Active-Passive?** — Active-active is more resilient but doubles cost. Active-passive with automated failover is simpler. **Recommendation: Active-passive with < 5 min automated failover for SENTINEL itself.**

4. **Alert Correlation Complexity** — Simple: group by service + time window. Complex: ML-based correlation (e.g., "database slow" + "API latency" + "queue depth" = single root cause). **Recommendation: Start simple (time window + service grouping), add ML later.**

5. **Tenant-Facing Alerts?** — Should tenants see their own health dashboard? **Recommendation: Yes for Scale/Enterprise tiers — filtered view of their services + SLA compliance.**

6. **Chaos Engineering Integration?** — Should SENTINEL include a chaos engineering module (inject failures to test response)? **Recommendation: Phase 2 — after core system is proven.**

7. **AI-Powered Incident Analysis?** — Use RADIANT's own AI models to analyze incidents, suggest root causes, and draft postmortems? **Recommendation: Yes — competitive moat. Build after Phase 6.**

8. **What notification channels are we missing?** — Consider: Microsoft Teams, Discord, Opsgenie, VictorOps, custom mobile app, war room auto-create (Zoom/Meet), physical alerting (smart lights/sirens for office).

---

## Summary

SENTINEL provides RADIANT with an **enterprise-grade, always-on** monitoring and incident response system that:

- Classifies alerts across **5 severity levels × 10 categories × 6 secondary dimensions**
- Watches **every AWS service, every RADIANT service, and every AI provider** with health checks every 15–60 seconds
- **Auto-heals** known failure patterns with circuit breakers and remediation actions
- Routes notifications through **8 independent channels** based on severity, role, and preference
- Guarantees its **own availability** via Dead Man's Switch with 3 independent external monitors
- Meets **HIPAA, GDPR, SOC2, FedRAMP, and PCI-DSS** incident response requirements
- Provides a **full admin UI** with live alerts, health map, on-call management, and postmortems
- Maintains an **immutable audit trail** of every alert, action, and incident for compliance

The system is designed so that **no single point of failure** — including AWS region failure, SNS outage, or SENTINEL itself going down — can prevent critical alerts from reaching the on-call team.
