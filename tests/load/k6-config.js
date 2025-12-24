// RADIANT Load Testing Configuration
// Run with: k6 run tests/load/k6-config.js

import http from 'k6/http';
import { check, sleep, group } from 'k6';
import { Rate, Trend } from 'k6/metrics';

// Custom metrics
const errorRate = new Rate('errors');
const apiLatency = new Trend('api_latency');

// Test configuration
export const options = {
  scenarios: {
    // Smoke test - verify system works
    smoke: {
      executor: 'constant-vus',
      vus: 1,
      duration: '1m',
      tags: { test_type: 'smoke' },
      exec: 'smokeTest',
    },
    
    // Load test - normal traffic
    load: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '2m', target: 50 },   // Ramp up
        { duration: '5m', target: 50 },   // Hold
        { duration: '2m', target: 100 },  // Peak
        { duration: '5m', target: 100 },  // Hold peak
        { duration: '2m', target: 0 },    // Ramp down
      ],
      tags: { test_type: 'load' },
      exec: 'loadTest',
      startTime: '2m', // Start after smoke test
    },
    
    // Stress test - find breaking point
    stress: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '2m', target: 100 },
        { duration: '5m', target: 200 },
        { duration: '5m', target: 300 },
        { duration: '5m', target: 400 },
        { duration: '2m', target: 0 },
      ],
      tags: { test_type: 'stress' },
      exec: 'stressTest',
      startTime: '20m', // Start after load test
    },
    
    // Spike test - sudden traffic surge
    spike: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '10s', target: 100 },  // Instant spike
        { duration: '1m', target: 100 },   // Hold
        { duration: '10s', target: 500 },  // Massive spike
        { duration: '3m', target: 500 },   // Hold
        { duration: '10s', target: 100 },  // Drop
        { duration: '3m', target: 100 },   // Hold
        { duration: '10s', target: 0 },    // End
      ],
      tags: { test_type: 'spike' },
      exec: 'spikeTest',
      startTime: '45m', // Start after stress test
    },
  },
  
  thresholds: {
    http_req_duration: ['p(95)<2000', 'p(99)<5000'], // 95% under 2s, 99% under 5s
    http_req_failed: ['rate<0.01'],                   // Less than 1% failure
    errors: ['rate<0.05'],                            // Less than 5% errors
    api_latency: ['p(95)<1500'],                      // API latency 95th percentile
  },
};

// Environment configuration
const BASE_URL = __ENV.BASE_URL || 'https://api.radiant.example.com';
const API_KEY = __ENV.API_KEY || 'test-api-key';

const headers = {
  'Content-Type': 'application/json',
  'Authorization': `Bearer ${API_KEY}`,
};

// Helper functions
function checkResponse(res, name) {
  const success = check(res, {
    [`${name} - status 200`]: (r) => r.status === 200,
    [`${name} - response time < 2s`]: (r) => r.timings.duration < 2000,
  });
  
  errorRate.add(!success);
  apiLatency.add(res.timings.duration);
  
  return success;
}

// Test scenarios
export function smokeTest() {
  group('Health Check', () => {
    const res = http.get(`${BASE_URL}/v2/health`);
    checkResponse(res, 'health');
  });
  
  sleep(1);
}

export function loadTest() {
  group('API Endpoints', () => {
    // Health check
    let res = http.get(`${BASE_URL}/v2/health`);
    checkResponse(res, 'health');
    
    // List models
    res = http.get(`${BASE_URL}/v2/models`, { headers });
    checkResponse(res, 'list_models');
    
    // Get billing info
    res = http.get(`${BASE_URL}/v2/billing/credits`, { headers });
    checkResponse(res, 'billing');
    
    // Get localization bundle
    res = http.get(`${BASE_URL}/v2/localization/bundle?language=en`);
    checkResponse(res, 'localization');
  });
  
  sleep(Math.random() * 3 + 1); // 1-4 second pause
}

export function stressTest() {
  group('High Load Endpoints', () => {
    // Simulate chat completion (most resource-intensive)
    const chatPayload = JSON.stringify({
      model: 'gpt-4o',
      messages: [
        { role: 'user', content: 'Hello, how are you?' },
      ],
      max_tokens: 100,
    });
    
    const res = http.post(`${BASE_URL}/v2/chat/completions`, chatPayload, { headers });
    checkResponse(res, 'chat_completion');
  });
  
  sleep(Math.random() * 2 + 0.5); // 0.5-2.5 second pause
}

export function spikeTest() {
  group('Critical Endpoints', () => {
    // Mix of endpoints
    const endpoints = [
      { method: 'GET', url: '/v2/health', name: 'health' },
      { method: 'GET', url: '/v2/models', name: 'models' },
      { method: 'GET', url: '/v2/billing/credits', name: 'credits' },
    ];
    
    const endpoint = endpoints[Math.floor(Math.random() * endpoints.length)];
    const res = http.get(`${BASE_URL}${endpoint.url}`, { headers });
    checkResponse(res, endpoint.name);
  });
  
  sleep(Math.random() * 1 + 0.1); // 0.1-1.1 second pause
}

// Summary handler
export function handleSummary(data) {
  return {
    'stdout': textSummary(data, { indent: ' ', enableColors: true }),
    'tests/load/results/summary.json': JSON.stringify(data, null, 2),
    'tests/load/results/summary.html': htmlReport(data),
  };
}

// HTML Report generator
function htmlReport(data) {
  const metrics = data.metrics;
  
  return `
<!DOCTYPE html>
<html>
<head>
  <title>RADIANT Load Test Results</title>
  <style>
    body { font-family: system-ui, sans-serif; max-width: 1200px; margin: 0 auto; padding: 20px; }
    h1 { color: #333; }
    .metric { background: #f5f5f5; padding: 15px; margin: 10px 0; border-radius: 8px; }
    .metric h3 { margin: 0 0 10px 0; }
    .value { font-size: 24px; font-weight: bold; color: #2563eb; }
    .pass { color: #16a34a; }
    .fail { color: #dc2626; }
    .grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 20px; }
    table { width: 100%; border-collapse: collapse; }
    th, td { padding: 10px; text-align: left; border-bottom: 1px solid #ddd; }
  </style>
</head>
<body>
  <h1>RADIANT Load Test Results</h1>
  <p>Generated: ${new Date().toISOString()}</p>
  
  <div class="grid">
    <div class="metric">
      <h3>Total Requests</h3>
      <div class="value">${metrics.http_reqs?.values?.count || 0}</div>
    </div>
    <div class="metric">
      <h3>Avg Response Time</h3>
      <div class="value">${Math.round(metrics.http_req_duration?.values?.avg || 0)}ms</div>
    </div>
    <div class="metric">
      <h3>Error Rate</h3>
      <div class="value ${(metrics.http_req_failed?.values?.rate || 0) < 0.01 ? 'pass' : 'fail'}">
        ${((metrics.http_req_failed?.values?.rate || 0) * 100).toFixed(2)}%
      </div>
    </div>
  </div>
  
  <h2>Response Time Percentiles</h2>
  <table>
    <tr><th>Percentile</th><th>Duration</th></tr>
    <tr><td>p50</td><td>${Math.round(metrics.http_req_duration?.values?.['p(50)'] || 0)}ms</td></tr>
    <tr><td>p90</td><td>${Math.round(metrics.http_req_duration?.values?.['p(90)'] || 0)}ms</td></tr>
    <tr><td>p95</td><td>${Math.round(metrics.http_req_duration?.values?.['p(95)'] || 0)}ms</td></tr>
    <tr><td>p99</td><td>${Math.round(metrics.http_req_duration?.values?.['p(99)'] || 0)}ms</td></tr>
  </table>
  
  <h2>Thresholds</h2>
  <table>
    <tr><th>Threshold</th><th>Status</th></tr>
    ${Object.entries(data.thresholds || {}).map(([name, result]) => `
      <tr>
        <td>${name}</td>
        <td class="${result.ok ? 'pass' : 'fail'}">${result.ok ? 'PASS' : 'FAIL'}</td>
      </tr>
    `).join('')}
  </table>
</body>
</html>
  `;
}

function textSummary(data, options) {
  // Simple text summary
  const metrics = data.metrics;
  return `
RADIANT Load Test Summary
=========================
Total Requests: ${metrics.http_reqs?.values?.count || 0}
Failed Requests: ${metrics.http_req_failed?.values?.count || 0}
Avg Duration: ${Math.round(metrics.http_req_duration?.values?.avg || 0)}ms
P95 Duration: ${Math.round(metrics.http_req_duration?.values?.['p(95)'] || 0)}ms
P99 Duration: ${Math.round(metrics.http_req_duration?.values?.['p(99)'] || 0)}ms
  `;
}
