import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { SessionsModule } from '../sessions/sessions.module';
import { CorrectionsController } from './corrections.controller';
import { CorrectionsService } from './corrections.service';
import { PrismaCorrectionsRepository } from './prisma-corrections.repository';

@Module({
  imports: [PrismaModule, SessionsModule],
  controllers: [CorrectionsController],
  providers: [CorrectionsService, PrismaCorrectionsRepository],
  exports: [CorrectionsService],
})
export class CorrectionsModule {}
