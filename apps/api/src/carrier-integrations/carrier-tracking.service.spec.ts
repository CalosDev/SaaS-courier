import { CarrierTrackingService } from './carrier-tracking.service';

describe('CarrierTrackingService', () => {
  let service: CarrierTrackingService;

  beforeEach(() => {
    service = new CarrierTrackingService();
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('fetchTracking', () => {
    it('should return a tracking response with events', async () => {
      const promise = service.fetchTracking('1Z999AA10123456784', 'UPS');
      jest.advanceTimersByTime(700);
      const result = await promise;

      expect(result.trackingNumber).toBe('1Z999AA10123456784');
      expect(result.carrier).toBe('UPS');
      expect(Array.isArray(result.events)).toBe(true);
      expect(result.events.length).toBeGreaterThan(0);
    });

    it('should mark even-length tracking numbers as delivered', async () => {
      // '12345678' has length 8 (even) -> isDelivered = true
      const promise = service.fetchTracking('12345678', 'FEDEX');
      jest.advanceTimersByTime(700);
      const result = await promise;

      expect(result.isDelivered).toBe(true);
      expect(result.estimatedDelivery).toBeNull();
    });

    it('should mark odd-length tracking numbers as not delivered', async () => {
      // '1234567' has length 7 (odd) -> isDelivered = false
      const promise = service.fetchTracking('1234567', 'FEDEX');
      jest.advanceTimersByTime(700);
      const result = await promise;

      expect(result.isDelivered).toBe(false);
      expect(result.estimatedDelivery).not.toBeNull();
    });

    it('should use UNKNOWN as carrier when carrierCode is empty', async () => {
      const promise = service.fetchTracking('TRACK123', '');
      jest.advanceTimersByTime(700);
      const result = await promise;

      expect(result.carrier).toBe('UNKNOWN');
    });

    it('should return events in latest-first order', async () => {
      const promise = service.fetchTracking('12345678', 'DHL');
      jest.advanceTimersByTime(700);
      const result = await promise;

      // Verify events are sorted latest-first (each timestamp >= next)
      for (let i = 0; i < result.events.length - 1; i++) {
        const current = new Date(result.events[i].timestamp).getTime();
        const next = new Date(result.events[i + 1].timestamp).getTime();
        expect(current).toBeGreaterThanOrEqual(next);
      }
    });
  });
});
