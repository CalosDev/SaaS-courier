abstract class PackageDocumentError extends Error {
  abstract readonly code: string;

  protected constructor(message: string) {
    super(message);
    this.name = new.target.name;
  }
}

export class InvalidPackageDocumentInputError extends PackageDocumentError {
  readonly code = 'PACKAGE_DOCUMENT_INVALID_INPUT';

  constructor(message: string) {
    super(message);
  }
}

export class PackageDocumentNotFoundError extends PackageDocumentError {
  readonly code = 'PACKAGE_DOCUMENT_NOT_FOUND';

  constructor(documentId: string) {
    super(`Package document not found: ${documentId}`);
  }
}

export class PackageDocumentStateConflictError extends PackageDocumentError {
  readonly code = 'PACKAGE_DOCUMENT_STATE_CONFLICT';

  constructor(message: string) {
    super(message);
  }
}

export class PackageDocumentStorageUnavailableError extends PackageDocumentError {
  readonly code = 'PACKAGE_DOCUMENT_STORAGE_UNAVAILABLE';

  constructor() {
    super('Package document storage is unavailable');
  }
}
