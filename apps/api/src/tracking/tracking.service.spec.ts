import { BadRequestException, NotFoundException } from '@nestjs/common';
import { PackageStatus, TrackingEventType } from '../generated/prisma/client';
import { InvalidPackageStatusTransitionError } from '../packages/package.errors';
import type { CommandContext } from '../request-context/request-context.types';
import { TrackingService } from './tracking.service';

describe('TrackingService.addEvent', () => {
  const context: CommandContext = {
    organizationId: 'fbd54afb-62e8-4f5e-bfa9-293ee5d4dcf7',
    actorType: 'EMPLOYEE',
    actorUserId: '64ac55a2-8a4f-4e3b-b580-39cf8c92d55d',
    actorEmployeeId: '5a79a84d-9bd9-4c63-8b1b-c3728bba6294',
    source: 'HTTP',
    requestId: 'request-1',
    correlationId: 'correlation-1',
    ipAddress: null,
    userAgent: null,
  };

  const tx = {
    $queryRaw: jest.fn(),
    packageTrackingEvent: { create: jest.fn() },
  };
  const prisma = {
    $transaction: jest.fn((callback: (client: typeof tx) => unknown) =>
      callback(tx),
    ),
  };
  const service = new TrackingService(prisma as never, {} as never);
  const auditWrite = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    (
      service as unknown as { auditOutboxWriter: { write: jest.Mock } }
    ).auditOutboxWriter.write = auditWrite;
    auditWrite.mockResolvedValue(undefined);
    tx.packageTrackingEvent.create.mockResolvedValue({
      id: 'f7ec1d28-09af-4461-b05b-3991a1fe47ec',
      eventType: TrackingEventType.IN_TRANSIT,
    });
  });

  it('records an event that reflects the current package status', async () => {
    tx.$queryRaw.mockResolvedValue([
      { id: 'package-1', status: PackageStatus.IN_TRANSIT },
    ]);

    await expect(
      service.addEvent(context, 'package-1', {
        eventType: TrackingEventType.IN_TRANSIT,
      }),
    ).resolves.toMatchObject({ eventType: TrackingEventType.IN_TRANSIT });
    expect(tx.packageTrackingEvent.create).toHaveBeenCalledTimes(1);
    expect(auditWrite).toHaveBeenCalledWith(
      tx,
      expect.objectContaining({
        payload: expect.objectContaining({
          packageId: 'package-1',
          packageStatus: PackageStatus.IN_TRANSIT,
        }),
      }),
    );
  });

  it('rejects an event that would bypass the operational workflow', async () => {
    tx.$queryRaw.mockResolvedValue([
      { id: 'package-1', status: PackageStatus.IN_TRANSIT },
    ]);

    await expect(
      service.addEvent(context, 'package-1', {
        eventType: TrackingEventType.DELIVERED,
      }),
    ).rejects.toBeInstanceOf(InvalidPackageStatusTransitionError);
    expect(tx.packageTrackingEvent.create).not.toHaveBeenCalled();
  });

  it('rejects a missing or cross-tenant package', async () => {
    tx.$queryRaw.mockResolvedValue([]);
    await expect(
      service.addEvent(context, 'package-1', {
        eventType: TrackingEventType.IN_TRANSIT,
      }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('requires an authenticated employee actor', async () => {
    tx.$queryRaw.mockResolvedValue([
      { id: 'package-1', status: PackageStatus.IN_TRANSIT },
    ]);
    await expect(
      service.addEvent({ ...context, actorEmployeeId: null }, 'package-1', {
        eventType: TrackingEventType.IN_TRANSIT,
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});
