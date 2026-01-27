# RADIANT Service Layer Guide

> **Version:** 5.52.5  
> **Last Updated:** January 2026  
> **Audience:** Platform Administrators, Developers, Integration Partners

This guide covers RADIANT's three external service interfaces: **API**, **MCP** (Model Context Protocol), and **A2A** (Agent-to-Agent). These interfaces enable external applications, AI assistants, and autonomous agents to interact with the RADIANT platform.

---

## Table of Contents

1. [Overview](#1-overview)
2. [API Interface](#2-api-interface)
3. [MCP Interface](#3-mcp-interface)
4. [A2A Interface](#4-a2a-interface)
5. [Multi-Protocol Gateway Architecture](#5-multi-protocol-gateway-architecture)
6. [API Keys & Authentication](#6-api-keys--authentication)
7. [Cedar Authorization Policies](#7-cedar-authorization-policies)
8. [Admin Dashboard](#8-admin-dashboard)
9. [Database Schema](#9-database-schema)
10. [Troubleshooting](#10-troubleshooting)

---

## 1. Overview

RADIANT exposes three distinct service interfaces, each designed for different integration patterns:

| Interface | Protocol | Authentication | Use Cases |
|-----------|----------|----------------|-----------|
| **API** | REST/HTTP | API Key, OAuth | Web apps, mobile apps, Zapier, Make |
| **MCP** | JSON-RPC over WebSocket | API Key | Claude Desktop, Cursor, AI assistants |
| **A2A** | Custom over WebSocket | mTLS + API Key | Autonomous agents, multi-agent systems |

### Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              INTERNET                                        │
└─────────────────────────────────┬───────────────────────────────────────────┘
                                  │
                                  ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                     NETWORK LOAD BALANCER (NLB)                              │
└─────────────────────────────────┬───────────────────────────────────────────┘
                                  │
                                  ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                    GO CONNECTIVITY GATEWAY FLEET                             │
│  • TLS/mTLS termination                                                      │
│  • Protocol detection (API, MCP, A2A)                                        │
│  • WebSocket/SSE upgrade                                                     │
│  • Session management                                                        │
│  • Resume token handling                                                     │
└─────────────────────────────────┬───────────────────────────────────────────┘
                                  │
                                  ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                         NATS JETSTREAM CLUSTER                               │
│  • INBOX stream: in.{protocol}.{tenant}.{agent}                             │
│  • OUTBOX stream: out.{session_id}                                          │
│  • HISTORY stream: history.{session_id}                                     │
└─────────────────────────────────┬───────────────────────────────────────────┘
                                  │
                                  ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                         LAMBDA WORKER FLEET                                  │
│  • mcp-workers: MCP JSON-RPC processing                                     │
│  • a2a-workers: A2A protocol handling                                       │
│  • api-workers: REST API requests                                           │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 2. API Interface

The REST API interface provides traditional HTTP-based access to RADIANT services.

### Base URL

```
https://api.{your-domain}/v1
```

### Authentication

```http
Authorization: Bearer rad_sk_xxxxxxxxxxxx
```

### Key Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/chat/completions` | POST | Send chat messages |
| `/models` | GET | List available models |
| `/models/{id}` | GET | Get model details |
| `/sessions` | POST | Create chat session |
| `/sessions/{id}/messages` | POST | Send message to session |
| `/knowledge/search` | POST | Search knowledge base |
| `/files/upload` | POST | Upload file |

### Scopes

| Scope | Description |
|-------|-------------|
| `chat` | Basic chat access |
| `chat:write` | Create/modify conversations |
| `chat:delete` | Delete conversations |
| `models` | List and use models |
| `knowledge:read` | Read from knowledge base |
| `knowledge:write` | Write to knowledge base |
| `files:read` | Read uploaded files |
| `files:write` | Upload files |
| `agents:execute` | Execute agent tools |

### Example: Chat Completion

```bash
curl -X POST https://api.example.com/v1/chat/completions \
  -H "Authorization: Bearer rad_sk_xxxxxxxxxxxx" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "claude-3-5-sonnet",
    "messages": [
      {"role": "user", "content": "Hello, world!"}
    ]
  }'
```

---

## 3. MCP Interface

The Model Context Protocol (MCP) interface enables AI assistants like Claude Desktop and Cursor to use RADIANT as a tool provider.

### Protocol Version

RADIANT supports MCP protocol versions:
- `2024-11-05` (stable)
- `2025-03-26` (latest)

### Connection

```javascript
// MCP client configuration
{
  "mcpServers": {
    "radiant": {
      "url": "wss://gateway.{your-domain}/mcp",
      "apiKey": "rad_mcp_xxxxxxxxxxxx"
    }
  }
}
```

### Capabilities

| Capability | Supported | Description |
|------------|-----------|-------------|
| `tools` | ✅ | Tool execution |
| `tools.listChanged` | ✅ | Dynamic tool updates |
| `resources` | ✅ | Resource access |
| `resources.subscribe` | ✅ | Resource subscriptions |
| `prompts` | ✅ | Prompt templates |
| `logging` | ✅ | Logging support |

### MCP Methods

| Method | Description |
|--------|-------------|
| `initialize` | Initialize MCP session |
| `ping` | Health check |
| `tools/list` | List available tools |
| `tools/call` | Execute a tool |
| `resources/list` | List available resources |
| `resources/read` | Read resource content |
| `prompts/list` | List prompt templates |
| `prompts/get` | Get prompt template |

### Built-in Tools

| Tool | Description | Input Schema |
|------|-------------|--------------|
| `search` | Search knowledge base | `query: string, limit?: number` |
| `calculate` | Math calculations | `expression: string` |
| `fetch_data` | Fetch data from sources | `source: string, limit?: number` |

### Example: Tool Call

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "tools/call",
  "params": {
    "name": "search",
    "arguments": {
      "query": "RADIANT deployment guide",
      "limit": 5
    }
  }
}
```

### Response

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "result": {
    "content": [
      {
        "type": "text",
        "text": "Search results for \"RADIANT deployment guide\":\n\n1. [guide] RADIANT Deployment Guide (confidence: 95%)\n..."
      }
    ]
  }
}
```

### MCP Worker Implementation

**File:** `packages/infrastructure/lambda/gateway/mcp-worker.ts`

Key features:
- JSON-RPC 2.0 message processing
- Cedar policy authorization for each tool call
- Dual-publish responses to NATS and JetStream
- Metrics collection per method
- SQS event source for message delivery

**CDK Deployment:** `packages/infrastructure/lib/stacks/gateway-stack.ts`

```typescript
// MCP Worker Lambda with SQS trigger
this.mcpWorkerLambda = new lambda.Function(this, 'MCPWorker', {
  functionName: `${appId}-${environment}-mcp-worker`,
  runtime: lambda.Runtime.NODEJS_20_X,
  handler: 'gateway/mcp-worker.handler',
  memorySize: 1024,
  timeout: cdk.Duration.seconds(60),
});

// SQS Queue for message buffering
const mcpWorkerQueue = new sqs.Queue(this, 'MCPWorkerQueue', {
  visibilityTimeout: cdk.Duration.seconds(300),
  deadLetterQueue: { queue: mcpWorkerDLQ, maxReceiveCount: 3 },
});
```

---

## 4. A2A Interface

The Agent-to-Agent (A2A) interface enables autonomous agents to communicate with each other through RADIANT.

### Security Model

A2A requires **mTLS authentication** by default:

```
┌──────────────┐     mTLS      ┌──────────────┐
│   Agent A    │ ◄──────────► │   Gateway    │
│  (Client)    │               │   (Server)   │
└──────────────┘               └──────────────┘
```

### Message Types

| Type | Direction | Description |
|------|-----------|-------------|
| `register` | Agent → Server | Register agent in registry |
| `discover` | Agent → Server | Discover other agents |
| `message` | Agent → Agent | Direct message |
| `broadcast` | Agent → All | Broadcast to topic |
| `request` | Agent → Agent | Request with expected response |
| `response` | Agent → Agent | Response to request |
| `subscribe` | Agent → Server | Subscribe to topic |
| `unsubscribe` | Agent → Server | Unsubscribe from topic |
| `heartbeat` | Agent → Server | Keep-alive |
| `acquire_lock` | Agent → Server | Acquire resource lock |
| `release_lock` | Agent → Server | Release resource lock |
| `task_start` | Agent → All | Announce task start |
| `task_update` | Agent → All | Task progress update |
| `task_complete` | Agent → All | Task completion |

### Agent Registration

```json
{
  "messageType": "register",
  "payload": {
    "agentName": "data-processor",
    "agentType": "worker",
    "agentVersion": "1.0.0",
    "capabilities": ["data_processing", "file_conversion"],
    "webhookUrl": "https://agent.example.com/webhook"
  }
}
```

### Agent Discovery

```json
{
  "messageType": "discover",
  "payload": {
    "filterType": "worker",
    "filterCapabilities": ["data_processing"]
  }
}
```

### Response

```json
{
  "success": true,
  "messageType": "discover_response",
  "data": {
    "agents": [
      {
        "agentId": "agent_abc123",
        "agentName": "data-processor",
        "agentType": "worker",
        "capabilities": ["data_processing", "file_conversion"],
        "status": "active",
        "lastSeen": "2026-01-25T14:30:00Z"
      }
    ],
    "total": 1
  }
}
```

### Direct Messaging

```json
{
  "messageType": "message",
  "toAgentId": "agent_xyz789",
  "payload": {
    "content": {"task": "process_file", "fileId": "file_123"},
    "contentType": "application/json",
    "priority": "high"
  }
}
```

### Resource Locking

Agents can acquire exclusive locks on shared resources:

```json
{
  "messageType": "acquire_lock",
  "payload": {
    "resourceUri": "radiant://files/report.pdf",
    "lockType": "write",
    "lockTimeout": 300
  }
}
```

### A2A Worker Implementation

**File:** `packages/infrastructure/lambda/gateway/a2a-worker.ts`

Key features:
- mTLS verification
- Agent registry management
- NATS JetStream integration
- Resource locking coordination
- Task event broadcasting
- Comprehensive audit logging
- SQS event source for message delivery

**CDK Deployment:** `packages/infrastructure/lib/stacks/gateway-stack.ts`

```typescript
// A2A Worker Lambda with SQS trigger
this.a2aWorkerLambda = new lambda.Function(this, 'A2AWorker', {
  functionName: `${appId}-${environment}-a2a-worker`,
  runtime: lambda.Runtime.NODEJS_20_X,
  handler: 'gateway/a2a-worker.handler',
  memorySize: 1024,
  timeout: cdk.Duration.seconds(60),
});

// SQS Queue for A2A message buffering
const a2aWorkerQueue = new sqs.Queue(this, 'A2AWorkerQueue', {
  visibilityTimeout: cdk.Duration.seconds(300),
  deadLetterQueue: { queue: a2aWorkerDLQ, maxReceiveCount: 3 },
});
```

---

## 5. Multi-Protocol Gateway Architecture

The Go Connectivity Gateway handles all three protocols with a unified architecture.

### Gateway Configuration

**File:** `apps/gateway/internal/config/config.go`

```go
type Config struct {
    ListenAddr           string        // :8443
    TLSCertFile          string
    TLSKeyFile           string
    MTLSCACertFile       string        // For A2A
    NATSUrl              string
    MaxConnectionsPerNode int          // 80,000
    SessionTimeout       time.Duration // 1 hour
    ResumeTokenTTL       time.Duration // 1 hour
}
```

### Session Management

Each connection maintains a `SessionContext`:

```go
type SessionContext struct {
    SessionID      string    // Survives reconnects
    ConnectionID   string    // Current connection
    TenantID       string
    PrincipalID    string
    PrincipalType  string    // user, agent, service
    AuthType       string    // mtls, oidc, apikey
    Protocol       string    // mcp, a2a, api
    InboxSubject   string    // in.{protocol}.{tenant}.{agent}
    OutboxSubject  string    // out.{session_id}
    ResumeToken    string
    Expiry         time.Time
}
```

### Resume Tokens

Sessions can be resumed after disconnection:

```go
type ResumeTokenData struct {
    SessionID     string
    TenantID      string
    PrincipalID   string
    Protocol      string
    InboxSubject  string
    OutboxSubject string
    IssuedAt      time.Time
    ExpiresAt     time.Time
    GatewayNode   string    // Hint for sticky routing
}
```

### NATS Stream Configuration

```yaml
# INBOX Stream - incoming messages
name: INBOX
subjects: ["in.>"]
retention: workqueue
maxAge: 1h
replicas: 3

# OUTBOX Stream - responses
name: OUTBOX
subjects: ["out.>"]
retention: limits
maxAge: 1h
replicas: 3

# HISTORY Stream - session replay
name: HISTORY
subjects: ["history.>"]
retention: limits
maxMsgsPerSubject: 10000
maxAge: 1h
replicas: 3
```

### Capacity Planning

| Component | Instance | Connections | Count for 1M |
|-----------|----------|-------------|--------------|
| Go Gateway | c6g.xlarge (8GB) | 80,000 | 13 instances |
| NATS | r6g.xlarge | N/A | 3 nodes (cluster) |
| Lambda (MCP) | 1024MB | N/A | 1000 concurrent |
| Lambda (A2A) | 2048MB | N/A | 500 concurrent |

---

## 6. API Keys & Authentication

### Key Structure

```
rad_{interface}_{random_prefix}_{key_secret}
     ↑               ↑              ↑
     │               │              └── Secret (never stored)
     │               └── Stored prefix (first 20 chars)
     └── Interface type: sk (api), mcp, a2a
```

### Interface Types

| Type | Code | Authentication |
|------|------|----------------|
| API | `sk` | Bearer token |
| MCP | `mcp` | Header or query param |
| A2A | `a2a` | mTLS + API key |
| All | `all` | Any interface |

### Key Fields

| Field | Description |
|-------|-------------|
| `interface_type` | `api`, `mcp`, `a2a`, or `all` |
| `scopes` | Allowed operations |
| `allowed_endpoints` | Explicit allow list |
| `denied_endpoints` | Explicit deny list |
| `rate_limit_per_minute` | Rate limit |
| `a2a_agent_id` | Linked A2A agent (if applicable) |
| `a2a_mtls_required` | Require mTLS for A2A |
| `mcp_allowed_tools` | Allowed MCP tools |
| `expires_at` | Key expiration |

### Creating an API Key

**Via Admin Dashboard:**
1. Navigate to **Settings** → **API Keys**
2. Click **Create Key**
3. Select interface type
4. Configure scopes and limits
5. Copy the generated key (shown only once)

**Via API:**
```bash
curl -X POST https://api.example.com/admin/api-keys \
  -H "Authorization: Bearer admin_token" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "My MCP Key",
    "interface_type": "mcp",
    "scopes": ["tools", "resources"],
    "mcp_allowed_tools": ["search", "calculate"]
  }'
```

### Key Validation Flow

```
Request → Extract Key → Hash Key → DB Lookup
                                      ↓
                        Check: is_active, expires_at
                                      ↓
                        Check: interface_type matches
                                      ↓
                        Check: endpoint restrictions
                                      ↓
                        Update: last_used_at, use_count
                                      ↓
                                 ✓ Authorized
```

---

## 7. Cedar Authorization Policies

RADIANT uses Cedar for fine-grained authorization across all interfaces.

### Cedar Schema

```cedarschema
namespace Radiant {
  entity Agent in [Tenant] {
    tier: String,
    scopes: Set<String>,
    labels: Set<String>
  };
  
  entity User in [Tenant] {
    role: String,
    scopes: Set<String>,
    department: String
  };
  
  entity Tool {
    name: String,
    destructive: Bool,
    sensitive: Bool,
    requiredScopes: Set<String>,
    labels: Set<String>,
    namespace: String,
    owner: String
  };
  
  action "tool:call" appliesTo {
    principal: [Agent, User, Service],
    resource: [Tool],
    context: { tenantId: String, sourceProtocol: String }
  };
}
```

### Key Policies

**File:** `packages/infrastructure/config/cedar/interface-access-policies.cedar`

| Policy | Purpose |
|--------|---------|
| `deny-cross-tenant` | FORBID all cross-tenant access |
| `user-tool-call-non-sensitive` | Allow non-destructive tools with scopes |
| `agent-tool-call-namespace` | Agents can call tools in their namespace |
| `admin-tool-call-all` | Admins bypass restrictions |
| `deny-sensitive-without-label` | Protect sensitive resources |
| `deny-database-direct-access` | FORBID direct DB access from external agents |
| `require-mtls-for-a2a` | Enforce mTLS for A2A |

### Example: Tool Authorization

```typescript
const authResult = await cedarService.authorize({
  principal: {
    type: 'Agent',
    id: 'agent_123',
    tenantId: 'tenant_abc',
    scopes: ['tool:execute'],
  },
  action: 'tool:execute',
  resource: {
    type: 'Tool',
    id: 'search',
    name: 'search',
    namespace: 'public',
    destructive: false,
    sensitive: false,
  },
  context: {
    tenantId: 'tenant_abc',
    sourceProtocol: 'mcp',
  },
});

if (!authResult.allowed) {
  throw new Error(`Authorization denied: ${authResult.decision}`);
}
```

---

## 8. Admin Dashboard

### API Keys Management

**Location:** `/settings/api-keys` (both Radiant Admin and Think Tank Admin)

**Tabs:**
1. **Overview** - Summary cards per interface type
2. **Keys** - List with filtering by interface
3. **A2A Agents** - Agent registry management
4. **Policies** - Interface access policies

### Creating Keys

1. Click **Create Key**
2. Select **Interface Type**:
   - **API** - REST API access
   - **MCP** - Model Context Protocol
   - **A2A** - Agent-to-Agent
   - **All** - All interfaces
3. Configure scopes
4. Set expiration (optional)
5. For A2A: Configure mTLS requirements
6. For MCP: Select allowed tools

### A2A Agent Management

| Action | Description |
|--------|-------------|
| **View Agents** | List registered agents |
| **Suspend** | Temporarily disable agent |
| **Activate** | Re-enable suspended agent |
| **Revoke** | Permanently revoke agent access |
| **View Requests** | See agent request history |

### Interface Policies

Configure per-interface access rules:

| Setting | Description |
|---------|-------------|
| `require_authentication` | Require API key |
| `require_mtls` | Require mTLS (A2A default: true) |
| `allowed_ip_ranges` | IP allowlist |
| `blocked_ip_ranges` | IP blocklist |
| `global_rate_limit_per_minute` | Interface-wide rate limit |

---

## 9. Database Schema

### Core Tables

**Migration:** `V2026_01_24_001__services_layer_api_keys.sql`

| Table | Purpose |
|-------|---------|
| `api_keys` | API key storage with interface types |
| `api_key_audit_log` | Audit trail for key operations |
| `interface_access_policies` | Per-interface access control |
| `a2a_registered_agents` | A2A agent registry |
| `api_key_sync_log` | Cross-admin-app sync queue |

### api_keys Table

```sql
CREATE TABLE api_keys (
  id UUID PRIMARY KEY,
  tenant_id UUID NOT NULL,
  name VARCHAR(255) NOT NULL,
  key_prefix VARCHAR(20) NOT NULL,
  key_hash VARCHAR(128) NOT NULL,
  
  -- Interface type
  interface_type VARCHAR(20) NOT NULL, -- api, mcp, a2a, all
  
  -- Scopes
  scopes TEXT[] NOT NULL DEFAULT ARRAY['chat', 'models'],
  allowed_endpoints TEXT[],
  denied_endpoints TEXT[],
  
  -- A2A fields
  a2a_agent_id VARCHAR(255),
  a2a_mtls_required BOOLEAN DEFAULT true,
  
  -- MCP fields
  mcp_allowed_tools TEXT[],
  mcp_protocol_version VARCHAR(20) DEFAULT '2025-03-26',
  
  -- Status
  is_active BOOLEAN NOT NULL DEFAULT true,
  expires_at TIMESTAMPTZ,
  last_used_at TIMESTAMPTZ,
  use_count INTEGER NOT NULL DEFAULT 0,
  
  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

### a2a_registered_agents Table

```sql
CREATE TABLE a2a_registered_agents (
  id UUID PRIMARY KEY,
  tenant_id UUID NOT NULL,
  agent_id VARCHAR(255) NOT NULL,
  agent_name VARCHAR(255) NOT NULL,
  agent_type VARCHAR(100) NOT NULL,
  agent_version VARCHAR(50),
  
  -- Authentication
  api_key_id UUID REFERENCES api_keys(id),
  mtls_cert_fingerprint VARCHAR(128),
  
  -- Capabilities
  supported_operations TEXT[] NOT NULL DEFAULT '{}',
  max_concurrent_requests INTEGER DEFAULT 10,
  
  -- Status
  status VARCHAR(20) NOT NULL DEFAULT 'active',
  last_heartbeat_at TIMESTAMPTZ,
  total_requests INTEGER NOT NULL DEFAULT 0,
  
  UNIQUE(tenant_id, agent_id)
);
```

### Key Functions

```sql
-- Validate API key for specific interface
SELECT * FROM validate_api_key_for_interface(
  'key_hash_value',
  'mcp',
  '/tools/call'
);

-- Create API key with interface type
SELECT create_api_key(
  'tenant_id',
  'My MCP Key',
  'mcp',
  'rad_mcp_abc',
  'hash_value',
  ARRAY['tools', 'resources']
);

-- Revoke API key
SELECT revoke_api_key('key_id', 'admin_id', 'Security concern');
```

---

## 10. Troubleshooting

### Common Issues

#### MCP Connection Fails

**Symptoms:** Claude Desktop shows "Failed to connect to MCP server"

**Solutions:**
1. Verify API key is valid and has `mcp` interface type
2. Check WebSocket URL: `wss://gateway.{domain}/mcp`
3. Verify key has required scopes: `tools`, `resources`

#### A2A mTLS Errors

**Symptoms:** `MTLS_REQUIRED` error

**Solutions:**
1. Ensure client certificate is valid and not expired
2. Verify certificate is signed by trusted CA
3. Check `mtls_cert_fingerprint` matches registered fingerprint
4. Confirm `a2a_mtls_required` setting in policy

#### Rate Limiting

**Symptoms:** `429 Too Many Requests`

**Solutions:**
1. Check key's `rate_limit_per_minute` setting
2. Review `interface_access_policies` for global limits
3. Implement exponential backoff in client
4. Consider upgrading to higher rate limit tier

#### Authorization Denied

**Symptoms:** `AUTHORIZATION_DENIED` or `-32001` error

**Solutions:**
1. Verify key has required scopes
2. Check Cedar policies for restrictions
3. Confirm tool/resource is in allowed namespace
4. Review audit log for denial reason

### Audit Log Queries

```sql
-- Recent auth failures
SELECT * FROM api_key_audit_log
WHERE action IN ('a2a_auth_failure', 'mcp_auth_failure', 'interface_denied')
ORDER BY created_at DESC
LIMIT 100;

-- Key usage by interface
SELECT interface_type, COUNT(*) as uses, MAX(created_at) as last_use
FROM api_key_audit_log
WHERE action = 'used'
GROUP BY interface_type;

-- A2A agent activity
SELECT a2a_agent_id, a2a_operation, COUNT(*) as operations
FROM api_key_audit_log
WHERE a2a_agent_id IS NOT NULL
GROUP BY a2a_agent_id, a2a_operation
ORDER BY operations DESC;
```

### Health Check Endpoints

| Endpoint | Description |
|----------|-------------|
| `/health` | Gateway health |
| `/health/nats` | NATS connection status |
| `/metrics` | Prometheus metrics |
| `/api/admin/system/gateway` | Gateway configuration |

---

## Related Documentation

- [Multi-Protocol Gateway Architecture](MULTI-PROTOCOL-GATEWAY-ARCHITECTURE.md) - Detailed gateway design
- [RADIANT Admin Guide](RADIANT-ADMIN-GUIDE.md) - Platform administration
- [Authentication Overview](authentication/overview.md) - Authentication methods
- [API Reference](API_REFERENCE.md) - Complete API documentation

---

**Document History**

| Version | Date | Changes |
|---------|------|---------|
| 5.52.5 | 2026-01-25 | Initial comprehensive guide |
