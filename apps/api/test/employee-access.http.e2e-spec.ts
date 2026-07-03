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

type InvitationHttpBody = {
  status: 'invited' | 'membership_created';
  employee: {
    id: string;
    code?: string;
    organizationId?: string;
    deletedAt?: string | null;
    user?: {
      email: string;
    };
  };
  activation: {
    token: string;
    expiresAt: string;
  } | null;
};

type EmployeeListHttpBody = {
  items: unknown[];
  pagination: {
    page: number;
  };
};

type EmployeeDetailHttpBody = {
  user: {
    email: string;
  };
  passwordHash?: string;
  deletedAt?: string | null;
};

type RoleHttpBody = {
  id: string;
  code: string;
};

type RoleListHttpBody = {
  pagination: {
    page: number;
  };
};

type RoleDetailHttpBody = {
  permissionCodes: string[];
};

type PermissionHttpBody = Array<{
  code: string;
}>;

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

describe('Employee access administration HTTP', () => {
  let app: NestExpressApplication | null = null;
  let moduleRef: TestingModule | null = null;
  let prismaService: PrismaService | null = null;
  const cleanup = {
    organizationIds: [] as string[],
    userIds: [] as string[],
    employeeIds: [] as string[],
    roleIds: [] as string[],
    facilityIds: [] as string[],
    sessionIds: [] as string[],
    tokenIds: [] as string[],
  };

  beforeAll(() => {
    process.env.DATABASE_URL = LOCAL_DATABASE_URL;
    process.env.NODE_ENV = 'test';
    process.env.COOKIE_SECURE = 'false';
    process.env.CORS_ORIGINS = ALLOWED_ORIGIN;
  });

  it('invites employees, activates accounts, manages roles and facilities, protects self access changes, and revokes sessions only in the current courier', async () => {
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

      const organizationOne = await prisma.organization.create({
        data: {
          legalName: `Employees Http One ${suffix}`,
          commercialName: `Employees Http One ${suffix}`,
          slug: `employees-http-one-${suffix}`,
          maxUsers: 10,
          status: 'ACTIVE',
        },
      });
      cleanup.organizationIds.push(organizationOne.id);

      const organizationTwo = await prisma.organization.create({
        data: {
          legalName: `Employees Http Two ${suffix}`,
          commercialName: `Employees Http Two ${suffix}`,
          slug: `employees-http-two-${suffix}`,
          maxUsers: 10,
          status: 'ACTIVE',
        },
      });
      cleanup.organizationIds.push(organizationTwo.id);

      const facilityOne = await prisma.facility.create({
        data: {
          organizationId: organizationOne.id,
          code: `SDQ-${suffix.slice(0, 4).toUpperCase()}`,
          name: 'Santo Domingo',
          type: 'BRANCH',
          ownershipType: 'OWNED',
          countryCode: 'DO',
          isActive: true,
        },
      });
      cleanup.facilityIds.push(facilityOne.id);

      const facilityTwo = await prisma.facility.create({
        data: {
          organizationId: organizationOne.id,
          code: `POP-${suffix.slice(0, 4).toUpperCase()}`,
          name: 'Puerto Plata',
          type: 'BRANCH',
          ownershipType: 'OWNED',
          countryCode: 'DO',
          isActive: true,
        },
      });
      cleanup.facilityIds.push(facilityTwo.id);

      const foreignFacility = await prisma.facility.create({
        data: {
          organizationId: organizationTwo.id,
          code: `STI-${suffix.slice(0, 4).toUpperCase()}`,
          name: 'Santiago',
          type: 'BRANCH',
          ownershipType: 'OWNED',
          countryCode: 'DO',
          isActive: true,
        },
      });
      cleanup.facilityIds.push(foreignFacility.id);

      const adminUser = await prisma.user.create({
        data: {
          email: `admin.${suffix}@courier.test`,
          passwordHash,
          passwordChangedAt: new Date('2026-07-01T00:00:00.000Z'),
          emailVerifiedAt: new Date('2026-07-01T00:00:00.000Z'),
          status: 'ACTIVE',
        },
      });
      cleanup.userIds.push(adminUser.id);

      const sharedUser = await prisma.user.create({
        data: {
          email: `shared.${suffix}@courier.test`,
          passwordHash,
          passwordChangedAt: new Date('2026-07-01T00:00:00.000Z'),
          emailVerifiedAt: new Date('2026-07-01T00:00:00.000Z'),
          status: 'ACTIVE',
        },
      });
      cleanup.userIds.push(sharedUser.id);

      const portableUser = await prisma.user.create({
        data: {
          email: `portable.${suffix}@courier.test`,
          passwordHash,
          passwordChangedAt: new Date('2026-07-01T00:00:00.000Z'),
          emailVerifiedAt: new Date('2026-07-01T00:00:00.000Z'),
          status: 'ACTIVE',
        },
      });
      cleanup.userIds.push(portableUser.id);

      const adminEmployee = await prisma.employee.create({
        data: {
          organizationId: organizationOne.id,
          userId: adminUser.id,
          employeeCode: `ADMIN-${suffix.slice(0, 4).toUpperCase()}`,
          firstName: 'Admin',
          lastName: 'User',
          status: 'ACTIVE',
        },
      });
      cleanup.employeeIds.push(adminEmployee.id);

      const sharedEmployeeOrgOne = await prisma.employee.create({
        data: {
          organizationId: organizationOne.id,
          userId: sharedUser.id,
          employeeCode: `SHARE1-${suffix.slice(0, 4).toUpperCase()}`,
          firstName: 'Shared',
          lastName: 'User',
          status: 'ACTIVE',
        },
      });
      cleanup.employeeIds.push(sharedEmployeeOrgOne.id);

      const sharedEmployeeOrgTwo = await prisma.employee.create({
        data: {
          organizationId: organizationTwo.id,
          userId: sharedUser.id,
          employeeCode: `SHARE2-${suffix.slice(0, 4).toUpperCase()}`,
          firstName: 'Shared',
          lastName: 'User',
          status: 'ACTIVE',
        },
      });
      cleanup.employeeIds.push(sharedEmployeeOrgTwo.id);

      const adminRole = await rbacService.createRole({
        organizationId: organizationOne.id,
        code: `ADMIN_${suffix.slice(0, 8).toUpperCase()}`,
        name: 'Admin Role',
        permissionCodes: [
          'employees.read',
          'employees.manage',
          'roles.read',
          'roles.manage',
          'permissions.read',
        ],
      });
      cleanup.roleIds.push(adminRole.id);

      const employeeRole = await rbacService.createRole({
        organizationId: organizationOne.id,
        code: `EMP_${suffix.slice(0, 8).toUpperCase()}`,
        name: 'Employee Role',
        permissionCodes: ['employees.read'],
      });
      cleanup.roleIds.push(employeeRole.id);

      const foreignRole = await rbacService.createRole({
        organizationId: organizationTwo.id,
        code: `FOREIGN_${suffix.slice(0, 8).toUpperCase()}`,
        name: 'Foreign Role',
        permissionCodes: ['employees.read'],
      });
      cleanup.roleIds.push(foreignRole.id);

      await rbacService.assignRoleToEmployee({
        organizationId: organizationOne.id,
        employeeId: adminEmployee.id,
        roleId: adminRole.id,
      });

      const adminSession = await sessionsService.createSession({
        userId: adminUser.id,
        organizationId: organizationOne.id,
      });
      cleanup.sessionIds.push(adminSession.session.sessionId);

      const sharedSessionOrgOne = await sessionsService.createSession({
        userId: sharedUser.id,
        organizationId: organizationOne.id,
      });
      cleanup.sessionIds.push(sharedSessionOrgOne.session.sessionId);

      const sharedSessionOrgTwo = await sessionsService.createSession({
        userId: sharedUser.id,
        organizationId: organizationTwo.id,
      });
      cleanup.sessionIds.push(sharedSessionOrgTwo.session.sessionId);

      const sessionCookieName = authCookieService.getSessionCookieName();
      const adminSessionCookie = `${sessionCookieName}=${adminSession.sessionToken}`;
      const sharedSessionCookieOrgOne = `${sessionCookieName}=${sharedSessionOrgOne.sessionToken}`;
      const sharedSessionCookieOrgTwo = `${sessionCookieName}=${sharedSessionOrgTwo.sessionToken}`;
      const server = app.getHttpServer() as Parameters<typeof request>[0];

      const csrfResponse = await request(server)
        .get('/auth/csrf')
        .set('Origin', ALLOWED_ORIGIN)
        .expect(200);
      const csrfToken = (csrfResponse.body as { csrfToken: string }).csrfToken;
      const csrfCookie = extractCookiePair(
        csrfResponse.headers['set-cookie'],
        authCookieService.getCsrfCookieName(),
      );

      await request(server).get('/employees').expect(401);

      await request(server)
        .post('/employees/invitations')
        .set('Origin', ALLOWED_ORIGIN)
        .set('X-CSRF-Token', csrfToken)
        .set('Cookie', [adminSessionCookie, csrfCookie])
        .send({
          email: `invite.${suffix}@courier.test`,
          firstName: 'Invited',
          lastName: 'Employee',
          facilityIds: [facilityOne.id],
          primaryFacilityId: facilityOne.id,
          roleIds: [employeeRole.id],
        })
        .expect(201);
      const firstInvitedUser = await prisma.user.findFirstOrThrow({
        where: {
          email: `invite.${suffix}@courier.test`,
        },
      });
      cleanup.userIds.push(firstInvitedUser.id);
      const firstInvitedEmployee = await prisma.employee.findFirstOrThrow({
        where: {
          organizationId: organizationOne.id,
          userId: firstInvitedUser.id,
        },
      });
      cleanup.employeeIds.push(firstInvitedEmployee.id);

      const invitationResponse = await request(server)
        .post('/employees/invitations')
        .set('Origin', ALLOWED_ORIGIN)
        .set('X-CSRF-Token', csrfToken)
        .set('Cookie', [adminSessionCookie, csrfCookie])
        .send({
          email: `new.admin.${suffix}@courier.test`,
          employeeCode: '  emp-200  ',
          firstName: '  New  ',
          lastName: '  Admin  ',
          phone: '   ',
          facilityIds: [facilityTwo.id, facilityOne.id, facilityTwo.id],
          primaryFacilityId: facilityOne.id,
          roleIds: [employeeRole.id, employeeRole.id],
        })
        .expect(201);
      const invitationBody = invitationResponse.body as InvitationHttpBody;

      expect(invitationResponse.headers['cache-control']).toBe('no-store');
      expect(invitationBody.status).toBe('invited');
      expect(invitationBody.activation?.token).toBeTruthy();
      expect(invitationBody.employee.organizationId).toBeUndefined();
      expect(invitationBody.employee.deletedAt).toBeUndefined();

      const invitedUser = await prisma.user.findFirstOrThrow({
        where: {
          email: `new.admin.${suffix}@courier.test`,
        },
      });
      cleanup.userIds.push(invitedUser.id);
      const invitedEmployee = await prisma.employee.findFirstOrThrow({
        where: {
          organizationId: organizationOne.id,
          userId: invitedUser.id,
        },
      });
      cleanup.employeeIds.push(invitedEmployee.id);
      const invitedToken = await prisma.userActivationToken.findFirstOrThrow({
        where: {
          userId: invitedUser.id,
        },
      });
      cleanup.tokenIds.push(invitedToken.id);

      expect(invitedToken.tokenHash).not.toBe(invitationBody.activation?.token);

      await request(server)
        .post('/accounts/activate')
        .set('Origin', ALLOWED_ORIGIN)
        .set('X-CSRF-Token', csrfToken)
        .set('Cookie', csrfCookie)
        .send({
          activationToken: invitationBody.activation?.token,
          password: 'Correct Horse Battery Staple 123!',
        })
        .expect(204);

      await request(server)
        .post('/accounts/activate')
        .set('Origin', ALLOWED_ORIGIN)
        .set('X-CSRF-Token', csrfToken)
        .set('Cookie', csrfCookie)
        .send({
          activationToken: invitationBody.activation?.token,
          password: 'Correct Horse Battery Staple 123!',
        })
        .expect(401);

      const membershipResponse = await request(server)
        .post('/employees/invitations')
        .set('Origin', ALLOWED_ORIGIN)
        .set('X-CSRF-Token', csrfToken)
        .set('Cookie', [adminSessionCookie, csrfCookie])
        .send({
          email: portableUser.email,
          firstName: 'Portable',
          lastName: 'User',
        })
        .expect(201);
      const membershipBody = membershipResponse.body as InvitationHttpBody;

      expect(membershipBody.status).toBe('membership_created');
      expect(membershipBody.activation).toBeNull();
      const portableEmployeeOrgOne = await prisma.employee.findFirstOrThrow({
        where: {
          organizationId: organizationOne.id,
          userId: portableUser.id,
        },
      });
      cleanup.employeeIds.push(portableEmployeeOrgOne.id);

      const employeesListResponse = await request(server)
        .get('/employees?page=1&pageSize=20&q= shared ')
        .set('Cookie', adminSessionCookie)
        .expect(200);
      const employeesListBody =
        employeesListResponse.body as EmployeeListHttpBody;

      expect(employeesListBody.pagination.page).toBe(1);
      expect(Array.isArray(employeesListBody.items)).toBeTruthy();

      const detailResponse = await request(server)
        .get(`/employees/${sharedEmployeeOrgOne.id}`)
        .set('Cookie', adminSessionCookie)
        .expect(200);
      const detailBody = detailResponse.body as EmployeeDetailHttpBody;

      expect(detailBody.user.email).toBe(sharedUser.email);
      expect(detailBody.passwordHash).toBeUndefined();
      expect(detailBody.deletedAt).toBeUndefined();

      await request(server)
        .patch(`/employees/${adminEmployee.id}`)
        .set('Origin', ALLOWED_ORIGIN)
        .set('X-CSRF-Token', csrfToken)
        .set('Cookie', [adminSessionCookie, csrfCookie])
        .send({
          status: 'SUSPENDED',
        })
        .expect(403);

      await request(server)
        .put(`/employees/${adminEmployee.id}/roles`)
        .set('Origin', ALLOWED_ORIGIN)
        .set('X-CSRF-Token', csrfToken)
        .set('Cookie', [adminSessionCookie, csrfCookie])
        .send({
          roleIds: [employeeRole.id],
        })
        .expect(403);

      await request(server)
        .put(`/employees/${adminEmployee.id}/facilities`)
        .set('Origin', ALLOWED_ORIGIN)
        .set('X-CSRF-Token', csrfToken)
        .set('Cookie', [adminSessionCookie, csrfCookie])
        .send({
          facilityIds: [facilityOne.id],
          primaryFacilityId: facilityOne.id,
        })
        .expect(403);

      await request(server)
        .put(`/employees/${sharedEmployeeOrgOne.id}/facilities`)
        .set('Origin', ALLOWED_ORIGIN)
        .set('X-CSRF-Token', csrfToken)
        .set('Cookie', [adminSessionCookie, csrfCookie])
        .send({
          facilityIds: [facilityTwo.id, facilityOne.id],
          primaryFacilityId: facilityTwo.id,
        })
        .expect(200);

      await request(server)
        .put(`/employees/${sharedEmployeeOrgOne.id}/facilities`)
        .set('Origin', ALLOWED_ORIGIN)
        .set('X-CSRF-Token', csrfToken)
        .set('Cookie', [adminSessionCookie, csrfCookie])
        .send({
          facilityIds: [foreignFacility.id],
          primaryFacilityId: foreignFacility.id,
        })
        .expect(404);

      await request(server)
        .put(`/employees/${sharedEmployeeOrgOne.id}/roles`)
        .set('Origin', ALLOWED_ORIGIN)
        .set('X-CSRF-Token', csrfToken)
        .set('Cookie', [adminSessionCookie, csrfCookie])
        .send({
          roleIds: [employeeRole.id],
        })
        .expect(200);

      await request(server)
        .put(`/employees/${sharedEmployeeOrgOne.id}/roles`)
        .set('Origin', ALLOWED_ORIGIN)
        .set('X-CSRF-Token', csrfToken)
        .set('Cookie', [adminSessionCookie, csrfCookie])
        .send({
          roleIds: [foreignRole.id],
        })
        .expect(404);

      const createdRoleResponse = await request(server)
        .post('/roles')
        .set('Origin', ALLOWED_ORIGIN)
        .set('X-CSRF-Token', csrfToken)
        .set('Cookie', [adminSessionCookie, csrfCookie])
        .send({
          code: '  ops_support  ',
          name: '  Ops Support  ',
          description: '  Backoffice role  ',
          permissionCodes: ['employees.read', 'roles.read'],
        })
        .expect(201);
      const createdRoleBody = createdRoleResponse.body as RoleHttpBody;

      cleanup.roleIds.push(createdRoleBody.id);
      expect(createdRoleBody.code).toBe('OPS_SUPPORT');

      const permissionsResponse = await request(server)
        .get('/permissions')
        .set('Cookie', adminSessionCookie)
        .expect(200);
      const permissionsBody = permissionsResponse.body as PermissionHttpBody;
      expect(
        permissionsBody.some(
          (permission: { code: string }) =>
            permission.code === 'permissions.read',
        ),
      ).toBe(true);

      const rolesResponse = await request(server)
        .get('/roles?page=1&pageSize=20')
        .set('Cookie', adminSessionCookie)
        .expect(200);
      const rolesBody = rolesResponse.body as RoleListHttpBody;
      expect(rolesBody.pagination.page).toBe(1);

      const roleDetailResponse = await request(server)
        .get(`/roles/${employeeRole.id}`)
        .set('Cookie', adminSessionCookie)
        .expect(200);
      const roleDetailBody = roleDetailResponse.body as RoleDetailHttpBody;
      expect(roleDetailBody.permissionCodes).toContain('employees.read');

      await request(server)
        .patch(`/roles/${employeeRole.id}`)
        .set('Origin', ALLOWED_ORIGIN)
        .set('X-CSRF-Token', csrfToken)
        .set('Cookie', [adminSessionCookie, csrfCookie])
        .send({
          code: '  employee_reader  ',
          name: '  Employee Reader  ',
          isActive: true,
        })
        .expect(200);

      await request(server)
        .put(`/roles/${employeeRole.id}/permissions`)
        .set('Origin', ALLOWED_ORIGIN)
        .set('X-CSRF-Token', csrfToken)
        .set('Cookie', [adminSessionCookie, csrfCookie])
        .send({
          permissionCodes: ['employees.read', 'roles.read', 'employees.read'],
        })
        .expect(200);

      await request(server)
        .post(`/employees/${sharedEmployeeOrgOne.id}/revoke-sessions`)
        .set('Origin', ALLOWED_ORIGIN)
        .set('X-CSRF-Token', csrfToken)
        .set('Cookie', [adminSessionCookie, csrfCookie])
        .expect(204);

      await request(server)
        .get('/auth/session')
        .set('Cookie', sharedSessionCookieOrgOne)
        .expect(401);

      await request(server)
        .get('/auth/session')
        .set('Cookie', sharedSessionCookieOrgTwo)
        .expect(200);
    } finally {
      if (prismaService) {
        if (cleanup.sessionIds.length > 0) {
          await prismaService.userSession.deleteMany({
            where: {
              id: {
                in: cleanup.sessionIds,
              },
            },
          });
        }
        if (cleanup.tokenIds.length > 0) {
          await prismaService.userActivationToken.deleteMany({
            where: {
              OR: [
                {
                  id: {
                    in: cleanup.tokenIds,
                  },
                },
                {
                  userId: {
                    in: cleanup.userIds,
                  },
                },
              ],
            },
          });
        }
        if (cleanup.employeeIds.length > 0) {
          await prismaService.employeeFacility.deleteMany({
            where: {
              employeeId: {
                in: cleanup.employeeIds,
              },
            },
          });
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
        if (cleanup.facilityIds.length > 0) {
          await prismaService.employeeFacility.deleteMany({
            where: {
              facilityId: {
                in: cleanup.facilityIds,
              },
            },
          });
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
          await prismaService.organization.deleteMany({
            where: {
              id: {
                in: cleanup.organizationIds,
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
