import {
  Inject,
  Injectable,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { CreateCustomsManifestDto } from './dto/create-customs-manifest.dto';
import { UpdateCustomsManifestDto } from './dto/update-customs-manifest.dto';
import { AddPackagesToCustomsManifestDto } from './dto/add-packages.dto';
import type { CustomsManifestsRepository } from './customs-manifests.repository';
import { CustomsManifestsRepositoryToken } from './customs-manifests.repository';
import { CustomsManifestErrors } from './customs-manifest.errors';
import { CustomsManifestStatus } from '../generated/prisma/client';
import { CustomsManifestRecord } from './customs-manifest.types';
import { PrismaAuditOutboxWriter } from '../audit/prisma-audit-outbox.writer';
import type { CommandContext } from '../request-context/request-context.types';
import { PrismaService } from '../prisma/prisma.service';
import { SigaApiService } from '../siga-integration/siga-api.service';

@Injectable()
export class CustomsManifestsService {
  private readonly auditOutbox = new PrismaAuditOutboxWriter();

  constructor(
    @Inject(CustomsManifestsRepositoryToken)
    private readonly repository: CustomsManifestsRepository,
    private readonly prisma: PrismaService,
    private readonly sigaApi: SigaApiService,
  ) {}

  async list(ctx: CommandContext): Promise<CustomsManifestRecord[]> {
    return this.repository.findMany(ctx.organizationId);
  }

  async create(
    ctx: CommandContext,
    dto: CreateCustomsManifestDto,
  ): Promise<CustomsManifestRecord> {
    const code = this.generateCode();

    return this.prisma.$transaction(async (tx) => {
      const manifest = await this.repository.create(
        ctx.organizationId,
        code,
        dto,
        tx,
      );

      await this.auditOutbox.write(tx, {
        context: ctx,
        action: 'customs_manifest.created',
        entityType: 'CUSTOMS_MANIFEST',
        entityId: manifest.id,
        changedFields: ['flightNumber', 'arrivalDate'],
        payload: {
          flightNumber: manifest.flightNumber,
          arrivalDate: manifest.arrivalDate,
        },
      });

      return manifest;
    });
  }

  async findById(
    ctx: CommandContext,
    id: string,
  ): Promise<CustomsManifestRecord> {
    const manifest = await this.repository.findById(ctx.organizationId, id);
    if (!manifest) {
      throw new NotFoundException(CustomsManifestErrors.NotFound.message);
    }
    return manifest;
  }

  async update(
    ctx: CommandContext,
    id: string,
    dto: UpdateCustomsManifestDto,
  ): Promise<CustomsManifestRecord> {
    return this.prisma.$transaction(async (tx) => {
      const existing = await this.repository.findById(
        ctx.organizationId,
        id,
        tx,
      );
      if (!existing) {
        throw new NotFoundException(CustomsManifestErrors.NotFound.message);
      }

      if (existing.status !== CustomsManifestStatus.DRAFT) {
        throw new ConflictException(
          CustomsManifestErrors.InvalidStatus.message,
        );
      }

      const updated = await this.repository.update(
        ctx.organizationId,
        id,
        dto,
        tx,
      );

      await this.auditOutbox.write(tx, {
        context: ctx,
        action: 'customs_manifest.updated',
        entityType: 'CUSTOMS_MANIFEST',
        entityId: updated.id,
        changedFields: ['flightNumber', 'arrivalDate'],
        payload: {
          flightNumber: updated.flightNumber,
          arrivalDate: updated.arrivalDate,
        },
        beforeData: {
          flightNumber: existing.flightNumber,
          arrivalDate: existing.arrivalDate,
        },
        afterData: {
          flightNumber: updated.flightNumber,
          arrivalDate: updated.arrivalDate,
        },
      });

      return updated;
    });
  }

  async addPackages(
    ctx: CommandContext,
    id: string,
    dto: AddPackagesToCustomsManifestDto,
  ): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      const manifest = await this.repository.findById(
        ctx.organizationId,
        id,
        tx,
      );
      if (!manifest) {
        throw new NotFoundException(CustomsManifestErrors.NotFound.message);
      }

      if (manifest.status !== CustomsManifestStatus.DRAFT) {
        throw new ConflictException(
          CustomsManifestErrors.InvalidStatus.message,
        );
      }

      await this.repository.addPackages(
        ctx.organizationId,
        id,
        dto.packageIds,
        tx,
      );

      await this.auditOutbox.write(tx, {
        context: ctx,
        action: 'customs_manifest.packages_added',
        entityType: 'CUSTOMS_MANIFEST',
        entityId: id,
        changedFields: ['packages'],
        payload: { addedPackages: dto.packageIds },
      });
    });
  }

  async removePackages(
    ctx: CommandContext,
    id: string,
    dto: AddPackagesToCustomsManifestDto,
  ): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      const manifest = await this.repository.findById(
        ctx.organizationId,
        id,
        tx,
      );
      if (!manifest) {
        throw new NotFoundException(CustomsManifestErrors.NotFound.message);
      }

      if (manifest.status !== CustomsManifestStatus.DRAFT) {
        throw new ConflictException(
          CustomsManifestErrors.InvalidStatus.message,
        );
      }

      await this.repository.removePackages(
        ctx.organizationId,
        id,
        dto.packageIds,
        tx,
      );

      await this.auditOutbox.write(tx, {
        context: ctx,
        action: 'customs_manifest.packages_removed',
        entityType: 'CUSTOMS_MANIFEST',
        entityId: id,
        changedFields: ['packages'],
        payload: { removedPackages: dto.packageIds },
      });
    });
  }

  async transmit(
    ctx: CommandContext,
    id: string,
  ): Promise<CustomsManifestRecord> {
    const manifest = await this.findById(ctx, id);

    if (manifest.status !== CustomsManifestStatus.DRAFT) {
      throw new ConflictException(CustomsManifestErrors.InvalidStatus.message);
    }

    // Call Siga API
    const response = await this.sigaApi.transmitManifest(
      ctx.organizationId,
      manifest.id,
      { code: manifest.code },
    );

    if (!response.success) {
      throw new Error(
        `Failed to transmit manifest to SIGA: ${response.errorMessage}`,
      );
    }

    return this.prisma.$transaction(async (tx) => {
      await this.repository.updateStatus(
        ctx.organizationId,
        id,
        CustomsManifestStatus.SUBMITTED,
        tx,
      );

      const updated = await this.repository.findById(
        ctx.organizationId,
        id,
        tx,
      );
      if (!updated) {
        throw new NotFoundException(CustomsManifestErrors.NotFound.message);
      }

      await this.auditOutbox.write(tx, {
        context: ctx,
        action: 'customs_manifest.updated',
        entityType: 'CUSTOMS_MANIFEST',
        entityId: id,
        changedFields: ['status'],
        payload: {
          sigaReferenceCode: response.sigaReferenceCode,
          transmittedAt: response.transmittedAt,
        },
        beforeData: { status: manifest.status },
        afterData: { status: updated.status },
      });

      return updated;
    });
  }

  private generateCode(): string {
    const random = Math.floor(10000 + Math.random() * 90000);
    const date = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    return `CM-${date}-${random}`;
  }
}
