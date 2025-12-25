'use client';

import { useEffect, useState, useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { wsClient, type WebSocketMessage, type ModelWarmupPayload } from './client';
import { useAuth } from '@/lib/auth/context';
import { modelKeys } from '@/lib/hooks/use-models';
import { notificationKeys } from '@/lib/hooks/use-notifications';

/**
 * Hook to manage WebSocket connection lifecycle
 */
export function useWebSocket() {
  const { accessToken, isAuthenticated } = useAuth();
  const [isConnected, setIsConnected] = useState(false);

  useEffect(() => {
    if (!isAuthenticated || !accessToken) {
      wsClient.disconnect();
      setIsConnected(false);
      return;
    }

    wsClient.setAccessToken(accessToken);
    wsClient.connect();

    const unsubConnect = wsClient.onConnect(() => {
      setIsConnected(true);
    });

    const unsubDisconnect = wsClient.onDisconnect(() => {
      setIsConnected(false);
    });

    return () => {
      unsubConnect();
      unsubDisconnect();
    };
  }, [accessToken, isAuthenticated]);

  return { isConnected };
}

/**
 * Hook to subscribe to WebSocket messages
 */
export function useWebSocketMessage(
  onMessage: (message: WebSocketMessage) => void
) {
  useEffect(() => {
    const unsubscribe = wsClient.onMessage(onMessage);
    return () => {
      unsubscribe();
    };
  }, [onMessage]);
}

/**
 * Hook to track model warm-up progress
 */
export function useModelWarmupProgress(modelId: string) {
  const [progress, setProgress] = useState<ModelWarmupPayload | null>(null);
  const queryClient = useQueryClient();

  const handleMessage = useCallback(
    (message: WebSocketMessage) => {
      if (message.type !== 'model_warmup') return;

      const payload = message.payload as ModelWarmupPayload;
      if (payload.modelId !== modelId) return;

      setProgress(payload);

      // Invalidate model query when warmup completes
      if (payload.status === 'complete' || payload.status === 'failed') {
        queryClient.invalidateQueries({ queryKey: modelKeys.detail(modelId) });
        queryClient.invalidateQueries({ queryKey: modelKeys.lists() });
      }
    },
    [modelId, queryClient]
  );

  useWebSocketMessage(handleMessage);

  return progress;
}

/**
 * Hook to receive real-time notifications
 */
export function useRealtimeNotifications() {
  const queryClient = useQueryClient();

  const handleMessage = useCallback(
    (message: WebSocketMessage) => {
      if (message.type === 'notification') {
        // Invalidate notifications query to trigger refetch
        queryClient.invalidateQueries({ queryKey: notificationKeys.all });
      }
    },
    [queryClient]
  );

  useWebSocketMessage(handleMessage);
}

/**
 * Hook to receive real-time approval updates
 */
export function useRealtimeApprovals() {
  const queryClient = useQueryClient();

  const handleMessage = useCallback(
    (message: WebSocketMessage) => {
      if (message.type === 'approval_update') {
        queryClient.invalidateQueries({ queryKey: ['approvals'] });
      }
    },
    [queryClient]
  );

  useWebSocketMessage(handleMessage);
}
