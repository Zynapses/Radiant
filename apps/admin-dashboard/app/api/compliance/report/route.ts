import { NextResponse } from 'next/server';
import { withAuth, apiError, type AuthenticatedRequest } from '@/lib/api/auth-wrapper';

// GET /api/compliance/report - Get compliance report for a framework
export const GET = withAuth(async (request: AuthenticatedRequest) => {
  try {
    const { searchParams } = new URL(request.url);
    const framework = searchParams.get('framework') || 'soc2';

    const report = {
      id: crypto.randomUUID(),
      tenantId: 'tenant-1',
      reportType: framework,
      status: framework === 'hipaa' ? 'partial' : 'compliant',
      score: framework === 'hipaa' ? 88 : 94,
      findings: [
        {
          id: '1',
          severity: 'medium',
          category: 'Access Control',
          description: 'Some users have not enabled MFA',
          recommendation: 'Enforce MFA for all admin users',
          status: 'open',
        },
        {
          id: '2',
          severity: 'low',
          category: 'Data Protection',
          description: 'Encryption key rotation pending',
          recommendation: 'Schedule key rotation within 30 days',
          status: 'in_progress',
        },
      ],
      generatedAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString(),
    };

    return NextResponse.json(report);
  } catch (error) {
    return apiError('FETCH_FAILED', 'Failed to fetch report', 500);
  }
});
