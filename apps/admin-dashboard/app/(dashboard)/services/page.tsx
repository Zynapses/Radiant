import type { Metadata } from 'next';
import { ServicesClient } from './services-client';
import { PageErrorBoundary } from '@/components/common/error-boundaries';

export const metadata: Metadata = {
  title: 'Services',
  description: 'Manage platform services',
};

export default function ServicesPage() {
  return (
    <PageErrorBoundary>
      <ServicesClient />
    </PageErrorBoundary>
  );
}
