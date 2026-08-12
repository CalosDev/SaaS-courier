import { Module } from '@nestjs/common';

import { OrganizationsModule } from '../organizations/organizations.module';
import { TenantHostResolver } from './tenant-host.resolver';

@Module({
  imports: [OrganizationsModule],
  providers: [TenantHostResolver],
  exports: [TenantHostResolver],
})
export class TenantHostModule {}
