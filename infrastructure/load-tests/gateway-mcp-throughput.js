/**
 * RADIANT Gateway Load Test - MCP Message Throughput
 * 
 * Tests MCP JSON-RPC message processing throughput and latency.
 * Simulates realistic MCP workflows: initialize → list tools → call tools → stream responses.
 * 
 * Usage:
 *   k6 run --vus 100 --duration 5m gateway-mcp-throughput.js
 * 
 * Environment Variables:
 *   GATEWAY_URL - WebSocket URL (default: ws://localhost:8443)
 *   TENANT_ID   - Test tenant ID (default: load-test-tenant)
 */

import ws from 'k6/ws';
import { check, sleep } from 'k6';
import { Counter, Trend, Gauge } from 'k6/metrics';
import { randomString, randomIntBetween } from 'https://jslib.k6.io/k6-utils/1.2.0/index.js';

// Custom metrics
const rpcLatency = new Trend('rpc_latency_ms');
const toolCallLatency = new Trend('tool_call_latency_ms');
const streamChunks = new Counter('stream_chunks');
const rpcRequests = new Counter('rpc_requests');
const rpcResponses = new Counter('rpc_responses');
const rpcErrors = new Counter('rpc_errors');
const activeConnections = new Gauge('active_connections');

// Configuration
const GATEWAY_URL = __ENV.GATEWAY_URL || 'ws://localhost:8443';
const TENANT_ID = __ENV.TENANT_ID || 'load-test-tenant';

export const options = {
  scenarios: {
    throughput: {
      executor: 'constant-arrival-rate',
      rate: 1000,           // 1000 RPS
      timeUnit: '1s',
      duration: '5m',
      preAllocatedVUs: 100,
      maxVUs: 500,
    },
  },
  thresholds: {
    'rpc_latency_ms': ['p(95)<50', 'p(99)<100'],  // 95th < 50ms, 99th < 100ms
    'tool_call_latency_ms': ['p(95)<200'],         // Tool calls < 200ms
    'rpc_errors': ['count<10'],                    // Less than 10 errors
  },
};

// MCP message templates
const MCP_MESSAGES = {
  initialize: (id) => ({
    jsonrpc: '2.0',
    id,
    method: 'initialize',
    params: {
      protocolVersion: '2025-03-26',
      clientInfo: { name: 'k6-mcp-test', version: '1.0.0' },
      capabilities: { tools: { listChanged: true } },
    },
  }),

  listTools: (id) => ({
    jsonrpc: '2.0',
    id,
    method: 'tools/list',
    params: {},
  }),

  callTool: (id, toolName, args) => ({
    jsonrpc: '2.0',
    id,
    method: 'tools/call',
    params: {
      name: toolName,
      arguments: args,
    },
  }),

  ping: (id) => ({
    jsonrpc: '2.0',
    id,
    method: 'ping',
    params: {},
  }),
};

// Simulated tools to call
const TOOLS = [
  { name: 'search', args: { query: 'test query' } },
  { name: 'calculate', args: { expression: '2 + 2' } },
  { name: 'fetch_data', args: { source: 'database', limit: 10 } },
  { name: 'transform', args: { input: 'test', format: 'json' } },
];

export default function () {
  const agentId = `agent-${__VU}-${randomString(8)}`;
  const url = `${GATEWAY_URL}/ws`;
  
  const pendingRequests = new Map();
  let messageId = 1;

  const res = ws.connect(url, {
    headers: {
      'X-Tenant-ID': TENANT_ID,
      'X-Principal-ID': agentId,
    },
  }, function (socket) {
    activeConnections.add(1);

    socket.on('open', function () {
      // Initialize session
      const initId = messageId++;
      pendingRequests.set(initId, { sentAt: Date.now(), method: 'initialize' });
      socket.send(JSON.stringify(MCP_MESSAGES.initialize(initId)));
      rpcRequests.add(1);
    });

    socket.on('message', function (data) {
      const receiveTime = Date.now();

      try {
        const msg = JSON.parse(data);
        
        if (msg.id && pendingRequests.has(msg.id)) {
          const req = pendingRequests.get(msg.id);
          const latency = receiveTime - req.sentAt;
          
          rpcLatency.add(latency);
          rpcResponses.add(1);
          pendingRequests.delete(msg.id);

          if (req.method === 'tools/call') {
            toolCallLatency.add(latency);
          }

          // Check for errors
          if (msg.error) {
            rpcErrors.add(1);
          }
        }

        // Handle streaming responses
        if (msg.method === 'notifications/progress') {
          streamChunks.add(1);
        }
      } catch (e) {
        // Ignore parse errors
      }
    });

    socket.on('error', function (e) {
      rpcErrors.add(1);
    });

    socket.on('close', function () {
      activeConnections.add(-1);
    });

    // Run MCP workflow
    socket.setTimeout(function () {
      // List tools
      const listId = messageId++;
      pendingRequests.set(listId, { sentAt: Date.now(), method: 'tools/list' });
      socket.send(JSON.stringify(MCP_MESSAGES.listTools(listId)));
      rpcRequests.add(1);
    }, 100);

    // Call random tools
    for (let i = 0; i < 5; i++) {
      socket.setTimeout(function () {
        const tool = TOOLS[randomIntBetween(0, TOOLS.length - 1)];
        const callId = messageId++;
        pendingRequests.set(callId, { sentAt: Date.now(), method: 'tools/call' });
        socket.send(JSON.stringify(MCP_MESSAGES.callTool(callId, tool.name, tool.args)));
        rpcRequests.add(1);
      }, 200 + (i * 500));
    }

    // Periodic pings
    socket.setInterval(function () {
      const pingId = messageId++;
      pendingRequests.set(pingId, { sentAt: Date.now(), method: 'ping' });
      socket.send(JSON.stringify(MCP_MESSAGES.ping(pingId)));
      rpcRequests.add(1);
    }, 1000);

    // Close after workflow
    socket.setTimeout(function () {
      socket.close();
    }, 5000);
  });

  check(res, {
    'WebSocket connected': (r) => r && r.status === 101,
  });

  sleep(0.1);
}

export function handleSummary(data) {
  const lines = [];
  lines.push('');
  lines.push('='.repeat(60));
  lines.push('  RADIANT MCP THROUGHPUT TEST SUMMARY');
  lines.push('='.repeat(60));
  lines.push('');
  
  if (data.metrics.rpc_requests) {
    lines.push(`  RPC Requests:         ${data.metrics.rpc_requests.values.count}`);
  }
  if (data.metrics.rpc_responses) {
    lines.push(`  RPC Responses:        ${data.metrics.rpc_responses.values.count}`);
  }
  if (data.metrics.rpc_latency_ms) {
    lines.push(`  RPC Latency (p50):    ${data.metrics.rpc_latency_ms.values['p(50)'].toFixed(2)}ms`);
    lines.push(`  RPC Latency (p95):    ${data.metrics.rpc_latency_ms.values['p(95)'].toFixed(2)}ms`);
    lines.push(`  RPC Latency (p99):    ${data.metrics.rpc_latency_ms.values['p(99)'].toFixed(2)}ms`);
  }
  if (data.metrics.tool_call_latency_ms) {
    lines.push(`  Tool Call (p95):      ${data.metrics.tool_call_latency_ms.values['p(95)'].toFixed(2)}ms`);
  }
  if (data.metrics.stream_chunks) {
    lines.push(`  Stream Chunks:        ${data.metrics.stream_chunks.values.count}`);
  }
  if (data.metrics.rpc_errors) {
    lines.push(`  RPC Errors:           ${data.metrics.rpc_errors.values.count}`);
  }
  
  lines.push('');
  lines.push('='.repeat(60));
  lines.push('');
  
  return {
    'stdout': lines.join('\n'),
    'results/mcp-throughput-test.json': JSON.stringify({
      timestamp: new Date().toISOString(),
      metrics: {
        rpc_requests: data.metrics.rpc_requests?.values.count || 0,
        rpc_responses: data.metrics.rpc_responses?.values.count || 0,
        rpc_latency_p95: data.metrics.rpc_latency_ms?.values['p(95)'] || 0,
        rpc_latency_p99: data.metrics.rpc_latency_ms?.values['p(99)'] || 0,
        tool_call_latency_p95: data.metrics.tool_call_latency_ms?.values['p(95)'] || 0,
        rpc_errors: data.metrics.rpc_errors?.values.count || 0,
      },
    }, null, 2),
  };
}
