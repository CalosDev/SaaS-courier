import { Module } from '@nestjs/common';

import { PrismaModule } from '../prisma/prisma.module';
import { FacilitiesController } from './facilities.controller';
import { FacilitiesRepository } from './facilities.repository';
import { FacilitiesService } from './facilities.service';
import { PrismaFacilitiesRepository } from './prisma-facilities.repository';

@Module({
  imports: [PrismaModule],
  controllers: [FacilitiesController],
  providers: [
    FacilitiesService,
    PrismaFacilitiesRepository,
    {
      provide: FacilitiesRepository,
      useExisting: PrismaFacilitiesRepository,
    },
  ],
  exports: [FacilitiesService],
})
export class FacilitiesModule {}
