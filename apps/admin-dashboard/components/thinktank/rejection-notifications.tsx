'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  AlertTriangle,
  CheckCircle,
  X,
  Bell,
  RefreshCw,
  ChevronRight,
  ExternalLink,
  MessageSquare,
  Shield,
  Zap,
  Clock,
  AlertCircle,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

// Types
interface RejectionNotification {
  id: string;
  title: string;
  message: string;
  detailedReason?: string;
  suggestedActions: SuggestedAction[];
  isRead: boolean;
  rejectionType: string;
  modelId?: string;
  finalStatus: string;
  createdAt: string;
}

interface SuggestedAction {
  action: string;
  description: string;
  actionUrl?: string;
}

interface RejectionDisplayData {
  hasRejections: boolean;
  rejections: RejectionNotification[];
  unreadCount: number;
}

// Constants
const REJECTION_TYPE_ICONS: Record<string, React.ElementType> = {
  content_policy: Shield,
  safety_filter: AlertTriangle,
  provider_ethics: MessageSquare,
  capability_mismatch: Zap,
  context_length: AlertCircle,
  moderation: Shield,
  rate_limit: Clock,
  unknown: AlertCircle,
};

const REJECTION_TYPE_COLORS: Record<string, string> = {
  content_policy: 'bg-red-100 text-red-700',
  safety_filter: 'bg-orange-100 text-orange-700',
  provider_ethics: 'bg-purple-100 text-purple-700',
  capability_mismatch: 'bg-blue-100 text-blue-700',
  context_length: 'bg-yellow-100 text-yellow-700',
  moderation: 'bg-red-100 text-red-700',
  rate_limit: 'bg-gray-100 text-gray-700',
  unknown: 'bg-gray-100 text-gray-700',
};

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  pending: { label: 'Processing', color: 'bg-yellow-100 text-yellow-700' },
  fallback_success: { label: 'Resolved', color: 'bg-green-100 text-green-700' },
  rejected: { label: 'Rejected', color: 'bg-red-100 text-red-700' },
  user_modified: { label: 'Modified', color: 'bg-blue-100 text-blue-700' },
  admin_override: { label: 'Approved', color: 'bg-purple-100 text-purple-700' },
};

// Sample data
const sampleRejections: RejectionNotification[] = [
  {
    id: '1',
    title: 'Request Could Not Be Completed',
    message: 'The ethical guidelines of available AI providers prevented this response. We attempted 3 different AI models.',
    detailedReason: 'Multiple providers declined due to content policy restrictions.',
    suggestedActions: [
      { action: 'rephrase', description: 'Try rephrasing your request in a different way' },
      { action: 'contact_admin', description: 'Contact your administrator if you believe this was blocked in error' },
    ],
    isRead: false,
    rejectionType: 'provider_ethics',
    modelId: 'gpt-4',
    finalStatus: 'rejected',
    createdAt: new Date(Date.now() - 1000 * 60 * 30).toISOString(),
  },
  {
    id: '2',
    title: 'Resolved with Alternative Model',
    message: 'Your request was initially declined but was successfully processed by an alternative AI model.',
    suggestedActions: [],
    isRead: true,
    rejectionType: 'content_policy',
    modelId: 'claude-3-opus',
    finalStatus: 'fallback_success',
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 2).toISOString(),
  },
];

export function RejectionNotifications() {
  const [isOpen, setIsOpen] = useState(false);
  const queryClient = useQueryClient();

  const { data: rejectionData = { hasRejections: true, rejections: sampleRejections, unreadCount: 1 } } = useQuery<RejectionDisplayData>({
    queryKey: ['rejection-notifications'],
    queryFn: async () => {
      // In production: const res = await fetch('/api/thinktank/rejections');
      return { hasRejections: true, rejections: sampleRejections, unreadCount: 1 };
    },
  });

  const markReadMutation = useMutation({
    mutationFn: async (notificationId: string) => {
      // In production: await fetch(`/api/thinktank/rejections/${notificationId}/read`, { method: 'PATCH' });
      console.log('Marking as read:', notificationId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['rejection-notifications'] });
    },
  });

  const dismissMutation = useMutation({
    mutationFn: async (notificationId: string) => {
      // In production: await fetch(`/api/thinktank/rejections/${notificationId}/dismiss`, { method: 'DELETE' });
      console.log('Dismissing:', notificationId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['rejection-notifications'] });
    },
  });

  const unreadCount = rejectionData.unreadCount;

  return (
    <TooltipProvider>
      <Sheet open={isOpen} onOpenChange={setIsOpen}>
        <Tooltip>
          <TooltipTrigger asChild>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" className="relative">
                <Bell className="h-5 w-5" />
                {unreadCount > 0 && (
                  <span className="absolute -top-1 -right-1 h-5 w-5 rounded-full bg-red-500 text-white text-xs flex items-center justify-center">
                    {unreadCount}
                  </span>
                )}
              </Button>
            </SheetTrigger>
          </TooltipTrigger>
          <TooltipContent>
            {unreadCount > 0 ? `${unreadCount} unread notifications` : 'No new notifications'}
          </TooltipContent>
        </Tooltip>

        <SheetContent className="w-[400px] sm:w-[540px]">
          <SheetHeader>
            <SheetTitle className="flex items-center gap-2">
              <Bell className="h-5 w-5" />
              Request Notifications
            </SheetTitle>
            <SheetDescription>
              View rejected or modified requests and their resolutions
            </SheetDescription>
          </SheetHeader>

          <div className="mt-6 space-y-4">
            {rejectionData.rejections.length === 0 ? (
              <div className="text-center py-12 text-gray-500">
                <CheckCircle className="h-12 w-12 mx-auto mb-3 text-green-500" />
                <p>No notifications</p>
                <p className="text-sm">All your requests have been processed successfully</p>
              </div>
            ) : (
              rejectionData.rejections.map((notification) => {
                const TypeIcon = REJECTION_TYPE_ICONS[notification.rejectionType] || AlertCircle;
                const typeColor = REJECTION_TYPE_COLORS[notification.rejectionType] || 'bg-gray-100 text-gray-700';
                const statusInfo = STATUS_LABELS[notification.finalStatus] || STATUS_LABELS.unknown;
                const isResolved = notification.finalStatus === 'fallback_success' || notification.finalStatus === 'user_modified';

                return (
                  <Card
                    key={notification.id}
                    className={`${!notification.isRead ? 'border-l-4 border-l-blue-500' : ''}`}
                  >
                    <CardHeader className="pb-2">
                      <div className="flex items-start justify-between">
                        <div className="flex items-start gap-3">
                          <div className={`p-2 rounded-lg ${typeColor}`}>
                            <TypeIcon className="h-4 w-4" />
                          </div>
                          <div>
                            <CardTitle className="text-sm font-medium">
                              {notification.title}
                            </CardTitle>
                            <CardDescription className="text-xs">
                              {new Date(notification.createdAt).toLocaleString()}
                            </CardDescription>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge className={statusInfo.color}>
                            {isResolved && <CheckCircle className="h-3 w-3 mr-1" />}
                            {statusInfo.label}
                          </Badge>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6"
                            onClick={() => dismissMutation.mutate(notification.id)}
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent className="pt-0">
                      <p className="text-sm text-gray-600 dark:text-gray-300 mb-3">
                        {notification.message}
                      </p>

                      {notification.detailedReason && (
                        <div className="mb-3 p-2 bg-gray-50 dark:bg-gray-800 rounded text-xs text-gray-500">
                          {notification.detailedReason}
                        </div>
                      )}

                      {notification.suggestedActions.length > 0 && (
                        <div className="space-y-2">
                          <p className="text-xs font-medium text-gray-500">Suggested actions:</p>
                          {notification.suggestedActions.map((action, idx) => (
                            <button
                              key={idx}
                              className="w-full flex items-center justify-between p-2 text-left text-sm bg-blue-50 dark:bg-blue-900/20 rounded hover:bg-blue-100 dark:hover:bg-blue-900/30 transition-colors"
                            >
                              <span>{action.description}</span>
                              <ChevronRight className="h-4 w-4 text-gray-400" />
                            </button>
                          ))}
                        </div>
                      )}

                      {!notification.isRead && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="mt-2 text-xs"
                          onClick={() => markReadMutation.mutate(notification.id)}
                        >
                          Mark as read
                        </Button>
                      )}
                    </CardContent>
                  </Card>
                );
              })
            )}
          </div>
        </SheetContent>
      </Sheet>
    </TooltipProvider>
  );
}

export function RejectionBanner({ rejection }: { rejection: RejectionNotification }) {
  const TypeIcon = REJECTION_TYPE_ICONS[rejection.rejectionType] || AlertCircle;
  const isResolved = rejection.finalStatus === 'fallback_success';

  if (isResolved) {
    return (
      <div className="flex items-center gap-3 p-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg mb-4">
        <RefreshCw className="h-5 w-5 text-amber-600" />
        <div className="flex-1">
          <p className="text-sm font-medium text-amber-800 dark:text-amber-200">
            Alternative model used
          </p>
          <p className="text-xs text-amber-600 dark:text-amber-300">
            Your request was processed by a different AI model after the original was unavailable.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-start gap-3 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg mb-4">
      <TypeIcon className="h-5 w-5 text-red-600 mt-0.5" />
      <div className="flex-1">
        <p className="text-sm font-medium text-red-800 dark:text-red-200">
          {rejection.title}
        </p>
        <p className="text-sm text-red-600 dark:text-red-300 mt-1">
          {rejection.message}
        </p>
        {rejection.suggestedActions.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-2">
            {rejection.suggestedActions.map((action, idx) => (
              <Button key={idx} variant="outline" size="sm" className="text-xs">
                {action.description}
              </Button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
