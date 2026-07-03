import type { Prisma } from '../generated/prisma/client';
import { PrismaAuditOutboxWriter } from './prisma-audit-outbox.writer';

describe('PrismaAuditOutboxWriter', () => {
  it('writes audit and pending outbox records through the supplied transaction', async () => {
    const auditCreate = jest
      .fn<Promise<{ id: string }>, [Prisma.AuditLogCreateArgs]>()
      .mockResolvedValue({ id: 'audit-id' });
    const outboxCreate = jest
      .fn<Promise<{ id: string }>, [Prisma.OutboxEventCreateArgs]>()
      .mockResolvedValue({ id: 'event-id' });
    const tx = {
      auditLog: { create: auditCreate },
      outboxEvent: { create: outboxCreate },
    } as unknown as Prisma.TransactionClient;
    const writer = new PrismaAuditOutboxWriter();

    await writer.write(tx, {
      context: {
        organizationId: 'a83a1f26-40f9-4be0-86a5-b78de4a06ea9',
        actorType: 'EMPLOYEE',
        actorUserId: '0c20e5ee-43c1-41bd-b357-d617559e59cc',
        actorEmployeeId: '8641345f-b454-447c-a034-bf80c06e7062',
        source: 'HTTP',
        requestId: '613769cc-6261-41bc-bb57-b76367f67eaa',
        correlationId: 'admin:update',
        ipAddress: null,
        userAgent: null,
      },
      action: 'organization.updated',
      entityType: 'ORGANIZATION',
      entityId: 'a83a1f26-40f9-4be0-86a5-b78de4a06ea9',
      changedFields: ['commercialName'],
      beforeData: { commercialName: 'Before' },
      afterData: { commercialName: 'After' },
      payload: { organizationId: 'a83a1f26-40f9-4be0-86a5-b78de4a06ea9' },
    });

    expect(auditCreate).toHaveBeenCalledTimes(1);
    expect(outboxCreate).toHaveBeenCalledTimes(1);
    const outboxCreateInput = outboxCreate.mock.calls[0]?.[0];
    expect(outboxCreateInput?.data).toMatchObject({
      status: 'PENDING',
      schemaVersion: 1,
      eventType: 'organization.updated',
      idempotencyKey:
        '613769cc-6261-41bc-bb57-b76367f67eaa:organization.updated:ORGANIZATION:a83a1f26-40f9-4be0-86a5-b78de4a06ea9',
    });
  });

  it('rejects prohibited payload keys outside production', async () => {
    const tx = {
      auditLog: { create: jest.fn() },
      outboxEvent: { create: jest.fn() },
    } as unknown as Prisma.TransactionClient;
    const writer = new PrismaAuditOutboxWriter();

    await expect(
      writer.write(tx, {
        context: {
          organizationId: 'a83a1f26-40f9-4be0-86a5-b78de4a06ea9',
          actorType: 'SYSTEM',
          actorUserId: null,
          actorEmployeeId: null,
          source: 'SYSTEM',
          requestId: '613769cc-6261-41bc-bb57-b76367f67eaa',
          correlationId: 'system',
          ipAddress: null,
          userAgent: null,
        },
        action: 'customer.created',
        entityType: 'CUSTOMER',
        entityId: 'customer-id',
        changedFields: ['status'],
        payload: { tokenHash: 'must-not-be-stored' },
      }),
    ).rejects.toThrow('prohibited');
  });
});
