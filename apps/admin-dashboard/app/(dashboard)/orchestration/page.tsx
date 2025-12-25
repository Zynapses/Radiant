import type { Metadata } from 'next';
import { OrchestrationClient } from './orchestration-client';
import { PageErrorBoundary } from '@/components/common/error-boundaries';

export const metadata: Metadata = {
  title: 'Orchestration',
  description: 'AI orchestration settings',
};

export default function OrchestrationPage() {
  return (
    <PageErrorBoundary>
      <OrchestrationClient />
    </PageErrorBoundary>
  );
}
