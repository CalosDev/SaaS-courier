import { randomUUID } from 'node:crypto';

import type { Prisma } from '../generated/prisma/client';
import type { CommandContext } from '../request-context/request-context.types';
import type { AuditActionCode, AuditEntityType } from './audit.catalog';
import {
  containsProhibitedAuditData,
  sanitizeAuditData,
} from './audit-sanitizer';

export interface AuditOutboxWriteInput {
  context: CommandContext;
  action: AuditActionCode;
  entityType: AuditEntityType;
  entityId: string;
  changedFields: string[];
  beforeData?: Record<string, unknown>;
  afterData?: Record<string, unknown>;
  reason?: string;
  metadata?: Record<string, unknown>;
  payload: Record<string, unknown>;
  idempotencyKey?: string;
  occurredAt?: Date;
  emitOutbox?: boolean;
}

export class PrismaAuditOutboxWriter {
  async write(
    tx: Prisma.TransactionClient,
    input: AuditOutboxWriteInput,
  ): Promise<void> {
    if (
      process.env.NODE_ENV !== 'production' &&
      [input.beforeData, input.afterData, input.metadata, input.payload].some(
        (value) => containsProhibitedAuditData(value),
      )
    ) {
      throw new Error('Audit/outbox data contains prohibited keys');
    }

    const occurredAt = input.occurredAt ?? new Date();
    const beforeData = this.toJsonObject(input.beforeData);
    const afterData = this.toJsonObject(input.afterData);
    const metadata = this.toJsonObject(input.metadata);
    const payload = this.toRequiredJsonObject(input.payload);

    await tx.auditLog.create({
      data: {
        id: randomUUID(),
        organizationId: input.context.organizationId,
        actorType: input.context.actorType,
        actorUserId: input.context.actorUserId,
        actorEmployeeId: input.context.actorEmployeeId,
        action: input.action,
        entityType: input.entityType,
        entityId: input.entityId,
        source: input.context.source,
        requestId: input.context.requestId,
        correlationId: input.context.correlationId,
        changedFields: input.changedFields,
        beforeData,
        afterData,
        reason: input.reason,
        metadata,
        ipAddress: input.context.ipAddress,
        userAgent: input.context.userAgent,
        occurredAt,
      },
    });

    if (input.emitOutbox ?? true) {
      await tx.outboxEvent.create({
        data: {
          id: randomUUID(),
          organizationId: input.context.organizationId,
          eventType: input.action,
          aggregateType: input.entityType,
          aggregateId: input.entityId,
          schemaVersion: 1,
          payload,
          metadata,
          idempotencyKey:
            input.idempotencyKey ??
            `${input.context.requestId}:${input.action}:${input.entityType}:${input.entityId}`,
          status: 'PENDING',
          occurredAt,
          availableAt: occurredAt,
        },
      });
    }
  }

  private toJsonObject(
    value: Record<string, unknown> | undefined,
  ): Prisma.InputJsonObject | undefined {
    if (!value) {
      return undefined;
    }

    return sanitizeAuditData(value) as Prisma.InputJsonObject;
  }

  private toRequiredJsonObject(
    value: Record<string, unknown>,
  ): Prisma.InputJsonObject {
    return sanitizeAuditData(value) as Prisma.InputJsonObject;
  }
}
