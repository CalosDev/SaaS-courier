import { Module } from '@nestjs/common';
import { TrackingService } from './tracking.service';
import { TrackingController } from './tracking.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { AuditModule } from '../audit/audit.module';
import { ExternalTrackingNormalizer } from '../common/tracking/external-tracking-normalizer';
import { TrackingResolveController } from './tracking-resolve.controller';

@Module({
  imports: [PrismaModule, AuditModule],
  controllers: [TrackingController, TrackingResolveController],
  providers: [TrackingService, ExternalTrackingNormalizer],
  exports: [TrackingService],
})
export class TrackingModule {}
