# RADIANT Gateway Load Testing

Load testing suite for the Multi-Protocol Gateway using [k6](https://k6.io/).

## Prerequisites

```bash
# Install k6
brew install k6

# Or via Docker
docker pull grafana/k6
```

## Test Scripts

| Script | Purpose | Target |
|--------|---------|--------|
| `gateway-websocket.js` | Connection capacity | 100K+ concurrent connections |
| `gateway-mcp-throughput.js` | Message throughput | 1000+ RPS |

## Quick Start

### Local Testing

```bash
# Start gateway stack
cd apps/gateway
make docker-up

# Run connection test (1K connections)
k6 run --vus 1000 --duration 2m infrastructure/load-tests/gateway-websocket.js

# Run throughput test
k6 run --vus 100 --duration 5m infrastructure/load-tests/gateway-mcp-throughput.js
```

### Production Testing

```bash
# Set gateway URL
export GATEWAY_URL=wss://gateway.radiant.ai

# Ramp to 100K connections
k6 run infrastructure/load-tests/gateway-websocket.js

# High throughput test
k6 run --vus 500 --duration 10m infrastructure/load-tests/gateway-mcp-throughput.js
```

## Configuration

| Environment Variable | Default | Description |
|---------------------|---------|-------------|
| `GATEWAY_URL` | `ws://localhost:8443` | Gateway WebSocket URL |
| `TENANT_ID` | `load-test-tenant` | Test tenant identifier |

## Scenarios

### Connection Capacity Test (`gateway-websocket.js`)

Ramps up connections to test gateway capacity:

```
0m-1m:   0 → 1,000 connections
1m-3m:   1,000 → 10,000 connections
3m-8m:   10,000 → 50,000 connections
8m-18m:  50,000 → 100,000 connections
18m-23m: Hold at 100,000 connections
23m-25m: Ramp down
```

**Thresholds:**
- Connection success rate > 99%
- Message latency p95 < 100ms
- Connection errors < 100

### MCP Throughput Test (`gateway-mcp-throughput.js`)

Tests JSON-RPC message processing:

- Constant arrival rate: 1000 RPS
- Simulates full MCP workflow: initialize → list tools → call tools
- Measures RPC latency and tool call latency

**Thresholds:**
- RPC latency p95 < 50ms
- RPC latency p99 < 100ms
- Tool call latency p95 < 200ms
- RPC errors < 10

## Results

Results are saved to `results/` directory:

```
results/
├── gateway-load-test.json      # Connection test results
└── mcp-throughput-test.json    # Throughput test results
```

## Capacity Planning Reference

| Instance Type | vCPUs | Memory | Expected Connections |
|---------------|-------|--------|---------------------|
| c6g.medium | 1 | 2GB | ~10,000 |
| c6g.large | 2 | 4GB | ~25,000 |
| c6g.xlarge | 4 | 8GB | ~50,000-80,000 |
| c6g.2xlarge | 8 | 16GB | ~150,000 |

**Memory per connection:** ~10KB (WebSocket buffer + NATS subscription + session state)

## Grafana Dashboard

For real-time monitoring during tests, use k6 Cloud or stream to InfluxDB:

```bash
# Stream to InfluxDB
k6 run --out influxdb=http://localhost:8086/k6 gateway-websocket.js
```

## Troubleshooting

### Connection Failures

1. Check gateway logs: `make docker-logs`
2. Verify NATS is healthy: `curl localhost:8222/healthz`
3. Check file descriptor limits: `ulimit -n` (should be 100000+)

### High Latency

1. Check NATS JetStream consumer lag
2. Monitor Lambda cold starts
3. Review egress proxy HTTP/2 pool utilization

### Memory Issues

1. Reduce `MaxConnections` in config
2. Scale horizontally (add more gateway instances)
3. Check for connection leaks in logs
