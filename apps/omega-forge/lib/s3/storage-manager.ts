/**
 * OMEGA Forge Storage Manager
 *
 * ALL S3 operations in OMEGA Forge go through this service.
 * Wraps AWS S3 SDK with bucket routing, content tracking, and consistent key generation.
 *
 * Mirrors the Lambda cartridgeStorageManager pattern but with direct S3 access
 * (no pre-signed URLs needed since Forge runs in the VPC with IAM role).
 */

import {
  S3Client,
  GetObjectCommand,
  PutObjectCommand,
  ListObjectsV2Command,
  DeleteObjectCommand,
  HeadObjectCommand,
} from '@aws-sdk/client-s3';

let s3Client: S3Client | null = null;

function getS3(): S3Client {
  if (!s3Client) {
    s3Client = new S3Client({ region: process.env.AWS_REGION || 'us-east-1' });
  }
  return s3Client;
}

// ============================================================================
// Bucket Routing
// ============================================================================

export type ForgeBucket = 'cartridge' | 'omega_state' | 'cortex_model' | 'global_brain';

function resolveBucket(bucket: ForgeBucket): string {
  switch (bucket) {
    case 'cartridge':
      return process.env.CARTRIDGE_BUCKET || 'radiant-cartridges';
    case 'omega_state':
      return process.env.OMEGA_STATE_BUCKET || process.env.CARTRIDGE_BUCKET || 'radiant-cartridges';
    case 'cortex_model':
      return process.env.CORTEX_MODEL_BUCKET || process.env.CARTRIDGE_BUCKET || 'radiant-cartridges';
    case 'global_brain':
      return process.env.GLOBAL_BRAIN_BUCKET || process.env.CARTRIDGE_BUCKET || 'radiant-cartridges';
    default:
      throw new Error(`Unknown bucket type: ${bucket}`);
  }
}

// ============================================================================
// Store
// ============================================================================

export interface StoreResult {
  bucket: string;
  key: string;
  size_bytes: number;
  storage_ref: string;
}

export async function storeObject(
  bucket: ForgeBucket,
  key: string,
  body: Buffer | Uint8Array,
  contentType: string = 'application/octet-stream',
  metadata?: Record<string, string>,
): Promise<StoreResult> {
  const bucketName = resolveBucket(bucket);
  await getS3().send(new PutObjectCommand({
    Bucket: bucketName,
    Key: key,
    Body: body,
    ContentType: contentType,
    Metadata: metadata,
  }));

  return {
    bucket: bucketName,
    key,
    size_bytes: body.length,
    storage_ref: `s3://${bucketName}/${key}`,
  };
}

// ============================================================================
// Retrieve
// ============================================================================

export interface RetrieveResult {
  data: Buffer;
  contentType: string;
  size: number;
  lastModified?: Date;
}

export async function retrieveObject(
  bucket: ForgeBucket,
  key: string,
): Promise<RetrieveResult | null> {
  try {
    const bucketName = resolveBucket(bucket);
    const response = await getS3().send(new GetObjectCommand({
      Bucket: bucketName,
      Key: key,
    }));

    if (!response.Body) return null;
    const data = Buffer.from(await response.Body.transformToByteArray());

    return {
      data,
      contentType: response.ContentType || 'application/octet-stream',
      size: data.length,
      lastModified: response.LastModified,
    };
  } catch (error: any) {
    if (error.name === 'NoSuchKey' || error.$metadata?.httpStatusCode === 404) {
      return null;
    }
    throw error;
  }
}

/**
 * Retrieve by storage_ref (s3://bucket/key format or just a key)
 */
export async function retrieveByRef(storageRef: string): Promise<RetrieveResult | null> {
  if (storageRef.startsWith('s3://')) {
    const withoutProtocol = storageRef.slice(5);
    const slashIdx = withoutProtocol.indexOf('/');
    const bucket = withoutProtocol.slice(0, slashIdx);
    const key = withoutProtocol.slice(slashIdx + 1);

    const response = await getS3().send(new GetObjectCommand({ Bucket: bucket, Key: key }));
    if (!response.Body) return null;
    const data = Buffer.from(await response.Body.transformToByteArray());
    return { data, contentType: response.ContentType || 'application/octet-stream', size: data.length, lastModified: response.LastModified };
  }
  // Fallback: assume cartridge bucket
  return retrieveObject('cartridge', storageRef);
}

// ============================================================================
// List
// ============================================================================

export interface ListEntry {
  key: string;
  size: number;
  lastModified?: Date;
}

export async function listObjects(
  bucket: ForgeBucket,
  prefix: string,
  maxKeys: number = 1000,
): Promise<ListEntry[]> {
  const bucketName = resolveBucket(bucket);
  const response = await getS3().send(new ListObjectsV2Command({
    Bucket: bucketName,
    Prefix: prefix,
    MaxKeys: maxKeys,
  }));

  return (response.Contents || []).map(obj => ({
    key: obj.Key!,
    size: obj.Size || 0,
    lastModified: obj.LastModified,
  }));
}

// ============================================================================
// Delete
// ============================================================================

export async function deleteObject(bucket: ForgeBucket, key: string): Promise<void> {
  const bucketName = resolveBucket(bucket);
  await getS3().send(new DeleteObjectCommand({
    Bucket: bucketName,
    Key: key,
  }));
}

// ============================================================================
// Head (check existence + metadata)
// ============================================================================

export async function headObject(
  bucket: ForgeBucket,
  key: string,
): Promise<{ exists: boolean; size?: number; contentType?: string; lastModified?: Date }> {
  try {
    const bucketName = resolveBucket(bucket);
    const response = await getS3().send(new HeadObjectCommand({
      Bucket: bucketName,
      Key: key,
    }));
    return {
      exists: true,
      size: response.ContentLength,
      contentType: response.ContentType,
      lastModified: response.LastModified,
    };
  } catch {
    return { exists: false };
  }
}

// ============================================================================
// Path Builders
// ============================================================================

export function buildCartridgePath(name: string, version: string): string {
  return `cartridges/platform/${name}/${version}/${name}-${version}.RADz`;
}

export function buildOmegaBrainPath(tenantId: string, subdir: string, filename: string): string {
  return `omega-brains/${tenantId}/${subdir}/${filename}`;
}

export function buildCortexPath(tenantId: string, subdir: string, filename: string): string {
  return `cortex/tenants/${tenantId}/${subdir}/${filename}`;
}

export function buildGlobalBrainPath(subdir: string, filename: string): string {
  return `global-brain/${subdir}/${filename}`;
}
