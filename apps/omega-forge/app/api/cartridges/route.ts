import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db/client';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const status = searchParams.get('status');
  const target = searchParams.get('target');
  const limit = parseInt(searchParams.get('limit') || '50', 10);

  let sql = `SELECT id, name, display_name, version, cartridge_type, targets,
    sections_present, status, total_size_bytes, created_at, updated_at
    FROM cartridge_universal WHERE 1=1`;
  const params: any[] = [];
  let idx = 1;

  if (status) {
    sql += ` AND status = $${idx++}`;
    params.push(status);
  }
  if (target) {
    sql += ` AND $${idx++} = ANY(targets)`;
    params.push(target);
  }
  sql += ` ORDER BY created_at DESC LIMIT $${idx++}`;
  params.push(limit);

  const result = await query(sql, params);
  return NextResponse.json({ cartridges: result.rows, total: result.rowCount });
}
