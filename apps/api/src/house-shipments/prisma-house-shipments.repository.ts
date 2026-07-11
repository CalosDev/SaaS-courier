import { Injectable } from '@nestjs/common';
import type { Prisma } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { HouseShipmentsRepository } from './house-shipments.repository';
import { CreateHouseShipmentDto } from './dto/create-house-shipment.dto';
import { UpdateHouseShipmentDto } from './dto/update-house-shipment.dto';
import { HouseShipmentRecord } from './house-shipment.types';

@Injectable()
export class PrismaHouseShipmentsRepository implements HouseShipmentsRepository {
  constructor(private readonly prisma: PrismaService) {}

  private get includeParams() {
    return {
      packages: {
        include: {
          package: true,
        },
      },
    };
  }

  async create(
    organizationId: string,
    dispatchId: string,
    dto: CreateHouseShipmentDto,
  ): Promise<HouseShipmentRecord> {
    return this.prisma.houseShipment.create({
      data: {
        organizationId,
        dispatchId,
        hawb: dto.hawb,
        notes: dto.notes,
      },
      include: this.includeParams,
    });
  }

  async findById(
    organizationId: string,
    id: string,
  ): Promise<HouseShipmentRecord | null> {
    return this.prisma.houseShipment.findUnique({
      where: {
        organizationId_id: {
          organizationId,
          id,
        },
      },
      include: this.includeParams,
    });
  }

  async findByDispatchId(
    organizationId: string,
    dispatchId: string,
  ): Promise<HouseShipmentRecord[]> {
    return this.prisma.houseShipment.findMany({
      where: {
        organizationId,
        dispatchId,
      },
      include: this.includeParams,
      orderBy: { createdAt: 'desc' },
    });
  }

  async update(
    organizationId: string,
    id: string,
    dto: UpdateHouseShipmentDto,
  ): Promise<HouseShipmentRecord> {
    const data: Prisma.HouseShipmentUpdateInput = {};
    if (dto.hawb !== undefined) {
      data.hawb = dto.hawb;
    }
    if (dto.notes !== undefined) {
      data.notes = dto.notes;
    }

    return this.prisma.houseShipment.update({
      where: {
        organizationId_id: {
          organizationId,
          id,
        },
      },
      data,
      include: this.includeParams,
    });
  }

  async addPackages(
    organizationId: string,
    id: string,
    packageIds: string[],
  ): Promise<void> {
    const data = packageIds.map((packageId) => ({
      organizationId,
      houseShipmentId: id,
      packageId,
    }));

    await this.prisma.houseShipmentPackage.createMany({
      data,
      skipDuplicates: true,
    });
  }

  async removePackages(
    organizationId: string,
    id: string,
    packageIds: string[],
  ): Promise<void> {
    await this.prisma.houseShipmentPackage.deleteMany({
      where: {
        organizationId,
        houseShipmentId: id,
        packageId: {
          in: packageIds,
        },
      },
    });
  }

  async updateStatus(
    organizationId: string,
    id: string,
    status: 'CLOSED' | 'CANCELLED',
  ): Promise<void> {
    await this.prisma.houseShipment.update({
      where: {
        organizationId_id: {
          organizationId,
          id,
        },
      },
      data: {
        status,
      },
    });
  }
}
