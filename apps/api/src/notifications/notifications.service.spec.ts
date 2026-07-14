import { BadRequestException } from '@nestjs/common';

import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from './notifications.service';
import { SmtpEmailSender } from './smtp-email.sender';

describe('NotificationsService', () => {
  const prisma = {
    notificationTemplate: { findMany: jest.fn() },
    notificationDelivery: {
      create: jest.fn(),
      findMany: jest.fn(),
      updateMany: jest.fn(),
      findUniqueOrThrow: jest.fn(),
    },
    package: { findFirst: jest.fn() },
    organization: { findUnique: jest.fn() },
    $transaction: jest.fn(),
  };
  const sender = { send: jest.fn() };
  const service = new NotificationsService(
    prisma as unknown as PrismaService,
    sender as unknown as SmtpEmailSender,
  );

  beforeEach(() => jest.clearAllMocks());

  it('rejects a template variable outside its explicit allowlist', async () => {
    await expect(
      service.createTemplate(
        {
          organizationId: 'organization-one',
          actorType: 'EMPLOYEE',
          actorUserId: 'user-one',
          actorEmployeeId: 'employee-one',
          source: 'HTTP',
          requestId: 'request-one',
          correlationId: 'correlation-one',
          ipAddress: '127.0.0.1',
          userAgent: 'jest',
        },
        {
          code: 'PACKAGE_RECEIVED',
          eventType: 'package.received',
          subjectTemplate: 'Paquete {{trackingNumber}}',
          bodyTemplate: 'Estado {{status}}',
          allowedVariables: ['trackingNumber'],
        },
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('renders an outbox event once and treats a duplicate as idempotent', async () => {
    prisma.notificationTemplate.findMany.mockResolvedValue([
      {
        id: 'template-one',
        subjectTemplate: 'Paquete {{trackingNumber}}',
        bodyTemplate: '{{customerCode}}: {{status}}',
        allowedVariables: ['trackingNumber', 'customerCode', 'status'],
      },
    ]);
    prisma.package.findFirst.mockResolvedValue({
      customer: { email: 'client@example.test', customerCode: 'C001' },
    });
    prisma.organization.findUnique.mockResolvedValue({
      commercialName: 'Courier One',
    });
    prisma.notificationDelivery.create
      .mockResolvedValueOnce({ id: 'delivery-one' })
      .mockRejectedValueOnce({ code: 'P2002' });
    const event = {
      id: 'event-one',
      organization_id: 'organization-one',
      event_type: 'package.received',
      aggregate_type: 'PACKAGE',
      aggregate_id: 'package-one',
      payload: { trackingNumber: 'PK123', status: 'RECEIVED' },
    };

    await service.consumeOutboxEvent(event);
    await expect(service.consumeOutboxEvent(event)).resolves.toBeUndefined();

    expect(prisma.notificationDelivery.create).toHaveBeenNthCalledWith(1, {
      data: expect.objectContaining({
        organizationId: 'organization-one',
        outboxEventId: 'event-one',
        recipientEmail: 'client@example.test',
        subject: 'Paquete PK123',
        body: 'C001: RECEIVED',
      }),
    });
  });

  it('claims and marks a pending email as sent', async () => {
    prisma.notificationDelivery.findMany.mockResolvedValue([
      { id: 'delivery-one' },
    ]);
    prisma.notificationDelivery.updateMany
      .mockResolvedValueOnce({ count: 1 })
      .mockResolvedValueOnce({ count: 1 });
    prisma.notificationDelivery.findUniqueOrThrow.mockResolvedValue({
      id: 'delivery-one',
      recipientEmail: 'client@example.test',
      subject: 'Subject',
      body: 'Body',
      attempts: 1,
    });
    sender.send.mockResolvedValue({ messageId: 'smtp-message-one' });

    await service.processPendingDeliveries();

    expect(sender.send).toHaveBeenCalledWith({
      to: 'client@example.test',
      subject: 'Subject',
      body: 'Body',
    });
    expect(prisma.notificationDelivery.updateMany).toHaveBeenLastCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: 'SENT' }),
      }),
    );
  });
});
