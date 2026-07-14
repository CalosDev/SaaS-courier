import { Inject, Injectable } from '@nestjs/common';
import { createHash, randomUUID } from 'node:crypto';
import { basename } from 'node:path';

import {
  ObjectStorageUnavailableError,
  StoredObjectNotFoundInStorageError,
  StoredObjectReadFailedError,
} from '../storage/storage.errors';
import { ObjectStorageService } from '../storage/object-storage.service';
import type { CommandContext } from '../request-context/request-context.types';
import { PackagesService } from './packages.service';
import {
  InvalidPackageDocumentInputError,
  PackageDocumentNotFoundError,
  PackageDocumentStateConflictError,
  PackageDocumentStorageUnavailableError,
} from './package-document.errors';
import { PackageDocumentsRepository } from './package-documents.repository';
import { PackageDocumentScanner } from './package-document-scanner';
import {
  PACKAGE_DOCUMENT_TYPE_VALUES,
  type CreatePackageDocumentUploadIntentInput,
  type PackageDocumentDownloadResult,
  type PackageDocumentRecord,
  type PackageDocumentStorageReference,
  type PackageDocumentType,
} from './package-document.types';

const SIGNED_UPLOAD_EXPIRATION_SECONDS = 15 * 60;
const MAX_IMAGE_BYTES = 15 * 1024 * 1024;
const MAX_DOCUMENT_BYTES = 10 * 1024 * 1024;

const IMAGE_CONTENT_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);
const DOCUMENT_CONTENT_TYPES = new Set([
  ...IMAGE_CONTENT_TYPES,
  'application/pdf',
]);

@Injectable()
export class PackageDocumentsService {
  constructor(
    private readonly packagesService: PackagesService,
    @Inject(PackageDocumentsRepository)
    private readonly repository: PackageDocumentsRepository,
    @Inject(ObjectStorageService)
    private readonly storageService: ObjectStorageService,
    private readonly scanner: PackageDocumentScanner,
  ) {}

  async createUploadIntent(
    organizationId: string,
    packageId: string,
    input: CreatePackageDocumentUploadIntentInput,
    context?: CommandContext,
  ) {
    const normalizedOrganizationId = this.requiredText(
      organizationId,
      'organizationId',
    );
    const normalizedPackageId = this.requiredText(packageId, 'packageId');
    const commandContext = this.commandContext(
      context,
      normalizedOrganizationId,
    );
    const documentType = this.documentType(input.documentType);
    const originalFilename = this.fileName(input.fileName);
    const contentType = this.contentType(input.contentType);
    const contentLength = this.contentLength(
      input.contentLength,
      documentType,
      contentType,
    );

    await this.packagesService.getById(
      normalizedOrganizationId,
      normalizedPackageId,
    );

    const bucketName = this.defaultBucketName();
    const objectKey = this.objectKey(
      normalizedOrganizationId,
      normalizedPackageId,
    );
    const document = await this.repository.createPending(
      {
        organizationId: normalizedOrganizationId,
        packageId: normalizedPackageId,
        createdByEmployeeId: this.requiredText(
          commandContext.actorEmployeeId,
          'actorEmployeeId',
        ),
        documentType,
        bucketName,
        objectKey,
        originalFilename,
        contentType,
        contentLength,
      },
      commandContext,
    );

    const upload = await this.createSignedUploadTarget(
      bucketName,
      objectKey,
      contentType,
      contentLength,
    );

    return {
      document,
      upload,
    };
  }

  async complete(
    organizationId: string,
    packageId: string,
    documentId: string,
    context?: CommandContext,
  ): Promise<PackageDocumentRecord> {
    const normalizedOrganizationId = this.requiredText(
      organizationId,
      'organizationId',
    );
    const normalizedPackageId = this.requiredText(packageId, 'packageId');
    const normalizedDocumentId = this.requiredText(documentId, 'documentId');
    const commandContext = this.commandContext(
      context,
      normalizedOrganizationId,
    );

    await this.packagesService.getById(
      normalizedOrganizationId,
      normalizedPackageId,
    );

    const reference = await this.loadReference(
      normalizedOrganizationId,
      normalizedPackageId,
      normalizedDocumentId,
    );

    if (reference.status === 'AVAILABLE') {
      return reference;
    }

    if (reference.status === 'DELETED') {
      throw new PackageDocumentStateConflictError(
        'Package document was already deleted',
      );
    }

    if (reference.status === 'QUARANTINED') {
      throw new PackageDocumentStateConflictError(
        'Package document is quarantined and cannot be completed',
      );
    }

    try {
      const objectHead = await this.storageService.headObject({
        bucketName: reference.bucketName,
        objectKey: reference.objectKey,
      });

      await this.assertCompletedObject(reference, objectHead, commandContext);
      const object = await this.storageService.getObject({
        bucketName: reference.bucketName,
        objectKey: reference.objectKey,
      });
      const scanResult = await this.scanner.scan({
        contentType: reference.contentType,
        contentLength: reference.contentLength,
        stream: object.stream,
      });
      if (!scanResult.safe) {
        await this.repository.markQuarantined(
          reference.organizationId,
          reference.packageId,
          reference.id,
          commandContext,
        );
        throw new PackageDocumentStateConflictError(
          'Package document failed security validation',
        );
      }

      const completed = await this.repository.completeUpload(
        {
          organizationId: normalizedOrganizationId,
          packageId: normalizedPackageId,
          documentId: normalizedDocumentId,
          uploadedAt: new Date(),
          etag: objectHead.etag,
        },
        commandContext,
      );

      if (!completed) {
        throw new PackageDocumentNotFoundError(normalizedDocumentId);
      }

      return completed;
    } catch (error) {
      if (error instanceof StoredObjectNotFoundInStorageError) {
        throw new PackageDocumentStateConflictError(
          'Package document upload is still pending',
        );
      }

      if (error instanceof ObjectStorageUnavailableError) {
        throw new PackageDocumentStorageUnavailableError();
      }

      if (error instanceof StoredObjectReadFailedError) {
        throw new PackageDocumentStorageUnavailableError();
      }

      throw error;
    }
  }

  async list(
    organizationId: string,
    packageId: string,
  ): Promise<PackageDocumentRecord[]> {
    const normalizedOrganizationId = this.requiredText(
      organizationId,
      'organizationId',
    );
    const normalizedPackageId = this.requiredText(packageId, 'packageId');

    await this.packagesService.getById(
      normalizedOrganizationId,
      normalizedPackageId,
    );

    return this.repository.listByPackage(
      normalizedOrganizationId,
      normalizedPackageId,
    );
  }

  async download(
    organizationId: string,
    packageId: string,
    documentId: string,
  ): Promise<PackageDocumentDownloadResult> {
    const normalizedOrganizationId = this.requiredText(
      organizationId,
      'organizationId',
    );
    const normalizedPackageId = this.requiredText(packageId, 'packageId');
    const normalizedDocumentId = this.requiredText(documentId, 'documentId');

    await this.packagesService.getById(
      normalizedOrganizationId,
      normalizedPackageId,
    );

    const reference = await this.loadReference(
      normalizedOrganizationId,
      normalizedPackageId,
      normalizedDocumentId,
    );

    if (reference.status !== 'AVAILABLE' || reference.deletedAt !== null) {
      throw new PackageDocumentStateConflictError(
        'Package document is not available for download',
      );
    }

    try {
      const download = await this.storageService.getObject({
        bucketName: reference.bucketName,
        objectKey: reference.objectKey,
      });

      return {
        document: reference,
        stream: download.stream,
        contentType: download.contentType ?? reference.contentType,
        contentLength: download.contentLength ?? reference.contentLength,
      };
    } catch (error) {
      if (error instanceof StoredObjectNotFoundInStorageError) {
        throw new PackageDocumentStateConflictError(
          'Package document is not available for download',
        );
      }

      if (error instanceof ObjectStorageUnavailableError) {
        throw new PackageDocumentStorageUnavailableError();
      }

      throw error;
    }
  }

  async delete(
    organizationId: string,
    packageId: string,
    documentId: string,
    context?: CommandContext,
  ): Promise<PackageDocumentRecord> {
    const normalizedOrganizationId = this.requiredText(
      organizationId,
      'organizationId',
    );
    const normalizedPackageId = this.requiredText(packageId, 'packageId');
    const normalizedDocumentId = this.requiredText(documentId, 'documentId');
    const commandContext = this.commandContext(
      context,
      normalizedOrganizationId,
    );

    await this.packagesService.getById(
      normalizedOrganizationId,
      normalizedPackageId,
    );

    const reference = await this.loadReference(
      normalizedOrganizationId,
      normalizedPackageId,
      normalizedDocumentId,
    );

    try {
      await this.storageService.deleteObject({
        bucketName: reference.bucketName,
        objectKey: reference.objectKey,
      });
    } catch (error) {
      if (
        error instanceof ObjectStorageUnavailableError ||
        error instanceof StoredObjectReadFailedError
      ) {
        throw new PackageDocumentStorageUnavailableError();
      }
      throw error;
    }

    const deleted = await this.repository.markDeleted(
      {
        organizationId: normalizedOrganizationId,
        packageId: normalizedPackageId,
        documentId: normalizedDocumentId,
        deletedByEmployeeId: this.requiredText(
          commandContext.actorEmployeeId,
          'actorEmployeeId',
        ),
      },
      commandContext,
    );

    if (!deleted) {
      throw new PackageDocumentNotFoundError(normalizedDocumentId);
    }

    return deleted;
  }

  private async loadReference(
    organizationId: string,
    packageId: string,
    documentId: string,
  ): Promise<PackageDocumentStorageReference> {
    const reference = await this.repository.findStorageReference(
      organizationId,
      packageId,
      documentId,
    );

    if (!reference) {
      throw new PackageDocumentNotFoundError(documentId);
    }

    return reference;
  }

  private async assertCompletedObject(
    reference: PackageDocumentStorageReference,
    head: { contentType: string | null; contentLength: number | null },
    commandContext: CommandContext,
  ): Promise<void> {
    if (
      head.contentType !== reference.contentType ||
      head.contentLength !== reference.contentLength
    ) {
      await this.repository.markQuarantined(
        reference.organizationId,
        reference.packageId,
        reference.id,
        commandContext,
      );
      throw new PackageDocumentStateConflictError(
        'Uploaded object metadata did not match the signed upload intent',
      );
    }
  }

  private createSignedUploadTarget(
    bucketName: string,
    objectKey: string,
    contentType: string,
    contentLength: number,
  ) {
    return this.storageService.createSignedUploadTarget({
      bucketName,
      objectKey,
      contentType,
      contentLength,
      expiresInSeconds: SIGNED_UPLOAD_EXPIRATION_SECONDS,
    });
  }

  private defaultBucketName(): string {
    try {
      return this.storageService.getDefaultBucketName();
    } catch (error) {
      if (error instanceof ObjectStorageUnavailableError) {
        throw new PackageDocumentStorageUnavailableError();
      }

      throw error;
    }
  }

  private objectKey(organizationId: string, packageId: string): string {
    return [
      'package-documents',
      opaqueScopeSegment(organizationId),
      opaqueScopeSegment(packageId),
      randomUUID(),
    ].join('/');
  }

  private fileName(value: string): string {
    const normalized = Array.from(
      basename(this.requiredText(value, 'fileName')),
    )
      .filter((character) => {
        const codePoint = character.codePointAt(0) ?? 0;
        return codePoint >= 0x20 && codePoint !== 0x7f;
      })
      .join('')
      .trim();

    if (!normalized) {
      throw new InvalidPackageDocumentInputError(
        'Invalid package document input: fileName is required',
      );
    }

    if (normalized.length > 255) {
      throw new InvalidPackageDocumentInputError(
        'Invalid package document input: fileName is too long',
      );
    }

    return normalized;
  }

  private contentType(value: string): string {
    const normalized = this.requiredText(value, 'contentType').toLowerCase();

    if (normalized.length > 120) {
      throw new InvalidPackageDocumentInputError(
        'Invalid package document input: contentType is invalid',
      );
    }

    return normalized;
  }

  private contentLength(
    value: number,
    documentType: PackageDocumentType,
    contentType: string,
  ): number {
    if (!Number.isInteger(value) || value < 1) {
      throw new InvalidPackageDocumentInputError(
        'Invalid package document input: contentLength is invalid',
      );
    }

    const policy = documentPolicy(documentType);

    if (!policy.allowedContentTypes.has(contentType)) {
      throw new InvalidPackageDocumentInputError(
        'Invalid package document input: contentType is not allowed for this document type',
      );
    }

    if (value > policy.maxBytes) {
      throw new InvalidPackageDocumentInputError(
        'Invalid package document input: contentLength exceeds the allowed size',
      );
    }

    return value;
  }

  private documentType(value: PackageDocumentType): PackageDocumentType {
    if (!(PACKAGE_DOCUMENT_TYPE_VALUES as readonly string[]).includes(value)) {
      throw new InvalidPackageDocumentInputError(
        'Invalid package document input: documentType is invalid',
      );
    }

    return value;
  }

  private requiredText(
    value: string | null | undefined,
    field: string,
  ): string {
    const normalized = typeof value === 'string' ? value.trim() : '';

    if (!normalized) {
      throw new InvalidPackageDocumentInputError(
        `Invalid package document input: ${field} is required`,
      );
    }

    return normalized;
  }

  private commandContext(
    context: CommandContext | undefined,
    organizationId: string,
  ): CommandContext {
    this.requiredText(context?.actorEmployeeId, 'actorEmployeeId');

    if (context?.organizationId !== organizationId) {
      throw new InvalidPackageDocumentInputError(
        'Invalid package document input: command context organization mismatch',
      );
    }

    return context;
  }
}

function opaqueScopeSegment(value: string): string {
  return createHash('sha256').update(value).digest('hex').slice(0, 24);
}

function documentPolicy(documentType: PackageDocumentType): {
  allowedContentTypes: Set<string>;
  maxBytes: number;
} {
  switch (documentType) {
    case 'PACKAGE_PHOTO':
    case 'DAMAGE_PHOTO':
      return {
        allowedContentTypes: IMAGE_CONTENT_TYPES,
        maxBytes: MAX_IMAGE_BYTES,
      };
    case 'INVOICE':
    case 'PURCHASE_RECEIPT':
    case 'IDENTITY_SUPPORT':
    case 'OTHER':
      return {
        allowedContentTypes: DOCUMENT_CONTENT_TYPES,
        maxBytes: MAX_DOCUMENT_BYTES,
      };
    default: {
      throw new InvalidPackageDocumentInputError(
        'Invalid package document input: documentType is invalid',
      );
    }
  }
}
