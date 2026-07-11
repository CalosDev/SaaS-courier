import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaCorrectionsRepository } from './prisma-corrections.repository';
import { CreateCorrectionDto } from './dto/create-correction.dto';
import { UpdateCorrectionDto } from './dto/update-correction.dto';
import { CorrectionStatus, Prisma } from '../generated/prisma/client';
import {
  ExternalTrackingNormalizationError,
  ExternalTrackingNormalizer,
} from '../common/tracking/external-tracking-normalizer';
import { PrismaAuditOutboxWriter } from '../audit/prisma-audit-outbox.writer';
import { PrismaService } from '../prisma/prisma.service';
import type { CommandContext } from '../request-context/request-context.types';

type LockedPackageCorrectionRow = {
  id: string;
  customer_id: string;
  prealert_id: string | null;
  internal_tracking_number: string;
  external_tracking_number: string;
  external_tracking_number_normalized: string;
  status:
    | 'RECEPTION_PENDING'
    | 'RECEIVED_AT_ORIGIN'
    | 'IN_TRANSIT'
    | 'ARRIVED_AT_DESTINATION'
    | 'OUT_FOR_DELIVERY'
    | 'DELIVERED'
    | 'CANCELLED';
  notes: string | null;
};

type LockedCorrectionRequestRow = {
  id: string;
  target_type: 'PACKAGE' | 'PREALERT' | 'MANIFEST' | 'CUSTOMS_CASE' | 'INVOICE';
  target_id: string;
  status: 'REQUESTED' | 'APPROVED' | 'REJECTED' | 'APPLIED' | 'CANCELLED';
  proposed_data: Prisma.JsonValue;
};

@Injectable()
export class CorrectionsService {
  private readonly auditWriter = new PrismaAuditOutboxWriter();
  private readonly trackingNormalizer = new ExternalTrackingNormalizer();

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

  async approveCorrectionRequest(
    ctx: CommandContext,
    correctionId: string,
    dto: Pick<UpdateCorrectionDto, 'reason'>,
  ) {
    return this.updateCorrectionRequest(ctx, correctionId, {
      status: CorrectionStatus.APPROVED,
      reason: dto.reason,
    });
  }

  async rejectCorrectionRequest(
    ctx: CommandContext,
    correctionId: string,
    dto: Pick<UpdateCorrectionDto, 'reason'>,
  ) {
    return this.updateCorrectionRequest(ctx, correctionId, {
      status: CorrectionStatus.REJECTED,
      reason: dto.reason,
    });
  }

  async applyCorrectionRequest(ctx: CommandContext, correctionId: string) {
    if (!ctx.actorEmployeeId) {
      throw new Error('Employee ID is required');
    }
    const actorEmployeeId = ctx.actorEmployeeId;

    return this.prisma.$transaction(async (tx) => {
      const existing = await this.lockCorrectionRequest(
        tx,
        ctx.organizationId,
        correctionId,
      );
      if (!existing) {
        throw new NotFoundException('Correction not found');
      }

      if (existing.status === 'APPLIED') {
        const applied = await this.repository.findById(
          ctx.organizationId,
          correctionId,
          tx,
        );
        if (!applied) {
          throw new NotFoundException('Correction not found');
        }

        return applied;
      }

      if (existing.status !== 'APPROVED') {
        throw new ConflictException('Only approved corrections can be applied');
      }

      if (existing.target_type !== 'PACKAGE') {
        throw new ConflictException(
          `Correction application is not configured for ${existing.target_type}`,
        );
      }

      await this.applyPackageCorrection(ctx, existing, tx);

      const updated = await this.repository.update(
        ctx.organizationId,
        correctionId,
        {
          status: CorrectionStatus.APPLIED,
        },
        tx,
      );

      await this.repository.recordDecision(
        ctx.organizationId,
        correctionId,
        actorEmployeeId,
        CorrectionStatus.APPLIED,
        'Correction applied to package',
        tx,
      );

      await this.auditWriter.write(tx, {
        context: ctx,
        action: 'correction.applied',
        entityId: updated.id,
        entityType: 'CORRECTION_REQUEST',
        changedFields: ['status'],
        beforeData: {
          status: existing.status,
        },
        afterData: {
          status: updated.status,
        },
        payload: {
          correctionId: updated.id,
          targetType: existing.target_type,
          targetId: existing.target_id,
          status: updated.status,
        },
        metadata: {
          correctionId: updated.id,
          targetType: existing.target_type,
          targetId: existing.target_id,
        },
      });

      return updated;
    });
  }

  private async applyPackageCorrection(
    ctx: CommandContext,
    correction: LockedCorrectionRequestRow,
    tx: Prisma.TransactionClient,
  ) {
    const current = await this.lockPackage(
      tx,
      ctx.organizationId,
      correction.target_id,
    );
    if (!current) {
      throw new NotFoundException('Package not found');
    }

    if (current.status !== 'RECEPTION_PENDING') {
      throw new ConflictException(
        'Only reception-pending packages can be corrected',
      );
    }

    const input = await this.normalizePackageCorrectionData(
      ctx.organizationId,
      correction.proposed_data,
      tx,
    );

    if (
      current.prealert_id &&
      (input.customerId !== undefined ||
        input.externalTrackingNumber !== undefined)
    ) {
      throw new ConflictException(
        'Packages linked to prealerts can only update notes',
      );
    }

    if (
      input.externalTrackingNumberNormalized !== undefined &&
      input.externalTrackingNumberNormalized !==
        current.external_tracking_number_normalized
    ) {
      const pendingPrealert = await this.findPendingPrealertByTracking(
        tx,
        ctx.organizationId,
        input.externalTrackingNumberNormalized,
      );
      if (pendingPrealert) {
        throw new ConflictException(
          'A pending prealert already exists for this tracking number',
        );
      }
    }

    const changedFields = this.collectPackageCorrectionChangedFields(
      current,
      input,
    );

    if (changedFields.length === 0) {
      return;
    }

    const beforeData = this.packageCorrectionSnapshot(current);

    try {
      const updated = await tx.package.update({
        where: {
          organizationId_id: {
            organizationId: ctx.organizationId,
            id: current.id,
          },
        },
        data: {
          ...(input.customerId !== undefined
            ? { customerId: input.customerId }
            : {}),
          ...(input.externalTrackingNumber !== undefined
            ? { externalTrackingNumber: input.externalTrackingNumber }
            : {}),
          ...(input.externalTrackingNumberNormalized !== undefined
            ? {
                externalTrackingNumberNormalized:
                  input.externalTrackingNumberNormalized,
              }
            : {}),
          ...(input.notes !== undefined ? { notes: input.notes } : {}),
        },
      });

      await this.auditWriter.write(tx, {
        context: ctx,
        action: 'package.updated',
        entityId: updated.id,
        entityType: 'PACKAGE',
        changedFields,
        beforeData,
        afterData: this.packageCorrectionSnapshot({
          id: updated.id,
          customer_id: updated.customerId,
          prealert_id: updated.prealertId,
          internal_tracking_number: updated.internalTrackingNumber,
          external_tracking_number: updated.externalTrackingNumber,
          external_tracking_number_normalized:
            updated.externalTrackingNumberNormalized,
          status: updated.status,
          notes: updated.notes,
        }),
        payload: {
          packageId: updated.id,
          correctionId: correction.id,
          changedFields,
        },
        metadata: {
          correctionId: correction.id,
        },
        emitOutbox: false,
      });
    } catch (error) {
      if (this.isPackageTrackingConflictError(error)) {
        throw new ConflictException('Package tracking conflict');
      }

      throw error;
    }
  }

  private async normalizePackageCorrectionData(
    organizationId: string,
    value: Prisma.JsonValue,
    tx: Prisma.TransactionClient,
  ): Promise<{
    customerId?: string;
    externalTrackingNumber?: string;
    externalTrackingNumberNormalized?: string;
    notes?: string | null;
  }> {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      throw new BadRequestException(
        'Package correction data must be an object',
      );
    }

    const record = value as Record<string, unknown>;
    const allowedFields = ['customerId', 'externalTrackingNumber', 'notes'];
    const invalidFields = Object.keys(record).filter(
      (key) => !allowedFields.includes(key),
    );
    if (invalidFields.length > 0) {
      throw new BadRequestException(
        `Unsupported package correction fields: ${invalidFields.join(', ')}`,
      );
    }

    const normalized: {
      customerId?: string;
      externalTrackingNumber?: string;
      externalTrackingNumberNormalized?: string;
      notes?: string | null;
    } = {};

    if ('customerId' in record) {
      if (typeof record.customerId !== 'string' || !record.customerId.trim()) {
        throw new BadRequestException('customerId must be a non-empty string');
      }

      const customerId = record.customerId.trim();
      const customer = await tx.customer.findFirst({
        where: {
          organizationId,
          id: customerId,
          deletedAt: null,
        },
        select: {
          id: true,
          status: true,
        },
      });

      if (!customer) {
        throw new NotFoundException('Customer not found');
      }

      if (customer.status === 'SUSPENDED' || customer.status === 'CLOSED') {
        throw new ConflictException('Package customer is unavailable');
      }

      normalized.customerId = customer.id;
    }

    if ('externalTrackingNumber' in record) {
      try {
        const tracking = this.trackingNormalizer.normalize(
          record.externalTrackingNumber,
        );
        normalized.externalTrackingNumber = tracking.original;
        normalized.externalTrackingNumberNormalized = tracking.normalized;
      } catch (error) {
        if (error instanceof ExternalTrackingNormalizationError) {
          throw new BadRequestException('externalTrackingNumber is invalid');
        }

        throw error;
      }
    }

    if ('notes' in record) {
      if (record.notes === null) {
        normalized.notes = null;
      } else if (typeof record.notes === 'string') {
        const notes = record.notes.trim();
        normalized.notes = notes.length > 0 ? notes : null;
      } else {
        throw new BadRequestException('notes must be a string or null');
      }
    }

    if (Object.keys(normalized).length === 0) {
      throw new BadRequestException(
        'Package correction requires at least one supported field',
      );
    }

    return normalized;
  }

  private collectPackageCorrectionChangedFields(
    current: LockedPackageCorrectionRow,
    input: {
      customerId?: string;
      externalTrackingNumber?: string;
      notes?: string | null;
    },
  ): string[] {
    const changed: string[] = [];

    if (
      input.customerId !== undefined &&
      input.customerId !== current.customer_id
    ) {
      changed.push('customerId');
    }

    if (
      input.externalTrackingNumber !== undefined &&
      input.externalTrackingNumber !== current.external_tracking_number
    ) {
      changed.push('externalTrackingNumber');
    }

    if (input.notes !== undefined && input.notes !== current.notes) {
      changed.push('notes');
    }

    return changed;
  }

  private packageCorrectionSnapshot(
    packageRecord: LockedPackageCorrectionRow,
  ): Record<string, unknown> {
    return {
      internalTrackingNumber: packageRecord.internal_tracking_number,
      externalTrackingNumberMasked: this.maskTracking(
        packageRecord.external_tracking_number,
      ),
      customerId: packageRecord.customer_id,
      prealertId: packageRecord.prealert_id,
      status: packageRecord.status,
      notes: packageRecord.notes,
    };
  }

  private maskTracking(value: string): string {
    const trimmed = value.trim();

    if (trimmed.length <= 8) {
      return `${trimmed.slice(0, 2)}****${trimmed.slice(-2)}`;
    }

    return `${trimmed.slice(0, 4)}${'*'.repeat(Math.max(trimmed.length - 8, 4))}${trimmed.slice(-4)}`;
  }

  private async lockPackage(
    tx: Prisma.TransactionClient,
    organizationId: string,
    packageId: string,
  ): Promise<LockedPackageCorrectionRow | null> {
    const rows = await tx.$queryRaw<LockedPackageCorrectionRow[]>(Prisma.sql`
      SELECT
        id,
        customer_id,
        prealert_id,
        internal_tracking_number,
        external_tracking_number,
        external_tracking_number_normalized,
        status,
        notes
      FROM packages
      WHERE organization_id = ${organizationId}
        AND id = ${packageId}
        AND deleted_at IS NULL
      FOR UPDATE
    `);

    return rows[0] ?? null;
  }

  private async lockCorrectionRequest(
    tx: Prisma.TransactionClient,
    organizationId: string,
    correctionId: string,
  ): Promise<LockedCorrectionRequestRow | null> {
    const rows = await tx.$queryRaw<LockedCorrectionRequestRow[]>(Prisma.sql`
      SELECT
        id,
        target_type,
        target_id,
        status,
        proposed_data
      FROM correction_requests
      WHERE organization_id = ${organizationId}
        AND id = ${correctionId}
      FOR UPDATE
    `);

    return rows[0] ?? null;
  }

  private async findPendingPrealertByTracking(
    tx: Prisma.TransactionClient,
    organizationId: string,
    externalTrackingNumberNormalized: string,
  ): Promise<{ id: string } | null> {
    const rows = await tx.$queryRaw<{ id: string }[]>(Prisma.sql`
      SELECT id
      FROM prealerts
      WHERE organization_id = ${organizationId}
        AND external_tracking_number_normalized = ${externalTrackingNumberNormalized}
        AND status = 'PENDING_ARRIVAL'
        AND deleted_at IS NULL
      FOR UPDATE
    `);

    return rows[0] ?? null;
  }

  private isPackageTrackingConflictError(error: unknown): boolean {
    if (!this.isKnownRequestError(error) || error.code !== 'P2002') {
      return false;
    }

    const target = error.meta?.target;
    const targetText = Array.isArray(target)
      ? target.join(',')
      : typeof target === 'string'
        ? target
        : '';

    return (
      targetText.includes(
        'packages_one_active_external_tracking_per_organization',
      ) ||
      targetText.includes('external_tracking_number_normalized') ||
      targetText.includes('externalTrackingNumberNormalized')
    );
  }

  private isKnownRequestError(
    error: unknown,
  ): error is Prisma.PrismaClientKnownRequestError {
    return error instanceof Error && 'code' in error && 'meta' in error;
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
