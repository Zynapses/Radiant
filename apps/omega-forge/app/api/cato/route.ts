import { NextResponse } from 'next/server';
import { query } from '@/lib/db/client';

export async function GET() {
  try {
    const result = await query(`
      SELECT DISTINCT t.id as tenant_id, t.name as tenant_name,
        (SELECT COUNT(*) FROM cato_evolved_patterns WHERE tenant_id = t.id) as pattern_count,
        (SELECT COUNT(*) FROM cato_cartridge_config WHERE tenant_id = t.id) as config_count
      FROM tenants t
      WHERE EXISTS (SELECT 1 FROM cato_cartridge_config WHERE tenant_id = t.id)
         OR EXISTS (SELECT 1 FROM cato_evolved_patterns WHERE tenant_id = t.id)
      ORDER BY t.name ASC
      LIMIT 200
    `).catch(() => {
      return query(`SELECT id as tenant_id, name as tenant_name FROM tenants ORDER BY name ASC LIMIT 200`);
    });

    return NextResponse.json({ instances: result.rows });
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 500 });
  }
}
