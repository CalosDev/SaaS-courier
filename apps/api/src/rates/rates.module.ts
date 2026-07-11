import { Module } from '@nestjs/common';

import { OrganizationSettingsModule } from '../organization-settings/organization-settings.module';
import { PrismaModule } from '../prisma/prisma.module';
import { CourierServicesController } from './courier-services.controller';
import { PrismaRatesRepository } from './prisma-rates.repository';
import { RateCardsController } from './rate-cards.controller';
import { RatesController } from './rates.controller';
import { RatesRepository } from './rates.repository';
import { RatesService } from './rates.service';

@Module({
  imports: [PrismaModule, OrganizationSettingsModule],
  controllers: [
    CourierServicesController,
    RateCardsController,
    RatesController,
  ],
  providers: [
    RatesService,
    PrismaRatesRepository,
    {
      provide: RatesRepository,
      useExisting: PrismaRatesRepository,
    },
  ],
  exports: [RatesService, RatesRepository],
})
export class RatesModule {}
