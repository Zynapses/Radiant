/**
 * Parse .RADz files — extract manifest, sections, validate structure
 *
 * ALL S3 reads go through the storage manager.
 */

import AdmZip from 'adm-zip';
import * as crypto from 'crypto';
import type { CartridgeManifest } from '../types';

export interface ParsedCartridge {
  manifest: CartridgeManifest | null;
  signature: Buffer | null;
  cert: string | null;
  sections: Map<string, Map<string, Buffer>>;
  errors: string[];
}

export function parseRADz(radzBuffer: Buffer): ParsedCartridge {
  const errors: string[] = [];
  let zipBuffer: Buffer;

  // Try ZSTD decompress first, fall back to raw ZIP
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const fzstd = require('fzstd');
    zipBuffer = Buffer.from(fzstd.decompress(new Uint8Array(radzBuffer)));
  } catch {
    zipBuffer = radzBuffer;
  }

  const zip = new AdmZip(zipBuffer);

  // Parse manifest
  const manifestEntry = zip.getEntry('manifest.json');
  if (!manifestEntry) {
    errors.push('manifest.json not found');
    return { manifest: null, signature: null, cert: null, sections: new Map(), errors };
  }

  let manifest: CartridgeManifest;
  try {
    manifest = JSON.parse(manifestEntry.getData().toString('utf8'));
  } catch (e) {
    errors.push(`Invalid manifest.json: ${(e as Error).message}`);
    return { manifest: null, signature: null, cert: null, sections: new Map(), errors };
  }

  // Extract signature and cert
  const sigEntry = zip.getEntry('signature.sig');
  const certEntry = zip.getEntry('signing_cert.pem');
  const signature = sigEntry ? sigEntry.getData() : null;
  const cert = certEntry ? certEntry.getData().toString('utf8') : null;

  // Extract sections
  const sections = new Map<string, Map<string, Buffer>>();
  for (const entry of zip.getEntries()) {
    if (entry.isDirectory) continue;
    if (['manifest.json', 'signature.sig', 'signing_cert.pem'].includes(entry.entryName)) continue;

    const parts = entry.entryName.split('/');
    if (parts.length < 2) continue;

    const sectionName = parts[0];
    const fileName = parts.slice(1).join('/');

    if (!sections.has(sectionName)) {
      sections.set(sectionName, new Map());
    }
    sections.get(sectionName)!.set(fileName, entry.getData());
  }

  // Verify checksums
  if (manifest.checksums) {
    for (const [filePath, expected] of Object.entries(manifest.checksums)) {
      const parts = filePath.split('/');
      const section = parts[0];
      const file = parts.slice(1).join('/');
      const fileMap = sections.get(section);

      if (!fileMap || !fileMap.has(file)) {
        errors.push(`Checksum declared for ${filePath} but file not found`);
        continue;
      }

      const actual = crypto.createHash('sha256').update(fileMap.get(file)!).digest('hex');
      const expectedHash = (expected as string).replace('sha256:', '');
      if (actual !== expectedHash) {
        errors.push(`Checksum mismatch: ${filePath}`);
      }
    }
  }

  return { manifest, signature, cert, sections, errors };
}
