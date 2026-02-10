import { NextResponse } from 'next/server';
import { query } from '@/lib/db/client';

export async function GET() {
  try {
    const [cartridges, brains, cato, globalBrain, recentAudit] = await Promise.all([
      query(`SELECT
        COUNT(*) as total,
        COUNT(*) FILTER (WHERE status = 'active') as active
      FROM cartridge_universal`),
      query(`SELECT
        COUNT(DISTINCT tenant_id) as total,
        COUNT(DISTINCT tenant_id) FILTER (WHERE status = 'healthy') as healthy
      FROM omega_brain_instances WHERE status IS NOT NULL`).catch(() => ({ rows: [{ total: 0, healthy: 0 }] })),
      query(`SELECT COUNT(DISTINCT tenant_id) as total
      FROM cato_cartridge_config`).catch(() => ({ rows: [{ total: 0 }] })),
      query(`SELECT
        COUNT(*) FILTER (WHERE enrolled = TRUE) as enrolled_tenants
      FROM global_brain_enrollment`).catch(() => ({ rows: [{ enrolled_tenants: 0 }] })),
      query(`SELECT action, cartridge_id, created_at
      FROM cartridge_audit_log ORDER BY created_at DESC LIMIT 10`).catch(() => ({ rows: [] })),
    ]);

    const roundsResult = await query(
      `SELECT COUNT(*) FILTER (WHERE status = 'completed') as completed_rounds FROM global_brain_rounds`
    ).catch(() => ({ rows: [{ completed_rounds: 0 }] }));

    return NextResponse.json({
      cartridges: cartridges.rows[0],
      brains: brains.rows[0],
      cato: cato.rows[0],
      globalBrain: {
        enrolledTenants: globalBrain.rows[0]?.enrolled_tenants || 0,
        completedRounds: roundsResult.rows[0]?.completed_rounds || 0,
      },
      recentAudit: recentAudit.rows,
    });
  } catch (error) {
    console.error('Dashboard API error:', error);
    return NextResponse.json({ error: (error as Error).message }, { status: 500 });
  }
}
