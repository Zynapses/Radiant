import type { Metadata } from 'next';
import { ConfigurationClient } from './configuration-client';
import { PageErrorBoundary } from '@/components/common/error-boundaries';

export const metadata: Metadata = {
  title: 'Configuration',
  description: 'Manage system configuration',
};

export default function ConfigurationPage() {
  return (
    <PageErrorBoundary>
      <ConfigurationClient />
    </PageErrorBoundary>
  );
}
