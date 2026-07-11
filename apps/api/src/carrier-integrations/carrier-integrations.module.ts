import { Module } from '@nestjs/common';
import { CarrierTrackingService } from './carrier-tracking.service';

@Module({
  providers: [CarrierTrackingService],
  exports: [CarrierTrackingService],
})
export class CarrierIntegrationsModule {}
