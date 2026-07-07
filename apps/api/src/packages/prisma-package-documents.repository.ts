import { Injectable } from '@nestjs/common';

import { PrismaAuditOutboxWriter } from '../audit/prisma-audit-outbox.writer';
import { PrismaService } from '../prisma/prisma.service';
import type { CommandContext } from '../request-context/request-context.types';
import { PackageDocumentStateConflictError } from './package-document.errors';
import { PackageDocumentsRepository } from './package-documents.repository';
import type {
  CompletePackageDocumentRecord,
  CreatePackageDocumentRecord,
  DeletePackageDocumentRecord,
  PackageDocumentRecord,
  PackageDocumentStorageReference,
} from './package-document.types';

type PackageDocumentWithRelations = Awaited<
  ReturnType<PrismaPackageDocumentsRepository['findWithRelations']>
>;

@Injectable()
export class PrismaPackageDocumentsRepository implements PackageDocumentsRepository {
  private readonly auditWriter = new PrismaAuditOutboxWriter();

  constructor(private readonly prismaService: PrismaService) {}

  async createPending(
    input: CreatePackageDocumentRecord,
    context: CommandContext,
  ): Promise<PackageDocumentRecord> {
    const created = await this.prismaService.$transaction(async (tx) => {
      const storedObject = await tx.storedObject.create({
        data: {
          organizationId: input.organizationId,
          createdByEmployeeId: input.createdByEmployeeId,
          bucketName: input.bucketName,
          objectKey: input.objectKey,
          originalFilename: input.originalFilename,
          contentType: input.contentType,
          contentLength: input.contentLength,
        },
      });

      const document = await tx.packageDocument.create({
        data: {
          organizationId: input.organizationId,
          packageId: input.packageId,
          createdByEmployeeId: input.createdByEmployeeId,
          documentType: input.documentType,
          storedObjectId: storedObject.id,
        },
        include: {
          storedObject: true,
          createdByEmployee: {
            select: { id: true, firstName: true, lastName: true },
          },
          deletedByEmployee: {
            select: { id: true, firstName: true, lastName: true },
          },
        },
      });

      const snapshot = this.snapshot(document);
      await this.auditWriter.write(tx, {
        context,
        action: 'package.document.created',
        entityType: 'PACKAGE_DOCUMENT',
        entityId: document.id,
        changedFields: ['document'],
        afterData: snapshot,
        payload: snapshot,
      });

      return document;
    });

    return this.toRecord(created);
  }

  async listByPackage(
    organizationId: string,
    packageId: string,
  ): Promise<PackageDocumentRecord[]> {
    const documents = await this.prismaService.packageDocument.findMany({
      where: {
        organizationId,
        packageId,
        deletedAt: null,
      },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      include: {
        storedObject: true,
        createdByEmployee: {
          select: { id: true, firstName: true, lastName: true },
        },
        deletedByEmployee: {
          select: { id: true, firstName: true, lastName: true },
        },
      },
    });

    return documents.map((document) => this.toRecord(document));
  }

  async findStorageReference(
    organizationId: string,
    packageId: string,
    documentId: string,
  ): Promise<PackageDocumentStorageReference | null> {
    const document = await this.findWithRelations(
      organizationId,
      packageId,
      documentId,
    );

    return document ? this.toStorageReference(document) : null;
  }

  async completeUpload(
    input: CompletePackageDocumentRecord,
    context: CommandContext,
  ): Promise<PackageDocumentRecord | null> {
    return this.prismaService.$transaction(async (tx) => {
      const current = await tx.packageDocument.findFirst({
        where: {
          organizationId: input.organizationId,
          packageId: input.packageId,
          id: input.documentId,
        },
        include: {
          storedObject: true,
          createdByEmployee: {
            select: { id: true, firstName: true, lastName: true },
          },
          deletedByEmployee: {
            select: { id: true, firstName: true, lastName: true },
          },
        },
      });

      if (!current) {
        return null;
      }

      if (current.deletedAt || current.storedObject.status === 'DELETED') {
        throw new PackageDocumentStateConflictError(
          'Package document was already deleted',
        );
      }

      if (current.storedObject.status === 'AVAILABLE' && current.availableAt) {
        return this.toRecord(current);
      }

      if (current.storedObject.status === 'QUARANTINED') {
        throw new PackageDocumentStateConflictError(
          'Package document is quarantined and cannot be completed',
        );
      }

      if (current.storedObject.status !== 'PENDING_UPLOAD') {
        throw new PackageDocumentStateConflictError(
          `Package document cannot transition from ${current.storedObject.status}`,
        );
      }

      const [storedObjectUpdate, documentUpdate] = await Promise.all([
        tx.storedObject.updateMany({
          where: {
            organizationId: input.organizationId,
            id: current.storedObjectId,
            status: 'PENDING_UPLOAD',
            deletedAt: null,
          },
          data: {
            status: 'AVAILABLE',
            etag: input.etag,
            uploadedAt: input.uploadedAt,
          },
        }),
        tx.packageDocument.updateMany({
          where: {
            organizationId: input.organizationId,
            packageId: input.packageId,
            id: input.documentId,
            availableAt: null,
            deletedAt: null,
          },
          data: {
            availableAt: input.uploadedAt,
          },
        }),
      ]);

      if (storedObjectUpdate.count !== 1 || documentUpdate.count !== 1) {
        throw new PackageDocumentStateConflictError(
          'Package document changed during completion',
        );
      }

      const completed = await tx.packageDocument.findFirstOrThrow({
        where: {
          organizationId: input.organizationId,
          packageId: input.packageId,
          id: input.documentId,
        },
        include: {
          storedObject: true,
          createdByEmployee: {
            select: { id: true, firstName: true, lastName: true },
          },
          deletedByEmployee: {
            select: { id: true, firstName: true, lastName: true },
          },
        },
      });

      const snapshot = this.snapshot(completed);
      await this.auditWriter.write(tx, {
        context,
        action: 'package.document.available',
        entityType: 'PACKAGE_DOCUMENT',
        entityId: completed.id,
        changedFields: ['status', 'availableAt'],
        beforeData: { status: 'PENDING_UPLOAD', availableAt: null },
        afterData: snapshot,
        payload: snapshot,
      });

      return this.toRecord(completed);
    });
  }

  async markQuarantined(
    organizationId: string,
    packageId: string,
    documentId: string,
  ): Promise<void> {
    await this.prismaService.storedObject.updateMany({
      where: {
        organizationId,
        packageDocument: {
          is: {
            organizationId,
            packageId,
            id: documentId,
          },
        },
        status: 'PENDING_UPLOAD',
        deletedAt: null,
      },
      data: {
        status: 'QUARANTINED',
      },
    });
  }

  async markDeleted(
    input: DeletePackageDocumentRecord,
    context: CommandContext,
  ): Promise<PackageDocumentRecord | null> {
    return this.prismaService.$transaction(async (tx) => {
      const current = await tx.packageDocument.findFirst({
        where: {
          organizationId: input.organizationId,
          packageId: input.packageId,
          id: input.documentId,
        },
        include: {
          storedObject: true,
          createdByEmployee: {
            select: { id: true, firstName: true, lastName: true },
          },
          deletedByEmployee: {
            select: { id: true, firstName: true, lastName: true },
          },
        },
      });

      if (!current) {
        return null;
      }

      if (current.deletedAt || current.storedObject.status === 'DELETED') {
        return this.toRecord(current);
      }

      const deletedAt = new Date();
      const [storedObjectUpdate, documentUpdate] = await Promise.all([
        tx.storedObject.updateMany({
          where: {
            organizationId: input.organizationId,
            id: current.storedObjectId,
            deletedAt: null,
          },
          data: {
            status: 'DELETED',
            deletedAt,
          },
        }),
        tx.packageDocument.updateMany({
          where: {
            organizationId: input.organizationId,
            packageId: input.packageId,
            id: input.documentId,
            deletedAt: null,
          },
          data: {
            deletedAt,
            deletedByEmployeeId: input.deletedByEmployeeId,
          },
        }),
      ]);

      if (storedObjectUpdate.count !== 1 || documentUpdate.count !== 1) {
        throw new PackageDocumentStateConflictError(
          'Package document changed during deletion',
        );
      }

      const deleted = await tx.packageDocument.findFirstOrThrow({
        where: {
          organizationId: input.organizationId,
          packageId: input.packageId,
          id: input.documentId,
        },
        include: {
          storedObject: true,
          createdByEmployee: {
            select: { id: true, firstName: true, lastName: true },
          },
          deletedByEmployee: {
            select: { id: true, firstName: true, lastName: true },
          },
        },
      });

      const beforeSnapshot = this.snapshot(current);
      const afterSnapshot = this.snapshot(deleted);
      await this.auditWriter.write(tx, {
        context,
        action: 'package.document.deleted',
        entityType: 'PACKAGE_DOCUMENT',
        entityId: deleted.id,
        changedFields: ['status', 'deletedAt'],
        beforeData: beforeSnapshot,
        afterData: afterSnapshot,
        payload: afterSnapshot,
      });

      return this.toRecord(deleted);
    });
  }

  private findWithRelations(
    organizationId: string,
    packageId: string,
    documentId: string,
  ) {
    return this.prismaService.packageDocument.findFirst({
      where: {
        organizationId,
        packageId,
        id: documentId,
      },
      include: {
        storedObject: true,
        createdByEmployee: {
          select: { id: true, firstName: true, lastName: true },
        },
        deletedByEmployee: {
          select: { id: true, firstName: true, lastName: true },
        },
      },
    });
  }

  private snapshot(document: NonNullable<PackageDocumentWithRelations>) {
    return {
      id: document.id,
      packageId: document.packageId,
      documentType: document.documentType,
      status: document.storedObject.status,
      originalFilename: document.storedObject.originalFilename,
      contentType: document.storedObject.contentType,
      contentLength: document.storedObject.contentLength,
      createdAt: document.createdAt.toISOString(),
      availableAt: document.availableAt?.toISOString() ?? null,
      deletedAt: document.deletedAt?.toISOString() ?? null,
    };
  }

  private toRecord(
    document: NonNullable<PackageDocumentWithRelations>,
  ): PackageDocumentRecord {
    return {
      id: document.id,
      packageId: document.packageId,
      documentType: document.documentType,
      status: document.storedObject.status,
      originalFilename: document.storedObject.originalFilename,
      contentType: document.storedObject.contentType,
      contentLength: document.storedObject.contentLength,
      createdBy: {
        id: document.createdByEmployee.id,
        displayName:
          `${document.createdByEmployee.firstName} ${document.createdByEmployee.lastName}`.trim(),
      },
      createdAt: document.createdAt,
      availableAt: document.availableAt,
      deletedAt: document.deletedAt,
    };
  }

  private toStorageReference(
    document: NonNullable<PackageDocumentWithRelations>,
  ): PackageDocumentStorageReference {
    return {
      ...this.toRecord(document),
      organizationId: document.organizationId,
      bucketName: document.storedObject.bucketName,
      objectKey: document.storedObject.objectKey,
      etag: document.storedObject.etag,
    };
  }
}
