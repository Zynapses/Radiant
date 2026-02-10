import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db/client';

export async function GET(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  const { id } = params;
  const result = await query(
    `SELECT * FROM cartridge_universal WHERE id = $1`,
    [id]
  );

  if (result.rows.length === 0) {
    return NextResponse.json({ error: 'Cartridge not found' }, { status: 404 });
  }

  // Get installations
  const installations = await query(
    `SELECT ci.*, t.name as tenant_name
     FROM cartridge_installations ci
     LEFT JOIN tenants t ON t.id = ci.tenant_id
     WHERE ci.cartridge_id = $1
     ORDER BY ci.priority ASC`,
    [id]
  );

  return NextResponse.json({
    cartridge: result.rows[0],
    installations: installations.rows,
  });
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  const { id } = params;
  await query(
    `UPDATE cartridge_universal SET status = 'archived', updated_at = NOW() WHERE id = $1`,
    [id]
  );

  await query(
    `INSERT INTO cartridge_audit_log (tenant_id, cartridge_id, action, actor_id, details)
     VALUES (NULL, $1, 'cartridge_archived', 'forge-system', '{}')`,
    [id]
  );

  return NextResponse.json({ message: 'Cartridge archived' });
}
