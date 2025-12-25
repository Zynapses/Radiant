import type { Metadata } from 'next';
import { SecurityDashboardClient } from './security-client';
import { PageErrorBoundary } from '@/components/common/error-boundaries';

export const metadata: Metadata = {
  title: 'Security',
  description: 'Security monitoring and settings',
};

export default function SecurityPage() {
  return (
    <PageErrorBoundary>
      <SecurityDashboardClient />
    </PageErrorBoundary>
  );
}
