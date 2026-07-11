import { Module } from '@nestjs/common';

import { ExternalTrackingNormalizer } from '../common/tracking/external-tracking-normalizer';
import { CustomersModule } from '../customers/customers.module';
import { OrganizationsModule } from '../organizations/organizations.module';
import { PrismaModule } from '../prisma/prisma.module';
import { CarrierIntegrationsModule } from '../carrier-integrations/carrier-integrations.module';
import { PrealertCodeService } from './prealert-code.service';
import { PrismaPrealertsRepository } from './prisma-prealerts.repository';
import { PrealertsController } from './prealerts.controller';
import { PrealertsRepository } from './prealerts.repository';
import { PrealertsService } from './prealerts.service';

@Module({
  imports: [
    PrismaModule,
    CustomersModule,
    OrganizationsModule,
    CarrierIntegrationsModule,
  ],
  controllers: [PrealertsController],
  providers: [
    PrealertCodeService,
    ExternalTrackingNormalizer,
    PrealertsService,
    PrismaPrealertsRepository,
    {
      provide: PrealertsRepository,
      useExisting: PrismaPrealertsRepository,
    },
  ],
  exports: [PrealertsService, PrealertsRepository],
})
export class PrealertsModule {}
