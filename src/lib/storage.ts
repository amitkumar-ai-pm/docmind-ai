import fs from 'fs/promises';
import path from 'path';
import {
  S3Client,
  PutObjectCommand,
  DeleteObjectCommand,
  GetObjectCommand,
} from '@aws-sdk/client-s3';
const UPLOAD_DIR = path.join(process.cwd(), 'uploads');

export type StorageType = 'local' | 's3';

function getStorageType(): StorageType {
  return process.env.STORAGE_TYPE === 's3' ? 's3' : 'local';
}

function getS3Client(): S3Client {
  return new S3Client({
    region: process.env.AWS_REGION ?? 'us-east-1',
    credentials: process.env.AWS_ACCESS_KEY_ID
      ? {
          accessKeyId: process.env.AWS_ACCESS_KEY_ID,
          secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY ?? '',
        }
      : undefined,
  });
}

function getS3Bucket(): string {
  const bucket = process.env.AWS_S3_BUCKET;
  if (!bucket) throw new Error('AWS_S3_BUCKET is required when STORAGE_TYPE=s3');
  return bucket;
}

export async function storeFile(
  userId: string,
  documentId: string,
  filename: string,
  buffer: Buffer
): Promise<string> {
  const storageType = getStorageType();

  if (storageType === 's3') {
    const key = `users/${userId}/${documentId}/${filename}`;
    const client = getS3Client();
    await client.send(
      new PutObjectCommand({
        Bucket: getS3Bucket(),
        Key: key,
        Body: buffer,
      })
    );
    return `s3://${getS3Bucket()}/${key}`;
  }

  const userDir = path.join(UPLOAD_DIR, userId);
  await fs.mkdir(userDir, { recursive: true });
  const filePath = path.join(userDir, `${documentId}-${filename}`);
  await fs.writeFile(filePath, buffer);
  return filePath;
}

export async function deleteStoredFile(storagePath: string | null): Promise<void> {
  if (!storagePath) return;

  if (storagePath.startsWith('s3://')) {
    const withoutScheme = storagePath.slice(5);
    const slashIndex = withoutScheme.indexOf('/');
    const bucket = withoutScheme.slice(0, slashIndex);
    const key = withoutScheme.slice(slashIndex + 1);

    const client = getS3Client();
    await client.send(
      new DeleteObjectCommand({ Bucket: bucket, Key: key })
    );
    return;
  }

  try {
    await fs.unlink(storagePath);
  } catch {
    // File may already be removed
  }
}

export async function readStoredFile(storagePath: string): Promise<Buffer> {
  if (storagePath.startsWith('s3://')) {
    const withoutScheme = storagePath.slice(5);
    const slashIndex = withoutScheme.indexOf('/');
    const bucket = withoutScheme.slice(0, slashIndex);
    const key = withoutScheme.slice(slashIndex + 1);

    const client = getS3Client();
    const response = await client.send(
      new GetObjectCommand({ Bucket: bucket, Key: key })
    );

    if (!response.Body) {
      throw new Error('Empty S3 object');
    }

    return Buffer.from(await response.Body.transformToByteArray());
  }

  return fs.readFile(storagePath);
}
