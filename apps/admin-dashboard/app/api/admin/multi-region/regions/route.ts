import { NextRequest, NextResponse } from 'next/server';

// GET /api/admin/multi-region/regions - Get all region configurations
export async function GET(request: NextRequest) {
  try {
    // In production, this would query the database
    // For now, return mock data
    const regions = [
      {
        id: '1',
        region: 'us-east-1',
        displayName: 'US East (N. Virginia)',
        isPrimary: true,
        isEnabled: true,
        endpoint: 'https://api.us-east-1.radiant.app',
        stackPrefix: 'radiant-prod',
        healthStatus: 'healthy',
        lastDeployedVersion: '4.18.0',
        lastDeployedAt: new Date().toISOString(),
        latencyMs: 45,
      },
      {
        id: '2',
        region: 'us-west-2',
        displayName: 'US West (Oregon)',
        isPrimary: false,
        isEnabled: true,
        endpoint: 'https://api.us-west-2.radiant.app',
        stackPrefix: 'radiant-prod-west',
        healthStatus: 'healthy',
        lastDeployedVersion: '4.18.0',
        lastDeployedAt: new Date().toISOString(),
        latencyMs: 78,
      },
      {
        id: '3',
        region: 'eu-west-1',
        displayName: 'EU (Ireland)',
        isPrimary: false,
        isEnabled: true,
        endpoint: 'https://api.eu-west-1.radiant.app',
        stackPrefix: 'radiant-prod-eu',
        healthStatus: 'healthy',
        lastDeployedVersion: '4.17.0',
        lastDeployedAt: new Date(Date.now() - 86400000).toISOString(),
        latencyMs: 120,
      },
    ];

    return NextResponse.json(regions);
  } catch (error) {
    return NextResponse.json({ error: 'Failed to fetch regions' }, { status: 500 });
  }
}

// POST /api/admin/multi-region/regions - Add a new region
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    // Validate required fields
    if (!body.region || !body.endpoint) {
      return NextResponse.json(
        { error: 'Region and endpoint are required' },
        { status: 400 }
      );
    }

    // In production, this would insert into the database
    const newRegion = {
      id: crypto.randomUUID(),
      region: body.region,
      displayName: body.displayName || body.region,
      isPrimary: body.isPrimary || false,
      isEnabled: body.isEnabled ?? true,
      endpoint: body.endpoint,
      stackPrefix: body.stackPrefix || `radiant-${body.region}`,
      healthStatus: 'unknown',
      lastDeployedVersion: null,
      lastDeployedAt: null,
      latencyMs: null,
    };

    return NextResponse.json(newRegion, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to create region' }, { status: 500 });
  }
}
