import {
  S3Client,
  DeleteObjectCommand,
  PutObjectCommand,
  GetObjectCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { env } from '../config/env.js';

const s3Client = new S3Client({
  region: 'auto',
  endpoint: `https://${env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: env.R2_ACCESS_KEY_ID,
    secretAccessKey: env.R2_SECRET_ACCESS_KEY,
  },
});

const BUCKET = env.R2_BUCKET_NAME;

/**
 * Get a signed URL for streaming a file from R2 (5-minute expiry).
 */
export async function getStreamUrl(r2ObjectKey: string): Promise<string> {
  const command = new GetObjectCommand({
    Bucket: BUCKET,
    Key: r2ObjectKey,
  });
  return getSignedUrl(s3Client, command, { expiresIn: 300 });
}

/**
 * Get a signed URL for artwork (1-hour expiry for longer caching).
 */
export async function getArtworkUrl(r2ObjectKey: string): Promise<string> {
  const command = new GetObjectCommand({
    Bucket: BUCKET,
    Key: r2ObjectKey,
  });
  return getSignedUrl(s3Client, command, { expiresIn: 3600 });
}

/**
 * Get a signed URL for downloading a file from R2 with Content-Disposition (5-minute expiry).
 */
export async function getDownloadUrl(
  r2ObjectKey: string,
  filename: string
): Promise<string> {
  const command = new GetObjectCommand({
    Bucket: BUCKET,
    Key: r2ObjectKey,
    ResponseContentDisposition: `attachment; filename="${encodeURIComponent(filename)}"`,
  });
  return getSignedUrl(s3Client, command, { expiresIn: 300 });
}

/**
 * Get a signed PUT URL for direct upload to R2 (1-hour expiry).
 */
export async function getUploadUrl(
  key: string,
  contentType: string
): Promise<string> {
  const command = new PutObjectCommand({
    Bucket: BUCKET,
    Key: key,
    ContentType: contentType,
  });
  return getSignedUrl(s3Client, command, { expiresIn: 3600 });
}

/**
 * Delete an object from R2.
 */
export async function deleteObject(r2ObjectKey: string): Promise<void> {
  const command = new DeleteObjectCommand({
    Bucket: BUCKET,
    Key: r2ObjectKey,
  });
  await s3Client.send(command);
}

/**
 * Upload a buffer directly to R2 (for artwork, etc.).
 */
export async function uploadBuffer(
  key: string,
  buffer: Buffer,
  contentType: string
): Promise<void> {
  const command = new PutObjectCommand({
    Bucket: BUCKET,
    Key: key,
    Body: buffer,
    ContentType: contentType,
  });
  await s3Client.send(command);
}
