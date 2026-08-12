import { Module } from '@nestjs/common';

import { PrismaModule } from '../prisma/prisma.module';
import { PrismaOrganizationsRepository } from './prisma-organizations.repository';
import { OrganizationsRepository } from './organizations.repository';
import { OrganizationsController } from './organizations.controller';
import { OrganizationsService } from './organizations.service';
import { OrganizationRegulatoryProfileRepository } from './organization-regulatory-profile.repository';
import { OrganizationRegulatoryProfileService } from './organization-regulatory-profile.service';
import { PrismaOrganizationRegulatoryProfileRepository } from './prisma-organization-regulatory-profile.repository';

@Module({
  imports: [PrismaModule],
  controllers: [OrganizationsController],
  providers: [
    OrganizationsService,
    OrganizationRegulatoryProfileService,
    PrismaOrganizationRegulatoryProfileRepository,
    PrismaOrganizationsRepository,
    {
      provide: OrganizationsRepository,
      useExisting: PrismaOrganizationsRepository,
    },
    {
      provide: OrganizationRegulatoryProfileRepository,
      useExisting: PrismaOrganizationRegulatoryProfileRepository,
    },
  ],
  exports: [OrganizationsService, OrganizationRegulatoryProfileService],
})
export class OrganizationsModule {}
