import type { Metadata } from 'next';
import { MultiRegionClient } from './multi-region-client';
import { PageErrorBoundary } from '@/components/common/error-boundaries';

export const metadata: Metadata = {
  title: 'Multi-Region',
  description: 'Manage multi-region deployment',
};

export default function MultiRegionPage() {
  return (
    <PageErrorBoundary>
      <MultiRegionClient />
    </PageErrorBoundary>
  );
}
