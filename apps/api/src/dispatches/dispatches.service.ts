import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaDispatchesRepository } from './prisma-dispatches.repository';

import { CreateDispatchDto } from './dto/create-dispatch.dto';
import { UpdateDispatchDto } from './dto/update-dispatch.dto';
import { AddPackagesDto } from './dto/add-packages.dto';
import { DispatchStatus } from '../generated/prisma/client';
import { PrismaAuditOutboxWriter } from '../audit/prisma-audit-outbox.writer';
import type { AuditActionCode } from '../audit/audit.catalog';
import { PrismaService } from '../prisma/prisma.service';
import type { CommandContext } from '../request-context/request-context.types';
import { randomUUID } from 'crypto';

type MasterShipmentTransition = {
  action: AuditActionCode;
  targetStatus: DispatchStatus;
  allowedPreviousStatuses: readonly DispatchStatus[];
  timestampField?: 'departureTime' | 'actualArrivalTime';
  emitOutbox?: boolean;
};

@Injectable()
export class DispatchesService {
  private readonly auditWriter = new PrismaAuditOutboxWriter();

  constructor(
    private readonly repository: PrismaDispatchesRepository,
    private readonly prisma: PrismaService,
  ) {}

  private generateCode(): string {
    return `DSP-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`;
  }

  async createDispatch(ctx: CommandContext, dto: CreateDispatchDto) {
    if (!ctx.actorEmployeeId) {
      throw new BadRequestException('Employee ID is required');
    }

    if (dto.origin === dto.destination && dto.origin) {
      throw new BadRequestException(
        'Origin and destination cannot be the same',
      );
    }

    return this.prisma.$transaction(async (tx) => {
      const dispatch = await this.repository.create(
        {
          id: randomUUID(),
          organizationId: ctx.organizationId,
          dispatchCode: this.generateCode(),
          origin: dto.origin,
          destination: dto.destination,
          departureTime: dto.departureTime
            ? new Date(dto.departureTime)
            : undefined,
          estimatedArrivalTime: dto.estimatedArrivalTime
            ? new Date(dto.estimatedArrivalTime)
            : undefined,
          carrier: dto.carrier,
          flightNumber: dto.flightNumber,
          mawb: dto.mawb,
          status: DispatchStatus.DRAFT,
        },
        tx,
      );

      await this.auditWriter.write(tx, {
        context: ctx,
        action: 'dispatch.created',
        entityId: dispatch.id,
        entityType: 'DISPATCH',
        changedFields: [
          'id',
          'status',
          'dispatchCode',
          'origin',
          'destination',
        ],
        payload: { ...dispatch },
        metadata: {
          code: dispatch.dispatchCode,
          origin: dispatch.origin,
          destination: dispatch.destination,
        },
      });

      return dispatch;
    });
  }

  async getDispatches(organizationId: string) {
    return this.repository.findMany({
      where: { organizationId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getDispatchById(organizationId: string, dispatchId: string) {
    const dispatch = await this.repository.findById(organizationId, dispatchId);
    if (!dispatch) {
      throw new NotFoundException('Dispatch not found');
    }
    return dispatch;
  }

  async updateDispatch(
    ctx: CommandContext,
    dispatchId: string,
    dto: UpdateDispatchDto,
  ) {
    return this.prisma.$transaction(async (tx) => {
      const existing = await this.repository.findById(
        ctx.organizationId,
        dispatchId,
        tx,
      );
      if (!existing) {
        throw new NotFoundException('Dispatch not found');
      }

      if (
        existing.status === DispatchStatus.CLOSED ||
        existing.status === DispatchStatus.COMPLETED ||
        existing.status === DispatchStatus.CANCELLED
      ) {
        throw new BadRequestException(
          `Cannot update dispatch in ${existing.status} status`,
        );
      }

      const updated = await this.repository.update(
        ctx.organizationId,
        dispatchId,
        {
          status: dto.status !== undefined ? dto.status : existing.status,
          origin: dto.origin !== undefined ? dto.origin : existing.origin,
          destination:
            dto.destination !== undefined
              ? dto.destination
              : existing.destination,
          departureTime:
            dto.departureTime !== undefined
              ? dto.departureTime
                ? new Date(dto.departureTime)
                : null
              : existing.departureTime,
          estimatedArrivalTime:
            dto.estimatedArrivalTime !== undefined
              ? dto.estimatedArrivalTime
                ? new Date(dto.estimatedArrivalTime)
                : null
              : existing.estimatedArrivalTime,
          actualArrivalTime:
            dto.actualArrivalTime !== undefined
              ? dto.actualArrivalTime
                ? new Date(dto.actualArrivalTime)
                : null
              : existing.actualArrivalTime,
          carrier: dto.carrier !== undefined ? dto.carrier : existing.carrier,
          flightNumber:
            dto.flightNumber !== undefined
              ? dto.flightNumber
              : existing.flightNumber,
          mawb: dto.mawb !== undefined ? dto.mawb : existing.mawb,
        },
        tx,
      );

      const changedFields: string[] = [];
      if (existing.status !== updated.status) changedFields.push('status');
      if (existing.mawb !== updated.mawb) changedFields.push('mawb');

      if (changedFields.length > 0 || Object.keys(dto).length > 0) {
        await this.auditWriter.write(tx, {
          context: ctx,
          action:
            existing.status !== updated.status
              ? 'dispatch.status_changed'
              : 'dispatch.updated',
          entityId: updated.id,
          entityType: 'DISPATCH',
          changedFields,
          payload: { ...updated },
          metadata: {
            dispatchId: updated.id,
            oldStatus: existing.status,
            newStatus: updated.status,
          },
        });
      }

      return updated;
    });
  }

  async replaceMasterShipmentPackages(
    ctx: CommandContext,
    dispatchId: string,
    dto: AddPackagesDto,
  ) {
    return this.prisma.$transaction(async (tx) => {
      const existing = await this.repository.findById(
        ctx.organizationId,
        dispatchId,
        tx,
      );
      if (!existing) {
        throw new NotFoundException('Master shipment not found');
      }

      if (existing.status !== DispatchStatus.DRAFT) {
        throw new BadRequestException(
          'Can only replace packages on a DRAFT master shipment',
        );
      }

      const packageIds = [...new Set(dto.packageIds)];
      if (packageIds.length !== dto.packageIds.length) {
        throw new BadRequestException('Package IDs must be unique');
      }

      const packages = await tx.package.findMany({
        where: {
          organizationId: ctx.organizationId,
          id: { in: packageIds },
        },
        select: {
          id: true,
          dispatchId: true,
        },
      });

      if (packages.length !== packageIds.length) {
        throw new NotFoundException('One or more packages not found');
      }

      const assignedToAnotherShipment = packages.find(
        (pkg) => pkg.dispatchId && pkg.dispatchId !== dispatchId,
      );
      if (assignedToAnotherShipment) {
        throw new BadRequestException(
          `Package ${assignedToAnotherShipment.id} is already assigned to another master shipment`,
        );
      }

      await tx.package.updateMany({
        where: {
          organizationId: ctx.organizationId,
          dispatchId,
          id: { notIn: packageIds },
        },
        data: { dispatchId: null },
      });

      await tx.package.updateMany({
        where: {
          organizationId: ctx.organizationId,
          id: { in: packageIds },
        },
        data: { dispatchId },
      });

      const updated = await this.repository.findById(
        ctx.organizationId,
        dispatchId,
        tx,
      );
      if (!updated) {
        throw new NotFoundException('Master shipment not found');
      }

      await this.auditWriter.write(tx, {
        context: ctx,
        action: 'master_shipment.packages.replaced',
        entityId: updated.id,
        entityType: 'MASTER_SHIPMENT',
        changedFields: ['packages'],
        payload: { packageIds },
        metadata: {
          masterShipmentId: updated.id,
          packageCount: packageIds.length,
        },
        emitOutbox: false,
      });

      return updated;
    });
  }

  async closeMasterShipment(ctx: CommandContext, dispatchId: string) {
    return this.transitionMasterShipment(ctx, dispatchId, {
      action: 'master_shipment.closed',
      targetStatus: DispatchStatus.CLOSED,
      allowedPreviousStatuses: [DispatchStatus.DRAFT],
    });
  }

  async departMasterShipment(ctx: CommandContext, dispatchId: string) {
    return this.transitionMasterShipment(ctx, dispatchId, {
      action: 'master_shipment.departed',
      targetStatus: DispatchStatus.DEPARTED,
      allowedPreviousStatuses: [DispatchStatus.CLOSED],
      timestampField: 'departureTime',
    });
  }

  async arriveMasterShipment(ctx: CommandContext, dispatchId: string) {
    return this.transitionMasterShipment(ctx, dispatchId, {
      action: 'master_shipment.arrived',
      targetStatus: DispatchStatus.ARRIVED,
      allowedPreviousStatuses: [DispatchStatus.DEPARTED],
      timestampField: 'actualArrivalTime',
    });
  }

  async cancelMasterShipment(ctx: CommandContext, dispatchId: string) {
    return this.transitionMasterShipment(ctx, dispatchId, {
      action: 'master_shipment.cancelled',
      targetStatus: DispatchStatus.CANCELLED,
      allowedPreviousStatuses: [DispatchStatus.DRAFT, DispatchStatus.CLOSED],
      emitOutbox: false,
    });
  }

  async updateMasterShipmentMawb(
    ctx: CommandContext,
    dispatchId: string,
    mawb: string,
  ) {
    return this.prisma.$transaction(async (tx) => {
      const existing = await this.repository.findById(
        ctx.organizationId,
        dispatchId,
        tx,
      );
      if (!existing) {
        throw new NotFoundException('Master shipment not found');
      }

      if (existing.status === DispatchStatus.CANCELLED) {
        throw new BadRequestException(
          'Cannot update MAWB on a CANCELLED master shipment',
        );
      }

      if (existing.mawb === mawb) {
        return existing;
      }

      const updated = await this.repository.update(
        ctx.organizationId,
        dispatchId,
        { mawb },
        tx,
      );

      await this.auditWriter.write(tx, {
        context: ctx,
        action: 'master_shipment.mawb.updated',
        entityId: updated.id,
        entityType: 'MASTER_SHIPMENT',
        changedFields: ['mawb'],
        beforeData: { mawb: existing.mawb },
        afterData: { mawb: updated.mawb },
        payload: { masterShipmentId: updated.id, mawb: updated.mawb },
        metadata: { masterShipmentId: updated.id },
      });

      return updated;
    });
  }

  private async transitionMasterShipment(
    ctx: CommandContext,
    dispatchId: string,
    transition: MasterShipmentTransition,
  ) {
    return this.prisma.$transaction(async (tx) => {
      const existing = await this.repository.findById(
        ctx.organizationId,
        dispatchId,
        tx,
      );
      if (!existing) {
        throw new NotFoundException('Master shipment not found');
      }

      if (existing.status === transition.targetStatus) {
        return existing;
      }

      if (!transition.allowedPreviousStatuses.includes(existing.status)) {
        throw new BadRequestException(
          `Cannot transition master shipment from ${existing.status} to ${transition.targetStatus}`,
        );
      }

      const timestamp = new Date();
      const data =
        transition.timestampField === undefined
          ? { status: transition.targetStatus }
          : {
              status: transition.targetStatus,
              [transition.timestampField]:
                existing[transition.timestampField] ?? timestamp,
            };

      const updated = await this.repository.update(
        ctx.organizationId,
        dispatchId,
        data,
        tx,
      );

      await this.auditWriter.write(tx, {
        context: ctx,
        action: transition.action,
        entityId: updated.id,
        entityType: 'MASTER_SHIPMENT',
        changedFields: ['status'],
        beforeData: { status: existing.status },
        afterData: { status: updated.status },
        payload: {
          masterShipmentId: updated.id,
          previousStatus: existing.status,
          newStatus: updated.status,
        },
        metadata: {
          masterShipmentId: updated.id,
          previousStatus: existing.status,
          newStatus: updated.status,
        },
        emitOutbox: transition.emitOutbox,
      });

      return updated;
    });
  }

  async addPackages(
    ctx: CommandContext,
    dispatchId: string,
    dto: AddPackagesDto,
  ) {
    return this.prisma.$transaction(async (tx) => {
      const existing = await this.repository.findById(
        ctx.organizationId,
        dispatchId,
        tx,
      );
      if (!existing) {
        throw new NotFoundException('Dispatch not found');
      }

      if (existing.status !== DispatchStatus.DRAFT) {
        throw new BadRequestException(
          'Can only add packages to a DRAFT dispatch',
        );
      }

      const updated = await this.repository.updatePackageAssociation(
        ctx.organizationId,
        dispatchId,
        dto.packageIds,
        true,
        tx,
      );

      await this.auditWriter.write(tx, {
        context: ctx,
        action: 'dispatch.packages_added',
        entityId: updated.id,
        entityType: 'DISPATCH',
        changedFields: ['packages'],
        payload: { packageIds: dto.packageIds },
        metadata: { dispatchId: updated.id, addedCount: dto.packageIds.length },
      });

      return updated;
    });
  }

  async removePackages(
    ctx: CommandContext,
    dispatchId: string,
    dto: AddPackagesDto,
  ) {
    return this.prisma.$transaction(async (tx) => {
      const existing = await this.repository.findById(
        ctx.organizationId,
        dispatchId,
        tx,
      );
      if (!existing) {
        throw new NotFoundException('Dispatch not found');
      }

      if (existing.status !== DispatchStatus.DRAFT) {
        throw new BadRequestException(
          'Can only remove packages from a DRAFT dispatch',
        );
      }

      const updated = await this.repository.updatePackageAssociation(
        ctx.organizationId,
        dispatchId,
        dto.packageIds,
        false,
        tx,
      );

      await this.auditWriter.write(tx, {
        context: ctx,
        action: 'dispatch.packages_removed',
        entityId: updated.id,
        entityType: 'DISPATCH',
        changedFields: ['packages'],
        payload: { packageIds: dto.packageIds },
        metadata: {
          dispatchId: updated.id,
          removedCount: dto.packageIds.length,
        },
      });

      return updated;
    });
  }
}
