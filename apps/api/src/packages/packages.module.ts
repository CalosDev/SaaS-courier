import { Module } from '@nestjs/common';

import { ExternalTrackingNormalizer } from '../common/tracking/external-tracking-normalizer';
import { CustomersModule } from '../customers/customers.module';
import { PrismaModule } from '../prisma/prisma.module';
import { PackageCodeService } from './package-code.service';
import { PackageReceptionsController } from './package-receptions.controller';
import { PackageReceptionsRepository } from './package-receptions.repository';
import { PackageReceptionsService } from './package-receptions.service';
import { PackagesController } from './packages.controller';
import { PackagesRepository } from './packages.repository';
import { PackagesService } from './packages.service';
import { PrismaPackageReceptionsRepository } from './prisma-package-receptions.repository';
import { PrismaPackagesRepository } from './prisma-packages.repository';

@Module({
  imports: [PrismaModule, CustomersModule],
  controllers: [PackagesController, PackageReceptionsController],
  providers: [
    ExternalTrackingNormalizer,
    PackageCodeService,
    PackageReceptionsService,
    PrismaPackageReceptionsRepository,
    PackagesService,
    PrismaPackagesRepository,
    {
      provide: PackagesRepository,
      useExisting: PrismaPackagesRepository,
    },
    {
      provide: PackageReceptionsRepository,
      useExisting: PrismaPackageReceptionsRepository,
    },
  ],
  exports: [
    PackageReceptionsService,
    PackageReceptionsRepository,
    PackagesService,
    PackagesRepository,
  ],
})
export class PackagesModule {}
