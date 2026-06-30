import { Module } from '@nestjs/common';
import { APP_FILTER, APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';

import { AccountsModule } from '../accounts/accounts.module';
import { PrismaModule } from '../prisma/prisma.module';
import { SessionsModule } from '../sessions/sessions.module';
import { AuthRepository } from './auth.repository';
import { AuthService } from './auth.service';
import { AuthController } from './http/auth.controller';
import { AuthCookieService } from './http/auth-cookie.service';
import { AuthHttpExceptionFilter } from './http/auth-http-exception.filter';
import { AuthHttpService } from './http/auth-http.service';
import { CsrfGuard } from './http/csrf.guard';
import { CsrfTokenService } from './http/csrf-token.service';
import { SessionAuthGuard } from './http/session-auth.guard';
import { LoginChallengeTokenService } from './login-challenges/login-challenge-token.service';
import { LoginChallengesRepository } from './login-challenges/login-challenges.repository';
import { LoginChallengesService } from './login-challenges/login-challenges.service';
import { PrismaLoginChallengesRepository } from './login-challenges/prisma-login-challenges.repository';
import { LoginLockoutPolicy } from './login-lockout.policy';
import { PrismaAuthRepository } from './prisma-auth.repository';

@Module({
  imports: [
    PrismaModule,
    AccountsModule,
    SessionsModule,
    ThrottlerModule.forRoot({
      throttlers: [
        {
          name: 'default',
          limit: 100,
          ttl: 60_000,
        },
      ],
      getTracker: (request: Record<string, unknown>) => {
        const headers =
          request['headers'] && typeof request['headers'] === 'object'
            ? (request['headers'] as Record<string, unknown>)
            : null;
        const forwardedFor = headers?.['x-forwarded-for'];

        if (
          typeof forwardedFor === 'string' &&
          forwardedFor.trim().length > 0
        ) {
          return forwardedFor.split(',')[0].trim();
        }

        return typeof request['ip'] === 'string' ? request['ip'] : 'unknown';
      },
    }),
  ],
  controllers: [AuthController],
  providers: [
    AuthService,
    AuthHttpService,
    AuthCookieService,
    CsrfTokenService,
    LoginChallengeTokenService,
    LoginChallengesService,
    LoginLockoutPolicy,
    {
      provide: AuthRepository,
      useClass: PrismaAuthRepository,
    },
    {
      provide: LoginChallengesRepository,
      useClass: PrismaLoginChallengesRepository,
    },
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
    {
      provide: APP_GUARD,
      useClass: SessionAuthGuard,
    },
    {
      provide: APP_GUARD,
      useClass: CsrfGuard,
    },
    {
      provide: APP_FILTER,
      useClass: AuthHttpExceptionFilter,
    },
  ],
  exports: [AuthService],
})
export class AuthModule {}
