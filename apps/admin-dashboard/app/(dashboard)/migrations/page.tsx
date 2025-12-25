import type { Metadata } from 'next';
import { MigrationsClient } from './migrations-client';
import { PageErrorBoundary } from '@/components/common/error-boundaries';

export const metadata: Metadata = {
  title: 'Migrations',
  description: 'Database migration management',
};

export default function MigrationsPage() {
  return (
    <PageErrorBoundary>
      <MigrationsClient />
    </PageErrorBoundary>
  );
}
