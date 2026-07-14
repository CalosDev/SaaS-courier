import {
  Inject,
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
  Optional,
} from '@nestjs/common';
import { CreateCustomsManifestDto } from './dto/create-customs-manifest.dto';
import { UpdateCustomsManifestDto } from './dto/update-customs-manifest.dto';
import { AddPackagesToCustomsManifestDto } from './dto/add-packages.dto';
import type { CustomsManifestsRepository } from './customs-manifests.repository';
import { CustomsManifestsRepositoryToken } from './customs-manifests.repository';
import { CustomsManifestErrors } from './customs-manifest.errors';
import { CustomsManifestStatus } from '../generated/prisma/client';
import {
  CustomsManifestDetailRecord,
  CustomsManifestRecord,
} from './customs-manifest.types';
import { PrismaAuditOutboxWriter } from '../audit/prisma-audit-outbox.writer';
import { OperationalHoldGuard } from '../holds/operational-hold.guard';
import type { CommandContext } from '../request-context/request-context.types';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class CustomsManifestsService {
  private readonly auditOutbox = new PrismaAuditOutboxWriter();

  constructor(
    @Inject(CustomsManifestsRepositoryToken)
    private readonly repository: CustomsManifestsRepository,
    private readonly prisma: PrismaService,
    @Optional()
    private readonly operationalHoldGuard?: OperationalHoldGuard,
  ) {}

  async list(ctx: CommandContext): Promise<CustomsManifestRecord[]> {
    return this.repository.findMany(ctx.organizationId);
  }

  async create(
    ctx: CommandContext,
    dto: CreateCustomsManifestDto,
  ): Promise<CustomsManifestRecord> {
    return this.prisma.$transaction(async (tx) => {
      const shipment = await tx.dispatch.findUnique({
        where: {
          organizationId_id: {
            organizationId: ctx.organizationId,
            id: dto.masterShipmentId,
          },
        },
      });
      if (!shipment) {
        throw new NotFoundException('Master shipment not found');
      }
      if (shipment.status === 'CANCELLED') {
        throw new ConflictException(
          'Cannot create a manifest for a cancelled master shipment',
        );
      }

      const code = this.generateCode();
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
        changedFields: ['dispatchId', 'flightNumber', 'arrivalDate'],
        payload: {
          masterShipmentId: manifest.dispatchId,
          flightNumber: manifest.flightNumber,
          arrivalDate: manifest.arrivalDate,
        },
      });

      return manifest;
    });
  }

  async buildVersion(ctx: CommandContext, id: string) {
    return this.prisma.$transaction(async (tx) => {
      const manifest = await tx.customsManifest.findUnique({
        where: {
          organizationId_id: { organizationId: ctx.organizationId, id },
        },
        include: {
          dispatch: {
            include: {
              originFacility: true,
              destinationFacility: true,
              packages: {
                include: {
                  customer: true,
                  prealert: true,
                  reception: true,
                },
              },
            },
          },
        },
      });
      if (!manifest) {
        throw new NotFoundException(CustomsManifestErrors.NotFound.message);
      }
      if (
        manifest.status === CustomsManifestStatus.FINALIZED ||
        manifest.status === CustomsManifestStatus.CANCELLED
      ) {
        throw new ConflictException('The manifest is frozen');
      }
      if (!manifest.dispatch) {
        throw new ConflictException(
          'The manifest is not linked to a master shipment',
        );
      }
      if (manifest.dispatch.packages.length === 0) {
        throw new BadRequestException(
          'The master shipment must contain at least one package',
        );
      }

      const versionNumber = manifest.currentVersion + 1;
      const shipmentSnapshot = {
        masterShipmentId: manifest.dispatch.id,
        dispatchCode: manifest.dispatch.dispatchCode,
        mawb: manifest.dispatch.mawb,
        flightNumber: manifest.flightNumber ?? manifest.dispatch.flightNumber,
        arrivalDate: manifest.arrivalDate?.toISOString().slice(0, 10) ?? null,
        origin: manifest.dispatch.originFacility
          ? {
              id: manifest.dispatch.originFacility.id,
              code: manifest.dispatch.originFacility.code,
              name: manifest.dispatch.originFacility.name,
            }
          : null,
        destination: manifest.dispatch.destinationFacility
          ? {
              id: manifest.dispatch.destinationFacility.id,
              code: manifest.dispatch.destinationFacility.code,
              name: manifest.dispatch.destinationFacility.name,
            }
          : null,
        transportMode: manifest.dispatch.transportMode,
      };
      const itemData = manifest.dispatch.packages.map((pkg) => ({
        itemSnapshot: {
          packageId: pkg.id,
          internalTrackingNumber: pkg.internalTrackingNumber,
          externalTrackingNumber: pkg.externalTrackingNumber,
          status: pkg.status,
          customerCode: pkg.customer.customerCode,
          description: pkg.prealert?.description ?? null,
          declaredValue: pkg.prealert?.declaredValue?.toString() ?? null,
          currencyCode: pkg.prealert?.currencyCode ?? null,
          weight: pkg.reception?.weight?.toString() ?? null,
          weightUnit: pkg.reception?.weightUnit ?? null,
        },
        organization: { connect: { id: ctx.organizationId } },
        package: {
          connect: {
            organizationId_id: {
              organizationId: ctx.organizationId,
              id: pkg.id,
            },
          },
        },
      }));
      const version = await tx.customsManifestVersion.create({
        data: {
          versionNumber,
          shipmentSnapshot,
          organization: { connect: { id: ctx.organizationId } },
          manifest: {
            connect: {
              organizationId_id: { organizationId: ctx.organizationId, id },
            },
          },
          items: { create: itemData },
        },
        include: { items: true },
      });
      await tx.customsManifest.update({
        where: {
          organizationId_id: { organizationId: ctx.organizationId, id },
        },
        data: {
          currentVersion: versionNumber,
          status: CustomsManifestStatus.DRAFT,
          totalPackages: itemData.length,
        },
      });
      await this.auditOutbox.write(tx, {
        context: ctx,
        action: 'customs_manifest.version.created',
        entityType: 'CUSTOMS_MANIFEST',
        entityId: id,
        changedFields: ['currentVersion'],
        payload: { versionId: version.id, versionNumber },
        emitOutbox: false,
      });
      return version;
    });
  }

  async validateVersion(ctx: CommandContext, id: string) {
    return this.prisma.$transaction(async (tx) => {
      const manifest = await tx.customsManifest.findUnique({
        where: {
          organizationId_id: { organizationId: ctx.organizationId, id },
        },
        include: {
          versions: {
            orderBy: { versionNumber: 'desc' },
            take: 1,
            include: { items: true },
          },
        },
      });
      if (!manifest) {
        throw new NotFoundException(CustomsManifestErrors.NotFound.message);
      }
      if (
        manifest.status === CustomsManifestStatus.FINALIZED ||
        manifest.status === CustomsManifestStatus.CANCELLED
      ) {
        throw new ConflictException('The manifest is frozen');
      }
      const version = manifest.versions[0];
      if (!version) {
        throw new ConflictException('Build a manifest version first');
      }

      const errors: string[] = [];
      const snapshot = version.shipmentSnapshot as Record<string, unknown>;
      if (!snapshot.masterShipmentId)
        errors.push('masterShipmentId is required');
      if (!snapshot.origin) errors.push('origin facility is required');
      if (!snapshot.destination)
        errors.push('destination facility is required');
      if (version.items.length === 0)
        errors.push('at least one item is required');
      const isValid = errors.length === 0;
      const updated = await tx.customsManifestVersion.update({
        where: {
          organizationId_id: {
            organizationId: ctx.organizationId,
            id: version.id,
          },
        },
        data: {
          validationStatus: isValid ? 'VALID' : 'INVALID',
          validationErrors: errors,
        },
        include: { items: true },
      });
      await tx.customsManifest.update({
        where: {
          organizationId_id: { organizationId: ctx.organizationId, id },
        },
        data: {
          status: isValid
            ? CustomsManifestStatus.VALIDATED
            : CustomsManifestStatus.DRAFT,
        },
      });
      await this.auditOutbox.write(tx, {
        context: ctx,
        action: 'customs_manifest.validated',
        entityType: 'CUSTOMS_MANIFEST',
        entityId: id,
        changedFields: ['status', 'validationStatus'],
        payload: { versionId: version.id, isValid, errors },
        emitOutbox: false,
      });
      return updated;
    });
  }

  async finalize(ctx: CommandContext, id: string) {
    return this.prisma.$transaction(async (tx) => {
      const manifest = await tx.customsManifest.findUnique({
        where: {
          organizationId_id: { organizationId: ctx.organizationId, id },
        },
        include: {
          versions: { orderBy: { versionNumber: 'desc' }, take: 1 },
        },
      });
      if (!manifest) {
        throw new NotFoundException(CustomsManifestErrors.NotFound.message);
      }
      if (manifest.status === CustomsManifestStatus.FINALIZED) return manifest;
      if (manifest.status !== CustomsManifestStatus.VALIDATED) {
        throw new ConflictException('Validate the latest version first');
      }
      const version = manifest.versions[0];
      if (!version || version.validationStatus !== 'VALID') {
        throw new ConflictException('The latest version is not valid');
      }
      const finalized = await tx.customsManifest.update({
        where: {
          organizationId_id: { organizationId: ctx.organizationId, id },
        },
        data: {
          status: CustomsManifestStatus.FINALIZED,
          finalizedVersionId: version.id,
        },
      });
      await this.auditOutbox.write(tx, {
        context: ctx,
        action: 'customs_manifest.finalized',
        entityType: 'CUSTOMS_MANIFEST',
        entityId: id,
        changedFields: ['status', 'finalizedVersionId'],
        payload: {
          versionId: version.id,
          versionNumber: version.versionNumber,
        },
      });
      return finalized;
    });
  }

  async cancel(ctx: CommandContext, id: string) {
    return this.prisma.$transaction(async (tx) => {
      const manifest = await tx.customsManifest.findUnique({
        where: {
          organizationId_id: { organizationId: ctx.organizationId, id },
        },
      });
      if (!manifest) {
        throw new NotFoundException(CustomsManifestErrors.NotFound.message);
      }
      if (manifest.status === CustomsManifestStatus.CANCELLED) return manifest;
      if (manifest.status === CustomsManifestStatus.FINALIZED) {
        throw new ConflictException('A finalized manifest cannot be cancelled');
      }
      const cancelled = await tx.customsManifest.update({
        where: {
          organizationId_id: { organizationId: ctx.organizationId, id },
        },
        data: { status: CustomsManifestStatus.CANCELLED },
      });
      await this.auditOutbox.write(tx, {
        context: ctx,
        action: 'customs_manifest.cancelled',
        entityType: 'CUSTOMS_MANIFEST',
        entityId: id,
        changedFields: ['status'],
        payload: { previousStatus: manifest.status },
        emitOutbox: false,
      });
      return cancelled;
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

  async findDetailById(
    ctx: CommandContext,
    id: string,
  ): Promise<CustomsManifestDetailRecord> {
    const manifest = await this.repository.findDetailById(
      ctx.organizationId,
      id,
    );
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

      await this.operationalHoldGuard?.assertNoActivePackageHolds(
        ctx.organizationId,
        dto.packageIds,
        { operation: 'customs manifest package addition', tx },
      );

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

      await this.operationalHoldGuard?.assertNoActivePackageHolds(
        ctx.organizationId,
        dto.packageIds,
        { operation: 'customs manifest package removal', tx },
      );

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

  private generateCode(): string {
    const random = Math.floor(10000 + Math.random() * 90000);
    const date = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    return `CM-${date}-${random}`;
  }
}
