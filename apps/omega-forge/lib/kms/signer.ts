/**
 * KMS-backed cartridge signing for OMEGA Forge
 *
 * Signs cartridge manifests with Ed25519/ECDSA via AWS KMS.
 * Forge has direct KMS access (IAM role on ECS task).
 */

import { KMSClient, SignCommand, GetPublicKeyCommand, DescribeKeyCommand } from '@aws-sdk/client-kms';
import * as crypto from 'crypto';

let kmsClient: KMSClient | null = null;

function getKMS(): KMSClient {
  if (!kmsClient) {
    kmsClient = new KMSClient({ region: process.env.AWS_REGION || 'us-east-1' });
  }
  return kmsClient;
}

/**
 * Sign a manifest buffer with KMS
 */
export async function signManifestWithKMS(
  manifestBuffer: Buffer,
  keyId: string,
): Promise<Buffer> {
  const digest = crypto.createHash('sha256').update(manifestBuffer).digest();

  const result = await getKMS().send(new SignCommand({
    KeyId: keyId,
    Message: digest,
    MessageType: 'DIGEST',
    SigningAlgorithm: 'ECDSA_SHA_256',
  }));

  if (!result.Signature) {
    throw new Error('KMS Sign returned no signature');
  }

  return Buffer.from(result.Signature);
}

/**
 * Get the public key PEM for a signing key
 */
export async function getSigningPublicKeyPem(keyId: string): Promise<string> {
  const result = await getKMS().send(new GetPublicKeyCommand({ KeyId: keyId }));

  if (!result.PublicKey) {
    throw new Error('KMS GetPublicKey returned no key');
  }

  const der = Buffer.from(result.PublicKey);
  const b64 = der.toString('base64');
  const lines = b64.match(/.{1,64}/g) || [];
  return `-----BEGIN PUBLIC KEY-----\n${lines.join('\n')}\n-----END PUBLIC KEY-----`;
}

/**
 * Verify a signature against a manifest using the public key PEM
 */
export function verifySignature(
  manifestBuffer: Buffer,
  signature: Buffer,
  publicKeyPem: string,
): boolean {
  try {
    const verifier = crypto.createVerify('SHA256');
    verifier.update(manifestBuffer);
    return verifier.verify(publicKeyPem, signature);
  } catch {
    return false;
  }
}

/**
 * Describe a signing key
 */
export async function describeSigningKey(keyId: string): Promise<{
  keyId: string;
  keyState: string;
  keyUsage: string;
  signingAlgorithms: string[];
  creationDate?: Date;
}> {
  const result = await getKMS().send(new DescribeKeyCommand({ KeyId: keyId }));
  const meta = result.KeyMetadata!;

  return {
    keyId: meta.KeyId!,
    keyState: meta.KeyState || 'Unknown',
    keyUsage: meta.KeyUsage || 'Unknown',
    signingAlgorithms: (meta.SigningAlgorithms as string[]) || [],
    creationDate: meta.CreationDate,
  };
}
