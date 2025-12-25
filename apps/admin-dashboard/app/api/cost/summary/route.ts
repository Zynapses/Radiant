import { NextRequest, NextResponse } from 'next/server';

// GET /api/cost/summary - Get cost summary
export async function GET(request: NextRequest) {
  try {
    const summary = {
      totalSpend: 4523.87,
      totalSpendChange: 12.5,
      estimatedMonthly: 5200.00,
      estimatedChange: 8.3,
      averageDaily: 150.79,
      averageDailyChange: -3.2,
      topModel: 'claude-3-5-sonnet',
      topModelSpend: 2145.32,
      tokenCount: 45_678_900,
      requestCount: 234_567,
      byProvider: {
        anthropic: 2890.45,
        openai: 1633.42,
      },
      byModel: {
        'claude-3-5-sonnet': 2145.32,
        'gpt-4o': 1234.56,
        'claude-3-haiku': 745.13,
        'gpt-4o-mini': 398.86,
      },
      trend: [
        { date: '2024-12-18', cost: 142.30 },
        { date: '2024-12-19', cost: 156.80 },
        { date: '2024-12-20', cost: 148.20 },
        { date: '2024-12-21', cost: 162.40 },
        { date: '2024-12-22', cost: 155.60 },
        { date: '2024-12-23', cost: 149.90 },
        { date: '2024-12-24', cost: 158.70 },
      ],
    };

    return NextResponse.json(summary);
  } catch (error) {
    return NextResponse.json({ error: 'Failed to fetch summary' }, { status: 500 });
  }
}
