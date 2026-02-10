/**
 * Cartridge Builder — Creates .RADz files from authored sections
 *
 * This runs IN-PROCESS in Forge (not as a Lambda worker).
 * ALL S3 operations go through the storage manager.
 */

import * as crypto from 'crypto';
import AdmZip from 'adm-zip';
import { signManifestWithKMS, getSigningPublicKeyPem } from '../kms/signer';
import type { CartridgeManifest } from '../types';
import { query } from '../db/client';
import { storeObject, buildCartridgePath } from '../s3/storage-manager';

export interface CartridgeBuildRequest {
  name: string;
  display_name: string;
  version: string;
  cartridge_type: string;
  targets: string[];
  description?: string;
  author: { name: string; email?: string; org_id?: string };
  sections: Record<string, Record<string, Buffer | object>>;
}

export interface CartridgeBuildResult {
  cartridge_id: string;
  s3_key: string;
  size_bytes: number;
  checksum_sha256: string;
  manifest: CartridgeManifest;
  validation_result: { passed: boolean; errors: string[]; warnings: string[] };
}

export async function buildCartridge(req: CartridgeBuildRequest): Promise<CartridgeBuildResult> {
  // 1. Validate targets exist
  const targetCheck = await query(
    `SELECT service_key FROM cartridge_target_services WHERE service_key = ANY($1) AND is_active = TRUE`,
    [req.targets]
  );
  const found = targetCheck.rows.map((r) => (r as { service_key: string }).service_key);
  const missing = req.targets.filter(t => !found.includes(t));
  if (missing.length > 0) {
    throw new Error(`Unknown targets: ${missing.join(', ')}`);
  }

  // 2. Build ZIP archive
  const zip = new AdmZip();
  const checksums: Record<string, string> = {};
  const sectionsPresent: string[] = [];

  for (const [sectionName, files] of Object.entries(req.sections)) {
    sectionsPresent.push(sectionName);

    for (const [filename, content] of Object.entries(files)) {
      const filePath = `${sectionName}/${filename}`;
      let buffer: Buffer;

      if (Buffer.isBuffer(content)) {
        buffer = content;
      } else {
        buffer = Buffer.from(JSON.stringify(content, null, 2), 'utf8');
      }

      zip.addFile(filePath, buffer);
      const hash = crypto.createHash('sha256').update(buffer).digest('hex');
      checksums[filePath] = `sha256:${hash}`;
    }
  }

  // 3. Build manifest
  const manifest: CartridgeManifest = {
    schema_version: '1.0.0',
    cartridge_id: crypto.randomUUID(),
    name: req.name,
    display_name: req.display_name,
    version: req.version,
    description: req.description || null,
    author: req.author,
    targets: req.targets,
    cartridge_type: req.cartridge_type,
    sections_present: sectionsPresent,
    checksums,
    total_size_bytes: 0,
    created_at: new Date().toISOString(),
    signed_at: null as string | null,
    signing_key_id: null as string | null,
  };

  // 4. Sign manifest with KMS
  const signingKeyId = process.env.CARTRIDGE_SIGNING_KEY_ID;
  if (signingKeyId) {
    const manifestBuffer = Buffer.from(JSON.stringify(manifest, null, 2), 'utf8');
    const signature = await signManifestWithKMS(manifestBuffer, signingKeyId);

    manifest.signed_at = new Date().toISOString();
    manifest.signing_key_id = signingKeyId;

    const signedManifestBuffer = Buffer.from(JSON.stringify(manifest, null, 2), 'utf8');
    zip.addFile('manifest.json', signedManifestBuffer);
    zip.addFile('signature.sig', signature);

    const certPem = await getSigningPublicKeyPem(signingKeyId);
    zip.addFile('signing_cert.pem', Buffer.from(certPem, 'utf8'));
  } else {
    zip.addFile('manifest.json', Buffer.from(JSON.stringify(manifest, null, 2), 'utf8'));
  }

  // 5. Compress with ZSTD (if available) or use raw ZIP
  let radzBuffer: Buffer;
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const fzstd = require('fzstd');
    const zipBuffer = zip.toBuffer();
    const compressed = fzstd.compress(new Uint8Array(zipBuffer));
    radzBuffer = Buffer.from(compressed);
  } catch {
    radzBuffer = zip.toBuffer();
  }

  manifest.total_size_bytes = radzBuffer.length;

  // 6. Compute archive checksum
  const archiveChecksum = crypto.createHash('sha256').update(radzBuffer).digest('hex');

  // 7. Upload to S3 via storage manager
  const s3Key = buildCartridgePath(req.name, req.version);
  await storeObject('cartridge', s3Key, radzBuffer, 'application/octet-stream', {
    'cartridge-name': req.name,
    'cartridge-version': req.version,
    'cartridge-type': req.cartridge_type,
  });

  // 8. Insert into database
  const insertResult = await query(`
    INSERT INTO cartridge_universal (
      cartridge_type, name, display_name, version,
      description, targets, sections_present,
      total_size_bytes, status,
      created_at, updated_at
    ) VALUES (
      $1, $2, $3, $4, $5, $6, $7, $8, 'validated', NOW(), NOW()
    ) RETURNING id
  `, [
    req.cartridge_type, req.name, req.display_name, req.version,
    req.description || null, req.targets, sectionsPresent,
    radzBuffer.length,
  ]);

  const cartridgeId = insertResult.rows[0].id as string;

  // 9. Audit log
  await query(`
    INSERT INTO cartridge_audit_log (tenant_id, cartridge_id, action, actor_id, details)
    VALUES (NULL, $1, 'cartridge_built', 'forge-system', $2)
  `, [
    cartridgeId,
    JSON.stringify({
      name: req.name,
      version: req.version,
      targets: req.targets,
      size: radzBuffer.length,
      checksum: archiveChecksum,
    }),
  ]);

  return {
    cartridge_id: cartridgeId,
    s3_key: s3Key,
    size_bytes: radzBuffer.length,
    checksum_sha256: archiveChecksum,
    manifest,
    validation_result: { passed: true, errors: [], warnings: [] },
  };
}
