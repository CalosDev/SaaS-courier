import { Readable } from 'node:stream';

import {
  ObjectStorageUnavailableError,
  StoredObjectNotFoundInStorageError,
} from '../storage/storage.errors';
import { ObjectStorageService } from '../storage/object-storage.service';
import { PackagesService } from './packages.service';
import {
  InvalidPackageDocumentInputError,
  PackageDocumentStateConflictError,
  PackageDocumentStorageUnavailableError,
} from './package-document.errors';
import { PackageDocumentsRepository } from './package-documents.repository';
import { PackageDocumentsService } from './package-documents.service';
import { PackageDocumentScanner } from './package-document-scanner';

function buildReference(
  status: 'PENDING_UPLOAD' | 'AVAILABLE' | 'QUARANTINED' | 'DELETED',
) {
  return {
    id: 'document-1',
    organizationId: 'org-1',
    packageId: 'package-1',
    documentType: 'INVOICE' as const,
    status,
    originalFilename: 'invoice.pdf',
    contentType: 'application/pdf',
    contentLength: 1024,
    createdBy: {
      id: 'employee-1',
      displayName: 'Ada Lovelace',
    },
    bucketName: 'documents',
    objectKey: 'package-documents/opaque-org/opaque-package/object-1',
    etag: null,
    createdAt: new Date('2026-07-07T10:00:00.000Z'),
    availableAt:
      status === 'AVAILABLE' ? new Date('2026-07-07T10:05:00.000Z') : null,
    deletedAt:
      status === 'DELETED' ? new Date('2026-07-07T10:06:00.000Z') : null,
  };
}

describe('PackageDocumentsService', () => {
  const getByIdMock = jest.fn();
  const createPendingMock = jest.fn();
  const listByPackageMock = jest.fn();
  const findStorageReferenceMock = jest.fn();
  const completeUploadMock = jest.fn();
  const markQuarantinedMock = jest.fn();
  const markDeletedMock = jest.fn();
  const getDefaultBucketNameMock = jest.fn();
  const createSignedUploadTargetMock = jest.fn();
  const headObjectMock = jest.fn();
  const getObjectMock = jest.fn();
  const deleteObjectMock = jest.fn();
  const scanMock = jest.fn();

  const packagesService = {
    getById: getByIdMock,
  } as unknown as PackagesService;
  const repository = {
    createPending: createPendingMock,
    listByPackage: listByPackageMock,
    findStorageReference: findStorageReferenceMock,
    completeUpload: completeUploadMock,
    markQuarantined: markQuarantinedMock,
    markDeleted: markDeletedMock,
  } as unknown as PackageDocumentsRepository;
  const storageService = {
    getDefaultBucketName: getDefaultBucketNameMock,
    createSignedUploadTarget: createSignedUploadTargetMock,
    headObject: headObjectMock,
    getObject: getObjectMock,
    deleteObject: deleteObjectMock,
  } as unknown as ObjectStorageService;
  const scanner = { scan: scanMock } as unknown as PackageDocumentScanner;

  const service = new PackageDocumentsService(
    packagesService,
    repository,
    storageService,
    scanner,
  );

  const context = {
    organizationId: 'org-1',
    actorType: 'EMPLOYEE' as const,
    actorUserId: 'user-1',
    actorEmployeeId: 'employee-1',
    source: 'HTTP' as const,
    requestId: '11111111-1111-4111-8111-111111111111',
    correlationId: 'corr-1',
    ipAddress: '127.0.0.1',
    userAgent: 'jest',
  };

  beforeEach(() => {
    jest.resetAllMocks();
    getByIdMock.mockResolvedValue({ id: 'package-1' });
    createPendingMock.mockResolvedValue({
      id: 'document-1',
      packageId: 'package-1',
      documentType: 'INVOICE',
      status: 'PENDING_UPLOAD',
      originalFilename: 'invoice.pdf',
      contentType: 'application/pdf',
      contentLength: 1024,
      createdBy: {
        id: 'employee-1',
        displayName: 'Ada Lovelace',
      },
      createdAt: new Date('2026-07-07T10:00:00.000Z'),
      availableAt: null,
      deletedAt: null,
    });
    getDefaultBucketNameMock.mockReturnValue('documents');
    createSignedUploadTargetMock.mockResolvedValue({
      method: 'PUT',
      url: 'https://storage.example/upload/document-1',
      headers: { 'Content-Type': 'application/pdf' },
      expiresAt: new Date('2026-07-07T10:15:00.000Z'),
    });
    markQuarantinedMock.mockResolvedValue(undefined);
    listByPackageMock.mockResolvedValue([]);
    getObjectMock.mockResolvedValue({
      stream: Readable.from(Buffer.alloc(1024)),
      contentType: 'application/pdf',
      contentLength: 1024,
      etag: 'etag-1',
    });
    scanMock.mockResolvedValue({ safe: true });
    deleteObjectMock.mockResolvedValue(undefined);
  });

  it('creates upload intents with sanitized payload and signed upload target', async () => {
    const result = await service.createUploadIntent(
      'org-1',
      'package-1',
      {
        documentType: 'INVOICE',
        fileName: 'C:\\Users\\Ada\\invoice.pdf',
        contentType: 'application/pdf',
        contentLength: 1024,
      },
      context,
    );

    expect(createPendingMock).toHaveBeenCalledWith(
      expect.objectContaining({
        organizationId: 'org-1',
        packageId: 'package-1',
        createdByEmployeeId: 'employee-1',
        documentType: 'INVOICE',
        bucketName: 'documents',
        originalFilename: 'invoice.pdf',
        contentType: 'application/pdf',
        contentLength: 1024,
      }),
      context,
    );
    expect(result.upload.url).toContain('storage.example');
  });

  it('rejects invalid MIME by document type', async () => {
    await expect(
      service.createUploadIntent(
        'org-1',
        'package-1',
        {
          documentType: 'PACKAGE_PHOTO',
          fileName: 'invoice.pdf',
          contentType: 'application/pdf',
          contentLength: 1024,
        },
        context,
      ),
    ).rejects.toBeInstanceOf(InvalidPackageDocumentInputError);
  });

  it('completes documents after verifying object metadata', async () => {
    findStorageReferenceMock.mockResolvedValue(
      buildReference('PENDING_UPLOAD'),
    );
    headObjectMock.mockResolvedValue({
      contentType: 'application/pdf',
      contentLength: 1024,
      etag: 'etag-1',
    });
    completeUploadMock.mockResolvedValue({
      ...buildReference('AVAILABLE'),
      status: 'AVAILABLE',
    });

    const result = await service.complete(
      'org-1',
      'package-1',
      'document-1',
      context,
    );
    expect(completeUploadMock).toHaveBeenCalledWith(
      expect.objectContaining({
        organizationId: 'org-1',
        packageId: 'package-1',
        documentId: 'document-1',
        etag: 'etag-1',
      }),
      context,
    );
    expect(result.status).toBe('AVAILABLE');
  });

  it('quarantines metadata mismatches during completion', async () => {
    findStorageReferenceMock.mockResolvedValue(
      buildReference('PENDING_UPLOAD'),
    );
    headObjectMock.mockResolvedValue({
      contentType: 'image/png',
      contentLength: 1024,
      etag: 'etag-1',
    });

    await expect(
      service.complete('org-1', 'package-1', 'document-1', context),
    ).rejects.toBeInstanceOf(PackageDocumentStateConflictError);
    expect(markQuarantinedMock).toHaveBeenCalledWith(
      'org-1',
      'package-1',
      'document-1',
      context,
    );
  });

  it('quarantines files rejected by content scanning', async () => {
    findStorageReferenceMock.mockResolvedValue(
      buildReference('PENDING_UPLOAD'),
    );
    headObjectMock.mockResolvedValue({
      contentType: 'application/pdf',
      contentLength: 1024,
      etag: 'etag-1',
    });
    scanMock.mockResolvedValue({ safe: false, reason: 'INVALID_SIGNATURE' });

    await expect(
      service.complete('org-1', 'package-1', 'document-1', context),
    ).rejects.toBeInstanceOf(PackageDocumentStateConflictError);
    expect(markQuarantinedMock).toHaveBeenCalledWith(
      'org-1',
      'package-1',
      'document-1',
      context,
    );
    expect(completeUploadMock).not.toHaveBeenCalled();
  });

  it('maps missing uploads to a retryable conflict', async () => {
    findStorageReferenceMock.mockResolvedValue(
      buildReference('PENDING_UPLOAD'),
    );
    headObjectMock.mockRejectedValue(new StoredObjectNotFoundInStorageError());

    await expect(
      service.complete('org-1', 'package-1', 'document-1', context),
    ).rejects.toBeInstanceOf(PackageDocumentStateConflictError);
  });

  it('maps storage unavailability to a service-level error', async () => {
    getDefaultBucketNameMock.mockImplementation(() => {
      throw new ObjectStorageUnavailableError();
    });

    await expect(
      service.createUploadIntent(
        'org-1',
        'package-1',
        {
          documentType: 'INVOICE',
          fileName: 'invoice.pdf',
          contentType: 'application/pdf',
          contentLength: 1024,
        },
        context,
      ),
    ).rejects.toBeInstanceOf(PackageDocumentStorageUnavailableError);
  });

  it('streams downloads for available documents only', async () => {
    findStorageReferenceMock.mockResolvedValue(buildReference('AVAILABLE'));
    getObjectMock.mockResolvedValue({
      stream: Readable.from(['ok']),
      contentType: 'application/pdf',
      contentLength: 1024,
      etag: 'etag-1',
    });

    const result = await service.download('org-1', 'package-1', 'document-1');

    expect(result.contentType).toBe('application/pdf');
    expect(result.document.id).toBe('document-1');
  });

  it('physically deletes the object before marking the record deleted', async () => {
    findStorageReferenceMock.mockResolvedValue(buildReference('AVAILABLE'));
    markDeletedMock.mockResolvedValue(buildReference('DELETED'));

    await service.delete('org-1', 'package-1', 'document-1', context);

    expect(deleteObjectMock).toHaveBeenCalledWith({
      bucketName: 'documents',
      objectKey: 'package-documents/opaque-org/opaque-package/object-1',
    });
    expect(deleteObjectMock.mock.invocationCallOrder[0]).toBeLessThan(
      markDeletedMock.mock.invocationCallOrder[0],
    );
  });
});
