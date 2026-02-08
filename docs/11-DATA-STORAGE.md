# Data & Storage

**User Data Store • RAWS • Data Retention • Cost Optimization**

*RADIANT v6.6.0 — Generated February 07, 2026*

---

## Table of Contents

- **Part I: User Data Store**
- **Part II: RAWS (Read-After-Write Storage)**
- **Part III: Data Lifecycle**
- **Part IV: File Services**

---


---

## Part I: User Data Store

**Version**: 1.0.0  
**Last Updated**: January 24, 2026  
**RADIANT Version**: 5.52.18

---

## Table of Contents

1. [Overview](#1-overview)
2. [Architecture](#2-architecture)
3. [Tiered Storage](#3-tiered-storage)
4. [Data Types](#4-data-types)
5. [Encryption](#5-encryption)
6. [Audit System](#6-audit-system)
7. [Upload Management](#7-upload-management)
8. [GDPR Compliance](#8-gdpr-compliance)
9. [Admin API Reference](#9-admin-api-reference)
10. [Admin Dashboard](#10-admin-dashboard)
11. [Configuration](#11-configuration)
12. [Monitoring](#12-monitoring)
13. [Troubleshooting](#13-troubleshooting)

---

## 1. Overview

The User Data Service (UDS) is RADIANT's dedicated system for storing, managing, and securing user-generated content at scale (1M+ concurrent users). It provides:

- **Tiered Storage**: Hot → Warm → Cold → Glacier automatic data lifecycle
- **End-to-End Encryption**: AES-256-GCM with KMS key management
- **Tamper-Evident Audit**: Merkle chain for compliance verification
- **GDPR Compliance**: Right-to-erasure with multi-tier deletion
- **File Handling**: Virus scanning, text extraction, semantic search

### Why UDS vs Cortex?

| System | Purpose | Data |
|--------|---------|------|
| **Cortex** | AI Memory | Knowledge graphs, semantic memory, ghost vectors |
| **UDS** | User Data | Conversations, messages, uploads, audit logs |

UDS is optimized for **time-series CRUD** operations, while Cortex is optimized for **graph queries** and **semantic search**.

---

## 2. Architecture

### 2.1 System Overview

```
┌─────────────────────────────────────────────────────────────────────────┐
│                           USER DATA SERVICE                              │
│                                                                          │
│  ┌────────────────────────┐        ┌────────────────────────┐          │
│  │   Client Applications  │        │    Admin Dashboard     │          │
│  │   (Think Tank, etc.)   │        │   /platform/uds        │          │
│  └───────────┬────────────┘        └───────────┬────────────┘          │
│              │                                  │                        │
│              ▼                                  ▼                        │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │                       UDS API Gateway                            │   │
│  │  /api/v2/uds/* (client)       /api/admin/uds/* (admin)         │   │
│  └─────────────────────────────────────────────────────────────────┘   │
│              │                                  │                        │
│              ▼                                  ▼                        │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │                        UDS Services                              │   │
│  │  ┌──────────────┐ ┌──────────────┐ ┌──────────────┐             │   │
│  │  │ Conversation │ │   Message    │ │    Upload    │             │   │
│  │  │   Service    │ │   Service    │ │   Service    │             │   │
│  │  └──────────────┘ └──────────────┘ └──────────────┘             │   │
│  │  ┌──────────────┐ ┌──────────────┐ ┌──────────────┐             │   │
│  │  │    Audit     │ │     Tier     │ │   Erasure    │             │   │
│  │  │   Service    │ │ Coordinator  │ │   Service    │             │   │
│  │  └──────────────┘ └──────────────┘ └──────────────┘             │   │
│  │  ┌──────────────┐                                               │   │
│  │  │  Encryption  │                                               │   │
│  │  │   Service    │                                               │   │
│  │  └──────────────┘                                               │   │
│  └─────────────────────────────────────────────────────────────────┘   │
│              │                                                          │
│              ▼                                                          │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │                       Storage Tiers                              │   │
│  │  ┌────────────┐ ┌────────────┐ ┌────────────┐ ┌────────────┐   │   │
│  │  │    HOT     │ │    WARM    │ │    COLD    │ │  GLACIER   │   │   │
│  │  │ ElastiCache│ │  Aurora PG │ │ S3 Iceberg │ │ S3 Glacier │   │   │
│  │  │ + DynamoDB │ │ + pgvector │ │            │ │            │   │   │
│  │  └────────────┘ └────────────┘ └────────────┘ └────────────┘   │   │
│  └─────────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────────┘
```

### 2.2 Database Tables

| Table | Purpose |
|-------|---------|
| `uds_config` | Per-tenant configuration |
| `uds_encryption_keys` | Encryption key registry |
| `uds_conversations` | Conversation metadata |
| `uds_messages` | Encrypted message content |
| `uds_message_attachments` | Inline attachments |
| `uds_uploads` | File upload metadata |
| `uds_upload_chunks` | Chunked upload tracking |
| `uds_audit_log` | Tamper-evident audit trail |
| `uds_audit_merkle_tree` | Merkle tree checkpoints |
| `uds_export_requests` | Compliance data exports |
| `uds_erasure_requests` | GDPR deletion requests |
| `uds_tier_transitions` | Data movement history |
| `uds_data_flow_metrics` | Tier health metrics |
| `uds_search_index` | Full-text + semantic search |

---

## 3. Tiered Storage

### 3.1 Tier Overview

| Tier | Storage | Retention | Access Pattern | Latency |
|------|---------|-----------|----------------|---------|
| **Hot** | ElastiCache + DynamoDB | 0-24 hours | Real-time | <10ms |
| **Warm** | Aurora PostgreSQL | 1-90 days | Active | <100ms |
| **Cold** | S3 Iceberg | 90 days - 7 years | Rare | 1-10s |
| **Glacier** | S3 Glacier | 7+ years | Archive only | 1-12h |

### 3.2 Automatic Transitions

Data automatically moves between tiers based on access patterns:

```
Hot (24h) → Warm (90d) → Cold (7y) → Glacier
                ↑______________|
                   (retrieval)
```

**Transition Rules**:
- **Hot → Warm**: Conversation not accessed for 24 hours
- **Warm → Cold**: Conversation archived AND not accessed for 90 days
- **Cold → Glacier**: Data older than 7 years (compliance retention)
- **Cold → Warm**: Manual retrieval request

### 3.3 Configuration

```typescript
// Per-tenant tier configuration
{
  hotSessionTtlSeconds: 14400,      // 4 hours default session TTL
  hotMessageTtlSeconds: 86400,      // 24 hours default message TTL
  warmRetentionDays: 90,            // 90 days in warm tier
  coldRetentionYears: 7,            // 7 years compliance retention
}
```

### 3.4 Manual Operations

**Trigger Hot → Warm Promotion**:
```bash
POST /api/admin/uds/tiers/promote
```

**Trigger Warm → Cold Archival**:
```bash
POST /api/admin/uds/tiers/archive
```

**Retrieve from Cold to Warm**:
```bash
POST /api/admin/uds/tiers/retrieve
Content-Type: application/json

{
  "resourceIds": ["uuid-1", "uuid-2"]
}
```

---

## 4. Data Types

### 4.1 Conversations

Conversations are the primary container for user interactions.

```typescript
interface Conversation {
  id: string;
  tenantId: string;
  userId: string;
  title: string;
  modelId: string;
  messageCount: number;
  totalInputTokens: number;
  totalOutputTokens: number;
  totalCostCredits: number;
  status: 'active' | 'archived' | 'deleted';
  currentTier: 'hot' | 'warm' | 'cold' | 'glacier';
  // Time Machine support
  parentConversationId?: string;
  forkPointMessageId?: string;
  branchName?: string;
  // Collaboration
  isShared: boolean;
  sharedWithUserIds: string[];
}
```

**Features**:
- **Time Machine**: Fork conversations at any message
- **Checkpoints**: Save named snapshots
- **Collaboration**: Share with other users
- **Tagging**: Custom metadata tags

### 4.2 Messages

Messages are encrypted at rest and contain the actual conversation content.

```typescript
interface Message {
  id: string;
  conversationId: string;
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string;  // Decrypted on read
  sequenceNumber: number;
  inputTokens: number;
  outputTokens: number;
  costCredits: number;
  // Editing
  isEdited: boolean;
  editCount: number;
  // Feedback
  userRating: number;  // 1-5
  flagged: boolean;
}
```

### 4.3 Uploads

Uploads support multiple file formats with automatic processing.

**Supported Content Types**:

| Category | Extensions |
|----------|------------|
| Documents | pdf, docx, doc, xlsx, xls, csv, txt, md, json, xml |
| Images | png, jpg, jpeg, gif, webp, svg, bmp, tiff |
| Audio | mp3, wav, ogg, m4a |
| Video | mp4, webm, mov |
| Archives | zip, tar, gz |

**Processing Pipeline**:
1. **Quarantine**: File uploaded to quarantine bucket
2. **Virus Scan**: ClamAV Lambda checks for malware
3. **Promotion**: Clean files moved to main bucket
4. **Text Extraction**: Textract/Tika extracts content
5. **Embedding**: Vector embedding for semantic search
6. **Thumbnail**: Generate preview images

---

## 5. Encryption

### 5.1 Architecture

UDS uses **envelope encryption** with AWS KMS:

```
┌─────────────────────────────────────────────────────────────┐
│                    ENCRYPTION HIERARCHY                      │
│                                                              │
│  ┌─────────────────────────────────────────────────────┐   │
│  │  AWS KMS Master Key                                  │   │
│  │  (alias/radiant-uds-master)                         │   │
│  └──────────────────────┬──────────────────────────────┘   │
│                         │                                   │
│                         ▼                                   │
│  ┌─────────────────────────────────────────────────────┐   │
│  │  Data Encryption Keys (DEKs)                        │   │
│  │  - Per-tenant key (default)                         │   │
│  │  - Per-user key (optional, high-security)          │   │
│  │  - Rotated every 90 days                           │   │
│  └──────────────────────┬──────────────────────────────┘   │
│                         │                                   │
│                         ▼                                   │
│  ┌─────────────────────────────────────────────────────┐   │
│  │  Encrypted Data                                     │   │
│  │  - Messages: AES-256-GCM with per-message IV       │   │
│  │  - Uploads: S3 SSE-KMS                             │   │
│  │  - Attachments: AES-256-GCM                        │   │
│  └─────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
```

### 5.2 Algorithm Details

- **Algorithm**: AES-256-GCM
- **IV Length**: 96 bits (12 bytes)
- **Auth Tag Length**: 128 bits (16 bytes)
- **Key Spec**: AES_256

### 5.3 Key Rotation

**Automatic Rotation**:
- Keys are automatically rotated every 90 days
- Old keys remain available for decryption
- New data uses the latest key version

**Manual Rotation**:
```bash
POST /api/admin/uds/encryption/rotate
Content-Type: application/json

{
  "userId": "optional-user-id-for-per-user-key"
}
```

### 5.4 Configuration

```typescript
{
  encryptionEnabled: true,
  encryptionAlgorithm: 'AES-256-GCM',
  perUserEncryptionKeys: false,  // Enable for high-security tenants
}
```

---

## 6. Audit System

### 6.1 Features

- **Append-Only**: Entries cannot be modified or deleted
- **Merkle Chain**: Each entry links to previous via hash
- **Tamper-Evident**: Verification detects any modification
- **Compliance Ready**: GDPR, HIPAA, SOC2 compatible

### 6.2 Audit Entry Structure

```typescript
interface AuditEntry {
  id: string;
  tenantId: string;
  userId: string;
  
  // Event
  eventType: string;           // e.g., 'conversation_created'
  eventCategory: string;       // e.g., 'conversation'
  eventSeverity: string;       // 'debug' | 'info' | 'warning' | 'error' | 'critical'
  
  // Resource
  resourceType: string;
  resourceId: string;
  
  // Action
  action: string;              // 'create' | 'read' | 'update' | 'delete'
  actionDetails: object;
  
  // Merkle Chain
  merkleHash: string;          // SHA-256 hash of entry + previous hash
  previousMerkleHash: string;
  sequenceNumber: number;
  
  // Request Context
  requestId: string;
  ipAddress: string;
  userAgent: string;
  
  createdAt: Date;
}
```

### 6.3 Event Categories

| Category | Events |
|----------|--------|
| `auth` | login, logout, token_refresh |
| `conversation` | created, updated, deleted, forked, archived |
| `message` | created, updated, deleted, flagged |
| `upload` | initiated, completed, downloaded, deleted |
| `gdpr` | erasure_requested, erasure_completed |
| `system` | tier_transition, housekeeping |

### 6.4 Merkle Verification

**Verify Chain Integrity**:
```bash
POST /api/admin/uds/audit/verify
Content-Type: application/json

{
  "fromSequence": 1,
  "toSequence": 1000
}
```

**Response**:
```json
{
  "isValid": true,
  "treeRoot": "a1b2c3...",
  "entriesVerified": 1000,
  "errors": []
}
```

### 6.5 Export

**Export Audit Log**:
```bash
POST /api/admin/uds/audit/export
Content-Type: application/json

{
  "startDate": "2025-01-01T00:00:00Z",
  "endDate": "2025-12-31T23:59:59Z",
  "format": "json"  // or "csv"
}
```

---

## 7. Upload Management

### 7.1 Upload Flow

```
┌─────────┐    ┌──────────┐    ┌───────────┐    ┌─────────┐    ┌───────┐
│ Initiate│───▶│ Upload to│───▶│  Complete │───▶│  Virus  │───▶│ Ready │
│ Request │    │Quarantine│    │  Upload   │    │  Scan   │    │       │
└─────────┘    └──────────┘    └───────────┘    └─────────┘    └───────┘
                                                      │
                                                      ▼
                                                ┌─────────┐
                                                │Infected │
                                                │(deleted)│
                                                └─────────┘
```

### 7.2 Upload States

| Status | Description |
|--------|-------------|
| `pending` | Presigned URL generated, awaiting upload |
| `scanning` | Virus scan in progress |
| `clean` | Passed virus scan, being processed |
| `infected` | Failed virus scan, file deleted |
| `processing` | Text extraction/thumbnail in progress |
| `ready` | Fully processed, available for download |
| `failed` | Processing failed |
| `deleted` | Soft deleted by user/admin |

### 7.3 API Endpoints

**Initiate Upload**:
```bash
POST /api/v2/uds/uploads/initiate
Content-Type: application/json

{
  "originalFilename": "document.pdf",
  "mimeType": "application/pdf",
  "fileSizeBytes": 1048576,
  "conversationId": "optional-uuid"
}
```

**Response**:
```json
{
  "uploadId": "uuid",
  "presignedUrl": "https://s3...",
  "expiresAt": "2025-01-24T08:00:00Z",
  "maxSizeBytes": 104857600
}
```

**Complete Upload**:
```bash
POST /api/v2/uds/uploads/{uploadId}/complete
Content-Type: application/json

{
  "sha256Hash": "abc123..."
}
```

**Get Download URL**:
```bash
GET /api/v2/uds/uploads/{uploadId}/download
```

---

## 8. GDPR Compliance

### 8.1 Right to Erasure

UDS implements GDPR Article 17 (Right to Erasure) with multi-tier deletion:

```
┌─────────────────────────────────────────────────────────────────────────┐
│                    GDPR ERASURE ORCHESTRATOR                             │
│                                                                          │
│  Erasure Request                                                         │
│       │                                                                  │
│       ├────────────────┬────────────────┬─────────────────┐             │
│       ▼                ▼                ▼                 ▼             │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌────────┐         │
│  │ Hot Tier    │  │ Warm Tier   │  │ Cold Tier   │  │ Backups│         │
│  │ (Redis,     │  │ (Aurora,    │  │ (S3,        │  │        │         │
│  │  DynamoDB)  │  │  uploads)   │  │  Iceberg)   │  │        │         │
│  └─────────────┘  └─────────────┘  └─────────────┘  └────────┘         │
│       │                │                │             │                  │
│       └────────────────┴────────────────┴─────────────┘                  │
│                            │                                             │
│                            ▼                                             │
│                   ┌─────────────────┐                                   │
│                   │ Verification    │                                   │
│                   │ Hash Generated  │                                   │
│                   └─────────────────┘                                   │
└─────────────────────────────────────────────────────────────────────────┘
```

### 8.2 Erasure Scopes

| Scope | Description |
|-------|-------------|
| `user` | Delete all data for a specific user |
| `conversation` | Delete a specific conversation |
| `tenant` | Delete all data for entire tenant |

### 8.3 Create Erasure Request

```bash
POST /api/admin/uds/erasure
Content-Type: application/json

{
  "scope": "user",
  "userId": "uuid-of-user",
  "eraseConversations": true,
  "eraseMessages": true,
  "eraseUploads": true,
  "eraseAuditLog": false,     // Usually keep for compliance
  "eraseFromBackups": false,   // Expensive, requires manual intervention
  "anonymizeRemaining": true,  // Anonymize data we can't delete
  "legalBasis": "gdpr_article_17",
  "legalReference": "User request #12345"
}
```

### 8.4 Erasure Status

| Status | Description |
|--------|-------------|
| `pending` | Request created, not yet started |
| `processing` | Actively deleting data |
| `completed` | All tiers processed successfully |
| `failed` | Error occurred, may be partially complete |
| `partial` | Some tiers completed, others pending |

### 8.5 Verification

Each completed erasure generates a **verification hash** that proves:
- What was deleted
- When it was deleted
- The scope of deletion

This hash is stored in the audit log for compliance proof.

---

## 9. Admin API Reference

**Base URL**: `/api/admin/uds`

### Dashboard

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/dashboard` | Full dashboard with health, stats, config |

### Configuration

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/config` | Get tenant configuration |
| PUT | `/config` | Update tenant configuration |

### Conversations

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/conversations` | List conversations with filters |
| GET | `/conversations/{id}` | Get conversation details |
| DELETE | `/conversations/{id}` | Delete conversation |
| GET | `/conversations/{id}/messages` | List messages |

### Uploads

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/uploads` | List uploads with filters |
| GET | `/uploads/{id}` | Get upload details |
| DELETE | `/uploads/{id}` | Delete upload |

### Audit

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/audit` | List audit entries with filters |
| POST | `/audit/verify` | Verify Merkle chain integrity |
| POST | `/audit/export` | Export audit log |
| GET | `/audit/merkle-trees` | List Merkle trees |

### Tiers

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/tiers` | Get tier health status |
| GET | `/tiers/metrics` | Get tier metrics |
| POST | `/tiers/promote` | Trigger Hot → Warm promotion |
| POST | `/tiers/archive` | Trigger Warm → Cold archival |
| POST | `/tiers/retrieve` | Retrieve from Cold to Warm |
| POST | `/tiers/housekeeping` | Run housekeeping tasks |

### Erasure

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/erasure` | List erasure requests |
| POST | `/erasure` | Create erasure request |
| GET | `/erasure/{id}` | Get erasure request details |
| DELETE | `/erasure/{id}` | Cancel pending erasure |

### Encryption

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/encryption/keys` | List encryption keys |
| POST | `/encryption/rotate` | Rotate encryption key |

### Statistics

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/stats` | Get UDS statistics |

---

## 10. Admin Dashboard

Access the UDS Admin Dashboard at: **Admin Dashboard → Platform → UDS**

### 10.1 Overview Tab

- **Tier Health**: Real-time status of all storage tiers
- **Quick Actions**: Promote, archive, housekeeping buttons
- **Statistics**: Conversation, message, upload, audit counts
- **Distribution**: Visual breakdown of data across tiers

### 10.2 Audit Log Tab

- **Filterable Log**: Filter by category, event type, user
- **Merkle Verification**: Visual indicator of chain integrity
- **Export**: Download audit log for compliance

### 10.3 GDPR Erasure Tab

- **Request List**: All erasure requests with status
- **Create Request**: Form to initiate new erasure
- **Progress Tracking**: Per-tier deletion status

### 10.4 Configuration Tab

- **Tier Settings**: TTL and retention configuration
- **Security Settings**: Encryption, virus scanning status
- **Upload Settings**: Size limits, allowed types
- **GDPR Settings**: Auto-delete, anonymization settings

---

## 11. Configuration

### 11.1 Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `UDS_KMS_KEY_ALIAS` | KMS master key alias | `alias/radiant-uds-master` |
| `UDS_UPLOAD_BUCKET` | Main upload S3 bucket | `radiant-uds-uploads` |
| `UDS_QUARANTINE_BUCKET` | Quarantine S3 bucket | `radiant-uds-quarantine` |
| `UDS_HOT_TTL_SECONDS` | Default hot tier TTL | `86400` |
| `UDS_WARM_RETENTION_DAYS` | Default warm retention | `180` |
| `UDS_COLD_RETENTION_YEARS` | Cold tier retention | `7` |

### 11.2 Per-Tenant Configuration

All settings can be overridden per-tenant via the `uds_config` table or Admin API.

---

## 12. Monitoring

### 12.1 Key Metrics

| Metric | Description | Alert Threshold |
|--------|-------------|-----------------|
| `uds.hot.item_count` | Items in hot tier | >10,000 |
| `uds.warm.storage_bytes` | Warm tier storage | >100GB |
| `uds.cold.storage_bytes` | Cold tier storage | >1TB |
| `uds.hot.cache_hit_rate` | Cache efficiency | <90% |
| `uds.tier.transition_errors` | Failed transitions | >0 |
| `uds.upload.scan_failures` | Virus scan failures | >0 |

### 12.2 CloudWatch Alarms

Recommended alarms:
- Hot tier item count exceeds threshold
- Tier transition error rate
- Upload quarantine backup
- Audit chain verification failure

### 12.3 Housekeeping

Run housekeeping regularly to:
- Promote data between tiers
- Clean up deleted items
- Update tier metrics

**Manual Trigger**:
```bash
POST /api/admin/uds/tiers/housekeeping
```

**Scheduled**: EventBridge rule runs hourly

---

## 13. Troubleshooting

### 13.1 Common Issues

**Upload Stuck in "Scanning"**:
- Check ClamAV Lambda health
- Verify quarantine bucket permissions
- Check CloudWatch logs for scan errors

**High Hot Tier Item Count**:
- Verify TTL configuration
- Check if promotion job is running
- Review access patterns (frequently accessed data stays hot)

**Merkle Chain Verification Failed**:
- Do NOT attempt to fix manually
- Contact security team immediately
- Preserve audit log for investigation

**Erasure Request Failed**:
- Check per-tier status for specific failure
- Review CloudWatch logs
- Retry with smaller scope if needed

### 13.2 Support

For UDS issues:
1. Check CloudWatch logs: `/aws/lambda/radiant-uds-*`
2. Review tier health in Admin Dashboard
3. Contact platform team with request ID

---

## Document History

| Version | Date | Changes |
|---------|------|---------|
| 1.0.0 | 2026-01-24 | Initial release |

---

*This document is part of the RADIANT Platform Documentation.*


---

## Part II: RAWS (Read-After-Write Storage)

## Operations and Administration Guide

---

**Document Version:** 1.1.0  
**RADIANT Platform Version:** v4.19.0  
**Last Updated:** January 2026  

---

## 1. System Overview

RAWS automatically selects optimal AI models using 8-dimension scoring across 13 weight profiles and 7 domains.

### Key Admin Responsibilities

- Model registry management
- Weight profile configuration
- Domain compliance enforcement
- Thermal state management
- Provider health monitoring
- Cost optimization

---

## 2. Regulatory Compliance by Domain

### 2.1 Compliance Matrix

| Domain | Required | Optional | Truth Engine |
|--------|----------|----------|--------------|
| **Healthcare** | HIPAA | FDA 21 CFR Part 11, HITECH | Required |
| **Financial** | SOC 2 Type II | PCI-DSS, GDPR, SOX | Required |
| **Legal** | SOC 2 Type II | GDPR, State Bar Rules | Required |
| **Scientific** | None | FDA 21 CFR Part 11, GLP, IRB | Optional |
| **Creative** | None | FTC Guidelines | Not Required |
| **Engineering** | None | SOC 2, ISO 27001, NIST CSF | Optional |
| **General** | None | None | Not Required |

### 2.2 Domain Regulatory Details

#### Healthcare Domain

**Mandatory Compliance:**
- **HIPAA** (Health Insurance Portability and Accountability Act)
  - Applies to: Any system processing Protected Health Information (PHI)
  - Requirements: Encryption at rest/transit, access controls, audit trails, Business Associate Agreements
  - RAWS Enforcement: Only HIPAA-certified models are eligible; selection filtered before scoring

**Conditional Compliance:**
- **FDA 21 CFR Part 11** (Electronic Records; Electronic Signatures)
  - Applies to: Clinical trials, drug development, medical device decisions
  - Requirements: Electronic record integrity, audit trails, electronic signatures
  - RAWS Enforcement: Models flagged as FDA-eligible when this compliance is required

- **HITECH Act**
  - Extends HIPAA for electronic health records
  - Increases penalties for HIPAA violations

**Admin Actions:**
```bash
# Verify HIPAA-eligible models
radiant-cli raws models list --compliance HIPAA --env production

# Healthcare selection audit
radiant-cli raws audit search --domain healthcare --last 30d --env production
```

#### Financial Domain

**Mandatory Compliance:**
- **SOC 2 Type II**
  - Applies to: Financial services handling customer data
  - Requirements: Security controls, availability, processing integrity, confidentiality, privacy
  - Audit Period: 6-12 months of operational evidence
  - RAWS Enforcement: SOC2-certified models only for financial domain

**Conditional Compliance:**
- **PCI-DSS** (Payment Card Industry Data Security Standard)
  - Applies to: Processing, storing, or transmitting payment card data
  - Requirements: Network security, access control, encryption, testing
  
- **GDPR** (General Data Protection Regulation)
  - Applies to: EU resident financial data
  - Requirements: Data minimization, consent, right to erasure, data portability

- **SOX** (Sarbanes-Oxley Act)
  - Applies to: Publicly traded companies
  - Requirements: Audit trail, internal controls, financial reporting integrity

- **SEC/FINRA Regulations**
  - Investment advice must not mislead
  - AI outputs used in investment decisions face regulatory scrutiny

**Admin Actions:**
```bash
# Financial compliance report
radiant-cli raws compliance report --framework SOC2 --domain financial --env production

# Check models with PCI-DSS
radiant-cli raws models list --compliance PCI_DSS --env production
```

#### Legal Domain

**Mandatory Compliance:**
- **SOC 2 Type II**
  - Protects attorney-client privilege
  - Ensures confidential document security
  - Required for legal tech platforms

**Conditional Compliance:**
- **ABA Model Rules of Professional Conduct**
  - Lawyers remain liable for AI outputs
  - Must maintain competent representation
  - Confidentiality obligations extend to AI tools

- **GDPR**
  - Required for EU data subjects in legal matters
  - Special categories of data (legal proceedings) have heightened protections

- **State Bar Requirements**
  - Many jurisdictions require disclosure of AI use in legal documents
  - Continuing education requirements on AI tools

**Admin Actions:**
```bash
# Legal domain with source citation requirement
radiant-cli raws domains get legal --env production

# Verify citation tracking enabled
radiant-cli raws config get truth_engine.require_citation --domain legal --env production
```

#### Scientific Domain

**No Mandatory Compliance** (varies by research type)

**Conditional Compliance:**
- **FDA 21 CFR Part 11**
  - Applies to: Pharmaceutical research, drug development
  - Required for submissions to regulatory agencies

- **GLP** (Good Laboratory Practice)
  - Applies to: Non-clinical laboratory studies
  - Required for studies submitted to FDA, EPA, etc.

- **IRB Approval** (Institutional Review Board)
  - Applies to: Human subjects research using AI tools
  - Required for federally funded research

- **NIH Data Management Requirements**
  - Data integrity for federally funded research
  - Public access requirements

- **Journal Disclosure Requirements**
  - Many journals require disclosure of AI use
  - ICMJE guidelines on AI authorship

**Admin Actions:**
```bash
# Scientific domain configuration
radiant-cli raws domains get scientific --env production

# Enable FDA compliance for pharma research
radiant-cli raws domains update scientific --add-compliance FDA_21_CFR --env production
```

#### Creative Domain

**No Mandatory Compliance**

**Considerations:**
- **FTC Guidelines**
  - AI-generated advertising may require disclosures
  - Endorsements using AI must be transparent

- **Copyright**
  - Not a compliance requirement but legal consideration
  - AI-generated content copyright status varies by jurisdiction

**Admin Actions:**
```bash
# Creative domain has no compliance requirements
radiant-cli raws domains get creative --env production

# Lowest ECD threshold - hallucinations acceptable
# ECD threshold: 0.20 (vs 0.05 for healthcare)
```

#### Engineering Domain

**No Mandatory Compliance** (varies by application)

**Conditional Compliance:**
- **SOC 2 Type II**
  - Required if AI-generated code processes sensitive data
  - Common for SaaS/enterprise applications

- **ISO 27001**
  - Information security management
  - Enterprise software development

- **NIST Cybersecurity Framework**
  - Recommended for security-sensitive applications
  - Federal government contractors

- **FDA 21 CFR Part 11**
  - Required for medical device software (SaMD)
  - Software in diagnostic or therapeutic devices

- **IEC 62443**
  - Industrial control systems
  - Critical infrastructure software

**Admin Actions:**
```bash
# Engineering domain - compliance varies by use case
radiant-cli raws domains get engineering --env production

# For medical device software, add FDA compliance
radiant-cli raws domains update engineering --add-compliance FDA_21_CFR --tenant medical-device-tenant
```

---

## 3. Weight Profile Management

### 3.1 All 13 System Profiles

| ID | Category | Primary Use |
|----|----------|-------------|
| BALANCED | Optimization | Default, general purpose |
| QUALITY_FIRST | Optimization | Maximum accuracy |
| COST_OPTIMIZED | Optimization | Budget-conscious |
| LATENCY_CRITICAL | Optimization | Real-time applications |
| HEALTHCARE | Domain | Medical/clinical (HIPAA) |
| FINANCIAL | Domain | Finance/investment (SOC2) |
| LEGAL | Domain | Contracts/litigation (SOC2) |
| SCIENTIFIC | Domain | Research/academic |
| CREATIVE | Domain | Content/marketing |
| ENGINEERING | Domain | Code/software |
| SYSTEM_1 | SOFAI | Fast, simple queries |
| SYSTEM_2 | SOFAI | Complex reasoning |
| SYSTEM_2_5 | SOFAI | Maximum reasoning |

### 3.2 Profile Compliance Mapping

```bash
# View profile with compliance requirements
radiant-cli raws profiles get HEALTHCARE --env production

# Output:
id: HEALTHCARE
weights: {Q: 0.30, C: 0.05, L: 0.10, K: 0.15, R: 0.10, P: 0.20, A: 0.05, E: 0.05}
constraints:
  minQualityScore: 80
  requiredCompliance: [HIPAA]
  forcedSystemType: SYSTEM_2
  requireTruthEngine: true
  maxEcdThreshold: 0.05
regulatory_rationale: |
  HIPAA mandatory for PHI. FDA 21 CFR Part 11 optional for clinical trials.
  High compliance weight (P=0.20) ensures only certified models selected.
  Quality threshold (80) prevents low-quality models for medical use.
  System 2 forced - no fast/cheap models for patient safety.
```

---

## 4. Domain Configuration

### 4.1 Domain Settings

```bash
# List all domains
radiant-cli raws domains list --env production

# Output:
┌─────────────┬──────────────────┬─────────┬─────────┬─────────────────┐
│ Domain      │ Profile          │ Min Q   │ ECD     │ Compliance      │
├─────────────┼──────────────────┼─────────┼─────────┼─────────────────┤
│ healthcare  │ HEALTHCARE       │ 80      │ 0.05    │ HIPAA           │
│ financial   │ FINANCIAL        │ 75      │ 0.05    │ SOC2            │
│ legal       │ LEGAL            │ 80      │ 0.05    │ SOC2            │
│ scientific  │ SCIENTIFIC       │ 70      │ 0.08    │ -               │
│ creative    │ CREATIVE         │ -       │ 0.20    │ -               │
│ engineering │ ENGINEERING      │ 70      │ 0.10    │ -               │
│ general     │ BALANCED         │ -       │ 0.10    │ -               │
└─────────────┴──────────────────┴─────────┴─────────┴─────────────────┘
```

### 4.2 Modifying Domain Compliance

```bash
# Add compliance requirement for a tenant's domain usage
radiant-cli raws domains tenant-override \
  --tenant enterprise-tenant \
  --domain engineering \
  --add-compliance SOC2 \
  --add-compliance ISO_27001 \
  --env production

# View tenant override
radiant-cli raws domains get engineering --tenant enterprise-tenant --env production
```

---

## 5. Compliance Monitoring

### 5.1 Compliance Dashboard

```bash
# Generate compliance summary
radiant-cli raws compliance summary --env production

# Output:
Compliance Summary (January 2026)
═══════════════════════════════════════════════════════════════
HIPAA Selections:        12,453 (100% compliant)
SOC2 Selections:         45,892 (100% compliant)
FDA 21 CFR Selections:      234 (100% compliant)
Non-Compliant Attempts:       0 (blocked at filter stage)

By Domain:
  healthcare:  12,453 selections │ HIPAA required │ 0 violations
  financial:   28,743 selections │ SOC2 required  │ 0 violations
  legal:       17,149 selections │ SOC2 required  │ 0 violations
  scientific:   8,234 selections │ optional       │ N/A
  creative:    15,892 selections │ none           │ N/A
  engineering: 22,156 selections │ optional       │ N/A
  general:     34,521 selections │ none           │ N/A
```

### 5.2 Compliance Reports

```bash
# Generate HIPAA compliance report for auditors
radiant-cli raws compliance report \
  --framework HIPAA \
  --period 2026-Q1 \
  --output hipaa-audit-q1-2026.pdf \
  --include-audit-trails \
  --env production

# Generate SOC 2 evidence package
radiant-cli raws compliance evidence \
  --framework SOC2 \
  --period 2025 \
  --output soc2-evidence-2025.zip \
  --env production
```

---

## 6. Model Compliance Status

### 6.1 Viewing Model Compliance

```bash
# List models by compliance certification
radiant-cli raws models list --compliance HIPAA --env production

# Output:
HIPAA-Certified Models (12 total):
┌─────────────────────┬───────────┬─────────┬─────────────────────────┐
│ Model               │ Provider  │ Quality │ Additional Compliance   │
├─────────────────────┼───────────┼─────────┼─────────────────────────┤
│ claude-opus-4-5     │ anthropic │ 87.2    │ SOC2, GDPR, HIPAA       │
│ claude-sonnet-4-5   │ anthropic │ 83.4    │ SOC2, GDPR, HIPAA       │
│ gpt-4o              │ openai    │ 79.2    │ SOC2, HIPAA             │
│ gpt-4-turbo         │ openai    │ 76.5    │ SOC2, HIPAA             │
│ gemini-2.5-pro      │ google    │ 82.3    │ SOC2, HIPAA, ISO_27001  │
│ ...                 │           │         │                         │
└─────────────────────┴───────────┴─────────┴─────────────────────────┘
```

### 6.2 Model Compliance Matrix

```bash
# Full compliance matrix
radiant-cli raws models compliance-matrix --env production

# Output shows which models have which certifications
```

---

## 7. Alerts and Notifications

### 7.1 Compliance Alerts

| Alert | Threshold | Severity | Action |
|-------|-----------|----------|--------|
| HIPAA model disabled | Any | Critical | SNS + PagerDuty |
| SOC2 cert expiring | 30 days | Warning | SNS + Slack |
| Compliance filter blocking >5% | Rate | Warning | SNS |
| Non-compliant selection attempt | Any | Info | Log only |

### 7.2 Alert Configuration

```bash
# Configure compliance alerts
radiant-cli raws alerts set compliance-expiry \
  --framework SOC2 \
  --days-before 30 \
  --severity warning \
  --notify slack:#compliance-alerts \
  --env production
```

---

## 8. Quick Reference

### Common Commands

```bash
# Compliance
radiant-cli raws compliance summary --env production
radiant-cli raws compliance report --framework HIPAA --env production
radiant-cli raws models list --compliance SOC2 --env production

# Domains
radiant-cli raws domains list --env production
radiant-cli raws domains get healthcare --env production

# Profiles  
radiant-cli raws profiles list --env production
radiant-cli raws profiles get HEALTHCARE --env production

# Audit
radiant-cli raws audit search --domain healthcare --last 24h --env production
```

### Compliance Contacts

| Framework | Internal Contact | External Auditor |
|-----------|------------------|------------------|
| HIPAA | compliance@radiant.example.com | [Auditor Name] |
| SOC 2 | security@radiant.example.com | [Auditor Name] |
| GDPR | privacy@radiant.example.com | [DPO Name] |
| FDA | regulatory@radiant.example.com | [Consultant] |

---

**End of Administrator Documentation**

*Version 1.1.0 | January 2026*


## Technical Reference for Engineers and Developers

---

**Document Version:** 1.1.0  
**RADIANT Platform Version:** v4.19.0  
**Last Updated:** January 2026  

---

## 1. System Overview

RAWS (RADIANT AI Weighted Selection) is the real-time model orchestration system that selects optimal AI models using:

- **8-Dimension Scoring**: Quality, Cost, Latency, Capability, Reliability, Compliance, Availability, Learning
- **13 Weight Profiles**: 4 Optimization + 6 Domain + 3 SOFAI
- **7 Domains**: Healthcare, Financial, Legal, Scientific, Creative, Engineering, General
- **106+ Models**: 50 external APIs + 56 self-hosted

---

## 2. Weight Profile System

### 2.1 Profile Categories

| Category | Count | Purpose |
|----------|-------|---------|
| **Optimization** | 4 | General optimization strategies |
| **Domain** | 6 | Domain-specific requirements |
| **SOFAI** | 3 | Cognitive complexity routing |

### 2.2 Complete Profile Matrix

| Profile | Q | C | L | K | R | P | A | E | Focus |
|---------|-----|-----|-----|-----|-----|-----|-----|-----|-------|
| **BALANCED** | 0.25 | 0.20 | 0.15 | 0.15 | 0.10 | 0.05 | 0.05 | 0.05 | Default |
| **QUALITY_FIRST** | 0.40 | 0.10 | 0.10 | 0.15 | 0.10 | 0.05 | 0.05 | 0.05 | Max accuracy |
| **COST_OPTIMIZED** | 0.20 | 0.35 | 0.15 | 0.10 | 0.05 | 0.05 | 0.05 | 0.05 | Min cost |
| **LATENCY_CRITICAL** | 0.15 | 0.10 | 0.35 | 0.15 | 0.10 | 0.05 | 0.05 | 0.05 | Fastest |
| **HEALTHCARE** | 0.30 | 0.05 | 0.10 | 0.15 | 0.10 | 0.20 | 0.05 | 0.05 | Quality+Compliance |
| **FINANCIAL** | 0.30 | 0.10 | 0.10 | 0.15 | 0.10 | 0.15 | 0.05 | 0.05 | Accuracy+Audit |
| **LEGAL** | 0.35 | 0.05 | 0.05 | 0.20 | 0.10 | 0.15 | 0.05 | 0.05 | Citations |
| **SCIENTIFIC** | 0.35 | 0.10 | 0.10 | 0.20 | 0.08 | 0.05 | 0.05 | 0.07 | Research |
| **CREATIVE** | 0.20 | 0.25 | 0.20 | 0.15 | 0.05 | 0.00 | 0.05 | 0.10 | Iteration |
| **ENGINEERING** | 0.30 | 0.15 | 0.15 | 0.20 | 0.10 | 0.00 | 0.05 | 0.05 | Code |
| **SYSTEM_1** | 0.15 | 0.30 | 0.30 | 0.10 | 0.05 | 0.00 | 0.05 | 0.05 | Fast+Cheap |
| **SYSTEM_2** | 0.35 | 0.10 | 0.10 | 0.15 | 0.10 | 0.10 | 0.05 | 0.05 | Reasoning |
| **SYSTEM_2_5** | 0.40 | 0.05 | 0.05 | 0.20 | 0.10 | 0.10 | 0.05 | 0.05 | Max reasoning |

### 2.3 Domain Profile Details

#### HEALTHCARE
- **Weights**: Q=0.30, C=0.05, L=0.10, K=0.15, R=0.10, P=0.20, A=0.05, E=0.05
- **Constraints**: minQuality=80, compliance=[HIPAA], systemType=SYSTEM_2
- **Truth Engine**: Required (ECD threshold: 0.05)
- **Regulatory Requirements**:
  - **HIPAA**: Mandatory for Protected Health Information (PHI). Requires encryption, access controls, audit trails, BAAs.
  - **FDA 21 CFR Part 11**: Required for clinical trials, drug development, medical device decisions.
  - **HITECH Act**: Extends HIPAA for electronic health records.
- **Use Cases**: Medical diagnosis, patient data analysis, clinical documentation

#### FINANCIAL
- **Weights**: Q=0.30, C=0.10, L=0.10, K=0.15, R=0.10, P=0.15, A=0.05, E=0.05
- **Constraints**: minQuality=75, compliance=[SOC2], systemType=SYSTEM_2
- **Truth Engine**: Required (ECD threshold: 0.05)
- **Regulatory Requirements**:
  - **SOC 2 Type II**: Required for security controls, availability, processing integrity, confidentiality.
  - **PCI-DSS**: Required if processing payment card data.
  - **GDPR**: Required for EU resident financial data.
  - **SEC/FINRA**: Investment advice faces regulatory scrutiny.
  - **SOX**: Audit trail requirements for public companies.
- **Use Cases**: Investment analysis, accounting, financial reporting

#### LEGAL
- **Weights**: Q=0.35, C=0.05, L=0.05, K=0.20, R=0.10, P=0.15, A=0.05, E=0.05
- **Constraints**: minQuality=80, compliance=[SOC2], systemType=SYSTEM_2
- **Truth Engine**: Required, source citation required (ECD threshold: 0.05)
- **Regulatory Requirements**:
  - **SOC 2 Type II**: Required for attorney-client privilege protection, confidential documents.
  - **ABA Model Rules**: AI legal research must meet professional responsibility standards.
  - **GDPR**: Required for EU data subjects in legal matters.
  - **State Bar Requirements**: Many jurisdictions require AI use disclosure.
- **Use Cases**: Contract analysis, legal research, compliance documentation

#### SCIENTIFIC
- **Weights**: Q=0.35, C=0.10, L=0.10, K=0.20, R=0.08, P=0.05, A=0.05, E=0.07
- **Constraints**: minQuality=70, source citation required
- **Truth Engine**: Optional (ECD threshold: 0.08)
- **Regulatory Requirements**:
  - **FDA 21 CFR Part 11**: Required for pharmaceutical/drug research.
  - **GLP** (Good Laboratory Practice): For studies submitted to regulatory agencies.
  - **IRB Approval**: Human subjects research may require institutional review.
  - **NIH Data Management**: Data integrity requirements for federally funded research.
- **Use Cases**: Research analysis, data interpretation, peer review assistance

#### CREATIVE
- **Weights**: Q=0.20, C=0.25, L=0.20, K=0.15, R=0.05, P=0.00, A=0.05, E=0.10
- **Constraints**: None (most flexible)
- **Truth Engine**: Not required (ECD threshold: 0.20)
- **Regulatory Requirements**:
  - **None required**: Creative content not subject to regulatory compliance.
  - **FTC Guidelines**: Disclosures may be required for AI-generated advertising.
- **Use Cases**: Content writing, storytelling, brainstorming, marketing copy

#### ENGINEERING
- **Weights**: Q=0.30, C=0.15, L=0.15, K=0.20, R=0.10, P=0.00, A=0.05, E=0.05
- **Constraints**: minQuality=70, preferredCapabilities=[function_calling, tool_use]
- **Truth Engine**: Optional (ECD threshold: 0.10)
- **Regulatory Requirements**:
  - **SOC 2 Type II**: Required if AI-generated code processes sensitive data.
  - **ISO 27001**: Information security management for enterprise software.
  - **NIST Cybersecurity Framework**: Recommended for security-sensitive applications.
  - **FDA 21 CFR Part 11**: Required for medical device software.
  - **IEC 62443**: Required for industrial control systems.
- **Use Cases**: Code generation, code review, debugging, architecture design

---

## 3. Eight-Dimension Scoring

### 3.1 Dimension Calculations

| Dimension | Formula | Range |
|-----------|---------|-------|
| Quality (Q) | Weighted benchmark average | 0-100 |
| Cost (C) | Inverted normalized price | 0-100 |
| Latency (L) | TTFT threshold mapping | 0-100 |
| Capability (K) | matched / required × 100 | 0-100 |
| Reliability (R) | Uptime + error rate composite | 0-100 |
| Compliance (P) | Framework count × 15 | 0-100 |
| Availability (A) | Thermal state mapping | 0-100 |
| Learning (E) | Historical performance | 0-100 |

### 3.2 Composite Score

```typescript
CompositeScore = Q×Wq + C×Wc + L×Wl + K×Wk + R×Wr + P×Wp + A×Wa + E×We
```

Where Σ(weights) = 1.0

---

## 4. Selection Algorithm

### 4.1 Four Phases

```
PHASE 1: FILTER (5ms)
├── Status filter (active only)
├── Capability filter
├── Compliance filter
├── Tier filter
├── System type filter
└── Thermal filter

PHASE 2: SCORE (25ms)
├── Quality scorer
├── Cost scorer
├── Latency scorer
├── Capability scorer
├── Reliability scorer
├── Compliance scorer
├── Availability scorer
└── Learning scorer (parallel)

PHASE 3: RANK (15ms)
├── Apply weights from profile
├── Calculate composite scores
├── Apply neural adjustments
└── Sort by adjusted score

PHASE 4: SELECT (3ms)
├── Select winner
├── Select fallbacks (3)
├── Generate reason
└── Build response
```

### 4.2 Weight Resolution Order

```typescript
async resolveWeights(request, systemType, domain): Promise<ScoringWeights> {
  // 1. Explicit profile ID
  if (request.weightProfileId) {
    return getProfile(request.weightProfileId).weights;
  }
  
  // 2. Optimization preference
  if (request.optimizeFor) {
    return getOptimizationProfile(request.optimizeFor).weights;
  }
  
  // 3. Domain-specific (includes SCIENTIFIC, CREATIVE, ENGINEERING)
  if (domain !== 'general') {
    return getDomainProfile(domain).weights;
  }
  
  // 4. SOFAI system type
  return getSystemProfile(systemType).weights;
}
```

---

## 5. Domain Detection

### 5.1 Keyword Detection

```typescript
const DOMAIN_KEYWORDS = {
  healthcare: ['medical', 'diagnosis', 'patient', 'clinical', ...],
  financial: ['investment', 'stock', 'trading', 'accounting', ...],
  legal: ['contract', 'lawsuit', 'attorney', 'litigation', ...],
  scientific: ['research', 'experiment', 'hypothesis', 'study', ...],
  creative: ['write', 'story', 'creative', 'brainstorm', ...],
  engineering: ['code', 'programming', 'debug', 'api', ...],
};
```

### 5.2 Task Type Mapping

```typescript
const TASK_TYPE_MAP = {
  'medical_qa': 'healthcare',
  'clinical_documentation': 'healthcare',
  'investment_analysis': 'financial',
  'contract_analysis': 'legal',
  'research_analysis': 'scientific',
  'content_writing': 'creative',
  'code_generation': 'engineering',
  'code_review': 'engineering',
  'debugging': 'engineering',
};
```

---

## 6. TypeScript Implementation

### 6.1 Profile Types

```typescript
export type OptimizationProfile = 
  | 'BALANCED' 
  | 'QUALITY_FIRST' 
  | 'COST_OPTIMIZED' 
  | 'LATENCY_CRITICAL';

export type DomainProfile = 
  | 'HEALTHCARE' 
  | 'FINANCIAL' 
  | 'LEGAL' 
  | 'SCIENTIFIC' 
  | 'CREATIVE' 
  | 'ENGINEERING';

export type SOFAIProfile = 
  | 'SYSTEM_1' 
  | 'SYSTEM_2' 
  | 'SYSTEM_2_5';

export type WeightProfileId = 
  | OptimizationProfile 
  | DomainProfile 
  | SOFAIProfile;

export type Domain = 
  | 'healthcare'
  | 'financial'
  | 'legal'
  | 'scientific'
  | 'creative'
  | 'engineering'
  | 'general';
```

### 6.2 Domain to Profile Mapping

```typescript
export const DOMAIN_PROFILE_MAP: Record<Domain, WeightProfileId> = {
  healthcare: 'HEALTHCARE',
  financial: 'FINANCIAL',
  legal: 'LEGAL',
  scientific: 'SCIENTIFIC',
  creative: 'CREATIVE',
  engineering: 'ENGINEERING',
  general: 'BALANCED',
};
```

---

## 7. Database Schema

### 7.1 Weight Profiles Table

```sql
CREATE TABLE raws_weight_profiles (
    id VARCHAR(50) PRIMARY KEY,
    display_name VARCHAR(255) NOT NULL,
    description TEXT,
    category VARCHAR(20) NOT NULL, -- 'optimization', 'domain', 'sofai'
    
    -- Eight dimension weights
    weight_quality NUMERIC(4, 3) NOT NULL,
    weight_cost NUMERIC(4, 3) NOT NULL,
    weight_latency NUMERIC(4, 3) NOT NULL,
    weight_capability NUMERIC(4, 3) NOT NULL,
    weight_reliability NUMERIC(4, 3) NOT NULL,
    weight_compliance NUMERIC(4, 3) NOT NULL,
    weight_availability NUMERIC(4, 3) NOT NULL,
    weight_learning NUMERIC(4, 3) NOT NULL,
    
    -- Domain association
    domain VARCHAR(50),
    
    -- Constraints
    min_quality_score NUMERIC(5, 2),
    required_compliance TEXT[],
    forced_system_type VARCHAR(20),
    
    -- Truth Engine
    require_truth_engine BOOLEAN DEFAULT false,
    require_source_citation BOOLEAN DEFAULT false,
    max_ecd_threshold NUMERIC(4, 3),
    
    CONSTRAINT weights_sum CHECK (ABS(
        weight_quality + weight_cost + weight_latency + weight_capability + 
        weight_reliability + weight_compliance + weight_availability + weight_learning - 1.0
    ) < 0.01)
);
```

### 7.2 Domain Config Table

```sql
CREATE TABLE raws_domain_config (
    id VARCHAR(50) PRIMARY KEY, -- 7 domains
    weight_profile_id VARCHAR(50) REFERENCES raws_weight_profiles(id),
    min_quality_score NUMERIC(5, 2),
    max_ecd_threshold NUMERIC(4, 3),
    required_compliance TEXT[],
    forced_system_type VARCHAR(20),
    require_truth_engine BOOLEAN DEFAULT false,
    require_source_citation BOOLEAN DEFAULT false,
    detection_keywords TEXT[]
);
```

---

## 8. API Examples

### 8.1 Domain-Specific Selection

```typescript
// Engineering domain
const result = await raws.select({
  requiredCapabilities: ['chat', 'function_calling'],
  estimatedInputTokens: 2000,
  estimatedOutputTokens: 1000,
  domain: 'engineering',
});
// Uses ENGINEERING profile: Q=0.30, K=0.20, C=0.15, L=0.15...

// Scientific domain
const result = await raws.select({
  requiredCapabilities: ['chat', 'reasoning'],
  estimatedInputTokens: 3000,
  estimatedOutputTokens: 2000,
  domain: 'scientific',
});
// Uses SCIENTIFIC profile: Q=0.35, K=0.20, E=0.07...

// Creative domain
const result = await raws.select({
  requiredCapabilities: ['chat', 'streaming'],
  estimatedInputTokens: 500,
  estimatedOutputTokens: 2000,
  domain: 'creative',
});
// Uses CREATIVE profile: C=0.25, L=0.20, E=0.10...
```

### 8.2 Auto-Detection

```typescript
// Domain detected from query content
const result = await raws.select({
  requiredCapabilities: ['chat'],
  estimatedInputTokens: 1000,
  estimatedOutputTokens: 500,
  taskType: 'code_review', // Auto-maps to engineering domain
});
```

---

## 9. Testing

### 9.1 Profile Validation

```typescript
describe('WeightProfiles', () => {
  it('should have 13 system profiles', () => {
    expect(Object.keys(WEIGHT_PROFILES)).toHaveLength(13);
  });

  it('all profiles should sum to 1.0', () => {
    for (const profile of Object.values(WEIGHT_PROFILES)) {
      const sum = Object.values(profile.weights).reduce((a, b) => a + b, 0);
      expect(sum).toBeCloseTo(1.0, 2);
    }
  });

  it('should map all 7 domains to profiles', () => {
    expect(Object.keys(DOMAIN_PROFILE_MAP)).toHaveLength(7);
  });
});
```

---

## 10. Performance

### 10.1 Latency Budget

| Phase | Budget | Actual p99 |
|-------|--------|------------|
| Context + Weights | 2ms | 1.5ms |
| Filtering | 5ms | 4ms |
| Scoring (8 dim) | 25ms | 22ms |
| Ranking | 15ms | 12ms |
| Selection | 3ms | 2ms |
| **Total** | **50ms** | **41.5ms** |

---

**End of Engineering Documentation**

*Version 1.1.0 | January 2026*


## API Guide for Developers and Integrators

---

**Document Version:** 1.1.0  
**API Version:** v1  
**Last Updated:** January 2026  

---

## 1. Introduction

RAWS (RADIANT AI Weighted Selection) automatically selects the optimal AI model for your requests based on:

- **Quality**: How accurate the model is
- **Cost**: Price for your usage
- **Latency**: Response speed
- **Capabilities**: Features supported
- **Compliance**: Regulatory certifications

### Why Use RAWS?

| Without RAWS | With RAWS |
|--------------|-----------|
| Manually choose models | Automatic optimization |
| Risk compliance violations | Compliance-aware filtering |
| Static selection | Dynamic, context-aware |
| No fallback handling | Automatic fallback chain |

---

## 2. Quick Start

```bash
curl -X POST https://api.radiant.example.com/v1/raws/select \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "requiredCapabilities": ["chat", "streaming"],
    "estimatedInputTokens": 1000,
    "estimatedOutputTokens": 500
  }'
```

---

## 3. Domain-Specific Selection

RAWS supports 7 domains, each with appropriate compliance requirements:

### 3.1 Domain Overview

| Domain | Use Case | Compliance | Min Quality |
|--------|----------|------------|-------------|
| `healthcare` | Medical, clinical | HIPAA required | 80 |
| `financial` | Investment, accounting | SOC 2 required | 75 |
| `legal` | Contracts, litigation | SOC 2 required | 80 |
| `scientific` | Research, academic | Varies | 70 |
| `creative` | Content, marketing | None | - |
| `engineering` | Code, software | Varies | 70 |
| `general` | Default | None | - |

### 3.2 Healthcare Domain

**When to Use**: Medical queries, patient data, clinical documentation

**Compliance**: HIPAA is **mandatory**. All models must be HIPAA-certified.

**What Happens**:
- Only HIPAA-compliant models considered
- Minimum quality score of 80 enforced
- System 2 reasoning forced (no fast/cheap models)
- Truth Engine verification required (ECD ≤ 0.05)

```json
{
  "requiredCapabilities": ["chat", "tool_use"],
  "estimatedInputTokens": 2000,
  "estimatedOutputTokens": 1500,
  "domain": "healthcare"
}
```

**Typical Models Selected**: claude-sonnet-4-5, gpt-4o, gemini-2.5-pro (all HIPAA-certified)

### 3.3 Financial Domain

**When to Use**: Investment analysis, accounting, financial reporting, tax

**Compliance**: SOC 2 Type II is **mandatory**. 

**What Happens**:
- Only SOC 2 certified models considered
- Minimum quality score of 75 enforced
- System 2 reasoning forced
- Truth Engine verification required (ECD ≤ 0.05)

```json
{
  "requiredCapabilities": ["chat", "function_calling"],
  "estimatedInputTokens": 2000,
  "estimatedOutputTokens": 1500,
  "domain": "financial"
}
```

### 3.4 Legal Domain

**When to Use**: Contract analysis, legal research, compliance documentation

**Compliance**: SOC 2 Type II is **mandatory**. Source citations required.

**What Happens**:
- Only SOC 2 certified models considered
- Minimum quality score of 80 enforced
- System 2 reasoning forced
- Source citation verification enabled
- Truth Engine required (ECD ≤ 0.05)

```json
{
  "requiredCapabilities": ["chat", "tool_use"],
  "estimatedInputTokens": 3000,
  "estimatedOutputTokens": 2000,
  "domain": "legal"
}
```

### 3.5 Scientific Domain

**When to Use**: Research analysis, data interpretation, academic writing

**Compliance**: Varies by research type. FDA 21 CFR Part 11 for pharmaceutical research.

**What Happens**:
- Source citation required
- Minimum quality score of 70
- Slightly relaxed ECD threshold (0.08)
- No forced compliance (specify if needed)

```json
{
  "requiredCapabilities": ["chat", "reasoning"],
  "estimatedInputTokens": 3000,
  "estimatedOutputTokens": 2000,
  "domain": "scientific"
}
```

**For FDA-regulated research**, add compliance:
```json
{
  "domain": "scientific",
  "requiredCompliance": ["FDA_21_CFR"]
}
```

### 3.6 Creative Domain

**When to Use**: Content writing, storytelling, marketing copy, brainstorming

**Compliance**: None required. Most flexible domain.

**What Happens**:
- No compliance filtering
- No minimum quality threshold
- Cost and latency optimized (weights: C=0.25, L=0.20)
- Learning dimension emphasized (E=0.10)
- High ECD tolerance (0.20) - creative license allowed

```json
{
  "requiredCapabilities": ["chat", "streaming"],
  "estimatedInputTokens": 500,
  "estimatedOutputTokens": 2000,
  "domain": "creative"
}
```

### 3.7 Engineering Domain

**When to Use**: Code generation, debugging, architecture design, DevOps

**Compliance**: Varies. SOC 2 recommended for sensitive applications.

**What Happens**:
- Minimum quality score of 70 (code must work)
- Capability dimension emphasized (K=0.20)
- Prefers models with function_calling and tool_use
- Moderate ECD threshold (0.10)

```json
{
  "requiredCapabilities": ["chat", "function_calling"],
  "estimatedInputTokens": 2000,
  "estimatedOutputTokens": 1500,
  "domain": "engineering"
}
```

**For medical device software**, add FDA compliance:
```json
{
  "domain": "engineering",
  "requiredCompliance": ["FDA_21_CFR", "SOC2"]
}
```

---

## 4. Compliance Options

### 4.1 Available Compliance Frameworks

| Framework | Code | When Required |
|-----------|------|---------------|
| HIPAA | `HIPAA` | Healthcare/medical data |
| SOC 2 Type II | `SOC2` | Financial, legal, enterprise |
| GDPR | `GDPR` | EU data subjects |
| FDA 21 CFR Part 11 | `FDA_21_CFR` | Pharma, medical devices |
| PCI-DSS | `PCI_DSS` | Payment card data |
| CCPA | `CCPA` | California consumer data |
| ISO 27001 | `ISO_27001` | Enterprise security |

### 4.2 Specifying Compliance

**Single Framework**:
```json
{
  "requiredCapabilities": ["chat"],
  "estimatedInputTokens": 1000,
  "estimatedOutputTokens": 500,
  "requiredCompliance": ["HIPAA"]
}
```

**Multiple Frameworks**:
```json
{
  "requiredCapabilities": ["chat"],
  "estimatedInputTokens": 1000,
  "estimatedOutputTokens": 500,
  "requiredCompliance": ["SOC2", "GDPR", "ISO_27001"]
}
```

### 4.3 Domain vs. Explicit Compliance

Using `domain` automatically sets compliance:

```json
// These are equivalent:
{ "domain": "healthcare" }
{ "requiredCompliance": ["HIPAA"] }

// Domain also sets quality threshold, system type, Truth Engine
// So domain is preferred over explicit compliance alone
```

---

## 5. Optimization Strategies

### 5.1 Use Optimization Preferences

```json
// Cost-optimized
{ "optimizeFor": "cost" }

// Quality-optimized  
{ "optimizeFor": "quality" }

// Latency-optimized
{ "optimizeFor": "latency" }

// Balanced (default)
{ "optimizeFor": "balanced" }
```

### 5.2 Combine Domain with Optimization

```json
{
  "requiredCapabilities": ["chat"],
  "estimatedInputTokens": 1000,
  "estimatedOutputTokens": 500,
  "domain": "engineering",
  "optimizeFor": "cost"  // Cost-optimize within engineering constraints
}
```

### 5.3 Set Hard Constraints

```json
{
  "requiredCapabilities": ["chat"],
  "estimatedInputTokens": 1000,
  "estimatedOutputTokens": 500,
  "maxPrice": 0.01,        // Max $0.01 per request
  "minQuality": 75,        // At least 75 quality score
  "maxLatencyMs": 1000     // Under 1 second
}
```

---

## 6. Understanding Selection Results

### 6.1 Response Structure

```json
{
  "selection": {
    "modelId": "claude-sonnet-4-5",
    "providerId": "anthropic",
    "displayName": "Claude Sonnet 4.5",
    "score": 85.2,
    "estimatedPrice": 0.0115,
    "estimatedLatencyMs": 450,
    "reason": "Selected for engineering domain. HIPAA compliant. High capability score."
  },
  "fallbacks": [...],
  "scoring": {
    "dimensionScores": {
      "quality": 83,
      "cost": 70,
      "latency": 85,
      "capability": 100,
      "reliability": 95,
      "compliance": 100,
      "availability": 100,
      "learning": 60
    },
    "weightsUsed": {
      "Q": 0.30, "C": 0.15, "L": 0.15, "K": 0.20,
      "R": 0.10, "P": 0.00, "A": 0.05, "E": 0.05
    },
    "weightProfileId": "ENGINEERING"
  },
  "metadata": {
    "systemType": "SYSTEM_2",
    "domain": "engineering",
    "selectionTimeMs": 23
  }
}
```

### 6.2 Compliance Score

The compliance score (P) in `dimensionScores` reflects:
- 100: Model has all required compliance certifications
- 0: Model filtered out (you won't see this - it's excluded)

If you request HIPAA compliance, only HIPAA-certified models are returned.

---

## 7. SDK Examples

### 7.1 JavaScript/TypeScript

```typescript
import { RAWSClient } from '@radiant/raws-client';

const raws = new RAWSClient({ apiKey: process.env.RADIANT_API_KEY });

// Healthcare selection (automatic HIPAA compliance)
const healthcareResult = await raws.select({
  requiredCapabilities: ['chat', 'tool_use'],
  estimatedInputTokens: 2000,
  estimatedOutputTokens: 1500,
  domain: 'healthcare',
});

// Engineering selection
const engineeringResult = await raws.select({
  requiredCapabilities: ['chat', 'function_calling'],
  estimatedInputTokens: 2000,
  estimatedOutputTokens: 1000,
  domain: 'engineering',
});

// Creative selection (cost-optimized)
const creativeResult = await raws.select({
  requiredCapabilities: ['chat', 'streaming'],
  estimatedInputTokens: 500,
  estimatedOutputTokens: 2000,
  domain: 'creative',
  optimizeFor: 'cost',
});
```

### 7.2 Python

```python
from radiant_raws import RAWSClient

raws = RAWSClient(api_key="your-api-key")

# Healthcare (HIPAA enforced)
result = raws.select(
    required_capabilities=["chat", "tool_use"],
    estimated_input_tokens=2000,
    estimated_output_tokens=1500,
    domain="healthcare",
)

# Financial (SOC 2 enforced)
result = raws.select(
    required_capabilities=["chat", "function_calling"],
    estimated_input_tokens=2000,
    estimated_output_tokens=1500,
    domain="financial",
)
```

---

## 8. Best Practices

### 8.1 Always Specify Domain for Regulated Use Cases

```typescript
// ❌ Don't rely on auto-detection for regulated domains
const result = await raws.select({
  requiredCapabilities: ['chat'],
  estimatedInputTokens: 1000,
  estimatedOutputTokens: 500,
  // Missing domain - might not get HIPAA compliance
});

// ✅ Explicitly specify domain
const result = await raws.select({
  requiredCapabilities: ['chat'],
  estimatedInputTokens: 1000,
  estimatedOutputTokens: 500,
  domain: 'healthcare',  // Guarantees HIPAA compliance
});
```

### 8.2 Check Compliance in Response

```typescript
const result = await raws.select({ domain: 'healthcare', ... });

// Verify compliance was applied
console.log(result.scoring.dimensionScores.compliance); // Should be 100
console.log(result.metadata.domain); // Should be 'healthcare'
```

### 8.3 Use Appropriate Domain for Your Use Case

| Use Case | Recommended Domain |
|----------|-------------------|
| Patient chatbot | `healthcare` |
| Investment advisor | `financial` |
| Contract review | `legal` |
| Research assistant | `scientific` |
| Blog writer | `creative` |
| Code assistant | `engineering` |
| General Q&A | `general` |

---

## 9. FAQ

**Q: What happens if I request a domain but don't have models with required compliance?**

A: You'll receive error `RAWS_005: Compliance requirement not met`. This means no models in your tier have the required certification. Contact support to upgrade.

**Q: Can I use healthcare models for non-healthcare purposes?**

A: Yes, HIPAA-certified models can be used for any purpose. The certification means they *can* handle PHI, not that they *must*.

**Q: How do I know which models have which compliance?**

A: The selection response includes the model's compliance. You can also query the model registry:
```bash
curl https://api.radiant.example.com/v1/raws/models?compliance=HIPAA
```

**Q: Is the engineering domain appropriate for medical device software?**

A: Use `engineering` domain with explicit `requiredCompliance: ["FDA_21_CFR", "SOC2"]` for medical device software development.

---

## 10. Error Reference

| Code | Description | Resolution |
|------|-------------|------------|
| `RAWS_001` | No eligible models | Reduce requirements |
| `RAWS_005` | Compliance not met | Check tier/requirements |
| `RAWS_006` | Tier restriction | Upgrade subscription |

---

## 11. Contact

**Documentation**: https://docs.radiant.example.com/raws

**Compliance Questions**: compliance@radiant.example.com

**Support**: support@radiant.example.com

---

**End of User Documentation**

*Version 1.1.0 | January 2026*


---

## Part III: Data Lifecycle

## Overview

This document defines data retention periods and deletion procedures for all data stored in the RADIANT platform.

## Retention Schedule

### User Data

| Data Type | Active Retention | Archive | Total Retention | Deletion |
|-----------|------------------|---------|-----------------|----------|
| Account info | Active + 30 days | N/A | Account lifetime + 30 days | Automatic |
| Usage history | 2 years | 5 years | 7 years | Automatic |
| Chat history | 90 days | 1 year | 1 year | Automatic |
| Uploaded files | Active | 30 days post-delete | Active + 30 days | On request |
| API keys | Active | N/A | Revoked + 90 days | Automatic |

### System Data

| Data Type | Retention | Purpose | Deletion |
|-----------|-----------|---------|----------|
| Audit logs | 7 years | Compliance | Automatic |
| Access logs | 2 years | Security | Automatic |
| Error logs | 90 days | Debugging | Automatic |
| Metrics | 15 months | CloudWatch default | Automatic |
| Backups | 35 days | Recovery | Automatic |

### Billing Data

| Data Type | Retention | Purpose | Legal Basis |
|-----------|-----------|---------|-------------|
| Invoices | 7 years | Tax compliance | Legal requirement |
| Transactions | 7 years | Financial audit | Legal requirement |
| Payment methods | Active | Processing | Contract |
| Receipts | 7 years | Tax compliance | Legal requirement |

## Implementation

### Database Retention

```sql
-- Automatic data cleanup job (runs daily)
CREATE OR REPLACE FUNCTION cleanup_expired_data()
RETURNS void AS $$
BEGIN
  -- Delete expired chat messages (90 days)
  DELETE FROM chat_messages 
  WHERE created_at < NOW() - INTERVAL '90 days'
  AND archived = false;
  
  -- Archive chat messages older than 90 days
  UPDATE chat_messages 
  SET archived = true, archived_at = NOW()
  WHERE created_at < NOW() - INTERVAL '90 days'
  AND archived = false;
  
  -- Delete archived messages older than 1 year
  DELETE FROM chat_messages
  WHERE archived = true
  AND archived_at < NOW() - INTERVAL '1 year';
  
  -- Delete revoked API keys (90 days after revocation)
  DELETE FROM api_keys
  WHERE revoked_at < NOW() - INTERVAL '90 days';
  
  -- Delete expired sessions
  DELETE FROM user_sessions
  WHERE expires_at < NOW();
  
  -- Log cleanup
  INSERT INTO system_jobs (job_name, completed_at, records_affected)
  VALUES ('cleanup_expired_data', NOW(), 
    (SELECT count(*) FROM pg_stat_user_tables WHERE relname IN 
      ('chat_messages', 'api_keys', 'user_sessions')));
END;
$$ LANGUAGE plpgsql;

-- Schedule daily at 3 AM UTC
SELECT cron.schedule('data-cleanup', '0 3 * * *', 'SELECT cleanup_expired_data()');
```

### S3 Lifecycle Policies

```typescript
const bucket = new s3.Bucket(this, 'Storage', {
  lifecycleRules: [
    // User uploads - delete 30 days after object deletion marker
    {
      id: 'delete-old-versions',
      noncurrentVersionExpiration: cdk.Duration.days(30),
    },
    
    // Temp files - delete after 7 days
    {
      id: 'cleanup-temp',
      prefix: 'temp/',
      expiration: cdk.Duration.days(7),
    },
    
    // Logs - transition to Glacier after 90 days, delete after 2 years
    {
      id: 'archive-logs',
      prefix: 'logs/',
      transitions: [
        {
          storageClass: s3.StorageClass.GLACIER,
          transitionAfter: cdk.Duration.days(90),
        },
      ],
      expiration: cdk.Duration.days(730), // 2 years
    },
    
    // Backups - delete after 35 days
    {
      id: 'cleanup-backups',
      prefix: 'backups/',
      expiration: cdk.Duration.days(35),
    },
  ],
});
```

### CloudWatch Log Retention

```typescript
// Set retention for all log groups
const logRetention: Record<string, logs.RetentionDays> = {
  // Application logs
  '/aws/lambda/radiant-*': logs.RetentionDays.THREE_MONTHS,
  
  // API Gateway logs
  '/aws/apigateway/radiant-*': logs.RetentionDays.THREE_MONTHS,
  
  // Database logs (longer for compliance)
  '/aws/rds/cluster/radiant-*': logs.RetentionDays.TWO_YEARS,
  
  // Audit logs (longest retention)
  '/radiant/audit/*': logs.RetentionDays.TEN_YEARS,
};
```

## Data Deletion

### User-Initiated Deletion

#### Account Deletion Flow

```typescript
async function deleteUserAccount(userId: string): Promise<void> {
  // 1. Verify identity (MFA required)
  await verifyIdentity(userId);
  
  // 2. Cancel active subscriptions
  await cancelSubscriptions(userId);
  
  // 3. Export data (optional, user-requested)
  const exportUrl = await exportUserData(userId);
  
  // 4. Mark account for deletion (30-day grace period)
  await markForDeletion(userId, {
    scheduledAt: addDays(new Date(), 30),
    reason: 'user_requested',
  });
  
  // 5. Send confirmation email
  await sendDeletionConfirmation(userId, exportUrl);
}

// Actual deletion after grace period
async function executeAccountDeletion(userId: string): Promise<void> {
  // Delete in order (respect foreign keys)
  await deleteApiKeys(userId);
  await deleteChatHistory(userId);
  await deleteFiles(userId);
  await deletePreferences(userId);
  await deleteBillingHistory(userId); // Anonymize, don't delete
  await deleteAccount(userId);
  
  // Anonymize audit logs
  await anonymizeAuditLogs(userId);
  
  // Log deletion for compliance
  await logAccountDeletion(userId);
}
```

#### Data Categories Deleted

| Category | Action | Timing |
|----------|--------|--------|
| Profile | Delete | Immediate |
| Preferences | Delete | Immediate |
| Chat history | Delete | Immediate |
| Files | Delete | Immediate |
| API keys | Revoke + Delete | Immediate |
| Billing history | Anonymize | Immediate |
| Audit logs | Anonymize | Immediate |
| Backups | Excluded | Expires naturally |

### Administrative Deletion

```typescript
// Bulk deletion for compliance (e.g., GDPR request)
async function adminBulkDelete(
  tenantId: string,
  options: {
    dataTypes: string[];
    olderThan: Date;
    reason: string;
    approvedBy: string[];
  }
): Promise<DeletionReport> {
  // Require dual admin approval
  if (options.approvedBy.length < 2) {
    throw new Error('Dual admin approval required');
  }
  
  // Log the deletion request
  await logAdminAction({
    action: 'bulk_delete',
    tenantId,
    options,
  });
  
  // Execute deletion
  const results = await Promise.all(
    options.dataTypes.map(type => 
      deleteDataByType(tenantId, type, options.olderThan)
    )
  );
  
  return {
    requestId: generateRequestId(),
    deletedAt: new Date(),
    recordsDeleted: results.reduce((a, b) => a + b, 0),
    dataTypes: options.dataTypes,
  };
}
```

### Tenant Offboarding

```typescript
async function offboardTenant(tenantId: string): Promise<void> {
  // 1. Export all data (required for compliance)
  const exportUrl = await exportTenantData(tenantId);
  
  // 2. Notify all users
  await notifyTenantUsers(tenantId, 'account_closing');
  
  // 3. Wait for grace period (30 days default)
  await scheduleTenantDeletion(tenantId, {
    gracePeriod: 30,
    exportUrl,
  });
  
  // 4. After grace period, delete all data
  // (Handled by scheduled job)
}
```

## Legal Holds

### Implementing a Legal Hold

```sql
-- Legal hold table
CREATE TABLE legal_holds (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES tenants(id),
  user_id UUID REFERENCES users(id),
  hold_type VARCHAR(50) NOT NULL, -- 'litigation', 'investigation', 'regulatory'
  description TEXT,
  started_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ,
  created_by UUID REFERENCES administrators(id),
  CONSTRAINT legal_holds_target CHECK (tenant_id IS NOT NULL OR user_id IS NOT NULL)
);

-- Prevent deletion of held data
CREATE OR REPLACE FUNCTION check_legal_hold()
RETURNS TRIGGER AS $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM legal_holds 
    WHERE (tenant_id = OLD.tenant_id OR user_id = OLD.user_id)
    AND (expires_at IS NULL OR expires_at > NOW())
  ) THEN
    RAISE EXCEPTION 'Cannot delete data under legal hold';
  END IF;
  RETURN OLD;
END;
$$ LANGUAGE plpgsql;
```

### Suspending Retention Policies

```typescript
// Suspend automatic deletion during legal hold
async function applyLegalHold(params: {
  holdId: string;
  scope: 'tenant' | 'user';
  targetId: string;
}): Promise<void> {
  // Update retention flags
  await updateRetentionPolicy(params.targetId, {
    suspended: true,
    holdId: params.holdId,
  });
  
  // Exclude from cleanup jobs
  await excludeFromCleanup(params.targetId);
  
  // Notify compliance team
  await notifyCompliance('legal_hold_applied', params);
}
```

## Audit Trail

### Retention Actions Log

```sql
-- Log all retention-related actions
CREATE TABLE retention_actions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  action_type VARCHAR(50) NOT NULL, -- 'delete', 'archive', 'export', 'hold'
  target_type VARCHAR(50) NOT NULL, -- 'user', 'tenant', 'data_type'
  target_id VARCHAR(255) NOT NULL,
  records_affected INTEGER,
  performed_by UUID,
  reason TEXT,
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for compliance queries
CREATE INDEX idx_retention_actions_date ON retention_actions(created_at);
CREATE INDEX idx_retention_actions_target ON retention_actions(target_type, target_id);
```

### Compliance Reporting

```typescript
// Generate retention compliance report
async function generateRetentionReport(
  startDate: Date,
  endDate: Date
): Promise<RetentionReport> {
  return {
    period: { start: startDate, end: endDate },
    
    // Data deleted by type
    deletions: await getRetentionActions('delete', startDate, endDate),
    
    // Data archived
    archives: await getRetentionActions('archive', startDate, endDate),
    
    // Active legal holds
    legalHolds: await getActiveLegalHolds(),
    
    // Policy violations (data past retention not deleted)
    violations: await getRetentionViolations(),
    
    // User deletion requests
    userRequests: await getUserDeletionRequests(startDate, endDate),
  };
}
```

## Verification

### Monthly Retention Audit

- [ ] Verify cleanup jobs running successfully
- [ ] Check for retention policy violations
- [ ] Review legal holds status
- [ ] Verify S3 lifecycle policies active
- [ ] Confirm CloudWatch log retention settings
- [ ] Review user deletion requests processed
- [ ] Update retention schedule if needed

### Compliance Queries

```sql
-- Find data past retention period
SELECT 
  'chat_messages' as table_name,
  COUNT(*) as records,
  MIN(created_at) as oldest_record
FROM chat_messages
WHERE created_at < NOW() - INTERVAL '90 days'
AND archived = false

UNION ALL

SELECT 
  'api_keys' as table_name,
  COUNT(*) as records,
  MIN(revoked_at) as oldest_record
FROM api_keys
WHERE revoked_at < NOW() - INTERVAL '90 days';
```

## Contact

| Role | Contact | Purpose |
|------|---------|---------|
| Data Protection Officer | dpo@radiant.example.com | GDPR requests |
| Legal | legal@radiant.example.com | Legal holds |
| Compliance | compliance@radiant.example.com | Audit questions |


## Overview

This guide provides strategies for optimizing AWS costs for the RADIANT platform while maintaining performance and reliability.

## Current Architecture Costs

### Estimated Monthly Costs by Tier

| Tier | Infrastructure | Est. Monthly Cost |
|------|---------------|-------------------|
| SEED (Dev) | Minimal | $50-150 |
| STARTUP | Small production | $200-400 |
| GROWTH | Self-hosted models | $1,000-2,500 |
| SCALE | Multi-region | $4,000-8,000 |
| ENTERPRISE | Global, full HA | $15,000-35,000 |

### Cost Breakdown by Service

| Service | % of Total | Optimization Potential |
|---------|------------|------------------------|
| Aurora | 30-40% | High |
| Lambda | 15-25% | Medium |
| API Gateway | 5-10% | Low |
| S3 | 5-10% | Medium |
| CloudFront | 5-10% | Low |
| ElastiCache | 10-15% | Medium |
| Other | 10-15% | Varies |

## Optimization Strategies

### 1. Database Optimization

#### Aurora Serverless v2

```typescript
// Use Serverless v2 for variable workloads
const cluster = new rds.DatabaseCluster(this, 'Database', {
  serverlessV2MinCapacity: 0.5,   // Scale to near-zero
  serverlessV2MaxCapacity: 16,    // Scale up when needed
});
```

**Savings:** 40-60% vs. provisioned instances for variable workloads

#### Reserved Instances (Steady Workloads)

```bash
# Purchase reserved capacity for predictable workloads
aws rds purchase-reserved-db-instances-offering \
  --reserved-db-instances-offering-id xxx \
  --db-instance-count 1
```

**Savings:** 30-60% for 1-3 year terms

#### Read Replicas Strategy

```typescript
// Use read replicas only when needed
// Scale readers with traffic
readers: [
  rds.ClusterInstance.serverlessV2('reader', {
    scaleWithWriter: true,  // Auto-scale with primary
  }),
],
```

### 2. Lambda Optimization

#### Right-Size Memory

```typescript
// Test different memory sizes to find optimal cost/performance
const memoryOptions = [256, 512, 1024, 2048];

// Use AWS Lambda Power Tuning tool
// https://github.com/alexcasalboni/aws-lambda-power-tuning
```

| Function Type | Recommended Memory | Reason |
|---------------|-------------------|--------|
| Simple CRUD | 256-512 MB | Light compute |
| API Router | 512-1024 MB | Balanced |
| AI Processing | 1024-2048 MB | Heavy compute |

#### Provisioned Concurrency (Strategic)

```typescript
// Only use for latency-critical functions
new lambda.Alias(this, 'LiveAlias', {
  aliasName: 'live',
  version: fn.currentVersion,
  provisionedConcurrentExecutions: 5,  // Keep 5 warm
});
```

**Cost:** ~$0.015/hour per provisioned instance
**Use when:** P99 latency requirements < 200ms

#### ARM64 (Graviton2)

```typescript
// 20% cheaper, often faster
const fn = new lambda.Function(this, 'Function', {
  architecture: lambda.Architecture.ARM_64,
  runtime: lambda.Runtime.NODEJS_20_X,
});
```

**Savings:** 20% on compute costs

### 3. S3 Optimization

#### Intelligent Tiering

```typescript
const bucket = new s3.Bucket(this, 'Storage', {
  intelligentTieringConfigurations: [{
    name: 'auto-tier',
    archiveAccessTierTime: cdk.Duration.days(90),
    deepArchiveAccessTierTime: cdk.Duration.days(180),
  }],
});
```

**Savings:** Up to 95% for infrequently accessed data

#### Lifecycle Rules

```typescript
const bucket = new s3.Bucket(this, 'Storage', {
  lifecycleRules: [
    // Move old versions to cheaper storage
    {
      noncurrentVersionTransitions: [
        {
          storageClass: s3.StorageClass.INFREQUENT_ACCESS,
          transitionAfter: cdk.Duration.days(30),
        },
        {
          storageClass: s3.StorageClass.GLACIER,
          transitionAfter: cdk.Duration.days(90),
        },
      ],
    },
    // Delete old logs
    {
      prefix: 'logs/',
      expiration: cdk.Duration.days(90),
    },
  ],
});
```

### 4. API Gateway Optimization

#### HTTP API vs REST API

```typescript
// HTTP API is 70% cheaper than REST API
// Use when you don't need REST API features

// HTTP API: $1.00/million requests
// REST API: $3.50/million requests
```

| Feature | REST API | HTTP API |
|---------|----------|----------|
| Cost | $3.50/M | $1.00/M |
| Lambda integration | Yes | Yes |
| Request validation | Yes | No |
| API keys/usage plans | Yes | No |
| Caching | Yes | No |

#### Caching

```typescript
// Enable caching for GET endpoints
const method = resource.addMethod('GET', integration, {
  cacheKeyParameters: ['method.request.querystring.id'],
});

// Cache stage setting
stage.cacheClusterEnabled = true;
stage.cacheClusterSize = '0.5';  // 0.5 GB minimum
```

**Note:** Cache costs $0.02/hour (0.5 GB). Calculate break-even point.

### 5. CloudWatch Optimization

#### Log Retention

```typescript
// Don't keep logs forever
new logs.LogGroup(this, 'LogGroup', {
  retention: logs.RetentionDays.ONE_MONTH,  // Adjust per environment
});
```

| Environment | Retention | Reason |
|-------------|-----------|--------|
| Development | 7 days | Quick debugging |
| Staging | 14 days | Testing cycles |
| Production | 90 days | Compliance needs |

#### Metric Filters vs. Logs Insights

```typescript
// Use metric filters for known patterns
// Cheaper than running Logs Insights queries repeatedly

new logs.MetricFilter(this, 'ErrorMetric', {
  logGroup,
  metricNamespace: 'Radiant',
  metricName: 'Errors',
  filterPattern: logs.FilterPattern.literal('ERROR'),
});
```

### 6. ElastiCache Optimization

#### Reserved Nodes

```bash
# Purchase reserved nodes for production
aws elasticache purchase-reserved-cache-nodes-offering \
  --reserved-cache-nodes-offering-id xxx
```

**Savings:** 30-55% for 1-3 year terms

#### Right-Size Nodes

| Use Case | Recommended | Memory |
|----------|-------------|--------|
| Development | cache.t3.micro | 0.5 GB |
| Small Prod | cache.t3.small | 1.4 GB |
| Medium Prod | cache.r6g.large | 13 GB |
| Large Prod | cache.r6g.xlarge | 26 GB |

### 7. Data Transfer Optimization

#### Use VPC Endpoints

```typescript
// Avoid NAT Gateway costs for AWS services
vpc.addInterfaceEndpoint('S3Endpoint', {
  service: ec2.InterfaceVpcEndpointAwsService.S3,
});

vpc.addInterfaceEndpoint('SecretsManagerEndpoint', {
  service: ec2.InterfaceVpcEndpointAwsService.SECRETS_MANAGER,
});
```

**Savings:** $0.045/GB saved vs. NAT Gateway

#### CloudFront for S3

```typescript
// Serve S3 content through CloudFront
// Cheaper data transfer + better performance
const distribution = new cloudfront.Distribution(this, 'CDN', {
  defaultBehavior: {
    origin: new origins.S3Origin(bucket),
  },
});
```

## Cost Monitoring

### AWS Cost Explorer

```bash
# Get cost breakdown by service
aws ce get-cost-and-usage \
  --time-period Start=2024-12-01,End=2024-12-31 \
  --granularity MONTHLY \
  --metrics BlendedCost \
  --group-by Type=DIMENSION,Key=SERVICE
```

### CloudWatch Billing Alerts

```typescript
// Alert before surprise bills
new cloudwatch.Alarm(this, 'BillingAlarm', {
  metric: new cloudwatch.Metric({
    namespace: 'AWS/Billing',
    metricName: 'EstimatedCharges',
    dimensionsMap: { Currency: 'USD' },
    statistic: 'Maximum',
    period: cdk.Duration.hours(6),
  }),
  threshold: 1000,  // $1000 threshold
  evaluationPeriods: 1,
});
```

### Cost Allocation Tags

```typescript
// Tag all resources for cost tracking
cdk.Tags.of(this).add('Project', 'radiant');
cdk.Tags.of(this).add('Environment', environment);
cdk.Tags.of(this).add('CostCenter', 'platform');
```

## Environment-Specific Recommendations

### Development

- Use Aurora Serverless v2 (scales to zero)
- Minimal Lambda memory
- No provisioned concurrency
- Short log retention
- Single-AZ deployments

**Target:** < $100/month

### Staging

- Aurora Serverless v2
- Moderate Lambda memory
- No provisioned concurrency
- 14-day log retention
- Single-AZ acceptable

**Target:** < $300/month

### Production

- Aurora Serverless v2 or Reserved (if predictable)
- Right-sized Lambda memory
- Provisioned concurrency for critical paths
- 90-day log retention
- Multi-AZ required

**Target:** Optimize for reliability, then cost

## Monthly Cost Review Checklist

- [ ] Review AWS Cost Explorer for anomalies
- [ ] Check for unused resources (idle RDS, orphan EBS)
- [ ] Review Lambda right-sizing opportunities
- [ ] Check S3 storage class distribution
- [ ] Review data transfer costs
- [ ] Validate reserved capacity utilization
- [ ] Update cost allocation tags
- [ ] Project next month's costs

## Tools

- [AWS Cost Explorer](https://console.aws.amazon.com/cost-management/home)
- [AWS Trusted Advisor](https://console.aws.amazon.com/trustedadvisor/)
- [AWS Compute Optimizer](https://console.aws.amazon.com/compute-optimizer/)
- [Lambda Power Tuning](https://github.com/alexcasalboni/aws-lambda-power-tuning)
- [Infracost](https://www.infracost.io/) - Cost estimation for IaC


---

## Part IV: File Services

> **Version**: 4.18.55  
> **Last Updated**: December 2024  
> **Status**: Production Ready

---

## Overview

The **Intelligent File Conversion Service** is a Radiant-side system that automatically decides when and how to convert files for AI providers. The core principle is **"Let Radiant decide, not Think Tank"** - Think Tank simply drops files, and Radiant determines the optimal conversion strategy based on the target AI provider's capabilities.

### Key Principles

1. **Think Tank submits files without worrying about provider compatibility**
2. **Radiant detects file format and checks target provider capabilities**
3. **Conversion only happens if the AI provider doesn't understand the format**
4. **Uses AI + libraries for intelligent conversion**

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              THINK TANK                                      │
│  ┌─────────┐                                                                 │
│  │  User   │──┬──▶ Drop file into chat                                      │
│  │         │  │                                                              │
│  └─────────┘  │                                                              │
└───────────────┼──────────────────────────────────────────────────────────────┘
                │
                ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                              RADIANT                                         │
│                                                                              │
│  ┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐          │
│  │ Format Detection│───▶│ Provider Check  │───▶│ Decision Engine │          │
│  │   - MIME type   │    │   - Capabilities│    │   - Strategy    │          │
│  │   - Extension   │    │   - Limits      │    │   - Warnings    │          │
│  │   - Magic bytes │    │   - Vision/Audio│    │   - Token est.  │          │
│  └─────────────────┘    └─────────────────┘    └────────┬────────┘          │
│                                                          │                   │
│                         ┌────────────────────────────────┴─────┐             │
│                         │         Needs Conversion?            │             │
│                         └────────────────┬─────────────────────┘             │
│                                          │                                   │
│              ┌───────────────────────────┼───────────────────────────┐       │
│              │ NO                        │                      YES  │       │
│              ▼                           │                           ▼       │
│  ┌─────────────────┐                     │            ┌─────────────────┐    │
│  │ Return original │                     │            │ Execute Strategy│    │
│  │ file as-is      │                     │            │ - extract_text  │    │
│  └─────────────────┘                     │            │ - ocr           │    │
│                                          │            │ - transcribe    │    │
│                                          │            │ - describe_image│    │
│                                          │            │ - parse_data    │    │
│                                          │            │ - decompress    │    │
│                                          │            └────────┬────────┘    │
│                                          │                     │             │
│                                          └──────────┬──────────┘             │
│                                                     │                        │
│                                                     ▼                        │
│                                          ┌─────────────────┐                 │
│                                          │ Return Result   │                 │
│                                          │ - Converted text│                 │
│                                          │ - Token estimate│                 │
│                                          │ - Metadata      │                 │
│                                          └─────────────────┘                 │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Supported File Formats

### Documents

| Format | Extension | MIME Type | Conversion Strategy |
|--------|-----------|-----------|---------------------|
| PDF | `.pdf` | `application/pdf` | `extract_text` via pdf-parse |
| Word | `.docx`, `.doc` | `application/vnd.openxmlformats-officedocument.wordprocessingml.document` | `extract_text` via mammoth |
| PowerPoint | `.pptx`, `.ppt` | `application/vnd.openxmlformats-officedocument.presentationml.presentation` | `extract_text` |
| Excel | `.xlsx`, `.xls` | `application/vnd.openxmlformats-officedocument.spreadsheetml.sheet` | `parse_data` via xlsx |

### Text Files

| Format | Extension | MIME Type | Notes |
|--------|-----------|-----------|-------|
| Plain Text | `.txt` | `text/plain` | Direct passthrough |
| Markdown | `.md` | `text/markdown` | Direct passthrough |
| JSON | `.json` | `application/json` | Direct or `parse_data` |
| CSV | `.csv` | `text/csv` | `parse_data` |
| XML | `.xml` | `application/xml` | Direct or `extract_text` |
| HTML | `.html` | `text/html` | `extract_text` |

### Images

| Format | Extension | MIME Type | Conversion Strategy |
|--------|-----------|-----------|---------------------|
| PNG | `.png` | `image/png` | Native or `describe_image` |
| JPEG | `.jpg`, `.jpeg` | `image/jpeg` | Native or `describe_image` |
| GIF | `.gif` | `image/gif` | Native or `describe_image` |
| WebP | `.webp` | `image/webp` | Native or `describe_image` |
| SVG | `.svg` | `image/svg+xml` | Convert to PNG or `describe_image` |
| BMP | `.bmp` | `image/bmp` | Convert to PNG or `describe_image` |
| TIFF | `.tiff` | `image/tiff` | Convert to PNG or `describe_image` |

### Audio

| Format | Extension | MIME Type | Conversion Strategy |
|--------|-----------|-----------|---------------------|
| MP3 | `.mp3` | `audio/mpeg` | `transcribe` via Whisper |
| WAV | `.wav` | `audio/wav` | `transcribe` via Whisper |
| OGG | `.ogg` | `audio/ogg` | `transcribe` via Whisper |
| FLAC | `.flac` | `audio/flac` | `transcribe` via Whisper |
| M4A | `.m4a` | `audio/mp4` | `transcribe` via Whisper |

### Video

| Format | Extension | MIME Type | Conversion Strategy |
|--------|-----------|-----------|---------------------|
| MP4 | `.mp4` | `video/mp4` | `describe_video` - frame extraction |
| WebM | `.webm` | `video/webm` | `describe_video` - frame extraction |
| MOV | `.mov` | `video/quicktime` | `describe_video` - frame extraction |
| AVI | `.avi` | `video/x-msvideo` | `describe_video` - frame extraction |

### Code Files

| Format | Extension | Notes |
|--------|-----------|-------|
| Python | `.py` | Syntax-highlighted markdown |
| JavaScript | `.js`, `.jsx` | Syntax-highlighted markdown |
| TypeScript | `.ts`, `.tsx` | Syntax-highlighted markdown |
| Java | `.java` | Syntax-highlighted markdown |
| C/C++ | `.c`, `.cpp`, `.h` | Syntax-highlighted markdown |
| Go | `.go` | Syntax-highlighted markdown |
| Rust | `.rs` | Syntax-highlighted markdown |
| Ruby | `.rb` | Syntax-highlighted markdown |

### Archives

| Format | Extension | MIME Type | Conversion Strategy |
|--------|-----------|-----------|---------------------|
| ZIP | `.zip` | `application/zip` | `decompress` - extract contents |
| TAR | `.tar` | `application/x-tar` | `decompress` - extract contents |
| GZIP | `.gz`, `.tar.gz`, `.tgz` | `application/gzip` | `decompress` - extract contents |

---

## Provider Capabilities

The service maintains a registry of AI provider capabilities:

| Provider | Vision | Audio | Video | Max File Size | Native Document Formats |
|----------|--------|-------|-------|---------------|------------------------|
| **OpenAI** | ✅ GPT-4V | ✅ Whisper | ❌ | 20MB | txt, md, json, csv |
| **Anthropic** | ✅ Claude 3 | ❌ | ❌ | 32MB | pdf, txt, md, json, csv |
| **Google** | ✅ Gemini | ✅ | ✅ | 100MB | pdf, txt, md, json, csv |
| **xAI** | ✅ Grok | ❌ | ❌ | 20MB | txt, md, json |
| **DeepSeek** | ❌ | ❌ | ❌ | 10MB | txt, md, json, csv |
| **Self-hosted** | ✅ LLaVA | ✅ Whisper | ❌ | 50MB | txt, md, json, csv |

---

## Conversion Strategies

### 1. `none` - No Conversion
Provider natively supports the format. File is passed through as-is.

### 2. `extract_text` - Text Extraction
Extracts plain text from documents using:
- **PDF**: `pdf-parse` library - extracts all text, page metadata
- **DOCX/DOC**: `mammoth` library - preserves structure, extracts images
- **PPTX/PPT**: Text extraction from slides
- **HTML/XML**: Strip tags, preserve content

**Example output:**
```
[Document Title]
Page 1:
Content from first page...

Page 2:
Content from second page...

[Metadata]
Pages: 10
Author: John Doe
Created: 2024-01-15
```

### 3. `ocr` - Optical Character Recognition
Uses AWS Textract to extract text from images containing text.

**Features:**
- Detects printed and handwritten text
- Table detection and extraction
- Form field detection
- Confidence scores per block

**Example output:**
```
[OCR Result]
Confidence: 94.5%

INVOICE #12345
Date: January 15, 2024

Item          Qty    Price
Widget A       10    $50.00
Widget B        5    $25.00

Total: $625.00
```

### 4. `transcribe` - Audio Transcription
Uses OpenAI Whisper API or self-hosted Whisper for speech-to-text.

**Features:**
- Automatic language detection
- Timestamp segments
- SRT/VTT subtitle generation
- Speaker diarization (future)

**Example output:**
```
[Transcription]
Duration: 5:32
Language: English
Model: whisper-1

[00:00] Hello and welcome to today's meeting.
[00:05] We'll be discussing the Q4 roadmap.
[00:12] First, let's review the current status...
```

### 5. `describe_image` - AI Image Description
Uses vision-capable models to describe image contents.

**Supported Models:**
- GPT-4 Vision (OpenAI)
- Claude 3 Vision (Anthropic)
- LLaVA (self-hosted)

**Features:**
- Detailed scene description
- Text detection (OCR integration)
- Object identification
- Color and composition analysis

**Example output:**
```
[Image Description]
Model: gpt-4-vision
Dimensions: 1920x1080

This image shows a modern office space with an open floor plan. 
In the foreground, there are several desks arranged in clusters, 
each with monitors and office supplies. The walls are painted in 
a neutral gray tone with large windows providing natural light.

[Text detected in image]:
"RADIANT - Innovation Center"
"Welcome Visitors"
```

### 6. `describe_video` - Video Frame Analysis
Extracts key frames from video and describes each using vision models.

**Features:**
- Configurable frame interval (default: 10 seconds)
- Maximum frames limit (default: 10)
- Frame-by-frame descriptions
- Narrative summary generation

**Example output:**
```
**Video Overview** (2m 30s, 1920x1080)

**Frame Analysis:**

**[0:00]** The video opens with a title screen showing the company logo
against a blue gradient background.

**[0:10]** A presenter in business attire stands in front of a whiteboard
with diagrams showing the system architecture.

**[0:20]** Close-up of the whiteboard showing a flowchart with boxes
labeled "User Input", "Processing", and "Output".

...

**Summary:**
The video begins with: Company logo and title screen
The video ends with: Presenter summarizing key points with bullet list
```

### 7. `parse_data` - Structured Data Parsing
Converts spreadsheets and data files to JSON.

**Supported formats:**
- CSV → JSON array of objects
- XLSX/XLS → JSON with sheet data
- JSON → Validated and prettified

**Example output (CSV):**
```json
{
  "data": [
    {"name": "Alice", "email": "alice@example.com", "role": "Admin"},
    {"name": "Bob", "email": "bob@example.com", "role": "User"},
    {"name": "Carol", "email": "carol@example.com", "role": "User"}
  ],
  "metadata": {
    "rowCount": 3,
    "columnCount": 3,
    "headers": ["name", "email", "role"]
  }
}
```

**Example output (Excel):**
```json
{
  "sheets": [
    {
      "name": "Sales Data",
      "rows": [...],
      "headers": ["Date", "Product", "Revenue"],
      "rowCount": 150
    },
    {
      "name": "Summary",
      "rows": [...],
      "headers": ["Metric", "Value"],
      "rowCount": 10
    }
  ],
  "metadata": {
    "sheetCount": 2,
    "totalRows": 160,
    "hasFormulas": true
  }
}
```

### 8. `decompress` - Archive Extraction
Extracts and processes archive contents.

**Supported formats:**
- ZIP (via adm-zip)
- TAR (via tar)
- GZIP (via zlib)

**Features:**
- Recursive extraction
- Text file content inclusion
- Binary file detection
- Size limits enforcement

**Example output:**
```
**Archive Contents** (ZIP)

**File Structure:**
```
📁 project/
📄 project/README.md (2.5KB)
📄 project/package.json (1.2KB)
📁 project/src/
📄 project/src/index.ts (5.3KB)
📄 project/src/utils.ts (3.1KB)
```

**File Contents:**

### project/README.md

```markdown
# My Project

This is a sample project...
```

### project/package.json

```json
{
  "name": "my-project",
  "version": "1.0.0"
}
```
```

### 9. `render_code` - Code Formatting
Formats code files with syntax highlighting.

**Example output:**
````markdown
```typescript
import { Injectable } from '@angular/core';

@Injectable()
export class DataService {
  private data: string[] = [];

  getData(): string[] {
    return this.data;
  }
}
```
````

---

## API Reference

### Base Path
`/api/thinktank/files`

### Endpoints

#### Process File
```
POST /api/thinktank/files/process
```

**Request:**
```json
{
  "filename": "document.pdf",
  "mimeType": "application/pdf",
  "content": "<base64-encoded-content>",
  "targetProvider": "anthropic",
  "targetModel": "claude-3-5-sonnet",
  "conversationId": "conv-uuid-optional"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "conversionId": "conv_abc123",
    "originalFile": {
      "filename": "document.pdf",
      "format": "pdf",
      "size": 1048576,
      "checksum": "sha256:abc123..."
    },
    "convertedContent": {
      "type": "text",
      "content": "Extracted document text...",
      "tokenEstimate": 2500,
      "metadata": {
        "originalFormat": "pdf",
        "conversionStrategy": "extract_text",
        "pageCount": 10,
        "title": "Annual Report 2024",
        "author": "Finance Team"
      }
    },
    "processingTimeMs": 1250
  }
}
```

#### Check Compatibility
```
POST /api/thinktank/files/check-compatibility
```

**Request:**
```json
{
  "filename": "image.png",
  "mimeType": "image/png",
  "fileSize": 524288,
  "targetProvider": "deepseek"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "fileInfo": {
      "filename": "image.png",
      "format": "png",
      "size": 524288
    },
    "provider": {
      "id": "deepseek",
      "supportsFormat": false,
      "supportsVision": false,
      "maxFileSize": 10485760
    },
    "decision": {
      "needsConversion": true,
      "strategy": "describe_image",
      "reason": "Provider deepseek lacks vision - will use AI to describe image",
      "targetFormat": "txt",
      "warnings": []
    }
  }
}
```

#### Get Provider Capabilities
```
GET /api/thinktank/files/capabilities
GET /api/thinktank/files/capabilities?provider=anthropic
```

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "providerId": "anthropic",
      "supportedFormats": ["png", "jpg", "jpeg", "gif", "webp", "pdf", "txt", "md", "json", "csv"],
      "nativeDocumentFormats": ["pdf", "txt", "md", "json", "csv"],
      "maxFileSize": 33554432,
      "supportsVision": true,
      "supportsAudio": false,
      "supportsVideo": false,
      "supportsDocuments": true
    }
  ]
}
```

#### Get Conversion History
```
GET /api/thinktank/files/history
GET /api/thinktank/files/history?conversationId=conv-uuid&limit=50&offset=0
```

**Response:**
```json
{
  "success": true,
  "data": {
    "conversions": [
      {
        "id": "conv_abc123",
        "filename": "report.pdf",
        "originalFormat": "pdf",
        "originalSize": 1048576,
        "targetProvider": "anthropic",
        "needsConversion": true,
        "strategy": "extract_text",
        "status": "completed",
        "tokenEstimate": 2500,
        "processingTimeMs": 1250,
        "createdAt": "2024-12-31T00:00:00Z"
      }
    ],
    "pagination": {
      "limit": 50,
      "offset": 0
    }
  }
}
```

#### Get Conversion Statistics
```
GET /api/thinktank/files/stats
GET /api/thinktank/files/stats?days=30
```

**Response:**
```json
{
  "success": true,
  "data": {
    "totalFiles": 1250,
    "convertedCount": 890,
    "nativeCount": 360,
    "failedCount": 12,
    "totalBytesProcessed": 2147483648,
    "avgProcessingMs": 850,
    "mostCommonFormat": "pdf",
    "mostCommonStrategy": "extract_text",
    "periodDays": 30
  }
}
```

---

## Database Schema

### Tables

#### `file_conversions`
Tracks all file conversion decisions and results.

| Column | Type | Description |
|--------|------|-------------|
| `id` | UUID | Primary key |
| `tenant_id` | UUID | Tenant reference |
| `filename` | VARCHAR(500) | Original filename |
| `original_format` | VARCHAR(50) | Detected format |
| `original_size` | BIGINT | File size in bytes |
| `target_provider` | VARCHAR(100) | Target AI provider |
| `target_model` | VARCHAR(200) | Target model ID |
| `needs_conversion` | BOOLEAN | Whether conversion was needed |
| `strategy` | VARCHAR(50) | Conversion strategy used |
| `conversion_status` | VARCHAR(20) | pending, processing, completed, failed |
| `converted_token_estimate` | INTEGER | Estimated tokens |
| `processing_time_ms` | INTEGER | Processing duration |
| `created_at` | TIMESTAMPTZ | Creation timestamp |

#### `provider_file_capabilities`
Registry of provider file format support.

| Column | Type | Description |
|--------|------|-------------|
| `provider_id` | VARCHAR(100) | Provider identifier (unique) |
| `supported_formats` | JSONB | Array of supported formats |
| `native_document_formats` | JSONB | Formats provider handles natively |
| `max_file_size` | BIGINT | Maximum file size in bytes |
| `supports_vision` | BOOLEAN | Has vision capabilities |
| `supports_audio` | BOOLEAN | Has audio capabilities |
| `supports_video` | BOOLEAN | Has video capabilities |

---

## Configuration

### Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `FILE_CONVERSION_BUCKET` | S3 bucket for file storage | `radiant-files` |
| `OPENAI_API_KEY` | OpenAI API key for Whisper/Vision | Required |
| `ANTHROPIC_API_KEY` | Anthropic API key for Claude Vision | Optional |
| `WHISPER_ENDPOINT_URL` | Self-hosted Whisper endpoint | Optional |
| `VISION_ENDPOINT_URL` | Self-hosted vision endpoint | Optional |

### Admin Configuration

**Location**: Admin Dashboard → Think Tank → File Settings

| Setting | Default | Description |
|---------|---------|-------------|
| Max file size | 50MB | Maximum upload size |
| Conversion timeout | 30s | Processing timeout |
| Enable transcription | true | Audio → text |
| Enable OCR | true | Image text extraction |
| Enable video processing | false | Video frame extraction |
| Retention days | 30 | How long to keep converted files |

---

## Implementation Files

| File | Purpose |
|------|---------|
| `lambda/shared/services/file-conversion.service.ts` | Main service with decision engine |
| `lambda/shared/services/converters/pdf-converter.ts` | PDF text extraction |
| `lambda/shared/services/converters/docx-converter.ts` | DOCX/DOC text extraction |
| `lambda/shared/services/converters/excel-converter.ts` | Excel/CSV parsing |
| `lambda/shared/services/converters/audio-converter.ts` | Audio transcription |
| `lambda/shared/services/converters/image-converter.ts` | Image description & OCR |
| `lambda/shared/services/converters/video-converter.ts` | Video frame extraction |
| `lambda/shared/services/converters/archive-converter.ts` | Archive decompression |
| `lambda/shared/services/converters/index.ts` | Module exports |
| `lambda/thinktank/file-conversion.ts` | API handlers |
| `migrations/127_file_conversion_service.sql` | Database schema |

---

## Dependencies

### NPM Packages

```json
{
  "pdf-parse": "^1.1.1",
  "mammoth": "^1.6.0",
  "xlsx": "^0.18.5",
  "sharp": "^0.33.2",
  "fluent-ffmpeg": "^2.1.2",
  "adm-zip": "^0.5.10",
  "tar": "^6.2.0"
}
```

### AWS Services

- **S3**: File storage
- **Textract**: OCR processing
- **Lambda**: Processing execution

---

## Error Handling

### Common Errors

| Error | Cause | Resolution |
|-------|-------|------------|
| `File size exceeds limit` | File > provider max | Reduce file size or extract portions |
| `Unsupported format` | Unknown file type | Convert to supported format first |
| `OCR failed` | Textract error | Check image quality, retry |
| `Transcription failed` | Whisper error | Check audio quality, verify API key |
| `PDF is password protected` | Encrypted PDF | Provide unencrypted version |

### Error Response Format

```json
{
  "success": false,
  "error": "PDF extraction failed: File is password protected",
  "conversionId": "conv_abc123",
  "originalFile": {
    "filename": "protected.pdf",
    "format": "pdf",
    "size": 1048576
  },
  "processingTimeMs": 150
}
```

---

## Security Considerations

1. **File Size Limits**: Enforced per provider to prevent resource exhaustion
2. **Format Validation**: Magic bytes + extension verification
3. **Tenant Isolation**: RLS policies on all tables
4. **S3 Encryption**: AES-256 at rest
5. **Signed URLs**: Time-limited access to stored files
6. **Input Sanitization**: All filenames and metadata sanitized

---

## Monitoring

### Metrics

- Total files processed per tenant
- Conversion success/failure rate
- Average processing time
- Most common formats
- Most common conversion strategies
- Storage usage

### Alerts

- High failure rate (>5%)
- Processing time > 30s
- Storage quota approaching limit

---

---

## Domain-Specific File Formats

The service includes a comprehensive registry of domain-specific file formats that are widely used in specialized fields but not commonly supported by mainstream AI providers.

### Mechanical Engineering / CAD

| Format | Extensions | Description | Library |
|--------|------------|-------------|---------|
| **STEP** | `.step`, `.stp`, `.p21` | ISO 10303 CAD exchange | OpenCASCADE, FreeCAD |
| **STL** | `.stl` | 3D printing mesh | numpy-stl, trimesh |
| **OBJ** | `.obj` | Wavefront 3D model | trimesh, three.js |
| **Fusion 360** | `.f3d`, `.f3z` | Autodesk parametric CAD | Fusion 360 API |
| **IGES** | `.iges`, `.igs` | Legacy CAD exchange | OpenCASCADE |
| **DXF** | `.dxf` | AutoCAD 2D drawings | ezdxf |
| **GLTF/GLB** | `.gltf`, `.glb` | Web 3D format | three.js, trimesh |

### Electrical Engineering

| Format | Extensions | Description | Library |
|--------|------------|-------------|---------|
| **KiCad** | `.kicad_pcb`, `.kicad_sch` | PCB/schematic | kicad-cli, kiutils |
| **EAGLE** | `.brd`, `.sch` | Autodesk PCB | eagle-to-kicad |
| **SPICE** | `.spice`, `.sp`, `.cir` | Circuit simulation | PySpice, ngspice |

### Medical/Healthcare

| Format | Extensions | Description | Library |
|--------|------------|-------------|---------|
| **DICOM** | `.dcm`, `.dicom` | Medical imaging | pydicom, dcmtk |
| **HL7 FHIR** | `.json`, `.xml` | Health records | fhir.resources |

### Scientific/Research

| Format | Extensions | Description | Library |
|--------|------------|-------------|---------|
| **NetCDF** | `.nc`, `.nc4` | Climate/geoscience | netCDF4, xarray |
| **HDF5** | `.h5`, `.hdf5` | Scientific data | h5py |
| **FITS** | `.fits` | Astronomy data | astropy |

### Geospatial

| Format | Extensions | Description | Library |
|--------|------------|-------------|---------|
| **Shapefile** | `.shp`, `.dbf` | Vector GIS | geopandas, shapefile |
| **GeoTIFF** | `.tif`, `.geotiff` | Georeferenced raster | rasterio |

### Bioinformatics

| Format | Extensions | Description | Library |
|--------|------------|-------------|---------|
| **FASTA** | `.fasta`, `.fa` | DNA/protein sequences | Biopython |
| **PDB** | `.pdb` | Protein structure | Biopython, py3Dmol |

---

## Multi-Model File Preparation

When multiple AI models work on the same prompt (multi-model orchestration), the system makes **per-model conversion decisions**:

### Key Principle

> **"If a model accepts the file type, assume it understands it unless proven otherwise."**

- Only convert for models that don't support the format
- Pass original file to models with native support
- Cache conversions to avoid redundant processing

### How It Works

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         MULTI-MODEL FILE PREPARATION                         │
│                                                                              │
│  File: document.pdf                                                          │
│                                                                              │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐              │
│  │   Claude 3.5    │  │   GPT-4 Vision  │  │    DeepSeek     │              │
│  │   (Anthropic)   │  │    (OpenAI)     │  │                 │              │
│  ├─────────────────┤  ├─────────────────┤  ├─────────────────┤              │
│  │ PDF: ✅ Native  │  │ PDF: ❌ No      │  │ PDF: ❌ No      │              │
│  │ Vision: ✅      │  │ Vision: ✅      │  │ Vision: ❌      │              │
│  ├─────────────────┤  ├─────────────────┤  ├─────────────────┤              │
│  │ Action:         │  │ Action:         │  │ Action:         │              │
│  │ PASS ORIGINAL   │  │ CONVERT         │  │ CONVERT         │              │
│  │ (native PDF)    │  │ (extract text)  │  │ (extract text)  │              │
│  └─────────────────┘  └─────────────────┘  └─────────────────┘              │
│                              │                     │                        │
│                              └──────────┬──────────┘                        │
│                                         │                                   │
│                              ┌──────────▼──────────┐                        │
│                              │  CACHED CONVERSION  │                        │
│                              │  (convert once,     │                        │
│                              │   reuse for both)   │                        │
│                              └─────────────────────┘                        │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Per-Model Actions

| Action | When | Result |
|--------|------|--------|
| `pass_original` | Model natively supports format | Original file passed |
| `convert` | Model doesn't support format | Converted content passed |
| `skip` | File too large or conversion failed | Model excluded |

### Usage Example

```typescript
import { multiModelFilePrepService } from './multi-model-file-prep.service';

// Prepare file for 3 models
const result = await multiModelFilePrepService.prepareFileForModels({
  tenantId,
  userId,
  file: {
    content: pdfBuffer,
    filename: 'document.pdf',
    mimeType: 'application/pdf',
  },
  targetModels: [
    { modelId: 'claude-3-5-sonnet', providerId: 'anthropic' },
    { modelId: 'gpt-4-vision', providerId: 'openai' },
    { modelId: 'deepseek-chat', providerId: 'deepseek' },
  ],
});

// Result:
// - Claude: pass_original (native PDF support)
// - GPT-4: convert (no PDF support, extract text)
// - DeepSeek: convert (reuses cached conversion)

// Get content for each model
for (const model of result.perModelPrep) {
  if (model.action !== 'skip') {
    const content = multiModelFilePrepService.getContentForModel(result, model.modelId);
    // Use content.data with this model
  }
}
```

### Model Format Overrides

When a model claims to support a format but proves it doesn't understand it well, overrides can be added:

```typescript
// If Claude struggles with complex PDFs despite claiming support
multiModelFilePrepService.addFormatOverride(
  'claude-3-haiku',
  'pdf',
  'Struggles with multi-column PDFs'
);
// Now Claude 3 Haiku will get converted PDFs instead of originals
```

---

## AGI Brain Integration

The AGI Brain automatically detects domain-specific files and selects appropriate conversion strategies.

### How It Works

1. **File Detection**: When a file is uploaded, the system checks if it's a domain-specific format
2. **Domain Context**: The user's domain (from profile or conversation) influences strategy selection
3. **Library Selection**: The AGI Brain selects the best library based on availability and capabilities
4. **Conversion Planning**: A conversion plan is created with fallback strategies
5. **Execution**: The conversion is executed using the selected library

### Conversion Strategy Selection

The AGI Brain considers:
- **User's domain**: Technical users get more detailed extraction
- **Conversation context**: "show me a preview" → visual output, "export data" → structured data
- **File complexity**: Simple formats get direct parsing, complex ones may need external tools
- **Available libraries**: Falls back if preferred library isn't available

### Example: CAD File Processing

```typescript
// AGI Brain detects a STEP file
const plan = planDomainConversion(
  'assembly.step',
  'application/step',
  'mechanical_engineering',  // User's domain
  'Can you analyze this CAD model?'  // Conversation context
);

// Returns:
{
  format: { format: 'step', domain: 'mechanical_engineering', ... },
  selectedStrategy: { strategy: 'extract_geometry', outputFormat: 'text', ... },
  selectedLibrary: { name: 'OpenCASCADE', pythonPackage: 'OCC', ... },
  requiresExternalService: true,
  estimatedComplexity: 'complex'
}
```

### AI Description Prompts

Each domain format includes a specialized AI prompt for when the AGI needs to describe the file without full parsing:

```typescript
// STL file prompt
"This is an STL 3D model file. Describe the shape, identify what object 
it might be, assess printability, and note any potential issues for 3D printing."

// DICOM file prompt
"This is a DICOM medical image. Describe the imaging modality, anatomical 
region, and any visible findings. Note: Do not provide medical diagnoses."

// STEP file prompt  
"This is a STEP CAD file. Describe the mechanical part or assembly, 
including approximate geometry, features (holes, fillets, chamfers), 
and likely manufacturing process."
```

---

## Implementation Files

| File | Purpose |
|------|---------|
| `lambda/shared/services/file-conversion.service.ts` | Main service with decision engine |
| `lambda/shared/services/converters/pdf-converter.ts` | PDF text extraction |
| `lambda/shared/services/converters/docx-converter.ts` | DOCX/DOC text extraction |
| `lambda/shared/services/converters/excel-converter.ts` | Excel/CSV parsing |
| `lambda/shared/services/converters/audio-converter.ts` | Audio transcription |
| `lambda/shared/services/converters/image-converter.ts` | Image description & OCR |
| `lambda/shared/services/converters/video-converter.ts` | Video frame extraction |
| `lambda/shared/services/converters/archive-converter.ts` | Archive decompression |
| `lambda/shared/services/converters/cad-converter.ts` | CAD/3D file parsing (STL, OBJ, STEP, DXF, GLTF) |
| `lambda/shared/services/converters/domain-formats.ts` | Domain format registry (50+ formats) |
| `lambda/shared/services/converters/domain-converter-selector.ts` | AGI Brain integration |
| `lambda/shared/services/converters/index.ts` | Module exports |
| `lambda/thinktank/file-conversion.ts` | API handlers |
| `migrations/127_file_conversion_service.sql` | Database schema |

---

---

## Reinforcement Learning Integration

The file conversion system integrates with the AGI Brain/consciousness for persistent learning from conversion outcomes.

### How Learning Works

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    REINFORCEMENT LEARNING LOOP                               │
│                                                                              │
│  ┌─────────────┐    ┌─────────────┐    ┌─────────────┐    ┌─────────────┐   │
│  │   File      │───▶│  Decision   │───▶│   Model     │───▶│  Outcome    │   │
│  │   Upload    │    │  Engine     │    │  Response   │    │  Detection  │   │
│  └─────────────┘    └─────────────┘    └─────────────┘    └──────┬──────┘   │
│                            ▲                                      │          │
│                            │                                      ▼          │
│                    ┌───────┴───────┐                     ┌─────────────┐     │
│                    │   Learning    │◀────────────────────│  Feedback   │     │
│                    │   Database    │                     │  Recording  │     │
│                    └───────────────┘                     └─────────────┘     │
└─────────────────────────────────────────────────────────────────────────────┘
```

### What Gets Learned

| Signal | Source | Learning |
|--------|--------|----------|
| **User Rating** | Explicit feedback (1-5 stars) | Direct quality signal |
| **Model Response** | Auto-inferred from response text | Did model understand? |
| **Error Detection** | Model errors/hallucinations | Format incompatibility |
| **Conversion Success** | Pass original worked | Model handles format |
| **Conversion Failure** | Pass original failed | Model needs conversion |

### Understanding Score

Each model/format combination has an understanding score (0.0 to 1.0):

| Score | Meaning | Action |
|-------|---------|--------|
| 0.8 - 1.0 | Excellent understanding | Pass original |
| 0.6 - 0.8 | Good understanding | Pass original |
| 0.4 - 0.6 | Moderate understanding | May convert |
| 0.0 - 0.4 | Poor understanding | Convert |

### Learning Database Schema

**Migration:** `128_file_conversion_learning.sql`

| Table | Purpose |
|-------|---------|
| `model_format_understanding` | Per-tenant model/format understanding scores |
| `conversion_outcome_feedback` | Recorded feedback for learning |
| `format_understanding_events` | Audit trail of score changes |
| `global_format_learning` | Cross-tenant aggregate insights |

### Recording Feedback

```typescript
import { fileConversionLearningService } from './file-conversion-learning.service';

// Record outcome after model responds
await fileConversionLearningService.recordOutcomeFeedback({
  tenantId,
  userId,
  conversionId: 'conv_abc123',
  modelId: 'claude-3-5-sonnet',
  providerId: 'anthropic',
  filename: 'document.pdf',
  fileFormat: 'pdf',
  actionTaken: 'pass_original',
  outcome: 'success',  // or 'partial', 'failure'
  outcomeSource: 'user_feedback',
  userRating: 5,
  modelUnderstood: true,
});

// Result: Understanding score updated, learning candidate created if significant
```

### Auto-Inference from Response

The system can automatically infer outcomes from model responses:

```typescript
const inference = fileConversionLearningService.inferOutcomeFromResponse(
  modelResponse,
  'pdf'
);

// Returns:
// {
//   outcome: 'failure',
//   modelUnderstood: false,
//   modelMentionedFormatIssues: true,
//   confidence: 0.8
// }
```

**Failure signals detected:**
- "I can't read", "unable to process", "cannot access the file"
- "appears to be empty", "binary data", "base64"
- Model asking for clarification about file content

### Integration with Consciousness

Significant learning events create **Learning Candidates** for the consciousness system:

| Event | Learning Candidate Type | Quality |
|-------|------------------------|---------|
| Model failed on format it claimed to support | `format_misunderstanding` | 0.85 |
| Unnecessary conversion (model would have understood) | `unnecessary_conversion` | 0.70 |
| Model hallucinated file content | `hallucination_detection` | 0.90 |
| User gave negative rating | `user_correction` | 0.85 |

These feed into the LoRA evolution system for persistent consciousness improvement.

### Admin Override

Admins can force conversion regardless of learning:

```typescript
// Force conversion for a model/format that consistently fails
await fileConversionLearningService.setForceConvert(
  tenantId,
  'claude-3-haiku',
  'pdf',
  'Struggles with multi-column PDFs',
  adminUserId
);

// Clear override
await fileConversionLearningService.clearForceConvert(
  tenantId,
  'claude-3-haiku',
  'pdf'
);
```

### Implementation Files

| File | Purpose |
|------|---------|
| `lambda/shared/services/file-conversion-learning.service.ts` | Learning service |
| `migrations/128_file_conversion_learning.sql` | Database schema |

---

---

## Part V: Data Lake Offload (v7.42.0)

### Overview

The Data Lake Offload system eliminates ~30-100M daily PostgreSQL INSERT operations by routing all log, audit, telemetry, and billing event data through **Kinesis Data Firehose → S3 Parquet → Athena** instead of direct database writes.

### Architecture

```
Lambda handler
    ↓
emitEvent() → In-memory buffer (100 events or 5s)
    ↓
Kinesis Data Firehose (12 streams)
    ↓
S3 Parquet (partitioned by tenant_id/year/month/day/hour)
    ↓
AWS Glue Catalog (automatic schema discovery)
    ↓
Amazon Athena (SQL queries with partition pruning)
```

### Storage Tiers

| Tier | S3 Storage Class | Age Range | Access Latency | Cost (GB/mo) |
|------|-----------------|-----------|----------------|--------------|
| Hot | S3 IT Frequent Access | 0-30 days | Milliseconds | $0.023 |
| Warm | S3 IT Infrequent Access | 30-90 days | Milliseconds | $0.0125 |
| Cold | Glacier Instant Retrieval | 90 days - 7 years | Milliseconds | $0.004 |
| Glacier | Glacier Flexible Retrieval | 7+ years | 3-5 hours | $0.0036 |
| Deep Archive | Glacier Deep Archive | Regulatory hold | 12 hours | $0.00099 |

### Data Type Registry

21 registered data types across 8 categories:

| Category | Types | Default Retention |
|----------|-------|-------------------|
| **Audit** | audit_log, license_audit, log_retention_audit, uds_audit, system_admin_audit | 7 years |
| **Security** | security_event, intrusion_event, lockout_event | 1-2 years |
| **AI/Model** | ai_invocation, drift_telemetry, brain_plan | 30-90 days |
| **Compliance** | compliance_event, guest_restriction | 1-7 years |
| **Billing** | billing_event, cost_attribution, storage_event | 1-7 years |
| **Infrastructure** | infrastructure_metric, error_log | 30-90 days |
| **Application** | application_log, delight_event | 30 days |
| **Collaboration** | collaboration_event | 1 year |

### Glacier Deletion Economics

Glacier charges for early deletion:
- **Glacier Flexible Retrieval**: prorated for items < 90 days old ($0.012/GB/mo)
- **Deep Archive**: prorated for items < 180 days old ($0.00099/GB/mo)

The `glacier_deletion_queue` table holds deletions until the minimum storage period passes. Cost analysis per object determines whether to delete immediately (cost < $0.01) or wait.

### Retention Reconciliation

When compliance licenses change (e.g., tenant enables HIPAA), the Retention Reconciler:
1. Re-evaluates all data for affected tenant + data types
2. Extends retention expiry if retention increased
3. Queues deletion of data past new limit if retention decreased
4. Applies/removes S3 Object Lock if immutability changed
5. Cancels pending Glacier deletions if retention extended
6. Logs everything in `retention_reconciliation_log`

### Database Tables

| Table | Purpose |
|-------|---------|
| `data_type_registry` | Canonical registry of all 21 storable data types |
| `tenant_data_retention` | Per-tenant retention overrides per data type |
| `data_location_index` | Fast lookup index for S3/Glacier objects |
| `glacier_deletion_queue` | Cost-aware Glacier deletion queue |
| `data_lake_sync_state` | Firehose delivery + Glue partition state |
| `retention_reconciliation_log` | Audit trail for retention policy changes |

### Services

| Service | Purpose |
|---------|---------|
| `event-firehose.service.ts` | Async Firehose ingestion with buffering and DLQ |
| `data-location-index.service.ts` | Fast S3/Glacier lookup |
| `glacier-lifecycle.service.ts` | Cost-aware Glacier deletion |
| `data-lake-lifecycle-manager.service.ts` | Hourly lifecycle orchestrator |
| `retention-reconciler.service.ts` | Compliance-driven retention reconciliation |
| `data-lake-query.service.ts` | Athena query layer |

### CDK Stack: DataLakeStack

| Resource | Details |
|----------|---------|
| S3 Data Lake Bucket | Intelligent-Tiering, Object Lock (prod), lifecycle rules |
| S3 Athena Results | 7-day expiry |
| Firehose Streams | 12 (4 dedicated high-volume + 8 grouped) |
| Glue Database + Crawler | Daily partition discovery |
| Athena Workgroup | Per-query cost limits |
| Lambda Functions | Lifecycle Manager (hourly), Reconciler (SQS), DLQ Processor |
| SQS Queues | DLQ + Reconciler Queue |
| KMS Key | Encryption with rotation |

### Enforcement Policy

See `/.windsurf/workflows/no-database-logging.md` — mandatory policy prohibiting direct database writes for all event data. All services must use the Event Firehose Service.

---

## Related Documentation

- [THINKTANK-ADMIN-GUIDE.md - Section 27](./THINKTANK-ADMIN-GUIDE.md#27-intelligent-file-conversion)
- [RADIANT-ADMIN-GUIDE.md](./RADIANT-ADMIN-GUIDE.md)



---

*Consolidated from 7 source documents (0 not found). 4,125 source lines.*
