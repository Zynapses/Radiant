import { NextRequest, NextResponse } from 'next/server';

// POST /api/experiments/[id]/complete - Complete an experiment
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    return NextResponse.json({
      success: true,
      experimentId: params.id,
      status: 'completed',
      completedAt: new Date().toISOString(),
    });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to complete experiment' }, { status: 500 });
  }
}
