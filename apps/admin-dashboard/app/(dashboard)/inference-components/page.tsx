import type { Metadata } from 'next';
import { InferenceComponentsClient } from './inference-components-client';
import { PageErrorBoundary } from '@/components/common/error-boundaries';

export const metadata: Metadata = {
  title: 'Inference Components',
  description: 'Manage self-hosted model hosting tiers and SageMaker Inference Components',
};

export default function InferenceComponentsPage() {
  return (
    <PageErrorBoundary>
      <InferenceComponentsClient />
    </PageErrorBoundary>
  );
}
