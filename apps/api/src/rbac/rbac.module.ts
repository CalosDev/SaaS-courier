import { Module } from '@nestjs/common';

import { PrismaModule } from '../prisma/prisma.module';
import { RbacController } from './rbac.controller';
import { PrismaRbacRepository } from './prisma-rbac.repository';
import { RbacRepository } from './rbac.repository';
import { RbacService } from './rbac.service';

@Module({
  imports: [PrismaModule],
  controllers: [RbacController],
  providers: [
    RbacService,
    {
      provide: RbacRepository,
      useClass: PrismaRbacRepository,
    },
  ],
  exports: [RbacService],
})
export class RbacModule {}
