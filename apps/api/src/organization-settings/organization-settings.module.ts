import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { OnboardingService } from './onboarding.service';
import { OrganizationSettingsController } from './organization-settings.controller';
import { OrganizationSettingsRepository } from './organization-settings.repository';
import { OrganizationSettingsService } from './organization-settings.service';
import { PlanCatalogService } from './plan-catalog.service';
import { PrismaOrganizationSettingsRepository } from './prisma-organization-settings.repository';

@Module({
  imports: [PrismaModule],
  controllers: [OrganizationSettingsController],
  providers: [
    PlanCatalogService,
    OnboardingService,
    OrganizationSettingsService,
    PrismaOrganizationSettingsRepository,
    {
      provide: OrganizationSettingsRepository,
      useExisting: PrismaOrganizationSettingsRepository,
    },
  ],
  exports: [PlanCatalogService, OnboardingService, OrganizationSettingsService],
})
export class OrganizationSettingsModule {}
