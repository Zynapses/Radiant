import { NextRequest, NextResponse } from 'next/server';

// GET /api/compliance/report - Get compliance report for a framework
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const product = searchParams.get('product') || 'combined';
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
    return NextResponse.json({ error: 'Failed to fetch report' }, { status: 500 });
  }
}
