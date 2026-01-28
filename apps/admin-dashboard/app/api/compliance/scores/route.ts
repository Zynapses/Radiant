import { NextResponse } from 'next/server';
import { withAuth, apiError, type AuthenticatedRequest } from '@/lib/api/auth-wrapper';

// GET /api/compliance/scores - Get compliance scores for all frameworks
export const GET = withAuth(async (request: AuthenticatedRequest) => {
  try {
    const { searchParams } = new URL(request.url);
    const _product = searchParams.get('product') || 'combined';
    void _product; // Reserved for product filtering

    const scores = [
      {
        framework: 'soc2',
        score: 94,
        status: 'compliant',
        lastAssessment: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
        nextAssessment: new Date(Date.now() + 83 * 24 * 60 * 60 * 1000).toISOString(),
        openFindings: 2,
      },
      {
        framework: 'hipaa',
        score: 88,
        status: 'partial',
        lastAssessment: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString(),
        nextAssessment: new Date(Date.now() + 76 * 24 * 60 * 60 * 1000).toISOString(),
        openFindings: 5,
      },
      {
        framework: 'gdpr',
        score: 96,
        status: 'compliant',
        lastAssessment: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
        nextAssessment: new Date(Date.now() + 87 * 24 * 60 * 60 * 1000).toISOString(),
        openFindings: 1,
      },
      {
        framework: 'iso27001',
        score: 91,
        status: 'compliant',
        lastAssessment: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString(),
        nextAssessment: new Date(Date.now() + 80 * 24 * 60 * 60 * 1000).toISOString(),
        openFindings: 3,
      },
    ];

    return NextResponse.json(scores);
  } catch (error) {
    return apiError('FETCH_FAILED', 'Failed to fetch scores', 500);
  }
});
