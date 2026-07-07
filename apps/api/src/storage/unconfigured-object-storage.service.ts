import { Injectable } from '@nestjs/common';

import { ObjectStorageUnavailableError } from './storage.errors';
import { ObjectStorageService } from './object-storage.service';
import type {
  CreateSignedUploadInput,
  GetStoredObjectInput,
  HeadStoredObjectInput,
  SignedUploadTarget,
  StoredObjectDownload,
  StoredObjectHead,
} from './storage.types';

@Injectable()
export class UnconfiguredObjectStorageService implements ObjectStorageService {
  getDefaultBucketName(): string {
    throw new ObjectStorageUnavailableError();
  }

  createSignedUploadTarget(
    input: CreateSignedUploadInput,
  ): Promise<SignedUploadTarget> {
    void input;
    throw new ObjectStorageUnavailableError();
  }

  headObject(input: HeadStoredObjectInput): Promise<StoredObjectHead> {
    void input;
    throw new ObjectStorageUnavailableError();
  }

  getObject(input: GetStoredObjectInput): Promise<StoredObjectDownload> {
    void input;
    throw new ObjectStorageUnavailableError();
  }
}
