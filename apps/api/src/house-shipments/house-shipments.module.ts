import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { AuditModule } from '../audit/audit.module';
import { HouseShipmentsService } from './house-shipments.service';
import { HouseShipmentsRepository } from './house-shipments.repository';
import { PrismaHouseShipmentsRepository } from './prisma-house-shipments.repository';
import {
  HouseShipmentsController,
  MasterShipmentsHouseShipmentsController,
} from './house-shipments.controller';

@Module({
  imports: [PrismaModule, AuditModule],
  controllers: [
    HouseShipmentsController,
    MasterShipmentsHouseShipmentsController,
  ],
  providers: [
    HouseShipmentsService,
    {
      provide: HouseShipmentsRepository,
      useClass: PrismaHouseShipmentsRepository,
    },
  ],
  exports: [HouseShipmentsService],
})
export class HouseShipmentsModule {}
