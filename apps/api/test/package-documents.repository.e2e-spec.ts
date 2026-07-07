import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { randomUUID } from 'node:crypto';

import { AppModule } from '../src/app.module';
import { PackageDocumentsRepository } from '../src/packages/package-documents.repository';
import { PrismaService } from '../src/prisma/prisma.service';
import type { CommandContext } from '../src/request-context/request-context.types';
import { deleteAuditArtifactsForOrganizations } from './audit-test-cleanup';

const LOCAL_DATABASE_URL =
  'postgresql://courier:courier_dev_password@localhost:5432/courier_saas?schema=public';

describe('Package documents repository integration', () => {
  it('creates, completes, deletes, isolates tenants and rolls back audit/outbox conflicts', async () => {
    let app: INestApplication | null = null;
    let moduleRef: TestingModule | null = null;
    let prismaService: PrismaService | null = null;
    const cleanup = {
      organizationIds: [] as string[],
      userIds: [] as string[],
      employeeIds: [] as string[],
      customerIds: [] as string[],
      packageIds: [] as string[],
      documentIds: [] as string[],
      storedObjectIds: [] as string[],
    };

    try {
      process.env.DATABASE_URL ??= LOCAL_DATABASE_URL;
      process.env.NODE_ENV = 'test';

      moduleRef = await Test.createTestingModule({
        imports: [AppModule],
      }).compile();
      app = moduleRef.createNestApplication();
      await app.init();

      const prisma = moduleRef.get(PrismaService);
      prismaService = prisma;
      const repository = moduleRef.get<PackageDocumentsRepository>(
        PackageDocumentsRepository,
      );
      const suffix = randomUUID();

      const [organization, otherOrganization] = await Promise.all([
        prisma.organization.create({
          data: {
            legalName: `Documents Org ${suffix}`,
            commercialName: `Documents Org ${suffix}`,
            slug: `documents-org-${suffix}`,
            status: 'ACTIVE',
          },
        }),
        prisma.organization.create({
          data: {
            legalName: `Documents Other ${suffix}`,
            commercialName: `Documents Other ${suffix}`,
            slug: `documents-other-${suffix}`,
            status: 'ACTIVE',
          },
        }),
      ]);
      cleanup.organizationIds.push(organization.id, otherOrganization.id);

      await prisma.organizationSettings.createMany({
        data: [
          { organizationId: organization.id },
          { organizationId: otherOrganization.id },
        ],
      });

      const [user, otherUser] = await Promise.all([
        prisma.user.create({
          data: {
            email: `documents.${suffix}@courier.test`,
            status: 'ACTIVE',
          },
        }),
        prisma.user.create({
          data: {
            email: `documents.other.${suffix}@courier.test`,
            status: 'ACTIVE',
          },
        }),
      ]);
      cleanup.userIds.push(user.id, otherUser.id);

      const [employee, otherEmployee] = await Promise.all([
        prisma.employee.create({
          data: {
            organizationId: organization.id,
            userId: user.id,
            firstName: 'Ada',
            lastName: 'Lovelace',
            status: 'ACTIVE',
          },
        }),
        prisma.employee.create({
          data: {
            organizationId: otherOrganization.id,
            userId: otherUser.id,
            firstName: 'Grace',
            lastName: 'Hopper',
            status: 'ACTIVE',
          },
        }),
      ]);
      cleanup.employeeIds.push(employee.id, otherEmployee.id);

      const [customer, otherCustomer] = await Promise.all([
        prisma.customer.create({
          data: {
            organizationId: organization.id,
            customerCode: `DOC-${suffix.slice(0, 8).toUpperCase()}`,
            type: 'INDIVIDUAL',
            firstName: 'Local',
            lastName: 'Customer',
            status: 'ACTIVE',
          },
        }),
        prisma.customer.create({
          data: {
            organizationId: otherOrganization.id,
            customerCode: `DOC-O-${suffix.slice(0, 8).toUpperCase()}`,
            type: 'INDIVIDUAL',
            firstName: 'Other',
            lastName: 'Customer',
            status: 'ACTIVE',
          },
        }),
      ]);
      cleanup.customerIds.push(customer.id, otherCustomer.id);

      const [packageRecord, otherPackage] = await Promise.all([
        prisma.package.create({
          data: {
            organizationId: organization.id,
            customerId: customer.id,
            registeredByEmployeeId: employee.id,
            internalTrackingNumber: buildCode(),
            externalTrackingNumber: `EXT-${suffix}`,
            externalTrackingNumberNormalized:
              `EXT${suffix.replaceAll('-', '')}`.toUpperCase(),
          },
        }),
        prisma.package.create({
          data: {
            organizationId: otherOrganization.id,
            customerId: otherCustomer.id,
            registeredByEmployeeId: otherEmployee.id,
            internalTrackingNumber: buildCode(),
            externalTrackingNumber: `FOREIGN-${suffix}`,
            externalTrackingNumberNormalized:
              `FOREIGN${suffix.replaceAll('-', '')}`.toUpperCase(),
          },
        }),
      ]);
      cleanup.packageIds.push(packageRecord.id, otherPackage.id);

      const createContext = buildContext(organization.id, employee.id, user.id);
      const created = await repository.createPending(
        {
          organizationId: organization.id,
          packageId: packageRecord.id,
          createdByEmployeeId: employee.id,
          documentType: 'INVOICE',
          bucketName: 'documents',
          objectKey: `organizations/${organization.id}/packages/${packageRecord.id}/documents/${randomUUID()}`,
          originalFilename: 'invoice.pdf',
          contentType: 'application/pdf',
          contentLength: 2048,
        },
        createContext,
      );

      cleanup.documentIds.push(created.id);
      const createdRow = await prisma.packageDocument.findUniqueOrThrow({
        where: {
          organizationId_id: {
            organizationId: organization.id,
            id: created.id,
          },
        },
        include: {
          storedObject: true,
        },
      });
      cleanup.storedObjectIds.push(createdRow.storedObjectId);
      expect(created.status).toBe('PENDING_UPLOAD');

      const completed = await repository.completeUpload(
        {
          organizationId: organization.id,
          packageId: packageRecord.id,
          documentId: created.id,
          uploadedAt: new Date('2026-07-07T12:00:00.000Z'),
          etag: 'etag-1',
        },
        buildContext(organization.id, employee.id, user.id, 'request-complete'),
      );

      expect(completed?.status).toBe('AVAILABLE');
      expect(
        await repository.findStorageReference(
          otherOrganization.id,
          otherPackage.id,
          created.id,
        ),
      ).toBeNull();

      const completedAgain = await repository.completeUpload(
        {
          organizationId: organization.id,
          packageId: packageRecord.id,
          documentId: created.id,
          uploadedAt: new Date('2026-07-07T12:05:00.000Z'),
          etag: 'etag-2',
        },
        buildContext(
          organization.id,
          employee.id,
          user.id,
          'request-complete-again',
        ),
      );
      expect(completedAgain?.status).toBe('AVAILABLE');

      const deleted = await repository.markDeleted(
        {
          organizationId: organization.id,
          packageId: packageRecord.id,
          documentId: created.id,
          deletedByEmployeeId: employee.id,
        },
        buildContext(organization.id, employee.id, user.id, 'request-delete'),
      );
      expect(deleted?.status).toBe('DELETED');

      const deletedAgain = await repository.markDeleted(
        {
          organizationId: organization.id,
          packageId: packageRecord.id,
          documentId: created.id,
          deletedByEmployeeId: employee.id,
        },
        buildContext(
          organization.id,
          employee.id,
          user.id,
          'request-delete-again',
        ),
      );
      expect(deletedAgain?.status).toBe('DELETED');

      const rollbackCreated = await repository.createPending(
        {
          organizationId: organization.id,
          packageId: packageRecord.id,
          createdByEmployeeId: employee.id,
          documentType: 'PURCHASE_RECEIPT',
          bucketName: 'documents',
          objectKey: `organizations/${organization.id}/packages/${packageRecord.id}/documents/${randomUUID()}`,
          originalFilename: 'receipt.pdf',
          contentType: 'application/pdf',
          contentLength: 4096,
        },
        buildContext(
          organization.id,
          employee.id,
          user.id,
          'request-create-rollback',
        ),
      );
      cleanup.documentIds.push(rollbackCreated.id);
      const rollbackRow = await prisma.packageDocument.findUniqueOrThrow({
        where: {
          organizationId_id: {
            organizationId: organization.id,
            id: rollbackCreated.id,
          },
        },
        include: {
          storedObject: true,
        },
      });
      cleanup.storedObjectIds.push(rollbackRow.storedObjectId);

      const conflictingContext = buildContext(
        organization.id,
        employee.id,
        user.id,
        'request-conflict',
      );

      await prisma.outboxEvent.create({
        data: {
          id: randomUUID(),
          organizationId: organization.id,
          eventType: 'package.document.available',
          aggregateType: 'PACKAGE_DOCUMENT',
          aggregateId: rollbackCreated.id,
          schemaVersion: 1,
          payload: { conflict: true },
          idempotencyKey: `${conflictingContext.requestId}:package.document.available:PACKAGE_DOCUMENT:${rollbackCreated.id}`,
          status: 'PENDING',
          occurredAt: new Date('2026-07-07T13:00:00.000Z'),
          availableAt: new Date('2026-07-07T13:00:00.000Z'),
        },
      });

      await expect(
        repository.completeUpload(
          {
            organizationId: organization.id,
            packageId: packageRecord.id,
            documentId: rollbackCreated.id,
            uploadedAt: new Date('2026-07-07T13:00:00.000Z'),
            etag: 'etag-conflict',
          },
          conflictingContext,
        ),
      ).rejects.toThrow();

      const rollbackReference = await repository.findStorageReference(
        organization.id,
        packageRecord.id,
        rollbackCreated.id,
      );
      expect(rollbackReference?.status).toBe('PENDING_UPLOAD');
      expect(rollbackReference?.availableAt).toBeNull();
    } finally {
      if (prismaService) {
        await deleteAuditArtifactsForOrganizations(
          prismaService,
          cleanup.organizationIds,
        );
        if (cleanup.organizationIds.length > 0) {
          await prismaService.customerImportRow.deleteMany({
            where: { organizationId: { in: cleanup.organizationIds } },
          });
          await prismaService.customerImportJob.deleteMany({
            where: { organizationId: { in: cleanup.organizationIds } },
          });
          await prismaService.packageDocument.deleteMany({
            where: { organizationId: { in: cleanup.organizationIds } },
          });
          await prismaService.storedObject.deleteMany({
            where: { organizationId: { in: cleanup.organizationIds } },
          });
          await prismaService.packageReception.deleteMany({
            where: { organizationId: { in: cleanup.organizationIds } },
          });
          await prismaService.prealert.deleteMany({
            where: { organizationId: { in: cleanup.organizationIds } },
          });
          await prismaService.employeeFacility.deleteMany({
            where: { organizationId: { in: cleanup.organizationIds } },
          });
          await prismaService.employeeRole.deleteMany({
            where: { organizationId: { in: cleanup.organizationIds } },
          });
          await prismaService.rolePermission.deleteMany({
            where: { organizationId: { in: cleanup.organizationIds } },
          });
          await prismaService.package.deleteMany({
            where: { organizationId: { in: cleanup.organizationIds } },
          });
          await prismaService.customerAddress.deleteMany({
            where: { organizationId: { in: cleanup.organizationIds } },
          });
          await prismaService.customerCustomsProfile.deleteMany({
            where: { organizationId: { in: cleanup.organizationIds } },
          });
          await prismaService.customer.deleteMany({
            where: { organizationId: { in: cleanup.organizationIds } },
          });
          await prismaService.role.deleteMany({
            where: { organizationId: { in: cleanup.organizationIds } },
          });
          await prismaService.facility.deleteMany({
            where: { organizationId: { in: cleanup.organizationIds } },
          });
          await prismaService.employee.deleteMany({
            where: { organizationId: { in: cleanup.organizationIds } },
          });
          await prismaService.organizationSettings.deleteMany({
            where: { organizationId: { in: cleanup.organizationIds } },
          });
          await prismaService.organization.deleteMany({
            where: { id: { in: cleanup.organizationIds } },
          });
        }
        if (cleanup.userIds.length > 0) {
          await prismaService.loginChallenge.deleteMany({
            where: { userId: { in: cleanup.userIds } },
          });
          await prismaService.userActivationToken.deleteMany({
            where: { userId: { in: cleanup.userIds } },
          });
          await prismaService.user.deleteMany({
            where: { id: { in: cleanup.userIds } },
          });
        }
      }

      if (app) {
        await app.close();
      }

      if (moduleRef) {
        await moduleRef.close();
      }
    }
  }, 120000);
});

function buildContext(
  organizationId: string,
  employeeId: string,
  userId: string,
  correlationLabel: string = randomUUID(),
): CommandContext {
  const requestId = randomUUID();

  return {
    organizationId,
    actorType: 'EMPLOYEE',
    actorUserId: userId,
    actorEmployeeId: employeeId,
    source: 'HTTP',
    requestId,
    correlationId: `corr-${correlationLabel}`,
    ipAddress: '127.0.0.1',
    userAgent: 'jest',
  };
}

function buildCode(): string {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let value = 'PK';

  while (value.length < 14) {
    value += alphabet[Math.floor(Math.random() * alphabet.length)];
  }

  return value;
}
