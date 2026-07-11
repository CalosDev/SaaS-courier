import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaCorrectionsRepository } from './prisma-corrections.repository';
import { CreateCorrectionDto } from './dto/create-correction.dto';
import { UpdateCorrectionDto } from './dto/update-correction.dto';
import { CorrectionStatus } from '../generated/prisma/client';
import { PrismaAuditOutboxWriter } from '../audit/prisma-audit-outbox.writer';
import { PrismaService } from '../prisma/prisma.service';
import type { CommandContext } from '../request-context/request-context.types';

@Injectable()
export class CorrectionsService {
  private readonly auditWriter = new PrismaAuditOutboxWriter();

  constructor(
    private readonly repository: PrismaCorrectionsRepository,
    private readonly prisma: PrismaService,
  ) {}

  async createCorrectionRequest(ctx: CommandContext, dto: CreateCorrectionDto) {
    if (!ctx.actorEmployeeId) {
      throw new Error('Employee ID is required');
    }
    const actorEmployeeId = ctx.actorEmployeeId;

    return this.prisma.$transaction(async (tx) => {
      const correction = await this.repository.create(
        {
          organizationId: ctx.organizationId,
          targetType: dto.targetType,
          targetId: dto.targetId,
          reason: dto.reason,
          proposedData: dto.proposedData,
          status: dto.status || CorrectionStatus.REQUESTED,
          requestedByEmployeeId: actorEmployeeId,
        },
        tx,
      );

      await this.auditWriter.write(tx, {
        context: ctx,
        action: 'correction_request.created',
        entityId: correction.id,
        entityType: 'CORRECTION_REQUEST',
        changedFields: [
          'id',
          'status',
          'reason',
          'targetId',
          'targetType',
          'proposedData',
        ],
        payload: { ...correction },
        metadata: {
          correctionId: correction.id,
          targetType: dto.targetType,
          targetId: dto.targetId,
          reason: dto.reason,
        },
      });

      return correction;
    });
  }

  async getCorrectionRequests(
    organizationId: string,
    targetType?: string,
    targetId?: string,
  ) {
    return this.repository.findMany({
      where: {
        organizationId,
        ...(targetType ? { targetType: targetType as any } : {}),
        ...(targetId ? { targetId } : {}),
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getCorrectionRequestById(organizationId: string, correctionId: string) {
    const correction = await this.repository.findById(
      organizationId,
      correctionId,
    );
    if (!correction) {
      throw new NotFoundException('Correction not found');
    }
    return correction;
  }

  async updateCorrectionRequest(
    ctx: CommandContext,
    correctionId: string,
    dto: UpdateCorrectionDto,
  ) {
    if (!ctx.actorEmployeeId) {
      throw new Error('Employee ID is required');
    }
    const actorEmployeeId = ctx.actorEmployeeId;

    return this.prisma.$transaction(async (tx) => {
      const existing = await this.repository.findById(
        ctx.organizationId,
        correctionId,
        tx,
      );
      if (!existing) {
        throw new NotFoundException('Correction not found');
      }

      const updated = await this.repository.update(
        ctx.organizationId,
        correctionId,
        {
          status: dto.status !== undefined ? dto.status : existing.status,
        },
        tx,
      );

      if (
        dto.status &&
        (dto.status === CorrectionStatus.APPROVED ||
          dto.status === CorrectionStatus.REJECTED) &&
        existing.status !== dto.status
      ) {
        await this.repository.recordDecision(
          ctx.organizationId,
          correctionId,
          actorEmployeeId,
          dto.status,
          dto.reason,
          tx,
        );

        await this.auditWriter.write(tx, {
          context: ctx,
          action: 'correction_request.decided',
          entityId: updated.id,
          entityType: 'CORRECTION_REQUEST',
          changedFields: ['status'],
          payload: { status: dto.status, reason: dto.reason },
          metadata: {
            correctionId: updated.id,
            status: dto.status,
            reason: dto.reason,
          },
        });
      }

      return updated;
    });
  }
}
