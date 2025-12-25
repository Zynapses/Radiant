import type { Metadata } from 'next';
import { GeographicClient } from './geographic-client';
import { PageErrorBoundary } from '@/components/common/error-boundaries';

export const metadata: Metadata = {
  title: 'Geographic',
  description: 'View geographic distribution',
};

export default function GeographicPage() {
  return (
    <PageErrorBoundary>
      <GeographicClient />
    </PageErrorBoundary>
  );
}
