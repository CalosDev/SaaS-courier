import { Module } from '@nestjs/common';
import { DeliveriesController } from './deliveries.controller';
import { DeliveriesService } from './deliveries.service';

import { PrismaModule } from '../prisma/prisma.module';
import { AuditModule } from '../audit/audit.module';

@Module({
  imports: [PrismaModule, AuditModule],
  controllers: [DeliveriesController],
  providers: [DeliveriesService],
  exports: [DeliveriesService],
})
export class DeliveriesModule {}
