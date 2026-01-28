import { NextResponse } from 'next/server';
import { withAuth, apiError, type AuthenticatedRequest } from '@/lib/api/auth-wrapper';

// GET /api/security/failed-logins - Get failed login attempts
export const GET = withAuth(async (request: AuthenticatedRequest) => {
  try {
    const { searchParams } = new URL(request.url);
    const _product = searchParams.get('product') || 'combined';
    void _product; // Reserved for product filtering

    const failedLogins = [
      {
        id: '1',
        userId: 'unknown',
        ipAddress: '198.51.100.42',
        attemptCount: 47,
        lastAttempt: new Date().toISOString(),
        isBlocked: true,
      },
      {
        id: '2',
        userId: 'john@example.com',
        ipAddress: '203.0.113.100',
        attemptCount: 5,
        lastAttempt: new Date(Date.now() - 1800000).toISOString(),
        isBlocked: false,
      },
    ];

    return NextResponse.json(failedLogins);
  } catch (error) {
    return apiError('FETCH_FAILED', 'Failed to fetch failed logins', 500);
  }
});
