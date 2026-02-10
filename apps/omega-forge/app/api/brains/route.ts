import { NextResponse } from 'next/server';
import { query } from '@/lib/db/client';

export async function GET() {
  try {
    const result = await query(`
      SELECT DISTINCT t.id as tenant_id, t.name as tenant_name,
        oi.status as brain_status,
        oi.last_dream_at,
        oi.boot_status
      FROM tenants t
      LEFT JOIN omega_brain_instances oi ON oi.tenant_id = t.id
      ORDER BY t.name ASC
      LIMIT 200
    `).catch(() => {
      // Fallback if omega_brain_instances doesn't exist yet
      return query(`SELECT id as tenant_id, name as tenant_name FROM tenants ORDER BY name ASC LIMIT 200`);
    });

    return NextResponse.json({ brains: result.rows });
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 500 });
  }
}
