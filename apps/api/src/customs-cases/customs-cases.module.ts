import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { CustomsCasesController } from './customs-cases.controller';
import { CustomsCasesService } from './customs-cases.service';
import { PrismaCustomsCasesRepository } from './prisma-customs-cases.repository';

@Module({
  imports: [PrismaModule],
  controllers: [CustomsCasesController],
  providers: [CustomsCasesService, PrismaCustomsCasesRepository],
  exports: [CustomsCasesService],
})
export class CustomsCasesModule {}
