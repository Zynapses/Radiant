import type { Metadata } from 'next';
import { ExperimentsClient } from './experiments-client';
import { PageErrorBoundary } from '@/components/common/error-boundaries';

export const metadata: Metadata = {
  title: 'A/B Experiments',
  description: 'Manage feature experiments',
};

export default function ExperimentsPage() {
  return (
    <PageErrorBoundary>
      <ExperimentsClient />
    </PageErrorBoundary>
  );
}
