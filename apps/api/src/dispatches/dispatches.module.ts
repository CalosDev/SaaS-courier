import { Module } from '@nestjs/common';
import { DispatchesController } from './dispatches.controller';
import { DispatchesService } from './dispatches.service';
import { MasterShipmentsController } from './master-shipments.controller';
import { PrismaDispatchesRepository } from './prisma-dispatches.repository';
import { HoldsModule } from '../holds/holds.module';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule, HoldsModule],
  controllers: [DispatchesController, MasterShipmentsController],
  providers: [DispatchesService, PrismaDispatchesRepository],
  exports: [DispatchesService],
})
export class DispatchesModule {}
