import { NextResponse } from 'next/server';
import { withAuth, apiError, type AuthenticatedRequest } from '@/lib/api/auth-wrapper';

// GET /api/security/metrics - Get security metrics
export const GET = withAuth(async (request: AuthenticatedRequest) => {
  try {
    const { searchParams } = new URL(request.url);
    const product = searchParams.get('product') || 'combined';
    const range = searchParams.get('range') || '24h';

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
