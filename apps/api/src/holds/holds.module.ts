import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { SessionsModule } from '../sessions/sessions.module';
import { HoldsController } from './holds.controller';
import { HoldsService } from './holds.service';
import { OperationalHoldGuard } from './operational-hold.guard';
import { PrismaHoldsRepository } from './prisma-holds.repository';

@Module({
  imports: [PrismaModule, SessionsModule],
  controllers: [HoldsController],
  providers: [HoldsService, OperationalHoldGuard, PrismaHoldsRepository],
  exports: [HoldsService, OperationalHoldGuard],
})
export class HoldsModule {}
