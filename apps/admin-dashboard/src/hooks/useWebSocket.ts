'use client';

import { useEffect, useRef, useState, useCallback } from 'react';

interface UseWebSocketOptions {
  enabled?: boolean;
  reconnectAttempts?: number;
  reconnectInterval?: number;
  heartbeatInterval?: number;
  onMessage?: (message: unknown) => void;
  onOpen?: () => void;
  onClose?: () => void;
  onError?: (error: Event) => void;
}

interface UseWebSocketReturn {
  isConnected: boolean;
  lastMessage: unknown;
  sendMessage: (data: unknown) => void;
  reconnect: () => void;
}

export function useWebSocket(
  tenantId: string | undefined,
  userId: string | undefined,
  options: UseWebSocketOptions = {}
): UseWebSocketReturn {
  const {
    enabled = true,
    reconnectAttempts = 5,
    reconnectInterval = 3000,
    heartbeatInterval = 30000,
    onMessage,
    onOpen,
    onClose,
    onError,
  } = options;

  const wsRef = useRef<WebSocket | null>(null);
  const heartbeatRef = useRef<NodeJS.Timeout | null>(null);
  const reconnectCountRef = useRef(0);

  const [isConnected, setIsConnected] = useState(false);
  const [lastMessage, setLastMessage] = useState<unknown>(null);

  const getWebSocketUrl = useCallback(() => {
    const baseUrl = process.env.NEXT_PUBLIC_WS_URL || 'wss://ws.radiant.io';
    return `${baseUrl}?tenantId=${tenantId}&userId=${userId}`;
  }, [tenantId, userId]);

  const connect = useCallback(() => {
    if (!enabled || !tenantId) return;

    try {
      const ws = new WebSocket(getWebSocketUrl());

      ws.onopen = () => {
        setIsConnected(true);
        reconnectCountRef.current = 0;
        onOpen?.();

        heartbeatRef.current = setInterval(() => {
          if (ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({ action: 'ping' }));
          }
        }, heartbeatInterval);
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          setLastMessage(data);
          onMessage?.(data);
        } catch (error) {
          console.error('Failed to parse WebSocket message:', error);
        }
      };

      ws.onclose = () => {
        setIsConnected(false);
        onClose?.();

        if (heartbeatRef.current) {
          clearInterval(heartbeatRef.current);
          heartbeatRef.current = null;
        }

        if (reconnectCountRef.current < reconnectAttempts) {
          reconnectCountRef.current++;
          setTimeout(connect, reconnectInterval);
        }
      };

      ws.onerror = (error) => {
        console.error('WebSocket error:', error);
        onError?.(error);
      };

      wsRef.current = ws;
    } catch (error) {
      console.error('Failed to create WebSocket:', error);
    }
  }, [enabled, tenantId, getWebSocketUrl, heartbeatInterval, reconnectAttempts, reconnectInterval, onOpen, onClose, onError, onMessage]);

  const disconnect = useCallback(() => {
    if (heartbeatRef.current) {
      clearInterval(heartbeatRef.current);
      heartbeatRef.current = null;
    }

    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }

    setIsConnected(false);
  }, []);

  const sendMessage = useCallback((data: unknown) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(data));
    }
  }, []);

  const reconnect = useCallback(() => {
    disconnect();
    reconnectCountRef.current = 0;
    connect();
  }, [connect, disconnect]);

  useEffect(() => {
    connect();
    return () => disconnect();
  }, [connect, disconnect]);

  return {
    isConnected,
    lastMessage,
    sendMessage,
    reconnect,
  };
}

export default useWebSocket;
