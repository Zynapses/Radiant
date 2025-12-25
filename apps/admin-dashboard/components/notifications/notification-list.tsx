'use client';

import Link from 'next/link';
import { formatDistanceToNow } from 'date-fns';
import { AlertCircle, CheckCircle, Info, AlertTriangle, Bell, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import {
  useNotifications,
  useMarkNotificationRead,
  useMarkAllNotificationsRead,
} from '@/lib/hooks/use-notifications';
import type { Notification } from '@/lib/api/types';

const iconMap = {
  info: Info,
  warning: AlertTriangle,
  error: AlertCircle,
  success: CheckCircle,
};

const colorMap = {
  info: 'text-blue-500',
  warning: 'text-amber-500',
  error: 'text-red-500',
  success: 'text-green-500',
};

export function NotificationList() {
  const { data: notifications, isLoading } = useNotifications();
  const markRead = useMarkNotificationRead();
  const markAllRead = useMarkAllNotificationsRead();

  if (isLoading) {
    return (
      <div className="p-4">
        <div className="space-y-3">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="flex gap-3">
              <div className="h-8 w-8 animate-pulse rounded-full bg-muted" />
              <div className="flex-1 space-y-2">
                <div className="h-4 w-3/4 animate-pulse rounded bg-muted" />
                <div className="h-3 w-1/2 animate-pulse rounded bg-muted" />
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (!notifications || notifications.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center p-8 text-center">
        <Bell className="mb-2 h-8 w-8 text-muted-foreground" />
        <p className="text-sm font-medium">No notifications</p>
        <p className="text-xs text-muted-foreground">
          You&apos;re all caught up!
        </p>
      </div>
    );
  }

  const unreadCount = notifications.filter((n) => !n.isRead).length;

  return (
    <div>
      <div className="flex items-center justify-between border-b p-3">
        <h4 className="font-semibold">Notifications</h4>
        {unreadCount > 0 && (
          <Button
            variant="ghost"
            size="sm"
            className="h-auto px-2 py-1 text-xs"
            onClick={() => markAllRead.mutate()}
            disabled={markAllRead.isPending}
          >
            <Check className="mr-1 h-3 w-3" />
            Mark all read
          </Button>
        )}
      </div>

      <ScrollArea className="h-[300px]">
        <div className="divide-y">
          {notifications.map((notification) => (
            <NotificationItem
              key={notification.id}
              notification={notification}
              onMarkRead={() => markRead.mutate(notification.id)}
            />
          ))}
        </div>
      </ScrollArea>

      <div className="border-t p-2">
        <Button variant="ghost" size="sm" className="w-full" asChild>
          <Link href="/notifications">View all notifications</Link>
        </Button>
      </div>
    </div>
  );
}

function NotificationItem({
  notification,
  onMarkRead,
}: {
  notification: Notification;
  onMarkRead: () => void;
}) {
  const Icon = iconMap[notification.type];
  const colorClass = colorMap[notification.type];

  const content = (
    <div
      className={cn(
        'flex gap-3 p-3 transition-colors hover:bg-muted/50',
        !notification.isRead && 'bg-muted/30'
      )}
      onClick={() => {
        if (!notification.isRead) {
          onMarkRead();
        }
      }}
    >
      <div
        className={cn(
          'flex h-8 w-8 shrink-0 items-center justify-center rounded-full',
          notification.type === 'info' && 'bg-blue-500/10',
          notification.type === 'warning' && 'bg-amber-500/10',
          notification.type === 'error' && 'bg-red-500/10',
          notification.type === 'success' && 'bg-green-500/10'
        )}
      >
        <Icon className={cn('h-4 w-4', colorClass)} />
      </div>
      <div className="flex-1 space-y-1">
        <div className="flex items-start justify-between gap-2">
          <p className="text-sm font-medium leading-tight">
            {notification.title}
          </p>
          {!notification.isRead && (
            <div className="mt-1 h-2 w-2 shrink-0 rounded-full bg-primary" />
          )}
        </div>
        <p className="line-clamp-2 text-xs text-muted-foreground">
          {notification.message}
        </p>
        <p className="text-xs text-muted-foreground">
          {formatDistanceToNow(new Date(notification.createdAt), {
            addSuffix: true,
          })}
        </p>
      </div>
    </div>
  );

  if (notification.actionUrl) {
    return (
      <Link href={notification.actionUrl} className="block">
        {content}
      </Link>
    );
  }

  return content;
}
