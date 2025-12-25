import type { Metadata } from 'next';
import { CostClient } from './cost-client';
import { PageErrorBoundary } from '@/components/common/error-boundaries';

export const metadata: Metadata = {
  title: 'Cost Management',
  description: 'Track and optimize costs',
};

export default function CostPage() {
  return (
    <PageErrorBoundary>
      <CostClient />
    </PageErrorBoundary>
  );
}
