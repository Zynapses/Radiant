import { SaaSMetricsClient } from './saas-metrics-client';

export const metadata = {
  title: 'SaaS Metrics | RADIANT Admin',
  description: 'Comprehensive SaaS metrics, revenue, costs, and exportable reports',
};

export default function SaaSMetricsPage() {
  return <SaaSMetricsClient />;
}
