import { NotFoundException } from '@nestjs/common';

import { ExternalTrackingNormalizer } from '../common/tracking/external-tracking-normalizer';
import { InventoryService } from '../inventory/inventory.service';
import { PrismaService } from '../prisma/prisma.service';
import type { CommandContext } from '../request-context/request-context.types';
import { WarehouseService } from './warehouse.service';

describe('WarehouseService', () => {
  const prisma = {
    package: { findFirst: jest.fn() },
    prealert: { findFirst: jest.fn() },
    warehouseLocation: { findFirst: jest.fn() },
    $transaction: jest.fn().mockResolvedValue(undefined),
  };
  const inventory = { movePackage: jest.fn() };
  const normalizer = { normalize: jest.fn(() => ({ normalized: 'EXT1' })) };
  const service = new WarehouseService(
    prisma as unknown as PrismaService,
    inventory as unknown as InventoryService,
    normalizer as unknown as ExternalTrackingNormalizer,
  );

  beforeEach(() => jest.clearAllMocks());

  it('scopes lookup by organization and does not expose a foreign item', async () => {
    prisma.package.findFirst.mockResolvedValue(null);
    prisma.prealert.findFirst.mockResolvedValue(null);

    await expect(
      service.lookup('organization-one', 'ext-1'),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(prisma.package.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ organizationId: 'organization-one' }),
      }),
    );
    expect(prisma.prealert.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ organizationId: 'organization-one' }),
      }),
    );
  });

  it('deduplicates scans and does not create a movement when already placed', async () => {
    prisma.warehouseLocation.findFirst.mockResolvedValue({
      id: 'location-one',
      code: 'A-01',
      name: 'Rack A',
    });
    jest.spyOn(service, 'lookup').mockResolvedValue({
      kind: 'PACKAGE',
      package: {
        id: 'package-one',
        internalTrackingNumber: 'PK123',
        externalTrackingNumber: 'EXT-1',
        prealertCode: null,
        status: 'RECEIVED_AT_ORIGIN',
        customerCode: 'C001',
        reception: {
          facility: { id: 'facility-one', code: 'MIA', name: 'Miami' },
          receivedAt: new Date().toISOString(),
        },
        currentLocation: {
          id: 'location-one',
          code: 'A-01',
          name: 'Rack A',
          type: 'RACK',
        },
      },
    });

    const result = await service.batchPutaway(context(), {
      codes: ['pk123', 'PK123'],
      toLocationId: 'location-one',
    });

    expect(result.summary).toEqual({
      requested: 2,
      placed: 0,
      failed: 0,
      skipped: 2,
    });
    expect(result.results.map((item) => item.status)).toEqual([
      'ALREADY_PLACED',
      'SKIPPED',
    ]);
    expect(inventory.movePackage).not.toHaveBeenCalled();
  });
});

function context(): CommandContext {
  return {
    organizationId: 'organization-one',
    actorType: 'EMPLOYEE',
    actorUserId: 'user-one',
    actorEmployeeId: 'employee-one',
    source: 'HTTP',
    requestId: 'request-one',
    correlationId: 'correlation-one',
    ipAddress: '127.0.0.1',
    userAgent: 'jest',
  };
}
