import { MiddlewareConsumer, Module, type NestModule } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { resolve } from 'node:path';
import { AccountsModule } from './accounts/accounts.module';
import { AuditModule } from './audit/audit.module';
import { AuthModule } from './auth/auth.module';
import { BillingModule } from './billing/billing.module';
import { CustomersModule } from './customers/customers.module';
import { CustomerImportsModule } from './customer-imports/customer-imports.module';
import { EmployeesModule } from './employees/employees.module';
import { FacilitiesModule } from './facilities/facilities.module';
import { HealthModule } from './health/health.module';
import { InventoryModule } from './inventory/inventory.module';
import { OrganizationsModule } from './organizations/organizations.module';
import { OrganizationSettingsModule } from './organization-settings/organization-settings.module';
import { PackagesModule } from './packages/packages.module';
import { PrealertsModule } from './prealerts/prealerts.module';
import { PrismaModule } from './prisma/prisma.module';
import { RbacModule } from './rbac/rbac.module';
import { RequestMetadataMiddleware } from './request-context/request-metadata.middleware';
import { RatesModule } from './rates/rates.module';
import { SessionsModule } from './sessions/sessions.module';
import { PickupRequestsModule } from './pickups/pickups.module';
import { TrackingModule } from './tracking/tracking.module';
import { DispatchesModule } from './dispatches/dispatches.module';
import { CustomsManifestsModule } from './customs-manifests/customs-manifests.module';
import { HouseShipmentsModule } from './house-shipments/house-shipments.module';
import { CustomsCasesModule } from './customs-cases/customs-cases.module';
import { HoldsModule } from './holds/holds.module';
import { CorrectionsModule } from './corrections/corrections.module';
import { TransfersModule } from './transfers/transfers.module';
import { DeliveriesModule } from './deliveries/deliveries.module';
import { ScheduleModule } from '@nestjs/schedule';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { OutboxModule } from './outbox/outbox.module';
import { NotificationsModule } from './notifications/notifications.module';
import { ReportsModule } from './reports/reports.module';
import { WarehouseModule } from './warehouse/warehouse.module';
import { validateEnvironment } from './config/environment.validation';
import { OrganizationProvisioningModule } from './provisioning/organization-provisioning.module';
@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      validate: validateEnvironment,
      envFilePath: [
        resolve(process.cwd(), '.env'),
        resolve(process.cwd(), '../../.env'),
      ],
    }),
    ScheduleModule.forRoot(),
    EventEmitterModule.forRoot({
      wildcard: true,
      delimiter: '.',
    }),
    AccountsModule,
    AuditModule,
    AuthModule,
    BillingModule,
    CustomersModule,
    CustomerImportsModule,
    EmployeesModule,
    FacilitiesModule,
    HealthModule,
    InventoryModule,
    OrganizationSettingsModule,
    OrganizationProvisioningModule,
    PackagesModule,
    HoldsModule,
    CorrectionsModule,
    PrealertsModule,
    PrismaModule,
    RatesModule,
    OrganizationsModule,
    PickupRequestsModule,
    RbacModule,
    SessionsModule,
    TrackingModule,
    DispatchesModule,
    CustomsManifestsModule,
    HouseShipmentsModule,
    CustomsCasesModule,
    TransfersModule,
    DeliveriesModule,
    OutboxModule,
    NotificationsModule,
    ReportsModule,
    WarehouseModule,
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(RequestMetadataMiddleware).forRoutes('*');
  }
}
