import { Module } from '@nestjs/common';

import { PrismaModule } from '../prisma/prisma.module';
import { ActivationTokenService } from './activation-token.service';
import { AccountsController } from './accounts.controller';
import { AccountsRepository } from './accounts.repository';
import { AccountsService } from './accounts.service';
import { Argon2PasswordHasher } from './argon2-password-hasher';
import { PasswordHasher } from './password-hasher';
import { PrismaAccountsRepository } from './prisma-accounts.repository';

@Module({
  imports: [PrismaModule],
  controllers: [AccountsController],
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
  exports: [AccountsService, ActivationTokenService, PasswordHasher],
})
export class AccountsModule {}
