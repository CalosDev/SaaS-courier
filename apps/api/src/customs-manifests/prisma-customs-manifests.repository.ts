import { Injectable } from '@nestjs/common';
import { Prisma, CustomsManifestStatus } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CustomsManifestsRepository } from './customs-manifests.repository';
import { CreateCustomsManifestDto } from './dto/create-customs-manifest.dto';
import { UpdateCustomsManifestDto } from './dto/update-customs-manifest.dto';
import { CustomsManifestRecord } from './customs-manifest.types';

@Injectable()
export class PrismaCustomsManifestsRepository implements CustomsManifestsRepository {
  constructor(private readonly prisma: PrismaService) {}

  async create(
    organizationId: string,
    code: string,
    dto: CreateCustomsManifestDto,
  ): Promise<CustomsManifestRecord> {
    const arrivalDate = dto.arrivalDate ? new Date(dto.arrivalDate) : null;
    return this.prisma.customsManifest.create({
      data: {
        organizationId,
        code,
        flightNumber: dto.flightNumber,
        arrivalDate,
      },
    });
  }

  async findById(
    organizationId: string,
    id: string,
  ): Promise<CustomsManifestRecord | null> {
    return this.prisma.customsManifest.findUnique({
      where: {
        organizationId_id: {
          organizationId,
          id,
        },
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
  ): Promise<CustomsManifestRecord> {
    const data: Prisma.CustomsManifestUpdateInput = {};
    if (dto.flightNumber !== undefined) {
      data.flightNumber = dto.flightNumber;
    }
    if (dto.arrivalDate !== undefined) {
      data.arrivalDate = dto.arrivalDate ? new Date(dto.arrivalDate) : null;
    }

    return this.prisma.customsManifest.update({
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
  ): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      await tx.package.updateMany({
        where: {
          organizationId,
          id: { in: packageIds },
          customsManifestId: null,
        },
        data: {
          customsManifestId: manifestId,
        },
      });

      const manifestPackages = await tx.package.findMany({
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

      await tx.customsManifest.update({
        where: { organizationId_id: { organizationId, id: manifestId } },
        data: {
          totalPackages: manifestPackages.length,
          totalWeightMinor,
          totalValueMinor,
        },
      });
    });
  }

  async removePackages(
    organizationId: string,
    manifestId: string,
    packageIds: string[],
  ): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      await tx.package.updateMany({
        where: {
          organizationId,
          id: { in: packageIds },
          customsManifestId: manifestId,
        },
        data: {
          customsManifestId: null,
        },
      });

      const manifestPackages = await tx.package.findMany({
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

      await tx.customsManifest.update({
        where: { organizationId_id: { organizationId, id: manifestId } },
        data: {
          totalPackages: manifestPackages.length,
          totalWeightMinor,
          totalValueMinor,
        },
      });
    });
  }

  async updateStatus(
    organizationId: string,
    id: string,
    status: CustomsManifestStatus,
  ): Promise<void> {
    await this.prisma.customsManifest.update({
      where: { organizationId_id: { organizationId, id } },
      data: { status },
    });
  }
}
