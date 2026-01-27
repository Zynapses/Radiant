/**
 * RADIANT v5.52.28 - MFA Check API Route (PROMPT-41B)
 */

import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';

const API_BASE = process.env.INTERNAL_API_URL || 'http://localhost:3001';

export async function GET(request: NextRequest) {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get('auth_token')?.value || 
                  request.headers.get('authorization')?.replace('Bearer ', '');

    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const deviceToken = request.headers.get('x-device-token') || 
                        cookieStore.get('mfa_device_token')?.value || '';

    const response = await fetch(`${API_BASE}/api/v2/mfa/check`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
        'x-device-token': deviceToken,
      },
    });

    const data = await response.json();
    return NextResponse.json(data, { status: response.status });
  } catch (error) {
    console.error('MFA check error:', error);
    return NextResponse.json(
      { mfaRequired: false, mfaEnrolled: false, deviceTrusted: false, role: 'user' },
      { status: 200 }
    );
  }
}
