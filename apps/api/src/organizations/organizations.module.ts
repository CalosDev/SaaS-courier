import { Module } from '@nestjs/common';

import { PrismaModule } from '../prisma/prisma.module';
import { PrismaOrganizationsRepository } from './prisma-organizations.repository';
import { OrganizationsRepository } from './organizations.repository';
import { OrganizationsController } from './organizations.controller';
import { OrganizationsService } from './organizations.service';

@Module({
  imports: [PrismaModule],
  controllers: [OrganizationsController],
  providers: [
    OrganizationsService,
    PrismaOrganizationsRepository,
    {
      provide: OrganizationsRepository,
      useExisting: PrismaOrganizationsRepository,
    },
  ],
  exports: [OrganizationsService],
})
export class OrganizationsModule {}
