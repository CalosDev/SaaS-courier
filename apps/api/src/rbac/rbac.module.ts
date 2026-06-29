import { Module } from '@nestjs/common';

import { PrismaModule } from '../prisma/prisma.module';
import { PrismaRbacRepository } from './prisma-rbac.repository';
import { RbacRepository } from './rbac.repository';
import { RbacService } from './rbac.service';

@Module({
  imports: [PrismaModule],
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
