import { Module } from '@nestjs/common';

import { PackagesModule } from '../packages/packages.module';
import { PrismaModule } from '../prisma/prisma.module';
import { InventoryController } from './inventory.controller';
import { InventoryRepository } from './inventory.repository';
import { InventoryService } from './inventory.service';
import { PrismaInventoryRepository } from './prisma-inventory.repository';

@Module({
  imports: [PrismaModule, PackagesModule],
  controllers: [InventoryController],
  providers: [
    InventoryService,
    PrismaInventoryRepository,
    {
      provide: InventoryRepository,
      useExisting: PrismaInventoryRepository,
    },
  ],
  exports: [InventoryService, InventoryRepository],
})
export class InventoryModule {}
