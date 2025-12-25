import { NextRequest, NextResponse } from 'next/server';

// GET /api/cost/alerts - Get cost alerts
export async function GET(request: NextRequest) {
  try {
    const alerts = [
      {
        id: '1',
        alertType: 'threshold',
        threshold: 5000,
        currentValue: 4523.87,
        isTriggered: false,
        triggeredAt: null,
        notificationChannels: ['email', 'slack'],
        createdAt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
      },
      {
        id: '2',
        alertType: 'spike',
        threshold: 50, // 50% increase
        currentValue: 12.5,
        isTriggered: false,
        triggeredAt: null,
        notificationChannels: ['email'],
        createdAt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
      },
      {
        id: '3',
        alertType: 'budget',
        threshold: 6000,
        currentValue: 4523.87,
        isTriggered: false,
        triggeredAt: null,
        notificationChannels: ['email', 'slack', 'pagerduty'],
        createdAt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
      },
    ];

    return NextResponse.json(alerts);
  } catch (error) {
    return NextResponse.json({ error: 'Failed to fetch alerts' }, { status: 500 });
  }
}

// POST /api/cost/alerts - Create cost alert
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    const alert = {
      id: crypto.randomUUID(),
      ...body,
      isTriggered: false,
      triggeredAt: null,
      createdAt: new Date().toISOString(),
    };

    return NextResponse.json(alert, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to create alert' }, { status: 500 });
  }
}
