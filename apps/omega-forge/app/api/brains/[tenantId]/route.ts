import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db/client';
import { listObjects } from '@/lib/s3/storage-manager';

export async function GET(
  _request: NextRequest,
  { params }: { params: { tenantId: string } }
) {
  const { tenantId } = params;

  try {
    // Get tenant info
    const tenant = await query(`SELECT * FROM tenants WHERE id = $1`, [tenantId]);
    if (tenant.rows.length === 0) {
      return NextResponse.json({ error: 'Tenant not found' }, { status: 404 });
    }

    // Get installed cartridges
    const cartridges = await query(`
      SELECT ci.*, cu.name, cu.display_name, cu.version, cu.cartridge_type
      FROM cartridge_installations ci
      JOIN cartridge_universal cu ON cu.id = ci.cartridge_id
      WHERE ci.tenant_id = $1
      ORDER BY ci.priority ASC
    `, [tenantId]);

    // Get dream history
    const dreams = await query(`
      SELECT id, status, started_at, completed_at, duration_ms
      FROM dream_queue
      WHERE tenant_id = $1
      ORDER BY started_at DESC
      LIMIT 20
    `, [tenantId]).catch(() => ({ rows: [] }));

    // Get Soft ROM files via storage manager
    const softRomFiles = await listObjects(
      'omega_state',
      `omega-brains/${tenantId}/soft-rom/`
    ).catch(() => []);

    return NextResponse.json({
      tenant: tenant.rows[0],
      cartridges: cartridges.rows,
      dreams: dreams.rows,
      soft_rom: {
        files: softRomFiles,
        total_size: softRomFiles.reduce((sum, f) => sum + f.size, 0),
      },
    });
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 500 });
  }
}
