import type { Readable } from 'node:stream';

export interface CreateSignedUploadInput {
  bucketName: string;
  objectKey: string;
  contentType: string;
  contentLength: number;
  expiresInSeconds: number;
}

export interface SignedUploadTarget {
  method: 'PUT';
  url: string;
  headers: Record<string, string>;
  expiresAt: Date;
}

export interface HeadStoredObjectInput {
  bucketName: string;
  objectKey: string;
}

export interface StoredObjectHead {
  contentType: string | null;
  contentLength: number | null;
  etag: string | null;
}

export interface GetStoredObjectInput {
  bucketName: string;
  objectKey: string;
}

export interface DeleteStoredObjectInput {
  bucketName: string;
  objectKey: string;
}

export interface StoredObjectDownload {
  stream: Readable;
  contentType: string | null;
  contentLength: number | null;
  etag: string | null;
}
