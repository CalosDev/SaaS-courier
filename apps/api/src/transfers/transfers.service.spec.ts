import { ConflictException, NotFoundException } from '@nestjs/common';

import { PrismaService } from '../prisma/prisma.service';
import type { CommandContext } from '../request-context/request-context.types';
import { TransfersService } from './transfers.service';

describe('TransfersService invariants', () => {
  const context = {
    organizationId: 'org-1',
    actorType: 'EMPLOYEE',
    actorUserId: 'user-1',
    actorEmployeeId: 'employee-1',
    source: 'HTTP',
    requestId: 'request-1',
    correlationId: 'correlation-1',
    ipAddress: null,
    userAgent: null,
  } satisfies CommandContext;

  function createPrismaMock() {
    const prisma = {
      facility: { findUnique: jest.fn() },
      package: { findUnique: jest.fn() },
      facilityTransfer: { findUnique: jest.fn() },
      facilityTransferItem: {
        findFirst: jest.fn(),
        delete: jest.fn(),
      },
      auditLog: { create: jest.fn() },
      outboxEvent: { create: jest.fn() },
    };

    return Object.assign(prisma, {
      $transaction: jest.fn((callback: (tx: typeof prisma) => unknown) =>
        Promise.resolve(callback(prisma)),
      ),
    });
  }

  it('rejects transfers whose origin and destination are the same', async () => {
    const prisma = createPrismaMock();
    const service = new TransfersService(prisma as unknown as PrismaService);

    await expect(
      service.createTransfer(context, {
        originFacilityId: 'facility-1',
        destinationFacilityId: 'facility-1',
      }),
    ).rejects.toThrow(ConflictException);
    expect(prisma.facility.findUnique).not.toHaveBeenCalled();
  });

  it('rejects packages that are not positioned at the origin facility', async () => {
    const prisma = createPrismaMock();
    prisma.facilityTransfer.findUnique.mockResolvedValue({
      id: 'transfer-1',
      organizationId: 'org-1',
      originFacilityId: 'facility-origin',
      status: 'DRAFT',
    });
    prisma.package.findUnique.mockResolvedValue({
      id: 'package-1',
      inventoryPosition: { facilityId: 'facility-other' },
    });
    const service = new TransfersService(prisma as unknown as PrismaService);

    await expect(
      service.addItem(context, 'transfer-1', { packageId: 'package-1' }),
    ).rejects.toThrow(ConflictException);
    expect(prisma.facilityTransferItem.findFirst).not.toHaveBeenCalled();
  });

  it('rejects removing an item that does not belong to the transfer', async () => {
    const prisma = createPrismaMock();
    prisma.facilityTransfer.findUnique.mockResolvedValue({
      id: 'transfer-1',
      organizationId: 'org-1',
      status: 'DRAFT',
    });
    prisma.facilityTransferItem.findFirst.mockResolvedValue(null);
    const service = new TransfersService(prisma as unknown as PrismaService);

    await expect(
      service.removeItem(context, 'transfer-1', 'item-from-other-transfer'),
    ).rejects.toThrow(NotFoundException);
    expect(prisma.facilityTransferItem.delete).not.toHaveBeenCalled();
  });
});
