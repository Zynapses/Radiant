import { NextRequest, NextResponse } from 'next/server';
import { withAuth, apiError, type AuthenticatedRequest } from '@/lib/api/auth-wrapper';

// GET /api/thinktank/share/[token] - Get shared conversation (public endpoint)
export async function GET(
  request: NextRequest,
  { params }: { params: { token: string } }
) {
  try {
    const token = params.token;
    
    if (!token) {
      return NextResponse.json({ error: 'Share token is required' }, { status: 400 });
    }

    // Mock data - in production would query database
    const sharedConversation = {
      id: '1',
      shareToken: token,
      title: 'AI Development Discussion',
      description: 'A conversation about best practices in AI development',
      sharedByName: 'John Doe',
      sharedAt: new Date().toISOString(),
      messageCount: 12,
      allowCopy: true,
      messages: [
        {
          id: 'm1',
          role: 'user',
          content: 'What are the best practices for building AI applications?',
          model: null,
          createdAt: new Date(Date.now() - 3600000).toISOString(),
        },
        {
          id: 'm2',
          role: 'assistant',
          content: 'There are several key best practices for building AI applications:\n\n1. **Start with clear objectives** - Define what problem you\'re solving\n2. **Data quality matters** - Ensure your training data is clean and representative\n3. **Iterative development** - Build, test, and refine continuously\n4. **Monitor in production** - Track model performance and drift\n5. **Human oversight** - Keep humans in the loop for critical decisions',
          model: 'claude-3-5-sonnet',
          createdAt: new Date(Date.now() - 3500000).toISOString(),
        },
      ],
    };

    // Log access (in production would insert into thinktank_share_access_log)
    const clientIp = request.headers.get('x-forwarded-for') || 'unknown';
    const userAgent = request.headers.get('user-agent') || 'unknown';
    console.log(`Share accessed: ${token} from ${clientIp}`);

    return NextResponse.json({ data: sharedConversation });
  } catch (error) {
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

    // In production would verify ownership and delete from database
    return NextResponse.json({ 
      success: true,
      message: 'Share link revoked',
      revokedBy: request.user.email,
    });
  } catch (error) {
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

    // In production would verify ownership and update database
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
    return apiError('UPDATE_FAILED', 'Failed to update share settings', 500);
  }
});
