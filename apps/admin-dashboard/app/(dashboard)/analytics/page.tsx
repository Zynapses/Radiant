import type { Metadata } from 'next';
import { AnalyticsClient } from './analytics-client';
import { PageErrorBoundary } from '@/components/common/error-boundaries';

export const metadata: Metadata = {
  title: 'Analytics',
  description: 'View platform analytics and metrics',
};

export default function AnalyticsPage() {
  return (
    <PageErrorBoundary>
      <AnalyticsClient />
    </PageErrorBoundary>
  );
}
