import { NextResponse } from 'next/server';
import { withAuth, apiError, type AuthenticatedRequest } from '@/lib/api/auth-wrapper';

// GET /api/thinktank/share - List user's shared conversations
export const GET = withAuth(async (request: AuthenticatedRequest) => {
  try {
    // Mock data - in production would query database
    const shares = [
      {
        id: '1',
        conversationId: 'conv-1',
        shareToken: 'abc123def456',
        title: 'AI Development Discussion',
        description: 'A conversation about best practices in AI development',
        isPublic: true,
        allowCopy: true,
        viewCount: 42,
        maxViews: null,
        hasPassword: false,
        createdAt: new Date().toISOString(),
        expiresAt: null,
      },
    ];

    return NextResponse.json({ data: shares });
  } catch (error) {
    return apiError('FETCH_FAILED', 'Failed to fetch shared conversations', 500);
  }
});

// POST /api/thinktank/share - Create a new share link
export const POST = withAuth(async (request: AuthenticatedRequest) => {
  try {
    const body = await request.json();
    const { conversationId, title, description, isPublic, allowCopy, expiresAt, maxViews, password } = body;

    if (!conversationId) {
      return apiError('VALIDATION_ERROR', 'conversationId is required', 400);
    }

    // Generate share token
    const shareToken = generateShareToken();

    // Mock response - in production would insert into database
    const share = {
      id: crypto.randomUUID(),
      conversationId,
      tenantId: request.user.tenantId,
      sharedBy: request.user.id,
      shareToken,
      title: title || null,
      description: description || null,
      isPublic: isPublic ?? true,
      allowCopy: allowCopy ?? true,
      expiresAt: expiresAt || null,
      viewCount: 0,
      maxViews: maxViews || null,
      hasPassword: !!password,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const shareUrl = `${process.env.NEXT_PUBLIC_APP_URL || 'https://thinktank.radiant.ai'}/share/${shareToken}`;

    return NextResponse.json({ 
      data: share,
      shareUrl,
    }, { status: 201 });
  } catch (error) {
    return apiError('CREATE_FAILED', 'Failed to create share link', 500);
  }
});

function generateShareToken(): string {
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);
  return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');
}
