/**
 * RADIANT Mock Worker
 * 
 * Simulates Lambda handlers for local gateway development.
 * Implements DUAL PUBLISH pattern (CORRECTION #3):
 * 1. Core NATS (live delivery)
 * 2. JetStream HISTORY (replay on reconnect)
 */

const { connect, StringCodec } = require('nats');
const sc = StringCodec();

let seqCounter = 0;

async function main() {
  const nc = await connect({ 
    servers: process.env.NATS_URL || 'nats://localhost:4222' 
  });
  const js = nc.jetstream();

  console.log('🤖 RADIANT Mock Worker Connected');
  console.log('   Listening for messages on in.mcp.> and in.a2a.>');

  // Get MCP consumer
  let mcpConsumer;
  try {
    mcpConsumer = await js.consumers.get('INBOX', 'mcp-workers');
  } catch (err) {
    console.log('Creating mcp-workers consumer...');
    mcpConsumer = await js.consumers.add('INBOX', {
      durable_name: 'mcp-workers',
      filter_subject: 'in.mcp.>',
      ack_policy: 'explicit',
      max_deliver: 3,
    });
  }

  const messages = await mcpConsumer.consume();

  for await (const msg of messages) {
    try {
      const data = JSON.parse(sc.decode(msg.data));
      // Support both camelCase (Go) and snake_case (legacy) field names
      const sessionId = data.sessionId || data.session_id;
      const tenantId = data.tenantId || data.tenant_id;
      const protocol = data.protocol;
      const payloadStr = Buffer.from(data.payload).toString();
      
      console.log(`📩 Processing: session=${sessionId}`);
      console.log(`   Protocol: ${protocol}`);
      console.log(`   Tenant: ${tenantId}`);

      let payload;
      try {
        payload = JSON.parse(payloadStr);
      } catch {
        payload = { raw: payloadStr };
      }

      seqCounter++;

      // Generate response based on protocol
      let result;
      if (payload.method === 'initialize') {
        result = {
          jsonrpc: '2.0',
          id: payload.id,
          result: {
            protocolVersion: '2025-03-26',
            capabilities: {
              tools: { listChanged: true },
              resources: { subscribe: true, listChanged: true },
              prompts: { listChanged: true },
            },
            serverInfo: {
              name: 'radiant-gateway',
              version: '1.0.0',
            },
          },
        };
      } else if (payload.method === 'tools/list') {
        result = {
          jsonrpc: '2.0',
          id: payload.id,
          result: {
            tools: [
              {
                name: 'echo',
                description: 'Echoes back the input',
                inputSchema: {
                  type: 'object',
                  properties: {
                    message: { type: 'string' },
                  },
                  required: ['message'],
                },
              },
            ],
          },
        };
      } else if (payload.method === 'tools/call') {
        const toolName = payload.params?.name || 'unknown';
        const args = payload.params?.arguments || {};
        
        result = {
          jsonrpc: '2.0',
          id: payload.id,
          result: {
            content: [{
              type: 'text',
              text: `Tool '${toolName}' executed with args: ${JSON.stringify(args)}`,
            }],
          },
        };
      } else {
        result = {
          jsonrpc: '2.0',
          id: payload.id || null,
          result: {
            content: [{
              type: 'text',
              text: `Echo: ${payloadStr}`,
            }],
          },
        };
      }

      // Use camelCase to match Go struct json tags
      const response = JSON.stringify({
        messageId: `msg_${Date.now()}`,
        sessionId: sessionId,
        payload: JSON.stringify(result),
        seqNum: seqCounter,
        isPartial: false,
        isFinal: true,
      });

      // ================================================================
      // DUAL PUBLISH PATTERN (CORRECTION #3)
      // ================================================================

      // 1. Core NATS — Live delivery (fire-and-forget, low latency)
      const outSubject = `out.${sessionId}`;
      nc.publish(outSubject, sc.encode(response));
      console.log(`   📤 Published to ${outSubject}`);

      // 2. JetStream HISTORY — Persisted for replay
      const historySubject = `history.${sessionId}`;
      await js.publish(historySubject, sc.encode(response));
      console.log(`   📦 Persisted to ${historySubject}`);

      msg.ack();
      console.log(`   ✅ Acknowledged (seq=${seqCounter})`);
    } catch (err) {
      console.error('Error processing message:', err);
      msg.nak();
    }
  }
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
