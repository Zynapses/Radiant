/**
 * RADIANT v5.52.15 - Conversation Export API Route
 * 
 * Generates Decision Intelligence Artifacts and compliance-formatted exports
 * from Think Tank conversations.
 */

import { NextRequest, NextResponse } from 'next/server';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

export type ExportFormat = 'decision_record' | 'hipaa_audit' | 'soc2_evidence' | 'gdpr_dsar' | 'pdf' | 'json';

interface ExportRequest {
  format: ExportFormat;
  redactPhi?: boolean;
  title?: string;
}

interface ExportResponse {
  success: boolean;
  artifactId?: string;
  downloadUrl?: string;
  error?: string;
}

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
): Promise<NextResponse<ExportResponse>> {
  try {
    const conversationId = params.id;
    const body: ExportRequest = await request.json();
    const { format, redactPhi = true, title } = body;

    // Get auth token from request
    const authHeader = request.headers.get('authorization');
    if (!authHeader) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Step 1: Generate Decision Record (DIA artifact) from conversation
    const generateResponse = await fetch(`${API_BASE_URL}/api/thinktank/dia/generate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': authHeader,
      },
      body: JSON.stringify({
        conversationId,
        title,
      }),
    });

    if (!generateResponse.ok) {
      const errorData = await generateResponse.json().catch(() => ({}));
      return NextResponse.json(
        { success: false, error: errorData.message || 'Failed to generate decision record' },
        { status: generateResponse.status }
      );
    }

    const artifact = await generateResponse.json();

    // If just generating decision record, return the artifact
    if (format === 'decision_record') {
      return NextResponse.json({
        success: true,
        artifactId: artifact.id,
      });
    }

    // Step 2: Export in requested compliance format
    const exportFormat = format === 'pdf' ? 'pdf' : 
                         format === 'hipaa_audit' ? 'hipaa_audit' :
                         format === 'soc2_evidence' ? 'soc2_evidence' :
                         format === 'gdpr_dsar' ? 'gdpr_dsar' : 'json';

    const exportResponse = await fetch(`${API_BASE_URL}/api/thinktank/dia/${artifact.id}/export`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': authHeader,
      },
      body: JSON.stringify({
        format: exportFormat,
        redactPhi,
      }),
    });

    if (!exportResponse.ok) {
      const errorData = await exportResponse.json().catch(() => ({}));
      return NextResponse.json(
        { success: false, error: errorData.message || 'Failed to export' },
        { status: exportResponse.status }
      );
    }

    const exportData = await exportResponse.json();

    return NextResponse.json({
      success: true,
      artifactId: artifact.id,
      downloadUrl: exportData.downloadUrl,
    });

  } catch (error) {
    console.error('Export error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
): Promise<NextResponse> {
  // Get existing artifacts for this conversation
  try {
    const conversationId = params.id;
    const authHeader = request.headers.get('authorization');
    
    if (!authHeader) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const response = await fetch(
      `${API_BASE_URL}/api/thinktank/dia?conversationId=${conversationId}`,
      {
        headers: {
          'Authorization': authHeader,
        },
      }
    );

    if (!response.ok) {
      return NextResponse.json(
        { success: false, error: 'Failed to fetch artifacts' },
        { status: response.status }
      );
    }

    const data = await response.json();
    return NextResponse.json({ success: true, artifacts: data.artifacts || [] });

  } catch (error) {
    console.error('Fetch artifacts error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
