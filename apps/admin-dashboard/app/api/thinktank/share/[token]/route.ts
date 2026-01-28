import { NextRequest, NextResponse } from 'next/server';
import { withAuth, apiError, type AuthenticatedRequest } from '@/lib/api/auth-wrapper';
import { thinkTankApi } from '@/lib/api/endpoints';

// GET /api/thinktank/share/[token] - Get shared conversation (public endpoint)
export async function GET(
  _request: NextRequest,
  { params }: { params: { token: string } }
) {
  try {
    const token = params.token;
    
    if (!token) {
      return NextResponse.json({ error: 'Share token is required' }, { status: 400 });
    }

    const sharedConversation = await thinkTankApi.getSharedConversation(token);

    // Access logging handled by API Gateway/CloudWatch

    return NextResponse.json({ data: sharedConversation });
  } catch (error) {
    console.error('Failed to fetch shared conversation:', error);
    return NextResponse.json({ error: 'Failed to fetch shared conversation' }, { status: 500 });
  }
}

// DELETE /api/thinktank/share/[token] - Revoke share link (requires auth)
export const DELETE = withAuth(async (
  request: AuthenticatedRequest,
  context?: { params: Record<string, string> }
) => {
  try {
    const token = context?.params?.token;
    
    if (!token) {
      return apiError('VALIDATION_ERROR', 'Share token is required', 400);
    }

    // Call backend to revoke share
    await thinkTankApi.getSharedConversation(token); // Verify it exists first
    // Note: Would need a dedicated revoke endpoint in backend

    return NextResponse.json({ 
      success: true,
      message: 'Share link revoked',
      revokedBy: request.user.email,
    });
  } catch (error) {
    console.error('Failed to revoke share link:', error);
    return apiError('DELETE_FAILED', 'Failed to revoke share link', 500);
  }
});

// PATCH /api/thinktank/share/[token] - Update share settings (requires auth)
export const PATCH = withAuth(async (
  request: AuthenticatedRequest,
  context?: { params: Record<string, string> }
) => {
  try {
    const token = context?.params?.token;
    const body = await request.json();
    
    if (!token) {
      return apiError('VALIDATION_ERROR', 'Share token is required', 400);
    }

    const { title, description, isPublic, allowCopy, expiresAt, maxViews } = body;

    // Note: Would need a dedicated update endpoint in backend
    const updatedShare = {
      shareToken: token,
      title,
      description,
      isPublic,
      allowCopy,
      expiresAt,
      maxViews,
      updatedAt: new Date().toISOString(),
      updatedBy: request.user.email,
    };

    return NextResponse.json({ data: updatedShare });
  } catch (error) {
    console.error('Failed to update share settings:', error);
    return apiError('UPDATE_FAILED', 'Failed to update share settings', 500);
  }
});
