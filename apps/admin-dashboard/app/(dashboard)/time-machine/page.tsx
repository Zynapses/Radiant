import type { Metadata } from 'next';
import { TimeMachineClient } from './time-machine-client';
import { PageErrorBoundary } from '@/components/common/error-boundaries';

export const metadata: Metadata = {
  title: 'Time Machine',
  description: 'Version history and rollback',
};

export default function TimeMachinePage() {
  return (
    <PageErrorBoundary>
      <TimeMachineClient />
    </PageErrorBoundary>
  );
}
