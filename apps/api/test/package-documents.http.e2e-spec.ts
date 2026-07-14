import type { NestExpressApplication } from '@nestjs/platform-express';
import { Test, type TestingModule } from '@nestjs/testing';
import { randomUUID } from 'node:crypto';
import { Readable } from 'node:stream';
import request from 'supertest';

import { PasswordHasher } from '../src/accounts/password-hasher';
import { AppModule } from '../src/app.module';
import { AuthCookieService } from '../src/auth/http/auth-cookie.service';
import { configureHttpApp } from '../src/http/configure-http-app';
import { PrismaService } from '../src/prisma/prisma.service';
import { RbacService } from '../src/rbac/rbac.service';
import { SessionsService } from '../src/sessions/sessions.service';
import { StoredObjectNotFoundInStorageError } from '../src/storage/storage.errors';
import { ObjectStorageService } from '../src/storage/object-storage.service';
import type {
  CreateSignedUploadInput,
  DeleteStoredObjectInput,
  GetStoredObjectInput,
  HeadStoredObjectInput,
  SignedUploadTarget,
  StoredObjectDownload,
  StoredObjectHead,
} from '../src/storage/storage.types';
import { deleteAuditArtifactsForOrganizations } from './audit-test-cleanup';

const LOCAL_DATABASE_URL =
  'postgresql://courier:courier_dev_password@localhost:5432/courier_saas?schema=public';
const ALLOWED_ORIGIN = 'http://localhost:3000';

function extractCookiePair(
  cookies: string | string[] | undefined,
  cookieName: string,
): string {
  const normalizedCookies = Array.isArray(cookies)
    ? cookies
    : typeof cookies === 'string'
      ? [cookies]
      : [];
  const cookie = normalizedCookies.find((entry) =>
    entry.startsWith(`${cookieName}=`),
  );

  if (!cookie) {
    throw new Error(`Missing cookie ${cookieName}`);
  }

  return cookie.split(';')[0];
}

class FakeObjectStorageService implements ObjectStorageService {
  private readonly objects = new Map<
    string,
    { contentType: string; contentLength: number; body: Buffer; etag: string }
  >();

  checkHealth(): Promise<boolean> {
    return Promise.resolve(true);
  }

  getDefaultBucketName(): string {
    return 'documents';
  }

  createSignedUploadTarget(
    input: CreateSignedUploadInput,
  ): Promise<SignedUploadTarget> {
    return Promise.resolve({
      method: 'PUT',
      url: `https://storage.example/upload/${encodeURIComponent(input.objectKey)}`,
      headers: {
        'Content-Type': input.contentType,
      },
      expiresAt: new Date('2026-07-07T15:00:00.000Z'),
    });
  }

  headObject(input: HeadStoredObjectInput): Promise<StoredObjectHead> {
    const object = this.objects.get(
      this.mapKey(input.bucketName, input.objectKey),
    );

    if (!object) {
      throw new StoredObjectNotFoundInStorageError();
    }

    return Promise.resolve({
      contentType: object.contentType,
      contentLength: object.contentLength,
      etag: object.etag,
    });
  }

  getObject(input: GetStoredObjectInput): Promise<StoredObjectDownload> {
    const object = this.objects.get(
      this.mapKey(input.bucketName, input.objectKey),
    );

    if (!object) {
      throw new StoredObjectNotFoundInStorageError();
    }

    return Promise.resolve({
      stream: Readable.from(object.body),
      contentType: object.contentType,
      contentLength: object.contentLength,
      etag: object.etag,
    });
  }

  deleteObject(input: DeleteStoredObjectInput): Promise<void> {
    this.objects.delete(this.mapKey(input.bucketName, input.objectKey));
    return Promise.resolve();
  }

  hasObject(bucketName: string, objectKey: string): boolean {
    return this.objects.has(this.mapKey(bucketName, objectKey));
  }

  putObject(
    bucketName: string,
    objectKey: string,
    contentType: string,
    body: Buffer,
  ): void {
    this.objects.set(this.mapKey(bucketName, objectKey), {
      contentType,
      contentLength: body.length,
      body,
      etag: `etag-${body.length}`,
    });
  }

  private mapKey(bucketName: string, objectKey: string): string {
    return `${bucketName}:${objectKey}`;
  }
}

describe('Package documents HTTP', () => {
  let app: NestExpressApplication | null = null;
  let moduleRef: TestingModule | null = null;
  let prismaService: PrismaService | null = null;
  let storageService: FakeObjectStorageService | null = null;
  const cleanup = {
    organizationIds: [] as string[],
    userIds: [] as string[],
    employeeIds: [] as string[],
    roleIds: [] as string[],
    customerIds: [] as string[],
    packageIds: [] as string[],
    documentIds: [] as string[],
    storedObjectIds: [] as string[],
    sessionIds: [] as string[],
  };

  beforeAll(() => {
    process.env.DATABASE_URL = LOCAL_DATABASE_URL;
    process.env.NODE_ENV = 'test';
    process.env.COOKIE_SECURE = 'false';
    process.env.CORS_ORIGINS = ALLOWED_ORIGIN;
  });

  it('serves upload intent, completion, listing, download and delete with tenant-safe authorization', async () => {
    try {
      storageService = new FakeObjectStorageService();

      moduleRef = await Test.createTestingModule({
        imports: [AppModule],
      })
        .overrideProvider(ObjectStorageService)
        .useValue(storageService)
        .compile();

      app = moduleRef.createNestApplication<NestExpressApplication>();
      configureHttpApp(app);
      await app.init();

      const prisma = moduleRef.get(PrismaService);
      prismaService = prisma;
      const passwordHasher = moduleRef.get(PasswordHasher);
      const rbacService = moduleRef.get(RbacService);
      const sessionsService = moduleRef.get(SessionsService);
      const authCookieService = moduleRef.get(AuthCookieService);

      await rbacService.syncPermissionCatalog();

      const suffix = randomUUID();
      const shortCode = suffix.slice(0, 8).toUpperCase();
      const passwordHash = await passwordHasher.hash(
        'Correct Horse Battery Staple 123!',
      );

      const [organization, otherOrganization] = await Promise.all([
        prisma.organization.create({
          data: {
            legalName: `Package Documents Org ${suffix}`,
            commercialName: `Package Documents Org ${suffix}`,
            slug: `package-documents-${suffix}`,
            status: 'ACTIVE',
          },
        }),
        prisma.organization.create({
          data: {
            legalName: `Package Documents Other ${suffix}`,
            commercialName: `Package Documents Other ${suffix}`,
            slug: `package-documents-other-${suffix}`,
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

      const [user, restrictedUser, otherUser] = await Promise.all([
        prisma.user.create({
          data: {
            email: `package-documents.${suffix}@courier.test`,
            passwordHash,
            passwordChangedAt: new Date('2026-07-07T00:00:00.000Z'),
            emailVerifiedAt: new Date('2026-07-07T00:00:00.000Z'),
            status: 'ACTIVE',
          },
        }),
        prisma.user.create({
          data: {
            email: `package-documents.restricted.${suffix}@courier.test`,
            passwordHash,
            passwordChangedAt: new Date('2026-07-07T00:00:00.000Z'),
            emailVerifiedAt: new Date('2026-07-07T00:00:00.000Z'),
            status: 'ACTIVE',
          },
        }),
        prisma.user.create({
          data: {
            email: `package-documents.other.${suffix}@courier.test`,
            passwordHash,
            passwordChangedAt: new Date('2026-07-07T00:00:00.000Z'),
            emailVerifiedAt: new Date('2026-07-07T00:00:00.000Z'),
            status: 'ACTIVE',
          },
        }),
      ]);
      cleanup.userIds.push(user.id, restrictedUser.id, otherUser.id);

      const [employee, restrictedEmployee, otherEmployee] = await Promise.all([
        prisma.employee.create({
          data: {
            organizationId: organization.id,
            userId: user.id,
            employeeCode: `DOC-${shortCode}`,
            firstName: 'Ada',
            lastName: 'Lovelace',
            status: 'ACTIVE',
          },
        }),
        prisma.employee.create({
          data: {
            organizationId: organization.id,
            userId: restrictedUser.id,
            employeeCode: `DOC-R-${shortCode}`,
            firstName: 'Linus',
            lastName: 'Torvalds',
            status: 'ACTIVE',
          },
        }),
        prisma.employee.create({
          data: {
            organizationId: otherOrganization.id,
            userId: otherUser.id,
            employeeCode: `DOC-O-${shortCode}`,
            firstName: 'Grace',
            lastName: 'Hopper',
            status: 'ACTIVE',
          },
        }),
      ]);
      cleanup.employeeIds.push(
        employee.id,
        restrictedEmployee.id,
        otherEmployee.id,
      );

      const documentsRole = await rbacService.createRole({
        organizationId: organization.id,
        code: `DOCS_${shortCode}`,
        name: 'Package Documents Admin',
        permissionCodes: [
          'packages.read',
          'package_documents.read',
          'package_documents.manage',
        ],
      });
      cleanup.roleIds.push(documentsRole.id);

      const otherRole = await rbacService.createRole({
        organizationId: otherOrganization.id,
        code: `DOCS_OTHER_${shortCode}`,
        name: 'Package Documents Other',
        permissionCodes: [
          'packages.read',
          'package_documents.read',
          'package_documents.manage',
        ],
      });
      cleanup.roleIds.push(otherRole.id);

      await rbacService.assignRoleToEmployee({
        organizationId: organization.id,
        employeeId: employee.id,
        roleId: documentsRole.id,
      });
      await rbacService.assignRoleToEmployee({
        organizationId: otherOrganization.id,
        employeeId: otherEmployee.id,
        roleId: otherRole.id,
      });

      const [customer, otherCustomer] = await Promise.all([
        prisma.customer.create({
          data: {
            organizationId: organization.id,
            customerCode: `C-${shortCode}`,
            type: 'INDIVIDUAL',
            firstName: 'Customer',
            lastName: 'One',
            status: 'ACTIVE',
          },
        }),
        prisma.customer.create({
          data: {
            organizationId: otherOrganization.id,
            customerCode: `CO-${shortCode}`,
            type: 'INDIVIDUAL',
            firstName: 'Customer',
            lastName: 'Other',
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

      const mainSession = await sessionsService.createSession({
        userId: user.id,
        organizationId: organization.id,
        ipAddress: '127.0.0.1',
        userAgent: 'supertest',
      });
      cleanup.sessionIds.push(mainSession.session.sessionId);
      const restrictedSession = await sessionsService.createSession({
        userId: restrictedUser.id,
        organizationId: organization.id,
        ipAddress: '127.0.0.1',
        userAgent: 'supertest',
      });
      cleanup.sessionIds.push(restrictedSession.session.sessionId);
      const otherSession = await sessionsService.createSession({
        userId: otherUser.id,
        organizationId: otherOrganization.id,
        ipAddress: '127.0.0.1',
        userAgent: 'supertest',
      });
      cleanup.sessionIds.push(otherSession.session.sessionId);

      const sessionCookie = `${authCookieService.getSessionCookieName()}=${mainSession.sessionToken}`;
      const restrictedSessionCookie = `${authCookieService.getSessionCookieName()}=${restrictedSession.sessionToken}`;
      const otherSessionCookie = `${authCookieService.getSessionCookieName()}=${otherSession.sessionToken}`;

      const csrfResponse = await request(app.getHttpServer())
        .get('/auth/csrf')
        .set('Origin', ALLOWED_ORIGIN)
        .set('Cookie', sessionCookie)
        .expect(200);
      const csrfBody = csrfResponse.body as { csrfToken: string };
      const csrfCookie = extractCookiePair(
        csrfResponse.headers['set-cookie'],
        authCookieService.getCsrfCookieName(),
      );

      await request(app.getHttpServer())
        .get(`/packages/${packageRecord.id}/documents`)
        .set('Origin', ALLOWED_ORIGIN)
        .expect(401);

      await request(app.getHttpServer())
        .get(`/packages/${packageRecord.id}/documents`)
        .set('Origin', ALLOWED_ORIGIN)
        .set('Cookie', restrictedSessionCookie)
        .expect(403);

      const uploadIntentResponse = await request(app.getHttpServer())
        .post(`/packages/${packageRecord.id}/documents/upload-intent`)
        .set('Origin', ALLOWED_ORIGIN)
        .set('X-CSRF-Token', csrfBody.csrfToken)
        .set('Cookie', [sessionCookie, csrfCookie])
        .send({
          documentType: 'INVOICE',
          fileName: 'invoice.pdf',
          contentType: 'application/pdf',
          contentLength: 14,
        })
        .expect(201);
      const uploadIntentBody = uploadIntentResponse.body as {
        document: {
          id: string;
          status: string;
        };
      };

      expect(uploadIntentBody.document.status).toBe('PENDING_UPLOAD');
      expect(uploadIntentBody.document).not.toHaveProperty('bucketName');
      expect(uploadIntentBody.document).not.toHaveProperty('objectKey');

      const createdDocument = await prisma.packageDocument.findUniqueOrThrow({
        where: {
          organizationId_id: {
            organizationId: organization.id,
            id: uploadIntentBody.document.id,
          },
        },
        include: {
          storedObject: true,
        },
      });
      cleanup.documentIds.push(createdDocument.id);
      cleanup.storedObjectIds.push(createdDocument.storedObjectId);

      await request(app.getHttpServer())
        .post(
          `/packages/${packageRecord.id}/documents/${createdDocument.id}/complete`,
        )
        .set('Origin', ALLOWED_ORIGIN)
        .set('X-CSRF-Token', csrfBody.csrfToken)
        .set('Cookie', [sessionCookie, csrfCookie])
        .send({})
        .expect(409);

      storageService.putObject(
        createdDocument.storedObject.bucketName,
        createdDocument.storedObject.objectKey,
        createdDocument.storedObject.contentType,
        Buffer.from('%PDF-1.7\n%%EOF'),
      );

      await request(app.getHttpServer())
        .post(
          `/packages/${packageRecord.id}/documents/${createdDocument.id}/complete`,
        )
        .set('Origin', ALLOWED_ORIGIN)
        .set('X-CSRF-Token', csrfBody.csrfToken)
        .set('Cookie', [sessionCookie, csrfCookie])
        .send({})
        .expect(200)
        .expect(({ body }) => {
          const responseBody = body as {
            status: string;
            originalFilename: string;
          };
          expect(responseBody.status).toBe('AVAILABLE');
          expect(responseBody.originalFilename).toBe('invoice.pdf');
        });

      const unsafeIntent = await request(app.getHttpServer())
        .post(`/packages/${packageRecord.id}/documents/upload-intent`)
        .set('Origin', ALLOWED_ORIGIN)
        .set('X-CSRF-Token', csrfBody.csrfToken)
        .set('Cookie', [sessionCookie, csrfCookie])
        .send({
          documentType: 'PACKAGE_PHOTO',
          fileName: 'package.png',
          contentType: 'image/png',
          contentLength: 12,
        })
        .expect(201);
      const unsafeDocument = await prisma.packageDocument.findUniqueOrThrow({
        where: {
          organizationId_id: {
            organizationId: organization.id,
            id: (unsafeIntent.body as { document: { id: string } }).document.id,
          },
        },
        include: { storedObject: true },
      });
      cleanup.documentIds.push(unsafeDocument.id);
      cleanup.storedObjectIds.push(unsafeDocument.storedObjectId);
      storageService.putObject(
        unsafeDocument.storedObject.bucketName,
        unsafeDocument.storedObject.objectKey,
        unsafeDocument.storedObject.contentType,
        Buffer.from('not-an-image'),
      );

      await request(app.getHttpServer())
        .post(
          `/packages/${packageRecord.id}/documents/${unsafeDocument.id}/complete`,
        )
        .set('Origin', ALLOWED_ORIGIN)
        .set('X-CSRF-Token', csrfBody.csrfToken)
        .set('Cookie', [sessionCookie, csrfCookie])
        .send({})
        .expect(409);

      await expect(
        prisma.storedObject.findUniqueOrThrow({
          where: {
            organizationId_id: {
              organizationId: organization.id,
              id: unsafeDocument.storedObjectId,
            },
          },
        }),
      ).resolves.toMatchObject({ status: 'QUARANTINED' });
      await expect(
        prisma.auditLog.findFirst({
          where: {
            organizationId: organization.id,
            action: 'package.document.quarantined',
            entityId: unsafeDocument.id,
          },
        }),
      ).resolves.not.toBeNull();

      await request(app.getHttpServer())
        .get(`/packages/${packageRecord.id}/documents`)
        .set('Origin', ALLOWED_ORIGIN)
        .set('Cookie', sessionCookie)
        .expect(200)
        .expect(({ body }) => {
          const responseBody = body as {
            items: Array<{ status: string }>;
          };
          expect(responseBody.items).toHaveLength(2);
          expect(responseBody.items.map((item) => item.status).sort()).toEqual([
            'AVAILABLE',
            'QUARANTINED',
          ]);
        });

      await request(app.getHttpServer())
        .get(
          `/packages/${otherPackage.id}/documents/${createdDocument.id}/download`,
        )
        .set('Origin', ALLOWED_ORIGIN)
        .set('Cookie', otherSessionCookie)
        .expect(404);

      await request(app.getHttpServer())
        .get(
          `/packages/${packageRecord.id}/documents/${createdDocument.id}/download`,
        )
        .set('Origin', ALLOWED_ORIGIN)
        .set('Cookie', sessionCookie)
        .expect(200)
        .expect((response) => {
          expect(response.headers['content-type']).toContain('application/pdf');
          expect(response.headers['content-disposition']).toContain(
            'attachment',
          );
          expect(Buffer.isBuffer(response.body)).toBe(true);
          expect((response.body as Buffer).toString('utf8')).toBe(
            '%PDF-1.7\n%%EOF',
          );
        });

      await request(app.getHttpServer())
        .delete(`/packages/${packageRecord.id}/documents/${createdDocument.id}`)
        .set('Origin', ALLOWED_ORIGIN)
        .set('X-CSRF-Token', csrfBody.csrfToken)
        .set('Cookie', [sessionCookie, csrfCookie])
        .expect(200)
        .expect(({ body }) => {
          const responseBody = body as { status: string };
          expect(responseBody.status).toBe('DELETED');
        });

      expect(
        storageService.hasObject(
          createdDocument.storedObject.bucketName,
          createdDocument.storedObject.objectKey,
        ),
      ).toBe(false);

      await request(app.getHttpServer())
        .delete(`/packages/${packageRecord.id}/documents/${createdDocument.id}`)
        .set('Origin', ALLOWED_ORIGIN)
        .set('X-CSRF-Token', csrfBody.csrfToken)
        .set('Cookie', [sessionCookie, csrfCookie])
        .expect(200)
        .expect(({ body }) => {
          const responseBody = body as { status: string };
          expect(responseBody.status).toBe('DELETED');
        });
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
          await prismaService.userSession.deleteMany({
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
  }, 30_000);
});

function buildCode(): string {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let value = 'PK';

  while (value.length < 14) {
    value += alphabet[Math.floor(Math.random() * alphabet.length)];
  }

  return value;
}
