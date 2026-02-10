import { NextResponse } from 'next/server';
import { query } from '@/lib/db/client';

export async function GET() {
  try {
    const rounds = await query(`
      SELECT * FROM global_brain_rounds
      ORDER BY round_number DESC LIMIT 50
    `);

    const pipelines = await query(`
      SELECT * FROM global_brain_cartridge_pipeline
      ORDER BY created_at DESC LIMIT 20
    `);

    const enrollmentStats = await query(`
      SELECT
        COUNT(*) FILTER (WHERE enrolled = TRUE) as enrolled,
        COUNT(*) as total,
        AVG(contribution_quality_score) FILTER (WHERE enrolled = TRUE) as avg_quality
      FROM global_brain_enrollment
    `);

    return NextResponse.json({
      rounds: rounds.rows,
      pipelines: pipelines.rows,
      enrollment: enrollmentStats.rows[0],
    });
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 500 });
  }
}
