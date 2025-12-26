import { NextResponse } from 'next/server';

/**
 * Think Tank Configuration API
 * Get and update Think Tank parameters
 */

// Mock config - in production, this would be stored in the database
let MOCK_THINKTANK_CONFIG = {
  maxUsersPerTenant: 1000,
  maxConversationsPerUser: 100,
  maxTokensPerConversation: 128000,
  enabledModels: [
    'gpt-4o',
    'gpt-4o-mini',
    'claude-3-5-sonnet',
    'claude-3-5-haiku',
    'gemini-2.0-flash',
  ],
  enabledDomainModes: [
    'general',
    'coding',
    'writing',
    'analysis',
    'research',
  ],
  rateLimits: {
    requestsPerMinute: 60,
    tokensPerMinute: 100000,
  },
  features: {
    collaboration: true,
    voiceInput: true,
    codeExecution: true,
    fileUploads: true,
    imageGeneration: true,
  },
};

export async function GET() {
  try {
    // In production, query the database for Think Tank config
    return NextResponse.json(MOCK_THINKTANK_CONFIG);
  } catch (error) {
    console.error('Failed to fetch Think Tank config:', error);
    return NextResponse.json(
      { error: 'Failed to fetch Think Tank config' },
      { status: 500 }
    );
  }
}

export async function PATCH(request: Request) {
  try {
    const updates = await request.json();
    
    // Validate and merge updates
    MOCK_THINKTANK_CONFIG = {
      ...MOCK_THINKTANK_CONFIG,
      ...updates,
      rateLimits: {
        ...MOCK_THINKTANK_CONFIG.rateLimits,
        ...(updates.rateLimits || {}),
      },
      features: {
        ...MOCK_THINKTANK_CONFIG.features,
        ...(updates.features || {}),
      },
    };
    
    // In production, save to database
    // await db.query(`UPDATE thinktank_config SET ...`);
    
    return NextResponse.json(MOCK_THINKTANK_CONFIG);
  } catch (error) {
    console.error('Failed to update Think Tank config:', error);
    return NextResponse.json(
      { error: 'Failed to update Think Tank config' },
      { status: 500 }
    );
  }
}
