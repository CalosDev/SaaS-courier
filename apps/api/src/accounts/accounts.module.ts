import { Module } from '@nestjs/common';

import { PrismaModule } from '../prisma/prisma.module';
import { ActivationTokenService } from './activation-token.service';
import { AccountsRepository } from './accounts.repository';
import { AccountsService } from './accounts.service';
import { Argon2PasswordHasher } from './argon2-password-hasher';
import { PasswordHasher } from './password-hasher';
import { PrismaAccountsRepository } from './prisma-accounts.repository';

@Module({
  imports: [PrismaModule],
  providers: [
    AccountsService,
    ActivationTokenService,
    {
      provide: AccountsRepository,
      useClass: PrismaAccountsRepository,
    },
    {
      provide: PasswordHasher,
      useClass: Argon2PasswordHasher,
    },
  ],
  exports: [AccountsService],
})
export class AccountsModule {}
