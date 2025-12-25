import { NextRequest, NextResponse } from 'next/server';

// GET /api/neural-engine/insights - Get cost optimization insights
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status') || 'active';

    // In production, this would query the database
    const insights = [
      {
        id: '1',
        tenantId: 'tenant-1',
        insightType: 'model_switch',
        severity: 'warning',
        title: 'Consider switching from claude-3-opus to claude-3-5-sonnet',
        description: 'User john@example.com could save approximately $45.00/month by switching models.',
        recommendation: 'Switch to claude-3-5-sonnet for 40% cost reduction with 90% quality match.',
        estimatedSavings: 45.0,
        confidence: 0.9,
        affectedUsers: ['john@example.com'],
        affectedModels: ['claude-3-opus'],
        status: 'active',
        createdAt: new Date().toISOString(),
        expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
      },
      {
        id: '2',
        tenantId: 'tenant-1',
        insightType: 'usage_pattern',
        severity: 'info',
        title: 'Off-peak usage detected',
        description: '60% of API calls occur outside business hours when lower-cost models could be used.',
        recommendation: 'Consider implementing time-based model routing.',
        estimatedSavings: 120.0,
        confidence: 0.75,
        affectedUsers: [],
        affectedModels: [],
        status: 'active',
        createdAt: new Date().toISOString(),
        expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
      },
    ].filter(i => i.status === status);

    return NextResponse.json(insights);
  } catch (error) {
    return NextResponse.json({ error: 'Failed to fetch insights' }, { status: 500 });
  }
}

// POST /api/neural-engine/insights - Trigger analysis
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { tenantId } = body;

    // In production, this would trigger the neural engine analysis
    return NextResponse.json({
      message: 'Analysis triggered',
      tenantId,
      estimatedCompletion: new Date(Date.now() + 60000).toISOString(),
    });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to trigger analysis' }, { status: 500 });
  }
}
