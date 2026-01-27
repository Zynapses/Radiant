import { NextResponse } from 'next/server';
import { thinkTankApi } from '@/lib/api/endpoints';

/**
 * Think Tank Configuration API
 * Proxies to the Radiant service layer for Think Tank configuration
 */

export async function GET() {
  try {
    const config = await thinkTankApi.getConfig();
    return NextResponse.json(config);
  } catch (error) {
    console.error('Failed to fetch Think Tank config:', error);
    return NextResponse.json(
      { error: 'Failed to fetch Think Tank config' },
      { status: 500 }
    );
  }
}

export async function PATCH(request: Request) {
  try {
    const updates = await request.json();
    const config = await thinkTankApi.updateConfig(updates);
    
    // Audit logging is handled by the service layer

    return NextResponse.json(config);
  } catch (error) {
    console.error('Failed to update Think Tank config:', error);
    return NextResponse.json(
      { error: 'Failed to update Think Tank config' },
      { status: 500 }
    );
  }
}
