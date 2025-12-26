import { NextResponse } from 'next/server';
import { thinkTankApi } from '@/lib/api/endpoints';

/**
 * Think Tank Status API
 * Proxies to the Radiant service layer for Think Tank status
 */

export async function GET() {
  try {
    const status = await thinkTankApi.getStatus();
    return NextResponse.json(status);
  } catch (error) {
    console.error('Failed to fetch Think Tank status:', error);
    // Return degraded status if service is unavailable
    return NextResponse.json({
      installed: false,
      version: 'unknown',
      health: {
        status: 'unhealthy',
        uptime: 0,
        lastCheck: new Date().toISOString(),
      },
      features: {
        conversations: false,
        collaboration: false,
        voiceVideo: false,
        canvas: false,
      },
      metrics: {
        activeUsers: 0,
        totalConversations: 0,
        avgResponseTime: 0,
      },
    });
  }
}

export async function POST() {
  try {
    const status = await thinkTankApi.refreshStatus();
    return NextResponse.json(status);
  } catch (error) {
    console.error('Failed to refresh Think Tank status:', error);
    return NextResponse.json(
      { error: 'Failed to refresh Think Tank status' },
      { status: 500 }
    );
  }
}
