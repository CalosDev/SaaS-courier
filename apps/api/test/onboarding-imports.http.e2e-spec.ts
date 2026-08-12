import type { NestExpressApplication } from '@nestjs/platform-express';
import { Test, type TestingModule } from '@nestjs/testing';
import { randomUUID } from 'node:crypto';
import request from 'supertest';

import { PasswordHasher } from '../src/accounts/password-hasher';
import { AppModule } from '../src/app.module';
import { AuthCookieService } from '../src/auth/http/auth-cookie.service';
import { configureHttpApp } from '../src/http/configure-http-app';
import { PrismaService } from '../src/prisma/prisma.service';
import { RbacService } from '../src/rbac/rbac.service';
import { SessionsService } from '../src/sessions/sessions.service';
import { deleteAuditArtifactsForOrganizations } from './audit-test-cleanup';

const LOCAL_DATABASE_URL =
  'postgresql://courier:courier_dev_password@localhost:5432/courier_saas?schema=public';
const ALLOWED_ORIGIN = 'http://localhost:3000';

interface CsrfResponseBody {
  csrfToken: string;
}

interface CreatedCustomerBody {
  id: string;
  customerCode: string;
}

interface CapabilitiesBody {
  planCode: string;
  modules: string[];
}

interface OnboardingBody {
  status: string;
  steps: unknown[];
  completedAt?: string | null;
}

interface ImportJobBody {
  id: string;
}

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

describe('Organization onboarding and customer imports HTTP', () => {
  let app: NestExpressApplication | null = null;
  let moduleRef: TestingModule | null = null;
  let prismaService: PrismaService | null = null;
  const cleanup = {
    organizationIds: [] as string[],
    userIds: [] as string[],
    employeeIds: [] as string[],
    roleIds: [] as string[],
    facilityIds: [] as string[],
    customerIds: [] as string[],
    customsProfileIds: [] as string[],
    importJobIds: [] as string[],
    sessionIds: [] as string[],
  };

  beforeAll(() => {
    process.env.DATABASE_URL = LOCAL_DATABASE_URL;
    process.env.NODE_ENV = 'test';
    process.env.COOKIE_SECURE = 'false';
    process.env.CORS_ORIGINS = ALLOWED_ORIGIN;
  });

  it('serves settings, capabilities, onboarding, and customer imports with real sessions and tenant isolation', async () => {
    try {
      moduleRef = await Test.createTestingModule({
        imports: [AppModule],
      }).compile();

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
      const passwordHash = await passwordHasher.hash(
        'Correct Horse Battery Staple 123!',
      );

      const organization = await prisma.organization.create({
        data: {
          legalName: `Onboarding Org ${suffix}`,
          commercialName: `Onboarding Org ${suffix}`,
          slug: `onboarding-org-${suffix}`,
          status: 'ACTIVE',
        },
      });
      cleanup.organizationIds.push(organization.id);
      await prisma.organizationSettings.create({
        data: {
          organizationId: organization.id,
        },
      });
      await prisma.organizationRegulatoryProfile.create({
        data: { organizationId: organization.id },
      });

      const otherOrganization = await prisma.organization.create({
        data: {
          legalName: `Onboarding Other ${suffix}`,
          commercialName: `Onboarding Other ${suffix}`,
          slug: `onboarding-other-${suffix}`,
          status: 'ACTIVE',
        },
      });
      cleanup.organizationIds.push(otherOrganization.id);
      await prisma.organizationSettings.create({
        data: {
          organizationId: otherOrganization.id,
        },
      });
      await prisma.organizationRegulatoryProfile.create({
        data: { organizationId: otherOrganization.id },
      });

      const user = await prisma.user.create({
        data: {
          email: `onboarding-http.${suffix}@courier.test`,
          passwordHash,
          passwordChangedAt: new Date('2026-07-01T00:00:00.000Z'),
          emailVerifiedAt: new Date('2026-07-01T00:00:00.000Z'),
          status: 'ACTIVE',
        },
      });
      cleanup.userIds.push(user.id);

      const otherUser = await prisma.user.create({
        data: {
          email: `onboarding-http-other.${suffix}@courier.test`,
          passwordHash,
          passwordChangedAt: new Date('2026-07-01T00:00:00.000Z'),
          emailVerifiedAt: new Date('2026-07-01T00:00:00.000Z'),
          status: 'ACTIVE',
        },
      });
      cleanup.userIds.push(otherUser.id);

      const employee = await prisma.employee.create({
        data: {
          organizationId: organization.id,
          userId: user.id,
          employeeCode: `EMP-${suffix.slice(0, 8).toUpperCase()}`,
          firstName: 'Ada',
          lastName: 'Lovelace',
          status: 'ACTIVE',
        },
      });
      cleanup.employeeIds.push(employee.id);

      const otherEmployee = await prisma.employee.create({
        data: {
          organizationId: otherOrganization.id,
          userId: otherUser.id,
          employeeCode: `EMP-OTH-${suffix.slice(0, 6).toUpperCase()}`,
          firstName: 'Grace',
          lastName: 'Hopper',
          status: 'ACTIVE',
        },
      });
      cleanup.employeeIds.push(otherEmployee.id);

      const role = await rbacService.createRole({
        organizationId: organization.id,
        code: `ORGSETTINGS_${suffix.slice(0, 8).toUpperCase()}`,
        name: 'Org Settings Admin',
      });
      cleanup.roleIds.push(role.id);

      await rbacService.assignRoleToEmployee({
        organizationId: organization.id,
        employeeId: employee.id,
        roleId: role.id,
      });

      const permissionCodes = [
        'organizations.read',
        'organizations.manage',
        'customers.read',
        'customers.manage',
      ];
      const permissions = await prisma.permission.findMany({
        where: {
          code: {
            in: permissionCodes,
          },
        },
        select: {
          id: true,
          code: true,
        },
      });
      await prisma.rolePermission.createMany({
        data: permissions.map((permission) => ({
          organizationId: organization.id,
          roleId: role.id,
          permissionId: permission.id,
        })),
      });

      const session = await sessionsService.createSession({
        userId: user.id,
        organizationId: organization.id,
      });
      cleanup.sessionIds.push(session.session.sessionId);

      const sessionCookie = `${authCookieService.getSessionCookieName()}=${session.sessionToken}`;
      const server = app.getHttpServer() as Parameters<typeof request>[0];
      const csrfResponse = await request(server)
        .get('/auth/csrf')
        .set('Origin', ALLOWED_ORIGIN)
        .expect(200);
      const csrfBody = csrfResponse.body as CsrfResponseBody;
      const csrfCookie = extractCookiePair(
        csrfResponse.headers['set-cookie'],
        authCookieService.getCsrfCookieName(),
      );

      await request(server).get('/organizations/current/settings').expect(401);

      const settingsResponse = await request(server)
        .get('/organizations/current/settings')
        .set('Cookie', sessionCookie)
        .expect(200);
      expect(settingsResponse.headers['cache-control']).toBe('no-store');
      expect(settingsResponse.body).toMatchObject({
        locale: 'es-DO',
        customerCodeStrategy: 'AUTO_RANDOM',
      });
      expect(settingsResponse.body).not.toHaveProperty('organizationId');

      const regulatoryResponse = await request(server)
        .get('/organizations/current/regulatory-profile')
        .set('Cookie', sessionCookie)
        .expect(200);
      expect(regulatoryResponse.headers['cache-control']).toBe('no-store');
      expect(regulatoryResponse.body).toMatchObject({
        fiscalAddress: null,
        courierRegistrationStatus: 'UNKNOWN',
        electronicInvoicingStatus: 'UNKNOWN',
      });
      expect(regulatoryResponse.body).not.toHaveProperty('organizationId');

      await request(server)
        .patch('/organizations/current/regulatory-profile')
        .set('Origin', ALLOWED_ORIGIN)
        .set('X-CSRF-Token', csrfBody.csrfToken)
        .set('Cookie', [sessionCookie, csrfCookie])
        .send({
          organizationId: otherOrganization.id,
          fiscalAddress: 'Attempted cross-tenant update',
        })
        .expect(400);

      await request(server)
        .patch('/organizations/current/regulatory-profile')
        .set('Origin', ALLOWED_ORIGIN)
        .set('X-CSRF-Token', csrfBody.csrfToken)
        .set('Cookie', [sessionCookie, csrfCookie])
        .send({
          fiscalAddress: 'Santo Domingo, Republica Dominicana',
          authorizedRepresentativeName: 'Ada Lovelace',
          authorizedRepresentativeEmail: 'admin@courier.test',
          courierRegistrationStatus: 'IN_PROCESS',
          dgaOperatorCode: 'DGA-TEST-01',
          electronicInvoicingStatus: 'NOT_ENROLLED',
        })
        .expect(200);

      await expect(
        prisma.organizationRegulatoryProfile.findUniqueOrThrow({
          where: { organizationId: otherOrganization.id },
        }),
      ).resolves.toMatchObject({
        fiscalAddress: null,
        courierRegistrationStatus: 'UNKNOWN',
        electronicInvoicingStatus: 'UNKNOWN',
      });

      await request(server)
        .patch('/organizations/current/settings')
        .set('Origin', ALLOWED_ORIGIN)
        .set('X-CSRF-Token', csrfBody.csrfToken)
        .set('Cookie', [sessionCookie, csrfCookie])
        .send({
          nextCustomerSequence: 999,
        })
        .expect(400);

      await request(server)
        .patch('/organizations/current/settings')
        .set('Origin', ALLOWED_ORIGIN)
        .set('X-CSRF-Token', csrfBody.csrfToken)
        .set('Cookie', [sessionCookie, csrfCookie])
        .send({
          customerCodeStrategy: 'AUTO_SEQUENTIAL',
          customerCodePrefix: 'CF-',
          customerCodeSequencePadding: 6,
        })
        .expect(200);

      const createdCustomerResponse = await request(server)
        .post('/customers')
        .set('Origin', ALLOWED_ORIGIN)
        .set('X-CSRF-Token', csrfBody.csrfToken)
        .set('Cookie', [sessionCookie, csrfCookie])
        .send({
          type: 'INDIVIDUAL',
          firstName: 'Ada',
          lastName: 'Lovelace',
        })
        .expect(201);
      const createdCustomerBody =
        createdCustomerResponse.body as CreatedCustomerBody;
      expect(createdCustomerBody.customerCode).toMatch(/^CF-\d{6}$/);
      cleanup.customerIds.push(createdCustomerBody.id);

      const capabilitiesResponse = await request(server)
        .get('/organizations/current/capabilities')
        .set('Cookie', sessionCookie)
        .expect(200);
      const capabilitiesBody = capabilitiesResponse.body as CapabilitiesBody;
      expect(capabilitiesBody.planCode).toBe('PILOT');
      expect(capabilitiesBody.modules).toEqual(
        expect.arrayContaining(['customer_imports', 'onboarding']),
      );

      const onboardingResponse = await request(server)
        .get('/organizations/current/onboarding')
        .set('Cookie', sessionCookie)
        .expect(200);
      const onboardingBody = onboardingResponse.body as OnboardingBody;
      expect(onboardingBody).toHaveProperty('status');
      expect(Array.isArray(onboardingBody.steps)).toBe(true);

      await request(server)
        .post('/organizations/current/onboarding/complete')
        .set('Origin', ALLOWED_ORIGIN)
        .set('X-CSRF-Token', csrfBody.csrfToken)
        .set('Cookie', [sessionCookie, csrfCookie])
        .expect(409);

      const facility = await prisma.facility.create({
        data: {
          organizationId: organization.id,
          code: `HQ-${suffix.slice(0, 6).toUpperCase()}`,
          name: 'Main Hub',
          type: 'BRANCH',
          isActive: true,
        },
      });
      cleanup.facilityIds.push(facility.id);

      const completedOnboardingResponse = await request(server)
        .post('/organizations/current/onboarding/complete')
        .set('Origin', ALLOWED_ORIGIN)
        .set('X-CSRF-Token', csrfBody.csrfToken)
        .set('Cookie', [sessionCookie, csrfCookie])
        .expect(200);
      const completedOnboardingBody =
        completedOnboardingResponse.body as OnboardingBody;
      expect(completedOnboardingBody.status).toBe('COMPLETED');
      expect(completedOnboardingBody.completedAt).not.toBeNull();

      const importResponse = await request(server)
        .post('/customer-imports')
        .set('Origin', ALLOWED_ORIGIN)
        .set('X-CSRF-Token', csrfBody.csrfToken)
        .set('Cookie', [sessionCookie, csrfCookie])
        .send({
          name: 'Legacy import',
          preserveCustomerCodes: true,
          rows: [
            {
              type: 'BUSINESS',
              businessName: 'Legacy Corp',
              customerCode: 'SDQ10294',
            },
            {
              type: 'INDIVIDUAL',
              firstName: 'Grace',
              lastName: 'Hopper',
            },
          ],
        })
        .expect(201);
      const importBody = importResponse.body as ImportJobBody;
      cleanup.importJobIds.push(importBody.id);

      await request(server)
        .post(`/customer-imports/${importBody.id}/validate`)
        .set('Origin', ALLOWED_ORIGIN)
        .set('X-CSRF-Token', csrfBody.csrfToken)
        .set('Cookie', [sessionCookie, csrfCookie])
        .expect(200);

      await request(server)
        .post(`/customer-imports/${importBody.id}/commit`)
        .set('Origin', ALLOWED_ORIGIN)
        .set('X-CSRF-Token', csrfBody.csrfToken)
        .set('Cookie', [sessionCookie, csrfCookie])
        .expect(200);

      const importedCustomers = await prisma.customer.findMany({
        where: {
          organizationId: organization.id,
        },
      });
      cleanup.customerIds.push(
        ...importedCustomers.map((customer) => customer.id),
      );

      const foreignJob = await prisma.customerImportJob.create({
        data: {
          organization: {
            connect: {
              id: otherOrganization.id,
            },
          },
          createdByEmployee: {
            connect: {
              organizationId_id: {
                organizationId: otherOrganization.id,
                id: otherEmployee.id,
              },
            },
          },
          name: 'Foreign import',
          status: 'DRAFT',
          preserveCustomerCodes: false,
          totalRows: 1,
          validRows: 0,
          invalidRows: 0,
          importedRows: 0,
        },
      });
      cleanup.importJobIds.push(foreignJob.id);

      await request(server)
        .get(`/customer-imports/${foreignJob.id}`)
        .set('Cookie', sessionCookie)
        .expect(404);

      await request(server).get('/health').expect(200);
      await request(server)
        .get('/auth/session')
        .set('Cookie', sessionCookie)
        .expect(200);
    } finally {
      if (prismaService) {
        if (cleanup.organizationIds.length > 0) {
          await prismaService.customerCustomsProfile.deleteMany({
            where: {
              organizationId: {
                in: cleanup.organizationIds,
              },
            },
          });
          await prismaService.customerImportRow.deleteMany({
            where: {
              organizationId: {
                in: cleanup.organizationIds,
              },
            },
          });
          await prismaService.customerImportJob.deleteMany({
            where: {
              organizationId: {
                in: cleanup.organizationIds,
              },
            },
          });
          await prismaService.customerAddress.deleteMany({
            where: {
              organizationId: {
                in: cleanup.organizationIds,
              },
            },
          });
          await prismaService.customer.deleteMany({
            where: {
              organizationId: {
                in: cleanup.organizationIds,
              },
            },
          });
          await prismaService.userSession.deleteMany({
            where: {
              organizationId: {
                in: cleanup.organizationIds,
              },
            },
          });
          await prismaService.employeeFacility.deleteMany({
            where: {
              organizationId: {
                in: cleanup.organizationIds,
              },
            },
          });
          await prismaService.employeeRole.deleteMany({
            where: {
              organizationId: {
                in: cleanup.organizationIds,
              },
            },
          });
          await prismaService.rolePermission.deleteMany({
            where: {
              organizationId: {
                in: cleanup.organizationIds,
              },
            },
          });
          await prismaService.role.deleteMany({
            where: {
              organizationId: {
                in: cleanup.organizationIds,
              },
            },
          });
          await prismaService.employee.deleteMany({
            where: {
              organizationId: {
                in: cleanup.organizationIds,
              },
            },
          });
          await prismaService.facility.deleteMany({
            where: {
              organizationId: {
                in: cleanup.organizationIds,
              },
            },
          });
          await deleteAuditArtifactsForOrganizations(
            prismaService,
            cleanup.organizationIds,
          );
          await prismaService.organizationSettings.deleteMany({
            where: {
              organizationId: {
                in: cleanup.organizationIds,
              },
            },
          });
          await prismaService.organizationRegulatoryProfile.deleteMany({
            where: {
              organizationId: {
                in: cleanup.organizationIds,
              },
            },
          });
          await prismaService.organization.deleteMany({
            where: {
              id: {
                in: cleanup.organizationIds,
              },
            },
          });
        }

        if (cleanup.customsProfileIds.length > 0) {
          await prismaService.customerCustomsProfile.deleteMany({
            where: {
              id: {
                in: cleanup.customsProfileIds,
              },
            },
          });
        }
        if (cleanup.importJobIds.length > 0) {
          await prismaService.customerImportRow.deleteMany({
            where: {
              importJobId: {
                in: cleanup.importJobIds,
              },
            },
          });
          await prismaService.customerImportJob.deleteMany({
            where: {
              id: {
                in: cleanup.importJobIds,
              },
            },
          });
        }
        if (cleanup.customerIds.length > 0) {
          await prismaService.customer.deleteMany({
            where: {
              id: {
                in: cleanup.customerIds,
              },
            },
          });
        }
        if (cleanup.sessionIds.length > 0) {
          await prismaService.userSession.deleteMany({
            where: {
              id: {
                in: cleanup.sessionIds,
              },
            },
          });
        }
        if (cleanup.employeeIds.length > 0) {
          await prismaService.employeeRole.deleteMany({
            where: {
              employeeId: {
                in: cleanup.employeeIds,
              },
            },
          });
        }
        if (cleanup.roleIds.length > 0) {
          await prismaService.rolePermission.deleteMany({
            where: {
              roleId: {
                in: cleanup.roleIds,
              },
            },
          });
        }
        if (cleanup.roleIds.length > 0) {
          await prismaService.role.deleteMany({
            where: {
              id: {
                in: cleanup.roleIds,
              },
            },
          });
        }
        if (cleanup.employeeIds.length > 0) {
          await prismaService.employee.deleteMany({
            where: {
              id: {
                in: cleanup.employeeIds,
              },
            },
          });
        }
        if (cleanup.userIds.length > 0) {
          await prismaService.user.deleteMany({
            where: {
              id: {
                in: cleanup.userIds,
              },
            },
          });
        }
        if (cleanup.facilityIds.length > 0) {
          await prismaService.facility.deleteMany({
            where: {
              id: {
                in: cleanup.facilityIds,
              },
            },
          });
        }
        if (cleanup.organizationIds.length > 0) {
          await deleteAuditArtifactsForOrganizations(
            prismaService,
            cleanup.organizationIds,
          );
          await prismaService.organizationSettings.deleteMany({
            where: {
              organizationId: {
                in: cleanup.organizationIds,
              },
            },
          });
          await prismaService.organizationRegulatoryProfile.deleteMany({
            where: {
              organizationId: {
                in: cleanup.organizationIds,
              },
            },
          });
          await prismaService.organization.deleteMany({
            where: {
              id: {
                in: cleanup.organizationIds,
              },
            },
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
