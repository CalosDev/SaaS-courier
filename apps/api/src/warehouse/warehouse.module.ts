import { Module } from '@nestjs/common';

import { ExternalTrackingNormalizer } from '../common/tracking/external-tracking-normalizer';
import { InventoryModule } from '../inventory/inventory.module';
import { PrismaModule } from '../prisma/prisma.module';
import { WarehouseController } from './warehouse.controller';
import { WarehouseService } from './warehouse.service';

@Module({
  imports: [PrismaModule, InventoryModule],
  controllers: [WarehouseController],
  providers: [WarehouseService, ExternalTrackingNormalizer],
})
export class WarehouseModule {}
