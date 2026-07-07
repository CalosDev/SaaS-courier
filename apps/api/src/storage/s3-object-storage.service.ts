import {
  GetObjectCommand,
  HeadObjectCommand,
  NoSuchKey,
  PutObjectCommand,
  S3Client,
  S3ServiceException,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { Injectable } from '@nestjs/common';
import { Readable } from 'node:stream';

import {
  ObjectStorageUnavailableError,
  StoredObjectNotFoundInStorageError,
  StoredObjectReadFailedError,
} from './storage.errors';
import { ObjectStorageService } from './object-storage.service';
import type {
  CreateSignedUploadInput,
  GetStoredObjectInput,
  HeadStoredObjectInput,
  SignedUploadTarget,
  StoredObjectDownload,
  StoredObjectHead,
} from './storage.types';

export interface S3ObjectStorageConfig {
  endpoint: string;
  region: string;
  accessKeyId: string;
  secretAccessKey: string;
  bucketName: string;
  forcePathStyle: boolean;
}

@Injectable()
export class S3ObjectStorageService implements ObjectStorageService {
  private readonly client: S3Client;

  constructor(private readonly config: S3ObjectStorageConfig) {
    if (
      !config.endpoint ||
      !config.region ||
      !config.accessKeyId ||
      !config.secretAccessKey ||
      !config.bucketName
    ) {
      throw new ObjectStorageUnavailableError();
    }

    this.client = new S3Client({
      endpoint: config.endpoint,
      region: config.region,
      forcePathStyle: config.forcePathStyle,
      credentials: {
        accessKeyId: config.accessKeyId,
        secretAccessKey: config.secretAccessKey,
      },
    });
  }

  getDefaultBucketName(): string {
    return this.config.bucketName;
  }

  async createSignedUploadTarget(
    input: CreateSignedUploadInput,
  ): Promise<SignedUploadTarget> {
    const expiresInSeconds = Math.max(60, input.expiresInSeconds);
    const command = new PutObjectCommand({
      Bucket: input.bucketName,
      Key: input.objectKey,
      ContentType: input.contentType,
      ContentLength: input.contentLength,
    });
    const url = await getSignedUrl(this.client, command, {
      expiresIn: expiresInSeconds,
    });

    return {
      method: 'PUT',
      url,
      headers: {
        'Content-Type': input.contentType,
      },
      expiresAt: new Date(Date.now() + expiresInSeconds * 1000),
    };
  }

  async headObject(input: HeadStoredObjectInput): Promise<StoredObjectHead> {
    try {
      const response = await this.client.send(
        new HeadObjectCommand({
          Bucket: input.bucketName,
          Key: input.objectKey,
        }),
      );

      return {
        contentType: response.ContentType ?? null,
        contentLength:
          typeof response.ContentLength === 'number'
            ? response.ContentLength
            : null,
        etag: normalizeEtag(response.ETag),
      };
    } catch (error) {
      throw mapStorageError(error);
    }
  }

  async getObject(input: GetStoredObjectInput): Promise<StoredObjectDownload> {
    try {
      const response = await this.client.send(
        new GetObjectCommand({
          Bucket: input.bucketName,
          Key: input.objectKey,
        }),
      );
      const stream = await toReadable(response.Body);

      return {
        stream,
        contentType: response.ContentType ?? null,
        contentLength:
          typeof response.ContentLength === 'number'
            ? response.ContentLength
            : null,
        etag: normalizeEtag(response.ETag),
      };
    } catch (error) {
      throw mapStorageError(error);
    }
  }
}

function normalizeEtag(value: string | undefined): string | null {
  if (!value) {
    return null;
  }

  return value.replace(/^"+|"+$/g, '');
}

async function toReadable(body: unknown): Promise<Readable> {
  if (body instanceof Readable) {
    return body;
  }

  if (isWebStreamBody(body)) {
    return Readable.from(Buffer.from(await body.transformToByteArray()));
  }

  throw new StoredObjectReadFailedError();
}

function mapStorageError(error: unknown): Error {
  if (error instanceof NoSuchKey) {
    return new StoredObjectNotFoundInStorageError();
  }

  if (
    error instanceof S3ServiceException &&
    error.$metadata.httpStatusCode === 404
  ) {
    return new StoredObjectNotFoundInStorageError();
  }

  if (error instanceof StoredObjectReadFailedError) {
    return error;
  }

  return new StoredObjectReadFailedError();
}

function isWebStreamBody(
  body: unknown,
): body is { transformToByteArray(): Promise<Uint8Array> } {
  return (
    typeof body === 'object' &&
    body !== null &&
    'transformToByteArray' in body &&
    typeof body.transformToByteArray === 'function'
  );
}
