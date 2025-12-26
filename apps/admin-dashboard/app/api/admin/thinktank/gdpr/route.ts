import { NextResponse } from 'next/server';

/**
 * Think Tank GDPR Data Subject Rights API
 * Implements: Data Export (Right to Portability) and Data Deletion (Right to Erasure)
 */

interface DataExportRequest {
  id: string;
  userId: string;
  email: string;
  requestType: 'export' | 'delete';
  status: 'pending' | 'processing' | 'completed' | 'failed';
  requestedAt: string;
  completedAt: string | null;
  downloadUrl: string | null;
  expiresAt: string | null;
}

// Mock data requests - in production, stored in database
let MOCK_REQUESTS: DataExportRequest[] = [];

// GET /api/admin/thinktank/gdpr - List all GDPR requests
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');
    const requestType = searchParams.get('requestType');
    const status = searchParams.get('status');

    let filtered = MOCK_REQUESTS;

    if (userId) {
      filtered = filtered.filter((r) => r.userId === userId);
    }
    if (requestType) {
      filtered = filtered.filter((r) => r.requestType === requestType);
    }
    if (status) {
      filtered = filtered.filter((r) => r.status === status);
    }

    // Calculate statistics
    const stats = {
      total: filtered.length,
      pending: filtered.filter((r) => r.status === 'pending').length,
      processing: filtered.filter((r) => r.status === 'processing').length,
      completed: filtered.filter((r) => r.status === 'completed').length,
      failed: filtered.filter((r) => r.status === 'failed').length,
      exportRequests: filtered.filter((r) => r.requestType === 'export').length,
      deleteRequests: filtered.filter((r) => r.requestType === 'delete').length,
    };

    return NextResponse.json({
      requests: filtered.sort((a, b) => 
        new Date(b.requestedAt).getTime() - new Date(a.requestedAt).getTime()
      ),
      stats,
    });
  } catch (error) {
    console.error('Failed to fetch GDPR requests:', error);
    return NextResponse.json(
      { error: 'Failed to fetch GDPR requests' },
      { status: 500 }
    );
  }
}

// POST /api/admin/thinktank/gdpr - Create new GDPR request
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { userId, email, requestType } = body;

    if (!userId || !email || !requestType) {
      return NextResponse.json(
        { error: 'userId, email, and requestType are required' },
        { status: 400 }
      );
    }

    if (!['export', 'delete'].includes(requestType)) {
      return NextResponse.json(
        { error: 'requestType must be "export" or "delete"' },
        { status: 400 }
      );
    }

    const newRequest: DataExportRequest = {
      id: crypto.randomUUID(),
      userId,
      email,
      requestType,
      status: 'pending',
      requestedAt: new Date().toISOString(),
      completedAt: null,
      downloadUrl: null,
      expiresAt: null,
    };

    MOCK_REQUESTS.push(newRequest);

    // Audit log for GDPR compliance
    console.log('[AUDIT] GDPR request created:', {
      action: requestType === 'export' ? 'thinktank_data_exported' : 'thinktank_data_deleted',
      timestamp: new Date().toISOString(),
      requestId: newRequest.id,
      userId,
      requestType,
      status: 'pending',
    });

    // In production, this would trigger an async job to process the request
    // Simulate processing completion after a delay
    setTimeout(() => {
      const idx = MOCK_REQUESTS.findIndex((r) => r.id === newRequest.id);
      if (idx !== -1) {
        MOCK_REQUESTS[idx] = {
          ...MOCK_REQUESTS[idx],
          status: 'completed',
          completedAt: new Date().toISOString(),
          downloadUrl: requestType === 'export' 
            ? `/api/admin/thinktank/gdpr/download/${newRequest.id}` 
            : null,
          expiresAt: requestType === 'export'
            ? new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString() // 7 days
            : null,
        };

        console.log('[AUDIT] GDPR request completed:', {
          action: requestType === 'export' ? 'thinktank_data_exported' : 'thinktank_data_deleted',
          timestamp: new Date().toISOString(),
          requestId: newRequest.id,
          userId,
          status: 'completed',
        });
      }
    }, 2000);

    return NextResponse.json(newRequest, { status: 201 });
  } catch (error) {
    console.error('Failed to create GDPR request:', error);
    return NextResponse.json(
      { error: 'Failed to create GDPR request' },
      { status: 500 }
    );
  }
}

// PATCH /api/admin/thinktank/gdpr - Update request status (admin only)
export async function PATCH(request: Request) {
  try {
    const body = await request.json();
    const { requestId, status } = body;

    if (!requestId || !status) {
      return NextResponse.json(
        { error: 'requestId and status are required' },
        { status: 400 }
      );
    }

    const idx = MOCK_REQUESTS.findIndex((r) => r.id === requestId);
    if (idx === -1) {
      return NextResponse.json(
        { error: 'Request not found' },
        { status: 404 }
      );
    }

    MOCK_REQUESTS[idx] = {
      ...MOCK_REQUESTS[idx],
      status,
      completedAt: ['completed', 'failed'].includes(status) 
        ? new Date().toISOString() 
        : null,
    };

    // Audit log
    console.log('[AUDIT] GDPR request status updated:', {
      action: 'gdpr_request_updated',
      timestamp: new Date().toISOString(),
      requestId,
      newStatus: status,
    });

    return NextResponse.json(MOCK_REQUESTS[idx]);
  } catch (error) {
    console.error('Failed to update GDPR request:', error);
    return NextResponse.json(
      { error: 'Failed to update GDPR request' },
      { status: 500 }
    );
  }
}
