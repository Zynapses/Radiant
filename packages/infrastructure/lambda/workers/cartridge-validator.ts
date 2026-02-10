/**
 * Cartridge Validation Worker
 * Triggered by SQS. Validates .RADz files before they can be installed.
 *
 * Validation steps:
 * 1. Retrieve .RADz from storage manager
 * 2. Decompress (ZSTD or plain ZIP)
 * 3. Verify Ed25519/ECDSA signature
 * 4. Parse and validate manifest.json
 * 5. For each declared target: verify required sections present
 * 6. For each section: validate files against section specs from DB
 * 7. For JSON files: validate against JSON schemas
 * 8. Checksum verification (manifest checksums vs actual)
 * 9. Update cartridge status
 */

import type { SQSEvent, SQSRecord } from 'aws-lambda';
import { createRegisteredLogger } from '../shared/services/logging-registry.service';
import { cartridgeStorageManager } from '../shared/services/cartridge-storage-manager.service';
import { verifyCartridgeSignature, verifyManifestChecksums } from '../shared/cartridge/signing';
import { executeStatement, stringParam } from '../shared/db/client';
import Ajv from 'ajv';

const logger = createRegisteredLogger({
  serviceName: 'worker/cartridge-validator',
  category: 'infrastructure',
  sourceType: 'lambda',
});

const ajv = new Ajv({ allErrors: true });

// ============================================================================
// Types
// ============================================================================

interface ValidateMessage {
  cartridge_id: string;
  storage_ref: string;
  storage_bucket: string;
  targets: string[];
  tenant_id: string;
}

interface ValidationResult {
  passed: boolean;
  errors: string[];
  warnings: string[];
  sections_validated: Record<string, { passed: boolean; errors: string[] }>;
  signature_valid: boolean;
  signature_algorithm: string | null;
  checksums_valid: boolean;
  test_results?: Record<string, { passed: boolean; details: string }>;
}

// ============================================================================
// Handler
// ============================================================================

export async function handler(event: SQSEvent): Promise<void> {
  for (const record of event.Records) {
    await processValidation(record);
  }
}

async function processValidation(record: SQSRecord): Promise<void> {
  const msg: ValidateMessage = JSON.parse(record.body);
  logger.info('Validating cartridge', { cartridge_id: msg.cartridge_id });

  const result: ValidationResult = {
    passed: true,
    errors: [],
    warnings: [],
    sections_validated: {},
    signature_valid: false,
    signature_algorithm: null,
    checksums_valid: false,
  };

  try {
    // 1. Retrieve .RADz from storage manager
    const radzBuffer = await cartridgeStorageManager.retrieveArchive(msg.storage_ref);
    if (!radzBuffer) {
      result.errors.push('CRITICAL: .RADz file not found in storage');
      result.passed = false;
      await updateCartridgeStatus(msg.cartridge_id, 'failed', result);
      return;
    }

    // 2. Decompress — try ZSTD first, fall back to plain ZIP
    let zipBuffer: Uint8Array;
    try {
      const { decompress } = await import('fzstd');
      zipBuffer = decompress(new Uint8Array(radzBuffer));
    } catch {
      // Not ZSTD — assume plain ZIP
      zipBuffer = new Uint8Array(radzBuffer);
    }

    const AdmZip = (await import('adm-zip')).default;
    let zip: InstanceType<typeof AdmZip>;
    try {
      zip = new AdmZip(Buffer.from(zipBuffer));
    } catch (e) {
      result.errors.push(`CRITICAL: Cannot parse archive as ZIP: ${(e as Error).message}`);
      result.passed = false;
      await updateCartridgeStatus(msg.cartridge_id, 'failed', result);
      return;
    }

    // 3. Extract key files
    const manifestEntry = zip.getEntry('manifest.json');
    const sigEntry = zip.getEntry('signature.sig');
    const certEntry = zip.getEntry('signing_cert.pem');

    if (!manifestEntry) {
      result.errors.push('CRITICAL: manifest.json not found in archive');
      result.passed = false;
      await updateCartridgeStatus(msg.cartridge_id, 'failed', result);
      return;
    }

    const manifestData = manifestEntry.getData();

    // 4. Verify signature
    if (sigEntry && certEntry) {
      const signatureData = sigEntry.getData();
      const certPem = certEntry.getData().toString('utf8');

      const sigResult = verifyCartridgeSignature(manifestData, signatureData, certPem);
      result.signature_valid = sigResult.valid;
      result.signature_algorithm = sigResult.algorithm;

      if (!sigResult.valid) {
        result.errors.push('Signature verification failed — neither Ed25519 nor ECDSA matched');
        result.passed = false;
      }
    } else {
      result.warnings.push('No signature files found (signature.sig / signing_cert.pem)');
    }

    // 5. Parse manifest
    let manifest: Record<string, unknown>;
    try {
      manifest = JSON.parse(manifestData.toString('utf8'));
    } catch (e) {
      result.errors.push(`CRITICAL: manifest.json is not valid JSON: ${(e as Error).message}`);
      result.passed = false;
      await updateCartridgeStatus(msg.cartridge_id, 'failed', result);
      return;
    }

    // 6. Validate manifest required fields
    const requiredFields = ['schema_version', 'name', 'version', 'targets'];
    for (const field of requiredFields) {
      if (!(field in manifest)) {
        result.errors.push(`Manifest missing required field: ${field}`);
        result.passed = false;
      }
    }

    const sectionsPresent: string[] = (manifest.sections_present as string[]) || [];
    const targets: string[] = (manifest.targets as string[]) || msg.targets;

    // 7. For each target, load section specs from DB and validate
    for (const target of targets) {
      const targetRow = await executeStatement(
        `SELECT * FROM cartridge_target_services WHERE service_key = $1 AND is_active = TRUE`,
        [stringParam('target', target)]
      );

      if (!targetRow.rows || targetRow.rows.length === 0) {
        result.errors.push(`Unknown or inactive target service: ${target}`);
        result.passed = false;
        continue;
      }

      const targetConfig = targetRow.rows[0] as Record<string, unknown>;
      const requiredSections: string[] = typeof targetConfig.required_sections === 'string'
        ? JSON.parse(targetConfig.required_sections as string)
        : (targetConfig.required_sections as string[]) || [];

      // Check required sections
      for (const section of requiredSections) {
        if (!sectionsPresent.includes(section)) {
          result.errors.push(`Target '${target}' requires section '${section}' but it is not present in manifest`);
          result.passed = false;
        }
      }

      // Load section specs and validate each present section
      const specs = await executeStatement(
        `SELECT * FROM cartridge_target_section_specs WHERE target_service_id = $1`,
        [stringParam('targetId', String(targetConfig.id))]
      );

      for (const spec of ((specs.rows || []) as Record<string, unknown>[])) {
        const sectionKey = String(spec.section_key);
        if (!sectionsPresent.includes(sectionKey)) continue;

        const sectionResult = { passed: true, errors: [] as string[] };
        const fileSpecs: Array<Record<string, unknown>> = typeof spec.file_specs === 'string'
          ? JSON.parse(spec.file_specs as string)
          : (spec.file_specs as Array<Record<string, unknown>>) || [];

        for (const fileSpec of fileSpecs) {
          const filename = String(fileSpec.filename);
          // Skip wildcard patterns
          if (filename.includes('*')) continue;

          const filePath = `${sectionKey}/${filename}`;
          const entry = zip.getEntry(filePath);

          if (fileSpec.required && !entry) {
            sectionResult.errors.push(`Required file missing: ${filePath}`);
            sectionResult.passed = false;
          }

          // Validate JSON files against schemas
          if (entry && fileSpec.format === 'json' && spec.json_schemas) {
            const schemas: Record<string, unknown> = typeof spec.json_schemas === 'string'
              ? JSON.parse(spec.json_schemas as string)
              : (spec.json_schemas as Record<string, unknown>) || {};
            const schemaRef = fileSpec.schema_ref as string | undefined;

            if (schemaRef && schemas[schemaRef]) {
              try {
                const data = JSON.parse(entry.getData().toString('utf8'));
                const validate = ajv.compile(schemas[schemaRef] as Record<string, unknown>);
                if (!validate(data)) {
                  sectionResult.errors.push(
                    `${filePath}: Schema validation failed: ${JSON.stringify(validate.errors)}`
                  );
                  sectionResult.passed = false;
                }
              } catch (e) {
                sectionResult.errors.push(`${filePath}: Invalid JSON: ${(e as Error).message}`);
                sectionResult.passed = false;
              }
            }
          }

          // Size check
          if (entry && fileSpec.max_size_mb) {
            const sizeMb = entry.getData().length / (1024 * 1024);
            if (sizeMb > (fileSpec.max_size_mb as number)) {
              sectionResult.errors.push(
                `${filePath}: Size ${sizeMb.toFixed(1)}MB exceeds max ${fileSpec.max_size_mb}MB`
              );
              sectionResult.passed = false;
            }
          }
        }

        result.sections_validated[sectionKey] = sectionResult;
        if (!sectionResult.passed) result.passed = false;
      }
    }

    // 8. Checksum verification
    if (manifest.checksums && typeof manifest.checksums === 'object') {
      const fileDataMap = new Map<string, Buffer>();
      for (const [filePath] of Object.entries(manifest.checksums as Record<string, string>)) {
        const entry = zip.getEntry(filePath);
        if (entry) {
          fileDataMap.set(filePath, entry.getData());
        }
      }

      const checksumResult = verifyManifestChecksums(
        manifest as { checksums: Record<string, string> },
        fileDataMap
      );
      result.checksums_valid = checksumResult.allValid;
      if (!checksumResult.allValid) {
        for (const [file, res] of Object.entries(checksumResult.results)) {
          if (!res.valid) {
            result.errors.push(`Checksum mismatch for ${file}: expected ${res.expected}, got ${res.actual}`);
          }
        }
        result.passed = false;
      }
    } else {
      result.checksums_valid = true;
      result.warnings.push('No checksums in manifest — skipping checksum verification');
    }

    // 9. Update cartridge status
    const finalStatus = result.passed ? 'validated' : 'failed';
    await updateCartridgeStatus(msg.cartridge_id, finalStatus, result);

    // Update manifest and sections_present in the cartridge record
    if (result.passed) {
      await executeStatement(
        `UPDATE cartridge_universal SET
          manifest = $1, sections_present = $2,
          total_size_bytes = $3, checksum_sha256 = $4,
          updated_at = NOW()
         WHERE id = $5`,
        [
          stringParam('manifest', JSON.stringify(manifest)),
          stringParam('sections', JSON.stringify(sectionsPresent)),
          stringParam('size', String(manifest.total_size_bytes || radzBuffer.length)),
          stringParam('checksum', String(manifest.checksums?.['manifest.json'] || '')),
          stringParam('id', msg.cartridge_id),
        ]
      );
    }

    // Audit log
    await executeStatement(
      `INSERT INTO cartridge_audit_log (tenant_id, cartridge_id, action, details, created_at)
       VALUES ($1, $2, $3, $4, NOW())`,
      [
        stringParam('tenantId', msg.tenant_id),
        stringParam('cartridgeId', msg.cartridge_id),
        stringParam('action', result.passed ? 'validation_passed' : 'validation_failed'),
        stringParam('details', JSON.stringify({
          errors: result.errors,
          warnings: result.warnings,
          signature_valid: result.signature_valid,
          checksums_valid: result.checksums_valid,
          sections_validated: Object.keys(result.sections_validated),
        })),
      ]
    );

    logger.info('Cartridge validation complete', {
      cartridge_id: msg.cartridge_id,
      passed: result.passed,
      errorCount: result.errors.length,
      warningCount: result.warnings.length,
    });

  } catch (error) {
    logger.error('Validation failed with exception', { cartridge_id: msg.cartridge_id, error });
    result.errors.push(`Unexpected error: ${(error as Error).message}`);
    result.passed = false;
    await updateCartridgeStatus(msg.cartridge_id, 'failed', result);
  }
}

async function updateCartridgeStatus(
  cartridgeId: string,
  status: string,
  result: ValidationResult,
): Promise<void> {
  await executeStatement(
    `UPDATE cartridge_universal SET
       status = $1, signature_valid = $2,
       validation_results = $3, updated_at = NOW()
     WHERE id = $4`,
    [
      stringParam('status', status),
      stringParam('sigValid', String(result.signature_valid)),
      stringParam('results', JSON.stringify(result)),
      stringParam('id', cartridgeId),
    ]
  );
}
