import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
  Optional,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { OperationalHoldGuard } from '../holds/operational-hold.guard';
import { HouseShipmentsRepository } from './house-shipments.repository';
import { CreateHouseShipmentDto } from './dto/create-house-shipment.dto';
import { UpdateHouseShipmentDto } from './dto/update-house-shipment.dto';
import { AddPackagesToHouseShipmentDto } from './dto/add-packages-to-house-shipment.dto';
import { HouseShipmentRecord } from './house-shipment.types';
import { PrismaAuditOutboxWriter } from '../audit/prisma-audit-outbox.writer';
import type { CommandContext } from '../request-context/request-context.types';

@Injectable()
export class HouseShipmentsService {
  private readonly auditOutbox = new PrismaAuditOutboxWriter();

  constructor(
    private readonly repository: HouseShipmentsRepository,
    private readonly prisma: PrismaService,
    @Optional()
    private readonly operationalHoldGuard?: OperationalHoldGuard,
  ) {}

  async create(
    ctx: CommandContext,
    dispatchId: string,
    dto: CreateHouseShipmentDto,
  ): Promise<HouseShipmentRecord> {
    const existing = await this.prisma.houseShipment.findUnique({
      where: {
        organizationId_hawb: {
          organizationId: ctx.organizationId,
          hawb: dto.hawb,
        },
      },
    });

    if (existing) {
      throw new ConflictException('HAWB already exists in this organization');
    }

    const dispatch = await this.prisma.dispatch.findUnique({
      where: {
        organizationId_id: {
          organizationId: ctx.organizationId,
          id: dispatchId,
        },
      },
    });

    if (!dispatch) {
      throw new NotFoundException('Dispatch not found');
    }

    const shipment = await this.repository.create(
      ctx.organizationId,
      dispatchId,
      dto,
    );

    await this.auditOutbox.write(this.prisma, {
      context: ctx,
      action: 'house_shipment.created',
      entityType: 'HOUSE_SHIPMENT',
      entityId: shipment.id,
      changedFields: ['hawb', 'notes'],
      payload: dto as unknown as Record<string, unknown>,
    });

    return shipment;
  }

  async findByDispatchId(
    ctx: CommandContext,
    dispatchId: string,
  ): Promise<HouseShipmentRecord[]> {
    return this.repository.findByDispatchId(ctx.organizationId, dispatchId);
  }

  async findById(
    ctx: CommandContext,
    id: string,
  ): Promise<HouseShipmentRecord> {
    const shipment = await this.repository.findById(ctx.organizationId, id);
    if (!shipment) {
      throw new NotFoundException('House shipment not found');
    }
    return shipment;
  }

  async update(
    ctx: CommandContext,
    id: string,
    dto: UpdateHouseShipmentDto,
  ): Promise<HouseShipmentRecord> {
    const shipment = await this.findById(ctx, id);

    if (shipment.status !== 'DRAFT') {
      throw new ConflictException(
        'Cannot update a closed or cancelled house shipment',
      );
    }

    if (dto.hawb && dto.hawb !== shipment.hawb) {
      const existing = await this.prisma.houseShipment.findUnique({
        where: {
          organizationId_hawb: {
            organizationId: ctx.organizationId,
            hawb: dto.hawb,
          },
        },
      });

      if (existing) {
        throw new ConflictException('HAWB already exists in this organization');
      }
    }

    const updated = await this.repository.update(ctx.organizationId, id, dto);

    return updated;
  }

  async addPackages(
    ctx: CommandContext,
    id: string,
    dto: AddPackagesToHouseShipmentDto,
  ): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      const shipment = await tx.houseShipment.findUnique({
        where: {
          organizationId_id: { organizationId: ctx.organizationId, id },
        },
      });
      if (!shipment) {
        throw new NotFoundException('House shipment not found');
      }
      if (shipment.status !== 'DRAFT') {
        throw new ConflictException(
          'Cannot replace packages on a closed or cancelled house shipment',
        );
      }

      const packages = await tx.package.findMany({
        where: {
          organizationId: ctx.organizationId,
          id: { in: dto.packageIds },
        },
        select: { id: true, dispatchId: true },
      });
      if (packages.length !== dto.packageIds.length) {
        throw new NotFoundException('One or more packages not found');
      }
      const invalidDispatch = packages.find(
        (pkg) => pkg.dispatchId !== shipment.dispatchId,
      );
      if (invalidDispatch) {
        throw new BadRequestException(
          `Package ${invalidDispatch.id} does not belong to the Master Shipment ${shipment.dispatchId}`,
        );
      }

      await this.operationalHoldGuard?.assertNoActivePackageHolds(
        ctx.organizationId,
        dto.packageIds,
        { operation: 'house shipment package replacement', tx },
      );
      await tx.houseShipmentPackage.deleteMany({
        where: {
          organizationId: ctx.organizationId,
          houseShipmentId: id,
          packageId: { notIn: dto.packageIds },
        },
      });
      await tx.houseShipmentPackage.createMany({
        data: dto.packageIds.map((packageId) => ({
          organizationId: ctx.organizationId,
          houseShipmentId: id,
          packageId,
        })),
        skipDuplicates: true,
      });

      await this.auditOutbox.write(tx, {
        context: ctx,
        action: 'house_shipment.packages.replaced',
        entityType: 'HOUSE_SHIPMENT',
        entityId: id,
        changedFields: ['packages'],
        payload: { packageIds: dto.packageIds },
      });
    });
  }

  async close(ctx: CommandContext, id: string): Promise<void> {
    const shipment = await this.findById(ctx, id);

    if (shipment.status !== 'DRAFT') {
      throw new ConflictException('House shipment is not in DRAFT status');
    }

    if (shipment.packages.length === 0) {
      throw new ConflictException(
        'A house shipment must contain at least one package before closing',
      );
    }

    await this.operationalHoldGuard?.assertNoActivePackageHolds(
      ctx.organizationId,
      shipment.packages.map((item) => item.packageId),
      { operation: 'house shipment close' },
    );

    // Use transaction for closing
    await this.prisma.$transaction(async (tx) => {
      await tx.houseShipment.update({
        where: {
          organizationId_id: {
            organizationId: ctx.organizationId,
            id,
          },
        },
        data: {
          status: 'CLOSED',
        },
      });

      await this.auditOutbox.write(tx, {
        context: ctx,
        action: 'house_shipment.closed',
        entityType: 'HOUSE_SHIPMENT',
        entityId: id,
        changedFields: ['status'],
        payload: { previousStatus: shipment.status, newStatus: 'CLOSED' },
      });
    });
  }

  async cancel(ctx: CommandContext, id: string): Promise<void> {
    const shipment = await this.findById(ctx, id);

    if (shipment.status !== 'DRAFT') {
      throw new ConflictException(
        'Only a DRAFT house shipment can be cancelled',
      );
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.houseShipment.update({
        where: {
          organizationId_id: {
            organizationId: ctx.organizationId,
            id,
          },
        },
        data: {
          status: 'CANCELLED',
        },
      });

      await this.auditOutbox.write(tx, {
        context: ctx,
        action: 'house_shipment.cancelled',
        entityType: 'HOUSE_SHIPMENT',
        entityId: id,
        changedFields: ['status'],
        payload: { previousStatus: shipment.status, newStatus: 'CANCELLED' },
      });
    });
  }
}
