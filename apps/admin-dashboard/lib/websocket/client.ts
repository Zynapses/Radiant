/**
 * WebSocket Client for RADIANT Admin Dashboard
 * Handles real-time updates for model warm-up status, notifications, etc.
 */

type MessageHandler = (data: WebSocketMessage) => void;
type ConnectionHandler = () => void;

export interface WebSocketMessage {
  type: 'model_warmup' | 'notification' | 'health_update' | 'approval_update';
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

class RadiantWebSocketClient {
  private ws: WebSocket | null = null;
  private url: string;
  private messageHandlers: Set<MessageHandler> = new Set();
  private connectHandlers: Set<ConnectionHandler> = new Set();
  private disconnectHandlers: Set<ConnectionHandler> = new Set();
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectDelay = 1000;
  private isConnecting = false;
  private accessToken: string | null = null;

  constructor() {
    this.url = process.env.NEXT_PUBLIC_WS_URL || '';
  }

  setAccessToken(token: string | null) {
    this.accessToken = token;
  }

  connect() {
    if (this.isConnecting || this.ws?.readyState === WebSocket.OPEN) {
      return;
    }

    if (!this.url) {
      console.warn('WebSocket URL not configured');
      return;
    }

    this.isConnecting = true;

    try {
      const wsUrl = this.accessToken 
        ? `${this.url}?token=${this.accessToken}`
        : this.url;
      
      this.ws = new WebSocket(wsUrl);

      this.ws.onopen = () => {
        this.isConnecting = false;
        this.reconnectAttempts = 0;
        this.connectHandlers.forEach((handler) => handler());
      };

      this.ws.onmessage = (event) => {
        try {
          const message: WebSocketMessage = JSON.parse(event.data);
          this.messageHandlers.forEach((handler) => handler(message));
        } catch (error) {
          console.error('Failed to parse WebSocket message:', error);
        }
      };

      this.ws.onclose = () => {
        this.isConnecting = false;
        this.disconnectHandlers.forEach((handler) => handler());
        this.attemptReconnect();
      };

      this.ws.onerror = (error) => {
        console.error('WebSocket error:', error);
        this.isConnecting = false;
      };
    } catch (error) {
      console.error('Failed to create WebSocket connection:', error);
      this.isConnecting = false;
    }
  }

  private attemptReconnect() {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.warn('Max WebSocket reconnection attempts reached');
      return;
    }

    this.reconnectAttempts++;
    const delay = this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1);

    setTimeout(() => {
      this.connect();
    }, delay);
  }

  disconnect() {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    this.reconnectAttempts = this.maxReconnectAttempts; // Prevent auto-reconnect
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

  send(message: { type: string; payload: unknown }) {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(message));
    } else {
      console.warn('WebSocket not connected');
    }
  }

  get isConnected() {
    return this.ws?.readyState === WebSocket.OPEN;
  }
}

// Export singleton instance
export const wsClient = new RadiantWebSocketClient();

// Export types
export type { ModelWarmupPayload, NotificationPayload };
