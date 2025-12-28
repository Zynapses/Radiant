/**
 * RADIANT v4.18.0 - Localization API
 * 
 * Fetches translations from the localization registry.
 */

import { NextRequest, NextResponse } from 'next/server';

const API_URL = process.env.RADIANT_API_URL || process.env.NEXT_PUBLIC_API_URL || '';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const language = searchParams.get('language') || 'en';
  const category = searchParams.get('category');
  
  try {
    // Forward to backend localization service
    const params = new URLSearchParams({ language });
    if (category) params.append('category', category);
    
    const response = await fetch(`${API_URL}/api/localization/translations?${params}`, {
      headers: {
        'Content-Type': 'application/json',
      },
    });
    
    if (!response.ok) {
      // Return empty translations on error - fallback to keys
      return NextResponse.json({ translations: {} });
    }
    
    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    // Return empty translations on error - UI will show keys as fallback
    return NextResponse.json({ translations: {} });
  }
}
