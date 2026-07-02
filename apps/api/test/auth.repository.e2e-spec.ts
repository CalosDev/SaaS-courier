import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { randomUUID } from 'node:crypto';

import { PasswordHasher } from '../src/accounts/password-hasher';
import {
  AccountTemporarilyLockedError,
  InvalidCredentialsError,
  OrganizationAccessDeniedError,
} from '../src/auth/auth.errors';
import { AuthService } from '../src/auth/auth.service';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';

const LOCAL_DATABASE_URL =
  'postgresql://courier:courier_dev_password@localhost:5432/courier_saas?schema=public';

describe('Auth integration', () => {
  it('authenticates safely, locks on the fifth failure, and revalidates organization access', async () => {
    let app: INestApplication | null = null;
    let moduleRef: TestingModule | null = null;
    let prismaService: PrismaService | null = null;
    const cleanup = {
      userIds: [] as string[],
      organizationIds: [] as string[],
      employeeIds: [] as string[],
      facilityIds: [] as string[],
      employeeFacilityIds: [] as string[],
    };

    try {
      process.env.DATABASE_URL ??= LOCAL_DATABASE_URL;

      moduleRef = await Test.createTestingModule({
        imports: [AppModule],
      }).compile();

      app = moduleRef.createNestApplication();
      await app.init();

      const authService = moduleRef.get<AuthService>(AuthService);
      const passwordHasher = moduleRef.get<PasswordHasher>(PasswordHasher);
      prismaService = moduleRef.get<PrismaService>(PrismaService);

      const suffix = randomUUID();
      const shortCode = suffix.slice(0, 8);
      const facilityCodeSuffix = shortCode.toUpperCase();
      const password = 'Correct Horse Battery Staple';
      const passwordHash = await passwordHasher.hash(password);
      const email = `auth.${suffix}@courier.test`;

      const activeOrganizationOne = await prismaService.organization.create({
        data: {
          legalName: `Courier One ${suffix}`,
          commercialName: `Courier One ${suffix}`,
          slug: `auth-one-${suffix}`,
          email: `ops-one-${suffix}@courier.test`,
          status: 'ACTIVE',
        },
      });
      cleanup.organizationIds.push(activeOrganizationOne.id);

      const activeOrganizationTwo = await prismaService.organization.create({
        data: {
          legalName: `Courier Two ${suffix}`,
          commercialName: `Courier Two ${suffix}`,
          slug: `auth-two-${suffix}`,
          email: `ops-two-${suffix}@courier.test`,
          status: 'TRIAL',
        },
      });
      cleanup.organizationIds.push(activeOrganizationTwo.id);

      const suspendedOrganization = await prismaService.organization.create({
        data: {
          legalName: `Courier Suspended ${suffix}`,
          commercialName: `Courier Suspended ${suffix}`,
          slug: `auth-suspended-${suffix}`,
          email: `ops-suspended-${suffix}@courier.test`,
          status: 'SUSPENDED',
        },
      });
      cleanup.organizationIds.push(suspendedOrganization.id);

      const user = await prismaService.user.create({
        data: {
          email,
          passwordHash,
          passwordChangedAt: new Date('2026-06-28T00:00:00.000Z'),
          emailVerifiedAt: new Date('2026-06-28T00:00:00.000Z'),
          status: 'ACTIVE',
        },
      });
      cleanup.userIds.push(user.id);

      const employeeOne = await prismaService.employee.create({
        data: {
          organizationId: activeOrganizationOne.id,
          userId: user.id,
          employeeCode: `EMP-ONE-${shortCode}`,
          firstName: 'Ada',
          lastName: 'Lovelace',
          status: 'ACTIVE',
        },
      });
      cleanup.employeeIds.push(employeeOne.id);

      const employeeTwo = await prismaService.employee.create({
        data: {
          organizationId: activeOrganizationTwo.id,
          userId: user.id,
          employeeCode: `EMP-TWO-${shortCode}`,
          firstName: 'Ada',
          lastName: 'Lovelace',
          status: 'ACTIVE',
        },
      });
      cleanup.employeeIds.push(employeeTwo.id);

      const suspendedEmployee = await prismaService.employee.create({
        data: {
          organizationId: suspendedOrganization.id,
          userId: user.id,
          employeeCode: `EMP-SUSP-${shortCode}`,
          firstName: 'Ada',
          lastName: 'Lovelace',
          status: 'ACTIVE',
        },
      });
      cleanup.employeeIds.push(suspendedEmployee.id);

      const facilityOnePrimary = await prismaService.facility.create({
        data: {
          organizationId: activeOrganizationOne.id,
          code: `F1-${facilityCodeSuffix}`,
          name: 'Primary Facility',
          type: 'BRANCH',
          isActive: true,
        },
      });
      cleanup.facilityIds.push(facilityOnePrimary.id);

      const facilityOneSecondary = await prismaService.facility.create({
        data: {
          organizationId: activeOrganizationOne.id,
          code: `F2-${facilityCodeSuffix}`,
          name: 'Secondary Facility',
          type: 'BRANCH',
          isActive: true,
        },
      });
      cleanup.facilityIds.push(facilityOneSecondary.id);

      const facilityOneInactive = await prismaService.facility.create({
        data: {
          organizationId: activeOrganizationOne.id,
          code: `F3-${facilityCodeSuffix}`,
          name: 'Inactive Facility',
          type: 'BRANCH',
          isActive: false,
        },
      });
      cleanup.facilityIds.push(facilityOneInactive.id);

      const facilityTwo = await prismaService.facility.create({
        data: {
          organizationId: activeOrganizationTwo.id,
          code: `F4-${facilityCodeSuffix}`,
          name: 'Trial Facility',
          type: 'BRANCH',
          isActive: true,
        },
      });
      cleanup.facilityIds.push(facilityTwo.id);

      const suspendedFacility = await prismaService.facility.create({
        data: {
          organizationId: suspendedOrganization.id,
          code: `F5-${facilityCodeSuffix}`,
          name: 'Suspended Facility',
          type: 'BRANCH',
          isActive: true,
        },
      });
      cleanup.facilityIds.push(suspendedFacility.id);

      cleanup.employeeFacilityIds.push(
        (
          await prismaService.employeeFacility.create({
            data: {
              organizationId: activeOrganizationOne.id,
              employeeId: employeeOne.id,
              facilityId: facilityOnePrimary.id,
              isPrimary: true,
            },
          })
        ).id,
      );
      cleanup.employeeFacilityIds.push(
        (
          await prismaService.employeeFacility.create({
            data: {
              organizationId: activeOrganizationOne.id,
              employeeId: employeeOne.id,
              facilityId: facilityOneSecondary.id,
            },
          })
        ).id,
      );
      cleanup.employeeFacilityIds.push(
        (
          await prismaService.employeeFacility.create({
            data: {
              organizationId: activeOrganizationOne.id,
              employeeId: employeeOne.id,
              facilityId: facilityOneInactive.id,
            },
          })
        ).id,
      );
      cleanup.employeeFacilityIds.push(
        (
          await prismaService.employeeFacility.create({
            data: {
              organizationId: activeOrganizationTwo.id,
              employeeId: employeeTwo.id,
              facilityId: facilityTwo.id,
              isPrimary: true,
            },
          })
        ).id,
      );
      cleanup.employeeFacilityIds.push(
        (
          await prismaService.employeeFacility.create({
            data: {
              organizationId: suspendedOrganization.id,
              employeeId: suspendedEmployee.id,
              facilityId: suspendedFacility.id,
              isPrimary: true,
            },
          })
        ).id,
      );

      const initialAuthentication = await authService.authenticateCredentials({
        email: `  ${email.toUpperCase()}  `,
        password,
      });

      expect(initialAuthentication.userId).toBe(user.id);
      expect(initialAuthentication.email).toBe(email);
      expect(initialAuthentication.organizations).toHaveLength(2);
      expect(initialAuthentication.organizations).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            organizationId: activeOrganizationOne.id,
            organizationSlug: activeOrganizationOne.slug,
            organizationName: activeOrganizationOne.commercialName,
            organizationStatus: 'ACTIVE',
            employeeId: employeeOne.id,
            employeeCode: employeeOne.employeeCode ?? undefined,
            firstName: employeeOne.firstName,
            lastName: employeeOne.lastName,
            facilityIds: [facilityOnePrimary.id, facilityOneSecondary.id],
            primaryFacilityId: facilityOnePrimary.id,
          }),
          expect.objectContaining({
            organizationId: activeOrganizationTwo.id,
            organizationSlug: activeOrganizationTwo.slug,
            organizationName: activeOrganizationTwo.commercialName,
            organizationStatus: 'TRIAL',
            employeeId: employeeTwo.id,
            employeeCode: employeeTwo.employeeCode ?? undefined,
            firstName: employeeTwo.firstName,
            lastName: employeeTwo.lastName,
            facilityIds: [facilityTwo.id],
            primaryFacilityId: facilityTwo.id,
          }),
        ]),
      );
      expect(initialAuthentication.organizations).not.toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            organizationId: suspendedOrganization.id,
          }),
        ]),
      );

      await expect(
        authService.selectOrganization({
          userId: user.id,
          organizationId: activeOrganizationOne.id,
        }),
      ).resolves.toEqual({
        userId: user.id,
        email,
        organizationId: activeOrganizationOne.id,
        organizationSlug: activeOrganizationOne.slug,
        organizationName: activeOrganizationOne.commercialName,
        employeeId: employeeOne.id,
        employeeCode: employeeOne.employeeCode ?? undefined,
        firstName: employeeOne.firstName,
        lastName: employeeOne.lastName,
        facilityIds: [facilityOnePrimary.id, facilityOneSecondary.id],
        primaryFacilityId: facilityOnePrimary.id,
      });

      await expect(
        authService.selectOrganization({
          userId: user.id,
          organizationId: activeOrganizationTwo.id,
        }),
      ).resolves.toEqual({
        userId: user.id,
        email,
        organizationId: activeOrganizationTwo.id,
        organizationSlug: activeOrganizationTwo.slug,
        organizationName: activeOrganizationTwo.commercialName,
        employeeId: employeeTwo.id,
        employeeCode: employeeTwo.employeeCode ?? undefined,
        firstName: employeeTwo.firstName,
        lastName: employeeTwo.lastName,
        facilityIds: [facilityTwo.id],
        primaryFacilityId: facilityTwo.id,
      });

      await expect(
        authService.selectOrganization({
          userId: user.id,
          organizationId: suspendedOrganization.id,
        }),
      ).rejects.toBeInstanceOf(OrganizationAccessDeniedError);

      for (let attempt = 1; attempt <= 4; attempt += 1) {
        await expect(
          authService.authenticateCredentials({
            email,
            password: 'wrong-password',
          }),
        ).rejects.toBeInstanceOf(InvalidCredentialsError);

        const persistedUser = await prismaService.user.findUniqueOrThrow({
          where: {
            id: user.id,
          },
        });

        expect(persistedUser.failedLoginAttempts).toBe(attempt);
        expect(persistedUser.lockedUntil).toBeNull();
      }

      const lockStartedAt = Date.now();

      await expect(
        authService.authenticateCredentials({
          email,
          password: 'wrong-password',
        }),
      ).rejects.toBeInstanceOf(AccountTemporarilyLockedError);

      const lockedUser = await prismaService.user.findUniqueOrThrow({
        where: {
          id: user.id,
        },
      });

      expect(lockedUser.failedLoginAttempts).toBe(5);
      expect(lockedUser.lockedUntil).toBeInstanceOf(Date);

      const lockDurationMs =
        (lockedUser.lockedUntil?.getTime() ?? 0) - lockStartedAt;

      expect(lockDurationMs).toBeGreaterThanOrEqual(5 * 60 * 1000 - 10_000);
      expect(lockDurationMs).toBeLessThanOrEqual(5 * 60 * 1000 + 10_000);

      await expect(
        authService.authenticateCredentials({
          email,
          password,
        }),
      ).rejects.toBeInstanceOf(AccountTemporarilyLockedError);

      const previousLastLoginAt = (
        await prismaService.user.findUniqueOrThrow({
          where: {
            id: user.id,
          },
        })
      ).lastLoginAt;

      await prismaService.user.update({
        where: {
          id: user.id,
        },
        data: {
          lockedUntil: new Date(Date.now() - 60_000),
        },
      });

      const authenticatedAfterExpiry =
        await authService.authenticateCredentials({
          email,
          password,
        });

      expect(authenticatedAfterExpiry.organizations).toHaveLength(2);

      const unlockedUser = await prismaService.user.findUniqueOrThrow({
        where: {
          id: user.id,
        },
      });

      expect(unlockedUser.failedLoginAttempts).toBe(0);
      expect(unlockedUser.lockedUntil).toBeNull();
      expect(unlockedUser.lastLoginAt).toBeInstanceOf(Date);

      if (previousLastLoginAt) {
        expect(unlockedUser.lastLoginAt!.getTime()).toBeGreaterThanOrEqual(
          previousLastLoginAt.getTime(),
        );
      }

      expect(
        await prismaService.userSession.count({
          where: {
            organizationId: {
              in: cleanup.organizationIds,
            },
          },
        }),
      ).toBe(0);
    } finally {
      if (prismaService) {
        for (const organizationId of cleanup.organizationIds) {
          await prismaService.userSession.deleteMany({
            where: {
              organizationId,
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
  }, 30000);
});
