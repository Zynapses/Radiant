import type { Metadata } from 'next';
import { ComplianceClient } from './compliance-client';
import { PageErrorBoundary } from '@/components/common/error-boundaries';

export const metadata: Metadata = {
  title: 'Compliance',
  description: 'Monitor compliance status',
};

export default function CompliancePage() {
  return (
    <PageErrorBoundary>
      <ComplianceClient />
    </PageErrorBoundary>
  );
}
