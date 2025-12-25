import type { Metadata } from 'next';
import { LocalizationClient } from './localization-client';
import { PageErrorBoundary } from '@/components/common/error-boundaries';

export const metadata: Metadata = {
  title: 'Localization',
  description: 'Manage translations',
};

export default function LocalizationPage() {
  return (
    <PageErrorBoundary>
      <LocalizationClient />
    </PageErrorBoundary>
  );
}
