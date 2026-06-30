import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { randomUUID } from 'node:crypto';

import { PasswordHasher } from '../src/accounts/password-hasher';
import { InvalidSessionTokenError } from '../src/sessions/session.errors';
import { SessionTokenService } from '../src/sessions/session-token.service';
import { SessionsService } from '../src/sessions/sessions.service';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';

const LOCAL_DATABASE_URL =
  'postgresql://courier:courier_dev_password@localhost:5432/courier_saas?schema=public';

describe('Sessions integration', () => {
  it('creates, validates, rotates, revokes, and globally revokes persistent sessions safely', async () => {
    let app: INestApplication | null = null;
    let moduleRef: TestingModule | null = null;
    let prismaService: PrismaService | null = null;
    const cleanup = {
      sessionIds: [] as string[],
      employeeFacilityIds: [] as string[],
      employeeIds: [] as string[],
      facilityIds: [] as string[],
      organizationIds: [] as string[],
      userIds: [] as string[],
    };

    try {
      process.env.DATABASE_URL ??= LOCAL_DATABASE_URL;

      moduleRef = await Test.createTestingModule({
        imports: [AppModule],
      }).compile();

      app = moduleRef.createNestApplication();
      await app.init();

      const sessionsService = moduleRef.get<SessionsService>(SessionsService);
      const passwordHasher = moduleRef.get<PasswordHasher>(PasswordHasher);
      const sessionTokenService =
        moduleRef.get<SessionTokenService>(SessionTokenService);
      prismaService = moduleRef.get<PrismaService>(PrismaService);

      const suffix = randomUUID();
      const shortCode = suffix.slice(0, 8).toUpperCase();
      const passwordHash = await passwordHasher.hash(
        'Correct Horse Battery Staple',
      );

      const organizationOne = await prismaService.organization.create({
        data: {
          legalName: `Session One ${suffix}`,
          commercialName: `Session One ${suffix}`,
          slug: `session-one-${suffix}`,
          status: 'ACTIVE',
        },
      });
      cleanup.organizationIds.push(organizationOne.id);

      const organizationTwo = await prismaService.organization.create({
        data: {
          legalName: `Session Two ${suffix}`,
          commercialName: `Session Two ${suffix}`,
          slug: `session-two-${suffix}`,
          status: 'TRIAL',
        },
      });
      cleanup.organizationIds.push(organizationTwo.id);

      const user = await prismaService.user.create({
        data: {
          email: `session.${suffix}@courier.test`,
          passwordHash,
          passwordChangedAt: new Date('2026-06-28T00:00:00.000Z'),
          emailVerifiedAt: new Date('2026-06-28T00:00:00.000Z'),
          status: 'ACTIVE',
        },
      });
      cleanup.userIds.push(user.id);

      const employeeOne = await prismaService.employee.create({
        data: {
          organizationId: organizationOne.id,
          userId: user.id,
          employeeCode: `SES-1-${shortCode}`,
          firstName: 'Ada',
          lastName: 'Lovelace',
          status: 'ACTIVE',
        },
      });
      cleanup.employeeIds.push(employeeOne.id);

      const employeeTwo = await prismaService.employee.create({
        data: {
          organizationId: organizationTwo.id,
          userId: user.id,
          employeeCode: `SES-2-${shortCode}`,
          firstName: 'Ada',
          lastName: 'Lovelace',
          status: 'ACTIVE',
        },
      });
      cleanup.employeeIds.push(employeeTwo.id);

      const facilityOne = await prismaService.facility.create({
        data: {
          organizationId: organizationOne.id,
          code: `SES1-${shortCode}`,
          name: 'Primary Session Facility',
          type: 'BRANCH',
          isActive: true,
        },
      });
      cleanup.facilityIds.push(facilityOne.id);

      const facilityTwo = await prismaService.facility.create({
        data: {
          organizationId: organizationTwo.id,
          code: `SES2-${shortCode}`,
          name: 'Secondary Session Facility',
          type: 'BRANCH',
          isActive: true,
        },
      });
      cleanup.facilityIds.push(facilityTwo.id);

      cleanup.employeeFacilityIds.push(
        (
          await prismaService.employeeFacility.create({
            data: {
              organizationId: organizationOne.id,
              employeeId: employeeOne.id,
              facilityId: facilityOne.id,
              isPrimary: true,
            },
          })
        ).id,
      );
      cleanup.employeeFacilityIds.push(
        (
          await prismaService.employeeFacility.create({
            data: {
              organizationId: organizationTwo.id,
              employeeId: employeeTwo.id,
              facilityId: facilityTwo.id,
              isPrimary: true,
            },
          })
        ).id,
      );

      const created = await sessionsService.createSession({
        userId: user.id,
        organizationId: organizationOne.id,
        ipAddress: '127.0.0.1',
        userAgent: 'Jest Integration',
      });

      const persistedInitialSession =
        await prismaService.userSession.findUniqueOrThrow({
          where: {
            id: created.session.sessionId,
          },
        });
      cleanup.sessionIds.push(persistedInitialSession.id);

      expect(created.sessionToken).toMatch(/^cs1\.[A-Za-z0-9_-]{43}$/);
      expect(persistedInitialSession.tokenHash).toMatch(/^[a-f0-9]{64}$/);
      expect(persistedInitialSession.tokenHash).not.toBe(created.sessionToken);

      const validated = await sessionsService.validateSession({
        sessionToken: created.sessionToken,
      });

      expect(validated.organizationId).toBe(organizationOne.id);
      expect(validated.facilityIds).toEqual([facilityOne.id]);

      const rotated = await sessionsService.rotateSession({
        sessionToken: created.sessionToken,
        ipAddress: '127.0.0.1',
        userAgent: 'Jest Integration Rotated',
      });

      const originalAfterRotation =
        await prismaService.userSession.findUniqueOrThrow({
          where: {
            id: created.session.sessionId,
          },
        });
      const rotatedPersisted =
        await prismaService.userSession.findUniqueOrThrow({
          where: {
            id: rotated.session.sessionId,
          },
        });
      cleanup.sessionIds.push(rotatedPersisted.id);

      expect(originalAfterRotation.revokedAt).toBeInstanceOf(Date);
      expect(originalAfterRotation.revocationReason).toBe('ROTATED');
      expect(rotatedPersisted.rotatedFromSessionId).toBe(
        originalAfterRotation.id,
      );
      expect(rotatedPersisted.expiresAt).toEqual(
        originalAfterRotation.expiresAt,
      );

      await expect(
        sessionsService.validateSession({
          sessionToken: created.sessionToken,
        }),
      ).rejects.toBeInstanceOf(InvalidSessionTokenError);

      const rotatedAfterReuse =
        await prismaService.userSession.findUniqueOrThrow({
          where: {
            id: rotated.session.sessionId,
          },
        });

      expect(rotatedAfterReuse.revocationReason).toBe('REUSE_DETECTED');

      await expect(
        sessionsService.validateSession({
          sessionToken: rotated.sessionToken,
        }),
      ).rejects.toBeInstanceOf(InvalidSessionTokenError);

      const logoutSession = await sessionsService.createSession({
        userId: user.id,
        organizationId: organizationOne.id,
      });
      cleanup.sessionIds.push(logoutSession.session.sessionId);

      await expect(
        sessionsService.revokeSession({
          sessionToken: logoutSession.sessionToken,
        }),
      ).resolves.toBeUndefined();
      await expect(
        sessionsService.revokeSession({
          sessionToken: logoutSession.sessionToken,
        }),
      ).resolves.toBeUndefined();

      const crossTenantSessionOne = await sessionsService.createSession({
        userId: user.id,
        organizationId: organizationOne.id,
      });
      cleanup.sessionIds.push(crossTenantSessionOne.session.sessionId);

      const crossTenantSessionTwo = await sessionsService.createSession({
        userId: user.id,
        organizationId: organizationTwo.id,
      });
      cleanup.sessionIds.push(crossTenantSessionTwo.session.sessionId);

      await expect(
        sessionsService.revokeAllUserSessions({
          userId: user.id,
          reason: 'ACCOUNT_CHANGED',
        }),
      ).resolves.toBeGreaterThanOrEqual(2);

      const expiredSecret = sessionTokenService.createSecret();
      const expiredSessionId = randomUUID();
      await prismaService.userSession.create({
        data: {
          id: expiredSessionId,
          familyId: expiredSessionId,
          organizationId: organizationOne.id,
          employeeId: employeeOne.id,
          tokenHash: expiredSecret.tokenHash,
          expiresAt: new Date(Date.now() + 60 * 60 * 1000),
          lastSeenAt: new Date(),
        },
      });
      cleanup.sessionIds.push(expiredSessionId);
      await prismaService.userSession.update({
        where: {
          id: expiredSessionId,
        },
        data: {
          createdAt: new Date(Date.now() - 2 * 60 * 60 * 1000),
          expiresAt: new Date(Date.now() - 60_000),
          lastSeenAt: new Date(Date.now() - 60_000),
        },
      });

      const idleSecret = sessionTokenService.createSecret();
      const idleSessionId = randomUUID();
      await prismaService.userSession.create({
        data: {
          id: idleSessionId,
          familyId: idleSessionId,
          organizationId: organizationOne.id,
          employeeId: employeeOne.id,
          tokenHash: idleSecret.tokenHash,
          expiresAt: new Date(Date.now() + 60 * 60 * 1000),
          lastSeenAt: new Date(),
        },
      });
      cleanup.sessionIds.push(idleSessionId);
      await prismaService.userSession.update({
        where: {
          id: idleSessionId,
        },
        data: {
          lastSeenAt: new Date(Date.now() - 31 * 60 * 1000),
        },
      });

      await expect(
        sessionsService.validateSession({
          sessionToken: expiredSecret.token,
        }),
      ).rejects.toBeInstanceOf(InvalidSessionTokenError);

      await expect(
        sessionsService.validateSession({
          sessionToken: idleSecret.token,
        }),
      ).rejects.toBeInstanceOf(InvalidSessionTokenError);
    } finally {
      if (prismaService) {
        for (const sessionId of [...cleanup.sessionIds].reverse()) {
          await prismaService.userSession.deleteMany({
            where: {
              id: sessionId,
            },
          });
        }

        for (const employeeFacilityId of cleanup.employeeFacilityIds) {
          await prismaService.employeeFacility.deleteMany({
            where: {
              id: employeeFacilityId,
            },
          });
        }

        for (const employeeId of cleanup.employeeIds) {
          await prismaService.employee.deleteMany({
            where: {
              id: employeeId,
            },
          });
        }

        for (const facilityId of cleanup.facilityIds) {
          await prismaService.facility.deleteMany({
            where: {
              id: facilityId,
            },
          });
        }

        for (const organizationId of cleanup.organizationIds) {
          await prismaService.organization.deleteMany({
            where: {
              id: organizationId,
            },
          });
        }

        for (const userId of cleanup.userIds) {
          await prismaService.user.deleteMany({
            where: {
              id: userId,
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
  }, 45000);
});
