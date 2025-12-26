import type { Metadata } from 'next';
import { SystemConfigClient } from './system-config-client';
import { PageErrorBoundary } from '@/components/common/error-boundaries';

export const metadata: Metadata = {
  title: 'System Configuration',
  description: 'Manage runtime system configuration',
};

export default function SystemConfigPage() {
  return (
    <PageErrorBoundary>
      <SystemConfigClient />
    </PageErrorBoundary>
  );
}
