import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db/client';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const status = searchParams.get('status');
  const limit = parseInt(searchParams.get('limit') || '100', 10);

  let sql = `SELECT g.*, t.name as tenant_name
    FROM global_brain_gradients g
    LEFT JOIN tenants t ON t.id = g.tenant_id
    WHERE 1=1`;
  const params: unknown[] = [];
  let idx = 1;

  if (status) {
    sql += ` AND g.status = $${idx++}`;
    params.push(status);
  }
  sql += ` ORDER BY g.uploaded_at DESC LIMIT $${idx++}`;
  params.push(limit);

  try {
    const result = await query(sql, params);
    return NextResponse.json({ gradients: result.rows });
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 500 });
  }
}
