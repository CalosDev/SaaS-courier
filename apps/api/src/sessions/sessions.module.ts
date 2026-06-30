import { Module } from '@nestjs/common';

import { PrismaModule } from '../prisma/prisma.module';
import { PrismaSessionsRepository } from './prisma-sessions.repository';
import { SessionTokenService } from './session-token.service';
import { SessionsRepository } from './sessions.repository';
import { SessionsService } from './sessions.service';

@Module({
  imports: [PrismaModule],
  providers: [
    SessionTokenService,
    SessionsService,
    {
      provide: SessionsRepository,
      useClass: PrismaSessionsRepository,
    },
  ],
  exports: [SessionsService],
})
export class SessionsModule {}
