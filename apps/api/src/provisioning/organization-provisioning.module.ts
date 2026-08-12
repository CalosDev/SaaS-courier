import { Module } from '@nestjs/common';

import { AccountsModule } from '../accounts/accounts.module';
import { PrismaModule } from '../prisma/prisma.module';
import { OrganizationProvisioningService } from './organization-provisioning.service';

@Module({
  imports: [PrismaModule, AccountsModule],
  providers: [OrganizationProvisioningService],
  exports: [OrganizationProvisioningService],
})
export class OrganizationProvisioningModule {}
