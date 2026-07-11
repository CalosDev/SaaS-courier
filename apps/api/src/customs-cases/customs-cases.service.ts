import { Injectable, NotFoundException } from '@nestjs/common';
import {
  PrismaCustomsCasesRepository,
  CustomsCaseWithEvents,
} from './prisma-customs-cases.repository';
import { CreateCustomsCaseDto } from './dto/create-customs-case.dto';
import { RecordCustomsEventDto } from './dto/record-customs-event.dto';
import { ChangeCustomsCaseStatusDto } from './dto/change-customs-case-status.dto';
import { CommandContext } from '../request-context/request-context.types';
import { PrismaService } from '../prisma/prisma.service';
import { PrismaAuditOutboxWriter } from '../audit/prisma-audit-outbox.writer';
import { CustomsCase } from '../generated/prisma/client';

@Injectable()
export class CustomsCasesService {
  private readonly auditWriter = new PrismaAuditOutboxWriter();

  constructor(
    private readonly repository: PrismaCustomsCasesRepository,
    private readonly prisma: PrismaService,
  ) {}

  async create(
    ctx: CommandContext,
    dto: CreateCustomsCaseDto,
  ): Promise<CustomsCase> {
    return this.prisma.$transaction(async (tx) => {
      const customsCase = await tx.customsCase.create({
        data: {
          organizationId: ctx.organizationId,
          caseNumber: dto.caseNumber,
        },
      });

      await this.auditWriter.write(tx, {
        context: ctx,
        action: 'customs_case.created',
        entityType: 'CUSTOMS_CASE',
        entityId: customsCase.id,
        changedFields: ['caseNumber'],
        payload: dto as unknown as Record<string, unknown>,
      });

      return customsCase;
    });
  }

  async findById(
    ctx: CommandContext,
    id: string,
  ): Promise<CustomsCaseWithEvents> {
    const customsCase = await this.repository.findById(ctx.organizationId, id);
    if (!customsCase) {
      throw new NotFoundException(`Customs case ${id} not found`);
    }
    return customsCase;
  }

  async findAll(ctx: CommandContext, params: { skip?: number; take?: number }) {
    return this.repository.findAll({
      skip: params.skip,
      take: params.take,
      where: { organizationId: ctx.organizationId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async recordEvent(
    ctx: CommandContext,
    id: string,
    dto: RecordCustomsEventDto,
  ) {
    const customsCase = await this.findById(ctx, id);

    return this.prisma.$transaction(async (tx) => {
      const event = await tx.customsCaseEvent.create({
        data: {
          organizationId: ctx.organizationId,
          customsCaseId: customsCase.id,
          source: dto.source,
          eventDate: new Date(dto.eventDate),
          description: dto.description,
        },
      });

      await this.auditWriter.write(tx, {
        context: ctx,
        action: 'customs_case.event.recorded',
        entityType: 'CUSTOMS_CASE',
        entityId: customsCase.id,
        changedFields: [],
        payload: dto as unknown as Record<string, unknown>,
      });

      return event;
    });
  }

  async changeStatus(
    ctx: CommandContext,
    id: string,
    dto: ChangeCustomsCaseStatusDto,
  ) {
    const customsCase = await this.findById(ctx, id);

    if (customsCase.status === dto.status) {
      return customsCase;
    }

    return this.prisma.$transaction(async (tx) => {
      const updatedCase = await tx.customsCase.update({
        where: {
          organizationId_id: { organizationId: ctx.organizationId, id },
        },
        data: {
          status: dto.status,
        },
      });

      await this.auditWriter.write(tx, {
        context: ctx,
        action: 'customs_case.status.changed',
        entityType: 'CUSTOMS_CASE',
        entityId: updatedCase.id,
        changedFields: ['status'],
        payload: {
          fromStatus: customsCase.status,
          toStatus: dto.status,
        },
      });

      return updatedCase;
    });
  }
}
