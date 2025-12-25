import { NextResponse } from 'next/server';
import { withAuth, apiError } from '@/lib/api/auth-wrapper';

// GET /api/admin/multi-region/deployment/current - Get current deployment status
export const GET = withAuth(async () => {
  try {
    const currentDeployment = null;
    return NextResponse.json(currentDeployment);
  } catch (error) {
    return apiError('FETCH_FAILED', 'Failed to get deployment status', 500);
  }
});
