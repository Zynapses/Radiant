import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db/client';

export async function GET() {
  try {
    const targets = await query(`
      SELECT cts.*,
        (SELECT COUNT(*) FROM cartridge_target_section_specs WHERE target_service_id = cts.id) as spec_count
      FROM cartridge_target_services cts
      ORDER BY cts.service_key ASC
    `);

    return NextResponse.json({ targets: targets.rows });
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { service_key, display_name, description, handler_module } = body;

    if (!service_key || !display_name) {
      return NextResponse.json(
        { error: 'service_key and display_name are required' },
        { status: 400 }
      );
    }

    const result = await query(`
      INSERT INTO cartridge_target_services (service_key, display_name, description, handler_module, is_active)
      VALUES ($1, $2, $3, $4, TRUE)
      RETURNING *
    `, [service_key, display_name, description || null, handler_module || null]);

    return NextResponse.json(result.rows[0], { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 500 });
  }
}
