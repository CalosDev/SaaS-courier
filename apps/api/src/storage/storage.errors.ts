abstract class StorageError extends Error {
  abstract readonly code: string;

  protected constructor(message: string) {
    super(message);
    this.name = new.target.name;
  }
}

export class ObjectStorageUnavailableError extends StorageError {
  readonly code = 'OBJECT_STORAGE_UNAVAILABLE';

  constructor() {
    super('Object storage is not configured');
  }
}

export class StoredObjectNotFoundInStorageError extends StorageError {
  readonly code = 'STORED_OBJECT_NOT_FOUND_IN_STORAGE';

  constructor() {
    super('Stored object was not found in object storage');
  }
}

export class StoredObjectReadFailedError extends StorageError {
  readonly code = 'STORED_OBJECT_READ_FAILED';

  constructor() {
    super('Stored object could not be read from object storage');
  }
}
