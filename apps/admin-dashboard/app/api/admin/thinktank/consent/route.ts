import { NextResponse } from 'next/server';

/**
 * Think Tank Consent Management API
 * GDPR compliance: Track and manage user consent for data processing
 */

interface UserConsent {
  id: string;
  userId: string;
  email: string;
  consentType: 'data_processing' | 'marketing' | 'analytics' | 'ai_training';
  granted: boolean;
  grantedAt: string | null;
  withdrawnAt: string | null;
  ipAddress: string;
  userAgent: string;
}

// Mock consent data - in production, this would be stored in the database
let MOCK_CONSENTS: UserConsent[] = [
  {
    id: '1',
    userId: 'user-1',
    email: 'user1@example.com',
    consentType: 'data_processing',
    granted: true,
    grantedAt: '2024-01-15T10:00:00Z',
    withdrawnAt: null,
    ipAddress: '192.168.1.1',
    userAgent: 'Mozilla/5.0...',
  },
  {
    id: '2',
    userId: 'user-1',
    email: 'user1@example.com',
    consentType: 'analytics',
    granted: true,
    grantedAt: '2024-01-15T10:00:00Z',
    withdrawnAt: null,
    ipAddress: '192.168.1.1',
    userAgent: 'Mozilla/5.0...',
  },
];

// GET /api/admin/thinktank/consent - List all consents
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');
    const consentType = searchParams.get('consentType');

    let filtered = MOCK_CONSENTS;

    if (userId) {
      filtered = filtered.filter((c) => c.userId === userId);
    }
    if (consentType) {
      filtered = filtered.filter((c) => c.consentType === consentType);
    }

    // Calculate statistics
    const stats = {
      total: filtered.length,
      granted: filtered.filter((c) => c.granted).length,
      withdrawn: filtered.filter((c) => !c.granted).length,
      byType: {
        data_processing: filtered.filter((c) => c.consentType === 'data_processing' && c.granted).length,
        marketing: filtered.filter((c) => c.consentType === 'marketing' && c.granted).length,
        analytics: filtered.filter((c) => c.consentType === 'analytics' && c.granted).length,
        ai_training: filtered.filter((c) => c.consentType === 'ai_training' && c.granted).length,
      },
    };

    return NextResponse.json({
      consents: filtered,
      stats,
    });
  } catch (error) {
    console.error('Failed to fetch consents:', error);
    return NextResponse.json(
      { error: 'Failed to fetch consents' },
      { status: 500 }
    );
  }
}

// POST /api/admin/thinktank/consent - Record new consent
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

    const newConsent: UserConsent = {
      id: crypto.randomUUID(),
      userId,
      email,
      consentType,
      granted: granted ?? true,
      grantedAt: granted ? new Date().toISOString() : null,
      withdrawnAt: !granted ? new Date().toISOString() : null,
      ipAddress: request.headers.get('x-forwarded-for') || 'unknown',
      userAgent: request.headers.get('user-agent') || 'unknown',
    };

    MOCK_CONSENTS.push(newConsent);

    // Audit log for GDPR compliance
    console.log('[AUDIT] Consent recorded:', {
      action: granted ? 'user_consent_recorded' : 'user_consent_withdrawn',
      timestamp: new Date().toISOString(),
      userId,
      consentType,
      granted,
    });

    return NextResponse.json(newConsent, { status: 201 });
  } catch (error) {
    console.error('Failed to record consent:', error);
    return NextResponse.json(
      { error: 'Failed to record consent' },
      { status: 500 }
    );
  }
}

// DELETE /api/admin/thinktank/consent - Withdraw consent
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

    // Find and update consent
    const consentIndex = MOCK_CONSENTS.findIndex(
      (c) => c.userId === userId && c.consentType === consentType
    );

    if (consentIndex === -1) {
      return NextResponse.json(
        { error: 'Consent not found' },
        { status: 404 }
      );
    }

    MOCK_CONSENTS[consentIndex] = {
      ...MOCK_CONSENTS[consentIndex],
      granted: false,
      withdrawnAt: new Date().toISOString(),
    };

    // Audit log for GDPR compliance
    console.log('[AUDIT] Consent withdrawn:', {
      action: 'user_consent_withdrawn',
      timestamp: new Date().toISOString(),
      userId,
      consentType,
    });

    return NextResponse.json({ success: true, message: 'Consent withdrawn' });
  } catch (error) {
    console.error('Failed to withdraw consent:', error);
    return NextResponse.json(
      { error: 'Failed to withdraw consent' },
      { status: 500 }
    );
  }
}
