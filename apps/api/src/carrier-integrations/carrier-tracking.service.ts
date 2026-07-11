import { Injectable, Logger } from '@nestjs/common';

export interface ExternalTrackingEvent {
  timestamp: string;
  status: string;
  location: string;
  description: string;
}

export interface ExternalTrackingResponse {
  trackingNumber: string;
  carrier: string;
  isDelivered: boolean;
  estimatedDelivery: string | null;
  events: ExternalTrackingEvent[];
}

@Injectable()
export class CarrierTrackingService {
  private readonly logger = new Logger(CarrierTrackingService.name);

  async fetchTracking(
    trackingNumber: string,
    carrierCode: string,
  ): Promise<ExternalTrackingResponse> {
    this.logger.log(
      `Fetching tracking for ${trackingNumber} via ${carrierCode}`,
    );

    // In a real scenario, this would call an external API like AfterShip, 17track, EasyPost, FedEx API, etc.
    // For this SaaS Pilot, we simulate a response to adhere to the B2B SaaS rule of not depending on external state mutation.

    // Simulate network delay
    await new Promise((resolve) => setTimeout(resolve, 600));

    // Generate a deterministic mock based on the tracking number length to simulate various states
    const isDelivered = trackingNumber.length % 2 === 0;

    const events: ExternalTrackingEvent[] = [
      {
        timestamp: new Date(Date.now() - 3 * 86400000).toISOString(),
        status: 'INFO_RECEIVED',
        location: 'SENDER FACILITY',
        description: 'Shipping Label Created, USPS Awaiting Item',
      },
      {
        timestamp: new Date(Date.now() - 2 * 86400000).toISOString(),
        status: 'IN_TRANSIT',
        location: 'MIAMI, FL 33112',
        description: 'Arrived at USPS Regional Facility',
      },
      {
        timestamp: new Date(Date.now() - 1 * 86400000).toISOString(),
        status: 'OUT_FOR_DELIVERY',
        location: 'MIAMI, FL 33112',
        description: 'Out for Delivery, Expected Delivery by 9:00 PM',
      },
    ];

    if (isDelivered) {
      events.push({
        timestamp: new Date().toISOString(),
        status: 'DELIVERED',
        location: 'MIAMI, FL 33112',
        description: 'Delivered, Left with Individual',
      });
    }

    return {
      trackingNumber,
      carrier: carrierCode || 'UNKNOWN',
      isDelivered,
      estimatedDelivery: isDelivered
        ? null
        : new Date(Date.now() + 86400000).toISOString(),
      events: events.reverse(), // latest first
    };
  }
}
