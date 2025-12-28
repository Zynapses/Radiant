import { NextRequest, NextResponse } from 'next/server';

const API_URL = process.env.RADIANT_API_URL || process.env.NEXT_PUBLIC_API_URL || '';

// Default preferences with 'auto' personality mode
const DEFAULT_PREFERENCES = {
  personalityMode: 'auto',
  intensityLevel: 5,
  enableDomainMessages: true,
  enableModelPersonality: true,
  enableTimeAwareness: true,
  enableAchievements: true,
  enableWellbeingNudges: true,
  enableEasterEggs: true,
  enableSounds: false,
  soundTheme: 'default',
  soundVolume: 50,
};

/**
 * GET /api/thinktank/delight/preferences
 * Get user's delight preferences including personality mode
 */
export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');
    const tenantId = request.headers.get('x-tenant-id') || 'default';
    const userId = request.headers.get('x-user-id') || '';

    const response = await fetch(`${API_URL}/api/v2/delight/preferences`, {
      headers: {
        'Authorization': authHeader || '',
        'X-Tenant-ID': tenantId,
        'X-User-ID': userId,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      // Return default preferences for development or when not found
      return NextResponse.json(DEFAULT_PREFERENCES);
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error('Failed to fetch delight preferences:', error);
    // Return defaults on error
    return NextResponse.json(DEFAULT_PREFERENCES);
  }
}

/**
 * PATCH /api/thinktank/delight/preferences
 * Update user's delight preferences including personality mode
 */
export async function PATCH(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');
    const tenantId = request.headers.get('x-tenant-id') || 'default';
    const userId = request.headers.get('x-user-id') || '';
    
    const body = await request.json();

    const response = await fetch(`${API_URL}/api/v2/delight/preferences`, {
      method: 'PATCH',
      headers: {
        'Authorization': authHeader || '',
        'X-Tenant-ID': tenantId,
        'X-User-ID': userId,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      // For development, just return the updated preferences
      return NextResponse.json({ ...DEFAULT_PREFERENCES, ...body });
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error('Failed to update delight preferences:', error);
    // For development, return success with the body merged
    const body = await request.json().catch(() => ({}));
    return NextResponse.json({ ...DEFAULT_PREFERENCES, ...body });
  }
}
