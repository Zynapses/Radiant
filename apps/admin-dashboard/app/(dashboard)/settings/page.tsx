import type { Metadata } from 'next';
import { SettingsClient } from './settings-client';
import { PageErrorBoundary } from '@/components/common/error-boundaries';

export const metadata: Metadata = {
  title: 'Settings',
  description: 'Manage account preferences',
};

export default function SettingsPage() {
  return (
    <PageErrorBoundary>
      <SettingsClient />
    </PageErrorBoundary>
  );
}
