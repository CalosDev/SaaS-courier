import { MiddlewareConsumer, Module, type NestModule } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { resolve } from 'node:path';
import { AccountsModule } from './accounts/accounts.module';
import { AuditModule } from './audit/audit.module';
import { AuthModule } from './auth/auth.module';
import { CustomersModule } from './customers/customers.module';
import { CustomerImportsModule } from './customer-imports/customer-imports.module';
import { EmployeesModule } from './employees/employees.module';
import { FacilitiesModule } from './facilities/facilities.module';
import { HealthModule } from './health/health.module';
import { OrganizationsModule } from './organizations/organizations.module';
import { OrganizationSettingsModule } from './organization-settings/organization-settings.module';
import { PrealertsModule } from './prealerts/prealerts.module';
import { PrismaModule } from './prisma/prisma.module';
import { RbacModule } from './rbac/rbac.module';
import { RequestMetadataMiddleware } from './request-context/request-metadata.middleware';
import { SessionsModule } from './sessions/sessions.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: [
        resolve(process.cwd(), '.env'),
        resolve(process.cwd(), '../../.env'),
      ],
    }),
    AccountsModule,
    AuditModule,
    AuthModule,
    CustomersModule,
    CustomerImportsModule,
    EmployeesModule,
    FacilitiesModule,
    HealthModule,
    OrganizationSettingsModule,
    PrealertsModule,
    PrismaModule,
    OrganizationsModule,
    RbacModule,
    SessionsModule,
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(RequestMetadataMiddleware).forRoutes('*');
  }
}
