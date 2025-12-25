import { NextRequest, NextResponse } from 'next/server';

// POST /api/neural-engine/insights/[id]/dismiss - Dismiss an insight
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const body = await request.json();
    const { reason, dismissedBy } = body;

    // In production, this would update the database
    return NextResponse.json({
      success: true,
      insightId: params.id,
      dismissedBy: dismissedBy || 'anonymous',
      dismissedAt: new Date().toISOString(),
      reason: reason || 'No reason provided',
    });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to dismiss insight' }, { status: 500 });
  }
}
