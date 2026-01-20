/**
 * RADIANT Egress Proxy - HTTP/2 Connection Pool
 * 
 * CORRECTION #1: HTTP/2 pools MUST run on long-lived compute (Fargate).
 * Lambda instances are isolated - 5000 concurrent requests = 5000 separate
 * TCP connections to OpenAI. This defeats multiplexing entirely.
 */

import http2 from 'node:http2';
import { ProviderConfig } from './providers';

interface PooledConnection {
  session: http2.ClientHttp2Session;
  activeStreams: number;
  maxStreams: number;
  healthy: boolean;
  createdAt: Date;
}

interface RequestOptions {
  path: string;
  method: string;
  headers: Record<string, string>;
  body?: string;
}

interface ProxyResponse {
  status: number;
  headers: Record<string, string>;
  body: string;
}

export class HTTP2Pool {
  private pools = new Map<string, PooledConnection[]>();
  private configs = new Map<string, ProviderConfig>();

  registerProvider(name: string, config: ProviderConfig): void {
    this.configs.set(name, config);
    this.pools.set(name, []);
  }

  async request(provider: string, options: RequestOptions): Promise<ProxyResponse> {
    const session = await this.getSession(provider);
    const config = this.configs.get(provider)!;

    return new Promise((resolve, reject) => {
      const headers: http2.OutgoingHttpHeaders = {
        ':method': options.method,
        ':path': options.path,
        ...config.defaultHeaders,
        ...options.headers,
      };

      const stream = session.request(headers);

      let responseHeaders: Record<string, string> = {};
      let body = '';

      stream.on('response', (hdrs) => {
        responseHeaders = hdrs as unknown as Record<string, string>;
      });

      stream.on('data', (chunk: Buffer) => {
        body += chunk.toString();
      });

      stream.on('end', () => {
        this.releaseStream(provider, session);
        resolve({
          status: parseInt(responseHeaders[':status'] || '500'),
          headers: responseHeaders,
          body,
        });
      });

      stream.on('error', (err) => {
        this.releaseStream(provider, session);
        reject(err);
      });

      if (options.body) {
        stream.write(options.body);
      }
      stream.end();
    });
  }

  private async getSession(provider: string): Promise<http2.ClientHttp2Session> {
    const config = this.configs.get(provider);
    if (!config) throw new Error(`Unknown provider: ${provider}`);

    const pool = this.pools.get(provider)!;

    // Find healthy connection with capacity
    let conn = pool.find((c) => c.healthy && c.activeStreams < c.maxStreams);

    if (!conn && pool.length < config.maxConnections) {
      conn = await this.createConnection(provider, config);
      pool.push(conn);
    }

    if (!conn) {
      // Wait for capacity with timeout
      conn = await this.waitForCapacity(provider, 30000);
    }

    conn.activeStreams++;
    return conn.session;
  }

  private async createConnection(
    _provider: string,
    config: ProviderConfig
  ): Promise<PooledConnection> {
    const session = http2.connect(config.baseUrl);

    const conn: PooledConnection = {
      session,
      activeStreams: 0,
      maxStreams: config.maxStreamsPerConnection,
      healthy: true,
      createdAt: new Date(),
    };

    session.on('error', () => {
      conn.healthy = false;
    });
    session.on('goaway', () => {
      conn.healthy = false;
    });
    session.on('close', () => {
      conn.healthy = false;
    });

    return conn;
  }

  private releaseStream(provider: string, session: http2.ClientHttp2Session): void {
    const pool = this.pools.get(provider);
    const conn = pool?.find((c) => c.session === session);
    if (conn) {
      conn.activeStreams = Math.max(0, conn.activeStreams - 1);
    }
  }

  private waitForCapacity(provider: string, timeoutMs: number): Promise<PooledConnection> {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error('Pool timeout')), timeoutMs);

      const check = () => {
        const pool = this.pools.get(provider)!;
        const conn = pool.find((c) => c.healthy && c.activeStreams < c.maxStreams);
        if (conn) {
          clearTimeout(timeout);
          resolve(conn);
        } else {
          setTimeout(check, 10);
        }
      };

      check();
    });
  }

  getStats(): Record<string, { connections: number; activeStreams: number }> {
    const stats: Record<string, { connections: number; activeStreams: number }> = {};

    for (const [provider, pool] of this.pools) {
      stats[provider] = {
        connections: pool.filter((c) => c.healthy).length,
        activeStreams: pool.reduce((sum, c) => sum + c.activeStreams, 0),
      };
    }

    return stats;
  }

  // Cleanup unhealthy connections
  cleanup(): void {
    for (const [provider, pool] of this.pools) {
      const healthy = pool.filter((c) => c.healthy);
      const unhealthy = pool.filter((c) => !c.healthy);

      for (const conn of unhealthy) {
        try {
          conn.session.close();
        } catch {
          // Ignore errors during cleanup
        }
      }

      this.pools.set(provider, healthy);
    }
  }
}
