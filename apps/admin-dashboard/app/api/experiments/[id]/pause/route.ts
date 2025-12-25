import { NextRequest, NextResponse } from 'next/server';

// POST /api/experiments/[id]/pause - Pause an experiment
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    return NextResponse.json({
      success: true,
      experimentId: params.id,
      status: 'paused',
      pausedAt: new Date().toISOString(),
    });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to pause experiment' }, { status: 500 });
  }
}
