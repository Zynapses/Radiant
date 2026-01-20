/**
 * RADIANT Gateway Load Test - WebSocket Connections
 * 
 * Tests connection capacity, message throughput, and resume token flow.
 * 
 * Usage:
 *   k6 run --vus 1000 --duration 5m gateway-websocket.js
 *   k6 run --vus 10000 --duration 10m gateway-websocket.js  # 10K connections
 *   k6 run --vus 100000 --duration 30m gateway-websocket.js # 100K connections
 * 
 * Environment Variables:
 *   GATEWAY_URL - WebSocket URL (default: ws://localhost:8443)
 *   TENANT_ID   - Test tenant ID (default: load-test-tenant)
 */

import ws from 'k6/ws';
import { check, sleep } from 'k6';
import { Counter, Trend, Rate } from 'k6/metrics';
import { randomString, randomIntBetween } from 'https://jslib.k6.io/k6-utils/1.2.0/index.js';

// Custom metrics
const messagesReceived = new Counter('messages_received');
const messagesSent = new Counter('messages_sent');
const messageLatency = new Trend('message_latency_ms');
const connectionErrors = new Counter('connection_errors');
const resumeAttempts = new Counter('resume_attempts');
const resumeSuccesses = new Counter('resume_successes');
const connectionSuccess = new Rate('connection_success');

// Configuration
const GATEWAY_URL = __ENV.GATEWAY_URL || 'ws://localhost:8443';
const TENANT_ID = __ENV.TENANT_ID || 'load-test-tenant';

// Test scenarios
export const options = {
  scenarios: {
    // Scenario 1: Ramp up connections
    ramp_up: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '1m', target: 1000 },   // Ramp to 1K
        { duration: '2m', target: 10000 },  // Ramp to 10K
        { duration: '5m', target: 50000 },  // Ramp to 50K
        { duration: '10m', target: 100000 }, // Ramp to 100K
        { duration: '5m', target: 100000 }, // Hold at 100K
        { duration: '2m', target: 0 },      // Ramp down
      ],
      gracefulRampDown: '30s',
    },
  },
  thresholds: {
    'connection_success': ['rate>0.99'],           // 99% connection success
    'message_latency_ms': ['p(95)<100'],           // 95th percentile < 100ms
    'messages_received': ['count>1000'],           // Received messages
    'connection_errors': ['count<100'],            // Less than 100 errors
  },
};

// Steady state scenario (for production testing)
export const steadyStateOptions = {
  scenarios: {
    steady: {
      executor: 'constant-vus',
      vus: 80000,  // Target: 80K connections per gateway instance
      duration: '30m',
    },
  },
};

export default function () {
  const agentId = `agent-${__VU}-${randomString(8)}`;
  const url = `${GATEWAY_URL}/ws?tenant=${TENANT_ID}&agent=${agentId}`;
  
  let resumeToken = null;
  let lastSeqNum = 0;
  let messageCount = 0;

  const res = ws.connect(url, {
    headers: {
      'X-Tenant-ID': TENANT_ID,
      'X-Principal-ID': agentId,
    },
  }, function (socket) {
    connectionSuccess.add(1);

    socket.on('open', function () {
      // Send initial MCP initialize message
      const initMsg = JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method: 'initialize',
        params: {
          protocolVersion: '2025-03-26',
          clientInfo: {
            name: 'k6-load-test',
            version: '1.0.0',
          },
          capabilities: {
            tools: { listChanged: true },
          },
        },
      });
      
      socket.send(initMsg);
      messagesSent.add(1);
    });

    socket.on('message', function (data) {
      const receiveTime = Date.now();
      messagesReceived.add(1);
      messageCount++;

      try {
        const msg = JSON.parse(data);
        
        // Extract resume token if present
        if (msg.result && msg.result.resumeToken) {
          resumeToken = msg.result.resumeToken;
        }
        
        // Track sequence number for resume
        if (msg.seqNum) {
          lastSeqNum = msg.seqNum;
        }

        // Calculate latency if timestamp is in message
        if (msg.serverTimestamp) {
          const latency = receiveTime - msg.serverTimestamp;
          messageLatency.add(latency);
        }
      } catch (e) {
        // Non-JSON message, ignore
      }
    });

    socket.on('error', function (e) {
      connectionErrors.add(1);
      console.error(`WebSocket error: ${e.error()}`);
    });

    socket.on('close', function () {
      // Connection closed
    });

    // Keep connection alive and send periodic messages
    socket.setInterval(function () {
      // Send a tool list request periodically
      const listToolsMsg = JSON.stringify({
        jsonrpc: '2.0',
        id: randomIntBetween(1000, 9999),
        method: 'tools/list',
        params: {},
      });
      
      socket.send(listToolsMsg);
      messagesSent.add(1);
    }, 5000); // Every 5 seconds

    // Keep connection open for test duration
    socket.setTimeout(function () {
      socket.close();
    }, 60000); // 60 seconds per connection cycle
  });

  // Check connection result
  check(res, {
    'WebSocket connected': (r) => r && r.status === 101,
  });

  if (!res || res.status !== 101) {
    connectionSuccess.add(0);
    connectionErrors.add(1);
  }

  // Test resume functionality (10% of VUs)
  if (resumeToken && __VU % 10 === 0) {
    sleep(1);
    testResume(resumeToken, lastSeqNum, agentId);
  }

  sleep(randomIntBetween(1, 3));
}

function testResume(resumeToken, lastSeqNum, agentId) {
  resumeAttempts.add(1);
  
  const resumeUrl = `${GATEWAY_URL}/ws?resume=${encodeURIComponent(resumeToken)}&last_seq=${lastSeqNum}`;
  
  const res = ws.connect(resumeUrl, {
    headers: {
      'X-Tenant-ID': TENANT_ID,
      'X-Principal-ID': agentId,
    },
  }, function (socket) {
    socket.on('open', function () {
      resumeSuccesses.add(1);
    });

    socket.on('message', function (data) {
      messagesReceived.add(1);
      
      try {
        const msg = JSON.parse(data);
        // Check if we received missed messages (replay)
        if (msg.replay) {
          console.log(`Received ${msg.replay.length} replayed messages`);
        }
      } catch (e) {
        // Ignore parse errors
      }
    });

    socket.setTimeout(function () {
      socket.close();
    }, 10000); // Short resume test
  });

  check(res, {
    'Resume connected': (r) => r && r.status === 101,
  });
}

// Teardown - report summary
export function handleSummary(data) {
  const summary = {
    timestamp: new Date().toISOString(),
    gateway_url: GATEWAY_URL,
    tenant_id: TENANT_ID,
    metrics: {
      total_connections: data.metrics.iterations ? data.metrics.iterations.values.count : 0,
      connection_success_rate: data.metrics.connection_success ? data.metrics.connection_success.values.rate : 0,
      messages_sent: data.metrics.messages_sent ? data.metrics.messages_sent.values.count : 0,
      messages_received: data.metrics.messages_received ? data.metrics.messages_received.values.count : 0,
      message_latency_p95: data.metrics.message_latency_ms ? data.metrics.message_latency_ms.values['p(95)'] : 0,
      connection_errors: data.metrics.connection_errors ? data.metrics.connection_errors.values.count : 0,
      resume_attempts: data.metrics.resume_attempts ? data.metrics.resume_attempts.values.count : 0,
      resume_successes: data.metrics.resume_successes ? data.metrics.resume_successes.values.count : 0,
    },
  };

  return {
    'stdout': textSummary(data, { indent: ' ', enableColors: true }),
    'results/gateway-load-test.json': JSON.stringify(summary, null, 2),
  };
}

function textSummary(data, options) {
  const lines = [];
  lines.push('');
  lines.push('='.repeat(60));
  lines.push('  RADIANT GATEWAY LOAD TEST SUMMARY');
  lines.push('='.repeat(60));
  lines.push('');
  
  if (data.metrics.iterations) {
    lines.push(`  Total Connections:    ${data.metrics.iterations.values.count}`);
  }
  if (data.metrics.connection_success) {
    lines.push(`  Success Rate:         ${(data.metrics.connection_success.values.rate * 100).toFixed(2)}%`);
  }
  if (data.metrics.messages_sent) {
    lines.push(`  Messages Sent:        ${data.metrics.messages_sent.values.count}`);
  }
  if (data.metrics.messages_received) {
    lines.push(`  Messages Received:    ${data.metrics.messages_received.values.count}`);
  }
  if (data.metrics.message_latency_ms) {
    lines.push(`  Latency (p95):        ${data.metrics.message_latency_ms.values['p(95)'].toFixed(2)}ms`);
  }
  if (data.metrics.connection_errors) {
    lines.push(`  Connection Errors:    ${data.metrics.connection_errors.values.count}`);
  }
  
  lines.push('');
  lines.push('='.repeat(60));
  lines.push('');
  
  return lines.join('\n');
}
