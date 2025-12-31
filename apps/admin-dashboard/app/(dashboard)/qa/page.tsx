import type { Metadata } from 'next';
import { QAClient } from './qa-client';
import { PageErrorBoundary } from '@/components/common/error-boundaries';

export const metadata: Metadata = {
  title: 'QA & Testing',
  description: 'Manage automated tests, view results, and monitor test coverage',
};

export default function QAPage() {
  return (
    <PageErrorBoundary>
      <QAClient />
    </PageErrorBoundary>
  );
}
