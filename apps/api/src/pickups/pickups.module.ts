import { Module } from '@nestjs/common';
import { PickupRequestsService } from './pickups.service';
import { PickupRequestsController } from './pickups.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { AuditModule } from '../audit/audit.module';
import { HoldsModule } from '../holds/holds.module';

@Module({
  imports: [PrismaModule, AuditModule, HoldsModule],
  controllers: [PickupRequestsController],
  providers: [PickupRequestsService],
  exports: [PickupRequestsService],
})
export class PickupRequestsModule {}
