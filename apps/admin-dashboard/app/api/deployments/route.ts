import { NextResponse } from 'next/server';
import { withAuth, apiError, type AuthenticatedRequest } from '@/lib/api/auth-wrapper';
import { deploymentsApi } from '@/lib/api/endpoints';

// GET /api/deployments - Get deployment history
export const GET = withAuth(async (request: AuthenticatedRequest) => {
  try {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status') || undefined;
    const environment = searchParams.get('environment') || undefined;

    const deployments = await deploymentsApi.list({ status, environment });

    return NextResponse.json(deployments);
  } catch (error) {
    console.error('Failed to fetch deployments:', error);
    return apiError('FETCH_FAILED', 'Failed to fetch deployments', 500);
  }
});

// POST /api/deployments - Create new deployment
export const POST = withAuth(async (request: AuthenticatedRequest) => {
  try {
    const body = await request.json();
    const { version, environment } = body;

    if (!version || !environment) {
      return apiError('VALIDATION_ERROR', 'Version and environment are required', 400);
    }

    const deployment = await deploymentsApi.create({ version, environment });

    return NextResponse.json(deployment, { status: 201 });
  } catch (error) {
    console.error('Failed to create deployment:', error);
    return apiError('CREATE_FAILED', 'Failed to create deployment', 500);
  }
});
