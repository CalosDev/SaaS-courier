import type {
  CreateSignedUploadInput,
  GetStoredObjectInput,
  HeadStoredObjectInput,
  SignedUploadTarget,
  StoredObjectDownload,
  StoredObjectHead,
} from './storage.types';

export abstract class ObjectStorageService {
  abstract getDefaultBucketName(): string;

  abstract createSignedUploadTarget(
    input: CreateSignedUploadInput,
  ): Promise<SignedUploadTarget>;

  abstract headObject(input: HeadStoredObjectInput): Promise<StoredObjectHead>;

  abstract getObject(
    input: GetStoredObjectInput,
  ): Promise<StoredObjectDownload>;
}
