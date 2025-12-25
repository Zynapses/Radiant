import type { Metadata } from 'next';
import { HealthClient } from './health-client';
import { PageErrorBoundary } from '@/components/common/error-boundaries';

export const metadata: Metadata = {
  title: 'System Health',
  description: 'Monitor service health and performance',
};

export default function HealthPage() {
  return (
    <PageErrorBoundary>
      <HealthClient />
    </PageErrorBoundary>
  );
}
