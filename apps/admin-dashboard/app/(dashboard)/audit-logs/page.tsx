import type { Metadata } from 'next';
import { AuditLogsClient } from './audit-logs-client';
import { PageErrorBoundary } from '@/components/common/error-boundaries';

export const metadata: Metadata = {
  title: 'Audit Logs',
  description: 'Track all administrative actions',
};

export default function AuditLogsPage() {
  return (
    <PageErrorBoundary>
      <AuditLogsClient />
    </PageErrorBoundary>
  );
}
