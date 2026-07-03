import { Module } from '@nestjs/common';

import { PrismaModule } from '../prisma/prisma.module';
import { AuditController } from './audit.controller';
import { AuditRepository } from './audit.repository';
import { AuditService } from './audit.service';
import { PrismaAuditRepository } from './prisma-audit.repository';

@Module({
  imports: [PrismaModule],
  controllers: [AuditController],
  providers: [
    AuditService,
    { provide: AuditRepository, useClass: PrismaAuditRepository },
  ],
})
export class AuditModule {}
