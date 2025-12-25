import type { Metadata } from 'next';
import { StorageClient } from './storage-client';
import { PageErrorBoundary } from '@/components/common/error-boundaries';

export const metadata: Metadata = {
  title: 'Storage',
  description: 'Manage storage quotas',
};

export default function StoragePage() {
  return (
    <PageErrorBoundary>
      <StorageClient />
    </PageErrorBoundary>
  );
}
