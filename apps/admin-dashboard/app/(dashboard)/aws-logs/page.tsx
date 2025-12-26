import type { Metadata } from 'next';
import { AWSLogsClient } from './aws-logs-client';
import { PageErrorBoundary } from '@/components/common/error-boundaries';

export const metadata: Metadata = {
  title: 'AWS Logs',
  description: 'View and manage CloudWatch logs',
};

export default function AWSLogsPage() {
  return (
    <PageErrorBoundary>
      <AWSLogsClient />
    </PageErrorBoundary>
  );
}
