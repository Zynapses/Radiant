/**
 * RADIANT Gateway Lambda Workers
 * 
 * NATS consumers for processing protocol messages from the Go Gateway.
 * 
 * Protocols:
 * - MCP (Model Context Protocol) - AI tool invocation
 * - A2A (Agent-to-Agent) - Inter-agent communication
 */

export { MCPWorkerService, handler as mcpWorkerHandler } from './mcp-worker';
export { A2AWorkerService, handler as a2aWorkerHandler } from './a2a-worker';
