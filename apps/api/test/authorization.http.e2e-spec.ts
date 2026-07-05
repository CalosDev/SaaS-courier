import { randomUUID } from 'node:crypto';
import { Controller, Get, Module } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import type { NestExpressApplication } from '@nestjs/platform-express';
import request from 'supertest';

import { CurrentSession } from '../src/auth/http/current-session.decorator';
import type { SessionContext } from '../src/sessions/session.types';
import { Public } from '../src/auth/http/public.decorator';
import { AppModule } from '../src/app.module';
import { configureHttpApp } from '../src/http/configure-http-app';
import { PrismaService } from '../src/prisma/prisma.service';
import { AuthenticatedOnly } from '../src/rbac/http/authenticated-only.decorator';
import { RequirePermissions } from '../src/rbac/http/require-permissions.decorator';
import { RbacService } from '../src/rbac/rbac.service';
import { SessionsService } from '../src/sessions/sessions.service';
import { AuthCookieService } from '../src/auth/http/auth-cookie.service';

const LOCAL_DATABASE_URL =
  'postgresql://courier:courier_dev_password@localhost:5432/courier_saas?schema=public';

@Controller('authorization-test')
class AuthorizationHttpTestController {
  @Get('public')
  @Public()
  getPublic() {
    return {
      route: 'public',
    };
  }

  @Get('authenticated')
  @AuthenticatedOnly()
  getAuthenticated(@CurrentSession() session: SessionContext) {
    return {
      route: 'authenticated',
      organizationId: session.organizationId,
      sessionId: session.sessionId,
    };
  }

  @Get('permissions-read')
  @RequirePermissions('permissions.read')
  getPermissionsRead() {
    return {
      route: 'permissions.read',
    };
  }

  @Get('roles-manage')
  @RequirePermissions('roles.manage')
  getRolesManage() {
    return {
      route: 'roles.manage',
    };
  }

  @Get('no-policy')
  getNoPolicy() {
    return {
      route: 'no-policy',
    };
  }
}

@Controller('authorization-test/combined')
@RequirePermissions('permissions.read')
class AuthorizationCombinedHttpTestController {
  @Get()
  @RequirePermissions('roles.manage')
  getCombined() {
    return {
      route: 'combined',
    };
  }
}

@Module({
  controllers: [
    AuthorizationHttpTestController,
    AuthorizationCombinedHttpTestController,
  ],
})
class AuthorizationHttpTestModule {}

describe('HTTP authorization with effective permissions', () => {
  let app: NestExpressApplication | null = null;
  let moduleRef: TestingModule | null = null;
  let prismaService: PrismaService | null = null;
  const cleanup = {
    userIds: [] as string[],
    organizationIds: [] as string[],
    employeeIds: [] as string[],
    roleIds: [] as string[],
  };
  const restoredPermissions = new Map<string, boolean>();

  beforeAll(() => {
    process.env.DATABASE_URL = LOCAL_DATABASE_URL;
    process.env.NODE_ENV = 'test';
    process.env.COOKIE_SECURE = 'false';
    process.env.CORS_ORIGINS = 'http://localhost:3000';
  });

  afterEach(async () => {
    if (!prismaService) {
      return;
    }

    for (const [permissionId, wasActive] of restoredPermissions.entries()) {
      await prismaService.permission.update({
        where: {
          id: permissionId,
        },
        data: {
          isActive: wasActive,
        },
      });
    }

    restoredPermissions.clear();
  });

  it('enforces fail-closed HTTP authorization with current RBAC state', async () => {
    try {
      moduleRef = await Test.createTestingModule({
        imports: [AppModule, AuthorizationHttpTestModule],
      }).compile();

      app = moduleRef.createNestApplication<NestExpressApplication>();
      configureHttpApp(app);
      await app.init();

      const prisma = moduleRef.get(PrismaService);
      const sessions = moduleRef.get(SessionsService);
      const authCookies = moduleRef.get(AuthCookieService);
      const rbac = moduleRef.get(RbacService);

      prismaService = prisma;
      await rbac.syncPermissionCatalog();

      const permissionCatalog = await prisma.permission.findMany({
        orderBy: {
          code: 'asc',
        },
        select: {
          id: true,
          code: true,
          isActive: true,
        },
      });

      expect(permissionCatalog.map((permission) => permission.code)).toEqual([
        'audit.read',
        'customers.customs.manage',
        'customers.customs.read',
        'customers.manage',
        'customers.read',
        'employees.manage',
        'employees.read',
        'facilities.manage',
        'facilities.read',
        'organizations.manage',
        'organizations.read',
        'packages.manage',
        'packages.read',
        'permissions.read',
        'prealerts.manage',
        'prealerts.read',
        'roles.manage',
        'roles.read',
      ]);

      const permissionsByCode = new Map(
        permissionCatalog.map((permission) => [permission.code, permission]),
      );
      const permissionsRead = permissionsByCode.get('permissions.read');
      const rolesManage = permissionsByCode.get('roles.manage');

      if (!permissionsRead || !rolesManage) {
        throw new Error('Expected permissions are missing from the catalog.');
      }

      const suffix = randomUUID();
      const shortCode = suffix.slice(0, 8).toUpperCase();
      const user = await prisma.user.create({
        data: {
          email: `authorization.${suffix}@courier.test`,
          passwordHash: 'ticket17-password-hash',
          passwordChangedAt: new Date('2026-06-29T00:00:00.000Z'),
          emailVerifiedAt: new Date('2026-06-29T00:00:00.000Z'),
          status: 'ACTIVE',
        },
      });
      cleanup.userIds.push(user.id);

      const noRoleUser = await prisma.user.create({
        data: {
          email: `authorization-norole.${suffix}@courier.test`,
          passwordHash: 'ticket17-password-hash',
          passwordChangedAt: new Date('2026-06-29T00:00:00.000Z'),
          emailVerifiedAt: new Date('2026-06-29T00:00:00.000Z'),
          status: 'ACTIVE',
        },
      });
      cleanup.userIds.push(noRoleUser.id);

      const organizationOne = await prisma.organization.create({
        data: {
          legalName: `Authorization Org One ${suffix}`,
          commercialName: `Authorization Org One ${suffix}`,
          slug: `authorization-one-${suffix}`,
          status: 'ACTIVE',
        },
      });
      cleanup.organizationIds.push(organizationOne.id);

      const organizationTwo = await prisma.organization.create({
        data: {
          legalName: `Authorization Org Two ${suffix}`,
          commercialName: `Authorization Org Two ${suffix}`,
          slug: `authorization-two-${suffix}`,
          status: 'ACTIVE',
        },
      });
      cleanup.organizationIds.push(organizationTwo.id);

      const employeeOne = await prisma.employee.create({
        data: {
          organizationId: organizationOne.id,
          userId: user.id,
          employeeCode: `AUTH1-${shortCode}`,
          firstName: 'Ada',
          lastName: 'Lovelace',
          status: 'ACTIVE',
        },
      });
      cleanup.employeeIds.push(employeeOne.id);

      const employeeTwo = await prisma.employee.create({
        data: {
          organizationId: organizationTwo.id,
          userId: user.id,
          employeeCode: `AUTH2-${shortCode}`,
          firstName: 'Ada',
          lastName: 'Lovelace',
          status: 'ACTIVE',
        },
      });
      cleanup.employeeIds.push(employeeTwo.id);

      const noRoleEmployee = await prisma.employee.create({
        data: {
          organizationId: organizationOne.id,
          userId: noRoleUser.id,
          employeeCode: `AUTH3-${shortCode}`,
          firstName: 'Grace',
          lastName: 'Hopper',
          status: 'ACTIVE',
        },
      });
      cleanup.employeeIds.push(noRoleEmployee.id);

      const roleOne = await prisma.role.create({
        data: {
          organizationId: organizationOne.id,
          code: `AUTH_ROLE_ONE_${shortCode}`,
          name: 'Authorization Role One',
          isSystem: false,
        },
      });
      cleanup.roleIds.push(roleOne.id);

      const roleTwo = await prisma.role.create({
        data: {
          organizationId: organizationTwo.id,
          code: `AUTH_ROLE_TWO_${shortCode}`,
          name: 'Authorization Role Two',
          isSystem: false,
        },
      });
      cleanup.roleIds.push(roleTwo.id);

      await prisma.rolePermission.create({
        data: {
          organizationId: organizationOne.id,
          roleId: roleOne.id,
          permissionId: permissionsRead.id,
        },
      });

      await prisma.employeeRole.create({
        data: {
          organizationId: organizationOne.id,
          employeeId: employeeOne.id,
          roleId: roleOne.id,
        },
      });

      const orgOneSession = await sessions.createSession({
        userId: user.id,
        organizationId: organizationOne.id,
      });
      const noRoleSession = await sessions.createSession({
        userId: noRoleUser.id,
        organizationId: organizationOne.id,
      });
      const sessionCookieName = authCookies.getSessionCookieName();
      const orgOneCookie = `${sessionCookieName}=${orgOneSession.sessionToken}`;
      const noRoleCookie = `${sessionCookieName}=${noRoleSession.sessionToken}`;
      const server = app.getHttpServer() as Parameters<typeof request>[0];

      await request(server)
        .get('/authorization-test/public')
        .expect(200)
        .expect({
          route: 'public',
        });

      await request(server).get('/health').expect(200);

      await request(server)
        .get('/authorization-test/permissions-read')
        .expect(401);

      const authenticatedResponse = await request(server)
        .get('/authorization-test/authenticated')
        .set('Cookie', orgOneCookie)
        .expect(200);

      expect(authenticatedResponse.body).toMatchObject({
        route: 'authenticated',
        organizationId: organizationOne.id,
      });

      const permissionsReadResponse = await request(server)
        .get('/authorization-test/permissions-read')
        .set('Cookie', orgOneCookie)
        .expect(200);

      expect(permissionsReadResponse.body).toEqual({
        route: 'permissions.read',
      });

      const insufficientPermissionResponse = await request(server)
        .get('/authorization-test/roles-manage')
        .set('Cookie', orgOneCookie)
        .expect(403);

      expect(insufficientPermissionResponse.body).toEqual({
        error: {
          code: 'INSUFFICIENT_PERMISSIONS',
          message: 'You do not have permission to perform this action.',
        },
      });
      expect(JSON.stringify(insufficientPermissionResponse.body)).not.toContain(
        'roles.manage',
      );

      await request(server)
        .get('/authorization-test/combined')
        .set('Cookie', orgOneCookie)
        .expect(403);

      await prisma.rolePermission.create({
        data: {
          organizationId: organizationOne.id,
          roleId: roleOne.id,
          permissionId: rolesManage.id,
        },
      });

      await request(server)
        .get('/authorization-test/combined')
        .set('Cookie', orgOneCookie)
        .expect(200)
        .expect({
          route: 'combined',
        });

      await prisma.role.update({
        where: {
          id: roleOne.id,
        },
        data: {
          isActive: false,
        },
      });

      await request(server)
        .get('/authorization-test/permissions-read')
        .set('Cookie', orgOneCookie)
        .expect(403);

      await prisma.role.update({
        where: {
          id: roleOne.id,
        },
        data: {
          isActive: true,
        },
      });

      restoredPermissions.set(permissionsRead.id, permissionsRead.isActive);
      await prisma.permission.update({
        where: {
          id: permissionsRead.id,
        },
        data: {
          isActive: false,
        },
      });

      await request(server)
        .get('/authorization-test/permissions-read')
        .set('Cookie', orgOneCookie)
        .expect(403);

      await prisma.permission.update({
        where: {
          id: permissionsRead.id,
        },
        data: {
          isActive: true,
        },
      });
      restoredPermissions.delete(permissionsRead.id);

      await prisma.rolePermission.delete({
        where: {
          organizationId_roleId_permissionId: {
            organizationId: organizationOne.id,
            roleId: roleOne.id,
            permissionId: permissionsRead.id,
          },
        },
      });

      await prisma.rolePermission.create({
        data: {
          organizationId: organizationTwo.id,
          roleId: roleTwo.id,
          permissionId: permissionsRead.id,
        },
      });
      await prisma.employeeRole.create({
        data: {
          organizationId: organizationTwo.id,
          employeeId: employeeTwo.id,
          roleId: roleTwo.id,
        },
      });

      await request(server)
        .get('/authorization-test/permissions-read')
        .set('Cookie', orgOneCookie)
        .expect(403);

      const policyMissingResponse = await request(server)
        .get('/authorization-test/no-policy')
        .set('Cookie', orgOneCookie)
        .expect(403);

      expect(policyMissingResponse.body).toEqual({
        error: {
          code: 'AUTHORIZATION_POLICY_MISSING',
          message: 'Forbidden.',
        },
      });

      const currentSessionResponse = await request(server)
        .get('/auth/session')
        .set('Cookie', noRoleCookie)
        .expect(200);
      const currentSessionBody = currentSessionResponse.body as {
        session: {
          organizationId: string;
          employeeId: string;
          userId: string;
          permissions?: unknown;
          roles?: unknown;
        };
      };

      expect(currentSessionBody).toMatchObject({
        session: {
          organizationId: organizationOne.id,
          employeeId: noRoleEmployee.id,
          userId: noRoleUser.id,
        },
      });
      expect(currentSessionBody.session.permissions).toBeUndefined();
      expect(currentSessionBody.session.roles).toBeUndefined();

      const authorizationResponse = await request(server)
        .get('/auth/authorization')
        .set('Cookie', orgOneCookie)
        .expect(200);
      const authorizationBody = authorizationResponse.body as {
        permissionCodes: string[];
        roles?: unknown;
        employeeId?: unknown;
        organizationId?: unknown;
        sessionId?: unknown;
      };

      expect(authorizationBody.permissionCodes).toEqual(['roles.manage']);
      expect(authorizationBody.roles).toBeUndefined();
      expect(authorizationBody.employeeId).toBeUndefined();
      expect(authorizationBody.organizationId).toBeUndefined();
      expect(authorizationBody.sessionId).toBeUndefined();

      const noRoleAuthorizationResponse = await request(server)
        .get('/auth/authorization')
        .set('Cookie', noRoleCookie)
        .expect(200);

      expect(noRoleAuthorizationResponse.body).toEqual({
        permissionCodes: [],
      });
    } finally {
      const prisma = prismaService;
      if (prisma) {
        restoredPermissions.clear();

        await prisma.userSession.deleteMany({
          where: {
            employeeId: {
              in: cleanup.employeeIds,
            },
          },
        });
        await prisma.employeeRole.deleteMany({
          where: {
            employeeId: {
              in: cleanup.employeeIds,
            },
          },
        });
        await prisma.rolePermission.deleteMany({
          where: {
            roleId: {
              in: cleanup.roleIds,
            },
          },
        });
        await prisma.role.deleteMany({
          where: {
            id: {
              in: cleanup.roleIds,
            },
          },
        });
        await prisma.employee.deleteMany({
          where: {
            id: {
              in: cleanup.employeeIds,
            },
          },
        });
        await prisma.organization.deleteMany({
          where: {
            id: {
              in: cleanup.organizationIds,
            },
          },
        });
        await prisma.user.deleteMany({
          where: {
            id: {
              in: cleanup.userIds,
            },
          },
        });

        expect(
          await prisma.role.count({
            where: {
              id: {
                in: cleanup.roleIds,
              },
            },
          }),
        ).toBe(0);
        expect(
          await prisma.employeeRole.count({
            where: {
              employeeId: {
                in: cleanup.employeeIds,
              },
            },
          }),
        ).toBe(0);
        expect(
          await prisma.rolePermission.count({
            where: {
              roleId: {
                in: cleanup.roleIds,
              },
            },
          }),
        ).toBe(0);
        expect(
          await prisma.userSession.count({
            where: {
              employeeId: {
                in: cleanup.employeeIds,
              },
            },
          }),
        ).toBe(0);
      }

      if (app) {
        await app.close();
      }

      if (moduleRef) {
        await moduleRef.close();
      }
    }
  }, 90000);
});
