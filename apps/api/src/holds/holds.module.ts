import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { SessionsModule } from '../sessions/sessions.module';
import { HoldsController } from './holds.controller';
import { HoldsService } from './holds.service';
import { PrismaHoldsRepository } from './prisma-holds.repository';

@Module({
  imports: [PrismaModule, SessionsModule],
  controllers: [HoldsController],
  providers: [HoldsService, PrismaHoldsRepository],
  exports: [HoldsService],
})
export class HoldsModule {}
