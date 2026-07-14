import {
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { randomUUID } from 'node:crypto';
import { resolve } from 'node:path';
import { config as loadEnv } from 'dotenv';
import nodemailer from 'nodemailer';

loadEnv({ path: resolve(__dirname, '../../../.env'), quiet: true });

async function main() {
  const endpoint = required('S3_ENDPOINT');
  const region = required('S3_REGION');
  const bucket = required('S3_BUCKET');
  const key = `pilot-smoke/${randomUUID()}.txt`;
  const client = new S3Client({
    endpoint,
    region,
    forcePathStyle: process.env.S3_FORCE_PATH_STYLE === 'true',
    credentials: {
      accessKeyId: required('S3_ACCESS_KEY'),
      secretAccessKey: required('S3_SECRET_KEY'),
    },
  });

  try {
    await client.send(
      new PutObjectCommand({
        Bucket: bucket,
        Key: key,
        Body: 'courier-pilot-smoke',
      }),
    );
    await client.send(new HeadObjectCommand({ Bucket: bucket, Key: key }));
    const stored = await client.send(
      new GetObjectCommand({ Bucket: bucket, Key: key }),
    );
    const body = await stored.Body?.transformToString();
    if (body !== 'courier-pilot-smoke')
      throw new Error('S3 readback mismatch.');
  } finally {
    await client.send(new DeleteObjectCommand({ Bucket: bucket, Key: key }));
  }

  const transporter = nodemailer.createTransport({
    host: required('SMTP_HOST'),
    port: Number.parseInt(process.env.SMTP_PORT || '587', 10),
    secure: process.env.SMTP_SECURE === 'true',
    auth:
      process.env.SMTP_USER && process.env.SMTP_PASSWORD
        ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASSWORD }
        : undefined,
  });
  await transporter.verify();
  await transporter.sendMail({
    from: required('SMTP_FROM'),
    to: 'pilot-smoke@example.invalid',
    subject: 'Courier pilot integration check',
    text: 'S3 and SMTP integration check completed.',
  });

  console.log(
    'Pilot integrations verified: S3 write/read/delete and SMTP send.',
  );
}

function required(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is required.`);
  return value;
}

void main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
