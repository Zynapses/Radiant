/**
 * WebSocket Client for RADIANT Admin Dashboard
 * Handles real-time updates for model warm-up status, notifications, etc.
 * 
 * Security: Token is sent as first message after connection, NOT in URL.
 * This prevents token exposure in server logs, browser history, and referrer headers.
 */

type MessageHandler = (data: WebSocketMessage) => void;
type ConnectionHandler = () => void;
type ErrorHandler = (error: Error) => void;

export interface WebSocketMessage {
  type: 'model_warmup' | 'notification' | 'health_update' | 'approval_update' | 'auth_response' | 'pong';
  payload: unknown;
  timestamp: string;
}

interface ModelWarmupPayload {
  modelId: string;
  status: 'starting' | 'in_progress' | 'complete' | 'failed';
  progress?: number;
  estimatedTimeRemaining?: number;
  error?: string;
}

interface NotificationPayload {
  id: string;
  type: 'info' | 'warning' | 'error' | 'success';
  title: string;
  message: string;
}

interface QueuedMessage {
  message: { type: string; payload: unknown };
  resolve: () => void;
  reject: (error: Error) => void;
  timestamp: number;
}

class RadiantWebSocketClient {
  private ws: WebSocket | null = null;
  private url: string;
  private messageHandlers: Set<MessageHandler> = new Set();
  private connectHandlers: Set<ConnectionHandler> = new Set();
  private disconnectHandlers: Set<ConnectionHandler> = new Set();
  private errorHandlers: Set<ErrorHandler> = new Set();
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectDelay = 1000;
  private isConnecting = false;
  private isAuthenticated = false;
  private accessToken: string | null = null;
  
  // Heartbeat
  private heartbeatInterval: ReturnType<typeof setInterval> | null = null;
  private heartbeatTimeout: ReturnType<typeof setTimeout> | null = null;
  private readonly HEARTBEAT_INTERVAL = 30000; // 30 seconds
  private readonly HEARTBEAT_TIMEOUT = 10000; // 10 seconds to respond
  
  // Message queue for retry
  private messageQueue: QueuedMessage[] = [];
  private readonly MAX_QUEUE_SIZE = 100;
  private readonly MESSAGE_TIMEOUT = 30000; // 30 seconds

  constructor() {
    this.url = process.env.NEXT_PUBLIC_WS_URL || '';
  }

  setAccessToken(token: string | null) {
    this.accessToken = token;
    // If already connected, re-authenticate
    if (this.ws?.readyState === WebSocket.OPEN && token) {
      this.authenticate();
    }
  }

  connect() {
    if (this.isConnecting || this.ws?.readyState === WebSocket.OPEN) {
      return;
    }

    if (!this.url) {
      if (process.env.NODE_ENV === 'development') {
        console.warn('[WebSocket] URL not configured');
      }
      return;
    }

    this.isConnecting = true;
    this.isAuthenticated = false;

    try {
      // Connect WITHOUT token in URL (security fix)
      this.ws = new WebSocket(this.url);

      this.ws.onopen = () => {
        this.isConnecting = false;
        this.reconnectAttempts = 0;
        
        // Authenticate via first message (not URL)
        if (this.accessToken) {
          this.authenticate();
        }
        
        this.startHeartbeat();
        this.connectHandlers.forEach((handler) => handler());
        this.flushMessageQueue();
      };

      this.ws.onmessage = (event) => {
        this.handleMessage(event);
      };

      this.ws.onclose = (event) => {
        this.isConnecting = false;
        this.isAuthenticated = false;
        this.stopHeartbeat();
        this.disconnectHandlers.forEach((handler) => handler());
        
        // Don't reconnect if closed cleanly (code 1000) or intentionally
        if (event.code !== 1000 && this.reconnectAttempts < this.maxReconnectAttempts) {
          this.attemptReconnect();
        }
      };

      this.ws.onerror = () => {
        const error = new Error('WebSocket connection error');
        this.errorHandlers.forEach((handler) => handler(error));
        this.isConnecting = false;
      };
    } catch (error) {
      const err = error instanceof Error ? error : new Error('Failed to create WebSocket');
      this.errorHandlers.forEach((handler) => handler(err));
      this.isConnecting = false;
    }
  }

  private authenticate() {
    if (this.ws?.readyState === WebSocket.OPEN && this.accessToken) {
      this.ws.send(JSON.stringify({
        type: 'auth',
        payload: { token: this.accessToken },
        timestamp: new Date().toISOString(),
      }));
    }
  }

  private handleMessage(event: MessageEvent) {
    // Reset heartbeat timeout on any message
    this.resetHeartbeatTimeout();
    
    try {
      const message: WebSocketMessage = JSON.parse(event.data);
      
      // Handle auth response
      if (message.type === 'auth_response') {
        const payload = message.payload as { success: boolean; error?: string };
        this.isAuthenticated = payload.success;
        if (!payload.success) {
          const error = new Error(payload.error || 'Authentication failed');
          this.errorHandlers.forEach((handler) => handler(error));
        }
        return;
      }
      
      // Handle pong (heartbeat response)
      if (message.type === 'pong') {
        return;
      }
      
      this.messageHandlers.forEach((handler) => handler(message));
    } catch {
      // Ignore parse errors in production
      if (process.env.NODE_ENV === 'development') {
        console.error('[WebSocket] Failed to parse message');
      }
    }
  }

  // Heartbeat to detect silent disconnections
  private startHeartbeat() {
    this.stopHeartbeat();
    
    this.heartbeatInterval = setInterval(() => {
      if (this.ws?.readyState === WebSocket.OPEN) {
        this.ws.send(JSON.stringify({ type: 'ping', timestamp: new Date().toISOString() }));
        
        // Set timeout for pong response
        this.heartbeatTimeout = setTimeout(() => {
          if (process.env.NODE_ENV === 'development') {
            console.warn('[WebSocket] Heartbeat timeout, reconnecting...');
          }
          this.ws?.close();
        }, this.HEARTBEAT_TIMEOUT);
      }
    }, this.HEARTBEAT_INTERVAL);
  }

  private stopHeartbeat() {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
    this.resetHeartbeatTimeout();
  }

  private resetHeartbeatTimeout() {
    if (this.heartbeatTimeout) {
      clearTimeout(this.heartbeatTimeout);
      this.heartbeatTimeout = null;
    }
  }

  private attemptReconnect() {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      const error = new Error('Max reconnection attempts reached');
      this.errorHandlers.forEach((handler) => handler(error));
      return;
    }

    this.reconnectAttempts++;
    const delay = this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1);

    setTimeout(() => {
      this.connect();
    }, delay);
  }

  disconnect() {
    this.stopHeartbeat();
    this.reconnectAttempts = this.maxReconnectAttempts; // Prevent auto-reconnect
    
    if (this.ws) {
      this.ws.close(1000, 'Client disconnect'); // Clean close
      this.ws = null;
    }
    
    this.isAuthenticated = false;
    this.rejectQueuedMessages(new Error('Client disconnected'));
  }

  onMessage(handler: MessageHandler) {
    this.messageHandlers.add(handler);
    return () => this.messageHandlers.delete(handler);
  }

  onConnect(handler: ConnectionHandler) {
    this.connectHandlers.add(handler);
    return () => this.connectHandlers.delete(handler);
  }

  onDisconnect(handler: ConnectionHandler) {
    this.disconnectHandlers.add(handler);
    return () => this.disconnectHandlers.delete(handler);
  }

  onError(handler: ErrorHandler) {
    this.errorHandlers.add(handler);
    return () => this.errorHandlers.delete(handler);
  }

  // Send with retry queue
  send(message: { type: string; payload: unknown }): Promise<void> {
    return new Promise((resolve, reject) => {
      if (this.ws?.readyState === WebSocket.OPEN) {
        try {
          this.ws.send(JSON.stringify(message));
          resolve();
        } catch (error) {
          // Queue for retry
          this.queueMessage(message, resolve, reject);
        }
      } else {
        // Queue for when connection is restored
        this.queueMessage(message, resolve, reject);
      }
    });
  }

  // Fire-and-forget send (original behavior)
  sendSync(message: { type: string; payload: unknown }): boolean {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(message));
      return true;
    }
    return false;
  }

  private queueMessage(
    message: { type: string; payload: unknown },
    resolve: () => void,
    reject: (error: Error) => void
  ) {
    // Enforce queue size limit
    if (this.messageQueue.length >= this.MAX_QUEUE_SIZE) {
      const oldest = this.messageQueue.shift();
      oldest?.reject(new Error('Message queue overflow'));
    }

    this.messageQueue.push({
      message,
      resolve,
      reject,
      timestamp: Date.now(),
    });
  }

  private flushMessageQueue() {
    const now = Date.now();
    const validMessages: QueuedMessage[] = [];

    for (const item of this.messageQueue) {
      if (now - item.timestamp > this.MESSAGE_TIMEOUT) {
        item.reject(new Error('Message timeout'));
      } else {
        validMessages.push(item);
      }
    }

    this.messageQueue = [];

    for (const item of validMessages) {
      if (this.ws?.readyState === WebSocket.OPEN) {
        try {
          this.ws.send(JSON.stringify(item.message));
          item.resolve();
        } catch {
          item.reject(new Error('Failed to send queued message'));
        }
      } else {
        item.reject(new Error('Connection not available'));
      }
    }
  }

  private rejectQueuedMessages(error: Error) {
    for (const item of this.messageQueue) {
      item.reject(error);
    }
    this.messageQueue = [];
  }

  get isConnected() {
    return this.ws?.readyState === WebSocket.OPEN;
  }

  get authenticated() {
    return this.isAuthenticated;
  }
}

// Export singleton instance
export const wsClient = new RadiantWebSocketClient();

// Export types
export type { ModelWarmupPayload, NotificationPayload };
