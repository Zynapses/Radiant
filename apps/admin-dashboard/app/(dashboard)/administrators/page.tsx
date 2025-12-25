import type { Metadata } from 'next';
import { AdministratorsClient } from './administrators-client';
import { PageErrorBoundary } from '@/components/common/error-boundaries';

export const metadata: Metadata = {
  title: 'Administrators',
  description: 'Manage admin users and invitations',
};

export default function AdministratorsPage() {
  return (
    <PageErrorBoundary>
      <AdministratorsClient />
    </PageErrorBoundary>
  );
}
