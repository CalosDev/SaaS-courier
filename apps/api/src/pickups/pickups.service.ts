import {
  Injectable,
  NotFoundException,
  ConflictException,
  Optional,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { OperationalHoldGuard } from '../holds/operational-hold.guard';
import { PrismaAuditOutboxWriter } from '../audit/prisma-audit-outbox.writer';
import type { CommandContext } from '../request-context/request-context.types';
import { CreatePickupRequestDto } from './dto/create-pickup-request.dto';
import { UpdatePickupRequestDto } from './dto/update-pickup-request.dto';
import { randomUUID, randomBytes } from 'node:crypto';
import type { Prisma } from '../generated/prisma/client';

const PICKUP_ELIGIBLE_PACKAGE_STATUS = 'ARRIVED_AT_DESTINATION';

function generatePickupNumber(): string {
  const chars = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  const bytes = randomBytes(8);
  let result = '';
  for (let i = 0; i < 8; i++) {
    result += chars[bytes[i] % chars.length];
  }
  return result;
}

@Injectable()
export class PickupRequestsService {
  constructor(
    private readonly prisma: PrismaService,
    @Optional()
    private readonly operationalHoldGuard?: OperationalHoldGuard,
  ) {}

  private readonly auditWriter = new PrismaAuditOutboxWriter();

  private async lockPackages(
    tx: Prisma.TransactionClient,
    organizationId: string,
    packageIds: string[],
  ) {
    for (const packageId of [...packageIds].sort()) {
      await tx.$queryRawUnsafe(
        'SELECT 1 AS locked FROM (SELECT pg_advisory_xact_lock(hashtextextended($1, 0))) AS package_lock',
        `${organizationId}:${packageId}`,
      );
    }
  }

  private async assertFinanciallyEligible(
    tx: Prisma.TransactionClient,
    organizationId: string,
    customerId: string,
  ) {
    const unpaidInvoices = await tx.customerInvoice.count({
      where: {
        organizationId,
        customerId,
        status: { in: ['ISSUED', 'PARTIALLY_PAID'] },
        balanceDueMinor: { gt: 0 },
      },
    });
    if (unpaidInvoices > 0) {
      throw new ConflictException(
        'Customer has an outstanding balance and is not eligible for pickup',
      );
    }
  }

  async create(context: CommandContext, dto: CreatePickupRequestDto) {
    return this.prisma.$transaction(async (tx) => {
      // Validate customer
      const customer = await tx.customer.findUnique({
        where: { id: dto.customerId, organizationId: context.organizationId },
      });
      if (!customer) throw new NotFoundException('Customer not found');

      // Validate facility
      const facility = await tx.facility.findUnique({
        where: { id: dto.facilityId, organizationId: context.organizationId },
      });
      if (!facility) throw new NotFoundException('Facility not found');
      if (
        !facility.isActive ||
        facility.deletedAt ||
        !facility.isCustomerFacing
      ) {
        throw new ConflictException('Facility does not allow customer pickup');
      }

      await this.lockPackages(tx, context.organizationId, dto.packageIds);

      // Validate packages
      const packages = await tx.package.findMany({
        where: {
          id: { in: dto.packageIds },
          organizationId: context.organizationId,
          customerId: dto.customerId,
          status: PICKUP_ELIGIBLE_PACKAGE_STATUS,
          deletedAt: null,
        },
      });
      if (packages.length !== dto.packageIds.length) {
        throw new ConflictException(
          'Some packages are not eligible or do not belong to the customer',
        );
      }

      // Ensure packages are not already in a pending pickup
      const existingPickups = await tx.pickupRequestItem.findMany({
        where: {
          organizationId: context.organizationId,
          packageId: { in: dto.packageIds },
          pickupRequest: {
            status: { in: ['DRAFT', 'READY'] },
          },
        },
      });
      if (existingPickups.length > 0) {
        throw new ConflictException(
          'Some packages are already assigned to an active pickup request',
        );
      }

      await this.operationalHoldGuard?.assertNoActivePackageHolds(
        context.organizationId,
        dto.packageIds,
        { operation: 'pickup request creation', tx },
      );

      const id = randomUUID();
      const pickupNumber = `PU-${generatePickupNumber()}`;

      await tx.pickupRequest.create({
        data: {
          id,
          organizationId: context.organizationId,
          pickupNumber,
          facilityId: dto.facilityId,
          customerId: dto.customerId,
          status: 'DRAFT',
          requestedByEmployeeId: context.actorEmployeeId!,
        },
      });
      await tx.pickupRequestItem.createMany({
        data: dto.packageIds.map((packageId) => ({
          id: randomUUID(),
          organizationId: context.organizationId,
          pickupRequestId: id,
          packageId,
        })),
      });
      const pickupRequest = await tx.pickupRequest.findUniqueOrThrow({
        where: {
          organizationId_id: { organizationId: context.organizationId, id },
        },
        include: { items: true },
      });

      await this.auditWriter.write(tx, {
        context,
        action: 'pickup_request.created',
        entityType: 'PICKUP_REQUEST',
        entityId: id,
        changedFields: ['items', 'facilityId', 'customerId', 'status'],
        afterData: pickupRequest,
        payload: {
          pickupRequestId: id,
          packageIds: dto.packageIds,
        },
        emitOutbox: false,
      });

      return pickupRequest;
    });
  }

  async findAll(context: CommandContext) {
    return this.prisma.pickupRequest.findMany({
      where: { organizationId: context.organizationId },
      include: {
        customer: true,
        facility: true,
        items: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(context: CommandContext, id: string) {
    const pickupRequest = await this.prisma.pickupRequest.findUnique({
      where: { id, organizationId: context.organizationId },
      include: {
        customer: true,
        facility: true,
        items: { include: { package: true } },
      },
    });

    if (!pickupRequest) {
      throw new NotFoundException('Pickup request not found');
    }

    return pickupRequest;
  }

  async update(
    context: CommandContext,
    id: string,
    dto: UpdatePickupRequestDto,
  ) {
    return this.prisma.$transaction(async (tx) => {
      const existing = await tx.pickupRequest.findUnique({
        where: { id, organizationId: context.organizationId },
        include: { items: true },
      });
      if (!existing) throw new NotFoundException('Pickup request not found');
      if (existing.status !== 'DRAFT') {
        throw new ConflictException('Can only update DRAFT pickup requests');
      }

      if (dto.packageIds) {
        await this.lockPackages(tx, context.organizationId, dto.packageIds);
        // validate packages
        const packages = await tx.package.findMany({
          where: {
            id: { in: dto.packageIds },
            organizationId: context.organizationId,
            customerId: existing.customerId,
            status: PICKUP_ELIGIBLE_PACKAGE_STATUS,
            deletedAt: null,
          },
        });
        if (packages.length !== dto.packageIds.length) {
          throw new ConflictException(
            'Some packages do not exist or belong to another customer',
          );
        }

        // ensure packages are not in other active pickups
        const otherPickups = await tx.pickupRequestItem.findMany({
          where: {
            organizationId: context.organizationId,
            packageId: { in: dto.packageIds },
            pickupRequestId: { not: id },
            pickupRequest: { status: { in: ['DRAFT', 'READY'] } },
          },
        });
        if (otherPickups.length > 0) {
          throw new ConflictException(
            'Some packages are already in other active pickups',
          );
        }

        await this.operationalHoldGuard?.assertNoActivePackageHolds(
          context.organizationId,
          dto.packageIds,
          { operation: 'pickup request update', tx },
        );
      }

      if (dto.packageIds) {
        await tx.pickupRequestItem.deleteMany({
          where: {
            organizationId: context.organizationId,
            pickupRequestId: id,
          },
        });
        await tx.pickupRequestItem.createMany({
          data: dto.packageIds.map((packageId) => ({
            id: randomUUID(),
            organizationId: context.organizationId,
            pickupRequestId: id,
            packageId,
          })),
        });
      }

      const updated = await tx.pickupRequest.update({
        where: { id, organizationId: context.organizationId },
        data: {},
        include: { items: true },
      });

      await this.auditWriter.write(tx, {
        context,
        action: 'pickup_request.updated',
        entityType: 'PICKUP_REQUEST',
        entityId: id,
        changedFields: ['items'],
        beforeData: existing,
        afterData: updated,
        payload: {
          pickupRequestId: id,
          packageIds: dto.packageIds,
        },
        emitOutbox: false,
      });

      return updated;
    });
  }

  async markAsReady(context: CommandContext, id: string) {
    return this.prisma.$transaction(async (tx) => {
      const existing = await tx.pickupRequest.findUnique({
        where: { id, organizationId: context.organizationId },
        include: { items: true },
      });
      if (!existing) throw new NotFoundException('Pickup request not found');
      if (existing.status === 'READY') return existing;
      if (existing.status !== 'DRAFT')
        throw new ConflictException('Pickup request must be in DRAFT state');

      await this.lockPackages(
        tx,
        context.organizationId,
        existing.items.map((item) => item.packageId),
      );
      await this.assertFinanciallyEligible(
        tx,
        context.organizationId,
        existing.customerId,
      );

      await this.operationalHoldGuard?.assertNoActivePackageHolds(
        context.organizationId,
        existing.items.map((item) => item.packageId),
        { operation: 'pickup request readiness', tx },
      );

      const updated = await tx.pickupRequest.update({
        where: {
          organizationId_id: { organizationId: context.organizationId, id },
        },
        data: { status: 'READY' },
      });

      await this.auditWriter.write(tx, {
        context,
        action: 'pickup_request.ready',
        entityType: 'PICKUP_REQUEST',
        entityId: id,
        changedFields: ['status'],
        beforeData: { status: existing.status },
        afterData: { status: updated.status },
        payload: { pickupRequestId: id },
        emitOutbox: true,
      });

      return updated;
    });
  }

  async complete(context: CommandContext, id: string) {
    return this.prisma.$transaction(async (tx) => {
      const existing = await tx.pickupRequest.findUnique({
        where: { id, organizationId: context.organizationId },
        include: { items: true },
      });
      if (!existing) throw new NotFoundException('Pickup request not found');
      if (existing.status === 'COMPLETED') return existing;
      if (existing.status !== 'READY')
        throw new ConflictException(
          'Pickup request must be READY to be completed',
        );

      await this.lockPackages(
        tx,
        context.organizationId,
        existing.items.map((item) => item.packageId),
      );
      await this.assertFinanciallyEligible(
        tx,
        context.organizationId,
        existing.customerId,
      );

      await this.operationalHoldGuard?.assertNoActivePackageHolds(
        context.organizationId,
        existing.items.map((item) => item.packageId),
        { operation: 'pickup request completion', tx },
      );

      const updated = await tx.pickupRequest.update({
        where: {
          organizationId_id: { organizationId: context.organizationId, id },
        },
        data: {
          status: 'COMPLETED',
          completedByEmployeeId: context.actorEmployeeId!,
          completedAt: new Date(),
        },
      });

      await this.auditWriter.write(tx, {
        context,
        action: 'pickup_request.completed',
        entityType: 'PICKUP_REQUEST',
        entityId: id,
        changedFields: ['status', 'completedByEmployeeId', 'completedAt'],
        beforeData: { status: existing.status },
        afterData: {
          status: updated.status,
          completedByEmployeeId: updated.completedByEmployeeId,
          completedAt: updated.completedAt,
        },
        payload: { pickupRequestId: id },
        emitOutbox: true,
      });

      return updated;
    });
  }

  async cancel(context: CommandContext, id: string) {
    return this.prisma.$transaction(async (tx) => {
      const existing = await tx.pickupRequest.findUnique({
        where: { id, organizationId: context.organizationId },
      });
      if (!existing) throw new NotFoundException('Pickup request not found');
      if (existing.status === 'CANCELLED') return existing;
      if (existing.status === 'COMPLETED') {
        throw new ConflictException(
          `Cannot cancel a ${existing.status} pickup request`,
        );
      }

      const updated = await tx.pickupRequest.update({
        where: {
          organizationId_id: { organizationId: context.organizationId, id },
        },
        data: {
          status: 'CANCELLED',
          cancelledByEmployeeId: context.actorEmployeeId!,
          cancelledAt: new Date(),
        },
      });

      await this.auditWriter.write(tx, {
        context,
        action: 'pickup_request.cancelled',
        entityType: 'PICKUP_REQUEST',
        entityId: id,
        changedFields: ['status', 'cancelledByEmployeeId', 'cancelledAt'],
        beforeData: { status: existing.status },
        afterData: {
          status: updated.status,
          cancelledByEmployeeId: updated.cancelledByEmployeeId,
          cancelledAt: updated.cancelledAt,
        },
        payload: { pickupRequestId: id },
        emitOutbox: false,
      });

      return updated;
    });
  }
}
