import type { Metadata } from 'next';
import { BillingClient } from './billing-client';
import { PageErrorBoundary } from '@/components/common/error-boundaries';

export const metadata: Metadata = {
  title: 'Billing & Credits',
  description: 'Manage subscriptions and billing',
};

export default function BillingPage() {
  return (
    <PageErrorBoundary>
      <BillingClient />
    </PageErrorBoundary>
  );
}
