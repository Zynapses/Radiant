import type { Metadata } from 'next';
import { ProvidersClient } from './providers-client';
import { PageErrorBoundary } from '@/components/common/error-boundaries';

export const metadata: Metadata = {
  title: 'Providers',
  description: 'Manage AI providers',
};

export default function ProvidersPage() {
  return (
    <PageErrorBoundary>
      <ProvidersClient />
    </PageErrorBoundary>
  );
}
