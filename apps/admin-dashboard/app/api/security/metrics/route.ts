import { NextRequest, NextResponse } from 'next/server';

// GET /api/security/metrics - Get security metrics
export async function GET(request: NextRequest) {
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
    return NextResponse.json({ error: 'Failed to fetch metrics' }, { status: 500 });
  }
}
