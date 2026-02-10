import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db/client';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const action = searchParams.get('action');
  const tenantId = searchParams.get('tenant_id');
  const limit = parseInt(searchParams.get('limit') || '100', 10);

  let sql = `SELECT cal.*, cu.name as cartridge_name, cu.version as cartridge_version
    FROM cartridge_audit_log cal
    LEFT JOIN cartridge_universal cu ON cu.id = cal.cartridge_id
    WHERE 1=1`;
  const params: any[] = [];
  let idx = 1;

  if (action) {
    sql += ` AND cal.action = $${idx++}`;
    params.push(action);
  }
  if (tenantId) {
    sql += ` AND cal.tenant_id = $${idx++}`;
    params.push(tenantId);
  }
  sql += ` ORDER BY cal.created_at DESC LIMIT $${idx++}`;
  params.push(limit);

  try {
    const result = await query(sql, params);
    return NextResponse.json({ entries: result.rows, total: result.rowCount });
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 500 });
  }
}
