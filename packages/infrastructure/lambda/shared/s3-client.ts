/**
 * S3 Client Utilities
 * Version: 5.42.0
 * 
 * Provides S3 upload and signed URL generation for report exports.
 */

import { S3Client, PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl as s3GetSignedUrl } from '@aws-sdk/s3-request-presigner';

const s3Client = new S3Client({});

export interface UploadParams {
  bucket: string;
  key: string;
  body: Buffer | string;
  contentType: string;
}

export interface SignedUrlParams {
  bucket: string;
  key: string;
  expiresIn?: number; // seconds, default 3600
}

/**
 * Upload a file to S3
 */
export async function uploadToS3(params: UploadParams): Promise<void> {
  const command = new PutObjectCommand({
    Bucket: params.bucket,
    Key: params.key,
    Body: params.body,
    ContentType: params.contentType,
  });

  await s3Client.send(command);
}

/**
 * Get a pre-signed URL for downloading a file from S3
 */
export async function getSignedUrl(params: SignedUrlParams): Promise<string> {
  const command = new GetObjectCommand({
    Bucket: params.bucket,
    Key: params.key,
  });

  return s3GetSignedUrl(s3Client, command, {
    expiresIn: params.expiresIn || 3600,
  });
}

/**
 * Delete a file from S3
 */
export async function deleteFromS3(bucket: string, key: string): Promise<void> {
  const { DeleteObjectCommand } = await import('@aws-sdk/client-s3');
  const command = new DeleteObjectCommand({
    Bucket: bucket,
    Key: key,
  });

  await s3Client.send(command);
}
