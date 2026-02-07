import type { Metadata } from 'next';
import { SnapshotsClient } from './snapshots-client';
import { PageErrorBoundary } from '@/components/common/error-boundaries';

export const metadata: Metadata = {
  title: 'AWS Snapshots',
  description: 'Manage automated AWS infrastructure snapshots for disaster recovery',
};

export default function SnapshotsPage() {
  return (
    <PageErrorBoundary>
      <SnapshotsClient />
    </PageErrorBoundary>
  );
}
