import { NotFoundException, UnauthorizedException } from '@nestjs/common';
import { createHmac } from 'node:crypto';

import { ExternalTrackingNormalizer } from '../common/tracking/external-tracking-normalizer';
import { PrismaService } from '../prisma/prisma.service';
import { CarrierConnectionsService } from './carrier-connections.service';
import { CarrierSecretProvider } from './carrier-secret.provider';

describe('CarrierConnectionsService', () => {
  const tx = {
    carrierWebhookReceipt: { create: jest.fn() },
    carrierTrackingSnapshot: { create: jest.fn() },
    outboxEvent: { create: jest.fn() },
  };
  const prisma = {
    carrierConnection: { findUnique: jest.fn() },
    carrierWebhookReceipt: { findUnique: jest.fn() },
    carrierTrackingSnapshot: { findMany: jest.fn() },
    package: { findFirst: jest.fn(), findUnique: jest.fn() },
    $transaction: jest.fn((callback: (client: typeof tx) => unknown) =>
      callback(tx),
    ),
  };
  const secrets = { getSecret: jest.fn(), getBaseUrl: jest.fn() };
  const normalizer = { normalize: jest.fn(() => ({ normalized: 'EXT1' })) };
  const service = new CarrierConnectionsService(
    prisma as unknown as PrismaService,
    secrets as unknown as CarrierSecretProvider,
    normalizer as unknown as ExternalTrackingNormalizer,
  );

  beforeEach(() => jest.clearAllMocks());

  it('accepts a signed event as append-only evidence without changing package status', async () => {
    const body = {
      trackingNumber: 'EXT-1',
      status: 'DELIVERED' as const,
      occurredAt: '2026-07-13T20:00:00.000Z',
    };
    const timestamp = String(Date.now());
    const canonical = `{"occurredAt":"${body.occurredAt}","status":"DELIVERED","trackingNumber":"EXT-1"}`;
    const signature = createHmac('sha256', 'carrier-secret')
      .update(`${timestamp}.${canonical}`)
      .digest('hex');
    prisma.carrierConnection.findUnique.mockResolvedValue({
      id: 'connection-one',
      organizationId: 'organization-one',
      carrierCode: 'UPS',
      secretReference: 'UPS_PRIMARY',
      status: 'ACTIVE',
    });
    prisma.carrierWebhookReceipt.findUnique.mockResolvedValue(null);
    prisma.package.findFirst.mockResolvedValue({ id: 'package-one' });
    secrets.getSecret.mockReturnValue('carrier-secret');
    tx.carrierWebhookReceipt.create.mockResolvedValue({ id: 'receipt-one' });
    tx.carrierTrackingSnapshot.create.mockResolvedValue({
      id: 'snapshot-one',
      status: 'DELIVERED',
    });

    await expect(
      service.receiveWebhook({
        connectionKey: 'public-connection-key',
        eventId: 'carrier-event-one',
        timestamp,
        signature,
        body,
      }),
    ).resolves.toEqual({ accepted: true, duplicate: false });

    expect(tx.carrierTrackingSnapshot.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        organizationId: 'organization-one',
        packageId: 'package-one',
        status: 'DELIVERED',
      }),
    });
    expect(tx.outboxEvent.create).toHaveBeenCalledTimes(1);
    expect(prisma.package).not.toHaveProperty('update');
  });

  it('rejects an invalid signature before writing evidence', async () => {
    prisma.carrierConnection.findUnique.mockResolvedValue({
      id: 'connection-one',
      organizationId: 'organization-one',
      secretReference: 'UPS_PRIMARY',
      status: 'ACTIVE',
    });
    secrets.getSecret.mockReturnValue('carrier-secret');

    await expect(
      service.receiveWebhook({
        connectionKey: 'public-connection-key',
        eventId: 'carrier-event-one',
        timestamp: String(Date.now()),
        signature: 'invalid',
        body: {
          trackingNumber: 'EXT-1',
          status: 'DELIVERED',
          occurredAt: '2026-07-13T20:00:00.000Z',
        },
      }),
    ).rejects.toBeInstanceOf(UnauthorizedException);
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('does not list package events across organizations', async () => {
    prisma.package.findUnique.mockResolvedValue(null);

    await expect(
      service.listPackageEvents('organization-two', 'package-one'),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(prisma.package.findUnique).toHaveBeenCalledWith({
      where: {
        organizationId_id: {
          organizationId: 'organization-two',
          id: 'package-one',
        },
      },
      select: { id: true },
    });
  });
});
