import { Module } from '@nestjs/common';

import { PrismaModule } from '../prisma/prisma.module';
import { CustomerAddressesRepository } from './customer-addresses.repository';
import { CustomerAddressesService } from './customer-addresses.service';
import { CustomerCustomsProfilesRepository } from './customer-customs-profiles.repository';
import { CustomerCustomsProfilesService } from './customer-customs-profiles.service';
import { CustomersController } from './customers.controller';
import { CustomersRepository } from './customers.repository';
import { CustomersService } from './customers.service';
import { PrismaCustomerAddressesRepository } from './prisma-customer-addresses.repository';
import { PrismaCustomerCustomsProfilesRepository } from './prisma-customer-customs-profiles.repository';
import { PrismaCustomersRepository } from './prisma-customers.repository';
import { CustomerCodeService } from './customer-code.service';

@Module({
  imports: [PrismaModule],
  controllers: [CustomersController],
  providers: [
    CustomerCodeService,
    CustomersService,
    CustomerAddressesService,
    CustomerCustomsProfilesService,
    PrismaCustomersRepository,
    PrismaCustomerAddressesRepository,
    PrismaCustomerCustomsProfilesRepository,
    {
      provide: CustomersRepository,
      useExisting: PrismaCustomersRepository,
    },
    {
      provide: CustomerAddressesRepository,
      useExisting: PrismaCustomerAddressesRepository,
    },
    {
      provide: CustomerCustomsProfilesRepository,
      useExisting: PrismaCustomerCustomsProfilesRepository,
    },
  ],
  exports: [
    CustomerCodeService,
    CustomersService,
    CustomerAddressesService,
    CustomerCustomsProfilesService,
    CustomersRepository,
    CustomerAddressesRepository,
    CustomerCustomsProfilesRepository,
  ],
})
export class CustomersModule {}
