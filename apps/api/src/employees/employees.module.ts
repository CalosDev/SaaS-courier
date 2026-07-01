import { Module } from '@nestjs/common';

import { AccountsModule } from '../accounts/accounts.module';
import { PrismaModule } from '../prisma/prisma.module';
import { SessionsModule } from '../sessions/sessions.module';
import { EmployeesController } from './employees.controller';
import { EmployeesRepository } from './employees.repository';
import { EmployeesService } from './employees.service';
import { PrismaEmployeesRepository } from './prisma-employees.repository';

@Module({
  imports: [AccountsModule, PrismaModule, SessionsModule],
  controllers: [EmployeesController],
  providers: [
    EmployeesService,
    {
      provide: EmployeesRepository,
      useClass: PrismaEmployeesRepository,
    },
  ],
  exports: [EmployeesService, EmployeesRepository],
})
export class EmployeesModule {}
