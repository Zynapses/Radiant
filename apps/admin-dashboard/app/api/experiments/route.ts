import { NextResponse } from 'next/server';
import { withAuth, apiError, type AuthenticatedRequest } from '@/lib/api/auth-wrapper';
import { experimentsApi } from '@/lib/api/endpoints';

// GET /api/experiments - Get all experiments
export const GET = withAuth(async (request: AuthenticatedRequest) => {
  try {
    const { searchParams } = new URL(request.url);
    const product = searchParams.get('product') || undefined;
    const status = searchParams.get('status') || undefined;

    const experiments = await experimentsApi.list({ 
      product, 
      status: status === 'all' ? undefined : status 
    });

    return NextResponse.json(experiments);
  } catch (error) {
    console.error('Failed to fetch experiments:', error);
    return apiError('FETCH_FAILED', 'Failed to fetch experiments', 500);
  }
});

// POST /api/experiments - Create new experiment
export const POST = withAuth(async (request: AuthenticatedRequest) => {
  try {
    const body = await request.json();

    const experiment = await experimentsApi.create({
      ...body,
      tenantId: request.user.tenantId,
    });

    return NextResponse.json(experiment, { status: 201 });
  } catch (error) {
    console.error('Failed to create experiment:', error);
    return apiError('CREATE_FAILED', 'Failed to create experiment', 500);
  }
});
