import type { Metadata } from 'next';
import { NotificationsClient } from './notifications-client';
import { PageErrorBoundary } from '@/components/common/error-boundaries';

export const metadata: Metadata = {
  title: 'Notifications',
  description: 'Manage system notifications',
};

export default function NotificationsPage() {
  return (
    <PageErrorBoundary>
      <NotificationsClient />
    </PageErrorBoundary>
  );
}
