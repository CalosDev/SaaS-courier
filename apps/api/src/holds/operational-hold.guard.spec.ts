import { ConflictException } from '@nestjs/common';
import { HoldStatus } from '../generated/prisma/client';
import { OperationalHoldGuard } from './operational-hold.guard';

describe('OperationalHoldGuard', () => {
  const prisma = {
    operationalHold: {
      findFirst: jest.fn(),
    },
  };
  const guard = new OperationalHoldGuard(prisma as any);

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('allows the operation when there are no active package holds', async () => {
    prisma.operationalHold.findFirst.mockResolvedValue(null);

    await expect(
      guard.assertNoActivePackageHolds('org-1', ['pkg-1', 'pkg-1', ' '], {
        operation: 'package update',
      }),
    ).resolves.toBeUndefined();

    expect(prisma.operationalHold.findFirst).toHaveBeenCalledWith({
      where: {
        organizationId: 'org-1',
        targetType: 'PACKAGE',
        targetId: { in: ['pkg-1'] },
        status: HoldStatus.ACTIVE,
      },
      select: { id: true, targetId: true, reason: true },
      orderBy: { createdAt: 'asc' },
    });
  });

  it('blocks the operation when an active package hold exists', async () => {
    prisma.operationalHold.findFirst.mockResolvedValue({
      id: 'hold-1',
      targetId: 'pkg-1',
      reason: 'inspection',
    });

    await expect(
      guard.assertNoActivePackageHolds('org-1', 'pkg-1', {
        operation: 'inventory movement',
      }),
    ).rejects.toBeInstanceOf(ConflictException);
  });
});
