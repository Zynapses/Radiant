/**
 * RADIANT Egress Proxy - HTTP/2 Connection Pool Service
 * 
 * This service runs on Fargate (long-lived compute) and holds the HTTP/2
 * connection pools to AI providers. Lambdas call this proxy instead of
 * making direct connections.
 * 
 * CORRECTION #1: HTTP/2 pool MUST NOT run in Lambda
 * - Lambda instances are isolated
 * - 5000 concurrent requests = 5000 separate TCP connections
 * - This defeats HTTP/2 multiplexing entirely
 */

import Fastify from 'fastify';
import { HTTP2Pool } from './pool';
import { providerConfigs } from './providers';

const app = Fastify({
  logger: {
    level: process.env.LOG_LEVEL || 'info',
  },
});

const pool = new HTTP2Pool();

// Initialize provider pools
for (const [name, config] of Object.entries(providerConfigs)) {
  pool.registerProvider(name, config);
  app.log.info(`Registered provider: ${name} -> ${config.baseUrl}`);
}

// Periodic cleanup of unhealthy connections
setInterval(() => pool.cleanup(), 30000);

interface ProxyRequest {
  provider: string;
  path: string;
  method: string;
  headers: Record<string, string>;
  body?: unknown;
}

app.post<{ Body: ProxyRequest }>('/proxy', async (request, reply) => {
  const { provider, path, method, headers, body } = request.body;

  if (!provider || !path || !method) {
    return reply.status(400).send({
      error: 'Bad Request',
      message: 'Missing required fields: provider, path, method',
    });
  }

  try {
    const response = await pool.request(provider, {
      path,
      method,
      headers: headers || {},
      body: body ? JSON.stringify(body) : undefined,
    });

    return reply.status(response.status).send(response.body);
  } catch (err) {
    const error = err as Error;
    request.log.error({ err: error, provider, path }, 'Proxy request failed');
    return reply.status(502).send({
      error: 'Bad Gateway',
      message: error.message,
    });
  }
});

// Streaming proxy endpoint for SSE responses
app.post<{ Body: ProxyRequest }>('/proxy/stream', async (request, reply) => {
  const { provider, path, method, headers, body } = request.body;

  if (!provider || !path || !method) {
    return reply.status(400).send({
      error: 'Bad Request',
      message: 'Missing required fields: provider, path, method',
    });
  }

  try {
    // For streaming, we return chunked response
    reply.raw.setHeader('Content-Type', 'text/event-stream');
    reply.raw.setHeader('Cache-Control', 'no-cache');
    reply.raw.setHeader('Connection', 'keep-alive');

    const response = await pool.request(provider, {
      path,
      method,
      headers: { ...headers, 'Accept': 'text/event-stream' },
      body: body ? JSON.stringify(body) : undefined,
    });

    reply.raw.write(response.body);
    reply.raw.end();
  } catch (err) {
    const error = err as Error;
    request.log.error({ err: error, provider, path }, 'Stream proxy request failed');
    return reply.status(502).send({
      error: 'Bad Gateway',
      message: error.message,
    });
  }
});

app.get('/health', async () => ({
  status: 'ok',
  pools: pool.getStats(),
  uptime: process.uptime(),
}));

app.get('/metrics', async () => ({
  pools: pool.getStats(),
  memory: process.memoryUsage(),
  uptime: process.uptime(),
}));

const PORT = parseInt(process.env.PORT || '9000');
const HOST = process.env.HOST || '0.0.0.0';

app.listen({ port: PORT, host: HOST }, (err, address) => {
  if (err) {
    app.log.error(err);
    process.exit(1);
  }
  app.log.info(`RADIANT Egress Proxy listening on ${address}`);
});
