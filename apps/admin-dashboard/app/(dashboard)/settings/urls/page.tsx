import { Metadata } from 'next';
import URLConfigurationClient from './url-configuration-client';
import { PageErrorBoundary } from '@/components/common/error-boundaries';

export const metadata: Metadata = {
  title: 'URL Configuration | RADIANT Admin',
  description: 'Configure platform URLs including Status Page, Think Tank, Admin Dashboard, and API endpoints',
};

export default function URLConfigurationPage() {
  return (
    <PageErrorBoundary>
      <URLConfigurationClient />
    </PageErrorBoundary>
  );
}
