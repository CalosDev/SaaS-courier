import { Injectable } from '@nestjs/common';

import type { Prisma } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuditRepository } from './audit.repository';
import type { AuditLogListResult, ListAuditLogsRecord } from './audit.types';

@Injectable()
export class PrismaAuditRepository implements AuditRepository {
  constructor(private readonly prismaService: PrismaService) {}

  async list(input: ListAuditLogsRecord): Promise<AuditLogListResult> {
    const where: Prisma.AuditLogWhereInput = {
      organizationId: input.organizationId,
      action: input.action,
      entityType: input.entityType,
      entityId: input.entityId,
      actorEmployeeId: input.actorEmployeeId,
      source: input.source,
      correlationId: input.correlationId,
      occurredAt:
        input.occurredFrom || input.occurredTo
          ? { gte: input.occurredFrom, lte: input.occurredTo }
          : undefined,
    };
    const skip = (input.page - 1) * input.pageSize;
    const [totalItems, items] = await this.prismaService.$transaction(
      async (tx) => {
        const totalCount = await tx.auditLog.count({ where });
        const rows = await tx.auditLog.findMany({
          where,
          orderBy: [{ occurredAt: 'desc' }, { id: 'desc' }],
          skip,
          take: input.pageSize,
          select: {
            id: true,
            actorType: true,
            actorEmployeeId: true,
            action: true,
            entityType: true,
            entityId: true,
            source: true,
            requestId: true,
            correlationId: true,
            changedFields: true,
            beforeData: true,
            afterData: true,
            reason: true,
            occurredAt: true,
          },
        });

        return [totalCount, rows] as const;
      },
    );

    return {
      items,
      pagination: {
        page: input.page,
        pageSize: input.pageSize,
        totalItems,
        totalPages: Math.ceil(totalItems / input.pageSize),
      },
    };
  }
}
