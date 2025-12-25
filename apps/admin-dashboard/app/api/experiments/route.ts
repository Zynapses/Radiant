import { NextRequest, NextResponse } from 'next/server';

// GET /api/experiments - Get all experiments
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const product = searchParams.get('product') || 'combined';
    const status = searchParams.get('status') || 'all';

    const experiments = [
      {
        id: '1',
        tenantId: 'tenant-1',
        name: 'Model Response Quality Test',
        description: 'Testing GPT-4o-mini vs Claude Haiku for simple queries',
        hypothesis: 'GPT-4o-mini will provide comparable quality at 60% lower cost',
        variants: [
          { id: 'control', name: 'Claude Haiku', weight: 0.5, sampleSize: 1250 },
          { id: 'treatment', name: 'GPT-4o-mini', weight: 0.5, sampleSize: 1248 },
        ],
        targetAudience: { percentage: 20 },
        metrics: ['response_quality', 'latency', 'cost'],
        status: 'running',
        startedAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
        endedAt: null,
        createdAt: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString(),
        results: {
          isSignificant: false,
          pValue: 0.0823,
          confidenceLevel: 0.92,
          controlMean: 4.2,
          treatmentMean: 4.1,
          uplift: -2.4,
          recommendation: 'Continue collecting data',
        },
      },
      {
        id: '2',
        tenantId: 'tenant-1',
        name: 'Chat UI Optimization',
        description: 'Testing new streaming response UI',
        hypothesis: 'New UI will improve user engagement by 15%',
        variants: [
          { id: 'control', name: 'Current UI', weight: 0.5, sampleSize: 3420 },
          { id: 'treatment', name: 'New Streaming UI', weight: 0.5, sampleSize: 3415 },
        ],
        targetAudience: { percentage: 50 },
        metrics: ['engagement', 'session_length', 'satisfaction'],
        status: 'completed',
        startedAt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
        endedAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
        createdAt: new Date(Date.now() - 35 * 24 * 60 * 60 * 1000).toISOString(),
        results: {
          isSignificant: true,
          pValue: 0.0031,
          confidenceLevel: 0.997,
          controlMean: 12.5,
          treatmentMean: 14.8,
          uplift: 18.4,
          recommendation: 'Roll out treatment to all users',
        },
      },
    ];

    const filtered = status === 'all' 
      ? experiments 
      : experiments.filter(e => e.status === status);

    return NextResponse.json(filtered);
  } catch (error) {
    return NextResponse.json({ error: 'Failed to fetch experiments' }, { status: 500 });
  }
}

// POST /api/experiments - Create new experiment
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    const experiment = {
      id: crypto.randomUUID(),
      tenantId: 'tenant-1',
      ...body,
      status: 'draft',
      startedAt: null,
      endedAt: null,
      createdAt: new Date().toISOString(),
    };

    return NextResponse.json(experiment, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to create experiment' }, { status: 500 });
  }
}
