import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
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
import {
  CustomsCase,
  CustomsCaseStatus,
  CustomsEventSource,
  Prisma,
} from '../generated/prisma/client';

const TERMINAL_STATUSES = new Set<CustomsCaseStatus>([
  CustomsCaseStatus.RELEASED,
  CustomsCaseStatus.REJECTED,
  CustomsCaseStatus.CANCELLED,
]);

const ALLOWED_TRANSITIONS: Record<CustomsCaseStatus, CustomsCaseStatus[]> = {
  PENDING_REVIEW: ['UNDER_REVIEW', 'HELD', 'REJECTED', 'CANCELLED'],
  UNDER_REVIEW: ['RELEASED', 'HELD', 'REJECTED', 'CANCELLED'],
  HELD: ['UNDER_REVIEW', 'RELEASED', 'REJECTED', 'CANCELLED'],
  RELEASED: [],
  REJECTED: [],
  CANCELLED: [],
};

const PROHIBITED_EVIDENCE_PATTERN =
  /<[^>]+>|\b(cookie|password|passwd|contrase(?:n|ñ)a|authorization|bearer|session[_ -]?token|access[_ -]?token|refresh[_ -]?token|client[_ -]?secret)\b/i;

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
    try {
      return await this.prisma.$transaction(async (tx) => {
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
          emitOutbox: false,
        });

        return customsCase;
      });
    } catch (error) {
      if (this.isKnownRequestError(error) && error.code === 'P2002') {
        throw new ConflictException('Customs case number already exists');
      }
      throw error;
    }
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
    this.assertEventEvidence(dto);

    return this.prisma.$transaction(async (tx) => {
      const customsCase = await tx.customsCase.findUnique({
        where: {
          organizationId_id: { organizationId: ctx.organizationId, id },
        },
      });
      if (!customsCase)
        throw new NotFoundException(`Customs case ${id} not found`);
      const event = await tx.customsCaseEvent.create({
        data: {
          organizationId: ctx.organizationId,
          customsCaseId: customsCase.id,
          source: dto.source,
          eventDate: new Date(dto.eventDate),
          description: dto.description.trim(),
          evidenceReference: dto.evidenceReference?.trim(),
          recordedByEmployeeId: ctx.actorEmployeeId,
        },
      });

      await this.auditWriter.write(tx, {
        context: ctx,
        action: 'customs_case.event.recorded',
        entityType: 'CUSTOMS_CASE',
        entityId: customsCase.id,
        changedFields: [],
        payload: {
          customsCaseId: customsCase.id,
          source: dto.source,
          eventDate: dto.eventDate,
          evidenceReference: dto.evidenceReference,
        },
        emitOutbox: false,
      });

      return event;
    });
  }

  async changeStatus(
    ctx: CommandContext,
    id: string,
    dto: ChangeCustomsCaseStatusDto,
  ) {
    return this.prisma.$transaction(async (tx) => {
      await tx.$queryRawUnsafe(
        'SELECT id::text FROM customs_cases WHERE organization_id = $1::uuid AND id = $2::uuid FOR UPDATE',
        ctx.organizationId,
        id,
      );
      const customsCase = await tx.customsCase.findUnique({
        where: {
          organizationId_id: { organizationId: ctx.organizationId, id },
        },
      });
      if (!customsCase)
        throw new NotFoundException(`Customs case ${id} not found`);
      if (customsCase.status === dto.status) return customsCase;
      if (
        TERMINAL_STATUSES.has(customsCase.status) ||
        !ALLOWED_TRANSITIONS[customsCase.status].includes(dto.status)
      ) {
        throw new ConflictException(
          `Invalid customs case transition from ${customsCase.status} to ${dto.status}`,
        );
      }

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
          customsCaseId: id,
          fromStatus: customsCase.status,
          toStatus: dto.status,
        },
        idempotencyKey: `${ctx.organizationId}:${id}:customs-status:${dto.status}`,
        emitOutbox: true,
      });

      return updatedCase;
    });
  }

  private assertEventEvidence(dto: RecordCustomsEventDto): void {
    const description = dto.description.trim();
    const evidenceReference = dto.evidenceReference?.trim();
    if (
      PROHIBITED_EVIDENCE_PATTERN.test(description) ||
      (evidenceReference && PROHIBITED_EVIDENCE_PATTERN.test(evidenceReference))
    ) {
      throw new BadRequestException(
        'Customs evidence cannot contain HTML or credentials',
      );
    }
    if (dto.source === CustomsEventSource.AUTHORIZED_INTEGRATION) {
      throw new BadRequestException(
        'Authorized integration events cannot be recorded manually',
      );
    }
    if (
      dto.source === CustomsEventSource.OFFICIAL_PORTAL &&
      !evidenceReference
    ) {
      throw new BadRequestException(
        'Official portal events require an evidence reference',
      );
    }
    if (new Date(dto.eventDate).getTime() > Date.now() + 5 * 60_000) {
      throw new BadRequestException(
        'Customs event date cannot be in the future',
      );
    }
  }

  private isKnownRequestError(
    error: unknown,
  ): error is Prisma.PrismaClientKnownRequestError {
    return (
      typeof error === 'object' &&
      error !== null &&
      'code' in error &&
      typeof (error as { code?: unknown }).code === 'string'
    );
  }
}
