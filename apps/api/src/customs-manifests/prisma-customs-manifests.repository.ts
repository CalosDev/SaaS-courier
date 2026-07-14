import { Injectable } from '@nestjs/common';
import { Prisma, CustomsManifestStatus } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CustomsManifestsRepository } from './customs-manifests.repository';
import { CreateCustomsManifestDto } from './dto/create-customs-manifest.dto';
import { UpdateCustomsManifestDto } from './dto/update-customs-manifest.dto';
import {
  CustomsManifestDetailRecord,
  CustomsManifestRecord,
} from './customs-manifest.types';

@Injectable()
export class PrismaCustomsManifestsRepository implements CustomsManifestsRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findMany(organizationId: string): Promise<CustomsManifestRecord[]> {
    return this.prisma.customsManifest.findMany({
      where: {
        organizationId,
        deletedAt: null,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async create(
    organizationId: string,
    code: string,
    dto: CreateCustomsManifestDto,
    tx: Prisma.TransactionClient = this.prisma,
  ): Promise<CustomsManifestRecord> {
    const arrivalDate = dto.arrivalDate ? new Date(dto.arrivalDate) : null;
    return tx.customsManifest.create({
      data: {
        organizationId,
        dispatchId: dto.masterShipmentId,
        code,
        flightNumber: dto.flightNumber,
        arrivalDate,
      },
    });
  }

  async findById(
    organizationId: string,
    id: string,
    tx: Prisma.TransactionClient = this.prisma,
  ): Promise<CustomsManifestRecord | null> {
    return tx.customsManifest.findUnique({
      where: {
        organizationId_id: {
          organizationId,
          id,
        },
      },
    });
  }

  async findDetailById(
    organizationId: string,
    id: string,
  ): Promise<CustomsManifestDetailRecord | null> {
    return this.prisma.customsManifest.findUnique({
      where: {
        organizationId_id: {
          organizationId,
          id,
        },
      },
      include: {
        dispatch: {
          include: { originFacility: true, destinationFacility: true },
        },
        versions: {
          include: { items: true },
          orderBy: { versionNumber: 'desc' },
        },
        finalizedVersion: { include: { items: true } },
      },
    });
  }

  async findByCode(
    organizationId: string,
    code: string,
  ): Promise<CustomsManifestRecord | null> {
    return this.prisma.customsManifest.findUnique({
      where: {
        organizationId_code: {
          organizationId,
          code,
        },
      },
    });
  }

  async update(
    organizationId: string,
    id: string,
    dto: UpdateCustomsManifestDto,
    tx: Prisma.TransactionClient = this.prisma,
  ): Promise<CustomsManifestRecord> {
    const data: Prisma.CustomsManifestUpdateInput = {};
    if (dto.flightNumber !== undefined) {
      data.flightNumber = dto.flightNumber;
    }
    if (dto.arrivalDate !== undefined) {
      data.arrivalDate = dto.arrivalDate ? new Date(dto.arrivalDate) : null;
    }

    return tx.customsManifest.update({
      where: {
        organizationId_id: {
          organizationId,
          id,
        },
      },
      data,
    });
  }

  async addPackages(
    organizationId: string,
    manifestId: string,
    packageIds: string[],
    tx?: Prisma.TransactionClient,
  ): Promise<void> {
    const run = async (client: Prisma.TransactionClient) => {
      await client.package.updateMany({
        where: {
          organizationId,
          id: { in: packageIds },
          customsManifestId: null,
        },
        data: {
          customsManifestId: manifestId,
        },
      });

      const manifestPackages = await client.package.findMany({
        where: {
          organizationId,
          customsManifestId: manifestId,
        },
        include: {
          reception: true,
          prealert: true,
        },
      });

      let totalWeightMinor = 0n;
      let totalValueMinor = 0n;

      for (const pkg of manifestPackages) {
        if (pkg.reception?.weight) {
          const weightVal = Number(pkg.reception.weight.toString()) * 1000;
          totalWeightMinor += BigInt(Math.round(weightVal));
        }
        if (pkg.prealert?.declaredValue) {
          const val = Number(pkg.prealert.declaredValue.toString()) * 100;
          totalValueMinor += BigInt(Math.round(val));
        }
      }

      await client.customsManifest.update({
        where: { organizationId_id: { organizationId, id: manifestId } },
        data: {
          totalPackages: manifestPackages.length,
          totalWeightMinor,
          totalValueMinor,
        },
      });
    };

    if (tx) {
      await run(tx);
      return;
    }

    await this.prisma.$transaction(run);
  }

  async removePackages(
    organizationId: string,
    manifestId: string,
    packageIds: string[],
    tx?: Prisma.TransactionClient,
  ): Promise<void> {
    const run = async (client: Prisma.TransactionClient) => {
      await client.package.updateMany({
        where: {
          organizationId,
          id: { in: packageIds },
          customsManifestId: manifestId,
        },
        data: {
          customsManifestId: null,
        },
      });

      const manifestPackages = await client.package.findMany({
        where: {
          organizationId,
          customsManifestId: manifestId,
        },
        include: {
          reception: true,
          prealert: true,
        },
      });

      let totalWeightMinor = 0n;
      let totalValueMinor = 0n;

      for (const pkg of manifestPackages) {
        if (pkg.reception?.weight) {
          const weightVal = Number(pkg.reception.weight.toString()) * 1000;
          totalWeightMinor += BigInt(Math.round(weightVal));
        }
        if (pkg.prealert?.declaredValue) {
          const val = Number(pkg.prealert.declaredValue.toString()) * 100;
          totalValueMinor += BigInt(Math.round(val));
        }
      }

      await client.customsManifest.update({
        where: { organizationId_id: { organizationId, id: manifestId } },
        data: {
          totalPackages: manifestPackages.length,
          totalWeightMinor,
          totalValueMinor,
        },
      });
    };

    if (tx) {
      await run(tx);
      return;
    }

    await this.prisma.$transaction(run);
  }

  async updateStatus(
    organizationId: string,
    id: string,
    status: CustomsManifestStatus,
    tx: Prisma.TransactionClient = this.prisma,
  ): Promise<void> {
    await tx.customsManifest.update({
      where: { organizationId_id: { organizationId, id } },
      data: { status },
    });
  }
}
