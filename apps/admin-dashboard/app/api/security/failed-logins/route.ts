import { NextRequest, NextResponse } from 'next/server';

// GET /api/security/failed-logins - Get failed login attempts
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const product = searchParams.get('product') || 'combined';

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
    return NextResponse.json({ error: 'Failed to fetch failed logins' }, { status: 500 });
  }
}
