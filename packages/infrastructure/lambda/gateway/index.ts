/**
 * RADIANT Gateway Lambda Workers
 * 
 * NATS consumers for processing protocol messages from the Go Gateway.
 */

export { MCPWorkerService, handler as mcpWorkerHandler } from './mcp-worker';
