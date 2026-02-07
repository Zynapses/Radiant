// RADIANT Autonomous Organism - Tensor-Link Protocol
// Vector-based transport for efficient AI communication
// Version: 1.0.0

import { randomUUID } from 'crypto';
import { createRegisteredLogger } from '../logging-registry.service';

const logger = createRegisteredLogger({
  serviceName: 'organism/tensor-link',
  category: 'infrastructure',
  sourceType: 'application',
});

// ============================================================================
// Types
// ============================================================================

type TensorDataType = 'float32' | 'float16' | 'int32' | 'int8' | 'uint8' | 'bool';
type TensorCompression = 'none' | 'zstd' | 'lz4' | 'quantized';
type MessageType = 'request' | 'response' | 'stream_chunk' | 'error';
type SemanticType = 'embedding' | 'attention' | 'logits' | 'hidden_state' | 'custom';

interface TensorPayload {
  name: string;
  dataType: TensorDataType;
  shape: number[];
  data: ArrayBuffer;
  semanticType?: SemanticType;
  modelSource?: string;
}

interface TensorLinkMessage {
  messageId: string;
  messageType: MessageType;
  tensors: TensorPayload[];
  metadata: {
    toolId?: string;
    sessionId?: string;
    sequenceNumber?: number;
    timestamp: number;
  };
  compression: TensorCompression;
  originalSizeBytes: number;
  compressedSizeBytes: number;
}

interface TensorLinkSession {
  sessionId: string;
  tenantId: string;
  userId: string;
  protocolVersion: string;
  supportedDataTypes: TensorDataType[];
  supportedCompression: TensorCompression[];
  maxTensorSizeMb: number;
  transportType: 'websocket' | 'http2' | 'quic';
  endpoint: string;
  connectedAt: Date;
  messagesSent: number;
  messagesReceived: number;
  totalBytesSent: number;
  totalBytesReceived: number;
}

interface TensorLinkConfig {
  maxMessageSizeMb: number;
  defaultCompression: TensorCompression;
  enableQuantization: boolean;
  quantizationBits: 8 | 16;
  enableStreaming: boolean;
  streamChunkSize: number;
}

// ============================================================================
// Tensor-Link Protocol Service
// ============================================================================

class TensorLinkService {
  private sessions: Map<string, TensorLinkSession> = new Map();
  private messageQueue: Map<string, TensorLinkMessage[]> = new Map();
  private config: TensorLinkConfig;

  private readonly PROTOCOL_VERSION = '1.0.0';
  private readonly DEFAULT_CONFIG: TensorLinkConfig = {
    maxMessageSizeMb: 100,
    defaultCompression: 'lz4',
    enableQuantization: true,
    quantizationBits: 16,
    enableStreaming: true,
    streamChunkSize: 65536, // 64KB chunks
  };

  constructor(config?: Partial<TensorLinkConfig>) {
    this.config = { ...this.DEFAULT_CONFIG, ...config };
  }

  // ==========================================================================
  // SESSION MANAGEMENT
  // ==========================================================================

  async createSession(
    tenantId: string,
    userId: string,
    options: {
      transportType?: 'websocket' | 'http2' | 'quic';
      endpoint?: string;
    } = {}
  ): Promise<TensorLinkSession> {
    const sessionId = randomUUID();
    const now = new Date();

    const session: TensorLinkSession = {
      sessionId,
      tenantId,
      userId,
      protocolVersion: this.PROTOCOL_VERSION,
      supportedDataTypes: ['float32', 'float16', 'int32', 'int8', 'uint8', 'bool'],
      supportedCompression: ['none', 'zstd', 'lz4', 'quantized'],
      maxTensorSizeMb: this.config.maxMessageSizeMb,
      transportType: options.transportType || 'websocket',
      endpoint: options.endpoint || `wss://tensor.radiant.ai/v1/${sessionId}`,
      connectedAt: now,
      messagesSent: 0,
      messagesReceived: 0,
      totalBytesSent: 0,
      totalBytesReceived: 0,
    };

    this.sessions.set(sessionId, session);
    this.messageQueue.set(sessionId, []);

    logger.info(`Tensor-Link session created: ${sessionId}`, {
      tenantId,
      userId,
      transportType: session.transportType,
    });

    return session;
  }

  async closeSession(sessionId: string): Promise<void> {
    const session = this.sessions.get(sessionId);
    if (!session) return;

    // Log session stats
    logger.info(`Tensor-Link session closed: ${sessionId}`, {
      messagesSent: session.messagesSent,
      messagesReceived: session.messagesReceived,
      totalBytesSent: session.totalBytesSent,
      totalBytesReceived: session.totalBytesReceived,
      durationMs: Date.now() - session.connectedAt.getTime(),
    });

    this.sessions.delete(sessionId);
    this.messageQueue.delete(sessionId);
  }

  getSession(sessionId: string): TensorLinkSession | undefined {
    return this.sessions.get(sessionId);
  }

  // ==========================================================================
  // TENSOR ENCODING/DECODING
  // ==========================================================================

  encodeTensor(
    name: string,
    data: Float32Array | Int32Array | Uint8Array | Int8Array,
    options: {
      semanticType?: SemanticType;
      modelSource?: string;
      compress?: boolean;
      quantize?: boolean;
    } = {}
  ): TensorPayload {
    let dataType: TensorDataType = 'float32';
    let shape: number[] = [data.length];
    let processedData: ArrayBuffer = data.buffer.slice(0) as ArrayBuffer;

    // Detect data type
    if (data instanceof Float32Array) {
      dataType = 'float32';
    } else if (data instanceof Int32Array) {
      dataType = 'int32';
    } else if (data instanceof Uint8Array) {
      dataType = 'uint8';
    } else if (data instanceof Int8Array) {
      dataType = 'int8';
    }

    // Apply quantization if enabled and data is float32
    if (options.quantize && this.config.enableQuantization && dataType === 'float32') {
      const quantized = this.quantizeFloat32(data as Float32Array);
      processedData = quantized.buffer.slice(0) as ArrayBuffer;
      dataType = this.config.quantizationBits === 8 ? 'int8' : 'float16';
    }

    return {
      name,
      dataType,
      shape,
      data: processedData,
      semanticType: options.semanticType,
      modelSource: options.modelSource,
    };
  }

  decodeTensor(payload: TensorPayload): Float32Array | Int32Array | Uint8Array | Int8Array {
    switch (payload.dataType) {
      case 'float32':
        return new Float32Array(payload.data);
      case 'float16':
        // Dequantize float16 to float32
        return this.dequantizeFloat16(new Uint16Array(payload.data));
      case 'int32':
        return new Int32Array(payload.data);
      case 'int8':
        return new Int8Array(payload.data);
      case 'uint8':
        return new Uint8Array(payload.data);
      case 'bool':
        return new Uint8Array(payload.data);
      default:
        throw new Error(`Unsupported tensor data type: ${payload.dataType}`);
    }
  }

  // ==========================================================================
  // QUANTIZATION
  // ==========================================================================

  private quantizeFloat32(data: Float32Array): Uint16Array | Int8Array {
    if (this.config.quantizationBits === 8) {
      return this.quantizeToInt8(data);
    }
    return this.quantizeToFloat16(data);
  }

  private quantizeToFloat16(data: Float32Array): Uint16Array {
    const result = new Uint16Array(data.length);
    
    for (let i = 0; i < data.length; i++) {
      result[i] = this.float32ToFloat16(data[i]);
    }
    
    return result;
  }

  private quantizeToInt8(data: Float32Array): Int8Array {
    const result = new Int8Array(data.length);
    
    // Find min/max for scaling
    let min = Infinity;
    let max = -Infinity;
    for (let i = 0; i < data.length; i++) {
      if (data[i] < min) min = data[i];
      if (data[i] > max) max = data[i];
    }
    
    const scale = (max - min) / 255;
    
    for (let i = 0; i < data.length; i++) {
      result[i] = Math.round((data[i] - min) / scale) - 128;
    }
    
    return result;
  }

  private dequantizeFloat16(data: Uint16Array): Float32Array {
    const result = new Float32Array(data.length);
    
    for (let i = 0; i < data.length; i++) {
      result[i] = this.float16ToFloat32(data[i]);
    }
    
    return result;
  }

  private float32ToFloat16(value: number): number {
    const float32View = new Float32Array(1);
    const int32View = new Int32Array(float32View.buffer);
    
    float32View[0] = value;
    const f = int32View[0];
    
    const sign = (f >>> 16) & 0x8000;
    const exponent = ((f >>> 23) & 0xff) - 127 + 15;
    const mantissa = f & 0x7fffff;
    
    if (exponent <= 0) {
      return sign;
    } else if (exponent > 30) {
      return sign | 0x7c00;
    }
    
    return sign | (exponent << 10) | (mantissa >>> 13);
  }

  private float16ToFloat32(value: number): number {
    const sign = (value & 0x8000) << 16;
    const exponent = (value >>> 10) & 0x1f;
    const mantissa = value & 0x3ff;
    
    let result: number;
    
    if (exponent === 0) {
      result = sign;
    } else if (exponent === 31) {
      result = sign | 0x7f800000 | (mantissa << 13);
    } else {
      result = sign | ((exponent - 15 + 127) << 23) | (mantissa << 13);
    }
    
    const float32View = new Float32Array(1);
    const int32View = new Int32Array(float32View.buffer);
    int32View[0] = result;
    
    return float32View[0];
  }

  // ==========================================================================
  // MESSAGE CREATION & PARSING
  // ==========================================================================

  createMessage(
    sessionId: string,
    messageType: MessageType,
    tensors: TensorPayload[],
    metadata: Partial<TensorLinkMessage['metadata']> = {}
  ): TensorLinkMessage {
    const session = this.sessions.get(sessionId);
    
    // Calculate sizes
    let originalSize = 0;
    for (const tensor of tensors) {
      originalSize += tensor.data.byteLength;
    }

    // Apply compression (placeholder - would use actual compression library)
    const compressedSize = this.config.defaultCompression === 'none' 
      ? originalSize 
      : Math.floor(originalSize * 0.7); // Simulated compression ratio

    const message: TensorLinkMessage = {
      messageId: randomUUID(),
      messageType,
      tensors,
      metadata: {
        sessionId,
        sequenceNumber: session ? session.messagesSent : 0,
        timestamp: Date.now(),
        ...metadata,
      },
      compression: this.config.defaultCompression,
      originalSizeBytes: originalSize,
      compressedSizeBytes: compressedSize,
    };

    // Update session stats
    if (session) {
      session.messagesSent++;
      session.totalBytesSent += compressedSize;
      this.sessions.set(sessionId, session);
    }

    return message;
  }

  parseMessage(data: ArrayBuffer): TensorLinkMessage {
    // In a real implementation, this would deserialize the binary format
    // For now, we assume the data is a JSON-serialized message with base64 tensors
    
    const text = new TextDecoder().decode(data);
    const parsed = JSON.parse(text);
    
    // Reconstruct tensor data from base64
    const tensors: TensorPayload[] = parsed.tensors.map((t: any) => ({
      ...t,
      data: this.base64ToArrayBuffer(t.data),
    }));

    return {
      ...parsed,
      tensors,
    };
  }

  serializeMessage(message: TensorLinkMessage): ArrayBuffer {
    // Serialize tensors to base64 for JSON transport
    const serializable = {
      ...message,
      tensors: message.tensors.map(t => ({
        ...t,
        data: this.arrayBufferToBase64(t.data),
      })),
    };

    const json = JSON.stringify(serializable);
    return new TextEncoder().encode(json).buffer;
  }

  // ==========================================================================
  // STREAMING
  // ==========================================================================

  async* streamTensor(
    sessionId: string,
    tensor: TensorPayload,
    options: { chunkSize?: number } = {}
  ): AsyncGenerator<TensorLinkMessage> {
    const chunkSize = options.chunkSize || this.config.streamChunkSize;
    const totalBytes = tensor.data.byteLength;
    const totalChunks = Math.ceil(totalBytes / chunkSize);

    for (let i = 0; i < totalChunks; i++) {
      const start = i * chunkSize;
      const end = Math.min(start + chunkSize, totalBytes);
      const chunkData = tensor.data.slice(start, end);

      const chunkTensor: TensorPayload = {
        ...tensor,
        name: `${tensor.name}_chunk_${i}`,
        data: chunkData,
        shape: [end - start],
      };

      const message = this.createMessage(sessionId, 'stream_chunk', [chunkTensor], {
        toolId: `stream_${tensor.name}`,
      });

      yield message;

      // Simulate async delay for streaming
      await new Promise(resolve => setTimeout(resolve, 1));
    }
  }

  async collectStreamedTensor(
    chunks: TensorLinkMessage[],
    tensorName: string
  ): Promise<TensorPayload> {
    // Collect all chunks for the tensor
    const tensorChunks = chunks
      .flatMap(m => m.tensors)
      .filter(t => t.name.startsWith(`${tensorName}_chunk_`))
      .sort((a, b) => {
        const aIdx = parseInt(a.name.split('_chunk_')[1]);
        const bIdx = parseInt(b.name.split('_chunk_')[1]);
        return aIdx - bIdx;
      });

    if (tensorChunks.length === 0) {
      throw new Error(`No chunks found for tensor: ${tensorName}`);
    }

    // Calculate total size
    const totalSize = tensorChunks.reduce((sum, chunk) => sum + chunk.data.byteLength, 0);
    const combined = new Uint8Array(totalSize);

    // Combine chunks
    let offset = 0;
    for (const chunk of tensorChunks) {
      const chunkArray = new Uint8Array(chunk.data);
      combined.set(chunkArray, offset);
      offset += chunk.data.byteLength;
    }

    // Return reconstructed tensor
    const firstChunk = tensorChunks[0];
    return {
      name: tensorName,
      dataType: firstChunk.dataType,
      shape: [totalSize / this.getDataTypeSize(firstChunk.dataType)],
      data: combined.buffer,
      semanticType: firstChunk.semanticType,
      modelSource: firstChunk.modelSource,
    };
  }

  // ==========================================================================
  // EMBEDDING TRANSPORT
  // ==========================================================================

  encodeEmbedding(
    name: string,
    embedding: Float32Array,
    modelSource?: string
  ): TensorPayload {
    return this.encodeTensor(name, embedding, {
      semanticType: 'embedding',
      modelSource,
      quantize: this.config.enableQuantization,
    });
  }

  decodeEmbedding(payload: TensorPayload): Float32Array {
    if (payload.semanticType !== 'embedding') {
      logger.warn(`Decoding non-embedding tensor as embedding: ${payload.name}`);
    }
    
    const decoded = this.decodeTensor(payload);
    
    // Ensure we return Float32Array
    if (decoded instanceof Float32Array) {
      return decoded;
    }
    
    // Convert to Float32Array if needed
    return new Float32Array(decoded);
  }

  // ==========================================================================
  // HELPERS
  // ==========================================================================

  private getDataTypeSize(dataType: TensorDataType): number {
    switch (dataType) {
      case 'float32': return 4;
      case 'float16': return 2;
      case 'int32': return 4;
      case 'int8': return 1;
      case 'uint8': return 1;
      case 'bool': return 1;
      default: return 1;
    }
  }

  private arrayBufferToBase64(buffer: ArrayBuffer): string {
    const bytes = new Uint8Array(buffer);
    let binary = '';
    for (let i = 0; i < bytes.byteLength; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
  }

  private base64ToArrayBuffer(base64: string): ArrayBuffer {
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return bytes.buffer;
  }

  // ==========================================================================
  // METRICS
  // ==========================================================================

  getSessionStats(sessionId: string): {
    messagesSent: number;
    messagesReceived: number;
    totalBytesSent: number;
    totalBytesReceived: number;
    compressionRatio: number;
    durationMs: number;
  } | null {
    const session = this.sessions.get(sessionId);
    if (!session) return null;

    return {
      messagesSent: session.messagesSent,
      messagesReceived: session.messagesReceived,
      totalBytesSent: session.totalBytesSent,
      totalBytesReceived: session.totalBytesReceived,
      compressionRatio: this.config.defaultCompression === 'none' ? 1 : 0.7,
      durationMs: Date.now() - session.connectedAt.getTime(),
    };
  }

  getAllSessionsStats(): {
    totalSessions: number;
    activeSessions: number;
    totalMessagesSent: number;
    totalMessagesReceived: number;
    totalBytesSent: number;
    totalBytesReceived: number;
  } {
    let totalMessagesSent = 0;
    let totalMessagesReceived = 0;
    let totalBytesSent = 0;
    let totalBytesReceived = 0;

    for (const session of Array.from(this.sessions.values())) {
      totalMessagesSent += session.messagesSent;
      totalMessagesReceived += session.messagesReceived;
      totalBytesSent += session.totalBytesSent;
      totalBytesReceived += session.totalBytesReceived;
    }

    return {
      totalSessions: this.sessions.size,
      activeSessions: this.sessions.size,
      totalMessagesSent,
      totalMessagesReceived,
      totalBytesSent,
      totalBytesReceived,
    };
  }
}

// ============================================================================
// Export Singleton
// ============================================================================

export const tensorLink = new TensorLinkService();
export { TensorLinkService };
