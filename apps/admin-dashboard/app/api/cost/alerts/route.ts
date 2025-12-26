import { NextResponse } from 'next/server';
import { withAuth, apiError, type AuthenticatedRequest } from '@/lib/api/auth-wrapper';
import { costApi } from '@/lib/api/endpoints';

// GET /api/cost/alerts - Get cost alerts
export const GET = withAuth(async () => {
  try {
    const alerts = await costApi.getAlerts();

    return NextResponse.json(alerts);
  } catch (error) {
    console.error('Failed to fetch cost alerts:', error);
    return apiError('FETCH_FAILED', 'Failed to fetch alerts', 500);
  }
});

// POST /api/cost/alerts - Create cost alert
export const POST = withAuth(async (request: AuthenticatedRequest) => {
  try {
    const body = await request.json();

    const alert = await costApi.createAlert({
      ...body,
      tenantId: request.user.tenantId,
    });

    return NextResponse.json(alert, { status: 201 });
  } catch (error) {
    console.error('Failed to create cost alert:', error);
    return apiError('CREATE_FAILED', 'Failed to create alert', 500);
  }
});
