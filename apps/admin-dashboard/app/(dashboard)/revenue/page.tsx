import { RevenueClient } from './revenue-client';

export const metadata = {
  title: 'Revenue Analytics | RADIANT Admin',
  description: 'Track gross revenue, profits, and export accounting data',
};

export default function RevenuePage() {
  return <RevenueClient />;
}
