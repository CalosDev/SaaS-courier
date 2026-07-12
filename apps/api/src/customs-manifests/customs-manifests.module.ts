import { Module } from '@nestjs/common';
import { CustomsManifestsService } from './customs-manifests.service';
import { CustomsManifestsController } from './customs-manifests.controller';
import { CustomsManifestsRepositoryToken } from './customs-manifests.repository';
import { PrismaCustomsManifestsRepository } from './prisma-customs-manifests.repository';
import { PrismaModule } from '../prisma/prisma.module';
import { AuditModule } from '../audit/audit.module';
import { HoldsModule } from '../holds/holds.module';
import { SigaIntegrationModule } from '../siga-integration/siga-integration.module';

@Module({
  imports: [PrismaModule, AuditModule, HoldsModule, SigaIntegrationModule],
  controllers: [CustomsManifestsController],
  providers: [
    CustomsManifestsService,
    {
      provide: CustomsManifestsRepositoryToken,
      useClass: PrismaCustomsManifestsRepository,
    },
  ],
  exports: [CustomsManifestsService, CustomsManifestsRepositoryToken],
})
export class CustomsManifestsModule {}
