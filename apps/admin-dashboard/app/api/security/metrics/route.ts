import { NextResponse } from 'next/server';
import { withAuth, apiError, type AuthenticatedRequest } from '@/lib/api/auth-wrapper';

// GET /api/security/metrics - Get security metrics
export const GET = withAuth(async (request: AuthenticatedRequest) => {
  try {
    const { searchParams } = new URL(request.url);
    const _product = searchParams.get('product') || 'combined';
    void _product; // Reserved for product filtering
    const _range = searchParams.get('range') || '24h';
    void _range; // Reserved for range filtering

    const metrics = {
      totalAnomalies24h: 12,
      criticalCount: 2,
      highCount: 5,
      blockedIps: 23,
      suspiciousLogins: 8,
      activeThreats: 3,
    };

    return NextResponse.json(metrics);
  } catch (error) {
    return apiError('FETCH_FAILED', 'Failed to fetch metrics', 500);
  }
});
