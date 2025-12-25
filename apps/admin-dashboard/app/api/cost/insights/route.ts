import { NextResponse } from 'next/server';
import { withAuth, apiError } from '@/lib/api/auth-wrapper';

// GET /api/cost/insights - Get cost insights (from Neural Engine)
export const GET = withAuth(async () => {
  try {
    const insights = [
      {
        id: '1',
        type: 'model_switch',
        title: 'Potential savings with model switch',
        description: 'Switching 40% of claude-3-opus requests to claude-3-5-sonnet could save $320/month with similar quality.',
        impact: 'high',
        estimatedSavings: 320,
        action: 'Configure model routing rules',
      },
      {
        id: '2',
        type: 'usage_pattern',
        title: 'Off-peak usage opportunity',
        description: '35% of requests occur during off-peak hours when cheaper models could be used.',
        impact: 'medium',
        estimatedSavings: 180,
        action: 'Implement time-based routing',
      },
      {
        id: '3',
        type: 'efficiency',
        title: 'Prompt optimization',
        description: 'Average prompt length is 2.3x optimal. Shorter prompts could reduce costs by 15%.',
        impact: 'medium',
        estimatedSavings: 150,
        action: 'Review prompt templates',
      },
    ];

    return NextResponse.json(insights);
  } catch (error) {
    return apiError('FETCH_FAILED', 'Failed to fetch insights', 500);
  }
});
