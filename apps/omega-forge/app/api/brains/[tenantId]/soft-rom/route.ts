import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db/client';
import { listObjects, retrieveObject, buildOmegaBrainPath } from '@/lib/s3/storage-manager';
import { buildCartridge } from '@/lib/cartridge/builder';

/**
 * GET — View current Soft ROM state for a tenant's brain
 * POST — Export Soft ROM as .RADz cartridge
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: { tenantId: string } }
) {
  const { tenantId } = params;

  const files = await listObjects(
    'omega_state',
    `omega-brains/${tenantId}/soft-rom/`
  ).catch(() => []);

  let preferences = null;
  try {
    const prefResult = await retrieveObject(
      'omega_state',
      buildOmegaBrainPath(tenantId, 'soft-rom', 'preferences.json')
    );
    if (prefResult) {
      preferences = JSON.parse(prefResult.data.toString('utf-8'));
    }
  } catch {
    // No preferences file yet
  }

  return NextResponse.json({
    tenant_id: tenantId,
    soft_rom_files: files.map(f => ({
      key: f.key.replace(`omega-brains/${tenantId}/soft-rom/`, ''),
      size: f.size,
      lastModified: f.lastModified,
    })),
    preferences,
    total_size: files.reduce((sum, f) => sum + f.size, 0),
  });
}

export async function POST(
  _request: NextRequest,
  { params }: { params: { tenantId: string } }
) {
  const { tenantId } = params;

  const sections: Record<string, Record<string, Buffer | object>> = {};

  // 1. Collect OMEGA Soft ROM weights via storage manager
  const omegaFiles = await listObjects(
    'omega_state',
    `omega-brains/${tenantId}/soft-rom/`
  ).catch(() => []);

  if (omegaFiles.length > 0) {
    sections['soft_rom'] = {};
    for (const file of omegaFiles) {
      const filename = file.key.replace(`omega-brains/${tenantId}/soft-rom/`, '');
      const data = await retrieveObject('omega_state', file.key);
      if (data) {
        sections['soft_rom'][filename] = data.data;
      }
    }
  }

  // 2. Collect CATO learned state from DB
  const catoLearned: Record<string, Buffer | object> = {};

  const patterns = await query(
    `SELECT pattern_text, fitness_score FROM cato_evolved_patterns WHERE tenant_id = $1 ORDER BY fitness_score DESC LIMIT 1000`,
    [tenantId]
  ).catch(() => ({ rows: [] }));

  if (patterns.rows.length > 0) {
    catoLearned['evolved_patterns.json'] = patterns.rows.map((r) => ({
      text: (r as { pattern_text: string }).pattern_text,
      fitness: (r as { fitness_score: number }).fitness_score,
    }));
  }

  const catoConfig = await query(
    `SELECT config_key, config_value FROM cato_cartridge_config WHERE tenant_id = $1`,
    [tenantId]
  ).catch(() => ({ rows: [] }));

  if (catoConfig.rows.length > 0) {
    const prefs: Record<string, unknown> = {};
    for (const row of catoConfig.rows) {
      prefs[(row as { config_key: string }).config_key] = (row as { config_value: string }).config_value;
    }
    catoLearned['cato_soft_preferences.json'] = prefs;
  }

  if (Object.keys(catoLearned).length > 0) {
    sections['cato_learned'] = catoLearned;
  }

  // 3. Build .RADz cartridge
  const targets: string[] = [];
  if (sections['soft_rom']) targets.push('omega');
  if (sections['cato_learned']) targets.push('cato');

  if (targets.length === 0) {
    return NextResponse.json(
      { error: 'No Soft ROM data found for this tenant' },
      { status: 404 }
    );
  }

  const result = await buildCartridge({
    name: `soft-rom-${tenantId.substring(0, 8)}`,
    display_name: `Soft ROM Export — ${new Date().toISOString().split('T')[0]}`,
    version: `1.0.${Date.now()}`,
    cartridge_type: 'soft_rom',
    targets,
    description: `Accumulated learning export for tenant ${tenantId}`,
    author: { name: 'OMEGA Brain', org_id: tenantId },
    sections,
  });

  return NextResponse.json(result, { status: 201 });
}
