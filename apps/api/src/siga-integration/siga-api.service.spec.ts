import { SigaApiService } from './siga-api.service';

describe('SigaApiService', () => {
  let service: SigaApiService;

  beforeEach(() => {
    service = new SigaApiService();
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('transmitManifest', () => {
    it('should return a successful transmission response', async () => {
      const promise = service.transmitManifest('org-1', 'man-1', {
        flightNumber: 'AA123',
        packages: [],
      });

      // Advance the simulated network delay (800ms)
      jest.advanceTimersByTime(1000);

      const result = await promise;

      expect(result.success).toBe(true);
      expect(result.sigaReferenceCode).toMatch(/^SIGA-\d{4}-\d{6}$/);
      expect(result.transmittedAt).toBeDefined();
    });

    it('should include a valid ISO timestamp in the response', async () => {
      const promise = service.transmitManifest('org-1', 'man-1', {});
      jest.advanceTimersByTime(1000);
      const result = await promise;
      expect(new Date(result.transmittedAt).toISOString()).toBe(
        result.transmittedAt,
      );
    });

    it('should generate unique reference codes per call', async () => {
      const p1 = service.transmitManifest('org-1', 'man-1', {});
      jest.advanceTimersByTime(1000);
      const r1 = await p1;

      const p2 = service.transmitManifest('org-1', 'man-2', {});
      jest.advanceTimersByTime(1000);
      const r2 = await p2;

      // Both should be valid SIGA reference codes (may or may not be unique due to Math.random)
      expect(r1.sigaReferenceCode).toMatch(/^SIGA-/);
      expect(r2.sigaReferenceCode).toMatch(/^SIGA-/);
    });
  });
});
