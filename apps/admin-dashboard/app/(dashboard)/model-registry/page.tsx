import type { Metadata } from 'next';
import { ModelRegistryClient } from './model-registry-client';
import { PageErrorBoundary } from '@/components/common/error-boundaries';

export const metadata: Metadata = {
  title: 'Model Registry',
  description: 'Manage model versions, discovery, and deletion queue',
};

export default function ModelRegistryPage() {
  return (
    <PageErrorBoundary>
      <ModelRegistryClient />
    </PageErrorBoundary>
  );
}
