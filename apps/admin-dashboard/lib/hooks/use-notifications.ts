'use client';

import {
  useQuery,
  useMutation,
  useQueryClient,
} from '@tanstack/react-query';
import { notificationsApi } from '@/lib/api/endpoints';
import type { NotificationPreferences } from '@/lib/api/types';

// Query keys
export const notificationKeys = {
  all: ['notifications'] as const,
  list: (unreadOnly?: boolean) => [...notificationKeys.all, 'list', unreadOnly] as const,
  preferences: () => [...notificationKeys.all, 'preferences'] as const,
};

/**
 * Hook to fetch notifications
 */
export function useNotifications(unreadOnly = false) {
  return useQuery({
    queryKey: notificationKeys.list(unreadOnly),
    queryFn: () => notificationsApi.list(unreadOnly),
    refetchInterval: 30000, // Refresh every 30 seconds
  });
}

/**
 * Hook to get unread notification count
 */
export function useUnreadNotificationCount() {
  const { data: notifications } = useNotifications(true);
  return notifications?.length ?? 0;
}

/**
 * Hook to mark notification as read
 */
export function useMarkNotificationRead() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => notificationsApi.markRead(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: notificationKeys.all });
    },
  });
}

/**
 * Hook to mark all notifications as read
 */
export function useMarkAllNotificationsRead() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => notificationsApi.markAllRead(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: notificationKeys.all });
    },
  });
}

/**
 * Hook to fetch notification preferences
 */
export function useNotificationPreferences() {
  return useQuery({
    queryKey: notificationKeys.preferences(),
    queryFn: () => notificationsApi.getPreferences(),
  });
}

/**
 * Hook to update notification preferences
 */
export function useUpdateNotificationPreferences() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (prefs: Partial<NotificationPreferences>) =>
      notificationsApi.updatePreferences(prefs),
    onSuccess: (updatedPrefs) => {
      queryClient.setQueryData(notificationKeys.preferences(), updatedPrefs);
    },
  });
}
