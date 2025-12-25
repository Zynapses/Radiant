import type { Metadata } from 'next';
import { DeploymentsClient } from './deployments-client';
import { PageErrorBoundary } from '@/components/common/error-boundaries';

export const metadata: Metadata = {
  title: 'Deployments',
  description: 'Manage infrastructure deployments',
};

export default function DeploymentsPage() {
  return (
    <PageErrorBoundary>
      <DeploymentsClient />
    </PageErrorBoundary>
  );
}
