import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaHoldsRepository } from './prisma-holds.repository';
import { CreateHoldDto } from './dto/create-hold.dto';
import { UpdateHoldDto } from './dto/update-hold.dto';
import { HoldStatus } from '../generated/prisma/client';
import { PrismaAuditOutboxWriter } from '../audit/prisma-audit-outbox.writer';
import { PrismaService } from '../prisma/prisma.service';
import type { CommandContext } from '../request-context/request-context.types';

@Injectable()
export class HoldsService {
  private readonly auditWriter = new PrismaAuditOutboxWriter();

  constructor(
    private readonly repository: PrismaHoldsRepository,
    private readonly prisma: PrismaService,
  ) {}

  async createHold(ctx: CommandContext, dto: CreateHoldDto) {
    if (!ctx.actorEmployeeId) {
      throw new Error('Employee ID is required');
    }

    const hold = await this.repository.create({
      organizationId: ctx.organizationId,
      targetType: 'PACKAGE',
      targetId: dto.packageId,
      reason: dto.reason,
      status: dto.status || HoldStatus.ACTIVE,
      requestedByEmployeeId: ctx.actorEmployeeId,
    });

    await this.auditWriter.write(this.prisma, {
      context: ctx,
      action: 'operational_hold.created',
      entityId: hold.id,
      entityType: 'OPERATIONAL_HOLD',
      changedFields: ['id', 'status', 'reason', 'targetId', 'targetType'],
      payload: { ...hold },
      metadata: {
        holdId: hold.id,
        targetId: dto.packageId,
        reason: dto.reason,
      },
    });

    return hold;
  }

  async getHolds(organizationId: string, packageId?: string) {
    return this.repository.findMany({
      where: {
        organizationId,
        ...(packageId ? { targetId: packageId, targetType: 'PACKAGE' } : {}),
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getHoldById(organizationId: string, holdId: string) {
    const hold = await this.repository.findById(organizationId, holdId);
    if (!hold) {
      throw new NotFoundException('Hold not found');
    }
    return hold;
  }

  async updateHold(ctx: CommandContext, holdId: string, dto: UpdateHoldDto) {
    if (!ctx.actorEmployeeId) {
      throw new Error('Employee ID is required');
    }

    const existing = await this.getHoldById(ctx.organizationId, holdId);

    const updated = await this.repository.update(ctx.organizationId, holdId, {
      status: dto.status !== undefined ? dto.status : existing.status,
      reason: dto.reason !== undefined ? dto.reason : existing.reason,
      releaseReason:
        dto.releaseReason !== undefined
          ? dto.releaseReason
          : existing.releaseReason,
      releasedByEmployeeId:
        dto.status === HoldStatus.RELEASED &&
        existing.status !== HoldStatus.RELEASED
          ? ctx.actorEmployeeId
          : existing.releasedByEmployeeId,
      releasedAt:
        dto.status === HoldStatus.RELEASED &&
        existing.status !== HoldStatus.RELEASED
          ? new Date()
          : existing.releasedAt,
    });

    if (
      updated.status === HoldStatus.RELEASED &&
      existing.status !== HoldStatus.RELEASED
    ) {
      await this.auditWriter.write(this.prisma, {
        context: ctx,
        action: 'operational_hold.released',
        entityId: updated.id,
        entityType: 'OPERATIONAL_HOLD',
        changedFields: [
          'status',
          'releaseReason',
          'releasedAt',
          'releasedByEmployeeId',
        ],
        payload: {
          status: updated.status,
          releaseReason: updated.releaseReason,
        },
        metadata: { holdId: updated.id, releaseReason: updated.releaseReason },
      });
    }

    return updated;
  }
}
