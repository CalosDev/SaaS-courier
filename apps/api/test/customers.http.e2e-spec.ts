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

const LOCAL_DATABASE_URL =
  'postgresql://courier:courier_dev_password@localhost:5432/courier_saas?schema=public';
const ALLOWED_ORIGIN = 'http://localhost:3000';

interface CsrfResponseBody {
  csrfToken: string;
}

interface CustomerHttpResponse {
  id: string;
  customerCode: string;
  type: 'INDIVIDUAL' | 'BUSINESS';
  firstName: string | null;
  lastName: string | null;
  businessName: string | null;
  displayName: string;
  email: string | null;
  phone: string | null;
  mobilePhone: string | null;
  status: 'PENDING' | 'ACTIVE' | 'SUSPENDED' | 'CLOSED';
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

interface CustomerListHttpResponse {
  items: CustomerHttpResponse[];
  pagination: {
    page: number;
    pageSize: number;
    totalItems: number;
    totalPages: number;
  };
}

interface AddressHttpResponse {
  id: string;
  type: 'HOME' | 'WORK' | 'BILLING' | 'DELIVERY' | 'OTHER';
  label: string | null;
  recipientName: string | null;
  phone: string | null;
  addressLine1: string;
  addressLine2: string | null;
  city: string;
  province: string;
  postalCode: string | null;
  countryCode: string;
  isPrimary: boolean;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

interface CustomsProfileHttpResponse {
  id: string;
  documentType: 'CEDULA' | 'PASSPORT' | 'RNC';
  documentNumber: string;
  ruaStatus:
    | 'UNKNOWN'
    | 'PENDING'
    | 'REGISTERED'
    | 'NOT_REGISTERED'
    | 'VERIFICATION_FAILED';
  verificationSource: 'MANUAL' | 'DGA_PORTAL' | 'OFFICIAL_INTEGRATION' | null;
  lastCheckedAt: string | null;
  verifiedAt: string | null;
  externalReference: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
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

function expectNoHiddenFields(payload: Record<string, unknown>): void {
  expect(payload).not.toHaveProperty('organizationId');
  expect(payload).not.toHaveProperty('deletedAt');
}

describe('Customers admin HTTP', () => {
  let app: NestExpressApplication | null = null;
  let moduleRef: TestingModule | null = null;
  let prismaService: PrismaService | null = null;
  const cleanup = {
    organizationIds: [] as string[],
    userIds: [] as string[],
    employeeIds: [] as string[],
    roleIds: [] as string[],
    customerIds: [] as string[],
    addressIds: [] as string[],
    customsProfileIds: [] as string[],
    sessionIds: [] as string[],
  };

  beforeAll(() => {
    process.env.DATABASE_URL = LOCAL_DATABASE_URL;
    process.env.NODE_ENV = 'test';
    process.env.COOKIE_SECURE = 'false';
    process.env.CORS_ORIGINS = ALLOWED_ORIGIN;
  });

  it('serves customer, address, and customs-profile endpoints with real sessions and permissions', async () => {
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
      const shortCode = suffix.slice(0, 8).toUpperCase();
      const passwordHash = await passwordHasher.hash(
        'Correct Horse Battery Staple 123!',
      );

      const organization = await prisma.organization.create({
        data: {
          legalName: `Customers Org ${suffix}`,
          commercialName: `Customers Org ${suffix}`,
          slug: `customers-org-${suffix}`,
          status: 'ACTIVE',
        },
      });
      cleanup.organizationIds.push(organization.id);

      const otherOrganization = await prisma.organization.create({
        data: {
          legalName: `Customers Other ${suffix}`,
          commercialName: `Customers Other ${suffix}`,
          slug: `customers-other-${suffix}`,
          status: 'ACTIVE',
        },
      });
      cleanup.organizationIds.push(otherOrganization.id);

      const user = await prisma.user.create({
        data: {
          email: `customers-http.${suffix}@courier.test`,
          passwordHash,
          passwordChangedAt: new Date('2026-07-01T00:00:00.000Z'),
          emailVerifiedAt: new Date('2026-07-01T00:00:00.000Z'),
          status: 'ACTIVE',
        },
      });
      cleanup.userIds.push(user.id);

      const employee = await prisma.employee.create({
        data: {
          organizationId: organization.id,
          userId: user.id,
          employeeCode: `EMP-${shortCode}`,
          firstName: 'Ada',
          lastName: 'Lovelace',
          status: 'ACTIVE',
        },
      });
      cleanup.employeeIds.push(employee.id);

      const role = await rbacService.createRole({
        organizationId: organization.id,
        code: `CUSTOMERS_${shortCode}`,
        name: 'Customers Admin',
      });
      cleanup.roleIds.push(role.id);

      await rbacService.assignRoleToEmployee({
        organizationId: organization.id,
        employeeId: employee.id,
        roleId: role.id,
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

      await request(server).get('/health').expect(200);
      await request(server)
        .get('/auth/session')
        .set('Cookie', sessionCookie)
        .expect(200);

      await request(server).get('/customers').expect(401);
      await request(server)
        .get('/customers')
        .set('Cookie', sessionCookie)
        .expect(403);

      const customersReadPermission = await prisma.permission.findUniqueOrThrow(
        {
          where: { code: 'customers.read' },
          select: { id: true },
        },
      );
      await prisma.rolePermission.create({
        data: {
          organizationId: organization.id,
          roleId: role.id,
          permissionId: customersReadPermission.id,
        },
      });

      const emptyListResponse = await request(server)
        .get('/customers?page=1&pageSize=10')
        .set('Cookie', sessionCookie)
        .expect(200);
      expect(emptyListResponse.headers['cache-control']).toBe('no-store');
      expect(emptyListResponse.body).toMatchObject({
        items: [],
        pagination: {
          page: 1,
          pageSize: 10,
          totalItems: 0,
          totalPages: 0,
        },
      });

      await request(server)
        .post('/customers')
        .set('Origin', ALLOWED_ORIGIN)
        .set('X-CSRF-Token', csrfBody.csrfToken)
        .set('Cookie', [sessionCookie, csrfCookie])
        .send({
          type: 'INDIVIDUAL',
          firstName: 'Ada',
          lastName: 'Lovelace',
        })
        .expect(403);

      const customersManagePermission =
        await prisma.permission.findUniqueOrThrow({
          where: { code: 'customers.manage' },
          select: { id: true },
        });
      await prisma.rolePermission.create({
        data: {
          organizationId: organization.id,
          roleId: role.id,
          permissionId: customersManagePermission.id,
        },
      });

      const individualResponse = await request(server)
        .post('/customers')
        .set('Origin', ALLOWED_ORIGIN)
        .set('X-CSRF-Token', csrfBody.csrfToken)
        .set('Cookie', [sessionCookie, csrfCookie])
        .send({
          type: 'INDIVIDUAL',
          firstName: '  Ada  ',
          lastName: '  Lovelace  ',
          email: '  ADA@COURIER.TEST  ',
        })
        .expect(201);
      const individualCustomer =
        individualResponse.body as CustomerHttpResponse &
          Record<string, unknown>;

      expect(individualCustomer).toMatchObject({
        type: 'INDIVIDUAL',
        firstName: 'Ada',
        lastName: 'Lovelace',
        email: 'ada@courier.test',
        status: 'PENDING',
      });
      expect(individualCustomer.customerCode).toMatch(/^C[A-HJ-NP-Z2-9]{8}$/);
      expectNoHiddenFields(individualCustomer);
      cleanup.customerIds.push(individualCustomer.id);

      const businessResponse = await request(server)
        .post('/customers')
        .set('Origin', ALLOWED_ORIGIN)
        .set('X-CSRF-Token', csrfBody.csrfToken)
        .set('Cookie', [sessionCookie, csrfCookie])
        .send({
          type: 'BUSINESS',
          businessName: '  ACME Logistics  ',
          phone: ' 809-555-0110 ',
        })
        .expect(201);
      const businessCustomer = businessResponse.body as CustomerHttpResponse;
      cleanup.customerIds.push(businessCustomer.id);

      await request(server)
        .post('/customers')
        .set('Origin', ALLOWED_ORIGIN)
        .set('X-CSRF-Token', csrfBody.csrfToken)
        .set('Cookie', [sessionCookie, csrfCookie])
        .send({
          type: 'INDIVIDUAL',
          firstName: 'Ada',
          lastName: 'Lovelace',
          customerCode: 'MANUAL001',
        })
        .expect(400);

      await request(server)
        .post('/customers')
        .set('Origin', ALLOWED_ORIGIN)
        .set('X-CSRF-Token', csrfBody.csrfToken)
        .set('Cookie', [sessionCookie, csrfCookie])
        .send({
          type: 'INDIVIDUAL',
          firstName: 'Ada',
          lastName: 'Lovelace',
          organizationId: otherOrganization.id,
        })
        .expect(400);

      await request(server)
        .post('/customers')
        .set('Origin', ALLOWED_ORIGIN)
        .set('X-CSRF-Token', csrfBody.csrfToken)
        .set('Cookie', [sessionCookie, csrfCookie])
        .send({
          type: 'INDIVIDUAL',
          firstName: 'Ada',
          lastName: 'Lovelace',
          unexpected: 'value',
        })
        .expect(400);

      const listResponse = await request(server)
        .get('/customers?page=1&pageSize=10&q= acme ')
        .set('Cookie', sessionCookie)
        .expect(200);
      const customerList = listResponse.body as CustomerListHttpResponse;

      expect(customerList.pagination).toMatchObject({
        page: 1,
        pageSize: 10,
        totalItems: 1,
        totalPages: 1,
      });
      expect(customerList.items[0]).toMatchObject({
        id: businessCustomer.id,
        businessName: 'ACME Logistics',
      });
      expect(customerList.items[0]).not.toHaveProperty('documentNumber');
      expect(customerList.items[0]).not.toHaveProperty('ruaStatus');

      const detailResponse = await request(server)
        .get(`/customers/${individualCustomer.id}`)
        .set('Cookie', sessionCookie)
        .expect(200);
      const detailCustomer = detailResponse.body as CustomerHttpResponse &
        Record<string, unknown>;
      expect(detailCustomer.id).toBe(individualCustomer.id);
      expectNoHiddenFields(detailCustomer);

      const otherTenantCustomer = await prisma.customer.create({
        data: {
          organizationId: otherOrganization.id,
          customerCode: 'SDQ20483',
          type: 'INDIVIDUAL',
          firstName: 'Grace',
          lastName: 'Hopper',
          status: 'PENDING',
        },
      });
      cleanup.customerIds.push(otherTenantCustomer.id);

      await request(server)
        .get(`/customers/${otherTenantCustomer.id}`)
        .set('Cookie', sessionCookie)
        .expect(404);

      const updatedCustomerResponse = await request(server)
        .patch(`/customers/${individualCustomer.id}`)
        .set('Origin', ALLOWED_ORIGIN)
        .set('X-CSRF-Token', csrfBody.csrfToken)
        .set('Cookie', [sessionCookie, csrfCookie])
        .send({
          mobilePhone: ' 809-555-0199 ',
          status: 'ACTIVE',
        })
        .expect(200);
      expect(updatedCustomerResponse.body).toMatchObject({
        mobilePhone: '809-555-0199',
        status: 'ACTIVE',
      });

      const createAddressResponse = await request(server)
        .post(`/customers/${individualCustomer.id}/addresses`)
        .set('Origin', ALLOWED_ORIGIN)
        .set('X-CSRF-Token', csrfBody.csrfToken)
        .set('Cookie', [sessionCookie, csrfCookie])
        .send({
          type: 'HOME',
          addressLine1: '  Calle 1  ',
          city: '  Santo Domingo  ',
          province: '  Distrito Nacional  ',
          isPrimary: true,
        })
        .expect(201);
      const createdAddress = createAddressResponse.body as AddressHttpResponse &
        Record<string, unknown>;
      cleanup.addressIds.push(createdAddress.id);
      expect(createdAddress.countryCode).toBe('DO');
      expectNoHiddenFields(createdAddress);

      const secondAddressResponse = await request(server)
        .post(`/customers/${individualCustomer.id}/addresses`)
        .set('Origin', ALLOWED_ORIGIN)
        .set('X-CSRF-Token', csrfBody.csrfToken)
        .set('Cookie', [sessionCookie, csrfCookie])
        .send({
          type: 'HOME',
          addressLine1: 'Calle 2',
          city: 'Santo Domingo',
          province: 'Distrito Nacional',
          isPrimary: false,
        })
        .expect(201);
      const secondAddress = secondAddressResponse.body as AddressHttpResponse;
      cleanup.addressIds.push(secondAddress.id);

      await request(server)
        .patch(
          `/customers/${individualCustomer.id}/addresses/${secondAddress.id}`,
        )
        .set('Origin', ALLOWED_ORIGIN)
        .set('X-CSRF-Token', csrfBody.csrfToken)
        .set('Cookie', [sessionCookie, csrfCookie])
        .send({
          isPrimary: true,
        })
        .expect(200);

      const addressesResponse = await request(server)
        .get(`/customers/${individualCustomer.id}/addresses`)
        .set('Cookie', sessionCookie)
        .expect(200);
      const addresses = addressesResponse.body as AddressHttpResponse[];
      const primaryAddresses = addresses.filter(
        (address) => address.type === 'HOME' && address.isPrimary === true,
      );
      expect(primaryAddresses).toHaveLength(1);

      const otherTenantAddress = await prisma.customerAddress.create({
        data: {
          organizationId: otherOrganization.id,
          customerId: otherTenantCustomer.id,
          type: 'HOME',
          addressLine1: 'Other 1',
          city: 'Santiago',
          province: 'Santiago',
          countryCode: 'DO',
          isPrimary: true,
          isActive: true,
        },
      });
      cleanup.addressIds.push(otherTenantAddress.id);

      await request(server)
        .patch(
          `/customers/${individualCustomer.id}/addresses/${otherTenantAddress.id}`,
        )
        .set('Origin', ALLOWED_ORIGIN)
        .set('X-CSRF-Token', csrfBody.csrfToken)
        .set('Cookie', [sessionCookie, csrfCookie])
        .send({
          label: 'Forbidden',
        })
        .expect(404);

      await request(server)
        .get(`/customers/${individualCustomer.id}/customs-profile`)
        .set('Cookie', sessionCookie)
        .expect(403);

      const customersCustomsReadPermission =
        await prisma.permission.findUniqueOrThrow({
          where: { code: 'customers.customs.read' },
          select: { id: true },
        });
      const customersCustomsManagePermission =
        await prisma.permission.findUniqueOrThrow({
          where: { code: 'customers.customs.manage' },
          select: { id: true },
        });
      await prisma.rolePermission.createMany({
        data: [
          {
            organizationId: organization.id,
            roleId: role.id,
            permissionId: customersCustomsReadPermission.id,
          },
          {
            organizationId: organization.id,
            roleId: role.id,
            permissionId: customersCustomsManagePermission.id,
          },
        ],
      });

      const createProfileResponse = await request(server)
        .put(`/customers/${individualCustomer.id}/customs-profile`)
        .set('Origin', ALLOWED_ORIGIN)
        .set('X-CSRF-Token', csrfBody.csrfToken)
        .set('Cookie', [sessionCookie, csrfCookie])
        .send({
          documentType: 'CEDULA',
          documentNumber: '001-1234567-8',
          notes: '  Initial  ',
        })
        .expect(200);
      const createdProfile =
        createProfileResponse.body as CustomsProfileHttpResponse &
          Record<string, unknown>;
      cleanup.customsProfileIds.push(createdProfile.id);
      expect(createdProfile).toMatchObject({
        documentType: 'CEDULA',
        documentNumber: '00112345678',
        ruaStatus: 'UNKNOWN',
      });
      expect(createdProfile).not.toHaveProperty('ruaNumber');
      expectNoHiddenFields(createdProfile);

      const registeredResponse = await request(server)
        .patch(
          `/customers/${individualCustomer.id}/customs-profile/verification`,
        )
        .set('Origin', ALLOWED_ORIGIN)
        .set('X-CSRF-Token', csrfBody.csrfToken)
        .set('Cookie', [sessionCookie, csrfCookie])
        .send({
          status: 'REGISTERED',
          source: 'MANUAL',
          checkedAt: '2026-07-01T12:00:00.000Z',
          externalReference: 'DGA-123',
        })
        .expect(200);
      const registeredProfile =
        registeredResponse.body as CustomsProfileHttpResponse;
      expect(registeredProfile).toMatchObject({
        ruaStatus: 'REGISTERED',
        verificationSource: 'MANUAL',
      });
      expect(registeredProfile.verifiedAt).toBe('2026-07-01T12:00:00.000Z');

      const resetProfileResponse = await request(server)
        .put(`/customers/${individualCustomer.id}/customs-profile`)
        .set('Origin', ALLOWED_ORIGIN)
        .set('X-CSRF-Token', csrfBody.csrfToken)
        .set('Cookie', [sessionCookie, csrfCookie])
        .send({
          documentType: 'PASSPORT',
          documentNumber: 'ab-12345',
          notes: 'Updated document',
        })
        .expect(200);
      const resetProfile =
        resetProfileResponse.body as CustomsProfileHttpResponse;
      expect(resetProfile).toMatchObject({
        documentType: 'PASSPORT',
        documentNumber: 'AB-12345',
        ruaStatus: 'UNKNOWN',
        verificationSource: null,
        lastCheckedAt: null,
        verifiedAt: null,
      });

      await request(server)
        .get(`/customers/${otherTenantCustomer.id}/customs-profile`)
        .set('Cookie', sessionCookie)
        .expect(404);

      const duplicateCustomerResponse = await request(server)
        .post('/customers')
        .set('Origin', ALLOWED_ORIGIN)
        .set('X-CSRF-Token', csrfBody.csrfToken)
        .set('Cookie', [sessionCookie, csrfCookie])
        .send({
          type: 'INDIVIDUAL',
          firstName: 'Katherine',
          lastName: 'Johnson',
        })
        .expect(201);
      const duplicateCustomer =
        duplicateCustomerResponse.body as CustomerHttpResponse;
      cleanup.customerIds.push(duplicateCustomer.id);

      await request(server)
        .put(`/customers/${duplicateCustomer.id}/customs-profile`)
        .set('Origin', ALLOWED_ORIGIN)
        .set('X-CSRF-Token', csrfBody.csrfToken)
        .set('Cookie', [sessionCookie, csrfCookie])
        .send({
          documentType: 'PASSPORT',
          documentNumber: 'AB-12345',
        })
        .expect(409);
    } finally {
      if (prismaService) {
        if (cleanup.customsProfileIds.length > 0) {
          await prismaService.customerCustomsProfile.deleteMany({
            where: {
              id: {
                in: cleanup.customsProfileIds,
              },
            },
          });
        }
        if (cleanup.addressIds.length > 0) {
          await prismaService.customerAddress.deleteMany({
            where: {
              id: {
                in: cleanup.addressIds,
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
        if (cleanup.customerIds.length > 0) {
          await prismaService.customer.deleteMany({
            where: {
              id: {
                in: cleanup.customerIds,
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
        if (cleanup.organizationIds.length > 0) {
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
