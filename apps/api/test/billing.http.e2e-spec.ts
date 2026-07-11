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

describe('Billing HTTP E2E', () => {
  let app: NestExpressApplication | null = null;
  let moduleRef: TestingModule | null = null;
  let prismaService: PrismaService | null = null;
  const cleanup = {
    organizationIds: [] as string[],
    userIds: [] as string[],
    employeeIds: [] as string[],
    roleIds: [] as string[],
    customerIds: [] as string[],
    sessionIds: [] as string[],
    invoiceIds: [] as string[],
    paymentIds: [] as string[],
  };

  beforeAll(() => {
    process.env.NODE_ENV = 'test';
    process.env.COOKIE_SECURE = 'false';
    process.env.CORS_ORIGINS = ALLOWED_ORIGIN;
  });

  it('manages invoices and payments', async () => {
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
          legalName: `Billing Org HTTP ${suffix}`,
          commercialName: `Billing Org HTTP ${suffix}`,
          slug: `billing-http-${suffix}`,
          currencyCode: 'DOP',
          status: 'ACTIVE',
        },
      });
      cleanup.organizationIds.push(organization.id);
      await prisma.organizationSettings.create({
        data: { organizationId: organization.id },
      });

      const user = await prisma.user.create({
        data: {
          email: `billing-http.${suffix}@courier.test`,
          passwordHash,
          passwordChangedAt: new Date(),
          emailVerifiedAt: new Date(),
          status: 'ACTIVE',
        },
      });
      cleanup.userIds.push(user.id);

      const employee = await prisma.employee.create({
        data: {
          organizationId: organization.id,
          userId: user.id,
          employeeCode: `EMP-${shortCode}`,
          firstName: 'Bill',
          lastName: 'Gates',
          status: 'ACTIVE',
        },
      });
      cleanup.employeeIds.push(employee.id);

      const role = await rbacService.createRole({
        organizationId: organization.id,
        code: `BILLING_${shortCode}`,
        name: 'Billing Admin',
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
      const csrfBody = csrfResponse.body as { csrfToken: string };
      const csrfCookie = extractCookiePair(
        csrfResponse.headers['set-cookie'],
        authCookieService.getCsrfCookieName(),
      );

      // Add permissions
      const p1 = await prisma.permission.findUniqueOrThrow({
        where: { code: 'billing.read' },
      });
      const p2 = await prisma.permission.findUniqueOrThrow({
        where: { code: 'billing.manage' },
      });
      const p3 = await prisma.permission.findUniqueOrThrow({
        where: { code: 'payments.manage' },
      });
      const p4 = await prisma.permission.findUniqueOrThrow({
        where: { code: 'customers.manage' },
      });

      await prisma.rolePermission.createMany({
        data: [
          {
            organizationId: organization.id,
            roleId: role.id,
            permissionId: p1.id,
          },
          {
            organizationId: organization.id,
            roleId: role.id,
            permissionId: p2.id,
          },
          {
            organizationId: organization.id,
            roleId: role.id,
            permissionId: p3.id,
          },
          {
            organizationId: organization.id,
            roleId: role.id,
            permissionId: p4.id,
          },
        ],
      });

      // Create Customer
      const createCustomerRes = await request(server)
        .post('/customers')
        .set('Origin', ALLOWED_ORIGIN)
        .set('X-CSRF-Token', csrfBody.csrfToken)
        .set('Cookie', [sessionCookie, csrfCookie])
        .send({
          type: 'BUSINESS',
          businessName: 'Billing Test Customer',
          email: 'billing@test.com',
        })
        .expect(201);

      const customerId = createCustomerRes.body.id;
      cleanup.customerIds.push(customerId);

      // Create Invoice
      const createInvoiceRes = await request(server)
        .post('/invoices')
        .set('Origin', ALLOWED_ORIGIN)
        .set('X-CSRF-Token', csrfBody.csrfToken)
        .set('Cookie', [sessionCookie, csrfCookie])
        .send({
          customerId,
          currencyCode: 'USD',
          notes: 'Test Invoice',
          lines: [
            {
              type: 'TRANSPORT',
              description: 'Freight',
              quantity: 2,
              unitPriceMinor: '1500', // 15.00
            },
            {
              type: 'DELIVERY',
              description: 'Local Delivery',
              quantity: 1,
              unitPriceMinor: '500', // 5.00
            },
          ],
        });

      if (createInvoiceRes.status !== 201) {
        console.log('Invoice Creation Error:', createInvoiceRes.body);
      }
      expect(createInvoiceRes.status).toBe(201);

      expect(createInvoiceRes.body.status).toBe('DRAFT');
      expect(createInvoiceRes.body.totalMinor).toBe('3500');

      const invoiceId = createInvoiceRes.body.id;
      cleanup.invoiceIds.push(invoiceId);

      // Issue Invoice
      const issueRes = await request(server)
        .post(`/invoices/${invoiceId}/issue`)
        .set('Origin', ALLOWED_ORIGIN)
        .set('X-CSRF-Token', csrfBody.csrfToken)
        .set('Cookie', [sessionCookie, csrfCookie])
        .expect(201);

      expect(issueRes.body.status).toBe('ISSUED');

      // Create Payment
      const createPaymentRes = await request(server)
        .post('/payments')
        .set('Origin', ALLOWED_ORIGIN)
        .set('X-CSRF-Token', csrfBody.csrfToken)
        .set('Cookie', [sessionCookie, csrfCookie])
        .send({
          customerId,
          method: 'BANK_TRANSFER',
          amountMinor: '4000', // 40.00
          currencyCode: 'USD',
          reference: 'TX-123',
        })
        .expect(201);

      expect(createPaymentRes.body.status).toBe('RECORDED');

      const paymentId = createPaymentRes.body.id;
      cleanup.paymentIds.push(paymentId);

      // Apply Payment
      const applyRes = await request(server)
        .post(`/payments/${paymentId}/apply`)
        .set('Origin', ALLOWED_ORIGIN)
        .set('X-CSRF-Token', csrfBody.csrfToken)
        .set('Cookie', [sessionCookie, csrfCookie])
        .send({
          invoiceId,
          amountMinor: '3500', // apply to full invoice
        })
        .expect(201);

      expect(applyRes.body.allocations).toHaveLength(1);

      // Check invoice is PAID
      const invoiceGetRes = await request(server)
        .get(`/invoices/${invoiceId}`)
        .set('Origin', ALLOWED_ORIGIN)
        .set('X-CSRF-Token', csrfBody.csrfToken)
        .set('Cookie', [sessionCookie, csrfCookie])
        .expect(200);

      expect(invoiceGetRes.body.status).toBe('PAID');
      expect(invoiceGetRes.body.balanceDueMinor).toBe('0');
    } finally {
      if (prismaService) {
        if (cleanup.paymentIds.length > 0) {
          await prismaService.paymentAllocation.deleteMany({
            where: { paymentId: { in: cleanup.paymentIds } },
          });
          await prismaService.payment.deleteMany({
            where: { id: { in: cleanup.paymentIds } },
          });
        }
        if (cleanup.invoiceIds.length > 0) {
          await prismaService.invoiceLine.deleteMany({
            where: { invoiceId: { in: cleanup.invoiceIds } },
          });
          await prismaService.customerInvoice.deleteMany({
            where: { id: { in: cleanup.invoiceIds } },
          });
        }
        if (cleanup.customerIds.length > 0) {
          await prismaService.customer.deleteMany({
            where: { id: { in: cleanup.customerIds } },
          });
        }
        if (cleanup.sessionIds.length > 0) {
          await prismaService.userSession.deleteMany({
            where: { id: { in: cleanup.sessionIds } },
          });
        }
        if (cleanup.employeeIds.length > 0) {
          await prismaService.employeeRole.deleteMany({
            where: { employeeId: { in: cleanup.employeeIds } },
          });
        }
        if (cleanup.roleIds.length > 0) {
          await prismaService.rolePermission.deleteMany({
            where: { roleId: { in: cleanup.roleIds } },
          });
          await prismaService.role.deleteMany({
            where: { id: { in: cleanup.roleIds } },
          });
        }
        if (cleanup.employeeIds.length > 0) {
          await prismaService.employee.deleteMany({
            where: { id: { in: cleanup.employeeIds } },
          });
        }
        if (cleanup.userIds.length > 0) {
          await prismaService.user.deleteMany({
            where: { id: { in: cleanup.userIds } },
          });
        }
        if (cleanup.organizationIds.length > 0) {
          await deleteAuditArtifactsForOrganizations(
            prismaService,
            cleanup.organizationIds,
          );
          await prismaService.organizationSettings.deleteMany({
            where: { organizationId: { in: cleanup.organizationIds } },
          });
          await prismaService.organization.deleteMany({
            where: { id: { in: cleanup.organizationIds } },
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
