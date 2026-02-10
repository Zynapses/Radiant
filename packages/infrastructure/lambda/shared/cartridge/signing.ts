/**
 * RADIANT Cartridge Signing & PKI Utilities
 *
 * Ed25519 signature verification for cartridge integrity.
 * Root CA private key lives in AWS KMS HSM — never in files.
 *
 * For KMS-backed signing, we use ECDSA_SHA_256 because AWS KMS
 * does not support Ed25519. Local/offline verification uses Ed25519
 * for cartridges signed outside of KMS (e.g., community cartridges).
 */

import * as crypto from 'crypto';
import { createRegisteredLogger } from '../services/logging-registry.service';

const logger = createRegisteredLogger({
  serviceName: 'cartridge/signing',
  category: 'security',
  sourceType: 'application',
});

// ============================================================================
// Ed25519 Verification (for locally-signed cartridges)
// ============================================================================

/**
 * Verify a cartridge signature using Ed25519.
 * Used for community and locally-signed cartridges where the
 * public key is embedded in the signing_cert.pem inside the .RADz.
 */
export function verifyEd25519Signature(
  manifestBytes: Buffer,
  signatureBytes: Buffer,
  publicKeyPem: string,
): boolean {
  try {
    return crypto.verify(
      null, // Ed25519 doesn't use a separate hash algorithm
      manifestBytes,
      { key: publicKeyPem, format: 'pem', type: 'spki' },
      signatureBytes
    );
  } catch (error) {
    logger.warn('Ed25519 signature verification failed', { error });
    return false;
  }
}

// ============================================================================
// ECDSA Verification (for KMS-signed cartridges)
// ============================================================================

/**
 * Verify a cartridge signature using ECDSA SHA-256.
 * Used for cartridges signed by RADIANT KMS keys.
 */
export function verifyEcdsaSignature(
  manifestBytes: Buffer,
  signatureBytes: Buffer,
  publicKeyPem: string,
): boolean {
  try {
    const verifier = crypto.createVerify('SHA256');
    verifier.update(manifestBytes);
    return verifier.verify(publicKeyPem, signatureBytes);
  } catch (error) {
    logger.warn('ECDSA signature verification failed', { error });
    return false;
  }
}

/**
 * Attempt to verify a cartridge signature using both Ed25519 and ECDSA.
 * Returns the algorithm that succeeded, or null if neither works.
 */
export function verifyCartridgeSignature(
  manifestBytes: Buffer,
  signatureBytes: Buffer,
  publicKeyPem: string,
): { valid: boolean; algorithm: 'ed25519' | 'ecdsa_sha256' | null } {
  // Try Ed25519 first (preferred for offline-signed cartridges)
  if (verifyEd25519Signature(manifestBytes, signatureBytes, publicKeyPem)) {
    return { valid: true, algorithm: 'ed25519' };
  }

  // Try ECDSA SHA-256 (used by AWS KMS)
  if (verifyEcdsaSignature(manifestBytes, signatureBytes, publicKeyPem)) {
    return { valid: true, algorithm: 'ecdsa_sha256' };
  }

  return { valid: false, algorithm: null };
}

// ============================================================================
// KMS Signing (for platform-authored cartridges)
// ============================================================================

/**
 * Sign manifest bytes using an AWS KMS key.
 * Used by OMEGA Forge when creating platform cartridges.
 *
 * KMS does not support Ed25519 — uses ECDSA_SHA_256 instead.
 */
export async function signManifestWithKMS(
  manifestBytes: Buffer,
  signingKeyId: string,
): Promise<{ signature: Buffer; algorithm: string }> {
  const { KMSClient, SignCommand } = await import('@aws-sdk/client-kms');
  const kms = new KMSClient({ region: process.env.AWS_REGION || 'us-east-1' });

  const result = await kms.send(new SignCommand({
    KeyId: signingKeyId,
    Message: manifestBytes,
    MessageType: 'RAW',
    SigningAlgorithm: 'ECDSA_SHA_256',
  }));

  if (!result.Signature) {
    throw new Error('KMS signing returned no signature');
  }

  logger.info('Signed cartridge manifest via KMS', { signingKeyId });

  return {
    signature: Buffer.from(result.Signature),
    algorithm: 'ECDSA_SHA_256',
  };
}

/**
 * Verify a signature using the KMS public key.
 * Retrieves the public key from KMS and verifies locally.
 */
export async function verifyWithKMSPublicKey(
  manifestBytes: Buffer,
  signatureBytes: Buffer,
  signingKeyId: string,
): Promise<boolean> {
  try {
    const { KMSClient, GetPublicKeyCommand } = await import('@aws-sdk/client-kms');
    const kms = new KMSClient({ region: process.env.AWS_REGION || 'us-east-1' });

    const pubKeyResult = await kms.send(new GetPublicKeyCommand({
      KeyId: signingKeyId,
    }));

    if (!pubKeyResult.PublicKey) {
      logger.warn('KMS returned no public key', { signingKeyId });
      return false;
    }

    // Convert DER to PEM
    const derBase64 = Buffer.from(pubKeyResult.PublicKey).toString('base64');
    const pem = `-----BEGIN PUBLIC KEY-----\n${derBase64.match(/.{1,64}/g)!.join('\n')}\n-----END PUBLIC KEY-----`;

    return verifyEcdsaSignature(manifestBytes, signatureBytes, pem);
  } catch (error) {
    logger.error('KMS public key verification failed', { signingKeyId, error });
    return false;
  }
}

// ============================================================================
// Checksum Utilities
// ============================================================================

/**
 * Compute SHA-256 hash of a buffer.
 */
export function computeSha256(data: Buffer): string {
  return crypto.createHash('sha256').update(data).digest('hex');
}

/**
 * Verify all checksums in a manifest against actual file data.
 * Returns a map of filename → { expected, actual, valid }.
 */
export function verifyManifestChecksums(
  manifest: { checksums?: Record<string, string> },
  fileDataMap: Map<string, Buffer>,
): { allValid: boolean; results: Record<string, { expected: string; actual: string; valid: boolean }> } {
  const results: Record<string, { expected: string; actual: string; valid: boolean }> = {};
  let allValid = true;

  if (!manifest.checksums) {
    return { allValid: true, results };
  }

  for (const [filePath, expectedHash] of Object.entries(manifest.checksums)) {
    const fileData = fileDataMap.get(filePath);
    if (!fileData) {
      results[filePath] = { expected: expectedHash, actual: 'MISSING', valid: false };
      allValid = false;
      continue;
    }

    const actual = computeSha256(fileData);
    const expected = expectedHash.replace('sha256:', '');
    const valid = actual === expected;

    results[filePath] = { expected, actual, valid };
    if (!valid) allValid = false;
  }

  return { allValid, results };
}
