import { NextRequest, NextResponse } from 'next/server';

// POST /api/neural-engine/insights/[id]/apply - Apply an insight (requires human approval)
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const body = await request.json();
    const { approvedBy } = body;

    if (!approvedBy) {
      return NextResponse.json(
        { error: 'Human approval required. Provide approvedBy field.' },
        { status: 400 }
      );
    }

    // In production, this would update the database and apply the insight
    return NextResponse.json({
      success: true,
      message: 'Insight applied with human approval',
      insightId: params.id,
      appliedBy: approvedBy,
      appliedAt: new Date().toISOString(),
    });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to apply insight' }, { status: 500 });
  }
}
