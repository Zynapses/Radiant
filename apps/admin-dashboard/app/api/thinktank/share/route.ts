import { NextResponse } from 'next/server';
import { withAuth, apiError, type AuthenticatedRequest } from '@/lib/api/auth-wrapper';
import { thinkTankApi } from '@/lib/api/endpoints';

// GET /api/thinktank/share - List user's shared conversations
export const GET = withAuth(async (request: AuthenticatedRequest) => {
  try {
    const shares = await thinkTankApi.listConsents({ userId: request.user.id });
    
    return NextResponse.json({ data: shares });
  } catch (error) {
    console.error('Failed to fetch shared conversations:', error);
    return apiError('FETCH_FAILED', 'Failed to fetch shared conversations', 500);
  }
});

// POST /api/thinktank/share - Create a new share link
export const POST = withAuth(async (request: AuthenticatedRequest) => {
  try {
    const body = await request.json();
    const { conversationId } = body;

    if (!conversationId) {
      return apiError('VALIDATION_ERROR', 'conversationId is required', 400);
    }

    const result = await thinkTankApi.getShareLink(conversationId);

    return NextResponse.json({ 
      data: {
        shareToken: result.token,
        expiresAt: result.expiresAt,
      },
      shareUrl: result.url,
    }, { status: 201 });
  } catch (error) {
    console.error('Failed to create share link:', error);
    return apiError('CREATE_FAILED', 'Failed to create share link', 500);
  }
});
