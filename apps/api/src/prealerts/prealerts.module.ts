import { Module } from '@nestjs/common';

import { CustomersModule } from '../customers/customers.module';
import { OrganizationsModule } from '../organizations/organizations.module';
import { PrismaModule } from '../prisma/prisma.module';
import { PrealertCodeService } from './prealert-code.service';
import { PrealertTrackingNormalizer } from './prealert-tracking-normalizer';
import { PrismaPrealertsRepository } from './prisma-prealerts.repository';
import { PrealertsController } from './prealerts.controller';
import { PrealertsRepository } from './prealerts.repository';
import { PrealertsService } from './prealerts.service';

@Module({
  imports: [PrismaModule, CustomersModule, OrganizationsModule],
  controllers: [PrealertsController],
  providers: [
    PrealertCodeService,
    PrealertTrackingNormalizer,
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
