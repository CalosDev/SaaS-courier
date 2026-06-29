import { Module } from '@nestjs/common';

import { AccountsModule } from '../accounts/accounts.module';
import { PrismaModule } from '../prisma/prisma.module';
import { AuthRepository } from './auth.repository';
import { AuthService } from './auth.service';
import { LoginLockoutPolicy } from './login-lockout.policy';
import { PrismaAuthRepository } from './prisma-auth.repository';

@Module({
  imports: [PrismaModule, AccountsModule],
  providers: [
    AuthService,
    LoginLockoutPolicy,
    {
      provide: AuthRepository,
      useClass: PrismaAuthRepository,
    },
  ],
  exports: [AuthService],
})
export class AuthModule {}
