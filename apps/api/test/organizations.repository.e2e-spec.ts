import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { randomUUID } from 'node:crypto';
import { AppModule } from '../src/app.module';
import {
  OrganizationNotFoundError,
  OrganizationSlugConflictError,
} from '../src/organizations/organization.errors';
import { OrganizationsService } from '../src/organizations/organizations.service';
import { PrismaService } from '../src/prisma/prisma.service';

const LOCAL_DATABASE_URL =
  'postgresql://courier:courier_dev_password@localhost:5432/courier_saas?schema=public';

describe('Organizations integration', () => {
  const slug = `org-${randomUUID()}`;

  it('creates, reads, conflicts by slug, and hides soft-deleted organizations', async () => {
    let app: INestApplication | null = null;
    let moduleRef: TestingModule | null = null;
    let prismaService: PrismaService | null = null;
    let createdOrganizationId: string | null = null;

    try {
      process.env.DATABASE_URL ??= LOCAL_DATABASE_URL;

      moduleRef = await Test.createTestingModule({
        imports: [AppModule],
      }).compile();

      app = moduleRef.createNestApplication();
      await app.init();

      const organizationsService =
        moduleRef.get<OrganizationsService>(OrganizationsService);
      prismaService = moduleRef.get<PrismaService>(PrismaService);

      const createdOrganization = await organizationsService.create({
        legalName: '  Courier Legal Name  ',
        commercialName: '  Courier Commercial Name  ',
        slug: `  ${slug.toUpperCase()}  `,
        email: '  Ops@Courier.Test  ',
        rnc: '  101010101  ',
        phone: '  809-555-0101  ',
      });
      createdOrganizationId = createdOrganization.id;

      expect(createdOrganization.slug).toBe(slug);
      expect(createdOrganization.status).toBe('TRIAL');
      expect(createdOrganization.planCode).toBe('PILOT');
      expect(createdOrganization.maxUsers).toBe(5);
      expect(createdOrganization.maxFacilities).toBe(2);
      expect(createdOrganization.countryCode).toBe('DO');
      expect(createdOrganization.currencyCode).toBe('DOP');
      expect(createdOrganization.timezone).toBe('America/Santo_Domingo');
      expect(createdOrganization.deletedAt).toBeNull();

      const byId = await organizationsService.getById(createdOrganization.id);
      const bySlug = await organizationsService.getBySlug(slug);

      expect(byId.id).toBe(createdOrganization.id);
      expect(bySlug.id).toBe(createdOrganization.id);

      await expect(
        organizationsService.create({
          legalName: 'Another Legal Name',
          commercialName: 'Another Commercial Name',
          slug,
        }),
      ).rejects.toBeInstanceOf(OrganizationSlugConflictError);

      await prismaService.organization.update({
        where: { id: createdOrganization.id },
        data: { deletedAt: new Date() },
      });

      await expect(
        organizationsService.getById(createdOrganization.id),
      ).rejects.toBeInstanceOf(OrganizationNotFoundError);
      await expect(organizationsService.getBySlug(slug)).rejects.toBeInstanceOf(
        OrganizationNotFoundError,
      );
    } finally {
      if (createdOrganizationId && prismaService) {
        const existingOrganization =
          await prismaService.organization.findUnique({
            where: { id: createdOrganizationId },
          });

        if (existingOrganization) {
          await prismaService.organizationSettings.deleteMany({
            where: { organizationId: createdOrganizationId },
          });
          await prismaService.organization.delete({
            where: { id: createdOrganizationId },
          });
        }

        const remainingOrganization =
          await prismaService.organization.findUnique({
            where: { id: createdOrganizationId },
          });

        expect(remainingOrganization).toBeNull();
      }

      if (app) {
        await app.close();
      }

      if (moduleRef) {
        await moduleRef.close();
      }
    }
  }, 15000);
});
