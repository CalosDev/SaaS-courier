import { BadRequestException, NotFoundException } from '@nestjs/common';
import { DispatchStatus } from '../generated/prisma/client';
import { PrismaAuditOutboxWriter } from '../audit/prisma-audit-outbox.writer';
import { DispatchesService } from './dispatches.service';

describe('DispatchesService master shipment actions', () => {
  let service: DispatchesService;
  let repository: {
    findById: jest.Mock;
    update: jest.Mock;
  };
  let tx: {
    package: {
      findMany: jest.Mock;
      updateMany: jest.Mock;
    };
  };
  let prisma: {
    $transaction: jest.Mock;
  };
  let auditWriteSpy: jest.SpyInstance;

  const ctx = {
    organizationId: 'org-1',
    actorUserId: 'user-1',
    actorEmployeeId: 'emp-1',
    actorType: 'EMPLOYEE',
    source: 'HTTP',
    requestId: '00000000-0000-4000-8000-000000000001',
    correlationId: 'corr-1',
    roles: [],
    permissions: [],
  } as any;

  beforeEach(() => {
    repository = {
      findById: jest.fn(),
      update: jest.fn(),
    };
    tx = {
      package: {
        findMany: jest.fn(),
        updateMany: jest.fn(),
      },
    };
    prisma = {
      $transaction: jest.fn((callback) => callback(tx)),
    };
    auditWriteSpy = jest
      .spyOn(PrismaAuditOutboxWriter.prototype, 'write')
      .mockResolvedValue(undefined);
    service = new DispatchesService(repository as any, prisma as any);
  });

  afterEach(() => {
    auditWriteSpy.mockRestore();
  });

  it('closes a draft master shipment and writes audit/outbox', async () => {
    const existing = {
      id: 'dispatch-1',
      status: DispatchStatus.DRAFT,
    };
    const updated = {
      ...existing,
      status: DispatchStatus.CLOSED,
    };
    repository.findById.mockResolvedValue(existing);
    repository.update.mockResolvedValue(updated);

    await expect(
      service.closeMasterShipment(ctx, 'dispatch-1'),
    ).resolves.toEqual(updated);

    expect(repository.update).toHaveBeenCalledWith(
      'org-1',
      'dispatch-1',
      { status: DispatchStatus.CLOSED },
      tx,
    );
    expect(auditWriteSpy).toHaveBeenCalledWith(
      tx,
      expect.objectContaining({
        action: 'master_shipment.closed',
        entityType: 'MASTER_SHIPMENT',
        changedFields: ['status'],
      }),
    );
  });

  it('does not rewrite audit/outbox when close is repeated', async () => {
    const existing = {
      id: 'dispatch-1',
      status: DispatchStatus.CLOSED,
    };
    repository.findById.mockResolvedValue(existing);

    await expect(
      service.closeMasterShipment(ctx, 'dispatch-1'),
    ).resolves.toEqual(existing);

    expect(repository.update).not.toHaveBeenCalled();
    expect(auditWriteSpy).not.toHaveBeenCalled();
  });

  it('rejects invalid master shipment transitions', async () => {
    repository.findById.mockResolvedValue({
      id: 'dispatch-1',
      status: DispatchStatus.DRAFT,
    });

    await expect(
      service.departMasterShipment(ctx, 'dispatch-1'),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(repository.update).not.toHaveBeenCalled();
    expect(auditWriteSpy).not.toHaveBeenCalled();
  });

  it('returns 404 semantics for missing master shipments', async () => {
    repository.findById.mockResolvedValue(null);

    await expect(
      service.closeMasterShipment(ctx, 'missing-dispatch'),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('replaces master shipment packages without stealing assigned packages', async () => {
    const existing = {
      id: 'dispatch-1',
      status: DispatchStatus.DRAFT,
    };
    const updated = {
      ...existing,
      packages: [{ id: 'package-1' }],
    };
    repository.findById
      .mockResolvedValueOnce(existing)
      .mockResolvedValueOnce(updated);
    tx.package.findMany.mockResolvedValue([
      { id: 'package-1', dispatchId: null },
    ]);

    await expect(
      service.replaceMasterShipmentPackages(ctx, 'dispatch-1', {
        packageIds: ['package-1'],
      }),
    ).resolves.toEqual(updated);

    expect(tx.package.updateMany).toHaveBeenNthCalledWith(1, {
      where: {
        organizationId: 'org-1',
        dispatchId: 'dispatch-1',
        id: { notIn: ['package-1'] },
      },
      data: { dispatchId: null },
    });
    expect(tx.package.updateMany).toHaveBeenNthCalledWith(2, {
      where: {
        organizationId: 'org-1',
        id: { in: ['package-1'] },
      },
      data: { dispatchId: 'dispatch-1' },
    });
    expect(auditWriteSpy).toHaveBeenCalledWith(
      tx,
      expect.objectContaining({
        action: 'master_shipment.packages.replaced',
        emitOutbox: false,
      }),
    );
  });

  it('rejects packages assigned to another master shipment', async () => {
    repository.findById.mockResolvedValue({
      id: 'dispatch-1',
      status: DispatchStatus.DRAFT,
    });
    tx.package.findMany.mockResolvedValue([
      { id: 'package-1', dispatchId: 'dispatch-2' },
    ]);

    await expect(
      service.replaceMasterShipmentPackages(ctx, 'dispatch-1', {
        packageIds: ['package-1'],
      }),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(tx.package.updateMany).not.toHaveBeenCalled();
    expect(auditWriteSpy).not.toHaveBeenCalled();
  });

  it('updates MAWB and emits the master shipment event', async () => {
    const existing = {
      id: 'dispatch-1',
      status: DispatchStatus.CLOSED,
      mawb: null,
    };
    const updated = {
      ...existing,
      mawb: '001-12345678',
    };
    repository.findById.mockResolvedValue(existing);
    repository.update.mockResolvedValue(updated);

    await expect(
      service.updateMasterShipmentMawb(ctx, 'dispatch-1', '001-12345678'),
    ).resolves.toEqual(updated);

    expect(repository.update).toHaveBeenCalledWith(
      'org-1',
      'dispatch-1',
      { mawb: '001-12345678' },
      tx,
    );
    expect(auditWriteSpy).toHaveBeenCalledWith(
      tx,
      expect.objectContaining({
        action: 'master_shipment.mawb.updated',
        entityType: 'MASTER_SHIPMENT',
        changedFields: ['mawb'],
      }),
    );
  });
});
