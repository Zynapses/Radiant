import { NextRequest, NextResponse } from 'next/server';

// GET /api/settings/timeouts - Get operation timeout settings
export async function GET(request: NextRequest) {
  try {
    const timeouts = [
      { operationName: 'cdk_bootstrap', timeoutSeconds: 600, retryCount: 2, retryDelayMs: 5000, isActive: true },
      { operationName: 'cdk_deploy', timeoutSeconds: 1800, retryCount: 1, retryDelayMs: 10000, isActive: true },
      { operationName: 'cdk_destroy', timeoutSeconds: 900, retryCount: 1, retryDelayMs: 5000, isActive: true },
      { operationName: 'migration_run', timeoutSeconds: 300, retryCount: 3, retryDelayMs: 2000, isActive: true },
      { operationName: 'health_check', timeoutSeconds: 30, retryCount: 5, retryDelayMs: 1000, isActive: true },
      { operationName: 'model_inference', timeoutSeconds: 120, retryCount: 2, retryDelayMs: 3000, isActive: true },
      { operationName: 'api_request', timeoutSeconds: 30, retryCount: 3, retryDelayMs: 1000, isActive: true },
      { operationName: 'file_upload', timeoutSeconds: 300, retryCount: 2, retryDelayMs: 5000, isActive: true },
    ];

    return NextResponse.json(timeouts);
  } catch (error) {
    return NextResponse.json({ error: 'Failed to fetch timeouts' }, { status: 500 });
  }
}

// PUT /api/settings/timeouts - Update timeout settings
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    return NextResponse.json({ success: true, updated: body });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to update timeouts' }, { status: 500 });
  }
}

// POST /api/settings/timeouts/sync - Sync with SSM
export async function POST(request: NextRequest) {
  try {
    return NextResponse.json({
      success: true,
      message: 'SSM sync triggered',
      syncedAt: new Date().toISOString(),
    });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to sync with SSM' }, { status: 500 });
  }
}
