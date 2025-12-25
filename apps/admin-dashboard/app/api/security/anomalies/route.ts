import { NextResponse } from 'next/server';
import { withAuth, apiError, type AuthenticatedRequest } from '@/lib/api/auth-wrapper';

// GET /api/security/anomalies - Get security anomalies
export const GET = withAuth(async (request: AuthenticatedRequest) => {
  try {
    const { searchParams } = new URL(request.url);
    const product = searchParams.get('product') || 'combined';

    const anomalies = [
      {
        id: '1',
        tenantId: 'tenant-1',
        anomalyType: 'geographic',
        severity: 'high',
        userId: 'user-123',
        ipAddress: '203.0.113.50',
        details: {
          previousLocation: 'New York, US',
          currentLocation: 'Tokyo, JP',
          timeDifferenceSeconds: 1800,
        },
        isResolved: false,
        detectedAt: new Date().toISOString(),
      },
      {
        id: '2',
        tenantId: 'tenant-1',
        anomalyType: 'brute_force',
        severity: 'critical',
        ipAddress: '198.51.100.42',
        details: {
          failedAttempts: 47,
          attemptedEmails: ['admin@example.com', 'root@example.com'],
        },
        isResolved: false,
        detectedAt: new Date(Date.now() - 3600000).toISOString(),
      },
    ];

    return NextResponse.json(anomalies);
  } catch (error) {
    return apiError('FETCH_FAILED', 'Failed to fetch anomalies', 500);
  }
});
