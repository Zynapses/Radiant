# RADIANT Multi-Protocol Gateway

High-performance WebSocket/SSE gateway for AI protocol adapters (MCP, A2A, OpenAI, Anthropic, Google) at 1M+ concurrent connection scale.

## Architecture

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                         RADIANT GATEWAY v1.1.0                                   │
├─────────────────────────────────────────────────────────────────────────────────┤
│                                                                                  │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐    ┌──────────────┐  │
│  │   Clients    │    │  Go Gateway  │    │    NATS      │    │   Lambda     │  │
│  │  WebSocket   │───▶│   Fleet      │───▶│  JetStream   │───▶│   Workers    │  │
│  │              │    │  (Fargate)   │    │   INBOX      │    │  (Stateless) │  │
│  └──────────────┘    └──────┬───────┘    └──────────────┘    └──────┬───────┘  │
│                             │                                       │          │
│                             │ Egress                                │          │
│                             ▼                                       ▼          │
│                      ┌──────────────┐                        ┌──────────────┐  │
│                      │  Core NATS   │◀───────────────────────│  Dual Pub    │  │
│                      │  out.{sid}   │                        │  to HISTORY  │  │
│                      │  (Live)      │                        │              │  │
│                      └──────┬───────┘                        └──────────────┘  │
│                             │                                                   │
│                             │    ┌──────────────────────────────────────────┐  │
│                             │    │ On Reconnect: Replay from HISTORY        │  │
│                             │    ▼                                          │  │
│                      ┌──────────────┐    ┌──────────────┐                   │  │
│                      │   Gateway    │───▶│ Egress Proxy │───▶ AI Providers  │  │
│                      │  Reconnect   │    │  (Fargate)   │    (HTTP/2 Pool)  │  │
│                      │   Handler    │    │              │                   │  │
│                      └──────────────┘    └──────────────┘                   │  │
│                                                                              │  │
└─────────────────────────────────────────────────────────────────────────────────┘
```

## Key Design Decisions

| Issue | Wrong Approach | Correct Approach |
|-------|----------------|------------------|
| **HTTP/2 Pool** | Inside Lambda | Dedicated Egress Proxy (Fargate) |
| **Egress Goroutine** | Context cancel only | Defensive cleanup + done channel |
| **Message History** | DynamoDB writes | JetStream HISTORY stream |

## Quick Start

```bash
# 1. Start NATS and supporting services
make docker-up

# 2. Build and run the gateway
make run

# 3. Test WebSocket connection
wscat -c ws://localhost:8443/ws
> {"jsonrpc":"2.0","method":"initialize","id":1}
```

## Project Structure

```
apps/gateway/
├── cmd/gateway/           # Main entry point
├── internal/
│   ├── config/           # Configuration loading
│   ├── server/           # WebSocket server
│   │   ├── server.go     # Main server + connection handling
│   │   ├── ingress.go    # Socket → JetStream
│   │   ├── egress.go     # Core NATS → Socket
│   │   └── reconnect.go  # Resume + HISTORY replay
│   ├── session/          # Session context
│   ├── auth/             # mTLS + OIDC authentication
│   ├── protocol/         # Protocol detection
│   └── resume/           # Resume token service
├── pkg/messages/         # Message structs
├── Dockerfile
├── Makefile
└── go.mod
```

## Configuration

| Environment Variable | Default | Description |
|---------------------|---------|-------------|
| `GATEWAY_LISTEN_ADDR` | `:8443` | WebSocket listen address |
| `GATEWAY_HEALTH_ADDR` | `:8080` | Health check endpoint |
| `NATS_URL` | `nats://localhost:4222` | NATS server URL |
| `EGRESS_PROXY_URL` | `http://localhost:9000` | Egress proxy URL |
| `RESUME_TOKEN_SECRET` | `dev-secret` | Secret for resume tokens |
| `GATEWAY_DEV` | `false` | Enable development logging |

## Protocol Support

- **MCP (Model Context Protocol)** - v2025-03-26
- **A2A (Agent-to-Agent)** - v0.3.0
- **OpenAI** - Chat completions API
- **Anthropic** - Messages API
- **Google** - Generative Language API

## Session Resume

Clients can resume sessions after disconnect:

```javascript
// Initial connection
const ws = new WebSocket('wss://gateway.radiant.ai/ws');

// On disconnect, save resume token from last message
const resumeToken = lastMessage.resume_token;
const lastSeqNum = lastMessage.seq_num;

// Resume connection
const ws = new WebSocket(`wss://gateway.radiant.ai/ws?resume=${resumeToken}&last_seq=${lastSeqNum}`);
```

Missed messages are automatically replayed from JetStream HISTORY.

## Development

```bash
# Install dependencies
make deps

# Run with live reload (requires air)
make dev

# Run tests
make test

# Lint
make lint
```

## Docker

```bash
# Build image
make docker-build

# Start full stack (NATS, Egress Proxy, Gateway)
make docker-up

# View logs
make docker-logs

# Stop
make docker-down
```

## Metrics

The gateway exposes metrics at `/health`:

```json
{
  "status": "ok",
  "active_connections": 1234,
  "total_connections": 56789,
  "messages_in": 1000000,
  "messages_out": 950000
}
```

## License

Copyright © 2024 RADIANT. All rights reserved.
