import type { Metadata } from 'next';
import { ModelsClient } from './models-client';
import { PageErrorBoundary } from '@/components/common/error-boundaries';

export const metadata: Metadata = {
  title: 'AI Models',
  description: 'Manage AI model configurations',
};

export default function ModelsPage() {
  return (
    <PageErrorBoundary>
      <ModelsClient />
    </PageErrorBoundary>
  );
}
