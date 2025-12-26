import { NextResponse } from 'next/server';
import { thinkTankApi } from '@/lib/api/endpoints';

/**
 * Think Tank Consent Management API
 * Proxies to Radiant service layer for GDPR consent management
 */

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId') || undefined;
    const consentType = searchParams.get('consentType') || undefined;

    const result = await thinkTankApi.listConsents({ userId, consentType });
    return NextResponse.json(result);
  } catch (error) {
    console.error('Failed to fetch consents:', error);
    return NextResponse.json(
      { error: 'Failed to fetch consents' },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { userId, email, consentType, granted } = body;

    if (!userId || !email || !consentType) {
      return NextResponse.json(
        { error: 'userId, email, and consentType are required' },
        { status: 400 }
      );
    }

    const consent = await thinkTankApi.recordConsent({
      userId,
      email,
      consentType,
      granted: granted ?? true,
    });

    return NextResponse.json(consent, { status: 201 });
  } catch (error) {
    console.error('Failed to record consent:', error);
    return NextResponse.json(
      { error: 'Failed to record consent' },
      { status: 500 }
    );
  }
}

export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');
    const consentType = searchParams.get('consentType');

    if (!userId || !consentType) {
      return NextResponse.json(
        { error: 'userId and consentType are required' },
        { status: 400 }
      );
    }

    const result = await thinkTankApi.withdrawConsent(userId, consentType);
    return NextResponse.json(result);
  } catch (error) {
    console.error('Failed to withdraw consent:', error);
    return NextResponse.json(
      { error: 'Failed to withdraw consent' },
      { status: 500 }
    );
  }
}
