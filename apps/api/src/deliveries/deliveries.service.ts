import {
  Injectable,
  NotFoundException,
  ConflictException,
  Optional,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { OperationalHoldGuard } from '../holds/operational-hold.guard';
import { PrismaAuditOutboxWriter } from '../audit/prisma-audit-outbox.writer';
import { CreateDeliveryDto } from './dto/create-delivery.dto';
import { UpdateDeliveryDto } from './dto/update-delivery.dto';
import { RecordAttemptDto } from './dto/record-attempt.dto';
import {
  DeliveryStatus,
  DeliveryAttemptResult,
  PackageStatus,
} from '../generated/prisma/client';
import type { CommandContext } from '../request-context/request-context.types';

@Injectable()
export class DeliveriesService {
  private readonly auditWriter = new PrismaAuditOutboxWriter();

  constructor(
    private readonly prisma: PrismaService,
    @Optional()
    private readonly operationalHoldGuard?: OperationalHoldGuard,
  ) {}

  async findAll(ctx: CommandContext) {
    return this.prisma.deliveryOrder.findMany({
      where: { organizationId: ctx.organizationId },
      include: {
        customer: {
          select: {
            firstName: true,
            lastName: true,
            businessName: true,
            customerCode: true,
          },
        },
        items: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(ctx: CommandContext, id: string) {
    const delivery = await this.prisma.deliveryOrder.findUnique({
      where: { organizationId_id: { organizationId: ctx.organizationId, id } },
      include: {
        customer: true,
        items: { include: { package: true } },
        attempts: { orderBy: { attemptedAt: 'desc' } },
      },
    });

    if (!delivery) {
      throw new NotFoundException(`Delivery with ID ${id} not found.`);
    }

    return delivery;
  }

  async create(ctx: CommandContext, dto: CreateDeliveryDto) {
    if (!ctx.actorEmployeeId) {
      throw new ConflictException('Employee ID is required');
    }
    const organizationId = ctx.organizationId;

    const packages = await this.prisma.package.findMany({
      where: {
        organizationId,
        id: { in: dto.packageIds },
      },
    });

    if (packages.length !== dto.packageIds.length) {
      throw new NotFoundException('One or more packages not found.');
    }

    const invalidPackages = packages.filter(
      (p) =>
        p.customerId !== dto.customerId ||
        p.status !== PackageStatus.ARRIVED_AT_DESTINATION,
    );
    if (invalidPackages.length > 0) {
      throw new ConflictException(
        'Packages must belong to customer and be in ARRIVED_AT_DESTINATION status.',
      );
    }

    await this.operationalHoldGuard?.assertNoActivePackageHolds(
      organizationId,
      dto.packageIds,
      { operation: 'delivery creation' },
    );

    return this.prisma.$transaction(async (tx) => {
      const delivery = await tx.deliveryOrder.create({
        data: {
          organizationId,
          deliveryNumber: dto.deliveryNumber,
          customerId: dto.customerId,
          method: dto.method,
          deliveryAddressSnap: dto.deliveryAddressSnap ?? {},
          notes: dto.notes,
          assignedToId: dto.assignedToId,
          createdById: ctx.actorEmployeeId!,
          status: DeliveryStatus.DRAFT,
          items: {
            create: dto.packageIds.map((pkgId) => ({
              organizationId,
              packageId: pkgId,
            })),
          },
        },
        include: { items: true },
      });

      await this.auditWriter.write(tx, {
        context: ctx,
        action: 'delivery.created',
        entityType: 'DELIVERY_ORDER',
        entityId: delivery.id,
        changedFields: Object.keys(dto),
        payload: { id: delivery.id, deliveryNumber: delivery.deliveryNumber },
      });

      return delivery;
    });
  }

  async update(ctx: CommandContext, id: string, dto: UpdateDeliveryDto) {
    const organizationId = ctx.organizationId;
    const delivery = await this.findOne(ctx, id);

    if (delivery.status !== DeliveryStatus.DRAFT) {
      throw new ConflictException(
        'Cannot update a delivery that is not in DRAFT status.',
      );
    }

    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.deliveryOrder.update({
        where: { organizationId_id: { organizationId, id } },
        data: {
          ...dto,
          deliveryAddressSnap: dto.deliveryAddressSnap ?? undefined,
        },
      });

      await this.auditWriter.write(tx, {
        context: ctx,
        action: 'delivery.updated',
        entityType: 'DELIVERY_ORDER',
        entityId: id,
        changedFields: Object.keys(dto),
        payload: { id },
      });

      return updated;
    });
  }

  async markReady(ctx: CommandContext, id: string) {
    const organizationId = ctx.organizationId;
    const delivery = await this.findOne(ctx, id);
    if (delivery.status !== DeliveryStatus.DRAFT)
      throw new ConflictException('Delivery must be in DRAFT status.');

    await this.operationalHoldGuard?.assertNoActivePackageHolds(
      organizationId,
      delivery.items.map((item) => item.packageId),
      { operation: 'delivery readiness' },
    );

    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.deliveryOrder.update({
        where: { organizationId_id: { organizationId, id } },
        data: { status: DeliveryStatus.READY },
      });

      await this.auditWriter.write(tx, {
        context: ctx,
        action: 'delivery.ready',
        entityType: 'DELIVERY_ORDER',
        entityId: id,
        changedFields: ['status'],
        payload: { id },
      });

      return updated;
    });
  }

  async dispatch(ctx: CommandContext, id: string) {
    const organizationId = ctx.organizationId;
    const delivery = await this.findOne(ctx, id);
    if (delivery.status !== DeliveryStatus.READY)
      throw new ConflictException('Delivery must be in READY status.');

    const packageIds = delivery.items.map((item) => item.packageId);
    await this.operationalHoldGuard?.assertNoActivePackageHolds(
      organizationId,
      packageIds,
      { operation: 'delivery dispatch' },
    );

    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.deliveryOrder.update({
        where: { organizationId_id: { organizationId, id } },
        data: {
          status: DeliveryStatus.OUT_FOR_DELIVERY,
          dispatchedAt: new Date(),
        },
      });

      await tx.package.updateMany({
        where: { organizationId, id: { in: packageIds } },
        data: { status: PackageStatus.OUT_FOR_DELIVERY },
      });

      await this.auditWriter.write(tx, {
        context: ctx,
        action: 'delivery.dispatched',
        entityType: 'DELIVERY_ORDER',
        entityId: id,
        changedFields: ['status', 'dispatchedAt'],
        payload: { id },
      });

      return updated;
    });
  }

  async recordAttempt(ctx: CommandContext, id: string, dto: RecordAttemptDto) {
    if (!ctx.actorEmployeeId) {
      throw new ConflictException('Employee ID is required');
    }
    const organizationId = ctx.organizationId;
    const delivery = await this.findOne(ctx, id);
    if (delivery.status !== DeliveryStatus.OUT_FOR_DELIVERY)
      throw new ConflictException('Delivery must be OUT_FOR_DELIVERY.');

    if (dto.result === DeliveryAttemptResult.DELIVERED && !dto.receiverName) {
      throw new ConflictException(
        'receiverName is required when delivery is successful.',
      );
    }

    await this.operationalHoldGuard?.assertNoActivePackageHolds(
      organizationId,
      delivery.items.map((item) => item.packageId),
      { operation: 'delivery attempt' },
    );

    return this.prisma.$transaction(async (tx) => {
      await tx.deliveryAttempt.create({
        data: {
          organizationId,
          deliveryId: id,
          attemptedAt: new Date(),
          result: dto.result,
          notes: dto.notes,
          receiverName: dto.receiverName,
          recordedById: ctx.actorEmployeeId!,
        },
      });

      let updatedStatus = delivery.status;
      let deliveredAt = null;

      if (dto.result === DeliveryAttemptResult.DELIVERED) {
        updatedStatus = DeliveryStatus.DELIVERED;
        deliveredAt = new Date();
      } else {
        if (delivery.attempts.length >= 2) {
          updatedStatus = DeliveryStatus.FAILED;
        }
      }

      let updatedDelivery;
      if (updatedStatus !== delivery.status) {
        updatedDelivery = await tx.deliveryOrder.update({
          where: { organizationId_id: { organizationId, id } },
          data: { status: updatedStatus, deliveredAt },
        });

        if (updatedStatus === DeliveryStatus.DELIVERED) {
          const packageIds = delivery.items.map((item) => item.packageId);
          await tx.package.updateMany({
            where: { organizationId, id: { in: packageIds } },
            data: { status: PackageStatus.DELIVERED },
          });
        } else if (updatedStatus === DeliveryStatus.FAILED) {
          const packageIds = delivery.items.map((item) => item.packageId);
          await tx.package.updateMany({
            where: { organizationId, id: { in: packageIds } },
            data: { status: PackageStatus.ARRIVED_AT_DESTINATION },
          });
        }
      }

      const outboxEventType =
        updatedStatus === DeliveryStatus.DELIVERED
          ? 'delivery.delivered'
          : updatedStatus === DeliveryStatus.FAILED
            ? 'delivery.failed'
            : 'delivery.attempt.recorded';

      await this.auditWriter.write(tx, {
        context: ctx,
        action: outboxEventType,
        entityType: 'DELIVERY_ORDER',
        entityId: id,
        changedFields: ['attempts', 'status'],
        payload: { id },
      });

      return updatedDelivery || delivery;
    });
  }

  async cancel(ctx: CommandContext, id: string) {
    const organizationId = ctx.organizationId;
    const delivery = await this.findOne(ctx, id);
    if (
      delivery.status !== DeliveryStatus.DRAFT &&
      delivery.status !== DeliveryStatus.READY
    ) {
      throw new ConflictException('Can only cancel DRAFT or READY deliveries.');
    }

    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.deliveryOrder.update({
        where: { organizationId_id: { organizationId, id } },
        data: { status: DeliveryStatus.CANCELLED },
      });

      await this.auditWriter.write(tx, {
        context: ctx,
        action: 'delivery.cancelled',
        entityType: 'DELIVERY_ORDER',
        entityId: id,
        changedFields: ['status'],
        payload: { id },
      });

      return updated;
    });
  }
}
